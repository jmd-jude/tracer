import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { startSession, runChain } from '../api.js'

const STEPS = ['Retrieval', 'Reasoning', 'Generation']

export default function RunChain({ onComplete, viewSession }) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [error, setError] = useState(null)
  const [calls, setCalls] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [sessionId, setSessionId] = useState(null)
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  useEffect(() => {
    if (!viewSession) return
    setError(null)
    setPrompt(viewSession.prompt || '')
    setCalls(viewSession.calls)
    setExpanded({})
    setActiveStep(STEPS.length)
    setSessionId(viewSession.sessionId)
    setCopied(false)
  }, [viewSession?.sessionId])

  async function handleCopySessionId() {
    if (!sessionId) return
    await navigator.clipboard.writeText(sessionId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function handleRun() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setError(null)
    setCalls(null)
    setExpanded({})
    setActiveStep(0)

    let step = 0
    timerRef.current = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1)
      setActiveStep(step)
    }, 1400)

    try {
      const { session_id } = await startSession()
      setSessionId(session_id)
      setCopied(false)
      const { calls: result } = await runChain(session_id, prompt)
      clearInterval(timerRef.current)
      setActiveStep(STEPS.length)
      setCalls(result)
      onComplete({ sessionId: session_id, calls: result })
    } catch (err) {
      clearInterval(timerRef.current)
      setError(err.message)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="card panel">
      <div className="panel-header">
        <span className="label-caps">Run a Chain</span>
      </div>
      <div className="panel-body">
        <textarea
          className="input prompt-input"
          rows={4}
          placeholder="Describe the task for the chain to run..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
        />
        <button className="btn-primary run-btn" onClick={handleRun} disabled={running || !prompt.trim()}>
          {running ? 'Running...' : 'Run Tracer'}
        </button>

        {error && <p className="body-sm error-text">{error}</p>}

        {sessionId && (
          <div className="card-inner session-id-row">
            <span className="label-caps">Session ID</span>
            <div className="session-id-copy-row">
              <span className="mono session-id">{sessionId}</span>
              <button className="btn-secondary sdk-snippet-copy" onClick={handleCopySessionId}>
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="body-sm placeholder-text">
              Paste this into a PR or issue as <span className="mono">tracer-session: {'<id>'}</span> to
              auto-tag the outcome when GitHub reports it.
            </p>
          </div>
        )}

        {activeStep >= 0 && (
          <div className="step-list">
            {STEPS.map((label, i) => {
              const status =
                i < activeStep || calls ? 'done' : i === activeStep ? 'active' : 'pending'
              return (
                <div key={label} className={`step-row step-${status}`}>
                  <span className={`step-dot step-dot-${status}`} />
                  <span className="body-sm">{label}</span>
                  {status === 'active' && <span className="step-spinner" />}
                  {status === 'done' && calls && (
                    <span className="mono step-meta">
                      {calls[i].input_tokens + calls[i].output_tokens} tok · {calls[i].latency_ms}ms
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {calls && (
          <div className="card-inner call-log">
            <span className="label-caps">Call Log</span>
            {calls.map((c) => (
              <div key={c.call_order} className="call-log-entry">
                <div className="call-log-row">
                  <span className="body-sm call-log-label">{c.call_label}</span>
                  <span className="mono call-log-value">${c.token_cost.toFixed(5)}</span>
                  <span className="mono call-log-value">{c.latency_ms}ms</span>
                  <button
                    className="call-log-toggle"
                    onClick={() => setExpanded((prev) => ({ ...prev, [c.call_order]: !prev[c.call_order] }))}
                  >
                    {expanded[c.call_order] ? 'Hide output' : 'View output'}
                  </button>
                </div>
                {expanded[c.call_order] && (
                  <div className="card-inner call-log-output body-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{c.output_text}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
