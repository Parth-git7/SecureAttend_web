import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  ['students', 'Students'],
  ['teachers', 'Teachers'],
  ['face-photos', 'Face photos'],
  ['periods', 'Academic periods'],
  ['branches', 'Branches'],
  ['groups', 'Groups'],
  ['subjects', 'Subjects'],
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="adm">
      <aside className="adm-side">
        <div className="adm-brand">SecureAttend</div>
        <nav>
          {NAV.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? 'on' : '')}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="adm-user">
          <div>{user?.name}</div>
          <small>{user?.email}</small>
          <button className="btn sm logout" onClick={logout}>Logout</button>
        </div>
      </aside>
      <main className="adm-main">
        <Outlet />
      </main>
    </div>
  )
}
