import * as THREE from "three";

const _vMid = new THREE.Vector3();

/**
 * Viewer translation midpoint V in renderer.xr reference space (same space as quad layers when aligned).
 * Averages stereo eye positions when two views exist; otherwise uses the viewer pose transform.
 *
 * @param {import('three').WebGLRenderer} renderer
 * @param {XRFrame} frame
 * @param {THREE.Vector3} [target]
 * @returns {THREE.Vector3 | null}
 */
export function getViewerMidpoint (renderer, frame, target = _vMid) {

    if (!frame || !renderer.xr.isPresenting) return null;

    const refSpace = renderer.xr.getReferenceSpace();
    if (!refSpace) return null;

    const pose = frame.getViewerPose(refSpace);
    if (!pose) return null;

    const views = pose.views;
    if (views.length >= 2) {

        const a = views[0].transform.position;
        const b = views[1].transform.position;
        target.set(
            (a.x + b.x) * 0.5,
            (a.y + b.y) * 0.5,
            (a.z + b.z) * 0.5
        );
        return target;

    }

    const p = pose.transform.position;
    target.set(p.x, p.y, p.z);
    return target;

}

/**
 * @param {THREE.Group} group
 * @param {THREE.Vector3 | null} V
 * @param {boolean} enabled
 */
export function updateStationaryGroup (group, V, enabled, offset = null) {

    if (!enabled || !V) {

        group.position.set(0, 0, 0);

    } else {

        group.position.copy(V);
        if (offset) group.position.add(offset);

    }

    group.quaternion.identity();
    group.scale.set(1, 1, 1);

}

/**
 * @param {XRQuadLayer} layer
 * @param {{ x: number, y: number, z: number }} basePosition - authored W (layer-local offset)
 * @param {THREE.Vector3} V
 * @param {THREE.Vector3 | null} [videoOffset] - additional designer offset in world Z
 */
export function updateVideoQuadLayerPosition (layer, basePosition, V, videoOffset = null) {

    if (!layer || !basePosition || !V) return;

    layer.transform = new XRRigidTransform(
        {
            x: basePosition.x + V.x + (videoOffset ? videoOffset.x : 0),
            y: basePosition.y + V.y + (videoOffset ? videoOffset.y : 0),
            z: basePosition.z + V.z + (videoOffset ? videoOffset.z : 0)
        },
        { x: 0, y: 0, z: 0, w: 1 }
    );

}

/**
 * @returns {boolean} true unless URL has stationary=0 / false / off
 */
export function isStationaryGridEnabled () {

    if (typeof window === "undefined" || !window.location) return true;

    const q = new URLSearchParams(window.location.search).get("stationary");
    if (q === null) return true;

    const lower = q.toLowerCase();
    return lower !== "0" && lower !== "false" && lower !== "off";

}
