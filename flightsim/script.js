import * as THREE from 'three';

// Constants
const SPEED_MIN = 0.5;
const SPEED_MAX = 5.0;
const ROTATION_SPEED = 0.03;

let lastTime = 0;
let accumulator = 0;
const step = 1/60;

// Scene Setup
const scene = new THREE.Scene(); window.scene = scene;
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

function getGroundHeight(x, z) {
    // Matches the terrain generation noise
    const noise = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 10 
                + Math.sin(x * 0.01) * 20;
    return noise;
}

// Simple heightmap generation
const posAttr = geometry.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const x = posAttr.getX(i);
    const noise = getGroundHeight(x, posAttr.getY(i));
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
const plane = new THREE.Group(); window.plane = plane;

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
let isCrashed = false; window.gameStatus = { isCrashed: false, crashCount: 0, lastIsWater: null, explosionColors: [] };
let explosionParticles = [];
const crashOverlay = document.getElementById('crash-overlay');

function resetGame() { window.gameStatus.isCrashed = false; window.gameStatus.explosionColors = [];
    isCrashed = false;
    crashOverlay.style.display = 'none';
    plane.position.set(0, 50, 0);
    plane.quaternion.set(0, 0, 0, 1);
    currentSpeed = SPEED_MIN;
    isThrottling = false;
    
    // Clear particles
    explosionParticles.forEach(p => scene.remove(p));
    explosionParticles = [];
    scene.background = new THREE.Color(0x87ceeb); // Reset sky color
}

let touchStart = null;
let touchCurrent = null;
let isThrottling = false;
let currentSpeed = SPEED_MIN;

// UI
const speedEl = document.getElementById('speed');
const altEl = document.getElementById('alt');

// Controls
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

window.addEventListener('touchstart', (e) => {
    if (isCrashed) {
        resetGame();
        return;
    }
    if (e.touches.length === 1) {
        touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        touchCurrent = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length > 1) {
        isThrottling = !isThrottling; // Toggle throttle with second finger
    }
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1) {
        touchCurrent = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
}, { passive: false });

window.addEventListener('touchend', () => {
    touchStart = null;
    touchCurrent = null;
});

function handleControls() {
    if (isCrashed) return;

    // Touch steering
    if (touchStart && touchCurrent) {
        const dx = (touchCurrent.x - touchStart.x) / window.innerWidth;
        const dy = (touchCurrent.y - touchStart.y) / window.innerHeight;
        
        // Sensitivity scaling
        const sensitivity = 2.0;
        
        // Pitch (Swipe up -> Nose down -> rotateX positive)
        // Swipe up means dy is negative, but user wants nose down
        // Actually dy is (current - start). 
        // Swipe up: current is less than start, dy is negative.
        // We want nose down (plane rotates forward/down).
        plane.rotateX(-dy * sensitivity * ROTATION_SPEED);
        
        // Roll
        plane.rotateZ(-dx * sensitivity * ROTATION_SPEED);
    }

    // Pitch (W/S)
    if (keys['KeyW']) plane.rotateX(ROTATION_SPEED);
    if (keys['KeyS']) plane.rotateX(-ROTATION_SPEED);
    
    // Roll (A/D)
    if (keys['KeyA']) plane.rotateZ(ROTATION_SPEED);
    if (keys['KeyD']) plane.rotateZ(-ROTATION_SPEED);
    
    // Throttle (Space)
    if (keys['Space'] || isThrottling) {
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

function updateParticles() {
    for (let i = explosionParticles.length - 1; i >= 0; i--) {
        const p = explosionParticles[i];
        p.position.add(p.userData.velocity);
        p.userData.velocity.y -= 0.01; // Gravity on particles
        p.material.opacity -= 0.02;
        if (p.material.opacity <= 0) {
            scene.remove(p);
            explosionParticles.splice(i, 1);
        }
    }
}

// Update logic moved out of animate
function update() {
    handleControls();

    // Move forward based on orientation
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(plane.quaternion);
    plane.position.add(direction.multiplyScalar(currentSpeed));

    updateParticles();

    updateCamera();
    updateUI();

    // Collision detection
    if (!isCrashed) {
        const groundH = getGroundHeight(plane.position.x, plane.position.z);
        // Check ground or water (water is at -5)
        if (plane.position.y < groundH + 1 || plane.position.y < -4.5) {
            const isWater = plane.position.y < -4.0 && groundH < -4.0;
            crash(isWater);
        }
    }
}

function crash(isWater) {
    isCrashed = true; window.gameStatus.isCrashed = true; window.gameStatus.crashCount++; window.gameStatus.lastIsWater = isWater;
    currentSpeed = 0;
    
    // Screen shake / Background flare
    scene.background = new THREE.Color(isWater ? 0x0044ff : 0xff4400);
    
    // Create explosion particles
    const particleCount = 20;
    const pGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < particleCount; i++) {
        const color = isWater ? 
            (Math.random() > 0.5 ? 0xffffff : 0x44aaff) : 
            (Math.random() > 0.5 ? 0xffaa00 : 0xff0000);
            
        const pMat = new THREE.MeshPhongMaterial({ 
            color: color,
            transparent: true,
            opacity: 1.0
        });
        const p = new THREE.Mesh(pGeom, pMat);
        p.position.copy(plane.position);
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * (isWater ? 0.3 : 0.5),
            (Math.random() - 0.5) * 0.5
        );
        explosionParticles.push(p); window.gameStatus.explosionColors.push(p.material.color.getHex());
        scene.add(p);
    }

    // Visual crash tilt
    plane.rotation.z += 0.5;

    crashOverlay.querySelector('h1').textContent = isWater ? 'SPLASHED' : 'CRASHED';
    crashOverlay.style.display = 'flex';
    
    // Random 'crash' tilt
    plane.rotation.z += Math.random() * 0.5 - 0.25;
    plane.rotation.x += Math.random() * 0.5 - 0.25;

    window.addEventListener('keydown', function onCrashKey() {
        resetGame();
        window.removeEventListener('keydown', onCrashKey);
    }, { once: true });
}


// Main Loop with Delta-time
function animate(timestamp) {
    requestAnimationFrame(animate);
    
    if (!lastTime) lastTime = timestamp;
    let deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    accumulator += deltaTime;
    while (accumulator >= step) {
        update();
        accumulator -= step;
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(animate);
