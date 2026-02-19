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
    isLibraryReady,
    isPlaying,
    readyTrackCount,
    seek,
    setVolume,
    switchTrack,
    totalTracks,
    togglePlay,
    volume,
  } = useComparePlayer(TRACKS)

  const progress = duration > 0 ? currentTime / duration : 0
  const sourceName = activeTrack.file.split('/').at(-1) ?? 'track.mp3'
  const preloadProgress =
    totalTracks > 0 ? Math.round((readyTrackCount / totalTracks) * 100) : 0

  return (
    <article className={styles.card} aria-label="Master comparison player">
      <header className={styles.header}>
        <p className={styles.mode}>{activeTrack.label}</p>
        <p className={styles.fileName}>{sourceName}</p>
      </header>

      {!isLibraryReady ? (
        <div className={styles.preload} role="status" aria-live="polite">
          <div className={styles.preloadSpinner} aria-hidden="true" />
          <p className={styles.preloadTitle}>Preparing all audio variants...</p>
          <p className={styles.preloadMeta}>
            {readyTrackCount}/{totalTracks} loaded
          </p>
          <div className={styles.preloadBar} aria-hidden="true">
            <span
              className={styles.preloadBarFill}
              style={{ width: `${preloadProgress}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <CircularTransport
            isPlaying={isPlaying}
            progress={progress}
            onTogglePlay={togglePlay}
            onSeekByProgress={(nextProgress) => seek(nextProgress * duration)}
            disabled={duration <= 0}
          />

          <TrackSelector
            tracks={TRACKS}
            activeTrackId={activeTrackId}
            onSelect={switchTrack}
          />
          <div className={styles.volumeWrap}>
            <VolumeSlider volume={volume} onVolumeChange={setVolume} />
          </div>
        </>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </article>
  )
}
