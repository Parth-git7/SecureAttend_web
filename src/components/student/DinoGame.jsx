import { useEffect, useRef, useState } from 'react'

export default function DinoGame() {
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('sa_dino_hi'), 10) || 0
    } catch {
      return 0
    }
  })

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const cx = cv.getContext('2d')
    if (!cx) return

    let W = 300
    const H = 150
    const G = H - 28
    const C = {
      ink: '#1A1714',
      mut: '#7A746E',
      line: '#D6D0C7',
      surface: '#FFFFFF',
    }
    let state = 'idle' // 'idle' | 'run' | 'over'
    let lift = 0
    let vy = 0
    let obs = []
    let speed = 5
    let score = 0
    let hi = 0
    try {
      hi = parseInt(localStorage.getItem('sa_dino_hi'), 10) || 0
    } catch {
      hi = 0
    }
    let last = 0
    let fr = 0
    let raf = 0
    let isMounted = true

    function rr(x, y, w, h, r) {
      cx.beginPath()
      if (typeof cx.roundRect === 'function') {
        cx.roundRect(x, y, w, h, r)
      } else {
        cx.rect(x, y, w, h)
      }
      cx.fill()
    }

    function draw() {
      cx.clearRect(0, 0, W, H)

      // Ground line
      cx.strokeStyle = C.line
      cx.lineWidth = 1.5
      cx.beginPath()
      cx.moveTo(0, G + 0.5)
      cx.lineTo(W, G + 0.5)
      cx.stroke()

      // Ground dashes/particles
      cx.fillStyle = C.line
      for (let i = 0; i < 8; i++) {
        cx.fillRect(((i * 97 - fr * 40) % W + W) % W, G + 8 + (i % 3) * 5, 6 + (i % 2) * 6, 2)
      }

      // Obstacles
      cx.fillStyle = C.mut
      for (const o of obs) {
        for (let i = 0; i < o.n; i++) {
          const x = o.x + i * 16
          rr(x + 3, G - o.h, 7, o.h, 3)
          rr(x - 1, G - o.h * 0.65, 5, 10, 2)
          rr(x + 9, G - o.h * 0.8, 5, 10, 2)
        }
      }

      // Dino
      const x = 38
      const y = G - lift - 26
      cx.fillStyle = C.ink
      rr(x, y + 8, 18, 14, 4)
      rr(x + 10, y, 14, 12, 4)
      rr(x - 5, y + 10, 8, 5, 2)

      const step = lift > 0 ? 0 : Math.floor(fr * 3) % 2
      rr(x + 3, y + 21, 5, 5 + (step ? 0 : -2), 1)
      rr(x + 11, y + 21, 5, 5 + (step ? -2 : 0), 1)

      // Dino eye
      cx.fillStyle = C.surface
      cx.fillRect(x + 18, y + 3, 3, 3)

      // HUD: score
      cx.fillStyle = C.mut
      cx.font = '600 12px Inter, system-ui, sans-serif'
      cx.textAlign = 'right'
      cx.fillText(String(Math.floor(score)).padStart(4, '0'), W - 12, 20)

      // State label
      cx.textAlign = 'center'
      cx.font = '600 13px Inter, system-ui, sans-serif'
      cx.fillStyle = C.ink
      if (state === 'idle') cx.fillText('Tap to start', W / 2, 52)
      if (state === 'over') cx.fillText('Game over · tap to retry', W / 2, 52)
    }

    function resize() {
      if (!cv) return
      const d = window.devicePixelRatio || 1
      W = cv.clientWidth || 300
      cv.width = W * d
      cv.height = H * d
      cx.setTransform(d, 0, 0, d, 0, 0)
      draw()
    }

    function reset() {
      lift = 0
      vy = 0
      obs = []
      speed = 5
      score = 0
      fr = 0
    }

    function end() {
      state = 'over'
      const s = Math.floor(score)
      if (s > hi) {
        hi = s
        try {
          localStorage.setItem('sa_dino_hi', String(hi))
        } catch {
          // ignore
        }
        setHighScore(hi)
      }
    }

    function loop(t) {
      if (!isMounted || state !== 'run') return
      const dt = Math.min(2.5, (t - last) / 16.67)
      last = t
      vy -= 0.72 * dt
      lift += vy * dt
      if (lift <= 0) {
        lift = 0
        vy = 0
      }
      score += 0.12 * speed * dt
      speed = Math.min(11, 5 + score / 500)
      fr += dt * speed * 0.06

      const lo = obs[obs.length - 1]
      if (!lo || lo.x < W - (210 + Math.random() * 190) * (speed / 6)) {
        const n = Math.random() < 0.3 ? 2 : 1
        const w = 13 * n + (n - 1) * 3
        obs.push({ x: W + 10, w, h: 24 + Math.random() * 16, n })
      }
      obs.forEach((o) => {
        o.x -= speed * dt
      })
      obs = obs.filter((o) => o.x + o.w > -10)

      const dx = 38
      const dw = 22
      const dh = 26
      const top = G - lift - dh
      for (const o of obs) {
        if (dx + dw - 4 > o.x && dx + 4 < o.x + o.w && top + dh - 2 > G - o.h) {
          end()
        }
      }

      draw()
      if (state === 'run') {
        raf = requestAnimationFrame(loop)
      }
    }

    function jump() {
      if (state === 'idle' || state === 'over') {
        reset()
        state = 'run'
        last = performance.now()
        raf = requestAnimationFrame(loop)
        return
      }
      if (state === 'run' && lift === 0) {
        vy = 10.2
      }
    }

    const onPointerDown = (e) => {
      e.preventDefault()
      jump()
    }
    cv.addEventListener('pointerdown', onPointerDown)

    const onKeyDown = (e) => {
      if (e.code !== 'Space' && e.code !== 'ArrowUp') return
      const target = e.target
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      if (isInput) return

      e.preventDefault()
      jump()
    }
    window.addEventListener('keydown', onKeyDown)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (state === 'run') {
          cancelAnimationFrame(raf)
        }
      } else if (document.visibilityState === 'visible') {
        if (state === 'run') {
          last = performance.now()
          raf = requestAnimationFrame(loop)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    let ro = null
    if (typeof ResizeObserver !== 'undefined' && stageRef.current) {
      ro = new ResizeObserver(() => resize())
      ro.observe(stageRef.current)
    } else {
      window.addEventListener('resize', resize)
    }

    resize()

    return () => {
      isMounted = false
      cancelAnimationFrame(raf)
      cv.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (ro) {
        ro.disconnect()
      } else {
        window.removeEventListener('resize', resize)
      }
    }
  }, [])

  return (
    <div className="s-game-card">
      <div className="s-game-header">
        <div>
          <h2 className="s-game-title">Play while the attendance begins?</h2>
          <p className="s-game-subtitle">Jump the cacti. We’ll stop you when class starts.</p>
        </div>
        <div className="s-game-hi">
          HI <span>{String(highScore).padStart(4, '0')}</span>
        </div>
      </div>
      <div className="s-game-stage" ref={stageRef}>
        <canvas id="cv" ref={canvasRef} className="s-game-canvas" aria-label="Dino jumping game" />
      </div>
      <p className="s-game-hint">Tap the game or press Space to jump</p>
    </div>
  )
}
