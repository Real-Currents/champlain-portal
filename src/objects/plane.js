import * as THREE from "three";
import planeGeometry from "../geometry/planeGeometry";
import meshMaterial from "../material/meshMaterial";

const flatMesh = new THREE.Mesh(planeGeometry, meshMaterial);

flatMesh.rotateX(-Math.PI / 2);
flatMesh.position.x = 0;
flatMesh.position.y = 0;
flatMesh.position.z = 0;

const plane = new THREE.Group();

plane.add(flatMesh);

export default plane;
