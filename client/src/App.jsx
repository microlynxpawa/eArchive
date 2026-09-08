import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/dashboard.jsx'
import Auth from './pages/auth/Auth.jsx'
import Layout from './components/Layout.jsx'
import Gallery from './pages/Gallery.jsx'
import SendFiles from './pages/SendFiles.jsx'
import FileUpload from './pages/FileUpload.jsx'
import AuditTrail from './pages/AuditTrail.jsx'
import UserManagement from './pages/UserManagement.jsx'
import Departments from './pages/Departments.jsx'
import Branches from './pages/Branches.jsx'
import EditProfile from './pages/EditProfile.jsx'
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx'
import Announcements from './pages/Announcements'
import RequireAdmin from './components/RequireAdmin'

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
              <Route path="send-files" element={<SendFiles />} />
              <Route path="audit-log" element={<RequireAdmin><AuditTrail /></RequireAdmin>} />
              <Route path="user-management" element={<RequireAdmin><UserManagement /></RequireAdmin>} />
              <Route path="user-group" element={<RequireAdmin><Departments /></RequireAdmin>} />
              <Route path="branches" element={<RequireAdmin><Branches /></RequireAdmin>} />
              <Route path="edit-profile" element={<EditProfile />} />
              <Route path="announcements" element={<RequireAdmin allow="announce"><Announcements /></RequireAdmin>} />
              <Route path="super-dashboard" element={<SuperAdminDashboard />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
