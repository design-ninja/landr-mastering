import type { AudioFormat, TrackVariant } from '../types/audio'

export const DEFAULT_FORMAT: AudioFormat = 'mp3'

const BASE_TRACKS: Omit<TrackVariant, 'file'>[] = [
  { id: 'original', label: 'Original', badge: 'A' },
  { id: 'master-1', label: 'Warm', badge: 'B' },
  { id: 'master-2', label: 'Balanced', badge: 'C' },
  { id: 'master-3', label: 'Open', badge: 'D' },
]

const FILE_MAP: Record<string, string> = {
  original: 'nwy-original',
  'master-1': 'nwy-warm',
  'master-2': 'nwy-balanced',
  'master-3': 'nwy-open',
}

export function buildTracks(format: AudioFormat): TrackVariant[] {
  return BASE_TRACKS.map((track) => ({
    ...track,
    file: `/audio/${format}/${FILE_MAP[track.id]}.${format}`,
  }))
}
