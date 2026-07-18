import assert from 'node:assert/strict'
import test from 'node:test'

import { buildAdditionalInvestigationMessage } from './additionalInvestigationGuidance.js'

function buildIndicator(indicator_type, valid = true) {
  return {
    indicator_type,
    valid,
  }
}

test('additional investigation guidance renders IP-only message', () => {
  const message = buildAdditionalInvestigationMessage([
    buildIndicator('ipv4'),
    buildIndicator('sha256'),
  ])

  assert.equal(
    message,
    'IP address indicators were detected. Investigate them in QRadar Log Activity. Refer to the Detected Indicators section for the relevant values.',
  )
})

test('additional investigation guidance renders sender-email-only message', () => {
  const message = buildAdditionalInvestigationMessage([
    buildIndicator('senderemailaddress'),
    buildIndicator('domainname'),
  ])

  assert.equal(
    message,
    'Sender email indicators were detected. Investigate them in Mail Relay / Forcepoint. Refer to the Detected Indicators section for the relevant values.',
  )
})

test('additional investigation guidance renders combined message when both IP and sender-email are detected', () => {
  const message = buildAdditionalInvestigationMessage([
    buildIndicator('SenderEmailAddress'),
    buildIndicator('IpAddress'),
  ])

  assert.equal(
    message,
    'IP address and sender email indicators were detected. Investigate the IP addresses in QRadar Log Activity and the sender email addresses in Mail Relay / Forcepoint. Refer to the Detected Indicators section for the relevant values.',
  )
})

test('additional investigation guidance is hidden when neither IP nor sender-email is detected', () => {
  const message = buildAdditionalInvestigationMessage([
    buildIndicator('sha256'),
    buildIndicator('domainname'),
  ])

  assert.equal(message, null)
})
