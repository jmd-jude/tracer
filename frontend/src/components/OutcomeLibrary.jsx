import { useEffect, useState } from 'react'
import { listOutcomeTypes, createOutcomeType, updateOutcomeType, deleteOutcomeType } from '../api.js'

const KEY_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/
const EMPTY_FORM = { outcome_key: '', label: '', value: '', webhook_event: '' }

export default function OutcomeLibrary({ onChange }) {
  const [outcomes, setOutcomes] = useState([])
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingKey, setEditingKey] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function load() {
    listOutcomeTypes().then(setOutcomes).catch((err) => setError(err.message))
  }

  useEffect(load, [])

  function startEdit(o) {
    setEditingKey(o.outcome_key)
    setForm({
      outcome_key: o.outcome_key,
      label: o.label,
      value: String(o.value),
      webhook_event: o.webhook_event || '',
    })
    setFormError(null)
    setError(null)
  }

  function cancelEdit() {
    setEditingKey(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function handleKeyChange(e) {
    const v = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setForm((f) => ({ ...f, outcome_key: v }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)

    if (!KEY_RE.test(form.outcome_key)) {
      setFormError('Outcome key must be lowercase letters, numbers, and underscores only.')
      return
    }
    if (!form.label.trim()) {
      setFormError('Label is required.')
      return
    }
    const value = Number(form.value)
    if (!Number.isFinite(value) || value < 0) {
      setFormError('Value must be a non-negative number.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        label: form.label.trim(),
        value,
        webhook_event: form.webhook_event.trim() || null,
      }
      if (editingKey) {
        await updateOutcomeType(editingKey, payload)
      } else {
        await createOutcomeType({ outcome_key: form.outcome_key, ...payload })
      }
      cancelEdit()
      load()
      onChange?.()
    } catch (err) {
      setFormError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(key) {
    setError(null)
    try {
      await deleteOutcomeType(key)
      load()
      onChange?.()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card panel outcome-library">
      <div className="panel-header">
        <span className="label-caps">Outcome Library</span>
      </div>
      <div className="panel-body">
        {error && <p className="body-sm error-text">{error}</p>}

        {outcomes.length > 0 && (
          <table className="session-table">
            <thead>
              <tr>
                <th className="label-caps">Key</th>
                <th className="label-caps">Label</th>
                <th className="label-caps">Value</th>
                <th className="label-caps">Webhook Event</th>
                <th className="label-caps">Actions</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.outcome_key} className="session-row" style={{ cursor: 'default' }}>
                  <td className="mono">{o.outcome_key}</td>
                  <td className="body-sm">{o.label}</td>
                  <td className="mono">${o.value}</td>
                  <td className="body-sm">
                    {o.webhook_event ? (
                      <span className="mono">{o.webhook_event}</span>
                    ) : (
                      <span className="badge">manual only</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn-secondary outcome-library-action"
                      onClick={() => startEdit(o)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn-secondary outcome-library-action"
                      onClick={() => handleDelete(o.outcome_key)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form className="outcome-library-form" onSubmit={handleSubmit}>
          <span className="label-caps">{editingKey ? `Edit: ${editingKey}` : 'Add Outcome Type'}</span>

          <div className="outcome-library-form-row">
            <input
              className="input"
              placeholder="outcome_key"
              value={form.outcome_key}
              onChange={handleKeyChange}
              disabled={!!editingKey}
            />
            <input
              className="input"
              placeholder="Label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            />
            <input
              className="input"
              type="number"
              placeholder="Value ($)"
              value={form.value}
              min="0"
              step="any"
              onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Webhook event (optional)"
              value={form.webhook_event}
              onChange={(e) => setForm((f) => ({ ...f, webhook_event: e.target.value }))}
            />
          </div>

          <p className="body-sm placeholder-text">
            Supported webhook patterns:{' '}
            <span className="mono">pull_request:merged</span>,{' '}
            <span className="mono">pull_request_review:approved</span>,{' '}
            <span className="mono">issues:closed:bug</span>. Leave blank for manual-only outcomes.
          </p>

          {formError && <p className="body-sm error-text">{formError}</p>}

          <div className="outcome-library-form-actions">
            <button className="btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingKey ? 'Save Changes' : 'Add Outcome'}
            </button>
            {editingKey && (
              <button className="btn-secondary" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
