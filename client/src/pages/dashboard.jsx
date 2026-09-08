import React, { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutContext } from '../components/Layout'

/*
 * Scanning is not in use at this deployment - there is no scanner integration
 * and no endpoint, which is why the Scan modal is a placeholder. The quick
 * action is still shown, disabled, saying so. Flip this when a real scan flow
 * lands.
 */
const SCANNING_ENABLED = false

/*
 * Dashboard
 *
 * Everything here comes from GET /admin/dashboard-data, which the shell already
 * fetched, so this page makes no request of its own.
 *
 * Gone from the previous version: a hardcoded weather widget with no data
 * behind it, a clock driven by setInterval on a global, and the innerHTML
 * writes that populated both.
 */

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatMoment(value) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d)) return null
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

// The three view flags are a hierarchy, so the broadest one wins.
function scopeSentence(auths, user) {
  const dept = user.archive_category?.name
  const branch = user.branch?.name
  if (auths.canViewBranchFiles) {
    return <>You can see files across <strong>your branch</strong>{branch ? ` (${branch})` : ''}.</>
  }
  if (auths.canViewDepartmentFiles) {
    return <>You can see files in <strong>your department</strong>{dept ? ` (${dept})` : ''}.</>
  }
  if (auths.canViewOwnFiles) {
    return <>You can see <strong>your own files</strong> only.</>
  }
  return <>You do not currently have access to any files.</>
}

/** One announcement row, shared by the Latest and History tabs. */
function Announcement({ m, last }) {
  return (
    <div className={`d-flex align-items-start ${last ? '' : 'border-bottom pb-2 mb-2'}`}>
      <div className="avatar-sm me-2">
        <span className="avatar-title bg-primary-lighten text-primary rounded">
          <i className="mdi mdi-bullhorn-outline font-18" />
        </span>
      </div>
      <div className="flex-grow-1">
        <p className="mb-0">{m.message}</p>
        {m.createdAt && <span className="font-12 text-muted">{formatMoment(m.createdAt)}</span>}
      </div>
    </div>
  )
}

const CAPABILITIES = [
  ['view_upload', 'View files'],
  ['archiving', 'Upload'],
  ['scanning', 'Scan'],
  ['supervision_right', 'Supervision'],
  ['email_notification', 'Email alerts'],
]

export default function Dashboard() {
  const { user = {}, auths = {}, messages = [] } = useContext(LayoutContext)

  const lastSession = Array.isArray(user.AuditLogs) && user.AuditLogs.length > 0
    ? user.AuditLogs[0]
    : null
  const lastIn = formatMoment(lastSession?.loginTime)
  const lastOut = formatMoment(lastSession?.logoutTime)

  const picture = user.profilePicturePath
    ? `/profile-pictures/${String(user.profilePicturePath).split(/[\\/]/).pop()}`
    : null

  const initials = (user.fullname || user.username || '?')
    .split(/[\s.]+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]).join('').toUpperCase()

  const firstName = (user.fullname || user.username || '').split(/[\s.]+/)[0]

  /*
   * Announcements. "Latest" is the five the shell already fetched, so the card
   * and the topbar bell can never disagree. "History" is everything ever
   * posted - nothing is deleted - paged twenty at a time, and only requested
   * when the tab is actually opened.
   */
  const [tab, setTab] = useState('latest')
  const [history, setHistory] = useState({ rows: [], total: 0, page: 1, loading: false })

  useEffect(() => {
    if (tab !== 'history') return
    let alive = true
    setHistory((h) => ({ ...h, loading: true }))
    ;(async () => {
      try {
        const res = await fetch(`/admin/messages?page=${history.page}&limit=20`, {
          credentials: 'include',
        })
        const data = await res.json()
        if (!alive) return
        setHistory((h) => ({
          ...h,
          rows: data.messages || [],
          total: data.total || 0,
          loading: false,
        }))
      } catch (err) {
        console.error('[dashboard] announcement history', err)
        if (alive) setHistory((h) => ({ ...h, loading: false }))
      }
    })()
    return () => { alive = false }
  }, [tab, history.page])

  /*
   * Four actions, always all four.
   *
   * An action the person cannot use is shown disabled with a reason, never
   * removed: a missing tile is indistinguishable from "not allowed", and the
   * grid used to reflow between users so no two people saw the same dashboard.
   */
  const quickActions = [
    {
      to: '/file-upload', icon: 'mdi-cloud-upload-outline',
      title: 'Upload files', hint: 'Single or batch',
      allowed: !!auths.archiving,
      reason: 'You do not have permission to upload',
    },
    {
      to: '/see-file', icon: 'mdi-folder-search-outline',
      title: 'Browse files', hint: 'Your archive',
      allowed: !!auths.view_upload,
      reason: 'You do not have permission to view files',
    },
    {
      to: '/send-files', icon: 'mdi-send-outline',
      title: 'Send files', hint: 'To a colleague',
      allowed: !!auths.view_upload,
      reason: 'You do not have permission to send files',
    },
    {
      to: '/file-upload', icon: 'mdi-scanner',
      title: 'Scan files', hint: 'From a scanner',
      // Not a permission problem: scanning is not in use at this deployment,
      // which is why the Scan modal is a placeholder. One line to turn on.
      allowed: SCANNING_ENABLED && !!auths.scanning,
      reason: SCANNING_ENABLED
        ? 'You do not have permission to scan'
        : 'Scanning is not enabled',
    },
  ]

  // An account with no permissions has nothing to land on; say so plainly.
  if (auths.is_disabled) {
    return (
      <div className="row justify-content-center">
        <div className="col-lg-6">
          <div className="card mt-4">
            <div className="card-body text-center py-5">
              <div className="avatar-lg m-auto">
                <span className="avatar-title bg-warning-lighten text-warning rounded-circle">
                  <i className="mdi mdi-account-cancel-outline" style={{ fontSize: 28 }} />
                </span>
              </div>
              <h4 className="mt-3">This account is disabled</h4>
              <p className="text-muted mb-0">
                You are signed in, but your access has been turned off.
                Contact your administrator to have it restored.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">Dashboard</h4>
          </div>
        </div>
      </div>

      <div className="row">
        {/*
          * who you are, and when you were last here
          *
          * h-100 makes the two cards in this row equal height. The spacing
          * below them has to move to the column, though: a card at h-100 fills
          * the column exactly, so its own margin-bottom falls outside the row
          * and is swallowed — leaving Quick actions sitting flush against
          * these two with none of the 24px gap every other card gets.
          */}
        <div className="col-xl-8 mb-3">
          <div className="card h-100 mb-0">
            <div className="card-body">
              <div className="d-flex align-items-center flex-wrap">
                {picture ? (
                  <img src={picture} className="rounded-circle avatar-lg me-3" alt="profile" />
                ) : (
                  <span
                    className="rounded-circle bg-primary-lighten text-primary me-3 d-inline-flex align-items-center justify-content-center"
                    style={{ width: 72, height: 72, fontSize: 24, fontWeight: 600 }}
                  >
                    {initials}
                  </span>
                )}

                <div className="flex-grow-1">
                  <h4 className="mt-0 mb-1">
                    {greeting()}{firstName ? `, ${firstName}` : ''}
                  </h4>
                  <p className="text-muted mb-2">
                    {user.branch?.name && (
                      <><i className="mdi mdi-domain me-1" />{user.branch.name}</>
                    )}
                    {user.archive_category?.name && (
                      <>
                        <span className="mx-2 text-black-50">·</span>
                        <i className="mdi mdi-sitemap-outline me-1" />{user.archive_category.name}
                      </>
                    )}
                    {user.username && (
                      <>
                        <span className="mx-2 text-black-50">·</span>
                        <span className="font-13">{user.username}</span>
                      </>
                    )}
                  </p>
                  <p className="mb-0 font-13 text-muted">
                    {lastIn
                      ? <>Last signed in {lastIn}{lastOut ? `, signed out ${lastOut}` : ', still signed in'}.</>
                      : <>This looks like your first session.</>}
                  </p>
                </div>

                <div className="text-end d-none d-md-block">
                  <Link to="/edit-profile" className="btn btn-light btn-sm">
                    <i className="mdi mdi-account-edit-outline me-1" />My profile
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* what you are allowed to do */}
        <div className="col-xl-4 mb-3">
          <div className="card h-100 mb-0">
            <div className="card-body">
              <h5 className="card-title mb-2">Your access</h5>

              <div className="mb-2">
                {CAPABILITIES.map(([flag, label]) => (
                  <span
                    key={flag}
                    className={`badge p-1 px-2 mb-1 me-1 ${auths[flag]
                      ? 'bg-success-lighten text-success'
                      : 'bg-light text-muted'}`}
                  >
                    <i className={`mdi ${auths[flag] ? 'mdi-check' : 'mdi-minus'} me-1`} />
                    {label}
                  </span>
                ))}
                {auths.is_admin && (
                  <span className="badge bg-primary-lighten text-primary p-1 px-2 mb-1 me-1">
                    <i className="mdi mdi-shield-key-outline me-1" />Administrator
                  </span>
                )}
                {auths.is_super_admin && (
                  <span className="badge bg-danger-lighten text-danger p-1 px-2 mb-1">
                    <i className="mdi mdi-chart-box-outline me-1" />Super admin
                  </span>
                )}
              </div>

              <hr className="my-2" />
              <p className="mb-0 font-13 text-muted">{scopeSentence(auths, user)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title mb-3">Quick actions</h5>
              <div className="row g-2">
                {quickActions.map((a) => {
                  const inner = (
                    <div className="p-2 d-flex align-items-center">
                      <div className="avatar-sm me-2">
                        <span className={`avatar-title rounded ${a.allowed
                          ? 'bg-primary-lighten text-primary'
                          : 'bg-light text-muted'}`}>
                          <i className={`mdi ${a.icon} font-18`} />
                        </span>
                      </div>
                      <div>
                        <span className={`fw-bold d-block ${a.allowed ? 'text-body' : 'text-muted'}`}>
                          {a.title}
                        </span>
                        <span className="font-12 text-muted">
                          {a.allowed ? a.hint : a.reason}
                        </span>
                      </div>
                    </div>
                  )
                  return (
                    <div className="col-md-3 col-6" key={a.title}>
                      {a.allowed ? (
                        <Link to={a.to} className="card m-0 shadow-none border h-100 text-decoration-none">
                          {inner}
                        </Link>
                      ) : (
                        /* Not a link at all: no href, so it cannot be clicked,
                           focused with Tab, or opened with a middle click. */
                        <div
                          className="card m-0 shadow-none border h-100 qa-disabled"
                          aria-disabled="true"
                          title={a.reason}
                        >
                          {inner}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5 className="card-title mb-0">Announcements</h5>
                {/* Tabs only once there is something to page through. */}
                {messages.length > 0 && (
                  <ul className="nav nav-tabs card-header-tabs border-0" style={{ marginBottom: -1 }}>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === 'latest' ? 'active' : ''}`}
                        onClick={() => setTab('latest')}
                      >
                        Latest
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${tab === 'history' ? 'active' : ''}`}
                        onClick={() => setTab('history')}
                      >
                        History
                      </button>
                    </li>
                  </ul>
                )}
              </div>

              {messages.length === 0 && (
                <div className="text-center py-4">
                  <i className="mdi mdi-bullhorn-outline text-muted" style={{ fontSize: 32 }} />
                  <h5 className="mt-2 mb-1">No announcements</h5>
                  <p className="text-muted mb-0">
                    Messages from your administrator will appear here.
                  </p>
                </div>
              )}

              {tab === 'latest' && messages.map((m, i) => (
                <Announcement key={m.id ?? i} m={m} last={i === messages.length - 1} />
              ))}

              {tab === 'history' && (
                <>
                  {history.loading && (
                    <div className="text-center py-4">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  )}

                  {!history.loading && history.rows.map((m, i) => (
                    <Announcement key={m.id ?? i} m={m} last={i === history.rows.length - 1} />
                  ))}

                  {!history.loading && history.total > 20 && (
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <span className="text-muted font-13">
                        {history.total} announcement{history.total === 1 ? '' : 's'} in total
                      </span>
                      <div>
                        <span className="text-muted font-13 me-2">
                          Page {history.page} of {Math.ceil(history.total / 20)}
                        </span>
                        <button
                          className="btn btn-sm btn-light"
                          disabled={history.page <= 1}
                          onClick={() => setHistory((h) => ({ ...h, page: h.page - 1 }))}
                        >
                          <i className="mdi mdi-chevron-left" />
                        </button>
                        <button
                          className="btn btn-sm btn-light ms-1"
                          disabled={history.page >= Math.ceil(history.total / 20)}
                          onClick={() => setHistory((h) => ({ ...h, page: h.page + 1 }))}
                        >
                          <i className="mdi mdi-chevron-right" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
