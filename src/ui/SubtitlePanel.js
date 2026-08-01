import * as THREE from "three";
import { Text } from "troika-three-text";
import { VIDEO_QUAD_Y_RECENTER_DELTA_METERS } from "../setup/setupVideoLayerManager.js";

/**
 * Creates a head-locked subtitle panel with smooth-follow (lerp) physics.
 *
 * The panel floats 1.5m in front of the camera, 0.25m below eye level,
 * minus half of `VIDEO_QUAD_Y_RECENTER_DELTA_METERS` (split between pre-recenter height and full video shift),
 * and follows head rotation with an elastic delay (lerp factor 0.08).
 *
 * Uses the same dual-mode pattern as setupVideoLayerManager:
 * - WebGL fallback: THREE.Mesh panel rendered in the scene
 * - XR Quad Layer: (future) XRQuadLayer rendered via compositor
 *
 * @param {string} initialText - Text to display on the panel
 * @returns {object} Subtitle panel manager with update(), setText(), and mesh accessors
 */
export default function createSubtitlePanel(initialText = "Welcome...") {

    const panelWidth = 1.4;
    const panelHeight = 0.25;
    const followDistance = 1.5;
    const verticalOffset = 0;
    const lerpFactor = 0.08;

    // Panel background mesh
    const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);

    // Round-corner effect via a canvas texture
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 92;
    const ctx = canvas.getContext("2d");
    drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 16, "rgba(26, 26, 26, 0.7)");
    const panelTexture = new THREE.CanvasTexture(canvas);

    const panelMaterial = new THREE.MeshBasicMaterial({
        map: panelTexture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
    });

    const panelMesh = new THREE.Mesh(panelGeometry, panelMaterial);
    panelMesh.renderOrder = 999;

    // Text via troika-three-text
    const textMesh = new Text();
    textMesh.text = initialText;
    textMesh.fontSize = 0.04;
    textMesh.color = 0xffffff;
    textMesh.anchorX = "center";
    textMesh.anchorY = "middle";
    textMesh.position.z = 0.001; // Slightly in front of panel
    textMesh.material.transparent = true;
    textMesh.sync();

    // Glow layer (subtle bloom effect via a slightly larger, dimmer copy)
    const glowMesh = new Text();
    glowMesh.text = initialText;
    glowMesh.fontSize = 0.042;
    glowMesh.color = 0xffffff;
    glowMesh.anchorX = "center";
    glowMesh.anchorY = "middle";
    glowMesh.position.z = 0.0005;
    glowMesh.material.transparent = true;
    glowMesh.material.opacity = 0.3;
    glowMesh.sync();

    // Group everything
    const subtitleGroup = new THREE.Group();
    subtitleGroup.add(panelMesh);
    subtitleGroup.add(textMesh);
    subtitleGroup.add(glowMesh);

    // Reusable vectors to avoid per-frame allocation
    const _direction = new THREE.Vector3();
    const _targetPosition = new THREE.Vector3();

    let initialized = false;

    /**
     * Update subtitle panel position to follow camera with smooth lag.
     * Call this every frame from the render loop.
     *
     * @param {THREE.Camera} camera - The active camera (or XR camera)
     */
    function update(camera) {
        camera.getWorldDirection(_direction);

        _targetPosition
            .copy(camera.position)
            .add(_direction.multiplyScalar(followDistance));
        _targetPosition.y += verticalOffset;
        _targetPosition.y -= VIDEO_QUAD_Y_RECENTER_DELTA_METERS * 0.5;

        if (!initialized) {
            // Snap to target on first frame (no lerp delay)
            subtitleGroup.position.copy(_targetPosition);
            initialized = true;
        } else {
            subtitleGroup.position.lerp(_targetPosition, lerpFactor);
        }

        subtitleGroup.lookAt(camera.position);
    }

    /**
     * Update the displayed text.
     *
     * @param {string} newText
     */
    function setText(newText) {
        textMesh.text = newText;
        textMesh.sync();
        glowMesh.text = newText;
        glowMesh.sync();
    }

    /**
     * WebGL fallback: add the subtitle group to the scene.
     * Mirrors the initVideoLayer(false, ...) pattern from setupVideoLayerManager.
     */
    function initSubtitleLayer(scene) {
        scene.add(subtitleGroup);
    }

    /**
     * Remove subtitle from scene.
     * Mirrors clearVideoLayer pattern.
     */
    function clearSubtitleLayer(scene) {
        scene.remove(subtitleGroup);
    }

    return {
        update,
        setText,
        initSubtitleLayer,
        clearSubtitleLayer,
        get group() { return subtitleGroup; },
        get mesh() { return panelMesh; },
    };
}

/**
 * Draw a filled rounded rectangle on a canvas context.
 */
function drawRoundedRect(ctx, x, y, width, height, radius, fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
}
