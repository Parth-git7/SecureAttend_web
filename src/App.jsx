import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'

export default function App() {
  const { user } = useAuth()
  return <div className="wrap">{user ? <Dashboard /> : <Login />}</div>
}
