const { Op } = require("sequelize");
const File = require("../../model/file");
const User = require("../../model/user");
const { getFileScope, toRelativePath, branchOfPath } = require("../Display/fileScope");
const { parseQuery } = require("./query/rulesParser");

/**
 * File search.
 *
 * Phase 0: filename, date, uploader, department, branch and type. No file
 * contents yet - that arrives with the indexer, and this module is written so
 * the content pass slots in beside the filename pass without disturbing it.
 *
 * Visibility comes from getFileScope, the same source the folder tree uses, so
 * search can never return a file the user could not already open.
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
 * @returns {{ query, results, total, page, limit, scope }}
 */
async function searchFiles({ userId, q = "", page = 1, limit = 20, overrides = {} }) {
  const scope = await getFileScope(userId);

  const spec = await parseQuery(q);
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

  // Name terms are matched in SQL first so we do not pull the whole archive
  // back to score it in memory.
  const nameLikes = [...spec.terms, ...spec.phrases].map((t) => ({
    fileName: { [Op.like]: `%${t}%` },
  }));
  where[Op.and] = [...(where[Op.and] || []), { [Op.or]: nameLikes }];

  const candidates = await File.findAll({
    where,
    include: [{ model: User, attributes: ["id", "username", "fullname"] }],
    order: [["createdAt", "DESC"]],
    limit: MAX_CANDIDATES,
  });

  const scored = [];
  for (const file of candidates) {
    // The tree applies a branch check in JS for department-scoped users; the
    // same check has to run here or search would be broader than the tree.
    if (!scope.matches(file)) continue;

    const nameScore = scoreFilename(file.fileName, spec.terms, spec.phrases);
    if (nameScore === 0) continue;

    scored.push({
      file,
      score: 1.5 * (nameScore / 4) + 0.2 * recencyBoost(file.createdAt),
      matchedOn: ["filename"],
    });
  }

  scored.sort((a, b) => b.score - a.score || new Date(b.file.createdAt) - new Date(a.file.createdAt));

  const start = (page - 1) * limit;
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
    // The archive matched more names than we were willing to rank at once, so
    // `total` is the best N rather than every match. The UI says so.
    truncated: candidates.length >= MAX_CANDIDATES,
    results: scored.slice(start, start + limit)
      .map(({ file, score, matchedOn }) => present(file, score, matchedOn)),
  };
}

/** Shapes one File row for the API. */
function present(file, score, matchedOn) {
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
    score: Number(Number(score).toFixed(3)),
  };
}

module.exports = { searchFiles, displayName, batchOf };
