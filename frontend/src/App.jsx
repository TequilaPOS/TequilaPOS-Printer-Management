import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PrinterDetail from './pages/PrinterDetail'
import Jobs from './pages/Jobs'
import Reports from './pages/Reports'
import Notifications from './pages/Notifications'
import Users from './pages/Users'
import SystemLogs from './pages/SystemLogs'
import Settings from './pages/Settings'
import Print from './pages/Print'
import Architecture from './pages/Architecture'
import Quotas from './pages/Quotas'
import Discovery from './pages/Discovery'
import Status from './pages/Status'
import Documentation from './pages/Documentation'
import Maintenance from './pages/Maintenance'

// Protected Route wrapper
function ProtectedRoute({ children, requiredRoles = [] }) {
  const { user, isLoading } = useAuth()
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }
  
  return children
}

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="status" element={<Status />} />
        <Route path="print" element={<Print />} />
        <Route path="architecture" element={<Architecture />} />
        <Route path="printers/:id" element={<PrinterDetail />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="reports" element={<Reports />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="settings" element={<Settings />} />
        <Route path="documentation" element={<Documentation />} />
        
        {/* Admin only routes */}
        <Route path="admin/users" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Users />
          </ProtectedRoute>
        } />
        <Route path="admin/logs" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <SystemLogs />
          </ProtectedRoute>
        } />
        <Route path="admin/quotas" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Quotas />
          </ProtectedRoute>
        } />
        <Route path="admin/discovery" element={
          <ProtectedRoute requiredRoles={['admin', 'operator']}>
            <Discovery />
          </ProtectedRoute>
        } />
        <Route path="admin/maintenance" element={
          <ProtectedRoute requiredRoles={['admin']}>
            <Maintenance />
          </ProtectedRoute>
        } />
      </Route>
      
      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
