import { XRInputManager } from '@iwsdk/xr-input';

/**
 * IWSDK Bootstrap for WebXR Layers Start Template
 * Integrates IWSDK's XRInputManager with an existing Three.js WebXR setup
 * 
 * Note: XRInputManager uses Preact signals for reactivity, not EventEmitter.
 * The update() method requires (xrManager, delta, time) parameters.
 * 
 * We don't use @iwsdk/core's World class here because:
 * - World.create() is designed to own the entire rendering pipeline
 * - Our main.js already has its own Three.js renderer/scene/camera setup
 * - We only need XRInputManager for controller/hand input integration
 */
export class IWSDKBootstrap {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    // IWSDK XRInputManager instance
    this.inputManager = null;
    
    // Signal subscriptions for cleanup
    this._signalUnsubscribers = [];
    
    // System instances
    this.systems = new Map();
    
    // Event listeners for external communication
    this._eventListeners = {};
    
    console.log('IWSDK Bootstrap initialized');
  }

  async initialize() {
    try {
      // Initialize XR Input Management
      // XRInputManager expects { camera, scene } with PerspectiveCamera
      console.log('Initializing XR Input Manager...');
      this.inputManager = new XRInputManager({
        camera: this.camera,
        scene: this.scene
      });

      // Register core systems
      this.registerCoreSystems();
      
      console.log('IWSDK Bootstrap initialized successfully');
      
      // Expose for debugging
      if (typeof window !== 'undefined') {
        window.iwsdk = {
          inputManager: this.inputManager,
          systems: this.systems
        };
      }
      
      return true;
    } catch (error) {
      console.error('Failed to initialize IWSDK Bootstrap:', error);
      throw error;
    }
  }

  registerCoreSystems() {
    // Input system setup using signals (not events)
    this.setupInputSystem();
    
    // Video layer system (preserve existing functionality)
    this.setupVideoLayerSystem();
    
    console.log('Core IWSDK systems registered');
  }

  setupInputSystem() {
    // XRInputManager uses Preact signals for reactivity, not EventEmitter.
    // Subscribe to visual adapter signals to detect controller changes.
    
    if (!this.inputManager) return;
    
    const { visualAdapters } = this.inputManager;
    
    // Subscribe to left controller visual adapter changes
    if (visualAdapters.left && typeof visualAdapters.left.subscribe === 'function') {
      const unsubLeft = visualAdapters.left.subscribe((adapter) => {
        if (adapter) {
          console.log('Left controller connected via IWSDK');
          this.emit('controllerConnected', { hand: 'left', adapter });
        } else {
          console.log('Left controller disconnected via IWSDK');
          this.emit('controllerDisconnected', { hand: 'left' });
        }
      });
      this._signalUnsubscribers.push(unsubLeft);
    }
    
    // Subscribe to right controller visual adapter changes
    if (visualAdapters.right && typeof visualAdapters.right.subscribe === 'function') {
      const unsubRight = visualAdapters.right.subscribe((adapter) => {
        if (adapter) {
          console.log('Right controller connected via IWSDK');
          this.emit('controllerConnected', { hand: 'right', adapter });
        } else {
          console.log('Right controller disconnected via IWSDK');
          this.emit('controllerDisconnected', { hand: 'right' });
        }
      });
      this._signalUnsubscribers.push(unsubRight);
    }
    
    console.log('Input system setup with signal-based reactivity');
  }

  setupVideoLayerSystem() {
    // Create a custom system for video layer management
    const videoSystem = {
      name: 'VideoLayerSystem',
      update: (deltaTime) => {
        // Video layer updates will be handled here
      }
    };
    
    this.systems.set('video', videoSystem);
  }

  // Event system for communication with existing code
  on(eventName, callback) {
    if (!this._eventListeners[eventName]) this._eventListeners[eventName] = [];
    this._eventListeners[eventName].push(callback);
  }

  off(eventName, callback) {
    if (this._eventListeners[eventName]) {
      this._eventListeners[eventName] = this._eventListeners[eventName].filter(cb => cb !== callback);
    }
  }

  emit(eventName, data) {
    if (this._eventListeners[eventName]) {
      this._eventListeners[eventName].forEach(callback => callback(data));
    }
  }

  /**
   * Update IWSDK systems in the render loop
   * @param {THREE.WebXRManager} xrManager - The Three.js WebXRManager (renderer.xr)
   * @param {number} delta - Delta time since last frame
   * @param {number} time - Total elapsed time
   */
  update(xrManager, delta, time) {
    // XRInputManager.update() expects (xrManager, delta, time)
    // xrManager must be a Three.js WebXRManager with getSession(), getReferenceSpace(), getFrame()
    if (this.inputManager && xrManager) {
      this.inputManager.update(xrManager, delta, time);
    }
    
    // Update custom systems
    this.systems.forEach(system => {
      if (system.update) {
        system.update(delta);
      }
    });
  }

  // Enhanced controller access via XRInputManager
  getGamepads() {
    if (this.inputManager) {
      return this.inputManager.gamepads;
    }
    return { left: undefined, right: undefined };
  }

  getVisualAdapters() {
    if (this.inputManager) {
      return this.inputManager.visualAdapters;
    }
    return null;
  }

  getXROrigin() {
    if (this.inputManager) {
      return this.inputManager.xrOrigin;
    }
    return null;
  }

  // Session management - XRInputManager handles this internally via update()
  // These methods are kept for external notification purposes
  onSessionStarted(session) {
    console.log('XR Session started, IWSDK will integrate via update loop');
    // XRInputManager detects session internally in update() via xrManager.getSession()
  }

  onSessionEnded() {
    console.log('XR Session ended');
    // XRInputManager handles session end internally when getSession() returns null
  }

  dispose() {
    console.log('Disposing IWSDK Bootstrap');
    
    // Unsubscribe from signals
    this._signalUnsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this._signalUnsubscribers = [];
    
    // Dispose systems
    this.systems.forEach(system => {
      if (system.dispose) {
        system.dispose();
      }
    });
    this.systems.clear();
    
    // Note: XRInputManager doesn't have a dispose() method
    this.inputManager = null;
    
    // Clear event listeners
    this._eventListeners = {};
  }
}

export default IWSDKBootstrap;
