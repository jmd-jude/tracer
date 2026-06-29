const BASE = '/api'

async function request(path, options) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const startSession = () => request('/session/start', { method: 'POST' })

export const runChain = (sessionId, prompt) =>
  request('/chain/run', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, prompt }),
  })

export const tagOutcome = (sessionId, outcomeType) =>
  request('/outcome/tag', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, outcome_type: outcomeType }),
  })

export const getAttribution = (sessionId) => request(`/attribution/${sessionId}`)

export const listOutcomes = () => request('/outcomes')

export const listSessions = () => request('/sessions')

export const listWebhookEvents = () => request('/webhook/events')
