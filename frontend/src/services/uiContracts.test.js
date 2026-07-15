import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indicatorResultsPath = resolve(process.cwd(), 'src/components/IndicatorResults.jsx')
const kqlCardsPath = resolve(process.cwd(), 'src/components/KqlCards.jsx')
const senderEmailInfoCardPath = resolve(process.cwd(), 'src/components/SenderEmailInfoCard.jsx')
const crowdStrikeQueryCardPath = resolve(process.cwd(), 'src/components/CrowdStrikeQueryCard.jsx')
const crowdStrikeResultsPath = resolve(process.cwd(), 'src/components/CrowdStrikeResults.jsx')
const exportSummaryCardsPath = resolve(process.cwd(), 'src/components/ExportSummaryCards.jsx')
const controlPanelPath = resolve(process.cwd(), 'src/components/ControlPanel.jsx')
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

test('sender email workflow card includes required title, guidance, and Copy Emails button', () => {
  const source = readFileSync(senderEmailInfoCardPath, 'utf8')

  assert.equal(source.includes('Sender Email Addresses Detected'), true)
  assert.equal(source.includes('Copy Emails'), true)
  assert.equal(source.includes('{message}'), true)
  assert.equal(source.includes('sender-email-info-card sender-email-info-card-info'), true)
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

test('Control panel keeps workflow export action in main action row for Defender only', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('showDefenderControls && ('), true)
  assert.equal(source.includes('{exportButtonLabel}'), true)
  assert.equal(source.includes('onClick={onExport}'), true)
  assert.equal(source.includes('disabled={exportDisabled}'), true)
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

test('Control panel action row includes CrowdStrike and QRadar export buttons in CrowdStrike mode', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('onCrowdStrikeExport'), true)
  assert.equal(source.includes('Export CrowdStrike CSV'), true)
  assert.equal(source.includes('onSecondaryExport'), true)
  assert.equal(source.includes('{secondaryExportButtonLabel}'), true)
})

test('App wires workflow mode and keeps Defender/CrowdStrike outputs isolated', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [workflowMode, setWorkflowMode] = useState(WORKFLOW_MODE.DEFENDER)'), true)
  assert.equal(source.includes('workflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('<KqlCards queries={parseResult.kqlQueries} />'), true)
  assert.equal(source.includes('<CrowdStrikeResults'), true)
  assert.equal(source.includes('<CrowdStrikeBlockingExport'), false)
  assert.equal(source.includes('<QradarExport'), false)
})

test('CrowdStrike layout order is export summary then detection summary then query then sender card', () => {
  const source = readFileSync(appPath, 'utf8')

  const parseResultBlockIndex = source.indexOf('{parseResult && !loading && (')
  const exportSummaryIndex = source.indexOf('<ExportSummaryCards')
  const summaryIndex = source.indexOf('<SummaryCards')
  const crowdStrikeBranchIndex = source.indexOf(') : (')
  const queryIndex = source.indexOf('<CrowdStrikeResults', crowdStrikeBranchIndex)
  const senderIndex = source.indexOf('{showSenderEmailInfoCard && (', queryIndex)

  assert.equal(parseResultBlockIndex > -1, true)
  assert.equal(exportSummaryIndex > -1, true)
  assert.equal(summaryIndex > -1, true)
  assert.equal(crowdStrikeBranchIndex > -1, true)
  assert.equal(queryIndex > -1, true)
  assert.equal(senderIndex > -1, true)
  assert.equal(exportSummaryIndex < parseResultBlockIndex, true)
  assert.equal(exportSummaryIndex < summaryIndex, true)
  assert.equal(summaryIndex < queryIndex, true)
  assert.equal(queryIndex < senderIndex, true)
})

test('Export Summary is rendered once and no longer rendered at parse-result bottom location', () => {
  const source = readFileSync(appPath, 'utf8')

  const exportSummaryOccurrences = source.match(/<ExportSummaryCards/g) || []

  assert.equal(exportSummaryOccurrences.length, 1)
  assert.equal(source.includes('{exportSummaryEntries.length > 0 && <ExportSummaryCards summaries={exportSummaryEntries} />}'), true)
})

test('CrowdStrike query card includes required title description metadata and Copy Query button', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('Advanced Event Search Query'), true)
  assert.equal(source.includes('Search all detected indicators in CrowdStrike Advanced Event Search.'), true)
  assert.equal(source.includes('Copy Query'), true)
  assert.equal(source.includes('IOC count:'), true)
  assert.equal(source.includes('IOC types:'), true)
})

test('CrowdStrike query copy payload exactly matches displayed query and raises success callback', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('navigator.clipboard.writeText(queryData.query)'), true)
  assert.equal(source.includes('<pre className="query-block">{queryData.query}</pre>'), true)
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

test('App shows success toasts for query copy and each export type', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes("✓ Query copied"), true)
  assert.equal(source.includes("✓ Defender CSV exported"), true)
  assert.equal(source.includes("✓ CrowdStrike CSV exported"), true)
  assert.equal(source.includes("✓ QRadar CSV exported"), true)
  assert.equal(source.includes('<ToastMessage toast={toast} />'), true)
})

test('Export summary cards show exported count, export type, and filename', () => {
  const source = readFileSync(exportSummaryCardsPath, 'utf8')

  assert.equal(source.includes('Export Summary'), true)
  assert.equal(source.includes('Filename:'), true)
  assert.equal(source.includes('countLabel'), true)
})

test('App records independent export summaries for Defender CrowdStrike and QRadar', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('defender: null,'), true)
  assert.equal(source.includes('crowdstrike: null,'), true)
  assert.equal(source.includes('qradar: null,'), true)
  assert.equal(source.includes("title: 'Microsoft Defender IOC CSV'"), true)
  assert.equal(source.includes("title: 'CrowdStrike Blocking CSV'"), true)
  assert.equal(source.includes("title: 'QRadar CSV'"), true)
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

test('App renders sender email card only in CrowdStrike workflow when sender addresses are present', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('workflowPresentation.isCrowdStrike && senderEmailAddresses.length > 0'), true)
  assert.equal(source.includes('workflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('<KqlCards queries={parseResult.kqlQueries} />'), true)
  assert.equal(source.includes('No sender email addresses detected.'), false)
})

test('App integrates analyst playbook below workflow outputs and uses builder service', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('import AnalystPlaybook from'), true)
  assert.equal(source.includes('buildAnalystPlaybook'), true)
  assert.equal(source.includes('shouldShowAnalystPlaybook'), true)
  assert.equal(source.includes('{showAnalystPlaybook && <AnalystPlaybook playbook={playbook} />}'), true)
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
