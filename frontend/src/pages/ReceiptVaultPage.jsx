/**
 * ReceiptVaultPage.jsx
 * Gallery view showing stored receipts linked to expenses.
 * Includes privacy opt-in setting (default OFF).
 */

import { useState, useEffect, useMemo } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { getCategories, deleteExpense } from '../api'
import { supabase } from '../lib/supabase'
import { categoryIcon } from '../components/CategoryIcon'
import { 
  Search, X, SlidersHorizontal, Eye, Trash2, Calendar, Loader2, Image as ImageIcon, ShieldAlert 
} from 'lucide-react'

const pkr = (n) => `Rs ${Number(n).toLocaleString('en-PK')}`

export default function ReceiptVaultPage() {
  const { activeWorkspace } = useWorkspace()
  const [expenses, setExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // Settings toggle
  const [saveReceipts, setSaveReceipts] = useState(
    localStorage.getItem('kharcha_save_receipts') === 'true'
  )

  // Filters state
  const [searchQuery, setSearchQuery] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [selectedExpense, setSelectedExpense] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]))
  }, [categories])

  const fetchVaultData = async () => {
    if (!activeWorkspace?.id) return
    setLoading(true)
    setError(null)
    try {
      // 1. Fetch categories
      const catRes = await getCategories(activeWorkspace.id)
      setCategories(catRes.data || [])

      // 2. Fetch expenses with receipts safely (no implicit joins)
      const { data: rawExpenses, error: expError } = await supabase
        .from('expenses')
        .select('*')
        .eq('workspace_id', activeWorkspace.id)
        .is('deleted_at', null)
        .not('receipt_url', 'is', null)
        .order('date', { ascending: false })

      if (expError) throw expError
      setExpenses(rawExpenses || [])
    } catch (err) {
      console.error('[ReceiptVaultPage] Fetch error:', err)
      setError('Failed to load receipts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVaultData()
  }, [activeWorkspace?.id])

  const handleToggleSave = (e) => {
    const val = e.target.checked
    localStorage.setItem('kharcha_save_receipts', String(val))
    setSaveReceipts(val)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this expense and its linked receipt image?')) return
    setDeletingId(id)
    try {
      await deleteExpense(id)
      setSelectedExpense(null)
      await fetchVaultData()
    } catch (err) {
      alert(err.message || 'Failed to delete expense.')
    } finally {
      setDeletingId(null)
    }
  }

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const cat = categoryMap.get(e.category_id) || {}
      const matchesSearch = e.title?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCat = !catFilter || e.category_id === catFilter
      return matchesSearch && matchesCat
    })
  }, [expenses, searchQuery, catFilter, categoryMap])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F8FC' }}>
        <div className="animate-pulse text-sm flex items-center gap-2" style={{ color: '#9CA3AF' }}>
          <Loader2 size={16} className="animate-spin" />
          Loading receipt vault…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: '#F7F8FC' }}>
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-lg font-bold leading-tight" style={{ color: '#0F1117' }}>
              Receipt Vault
            </h1>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Access and search all uploaded receipt images linked to your expenses.
            </p>
          </div>

          {/* Privacy opt-in toggle settings card */}
          <div className="card px-4 py-3 flex items-center gap-4 bg-white border border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="saveReceiptsToggle"
                checked={saveReceipts}
                onChange={handleToggleSave}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="saveReceiptsToggle" className="text-xs font-bold text-gray-800 cursor-pointer select-none">
                Save my receipt images
              </label>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-gray-100 text-gray-400">
              Default: OFF
            </span>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center justify-between text-sm gap-3 bg-red-50 border-red-200 text-red-700 animate-entry">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Informative prompt when storage toggle is OFF */}
        {!saveReceipts && (
          <div className="mb-6 rounded-xl border p-4 flex gap-3 text-xs bg-yellow-50 border-yellow-200 text-yellow-800 animate-entry">
            <ShieldAlert size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900 leading-tight">Image Persistence Disabled</p>
              <p className="mt-0.5 text-yellow-700">
                Receipt storage is currently turned off. Receipt scans will run OCR and extract details, but their images will not be persisted. Check the box above to save scanned receipts to your Vault.
              </p>
            </div>
          </div>
        )}

        {/* Search & Filter */}
        {expenses.length > 0 && (
          <div className="card p-4 mb-6 bg-white flex flex-col sm:flex-row gap-3 items-center">
            <div className="relative flex-1 w-full">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search receipts by vendor…"
                className="w-full rounded-lg border pl-8 pr-8 py-1.5 text-sm outline-none transition focus:border-accent"
                style={{ borderColor: '#E5E7EB', color: '#0F1117' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="rounded-lg border px-2.5 py-1.5 text-sm cursor-pointer w-full sm:w-auto"
              style={{ borderColor: '#E5E7EB', color: catFilter ? '#0F1117' : '#9CA3AF', background: '#fff' }}
            >
              <option value="">All categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Gallery Grid */}
        {expenses.length === 0 ? (
          <div className="card p-16 text-center bg-white">
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <ImageIcon size={22} className="text-slate-300" />
            </div>
            <h2 className="text-sm font-semibold" style={{ color: '#0F1117' }}>No receipts saved yet</h2>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Ensure "Save my receipt images" is enabled, then scan a receipt in Dashboard or Expenses.
            </p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="card p-12 text-center bg-white">
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-xs font-semibold" style={{ color: '#0F1117' }}>No receipts match filters</p>
            <button onClick={() => { setSearchQuery(''); setCatFilter('') }} className="text-xs font-semibold underline mt-2" style={{ color: '#2563EB' }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filteredExpenses.map(exp => {
              const cat = categoryMap.get(exp.category_id) || {}
              const color = cat.color || '#6B7280'

              return (
                <button
                  key={exp.id}
                  onClick={() => setSelectedExpense(exp)}
                  className="card group overflow-hidden bg-white text-left transition hover:shadow-md animate-entry border hover:border-blue-200"
                  style={{ borderColor: '#E5E7EB' }}
                >
                  {/* Aspect-ratio Container for Thumbnail */}
                  <div className="aspect-[3/4] bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    <img
                      src={exp.receipt_url}
                      alt={exp.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-[#0F1117]/0 group-hover:bg-[#0F1117]/20 flex items-center justify-center transition duration-200">
                      <Eye size={20} className="text-white opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 transition duration-200" />
                    </div>
                  </div>

                  {/* Thumbnail Info Footer */}
                  <div className="p-3">
                    <h3 className="text-xs font-bold text-gray-800 truncate leading-tight">{exp.title}</h3>
                    <div className="flex items-center justify-between mt-2.5 gap-2">
                      <span className="text-[10px]" style={{ color: '#6B7280' }}>{exp.date}</span>
                      <span className="font-mono text-[11px] font-bold text-gray-900" style={{ color: '#E85D2F' }}>
                        {pkr(exp.amount)}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

      </div>

      {/* Side-by-Side Detail Preview Modal */}
      {selectedExpense && (
        <div 
          className="fixed inset-0 z-50 bg-[#0F1117]/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedExpense(null)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-2xl border"
            style={{ borderColor: '#E5E7EB', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Left Column: Image Viewer */}
            <div className="md:w-1/2 h-[45vh] md:h-auto bg-slate-50 border-r relative flex items-center justify-center p-4">
              <img
                src={selectedExpense.receipt_url}
                alt={selectedExpense.title}
                className="max-w-full max-h-[60vh] object-contain shadow-sm rounded-lg"
              />
            </div>

            {/* Right Column: Expense Details */}
            <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between overflow-y-auto">
              <div>
                <div className="flex items-center justify-between pb-4 border-b">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Expense Details</span>
                  <button 
                    onClick={() => setSelectedExpense(null)}
                    className="p-1 rounded hover:bg-gray-100 text-gray-400"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="mt-6 flex flex-col gap-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 leading-tight">{selectedExpense.title}</h2>
                    <p className="font-mono text-2xl font-black mt-2" style={{ color: '#E85D2F' }}>
                      {pkr(selectedExpense.amount)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Category</span>
                      <div className="flex items-center gap-2 mt-1.5">
                        {(() => {
                          const cat = categoryMap.get(selectedExpense.category_id) || {}
                          const color = cat.color || '#6B7280'
                          return (
                            <>
                              <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: color + '15' }}>
                                {categoryIcon(cat.icon, color, 11)}
                              </div>
                              <span className="text-xs font-semibold text-gray-700">{cat.name || 'Other'}</span>
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100/50">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Log Date</span>
                      <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-gray-700">
                        <Calendar size={13} className="text-gray-400" />
                        <span>{selectedExpense.date}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 border-t pt-4 flex items-center justify-between">
                <button
                  onClick={() => handleDelete(selectedExpense.id)}
                  disabled={deletingId === selectedExpense.id}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-100 disabled:opacity-50"
                >
                  {deletingId === selectedExpense.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Delete Expense
                </button>
                <button
                  onClick={() => setSelectedExpense(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 transition-colors text-xs font-bold text-gray-700 rounded-xl"
                >
                  Close Preview
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
