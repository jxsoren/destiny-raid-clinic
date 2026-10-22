import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lintText } from './lint-styles.mjs';

test('flags hex and rgb color literals outside tokens.css', () => {
  const problems = lintText(
    'packages/ui/src/components.css',
    '.a { color: #ff0000; }\n.b { color: rgba(0, 0, 0, 0.5); }',
  );
  assert.equal(problems.length, 2);
  assert.match(problems[0], /components\.css:1: color literal/);
  assert.match(problems[1], /components\.css:2: color literal/);
});

test('allows color literals in tokens.css and in shader folders', () => {
  assert.deepEqual(lintText('packages/ui/src/tokens.css', '--void: #040507;'), []);
  assert.deepEqual(lintText('packages/space/src/shaders/planet.glsl.ts', 'vec3(#fff)'), []);
});

test('allows a line marked lint-allow-color', () => {
  assert.deepEqual(lintText('apps/site/src/a.ts', "const id = '#abc'; // lint-allow-color"), []);
});

test('font-family must use the token', () => {
  assert.equal(lintText('apps/site/src/x.css', 'body { font-family: Arial; }').length, 1);
  assert.deepEqual(lintText('apps/site/src/x.css', 'body { font-family: var(--font-ui); }'), []);
});

test('bans "fan-made" in any spelling', () => {
  assert.equal(lintText('apps/site/src/p.astro', '<p>A fan-made trainer</p>').length, 1);
  assert.equal(lintText('apps/site/src/p.astro', '<p>Fan made</p>').length, 1);
  assert.equal(lintText('apps/site/src/p.astro', '<p>FANMADE</p>').length, 1);
});

test('plain words like "#phase-2" anchors are not colors', () => {
  assert.deepEqual(lintText('apps/site/src/a.astro', '<a href="#phase-2">Phase 2</a>'), []);
});
