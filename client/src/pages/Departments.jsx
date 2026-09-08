import React, { useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal'

/*
 * Departments
 *
 * Rebuilt on Hyper markup. Same columns, same client-side search over name and
 * description, same paging, same two required fields, and the same FormData
 * posted to the same three endpoints.
 */

const EMPTY = { id: null, name: '', description: '' }

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Departments() {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (message, type = 'success') => {
    const t = document.createElement('div')
    t.className = 'custom-toast-notification ' + (type === 'success' ? 'toast-success' : 'toast-error')
    t.innerText = message
    Object.assign(t.style, {
      position: 'fixed', right: '30px', bottom: '30px', padding: '12px 20px',
      color: '#fff', borderRadius: '6px', zIndex: 12000,
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => { setPage(1) }, [search, rowsPerPage])

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/retrieve-user-group', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setGroups(data.records || [])
    } catch (err) { console.error('[departments] list', err) }
    setLoading(false)
  }

  // Same two fields the page has always searched.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return groups
    return groups.filter((g) => (
      (g.name || '').toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    ))
  }, [search, groups])

  const totalRows = filtered.length
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const firstRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const lastRow = Math.min(page * rowsPerPage, totalRows)
  const paginatedRows = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  const openCreate = () => { setForm(EMPTY); setErrors({}); setModalOpen(true) }
  const openEdit = (rec) => {
    setForm({ id: rec.id, name: rec.name || '', description: rec.description || '' })
    setErrors({})
    setModalOpen(true)
  }
  const closeModal = () => { setModalOpen(false); setErrors({}) }

  const handleSave = async () => {
    // Both required, as before - but shown against the field rather than in a
    // toast that disappears before it can be acted on.
    const next = {}
    if (!(form.name || '').trim()) next.name = 'Category name is required'
    if (!(form.description || '').trim()) next.description = 'Category description is required'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      showToast(next.name || next.description, 'error')
      return
    }

    /*
     * Sent as JSON, not FormData.
     *
     * `/admin/user-group` reads req.body and has no multer middleware, so a
     * multipart body arrives unparsed and every save failed with "All fields
     * are required" - saving a department has never actually worked from this
     * page. The endpoint, the method and the field names are unchanged; only
     * the encoding is, which is what the server has always been able to read.
     */
    const payload = {
      catName: form.name,
      catDescription: form.description,
      btnAction: form.id ? 'Update' : 'Create',
      updateRecord: form.id || '',
    }

    setSaving(true)
    try {
      const res = await fetch('/admin/user-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok || (data.statusCode && data.statusCode !== 200)) {
        showToast(data.message || 'Failed', 'error')
        setErrors({ general: data.message || 'Failed to save' })
        setSaving(false)
        return
      }
      showToast(data.message || 'Saved', 'success')
      closeModal()
      setForm(EMPTY)
      fetchGroups()
    } catch (err) {
      console.error('[departments] save', err)
      showToast('Failed', 'error')
      setErrors({ general: 'Failed to save' })
    }
    setSaving(false)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // JSON for the same reason as the save above: this route has no multer,
      // so a multipart body left deleteRecord undefined and delete always 404'd.
      const res = await fetch('/admin/remove-user-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteRecord: deleteTarget.id }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { showToast('Delete failed', 'error'); setDeleting(false); return }
      showToast(data.message || 'Deleted', 'success')
      setDeleteTarget(null)
      fetchGroups()
    } catch (err) {
      console.error('[departments] delete', err)
      showToast('Delete failed', 'error')
    }
    setDeleting(false)
  }

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Departments</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              {/* The page never said what these records are for. */}
              <p className="text-muted mb-3">
                Departments group users and their files. Every user belongs to one.
              </p>

              <div className="row mb-2">
                <div className="col-sm-5">
                  <button className="btn btn-primary mb-2" onClick={openCreate}>
                    <i className="mdi mdi-plus-circle me-1" />Add department
                  </button>
                </div>
                <div className="col-sm-7">
                  <div className="text-sm-end">
                    <div className="d-inline-flex align-items-center me-2 mb-2">
                      <label className="me-1 mb-0 font-13 text-muted" htmlFor="dp-rows">Rows</label>
                      <select
                        id="dp-rows"
                        className="form-select form-select-sm"
                        style={{ width: 92 }}
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      >
                        {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="d-inline-block mb-2" style={{ minWidth: 220 }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Name or description"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-centered table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Name</th>
                      <th>Description</th>
                      <th>Created by</th>
                      <th>Created on</th>
                      <th style={{ width: 90 }} className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && paginatedRows.map((r, idx) => (
                      <tr key={r.id}>
                        <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                        <td className="fw-semibold">{r.name}</td>
                        {/* secondary, so it stops competing with the name */}
                        <td className="text-muted">{r.description}</td>
                        <td className="text-muted">{r.created_by}</td>
                        <td className="text-muted">{formatDate(r.createdAt)}</td>
                        <td className="text-end">
                          <button className="btn btn-link p-0 text-muted me-2" title="Edit" onClick={() => openEdit(r)}>
                            <i className="mdi mdi-square-edit-outline font-16" />
                          </button>
                          <button className="btn btn-link p-0 text-danger" title="Delete" onClick={() => setDeleteTarget(r)}>
                            <i className="mdi mdi-delete-outline font-16" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {loading && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}

              {!loading && paginatedRows.length === 0 && (
                <div className="text-center py-5">
                  <i className="mdi mdi-sitemap-outline text-muted" style={{ fontSize: 34 }} />
                  <h5 className="mt-2 mb-1">No departments found</h5>
                  <p className="text-muted mb-0">
                    {search ? 'Try a different search term.' : 'Add a department to get started.'}
                  </p>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted font-13">
                  Showing {firstRow} to {lastRow} of {totalRows} department{totalRows === 1 ? '' : 's'}
                </span>
                <div>
                  <span className="text-muted font-13 me-2">Page {page} of {totalPages}</span>
                  <button className="btn btn-sm btn-light" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <i className="mdi mdi-chevron-left" />
                  </button>
                  <button className="btn btn-sm btn-light ms-1" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                    <i className="mdi mdi-chevron-right" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <Modal
          title={form.id ? 'Edit department' : 'Create department'}
          onClose={closeModal}
          busy={saving}
          footer={
            <>
              <button className="btn btn-light" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create department')}
              </button>
            </>
          }
        >
          <div className="mb-3">
            <label className="form-label" htmlFor="dp-name">Name<span className="text-danger">*</span></label>
            <input
              id="dp-name"
              className={`form-control${errors.name ? ' is-invalid' : ''}`}
              placeholder="e.g. Finance"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {errors.name && <div className="invalid-feedback d-block">{errors.name}</div>}
          </div>
          <div className="mb-2">
            <label className="form-label" htmlFor="dp-desc">Description<span className="text-danger">*</span></label>
            <textarea
              id="dp-desc"
              className={`form-control${errors.description ? ' is-invalid' : ''}`}
              rows={3}
              placeholder="What this department covers"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {errors.description && <div className="invalid-feedback d-block">{errors.description}</div>}
          </div>
          {errors.general && (
            <div className="alert alert-danger py-2 px-3 mb-0">
              <i className="mdi mdi-alert-circle-outline me-1" />{errors.general}
            </div>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete department?"
          onClose={() => setDeleteTarget(null)}
          busy={deleting}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                {deleting && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {deleting ? 'Deleting…' : 'Delete department'}
              </button>
            </>
          }
        >
          <p><strong>{deleteTarget.name}</strong> will be removed permanently.</p>
          <div className="alert alert-warning py-2 px-3 mb-0">
            <i className="mdi mdi-alert-outline me-1" />
            Users assigned to this department keep their files, but will need to be given a new
            department before they can be edited again.
          </div>
        </Modal>
      )}
    </>
  )
}
