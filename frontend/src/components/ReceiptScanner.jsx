/**
 * ReceiptScanner.jsx
 * Camera / file-upload button that calls POST /api/scan-receipt
 * and returns the extracted data to the parent via onScan().
 */

import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { scanReceipt } from '../api'
import { supabase } from '../lib/supabase'

/**
 * @param {{ workspaceId: string, categories: string[], onScan: (data) => void, onError: (msg) => void }} props
 */
export default function ReceiptScanner({ workspaceId, categories = [], onScan, onError }) {
  const inputRef         = useRef()
  const [scanning, setScanning] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so same file can be re-scanned
    e.target.value = ''

    setScanning(true)
    try {
      let receiptUrl = null
      const shouldSave = localStorage.getItem('kharcha_save_receipts') === 'true'

      if (shouldSave && workspaceId) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${workspaceId}/${Date.now()}.${fileExt}`
        const { data, error } = await supabase.storage.from('receipts').upload(fileName, file)
        
        if (error) {
          console.warn('[ReceiptScanner] Storage upload failed:', error.message)
        } else {
          const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName)
          receiptUrl = publicUrl
        }
      }

      const dataUri = await fileToDataUri(file)
      const result  = await scanReceipt(dataUri, categories)
      onScan({ ...result, receipt_url: receiptUrl })
    } catch (err) {
      onError(err.message || 'Scan failed. Please fill in manually.')
    } finally {
      setScanning(false)
    }
  }

  return (
    <>
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
        title="Scan receipt"
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
    </>
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
