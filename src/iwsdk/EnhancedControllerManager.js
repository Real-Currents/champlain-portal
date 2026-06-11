import { XRInputManager } from '@iwsdk/xr-input';
import { GamepadWrapper } from 'gamepad-wrapper';

/**
 * Enhanced Controller Manager that bridges IWSDK XR Input with existing gamepad-wrapper approach
 * Maintains compatibility while adding IWSDK benefits
 * 
 * Note: XRInputManager uses Preact signals for reactivity, not EventEmitter.
 * The update() method requires (xrManager, delta, time) parameters.
 */
export class EnhancedControllerManager {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    // IWSDK XR Input Manager
    this.iwsdkInputManager = null;
    
    // Legacy controller compatibility
    this.controllers = {
      left: null,
      right: null
    };
    
    // Signal subscriptions for cleanup
    this._signalUnsubscribers = [];
    
    // Event handlers for external communication
    this._eventHandlers = {};
    
    // Track previous adapter state to detect changes
    this._previousAdapters = {
      left: undefined,
      right: undefined
    };
    
    console.log('Enhanced Controller Manager initialized');
  }

  async initialize() {
    console.log('Initializing Enhanced Controller Manager...');
    
    // Initialize IWSDK Input Manager
    // XRInputManager expects { camera, scene } with PerspectiveCamera
    this.iwsdkInputManager = new XRInputManager({
      camera: this.camera,
      scene: this.scene
    });

    // Note: XRInputManager doesn't have an initialize() method
    // It initializes in the constructor and updates via update()
    
    // Set up signal-based event handling
    this.setupSignalSubscriptions();
    
    console.log('Enhanced Controller Manager ready');
  }

  setupSignalSubscriptions() {
    if (!this.iwsdkInputManager) return;
    
    const { visualAdapters, gamepads } = this.iwsdkInputManager;
    
    // Subscribe to left controller visual adapter changes
    if (visualAdapters.left && typeof visualAdapters.left.subscribe === 'function') {
      const unsubLeft = visualAdapters.left.subscribe((adapter) => {
        const wasConnected = this._previousAdapters.left !== undefined;
        const isConnected = adapter !== undefined;
        
        if (!wasConnected && isConnected) {
          console.log('IWSDK Controller added: left');
          this.updateLegacyController('left', adapter);
          this.emit('controllerConnected', { hand: 'left', adapter });
        } else if (wasConnected && !isConnected) {
          console.log('IWSDK Controller removed: left');
          this.controllers.left = null;
          this.emit('controllerDisconnected', { hand: 'left' });
        }
        
        this._previousAdapters.left = adapter;
      });
      this._signalUnsubscribers.push(unsubLeft);
    }
    
    // Subscribe to right controller visual adapter changes
    if (visualAdapters.right && typeof visualAdapters.right.subscribe === 'function') {
      const unsubRight = visualAdapters.right.subscribe((adapter) => {
        const wasConnected = this._previousAdapters.right !== undefined;
        const isConnected = adapter !== undefined;
        
        if (!wasConnected && isConnected) {
          console.log('IWSDK Controller added: right');
          this.updateLegacyController('right', adapter);
          this.emit('controllerConnected', { hand: 'right', adapter });
        } else if (wasConnected && !isConnected) {
          console.log('IWSDK Controller removed: right');
          this.controllers.right = null;
          this.emit('controllerDisconnected', { hand: 'right' });
        }
        
        this._previousAdapters.right = adapter;
      });
      this._signalUnsubscribers.push(unsubRight);
    }
  }

  updateLegacyController(hand, adapter) {
    // Create a legacy-compatible controller object from the IWSDK adapter
    const gamepad = this.iwsdkInputManager?.gamepads[hand];
    
    this.controllers[hand] = {
      // Wrap the StatefulGamepad if available, otherwise null
      gamepad: gamepad ? new GamepadWrapper(gamepad.inputSource?.gamepad) : null,
      raySpace: this.iwsdkInputManager?.xrOrigin?.raySpaces[hand],
      gripSpace: this.iwsdkInputManager?.xrOrigin?.gripSpaces[hand],
      mesh: adapter?.visual?.model,
      hand: hand,
      // IWSDK enhancements
      iwsdkAdapter: adapter,
      statefulGamepad: gamepad
    };
  }

  // Legacy compatibility methods
  getController(hand) {
    return this.controllers[hand];
  }

  getControllers() {
    return this.controllers;
  }

  // Enhanced IWSDK methods
  getIWSDKAdapter(hand) {
    return this.iwsdkInputManager?.visualAdapters[hand]?.value;
  }

  getGamepads() {
    return this.iwsdkInputManager?.gamepads || { left: undefined, right: undefined };
  }

  getXROrigin() {
    return this.iwsdkInputManager?.xrOrigin;
  }

  /**
   * Update the controller manager in the render loop
   * @param {THREE.WebXRManager} xrManager - The Three.js WebXRManager (renderer.xr)
   * @param {number} delta - Delta time since last frame
   * @param {number} time - Total elapsed time
   */
  update(xrManager, delta, time) {
    // XRInputManager.update() expects (xrManager, delta, time)
    if (this.iwsdkInputManager && xrManager) {
      this.iwsdkInputManager.update(xrManager, delta, time);
    }
    
    // Update legacy controller gamepad wrappers with latest data
    ['left', 'right'].forEach(hand => {
      const gamepad = this.iwsdkInputManager?.gamepads[hand];
      if (this.controllers[hand] && gamepad?.inputSource?.gamepad) {
        this.controllers[hand].gamepad = new GamepadWrapper(gamepad.inputSource.gamepad);
        this.controllers[hand].statefulGamepad = gamepad;
      }
    });
  }

  // Event system for external communication
  on(eventName, callback) {
    if (!this._eventHandlers[eventName]) {
      this._eventHandlers[eventName] = [];
    }
    this._eventHandlers[eventName].push(callback);
  }

  off(eventName, callback) {
    if (this._eventHandlers[eventName]) {
      this._eventHandlers[eventName] = this._eventHandlers[eventName].filter(cb => cb !== callback);
    }
  }

  emit(eventName, data) {
    if (this._eventHandlers[eventName]) {
      this._eventHandlers[eventName].forEach(callback => callback(data));
    }
  }

  dispose() {
    console.log('Disposing Enhanced Controller Manager');
    
    // Unsubscribe from signals
    this._signalUnsubscribers.forEach(unsub => {
      if (typeof unsub === 'function') unsub();
    });
    this._signalUnsubscribers = [];
    
    // Note: XRInputManager doesn't have a dispose() method
    this.iwsdkInputManager = null;
    
    // Clear controllers
    this.controllers.left = null;
    this.controllers.right = null;
    
    // Clear event handlers
    this._eventHandlers = {};
    
    // Reset previous state
    this._previousAdapters = { left: undefined, right: undefined };
  }
}

export default EnhancedControllerManager;
