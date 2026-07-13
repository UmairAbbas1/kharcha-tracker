import { useState } from 'react'
import { AuthProvider, useAuth }           from './context/AuthContext'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import AuthPage      from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ExpensesPage  from './pages/ExpensesPage'
import Sidebar       from './components/Sidebar'

// ── Module placeholder component ─────────────────────────────────────
function ComingSoon({ label }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-screen"
         style={{ background: '#F7F8FC' }}>
      <div className="text-center card p-12 max-w-sm">
        <p className="text-2xl mb-3">🚧</p>
        <p className="text-base font-bold" style={{ color: '#0F1117' }}>{label}</p>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          This module is coming soon.
        </p>
      </div>
    </div>
  )
}

function AppInner() {
  const { user, loading: authLoading, signOut } = useAuth()
  const { activeWorkspace, loading: wsLoading } = useWorkspace()
  const [activeModule, setActiveModule] = useState('dashboard')

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center"
           style={{ background: '#F7F8FC' }}>
        <div className="animate-pulse text-sm" style={{ color: '#9CA3AF' }}>
          Loading…
        </div>
      </div>
    )
  }

  if (!user)            return <AuthPage />
  if (!activeWorkspace) return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: '#F7F8FC' }}>
      <div className="card p-8 text-center text-sm" style={{ color: '#6B7280' }}>
        No workspace found. Contact support.
      </div>
    </div>
  )

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard': return <DashboardPage />
      case 'expenses':  return <ExpensesPage />
      case 'budgets':   return <ComingSoon label="Budgets" />
      case 'insights':  return <ComingSoon label="Smart Insights" />
      case 'analytics': return <ComingSoon label="Analytics" />
      case 'split':     return <ComingSoon label="Split & Group" />
      case 'export':    return <ComingSoon label="Export" />
      case 'alerts':    return <ComingSoon label="Alert History" />
      case 'guide':     return <ComingSoon label="Guide" />
      case 'settings':  return <ComingSoon label="Settings" />
      default:          return <DashboardPage />
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#F7F8FC' }}>
      <Sidebar
        activeModule={activeModule}
        onNavigate={setActiveModule}
        workspaceName={activeWorkspace.name}
        onSignOut={signOut}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {renderModule()}
      </main>
    </div>
  )
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
