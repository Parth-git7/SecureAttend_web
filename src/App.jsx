import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { StudentAuthProvider } from './context/StudentAuthContext'
import { useStudentAuth } from './context/StudentAuthContext'
import Login from './components/Login'
import Dashboard from './components/Dashboard'
import StudentLogin from './components/student/StudentLogin'
import StudentDashboard from './components/student/StudentDashboard'

function TeacherApp() {
  const { user } = useAuth()
  return <div className="wrap">{user ? <Dashboard /> : <Login />}</div>
}

function StudentAppInner() {
  const { user } = useStudentAuth()
  return user ? <StudentDashboard /> : <StudentLogin />
}

function StudentApp() {
  return (
    <StudentAuthProvider>
      <StudentAppInner />
    </StudentAuthProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/teacher" element={<TeacherApp />} />
        <Route path="/student" element={<StudentApp />} />
      </Routes>
    </BrowserRouter>
  )
}
