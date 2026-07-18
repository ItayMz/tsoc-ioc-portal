import { buildDetectionSummary } from '../services/summaryPresentation.js'
import Icon from './Icon.jsx'

function SummaryCards({ summary, exportEligibility = null }) {
  const detectionSummary = buildDetectionSummary(summary)
  if (!detectionSummary) {
    return null
  }

  return (
    <section className="card detection-summary" aria-live="polite">
      <div className="section-header">
        <h2><Icon name="summary" className="inline-icon" /> {detectionSummary.title}</h2>
      </div>

      <div className="summary-total-wrap">
        <article className="summary-item summary-item-total">
          <p>Total Detected</p>
          <strong>{detectionSummary.totalDetected}</strong>
        </article>
      </div>

      <div className="summary-grid">
        {detectionSummary.breakdown.map((item) => (
          <article key={item.label} className={`summary-item${item.isMuted ? ' summary-item-muted' : ''}`}>
            <p>{item.label}</p>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>

      {detectionSummary.meta.length > 0 && (
        <div className="summary-meta-row">
          {detectionSummary.meta.map((entry) => (
            <p key={entry.label} className="summary-meta">
              <span>{entry.label}:</span> <strong>{entry.value}</strong>
            </p>
          ))}
        </div>
      )}

      {exportEligibility && (
        <>
          <div className="section-header summary-subsection-header">
            <h2>Export Eligibility</h2>
          </div>
          <div className="summary-grid">
            <article className="summary-item">
              <p>CrowdStrike Blocking Eligible</p>
              <strong>{exportEligibility.crowdStrikeBlockingEligible}</strong>
            </article>
            <article className="summary-item">
              <p>QRadar Eligible IPs</p>
              <strong>{exportEligibility.qradarEligibleIps}</strong>
            </article>
          </div>
          <p className="muted summary-note">
            Only IPv4, MD5, and SHA256 indicators are eligible for CrowdStrike blocking. All other indicators are included in the Advanced Event Search query only.
          </p>
        </>
      )}
    </section>
  )
}

export default SummaryCards
