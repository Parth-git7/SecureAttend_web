import { useEffect, useState } from 'react'
import { api } from '../api'

const EMPTY = { branches: [], semesters: [], groups: [], subjects: [] }

export default function AttendanceForm({ busy, onStart, onMessage, onError }) {
  const [periods, setPeriods] = useState([])
  const [opts, setOpts] = useState(EMPTY)
  const [sel, setSel] = useState({ period: '', branch: '', semester: '', group: '', subject: '' })

  async function run(fn) {
    try {
      await fn()
    } catch (err) {
      onError(err)
    }
  }

  async function pickPeriod(period) {
    setSel({ period, branch: '', semester: '', group: '', subject: '' })
    setOpts(EMPTY)
    onMessage(null)
    if (!period) return
    await run(async () => {
      const { branches } = await api(`/api/academic/academic-periods/${period}/branches`)
      setOpts({ ...EMPTY, branches })
      if (!branches.length) onMessage('No groups exist for this academic period yet.', 'info')
    })
  }

  async function pickBranch(branch) {
    setSel((s) => ({ ...s, branch, semester: '', group: '', subject: '' }))
    setOpts((o) => ({ ...o, semesters: [], groups: [], subjects: [] }))
    if (!branch) return
    await run(async () => {
      const { semesters } = await api(
        `/api/academic/academic-periods/${sel.period}/semesters?branchId=${branch}`
      )
      setOpts((o) => ({ ...o, semesters }))
    })
  }

  async function pickSemester(semester) {
    setSel((s) => ({ ...s, semester, group: '', subject: '' }))
    setOpts((o) => ({ ...o, groups: [], subjects: [] }))
    if (!semester) return
    await run(async () => {
      const { groups } = await api(
        `/api/academic/academic-periods/${sel.period}/groups?branchId=${sel.branch}&semesterId=${semester}`
      )
      setOpts((o) => ({ ...o, groups }))
    })
  }

  async function pickGroup(group) {
    setSel((s) => ({ ...s, group, subject: '' }))
    setOpts((o) => ({ ...o, subjects: [] }))
    onMessage(null)
    if (!group) return
    await run(async () => {
      const { subjects } = await api(`/api/academic/groups/${group}/subjects`)
      setOpts((o) => ({ ...o, subjects }))
      if (!subjects.length) onMessage('No subjects are assigned to this group.', 'info')
    })
  }

  useEffect(() => {
    let cancelled = false
    api('/api/academic/academic-periods')
      .then((data) => {
        if (cancelled) return
        setPeriods(data.academicPeriods)
        if (data.currentPeriodId) pickPeriod(data.currentPeriodId)
      })
      .catch(onError)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function submit(e) {
    e.preventDefault()
    if (!sel.group || !sel.subject) {
      onMessage('Please select a group and subject.', 'error')
      return
    }
    onStart(sel.group, sel.subject)
  }

  const fields = [
    ['period', 'Academic Period', periods, (p) => p._id, (p) => p.name, pickPeriod],
    ['branch', 'Branch', opts.branches, (b) => b._id, (b) => `${b.name} (${b.code})`, pickBranch],
    ['semester', 'Semester', opts.semesters, (s) => s._id, (s) => s.name, pickSemester],
    ['group', 'Group', opts.groups, (g) => g._id, (g) => g.name, pickGroup],
    ['subject', 'Subject', opts.subjects, (s) => s.subjectId, (s) => `${s.name} (${s.code})`, (v) =>
      setSel((s) => ({ ...s, subject: v })),
    ],
  ]

  return (
    <form className="panel" onSubmit={submit}>
      <div className="panel-head">
        <h2>Take Attendance</h2>
      </div>
      <div className="grid">
        {fields.map(([key, label, items, val, txt, onChange]) => (
          <div key={key}>
            <label htmlFor={key}>{label}</label>
            <select
              id={key}
              value={sel[key]}
              disabled={!items.length}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">Select {label.toLowerCase()}</option>
              {items.map((x) => (
                <option key={val(x)} value={val(x)}>
                  {txt(x)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <button type="submit" className="btn primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create Session'}
      </button>
    </form>
  )
}
