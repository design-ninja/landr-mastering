import type { TrackId, TrackVariant } from '../../types/audio'
import styles from './TrackSelector.module.scss'

interface TrackSelectorProps {
  tracks: TrackVariant[]
  activeTrackId: TrackId
  onSelect: (trackId: TrackId) => void
}

export function TrackSelector({ tracks, activeTrackId, onSelect }: TrackSelectorProps) {
  return (
    <div className={styles.container} role="tablist" aria-label="Track variant selector">
      {tracks.map((track) => {
        const isActive = track.id === activeTrackId

        return (
          <button
            key={track.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`${styles.trackButton} ${isActive ? styles.active : ''}`}
            onClick={() => onSelect(track.id)}
          >
            <span className={styles.badge}>{track.badge}</span>
            <span className={styles.label}>{track.label}</span>
          </button>
        )
      })}
    </div>
  )
}
