#!/usr/bin/env node
// Style rules for apps/ and packages/: colors and fonts come only from packages/ui/src/tokens.css
// (or shader folders), and the UI never says "fan-made". Usage: node scripts/lint-styles.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOTS = ['apps', 'packages'];
const EXTENSIONS = ['.css', '.ts', '.tsx', '.astro', '.js', '.mjs', '.mdx', '.mdoc'];
const SKIP_DIRS = new Set(['node_modules', 'dist', '.astro', 'coverage']);
const TOKENS = 'packages/ui/src/tokens.css';
const COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const FONT = /font-family\s*:(?!\s*var\()/;
const FAN_MADE = /fan[\s-]?made/i;
const ALLOW = 'lint-allow-color';

const isShaderFile = (path) => path.split('/').includes('shaders');

export function lintText(path, text) {
  const problems = [];
  const colorsAllowed = path === TOKENS || isShaderFile(path);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const at = `${path}:${i + 1}`;
    if (!colorsAllowed && !line.includes(ALLOW) && COLOR.test(line)) {
      problems.push(`${at}: color literal; use a token from ${TOKENS}`);
    }
    if (path !== TOKENS && FONT.test(line)) {
      problems.push(`${at}: font-family must be var(--font-ui)`);
    }
    if (FAN_MADE.test(line)) {
      problems.push(`${at}: don't say "fan-made" in the UI`);
    }
  }
  return problems;
}

function collect(dir, root, out) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      collect(full, root, out);
    } else if (EXTENSIONS.some((ext) => name.endsWith(ext))) {
      out.push(relative(root, full).split(sep).join('/'));
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = [];
  for (const top of ROOTS) collect(join(root, top), root, files);
  const problems = files.flatMap((file) => lintText(file, readFileSync(join(root, file), 'utf8')));
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error(`\n${problems.length} style problem(s)`);
    process.exit(1);
  }
  console.log(`styles OK: ${files.length} file(s)`);
}
