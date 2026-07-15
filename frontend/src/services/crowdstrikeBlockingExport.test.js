import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildCrowdStrikeBlockingCsv,
  buildCrowdStrikeExportFilename,
  CROWDSTRIKE_BLOCKING_CSV_COLUMNS,
  CROWDSTRIKE_BLOCKING_EXPORT_TYPE_ORDER,
  CROWDSTRIKE_BLOCKING_FIXED_APPLIED_GLOBALLY,
  CROWDSTRIKE_BLOCKING_FIXED_PLATFORMS,
  CROWDSTRIKE_DEFAULT_DESCRIPTION,
  CROWDSTRIKE_DEFAULT_SEVERITY,
  getCrowdStrikeBlockingEligibleCount,
  getCrowdStrikeBlockingRows,
  getCrowdStrikeTotalDetectedCount,
  normalizeCrowdStrikeSeverity,
} from './crowdstrikeBlockingExport.js'

function indicator(indicatorType, refangedValue, valid = true, originalValue = null) {
  return {
    indicator_type: indicatorType,
    refanged_value: refangedValue,
    original_value: originalValue ?? refangedValue,
    valid,
  }
}

test('only IPv4 MD5 and SHA256 are included in blocking rows', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
    indicator('FileMd5', 'b'.repeat(32)),
    indicator('IpAddress', '10.0.0.1'),
    indicator('IpAddress', '2001:db8::1'),
    indicator('FileSha1', 'c'.repeat(40)),
    indicator('DomainName', 'evil.com'),
    indicator('Url', 'https://evil.com'),
    indicator('SenderEmailAddress', 'user@test.com'),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.deepEqual(rows.map((row) => row.type), ['sha256', 'md5', 'ipv4'])
})

test('type and action mappings are exact', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
    indicator('FileMd5', 'b'.repeat(32)),
    indicator('IpAddress', '10.10.10.10'),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.deepEqual(rows.map((row) => [row.type, row.action]), [
    ['sha256', 'prevent'],
    ['md5', 'prevent'],
    ['ipv4', 'detect'],
  ])
})

test('default severity is high and medium is supported', () => {
  assert.equal(CROWDSTRIKE_DEFAULT_SEVERITY, 'high')
  assert.equal(normalizeCrowdStrikeSeverity('medium'), 'medium')
})

test('unsupported severity values are normalized safely', () => {
  assert.equal(normalizeCrowdStrikeSeverity('critical'), 'high')
  assert.equal(normalizeCrowdStrikeSeverity(''), 'high')
})

test('default description constant is preserved', () => {
  assert.equal(CROWDSTRIKE_DEFAULT_DESCRIPTION, 'Sent by the customer via email')
})

test('edited description is applied to every row and empty description remains empty', () => {
  const rowsWithDescription = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
    indicator('FileMd5', 'b'.repeat(32)),
  ], { severity: 'high', description: 'Custom text' })

  assert.deepEqual(rowsWithDescription.map((row) => row.description), ['Custom text', 'Custom text'])

  const rowsWithEmptyDescription = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
  ], { severity: 'high', description: '' })

  assert.equal(rowsWithEmptyDescription[0].description, '')
})

test('platforms and applied_globally are fixed', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.equal(rows[0].platforms, CROWDSTRIKE_BLOCKING_FIXED_PLATFORMS)
  assert.equal(rows[0].applied_globally, CROWDSTRIKE_BLOCKING_FIXED_APPLIED_GLOBALLY)
})

test('CSV columns are in exact required order with header row', () => {
  const result = buildCrowdStrikeBlockingCsv([
    indicator('FileSha256', 'a'.repeat(64)),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  const [header] = result.csv.split('\n')
  assert.equal(header, CROWDSTRIKE_BLOCKING_CSV_COLUMNS.join(','))
})

test('duplicate indicators are exported once and refanged values are used', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64), true, 'a'.repeat(64)),
    indicator('FileSha256', 'A'.repeat(64), true, 'A'.repeat(64)),
    indicator('FileMd5', 'd94873ad85946c78543fce6eb38cee78', true, 'd94873ad85946c78543fce6eb38cee78'),
    indicator('IpAddress', '193.115.16.32', true, '193.115.16.32'),
    indicator('DomainName', 'evil.com', true, 'evil[.]com'),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((row) => row.value), [
    'a'.repeat(64),
    'd94873ad85946c78543fce6eb38cee78',
    '193.115.16.32',
  ])
})

test('rows are ordered SHA256 then MD5 then IPv4 with stable order within type', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('IpAddress', '8.8.8.8'),
    indicator('FileMd5', '1'.repeat(32)),
    indicator('FileSha256', '2'.repeat(64)),
    indicator('FileMd5', '3'.repeat(32)),
    indicator('FileSha256', '4'.repeat(64)),
    indicator('IpAddress', '1.1.1.1'),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.deepEqual(rows.map((row) => row.type), ['sha256', 'sha256', 'md5', 'md5', 'ipv4', 'ipv4'])
  assert.deepEqual(rows.map((row) => row.value), [
    '2'.repeat(64),
    '4'.repeat(64),
    '1'.repeat(32),
    '3'.repeat(32),
    '8.8.8.8',
    '1.1.1.1',
  ])
})

test('eligible count includes only unique IPv4 MD5 SHA256 indicators', () => {
  const count = getCrowdStrikeBlockingEligibleCount([
    indicator('IpAddress', '8.8.8.8'),
    indicator('IpAddress', '8.8.8.8'),
    indicator('FileMd5', 'a'.repeat(32)),
    indicator('FileSha256', 'b'.repeat(64)),
    indicator('DomainName', 'evil.com'),
    indicator('SenderEmailAddress', 'user@test.com'),
  ])

  assert.equal(count, 3)
})

test('total detected count includes all valid parsed indicators', () => {
  const totalDetectedCount = getCrowdStrikeTotalDetectedCount([
    indicator('IpAddress', '8.8.8.8', true),
    indicator('FileMd5', 'a'.repeat(32), true),
    indicator('FileSha1', 'b'.repeat(40), true),
    indicator('DomainName', 'evil.com', true),
    indicator('SenderEmailAddress', 'user@test.com', true),
    indicator('Url', 'https://evil.com', false),
  ])

  assert.equal(totalDetectedCount, 5)
})

test('no CSV is produced when no eligible blocking indicators exist', () => {
  const result = buildCrowdStrikeBlockingCsv([
    indicator('DomainName', 'evil.com'),
    indicator('Url', 'https://evil.com'),
    indicator('SenderEmailAddress', 'user@test.com'),
  ], { severity: 'high', description: CROWDSTRIKE_DEFAULT_DESCRIPTION })

  assert.equal(result, null)
})

test('filename uses campaign name and falls back to crowdstrike-iocs.csv', () => {
  assert.equal(buildCrowdStrikeExportFilename('Q3 Campaign'), 'Q3-Campaign-crowdstrike-iocs.csv')
  assert.equal(buildCrowdStrikeExportFilename(''), 'crowdstrike-iocs.csv')
})

test('filename invalid characters are sanitized', () => {
  assert.equal(
    buildCrowdStrikeExportFilename('Ops:/"Alpha"*<2026>?'),
    'Ops-Alpha-2026-crowdstrike-iocs.csv',
  )
})

test('CSV escaping handles commas quotes and line breaks in description and quotes platforms field', () => {
  const result = buildCrowdStrikeBlockingCsv([
    indicator('FileSha256', 'a'.repeat(64)),
  ], { severity: 'high', description: 'line1, "quoted"\nline2' })

  assert.equal(result.csv.includes('"windows,mac,linux"'), true)
  assert.equal(result.csv.includes('"line1, ""quoted""\nline2"'), true)
})

test('formula-injection sensitive description values are neutralized', () => {
  const rows = getCrowdStrikeBlockingRows([
    indicator('FileSha256', 'a'.repeat(64)),
  ], { severity: 'high', description: '=SUM(1,2)' })

  assert.equal(rows[0].description, "'=SUM(1,2)")
})

test('exports the exact supported blocking IOC type order contract', () => {
  assert.deepEqual(CROWDSTRIKE_BLOCKING_EXPORT_TYPE_ORDER, ['sha256', 'md5', 'ipv4'])
})
