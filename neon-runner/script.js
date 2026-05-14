import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const LANE_WIDTH = 4;
const LANE_POSITIONS = [-LANE_WIDTH, 0, LANE_WIDTH];
const OBSTACLE_SPEED_BASE = 0.3;
const SPAWN_DISTANCE = 100;
const DESPAWN_DISTANCE = 10;
const GRID_SIZE = 200;
const GRID_DIVISIONS = 40;

let scene, camera, renderer;
let player, playerLane = 1;
let obstacles = [];
let gridHelper;
let score = 0;
let gameState = 'MENU';
let speed = OBSTACLE_SPEED_BASE;
let lastTime = 0;
let touchStartX = 0;
let spawnTimer = 0;

export function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.Fog(0x000000, 20, SPAWN_DISTANCE);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, -10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('game-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, 0x00ffcc, 0x004444);
    gridHelper.position.y = -1;
    scene.add(gridHelper);

    const playerGeo = new THREE.BoxGeometry(2, 2, 2);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.5 });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(LANE_POSITIONS[playerLane], 0, 0);
    scene.add(player);

    document.addEventListener('keydown', (e) => {
        if (gameState !== 'RUNNING') return;
        if (e.key === 'ArrowLeft' && playerLane > 0) playerLane--;
        if (e.key === 'ArrowRight' && playerLane < 2) playerLane++;
    });

    document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    document.addEventListener('touchend', (e) => {
        if (gameState !== 'RUNNING') return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (dx > 30 && playerLane < 2) playerLane++;
        if (dx < -30 && playerLane > 0) playerLane--;
    });

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('restart-btn').addEventListener('click', resetGame);
    window.addEventListener('resize', onWindowResize);

    animate(0);
}

function startGame() {
    gameState = 'RUNNING';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    score = 0;
    speed = OBSTACLE_SPEED_BASE;
    spawnTimer = 0;
    obstacles.forEach(obs => scene.remove(obs));
    obstacles = [];
    playerLane = 1;
    player.position.set(LANE_POSITIONS[playerLane], 0, 0);
}

function resetGame() {
    document.getElementById('game-over-screen').style.display = 'none';
    startGame();
}

function gameOver() {
    gameState = 'GAMEOVER';
    document.getElementById('final-score').innerText = Math.floor(score);
    document.getElementById('game-over-screen').style.display = 'flex';
}

function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0066, emissiveIntensity: 0.5 });
    const obs = new THREE.Mesh(geo, mat);
    obs.position.set(LANE_POSITIONS[lane], 0, -SPAWN_DISTANCE);
    obs.userData.lane = lane;
    scene.add(obs);
    obstacles.push(obs);
}

function updatePlayer(dt) {
    const targetX = LANE_POSITIONS[playerLane];
    player.position.x += (targetX - player.position.x) * 10 * dt;
    player.rotation.y = (player.position.x - targetX) * 0.1;
    player.rotation.x += 5 * dt;
}

function updateObstacles(dt) {
    spawnTimer += dt;
    const spawnRate = 1.0 - Math.min(score / 1000, 0.7);
    if (spawnTimer > spawnRate) {
        spawnObstacle();
        spawnTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.position.z += speed * 60 * dt;

        if (Math.abs(obs.position.z - player.position.z) < 1.5 && obs.userData.lane === playerLane) {
            gameOver();
        }

        if (obs.position.z > DESPAWN_DISTANCE) {
            scene.remove(obs);
            obstacles.splice(i, 1);
        }
    }
}

function updateGrid(dt) {
    gridHelper.position.z += speed * 60 * dt;
    if (gridHelper.position.z > 10) gridHelper.position.z = 0;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(timestamp = 0) {
    requestAnimationFrame(animate);
    const dt = lastTime ? (timestamp - lastTime) / 1000 : 1 / 60;
    lastTime = timestamp;

    if (gameState === 'RUNNING') {
        updatePlayer(dt);
        updateObstacles(dt);
        updateGrid(dt);
        score += dt * 10;
        document.getElementById('score').innerText = Math.floor(score);
    }

    renderer.render(scene, camera);
}

init();