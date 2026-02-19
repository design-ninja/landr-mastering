import styles from './TimelineSlider.module.scss'
import type { CSSProperties } from 'react'

interface TimelineSliderProps {
  currentTime: number
  duration: number
  onSeek: (timeInSeconds: number) => void
}

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    return '0:00'
  }

  const totalSeconds = Math.floor(value)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

export function TimelineSlider({ currentTime, duration, onSeek }: TimelineSliderProps) {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  const safeCurrentTime = Math.min(Math.max(currentTime, 0), safeDuration || 0)
  const progress = safeDuration ? `${(safeCurrentTime / safeDuration) * 100}%` : '0%'

  return (
    <div className={styles.section}>
      <label className={styles.label} htmlFor="timeline-slider">
        Timeline
      </label>
      <input
        id="timeline-slider"
        className={styles.slider}
        type="range"
        min={0}
        max={safeDuration || 1}
        step={0.01}
        value={safeCurrentTime}
        onChange={(event) => onSeek(Number(event.currentTarget.value))}
        disabled={!safeDuration}
        style={{ '--progress': progress } as CSSProperties}
      />
      <div className={styles.timeRow}>
        <span>{formatTime(safeCurrentTime)}</span>
        <span>{formatTime(safeDuration)}</span>
      </div>
    </div>
  )
}
