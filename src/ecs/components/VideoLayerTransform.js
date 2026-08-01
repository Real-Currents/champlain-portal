import * as THREE from 'three';

/**
 * Component factory for video layer offset state.
 * Mirrors GridTransform but for the video quad/WebGL layer.
 *
 * @param {Partial<{offset: THREE.Vector3, velocity: THREE.Vector3, speed: number, maxOffset: number, smoothing: number, deadzone: number}>} [overrides]
 */
export function createVideoLayerTransform(overrides = {}) {
    return {
        offset: overrides.offset || new THREE.Vector3(0, 0, 0),
        velocity: overrides.velocity || new THREE.Vector3(0, 0, 0),
        speed: overrides.speed ?? 1.5,
        maxOffset: overrides.maxOffset ?? 5.0,
        smoothing: overrides.smoothing ?? 5.0,
        deadzone: overrides.deadzone ?? 0.15,
    };
}

export const VideoLayerTransform = {
    type: 'VideoLayerTransform',
    create: createVideoLayerTransform,
};

export default VideoLayerTransform;
