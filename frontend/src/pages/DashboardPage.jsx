import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { getExpenses, createExpense, deleteExpense, getCategories } from '../api'
import BalanceCard  from '../components/BalanceCard'
import AddForm      from '../components/AddForm'
import SpendPie     from '../components/SpendPie'
import SpendBar     from '../components/SpendBar'
import ExpenseList  from '../components/ExpenseList'
import { LogOut } from 'lucide-react'

export default function DashboardPage() {
  const { signOut, user } = useAuth()
  const { activeWorkspace, workspaces, switchWorkspace } = useWorkspace()

  const [expenses,   setExpenses]   = useState([])
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [adding,     setAdding]     = useState(false)
  const [error,      setError]      = useState(null)

  const fetchData = useCallback(async () => {
    if (!activeWorkspace) return

    try {
      setLoading(true)
      setError(null)

      const [expRes, catRes] = await Promise.all([
        getExpenses(activeWorkspace.id),
        getCategories(activeWorkspace.id),
      ])

      setExpenses(expRes.data)
      setCategories(catRes.data)
    } catch (err) {
      console.error('[DashboardPage] fetch error:', err)
      setError('Failed to load data. Check console for details.')
    } finally {
      setLoading(false)
    }
  }, [activeWorkspace])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async (data) => {
    setAdding(true)
    try {
      const res = await createExpense(activeWorkspace.id, data)
      setExpenses(prev => [res.data, ...prev])
    } catch (err) {
      throw err // re-throw so AddForm can show error
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (id) => {
    // Optimistic update
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      await deleteExpense(id)
    } catch (err) {
      console.error('[handleDelete]', err)
      fetchData() // revert on error
    }
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <>
      {/* Ambient blobs */}
      <div className="blob w-96 h-96 bg-royal" style={{ top: '-80px', left: '-80px' }} />
      <div className="blob w-80 h-80 bg-blush" style={{ bottom: '-60px', right: '-60px' }} />
      <div className="blob w-60 h-60 bg-indigo-300" style={{ top: '40%', left: '55%' }} />

      <div className="relative z-10 min-h-screen px-4 py-8 md:py-12">
        {/* Header with workspace selector + sign out */}
        <header className="max-w-4xl mx-auto mb-8 flex items-center justify-between">
          <div>
            <h1
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ color: '#4169E1' }}
            >
              💸 Kharcha Tracker
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {activeWorkspace?.name || 'Loading...'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {workspaces.length > 1 && (
              <select
                value={activeWorkspace?.id || ''}
                onChange={e => switchWorkspace(e.target.value)}
                className="text-xs bg-white/60 border border-blue-100 rounded-xl px-3 py-2 text-gray-700 cursor-pointer"
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={signOut}
              className="text-xs text-gray-500 hover:text-red-600 transition flex items-center gap-1.5"
              title="Sign out"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="max-w-4xl mx-auto mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-5 py-3 flex items-center justify-between gap-3">
            <span>⚠️ {error}</span>
            <button
              onClick={fetchData}
              className="text-xs font-bold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-5">
          {/* Balance — full width */}
          <BalanceCard total={total} count={expenses.length} loading={loading} />

          {/* Two-column grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Left */}
            <div className="flex flex-col gap-5">
              <AddForm categories={categories} onAdd={handleAdd} loading={adding} />
              <SpendPie expenses={expenses} />
            </div>

            {/* Right */}
            <div className="flex flex-col gap-5">
              <SpendBar expenses={expenses} />
              <ExpenseList
                expenses={expenses}
                onDelete={handleDelete}
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="max-w-4xl mx-auto text-center mt-10 text-xs text-gray-400">
          Signed in as {user?.email} — Data secured with Supabase RLS
        </footer>
      </div>
    </>
  )
}
