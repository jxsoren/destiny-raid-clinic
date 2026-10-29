// Captures the PR preview scenarios in previews/scenarios.json against a running prototype server.
// A scenario always gets a screenshot; it also gets a short GIF only when it sets "gif": true, or
// when --all-gifs is passed (the `preview:video` PR label). One failing scenario never stops the rest.
//
//   node scripts/preview-ci.mjs --base http://localhost:8080 --out <dir> [--all-gifs]
//
// Writes <out>/<id>.png, <out>/<id>.gif (motion scenarios) and <out>/manifest.json.
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://localhost:8080' },
    out: { type: 'string' },
    'all-gifs': { type: 'boolean', default: false },
  },
});
if (!opt.out) {
  console.error('usage: preview-ci.mjs --out <dir> [--base <url>] [--all-gifs]');
  process.exit(2);
}

const require = createRequire(new URL('../apps/site/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const { scenarios } = JSON.parse(
  await readFile(new URL('../previews/scenarios.json', import.meta.url), 'utf8'),
);

// Runners have no GPU: ask for software WebGL explicitly so the 3D scene renders
// (PREVIEW_GL_ARGS overrides this on a machine that does have one, e.g. "--use-angle=d3d11 --enable-gpu")
const GL = process.env.PREVIEW_GL_ARGS?.split(' ') ?? [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
];
// Software WebGL starves the page, so every step gets generous time before it counts as a failure
const SLOW = 90_000;

const ffmpeg = (...args) =>
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }).status === 0;
const duration = (file) =>
  Number(
    spawnSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
      {
        encoding: 'utf8',
      },
    ).stdout,
  ) || 0;

async function capture(s, browser) {
  const size = { width: s.width ?? 1280, height: s.height ?? 800 };
  const wantGif = Boolean(s.gif) || opt['all-gifs'];
  const raw = join(opt.out, `${s.id}-raw`);
  const context = await browser.newContext({
    viewport: size,
    ...(wantGif ? { recordVideo: { dir: raw, size } } : {}),
  });
  const page = await context.newPage();
  const t0 = Date.now();
  await page.goto(opt.base + s.path, { waitUntil: 'domcontentloaded', timeout: SLOW });
  await page.waitForTimeout((s.settle ?? 3) * 1000);
  for (const text of s.clicks ?? [])
    await page.getByText(text, { exact: false }).first().click({ timeout: SLOW });
  const clickAt = (Date.now() - t0) / 1000;
  await page.waitForTimeout((s.seconds ?? 1) * 1000);
  await page.screenshot({ path: join(opt.out, `${s.id}.png`), timeout: SLOW });
  const wall = (Date.now() - t0) / 1000;
  await context.close();
  const result = { id: s.id, title: s.title, png: `${s.id}.png` };
  if (wantGif) {
    const webm = join(
      raw,
      (await readdir(raw)).find((f) => f.endsWith('.webm')),
    );
    // Software WebGL runs slower than the clock, so map the click time onto the video's own length
    const start = Math.max(0, (clickAt / wall) * duration(webm) - 0.5).toFixed(2);
    const gif = join(opt.out, `${s.id}.gif`);
    const ok = ffmpeg(
      '-ss',
      start,
      '-t',
      '10',
      '-i',
      webm,
      '-vf',
      'fps=8,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48:stats_mode=diff[p];[b][p]paletteuse=dither=none:diff_mode=rectangle',
      gif,
    );
    if (ok) result.gif = `${s.id}.gif`;
    else result.note = 'Screenshot only: the GIF conversion failed (is ffmpeg installed?).';
    await rename(webm, join(opt.out, `${s.id}.webm`)).catch(() => {});
    await rm(join(opt.out, `${s.id}.webm`), { force: true });
  }
  await rm(raw, { recursive: true, force: true });
  return result;
}

await mkdir(opt.out, { recursive: true });
const browser = await chromium.launch({ args: GL });
const manifest = [];
for (const s of scenarios) {
  try {
    manifest.push(await capture(s, browser));
    console.log(`captured ${s.id}`);
  } catch (e) {
    console.warn(`scenario ${s.id} failed: ${e.message}`);
    manifest.push({ id: s.id, title: s.title, error: e.message.split('\n')[0] });
  }
}
await browser.close();
await writeFile(join(opt.out, 'manifest.json'), JSON.stringify(manifest, null, 2));
