/**
 * useExpenses.js
 * TanStack Query hook for expenses — useQuery fetch + optimistic mutations.
 *
 * Scope: expenses list only (categories, budgets, alert logs stay on
 * existing useState/useEffect fetching for this phase).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, deleteExpense } from '../api'

export function useExpenses(workspaceId) {
  const queryClient = useQueryClient()
  const queryKey    = ['expenses', workspaceId]

  // ── Fetch ─────────────────────────────────────────────────
  const {
    data,
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey,
    queryFn:   () => getExpenses(workspaceId).then(r => r.data),
    enabled:   !!workspaceId,
    staleTime: 30_000,   // 30 s — no refetch on every re-render
  })

  const expenses = data ?? []

  // ── Add expense (optimistic) ──────────────────────────────
  const {
    mutate:    addExpense,
    isPending: isAdding,
    error:     addError,
    reset:     resetAddError,
  } = useMutation({
    mutationFn: (expense) => createExpense(workspaceId, expense),

    onMutate: async (newExpense) => {
      // Cancel any in-flight fetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey })

      // Snapshot current list for rollback
      const snapshot = queryClient.getQueryData(queryKey)

      // Inject optimistic item at the top of the list
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
        categories:   null,   // will be replaced after invalidation
        _optimistic:  true,
      }

      queryClient.setQueryData(queryKey, (old) => [optimisticItem, ...(old ?? [])])

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      // Roll back to the snapshot
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
    },

    onSettled: () => {
      // Always refetch after mutation — replaces optimistic item with real data
      queryClient.invalidateQueries({ queryKey })
    },
  })

  // ── Delete expense (optimistic) ───────────────────────────
  const { mutate: removeExpense } = useMutation({
    mutationFn: (id) => deleteExpense(id),

    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey })
      const snapshot = queryClient.getQueryData(queryKey)

      // Remove item immediately from cache
      queryClient.setQueryData(queryKey, (old) =>
        (old ?? []).filter(e => e.id !== id)
      )

      return { snapshot }
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKey, context.snapshot)
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })

  return {
    expenses,
    isLoading,
    fetchError,
    addExpense,
    isAdding,
    addError,
    resetAddError,
    removeExpense,
  }
}
