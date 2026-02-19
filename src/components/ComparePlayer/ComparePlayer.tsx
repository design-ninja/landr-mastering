import { TRACKS } from '../../data/tracks'
import { useComparePlayer } from '../../hooks/useComparePlayer'
import { CircularTransport } from '../CircularTransport/CircularTransport'
import { TrackSelector } from '../TrackSelector/TrackSelector'
import { VolumeSlider } from '../VolumeSlider/VolumeSlider'
import styles from './ComparePlayer.module.scss'

export function ComparePlayer() {
  const {
    activeTrack,
    activeTrackId,
    currentTime,
    duration,
    error,
    isPlaying,
    seek,
    setVolume,
    switchTrack,
    togglePlay,
    volume,
  } = useComparePlayer(TRACKS)

  const progress = duration > 0 ? currentTime / duration : 0
  const sourceName = activeTrack.file.split('/').at(-1) ?? 'track.mp3'

  return (
    <article className={styles.card} aria-label="Master comparison player">
      <header className={styles.header}>
        <p className={styles.mode}>{activeTrack.label}</p>
        <p className={styles.fileName}>{sourceName}</p>
      </header>

      <CircularTransport
        isPlaying={isPlaying}
        progress={progress}
        onTogglePlay={togglePlay}
        onSeekByProgress={(nextProgress) => seek(nextProgress * duration)}
        disabled={duration <= 0}
      />

      <TrackSelector tracks={TRACKS} activeTrackId={activeTrackId} onSelect={switchTrack} />
      <div className={styles.volumeWrap}>
        <VolumeSlider volume={volume} onVolumeChange={setVolume} />
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
