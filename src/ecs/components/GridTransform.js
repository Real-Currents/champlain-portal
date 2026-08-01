import * as THREE from 'three';

/**
 * Component factory for grid offset state.
 * Following IWSDK's createComponent pattern, but as a lightweight
 * plain object factory rather than a TypedArray-backed ECS component.
 *
 * @param {Partial<{offset: THREE.Vector3, velocity: THREE.Vector3, speed: number, maxOffset: number, smoothing: number, deadzone: number}>} [overrides]
 */
export function createGridTransform(overrides = {}) {
    return {
        offset: overrides.offset || new THREE.Vector3(0, 0, 0),
        velocity: overrides.velocity || new THREE.Vector3(0, 0, 0),
        speed: overrides.speed ?? 1.5,
        maxOffset: overrides.maxOffset ?? 5.0,
        smoothing: overrides.smoothing ?? 5.0,
        deadzone: overrides.deadzone ?? 0.15,
        showGrid: overrides.showGrid ?? true,
    };
}

export const GridTransform = {
    type: 'GridTransform',
    create: createGridTransform,
};

export default GridTransform;
