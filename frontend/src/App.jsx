import { useState } from 'react'
import RunChain from './components/RunChain.jsx'
import TagOutcome from './components/TagOutcome.jsx'
import AttributionOutput from './components/AttributionOutput.jsx'
import SessionHistory from './components/SessionHistory.jsx'
import WebhookEvents from './components/WebhookEvents.jsx'
import OutcomeLibrary from './components/OutcomeLibrary.jsx'
import { getAttribution } from './api.js'
import './App.css'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [chainDone, setChainDone] = useState(false)
  const [calls, setCalls] = useState(null)
  const [viewSession, setViewSession] = useState(null)
  const [initialTagged, setInitialTagged] = useState(null)
  const [attribution, setAttribution] = useState(null)
  const [model, setModel] = useState('last_call')
  const [historyKey, setHistoryKey] = useState(0)

  function handleChainComplete({ sessionId: id, calls: result }) {
    setSessionId(id)
    setCalls(result)
    setChainDone(true)
    setAttribution(null)
    setViewSession(null)
    setInitialTagged(null)
  }

  async function handleTagged() {
    const data = await getAttribution(sessionId)
    setAttribution(data)
    setHistoryKey((k) => k + 1)
  }

  async function handleSelectSession(id) {
    const data = await getAttribution(id)
    setAttribution(data)
    setSessionId(id)
    setCalls(data.calls)
    setChainDone(true)
    setViewSession({ sessionId: id, prompt: data.prompt, calls: data.calls })
    setInitialTagged({
      session_id: id,
      outcome_type: data.outcome_type,
      outcome_label: data.outcome_label,
      outcome_value: data.outcome_value,
    })
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Tracer</h1>
        <span className="body-sm app-subtitle">Token-level attribution for LLM workflows</span>
      </header>
      <main className="columns">
        <RunChain onComplete={handleChainComplete} viewSession={viewSession} />
        {chainDone ? (
          <TagOutcome
            sessionId={sessionId}
            calls={calls}
            initialTagged={initialTagged}
            onTagged={handleTagged}
            refreshKey={historyKey}
          />
        ) : (
          <div className="card panel">
            <div className="panel-header">
              <span className="label-caps">Tag Outcome</span>
            </div>
            <div className="panel-body">
              <p className="body-sm placeholder-text">
                Run a chain to tag a business outcome against it.
              </p>
            </div>
          </div>
        )}
        <AttributionOutput data={attribution} model={model} onModelChange={setModel} />
      </main>
      <SessionHistory onSelect={handleSelectSession} refreshKey={historyKey} />
      <WebhookEvents refreshKey={historyKey} />
      <OutcomeLibrary onChange={() => setHistoryKey((k) => k + 1)} />
    </div>
  )
}
