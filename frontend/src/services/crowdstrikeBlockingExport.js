export const CROWDSTRIKE_BLOCKING_CSV_COLUMNS = [
  'type',
  'value',
  'action',
  'severity',
  'description',
  'platforms',
  'applied_globally',
]

export const CROWDSTRIKE_BLOCKING_EXPORT_TYPE_ORDER = ['sha256', 'md5', 'ipv4']
export const CROWDSTRIKE_BLOCKING_FIXED_PLATFORMS = 'windows,mac,linux'
export const CROWDSTRIKE_BLOCKING_FIXED_APPLIED_GLOBALLY = 'TRUE'
export const CROWDSTRIKE_DEFAULT_SEVERITY = 'high'
export const CROWDSTRIKE_DEFAULT_DESCRIPTION = 'Sent by the customer via email'

const SEVERITY_VALUES = new Set(['high', 'medium'])

const ACTION_BY_TYPE = {
  sha256: 'prevent',
  md5: 'prevent',
  ipv4: 'detect',
}

function normalizeRawType(indicatorType) {
  return String(indicatorType || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
}

function resolveBlockingType(indicator) {
  const type = normalizeRawType(indicator?.indicator_type)

  if (type === 'filesha256' || type === 'sha256') {
    return 'sha256'
  }

  if (type === 'filemd5' || type === 'md5') {
    return 'md5'
  }

  if (type === 'ipv4') {
    return 'ipv4'
  }

  if (type === 'ipaddress' || type === 'ip') {
    const value = String(indicator?.refanged_value || indicator?.original_value || '')
    return value.includes(':') ? null : 'ipv4'
  }

  return null
}

function getIndicatorValue(indicator) {
  return String(indicator?.refanged_value || indicator?.original_value || '').trim()
}

function normalizeForDedupe(value) {
  return value.toLowerCase()
}

function sanitizeUserCsvField(value) {
  const raw = String(value || '')
  if (!raw) {
    return ''
  }

  return /^\s*[=+\-@]/.test(raw) ? `'${raw}` : raw
}

function csvEscape(value) {
  const serialized = String(value ?? '')
  if (!/[",\n\r]/.test(serialized)) {
    return serialized
  }

  return `"${serialized.replace(/"/g, '""')}"`
}

function buildCsv(rows) {
  const header = CROWDSTRIKE_BLOCKING_CSV_COLUMNS.join(',')
  const body = rows.map((row) => CROWDSTRIKE_BLOCKING_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(','))

  return [header, ...body].join('\n')
}

function sanitizeCampaignName(name) {
  const normalized = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-. ]+|[-. ]+$/g, '')

  return normalized
}

export function normalizeCrowdStrikeSeverity(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (SEVERITY_VALUES.has(normalized)) {
    return normalized
  }

  return CROWDSTRIKE_DEFAULT_SEVERITY
}

export function getCrowdStrikeBlockingRows(indicators, { severity, description } = {}) {
  const normalizedSeverity = normalizeCrowdStrikeSeverity(severity)
  const safeDescription = sanitizeUserCsvField(description)
  const byType = new Map(CROWDSTRIKE_BLOCKING_EXPORT_TYPE_ORDER.map((type) => [type, []]))
  const seen = new Set()

  for (const indicator of indicators || []) {
    if (!indicator?.valid) {
      continue
    }

    const type = resolveBlockingType(indicator)
    if (!type || !byType.has(type)) {
      continue
    }

    const value = getIndicatorValue(indicator)
    if (!value) {
      continue
    }

    const dedupeKey = `${type}::${normalizeForDedupe(value)}`
    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    byType.get(type).push({
      type,
      value,
      action: ACTION_BY_TYPE[type],
      severity: normalizedSeverity,
      description: safeDescription,
      platforms: CROWDSTRIKE_BLOCKING_FIXED_PLATFORMS,
      applied_globally: CROWDSTRIKE_BLOCKING_FIXED_APPLIED_GLOBALLY,
    })
  }

  const ordered = []
  for (const type of CROWDSTRIKE_BLOCKING_EXPORT_TYPE_ORDER) {
    ordered.push(...byType.get(type))
  }

  return ordered
}

export function getCrowdStrikeBlockingEligibleCount(indicators) {
  return getCrowdStrikeBlockingRows(indicators, {
    severity: CROWDSTRIKE_DEFAULT_SEVERITY,
    description: CROWDSTRIKE_DEFAULT_DESCRIPTION,
  }).length
}

export function getCrowdStrikeTotalDetectedCount(indicators) {
  return (indicators || []).filter((indicator) => Boolean(indicator?.valid)).length
}

export function buildCrowdStrikeBlockingCsv(indicators, { severity, description } = {}) {
  const rows = getCrowdStrikeBlockingRows(indicators, { severity, description })
  if (!rows.length) {
    return null
  }

  return {
    rows,
    csv: buildCsv(rows),
  }
}

export function buildCrowdStrikeExportFilename(campaignName) {
  const sanitized = sanitizeCampaignName(campaignName)
  if (!sanitized) {
    return 'crowdstrike-iocs.csv'
  }

  return `${sanitized}-crowdstrike-iocs.csv`
}

export function exportCrowdStrikeBlockingCsv(indicators, { severity, description, campaignName } = {}) {
  const exportData = buildCrowdStrikeBlockingCsv(indicators, { severity, description })
  if (!exportData) {
    return false
  }

  const filename = buildCrowdStrikeExportFilename(campaignName)
  const blob = new Blob([exportData.csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
  return true
}