import * as THREE from "three";

import { XRDevice, metaQuest3 } from 'iwer';
import { DevUI } from '@iwer/devui';
import { GamepadWrapper, XR_BUTTONS } from 'gamepad-wrapper';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment';
import { XRControllerModelFactory } from "three/addons/webxr/XRControllerModelFactory";

import { HTMLMesh } from "three/addons/interactive/HTMLMesh";
import Stats from "three/addons/libs/stats.module";

import setupScene from "./setup/setupScene";
import setupVideoLayerManager from "./setup/setupVideoLayerManager";
import { checkControllerAction } from "./controllers";

let currentSession = null;
let initXRLayers = true;
let waiting_for_confirmation = false;

async function initRenderer (setupScene = (scene, camera, controllers, player, videoManager) => {}) {

    const clock = new THREE.Clock();
    const scene = new THREE.Scene();
    const controllerModelFactory = new XRControllerModelFactory();
    const controllers = {
        left: null,
        right: null,
    };

    const previewWindow = {
        width: window.innerWidth, // / 2, // 640,
        height: window.innerHeight + 10, // 480,
    };

    const body = document.body,
        container = document.createElement('div');
    container.style = `display: block; background-color: #000; max-width: ${previewWindow.width}px; max-height: ${previewWindow.height}px; overflow: hidden;`;
    body.appendChild(container);

    console.log(container);

    // Setup Stats
    const stats = new Stats();
    stats.showPanel(0);
    stats.dom.style.maxWidth = "100px";
    stats.dom.style.minWidth = "100px";
    stats.dom.style.backgroundColor = "black";
    document.body.appendChild(stats.dom);

    const statsMesh = new HTMLMesh( stats.dom );
    statsMesh.position.x = -2;
    statsMesh.position.y = 2;
    statsMesh.position.z = -2;
    statsMesh.rotation.y = Math.PI / 4;
    statsMesh.scale.setScalar(8);

    scene.add(statsMesh);

    const canvas= window.document.createElement('canvas');

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(previewWindow.width, previewWindow.height);
    renderer.xr.enabled = true;

    console.log(renderer.domElement);

    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
        50,
        previewWindow.width / previewWindow.height,
        0.1,
        100,
    );
    camera.layers.enable( 1 ); // render left view when no stereo available
    camera.position.set(0, 1.6, 3);

    const controls = new OrbitControls(camera, container);
    controls.target.set(0, 1.6, 0);
    controls.update();

    function onWindowResize() {

        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        renderer.setSize( window.innerWidth, window.innerHeight );
    }

    window.addEventListener('resize', onWindowResize);

    const environment = new RoomEnvironment(renderer);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(environment).texture;

    const player = new THREE.Group();
    // player.position.y = camera.position.y;
    player.position.z = camera.position.z;

    scene.add(player);

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
                mesh,
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

    const video = document.getElementById( 'video' );
    // document.body.appendChild(video);
    // video.loop = true;
    // video.src = 'assets/videos/Lake_Champlain.webm';
    // video.src = 'assets/videos/Lake_Champlain.mp4';
    // video.width = previewWindow.width;
    // video.height = previewWindow.height;
    // video.play();

    const videoLayerManager = setupVideoLayerManager(video, 2064, 2208, 0.090579710, 0.0, -1.0);

    videoLayerManager.initVideoLayer(false, renderer, scene, currentSession);

    console.log("Init video layer: ", videoLayerManager.videoLayerInitialized);

    const updateScene = await setupScene(scene, camera, controllers, player, videoLayerManager);

    renderer.setAnimationLoop(function render (t, frame ) {

        const data = {};
        const delta = clock.getDelta();
        const time = clock.getElapsedTime();

        const xr = renderer.xr;
        const gl = renderer.getContext();

        if (!renderer.xr.isPresenting) {
            // Non-VR mode: enable layer 1 for 2D viewing
            camera.layers.mask = 3; // 0b011 = layers 0 and 1
        } else {
            // VR mode: only enable layer 0 (default)
            // Let WebXRManager add layer 1 and 2 automatically per eye
            camera.layers.mask = 1; // 0b001 = layer 0 only
        }

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

        waiting_for_confirmation = checkControllerAction(controllers, data, currentSession, waiting_for_confirmation);

        stats.begin();

        let guiLayer,
            equirectLayer,
            quadLayerPlain,
            quadLayerMips,
            quadLayerVideo;

        if (
            currentSession !== null
            && currentSession.renderState.layers !== undefined
            && currentSession.hasMediaLayer === undefined
            && initXRLayers && (
                typeof XRWebGLBinding !== 'undefined'
                && 'createProjectionLayer' in XRWebGLBinding.prototype
            )
        ) {

            console.log("Set media layer to true on currentSession:", currentSession);

            currentSession.hasMediaLayer = true;

            console.log("Make gl context XR compatible: ", gl.makeXRCompatible);

            gl.makeXRCompatible().then(() => {

                const glBinding = xr.getBinding(); // returns XRWebGLBinding

                currentSession.requestReferenceSpace('local-floor').then((refSpace) => {

                    // Create GUI layer.
                    guiLayer = glBinding.createQuadLayer({
                        width: statsMesh.geometry.parameters.width,
                        height: statsMesh.geometry.parameters.height,
                        viewPixelWidth: statsMesh.material.map.image.width,
                        viewPixelHeight: statsMesh.material.map.image.height,
                        space: refSpace,
                        transform: new XRRigidTransform(statsMesh.position, statsMesh.quaternion)
                    });

                    quadLayerVideo = videoLayerManager.initVideoLayer(true, renderer, scene, currentSession, refSpace);

                    console.log("Init video layer: ", videoLayerManager.videoLayerInitialized)

                    currentSession.updateRenderState({
                        layers: (!!currentSession.renderState.layers.length > 0) ? [
                            quadLayerVideo,
                            // equirectLayerVideo,
                            guiLayer,
                            currentSession.renderState.layers[0]
                        ] : [
                            quadLayerVideo,
                            // equirectLayerVideo,
                            guiLayer
                        ]
                    });

                });
            });

        }

        if (currentSession !== null && !!guiLayer && (guiLayer.needsRedraw || guiLayer.needsUpdate)) {

            const glayer = xr.getBinding().getSubImage(guiLayer, frame);
            renderer.state.bindTexture(gl.TEXTURE_2D, glayer.colorTexture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            const canvas = statsMesh.material.map.image;
            gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
            guiLayer.needsUpdate = false;

        }
        
        updateScene(currentSession, delta, time, (data.hasOwnProperty("action")) ? data : null);

        renderer.render(scene, camera);

        stats.end();

        statsMesh.material.map.update();
    });

    const sessionInit = {
        optionalFeatures: [
            "local-floor",
            "bounded-floor",
            // "hand-tracking",
            "layers"
        ],
        requiredFeatures: [
            // "webgpu"
        ]
    };

    async function getXRSession (xr) {

        console.log("xr", `${JSON.stringify(xr)}`);

        let session = null;

        try {
            session = await (xr.requestSession("immersive-ar", sessionInit));
        } catch (e) {
            session = await (xr.requestSession("immersive-vr", sessionInit));
        } finally {
            return session;
        }
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

        console.log(currentSession);

        if (!!config && !!config.videoLayerManager && !!videoLayerManager.videoLayerInitialized) {
            if (!!config.useXRLayers) {
                // Transition to WebXRLayer
                console.log("Clear video layer");
                config.videoLayerManager.clearVideoLayer(!config.useXRLayers, renderer, scene, session);
                // config.videoLayerManager.initVideoLayer(config.useXRLayers, renderer, scene, session);
            }
        }

        console.log("Init video layer: ", config.videoLayerManager.videoLayerInitialized);
    }

    function onSessionEnded (session) {

        const config = currentSession["config"];

        console.log("Ended WebXR session!", session, config);

        currentSession.removeEventListener("end", onSessionEnded);
        currentSession = null;

        if (!!config && !!config.videoLayerManager && !!videoLayerManager.videoLayerInitialized) {
            if (!!config.useXRLayers) {
                // Transition to WebGLLayer
                console.log("Clear video layer");
                config.videoLayerManager.clearVideoLayer(true, renderer, scene, session);
                console.log("Init video layer");
                config.videoLayerManager.initVideoLayer(false, renderer, scene, session);
            }
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

        const useXRLayers =  initXRLayers && (typeof XRWebGLBinding !== 'undefined' && 'createProjectionLayer' in XRWebGLBinding.prototype);

        const session = await getXRSession(navigator.xr);

        await onSessionStarted(session, { useXRLayers, videoLayerManager });

        updateScene(session, delta, time, { "action": "start_video" });

        // Set camera position
        // camera.position.z = 0;
        camera.position.y = 0;

        // player.position.y = camera.position.y;
        player.position.z = camera.position.z;

        const initSceneDataIn = {
            "events": [
                {
                    "action": "play_sounds"
                }
            ]
        }

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

    return renderer;

}

initRenderer(setupScene)
    .then((renderer) => {
        console.log("WebXR has been initialized with renderer: ", renderer);
    });

