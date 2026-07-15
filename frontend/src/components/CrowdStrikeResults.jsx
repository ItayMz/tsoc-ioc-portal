import CrowdStrikeQueryCard from './CrowdStrikeQueryCard'
import { buildCrowdStrikeAdvancedEventSearchQuery } from '../services/crowdstrikeQueryBuilder.js'

function CrowdStrikeResults({ indicators }) {
  const queryData = buildCrowdStrikeAdvancedEventSearchQuery(indicators)

  return (
    <>
      {queryData ? (
        <section className="kql-grid">
          <CrowdStrikeQueryCard queryData={queryData} />
        </section>
      ) : (
        <section className="card workflow-placeholder-card" aria-live="polite">
          <div className="section-header">
            <h2>CrowdStrike Workflow</h2>
          </div>
          <p className="muted">No valid indicators are currently available for a CrowdStrike Advanced Event Search query.</p>
        </section>
      )}

    </>
  )
}

export default CrowdStrikeResults