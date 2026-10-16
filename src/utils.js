export function getTeacherLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
      (err) => {
        const messages = {
          1: 'Location permission denied. Allow location access to start attendance.',
          2: 'Location unavailable. Check GPS/network and try again.',
          3: 'Location request timed out. Try again.',
        }
        reject(new Error(messages[err.code] || 'Could not get location.'))
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}
