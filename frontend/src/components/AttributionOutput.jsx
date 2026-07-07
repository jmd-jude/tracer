import { useAnimatedNumber } from '../hooks/useAnimatedNumber.js'

function RoiHero({ value }) {
  const animated = useAnimatedNumber(value ?? 0)
  return (
    <span className="roi-hero-number mono">
      {Math.round(animated).toLocaleString()}x
    </span>
  )
}

export default function AttributionOutput({ data }) {
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

  const callCount = data.models.even_split.length

  return (
    <div className="card panel">
      <div className="panel-header">
        <span className="label-caps">Attribution Output</span>
      </div>
      <div className="panel-body">
        <div className="roi-hero">
          <RoiHero value={data.roi_multiple} />
          <span className="label-caps">implied ROI</span>
          <div className="roi-cost-value">
            <span className="mono">${data.total_cost.toFixed(4)}</span>
            <span className="roi-arrow">→</span>
            <span className="mono">${data.outcome_value.toFixed(2)}</span>
          </div>
        </div>
        <p className="body-sm roi-footnote">
          even-split attribution across {callCount} calls
        </p>
      </div>
    </div>
  )
}
