const { getVocabulary } = require("./vocabulary");

/**
 * Turns "kofi receipt from jmensah last week" into a QuerySpec, deterministically.
 *
 * This is the default parser and the fallback for the optional LLM one. It runs
 * with no network, no API key and no cost, which matters because the product is
 * deployed on client premises that may have no internet at all.
 *
 * QuerySpec:
 *   {
 *     terms:   ['kofi', 'receipt'],
 *     phrases: ['invoice 4471'],
 *     filters: { dateFrom, dateTo, uploaderUserId, uploaderUsername,
 *                department, branch, fileTypes: ['pdf'], batch },
 *     source: 'rules',
 *     unparsed: 'kofi receipt'
 *   }
 *
 * Each pass removes what it consumed from the working string, so a branch name
 * or a date never survives to be searched as a keyword too.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "of", "and", "or", "to", "in", "on", "at", "is", "was", "for",
  "with", "my", "me", "i", "we", "our", "it", "that", "this", "find", "search",
  "show", "get", "file", "files", "document", "documents", "please", "all",
  // dropped only after the "from <person>" pass has had its chance at them
  "from", "by", "uploaded", "anything", "something",
]);

const MONTHS = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3,
  may: 4, june: 5, jun: 5, july: 6, jul: 6, august: 7, aug: 7,
  september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10,
  december: 11, dec: 11,
};

const TYPE_WORDS = {
  pdf: ["pdf"],
  image: ["jpg", "jpeg", "png"],
  scan: ["jpg", "jpeg", "png", "pdf"],
  photo: ["jpg", "jpeg", "png"],
  picture: ["jpg", "jpeg", "png"],
  excel: ["xlsx", "xls", "csv"],
  spreadsheet: ["xlsx", "xls", "csv"],
  word: ["doc", "docx"],
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Escape a value so it can be dropped into a RegExp safely. */
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Dates. Returns { dateFrom, dateTo, consumed } or null.
 * Ordered longest-phrase-first so "last 3 months" wins over "last".
 */
function parseDates(text, now = new Date()) {
  const t = text.toLowerCase();

  const between = (from, to, consumed) => ({
    dateFrom: startOfDay(from), dateTo: endOfDay(to), consumed,
  });

  let m;

  if ((m = t.match(/\blast (\d{1,2}) (day|days|week|weeks|month|months|year|years)\b/))) {
    const n = parseInt(m[1], 10);
    const unit = m[2];
    const from = new Date(now);
    if (unit.startsWith("day")) from.setDate(from.getDate() - n);
    else if (unit.startsWith("week")) from.setDate(from.getDate() - n * 7);
    else if (unit.startsWith("month")) from.setMonth(from.getMonth() - n);
    else from.setFullYear(from.getFullYear() - n);
    return between(from, now, m[0]);
  }

  if ((m = t.match(/\b(\d{1,2}) (day|days|week|weeks|month|months) ago\b/))) {
    const n = parseInt(m[1], 10);
    const day = new Date(now);
    if (m[2].startsWith("day")) day.setDate(day.getDate() - n);
    else if (m[2].startsWith("week")) day.setDate(day.getDate() - n * 7);
    else day.setMonth(day.getMonth() - n);
    return between(day, day, m[0]);
  }

  if ((m = t.match(/\btoday\b/))) return between(now, now, m[0]);

  if ((m = t.match(/\byesterday\b/))) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    return between(d, d, m[0]);
  }

  if ((m = t.match(/\blast week\b/))) {
    const from = new Date(now); from.setDate(from.getDate() - 7);
    return between(from, now, m[0]);
  }
  if ((m = t.match(/\bthis week\b/))) {
    const from = new Date(now); from.setDate(from.getDate() - from.getDay());
    return between(from, now, m[0]);
  }
  if ((m = t.match(/\blast month\b/))) {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return between(from, to, m[0]);
  }
  if ((m = t.match(/\bthis month\b/))) {
    return between(new Date(now.getFullYear(), now.getMonth(), 1), now, m[0]);
  }
  if ((m = t.match(/\blast year\b/))) {
    const y = now.getFullYear() - 1;
    return between(new Date(y, 0, 1), new Date(y, 11, 31), m[0]);
  }
  if ((m = t.match(/\bthis year\b/))) {
    return between(new Date(now.getFullYear(), 0, 1), now, m[0]);
  }

  // explicit d-m-yyyy or d/m/yyyy, matching how the archive names files
  if ((m = t.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/))) {
    const d = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    if (!isNaN(d)) return between(d, d, m[0]);
  }

  // "march 2025" / "in march"
  const monthNames = Object.keys(MONTHS).join("|");
  if ((m = t.match(new RegExp(`\\b(?:in\\s+)?(${monthNames})\\s+(\\d{4})\\b`)))) {
    const mo = MONTHS[m[1]];
    const y = parseInt(m[2], 10);
    return between(new Date(y, mo, 1), new Date(y, mo + 1, 0), m[0]);
  }
  if ((m = t.match(new RegExp(`\\b(?:in\\s+)?(${monthNames})\\b`)))) {
    const mo = MONTHS[m[1]];
    // the most recent occurrence of that month, this year or last
    const y = mo > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
    return between(new Date(y, mo, 1), new Date(y, mo + 1, 0), m[0]);
  }

  // bare year, but not a number that is really part of a document reference
  if ((m = t.match(/\b(20\d{2})\b/))) {
    const y = parseInt(m[1], 10);
    return between(new Date(y, 0, 1), new Date(y, 11, 31), m[0]);
  }

  return null;
}

/** Longest names first, so "Head Office" is not shadowed by a branch called "Head". */
function matchNamedEntity(text, names) {
  const sorted = [...names].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    if (!name) continue;
    const re = new RegExp(`\\b${rx(name.toLowerCase())}\\b`, "i");
    if (re.test(text)) return { name, consumed: text.match(re)[0] };
  }
  return null;
}

async function parseQuery(raw, { now = new Date() } = {}) {
  const spec = {
    terms: [],
    phrases: [],
    filters: {},
    source: "rules",
    unparsed: "",
  };

  let text = String(raw || "").trim();
  if (!text) return spec;

  const consume = (fragment) => {
    if (!fragment) return;
    text = text.replace(new RegExp(rx(fragment), "i"), " ");
  };

  // 1. quoted phrases, taken verbatim
  const quoted = text.match(/"([^"]+)"/g) || [];
  quoted.forEach((q) => {
    spec.phrases.push(q.replace(/"/g, "").trim());
    consume(q);
  });

  // 2. explicit field:value syntax, for people who like it
  const fielded = text.match(/\b(type|batch|branch|department|from|by):("[^"]+"|\S+)/gi) || [];
  fielded.forEach((f) => {
    const [, key, valueRaw] = f.match(/\b(type|batch|branch|department|from|by):("[^"]+"|\S+)/i);
    const value = valueRaw.replace(/"/g, "");
    const k = key.toLowerCase();
    if (k === "type") spec.filters.fileTypes = TYPE_WORDS[value.toLowerCase()] || [value.toLowerCase()];
    else if (k === "batch") spec.filters.batch = value;
    else if (k === "branch") spec.filters.branch = value;
    else if (k === "department") spec.filters.department = value;
    else spec.filters.uploaderUsername = value;
    consume(f);
  });

  // 3. dates
  const dates = parseDates(text, now);
  if (dates) {
    spec.filters.dateFrom = dates.dateFrom;
    spec.filters.dateTo = dates.dateTo;
    consume(dates.consumed);
  }

  const vocab = await getVocabulary();

  // 4. "from <person>" / "by <person>", then bare names
  if (!spec.filters.uploaderUsername) {
    // usernames in this system look like "kwame-osei-head-office" or
    // "admin@global", so @ must be part of the captured token; without it the
    // tail of the name is left behind and misread as a branch.
    const byPhrase = text.match(/\b(?:from|by|uploaded by)\s+([a-z0-9.@\-_]+(?:\s+[a-z]+)?)/i);
    const candidates = vocab.users.flatMap((u) => [u.username, u.fullname].filter(Boolean));
    const hit = matchNamedEntity(byPhrase ? byPhrase[1] : text, candidates);
    if (hit) {
      const person = vocab.users.find(
        (u) => u.username.toLowerCase() === hit.name.toLowerCase() ||
               u.fullname.toLowerCase() === hit.name.toLowerCase()
      );
      if (person) {
        spec.filters.uploaderUserId = person.id;
        spec.filters.uploaderUsername = person.username;
        consume(hit.name);
        if (byPhrase) consume(byPhrase[0].replace(hit.name, "").trim());
      }
    }
  }

  // 5. branch and department, from the live vocabulary
  if (!spec.filters.branch) {
    const hit = matchNamedEntity(text, vocab.branches.map((b) => b.name));
    if (hit) { spec.filters.branch = hit.name; consume(hit.consumed); }
  }
  if (!spec.filters.department) {
    const hit = matchNamedEntity(text, vocab.departments.map((d) => d.name));
    if (hit) { spec.filters.department = hit.name; consume(hit.consumed); }
  }

  // 6. file type words
  if (!spec.filters.fileTypes) {
    for (const [word, exts] of Object.entries(TYPE_WORDS)) {
      const re = new RegExp(`\\b${word}s?\\b`, "i");
      if (re.test(text)) {
        spec.filters.fileTypes = exts;
        consume(text.match(re)[0]);
        break;
      }
    }
  }

  // 7. whatever survives becomes search terms
  spec.unparsed = text.replace(/\s+/g, " ").trim();
  spec.terms = spec.unparsed
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/i)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));

  return spec;
}

module.exports = { parseQuery, parseDates, STOPWORDS };
