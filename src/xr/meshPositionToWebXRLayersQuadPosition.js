/**
 * Maps a Three.js mesh position to the `position` field of `XRRigidTransform` for
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/XRQuadLayer XRQuadLayer} (and similar
 * WebXR Layers types that use the same transform + space conventions).
 *
 * `XRQuadLayer.space` is typically `local-floor`: in that space, **Y is meters above the physical
 * floor** at session start, which is not the same convention as a mesh authored for a 2D viewport
 * or arbitrary scene units.
 *
 * @param {{ x: number, y: number, z: number }} meshPosition - Usually `mesh.position` components (or world position).
 * @param {{ yAbovePhysicalFloorMeters?: number }} [options]
 * @param {number} [options.yAbovePhysicalFloorMeters] - When set, used as **Y** for the layer
 *   transform (meters above floor in `local-floor`). Use for panels whose mesh **Y** is tuned for
 *   desktop preview only. When omitted, **Y** is passed through unchanged.
 * @returns {{ x: number, y: number, z: number }}
 */
export function meshPositionToWebXRLayersQuadPosition (meshPosition, options = {}) {

    const { yAbovePhysicalFloorMeters } = options;

    if (yAbovePhysicalFloorMeters !== undefined) {

        return {
            x: meshPosition.x,
            y: yAbovePhysicalFloorMeters,
            z: meshPosition.z
        };

    }

    return {
        x: meshPosition.x,
        y: meshPosition.y,
        z: meshPosition.z
    };

}
