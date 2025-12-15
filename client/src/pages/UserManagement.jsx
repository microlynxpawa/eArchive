import React, { useEffect, useState } from 'react'

const initialForm = {
  id: null,
  fullname: '',
  branchId: '',
  userGroup: '',
  email: '',
  pEmail: '',
  password: '',
  confirm_pass: '',
  permissions: {}
}

const permissionList = [
  'scanning',
  'archiving',
  'view-upload',
  'supervision-right',
  'email-notification',
  'canViewOwnFiles',
  'canViewBranchFiles',
  'canViewDepartmentFiles',
  'is_admin'
]

export default function UserManagement() {
  const [branches, setBranches] = useState([])
  const [groups, setGroups] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState([])

  const [form, setForm] = useState(initialForm)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

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

  // close modal with ESC and manage focus; cleanup on unmount
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (modalOpen) setModalOpen(false)
        if (deleteOpen) setDeleteOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [modalOpen, deleteOpen])

  useEffect(() => {
    const q = search.trim().toLowerCase()
    if (!q) return setFiltered(users)
    setFiltered(users.filter(u => (
      (u.fullname || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.branch && u.branch.name || '').toLowerCase().includes(q) ||
      (u.archive_category && u.archive_category.name || '').toLowerCase().includes(q)
    )))
  }, [search, users])

  const fetchBranches = async () => {
    try {
      const res = await fetch('/admin/retrieve-branches', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setBranches(data.records || [])
    } catch (e) { console.error(e) }
  }

  const fetchGroups = async () => {
    try {
      const res = await fetch('/admin/retrieve-user-group', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) setGroups(data.records || [])
    } catch (e) { console.error(e) }
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/retrieve-users', { credentials: 'include' })
      const data = await res.json()
      if (data.statusCode === 200) {
        setUsers(data.records || [])
        setFiltered(data.records || [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const openCreate = () => {
    setForm(initialForm)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    const permissions = {}
    try { (JSON.parse(record.permissions) || []).forEach(p => permissions[p] = true) } catch(e) {}
    setForm({
      id: record.id,
      fullname: record.fullname || '',
      branchId: record.branch && record.branch.id || '',
      userGroup: record.archive_category && record.archive_category.id || '',
      email: record.email || '',
      pEmail: record.private_email || '',
      password: '',
      confirm_pass: '',
      permissions
    })
    setModalOpen(true)
  }

  const closeModal = () => setModalOpen(false)

  const handleFormChange = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const togglePermission = (perm) => {
    setForm(prev => ({ ...prev, permissions: { ...(prev.permissions||{}), [perm]: !prev.permissions[perm] } }))
  }

  const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

  const handleSave = async () => {
    // validation
    if ((form.fullname || '').trim().length < 1) return showToast('Full name is required', 'error')
    if (!form.branchId) return showToast('Branch is required', 'error')
    if (!form.userGroup) return showToast('Department is required', 'error')
    if ((form.email||'').trim().length<1) return showToast('Email is required', 'error')
    if ((form.pEmail||'').trim().length<1) return showToast('Private Email is required', 'error')
    // emails basic check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(form.email) || !emailRegex.test(form.pEmail)) return showToast('Email invalid', 'error')

    // Password validation
    const isUpdate = !!form.id
    if (!isUpdate) {
      // Creating new user - password required
      if ((form.password||'').trim().length < 1) return showToast('Password is required', 'error')
      if ((form.confirm_pass||'').trim().length < 1) return showToast('Confirm password is required', 'error')
      if (form.password !== form.confirm_pass) return showToast('Password do not match', 'error')
    } else {
      // Updating user - password optional, but if provided must match
      if ((form.password||'').trim().length > 0 || (form.confirm_pass||'').trim().length > 0) {
        if ((form.password||'').trim().length < 1) return showToast('Password is required if changing password', 'error')
        if ((form.confirm_pass||'').trim().length < 1) return showToast('Confirm password is required if changing password', 'error')
        if (form.password !== form.confirm_pass) return showToast('Password do not match', 'error')
      }
    }

    const permissionsArr = Object.keys(form.permissions || {}).filter(k => form.permissions[k])
    if (permissionsArr.length === 0) return showToast('At least one permission must be selected.', 'error')

    // generate username from fullname + branch name
    const branchName = (branches.find(b=>b.id==form.branchId) || {}).name || ''
    const usernameGenerated = slugify(form.fullname || '') + '-' + slugify(branchName)

    const fd = new FormData()
    fd.append('fullname', form.fullname)
    fd.append('username', usernameGenerated)
    fd.append('branchId', form.branchId)
    fd.append('userGroup', form.userGroup)
    fd.append('email', form.email)
    fd.append('pEmail', form.pEmail)
    fd.append('password', form.password || '')
    fd.append('permissions', JSON.stringify(permissionsArr))
    fd.append('btnAction', form.id ? 'Update' : 'Create')
    fd.append('updateRecord', form.id || '')

    try {
      const res = await fetch('/admin/user-management', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok || data.statusCode === 404 || data.message && data.message.toLowerCase().includes('not available')) {
        showToast(data.message || 'Failed to save', 'error')
        return
      }
      showToast(data.message || 'Saved', 'success')
      closeModal()
      setForm(initialForm) // Clear form after successful save
      fetchUsers()
    } catch (e) {
      console.error(e)
      showToast('Error saving user', 'error')
    }
  }

  const confirmDelete = (id) => { setDeleteId(id); setDeleteOpen(true) }

  const doDelete = async () => {
    if (!deleteId) return
    try {
      const fd = new FormData(); fd.append('deleteRecord', deleteId)
      const res = await fetch('/admin/remove-user', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) { showToast('Delete failed', 'error'); return }
      showToast(data.message || 'Deleted', 'success')
      setDeleteOpen(false)
      setDeleteId(null)
      fetchUsers()
    } catch (e) { console.error(e); showToast('Delete failed', 'error') }
  }

  return (
    <div className="container-fluid">
      <div className="row">
        <div className="col-sm-12">
          <div className="card">
            <div className="card-header pb-0 d-flex justify-content-between align-items-center">
              <h5>User Management</h5>
              <div>
                <button className="btn btn-primary me-2" onClick={openCreate}>Add User</button>
                <input className="form-control d-inline-block" style={{width:240}} placeholder="Search..." value={search} onChange={e=>setSearch(e.target.value)} />
              </div>
            </div>
            <div className="card-body">
              <div className="mb-2">
                <span style={{color:'#1a73e8',fontSize:'1.02em'}}>
                  Tip: Use <b>Ctrl +</b> or <b>Ctrl -</b> to zoom in or out and see more content at once.
                </span>
              </div>
              <div className="table-responsive theme-scrollbar">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Private Email</th>
                      <th>Branch</th>
                      <th>Department</th>
                      <th>Created on</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td colSpan={8}>Loading...</td></tr>}
                    {!loading && filtered.length === 0 && <tr><td colSpan={8}>No users</td></tr>}
                    {!loading && filtered.map(u=> (
                      <tr key={u.id}>
                        <td>{u.fullname}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.private_email}</td>
                        <td>{u.branch && u.branch.name}</td>
                        <td>{u.archive_category && u.archive_category.name}</td>
                        <td>{u.createdAt ? new Date(u.createdAt).toDateString() : ''}</td>
                        <td>
                          <ul className="action list-unstyled d-flex gap-2 mb-0">
                            <li className="edit" style={{cursor:'pointer'}} onClick={()=>openEdit(u)} title="Edit"><i className="icon-pencil-alt"></i></li>
                            <li className="delete" style={{cursor:'pointer'}} onClick={()=>confirmDelete(u.id)} title="Delete"><i className="icon-trash"></i></li>
                          </ul>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {/* Scoped styles for the modal: enforce backdrop position, high z-index, readable text in light/dark mode, scrollable body */}
      <style>{`
        .react-modal-backdrop{position:fixed !important; inset:0 !important; z-index:40000 !important; background: rgba(0,0,0,0.45) !important; display:flex !important; align-items:center; justify-content:center;}
        .react-modal .modal-content{color:#111 !important; z-index:40001 !important; background-color: var(--bs-body-bg, #fff) !important;}
        @media (prefers-color-scheme: dark){ .react-modal .modal-content{color:#fff !important; background-color: #111 !important;} }
        .react-modal .modal-body{max-height:70vh !important; overflow:auto !important; -webkit-overflow-scrolling: touch;}
        .react-modal .modal-dialog{pointer-events:auto !important;}
        .react-modal .modal-content label, .react-modal .modal-content .form-label { color: inherit !important; }
      `}</style>

      {modalOpen && (
        <div className="modal fade show d-block react-modal-backdrop" tabIndex={-1} role="dialog" style={{display:'block'}} onClick={(e)=>{ if(e.target===e.currentTarget) closeModal() }}>
          <div className="modal-dialog modal-dialog-centered react-modal" role="document">
            <div className="modal-content" style={{width:'90%'}}>
              <div className="modal-header">
                <h5 className="modal-title">{form.id ? 'Edit User' : 'Create User'}</h5>
                <button type="button" className="btn-close" onClick={closeModal}></button>
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Full name<span className="text-danger">*</span></label>
                  <input className="form-control" placeholder="e.g kofi doe" value={form.fullname} onChange={e=>handleFormChange('fullname', e.target.value)} />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Branch<span className="text-danger">*</span></label>
                    <select className="form-select" value={form.branchId} onChange={e=>handleFormChange('branchId', e.target.value)}>
                      <option value="">--- Select branch ----</option>
                      {branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Department<span className="text-danger">*</span></label>
                    <select className="form-select" value={form.userGroup} onChange={e=>handleFormChange('userGroup', e.target.value)}>
                      <option value="">--- Select department ----</option>
                      {groups.map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Email Id<span className="text-danger">*</span></label>
                    <input className="form-control" type="email" placeholder="e.g doe@mail.com" value={form.email} onChange={e=>handleFormChange('email', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Private email<span className="text-danger">*</span></label>
                    <input className="form-control" type="email" placeholder="e.g john@mail.com" value={form.pEmail} onChange={e=>handleFormChange('pEmail', e.target.value)} />
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Password{!form.id && <span className="text-danger">*</span>}</label>
                    <input className="form-control" type="password" placeholder="4 characters or more" value={form.password} onChange={e=>handleFormChange('password', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Confirm Password{!form.id && <span className="text-danger">*</span>}</label>
                    <input className="form-control" type="password" placeholder="4 characters or more" value={form.confirm_pass} onChange={e=>handleFormChange('confirm_pass', e.target.value)} />
                  </div>
                </div>
                <div className="mb-4">
                  <h5>Permissions<span className="text-danger">*</span></h5>
                  <div className="col">
                    <div className="m-t-15 m-checkbox-inline">
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="scanning" type="checkbox" checked={!!form.permissions['scanning']} onChange={()=>togglePermission('scanning')} />
                        <label className="form-check-label" htmlFor="scanning">Scanning</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="archiving" type="checkbox" checked={!!form.permissions['archiving']} onChange={()=>togglePermission('archiving')} />
                        <label className="form-check-label" htmlFor="archiving">Archiving</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="view-upload" type="checkbox" checked={!!form.permissions['view-upload']} onChange={()=>togglePermission('view-upload')} />
                        <label className="form-check-label" htmlFor="view-upload">View Uploads</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="supervision-right" type="checkbox" checked={!!form.permissions['supervision-right']} onChange={()=>togglePermission('supervision-right')} />
                        <label className="form-check-label" htmlFor="supervision-right">Supervision Rights</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="email-notification" type="checkbox" checked={!!form.permissions['email-notification']} onChange={()=>togglePermission('email-notification')} />
                        <label className="form-check-label" htmlFor="email-notification">Email Notification</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="canViewOwnFiles" type="checkbox" checked={!!form.permissions['canViewOwnFiles']} onChange={()=>togglePermission('canViewOwnFiles')} />
                        <label className="form-check-label" htmlFor="canViewOwnFiles">Can View Own Files</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="canViewBranchFiles" type="checkbox" checked={!!form.permissions['canViewBranchFiles']} onChange={()=>togglePermission('canViewBranchFiles')} />
                        <label className="form-check-label" htmlFor="canViewBranchFiles">Can View Branch Files</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="canViewDepartmentFiles" type="checkbox" checked={!!form.permissions['canViewDepartmentFiles']} onChange={()=>togglePermission('canViewDepartmentFiles')} />
                        <label className="form-check-label" htmlFor="canViewDepartmentFiles">Can View Department Files</label>
                      </div>
                      <div className="form-check form-check-inline checkbox checkbox-dark mb-0">
                        <input className="form-check-input" id="is_admin" type="checkbox" checked={!!form.permissions['is_admin']} onChange={()=>togglePermission('is_admin')} />
                        <label className="form-check-label" htmlFor="is_admin">Is Admin</label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>Close</button>
                <button id="btnSave" className="btn btn-primary" onClick={handleSave}>{form.id ? 'Update' : 'Create'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteOpen && (
        <div className="modal fade show d-block react-modal-backdrop" tabIndex={-1} style={{display:'block'}} onClick={(e)=>{ if(e.target===e.currentTarget) setDeleteOpen(false) }}>
          <div className="modal-dialog" role="document">
            <div className="modal-content" style={{zIndex:20001}}>
              <div className="modal-header"><h5 className="modal-title">Confirm Delete</h5></div>
              <div className="modal-body">Are you sure?</div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={()=>setDeleteOpen(false)}>No, cancel</button>
                <button id="btnDeleteRecord" className="btn btn-danger" onClick={doDelete}>Yes, delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
