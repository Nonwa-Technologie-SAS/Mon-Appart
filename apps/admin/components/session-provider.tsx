"use client"

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  ApiError,
  api,
  login as apiLogin,
  logout as apiLogout,
  onSessionExpired,
  refreshSession,
} from "@/lib/api"
import type { AdminMe } from "@/lib/types"

export type SessionStatus =
  | "loading"
  | "anonymous"
  | "authenticated"
  /** Compte connecté mais sans `admin:access`. */
  | "forbidden"
  | "unavailable"

interface SessionContextValue {
  state: { status: SessionStatus; me: AdminMe | null }
  actions: {
    signIn: (identifier: string, password: string) => Promise<void>
    signOut: () => Promise<void>
  }
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function useSession(): SessionContextValue {
  const value = use(SessionContext)
  if (!value) throw new Error("useSession hors de SessionProvider")
  return value
}

type Loaded = { status: SessionStatus; me: AdminMe | null }

async function loadMe(): Promise<Loaded> {
  try {
    return { status: "authenticated", me: await api<AdminMe>("/admin/me") }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { status: "forbidden", me: null }
    }
    if (error instanceof ApiError && error.status === 401) {
      return { status: "anonymous", me: null }
    }
    return { status: "unavailable", me: null }
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Loaded>({ status: "loading", me: null })

  useEffect(() => {
    let active = true
    onSessionExpired(() => {
      if (active) setState({ status: "anonymous", me: null })
    })
    void (async () => {
      let restored = false
      try {
        restored = await refreshSession()
      } catch {
        if (active) setState({ status: "unavailable", me: null })
        return
      }
      const next: Loaded = restored
        ? await loadMe()
        : { status: "anonymous", me: null }
      if (active) setState(next)
    })()
    return () => {
      active = false
      onSessionExpired(null)
    }
  }, [])

  const signIn = useCallback(async (identifier: string, password: string) => {
    await apiLogin(identifier, password)
    setState(await loadMe())
  }, [])

  const signOut = useCallback(async () => {
    await apiLogout()
    setState({ status: "anonymous", me: null })
  }, [])

  const value = useMemo(
    () => ({ state, actions: { signIn, signOut } }),
    [state, signIn, signOut],
  )

  return <SessionContext value={value}>{children}</SessionContext>
}
