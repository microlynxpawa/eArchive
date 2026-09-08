import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/*
 * Analytics (super admin)
 *
 * Rebuilt on Hyper markup. Same gate, same three endpoints, same eight cards,
 * same twelve table columns and the same filters.
 *
 * The one thing worth naming: uploads, views and deletions count SESSIONS in
 * which the thing happened, not how many times it happened. That was only ever
 * conveyed by title attributes on the table headers, which never show on touch
 * and are easy to miss, so the numbers read as activity counts and were wrong
 * by a lot. It is now said on the page and the columns are named accordingly.
 */

const PERIOD_LABELS = { today: 'Today', week: 'This week', month: 'This month', custom: 'Custom' }

/*
 * Mirrors resolvePeriod() in adminController.js so the range shown is the range
 * actually queried. Note "this week" starts on Sunday and "this month" ends
 * today, not at month end - which is exactly why showing it matters.
 */
function resolveRange(period, from, to) {
  const now = new Date()
  if (period === 'today') return [startOfDay(now), now]
  if (period === 'week') {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    return [startOfDay(start), now]
  }
  if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), now]
  return [from ? new Date(from) : null, to ? new Date(to) : now]
}

function startOfDay(d) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function formatRange([start, end]) {
  if (!start) return 'everything up to today'
  const opts = { day: 'numeric', month: 'long', year: 'numeric' }
  const a = start.toLocaleDateString(undefined, opts)
  const b = end.toLocaleDateString(undefined, opts)
  return a === b ? a : `${a} – ${b}`
}

function formatSize(sizeObj) {
  if (!sizeObj) return '—'
  if (sizeObj.gb >= 1) return `${sizeObj.gb} GB`
  if (sizeObj.mb >= 1) return `${sizeObj.mb} MB`
  return `${sizeObj.kb} KB`
}

/* Eight cards, coloured by kind so they can be scanned rather than read. */
const STAT_CARDS = [
  { key: 'uniqueUsers', label: 'Unique users signed in', icon: 'mdi-account-group-outline', tone: 'primary' },
  { key: 'totalSessions', label: 'Total sign-in sessions', icon: 'mdi-login', tone: 'primary' },
  { key: 'sessionsWithUploads', label: 'Sessions with an upload', icon: 'mdi-cloud-upload-outline', tone: 'success' },
  { key: 'filesUploaded', label: 'Files uploaded', icon: 'mdi-file-plus-outline', tone: 'success' },
  { key: 'sessionsWithViews', label: 'Sessions with a view', icon: 'mdi-eye-outline', tone: 'info' },
  { key: 'sessionsWithDeletions', label: 'Sessions with a deletion', icon: 'mdi-delete-outline', tone: 'danger' },
  { key: 'sendOps', label: 'Send operations', icon: 'mdi-send-outline', tone: 'warning' },
  { key: 'filesSent', label: 'Total files sent', icon: 'mdi-file-send-outline', tone: 'warning' },
]

function StatCard({ card, value, loading }) {
  return (
    <div className="col-6 col-md-4 col-lg-3">
      <div className="card h-100">
        <div className="card-body p-3">
          <div className="d-flex align-items-center">
            <div className="avatar-sm me-2 flex-shrink-0">
              <span className={`avatar-title bg-${card.tone}-lighten text-${card.tone} rounded`}>
                <i className={`mdi ${card.icon} font-18`} />
              </span>
            </div>
            <div className="min-w-0">
              {loading
                ? <span className="placeholder-glow"><span className="placeholder col-6" /></span>
                : <h3 className={`mb-0 text-${card.tone}`} style={{ fontWeight: 700 }}>{value ?? '—'}</h3>}
              <p className="mb-0 text-muted font-12">{card.label}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function UploadChart({ data, loading }) {
  if (loading) {
    return <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary" /></div>
  }
  if (!data || data.length === 0) {
    return <p className="text-muted text-center py-3 mb-0">No files were added in this period.</p>
  }
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="pt-1">
      {data.map((d, i) => (
        <div key={i} className="d-flex align-items-center mb-2" style={{ gap: 12 }}>
          <span className="text-muted font-13 text-end flex-shrink-0" style={{ width: 92 }}>{d.date}</span>
          <div className="flex-grow-1 rounded" style={{ background: '#eef2f7', height: 22 }}>
            <div
              className="bg-primary rounded"
              style={{
                width: `${Math.max(Math.round((d.count / max) * 100), d.count > 0 ? 2 : 0)}%`,
                height: '100%',
                minWidth: d.count > 0 ? 6 : 0,
              }}
            />
          </div>
          <span className="fw-bold font-13 flex-shrink-0" style={{ width: 34 }}>{d.count}</span>
        </div>
      ))}
    </div>
  )
}

/* Search index health, from ticket #13. */
function SearchIndexCard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/admin/search-index/status', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load index status')
      setStats(await res.json())
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const pct = stats ? Math.round((stats.coverage || 0) * 100) : 0
  const remaining = stats ? (stats.byStatus.pending + stats.byStatus.running + stats.untracked) : 0

  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">Search index</h5>
        <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="card-body">
        {error && <p className="text-danger mb-0">{error}</p>}
        {!error && !stats && loading && <div className="spinner-border spinner-border-sm text-primary" />}
        {!error && stats && (
          <>
            <div className="d-flex justify-content-between align-items-end mb-1">
              <span className="font-13 text-muted">
                {stats.byStatus.done + stats.byStatus.skipped} of {stats.totalFiles} files processed
              </span>
              <span className="fw-bold text-primary">{pct}%</span>
            </div>
            <div className="progress mb-3" style={{ height: 10 }}>
              <div className="progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <div className="row g-2">
              {[
                ['Searchable by content', stats.byStatus.done],
                ['Waiting to be read', stats.byStatus.pending + stats.untracked],
                ['Being read now', stats.byStatus.running],
                ['No text found', stats.byStatus.skipped],
                ['Failed', stats.byStatus.failed],
              ].map(([label, value]) => (
                <div className="col-6 col-md-4 col-lg" key={label}>
                  <div className="p-2 rounded" style={{ background: '#f7f7fb' }}>
                    <div className="fw-bold" style={{ fontSize: '1.1rem' }}>{value}</div>
                    <div className="text-muted font-12">{label}</div>
                  </div>
                </div>
              ))}
            </div>
            {remaining > 0 && (
              <p className="text-muted font-12 mb-0 mt-2">
                {remaining} file{remaining === 1 ? ' is' : 's are'} still queued. They are findable by
                name, date and uploader in the meantime.
              </p>
            )}
            {stats.byStatus.failed > 0 && (
              <p className="text-danger font-12 mb-0 mt-2">
                {stats.byStatus.failed} file{stats.byStatus.failed === 1 ? ' ' : 's '}
                could not be read after several attempts.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
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

  // Access is settled before any analytics request goes out.
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

  const buildParams = useCallback(() => {
    const p = new URLSearchParams({ period })
    if (period === 'custom' && customFrom) p.set('from', customFrom)
    if (period === 'custom' && customTo) p.set('to', customTo)
    return p.toString()
  }, [period, customFrom, customTo])

  const fetchAnalytics = useCallback(async () => {
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
      console.error('[analytics]', err)
    } finally {
      setLoadingMetrics(false)
    }
  }, [buildParams])

  useEffect(() => {
    if (!authorized) return
    fetchAnalytics()
  }, [authorized, fetchAnalytics])

  /* Deliberately not loaded with the page: the folder scan walks the archive. */
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

  const filtered = useMemo(() => perUser.filter((u) => {
    if (userFilter &&
      !(u.username || '').toLowerCase().includes(userFilter.toLowerCase()) &&
      !(u.fullname || '').toLowerCase().includes(userFilter.toLowerCase())) return false
    if (branchFilter && !(u.branch || '').toLowerCase().includes(branchFilter.toLowerCase())) return false
    if (deptFilter && !(u.department || '').toLowerCase().includes(deptFilter.toLowerCase())) return false
    return true
  }), [perUser, userFilter, branchFilter, deptFilter])

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1
  const paginated = filtered.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  useEffect(() => { setPage(1) }, [userFilter, branchFilter, deptFilter, rowsPerPage])

  if (authorized === null) {
    return (
      <div style={{ minHeight: '60vh' }} className="d-flex align-items-center justify-content-center">
        <div className="spinner-border text-primary" role="status" />
      </div>
    )
  }

  const range = resolveRange(period, customFrom, customTo)

  return (
    <>
      <style>{PAGE_CSS}</style>

      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Analytics</h4>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ period selector */}
      <div className="card mb-3">
        <div className="card-body py-2 px-3">
          <div className="d-flex flex-wrap align-items-center" style={{ gap: 8 }}>
            <span className="fw-semibold font-13">Period:</span>
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
                  type="date" className="form-control form-control-sm" style={{ width: 150 }}
                  value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                />
                <span className="text-muted">—</span>
                <input
                  type="date" className="form-control form-control-sm" style={{ width: 150 }}
                  value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                />
              </div>
            )}

            {/* "This month" never said which dates it meant. */}
            <span className="text-muted font-13 ms-auto">
              <i className="mdi mdi-calendar-range me-1" />{formatRange(range)}
            </span>
          </div>
        </div>
      </div>

      {/* The single most misreadable thing on this page. */}
      <div className="alert alert-info py-2 px-3 font-13">
        <i className="mdi mdi-information-outline me-1" />
        Uploads, views and deletions count <strong>sessions in which the action happened</strong>,
        not how many times it happened.
      </div>

      <div className="row g-3 mb-3">
        {STAT_CARDS.map((card) => (
          <StatCard
            key={card.key}
            card={card}
            value={metrics?.[card.key]}
            loading={loadingMetrics && !metrics}
          />
        ))}
      </div>

      <div className="row">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Files added</h5>
            </div>
            <div className="card-body">
              <UploadChart data={uploadTrend} loading={loadingMetrics} />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------ storage */}
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Storage and database</h5>
              <button className="btn btn-sm btn-outline-secondary" onClick={fetchStorageInfo} disabled={loadingStorage}>
                {loadingStorage
                  ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Measuring…</>
                  : <><i className="mdi mdi-refresh me-1" />Refresh</>}
              </button>
            </div>
            <div className="card-body">
              {!storageInfo && !loadingStorage && (
                <div className="text-center py-3">
                  <i className="mdi mdi-database-search-outline text-muted" style={{ fontSize: 32 }} />
                  <p className="text-muted mb-0 mt-2">
                    Not measured yet. Scanning the archive folder takes a few seconds, so it runs
                    only when you ask for it.
                  </p>
                </div>
              )}
              {loadingStorage && (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                  <p className="text-muted mb-0 mt-2">Scanning the archive folder…</p>
                </div>
              )}
              {storageInfo && !loadingStorage && (
                <div className="row text-center">
                  {[['Archive folder', storageInfo.folder], ['Database', storageInfo.db]].map(([label, size]) => (
                    <div className="col-6" key={label}>
                      <h3 className="text-primary mb-0" style={{ fontWeight: 700 }}>{formatSize(size)}</h3>
                      <p className="text-muted font-12 mb-0">{label}</p>
                      <small className="text-muted">{(size?.bytes || 0).toLocaleString()} bytes</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- per-user table */}
      <div className="card">
        <div className="card-header">
          <div className="d-flex justify-content-between align-items-center flex-wrap" style={{ gap: 8 }}>
            <h5 className="card-title mb-0">Per-user breakdown</h5>
            <div className="d-flex flex-wrap" style={{ gap: 6 }}>
              <input
                type="text" className="form-control form-control-sm" style={{ width: 160 }}
                placeholder="Name or username"
                value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
              />
              <input
                type="text" className="form-control form-control-sm" style={{ width: 130 }}
                placeholder="Branch"
                value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
              />
              <input
                type="text" className="form-control form-control-sm" style={{ width: 130 }}
                placeholder="Department"
                value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
              />
              <select
                className="form-select form-select-sm" style={{ width: 76 }}
                value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))}
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-centered table-nowrap table-hover mb-0 sa-clickable">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Branch</th>
                  <th>Department</th>
                  <th>Sign-ins</th>
                  <th>Upload sessions</th>
                  <th>View sessions</th>
                  <th>Delete sessions</th>
                  <th>Files added</th>
                  <th>Sent</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {loadingMetrics && (
                  <tr><td colSpan={12} className="text-center py-4">
                    <div className="spinner-border spinner-border-sm text-primary" />
                  </td></tr>
                )}
                {!loadingMetrics && paginated.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-4 text-muted">
                    No activity for this period.
                  </td></tr>
                )}
                {!loadingMetrics && paginated.map((u, idx) => (
                  <tr
                    key={u.userId}
                    onClick={() => navigate('/audit-log')}
                    title={`Open the audit trail — search for ${u.username}`}
                  >
                    <td>{(page - 1) * rowsPerPage + idx + 1}</td>
                    <td>{u.fullname}</td>
                    <td className="text-muted">{u.username}</td>
                    <td>{u.branch}</td>
                    <td>{u.department}</td>
                    <td><strong>{u.loginCount}</strong></td>
                    <td>{u.uploadSessions}</td>
                    <td>{u.viewSessions}</td>
                    {/* deletions are rare and the thing most likely being looked for */}
                    <td>
                      {u.deleteSessions > 0
                        ? <span className="badge bg-danger-lighten text-danger">{u.deleteSessions}</span>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td>{u.filesOnDisk}</td>
                    <td>{u.filesSent}</td>
                    <td>{u.filesReceived}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-2">
            <span className="text-muted font-13">
              {filtered.length} user{filtered.length === 1 ? '' : 's'} with activity
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

      <div className="mt-3">
        <SearchIndexCard />
      </div>
    </>
  )
}

/* Rows navigate, so they need to look like they do. */
const PAGE_CSS = `
.sa-clickable tbody tr{cursor:pointer}
.sa-clickable tbody tr:hover{background:#f1f3fa}
`
