function AnalystPlaybook({ playbook }) {
  if (!playbook?.sections?.length) {
    return null
  }

  return (
    <section className="card analyst-playbook" aria-live="polite">
      <div className="section-header">
        <h2>{playbook.title}</h2>
      </div>

      <div className="playbook-sections">
        {playbook.sections.map((section) => (
          <section key={section.heading} className="playbook-section">
            <h3 className="playbook-section-heading">{section.heading}</h3>
            <ol className="playbook-step-list">
              {section.steps.map((step) => (
                <li key={`${section.heading}-${step.number}`} value={step.number} className="playbook-step-item">
                  <span className="playbook-step-text">{step.text}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  )
}

export default AnalystPlaybook
