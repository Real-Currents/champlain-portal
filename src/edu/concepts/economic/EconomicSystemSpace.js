import * as THREE from 'three';
import { ConceptSpace } from '../base/ConceptSpace.js';
import { createNoise2D } from 'simplex-noise';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Economic System Visualization Space
 * Represents different economic models as navigable 3D landscapes
 */
export class EconomicSystemSpace extends ConceptSpace {
    constructor(config = {}) {
        super('EconomicSystem', {
            systemType: 'mixed', // 'capitalist', 'socialist', 'mixed', 'planned'
            complexity: 'intermediate',
            population: 1000,
            showFlows: true,
            showInequality: true,
            animationSpeed: 1.0,
            ...config
        });
        
        this.economicData = {
            agents: [],
            flows: [],
            resources: new Map(),
            inequality: {
                gini: 0.4,
                top1Percent: 0.2,
                bottom50Percent: 0.1
            }
        };
        
        this.systems = {
            agents: null,
            flows: null,
            terrain: null,
            inequality: null
        };
        
        this.noise = createNoise2D();
        this.time = 0;
    }
    
    async createVisualization() {
        // Create economic terrain
        await this.createEconomicTerrain();
        
        // Create economic agents
        await this.createEconomicAgents();
        
        // Create resource flows
        await this.createResourceFlows();
        
        // Create inequality visualization
        await this.createInequalityVisualization();
        
        // Initialize data
        this.generateEconomicData();
        
        console.log(`Economic System Space created: ${this.config.systemType}`);
    }
    
    async createEconomicTerrain() {
        // Create a height-mapped terrain representing economic landscape
        const resolution = 64;
        const size = 8;
        
        const geometry = new THREE.PlaneGeometry(size, size, resolution - 1, resolution - 1);
        const vertices = geometry.attributes.position.array;
        
        // Generate terrain based on economic system type
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i] / size;
            const z = vertices[i + 2] / size;
            
            let height = 0;
            
            switch (this.config.systemType) {
                case 'capitalist':
                    // Sharp peaks and valleys representing wealth concentration
                    height = this.noise(x * 4, z * 4) * 1.5;
                    height += Math.pow(this.noise(x * 8, z * 8), 3) * 2;
                    break;
                    
                case 'socialist':
                    // More even terrain with gentle rolling hills
                    height = this.noise(x * 2, z * 2) * 0.5;
                    height += this.noise(x * 6, z * 6) * 0.3;
                    break;
                    
                case 'planned':
                    // Geometric, structured patterns
                    height = Math.sin(x * Math.PI * 4) * Math.cos(z * Math.PI * 4) * 0.4;
                    height += this.noise(x * 3, z * 3) * 0.2;
                    break;
                    
                case 'mixed':
                default:
                    // Combination of patterns
                    height = this.noise(x * 3, z * 3) * 0.8;
                    height += this.noise(x * 6, z * 6) * 0.4;
                    break;
            }
            
            vertices[i + 1] = height;
        }
        
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        // Create material with color coding for economic zones
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            wireframe: false,
            transparent: true,
            opacity: 0.8
        });
        
        // Add vertex colors based on height (economic prosperity)
        const colors = [];
        for (let i = 0; i < vertices.length; i += 3) {
            const height = vertices[i + 1];
            const normalizedHeight = (height + 2) / 4; // Normalize to 0-1
            
            // Color from red (poor) to green (wealthy)
            const r = Math.max(0, 1 - normalizedHeight * 2);
            const g = Math.min(1, normalizedHeight * 2);
            const b = 0.2;
            
            colors.push(r, g, b);
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        this.systems.terrain = new THREE.Mesh(geometry, material);
        this.systems.terrain.rotateX(-Math.PI / 2);
        this.systems.terrain.name = 'economicTerrain';
        
        this.group.add(this.systems.terrain);
        
        // Add interaction for terrain
        this.addInteractionTarget(this.systems.terrain, (event) => {
            const point = event.intersection.point;
            this.emit('terrainClicked', {
                position: point,
                economicData: this.getEconomicDataAtPoint(point)
            });
        });
    }
    
    async createEconomicAgents() {
        // Create instanced mesh for economic agents (people, companies, etc.)
        const agentGeometry = new THREE.SphereGeometry(0.05, 8, 6);
        const agentCount = Math.min(this.config.population, 500); // Limit for performance
        
        const agentMesh = new THREE.InstancedMesh(
            agentGeometry,
            new THREE.MeshPhongMaterial({ color: 0x4444ff }),
            agentCount
        );
        
        agentMesh.name = 'economicAgents';
        
        // Position agents across the terrain
        const dummy = new THREE.Object3D();
        for (let i = 0; i < agentCount; i++) {
            // Random position on terrain
            const x = (Math.random() - 0.5) * 7;
            const z = (Math.random() - 0.5) * 7;
            const y = this.getTerrainHeightAtPoint(x, z) + 0.1;
            
            dummy.position.set(x, y, z);
            dummy.scale.setScalar(0.5 + Math.random() * 0.5); // Varying sizes
            dummy.updateMatrix();
            
            agentMesh.setMatrixAt(i, dummy.matrix);
            
            // Store agent data
            this.economicData.agents.push({
                id: i,
                position: new THREE.Vector3(x, y, z),
                wealth: Math.random(),
                type: this.getAgentType(),
                activity: 'idle'
            });
        }
        
        agentMesh.instanceMatrix.needsUpdate = true;
        this.systems.agents = agentMesh;
        this.group.add(agentMesh);
        
        // Add interaction for agents
        this.addInteractionTarget(agentMesh, (event) => {
            const instanceId = event.intersection.instanceId;
            if (instanceId !== undefined) {
                const agent = this.economicData.agents[instanceId];
                this.emit('agentSelected', agent);
            }
        });
    }
    
    async createResourceFlows() {
        if (!this.config.showFlows) return;
        
        // Create animated lines showing resource/wealth flows
        const flowGroup = new THREE.Group();
        flowGroup.name = 'resourceFlows';
        
        const flowCount = 50;
        
        for (let i = 0; i < flowCount; i++) {
            const startAgent = this.economicData.agents[Math.floor(Math.random() * this.economicData.agents.length)];
            const endAgent = this.economicData.agents[Math.floor(Math.random() * this.economicData.agents.length)];
            
            if (startAgent === endAgent) continue;
            
            // Create bezier curve for flow path
            const start = startAgent.position.clone();
            const end = endAgent.position.clone();
            const mid = start.clone().lerp(end, 0.5);
            mid.y += 0.5; // Arc the flow upward
            
            const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
            const points = curve.getPoints(20);
            
            const flowGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const flowMaterial = new THREE.LineBasicMaterial({
                color: 0x00ff88,
                transparent: true,
                opacity: 0.6
            });
            
            const flowLine = new THREE.Line(flowGeometry, flowMaterial);
            flowGroup.add(flowLine);
            
            // Store flow data
            this.economicData.flows.push({
                id: i,
                start: startAgent.id,
                end: endAgent.id,
                amount: Math.random(),
                type: 'trade',
                line: flowLine
            });
        }
        
        this.systems.flows = flowGroup;
        this.group.add(flowGroup);
    }
    
    async createInequalityVisualization() {
        if (!this.config.showInequality) return;
        
        // Create vertical bars representing wealth distribution
        const barGroup = new THREE.Group();
        barGroup.name = 'inequalityVisualization';
        
        const segments = 10; // Wealth deciles
        const barWidth = 0.3;
        const spacing = 0.4;
        
        for (let i = 0; i < segments; i++) {
            // Height represents average wealth in this decile
            let height;
            
            switch (this.config.systemType) {
                case 'capitalist':
                    // Exponential distribution - high inequality
                    height = Math.pow((i + 1) / segments, 3) * 3;
                    break;
                    
                case 'socialist':
                    // More even distribution
                    height = 0.5 + (i / segments) * 1.5;
                    break;
                    
                case 'planned':
                    // Very even distribution
                    height = 1 + (i / segments) * 0.5;
                    break;
                    
                case 'mixed':
                default:
                    // Moderate inequality
                    height = Math.pow((i + 1) / segments, 2) * 2;
                    break;
            }
            
            const barGeometry = new THREE.BoxGeometry(barWidth, height, barWidth);
            const barMaterial = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(i / segments * 0.3, 0.8, 0.5)
            });
            
            const bar = new THREE.Mesh(barGeometry, barMaterial);
            bar.position.set(
                (i - segments / 2) * spacing + 3.5,
                height / 2,
                3
            );
            
            barGroup.add(bar);
            
            // Add interaction for inequality bars
            this.addInteractionTarget(bar, (event) => {
                const decile = i + 1;
                this.emit('inequalityBarSelected', {
                    decile,
                    height,
                    wealthShare: height / segments
                });
            });
        }
        
        this.systems.inequality = barGroup;
        this.group.add(barGroup);
    }
    
    generateEconomicData() {
        // Generate initial economic state based on system type
        switch (this.config.systemType) {
            case 'capitalist':
                this.economicData.inequality.gini = 0.6;
                this.economicData.inequality.top1Percent = 0.4;
                this.economicData.inequality.bottom50Percent = 0.05;
                break;
                
            case 'socialist':
                this.economicData.inequality.gini = 0.25;
                this.economicData.inequality.top1Percent = 0.1;
                this.economicData.inequality.bottom50Percent = 0.3;
                break;
                
            case 'planned':
                this.economicData.inequality.gini = 0.2;
                this.economicData.inequality.top1Percent = 0.08;
                this.economicData.inequality.bottom50Percent = 0.35;
                break;
                
            case 'mixed':
            default:
                this.economicData.inequality.gini = 0.4;
                this.economicData.inequality.top1Percent = 0.25;
                this.economicData.inequality.bottom50Percent = 0.15;
                break;
        }
    }
    
    updateVisualization(deltaTime, totalTime, inputData) {
        super.updateVisualization(deltaTime, totalTime, inputData);
        
        this.time += deltaTime * this.config.animationSpeed;
        
        // Animate resource flows
        if (this.systems.flows && this.config.showFlows) {
            this.animateResourceFlows();
        }
        
        // Update agent activities
        if (this.systems.agents) {
            this.updateAgentActivities();
        }
    }
    
    animateResourceFlows() {
        this.economicData.flows.forEach((flow, index) => {
            const line = flow.line;
            if (line && line.material) {
                // Pulse the opacity of flow lines
                const pulse = Math.sin(this.time * 2 + index * 0.5) * 0.3 + 0.7;
                line.material.opacity = pulse * 0.6;
            }
        });
    }
    
    updateAgentActivities() {
        // Randomly update agent activities and positions
        const updateRate = 0.1; // 10% of agents update per frame
        const agentsToUpdate = Math.floor(this.economicData.agents.length * updateRate * this.time / 60);
        
        for (let i = 0; i < Math.min(agentsToUpdate, 5); i++) {
            const agentIndex = Math.floor(Math.random() * this.economicData.agents.length);
            const agent = this.economicData.agents[agentIndex];
            
            // Small random movement
            agent.position.x += (Math.random() - 0.5) * 0.1;
            agent.position.z += (Math.random() - 0.5) * 0.1;
            
            // Keep within bounds
            agent.position.x = Math.max(-3.5, Math.min(3.5, agent.position.x));
            agent.position.z = Math.max(-3.5, Math.min(3.5, agent.position.z));
            
            // Update height based on terrain
            agent.position.y = this.getTerrainHeightAtPoint(agent.position.x, agent.position.z) + 0.1;
            
            // Update instance matrix
            const dummy = new THREE.Object3D();
            dummy.position.copy(agent.position);
            dummy.updateMatrix();
            
            this.systems.agents.setMatrixAt(agentIndex, dummy.matrix);
        }
        
        if (this.systems.agents) {
            this.systems.agents.instanceMatrix.needsUpdate = true;
        }
    }
    
    getTerrainHeightAtPoint(x, z) {
        // Simple approximation of terrain height for agent positioning
        const size = 8;
        const normalizedX = x / size;
        const normalizedZ = z / size;
        
        switch (this.config.systemType) {
            case 'capitalist':
                return this.noise(normalizedX * 4, normalizedZ * 4) * 1.5 +
                       Math.pow(this.noise(normalizedX * 8, normalizedZ * 8), 3) * 2;
                       
            case 'socialist':
                return this.noise(normalizedX * 2, normalizedZ * 2) * 0.5 +
                       this.noise(normalizedX * 6, normalizedZ * 6) * 0.3;
                       
            case 'planned':
                return Math.sin(normalizedX * Math.PI * 4) * Math.cos(normalizedZ * Math.PI * 4) * 0.4 +
                       this.noise(normalizedX * 3, normalizedZ * 3) * 0.2;
                       
            case 'mixed':
            default:
                return this.noise(normalizedX * 3, normalizedZ * 3) * 0.8 +
                       this.noise(normalizedX * 6, normalizedZ * 6) * 0.4;
        }
    }
    
    getEconomicDataAtPoint(point) {
        // Return economic data for a specific point in space
        return {
            prosperity: this.getTerrainHeightAtPoint(point.x, point.z),
            nearbyAgents: this.economicData.agents.filter(agent => 
                agent.position.distanceTo(point) < 1.0
            ).length,
            flowDensity: this.economicData.flows.filter(flow => {
                const start = this.economicData.agents[flow.start].position;
                const end = this.economicData.agents[flow.end].position;
                const midpoint = start.clone().lerp(end, 0.5);
                return midpoint.distanceTo(point) < 1.0;
            }).length
        };
    }
    
    getAgentType() {
        const rand = Math.random();
        if (rand < 0.7) return 'individual';
        if (rand < 0.9) return 'small_business';
        if (rand < 0.98) return 'corporation';
        return 'government';
    }
    
    /**
     * Change the economic system type and regenerate visualization
     */
    async changeSystemType(newType) {
        if (this.config.systemType === newType) return;
        
        this.config.systemType = newType;
        
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
        
        this.emit('systemTypeChanged', { oldType: this.config.systemType, newType });
    }
}

export default EconomicSystemSpace;
