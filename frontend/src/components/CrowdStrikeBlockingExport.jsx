import {
  buildCrowdStrikeBlockingCsv,
  getCrowdStrikeTotalDetectedCount,
} from '../services/crowdstrikeBlockingExport.js'

function CrowdStrikeBlockingExport({ indicators, severity, description, onSeverityChange, onDescriptionChange }) {
  const exportData = buildCrowdStrikeBlockingCsv(indicators, { severity, description })
  const eligibleCount = exportData?.rows?.length || 0
  const totalDetectedCount = getCrowdStrikeTotalDetectedCount(indicators)
  const canExport = eligibleCount > 0

  return (
    <section className="card crowdstrike-export-card" aria-live="polite">
      <div className="section-header">
        <h2>CrowdStrike Blocking Export</h2>
      </div>
      <p className="muted">Only IPv4, MD5, and SHA256 indicators are included in the CrowdStrike blocking CSV.</p>

      <div className="control-row">
        <label className="field-label" htmlFor="crowdstrikeSeverity">Severity</label>
        <select
          id="crowdstrikeSeverity"
          className="lookback-select"
          value={severity}
          onChange={(event) => onSeverityChange(event.target.value)}
        >
          <option value="high">high</option>
          <option value="medium">medium</option>
        </select>
      </div>

      <div className="control-row control-row-column">
        <label className="field-label" htmlFor="crowdstrikeDescription">Description</label>
        <textarea
          id="crowdstrikeDescription"
          className="ioc-textarea crowdstrike-description"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Optional description applied to every exported row"
        />
      </div>

      <div className="meta-row">
        <span className="chip">Total detected: {totalDetectedCount}</span>
        <span className="chip">Blocking eligible: {eligibleCount}</span>
      </div>

      <p className="muted">
        Only IPv4, MD5, and SHA256 indicators are eligible for CrowdStrike blocking. All other indicators are included in the Advanced Event Search query only.
      </p>

      {!canExport && (
        <p className="muted crowdstrike-export-empty-message">
          No IPv4, MD5, or SHA256 indicators are available for CrowdStrike blocking export.
        </p>
      )}
    </section>
  )
}

export default CrowdStrikeBlockingExport