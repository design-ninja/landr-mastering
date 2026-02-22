import type { AudioFormat } from '../../types/audio'
import styles from './FormatToggle.module.scss'

interface FormatToggleProps {
  format: AudioFormat
  onChange: (format: AudioFormat) => void
  disabled?: boolean
}

const FORMATS: AudioFormat[] = ['mp3', 'wav']

export function FormatToggle({
  format,
  onChange,
  disabled,
}: FormatToggleProps) {
  return (
    <div
      className={styles.container}
      role="radiogroup"
      aria-label="Audio format"
    >
      {FORMATS.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={f === format}
          className={`${styles.option} ${f === format ? styles.active : ''}`}
          onClick={() => onChange(f)}
          disabled={disabled}
        >
          {f.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
