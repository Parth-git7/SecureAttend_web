import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

let loading = null

// Loads once, then reused. Call early so it's warm when the camera opens.
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
      try {
        return await make('GPU')
      } catch {
        return await make('CPU') // some phones have no usable GPU delegate
      }
    })().catch((e) => {
      loading = null
      throw e
    })
  }
  return loading
}

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

export function pickChallenges(n = 3) {
  return [...CHALLENGES].sort(() => Math.random() - 0.5).slice(0, n)
}

export const isFacingFront = (f) => !!f && f.yaw > 0.42 && f.yaw < 0.58