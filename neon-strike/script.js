import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

// --- CONFIG ---
const ARENA_SIZE = 80;
const WALL_HEIGHT = 8;
const PLAYER_SPEED = 12;
const ENEMY_SPEED = 3;
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
    scene.background = new THREE.Color(0x1a1510);
    scene.fog = new THREE.Fog(0x1a1510, 20, 70);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 1.7, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Warm lighting
    scene.add(new THREE.AmbientLight(0xffeedd, 0.6));
    const mainLight = new THREE.PointLight(0xffaa44, 2, 60);
    mainLight.position.set(0, WALL_HEIGHT - 1, 0);
    scene.add(mainLight);
    const spot1 = new THREE.SpotLight(0xffcc88, 1.5, 50, Math.PI/4);
    spot1.position.set(-20, WALL_HEIGHT, -20); scene.add(spot1);
    const spot2 = new THREE.SpotLight(0xffcc88, 1.5, 50, Math.PI/4);
    spot2.position.set(20, WALL_HEIGHT, 20); scene.add(spot2);

    // Floor
    // Terrazzo marble floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), new THREE.MeshStandardMaterial({ color: 0xc8b89a, roughness: 0.3, metalness: 0.1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);

    // Walls
    // Cream/beige walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.7 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xc5a55a, metalness: 0.8, roughness: 0.3 });
    const wGeo = new THREE.BoxGeometry(ARENA_SIZE, WALL_HEIGHT, 1.5);
    const w1 = new THREE.Mesh(wGeo, wallMat); w1.position.set(0, WALL_HEIGHT/2, -ARENA_SIZE/2); scene.add(w1);
    const w2 = new THREE.Mesh(wGeo, wallMat); w2.position.set(0, WALL_HEIGHT/2, ARENA_SIZE/2); scene.add(w2);
    const w3 = new THREE.Mesh(wGeo, wallMat); w3.rotation.y = Math.PI/2; w3.position.set(-ARENA_SIZE/2, WALL_HEIGHT/2, 0); scene.add(w3);
    const w4 = new THREE.Mesh(wGeo, wallMat); w4.rotation.y = Math.PI/2; w4.position.set(ARENA_SIZE/2, WALL_HEIGHT/2, 0); scene.add(w4);
    
    // Gold trim
    const trimGeo = new THREE.BoxGeometry(ARENA_SIZE, 0.3, 0.6);
    const t1 = new THREE.Mesh(trimGeo, goldMat); t1.position.set(0, WALL_HEIGHT, -ARENA_SIZE/2); scene.add(t1);
    const t2 = new THREE.Mesh(trimGeo, goldMat); t2.position.set(0, WALL_HEIGHT, ARENA_SIZE/2); scene.add(t2);
    const t3 = new THREE.Mesh(trimGeo, goldMat); t3.rotation.y = Math.PI/2; t3.position.set(-ARENA_SIZE/2, WALL_HEIGHT, 0); scene.add(t3);
    const t4 = new THREE.Mesh(trimGeo, goldMat); t4.rotation.y = Math.PI/2; t4.position.set(ARENA_SIZE/2, WALL_HEIGHT, 0); scene.add(t4);
    
    // Columns
    const colGeo = new THREE.CylinderGeometry(0.5, 0.5, WALL_HEIGHT, 12);
    const colMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.4 });
    for (let i = -2; i <= 2; i++) {
        const c1 = new THREE.Mesh(colGeo, colMat); c1.position.set(i*15, WALL_HEIGHT/2, -ARENA_SIZE/2+1); scene.add(c1);
        const c2 = new THREE.Mesh(colGeo, colMat); c2.position.set(i*15, WALL_HEIGHT/2, ARENA_SIZE/2-1); scene.add(c2);
    }
    
    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE), new THREE.MeshStandardMaterial({ color: 0x2a2520 }));
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_HEIGHT;
    scene.add(ceil);
    
    // Benches
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8 });
    for (let i = -1; i <= 1; i++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 1.5), benchMat);
        seat.position.set(i*20, 0.8, -ARENA_SIZE/2+4); scene.add(seat);
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 1.5), benchMat);
        leg1.position.set(i*20-1.5, 0.4, -ARENA_SIZE/2+4); scene.add(leg1);
        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 1.5), benchMat);
        leg2.position.set(i*20+1.5, 0.4, -ARENA_SIZE/2+4); scene.add(leg2);
    }
    
    // Information booth
    const boothMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7 });
    const booth = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 3), boothMat);
    booth.position.set(0, 1.5, 0); scene.add(booth);
    const boothTop = new THREE.Mesh(new THREE.BoxGeometry(7, 0.3, 4), goldMat);
    boothTop.position.set(0, 3.15, 0); scene.add(boothTop);

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
        player.yaw -= e.movementX * 0.002;
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
    
    // Create zombie group
    const zombie = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a7a5a, roughness: 0.8 });
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.9 });
    
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), clothMat);
    body.position.y = 1.2;
    zombie.add(body);
    
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), skinMat);
    head.position.y = 1.9;
    zombie.add(head);
    
    // Left arm (hanging)
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), skinMat);
    lArm.position.set(-0.55, 1.0, 0);
    lArm.rotation.x = 0.3;
    zombie.add(lArm);
    
    // Right arm (reaching forward)
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), skinMat);
    rArm.position.set(0.55, 1.0, 0.2);
    rArm.rotation.x = -0.5;
    zombie.add(rArm);
    
    // Left leg
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), clothMat);
    lLeg.position.set(-0.2, 0.4, 0);
    zombie.add(lLeg);
    
    // Right leg
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), clothMat);
    rLeg.position.set(0.2, 0.4, 0);
    zombie.add(rLeg);
    
    zombie.position.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);
    scene.add(zombie);
    enemies.push({ mesh: zombie });
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
        // Use camera's actual forward/right vectors for bulletproof POV movement
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();
        
        camera.position.addScaledVector(forward, forwardInput * PLAYER_SPEED * dt);
        camera.position.addScaledVector(right, rightInput * PLAYER_SPEED * dt);
        
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
        
        // Zombie stagger animation
        const t = Date.now() * 0.003;
        if (e.mesh.children.length >= 6) {
            // Legs sway
            e.mesh.children[4].rotation.x = Math.sin(t) * 0.3;
            e.mesh.children[5].rotation.x = Math.sin(t + Math.PI) * 0.3;
            // Arms sway
            e.mesh.children[2].rotation.z = Math.sin(t * 0.8) * 0.2;
            e.mesh.children[3].rotation.z = Math.sin(t * 0.8 + Math.PI) * 0.2;
        }
        
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
