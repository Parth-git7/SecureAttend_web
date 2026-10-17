import { useCallback, useEffect, useState } from 'react'
import { api } from '../../api'
import { Modal } from './ui'

export default function GroupManage({ group, onClose }) {
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [allSubjects, setAllSubjects] = useState([])
  const [studentId, setStudentId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [error, setError] = useState('')
  const base = `/api/admin/groups/${group._id}`

  const reload = useCallback(async () => {
    const [a, b] = await Promise.all([
      api(`${base}/students`),
      api(`/api/academic/groups/${group._id}/subjects`),
    ])
    setStudents(a.students)
    setSubjects(b.subjects)
  }, [base, group._id])

  useEffect(() => {
    reload().catch((e) => setError(e.message))
    Promise.all([api('/api/admin/students'), api('/api/admin/subjects')])
      .then(([s, j]) => {
        setAllStudents(s.students)
        setAllSubjects(j.subjects)
      })
      .catch((e) => setError(e.message))
  }, [reload])

  const act = (fn) => async () => {
    try {
      setError('')
      await fn()
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal title={`Manage ${group.name}`} onClose={onClose}>
      {error && <div className="msg error">{error}</div>}

      <h3 className="sub">Students ({students.length})</h3>
      <div className="inline">
        <select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">Select student…</option>
          {allStudents.map((s) => (
            <option key={s.studentId} value={s.studentId}>
              {s.name} — {s.rollNo}
            </option>
          ))}
        </select>
        <button
          className="btn primary sm"
          disabled={!studentId}
          onClick={act(async () => {
            await api(`${base}/students`, { method: 'POST', body: { studentId } })
            setStudentId('')
          })}
        >
          Add
        </button>
      </div>
      <ul className="list">
        {students.map((s) => (
          <li key={s.studentId}>
            <span>{s.name} <small>{s.rollNo}</small></span>
            <button
              className="btn sm bad"
              onClick={act(() => api(`${base}/students/${s.studentId}`, { method: 'DELETE' }))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>

      <h3 className="sub">Subjects ({subjects.length})</h3>
      <div className="inline">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
          <option value="">Select subject…</option>
          {allSubjects.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <button
          className="btn primary sm"
          disabled={!subjectId}
          onClick={act(async () => {
            await api(`${base}/subjects`, { method: 'POST', body: { subjectId } })
            setSubjectId('')
          })}
        >
          Add
        </button>
      </div>
      <ul className="list">
        {subjects.map((s) => (
          <li key={s.subjectId}>
            <span>{s.name} <small>{s.code}</small></span>
            <button
              className="btn sm bad"
              onClick={act(() => api(`${base}/subjects/${s.subjectId}`, { method: 'DELETE' }))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
