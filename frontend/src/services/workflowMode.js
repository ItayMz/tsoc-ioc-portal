export const WORKFLOW_MODE = {
  DEFENDER: 'defender',
  CROWDSTRIKE: 'crowdstrike',
}

export const DEFENDER_SENDER_GUIDANCE = 'The following sender email address(es) were detected. Continue the investigation in Microsoft Defender Explorer under Email & Collaboration, and perform any required blocking there.'
export const CROWDSTRIKE_SENDER_GUIDANCE = 'The following sender email address(es) were detected. Search the sender in QRadar and Forcepoint Mail Relay as part of the investigation.'

export function normalizeWorkflowMode(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === WORKFLOW_MODE.CROWDSTRIKE) {
    return WORKFLOW_MODE.CROWDSTRIKE
  }

  return WORKFLOW_MODE.DEFENDER
}

export function getWorkflowPresentation(mode) {
  const normalizedMode = normalizeWorkflowMode(mode)
  const isDefender = normalizedMode === WORKFLOW_MODE.DEFENDER

  return {
    mode: normalizedMode,
    isDefender,
    isCrowdStrike: normalizedMode === WORKFLOW_MODE.CROWDSTRIKE,
    senderGuidanceMessage: isDefender ? DEFENDER_SENDER_GUIDANCE : CROWDSTRIKE_SENDER_GUIDANCE,
  }
}