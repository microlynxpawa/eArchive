import React, { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import UserPickerModal from './UserPickerModal'

/*
 * Access control
 *
 * Choose people, then set one level for all of them. Unchanged: the picker,
 * GET /admin/searchUsers to load their current data, the level derived from the
 * permissions array, the confirmation step, and the POST body of three booleans
 * with exactly one true.
 *
 * The levels were checkboxes that a DOM handler kept unticking to fake
 * exclusivity. They are radios now, which is what they always were.
 */

const LEVELS = [
  {
    key: 'admin',
    label: 'Admin',
    grants: 'Manage users, branches, departments and access control, view the audit trail, and delete any file they can see.',
  },
  {
    key: 'supervisor',
    label: 'Supervisor',
    grants: 'Supervision rights over their department, without the administration pages.',
  },
  {
    key: 'personnel',
    label: 'Personnel',
    grants: 'Ordinary access: their own work, with no supervision or administration rights.',
  },
]

/** The level a person currently holds, from their permissions array. */
function currentLevel(user) {
  let perms = user?.permissions
  if (typeof perms === 'string') {
    try { perms = JSON.parse(perms) } catch { perms = [] }
  }
  const list = Array.isArray(perms) ? perms : []
  if (list.includes('is_admin')) return 'admin'
  if (list.includes('supervision-right')) return 'supervisor'
  return 'personnel'
}

const LEVEL_LABEL = { admin: 'Admin', supervisor: 'Supervisor', personnel: 'Personnel' }
const LEVEL_TONE = { admin: 'primary', supervisor: 'info', personnel: 'secondary' }

export default function AccessControl({ open = false, onClose = () => {} }) {
  const [usernames, setUsernames] = useState([])
  const [usersData, setUsersData] = useState([])
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState(null)

  const pickerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      setUsernames([]); setUsersData([]); setLevel('')
      setConfirming(false); setError(null)
    }
  }, [open])

  const showToast = (type, message) => {
    if (window.Swal?.mixin) {
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
      color: '#fff', borderRadius: '6px', zIndex: 12000,
      background: type === 'success' ? '#22c55e' : '#dc3545',
    })
    document.body.appendChild(t)
    setTimeout(() => t.remove(), 2500)
  }

  const choosePeople = async () => {
    if (!pickerRef.current?.show) return
    const picked = await pickerRef.current.show()
    if (!picked || picked.length === 0) return

    setUsernames(picked)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/admin/searchUsers?usernames=${encodeURIComponent(picked.join(','))}`,
        { credentials: 'include', headers: { Accept: 'application/json' } }
      )
      if (!res.ok) throw new Error('Failed to load the selected people')
      const data = await res.json()
      setUsersData(Array.isArray(data) ? data : [data])
    } catch (err) {
      console.error('[access] load', err)
      setError('Error fetching user data')
      setUsersData([])
    }
    setLoading(false)
  }

  const apply = async () => {
    setApplying(true)
    setError(null)
    try {
      // Three booleans, exactly one true - unchanged.
      const res = await fetch(
        `/admin/searchUsers/permissions?usernames=${encodeURIComponent(usernames.join(','))}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            admin: level === 'admin',
            supervisor: level === 'supervisor',
            personnel: level === 'personnel',
          }),
        }
      )
      if (!res.ok) throw new Error('Failed')
      showToast('success', 'Permissions updated successfully for all selected users.')
      setConfirming(false)
      onClose()
    } catch (err) {
      console.error('[access] apply', err)
      setError('Update failed')
      showToast('error', 'Update failed')
      setConfirming(false)
    }
    setApplying(false)
  }

  if (!open) return <UserPickerModal ref={pickerRef} />

  return (
    <>
      <UserPickerModal ref={pickerRef} />

      {/* The confirmation replaces the main dialog rather than stacking on it. */}
      {confirming ? (
        <Modal
          title="Apply this level?"
          onClose={() => setConfirming(false)}
          busy={applying}
          footer={
            <>
              <button className="btn btn-light" onClick={() => setConfirming(false)} disabled={applying}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={apply} disabled={applying}>
                {applying && <span className="spinner-border spinner-border-sm me-1" role="status" />}
                {applying ? 'Applying…' : `Apply to ${usernames.length} ${usernames.length === 1 ? 'person' : 'people'}`}
              </button>
            </>
          }
        >
          <p>
            <strong>{LEVEL_LABEL[level]}</strong> will be set for{' '}
            <strong>{usernames.length}</strong> {usernames.length === 1 ? 'person' : 'people'}.
          </p>
          <div className="alert alert-warning py-2 px-3 mb-0">
            <i className="mdi mdi-alert-outline me-1" />
            This replaces whatever level each of them holds now, including anyone who is currently
            an Admin.
          </div>
        </Modal>
      ) : (
        <Modal
          title="Access control"
          onClose={onClose}
          size="lg"
          scrollable
          footer={
            <>
              <button className="btn btn-light" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={!level || usernames.length === 0}
                onClick={() => setConfirming(true)}
                title={!level ? 'Choose a level first' : undefined}
              >
                {usernames.length > 0
                  ? `Apply to ${usernames.length} ${usernames.length === 1 ? 'person' : 'people'}`
                  : 'Apply'}
              </button>
            </>
          }
        >
          <div className="d-flex align-items-center mb-3" style={{ gap: 8 }}>
            <button className="btn btn-light border btn-sm" onClick={choosePeople}>
              <i className="mdi mdi-account-multiple-plus-outline me-1" />
              {usernames.length > 0 ? 'Change selection' : 'Choose people'}
            </button>
            {usernames.length > 0 && (
              <span className="text-muted font-13">
                {usernames.length} selected
              </span>
            )}
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="spinner-border text-primary" role="status" />
            </div>
          )}

          {!loading && usernames.length === 0 && (
            <div className="text-center py-4">
              <i className="mdi mdi-account-multiple-outline text-muted" style={{ fontSize: 34 }} />
              <h5 className="mt-2 mb-1">Nobody selected yet</h5>
              <p className="text-muted mb-0">
                Choose the people whose access level you want to change.
              </p>
            </div>
          )}

          {!loading && usersData.length > 0 && (
            <>
              {/* You are replacing something, so show what. */}
              <label className="form-label mb-2">Selected people and their level now</label>
              <div className="mb-3">
                {usersData.map((u) => {
                  const lvl = currentLevel(u)
                  return (
                    <div key={u.username} className="d-flex align-items-center py-1" style={{ gap: 8 }}>
                      <i className="mdi mdi-account-outline text-muted" />
                      <span>{u.fullname || u.username}</span>
                      <span className="text-muted font-12">{u.username}</span>
                      <span className={`badge bg-${LEVEL_TONE[lvl]}-lighten text-${LEVEL_TONE[lvl]} ms-auto`}>
                        {LEVEL_LABEL[lvl]}
                      </span>
                    </div>
                  )
                })}
              </div>

              <label className="form-label mb-2">Set everyone selected to</label>
              {LEVELS.map((l) => (
                <div className="form-check mb-2" key={l.key}>
                  <input
                    className="form-check-input"
                    type="radio"
                    name="ac-level"
                    id={`ac-${l.key}`}
                    checked={level === l.key}
                    onChange={() => setLevel(l.key)}
                  />
                  <label className="form-check-label" htmlFor={`ac-${l.key}`}>
                    <span className="fw-semibold">{l.label}</span>
                    <span className="text-muted font-12 d-block">{l.grants}</span>
                  </label>
                </div>
              ))}

              <div className="alert alert-warning py-2 px-3 mt-3 mb-0">
                <i className="mdi mdi-alert-outline me-1" />
                The level applies to everyone selected and replaces the one they hold now.
              </div>
            </>
          )}

          {error && (
            <div className="alert alert-danger py-2 px-3 mt-3 mb-0">
              <i className="mdi mdi-alert-circle-outline me-1" />{error}
            </div>
          )}
        </Modal>
      )}
    </>
  )
}
