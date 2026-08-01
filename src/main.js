import * as THREE from 'three';

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory";

import { HTMLMesh } from "three/addons/interactive/HTMLMesh";
import Stats from "three/addons/libs/stats.module";

import loadManager from "./setup/setupLoadManager";
import setupScene from "./setup/setupScene";
import setupPortalClippingPlanes from "./setup/setupPortalClippingPlanes";
import setupVideoLayerManager from "./setup/setupVideoLayerManager";
import setupGridEnvironment from "./setup/setupGridEnvironment";
import createSubtitlePanel from "./ui/SubtitlePanel";
import { checkControllerAction } from "./controllers";
import {
    getViewerMidpoint,
    updateStationaryGroup,
    updateVideoQuadLayerPosition,
    isStationaryGridEnabled
} from "./xr/stationaryView";
import { World } from "./ecs/World";
import { GridTransform } from "./ecs/components/GridTransform";
import { VideoLayerTransform } from "./ecs/components/VideoLayerTransform";
import { GridMovementSystem } from "./ecs/systems/GridMovementSystem";
import { VideoLayerMovementSystem } from "./ecs/systems/VideoLayerMovementSystem";

let currentSession = null;
let initXRLayers = true;
let waiting_for_confirmation = false;

/** Persisted across animation frames (must not be redeclared inside render). */
let xrLayerQuadVideo = null;

setTimeout(function init () {

    console.log("Initiate WebXR Layers scene (passthrough-first: immersive-ar + optional layers).");

    let camera, controls, renderer, player, video, videoLayerManager, subtitlePanel;

    const body = document.body;

    const container = document.createElement('div');

    body.appendChild(container);

    const clock = new THREE.Clock();

    const canvas = window.document.createElement('canvas');

    const previewWindow = {
        width: window.innerWidth, // / 2, // 640,
        height: window.innerHeight + 10, // 480,
    };
    container.style = `display: block; background-color: #000; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;

    // alpha: true + transparent clear so immersive-ar passthrough shows behind the scene
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( previewWindow.width, previewWindow.height);
    renderer.setClearColor( 0x000000, 0 );
    // renderer.setSize( previewWindow.innerWidth, previewWindow.innerHeight );
    // These are deprecated but still work
    // renderer.outputEncoding = THREE.sRGBEncoding;
    // renderer.outputEncoding = THREE.LinearEncoding;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    // Align with XRQuadLayer space (local-floor) for consistent viewer midpoint V
    renderer.xr.setReferenceSpaceType('local-floor');

    container.appendChild( renderer.domElement );

    camera = new THREE.PerspectiveCamera( 70, previewWindow.width / previewWindow.height, 1, 2000 );
    camera.layers.enable( 1 ); // render left view when no stereo available
    camera.position.set(0.0, 0.0, 0.0);

    window.addEventListener('resize', function () {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );

    }, false);

    controls = new OrbitControls(camera, container);
    controls.target.set(0, 0.0, -0.5);
    // controls.update();

    player = new THREE.Group();

    const scene = new THREE.Scene();
    /** Grid + WebGL stereo video only; position = viewer translation V each frame when stationary mode is on. */
    const stationaryContent = new THREE.Group();
    stationaryContent.edit = true;
    scene.add(stationaryContent);

    const stationaryGridEnabled = isStationaryGridEnabled();

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
            // const handedness = e.data.handedness;
            // controllers[handedness] = null;
            for (const h in controllers) {
                if (controllers[h] !== null) controllers[h] = null;
            }
        });

        player.add(raySpace, gripSpace);
        // raySpace.visible = false;
        // gripSpace.visible = false;
    }

    // Setup Stats
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.maxWidth = "64px";
    stats.dom.style.minWidth = "60px";
    stats.dom.style.backgroundColor = "black";
    document.body.appendChild(stats.dom);

    const statsMesh = new HTMLMesh( stats.dom );
    // statsMesh.position.x = -1.5;
    // statsMesh.position.y = 0.5;
    // statsMesh.position.z = -2.0;
    statsMesh.position.set(-1.5, 0.5, -2.0);
    /** Restored on XR session end; 2D / first paint keeps the authored position above. */
    const statsMeshPosition2D = statsMesh.position.clone();
    /** Added to `statsMesh.position.y` only while immersive (Enter XR). Tune on headset. */
    const STATS_MESH_Y_OFFSET_IMMERSIVE = 1.5;

    statsMesh.rotation.y = Math.PI / 4;
    statsMesh.scale.setScalar(4);
    statsMesh.material.colorWrite = true;
    statsMesh.material.transparent = false;

    // video

    const videoWidth = 2064;
    const videoHeight = 2208;
    const videoReducer = 0.090579710;

    video = document.getElementById( 'video' );
    // document.body.appendChild(video);
    // video.loop = true;
    // video.src = 'assets/videos/Lake_Champlain.webm';
    // video.src = 'assets/videos/Lake_Champlain.mp4';
    // video.width = previewWindow.width;
    // video.height = previewWindow.height;
    // video.play();

    container.addEventListener( 'click', function () {
        video.play();
    });

    // 6th arg `videoCenterY`: WebGL stereo mesh vertical offset (see 4efab14 "Vertically recenter video mesh layer").
    // XRQuadLayer Y uses VIDEO_QUAD_LAYER_Y_OFFSET_METERS in setupVideoLayerManager (separate from mesh).
    videoLayerManager = setupVideoLayerManager(video, 2064, 2208, 0.090579710);

    container.append(loadManager.div);

    async function setupEnvironment (renderer, scene, videoLayerManager) {

        scene.add(player);

        scene.add(statsMesh);

        currentSession = null;

        videoLayerManager.initVideoLayer(false, renderer, scene, currentSession, null, stationaryContent);

        // Grid environment: dark void with cyan Euclidean grid (under stationaryContent with video mesh)
        const gridResult = setupGridEnvironment(scene, stationaryContent);

        // ECS world for persistent spatial state — lightweight, no framework migration needed
        const world = new World();

        const gridEntity = world.createEntity('stationaryGrid');
        world.addComponent(gridEntity, GridTransform.type, GridTransform.create({
            ...gridResult.initialState,
            // maxOffset: 10.0
        }));
        world.registerSystem(new GridMovementSystem(controllers, stationaryContent));

        const videoEntity = world.createEntity('videoLayer');
        world.addComponent(videoEntity, VideoLayerTransform.type, VideoLayerTransform.create());
        world.registerSystem(new VideoLayerMovementSystem(controllers, stationaryContent));

        const updateScene = await setupScene(scene, camera, controllers, player, stationaryContent, videoLayerManager);

        // Subtitle panel: head-locked with smooth-follow physics
        subtitlePanel = createSubtitlePanel("Welcome...");
        subtitlePanel.initSubtitleLayer(scene);

        renderer.setAnimationLoop(function render (t, frame ) {

            const data = [];
            const delta = clock.getDelta();
            const time = clock.getElapsedTime();

            const xr = renderer.xr;
            const gl = renderer.getContext();

            // Three.js r170+ automatically inherits and enforces layer masks from the 
            // main camera to the XR cameras, and there's no way to override it after the 
            // fact because it happens in the WebXRManager's internal update cycle.
            // Change the main camera's layers based on whether an immersive session is active
            if (!xr.isPresenting) {
                // Desktop / pre-XR: enable layer 1 for 2D stereo video preview
                camera.layers.mask = 3; // 0b011 = layers 0 and 1
            } else {
                // immersive-ar / immersive-vr: layer 0 only on main camera; per-eye layers handled by WebXRManager
                camera.layers.mask = 1; // 0b001 = layer 0 only
            }

            // ... instead of trying to fix the XR cameras directly, which get overwritten (i.e., like so...)
            if (currentSession && xr.isPresenting) {
    
                const xrCamera = xr.getCamera(camera); // gets XR camera array
    
                if (xrCamera.cameras.length > 1) {
    
                    /*!
                     * The mask property is a number where each bit represents whether that layer is enabled:
                     * camera.layers.mask = 1;  // Only layer 0 enabled (binary: 0001)
                     * camera.layers.mask = 2;  // Only layer 1 enabled (binary: 0010)
                     * camera.layers.mask = 3;  // Layers 0 and 1 enabled (binary: 0011)
                     * camera.layers.mask = 5;  // Layers 0 and 2 enabled (binary: 0101)
                     * camera.layers.mask = 7;  // Layers 0, 1, and 2 enabled (binary: 0111)
                     */
    
                    // Left eye: only layer 1
                    xrCamera.cameras[0].layers.mask = 3;  // 0b0011 = layers 0 and 1
    
                    // Right eye: only layer 2
                    xrCamera.cameras[1].layers.mask = 5;  // 0b0101 = layers 0 and 2
                }
    
                // console.log("cameras:", [
                //     ...xrCamera.cameras
                // ]);
            }
            // This is actually a pretty significant API change that wasn't well-documented in the migration guide. 
            // The old pattern (manually configuring XR camera layers) was replaced with an automatic inheritance system.
            

            waiting_for_confirmation = checkControllerAction(controllers, data, currentSession, waiting_for_confirmation);

            if (Array.isArray(data) && data.length > 0) {
                for (const event of data) {
                    if (event.action === "toggle_grid") {
                        const gt = world.getComponent('stationaryGrid', 'GridTransform');
                        if (gt) {
                            gt.showGrid = !gt.showGrid;
                            stationaryContent.edit = gt.showGrid;
                        }
                    }
                }
            }

            world.update(delta);
            const gridTransform = world.getComponent('stationaryGrid', 'GridTransform');
            const videoTransform = world.getComponent('videoLayer', 'VideoLayerTransform');
            const gridOffset = gridTransform?.offset || null;
            const videoOffset = videoTransform?.offset || null;

            const stationaryActive = stationaryGridEnabled && xr.isPresenting && currentSession !== null;
            const viewerMid = getViewerMidpoint(renderer, frame);
            updateStationaryGroup(stationaryContent, viewerMid, stationaryActive, gridOffset);

            // Apply independent video offset to WebGL stereo mesh
            if (videoOffset && videoLayerManager.webGLVideo) {
                videoLayerManager.webGLVideo.position.copy(videoOffset);
            }

            if (stationaryActive && xrLayerQuadVideo !== null && viewerMid) {

                updateVideoQuadLayerPosition(
                    xrLayerQuadVideo,
                    videoLayerManager.videoQuadLayerBasePosition,
                    viewerMid,
                    videoOffset
                );

            }

            stats.begin();

            // const clippingPlanes  = setupPortalClippingPlanes(renderer, camera);

            if (
                currentSession !== null
                && currentSession.renderState.layers !== undefined
                && currentSession.hasMediaLayer === undefined
                && initXRLayers && (
                    typeof XRWebGLBinding !== 'undefined'
                    && 'createProjectionLayer' in XRWebGLBinding.prototype
                )
            ) {

                console.log("Initialize media layer on currentSession:", currentSession);

                currentSession.hasMediaLayer = true;

                console.log("Make gl context XR compatible: ", gl.makeXRCompatible);

                gl.makeXRCompatible().then(() => {

                    return currentSession.requestReferenceSpace('local-floor').then((refSpace) => {

                     xrLayerQuadVideo = videoLayerManager.initVideoLayer(true, renderer, scene, currentSession, refSpace);

                     videoLayerManager.videoLayerInitialized = true;

                     const existing = currentSession.renderState.layers;
                     const baseProjection = existing && existing.length > 0 ? existing[0] : null;

                     currentSession.updateRenderState({
                        layers: baseProjection ? [
                            xrLayerQuadVideo,
                            baseProjection
                        ] : [
                            xrLayerQuadVideo
                        ]
                     });

                  });
               }).catch((err) => {
                    console.error("WebXR layer stack setup failed:", err);
                    if (currentSession) delete currentSession.hasMediaLayer;
                    xrLayerQuadVideo = null;
               });

            }

            // if (currentSession !== null) renderer.clippingPlanes =  [
            //     ...clippingPlanes
            // ];

            updateScene(
                currentSession,
                delta,
                time,
                data.length > 0 ? data : null,
                null
                //, [
                //     ...clippingPlanes
                // ]
            );

            // Update subtitle panel smooth-follow position
            // In XR mode, use the XR camera for accurate head tracking
            const activeCamera = (currentSession && xr.isPresenting)
                ? xr.getCamera(camera)
                : camera;
            subtitlePanel.update(activeCamera);

            renderer.render(scene, camera);

            stats.end();

            statsMesh.material.map.update();
            // if (!!guiLayer) guiLayer.needsUpdate = true;
        });

        return renderer;
    }

    /**
     * Passthrough-first: only immersive-ar (no silent fallback to immersive-vr).
     * 1) immersive-ar + layers + local-floor
     * 2) immersive-ar + local-floor (layers not granted by UA)
     * Throws if immersive-ar cannot be created.
     */
    async function getXRSession (xr) {

        console.log("xr", `${JSON.stringify(xr)}`);

        let session = null;

        const wantLayers = initXRLayers && (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype);
        try {
            if (wantLayers) {
                try {
                    session = await xr.requestSession("immersive-ar", {
                        optionalFeatures: [
                            "layers",
                            "local-floor"
                        ]
                    });
                } catch (e1) {
                    console.warn("[WebXR] immersive-ar + layers not available; trying AR without layers:", e1);
                    session = await xr.requestSession("immersive-ar", {
                        optionalFeatures: [
                            "local-floor"
                        ]
                    });
                }
            } else {
                session = await xr.requestSession("immersive-ar", {
                    optionalFeatures: [
                        "local-floor"
                    ]
                });
            }
        } catch (e) {
            console.error("[WebXR] immersive-ar is not available:", e);
            throw new Error(
                "immersive-ar (passthrough) is not available. Use a WebXR AR-capable headset and browser (e.g. Meta Quest Browser)."
            );
        }

        previewWindow.width = window.innerWidth;
        previewWindow.height = window.innerHeight;

        renderer.setSize(previewWindow.width, previewWindow.height);

        camera.aspect = previewWindow.width / previewWindow.height;
        camera.updateProjectionMatrix();

        session.requestReferenceSpace("local").then((xrReferenceSpace) => {
            session.requestAnimationFrame((time, xrFrame) => {
                const viewer = xrFrame.getViewerPose(xrReferenceSpace);

                const tick = time % 3333;

                if (tick < 1) try {
                    for (const xrView of viewer.views) {
                        const xrViewport = XRWebGLLayer.getViewport(xrView);
                        console.log({
                            xrReferenceSpace,
                            xrView,
                            xrViewport
                        });
                    }
                } catch (e) {
                    console.log({
                        error: e
                    });
                }
            });
        });

        return session;
    }

    async function onSessionStarted (session, config) {
        try {
            await renderer.xr.setSession(session, config.useXRLayers);
        } catch (e) {
            console.log("Error:", e);
        }
        currentSession = session;
        currentSession["config"] = config;
        currentSession.addEventListener("end", onSessionEnded);

        if (!!config && config.useXRLayers && !!config.videoLayerManager) { // && config.videoLayerManager.videoLayerInitialized) {
            // Transition to WebXRLayer
            config.videoLayerManager.clearVideoLayer(!config.useXRLayers, renderer, scene, session);
            // config.videoLayerManager.initVideoLayer(config.useXRLayers, renderer, scene, session);
            // config.videoLayerManager.videoLayerInitialized = true;
        }

        console.log("Init video layer:", config.videoLayerManager.videoLayerInitialized, "useXRLayers:", config.useXRLayers);

        if (renderer.xr.isPresenting) {

            statsMesh.position.copy(statsMeshPosition2D);
            statsMesh.position.y += STATS_MESH_Y_OFFSET_IMMERSIVE;

        }

        video.play();
    }

    function onSessionEnded (session) {

        const config = currentSession["config"];

        console.log("Ended WebXR session!", session, config);

        xrLayerQuadVideo = null;

        currentSession.removeEventListener("end", onSessionEnded);
        currentSession = null;

        statsMesh.position.copy(statsMeshPosition2D);

        if (videoLayerManager.videoLayerInitialized && !!config.videoLayerManager) {
            // Transition to WebGLLayer
            console.log("Clear video layer");
            config.videoLayerManager.clearVideoLayer(true, renderer, scene, session);
            console.log("Init video layer");
            config.videoLayerManager.initVideoLayer(false, renderer, scene, session, null, stationaryContent);
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

        let session;
        try {
            session = await getXRSession(navigator.xr);
        } catch (err) {
            console.error(err);
            alert(err.message || String(err));
            return;
        }

        console.log("[WebXR] session.mode:", session.mode, "enabledFeatures:", session.enabledFeatures);

        const layersFeatureGranted = session.enabledFeatures?.includes("layers") ?? false;
        const useXRLayers = initXRLayers
            && layersFeatureGranted
            && (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype);

        await onSessionStarted(session, { useXRLayers, videoLayerManager });

        // Set camera position
        camera.position.y = 0;
        // camera.position.z = 0;

        player.position.y = camera.position.y;
        player.position.z = camera.position.z;

        // container.style = `display: block; color: #FFF; font-size: 24px; text-align: center; background-color: #000; height: 100vh; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
        xr_button.innerHTML = "Reload";
        xr_button.onclick = function () {
            xr_button.disabled = true;
            window.location.reload();
        };
    });

    document.body.appendChild(xr_button);

    xr_button.innerHTML = "Enter XR";
    xr_button.style.opacity = 0.75;
    xr_button.disabled = false;
    delete xr_button.disabled;

    canvas.addEventListener("webglcontextlost", (event) => {
        /* The context has been lost but can be restored */
        event.canceled = true;

        console.log("webglcontextlost");
    });

    /* When the GL context is reconnected, reload the resources for the
       current scene. */
    canvas.addEventListener("webglcontextrestored", (event) => {
        // ... loadSceneResources(currentScene);
        setupEnvironment(renderer, scene, videoLayerManager);

        console.log("webglcontextrestored");
    });

    setupEnvironment(renderer, scene, videoLayerManager)
        .then((renderer) => {
            console.log("WebXR has been initialized with renderer: ", renderer);
        });

}, 533);
