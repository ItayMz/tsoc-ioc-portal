import { useEffect, useRef, useState } from 'react'
import { DEFENDER_CATEGORY_OPTIONS } from '../services/defenderCategories.js'
import { WORKFLOW_MODE } from '../services/workflowMode.js'
import Icon from './Icon.jsx'
import ThemedSelect from './ThemedSelect.jsx'

function ControlPanel({
  rawText,
  lookbackDays,
  campaignName,
  defaultCategory,
  workflowMode,
  uploadSummary,
  processingInFlight,
  uploadingInFlight,
  exportInFlight,
  lookbackRefreshing,
  onRawTextChange,
  onLookbackChange,
  onCampaignNameChange,
  onDefaultCategoryChange,
  onWorkflowModeChange,
  onProcess,
  onUpload,
  queuedFiles,
  onRemoveQueuedFile,
  onExport,
  onSecondaryExport,
  onCrowdStrikeExport,
  onClear,
  exportButtonLabel,
  exportDisabled,
  secondaryExportButtonLabel,
  secondaryExportDisabled,
  hasAccumulatedResult,
  backendConnected,
  backendActionsDisabled,
  showDefenderControls,
  crowdStrikeSeverity,
  crowdStrikeDescription,
  onCrowdStrikeSeverityChange,
  onCrowdStrikeDescriptionChange,
  crowdStrikeExportDisabled,
  workflowTransitionPhase,
  clearVersion,
  onRegisterOpenFilePicker,
  panelRef,
}) {
  const uploadRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const isProcessingInputs = processingInFlight || uploadingInFlight

  const openFilePicker = () => {
    if (backendActionsDisabled) {
      return
    }

    uploadRef.current?.click()
  }

  useEffect(() => {
    setIsDragOver(false)
  }, [clearVersion])

  useEffect(() => {
    onRegisterOpenFilePicker?.(openFilePicker)

    return () => {
      onRegisterOpenFilePicker?.(null)
    }
  }, [onRegisterOpenFilePicker, backendActionsDisabled])

  const onFilePicked = async (event) => {
    const files = Array.from(event.target.files || [])
    if (!files.length || backendActionsDisabled) {
      return
    }

    await onUpload(files)
    event.target.value = ''
  }

  const onDragOver = (event) => {
    event.preventDefault()

    if (backendActionsDisabled) {
      return
    }

    setIsDragOver(true)
  }

  const onDragLeave = (event) => {
    event.preventDefault()
    setIsDragOver(false)
  }

  const onDrop = async (event) => {
    event.preventDefault()
    setIsDragOver(false)

    if (backendActionsDisabled) {
      return
    }

    const files = Array.from(event.dataTransfer?.files || [])
    if (!files.length || backendActionsDisabled) {
      return
    }

    await onUpload(files)
  }

  return (
    <section className="card control-panel" ref={panelRef}>
      <div className="panel-top">
        <h2>Workflow</h2>
        <p className="muted">Select the target workflow first, then provide indicators for analysis.</p>
      </div>

      <div className="workflow-selector" role="tablist" aria-label="Workflow selector">
        <button
          type="button"
          className={`workflow-badge-button${workflowMode === WORKFLOW_MODE.DEFENDER ? ' active' : ''}`}
          onClick={() => onWorkflowModeChange(WORKFLOW_MODE.DEFENDER)}
          disabled={isProcessingInputs}
        >
          <Icon name="defender" className="inline-icon" /> Microsoft Defender
        </button>
        <button
          type="button"
          className={`workflow-badge-button${workflowMode === WORKFLOW_MODE.CROWDSTRIKE ? ' active' : ''}`}
          onClick={() => onWorkflowModeChange(WORKFLOW_MODE.CROWDSTRIKE)}
          disabled={isProcessingInputs}
        >
          <Icon name="crowdstrike" className="inline-icon" /> CrowdStrike
        </button>
      </div>

      <div className="panel-top">
        <h2>IOC Intake</h2>
        <p className="muted">Paste IOC text or drag and drop CSV, XLSX, or TXT files onto the text area.</p>
      </div>

      <textarea
        className={`ioc-textarea ioc-intake-textarea${isDragOver ? ' ioc-textarea-drag-over' : ''}`}
        value={rawText}
        onChange={(event) => onRawTextChange(event.target.value)}
        placeholder="Paste IOC text here"
        disabled={isProcessingInputs}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      />

      <div className="intake-file-row">
        <button type="button" className="intake-main-action-button" onClick={openFilePicker} disabled={backendActionsDisabled}>
          <Icon name="upload" className="inline-icon" /> Browse Files
        </button>
      </div>

      {queuedFiles.length > 0 && (
        <div className="file-queue" aria-live="polite">
          {queuedFiles.map((fileEntry) => (
            <span className="file-chip" key={fileEntry.id}>
              <span>{fileEntry.name}</span>
              <button
                type="button"
                className="file-chip-remove"
                onClick={() => onRemoveQueuedFile(fileEntry.id)}
                aria-label={`Remove ${fileEntry.name}`}
                disabled={isProcessingInputs}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {!backendConnected && (
        <p className="muted">Upload processing is disabled until backend connection is available.</p>
      )}

      <div className={`workflow-transition-shell workflow-transition-${workflowTransitionPhase}`}>
        <div className="button-row intake-primary-action">
          <button className="primary intake-main-action-button" type="button" onClick={onProcess} disabled={backendActionsDisabled}>
            {processingInFlight ? 'Processing...' : 'Process IOCs'}
          </button>
          {showDefenderControls && (
            <button type="button" onClick={onExport} disabled={exportDisabled}>
              <Icon name="export" className="inline-icon" /> {exportInFlight ? 'Generating export...' : exportButtonLabel}
            </button>
          )}
          {!showDefenderControls && (
            <button type="button" onClick={onCrowdStrikeExport} disabled={crowdStrikeExportDisabled}>
              <Icon name="export" className="inline-icon" /> Export CrowdStrike CSV
            </button>
          )}
          {!showDefenderControls && (
            <button type="button" onClick={onSecondaryExport} disabled={secondaryExportDisabled}>
              <Icon name="qradar" className="inline-icon" /> {secondaryExportButtonLabel}
            </button>
          )}
          <button type="button" className="button-clear" onClick={onClear} disabled={isProcessingInputs}>
            Clear
          </button>
        </div>

        <div className="control-row control-row-column analysis-options-heading-row">
          <label className="field-label analysis-options-label">Analysis Options</label>
        </div>

      {showDefenderControls && (
        <div className="control-row analysis-option-row">
          <label className="field-label" htmlFor="campaignNameInput">Campaign name</label>
          <input
            id="campaignNameInput"
            className="campaign-input"
            type="text"
            value={campaignName}
            onChange={(event) => onCampaignNameChange(event.target.value)}
            placeholder="Optional campaign name"
            disabled={isProcessingInputs}
          />
        </div>
      )}

      {showDefenderControls && (
        <div className="control-row analysis-option-row">
          <label className="field-label" htmlFor="lookbackSelect">Lookback</label>
          <ThemedSelect
            id="lookbackSelect"
            label="Lookback"
            value={lookbackDays}
            onValueChange={(nextValue) => onLookbackChange(Number(nextValue))}
            disabled={isProcessingInputs || lookbackRefreshing}
            options={[
              { value: 7, label: 'Last 7 days' },
              { value: 30, label: 'Last 30 days' },
              { value: 90, label: 'Last 90 days' },
              { value: 180, label: 'Last 180 days' },
              { value: 365, label: 'Last 365 days' },
            ]}
          />
        </div>
      )}

      {showDefenderControls && (
        <div className="control-row analysis-option-row">
          <label className="field-label" htmlFor="defaultCategorySelect">Default Category</label>
          <ThemedSelect
            id="defaultCategorySelect"
            label="Default Category"
            value={defaultCategory}
            onValueChange={onDefaultCategoryChange}
            disabled={isProcessingInputs}
            options={DEFENDER_CATEGORY_OPTIONS}
          />
        </div>
      )}

      {!showDefenderControls && (
        <>
          <div className="control-row">
            <label className="field-label" htmlFor="crowdstrikeSeverity">Severity</label>
            <ThemedSelect
              id="crowdstrikeSeverity"
              label="Severity"
              value={crowdStrikeSeverity}
              onValueChange={onCrowdStrikeSeverityChange}
              disabled={isProcessingInputs}
              options={[
                { value: 'high', label: 'high' },
                { value: 'medium', label: 'medium' },
              ]}
            />
          </div>

          <div className="control-row control-row-column">
            <label className="field-label" htmlFor="crowdstrikeDescription">Description</label>
            <textarea
              id="crowdstrikeDescription"
              className="ioc-textarea crowdstrike-description"
              value={crowdStrikeDescription}
              onChange={(event) => onCrowdStrikeDescriptionChange(event.target.value)}
              placeholder="Optional description applied to every exported row"
              disabled={isProcessingInputs}
            />
          </div>
        </>
      )}

        {!showDefenderControls && (
          <p className="muted workflow-note">CrowdStrike workflow selected. Defender-specific outputs are hidden.</p>
        )}
      </div>

      {uploadSummary && (
        <div className="upload-summary" role="status" aria-live="polite">
          <p><strong>Campaign name detected:</strong> {uploadSummary.detectedCampaignName || 'None'}</p>
          <p><strong>IOCs extracted:</strong> {uploadSummary.iocsExtracted}</p>
          {uploadSummary.warning && <p className="summary-warning">{uploadSummary.warning}</p>}
        </div>
      )}

      <input
        ref={uploadRef}
        type="file"
        accept=".csv,.txt,.xlsx"
        multiple
        onChange={onFilePicked}
        className="hidden-input"
        disabled={backendActionsDisabled}
      />
    </section>
  )
}

export default ControlPanel
