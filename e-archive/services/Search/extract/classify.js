const path = require("path");

/**
 * What kind of reader a file needs.
 *
 * Judged by extension, not by the MIME type recorded at upload: the archive
 * holds files uploaded over several years and some carry no usable MIME at
 * all, whereas the extension is part of the stored filename and always there.
 */

const PDF = new Set([".pdf"]);
const IMAGE = new Set([".jpg", ".jpeg", ".png", ".tif", ".tiff", ".bmp", ".webp"]);
const PLAIN = new Set([".txt", ".csv", ".md", ".log", ".json", ".xml"]);

/**
 * @returns {"pdf"|"image"|"plain"|"unsupported"}
 */
function classify(fileName) {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  if (PDF.has(ext)) return "pdf";
  if (IMAGE.has(ext)) return "image";
  if (PLAIN.has(ext)) return "plain";
  return "unsupported";
}

module.exports = { classify, PDF, IMAGE, PLAIN };
