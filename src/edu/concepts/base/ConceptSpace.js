import * as THREE from 'three';
import EventEmitter from 'eventemitter3';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Base class for all concept visualization spaces
 * Provides common functionality for spatial concept representation
 */
export class ConceptSpace extends EventEmitter {
    constructor(name, config = {}) {
        super();
        
        this.name = name;
        this.config = {
            complexity: 'intermediate',
            autoRotate: false, // Changed to false by default
            rotationSpeed: 0.5, // Configurable rotation speed
            scale: 1.0,
            position: new THREE.Vector3(0, 0, 0),
            ...config
        };
        
        // Core Three.js objects
        this.group = new THREE.Group();
        this.group.name = `ConceptSpace_${this.name}`;
        
        // State management
        this.state = {
            loaded: false,
            active: false,
            transitioning: false,
            complexity: this.config.complexity,
            spinning: this.config.autoRotate // Track spinning state
        };
        
        // Interaction systems
        this.interactionTargets = new Map();
        this.animations = new TWEEN.Group();
        
        // Performance tracking
        this.performance = {
            lastFrameTime: 0,
            averageFrameTime: 16.67, // 60fps baseline
            frameCount: 0
        };
        
        // Spin control UI
        this.spinControls = null;
        
        this.setupBaseStructure();
    }
    
    setupBaseStructure() {
        // Create base coordinate system visualization
        this.coordinateSystem = this.createCoordinateSystem();
        this.group.add(this.coordinateSystem);
        
        // Create bounding area indicator
        this.boundingArea = this.createBoundingArea();
        this.group.add(this.boundingArea);
        
        // Create spin control UI
        this.createSpinControls();
    }
    
    createCoordinateSystem() {
        const coordGroup = new THREE.Group();
        coordGroup.name = 'coordinateSystem';
        
        // X axis - Red
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(2, 0, 0)
        ]);
        const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
        const xLine = new THREE.Line(xGeometry, xMaterial);
        coordGroup.add(xLine);
        
        // Y axis - Green
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 2, 0)
        ]);
        const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true });
        const yLine = new THREE.Line(yGeometry, yMaterial);
        coordGroup.add(yLine);
        
        // Z axis - Blue
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, 2)
        ]);
        const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, opacity: 0.5, transparent: true });
        const zLine = new THREE.Line(zGeometry, zMaterial);
        coordGroup.add(zLine);
        
        return coordGroup;
    }
    
    createBoundingArea() {
        const geometry = new THREE.RingGeometry(4.8, 5.0, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x444444, 
            opacity: 0.2, 
            transparent: true,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(geometry, material);
        ring.rotateX(-Math.PI / 2);
        ring.name = 'boundingArea';
        return ring;
    }
    
    createSpinControls() {
        const controlsGroup = new THREE.Group();
        controlsGroup.name = 'spinControls';
        
        // Spin toggle button
        const buttonGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16);
        const buttonMaterial = new THREE.MeshPhongMaterial({
            color: this.state.spinning ? 0x00ff00 : 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        
        const spinButton = new THREE.Mesh(buttonGeometry, buttonMaterial);
        spinButton.position.set(0, 2.5, 0);
        spinButton.name = 'spinToggleButton';
        spinButton.userData = {
            interactive: true,
            type: 'spinToggle',
            conceptSpace: this
        };
        
        controlsGroup.add(spinButton);
        
        // Spin indicator (spinning ring when active)
        const indicatorGeometry = new THREE.TorusGeometry(0.2, 0.02, 8, 16);
        const indicatorMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: this.state.spinning ? 0.8 : 0.2
        });
        
        const spinIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
        spinIndicator.position.set(0, 2.5, 0);
        spinIndicator.name = 'spinIndicator';
        
        controlsGroup.add(spinIndicator);
        
        // Speed control (up/down arrows)
        const arrowUpGeo = new THREE.ConeGeometry(0.08, 0.15, 6);
        const arrowDownGeo = new THREE.ConeGeometry(0.08, 0.15, 6);
        const arrowMaterial = new THREE.MeshPhongMaterial({ color: 0xffff00 });
        
        const speedUpButton = new THREE.Mesh(arrowUpGeo, arrowMaterial);
        speedUpButton.position.set(0.4, 2.6, 0);
        speedUpButton.name = 'speedUpButton';
        speedUpButton.userData = {
            interactive: true,
            type: 'speedUp',
            conceptSpace: this
        };
        
        const speedDownButton = new THREE.Mesh(arrowDownGeo, arrowMaterial);
        speedDownButton.position.set(0.4, 2.4, 0);
        speedDownButton.rotation.z = Math.PI; // Point down
        speedDownButton.name = 'speedDownButton';
        speedDownButton.userData = {
            interactive: true,
            type: 'speedDown',
            conceptSpace: this
        };
        
        controlsGroup.add(speedUpButton);
        controlsGroup.add(speedDownButton);
        
        this.spinControls = controlsGroup;
        this.group.add(controlsGroup);
        
        // Add controls to interaction targets
        this.addInteractionTarget(spinButton, (event) => this.toggleSpin());
        this.addInteractionTarget(speedUpButton, (event) => this.adjustSpeed(0.1));
        this.addInteractionTarget(speedDownButton, (event) => this.adjustSpeed(-0.1));
        this.addInteractionTarget(spinIndicator, (event) => this.toggleSpin());
    }
    
    toggleSpin() {
        this.state.spinning = !this.state.spinning;
        this.config.autoRotate = this.state.spinning;
        
        // Update visual indicators
        const spinButton = this.spinControls.getObjectByName('spinToggleButton');
        const spinIndicator = this.spinControls.getObjectByName('spinIndicator');
        
        if (spinButton) {
            spinButton.material.color.setHex(this.state.spinning ? 0x00ff00 : 0xff0000);
        }
        
        if (spinIndicator) {
            spinIndicator.material.opacity = this.state.spinning ? 0.8 : 0.2;
        }
        
        this.emit('spinToggled', {
            spinning: this.state.spinning,
            concept: this.name
        });
        
        console.log(`${this.name} spin ${this.state.spinning ? 'enabled' : 'disabled'}`);
    }
    
    adjustSpeed(delta) {
        this.config.rotationSpeed = Math.max(0.1, Math.min(2.0, this.config.rotationSpeed + delta));
        
        this.emit('speedChanged', {
            speed: this.config.rotationSpeed,
            concept: this.name
        });
        
        console.log(`${this.name} rotation speed: ${this.config.rotationSpeed.toFixed(1)}`);
    }
    
    // Enable/disable spin programmatically
    setSpin(enabled, speed = null) {
        this.state.spinning = enabled;
        this.config.autoRotate = enabled;
        
        if (speed !== null) {
            this.config.rotationSpeed = Math.max(0.1, Math.min(2.0, speed));
        }
        
        // Update visual indicators
        const spinButton = this.spinControls?.getObjectByName('spinToggleButton');
        const spinIndicator = this.spinControls?.getObjectByName('spinIndicator');
        
        if (spinButton) {
            spinButton.material.color.setHex(this.state.spinning ? 0x00ff00 : 0xff0000);
        }
        
        if (spinIndicator) {
            spinIndicator.material.opacity = this.state.spinning ? 0.8 : 0.2;
        }
    }
    
    /**
     * Abstract method to be implemented by subclasses
     * Should create the specific visualization for this concept
     */
    async createVisualization() {
        throw new Error('createVisualization must be implemented by subclass');
    }
    
    /**
     * Abstract method for concept-specific update logic
     */
    updateVisualization(deltaTime, totalTime, inputData) {
        // Base implementation - update animations
        this.animations.update();
        
        // Auto-rotation if enabled
        if (this.config.autoRotate && this.state.active && this.state.spinning) {
            this.group.rotation.y += deltaTime * this.config.rotationSpeed;
        }
        
        // Animate spin indicator when spinning
        if (this.state.spinning && this.spinControls) {
            const indicator = this.spinControls.getObjectByName('spinIndicator');
            if (indicator) {
                indicator.rotation.z += deltaTime * 3; // Fast indicator spin
            }
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics(deltaTime);
    }
    
    updatePerformanceMetrics(deltaTime) {
        this.performance.frameCount++;
        this.performance.lastFrameTime = deltaTime * 1000; // Convert to ms
        
        // Calculate rolling average
        const alpha = 0.1;
        this.performance.averageFrameTime = 
            alpha * this.performance.lastFrameTime + 
            (1 - alpha) * this.performance.averageFrameTime;
    }
    
    /**
     * Load concept data and initialize visualization
     */
    async load() {
        if (this.state.loaded) return;
        
        try {
            this.state.transitioning = true;
            this.emit('loadStart', this);
            
            await this.createVisualization();
            
            this.state.loaded = true;
            this.state.transitioning = false;
            this.emit('loadComplete', this);
            
        } catch (error) {
            this.state.transitioning = false;
            this.emit('loadError', { concept: this, error });
            console.error(`Failed to load concept space ${this.name}:`, error);
        }
    }
    
    /**
     * Activate this concept space (make it the primary focus)
     */
    async activate() {
        if (this.state.active) return;
        
        this.state.active = true;
        this.emit('activated', this);
        
        // Animate entrance
        const entranceTween = new TWEEN.Tween(this.group.scale)
            .to({ x: 1, y: 1, z: 1 }, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
        
        this.animations.add(entranceTween);
    }
    
    /**
     * Deactivate this concept space
     */
    async deactivate() {
        if (!this.state.active) return;
        
        this.state.active = false;
        this.emit('deactivated', this);
        
        // Animate exit
        const exitTween = new TWEEN.Tween(this.group.scale)
            .to({ x: 0.8, y: 0.8, z: 0.8 }, 500) // Scale down but keep visible
            .easing(TWEEN.Easing.Cubic.In)
            .start();
        
        this.animations.add(exitTween);
    }
    
    /**
     * Add an interaction target for controller raycast detection
     */
    addInteractionTarget(object, callback) {
        this.interactionTargets.set(object, callback);
        return object;
    }
    
    /**
     * Handle controller interaction
     */
    handleInteraction(intersection, controller, eventType = 'select') {
        const object = intersection.object;
        const callback = this.interactionTargets.get(object);
        
        if (callback) {
            callback({
                intersection,
                controller,
                eventType,
                concept: this
            });
            
            this.emit('interaction', {
                intersection,
                controller,
                eventType,
                concept: this
            });
        }
    }
    
    /**
     * Get the Three.js group for adding to scene
     */
    getGroup() {
        return this.group;
    }
    
    /**
     * Set position in 3D space
     */
    setPosition(x, y, z) {
        if (typeof x === 'object') {
            this.group.position.copy(x);
        } else {
            this.group.position.set(x, y, z);
        }
    }
    
    /**
     * Set scale
     */
    setScale(scale) {
        if (typeof scale === 'number') {
            this.group.scale.setScalar(scale);
        } else {
            this.group.scale.copy(scale);
        }
    }
    
    /**
     * Get current spin state and speed
     */
    getSpinState() {
        return {
            spinning: this.state.spinning,
            speed: this.config.rotationSpeed,
            autoRotate: this.config.autoRotate
        };
    }
    
    /**
     * Dispose of resources
     */
    dispose() {
        // Remove all event listeners
        this.removeAllListeners();
        
        // Stop animations
        this.animations.removeAll();
        
        // Dispose of geometries and materials
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(material => material.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        
        // Clear interaction targets
        this.interactionTargets.clear();
        
        this.emit('disposed', this);
    }
}

export default ConceptSpace;
