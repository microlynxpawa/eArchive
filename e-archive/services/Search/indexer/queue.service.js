const { Op } = require("sequelize");
const sequelize = require("../../../dbConnect");
const File = require("../../../model/file");
const FileIndexState = require("../../../model/fileIndexState");
const FileTextChunk = require("../../../model/fileTextChunk");

/**
 * The indexing work queue, kept in MySQL.
 *
 * No Redis and no external broker: the queue is one row per file in
 * `file_index_state`, claimed with SELECT ... FOR UPDATE SKIP LOCKED (MySQL 8).
 * That is what makes it safe to run more than one worker, and what makes a
 * killed worker recoverable - its claim simply goes stale and is reclaimed.
 */

// Bump when the extraction logic changes in a way that makes stored text
// obsolete; the backfill can then re-enqueue anything indexed by an older one.
const INDEXER_VERSION = 1;

// A claim older than this is assumed to belong to a worker that died.
const STALE_LOCK_MS = 15 * 60 * 1000;

const MAX_ATTEMPTS = 3;

/** 1 min, 5 min, 25 min - long enough that a transient fault has passed. */
function backoffMs(attempts) {
  return Math.min(60000 * Math.pow(5, Math.max(0, attempts - 1)), 60 * 60 * 1000);
}

/**
 * Puts a file in the queue, or moves it to the front.
 *
 * Called from the upload path, so it must be cheap and must never throw in a
 * way that could fail the upload - the caller wraps it, and it is a single
 * upsert.
 */
async function enqueueForIndex(fileId, { priority = 0, force = false } = {}) {
  const existing = await FileIndexState.findOne({ where: { fileId } });

  if (!existing) {
    await FileIndexState.create({
      fileId,
      status: "pending",
      priority,
      nextAttemptAt: new Date(),
      indexerVersion: INDEXER_VERSION,
    });
    return "created";
  }

  // Already indexed and not being asked to redo it.
  if (!force && existing.status === "done") return "skipped";
  // Already waiting; just make sure it is not sitting behind a lower priority.
  if (existing.status === "pending" && !force) {
    if (priority > existing.priority) await existing.update({ priority });
    return "queued";
  }
  if (existing.status === "running" && !force) return "running";

  await existing.update({
    status: "pending",
    priority: Math.max(priority, existing.priority),
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(),
    lockedBy: null,
    lockedAt: null,
  });
  return "requeued";
}

/**
 * Takes one job and marks it running, atomically.
 *
 * The row is locked and flipped to `running` inside a transaction, so two
 * workers polling at the same instant cannot both take it: SKIP LOCKED makes
 * the loser move to the next row instead of blocking on this one.
 *
 * @returns {Promise<{state, file}|null>}
 */
async function claimNext(workerId) {
  return sequelize.transaction(async (t) => {
    const [rows] = await sequelize.query(
      `SELECT id FROM file_index_state
        WHERE status = 'pending'
          AND (nextAttemptAt IS NULL OR nextAttemptAt <= NOW())
        ORDER BY priority DESC, nextAttemptAt ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      { transaction: t }
    );
    if (rows.length === 0) return null;

    const state = await FileIndexState.findByPk(rows[0].id, { transaction: t });
    await state.update(
      {
        status: "running",
        lockedBy: workerId,
        lockedAt: new Date(),
        attempts: state.attempts + 1,
      },
      { transaction: t }
    );

    const file = await File.findByPk(state.fileId, { transaction: t });
    return { state, file };
  });
}

/**
 * Stores the extracted text and closes the job out.
 *
 * The delete-then-insert is in one transaction so a re-index never leaves a
 * file half old text and half new.
 */
async function completeJob(state, result) {
  await sequelize.transaction(async (t) => {
    await FileTextChunk.destroy({ where: { fileId: state.fileId }, transaction: t });

    if (result.pages.length > 0) {
      await FileTextChunk.bulkCreate(
        result.pages.map((p) => ({ fileId: state.fileId, page: p.page, content: p.content })),
        { transaction: t }
      );
    }

    await state.update(
      {
        // A file we simply cannot read is `skipped`, not `failed`: it is a
        // permanent, understood outcome and must never be retried.
        status: result.engine === "none" ? "skipped" : "done",
        engine: result.engine,
        pageCount: result.pageCount ?? null,
        charCount: result.charCount ?? 0,
        ocrConfidence: result.confidence ?? null,
        lastError: null,
        extractedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        nextAttemptAt: null,
        indexerVersion: INDEXER_VERSION,
      },
      { transaction: t }
    );
  });
}

/** Records a failure, and schedules a retry unless we are out of attempts. */
async function failJob(state, error) {
  const message = String(error && error.message ? error.message : error).slice(0, 2000);
  const exhausted = state.attempts >= MAX_ATTEMPTS;

  await state.update({
    status: exhausted ? "failed" : "pending",
    lastError: message,
    nextAttemptAt: exhausted ? null : new Date(Date.now() + backoffMs(state.attempts)),
    lockedBy: null,
    lockedAt: null,
  });
}

/**
 * Returns jobs abandoned by a dead worker to the queue.
 *
 * Without this a worker killed mid-job would leave its file `running` forever,
 * and that file would silently never become searchable.
 */
async function reclaimStale() {
  const cutoff = new Date(Date.now() - STALE_LOCK_MS);
  const [, affected] = await FileIndexState.update(
    { status: "pending", lockedBy: null, lockedAt: null, nextAttemptAt: new Date() },
    { where: { status: "running", lockedAt: { [Op.lt]: cutoff } } }
  );
  return affected || 0;
}

/** Counts by status, for the admin index-health view. */
async function getIndexStats() {
  const rows = await FileIndexState.findAll({
    attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
    group: ["status"],
    raw: true,
  });

  const byStatus = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0 };
  for (const row of rows) byStatus[row.status] = Number(row.count);

  const totalFiles = await File.count();
  const tracked = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    totalFiles,
    tracked,
    // Files with no row at all have never been enqueued; the backfill has not
    // reached them yet. Reported separately so coverage is not overstated.
    untracked: Math.max(0, totalFiles - tracked),
    byStatus,
    coverage: totalFiles === 0 ? 1 : (byStatus.done + byStatus.skipped) / totalFiles,
    indexerVersion: INDEXER_VERSION,
  };
}

module.exports = {
  enqueueForIndex,
  claimNext,
  completeJob,
  failJob,
  reclaimStale,
  getIndexStats,
  INDEXER_VERSION,
  MAX_ATTEMPTS,
  STALE_LOCK_MS,
  backoffMs,
};
