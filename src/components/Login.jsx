import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { loginWithGoogle } = useAuth()
  const [error, setError] = useState('')

  async function handleSuccess(response) {
    try {
      setError('')
      await loginWithGoogle(response.credential)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="login">
      <div className="login-box">
        <h1>SecureAttend Login</h1>
        <p>Sign in with your Chitkara Google account.</p>
        <GoogleLogin onSuccess={handleSuccess} onError={() => setError('Google sign-in failed')} />
        {error && <div className="err">{error}</div>}
      </div>
    </section>
  )
}
