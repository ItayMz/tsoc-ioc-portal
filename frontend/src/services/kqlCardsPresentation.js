const OFFICIAL_KQL_CARD_CONFIG = [
  { key: 'fileHash', title: 'File Hash Query' },
  { key: 'ip', title: 'IP Query' },
  { key: 'urlWebDomain', title: 'URL / Web Domain Query' },
]

export function getVisibleKqlCards(queries) {
  if (!queries) {
    return []
  }

  return OFFICIAL_KQL_CARD_CONFIG
    .map(({ key, title }) => {
      const value = queries[key]
      if (!value?.query) {
        return null
      }

      return {
        key,
        title,
        ...value,
      }
    })
    .filter(Boolean)
}
