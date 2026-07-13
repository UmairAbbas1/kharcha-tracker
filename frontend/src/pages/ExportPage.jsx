/**
 * ExportPage.jsx — Export expenses as styled Excel.
 * Scope: useAuth ✓  useWorkspace ✓  exportCsv ✓  Download/Loader2 ✓
 * No Supabase queries — delegates entirely to existing exportCsv().
 */
import { useState, useMemo } from 'react'
import { Download, Loader2, FileSpreadsheet } from 'lucide-react'
import { useAuth }      from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { exportCsv }    from '../api'

function getLast12Months() {
  const list = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setDate(1); d.setMonth(d.getMonth() - i)
    list.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleString('en-PK', { month: 'long', year: 'numeric' }),
    })
  }
  return list
}

export default function ExportPage() {
  const { user }            = useAuth()
  const { activeWorkspace } = useWorkspace()
  const [month,      setMonth]      = useState('')
  const [exporting,  setExporting]  = useState(false)
  const [exportErr,  setExportErr]  = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const months = useMemo(getLast12Months, [])

  const handleExport = async () => {
    if (!activeWorkspace) return
    setExporting(true); setExportErr(null)
    try {
      await exportCsv(activeWorkspace.id, month || undefined)
      setLastExport(new Date().toLocaleString('en-PK'))
    } catch (err) {
      setExportErr(err.message)
    } finally {
      setExporting(false)
    }
  }

  if (!activeWorkspace) return null

  return (
    <div className="min-h-screen px-4 py-8 md:px-8" style={{ background: '#F7F8FC' }}>
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <FileSpreadsheet size={18} color="#2563EB" />
          <h1 className="text-lg font-bold" style={{ color: '#0F1117' }}>Export</h1>
        </div>

        <div className="card p-6 space-y-5">
          <div>
            <p className="section-label mb-2">Workspace</p>
            <p className="text-sm font-semibold" style={{ color: '#0F1117' }}>
              {activeWorkspace.name}
            </p>
          </div>

          <div>
            <p className="section-label mb-2">Month</p>
            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: '#E5E7EB', color: '#0F1117', background: '#fff' }}
            >
              <option value="">All time</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl p-4" style={{ background: '#EFF6FF' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#2563EB' }}>
              What's included
            </p>
            <ul className="text-xs space-y-0.5" style={{ color: '#6B7280' }}>
              <li>· Date, title, category, amount (PKR)</li>
              <li>· Styled Excel file — colored headers, alternating rows</li>
              <li>· Proper date format (no ######)</li>
              <li>· Total row at the bottom</li>
            </ul>
          </div>

          {exportErr && (
            <p className="text-xs rounded-lg px-3 py-2"
               style={{ background: '#FFF7ED', color: '#C2410C' }}>
              {exportErr}
            </p>
          )}

          {lastExport && !exportErr && (
            <p className="text-xs" style={{ color: '#22C55E' }}>
              ✓ Last exported at {lastExport}
            </p>
          )}

          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 rounded-xl
                       py-2.5 text-sm font-bold text-white transition active:scale-95
                       disabled:opacity-60"
            style={{ background: '#2563EB' }}
          >
            {exporting
              ? <><Loader2 size={14} className="animate-spin" /> Exporting…</>
              : <><Download size={14} /> Download Excel</>
            }
          </button>
        </div>

        <footer className="text-center mt-8 text-xs" style={{ color: '#9CA3AF' }}>
          Signed in as {user?.email}
        </footer>
      </div>
    </div>
  )
}
