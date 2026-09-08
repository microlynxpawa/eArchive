import React from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
 * Sidebar
 *
 * Hyper's .leftside-menu / .side-nav markup.
 *
 * Entries the person cannot use are shown DISABLED, never hidden — every entry,
 * in every section. A missing item is indistinguishable from "not allowed", and
 * the menu used to change shape from one account to the next.
 *
 * The consequence to build for: the sidebar now tells everyone which features
 * exist. That makes the reasons on hover and the route guards more important,
 * not less — someone will read a greyed-out label and try the URL. This is a UI
 * change only; the existing route guards are untouched and still reject anyone
 * who navigates directly.
 */

export default function Sidebar({ auths = {}, onOpenScan, onOpenAccessControl, onOpenStorage }) {
  const { pathname } = useLocation()
  const isActive = (path) => pathname === path || pathname.startsWith(path + '/')

  const isAdmin = !!(auths.is_admin || auths.is_super_admin)
  // "Manager" is supervision_right.
  const canAnnounce = isAdmin || !!auths.supervision_right

  /*
   * A disabled entry renders as a <span>, not a link: nothing to click, nothing
   * for Tab to land on, and no href for a middle click to open in a new tab.
   */
  const Disabled = ({ icon, children, reason }) => (
    <li className="side-nav-item">
      <span className="side-nav-link sn-disabled" aria-disabled="true" title={reason}>
        <i className={`mdi ${icon}`} />
        <span> {children} </span>
        <i className="mdi mdi-lock-outline sn-lock" />
      </span>
    </li>
  )

  const NavLink = ({ to, icon, children, allowed = true, reason }) => {
    if (!allowed) return <Disabled icon={icon} reason={reason}>{children}</Disabled>
    return (
      <li className={`side-nav-item${isActive(to) ? ' menuitem-active' : ''}`}>
        <Link className={`side-nav-link${isActive(to) ? ' active' : ''}`} to={to}>
          <i className={`mdi ${icon}`} />
          <span> {children} </span>
        </Link>
      </li>
    )
  }

  const NavAction = ({ icon, onClick, children, allowed = true, reason }) => {
    if (!allowed) return <Disabled icon={icon} reason={reason}>{children}</Disabled>
    return (
      <li className="side-nav-item">
        <a
          href="#"
          className="side-nav-link"
          onClick={(e) => { e.preventDefault(); onClick && onClick() }}
        >
          <i className={`mdi ${icon}`} />
          <span> {children} </span>
        </a>
      </li>
    )
  }

  // A disabled account has no navigation at all.
  if (auths.is_disabled) {
    return (
      <div className="leftside-menu">
        <Link to="/dashboard" className="logo text-center logo-light">
          <span className="logo-lg">
            <img src="/assets/images/logo/logo.png" alt="xCore eArchive" height="22" />
          </span>
        </Link>
      </div>
    )
  }

  const NO_ADMIN = 'Administrator access is required'

  return (
    <div className="leftside-menu">
      <style>{SIDEBAR_CSS}</style>

      <Link to="/dashboard" className="logo text-center logo-light">
        <span className="logo-lg">
          <img src="/assets/images/logo/logo.png" alt="xCore eArchive" height="22" />
        </span>
        <span className="logo-sm">
          <img src="/assets/images/logo/logo.png" alt="xCore eArchive" height="18" />
        </span>
      </Link>

      <div className="h-100" id="leftside-menu-container" data-simplebar>
        <ul className="side-nav">
          <li className="side-nav-title side-nav-item">Main</li>

          <NavLink to="/dashboard" icon="mdi-view-dashboard-outline">Dashboard</NavLink>

          <NavLink
            to="/see-file" icon="mdi-folder-outline"
            allowed={!!auths.view_upload}
            reason="You do not have permission to view files"
          >
            Files
          </NavLink>

          <NavLink
            to="/file-upload" icon="mdi-cloud-upload-outline"
            allowed={!!auths.archiving}
            reason="You do not have permission to upload"
          >
            Upload
          </NavLink>

          <NavLink
            to="/send-files" icon="mdi-send-outline"
            allowed={!!auths.view_upload}
            reason="You do not have permission to send files"
          >
            Send files
          </NavLink>

          <NavAction
            icon="mdi-scanner" onClick={onOpenScan}
            allowed={!!auths.scanning}
            reason="You do not have permission to scan"
          >
            Scan
          </NavAction>

          <li className="side-nav-title side-nav-item">Administration</li>

          <NavLink
            to="/user-management" icon="mdi-account-multiple-outline"
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Users
          </NavLink>

          <NavAction
            icon="mdi-shield-key-outline" onClick={onOpenAccessControl}
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Access control
          </NavAction>

          {/* Admins and managers (supervision_right) may write announcements. */}
          <NavLink
            to="/announcements" icon="mdi-bullhorn-outline"
            allowed={canAnnounce}
            reason="Administrator or supervision rights are required"
          >
            Announcements
          </NavLink>

          <NavLink
            to="/branches" icon="mdi-domain"
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Branches
          </NavLink>

          <NavLink
            to="/user-group" icon="mdi-sitemap-outline"
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Departments
          </NavLink>

          <NavLink
            to="/audit-log" icon="mdi-history"
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Audit trail
          </NavLink>

          {/* Analytics is open to admins as well as super admins, same view. */}
          <NavLink
            to="/super-dashboard" icon="mdi-chart-box-outline"
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Analytics
          </NavLink>

          <NavAction
            icon="mdi-database-cog-outline" onClick={onOpenStorage}
            allowed={isAdmin} reason={NO_ADMIN}
          >
            Storage
          </NavAction>
        </ul>
        <div className="clearfix" />
      </div>
    </div>
  )
}

const SIDEBAR_CSS = `
.side-nav .sn-disabled{opacity:.45;cursor:not-allowed;display:flex;align-items:center}
.side-nav .sn-disabled:hover{background:transparent;color:inherit}
.side-nav .sn-lock{margin-left:auto;font-size:13px}
`
