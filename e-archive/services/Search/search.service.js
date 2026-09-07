const { Op } = require("sequelize");
const sequelize = require("../../dbConnect");
const File = require("../../model/file");
const User = require("../../model/user");
const FileTextChunk = require("../../model/fileTextChunk");
const { getFileScope, toRelativePath, branchOfPath } = require("../Display/fileScope");
const { parseQuery } = require("./query/rulesParser");
const { parseWithLlm } = require("./query/llmParser");
const { buildSnippets } = require("./snippet");

/**
 * File search.
 *
 * Two passes, merged: filenames, and the text the indexer extracted from
 * inside the documents. A file can match on either or both, and matching on
 * both ranks it higher than matching on one.
 *
 * Visibility comes from getFileScope, the same source the folder tree uses, so
 * search can never return a file the user could not already open. That applies
 * to the content pass too - a phrase inside a document must not reveal a file
 * whose name the user is not allowed to see.
 */

const MAX_CANDIDATES = 500;

/** "name@batch.ext" -> "batch" */
function batchOf(fileName) {
  const at = fileName.indexOf("@");
  if (at === -1) return null;
  const dot = fileName.lastIndexOf(".");
  return dot === -1 || dot < at ? fileName.slice(at + 1) : fileName.slice(at + 1, dot);
}

/** Display form: drops the batch suffix, keeps the extension. */
function displayName(fileName) {
  const at = fileName.indexOf("@");
  if (at === -1) return fileName;
  const dot = fileName.lastIndexOf(".");
  return dot === -1 || dot < at ? fileName.slice(0, at) : fileName.slice(0, at) + fileName.slice(dot);
}

function extensionOf(fileName) {
  const i = fileName.lastIndexOf(".");
  return i === -1 ? "" : fileName.slice(i + 1).toLowerCase();
}

/**
 * How well a filename answers the query. Deliberately favours whole-word and
 * prefix hits: staff usually remember the start of a name, not a fragment from
 * the middle.
 */
function scoreFilename(fileName, terms, phrases) {
  if (terms.length === 0 && phrases.length === 0) return 0;

  const haystack = displayName(fileName).toLowerCase();
  const bare = haystack.replace(/\.[^.]+$/, "");
  let best = 0;
  let matched = 0;

  for (const phrase of phrases) {
    if (haystack.includes(phrase.toLowerCase())) { matched += 1; best = Math.max(best, 4); }
  }

  for (const term of terms) {
    const t = term.toLowerCase();
    let s = 0;
    if (bare === t) s = 4;
    else if (bare.startsWith(t)) s = 3;
    else if (new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(haystack)) s = 2;
    else if (haystack.includes(t)) s = 1;
    if (s > 0) matched += 1;
    best = Math.max(best, s);
  }

  const total = terms.length + phrases.length;
  if (matched === 0) return 0;
  // every term matching beats one term matching strongly
  return best * (matched / total);
}

/** Newer files score slightly higher, decaying over roughly six months. */
function recencyBoost(createdAt) {
  if (!createdAt) return 0;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (days < 0) return 1;
  return Math.max(0, 1 - days / 180);
}

/** Turns parsed filters into a Sequelize clause over the Files table. */
function filtersToWhere(filters, vocabUserId) {
  const where = {};

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt[Op.gte] = filters.dateFrom;
    if (filters.dateTo) where.createdAt[Op.lte] = filters.dateTo;
  }
  if (vocabUserId) where.userId = vocabUserId;
  if (filters.department) where.department = filters.department;
  if (filters.branch) where.ranchName = filters.branch; // column is misspelled in the schema
  if (filters.batch) where.fileName = { [Op.like]: `%@${filters.batch}%` };

  if (filters.fileTypes && filters.fileTypes.length > 0) {
    const byType = filters.fileTypes.map((ext) => ({ fileName: { [Op.like]: `%.${ext}` } }));
    where[Op.and] = [...(where[Op.and] || []), { [Op.or]: byType }];
  }

  return where;
}

/**
 * The FULLTEXT expression for a parsed query.
 *
 * Boolean mode, and deliberately without a leading "+" on each term: requiring
 * every word would mean a three-word query found nothing unless all three
 * appeared, which is not how people half-remember a document. Terms are
 * therefore optional and MySQL ranks a document that contains more of them
 * higher, which is exactly the behaviour wanted.
 */
function booleanExpression(terms, phrases) {
  const parts = [];
  for (const phrase of phrases) {
    // Double quotes are the phrase operator, so a quote inside the phrase
    // would end it early and change the query's meaning.
    parts.push(`"${phrase.replace(/"/g, " ")}"`);
  }
  for (const term of terms) {
    // Strip the boolean operators themselves. A user typing "invoice -march"
    // means two words, not an exclusion, and an unbalanced ( would be a syntax
    // error rather than a search.
    const clean = term.replace(/[+\-><()~*"@]/g, " ").trim();
    // InnoDB ignores tokens below innodb_ft_min_token_size (3 by default), so
    // shorter ones are dropped here rather than silently matching nothing.
    if (clean.length >= 3) parts.push(clean);
  }
  return parts.join(" ");
}

/**
 * Files whose *contents* match, best first.
 * @returns {Promise<Map<number, number>>} fileId -> raw relevance
 */
async function searchContent(terms, phrases, limit) {
  const expression = booleanExpression(terms, phrases);
  if (!expression) return new Map();

  // Grouped by file: a phrase appearing on four pages of one document is one
  // result, ranked above a document that mentions it once.
  const [rows] = await sequelize.query(
    `SELECT fileId, SUM(MATCH(content) AGAINST(:expr IN BOOLEAN MODE)) AS relevance
       FROM file_text_chunks
      WHERE MATCH(content) AGAINST(:expr IN BOOLEAN MODE)
      GROUP BY fileId
      ORDER BY relevance DESC
      LIMIT :limit`,
    { replacements: { expr: expression, limit } }
  );

  return new Map(rows.map((r) => [Number(r.fileId), Number(r.relevance)]));
}

/**
 * Reads the typed phrase into a QuerySpec.
 *
 * The language model is tried first when it is switched on, because it handles
 * word order and phrasing the rules cannot. It is not trusted with the outcome
 * though: it returns null on any failure, and the deterministic parser is both
 * the fallback and the default. Search works with no model, no key and no
 * network - it just understands slightly less.
 */
async function interpret(q) {
  const viaLlm = await parseWithLlm(q);
  if (viaLlm) return viaLlm;
  return parseQuery(q);
}

/**
 * @returns {{ query, results, total, page, limit, scope }}
 */
async function searchFiles({ userId, q = "", page = 1, limit = 20, overrides = {} }) {
  const scope = await getFileScope(userId);

  const spec = await interpret(q);
  // Explicit UI filters win over anything inferred from the phrase.
  Object.assign(spec.filters, overrides);

  const filterWhere = filtersToWhere(spec.filters, spec.filters.uploaderUserId);

  const where = { ...scope.where };
  // merge, preserving both sides' Op.and entries
  for (const key of Reflect.ownKeys(filterWhere)) {
    if (key === Op.and) where[Op.and] = [...(where[Op.and] || []), ...filterWhere[Op.and]];
    else where[key] = filterWhere[key];
  }

  const hasTextQuery = spec.terms.length > 0 || spec.phrases.length > 0;

  // Nothing to rank: this is "browse with filters". Page in SQL so the total is
  // exact and paging is not capped by how much we were willing to hold in memory.
  if (!hasTextQuery) {
    const { rows, count } = await File.findAndCountAll({
      where,
      include: [{ model: User, attributes: ["id", "username", "fullname"] }],
      order: [["createdAt", "DESC"]],
      offset: (page - 1) * limit,
      limit,
    });
    return {
      query: { raw: q, interpreted: { terms: [], phrases: [], filters: spec.filters, source: spec.source } },
      scope: scope.tier,
      total: count,
      page,
      limit,
      truncated: false,
      results: rows.filter(scope.matches).map((file) => present(file, 0, ["filters"])),
    };
  }

  // Pass one: names, matched in SQL first so we do not pull the whole archive
  // back to score it in memory.
  const nameLikes = [...spec.terms, ...spec.phrases].map((t) => ({
    fileName: { [Op.like]: `%${t}%` },
  }));

  const nameWhere = { ...where };
  nameWhere[Op.and] = [...(where[Op.and] || []), { [Op.or]: nameLikes }];

  const nameCandidates = await File.findAll({
    where: nameWhere,
    include: [{ model: User, attributes: ["id", "username", "fullname"] }],
    order: [["createdAt", "DESC"]],
    limit: MAX_CANDIDATES,
  });

  // Pass two: contents. The FULLTEXT index answers "which files contain this",
  // and the ids come back through the same permission filter as everything
  // else - the index itself knows nothing about who may see what.
  const contentHits = await searchContent(spec.terms, spec.phrases, MAX_CANDIDATES);

  const byId = new Map(nameCandidates.map((f) => [f.id, f]));
  const missingIds = [...contentHits.keys()].filter((id) => !byId.has(id));

  if (missingIds.length > 0) {
    const contentFiles = await File.findAll({
      where: { ...where, id: { [Op.in]: missingIds } },
      include: [{ model: User, attributes: ["id", "username", "fullname"] }],
    });
    for (const file of contentFiles) byId.set(file.id, file);
  }

  // Relevance is only comparable within one query, so it is normalised against
  // the best hit rather than used raw.
  const topRelevance = Math.max(1e-9, ...contentHits.values());

  const scored = [];
  for (const file of byId.values()) {
    // The tree applies a branch check in JS for department-scoped users; the
    // same check has to run here or search would be broader than the tree.
    if (!scope.matches(file)) continue;

    const nameScore = scoreFilename(file.fileName, spec.terms, spec.phrases);
    const relevance = contentHits.get(file.id) || 0;
    const contentScore = relevance > 0 ? Math.min(1, relevance / topRelevance) : 0;
    if (nameScore === 0 && contentScore === 0) continue;

    const matchedOn = [];
    if (nameScore > 0) matchedOn.push("filename");
    if (contentScore > 0) matchedOn.push("content");

    scored.push({
      file,
      // A name match still outranks a content match of equal strength: if the
      // name says "invoice", the file is far more likely to be the one wanted
      // than a file that merely mentions the word somewhere inside.
      score: 1.5 * (nameScore / 4) + 1.0 * contentScore + 0.2 * recencyBoost(file.createdAt),
      matchedOn,
    });
  }

  scored.sort((a, b) => b.score - a.score || new Date(b.file.createdAt) - new Date(a.file.createdAt));

  const start = (page - 1) * limit;
  const pageItems = scored.slice(start, start + limit);

  // Snippets are built only for the page actually being shown. Fetching the
  // text of every match would mean reading megabytes to display twenty rows.
  const snippetsByFile = await loadSnippets(
    pageItems.filter((i) => i.matchedOn.includes("content")).map((i) => i.file.id),
    [...spec.phrases, ...spec.terms]
  );

  return {
    query: {
      raw: q,
      interpreted: {
        terms: spec.terms,
        phrases: spec.phrases,
        filters: spec.filters,
        source: spec.source,
      },
    },
    scope: scope.tier,
    total: scored.length,
    page,
    limit,
    // The archive matched more than we were willing to rank at once, so
    // `total` is the best N rather than every match. The UI says so.
    truncated: nameCandidates.length >= MAX_CANDIDATES || contentHits.size >= MAX_CANDIDATES,
    results: pageItems.map(({ file, score, matchedOn }) =>
      present(file, score, matchedOn, snippetsByFile.get(file.id) || [])
    ),
  };
}

/** Extracted text for the given files, turned into display snippets. */
async function loadSnippets(fileIds, needles) {
  const out = new Map();
  if (fileIds.length === 0) return out;

  const chunks = await FileTextChunk.findAll({
    where: { fileId: { [Op.in]: fileIds } },
    attributes: ["fileId", "page", "content"],
    order: [["fileId", "ASC"], ["page", "ASC"]],
    raw: true,
  });

  const byFile = new Map();
  for (const chunk of chunks) {
    if (!byFile.has(chunk.fileId)) byFile.set(chunk.fileId, []);
    byFile.get(chunk.fileId).push(chunk);
  }

  for (const [fileId, fileChunks] of byFile) {
    out.set(fileId, buildSnippets(fileChunks, needles));
  }
  return out;
}

/** Shapes one File row for the API. */
function present(file, score, matchedOn, snippets = []) {
  const relPath = toRelativePath(file.filePath);
  return {
    fileId: file.id,
    fileName: file.fileName,
    displayName: displayName(file.fileName),
    batch: batchOf(file.fileName),
    filePath: relPath,
    pathSegments: relPath.split("/").filter(Boolean),
    branch: file.ranchName || branchOfPath(file.filePath),
    department: file.department,
    extension: extensionOf(file.fileName),
    uploader: file.user
      ? { id: file.user.id, username: file.user.username, fullname: file.user.fullname }
      : null,
    createdAt: file.createdAt,
    matchedOn,
    snippets,
    score: Number(Number(score).toFixed(3)),
  };
}

module.exports = { searchFiles, displayName, batchOf, booleanExpression, interpret };
