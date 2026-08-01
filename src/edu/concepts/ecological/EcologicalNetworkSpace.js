import * as THREE from 'three';
import { ConceptSpace } from '../base/ConceptSpace.js';
import { createNoise2D } from 'simplex-noise';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Ecological Network Visualization Space
 * Represents food webs and ecosystem relationships as 3D networks
 */
export class EcologicalNetworkSpace extends ConceptSpace {
    constructor(config = {}) {
        super('EcologicalNetwork', {
            ecosystemType: 'forest', // 'forest', 'ocean', 'grassland', 'wetland'
            complexity: 'intermediate',
            speciesCount: 100,
            showFlows: true,
            showTrophicLevels: true,
            animationSpeed: 1.0,
            ...config
        });
        
        this.ecologyData = {
            species: [],
            connections: [],
            trophicLevels: new Map(),
            energyFlows: []
        };
        
        this.systems = {
            species: null,
            connections: null,
            trophicPyramid: null,
            energyFlows: null
        };
        
        this.noise = createNoise2D();
        this.time = 0;
    }
    
    async createVisualization() {
        // Create trophic pyramid structure
        await this.createTrophicPyramid();
        
        // Create species nodes
        await this.createSpeciesNodes();
        
        // Create ecological connections
        await this.createEcologicalConnections();
        
        // Create energy flows
        await this.createEnergyFlows();
        
        // Initialize data
        this.generateEcologyData();
        
        console.log(`Ecological Network Space created: ${this.config.ecosystemType}`);
    }
    
    async createTrophicPyramid() {
        // Create a 3D pyramid showing trophic levels
        const pyramidGroup = new THREE.Group();
        pyramidGroup.name = 'trophicPyramid';
        
        const levels = [
            { name: 'Producers', color: 0x00ff00, height: 0.5, population: 0.4 },
            { name: 'Primary Consumers', color: 0x88ff00, height: 1.0, population: 0.3 },
            { name: 'Secondary Consumers', color: 0xffff00, height: 1.5, population: 0.2 },
            { name: 'Tertiary Consumers', color: 0xff8800, height: 2.0, population: 0.08 },
            { name: 'Apex Predators', color: 0xff0000, height: 2.5, population: 0.02 }
        ];
        
        levels.forEach((level, index) => {
            const width = 3 - (index * 0.5); // Pyramid shape
            const geometry = new THREE.BoxGeometry(width, 0.3, width);
            const material = new THREE.MeshPhongMaterial({
                color: level.color,
                transparent: true,
                opacity: 0.7
            });
            
            const levelMesh = new THREE.Mesh(geometry, material);
            levelMesh.position.set(3, level.height, 0);
            levelMesh.userData = { level: index, ...level };
            
            pyramidGroup.add(levelMesh);
            
            // Store trophic level data
            this.ecologyData.trophicLevels.set(index, level);
            
            // Add interaction for trophic levels
            this.addInteractionTarget(levelMesh, (event) => {
                this.emit('trophicLevelSelected', {
                    level: index,
                    data: level
                });
            });
        });
        
        this.systems.trophicPyramid = pyramidGroup;
        this.group.add(pyramidGroup);
    }
    
    async createSpeciesNodes() {
        // Create instanced mesh for species
        const speciesGeometry = new THREE.SphereGeometry(0.08, 8, 6);
        const speciesCount = Math.min(this.config.speciesCount, 200);
        
        const speciesMesh = new THREE.InstancedMesh(
            speciesGeometry,
            new THREE.MeshPhongMaterial({ color: 0x44ff44 }),
            speciesCount
        );
        
        speciesMesh.name = 'ecologicalSpecies';
        
        // Position species in 3D space based on trophic level
        const dummy = new THREE.Object3D();
        for (let i = 0; i < speciesCount; i++) {
            // Assign to trophic level
            const trophicLevel = this.assignTrophicLevel();
            
            // Position based on trophic level and random distribution
            const angle = Math.random() * Math.PI * 2;
            const radius = 1.5 + Math.random() * 2;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = trophicLevel * 0.5 + (Math.random() - 0.5) * 0.3;
            
            dummy.position.set(x, y, z);
            dummy.scale.setScalar(0.5 + Math.random() * 0.5);
            dummy.updateMatrix();
            
            speciesMesh.setMatrixAt(i, dummy.matrix);
            
            // Set color based on trophic level
            const levelData = this.ecologyData.trophicLevels.get(trophicLevel);
            const color = new THREE.Color(levelData ? levelData.color : 0x44ff44);
            speciesMesh.setColorAt(i, color);
            
            // Store species data
            this.ecologyData.species.push({
                id: i,
                position: new THREE.Vector3(x, y, z),
                trophicLevel: trophicLevel,
                biomass: Math.random(),
                type: this.getSpeciesType(trophicLevel),
                activity: 'idle'
            });
        }
        
        speciesMesh.instanceMatrix.needsUpdate = true;
        if (speciesMesh.instanceColor) {
            speciesMesh.instanceColor.needsUpdate = true;
        }
        
        this.systems.species = speciesMesh;
        this.group.add(speciesMesh);
        
        // Add interaction for species
        this.addInteractionTarget(speciesMesh, (event) => {
            const instanceId = event.intersection.instanceId;
            if (instanceId !== undefined) {
                const species = this.ecologyData.species[instanceId];
                this.emit('speciesSelected', species);
            }
        });
    }
    
    async createEcologicalConnections() {
        // Create lines showing predator-prey relationships
        const connectionGroup = new THREE.Group();
        connectionGroup.name = 'ecologicalConnections';
        
        // Create connections between species of adjacent trophic levels
        for (let i = 0; i < this.ecologyData.species.length; i++) {
            const predator = this.ecologyData.species[i];
            
            // Find potential prey (lower trophic level)
            const potentialPrey = this.ecologyData.species.filter(species => 
                species.trophicLevel === predator.trophicLevel - 1 &&
                species.position.distanceTo(predator.position) < 2.0
            );
            
            // Create connections to some prey
            const connectionCount = Math.min(potentialPrey.length, 3);
            for (let j = 0; j < connectionCount; j++) {
                const prey = potentialPrey[j];
                
                // Create line from predator to prey
                const points = [predator.position, prey.position];
                const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const lineMaterial = new THREE.LineBasicMaterial({
                    color: 0x666666,
                    transparent: true,
                    opacity: 0.3
                });
                
                const connectionLine = new THREE.Line(lineGeometry, lineMaterial);
                connectionGroup.add(connectionLine);
                
                // Store connection data
                this.ecologyData.connections.push({
                    predator: predator.id,
                    prey: prey.id,
                    strength: Math.random(),
                    line: connectionLine
                });
            }
        }
        
        this.systems.connections = connectionGroup;
        this.group.add(connectionGroup);
    }
    
    async createEnergyFlows() {
        if (!this.config.showFlows) return;
        
        // Create animated particles showing energy transfer
        const flowGroup = new THREE.Group();
        flowGroup.name = 'energyFlows';
        
        // Create particle system for energy flows
        const particleCount = 50;
        const particleGeometry = new THREE.SphereGeometry(0.02, 4, 4);
        const particleMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < particleCount; i++) {
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Random position along connections
            if (this.ecologyData.connections.length > 0) {
                const connection = this.ecologyData.connections[Math.floor(Math.random() * this.ecologyData.connections.length)];
                const predator = this.ecologyData.species[connection.predator];
                const prey = this.ecologyData.species[connection.prey];
                
                const t = Math.random();
                particle.position.lerpVectors(prey.position, predator.position, t);
            }
            
            flowGroup.add(particle);
            
            this.ecologyData.energyFlows.push({
                particle: particle,
                connection: this.ecologyData.connections[Math.floor(Math.random() * this.ecologyData.connections.length)],
                progress: Math.random()
            });
        }
        
        this.systems.energyFlows = flowGroup;
        this.group.add(flowGroup);
    }
    
    generateEcologyData() {
        // Generate initial ecological state based on ecosystem type
        switch (this.config.ecosystemType) {
            case 'forest':
                // Forest has many producers, moderate consumers
                break;
            case 'ocean':
                // Ocean has plankton base, complex food web
                break;
            case 'grassland':
                // Grassland has grass base, grazing animals
                break;
            case 'wetland':
                // Wetland has diverse niches
                break;
        }
    }
    
    assignTrophicLevel() {
        // Assign trophic level based on pyramid distribution
        const rand = Math.random();
        if (rand < 0.4) return 0; // Producers
        if (rand < 0.7) return 1; // Primary consumers
        if (rand < 0.88) return 2; // Secondary consumers
        if (rand < 0.98) return 3; // Tertiary consumers
        return 4; // Apex predators
    }
    
    getSpeciesType(trophicLevel) {
        const types = [
            ['plant', 'algae', 'tree'],
            ['herbivore', 'insect', 'small_mammal'],
            ['carnivore', 'bird', 'fish'],
            ['large_carnivore', 'raptor'],
            ['apex_predator', 'top_carnivore']
        ];
        
        const levelTypes = types[trophicLevel] || types[0];
        return levelTypes[Math.floor(Math.random() * levelTypes.length)];
    }
    
    updateVisualization(deltaTime, totalTime, inputData) {
        super.updateVisualization(deltaTime, totalTime, inputData);
        
        this.time += deltaTime * this.config.animationSpeed;
        
        // Animate energy flows
        if (this.systems.energyFlows && this.config.showFlows) {
            this.animateEnergyFlows();
        }
        
        // Update species activities
        if (this.systems.species) {
            this.updateSpeciesActivities();
        }
    }
    
    animateEnergyFlows() {
        this.ecologyData.energyFlows.forEach((flow, index) => {
            if (!flow.connection || !flow.particle) return;
            
            const predator = this.ecologyData.species[flow.connection.predator];
            const prey = this.ecologyData.species[flow.connection.prey];
            
            if (!predator || !prey) return;
            
            // Move particle along connection
            flow.progress += this.time * 0.1;
            if (flow.progress > 1) {
                flow.progress = 0;
            }
            
            flow.particle.position.lerpVectors(prey.position, predator.position, flow.progress);
            
            // Pulse the particle
            const pulse = Math.sin(this.time * 3 + index) * 0.5 + 1;
            flow.particle.scale.setScalar(pulse);
        });
    }
    
    updateSpeciesActivities() {
        // Animate species with small movements and behaviors
        const updateRate = 0.05;
        const speciesToUpdate = Math.floor(this.ecologyData.species.length * updateRate);
        
        for (let i = 0; i < Math.min(speciesToUpdate, 5); i++) {
            const speciesIndex = Math.floor(Math.random() * this.ecologyData.species.length);
            const species = this.ecologyData.species[speciesIndex];
            
            // Small random movement within trophic level
            const movement = (Math.random() - 0.5) * 0.05;
            species.position.x += movement;
            species.position.z += movement;
            
            // Keep within bounds
            const maxRadius = 3.5;
            const distance = Math.sqrt(species.position.x ** 2 + species.position.z ** 2);
            if (distance > maxRadius) {
                species.position.x *= maxRadius / distance;
                species.position.z *= maxRadius / distance;
            }
            
            // Update instance matrix
            const dummy = new THREE.Object3D();
            dummy.position.copy(species.position);
            dummy.updateMatrix();
            
            this.systems.species.setMatrixAt(speciesIndex, dummy.matrix);
        }
        
        if (this.systems.species) {
            this.systems.species.instanceMatrix.needsUpdate = true;
        }
    }
    
    /**
     * Change the ecosystem type and regenerate visualization
     */
    async changeEcosystemType(newType) {
        if (this.config.ecosystemType === newType) return;
        
        this.config.ecosystemType = newType;
        
        // Animate transition
        const exitTween = new TWEEN.Tween(this.group.scale)
            .to({ x: 0.1, y: 0.1, z: 0.1 }, 500)
            .easing(TWEEN.Easing.Cubic.In)
            .onComplete(async () => {
                // Regenerate visualization
                this.group.clear();
                this.setupBaseStructure();
                await this.createVisualization();
                
                // Animate entrance
                const entranceTween = new TWEEN.Tween(this.group.scale)
                    .to({ x: 1, y: 1, z: 1 }, 1000)
                    .easing(TWEEN.Easing.Cubic.Out)
                    .start();
                
                this.animations.add(entranceTween);
            });
        
        this.animations.add(exitTween);
        exitTween.start();
        
        this.emit('ecosystemTypeChanged', { oldType: this.config.ecosystemType, newType });
    }
}

export default EcologicalNetworkSpace;
