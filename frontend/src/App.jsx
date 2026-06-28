import { useState } from 'react'
import RunChain from './components/RunChain.jsx'
import TagOutcome from './components/TagOutcome.jsx'
import AttributionOutput from './components/AttributionOutput.jsx'
import { getAttribution } from './api.js'
import './App.css'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const [chainDone, setChainDone] = useState(false)
  const [attribution, setAttribution] = useState(null)
  const [model, setModel] = useState('last_call')

  function handleChainComplete({ sessionId: id }) {
    setSessionId(id)
    setChainDone(true)
    setAttribution(null)
  }

  async function handleTagged() {
    const data = await getAttribution(sessionId)
    setAttribution(data)
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Tracer</h1>
        <span className="body-sm app-subtitle">Token-level attribution for LLM workflows</span>
      </header>
      <main className="columns">
        <RunChain onComplete={handleChainComplete} />
        {chainDone ? (
          <TagOutcome sessionId={sessionId} onTagged={handleTagged} />
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
    </div>
  )
}
