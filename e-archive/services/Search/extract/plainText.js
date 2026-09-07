/**
 * Text files. Split into pages only so they share the storage shape every
 * other reader produces - there are no real pages in a .txt.
 */

// Roughly a page of prose. Keeps one chunk comfortably inside MEDIUMTEXT and
// keeps a snippet's page number meaningful rather than always 1.
const CHARS_PER_PAGE = 4000;

/**
 * @param {Buffer} buffer
 * @returns {{ pages: Array<{page:number, content:string}>, pageCount:number }}
 */
function extractPlainText(buffer) {
  // Strip a UTF-8 BOM, which would otherwise become a stray character at the
  // very front of the indexed text.
  let text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  text = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (!text) return { pages: [], pageCount: 0 };

  const pages = [];
  for (let i = 0; i < text.length; i += CHARS_PER_PAGE) {
    pages.push({ page: pages.length + 1, content: text.slice(i, i + CHARS_PER_PAGE) });
  }
  return { pages, pageCount: pages.length };
}

module.exports = { extractPlainText, CHARS_PER_PAGE };
