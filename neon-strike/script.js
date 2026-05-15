import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// --- CONFIG ---
const ARENA_SIZE = 80;
const WALL_HEIGHT = 8;
const PLAYER_SPEED = 12;
const ENEMY_SPEED = 5;
const SPAWN_RATE = 1500;
const MAX_ENEMIES = 15;

// --- GLOBALS ---
let scene, camera, renderer;
let player = { health: 100, score: 0, ammo: 20, yaw: 0, pitch: 0 };
let enemies = [];
let bullets = [];
let lastTime = 0;
let spawnTimer = 0;
let gameState = 'MENU';
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let isLocked = false;

// --- INIT ---
document.addEventListener('DOMContentLoaded', init);

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x050505, 15, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 1.7, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('game-container').appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Floor
    const grid = new THREE.GridHelper(ARENA_SIZE, 20, 0x00ffcc, 0x004444);
    scene.add(grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0066, emissiveIntensity: 0.6 });
    const wGeo = new THREE.BoxGeometry(ARENA_SIZE, WALL_HEIGHT, 1);
    const w1 = new THREE.Mesh(wGeo, wallMat); w1.position.set(0, WALL_HEIGHT/2, -ARENA_SIZE/2); scene.add(w1);
    const w2 = new THREE.Mesh(wGeo, wallMat); w2.position.set(0, WALL_HEIGHT/2, ARENA_SIZE/2); scene.add(w2);
    const w3 = new THREE.Mesh(wGeo, wallMat); w3.rotation.y = Math.PI/2; w3.position.set(-ARENA_SIZE/2, WALL_HEIGHT/2, 0); scene.add(w3);
    const w4 = new THREE.Mesh(wGeo, wallMat); w4.rotation.y = Math.PI/2; w4.position.set(ARENA_SIZE/2, WALL_HEIGHT/2, 0); scene.add(w4);

    // Controls
    const canvas = renderer.domElement;
    
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
        canvas.requestPointerLock();
    });
    
    canvas.addEventListener('click', () => {
        if (gameState === 'PLAYING') {
            shoot();
        }
    });

    document.addEventListener('pointerlockchange', () => {
        isLocked = document.pointerLockElement === canvas;
        if (isLocked) {
            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('game-over-screen').classList.add('hidden');
            if (gameState !== 'PLAYING') startGame();
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (!isLocked || gameState !== 'PLAYING') return;
        player.yaw += e.movementX * 0.002;
        player.pitch -= e.movementY * 0.002;
        player.pitch = Math.max(-Math.PI/2.2, Math.min(Math.PI/2.2, player.pitch));
    });

    document.addEventListener('keydown', (e) => {
        switch(e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyD': moveRight = true; break;
        }
    });
    document.addEventListener('keyup', (e) => {
        switch(e.code) {
            case 'KeyW': moveForward = false; break;
            case 'KeyS': moveBackward = false; break;
            case 'KeyA': moveLeft = false; break;
            case 'KeyD': moveRight = false; break;
        }
    });

    document.getElementById('restart-btn').addEventListener('click', () => {
        canvas.requestPointerLock();
    });

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    animate(0);
}

function startGame() {
    gameState = 'PLAYING';
    player.health = 100;
    player.score = 0;
    player.ammo = 20;
    player.yaw = 0;
    player.pitch = 0;
    camera.position.set(0, 1.7, 0);
    enemies.forEach(e => scene.remove(e.mesh));
    enemies = [];
    bullets.forEach(b => scene.remove(b.mesh));
    bullets = [];
    updateHUD();
}

function shoot() {
    if (player.ammo <= 0) return;
    player.ammo--;
    updateHUD();

    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(player.pitch, player.yaw, 0, 'YXZ'));
    
    const bullet = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0x00ffcc }));
    bullet.position.copy(camera.position);
    scene.add(bullet);
    bullets.push({ mesh: bullet, vel: dir.multiplyScalar(40), life: 2.0 });
}

function spawnEnemy() {
    if (enemies.length >= MAX_ENEMIES) return;
    const angle = Math.random() * Math.PI * 2;
    const r = ARENA_SIZE / 2 - 3;
    const enemy = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ color: 0xff0066, emissive: 0xff0066, emissiveIntensity: 0.5 }));
    enemy.position.set(Math.cos(angle) * r, 0.75, Math.sin(angle) * r);
    scene.add(enemy);
    enemies.push({ mesh: enemy });
}

function update(dt) {
    if (gameState !== 'PLAYING') return;

    // Camera rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch;

    // Movement relative to player POV
    const forwardInput = Number(moveForward) - Number(moveBackward);
    const rightInput = Number(moveRight) - Number(moveLeft);
    
    if (forwardInput !== 0 || rightInput !== 0) {
        const sin = Math.sin(player.yaw);
        const cos = Math.cos(player.yaw);
        
        // Forward direction: (sin(yaw), 0, -cos(yaw))
        // Right direction: (cos(yaw), 0, sin(yaw))
        const dx = (forwardInput * sin + rightInput * cos) * PLAYER_SPEED * dt;
        const dz = (-forwardInput * cos + rightInput * sin) * PLAYER_SPEED * dt;
        
        camera.position.x += dx;
        camera.position.z += dz;
        
        // Clamp to arena
        camera.position.x = Math.max(-ARENA_SIZE/2 + 2, Math.min(ARENA_SIZE/2 - 2, camera.position.x));
        camera.position.z = Math.max(-ARENA_SIZE/2 + 2, Math.min(ARENA_SIZE/2 - 2, camera.position.z));
    }

    // Enemies
    spawnTimer += dt * 1000;
    if (spawnTimer > SPAWN_RATE) { spawnEnemy(); spawnTimer = 0; }

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const d = new THREE.Vector3().subVectors(camera.position, e.mesh.position).normalize();
        e.mesh.position.add(d.multiplyScalar(ENEMY_SPEED * dt));
        e.mesh.lookAt(camera.position);
        
        if (e.mesh.position.distanceTo(camera.position) < 1.5) {
            player.health -= 15;
            updateHUD();
            scene.remove(e.mesh);
            enemies.splice(i, 1);
            if (player.health <= 0) gameOver();
        }
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.add(b.vel.clone().multiplyScalar(dt));
        b.life -= dt;
        
        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (b.mesh.position.distanceTo(enemies[j].mesh.position) < 1.5) {
                scene.remove(enemies[j].mesh);
                enemies.splice(j, 1);
                hit = true;
                player.score += 100;
                player.ammo += 5;
                updateHUD();
                break;
            }
        }
        
        if (hit || b.life <= 0) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        }
    }
}

function updateHUD() {
    document.getElementById('health-bar').style.width = `${player.health}%`;
    document.getElementById('score').innerText = `Score: ${player.score}`;
    document.getElementById('ammo').innerText = `Ammo: ${player.ammo}`;
}

function gameOver() {
    gameState = 'GAMEOVER';
    document.exitPointerLock();
    document.getElementById('final-score').innerText = `Score: ${player.score}`;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

function animate(t = 0) {
    requestAnimationFrame(animate);
    const dt = lastTime ? (t - lastTime)/1000 : 1/60;
    lastTime = t;
    update(dt);
    renderer.render(scene, camera);
}
