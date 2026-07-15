import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indicatorResultsPath = resolve(process.cwd(), 'src/components/IndicatorResults.jsx')
const kqlCardsPath = resolve(process.cwd(), 'src/components/KqlCards.jsx')
const senderEmailInfoCardPath = resolve(process.cwd(), 'src/components/SenderEmailInfoCard.jsx')
const crowdStrikeQueryCardPath = resolve(process.cwd(), 'src/components/CrowdStrikeQueryCard.jsx')
const crowdStrikeResultsPath = resolve(process.cwd(), 'src/components/CrowdStrikeResults.jsx')
const crowdStrikeBlockingExportPath = resolve(process.cwd(), 'src/components/CrowdStrikeBlockingExport.jsx')
const controlPanelPath = resolve(process.cwd(), 'src/components/ControlPanel.jsx')
const appPath = resolve(process.cwd(), 'src/App.jsx')
const appStylesPath = resolve(process.cwd(), 'src/styles/app.css')

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
  assert.equal(source.includes("Copied!"), true)
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

test('workflow selector supports Microsoft Defender and CrowdStrike only', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('id="workflowModeSelect"'), true)
  assert.equal(source.includes('Microsoft Defender'), true)
  assert.equal(source.includes('CrowdStrike'), true)
  assert.equal(source.includes('QRadar'), false)
})

test('control panel uses a shared workflow export button in main action row', () => {
  const source = readFileSync(controlPanelPath, 'utf8')

  assert.equal(source.includes('{exportButtonLabel}'), true)
  assert.equal(source.includes('onClick={onExport}'), true)
  assert.equal(source.includes('disabled={exportDisabled}'), true)
})

test('Control panel places CrowdStrike blocking configuration before the shared action bar', () => {
  const source = readFileSync(controlPanelPath, 'utf8')
  const configIndex = source.indexOf('{crowdStrikeConfigSection}')
  const actionRowIndex = source.indexOf('className="button-row"')

  assert.equal(configIndex > -1, true)
  assert.equal(actionRowIndex > -1, true)
  assert.equal(configIndex < actionRowIndex, true)
})

test('App wires workflow mode to gate Defender KQL cards and show CrowdStrike query results', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [workflowMode, setWorkflowMode] = useState(WORKFLOW_MODE.DEFENDER)'), true)
  assert.equal(source.includes('workflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('<KqlCards queries={parseResult.kqlQueries} />'), true)
  assert.equal(source.includes('<CrowdStrikeResults'), true)
  assert.equal(source.includes('indicators={parseResult.indicators}'), true)
  assert.equal(source.includes("'Export Defender CSV'"), true)
  assert.equal(source.includes("'Export CrowdStrike CSV'"), true)
  assert.equal(source.includes('activeExportHandler'), true)
  assert.equal(source.includes('handleCrowdStrikeExport'), true)
  assert.equal(source.includes('crowdStrikeConfigSection={!workflowPresentation.isDefender ? ('), true)
  assert.equal(source.includes('setWorkflowMode(WORKFLOW_MODE.DEFENDER)'), true)
})

test('CrowdStrike query card includes required title description metadata and Copy Query button', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('Advanced Event Search Query'), true)
  assert.equal(source.includes('Search all detected indicators in CrowdStrike Advanced Event Search.'), true)
  assert.equal(source.includes('Copy Query'), true)
  assert.equal(source.includes('IOC count:'), true)
  assert.equal(source.includes('IOC types:'), true)
})

test('CrowdStrike query copy payload exactly matches the displayed query string', () => {
  const source = readFileSync(crowdStrikeQueryCardPath, 'utf8')

  assert.equal(source.includes('navigator.clipboard.writeText(queryData.query)'), true)
  assert.equal(source.includes('<pre className="query-block">{queryData.query}</pre>'), true)
})

test('CrowdStrike results renders empty-state message when no valid indicators are available', () => {
  const source = readFileSync(crowdStrikeResultsPath, 'utf8')

  assert.equal(source.includes('queryData ? ('), true)
  assert.equal(source.includes('No valid indicators are currently available for a CrowdStrike Advanced Event Search query.'), true)
})

test('CrowdStrike blocking export section includes required controls and guidance', () => {
  const source = readFileSync(crowdStrikeBlockingExportPath, 'utf8')

  assert.equal(source.includes('CrowdStrike Blocking Export'), true)
  assert.equal(source.includes('Only IPv4, MD5, and SHA256 indicators are included in the CrowdStrike blocking CSV.'), true)
  assert.equal(source.includes('id="crowdstrikeSeverity"'), true)
  assert.equal(source.includes('value="high"'), true)
  assert.equal(source.includes('value="medium"'), true)
  assert.equal(source.includes('id="crowdstrikeDescription"'), true)
  assert.equal(source.includes('Total detected:'), true)
  assert.equal(source.includes('Blocking eligible:'), true)
  assert.equal(source.includes('Only IPv4, MD5, and SHA256 indicators are eligible for CrowdStrike blocking. All other indicators are included in the Advanced Event Search query only.'), true)
  assert.equal(source.includes('<button'), false)
  assert.equal(source.includes('No IPv4, MD5, or SHA256 indicators are available for CrowdStrike blocking export.'), true)
  assert.equal(source.includes('Use the Export CrowdStrike CSV button in the main action bar to download the file.'), false)
})

test('CrowdStrike blocking export section calculates eligibility without owning export action', () => {
  const source = readFileSync(crowdStrikeBlockingExportPath, 'utf8')

  assert.equal(source.includes('buildCrowdStrikeBlockingCsv'), true)
  assert.equal(source.includes('exportCrowdStrikeBlockingCsv'), false)
  assert.equal(source.includes('campaignName'), false)
})

test('CrowdStrike results contain Advanced Event Search query only and no blocking configuration controls', () => {
  const source = readFileSync(crowdStrikeResultsPath, 'utf8')

  assert.equal(source.includes('Advanced Event Search Query'), false)
  assert.equal(source.includes('CrowdStrikeQueryCard'), true)
  assert.equal(source.includes('CrowdStrikeBlockingExport'), false)
})

test('ignored items toggle and ignored panel are removed from detected indicators UI', () => {
  const source = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(source.includes('Show ignored items'), false)
  assert.equal(source.includes('Hide ignored items'), false)
  assert.equal(source.includes('ignored-panel'), false)
})

test('App keeps CrowdStrike severity and description as workflow-specific state and resets on Clear', () => {
  const source = readFileSync(appPath, 'utf8')

  assert.equal(source.includes('const [crowdStrikeSeverity, setCrowdStrikeSeverity] = useState(CROWDSTRIKE_DEFAULT_SEVERITY)'), true)
  assert.equal(source.includes('const [crowdStrikeDescription, setCrowdStrikeDescription] = useState(CROWDSTRIKE_DEFAULT_DESCRIPTION)'), true)
  assert.equal(source.includes('setCrowdStrikeSeverity(CROWDSTRIKE_DEFAULT_SEVERITY)'), true)
  assert.equal(source.includes('setCrowdStrikeDescription(CROWDSTRIKE_DEFAULT_DESCRIPTION)'), true)
  assert.equal(source.includes('onSeverityChange={handleCrowdStrikeSeverityChange}'), true)
  assert.equal(source.includes('onDescriptionChange={setCrowdStrikeDescription}'), true)
})
