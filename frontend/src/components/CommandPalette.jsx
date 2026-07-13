/**
 * CommandPalette.jsx
 * Global keyboard-accessible overlay for navigation, quick actions, and expense search.
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  LayoutDashboard, Receipt, PiggyBank, Sparkles, BarChart3,
  Users, Download, Bell, BookOpen, Settings, Command,
  Plus, Eye, Sparkle, Loader2, ArrowRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { scanReceipt } from '../api'

const MODULE_ICONS = {
  dashboard: LayoutDashboard,
  expenses: Receipt,
  budgets: PiggyBank,
  insights: Sparkles,
  analytics: BarChart3,
  split: Users,
  export: Download,
  alerts: Bell,
  guide: BookOpen,
  settings: Settings,
}

export default function CommandPalette({
  isOpen,
  onClose,
  workspaceId,
  activeModule,
  onNavigate,
  onTriggerAddExpense,
  onTriggerAskAi,
  onSelectRecentExpense,
}) {
  const [search, setSearch] = useState('')
  const [recentExpenses, setRecentExpenses] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const listRef = useRef(null)

  // Fetch recent expenses and categories safely when palette opens
  useEffect(() => {
    if (!isOpen || !workspaceId) return

    setSearch('')
    setActiveIndex(0)
    setScanError('')
    setScanning(false)

    async function fetchData() {
      setLoadingExpenses(true)
      try {
        // Fetch categories first to avoid silent joins
        const { data: rawCategories, error: catError } = await supabase
          .from('categories')
          .select('*')
          .eq('workspace_id', workspaceId)

        if (catError) throw catError
        setCategories(rawCategories || [])

        // Fetch recent 20 expenses to search across
        const { data: rawExpenses, error: expError } = await supabase
          .from('expenses')
          .select('*')
          .eq('workspace_id', workspaceId)
          .is('deleted_at', null)
          .order('date', { ascending: false })
          .order('id', { ascending: false })
          .limit(20)

        if (expError) throw expError

        const categoryMap = new Map((rawCategories || []).map(c => [c.id, c]))
        const processed = (rawExpenses || []).map(e => ({
          ...e,
          categories: categoryMap.get(e.category_id) || null
        }))

        setRecentExpenses(processed)
      } catch (err) {
        console.error('[CommandPalette] failed to load data:', err)
      } finally {
        setLoadingExpenses(false)
      }
    }

    fetchData()
  }, [isOpen, workspaceId])

  // Automatically focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Lock background body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Define static modules to search
  const modules = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard', type: 'module', icon: MODULE_ICONS.dashboard },
    { id: 'expenses', label: 'Expenses', type: 'module', icon: MODULE_ICONS.expenses },
    { id: 'budgets', label: 'Budgets', type: 'module', icon: MODULE_ICONS.budgets },
    { id: 'insights', label: 'Smart Insights', type: 'module', icon: MODULE_ICONS.insights },
    { id: 'analytics', label: 'Analytics', type: 'module', icon: MODULE_ICONS.analytics },
    { id: 'split', label: 'Split & Group', type: 'module', icon: MODULE_ICONS.split },
    { id: 'export', label: 'Export Data', type: 'module', icon: MODULE_ICONS.export },
    { id: 'alerts', label: 'Alert History', type: 'module', icon: MODULE_ICONS.alerts },
    { id: 'guide', label: 'User Guide', type: 'module', icon: MODULE_ICONS.guide },
    { id: 'settings', label: 'Settings', type: 'module', icon: MODULE_ICONS.settings },
  ], [])

  // Define quick actions
  const quickActions = useMemo(() => [
    { id: 'add-expense', label: 'Add Expense', type: 'action', icon: Plus, action: 'add' },
    { id: 'scan-receipt', label: 'Scan Receipt (OCR)', type: 'action', icon: Eye, action: 'scan' },
    { id: 'ask-ai', label: 'Ask AI Assistant', type: 'action', icon: Sparkle, action: 'ai' },
  ], [])

  // Filter items based on fuzzy search matches
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    
    // Modules match
    const matchedModules = modules.filter(m => 
      m.label.toLowerCase().includes(query)
    )

    // Actions match
    const matchedActions = quickActions.filter(a => 
      a.label.toLowerCase().includes(query)
    )

    // Recent Expenses match (only top 5 showing in list)
    const matchedExpenses = recentExpenses
      .filter(e => 
        e.title.toLowerCase().includes(query) ||
        (e.categories?.name || 'Other').toLowerCase().includes(query) ||
        String(e.amount).includes(query)
      )
      .slice(0, 5)
      .map(e => ({
        id: `exp-${e.id}`,
        expenseId: e.id,
        label: e.title,
        amount: e.amount,
        categoryName: e.categories?.name || 'Other',
        color: e.categories?.color || '#6B7280',
        type: 'expense',
        icon: Receipt,
        raw: e,
      }))

    // Combined list with section boundaries
    const list = []
    
    if (matchedModules.length > 0) {
      list.push(...matchedModules.map(m => ({ ...m, section: 'Navigation' })))
    }
    if (matchedActions.length > 0) {
      list.push(...matchedActions.map(a => ({ ...a, section: 'Quick Actions' })))
    }
    if (matchedExpenses.length > 0) {
      list.push(...matchedExpenses.map(e => ({ ...e, section: 'Recent Expenses' })))
    }

    return list
  }, [search, modules, quickActions, recentExpenses])

  // Reset active index when search changes
  useEffect(() => {
    setActiveIndex(0)
  }, [search])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]')
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [activeIndex])

  // Handle Receipt Upload/OCR scan
  const handleScanFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = '' // Clear input
    setScanning(true)
    setScanError('')

    try {
      const dataUri = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Failed to read image file'))
        reader.readAsDataURL(file)
      })

      const categoryNames = categories.map(c => c.name)
      const result = await scanReceipt(dataUri, categoryNames)

      onClose()
      onTriggerAddExpense(result) // Pass OCR result to form prefill
    } catch (err) {
      console.error('[CommandPalette Scan] Failed:', err)
      setScanError(err.message || 'Scan failed. Please add manually.')
    } finally {
      setScanning(false)
    }
  }

  // Handle item activation
  const handleItemSelect = (item) => {
    if (item.type === 'module') {
      onNavigate(item.id)
      onClose()
    } else if (item.type === 'action') {
      if (item.action === 'add') {
        onTriggerAddExpense(null)
        onClose()
      } else if (item.action === 'scan') {
        fileInputRef.current?.click()
      } else if (item.action === 'ai') {
        onTriggerAskAi()
        onClose()
      }
    } else if (item.type === 'expense') {
      onSelectRecentExpense(item.raw)
      onClose()
    }
  }

  // Handle keyboard events
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (filteredItems.length === 0 ? 0 : (prev + 1) % filteredItems.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (filteredItems.length === 0 ? 0 : (prev - 1 + filteredItems.length) % filteredItems.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[activeIndex]) {
        handleItemSelect(filteredItems[activeIndex])
      }
    }
  }

  if (!isOpen) return null

  // Group items by section to render dividers and headers
  const renderListItems = () => {
    if (filteredItems.length === 0) {
      return (
        <div className="py-12 text-center text-sm" style={{ color: '#6B7280' }}>
          No results found for <span className="font-semibold text-gray-700">"{search}"</span>
        </div>
      )
    }

    let currentSection = null
    let globalIndex = 0

    return (
      <div ref={listRef} className="max-h-[350px] overflow-y-auto">
        {filteredItems.map((item, idx) => {
          const showHeader = item.section !== currentSection
          if (showHeader) {
            currentSection = item.section
          }

          const isActive = idx === activeIndex
          const Icon = item.icon

          return (
            <div key={item.id || idx}>
              {showHeader && (
                <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                  {item.section}
                </div>
              )}
              <button
                data-active={isActive}
                onClick={() => handleItemSelect(item)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-all text-left"
                style={{
                  background: isActive ? '#F7F8FC' : 'transparent',
                  color: isActive ? '#2563EB' : '#0F1117',
                }}
              >
                <div className="flex items-center gap-3 truncate min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isActive ? '#EFF6FF' : '#F3F4F6',
                    }}
                  >
                    <Icon
                      size={14}
                      style={{
                        color: isActive ? '#2563EB' : '#6B7280',
                      }}
                    />
                  </div>
                  <div className="truncate min-w-0">
                    <span className="truncate block">{item.label}</span>
                    {item.type === 'expense' && (
                      <span className="text-[11px] font-normal block" style={{ color: '#6B7280' }}>
                        {item.categoryName} · {item.raw.date}
                      </span>
                    )}
                  </div>
                </div>

                {item.type === 'expense' && (
                  <span className="font-mono text-xs font-semibold flex-shrink-0 ml-2" style={{ color: '#E85D2F' }}>
                    Rs {Number(item.amount).toLocaleString('en-PK')}
                  </span>
                )}

                {isActive && (
                  <span className="text-xs font-normal opacity-60 flex items-center gap-1">
                    Select <ArrowRight size={12} />
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-[#0F1117]/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4"
      onClick={onClose}
    >
      {/* Hidden file input for OCR scanning */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleScanFile}
      />

      <div
        className="bg-white rounded-2xl shadow-2xl border w-full max-w-lg overflow-hidden animate-entry flex flex-col"
        style={{
          borderColor: '#E5E7EB',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header Search Input */}
        <div className="flex items-center gap-3 px-4 border-b" style={{ borderColor: '#F3F4F6' }}>
          <Command size={18} className="text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={scanning}
            placeholder={scanning ? 'Analyzing receipt image...' : 'Search modules, recent expenses, or quick actions...'}
            className="w-full py-4 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs px-1.5 py-0.5 rounded hover:bg-gray-100"
              style={{ color: '#9CA3AF' }}
            >
              Clear
            </button>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-50 text-gray-400 border rounded" style={{ borderColor: '#E5E7EB' }}>
              ESC
            </kbd>
          </div>
        </div>

        {/* Scan / Loading Overlays */}
        {scanning && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-accent" style={{ color: '#2563EB' }} />
            <p className="text-sm font-semibold" style={{ color: '#0F1117' }}>Processing receipt image...</p>
            <p className="text-xs" style={{ color: '#6B7280' }}>Calling Groq OCR to extract expense details...</p>
          </div>
        )}

        {scanError && !scanning && (
          <div className="px-4 py-3 bg-red-50 border-b text-xs flex items-center justify-between" style={{ borderColor: '#FEE2E2', color: '#EF4444' }}>
            <span>{scanError}</span>
            <button onClick={() => setScanError('')} className="font-semibold underline">Dismiss</button>
          </div>
        )}

        {/* Main List */}
        {!scanning && (
          <>
            {loadingExpenses && filteredItems.length === 0 ? (
              <div className="py-12 flex items-center justify-center gap-2 text-sm" style={{ color: '#9CA3AF' }}>
                <Loader2 size={14} className="animate-spin" />
                Loading search results…
              </div>
            ) : (
              renderListItems()
            )}

            {/* Shortcut Legend Footer */}
            <div className="px-4 py-2.5 border-t bg-gray-50/50 flex items-center justify-between text-[11px]" style={{ borderColor: '#F3F4F6', color: '#9CA3AF' }}>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-white px-1 border rounded">↑↓</kbd> to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="font-mono bg-white px-1 border rounded">Enter</kbd> to select
                </span>
              </div>
              <div>
                Press <kbd className="font-mono bg-white px-1 border rounded">ESC</kbd> to close
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
