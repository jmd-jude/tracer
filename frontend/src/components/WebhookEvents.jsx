import { useEffect, useState } from 'react'
import { listWebhookEvents } from '../api.js'

export default function WebhookEvents({ refreshKey }) {
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    listWebhookEvents().then(setEvents).catch((err) => setError(err.message))
  }, [refreshKey])

  return (
    <div className="card panel session-history">
      <div className="panel-header">
        <span className="label-caps">Webhook Events</span>
      </div>
      <div className="panel-body">
        {error && <p className="body-sm error-text">{error}</p>}

        {!error && events.length === 0 && (
          <p className="body-sm placeholder-text">
            Inbound GitHub events will show up here once the webhook is wired up.
          </p>
        )}

        {events.length > 0 && (
          <table className="session-table">
            <thead>
              <tr>
                <th className="label-caps">Received</th>
                <th className="label-caps">Event</th>
                <th className="label-caps">Session</th>
                <th className="label-caps">Outcome Tagged</th>
                <th className="label-caps">Status</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="session-row">
                  <td className="mono session-table-time">
                    {new Date(e.received_at).toLocaleString()}
                  </td>
                  <td className="body-sm">{e.event_type}</td>
                  <td className="mono session-table-id">
                    {e.session_id_extracted ? e.session_id_extracted.slice(0, 8) : '—'}
                  </td>
                  <td className="body-sm">{e.outcome_tagged ?? '—'}</td>
                  <td>
                    <span className={`badge ${e.outcome_tagged ? 'badge-green' : ''}`}>
                      {e.outcome_tagged ? 'auto-tagged' : 'no session match'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
