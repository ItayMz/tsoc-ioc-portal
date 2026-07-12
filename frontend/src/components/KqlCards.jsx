import { useEffect, useRef, useState } from 'react'

import { getVisibleKqlCards } from '../services/kqlCardsPresentation.js'

const KQL_COPY_RESET_MS = 1800

function KqlCards({ queries }) {
  if (!queries) {
    return null
  }

  const queryCards = getVisibleKqlCards(queries)
  const [copiedByCard, setCopiedByCard] = useState({})
  const copyResetTimersRef = useRef({})

  useEffect(() => () => {
    Object.values(copyResetTimersRef.current).forEach((timerId) => {
      clearTimeout(timerId)
    })
  }, [])

  if (!queryCards.length) {
    return null
  }

  const copyQuery = async (cardKey, queryText) => {
    try {
      await navigator.clipboard.writeText(queryText)
      setCopiedByCard((current) => ({
        ...current,
        [cardKey]: true,
      }))

      if (copyResetTimersRef.current[cardKey]) {
        clearTimeout(copyResetTimersRef.current[cardKey])
      }

      copyResetTimersRef.current[cardKey] = setTimeout(() => {
        setCopiedByCard((current) => ({
          ...current,
          [cardKey]: false,
        }))
      }, KQL_COPY_RESET_MS)
    } catch {
      // Browsers can block clipboard in non-secure contexts.
    }
  }

  return (
    <section className="kql-grid">
      {queryCards.map((card) => (
        <article key={card.key} className="card kql-card">
          <div className="section-header">
            <h2>{card.title}</h2>
            <div className="kql-copy-actions">
              {copiedByCard[card.key] && <span className="kql-copy-confirmation">Copied!</span>}
              <button type="button" onClick={() => copyQuery(card.key, card.query)}>
                {copiedByCard[card.key] ? 'Copied ✓' : 'Copy KQL'}
              </button>
            </div>
          </div>
          <div className="meta-row">
            <span className="chip">IOC count: {card.count}</span>
            <span className="chip">Lookback: {card.lookbackDays}d</span>
            <span className="chip">Tables: {card.tables.join(', ')}</span>
          </div>
          <pre className="query-block">{card.query}</pre>
        </article>
      ))}
    </section>
  )
}

export default KqlCards
