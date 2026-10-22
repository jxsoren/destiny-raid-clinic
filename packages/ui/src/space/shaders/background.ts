// Full-frame background: void, nebula washes, dust, a soft beam from the top center and a vignette (spec §4).
import { abs, clamp, exp, float, length, smoothstep, uniform, uv, vec2, vec3 } from 'three/tsl';
import { Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2 } from 'three/webgpu';
import { rgb } from './color';
import { fbm } from './noise';
import { BEAM, NEBULA, VOID } from './palette';

export interface Background {
  mesh: Mesh;
  setAspect(aspect: number): void;
  /** Cover the camera frustum: center and half extents in world units. */
  setFrame(cx: number, cy: number, halfW: number, halfH: number): void;
  setTime(seconds: number): void;
  /** Parallax shift in uv units. */
  setOffset(x: number, y: number): void;
  dispose(): void;
}

export function createBackground(seed: number, octaves: number): Background {
  const uAspect = uniform(1);
  const uTime = uniform(0);
  const uOffset = uniform(new Vector2());

  const st = uv(); // 0..1, y = 1 at the top
  const p = vec2(st.x.mul(uAspect), st.y).add(uOffset);
  const z = float((seed % 997) * 0.37).add(uTime.mul(0.004)); // seed picks the slice; time drifts it slowly

  const wash = (hex: string, shift: number, scale: number, gain: number) =>
    rgb(hex)
      .mul(smoothstep(0.45, 0.85, fbm(vec3(p.mul(scale).add(shift), z), octaves)))
      .mul(gain);
  const nebula = wash(NEBULA.teal, 0, 1.3, 0.22)
    .add(wash(NEBULA.violet, 3.1, 1.1, 0.2))
    .add(wash(NEBULA.amber, 7.4, 1.6, 0.12))
    .add(wash(NEBULA.blue, 11.9, 0.9, 0.18));
  const dust = fbm(vec3(p.mul(4), z.add(5)), octaves)
    .mul(0.35)
    .add(0.65);

  const dx = abs(st.x.sub(0.5)).mul(uAspect);
  const fromTop = float(1).sub(st.y);
  const beam = exp(dx.mul(dx).mul(-28))
    .mul(exp(fromTop.mul(-2.2)))
    .mul(0.16);
  const topGlow = exp(length(vec2(dx, fromTop)).mul(-3.5)).mul(0.12);

  const edge = length(st.sub(0.5).mul(vec2(1.1, 1.3)));
  const vignette = float(1).sub(smoothstep(0.35, 0.85, edge).mul(0.6));

  const material = new MeshBasicNodeMaterial({ depthWrite: false, depthTest: false });
  material.colorNode = clamp(
    rgb(VOID)
      .add(nebula.mul(dust))
      .add(rgb(BEAM).mul(beam.add(topGlow)))
      .mul(vignette),
    0,
    1,
  );

  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;

  return {
    mesh,
    setAspect: (aspect) => {
      uAspect.value = aspect;
    },
    setFrame: (cx, cy, halfW, halfH) => {
      mesh.position.set(cx, cy, -50);
      mesh.scale.set(halfW * 2, halfH * 2, 1);
    },
    setTime: (seconds) => {
      uTime.value = seconds;
    },
    setOffset: (x, y) => {
      uOffset.value.set(x, y);
    },
    dispose: () => {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
