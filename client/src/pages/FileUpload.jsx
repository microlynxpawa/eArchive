import React, { useState, useRef } from 'react'

function ShowToast(message, type = 'success') {
  if (window.Toast && typeof window.Toast.fire === 'function') {
    window.Toast.fire({ icon: type === 'danger' ? 'error' : type, title: message })
    return
  }
  if (window.Swal && typeof window.Swal.fire === 'function') {
    window.Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: type === 'danger' ? 'error' : type, title: message })
    return
  }
  // minimal DOM toast
  const existing = document.getElementById('customToast')
  if (existing) existing.remove()
  const toast = document.createElement('div')
  toast.id = 'customToast'
  toast.style.position = 'fixed'
  toast.style.top = '30px'
  toast.style.right = '30px'
  toast.style.zIndex = 9999
  toast.style.minWidth = '200px'
  toast.innerHTML = `<div style="padding:12px 16px;border-radius:6px;color:#fff;background:${type==='danger'?'#dc3545':'#198754'}">${message}</div>`
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000)
}

export default function FileUpload() {
  // Single upload state
  const [singleFile, setSingleFile] = useState(null)
  const [singleName, setSingleName] = useState('')
  const [singleUploading, setSingleUploading] = useState(false)
  const dropRef = useRef(null)

  // Multiple upload state
  const [multiFiles, setMultiFiles] = useState([]) // { file, customName }
  const [batchName, setBatchName] = useState('')
  const [multiUploading, setMultiUploading] = useState(false)

  // Drag & drop handlers for single file
  function onDropSingle(e) {
    e.preventDefault()
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (f) handleSingleSelect(f)
  }

  function handleSingleSelect(file) {
    // enforce single file and accepted types (jpg,png,pdf)
    const allowed = ['image/jpeg','image/png','application/pdf','image/jpg']
    if (!allowed.includes(file.type)) {
      ShowToast('Unsupported file type (allowed: jpg, png, pdf)', 'danger')
      return
    }
    setSingleFile(file)
    if (!singleName) setSingleName(file.name.replace(/\.[^/.]+$/, ''))
  }

  async function submitSingle(e) {
    e && e.preventDefault()
    if (!singleFile) { ShowToast('Please select a file', 'danger'); return }
    setSingleUploading(true)
    const fd = new FormData()
    fd.append('file', singleFile)
    const ext = singleFile.name.substring(singleFile.name.lastIndexOf('.'))
    const finalName = singleName ? `${singleName}${ext}` : singleFile.name
    fd.append('fileName', finalName)
    try {
      const resp = await fetch('http://localhost:4801/admin/uploadFile', { method: 'POST', credentials: 'include', body: fd })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) {
        ShowToast(data.message || 'File uploaded', 'success')
        setSingleFile(null); setSingleName('')
        if (dropRef.current) dropRef.current.value = ''
      } else {
        ShowToast((data && data.message) || 'Upload failed', 'danger')
      }
    } catch (err) {
      console.error(err)
      ShowToast('Upload failed (network)', 'danger')
    } finally { setSingleUploading(false) }
  }

  // Multiple handlers
  function onMultiFilesChange(e) {
    const files = Array.from(e.target.files || [])
    const mapped = files.map(f => ({ file: f, customName: f.name.replace(/\.[^/.]+$/, '') }))
    setMultiFiles(mapped)
  }

  function removeMulti(index) {
    const copy = [...multiFiles]; copy.splice(index,1); setMultiFiles(copy)
  }

  function updateCustomName(idx, val) {
    const copy = [...multiFiles]; copy[idx] = { ...copy[idx], customName: val }; setMultiFiles(copy)
  }

  async function submitMulti(e) {
    e && e.preventDefault()
    if (!multiFiles.length) { ShowToast('Please select files', 'danger'); return }
    setMultiUploading(true)
    const fd = new FormData()
    multiFiles.forEach((m, idx) => {
      const base = (m.customName || m.file.name.replace(/\.[^/.]+$/, '')).replace(/[^a-zA-Z0-9@\-_]/g, '_')
      let final = base
      if (batchName) final += `@${batchName.replace(/[^a-zA-Z0-9\-_]/g, '_')}`
      const ext = m.file.name.substring(m.file.name.lastIndexOf('.'))
      if (!final.toLowerCase().endsWith(ext.toLowerCase())) final += ext
      fd.append('files', m.file)
      fd.append(`customNames[${idx}]`, final)
      fd.append(`originalNames[${idx}]`, m.file.name)
    })
    try {
      const resp = await fetch('http://localhost:4801/admin/uploadMultipleFiles', { method: 'POST', credentials: 'include', body: fd })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok) {
        ShowToast(data.message || 'Files uploaded', 'success')
        setMultiFiles([]); setBatchName('')
        // clear input
        const el = document.getElementById('multiFiles'); if (el) el.value = ''
      } else {
        ShowToast((data && data.message) || 'Upload failed', 'danger')
      }
    } catch (err) {
      console.error(err)
      ShowToast('Upload failed (network)', 'danger')
    } finally { setMultiUploading(false) }
  }

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-body">
          <ul className="nav nav-tabs mb-3" role="tablist">
            <li className="nav-item"><button className="nav-link active" data-bs-target="#single" data-bs-toggle="tab">Single Upload</button></li>
            <li className="nav-item"><button className="nav-link" data-bs-target="#multiple" data-bs-toggle="tab">Multiple Upload</button></li>
          </ul>
          <div className="tab-content">
            <div className="tab-pane fade show active" id="single">
              <div className="mb-3">
                <div onDrop={onDropSingle} onDragOver={e=>e.preventDefault()} style={{border:'2px dashed #dbdade', padding:20, textAlign:'center', borderRadius:6}}>
                  <div>Drop file here or click to upload</div>
                  <div className="small text-muted">(Select Only one file at a time please.)</div>
                  <input ref={dropRef} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{marginTop:12}} onChange={(e)=>onDropSingle(e)} />
                </div>
              </div>
              <div className="row mt-3">
                <div className="col-md-10">
                  <label className="form-label">File name</label>
                  <input className="form-control" value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="e.g. new-file" />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button className="btn btn-primary w-100" onClick={submitSingle} disabled={singleUploading}>{singleUploading? 'Uploading...':'Store'}</button>
                </div>
              </div>
              {singleFile && (
                <div className="mt-3">
                  <strong>Selected:</strong> {singleFile.name} ({Math.round(singleFile.size/1024)} KB)
                </div>
              )}
            </div>

            <div className="tab-pane fade" id="multiple">
              <form onSubmit={submitMulti}>
                <div className="mb-3">
                  <label htmlFor="multiFiles" className="form-label">Select files</label>
                  <div className="input-group">
                    {/* visually-hidden native input to match server template */}
                    <input id="multiFiles" name="files" className="form-control visually-hidden" type="file" multiple accept=".jpg,.jpeg,.png,.pdf" onChange={onMultiFilesChange} />
                    <button type="button" id="customFileBtn" className="btn btn-outline-primary" onClick={() => document.getElementById('multiFiles')?.click()}>
                      <i className="bi bi-upload"></i> Choose Files
                    </button>
                  </div>
                  <div id="fileCountDisplay" className="form-text mt-2 text-primary">{multiFiles.length ? `${multiFiles.length} file(s) selected` : ''}</div>
                </div>
                <div className="mb-3">
                  <label htmlFor="batchName" className="form-label text-dark">Batch Name (optional, for grouping)</label>
                  <input id="batchName" name="batchName" className="form-control" value={batchName} onChange={e=>setBatchName(e.target.value)} placeholder="e.g. July Reports" />
                </div>
                <div className="mb-3">
                  <button className="btn btn-success" type="submit" disabled={multiUploading}>{multiUploading? 'Uploading...':'Upload All'}</button>
                </div>

                <div className="row g-3" id="multiPreview">
                  {multiFiles.map((m, idx)=> (
                    <div className="col-md-4" key={idx}>
                      <div className="card p-2 position-relative">
                        <button type="button" className="btn-close position-absolute" style={{right:8,top:8}} aria-label="Remove" onClick={()=>removeMulti(idx)} />
                        <div className="card-body text-center pt-4">
                          {m.file.type.startsWith('image/') ? <img src={URL.createObjectURL(m.file)} alt="thumb" style={{maxWidth:80,maxHeight:80}} /> : m.file.type==='application/pdf' ? <i className="bi bi-file-earmark-pdf" style={{fontSize:'3rem', color:'#d9534f'}} /> : <i className="bi bi-file-earmark" style={{fontSize:'3rem', color:'#6c757d'}} />}
                          <div className="small text-muted mt-2" title={m.file.name}>{m.file.name.length>20? m.file.name.substring(0,17)+'...': m.file.name}</div>
                          <input className="form-control mt-2" value={m.customName} onChange={e=>updateCustomName(idx, e.target.value)} placeholder="Custom name (optional)" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
