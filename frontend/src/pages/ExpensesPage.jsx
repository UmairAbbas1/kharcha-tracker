/**
 * ExpensesPage.jsx — Full expense management module.
 *
 * Scope:
 *   - Server-side Search (title, 150ms debounce)
 *   - Server-side Category filter + Month filter (combinable)
 *   - Server-side Sort by date or amount (toggle asc/desc)
 *   - Server-side Pagination (25 per page)
 *   - Add Expense panel (collapsible, reuses AddForm)
 *   - Inline edit (click a row, fields become editable, save/cancel)
 *   - Delete with confirmation dialog
 *
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, X, ChevronUp, ChevronDown, Plus, Download,
  Trash2, Loader2, SlidersHorizontal, Edit, Check
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
  if (!dateStr) return ''
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

// ── Expense row (handles edit mode rendering) ─────────────────────────
function ExpRow({
  expense,
  categoriesList,
  onDelete,
  editingId,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  editTitle,
  setEditTitle,
  editAmount,
  setEditAmount,
  editCategory,
  setEditCategory,
  editDate,
  setEditDate,
}) {
  const isEditing = editingId === expense.id
  const cat = expense.categories || {}
  const color = cat.color || '#94a3b8'

  if (isEditing) {
    return (
      <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
        {/* Editing Icon Slot */}
        <td className="py-2 pl-4 pr-2 w-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 dark:bg-blue-950/20">
            <Edit size={14} className="text-blue-500" />
          </div>
        </td>
        
        {/* Title & Category Input */}
        <td className="py-2 pr-4">
          <div className="flex flex-col gap-1.5 max-w-xs">
            <input
              type="text"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              className="w-full text-xs font-semibold rounded border px-2 py-1 focus:ring-1 focus:ring-blue-500 bg-white text-gray-800"
              placeholder="Expense title"
            />
            <select
              value={editCategory || ''}
              onChange={e => setEditCategory(e.target.value)}
              className="text-[11px] rounded border px-1.5 py-0.5 cursor-pointer bg-white text-gray-800"
            >
              <option value="">No Category</option>
              {categoriesList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </td>

        {/* Amount Input */}
        <td className="py-2 pr-4 text-right">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase">Amount (Rs)</span>
            <input
              type="number"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
              className="w-24 text-right text-xs font-mono font-semibold rounded border px-2 py-1 bg-white text-gray-800"
            />
          </div>
        </td>

        {/* Date Input & Actions */}
        <td className="py-2 pr-4 w-32 text-right">
          <div className="flex flex-col items-end gap-1.5">
            <input
              type="date"
              value={editDate}
              onChange={e => setEditDate(e.target.value)}
              className="text-xs rounded border px-2 py-0.5 bg-white text-gray-800"
            />
            <div className="flex items-center gap-1.5 mt-1">
              <button
                onClick={() => onSaveEdit(expense.id)}
                className="px-2 py-1 rounded bg-blue-500 text-white text-[10px] font-bold flex items-center gap-0.5 hover:bg-blue-600 transition"
              >
                <Check size={10} /> Save
              </button>
              <button
                onClick={onCancelEdit}
                className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center gap-0.5 hover:bg-gray-200 transition border"
              >
                <X size={10} /> Cancel
              </button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  // Static view row
  return (
    <tr
      className="expense-row group border-b hover:bg-gray-50/40 dark:hover:bg-gray-900/10"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <td className="py-3 pl-4 pr-2 w-10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: color + '18' }}
        >
          {categoryIcon(cat.icon, color, 14)}
        </div>
      </td>

      <td className="py-3 pr-4">
        <p className="text-sm font-semibold truncate max-w-[220px]" style={{ color: 'var(--color-ink)' }}>
          {expense.title}
        </p>
        <p className="text-xs mt-0.5 flex items-center gap-1.5">
          <span style={{ color }}>{cat.name || 'Other'}</span>
          <span style={{ color: 'var(--color-slate)' }}>·</span>
          <span style={{ color: 'var(--color-slate)' }}>{dateLabel(expense.date)}</span>
        </p>
      </td>

      <td className="py-3 pr-4 text-right">
        <span className="font-mono text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          {pkr(expense.amount)}
        </span>
      </td>

      <td className="py-3 pr-4 w-32 text-right">
        <div className="flex items-center justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStartEdit(expense)}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
            title="Edit expense"
            disabled={editingId !== null}
            style={{ opacity: editingId !== null ? 0.3 : 1 }}
          >
            <Edit size={13} className="text-blue-500" />
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete "${expense.title}"?`)) {
                onDelete(expense.id)
              }
            }}
            className="del-btn w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            title="Delete expense"
            disabled={editingId !== null}
            style={{ opacity: editingId !== null ? 0.3 : 1 }}
          >
            <Trash2 size={13} color="#f87171" />
          </button>
        </div>
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

  // ── Filter / sort / pagination state ──────────────────────
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

  // Inline edit state variables
  const [editingId, setEditingId] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDate, setEditDate] = useState('')

  const [categories,  setCategories]  = useState([])
  const [catLoading,  setCatLoading]  = useState(true)

  // Construct query filters for server-side fetch
  const filters = useMemo(() => {
    const f = {
      workspace_id: activeWorkspace?.id,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      sort_by: sortCol,
      sort_dir: sortDir,
    }
    if (search) f.search = search
    if (catFilter) f.category_id = catFilter
    if (monthFilter) {
      f.start_date = `${monthFilter}-01`
      const [year, month] = monthFilter.split('-')
      const lastDay = new Date(Number(year), Number(month), 0).getDate()
      f.end_date = `${monthFilter}-${String(lastDay).padStart(2, '0')}`
    }
    return f
  }, [activeWorkspace?.id, page, sortCol, sortDir, search, catFilter, monthFilter])

  // Get data via hook using remote queries
  const {
    expenses, totalCount, totalSum, isLoading,
    addExpense, isAdding, addError, resetAddError,
    editExpense, removeExpense,
  } = useExpenses(activeWorkspace?.id, filters)

  // Handle initial search query from Command Palette
  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== '') {
      setRawSearch(initialSearchQuery)
      setSearch(initialSearchQuery)
      onClearSearchQuery?.()
    }
  }, [initialSearchQuery])

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

  const totalPages   = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage     = Math.min(page, totalPages)
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
        onSuccess: (res) => { setShowAdd(false); setPrefill(null); resolve(res) },
        onError:   (err) => reject(err),
      })
    }), [addExpense])

  // ── Inline Edit Handlers ──────────────────────────────────
  const handleStartEdit = (exp) => {
    setEditingId(exp.id)
    setEditTitle(exp.title || '')
    setEditAmount(exp.amount || '')
    setEditCategory(exp.category_id || '')
    setEditDate(exp.date || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

  const handleSaveEdit = (id) => {
    if (!editTitle.trim()) {
      alert('Title is required')
      return
    }
    const amt = Number(editAmount)
    if (isNaN(amt) || amt <= 0) {
      alert('Amount must be a positive number')
      return
    }
    if (!editDate) {
      alert('Date is required')
      return
    }

    editExpense({
      id,
      updates: {
        title: editTitle.trim(),
        amount: amt,
        category_id: editCategory || null,
        date: editDate,
      }
    }, {
      onSuccess: () => setEditingId(null),
      onError: (err) => alert(err.message || 'Failed to save changes')
    })
  }

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
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-5xl mx-auto">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: 'var(--color-ink)' }}>Expenses</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-slate)' }}>
              {activeWorkspace.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {workspaces.length > 1 && (
              <select
                value={activeWorkspace.id}
                onChange={e => switchWorkspace(e.target.value)}
                className="text-xs rounded-lg border px-2.5 py-1.5 cursor-pointer"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-slate)', background: 'var(--color-card)' }}
              >
                {workspaces.map(ws => (
                  <option key={ws.id} value={ws.id}>{ws.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={handleExport}
              disabled={exporting || totalCount === 0}
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5
                         text-xs font-semibold transition disabled:opacity-40"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-slate)', background: 'var(--color-card)' }}
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
              workspaceId={activeWorkspace?.id}
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
                className="w-full rounded-lg border pl-8 pr-8 py-1.5 text-sm transition focus:ring-1 focus:ring-blue-500"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-ink)', background: 'var(--color-card)' }}
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
              style={{ borderColor: 'var(--color-border)', color: catFilter ? 'var(--color-ink)' : 'var(--color-slate)', background: 'var(--color-card)' }}
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
              style={{ borderColor: 'var(--color-border)', color: monthFilter ? 'var(--color-ink)' : 'var(--color-slate)', background: 'var(--color-card)' }}
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
        {totalCount > 0 && (
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              Showing <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                {expenses.length}
              </span> of <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                {totalCount}
              </span> expense{totalCount !== 1 ? 's' : ''}
              {filterLabel && <span> · {filterLabel}</span>}
            </p>
            <p className="font-mono text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              {pkr(totalSum)}
            </p>
          </div>
        )}

        {exportErr && (
          <p className="text-xs mb-3" style={{ color: '#E85D2F' }}>{exportErr}</p>
        )}

        {/* ── Table / states ── */}
        {isLoading || catLoading ? (
          <div className="card p-10 text-center text-sm animate-pulse" style={{ color: 'var(--color-slate)' }}>
            Loading expenses…
          </div>
        ) : totalCount === 0 && !hasFilters ? (
          /* Empty workspace */
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🪙</p>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
              No expenses yet
            </p>
            <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
              Add your first one using the button above.
            </p>
          </div>
        ) : totalCount === 0 && hasFilters ? (
          /* Filters returned nothing */
          <div className="card p-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>
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
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
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
                  {expenses.map(exp => (
                    <ExpRow
                      key={exp.id}
                      expense={exp}
                      categoriesList={categories}
                      onDelete={removeExpense}
                      editingId={editingId}
                      onStartEdit={handleStartEdit}
                      onCancelEdit={handleCancelEdit}
                      onSaveEdit={handleSaveEdit}
                      editTitle={editTitle}
                      setEditTitle={setEditTitle}
                      editAmount={editAmount}
                      setEditAmount={setEditAmount}
                      editCategory={editCategory}
                      setEditCategory={setEditCategory}
                      editDate={editDate}
                      setEditDate={setEditDate}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t"
                   style={{ borderColor: 'var(--color-border)' }}>
                <p className="text-xs" style={{ color: 'var(--color-slate)' }}>
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–
                  {Math.min(safePage * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition disabled:opacity-40"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-slate)', background: 'var(--color-card)' }}
                  >
                    ‹ Prev
                  </button>
                  <span className="px-2 text-xs" style={{ color: 'var(--color-slate)' }}>
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="px-2.5 py-1 rounded-md text-xs font-semibold transition disabled:opacity-40"
                    style={{ border: '1px solid var(--color-border)', color: 'var(--color-slate)', background: 'var(--color-card)' }}
                  >
                    Next ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-8 text-xs" style={{ color: 'var(--color-slate)' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
