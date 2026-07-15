import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAnalystPlaybook, shouldShowAnalystPlaybook } from './playbookBuilder.js'
import { WORKFLOW_MODE } from './workflowMode.js'

function buildIndicator(type, valid = true) {
  return {
    indicator_type: type,
    valid,
    refanged_value: `${type}-value`,
  }
}

function getStepTexts(playbook) {
  return playbook.sections.flatMap((section) => section.steps.map((step) => step.text))
}

function getStepNumbers(playbook) {
  return playbook.sections.flatMap((section) => section.steps.map((step) => step.number))
}

const completedOutputs = {
  advancedHuntingKql: true,
  defenderIocCsv: true,
  crowdStrikeAdvancedEventSearchQuery: true,
  crowdStrikeBlockingCsv: true,
  qradarCsv: true,
}

test('Microsoft Defender playbook renders required sections and steps', () => {
  const playbook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: [
      buildIndicator('url'),
      buildIndicator('domainname'),
      buildIndicator('senderemailaddress'),
    ],
    generatedOutputs: completedOutputs,
  })

  assert.equal(playbook.title, 'Analyst Playbook')
  assert.deepEqual(
    playbook.sections.map((section) => section.heading),
    ['IOC Sweep', 'Blocking', 'Ticket Handling', 'Customer Communication'],
  )

  const stepTexts = getStepTexts(playbook)
  assert.equal(stepTexts.includes('Run the generated Advanced Hunting KQL queries.'), true)
  assert.equal(stepTexts.includes('Investigate any matching results.'), true)
  assert.equal(stepTexts.includes('Import the generated Microsoft Defender IOC CSV.'), true)
  assert.equal(stepTexts.includes('Paste the processed indicators into the existing ticket.'), true)
  assert.equal(stepTexts.includes('Reply to the customer confirming that the requested indicators have been processed.'), true)
  assert.equal(stepTexts.includes('If sender email addresses were detected, continue the investigation in Microsoft Defender Explorer under Email & Collaboration and perform any required blocking there.'), false)
})

test('CrowdStrike / QRadar playbook renders required sections and steps', () => {
  const playbook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [
      buildIndicator('ipv4'),
      buildIndicator('url'),
      buildIndicator('senderemailaddress'),
    ],
    generatedOutputs: completedOutputs,
  })

  assert.deepEqual(
    playbook.sections.map((section) => section.heading),
    ['IOC Sweep', 'Blocking', 'Ticket Handling', 'Customer Communication'],
  )

  const stepTexts = getStepTexts(playbook)
  assert.equal(stepTexts.includes('Run the generated Advanced Event Search query in CrowdStrike.'), true)
  assert.equal(stepTexts.includes('For IPv4 indicators, perform an additional IOC sweep in QRadar (Log Activity) using the source or destination IP filter.'), true)
  assert.equal(stepTexts.includes('If sender email addresses were detected, search the sender in QRadar and Forcepoint Mail Relay as part of the investigation.'), true)
  assert.equal(stepTexts.includes('Import the generated CrowdStrike blocking CSV.'), true)
  assert.equal(stepTexts.includes('Import the generated QRadar IPv4 CSV into the appropriate QRadar Reference Set.'), true)
  assert.equal(stepTexts.includes('If customer-side blocking is required (for example URLs, Domains, Mail Relay actions, or Proxy blocking), include those indicators in the reply to the customer.'), true)
})

test('Sender email playbook steps are hidden when no sender email indicators are detected', () => {
  const defenderPlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: [buildIndicator('domainname')],
    generatedOutputs: completedOutputs,
  })
  const crowdStrikePlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('ipv4')],
    generatedOutputs: completedOutputs,
  })

  const defenderStepTexts = getStepTexts(defenderPlaybook)
  const crowdStrikeStepTexts = getStepTexts(crowdStrikePlaybook)

  assert.equal(defenderStepTexts.some((text) => text.includes('Microsoft Defender Explorer under Email & Collaboration')), false)
  assert.equal(crowdStrikeStepTexts.some((text) => text.includes('Forcepoint Mail Relay')), false)
})

test('Defender playbook never includes a sender email step even when sender emails exist', () => {
  const defenderPlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: [buildIndicator('senderemailaddress')],
    generatedOutputs: completedOutputs,
  })

  const defenderStepTexts = getStepTexts(defenderPlaybook)

  assert.equal(defenderStepTexts.some((text) => text.includes('sender email addresses were detected')), false)
})

test('workflow switching updates sender-email playbook wording between Defender and CrowdStrike immediately', () => {
  const parsedIndicators = [buildIndicator('senderemailaddress')]

  const defenderPlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: parsedIndicators,
    generatedOutputs: completedOutputs,
  })
  const crowdStrikePlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: parsedIndicators,
    generatedOutputs: completedOutputs,
  })

  const defenderStepTexts = getStepTexts(defenderPlaybook)
  const crowdStrikeStepTexts = getStepTexts(crowdStrikePlaybook)

  assert.equal(defenderStepTexts.some((text) => text.includes('Forcepoint Mail Relay')), false)
  assert.equal(crowdStrikeStepTexts.includes('If sender email addresses were detected, search the sender in QRadar and Forcepoint Mail Relay as part of the investigation.'), true)
})

test('QRadar IOC sweep step is shown only when IPv4 indicators exist', () => {
  const withIpv4 = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('ipv4')],
    generatedOutputs: completedOutputs,
  })
  const withoutIpv4 = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('domainname')],
    generatedOutputs: completedOutputs,
  })

  assert.equal(getStepTexts(withIpv4).includes('For IPv4 indicators, perform an additional IOC sweep in QRadar (Log Activity) using the source or destination IP filter.'), true)
  assert.equal(getStepTexts(withoutIpv4).includes('For IPv4 indicators, perform an additional IOC sweep in QRadar (Log Activity) using the source or destination IP filter.'), false)
})

test('QRadar import step is shown only when IPv4 indicators exist', () => {
  const withIpv4 = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('ipv4')],
    generatedOutputs: completedOutputs,
  })
  const withoutIpv4 = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('domainname')],
    generatedOutputs: completedOutputs,
  })

  assert.equal(getStepTexts(withIpv4).includes('Import the generated QRadar IPv4 CSV into the appropriate QRadar Reference Set.'), true)
  assert.equal(getStepTexts(withoutIpv4).includes('Import the generated QRadar IPv4 CSV into the appropriate QRadar Reference Set.'), false)
})

test('customer-side blocking step is shown only when URL, Domain, or Sender Email indicators exist', () => {
  const withCustomerBlockingType = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('url')],
    generatedOutputs: completedOutputs,
  })
  const withoutCustomerBlockingType = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('sha256')],
    generatedOutputs: completedOutputs,
  })

  assert.equal(getStepTexts(withCustomerBlockingType).includes('If customer-side blocking is required (for example URLs, Domains, Mail Relay actions, or Proxy blocking), include those indicators in the reply to the customer.'), true)
  assert.equal(getStepTexts(withoutCustomerBlockingType).includes('If customer-side blocking is required (for example URLs, Domains, Mail Relay actions, or Proxy blocking), include those indicators in the reply to the customer.'), false)
})

test('workflow switching updates playbook content immediately with same parsed indicators', () => {
  const parsedIndicators = [buildIndicator('ipv4'), buildIndicator('senderemailaddress')]

  const defenderPlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: parsedIndicators,
    generatedOutputs: completedOutputs,
  })
  const crowdStrikePlaybook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: parsedIndicators,
    generatedOutputs: completedOutputs,
  })

  assert.equal(getStepTexts(defenderPlaybook).includes('Run the generated Advanced Hunting KQL queries.'), true)
  assert.equal(getStepTexts(defenderPlaybook).includes('Run the generated Advanced Event Search query in CrowdStrike.'), false)
  assert.equal(getStepTexts(crowdStrikePlaybook).includes('Run the generated Advanced Event Search query in CrowdStrike.'), true)
  assert.equal(getStepTexts(crowdStrikePlaybook).includes('Run the generated Advanced Hunting KQL queries.'), false)
})

test('playbook is hidden before parsing', () => {
  assert.equal(shouldShowAnalystPlaybook(undefined), false)
  assert.equal(shouldShowAnalystPlaybook(null), false)
})

test('playbook is hidden when parsing has zero valid indicators', () => {
  const indicators = [buildIndicator('ipv4', false), buildIndicator('url', false)]

  assert.equal(shouldShowAnalystPlaybook(indicators), false)
})

test('playbook is shown after successful parsing with at least one valid indicator', () => {
  assert.equal(shouldShowAnalystPlaybook([buildIndicator('ipv4')]), true)
})

test('clear-equivalent state hides the playbook immediately', () => {
  assert.equal(shouldShowAnalystPlaybook([buildIndicator('domainname')]), true)
  assert.equal(shouldShowAnalystPlaybook([]), false)
})

test('playbook step numbering has no duplicates and remains sequential after hidden steps are removed', () => {
  const playbook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.CROWDSTRIKE,
    indicators: [buildIndicator('sha256')],
    generatedOutputs: completedOutputs,
  })

  const numbers = getStepNumbers(playbook)
  const unique = new Set(numbers)

  assert.equal(unique.size, numbers.length)
  assert.deepEqual(numbers, [1, 2, 3, 4, 5])
})

test('generated wording remains in relevant steps without automatic badges', () => {
  const playbook = buildAnalystPlaybook({
    workflowMode: WORKFLOW_MODE.DEFENDER,
    indicators: [buildIndicator('url')],
    generatedOutputs: completedOutputs,
  })

  const stepTexts = getStepTexts(playbook)

  assert.equal(stepTexts.includes('Run the generated Advanced Hunting KQL queries.'), true)
  assert.equal(stepTexts.includes('Import the generated Microsoft Defender IOC CSV.'), true)
})
