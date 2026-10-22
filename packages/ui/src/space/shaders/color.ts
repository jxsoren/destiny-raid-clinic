// Hex colors as typed shader constants.
import { vec3 } from 'three/tsl';
import { Color, type Node, Vector3 } from 'three/webgpu';

/**
 * A hex color as a linear-space vec3 constant: the same value TSL `color(hex)` gives, but typed vec3,
 * because @types/three only lets a `color` node combine with float or color operands, not vec3.
 */
export function rgb(hex: string): Node<'vec3'> {
  return vec3(new Vector3().setFromColor(new Color(hex)));
}
