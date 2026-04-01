import React, { useState, useEffect, useContext } from 'react'
import UserPickerModal from './UserPickerModal'
import { AuthsContext } from '../pages/Gallery'

/**
 * FileSendingHistoryModal - Shows file sending history in a modal
 * Can display current user's sent files or (for admin/supervisor) other users' files
 * 
 * Props:
 * - onNavigateToFile: callback(filePath, fileName) - navigate to file in folder tree
 * - onDeleteFile: callback(fileName, filePath) - delete file
 * 
 * Usage:
 * 1. Add <FileSendingHistoryModal ref={historyRef} onNavigateToFile={...} /> to your component
 * 2. Call historyRef.current.show() to display
 */
const FileSendingHistoryModal = React.forwardRef((props, ref) => {
  const auths = useContext(AuthsContext)
  const { onNavigateToFile, onDeleteFile } = props
  const [isVisible, setIsVisible] = useState(false)
  const [historyRecords, setHistoryRecords] = useState([])
  const [filteredRecords, setFilteredRecords] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [limit, setLimit] = useState(10)
  const [currentUser, setCurrentUser] = useState(null)
  const [searchingUser, setSearchingUser] = useState(null)
  const [canSearchOthers, setCanSearchOthers] = useState(false)
  const [expandedRecords, setExpandedRecords] = useState({}) // Track which records are expanded
  const userPickerModalRef = React.useRef(null)

  // Log auths from context
  useEffect(() => {
    console.log('[FileSendingHistoryModal] auths from context:', auths)
    console.log('[FileSendingHistoryModal] auths.is_admin:', auths?.is_admin)
  }, [auths])

  // Get current user info on mount
  useEffect(() => {
    const checkUserAndPermissions = async () => {
      try {
        const res = await fetch('/admin/dashboard-data', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          if (data.user) {
            setCurrentUser(data.user)
          }
        }
      } catch (err) {
        console.error('Error fetching user info:', err)
      }
    }
    checkUserAndPermissions()
  }, [])

  // Update canSearchOthers based on auths from context
  useEffect(() => {
    if (auths && auths.is_admin) {
      setCanSearchOthers(true)
      console.log('[FileSendingHistoryModal] User is admin, can search others')
    } else {
      setCanSearchOthers(false)
      console.log('[FileSendingHistoryModal] User is not admin, cannot search others')
    }
  }, [auths])

  // Expose show method to parent via ref
  React.useImperativeHandle(ref, () => ({
    show: (username = null) => {
      setIsVisible(true)
      setError(null)
      if (username) {
        // Show history for specific user
        setSearchingUser(username)
        fetchHistory(username)
      } else {
        // Show current user's history
        setSearchingUser(null)
        fetchHistory()
      }
    },
    hide: () => {
      setIsVisible(false)
    },
  }))

  const fetchHistory = async (username = null, limitValue = null) => {
    setIsLoading(true)
    setError(null)
    try {
      const finalLimit = limitValue || limit
      let endpoint = '/admin/file-sending-history'
      if (username) {
        endpoint = `/admin/file-sending-history/${encodeURIComponent(username)}`
      }
      endpoint += `?limit=${finalLimit}`

      const res = await fetch(endpoint, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch history')
      const data = await res.json()
      
      if (data.statusCode === 200 && data.records) {
        setHistoryRecords(data.records || [])
        setFilteredRecords(data.records || [])
        setSearchingUser(username)
      } else {
        setError(data.message || 'Failed to fetch history')
        setHistoryRecords([])
        setFilteredRecords([])
      }
    } catch (err) {
      console.error('Error fetching history:', err)
      setError(err.message || 'Error fetching history')
      setHistoryRecords([])
      setFilteredRecords([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit)
    fetchHistory(searchingUser, newLimit)
  }

  const handleSearchUserClick = async () => {
    if (!canSearchOthers) {
      alert('You do not have permission to view other users\' file sending history')
      return
    }
    const selectedUsers = await userPickerModalRef.current?.show()
    if (selectedUsers && selectedUsers.length > 0) {
      fetchHistory(selectedUsers[0], limit)
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      setIsVisible(false)
    }
  }

  // Group records by batch or date for folder-like structure
  const groupRecordsByBatch = () => {
    const groups = {}
    filteredRecords.forEach((record) => {
      const key = record.batchName || `Sent to ${record.receiverUsername}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(record)
    })
    return groups
  }

  if (!isVisible) return null

  const groupedRecords = groupRecordsByBatch()

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
        zIndex: 99999,
      }}
      onClick={handleBackdropClick}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #e9ecef 100%)',
          borderRadius: '14px',
          padding: '32px 28px 24px 28px',
          width: '700px',
          maxWidth: '95vw',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(30,41,59,0.18)',
          border: '1px solid #e3e3e3',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            setIsVisible(false)
            setSearchingUser(null)
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            fontSize: '22px',
            color: '#64748b',
            cursor: 'pointer',
            transition: 'color 0.15s',
          }}
          onMouseOver={(e) => (e.target.style.color = '#1e293b')}
          onMouseOut={(e) => (e.target.style.color = '#64748b')}
        >
          ×
        </button>

        {/* Header */}
        <h2
          style={{
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#1e293b',
            marginBottom: '16px',
            margin: 0,
          }}
        >
          File Sending History
        </h2>

        {/* User Info & Search */}
        <div style={{ marginBottom: '16px', padding: '12px', background: '#e0e7f5', borderRadius: '8px' }}>
          <div style={{ fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <strong>Viewing:</strong>{' '}
              {searchingUser ? (
                <span>{searchingUser}</span>
              ) : (
                <span>{currentUser?.username || 'Your'} files</span>
              )}
            </div>
            {searchingUser && (
              <button
                onClick={() => {
                  setSearchingUser(null)
                  fetchHistory()
                }}
                style={{
                  padding: '4px 10px',
                  background: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: '500',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.target.style.background = '#4f46e5')}
                onMouseLeave={(e) => (e.target.style.background = '#6366f1')}
              >
                Clear Search
              </button>
            )}
          </div>
          {canSearchOthers && !searchingUser && (
            <button
              onClick={handleSearchUserClick}
              style={{
                padding: '8px 12px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => (e.target.style.background = '#1d4ed8')}
              onMouseLeave={(e) => (e.target.style.background = '#2563eb')}
            >
              Search User
            </button>
          )}
        </div>

        {/* Limit Selector */}
        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', color: '#1e293b' }}>
          <label style={{ fontWeight: '600', color: '#1e293b' }}>Show last:</label>
          <select
            value={limit}
            onChange={(e) => handleLimitChange(parseInt(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.95rem',
              cursor: 'pointer',
              background: '#fff',
              color: '#1e293b',
            }}
          >
            <option value={5}>5 files</option>
            <option value={10} selected>10 files</option>
            <option value={20}>20 files</option>
            <option value={50}>50 files</option>
            <option value={100}>100 files</option>
            <option value={200}>200 files</option>
          </select>
        </div>

        {/* History Records */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            background: '#fff',
            marginBottom: '16px',
            color: '#1e293b',
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p>Loading history...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#dc3545' }}>
              <p>{error}</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <p>No file sending history found</p>
            </div>
          ) : (
            Object.entries(groupedRecords).map(([groupName, records]) => (
              <div key={groupName} style={{ marginBottom: '16px' }}>
                <div
                  onClick={() => {
                    // Toggle expansion of all records in this group
                    const isGroupExpanded = Object.values(expandedRecords).some(v => typeof v === 'boolean' && v === true)
                    setExpandedRecords(prev => {
                      const newState = {}
                      records.forEach((_, idx) => {
                        newState[`${groupName}-${idx}`] = !isGroupExpanded
                      })
                      return newState
                    })
                  }}
                  style={{
                    padding: '12px',
                    background: '#f1f5f9',
                    borderRadius: '6px',
                    fontWeight: '600',
                    color: '#1e293b',
                    marginBottom: '8px',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  <span style={{ fontSize: '1.1rem' }}>▼</span>
                  📁 {groupName}
                  <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#64748b' }}>
                    ({records.length} {records.length === 1 ? 'file' : 'files'})
                  </span>
                </div>
                <div style={{ marginLeft: '16px' }}>
                  {records.map((record, idx) => {
                    const recordKey = `${groupName}-${idx}`
                    const isExpanded = expandedRecords[recordKey]
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          borderLeft: '3px solid #2563eb',
                          background: '#f8fafc',
                          color: '#1e293b',
                          marginBottom: '8px',
                          borderRadius: '4px',
                          fontSize: '0.9rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => setExpandedRecords(prev => ({ ...prev, [recordKey]: !prev[recordKey] }))}
                        onMouseOver={(e) => e.currentTarget.style.background = '#eef2f7'}
                        onMouseOut={(e) => e.currentTarget.style.background = '#f8fafc'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.8rem' }}>{isExpanded ? '▼' : '▶'}</span>
                          <span>
                            📋 Sent to <strong>{record.receiverUsername}</strong>
                            <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#64748b' }}>
                              ({Array.isArray(record.fileNames) ? record.fileNames.length : 1} file{Array.isArray(record.fileNames) && record.fileNames.length !== 1 ? 's' : ''})
                            </span>
                          </span>
                        </div>
                        {isExpanded && (
                          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #e2e8f0', color: '#1e293b' }}>
                            <div style={{ marginBottom: '6px' }}>
                              <strong>Files:</strong>{' '}
                              {Array.isArray(record.fileNames) ? (
                                record.fileNames.map((fileName, fidx) => (
                                  <span key={fidx}>
                                    <span
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        console.log('[FileSendingHistoryModal] Clicked filename:', fileName)
                                        if (onNavigateToFile && record.filePath && record.filePath[fidx]) {
                                          console.log('[FileSendingHistoryModal] Calling onNavigateToFile with:', record.filePath[fidx], fileName)
                                          onNavigateToFile(record.filePath[fidx], fileName)
                                          setIsVisible(false)
                                        } else {
                                          console.log('[FileSendingHistoryModal] Missing onNavigateToFile or filePath')
                                        }
                                      }}
                                      style={{
                                        color: '#2563eb',
                                        cursor: 'pointer',
                                        textDecoration: 'underline',
                                        marginRight: '8px',
                                        fontWeight: '500',
                                      }}
                                      onMouseOver={(e) => (e.target.style.color = '#1d4ed8')}
                                      onMouseOut={(e) => (e.target.style.color = '#2563eb')}
                                      title="Click to show file location in folder"
                                    >
                                      {fileName}
                                    </span>
                                    {fidx < record.fileNames.length - 1 && ', '}
                                  </span>
                                ))
                              ) : (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    console.log('[FileSendingHistoryModal] Clicked filename:', record.fileNames)
                                    console.log('[FileSendingHistoryModal] onNavigateToFile exists:', !!onNavigateToFile)
                                    console.log('[FileSendingHistoryModal] record.filePath:', record.filePath)
                                    console.log('[FileSendingHistoryModal] Full record:', record)
                                    if (onNavigateToFile && record.filePath && record.filePath[0]) {
                                      console.log('[FileSendingHistoryModal] Calling onNavigateToFile with:', record.filePath[0], record.fileNames)
                                      onNavigateToFile(record.filePath[0], record.fileNames)
                                      setIsVisible(false)
                                    } else {
                                      console.log('[FileSendingHistoryModal] Missing onNavigateToFile or filePath')
                                    }
                                  }}
                                  style={{
                                    color: '#2563eb',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    fontWeight: '500',
                                  }}
                                  onMouseOver={(e) => (e.target.style.color = '#1d4ed8')}
                                  onMouseOut={(e) => (e.target.style.color = '#2563eb')}
                                  title="Click to show file location in folder"
                                >
                                  {record.fileNames}
                                </span>
                              )}
                            </div>
                            <div style={{ marginBottom: '6px', color: '#475569' }}>
                              <strong>From:</strong> {record.senderUsername}
                            </div>
                            <div style={{ color: '#475569', fontSize: '0.85rem' }}>
                              <strong>Sent:</strong>{' '}
                              {new Date(record.sentAt).toLocaleString()}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '12px 20px',
              fontSize: '1rem',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              background: '#6c757d',
              color: '#fff',
              transition: 'background 0.18s',
            }}
            onMouseEnter={(e) => (e.target.style.background = '#5a6268')}
            onMouseLeave={(e) => (e.target.style.background = '#6c757d')}
          >
            Close
          </button>
        </div>
      </div>

      <UserPickerModal ref={userPickerModalRef} />
    </div>
  )
})

FileSendingHistoryModal.displayName = 'FileSendingHistoryModal'

export default FileSendingHistoryModal
