import * as THREE from 'three';

// --- Game Configuration ---
const CONFIG = {
    laneWidth: 10,
    numLanes: 3,
    initialSpeed: 0.5,
    speedIncrement: 0.0001,
    spawnFrequency: 120, // Frames
    obstacleChance: 0.7,
    colors: {
        background: 0x050510,
        car: 0x00ffff,
        trackLine: 0xff00ff,
        obstacle: 0xff0000,
        powerup: 0x00aaff,
        fog: 0x050510
    }
};

// --- Game Variables ---
let scene, camera, renderer, car;
let obstacles = [];
let powerups = [];
let clock = new THREE.Clock();
let score = 0;
let speed = CONFIG.initialSpeed;
let frameCount = 0;
let gameState = 'START'; // START, PLAYING, GAMEOVER
let currentLane = 0; // -1, 0, 1
let targetLanePos = 0;

// UI Elements
const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const finalScoreEl = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const uiOverlay = document.getElementById('ui-overlay');

// --- Initialization ---

function init() {
    // Scene & Fog
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.background);
    scene.fog = new THREE.Fog(CONFIG.colors.background, 20, 150);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 2, -10);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xff00ff, 2, 50);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // Track
    createTrack();

    // Car
    createCar();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', handleKeyDown);
    
    document.getElementById('start-button').onclick = startGame;
    document.getElementById('restart-button').onclick = startGame;
    
    // Mobile controls
    document.getElementById('left-btn').addEventListener('touchstart', (e) => { e.preventDefault(); moveCar(-1); });
    document.getElementById('right-btn').addEventListener('touchstart', (e) => { e.preventDefault(); moveCar(1); });

    animate();
}

function createTrack() {
    // Grid Helper for the "Cyber" look
    const size = 2000;
    const divisions = 200;
    const grid = new THREE.GridHelper(size, divisions, CONFIG.colors.trackLine, CONFIG.colors.trackLine);
    grid.position.y = 0;
    grid.position.z = -500;
    scene.add(grid);

    // Side walls or glow lines? Let's add glowing lines on edges
    for (let i = -1; i <= 1; i += 2) {
        const lineGeo = new THREE.BoxGeometry(0.5, 0.2, 2000);
        const lineMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.trackLine });
        const line = new THREE.Mesh(lineGeo, lineMat);
        line.position.set(i * (CONFIG.laneWidth * 1.5), 0.1, -500);
        scene.add(line);
    }
}

function createCar() {
    // A low-poly glowing wedge
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.ConeGeometry(1.2, 3, 4);
    const bodyMat = new THREE.MeshPhongMaterial({ 
        color: CONFIG.colors.car, 
        emissive: CONFIG.colors.car, 
        emissiveIntensity: 0.5,
        flatShading: true
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI / 2;
    body.rotation.y = Math.PI / 4;
    group.add(body);

    // "Engines" - blue glow at the back
    const engineGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const engineMat = new THREE.MeshBasicMaterial({ color: CONFIG.colors.powerup });
    
    const engineLeft = new THREE.Mesh(engineGeo, engineMat);
    engineLeft.position.set(-0.5, 0, 1.5);
    group.add(engineLeft);

    const engineRight = new THREE.Mesh(engineGeo, engineMat);
    engineRight.position.set(0.5, 0, 1.5);
    group.add(engineRight);

    car = group;
    car.position.set(0, 0.8, 0);
    scene.add(car);
}

// --- Game Logic ---

function startGame() {
    // Reset variables
    score = 0;
    speed = CONFIG.initialSpeed;
    frameCount = 0;
    currentLane = 0;
    targetLanePos = 0;
    car.position.x = 0;

    // Clear old obstacles
    obstacles.forEach(o => scene.remove(o));
    powerups.forEach(p => scene.remove(p));
    obstacles = [];
    powerups = [];

    // UI
    uiOverlay.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    gameState = 'PLAYING';
}

function gameOver() {
    gameState = 'GAMEOVER';
    uiOverlay.classList.remove('hidden');
    gameOverScreen.classList.remove('hidden');
    finalScoreEl.innerText = Math.floor(score);
}

function handleKeyDown(e) {
    if (gameState !== 'PLAYING') return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') moveCar(-1);
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') moveCar(1);
}

function moveCar(dir) {
    currentLane += dir;
    if (currentLane < -1) currentLane = -1;
    if (currentLane > 1) currentLane = 1;
    targetLanePos = currentLane * CONFIG.laneWidth;
}

function spawnObject() {
    const isObstacle = Math.random() < CONFIG.obstacleChance;
    const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
    
    if (isObstacle) {
        const geo = new THREE.BoxGeometry(2, 2, 2);
        const mat = new THREE.MeshPhongMaterial({ 
            color: CONFIG.colors.obstacle, 
            emissive: CONFIG.colors.obstacle,
            emissiveIntensity: 0.5
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(lane * CONFIG.laneWidth, 1, -100);
        scene.add(mesh);
        obstacles.push(mesh);
    } else {
        const geo = new THREE.IcosahedronGeometry(1);
        const mat = new THREE.MeshPhongMaterial({ 
            color: CONFIG.colors.powerup, 
            emissive: CONFIG.colors.powerup,
            emissiveIntensity: 0.8
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(lane * CONFIG.laneWidth, 1, -100);
        scene.add(mesh);
        powerups.push(mesh);
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Increase speed and score
    speed += CONFIG.speedIncrement;
    score += speed;
    
    scoreEl.innerText = Math.floor(score);
    speedEl.innerText = Math.floor(speed * 200);

    // Smooth lane transition
    car.position.x = THREE.MathUtils.lerp(car.position.x, targetLanePos, 0.15);
    car.rotation.z = (car.position.x - targetLanePos) * 0.05; // Tilt when moving

    // Spawn objects
    frameCount++;
    if (frameCount % Math.max(20, Math.floor(CONFIG.spawnFrequency / (speed * 2))) === 0) {
        spawnObject();
    }

    // Move and collide obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.position.z += speed;
        o.rotation.x += 0.02;
        o.rotation.y += 0.02;

        // Collision detection
        if (Math.abs(o.position.z - car.position.z) < 1.5 && Math.abs(o.position.x - car.position.x) < 2) {
            gameOver();
        }

        if (o.position.z > 20) {
            scene.remove(o);
            obstacles.splice(i, 1);
        }
    }

    // Move and collide powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];
        p.position.z += speed;
        p.rotation.y += 0.05;

        // Collection detection
        if (Math.abs(p.position.z - car.position.z) < 1.5 && Math.abs(p.position.x - car.position.x) < 2) {
            score += 500;
            scene.remove(p);
            powerups.splice(i, 1);
            // Flash HUD or something?
            scoreEl.style.color = '#fff';
            setTimeout(() => scoreEl.style.color = '', 200);
        }

        if (p.position.z > 20) {
            scene.remove(p);
            powerups.splice(i, 1);
        }
    }

    // Animate scene elements to look moving
    // In this simplified version, we move objects. 
    // To make the grid look infinite, we could offset its texture or position.
    scene.children.forEach(child => {
        if (child.type === 'GridHelper' || child.geometry?.type === 'BoxGeometry' && child.position.z < -400) {
           // Infinite grid logic (simplified: it just stays there and we move objects)
        }
    });
}

function animate() {
    requestAnimationFrame(animate);
    update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Start
init();
