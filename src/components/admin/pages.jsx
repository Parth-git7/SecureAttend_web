import { useRef, useState } from 'react'
import { api } from '../../api'
import ResourcePage from './ResourcePage'
import GroupManage from './GroupManage'

const get = (path, key) => async () => (await api(path))[key]
const post = (path, extra = {}) => (v) => api(path, { method: 'POST', body: { ...v, ...extra } })
const destroy = (url) => (r) => api(url(r), { method: 'DELETE' })
const editUser = (r, v) =>
  api(`/api/admin/users/${r.userId}`, { method: 'PUT', body: { name: v.name, email: v.email } })
const fmt = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

const loadStudents = get('/api/admin/students', 'students')
const loadTeachers = get('/api/admin/teachers', 'teachers')
const loadPeriods = get('/api/academic/academic-periods', 'academicPeriods')
const loadBranches = get('/api/admin/branches', 'branches')
const loadSubjects = get('/api/admin/subjects', 'subjects')
const loadGroups = get('/api/admin/groups', 'groups')

async function groupOptions() {
  const [p, b, s] = await Promise.all([
    api('/api/academic/academic-periods'),
    api('/api/admin/branches'),
    api('/api/academic/semesters'),
  ])
  return {
    period: p.academicPeriods.map((x) => ({ value: x._id, label: x.name })),
    branch: b.branches.map((x) => ({ value: x._id, label: `${x.name} (${x.code})` })),
    semester: s.semesters.map((x) => ({ value: x._id, label: x.name })),
  }
}

const userFields = [
  { name: 'name', label: 'Full name', editable: true },
  { name: 'email', label: 'Email', type: 'email', editable: true },
]

export const Students = () => (
  <ResourcePage
    title="Students"
    load={loadStudents}
    rowKey={(r) => r.studentId}
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'rollNo', label: 'Roll no.' },
      { key: 'batch', label: 'Batch' },
    ]}
    fields={[
      ...userFields,
      { name: 'rollNo', label: 'Roll number' },
      { name: 'batch', label: 'Batch' },
    ]}
    create={post('/api/admin/users', { role: 'STUDENT' })}
    update={editUser}
    remove={destroy((r) => `/api/admin/users/${r.userId}`)}
  />
)

export const Teachers = () => (
  <ResourcePage
    title="Teachers"
    load={loadTeachers}
    rowKey={(r) => r.teacherId}
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'employeeCode', label: 'Employee code' },
    ]}
    fields={[
      ...userFields,
      { name: 'employeeCode', label: 'Employee code' },
    ]}
    create={post('/api/admin/users', { role: 'TEACHER' })}
    update={editUser}
    remove={destroy((r) => `/api/admin/users/${r.userId}`)}
  />
)

export const Periods = () => (
  <ResourcePage
    title="Academic periods"
    load={loadPeriods}
    rowKey={(r) => r._id}
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'startDate', label: 'Start', render: (r) => fmt(r.startDate) },
      { key: 'endDate', label: 'End', render: (r) => fmt(r.endDate) },
    ]}
    fields={[
      { name: 'name', label: 'Name' },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'endDate', label: 'End date', type: 'date' },
    ]}
    create={post('/api/admin/academic-periods')}
  />
)

export const Branches = () => (
  <ResourcePage
    title="Branches"
    load={loadBranches}
    rowKey={(r) => r._id}
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
    ]}
    fields={[
      { name: 'name', label: 'Name' },
      { name: 'code', label: 'Code' },
    ]}
    create={post('/api/admin/branches')}
  />
)

export const Subjects = () => (
  <ResourcePage
    title="Subjects"
    load={loadSubjects}
    rowKey={(r) => r._id}
    columns={[
      { key: 'name', label: 'Name' },
      { key: 'code', label: 'Code' },
    ]}
    fields={[
      { name: 'name', label: 'Name' },
      { name: 'code', label: 'Code' },
    ]}
    create={post('/api/admin/subjects')}
    remove={destroy((r) => `/api/admin/subjects/${r._id}`)}
  />
)

export function Groups() {
  const [manage, setManage] = useState(null)
  return (
    <>
      <ResourcePage
        title="Groups"
        load={loadGroups}
        options={groupOptions}
        rowKey={(r) => r._id}
        columns={[
          { key: 'name', label: 'Group' },
          { key: 'p', label: 'Period', render: (r) => r.academicPeriodId?.name },
          { key: 'b', label: 'Branch', render: (r) => r.branchId?.code },
          { key: 's', label: 'Semester', render: (r) => r.semesterId?.name },
        ]}
        fields={[
          { name: 'name', label: 'Group name' },
          { name: 'academicPeriodId', label: 'Academic period', select: 'period' },
          { name: 'branchId', label: 'Branch', select: 'branch' },
          { name: 'semesterId', label: 'Semester', select: 'semester' },
        ]}
        create={post('/api/admin/groups')}
        remove={destroy((r) => `/api/admin/groups/${r._id}`)}
        rowActions={(r) => (
          <button className="btn sm" onClick={() => setManage(r)}>Manage</button>
        )}
      />
      {manage && <GroupManage group={manage} onClose={() => setManage(null)} />}
    </>
  )
}

const CHUNK = 20
const MAX_BYTES = 5 * 1024 * 1024

export function FacePhotos() {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [failed, setFailed] = useState([])

  async function run() {
    const all = [...input.current.files].filter((f) => f.type.startsWith('image/'))
    if (!all.length) return setStatus('Select a folder that contains images.')
    setBusy(true)
    setFailed([])
    const bad = []
    const files = all.filter(
      (f) => f.size <= MAX_BYTES || (bad.push({ file: f.name, reason: 'Larger than 5 MB' }), false)
    )
    let saved = 0
    for (let i = 0; i < files.length; i += CHUNK) {
      const chunk = files.slice(i, i + CHUNK)
      setStatus(`Uploading ${Math.min(i + CHUNK, files.length)} / ${files.length}`)
      const form = new FormData()
      chunk.forEach((f) => form.append('photos', f, f.name))
      try {
        const res = await fetch('/api/admin/students/face-photos', {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('sa_token')}` },
          body: form,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Upload failed')
        saved += data.saved
        bad.push(...data.failed)
      } catch (err) {
        chunk.forEach((f) => bad.push({ file: f.name, reason: err.message }))
      }
    }
    input.current.value = ''
    setFailed(bad)
    setStatus(`${saved} saved, ${bad.length} failed.`)
    setBusy(false)
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Face photos</h1>
          <p>Name each file with the student's roll number, e.g. 2410992624.jpg</p>
        </div>
      </div>
      <section className="panel">
        <div className="field">
          <label htmlFor="photos">Photos folder</label>
          <input id="photos" ref={input} type="file" accept="image/*" multiple webkitdirectory="" />
        </div>
        <button className="btn primary" disabled={busy} onClick={run}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
        {status && <p className="muted">{status}</p>}
        {failed.length > 0 && (
          <div className="tw">
            <table>
              <thead>
                <tr><th>File</th><th>Reason</th></tr>
              </thead>
              <tbody>
                {failed.map((f, i) => (
                  <tr key={i}><td>{f.file}</td><td>{f.reason}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
