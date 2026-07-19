import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DEFAULT_DEFENDER_CATEGORY,
  DEFENDER_CATEGORIES,
  DEFENDER_CATEGORY_OPTIONS,
  getDefenderCategoryLabel,
  normalizeDefaultCategory,
} from './defenderCategories.js'

test('supported Defender categories include Malware default', () => {
  assert.equal(DEFAULT_DEFENDER_CATEGORY, 'Malware')
  assert.equal(DEFENDER_CATEGORIES.includes('Malware'), true)
})

test('normalizeDefaultCategory keeps supported values', () => {
  assert.equal(normalizeDefaultCategory('Ransomware'), 'Ransomware')
})

test('normalizeDefaultCategory falls back to Malware when value is missing', () => {
  assert.equal(normalizeDefaultCategory(null), 'Malware')
  assert.equal(normalizeDefaultCategory(''), 'Malware')
})

test('normalizeDefaultCategory falls back to Malware when value is invalid', () => {
  assert.equal(normalizeDefaultCategory('TotallyInvalidCategory'), 'Malware')
})

test('defender category options expose friendly labels while preserving canonical values', () => {
  const credentialOption = DEFENDER_CATEGORY_OPTIONS.find((option) => option.value === 'CredentialAccess')
  const commandOption = DEFENDER_CATEGORY_OPTIONS.find((option) => option.value === 'CommandAndControl')

  assert.deepEqual(credentialOption, { value: 'CredentialAccess', label: 'Credential Access' })
  assert.deepEqual(commandOption, { value: 'CommandAndControl', label: 'Command and Control' })
  assert.notEqual(credentialOption.label, credentialOption.value)
  assert.notEqual(commandOption.label, commandOption.value)
})

test('getDefenderCategoryLabel returns explicit display labels without changing values', () => {
  assert.equal(getDefenderCategoryLabel('PrivilegeEscalation'), 'Privilege Escalation')
  assert.equal(getDefenderCategoryLabel('SuspiciousActivity'), 'Suspicious Activity')
  assert.equal(getDefenderCategoryLabel('Malware'), 'Malware')
})
