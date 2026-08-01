import * as THREE from 'three';

/**
 * ECS-like system that reads the RIGHT controller thumbstick Y-axis and
 * integrates a persistent offset into VideoLayerTransform components.
 *
 * - Push right stick forward  → video moves away from viewer (+Z)
 * - Pull right stick backward → video moves toward viewer (-Z)
 */
export class VideoLayerMovementSystem {
    /**
     * @param {object} controllers — { left: { gamepad, ... }, right: { gamepad, ... } }
     * @param {THREE.Group} stationaryContent — the group being repositioned; its `.edit` flag gates movement
     */
    constructor(controllers, stationaryContent) {
        this.controllers = controllers;
        this.stationaryContent = stationaryContent;
        this._forward = new THREE.Vector3();
    }

    /**
     * @param {number} deltaTime — seconds since last frame
     * @param {import('../World').World} world
     */
    update(deltaTime, world) {
        if (!this.stationaryContent.edit) return;

        const transforms = world.query('VideoLayerTransform');
        if (transforms.length === 0) return;

        const transform = transforms[0];
        const { deadzone, speed, smoothing, maxOffset } = transform;

        let stickY = 0;
        let active = false;

        const right = this.controllers.right?.gamepad;

        if (right) {
            try {
                // WebXR controllers use 'xr-standard' mapping with THUMBSTICK_Y per-controller
                const rawY = right.getAxis('THUMBSTICK_Y');
                if (Math.abs(rawY) > deadzone) {
                    stickY = -rawY; // negate: forward push (negative raw) → positive movement
                    active = true;
                }
            } catch (_) {
                // Fallback for non-XR standard layouts
                try {
                    const rawY = right.getAxis('THUMBSTICK_RIGHT_Y');
                    if (Math.abs(rawY) > deadzone) {
                        stickY = -rawY;
                        active = true;
                    }
                } catch (_) {}
            }
        }

        // Fixed world-space Z direction: thumbstick forward pushes video toward +Z.
        this._forward.set(0, 0, 1);

        // Integrate velocity
        if (active && Math.abs(stickY) > 0) {
            transform.velocity.copy(this._forward).multiplyScalar(stickY * speed);
        } else {
            // Smooth deceleration when stick is released
            transform.velocity.lerp(
                new THREE.Vector3(0, 0, 0),
                Math.min(1.0, smoothing * deltaTime)
            );
        }

        // Apply displacement
        const displacement = transform.velocity.clone().multiplyScalar(deltaTime);
        transform.offset.add(displacement);

        // Clamp maximum offset from origin
        const distSq = transform.offset.lengthSq();
        if (distSq > maxOffset * maxOffset) {
            transform.offset.normalize().multiplyScalar(maxOffset);
        }
    }
}

export default VideoLayerMovementSystem;
