import React, { useState, useEffect } from 'react'
import PageTitle from '../components/PageTitle'

export default function EditProfile() {
  const [user, setUser] = useState(null)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [profilePicture, setProfilePicture] = useState(null)

  useEffect(() => {
    fetchUserData()
  }, [])

  const fetchUserData = async () => {
    try {
      const res = await fetch('http://localhost:4801/admin/dashboard-data', { 
        credentials: 'include', 
        headers: { Accept: 'application/json' } 
      })
      const data = await res.json()
      if (res.ok && data.user) {
        setUser(data.user)
      }
    } catch (err) {
      console.error('Error fetching user data:', err)
    }
  }

  const showToast = (type, message) => {
    if (window.Swal && window.Swal.mixin) {
      const Toast = window.Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      })
      Toast.fire({ icon: type, title: message })
    } else {
      alert(message)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    
    if (!oldPass.trim()) return showToast('error', 'Old password required')
    if (!newPass.trim()) return showToast('error', 'New password required')
    if (!confirmPass.trim()) return showToast('error', 'Confirm password required')
    if (newPass !== confirmPass) return showToast('error', 'New password mis-match')

    try {
      const formData = new FormData()
      formData.append('oldPass', oldPass)
      formData.append('newPass', newPass)

      const res = await fetch('http://localhost:4801/admin/update-password', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()
      
      if (data.statusCode === 404) {
        showToast('error', data.message)
      } else if (data.statusCode === 200) {
        showToast('success', data.message)
        setOldPass('')
        setNewPass('')
        setConfirmPass('')
      }
    } catch (err) {
      showToast('error', 'Error updating password')
    }
  }

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('profilePicture', file)

    try {
      const res = await fetch('http://localhost:4801/admin/upload-profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()
      
      if (data.success) {
        showToast('success', 'Profile picture updated successfully!')
        fetchUserData()
      } else {
        showToast('error', data.message || 'Error uploading file')
      }
    } catch (err) {
      showToast('error', 'Error uploading file')
    }
  }

  if (!user) {
    return (
      <div className="container-fluid">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    )
  }

  const profilePicUrl = user.profilePicturePath 
    ? `/profile-pictures/${user.profilePicturePath.split(/\/|\\/).pop()}` 
    : '/assets/images/user/7.jpg'

  return (
    <>
      <PageTitle title="Edit Profile" />
      <div className="container-fluid">
        <div className="edit-profile">
          <div className="row">
            <div className="col-xl-4 col-lg-5">
              <div className="card">
                <div className="card-header pb-0">
                  <h4 className="card-title mb-0">My Profile</h4>
                </div>
                <div className="card-body">
                  <div className="row mb-2">
                    <div className="profile-title">
                      <div className="d-lg-flex d-block align-items-center">
                        <div className="pp position-relative" 
                             style={{ cursor: 'pointer' }}
                             onMouseEnter={(e) => e.currentTarget.querySelector('.edit-text').style.display = 'block'}
                             onMouseLeave={(e) => e.currentTarget.querySelector('.edit-text').style.display = 'none'}
                             onClick={() => document.getElementById('file-input').click()}>
                          <div className="profile-picture-container" style={{ width: '70px', height: '70px', borderRadius: '50%', overflow: 'hidden' }}>
                            <img
                              className="img-70 rounded-circle"
                              alt="Profile Picture"
                              src={profilePicUrl}
                              onError={(e) => { e.target.src = '/assets/images/user/7.jpg' }}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <span className="edit-text" style={{ 
                            position: 'absolute', 
                            bottom: '10px', 
                            left: '50%', 
                            transform: 'translateX(-50%)', 
                            display: 'none', 
                            background: 'rgba(0, 0, 0, 0.6)', 
                            color: 'white', 
                            padding: '5px 10px', 
                            borderRadius: '5px', 
                            fontSize: '10px',
                            whiteSpace: 'nowrap'
                          }}>
                            Edit
                          </span>
                          <input 
                            type="file" 
                            id="file-input" 
                            style={{ display: 'none' }} 
                            onChange={handleProfilePictureChange}
                            accept="image/*"
                          />
                        </div>
                        <div className="flex-grow-1 ms-3">
                          <h3 className="mb-1 f-20 txt-primary">{user.fullname}</h3>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label f-w-500">Email Address</label>
                    <input className="form-control" value={user.email || ''} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label f-w-500">Private Email Address</label>
                    <input className="form-control" value={user.private_email || ''} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label f-w-500">Username</label>
                    <input className="form-control" value={user.username || ''} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label f-w-500">Branch</label>
                    <input className="form-control" value={user.branch?.name || ''} disabled />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-8 col-lg-7">
              <form className="card" onSubmit={handleChangePassword}>
                <div className="card-header pb-0">
                  <h4 className="card-title mb-0">Change Password</h4>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label f-w-500">Old Password</label>
                        <div className="position-relative">
                          <input
                            className="form-control"
                            type="password"
                            placeholder="Provide old password"
                            value={oldPass}
                            onChange={(e) => setOldPass(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-6">
                      <div className="mb-3">
                        <label className="form-label f-w-500">New Password</label>
                        <div className="position-relative">
                          <input
                            className="form-control"
                            type="password"
                            placeholder="Provide new password"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-6 col-md-6">
                      <div className="mb-3">
                        <label className="form-label f-w-500">Confirm Password</label>
                        <div className="position-relative">
                          <input
                            className="form-control"
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card-footer text-end">
                  <button className="btn btn-primary" type="submit">
                    Change password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
