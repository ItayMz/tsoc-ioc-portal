import Icon from './Icon.jsx'

function getEntryIconName(type) {
  if (type === 'defender') {
    return 'defender'
  }

  if (type === 'crowdstrike') {
    return 'crowdstrike'
  }

  if (type === 'qradar') {
    return 'qradar'
  }

  return 'export'
}

function ExportSummaryCards({ summaries }) {
  if (!summaries.length) {
    return null
  }

  return (
    <section className="card export-summary-card" aria-live="polite">
      <div className="section-header">
        <h2><Icon name="export" className="inline-icon" /> Export Summary</h2>
      </div>
      <div className="export-summary-grid">
        {summaries.map((entry) => (
          <article key={entry.type} className="summary-item">
            <p><Icon name={getEntryIconName(entry.type)} className="inline-icon" /> {entry.title}</p>
            <strong>{entry.countLabel ? `${entry.count} ${entry.countLabel}` : entry.count}</strong>
            <p className="summary-meta">Filename: <strong>{entry.filename}</strong></p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default ExportSummaryCards
