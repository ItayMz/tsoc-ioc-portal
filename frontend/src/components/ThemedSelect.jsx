import * as Select from '@radix-ui/react-select'
import Icon from './Icon.jsx'

function ThemedSelect({ id, label, value, onValueChange, disabled = false, options = [] }) {
  return (
    <Select.Root value={String(value)} onValueChange={onValueChange} disabled={disabled}>
      <Select.Trigger id={id} className="lookback-select ioc-select-trigger" aria-label={label}>
        <Select.Value />
        <Select.Icon className="ioc-select-chevron" aria-hidden="true">
          <Icon name="chevron-down" className="inline-icon" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="ioc-select-content"
          position="popper"
          side="bottom"
          align="start"
          sideOffset={6}
          avoidCollisions={false}
          collisionPadding={8}
        >
          <Select.Viewport className="ioc-select-viewport">
            {options.map((option) => (
              <Select.Item key={String(option.value)} value={String(option.value)} className="ioc-select-item">
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="ioc-select-item-indicator" aria-hidden="true">
                  <Icon name="check" className="inline-icon" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

export default ThemedSelect