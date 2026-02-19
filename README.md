# LANDR Mastering Comparison

Minimal dark-themed comparison player for checking an original track against three mastering variants in a LANDR-style interface.

## Stack

- Vite (React + TypeScript)
- SCSS Modules
- pnpm
- Vercel-ready config

## Features

- Single synchronized audio engine
- Instant A/B/C/D switching without position reset
- Circular seek transport with touch-friendly thumb
- Variant tabs: `Original`, `Warm`, `Balanced`, `Open`
- Shared volume control (10% step)
- Responsive dark UI

## Project Structure

- `src/components` - UI components
- `src/hooks/useComparePlayer.ts` - playback/switching logic
- `src/data/tracks.ts` - track labels and file paths
- `public/audio` - static audio files

## Audio Setup

Current placeholder setup uses one file for all variants:

- `public/audio/nwy-original.mp3`

To use real masters, replace file paths in `src/data/tracks.ts`.

## Development

```bash
pnpm install
pnpm dev
```

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm build
```

## Deploy to Vercel

```bash
pnpm build
vercel
vercel --prod
```

`vercel.json` is already configured for Vite output (`dist`).
