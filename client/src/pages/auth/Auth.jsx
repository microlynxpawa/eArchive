import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/*
 * Sign in
 *
 * Rebuilt on Hyper's account-pages markup, keeping the existing background
 * image and xCore eArchive logo.
 *
 * Feedback is now rendered in the page. It previously went through
 * window.Swal, which is no longer loaded, so every message was falling back
 * to a browser alert().
 *
 * The forgot-password flow already existed but had no way in: openForgot was
 * never called from anywhere. The link below makes it reachable.
 */

export default function Auth() {
  const navigate = useNavigate()

  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState(null)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotUser, setForgotUser] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)
  const [forgotMsg, setForgotMsg] = useState(null) // { kind, text }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)

    if (!user.trim()) return setError('Enter your username or email address.')
    if (!password.trim()) return setError('Enter your password.')

    setSigningIn(true)
    try {
      const res = await fetch('/admin/sign-in', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: user.trim(), password, rememberMe: remember }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data && data.statusCode === 200) {
        navigate('/dashboard', { replace: true })
        return
      }
      setError(data.message || 'Username or password is incorrect. Please try again.')
    } catch (err) {
      console.error('[signin]', err)
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSigningIn(false)
    }
  }

  const openForgot = (e) => {
    e.preventDefault()
    setForgotUser('')
    setForgotMsg(null)
    setForgotOpen(true)
  }

  const submitForgot = async () => {
    const username = forgotUser.trim()
    if (!username) return setForgotMsg({ kind: 'error', text: 'Enter your username first.' })

    setForgotBusy(true)
    setForgotMsg(null)
    try {
      const res = await fetch('/admin/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data && data.statusCode === 200) {
        setForgotMsg({ kind: 'success', text: data.message || 'Check your email for the new password.' })
        setTimeout(() => setForgotOpen(false), 1800)
      } else {
        setForgotMsg({ kind: 'error', text: data.message || 'Could not reset the password.' })
      }
    } catch (err) {
      console.error('[forgot]', err)
      setForgotMsg({ kind: 'error', text: 'Could not reach the server. Try again.' })
    } finally {
      setForgotBusy(false)
    }
  }

  return (
    <div className="login-card account-pages pt-2 pt-sm-5 pb-4 pb-sm-5">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-xxl-4 col-lg-5 col-md-7">

            <div className="card">
              <div className="card-header pt-4 pb-4 text-center bg-white border-bottom">
                <img
                  src="/assets/images/logo/logo.png"
                  alt="xCore eArchive"
                  height="32"
                  loading="eager"
                />
              </div>

              <div className="card-body p-4">
                <div className="text-center w-75 m-auto">
                  <h4 className="text-dark-50 text-center pb-0 fw-bold">Sign in</h4>
                  <p className="text-muted mb-4">
                    Enter your username or email address and password to continue.
                  </p>
                </div>

                <form onSubmit={submit} noValidate>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="signin-user">Username or email</label>
                    <input
                      id="signin-user"
                      className="form-control"
                      type="text"
                      autoComplete="username"
                      placeholder="Your username or email"
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <a href="#" className="text-muted float-end" onClick={openForgot}>
                      <small>Forgot your password?</small>
                    </a>
                    <label className="form-label" htmlFor="signin-password">Password</label>
                    <div className="input-group input-group-merge">
                      <input
                        id="signin-password"
                        className="form-control"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="input-group-text"
                        onClick={() => setShowPassword((s) => !s)}
                        title={showPassword ? 'Hide password' : 'Show password'}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <i className={`mdi ${showPassword ? 'mdi-eye-off-outline' : 'mdi-eye-outline'}`} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="signin-remember"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="signin-remember">
                        Keep me signed in
                      </label>
                    </div>
                  </div>

                  <div className="mb-0 text-center d-grid">
                    <button className="btn btn-primary" type="submit" disabled={signingIn}>
                      {signingIn
                        ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Signing in&hellip;</>
                        : 'Sign in'}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                <i className="mdi mdi-alert-circle-outline me-1" />
                {error}
              </div>
            )}

            <div className="row mt-3">
              <div className="col-12 text-center">
                <p className="text-white-50">
                  Trouble signing in? Contact your system administrator.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ background: 'rgba(0,0,0,.5)' }}
          onMouseDown={(e) => e.target === e.currentTarget && !forgotBusy && setForgotOpen(false)}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Reset your password</h4>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotBusy}
                />
              </div>

              <div className="modal-body">
                <p className="text-muted">
                  Enter your username. If the account exists, a new password is sent to the
                  email address on file.
                </p>
                <div className="mb-2">
                  <label className="form-label" htmlFor="forgot-user">Username</label>
                  <input
                    id="forgot-user"
                    type="text"
                    className="form-control"
                    placeholder="Your username"
                    value={forgotUser}
                    onChange={(e) => setForgotUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !forgotBusy && submitForgot()}
                    autoFocus
                  />
                </div>

                {forgotMsg && (
                  <div
                    className={`alert py-2 px-3 mb-0 alert-${forgotMsg.kind === 'success' ? 'success' : 'danger'}`}
                    role="alert"
                  >
                    <i className={`mdi ${forgotMsg.kind === 'success' ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'} me-1`} />
                    {forgotMsg.text}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setForgotOpen(false)}
                  disabled={forgotBusy}
                >
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={submitForgot} disabled={forgotBusy}>
                  {forgotBusy
                    ? <><span className="spinner-border spinner-border-sm me-1" role="status" />Sending&hellip;</>
                    : 'Send new password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
