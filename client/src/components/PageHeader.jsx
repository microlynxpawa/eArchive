import React, { useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function PageHeader({ onToggleSidebar }) {
  const navigate = useNavigate()
  const headerRef = useRef(null)

  // Ensure the main page body wrapper has top padding equal to the header height
  useEffect(() => {
    const headerEl = headerRef.current
    if (!headerEl) return

    const styleId = 'pawa-header-padding'
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }

    const applyPaddingCss = () => {
      try {
        const h = headerEl.offsetHeight || 70
        styleEl.textContent = `
          .page-body-wrapper { padding-top: ${h}px !important; }
          .page-header { z-index: 100 !important; position: sticky !important; top: 0 !important; }
          .swal2-container { z-index: 99999 !important; }
          .swal2-popup { z-index: 99999 !important; }
          .toast-container { z-index: 99999 !important; }
          .toast { z-index: 99999 !important; }
          div[role="alert"] { z-index: 99999 !important; }
        `
      } catch (e) {
        // ignore
      }
    }

    applyPaddingCss()
    window.addEventListener('resize', applyPaddingCss)

    // Initialize feather icons
    if (window.feather) {
      try {
        window.feather.replace()
      } catch (e) {}
    }

    let ro
    try {
      ro = new ResizeObserver(applyPaddingCss)
      ro.observe(headerEl)
    } catch (e) {}

    return () => {
      window.removeEventListener('resize', applyPaddingCss)
      try { ro && ro.disconnect() } catch (e) {}
      try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl) } catch (e) {}
    }
  }, [])

  const toggleFullScreen = () => {
    try {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    } catch (e) {
      // ignore
    }
  }

  const toggleDarkMode = () => {
    try {
      const body = document.body
      const pageWrapper = document.querySelector('.page-wrapper')
      
      // Check current state by looking for 'dark-only' class
      const isDark = body.classList.contains('dark-only')
      
      if (isDark) {
        // Switch to light mode
        body.classList.remove('dark-only')
        if (pageWrapper) pageWrapper.classList.remove('dark-only')
        localStorage.setItem('layout_version', 'light-only')
      } else {
        // Switch to dark mode
        body.classList.add('dark-only')
        if (pageWrapper) pageWrapper.classList.add('dark-only')
        localStorage.setItem('layout_version', 'dark-only')
      }
      
      // Update icon
      const modeIcon = document.querySelector('.mode i')
      if (modeIcon) {
        if (isDark) {
          modeIcon.className = 'fa fa-moon-o'
        } else {
          modeIcon.className = 'fa fa-sun-o'
        }
      }
      
      // Reinitialize feather icons
      setTimeout(() => {
        if (window.feather) {
          try {
            window.feather.replace()
          } catch (e) {}
        }
      }, 50)
    } catch (e) {
      console.error('Error toggling dark mode:', e)
    }
  }

  return (
    <div className="page-header" ref={headerRef}>
      <div className="header-wrapper row m-0">
        <div className="header-logo-wrapper col-auto p-0">
          <div className="toggle-sidebar" onClick={onToggleSidebar}><i className="status_toggle middle sidebar-toggle" data-feather="grid"> </i></div>
          <div className="logo-header-main">
            <a href="/dashboard">
              <img className="img-fluid for-light img-100"
                   src="/assets/images/logo/logo2.png"
                   alt="E-Archive Logo Light"
                   width="120"
                   height="23"
                   style={{ width: '120px', height: '23px', display: 'inline-block' }}
                   loading="eager" />
              <img className="img-fluid for-dark"
                   src="/assets/images/logo/logo.png"
                   alt="E-Archive Logo Dark"
                   width="120"
                   height="23"
                   style={{ width: '120px', height: '23px', display: 'none' }}
                   loading="eager" />
            </a>
          </div>
        </div>
        <div className="left-header col horizontal-wrapper ps-0">
          <div className="left-menu-header">
            <ul className="app-list">
              <li className="onhover-dropdown">
                <div className="app-menu"> <i data-feather="folder-plus"></i></div>
                <ul className="onhover-show-div left-dropdown">
                  <li> <a href="file-manager.html">File Manager</a></li>
                  <li> <a href="kanban.html"> Kanban board</a></li>
                  <li> <a href="social-app.html"> Social App</a></li>
                  <li> <a href="bookmark.html"> Bookmark</a></li>
                </ul>
              </li>
            </ul>
          </div>
        </div>
        <div className="nav-right col-6 pull-right right-header p-0">
          <ul className="nav-menus">
            {/* placeholder */}
            <li><p></p></li>
            <li>
              <div className="mode" onClick={toggleDarkMode} style={{ cursor: 'pointer' }}>
                <i className="fa fa-moon-o" style={{ color: '#6c757d' }}></i>
              </div>
            </li>
            <li className="maximize"><a href="#!" onClick={toggleFullScreen}><i data-feather="maximize-2"></i></a></li>
            <li className="profile-nav onhover-dropdown">
              <div className="account-user"><i data-feather="user"></i></div>
                <ul className="profile-dropdown onhover-show-div">
                  <li><a href="/edit-profile"><i data-feather="user"></i><span>Account</span></a></li>
                  <li>
                    <a href="#" onClick={async (e) => {
                      e.preventDefault()
                      try {
                        await fetch('http://localhost:4801/admin/logout', {
                          method: 'GET',
                          credentials: 'include',
                          headers: { Accept: 'application/json' }
                        })
                      } catch (err) {
                        // ignore network errors — we'll navigate to login anyway
                      }
                      // Ensure the app goes to the login page and reloads
                      window.location.href = '/'
                    }}>
                      <i data-feather="log-in"> </i><span>Log out</span>
                    </a>
                  </li>
                </ul>
            </li>
          </ul>
        </div>

        <script className="result-template" type="text/x-handlebars-template">
          {`<div class="ProfileCard u-cf">                        
        <div class="ProfileCard-avatar"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-airplay m-0"><path d="M5 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-1"></path><polygon points="12 15 17 21 7 21 12 15"></polygon></svg></div>
        <div class="ProfileCard-details">
        <div class="ProfileCard-realName">{{name}}</div>
        </div>
        </div>`}
        </script>
        <script className="empty-template" type="text/x-handlebars-template">{`<div class="EmptyMessage">Your search turned up 0 results. This most likely means the backend is down, yikes!</div>`}</script>
      </div>
    </div>
  )
}
