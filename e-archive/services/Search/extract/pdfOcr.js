const path = require("path");
const { extractImageText, isAvailable } = require("./ocr");

/**
 * OCR for PDFs that are pictures of paper.
 *
 * A scanner that produces PDFs rather than JPEGs gives a file with no text
 * layer at all, so pdfText finds nothing in it. The fix is to draw each page
 * and read the drawing, which puts it on exactly the same footing as a
 * photographed receipt.
 *
 * Rendering uses @napi-rs/canvas, which ships prebuilt Windows binaries. The
 * `canvas` package would need node-gyp and Visual Studio, which the client's
 * server does not have and should not need.
 */

// 200 DPI relative to the PDF's own 72 DPI user space. Enough for tesseract to
// read a scanned voucher; going higher costs render time and memory for very
// little accuracy on documents that were scanned at 200-300 DPI anyway.
const RENDER_SCALE = 200 / 72;

// OCR is slow, and a long document is nearly always a batch scan whose first
// pages identify it. Reading every page of a 200 page PDF would block the
// queue for an hour to make the last page findable.
const MAX_OCR_PAGES = 20;

// Where pdfjs finds the substitutes for the fonts a PDF assumes every reader
// already has (Helvetica, Times, Courier). Without these it renders those runs
// as nothing at all, and a page that OCRs blank looks exactly like a page with
// no text on it. They ship inside pdfjs-dist, so this stays offline.
const STANDARD_FONTS = path.join(
  path.dirname(require.resolve("pdfjs-dist/package.json")),
  "standard_fonts"
) + path.sep;

let canvasLib = null;
function getCanvas() {
  if (!canvasLib) canvasLib = require("@napi-rs/canvas");
  return canvasLib;
}

/**
 * pdfjs asks its host for canvases. In a browser that is the DOM; here it is
 * this.
 */
function makeCanvasFactory() {
  const { createCanvas } = getCanvas();
  return {
    create(width, height) {
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height));
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(holder, width, height) {
      holder.canvas.width = Math.ceil(width);
      holder.canvas.height = Math.ceil(height);
    },
    destroy(holder) {
      // Release the bitmap promptly: at 200 DPI an A4 page is ~1650x2340
      // pixels, and holding a few of those is tens of megabytes.
      holder.canvas.width = 0;
      holder.canvas.height = 0;
      holder.canvas = null;
      holder.context = null;
    },
  };
}

function getPdfjs() {
  const { DOMMatrix, Path2D, ImageData } = getCanvas();
  // pdfjs reaches for these as globals while rendering. It looks for them in
  // the `canvas` package and warns that "rendering may be broken" when it is
  // absent - but we supply them from @napi-rs/canvas instead, so rendering is
  // fine and the warning is wrong. pdfText's loader swallows it.
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
  if (!globalThis.Path2D) globalThis.Path2D = Path2D;
  if (!globalThis.ImageData) globalThis.ImageData = ImageData;
  return require("./pdfText").getPdfjs();
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{pages: Array<{page:number, content:string}>, pageCount:number, confidence:number|null}>}
 */
async function extractPdfOcr(buffer) {
  if (!isAvailable()) return { pages: [], pageCount: 0, confidence: null };

  const { getDocument } = getPdfjs();
  const canvasFactory = makeCanvasFactory();

  const doc = await getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
    canvasFactory,
    standardFontDataUrl: STANDARD_FONTS,
    // Draw glyphs as paths rather than registering real font faces: there is
    // no document to register them with here, and paths are what we want to
    // photograph anyway.
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const pages = [];
  const confidences = [];

  try {
    const limit = Math.min(doc.numPages, MAX_OCR_PAGES);
    for (let n = 1; n <= limit; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: RENDER_SCALE });
      const holder = canvasFactory.create(viewport.width, viewport.height);

      try {
        // Scanned pages are transparent where nothing was drawn, and
        // tesseract reads dark-on-transparent very badly. Paint white first.
        holder.context.fillStyle = "#ffffff";
        holder.context.fillRect(0, 0, holder.canvas.width, holder.canvas.height);

        await page.render({
          canvasContext: holder.context,
          viewport,
          canvasFactory,
        }).promise;

        const png = holder.canvas.toBuffer("image/png");
        const result = await extractImageText(png);
        if (result.pages.length > 0) {
          pages.push({ page: n, content: result.pages[0].content });
          if (typeof result.confidence === "number") confidences.push(result.confidence);
        }
      } finally {
        canvasFactory.destroy(holder);
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy();
  }

  return {
    pages,
    pageCount: doc.numPages,
    confidence: confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : null,
  };
}

module.exports = { extractPdfOcr, RENDER_SCALE, MAX_OCR_PAGES };
