/**
 * Screen capture of the live dashboard, one JPEG per repaint over CDP, with the
 * real frame timestamps preserved and then resampled to constant 30 fps. This
 * beats the built-in recorder: every frame is a full-quality still, and the
 * pacing matches the 300 ms tick clock instead of drifting.
 *
 *   bun run capture.ts --out takes/live --seconds 30
 *
 * Leaves <out>.mp4 next to the frames.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};

const out = resolve(arg("out", "takes/live"));
const url = arg("url", process.env.DASHBOARD_URL ?? "http://localhost:3001");
const width = Number(arg("w", "1920"));
const height = Number(arg("h", "1080"));
const seconds = Number(arg("seconds", "30"));
const settle = Number(arg("settle", "2500"));
const fps = Number(arg("fps", "30"));
const scale = Number(arg("scale", "1"));

const frameDir = `${out}.frames`;
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });

const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(url, { waitUntil: "load" });

// Only start rolling once real tick events are landing.
const before = await page.textContent(".card");
await page.waitForFunction((prev) => document.querySelector(".card")?.textContent !== prev, before, { timeout: 20_000 });
await page.waitForTimeout(settle);

const cdp = await page.context().newCDPSession(page);
const frames: { file: string; t: number }[] = [];
let base = 0;

cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  // metadata.timestamp is seconds since an arbitrary but monotonic origin
  if (!base) base = metadata.timestamp;
  const t = metadata.timestamp - base;
  const file = join(frameDir, `${String(frames.length).padStart(6, "0")}.jpg`);
  writeFileSync(file, Buffer.from(data, "base64"));
  frames.push({ file, t });
  void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});

await cdp.send("Page.startScreencast", {
  format: "jpeg",
  quality: 96,
  maxWidth: width * scale,
  maxHeight: height * scale,
  everyNthFrame: 1,
});

await page.waitForTimeout(seconds * 1000);

await cdp.send("Page.stopScreencast");
await browser.close();

if (frames.length < 2) throw new Error(`only ${frames.length} frames captured`);

// Resample the irregular frame timing onto a constant grid: each output frame
// takes the newest captured frame at or before its own timestamp.
const total = frames[frames.length - 1]!.t + 1;
const count = Math.max(2, Math.round(total * fps));
const lines = ["ffconcat version 1.0"];
let cursor = 0;
for (let i = 0; i < count; i++) {
  const t = i / fps;
  while (cursor < frames.length - 1 && frames[cursor + 1]!.t <= t) cursor++;
  lines.push(`file '${frames[cursor]!.file.replace(/'/g, "'\\''")}'`);
}
const listPath = `${out}.txt`;
writeFileSync(listPath, lines.join("\n") + "\n");

const mp4 = `${out}.mp4`;
const ff = Bun.spawnSync([
  "ffmpeg", "-y", "-loglevel", "error",
  "-f", "concat", "-safe", "0", "-r", String(fps), "-i", listPath,
  "-vf", "format=yuv420p",
  "-c:v", "libx264", "-crf", "16", "-preset", "slow", "-movflags", "+faststart",
  mp4,
]);
if (ff.exitCode !== 0) throw new Error(`ffmpeg failed:\n${ff.stderr.toString()}`);

rmSync(frameDir, { recursive: true, force: true });
rmSync(listPath, { force: true });

console.log(`captured ${frames.length} repaints over ${total.toFixed(1)}s`);
console.log(`wrote ${mp4} (${width}x${height}, ${fps} fps, ${count} frames)`);
if (errors.length) {
  console.log(`${errors.length} page errors:`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
}
