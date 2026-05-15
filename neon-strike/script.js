import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { PointerLockControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// --- CONFIG ---
const ARENA_SIZE = 100;
const WALL_HEIGHT = 10;
const PLAYER_SPEED = 15;
const ENEMY_SPEED = 8;
const SPAWN_RATE = 2000; // ms
const MAX_ENEMIES = 20;

// --- GLOBALS ---
let scene, camera, renderer, controls;
let player = { health: 100, score: 0, ammo: 20 };
let enemies = [];
let bullets = [];
let lastTime = 0;
let spawnTimer = 0;
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

function init() {
    console.log('Neon Strike Init');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 20, 80);

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Floor (Grid)
    const gridHelper = new THREE.GridHelper(ARENA_SIZE, 20, 0x00ffcc, 0x004444);
    scene.add(gridHelper);

    const floorGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    scene.add(floor);

    // Walls (Neon Borders)
    const wallGeo = new THREE.BoxGeometry(ARENA_SIZE, WALL_HEIGHT, 2);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0066, emissiveIntensity: 0.5 });
    
    const wall1 = new THREE.Mesh(wallGeo, wallMat);
    wall1.position.set(0, WALL_HEIGHT/2, -ARENA_SIZE/2);
    scene.add(wall1);

    const wall2 = new THREE.Mesh(wallGeo, wallMat);
    wall2.position.set(0, WALL_HEIGHT/2, ARENA_SIZE/2);
    scene.add(wall2);

    const wall3 = new THREE.Mesh(wallGeo, wallMat);
    wall3.rotation.y = Math.PI / 2;
    wall3.position.set(-ARENA_SIZE/2, WALL_HEIGHT/2, 0);
    scene.add(wall3);

    const wall4 = new THREE.Mesh(wallGeo, wallMat);
    wall4.rotation.y = Math.PI / 2;
    wall4.position.set(ARENA_SIZE/2, WALL_HEIGHT/2, 0);
    scene.add(wall4);

    // Controls
    controls = new PointerLockControls(camera, document.body);
    
    document.getElementById('start-btn').addEventListener('click', () => {
        controls.lock();
        startGame();
    });

    controls.addEventListener('lock', () => {
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        gameState = 'PLAYING';
    });

    controls.addEventListener('unlock', () => {
        if (gameState === 'PLAYING') {
            // Pause logic if needed
        }
    });

    // Movement Keys
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward = true; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft = true; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward = true; break;
            case 'ArrowRight':
            case 'KeyD': moveRight = true; break;
        }
    };

    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW': moveForward = false; break;
            case 'ArrowLeft':
            case 'KeyA': moveLeft = false; break;
            case 'ArrowDown':
            case 'KeyS': moveBackward = false; break;
            case 'ArrowRight':
            case 'KeyD': moveRight = false; break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // Shooting
    document.addEventListener('mousedown', (e) => {
        if (gameState === 'PLAYING' && controls.isLocked && e.button === 0) {
            shoot();
        }
    });

    // Restart
    document.getElementById('restart-btn').addEventListener('click', () => {
        controls.lock();
        startGame();
    });

    // Resize
    window.addEventListener('resize', onWindowResize);

    animate(0);
}

// --- GAME LOGIC ---
function startGame() {
    gameState = 'PLAYING';
    player.health = 100;
    player.score = 0;
    player.ammo = 20;
    updateHUD();
    
    // Clear enemies
    enemies.forEach(e => scene.remove(e.mesh));
    enemies = [];
    
    camera.position.set(0, 2, 0);
    camera.rotation.set(0, 0, 0);
}

function shoot() {
    if (player.ammo <= 0) return;
    player.ammo--;
    updateHUD();

    // Create bullet
    const bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    
    bullet.position.copy(camera.position);
    bullet.quaternion.copy(camera.quaternion);
    
    // Direction
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(camera.quaternion);
    
    scene.add(bullet);
    bullets.push({ mesh: bullet, velocity: direction.multiplyScalar(50), life: 2.0 });
}

function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;

    const enemyGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const enemyMat = new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0066, emissiveIntensity: 0.5 });
    const enemy = new THREE.Mesh(enemyGeo, enemyMat);
    
    // Spawn at random edge
    const angle = Math.random() * Math.PI * 2;
    const radius = ARENA_SIZE / 2 - 5;
    enemy.position.set(Math.cos(angle) * radius, 1, Math.sin(angle) * radius);
    
    scene.add(enemy);
    enemies.push({ mesh: enemy, speed: ENEMY_SPEED });
}

function updatePlayerMovement(dt) {
    const velocity = new THREE.Vector3();
    const direction = new THREE.Vector3();

    direction.z = Number(moveForward) - Number(moveBackward);
    direction.x = Number(moveRight) - Number(moveLeft);
    direction.normalize();

    if (moveForward || moveBackward) velocity.z -= direction.z * PLAYER_SPEED * dt;
    if (moveLeft || moveRight) velocity.x -= direction.x * PLAYER_SPEED * dt;

    controls.moveRight(velocity.x);
    controls.moveForward(velocity.z);
    
    // Keep player inside arena
    camera.position.x = Math.max(-ARENA_SIZE/2 + 2, Math.min(ARENA_SIZE/2 - 2, camera.position.x));
    camera.position.z = Math.max(-ARENA_SIZE/2 + 2, Math.min(ARENA_SIZE/2 - 2, camera.position.z));
}

function updateEnemies(dt) {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const mesh = enemy.mesh;
        
        // Move towards player
        const direction = new THREE.Vector3();
        direction.subVectors(camera.position, mesh.position).normalize();
        mesh.position.add(direction.multiplyScalar(enemy.speed * dt));
        mesh.lookAt(camera.position);
        
        // Collision with player
        if (mesh.position.distanceTo(camera.position) < 2) {
            player.health -= 10;
            updateHUD();
            scene.remove(mesh);
            enemies.splice(i, 1);
            
            if (player.health <= 0) {
                gameOver();
            }
        }
    }
}

function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(dt));
        bullet.life -= dt;
        
        // Check collision with enemies
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (bullet.mesh.position.distanceTo(enemies[j].mesh.position) < 1.5) {
                scene.remove(enemies[j].mesh);
                enemies.splice(j, 1);
                hit = true;
                player.score += 100;
                player.ammo += 5; // Reload bonus
                updateHUD();
                break;
            }
        }
        
        if (hit || bullet.life <= 0) {
            scene.remove(bullet.mesh);
            bullets.splice(i, 1);
        }
    }
}

function updateHUD() {
    document.getElementById('health-bar').style.width = `${player.health}%`;
    document.getElementById('score').innerText = `Score: ${player.score}`;
    document.getElementById('ammo').innerText = `Ammo: ${player.ammo} / ∞`;
}

function gameOver() {
    gameState = 'GAMEOVER';
    controls.unlock();
    document.getElementById('final-score').innerText = `Score: ${player.score}`;
    document.getElementById('game-over-screen').classList.remove('hidden');
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

    if (gameState === 'PLAYING') {
        updatePlayerMovement(dt);
        
        spawnTimer += dt * 1000;
        if (spawnTimer > SPAWN_RATE) {
            spawnEnemy();
            spawnTimer = 0;
        }
        
        updateEnemies(dt);
        updateBullets(dt);
    }

    renderer.render(scene, camera);
}
