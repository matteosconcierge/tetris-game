import * as THREE from 'three';

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

let speedLines;

// --- INITIALIZATION ---
export function init() {
    // 1. Initialize clock
    clock = new THREE.Clock();

    // 2. Immediate event binding with explicit z-index
    const startBtn = document.getElementById('start-button');
    if (startBtn) {
        startBtn.style.pointerEvents = 'auto';
        startBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startRace();
        };
    }

    const restartBtn = document.getElementById('restart-button');
    if (restartBtn) {
        restartBtn.onclick = () => location.reload();
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2a); // Slightly brighter blue
    scene.fog = new THREE.FogExp2(0x050510, 0.002);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    renderer = new THREE.WebGLRenderer({ 
        antialias: false, 
        powerPreference: "high-performance", 
        alpha: false,
        stencil: false,
        depth: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Aggressive Resolution Cap for Desktop (Brave/Safari/Chrome)
    // On high-DPI desktop monitors, 2.0 is often too much for integrated GPUs or browser wrappers.
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const maxDPR = isMobile ? 2.0 : 1.25;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDPR));
    renderer.shadowMap.enabled = false; 
    document.getElementById('game-container').appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    setupLights();
    setupEnvironment();
    createTrack();
    setupCars();
    setupCheckpoints();
    setupSpeedLines();

    window.addEventListener('keydown', (e) => keys[e.code] = true);
    window.addEventListener('keyup', (e) => keys[e.code] = false);
    window.addEventListener('resize', onWindowResize);
    setupMobileControls();
    animate();

    // Important: Force a resize check after a short delay for mobile browsers
    setTimeout(() => {
        onWindowResize();
    }, 100);
}

function setupSpeedLines() {
    const geo = new THREE.BufferGeometry();
    const count = 200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) positions[i] = 0;
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.LineBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 });
    speedLines = new THREE.LineSegments(geo, mat);
    speedLines.frustumCulled = false;
    scene.add(speedLines);
}

function updateSpeedLines() {
    if (!playerCar || !speedLines) return;
    
    const positions = speedLines.geometry.attributes.position.array;
    const speedFactor = playerCar.speed / playerCar.maxSpeed;
    
    speedLines.visible = speedFactor > 0.6;
    if (!speedLines.visible) return;

    for (let i = 0; i < 200; i++) {
        const idx = i * 6;
        // If particle is "dead" or reset
        if (positions[idx + 2] === 0) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            const z = 20 + Math.random() * 30; // Start far ahead

            positions[idx] = positions[idx + 3] = x;
            positions[idx + 1] = positions[idx + 4] = y;
            positions[idx + 2] = z;
            positions[idx + 5] = z + 5; // length
        }

        // Move towards camera
        positions[idx + 2] -= 2;
        positions[idx + 5] -= 2;

        if (positions[idx + 5] < -10) {
            positions[idx + 2] = 0; // Reset signal
        }
    }
    
    // Position the whole system relative to camera and rotate to match player
    speedLines.position.copy(camera.position);
    speedLines.quaternion.copy(camera.quaternion);
    
    speedLines.geometry.attributes.position.needsUpdate = true;
}

function setupMobileControls() {
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }

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
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(200, 500, 100);
    sun.castShadow = true;
    sun.shadow.camera.left = -500;
    sun.shadow.camera.right = 500;
    sun.shadow.camera.top = 500;
    sun.shadow.camera.bottom = -500;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    // Sun Glow (Lens Flare effect)
    const sunGlow = createGlowSprite(0xffffaa);
    sunGlow.scale.set(100, 100, 1);
    sunGlow.position.set(200, 500, 100);
    scene.add(sunGlow);
}

function setupEnvironment() {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({ 
        color: 0x080808,
        roughness: 1,
        metalness: 0
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle Grid
    const grid = new THREE.GridHelper(2000, 100, 0x00f2ff, 0x111111);
    grid.position.y = 0.01;
    grid.material.opacity = 0.2;
    grid.material.transparent = true;
    scene.add(grid);

    // Skyscrapers / Skyline in the distance
    const cityGroup = new THREE.Group();
    for (let i = 0; i < 100; i++) {
        const h = 50 + Math.random() * 200;
        const w = 10 + Math.random() * 20;
        const bGeo = new THREE.BoxGeometry(w, h, w);
        const bMat = new THREE.MeshStandardMaterial({ 
            color: 0x0a0a15, 
            emissive: 0x001122,
            roughness: 0.2 
        });
        const building = new THREE.Mesh(bGeo, bMat);
        
        const angle = Math.random() * Math.PI * 2;
        const dist = 600 + Math.random() * 400;
        building.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
        cityGroup.add(building);

        // Add some "windows" (glowing dots)
        if (Math.random() > 0.5) {
            const windowSprite = createGlowSprite(0x00f2ff);
            windowSprite.scale.set(10, 10, 1);
            windowSprite.position.copy(building.position);
            windowSprite.position.y = Math.random() * h;
            cityGroup.add(windowSprite);
        }
    }
    scene.add(cityGroup);

    // Street Lamps along the track
    for (let t = 0; t < 1; t += 0.05) {
        const pos = trackCurve.getPointAt(t);
        const tangent = trackCurve.getTangentAt(t);
        const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        
        const lampPos = pos.clone().add(right.clone().multiplyScalar(15));
        createLamp(lampPos);
        
        const lampPos2 = pos.clone().add(right.clone().multiplyScalar(-15));
        createLamp(lampPos2);
    }

    // Sky
    const skyGeo = new THREE.SphereGeometry(1200, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
        color: 0x020205,
        side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);

    // Stars
    const starGeo = new THREE.BufferGeometry();
    const starCoords = [];
    for (let i = 0; i < 5000; i++) {
        starCoords.push(THREE.MathUtils.randFloatSpread(2000), THREE.MathUtils.randFloatSpread(1000) + 500, THREE.MathUtils.randFloatSpread(2000));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starCoords, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0.8 });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
}

function createLamp(pos) {
    const group = new THREE.Group();
    group.position.copy(pos);

    // Post
    const postGeo = new THREE.CylinderGeometry(0.2, 0.3, 12, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 6;
    group.add(post);

    // Arm
    const armGeo = new THREE.BoxGeometry(4, 0.2, 0.2);
    const arm = new THREE.Mesh(armGeo, postMat);
    arm.position.set(1.5, 12, 0);
    group.add(arm);

    // Light Head
    const headGeo = new THREE.BoxGeometry(1, 0.5, 0.8);
    const head = new THREE.Mesh(headGeo, postMat);
    head.position.set(3, 11.8, 0);
    group.add(head);

    // Actual Light
    const light = new THREE.PointLight(0x00f2ff, 50, 40);
    light.position.set(3, 11, 0);
    group.add(light);

    // Glow Sprite (Lens Flare-ish)
    const glow = createGlowSprite(0x00f2ff);
    glow.scale.set(8, 8, 1);
    glow.position.set(3, 11, 0);
    group.add(glow);

    scene.add(group);
}

function createAsphaltTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base color
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, 512, 512);
    
    // Noise/Grain
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = Math.random() * 2;
        const alpha = Math.random() * 0.2;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fillRect(x, y, size, size);
    }
    
    // Cracks/Texture
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 20; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * 512, Math.random() * 512);
        ctx.lineTo(Math.random() * 512, Math.random() * 512);
        ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(100, 1);
    return tex;
}

function createGlowSprite(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);

    // Convert hex number to CSS string
    const colorStr = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : color;

    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, colorStr);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    
    const tex = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ 
        map: tex, 
        transparent: true, 
        blending: THREE.AdditiveBlending 
    });
    return new THREE.Sprite(material);
}

function createTrack() {
    const trackWidth = 14;
    const segments = 400;
    
    const asphaltTex = createAsphaltTexture();
    
    // Create road geometry
    const trackGeo = new THREE.TubeGeometry(trackCurve, segments, trackWidth, 8, true);
    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        map: asphaltTex,
        roughness: 0.8,
        metalness: 0.2
    });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.scale.y = 0.02; 
    track.position.y = 0.05;
    track.receiveShadow = true;
    scene.add(track);

    // Decorative Lines (Center line) - Dashed look
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

    const bodyMat = new THREE.MeshStandardMaterial({ 
        color: color, 
        metalness: 0.6, 
        roughness: 0.2
    });

    const blackMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({ 
        color: 0x000000, 
        metalness: 1.0, 
        roughness: 0.1,
        transparent: true,
        opacity: 0.8
    });

    // Main Body (lower)
    const bodyGeo = new THREE.BoxGeometry(2.1, 0.5, 4.2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    group.add(body);

    // Upper Body/Cabin
    const cabinGeo = new THREE.BoxGeometry(1.6, 0.6, 2);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 1.0, -0.2);
    group.add(cabin);

    // Windshield
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.1), glassMat);
    windshield.position.set(0, 1.05, 0.8);
    windshield.rotation.x = -0.5;
    group.add(windshield);

    // Spoiler
    const spoilerPostGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const postL = new THREE.Mesh(spoilerPostGeo, blackMat);
    postL.position.set(-0.7, 0.9, -1.9);
    group.add(postL);
    
    const postR = postL.clone();
    postR.position.x = 0.7;
    group.add(postR);

    const wingGeo = new THREE.BoxGeometry(2.2, 0.1, 0.6);
    const wing = new THREE.Mesh(wingGeo, bodyMat);
    wing.position.set(0, 1.1, -1.95);
    wing.rotation.x = 0.1;
    group.add(wing);

    // Headlights
    const lightGeo = new THREE.CircleGeometry(0.2, 16);
    const lightMat = new THREE.MeshStandardMaterial({ 
        emissive: 0xffffff, 
        emissiveIntensity: 5,
        color: 0xffffff 
    });
    
    const lightL = new THREE.Mesh(lightGeo, lightMat);
    lightL.position.set(-0.7, 0.55, 2.11);
    group.add(lightL);
    
    const lightR = lightL.clone();
    lightR.position.x = 0.7;
    group.add(lightR);

    // Glow Sprites for Headlights (Fake Bloom)
    const glowL = createGlowSprite('#ffffff');
    glowL.scale.set(1.5, 1.5, 1);
    glowL.position.set(-0.7, 0.55, 2.2);
    group.add(glowL);

    const glowR = glowL.clone();
    glowR.position.x = 0.7;
    group.add(glowR);

    // Side Mirrors
    const mirrorGeo = new THREE.BoxGeometry(0.3, 0.15, 0.1);
    const mirrorL = new THREE.Mesh(mirrorGeo, bodyMat);
    mirrorL.position.set(-1.1, 0.9, 0.5);
    group.add(mirrorL);

    const mirrorR = mirrorL.clone();
    mirrorR.position.x = 1.1;
    group.add(mirrorR);

    // Wheel Wells / Fenders
    const fenderGeo = new THREE.BoxGeometry(0.5, 0.6, 1.2);
    const fenderL = new THREE.Mesh(fenderGeo, blackMat);
    fenderL.position.set(-1.0, 0.4, 1.2);
    // simplified, just adding some dark detail near wheels

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.4, 32);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.8 });
    const wheelPositions = [
        [-1.0, 0.45, 1.3], [1.0, 0.45, 1.3],
        [-1.0, 0.45, -1.3], [1.0, 0.45, -1.3]
    ];
    wheelPositions.forEach(p => {
        const wheelGroup = new THREE.Group();
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        
        // Rim detail
        const rimGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.42, 8);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.z = Math.PI / 2;
        
        wheelGroup.add(wheel);
        wheelGroup.add(rim);
        wheelGroup.position.set(...p);
        group.add(wheelGroup);
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

    // Set initial camera position immediately to avoid starting at (0,0,0) [prevent black screen]
    const initialOffset = new THREE.Vector3(0, 4, -10);
    initialOffset.applyQuaternion(playerCar.mesh.quaternion);
    camera.position.copy(playerCar.mesh.position).add(initialOffset);
    camera.lookAt(playerCar.mesh.position);
}

function setupCheckpoints() {
    // 8 Neon Rings around the track
    for (let i = 0; i < 8; i++) {
        const t = (i + 0.5) / 8; // Offset to not be exactly at start
        const pos = trackCurve.getPointAt(t);
        const tangent = trackCurve.getTangentAt(t);
        
        const checkpoint = {
            t: t,
            pos: pos,
            passed: false,
            mesh: null
        };

        // Neon Ring
        const ringGeo = new THREE.TorusGeometry(12, 0.3, 16, 50);
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: 0x00f2ff, 
            emissive: 0x00f2ff, 
            emissiveIntensity: 5 
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.lookAt(pos.clone().add(tangent));
        ring.position.y = 5;
        scene.add(ring);
        checkpoint.mesh = ring;

        // Ring Glow
        const glow = createGlowSprite(0x00f2ff);
        glow.scale.set(35, 35, 1);
        glow.position.copy(ring.position);
        scene.add(glow);
        checkpoint.glow = glow;

        checkpoints.push(checkpoint);
    }
}

function updatePlayer(dt) {
    if (gameState !== 'RACING') return;

    // Normalize factor: at 60fps (dt ≈ 0.0166), deltaFactor ≈ 1.0
    const deltaFactor = dt * 60;

    // Movement logic
    if (keys['KeyW'] || keys['ArrowUp']) {
        playerCar.speed += playerCar.accel * deltaFactor;
    } else if (keys['KeyS'] || keys['ArrowDown']) {
        playerCar.speed -= playerCar.accel * 1.5 * deltaFactor;
    } else {
        // Framerate independent friction (approximate)
        playerCar.speed *= Math.pow(playerCar.friction, deltaFactor);
    }

    // Handbrake
    if (keys['Space']) playerCar.speed *= Math.pow(0.95, deltaFactor);

    playerCar.speed = Math.max(-0.2, Math.min(playerCar.speed, playerCar.maxSpeed));

    // Steering
    const steerLimit = 0.04 / (1 + playerCar.speed * 2);
    if (keys['KeyA'] || keys['ArrowLeft']) {
        playerCar.rotation += (playerCar.speed * steerLimit) * deltaFactor;
    }
    if (keys['KeyD'] || keys['ArrowRight']) {
        playerCar.rotation -= (playerCar.speed * steerLimit) * deltaFactor;
    }

    // Apply transformation
    playerCar.mesh.translateZ(playerCar.speed * deltaFactor);
    playerCar.mesh.rotation.y = playerCar.rotation;

    // Track progress for HUD/Position
    updateProgress(playerCar);

    // Update HUD
    document.getElementById('speed-value').innerText = Math.floor(playerCar.speed * 200);
    document.getElementById('lap-display').innerText = `LAP ${playerCar.lap}/${MAX_LAPS}`;
}

function updateAI(dt) {
    if (gameState !== 'RACING') return;

    const deltaFactor = dt * 60;

    aiCars.forEach((ai, index) => {
        // AI follows the spline
        ai.progress += (ai.speed * 0.001) * deltaFactor * (1 + Math.sin(clock.elapsedTime + index) * 0.1); 
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
        if (car.isPlayer) {
            // Check if all checkpoints were passed
            const missed = checkpoints.find(cp => !cp.passed);
            if (missed) {
                gameOver("CHECKPOINT MISSED!");
                return;
            }
            // Reset checkpoints for next lap
            checkpoints.forEach(cp => {
                cp.passed = false;
                cp.mesh.material.color.set(0x00f2ff);
                cp.mesh.material.emissive.set(0x00f2ff);
                cp.glow.visible = true;
            });
        }
        car.lap++;
        if (car.lap > MAX_LAPS && car.isPlayer) {
            finishRace(car);
        }
    }
    
    // Check checkpoint collection for player
    if (car.isPlayer) {
        checkpoints.forEach(cp => {
            if (!cp.passed) {
                const dist = car.mesh.position.distanceTo(cp.pos);
                if (dist < 15) { // Collection radius
                    cp.passed = true;
                    cp.mesh.material.color.set(0xffffff); // Turn white when passed
                    cp.mesh.material.emissive.set(0xffffff);
                    cp.glow.visible = false;
                }
            }
        });
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
    
    // Trigger a resize when the race starts to ensure canvas covers screen
    onWindowResize();

    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    console.log("Mobile controls check:", isMobile);
    if (isMobile) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }

    clock.start();
}

function gameOver(reason) {
    if (gameState === 'FINISHED') return;
    gameState = 'FINISHED';
    document.getElementById('ui-overlay').classList.remove('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('result-title').innerText = reason;
    document.getElementById('final-results').innerHTML = `<p style="color:red; font-size:1.2rem;">You failed to pass through all checkpoints!</p>`;
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
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === 0 || height === 0) return;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    
    let dt = clock.getDelta();
    if (dt > 0.1) dt = 0.1; // Limit spike
    
    // Pass dt to updates
    updatePlayer(dt);
    updateAI(dt);
    updateLeaderboard();
    updateSpeedLines();

    // Camera follow
    if (playerCar) {
        const speedFactor = playerCar.speed / playerCar.maxSpeed;
        
        // FOV: Reduced range to stop car from looking too far away (70 to 85)
        camera.fov = 70 + speedFactor * 15;
        
        // Camera offset: also reduced the "pull back" effect
        const offset = new THREE.Vector3(0, 4 + speedFactor * 1.5, -9 - speedFactor * 3); 
        offset.applyQuaternion(playerCar.mesh.quaternion);
        
        // Frame-rate independent lerp for camera smoothing
        const alpha = 1 - Math.pow(0.01, dt); 
        camera.position.lerp(playerCar.mesh.position.clone().add(offset), alpha);
        
        camera.lookAt(playerCar.mesh.position);
        camera.updateProjectionMatrix();

        // Subtle camera shake at high speed
        if (speedFactor > 0.8) {
            camera.position.x += (Math.random() - 0.5) * speedFactor * 0.05;
            camera.position.y += (Math.random() - 0.5) * speedFactor * 0.05;
        }
    }

    renderer.render(scene, camera);
}
