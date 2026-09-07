/**
 * Builds the "...matched here..." line under a search result.
 *
 * Returns text plus match offsets, never HTML. The API must not decide how a
 * match is styled, and text assembled into markup here would be an injection
 * hole the moment a document contained a tag - which, in a corpus of OCR'd
 * scans, it eventually will.
 */

const SNIPPET_CHARS = 240;
const MAX_SNIPPETS = 3;

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Every offset in `content` where any term or phrase appears. */
function findMatches(content, needles) {
  const found = [];
  for (const needle of needles) {
    if (!needle) continue;
    // Word-ish boundary at the start: "voucher" should not light up inside
    // "vouchers" only by accident of substring position.
    const re = new RegExp(`(^|\\W)(${escapeRegex(needle)})`, "gi");
    let m;
    while ((m = re.exec(content)) !== null) {
      found.push({ start: m.index + m[1].length, length: m[2].length });
      if (found.length > 200) return found; // enough to pick a window from
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Nudges a cut to the nearest space so a snippet does not start mid-word. */
function softBoundary(content, index, direction) {
  const limit = direction < 0 ? Math.max(0, index - 25) : Math.min(content.length, index + 25);
  if (direction < 0) {
    for (let i = index; i > limit; i--) if (/\s/.test(content[i])) return i + 1;
  } else {
    for (let i = index; i < limit; i++) if (/\s/.test(content[i])) return i;
  }
  return index;
}

/**
 * @param {Array<{page:number, content:string}>} chunks
 * @param {string[]} needles terms and phrases to highlight
 * @returns {Array<{page:number, text:string, matches:Array<{start:number,length:number}>}>}
 */
function buildSnippets(chunks, needles) {
  const snippets = [];

  for (const chunk of chunks) {
    if (snippets.length >= MAX_SNIPPETS) break;

    const matches = findMatches(chunk.content, needles);
    if (matches.length === 0) continue;

    // Centre the window on the first match on this page, with a little more
    // text after it than before: what follows a matched word is usually the
    // part that tells the reader whether this is the right document.
    const first = matches[0];
    const start = softBoundary(chunk.content, Math.max(0, first.start - SNIPPET_CHARS / 3), -1);
    const end = softBoundary(chunk.content, Math.min(chunk.content.length, start + SNIPPET_CHARS), 1);

    const text = chunk.content.slice(start, end);
    const local = matches
      .filter((m) => m.start >= start && m.start + m.length <= end)
      .map((m) => ({ start: m.start - start, length: m.length }));

    const leading = start > 0 ? "…" : "";
    snippets.push({
      page: chunk.page,
      text: leading + text + (end < chunk.content.length ? "…" : ""),
      // Offsets shift by one when a leading ellipsis is prepended.
      matches: leading ? local.map((m) => ({ start: m.start + 1, length: m.length })) : local,
    });
  }

  return snippets;
}

module.exports = { buildSnippets, findMatches, SNIPPET_CHARS, MAX_SNIPPETS };
