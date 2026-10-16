import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useStudentAuth } from '../../context/StudentAuthContext'

export default function StudentLogin() {
  const { loginWithGoogle } = useStudentAuth()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSuccess(response) {
    setLoading(true)
    setError('')
    try {
      await loginWithGoogle(response.credential)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="s-login">
      <div className="s-login-box">
        <div className="s-logo-icon">🎓</div>
        <h1 className="s-login-title">SecureAttend</h1>
        <p className="s-login-sub">Student Portal</p>
        <p className="s-login-hint">Sign in with your Chitkara Google account to mark attendance</p>
        <div className="s-google-btn">
          {loading ? (
            <div className="s-login-loading">
              <div className="s-spinner" />
              <span>Signing in…</span>
            </div>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
            />
          )}
        </div>
        {error && <div className="s-err">{error}</div>}
      </div>
    </div>
  )
}
