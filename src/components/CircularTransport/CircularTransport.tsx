import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import styles from './CircularTransport.module.scss'

interface CircularTransportProps {
  isPlaying: boolean
  progress: number
  disabled?: boolean
  onTogglePlay: () => void
  onSeekByProgress: (nextProgress: number) => void
}

const VIEWBOX_SIZE = 280
const CENTER = VIEWBOX_SIZE / 2
const RADIUS = 116
const START_SNAP_THRESHOLD = 0.04
const START_WRAP_GUARD = 0.94

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

export function CircularTransport({
  isPlaying,
  progress,
  disabled = false,
  onTogglePlay,
  onSeekByProgress,
}: CircularTransportProps) {
  const ringRef = useRef<SVGSVGElement | null>(null)
  const [isScrubbing, setIsScrubbing] = useState(false)

  const clampedProgress = clamp(Number.isFinite(progress) ? progress : 0, 0, 1)
  const circumference = useMemo(() => 2 * Math.PI * RADIUS, [])
  const dashOffset = circumference * (1 - clampedProgress)

  const seekFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = ringRef.current
      if (!svg || disabled) {
        return
      }

      const rect = svg.getBoundingClientRect()
      const x = clientX - rect.left
      const y = clientY - rect.top

      const dx = x - rect.width / 2
      const dy = y - rect.height / 2
      let angle = Math.atan2(dy, dx) + Math.PI / 2

      if (angle < 0) {
        angle += 2 * Math.PI
      }

      const rawProgress = angle / (2 * Math.PI)
      let nextProgress = rawProgress

      if (rawProgress <= START_SNAP_THRESHOLD) {
        nextProgress = 0
      } else if (
        clampedProgress <= START_SNAP_THRESHOLD &&
        rawProgress >= START_WRAP_GUARD
      ) {
        nextProgress = 0
      }

      onSeekByProgress(nextProgress)
    },
    [clampedProgress, disabled, onSeekByProgress],
  )

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) {
      return
    }

    event.preventDefault()
    seekFromPointer(event.clientX, event.clientY)
    setIsScrubbing(true)
  }

  useEffect(() => {
    if (!isScrubbing) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      seekFromPointer(event.clientX, event.clientY)
    }

    const handlePointerUp = () => {
      setIsScrubbing(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [isScrubbing, seekFromPointer])

  const knobAngle = clampedProgress * 2 * Math.PI - Math.PI / 2
  const knobX = CENTER + RADIUS * Math.cos(knobAngle)
  const knobY = CENTER + RADIUS * Math.sin(knobAngle)

  return (
    <div className={styles.wrapper}>
      <svg
        ref={ringRef}
        className={styles.ring}
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        onPointerDown={handlePointerDown}
        aria-label="Seek through track"
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clampedProgress * 100)}
        aria-disabled={disabled}
      >
        <circle className={styles.track} cx={CENTER} cy={CENTER} r={RADIUS} />
        <circle
          className={`${styles.progress} ${isScrubbing ? styles.progressNoAnimation : ''}`}
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
        <circle className={styles.knob} cx={knobX} cy={knobY} r={12} />
      </svg>

      <button
        type="button"
        className={styles.button}
        onClick={onTogglePlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? (
          <span className={styles.pauseIcon} aria-hidden="true" />
        ) : (
          <svg
            className={styles.playIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M7.5 5.2c0-1.24 1.37-1.99 2.41-1.31l8.33 5.3c0.95 0.61 0.95 2.01 0 2.62l-8.33 5.3c-1.04 0.67-2.41-0.08-2.41-1.31V5.2Z" />
          </svg>
        )}
      </button>
    </div>
  )
}
