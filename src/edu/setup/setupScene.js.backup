import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { ConceptDimensionalizer } from "../systems/ConceptDimensionalizer.js";

import loadManager from "../setup/setupLoadManager";

const gltfLoader = new GLTFLoader(loadManager);

const gloveGroup_01 = new THREE.Group();
const gloveGroup_02 = new THREE.Group();

// Global concept dimensionalizer instance
let conceptDimensionalizer = null;

export default async function setupScene (
    renderer,
    scene,
    camera,
    controllers,
    player,
    videoLayerManager
) {

    console.log('Setting up VR-optimized scene with Concept Dimensionalizer...');

    // Set player view
    player.add(camera);

    // Load the glove models (preserve existing functionality)
    gltfLoader.load('assets/glove_01.glb', (gltf) => {
        gloveGroup_01.add(gltf.scene);
    });

    gltfLoader.load('assets/glove_02.glb', (gltf) => {
        gloveGroup_02.add(gltf.scene);
    });

    // Initialize VR-Optimized Concept Dimensionalizer
    try {
        conceptDimensionalizer = new ConceptDimensionalizer(
            scene, 
            camera, 
            controllers, 
            player,
            // Need to get renderer reference - will be passed from main
            renderer
        );
        
        await conceptDimensionalizer.initialize();
        
        console.log('VR Concept Dimensionalizer initialized successfully');
        
        // Set up event handlers
        conceptDimensionalizer.on('conceptActivated', (conceptSpace) => {
            console.log(`VR Concept activated: ${conceptSpace.name}`);
        });
        
        conceptDimensionalizer.on('conceptInteraction', (event) => {
            console.log('VR Concept interaction detected:', event);
        });
        
        conceptDimensionalizer.on('categoryNavigated', (category) => {
            console.log(`VR Navigation to category: ${category}`);
        });
        
    } catch (error) {
        console.error('Failed to initialize VR Concept Dimensionalizer:', error);
    }

    // Enhanced lighting for VR readability
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8); // Brighter ambient
    scene.add(ambientLight);
    
    // Main directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Additional fill lights for VR clarity
    const fillLight1 = new THREE.DirectionalLight(0x6699ff, 0.3);
    fillLight1.position.set(-5, 5, 5);
    scene.add(fillLight1);
    
    const fillLight2 = new THREE.DirectionalLight(0xff9966, 0.3);
    fillLight2.position.set(5, 5, -5);
    scene.add(fillLight2);
    
    // Point light following player for consistent illumination
    const playerLight = new THREE.PointLight(0xffffff, 0.5, 10);
    playerLight.position.set(0, 2, 0);
    player.add(playerLight);

    // Floor grid for spatial reference in VR
    const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
    gridHelper.material.transparent = true;
    gridHelper.material.opacity = 0.3;
    scene.add(gridHelper);

    // VR comfort settings
    const comfort = {
        backgroundColor: new THREE.Color(0x001133), // Dark blue for VR comfort
        fog: new THREE.Fog(0x001133, 20, 50) // Fog to limit visible distance
    };
    
    scene.background = comfort.backgroundColor;
    scene.fog = comfort.fog;

    return function updateScene (currentSession, delta, time, sceneDataIn, sceneDataOut) {

        const data_out = {
            events: []
        };

        // // Handle controller glove attachment (preserve existing functionality)
        // if (controllers.hasOwnProperty("left") && controllers.left !== null) {
        //     const gamepad_01 = controllers.left.gamepad,
        //         raySpace_01 = controllers.left.raySpace;
        //
        //     // Attach the glove to the left controller
        //     if (!raySpace_01.children.includes(gloveGroup_01)) {
        //         // Hide the default controller model
        //         controllers.left.mesh.visible = false;
        //         raySpace_01.add(gloveGroup_01);
        //     }
        // }
        //
        // if (controllers.hasOwnProperty("right") && controllers.right !== null) {
        //     const gamepad_02 = controllers.right.gamepad,
        //         raySpace_02 = controllers.right.raySpace;
        //
        //     // Attach the glove to the right controller
        //     if (!raySpace_02.children.includes(gloveGroup_02)) {
        //         // Hide the default controller model
        //         controllers.right.mesh.visible = false;
        //         raySpace_02.add(gloveGroup_02);
        //     }
        // }

        // Update VR Concept Dimensionalizer
        if (conceptDimensionalizer) {
            try {
                // Pass enhanced input data including controller states
                const vrInputData = {
                    ...sceneDataIn,
                    controllers: controllers,
                    playerPosition: player.position,
                    playerRotation: player.rotation,
                    deltaTime: delta,
                    totalTime: time
                };
                
                conceptDimensionalizer.update(delta, time, vrInputData);
            } catch (error) {
                console.error('Error updating VR Concept Dimensionalizer:', error);
            }
        }

        // Handle video playback (preserve existing functionality)
        if (typeof sceneDataIn === "object" && sceneDataIn != null) {
            if (sceneDataIn.hasOwnProperty("action")) {
                if (sceneDataIn["action"] === "start_video") {
                    if (videoLayerManager && videoLayerManager.video) {
                        videoLayerManager.video.play();
                    }
                }
            }
        }

        // Update player light position
        if (player.children.includes(playerLight)) {
            // Light follows player automatically as it's added to player group
        }

        if (typeof sceneDataOut === "function") {
            sceneDataOut(data_out);
        }
    }
}

// Export the conceptDimensionalizer for external access if needed
export { conceptDimensionalizer };
