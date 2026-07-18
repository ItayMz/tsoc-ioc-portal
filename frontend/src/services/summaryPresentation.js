const DETECTION_KEYS = [
  ['MD5', 'md5'],
  ['SHA1', 'sha1'],
  ['SHA256', 'sha256'],
  ['IPv4', 'ipv4'],
  ['IPv6', 'ipv6'],
  ['Domains', 'domains'],
  ['URLs', 'urls'],
  ['Sender Email Addresses', 'senderEmailAddresses'],
]

function toCount(value) {
  return typeof value === 'number' && value > 0 ? value : 0
}

export function buildDetectionSummary(summary) {
  if (!summary) {
    return null
  }

  const breakdown = DETECTION_KEYS.map(([label, key]) => ({
    label,
    value: toCount(summary[key]),
    isMuted: toCount(summary[key]) === 0,
  }))

  const totalDetected = breakdown.reduce((acc, item) => acc + item.value, 0)

  return {
    title: 'Detection Summary',
    totalDetected,
    breakdown,
    meta: [],
  }
}
