import { useState } from 'react'
import ControlPanel from './components/ControlPanel'
import ErrorBanner from './components/ErrorBanner'
import IndicatorResults from './components/IndicatorResults'
import KqlCards from './components/KqlCards'
import SummaryCards from './components/SummaryCards'
import { exportDefenderCsv, parseIocsWithMetadata, uploadFiles } from './services/iocApi'
import { DEFAULT_DEFENDER_CATEGORY, normalizeDefaultCategory } from './services/defenderCategories.js'
import { getInitialRawText, resolveExportRequest } from './services/exportState'
import './styles/theme.css'
import './styles/app.css'

function App() {
  const [rawText, setRawText] = useState(getInitialRawText())
  const [lookbackDays, setLookbackDays] = useState(90)
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

  const exportState = resolveExportRequest({
    lastSuccessfulParsePayload,
    lastSuccessfulParseResult,
  })

  const buildRequestPayload = () => ({
    rawText,
    lookbackDays,
    campaignName: campaignName || null,
    defaultCategory: normalizeDefaultCategory(defaultCategory),
    iocMetadata: iocMetadata.length ? iocMetadata : null,
  })

  const handleProcess = async () => {
    setLoading(true)
    setErrorMessage('')

    try {
      const requestPayload = buildRequestPayload()
      const data = await parseIocsWithMetadata(requestPayload)
      setParseResult(data)
      setLastSuccessfulParsePayload(requestPayload)
      setLastSuccessfulParseResult(data)
    } catch (error) {
      setParseResult(null)
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (files) => {
    setLoading(true)
    setErrorMessage('')

    try {
      const { data, summary, iocMetadata: parsedMetadata, requestPayload } = await uploadFiles(
        files,
        lookbackDays,
        campaignName,
        defaultCategory,
      )
      setUploadSummary(summary)
      setDetectedCampaignName(summary.detectedCampaignName)
      setIocMetadata(parsedMetadata || [])
      setLastSuccessfulParsePayload(requestPayload)
      setLastSuccessfulParseResult(data)
      setParseResult(data)
    } catch (error) {
      setParseResult(null)
      setErrorMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
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
    setParseResult(null)
    setErrorMessage('')
    setCampaignName('')
    setDefaultCategory(DEFAULT_DEFENDER_CATEGORY)
    setDetectedCampaignName(null)
    setUploadSummary(null)
    setIocMetadata([])
    setLastSuccessfulParsePayload(null)
    setLastSuccessfulParseResult(null)
    setClearVersion((current) => current + 1)
  }

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

      <ControlPanel
        rawText={rawText}
        lookbackDays={lookbackDays}
        campaignName={campaignName}
        defaultCategory={defaultCategory}
        uploadSummary={uploadSummary}
        loading={loading}
        onRawTextChange={setRawText}
        onLookbackChange={setLookbackDays}
        onCampaignNameChange={setCampaignName}
        onDefaultCategoryChange={setDefaultCategory}
        onProcess={handleProcess}
        onUpload={handleUpload}
        onExport={handleExport}
        onClear={handleClear}
        canExport={exportState.canExport}
        clearVersion={clearVersion}
      />

      <ErrorBanner message={errorMessage} />

      {loading && (
        <section className="card loading-card" aria-live="polite">
          Processing IOC payload via backend API...
        </section>
      )}

      {parseResult && !loading && (
        <>
          <SummaryCards summary={parseResult.summary} />
          <IndicatorResults indicators={parseResult.indicators} />
          <KqlCards queries={parseResult.kqlQueries} />
        </>
      )}
    </div>
  )
}

export default App
