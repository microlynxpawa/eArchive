import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/dashboard.jsx'
import Auth from './pages/auth/Auth.jsx'
import Layout from './components/Layout.jsx'
import Gallery from './pages/Gallery.jsx'
import FileUpload from './pages/FileUpload.jsx'
import AuditTrail from './pages/AuditTrail.jsx'
import UserManagement from './pages/UserManagement.jsx'
import Departments from './pages/Departments.jsx'
import Branches from './pages/Branches.jsx'
import EditProfile from './pages/EditProfile.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-vh-100 bg-light">
        <div className="container-fluid p-0" style={{ minHeight: '100vh' }}>
          <Routes>
            {/* Public auth route */}
            <Route path="/" element={<Auth />} />

            {/* App routes use Layout wrapper */}
            <Route element={<Layout />}>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="see-file" element={<Gallery />} />
              <Route path="file-upload" element={<FileUpload />} />
              <Route path="audit-log" element={<AuditTrail />} />
              <Route path="user-management" element={<UserManagement />} />
              <Route path="user-group" element={<Departments />} />
              <Route path="branches" element={<Branches />} />
              <Route path="edit-profile" element={<EditProfile />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
