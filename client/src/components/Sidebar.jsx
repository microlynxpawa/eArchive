import React from 'react'
import { Link, useLocation } from 'react-router-dom'

/*
 * Sidebar
 *
 * Hyper's .leftside-menu / .side-nav markup. Items are grouped so navigation
 * and administration are distinguishable, and each is gated by the permission
 * flag named beside it. Items that open a modal are passed up as callbacks
 * rather than dispatching window events.
 */

export default function Sidebar({ auths = {}, onOpenScan, onOpenAccessControl, onOpenStorage }) {
  const { pathname } = useLocation()
  const isActive = (path) => pathname === path || pathname.startsWith(path + '/')

  // Hyper marks the current item with menuitem-active on the li and styles > a
  const NavLink = ({ to, icon, children }) => (
    <li className={`side-nav-item${isActive(to) ? ' menuitem-active' : ''}`}>
      <Link className={`side-nav-link${isActive(to) ? ' active' : ''}`} to={to}>
        <i className={`mdi ${icon}`} />
        <span> {children} </span>
      </Link>
    </li>
  )

  const NavAction = ({ icon, onClick, children }) => (
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

  return (
    <div className="leftside-menu">
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
          {auths.view_upload && <NavLink to="/see-file" icon="mdi-folder-outline">Files</NavLink>}
          {auths.archiving && <NavLink to="/file-upload" icon="mdi-cloud-upload-outline">Upload</NavLink>}
          {auths.scanning && (
            <NavAction icon="mdi-scanner" onClick={onOpenScan}>Scan</NavAction>
          )}

          {auths.is_admin && (
            <>
              <li className="side-nav-title side-nav-item">Administration</li>
              <NavLink to="/user-management" icon="mdi-account-multiple-outline">Users</NavLink>
              <NavAction icon="mdi-shield-key-outline" onClick={onOpenAccessControl}>
                Access control
              </NavAction>
              <NavLink to="/branches" icon="mdi-domain">Branches</NavLink>
              <NavLink to="/user-group" icon="mdi-sitemap-outline">Departments</NavLink>
              <NavLink to="/audit-log" icon="mdi-history">Audit trail</NavLink>
              <NavAction icon="mdi-database-cog-outline" onClick={onOpenStorage}>
                Storage
              </NavAction>
            </>
          )}

          {auths.is_super_admin && (
            <>
              <li className="side-nav-title side-nav-item">Super admin</li>
              <NavLink to="/super-dashboard" icon="mdi-chart-box-outline">Analytics</NavLink>
            </>
          )}
        </ul>
        <div className="clearfix" />
      </div>
    </div>
  )
}
