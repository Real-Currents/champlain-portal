import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

import loadManager from "../setup/setupLoadManager";

const gltfLoader = new GLTFLoader(loadManager);

const gloveGroup_01 = new THREE.Group();
const gloveGroup_02 = new THREE.Group();

export default async function setupScene (
    scene,
    camera,
    controllers,
    player,
    videoLayerManager
) {

    // Stationary (orientation-only) content lives under stationaryContent in main.js; this subtree stays full 6DoF.
    // Future: reparent chosen nodes under the same group or duplicate the V-offset pattern for those objects.

    // Set player view
    player.add(camera);

    // Get rayspace from controller object and update position relative to plane (floor)
    if (controllers.hasOwnProperty("right") && controllers.right !== null) {

        const { gamepad, raySpace } = controllers.right;
    }

    // Load the glove model
    gltfLoader.load('assets/glove_01.glb', (gltf) => {
        gloveGroup_01.add(gltf.scene);
    });

    // Load the glove model
    gltfLoader.load('assets/glove_02.glb', (gltf) => {
        gloveGroup_02.add(gltf.scene);
    });

    const sceneGroup = new THREE.Group();

    let sceneX = 0.0;
    let sceneY = 0.0;
    let sceneZ = -5.0;

    scene.add(sceneGroup);

    sceneGroup.translateX(sceneX);
    sceneGroup.translateY(sceneY);
    sceneGroup.translateZ(sceneZ);

    return function updateScene (currentSession, delta, time, sceneDataIn, sceneDataOut) {

        const data_out = {
            events: []
        };

        if (controllers.hasOwnProperty("left") && controllers.left !== null) {

            const gamepad_01 = controllers.left.gamepad,
                raySpace_01 = controllers.left.raySpace;

            // Attach the glove to the left controller
            if (!raySpace_01.children.includes(gloveGroup_01)) {
                // Hide the default controller model
                controllers.left.mesh.visible = false;
                raySpace_01.add(gloveGroup_01);
            }
        }

        if (controllers.hasOwnProperty("right") && controllers.right !== null) {

            const gamepad_02 = controllers.right.gamepad,
                raySpace_02 = controllers.right.raySpace;

            // Attach the glove to the right controller
            if (!raySpace_02.children.includes(gloveGroup_02)) {
                // Hide the default controller model
                controllers.right.mesh.visible = false;
                raySpace_02.add(gloveGroup_02);
            }
        }

        if (typeof sceneDataIn === "object" && sceneDataIn != null) {
            console.log("sceneDataIn:", sceneDataIn);

            if (sceneDataIn.hasOwnProperty("action")) {
                if (sceneDataIn["action"] === "start_video") {
                    videoLayerManager.video.play();
                }
            }
        }

        if (typeof sceneDataOut === "function") {
            sceneDataOut(data_out);
        }
    }
}
