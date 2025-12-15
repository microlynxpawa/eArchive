import React, { useState, useEffect } from 'react'

export default function AllUsersModal() {
  const [visible, setVisible] = useState(false)
  const [users, setUsers] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [callback, setCallback] = useState(null)

  useEffect(() => {
    // expose global opener used by legacy scripts
    window.openAllUsersModal = (cb) => {
      setCallback(() => cb)
      setVisible(true)
      setUsers([])
      setSelected(new Set())
      fetch('/admin/retrieve-users')
        .then(r => r.json())
        .then(data => setUsers((data && data.records) || []))
        .catch(() => setUsers([]))
    }
  }, [])

  function toggleUser(username) {
    const s = new Set(selected)
    if (s.has(username)) s.delete(username)
    else s.add(username)
    setSelected(s)
  }

  function confirm() {
    const arr = Array.from(selected)
    setVisible(false)
    if (typeof callback === 'function') callback(arr)
  }

  if (!visible) return null

  return (
    <div id="all-users-modal" style={{position:'fixed',inset:0,display:'flex',justifyContent:'center',alignItems:'center',background:'rgba(30,41,59,0.45)',zIndex:1100}}>
      <div className="all-users-modal-content" style={{background:'#f8fafc',borderRadius:14,padding:32,width:480,maxWidth:'95vw'}}>
        <button className="close-all-users-modal" onClick={() => setVisible(false)} style={{position:'absolute',right:12,top:12}}>×</button>
        <h2 style={{fontSize:'1.3rem',fontWeight:700}}>Select Users</h2>
        <div id="users-list" style={{maxHeight:340,overflowY:'auto',marginTop:12}}>
          {users.length === 0 ? <em>Loading users...</em> : users.map(u => (
            <div key={u.username} className="user-list-item" style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #e5e7eb',cursor:'pointer'}} onClick={() => toggleUser(u.username)}>
              <input className="user-checkbox" type="checkbox" checked={selected.has(u.username)} onChange={() => toggleUser(u.username)} />
              <label>{u.username} <span style={{color:'#888',fontSize:'0.95em'}}>({u.permissions?.is_admin ? 'Admin' : 'User'})</span></label>
            </div>
          ))}
        </div>
        <button id="select-users-ok" onClick={confirm} style={{marginTop:10,padding:'12px 0',background:'#2563eb',color:'#fff',border:'none',borderRadius:7,width:'100%'}}>OK</button>
      </div>
    </div>
  )
}
