import Icon from './Icon.jsx'

function ExportSuccessBanner({ banner, isClosing = false, onClose }) {
  if (!banner) {
    return null
  }

  return (
    <section className={`card export-success-banner${isClosing ? ' export-success-banner-closing' : ''}`} role="status" aria-live="polite">
      <div className="export-success-header">
        <p className="export-success-title"><Icon name="summary" className="inline-icon" /> {banner.title}</p>
        <button type="button" className="export-success-close" aria-label="Dismiss export success message" onClick={onClose}>x</button>
      </div>
      <p className="muted export-success-details">{banner.details}</p>
    </section>
  )
}

export default ExportSuccessBanner
