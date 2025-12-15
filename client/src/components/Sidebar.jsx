import React, { useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Sidebar({ auths = {}, onToggleSidebar }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const rootRef = useRef(null)

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
    e && e.preventDefault && e.preventDefault()
    // dispatch custom event so modals can listen
    window.dispatchEvent(new CustomEvent('open-scan-modal'))
  }

  const openAccessControl = (e) => {
    e && e.preventDefault && e.preventDefault()
    window.dispatchEvent(new CustomEvent('open-access-control'))
  }

  useEffect(() => {
    // attach rootRef cleanup and ensure feather icons are rendered even if scripts load after mount
    try {
      const root = rootRef.current || document

      // remove inline/background styles that theme JS might add to controls
      const clearInlineStyles = () => {
        const selectors = [
          '.logo-wrapper .back-btn',
          '.logo-wrapper .toggle-sidebar',
          '.logo-wrapper .back-btn *',
          '.logo-wrapper .toggle-sidebar *',
          '.mobile-back'
        ]
        selectors.forEach(sel => {
          Array.from((root.querySelectorAll && root.querySelectorAll(sel)) || []).forEach(el => {
            el.style && (el.style.background = 'transparent', el.style.backgroundImage = 'none', el.style.boxShadow = 'none', el.style.border = 'none')
            // remove any inline width/height that cause the square look
            el.style && (el.style.width = '', el.style.height = '')
            el.removeAttribute && el.removeAttribute('data-inline-style')
          })
        })
      }

      clearInlineStyles()

      let tries = 0
      const maxTries = 8
      const interval = setInterval(() => {
        tries++
        // first try scoped replacements using feather.icons
        try {
          const els = (root.querySelectorAll && root.querySelectorAll('[data-feather]')) || []
          els.forEach((el) => {
            const name = el.getAttribute('data-feather')
            if (!name) return
            if (window.feather && window.feather.icons && window.feather.icons[name]) {
              try {
                const svg = window.feather.icons[name].toSvg({ class: el.getAttribute('class') || '' })
                const wrapper = document.createElement('span')
                wrapper.innerHTML = svg
                el.parentNode && el.parentNode.replaceChild(wrapper.firstElementChild, el)
              } catch (e) {
                // ignore
              }
            }
          })
        } catch (e) {}

        // fallback global replace
        try { window.feather && window.feather.replace && window.feather.replace() } catch (e) {}

        // also re-clear inline styles in case JS re-applies them
        clearInlineStyles()

        if (tries >= maxTries) { clearInterval(interval) }
      }, 500)

      // Also load and run the actual theme scripts used by the EJS template so they initialize the sidebar exactly
      const loadScript = (src) => new Promise((resolve, reject) => {
        // avoid loading same script multiple times
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
          // load feather icons lib first
          await loadScript('/assets/js/icons/feather-icon/feather.min.js')
        } catch (e) {}
        try {
          // load the sidebar initializer (jQuery must be available globally; index.html already loads jQuery)
          await loadScript('/assets/js/sidebar-menu.js')
        } catch (e) {}
        try {
          await loadScript('/assets/js/script.js')
        } catch (e) {}

        // run feather replacement once more after scripts load
        try { window.feather && window.feather.replace && window.feather.replace() } catch (e) {}

        // If some icons still aren't replaced (feather missing or failed), fetch SVGs directly from CDN as a fallback
        const fetchSvg = async (name) => {
          try {
            const url = 'https://unpkg.com/feather-icons/dist/icons/' + name + '.svg'
            const res = await fetch(url)
            if (!res.ok) return null
            const text = await res.text()
            const wrapper = document.createElement('span')
            wrapper.innerHTML = text
            return wrapper.firstElementChild
          } catch (err) {
            return null
          }
        }

        try {
          const remaining = Array.from(document.querySelectorAll('[data-feather]'))
          for (const el of remaining) {
            const name = el.getAttribute('data-feather')
            if (!name) continue
            // try window.feather first
            if (window.feather && window.feather.icons && window.feather.icons[name]) {
              try {
                const svg = window.feather.icons[name].toSvg({ class: el.getAttribute('class') || '' })
                const wrapper = document.createElement('span')
                wrapper.innerHTML = svg
                el.parentNode && el.parentNode.replaceChild(wrapper.firstElementChild, el)
                continue
              } catch (e) {}
            }
            // fallback to CDN fetch
            const svgEl = await fetchSvg(name)
            if (svgEl && el.parentNode) el.parentNode.replaceChild(svgEl, el)
          }
        } catch (e) {}

        // mark initialized so we don't re-run heavy logic elsewhere
        try { window.__pawa_sidebar_initialized = true } catch (e) {}
      })()

      return () => clearInterval(interval)
    } catch (err) {
      // no-op
    }
  }, [])

  return (
    <div className="sidebar-wrapper" ref={rootRef}>
      <div>
        <div className="logo-wrapper">
          <Link to="/admin/dashboard"><img className="img-fluid for-light" src="/assets/images/logo/logo.png" alt="E-Archive" style={{width:120,height:23}}/></Link>
          <div className="back-btn" onClick={toggleMobileSidebar} style={{background: 'none', boxShadow: 'none', border: 'none'}}>
            <i data-feather="grid"></i>
          </div>
          <div className="toggle-sidebar icon-box-sidebar" onClick={handleToggle} style={{background: 'none', boxShadow: 'none', border: 'none'}}>
            <i className="status_toggle middle sidebar-toggle" data-feather="grid" />
          </div>
        </div>
        <div className="logo-icon-wrapper">
          <Link to="/dashboard"><div className="icon-box-sidebar"><i data-feather="grid"></i></div></Link>
        </div>
        <nav className="sidebar-main">
          <div className="left-arrow disabled" id="left-arrow" onClick={scrollLeft}><i data-feather="arrow-left"></i></div>

          {auths && !auths.is_disabled && (
            <div id="sidebar-menu" ref={menuRef}>
              <ul className="sidebar-links" id="simple-bar" style={{display: 'block'}}>
                <li className="back-btn"><div className="mobile-back text-end" onClick={toggleMobileSidebar} role="button" tabIndex={0} aria-hidden="true" style={{background: 'none', boxShadow: 'none', border: 'none'}}></div></li>
                <li className="pin-title sidebar-list"><h6>Pinned</h6></li>
                <hr />
                {auths && !auths.is_disabled && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/dashboard">
                      <i data-feather="home"></i>
                      <span className="lan-3">Dashboard</span>
                    </Link>
                  </li>
                )}
                {auths && auths.view_upload && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/see-file">
                      <i data-feather="file"></i>
                      <span>View Files</span>
                    </Link>
                  </li>
                )}
                {auths && auths.archiving && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/file-upload" onClick={(e)=>{ e && e.preventDefault && e.preventDefault(); try{ navigate('/file-upload') }catch(err){ window.location.href = '/file-upload' } }}>
                      <i data-feather="file-plus"></i>
                      <span>Upload Files</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/audit-log">
                      <i data-feather="activity"></i>
                      <span>Audit Trail</span>
                    </Link>
                  </li>
                )}
                {auths && auths.scanning && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/see-file">
                      <i data-feather="printer"></i>
                      <span>Scan Files</span>
                    </Link>
                  </li>
                )}
                {auths && auths.view_upload && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/see-file">
                      <i data-feather="send"></i>
                      <span>Pick and Send</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <a className="sidebar-link sidebar-title link-nav" id="access-control-button" href="#" onClick={openAccessControl}>
                      <i data-feather="sliders"></i>
                      <span>Access Ctrl</span>
                    </a>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/user-management">
                      <i data-feather="users"></i>
                      <span>User Mgmt</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/user-group">
                      <i data-feather="grid"></i>
                      <span>Departments</span>
                    </Link>
                  </li>
                )}
                {auths && auths.is_admin && (
                  <li className="sidebar-list">
                    <i className="fa fa-thumb-tack"></i>
                    <Link className="sidebar-link sidebar-title link-nav" to="/branches">
                      <i data-feather="git-branch"></i>
                      <span>Branches</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          <div className="right-arrow" id="right-arrow" onClick={scrollRight}><i data-feather="arrow-right"></i></div>
        </nav>
      </div>
    </div>
  )
}
