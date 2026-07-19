import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indicatorResultsPath = resolve(process.cwd(), 'src/components/IndicatorResults.jsx')
const kqlCardsPath = resolve(process.cwd(), 'src/components/KqlCards.jsx')
const additionalInvestigationCardPath = resolve(process.cwd(), 'src/components/AdditionalInvestigationCard.jsx')
const crowdStrikeQueryCardPath = resolve(process.cwd(), 'src/components/CrowdStrikeQueryCard.jsx')
const crowdStrikeResultsPath = resolve(process.cwd(), 'src/components/CrowdStrikeResults.jsx')
const controlPanelPath = resolve(process.cwd(), 'src/components/ControlPanel.jsx')
const loadingSpinnerPath = resolve(process.cwd(), 'src/components/LoadingSpinner.jsx')
const exportSuccessBannerPath = resolve(process.cwd(), 'src/components/ExportSuccessBanner.jsx')
const appPath = resolve(process.cwd(), 'src/App.jsx')
const summaryCardsPath = resolve(process.cwd(), 'src/components/SummaryCards.jsx')
const appStylesPath = resolve(process.cwd(), 'src/styles/app.css')
const analystPlaybookPath = resolve(process.cwd(), 'src/components/AnalystPlaybook.jsx')

test('Detected Indicators controls keep expected wrapper classes for aligned toggle and Copy All layout', () => {
  const componentSource = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(componentSource.includes('className="indicator-controls"'), true)
  assert.equal(componentSource.includes('className="indicator-mode-toggle"'), true)
  assert.equal(componentSource.includes('className="copy-all-button"'), true)
})

test('responsive control wrapper styles exist for clean wrapping on mobile', () => {
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(cssSource.includes('.indicator-controls {'), true)
  assert.equal(cssSource.includes('.copy-all-button {'), true)
  assert.equal(cssSource.includes('@media (max-width: 720px)'), true)
})

test('KQL cards provide temporary copied state UI and restore button text after timeout', () => {
  const source = readFileSync(kqlCardsPath, 'utf8')

  assert.equal(source.includes("'Copy KQL'"), true)
  assert.equal(source.includes("'Copied ✓'"), true)
  assert.equal(source.includes('Copied!'), true)
  assert.equal(source.includes('KQL_COPY_RESET_MS = 1800'), true)
  assert.equal(source.includes('setTimeout(() => {'), true)
})

test('KQL copy flow does not use alert and keeps per-card copied state keyed by card key', () => {
  const source = readFileSync(kqlCardsPath, 'utf8')

  assert.equal(source.includes('alert('), false)
  assert.equal(source.includes('[cardKey]: true'), true)
  assert.equal(source.includes('[cardKey]: false'), true)
  assert.equal(source.includes('catch {'), true)
})

test('additional investigation card includes required title and message-only guidance', () => {
  const source = readFileSync(additionalInvestigationCardPath, 'utf8')

  assert.equal(source.includes('Additional Investigation Required'), true)
  assert.equal(source.includes('additional-investigation-card'), true)
  assert.equal(source.includes('{message}'), true)
  assert.equal(source.includes('Copy Emails'), false)
  assert.equal(source.includes('sender-email-list'), false)
})

test('workflow selector uses badge buttons for Microsoft Defender and CrowdStrike only', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('className="workflow-selector"'), true)
  assert.equal(source.includes('workflow-badge-button'), true)
  assert.equal(source.includes('onWorkflowModeChange(WORKFLOW_MODE.DEFENDER)'), true)
  assert.equal(source.includes('onWorkflowModeChange(WORKFLOW_MODE.CROWDSTRIKE)'), true)
  assert.equal(source.includes('Microsoft Defender'), true)
  assert.equal(source.includes('CrowdStrike'), true)
  assert.equal(source.includes('workflowModeSelect'), false)
})

test('Control panel places Analyze IOCs action in the intake section', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('className="button-row intake-primary-action sticky-action-bar"'), true)
  assert.equal(source.includes("{processingInFlight ? 'Analyzing...' : 'Analyze IOCs'}"), true)
  assert.equal(source.includes('onClick={onProcess}'), true)
  assert.equal(source.includes('onClick={onExport}'), true)
  assert.equal(source.includes('onClick={onCrowdStrikeExport}'), true)
  assert.equal(source.includes('onClick={onSecondaryExport}'), true)
  assert.equal(source.includes('button-clear'), true)
})

test('Control panel renders Campaign name input only in Defender workflow', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('showDefenderControls && ('), true)
  assert.equal(source.includes('htmlFor="campaignNameInput"'), true)
  assert.equal(source.includes('id="campaignNameInput"'), true)
})

test('Control panel renders CrowdStrike severity and description configuration', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('id="crowdstrikeSeverity"'), true)
  assert.equal(source.includes('id="crowdstrikeDescription"'), true)
  assert.equal(source.includes('onCrowdStrikeSeverityChange'), true)
  assert.equal(source.includes('onCrowdStrikeDescriptionChange'), true)
})

test('App does not render a standalone Export Actions section', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('className="card export-actions-panel"'), false)
  assert.equal(source.includes('Export Actions'), false)
})

test('App wires workflow mode and keeps Defender/CrowdStrike outputs isolated', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [workflowMode, setWorkflowMode] = useState(WORKFLOW_MODE.DEFENDER)'), true)
  assert.equal(source.includes('displayedWorkflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('<KqlCards'), true)
  assert.equal(source.includes('queries={parseResult.kqlQueries}'), true)
  assert.equal(source.includes('<CrowdStrikeResults'), true)
  assert.equal(source.includes('<CrowdStrikeBlockingExport'), false)
  assert.equal(source.includes('<QradarExport'), false)
})

test('App shows Detected Indicators as a shared workflow-independent section only when detected IOC groups exist', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const detectedIndicators = getDetectedIndicators(parseResult?.indicators)'), true)
  assert.equal(source.includes('const showIndicatorResults = Boolean(parseResult) && detectedIndicators.length > 0 && !isProcessingInputs'), true)
  assert.equal(source.includes('{showIndicatorResults && ('), true)
  assert.equal(source.includes('<IndicatorResults'), true)
  assert.equal(source.includes('indicators={parseResult.indicators}'), true)
  assert.equal(source.includes('{workflowPresentation.isDefender && <IndicatorResults indicators={parseResult.indicators} />}'), false)
})

test('App supports global file drag-and-drop overlay with drag counter and file-only filtering', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('function hasFilesInDataTransfer(dataTransfer)'), true)
  assert.equal(source.includes("Array.from(dataTransfer.types || []).includes('Files')"), true)
  assert.equal(source.includes('const [isGlobalFileDragActive, setIsGlobalFileDragActive] = useState(false)'), true)
  assert.equal(source.includes('const globalFileDragDepthRef = useRef(0)'), true)
  assert.equal(source.includes('globalFileDragDepthRef.current += 1'), true)
  assert.equal(source.includes('globalFileDragDepthRef.current = Math.max(0, globalFileDragDepthRef.current - 1)'), true)
  assert.equal(source.includes("window.addEventListener('dragenter', handleWindowDragEnter, true)"), true)
  assert.equal(source.includes("window.addEventListener('dragover', handleWindowDragOver, true)"), true)
  assert.equal(source.includes("window.addEventListener('dragleave', handleWindowDragLeave, true)"), true)
  assert.equal(source.includes("window.addEventListener('drop', handleWindowDrop, true)"), true)
  assert.equal(source.includes('event.preventDefault()'), true)
  assert.equal(source.includes('await handleUpload(files)'), true)
  assert.equal(source.includes('className="global-file-drop-overlay"'), true)
  assert.equal(source.includes('DROP FILES ANYWHERE'), true)
})

test('Global drop overlay styles are full-page, dark, and readable with reduced-motion support', () => {
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(cssSource.includes('.global-file-drop-overlay {'), true)
  assert.equal(cssSource.includes('position: fixed;'), true)
  assert.equal(cssSource.includes('inset: 0;'), true)
  assert.equal(cssSource.includes('backdrop-filter: blur(5px);'), true)
  assert.equal(cssSource.includes('animation: global-drop-overlay-in 140ms ease-out;'), true)
  assert.equal(cssSource.includes('.global-file-drop-panel {'), true)
  assert.equal(cssSource.includes('border: 1px solid rgba(96, 165, 250, 0.62);'), false)
  assert.equal(cssSource.includes('background: linear-gradient(160deg, rgba(10, 20, 38, 0.92) 0%, rgba(8, 17, 31, 0.9) 100%);'), false)
  assert.equal(cssSource.includes('box-shadow: 0 0 0 1px rgba(96, 165, 250, 0.26), 0 14px 34px rgba(2, 6, 18, 0.62);'), false)
  assert.equal(cssSource.includes('.global-file-drop-title {'), true)
  assert.equal(cssSource.includes('font-weight: 700;'), true)
  assert.equal(cssSource.includes('text-transform: uppercase;'), true)
  assert.equal(cssSource.includes('@media (prefers-reduced-motion: reduce)'), true)
  assert.equal(cssSource.includes('.global-file-drop-overlay {'), true)
  assert.equal(cssSource.includes('animation: none;'), true)
})

test('Detected Indicators render order stays between Detection Summary and workflow-specific outputs for both workflows', () => {
  const source = readFileSync(appPath, 'utf8')

  const summaryIndex = source.indexOf('<SummaryCards')
  const indicatorIndex = source.indexOf('<IndicatorResults')
  const kqlIndex = source.indexOf('queries={parseResult.kqlQueries}')
  const crowdStrikeIndex = source.indexOf('<CrowdStrikeResults')

  assert.equal(summaryIndex > -1, true)
  assert.equal(indicatorIndex > -1, true)
  assert.equal(kqlIndex > -1, true)
  assert.equal(crowdStrikeIndex > -1, true)
  assert.equal(summaryIndex < indicatorIndex, true)
  assert.equal(indicatorIndex < kqlIndex, true)
  assert.equal(indicatorIndex < crowdStrikeIndex, true)
})

test('Indicator copy affordances remain available', () => {
  const source = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(source.includes('Copy All'), true)
  assert.equal(source.includes('onClick={copyAllIndicators}'), true)
  assert.equal(source.includes('onClick={() => copySingleGroup(group)}'), true)
})

test('Detected indicator groups use per-group animated panels with aria-hidden state', () => {
  const source = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(source.includes('const INDICATOR_PANEL_FAST_PATH_THRESHOLD = 48'), true)
  assert.equal(source.includes('const LARGE_PANEL_TRANSITION_MS = 160'), true)
  assert.equal(source.includes("const isExpanded = Boolean(expandedGroups[group.label])"), true)
  assert.equal(source.includes('const useFastPanelPath = group.items.length > INDICATOR_PANEL_FAST_PATH_THRESHOLD'), true)
  assert.equal(source.includes('requestAnimationFrame(() => {'), true)
  assert.equal(source.includes('setTimeout(() => {'), true)
  assert.equal(source.includes('const shouldRenderFastPanel = Boolean(largePanelPresence[group.label]) || isExpanded'), true)
  assert.equal(source.includes("indicator-group-panel${useFastPanelPath ? ' indicator-group-panel-large' : ''}${!useFastPanelPath && isExpanded ? ' expanded' : ''}${useFastPanelPath && isFastPanelVisible ? ' indicator-group-panel-large-visible' : ''}"), true)
  assert.equal(source.includes('aria-hidden={!isExpanded}'), true)
  assert.equal(source.includes('id={groupElementId}'), true)
})

test('Detected indicator styles keep sibling cards independent and animate expand/collapse smoothly', () => {
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(cssSource.includes('align-items: start;'), true)
  assert.equal(cssSource.includes('.indicator-group-panel {'), true)
  assert.equal(cssSource.includes('grid-template-rows: 0fr;'), true)
  assert.equal(cssSource.includes('.indicator-group-panel.expanded {'), true)
  assert.equal(cssSource.includes('grid-template-rows: 1fr;'), true)
  assert.equal(cssSource.includes('transition: grid-template-rows 200ms ease-in-out, opacity 200ms ease-in-out, transform 200ms ease-in-out;'), true)
  assert.equal(cssSource.includes('.indicator-group-panel-large {'), true)
  assert.equal(cssSource.includes('.indicator-group-panel-large .indicator-group-panel-inner {'), true)
  assert.equal(cssSource.includes('transition: opacity 160ms ease-out, transform 160ms ease-out;'), true)
  assert.equal(cssSource.includes('transform: translateY(-6px);'), true)
  assert.equal(cssSource.includes('.indicator-group-panel-large.indicator-group-panel-large-visible .indicator-group-panel-inner {'), true)
})

test('Expanded header feedback relies on chevron and subtle border state rather than pressed-style fill', () => {
  const componentSource = readFileSync(indicatorResultsPath, 'utf8')
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(componentSource.includes('className={`indicator-chevron${isExpanded ? \' expanded\' : \'\'}`}'), true)
  assert.equal(cssSource.includes('.indicator-group.expanded .indicator-group-toggle {'), true)
  assert.equal(cssSource.includes('background: rgba(28, 48, 86, 0.9);'), true)
})

test('CrowdStrike layout order is detection summary then query then sender card', () => {
  const source = readFileSync(appPath, 'utf8')

  const parseResultBlockIndex = source.indexOf('{parseResult && !isProcessingInputs && (')
  const summaryIndex = source.indexOf('<SummaryCards')
  const crowdStrikeBranchIndex = source.indexOf(') : (')
  const queryIndex = source.indexOf('<CrowdStrikeResults', crowdStrikeBranchIndex)
  const senderIndex = source.indexOf('<AdditionalInvestigationCard message={additionalInvestigationMessage} />', queryIndex)

  assert.equal(parseResultBlockIndex > -1, true)
  assert.equal(summaryIndex > -1, true)
  assert.equal(crowdStrikeBranchIndex > -1, true)
  assert.equal(queryIndex > -1, true)
  assert.equal(senderIndex > -1, true)
  assert.equal(parseResultBlockIndex < summaryIndex, true)
  assert.equal(summaryIndex < queryIndex, true)
  assert.equal(queryIndex < senderIndex, true)
})

test('Export Summary and Recent Activity sections are removed from App layout', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('<ExportSummaryCards'), false)
  assert.equal(source.includes('<RecentActivity'), false)
})

test('CrowdStrike query card includes required title description and compact copyable query output', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('Advanced Event Search Query'), true)
  assert.equal(source.includes('Search all detected indicators in CrowdStrike Advanced Event Search.'), true)
  assert.equal(source.includes('Copy Query'), true)
  assert.equal(source.includes('IOC count:'), false)
  assert.equal(source.includes('IOC types:'), false)
})

test('CrowdStrike query copy payload exactly matches displayed query and raises success callback', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('navigator.clipboard.writeText(queryData.query)'), true)
  assert.equal(source.includes('<pre className="query-block query-block-single-line">{queryData.query}</pre>'), true)
  assert.equal(source.includes('onCopySuccess?.()'), true)
})

test('CrowdStrike results render improved empty-state wording', () => {
  const source = readFileSync(crowdStrikeResultsPath, 'utf8')

  assert.equal(source.includes('No CrowdStrike sweep query available.'), true)
})

test('CrowdStrike and QRadar configuration cards are removed from results area', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('CrowdStrike Blocking Export'), false)
  assert.equal(source.includes('QRadar Blocking Export'), false)
  assert.equal(source.includes('<CrowdStrikeBlockingExport'), false)
  assert.equal(source.includes('<QradarExport'), false)
})

test('Detection Summary includes Export Eligibility subsection labels and note', () => {
  const source = readFileSync(summaryCardsPath, 'utf8')

  assert.equal(source.includes('Export Eligibility'), true)
  assert.equal(source.includes('CrowdStrike Blocking Eligible'), true)
  assert.equal(source.includes('QRadar Eligible IPs'), true)
  assert.equal(source.includes('Only IPv4, MD5, and SHA256 indicators are eligible for CrowdStrike blocking.'), true)
})

test('App shows query copy toasts and uses export success banner for export confirmations', () => {
  const source = readFileSync(appPath, 'utf8')
  const bannerSource = readFileSync(exportSuccessBannerPath, 'utf8')

  assert.equal(source.includes("✓ Query copied"), true)
  assert.equal(source.includes('showExportSuccessBanner({'), true)
  assert.equal(source.includes("Microsoft Defender IOC CSV exported successfully"), true)
  assert.equal(source.includes("CrowdStrike IOC CSV exported successfully"), true)
  assert.equal(source.includes("QRadar IOC CSV exported successfully"), true)
  assert.equal(source.includes('<ExportSuccessBanner'), true)
  assert.equal(source.includes('banner={exportSuccessBanner}'), true)
  assert.equal(source.includes('onClose={dismissExportSuccessBanner}'), true)
  assert.equal(bannerSource.includes('function ExportSuccessBanner({ banner, isClosing = false, onClose })'), true)
  assert.equal(source.includes('<ToastMessage toast={toast} />'), true)
})

test('export success banner shows a title and details line', () => {
  const source = readFileSync(exportSuccessBannerPath, 'utf8')

  assert.equal(source.includes('export-success-title'), true)
  assert.equal(source.includes('export-success-details'), true)
})

test('App stores a transient export success banner instead of persistent export summaries', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [exportSuccessBanner, setExportSuccessBanner] = useState(null)'), true)
  assert.equal(source.includes('setExportSuccessBanner(null)'), true)
  assert.equal(source.includes('exportSummaries'), false)
})

test('App preserves existing export handlers while moving CrowdStrike controls to ControlPanel', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const handleCrowdStrikeExport = () => {'), true)
  assert.equal(source.includes('const handleQradarExport = () => {'), true)
  assert.equal(source.includes('exportCrowdStrikeBlockingCsv'), true)
  assert.equal(source.includes('exportQradarCsv'), true)
})

test('App preserves Campaign Name state across workflow switching', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [campaignName, setCampaignName] = useState(\'\')'), true)
  assert.equal(source.includes('onCampaignNameChange={setCampaignName}'), true)
  assert.equal(source.includes('setCampaignName(\'\')'), true)
})

test('Clear handler resets lookback to configured default', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('setLookbackDays(DEFAULT_LOOKBACK_DAYS)'), true)
})

test('App renders sender email card only in CrowdStrike workflow when sender addresses are present', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('buildAdditionalInvestigationMessage(parseResult?.indicators)'), true)
  assert.equal(source.includes('displayedWorkflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('<KqlCards'), true)
  assert.equal(source.includes('queries={parseResult.kqlQueries}'), true)
  assert.equal(source.includes('<AdditionalInvestigationCard message={additionalInvestigationMessage} />'), true)
  assert.equal(source.includes('<SenderEmailInfoCard'), false)
})

test('App integrates analyst playbook below workflow outputs and uses builder service', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('import AnalystPlaybook from'), true)
  assert.equal(source.includes('buildAnalystPlaybook'), true)
  assert.equal(source.includes('shouldShowAnalystPlaybook'), true)
  assert.equal(source.includes('{showAnalystPlaybook && <AnalystPlaybook playbook={playbook} />}'), true)
})

test('shared loading spinner component provides reusable message-based loading UI', () => {
  const source = readFileSync(loadingSpinnerPath, 'utf8')

  assert.equal(source.includes('function LoadingSpinner({ message, subtle = false })'), true)
  assert.equal(source.includes('<span className="loading-spinner" aria-hidden="true" />'), true)
  assert.equal(source.includes('<span>{message}</span>'), true)
})

test('App uses loading spinner during async processing and clears loading action state in success and failure flows', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('<LoadingSpinner message={activeLoadingMessage} />'), true)
  assert.equal(source.includes("setActiveLoadingAction('processing')"), true)
  assert.equal(source.includes("setActiveLoadingAction('uploading')"), true)
  assert.equal(source.includes("setActiveLoadingAction('defender-export')"), true)
  assert.equal((source.match(/setActiveLoadingAction\(null\)/g) || []).length >= 3, true)
  assert.equal((source.match(/setActiveLoadingMessage\(''\)/g) || []).length >= 3, true)
})

test('Control panel only disables controls related to processing and upload operations', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('const isProcessingInputs = processingInFlight || uploadingInFlight'), true)
  assert.equal(source.includes('disabled={isProcessingInputs}'), true)
  assert.equal(source.includes('disabled={backendActionsDisabled}'), true)
  assert.equal(source.includes("{processingInFlight ? 'Analyzing...' : 'Analyze IOCs'}"), true)
  assert.equal(source.includes('Paste IOC text or drag and drop CSV, XLSX, or TXT files onto the text area.'), true)
  assert.equal(source.includes('Drag and drop CSV, XLSX, or TXT files directly onto the IOC text area.'), false)
  assert.equal(source.includes('Total uploaded size:'), false)
  assert.equal(source.includes('onRegisterOpenFilePicker?.(openFilePicker)'), true)
})

test('workflow-specific results use transition container and only animate workflow content', () => {
  const appSource = readFileSync(appPath, 'utf8')
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(appSource.includes('workflow-content-transition workflow-content-transition-${workflowTransitionPhase}'), true)
  assert.equal(cssSource.includes('.workflow-content-transition {'), true)
  assert.equal(cssSource.includes('.workflow-transition-out {'), true)
  assert.equal(cssSource.includes('.workflow-transition-in {'), true)
  assert.equal(cssSource.includes('@keyframes workflow-fade-in'), false)
})

test('header is simplified and Ready to Analyze card is removed', () => {
  const appSource = readFileSync(appPath, 'utf8')

  assert.equal(appSource.includes('Built for SOC Operations'), true)
  assert.equal(appSource.includes('<h1>IOC Workbench</h1>'), true)
  assert.equal(appSource.includes('app-tagline'), false)
  assert.equal(appSource.includes('status-badge'), false)
  assert.equal(appSource.includes('EmptyState'), false)
})

test('parsing and clear flows are silent while copy/export confirmations remain', () => {
  const appSource = readFileSync(appPath, 'utf8')

  assert.equal(appSource.includes('✓ Parsing completed'), false)
  assert.equal(appSource.includes('✓ Clear completed'), false)
  assert.equal(appSource.includes('✓ Query copied'), true)
  assert.equal(appSource.includes('showExportSuccessBanner({'), true)
})

test('Analyst playbook component and styles include card sections without automatic badges', () => {
  const componentSource = readFileSync(analystPlaybookPath, 'utf8')
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(componentSource.includes('Analyst Playbook'), false)
  assert.equal(componentSource.includes('className="card analyst-playbook"'), true)
  assert.equal(componentSource.includes('className="playbook-section-heading"'), true)
  assert.equal(componentSource.includes('Completed automatically'), false)
  assert.equal(cssSource.includes('.analyst-playbook {'), true)
})

test('ignored items toggle and ignored panel are removed from detected indicators UI', () => {
  const source = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(source.includes('Show ignored items'), false)
  assert.equal(source.includes('Hide ignored items'), false)
  assert.equal(source.includes('ignored-panel'), false)
})

test('shared loading styles are centralized in app stylesheet', () => {
  const source = readFileSync(appStylesPath, 'utf8')

  assert.equal(source.includes('.loading-card {'), true)
  assert.equal(source.includes('.loading-spinner-row {'), true)
  assert.equal(source.includes('.loading-spinner {'), true)
})
