const fs = require("fs");
const path = require("path");

/**
 * Optical character recognition, offline.
 *
 * This is the reader that makes the bulk of the archive findable: most of what
 * staff upload is a photograph or a scan of a paper voucher, which has no text
 * in it at all until something looks at the pixels.
 *
 * Everything runs on this machine. tesseract.js is WASM, the language data is
 * vendored into the repository, and nothing is fetched at runtime - which is
 * the whole point, because the client's server has no internet and the
 * documents must never leave the premises regardless.
 */

// Vendored so an air-gapped install works. tesseract.js would otherwise pull
// this from a CDN the first time it ran, and fail silently forever.
const TESSDATA_DIR = path.join(__dirname, "..", "..", "..", "vendor", "tessdata");
const LANG = "eng";

// Two workers lets the pages of one multi-page document be read in parallel
// while still leaving the machine usable. Tunable for a smaller server.
const WORKER_COUNT = Math.max(1, parseInt(process.env.OCR_WORKERS, 10) || 2);

let scheduler = null;
let starting = null;

/**
 * Whether OCR can run at all.
 *
 * Checked before use rather than discovered by crashing: a deployment missing
 * its language data should log one clear line and carry on indexing PDFs, not
 * restart-loop the worker.
 */
function isAvailable() {
  const gz = path.join(TESSDATA_DIR, `${LANG}.traineddata.gz`);
  const raw = path.join(TESSDATA_DIR, `${LANG}.traineddata`);
  return fs.existsSync(gz) || fs.existsSync(raw);
}

function unavailableReason() {
  if (isAvailable()) return null;
  return `OCR language data not found in ${TESSDATA_DIR}. Expected ${LANG}.traineddata.gz. ` +
    "Images will be indexed by name and date only until this is restored.";
}

/**
 * Builds the worker pool once and keeps it.
 *
 * Starting a tesseract worker costs seconds - it has to load and initialise
 * ~23MB of language model. Doing that per file would make the backfill take
 * days, so the pool is long-lived and shared.
 */
async function getScheduler() {
  if (scheduler) return scheduler;
  if (starting) return starting;

  starting = (async () => {
    const { createScheduler, createWorker } = require("tesseract.js");
    const sched = createScheduler();

    for (let i = 0; i < WORKER_COUNT; i++) {
      const worker = await createWorker(LANG, 1, {
        langPath: TESSDATA_DIR,
        // Cache the decompressed model next to the data itself, so the cost of
        // unpacking 23MB is paid once ever rather than once per restart.
        cachePath: TESSDATA_DIR,
        gzip: true,
        // tesseract is extremely chatty about progress; the indexer logs what
        // matters at the job level instead.
        logger: () => {},
        errorHandler: (err) => console.error("[SearchIndex] ocr worker:", err),
      });
      sched.addWorker(worker);
    }

    scheduler = sched;
    starting = null;
    console.log(`[SearchIndex] OCR ready (${WORKER_COUNT} worker(s), offline)`);
    return sched;
  })();

  return starting;
}

/**
 * Reads one image.
 *
 * @param {Buffer} buffer
 * @returns {Promise<{pages: Array<{page:number, content:string}>, confidence: number|null}>}
 */
async function extractImageText(buffer) {
  const sched = await getScheduler();
  const { data } = await sched.addJob("recognize", buffer);

  const text = String(data.text || "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    // An image is one page by definition.
    pages: text ? [{ page: 1, content: text }] : [],
    // Mean confidence, kept so a badly scanned document can be shown as such
    // rather than just appearing to contain nothing.
    confidence: typeof data.confidence === "number" ? data.confidence : null,
  };
}

/** Shuts the pool down. Called when the worker process is stopping. */
async function shutdownOcr() {
  if (!scheduler) return;
  const sched = scheduler;
  scheduler = null;
  try {
    await sched.terminate();
  } catch (err) {
    console.error("[SearchIndex] ocr shutdown:", err.message);
  }
}

module.exports = {
  extractImageText,
  isAvailable,
  unavailableReason,
  shutdownOcr,
  TESSDATA_DIR,
  WORKER_COUNT,
};
