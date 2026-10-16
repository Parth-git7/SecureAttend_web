import { useCallback, useEffect, useRef, useState } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import ActiveSession from './ActiveSession'

const POLL_MS = 3000

export default function StudentDashboard() {
  const { user, logout } = useStudentAuth()
  const [session, setSession] = useState(undefined) // undefined=loading, null=none, obj=active
  const [error, setError] = useState('')
  const pollRef = useRef(null)

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance-sessions/active', {
        headers: { Authorization: `Bearer ${localStorage.getItem('sa_student_token')}` },
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { logout(); return }
        throw new Error(data.message || 'Failed to load session')
      }
      setSession(data.activeSession ?? null)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [logout])

  useEffect(() => {
    fetchSession()
    pollRef.current = setInterval(fetchSession, POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [fetchSession])

  const initial = user.name?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="s-wrap">
      <header className="s-header">
        <div className="s-header-info">
          <div className="s-avatar" aria-hidden="true">{initial}</div>
          <div className="s-header-text">
            <div className="s-header-name">{user.name}</div>
            <div className="s-header-email">{user.email}</div>
          </div>
        </div>
        <button id="logout-btn" className="s-logout-btn" onClick={logout}>
          Logout
        </button>
      </header>

      <main className="s-main">
        <p className="s-section-title">Attendance</p>

        {error ? (
          <div className="s-error-box" role="alert">{error}</div>
        ) : session === undefined ? (
          <div className="s-loading">
            <div className="s-spinner" />
            <span>Checking for active sessions…</span>
          </div>
        ) : session === null ? (
          <div className="s-no-session">
            <div className="s-no-session-icon" aria-hidden="true">📋</div>
            <h2 className="s-no-session-title">No Active Attendance</h2>
            <p>There is no attendance session available for your group right now. Check back soon.</p>
          </div>
        ) : (
          <ActiveSession session={session} onRefresh={fetchSession} />
        )}
      </main>
    </div>
  )
}
