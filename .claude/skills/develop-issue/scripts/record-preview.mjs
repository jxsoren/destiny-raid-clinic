// Records a UI preview for a PR: a screenshot plus a short clip, converted to H.264 mp4 so GitHub
// plays it inline (it only plays mp4/mov; a webm shows up as a download link).
//
//   node .claude/skills/develop-issue/scripts/record-preview.mjs \
//     --url http://localhost:8080/vault-of-glass/atheon/ --out <scratch-dir> \
//     [--click "Plate Holder"]... [--seconds 12] [--skip 3] [--width 1280] [--height 800]
//
// --skip is how long to let the page settle before clicking; the mp4 starts just before the clicks.
//
// Once the media is posted to GitHub, delete the local copies so they don't pile up:
//
//   node .claude/skills/develop-issue/scripts/record-preview.mjs --clean --out <scratch-dir>
//
// --clean only removes a folder this script made (nothing in it but preview.* files).
//
// Uses the repo's own Playwright (apps/site), so nothing new gets installed. Needs its Chromium once:
// `pnpm --filter site exec playwright install chromium`. The mp4 step needs a full ffmpeg on PATH
// (Playwright's bundled one only writes VP8); without it you get preview.webm and a warning.
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({
  options: {
    url: { type: 'string' },
    out: { type: 'string' },
    click: { type: 'string', multiple: true, default: [] },
    seconds: { type: 'string', default: '12' },
    skip: { type: 'string', default: '3' },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '800' },
    clean: { type: 'boolean', default: false },
  },
});
if (opt.clean) {
  if (!opt.out) process.exit(2);
  const left = await readdir(opt.out).catch(() => null);
  if (!left) process.exit(0); // already gone
  const stray = left.filter((f) => !/^preview\.(png|mp4|webm)$/.test(f) && f !== 'raw');
  if (stray.length) {
    console.error(
      `not deleting ${opt.out}: it holds files this script didn't make (${stray.join(', ')})`,
    );
    process.exit(1);
  }
  await rm(opt.out, { recursive: true });
  console.log(`deleted ${opt.out}`);
  process.exit(0);
}
if (!opt.url || !opt.out) {
  console.error('usage: record-preview.mjs --url <page> --out <dir> [--click <text>]...');
  process.exit(2);
}

const require = createRequire(new URL('../../../../apps/site/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const size = { width: Number(opt.width), height: Number(opt.height) };
const raw = join(opt.out, 'raw');
await mkdir(raw, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: raw, size } });
const page = await context.newPage();
const t0 = Date.now(); // the video starts with the page, so this is its time zero
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(opt.url);
await page.waitForTimeout(Number(opt.skip) * 1000); // let the page and any WebGL scene settle
for (const text of opt.click) await page.getByText(text, { exact: false }).first().click();
// Load and clicks can take a long time under software WebGL, so the mp4 starts once they're done
const clickAt = (Date.now() - t0) / 1000;
await page.waitForTimeout(Number(opt.seconds) * 1000);
await page.screenshot({ path: join(opt.out, 'preview.png') });
const wall = (Date.now() - t0) / 1000;
await context.close(); // flushes the video
await browser.close();

const webm = join(opt.out, 'preview.webm');
await rename(
  join(
    raw,
    (await readdir(raw)).find((f) => f.endsWith('.webm')),
  ),
  webm,
);
await rm(raw, { recursive: true });

const files = [join(opt.out, 'preview.png')];
if (spawnSync('ffmpeg', ['-version']).status === 0) {
  const ffmpeg = (...args) => {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  const h264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-an'];
  // Playwright's webm has no duration or seek index, so convert all of it first and measure that
  const full = join(opt.out, 'full.mp4');
  ffmpeg('-i', webm, ...h264, full);
  const probe = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', full];
  const length = Number(spawnSync('ffprobe', probe, { encoding: 'utf8' }).stdout) || wall;
  // While software WebGL is busy the recording runs slower than the clock, so map the click time
  // onto the video's own length, then cut there (faststart so browsers can stream it)
  const start = Math.max(0, (clickAt / wall) * length - 0.5).toFixed(2);
  console.warn(
    `recorded ${length.toFixed(1)}s (clock ${wall.toFixed(1)}s), clip starts at ${start}s`,
  );
  const mp4 = join(opt.out, 'preview.mp4');
  ffmpeg('-ss', start, '-i', full, ...h264, '-movflags', '+faststart', mp4);
  await rm(full);
  await rm(webm);
  files.push(mp4);
} else {
  console.warn('ffmpeg not found: kept preview.webm, which GitHub will not play inline.');
  files.push(webm);
}

if (errors.length) console.warn(`page errors during recording:\n  ${errors.join('\n  ')}`);
console.log(JSON.stringify({ files }, null, 2));
