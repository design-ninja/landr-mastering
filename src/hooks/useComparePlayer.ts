import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TrackId, TrackVariant } from '../types/audio';

const SWITCH_TIME_PADDING = 0.05;
const INITIAL_VOLUME = 0.7;
const SEAMLESS_SWITCH_OFFSET_SECONDS = 0.18;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface ComparePlayerController {
  activeTrackId: TrackId;
  activeTrack: TrackVariant;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isReady: boolean;
  isLibraryReady: boolean;
  readyTrackCount: number;
  totalTracks: number;
  error: string | null;
  togglePlay: () => void;
  seek: (timeInSeconds: number) => void;
  setVolume: (nextVolume: number) => void;
  switchTrack: (nextTrackId: TrackId) => void;
}

export function useComparePlayer(
  tracks: TrackVariant[],
): ComparePlayerController {
  if (!tracks.length) {
    throw new Error('useComparePlayer requires at least one track');
  }

  const initialTrack = tracks[0];
  const totalTracks = tracks.length;
  const trackMap = useMemo(
    () => new Map(tracks.map((track) => [track.id, track])),
    [tracks],
  );

  const audiosRef = useRef<Map<TrackId, HTMLAudioElement>>(new Map());
  const readyByTrackRef = useRef<Map<TrackId, boolean>>(new Map());
  const activeTrackIdRef = useRef<TrackId>(initialTrack.id);

  const [activeTrackId, setActiveTrackId] = useState<TrackId>(initialTrack.id);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(INITIAL_VOLUME);
  const [isReady, setIsReady] = useState(false);
  const [readyTrackCount, setReadyTrackCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const isLibraryReady = readyTrackCount >= totalTracks;

  useEffect(() => {
    activeTrackIdRef.current = activeTrackId;
  }, [activeTrackId]);

  useEffect(() => {
    const audios = new Map<TrackId, HTMLAudioElement>();
    const readyByTrack = new Map<TrackId, boolean>();
    const cleanups: Array<() => void> = [];

    const markTrackReady = (trackId: TrackId) => {
      if (readyByTrack.get(trackId)) {
        return;
      }

      readyByTrack.set(trackId, true);
      setReadyTrackCount((prev) => Math.min(totalTracks, prev + 1));

      if (activeTrackIdRef.current === trackId) {
        setIsReady(true);
      }
    };

    tracks.forEach((track) => {
      const audio = new Audio(track.file);
      audio.preload = 'auto';
      audio.volume = INITIAL_VOLUME;

      audios.set(track.id, audio);
      readyByTrack.set(track.id, false);

      const isActiveTrack = () => activeTrackIdRef.current === track.id;

      const handleLoadedMetadata = () => {
        if (!isActiveTrack()) {
          return;
        }

        const nextDuration = Number.isFinite(audio.duration)
          ? audio.duration
          : 0;
        setDuration(nextDuration);
        setCurrentTime(audio.currentTime || 0);
      };

      const handleCanPlayThrough = () => {
        markTrackReady(track.id);

        if (isActiveTrack()) {
          setError(null);
        }
      };

      const handleTimeUpdate = () => {
        if (isActiveTrack()) {
          setCurrentTime(audio.currentTime || 0);
        }
      };

      const handlePlay = () => {
        if (isActiveTrack()) {
          setIsPlaying(true);
        }
      };

      const handlePause = () => {
        if (isActiveTrack()) {
          setIsPlaying(false);
        }
      };

      const handleEnded = () => {
        if (!isActiveTrack()) {
          return;
        }

        setIsPlaying(false);
        setCurrentTime(audio.duration || 0);
      };

      const handleError = () => {
        markTrackReady(track.id);

        if (isActiveTrack()) {
          setError('Audio failed to load');
          setIsReady(false);
          setIsPlaying(false);
        }
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      audio.load();

      cleanups.push(() => {
        audio.pause();
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('canplaythrough', handleCanPlayThrough);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        audio.removeAttribute('src');
        audio.load();
      });
    });

    audiosRef.current = audios;
    readyByTrackRef.current = readyByTrack;

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      audiosRef.current = new Map();
      readyByTrackRef.current = new Map();
    };
  }, [tracks, totalTracks]);

  const pauseTracksExcept = useCallback((keepTrackIds: TrackId[]) => {
    const keepSet = new Set<TrackId>(keepTrackIds);

    audiosRef.current.forEach((audio, trackId) => {
      if (!keepSet.has(trackId) && !audio.paused) {
        audio.pause();
      }
    });
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audiosRef.current.get(activeTrackId);
    if (!audio) {
      return;
    }

    if (audio.paused) {
      pauseTracksExcept([activeTrackId]);
      void audio.play().catch(() => {
        setError('Audio failed to play');
        setIsPlaying(false);
      });
      return;
    }

    audio.pause();
  }, [activeTrackId, pauseTracksExcept]);

  const seek = useCallback(
    (timeInSeconds: number) => {
      const audio = audiosRef.current.get(activeTrackId);
      if (!audio || duration <= 0) {
        return;
      }

      const safeTime = clamp(timeInSeconds, 0, duration);
      audio.currentTime = safeTime;
      setCurrentTime(safeTime);
    },
    [activeTrackId, duration],
  );

  const setVolume = useCallback((nextVolume: number) => {
    const safeVolume = clamp(nextVolume, 0, 1);

    setVolumeState(safeVolume);
    audiosRef.current.forEach((audio) => {
      audio.volume = safeVolume;
    });
  }, []);

  const switchTrack = useCallback(
    (nextTrackId: TrackId) => {
      if (nextTrackId === activeTrackId) {
        return;
      }

      const currentAudio = audiosRef.current.get(activeTrackId);
      const nextAudio = audiosRef.current.get(nextTrackId);
      if (!nextAudio) {
        return;
      }

      const prevTime = currentAudio?.currentTime ?? currentTime;
      const wasPlaying = currentAudio
        ? !currentAudio.paused && !currentAudio.ended
        : isPlaying;

      const applySwitchTime = (targetTime: number) => {
        const nextDuration = Number.isFinite(nextAudio.duration)
          ? nextAudio.duration
          : 0;
        const safeMaxTime = Math.max(0, nextDuration - SWITCH_TIME_PADDING);
        const nextTime = clamp(targetTime, 0, safeMaxTime);

        nextAudio.currentTime = nextTime;
        setCurrentTime(nextTime);
        setDuration(nextDuration);
      };

      setError(null);
      setActiveTrackId(nextTrackId);
      activeTrackIdRef.current = nextTrackId;

      const isNextReady = readyByTrackRef.current.get(nextTrackId) ?? false;
      setIsReady(isNextReady);

      const runSwitch = () => {
        if (!wasPlaying) {
          pauseTracksExcept([]);
          nextAudio.pause();
          applySwitchTime(prevTime);
          return;
        }

        if (!currentAudio) {
          applySwitchTime(prevTime + SEAMLESS_SWITCH_OFFSET_SECONDS);
          pauseTracksExcept([nextTrackId]);
          void nextAudio.play().catch(() => {
            if (activeTrackIdRef.current === nextTrackId) {
              setError('Audio failed to play');
              setIsPlaying(false);
            }
          });
          return;
        }

        // Keep current audio running until target track is actually playing,
        // then swap to avoid audible "jump back" artifacts.
        pauseTracksExcept([activeTrackId, nextTrackId]);
        nextAudio.volume = 0;
        applySwitchTime(
          currentAudio.currentTime + SEAMLESS_SWITCH_OFFSET_SECONDS,
        );

        void nextAudio
          .play()
          .then(() => {
            if (activeTrackIdRef.current !== nextTrackId) {
              return;
            }

            applySwitchTime(
              currentAudio.currentTime + SEAMLESS_SWITCH_OFFSET_SECONDS,
            );
            nextAudio.volume = volume;
            currentAudio.pause();
            pauseTracksExcept([nextTrackId]);
          })
          .catch(() => {
            nextAudio.volume = volume;
            if (activeTrackIdRef.current === nextTrackId) {
              setError('Audio failed to play');
              setIsPlaying(false);
            }
          });
      };

      if (isNextReady) {
        runSwitch();
        return;
      }

      setDuration(0);
      setCurrentTime(prevTime);

      const handleReady = () => {
        nextAudio.removeEventListener('canplaythrough', handleReady);

        if (activeTrackIdRef.current !== nextTrackId) {
          return;
        }

        readyByTrackRef.current.set(nextTrackId, true);
        setIsReady(true);
        runSwitch();
      };

      nextAudio.addEventListener('canplaythrough', handleReady);
    },
    [activeTrackId, currentTime, isPlaying, pauseTracksExcept, volume],
  );

  const activeTrack = trackMap.get(activeTrackId) ?? initialTrack;

  return {
    activeTrackId,
    activeTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isReady,
    isLibraryReady,
    readyTrackCount,
    totalTracks,
    error,
    togglePlay,
    seek,
    setVolume,
    switchTrack,
  };
}
