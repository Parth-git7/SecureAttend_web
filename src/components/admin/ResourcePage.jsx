import { useCallback, useEffect, useState } from 'react'
import { Modal } from './ui'

// `load` and `options` must be module-level functions (stable identity)
export default function ResourcePage({
  title,
  hint,
  load,
  options,
  columns,
  fields = [],
  rowKey,
  create,
  update,
  remove,
  rowActions,
}) {
  const [rows, setRows] = useState(null)
  const [opts, setOpts] = useState({})
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setRows(await load())
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [load])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => { options?.().then(setOpts).catch(() => {}) }, [options])

  const visible = (f) => !form?.row || f.editable

  function open(row) {
    const src = fields.filter((f) => !row || f.editable)
    setFormError('')
    setForm({
      row,
      values: Object.fromEntries(src.map((f) => [f.name, row?.[f.name] ?? ''])),
    })
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await (form.row ? update(form.row, form.values) : create(form.values))
      setForm(null)
      await refresh()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function del(row) {
    if (!window.confirm('Delete this record? This cannot be undone.')) return
    try {
      await remove(row)
      await refresh()
    } catch (e) {
      setError(e.message)
    }
  }

  const span = columns.length + 1

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          {hint && <p>{hint}</p>}
        </div>
        {create && (
          <button className="btn primary" onClick={() => open(null)}>Add</button>
        )}
      </div>

      {error && <div className="msg error">{error}</div>}

      <section className="panel flush">
        <div className="tw">
          <table>
            <thead>
              <tr>
                {columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows === null && (
                <tr><td colSpan={span} className="empty">Loading…</td></tr>
              )}
              {rows?.length === 0 && (
                <tr><td colSpan={span} className="empty">Nothing here yet.</td></tr>
              )}
              {rows?.map((r) => (
                <tr key={rowKey(r)}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
                  ))}
                  <td className="act">
                    {rowActions?.(r, refresh)}
                    {update && (
                      <button className="btn sm" onClick={() => open(r)}>Edit</button>
                    )}
                    {remove && (
                      <button className="btn sm bad" onClick={() => del(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {form && (
        <Modal
          title={form.row ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}
          onClose={() => setForm(null)}
        >
          <form onSubmit={submit}>
            {formError && <div className="msg error">{formError}</div>}
            {fields.filter(visible).map((f) => (
              <div className="field" key={f.name}>
                <label htmlFor={f.name}>{f.label}</label>
                {f.select ? (
                  <select
                    id={f.name}
                    required
                    value={form.values[f.name]}
                    onChange={(e) =>
                      setForm({ ...form, values: { ...form.values, [f.name]: e.target.value } })
                    }
                  >
                    <option value="">Select…</option>
                    {(opts[f.select] || []).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={f.name}
                    type={f.type || 'text'}
                    required
                    value={form.values[f.name]}
                    onChange={(e) =>
                      setForm({ ...form, values: { ...form.values, [f.name]: e.target.value } })
                    }
                  />
                )}
              </div>
            ))}
            <div className="form-actions">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button className="btn primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
