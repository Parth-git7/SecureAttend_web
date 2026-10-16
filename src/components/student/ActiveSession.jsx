import { useRef, useState } from 'react'

// ─── geo helper ──────────────────────────────────────────────
function getStudentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      const e = new Error('Geolocation not supported.')
      e.locationError = 'UNAVAILABLE'
      return reject(e)
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (err) => {
        const codes = { 1: 'DENIED', 2: 'UNAVAILABLE', 3: 'TIMEOUT' }
        const e = new Error('Could not get location.')
        e.locationError = codes[err.code] || 'UNAVAILABLE'
        reject(e)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

// ─── camera helper ───────────────────────────────────────────
async function captureFrames(videoEl, count = 3, gapMs = 400) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 } },
    audio: false,
  })
  try {
    videoEl.srcObject = stream
    await videoEl.play()
    await new Promise((r) => setTimeout(r, 800))
    const scale = Math.min(1, 640 / videoEl.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(videoEl.videoWidth * scale)
    canvas.height = Math.round(videoEl.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    const frames = []
    for (let i = 0; i < count; i++) {
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height)
      frames.push(canvas.toDataURL('image/jpeg', 0.85))
      if (i < count - 1) await new Promise((r) => setTimeout(r, gapMs))
    }
    return frames
  } finally {
    stream.getTracks().forEach((t) => t.stop())
    videoEl.srcObject = null
  }
}

// ─── constants ───────────────────────────────────────────────
const LOC_MSG = {
  NO_LOCATION: 'Your location could not be accessed.',
  FAIL_FAR: 'You seem too far from the classroom.',
}
const FACE_MSG = {
  NO_FACE: "We couldn't see your face clearly.",
  FAIL_MISMATCH: 'Your face did not match our records.',
  NO_TEMPLATE: 'No face photo is on file for you.',
  ERROR: 'Face check is unavailable right now.',
}
const PHASE_LABEL = {
  LOBBY: 'Lobby',
  ATTENDANCE_OPEN: 'Attendance Open',
  ATTENDANCE_CLOSED: 'Attendance Closed',
}

// ─── component ───────────────────────────────────────────────
export default function ActiveSession({ session, onRefresh }) {
  const [roomCode, setRoomCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const videoRef = useRef(null)

  const prevReasons = [LOC_MSG[session.myLocationResult], FACE_MSG[session.myFaceResult]].filter(Boolean)
  const prevFailed = prevReasons.length > 0

  async function postAction(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('sa_student_token')}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Request failed')
    return data
  }

  async function handleJoin() {
    setBusy(true)
    setMsg('')
    try {
      await postAction(`/api/attendance-sessions/${session.sessionId}/join`)
      await onRefresh()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit() {
    if (!roomCode.trim()) { setMsg('Please enter the room code.'); return }
    setBusy(true)
    setMsg('')
    try {
      const payload = { roomCode: roomCode.trim().toUpperCase() }
      setMsg('Getting your location…')
      try {
        payload.studentLocation = await getStudentLocation()
      } catch (err) {
        payload.locationError = err.locationError || 'UNAVAILABLE'
      }
      setMsg('Look at the camera…')
      setShowCamera(true)
      try {
        payload.frames = await captureFrames(videoRef.current)
      } catch (err) {
        console.error('Camera error:', err)
      } finally {
        setShowCamera(false)
      }
      setMsg('Submitting…')
      await postAction(`/api/attendance-sessions/${session.sessionId}/verify`, payload)
      setMsg('')
      await onRefresh()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
      setShowCamera(false)
    }
  }

  async function handleReview() {
    setBusy(true)
    setMsg('')
    try {
      await postAction(`/api/attendance-sessions/${session.sessionId}/review-request`)
      await onRefresh()
    } catch (err) {
      setMsg(err.message)
    } finally {
      setBusy(false)
    }
  }

  // ─── action area content ─────────────────────────────────
  const { myStatus, phase } = session
  let actionContent

  if (myStatus === 'PRESENT') {
    actionContent = <div className="s-status-pill present">✅ You are marked <strong>PRESENT</strong></div>
  } else if (myStatus === 'REVIEW') {
    actionContent = (
      <div className="s-status-pill review">
        🕐 Review requested — waiting for teacher's decision
      </div>
    )
  } else if (myStatus === 'ABSENT') {
    actionContent = <div className="s-status-pill absent">❌ You were marked <strong>ABSENT</strong> by the teacher</div>
  } else if (phase === 'ATTENDANCE_CLOSED') {
    actionContent = <div className="s-status-pill closed">🔒 Attendance is now closed</div>
  } else if (phase === 'LOBBY') {
    actionContent = myStatus === 'JOINED' ? (
      <div className="s-lobby-wait">
        <div className="s-spinner" />
        <p>You've joined the lobby. Waiting for the teacher to open attendance…</p>
      </div>
    ) : (
      <div className="s-lobby-wait">
        <div className="s-spinner" />
        <p>Attendance hasn't started yet. Join the lobby to be ready when it opens.</p>
        <button className="s-btn primary" id="join-lobby-btn" disabled={busy} onClick={handleJoin}>
          {busy ? 'Joining…' : 'Join Lobby'}
        </button>
      </div>
    )
  } else if (phase === 'ATTENDANCE_OPEN' && myStatus === 'JOINED') {
    actionContent = (
      <>
        {prevFailed && (
          <div className="s-warn-box">
            ⚠ {prevReasons.join(' ')} You can retry below.
          </div>
        )}
        <label className="s-code-label" htmlFor="room-code-input">
          Room code shown by your teacher
        </label>
        <input
          id="room-code-input"
          className="s-code-input"
          type="text"
          maxLength={5}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck="false"
          placeholder="AB3XY"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
        />
        <button
          id="submit-code-btn"
          className="s-btn primary"
          disabled={busy}
          onClick={handleSubmit}
        >
          {busy ? (msg || 'Processing…') : prevFailed ? '🔄 Retry Submission' : 'Submit Code'}
        </button>
        <button
          id="review-btn"
          className="s-btn danger"
          disabled={busy}
          onClick={handleReview}
        >
          Request Review Instead
        </button>
      </>
    )
  } else {
    // ATTENDANCE_OPEN but student not yet joined
    actionContent = (
      <button className="s-btn primary" id="join-attendance-btn" disabled={busy} onClick={handleJoin}>
        {busy ? 'Joining…' : 'Join Attendance'}
      </button>
    )
  }

  return (
    <>
      {/* Camera overlay — always in DOM so ref is always attached */}
      <div className={`s-camera-overlay${showCamera ? ' visible' : ''}`} aria-hidden={!showCamera}>
        <div className="s-camera-modal">
          <p>📸 Look straight at the camera…</p>
          <div className="s-camera-frame">
            <video ref={videoRef} playsInline muted autoPlay className="s-camera-video" />
            <div className="s-camera-guide" />
          </div>
        </div>
      </div>

      <div className="s-session-card">
        <div className="s-session-header">
          <span className="s-active-dot" />
          <span className="s-active-label">LIVE</span>
          <span className={`badge b-${phase}`}>{PHASE_LABEL[phase] || phase}</span>
        </div>

        <h2 className="s-subject-name">{session.subject.name}</h2>
        <div className="s-session-meta">
          <span>{session.subject.code}</span>
          <span className="s-meta-sep">·</span>
          <span>{session.group.name}</span>
        </div>
        <p className="s-expires">
          Expires {new Date(session.expiresAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </p>

        <hr className="s-divider" />

        <div className="s-action-area">{actionContent}</div>

        {msg && <p className="s-status-msg">{msg}</p>}
      </div>
    </>
  )
}
