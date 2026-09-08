import React, { useEffect, useMemo, useRef, useState } from 'react'
import UserPickerModal from '../components/UserPickerModal'

/*
 * Audit trail
 *
 * The log is per user, so the page shows nothing until somebody is chosen.
 * Both ways of choosing are kept: typing a username, and the picker. Each
 * resolves through /admin/getUser/:username to an id and then loads
 * /admin/audit-log/:userId - unchanged.
 *
 * One row per sign-in session. `viewed`, `uploaded` and `deleted` are booleans
 * the backend flips the first time each thing happens in a session, so they are
 * shown as Yes / No with that stated - a bare column of true/false invites
 * being read as a tally.
 */

function formatMoment(value) {
  if (!value) return ''
  const d = new Date(value)
  return isNaN(d) ? '' : d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function initialsOf(name) {
  return String(name || '?')
    .split(/[\s.@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

/** Yes / No, deliberately not a count. */
function Flag({ value }) {
  return value
    ? <span className="badge bg-success-lighten text-success"><i className="mdi mdi-check me-1" />Yes</span>
    : <span className="badge bg-light text-muted"><i className="mdi mdi-minus me-1" />No</span>
}

export default function AuditTrail() {
  const [searchValue, setSearchValue] = useState('')
  const [subject, setSubject] = useState(null)   // the user whose log is shown
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const userPickerRef = useRef(null)

  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div')
    toast.className = 'custom-toast-notification ' + (type === 'success' ? 'toast-success' : 'toast-error')
    toast.innerText = message
    Object.assign(toast.style, {
      position: 'fixed', bottom: '30px', right: '30px', padding: '12px 20px',
      color: '#fff', borderRadius: '6px', fontSize: '0.95rem', zIndex: 12000,
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2500)
  }

  useEffect(() => { setPage(1) }, [rowsPerPage, subject])

  const loadLogs = async (userId) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/admin/audit-log/${encodeURIComponent(userId)}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch audit logs')
      const data = await res.json()
      setLogs(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[audit] logs', err)
      setError(err.message || 'Failed to fetch audit logs')
      setLogs([])
      showToast('Failed to fetch audit logs.', 'error')
    }
    setLoading(false)
  }

  /** Both routes to choosing a person come through here. */
  const selectUsername = async (username) => {
    const name = (username || '').trim()
    if (!name) {
      showToast('Please enter a username.', 'error')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/admin/getUser/${encodeURIComponent(name)}`, { credentials: 'include' })
      if (!res.ok) throw new Error('User not found')
      const user = await res.json()
      setSubject(user)
      setSearchValue(user.username || name)
      showToast(`User found: ${user.fullname || user.username}`, 'success')
      await loadLogs(user.id)
    } catch (err) {
      console.error('[audit] getUser', err)
      setSubject(null)
      setLogs([])
      setError('User not found or an error occurred.')
      showToast('User not found or an error occurred.', 'error')
      setLoading(false)
    }
  }

  const pickUser = async () => {
    if (!userPickerRef.current?.show) return
    const picked = await userPickerRef.current.show()
    if (!picked || picked.length === 0) return
    await selectUsername(picked[0])
  }

  const clearSubject = () => {
    setSubject(null)
    setLogs([])
    setSearchValue('')
    setError(null)
  }

  const totalRows = logs.length
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1
  const firstRow = totalRows === 0 ? 0 : (page - 1) * rowsPerPage + 1
  const lastRow = Math.min(page * rowsPerPage, totalRows)
  const paginated = useMemo(
    () => logs.slice((page - 1) * rowsPerPage, page * rowsPerPage),
    [logs, page, rowsPerPage]
  )

  // Department and branch are captured at sign-in and stored on the log row,
  // so read them from the first session rather than from the user record.
  const captured = logs[0] || {}

  return (
    <>
      <UserPickerModal ref={userPickerRef} />

      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Audit trail</h4>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">

              {/* Two routes to the same thing, now labelled as such. */}
              <div className="d-flex flex-wrap align-items-end mb-3" style={{ gap: 12 }}>
                <div>
                  <label className="form-label font-12 text-muted mb-1 d-block" htmlFor="au-username">
                    Type a username
                  </label>
                  <div className="input-group input-group-sm" style={{ width: 300 }}>
                    <input
                      id="au-username"
                      type="text"
                      className="form-control"
                      placeholder="e.g. akosua-mensah@headoffice"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') selectUsername(searchValue) }}
                    />
                    <button
                      className="btn btn-primary"
                      type="button"
                      onClick={() => selectUsername(searchValue)}
                      title="Load this user's log"
                    >
                      <i className="mdi mdi-magnify" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="form-label font-12 text-muted mb-1 d-block">Or pick from the list</label>
                  <button className="btn btn-sm btn-light border" style={{ width: 190 }} onClick={pickUser}>
                    <i className="mdi mdi-account-search-outline me-1" />Choose a user
                  </button>
                </div>

                {subject && (
                  <div className="ms-auto">
                    <label className="form-label font-12 text-muted mb-1 d-block" htmlFor="au-rows">Rows</label>
                    <select
                      id="au-rows"
                      className="form-select form-select-sm"
                      style={{ width: 76 }}
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                    >
                      {[5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Whose log is on screen - the page gave no persistent sign of this. */}
              {subject && (
                <div className="card shadow-none border mb-3">
                  <div className="card-body py-2 d-flex align-items-center flex-wrap" style={{ gap: 12 }}>
                    <div className="avatar-sm" style={{ height: '2.2rem', width: '2.2rem' }}>
                      <span className="avatar-title bg-primary-lighten text-primary rounded-circle">
                        {initialsOf(subject.fullname || subject.username)}
                      </span>
                    </div>
                    <div>
                      <div className="fw-bold">{subject.fullname || subject.username}</div>
                      <div className="text-muted font-12">{subject.username}</div>
                    </div>
                    <div className="text-muted font-13">
                      {(captured.department || captured.branch)
                        ? [captured.department, captured.branch].filter(Boolean).join(' · ')
                        : <span className="fst-italic">no department or branch recorded</span>}
                    </div>
                    <div className="text-muted font-13">
                      {totalRows} session{totalRows === 1 ? '' : 's'}
                    </div>
                    <button className="btn btn-sm btn-link text-muted p-0 ms-auto" onClick={clearSubject}>
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {loading && (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}

              {!loading && error && (
                <div className="alert alert-danger" role="alert">
                  <i className="mdi mdi-alert-circle-outline me-1" />{error}
                </div>
              )}

              {/* Resting state: nothing chosen yet. */}
              {!loading && !error && !subject && (
                <div className="text-center py-5">
                  <i className="mdi mdi-account-search-outline text-muted" style={{ fontSize: 38 }} />
                  <h5 className="mt-2 mb-1">Choose a user to begin</h5>
                  <p className="text-muted mb-0">
                    The audit trail is kept per person. Type a username or pick one from the list.
                  </p>
                </div>
              )}

              {/* Chosen, but they have never signed in - a different thing. */}
              {!loading && !error && subject && totalRows === 0 && (
                <div className="text-center py-5">
                  <i className="mdi mdi-history text-muted" style={{ fontSize: 38 }} />
                  <h5 className="mt-2 mb-1">No sessions recorded</h5>
                  <p className="text-muted mb-0">
                    {subject.fullname || subject.username} has not signed in yet.
                  </p>
                </div>
              )}

              {!loading && !error && subject && totalRows > 0 && (
                <>
                  <p className="text-muted font-13 mb-2">
                    One row per sign-in session. <strong>Viewed</strong>, <strong>uploaded</strong> and{' '}
                    <strong>deleted</strong> show whether the action happened at least once during that
                    session — they are not counts.
                  </p>

                  <div className="table-responsive">
                    <table className="table table-centered table-nowrap table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th>Name</th>
                          <th>Department</th>
                          <th>Branch</th>
                          <th>Signed in</th>
                          <th>Signed out</th>
                          <th>Viewed</th>
                          <th>Uploaded</th>
                          <th>Deleted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((log) => (
                          <tr key={log.id}>
                            <td>{log.name}</td>
                            <td className="text-muted">{log.department}</td>
                            <td className="text-muted">{log.branch}</td>
                            <td className="text-muted">{formatMoment(log.loginTime)}</td>
                            <td>
                              {log.logoutTime
                                ? <span className="text-muted">{formatMoment(log.logoutTime)}</span>
                                : <span className="badge bg-info-lighten text-info">Still signed in</span>}
                            </td>
                            <td><Flag value={log.viewed} /></td>
                            <td><Flag value={log.uploaded} /></td>
                            <td><Flag value={log.deleted} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <span className="text-muted font-13">
                      Showing {firstRow} to {lastRow} of {totalRows} session{totalRows === 1 ? '' : 's'}
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
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
