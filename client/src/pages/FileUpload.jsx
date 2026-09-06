import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { LayoutContext } from '../components/Layout'

/*
 * Upload
 *
 * Rebuilt on Hyper markup. The rules are unchanged: JPG, PNG and PDF only, an
 * optional custom name per file, and an optional batch name of at most 25
 * characters that may not contain an underscore.
 *
 * The final saved name is now shown per file before uploading. Previously only
 * the single-file tab did that, so in the multiple tab the batch suffix and the
 * character substitutions were invisible until after the upload.
 */

const ACCEPT = '.jpg,.jpeg,.png,.pdf'
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
const BATCH_MAX = 25

// ---------------------------------------------------------------- helpers

function baseName(name) {
  return name.replace(/\.[^/.]+$/, '')
}

function extensionOf(name) {
  const i = name.lastIndexOf('.')
  return i === -1 ? '' : name.slice(i)
}

function humanSize(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Exactly the assembly the server side expects, so the preview cannot drift
// from what is actually sent.
function finalName(custom, original, batch) {
  const base = (custom || baseName(original)).replace(/[^a-zA-Z0-9@\-_]/g, '_')
  const ext = extensionOf(original)
  let out = base
  if (batch) out += `@${batch.replace(/[^a-zA-Z0-9\-_]/g, '_')}`
  if (!out.toLowerCase().endsWith(ext.toLowerCase())) out += ext
  return out
}

function iconFor(file) {
  if (file.type === 'application/pdf') return 'mdi-file-pdf-box text-danger'
  if (file.type.startsWith('image/')) return 'mdi-file-image-box text-info'
  return 'mdi-file-outline text-muted'
}

function validateBatch(value) {
  if (value.includes('_')) return 'Batch name cannot contain the _ character.'
  if (value.length > BATCH_MAX) return `Batch name cannot exceed ${BATCH_MAX} characters.`
  return ''
}

// XHR rather than fetch, so real upload progress is available.
function upload(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url, true)
    xhr.withCredentials = true

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* not json */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data)
      else reject(new Error(data.message || `Upload failed (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Upload failed. Check your connection.'))
    xhr.send(formData)
  })
}

// ---------------------------------------------------------------- component

export default function FileUpload() {
  const { user = {} } = useContext(LayoutContext)

  const [tab, setTab] = useState('single')
  const [toast, setToast] = useState(null)

  const [single, setSingle] = useState(null)
  const [singleName, setSingleName] = useState('')
  const [singleBusy, setSingleBusy] = useState(false)
  const [singleProgress, setSingleProgress] = useState(0)
  const [singleDone, setSingleDone] = useState(false)

  const [items, setItems] = useState([])
  const [batch, setBatch] = useState('')
  const [batchError, setBatchError] = useState('')
  const [multiBusy, setMultiBusy] = useState(false)
  const [multiProgress, setMultiProgress] = useState(0)

  const [rejected, setRejected] = useState(null)
  const [dragging, setDragging] = useState(null) // 'single' | 'multi' | null

  const singleInput = useRef(null)
  const multiInput = useRef(null)

  const destination = [user.branch?.name, user.archive_category?.name, user.username]
    .filter(Boolean)
    .join(' / ')

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4000)
  }, [])

  // ------------------------------------------------------------- single

  const acceptSingle = (file) => {
    if (!file) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setRejected('Unsupported file type. Allowed: JPG, PNG, PDF.')
      return
    }
    setRejected(null)
    setSingleDone(false)
    setSingle(file)
    setSingleName(baseName(file.name))
  }

  const clearSingle = () => {
    setSingle(null)
    setSingleName('')
    setSingleProgress(0)
    setSingleDone(false)
    if (singleInput.current) singleInput.current.value = ''
  }

  const submitSingle = async () => {
    if (!single) return notify('Please select a file.', 'error')
    setSingleBusy(true)
    setSingleProgress(0)
    setSingleDone(false)
    try {
      const fd = new FormData()
      fd.append('file', single)
      fd.append('fileName', `${(singleName.trim() || baseName(single.name))}${extensionOf(single.name)}`)
      const data = await upload('/admin/uploadFile', fd, setSingleProgress)
      notify(data.message || 'File uploaded.')
      setSingleDone(true)
      clearSingle()
    } catch (err) {
      console.error('[upload] single', err)
      notify(err.message || 'Upload failed.', 'error')
    } finally {
      setSingleBusy(false)
    }
  }

  // ------------------------------------------------------------- multiple

  const acceptMany = (fileList) => {
    const incoming = Array.from(fileList || [])
    const good = incoming.filter((f) => ALLOWED_TYPES.includes(f.type))
    const bad = incoming.length - good.length
    setRejected(bad > 0
      ? `${bad} file${bad === 1 ? ' was' : 's were'} skipped. Allowed: JPG, PNG, PDF.`
      : null)
    if (good.length === 0) return
    setItems((prev) => [
      ...prev,
      ...good.map((file) => ({
        file,
        custom: baseName(file.name),
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
      })),
    ])
  }

  const removeItem = (index) => {
    setItems((prev) => {
      const copy = [...prev]
      const [gone] = copy.splice(index, 1)
      if (gone?.preview) URL.revokeObjectURL(gone.preview)
      return copy
    })
  }

  const renameItem = (index, value) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, custom: value } : it)))
  }

  const cancelAll = () => {
    items.forEach((it) => it.preview && URL.revokeObjectURL(it.preview))
    setItems([])
    setBatch('')
    setBatchError('')
    setMultiProgress(0)
    if (multiInput.current) multiInput.current.value = ''
  }

  const onBatchChange = (value) => {
    setBatch(value)
    setBatchError(validateBatch(value))
  }

  const submitMulti = async () => {
    if (items.length === 0) return notify('Please select files.', 'error')
    const problem = validateBatch(batch)
    if (problem) {
      setBatchError(problem)
      return notify(problem, 'error')
    }

    setMultiBusy(true)
    setMultiProgress(0)
    try {
      const fd = new FormData()
      items.forEach((it, idx) => {
        fd.append('files', it.file)
        fd.append(`customNames[${idx}]`, finalName(it.custom, it.file.name, batch))
        fd.append(`originalNames[${idx}]`, it.file.name)
      })
      const data = await upload('/admin/uploadMultipleFiles', fd, setMultiProgress)
      notify(data.message || `${items.length} file(s) uploaded.`)
      cancelAll()
    } catch (err) {
      console.error('[upload] multiple', err)
      notify(err.message || 'Upload failed.', 'error')
    } finally {
      setMultiBusy(false)
    }
  }

  // ------------------------------------------------------------- drop zone

  const dropProps = (which, handler) => ({
    className: `up-drop text-center${dragging === which ? ' up-drop-over' : ''}`,
    onClick: () => (which === 'single' ? singleInput : multiInput).current?.click(),
    onDragOver: (e) => { e.preventDefault(); setDragging(which) },
    onDragLeave: () => setDragging(null),
    onDrop: (e) => {
      e.preventDefault()
      setDragging(null)
      handler(e.dataTransfer.files)
    },
  })

  const singlePreviewName = useMemo(
    () => (single ? `${(singleName.trim() || baseName(single.name))}${extensionOf(single.name)}` : ''),
    [single, singleName],
  )

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Upload</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              {destination && (
                <p className="text-muted mb-3">
                  Files are saved to your folder: <strong>{destination}</strong>
                </p>
              )}

              <ul className="nav nav-tabs nav-bordered mb-3">
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'single' ? 'active' : ''}`}
                    onClick={() => setTab('single')}
                  >
                    <i className="mdi mdi-file-outline me-1" />Single upload
                  </button>
                </li>
                <li className="nav-item">
                  <button
                    className={`nav-link ${tab === 'multi' ? 'active' : ''}`}
                    onClick={() => setTab('multi')}
                  >
                    <i className="mdi mdi-file-multiple-outline me-1" />Multiple upload
                  </button>
                </li>
              </ul>

              {rejected && (
                <div className="alert alert-danger py-2 px-3" role="alert">
                  <i className="mdi mdi-alert-circle-outline me-1" />{rejected}
                </div>
              )}

              {/* ---------------- single ---------------- */}
              {tab === 'single' && (
                <div className="row">
                  <div className="col-lg-7">
                    <div {...dropProps('single', (fl) => acceptSingle(fl[0]))}>
                      <i className="mdi mdi-cloud-upload-outline text-muted" style={{ fontSize: 44 }} />
                      <h4 className="mt-1 mb-1">Drop a file here, or click to browse</h4>
                      <span className="text-muted font-13">Accepted types: JPG, PNG, PDF</span>
                    </div>
                    <input
                      ref={singleInput}
                      type="file"
                      accept={ACCEPT}
                      className="d-none"
                      onChange={(e) => acceptSingle(e.target.files?.[0])}
                    />

                    {single && (
                      <div className="card shadow-none border mt-2 mb-0">
                        <div className="p-2">
                          <div className="row align-items-center">
                            <div className="col-auto">
                              <div className="avatar-sm">
                                <span className="avatar-title bg-light rounded">
                                  <i className={`mdi ${iconFor(single)} font-20`} />
                                </span>
                              </div>
                            </div>
                            <div className="col ps-0">
                              <span className="fw-bold d-block text-truncate" title={single.name}>
                                {single.name}
                              </span>
                              <span className="font-12 text-muted">{humanSize(single.size)}</span>
                            </div>
                            <div className="col-auto">
                              <button className="btn btn-sm btn-link text-danger" onClick={clearSingle} disabled={singleBusy}>
                                <i className="mdi mdi-close-circle-outline me-1" />Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {singleDone && !single && (
                      <div className="alert alert-success mt-2 mb-0">
                        <i className="mdi mdi-check-circle-outline me-1" />File uploaded.
                      </div>
                    )}
                  </div>

                  <div className="col-lg-5">
                    <div className="card shadow-none border h-100 mb-0">
                      <div className="card-body">
                        <label className="form-label" htmlFor="single-name">
                          File name <span className="text-muted fw-normal">(optional)</span>
                        </label>
                        <input
                          id="single-name"
                          type="text"
                          className="form-control"
                          placeholder="Leave blank to keep the original name"
                          value={singleName}
                          onChange={(e) => setSingleName(e.target.value)}
                          disabled={!single || singleBusy}
                        />
                        <p className="form-text mb-3">
                          {single
                            ? <>Saved as <strong>{singlePreviewName}</strong></>
                            : 'Choose a file to name it.'}
                        </p>

                        {singleBusy && (
                          <div className="mb-2">
                            <div className="d-flex justify-content-between font-12 mb-1">
                              <span>Uploading&hellip;</span><span>{singleProgress}%</span>
                            </div>
                            <div className="progress progress-sm">
                              <div className="progress-bar" role="progressbar" style={{ width: `${singleProgress}%` }} />
                            </div>
                          </div>
                        )}

                        <button
                          className="btn btn-success w-100"
                          onClick={submitSingle}
                          disabled={!single || singleBusy}
                        >
                          {singleBusy
                            ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Uploading&hellip;</>
                            : <><i className="mdi mdi-cloud-upload-outline me-1" />Upload file</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- multiple ---------------- */}
              {tab === 'multi' && (
                <>
                  <div className="row">
                    <div className="col-lg-7">
                      <div {...dropProps('multi', acceptMany)}>
                        <i className="mdi mdi-cloud-upload-outline text-muted" style={{ fontSize: 44 }} />
                        <h4 className="mt-1 mb-1">Drop files here, or click to browse</h4>
                        <span className="text-muted font-13">Accepted types: JPG, PNG, PDF</span>
                      </div>
                      <input
                        ref={multiInput}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="d-none"
                        onChange={(e) => acceptMany(e.target.files)}
                      />
                    </div>

                    <div className="col-lg-5">
                      <div className="card shadow-none border h-100 mb-0">
                        <div className="card-body">
                          <label className="form-label" htmlFor="batch-name">
                            Batch name{' '}
                            <span className="text-muted fw-normal">(optional, groups the files together)</span>
                          </label>
                          <input
                            id="batch-name"
                            type="text"
                            className={`form-control${batchError ? ' is-invalid' : ''}`}
                            maxLength={BATCH_MAX}
                            placeholder="e.g. July Reports"
                            value={batch}
                            onChange={(e) => onBatchChange(e.target.value)}
                            disabled={multiBusy}
                          />
                          <div className="d-flex justify-content-between">
                            <span className="form-text">Cannot contain the _ character</span>
                            <span className="form-text">{batch.length} / {BATCH_MAX}</span>
                          </div>

                          {batchError && (
                            <div className="text-danger font-13 mt-1">
                              <i className="mdi mdi-alert-circle-outline me-1" />{batchError}
                            </div>
                          )}

                          {batch && !batchError && (
                            <p className="form-text mt-2 mb-3">
                              Files will be grouped under <strong>{batch}</strong> in the archive.
                            </p>
                          )}

                          {multiBusy && (
                            <div className="my-2">
                              <div className="d-flex justify-content-between font-12 mb-1">
                                <span>Uploading {items.length} file(s)&hellip;</span><span>{multiProgress}%</span>
                              </div>
                              <div className="progress progress-sm">
                                <div className="progress-bar" role="progressbar" style={{ width: `${multiProgress}%` }} />
                              </div>
                            </div>
                          )}

                          <div className="d-flex gap-1 mt-3">
                            <button
                              className="btn btn-success flex-grow-1"
                              onClick={submitMulti}
                              disabled={items.length === 0 || !!batchError || multiBusy}
                            >
                              {multiBusy
                                ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Uploading&hellip;</>
                                : <><i className="mdi mdi-cloud-upload-outline me-1" />Upload all</>}
                            </button>
                            {items.length > 0 && (
                              <button className="btn btn-light text-danger" onClick={cancelAll} disabled={multiBusy}>
                                Cancel all
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {items.length > 0 ? (
                    <>
                      <div className="d-flex justify-content-between align-items-center mt-3 mb-2">
                        <h5 className="mb-0">{items.length} file{items.length === 1 ? '' : 's'} selected</h5>
                        <span className="text-muted font-13">Rename any file before uploading</span>
                      </div>

                      <div className="row g-2">
                        {items.map((it, idx) => (
                          <div className="col-xl-3 col-lg-4 col-md-6" key={`${it.file.name}-${idx}`}>
                            <div className="card shadow-none border m-0">
                              <div className="p-2">
                                <div className="d-flex align-items-center mb-2">
                                  <div className="avatar-sm me-2" style={{ height: '2.2rem', width: '2.2rem' }}>
                                    {it.preview ? (
                                      <img
                                        src={it.preview}
                                        alt=""
                                        className="rounded"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      />
                                    ) : (
                                      <span className="avatar-title bg-light rounded">
                                        <i className={`mdi ${iconFor(it.file)}`} />
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-grow-1 text-truncate">
                                    <span className="font-13 d-block text-truncate" title={it.file.name}>
                                      {it.file.name}
                                    </span>
                                    <span className="font-12 text-muted">{humanSize(it.file.size)}</span>
                                  </div>
                                  <button
                                    className="btn btn-sm btn-link text-danger p-0"
                                    onClick={() => removeItem(idx)}
                                    disabled={multiBusy}
                                    title="Remove"
                                  >
                                    <i className="mdi mdi-close" />
                                  </button>
                                </div>

                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Custom name (optional)"
                                  value={it.custom}
                                  onChange={(e) => renameItem(idx, e.target.value)}
                                  disabled={multiBusy}
                                />
                                <span
                                  className="font-12 text-muted d-block mt-1 text-truncate"
                                  title={finalName(it.custom, it.file.name, batchError ? '' : batch)}
                                >
                                  &rarr; {finalName(it.custom, it.file.name, batchError ? '' : batch)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-4 mt-2">
                      <i className="mdi mdi-file-outline text-muted" style={{ fontSize: 34 }} />
                      <h5 className="mt-2 mb-1">No files selected</h5>
                      <p className="text-muted mb-0">Choose files above to rename and upload them together.</p>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="toast-container position-fixed top-0 end-0 p-3" style={{ zIndex: 2050 }}>
          <div
            className={`toast show align-items-center text-white border-0 bg-${toast.type === 'error' ? 'danger' : 'success'}`}
            role="alert"
          >
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
    </>
  )
}

const PAGE_CSS = `
.up-drop{border:2px dashed #ced4da;border-radius:6px;padding:28px 16px;background:#fafbfe;cursor:pointer;
  transition:border-color .15s,background .15s}
.up-drop:hover,.up-drop-over{border-color:#727cf5;background:#f5f7ff}
.nav-tabs .nav-link{border:0;background:none}
`
