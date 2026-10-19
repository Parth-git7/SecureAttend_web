import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { useAuth } from '../../context/AuthContext'
import { getTeacherLocation } from '../../utils'
import AttendanceForm from './AttendanceForm'
import SessionPanel from './SessionPanel'
import Roster from './Roster'
import { connectSocket } from '../../socket'

const POLL_MS = 3000
const BASE = '/api/attendance-sessions'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const [message, setMessage] = useState(null)
  const [session, setSession] = useState(null)
  const [students, setStudents] = useState([])
  const [busy, setBusy] = useState(false)
  const sessionId = useRef(null)
  // const socket = connectSocket('sa_token')

  const show = useCallback((text, type = 'info') => setMessage(text ? { text, type } : null), [])

  const fail = useCallback(
    (err) => {
      if (err.status === 401) logout()
      else show(err.message, 'error')
    },
    [logout, show]
  )

  const loadRoster = useCallback(async () => {
    const id = sessionId.current
    if (!id) return null
    const data = await api(`${BASE}/${id}/roster`)
    if (sessionId.current !== id) return null
    setStudents(data.students)
    setSession((s) => (s && s.id === id ? { ...s, phase: data.session.phase, expiresAt: data.session.expiresAt } : s))
    return data.session
  }, [])

  const live = session && session.phase !== 'ENDED'

  useEffect(() => {
  if (!live || !session?.id) return

  const socket = connectSocket('sa_token')
  let fallback

  const sync = async () => {
    try {
      const s = await loadRoster()

      if (s && new Date(s.expiresAt) <= new Date()) {
        clearInterval(fallback)
        socket.disconnect()
      }
    } catch (err) {
      fail(err)
    }
  }

  socket.on('connect', () => {
    socket.emit('watch', session.id, (success) => {
      if (success) {
        sync()
      } else {
        console.error('Socket could not watch this attendance session.')
      }
    })
  })

  socket.on('roster:changed', sync)

  socket.on('connect_error', (err) => {
    console.error('Socket connection failed:', err.message)
  })

  fallback = setInterval(sync, 30000)

  return () => {
    clearInterval(fallback)
    socket.disconnect()
  }
}, [live, session?.id, loadRoster, fail])

  async function handleStart(groupId, subjectId) {
    setBusy(true)
    try {
      show('Getting your location…')
      const teacherLocation = await getTeacherLocation()
      show('Creating attendance session…')
      const data = await api(BASE, { method: 'POST', body: { groupId, subjectId, teacherLocation } })
      sessionId.current = data.session._id
      setStudents([])
      setSession({ ...data.session, id: data.session._id })
      show('Session created. Students can now join the lobby.', 'success')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function phaseAction(path, text, type) {
    setBusy(true)
    try {
      const data = await api(`${BASE}/${session.id}/${path}`, { method: 'POST' })
      setSession((s) => ({ ...s, ...data.session, id: s.id }))
      show(text, type)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleEnd() {
    setBusy(true)
    try {
      await api(`${BASE}/${session.id}/end`, { method: 'PATCH' })
      setSession((s) => ({ ...s, phase: 'ENDED' }))
      await loadRoster()
      show('Attendance session ended and records finalised.', 'success')
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  async function handleMark(studentId, status) {
    try {
      await api(`${BASE}/${session.id}/students/${studentId}/attendance`, { method: 'PATCH', body: { status } })
      await loadRoster()
    } catch (err) {
      fail(err)
    }
  }

  async function handleExport() {
    try {
      const res = await fetch(`${BASE}/${session.id}/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('sa_token')}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        const err = new Error(d.message || 'Export failed')
        err.status = res.status
        throw err
      }
      const name = /filename="(.+?)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'attendance.xlsx'
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      fail(err)
    }
  }

  return (
    <>
      <header className="top">
        <div>
          <h1>SecureAttend Teacher Dashboard</h1>
          <p>
            Logged in as: {user.name} ({user.email}) - {user.role}
          </p>
        </div>
        <button className="btn secondary logout" onClick={logout}>
          Logout
        </button>
      </header>

      {message && <div className={`msg ${message.type}`}>{message.text}</div>}

      <AttendanceForm busy={busy || !!live} onStart={handleStart} onMessage={show} onError={fail} />

      {session && (
        <>
          <SessionPanel
            session={session}
            busy={busy}
            onStartAttendance={() =>
              phaseAction('start-attendance', 'Attendance is now open. Students can submit their code.', 'success')
            }
            onStopAttendance={() => phaseAction('stop-attendance', 'Attendance is now closed.', 'info')}
            onEnd={handleEnd}
          />
          <Roster students={students} phase={session.phase} onMark={handleMark} onExport={handleExport} />
        </>
      )}
    </>
  )
}
