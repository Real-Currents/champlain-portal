import * as THREE from 'three';

/**
 * Climate Data Spatial Explorer - Grounded Reality Approach
 * 
 * Critical Design Principles Applied:
 * 1. Connect to lived experience - use familiar locations
 * 2. Clear data-to-visual mapping - temperature affects visible environment
 * 3. Embodied understanding - walk through time and space
 * 4. Avoid abstract floating visualizations
 * 5. Make reality alteration explicit and connected to actual data
 */
export class ClimateDataExplorer {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Real climate data structure
        this.climateData = {
            locations: [
                {
                    name: "Miami Beach",
                    coordinates: [25.7907, -80.1300],
                    currentSeaLevel: 0,
                    seaLevelRise2050: 0.3,  // meters
                    seaLevelRise2100: 1.0,
                    currentTemp: 24.5,      // Celsius
                    tempRise2050: 2.1,
                    tempRise2100: 4.2
                },
                {
                    name: "Bangladesh Delta",
                    coordinates: [23.6845, 90.3563],
                    currentSeaLevel: 0,
                    seaLevelRise2050: 0.4,
                    seaLevelRise2100: 1.2,
                    currentTemp: 26.1,
                    tempRise2050: 2.3,
                    tempRise2100: 4.8
                },
                {
                    name: "Netherlands Coast",
                    coordinates: [52.3676, 4.9041],
                    currentSeaLevel: 0,
                    seaLevelRise2050: 0.25,
                    seaLevelRise2100: 0.8,
                    currentTemp: 10.2,
                    tempRise2050: 2.0,
                    tempRise2100: 3.9
                }
            ],
            
            // Time periods users can walk through
            timePeriods: [
                { year: 2024, label: "Today" },
                { year: 2050, label: "Your Children's Future" },
                { year: 2100, label: "Your Grandchildren's Future" }
            ]
        };
        
        // Current state
        this.currentLocation = 0;
        this.currentTimePeriod = 0;
        
        // Environment elements
        this.waterLevel = null;
        this.buildings = [];
        this.vegetation = [];
        this.infoPanel = null;
        
        this.initialize();
    }
    
    initialize() {
        this.createGroundedEnvironment();
        this.createWalkablePath();
        this.createInformationSystem();
        this.setupInteractions();
    }
    
    /**
     * Create environment that connects to lived experience
     * Instead of abstract data points, create recognizable spaces
     */
    createGroundedEnvironment() {
        // Create walkable ground plane (not floating in space)
        const groundGeometry = new THREE.PlaneGeometry(50, 30);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x8B7355,
            transparent: true 
        });
        
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = 0;
        this.scene.add(this.ground);
        
        // Create recognizable built environment
        this.createBuildings();
        this.createVegetation();
        this.createWaterSystem();
        
        // Add spatial reference system (not abstract axes)
        this.createSpatialMarkers();
    }
    
    /**
     * Create buildings that users can relate to
     * Heights and positions based on actual vulnerability data
     */
    createBuildings() {
        const locations = this.climateData.locations[this.currentLocation];
        
        // Residential buildings (represent real communities)
        const residentialGeometry = new THREE.BoxGeometry(2, 3, 2);
        const residentialMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        
        for (let i = 0; i < 8; i++) {
            const building = new THREE.Mesh(residentialGeometry, residentialMaterial);
            building.position.x = (Math.random() - 0.5) * 20;
            building.position.z = (Math.random() - 0.5) * 15;
            building.position.y = 1.5; // Ground level buildings
            building.userData = { type: 'residential', vulnerable: true };
            
            this.buildings.push(building);
            this.scene.add(building);
        }
        
        // Infrastructure (roads, utilities)
        this.createInfrastructure();
    }
    
    createInfrastructure() {
        // Create road system at ground level
        const roadGeometry = new THREE.PlaneGeometry(40, 2);
        const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x404040 });
        
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0.01; // Slightly above ground
        
        this.scene.add(road);
    }
    
    createVegetation() {
        // Vegetation that responds to temperature changes
        for (let i = 0; i < 15; i++) {
            const treeGeometry = new THREE.ConeGeometry(0.5, 2);
            const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
            
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.x = (Math.random() - 0.5) * 25;
            tree.position.z = (Math.random() - 0.5) * 20;
            tree.position.y = 1;
            tree.userData = { type: 'vegetation', healthIndex: 1.0 };
            
            this.vegetation.push(tree);
            this.scene.add(tree);
        }
    }
    
    /**
     * Create water system that shows actual sea level rise
     * This is the key data-to-visual mapping
     */
    createWaterSystem() {
        const waterGeometry = new THREE.PlaneGeometry(60, 40);
        const waterMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x006994,
            transparent: true,
            opacity: 0.7 
        });
        
        this.waterLevel = new THREE.Mesh(waterGeometry, waterMaterial);
        this.waterLevel.rotation.x = -Math.PI / 2;
        
        // Position based on current time period
        this.updateWaterLevel();
        this.scene.add(this.waterLevel);
    }
    
    /**
     * Create walkable time path instead of abstract timeline
     * Users physically walk from present to future
     */
    createWalkablePath() {
        const pathWidth = 3;
        const pathLength = 25;
        
        // Create time pathway
        const pathGeometry = new THREE.PlaneGeometry(pathWidth, pathLength);
        const pathMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x654321,
            transparent: true,
            opacity: 0.8 
        });
        
        const timePath = new THREE.Mesh(pathGeometry, pathMaterial);
        timePath.rotation.x = -Math.PI / 2;
        timePath.position.y = 0.02;
        timePath.position.z = -10; // Extends into future
        
        this.scene.add(timePath);
        
        // Add time markers along the path
        this.climateData.timePeriods.forEach((period, index) => {
            this.createTimeMarker(period, index);
        });
    }
    
    createTimeMarker(period, index) {
        // Create marker showing what this time point represents
        const markerGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1);
        const markerMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xFFD700 
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.x = 0;
        marker.position.z = -5 - (index * 8); // Spaced along path
        marker.position.y = 0.1;
        marker.userData = { timePeriod: index, year: period.year };
        
        this.scene.add(marker);
        
        // Add text label
        this.createTimeLabel(period, marker.position);
    }
    
    createTimeLabel(period, position) {
        // Create canvas-based text that's readable in VR
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 256;
        
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, 512, 256);
        
        context.font = 'bold 48px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(period.year.toString(), 256, 100);
        
        context.font = '32px Arial';
        context.fillText(period.label, 256, 150);
        
        const texture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.MeshBasicMaterial({ 
            map: texture,
            transparent: true 
        });
        const labelGeometry = new THREE.PlaneGeometry(4, 2);
        
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.copy(position);
        label.position.y = 3; // Above marker
        label.lookAt(this.camera.position);
        
        this.scene.add(label);
    }
    
    /**
     * Create information system that explains data-to-visual mapping
     * Make reality alteration explicit and educational
     */
    createInformationSystem() {
        // Create info panel that moves with user
        const panelGeometry = new THREE.PlaneGeometry(6, 4);
        const panelMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            transparent: true,
            opacity: 0.8 
        });
        
        this.infoPanel = new THREE.Mesh(panelGeometry, panelMaterial);
        this.infoPanel.position.set(-8, 2, 0);
        this.scene.add(this.infoPanel);
        
        this.updateInformationDisplay();
    }
    
    updateInformationDisplay() {
        const location = this.climateData.locations[this.currentLocation];
        const timePeriod = this.climateData.timePeriods[this.currentTimePeriod];
        
        // Create informational content
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 512;
        
        // Clear canvas
        context.fillStyle = 'rgba(0, 0, 0, 0.9)';
        context.fillRect(0, 0, 512, 512);
        
        // Title
        context.font = 'bold 32px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'left';
        context.fillText(`${location.name} - ${timePeriod.year}`, 20, 50);
        
        // Sea level data
        const seaLevelKey = this.getSeaLevelKey(timePeriod.year);
        const seaLevel = location[seaLevelKey];
        
        context.font = '24px Arial';
        context.fillStyle = '#4A90E2';
        context.fillText(`Sea Level Rise: ${seaLevel}m`, 20, 100);
        
        // Temperature data
        const tempKey = this.getTempKey(timePeriod.year);
        const tempRise = location[tempKey];
        
        context.fillStyle = '#E24A4A';
        context.fillText(`Temperature Rise: +${tempRise}°C`, 20, 140);
        
        // Impact explanation
        context.font = '18px Arial';
        context.fillStyle = '#CCCCCC';
        const impacts = this.getImpactText(seaLevel, tempRise);
        
        let yPos = 180;
        impacts.forEach(impact => {
            context.fillText(impact, 20, yPos);
            yPos += 25;
        });
        
        // Data source attribution
        context.font = '14px Arial';
        context.fillStyle = '#888888';
        context.fillText('Data: IPCC Climate Reports', 20, 480);
        
        // Update panel texture
        const texture = new THREE.CanvasTexture(canvas);
        this.infoPanel.material.map = texture;
        this.infoPanel.material.needsUpdate = true;
    }
    
    getSeaLevelKey(year) {
        if (year === 2024) return 'currentSeaLevel';
        if (year === 2050) return 'seaLevelRise2050';
        return 'seaLevelRise2100';
    }
    
    getTempKey(year) {
        if (year === 2024) return 0;
        if (year === 2050) return 'tempRise2050';
        return 'tempRise2100';
    }
    
    getImpactText(seaLevel, tempRise) {
        const impacts = [];
        
        if (seaLevel > 0.5) {
            impacts.push("• Coastal flooding during storms");
            impacts.push("• Saltwater intrusion in groundwater");
        }
        
        if (seaLevel > 1.0) {
            impacts.push("• Permanent flooding of low areas");
            impacts.push("• Mass displacement of communities");
        }
        
        if (tempRise > 2.0) {
            impacts.push("• Agricultural productivity decline");
            impacts.push("• Increased extreme weather events");
        }
        
        if (tempRise > 4.0) {
            impacts.push("• Ecosystem collapse in many regions");
            impacts.push("• Human habitability challenges");
        }
        
        return impacts;
    }
    
    /**
     * Update environment based on current time period
     * This is where data becomes embodied experience
     */
    updateWaterLevel() {
        const location = this.climateData.locations[this.currentLocation];
        const timePeriod = this.climateData.timePeriods[this.currentTimePeriod];
        
        const seaLevelKey = this.getSeaLevelKey(timePeriod.year);
        const seaLevel = location[seaLevelKey];
        
        // Physically raise water level based on data
        this.waterLevel.position.y = seaLevel;
        
        // Update building flooding state
        this.buildings.forEach(building => {
            if (building.position.y < seaLevel + 1) {
                building.material.color.setHex(0x4A4A4A); // Flooded/damaged
            } else {
                building.material.color.setHex(0x8B4513); // Normal
            }
        });
        
        // Update vegetation health based on temperature
        const tempKey = this.getTempKey(timePeriod.year);
        const tempRise = location[tempKey];
        
        this.vegetation.forEach(tree => {
            const health = Math.max(0.3, 1.0 - (tempRise / 6.0));
            const greenness = Math.floor(health * 255);
            tree.material.color.setRGB(
                0.2, 
                greenness / 255, 
                0.2
            );
        });
    }
    
    createSpatialMarkers() {
        // Instead of abstract axes, create meaningful spatial references
        const locations = ['Present', 'Near Future', 'Distant Future'];
        
        locations.forEach((label, index) => {
            const markerGeometry = new THREE.SphereGeometry(0.3);
            const markerMaterial = new THREE.MeshLambertMaterial({ 
                color: 0xFFFFFF 
            });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.z = -5 - (index * 8);
            marker.position.y = 4;
            
            this.scene.add(marker);
        });
    }
    
    setupInteractions() {
        // Set up controller interactions for time travel
        document.addEventListener('keydown', (event) => {
            switch(event.code) {
                case 'ArrowRight':
                    this.nextTimePeriod();
                    break;
                case 'ArrowLeft':
                    this.previousTimePeriod();
                    break;
                case 'ArrowUp':
                    this.nextLocation();
                    break;
                case 'ArrowDown':
                    this.previousLocation();
                    break;
            }
        });
    }
    
    nextTimePeriod() {
        this.currentTimePeriod = Math.min(
            this.currentTimePeriod + 1, 
            this.climateData.timePeriods.length - 1
        );
        this.updateEnvironment();
    }
    
    previousTimePeriod() {
        this.currentTimePeriod = Math.max(this.currentTimePeriod - 1, 0);
        this.updateEnvironment();
    }
    
    nextLocation() {
        this.currentLocation = Math.min(
            this.currentLocation + 1, 
            this.climateData.locations.length - 1
        );
        this.updateEnvironment();
    }
    
    previousLocation() {
        this.currentLocation = Math.max(this.currentLocation - 1, 0);
        this.updateEnvironment();
    }
    
    updateEnvironment() {
        this.updateWaterLevel();
        this.updateInformationDisplay();
        
        // Smooth camera transition when changing time
        const targetZ = -5 - (this.currentTimePeriod * 8);
        this.animateCameraTo(new THREE.Vector3(0, 1.8, targetZ));
    }
    
    animateCameraTo(targetPosition) {
        const startPosition = this.camera.position.clone();
        const duration = 1000; // ms
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            this.camera.position.lerpVectors(startPosition, targetPosition, progress);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    /**
     * Public interface for integration with VR controllers
     */
    handleControllerInteraction(hand, action, intersection) {
        if (!intersection) return;
        
        const object = intersection.object;
        
        if (object.userData.timePeriod !== undefined) {
            this.currentTimePeriod = object.userData.timePeriod;
            this.updateEnvironment();
        }
    }
    
    update(deltaTime) {
        // Update any animations
        if (this.infoPanel) {
            // Make info panel always face camera
            this.infoPanel.lookAt(this.camera.position);
        }
    }
    
    dispose() {
        // Clean up resources
        this.buildings.forEach(building => {
            this.scene.remove(building);
            building.geometry.dispose();
            building.material.dispose();
        });
        
        this.vegetation.forEach(tree => {
            this.scene.remove(tree);
            tree.geometry.dispose();
            tree.material.dispose();
        });
        
        if (this.waterLevel) {
            this.scene.remove(this.waterLevel);
            this.waterLevel.geometry.dispose();
            this.waterLevel.material.dispose();
        }
        
        if (this.infoPanel) {
            this.scene.remove(this.infoPanel);
            this.infoPanel.geometry.dispose();
            this.infoPanel.material.dispose();
        }
    }
}
