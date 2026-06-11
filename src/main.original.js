import * as THREE from 'three';

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper } from 'gamepad-wrapper';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory";

import { HTMLMesh } from "three/addons/interactive/HTMLMesh";
import Stats from "three/addons/libs/stats.module";

let currentSession = null;

setTimeout(function init () {

   console.log("Initiate WebXR Layers scene!");

   let camera,
       renderer,
       scene,
       quadLayerPlain,
       quadLayerMips,
       guiLayer,
       quadLayerVideo,
       video;

   const previewWindow = {
      width: window.innerWidth, // / 2, // 640,
      height: window.innerHeight + 10, // 480,
   };

   camera = new THREE.PerspectiveCamera( 50, previewWindow.innerWidth / previewWindow.innerHeight, 0.1, 10 );
   camera.position.set( 0, 1.6, 3 );

   scene = new THREE.Scene();

   const clock = new THREE.Clock();

   const player = new THREE.Group();
   scene.add(player);

   const hemLight = new THREE.HemisphereLight( 0x808080, 0x606060 );
   const light = new THREE.DirectionalLight( 0xffffff );
   scene.add( hemLight, light );

   // const body = document.body,
   //     container = document.createElement('div');
   // container.style = `display: block; background-color: #000; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
   // body.appendChild(container);
   //
   // console.log(container);

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

   renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
   renderer.setPixelRatio( window.devicePixelRatio );
   renderer.setClearAlpha( 1 );
   renderer.setClearColor( new THREE.Color( 0 ), 0 );
   renderer.setSize( previewWindow.innerWidth, previewWindow.innerHeight );
   renderer.outputEncoding = THREE.sRGBEncoding;
   renderer.xr.enabled = true;

   renderer.setPixelRatio( window.devicePixelRatio );
   renderer.setClearAlpha( 1 );
   renderer.setClearColor( new THREE.Color( 0 ), 0 );
   renderer.setSize( previewWindow.innerWidth, previewWindow.innerHeight );
   renderer.outputEncoding = THREE.sRGBEncoding;
   renderer.xr.enabled = true;

   renderer.domElement.style.position = "fixed";
   renderer.domElement.style.top = 0;

   function onWindowResize() {

      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize( window.innerWidth, window.innerHeight );

   }

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

   // Setup Stats
   const stats = new Stats();
   stats.showPanel(0);
   stats.dom.style.maxWidth = "100px";
   stats.dom.style.minWidth = "100px";
   stats.dom.style.backgroundColor = "black";
   document.body.appendChild(stats.dom);

   const statsMesh = new HTMLMesh( stats.dom );
   // statsMesh.position.x = -1.5;
   // statsMesh.position.y = 2;
   // statsMesh.position.z = -1;
   statsMesh.position.set(-1.0, 1.5, -1.0);
   statsMesh.rotation.y = Math.PI / 4;
   // statsMesh.scale.setScalar(8);
   statsMesh.scale.setScalar(2);
   statsMesh.material.colorWrite = false;
   statsMesh.material.transparent = false;

   scene.add(statsMesh);

   video = //document.createElement( 'video' );
       document.getElementById("video");
   // video.loop = true;
   // video.src = 'assets/videos/Lake_Champlain.webm';
   // // video.src = 'assets/videos/Lake_Champlain.mp4';

   // video.width = previewWindow.width;
   // video.height = previewWindow.height;
   // document.body.appendChild(video);

   function render (t, frame ) {

      const xr = renderer.xr;
      const gl = renderer.getContext();

      Object.values(controllers).forEach((controller) => {
         if (controller?.gamepad) {
            controller.gamepad.update();
         }
      });

      stats.begin();

      if (
          currentSession !== null
          && currentSession.renderState.layers !== undefined
          && currentSession.hasMediaLayer === undefined
          // && video.readyState >= 2
      ) {

         currentSession.hasMediaLayer = true;

         console.log("Set media layer to true on currentSession:", currentSession);

         console.log("Make gl context XR compatible: ", gl.makeXRCompatible);

         gl.makeXRCompatible().then(() => {

            const glBinding = xr.getBinding(); // returns XRWebGLBinding

            currentSession.requestReferenceSpace('local-floor').then((refSpace) => {

               // // Create Quad layers for Snellen chart.
               // const quadLayerConfig = {
               //    width: snellenConfig.quadWidth,
               //    height: snellenConfig.quadHeight,
               //    viewPixelWidth: snellenConfig.textureSizePx,
               //    viewPixelHeight: snellenConfig.textureSizePx,
               //    isStatic: true,
               //    space: refSpace,
               //    layout: 'mono',
               //    transform: new XRRigidTransform( {
               //       x: snellenConfig.x - snellenConfig.widthMeters,
               //       y: snellenConfig.y + snellenConfig.heightMeters,
               //       z: snellenConfig.z
               //    } )
               // };
               //
               // quadLayerPlain = glBinding.createQuadLayer( quadLayerConfig );
               //
               // quadLayerConfig.mipLevels = 3;
               // quadLayerConfig.transform = new XRRigidTransform({
               //    x: snellenConfig.x + snellenConfig.widthMeters,
               //    y: snellenConfig.y + snellenConfig.heightMeters,
               //    z: snellenConfig.z
               // });
               // quadLayerMips = glBinding.createQuadLayer( quadLayerConfig );

               // Create GUI layer.
               guiLayer = glBinding.createQuadLayer({
                  width: statsMesh.geometry.parameters.width,
                  height: statsMesh.geometry.parameters.height,
                  viewPixelWidth: statsMesh.material.map.image.width,
                  viewPixelHeight: statsMesh.material.map.image.height,
                  space: refSpace,
                  transform: new XRRigidTransform(statsMesh.position, statsMesh.quaternion)
               });

               let videoAngle = 96; // 110;
               let videoLayout = "stereo-left-right";
               let eqrtRadius = 10;
               const videoWidth = 2064;
               const videoHeight = 2208;
               const videoReducer = 0.00090579710;

               // Create background EQR video layer.
               const mediaBinding = new XRMediaBinding(currentSession);

               console.log("Create XREquirectLayer with XRMediaBinding");
               const equirectLayer = mediaBinding.createEquirectLayer(
                   video,
                   {
                      // layout: 'stereo-left-right',
                      layout: videoLayout,
                      viewPixelWidth: videoWidth / (videoLayout === "stereo-left-right" ? 2 : 1),
                      viewPixelHeight: videoHeight / (videoLayout === "stereo-top-bottom" ? 2 : 1),
                      space: refSpace,
                      // // Rotate by 45 deg to avoid stereo conflict with the 3D geometry.
                      // transform: new XRRigidTransform(
                      //   {},
                      //   { x: 0, y: .28, z: 0, w: .96 }
                      // )
                      transform: new XRRigidTransform(
                          {x: 0, y: -5, z: -10},
                          // { x: -0.28, y: 0, z: 0, w: .96 }
                      )
                   }
               );

               console.log("Create XRQuadLayer with XRMediaBinding");
               quadLayerVideo = mediaBinding.createQuadLayer(
                   video,
                   {
                      layout: 'stereo-left-right',
                      // layout: videoLayout,
                      // width: 3.73913,
                      width: videoWidth * videoReducer * 2,
                      // height: 4.0,
                      height: videoHeight * videoReducer * 2,
                      space: refSpace,
                      // // Rotate by 45 deg to avoid stereo conflict with the 3D geometry.
                      // transform: new XRRigidTransform(
                      //   {},
                      //   { x: 0, y: .28, z: 0, w: .96 }
                      // )
                      transform: new XRRigidTransform(
                          {x: 0, y: (videoHeight * videoReducer) / 2, z: -5},
                          {},
                          // { x: -0.28, y: 0, z: 0, w: .96 },
                          {}
                      )
                   }
               );

               equirectLayer.centralHorizontalAngle = Math.PI * videoAngle / 180;
               equirectLayer.upperVerticalAngle = (Math.PI * videoAngle / 180) * 0.5; // Math.PI / 2.0 * 0.5;
               equirectLayer.lowerVerticalAngle = -(Math.PI * videoAngle / 180) * 0.5; // -Math.PI / 2.0 * 0.5;
               equirectLayer.radius = eqrtRadius;

               currentSession.updateRenderState({
                  layers: (!!currentSession.renderState.layers.length > 0) ? [
                     currentSession.renderState.layers[0],
                     // equirectLayer,
                     quadLayerVideo,
                     // quadLayerPlain,
                     // quadLayerMips,
                     guiLayer
                  ] : [
                     // equirectLayer,
                     quadLayerVideo,
                     guiLayer
                  ]
               });

            })
         });

      }

      // // Copy image to layers as required.
      // // needsRedraw is set on creation or if the underlying GL resources of a layer are lost.
      // if ( session && quadLayerPlain && quadLayerPlain.needsRedraw ) {
      //
      //    const glayer = xr.getBinding().getSubImage( quadLayerPlain, frame );
      //    renderer.state.bindTexture( gl.TEXTURE_2D, glayer.colorTexture );
      //    gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
      //    gl.texSubImage2D( gl.TEXTURE_2D, 0,
      //        ( snellenConfig.textureSizePx - snellenConfig.widthPx ) / 2,
      //        ( snellenConfig.textureSizePx - snellenConfig.heightPx ) / 2,
      //        snellenConfig.widthPx, snellenConfig.heightPx,
      //        gl.RGBA, gl.UNSIGNED_BYTE, snellenTexture.image );
      //
      // }
      //
      // // Same as above but also gl.generateMipmap.
      // if ( session && quadLayerMips && quadLayerMips.needsRedraw ) {
      //
      //    const glayer = xr.getBinding().getSubImage( quadLayerMips, frame );
      //    renderer.state.bindTexture( gl.TEXTURE_2D, glayer.colorTexture );
      //    gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, true );
      //    gl.texSubImage2D( gl.TEXTURE_2D, 0,
      //        ( snellenConfig.textureSizePx - snellenConfig.widthPx ) / 2,
      //        ( snellenConfig.textureSizePx - snellenConfig.heightPx ) / 2,
      //        snellenConfig.widthPx, snellenConfig.heightPx,
      //        gl.RGBA, gl.UNSIGNED_BYTE, snellenTexture.image );
      //    gl.generateMipmap( gl.TEXTURE_2D );
      //
      // }

      if (currentSession !== null && !!guiLayer && (guiLayer.needsRedraw || guiLayer.needsUpdate)) {

         const glayer = xr.getBinding().getSubImage(guiLayer, frame);
         renderer.state.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
         gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
         const canvas = statsMesh.material.map.image;
         gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
         guiLayer.needsUpdate = false;

      }

      renderer.render(scene, camera);

      stats.end();

      statsMesh.material.map.update();
      if (!!guiLayer) guiLayer.needsUpdate = true;

   }

   const sessionInit = {
      optionalFeatures: [
         "local-floor",
         // "bounded-floor",
         // "hand-tracking",
         "layers"
      ],
      requiredFeatures: [
         // "webgpu"
      ]
   };

   function animate () {

      renderer.setAnimationLoop( render );

   }

   async function getXRSession (xr) {

      console.log("xr", `${JSON.stringify(xr)}`);

      let session = null;

      try {
         session = await (xr.requestSession("immersive-ar", sessionInit));
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

   async function onSessionStarted(session) {
      await renderer.xr.setSession(session);
      currentSession = session;
      currentSession.addEventListener("end", onSessionEnded);
   }

   function onSessionEnded() {
      currentSession.removeEventListener("end", onSessionEnded);
      currentSession = null;
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

   document.body.appendChild(renderer.domElement );
   document.body.appendChild(xr_button);

   window.addEventListener( 'resize', onWindowResize, false );

   animate();

   xr_button.innerHTML = "Enter XR";
   xr_button.style.opacity = 0.75;
   xr_button.disabled = false;
   delete xr_button.disabled;

}, 533);
