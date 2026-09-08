import React, { useEffect, useMemo, useState } from 'react'
import Modal from '../components/Modal'

/*
 * Branches
 *
 * Rebuilt on Hyper markup. Same ten columns, same client-side search over name,
 * contact person and address, same paging, same seven required fields, and the
 * same payload - including the department, which is still submitted as a name
 * resolved from the selected id rather than as an id.
 */

const EMPTY = {
  id: null, name: '', person: '', address: '', email: '', phone: '', reg: '', departmentId: '',
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Branches() {
  const [branches, setBranches] = useState([])
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

  useEffect(() => { fetchGroups(); fetchBranches() }, [])
  useEffect(() => { setPage(1) }, [search, rowsPerPage])

  const fetchGroups = async () => {
    try {
      const res = await fetch('/admin/retrieve-user-group', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setGroups(data.records || [])
    } catch (err) { console.error('[branches] departments', err) }
  }

  const fetchBranches = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/retrieve-branches', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setBranches(data.records || [])
    } catch (err) { console.error('[branches] list', err) }
    setLoading(false)
  }

  // Same three fields the page has always searched.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return branches
    return branches.filter((b) => (
      (b.name || '').toLowerCase().includes(q) ||
      (b.contact_person || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q)
    ))
  }, [search, branches])

  const totalRows = filtered.length
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const firstRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const lastRow = Math.min(page * rowsPerPage, totalRows)
  const paginatedRows = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  const openCreate = () => { setForm(EMPTY); setErrors({}); setModalOpen(true) }

  const openEdit = (r) => {
    /*
     * Branch records carry `departmentNames` (a string) but no departmentId, so
     * reading r.departmentId always came back undefined and the select opened
     * blank - forcing the department to be re-picked on every edit even though
     * it is a required field. Resolve it from the name instead.
     */
    const firstName = String(r.departmentNames || '').split(',')[0].trim()
    const match = groups.find((g) => g.name === firstName)

    setForm({
      id: r.id,
      name: r.name || '',
      person: r.contact_person || '',
      address: r.address || '',
      email: r.email || '',
      phone: r.phone_number || '',
      reg: r.reg_number || '',
      departmentId: match ? match.id : '',
    })
    setErrors({})
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setErrors({}) }

  const handleSave = async () => {
    // Every field required, each with its own message, exactly as before.
    const next = {}
    if (!(form.name || '').trim()) next.name = 'Name is required'
    if (!(form.person || '').trim()) next.person = 'Contact person is required'
    if (!(form.address || '').trim()) next.address = 'Address is required'
    if (!(form.email || '').trim()) next.email = 'Email is required'
    if (!(form.phone || '').trim()) next.phone = 'Phone is required'
    if (!(form.reg || '').trim()) next.reg = 'Registration is required'
    if (!form.departmentId) next.departmentId = 'Please select a valid department'
    setErrors(next)
    if (Object.keys(next).length > 0) {
      showToast(Object.values(next)[0], 'error')
      return
    }

    /*
     * Sent as JSON, not FormData.
     *
     * `/admin/branches` reads req.body and has no multer middleware, so a
     * multipart body arrived unparsed and every save came back "Unable to
     * create branch" - saving a branch has never worked from this page. Same
     * endpoint, same method, same field names; only the encoding changed.
     */
    const payload = {
      name: form.name,
      person: form.person,
      address: form.address,
      phone: form.phone,
      reg: form.reg,
      email: form.email,
      // The department is submitted as a name, not an id.
      departmentName: groups.find((g) => String(g.id) === String(form.departmentId))?.name || '',
      btnAction: form.id ? 'Update' : 'Create',
      updateRecord: form.id || '',
    }

    setSaving(true)
    try {
      const res = await fetch('/admin/branches', {
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
      fetchBranches()
    } catch (err) {
      console.error('[branches] save', err)
      showToast('Failed', 'error')
      setErrors({ general: 'Failed to save' })
    }
    setSaving(false)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      // JSON for the same reason as the save above.
      const res = await fetch('/admin/remove-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteRecord: deleteTarget.id }),
        credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) { showToast('Delete failed', 'error'); setDeleting(false); return }
      showToast(data.message || 'Deleted', 'success')
      setDeleteTarget(null)
      fetchBranches()
    } catch (err) {
      console.error('[branches] delete', err)
      showToast('Delete failed', 'error')
    }
    setDeleting(false)
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="col-md-6 mb-2">
      <label className="form-label" htmlFor={`br-${key}`}>
        {label}<span className="text-danger">*</span>
      </label>
      <input
        id={`br-${key}`}
        type={type}
        className={`form-control${errors[key] ? ' is-invalid' : ''}`}
        placeholder={placeholder}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
      {errors[key] && <div className="invalid-feedback d-block">{errors[key]}</div>}
    </div>
  )

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Branches</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              <p className="text-muted mb-3">
                Branches are the top level of the archive. Every user belongs to one.
              </p>

              <div className="row mb-2">
                <div className="col-sm-5">
                  <button className="btn btn-primary mb-2" onClick={openCreate}>
                    <i className="mdi mdi-plus-circle me-1" />Add branch
                  </button>
                </div>
                <div className="col-sm-7">
                  <div className="text-sm-end">
                    <div className="d-inline-flex align-items-center me-2 mb-2">
                      <label className="me-1 mb-0 font-13 text-muted" htmlFor="br-rows">Rows</label>
                      <select
                        id="br-rows"
                        className="form-select form-select-sm"
                        style={{ width: 76 }}
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      >
                        {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="d-inline-block mb-2" style={{ minWidth: 240 }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Name, contact person or address"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Ten columns: the widest table in the app, so it scrolls rather
                  than squeezing every cell below readability. */}
              <div className="table-responsive">
                <table className="table table-centered table-nowrap table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Name</th>
                      <th>Contact person</th>
                      <th>Address</th>
                      <th>Email</th>
                      <th>Phone number</th>
                      <th>Registration number</th>
                      <th>Departments</th>
                      <th>Created on</th>
                      <th style={{ width: 90 }} className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && paginatedRows.map((r, idx) => (
                      <tr key={r.id}>
                        <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                        <td className="fw-semibold">{r.name}</td>
                        <td>{r.contact_person}</td>
                        {/* the one long field: truncated, full value on hover */}
                        <td
                          className="text-muted text-truncate"
                          style={{ maxWidth: 200 }}
                          title={r.address || ''}
                        >
                          {r.address}
                        </td>
                        <td className="text-muted">{r.email}</td>
                        <td className="text-muted">{r.phone_number}</td>
                        <td className="text-muted">{r.reg_number}</td>
                        <td>
                          {/* "No departments" is a state, not a value */}
                          {r.departmentNames
                            ? r.departmentNames
                            : <span className="text-muted fst-italic">No departments</span>}
                        </td>
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
                  <i className="mdi mdi-domain text-muted" style={{ fontSize: 34 }} />
                  <h5 className="mt-2 mb-1">No branches found</h5>
                  <p className="text-muted mb-0">
                    {search ? 'Try a different search term.' : 'Add a branch to get started.'}
                  </p>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted font-13">
                  Showing {firstRow} to {lastRow} of {totalRows} branch{totalRows === 1 ? '' : 'es'}
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
          title={form.id ? 'Edit branch' : 'Create branch'}
          onClose={closeModal}
          busy={saving}
          size="lg"
          scrollable
          footer={
            <>
              <button className="btn btn-light" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create branch')}
              </button>
            </>
          }
        >
          <div className="row">
            {field('name', 'Name', 'text', 'e.g. Kumasi Branch')}
            {field('person', 'Contact person', 'text', 'Who to contact')}
            {field('address', 'Address', 'text', 'Street address')}
            {field('email', 'Email', 'email', 'branch@company.com')}
            {field('phone', 'Phone number', 'text', 'e.g. 024 000 0000')}
            {field('reg', 'Registration number', 'text', 'Company registration')}

            <div className="col-md-6 mb-2">
              <label className="form-label" htmlFor="br-dept">
                Department<span className="text-danger">*</span>
              </label>
              <select
                id="br-dept"
                className={`form-select${errors.departmentId ? ' is-invalid' : ''}`}
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                <option value="">--- Select department ----</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {errors.departmentId && <div className="invalid-feedback d-block">{errors.departmentId}</div>}
            </div>
          </div>

          {errors.general && (
            <div className="alert alert-danger py-2 px-3 mb-0 mt-2">
              <i className="mdi mdi-alert-circle-outline me-1" />{errors.general}
            </div>
          )}
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="Delete branch?"
          onClose={() => setDeleteTarget(null)}
          busy={deleting}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                {deleting && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {deleting ? 'Deleting…' : 'Delete branch'}
              </button>
            </>
          }
        >
          <p><strong>{deleteTarget.name}</strong> will be removed permanently.</p>
          <div className="alert alert-warning py-2 px-3 mb-0">
            <i className="mdi mdi-alert-outline me-1" />
            Users assigned to this branch will need to be given a new one before they can be
            edited again.
          </div>
        </Modal>
      )}
    </>
  )
}
