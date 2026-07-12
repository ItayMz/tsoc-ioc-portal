import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyLookbackRefreshResult,
  buildLookbackRefreshPayload,
  DEFAULT_LOOKBACK_DAYS,
  LOOKBACK_REFRESH_FAILURE_MESSAGE,
  shouldAttemptLookbackRefresh,
} from './lookbackRefresh.js'

test('lookback refresh triggers only when connected, exportable, payload exists, and lookback actually changed', () => {
  const baseArgs = {
    nextLookbackDays: 30,
    backendConnected: true,
    canExport: true,
    lastSuccessfulParsePayload: { rawText: 'ioc', lookbackDays: 90, iocMetadata: [{ row: 1 }] },
    refreshInFlight: false,
  }

  assert.equal(shouldAttemptLookbackRefresh(baseArgs), true)
  assert.equal(shouldAttemptLookbackRefresh({ ...baseArgs, nextLookbackDays: 90 }), false)
  assert.equal(shouldAttemptLookbackRefresh({ ...baseArgs, backendConnected: false }), false)
  assert.equal(shouldAttemptLookbackRefresh({ ...baseArgs, canExport: false }), false)
  assert.equal(shouldAttemptLookbackRefresh({ ...baseArgs, lastSuccessfulParsePayload: null }), false)
  assert.equal(shouldAttemptLookbackRefresh({ ...baseArgs, refreshInFlight: true }), false)
})

test('lookback refresh payload reuses existing IOC payload and metadata with only lookbackDays updated', () => {
  const previousPayload = {
    rawText: 'ioc line one\nioc line two',
    lookbackDays: 90,
    campaignName: 'Campaign A',
    defaultCategory: 'Malware',
    iocMetadata: [{ value: 'example.com', campaignName: 'Campaign A' }],
  }

  const refreshedPayload = buildLookbackRefreshPayload(previousPayload, 7)

  assert.equal(refreshedPayload.lookbackDays, 7)
  assert.equal(refreshedPayload.rawText, previousPayload.rawText)
  assert.equal(refreshedPayload.campaignName, previousPayload.campaignName)
  assert.equal(refreshedPayload.defaultCategory, previousPayload.defaultCategory)
  assert.deepEqual(refreshedPayload.iocMetadata, previousPayload.iocMetadata)
})

test('lookback refresh result replaces KQL while preserving previously displayed parse context', () => {
  const previousResult = {
    indicators: [{ refanged_value: 'example.com', valid: true }],
    summary: { valid: 1 },
    kqlQueries: { urlWebDomain: 'old query' },
  }

  const refreshedResult = {
    indicators: [{ refanged_value: 'mutated-but-not-used', valid: true }],
    summary: { valid: 999 },
    kqlQueries: { urlWebDomain: 'new query' },
  }

  const merged = applyLookbackRefreshResult(previousResult, refreshedResult)

  assert.deepEqual(merged.indicators, previousResult.indicators)
  assert.deepEqual(merged.summary, previousResult.summary)
  assert.deepEqual(merged.kqlQueries, refreshedResult.kqlQueries)
})

test('lookback refresh failure message remains friendly and previous result can remain visible', () => {
  const previousResult = {
    indicators: [{ refanged_value: 'example.com', valid: true }],
    summary: { valid: 1 },
    kqlQueries: { urlWebDomain: 'stable query' },
  }

  assert.equal(
    LOOKBACK_REFRESH_FAILURE_MESSAGE,
    'Unable to refresh KQL queries for the selected lookback. Showing previous results.',
  )

  // Simulate a failed refresh by reusing previous queries as fallback.
  const merged = applyLookbackRefreshResult(previousResult, {})
  assert.deepEqual(merged.kqlQueries, previousResult.kqlQueries)
})

test('default lookback remains 90 for clear/reset workflow', () => {
  assert.equal(DEFAULT_LOOKBACK_DAYS, 90)
})
