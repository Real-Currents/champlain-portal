import * as THREE from "three";
import setupScene from "./setupScene.js";
import setupClimateExplorer from "./setupClimateExplorer.js";

// Experience selection state
let selectedExperience = null;
let experienceSetup = null;

export default async function setupExperienceLauncher (
    renderer,
    scene,
    camera,
    controllers,
    player,
    videoLayerManager
) {

    console.log('Setting up Experience Launcher - Critical Analysis Framework...');

    // Set player view
    player.add(camera);
    camera.position.set(0, 1.8, 0);
    player.position.set(0, 0, 8); // Step back to see both options

    // Create selection environment
    createSelectionEnvironment(scene, camera, controllers, player);
    
    // Set up lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Create selection interface
    const selectionInterface = createExperienceSelection(scene);
    
    // Set up controller interactions
    setupExperienceSelection(controllers, selectionInterface, {
        renderer,
        scene,
        camera,
        controllers,
        player,
        videoLayerManager
    });

    return function updateScene (currentSession, delta, time, sceneDataIn, sceneDataOut) {
        // If experience is selected, delegate to that experience
        if (experienceSetup) {
            return experienceSetup(currentSession, delta, time, sceneDataIn, sceneDataOut);
        }

        // Otherwise handle launcher updates
        const data_out = { events: [] };
        
        if (typeof sceneDataOut === "function") {
            sceneDataOut(data_out);
        }
    }
}

function createSelectionEnvironment(scene, camera, controllers, player) {
    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(30, 20);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    
    // Add grid for spatial reference
    const gridHelper = new THREE.GridHelper(20, 20, 0x555555, 0x333333);
    scene.add(gridHelper);
}

function createExperienceSelection(scene) {
    const experiences = [
        {
            name: "Abstract Concept Visualizer",
            description: "Floating geometric shapes\nDisconnected data points\nNo clear meaning",
            critique: "PROBLEM: Reality alteration without grounding",
            position: new THREE.Vector3(-8, 0, 0),
            color: 0xff4444,
            setupFunction: setupScene
        },
        {
            name: "Climate Data Spatial Explorer",
            description: "Grounded in real locations\nClear data-to-visual mapping\nEmbodied time experience",
            critique: "SOLUTION: Reality alteration with explicit connection",
            position: new THREE.Vector3(8, 0, 0),
            color: 0x44ff44,
            setupFunction: setupClimateExplorer
        }
    ];

    const selectionObjects = [];

    experiences.forEach((exp, index) => {
        // Create platform for experience
        const platformGeometry = new THREE.CylinderGeometry(3, 3, 0.2);
        const platformMaterial = new THREE.MeshLambertMaterial({ 
            color: exp.color,
            transparent: true,
            opacity: 0.7 
        });
        
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.copy(exp.position);
        platform.position.y = 0.1;
        platform.userData = { 
            type: 'experienceSelector',
            experience: exp,
            index: index
        };
        
        scene.add(platform);
        selectionObjects.push(platform);

        // Create title text
        const titleCanvas = document.createElement('canvas');
        const titleContext = titleCanvas.getContext('2d');
        titleCanvas.width = 1024;
        titleCanvas.height = 512;
        
        // Title background
        titleContext.fillStyle = 'rgba(0, 0, 0, 0.8)';
        titleContext.fillRect(0, 0, 1024, 512);
        
        // Title text
        titleContext.font = 'bold 48px Arial';
        titleContext.fillStyle = 'white';
        titleContext.textAlign = 'center';
        titleContext.fillText(exp.name, 512, 80);
        
        // Description
        titleContext.font = '28px Arial';
        titleContext.fillStyle = '#CCCCCC';
        const descLines = exp.description.split('\n');
        descLines.forEach((line, i) => {
            titleContext.fillText(line, 512, 160 + (i * 35));
        });
        
        // Critique
        titleContext.font = 'bold 32px Arial';
        titleContext.fillStyle = index === 0 ? '#ff6666' : '#66ff66';
        titleContext.fillText(exp.critique, 512, 350);
        
        // Instructions
        titleContext.font = '24px Arial';
        titleContext.fillStyle = '#ffff66';
        titleContext.fillText('Point controller and pull trigger to select', 512, 420);
        
        const titleTexture = new THREE.CanvasTexture(titleCanvas);
        const titleMaterial = new THREE.MeshBasicMaterial({ 
            map: titleTexture,
            transparent: true 
        });
        const titleGeometry = new THREE.PlaneGeometry(8, 4);
        
        const titleMesh = new THREE.Mesh(titleGeometry, titleMaterial);
        titleMesh.position.copy(exp.position);
        titleMesh.position.y = 4;
        titleMesh.lookAt(new THREE.Vector3(0, 4, 8)); // Face user
        
        scene.add(titleMesh);

        // Create preview visualization
        createExperiencePreview(scene, exp, exp.position);
    });

    return selectionObjects;
}

function createExperiencePreview(scene, experience, basePosition) {
    const previewGroup = new THREE.Group();
    
    if (experience.name.includes("Abstract")) {
        // Create floating abstract shapes
        for (let i = 0; i < 10; i++) {
            const geometry = new THREE.SphereGeometry(0.1);
            const material = new THREE.MeshLambertMaterial({ 
                color: Math.random() * 0xffffff 
            });
            
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(
                (Math.random() - 0.5) * 4,
                1 + Math.random() * 2,
                (Math.random() - 0.5) * 4
            );
            
            previewGroup.add(sphere);
        }
        
        // Floating disconnected elements
        const cubeGeometry = new THREE.BoxGeometry(0.2, 1, 0.2);
        const cubeMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
        
        for (let i = 0; i < 3; i++) {
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            cube.position.set(i - 1, 2, 1);
            previewGroup.add(cube);
        }
        
    } else {
        // Create grounded environment preview
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(4, 4);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
        
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0.2;
        previewGroup.add(ground);
        
        // Buildings
        const buildingGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.4);
        const buildingMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        for (let i = 0; i < 4; i++) {
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.set(
                (i % 2) * 1.2 - 0.6,
                0.5,
                Math.floor(i / 2) * 1.2 - 0.6
            );
            previewGroup.add(building);
        }
        
        // Water level (showing change)
        const waterGeometry = new THREE.PlaneGeometry(5, 5);
        const waterMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x006994,
            transparent: true,
            opacity: 0.6 
        });
        
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.3; // Above ground level to show flooding
        previewGroup.add(water);
    }
    
    previewGroup.position.copy(basePosition);
    previewGroup.position.y = 0.5;
    scene.add(previewGroup);
    
    // Add rotation animation for preview
    const animate = () => {
        previewGroup.rotation.y += 0.01;
        requestAnimationFrame(animate);
    };
    animate();
}

function setupExperienceSelection(controllers, selectionObjects, setupParams) {
    // Simple click detection for now
    // In a full implementation, this would integrate with VRControllerManager
    
    document.addEventListener('keydown', (event) => {
        if (event.code === 'Digit1') {
            selectExperience(0, setupParams);
        } else if (event.code === 'Digit2') {
            selectExperience(1, setupParams);
        }
    });
    
    // Add visual instructions
    const instructionsCanvas = document.createElement('canvas');
    const instructionsContext = instructionsCanvas.getContext('2d');
    instructionsCanvas.width = 1024;
    instructionsCanvas.height = 256;
    
    instructionsContext.fillStyle = 'rgba(0, 0, 0, 0.8)';
    instructionsContext.fillRect(0, 0, 1024, 256);
    
    instructionsContext.font = 'bold 36px Arial';
    instructionsContext.fillStyle = 'white';
    instructionsContext.textAlign = 'center';
    instructionsContext.fillText('Press 1 for Abstract Experience, 2 for Grounded Experience', 512, 100);
    
    instructionsContext.font = '24px Arial';
    instructionsContext.fillStyle = '#CCCCCC';
    instructionsContext.fillText('Compare abstract visualization vs. reality-connected experience', 512, 150);
    
    const instructionsTexture = new THREE.CanvasTexture(instructionsCanvas);
    const instructionsMaterial = new THREE.MeshBasicMaterial({ 
        map: instructionsTexture,
        transparent: true 
    });
    const instructionsGeometry = new THREE.PlaneGeometry(12, 3);
    
    const instructionsMesh = new THREE.Mesh(instructionsGeometry, instructionsMaterial);
    instructionsMesh.position.set(0, 6, 0);
    
    setupParams.scene.add(instructionsMesh);
}

async function selectExperience(index, setupParams) {
    console.log(`Selecting experience ${index}`);
    
    const experiences = [
        { setup: setupScene, name: "Abstract Concept Visualizer" },
        { setup: setupClimateExplorer, name: "Climate Data Spatial Explorer" }
    ];
    
    const selected = experiences[index];
    
    if (selected) {
        console.log(`Loading ${selected.name}...`);
        
        // Clear current scene
        while(setupParams.scene.children.length > 0) {
            const child = setupParams.scene.children[0];
            setupParams.scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
        
        // Load selected experience
        experienceSetup = await selected.setup(
            setupParams.renderer,
            setupParams.scene,
            setupParams.camera,
            setupParams.controllers,
            setupParams.player,
            setupParams.videoLayerManager
        );
        
        console.log(`${selected.name} loaded successfully`);
    }
}
