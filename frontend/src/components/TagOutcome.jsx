import { useEffect, useState } from 'react'
import { listOutcomes, tagOutcome } from '../api.js'

export default function TagOutcome({ sessionId, calls, initialTagged, onTagged }) {
  const [outcomes, setOutcomes] = useState([])
  const [selected, setSelected] = useState(null)
  const [tagging, setTagging] = useState(false)
  const [tagged, setTagged] = useState(null)
  const [error, setError] = useState(null)
  const [sdkExpanded, setSdkExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    listOutcomes().then(setOutcomes).catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    setTagged(initialTagged || null)
    setSelected(null)
    setSdkExpanded(false)
    setCopied(false)
  }, [sessionId, initialTagged])

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
  const retrievalCost = calls?.[0]?.token_cost ?? 0

  const snippet = tagged
    ? [
        `trace.start("${sessionId}")`,
        `trace.log_call("${sessionId}", "retrieval", ${retrievalCost.toFixed(5)}, "claude-sonnet-4-6")`,
        `trace.tag_outcome("${sessionId}", "${tagged.outcome_type}", ${tagged.outcome_value})`,
      ].join('\n')
    : ''

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

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

        {tagged && (
          <div className="sdk-snippet">
            <button className="sdk-snippet-toggle" onClick={() => setSdkExpanded((v) => !v)}>
              <span className="label-caps">How this session was instrumented</span>
              <span className="mono sdk-snippet-chevron">{sdkExpanded ? '−' : '+'}</span>
            </button>
            {sdkExpanded && (
              <div className="code-block sdk-snippet-body">
                <pre className="sdk-snippet-code">{snippet}</pre>
                <button className="btn-secondary sdk-snippet-copy" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
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
