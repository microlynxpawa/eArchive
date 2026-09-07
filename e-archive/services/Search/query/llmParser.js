const { getVocabulary } = require("./vocabulary");

/**
 * Turns a typed sentence into a QuerySpec using a language model.
 *
 * PRIVACY INVARIANT
 * -----------------
 * This sends the user's search phrase and the list of branch, department and
 * user names. It never sends document text, filenames, or anything extracted
 * by the indexer. Document contents do not leave the premises, in this phase
 * or any other. Any future feature that would send a snippet to a model must
 * sit behind its own default-off flag and be agreed with the client first.
 *
 * The search phrase itself can still carry personal data - "Kwame Mensah's
 * payslip" is a real name - which is why AI_QUERY_ENABLED exists and defaults
 * to off. It belongs in the client's data agreement before it is switched on.
 *
 * Everything this returns is validated against the live vocabulary and dropped
 * if unrecognised, so the model cannot invent a department that does not exist
 * and quietly filter every result away. Any failure at all - flag off, no
 * network, timeout, malformed JSON - falls through to the rules parser, which
 * is why the feature can degrade instead of breaking.
 */

const DEFAULT_TIMEOUT_MS = 3000;
const MAX_TOKENS = 400;
const MAX_QUERY_CHARS = 300;

// The vocabulary is sent in the prompt, so it has to stay small enough to be
// worth sending. Past this the model gets the departments and branches (few,
// and the ones that actually disambiguate) but not every username.
const MAX_USERS_IN_PROMPT = 200;

function config() {
  return {
    enabled: process.env.AI_QUERY_ENABLED === "true",
    provider: (process.env.AI_PROVIDER || "openai-compatible").toLowerCase(),
    baseUrl: process.env.AI_BASE_URL || "",
    model: process.env.AI_MODEL || "",
    apiKey: process.env.AI_API_KEY || "",
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS,
  };
}

function getAdapter(provider) {
  if (provider === "anthropic") return require("./providers/anthropic");
  return require("./providers/openaiCompatible");
}

const SYSTEM_PROMPT = [
  "You convert a document-archive search phrase into JSON. Reply with JSON only:",
  "no prose, no markdown, no code fences.",
  "",
  "Schema:",
  '{"terms":[string],"phrases":[string],"department":string|null,"branch":string|null,',
  '"uploader":string|null,"fileTypes":[string]|null,"batch":string|null,',
  '"dateFrom":"YYYY-MM-DD"|null,"dateTo":"YYYY-MM-DD"|null}',
  "",
  "Rules:",
  "- terms: the words to search for, with filler removed. Keep names and numbers.",
  "- phrases: only word sequences the user quoted or clearly meant as one unit.",
  "- department, branch, uploader: ONLY a value from the provided lists, copied",
  "  exactly. If the phrase does not clearly name one, use null. Never guess.",
  "- fileTypes: file extensions without a dot, e.g. [\"pdf\"], or null.",
  "- Resolve relative dates against the given current date.",
  "- Anything you are unsure about is null. A wrong filter hides the file the",
  "  person is looking for, which is worse than no filter at all.",
].join("\n");

function buildUserPrompt(query, vocab, now) {
  const users = vocab.users.slice(0, MAX_USERS_IN_PROMPT).map((u) => u.username).filter(Boolean);
  return [
    `Current date: ${now.toISOString().slice(0, 10)}`,
    `Departments: ${JSON.stringify(vocab.departments.map((d) => d.name))}`,
    `Branches: ${JSON.stringify(vocab.branches.map((b) => b.name))}`,
    `Usernames: ${JSON.stringify(users)}`,
    "",
    `Search phrase: ${JSON.stringify(query)}`,
  ].join("\n");
}

/** Models like to wrap JSON in prose or fences however firmly they are told not to. */
function extractJson(text) {
  const trimmed = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Fall back to the outermost braces.
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("no JSON object in response");
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

function cleanStrings(value, limit) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(value + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Case-insensitive exact match against a known list; anything else is dropped. */
function matchKnown(value, names) {
  if (typeof value !== "string" || !value.trim()) return null;
  const wanted = value.trim().toLowerCase();
  return names.find((n) => n.toLowerCase() === wanted) || null;
}

/**
 * Turns the model's JSON into a QuerySpec, discarding anything it made up.
 */
function toSpec(raw, vocab) {
  const spec = { terms: [], phrases: [], filters: {}, source: "llm", unparsed: "" };

  spec.terms = cleanStrings(raw.terms, 12).map((t) => t.toLowerCase());
  spec.phrases = cleanStrings(raw.phrases, 6);

  const department = matchKnown(raw.department, vocab.departments.map((d) => d.name));
  if (department) spec.filters.department = department;

  const branch = matchKnown(raw.branch, vocab.branches.map((b) => b.name));
  if (branch) spec.filters.branch = branch;

  const uploader = matchKnown(raw.uploader, vocab.users.map((u) => u.username).filter(Boolean));
  if (uploader) {
    const user = vocab.users.find((u) => u.username === uploader);
    spec.filters.uploaderUsername = uploader;
    if (user) spec.filters.uploaderUserId = user.id;
  }

  const types = cleanStrings(raw.fileTypes, 5).map((t) => t.replace(/^\./, "").toLowerCase());
  if (types.length > 0) spec.filters.fileTypes = types;

  if (typeof raw.batch === "string" && raw.batch.trim()) spec.filters.batch = raw.batch.trim();

  const from = parseDate(raw.dateFrom);
  const to = parseDate(raw.dateTo);
  if (from) spec.filters.dateFrom = from;
  if (to) {
    // An end date the user meant inclusively: "up to the 7th" includes the 7th.
    to.setHours(23, 59, 59, 999);
    spec.filters.dateTo = to;
  }

  return spec;
}

/**
 * @returns {Promise<object|null>} a QuerySpec, or null to use the rules parser
 */
async function parseWithLlm(query, { now = new Date() } = {}) {
  const cfg = config();
  if (!cfg.enabled) return null;
  if (!cfg.model || !cfg.apiKey) {
    console.warn("[Search] AI_QUERY_ENABLED is on but AI_MODEL/AI_API_KEY are not set; using rules.");
    return null;
  }

  const text = String(query || "").trim().slice(0, MAX_QUERY_CHARS);
  if (!text) return null;

  try {
    const vocab = await getVocabulary();
    const adapter = getAdapter(cfg.provider);

    const reply = await adapter.complete({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(text, vocab, now),
      timeoutMs: cfg.timeoutMs,
      maxTokens: MAX_TOKENS,
    });

    const spec = toSpec(extractJson(reply), vocab);

    // A reply with nothing searchable in it is not an improvement on the rules
    // parser, so treat it as a miss rather than returning an empty search.
    if (spec.terms.length === 0 && spec.phrases.length === 0 &&
        Object.keys(spec.filters).length === 0) {
      return null;
    }
    return spec;
  } catch (err) {
    // Deliberately not fatal, and deliberately one line: an unreachable model
    // must cost a search nothing more than the timeout.
    console.warn(`[Search] LLM query parse failed (${err.message}); using rules.`);
    return null;
  }
}

module.exports = { parseWithLlm, toSpec, extractJson, SYSTEM_PROMPT, buildUserPrompt };
