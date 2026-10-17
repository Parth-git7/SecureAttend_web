import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ActiveSession from './ActiveSession'
import { connectSocket } from '../../socket'

const POLL_MS = 30000

export default function StudentDashboard() {
const { user, logout } = useAuth()

const [session, setSession] = useState(undefined)
const [error, setError] = useState('')
const pollRef = useRef(null)

const fetchSession = useCallback(async () => {
try {
const res = await fetch('/api/attendance-sessions/active', {
headers: {
Authorization: `Bearer ${localStorage.getItem('sa_token')}`,
},
})


  const data = await res.json()

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      logout()
      return
    }

    throw new Error(data.message || 'Failed to load session')
  }

  setSession(data.activeSession ?? null)
  setError('')
} catch (err) {
  setError(err.message)
}


}, [logout])

// Connect the student to real-time session updates.
useEffect(() => {
const socket = connectSocket('sa_token')

socket.on('ready', fetchSession)
socket.on('session:changed', fetchSession)

socket.on('connect_error', (err) => {
  console.error('Student socket connection failed:', err.message)
})

return () => {
  socket.disconnect()
}


}, [fetchSession])

// Fetch initially and periodically as a fallback.
useEffect(() => {
fetchSession()


pollRef.current = setInterval(fetchSession, POLL_MS)

return () => {
  if (pollRef.current) {
    clearInterval(pollRef.current)
  }
}


}, [fetchSession])

const initial = user.name?.[0]?.toUpperCase() ?? '?'

return ( <div className="s-wrap"> <header className="s-header"> <div className="s-header-info"> <div className="s-avatar" aria-hidden="true">
{initial} </div>


      <div className="s-header-text">
        <div className="s-header-name">{user.name}</div>
        <div className="s-header-email">{user.email}</div>
      </div>
    </div>

    <button
      id="logout-btn"
      className="s-logout-btn"
      onClick={logout}
    >
      Logout
    </button>
  </header>

  <main className="s-main">
    <p className="s-section-title">Attendance</p>

    {error ? (
      <div className="s-error-box" role="alert">
        {error}
      </div>
    ) : session === undefined ? (
      <div className="s-loading">
        <div className="s-spinner" />
        <span>Checking for active sessions…</span>
      </div>
    ) : session === null ? (
      <div className="s-no-session">
        <div className="s-no-session-icon" aria-hidden="true">
          📋
        </div>

        <h2 className="s-no-session-title">
          No Active Attendance
        </h2>

        <p>
          There is no attendance session available for your group right
          now. Check back soon.
        </p>
      </div>
    ) : (
      <ActiveSession session={session} onRefresh={fetchSession} />
    )}
  </main>
</div>


)
}
