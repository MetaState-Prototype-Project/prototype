'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { getToken, setToken as persistToken, clearToken } from '@/lib/calendar-api'

type AuthContextType = {
  token: string | null
  isReady: boolean
  login: (token: string) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    setTokenState(getToken())
    setIsReady(true)
  }, [])

  const login = useCallback((t: string) => {
    persistToken(t)
    setTokenState(t)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        token,
        isReady,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
