import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [workspaces,        setWorkspaces]        = useState([])
  const [activeWorkspace,   setActiveWorkspace]   = useState(null)
  const [membership,        setMembership]        = useState(null) // { role: 'owner'|'member' }
  const [loading,           setLoading]           = useState(true)

  const loadWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([])
      setActiveWorkspace(null)
      setMembership(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('workspace_members')
        .select('role, workspace_id, workspaces(id, name, created_by, created_at)')
        .eq('user_id', user.id)

      if (error) throw error

      const ws = data.map(m => ({ ...m.workspaces, role: m.role }))
      setWorkspaces(ws)

      // Restore previously selected workspace from localStorage, else use first
      const storedId = localStorage.getItem('kharcha_active_workspace')
      const found    = ws.find(w => w.id === storedId) || ws[0] || null
      setActiveWorkspace(found)

      if (found) {
        const myMembership = data.find(m => m.workspace_id === found.id)
        setMembership({ role: myMembership?.role })
      }
    } catch (err) {
      console.error('[WorkspaceContext] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadWorkspaces() }, [loadWorkspaces])

  const switchWorkspace = useCallback((workspaceId) => {
    const ws = workspaces.find(w => w.id === workspaceId)
    if (!ws) return
    setActiveWorkspace(ws)
    localStorage.setItem('kharcha_active_workspace', workspaceId)
    // Find membership for new workspace
    const myMembership = workspaces.find(w => w.id === workspaceId)
    setMembership({ role: myMembership?.role })
  }, [workspaces])

  const isOwner = membership?.role === 'owner'

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      membership,
      isOwner,
      loading,
      switchWorkspace,
      refreshWorkspaces: loadWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return ctx
}
