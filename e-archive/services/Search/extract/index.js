const { classify } = require("./classify");
const { extractPdfText } = require("./pdfText");
const { extractPlainText } = require("./plainText");

/**
 * Turns a file's bytes into pages of text, choosing the reader by file kind.
 *
 * The OCR readers are looked up lazily and are allowed to be absent. That is
 * what keeps the digital-PDF lane shippable on its own: with no OCR installed
 * an image indexes as `none` with no text rather than failing, and search
 * still finds it by name, date and uploader exactly as it does today.
 */

// A single extracted page is capped well below MEDIUMTEXT's 16MB. A page that
// long is a broken extraction, not a document, and storing it would bloat the
// FULLTEXT index for no gain.
const MAX_CHARS_PER_PAGE = 200000;
// Total per file, so one pathological document cannot fill the table.
const MAX_CHARS_PER_FILE = 2000000;

/**
 * The OCR lane, or null if it cannot run here.
 *
 * Two separate things can be missing: the packages, and the language data they
 * need. Either way the answer is the same - index what we can and say so once,
 * rather than failing every image in the archive one at a time.
 */
let ocrLane;
function getOcrLane() {
  if (ocrLane !== undefined) return ocrLane;
  try {
    const ocr = require("./ocr");
    if (!ocr.isAvailable()) {
      console.warn("[SearchIndex] " + ocr.unavailableReason());
      ocrLane = null;
      return ocrLane;
    }
    ocrLane = { ocr, pdfOcr: require("./pdfOcr") };
  } catch (err) {
    if (err.code === "MODULE_NOT_FOUND") {
      console.warn(
        "[SearchIndex] OCR packages not installed; images will be indexed by name and date only."
      );
      ocrLane = null;
    } else {
      throw err;
    }
  }
  return ocrLane;
}

function trim(pages) {
  const out = [];
  let total = 0;
  for (const page of pages) {
    if (total >= MAX_CHARS_PER_FILE) break;
    const room = Math.min(MAX_CHARS_PER_PAGE, MAX_CHARS_PER_FILE - total);
    const content = page.content.slice(0, room);
    if (!content) continue;
    out.push({ page: page.page, content });
    total += content.length;
  }
  return { pages: out, charCount: total };
}

/**
 * @param {Buffer} buffer raw file bytes
 * @param {string} fileName used only to decide the file kind
 * @returns {Promise<{engine:string, pages:Array, pageCount:number, charCount:number, confidence:number|null}>}
 */
async function extractText(buffer, fileName) {
  const kind = classify(fileName);

  if (kind === "plain") {
    const { pages, pageCount } = extractPlainText(buffer);
    const trimmed = trim(pages);
    return { engine: "plain-text", pages: trimmed.pages, pageCount, charCount: trimmed.charCount, confidence: null };
  }

  if (kind === "pdf") {
    const { pages, pageCount } = await extractPdfText(buffer);
    const trimmed = trim(pages);

    // A PDF with a text layer is done here. One without is a photograph of a
    // page, so it goes down the same road as an image.
    if (trimmed.charCount > 0) {
      return { engine: "pdf-text", pages: trimmed.pages, pageCount, charCount: trimmed.charCount, confidence: null };
    }

    const lane = getOcrLane();
    if (!lane) {
      return { engine: "none", pages: [], pageCount, charCount: 0, confidence: null };
    }
    const result = await lane.pdfOcr.extractPdfOcr(buffer);
    const t = trim(result.pages);
    return { engine: "ocr", pages: t.pages, pageCount: result.pageCount ?? pageCount, charCount: t.charCount, confidence: result.confidence ?? null };
  }

  if (kind === "image") {
    const lane = getOcrLane();
    if (!lane) {
      return { engine: "none", pages: [], pageCount: 1, charCount: 0, confidence: null };
    }
    const result = await lane.ocr.extractImageText(buffer);
    const t = trim(result.pages);
    return { engine: "ocr", pages: t.pages, pageCount: 1, charCount: t.charCount, confidence: result.confidence ?? null };
  }

  // Nothing can read it. Terminal, not an error: the file is still findable by
  // name, date and uploader.
  return { engine: "none", pages: [], pageCount: 0, charCount: 0, confidence: null };
}

module.exports = { extractText, MAX_CHARS_PER_PAGE, MAX_CHARS_PER_FILE };
