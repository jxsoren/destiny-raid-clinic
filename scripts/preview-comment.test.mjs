import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildComment, MARKER } from './preview-comment.mjs';

const sha = 'abcdef1234567890';

test('a still scenario gets a screenshot and no GIF', () => {
  const md = buildComment([{ id: 'a', title: 'A', png: 'a.png' }], 'o/r', 7, sha);
  assert.ok(md.startsWith(MARKER));
  assert.match(md, /raw\.githubusercontent\.com\/o\/r\/pr-previews\/pr-7\/a\.png\?v=abcdef1/);
  assert.doesNotMatch(md, /\.gif/);
});

test('a motion scenario also embeds its GIF', () => {
  const md = buildComment([{ id: 'b', title: 'B', png: 'b.png', gif: 'b.gif' }], 'o/r', 7, sha);
  assert.match(md, /pr-7\/b\.gif/);
});

test('a failed scenario says so and does not embed media', () => {
  const md = buildComment([{ id: 'c', title: 'C', error: 'boom' }], 'o/r', 7, sha);
  assert.match(md, /Capture failed: boom/);
  assert.doesNotMatch(md, /!\[C\]/);
});
