import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

function StatCard({ label, value, loading }) {
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100">
        <div className="card-body text-center py-3">
          {loading ? (
            <div className="spinner-border spinner-border-sm text-primary my-2" />
          ) : (
            <h3 style={{ fontWeight: 700, color: '#7367f0', margin: 0 }}>{value ?? '—'}</h3>
          )}
          <p className="mb-0 mt-1" style={{ fontSize: '0.82rem', color: '#333', fontWeight: 500 }}>{label}</p>
        </div>
      </div>
    </div>
  )
}

function MiniBarChart({ data }) {
  if (!data || data.length === 0) {
    return <p style={{ color: '#444', textAlign: 'center', padding: '12px 0' }}>No upload data for this period.</p>
  }
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ padding: '4px 0' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ width: 90, textAlign: 'right', fontSize: '0.85rem', color: '#222', fontWeight: 500, flexShrink: 0 }}>
            {d.date}
          </span>
          <div style={{ flex: 1, background: '#e9e9f3', borderRadius: 5, height: 26 }}>
            <div style={{
              width: `${Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 2 : 0)}%`,
              background: '#7367f0',
              height: '100%',
              borderRadius: 5,
              minWidth: d.count > 0 ? 6 : 0,
            }} />
          </div>
          <span style={{ width: 32, fontSize: '0.88rem', color: '#222', fontWeight: 700, flexShrink: 0 }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatSize(sizeObj) {
  if (!sizeObj) return '—'
  if (sizeObj.gb >= 1) return `${sizeObj.gb} GB`
  if (sizeObj.mb >= 1) return `${sizeObj.mb} MB`
  return `${sizeObj.kb} KB`
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()

  const [authorized, setAuthorized] = useState(null)
  const [period, setPeriod] = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [metrics, setMetrics] = useState(null)
  const [perUser, setPerUser] = useState([])
  const [uploadTrend, setUploadTrend] = useState([])
  const [loadingMetrics, setLoadingMetrics] = useState(false)
  const [storageInfo, setStorageInfo] = useState(null)
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [userFilter, setUserFilter] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  // Auth check
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/admin/dashboard-data', { credentials: 'include' })
        if (!res.ok) { navigate('/', { replace: true }); return }
        const data = await res.json()
        if (!data.auths?.is_super_admin) {
          navigate('/dashboard', { replace: true })
          return
        }
        setAuthorized(true)
      } catch {
        navigate('/', { replace: true })
      }
    })()
  }, [navigate])

  useEffect(() => {
    if (!authorized) return
    fetchAnalytics()
  }, [authorized, period, customFrom, customTo])

  const buildParams = () => {
    const p = new URLSearchParams({ period })
    if (period === 'custom' && customFrom) p.set('from', customFrom)
    if (period === 'custom' && customTo) p.set('to', customTo)
    return p.toString()
  }

  const fetchAnalytics = async () => {
    setLoadingMetrics(true)
    try {
      const res = await fetch(`/admin/super-dashboard?${buildParams()}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setMetrics(data.metrics || null)
      setPerUser(data.perUser || [])
      setUploadTrend(data.uploadTrend || [])
      setPage(1)
    } catch (err) {
      console.error('[SuperAdminDashboard]', err)
    } finally {
      setLoadingMetrics(false)
    }
  }

  const fetchStorageInfo = async () => {
    setLoadingStorage(true)
    try {
      const res = await fetch('/admin/storage-info', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed')
      setStorageInfo(await res.json())
    } catch (err) {
      console.error('[storageInfo]', err)
    } finally {
      setLoadingStorage(false)
    }
  }

  // Client-side filter + pagination
  const filtered = perUser.filter(u => {
    if (userFilter && !u.username.toLowerCase().includes(userFilter.toLowerCase()) && !u.fullname.toLowerCase().includes(userFilter.toLowerCase())) return false
    if (branchFilter && !u.branch.toLowerCase().includes(branchFilter.toLowerCase())) return false
    if (deptFilter && !u.department.toLowerCase().includes(deptFilter.toLowerCase())) return false
    return true
  })
  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  if (authorized === null) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner-border text-primary" role="status" />
      </div>
    )
  }

  const statCards = [
    { label: 'Unique Users Logged In',    value: metrics?.uniqueUsers },
    { label: 'Total Login Sessions',       value: metrics?.totalSessions },
    { label: 'Sessions with Uploads',      value: metrics?.sessionsWithUploads },
    { label: 'Files Uploaded (on disk)',   value: metrics?.filesUploaded },
    { label: 'Sessions with Views',        value: metrics?.sessionsWithViews },
    { label: 'Sessions with Deletions',    value: metrics?.sessionsWithDeletions },
    { label: 'Send Operations',            value: metrics?.sendOps },
    { label: 'Total Files Sent',           value: metrics?.filesSent },
  ]

  const PERIOD_LABELS = { today: 'Today', week: 'This Week', month: 'This Month', custom: 'Custom' }

  return (
    <div className="container-fluid pb-4">
      {/* Header */}
      <div className="mb-4 pt-2">
        <h4 style={{ fontWeight: 700, margin: 0, color: '#222' }}>Analytics Dashboard</h4>
        <small style={{ color: '#555' }}>Super admin view — not linked from navigation</small>
      </div>

      {/* Period selector */}
      <div className="card mb-4">
        <div className="card-body py-2 px-3">
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#222' }}>Period:</span>
            {Object.entries(PERIOD_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={`btn btn-sm ${period === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => { setPeriod(key); setPage(1) }}
              >
                {label}
              </button>
            ))}
            {period === 'custom' && (
              <div className="d-flex align-items-center" style={{ gap: 6 }}>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 145 }}
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                />
                <span style={{ color: '#333' }}>—</span>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  style={{ width: 145 }}
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="row g-3 mb-4">
        {statCards.map((card, i) => (
          <StatCard key={i} label={card.label} value={card.value} loading={loadingMetrics && !metrics} />
        ))}
      </div>

      {/* Per-user table */}
      <div className="card mb-4">
        <div className="card-header" style={{ background: 'rgba(245,245,245,0.95)', borderBottom: '1px solid #e0e0e0' }}>
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
            <h6 className="mb-0" style={{ fontWeight: 700, color: '#222' }}>Per-User Breakdown</h6>
            <div className="d-flex flex-wrap" style={{ gap: 6 }}>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search user…"
                style={{ width: 150 }}
                value={userFilter}
                onChange={e => { setUserFilter(e.target.value); setPage(1) }}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Branch…"
                style={{ width: 120 }}
                value={branchFilter}
                onChange={e => { setBranchFilter(e.target.value); setPage(1) }}
              />
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Department…"
                style={{ width: 130 }}
                value={deptFilter}
                onChange={e => { setDeptFilter(e.target.value); setPage(1) }}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: 70 }}
                value={rowsPerPage}
                onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1) }}
              >
                {[10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="card-body p-0">
          <div className="d-flex justify-content-between align-items-center px-3 py-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
            <small style={{ color: '#444' }}>{filtered.length} user(s)</small>
            <div className="d-flex align-items-center" style={{ gap: 4 }}>
              <small style={{ color: '#444' }}>Page {page} of {totalPages}</small>
              <button className="btn btn-sm btn-light py-0 px-2" disabled={page === 1} onClick={() => setPage(p => p - 1)}>&lt;</button>
              <button className="btn btn-sm btn-light py-0 px-2" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>&gt;</button>
            </div>
          </div>
          <div className="table-responsive theme-scrollbar">
            <table className="table table-hover mb-0" style={{ fontSize: '0.88rem' }}>
              <thead style={{ background: '#f8f9fa', color: '#222' }}>
                <tr>
                  <th style={{ color: '#222' }}>#</th>
                  <th style={{ color: '#222' }}>Name</th>
                  <th style={{ color: '#222' }}>Username</th>
                  <th style={{ color: '#222' }}>Branch</th>
                  <th style={{ color: '#222' }}>Department</th>
                  <th style={{ color: '#222' }} title="Login sessions in period">Logins</th>
                  <th style={{ color: '#222' }} title="Sessions that included an upload">Uploads</th>
                  <th style={{ color: '#222' }} title="Sessions that included a view">Views</th>
                  <th style={{ color: '#222' }} title="Sessions that included a deletion">Deletions</th>
                  <th style={{ color: '#222' }} title="Files currently on disk uploaded in period">Files on Disk</th>
                  <th style={{ color: '#222' }}>Sent</th>
                  <th style={{ color: '#222' }}>Received</th>
                </tr>
              </thead>
              <tbody>
                {loadingMetrics && (
                  <tr><td colSpan={12} className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></td></tr>
                )}
                {!loadingMetrics && paginated.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-4" style={{ color: '#444' }}>No activity for this period.</td></tr>
                )}
                {!loadingMetrics && paginated.map((u, idx) => (
                  <tr
                    key={u.userId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate('/audit-log')}
                    title={`Click to view audit trail — search for ${u.username}`}
                  >
                    <td style={{ color: '#222' }}>{(page - 1) * rowsPerPage + idx + 1}</td>
                    <td style={{ color: '#222' }}>{u.fullname}</td>
                    <td><code style={{ fontSize: '0.82rem', color: '#333' }}>{u.username}</code></td>
                    <td style={{ color: '#222' }}>{u.branch}</td>
                    <td style={{ color: '#222' }}>{u.department}</td>
                    <td style={{ color: '#222' }}><strong>{u.loginCount}</strong></td>
                    <td style={{ color: '#222' }}>{u.uploadSessions}</td>
                    <td style={{ color: '#222' }}>{u.viewSessions}</td>
                    <td style={{ color: '#222' }}>{u.deleteSessions}</td>
                    <td style={{ color: '#222' }}>{u.filesOnDisk}</td>
                    <td style={{ color: '#222' }}>{u.filesSent}</td>
                    <td style={{ color: '#222' }}>{u.filesReceived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upload trend chart */}
      <div className="card mb-4">
        <div className="card-header" style={{ background: 'rgba(245,245,245,0.95)', borderBottom: '1px solid #e0e0e0' }}>
          <h6 className="mb-0" style={{ fontWeight: 700, color: '#222' }}>Upload Activity Over Time</h6>
          <small style={{ color: '#555' }}>Files uploaded (currently on disk, by creation date)</small>
        </div>
        <div className="card-body">
          {loadingMetrics ? (
            <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
          ) : (
            <MiniBarChart data={uploadTrend} />
          )}
        </div>
      </div>

      {/* Storage info */}
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center" style={{ background: 'rgba(245,245,245,0.95)', borderBottom: '1px solid #e0e0e0' }}>
          <div>
            <h6 className="mb-0" style={{ fontWeight: 700, color: '#222' }}>Storage & Database Size</h6>
            <small style={{ color: '#555' }}>Computed on demand — click Refresh</small>
          </div>
          <button
            className="btn btn-sm btn-outline-primary"
            onClick={fetchStorageInfo}
            disabled={loadingStorage}
          >
            {loadingStorage
              ? <><span className="spinner-border spinner-border-sm me-1" />Loading…</>
              : 'Refresh'}
          </button>
        </div>
        <div className="card-body">
          {!storageInfo && !loadingStorage && (
            <p style={{ color: '#444', marginBottom: 0 }}>Click Refresh to compute live storage metrics.</p>
          )}
          {loadingStorage && (
            <div className="text-center py-3"><div className="spinner-border text-primary" /></div>
          )}
          {storageInfo && !loadingStorage && (
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <div className="card border" style={{ background: '#f8f9ff' }}>
                  <div className="card-body text-center py-4">
                    <h3 style={{ fontWeight: 700, color: '#7367f0', margin: 0 }}>{formatSize(storageInfo.folder)}</h3>
                    <p className="mb-1 mt-2" style={{ fontWeight: 600, color: '#222' }}>Upload Folder Size</p>
                    <small style={{ color: '#555' }}>{(storageInfo.folder?.bytes || 0).toLocaleString()} bytes</small>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="card border" style={{ background: '#f8f9ff' }}>
                  <div className="card-body text-center py-4">
                    <h3 style={{ fontWeight: 700, color: '#7367f0', margin: 0 }}>{formatSize(storageInfo.db)}</h3>
                    <p className="mb-1 mt-2" style={{ fontWeight: 600, color: '#222' }}>Database Size</p>
                    <small style={{ color: '#555' }}>{(storageInfo.db?.bytes || 0).toLocaleString()} bytes</small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
