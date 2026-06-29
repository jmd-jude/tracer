import { useEffect, useState } from 'react'
import { listSessions } from '../api.js'

export default function SessionHistory({ onSelect, refreshKey }) {
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    listSessions().then(setSessions).catch((err) => setError(err.message))
  }, [refreshKey])

  return (
    <div className="card panel session-history">
      <div className="panel-header">
        <span className="label-caps">Recent Sessions</span>
      </div>
      <div className="panel-body">
        {error && <p className="body-sm error-text">{error}</p>}

        {!error && sessions.length === 0 && (
          <p className="body-sm placeholder-text">
            Tagged sessions will show up here once you run a chain and tag an outcome.
          </p>
        )}

        {sessions.length > 0 && (
          <table className="session-table">
            <thead>
              <tr>
                <th className="label-caps">Session</th>
                <th className="label-caps">Prompt</th>
                <th className="label-caps">Outcome</th>
                <th className="label-caps">Implied ROI</th>
                <th className="label-caps">Tagged</th>
                <th className="label-caps">Source</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.session_id}
                  className="session-row"
                  onClick={() => onSelect(s.session_id)}
                >
                  <td className="mono session-table-id">{s.session_id.slice(0, 8)}</td>
                  <td className="body-sm">{s.prompt_snippet}</td>
                  <td className="body-sm">{s.outcome_label}</td>
                  <td className="mono session-table-roi">
                    {s.roi_multiple != null ? `${s.roi_multiple.toFixed(2)}x` : '—'}
                  </td>
                  <td className="mono session-table-time">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                  <td>
                    <span className={`badge ${s.tagged_via === 'auto' ? 'badge-green' : ''}`}>
                      {s.tagged_via === 'auto' ? 'auto' : 'manual'}
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
