import * as THREE from 'three';
import { ConceptSpace } from '../base/ConceptSpace.js';
import * as d3Force3D from 'd3-force-3d';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Social Network Visualization Space
 * Represents social graphs and network dynamics as interactive 3D networks
 */
export class SocialNetworkSpace extends ConceptSpace {
    constructor(config = {}) {
        super('SocialNetwork', {
            networkType: 'social_media', // 'social_media', 'professional', 'family', 'academic'
            complexity: 'intermediate',
            nodeCount: 150,
            showCommunities: true,
            showInfluence: true,
            animationSpeed: 1.0,
            ...config
        });
        
        this.networkData = {
            nodes: [],
            links: [],
            communities: [],
            influenceScores: new Map()
        };
        
        this.systems = {
            nodes: null,
            links: null,
            communityGroups: null,
            influenceIndicators: null
        };
        
        this.simulation = null;
        this.time = 0;
    }
    
    async createVisualization() {
        // Generate network data
        await this.generateNetworkData();
        
        // Create force simulation
        await this.createForceSimulation();
        
        // Create node visualization
        await this.createNodeVisualization();
        
        // Create link visualization
        await this.createLinkVisualization();
        
        // Create community visualization
        await this.createCommunityVisualization();
        
        // Create influence indicators
        await this.createInfluenceVisualization();
        
        console.log(`Social Network Space created: ${this.config.networkType}`);
    }
    
    async generateNetworkData() {
        const nodeCount = Math.min(this.config.nodeCount, 200);
        
        // Generate nodes
        for (let i = 0; i < nodeCount; i++) {
            const node = {
                id: i,
                x: (Math.random() - 0.5) * 6,
                y: (Math.random() - 0.5) * 6,
                z: (Math.random() - 0.5) * 6,
                vx: 0,
                vy: 0,
                vz: 0,
                degree: 0,
                community: Math.floor(Math.random() * 5), // 5 communities
                influence: Math.random(),
                type: this.getNodeType(),
                activity: Math.random()
            };
            
            this.networkData.nodes.push(node);
        }
        
        // Generate links based on network type
        this.generateLinks();
        
        // Calculate communities
        this.detectCommunities();
        
        // Calculate influence scores
        this.calculateInfluenceScores();
    }
    
    generateLinks() {
        const linkProbability = this.getLinkProbability();
        
        for (let i = 0; i < this.networkData.nodes.length; i++) {
            for (let j = i + 1; j < this.networkData.nodes.length; j++) {
                const nodeA = this.networkData.nodes[i];
                const nodeB = this.networkData.nodes[j];
                
                let connectionProbability = linkProbability;
                
                // Increase probability for same community
                if (nodeA.community === nodeB.community) {
                    connectionProbability *= 3;
                }
                
                // Network type specific rules
                switch (this.config.networkType) {
                    case 'social_media':
                        // Higher connectivity, some hubs
                        if (nodeA.influence > 0.8 || nodeB.influence > 0.8) {
                            connectionProbability *= 2;
                        }
                        break;
                        
                    case 'professional':
                        // More structured, hierarchical
                        const levelDiff = Math.abs(nodeA.influence - nodeB.influence);
                        if (levelDiff < 0.2) {
                            connectionProbability *= 1.5;
                        }
                        break;
                        
                    case 'family':
                        // Dense local clusters
                        connectionProbability *= 0.5;
                        if (nodeA.community === nodeB.community) {
                            connectionProbability *= 8;
                        }
                        break;
                        
                    case 'academic':
                        // Citation-like network
                        if (nodeA.influence < nodeB.influence) {
                            connectionProbability *= 1.5;
                        }
                        break;
                }
                
                if (Math.random() < connectionProbability) {
                    const link = {
                        source: nodeA,
                        target: nodeB,
                        strength: Math.random() * 0.5 + 0.5,
                        type: this.getLinkType()
                    };
                    
                    this.networkData.links.push(link);
                    nodeA.degree++;
                    nodeB.degree++;
                }
            }
        }
    }
    
    getLinkProbability() {
        switch (this.config.networkType) {
            case 'social_media': return 0.08;
            case 'professional': return 0.05;
            case 'family': return 0.03;
            case 'academic': return 0.04;
            default: return 0.05;
        }
    }
    
    getNodeType() {
        const types = {
            social_media: ['user', 'influencer', 'brand', 'bot'],
            professional: ['employee', 'manager', 'executive', 'consultant'],
            family: ['parent', 'child', 'sibling', 'relative'],
            academic: ['student', 'researcher', 'professor', 'institution']
        };
        
        const nodeTypes = types[this.config.networkType] || types.social_media;
        return nodeTypes[Math.floor(Math.random() * nodeTypes.length)];
    }
    
    getLinkType() {
        const types = {
            social_media: ['friend', 'follow', 'mention', 'share'],
            professional: ['colleague', 'reports_to', 'collaborates', 'mentors'],
            family: ['parent_of', 'sibling_of', 'married_to', 'related_to'],
            academic: ['cites', 'collaborates', 'advises', 'affiliated_with']
        };
        
        const linkTypes = types[this.config.networkType] || types.social_media;
        return linkTypes[Math.floor(Math.random() * linkTypes.length)];
    }
    
    detectCommunities() {
        // Simple community detection based on existing community assignments
        // In a real implementation, this would use algorithms like Louvain
        
        for (let i = 0; i < 5; i++) {
            const communityNodes = this.networkData.nodes.filter(node => node.community === i);
            
            if (communityNodes.length > 0) {
                this.networkData.communities.push({
                    id: i,
                    nodes: communityNodes,
                    size: communityNodes.length,
                    density: this.calculateCommunityDensity(i),
                    color: this.getCommunityColor(i)
                });
            }
        }
    }
    
    calculateCommunityDensity(communityId) {
        const communityNodes = this.networkData.nodes.filter(node => node.community === communityId);
        const communityNodeIds = new Set(communityNodes.map(node => node.id));
        
        let internalLinks = 0;
        let possibleLinks = (communityNodes.length * (communityNodes.length - 1)) / 2;
        
        this.networkData.links.forEach(link => {
            if (communityNodeIds.has(link.source.id) && communityNodeIds.has(link.target.id)) {
                internalLinks++;
            }
        });
        
        return possibleLinks > 0 ? internalLinks / possibleLinks : 0;
    }
    
    getCommunityColor(communityId) {
        const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xffa07a, 0x98d8c8];
        return colors[communityId % colors.length];
    }
    
    calculateInfluenceScores() {
        // Calculate influence based on degree centrality and other factors
        this.networkData.nodes.forEach(node => {
            let influence = node.degree / Math.max(...this.networkData.nodes.map(n => n.degree));
            
            // Adjust based on network type
            switch (this.config.networkType) {
                case 'social_media':
                    // Influencers have higher base influence
                    if (node.type === 'influencer') influence *= 1.5;
                    break;
                case 'professional':
                    // Executives and managers have higher influence
                    if (node.type === 'executive') influence *= 1.8;
                    if (node.type === 'manager') influence *= 1.3;
                    break;
                case 'academic':
                    // Professors have higher influence
                    if (node.type === 'professor') influence *= 1.6;
                    break;
            }
            
            this.networkData.influenceScores.set(node.id, Math.min(influence, 1));
        });
    }
    
    async createForceSimulation() {
        // Create 3D force simulation
        this.simulation = d3Force3D.forceSimulation(this.networkData.nodes)
            .force('link', d3Force3D.forceLink(this.networkData.links)
                .id(d => d.id)
                .distance(1.5)
                .strength(0.3))
            .force('charge', d3Force3D.forceManyBody()
                .strength(-30)
                .distanceMax(5))
            .force('center', d3Force3D.forceCenter(0, 0, 0))
            .alpha(0.8)
            .alphaDecay(0.01);
    }
    
    async createNodeVisualization() {
        // Create instanced mesh for nodes
        const nodeGeometry = new THREE.SphereGeometry(0.1, 8, 6);
        const nodeCount = this.networkData.nodes.length;
        
        const nodeMesh = new THREE.InstancedMesh(
            nodeGeometry,
            new THREE.MeshPhongMaterial({ color: 0x44ff88 }),
            nodeCount
        );
        
        nodeMesh.name = 'socialNetworkNodes';
        
        // Set initial positions and properties
        const dummy = new THREE.Object3D();
        this.networkData.nodes.forEach((node, index) => {
            dummy.position.set(node.x, node.y, node.z);
            
            // Scale based on influence
            const influence = this.networkData.influenceScores.get(node.id) || 0;
            const scale = 0.5 + influence * 1.5;
            dummy.scale.setScalar(scale);
            
            dummy.updateMatrix();
            nodeMesh.setMatrixAt(index, dummy.matrix);
            
            // Set color based on community
            const community = this.networkData.communities.find(c => c.id === node.community);
            const color = new THREE.Color(community ? community.color : 0x44ff88);
            nodeMesh.setColorAt(index, color);
        });
        
        nodeMesh.instanceMatrix.needsUpdate = true;
        if (nodeMesh.instanceColor) {
            nodeMesh.instanceColor.needsUpdate = true;
        }
        
        this.systems.nodes = nodeMesh;
        this.group.add(nodeMesh);
        
        // Add interaction for nodes
        this.addInteractionTarget(nodeMesh, (event) => {
            const instanceId = event.intersection.instanceId;
            if (instanceId !== undefined) {
                const node = this.networkData.nodes[instanceId];
                this.emit('nodeSelected', {
                    node,
                    influence: this.networkData.influenceScores.get(node.id),
                    connections: this.getNodeConnections(node)
                });
            }
        });
    }
    
    async createLinkVisualization() {
        const linkGroup = new THREE.Group();
        linkGroup.name = 'socialNetworkLinks';
        
        this.networkData.links.forEach((link, index) => {
            const linkGeometry = new THREE.BufferGeometry();
            const linkMaterial = new THREE.LineBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.6
            });
            
            // Initial positions (will be updated by simulation)
            const points = [
                new THREE.Vector3(link.source.x, link.source.y, link.source.z),
                new THREE.Vector3(link.target.x, link.target.y, link.target.z)
            ];
            
            linkGeometry.setFromPoints(points);
            const linkLine = new THREE.Line(linkGeometry, linkMaterial);
            
            linkGroup.add(linkLine);
            link.line = linkLine; // Store reference for updates
        });
        
        this.systems.links = linkGroup;
        this.group.add(linkGroup);
    }
    
    async createCommunityVisualization() {
        if (!this.config.showCommunities) return;
        
        const communityGroup = new THREE.Group();
        communityGroup.name = 'communityGroups';
        
        this.networkData.communities.forEach(community => {
            // Calculate community center
            const center = new THREE.Vector3();
            community.nodes.forEach(node => {
                center.add(new THREE.Vector3(node.x, node.y, node.z));
            });
            center.divideScalar(community.nodes.length);
            
            // Create community boundary sphere
            let maxDistance = 0;
            community.nodes.forEach(node => {
                const distance = center.distanceTo(new THREE.Vector3(node.x, node.y, node.z));
                maxDistance = Math.max(maxDistance, distance);
            });
            
            const boundaryGeometry = new THREE.SphereGeometry(maxDistance + 0.5, 16, 16);
            const boundaryMaterial = new THREE.MeshBasicMaterial({
                color: community.color,
                transparent: true,
                opacity: 0.1,
                wireframe: true
            });
            
            const boundarySphere = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
            boundarySphere.position.copy(center);
            
            communityGroup.add(boundarySphere);
        });
        
        this.systems.communityGroups = communityGroup;
        this.group.add(communityGroup);
    }
    
    async createInfluenceVisualization() {
        if (!this.config.showInfluence) return;
        
        const influenceGroup = new THREE.Group();
        influenceGroup.name = 'influenceIndicators';
        
        // Create rings around highly influential nodes
        this.networkData.nodes.forEach(node => {
            const influence = this.networkData.influenceScores.get(node.id) || 0;
            
            if (influence > 0.7) { // Only show for highly influential nodes
                const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 16);
                const ringMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffff00,
                    transparent: true,
                    opacity: influence,
                    side: THREE.DoubleSide
                });
                
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.position.set(node.x, node.y, node.z);
                ring.lookAt(0, 0, 0); // Face camera
                
                influenceGroup.add(ring);
                node.influenceRing = ring; // Store reference for updates
            }
        });
        
        this.systems.influenceIndicators = influenceGroup;
        this.group.add(influenceGroup);
    }
    
    getNodeConnections(node) {
        return this.networkData.links.filter(link => 
            link.source.id === node.id || link.target.id === node.id
        );
    }
    
    updateVisualization(deltaTime, totalTime, inputData) {
        super.updateVisualization(deltaTime, totalTime, inputData);
        
        this.time += deltaTime * this.config.animationSpeed;
        
        // Update force simulation
        if (this.simulation) {
            this.simulation.tick();
            this.updateNodePositions();
            this.updateLinkPositions();
        }
        
        // Animate influence indicators
        if (this.systems.influenceIndicators) {
            this.animateInfluenceIndicators(deltaTime);
        }
        
        // Update community boundaries
        if (this.systems.communityGroups) {
            this.updateCommunityBoundaries();
        }
    }
    
    updateNodePositions() {
        if (!this.systems.nodes) return;
        
        const dummy = new THREE.Object3D();
        this.networkData.nodes.forEach((node, index) => {
            dummy.position.set(node.x, node.y, node.z);
            
            // Scale based on influence and activity
            const influence = this.networkData.influenceScores.get(node.id) || 0;
            const activity = Math.sin(this.time * 2 + index * 0.1) * 0.1 + 1;
            const scale = (0.5 + influence * 1.5) * activity;
            dummy.scale.setScalar(scale);
            
            dummy.updateMatrix();
            this.systems.nodes.setMatrixAt(index, dummy.matrix);
            
            // Update influence ring position if it exists
            if (node.influenceRing) {
                node.influenceRing.position.set(node.x, node.y, node.z);
            }
        });
        
        this.systems.nodes.instanceMatrix.needsUpdate = true;
    }
    
    updateLinkPositions() {
        if (!this.systems.links) return;
        
        this.networkData.links.forEach(link => {
            if (link.line) {
                const points = [
                    new THREE.Vector3(link.source.x, link.source.y, link.source.z),
                    new THREE.Vector3(link.target.x, link.target.y, link.target.z)
                ];
                
                link.line.geometry.setFromPoints(points);
                link.line.geometry.attributes.position.needsUpdate = true;
            }
        });
    }
    
    animateInfluenceIndicators(deltaTime) {
        this.systems.influenceIndicators.children.forEach((ring, index) => {
            // Pulse the rings
            const pulse = Math.sin(this.time * 3 + index * 0.5) * 0.3 + 1;
            ring.scale.setScalar(pulse);
            
            // Rotate the rings
            ring.rotation.z += deltaTime * 2;
        });
    }
    
    updateCommunityBoundaries() {
        // Update community boundary positions based on node movements
        this.networkData.communities.forEach((community, index) => {
            if (index < this.systems.communityGroups.children.length) {
                const boundary = this.systems.communityGroups.children[index];
                
                // Recalculate center
                const center = new THREE.Vector3();
                community.nodes.forEach(node => {
                    center.add(new THREE.Vector3(node.x, node.y, node.z));
                });
                center.divideScalar(community.nodes.length);
                
                boundary.position.copy(center);
                
                // Pulse the boundary
                const pulse = Math.sin(this.time + index) * 0.1 + 1;
                boundary.scale.setScalar(pulse);
            }
        });
    }
    
    /**
     * Change the network type and regenerate visualization
     */
    async changeNetworkType(newType) {
        if (this.config.networkType === newType) return;
        
        this.config.networkType = newType;
        
        // Animate transition
        const exitTween = new TWEEN.Tween(this.group.scale)
            .to({ x: 0.1, y: 0.1, z: 0.1 }, 500)
            .easing(TWEEN.Easing.Cubic.In)
            .onComplete(async () => {
                // Regenerate visualization
                this.group.clear();
                this.setupBaseStructure();
                
                // Reset data
                this.networkData = {
                    nodes: [],
                    links: [],
                    communities: [],
                    influenceScores: new Map()
                };
                
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
        
        this.emit('networkTypeChanged', { oldType: this.config.networkType, newType });
    }
}

export default SocialNetworkSpace;
