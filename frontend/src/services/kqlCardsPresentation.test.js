import assert from 'node:assert/strict'
import test from 'node:test'

import { getVisibleKqlCards } from './kqlCardsPresentation.js'

test('File Hash Query card replaces separate MD5/SHA1/SHA256 cards', () => {
  const cards = getVisibleKqlCards({
    fileHash: {
      query: 'let IOC_HASHES = dynamic(["a"]);\nunion DeviceFileEvents',
      count: 1,
      lookbackDays: 90,
      tables: ['DeviceProcessEvents', 'DeviceNetworkEvents', 'DeviceFileEvents', 'DeviceRegistryEvents', 'EmailAttachmentInfo'],
    },
    md5: { query: 'legacy query' },
    sha1: { query: 'legacy query' },
    sha256: { query: 'legacy query' },
  })

  assert.deepEqual(cards.map((card) => card.title), ['File Hash Query'])
  assert.equal(cards[0].tables.includes('DeviceFileEvents'), true)
})

test('IP Query card replaces separate IPv4/IPv6 cards and keeps official table metadata', () => {
  const cards = getVisibleKqlCards({
    ip: {
      query: 'let IOC_IPS = dynamic(["8.8.8.8"]);\nDeviceNetworkEvents',
      count: 1,
      lookbackDays: 30,
      tables: ['DeviceNetworkEvents'],
    },
    ipv4: { query: 'legacy ipv4 query' },
    ipv6: { query: 'legacy ipv6 query' },
  })

  assert.deepEqual(cards.map((card) => card.title), ['IP Query'])
  assert.deepEqual(cards[0].tables, ['DeviceNetworkEvents'])
})

test('URL / Web Domain Query combines domains and URLs and keeps official table metadata', () => {
  const cards = getVisibleKqlCards({
    urlWebDomain: {
      query: 'EmailUrlInfo\n| union DeviceNetworkEvents\n| where Url contains "evil.com" or RemoteUrl contains "evil.com"',
      count: 2,
      lookbackDays: 7,
      tables: ['EmailUrlInfo', 'DeviceNetworkEvents'],
    },
    domains: { query: 'legacy domains query' },
    urls: { query: 'legacy urls query' },
  })

  assert.deepEqual(cards.map((card) => card.title), ['URL / Web Domain Query'])
  assert.deepEqual(cards[0].tables, ['EmailUrlInfo', 'DeviceNetworkEvents'])
})

test('only official query cards are surfaced and empty cards are omitted', () => {
  const cards = getVisibleKqlCards({
    fileHash: null,
    ip: { query: 'ip query', count: 1, lookbackDays: 90, tables: ['DeviceNetworkEvents'] },
    urlWebDomain: { query: 'url query', count: 1, lookbackDays: 90, tables: ['EmailUrlInfo', 'DeviceNetworkEvents'] },
    urls: { query: 'legacy urls query' },
  })

  assert.deepEqual(cards.map((card) => card.key), ['ip', 'urlWebDomain'])
})
