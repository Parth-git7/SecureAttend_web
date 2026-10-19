import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let loading = null

// Loads once, warms up, then is reused.
export function loadLandmarker() {
  if (!loading) {
    loading = (async () => {
      const fileset = await FilesetResolver.forVisionTasks('/mediapipe/wasm')
      const make = (delegate) =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
        })
      let lm
      try {
        lm = await make('GPU')
      } catch {
        lm = await make('CPU') // some phones have no usable GPU delegate
      }
      // warm-up: the first detection compiles shaders and is slow
      try {
        const c = document.createElement('canvas')
        c.width = c.height = 128
        lm.detectForVideo(c, performance.now())
      } catch {
        /* ignore */
      }
      return lm
    })().catch((e) => {
      loading = null
      throw e
    })
  }
  return loading
}

// Fire and forget. Safe to call many times.
export const preloadLandmarker = () => loadLandmarker().catch(() => {})

const score = (cats, name) => cats.find((c) => c.categoryName === name)?.score ?? 0

// Turns a MediaPipe result into the few numbers we care about.
export function readFace(result) {
  const cats = result.faceBlendshapes?.[0]?.categories
  const lm = result.faceLandmarks?.[0]
  if (!cats || !lm) return null
  return {
    blink: (score(cats, 'eyeBlinkLeft') + score(cats, 'eyeBlinkRight')) / 2,
    smile: (score(cats, 'mouthSmileLeft') + score(cats, 'mouthSmileRight')) / 2,
    brows: Math.max(
      score(cats, 'browInnerUp'),
      (score(cats, 'browOuterUpLeft') + score(cats, 'browOuterUpRight')) / 2
    ),
    // 0.5 = looking straight. Nose position between the two cheek edges.
    yaw: (lm[1].x - lm[234].x) / (lm[454].x - lm[234].x),
  }
}

// true once `test` has been satisfied for `need` frames in a row
const hold = (test, need = 3) => {
  let n = 0
  return (f) => {
    n = test(f) ? n + 1 : 0
    return n >= need
  }
}

// Tune these numbers if challenges feel too hard or too easy.
export const CHALLENGES = [
  {
    id: 'blink',
    text: 'Blink twice',
    make() {
      let closed = false
      let count = 0
      return (f) => {
        if (f.blink > 0.5) closed = true
        else if (f.blink < 0.25 && closed) {
          closed = false
          count++
        }
        return count >= 2
      }
    },
  },
  { id: 'smile', text: 'Give a big smile', make: () => hold((f) => f.smile > 0.55) },
  { id: 'brows', text: 'Raise your eyebrows', make: () => hold((f) => f.brows > 0.45) },
  // The preview is mirrored, so "right" is the student's right on screen.
  // If left/right feel swapped on your phone, swap the two comparisons below.
  { id: 'right', text: 'Turn your head right', make: () => hold((f) => f.yaw < 0.36) },
  { id: 'left', text: 'Turn your head left', make: () => hold((f) => f.yaw > 0.64) },
]

export function pickChallenges(n = 2) {
  return [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, n)
}

export const isFacingFront = (f) => !!f && f.yaw > 0.42 && f.yaw < 0.58