import { createContext, useContext, useState } from 'react'

const StudentAuthContext = createContext(null)

export function StudentAuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    JSON.parse(localStorage.getItem('sa_student_user') || 'null')
  )

  async function loginWithGoogle(credential) {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Authentication failed')
    if (data.user.role !== 'STUDENT') {
      throw new Error('Access denied. Student privileges required.')
    }
    localStorage.setItem('sa_student_token', data.token)
    localStorage.setItem('sa_student_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  function logout() {
    localStorage.removeItem('sa_student_token')
    localStorage.removeItem('sa_student_user')
    setUser(null)
  }

  return (
    <StudentAuthContext.Provider value={{ user, loginWithGoogle, logout }}>
      {children}
    </StudentAuthContext.Provider>
  )
}

export function useStudentAuth() {
  return useContext(StudentAuthContext)
}
