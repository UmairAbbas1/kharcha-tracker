/**
 * SettingsPage.jsx
 * Premium Settings Panel to manage theme settings, receipt vault configuration, and profile information.
 */

import { useState, useEffect } from 'react'
import { useWorkspace } from '../context/WorkspaceContext'
import { 
  Sun, Moon, Laptop, ShieldAlert, FolderKey, Loader2, Sparkles, Check
} from 'lucide-react'

export default function SettingsPage({ darkMode, onToggleDarkMode }) {
  const { activeWorkspace } = useWorkspace()
  
  // Stored preferences state
  const [saveReceipts, setSaveReceipts] = useState(
    localStorage.getItem('kharcha_save_receipts') === 'true'
  )
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleToggleSaveReceipts = (val) => {
    localStorage.setItem('kharcha_save_receipts', String(val))
    setSaveReceipts(val)
    triggerSuccessBanner()
  }

  const triggerSuccessBanner = () => {
    setSuccess(true)
    const t = setTimeout(() => setSuccess(false), 2000)
    return () => clearTimeout(t)
  }

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-10">
        
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-lg font-bold leading-tight" style={{ color: 'var(--color-ink)' }}>
            Settings
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-slate)' }}>
            Manage preferences, data sync, and interface styles.
          </p>
        </header>

        {success && (
          <div className="mb-6 rounded-xl border px-4 py-3 flex items-center gap-2 text-sm bg-emerald-50 border-emerald-200 text-emerald-700 animate-entry">
            <Check size={14} strokeWidth={2.5} />
            <span>Settings saved successfully.</span>
          </div>
        )}

        <div className="flex flex-col gap-6">

          {/* Section 1: Appearance */}
          <section className="card p-6 bg-white flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Sun size={15} className="text-blue-500" />
                Appearance
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Customize how Kharcha Tracker looks on your device.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <button
                onClick={() => darkMode && onToggleDarkMode()}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition duration-200 ${
                  !darkMode ? 'border-blue-500 bg-blue-50/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Sun size={18} className={!darkMode ? 'text-blue-600' : 'text-gray-400'} />
                <div>
                  <span className="text-xs font-bold block text-gray-800 dark:text-gray-100">Light Mode</span>
                  <span className="text-[10px] text-gray-400">Clean and bright view</span>
                </div>
              </button>

              <button
                onClick={() => !darkMode && onToggleDarkMode()}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between h-24 transition duration-200 ${
                  darkMode ? 'border-blue-500 bg-blue-950/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Moon size={18} className={darkMode ? 'text-blue-400' : 'text-gray-400'} />
                <div>
                  <span className="text-xs font-bold block text-gray-800 dark:text-gray-100">Dark Mode</span>
                  <span className="text-[10px] text-gray-400">Easy on the eyes</span>
                </div>
              </button>
            </div>
          </section>

          {/* Section 2: Privacy & Receipt Storage */}
          <section className="card p-6 bg-white flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FolderKey size={15} className="text-orange-500" />
                Receipt Storage Vault
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Manage cloud persistence for scanned expense slips.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 mt-2 border-t pt-4 border-gray-100">
              <div className="max-w-md">
                <span className="text-xs font-bold text-gray-800 dark:text-gray-100">Save my receipt images</span>
                <span className="text-[11px] text-gray-400 block mt-1 leading-relaxed">
                  When enabled, any document scanned using OCR scanner will be stored in your secure Supabase Storage bucket and linked to the expense. When disabled, images are processed locally and never stored.
                </span>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <input
                  type="checkbox"
                  id="saveReceiptSettings"
                  checked={saveReceipts}
                  onChange={(e) => handleToggleSaveReceipts(e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-[9px] font-bold text-gray-400 mt-1 uppercase">
                  {saveReceipts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </section>

          {/* Section 3: Workspace Info */}
          <section className="card p-6 bg-white flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FolderKey size={15} className="text-purple-500" />
                Workspace Metadata
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Current active workspace details.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Workspace Name</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100 block mt-1">{activeWorkspace?.name || 'Workspace'}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] text-gray-400 uppercase font-bold block">Sync Status</span>
                <span className="text-emerald-500 font-bold block mt-1 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                  Live Connected
                </span>
              </div>
            </div>
          </section>

        </div>

      </div>
    </div>
  )
}
