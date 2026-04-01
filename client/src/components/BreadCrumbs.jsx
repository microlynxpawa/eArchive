import React from 'react'
import { Link, useLocation } from 'react-router-dom'

const routeLabels = {
  dashboard: 'Dashboard',
  'see-file': 'Gallery',
  'file-upload': 'File Upload',
  'audit-log': 'Audit Trail',
  'user-management': 'User Management',
  'user-group': 'Departments',
  branches: 'Branches',
  'edit-profile': 'Edit Profile',
}

export default function BreadCrumbs() {
  const location = useLocation()

  const pathnames = location.pathname
    .split('/')
    .filter(x => x)

  // If on root auth page, show nothing
  if (pathnames.length === 0) return null

  return (
    <nav aria-label="breadcrumb" className="mb-3 d-flex justify-content-end me-5">
      <ol className="breadcrumb">

        {/* Home */}
        <li className="breadcrumb-item">
          <Link to="/dashboard">Home</Link>
        </li>

        {pathnames.map((segment, index) => {
          const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`
          const isLast = index === pathnames.length - 1
          const label = routeLabels[segment] || segment.replace('-', ' ')

          return isLast ? (
            <li
              key={routeTo}
              className="breadcrumb-item active"
              aria-current="page"
            >
              {label}
            </li>
          ) : (
            <li key={routeTo} className="breadcrumb-item">
              <Link to={routeTo}>{label}</Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
