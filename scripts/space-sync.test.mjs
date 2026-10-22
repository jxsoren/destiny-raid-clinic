// Keeps the renderer in step with raidlint (surface types) and the UI tokens (shared colors).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const strings = (block) => [...block.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);

test('space surface types match raidlint', () => {
  const rust = read('crates/raidlint/src/rules.rs').match(
    /pub const SURFACES: &\[&str\] = &\[([\s\S]*?)\];/,
  );
  const ts = read('packages/ui/src/space/types.ts').match(
    /export const SURFACES = \[([\s\S]*?)\] as const/,
  );
  assert.ok(rust && ts, 'SURFACES not found in rules.rs or types.ts');
  assert.deepEqual(strings(ts[1]), strings(rust[1]));
});

test('renderer palette agrees with the UI tokens', () => {
  const tokens = read('packages/ui/src/tokens.css');
  const palette = read('packages/ui/src/space/shaders/palette.ts');
  const token = (name) =>
    tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`))?.[1]?.toLowerCase();
  const constant = (name) =>
    palette.match(new RegExp(`export const ${name} = '(#[0-9a-fA-F]{3,8})'`))?.[1]?.toLowerCase();
  assert.equal(constant('VOID'), token('void'));
  assert.equal(constant('BEAM'), token('glow'));
});
