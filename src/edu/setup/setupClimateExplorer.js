import * as THREE from "three";
import { ClimateDataExplorer } from "../experiences/ClimateDataExplorer.js";
import { VRControllerManager } from "../systems/VRControllerManager.js";

// Global climate explorer instance
let climateExplorer = null;
let vrControllerManager = null;

export default async function setupClimateExplorer (
    renderer,
    scene,
    camera,
    controllers,
    player,
    videoLayerManager
) {

    console.log('Setting up Climate Data Spatial Explorer with Critical Framework...');

    // Clear existing scene elements
    while(scene.children.length > 0) {
        const child = scene.children[0];
        scene.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }

    // Set player view - positioned for standing experience
    player.add(camera);
    
    // Position camera at natural eye level for spatial exploration
    camera.position.set(0, 1.8, 0); // Human-centered design
    player.position.set(0, 0, 5); // Start at "present" time

    // Initialize VR Controller Manager for enhanced interaction
    try {
        vrControllerManager = new VRControllerManager(
            scene, 
            camera, 
            renderer, 
            controllers, 
            player
        );
        
        console.log('VR Controller Manager initialized for Climate Explorer');
    } catch (error) {
        console.error('Failed to initialize VR Controller Manager:', error);
    }

    // Initialize Climate Data Spatial Explorer
    try {
        climateExplorer = new ClimateDataExplorer(scene, camera, renderer);
        
        console.log('Climate Data Explorer initialized successfully');
        
        // Create intersection objects for controller interaction
        if (vrControllerManager) {
            const intersectableObjects = [];
            // Add climate explorer interactive elements to intersectable objects
            // This will be populated by the explorer's interactive elements
            vrControllerManager.setIntersectableObjects(intersectableObjects);
            
            // Set up interaction events
            vrControllerManager.on('controllerInteraction', (event) => {
                console.log('Climate Explorer - Controller interaction:', event);
                
                if (climateExplorer && event.intersection) {
                    climateExplorer.handleControllerInteraction(
                        event.hand, 
                        event.action, 
                        event.intersection
                    );
                }
            });
        }
        
    } catch (error) {
        console.error('Failed to initialize Climate Data Explorer:', error);
    }

    // Lighting optimized for climate data visualization
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);
    
    // Main light positioned to illuminate coastal environment
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);
    
    // Warm fill light for natural appearance
    const fillLight = new THREE.DirectionalLight(0xffa500, 0.3);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    // Realistic sky gradient for climate context
    const skyGradient = createSkyGradient();
    scene.background = skyGradient;
    
    // Atmospheric perspective for depth
    const fog = new THREE.Fog(0x87CEEB, 30, 100);
    scene.fog = fog;

    // Add informational text about the critical design approach
    addCriticalFrameworkInfo(scene, camera);

    return function updateScene (currentSession, delta, time, sceneDataIn, sceneDataOut) {

        const data_out = {
            events: []
        };

        // Update VR Controller Manager
        if (vrControllerManager) {
            try {
                vrControllerManager.update(delta);
            } catch (error) {
                console.error('Error updating VR Controller Manager:', error);
            }
        }

        // Update Climate Data Explorer
        if (climateExplorer) {
            try {
                climateExplorer.update(delta);
            } catch (error) {
                console.error('Error updating Climate Data Explorer:', error);
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

        if (typeof sceneDataOut === "function") {
            sceneDataOut(data_out);
        }
    }
}

function createSkyGradient() {
    // Create realistic sky gradient texture
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;
    
    // Create gradient from horizon to sky
    const gradient = context.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#87CEEB'); // Sky blue
    gradient.addColorStop(0.7, '#E0F6FF'); // Light blue
    gradient.addColorStop(1, '#FFFFFF'); // White at horizon
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, 512, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}

function addCriticalFrameworkInfo(scene, camera) {
    // Add information panel explaining the critical design approach
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 512;
    
    // Background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, 1024, 512);
    
    // Title
    context.font = 'bold 32px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.fillText('Climate Data Spatial Explorer', 512, 60);
    
    // Subtitle
    context.font = '24px Arial';
    context.fillStyle = '#4A90E2';
    context.fillText('Grounded Reality Approach', 512, 100);
    
    // Critical framework explanation
    context.font = '18px Arial';
    context.fillStyle = '#CCCCCC';
    context.textAlign = 'left';
    
    const frameworkText = [
        '• Connected to lived experience - real locations you can relate to',
        '• Clear data-to-visual mapping - temperature affects visible environment',
        '• Embodied understanding - walk through time periods physically',
        '• Explicit reality alteration - no hidden assumptions or abstractions',
        '• Evidence-based - all data from IPCC climate science reports'
    ];
    
    let yPos = 160;
    frameworkText.forEach(text => {
        context.fillText(text, 50, yPos);
        yPos += 30;
    });
    
    // Instructions
    context.font = 'bold 20px Arial';
    context.fillStyle = '#FFD700';
    context.textAlign = 'center';
    context.fillText('Use VR controllers to explore time markers', 512, 400);
    context.fillText('Walk forward to experience future climate impacts', 512, 430);
    
    // Create mesh
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true 
    });
    const geometry = new THREE.PlaneGeometry(10, 5);
    
    const infoPanel = new THREE.Mesh(geometry, material);
    infoPanel.position.set(15, 3, 0); // Off to the side
    infoPanel.rotation.y = -Math.PI / 4; // Angled toward user
    
    scene.add(infoPanel);
}

// Export the climate explorer for external access if needed
export { climateExplorer, vrControllerManager };
