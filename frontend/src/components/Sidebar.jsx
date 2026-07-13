/**
 * Sidebar.jsx
 * Left navigation sidebar with all app modules.
 * Collapses to icon-only on mobile via a hamburger toggle.
 */

import { useState } from 'react'
import {
  LayoutDashboard, Receipt, PiggyBank, Users, Sparkles,
  BarChart3, Download, Settings, LogOut, Menu, X,
  Bell, BookOpen, RefreshCw, Image as ImageIcon,
} from 'lucide-react'
import KharchaLogo from './KharchaLogo'

const NAV_ITEMS = [
  { id: 'dashboard',  label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'expenses',   label: 'Expenses',        icon: Receipt         },
  { id: 'budgets',    label: 'Budgets',         icon: PiggyBank       },
  { id: 'recurring',  label: 'Recurring',       icon: RefreshCw       },
  { id: 'vault',      label: 'Receipt Vault',   icon: ImageIcon       },
  { id: 'insights',   label: 'Smart Insights',  icon: Sparkles        },
  { id: 'analytics',  label: 'Analytics',       icon: BarChart3       },
  { id: 'split',      label: 'Split & Group',   icon: Users           },
  { id: 'export',     label: 'Export',          icon: Download        },
  { id: 'alerts',     label: 'Alert History',   icon: Bell            },
  { id: 'guide',      label: 'Guide',           icon: BookOpen        },
]

export default function Sidebar({
  activeModule,
  onNavigate,
  workspaceName,
  onSignOut,
  collapsed,
  setCollapsed,
  unreadNotifCount,
  onToggleNotif,
}) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const NavItem = ({ item }) => {
    const Icon    = item.icon
    const active  = activeModule === item.id
    const soon    = ['split', 'analytics', 'guide'].includes(item.id)

    return (
      <button
        onClick={() => { onNavigate(item.id); setMobileOpen(false) }}
        disabled={soon}
        title={collapsed ? item.label : undefined}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                   font-medium transition-all group disabled:cursor-not-allowed"
        style={{
          background: active ? '#EFF6FF' : 'transparent',
          color:      active ? '#2563EB' : soon ? '#D1D5DB' : '#374151',
        }}
        onMouseEnter={e => { if (!active && !soon) e.currentTarget.style.background = '#F9FAFB' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <Icon
          size={18}
          strokeWidth={active ? 2.5 : 2}
          style={{ color: active ? '#2563EB' : soon ? '#D1D5DB' : '#6B7280', flexShrink: 0 }}
        />
        {!collapsed && (
          <span className="truncate flex-1 text-left">{item.label}</span>
        )}
        {!collapsed && soon && (
          <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold"
                style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
            Soon
          </span>
        )}
        {!collapsed && active && (
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: '#2563EB' }} />
        )}
      </button>
    )
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo + collapse toggle */}
      <div className="flex items-center justify-between px-3 py-4 mb-2">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <KharchaLogo size={28} color="#2563EB" />
            <div>
              <p className="text-sm font-bold leading-tight" style={{ color: '#0F1117' }}>
                Kharcha
              </p>
              {workspaceName && (
                <p className="text-xs truncate max-w-[110px]" style={{ color: '#6B7280' }}>
                  {workspaceName}
                </p>
              )}
            </div>
          </div>
        )}
        {collapsed && <KharchaLogo size={26} color="#2563EB" />}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center
                     transition hover:bg-gray-100"
          style={{ color: '#9CA3AF' }}
        >
          {collapsed ? <Menu size={15} /> : <X size={15} />}
        </button>
      </div>

      {/* Section label */}
      {!collapsed && (
        <p className="section-label px-4 mb-2">Navigation</p>
      )}

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2 overflow-y-auto">
        {NAV_ITEMS.map(item => <NavItem key={item.id} item={item} />)}
      </nav>

      {/* Bottom: settings + sign out */}
      <div className="px-2 pb-4 pt-2 border-t" style={{ borderColor: '#F3F4F6' }}>
        <button
          onClick={onToggleNotif}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                     font-medium transition relative"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Bell size={17} strokeWidth={2} style={{ flexShrink: 0, color: '#9CA3AF' }} />
          {unreadNotifCount > 0 && (
            <span 
              className="absolute rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center"
              style={{
                top: collapsed ? '4px' : '8px',
                left: collapsed ? '24px' : '20px',
                minWidth: '12px',
                height: '12px',
                padding: '0 2px',
              }}
            >
              {unreadNotifCount}
            </span>
          )}
          {!collapsed && <span>Notifications</span>}
        </button>

        <button
          onClick={() => { onNavigate('settings'); setMobileOpen(false) }}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                     font-medium transition"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <Settings size={17} strokeWidth={2} style={{ flexShrink: 0, color: '#9CA3AF' }} />
          {!collapsed && <span>Settings</span>}
        </button>

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm
                     font-medium transition"
          style={{ color: '#6B7280' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <LogOut size={17} strokeWidth={2} style={{ flexShrink: 0, color: '#F87171' }} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden w-9 h-9 rounded-xl
                   flex items-center justify-center shadow-card"
        style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}
        onClick={() => setMobileOpen(v => !v)}
      >
        {mobileOpen ? <X size={16} /> : <Menu size={16} />}
      </button>

      {/* Mobile bell button */}
      <button
        className="fixed top-4 right-4 z-50 md:hidden w-9 h-9 rounded-xl
                   flex items-center justify-center shadow-card relative"
        style={{ background: '#fff', border: '1px solid #E5E7EB', color: '#374151' }}
        onClick={onToggleNotif}
      >
        <Bell size={16} />
        {unreadNotifCount > 0 && (
          <span 
            className="absolute rounded-full bg-red-500 text-[8px] font-bold text-white flex items-center justify-center"
            style={{
              top: '-2px',
              right: '-2px',
              minWidth: '14px',
              height: '14px',
              padding: '0 2.5px',
            }}
          >
            {unreadNotifCount}
          </span>
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.3)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div
        className="fixed top-0 left-0 h-full z-40 md:hidden w-64 shadow-modal"
        style={{
          background:  '#FFFFFF',
          transform:   mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition:  'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div
        className="hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0
                   border-r overflow-hidden transition-all duration-200"
        style={{
          width:       collapsed ? '64px' : '220px',
          background:  '#FFFFFF',
          borderColor: '#F3F4F6',
        }}
      >
        {sidebarContent}
      </div>
    </>
  )
}
