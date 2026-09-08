import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/*
 * Topbar
 *
 * Hyper's .navbar-custom. The announcements bell is fed by the messages the
 * dashboard endpoint already returns. No height measuring and no injected
 * stylesheet: Hyper's layout handles the offset itself.
 *
 * There is deliberately no search box here. Search only ever applies to files,
 * so it belongs on the Files page next to the tree it filters - a global box in
 * the topbar was both misleading on every other page and out of keeping with
 * the wireframes.
 */

export default function PageHeader({ user = {}, messages = [] }) {
  const navigate = useNavigate()

  /*
   * Unread announcements.
   *
   * The count comes from the server, which compares each announcement against
   * this person's lastSeenAnnouncementAt. Opening the dropdown clears it — on
   * opening, not on page load, because the badge should drop when somebody
   * actually looks rather than when a page renders.
   */
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/admin/messages', { credentials: 'include' })
        const data = await res.json()
        if (alive && typeof data.unread === 'number') setUnread(data.unread)
      } catch (err) {
        console.error('[topbar] unread', err)
      }
    })()
    return () => { alive = false }
  }, [])

  const markSeen = async () => {
    if (unread === 0) return
    setUnread(0)   // the badge goes now; the write is bookkeeping
    try {
      await fetch('/admin/messages/seen', { method: 'POST', credentials: 'include' })
    } catch (err) {
      console.error('[topbar] mark seen', err)
    }
  }

  const initials = (user.fullname || user.username || '?')
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

  const picture = user.profilePicturePath
    ? `/profile-pictures/${String(user.profilePicturePath).split(/[\\/]/).pop()}`
    : null

  const signOut = async (e) => {
    e.preventDefault()
    try {
      await fetch('/admin/logout', { credentials: 'include' })
    } catch (err) {
      console.error('[topbar] logout', err)
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="navbar-custom">
      <ul className="list-unstyled topbar-menu float-end mb-0">

        <li className="dropdown notification-list">
          <a
            className="nav-link dropdown-toggle arrow-none"
            data-bs-toggle="dropdown"
            href="#"
            role="button"
            aria-haspopup="false"
            aria-expanded="false"
            onClick={markSeen}
          >
            <i className="mdi mdi-bell-outline noti-icon" />
            {unread > 0 && (
              <span className="badge bg-danger rounded-circle noti-icon-badge">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </a>
          <div className="dropdown-menu dropdown-menu-end dropdown-menu-animated dropdown-lg">
            <div className="dropdown-item noti-title">
              <h5 className="m-0">Announcements</h5>
            </div>
            <div style={{ maxHeight: 230, overflowY: 'auto' }}>
              {messages.length === 0 && (
                <div className="text-center p-3 text-muted font-13">No messages</div>
              )}
              {messages.map((m) => (
                <a key={m.id} href="#" className="dropdown-item notify-item" onClick={(e) => e.preventDefault()}>
                  <div className="notify-icon bg-primary">
                    <i className="mdi mdi-bullhorn-outline" />
                  </div>
                  <p className="notify-details">{m.message}</p>
                  {m.createdAt && (
                    <p className="text-muted mb-0 user-msg">
                      <small>{new Date(m.createdAt).toLocaleString()}</small>
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
        </li>

        <li className="dropdown notification-list">
          <a
            className="nav-link dropdown-toggle nav-user arrow-none me-0"
            data-bs-toggle="dropdown"
            href="#"
            role="button"
            aria-haspopup="false"
            aria-expanded="false"
          >
            <span className="account-user-avatar">
              {picture
                ? <img src={picture} alt="profile" className="rounded-circle" />
                : (
                  <span
                    className="rounded-circle bg-primary-lighten text-primary d-inline-flex align-items-center justify-content-center"
                    style={{ width: 32, height: 32, fontSize: 12, fontWeight: 600 }}
                  >
                    {initials}
                  </span>
                )}
            </span>
            <span>
              <span className="account-user-name">{user.fullname || user.username || 'Signed in'}</span>
              <span className="account-position">
                {[user.archive_category?.name, user.branch?.name].filter(Boolean).join(' · ')}
              </span>
            </span>
          </a>

          <div className="dropdown-menu dropdown-menu-end dropdown-menu-animated topbar-dropdown-menu profile-dropdown">
            <div className="dropdown-header noti-title">
              <h6 className="text-overflow m-0">Signed in as {user.username}</h6>
            </div>
            <Link to="/edit-profile" className="dropdown-item notify-item">
              <i className="mdi mdi-account-circle me-1" />
              <span>My profile</span>
            </Link>
            <div className="dropdown-divider" />
            <a href="#" className="dropdown-item notify-item" onClick={signOut}>
              <i className="mdi mdi-logout me-1" />
              <span>Sign out</span>
            </a>
          </div>
        </li>
      </ul>

      {/*
        * No onClick here on purpose.
        *
        * Hyper's own app.min.js already binds a delegated handler to
        * .button-menu-mobile which toggles sidebar-enable and then either
        * hide-menu (mobile) or activateCondensedSidebar/deactivate (desktop).
        * We had a React handler doing the same work, so every click ran both
        * and they cancelled each other out - which is why the toggle appeared
        * to do nothing at all. Hyper's version handles both breakpoints, so it
        * owns this button.
        */}
      <button className="button-menu-mobile open-left" type="button">
        <i className="mdi mdi-menu" />
      </button>
    </div>
  )
}
