import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CROWDSTRIKE_SENDER_GUIDANCE,
  DEFENDER_SENDER_GUIDANCE,
  getWorkflowPresentation,
  normalizeWorkflowMode,
  WORKFLOW_MODE,
} from './workflowMode.js'

test('Microsoft Defender is the default workflow mode', () => {
  assert.equal(normalizeWorkflowMode(undefined), WORKFLOW_MODE.DEFENDER)
  assert.equal(normalizeWorkflowMode(''), WORKFLOW_MODE.DEFENDER)
  assert.equal(normalizeWorkflowMode('unknown'), WORKFLOW_MODE.DEFENDER)
})

test('CrowdStrike mode normalizes correctly', () => {
  assert.equal(normalizeWorkflowMode('crowdstrike'), WORKFLOW_MODE.CROWDSTRIKE)
  assert.equal(normalizeWorkflowMode('CROWDSTRIKE'), WORKFLOW_MODE.CROWDSTRIKE)
})

test('Defender presentation keeps Defender outputs and guidance', () => {
  const presentation = getWorkflowPresentation(WORKFLOW_MODE.DEFENDER)

  assert.equal(presentation.isDefender, true)
  assert.equal(presentation.isCrowdStrike, false)
  assert.equal(presentation.senderGuidanceMessage, DEFENDER_SENDER_GUIDANCE)
})

test('CrowdStrike presentation disables Defender outputs and uses investigation-only QRadar/Forcepoint guidance', () => {
  const presentation = getWorkflowPresentation(WORKFLOW_MODE.CROWDSTRIKE)

  assert.equal(presentation.isDefender, false)
  assert.equal(presentation.isCrowdStrike, true)
  assert.equal(presentation.senderGuidanceMessage, CROWDSTRIKE_SENDER_GUIDANCE)
  assert.equal(presentation.senderGuidanceMessage.includes('blocking'), false)
})