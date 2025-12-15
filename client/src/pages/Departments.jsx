import React, { useEffect, useState } from 'react'

export default function Departments(){
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ id:null, name:'', description:'' })
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

  useEffect(()=>{ fetchGroups() }, [])

  useEffect(()=>{
    const q = search.trim().toLowerCase()
    if(!q) return setFiltered(groups)
    setFiltered(groups.filter(g => (g.name||'').toLowerCase().includes(q) || (g.description||'').toLowerCase().includes(q)))
  }, [search, groups])

  useEffect(()=>{
    const onKey = e => { if(e.key==='Escape'){ if(modalOpen) setModalOpen(false); if(deleteOpen) setDeleteOpen(false) } }
    document.addEventListener('keydown', onKey)
    return ()=>document.removeEventListener('keydown', onKey)
  },[modalOpen, deleteOpen])

  const fetchGroups = async ()=>{
    setLoading(true)
    try{
      const res = await fetch('/admin/retrieve-user-group', { credentials:'include' })
      const data = await res.json()
      if(data.statusCode===200){ setGroups(data.records||[]); setFiltered(data.records||[]) }
    }catch(e){ console.error(e) }
    setLoading(false)
  }

  const openCreate = ()=>{ setForm({ id:null, name:'', description:'' }); setModalOpen(true) }
  const openEdit = (rec)=>{ setForm({ id:rec.id, name:rec.name||'', description:rec.description||'' }); setModalOpen(true) }
  const closeModal = ()=> setModalOpen(false)

  const handleSave = async ()=>{
    if(!(form.name||'').trim()) return showToast('Category name is required','error')
    if(!(form.description||'').trim()) return showToast('Category description is required','error')
    const fd = new FormData(); fd.append('catName', form.name); fd.append('catDescription', form.description); fd.append('btnAction', form.id? 'Update':'Create'); fd.append('updateRecord', form.id||'')
    try{
      const res = await fetch('/admin/user-group', { method:'POST', body: fd, credentials:'include' })
      const data = await res.json()
      if(!res.ok || data.statusCode && data.statusCode!==200){ showToast(data.message||'Failed', 'error'); return }
      showToast(data.message||'Saved','success')
      closeModal()
      setForm({ id:null, name:'', description:'' }) // Clear form
      fetchGroups()
    }catch(e){ console.error(e); showToast('Failed', 'error') }
  }

  const confirmDelete = (id)=>{ setDeleteId(id); setDeleteOpen(true) }
  const doDelete = async ()=>{
    if(!deleteId) return
    try{
      const fd = new FormData(); fd.append('deleteRecord', deleteId)
      const res = await fetch('/admin/remove-user-group', { method:'POST', body:fd, credentials:'include' })
      const data = await res.json()
      if(!res.ok){ showToast('Delete failed','error'); return }
      showToast(data.message||'Deleted','success')
      setDeleteOpen(false); setDeleteId(null); fetchGroups()
    }catch(e){ console.error(e); showToast('Delete failed','error') }
  }

  return (
    <div className="container-fluid">
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5>Departments</h5>
          <div>
            <button className="btn btn-primary me-2" onClick={openCreate}>Add group</button>
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
                  <th>ID</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Created by</th>
                  <th>Created on</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6}>Loading...</td></tr>}
                {!loading && filtered.length===0 && <tr><td colSpan={6}>No records</td></tr>}
                {!loading && filtered.map(r=> (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.name}</td>
                    <td>{r.description}</td>
                    <td>{r.created_by}</td>
                    <td>{r.createdAt? new Date(r.createdAt).toDateString():''}</td>
                    <td>
                      <ul className="action list-unstyled d-flex gap-2 mb-0">
                        <li style={{cursor:'pointer'}} onClick={()=>openEdit(r)} title="Edit"><i className="icon-pencil-alt"></i></li>
                        <li style={{cursor:'pointer'}} onClick={()=>confirmDelete(r.id)} title="Delete"><i className="icon-trash"></i></li>
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
        /* Ensure all descendant text elements inherit readable color in light mode */
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
          <div className="modal-dialog" role="document">
            <div className="modal-content" style={{width:'90%'}}>
              <div className="modal-header"><h5 className="modal-title">{form.id? 'Edit User Group':'Create User Group'}</h5><button type="button" className="btn-close" onClick={closeModal}></button></div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Category Name<span className="text-danger">*</span></label>
                  <input className="form-control" placeholder="e.g financial" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Description<span className="text-danger">*</span></label>
                  <textarea className="form-control" rows={3} placeholder="Enter description..." value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal}>Close</button>
                <button className="btn btn-primary" onClick={handleSave}>{form.id? 'Update':'Create'}</button>
              </div>
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
