import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TrackId, TrackVariant } from '../types/audio'

const SWITCH_TIME_PADDING = 0.05
const INITIAL_VOLUME = 0.85

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface ComparePlayerController {
  activeTrackId: TrackId
  activeTrack: TrackVariant
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isReady: boolean
  error: string | null
  togglePlay: () => void
  seek: (timeInSeconds: number) => void
  setVolume: (nextVolume: number) => void
  switchTrack: (nextTrackId: TrackId) => void
}

export function useComparePlayer(tracks: TrackVariant[]): ComparePlayerController {
  if (!tracks.length) {
    throw new Error('useComparePlayer requires at least one track')
  }

  const initialTrack = tracks[0]
  const trackMap = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pendingSwitchListenerRef = useRef<(() => void) | null>(null)

  const [activeTrackId, setActiveTrackId] = useState<TrackId>(initialTrack.id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(INITIAL_VOLUME)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const audio = new Audio(initialTrack.file)
    audio.preload = 'metadata'
    audio.volume = INITIAL_VOLUME
    audioRef.current = audio

    const handleLoadedMetadata = () => {
      const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0
      setDuration(nextDuration)
      setCurrentTime(audio.currentTime || 0)
      setIsReady(true)
      setError(null)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(audio.duration || 0)
    }

    const handleError = () => {
      setError('Audio failed to load')
      setIsReady(false)
      setIsPlaying(false)
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    audio.load()

    return () => {
      if (pendingSwitchListenerRef.current) {
        audio.removeEventListener('loadedmetadata', pendingSwitchListenerRef.current)
        pendingSwitchListenerRef.current = null
      }

      audio.pause()
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeAttribute('src')
      audio.load()
      audioRef.current = null
    }
  }, [initialTrack.file])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) {
      return
    }

    if (audio.paused) {
      void audio.play().catch(() => {
        setError('Audio failed to play')
        setIsPlaying(false)
      })
      return
    }

    audio.pause()
  }, [])

  const seek = useCallback(
    (timeInSeconds: number) => {
      const audio = audioRef.current
      if (!audio || duration <= 0) {
        return
      }

      const safeTime = clamp(timeInSeconds, 0, duration)
      audio.currentTime = safeTime
      setCurrentTime(safeTime)
    },
    [duration],
  )

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = clamp(nextVolume, 0, 1)
    const audio = audioRef.current

    setVolumeState(safeVolume)
    if (audio) {
      audio.volume = safeVolume
    }
  }, [])

  const switchTrack = useCallback(
    (nextTrackId: TrackId) => {
      const audio = audioRef.current
      if (!audio || nextTrackId === activeTrackId) {
        return
      }

      const targetTrack = trackMap.get(nextTrackId)
      if (!targetTrack) {
        return
      }

      const prevTime = audio.currentTime || 0
      const wasPlaying = !audio.paused && !audio.ended

      if (pendingSwitchListenerRef.current) {
        audio.removeEventListener('loadedmetadata', pendingSwitchListenerRef.current)
        pendingSwitchListenerRef.current = null
      }

      const handleSwitchLoaded = () => {
        audio.removeEventListener('loadedmetadata', handleSwitchLoaded)
        const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0
        const safeMaxTime = Math.max(0, nextDuration - SWITCH_TIME_PADDING)
        const nextTime = clamp(prevTime, 0, safeMaxTime)

        audio.currentTime = nextTime
        setCurrentTime(nextTime)
        setDuration(nextDuration)
        setIsReady(true)
        pendingSwitchListenerRef.current = null

        if (wasPlaying) {
          void audio.play().catch(() => {
            setError('Audio failed to play')
            setIsPlaying(false)
          })
        }
      }

      pendingSwitchListenerRef.current = handleSwitchLoaded
      audio.addEventListener('loadedmetadata', handleSwitchLoaded)

      setError(null)
      setIsReady(false)
      setDuration(0)
      setCurrentTime(prevTime)
      setActiveTrackId(nextTrackId)
      audio.src = targetTrack.file
      audio.load()
    },
    [activeTrackId, trackMap],
  )

  const activeTrack = trackMap.get(activeTrackId) ?? initialTrack

  return {
    activeTrackId,
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isReady,
    error,
    togglePlay,
    seek,
    setVolume,
    switchTrack,
  }
}
