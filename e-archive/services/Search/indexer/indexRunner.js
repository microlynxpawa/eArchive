const os = require("os");
const { getProvider } = require("../../../storage/storageProvider");
const { toCloudKey } = require("../../../util/directory");
const { extractText } = require("../extract");
const { claimNext, completeJob, failJob, reclaimStale } = require("./queue.service");

/**
 * The worker loop.
 *
 * Self-scheduling rather than an interval: the next poll is only booked once
 * the current one has finished, so a slow job can never cause overlapping runs
 * to pile up on top of each other.
 */

// Nothing waiting - wait this long before asking again.
const IDLE_POLL_MS = 15000;
// Work in hand - come straight back. This runs in its own process, so there is
// no API event loop to protect and the delay only needs to be long enough to
// yield between jobs. It is a throughput ceiling: at 250ms a 50,000 file
// backfill would spend three hours doing nothing but waiting.
const BUSY_POLL_MS = 20;
const RECLAIM_EVERY_MS = 5 * 60 * 1000;

const WORKER_ID = `${os.hostname()}:${process.pid}`.slice(0, 64);

let timer = null;
let running = false;
let paused = false;
let lastReclaim = 0;

/**
 * Indexing is paused around the nightly backup so the two do not compete for
 * disk. Exported so the backup scheduler can call it directly.
 */
function pause() {
  paused = true;
}

function resume() {
  paused = false;
}

function isPaused() {
  return paused;
}

/** Reads the file's bytes back from storage - local disk or S3, unchanged. */
async function loadBytes(file) {
  const provider = await getProvider();
  const cloudKey = toCloudKey(file.filePath) + file.fileName;
  const exists = await provider.exists(cloudKey);
  if (!exists) {
    const err = new Error(`file missing from storage: ${cloudKey}`);
    err.missing = true;
    throw err;
  }
  return provider.download(cloudKey);
}

/**
 * Processes at most one job.
 * @returns {Promise<boolean>} whether there was work to do
 */
async function runOnce() {
  const job = await claimNext(WORKER_ID);
  if (!job) return false;

  const { state, file } = job;

  // The file row is gone but its state row survived - nothing to index. The FK
  // is ON DELETE CASCADE so this should not happen, but a job that cannot be
  // completed must still be closed out rather than retried forever.
  if (!file) {
    await state.update({ status: "skipped", engine: "none", charCount: 0, lastError: "file row missing" });
    return true;
  }

  try {
    const buffer = await loadBytes(file);
    const result = await extractText(buffer, file.fileName);
    await completeJob(state, result);
  } catch (err) {
    if (err.missing) {
      // The bytes are not there. Retrying cannot help.
      await state.update({
        status: "skipped",
        engine: "none",
        charCount: 0,
        lastError: err.message,
        lockedBy: null,
        lockedAt: null,
        nextAttemptAt: null,
      });
      return true;
    }
    console.error(`[SearchIndex] ${file.fileName}: ${err.message}`);
    await failJob(state, err);
  }
  return true;
}

async function tick() {
  if (paused) return schedule(IDLE_POLL_MS);

  let didWork = false;
  try {
    if (Date.now() - lastReclaim > RECLAIM_EVERY_MS) {
      lastReclaim = Date.now();
      const reclaimed = await reclaimStale();
      if (reclaimed > 0) console.log(`[SearchIndex] reclaimed ${reclaimed} stale job(s)`);
    }
    didWork = await runOnce();
  } catch (err) {
    // A failure here is the queue itself misbehaving, not one bad file. Back
    // off to the idle interval rather than spinning against a dead database.
    console.error("[SearchIndex] worker error:", err.message);
    return schedule(IDLE_POLL_MS);
  }

  schedule(didWork ? BUSY_POLL_MS : IDLE_POLL_MS);
}

function schedule(delay) {
  if (!running) return;
  timer = setTimeout(tick, delay);
  // Never hold the process open just to poll an empty queue.
  if (timer.unref) timer.unref();
}

function startIndexer() {
  if (running) return;
  running = true;
  console.log(`[SearchIndex] worker started (${WORKER_ID})`);
  schedule(BUSY_POLL_MS);
}

function stopIndexer() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
}

module.exports = { startIndexer, stopIndexer, runOnce, pause, resume, isPaused, WORKER_ID };
