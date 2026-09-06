import React, { createContext, useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import PageHeader from './PageHeader'
import Sidebar from './Sidebar'
import Footer from './Footer'
import AccessControl from './AccessControl'
import DisplayDepartmentsModal from './DisplayDepartmentsModal'
import ScanModalOptions from './ScanModalOptions'
import StorageSettingsModal from './StorageSettingsModal'

/*
 * Layout
 *
 * Hyper's shell: .wrapper wraps the sidebar and .content-page, which holds the
 * topbar, the page content and the footer.
 *
 * Signed-in user, permissions and admin messages are fetched once here and
 * shared through LayoutContext, so pages do not each refetch dashboard-data.
 */

export const LayoutContext = createContext({ user: {}, auths: {}, messages: [] })

export default function Layout() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState({})
  const [auths, setAuths] = useState({})
  const [messages, setMessages] = useState([])

  // The sidebar modals still listen on window; replacing that belongs to the
  // modals ticket, so the shell keeps dispatching the events they expect.
  const fire = useCallback((name) => window.dispatchEvent(new CustomEvent(name)), [])

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const res = await fetch('/admin/check-auth', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!alive) return
        if (res.status === 401 || !res.ok) {
          navigate('/', { replace: true })
          return
        }

        const dataRes = await fetch('/admin/dashboard-data', {
          credentials: 'include',
          headers: { Accept: 'application/json' },
        })
        if (!alive) return
        if (dataRes.ok) {
          const data = await dataRes.json()
          if (data && data.statusCode === 200) {
            setUser(data.user || {})
            setAuths(data.auths || {})
            setMessages(Array.isArray(data.messages) ? data.messages : [])
          }
        }
        setChecking(false)
      } catch (err) {
        if (!alive) return
        console.error('[layout] auth', err)
        navigate('/', { replace: true })
      }
    })()

    return () => { alive = false }
  }, [navigate])

  const toggleSidebar = useCallback(() => {
    document.body.classList.toggle('sidebar-enable')
    if (window.innerWidth >= 768) {
      document.body.setAttribute(
        'data-leftbar-compact-mode',
        document.body.getAttribute('data-leftbar-compact-mode') === 'condensed' ? 'fixed' : 'condensed'
      )
    }
  }, [])

  if (checking) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    )
  }

  return (
    <LayoutContext.Provider value={{ user, auths, messages }}>
      <div className="wrapper">

        <Sidebar
          auths={auths}
          onOpenScan={() => fire('open-scan-modal')}
          onOpenAccessControl={() => fire('open-access-control')}
          onOpenStorage={() => fire('open-storage-settings')}
        />

        <div className="content-page">
          <div className="content">
            <PageHeader user={user} messages={messages} onToggleSidebar={toggleSidebar} />
            <div className="container-fluid">
              <Outlet />
            </div>
          </div>
          <Footer user={user} />
        </div>
      </div>

      {/* Shell modals, unchanged until their own ticket */}
      <AccessControl />
      <StorageSettingsModal />
      <ScanModalOptions />
      <DisplayDepartmentsModal />
    </LayoutContext.Provider>
  )
}
