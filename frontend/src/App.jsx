import { useState, useEffect, useCallback } from 'react'
import BalanceCard  from './components/BalanceCard'
import AddForm      from './components/AddForm'
import SpendPie     from './components/SpendPie'
import SpendBar     from './components/SpendBar'
import ExpenseList  from './components/ExpenseList'
import { getExpenses, createExpense, deleteExpense } from './api'

export default function App() {
  const [expenses,  setExpenses]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [adding,    setAdding]    = useState(false)
  const [error,     setError]     = useState(null)

  // ── Fetch all expenses ──────────────────────────────────────────────
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getExpenses()
      setExpenses(res.data.data)
    } catch {
      setError('Cannot connect to backend. Make sure the server is running on port 5000.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  // ── Add expense ─────────────────────────────────────────────────────
  const handleAdd = async (data) => {
    setAdding(true)
    try {
      const res = await createExpense(data)
      setExpenses(prev => [res.data.data, ...prev])
    } catch (err) {
      // re-throw so AddForm's catch block can show the error message
      throw err
    } finally {
      setAdding(false)
    }
  }

  // ── Delete expense ──────────────────────────────────────────────────
  const handleDelete = async (id) => {
    // Optimistic update
    setExpenses(prev => prev.filter(e => e.id !== id))
    try {
      await deleteExpense(id)
    } catch {
      // Revert on failure
      fetchExpenses()
    }
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <>
      {/* Ambient blobs */}
      <div className="blob w-96 h-96 bg-royal" style={{ top: '-80px', left: '-80px' }} />
      <div className="blob w-80 h-80 bg-blush" style={{ bottom: '-60px', right: '-60px' }} />
      <div className="blob w-60 h-60 bg-indigo-300" style={{ top: '40%', left: '55%' }} />

      <div className="relative z-10 min-h-screen px-4 py-8 md:py-12">
        {/* Header */}
        <header className="text-center mb-8">
          <h1
            className="text-3xl md:text-4xl font-extrabold tracking-tight"
            style={{ color: '#4169E1' }}
          >
            💸 Kharcha Tracker
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Apna kharch track karo — data saved to server
          </p>
        </header>

        {/* Error banner */}
        {error && (
          <div className="max-w-4xl mx-auto mb-5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-5 py-3 flex items-center justify-between gap-3">
            <span>⚠️ {error}</span>
            <button
              onClick={fetchExpenses}
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
              <AddForm onAdd={handleAdd} loading={adding} />
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
        <footer className="text-center mt-10 text-xs text-gray-400">
          Made with ❤️ for Pakistan — data persisted on your local server
        </footer>
      </div>
    </>
  )
}
