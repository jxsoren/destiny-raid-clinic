// A raid planet: a procedural surface by type, lit by the shared sun with a soft terminator, a fresnel
// atmosphere rim, an outer glow, an optional ring, the halo circle (1.42×) and the featured dashed
// circle (1.75×). Spec §4. Colors come from content (tint, atmosphere) or palette.ts.
import {
  clamp,
  dot,
  float,
  length,
  max,
  mix,
  mx_worley_noise_float,
  normalWorld,
  positionLocal,
  pow,
  sin,
  smoothstep,
  uniform,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  CircleGeometry,
  DoubleSide,
  Group,
  Line,
  LineBasicNodeMaterial,
  LineDashedNodeMaterial,
  LineLoop,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  RingGeometry,
  SphereGeometry,
} from 'three/webgpu';
import { FEATURED_HALO, HALO, RING_OUTER } from '../layout';
import type { PlanetSpec, Surface } from '../types';
import { rgb } from './color';
import { circle, disposeObject } from './geometry';
import { fbm, ridged, warp } from './noise';
import { CLOUD_WHITE, LINE, OCEAN_SHIFT, PALE_BASE, SUN_DIRECTION } from './palette';

type V3 = Node<'vec3'>;
type F = Node<'float'>;
/** Surface albedo at unit-sphere point p (object space, so it turns with the planet). */
type Albedo = (p: V3, tint: V3, time: F, octaves: number) => V3;

export interface PlanetVisual {
  group: Group;
  /** time: scene seconds (cloud drift); spin: radians to turn this frame. */
  update(time: number, spin: number): void;
  setDim(dimmed: boolean): void;
  dispose(): void;
}

/** Spin speed in radians per second (spec §3.4: rotate slowly). */
export const SPIN = 0.04;
const AXIAL_TILT = 0.22;
const RING_INNER = 1.35;
const RING_TILT: [number, number, number] = [-1.18, 0, 0.32];
const GLOW_RADIUS = 1.7;

const drift = (time: F, rate: number) => vec3(time.mul(rate), 0, 0);

function lush(p: V3, tint: V3, time: F, octaves: number, light: number): V3 {
  const land = smoothstep(0.5, 0.56, fbm(p.mul(1.7), octaves));
  const ocean = tint.mul(0.3).mul(vec3(...OCEAN_SHIFT));
  const ground = tint.mul(fbm(p.mul(5), octaves).mul(0.3).add(0.75));
  const surface = mix(ocean, ground, land).mul(light);
  const clouds = smoothstep(0.55, 0.75, fbm(p.mul(2.6).add(drift(time, 0.012)), octaves)).mul(
    light > 0.9 ? 0.75 : 0.4,
  );
  return mix(surface, vec3(...CLOUD_WHITE), clouds);
}

export const ALBEDO: Record<Surface, Albedo> = {
  // Turbulent cloud bands
  venus: (p, tint, time, octaves) => {
    const q = warp(p.mul(vec3(1.6, 5.5, 1.6)).add(drift(time, 0.01)), 1.4, 3);
    return mix(tint.mul(0.5), tint.mul(1.15), smoothstep(0.25, 0.8, fbm(q, octaves)));
  },
  // Banded gas giant
  gas: (p, tint, time, octaves) => {
    const bands = sin(p.y.mul(16).add(fbm(p.mul(2.2).add(drift(time, 0.008)), octaves).mul(3)))
      .mul(0.5)
      .add(0.5);
    return mix(tint.mul(0.62), tint.mul(1.1), bands);
  },
  // White with dark cracks
  ice: (p, tint, _time, octaves) => {
    const base = mix(tint, vec3(1, 1, 1), 0.55).mul(fbm(p.mul(2), octaves).mul(0.15).add(0.88));
    const crack = smoothstep(0.93, 0.985, ridged(p.mul(3.2), 4));
    return mix(base, base.mul(0.22), crack);
  },
  // Grey with mare and craters
  moon: (p, tint, _time, octaves) => {
    const mare = smoothstep(0.42, 0.62, fbm(p.mul(1.4), octaves));
    const cell = mx_worley_noise_float(p.mul(6));
    const floor = float(1)
      .sub(smoothstep(0, 0.32, cell))
      .mul(0.3);
    const rim = smoothstep(0.3, 0.36, cell)
      .mul(float(1).sub(smoothstep(0.36, 0.44, cell)))
      .mul(0.18);
    return tint.mul(float(0.95).sub(mare.mul(0.35)).sub(floor).add(rim));
  },
  // Continents with a cloud layer
  lush: (p, tint, time, octaves) => lush(p, tint, time, octaves, 1),
  'lush-dark': (p, tint, time, octaves) => lush(p, tint, time, octaves, 0.55),
  // Crystal veins
  violet: (p, tint, _time, octaves) => {
    const base = tint.mul(fbm(p.mul(2.5), octaves).mul(0.35).add(0.45));
    const vein = smoothstep(0.95, 0.995, ridged(warp(p.mul(2.6), 0.8, 3), 4));
    return base.add(tint.mul(1.4).add(0.2).mul(vein));
  },
  // White with violet (tint) clouds
  pale: (p, tint, time, octaves) => {
    const clouds = smoothstep(
      0.42,
      0.75,
      fbm(warp(p.mul(2).add(drift(time, 0.01)), 0.9, 3), octaves),
    );
    return mix(vec3(...PALE_BASE), tint, clouds.mul(0.65));
  },
  // Dunes
  desert: (p, tint, _time, octaves) => {
    const dunes = sin(
      p.x
        .add(p.z)
        .mul(34)
        .add(fbm(p.mul(3), octaves).mul(7)),
    )
      .mul(0.5)
      .add(0.5);
    return tint.mul(dunes.mul(0.22).add(0.78)).mul(fbm(p.mul(1.3), octaves).mul(0.2).add(0.9));
  },
};

export function createPlanet(
  spec: PlanetSpec,
  options: { featured: boolean; octaves: number; seed: number },
): PlanetVisual {
  const uTime = uniform(0);
  const uDim = uniform(0);
  const tint = rgb(spec.tint);
  const atmo = rgb(spec.atmosphere);
  const s = options.seed;
  const offset = vec3((s % 101) * 0.13, (s % 37) * 0.29, (s % 53) * 0.17); // per-planet noise slice
  const p = positionLocal.normalize().add(offset);

  // Surface, sun lighting with a soft terminator, atmosphere rim, dimming.
  const albedo = ALBEDO[spec.surface](p, tint, uTime, options.octaves);
  const n = normalWorld;
  const ndl = dot(n, vec3(...SUN_DIRECTION));
  const light = smoothstep(-0.12, 0.4, ndl).mul(0.92).add(0.06);
  const fresnel = pow(float(1).sub(max(dot(n, vec3(0, 0, 1)), 0)), 3);
  const rim = atmo
    .mul(fresnel)
    .mul(smoothstep(-0.4, 0.5, ndl).mul(0.8).add(0.2))
    .mul(0.9);
  const lit = albedo.mul(light).add(rim);
  const grey = dot(lit, vec3(0.299, 0.587, 0.114));
  const surface = new MeshBasicNodeMaterial();
  surface.colorNode = clamp(mix(lit, vec3(grey, grey, grey).mul(0.5), uDim.mul(0.55)), 0, 1);
  const sphere = new Mesh(new SphereGeometry(1, 96, 64), surface);
  sphere.rotation.z = AXIAL_TILT;

  // Outer glow: a flat disc behind the sphere, fading out to GLOW_RADIUS.
  const glowMaterial = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const d = length(positionLocal.xy);
  glowMaterial.colorNode = clamp(atmo, 0, 1);
  glowMaterial.opacityNode = pow(float(1).sub(smoothstep(1, GLOW_RADIUS, d)), 2)
    .mul(0.32)
    .mul(float(1).sub(uDim.mul(0.6)));
  const glow = new Mesh(new CircleGeometry(GLOW_RADIUS, 96), glowMaterial);
  glow.position.z = -1.3;

  const group = new Group();
  group.add(glow, sphere);

  // Optional ring: front and back halves come from depth testing against the sphere.
  if (spec.ring) {
    const ringMaterial = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    const radius = length(positionLocal.xy);
    const bands = sin(radius.mul(46))
      .mul(0.5)
      .add(0.5)
      .mul(fbm(vec3(radius.mul(9), 0.5, 0.5), 3));
    ringMaterial.colorNode = clamp(tint.mul(1.05), 0, 1).mul(float(1).sub(uDim.mul(0.5)));
    ringMaterial.opacityNode = smoothstep(RING_INNER, RING_INNER + 0.08, radius)
      .mul(float(1).sub(smoothstep(RING_OUTER - 0.15, RING_OUTER, radius)))
      .mul(mix(float(0.18), float(0.7), bands));
    const ring = new Mesh(new RingGeometry(RING_INNER, RING_OUTER, 160, 1), ringMaterial);
    ring.rotation.set(...RING_TILT);
    group.add(ring);
  }

  // Halo circle, and the dashed circle for the featured raid.
  const haloMaterial = new LineBasicNodeMaterial({
    color: LINE,
    transparent: true,
    opacity: 0.16,
    depthTest: false,
  });
  group.add(new LineLoop(circle(HALO), haloMaterial));
  if (options.featured) {
    const dashMaterial = new LineDashedNodeMaterial({
      color: LINE,
      transparent: true,
      opacity: 0.24,
      dashSize: 0.07,
      gapSize: 0.06,
      depthTest: false,
    });
    const dashed = new Line(circle(FEATURED_HALO), dashMaterial);
    dashed.computeLineDistances();
    group.add(dashed);
  }

  return {
    group,
    update: (time, spin) => {
      uTime.value = time;
      sphere.rotation.y += spin;
    },
    setDim: (dimmed) => {
      uDim.value = dimmed ? 1 : 0;
      haloMaterial.opacity = dimmed ? 0.08 : 0.16;
    },
    dispose: () => disposeObject(group),
  };
}
