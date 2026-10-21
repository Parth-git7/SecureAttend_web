import { useEffect, useRef, useState } from 'react'
import { isFacingFront, loadLandmarker, pickChallenges, readFace } from '../../liveness'

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const cancelError = () => Object.assign(new Error('cancelled'), { cancelled: true })

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
const STEP_TIMEOUT_MS = 10000

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

  // camera popup state: 'closed' | 'aim' | 'liveness' | 'finishing' | 'result'
  const [phase, setPhase] = useState('closed')
  const [faceOk, setFaceOk] = useState(false)
  const [steps, setSteps] = useState([])
  const [stepIdx, setStepIdx] = useState(0)
  const [serverDone, setServerDone] = useState(false)
  const [result, setResult] = useState(null) // { ok, text }
  const [humorLine, setHumorLine] = useState('')
  const [modelReady, setModelReady] = useState(false)

  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const tapRef = useRef(null) // { resolve, reject } while waiting for the Verify tap
  const faceOkRef = useRef(false)
  const cancelRef = useRef(false)
  const earlyFailRef = useRef(null) // server error that arrived while liveness was running

  const prevReasons = [LOC_MSG[session.myLocationResult], FACE_MSG[session.myFaceResult]].filter(Boolean)
  const prevFailed = prevReasons.length > 0

  // warm up the liveness model in the background, and release camera on unmount
  useEffect(() => {
    let alive = true
    loadLandmarker()
      .then(() => alive && setModelReady(true))
      .catch(() => { })
    return () => {
      alive = false
      cancelRef.current = true
      stopCamera()
    }
  }, [])

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setPhase('closed')
    setFaceOk(false)
    faceOkRef.current = false
  }

  async function openCamera() {
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
    setPhase('aim')
  }

  // Runs `onFrame(face)` ~12 times a second until it returns true (resolves true),
  // the timeout passes (resolves false), `until.done` is set (resolves false),
  // or the user cancels (rejects).
  function watch(landmarker, onFrame, { timeoutMs = 0, until } = {}) {
    return new Promise((resolve, reject) => {
      const video = videoRef.current
      const t0 = Date.now()
      let lastTime = -1
      const id = setInterval(() => {
        if (cancelRef.current) {
          clearInterval(id)
          return reject(cancelError())
        }
        if (until?.done) {
          clearInterval(id)
          return resolve(false)
        }
        if (timeoutMs && Date.now() - t0 > timeoutMs) {
          clearInterval(id)
          return resolve(false)
        }
        if (!video || !video.videoWidth || video.currentTime === lastTime) return
        lastTime = video.currentTime
        const face = readFace(landmarker.detectForVideo(video, performance.now()))
        if (onFrame(face)) {
          clearInterval(id)
          resolve(true)
        }
      }, 80)
    })
  }

  // Waits for the student to line up and tap Verify. Resolves with one frame.
  function waitForTap(landmarker) {
    const aim = { done: false }
    watch(
      landmarker,
      (face) => {
        const ok = isFacingFront(face)
        faceOkRef.current = ok
        setFaceOk(ok)
        return false
      },
      { until: aim }
    ).catch(() => { })

    return new Promise((resolve, reject) => {
      tapRef.current = {
        resolve: (frame) => {
          aim.done = true
          resolve(frame)
        },
        reject: (err) => {
          aim.done = true
          reject(err)
        },
      }
    })
  }

  function handleVerifyTap() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !tapRef.current || !faceOkRef.current) return
    const frame = grabFrame(video)
    tapRef.current.resolve(frame)
    tapRef.current = null
  }

  function handleCancelTap() {
    cancelRef.current = true
    tapRef.current?.reject(cancelError())
    tapRef.current = null
  }

  // Runs the random challenges one by one. Returns true if all passed.
  async function runLiveness(landmarker) {
    const chosen = pickChallenges(2)
    setSteps(chosen)
    setStepIdx(0)
    setPhase('liveness')
    for (let i = 0; i < chosen.length; i++) {
      setStepIdx(i)
      const check = chosen[i].make()
      const passed = await watch(landmarker, (f) => !!f && check(f), { timeoutMs: STEP_TIMEOUT_MS })
      if (!passed) return false
    }
    setStepIdx(chosen.length)
    return true
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
    if (!roomCode.trim()) {
      setMsg('Please enter the room code.')
      return
    }
    setBusy(true)
    setMsg('')
    cancelRef.current = false
    earlyFailRef.current = null
    setServerDone(false)
    setResult(null)

    try {
      setMsg('Loading face check…')
      let landmarker
      try {
        landmarker = await loadLandmarker()
      } catch {
        throw new Error('Liveness check could not load. Check your connection, or request a review.')
      }
      setMsg('')

      // location is fetched in the background while the student lines up
      const locationPromise = getStudentLocation()
        .then((studentLocation) => ({ studentLocation }))
        .catch((err) => ({ locationError: err.locationError || 'UNAVAILABLE' }))

      await openCamera()
      const frame = await waitForTap(landmarker) // student taps Verify

      // 1) send the frame NOW; do not wait for the answer
      const verifyPromise = locationPromise
        .then((loc) =>
          postAction(`/api/attendance-sessions/${session.sessionId}/verify`, {
            roomCode: roomCode.trim().toUpperCase(),
            ...loc,
            frames: [frame],
          })
        )
        .then(
          (r) => ({ ok: true, r }),
          (e) => ({ ok: false, e })
        )
        .then((out) => {
          setServerDone(true)
          if (!out.ok) {
            // e.g. wrong room code: stop the challenges early
            earlyFailRef.current = out.e
            cancelRef.current = true
          }
          return out
        })

      // 2) while the server works, run liveness on the device
      const livenessPassed = await runLiveness(landmarker)

      // 3) wait for the server (usually already done)
      setPhase('finishing')
      const out = await verifyPromise
      if (!out.ok) throw out.e
      const r = out.r

      let final
      if (!livenessPassed) {
        final = { ok: false, text: 'Liveness check failed. Please try again.' }
      } else if (r.awaitingLiveness) {
        await postAction(`/api/attendance-sessions/${session.sessionId}/liveness-complete`)
        final = { ok: true, text: 'You are marked PRESENT' }
      } else {
        final = { ok: false, text: r.message }
      }

      setResult(final)
      setPhase('result')
      await sleep(1600)
      setMsg(final.ok ? '' : final.text)
    } catch (err) {
      const e = earlyFailRef.current || err
      setMsg(e.cancelled ? '' : e.message)
    } finally {
      stopCamera()
      setBusy(false)
      await onRefresh()
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
  const { myStatus, phase: sessionPhase } = session
  let actionContent

  if (myStatus === 'PRESENT') {
    actionContent = <div className="s-status-pill present"> You are marked <strong>PRESENT</strong></div>
  } else if (myStatus === 'REVIEW') {
    actionContent = (
      <div className="s-status-pill review">
        🕐 Review requested — waiting for teacher's decision
      </div>
    )
  } else if (myStatus === 'ABSENT') {
    actionContent = <div className="s-status-pill absent">❌ You were marked <strong>ABSENT</strong> by the teacher</div>
  } else if (sessionPhase === 'ATTENDANCE_CLOSED') {
    actionContent = <div className="s-status-pill closed"> Attendance is now closed</div>
  } else if (sessionPhase === 'LOBBY') {
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
  } else if (sessionPhase === 'ATTENDANCE_OPEN' && myStatus === 'JOINED') {
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
          disabled={busy || !modelReady}
          onClick={handleSubmit}
        >
          {busy
            ? (msg || 'Processing…')
            : !modelReady
              ? 'Preparing face check…'
              : prevFailed ? 'Retry & Scan Face' : 'Submit Code & Scan Face'}
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
    actionContent = (
      <button className="s-btn primary" id="join-attendance-btn" disabled={busy} onClick={handleJoin}>
        {busy ? 'Joining…' : 'Join Attendance'}
      </button>
    )
  }

  // ─── camera popup text ───────────────────────────────────
  const showCamera = phase !== 'closed'
  const eyebrow = phase === 'aim' ? 'Face Verification' : 'Liveness Check'
  let headline = humorLine || 'Look directly at the camera'
  if (phase === 'liveness') headline = steps[stepIdx]?.text ?? 'Great!'
  if (phase === 'finishing') headline = 'Almost done…'
  if (phase === 'result') headline = result?.text ?? ''

  return (
    <>
      {/* Camera overlay — always in DOM so videoRef is always attached */}
      <div className={`s-camera-overlay${showCamera ? ' visible' : ''}`} aria-hidden={!showCamera}>
        <div className="s-camera-modal">

          <div className="s-camera-header">
            <span className="s-camera-eyebrow">{eyebrow}</span>
            <p className={`s-camera-humor${phase === 'liveness' ? ' s-camera-challenge' : ''}`}>{headline}</p>
          </div>

          <div className="s-camera-frame">
            <video ref={videoRef} playsInline muted autoPlay className="s-camera-video" />
            <div
              className={`s-camera-oval${phase === 'aim' && faceOk ? ' ok' : ''}${phase === 'result' ? (result?.ok ? ' ok' : ' bad') : ''
                }`}
            />
          </div>

          {phase === 'aim' && (
            <>
              <div className="s-camera-actions">
                <button
                  type="button"
                  className="s-btn primary s-camera-btn-submit"
                  id="verify-face-btn"
                  disabled={!faceOk}
                  onClick={handleVerifyTap}
                >
                  {faceOk ? 'Verify' : 'Center your face…'}
                </button>
                <button type="button" className="s-camera-btn-cancel" id="cancel-face-btn" onClick={handleCancelTap}>
                  Cancel
                </button>
              </div>
              <div className="s-camera-instructions">
                <div className="s-camera-step"><span className="s-camera-step-num">1</span><span>Center your face inside the oval</span></div>
                <div className="s-camera-step"><span className="s-camera-step-num">2</span><span>Look directly at the camera at eye level</span></div>
                <div className="s-camera-step"><span className="s-camera-step-num">3</span><span>Ensure good lighting without cap or mask</span></div>
              </div>
            </>
          )}

          {phase === 'liveness' && (
            <>
              <div className="s-live-dots">
                {steps.map((s, i) => (
                  <span key={s.id} className={`s-live-dot${i < stepIdx ? ' done' : i === stepIdx ? ' active' : ''}`} />
                ))}
              </div>
              <p className="s-live-server">
                {serverDone ? '✓ Face check complete' : '⏳ Checking your face…'}
              </p>
              <div className="s-camera-actions">
                <button type="button" className="s-camera-btn-cancel" onClick={handleCancelTap}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {phase === 'finishing' && (
            <p className="s-live-server">{serverDone ? 'Finalizing…' : 'Finishing face check…'}</p>
          )}
        </div>
      </div>

      <div className="s-session-card">
        <div className="s-session-header">
          <span className="s-active-dot" />
          <span className="s-active-label">LIVE</span>
          <span className={`badge b-${sessionPhase}`}>{PHASE_LABEL[sessionPhase] || sessionPhase}</span>
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