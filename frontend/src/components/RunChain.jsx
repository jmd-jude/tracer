import { useEffect, useRef, useState } from 'react'
import { startSession, runChain } from '../api.js'

const STEPS = ['Retrieval', 'Reasoning', 'Generation']

export default function RunChain({ onComplete }) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  const [error, setError] = useState(null)
  const [calls, setCalls] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => () => clearInterval(timerRef.current), [])

  async function handleRun() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setError(null)
    setCalls(null)
    setActiveStep(0)

    let step = 0
    timerRef.current = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1)
      setActiveStep(step)
    }, 1400)

    try {
      const { session_id } = await startSession()
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
              <div key={c.call_order} className="call-log-row">
                <span className="body-sm call-log-label">{c.call_label}</span>
                <span className="mono call-log-value">${c.token_cost.toFixed(5)}</span>
                <span className="mono call-log-value">{c.latency_ms}ms</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
