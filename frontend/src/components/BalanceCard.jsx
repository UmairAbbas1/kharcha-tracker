import { Wallet, Receipt } from 'lucide-react'
import { pkr } from '../constants'

export default function BalanceCard({ total, count, loading }) {
  return (
    <div className="glass-hero rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
      {/* decorative circles */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1 opacity-75">
          <Wallet size={15} color="#F7A8C4" />
          <span className="text-xs font-semibold tracking-widest uppercase">
            Total Kharcha
          </span>
        </div>

        <div className="text-4xl md:text-5xl font-extrabold tracking-tight mt-2 transition-all">
          {loading ? (
            <span className="opacity-40 animate-pulse">Rs …</span>
          ) : (
            pkr(total)
          )}
        </div>

        <div className="mt-4 inline-flex items-center gap-1.5 bg-white/10 rounded-full px-3 py-1 text-xs font-semibold">
          <Receipt size={12} />
          {count} transaction{count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}
