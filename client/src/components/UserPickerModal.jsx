import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'

/**
 * UserPickerModal — search and select people.
 *
 * Usage is unchanged:
 *   1. <UserPickerModal ref={pickerRef} />
 *   2. const users = await pickerRef.current.show()
 *   3. resolves to an array of usernames, or null if cancelled
 *
 * Rebuilt on Hyper markup. It also used to look for `firstName` / `lastName`,
 * which /admin/retrieve-users has never returned — it sends `fullname`. Every
 * row therefore fell back to showing the username, and searching for somebody
 * by their actual name matched nothing. Both are fixed here.
 */
const UserPickerModal = React.forwardRef((props, ref) => {
  const [isVisible, setIsVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [manualEntry, setManualEntry] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resolvePromise, setResolvePromise] = useState(null)

  useEffect(() => {
    if (isVisible && allUsers.length === 0) fetchUsers()
  }, [isVisible])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/admin/retrieve-users', {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setAllUsers(Array.isArray(data.records) ? data.records : [])
      }
    } catch (err) {
      console.error('[picker] users', err)
    }
    setIsLoading(false)
  }

  // The same five fields the Users page searches, so the two behave alike.
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return allUsers
    return allUsers.filter((u) => (
      (u.fullname || '').toLowerCase().includes(term) ||
      (u.username || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      ((u.branch && u.branch.name) || '').toLowerCase().includes(term) ||
      ((u.archive_category && u.archive_category.name) || '').toLowerCase().includes(term)
    ))
  }, [searchTerm, allUsers])

  React.useImperativeHandle(ref, () => ({
    show: () => new Promise((resolve) => {
      setResolvePromise(() => resolve)
      setIsVisible(true)
      setSearchTerm('')
      setSelectedUsers([])
      setManualEntry('')
    }),
    hide: () => setIsVisible(false),
  }))

  const handleConfirm = () => {
    let recipients = [...selectedUsers]
    if (manualEntry.trim()) {
      recipients = [
        ...recipients,
        ...manualEntry.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean),
      ]
    }
    if (resolvePromise) resolvePromise(recipients.length > 0 ? recipients : null)
    setIsVisible(false)
  }

  const handleCancel = () => {
    if (resolvePromise) resolvePromise(null)
    setIsVisible(false)
  }

  const toggleUserSelection = (username) => {
    setSelectedUsers((prev) => (
      prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
    ))
  }

  const manualChips = manualEntry.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  const total = selectedUsers.length + manualChips.length
  const nothingChosen = selectedUsers.length === 0 && !manualEntry.trim()

  if (!isVisible) return null

  return (
    <Modal
      title="Select users"
      onClose={handleCancel}
      size="lg"
      footer={
        <>
          <button className="btn btn-light" onClick={handleCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={nothingChosen}>
            {total > 0 ? `Select ${total} ${total === 1 ? 'person' : 'people'}` : 'Select'}
          </button>
        </>
      }
    >
      <div className="position-relative mb-2">
        <input
          type="text"
          className="form-control"
          placeholder="Name, username, email, branch or department"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="d-flex justify-content-between align-items-center mb-1">
        <span className="text-muted font-13">
          {isLoading ? 'Loading…' : `${filteredUsers.length} of ${allUsers.length} shown`}
        </span>
        {selectedUsers.length > 0 && (
          <button className="btn btn-link btn-sm p-0 font-13" onClick={() => setSelectedUsers([])}>
            Clear {selectedUsers.length} selected
          </button>
        )}
      </div>

      <div className="border rounded" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {isLoading && (
          <div className="text-center py-4">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        )}

        {!isLoading && filteredUsers.length === 0 && (
          <div className="text-center py-4">
            <i className="mdi mdi-account-off-outline text-muted" style={{ fontSize: 28 }} />
            <p className="text-muted mb-0 mt-1">No users match that search.</p>
          </div>
        )}

        {!isLoading && filteredUsers.map((user) => {
          const username = user.username || user.email || user.id
          const isSelected = selectedUsers.includes(username)
          // fullname is what the API actually returns.
          const displayName = user.fullname || username
          const where = [user.branch?.name, user.archive_category?.name].filter(Boolean).join(' · ')

          return (
            <div
              key={username}
              role="button"
              className={`d-flex align-items-center px-2 py-2 border-bottom${isSelected ? ' bg-light' : ''}`}
              onClick={() => toggleUserSelection(username)}
            >
              <input
                type="checkbox"
                className="form-check-input mt-0 me-2 flex-shrink-0"
                checked={isSelected}
                onChange={() => {}}
              />
              <div className="flex-grow-1 min-w-0">
                <div className="fw-semibold text-truncate">{displayName}</div>
                <div className="text-muted font-12 text-truncate">
                  {username}{where && ` — ${where}`}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3">
        <label className="form-label font-13" htmlFor="picker-manual">
          Or enter manually, separated by commas
        </label>
        <input
          id="picker-manual"
          type="text"
          className="form-control"
          placeholder="username1, name@example.com"
          value={manualEntry}
          onChange={(e) => setManualEntry(e.target.value)}
        />
        {manualChips.length > 0 && (
          <div className="mt-2">
            {manualChips.map((entry, idx) => (
              <span key={idx} className="badge bg-light text-dark me-1 mb-1">{entry}</span>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
})

UserPickerModal.displayName = 'UserPickerModal'

export default UserPickerModal
