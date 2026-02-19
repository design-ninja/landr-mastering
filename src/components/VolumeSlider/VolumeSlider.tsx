import styles from './VolumeSlider.module.scss'
import type { CSSProperties } from 'react'

interface VolumeSliderProps {
  volume: number
  onVolumeChange: (nextVolume: number) => void
}

export function VolumeSlider({ volume, onVolumeChange }: VolumeSliderProps) {
  const safeVolume = Math.min(Math.max(volume, 0), 1)
  const progress = `${safeVolume * 100}%`

  return (
    <div className={styles.section}>
      <div className={styles.row}>
        <label htmlFor="volume-slider" className={styles.label}>
          Volume
        </label>
        <span className={styles.value}>{Math.round(safeVolume * 100)}%</span>
      </div>
      <input
        id="volume-slider"
        className={styles.slider}
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={safeVolume}
        onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
        style={{ '--progress': progress } as CSSProperties}
      />
    </div>
  )
}
