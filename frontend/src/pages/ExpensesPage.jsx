/**
 * ExpensesPage.jsx — Full expense management module.
 *
 * Scope:
 *   - Search (title, 150ms debounce)
 *   - Category filter + Month filter (combinable)
 *   - Sort by date or amount (toggle asc/desc)
 *   - Pagination (25 per page)
 *   - Add Expense panel (collapsible, reuses AddForm)
 *   - Delete (optimistic, from useExpenses hook)
 *   - Export (existing exportCsv)
 *   - Summary bar showing totals for active filter
 *
 * Join safety note (REQ-EXP-24):
 *   getExpenses uses `categories(name, icon, color)` — this is a LEFT join in
 *   PostgREST (rows with null category_id get categories: null, not dropped).
 *   Safe to use as-is. No change made to getExpenses.
 *
 * Scope verification (prevents signOut-style orphan bug):
 *   Every identifier used in JSX is imported or declared in this file.
 *   Checked: useExpenses ✓  getCategories ✓  AddForm ✓  categoryIcon ✓
 *            exportCsv ✓  useWorkspace ✓  useAuth ✓  all lucide icons ✓
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, ChevronUp, ChevronDown, Plus, Download,
  Trash2, Loader2, SlidersHorizontal,
} from 'lucide-react'

import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useExpenses }  from '../hooks/useExpenses'
import { getCategories, exportCsv } from '../api'
import AddForm      from '../components/AddForm'
import { categoryIcon } from '../components/CategoryIcon'

// ── Constants ─────────────────────────────────────────────────────────
const PAGE_SIZE = 25
const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

function dateLabel(dateStr) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (dateStr === today)     return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Generate last 12 months as { value: 'YYYY-MM', label: 'Jul 2026' }
function getLast12Months() {
  const months = []
  const now    = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-PK', { month: 'short', year: 'numeric' }),
    })
  }
  return months
}

// ── Sort icon ─────────────────────────────────────────────────────────
function SortIcon({ col, activeCol, dir }) {
  if (activeCol !== col) return <ChevronDown size={12} style={{ color: '#D1D5DB' }} />
  return dir === 'asc'
    ? <ChevronUp   size={12} style={{ color: '#2563EB' }} />
    : <ChevronDown size={12} style={{ color: '#2563EB' }} />
}

// ── Expense row ───────────────────────────────────────────────────────
function ExpRow({ expense, onDelete }) {
  const cat   = expense.categories || {}
  const color = cat.color || '#94a3b8'

  return (
    <tr
      className="expense-row group border-b"
      style={{ borderColor: '#F3F4F6' }}
    >
      {/* Category icon */}
      <td className="py-3 pl-4 pr-2 w-10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: color + '18' }}
        >
          {categoryIcon(cat.icon, color, 14)}
        </div>
      </td>

      {/* Title */}
      <td className="py-3 pr-4">
        <p className="text-sm font-semibold truncate max-w-[220px]" style={{ color: '#0F1117' }}>
          {expense.title}
        </p>
        <p className="text-xs mt-0.5 flex items-center gap-1.5">
          <span style={{ color }}>{cat.name || 'Other'}</span>
          <span style={{ color: '#D1D5DB' }}>·</span>
          <span style={{ color: '#9CA3AF' }}>{dateLabel(expense.date)}</span>
        </p>
      </td>

      {/* Amount */}
      <td className="py-3 pr-4 text-right">
        <span className="font-mono text-sm font-semibold" style={{ color: '#0F1117' }}>
          {pkr(expense.amount)}
        </span>
      </td>

      {/* Delete */}
      <td className="py-3 pr-4 w-10 text-right">
        <button
          onClick={() => onDelete(expense.id)}
          className="del-btn w-7 h-7 rounded-md flex items-center justify-center
                     hover:bg-red-50 transition-colors ml-auto"
          title="Delete expense"
        >
          <Trash2 size={13} color="#f87171" />
        </button>
      </td>
    </tr>
  )
}

// ── Main page ─────────────────────────────────────────────────────────
export default function ExpensesPage({
  initialSearchQuery,
  onClearSearchQuery,
  autoOpenAdd,
  onClearAutoOpenAdd,
}) {
  const { user }                                = useAuth()
  const { activeWorkspace, workspaces,
          switchWorkspace }                     = useWorkspace()

  const {
    expenses, isLoading,
    addExpense, isAdding, addError, resetAddError, removeExpense,
  } = useExpenses(activeWorkspace?.id)

  const [categories,  setCategories]  = useState([])
  const [catLoading,  setCatLoading]  = useState(true)

  // Handle initial search query from Command Palette
  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== '') {
      setRawSearch(initialSearchQuery)
      setSearch(initialSearchQuery)
      onClearSearchQuery?.()
    }
  }, [initialSearchQuery])

  // ── Filter / sort state ───────────────────────────────────
  const [rawSearch,   setRawSearch]   = useState('')
  const [search,      setSearch]      = useState('')   // debounced
  const [catFilter,   setCatFilter]   = useState('')   // category_id or ''
  const [monthFilter, setMonthFilter] = useState('')   // 'YYYY-MM' or ''
  const [sortCol,     setSortCol]     = useState('date')
  const [sortDir,     setSortDir]     = useState('desc')
  const [page,        setPage]        = useState(1)
  const [showAdd,     setShowAdd]     = useState(false)
  const [exporting,   setExporting]   = useState(false)
  const [exportErr,   setExportErr]   = useState(null)
  const [prefill,     setPrefill]     = useState(null)

  const months = useMemo(getLast12Months, [])

  // Load categories
  useEffect(() => {
    if (!activeWorkspace) return
    setCatLoading(true)
    getCategories(activeWorkspace.id)
      .then(r => setCategories(r.data || []))
      .catch(() => {})
      .finally(() => setCatLoading(false))
  }, [activeWorkspace])

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setSearch(rawSearch), 150)
    return () => clearTimeout(id)
  }, [rawSearch])

  // Handle auto-open add expense from Command Palette
  useEffect(() => {
    if (autoOpenAdd) {
      setShowAdd(true)
      if (typeof autoOpenAdd === 'object' && autoOpenAdd !== null) {
        setPrefill(autoOpenAdd)
      }
      onClearAutoOpenAdd?.()
      setTimeout(() => {
        document.querySelector('input[placeholder="Expense title (e.g. KFC)"]')?.focus()
      }, 50)
    }
  }, [autoOpenAdd])

  // Reset to page 1 on any filter/sort change
  useEffect(() => { setPage(1) }, [search, catFilter, monthFilter, sortCol, sortDir])

  // ── Filter + sort + paginate ──────────────────────────────
  const filtered = useMemo(() => {
    let rows = [...expenses]

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(e => e.title?.toLowerCase().includes(q))
    }
    if (catFilter) {
      rows = rows.filter(e => e.category_id === catFilter)
    }
    if (monthFilter) {
      rows = rows.filter(e => e.date?.slice(0, 7) === monthFilter)
    }

    rows.sort((a, b) => {
      if (sortCol === 'amount') {
        const diff = Number(a.amount) - Number(b.amount)
        return sortDir === 'asc' ? diff : -diff
      }
      // date
      const diff = a.date < b.date ? -1 : a.date > b.date ? 1 : 0
      return sortDir === 'asc' ? diff : -diff
    })

    return rows
  }, [expenses, search, catFilter, monthFilter, sortCol, sortDir])

  const totalPages   = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage     = Math.min(page, totalPages)
  const pageRows     = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const filterTotal  = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const hasFilters   = !!(search || catFilter || monthFilter)

  const clearFilters = () => {
    setRawSearch('')
    setSearch('')
    setCatFilter('')
    setMonthFilter('')
  }

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  // ── Add handler ───────────────────────────────────────────
  const handleAdd = useCallback((data) =>
    new Promise((resolve, reject) => {
      addExpense(data, {
        onSuccess: () => { setShowAdd(false); setPrefill(null); resolve() },
        onError:   (err) => reject(err),
      })
    }), [addExpense])

  // ── Export ────────────────────────────────────────────────
  const handleExport = async () => {
    if (!activeWorkspace) return
    setExporting(true)
    setExportErr(null)
    try {
      await exportCsv(activeWorkspace.id, monthFilter || undefined)
    } catch (err) {
      setExportErr(err.message)
      setTimeout(() => setExportErr(null), 4000)
    } finally {
      setExporting(false)
    }
  }

  // ── Active filter label ───────────────────────────────────
  const filterLabel = [
    catFilter  ? categories.find(c => c.id === catFilter)?.name : null,
    monthFilter ? months.find(m => m.value === monthFilter)?.label : null,
  ].filter(Boolean).join(' · ')

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-5xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Expenses</h1>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {activeWorkspace.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {workspaces.length > 1 && (
              <select
                value={activeWorkspace.id}
                onChange={e => switchWorkspace(e.target.value)}
                className="text-xs rounded-lg border px-2.5 py-1.5 cursor-pointer"
                style={{ borderColor: '#E5E7EB', color: '#6B7280', background: '#fff' }}
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleExport}
              disabled={exporting || filtered.length === 0}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5
                         text-xs font-semibold transition disabled:opacity-40"
              style={{ borderColor: '#E5E7EB', color: '#6B7280', background: '#fff' }}
            >
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {exporting ? 'Exporting…' : 'Export'}
            </button>

            <button
              onClick={() => setShowAdd(v => !v)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5
                         text-xs font-semibold text-white transition"
              style={{ background: showAdd ? '#1D4ED8' : '#2563EB' }}
            >
              <Plus size={13} strokeWidth={2.5} />
              {showAdd ? 'Close' : 'Add Expense'}
            </button>
          </div>
        </div>

        {/* ── Add form panel ── */}
        {showAdd && (
          <div className="mb-6">
            <AddForm
              categories={categories}
              onAdd={handleAdd}
              loading={isAdding}
              prefill={prefill}
              onClearPrefill={() => setPrefill(null)}
            />
            {addError && (
              <p className="text-xs mt-2" style={{ color: '#E85D2F' }}>
                {addError.message}
                <button onClick={resetAddError} className="ml-2 underline">Dismiss</button>
              </p>
            )}
          </div>
        )}

        {/* ── Search + filters ── */}
        <div className="card p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: '#9CA3AF' }} />
              <input
                value={rawSearch}
                onChange={e => setRawSearch(e.target.value)}
                placeholder="Search expenses…"
                className="w-full rounded-lg border pl-8 pr-8 py-1.5 text-sm transition"
                style={{ borderColor: '#E5E7EB', color: '#0F1117', background: '#fff' }}
              />
              {rawSearch && (
                <button
                  onClick={() => setRawSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  style={{ color: '#9CA3AF' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Category filter */}
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer"
              style={{ borderColor: '#E5E7EB', color: catFilter ? '#0F1117' : '#9CA3AF', background: '#fff' }}
            >
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* Month filter */}
            <select
              value={monthFilter}
              onChange={e => setMonthFilter(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer"
              style={{ borderColor: '#E5E7EB', color: monthFilter ? '#0F1117' : '#9CA3AF', background: '#fff' }}
            >
              <option value="">All time</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs font-semibold transition"
                style={{ color: '#2563EB' }}
              >
                <X size={11} />
                Clear filters
              </button>
            )}

            {/* Filter icon */}
            {!hasFilters && (
              <SlidersHorizontal size={14} style={{ color: '#D1D5DB' }} />
            )}
          </div>
        </div>

        {/* ── Summary bar ── */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Showing <span className="font-semibold" style={{ color: '#0F1117' }}>
                {filtered.length}
              </span> expense{filtered.length !== 1 ? 's' : ''}
              {filterLabel && <span> · {filterLabel}</span>}
            </p>
            <p className="font-mono text-sm font-semibold" style={{ color: '#0F1117' }}>
              {pkr(filterTotal)}
            </p>
          </div>
        )}

        {exportErr && (
          <p className="text-xs mb-3" style={{ color: '#E85D2F' }}>{exportErr}</p>
        )}

        {/* ── Table / states ── */}
        {isLoading || catLoading ? (
          <div className="card p-10 text-center text-sm animate-pulse" style={{ color: '#9CA3AF' }}>
            Loading expenses…
          </div>
        ) : expenses.length === 0 ? (
          /* Empty workspace */
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🪙</p>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0F1117' }}>
              No expenses yet
            </p>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              Add your first one using the button above.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          /* Filters returned nothing */
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-semibold mb-2" style={{ color: '#0F1117' }}>
              No expenses match your filters
            </p>
            <button onClick={clearFilters} className="text-xs font-semibold underline"
                    style={{ color: '#2563EB' }}>
              Clear filters
            </button>
          </div>
        ) : (
          /* Table */
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <th className="w-10 pl-4" />
                    <th className="py-3 pr-4 text-left">
                      <span className="section-label">Expense</span>
                    </th>
                    <th
                      className="py-3 pr-4 text-right cursor-pointer select-none"
                      onClick={() => toggleSort('amount')}
                    >
                      <span className="section-label inline-flex items-center gap-1 justify-end">
                        Amount
                        <SortIcon col="amount" activeCol={sortCol} dir={sortDir} />
                      </span>
                    </th>
                    <th
                      className="py-3 pr-4 text-right cursor-pointer select-none w-32"
                      onClick={() => toggleSort('date')}
                    >
                      <span className="section-label inline-flex items-center gap-1 justify-end">
                        Date
                        <SortIcon col="date" activeCol={sortCol} dir={sortDir} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(exp => (
                    <ExpRow key={exp.id} expense={exp} onDelete={removeExpense} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t"
                   style={{ borderColor: '#F3F4F6' }}>
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition
                               disabled:opacity-40"
                    style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#fff' }}
                  >
                    ‹ Prev
                  </button>
                  <span className="px-2 text-xs" style={{ color: '#6B7280' }}>
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition
                               disabled:opacity-40"
                    style={{ border: '1px solid #E5E7EB', color: '#374151', background: '#fff' }}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
