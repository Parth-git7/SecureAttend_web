import { useEffect, useState } from 'react'

const CIRC = 125.66
const PHASE_LABEL = {
  LOBBY: 'Lobby',
  ATTENDANCE_OPEN: 'Attendance open',
  ATTENDANCE_CLOSED: 'Attendance closed',
  ENDED: 'Ended',
}
const HINT = {
  LOBBY: 'Students can join the lobby but cannot submit the code until you start attendance.',
  ATTENDANCE_OPEN: 'Attendance is open. Students can submit the room code and face scan.',
  ATTENDANCE_CLOSED: 'Collection stopped. Review the roster and end the session when ready.',
}

function useNow(active) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [active])
  return now
}

export default function SessionPanel({ session, onStartAttendance, onStopAttendance, onEnd, busy }) {
  const ended = session.phase === 'ENDED'
  const now = useNow(!ended)

  const expires = new Date(session.expiresAt).getTime()
  const total = expires - new Date(session.createdAt).getTime()
  const rem = Math.max(0, expires - now)
  const sec = Math.ceil(rem / 1000)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = String(sec % 60).padStart(2, '0')
  const left = h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Attendance Session</h2>
        {!ended && (
          <div className="actions">
            {session.phase === 'LOBBY' && (
              <button className="btn primary" disabled={busy} onClick={onStartAttendance}>
                Start Attendance
              </button>
            )}
            {session.phase === 'ATTENDANCE_OPEN' && (
              <button className="btn secondary" disabled={busy} onClick={onStopAttendance}>
                Stop Attendance
              </button>
            )}
            <button className="btn danger" disabled={busy} onClick={onEnd}>
              {session.phase === 'ATTENDANCE_CLOSED' ? 'End & Finalise' : 'End Session'}
            </button>
          </div>
        )}
      </div>

      {ended ? (
        <p style={{ margin: 0 }}>Session ended. Records have been saved.</p>
      ) : (
        <>
          <div className="sess">
            <div>
              <div className="k">Room Code</div>
              <div className="code">{session.roomCode}</div>
            </div>
            <div>
              <div className="k">Status</div>
              <span className={`badge b-${session.phase}`}>{PHASE_LABEL[session.phase]}</span>
            </div>
            <div>
              <div className="k">Expires At</div>
              <div>{new Date(session.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' })}</div>
            </div>
            <div className="clock">
              <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--line)" strokeWidth="4" />
                <circle
                  className="arc"
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth="4"
                  strokeDasharray={CIRC}
                  strokeDashoffset={total > 0 ? CIRC * (1 - rem / total) : 0}
                  transform="rotate(-90 24 24)"
                />
              </svg>
              <div>
                <span className="k">Time left</span>
                <b>{left}</b>
              </div>
            </div>
          </div>
          <p className="sess-note">{HINT[session.phase]}</p>
        </>
      )}
    </section>
  )
}
