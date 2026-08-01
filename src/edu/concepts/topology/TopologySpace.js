import * as THREE from 'three';
import { ConceptSpace } from '../base/ConceptSpace.js';
import * as TWEEN from '@tweenjs/tween.js';

/**
 * Mathematical Topology Visualization Space
 * Represents topological concepts as navigable 3D manifolds and surfaces
 */
export class TopologySpace extends ConceptSpace {
    constructor(config = {}) {
        super('Topology', {
            manifoldType: 'torus', // 'torus', 'klein_bottle', 'mobius_strip', 'sphere'
            complexity: 'intermediate',
            resolution: 64,
            showProjection: true,
            showCurvature: true,
            animationSpeed: 1.0,
            ...config
        });
        
        this.topologyData = {
            vertices: [],
            faces: [],
            curvature: [],
            projections: []
        };
        
        this.systems = {
            manifold: null,
            projection: null,
            curvatureIndicators: null,
            pathLines: null
        };
        
        this.time = 0;
        this.parameterU = 0;
        this.parameterV = 0;
    }
    
    async createVisualization() {
        // Create the main manifold
        await this.createManifold();
        
        // Create curvature visualization
        await this.createCurvatureVisualization();
        
        // Create projection demonstration
        await this.createProjectionDemo();
        
        // Create geodesic paths
        await this.createGeodesicPaths();
        
        console.log(`Topology Space created: ${this.config.manifoldType}`);
    }
    
    async createManifold() {
        let geometry;
        
        switch (this.config.manifoldType) {
            case 'torus':
                geometry = this.createTorusGeometry();
                break;
            case 'klein_bottle':
                geometry = this.createKleinBottleGeometry();
                break;
            case 'mobius_strip':
                geometry = this.createMobiusStripGeometry();
                break;
            case 'sphere':
                geometry = this.createSphereGeometry();
                break;
            default:
                geometry = this.createTorusGeometry();
        }
        
        // Create material with vertex colors for curvature
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            wireframe: false,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.systems.manifold = new THREE.Mesh(geometry, material);
        this.systems.manifold.name = 'topologyManifold';
        this.group.add(this.systems.manifold);
        
        // Add interaction for manifold
        this.addInteractionTarget(this.systems.manifold, (event) => {
            const point = event.intersection.point;
            this.emit('manifoldClicked', {
                position: point,
                localCoordinates: this.getLocalCoordinates(point),
                curvature: this.getCurvatureAtPoint(point)
            });
        });
    }
    
    createTorusGeometry() {
        const majorRadius = 1.5;
        const minorRadius = 0.6;
        const resolution = this.config.resolution;
        
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const colors = [];
        const indices = [];
        
        for (let i = 0; i <= resolution; i++) {
            const u = (i / resolution) * Math.PI * 2;
            
            for (let j = 0; j <= resolution; j++) {
                const v = (j / resolution) * Math.PI * 2;
                
                // Torus parametric equations
                const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
                const y = minorRadius * Math.sin(v);
                const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
                
                vertices.push(x, y, z);
                
                // Calculate normal
                const nx = Math.cos(v) * Math.cos(u);
                const ny = Math.sin(v);
                const nz = Math.cos(v) * Math.sin(u);
                normals.push(nx, ny, nz);
                
                // Color based on Gaussian curvature
                const gaussianCurvature = Math.cos(v) / (minorRadius * (majorRadius + minorRadius * Math.cos(v)));
                const colorIntensity = (gaussianCurvature + 1) / 2; // Normalize to 0-1
                colors.push(colorIntensity, 1 - colorIntensity, 0.5);
                
                // Create face indices
                if (i < resolution && j < resolution) {
                    const current = i * (resolution + 1) + j;
                    const next = current + resolution + 1;
                    
                    indices.push(current, next, current + 1);
                    indices.push(next, next + 1, current + 1);
                }
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
        return geometry;
    }
    
    createKleinBottleGeometry() {
        const resolution = this.config.resolution;
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const colors = [];
        const indices = [];
        
        for (let i = 0; i <= resolution; i++) {
            const u = (i / resolution) * Math.PI * 2;
            
            for (let j = 0; j <= resolution; j++) {
                const v = (j / resolution) * Math.PI * 2;
                
                // Klein bottle parametric equations (figure-8 immersion)
                let x, y, z;
                
                if (u < Math.PI) {
                    x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(u) * Math.cos(v);
                    y = 8 * Math.sin(u) + (2 * (1 - Math.cos(u) / 2)) * Math.sin(u) * Math.cos(v);
                    z = (2 * (1 - Math.cos(u) / 2)) * Math.sin(v);
                } else {
                    x = 3 * Math.cos(u) * (1 + Math.sin(u)) + (2 * (1 - Math.cos(u) / 2)) * Math.cos(v + Math.PI);
                    y = 8 * Math.sin(u);
                    z = (2 * (1 - Math.cos(u) / 2)) * Math.sin(v);
                }
                
                // Scale down
                x *= 0.2;
                y *= 0.2;
                z *= 0.2;
                
                vertices.push(x, y, z);
                
                // Approximate normal (simplified)
                const normal = new THREE.Vector3(x, y, z).normalize();
                normals.push(normal.x, normal.y, normal.z);
                
                // Color based on u parameter
                const colorU = u / (Math.PI * 2);
                const colorV = v / (Math.PI * 2);
                colors.push(colorU, colorV, 0.8);
                
                // Create face indices
                if (i < resolution && j < resolution) {
                    const current = i * (resolution + 1) + j;
                    const next = current + resolution + 1;
                    
                    indices.push(current, next, current + 1);
                    indices.push(next, next + 1, current + 1);
                }
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
        return geometry;
    }
    
    createMobiusStripGeometry() {
        const resolution = this.config.resolution;
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const colors = [];
        const indices = [];
        
        for (let i = 0; i <= resolution; i++) {
            const u = (i / resolution) * Math.PI * 2;
            
            for (let j = 0; j <= resolution / 4; j++) {
                const v = (j / (resolution / 4) - 0.5) * 0.8; // Width parameter
                
                // Möbius strip parametric equations
                const x = (1 + v * Math.cos(u / 2)) * Math.cos(u);
                const y = v * Math.sin(u / 2);
                const z = (1 + v * Math.cos(u / 2)) * Math.sin(u);
                
                vertices.push(x, y, z);
                
                // Calculate normal (pointing outward)
                const normal = new THREE.Vector3();
                // Simplified normal calculation
                normal.set(x, y, z).normalize();
                normals.push(normal.x, normal.y, normal.z);
                
                // Color gradient across the strip
                const colorValue = (v + 0.4) / 0.8; // Normalize v to 0-1
                colors.push(1 - colorValue, colorValue, 0.5);
                
                // Create face indices
                if (i < resolution && j < resolution / 4) {
                    const current = i * (Math.floor(resolution / 4) + 1) + j;
                    const next = current + Math.floor(resolution / 4) + 1;
                    
                    indices.push(current, next, current + 1);
                    indices.push(next, next + 1, current + 1);
                }
            }
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
        return geometry;
    }
    
    createSphereGeometry() {
        const geometry = new THREE.SphereGeometry(1.5, this.config.resolution, this.config.resolution);
        
        // Add custom coloring for sphere
        const colors = [];
        const positions = geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const x = positions[i];
            const y = positions[i + 1];
            const z = positions[i + 2];
            
            // Color based on spherical coordinates
            const phi = Math.atan2(z, x);
            const theta = Math.acos(y / Math.sqrt(x*x + y*y + z*z));
            
            const r = (Math.sin(phi * 4) + 1) / 2;
            const g = (Math.sin(theta * 4) + 1) / 2;
            const b = 0.7;
            
            colors.push(r, g, b);
        }
        
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        return geometry;
    }
    
    async createCurvatureVisualization() {
        if (!this.config.showCurvature) return;
        
        const curvatureGroup = new THREE.Group();
        curvatureGroup.name = 'curvatureIndicators';
        
        // Create small arrows or spheres indicating curvature
        const indicatorCount = 20;
        const indicatorGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
        const positiveCurvatureMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const negativeCurvatureMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        
        for (let i = 0; i < indicatorCount; i++) {
            const u = (i / indicatorCount) * Math.PI * 2;
            const v = Math.PI * 0.5; // Middle of the surface
            
            // Calculate position on manifold
            const position = this.getManifoldPoint(u, v);
            const curvature = this.getCurvatureAtParameters(u, v);
            
            const indicator = new THREE.Mesh(
                indicatorGeometry,
                curvature > 0 ? positiveCurvatureMaterial : negativeCurvatureMaterial
            );
            
            indicator.position.copy(position);
            indicator.scale.setScalar(Math.abs(curvature) * 2 + 0.5);
            
            curvatureGroup.add(indicator);
        }
        
        this.systems.curvatureIndicators = curvatureGroup;
        this.group.add(curvatureGroup);
    }
    
    async createProjectionDemo() {
        if (!this.config.showProjection) return;
        
        const projectionGroup = new THREE.Group();
        projectionGroup.name = 'projectionDemo';
        
        // Create a 2D projection of the 3D manifold
        const projectionGeometry = new THREE.PlaneGeometry(3, 3, 32, 32);
        const projectionMaterial = new THREE.MeshBasicMaterial({
            color: 0x666666,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        const projectionMesh = new THREE.Mesh(projectionGeometry, projectionMaterial);
        projectionMesh.position.set(-4, 0, 0);
        projectionMesh.rotateY(Math.PI / 2);
        
        projectionGroup.add(projectionMesh);
        
        // Create lines connecting 3D manifold to 2D projection
        const connectionLines = [];
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x888888,
            transparent: true,
            opacity: 0.2
        });
        
        // Sample points and create projection lines
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                const u = (i / 9) * Math.PI * 2;
                const v = (j / 9) * Math.PI * 2;
                
                const manifoldPoint = this.getManifoldPoint(u, v);
                const projectionPoint = new THREE.Vector3(-4, manifoldPoint.y, manifoldPoint.z);
                
                const points = [manifoldPoint, projectionPoint];
                const connectionGeometry = new THREE.BufferGeometry().setFromPoints(points);
                const connectionLine = new THREE.Line(connectionGeometry, lineMaterial);
                
                projectionGroup.add(connectionLine);
            }
        }
        
        this.systems.projection = projectionGroup;
        this.group.add(projectionGroup);
    }
    
    async createGeodesicPaths() {
        const pathGroup = new THREE.Group();
        pathGroup.name = 'geodesicPaths';
        
        // Create several geodesic paths on the manifold
        const pathCount = 3;
        const pathColors = [0xff0000, 0x00ff00, 0x0000ff];
        
        for (let i = 0; i < pathCount; i++) {
            const pathPoints = this.calculateGeodesicPath(i);
            
            const pathGeometry = new THREE.BufferGeometry().setFromPoints(pathPoints);
            const pathMaterial = new THREE.LineBasicMaterial({
                color: pathColors[i],
                linewidth: 3
            });
            
            const pathLine = new THREE.Line(pathGeometry, pathMaterial);
            pathGroup.add(pathLine);
        }
        
        this.systems.pathLines = pathGroup;
        this.group.add(pathGroup);
    }
    
    calculateGeodesicPath(pathIndex) {
        // Simplified geodesic calculation
        const points = [];
        const steps = 50;
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const u = pathIndex * Math.PI * 0.7 + t * Math.PI * 2;
            const v = Math.sin(t * Math.PI * 2) * 0.5 + Math.PI * 0.5;
            
            const point = this.getManifoldPoint(u, v);
            points.push(point);
        }
        
        return points;
    }
    
    getManifoldPoint(u, v) {
        switch (this.config.manifoldType) {
            case 'torus':
                return this.getTorusPoint(u, v);
            case 'klein_bottle':
                return this.getKleinBottlePoint(u, v);
            case 'mobius_strip':
                return this.getMobiusStripPoint(u, v);
            case 'sphere':
                return this.getSpherePoint(u, v);
            default:
                return this.getTorusPoint(u, v);
        }
    }
    
    getTorusPoint(u, v) {
        const majorRadius = 1.5;
        const minorRadius = 0.6;
        
        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = minorRadius * Math.sin(v);
        const z = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
        
        return new THREE.Vector3(x, y, z);
    }
    
    getKleinBottlePoint(u, v) {
        // Simplified Klein bottle point
        const x = Math.cos(u) * (3 + Math.cos(v));
        const y = Math.sin(u) * (3 + Math.cos(v));
        const z = Math.sin(v);
        
        return new THREE.Vector3(x * 0.2, y * 0.2, z * 0.2);
    }
    
    getMobiusStripPoint(u, v) {
        v = (v - Math.PI) * 0.4; // Normalize v
        
        const x = (1 + v * Math.cos(u / 2)) * Math.cos(u);
        const y = v * Math.sin(u / 2);
        const z = (1 + v * Math.cos(u / 2)) * Math.sin(u);
        
        return new THREE.Vector3(x, y, z);
    }
    
    getSpherePoint(u, v) {
        const radius = 1.5;
        
        const x = radius * Math.sin(v) * Math.cos(u);
        const y = radius * Math.cos(v);
        const z = radius * Math.sin(v) * Math.sin(u);
        
        return new THREE.Vector3(x, y, z);
    }
    
    getCurvatureAtParameters(u, v) {
        // Simplified curvature calculation
        switch (this.config.manifoldType) {
            case 'torus':
                return Math.cos(v) / (1.5 * (1.5 + 0.6 * Math.cos(v)));
            case 'sphere':
                return 1 / (1.5 * 1.5); // Constant positive curvature
            case 'mobius_strip':
                return 0; // Flat surface
            case 'klein_bottle':
                return Math.sin(u) * Math.cos(v); // Variable curvature
            default:
                return 0;
        }
    }
    
    getCurvatureAtPoint(point) {
        // Convert world point back to parametric coordinates (simplified)
        return Math.random() - 0.5; // Placeholder
    }
    
    getLocalCoordinates(point) {
        // Convert world point to local manifold coordinates (simplified)
        return {
            u: Math.atan2(point.z, point.x),
            v: Math.atan2(point.y, Math.sqrt(point.x * point.x + point.z * point.z))
        };
    }
    
    updateVisualization(deltaTime, totalTime, inputData) {
        super.updateVisualization(deltaTime, totalTime, inputData);
        
        this.time += deltaTime * this.config.animationSpeed;
        
        // Animate parameter exploration
        this.parameterU += deltaTime * 0.5;
        this.parameterV += deltaTime * 0.3;
        
        // Animate curvature indicators
        if (this.systems.curvatureIndicators) {
            this.systems.curvatureIndicators.children.forEach((indicator, index) => {
                const pulse = Math.sin(this.time * 2 + index * 0.5) * 0.3 + 1;
                indicator.scale.setScalar(pulse * 0.8);
                indicator.rotation.y += deltaTime;
            });
        }
        
        // Animate manifold deformation (if applicable)
        if (this.systems.manifold && this.config.manifoldType === 'torus') {
            // Subtle breathing animation
            const breathe = Math.sin(this.time * 0.5) * 0.1 + 1;
            this.systems.manifold.scale.setScalar(breathe);
        }
    }
    
    /**
     * Change the manifold type and regenerate visualization
     */
    async changeManifoldre(newType) {
        if (this.config.manifoldType === newType) return;
        
        this.config.manifoldType = newType;
        
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
        
        this.emit('manifoldTypeChanged', { oldType: this.config.manifoldType, newType });
    }
}

export default TopologySpace;
