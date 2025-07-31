import * as THREE from 'three';

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper } from 'gamepad-wrapper';
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory";

import { VRButton } from "three/examples/jsm/webxr/VRButton.js";
import { XRButton } from "three/examples/jsm/webxr/XRButton.js";

// These definition make it possible to try different version THREE in the package deps
const PlaneGeometry = ("PlaneBufferGeometry" in THREE) ?
   THREE.PlaneBufferGeometry : THREE.PlaneGeometry;

const SphereGeometry = ("SphereBufferGeometry" in THREE) ?
   THREE.SphereBufferGeometry : THREE.SphereGeometry;

let currentSession = null;
let initWithLayers = true;

setTimeout(function init () {

   console.log("Initiate WebXR Layers scene!");

   let camera, clock, scene, renderer, player;

   const videoWidth = 2064;
   const videoHeight = 2208;
   const videoReducer = 0.090579710

   const previewWindow = {
      width: window.innerWidth, // / 2, // 640,
      height: window.innerHeight + 10, // 480,
   };

   const sessionInit = {
      optionalFeatures: [ //(initWithLayers) ? [
      //    "local-floor",
      //    // "bounded-floor",
      //    // "hand-tracking",
      //    "layers"
      // ] :  [
         "local-floor"
      ],
      requiredFeatures: [
         // "webgpu"
      ]
   };

   async function onSessionStarted (session) {
      const useLayers =  initWithLayers && (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype);
      await renderer.xr.setSession(session, useLayers);
      currentSession = session;
      currentSession.addEventListener("end", onSessionEnded);
   }

   function onSessionEnded () {
      currentSession.removeEventListener("end", onSessionEnded);
      currentSession = null;
   }

   function onWindowResize () {

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize( window.innerWidth, window.innerHeight );

   }

   function animate () {

      renderer.setAnimationLoop( render );

   }

   function render () {

      renderer.render( scene, camera );

   }

   async function getXRSession (xr) {

      console.log("xr", `${JSON.stringify(xr)}`);

      let session = null;

      const useLayers =  initWithLayers && (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype);
      try {
         if (!useLayers) {
            session = await (xr.requestSession("immersive-vr", sessionInit));
         } else {
            session = await (xr.requestSession("immersive-ar", sessionInit));
         }
      } catch (e) {
         session = await (xr.requestSession("immersive-vr", sessionInit));
      } finally {

         previewWindow.width = window.innerWidth;
         previewWindow.height = window.innerHeight;

         renderer.setSize(previewWindow.width, previewWindow.height);

         camera.aspect = previewWindow.width / previewWindow.height;
         camera.updateProjectionMatrix();

         return session;
      }
   }


   const xr_button = document.createElement("button");
   xr_button.className = "xr-button";
   xr_button.disabled = true;
   xr_button.innerHTML = "Preparing...";
   xr_button.addEventListener('click', async () => {

      console.log("XR Button clicked");

      const delta = clock.getDelta();
      const time = clock.getElapsedTime();



      // Does xr object exist?
      let nativeWebXRSupport = "xr" in navigator;

      try {

         if (nativeWebXRSupport) nativeWebXRSupport = (
             // Does xr object support sessions?
             await navigator.xr.isSessionSupported( 'immersive-ar' ) ||
             await navigator.xr.isSessionSupported('immersive-vr') ||
             nativeWebXRSupport
         )

      } catch (e) {
         console.log(e.message, navigator);
      }

      // If no XR/VR available, setup Immersive Web Emulation Runtime (iwer) and emulated XR device (@iwer/devui)
      if (!nativeWebXRSupport) {
         const xrDevice = new XRDevice(metaQuest3);
         xrDevice.installRuntime();
         xrDevice.fovy = (75 / 180) * Math.PI;
         xrDevice.ipd = 0;
         window.xrdevice = xrDevice;
         xrDevice.controllers.right.position.set(0.15649, 1.43474, -0.38368);
         xrDevice.controllers.right.quaternion.set(
             0.14766305685043335,
             0.02471366710960865,
             -0.0037767395842820406,
             0.9887216687202454,
         );
         xrDevice.controllers.left.position.set(-0.15649, 1.43474, -0.38368);
         xrDevice.controllers.left.quaternion.set(
             0.14766305685043335,
             0.02471366710960865,
             -0.0037767395842820406,
             0.9887216687202454,
         );
         new DevUI(xrDevice);
      }

      const session = await getXRSession(navigator.xr);

      await onSessionStarted(session);

      // Set camera position
      // camera.position.z = 0;
      camera.position.y = 0;

      player.position.z = camera.position.z;
      player.position.y = camera.position.y;

      const initSceneDataIn = {
         "events": [
            {
               "action": "play_sounds"
            }
         ]
      }

      // updateScene(currentSession, delta, time, initSceneDataIn, null);

      video.play();

      render(renderer);

      // container.style = `display: block; color: #FFF; font-size: 24px; text-align: center; background-color: #000; height: 100vh; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
      xr_button.innerHTML = "Reload";
      xr_button.onclick = function () {
         xr_button.disabled = true;
         window.location.reload();
      };
   });

   function init() {

      const body = document.body,
          container = document.createElement('div');
      container.style = `display: block; background-color: #000; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
      body.appendChild(container);

      console.log(container);

      const canvas= window.document.createElement('canvas');

      canvas.addEventListener("webglcontextlost", (event) => {
         /* The context has been lost but can be restored */
         event.canceled = true;

         console.log("webglcontextlost");
      });

      /* When the GL context is reconnected, reload the resources for the
         current scene. */
      canvas.addEventListener("webglcontextrestored", (event) => {
         // ... loadSceneResources(currentScene);

         console.log("webglcontextrestored");
      });


      // const container = document.getElementById( 'container' );
      container.addEventListener( 'click', function () {

         video.play();

      } );

      clock = new THREE.Clock();

      camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 2000 );
      camera.layers.enable( 1 ); // render left view when no stereo available

      renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio( window.devicePixelRatio );
      renderer.setSize( previewWindow.width, previewWindow.height);
      renderer.xr.enabled = true;
      renderer.xr.setReferenceSpaceType( 'local' );
      container.appendChild( renderer.domElement );

      window.addEventListener( 'resize', onWindowResize, false );

      // video

      const video = document.getElementById( 'video' );
      // video.play();

      const texture = new THREE.Texture( video );

      setInterval( function () {

         if ( video.readyState >= video.HAVE_CURRENT_DATA ) {

            texture.needsUpdate = true;

         }

      }, 1000 / 24 );

      scene = new THREE.Scene();
      // scene.background = new THREE.Color( 0x101010 );

      player = new THREE.Group();
      scene.add(player);

      const controllerModelFactory = new XRControllerModelFactory();
      const controllers = {
         left: null,
         right: null,
      };

      for (let i = 0; i < 2; i++) {
         const raySpace = renderer.xr.getController(i);
         const gripSpace = renderer.xr.getControllerGrip(i);
         const mesh = controllerModelFactory.createControllerModel(gripSpace);

         gripSpace.add(mesh);

         gripSpace.addEventListener('connected', (e) => {

            raySpace.visible = true;
            gripSpace.visible = true;
            const handedness = e.data.handedness;
            controllers[handedness] = {
               gamepad: new GamepadWrapper(e.data.gamepad),
               raySpace,
               gripSpace,
               mesh
            };
         });

         gripSpace.addEventListener('disconnected', (e) => {
            raySpace.visible = false;
            gripSpace.visible = false;
            const handedness = e.data.handedness;
            controllers[handedness] = null;
         });

         player.add(raySpace, gripSpace);
         // raySpace.visible = false;
         // gripSpace.visible = false;
      }

      // left

      // const geometry1 = new SphereGeometry( 500, 60, 40 );
      const geometry1 = new PlaneGeometry( 5, videoHeight / videoWidth * 5, 60, 40 );
      // invert the geometry on the x-axis so that all of the faces point inward
      // geometry1.scale( - 1, 1, 1 );
      geometry1.translate(videoReducer, 0, -5)

      const uvs1 = geometry1.attributes.uv.array;

      for ( let i = 0; i < uvs1.length; i += 2 ) {

         uvs1[ i ] *= 0.5;

      }

      const material1 = new THREE.MeshBasicMaterial( { map: texture } );

      const mesh1 = new THREE.Mesh( geometry1, material1 );
      // mesh1.rotation.y = - Math.PI / 2;
      mesh1.layers.set( 1 ); // display in left eye only
      scene.add( mesh1 );

      // right

      // const geometry2 = new SphereGeometry( 500, 60, 40 );
      const geometry2 = new PlaneGeometry( 5, videoHeight / videoWidth * 5, 60, 40 );
      // geometry2.scale( - 1, 1, 1 );
      geometry2.translate(-videoReducer, 0, -5)

      const uvs2 = geometry2.attributes.uv.array;

      for ( let i = 0; i < uvs2.length; i += 2 ) {

         uvs2[ i ] += 0.5;

      }

      const material2 = new THREE.MeshBasicMaterial( { map: texture } );

      const mesh2 = new THREE.Mesh( geometry2, material2 );
      // mesh2.rotation.y = - Math.PI / 2;
      mesh2.layers.set( 2 ); // display in right eye only
      scene.add( mesh2 );

      // document.body.appendChild( VRButton.createButton( renderer ) );
      // document.body.appendChild( XRButton.createButton( renderer ) );
      document.body.appendChild(xr_button);

      xr_button.innerHTML = "Enter XR";
      xr_button.style.opacity = 0.75;
      xr_button.disabled = false;
      delete xr_button.disabled;

   }

   init();
   animate();

}, 533);
