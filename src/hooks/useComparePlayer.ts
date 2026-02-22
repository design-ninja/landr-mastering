import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TrackId, TrackVariant } from '../types/audio'

const SWITCH_TIME_PADDING = 0.05
const INITIAL_VOLUME = 0.7
const SWITCH_CROSSFADE_SECONDS = 0.015
const START_LEAD_TIME_SECONDS = 0.005

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

type ActivePlayback = {
  gain: GainNode
  id: number
  source: AudioBufferSourceNode
}

export interface ComparePlayerController {
  activeTrackId: TrackId
  activeTrack: TrackVariant
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isLibraryReady: boolean
  readyTrackCount: number
  totalTracks: number
  error: string | null
  togglePlay: () => void
  seek: (timeInSeconds: number) => void
  setVolume: (nextVolume: number) => void
  switchTrack: (nextTrackId: TrackId) => void
}

export function useComparePlayer(
  tracks: TrackVariant[],
): ComparePlayerController {
  if (!tracks.length) {
    throw new Error('useComparePlayer requires at least one track')
  }

  const initialTrack = tracks[0]
  const totalTracks = tracks.length
  const trackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks],
  )

  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<Map<TrackId, AudioBuffer>>(new Map())

  const activeTrackIdRef = useRef<TrackId>(initialTrack.id)
  const isPlayingRef = useRef(false)
  const volumeRef = useRef(INITIAL_VOLUME)

  const playbackRef = useRef<ActivePlayback | null>(null)
  const playbackIdRef = useRef(0)
  const animationFrameRef = useRef<number | null>(null)

  const transportOffsetRef = useRef(0)
  const transportStartContextTimeRef = useRef(0)

  const [activeTrackId, setActiveTrackId] = useState<TrackId>(initialTrack.id)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolumeState] = useState(INITIAL_VOLUME)
  const [readyTrackCount, setReadyTrackCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const isLibraryReady = readyTrackCount >= totalTracks

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId
  }, [activeTrackId])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current
    }

    const context = new AudioContext()
    const masterGain = context.createGain()
    masterGain.gain.value = volumeRef.current
    masterGain.connect(context.destination)

    audioContextRef.current = context
    masterGainRef.current = masterGain

    return context
  }, [])

  const getTrackDuration = useCallback(
    (trackId: TrackId) => buffersRef.current.get(trackId)?.duration ?? 0,
    [],
  )

  const getTransportTime = useCallback(
    (trackId: TrackId, context: AudioContext | null) => {
      const trackDuration = getTrackDuration(trackId)
      if (trackDuration <= 0) {
        return 0
      }

      if (!isPlayingRef.current || !context) {
        return clamp(transportOffsetRef.current, 0, trackDuration)
      }

      const elapsed = Math.max(
        0,
        context.currentTime - transportStartContextTimeRef.current,
      )
      const nextTime = transportOffsetRef.current + elapsed

      return clamp(nextTime, 0, trackDuration)
    },
    [getTrackDuration],
  )

  const pauseNonActiveSources = useCallback((keepPlaybackId: number | null) => {
    const activePlayback = playbackRef.current
    if (!activePlayback) {
      return
    }

    if (keepPlaybackId !== null && activePlayback.id === keepPlaybackId) {
      return
    }

    try {
      activePlayback.source.stop()
    } catch {
      // Ignore DOMException when source was already stopped.
    }

    playbackRef.current = null
  }, [])

  const scheduleStopPlayback = useCallback(
    (
      playback: ActivePlayback | null,
      context: AudioContext,
      when: number,
      fadeOutSeconds: number,
    ) => {
      if (!playback) {
        return
      }

      const now = context.currentTime
      const stopAt = Math.max(when, now)
      const currentGainValue = playback.gain.gain.value

      playback.gain.gain.cancelScheduledValues(stopAt)
      playback.gain.gain.setValueAtTime(currentGainValue, stopAt)
      playback.gain.gain.linearRampToValueAtTime(0, stopAt + fadeOutSeconds)

      try {
        playback.source.stop(stopAt + fadeOutSeconds + 0.002)
      } catch {
        // Ignore DOMException when source was already stopped.
      }
    },
    [],
  )

  const createPlayback = useCallback(
    (trackId: TrackId, when: number, offset: number, fadeInSeconds: number) => {
      const context = audioContextRef.current
      const masterGain = masterGainRef.current
      const buffer = buffersRef.current.get(trackId)

      if (!context || !masterGain || !buffer) {
        return null
      }

      const safeMaxOffset = Math.max(0, buffer.duration - SWITCH_TIME_PADDING)
      const safeOffset = clamp(offset, 0, safeMaxOffset)

      const source = context.createBufferSource()
      const gain = context.createGain()

      source.buffer = buffer
      source.connect(gain)
      gain.connect(masterGain)

      const startAt = Math.max(when, context.currentTime)
      gain.gain.cancelScheduledValues(startAt)

      if (fadeInSeconds > 0) {
        gain.gain.setValueAtTime(0, startAt)
        gain.gain.linearRampToValueAtTime(1, startAt + fadeInSeconds)
      } else {
        gain.gain.setValueAtTime(1, startAt)
      }

      const playbackId = ++playbackIdRef.current

      source.onended = () => {
        if (playbackRef.current?.id !== playbackId) {
          return
        }

        playbackRef.current = null

        if (!isPlayingRef.current) {
          return
        }

        const currentDuration = getTrackDuration(trackId)
        transportOffsetRef.current = currentDuration
        setCurrentTime(currentDuration)
        setIsPlaying(false)
      }

      source.start(startAt, safeOffset)

      return {
        startAt,
        startOffset: safeOffset,
        playback: {
          gain,
          id: playbackId,
          source,
        } satisfies ActivePlayback,
      }
    },
    [getTrackDuration],
  )

  useEffect(() => {
    const context = ensureAudioContext()
    let isDisposed = false

    // Stop current playback and clear buffers when tracks change (format switch)
    if (playbackRef.current) {
      scheduleStopPlayback(playbackRef.current, context, context.currentTime, 0)
      playbackRef.current = null
    }
    setIsPlaying(false)
    buffersRef.current = new Map()
    setReadyTrackCount(0)

    const decodeCache = new Map<string, Promise<AudioBuffer>>()

    const decodeFile = (file: string) => {
      const cached = decodeCache.get(file)
      if (cached) {
        return cached
      }

      const promise = fetch(file)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file}`)
          }

          return response.arrayBuffer()
        })
        .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))

      decodeCache.set(file, promise)
      return promise
    }

    tracks.forEach((track) => {
      decodeFile(track.file)
        .then((buffer) => {
          if (isDisposed) {
            return
          }

          buffersRef.current.set(track.id, buffer)

          if (activeTrackIdRef.current === track.id) {
            const safeTime = clamp(
              transportOffsetRef.current,
              0,
              Math.max(0, buffer.duration - SWITCH_TIME_PADDING),
            )
            transportOffsetRef.current = safeTime
            setDuration(buffer.duration)
            setCurrentTime(safeTime)
          }
        })
        .catch(() => {
          if (isDisposed) {
            return
          }

          if (activeTrackIdRef.current === track.id) {
            setError('Audio failed to load')
          }
        })
        .finally(() => {
          if (isDisposed) {
            return
          }

          setReadyTrackCount((prev) => Math.min(totalTracks, prev + 1))
        })
    })

    return () => {
      isDisposed = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureAudioContext, totalTracks, tracks])

  useEffect(() => {
    const update = () => {
      if (isPlayingRef.current) {
        const context = audioContextRef.current
        const nextTime = getTransportTime(activeTrackIdRef.current, context)
        setCurrentTime(nextTime)
      }

      animationFrameRef.current = window.requestAnimationFrame(update)
    }

    animationFrameRef.current = window.requestAnimationFrame(update)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [getTransportTime])

  useEffect(() => {
    return () => {
      const context = audioContextRef.current

      if (playbackRef.current && context) {
        scheduleStopPlayback(
          playbackRef.current,
          context,
          context.currentTime,
          0,
        )
      }

      pauseNonActiveSources(null)

      if (context) {
        void context.close()
      }

      audioContextRef.current = null
      masterGainRef.current = null
      buffersRef.current = new Map()
    }
  }, [pauseNonActiveSources, scheduleStopPlayback])

  const togglePlay = useCallback(() => {
    const context = ensureAudioContext()

    if (!isLibraryReady) {
      return
    }

    const activeId = activeTrackIdRef.current
    const activeBuffer = buffersRef.current.get(activeId)

    if (!activeBuffer) {
      setError('Audio failed to load')
      return
    }

    if (isPlayingRef.current) {
      const pausedAt = getTransportTime(activeId, context)
      transportOffsetRef.current = pausedAt
      setCurrentTime(pausedAt)
      setIsPlaying(false)

      if (playbackRef.current) {
        scheduleStopPlayback(
          playbackRef.current,
          context,
          context.currentTime,
          SWITCH_CROSSFADE_SECONDS,
        )
        playbackRef.current = null
      }

      return
    }

    const startPlayback = () => {
      const maxOffset = Math.max(0, activeBuffer.duration - SWITCH_TIME_PADDING)
      let startOffset = clamp(transportOffsetRef.current, 0, maxOffset)

      if (startOffset >= maxOffset) {
        startOffset = 0
      }

      const startAt = context.currentTime + START_LEAD_TIME_SECONDS
      const nextPlayback = createPlayback(
        activeId,
        startAt,
        startOffset,
        SWITCH_CROSSFADE_SECONDS,
      )

      if (!nextPlayback) {
        setError('Audio failed to play')
        return
      }

      pauseNonActiveSources(nextPlayback.playback.id)
      playbackRef.current = nextPlayback.playback
      transportOffsetRef.current = nextPlayback.startOffset
      transportStartContextTimeRef.current = nextPlayback.startAt
      setIsPlaying(true)
      setError(null)
    }

    if (context.state === 'suspended') {
      void context
        .resume()
        .then(startPlayback)
        .catch(() => {
          setError('Audio failed to play')
          setIsPlaying(false)
        })
      return
    }

    startPlayback()
  }, [
    createPlayback,
    ensureAudioContext,
    getTransportTime,
    isLibraryReady,
    pauseNonActiveSources,
    scheduleStopPlayback,
  ])

  const seek = useCallback(
    (timeInSeconds: number) => {
      const activeId = activeTrackIdRef.current
      const activeBuffer = buffersRef.current.get(activeId)
      if (!activeBuffer) {
        return
      }

      const safeTime = clamp(timeInSeconds, 0, activeBuffer.duration)
      transportOffsetRef.current = safeTime
      setCurrentTime(safeTime)

      if (!isPlayingRef.current) {
        return
      }

      const context = audioContextRef.current
      if (!context) {
        return
      }

      const switchAt = context.currentTime + START_LEAD_TIME_SECONDS
      const oldPlayback = playbackRef.current
      const nextPlayback = createPlayback(
        activeId,
        switchAt,
        safeTime,
        SWITCH_CROSSFADE_SECONDS,
      )
      if (!nextPlayback) {
        return
      }

      playbackRef.current = nextPlayback.playback
      transportOffsetRef.current = nextPlayback.startOffset
      transportStartContextTimeRef.current = nextPlayback.startAt

      if (oldPlayback) {
        scheduleStopPlayback(
          oldPlayback,
          context,
          switchAt,
          SWITCH_CROSSFADE_SECONDS,
        )
      }
    },
    [createPlayback, scheduleStopPlayback],
  )

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = clamp(nextVolume, 0, 1)
    const context = audioContextRef.current
    const masterGain = masterGainRef.current

    volumeRef.current = safeVolume
    setVolumeState(safeVolume)

    if (!masterGain || !context) {
      return
    }

    masterGain.gain.cancelScheduledValues(context.currentTime)
    masterGain.gain.setTargetAtTime(safeVolume, context.currentTime, 0.01)
  }, [])

  const switchTrack = useCallback(
    (nextTrackId: TrackId) => {
      const currentTrackId = activeTrackIdRef.current
      if (nextTrackId === currentTrackId) {
        return
      }

      const context = audioContextRef.current
      const nextBuffer = buffersRef.current.get(nextTrackId)
      const nextDuration = nextBuffer?.duration ?? 0

      const transportTime = context
        ? getTransportTime(currentTrackId, context)
        : transportOffsetRef.current
      const maxOffset = Math.max(0, nextDuration - SWITCH_TIME_PADDING)
      const nextOffset = clamp(transportTime, 0, maxOffset)

      setActiveTrackId(nextTrackId)
      activeTrackIdRef.current = nextTrackId

      transportOffsetRef.current = nextOffset
      setCurrentTime(nextOffset)
      setDuration(nextDuration)
      setError(nextBuffer ? null : 'Audio failed to load')

      if (!isPlayingRef.current || !context || !nextBuffer) {
        return
      }

      const switchAt = context.currentTime + START_LEAD_TIME_SECONDS
      const oldPlayback = playbackRef.current
      const nextPlayback = createPlayback(
        nextTrackId,
        switchAt,
        nextOffset,
        SWITCH_CROSSFADE_SECONDS,
      )
      if (!nextPlayback) {
        setError('Audio failed to play')
        setIsPlaying(false)
        return
      }

      playbackRef.current = nextPlayback.playback
      transportOffsetRef.current = nextPlayback.startOffset
      transportStartContextTimeRef.current = nextPlayback.startAt

      if (oldPlayback) {
        scheduleStopPlayback(
          oldPlayback,
          context,
          switchAt,
          SWITCH_CROSSFADE_SECONDS,
        )
      }
    },
    [createPlayback, getTransportTime, scheduleStopPlayback],
  )

  const activeTrack = trackMap.get(activeTrackId) ?? initialTrack

  return {
    activeTrackId,
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLibraryReady,
    readyTrackCount,
    totalTracks,
    error,
    togglePlay,
    seek,
    setVolume,
    switchTrack,
  }
}
