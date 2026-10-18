import { useEffect, useRef, useState } from 'react'

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

// ─── single-frame grab (unmirrored, max 640px wide) ──────────
function grabFrame(video) {
  const scale = Math.min(1, 640 / video.videoWidth)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
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
const CAMERA_WARMUP_MS = 700 // let auto-exposure/focus settle before Verify is enabled

const HUMOUR_LINES = [
  'Say cheese, not proxy.',
  'Smile. Your attendance has trust issues.',
  'Look here, attendance paglu.',
  'Look here, cutiepie.',
  'You would be cute, if you could smile.',
]

// ─── component ───────────────────────────────────────────────
export default function ActiveSession({ session, onRefresh }) {
  const [roomCode, setRoomCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [camReady, setCamReady] = useState(false)
  const [humorLine, setHumorLine] = useState('')

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const pendingRef = useRef(null) // { resolve, reject } for the pending capture

  const prevReasons = [LOC_MSG[session.myLocationResult], FACE_MSG[session.myFaceResult]].filter(Boolean)
  const prevFailed = prevReasons.length > 0

  // make sure the camera is released if the component unmounts mid-capture
  useEffect(() => () => stopCamera(), [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setShowCamera(false)
    setCamReady(false)
  }

  // Opens the camera and resolves with ONE frame when the student taps Verify.
  // Rejects with { cancelled: true } if they tap Cancel.
  async function captureFace() {
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 } },
        audio: false,
      })
    } catch {
      throw new Error('Camera access is needed to verify your face. Allow camera permission and try again.')
    }
    streamRef.current = stream
    const video = videoRef.current
    video.srcObject = stream
    await video.play()
    setHumorLine(HUMOUR_LINES[Math.floor(Math.random() * HUMOUR_LINES.length)])
    setShowCamera(true)
    setTimeout(() => setCamReady(true), CAMERA_WARMUP_MS)

    return new Promise((resolve, reject) => {
      pendingRef.current = { resolve, reject }
    })
  }

  function handleVerifyTap() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !pendingRef.current) return
    const frame = grabFrame(video)
    pendingRef.current.resolve(frame)
    pendingRef.current = null
  }

  function handleCancelTap() {
    pendingRef.current?.reject(Object.assign(new Error('cancelled'), { cancelled: true }))
    pendingRef.current = null
  }

  async function postAction(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('sa_token')}`,
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
      // fetch location in the background while the student lines up their face
      const locationPromise = getStudentLocation()
        .then((studentLocation) => ({ studentLocation }))
        .catch((err) => ({ locationError: err.locationError || 'UNAVAILABLE' }))

      const frame = await captureFace() // waits for the student to tap Verify
      stopCamera()

      setMsg('Verifying…')
      const loc = await locationPromise
      await postAction(`/api/attendance-sessions/${session.sessionId}/verify`, {
        roomCode: roomCode.trim().toUpperCase(),
        ...loc,
        frames: [frame],
      })
      setMsg('')
      await onRefresh()
    } catch (err) {
      setMsg(err.cancelled ? '' : err.message)
    } finally {
      stopCamera()
      setBusy(false)
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
          {busy ? (msg || 'Processing…') : prevFailed ? '🔄 Retry & Scan Face' : 'Submit Code & Scan Face'}
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
      {/* Camera overlay — always in DOM so videoRef is always attached */}
      <div className={`s-camera-overlay${showCamera ? ' visible' : ''}`} aria-hidden={!showCamera}>
        <div className="s-camera-modal">

          {/* 1. Humour line to look at camera */}
          <div className="s-camera-header">
            <span className="s-camera-eyebrow">Face Verification</span>
            <p className="s-camera-humor">{humorLine || 'Look directly at the camera'}</p>
          </div>

          {/* 2. Image of person */}
          <div className="s-camera-frame">
            <video ref={videoRef} playsInline muted autoPlay className="s-camera-video" />
            <div className="s-camera-oval" />
          </div>

          {/* 3. Submit button & 4. Under it cancel button */}
          <div className="s-camera-actions">
            <button
              type="button"
              className="s-btn primary s-camera-btn-submit"
              id="verify-face-btn"
              disabled={!camReady}
              onClick={handleVerifyTap}
            >
              {camReady ? 'Submit Attendance' : 'Starting camera…'}
            </button>
            <button
              type="button"
              className="s-camera-btn-cancel"
              id="cancel-face-btn"
              onClick={handleCancelTap}
            >
              Cancel
            </button>
          </div>

          {/* 5. Three clear instructions stacked vertically */}
          <div className="s-camera-instructions">
            <div className="s-camera-step">
              <span className="s-camera-step-num">1</span>
              <span>Center your face inside the oval</span>
            </div>
            <div className="s-camera-step">
              <span className="s-camera-step-num">2</span>
              <span>Look directly at the camera at eye level</span>
            </div>
            <div className="s-camera-step">
              <span className="s-camera-step-num">3</span>
              <span>Ensure good lighting without cap or mask</span>
            </div>
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

        {msg && !busy && <p className="s-status-msg">{msg}</p>}
      </div>
    </>
  )
}