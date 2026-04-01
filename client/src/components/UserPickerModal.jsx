import React, { useState, useEffect } from 'react'

/**
 * UserPickerModal - A modal for searching and selecting users to send files to
 * 
 * Usage:
 * 1. Add <UserPickerModal ref={userPickerRef} /> to your component
 * 2. Call const users = await userPickerRef.current.show() to display
 * 3. Returns array of selected usernames/emails, or null if cancelled
 */
const UserPickerModal = React.forwardRef((props, ref) => {
  const [isVisible, setIsVisible] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [allUsers, setAllUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedUsers, setSelectedUsers] = useState([])
  const [manualEntry, setManualEntry] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resolvePromise, setResolvePromise] = useState(null)

  // Fetch users when modal opens
  useEffect(() => {
    if (isVisible && allUsers.length === 0) {
      fetchUsers()
    }
  }, [isVisible])

  // Filter users based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(allUsers)
    } else {
      const term = searchTerm.toLowerCase()
      const filtered = allUsers.filter(user => 
        (user.username && user.username.toLowerCase().includes(term)) ||
        (user.email && user.email.toLowerCase().includes(term)) ||
        (user.firstName && user.firstName.toLowerCase().includes(term)) ||
        (user.lastName && user.lastName.toLowerCase().includes(term))
      )
      setFilteredUsers(filtered)
    }
  }, [searchTerm, allUsers])

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/admin/retrieve-users', { 
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      if (res.ok) {
        const data = await res.json()
        const users = Array.isArray(data.records) ? data.records : []
        setAllUsers(users)
        setFilteredUsers(users)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Expose show method to parent via ref
  React.useImperativeHandle(ref, () => ({
    show: () => {
      return new Promise((resolve) => {
        setResolvePromise(() => resolve)
        setIsVisible(true)
        setSearchTerm('')
        setSelectedUsers([])
        setManualEntry('')
      })
    },
    hide: () => {
      setIsVisible(false)
    }
  }))

  const handleConfirm = () => {
    let recipients = [...selectedUsers]
    
    // Add manual entries if any
    if (manualEntry.trim()) {
      const manualEntries = manualEntry
        .split(/[,\s]+/)
        .map(s => s.trim())
        .filter(Boolean)
      recipients = [...recipients, ...manualEntries]
    }

    if (resolvePromise) {
      resolvePromise(recipients.length > 0 ? recipients : null)
    }
    setIsVisible(false)
  }

  const handleCancel = () => {
    if (resolvePromise) {
      resolvePromise(null)
    }
    setIsVisible(false)
  }

  const toggleUserSelection = (username) => {
    setSelectedUsers(prev => 
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    )
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleCancel()
    }
  }

  if (!isVisible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(30, 41, 59, 0.45)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 99999
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e9ecef 100%)',
          borderRadius: '14px',
          padding: '32px 28px 24px 28px',
          width: '500px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(30,41,59,0.18)',
          border: '1px solid #e3e3e3',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={handleCancel}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '22px',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'color 0.15s'
          }}
          onMouseOver={(e) => e.target.style.color = '#1e293b'}
          onMouseOut={(e) => e.target.style.color = '#64748b'}
        >
          ×
        </button>

        {/* Header */}
        <h2 style={{
          fontSize: '1.3rem',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '16px',
          margin: 0
        }}>
          Select Users
        </h2>

        {/* Search */}
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '11px 14px',
            fontSize: '16px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#f1f5f9',
            marginBottom: '16px',
            outline: 'none',
            transition: 'border 0.2s'
          }}
          onFocus={(e) => {
            e.target.style.border = '1.5px solid #2563eb'
            e.target.style.background = '#fff'
          }}
          onBlur={(e) => {
            e.target.style.border = '1px solid #cbd5e1'
            e.target.style.background = '#f1f5f9'
          }}
          autoFocus
        />

        {/* User List */}
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '10px 8px',
            background: '#fff',
            marginBottom: '16px',
            boxShadow: '0 2px 8px rgba(30,41,59,0.06)'
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p>Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p>No users found</p>
            </div>
          ) : (
            filteredUsers.map((user, index) => {
              const username = user.username || user.email || user.id
              const isSelected = selectedUsers.includes(username)
              const displayName = user.firstName && user.lastName 
                ? `${user.firstName} ${user.lastName}` 
                : username
              const isLast = index === filteredUsers.length - 1

              return (
                <div
                  key={username}
                  onClick={() => toggleUserSelection(username)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 0',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    background: isSelected ? '#e0e7ef' : 'transparent',
                    transition: 'background 0.15s',
                    fontSize: '1.08rem',
                    color: '#334155',
                    borderBottom: isLast ? 'none' : '1px solid #e5e7eb'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f8fafc'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{
                      accentColor: '#2563eb',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{displayName}</div>
                    {user.email && user.email !== username && (
                      <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
                        {user.email}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Manual Entry */}
        <div>
          <label style={{
            fontSize: '0.95rem',
            fontWeight: '600',
            color: '#334155',
            marginBottom: '8px',
            display: 'block'
          }}>
            Or enter manually (comma-separated):
          </label>
          <input
            type="text"
            placeholder="username1, email@example.com, ..."
            value={manualEntry}
            onChange={(e) => setManualEntry(e.target.value)}
            style={{
              width: '100%',
              padding: '11px 14px',
              fontSize: '16px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              background: '#f1f5f9',
              marginBottom: '8px',
              outline: 'none',
              transition: 'border 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.border = '1.5px solid #2563eb'
              e.target.style.background = '#fff'
            }}
            onBlur={(e) => {
              e.target.style.border = '1px solid #cbd5e1'
              e.target.style.background = '#f1f5f9'
            }}
          />
          {/* Show manual entries as chips/tags */}
          {manualEntry.trim() && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {manualEntry.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).map((entry, idx) => (
                  <span
                    key={idx}
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      background: '#e0e7ef',
                      color: '#334155',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Count */}
        {selectedUsers.length > 0 && (
          <div style={{
            fontSize: '0.95rem',
            color: '#64748b',
            marginBottom: '12px',
            fontWeight: '500'
          }}>
            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
          </div>
        )}

        {/* Footer Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          marginTop: '10px'
        }}>
          <button
            onClick={handleCancel}
            style={{
              padding: '12px 20px',
              fontSize: '1.08rem',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              letterSpacing: '0.01em',
              transition: 'background 0.18s',
              background: '#6c757d',
              color: '#fff'
            }}
            onMouseEnter={(e) => e.target.style.background = '#5a6268'}
            onMouseLeave={(e) => e.target.style.background = '#6c757d'}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedUsers.length === 0 && !manualEntry.trim()}
            style={{
              padding: '12px 20px',
              fontSize: '1.08rem',
              borderRadius: '7px',
              border: 'none',
              cursor: selectedUsers.length === 0 && !manualEntry.trim() ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              letterSpacing: '0.01em',
              transition: 'background 0.18s',
              background: selectedUsers.length === 0 && !manualEntry.trim() ? '#94a3b8' : '#2563eb',
              color: '#fff',
              boxShadow: '0 2px 8px rgba(37,99,235,0.15)',
              opacity: selectedUsers.length === 0 && !manualEntry.trim() ? 0.6 : 1
            }}
            onMouseEnter={(e) => {
              if (!(selectedUsers.length === 0 && !manualEntry.trim())) {
                e.target.style.background = '#1d4ed8'
              }
            }}
            onMouseLeave={(e) => {
              if (!(selectedUsers.length === 0 && !manualEntry.trim())) {
                e.target.style.background = '#2563eb'
              }
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
})

UserPickerModal.displayName = 'UserPickerModal'

export default UserPickerModal

