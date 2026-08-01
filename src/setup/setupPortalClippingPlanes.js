import * as THREE from "three";

export default function setupPortalClippingPlanes (renderer, camera) {

    // Setup Clipping planes
    let xrCamera = renderer.xr.getCamera(camera);
    let xrCameraMatrix = xrCamera.matrixWorld;
    let xrCameraA = new THREE.Vector3();
    xrCameraA.setFromMatrixPosition(xrCameraMatrix);
    // // xrCameraDirection From:
    // // https://stackoverflow.com/questions/59554505/how-can-i-get-camera-world-direction-with-webxr#answer-59687055
    // let xrCameraDX = xrCameraMatrix.elements[8],
    //     xrCameraDY = xrCameraMatrix.elements[9],
    //     xrCameraDZ = xrCameraMatrix.elements[10];
    // let xrCameraDirection = new THREE.Vector3(-xrCameraDX, -xrCameraDY, -xrCameraDZ).normalize();

    // console.log(xrCameraA);

    const viewingPlaneLeft = -1; // x left
    const viewingPlaneRight = 1; // x right
    const viewingPlaneTop = 2.02; // y top
    const viewingPlaneBottom = 0.5; // y bottom
    const viewingPlaneDepth = 0; // z
    const viewingPlaneHorizonalCenter = 0;
    const viewingPlaneVerticalCenter= (viewingPlaneBottom + viewingPlaneTop) / 2; // (viewingPlaneTop - viewingPlaneBottom)/ 2 + viewingPlaneBottom

    const clippingLeftP = new THREE.Vector3(viewingPlaneLeft, xrCameraA.y, viewingPlaneDepth);
    const clippingRightP = new THREE.Vector3(viewingPlaneRight, xrCameraA.y, viewingPlaneDepth);
    const clippingTopP = new THREE.Vector3(xrCameraA.x, viewingPlaneTop, viewingPlaneDepth);
    const clippingBottomP = new THREE.Vector3(xrCameraA.x, viewingPlaneBottom, viewingPlaneDepth);

    const vDLeft = new THREE.Vector3();
    vDLeft.subVectors(clippingLeftP, xrCameraA);
    const vDRight = new THREE.Vector3();
    vDRight.subVectors(clippingRightP, xrCameraA);
    const vDTop = new THREE.Vector3();
    vDTop.subVectors(clippingTopP, xrCameraA);
    const vDBottom = new THREE.Vector3();
    vDBottom.subVectors(clippingBottomP, xrCameraA);

    const clippingLeftUnitVector = new THREE.Vector3(1.0, 0, 0);
    const clippingLeftDirection = vDLeft.clone().cross(new THREE.Vector3(0, 1.0, 0)).normalize();
    const clippingLeftUnitAngleToDirection = clippingLeftUnitVector.angleTo(clippingLeftDirection.clone());
    const clippingLeftX = Math.cos(clippingLeftUnitAngleToDirection) * viewingPlaneLeft;
    const clippingRightUnitVector = new THREE.Vector3(-1.0, 0, 0);
    const clippingRightDirection = vDRight.clone().cross(new THREE.Vector3(0, -1.0, 0)).normalize();
    const clippingRightUnitAngleToDirection = clippingRightUnitVector.angleTo(clippingRightDirection.clone());
    const clippingRightX = Math.cos(clippingRightUnitAngleToDirection) * viewingPlaneRight;
    const clippingTopUnitVector = new THREE.Vector3(0, -1.0, 0);
    const clippingTopDirection = vDTop.clone().cross(new THREE.Vector3(1.0, 0, 0)).normalize();
    const clippingTopUnitAngleToDirection = clippingTopUnitVector.angleTo(clippingTopDirection.clone());
    const clippingTopY = Math.cos(clippingTopUnitAngleToDirection) * viewingPlaneTop;
    const clippingBottomUnitVector = (xrCameraA.z > viewingPlaneDepth) ?
        new THREE.Vector3(0, 1.0, 0) :
        new THREE.Vector3(0, -1.0, 0);
    const clippingBottomDirection = vDBottom.clone().cross(new THREE.Vector3(-1, 0, 0)).normalize(); // new THREE.Vector3(0, 1, 0);
    const clippingBottomUnitAngleToDirection = clippingBottomUnitVector.angleTo(clippingBottomDirection.clone());
    const clippingBottomY = Math.cos(clippingBottomUnitAngleToDirection) * viewingPlaneBottom; // viewingPlaneBottom = 1.0 // length on unit circle

    const clippingLeftPlane = new THREE.Plane(clippingLeftDirection.clone(), -clippingLeftX);
    const clippingRightPlane = new THREE.Plane(clippingRightDirection.clone(), clippingRightX);
    const clippingTopPlane = new THREE.Plane(clippingTopDirection.clone(), clippingTopY);
    const clippingBottomPlane = new THREE.Plane(clippingBottomDirection.clone(), clippingBottomY * -(viewingPlaneBottom - 0.001));
    const clippingPlaneInside = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const clippingPlaneOutside = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);

    const clipping_data = {
        "leftΘ": clippingLeftUnitAngleToDirection,
        "leftX": clippingLeftX,
        "rightΘ": clippingRightUnitAngleToDirection,
        "rightX": clippingRightX,
        "topΘ": clippingTopUnitAngleToDirection,
        "topY": clippingTopY,
        "bottomΘ": clippingBottomUnitAngleToDirection,
        "bottomY": clippingBottomY
    };

    const clipping_data_for_html = JSON.stringify(clipping_data)
        .replace(new RegExp("\\\\n", "g"), '<br />')
        .replace(new RegExp('"\:', "g"), '":<br />')
        .replace(new RegExp(',', "g"), '",<br />')
        .replace(new RegExp("{", "g"), '{<br />')
        .replace(new RegExp("}", "g"), '<br />}');

    // console.log(clipping_data_for_html);

    return [
        clippingLeftPlane,
        clippingRightPlane,
        clippingTopPlane,
        clippingBottomPlane,
        ...(xrCameraA.z > viewingPlaneDepth) ?
            [ clippingPlaneOutside ] :
            [ clippingPlaneInside, clippingPlaneOutside ]
    ];
}
