"use client"

import { useCallback, useEffect, useState } from "react"

import { ApiError, api, type Query } from "./api"
import type { Page } from "./types"

export type Resource<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "error"; data: null; error: ApiError }
  | { status: "ready"; data: T; error: null }

function toApiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError(0, "NETWORK_ERROR", "Le service est injoignable.")
}

type Settled<T> =
  | { key: string; ok: true; data: T }
  | { key: string; ok: false; error: ApiError }

/**
 * Lecture d'une ressource ; `reload` la relit après une action. L'état
 * « chargement » se déduit : aucune réponse n'est encore arrivée pour la clé
 * courante (chemin, paramètres, version).
 */
export function useResource<T>(path: string, query?: Query) {
  const [version, setVersion] = useState(0)
  const key = `${path}?${JSON.stringify(query ?? {})}#${version}`
  const [settled, setSettled] = useState<Settled<T> | null>(null)

  useEffect(() => {
    let active = true
    api<T>(path, { query })
      .then((data) => {
        if (active) setSettled({ key, ok: true, data })
      })
      .catch((error: unknown) => {
        if (active) setSettled({ key, ok: false, error: toApiError(error) })
      })
    return () => {
      active = false
    }
    // `key` résume `path`, `query` et la version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setVersion((value) => value + 1), [])
  const state: Resource<T> =
    settled === null || settled.key !== key
      ? { status: "loading", data: null, error: null }
      : settled.ok
        ? { status: "ready", data: settled.data, error: null }
        : { status: "error", data: null, error: settled.error }
  return { ...state, reload }
}

interface ListState<T> {
  key: string
  items: T[]
  nextCursor: string | null
  error: ApiError | null
}

/**
 * Liste paginée par curseur : la première page se recharge quand les filtres
 * changent ; « Charger plus » ajoute la suivante.
 */
export function usePagedList<T>(path: string, query: Query) {
  const [version, setVersion] = useState(0)
  const key = `${path}?${JSON.stringify(query)}#${version}`
  const [list, setList] = useState<ListState<T> | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let active = true
    api<Page<T>>(path, { query })
      .then((page) => {
        if (active) {
          setList({
            key,
            items: page.items,
            nextCursor: page.nextCursor,
            error: null,
          })
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setList({
            key,
            items: [],
            nextCursor: null,
            error: toApiError(caught),
          })
        }
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = list?.key === key ? list : null
  const status: "loading" | "ready" | "error" = !current
    ? "loading"
    : current.error && current.items.length === 0
      ? "error"
      : "ready"

  const loadMore = useCallback(async () => {
    if (!current?.nextCursor) return
    setLoadingMore(true)
    try {
      const page = await api<Page<T>>(path, {
        query: { ...query, cursor: current.nextCursor },
      })
      setList((previous) =>
        previous && previous.key === key
          ? {
              key,
              items: [...previous.items, ...page.items],
              nextCursor: page.nextCursor,
              error: null,
            }
          : previous,
      )
    } catch (caught) {
      setList((previous) =>
        previous && previous.key === key
          ? { ...previous, error: toApiError(caught) }
          : previous,
      )
    } finally {
      setLoadingMore(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, current?.nextCursor])

  const reload = useCallback(() => setVersion((value) => value + 1), [])

  return {
    items: current?.items ?? [],
    nextCursor: current?.nextCursor ?? null,
    status,
    error: current?.error ?? null,
    loadingMore,
    loadMore,
    reload,
  }
}

/** Mutation avec état d'envoi et erreur lisible. */
export function useMutation() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<ApiError | null>(null)

  const run = useCallback(
    async <T>(
      path: string,
      body: unknown,
      method = "POST",
    ): Promise<{ ok: true; data: T } | { ok: false }> => {
      setPending(true)
      setError(null)
      try {
        return { ok: true, data: await api<T>(path, { method, body }) }
      } catch (caught) {
        setError(toApiError(caught))
        return { ok: false }
      } finally {
        setPending(false)
      }
    },
    [],
  )

  return { pending, error, run }
}
