// Instanced star sprites: round twinkling points, or cross-flared bright stars (spec §4).
import {
  abs,
  clamp,
  exp,
  float,
  instancedBufferAttribute,
  length,
  sin,
  smoothstep,
  uniform,
  uv,
  vec3,
} from 'three/tsl';
import {
  AdditiveBlending,
  InstancedBufferAttribute,
  PointsNodeMaterial,
  Sprite,
} from 'three/webgpu';
import type { StarField } from '../stars';

export interface StarLayer {
  sprite: Sprite;
  setAspect(aspect: number): void;
  setTime(seconds: number): void;
  dispose(): void;
}

/** Stars cover a little more than the frame so parallax never shows an edge. */
const OVERSCAN = 1.06;

export function createStars(field: StarField, flare: boolean): StarLayer {
  const uAspect = uniform(1);
  const uTime = uniform(0);
  // Keep the InstancedBufferAttribute wrapper: in three 0.186 instancedBufferAttribute() marks a raw typed
  // array as instanced only for mat3/mat4; for an attribute it reads isInstancedBufferAttribute instead.
  const pos = instancedBufferAttribute<'vec2'>(
    new InstancedBufferAttribute(field.positions, 2),
    'vec2',
  );
  const size = instancedBufferAttribute<'float'>(
    new InstancedBufferAttribute(field.sizes, 1),
    'float',
  );
  const tint = instancedBufferAttribute<'vec3'>(
    new InstancedBufferAttribute(field.tints, 3),
    'vec3',
  );
  const phase = instancedBufferAttribute<'float'>(
    new InstancedBufferAttribute(field.phases, 1),
    'float',
  );

  const twinkle = sin(uTime.mul(phase.mul(0.35).add(0.6)).add(phase.mul(7)))
    .mul(0.3)
    .add(0.7);

  const material = new PointsNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: false,
  });
  material.positionNode = vec3(pos.x.mul(uAspect).mul(OVERSCAN), pos.y.mul(OVERSCAN), -20);
  material.sizeNode = flare ? size : size.mul(twinkle.mul(0.3).add(0.85));

  // The sprite quad's own uv (0..1). pointUV is gl_PointCoord: GLSL-only, and only valid for Points.
  const d = uv().sub(0.5).mul(2); // -1..1 across the sprite
  const r = length(d);
  const shape = flare
    ? exp(r.mul(-9)).add(
        exp(abs(d.x).mul(-28))
          .mul(exp(abs(d.y).mul(-2.5)))
          .add(exp(abs(d.y).mul(-28)).mul(exp(abs(d.x).mul(-2.5))))
          .mul(0.5),
      )
    : float(1).sub(smoothstep(0.2, 1, r));
  material.colorNode = clamp(flare ? tint : tint.mul(twinkle), 0, 1);
  material.opacityNode = clamp(shape, 0, 1);

  const sprite = new Sprite(material);
  sprite.count = field.count;
  sprite.frustumCulled = false;

  return {
    sprite,
    setAspect: (aspect) => {
      uAspect.value = aspect;
    },
    setTime: (seconds) => {
      uTime.value = seconds;
    },
    // Material only: three shares one quad geometry across every Sprite.
    dispose: () => {
      material.dispose();
    },
  };
}
