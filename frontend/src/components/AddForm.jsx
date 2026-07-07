import { useState } from 'react'
import { PlusCircle } from 'lucide-react'

export default function AddForm({ categories = [], onAdd, loading }) {
  const [title,    setTitle]    = useState('')
  const [amount,   setAmount]   = useState('')
  const [catId,    setCatId]    = useState('')
  const [date,     setDate]     = useState(new Date().toISOString().split('T')[0])
  const [error,    setError]    = useState('')

  // Default to first category once categories load
  const activeCatId = catId || categories[0]?.id || ''

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!title.trim())                            return setError('Please enter a title.')
    if (!amount || isNaN(amount) || Number(amount) <= 0)
                                                  return setError('Enter a valid amount.')
    if (!activeCatId)                             return setError('No category available.')

    try {
      await onAdd({
        title:       title.trim(),
        amount:      Number(amount),
        category_id: activeCatId,
        date,
      })
      setTitle('')
      setAmount('')
      // keep date + category for quick repeat entries
    } catch (err) {
      setError(err.message || 'Failed to add expense.')
    }
  }

  return (
    <div className="glass rounded-3xl p-6 shadow-lg">
      <h2 className="text-sm font-bold text-gray-600 mb-4 flex items-center gap-2 uppercase tracking-wider">
        <PlusCircle size={15} color="#4169E1" />
        Add Expense
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Title */}
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Biryani, Careem, Utility Bill…"
          className="w-full rounded-2xl border border-blue-100 bg-white/60 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition"
          required
        />

        {/* Amount + Category */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">
              Rs
            </span>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              type="number"
              min="1"
              step="1"
              placeholder="0"
              className="w-full rounded-2xl border border-blue-100 bg-white/60 pl-9 pr-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 transition"
              required
            />
          </div>

          <select
            value={activeCatId}
            onChange={e => setCatId(e.target.value)}
            className="rounded-2xl border border-blue-100 bg-white/60 px-3 py-2.5 text-sm text-gray-700 cursor-pointer transition"
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full rounded-2xl border border-blue-100 bg-white/60 px-4 py-2.5 text-sm text-gray-700 transition"
          required
        />

        {/* Error */}
        {error && (
          <p className="text-xs text-red-500 -mt-1 pl-1">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || categories.length === 0}
          className="w-full rounded-2xl py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-60"
          style={{ background: '#4169E1' }}
        >
          <PlusCircle size={15} />
          {loading ? 'Adding…' : 'Add Kharcha'}
        </button>
      </form>
    </div>
  )
}
