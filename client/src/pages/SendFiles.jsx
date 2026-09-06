import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { LayoutContext } from '../components/Layout'

/*
 * Send files
 *
 * Replaces the old "Pick and Send" nav item, which linked to the Files page
 * with checkboxes turned on. Sending is a task in its own right here: choose
 * files, choose recipients, review, send.
 *
 * The selection basket persists while browsing the tree, which the previous
 * approach could not do because selection lived in the folder you were
 * looking at.
 */

// ---------------------------------------------------------------- helpers

function extractBatchName(filename) {
  const at = filename.indexOf('@')
  if (at === -1) return null
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot < at) return filename.slice(at + 1)
  return filename.slice(at + 1, lastDot)
}

function displayName(filename) {
  const at = filename.indexOf('@')
  if (at === -1) return filename
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1 || lastDot < at) return filename.slice(0, at)
  return filename.slice(0, at) + filename.slice(lastDot)
}

const EXT_ICON = [
  [/\.pdf$/i, 'mdi-file-pdf-box text-danger'],
  [/\.(xlsx|xls|csv)$/i, 'mdi-file-excel-box text-success'],
  [/\.(docx|doc)$/i, 'mdi-file-word-box text-primary'],
  [/\.(jpe?g|png|gif|bmp|tiff?)$/i, 'mdi-file-image-box text-info'],
]

function fileIcon(name) {
  const hit = EXT_ICON.find(([re]) => re.test(name))
  return hit ? hit[1] : 'mdi-file-outline text-muted'
}

function buildNodes(obj, parentPath = '') {
  if (!obj || typeof obj !== 'object') return []

  const folders = Object.keys(obj)
    .filter((k) => k !== 'files')
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const path = parentPath ? `${parentPath}/${name}` : name
      return { kind: 'folder', name, path, children: buildNodes(obj[name], path) }
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
      files: batches[key],
    }))

  return [...folders, ...batchNodes]
}

function initialsOf(name) {
  return (name || '?').split(/[\s.]+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase()
}

// ---------------------------------------------------------------- component

export default function SendFiles() {
  const { user = {} } = useContext(LayoutContext)

  const [step, setStep] = useState(1)

  const [structure, setStructure] = useState(null)
  const [loadingTree, setLoadingTree] = useState(true)
  const [treeError, setTreeError] = useState(false)
  const [expanded, setExpanded] = useState({})
  const [fileQuery, setFileQuery] = useState('')

  const [people, setPeople] = useState([])
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [peopleError, setPeopleError] = useState(false)
  const [personQuery, setPersonQuery] = useState('')
  const [scope, setScope] = useState('department') // department | branch | everyone

  const [chosenFiles, setChosenFiles] = useState([])
  const [chosenPeople, setChosenPeople] = useState([])

  const [sending, setSending] = useState(false)
  const [outcome, setOutcome] = useState(null) // { kind, message, missing }

  // ------------------------------------------------------------- data

  const loadTree = useCallback(async () => {
    setLoadingTree(true)
    setTreeError(false)
    try {
      const res = await fetch('/admin/file-structure', {
        credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      setStructure(data && data.fileStructure ? data.fileStructure : data)
    } catch (err) {
      console.error('[send] structure', err)
      setTreeError(true)
    } finally {
      setLoadingTree(false)
    }
  }, [])

  const loadPeople = useCallback(async () => {
    setLoadingPeople(true)
    setPeopleError(false)
    try {
      const res = await fetch('/admin/retrieve-users', {
        credentials: 'include', headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('failed')
      const data = await res.json()
      const records = Array.isArray(data.records) ? data.records : []
      // never offer to send to yourself
      setPeople(records.filter((r) => r.id !== user.id))
    } catch (err) {
      console.error('[send] users', err)
      setPeopleError(true)
    } finally {
      setLoadingPeople(false)
    }
  }, [user.id])

  useEffect(() => { loadTree() }, [loadTree])
  useEffect(() => { if (step === 2 && people.length === 0) loadPeople() }, [step, people.length, loadPeople])

  const nodes = useMemo(() => buildNodes(structure || {}), [structure])

  // ------------------------------------------------------------- files

  const toggleFolder = (path) => setExpanded((p) => ({ ...p, [path]: !p[path] }))

  const pickFile = (name, batch) => {
    setChosenFiles((prev) => prev.some((f) => f.name === name)
      ? prev.filter((f) => f.name !== name)
      : [...prev, { name, batch }])
  }

  const pickBatch = (batch) => {
    const every = batch.files.every((f) => chosenFiles.some((c) => c.name === f))
    setChosenFiles((prev) => {
      if (every) return prev.filter((c) => !batch.files.includes(c.name))
      const missing = batch.files
        .filter((f) => !prev.some((c) => c.name === f))
        .map((f) => ({ name: f, batch: batch.isSingle ? null : batch.name }))
      return [...prev, ...missing]
    })
  }

  const matchesFileQuery = (name) =>
    !fileQuery.trim() || name.toLowerCase().includes(fileQuery.trim().toLowerCase())

  const renderNode = (node) => {
    if (node.kind === 'batch') {
      const visible = node.files.filter(matchesFileQuery)
      if (visible.length === 0) return null
      const open = expanded[node.path] || !!fileQuery.trim()
      const every = visible.every((f) => chosenFiles.some((c) => c.name === f))
      return (
        <div key={node.path} className="sf-node">
          <div className="sf-row" role="button" onClick={() => toggleFolder(node.path)}>
            <input
              className="form-check-input me-2"
              type="checkbox"
              checked={every}
              onChange={() => pickBatch({ ...node, files: visible })}
              onClick={(e) => e.stopPropagation()}
              title="Select everything in this batch"
            />
            <i className={`mdi mdi-chevron-${open ? 'down' : 'right'} sf-caret`} />
            <i className={`mdi ${node.isSingle ? 'mdi-folder-outline text-muted' : 'mdi-folder-zip-outline text-warning'} me-1`} />
            <span className="fw-bold">{node.name}</span>
            <span className="badge bg-light text-dark ms-2">{visible.length}</span>
          </div>
          {open && (
            <div className="sf-children">
              {visible.map((f) => (
                <div key={f} className="sf-row">
                  <input
                    className="form-check-input me-2"
                    type="checkbox"
                    checked={chosenFiles.some((c) => c.name === f)}
                    onChange={() => pickFile(f, node.isSingle ? null : node.name)}
                  />
                  <i className={`mdi ${fileIcon(f)} me-1`} />
                  <span title={f}>{displayName(f)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    const children = (node.children || []).map(renderNode).filter(Boolean)
    if (children.length === 0) return null
    const open = expanded[node.path] || !!fileQuery.trim()
    const depth = node.path.split('/').length
    const icon = depth === 1 ? 'mdi-domain text-muted'
      : depth === 2 ? 'mdi-sitemap-outline text-muted'
        : open ? 'mdi-folder-open text-warning' : 'mdi-folder text-warning'

    return (
      <div key={node.path} className="sf-node">
        <div className="sf-row" role="button" onClick={() => toggleFolder(node.path)}>
          <i className={`mdi mdi-chevron-${open ? 'down' : 'right'} sf-caret`} />
          <i className={`mdi ${icon} me-1`} />
          <span className="fw-bold">{node.name}</span>
        </div>
        {open && <div className="sf-children">{children}</div>}
      </div>
    )
  }

  // ------------------------------------------------------------- people

  const visiblePeople = useMemo(() => {
    const q = personQuery.trim().toLowerCase()
    return people.filter((p) => {
      if (scope === 'department' && p.userGroupId !== user.userGroupId) return false
      if (scope === 'branch' && p.branchId !== user.branchId) return false
      if (!q) return true
      return [p.fullname, p.username, p.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [people, personQuery, scope, user.userGroupId, user.branchId])

  const pickPerson = (person) => {
    setChosenPeople((prev) => prev.some((p) => p.id === person.id)
      ? prev.filter((p) => p.id !== person.id)
      : [...prev, person])
  }

  // ------------------------------------------------------------- send

  const send = async () => {
    setSending(true)
    setOutcome(null)
    try {
      const res = await fetch('/admin/sendFilesToUsers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: chosenPeople.map((p) => p.username),
          files: chosenFiles.map((f) => f.name),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setOutcome({ kind: 'success', message: data.message || 'Files sent.' })
      } else if (res.status === 404 && Array.isArray(data.missingFiles)) {
        // some files were skipped; the rest were delivered
        setOutcome({
          kind: 'partial',
          message: data.message || 'Some files could not be sent.',
          missing: data.missingFiles,
        })
      } else {
        setOutcome({ kind: 'error', message: data.error || data.message || 'Failed to send files.' })
      }
    } catch (err) {
      console.error('[send] send', err)
      setOutcome({ kind: 'error', message: 'Failed to send files.' })
    } finally {
      setSending(false)
    }
  }

  const startOver = () => {
    setChosenFiles([])
    setChosenPeople([])
    setOutcome(null)
    setStep(1)
  }

  const Step = ({ n, icon, label }) => (
    <li className="nav-item">
      <button
        type="button"
        className={`nav-link rounded-0 pt-2 pb-2 w-100 ${step === n ? 'active' : ''}`}
        onClick={() => setStep(n)}
        disabled={(n === 2 && chosenFiles.length === 0) || (n === 3 && chosenPeople.length === 0)}
      >
        <i className={`mdi ${icon} me-1`} />
        <span className="d-none d-sm-inline">{n}. {label}</span>
      </button>
    </li>
  )

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Send files</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              <ul className="nav nav-pills nav-justified form-wizard-header mb-3">
                <Step n={1} icon="mdi-file-multiple-outline" label="Choose files" />
                <Step n={2} icon="mdi-account-multiple-outline" label="Choose recipients" />
                <Step n={3} icon="mdi-check-circle-outline" label="Review and send" />
              </ul>

              {/* ---------------- step 1 ---------------- */}
              {step === 1 && (
                <>
                  <div className="row">
                    <div className="col-lg-7">
                      <div className="app-search mb-2">
                        <div className="position-relative">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search your files..."
                            value={fileQuery}
                            onChange={(e) => setFileQuery(e.target.value)}
                          />
                          <span className="mdi mdi-magnify search-icon" />
                        </div>
                      </div>

                      <div className="sf-tree border rounded">
                        {loadingTree && (
                          <div className="text-center py-4">
                            <div className="spinner-border text-primary" role="status" />
                          </div>
                        )}
                        {!loadingTree && treeError && (
                          <div className="alert alert-danger m-2 py-2 px-3">
                            <i className="mdi mdi-alert-circle-outline me-1" />
                            Could not load your files.{' '}
                            <button className="btn btn-link p-0 align-baseline" onClick={loadTree}>Retry</button>
                          </div>
                        )}
                        {!loadingTree && !treeError && nodes.map(renderNode).filter(Boolean).length === 0 && (
                          <div className="text-center py-5 text-muted">
                            <i className="mdi mdi-file-outline" style={{ fontSize: 32 }} />
                            <p className="mb-0 mt-2">
                              {fileQuery ? 'No files match that search.' : 'You have no files to send yet.'}
                            </p>
                          </div>
                        )}
                        {!loadingTree && !treeError && nodes.map(renderNode)}
                      </div>
                    </div>

                    <div className="col-lg-5">
                      <div className="card shadow-none border h-100 mb-0">
                        <div className="card-body">
                          <h5 className="mt-0 mb-2">
                            Selected files
                            <span className="badge bg-primary rounded-pill float-end">{chosenFiles.length}</span>
                          </h5>
                          <p className="text-muted font-13">
                            These stay selected while you browse. Each recipient gets their own copy.
                          </p>

                          {chosenFiles.length === 0 && (
                            <div className="text-center py-4">
                              <i className="mdi mdi-file-outline text-muted" style={{ fontSize: 30 }} />
                              <h5 className="mt-2 mb-1">No files selected</h5>
                              <p className="text-muted font-13 mb-0">Tick files on the left to add them here.</p>
                            </div>
                          )}

                          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {chosenFiles.map((f) => (
                              <div key={f.name} className="d-flex align-items-center border rounded p-2 mb-2">
                                <i className={`mdi ${fileIcon(f.name)} me-2 font-18`} />
                                <div className="flex-grow-1 text-truncate">
                                  <span className="d-block text-truncate" title={f.name}>{displayName(f.name)}</span>
                                  {f.batch && <span className="font-12 text-muted">{f.batch}</span>}
                                </div>
                                <button
                                  className="btn btn-sm btn-link text-danger p-0"
                                  onClick={() => pickFile(f.name, f.batch)}
                                  title="Remove"
                                >
                                  <i className="mdi mdi-close" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between mt-3 pt-3 border-top">
                    <button className="btn btn-light" disabled>
                      <i className="mdi mdi-arrow-left me-1" />Back
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={chosenFiles.length === 0}
                      onClick={() => setStep(2)}
                    >
                      Choose recipients<i className="mdi mdi-arrow-right ms-1" />
                    </button>
                  </div>
                </>
              )}

              {/* ---------------- step 2 ---------------- */}
              {step === 2 && (
                <>
                  <div className="row">
                    <div className="col-lg-7">
                      <div className="app-search mb-2">
                        <div className="position-relative">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search by name, username or email..."
                            value={personQuery}
                            onChange={(e) => setPersonQuery(e.target.value)}
                          />
                          <span className="mdi mdi-magnify search-icon" />
                        </div>
                      </div>

                      <div className="mb-2">
                        {[
                          ['department', 'My department'],
                          ['branch', 'My branch'],
                          ['everyone', 'Everyone'],
                        ].map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            className={`badge me-1 border-0 ${scope === key ? 'bg-primary text-white' : 'bg-light text-dark'}`}
                            style={{ padding: '.35rem .6rem' }}
                            onClick={() => setScope(key)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="border rounded" style={{ maxHeight: 340, overflowY: 'auto' }}>
                        {loadingPeople && (
                          <div className="text-center py-4">
                            <div className="spinner-border text-primary" role="status" />
                          </div>
                        )}
                        {!loadingPeople && peopleError && (
                          <div className="alert alert-danger m-2 py-2 px-3">
                            <i className="mdi mdi-alert-circle-outline me-1" />
                            Could not load people.{' '}
                            <button className="btn btn-link p-0 align-baseline" onClick={loadPeople}>Retry</button>
                          </div>
                        )}
                        {!loadingPeople && !peopleError && visiblePeople.length === 0 && (
                          <div className="text-center py-5 text-muted">
                            <i className="mdi mdi-account-search-outline" style={{ fontSize: 30 }} />
                            <p className="mb-0 mt-2">No one matches that.</p>
                          </div>
                        )}
                        {visiblePeople.map((p) => (
                          <div key={p.id} className="d-flex align-items-center p-2 border-bottom">
                            <span
                              className="rounded-circle bg-primary-lighten text-primary me-2 d-inline-flex align-items-center justify-content-center flex-shrink-0"
                              style={{ width: 34, height: 34, fontSize: 12, fontWeight: 600 }}
                            >
                              {initialsOf(p.fullname || p.username)}
                            </span>
                            <div className="flex-grow-1 text-truncate">
                              <span className="fw-bold d-block text-truncate">{p.fullname || p.username}</span>
                              <span className="font-12 text-muted text-truncate d-block">
                                {[p.username, p.archive_category?.name, p.branch?.name].filter(Boolean).join(' · ')}
                              </span>
                            </div>
                            <input
                              className="form-check-input flex-shrink-0"
                              type="checkbox"
                              checked={chosenPeople.some((c) => c.id === p.id)}
                              onChange={() => pickPerson(p)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="col-lg-5">
                      <div className="card shadow-none border h-100 mb-0">
                        <div className="card-body">
                          <h5 className="mt-0 mb-2">
                            Recipients
                            <span className="badge bg-primary rounded-pill float-end">{chosenPeople.length}</span>
                          </h5>
                          <p className="text-muted font-13">Each one receives their own copy in their folder.</p>

                          {chosenPeople.length === 0 && (
                            <div className="text-center py-4">
                              <i className="mdi mdi-account-multiple-outline text-muted" style={{ fontSize: 30 }} />
                              <h5 className="mt-2 mb-1">No one selected</h5>
                              <p className="text-muted font-13 mb-0">Tick people on the left.</p>
                            </div>
                          )}

                          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {chosenPeople.map((p) => (
                              <div key={p.id} className="d-flex align-items-center border rounded p-2 mb-2">
                                <span
                                  className="rounded-circle bg-primary-lighten text-primary me-2 d-inline-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: 30, height: 30, fontSize: 11, fontWeight: 600 }}
                                >
                                  {initialsOf(p.fullname || p.username)}
                                </span>
                                <div className="flex-grow-1 text-truncate">
                                  <span className="d-block text-truncate">{p.fullname || p.username}</span>
                                  <span className="font-12 text-muted">
                                    {[p.archive_category?.name, p.branch?.name].filter(Boolean).join(' · ')}
                                  </span>
                                </div>
                                <button
                                  className="btn btn-sm btn-link text-danger p-0"
                                  onClick={() => pickPerson(p)}
                                  title="Remove"
                                >
                                  <i className="mdi mdi-close" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between mt-3 pt-3 border-top">
                    <button className="btn btn-light" onClick={() => setStep(1)}>
                      <i className="mdi mdi-arrow-left me-1" />Back
                    </button>
                    <button
                      className="btn btn-primary"
                      disabled={chosenPeople.length === 0}
                      onClick={() => setStep(3)}
                    >
                      Review<i className="mdi mdi-arrow-right ms-1" />
                    </button>
                  </div>
                </>
              )}

              {/* ---------------- step 3 ---------------- */}
              {step === 3 && (
                <div className="row">
                  <div className="col-lg-8 offset-lg-2">

                    {!outcome && (
                      <>
                        <div className="text-center mb-3">
                          <div className="avatar-lg m-auto">
                            <span className="avatar-title bg-primary-lighten text-primary rounded-circle">
                              <i className="mdi mdi-send-check-outline" style={{ fontSize: 26 }} />
                            </span>
                          </div>
                          <h4 className="mt-2">
                            Send {chosenFiles.length} file{chosenFiles.length === 1 ? '' : 's'} to{' '}
                            {chosenPeople.length} {chosenPeople.length === 1 ? 'person' : 'people'}
                          </h4>
                          <p className="text-muted">
                            A copy of each file is placed in each recipient&rsquo;s folder.
                          </p>
                        </div>

                        <div className="card shadow-none border mb-2">
                          <div className="card-body py-2">
                            <h5 className="mt-0 mb-2 font-14">
                              Files
                              <button className="btn btn-link float-end font-13 fw-normal p-0" onClick={() => setStep(1)}>
                                Change
                              </button>
                            </h5>
                            {chosenFiles.map((f) => (
                              <p className="mb-1" key={f.name}>
                                <i className={`mdi ${fileIcon(f.name)} me-1`} />
                                {displayName(f.name)}
                                {f.batch && <span className="text-muted font-12 ms-1">({f.batch})</span>}
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="card shadow-none border mb-3">
                          <div className="card-body py-2">
                            <h5 className="mt-0 mb-2 font-14">
                              Recipients
                              <button className="btn btn-link float-end font-13 fw-normal p-0" onClick={() => setStep(2)}>
                                Change
                              </button>
                            </h5>
                            {chosenPeople.map((p) => (
                              <p className="mb-1" key={p.id}>
                                <i className="mdi mdi-account-outline me-1" />
                                {p.fullname || p.username}
                                <span className="text-muted font-12 ms-1">({p.username})</span>
                              </p>
                            ))}
                          </div>
                        </div>

                        <div className="d-flex justify-content-between pt-3 border-top">
                          <button className="btn btn-light" onClick={() => setStep(2)} disabled={sending}>
                            <i className="mdi mdi-arrow-left me-1" />Back
                          </button>
                          <button className="btn btn-primary" onClick={send} disabled={sending}>
                            {sending
                              ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Sending&hellip;</>
                              : <><i className="mdi mdi-send me-1" />Send files</>}
                          </button>
                        </div>
                      </>
                    )}

                    {outcome && (
                      <div className="text-center py-3">
                        {outcome.kind === 'success' && (
                          <>
                            <div className="avatar-lg m-auto">
                              <span className="avatar-title bg-success-lighten text-success rounded-circle">
                                <i className="mdi mdi-check" style={{ fontSize: 28 }} />
                              </span>
                            </div>
                            <h4 className="mt-2">Sent</h4>
                            <p className="text-muted">
                              {chosenFiles.length} file{chosenFiles.length === 1 ? '' : 's'} delivered to{' '}
                              {chosenPeople.length} {chosenPeople.length === 1 ? 'person' : 'people'}.
                            </p>
                          </>
                        )}

                        {outcome.kind === 'partial' && (
                          <>
                            <div className="avatar-lg m-auto">
                              <span className="avatar-title bg-warning-lighten text-warning rounded-circle">
                                <i className="mdi mdi-alert-outline" style={{ fontSize: 28 }} />
                              </span>
                            </div>
                            <h4 className="mt-2">Partly sent</h4>
                            <p className="text-muted mb-2">
                              These files could not be found and were skipped:
                            </p>
                            <ul className="list-unstyled text-muted">
                              {outcome.missing.map((m) => <li key={m}>{displayName(m)}</li>)}
                            </ul>
                          </>
                        )}

                        {outcome.kind === 'error' && (
                          <>
                            <div className="avatar-lg m-auto">
                              <span className="avatar-title bg-danger-lighten text-danger rounded-circle">
                                <i className="mdi mdi-close" style={{ fontSize: 28 }} />
                              </span>
                            </div>
                            <h4 className="mt-2">Nothing was sent</h4>
                            <p className="text-muted">{outcome.message}</p>
                          </>
                        )}

                        <div className="mt-3">
                          {outcome.kind === 'error' ? (
                            <>
                              <button className="btn btn-light me-1" onClick={() => setOutcome(null)}>
                                Back to review
                              </button>
                              <button className="btn btn-primary" onClick={send} disabled={sending}>
                                Try again
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-primary" onClick={startOver}>
                              <i className="mdi mdi-send-outline me-1" />Send something else
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const PAGE_CSS = `
.sf-tree{max-height:420px;overflow:auto;padding:8px}
.sf-children{margin-left:18px;padding-left:10px;border-left:1px dashed rgba(0,0,0,.12)}
.sf-row{display:flex;align-items:center;padding:5px 6px;border-radius:4px;white-space:nowrap}
.sf-row:hover{background:#f1f3fa}
.sf-caret{width:16px;color:#98a6ad;flex:none}
.form-wizard-header .nav-link{border:0;background:none}
.form-wizard-header .nav-link:disabled{opacity:.5}
`
