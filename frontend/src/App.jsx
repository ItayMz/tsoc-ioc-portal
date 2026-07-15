import { useEffect, useRef, useState } from 'react'
import ControlPanel from './components/ControlPanel'
import CrowdStrikeBlockingExport from './components/CrowdStrikeBlockingExport'
import CrowdStrikeResults from './components/CrowdStrikeResults'
import ErrorBanner from './components/ErrorBanner'
import IndicatorResults from './components/IndicatorResults'
import KqlCards from './components/KqlCards'
import SenderEmailInfoCard from './components/SenderEmailInfoCard'
import SummaryCards from './components/SummaryCards'
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
import './styles/theme.css'
import './styles/app.css'

function App() {
  const [rawText, setRawText] = useState(getInitialRawText())
  const [lookbackDays, setLookbackDays] = useState(DEFAULT_LOOKBACK_DAYS)
  const [parseResult, setParseResult] = useState(null)
  const [loading, setLoading] = useState(false)
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
  const isMountedRef = useRef(true)
  const connectedHideTimerRef = useRef(null)
  const lookbackRefreshInFlightRef = useRef(false)

  const exportState = resolveExportRequest({
    lastSuccessfulParsePayload,
    lastSuccessfulParseResult,
  })

  const backendActionsDisabled = shouldDisableBackendActions(backendConnectionState, loading)
  const backendStatusContent = getBackendStatusContent(backendConnectionState)
  const showBackendStatusSpinner = shouldShowBackendSpinner(backendConnectionState)
  const senderEmailAddresses = getDetectedSenderEmailAddresses(parseResult?.indicators)
  const showSenderEmailInfoCard = senderEmailAddresses.length > 0
  const workflowPresentation = getWorkflowPresentation(workflowMode)
  const crowdStrikeCampaignName = campaignName || detectedCampaignName || ''
  const crowdStrikeEligibleCount = getCrowdStrikeBlockingEligibleCount(parseResult?.indicators)
  const canCrowdStrikeExport = crowdStrikeEligibleCount > 0

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

  useEffect(() => {
    isMountedRef.current = true
    runHealthCheck()

    return () => {
      isMountedRef.current = false
      if (connectedHideTimerRef.current) {
        clearTimeout(connectedHideTimerRef.current)
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

    setLoading(true)
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
      setLoading(false)
    }
  }

  const handleUpload = async (files) => {
    if (!isBackendConnected(backendConnectionState)) {
      setErrorMessage('Backend is currently unavailable. Please try again shortly.')
      return
    }

    setLoading(true)
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
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!isBackendConnected(backendConnectionState)) {
      setErrorMessage('Backend is currently unavailable. Please try again shortly.')
      return
    }

    const { payload, error } = exportState
    if (!payload) {
      setErrorMessage(error)
      return
    }

    setLoading(true)
    setErrorMessage('')

    try {
      await exportDefenderCsv({
        ...payload,
        defaultCategory: normalizeDefaultCategory(defaultCategory),
      })
    } catch (error) {
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => {
    setRawText('')
    setLookbackDays(DEFAULT_LOOKBACK_DAYS)
    setParseResult(null)
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
    setClearVersion((current) => current + 1)
  }

  const handleCrowdStrikeExport = () => {
    const exported = exportCrowdStrikeBlockingCsv(parseResult?.indicators, {
      severity: crowdStrikeSeverity,
      description: crowdStrikeDescription,
      campaignName: crowdStrikeCampaignName,
    })

    if (!exported) {
      setErrorMessage('No IPv4, MD5, or SHA256 indicators are available for CrowdStrike blocking export.')
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

  const activeExportLabel = workflowPresentation.isDefender
    ? 'Export Defender CSV'
    : 'Export CrowdStrike CSV'

  const activeExportHandler = workflowPresentation.isDefender
    ? handleExport
    : handleCrowdStrikeExport

  const activeExportDisabled = workflowPresentation.isDefender
    ? backendActionsDisabled || !exportState.canExport
    : loading || !canCrowdStrikeExport

  return (
    <div className="app-shell">
      <header className="top-header card">
        <div>
          <p className="eyebrow">SOC Automation Workbench</p>
          <h1>TSOC IOC Portal</h1>
          <p className="muted">Transform raw threat intelligence into Microsoft Defender IOC imports and Advanced Hunting KQL queries..</p>
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
        loading={loading}
        lookbackRefreshing={isLookbackRefreshing}
        onRawTextChange={setRawText}
        onLookbackChange={handleLookbackChange}
        onCampaignNameChange={setCampaignName}
        onDefaultCategoryChange={setDefaultCategory}
        onWorkflowModeChange={setWorkflowMode}
        onProcess={handleProcess}
        onUpload={handleUpload}
        onExport={activeExportHandler}
        onClear={handleClear}
        exportButtonLabel={activeExportLabel}
        exportDisabled={activeExportDisabled}
        crowdStrikeConfigSection={!workflowPresentation.isDefender ? (
          <CrowdStrikeBlockingExport
            indicators={parseResult?.indicators}
            severity={crowdStrikeSeverity}
            description={crowdStrikeDescription}
            onSeverityChange={handleCrowdStrikeSeverityChange}
            onDescriptionChange={setCrowdStrikeDescription}
          />
        ) : null}
        hasAccumulatedResult={Boolean(lastSuccessfulParseResult)}
        backendConnected={isBackendConnected(backendConnectionState)}
        backendActionsDisabled={backendActionsDisabled}
        showDefenderControls={workflowPresentation.isDefender}
        clearVersion={clearVersion}
      />

      <ErrorBanner message={errorMessage} />

      {loading && (
        <section className="card loading-card" aria-live="polite">
          Processing IOC payload via backend API...
        </section>
      )}

      {!loading && isLookbackRefreshing && (
        <section className="card loading-card loading-card-subtle" aria-live="polite">
          Refreshing KQL queries for the selected lookback...
        </section>
      )}

      {parseResult && !loading && (
        <>
          <SummaryCards summary={parseResult.summary} />
          {showSenderEmailInfoCard && (
            <SenderEmailInfoCard
              emailAddresses={senderEmailAddresses}
              message={workflowPresentation.senderGuidanceMessage}
            />
          )}
          <IndicatorResults indicators={parseResult.indicators} />
          {workflowPresentation.isDefender ? (
            <KqlCards queries={parseResult.kqlQueries} />
          ) : (
            <CrowdStrikeResults indicators={parseResult.indicators} />
          )}
        </>
      )}
    </div>
  )
}

export default App
