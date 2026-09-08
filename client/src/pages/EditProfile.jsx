import React, { useEffect, useRef, useState } from 'react'

/*
 * My profile
 *
 * Rebuilt on Hyper markup. The details stay read-only - none of them was ever
 * editable here - and both actions keep their endpoints and payloads: a
 * multipart picture upload, and oldPass/newPass as FormData, which
 * /admin/update-password can read because its route carries upload.none().
 */

const ACCEPT = '.jpg,.jpeg,.png'
const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png']

function initialsOf(name) {
  return String(name || '?')
    .split(/[\s.@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
}

/** A read-only detail, shown as a disabled input so it still reads as a field. */
function ReadOnlyField({ label, value, col = 'col-md-6' }) {
  return (
    <div className={`${col} mb-3`}>
      <label className="form-label">{label}</label>
      <input type="text" className="form-control" value={value || '—'} disabled readOnly />
    </div>
  )
}

export default function EditProfile() {
  const [user, setUser] = useState(null)

  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [reveal, setReveal] = useState({ old: false, next: false, confirm: false })
  const [pwErrors, setPwErrors] = useState({})
  const [pwResult, setPwResult] = useState(null)   // { ok, message }
  const [updating, setUpdating] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [picResult, setPicResult] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => { fetchUserData() }, [])

  const showToast = (type, message) => {
    // Keep SweetAlert when the app has loaded it, as before - but never fall
    // back to alert(), which blocks the page until it is dismissed.
    if (window.Swal && window.Swal.mixin) {
      window.Swal.mixin({
        toast: true, position: 'top-end', showConfirmButton: false,
        timer: 3000, timerProgressBar: true,
      }).fire({ icon: type, title: message })
      return
    }
    const t = document.createElement('div')
    t.innerText = message
    Object.assign(t.style, {
      position: 'fixed', right: '30px', bottom: '30px', padding: '12px 20px',
      color: '#fff', borderRadius: '6px', zIndex: 12000, fontSize: '0.95rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  const fetchUserData = async () => {
    try {
      const res = await fetch('/admin/dashboard-data', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json()
      if (res.ok && data.user) setUser(data.user)
    } catch (err) {
      console.error('[profile] load', err)
    }
  }

  // ------------------------------------------------------------- picture

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Windows can report an empty file.type, so judge on the extension too.
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (!ALLOWED.includes(file.type) && !['jpg', 'jpeg', 'png'].includes(ext)) {
      setPicResult({ ok: false, message: 'Choose a JPG or PNG image.' })
      showToast('error', 'Choose a JPG or PNG image.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }

    const formData = new FormData()
    formData.append('profilePicture', file)

    setUploading(true)
    setPicResult(null)
    try {
      const res = await fetch('/admin/upload-profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setPicResult({ ok: true, message: 'Profile picture updated.' })
        showToast('success', 'Profile picture updated successfully!')
        fetchUserData()
      } else {
        setPicResult({ ok: false, message: data.message || 'Error uploading file' })
        showToast('error', data.message || 'Error uploading file')
      }
    } catch (err) {
      console.error('[profile] upload', err)
      setPicResult({ ok: false, message: 'Error uploading file' })
      showToast('error', 'Error uploading file')
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ------------------------------------------------------------ password

  const handleChangePassword = async (e) => {
    if (e) e.preventDefault()
    setPwResult(null)

    // Same three rules as before, now also shown against the field at fault.
    const next = {}
    if (!oldPass.trim()) next.old = 'Old password required'
    if (!newPass.trim()) next.next = 'New password required'
    if (!confirmPass.trim()) next.confirm = 'Confirm password required'
    if (!next.next && !next.confirm && newPass !== confirmPass) {
      next.confirm = 'New password mis-match'
    }
    setPwErrors(next)
    if (Object.keys(next).length > 0) {
      showToast('error', Object.values(next)[0])
      return
    }

    const formData = new FormData()
    formData.append('oldPass', oldPass)
    formData.append('newPass', newPass)

    setUpdating(true)
    try {
      const res = await fetch('/admin/update-password', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()

      if (data.statusCode === 200) {
        showToast('success', data.message)
        setPwResult({ ok: true, message: data.message })
        setOldPass(''); setNewPass(''); setConfirmPass('')
      } else {
        // The server's own wording, surfaced rather than replaced.
        const message = data.message || 'Unexpected response'
        showToast('error', message)
        setPwResult({ ok: false, message })
      }
    } catch (err) {
      console.error('[profile] password', err)
      showToast('error', 'Error updating password')
      setPwResult({ ok: false, message: 'Error updating password' })
    }
    setUpdating(false)
  }

  const passwordField = (key, label, value, setValue) => (
    <div className="mb-3">
      <label className="form-label" htmlFor={`pf-${key}`}>{label}<span className="text-danger">*</span></label>
      <div className="input-group">
        <input
          id={`pf-${key}`}
          type={reveal[key] ? 'text' : 'password'}
          className={`form-control${pwErrors[key] ? ' is-invalid' : ''}`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          className="btn btn-light border"
          type="button"
          onClick={() => setReveal((r) => ({ ...r, [key]: !r[key] }))}
          title={reveal[key] ? 'Hide' : 'Show'}
          aria-label={reveal[key] ? 'Hide password' : 'Show password'}
        >
          <i className={`mdi ${reveal[key] ? 'mdi-eye-off-outline' : 'mdi-eye-outline'}`} />
        </button>
      </div>
      {pwErrors[key] && <div className="invalid-feedback d-block">{pwErrors[key]}</div>}
    </div>
  )

  if (!user) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    )
  }

  const picUrl = user.profilePicturePath
    ? `/profile-pictures/${String(user.profilePicturePath).split(/[\\/]/).pop()}?t=${Date.now()}`
    : null

  return (
    <>
      <div className="row">
        <div className="col-12">
          <div className="page-title-box">
            <h4 className="page-title">My profile</h4>
          </div>
        </div>
      </div>

      <div className="row">
        {/* ------------------------------------------------ profile card */}
        <div className="col-lg-4">
          <div className="card">
            <div className="card-body text-center">
              {picUrl
                ? <img src={picUrl} alt="Profile" className="rounded-circle avatar-lg img-thumbnail" />
                : (
                  <div className="avatar-lg mx-auto">
                    <span className="avatar-title bg-primary-lighten text-primary rounded-circle" style={{ fontSize: 24 }}>
                      {initialsOf(user.fullname || user.username)}
                    </span>
                  </div>
                )}

              <h4 className="mb-0 mt-2">{user.fullname || user.username}</h4>
              <p className="text-muted font-14 mb-1">{user.username}</p>
              {/*
                * Branch only. /admin/dashboard-data returns the branch object but
                * not the department - just userGroupId - and resolving that name
                * would need either an API change or a call to an admin-only
                * endpoint, which this page cannot make: it has to work for users
                * with no administration permission at all. Left out rather than
                * designed around.
                */}
              <p className="text-muted font-13 mb-3">{user.branch?.name || '—'}</p>

              <input
                ref={fileRef}
                type="file"
                className="d-none"
                accept={ACCEPT}
                onChange={handleProfilePictureChange}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => fileRef.current && fileRef.current.click()}
                disabled={uploading}
              >
                {uploading && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {uploading ? 'Uploading…' : <><i className="mdi mdi-camera-outline me-1" />Change picture</>}
              </button>
              <p className="text-muted font-12 mt-2 mb-0">JPG or PNG.</p>

              {picResult && (
                <div className={`alert ${picResult.ok ? 'alert-success' : 'alert-danger'} py-2 px-3 mt-2 mb-0 font-13`}>
                  {picResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------- details */}
        <div className="col-lg-8">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-1">Details</h5>
              {/* Four disabled inputs with no explanation read as broken. */}
              <p className="text-muted font-13 mb-3">
                These are set by an administrator. Ask them if something needs changing.
              </p>

              <div className="row">
                <ReadOnlyField label="Full name" value={user.fullname} />
                <ReadOnlyField label="Username" value={user.username} />
                <ReadOnlyField label="Work email" value={user.email} />
                <ReadOnlyField label="Private email" value={user.private_email} />
                <ReadOnlyField label="Branch" value={user.branch?.name} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <h5 className="mb-3">Change password</h5>

              <form onSubmit={handleChangePassword}>
                {passwordField('old', 'Current password', oldPass, setOldPass)}
                {passwordField('next', 'New password', newPass, setNewPass)}
                {passwordField('confirm', 'Confirm new password', confirmPass, setConfirmPass)}

                {pwResult && (
                  <div className={`alert ${pwResult.ok ? 'alert-success' : 'alert-danger'} py-2 px-3 mb-3`}>
                    <i className={`mdi ${pwResult.ok ? 'mdi-check-circle-outline' : 'mdi-alert-circle-outline'} me-1`} />
                    {pwResult.message}
                  </div>
                )}

                <button type="submit" className="btn btn-primary" disabled={updating}>
                  {updating && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                  {updating ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
