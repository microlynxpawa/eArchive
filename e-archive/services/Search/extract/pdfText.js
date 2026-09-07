/**
 * Text out of a digital PDF, one page at a time.
 *
 * "Digital" is the qualifier that matters: this reads the text layer a PDF
 * writer embedded. A PDF that is a photograph of a page has no text layer and
 * comes back empty, which is the signal to hand it to OCR instead.
 *
 * pdfjs-dist's legacy build is used deliberately - it is the CommonJS one, and
 * this codebase is CommonJS throughout.
 */

// Silence pdfjs's own console chatter about unsupported features; a
// slightly-off PDF is normal in a scanned archive and is not our problem.
const VERBOSITY_ERRORS = 0;

let pdfjs = null;
function getPdfjs() {
  if (pdfjs) return pdfjs;
  // On load, pdfjs looks for the native "canvas" module so it can polyfill
  // DOMMatrix and Path2D, and warns loudly when it is missing. Those are only
  // needed to *render* a page; extracting text does not touch them, and
  // "canvas" needs a compiler toolchain the server does not have. So the
  // two warnings are swallowed rather than repeated for every PDF indexed.
  const warn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("Cannot polyfill")) return;
    warn(...args);
  };
  try {
    pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
  } finally {
    console.warn = warn;
  }
  return pdfjs;
}

/** Collapses the run-of-glyphs shape pdfjs returns into readable text. */
function joinItems(items) {
  let out = "";
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    out += item.str;
    // pdfjs marks a line break with hasEOL rather than a newline in `str`.
    if (item.hasEOL) out += "\n";
    else if (!item.str.endsWith(" ")) out += " ";
  }
  return out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ pages: Array<{page:number, content:string}>, pageCount:number }>}
 */
async function extractPdfText(buffer) {
  const { getDocument } = getPdfjs();

  const task = getDocument({
    // pdfjs mutates the array it is handed, so give it a copy of the bytes
    // rather than a view onto the Buffer the caller still holds.
    data: new Uint8Array(buffer),
    verbosity: VERBOSITY_ERRORS,
    // No network in an air-gapped deployment, and no browser APIs in Node.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  });

  const doc = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      try {
        const content = await page.getTextContent();
        const text = joinItems(content.items);
        // Empty pages are dropped rather than stored: a row of nothing costs
        // index space and can never match.
        if (text) pages.push({ page: n, content: text });
      } finally {
        page.cleanup();
      }
    }
    return { pages, pageCount: doc.numPages };
  } finally {
    await doc.destroy();
  }
}

module.exports = { extractPdfText, getPdfjs };
