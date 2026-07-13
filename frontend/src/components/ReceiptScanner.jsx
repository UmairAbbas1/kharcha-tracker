/**
 * ReceiptScanner.jsx
 * Camera / file-upload button that calls POST /api/scan-receipt.
 *
 * Receipt vault storage:
 *   - Always attempts to save the receipt image to Supabase Storage
 *     (bucket: 'receipts') when workspaceId is provided.
 *   - If the bucket doesn't exist or upload fails, scanning still works
 *     — receipt_url is just null.
 *   - No localStorage flag needed — saving is the default behavior.
 */

import { useRef, useState } from 'react'
import { Camera, Loader2, HardDrive } from 'lucide-react'
import { scanReceipt } from '../api'
import { supabase }    from '../lib/supabase'

export default function ReceiptScanner({ workspaceId, categories = [], onScan, onError }) {
  const inputRef          = useRef()
  const [scanning, setScanning]   = useState(false)
  const [saved,    setSaved]      = useState(null)   // null | 'ok' | 'fail'

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanning(true)
    setSaved(null)

    try {
      // ── Step 1: Upload to Supabase Storage vault ──────────
      let receiptUrl = null
      if (workspaceId) {
        try {
          const ext      = file.name.split('.').pop() || 'jpg'
          const path     = `${workspaceId}/${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('receipts')
            .upload(path, file, { upsert: false })

          if (uploadErr) {
            console.warn('[ReceiptScanner] vault upload failed:', uploadErr.message)
            setSaved('fail')
          } else {
            const { data: urlData } = supabase.storage
              .from('receipts')
              .getPublicUrl(path)
            receiptUrl = urlData?.publicUrl || null
            setSaved('ok')
          }
        } catch (storageErr) {
          console.warn('[ReceiptScanner] storage error:', storageErr.message)
          setSaved('fail')
        }
      }

      // ── Step 2: OCR the image ─────────────────────────────
      const dataUri = await fileToDataUri(file)
      const result  = await scanReceipt(dataUri, categories)
      onScan({ ...result, receipt_url: receiptUrl })
    } catch (err) {
      onError(err.message || 'Scan failed. Please fill in manually.')
    } finally {
      setScanning(false)
      // Clear vault indicator after 3 s
      setTimeout(() => setSaved(null), 3000)
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        title="Scan receipt — image saved to your vault"
        className="flex items-center gap-1.5 rounded-2xl border border-blue-100
                   bg-white/60 px-3 py-2 text-xs font-bold text-royal
                   hover:bg-blue-50 transition active:scale-95 disabled:opacity-50"
      >
        {scanning
          ? <Loader2 size={13} className="animate-spin" />
          : <Camera  size={13} />
        }
        {scanning ? 'Scanning…' : 'Scan Receipt'}
      </button>

      {/* Vault indicator */}
      {saved === 'ok' && (
        <span className="flex items-center gap-1 text-xs" style={{ color: '#22C55E' }}>
          <HardDrive size={10} />
          Saved to vault
        </span>
      )}
      {saved === 'fail' && (
        <span className="text-xs" style={{ color: '#9CA3AF' }}>
          Vault unavailable
        </span>
      )}
    </div>
  )
}

function fileToDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}
