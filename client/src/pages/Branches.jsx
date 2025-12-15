import React, { useEffect, useState } from 'react'

export default function Branches(){
  const [branches, setBranches] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ id:null, name:'', person:'', address:'', email:'', phone:'', reg:'', departmentId:'' })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const showToast = (message, type='success') => {
    const t = document.createElement('div')
    t.className = 'custom-toast-notification ' + (type==='success' ? 'toast-success' : 'toast-error')
    t.innerText = message
    Object.assign(t.style, {position:'fixed', right:'30px', bottom:'30px', padding:'12px 20px', color:'#fff', borderRadius:'6px', zIndex:12000, boxShadow:'0 2px 10px rgba(0,0,0,0.12)', background: type==='success' ? '#22c55e' : '#dc3545'})
    document.body.appendChild(t)
    setTimeout(()=>t.remove(),2500)
  }

  useEffect(()=>{ fetchGroups(); fetchBranches() }, [])

  useEffect(()=>{
    const q = search.trim().toLowerCase()
    if(!q) return setFiltered(branches)
    setFiltered(branches.filter(b => (b.name||'').toLowerCase().includes(q) || (b.contact_person||'').toLowerCase().includes(q) || (b.address||'').toLowerCase().includes(q) ))
  }, [search, branches])

  useEffect(()=>{
    const onKey = e => { if(e.key==='Escape'){ if(modalOpen) setModalOpen(false); if(deleteOpen) setDeleteOpen(false) } }
    document.addEventListener('keydown', onKey)
    return ()=>document.removeEventListener('keydown', onKey)
  },[modalOpen, deleteOpen])

  const fetchGroups = async ()=>{
    try{
      const res = await fetch('/admin/retrieve-user-group', { credentials:'include' })
      const data = await res.json()
      if(data.statusCode===200) setGroups(data.records||[])
    }catch(e){ console.error(e) }
  }

  const fetchBranches = async ()=>{
    setLoading(true)
    try{
      const res = await fetch('/admin/retrieve-branches', { credentials:'include' })
      const data = await res.json()
      if(data.statusCode===200){ setBranches(data.records||[]); setFiltered(data.records||[]) }
    }catch(e){ console.error(e) }
    setLoading(false)
  }

  const openCreate = ()=>{ setForm({ id:null, name:'', person:'', address:'', email:'', phone:'', reg:'', departmentId:'' }); setModalOpen(true) }
  const openEdit = (r)=>{ setForm({ id:r.id, name:r.name||'', person:r.contact_person||'', address:r.address||'', email:r.email||'', phone:r.phone_number||'', reg:r.reg_number||'', departmentId: r.departmentId||'' }); setModalOpen(true) }
  const closeModal = ()=> setModalOpen(false)

  const handleSave = async ()=>{
    if(!(form.name||'').trim()) return showToast('Name is required','error')
    if(!(form.person||'').trim()) return showToast('Contact person is required','error')
    if(!(form.address||'').trim()) return showToast('Address is required','error')
    if(!(form.email||'').trim()) return showToast('Email is required','error')
    if(!(form.phone||'').trim()) return showToast('Phone is required','error')
    if(!(form.reg||'').trim()) return showToast('Registration is required','error')
    if(!form.departmentId) return showToast('Please select a valid department','error')

    const fd = new FormData()
    fd.append('name', form.name); fd.append('person', form.person); fd.append('address', form.address); fd.append('phone', form.phone); fd.append('reg', form.reg); fd.append('email', form.email); fd.append('departmentName', groups.find(g=>g.id==form.departmentId)?.name||''); fd.append('btnAction', form.id? 'Update':'Create'); fd.append('updateRecord', form.id||'')
    try{
      const res = await fetch('/admin/branches', { method:'POST', body: fd, credentials:'include' })
      const data = await res.json()
      if(!res.ok || data.statusCode && data.statusCode!==200){ showToast(data.message||'Failed', 'error'); return }
      showToast(data.message||'Saved','success')
      closeModal()
      setForm({ id:null, name:'', person:'', address:'', email:'', phone:'', reg:'', departmentId:'' }) // Clear form
      fetchBranches()
    }catch(e){ console.error(e); showToast('Failed','error') }
  }

  const confirmDelete = (id)=>{ setDeleteId(id); setDeleteOpen(true) }
  const doDelete = async ()=>{
    if(!deleteId) return
    try{
      const fd = new FormData(); fd.append('deleteRecord', deleteId)
      const res = await fetch('/admin/remove-branch', { method:'POST', body: fd, credentials:'include' })
      const data = await res.json()
      if(!res.ok){ showToast('Delete failed','error'); return }
      showToast(data.message||'Deleted','success')
      setDeleteOpen(false); setDeleteId(null); fetchBranches()
    }catch(e){ console.error(e); showToast('Delete failed','error') }
  }

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5>Branches</h5>
          <div>
            <button className="btn btn-primary me-2" onClick={openCreate}>Add branch</button>
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
            <table className="table table-striped">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact person</th>
                  <th>Address</th>
                  <th>Email</th>
                  <th>Phone number</th>
                  <th>Registration number</th>
                  <th>Departments</th>
                  <th>Created on</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={9}>Loading...</td></tr>}
                {!loading && filtered.length===0 && <tr><td colSpan={9}>No records</td></tr>}
                {!loading && filtered.map(b=> (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>{b.contact_person}</td>
                    <td>{b.address}</td>
                    <td>{b.email}</td>
                    <td>{b.phone_number}</td>
                    <td>{b.reg_number}</td>
                    <td>{b.departmentNames || 'No Departments'}</td>
                    <td>{b.createdAt? new Date(b.createdAt).toDateString():''}</td>
                    <td>
                      <ul className="action list-unstyled d-flex gap-2 mb-0">
                        <li style={{cursor:'pointer'}} onClick={()=>openEdit(b)} title="Edit"><i className="icon-pencil-alt"></i></li>
                        <li style={{cursor:'pointer'}} onClick={()=>confirmDelete(b.id)} title="Delete"><i className="icon-trash"></i></li>
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style>{`
        .react-modal-backdrop{position:fixed !important; inset:0 !important; z-index:40000 !important; background: rgba(0,0,0,0.45) !important; display:flex !important; align-items:center; justify-content:center;}
        .react-modal-backdrop .modal-content{color:#111 !important; z-index:40001 !important; background-color: var(--bs-body-bg, #fff) !important;}
        /* Apply readable color to text-related elements but avoid styling buttons (.btn) */
        .react-modal-backdrop .modal-content,
        .react-modal-backdrop .modal-content p,
        .react-modal-backdrop .modal-content label,
        .react-modal-backdrop .modal-content .form-label,
        .react-modal-backdrop .modal-content h1,
        .react-modal-backdrop .modal-content h2,
        .react-modal-backdrop .modal-content h3,
        .react-modal-backdrop .modal-content h4,
        .react-modal-backdrop .modal-content h5,
        .react-modal-backdrop .modal-content h6,
        .react-modal-backdrop .modal-content span,
        .react-modal-backdrop .modal-content a,
        .react-modal-backdrop .modal-content input,
        .react-modal-backdrop .modal-content textarea,
        .react-modal-backdrop .modal-content select,
        .react-modal-backdrop .modal-content th,
        .react-modal-backdrop .modal-content td,
        .react-modal-backdrop .modal-content li { color: #111 !important; }
        @media (prefers-color-scheme: dark){
          .react-modal-backdrop .modal-content,
          .react-modal-backdrop .modal-content p,
          .react-modal-backdrop .modal-content label,
          .react-modal-backdrop .modal-content .form-label,
          .react-modal-backdrop .modal-content h1,
          .react-modal-backdrop .modal-content h2,
          .react-modal-backdrop .modal-content h3,
          .react-modal-backdrop .modal-content h4,
          .react-modal-backdrop .modal-content h5,
          .react-modal-backdrop .modal-content h6,
          .react-modal-backdrop .modal-content span,
          .react-modal-backdrop .modal-content a,
          .react-modal-backdrop .modal-content input,
          .react-modal-backdrop .modal-content textarea,
          .react-modal-backdrop .modal-content select,
          .react-modal-backdrop .modal-content th,
          .react-modal-backdrop .modal-content td,
          .react-modal-backdrop .modal-content li { color: #fff !important; }
          .react-modal-backdrop .modal-content{ background-color: #111 !important; }
        }
        .react-modal-backdrop .modal-body{max-height:70vh !important; overflow:auto !important; -webkit-overflow-scrolling: touch;}
        .react-modal-backdrop .modal-dialog{pointer-events:auto !important;}
      `}</style>

      {modalOpen && (
        <div className="modal fade show d-block react-modal-backdrop" tabIndex={-1} onClick={(e)=>{ if(e.target===e.currentTarget) closeModal() }}>
          <div className="modal-dialog">
            <div className="modal-content" style={{width:'90%'}}>
              <div className="modal-header"><h5 className="modal-title">{form.id? 'Edit Branch':'Create Branch'}</h5><button type="button" className="btn-close" onClick={closeModal}></button></div>
              <div className="modal-body">
                <div className="mb-3 row">
                  <div className="col-md-6 mb-3"><label className="form-label">Name</label><input className="form-control" placeholder="e.g Head office" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} /></div>
                  <div className="col-md-6 mb-3"><label className="form-label">Contact Person</label><input className="form-control" placeholder="e.g john doe" value={form.person} onChange={e=>setForm({...form, person:e.target.value})} /></div>
                  <div className="col-md-12 mb-3">
                    <label className="form-label mt-4">Department</label><br />
                    {!form.id && <em style={{display:'inline-block', color:'rgb(18, 240, 18)'}}>Choose a department to create the first department of this branch</em>}
                    {form.id && <em style={{display:'inline-block', color:'rgb(88, 98, 245)'}}>Choose a department to add a new department to this branch</em>}
                    <select className="form-select" value={form.departmentId} onChange={e=>setForm({...form, departmentId:e.target.value})}><option value="">--- Select department ----</option>{groups.map(g=> <option key={g.id} value={g.id}>{g.name}</option>)}</select>
                  </div>
                </div>
                <div className="mb-3 row">
                  <div className="col-md-6 mb-3"><label className="form-label">Location Address</label><input className="form-control" placeholder="e.g ak 18.345" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} /></div>
                  <div className="col-md-6 mb-3"><label className="form-label">Email</label><input className="form-control" type="email" placeholder="admin email id" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} /></div>
                </div>
                <div className="mb-3 row">
                  <div className="col-md-6 mb-3"><label className="form-label">Phone number</label><input className="form-control" placeholder="admin telephone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} /></div>
                  <div className="col-md-6 mb-3"><label className="form-label">Branch id</label><input className="form-control" placeholder="e.g 001" value={form.reg} onChange={e=>setForm({...form, reg:e.target.value})} /></div>
                </div>
              </div>
              <div className="modal-footer"><button className="btn btn-secondary" onClick={closeModal}>Close</button><button className="btn btn-primary" onClick={handleSave}>{form.id? 'Update':'Create'}</button></div>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div className="modal fade show d-block react-modal-backdrop" tabIndex={-1} onClick={(e)=>{ if(e.target===e.currentTarget) setDeleteOpen(false) }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header"><h5 className="modal-title">Confirm Delete</h5></div>
              <div className="modal-body">Are you sure?</div>
              <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setDeleteOpen(false)}>No, cancel</button><button className="btn btn-danger" onClick={doDelete}>Yes, delete</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
