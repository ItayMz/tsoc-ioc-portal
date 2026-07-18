import { useEffect, useRef, useState } from 'react'
import AboutDialog from './components/AboutDialog'
import AdditionalInvestigationCard from './components/AdditionalInvestigationCard'
import AppFooter from './components/AppFooter'
import ControlPanel from './components/ControlPanel'
import CrowdStrikeResults from './components/CrowdStrikeResults'
import ErrorBanner from './components/ErrorBanner'
import ExportSuccessBanner from './components/ExportSuccessBanner'
import IndicatorResults from './components/IndicatorResults'
import KqlCards from './components/KqlCards'
import LoadingSpinner from './components/LoadingSpinner'
import AnalystPlaybook from './components/AnalystPlaybook'
import SummaryCards from './components/SummaryCards'
import ToastMessage from './components/ToastMessage'
import {
  BACKEND_CONNECTION_STATES,
  getBackendStatusContent,
  isBackendConnected,
  runRequestWithSingleHealthRecovery,
  shouldShowBackendSpinner,
  shouldDisableBackendActions,
  waitForBackendAvailability,
} from './services/backendHealth.js'
import {
  checkBackendHealth,
  exportDefenderCsv,
  parseIocsWithMetadata,
} from './services/iocApi'
import { parseUploadedFiles } from './services/uploadParser.js'
import { DEFAULT_DEFENDER_CATEGORY, normalizeDefaultCategory } from './services/defenderCategories.js'
import { getInitialRawText, resolveExportRequest } from './services/exportState'
import {
  applyLookbackRefreshResult,
  buildLookbackRefreshPayload,
  DEFAULT_LOOKBACK_DAYS,
  LOOKBACK_REFRESH_FAILURE_MESSAGE,
  shouldAttemptLookbackRefresh,
} from './services/lookbackRefresh.js'
import { getDetectedIndicators } from './services/indicatorPresentation.js'
import {
  buildAdditionalInvestigationMessage,
} from './services/additionalInvestigationGuidance.js'
import {
  getWorkflowPresentation,
  WORKFLOW_MODE,
} from './services/workflowMode.js'
import {
  CROWDSTRIKE_DEFAULT_DESCRIPTION,
  CROWDSTRIKE_DEFAULT_SEVERITY,
  exportCrowdStrikeBlockingCsv,
  getCrowdStrikeBlockingEligibleCount,
  normalizeCrowdStrikeSeverity,
} from './services/crowdstrikeBlockingExport.js'
import { exportQradarCsv, getQradarEligibleCount } from './services/qradarExport.js'
import {
  buildAnalystPlaybook,
  shouldShowAnalystPlaybook,
} from './services/playbookBuilder.js'
import './styles/theme.css'
import './styles/app.css'

const TOAST_HIDE_MS = 2200
const EXPORT_BANNER_HIDE_MS = 6500
const EXPORT_BANNER_FADE_MS = 220
const WORKFLOW_TRANSITION_MS = 210
const TOTAL_UPLOAD_SIZE_LIMIT_BYTES = 25 * 1024 * 1024

function getValidDetectedCount(parseData) {
  if (typeof parseData?.valid_count === 'number') {
    return parseData.valid_count
  }

  if (typeof parseData?.summary?.valid === 'number') {
    return parseData.summary.valid
  }

  if (typeof parseData?.summary?.valid_count === 'number') {
    return parseData.summary.valid_count
  }

  return (parseData?.indicators || []).filter((indicator) => indicator?.valid).length
}

function App() {
  const [activeLoadingMessage, setActiveLoadingMessage] = useState('')
  const [activeLoadingAction, setActiveLoadingAction] = useState(null)
  const [rawText, setRawText] = useState(getInitialRawText())
  const [lookbackDays, setLookbackDays] = useState(DEFAULT_LOOKBACK_DAYS)
  const [parseResult, setParseResult] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [defaultCategory, setDefaultCategory] = useState(DEFAULT_DEFENDER_CATEGORY)
  const [detectedCampaignName, setDetectedCampaignName] = useState(null)
  const [uploadSummary, setUploadSummary] = useState(null)
  const [queuedFiles, setQueuedFiles] = useState([])
  const [sessionManualRawText, setSessionManualRawText] = useState('')
  const [iocMetadata, setIocMetadata] = useState([])
  const [lastSuccessfulParsePayload, setLastSuccessfulParsePayload] = useState(null)
  const [lastSuccessfulParseResult, setLastSuccessfulParseResult] = useState(null)
  const [clearVersion, setClearVersion] = useState(0)
  const [backendConnectionState, setBackendConnectionState] = useState(BACKEND_CONNECTION_STATES.CHECKING)
  const [showConnectedBanner, setShowConnectedBanner] = useState(false)
  const [isLookbackRefreshing, setIsLookbackRefreshing] = useState(false)
  const [workflowMode, setWorkflowMode] = useState(WORKFLOW_MODE.DEFENDER)
  const [crowdStrikeSeverity, setCrowdStrikeSeverity] = useState(CROWDSTRIKE_DEFAULT_SEVERITY)
  const [crowdStrikeDescription, setCrowdStrikeDescription] = useState(CROWDSTRIKE_DEFAULT_DESCRIPTION)
  const [toast, setToast] = useState(null)
  const [exportSuccessBanner, setExportSuccessBanner] = useState(null)
  const [isExportBannerClosing, setIsExportBannerClosing] = useState(false)
  const [displayedWorkflowMode, setDisplayedWorkflowMode] = useState(WORKFLOW_MODE.DEFENDER)
  const [workflowTransitionPhase, setWorkflowTransitionPhase] = useState('in')
  const [aboutOpen, setAboutOpen] = useState(false)
  const isMountedRef = useRef(true)
  const connectedHideTimerRef = useRef(null)
  const lookbackRefreshInFlightRef = useRef(false)
  const toastHideTimerRef = useRef(null)
  const exportBannerHideTimerRef = useRef(null)
  const exportBannerFadeTimerRef = useRef(null)
  const workflowTransitionTimerRef = useRef(null)
  const openFilePickerRef = useRef(null)

  const isProcessing = activeLoadingAction === 'processing'
  const isUploading = activeLoadingAction === 'uploading'
  const isDefenderExporting = activeLoadingAction === 'defender-export'
  const isProcessingInputs = isProcessing || isUploading

  const exportState = resolveExportRequest({
    lastSuccessfulParsePayload,
    lastSuccessfulParseResult,
  })

  const backendActionsDisabled = shouldDisableBackendActions(backendConnectionState, isProcessingInputs)
  const backendStatusContent = getBackendStatusContent(backendConnectionState)
  const showBackendStatusSpinner = shouldShowBackendSpinner(backendConnectionState)
  const detectedIndicators = getDetectedIndicators(parseResult?.indicators)
  const showIndicatorResults = Boolean(parseResult) && detectedIndicators.length > 0 && !isProcessingInputs
  const crowdStrikeCampaignName = campaignName || detectedCampaignName || ''
  const crowdStrikeBlockingEligibleCount = getCrowdStrikeBlockingEligibleCount(parseResult?.indicators)
  const qradarEligibleCount = getQradarEligibleCount(parseResult?.indicators)
  const crowdStrikeExportDisabled = isDefenderExporting || crowdStrikeBlockingEligibleCount === 0
  const qradarExportDisabled = isDefenderExporting || qradarEligibleCount === 0
  const showAnalystPlaybook = shouldShowAnalystPlaybook(parseResult?.indicators)
  const displayedWorkflowPresentation = getWorkflowPresentation(displayedWorkflowMode)
  const additionalInvestigationMessage = displayedWorkflowPresentation.isCrowdStrike
    ? buildAdditionalInvestigationMessage(parseResult?.indicators)
    : null
  const playbook = buildAnalystPlaybook({
    workflowMode: displayedWorkflowPresentation.mode,
    indicators: parseResult?.indicators,
    generatedOutputs: {
      advancedHuntingKql: Boolean(parseResult?.kqlQueries?.length),
      defenderIocCsv: getValidDetectedCount(parseResult) > 0,
      crowdStrikeAdvancedEventSearchQuery: getValidDetectedCount(parseResult) > 0,
      crowdStrikeBlockingCsv: getValidDetectedCount(parseResult) > 0,
      qradarCsv: qradarEligibleCount > 0,
    },
  })

  const onBackendStateChange = (nextState) => {
    if (!isMountedRef.current) {
      return
    }

    setBackendConnectionState(nextState)

    if (nextState === BACKEND_CONNECTION_STATES.CONNECTED) {
      setShowConnectedBanner(true)

      if (connectedHideTimerRef.current) {
        clearTimeout(connectedHideTimerRef.current)
      }

      connectedHideTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setShowConnectedBanner(false)
        }
      }, 2200)

      return
    }

    setShowConnectedBanner(true)
  }

  const runHealthCheck = () => waitForBackendAvailability({
    checkBackendHealth,
    onStateChange: onBackendStateChange,
  })

  const showSuccessToast = (message) => {
    if (toastHideTimerRef.current) {
      clearTimeout(toastHideTimerRef.current)
    }

    setToast({ tone: 'success', message })
    toastHideTimerRef.current = setTimeout(() => {
      setToast(null)
    }, TOAST_HIDE_MS)
  }

  const showExportSuccessBanner = ({ title, count, countLabel, filename }) => {
    if (exportBannerHideTimerRef.current) {
      clearTimeout(exportBannerHideTimerRef.current)
    }
    if (exportBannerFadeTimerRef.current) {
      clearTimeout(exportBannerFadeTimerRef.current)
    }

    setIsExportBannerClosing(false)
    setExportSuccessBanner({
      title,
      details: `${count} ${countLabel} • ${filename}`,
    })

    exportBannerHideTimerRef.current = setTimeout(() => {
      setIsExportBannerClosing(true)
      exportBannerFadeTimerRef.current = setTimeout(() => {
        setExportSuccessBanner(null)
        setIsExportBannerClosing(false)
      }, EXPORT_BANNER_FADE_MS)
    }, EXPORT_BANNER_HIDE_MS)
  }

  const dismissExportSuccessBanner = () => {
    if (!exportSuccessBanner) {
      return
    }

    if (exportBannerHideTimerRef.current) {
      clearTimeout(exportBannerHideTimerRef.current)
    }
    if (exportBannerFadeTimerRef.current) {
      clearTimeout(exportBannerFadeTimerRef.current)
    }

    setIsExportBannerClosing(true)
    exportBannerFadeTimerRef.current = setTimeout(() => {
      setExportSuccessBanner(null)
      setIsExportBannerClosing(false)
    }, EXPORT_BANNER_FADE_MS)
  }

  useEffect(() => {
    isMountedRef.current = true
    runHealthCheck()

    return () => {
      isMountedRef.current = false
      if (connectedHideTimerRef.current) {
        clearTimeout(connectedHideTimerRef.current)
      }
      if (toastHideTimerRef.current) {
        clearTimeout(toastHideTimerRef.current)
      }
      if (exportBannerHideTimerRef.current) {
        clearTimeout(exportBannerHideTimerRef.current)
      }
      if (exportBannerFadeTimerRef.current) {
        clearTimeout(exportBannerFadeTimerRef.current)
      }
      if (workflowTransitionTimerRef.current) {
        clearTimeout(workflowTransitionTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (workflowMode === displayedWorkflowMode) {
      return
    }

    setWorkflowTransitionPhase('out')
    if (workflowTransitionTimerRef.current) {
      clearTimeout(workflowTransitionTimerRef.current)
    }

    workflowTransitionTimerRef.current = setTimeout(() => {
      setDisplayedWorkflowMode(workflowMode)
      setWorkflowTransitionPhase('in')
    }, WORKFLOW_TRANSITION_MS)
  }, [workflowMode, displayedWorkflowMode])

  const buildCombinedPayload = ({ nextManualRawText, nextQueuedFiles }) => {
    const combinedRawText = [nextManualRawText, ...nextQueuedFiles.map((fileEntry) => fileEntry.rawText)]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join('\n')

    const combinedMetadata = nextQueuedFiles.flatMap((fileEntry) => fileEntry.iocMetadata || [])

    return {
      rawText: combinedRawText,
      lookbackDays,
      campaignName: campaignName || null,
      defaultCategory: normalizeDefaultCategory(defaultCategory),
      iocMetadata: combinedMetadata.length ? combinedMetadata : null,
    }
  }

  const handleProcess = async () => {
    if (!isBackendConnected(backendConnectionState)) {
      setErrorMessage('Backend is currently unavailable. Please try again shortly.')
      return
    }

    setActiveLoadingAction('processing')
    setActiveLoadingMessage('Parsing indicators...')
    setErrorMessage('')
    setExportSuccessBanner(null)
    setIsExportBannerClosing(false)

    try {
      const nextManualRawText = [sessionManualRawText, rawText]
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .join('\n')
      const nextPayload = buildCombinedPayload({
        nextManualRawText,
        nextQueuedFiles: queuedFiles,
      })

      const nextResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(nextPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      setParseResult(nextResult)
      setLastSuccessfulParsePayload(nextPayload)
      setLastSuccessfulParseResult(nextResult)
      setIocMetadata(nextPayload.iocMetadata || [])
      setSessionManualRawText(nextManualRawText)
      setRawText('')
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setActiveLoadingAction(null)
      setActiveLoadingMessage('')
    }
  }

  const handleUpload = async (files) => {
    if (!isBackendConnected(backendConnectionState)) {
      setErrorMessage('Backend is currently unavailable. Please try again shortly.')
      return
    }

    setActiveLoadingAction('uploading')
    setActiveLoadingMessage('Processing files...')
    setErrorMessage('')

    try {
      const existingSignatures = new Set(queuedFiles.map((fileEntry) => fileEntry.signature))
      const dedupedFiles = []
      for (const file of files) {
        const signature = `${file.name}|${file.size}|${file.lastModified || 0}`
        if (existingSignatures.has(signature)) {
          continue
        }

        existingSignatures.add(signature)
        dedupedFiles.push(file)
      }

      if (!dedupedFiles.length) {
        return
      }

      const totalQueuedUploadBytes = queuedFiles.reduce((acc, fileEntry) => acc + fileEntry.size, 0)
      const dedupedSize = dedupedFiles.reduce((acc, file) => acc + (file.size || 0), 0)
      if (totalQueuedUploadBytes + dedupedSize > TOTAL_UPLOAD_SIZE_LIMIT_BYTES) {
        setErrorMessage('Total uploaded file size exceeds 25 MB. Remove one or more files before adding new uploads.')
        return
      }

      const nextFileEntries = []
      for (const file of dedupedFiles) {
        const parsed = await parseUploadedFiles([file])
        const entryId = `${Date.now()}-${Math.random().toString(16).slice(2)}`

        nextFileEntries.push({
          id: entryId,
          signature: `${file.name}|${file.size}|${file.lastModified || 0}`,
          name: file.name,
          size: file.size || 0,
          rawText: parsed.rawText,
          iocMetadata: (parsed.iocMetadata || []).map((row) => ({
            ...row,
            sourceFile: entryId,
          })),
          detectedCampaignName: parsed.summary.detectedCampaignName,
        })
      }

      const nextQueuedFiles = [...queuedFiles, ...nextFileEntries]
      const nextPayload = buildCombinedPayload({
        nextManualRawText: sessionManualRawText,
        nextQueuedFiles,
      })

      const nextResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(nextPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      const totalUploadedIocs = nextFileEntries.reduce((acc, entry) => acc + entry.rawText.split(/\r?\n/).filter(Boolean).length, 0)
      const candidateCampaigns = nextQueuedFiles
        .map((entry) => entry.detectedCampaignName)
        .filter(Boolean)

      setQueuedFiles(nextQueuedFiles)
      setUploadSummary({
        filesUploaded: nextQueuedFiles.length,
        iocsExtracted: totalUploadedIocs,
        detectedCampaignName: candidateCampaigns[0] || null,
        warning: null,
      })
      setDetectedCampaignName(candidateCampaigns[0] || null)
      setIocMetadata(nextPayload.iocMetadata || [])
      setLastSuccessfulParsePayload(nextPayload)
      setLastSuccessfulParseResult(nextResult)
      setParseResult(nextResult)
      showSuccessToast(`✓ Files uploaded (${dedupedFiles.length})`)
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setActiveLoadingAction(null)
      setActiveLoadingMessage('')
    }
  }

  const handleDefenderExport = async () => {
    if (!isBackendConnected(backendConnectionState)) {
      setErrorMessage('Backend is currently unavailable. Please try again shortly.')
      return
    }

    const { payload, error } = exportState
    if (!payload) {
      setErrorMessage(error)
      return
    }

    setActiveLoadingAction('defender-export')
    setActiveLoadingMessage('Generating export...')
    setErrorMessage('')

    try {
      const exported = await exportDefenderCsv({
        ...payload,
        defaultCategory: normalizeDefaultCategory(defaultCategory),
      })

      const count = getValidDetectedCount(parseResult)
      showExportSuccessBanner({
        title: 'Microsoft Defender IOC CSV exported successfully',
        count,
        countLabel: 'indicators exported',
        filename: exported.filename,
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setActiveLoadingAction(null)
      setActiveLoadingMessage('')
    }
  }

  const handleCrowdStrikeExport = () => {
    const exported = exportCrowdStrikeBlockingCsv(parseResult?.indicators, {
      severity: crowdStrikeSeverity,
      description: crowdStrikeDescription,
      campaignName: crowdStrikeCampaignName,
    })

    if (!exported) {
      setErrorMessage('No blockable IOCs detected.')
      return
    }

    showExportSuccessBanner({
      title: 'CrowdStrike IOC CSV exported successfully',
      count: exported.count,
      countLabel: 'indicators exported',
      filename: exported.filename,
    })
  }

  const handleQradarExport = () => {
    const exported = exportQradarCsv(parseResult?.indicators, {
      campaignName: crowdStrikeCampaignName,
    })

    if (!exported) {
      setErrorMessage('No IPv4 indicators are available for QRadar export.')
      return
    }

    showExportSuccessBanner({
      title: 'QRadar IOC CSV exported successfully',
      count: exported.count,
      countLabel: 'IP addresses exported',
      filename: exported.filename,
    })
  }

  const handleClear = () => {
    setRawText('')
    setSessionManualRawText('')
    setLookbackDays(DEFAULT_LOOKBACK_DAYS)
    setParseResult(null)
    setActiveLoadingAction(null)
    setActiveLoadingMessage('')
    setErrorMessage('')
    setCampaignName('')
    setDefaultCategory(DEFAULT_DEFENDER_CATEGORY)
    setDetectedCampaignName(null)
    setUploadSummary(null)
    setQueuedFiles([])
    setIocMetadata([])
    setLastSuccessfulParsePayload(null)
    setLastSuccessfulParseResult(null)
    lookbackRefreshInFlightRef.current = false
    setIsLookbackRefreshing(false)
    setCrowdStrikeSeverity(CROWDSTRIKE_DEFAULT_SEVERITY)
    setCrowdStrikeDescription(CROWDSTRIKE_DEFAULT_DESCRIPTION)
    setWorkflowMode(WORKFLOW_MODE.DEFENDER)
    setDisplayedWorkflowMode(WORKFLOW_MODE.DEFENDER)
    setWorkflowTransitionPhase('in')
    setExportSuccessBanner(null)
    setIsExportBannerClosing(false)
    setToast(null)
    setClearVersion((current) => current + 1)
  }

  const handleRemoveQueuedFile = async (fileId) => {
    const nextQueuedFiles = queuedFiles.filter((fileEntry) => fileEntry.id !== fileId)
    setQueuedFiles(nextQueuedFiles)

    if (!isBackendConnected(backendConnectionState)) {
      return
    }

    const nextPayload = buildCombinedPayload({
      nextManualRawText: sessionManualRawText,
      nextQueuedFiles,
    })

    if (!String(nextPayload.rawText || '').trim()) {
      setParseResult(null)
      setLastSuccessfulParsePayload(null)
      setLastSuccessfulParseResult(null)
      setIocMetadata([])
      setUploadSummary(null)
      return
    }

    setActiveLoadingAction('uploading')
    setActiveLoadingMessage('Recomputing analysis...')

    try {
      const nextResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(nextPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      setParseResult(nextResult)
      setLastSuccessfulParsePayload(nextPayload)
      setLastSuccessfulParseResult(nextResult)
      setIocMetadata(nextPayload.iocMetadata || [])
      setUploadSummary((current) => {
        if (!current) {
          return null
        }

        const nextIocCount = nextQueuedFiles.reduce((acc, entry) => acc + entry.rawText.split(/\r?\n/).filter(Boolean).length, 0)
        return {
          ...current,
          filesUploaded: nextQueuedFiles.length,
          iocsExtracted: nextIocCount,
        }
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setActiveLoadingAction(null)
      setActiveLoadingMessage('')
    }
  }

  const handleCrowdStrikeSeverityChange = (nextSeverity) => {
    setCrowdStrikeSeverity(normalizeCrowdStrikeSeverity(nextSeverity))
  }

  const handleLookbackChange = async (nextLookbackDays) => {
    const normalizedLookbackDays = Number(nextLookbackDays)
    setLookbackDays(normalizedLookbackDays)

    const backendConnected = isBackendConnected(backendConnectionState)
    if (!shouldAttemptLookbackRefresh({
      nextLookbackDays: normalizedLookbackDays,
      backendConnected,
      canExport: exportState.canExport,
      lastSuccessfulParsePayload,
      refreshInFlight: lookbackRefreshInFlightRef.current,
    })) {
      return
    }

    const refreshPayload = buildLookbackRefreshPayload(lastSuccessfulParsePayload, normalizedLookbackDays)
    if (!refreshPayload) {
      return
    }

    lookbackRefreshInFlightRef.current = true
    setIsLookbackRefreshing(true)
    setErrorMessage('')

    try {
      const refreshedData = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(refreshPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      const nextParseResult = applyLookbackRefreshResult(lastSuccessfulParseResult, refreshedData)
      setParseResult(nextParseResult)
      setLastSuccessfulParseResult(nextParseResult)
      setLastSuccessfulParsePayload(refreshPayload)
    } catch {
      setErrorMessage(LOOKBACK_REFRESH_FAILURE_MESSAGE)
    } finally {
      lookbackRefreshInFlightRef.current = false
      setIsLookbackRefreshing(false)
    }
  }

  const defenderExportDisabled = !isBackendConnected(backendConnectionState) || isDefenderExporting || !exportState.canExport

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        if (aboutOpen) {
          setAboutOpen(false)
          return
        }

        handleClear()
        return
      }

      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'u') {
        event.preventDefault()
        openFilePickerRef.current?.()
        return
      }

      if (event.ctrlKey && !event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        handleProcess()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [aboutOpen, backendConnectionState, rawText, lookbackDays, campaignName, defaultCategory, iocMetadata, lastSuccessfulParsePayload, lastSuccessfulParseResult, parseResult, workflowMode, crowdStrikeSeverity, crowdStrikeDescription])

  return (
    <div className="app-shell">
      <header className="top-header card">
        <div>
          <p className="eyebrow">Built for SOC Operations</p>
          <h1>IOC Workbench</h1>
        </div>
      </header>

      {(backendConnectionState !== BACKEND_CONNECTION_STATES.CONNECTED || showConnectedBanner) && (
        <section className={`card backend-status backend-status-${backendStatusContent.tone}`} aria-live="polite">
          <p className="backend-status-title">
            {showBackendStatusSpinner && <span className="backend-status-spinner" aria-hidden="true" />}
            <span>{backendStatusContent.title}</span>
          </p>
          {backendStatusContent.description && (
            <p className="muted backend-status-description">{backendStatusContent.description}</p>
          )}
        </section>
      )}

      <ControlPanel
        rawText={rawText}
        lookbackDays={lookbackDays}
        campaignName={campaignName}
        defaultCategory={defaultCategory}
        workflowMode={workflowMode}
        uploadSummary={uploadSummary}
        processingInFlight={isProcessing}
        uploadingInFlight={isUploading}
        exportInFlight={isDefenderExporting}
        lookbackRefreshing={isLookbackRefreshing}
        onRawTextChange={setRawText}
        onLookbackChange={handleLookbackChange}
        onCampaignNameChange={setCampaignName}
        onDefaultCategoryChange={setDefaultCategory}
        onWorkflowModeChange={setWorkflowMode}
        onProcess={handleProcess}
        onUpload={handleUpload}
        queuedFiles={queuedFiles}
        onRemoveQueuedFile={handleRemoveQueuedFile}
        onExport={handleDefenderExport}
        onSecondaryExport={handleQradarExport}
        onCrowdStrikeExport={handleCrowdStrikeExport}
        onClear={handleClear}
        exportButtonLabel="Export Defender CSV"
        exportDisabled={defenderExportDisabled}
        secondaryExportButtonLabel="Export QRadar CSV"
        secondaryExportDisabled={qradarExportDisabled}
        hasAccumulatedResult={Boolean(lastSuccessfulParseResult)}
        backendConnected={isBackendConnected(backendConnectionState)}
        backendActionsDisabled={backendActionsDisabled}
        showDefenderControls={displayedWorkflowPresentation.isDefender}
        crowdStrikeSeverity={crowdStrikeSeverity}
        crowdStrikeDescription={crowdStrikeDescription}
        onCrowdStrikeSeverityChange={handleCrowdStrikeSeverityChange}
        onCrowdStrikeDescriptionChange={setCrowdStrikeDescription}
        crowdStrikeExportDisabled={crowdStrikeExportDisabled}
        workflowTransitionPhase={workflowTransitionPhase}
        clearVersion={clearVersion}
        onRegisterOpenFilePicker={(opener) => {
          openFilePickerRef.current = opener
        }}
      />

      <ExportSuccessBanner
        banner={exportSuccessBanner}
        isClosing={isExportBannerClosing}
        onClose={dismissExportSuccessBanner}
      />

      <ErrorBanner message={errorMessage} />

      {activeLoadingAction && <LoadingSpinner message={activeLoadingMessage} />}

      {!activeLoadingAction && isLookbackRefreshing && (
        <LoadingSpinner message="Refreshing KQL queries for the selected lookback..." subtle />
      )}

      {parseResult && !isProcessingInputs && (
        <>
          <SummaryCards
            summary={parseResult.summary}
            exportEligibility={!displayedWorkflowPresentation.isDefender ? {
              crowdStrikeBlockingEligible: crowdStrikeBlockingEligibleCount,
              qradarEligibleIps: qradarEligibleCount,
            } : null}
          />
          {showIndicatorResults && (
            <IndicatorResults
              indicators={parseResult.indicators}
              onIocListCopied={() => {
                showSuccessToast('✓ IOC list copied')
              }}
            />
          )}
          <div key={displayedWorkflowPresentation.mode} className={`workflow-content-transition workflow-content-transition-${workflowTransitionPhase}`}>
            {displayedWorkflowPresentation.isDefender ? (
              <KqlCards
                queries={parseResult.kqlQueries}
                onQueryCopied={() => {
                  showSuccessToast('✓ Query copied')
                }}
              />
            ) : (
              <>
                <CrowdStrikeResults
                  indicators={parseResult.indicators}
                  onQueryCopied={() => {
                    showSuccessToast('✓ Query copied')
                  }}
                />
                <AdditionalInvestigationCard message={additionalInvestigationMessage} />
              </>
            )}
            {showAnalystPlaybook && <AnalystPlaybook playbook={playbook} />}
          </div>
        </>
      )}

      <AppFooter onOpenShortcuts={() => setAboutOpen(true)} />

      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <ToastMessage toast={toast} />
    </div>
  )
}

export default App
