import React, { useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import PageHeader from './PageHeader'
import Sidebar from './Sidebar'
import Footer from './Footer'
import AccessControl from './AccessControl'
import DisplayDepartmentsModal from './DisplayDepartmentsModal'
import ScanModalOptions from './ScanModalOptions'
import BreadCrumbs from './BreadCrumbs'

export default function Layout() {
  const navigate = useNavigate()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [userAuths, setUserAuths] = useState({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await fetch('/admin/check-auth', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!mounted) return
        if (res.status === 401 || !res.ok) {
          // Not authenticated - send user to login
          navigate('/', { replace: true })
        } else {
          // Fetch real user authorization data
          try {
            const authRes = await fetch('/admin/dashboard-data', {
              credentials: 'include',
              headers: { Accept: 'application/json' }
            })
            if (authRes.ok && mounted) {
              const authData = await authRes.json()
              if (authData && authData.statusCode === 200 && authData.auths) {
                setUserAuths(authData.auths)
              }
            }
          } catch (e) {
            console.error('Failed to fetch user authorizations', e)
          }
          setCheckingAuth(false)
        }
      } catch (err) {
        if (!mounted) return
        navigate('/', { replace: true })
      }
    })()

    return () => { mounted = false }
  }, [navigate])

  if (checkingAuth) {
    return (
      <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading...</span></div>
      </div>
    )
  }
  const toggleSidebar = () => {
    const el = document.getElementById('pageWrapper') || document.querySelector('.page-wrapper');
    if (!el) return;
    el.classList.toggle('close-sidebar');
    el.classList.toggle('compact-wrapper');
  }

  return (
    <div className="page-wrapper compact-wrapper" id="pageWrapper">
      {/* Page Header */}
      <PageHeader onToggleSidebar={toggleSidebar} />

      {/* Page Body */}
      <div className="page-body-wrapper">
        {/* Sidebar */}
        <aside className="sidebar-wrapper">
          <Sidebar onToggleSidebar={toggleSidebar} auths={userAuths} />
        </aside>

        {/* Main content area uses the same wrapper classes as the server template */}
        <div className="page-body">
          <div className="container-fluid">
            <BreadCrumbs />
            <Outlet />
          </div>
        </div>
      </div>

      {/* Footer outside page-body-wrapper for full-width */}
      <Footer />

      {/* Global modals */}
      <AccessControl />
      <DisplayDepartmentsModal />
      <ScanModalOptions />
    </div>
  )
}

