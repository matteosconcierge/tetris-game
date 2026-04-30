import * as THREE from 'three';

// Constants
const SPEED_MIN = 0.5;
const SPEED_MAX = 5.0;
const ROTATION_SPEED = 0.03;

let lastTime = 0;
let accumulator = 0;
const step = 1/60;

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

function getGroundHeight(x, z) {
    const noise = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 10 
                + Math.sin(x * 0.01) * 20;
    return noise;
}

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

// Plane
const plane = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 4), new THREE.MeshPhongMaterial({ color: 0xff0000 }));
plane.add(body);
const wings = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 1), new THREE.MeshPhongMaterial({ color: 0xffffff }));
wings.position.y = 0.2;
plane.add(wings);
const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1), new THREE.MeshPhongMaterial({ color: 0xffffff }));
tail.position.set(0, 0.5, -1.5);
plane.add(tail);

plane.position.y = 50;
plane.castShadow = true;
scene.add(plane);

// State
const keys = {};
let isCrashed = false;
let explosionParticles = [];
const crashOverlay = document.getElementById('crash-overlay');

function resetGame() {
    isCrashed = false;
    crashOverlay.style.display = 'none';
    plane.position.set(0, 50, 0);
    plane.quaternion.set(0, 0, 0, 1);
    currentSpeed = SPEED_MIN;
    isThrottling = false;
    explosionParticles.forEach(p => scene.remove(p));
    explosionParticles.length = 0;
    scene.background = new THREE.Color(0x87ceeb);
}

let touchStart = null;
let touchCurrent = null;
let isThrottling = false;
let currentSpeed = SPEED_MIN;

const speedEl = document.getElementById('speed');
const altEl = document.getElementById('alt');

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
        isThrottling = !isThrottling;
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

    if (touchStart && touchCurrent) {
        const rawDx = (touchCurrent.x - touchStart.x) / window.innerWidth;
        const rawDy = (touchCurrent.y - touchStart.y) / window.innerHeight;
        
        const sensitivity = 4.0;
        // Intuitive Plane-Relative Controls:
        // Vertical swipe = Pitch (local X), Horizontal = Roll (local Z).
        // This remains intuitive when banked because the stick moves the nose relative to the seat.
        plane.rotateX(-rawDy * sensitivity * ROTATION_SPEED);
        plane.rotateZ(-rawDx * sensitivity * ROTATION_SPEED);
    }

    if (keys['KeyW']) plane.rotateX(ROTATION_SPEED);
    if (keys['KeyS']) plane.rotateX(-ROTATION_SPEED);
    if (keys['KeyA']) plane.rotateZ(ROTATION_SPEED);
    if (keys['KeyD']) plane.rotateZ(-ROTATION_SPEED);
    
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
        p.userData.velocity.y -= 0.01;
        p.material.opacity -= 0.02;
        if (p.material.opacity <= 0) {
            scene.remove(p);
            explosionParticles.splice(i, 1);
        }
    }
}

function crash(isWater) {
    if (isCrashed) return;
    isCrashed = true;
    currentSpeed = 0;
    scene.background = new THREE.Color(isWater ? 0x0044ff : 0xff4400);
    const particleCount = 20;
    const pGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < particleCount; i++) {
        const color = isWater ? (Math.random() > 0.5 ? 0xffffff : 0x44aaff) : (Math.random() > 0.5 ? 0xffaa00 : 0xff0000);
        const pMat = new THREE.MeshPhongMaterial({ color: color, transparent: true, opacity: 1.0 });
        const p = new THREE.Mesh(pGeom, pMat);
        p.position.copy(plane.position);
        p.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            Math.random() * (isWater ? 0.3 : 0.5),
            (Math.random() - 0.5) * 0.5
        );
        explosionParticles.push(p);
        scene.add(p);
    }
    crashOverlay.querySelector('h1').textContent = isWater ? 'SPLASHED' : 'CRASHED';
    crashOverlay.style.display = 'flex';
}

function update() {
    handleControls();
    const direction = new THREE.Vector3(0, 0, 1);
    direction.applyQuaternion(plane.quaternion);
    plane.position.add(direction.multiplyScalar(currentSpeed));
    updateParticles();
    updateCamera();
    updateUI();
    if (!isCrashed) {
        const groundH = getGroundHeight(plane.position.x, plane.position.z);
        if (plane.position.y < groundH + 1 || plane.position.y < -4.5) {
            const isWater = plane.position.y < -4.0 && groundH < -4.0;
            crash(isWater);
        }
    }
}

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

// Export for testing
window.testEnv = {
    plane,
    update,
    resetGame,
    getIsCrashed: () => isCrashed,
    getParticles: () => explosionParticles,
    THREE
};
window.setTouch = (start, current) => {
    touchStart = start;
    touchCurrent = current;
};
