import * as THREE from "three";

/**
 * Cyan Euclidean grid (floor + walls). For immersive-ar, leave background null so passthrough
 * is visible; an opaque scene.background would hide the camera feed.
 *
 * @param {THREE.Scene} scene - used for scene.background only
 * @param {THREE.Object3D} [gridParent=scene] - parent for grid meshes (e.g. stationaryContent group)
 */
export default function setupGridEnvironment (scene, gridParent = scene) {
    const gridColor = 0x00ffff;
    const gridSize = 20;
    const gridDivisions = 20;

    scene.background = null;

    // Floor grid
    const floorGrid = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
    floorGrid.position.y = -1.5;
    floorGrid.material.opacity = 0.45;
    floorGrid.material.transparent = true;
    gridParent.add(floorGrid);

    // Back wall grid
    const backWall = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
    backWall.rotation.x = Math.PI / 2;
    backWall.position.z = -gridSize / 2;
    backWall.position.y = gridSize / 2 - 1.0;
    backWall.material.opacity = 0.25;
    backWall.material.transparent = true;
    gridParent.add(backWall);

    // Left wall grid
    const leftWall = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
    leftWall.rotation.z = Math.PI / 2;
    leftWall.position.x = -gridSize / 2;
    leftWall.position.y = gridSize / 2 - 1.0;
    leftWall.material.opacity = 0.2;
    leftWall.material.transparent = true;
    gridParent.add(leftWall);

    // Right wall grid
    const rightWall = new THREE.GridHelper(gridSize, gridDivisions, gridColor, gridColor);
    rightWall.rotation.z = Math.PI / 2;
    rightWall.position.x = gridSize / 2;
    rightWall.position.y = gridSize / 2 - 1.0;
    rightWall.material.opacity = 0.2;
    rightWall.material.transparent = true;
    gridParent.add(rightWall);

    gridParent.gridMeshes = { floorGrid, backWall, leftWall, rightWall };

    return {
        meshes: { floorGrid, backWall, leftWall, rightWall },
        initialState: { speed: 1.5, maxOffset: 5.0 }
    };
}
