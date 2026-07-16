import { useEffect, useRef, useState } from 'react'
import ControlPanel from './components/ControlPanel'
import CrowdStrikeResults from './components/CrowdStrikeResults'
import ErrorBanner from './components/ErrorBanner'
import ExportSummaryCards from './components/ExportSummaryCards'
import IndicatorResults from './components/IndicatorResults'
import KqlCards from './components/KqlCards'
import LoadingSpinner from './components/LoadingSpinner'
import AnalystPlaybook from './components/AnalystPlaybook'
import SenderEmailInfoCard from './components/SenderEmailInfoCard'
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
  uploadFiles,
} from './services/iocApi'
import { mergeAccumulatedSubmission } from './services/accumulation.js'
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
  getDetectedSenderEmailAddresses,
} from './services/senderEmailWorkflow.js'
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
  const [exportSummaries, setExportSummaries] = useState({
    defender: null,
    crowdstrike: null,
    qradar: null,
  })
  const isMountedRef = useRef(true)
  const connectedHideTimerRef = useRef(null)
  const lookbackRefreshInFlightRef = useRef(false)
  const toastHideTimerRef = useRef(null)

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
  const senderEmailAddresses = getDetectedSenderEmailAddresses(parseResult?.indicators)
  const workflowPresentation = getWorkflowPresentation(workflowMode)
  const showSenderEmailInfoCard = workflowPresentation.isCrowdStrike && senderEmailAddresses.length > 0
  const crowdStrikeCampaignName = campaignName || detectedCampaignName || ''
  const crowdStrikeBlockingEligibleCount = getCrowdStrikeBlockingEligibleCount(parseResult?.indicators)
  const qradarEligibleCount = getQradarEligibleCount(parseResult?.indicators)
  const crowdStrikeExportDisabled = isDefenderExporting || crowdStrikeBlockingEligibleCount === 0
  const qradarExportDisabled = isDefenderExporting || qradarEligibleCount === 0
  const exportSummaryEntries = [
    exportSummaries.defender,
    exportSummaries.crowdstrike,
    exportSummaries.qradar,
  ].filter(Boolean)
  const showAnalystPlaybook = shouldShowAnalystPlaybook(parseResult?.indicators)
  const playbook = buildAnalystPlaybook({
    workflowMode: workflowPresentation.mode,
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
    }
  }, [])

  const buildRequestPayload = () => ({
    rawText,
    lookbackDays,
    campaignName: campaignName || null,
    defaultCategory: normalizeDefaultCategory(defaultCategory),
    iocMetadata: iocMetadata.length ? iocMetadata : null,
  })

  const buildMergedRequestPayload = ({ incomingPayload, incomingResult }) => mergeAccumulatedSubmission({
    currentPayload: lastSuccessfulParsePayload,
    currentResult: lastSuccessfulParseResult,
    incomingPayload,
    incomingResult,
  })

  const assertAdditiveSubmissionHasSupportedIocs = (incomingResult) => {
    const hasAccumulatedResult = Boolean(lastSuccessfulParseResult)
    const hasSupportedIocs = typeof incomingResult?.valid_count === 'number'
      ? incomingResult.valid_count > 0
      : (incomingResult?.indicators || []).some((indicator) => indicator?.valid)

    if (hasAccumulatedResult && !hasSupportedIocs) {
      throw new Error('No supported IOCs were found in the new submission.')
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

    try {
      const incomingPayload = buildRequestPayload()
      const incomingResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(incomingPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )
      assertAdditiveSubmissionHasSupportedIocs(incomingResult)

      const mergedPayload = buildMergedRequestPayload({ incomingPayload, incomingResult })
      const mergedResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(mergedPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      setParseResult(mergedResult)
      setLastSuccessfulParsePayload(mergedPayload)
      setLastSuccessfulParseResult(mergedResult)
      setIocMetadata(mergedPayload.iocMetadata || [])
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
      const {
        data: incomingResult,
        summary,
        iocMetadata: parsedMetadata,
        requestPayload: incomingPayload,
      } = await runRequestWithSingleHealthRecovery(
        () => uploadFiles(files, lookbackDays, campaignName, defaultCategory),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )
      assertAdditiveSubmissionHasSupportedIocs(incomingResult)

      const mergedPayload = buildMergedRequestPayload({
        incomingPayload: {
          ...incomingPayload,
          iocMetadata: parsedMetadata || [],
        },
        incomingResult,
      })
      const mergedResult = await runRequestWithSingleHealthRecovery(
        () => parseIocsWithMetadata(mergedPayload),
        {
          checkBackendHealth,
          onStateChange: onBackendStateChange,
        },
      )

      setUploadSummary(summary)
      setDetectedCampaignName(summary.detectedCampaignName)
      setIocMetadata(mergedPayload.iocMetadata || [])
      setLastSuccessfulParsePayload(mergedPayload)
      setLastSuccessfulParseResult(mergedResult)
      setParseResult(mergedResult)
      setRawText('')
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
      setExportSummaries((current) => ({
        ...current,
        defender: {
          type: 'defender',
          title: 'Microsoft Defender IOC CSV',
          count,
          countLabel: 'indicators exported',
          filename: exported.filename,
        },
      }))
      showSuccessToast('✓ Defender CSV exported')
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

    setExportSummaries((current) => ({
      ...current,
      crowdstrike: {
        type: 'crowdstrike',
        title: 'CrowdStrike Blocking CSV',
        count: exported.count,
        countLabel: 'indicators exported',
        filename: exported.filename,
      },
    }))
    showSuccessToast('✓ CrowdStrike CSV exported')
  }

  const handleQradarExport = () => {
    const exported = exportQradarCsv(parseResult?.indicators, {
      campaignName: crowdStrikeCampaignName,
    })

    if (!exported) {
      setErrorMessage('No IPv4 indicators are available for QRadar export.')
      return
    }

    setExportSummaries((current) => ({
      ...current,
      qradar: {
        type: 'qradar',
        title: 'QRadar CSV',
        count: exported.count,
        countLabel: 'IP addresses exported',
        filename: exported.filename,
      },
    }))
    showSuccessToast('✓ QRadar CSV exported')
  }

  const handleClear = () => {
    setRawText('')
    setLookbackDays(DEFAULT_LOOKBACK_DAYS)
    setParseResult(null)
    setActiveLoadingAction(null)
    setActiveLoadingMessage('')
    setErrorMessage('')
    setCampaignName('')
    setDefaultCategory(DEFAULT_DEFENDER_CATEGORY)
    setDetectedCampaignName(null)
    setUploadSummary(null)
    setIocMetadata([])
    setLastSuccessfulParsePayload(null)
    setLastSuccessfulParseResult(null)
    lookbackRefreshInFlightRef.current = false
    setIsLookbackRefreshing(false)
    setCrowdStrikeSeverity(CROWDSTRIKE_DEFAULT_SEVERITY)
    setCrowdStrikeDescription(CROWDSTRIKE_DEFAULT_DESCRIPTION)
    setWorkflowMode(WORKFLOW_MODE.DEFENDER)
    setExportSummaries({
      defender: null,
      crowdstrike: null,
      qradar: null,
    })
    setToast(null)
    setClearVersion((current) => current + 1)
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

  return (
    <div className="app-shell">
      <header className="top-header card">
        <div>
          <p className="eyebrow">Built for SOC Operations</p>
          <h1>IOC Workbench</h1>
          <p className="muted">IOC Workbench v1.2</p>
        </div>
        <span className="status-badge">API Driven</span>
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
        workflowMode={workflowPresentation.mode}
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
        onExport={handleDefenderExport}
        onSecondaryExport={handleQradarExport}
        onClear={handleClear}
        exportButtonLabel="Export Defender CSV"
        exportDisabled={defenderExportDisabled}
        secondaryExportButtonLabel="Export QRadar CSV"
        secondaryExportDisabled={qradarExportDisabled}
        hasAccumulatedResult={Boolean(lastSuccessfulParseResult)}
        backendConnected={isBackendConnected(backendConnectionState)}
        backendActionsDisabled={backendActionsDisabled}
        showDefenderControls={workflowPresentation.isDefender}
        crowdStrikeSeverity={crowdStrikeSeverity}
        crowdStrikeDescription={crowdStrikeDescription}
        onCrowdStrikeSeverityChange={handleCrowdStrikeSeverityChange}
        onCrowdStrikeDescriptionChange={setCrowdStrikeDescription}
        onCrowdStrikeExport={handleCrowdStrikeExport}
        crowdStrikeExportDisabled={crowdStrikeExportDisabled}
        clearVersion={clearVersion}
      />

      {exportSummaryEntries.length > 0 && <ExportSummaryCards summaries={exportSummaryEntries} />}

      <ErrorBanner message={errorMessage} />

      {activeLoadingAction && <LoadingSpinner message={activeLoadingMessage} />}

      {!activeLoadingAction && isLookbackRefreshing && (
        <LoadingSpinner message="Refreshing KQL queries for the selected lookback..." subtle />
      )}

      {parseResult && !isProcessingInputs && (
        <>
          <SummaryCards
            summary={parseResult.summary}
            exportEligibility={!workflowPresentation.isDefender ? {
              crowdStrikeBlockingEligible: crowdStrikeBlockingEligibleCount,
              qradarEligibleIps: qradarEligibleCount,
            } : null}
          />
          {showIndicatorResults && <IndicatorResults indicators={parseResult.indicators} />}
          {workflowPresentation.isDefender ? (
            <>
              <KqlCards queries={parseResult.kqlQueries} />
            </>
          ) : (
            <>
              <CrowdStrikeResults
                indicators={parseResult.indicators}
                onQueryCopied={() => showSuccessToast('✓ Query copied')}
              />
              {showSenderEmailInfoCard && (
                <SenderEmailInfoCard
                  emailAddresses={senderEmailAddresses}
                  message={workflowPresentation.senderGuidanceMessage}
                />
              )}
            </>
          )}
          {showAnalystPlaybook && <AnalystPlaybook playbook={playbook} />}
        </>
      )}

      <ToastMessage toast={toast} />
    </div>
  )
}

export default App
