import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js'

const MODEL_LABELS = {
  last_call: 'Last Call',
  even_split: 'Even Split',
  recency_weighted: 'Recency Weighted',
}
const MODEL_ORDER = ['last_call', 'even_split', 'recency_weighted']

function CreditedValue({ value }) {
  const animated = useAnimatedNumber(value)
  return <span className="mono">${animated.toFixed(2)}</span>
}

function CreditPct({ pct }) {
  const animated = useAnimatedNumber(pct * 100)
  return <span className="mono credit-pct">{animated.toFixed(0)}%</span>
}

function Roi({ value }) {
  const animated = useAnimatedNumber(value ?? 0)
  return <span className="mono">{animated.toFixed(2)}x</span>
}

export default function AttributionOutput({ data, model, onModelChange }) {
  if (!data) {
    return (
      <div className="card panel">
        <div className="panel-header">
          <span className="label-caps">Attribution Output</span>
        </div>
        <div className="panel-body">
          <p className="body-sm placeholder-text">
            Tag an outcome to see attribution across the call chain.
          </p>
        </div>
      </div>
    )
  }

  const rows = data.models[model]

  return (
    <div className="card panel">
      <div className="panel-header">
        <span className="label-caps">Attribution Output</span>
      </div>
      <div className="panel-body">
        <div className="model-toggle">
          {MODEL_ORDER.map((m) => (
            <button
              key={m}
              className={`model-toggle-option ${model === m ? 'model-toggle-selected' : ''}`}
              onClick={() => onModelChange(m)}
            >
              {MODEL_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="attribution-rows">
          {rows.map((row) => (
            <div key={row.call_order} className="card-inner attribution-row">
              <div className="attribution-row-top">
                <span className="body-sm">{row.call_label}</span>
                <CreditPct pct={row.credit_pct} />
              </div>
              <div className="attribution-bar-track">
                <div
                  className="attribution-bar-fill"
                  style={{ width: `${row.credit_pct * 100}%` }}
                />
              </div>
              <div className="attribution-row-bottom">
                <span className="mono attribution-cost">cost ${row.token_cost.toFixed(5)}</span>
                <span className="mono attribution-credited">
                  <CreditedValue value={row.credited_value} />
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="card-inner summary-block">
          <div className="summary-row">
            <span className="label-caps">Total Token Cost</span>
            <span className="mono">${data.total_cost.toFixed(5)}</span>
          </div>
          <div className="summary-row">
            <span className="label-caps">Total Credited Value</span>
            <span className="mono">${data.outcome_value.toFixed(2)}</span>
          </div>
          <div className="summary-row summary-row-roi">
            <span className="label-caps">Implied ROI</span>
            <Roi value={data.roi_multiple} />
          </div>
        </div>
      </div>
    </div>
  )
}
