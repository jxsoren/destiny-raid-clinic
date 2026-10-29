// Builds the sticky PR comment for the captured previews.
//
//   node scripts/preview-comment.mjs <manifest.json> <owner/repo> <pr-number> <sha>
//
// Media lives on the pr-previews branch under pr-<number>/ and is embedded by raw URL; the sha is a
// cache-buster so a force-pushed update shows up instead of the previous capture.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MARKER = '<!-- pr-previews -->';

export function buildComment(manifest, repo, pr, sha) {
  const raw = (file) =>
    `https://raw.githubusercontent.com/${repo}/pr-previews/pr-${pr}/${file}?v=${sha.slice(0, 7)}`;
  const lines = [MARKER, '## UI previews', ''];
  for (const s of manifest) {
    lines.push(`### ${s.title}`);
    if (s.error) lines.push(`Capture failed: ${s.error}`);
    else {
      lines.push(`![${s.title}](${raw(s.png)})`);
      if (s.gif) lines.push('', `![${s.title}, motion](${raw(s.gif)})`);
      if (s.note) lines.push('', s.note);
    }
    lines.push('');
  }
  lines.push(
    `Captured from \`${sha.slice(0, 7)}\` with software rendering. Scenarios live in \`previews/scenarios.json\`; add the \`preview:video\` label to get a GIF for every scenario.`,
  );
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [manifest, repo, pr, sha] = process.argv.slice(2);
  console.log(buildComment(JSON.parse(readFileSync(manifest, 'utf8')), repo, pr, sha));
}
