// Build-time view of content/raids for the site: one read of the content tree, then pure
// derivations for the Director and raid pages. content/ stays the single source of truth.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Availability } from '@raid-clinic/ui';
import type { PlanetSpec, ScenePlanet } from '@raid-clinic/ui/space';

export interface EncounterSummary {
  id: string;
  name: string;
  order: number;
  /** The guide's frontmatter status is anything but `draft`. */
  guide: boolean;
  trainer: boolean;
}

export interface RaidSummary {
  id: string;
  name: string;
  released: string | null;
  location: string;
  tagline: string;
  planet: PlanetSpec;
  encounters: EncounterSummary[];
}

/** What the Director needs per raid besides its planet. */
export interface DirectorRaid {
  id: string;
  name: string;
  sub: string;
  tagline: string;
  statusLine: string;
  cost: { label: string; value: string } | null;
  /** Lowercase name, location and encounter names, for search. */
  search: string;
}

const dirs = (path: string) =>
  readdirSync(path, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

function guideStatus(path: string): string {
  try {
    const front = readFileSync(path, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    return front?.[1].match(/^status:\s*"?([\w-]+)"?/m)?.[1] ?? 'draft';
  } catch {
    return 'draft';
  }
}

/** Read every raid under `contentDir` (content/raids), oldest release first. */
export function loadRaids(contentDir: string, trainers: readonly string[]): RaidSummary[] {
  const playable = new Set(trainers);
  return dirs(contentDir)
    .map((folder) => {
      const raid = JSON.parse(readFileSync(join(contentDir, folder, 'raid.json'), 'utf8'));
      const encDir = join(contentDir, folder, 'encounters');
      const encounters: EncounterSummary[] = dirs(encDir).map((encFolder) => {
        const enc = JSON.parse(readFileSync(join(encDir, encFolder, 'encounter.json'), 'utf8'));
        return {
          id: enc.id,
          name: enc.name,
          order: enc.order,
          guide: guideStatus(join(encDir, encFolder, 'guide.mdoc')) !== 'draft',
          trainer: playable.has(`${raid.id}/${enc.id}`),
        };
      });
      encounters.sort((a, b) => a.order - b.order);
      return {
        id: raid.id,
        name: raid.name,
        released: raid.released ?? null,
        location: raid.planet.location,
        tagline: raid.planet.tagline ?? '',
        planet: raid.planet as PlanetSpec,
        encounters,
      };
    })
    .sort((a, b) => (a.released ?? '9999').localeCompare(b.released ?? '9999'));
}

export function raidStatus(raid: RaidSummary): Availability[] {
  const status: Availability[] = [];
  if (raid.encounters.some((e) => e.trainer)) status.push('playable');
  if (raid.encounters.some((e) => e.guide)) status.push('guide');
  return status.length ? status : ['soon'];
}

/** The newest raid that has a playable trainer (spec §5.1: drawn larger, dashed halo). */
export function featuredRaid(raids: RaidSummary[]): string | null {
  const playable = raids.filter((r) => r.encounters.some((e) => e.trainer));
  return playable.at(-1)?.id ?? null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Tooltip sub line: `LOCATION · RAID · N ENCOUNTERS` (uppercased by CSS). */
export function raidSub(raid: RaidSummary): string {
  const n = raid.encounters.length;
  return `${raid.location} · Raid${n ? ` · ${plural(n, 'encounter')}` : ''}`;
}

export function raidStatusLine(raid: RaidSummary): string {
  const trainers = raid.encounters.filter((e) => e.trainer).length;
  const guides = raid.encounters.filter((e) => e.guide).length;
  const parts: string[] = [];
  if (trainers)
    parts.push(
      `${plural(trainers, 'encounter')} ${trainers === 1 ? 'has' : 'have'} a playable trainer.`,
    );
  if (guides) parts.push(`${plural(guides, 'guide')} ${guides === 1 ? 'is' : 'are'} ready.`);
  return parts.length ? parts.join(' ') : 'Guides and trainers are on the way.';
}

/** Tooltip cost row: `Trainer · n / N`, only when the raid has a trainer. */
export function raidCost(raid: RaidSummary): { label: string; value: string } | null {
  const trainers = raid.encounters.filter((e) => e.trainer).length;
  return trainers ? { label: 'Trainer', value: `${trainers} / ${raid.encounters.length}` } : null;
}

export function toDirector(raids: RaidSummary[]): {
  planets: ScenePlanet[];
  raids: DirectorRaid[];
  featured: string | null;
} {
  const featured = featuredRaid(raids);
  return {
    featured,
    planets: raids.map((r) => {
      const status = raidStatus(r);
      return {
        id: r.id,
        name: r.name,
        planet: r.planet,
        status,
        featured: r.id === featured,
        dimmed: !status.includes('playable'),
      };
    }),
    raids: raids.map((r) => ({
      id: r.id,
      name: r.name,
      sub: raidSub(r),
      tagline: r.tagline,
      statusLine: raidStatusLine(r),
      cost: raidCost(r),
      search: [r.name, r.location, ...r.encounters.map((e) => e.name)].join(' ').toLowerCase(),
    })),
  };
}
