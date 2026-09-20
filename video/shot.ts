/**
 * One still of the dashboard. Used to check layout and to grab plates for the
 * edited video.
 *
 *   bun run shot.ts --out takes/live.png [--wait 6000] [--w 1920] [--h 1080]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};

const out = arg("out", "takes/dashboard.png");
const url = arg("url", process.env.DASHBOARD_URL ?? "http://localhost:3001");
const width = Number(arg("w", "1920"));
const height = Number(arg("h", "1080"));
const waitMs = Number(arg("wait", "6000"));

mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ args: ["--hide-scrollbars"] });
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });

const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(url, { waitUntil: "load" });

// The page is live once the card's text has changed at least once, which only
// happens when a tick event lands over SSE.
const first = await page.textContent(".card");
await page.waitForFunction(
  (prev) => {
    const el = document.querySelector(".card");
    return !!el && el.textContent !== prev;
  },
  first,
  { timeout: 20_000 },
);
await page.waitForTimeout(waitMs);

await page.screenshot({ path: out });
await browser.close();

console.log(`wrote ${out} (${width}x${height} @2x)`);
if (errors.length) {
  console.log(`${errors.length} page errors:`);
  for (const e of errors.slice(0, 10)) console.log(`  ${e}`);
}
