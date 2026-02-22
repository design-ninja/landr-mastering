export type TrackId = 'original' | 'master-1' | 'master-2' | 'master-3'

export type AudioFormat = 'mp3' | 'wav'

export interface TrackVariant {
  id: TrackId
  label: string
  file: string
  badge: string
}
