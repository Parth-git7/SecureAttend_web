import { useAuth } from './context/AuthContext'
import Login from './components/Login'

function App() {
  const { user, logout } = useAuth()

  if (!user) return <Login />

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

export default App