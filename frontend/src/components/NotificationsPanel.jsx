/**
 * NotificationsPanel.jsx
 * Floating dropdown menu for in-app notifications.
 */

import { Bell, Check, CheckSquare, Sparkles, PiggyBank, Users, Loader2, X } from 'lucide-react'

const NOTIF_ICONS = {
  budget_threshold: PiggyBank,
  monthly_summary: Sparkles,
  split_settled: Users,
  member_joined: Users,
}

const NOTIF_COLORS = {
  budget_threshold: '#E85D2F', // Rupee orange
  monthly_summary: '#2563EB',  // Accent blue
  split_settled: '#10B981',    // Emerald green
  member_joined: '#8B5CF6',    // Violet
}

function timeAgo(dateStr) {
  try {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return 'Yesterday'
    return d.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' })
  } catch (err) {
    return ''
  }
}

export default function NotificationsPanel({
  notifications = [],
  onClose,
  onMarkRead,
  onMarkAllRead,
  isLoading,
  positionLeft = '230px',
}) {
  const unreadCount = notifications.filter(n => !n.read_at).length

  return (
    <>
      {/* Backdrop for click-away */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />

      <div
        className="fixed top-16 z-50 w-[320px] max-h-[420px] bg-white rounded-2xl shadow-2xl border flex flex-col animate-entry"
        style={{
          left: positionLeft,
          borderColor: '#E5E7EB',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F3F4F6' }}>
          <div className="flex items-center gap-2">
            <Bell size={15} style={{ color: '#2563EB' }} />
            <span className="text-sm font-bold text-gray-800">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-blue-50 text-accent" style={{ color: '#2563EB', background: '#EFF6FF' }}>
                {unreadCount} new
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                title="Mark all as read"
                className="text-xs font-semibold hover:underline"
                style={{ color: '#2563EB' }}
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100"
              style={{ color: '#9CA3AF' }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {isLoading ? (
            <div className="py-12 flex items-center justify-center gap-2 text-xs" style={{ color: '#9CA3AF' }}>
              <Loader2 size={13} className="animate-spin text-accent" style={{ color: '#2563EB' }} />
              Loading notifications…
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-2.5">
                <Bell size={18} className="text-slate-300" />
              </div>
              <p className="text-xs font-semibold text-gray-500">No notifications yet</p>
              <p className="text-[11px] text-gray-400 mt-0.5">We'll alert you when events occur.</p>
            </div>
          ) : (
            notifications.map(notif => {
              const Icon = NOTIF_ICONS[notif.type] || Bell
              const color = NOTIF_COLORS[notif.type] || '#6B7280'
              const isUnread = !notif.read_at

              return (
                <button
                  key={notif.id}
                  onClick={() => {
                    if (isUnread) onMarkRead(notif.id)
                  }}
                  disabled={!isUnread}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b last:border-0 hover:bg-gray-50 disabled:cursor-default"
                  style={{
                    borderColor: '#F9FAFB',
                    background: isUnread ? '#EFF6FF20' : 'transparent',
                  }}
                >
                  {/* Indicator Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{
                      background: color + '15',
                    }}
                  >
                    <Icon size={13} style={{ color }} />
                  </div>

                  {/* Message body */}
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-xs leading-normal"
                      style={{
                        color: isUnread ? '#0F1117' : '#6B7280',
                        fontWeight: isUnread ? '600' : '400',
                      }}
                    >
                      {notif.message}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: '#9CA3AF' }}>
                      {timeAgo(notif.created_at)}
                    </p>
                  </div>

                  {/* Unread blue dot */}
                  {isUnread && (
                    <span 
                      className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"
                      style={{ background: '#2563EB' }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
