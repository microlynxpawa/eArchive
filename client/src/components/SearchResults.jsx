import React, { useCallback, useEffect, useState } from 'react'

/*
 * Search results.
 *
 * Shows what the server understood from the phrase as removable chips, then the
 * matching files. The chips matter: they turn a rule-based parser from something
 * that silently guesses into something the user can see and correct.
 */

const TYPE_LABEL = {
  pdf: 'PDF',
  jpg: 'Images', jpeg: 'Images', png: 'Images',
  xlsx: 'Spreadsheets', xls: 'Spreadsheets', csv: 'Spreadsheets',
  doc: 'Word', docx: 'Word',
}

const EXT_ICON = [
  [/^pdf$/i, 'mdi-file-pdf-box text-danger'],
  [/^(xlsx|xls|csv)$/i, 'mdi-file-excel-box text-success'],
  [/^(docx?|rtf)$/i, 'mdi-file-word-box text-primary'],
  [/^(jpe?g|png|gif|bmp|tiff?)$/i, 'mdi-file-image-box text-info'],
]

function iconFor(ext) {
  const hit = EXT_ICON.find(([re]) => re.test(ext || ''))
  return hit ? hit[1] : 'mdi-file-outline text-muted'
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d)) return ''
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function shortDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/*
 * A flex item defaults to min-width:auto, which means it refuses to shrink
 * below its content. A single unbroken line of document text therefore widens
 * the whole row and pushes the action buttons off the side of the page.
 *
 * min-width:0 is the fix. It is written out here rather than using a utility
 * class because Bootstrap 5, which this project uses, has no min-w-0.
 */
const SR_CSS = `
.sr-wrap .sr-main{min-width:0}
.sr-wrap .sr-actions{flex:none}
`

/**
 * One "...matched here..." line.
 *
 * The API returns the snippet as plain text plus match offsets, never as
 * markup. The highlighting is applied here by slicing the string, so text
 * that came out of a scanned document can never be interpreted as HTML.
 */
function Snippet({ snippet, clamp = false }) {
  const parts = []
  let cursor = 0

  for (const m of snippet.matches || []) {
    if (m.start < cursor) continue // overlapping match, already covered
    if (m.start > cursor) parts.push({ text: snippet.text.slice(cursor, m.start), hit: false })
    parts.push({ text: snippet.text.substr(m.start, m.length), hit: true })
    cursor = m.start + m.length
  }
  if (cursor < snippet.text.length) parts.push({ text: snippet.text.slice(cursor), hit: false })

  // Clamped: one line, ellipsised. Newlines are collapsed to spaces first,
  // because a scan's line breaks would otherwise fill the single line with
  // whitespace and push the matched word out of sight.
  const style = clamp
    ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.5 }
    : { whiteSpace: 'pre-wrap', lineHeight: 1.5 }

  return (
    <div className="font-12 text-muted" style={style}>
      {snippet.page > 1 && (
        <span className="badge bg-light text-muted me-1">p.{snippet.page}</span>
      )}
      {parts.map((p, i) => {
        const text = clamp ? p.text.replace(/\s+/g, ' ') : p.text
        return p.hit
          ? <mark key={i} style={{ background: '#fff3cd', padding: '0 2px', borderRadius: 2 }}>{text}</mark>
          : <span key={i}>{text}</span>
      })}
    </div>
  )
}

export default function SearchResults({ query, onOpen, onShowInTree, onClearQuery }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [dropped, setDropped] = useState({}) // filters the user removed
  const [expanded, setExpanded] = useState({}) // fileId -> showing full matches

  const toggleExpanded = useCallback((fileId) => {
    setExpanded((prev) => ({ ...prev, [fileId]: !prev[fileId] }))
  }, [])

  // A new search is a new list; nothing should stay open from the last one.
  useEffect(() => { setPage(1); setDropped({}); setExpanded({}) }, [query])
  useEffect(() => { setExpanded({}) }, [page])

  const run = useCallback(async () => {
    if (!query) return
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ q: query, page: String(page), limit: '20' })
      // A removed chip becomes an explicit empty override, so the server does
      // not simply re-parse it out of the phrase again.
      Object.keys(dropped).forEach((k) => params.set(k, ''))
      const res = await fetch(`/admin/search?${params.toString()}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('search failed')
      setData(await res.json())
    } catch (err) {
      console.error('[search]', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [query, page, dropped])

  useEffect(() => { run() }, [run])

  if (!query) return null

  const interpreted = data?.query?.interpreted
  const f = interpreted?.filters || {}
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1

  const chips = []
  if (f.dateFrom || f.dateTo) {
    chips.push({
      key: 'date',
      label: `${shortDate(f.dateFrom)}${f.dateTo ? ` – ${shortDate(f.dateTo)}` : ''}`,
      icon: 'mdi-calendar-outline',
      drops: ['from', 'to'],
    })
  }
  if (f.uploaderUsername) {
    chips.push({ key: 'uploader', label: `from ${f.uploaderUsername}`, icon: 'mdi-account-outline', drops: [] })
  }
  if (f.branch) chips.push({ key: 'branch', label: f.branch, icon: 'mdi-domain', drops: ['branch'] })
  if (f.department) chips.push({ key: 'department', label: f.department, icon: 'mdi-sitemap-outline', drops: ['department'] })
  if (f.fileTypes?.length) {
    chips.push({
      key: 'type',
      label: TYPE_LABEL[f.fileTypes[0]] || f.fileTypes.join('/'),
      icon: 'mdi-file-outline',
      drops: ['type'],
    })
  }
  if (f.batch) chips.push({ key: 'batch', label: f.batch, icon: 'mdi-folder-zip-outline', drops: ['batch'] })

  const dropChip = (chip) => {
    if (chip.drops.length === 0) return
    setDropped((prev) => {
      const next = { ...prev }
      chip.drops.forEach((d) => { next[d] = true })
      return next
    })
    setPage(1)
  }

  return (
    <div className="sr-wrap">
      <style>{SR_CSS}</style>
      <div className="d-flex align-items-center mb-2">
        <h5 className="mb-0 flex-grow-1">
          {loading ? 'Searching…' : data ? `${data.total} result${data.total === 1 ? '' : 's'}` : 'Search'}
          <span className="text-muted fw-normal ms-1">for “{query}”</span>
        </h5>
        <button className="btn btn-sm btn-light" onClick={onClearQuery}>
          <i className="mdi mdi-close me-1" />Clear search
        </button>
      </div>

      {/* what the server understood */}
      {(chips.length > 0 || interpreted?.terms?.length > 0) && (
        <div className="mb-2">
          {interpreted.terms.map((t) => (
            <span key={`t-${t}`} className="badge bg-light text-dark me-1 mb-1">
              <i className="mdi mdi-magnify me-1" />{t}
            </span>
          ))}
          {chips.map((c) => (
            <span key={c.key} className="badge bg-primary-lighten text-primary me-1 mb-1">
              <i className={`mdi ${c.icon} me-1`} />{c.label}
              {c.drops.length > 0 && (
                <button
                  className="btn btn-link p-0 ms-1 text-primary"
                  style={{ lineHeight: 1, verticalAlign: 'baseline' }}
                  onClick={() => dropChip(c)}
                  title="Remove this filter"
                >
                  <i className="mdi mdi-close" />
                </button>
              )}
            </span>
          ))}
          {data?.scope && data.scope !== 'all' && (
            <span className="badge bg-light text-muted me-1 mb-1">
              <i className="mdi mdi-eye-outline me-1" />
              {data.scope === 'department' ? 'your department' : 'your files'}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger" role="alert">
          <i className="mdi mdi-alert-circle-outline me-1" />
          Search failed. <button className="btn btn-link p-0 align-baseline" onClick={run}>Try again</button>
        </div>
      )}

      {!loading && !error && data?.results?.length === 0 && (
        <div className="text-center py-5">
          <i className="mdi mdi-file-search-outline text-muted" style={{ fontSize: 38 }} />
          <h5 className="mt-2 mb-1">Nothing matched</h5>
          <p className="text-muted mb-0">
            {chips.length > 0
              ? 'Try removing one of the filters above.'
              : 'Try fewer words, or part of the file name.'}
          </p>
        </div>
      )}

      {!loading && !error && data?.truncated && (
        <div className="alert alert-warning py-2 px-3" role="alert">
          <i className="mdi mdi-information-outline me-1" />
          Showing the best matches only. Narrow the search to see everything.
        </div>
      )}

      {!loading && !error && data?.results?.map((r) => (
        <div className="card shadow-none border mb-2" key={r.fileId}>
          <div className="p-2 d-flex align-items-start">
            <div className="avatar-sm me-2 flex-shrink-0">
              <span className="avatar-title bg-light rounded">
                <i className={`mdi ${iconFor(r.extension)} font-20`} />
              </span>
            </div>

            <div className="flex-grow-1 sr-main">
              <button
                className="btn btn-link p-0 fw-bold text-body text-truncate d-block text-start"
                title={r.fileName}
                onClick={() => onOpen && onOpen(r)}
              >
                {r.displayName}
              </button>

              <div className="font-12 text-muted text-truncate">
                {r.pathSegments.join(' › ')}
                {r.batch && <> › <span className="text-warning">{r.batch}</span></>}
              </div>

              <div className="font-12 text-muted mt-1">
                {r.uploader && <><i className="mdi mdi-account-outline me-1" />{r.uploader.fullname || r.uploader.username}</>}
                <span className="mx-2">·</span>
                <i className="mdi mdi-clock-outline me-1" />{formatDate(r.createdAt)}
                {r.matchedOn?.includes('filename') && (
                  <span className="badge bg-secondary-lighten text-secondary ms-2">Name</span>
                )}
                {r.matchedOn?.includes('content') && (
                  <span className="badge bg-info-lighten text-info ms-1">In document</span>
                )}
              </div>

              {/*
                * What was found inside the document.
                *
                * Collapsed by default, showing one clamped line: enough to tell
                * whether this is the right file, while keeping every result the
                * same height so a page of them can be scanned. The full text of
                * every match is one click away.
                */}
              {r.snippets?.length > 0 && (
                <div className="mt-1">
                  {expanded[r.fileId]
                    ? r.snippets.map((sn, i) => <Snippet key={i} snippet={sn} />)
                    : <Snippet snippet={r.snippets[0]} clamp />}

                  <button
                    className="btn btn-link btn-sm p-0 font-12"
                    onClick={() => toggleExpanded(r.fileId)}
                    aria-expanded={!!expanded[r.fileId]}
                  >
                    <i className={`mdi ${expanded[r.fileId] ? 'mdi-chevron-up' : 'mdi-chevron-down'} me-1`} />
                    {expanded[r.fileId]
                      ? 'Hide matching text'
                      : `Show matching text${r.snippets.length > 1 ? ` (${r.snippets.length})` : ''}`}
                  </button>
                </div>
              )}
            </div>

            <div className="sr-actions ms-2 d-flex flex-column" style={{ gap: 4 }}>
              <button
                className="btn btn-sm btn-light text-nowrap"
                onClick={() => onShowInTree && onShowInTree(r)}
                title="Open this file and show it in the folder tree"
              >
                <i className="mdi mdi-target me-1" />Show in tree
              </button>
              <button
                className="btn btn-sm btn-light text-nowrap"
                onClick={() => onOpen && onOpen(r)}
                title="Open this file in the preview pane"
              >
                <i className="mdi mdi-eye-outline me-1" />Preview
              </button>
            </div>
          </div>
        </div>
      ))}

      {!loading && !error && data && data.total > data.limit && (
        <div className="d-flex justify-content-between align-items-center mt-2">
          <span className="text-muted font-13">
            Page {data.page} of {totalPages}
          </span>
          <div>
            <button
              className="btn btn-sm btn-light me-1"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <i className="mdi mdi-chevron-left" />
            </button>
            <button
              className="btn btn-sm btn-light"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <i className="mdi mdi-chevron-right" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
