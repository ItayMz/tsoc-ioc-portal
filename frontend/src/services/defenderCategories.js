export const DEFENDER_CATEGORIES = [
  'Collection',
  'CommandAndControl',
  'CredentialAccess',
  'DefenseEvasion',
  'Discovery',
  'Execution',
  'Exfiltration',
  'Exploit',
  'InitialAccess',
  'LateralMovement',
  'Malware',
  'Persistence',
  'PrivilegeEscalation',
  'Ransomware',
  'SuspiciousActivity',
  'UnwantedSoftware',
]

export const DEFENDER_CATEGORY_LABELS = {
  Collection: 'Collection',
  CommandAndControl: 'Command and Control',
  CredentialAccess: 'Credential Access',
  DefenseEvasion: 'Defense Evasion',
  Discovery: 'Discovery',
  Execution: 'Execution',
  Exfiltration: 'Exfiltration',
  Exploit: 'Exploit',
  InitialAccess: 'Initial Access',
  LateralMovement: 'Lateral Movement',
  Malware: 'Malware',
  Persistence: 'Persistence',
  PrivilegeEscalation: 'Privilege Escalation',
  Ransomware: 'Ransomware',
  SuspiciousActivity: 'Suspicious Activity',
  UnwantedSoftware: 'Unwanted Software',
}

export const DEFENDER_CATEGORY_OPTIONS = DEFENDER_CATEGORIES.map((value) => ({
  value,
  label: DEFENDER_CATEGORY_LABELS[value] || value,
}))

export const DEFAULT_DEFENDER_CATEGORY = 'Malware'

export function getDefenderCategoryLabel(value) {
  return DEFENDER_CATEGORY_LABELS[value] || value
}

export function normalizeDefaultCategory(value) {
  const normalized = String(value || '').trim()
  if (!normalized) {
    return DEFAULT_DEFENDER_CATEGORY
  }

  return DEFENDER_CATEGORIES.includes(normalized)
    ? normalized
    : DEFAULT_DEFENDER_CATEGORY
}
