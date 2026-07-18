import { WORKFLOW_MODE, normalizeWorkflowMode } from './workflowMode.js'

function normalizeIndicatorType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function getValidDetectedIndicators(indicators) {
  return (indicators || []).filter((indicator) => Boolean(indicator?.valid))
}

function hasAnyType(indicators, acceptedTypes) {
  const normalizedAcceptedTypes = new Set(acceptedTypes.map((type) => normalizeIndicatorType(type)))

  return getValidDetectedIndicators(indicators)
    .some((indicator) => normalizedAcceptedTypes.has(normalizeIndicatorType(indicator?.indicator_type)))
}

function buildSequentialSections(sections) {
  let stepNumber = 1

  const sequencedSections = []
  for (const section of sections) {
    const visibleSteps = section.steps
      .filter((step) => step.visible !== false)
      .map((step) => ({
        number: stepNumber++,
        text: step.text,
      }))

    if (!visibleSteps.length) {
      continue
    }

    sequencedSections.push({
      heading: section.heading,
      steps: visibleSteps,
    })
  }

  return sequencedSections
}

export function shouldShowAnalystPlaybook(indicators) {
  return getValidDetectedIndicators(indicators).length > 0
}

export function buildAnalystPlaybook({ workflowMode, indicators, generatedOutputs = {} }) {
  if (!shouldShowAnalystPlaybook(indicators)) {
    return {
      title: 'Next Investigation Steps',
      sections: [],
    }
  }

  const normalizedWorkflowMode = normalizeWorkflowMode(workflowMode)
  const isDefender = normalizedWorkflowMode === WORKFLOW_MODE.DEFENDER
  const hasSenderEmail = hasAnyType(indicators, ['senderemailaddress', 'sender_email_address', 'senderemail', 'email'])
  const hasIpv4 = hasAnyType(indicators, ['ipv4', 'ipaddress', 'ip'])
  const hasCustomerSideBlocking = hasAnyType(indicators, ['url', 'urls', 'domain', 'domains', 'domainname', 'senderemailaddress', 'sender_email_address', 'senderemail', 'email'])
  const crowdStrikeInvestigationGuidance = hasIpv4 && hasSenderEmail
    ? 'Perform additional investigation in QRadar Log Activity for IP indicators and in Mail Relay / Forcepoint for sender-email indicators. Refer to the Detected Indicators section for values.'
    : hasIpv4
      ? 'Perform an additional QRadar Log Activity investigation for detected IP indicators according to the SOC playbook. Refer to the Detected Indicators section for values.'
      : hasSenderEmail
        ? 'Investigate detected sender-email indicators in the Mail Relay / Forcepoint environment according to the SOC playbook. Refer to the Detected Indicators section for values.'
        : null

  const sections = isDefender
    ? [
      {
        heading: 'IOC Sweep',
        steps: [
          {
            text: 'Run the generated Advanced Hunting KQL queries.',
          },
          {
            text: 'Investigate any matching results.',
          },
        ],
      },
      {
        heading: 'Blocking',
        steps: [
          {
            text: 'Import the generated Microsoft Defender IOC CSV.',
          },
        ],
      },
      {
        heading: 'Ticket Handling',
        steps: [
          {
            text: 'Paste the processed indicators into the existing ticket.',
          },
        ],
      },
      {
        heading: 'Customer Communication',
        steps: [
          {
            text: 'Reply to the customer confirming that the requested indicators have been processed.',
          },
        ],
      },
    ]
    : [
      {
        heading: 'IOC Sweep',
        steps: [
          {
            text: 'Run the generated Advanced Event Search query in CrowdStrike.',
          },
          {
            text: crowdStrikeInvestigationGuidance,
            visible: Boolean(crowdStrikeInvestigationGuidance),
          },
          {
            text: 'Investigate any matching results.',
          },
        ],
      },
      {
        heading: 'Blocking',
        steps: [
          {
            text: 'Import the generated CrowdStrike blocking CSV.',
          },
          {
            text: 'Import the generated QRadar IPv4 CSV into the appropriate QRadar Reference Set.',
            visible: hasIpv4,
          },
        ],
      },
      {
        heading: 'Ticket Handling',
        steps: [
          {
            text: 'Paste the processed indicators into the existing ticket.',
          },
        ],
      },
      {
        heading: 'Customer Communication',
        steps: [
          {
            text: 'Reply to the customer confirming that the requested indicators have been processed.',
          },
          {
            text: 'If customer-side blocking is required (for example URLs, Domains, Mail Relay actions, or Proxy blocking), include those indicators in the reply to the customer.',
            visible: hasCustomerSideBlocking,
          },
        ],
      },
    ]

  return {
    title: 'Next Investigation Steps',
    sections: buildSequentialSections(sections),
  }
}
