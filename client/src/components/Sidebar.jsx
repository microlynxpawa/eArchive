import React, { useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  FiGrid, 
  FiArrowLeft, 
  FiArrowRight, 
  FiHome, 
  FiFile, 
  FiFilePlus, 
  FiActivity, 
  FiPrinter, 
  FiSend, 
  FiSliders, 
  FiUsers, 
  FiGitBranch 
} from 'react-icons/fi'

export default function Sidebar({ auths = {}, onToggleSidebar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef(null)
  const rootRef = useRef(null)

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/')
  }

  const toggleMobileSidebar = (e) => {
    e && e.preventDefault && e.preventDefault()
    document.body.classList.toggle('mobile-sidebar-open')
  }

  const handleToggle = (e) => {
    e && e.preventDefault && e.preventDefault()
    if (typeof onToggleSidebar === 'function') onToggleSidebar()
    else {
      const el = document.getElementById('pageWrapper') || document.querySelector('.page-wrapper')
      if (el) el.classList.toggle('close-sidebar')
    }
  }

  const scrollLeft = () => {
    const el = menuRef.current
    if (el) el.scrollBy({ left: -120, behavior: 'smooth' })
  }

  const scrollRight = () => {
    const el = menuRef.current
    if (el) el.scrollBy({ left: 120, behavior: 'smooth' })
  }

  const openScan = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // dispatch custom event so modals can listen
    window.dispatchEvent(new CustomEvent('open-scan-modal'))
  }

  const openAccessControl = (e) => {
    e.preventDefault()
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('open-access-control'))
  }

  useEffect(() => {
    // Load sidebar scripts
    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) return resolve()
      const s = document.createElement('script')
      s.src = src
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load ' + src))
      document.head.appendChild(s)
    })

    ;(async () => {
      try {
        await loadScript('/assets/js/sidebar-menu.js')
      } catch (e) {}
      try {
        await loadScript('/assets/js/script.js')
      } catch (e) {}
    })()

    // Add active state styles
    const styleEl = document.createElement('style')
    styleEl.innerHTML = `
      .sidebar-list.active {
        background: linear-gradient(to right, rgba(115, 103, 240, 0.2), transparent) !important;
        border-left: 3px solid #7367f0 !important;
      }
      .sidebar-list.active .sidebar-link {
        color: #7367f0 !important;
      }
      .sidebar-list.active svg {
        color: #7367f0 !important;
        stroke: #7367f0 !important;
      }
      .sidebar-list:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    `
    document.head.appendChild(styleEl)

    return () => {
      document.head.removeChild(styleEl)
    }
  }, [])

  return (
    <div className="sidebar-wrapper" ref={rootRef}>
      <div>
        <div className="logo-wrapper">
          <Link to="/admin/dashboard"><img className="img-fluid for-light" src="/assets/images/logo/logo.png" alt="E-Archive" style={{width:120,height:23}}/></Link>
          <div className="back-btn" onClick={toggleMobileSidebar} style={{background: 'none', boxShadow: 'none', border: 'none'}}>
            <FiGrid size={20} color="white" />
          </div>
          <div className="toggle-sidebar icon-box-sidebar" onClick={handleToggle} style={{background: 'none', boxShadow: 'none', border: 'none'}}>
            <FiGrid className="status_toggle middle sidebar-toggle" size={20} color="white" />
          </div>
        </div>
        <div className="logo-icon-wrapper">
          <Link to="/dashboard"><div className="icon-box-sidebar"><FiGrid size={20} color="white" /></div></Link>
        </div>
        <nav className="sidebar-main">
          <div className="left-arrow disabled" id="left-arrow" onClick={scrollLeft}><FiArrowLeft size={18} color="white" /></div>

          {auths && !auths.is_disabled && (
            <div id="sidebar-menu" ref={menuRef}>
              <ul className="sidebar-links" id="simple-bar" style={{display: 'block'}}>
                <li className="back-btn"><div className="mobile-back text-end" onClick={toggleMobileSidebar} role="button" tabIndex={0} aria-hidden="true" style={{background: 'none', boxShadow: 'none', border: 'none'}}></div></li>
                <li className="pin-title sidebar-list"><h6>Pinned</h6></li>
                <hr />
                {auths && !auths.is_disabled && (
                  <li className={`sidebar-list ${isActive('/dashboard') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/dashboard">
                      <FiHome size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span className="lan-3">Dashboard</span>
                    </Link>
                  </li>
                )}
                {auths && auths.view_upload && (
                  <li className={`sidebar-list ${isActive('/see-file') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/see-file">
                      <FiFile size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>View Files</span>
                    </Link>
                  </li>
                )}
                {auths && auths.archiving && (
                  <li className={`sidebar-list ${isActive('/file-upload') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/file-upload" onClick={(e)=>{ e && e.preventDefault && e.preventDefault(); try{ navigate('/file-upload') }catch(err){ window.location.href = '/file-upload' } }}>
                      <FiFilePlus size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Upload Files</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className={`sidebar-list ${isActive('/audit-log') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/audit-log">
                      <FiActivity size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Audit Trail</span>
                    </Link>
                  </li>
                )}
                {auths && auths.scanning && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <a className="sidebar-link sidebar-title link-nav" id="scan-button" href="#" onClick={openScan}>
                      <FiPrinter size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Scan Files</span>
                    </a>
                  </li>
                )}
                {auths && !auths.is_disabled && auths.view_upload && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/see-file#picksend">
                      <FiSend size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Pick and Send</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <a className="sidebar-link sidebar-title link-nav" id="access-control-button" href="#" onClick={openAccessControl}>
                      <FiSliders size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Access Ctrl</span>
                    </a>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className={`sidebar-list ${isActive('/user-management') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/user-management">
                      <FiUsers size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>User Mgmt</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className={`sidebar-list ${isActive('/user-group') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/user-group">
                      <FiGrid size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Departments</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className={`sidebar-list ${isActive('/branches') ? 'active' : ''}`}>
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/branches">
                      <FiGitBranch size={18} color="white" style={{marginRight: '10px', verticalAlign: 'middle'}} />
                      <span>Branches</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="right-arrow" id="right-arrow" onClick={scrollRight}><FiArrowRight size={18} color="white" /></div>
        </nav>
      </div>
    </div>
  )
}
