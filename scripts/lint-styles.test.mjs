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

test('HTML entities like &#8217; and &#39; are not colors', () => {
  assert.deepEqual(
    lintText('apps/site/src/a.astro', '<p>It&#8217;s &#39;fine&#39; &#8212; ok</p>'),
    [],
  );
});

test('URL anchors that look like hex are not colors', () => {
  const text = '<a href="#add">a</a>\n<a href=\'#cafe\'>b</a>\n<a href="#feed">c</a>';
  assert.deepEqual(lintText('apps/site/src/a.astro', text), []);
});

test('short hex colors are still flagged after punctuation and without spaces', () => {
  assert.equal(lintText('apps/site/src/a.css', '.a { color: #fff; }').length, 1);
  assert.equal(lintText('apps/site/src/a.css', '.a{color:#abc}').length, 1);
});

test('flags CSS color functions oklch, oklab, lab, lch, hwb and color-mix', () => {
  for (const fn of [
    'oklch(0.7 0.1 200)',
    'oklab(0.7 0.1 0.2)',
    'lab(50% 20 -30)',
    'lch(50% 40 120)',
    'hwb(120 10% 20%)',
    'color-mix(in srgb, red 50%, blue)',
  ]) {
    const problems = lintText('apps/site/src/a.css', `.a { color: ${fn}; }`);
    assert.equal(problems.length, 1, fn);
    assert.match(problems[0], /color literal/);
  }
});

test('does not flag words that merely end in a color function name', () => {
  assert.deepEqual(lintText('apps/site/src/a.css', '.a { content: label(x); }'), []);
});

test('flags a font shorthand with a literal family', () => {
  const problems = lintText('apps/site/src/a.css', '.a { font: 700 12px Arial; }');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /font shorthand/);
});

test('allows font shorthand that uses var() or inherit, and ignores font-size', () => {
  assert.deepEqual(lintText('apps/site/src/a.css', '.a { font: 700 12px var(--font-ui); }'), []);
  assert.deepEqual(lintText('apps/site/src/a.css', '.a { font: inherit; }'), []);
  assert.deepEqual(lintText('apps/site/src/a.css', '.a { font-size: 12px; }'), []);
});

test('flags JSX fontFamily literals but allows the token', () => {
  const problems = lintText('apps/site/src/a.tsx', "const s = { fontFamily: 'Arial' };");
  assert.equal(problems.length, 1);
  assert.match(problems[0], /fontFamily must be var\(--font-ui\)/);
  assert.deepEqual(
    lintText('apps/site/src/a.tsx', "const s = { fontFamily: 'var(--font-ui)' };"),
    [],
  );
  assert.deepEqual(
    lintText('apps/site/src/a.tsx', 'const s = { fontFamily: "var(--font-ui)" };'),
    [],
  );
});

test('new color and font rules honor tokens.css, shaders and lint-allow-color', () => {
  assert.deepEqual(lintText('packages/ui/src/tokens.css', '--x: oklch(0.7 0.1 200);'), []);
  assert.deepEqual(
    lintText('packages/space/src/shaders/p.ts', 'color-mix(in srgb, red, blue)'),
    [],
  );
  assert.deepEqual(
    lintText(
      'apps/site/src/a.css',
      '.a { font: 12px Arial; color: oklch(1 0 0); } /* lint-allow-color */',
    ),
    [],
  );
  assert.deepEqual(
    lintText('apps/site/src/a.tsx', "const s = { fontFamily: 'Arial' }; // lint-allow-color"),
    [],
  );
});
