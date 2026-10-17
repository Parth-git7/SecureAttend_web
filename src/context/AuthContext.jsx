// src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('sa_user') || 'null'))

  const loginWithGoogle = useCallback(async (credential) => {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Authentication failed')
    localStorage.setItem('sa_token', data.token)
    localStorage.setItem('sa_user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  // Email + password login — used by Admin (and any non-Google role)
  const login = useCallback(async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Authentication failed')
    localStorage.setItem('sa_token', data.token)
    localStorage.setItem('sa_user', JSON.stringify(data.user))
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('sa_token')
    localStorage.removeItem('sa_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)