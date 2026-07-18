function AdditionalInvestigationCard({ message }) {
  if (!message) {
    return null
  }

  return (
    <section className="card additional-investigation-card" aria-live="polite">
      <div className="section-header">
        <h2>Additional Investigation Required</h2>
      </div>
      <p className="muted additional-investigation-message">{message}</p>
    </section>
  )
}

export default AdditionalInvestigationCard
