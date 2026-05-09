import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- CONFIGURATION ---
const TRACK_POINTS = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(100, 0, 20),
    new THREE.Vector3(200, 0, 0),
    new THREE.Vector3(250, 0, 100),
    new THREE.Vector3(200, 0, 250),
    new THREE.Vector3(50, 0, 300),
    new THREE.Vector3(-100, 0, 250),
    new THREE.Vector3(-150, 0, 100),
    new THREE.Vector3(-100, 0, 20),
];

// Create closed loop
const trackCurve = new THREE.CatmullRomCurve3(TRACK_POINTS, true);

const CAR_COLORS = [0x00f2ff, 0xff0055, 0x00ff44, 0xffaa00];
const MAX_LAPS = 3;
const NUM_AI = 3;

// --- STATE MANAGEMENT ---
let scene, camera, renderer, clock;
let playerCar;
let aiCars = [];
let participants = []; // { mesh, isPlayer, progress, lap, lastPos }
let gameState = 'START'; // START, RACING, FINISHED
let keys = {};
let checkpoints = [];

// --- UTILS ---
const lerp = (a, b, t) => a + (b - a) * t;

// --- INITIALIZATION ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050510);
    scene.fog = new THREE.FogExp2(0x050510, 0.002);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    clock = new THREE.Clock();

    setupLights();
    setupEnvironment();
    createTrack();
    setupCars();
    setupCheckpoints();

    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    window.addEventListener('resize', onWindowResize);

    document.getElementById('start-button').onclick = startRace;
    document.getElementById('restart-button').onclick = () => location.reload();

    // Mobile controls
    setupMobileControls();

    animate();
}

function setupMobileControls() {
    const btns = {
        'btn-left': 'KeyA',
        'btn-right': 'KeyD',
        'btn-accel': 'KeyW',
        'btn-brake': 'KeyS'
    };

    Object.entries(btns).forEach(([id, code]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', () => keys[code] = true);
        el.addEventListener('pointerup', () => keys[code] = false);
        el.addEventListener('pointerleave', () => keys[code] = false);
    });
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(100, 200, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);
}

function setupEnvironment() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper for "Web" style
    const grid = new THREE.GridHelper(2000, 50, 0x00f2ff, 0x222222);
    grid.position.y = 0.05;
    scene.add(grid);

    // Simple Skybox (Gradient)
    const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x050510,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 2000; i++) {
        starCoords.push(THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000), THREE.MathUtils.randFloatSpread(1000));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
}

function createTrack() {
    const trackWidth = 14;
    const segments = 400;
    
    // Create road geometry
    const trackGeo = new THREE.TubeGeometry(trackCurve, segments, trackWidth, 8, true);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a, 
        roughness: 0.2, 
        metalness: 0.1 
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.scale.y = 0.02; 
    track.position.y = 0.05;
    track.receiveShadow = true;
    scene.add(track);

    // Decorative Lines (Center line)
    const lineCurve = new THREE.TubeGeometry(trackCurve, segments, 0.2, 4, true);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const centerLine = new THREE.Mesh(lineCurve, lineMat);
    centerLine.scale.y = 0.06; 
    centerLine.position.y = 0.06;
    scene.add(centerLine);

    // Curbs (Red and White)
    const curbCanvas = document.createElement('canvas');
    curbCanvas.width = 64;
    curbCanvas.height = 64;
    const ctx = curbCanvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 32, 64);
    
    const curbTex = new THREE.CanvasTexture(curbCanvas);
    curbTex.wrapS = THREE.RepeatWrapping;
    curbTex.repeat.set(segments / 2, 1);

    const curbGeo = new THREE.TubeGeometry(trackCurve, segments, trackWidth + 0.8, 8, true);
    const curbMat = new THREE.MeshStandardMaterial({ 
        map: curbTex,
        roughness: 0.5
    });
    const curb = new THREE.Mesh(curbGeo, curbMat);
    curb.scale.y = 0.03;
    curb.position.y = 0.04;
    scene.add(curb);
}

function createCar(color, isPlayer = false) {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: color, 
        metalness: 0.9, 
        roughness: 0.1 
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    // Roof
    const roofGeo = new THREE.BoxGeometry(1.5, 0.5, 1.8);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.set(0, 1.2, -0.2);
    group.add(roof);

    // Windshield
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0, metalness: 1 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.1), glassMat);
    glass.position.set(0, 1.2, 0.7);
    glass.rotation.x = -0.5;
    group.add(glass);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelPositions = [
        [-1.1, 0.4, 1.2], [1.1, 0.4, 1.2],
        [-1.1, 0.4, -1.2], [1.1, 0.4, -1.2]
    ];
    wheelPositions.forEach(p => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(...p);
        wheel.rotation.z = Math.PI / 2;
        group.add(wheel);
    });

    scene.add(group);
    return group;
}

function setupCars() {
    // Player
    const pMesh = createCar(CAR_COLORS[0], true);
    playerCar = {
        mesh: pMesh,
        isPlayer: true,
        speed: 0,
        maxSpeed: 1.5, // units per frame roughly
        accel: 0.005,
        friction: 0.98,
        steering: 0,
        rotation: 0,
        progress: 0,
        lap: 1,
        color: CAR_COLORS[0],
        name: 'YOU'
    };
    participants.push(playerCar);

    // Correct Start position and alignment
    const startPoint = trackCurve.getPoint(0);
    const startTangent = trackCurve.getTangent(0).normalize();
    const startRotation = Math.atan2(startTangent.x, startTangent.z);
    const right = new THREE.Vector3().crossVectors(startTangent, new THREE.Vector3(0, 1, 0)).normalize();

    playerCar.rotation = startRotation;
    playerCar.mesh.rotation.y = startRotation;
    playerCar.mesh.position.copy(startPoint).add(right.clone().multiplyScalar(4));

    // AI
    for (let i = 0; i < NUM_AI; i++) {
        const aiMesh = createCar(CAR_COLORS[i + 1]);
        const ai = {
            mesh: aiMesh,
            isPlayer: false,
            speed: 0.15 + Math.random() * 0.05,
            progress: 0,
            lap: 1,
            color: CAR_COLORS[i + 1],
            name: `CPU ${i + 1}`,
            offset: (i + 1) * -4 // Spread across track
        };
        aiCars.push(ai);
        participants.push(ai);

        aiMesh.rotation.y = startRotation;
        aiMesh.position.copy(startPoint).add(right.clone().multiplyScalar(ai.offset));
    }
}

function setupCheckpoints() {
    // 4 Checkpoints around the track
    for (let i = 0; i < 4; i++) {
        checkpoints.push(i / 4);
    }
}

function updatePlayer(dt) {
    if (gameState !== 'RACING') return;

    // Movement logic
    if (keys['KeyW'] || keys['ArrowUp']) {
        playerCar.speed += playerCar.accel;
    } else if (keys['KeyS'] || keys['ArrowDown']) {
        playerCar.speed -= playerCar.accel * 1.5;
    } else {
        playerCar.speed *= playerCar.friction;
    }

    // Handbrake
    if (keys['Space']) playerCar.speed *= 0.95;

    playerCar.speed = Math.max(-0.2, Math.min(playerCar.speed, playerCar.maxSpeed));

    // Steering
    const steerLimit = 0.04 / (1 + playerCar.speed * 2);
    if (keys['KeyA'] || keys['ArrowLeft']) {
        playerCar.rotation += playerCar.speed * steerLimit;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        playerCar.rotation -= playerCar.speed * steerLimit;
    }

    // Apply transformation
    playerCar.mesh.translateZ(playerCar.speed);
    playerCar.mesh.rotation.y = playerCar.rotation;

    // Track progress for HUD/Position
    updateProgress(playerCar);

    // Update HUD
    document.getElementById('speed-value').innerText = Math.floor(playerCar.speed * 200);
    document.getElementById('lap-display').innerText = `LAP ${playerCar.lap}/${MAX_LAPS}`;
}

function updateAI(dt) {
    if (gameState !== 'RACING') return;

    aiCars.forEach((ai, index) => {
        // AI follows the spline
        ai.progress += ai.speed * 0.001 * (1 + Math.sin(clock.elapsedTime + index) * 0.1); 
        if (ai.progress >= 1) {
            ai.progress = 0;
            ai.lap++;
            if (ai.lap > MAX_LAPS) finishRace(ai);
        }

        const point = trackCurve.getPointAt(ai.progress % 1);
        const tangent = trackCurve.getTangentAt(ai.progress % 1);
        
        ai.mesh.position.copy(point);
        ai.mesh.lookAt(point.clone().add(tangent));
        
        // Offset from center
        const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        ai.mesh.position.add(right.multiplyScalar(ai.offset));
    });
}

function updateProgress(car) {
    // Project car position onto spline to find progress
    // Simplified: find closest point on spline
    let closestT = 0;
    let minDist = Infinity;
    
    // Check points on curve
    for (let t = 0; t <= 1; t += 0.01) {
        const p = trackCurve.getPoint(t);
        const d = p.distanceTo(car.mesh.position);
        if (d < minDist) {
            minDist = d;
            closestT = t;
        }
    }

    // Handle lap cross
    if (car.lastT > 0.8 && closestT < 0.2) {
        car.lap++;
        if (car.lap > MAX_LAPS && car.isPlayer) {
            finishRace(car);
        }
    }
    
    car.lastT = closestT;
    car.progress = car.lap + closestT;
}

function updateLeaderboard() {
    // Sort by progress desc
    participants.sort((a, b) => b.progress - a.progress);
    
    const mini = document.getElementById('leaderboard-mini');
    mini.innerHTML = '';
    
    participants.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = `leader-row ${p.isPlayer ? 'player' : ''}`;
        div.innerHTML = `<span>${i + 1}. ${p.name}</span><span>Lap ${Math.min(p.lap, MAX_LAPS)}</span>`;
        mini.appendChild(div);

        if (p.isPlayer) {
            document.getElementById('position-display').innerText = `${getOrdinal(i + 1)} / ${participants.length}`;
        }
    });
}

function getOrdinal(n) {
    const s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function startRace() {
    gameState = 'RACING';
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('ui-overlay').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    clock.start();
}

function finishRace(winner) {
    if (gameState === 'FINISHED') return;
    
    if (winner.isPlayer || aiCars.every(ai => ai.lap > MAX_LAPS)) {
        gameState = 'FINISHED';
        document.getElementById('ui-overlay').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');

        const results = document.getElementById('final-results');
        results.innerHTML = participants.map((p, i) => `
            <div style="color: ${p.isPlayer ? '#00f2ff' : 'white'}; margin: 10px 0;">
                ${i + 1}. ${p.name} - ${p.lap > MAX_LAPS ? 'FINISHED' : 'DNF'}
            </div>
        `).join('');
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    updatePlayer(dt);
    updateAI(dt);
    updateLeaderboard();

    // Camera follow
    if (playerCar) {
        const offset = new THREE.Vector3(0, 5, -12); // Back and up
        offset.applyQuaternion(playerCar.mesh.quaternion);
        camera.position.lerp(playerCar.mesh.position.clone().add(offset), 0.1);
        camera.lookAt(playerCar.mesh.position);
    }

    renderer.render(scene, camera);
}

init();
