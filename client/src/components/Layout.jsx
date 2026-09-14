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
  const [loadError, setLoadError] = useState(false)

  // Which sidebar modal is open. These used to be window CustomEvents that each
  // modal listened for, which meant the shell had no idea what was on screen and
  // two could be opened at once.
  const [openModal, setOpenModal] = useState(null)   // 'scan' | 'access' | 'storage' | null
  const closeModal = useCallback(() => setOpenModal(null), [])

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

        const data = dataRes.ok ? await dataRes.json().catch(() => null) : null
        if (!data || data.statusCode !== 200 || !data.auths) {
          /*
           * Permissions come from this one call. Carrying on without them used
           * to render the whole app with auths = {}, which silently disabled
           * every administration control - the sidebar entries, the analytics
           * page, the announcements button - with nothing on screen to say why.
           * A transient failure looked exactly like a demotion. Say so instead.
           */
          console.error('[layout] dashboard-data did not return permissions', dataRes.status)
          setLoadError(true)
          setChecking(false)
          return
        }

        setUser(data.user || {})
        setAuths(data.auths)
        setMessages(Array.isArray(data.messages) ? data.messages : [])
        setLoadError(false)
        setChecking(false)
      } catch (err) {
        if (!alive) return
        console.error('[layout] auth', err)
        navigate('/', { replace: true })
      }
    })()

    return () => { alive = false }
  }, [navigate])

  /*
   * The sidebar toggle is handled by Hyper's own app.min.js, which binds a
   * delegated click handler to .button-menu-mobile. A React handler here did
   * the same work, so both ran on every click and undid each other. Removed;
   * see the note on the button in PageHeader.
   */

  if (checking) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    )
  }

  // Rendering without permissions would look like a demotion, so it is refused.
  if (loadError) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
        <div className="text-center" style={{ maxWidth: 420 }}>
          <i className="mdi mdi-alert-circle-outline text-warning" style={{ fontSize: 40 }} />
          <h4 className="mt-2">Could not load your permissions</h4>
          <p className="text-muted">
            You are signed in, but the server did not return what you are allowed to do. Nothing
            has changed about your account — this is a loading problem.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            <i className="mdi mdi-refresh me-1" />Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <LayoutContext.Provider value={{ user, auths, messages }}>
      <div className="wrapper">

        <Sidebar
          auths={auths}
          onOpenScan={() => setOpenModal('scan')}
          onOpenAccessControl={() => setOpenModal('access')}
          onOpenStorage={() => setOpenModal('storage')}
        />

        <div className="content-page">
          <div className="content">
            <PageHeader user={user} messages={messages} />
            <div className="container-fluid">
              <Outlet />
            </div>
          </div>
          <Footer user={user} />
        </div>
      </div>

      {/* Shell modals, unchanged until their own ticket */}
      <AccessControl open={openModal === 'access'} onClose={closeModal} />
      <StorageSettingsModal open={openModal === 'storage'} onClose={closeModal} />
      <ScanModalOptions open={openModal === 'scan'} onClose={closeModal} />
      <DisplayDepartmentsModal />
    </LayoutContext.Provider>
  )
}
