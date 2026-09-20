# video — screen capture rig

Captures the live dashboard. This is the source of the raw take and of the
product plates the launch short is cut from.

```sh
bun install
bun run shot.ts --out takes/dashboard.png --wait 6000
bun run capture.ts --out takes/hero --seconds 30
```

Both expect the backend on `:3000` and the dashboard on `:3001`.

## Why not the built-in recorder

`capture.ts` drives a CDP screencast: one full-quality JPEG per repaint, each
carrying its own timestamp. It then resamples that irregular timing onto a
constant 30 fps grid and encodes with x264. The result is every frame at full
quality with pacing that matches the 300 ms tick clock instead of drifting.

Takes land in `takes/` and are gitignored.
