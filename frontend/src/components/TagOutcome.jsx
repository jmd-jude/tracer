import { useEffect, useState } from 'react'
import { listOutcomes, tagOutcome } from '../api.js'

export default function TagOutcome({ sessionId, onTagged }) {
  const [outcomes, setOutcomes] = useState([])
  const [selected, setSelected] = useState(null)
  const [tagging, setTagging] = useState(false)
  const [tagged, setTagged] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listOutcomes().then(setOutcomes).catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setTagged(null)
    setSelected(null)
  }, [sessionId])

  async function handleTag() {
    if (!selected) return
    setTagging(true)
    setError(null)
    try {
      const result = await tagOutcome(sessionId, selected)
      setTagged(result)
      onTagged(result)
    } catch (err) {
      setError(err.message)
    } finally {
      setTagging(false)
    }
  }

  const selectedOutcome = outcomes.find((o) => o.outcome_type === selected)

  return (
    <div className="card panel">
      <div className="panel-header">
        <span className="label-caps">Tag Outcome</span>
      </div>
      <div className="panel-body">
        <div className="outcome-options">
          {outcomes.map((o) => (
            <button
              key={o.outcome_type}
              className={`outcome-option ${selected === o.outcome_type ? 'outcome-option-selected' : ''}`}
              onClick={() => setSelected(o.outcome_type)}
              disabled={!!tagged}
            >
              <span className="body-sm">{o.label}</span>
              <span className="mono outcome-value">${o.value}</span>
            </button>
          ))}
        </div>

        {error && <p className="body-sm error-text">{error}</p>}

        {!tagged ? (
          <button className="btn-primary" onClick={handleTag} disabled={!selected || tagging}>
            {tagging ? 'Tagging...' : 'Tag Outcome'}
          </button>
        ) : (
          <div className="card-inner tag-confirm">
            <span className="badge badge-green">Tagged: {tagged.outcome_label}</span>
            <div className="session-id-row">
              <span className="label-caps">Session ID</span>
              <span className="mono session-id">{sessionId}</span>
            </div>
          </div>
        )}

        {selectedOutcome && !tagged && (
          <p className="body-sm outcome-preview">
            Outcome value: <span className="mono">${selectedOutcome.value}</span>
          </p>
        )}
      </div>
    </div>
  )
}
