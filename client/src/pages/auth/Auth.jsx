import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Auth() {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [bgLoaded, setBgLoaded] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotUsername, setForgotUsername] = useState('')
  const [forgotFeedbackVisible, setForgotFeedbackVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => setBgLoaded(true), 2000)
    const onClick = () => setBgLoaded(true)
    document.addEventListener('click', onClick, { once: true })
    return () => { clearTimeout(t); document.removeEventListener('click', onClick) }
  }, [])

  const toast = () => (window.Swal && window.Swal.mixin) ? window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true, didOpen: (t) => { t.onmouseenter = window.Swal.stopTimer; t.onmouseleave = window.Swal.resumeTimer; } }) : null
  const showError = (msg) => { const T = toast(); if (T) T.fire({ icon: 'error', title: msg }); else alert(msg) }
  const showSuccess = (msg) => { const T = toast(); if (T) T.fire({ icon: 'success', title: msg }); else alert(msg) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!user.trim()) return showError('User/email field required')
    if (!password.trim()) return showError('Password required')

    setIsLoading(true)
    try {
      const res = await fetch('/admin/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: user.trim(),
          password,
          rememberMe: remember
        }),
        credentials: 'include',
      })

      let data = null
      try { data = await res.json() } catch (e) { data = { statusCode: res.status, message: res.statusText } }

      setIsLoading(false)
      if (res.ok && data && data.statusCode === 200) {
        showSuccess(data.message || 'Login successful')
        // Navigate to React app's dashboard route
        setTimeout(() => { navigate('/dashboard') }, 300)
      } else {
        showError((data && data.message) || 'Login failed. Please check your credentials.')
      }
    } catch (err) {
      setIsLoading(false)
      showError(err && err.message ? err.message : 'Network error. Please try again.')
    }
  }

  const openForgot = (e) => { e && e.preventDefault(); setForgotUsername(''); setForgotFeedbackVisible(false); setShowForgot(true) }
  const closeForgot = () => setShowForgot(false)

  const submitForgot = async () => {
    const username = (forgotUsername || '').trim()
    if (!username) { setForgotFeedbackVisible(true); return }
    setIsLoading(true)
    try {
      const res = await fetch('/admin/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
        credentials: 'include'
      })
      let data = null
      try { data = await res.json() } catch (e) { data = { statusCode: res.status, message: res.statusText } }
      setIsLoading(false)
      if (res.ok && data && data.statusCode === 200) {
        setForgotFeedbackVisible(false)
        showSuccess(data.message || 'If this account exists we sent instructions')
        setTimeout(() => closeForgot(), 900)
      } else {
        setForgotFeedbackVisible(true)
        showError((data && data.message) || 'Unable to process request')
      }
    } catch (err) {
      setIsLoading(false)
      showError(err && err.message ? err.message : 'Network error. Please try again.')
    }
  }

  return (
    <div className={`login-card ${bgLoaded ? 'bg-loaded' : ''}`}>
      <div className="container-fluid p-0">
        <div className="row m-0">
          <div className="col-12 p-0">
            <div className="login-card">
              <div>
                <div>
                  <a className="logo" href="#">
                    <img style={{ marginLeft: '5%', width: 166, height: 32 }} className="img-fluid for-light" src="/assets/images/logo/logo.png" alt="xCore eArchive Login" width="166" height="32" loading="eager" />
                  </a>
                </div>
                <div className="login-main">
                  <form className="theme-form" onSubmit={handleSubmit}>
                    <h4 className="text-center">Sign in to account</h4>
                    <p className="text-center">Enter your Username & password to login</p>
                    <div className="form-group">
                      <label htmlFor="email" className="col-form-label">Username</label>
                      <input className="form-control" type="text" required id="email" placeholder="user@branch" value={user} onChange={e => setUser(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="password" className="col-form-label">Password</label>
                      <div className="form-input position-relative">
                        <input className="form-control" type={showPassword ? "text" : "password"} name="login[password]" required id="password" placeholder="*********" value={password} onChange={e => setPassword(e.target.value)} />
                        <div className="show-hide" onClick={() => setShowPassword(!showPassword)} style={{ cursor: 'pointer' }}>
                          <span className={showPassword ? "hide" : "show"}> </span>
                        </div>
                      </div>
                    </div>
                    <div className="form-group mb-0">
                      <div className="checkbox p-0">
                        <input id="checkbox1" type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
                        <label className="text-muted" htmlFor="checkbox1">Remember password</label>
                      </div>
                      <div className="text-end mt-3">
                        <input type="submit" id="btnSign" value="Sign in" className="btn btn-primary btn-block w-100" disabled={isLoading} />
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        {showForgot && (
          <div className="modal fade show d-block" id="forgotPasswordModal" tabIndex={-1} aria-labelledby="forgotPasswordModalLabel" aria-hidden="true">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="forgotPasswordModalLabel">Forgot Password</h5>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeForgot}></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label htmlFor="forgot-username" className="form-label">Enter your username or email</label>
                    <input type="text" className="form-control" id="forgot-username" placeholder="Username or Email" value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} />
                  </div>
                  <div id="forgot-password-feedback" className="text-danger mb-2" style={{ display: forgotFeedbackVisible ? 'block' : 'none' }}></div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeForgot}>Cancel</button>
                  <button type="button" className="btn btn-primary" id="forgotPasswordSubmit" onClick={submitForgot}>Send New Password</button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div id="login-loader" className={isLoading ? 'login-loader-show' : 'login-loader-hide'} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 9999, background: 'rgba(255,255,255,0.7)', display: isLoading ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          <div className="spinner-border text-primary" role="status" style={{ width: '4rem', height: '4rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <div className="mt-3 text-primary">Logging you in...</div>
        </div>
      </div>
    </div>
  )
}
