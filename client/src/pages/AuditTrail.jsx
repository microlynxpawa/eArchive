import React, { useEffect, useState, useRef } from 'react'

export default function AuditTrail() {
  const [searchValue, setSearchValue] = useState('')
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const lastUserIdRef = useRef(null)

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

  const fetchAndDisplayAuditLogs = async (userId, dateSearch = null) => {
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
      await fetchAndDisplayAuditLogs(userData.id)
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
      await fetchAndDisplayAuditLogs(userData.id)
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
    // on mount nothing to do; we wait for a user search
  }, [])

  return (
    <div className="container-fluid">
      <div className="mb-3">
        <div className="input-group">
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
        <small id="search-format-hint" style={{display:'none', color:'#22c55e', fontSize:'0.95em'}}>Tip: Search by date (e.g. 2024-06-20, 20/06/2024) or time (e.g. 14:30)</small>
      </div>

      <div className="row">
        <div className="col-sm-12">
          <div className="card">
            <div className="card-header pb-0">
              <h3>User Audit Trail</h3>
              <p className="text-green">Search User to view their history.</p>
            </div>
            <div className="card-body">
              <div className="table-responsive theme-scrollbar">
                <table className="display table" id="audit-log-table">
                  <thead>
                    <tr>
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
                      <tr><td colSpan={8}>Loading...</td></tr>
                    )}
                    {!loading && logs.length === 0 && (
                      <tr><td colSpan={8}>No records</td></tr>
                    )}
                    {!loading && logs.map((log, idx) => (
                      <tr key={idx}>
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
