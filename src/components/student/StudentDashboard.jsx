import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import ActiveSession from './ActiveSession'
import DinoGame from './DinoGame'
import { connectSocket } from '../../socket'
import { preloadLandmarker } from '../../liveness'

const POLL_MS = 10000

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning,'
  if (h < 17) return 'Good afternoon,'
  return 'Good evening,'
}

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

    socket.on('connect', () => {
      fetchSession()
    })

    socket.on('ready', fetchSession)
    socket.on('session:changed', fetchSession)

    socket.on('connect_error', (err) => {
      console.error('Student socket connection failed:', err.message)
    })

    // On mobile: wake up, reconnect, and refresh when returning to browser tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSession()
        if (!socket.connected) {
          socket.connect()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
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

  // loads mediapipe models
  useEffect(() => {
    preloadLandmarker()
  }, [])

  const initial = user?.name?.[0]?.toUpperCase() ?? '?'
  const rollNo = user?.rollNo || '—'
  const greeting = getGreeting()

  return (
    <div className="s-wrap">
      <main className="s-main">
        {/* Top greeting where navbar earlier was */}
        <div className="s-greeting">
          <h1 className="s-greeting-text">
            <span className="s-greeting-lead">{greeting}</span>{' '}
            <span className="s-greeting-name">{user?.name}</span>
          </h1>
        </div>

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
          <div className="s-no-session-wrap">
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

            <DinoGame />
          </div>
        ) : (
          <ActiveSession session={session} onRefresh={fetchSession} />
        )}
      </main>

      {/* Moved down bottom navbar */}
      <nav className="s-bottom-bar" aria-label="Student Navigation">
        <div className="s-bottom-bar-inner">
          <div className="s-bottom-bar-info">
            <div className="s-avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="s-bottom-bar-text">
              <div className="s-bottom-bar-name">{user?.name}</div>
              <div className="s-bottom-bar-roll">{rollNo}</div>
            </div>
          </div>

          <button
            id="logout-btn"
            className="s-logout-btn"
            type="button"
            onClick={logout}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              style={{ marginRight: 6 }}
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            Logout
          </button>
        </div>
      </nav>
    </div>
  )
}
