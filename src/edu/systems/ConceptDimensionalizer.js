import * as THREE from 'three';
import EventEmitter from 'eventemitter3';
import { VRControllerManager } from './VRControllerManager.js';
import { Text3DManager } from '../ui/Text3DManager.js';
import { NavigationMenu } from '../ui/NavigationMenu.js';
import { EconomicSystemSpace } from '../concepts/economic/EconomicSystemSpace.js';
import { EcologicalNetworkSpace } from '../concepts/ecological/EcologicalNetworkSpace.js';
import { TopologySpace } from '../concepts/topology/TopologySpace.js';
import { SocialNetworkSpace } from '../concepts/social/SocialNetworkSpace.js';

/**
 * Single-Visualization VR-Optimized Concept Dimensionalizer System
 * Displays one concept at a time with navigation menu for cognitive load management
 */
export class ConceptDimensionalizer extends EventEmitter {
    constructor(scene, camera, controllers, player, renderer) {
        super();
        
        this.scene = scene;
        this.camera = camera;
        this.controllers = controllers;
        this.player = player;
        this.renderer = renderer;
        
        // Initialize subsystems
        this.vrController = new VRControllerManager(scene, camera, renderer, controllers, player);
        this.textManager = new Text3DManager();
        this.textManager.setScene(scene);
        
        // Create navigation menu
        this.navigationMenu = new NavigationMenu(scene, this.textManager, player);
        
        // Concept spaces registry (all loaded but only one visible at a time)
        this.conceptSpaces = new Map();
        this.currentConceptSpace = null;
        this.currentVisualizationKey = null;
        
        // State management
        this.state = {
            initialized: false,
            transitioning: false,
            mode: 'exploration',
            showingMenu: true
        };
        
        // Visualization positioning
        this.displayPosition = new THREE.Vector3(0.0, 2.0, -6.0); // Single display position
        
        this.setupEventHandlers();

        // this.updateUIPositions();
    }
    
    setupEventHandlers() {
        // VR Controller events
        this.vrController.on('controllerInteraction', (data) => {
            this.handleVRInteraction(data);
        });
        
        this.vrController.on('playerMoved', (data) => {
            this.handlePlayerMovement(data);
        });
        
        this.vrController.on('menuPressed', () => {
            this.toggleNavigationMenu();
        });
        
        this.vrController.on('backPressed', () => {
            this.resetToMenuView();
        });
        
        // Navigation menu events
        this.navigationMenu.on('categoryChanged', (data) => {
            this.handleCategoryChange(data);
        });
        
        this.navigationMenu.on('visualizationChanged', (data) => {
            this.handleVisualizationChange(data);
        });
    }
    
    async initialize() {
        if (this.state.initialized) return;
        
        console.log('Initializing Single-Visualization Concept Dimensionalizer...');
        
        try {
            // Create all concept spaces (but don't add to scene yet)
            await this.createAllConceptSpaces();
            
            // Position player at optimal viewing distance
            // this.player.position.set(0, 1.6, 0);
            // this.player.rotation.y = 0;
            
            // Display initial visualization
            const initialSelection = this.navigationMenu.getCurrentSelection();
            await this.displayVisualization(initialSelection.item.key);
            
            // Set up VR interactions
            this.updateVRIntersections();
            
            this.state.initialized = true;
            this.emit('initialized', this);
            
            console.log('Single-Visualization Concept Dimensionalizer initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Concept Dimensionalizer:', error);
            this.emit('initializationError', error);
        }
    }
    
    async createAllConceptSpaces() {
        // Economic Systems
        const economicConfigs = [
            { systemType: 'mixed', name: 'economic-mixed' },
            { systemType: 'capitalist', name: 'economic-capitalist' },
            { systemType: 'socialist', name: 'economic-socialist' },
            { systemType: 'planned', name: 'economic-planned' }
        ];
        
        for (const config of economicConfigs) {
            const economicSpace = new EconomicSystemSpace(config);
            economicSpace.setPosition(0, 0, 0); // All at origin, we'll move them when displayed
            economicSpace.setScale(1.0); // Full size for single display
            this.setupConceptSpaceEvents(economicSpace);
            await economicSpace.load();
            this.conceptSpaces.set(config.name, economicSpace);
            console.log(`Created economic concept: ${config.name}`);
        }
        
        // Ecological Networks
        const ecologicalConfigs = [
            { ecosystemType: 'forest', name: 'ecological-forest' },
            { ecosystemType: 'ocean', name: 'ecological-ocean' },
            { ecosystemType: 'grassland', name: 'ecological-grassland' },
            { ecosystemType: 'wetland', name: 'ecological-wetland' }
        ];
        
        for (const config of ecologicalConfigs) {
            const ecologicalSpace = new EcologicalNetworkSpace(config);
            ecologicalSpace.setPosition(0, 0, 0);
            ecologicalSpace.setScale(1.0);
            this.setupConceptSpaceEvents(ecologicalSpace);
            await ecologicalSpace.load();
            this.conceptSpaces.set(config.name, ecologicalSpace);
            console.log(`Created ecological concept: ${config.name}`);
        }
        
        // Topology Spaces
        const topologyConfigs = [
            { manifoldType: 'torus', name: 'topology-torus' },
            { manifoldType: 'sphere', name: 'topology-sphere' },
            { manifoldType: 'mobius_strip', name: 'topology-mobius' },
            { manifoldType: 'klein_bottle', name: 'topology-klein' }
        ];
        
        for (const config of topologyConfigs) {
            const topologySpace = new TopologySpace(config);
            topologySpace.setPosition(0, 0, 0);
            topologySpace.setScale(1.0);
            this.setupConceptSpaceEvents(topologySpace);
            await topologySpace.load();
            this.conceptSpaces.set(config.name, topologySpace);
            console.log(`Created topology concept: ${config.name}`);
        }
        
        // Social Networks
        const socialConfigs = [
            { networkType: 'social_media', name: 'social-media' },
            { networkType: 'professional', name: 'social-professional' },
            { networkType: 'family', name: 'social-family' },
            { networkType: 'academic', name: 'social-academic' }
        ];
        
        for (const config of socialConfigs) {
            const socialSpace = new SocialNetworkSpace(config);
            socialSpace.setPosition(0, 0, 0);
            socialSpace.setScale(1.0);
            this.setupConceptSpaceEvents(socialSpace);
            await socialSpace.load();
            this.conceptSpaces.set(config.name, socialSpace);
            console.log(`Created social concept: ${config.name}`);
        }
        
        console.log(`Total concept spaces created: ${this.conceptSpaces.size}`);
    }
    
    setupConceptSpaceEvents(conceptSpace) {
        // Spin control events
        conceptSpace.on('spinToggled', (data) => {
            this.showInfoMessage(`Spin Control`, `${data.concept} rotation ${data.spinning ? 'enabled' : 'disabled'}`);
        });
        
        conceptSpace.on('speedChanged', (data) => {
            this.showInfoMessage(`Speed Control`, `${data.concept} speed: ${data.speed.toFixed(1)}x`);
        });
        
        conceptSpace.on('activated', (space) => {
            console.log(`Concept space activated: ${space.name}`);
            this.emit('conceptActivated', space);
        });
        
        conceptSpace.on('interaction', (event) => {
            this.emit('conceptInteraction', event);
            this.showInteractionFeedback(event);
        });
        
        // Concept-specific events
        conceptSpace.on('terrainClicked', (data) => {
            this.showDetailedInfo('Economic Zone Analysis', data);
        });
        
        conceptSpace.on('agentSelected', (agent) => {
            this.showDetailedInfo('Economic Agent', agent);
        });
        
        conceptSpace.on('inequalityBarSelected', (data) => {
            this.showDetailedInfo('Wealth Distribution', data);
        });
        
        conceptSpace.on('speciesSelected', (species) => {
            this.showDetailedInfo('Species Information', species);
        });
        
        conceptSpace.on('trophicLevelSelected', (data) => {
            this.showDetailedInfo('Trophic Level', data);
        });
        
        conceptSpace.on('manifoldClicked', (data) => {
            this.showDetailedInfo('Manifold Properties', data);
        });
        
        conceptSpace.on('nodeSelected', (data) => {
            this.showDetailedInfo('Network Node', data);
        });
    }
    
    async displayVisualization(visualizationKey) {
        if (this.state.transitioning) return;
        
        const conceptSpace = this.conceptSpaces.get(visualizationKey);
        if (!conceptSpace) {
            console.warn(`Concept space not found: ${visualizationKey}`);
            return;
        }
        
        if (this.currentVisualizationKey === visualizationKey) {
            console.log(`Already displaying: ${visualizationKey}`);
            return;
        }
        
        this.state.transitioning = true;
        
        try {
            // Hide current visualization
            if (this.currentConceptSpace) {
                await this.hideCurrentVisualization();
            }
            
            // Show new visualization
            await this.showVisualization(conceptSpace, visualizationKey);
            
            this.state.transitioning = false;
            this.emit('visualizationDisplayed', { key: visualizationKey, concept: conceptSpace });
            
            console.log(`Now displaying: ${visualizationKey}`);
            
        } catch (error) {
            this.state.transitioning = false;
            console.error(`Failed to display visualization ${visualizationKey}:`, error);
        }
    }
    
    async hideCurrentVisualization() {
        if (!this.currentConceptSpace) return;
        
        // Deactivate current concept
        await this.currentConceptSpace.deactivate();
        
        // Remove from scene
        this.scene.remove(this.currentConceptSpace.getGroup());
        
        // Clear labels
        this.clearVisualizationLabels();
    }
    
    async showVisualization(conceptSpace, visualizationKey) {
        // Position at display location
        conceptSpace.setPosition(this.displayPosition.x, this.displayPosition.y, this.displayPosition.z);
        
        // Add to scene
        this.scene.add(conceptSpace.getGroup());
        
        // Activate concept space
        await conceptSpace.activate();
        
        // Add context labels
        this.addVisualizationLabels(conceptSpace, visualizationKey);
        
        // Update current references
        this.currentConceptSpace = conceptSpace;
        this.currentVisualizationKey = visualizationKey;
        
        // Update VR interactions
        this.updateVRIntersections();
    }
    
    addVisualizationLabels(conceptSpace, visualizationKey) {
        const position = this.displayPosition.clone();
        
        // Get detailed info for this visualization
        const categoryInfo = this.getCategoryInfo(visualizationKey);
        
        // Main title above visualization
        const titleLabel = this.textManager.createConceptTitle(
            categoryInfo.label,
            categoryInfo.description,
            new THREE.Vector3(position.x, position.y + 4, position.z)
        );
        titleLabel.name = 'currentVisualizationTitle';
        this.scene.add(titleLabel);
        
        // Data source attribution
        const sourceLabel = this.textManager.createDataSourceLabel(
            this.getDataSourceInfo(visualizationKey),
            new THREE.Vector3(position.x, position.y - 0.5, position.z + 2)
        );
        sourceLabel.name = 'currentVisualizationSource';
        this.scene.add(sourceLabel);
        
        // Interactive help text
        const helpText = this.textManager.createFloatingLabel(
            'Point & Click to Explore | Menu Button: Navigation | B Button: Reset View',
            new THREE.Vector3(position.x, position.y - 1.0, position.z + 2),
            'info',
            { color: 0x88aaff }
        );
        helpText.name = 'visualizationHelp';
        this.scene.add(helpText);
    }
    
    clearVisualizationLabels() {
        // Remove current visualization labels
        const labelsToRemove = [];
        this.scene.traverse(child => {
            if (child.name === 'currentVisualizationTitle' || 
                child.name === 'currentVisualizationSource' ||
                child.name === 'visualizationHelp') {
                labelsToRemove.push(child);
            }
        });
        
        labelsToRemove.forEach(label => {
            this.scene.remove(label);
            if (label.geometry) label.geometry.dispose();
            if (label.material) {
                if (Array.isArray(label.material)) {
                    label.material.forEach(mat => mat.dispose());
                } else {
                    label.material.dispose();
                }
            }
        });
    }
    
    getCategoryInfo(visualizationKey) {
        // Get human-readable info for visualization key
        const categoryMap = {
            'economic-mixed': { label: 'Mixed Economy', description: 'Balanced market & regulation' },
            'economic-capitalist': { label: 'Market Economy', description: 'Free market capitalism' },
            'economic-socialist': { label: 'Social Economy', description: 'Democratic socialism' },
            'economic-planned': { label: 'Planned Economy', description: 'Central planning system' },
            'ecological-forest': { label: 'Forest Ecosystem', description: 'Temperate forest food web' },
            'ecological-ocean': { label: 'Marine Ecosystem', description: 'Ocean food chain dynamics' },
            'ecological-grassland': { label: 'Grassland Ecosystem', description: 'Prairie & savanna systems' },
            'ecological-wetland': { label: 'Wetland Ecosystem', description: 'Marsh & bog habitats' },
            'topology-torus': { label: 'Torus Surface', description: 'Donut-shaped manifold' },
            'topology-sphere': { label: 'Spherical Surface', description: 'Perfect sphere geometry' },
            'topology-mobius': { label: 'Möbius Strip', description: 'One-sided twisted surface' },
            'topology-klein': { label: 'Klein Bottle', description: 'Non-orientable surface' },
            'social-media': { label: 'Social Media Network', description: 'Online social connections' },
            'social-professional': { label: 'Professional Network', description: 'Workplace relationships' },
            'social-family': { label: 'Family Network', description: 'Kinship connections' },
            'social-academic': { label: 'Academic Network', description: 'Research collaborations' }
        };
        
        return categoryMap[visualizationKey] || { label: visualizationKey, description: 'Unknown concept' };
    }
    
    getDataSourceInfo(visualizationKey) {
        if (visualizationKey.startsWith('economic')) return 'Economic Theory & World Bank Data';
        if (visualizationKey.startsWith('ecological')) return 'Ecological Research & Food Web Theory';
        if (visualizationKey.startsWith('topology')) return 'Mathematical Topology & Differential Geometry';
        if (visualizationKey.startsWith('social')) return 'Network Science & Social Research';
        return 'Procedurally Generated Data';
    }
    
    handleCategoryChange(data) {
        console.log(`Category changed to: ${data.category}`);
        this.displayVisualization(data.item.key);
    }
    
    handleVisualizationChange(data) {
        console.log(`Visualization changed to: ${data.item.key}`);
        this.displayVisualization(data.item.key);
    }
    
    handleVRInteraction(data) {
        const { hand, action, intersection, controller } = data;
        
        if (!intersection) return;
        
        const object = intersection.object;
        
        // Check navigation menu interactions first
        if (this.navigationMenu.handleControllerHover(intersection)) {
            // Menu is being hovered
        }
        if (action === 'trigger' && this.navigationMenu.handleControllerInteraction(intersection)) {
            return; // Menu handled the interaction
        }
        
        // Handle concept space interactions
        if (this.currentConceptSpace) {
            this.currentConceptSpace.interactionTargets.forEach((callback, targetObject) => {
                if (targetObject === object || targetObject.parent === object) {
                    if (action === 'trigger') {
                        this.currentConceptSpace.handleInteraction(intersection, controller, 'select');
                    } else if (action === 'grip') {
                        // Teleport closer to the visualization
                        const targetPos = this.displayPosition.clone();
                        targetPos.z += 4; // Move closer
                        this.vrController.teleportTo(targetPos);
                    }
                }
            });
        }
    }
    
    handlePlayerMovement(data) {
        // Update UI positioning relative to player if needed
        // this.updateUIPositions();
    }
    
    updateUIPositions() {
        // Keep navigation menu at comfortable viewing distance
        const playerPos = this.player.position.clone();
        const forward = new THREE.Vector3(0, 0, -3);
        forward.applyQuaternion(this.player.quaternion);
        
        const menuPos = playerPos.clone().add(forward);
        menuPos.y = playerPos.y + 2.4; // Slightly above eye level
        
        this.navigationMenu.menuGroup.position.copy(menuPos);
        this.navigationMenu.menuGroup.lookAt(playerPos);
        // this.navigationMenu.menuGroup.rotateX(-(Math.PI/2));
    }
    
    toggleNavigationMenu() {
        this.navigationMenu.toggleVisibility();
        this.state.showingMenu = this.navigationMenu.visible;

        console.log(`Navigation menu ${this.state.showingMenu ? 'shown' : 'hidden'}`);
    }

    resetToMenuView() {
        // Return to optimal viewing position
        this.player.position.set(0, 1.6, 0);
        this.player.rotation.y = 0;

        // Show navigation menu
        this.navigationMenu.setVisible(true);
        this.state.showingMenu = true;
        
        console.log('Reset to menu view');
    }
    
    showDetailedInfo(title, data) {
        // Create floating info panel near current visualization
        let content = '';
        if (typeof data === 'object') {
            Object.keys(data).forEach(key => {
                if (key !== 'line' && key !== 'particle' && typeof data[key] !== 'object') {
                    content += `${key}: ${data[key]}\n`;
                }
            });
        } else {
            content = data.toString();
        }
        
        const panelPosition = this.displayPosition.clone();
        panelPosition.x += 4;
        panelPosition.y += 1;
        
        // Remove existing info panel
        this.clearInfoPanel();
        
        // Create new info panel
        this.currentInfoPanel = this.textManager.createInfoPanel(
            title,
            content,
            panelPosition,
            { width: 3, height: 2.5, backgroundColor: 0x000066 }
        );
        this.currentInfoPanel.name = 'currentInfoPanel';
        
        this.scene.add(this.currentInfoPanel);
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            this.clearInfoPanel();
        }, 8000);
    }
    
    showInfoMessage(title, message) {
        console.log(`${title}: ${message}`);
        // Could show brief floating message near menu
    }
    
    clearInfoPanel() {
        if (this.currentInfoPanel) {
            this.scene.remove(this.currentInfoPanel);
            this.currentInfoPanel.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.currentInfoPanel = null;
        }
    }
    
    showInteractionFeedback(event) {
        console.log('Interaction feedback:', event);
    }
    
    updateVRIntersections() {
        const intersectableObjects = [];
        
        // Add navigation menu interactive objects
        intersectableObjects.push(...this.navigationMenu.getInteractiveObjects());
        
        // Add current concept space interactive objects
        if (this.currentConceptSpace) {
            this.currentConceptSpace.interactionTargets.forEach((callback, object) => {
                intersectableObjects.push(object);
            });
        }
        
        // Update VR controller with intersectable objects
        this.vrController.setIntersectableObjects(intersectableObjects);
    }
    
    update(deltaTime, totalTime, inputData) {
        // Update navigation menu position and interactions
        this.navigationMenu.update(deltaTime);
        // Update VR controller system
        this.vrController.update(deltaTime);
        
        // Update current concept space only
        if (this.currentConceptSpace) {
            this.currentConceptSpace.updateVisualization(deltaTime, totalTime, inputData);
        }
        
        // Update text system
        this.textManager.updateBillboards(this.camera);
        this.textManager.updateFloatingAnimations(deltaTime);
        
        // Update VR intersections if needed
        this.updateVRIntersections();
    }
    
    getCurrentVisualization() {
        return {
            key: this.currentVisualizationKey,
            concept: this.currentConceptSpace
        };
    }
    
    getAvailableVisualizations() {
        return Array.from(this.conceptSpaces.keys());
    }
    
    dispose() {
        // Clean up VR controller
        this.vrController.dispose();
        
        // Clean up text manager
        this.textManager.dispose();
        
        // Clean up navigation menu
        this.navigationMenu.dispose();
        
        // Clean up all concept spaces
        this.conceptSpaces.forEach(conceptSpace => {
            conceptSpace.dispose();
        });
        
        this.conceptSpaces.clear();
        
        // Clear current visualization
        this.clearVisualizationLabels();
        this.clearInfoPanel();
        
        this.removeAllListeners();
        
        console.log('Single-Visualization Concept Dimensionalizer disposed');
    }
}

export default ConceptDimensionalizer;
