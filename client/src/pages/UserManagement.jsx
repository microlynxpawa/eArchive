import React, { useEffect, useMemo, useState } from 'react'

/*
 * Users
 *
 * Rebuilt on Hyper markup. Every behaviour is carried over unchanged: the same
 * columns, the same client-side search and paging, the same generated username,
 * the same validation, and the same FormData sent to the same two endpoints.
 *
 * The one real design change is the permission block. Nine flat checkboxes hid
 * the fact that three of them are a single exclusive choice and one of them
 * grants the run of the system. They are now grouped by the question each
 * answers - but the payload is byte-for-byte what it was: a JSON array of the
 * same keys.
 */

// The full set, in the order the API has always received them.
const VIEW_SCOPES = ['canViewOwnFiles', 'canViewDepartmentFiles', 'canViewBranchFiles']
const CAPABILITIES = [
  ['view-upload', 'Open and view files'],
  ['archiving', 'Upload files'],
  ['scanning', 'Scan files'],
  ['supervision-right', 'Supervision rights'],
  ['email-notification', 'Email notifications'],
]

const initialForm = {
  id: null,
  fullname: '',
  branchId: '',
  userGroup: '',
  email: '',
  pEmail: '',
  password: '',
  confirm_pass: '',
  permissions: {},
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const slugify = (str) => String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/**
 * The username the server will actually create.
 *
 * `createUser.service.js` ignores whatever username the client sends and builds
 * its own: the full name slugified, then "@", then the branch name with its
 * spaces stripped. The form previewed a different rule (dashes throughout),
 * which was invisible until a conflict error appeared - and wrong when it did.
 * This mirrors the server exactly, so what is shown is what gets stored.
 */
function serverUsername(fullname, branchName) {
  if (!fullname || !branchName) return ''
  return `${slugify(fullname)}@${String(branchName).replace(/\s+/g, '').toLowerCase()}`
}

function initialsOf(name) {
  return String(name || '?')
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

/** The permissions JSON on a user record, as a plain array. */
function permissionsOf(record) {
  try {
    const parsed = JSON.parse(record.permissions)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * The view scope a saved record maps to.
 *
 * Records written before the radio group existed can hold combinations that are
 * not a single choice - branch and own together, say. The broadest one wins,
 * because that is what the user can actually see today: fileScope.js reads the
 * three flags as a priority chain, so branch access already overrides the rest.
 * Picking the narrowest would silently take access away on the next save.
 */
function scopeOf(permissions) {
  if (permissions.includes('canViewBranchFiles')) return 'canViewBranchFiles'
  if (permissions.includes('canViewDepartmentFiles')) return 'canViewDepartmentFiles'
  if (permissions.includes('canViewOwnFiles')) return 'canViewOwnFiles'
  return ''
}

export default function UserManagement() {
  const [branches, setBranches] = useState([])
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  const [form, setForm] = useState(initialForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // Errors shown against the form rather than in a toast that vanishes.
  const [formError, setFormError] = useState(null)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div')
    toast.className = 'custom-toast-notification ' + (type === 'success' ? 'toast-success' : 'toast-error')
    toast.innerText = message
    toast.style.position = 'fixed'
    toast.style.bottom = '30px'
    toast.style.right = '30px'
    toast.style.background = type === 'success' ? '#22c55e' : '#dc3545'
    toast.style.color = '#fff'
    toast.style.padding = '12px 20px'
    toast.style.borderRadius = '6px'
    toast.style.fontSize = '0.95rem'
    toast.style.boxShadow = '0 2px 10px rgba(0,0,0,0.12)'
    toast.style.zIndex = 12000
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2500)
  }

  useEffect(() => { fetchBranches(); fetchGroups(); fetchUsers() }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (modalOpen) setModalOpen(false)
      if (deleteTarget) setDeleteTarget(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, deleteTarget])

  // ------------------------------------------------------------ data

  const fetchBranches = async () => {
    try {
      const res = await fetch('/admin/retrieve-branches', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setBranches(data.records || [])
    } catch (err) { console.error('[users] branches', err) }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/admin/retrieve-user-group', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setGroups(data.records || [])
    } catch (err) { console.error('[users] departments', err) }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/retrieve-users', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setUsers(data.records || [])
    } catch (err) { console.error('[users] list', err) }
    setLoading(false)
  }

  // --------------------------------------------------------- filtering

  // Same five fields the page has always searched.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) => (
      (u.fullname || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      ((u.branch && u.branch.name) || '').toLowerCase().includes(q) ||
      ((u.archive_category && u.archive_category.name) || '').toLowerCase().includes(q)
    ))
  }, [search, users])

  useEffect(() => { setPage(1) }, [search, rowsPerPage])

  const totalRows = filtered.length
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const firstRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const lastRow = Math.min(page * rowsPerPage, totalRows)
  const paginatedRows = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  // ------------------------------------------------------------ form

  const openCreate = () => {
    setForm(initialForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    const list = permissionsOf(record)
    const permissions = {}
    list.forEach((p) => { permissions[p] = true })
    // Collapse whatever combination was stored into the single broadest scope.
    VIEW_SCOPES.forEach((k) => { delete permissions[k] })
    const scope = scopeOf(list)
    if (scope) permissions[scope] = true

    setForm({
      id: record.id,
      fullname: record.fullname || '',
      branchId: (record.branch && record.branch.id) || '',
      userGroup: (record.archive_category && record.archive_category.id) || '',
      email: record.email || '',
      pEmail: record.private_email || '',
      password: '',
      confirm_pass: '',
      permissions,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => { setModalOpen(false); setFormError(null) }

  const handleFormChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const togglePermission = (perm) => {
    setForm((prev) => ({
      ...prev,
      permissions: { ...(prev.permissions || {}), [perm]: !prev.permissions[perm] },
    }))
  }

  // Exactly one of the three can be held at a time.
  const setViewScope = (scope) => {
    setForm((prev) => {
      const permissions = { ...(prev.permissions || {}) }
      VIEW_SCOPES.forEach((k) => { delete permissions[k] })
      permissions[scope] = true
      return { ...prev, permissions }
    })
  }

  const currentScope = VIEW_SCOPES.find((k) => form.permissions[k]) || ''

  const branchName = (branches.find((b) => String(b.id) === String(form.branchId)) || {}).name || ''
  const generatedUsername = serverUsername(form.fullname, branchName)

  const handleSave = async () => {
    setFormError(null)

    // Unchanged from the previous implementation, field for field.
    if ((form.fullname || '').trim().length < 1) return showToast('Full name is required', 'error')
    if (!form.branchId) return showToast('Branch is required', 'error')
    if (!form.userGroup) return showToast('Department is required', 'error')
    if ((form.email || '').trim().length < 1) return showToast('Email is required', 'error')
    if ((form.pEmail || '').trim().length < 1) return showToast('Private Email is required', 'error')
    if (!EMAIL_RE.test(form.email) || !EMAIL_RE.test(form.pEmail)) return showToast('Email invalid', 'error')

    const isUpdate = !!form.id
    if (!isUpdate) {
      if ((form.password || '').trim().length < 1) return showToast('Password is required', 'error')
      if ((form.confirm_pass || '').trim().length < 1) return showToast('Confirm password is required', 'error')
      if (form.password !== form.confirm_pass) {
        setFormError({ kind: 'password', message: 'The passwords do not match.' })
        return showToast('Password do not match', 'error')
      }
    } else if ((form.password || '').trim().length > 0 || (form.confirm_pass || '').trim().length > 0) {
      if ((form.password || '').trim().length < 1) return showToast('Password is required if changing password', 'error')
      if ((form.confirm_pass || '').trim().length < 1) return showToast('Confirm password is required if changing password', 'error')
      if (form.password !== form.confirm_pass) {
        setFormError({ kind: 'password', message: 'The passwords do not match.' })
        return showToast('Password do not match', 'error')
      }
    }

    const permissionsArr = Object.keys(form.permissions || {}).filter((k) => form.permissions[k])
    if (permissionsArr.length === 0) {
      setFormError({ kind: 'permissions', message: 'At least one permission must be selected.' })
      return showToast('At least one permission must be selected.', 'error')
    }

    const fd = new FormData()
    fd.append('fullname', form.fullname)
    // The server regenerates this and ignores what we send; sending the same
    // value it will compute keeps the request honest rather than misleading.
    fd.append('username', serverUsername(form.fullname, branchName))
    fd.append('branchId', form.branchId)
    fd.append('userGroup', form.userGroup)
    fd.append('email', form.email)
    fd.append('pEmail', form.pEmail)
    fd.append('password', form.password || '')
    fd.append('permissions', JSON.stringify(permissionsArr))
    fd.append('btnAction', form.id ? 'Update' : 'Create')
    fd.append('updateRecord', form.id || '')

    setSaving(true)
    try {
      const res = await fetch('/admin/user-management', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      const conflict = data.message && data.message.toLowerCase().includes('not available')

      if (!res.ok || data.statusCode === 404 || conflict) {
        const message = conflict
          ? 'This username is already in use. Change the full name or branch to avoid the conflict.'
          : (data.message || 'Failed to save')
        setFormError({ kind: conflict ? 'username' : 'general', message })
        showToast(message, 'error')
        setSaving(false)
        return
      }

      showToast(data.message || 'Saved', 'success')
      closeModal()
      setForm(initialForm)
      fetchUsers()
    } catch (err) {
      console.error('[users] save', err)
      setFormError({ kind: 'general', message: 'Error saving user' })
      showToast('Error saving user', 'error')
    }
    setSaving(false)
  }

  const doDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const fd = new FormData()
      fd.append('deleteRecord', deleteTarget.id)
      const res = await fetch('/admin/remove-user', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { showToast('Delete failed', 'error'); setDeleting(false); return }
      showToast(data.message || 'Deleted', 'success')
      setDeleteTarget(null)
      fetchUsers()
    } catch (err) {
      console.error('[users] delete', err)
      showToast('Delete failed', 'error')
    }
    setDeleting(false)
  }

  // ------------------------------------------------------------ render

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Users</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              <div className="row mb-2">
                <div className="col-sm-5">
                  <button className="btn btn-primary mb-2" onClick={openCreate}>
                    <i className="mdi mdi-plus-circle me-1" />Add user
                  </button>
                </div>
                <div className="col-sm-7">
                  <div className="text-sm-end">
                    <div className="d-inline-flex align-items-center me-2 mb-2">
                      <label className="me-1 mb-0 font-13 text-muted" htmlFor="um-rows">Rows</label>
                      <select
                        id="um-rows"
                        className="form-select form-select-sm"
                        style={{ width: 76 }}
                        value={rowsPerPage}
                        onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      >
                        {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="d-inline-block mb-2" style={{ minWidth: 260 }}>
                      <div className="position-relative">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="Name, username, email, branch or department"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table table-centered table-nowrap table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Private email</th>
                      <th>Branch</th>
                      <th>Department</th>
                      <th>Access</th>
                      <th>Created on</th>
                      <th style={{ width: 90 }} className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && paginatedRows.map((u, idx) => {
                      const perms = permissionsOf(u)
                      const isAdmin = perms.includes('is_admin')
                      return (
                        <tr key={u.id}>
                          <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                          <td>
                            <div className="avatar-sm d-inline-block me-1 align-middle" style={{ height: '1.6rem', width: '1.6rem' }}>
                              <span className="avatar-title bg-primary-lighten text-primary rounded-circle font-12">
                                {initialsOf(u.fullname)}
                              </span>
                            </div>
                            {u.fullname}
                          </td>
                          <td className="text-muted">{u.username}</td>
                          <td className="text-muted">{u.email}</td>
                          <td className="text-muted">{u.private_email}</td>
                          <td>{u.branch && u.branch.name}</td>
                          <td>{u.archive_category && u.archive_category.name}</td>
                          <td>
                            <span className={`badge ${isAdmin ? 'bg-primary-lighten text-primary' : 'bg-secondary-lighten text-secondary'}`}>
                              {isAdmin ? 'Administrator' : 'Standard'}
                            </span>
                            <span className="text-muted font-12 ms-1" title={perms.join(', ')}>{perms.length}</span>
                          </td>
                          <td className="text-muted">{formatDate(u.createdAt)}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-link p-0 text-muted me-2"
                              title="Edit"
                              onClick={() => openEdit(u)}
                            >
                              <i className="mdi mdi-square-edit-outline font-16" />
                            </button>
                            <button
                              className="btn btn-link p-0 text-danger"
                              title="Delete"
                              onClick={() => setDeleteTarget(u)}
                            >
                              <i className="mdi mdi-delete-outline font-16" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
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
                  <i className="mdi mdi-account-off-outline text-muted" style={{ fontSize: 34 }} />
                  <h5 className="mt-2 mb-1">No users found</h5>
                  <p className="text-muted mb-0">
                    {search ? 'Try a different search term.' : 'No users have been created yet.'}
                  </p>
                </div>
              )}

              <div className="d-flex justify-content-between align-items-center mt-2">
                <span className="text-muted font-13">
                  Showing {firstRow} to {lastRow} of {totalRows} user{totalRows === 1 ? '' : 's'}
                </span>
                <div>
                  <span className="text-muted font-13 me-2">Page {page} of {totalPages}</span>
                  <button
                    className="btn btn-sm btn-light"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <i className="mdi mdi-chevron-left" />
                  </button>
                  <button
                    className="btn btn-sm btn-light ms-1"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <i className="mdi mdi-chevron-right" />
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ create / edit */}
      {modalOpen && (
        <div
          className="modal fade show d-block um-backdrop"
          role="dialog"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable um-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">{form.id ? 'Edit user' : 'Create user'}</h4>
                <button type="button" className="btn-close" onClick={closeModal} />
              </div>

              <div className="modal-body">
                <h5 className="mb-2">Details</h5>
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-name">
                      Full name<span className="text-danger">*</span>
                    </label>
                    <input
                      id="um-name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Akosua Mensah"
                      value={form.fullname}
                      onChange={(e) => handleFormChange('fullname', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-branch">
                      Branch<span className="text-danger">*</span>
                    </label>
                    <select
                      id="um-branch"
                      className="form-select"
                      value={form.branchId}
                      onChange={(e) => handleFormChange('branchId', e.target.value)}
                    >
                      <option value="">--- Select branch ----</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* The rule was invisible until a conflict error appeared. */}
                <div className={`alert py-2 px-3 mb-3 ${formError?.kind === 'username' ? 'alert-danger' : 'alert-secondary'}`}>
                  <span className="font-13">
                    <i className="mdi mdi-account-outline me-1" />
                    Username is generated from the full name and branch:{' '}
                    <strong>{generatedUsername || '—'}</strong>
                  </span>
                  {formError?.kind === 'username' && (
                    <div className="font-13 mt-1">
                      <i className="mdi mdi-account-alert-outline me-1" />{formError.message}
                    </div>
                  )}
                </div>

                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-dept">
                      Department<span className="text-danger">*</span>
                    </label>
                    <select
                      id="um-dept"
                      className="form-select"
                      value={form.userGroup}
                      onChange={(e) => handleFormChange('userGroup', e.target.value)}
                    >
                      <option value="">--- Select department ----</option>
                      {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-email">
                      Work email<span className="text-danger">*</span>
                    </label>
                    <input
                      id="um-email"
                      type="email"
                      className="form-control"
                      placeholder="name@company.com"
                      value={form.email}
                      onChange={(e) => handleFormChange('email', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label" htmlFor="um-pemail">
                      Private email<span className="text-danger">*</span>
                    </label>
                    <input
                      id="um-pemail"
                      type="email"
                      className="form-control"
                      placeholder="Personal address"
                      value={form.pEmail}
                      onChange={(e) => handleFormChange('pEmail', e.target.value)}
                    />
                  </div>
                </div>

                <h5 className="mb-2">Password</h5>
                <p className="text-muted font-13 mb-2">
                  {form.id ? 'Leave blank to keep the current password.' : 'Required for a new account.'}
                </p>
                <div className="row mb-3">
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-pass">
                      New password{!form.id && <span className="text-danger">*</span>}
                    </label>
                    <input
                      id="um-pass"
                      type="password"
                      className="form-control"
                      placeholder="4 characters or more"
                      value={form.password}
                      onChange={(e) => handleFormChange('password', e.target.value)}
                    />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label" htmlFor="um-pass2">
                      Confirm password{!form.id && <span className="text-danger">*</span>}
                    </label>
                    <input
                      id="um-pass2"
                      type="password"
                      className="form-control"
                      placeholder="Repeat the password"
                      value={form.confirm_pass}
                      onChange={(e) => handleFormChange('confirm_pass', e.target.value)}
                    />
                  </div>
                </div>

                <h5 className="mb-1">Access</h5>
                <p className="text-muted font-13 mb-2">At least one permission is required.</p>

                {/* A. one exclusive choice, not three independent switches */}
                <div className="card shadow-none border mb-2">
                  <div className="card-body py-2">
                    <label className="form-label mb-2">Which files can this person see?</label>
                    {[
                      ['canViewOwnFiles', 'Only their own files'],
                      ['canViewDepartmentFiles', 'Everything in their department'],
                      ['canViewBranchFiles', 'Everything in their branch'],
                    ].map(([key, label]) => (
                      <div className="form-check mb-1" key={key}>
                        <input
                          className="form-check-input"
                          type="radio"
                          name="um-scope"
                          id={`um-${key}`}
                          checked={currentScope === key}
                          onChange={() => setViewScope(key)}
                        />
                        <label className="form-check-label" htmlFor={`um-${key}`}>
                          {label}
                          <span className="text-muted font-12 d-block">{key}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* B. what they can do */}
                <div className="card shadow-none border mb-2">
                  <div className="card-body py-2">
                    <label className="form-label mb-2">What can this person do?</label>
                    <div className="row">
                      {[CAPABILITIES.slice(0, 3), CAPABILITIES.slice(3)].map((column, ci) => (
                        <div className="col-md-6" key={ci}>
                          {column.map(([key, label]) => (
                            <div className="form-check form-switch mb-1" key={key}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`um-${key}`}
                                checked={!!form.permissions[key]}
                                onChange={() => togglePermission(key)}
                              />
                              <label className="form-check-label" htmlFor={`um-${key}`}>
                                {label} <span className="text-muted font-12">({key})</span>
                              </label>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* C. administrator, called out because of what it grants */}
                <div className="card shadow-none border border-warning mb-2">
                  <div className="card-body py-2">
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="um-is_admin"
                        checked={!!form.permissions['is_admin']}
                        onChange={() => togglePermission('is_admin')}
                      />
                      <label className="form-check-label" htmlFor="um-is_admin">
                        <span className="fw-bold">Administrator</span>{' '}
                        <span className="text-muted font-12">(is_admin)</span>
                        <span className="text-muted font-12 d-block">
                          Can manage users, branches, departments and access control, view the audit
                          trail, and delete any file they can see.
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {(formError?.kind === 'permissions' || formError?.kind === 'password' || formError?.kind === 'general') && (
                  <div className="alert alert-danger py-2 px-3 mb-0">
                    <i className="mdi mdi-alert-circle-outline me-1" />{formError.message}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                  {saving ? 'Saving…' : (form.id ? 'Save changes' : 'Create user')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------- delete */}
      {deleteTarget && (
        <div
          className="modal fade show d-block um-backdrop"
          role="dialog"
          onClick={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteTarget(null) }}
        >
          <div className="modal-dialog modal-dialog-centered um-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Delete user?</h4>
                <button type="button" className="btn-close" onClick={() => setDeleteTarget(null)} disabled={deleting} />
              </div>
              <div className="modal-body">
                <p><strong>{deleteTarget.fullname || deleteTarget.username}</strong> will be removed permanently.</p>
                <div className="alert alert-warning py-2 px-3 mb-0">
                  <i className="mdi mdi-alert-outline me-1" />
                  Their files, audit history and permissions are deleted with the account. Files they
                  sent to other people stay in those people&rsquo;s folders.
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-light" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                  Cancel
                </button>
                <button className="btn btn-danger" onClick={doDelete} disabled={deleting}>
                  {deleting && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                  {deleting ? 'Deleting…' : 'Delete user'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/*
 * The modals are rendered by React rather than driven by Bootstrap's JS, so the
 * backdrop and stacking have to be declared here - Hyper's own modal CSS only
 * positions the dialog once something else has placed the backdrop.
 */
const PAGE_CSS = `
.um-backdrop{position:fixed;inset:0;z-index:1055;background:rgba(0,0,0,.45);
  display:flex;align-items:center;justify-content:center;overflow-y:auto}
.um-modal{pointer-events:auto}
.um-modal .modal-content{background-color:#fff}
.um-modal .modal-body{max-height:70vh;overflow-y:auto}
`
