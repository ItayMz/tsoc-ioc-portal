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
import Icon from './Icon.jsx'

const TOAST_AUTO_HIDE_MS = 2200
const INDICATOR_PANEL_FAST_PATH_THRESHOLD = 48
const LARGE_PANEL_TRANSITION_MS = 160

function toGroupElementId(label) {
  return `group-${String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function IndicatorResults({ indicators, onIocListCopied }) {
  const detected = useMemo(() => getDetectedIndicators(indicators), [indicators])
  const groupedIndicators = useMemo(() => groupDetectedIndicatorsByType(detected), [detected])
  const [displayMode, setDisplayMode] = useState(INDICATOR_DISPLAY_MODE.REFANGED)
  const [expandedGroups, setExpandedGroups] = useState(() => getInitialExpandedGroups(groupedIndicators))
  const [copyToast, setCopyToast] = useState(null)
  const [largePanelPresence, setLargePanelPresence] = useState({})
  const [largePanelVisible, setLargePanelVisible] = useState({})
  const toastTimerRef = useRef(null)
  const largePanelExitTimersRef = useRef({})
  const largePanelEnterFramesRef = useRef({})

  useEffect(() => {
    setExpandedGroups((current) => syncExpandedGroups(current, groupedIndicators))
  }, [groupedIndicators])

  useEffect(() => () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current)
    }

    Object.values(largePanelExitTimersRef.current).forEach((timerId) => {
      clearTimeout(timerId)
    })
    Object.values(largePanelEnterFramesRef.current).forEach((frameId) => {
      cancelAnimationFrame(frameId)
    })
  }, [])

  useEffect(() => {
    const largeGroupLabels = new Set(
      groupedIndicators
        .filter((group) => group.items.length > INDICATOR_PANEL_FAST_PATH_THRESHOLD)
        .map((group) => group.label),
    )

    setLargePanelPresence((current) => {
      const next = {}
      let changed = false

      for (const [label, present] of Object.entries(current)) {
        if (largeGroupLabels.has(label)) {
          next[label] = present
        } else {
          changed = true

          if (largePanelExitTimersRef.current[label]) {
            clearTimeout(largePanelExitTimersRef.current[label])
            delete largePanelExitTimersRef.current[label]
          }
          if (largePanelEnterFramesRef.current[label]) {
            cancelAnimationFrame(largePanelEnterFramesRef.current[label])
            delete largePanelEnterFramesRef.current[label]
          }
        }
      }

      return changed ? next : current
    })

    setLargePanelVisible((current) => {
      const next = {}
      let changed = false

      for (const [label, visible] of Object.entries(current)) {
        if (largeGroupLabels.has(label)) {
          next[label] = visible
        } else {
          changed = true
        }
      }

      return changed ? next : current
    })

    for (const group of groupedIndicators) {
      const isLargeGroup = group.items.length > INDICATOR_PANEL_FAST_PATH_THRESHOLD
      if (!isLargeGroup) {
        continue
      }

      const label = group.label
      const isExpanded = Boolean(expandedGroups[label])

      if (isExpanded) {
        if (largePanelExitTimersRef.current[label]) {
          clearTimeout(largePanelExitTimersRef.current[label])
          delete largePanelExitTimersRef.current[label]
        }

        setLargePanelPresence((current) => {
          if (current[label]) {
            return current
          }

          return {
            ...current,
            [label]: true,
          }
        })

        if (largePanelEnterFramesRef.current[label]) {
          cancelAnimationFrame(largePanelEnterFramesRef.current[label])
        }

        largePanelEnterFramesRef.current[label] = requestAnimationFrame(() => {
          setLargePanelVisible((current) => {
            if (current[label]) {
              return current
            }

            return {
              ...current,
              [label]: true,
            }
          })

          delete largePanelEnterFramesRef.current[label]
        })

        continue
      }

      setLargePanelVisible((current) => {
        if (!current[label]) {
          return current
        }

        return {
          ...current,
          [label]: false,
        }
      })

      if (largePanelExitTimersRef.current[label]) {
        clearTimeout(largePanelExitTimersRef.current[label])
      }

      largePanelExitTimersRef.current[label] = setTimeout(() => {
        setLargePanelPresence((current) => {
          if (!current[label]) {
            return current
          }

          const next = { ...current }
          delete next[label]
          return next
        })

        setLargePanelVisible((current) => {
          if (!Object.hasOwn(current, label)) {
            return current
          }

          const next = { ...current }
          delete next[label]
          return next
        })

        delete largePanelExitTimersRef.current[label]
      }, LARGE_PANEL_TRANSITION_MS)
    }
  }, [groupedIndicators, expandedGroups])

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

    onIocListCopied?.()
    showToast(getCopyAllSuccessMessage(groupedCount), 'success')
  }

  const copySingleGroup = async (group) => {
    const payload = buildGroupCopyPayload(group, displayMode)
    const copied = await copyText(payload)

    if (!copied) {
      showToast(INDICATOR_COPY_ERROR_MESSAGE, 'error')
      return
    }

    onIocListCopied?.()
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
          <Icon name="copy" className="inline-icon" /> Copy All
        </button>
      </div>

      {groupedIndicators.length ? (
        <div className="indicator-group-grid">
          {groupedIndicators.map((group) => {
            const groupElementId = toGroupElementId(group.label)
            const isExpanded = Boolean(expandedGroups[group.label])
            const useFastPanelPath = group.items.length > INDICATOR_PANEL_FAST_PATH_THRESHOLD
            const shouldRenderFastPanel = Boolean(largePanelPresence[group.label]) || isExpanded
            const isFastPanelVisible = Boolean(largePanelVisible[group.label])

            return (
              <section className={`indicator-group${isExpanded ? ' expanded' : ''}`} key={group.label}>
              <div className="indicator-group-header">
                <button
                  type="button"
                  className={`indicator-group-toggle${isExpanded ? ' expanded' : ''}`}
                  onClick={() => setExpandedGroups((current) => toggleGroupExpanded(current, group.label))}
                  aria-expanded={isExpanded}
                  aria-controls={groupElementId}
                >
                  <span className={`indicator-chevron${isExpanded ? ' expanded' : ''}`} aria-hidden="true">▸</span>
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
                  <Icon name="copy" className="inline-icon" />
                </button>
              </div>

              {(!useFastPanelPath || shouldRenderFastPanel) && (
                <div
                  id={groupElementId}
                  className={`indicator-group-panel${useFastPanelPath ? ' indicator-group-panel-large' : ''}${!useFastPanelPath && isExpanded ? ' expanded' : ''}${useFastPanelPath && isFastPanelVisible ? ' indicator-group-panel-large-visible' : ''}`}
                  aria-hidden={!isExpanded}
                >
                  <div className="indicator-group-panel-inner">
                    <ul className="indicator-group-list">
                      {group.items.map((ioc, index) => (
                        <li key={`${ioc.refanged_value || ioc.original_value || group.label}-${index}`}>
                          {getIndicatorDisplayValue(ioc, displayMode)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
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
