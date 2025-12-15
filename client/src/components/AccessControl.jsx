import React, { useState, useEffect, useRef } from 'react'
import UserPickerModal from './UserPickerModal'

export default function AccessControl() {
  const [visible, setVisible] = useState(false)
  const [selectedUsers, setSelectedUsers] = useState([])
  const [usersData, setUsersData] = useState([])
  const [permissionsVisible, setPermissionsVisible] = useState(false)
  const userPickerRef = useRef(null)

  useEffect(() => {
    // expose function for legacy button id
    window.openAccessControl = function() { openModal() }
    // also hook to DOM id used in sidebar
    const btn = document.getElementById('access-control-button')
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openModal() })
  }, [])

  const openModal = async () => {
    setVisible(true)
    setPermissionsVisible(false)
    setSelectedUsers([])
    setUsersData([])
  }

  const selectUsers = async () => {
    if (!userPickerRef.current) return
    
    // Hide this modal temporarily
    setVisible(false)
    
    // Show UserPickerModal immediately
    const users = await userPickerRef.current.show()
    
    // Show this modal again after user selection
    setVisible(true)
    
    if (users && users.length > 0) {
      setSelectedUsers(users)
      // Fetch full user data including permissions
      await fetchUsersData(users)
      setPermissionsVisible(true)
    }
  }

  const fetchUsersData = async (usernames) => {
    try {
      const res = await fetch(`/admin/searchUsers?usernames=${encodeURIComponent(usernames.join(','))}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      })
      const data = await res.json()
      console.log('AccessControl - Fetched user data:', data)
      const users = Array.isArray(data) ? data : [data]
      users.forEach(user => {
        console.log('User:', user.username, 'Permissions:', user.permissions)
      })
      setUsersData(users)
    } catch (err) { 
      console.error(err)
      alert('Error fetching user data')
    }
  }

  const parsePermissions = (permString) => {
    console.log('=== PARSING PERMISSIONS ===')
    console.log('Raw permissions value:', permString)
    console.log('Type:', typeof permString)
    
    try {
      // If it's already an object, return it
      if (typeof permString === 'object' && permString !== null) {
        console.log('Already an object:', permString)
        return permString
      }
      
      // If it's a string, try to parse it
      const parsed = permString ? JSON.parse(permString) : {}
      console.log('Parsed from string:', parsed)
      return parsed
    } catch (e) {
      console.error('Error parsing permissions:', e)
      console.error('Could not parse value:', permString)
      return {}
    }
  }

  const getCurrentRole = (perms) => {
    console.log('=== DETERMINING ROLE ===')
    console.log('Permissions object:', perms)
    
    // Permissions come as an array of strings like: ["scanning", "archiving", "is_admin"]
    // Convert to array if it isn't already
    const permArray = Array.isArray(perms) ? perms : []
    
    console.log('Permission array:', permArray)
    console.log('Has is_admin?', permArray.includes('is_admin'))
    console.log('Has supervision-right?', permArray.includes('supervision-right'))
    console.log('Has scanning?', permArray.includes('scanning'))
    
    // Based on backend logic:
    // Admin: has "is_admin" in permissions array
    // Supervisor: has "supervision-right" in permissions array (and not admin)
    // Personnel: has any of "scanning", "archiving", "view-upload"
    
    if (permArray.includes('is_admin')) {
      console.log('→ Determined role: Admin')
      return 'Admin'
    }
    
    if (permArray.includes('supervision-right')) {
      console.log('→ Determined role: Supervisor')
      return 'Supervisor'
    }
    
    if (permArray.includes('scanning') || permArray.includes('archiving') || permArray.includes('view-upload')) {
      console.log('→ Determined role: Personnel')
      return 'Personnel'
    }
    
    console.log('→ Determined role: No Role Assigned')
    return 'No Role Assigned'
  }

  // Handle mutual exclusion for permission checkboxes
  const handlePermissionCheckboxChange = (e) => {
    const checkedId = e.target.id
    // Uncheck all other permission checkboxes
    const checkboxes = ['perm-admin', 'perm-supervisor', 'perm-personnel']
    checkboxes.forEach(id => {
      if (id !== checkedId) {
        const cb = document.getElementById(id)
        if (cb) cb.checked = false
      }
    })
  }

  async function updatePermissions() {
    if (selectedUsers.length === 0) return alert('No users selected')
    
    // Gather permission inputs from DOM
    const isAdmin = document.getElementById('perm-admin')?.checked || false
    const isSupervisor = document.getElementById('perm-supervisor')?.checked || false
    const isPersonnel = document.getElementById('perm-personnel')?.checked || false
    
    if (!isAdmin && !isSupervisor && !isPersonnel) {
      return alert('Please select at least one permission level')
    }
    
    // Use SweetAlert2 for confirmation
    const result = await window.Swal?.fire({
      title: 'Confirm Update',
      text: 'Are you sure you want to update permissions for all selected users?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#22c55e',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, update',
      cancelButtonText: 'Cancel'
    })
    
    if (!result?.isConfirmed) return
    
    try {
      const res = await fetch(`/admin/searchUsers/permissions?usernames=${encodeURIComponent(selectedUsers.join(','))}`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify({
          admin: isAdmin,
          supervisor: isSupervisor,
          personnel: isPersonnel
        })
      })
      
      if (!res.ok) throw new Error('Failed')
      
      const Toast = window.Swal?.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      })
      
      if (Toast) {
        Toast.fire({ icon: 'success', title: 'Permissions updated successfully for all selected users.' })
      } else {
        alert('Permissions updated successfully for all selected users.')
      }
      
      setVisible(false)
      setPermissionsVisible(false)
      setSelectedUsers([])
      setUsersData([])
    } catch (err) { 
      console.error(err)
      alert('Update failed')
    }
  }

  if (!visible) return <UserPickerModal ref={userPickerRef} />

  return (
    <>
      <UserPickerModal ref={userPickerRef} />
      
      <div style={{
        position:'fixed',
        inset:0,
        display:'flex',
        justifyContent:'center',
        alignItems:'center',
        background:'rgba(0,0,0,0.5)',
        zIndex:99998
      }}>
        <div className="card" style={{
          width: '700px',
          maxWidth:'95vw',
          maxHeight:'90vh',
          overflow:'auto',
          margin: '20px',
          backgroundColor: '#fff',
          color: '#000'
        }}>
          <div className="card-header d-flex justify-content-between align-items-center" style={{color: '#000'}}>
            <h4 className="mb-0" style={{color: '#000'}}>Access Control</h4>
            <button 
              className="btn-close" 
              onClick={() => {
                setVisible(false)
                setPermissionsVisible(false)
                setSelectedUsers([])
                setUsersData([])
              }}
            ></button>
          </div>
          
          <div className="card-body" style={{color: '#000'}}>
            {!permissionsVisible ? (
              <div className="text-center py-4">
                <p className="mb-3" style={{color: '#000'}}>Select users to manage their permissions</p>
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={selectUsers}
                >
                  <i className="fa fa-users me-2"></i>
                  Select Users
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <h5 className="mb-3" style={{color: '#000'}}>Selected Users ({selectedUsers.length})</h5>
                  <div className="list-group">
                    {usersData.map((user, idx) => {
                      const perms = parsePermissions(user.permissions)
                      const permArray = Array.isArray(perms) ? perms : []
                      const currentRole = getCurrentRole(perms)
                      return (
                        <div key={idx} className="list-group-item" style={{backgroundColor: '#f8f9fa', color: '#000'}}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <h6 className="mb-1" style={{color: '#000'}}>{user.username}</h6>
                              <small className="text-muted" style={{color: '#6c757d'}}>{user.email}</small>
                            </div>
                            <div className="text-end">
                              <div style={{fontSize: '12px', fontWeight: '500', color: '#6c757d', marginBottom: '4px'}}>
                                Current Role:
                              </div>
                              <div className="mt-1">
                                {currentRole === 'Admin' && (
                                  <span className="badge bg-danger" style={{color: '#fff', fontSize: '11px'}}>Admin</span>
                                )}
                                {currentRole === 'Supervisor' && (
                                  <span className="badge bg-warning" style={{color: '#000', fontSize: '11px'}}>Supervisor</span>
                                )}
                                {currentRole === 'Personnel' && (
                                  <span className="badge bg-info" style={{color: '#fff', fontSize: '11px'}}>Personnel</span>
                                )}
                                {currentRole === 'No Role Assigned' && (
                                  <span className="badge bg-secondary" style={{color: '#fff', fontSize: '11px'}}>No Role</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <h5 className="mb-3" style={{color: '#000'}}>Select or modify user permissions</h5>
                  <p className="text-muted small mb-3" style={{color: '#6c757d'}}>Only one role can be selected at a time</p>
                  
                  <div className="d-flex flex-column gap-2">
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="perm-admin" 
                        onChange={handlePermissionCheckboxChange}
                      />
                      <label className="form-check-label" htmlFor="perm-admin" style={{color: '#000'}}>
                        <strong>Admin Roles</strong>
                      </label>
                    </div>
                    
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="perm-supervisor" 
                        onChange={handlePermissionCheckboxChange}
                      />
                      <label className="form-check-label" htmlFor="perm-supervisor" style={{color: '#000'}}>
                        <strong>Supervisor Roles</strong>
                      </label>
                    </div>
                    
                    <div className="form-check">
                      <input 
                        className="form-check-input" 
                        type="checkbox" 
                        id="perm-personnel" 
                        onChange={handlePermissionCheckboxChange}
                      />
                      <label className="form-check-label" htmlFor="perm-personnel" style={{color: '#000'}}>
                        <strong>User Roles</strong>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="d-flex gap-2">
                  <button 
                    className="btn btn-success w-100"
                    onClick={updatePermissions}
                  >
                    <i className="fa fa-check me-2"></i>
                    Update Permissions
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
