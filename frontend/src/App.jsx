import { AuthProvider, useAuth } from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'

function AppInner() {
  const { user, loading: authLoading } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  if (wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading workspace...</div>
      </div>
    )
  }

  if (!activeWorkspace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-gray-600 text-sm">
            No workspace found. Contact support if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  return <DashboardPage />
}

export default function App() {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AppInner />
      </WorkspaceProvider>
    </AuthProvider>
  )
}
