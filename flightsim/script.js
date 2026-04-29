import * as THREE from 'three';

// Constants
const SPEED_MIN = 0.5;
const SPEED_MAX = 5.0;
const ROTATION_SPEED = 0.03;

// Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 10, 500);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1);
sunLight.position.set(100, 100, 50);
sunLight.castShadow = true;
scene.add(sunLight);

// Terrain
const terrainSize = 2000;
const segments = 100;
const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
const material = new THREE.MeshPhongMaterial({ color: 0x3c9b19, flatShading: true });

// Simple heightmap generation
const posAttr = geometry.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const noise = Math.sin(x * 0.05) * Math.cos(y * 0.05) * 10 
                + Math.sin(x * 0.01) * 20;
    posAttr.setZ(i, noise);
}
geometry.computeVertexNormals();

const terrain = new THREE.Mesh(geometry, material);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// Water
const waterGeom = new THREE.PlaneGeometry(terrainSize, terrainSize);
const waterMat = new THREE.MeshPhongMaterial({ color: 0x0044ff, transparent: true, opacity: 0.6 });
const water = new THREE.Mesh(waterGeom, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -5;
scene.add(water);

// Plane (Simplified Model)
const plane = new THREE.Group();

// Fuselage
const bodyGeom = new THREE.BoxGeometry(1, 1, 4);
const bodyMat = new THREE.MeshPhongMaterial({ color: 0xff0000 });
const body = new THREE.Mesh(bodyGeom, bodyMat);
plane.add(body);

// Wings
const wingGeom = new THREE.BoxGeometry(5, 0.1, 1);
const wingMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
const wings = new THREE.Mesh(wingGeom, wingMat);
wings.position.y = 0.2;
plane.add(wings);

// Tail
const tailGeom = new THREE.BoxGeometry(0.1, 1.5, 1);
const tail = new THREE.Mesh(tailGeom, wingMat);
tail.position.set(0, 0.5, -1.5);
plane.add(tail);

plane.position.y = 50;
plane.castShadow = true;
scene.add(plane);

// State
const keys = {};
let currentSpeed = SPEED_MIN;

// UI
const speedEl = document.getElementById('speed');
const altEl = document.getElementById('alt');

// Controls
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function handleControls() {
    // Pitch (W/S)
    if (keys['KeyW']) plane.rotateX(ROTATION_SPEED);
    if (keys['KeyS']) plane.rotateX(-ROTATION_SPEED);
    
    // Roll (A/D)
    if (keys['KeyA']) plane.rotateZ(ROTATION_SPEED);
    if (keys['KeyD']) plane.rotateZ(-ROTATION_SPEED);
    
    // Throttle (Space)
    if (keys['Space']) {
        currentSpeed = Math.min(SPEED_MAX, currentSpeed + 0.05);
    } else {
        currentSpeed = Math.max(SPEED_MIN, currentSpeed - 0.02);
    }
}

function updateCamera() {
    const offset = new THREE.Vector3(0, 5, -15);
    offset.applyQuaternion(plane.quaternion);
    camera.position.copy(plane.position).add(offset);
    camera.lookAt(plane.position);
}

function updateUI() {
    speedEl.textContent = Math.round(currentSpeed * 50);
    altEl.textContent = Math.round(plane.position.y * 10);
}

// Main Loop
function animate() {
    requestAnimationFrame(animate);
    
    handleControls();
    
    // Move forward based on orientation
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(plane.quaternion);
    plane.position.add(direction.multiplyScalar(currentSpeed));
    
    updateCamera();
    updateUI();
    
    renderer.render(scene, camera);
}

// Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
