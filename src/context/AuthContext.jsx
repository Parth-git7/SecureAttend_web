import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('sa_teacher_user') || 'null')
  )

  async function loginWithGoogle(credential) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json()

    if (!res.ok) throw new Error(data.message || 'Authentication failed')
    if (data.user.role !== 'TEACHER') {
      throw new Error('Access denied. Teacher privileges required.')
    }

    localStorage.setItem('sa_teacher_token', data.token)
    localStorage.setItem('sa_teacher_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('sa_teacher_token')
    localStorage.removeItem('sa_teacher_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}