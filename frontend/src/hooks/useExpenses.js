/**
 * useExpenses.js
 * TanStack Query hook for expenses — supporting server-side filtering, sorting, pagination, and full CRUD.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, deleteExpense, updateExpense } from '../api'

export function useExpenses(workspaceId, filters = {}) {
  const queryClient = useQueryClient()
  const queryKey    = ['expenses', workspaceId, filters]
  const baseKey     = ['expenses', workspaceId]

  // ── Fetch ─────────────────────────────────────────────────
  const {
    data: responseData,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey,
    queryFn:   () => getExpenses(workspaceId, filters),
    enabled:   !!workspaceId,
    staleTime: 10_000, // 10 seconds cache validity for filters
  })

  const expenses = responseData?.data ?? []
  const totalCount = responseData?.count ?? 0
  const totalSum = responseData?.totalSum ?? 0

  // ── Add expense (optimistic) ──────────────────────────────
  const {
    mutate:    addExpense,
    isPending: isAdding,
    error:     addError,
    reset:     resetAddError,
  } = useMutation({
    mutationFn: (expense) => createExpense(workspaceId, expense),

    onMutate: async (newExpense) => {
      await queryClient.cancelQueries({ queryKey: baseKey })

      const snapshot = queryClient.getQueryData(queryKey)

      const optimisticItem = {
        id:           `optimistic-${Date.now()}`,
        workspace_id: workspaceId,
        created_by:   null,
        title:        newExpense.title,
        amount:       newExpense.amount,
        date:         newExpense.date,
        category_id:  newExpense.category_id,
        deleted_at:   null,
        created_at:   new Date().toISOString(),
        categories:   null,
        _optimistic:  true,
      }

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return { data: [optimisticItem], count: 1 }
        const oldData = old.data || old
        return old.data 
          ? { ...old, data: [optimisticItem, ...oldData], count: (old.count || 0) + 1 }
          : [optimisticItem, ...oldData]
      })

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey })
    },
  })

  // ── Edit expense (optimistic) ─────────────────────────────
  const {
    mutate:    editExpense,
    isPending: isEditing,
    error:     editError,
  } = useMutation({
    mutationFn: ({ id, updates }) => updateExpense(id, updates),

    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: baseKey })
      const snapshot = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        const oldData = old.data || old
        const updated = oldData.map(e => e.id === id ? { ...e, ...updates } : e)
        return old.data ? { ...old, data: updated } : updated
      })

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey })
    },
  })

  // ── Delete expense (optimistic) ───────────────────────────
  const { mutate: removeExpense } = useMutation({
    mutationFn: (id) => deleteExpense(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: baseKey })
      const snapshot = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old
        const oldData = old.data || old
        const filteredList = oldData.filter(e => e.id !== id)
        return old.data 
          ? { ...old, data: filteredList, count: Math.max(0, (old.count || 0) - 1) }
          : filteredList
      })

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: baseKey })
    },
  })

  return {
    expenses,
    totalCount,
    totalSum,
    isLoading,
    fetchError,
    addExpense,
    isAdding,
    addError,
    resetAddError,
    editExpense,
    isEditing,
    editError,
    removeExpense,
  }
}
