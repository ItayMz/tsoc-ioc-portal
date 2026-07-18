function normalizeIndicatorType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function hasAnyDetectedType(indicators, acceptedTypes) {
  const accepted = new Set(acceptedTypes.map((type) => normalizeIndicatorType(type)))

  return (indicators || []).some((indicator) => {
    if (!indicator?.valid) {
      return false
    }

    return accepted.has(normalizeIndicatorType(indicator?.indicator_type))
  })
}

export function hasDetectedIpIndicators(indicators) {
  return hasAnyDetectedType(indicators, ['ipv4', 'ipaddress', 'ip'])
}

export function hasDetectedSenderEmailIndicators(indicators) {
  return hasAnyDetectedType(indicators, ['senderemailaddress', 'sender_email_address', 'senderemail', 'email'])
}

export function buildAdditionalInvestigationMessage(indicators) {
  const hasIp = hasDetectedIpIndicators(indicators)
  const hasSenderEmail = hasDetectedSenderEmailIndicators(indicators)

  if (hasIp && hasSenderEmail) {
    return 'IP address and sender email indicators were detected. Investigate the IP addresses in QRadar Log Activity and the sender email addresses in Mail Relay / Forcepoint. Refer to the Detected Indicators section for the relevant values.'
  }

  if (hasIp) {
    return 'IP address indicators were detected. Investigate them in QRadar Log Activity. Refer to the Detected Indicators section for the relevant values.'
  }

  if (hasSenderEmail) {
    return 'Sender email indicators were detected. Investigate them in Mail Relay / Forcepoint. Refer to the Detected Indicators section for the relevant values.'
  }

  return null
}
