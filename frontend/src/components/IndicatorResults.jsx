import { useEffect, useMemo, useRef, useState } from 'react'
import {
  buildCopyAllPayload,
  buildGroupCopyPayload,
  DETECTED_EMPTY_MESSAGE,
  getCopyAllSuccessMessage,
  getGroupCopySuccessMessage,
  getDetectedIndicators,
  getInitialExpandedGroups,
  getIndicatorDisplayValue,
  INDICATOR_COPY_ERROR_MESSAGE,
  groupDetectedIndicatorsByType,
  INDICATOR_DISPLAY_MODE,
  syncExpandedGroups,
  toggleGroupExpanded,
} from '../services/indicatorPresentation.js'

const TOAST_AUTO_HIDE_MS = 2200

function toGroupElementId(label) {
  return `group-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function IndicatorResults({ indicators }) {
  const detected = getDetectedIndicators(indicators)
  const groupedIndicators = useMemo(() => groupDetectedIndicatorsByType(detected), [detected])
  const [displayMode, setDisplayMode] = useState(INDICATOR_DISPLAY_MODE.REFANGED)
  const [expandedGroups, setExpandedGroups] = useState(() => getInitialExpandedGroups(groupedIndicators))
  const [copyToast, setCopyToast] = useState(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    setExpandedGroups((current) => syncExpandedGroups(current, groupedIndicators))
  }, [groupedIndicators])

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }
  }, [])

  const showToast = (message, tone) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    setCopyToast({ message, tone })
    toastTimerRef.current = setTimeout(() => {
      setCopyToast(null)
    }, TOAST_AUTO_HIDE_MS)
  }

  const copyText = async (text) => {
    if (!text) {
      return false
    }

    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  const copyAllIndicators = async () => {
    const payload = buildCopyAllPayload(groupedIndicators, displayMode)
    const copied = await copyText(payload)

    if (!copied) {
      showToast(INDICATOR_COPY_ERROR_MESSAGE, 'error')
      return
    }

    showToast(getCopyAllSuccessMessage(groupedCount), 'success')
  }

  const copySingleGroup = async (group) => {
    const payload = buildGroupCopyPayload(group, displayMode)
    const copied = await copyText(payload)

    if (!copied) {
      showToast(INDICATOR_COPY_ERROR_MESSAGE, 'error')
      return
    }

    showToast(getGroupCopySuccessMessage(group.label, group.items.length), 'success')
  }

  const groupedCount = groupedIndicators.reduce((acc, group) => acc + group.items.length, 0)

  return (
    <section className="card">
      <div className="section-header">
        <h2>Detected Indicators</h2>
        <span className="chip">{groupedCount} indicators</span>
      </div>

      <div className="indicator-controls">
        <div className="indicator-mode-toggle" role="group" aria-label="Detected indicator view mode">
          <button
            type="button"
            className={`mode-toggle-button${displayMode === INDICATOR_DISPLAY_MODE.ORIGINAL ? ' active' : ''}`}
            onClick={() => setDisplayMode(INDICATOR_DISPLAY_MODE.ORIGINAL)}
          >
            Show Original
          </button>
          <button
            type="button"
            className={`mode-toggle-button${displayMode === INDICATOR_DISPLAY_MODE.REFANGED ? ' active' : ''}`}
            onClick={() => setDisplayMode(INDICATOR_DISPLAY_MODE.REFANGED)}
          >
            Show Refanged
          </button>
        </div>

        <button type="button" className="copy-all-button" onClick={copyAllIndicators} disabled={!groupedCount}>
          Copy All
        </button>
      </div>

      {groupedIndicators.length ? (
        <div className="indicator-group-grid">
          {groupedIndicators.map((group) => {
            const groupElementId = toGroupElementId(group.label)

            return (
              <section className="indicator-group" key={group.label}>
              <div className="indicator-group-header">
                <button
                  type="button"
                  className="indicator-group-toggle"
                  onClick={() => setExpandedGroups((current) => toggleGroupExpanded(current, group.label))}
                  aria-expanded={Boolean(expandedGroups[group.label])}
                  aria-controls={groupElementId}
                >
                  <span className={`indicator-chevron${expandedGroups[group.label] ? ' expanded' : ''}`} aria-hidden="true">▸</span>
                  <span className="indicator-group-title">{group.label}</span>
                  <span className="chip indicator-group-count">{group.items.length}</span>
                </button>

                <button
                  type="button"
                  className="group-copy-button"
                  title={`Copy ${group.label}`}
                  aria-label={`Copy ${group.label}`}
                  onClick={() => copySingleGroup(group)}
                >
                  📋
                </button>
              </div>

              {expandedGroups[group.label] && (
                <ul className="indicator-group-list" id={groupElementId}>
                  {group.items.map((ioc, index) => (
                    <li key={`${ioc.refanged_value || ioc.original_value || group.label}-${index}`}>
                      {getIndicatorDisplayValue(ioc, displayMode)}
                    </li>
                  ))}
                </ul>
              )}
              </section>
            )
          })}
        </div>
      ) : (
        <p className="muted indicator-empty-state">{DETECTED_EMPTY_MESSAGE}</p>
      )}

      {copyToast && (
        <div className={`copy-toast copy-toast-${copyToast.tone}`} role="status" aria-live="polite">
          {copyToast.message}
        </div>
      )}
    </section>
  )
}

export default IndicatorResults
