# Budgie sizzle reel

A 45-second vertical (1080x1920) promo video built with
[Remotion](https://remotion.dev), fully isolated from the main app's pnpm
workspace - its own `pnpm-workspace.yaml` stops it being picked up by the
root workspace, so it has its own `node_modules`/lockfile and never touches
the app's dependency graph or `catalog:` version pins.

## Structure

- `src/theme.ts` - colours pulled directly from the real app (`icon.svg`,
  `opengraph-image.tsx`) so the video is genuinely on-brand.
- `src/components/` - reusable primitives (headline word-stagger, icon
  badges, the bird mark, scene cross-fades).
- `src/scenes/` - one file per beat. `Sizzle.tsx` sequences them; edit the
  `duration` numbers there to re-pace.
- `src/components/icons.tsx` - hand-drawn inline SVGs (bank, globe, wifi-off,
  fingerprint, users, download) - no external icon font/asset dependency,
  keeping the package genuinely self-contained.

## Commands

```sh
pnpm install       # first time only
pnpm start         # Remotion Studio - live preview, scrub the timeline
pnpm render        # renders out/sizzle.mp4
pnpm typecheck
```

## What's covered

Opening hook -> the problem (bank apps show spend, not what's free) ->
zero-based budgeting demo (animated category rows + Ready to Assign
counting to zero) -> real bank sync -> multi-currency -> offline-first ->
passkeys -> shared budgets -> no lock-in (CSV export) -> closing card.

## Adding music (uppbeat.io)

The render has no audio track - add one in your editor of choice, or
directly in Remotion:

1. Download a track from uppbeat.io and drop the file in `public/` (create
   the folder - it's picked up automatically by `staticFile()`).
2. In `src/Sizzle.tsx`, add `import { Audio, staticFile } from "remotion";`
   and render `<Audio src={staticFile("track.mp3")} volume={0.7} />`
   alongside the `<Sequence>` list.
3. Re-run `pnpm render`.

Suggested search terms on uppbeat for this kind of feature-reel pacing:
"corporate uplifting", "tech minimal", "confident optimistic" - something
with a clear beat around the 3s, 8s, and 39s marks lines up with the
Opening, Problem->Demo cut, and Closing beats respectively, if you want hits
to land on the music.

## Suggested other assets (optional, not required)

- A real screen-recording of the budget grid/register (e.g. via the
  project's own Playwright e2e setup) composited into the `BudgetDemo` or
  `Offline` scene would add authenticity alongside the current motion-
  graphics recreation - `<Video src={staticFile("demo.mp4")} />` in the
  same way as the audio above.
- An end-card QR code linking to the real deployment, if you want a scan-
  to-try CTA instead of (or alongside) the text-only "Try Budgie today".
