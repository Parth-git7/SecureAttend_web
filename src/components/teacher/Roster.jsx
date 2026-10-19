const STATUS_LABEL = {
  ABSENT: 'Absent',
  JOINED: 'Joined',
  PRESENT: 'Present',
  REVIEW: 'Review',
}

export default function Roster({ students, phase, onMark }) {
  const ended = phase === 'ENDED'

  const present = students.filter((s) => s.status === 'PRESENT').length
  const total = students.length
  const pct = total ? Math.round((present / total) * 100) : 0

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Student Roster</h2>
        {total > 0 && (
          <span style={{ fontSize: 13.5, color: 'var(--muted)', fontWeight: 500 }}>
            <strong style={{ color: 'var(--ink)' }}>{present}</strong> / {total} present ({pct}%)
          </span>
        )}
      </div>

      {total > 0 && (
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
      )}

      {students.length === 0 ? (
        <p className="empty">No students have joined yet.</p>
      ) : (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Enrollment No.</th>
                <th>Status</th>
                {!ended && <th className="act-c">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.studentId} className={s.status === 'REVIEW' ? 'review' : ''}>
                  <td>{i + 1}</td>
                  <td>
                    <span className="by">{s.name}</span>
                    {s.status === 'REVIEW' && (
                      <div className="note">⚠ Flagged for review — location or face mismatch</div>
                    )}
                  </td>
                  <td>{(s.rollNo ?? s.enrollmentNo) || '—'}</td>
                  <td>
                    <span className={`badge roster-badge b-${s.status}`}>{STATUS_LABEL[s.status] ?? s.status}</span>
                  </td>
                  {!ended && (
                    <td className="act act-c">
                      {s.status !== 'PRESENT' && (
                        <button className="btn sm ok" onClick={() => onMark(s.studentId, 'PRESENT')}>
                          Mark Present
                        </button>
                      )}
                      {s.status !== 'ABSENT' && (
                        <button
                          className="btn sm bad"
                          style={{ marginLeft: s.status !== 'PRESENT' ? 6 : 0 }}
                          onClick={() => onMark(s.studentId, 'ABSENT')}
                        >
                          Mark Absent
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
