import * as THREE from 'three';
import EventEmitter from 'eventemitter3';
import { XR_BUTTONS } from 'gamepad-wrapper';

/**
 * VR Controller Manager with Fixed Ray Visualization and Trigger Mapping
 */
export class VRControllerManager extends EventEmitter {
    constructor(scene, camera, renderer, controllers, player) {
        super();
        
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.controllers = controllers;
        this.player = player;
        
        // Movement settings
        this.moveSpeed = 2.0;
        this.turnSpeed = 1.0;
        this.smoothDamping = 0.8;
        
        // Interaction settings
        this.raycaster = new THREE.Raycaster();
        this.raycaster.far = 50;
        
        // Ray visualization settings - simplified for debugging
        this.rayLength = 10; // Reduced for easier debugging
        
        // Movement state
        this.velocity = new THREE.Vector3();
        this.isMoving = false;
        this.isTurning = false;
        
        // Ray visuals storage
        this.rayVisuals = new Map();
        this.intersectionMarkers = new Map();
        
        // Debug ray creation after a short delay to ensure controllers are ready
        setTimeout(() => {
            this.createSimpleRayVisuals();
        }, 1000);
        
        console.log('VR Controller Manager initialized with simple ray debugging');
    }
    
    createSimpleRayVisuals() {
        console.log('Creating simple ray visuals...');
        console.log('Available controllers:', Object.keys(this.controllers));
        
        ['left', 'right'].forEach(hand => {
            const controller = this.controllers[hand];
            console.log(`${hand} controller:`, controller);
            
            if (controller && controller.raySpace) {
                console.log(`Creating ray for ${hand} controller`);
                this.createDebugRay(hand, controller);
            } else {
                console.warn(`${hand} controller or raySpace not available`);
            }
        });
    }
    
    createDebugRay(hand, controller) {
        try {
            // Create very simple, highly visible ray
            const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -this.rayLength)
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Bright, opaque materials for high visibility
            const material = new THREE.LineBasicMaterial({
                color: hand === 'right' ? 0x00ff00 : 0xff0000,  // Bright green/red
                transparent: false,  // No transparency issues
                linewidth: 5,  // Thick lines
                opacity: 1.0  // Full opacity
            });
            
            const rayLine = new THREE.Line(geometry, material);
            rayLine.name = `${hand}-controller-ray`;
            rayLine.visible = true;  // Always visible
            
            // Add to controller's raySpace
            controller.raySpace.add(rayLine);
            
            // Store reference
            this.rayVisuals.set(hand, {
                line: rayLine,
                material: material,
                geometry: geometry
            });
            
            console.log(`✓ Created ${hand} ray, added to raySpace, visible:`, rayLine.visible);
            
            // Create intersection marker
            this.createSimpleIntersectionMarker(hand);
            
        } catch (error) {
            console.error(`Error creating ${hand} ray:`, error);
        }
    }
    
    createSimpleIntersectionMarker(hand) {
        try {
            const markerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const markerMaterial = new THREE.MeshBasicMaterial({ 
                color: hand === 'right' ? 0x00ff00 : 0xff0000,
                transparent: true,
                opacity: 0.8
            });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.name = `${hand}-intersection-marker`;
            marker.visible = false; // Hidden until intersection
            
            this.scene.add(marker);
            this.intersectionMarkers.set(hand, marker);
            
            console.log(`✓ Created ${hand} intersection marker`);
        } catch (error) {
            console.error(`Error creating ${hand} intersection marker:`, error);
        }
    }
    
    update(deltaTime) {
        // Handle controller input
        this.handleControllerInput(deltaTime);
        
        // Update movement
        this.updateMovement(deltaTime);
        
        // Update ray casting
        this.updateRayCasting();
    }
    
    handleControllerInput(deltaTime) {
        // Right controller
        if (this.controllers.right?.gamepad) {
            const rightGamepad = this.controllers.right.gamepad;
            
            // PRIMARY TRIGGER = MAIN CLICK EVENT
            if (rightGamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
                console.log('Right trigger pressed - PRIMARY CLICK');
                this.handlePrimaryClick('right');
            }
            
            // Handle movement if available
            try {
                const moveX = rightGamepad.getAxis('THUMBSTICK_RIGHT_X') || 0;
                const moveZ = -(rightGamepad.getAxis('THUMBSTICK_RIGHT_Y') || 0);
                
                if (Math.abs(moveX) > 0.1 || Math.abs(moveZ) > 0.1) {
                    this.handleLocomotion(moveX, moveZ, deltaTime);
                }
            } catch (error) {
                // Thumbstick not available - this is normal
            }
        }
        
        // Left controller  
        if (this.controllers.left?.gamepad) {
            const leftGamepad = this.controllers.left.gamepad;
            
            // PRIMARY TRIGGER = MAIN CLICK EVENT
            if (leftGamepad.getButtonClick(XR_BUTTONS.TRIGGER)) {
                console.log('Left trigger pressed - PRIMARY CLICK');
                this.handlePrimaryClick('left');
            }
            
            // Handle turning if available
            try {
                const turnX = leftGamepad.getAxis('THUMBSTICK_LEFT_X') || 0;
                
                if (Math.abs(turnX) > 0.2) {
                    this.handleTurning(turnX, deltaTime);
                }
            } catch (error) {
                // Thumbstick not available - this is normal
            }
        }
    }
    
    handlePrimaryClick(hand) {
        const controller = this.controllers[hand];
        if (!controller) return;
        
        console.log(`Primary click from ${hand} controller`);
        
        // Flash the ray for visual feedback
        this.flashRay(hand);
        
        // Perform raycast for interaction
        this.performRaycast(hand, 'primary_click');
    }
    
    flashRay(hand) {
        const rayVisual = this.rayVisuals.get(hand);
        if (!rayVisual) return;
        
        // Store original color
        const originalColor = rayVisual.material.color.getHex();
        
        // Flash white
        rayVisual.material.color.setHex(0xffffff);
        
        // Return to original color after flash
        setTimeout(() => {
            rayVisual.material.color.setHex(originalColor);
        }, 200);
    }
    
    performRaycast(hand, action) {
        const controller = this.controllers[hand];
        if (!controller) return;
        
        // Set up raycaster
        const raySpace = controller.raySpace;
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(raySpace.matrixWorld);
        
        this.raycaster.ray.origin.setFromMatrixPosition(raySpace.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        // Get intersectable objects
        const intersectableObjects = this.getIntersectableObjects();
        const intersections = this.raycaster.intersectObjects(intersectableObjects, true);
        
        if (intersections.length > 0) {
            const intersection = intersections[0];
            
            console.log(`${hand} controller hit:`, intersection.object.name || 'unnamed object', 'at distance:', intersection.distance);
            
            // Show intersection marker
            const marker = this.intersectionMarkers.get(hand);
            if (marker) {
                marker.position.copy(intersection.point);
                marker.visible = true;
                
                // Hide marker after 1 second
                setTimeout(() => {
                    marker.visible = false;
                }, 1000);
            }
            
            // Emit interaction event
            this.emit('controllerInteraction', {
                hand,
                action,
                intersection,
                controller,
                distance: intersection.distance
            });
            
        } else {
            console.log(`${hand} controller - no intersection`);
            
            // Emit empty interaction
            this.emit('controllerInteraction', {
                hand,
                action,
                intersection: null,
                controller
            });
        }
    }
    
    updateRayCasting() {
        // Update ray colors based on intersections
        ['left', 'right'].forEach(hand => {
            this.updateRayColor(hand);
        });
    }
    
    updateRayColor(hand) {
        const controller = this.controllers[hand];
        const rayVisual = this.rayVisuals.get(hand);
        
        if (!controller || !rayVisual) return;
        
        // Set up raycaster
        const raySpace = controller.raySpace;
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(raySpace.matrixWorld);
        
        this.raycaster.ray.origin.setFromMatrixPosition(raySpace.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        const intersections = this.raycaster.intersectObjects(this.getIntersectableObjects(), true);
        
        if (intersections.length > 0) {
            const distance = intersections[0].distance;
            
            // Color based on distance
            let color;
            if (distance < 3) {
                color = 0x00ff00; // Green - close
            } else if (distance < 8) {
                color = 0xffff00; // Yellow - medium
            } else {
                color = 0xff8800; // Orange - far
            }
            
            rayVisual.material.color.setHex(color);
        } else {
            // No intersection - use base color
            const baseColor = hand === 'right' ? 0x00ff00 : 0xff0000;
            rayVisual.material.color.setHex(baseColor);
        }
    }
    
    handleLocomotion(moveX, moveZ, deltaTime) {
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        
        forward.applyQuaternion(this.player.quaternion);
        right.applyQuaternion(this.player.quaternion);
        
        const moveVector = new THREE.Vector3();
        moveVector.addScaledVector(right, moveX);
        moveVector.addScaledVector(forward, moveZ);
        moveVector.normalize();
        
        const speed = this.moveSpeed * deltaTime;
        this.player.position.addScaledVector(moveVector, speed);
        
        this.emit('playerMoved', {
            position: this.player.position.clone(),
            direction: moveVector
        });
        
        this.isMoving = true;
    }
    
    handleTurning(turnX, deltaTime) {
        const turnAmount = turnX * this.turnSpeed * deltaTime;
        this.player.rotateY(-turnAmount);
        
        this.emit('playerTurned', {
            rotation: this.player.rotation.y,
            amount: turnAmount
        });
        
        this.isTurning = true;
    }
    
    updateMovement(deltaTime) {
        if (!this.isMoving) {
            this.velocity.multiplyScalar(this.smoothDamping);
            
            if (this.velocity.length() < 0.01) {
                this.velocity.set(0, 0, 0);
            }
        }
        
        this.isMoving = false;
        this.isTurning = false;
    }
    
    getIntersectableObjects() {
        return this._intersectableObjects || [];
    }
    
    setIntersectableObjects(objects) {
        this._intersectableObjects = objects;
        console.log(`✓ Set ${objects.length} intersectable objects for ray casting`);
    }
    
    // Get current intersection for external use
    getCurrentIntersection(hand) {
        const controller = this.controllers[hand];
        if (!controller) return null;
        
        const raySpace = controller.raySpace;
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.identity().extractRotation(raySpace.matrixWorld);
        
        this.raycaster.ray.origin.setFromMatrixPosition(raySpace.matrixWorld);
        this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
        
        const intersections = this.raycaster.intersectObjects(this.getIntersectableObjects(), true);
        return intersections.length > 0 ? intersections[0] : null;
    }
    
    // Teleportation
    teleportTo(position) {
        if (position instanceof THREE.Vector3) {
            this.player.position.copy(position);
            this.player.position.y = Math.max(this.player.position.y, 0);
            
            this.emit('playerTeleported', {
                position: this.player.position.clone()
            });
        }
    }
    
    // Player state
    getPlayerState() {
        return {
            position: this.player.position.clone(),
            rotation: this.player.rotation.clone(),
            isMoving: this.isMoving,
            isTurning: this.isTurning
        };
    }
    
    // Settings
    setComfortSettings(settings) {
        this.moveSpeed = settings.moveSpeed || this.moveSpeed;
        this.turnSpeed = settings.turnSpeed || this.turnSpeed;
        this.smoothDamping = settings.smoothDamping || this.smoothDamping;
    }
    
    // Cleanup
    dispose() {
        // Clean up ray visuals
        this.rayVisuals.forEach((rayVisual, hand) => {
            if (rayVisual.line.parent) {
                rayVisual.line.parent.remove(rayVisual.line);
            }
            rayVisual.geometry.dispose();
            rayVisual.material.dispose();
        });
        
        // Clean up intersection markers
        this.intersectionMarkers.forEach((marker, hand) => {
            this.scene.remove(marker);
            marker.geometry.dispose();
            marker.material.dispose();
        });
        
        this.rayVisuals.clear();
        this.intersectionMarkers.clear();
        this.removeAllListeners();
        
        console.log('VR Controller Manager disposed');
    }
}

export default VRControllerManager;
