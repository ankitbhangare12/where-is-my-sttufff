import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.jsx'
import { useAuth } from './hooks/useAuth.js'
import AppLayout from './layouts/AppLayout.jsx'
import LandingPage from './pages/LandingPage.jsx'
import { LoginPage, SignupPage, ForgotPasswordPage, ResetPasswordPage } from './pages/AuthPages.jsx'
import {
  HomePage,
  FindPage,
  ItemsPage,
  LocationsPage,
  ScanPage,
} from './pages/CorePages.jsx'
import SetupPage from './pages/SetupPage.jsx'

function ProtectedRoutes() {
  const { configured, loading, user } = useAuth()
  if (!configured) return <SetupPage />
  if (loading) return <div className="app-loading" role="status">Opening your home…</div>
  if (!user) return <Navigate to="/login" replace />
  return <AppLayout />
}

function AppRoutes() {
  const { configured, loading, user } = useAuth()
  if (configured && loading) return <div className="app-loading" role="status">Opening your home…</div>
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <LoginPage configured={configured} loading={loading} />} />
      <Route path="/signup" element={user ? <Navigate to="/app" replace /> : <SignupPage configured={configured} loading={loading} />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage configured={configured} />} />
      <Route path="/reset-password" element={<ResetPasswordPage configured={configured} />} />
      <Route path="/app" element={<ProtectedRoutes />}>
        <Route index element={<HomePage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="items" element={<ItemsPage />} />
        <Route path="locations" element={<LocationsPage />} />
        <Route path="find" element={<FindPage />} />
        <Route path="dashboard" element={<Navigate to="/app" replace />} />
        <Route path="belongings" element={<Navigate to="/app/items" replace />} />
        <Route path="borrowed" element={<Navigate to="/app/items" replace />} />
        <Route path="missing" element={<Navigate to="/app/items" replace />} />
        <Route path="settings" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" toastOptions={{ duration: 3500 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
