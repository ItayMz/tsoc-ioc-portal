import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const indicatorResultsPath = resolve(process.cwd(), 'src/components/IndicatorResults.jsx')
const kqlCardsPath = resolve(process.cwd(), 'src/components/KqlCards.jsx')
const appStylesPath = resolve(process.cwd(), 'src/styles/app.css')

test('Detected Indicators controls keep expected wrapper classes for aligned toggle and Copy All layout', () => {
  const componentSource = readFileSync(indicatorResultsPath, 'utf8')

  assert.equal(componentSource.includes('className="indicator-controls"'), true)
  assert.equal(componentSource.includes('className="indicator-mode-toggle"'), true)
  assert.equal(componentSource.includes('className="copy-all-button"'), true)
})

test('responsive control wrapper styles exist for clean wrapping on mobile', () => {
  const cssSource = readFileSync(appStylesPath, 'utf8')

  assert.equal(cssSource.includes('.indicator-controls {'), true)
  assert.equal(cssSource.includes('.copy-all-button {'), true)
  assert.equal(cssSource.includes('@media (max-width: 720px)'), true)
})

test('KQL cards provide temporary copied state UI and restore button text after timeout', () => {
  const source = readFileSync(kqlCardsPath, 'utf8')

  assert.equal(source.includes("'Copy KQL'"), true)
  assert.equal(source.includes("'Copied ✓'"), true)
  assert.equal(source.includes("Copied!"), true)
  assert.equal(source.includes('KQL_COPY_RESET_MS = 1800'), true)
  assert.equal(source.includes('setTimeout(() => {'), true)
})

test('KQL copy flow does not use alert and keeps per-card copied state keyed by card key', () => {
  const source = readFileSync(kqlCardsPath, 'utf8')

  assert.equal(source.includes('alert('), false)
  assert.equal(source.includes('[cardKey]: true'), true)
  assert.equal(source.includes('[cardKey]: false'), true)
  assert.equal(source.includes('catch {'), true)
})
