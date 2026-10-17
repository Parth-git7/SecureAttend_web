// src/App.jsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './components/Login'
import Dashboard from './components/teacher/TeacherDashboard'
import StudentDashboard from './components/student/StudentDashboard'
import AdminLayout from './components/admin/AdminLayout'
import { Students, Teachers, Periods, Branches, Subjects, Groups, FacePhotos } from './components/admin/pages'

const HOME = { ADMIN: '/admin', TEACHER: '/teacher', STUDENT: '/student' }

function Require({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={HOME[user.role]} replace />
  return children
}

export default function App() {
  const { user } = useAuth()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={HOME[user.role]} replace /> : <Login />} />
        <Route path="/teacher" element={<Require role="TEACHER"><div className="wrap"><Dashboard /></div></Require>} />
        <Route path="/student" element={<Require role="STUDENT"><StudentDashboard /></Require>} />
        <Route path="/admin" element={<Require role="ADMIN"><AdminLayout /></Require>}>
          <Route index element={<Navigate to="students" replace />} />
          <Route path="students" element={<Students />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="face-photos" element={<FacePhotos />} />
          <Route path="periods" element={<Periods />} />
          <Route path="branches" element={<Branches />} />
          <Route path="groups" element={<Groups />} />
          <Route path="subjects" element={<Subjects />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}