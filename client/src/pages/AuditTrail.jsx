import React, { useEffect, useState, useRef } from 'react'
import UserPickerModal from '../components/UserPickerModal'
import FileSendingHistoryModal from '../components/FileSendingHistoryModal'

export default function AuditTrail() {
  const [searchValue, setSearchValue] = useState('')
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)
  const lastUsernameRef = useRef(null)
  const userPickerModalRef = useRef(null)
  const fileSendingHistoryModalRef = useRef(null)

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

  const normalizeDateTime = (str) => {
    return (str || '')
      .toString()
      .replace(/[\/\-]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  const matchesDateTime = (cellValue, searchValue) => {
    if (!cellValue) return false
    const normCell = normalizeDateTime(cellValue.toString())
    const normSearch = normalizeDateTime(searchValue)
    return normCell.includes(normSearch)
  }

  const fetchAndDisplayAuditLogs = async (userId, dateSearch = null, username = null) => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/admin/audit-log/${encodeURIComponent(userId)}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      let filtered = data
      if (dateSearch) {
        filtered = data.filter((log) => {
          return (
            matchesDateTime(log.loginTime ? new Date(log.loginTime).toLocaleString() : '', dateSearch) ||
            matchesDateTime(log.logoutTime ? new Date(log.logoutTime).toLocaleString() : '', dateSearch)
          )
        })
      }
      setLogs(filtered)
      lastUserIdRef.current = userId
      lastUsernameRef.current = username
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch audit logs')
      setLogs([])
      showToast('Failed to fetch audit logs.', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchClick = async () => {
    const username = (searchValue || '').trim()
    if (!username) {
      showToast('Please enter a username.', 'error')
      return
    }
    try {
      const res = await fetch(`/admin/getUser/${encodeURIComponent(username)}`, { credentials: 'include' })
      if (!res.ok) throw new Error('User not found')
      const userData = await res.json()
      showToast(`User found: ${userData.fullname || userData.username}`, 'success')
      await fetchAndDisplayAuditLogs(userData.id, null, userData.username)
    } catch (err) {
      console.error('Error fetching user', err)
      showToast('User not found or an error occurred.', 'error')
    }
  }

  const handleInputChange = async (e) => {
    const val = e.target.value
    setSearchValue(val)
    if (!val) return

    // Try to resolve as username first
    try {
      const res = await fetch(`/admin/getUser/${encodeURIComponent(val)}`, { credentials: 'include' })
      if (!res.ok) return // not a username
      const userData = await res.json()
      await fetchAndDisplayAuditLogs(userData.id, null, userData.username)
      return
    } catch (err) {
      // ignore and treat as date/time
    }

    // If not a username, treat as date/time filter for the last fetched user
    const lastUserId = lastUserIdRef.current
    if (lastUserId) {
      await fetchAndDisplayAuditLogs(lastUserId, val)
    }
  }

  useEffect(() => {
    // wire up username modal search button
    setTimeout(() => {
      const btn = document.getElementById('search-username-btn')
      if (btn && userPickerModalRef.current?.show) {
        btn.onclick = async () => {
          const selectedUsernames = await userPickerModalRef.current.show()
          if (!selectedUsernames || !selectedUsernames.length) return
          const username = selectedUsernames[0]
          setSearchValue(username)
          try {
            const res = await fetch(`/admin/getUser/${encodeURIComponent(username)}`, { credentials: 'include' })
            if (!res.ok) throw new Error('User not found')
            const userData = await res.json()
            showToast(`User found: ${userData.fullname || userData.username}`, 'success')
            await fetchAndDisplayAuditLogs(userData.id, null, userData.username)
          } catch (err) {
            showToast('User not found or an error occurred.', 'error')
          }
        }
      }
    }, 200)
    // on mount nothing to do; we wait for a user search
  }, [])

  // Pagination logic
  const totalRows = logs.length
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const paginatedLogs = logs.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(Number(e.target.value))
    setPage(1)
  }
  const handlePageChange = (newPage) => {
    setPage(newPage)
  }

  return (
    <div className="container-fluid">
      <UserPickerModal ref={userPickerModalRef} />
      <FileSendingHistoryModal ref={fileSendingHistoryModalRef} />
      <div className="mb-3">
        <div className="input-group mb-2">
          <div className="input-group-prepend" id="searchButton">
            <button className="input-group-text mobile-search btn" onClick={handleSearchClick} style={{cursor:'pointer'}}>
              <i className="fa fa-search" />
            </button>
          </div>
          <input
            id="search-input"
            className="form-control"
            type="text"
            placeholder="Search Here........"
            value={searchValue}
            onChange={handleInputChange}
          />
        </div>
        <button id="search-username-btn" className="btn btn-outline-primary btn-sm" type="button" style={{marginTop:4}}>Search by Username</button>
        <small id="search-format-hint" style={{display:'none', color:'#22c55e', fontSize:'0.95em'}}>Tip: Search by date (e.g. 2024-06-20, 20/06/2024) or time (e.g. 14:30)</small>
      </div>

      <div className="row">
        <div className="col-sm-12">
          <div className="card">
            <div className="card-header pb-0 d-flex justify-content-between align-items-center" style={{gap: '0.5rem', background: 'rgba(245,245,245,0.95)', borderBottom: '1px solid #e0e0e0'}}>
              <h3 className="mb-0" style={{fontWeight: 700, fontSize: '1.35em', color: '#222'}}>User Audit Trail</h3>
              <div className="d-flex align-items-center" style={{gap: '0.5rem'}}>
                <button
                  className="btn btn-info btn-sm"
                  onClick={() => {
                    const userToShow = lastUsernameRef.current
                    if (!userToShow) {
                      alert('Please search for a user first to view their file sending history')
                      return
                    }
                    fileSendingHistoryModalRef.current?.show(userToShow)
                  }}
                  title="View file sending history for selected user"
                  disabled={!lastUsernameRef.current}
                  style={{visibility: 'hidden'}}
                >
                  📋 File Sending History
                </button>
                <div style={{background: 'rgba(255,255,255,0.85)', borderRadius: 6, padding: '2px 12px', border: '1px solid #e0e0e0'}}>
                  <label htmlFor="audit-rows-per-page" className="form-label mb-0" style={{fontWeight: 600, fontSize: '1em', color: '#222'}}>Rows</label>
                  <select id="audit-rows-per-page" value={rowsPerPage} onChange={handleRowsPerPageChange} style={{width: 56, height: 30, fontSize: '1em', padding: '0 6px', borderRadius: 4, border: '1px solid #bbb', color: '#222', background: '#fff'}}>
                    {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="px-3 pt-1 pb-0"><p className="text-green mb-0" style={{fontSize: '0.98em'}}>Search User to view their history.</p></div>
            <div className="card-body">
              <div className="d-flex justify-content-end align-items-center mb-2">
                <span style={{color:'#222', fontWeight:600, fontSize:'1em'}}>Page {page} of {totalPages}</span>
                <button className="btn btn-sm btn-light ms-2" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>&lt;</button>
                <button className="btn btn-sm btn-light ms-1" disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}>&gt;</button>
              </div>
              <div className="table-responsive theme-scrollbar">
                <table className="display table" id="audit-log-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Branch</th>
                      <th>Login Time</th>
                      <th>Logout Time</th>
                      <th>Viewed</th>
                      <th>Uploaded</th>
                      <th>Deleted</th>
                    </tr>
                  </thead>
                  <tbody id="audit-log-tbody">
                    {loading && (
                      <tr><td colSpan={9}>Loading...</td></tr>
                    )}
                    {!loading && paginatedLogs.length === 0 && (
                      <tr><td colSpan={9}>No records</td></tr>
                    )}
                    {!loading && paginatedLogs.map((log, idx) => (
                      <tr key={idx}>
                        <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                        <td>{log.name || 'N/A'}</td>
                        <td>{log.department || 'N/A'}</td>
                        <td>{log.branch || 'N/A'}</td>
                        <td>{log.loginTime ? new Date(log.loginTime).toLocaleString() : 'N/A'}</td>
                        <td>{log.logoutTime ? new Date(log.logoutTime).toLocaleString() : 'N/A'}</td>
                        <td>{log.viewed ? 'Viewed' : 'No activity'}</td>
                        <td>{log.uploaded ? 'Uploaded' : 'No activity'}</td>
                        <td>{log.deleted ? 'Deleted' : 'No activity'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
