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
    <div>
      <h2>SecureAttend — Teacher Portal</h2>
      <p>Please sign in with your Chitkara Google account.</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => setError('Google sign-in failed')}
      />
    </div>
  )
}