import Icon from './Icon.jsx'

function AboutDialog({ open, onClose }) {
  if (!open) {
    return null
  }

  return (
    <div className="about-overlay" role="presentation" onClick={onClose}>
      <section
        className="about-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aboutTitle"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="about-header-row">
          <div>
            <p className="eyebrow">Built for SOC Operations</p>
            <h2 id="aboutTitle"><Icon name="about" className="inline-icon" /> IOC Workbench</h2>
            <p className="muted">Version 1.3</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close About dialog">Close</button>
        </div>

        <div className="about-section">
          <h3>Supported Platforms</h3>
          <p>✓ <Icon name="defender" className="inline-icon" /> Microsoft Defender</p>
          <p>✓ <Icon name="crowdstrike" className="inline-icon" /> CrowdStrike Falcon</p>
          <p>✓ <Icon name="qradar" className="inline-icon" /> IBM QRadar</p>
        </div>

        <div className="about-section">
          <h3><Icon name="keyboard" className="inline-icon" /> Keyboard Shortcuts</h3>
          <p><strong>Ctrl + Enter</strong> Analyze IOCs</p>
          <p><strong>Ctrl + Shift + U</strong> Open File Picker</p>
          <p><strong>Esc</strong> Clear</p>
        </div>

        <div className="about-section">
          <h3>Developed by</h3>
          <p>Itay Mazor</p>
        </div>
      </section>
    </div>
  )
}

export default AboutDialog
