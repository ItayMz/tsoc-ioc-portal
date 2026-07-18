import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDetectionSummary } from './summaryPresentation.js'

test('buildDetectionSummary returns detection-focused stats only', () => {
  const result = buildDetectionSummary({
    processed: 200,
    valid: 9,
    invalid: 191,
    invalid_count: 191,
    md5: 1,
    sha1: 1,
    sha256: 1,
    ipv4: 2,
    ipv6: 1,
    domains: 2,
    urls: 1,
    senderEmailAddresses: 2,
    duplicatesRemoved: 18,
    queriesGenerated: 7,
  })

  assert.equal(result.title, 'Detection Summary')
  assert.equal(result.totalDetected, 11)
  assert.deepEqual(
    result.breakdown.map((item) => item.label),
    ['MD5', 'SHA1', 'SHA256', 'IPv4', 'IPv6', 'Domains', 'URLs', 'Sender Email Addresses'],
  )
  assert.deepEqual(result.meta, [])
})

test('buildDetectionSummary normalizes missing values to zero', () => {
  const result = buildDetectionSummary({
    md5: undefined,
    sha1: null,
    sha256: 0,
    ipv4: 0,
    ipv6: 0,
    domains: 0,
    urls: 0,
    senderEmailAddresses: undefined,
  })

  assert.equal(result.totalDetected, 0)
  assert.deepEqual(result.meta, [])
  assert.equal(result.breakdown.every((item) => item.isMuted), true)
})

test('buildDetectionSummary returns null for empty summary input', () => {
  assert.equal(buildDetectionSummary(null), null)
})
