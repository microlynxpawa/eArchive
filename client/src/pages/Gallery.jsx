import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import UserPickerModal from '../components/UserPickerModal'
import FileSendingHistoryModal from '../components/FileSendingHistoryModal'

// FileSendingHistoryModal reads permissions from here to decide whether the
// current user may look at someone else's history.
export const AuthsContext = createContext({})

/*
 * Files
 *
 * Rebuilt on Hyper (Bootstrap 5) markup. Behaviour is unchanged from the
 * previous implementation: a folder tree on the left, an inline preview on the
 * right, and selection that only appears while Pick & Send or Delete is active.
 *
 */

// ---------------------------------------------------------------- helpers

// "name@batch.ext" -> "batch". Files with no @ belong to Single Uploads.
function extractBatchName(filename) {
  const at = filename.indexOf('@')
  if (at === -1) return null
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot < at) return filename.slice(at + 1)
  return filename.slice(at + 1, lastDot)
}

// The display name drops the batch suffix but keeps the extension.
function displayName(filename) {
  const at = filename.indexOf('@')
  if (at === -1) return filename
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot < at) return filename.slice(0, at)
  return filename.slice(0, at) + filename.slice(lastDot)
}

// Dates live in the filename as d-m-yyyy immediately before the extension.
function extractDateFromFilename(filename) {
  const m = filename.match(/[\s_\-.](\d{1,2})-(\d{1,2})-(\d{4})\./)
  if (!m) return null
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10))
}

function sortFilesByDateDesc(files) {
  return files.slice().sort((a, b) => {
    const da = extractDateFromFilename(a) || new Date(0)
    const db = extractDateFromFilename(b) || new Date(0)
    return db - da
  })
}

// The API expects d-m-yyyy with no leading zeros; the picker gives yyyy-mm-dd.
function isoToApiDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return null
  return `${Number(d)}-${Number(m)}-${y}`
}

function prettyDate(iso) {
  if (!iso) return ''
  const dt = new Date(iso + 'T00:00:00')
  if (isNaN(dt)) return iso
  return dt.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

const EXT_ICON = [
  [/\.pdf$/i, 'mdi-file-pdf-box text-danger'],
  [/\.(xlsx|xls|csv)$/i, 'mdi-file-excel-box text-success'],
  [/\.(docx|doc)$/i, 'mdi-file-word-box text-primary'],
  [/\.(jpe?g|png|gif|bmp|tiff?)$/i, 'mdi-file-image-box text-info'],
  [/\.(txt|log|md)$/i, 'mdi-file-document-outline text-muted'],
]

function fileIcon(name) {
  const hit = EXT_ICON.find(([re]) => re.test(name))
  return hit ? hit[1] : 'mdi-file-outline text-muted'
}

/*
 * The API returns nested objects keyed by folder name, with a `files` array at
 * the levels that hold files. This turns that into a node list, grouping each
 * level's files into batch folders.
 */
function buildNodes(obj, parentPath = '') {
  if (!obj || typeof obj !== 'object') return []

  const folders = Object.keys(obj)
    .filter((k) => k !== 'files')
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const path = parentPath ? `${parentPath}/${name}` : name
      return {
        kind: 'folder',
        name,
        path,
        children: buildNodes(obj[name], path),
      }
    })

  const files = Array.isArray(obj.files) ? obj.files : []
  const batches = {}
  files.forEach((f) => {
    const key = extractBatchName(f) || '__single__'
    if (!batches[key]) batches[key] = []
    batches[key].push(f)
  })

  const batchNodes = Object.keys(batches)
    .sort((a, b) => (a === '__single__' ? 1 : b === '__single__' ? -1 : a.localeCompare(b)))
    .map((key) => ({
      kind: 'batch',
      name: key === '__single__' ? 'Single Uploads' : key,
      isSingle: key === '__single__',
      path: parentPath ? `${parentPath}/${key}` : key,
      files: sortFilesByDateDesc(batches[key]),
    }))

  return [...folders, ...batchNodes]
}

function collectFolderPaths(nodes, acc = []) {
  nodes.forEach((n) => {
    if (n.kind === 'folder') {
      acc.push(n.path)
      collectFolderPaths(n.children || [], acc)
    }
  })
  return acc
}

// Every ancestor path of a file, so a match can be revealed in the tree.
function findFilePaths(nodes, fileName, trail = [], out = []) {
  nodes.forEach((n) => {
    if (n.kind === 'batch') {
      if (n.files.includes(fileName)) out.push([...trail, n.path])
    } else {
      findFilePaths(n.children || [], fileName, [...trail, n.path], out)
    }
  })
  return out
}

// ---------------------------------------------------------------- component

export default function Gallery() {
  const [auths, setAuths] = useState({})
  const [structure, setStructure] = useState(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [treeError, setTreeError] = useState(false)

  const [expanded, setExpanded] = useState({})
  const [allOpen, setAllOpen] = useState(false)

  // null | 'send' | 'delete'
  const [mode, setMode] = useState(null)
  const [selected, setSelected] = useState([])

  const [preview, setPreview] = useState(null)
  const [previewState, setPreviewState] = useState('idle') // idle | loading | ready | error
  const [fullscreen, setFullscreen] = useState(false)

  const [nameQuery, setNameQuery] = useState('')
  const [dateQuery, setDateQuery] = useState('')
  const [result, setResult] = useState(null) // { kind, label, files, folders }
  const [showMatched, setShowMatched] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(null) // array of names
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const userPickerRef = useRef(null)
  const historyRef = useRef(null)
  const objectUrlRef = useRef(null)

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.clearTimeout(notify._t)
    notify._t = window.setTimeout(() => setToast(null), 4000)
  }, [])

  // ------------------------------------------------------------- data

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    setTreeError(false)
    try {
      const res = await fetch('/admin/file-structure', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('failed')
      // the endpoint answers { statusCode, fileStructure }
      const data = await res.json()
      setStructure(data && data.fileStructure ? data.fileStructure : data)
    } catch (err) {
      console.error('[files] structure', err)
      setTreeError(true)
    } finally {
      setLoadingTree(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/admin/dashboard-data', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (res.ok) {
          const data = await res.json()
          if (data && data.auths) setAuths(data.auths)
        }
      } catch (err) {
        console.error('[files] auths', err)
      }
    })()
    loadTree()
  }, [loadTree])

  const nodes = useMemo(() => buildNodes(structure || {}), [structure])
  const canDelete = !!auths.is_admin

  // Which files the user can see is decided server side; this only labels it.
  const scopeLabel = auths.canViewBranchFiles
    ? 'your branch'
    : auths.canViewDepartmentFiles
      ? 'your department'
      : 'your own files'

  // ------------------------------------------------------------- tree state

  const isOpen = useCallback((path) => !!expanded[path], [expanded])

  const toggle = useCallback((path) => {
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }))
  }, [])

  // Folders only. Batch groups keep whatever the user set, so expanding the
  // structure never dumps every file onto the page at once.
  const toggleAllFolders = useCallback(() => {
    const paths = collectFolderPaths(nodes)
    const opening = !allOpen
    setExpanded((prev) => {
      const next = { ...prev }
      paths.forEach((p) => { next[p] = opening })
      return next
    })
    setAllOpen(opening)
  }, [nodes, allOpen])

  const revealFiles = useCallback((fileNames) => {
    setExpanded((prev) => {
      const next = { ...prev }
      fileNames.forEach((name) => {
        findFilePaths(nodes, name).forEach((trail) => {
          trail.forEach((p) => { next[p] = true })
        })
      })
      return next
    })
  }, [nodes])

  const openUserFolder = useCallback((username) => {
    const target = []
    const walk = (list, trail) => {
      list.forEach((n) => {
        if (n.kind !== 'folder') return
        const nextTrail = [...trail, n.path]
        if (n.name === username) target.push(nextTrail)
        walk(n.children || [], nextTrail)
      })
    }
    walk(nodes, [])
    if (target.length === 0) {
      notify(`No folder found for ${username}.`, 'error')
      return
    }
    setExpanded((prev) => {
      const next = { ...prev }
      target.forEach((trail) => trail.forEach((p) => { next[p] = true }))
      return next
    })
    setResult({ kind: 'user', label: username, files: [], folders: target.length })
  }, [nodes, notify])

  // ------------------------------------------------------------- searching

  const allFiles = useMemo(() => {
    const out = []
    const walk = (list) => list.forEach((n) => {
      if (n.kind === 'batch') out.push(...n.files)
      else walk(n.children || [])
    })
    walk(nodes)
    return out
  }, [nodes])

  const searchByName = () => {
    const q = nameQuery.trim().toLowerCase()
    if (!q) return notify('Enter part of a file name.', 'error')
    const hits = allFiles.filter((f) => f.toLowerCase().includes(q))
    if (hits.length === 0) {
      setResult(null)
      return notify('No files match that name.', 'error')
    }
    revealFiles(hits)
    setResult({ kind: 'name', label: nameQuery.trim(), files: hits })
  }

  const searchByDate = () => {
    const api = isoToApiDate(dateQuery)
    if (!api) return notify('Choose a date first.', 'error')
    // The date sits immediately before the extension, as the archive names them.
    const re = new RegExp(`${api.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.[^.]+$`)
    const hits = allFiles.filter((f) => re.test(f))
    if (hits.length === 0) {
      setResult(null)
      return notify('No files found for that date.', 'error')
    }
    const folders = new Set()
    hits.forEach((f) => findFilePaths(nodes, f).forEach((t) => folders.add(t[t.length - 1])))
    revealFiles(hits)
    setResult({ kind: 'date', label: prettyDate(dateQuery), files: hits, folders: folders.size })
  }

  const searchByUser = async () => {
    if (!userPickerRef.current?.show) return
    const picked = await userPickerRef.current.show()
    if (!picked || picked.length === 0) return
    openUserFolder(picked[0])
  }

  const clearResult = () => {
    setResult(null)
    setNameQuery('')
    setDateQuery('')
  }

  // ------------------------------------------------------------- preview

  const openPreview = useCallback(async (fileName, meta) => {
    setPreview({ name: fileName, meta, url: null, type: null })
    setPreviewState('loading')
    try {
      const res = await fetch(`/admin/file-content?fileName=${encodeURIComponent(fileName)}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      let text = null
      const type = blob.type || ''
      if (!type.startsWith('image/') && type !== 'application/pdf') {
        text = await blob.slice(0, 200000).text()
      }
      setPreview({ name: fileName, meta, url, type, text })
      setPreviewState('ready')
    } catch (err) {
      console.error('[files] preview', err)
      setPreviewState('error')
    }
  }, [])

  const downloadUrl = (fileName) => `/admin/file-content?fileName=${encodeURIComponent(fileName)}`

  // ------------------------------------------------------------- selection

  const toggleFile = (fileName) => {
    setSelected((prev) =>
      prev.includes(fileName) ? prev.filter((f) => f !== fileName) : [...prev, fileName])
  }

  const toggleBatch = (batch) => {
    const every = batch.files.every((f) => selected.includes(f))
    setSelected((prev) => every
      ? prev.filter((f) => !batch.files.includes(f))
      : [...new Set([...prev, ...batch.files])])
  }

  const startMode = (next) => {
    setMode(next)
    setSelected([])
  }

  const cancelMode = () => {
    setMode(null)
    setSelected([])
  }

  // ------------------------------------------------------------- actions

  const sendSelected = async () => {
    if (selected.length === 0) return notify('Please select a file.', 'error')
    if (!userPickerRef.current?.show) return
    const recipients = await userPickerRef.current.show()
    if (!recipients || recipients.length === 0) return

    setBusy(true)
    try {
      const res = await fetch('/admin/sendFilesToUsers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: recipients, files: selected }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        notify(data.message || 'Files sent successfully', 'success')
        cancelMode()
        loadTree()
      } else if (res.status === 404 && Array.isArray(data.missingFiles)) {
        notify(`Partly sent. Skipped: ${data.missingFiles.join(', ')}`, 'error')
        cancelMode()
        loadTree()
      } else {
        notify(data.message || 'Failed to send files', 'error')
      }
    } catch (err) {
      console.error('[files] send', err)
      notify('Failed to send files', 'error')
    } finally {
      setBusy(false)
    }
  }

  const runDelete = async () => {
    const files = confirmDelete || []
    setBusy(true)
    try {
      const res = await fetch('/admin/delete-file', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'failed')
      notify(data.message || `${files.length} file(s) deleted`, 'success')
      setConfirmDelete(null)
      cancelMode()
      if (preview && files.includes(preview.name)) {
        setPreview(null)
        setPreviewState('idle')
      }
      loadTree()
    } catch (err) {
      console.error('[files] delete', err)
      notify('Delete failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  // ------------------------------------------------------------- rendering

  const renderFile = (fileName, batch) => {
    const isSelected = selected.includes(fileName)
    const active = preview && preview.name === fileName
    return (
      <div
        key={fileName}
        className={`ea-row ea-file${active ? ' ea-active' : ''}`}
      >
        {mode && (
          <input
            className="form-check-input ea-check me-2"
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleFile(fileName)}
          />
        )}
        <i className={`mdi ${fileIcon(fileName)} me-1`} />
        <button
          type="button"
          className="ea-name"
          title={fileName}
          onClick={() => openPreview(fileName, batch)}
        >
          {displayName(fileName)}
        </button>
        <span className="ea-actions">
          <a
            href={downloadUrl(fileName)}
            download={fileName}
            className="text-muted me-2"
            title="Download"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="mdi mdi-download-outline" />
          </a>
          {canDelete && (
            <button
              type="button"
              className="btn btn-link p-0 text-danger"
              title="Delete"
              onClick={() => setConfirmDelete([fileName])}
            >
              <i className="mdi mdi-trash-can-outline" />
            </button>
          )}
        </span>
      </div>
    )
  }

  const renderNode = (node) => {
    if (node.kind === 'batch') {
      const open = isOpen(node.path)
      const every = node.files.length > 0 && node.files.every((f) => selected.includes(f))
      return (
        <div key={node.path} className={`ea-node${open ? ' ea-open' : ''}`} data-kind="batch">
          <div className="ea-row" role="button" onClick={() => toggle(node.path)}>
            {mode && (
              <input
                className="form-check-input ea-check me-2"
                type="checkbox"
                checked={every}
                onChange={() => toggleBatch(node)}
                onClick={(e) => e.stopPropagation()}
                title="Select everything in this batch"
              />
            )}
            <i className={`mdi mdi-chevron-${open ? 'down' : 'right'} ea-caret`} />
            <i className={`mdi ${node.isSingle ? 'mdi-folder-outline text-muted' : 'mdi-folder-zip-outline text-warning'} me-1`} />
            <span className="fw-bold" title={node.name}>{node.name}</span>
            <span className="badge bg-light text-dark ms-2">{node.files.length}</span>
          </div>
          {open && (
            <div className="ea-children">
              {node.files.map((f) => renderFile(f, node.name))}
            </div>
          )}
        </div>
      )
    }

    const open = isOpen(node.path)
    const depth = node.path.split('/').length
    const icon = depth === 1 ? 'mdi-domain text-muted'
      : depth === 2 ? 'mdi-sitemap-outline text-muted'
        : open ? 'mdi-folder-open text-warning' : 'mdi-folder text-warning'

    return (
      <div key={node.path} className={`ea-node${open ? ' ea-open' : ''}`}>
        <div className="ea-row" role="button" onClick={() => toggle(node.path)}>
          <i className={`mdi mdi-chevron-${open ? 'down' : 'right'} ea-caret`} />
          <i className={`mdi ${icon} me-1`} />
          {/* no count here: branch, department and user folders never showed one */}
          <span className="fw-bold" title={node.name}>{node.name}</span>
        </div>
        {open && (
          <div className="ea-children">
            {(node.children || []).map(renderNode)}
          </div>
        )}
      </div>
    )
  }

  return (
    <AuthsContext.Provider value={auths}>
      <style>{PAGE_CSS}</style>

      <UserPickerModal ref={userPickerRef} />
      <FileSendingHistoryModal ref={historyRef} onNavigateToFile={(name) => revealFiles([name])} />

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              {/* three searches, each its own control */}
              <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                <div>
                  <label className="form-label font-12 text-muted mb-1 d-block" htmlFor="ea-name">
                    Search by file name
                  </label>
                  <div className="input-group input-group-sm" style={{ width: 250 }}>
                    <input
                      id="ea-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Payroll"
                      value={nameQuery}
                      onChange={(e) => setNameQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchByName()}
                    />
                    <button className="btn btn-primary" type="button" onClick={searchByName} title="Search">
                      <i className="mdi mdi-magnify" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label font-12 text-muted mb-1 d-block" htmlFor="ea-date">
                    Search by date
                  </label>
                  <div className="input-group input-group-sm" style={{ width: 195 }}>
                    <input
                      id="ea-date"
                      type="date"
                      className="form-control"
                      value={dateQuery}
                      onChange={(e) => setDateQuery(e.target.value)}
                    />
                    <button className="btn btn-primary" type="button" onClick={searchByDate} title="Search">
                      <i className="mdi mdi-magnify" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label font-12 text-muted mb-1 d-block">Search by person</label>
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    style={{ width: 200 }}
                    onClick={searchByUser}
                  >
                    <i className="mdi mdi-folder-account-outline me-1" />
                    Find a user&rsquo;s files
                  </button>
                </div>

                <div className="ms-auto">
                  <button
                    type="button"
                    className="btn btn-sm btn-light border"
                    onClick={() => historyRef.current?.show()}
                  >
                    <i className="mdi mdi-history me-1" />Sending history
                  </button>
                </div>
              </div>

              {/* what the last search found */}
              {result && (
                <div className="alert alert-info py-2 px-3 d-flex align-items-center mb-2" role="alert">
                  <i className={`mdi ${result.kind === 'date' ? 'mdi-calendar-search' : result.kind === 'user' ? 'mdi-folder-account-outline' : 'mdi-file-search-outline'} me-2`} />
                  <span className="flex-grow-1">
                    {result.kind === 'name' && (
                      <><strong>{result.files.length} file(s)</strong> match <strong>&ldquo;{result.label}&rdquo;</strong>. Each one is highlighted below.</>
                    )}
                    {result.kind === 'date' && (
                      <>Files dated <strong>{result.label}</strong> were found in <strong>{result.folders} folder(s)</strong>. Those folders are open below.</>
                    )}
                    {result.kind === 'user' && (
                      <>Opened the folder for <strong>{result.label}</strong>.</>
                    )}
                  </span>
                  {result.kind === 'name' && (
                    <button className="btn btn-link p-0 me-3" onClick={() => setShowMatched(true)}>
                      View as list
                    </button>
                  )}
                  <button className="btn btn-link p-0 text-muted" onClick={clearResult}>
                    <i className="mdi mdi-close" /> Clear
                  </button>
                </div>
              )}

              <div className="ea-split">

                {/* ---------------- tree ---------------- */}
                <div className="ea-pane-left">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-1 mb-2">
                    <span className="text-muted font-12">
                      <i className="mdi mdi-eye-outline me-1" />
                      Showing {scopeLabel}
                    </span>
                    <button className="btn btn-sm btn-link text-muted p-0" onClick={toggleAllFolders}>
                      <i className={`mdi mdi-unfold-${allOpen ? 'less' : 'more'}-horizontal me-1`} />
                      {allOpen ? 'Collapse' : 'Expand'} all folders
                    </button>
                  </div>

                  {loadingTree && (
                    <div className="placeholder-glow">
                      {[8, 6, 7, 5, 9].map((c, i) => (
                        <p key={i} className={`placeholder col-${c} mb-2`} style={{ marginLeft: i * 6 }} />
                      ))}
                    </div>
                  )}

                  {!loadingTree && treeError && (
                    <div className="alert alert-danger py-2 px-3" role="alert">
                      <i className="mdi mdi-alert-circle-outline me-1" />
                      Could not load your folders.{' '}
                      <button className="btn btn-link p-0 align-baseline" onClick={loadTree}>Retry</button>
                    </div>
                  )}

                  {!loadingTree && !treeError && nodes.length === 0 && (
                    <div className="text-center py-5">
                      <i className="mdi mdi-folder-open-outline text-muted" style={{ fontSize: 34 }} />
                      <h5 className="mt-2 mb-1">No files yet</h5>
                      <p className="text-muted mb-0 font-13">Files you upload will appear here.</p>
                    </div>
                  )}

                  {!loadingTree && !treeError && nodes.length > 0 && (
                    <div className="ea-tree">{nodes.map(renderNode)}</div>
                  )}
                </div>

                {/* ---------------- viewer ---------------- */}
                <div className="ea-pane-right">
                  <div className="ea-viewer">
                    <div className="ea-viewer-head">
                      {preview ? (
                        <>
                          <span className="text-truncate fw-bold" title={preview.name}>
                            {displayName(preview.name)}
                          </span>
                          {preview.meta && (
                            <span className="text-muted font-12 ms-2 text-truncate">{preview.meta}</span>
                          )}
                          <span className="ms-auto">
                            <a
                              className="btn btn-sm btn-light py-0 px-1 me-1"
                              href={downloadUrl(preview.name)}
                              download={preview.name}
                              title="Download"
                            >
                              <i className="mdi mdi-download-outline" />
                            </a>
                            <button
                              className="btn btn-sm btn-light py-0 px-1"
                              title="Open full screen"
                              onClick={() => setFullscreen(true)}
                              disabled={previewState !== 'ready'}
                            >
                              <i className="mdi mdi-fullscreen" />
                            </button>
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">Preview</span>
                      )}
                    </div>

                    <div className="ea-viewer-body">
                      {previewState === 'idle' && (
                        <div className="text-center text-muted">
                          <i className="mdi mdi-file-eye-outline" style={{ fontSize: 40 }} />
                          <p className="mb-0 mt-1">Select a file to preview its content here.</p>
                        </div>
                      )}
                      {previewState === 'loading' && (
                        <div className="text-center text-muted">
                          <div className="spinner-border text-primary" role="status" />
                          <p className="mb-0 mt-2 font-13">Loading preview&hellip;</p>
                        </div>
                      )}
                      {previewState === 'error' && (
                        <div className="text-center text-muted">
                          <i className="mdi mdi-alert-circle-outline text-danger" style={{ fontSize: 36 }} />
                          <p className="mb-0 mt-2">Error loading file preview.</p>
                        </div>
                      )}
                      {previewState === 'ready' && preview && <PreviewBody preview={preview} />}
                    </div>
                  </div>

                  {/* ---------------- modes ---------------- */}
                  <div className="mt-2">
                    {!mode && (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        {auths.view_upload && (
                          <button className="btn btn-sm btn-primary" onClick={() => startMode('send')}>
                            <i className="mdi mdi-send-outline me-1" />Pick &amp; Send
                          </button>
                        )}
                        {canDelete && (
                          <button className="btn btn-sm btn-light" onClick={() => startMode('delete')}>
                            <i className="mdi mdi-trash-can-outline me-1" />Delete
                          </button>
                        )}
                      </div>
                    )}

                    {mode === 'send' && (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="badge bg-primary-lighten text-primary">Pick &amp; Send mode</span>
                        <button className="btn btn-sm btn-danger" onClick={cancelMode}>
                          <i className="mdi mdi-close me-1" />Cancel file sending
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={sendSelected}
                          disabled={selected.length === 0 || busy}
                        >
                          {busy
                            ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Sending&hellip;</>
                            : <><i className="mdi mdi-send me-1" />Send{selected.length ? ` ${selected.length}` : ''}</>}
                        </button>
                        {selected.length === 0 && (
                          <span className="text-success font-13">Please select a file.</span>
                        )}
                      </div>
                    )}

                    {mode === 'delete' && (
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="badge bg-danger-lighten text-danger">Delete mode</span>
                        <button className="btn btn-sm btn-secondary" onClick={cancelMode}>
                          <i className="mdi mdi-close me-1" />Cancel Delete
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => setConfirmDelete(selected)}
                          disabled={selected.length === 0}
                        >
                          <i className="mdi mdi-trash-can-outline me-1" />
                          Delete selected{selected.length ? ` (${selected.length})` : ''}
                        </button>
                        {selected.length === 0 && (
                          <span className="text-success font-13">Select file(s) to delete.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* matched files */}
      {showMatched && result?.kind === 'name' && (
        <Backdrop onClose={() => setShowMatched(false)}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  Files matching &ldquo;{result.label}&rdquo;
                  <span className="badge bg-primary ms-1">{result.files.length}</span>
                </h4>
                <button type="button" className="btn-close" onClick={() => setShowMatched(false)} />
              </div>
              <div className="modal-body p-0">
                <table className="table table-centered table-hover mb-0">
                  <tbody>
                    {result.files.map((f) => (
                      <tr key={f}>
                        <td style={{ width: 44 }}>
                          <i className={`mdi ${fileIcon(f)} font-18`} />
                        </td>
                        <td>
                          <span className="fw-bold d-block">{displayName(f)}</span>
                          <span className="font-12 text-muted">
                            {(findFilePaths(nodes, f)[0] || []).join(' / ')}
                          </span>
                        </td>
                        <td className="text-end" style={{ width: 150 }}>
                          <button
                            className="btn btn-sm btn-light"
                            onClick={() => { revealFiles([f]); setShowMatched(false) }}
                          >
                            <i className="mdi mdi-target me-1" />Show in tree
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer">
                <span className="text-muted font-13 me-auto">
                  All matches are highlighted in the tree behind this list.
                </span>
                <button className="btn btn-light" onClick={() => setShowMatched(false)}>Close</button>
              </div>
            </div>
          </div>
        </Backdrop>
      )}

      {/* full screen preview */}
      {fullscreen && preview && (
        <Backdrop onClose={() => setFullscreen(false)}>
          <div className="modal-dialog modal-fullscreen" role="document">
            <div className="modal-content">
              <div className="modal-header py-2">
                <div className="text-truncate">
                  <h5 className="modal-title text-truncate mb-0">{displayName(preview.name)}</h5>
                  {preview.meta && <span className="font-12 text-muted">{preview.meta}</span>}
                </div>
                <div className="ms-auto me-2">
                  <a className="btn btn-sm btn-light" href={downloadUrl(preview.name)} download={preview.name}>
                    <i className="mdi mdi-download-outline me-1" />Download
                  </a>
                </div>
                <button type="button" className="btn-close" onClick={() => setFullscreen(false)} />
              </div>
              <div className="modal-body bg-light p-0 d-flex align-items-center justify-content-center">
                <PreviewBody preview={preview} full />
              </div>
            </div>
          </div>
        </Backdrop>
      )}

      {/* delete confirmation */}
      {confirmDelete && (
        <Backdrop onClose={() => !busy && setConfirmDelete(null)}>
          <div className="modal-dialog modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">
                  Delete {confirmDelete.length} file{confirmDelete.length === 1 ? '' : 's'}?
                </h4>
                <button type="button" className="btn-close" onClick={() => setConfirmDelete(null)} disabled={busy} />
              </div>
              <div className="modal-body">
                <p className="mb-2">
                  {confirmDelete.length === 1
                    ? <><strong>{displayName(confirmDelete[0])}</strong> will be permanently removed from the archive.</>
                    : <>These files will be permanently removed from the archive.</>}
                  {' '}This cannot be undone.
                </p>
                {confirmDelete.length > 1 && (
                  <ul className="mb-0 font-13 text-muted" style={{ maxHeight: 160, overflowY: 'auto' }}>
                    {confirmDelete.map((f) => <li key={f}>{displayName(f)}</li>)}
                  </ul>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setConfirmDelete(null)} disabled={busy}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={runDelete} disabled={busy}>
                  {busy
                    ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Deleting&hellip;</>
                    : `Delete file${confirmDelete.length === 1 ? '' : 's'}`}
                </button>
              </div>
            </div>
          </div>
        </Backdrop>
      )}

      {/* toast */}
      {toast && (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 2050 }}>
          <div className={`toast show align-items-center text-white border-0 bg-${toast.type === 'error' ? 'danger' : 'success'}`} role="alert">
            <div className="d-flex">
              <div className="toast-body">
                <i className={`mdi ${toast.type === 'error' ? 'mdi-alert-circle-outline' : 'mdi-check-circle-outline'} me-1`} />
                {toast.message}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)} />
            </div>
          </div>
        </div>
      )}
    </AuthsContext.Provider>
  )
}

// ---------------------------------------------------------------- pieces

function PreviewBody({ preview, full }) {
  const style = full ? { width: '100%', height: '100%' } : { width: '100%', height: '100%' }
  if (!preview.url) return null
  if (preview.type && preview.type.startsWith('image/')) {
    return <img src={preview.url} alt={preview.name} style={{ maxWidth: '100%', maxHeight: '100%' }} />
  }
  if (preview.type === 'application/pdf') {
    return <object data={preview.url} type="application/pdf" style={style} aria-label={preview.name} />
  }
  if (preview.text !== null && preview.text !== undefined) {
    return (
      <pre className="p-3 mb-0 w-100 h-100" style={{ whiteSpace: 'pre-wrap', overflow: 'auto' }}>
        {preview.text}
      </pre>
    )
  }
  return (
    <div className="text-center text-muted">
      <i className="mdi mdi-file-question-outline" style={{ fontSize: 40 }} />
      <h5 className="mt-2 mb-1">No preview available</h5>
      <p className="font-13 mb-2">This file type cannot be shown in the browser.</p>
      <a className="btn btn-sm btn-primary" href={preview.url} download={preview.name}>
        <i className="mdi mdi-download-outline me-1" />Download to open
      </a>
    </div>
  )
}

function Backdrop({ children, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ background: 'rgba(0,0,0,.5)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  )
}

const PAGE_CSS = `
.ea-split{display:flex;align-items:stretch;gap:16px;width:100%}
.ea-pane-left{flex:0 0 280px;width:280px;height:620px;overflow:auto;
  border:1px solid #dee2e6;border-radius:6px;padding:10px}
.ea-pane-right{flex:1 1 0%;min-width:0;width:100%;display:flex;flex-direction:column}
@media (max-width:991px){.ea-split{flex-direction:column}
  .ea-pane-left{flex:none;width:100%;height:320px}}
.ea-tree{font-size:.875rem;min-width:max-content}
.ea-children{margin-left:18px;padding-left:10px;border-left:1px dashed rgba(0,0,0,.12)}
.ea-row{display:flex;align-items:center;padding:5px 6px;border-radius:4px;white-space:nowrap}
.ea-row:hover{background:#f1f3fa}
.ea-caret{width:16px;color:#98a6ad;flex:none}
.ea-name{flex:0 0 auto;background:none;border:0;padding:0;text-align:left;color:inherit;white-space:nowrap}
.ea-name:hover{text-decoration:underline}
.ea-file.ea-active{background:#e3ebff}
.ea-actions{padding-left:16px;flex:none;visibility:hidden;white-space:nowrap;margin-left:auto}
.ea-row:hover .ea-actions{visibility:visible}
.ea-viewer{border:1px solid #dee2e6;border-radius:6px;display:flex;flex-direction:column;
  width:100%;height:560px;overflow:hidden;background:#fff}
.ea-viewer-head{display:flex;align-items:center;gap:4px;padding:6px 10px;
  border-bottom:1px solid #dee2e6;background:#f8f9fa;font-size:.8125rem}
.ea-viewer-body{flex:1 1 auto;overflow:auto;display:flex;align-items:center;
  justify-content:center;background:#f1f3fa}
`
