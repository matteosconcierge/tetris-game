// Three.js City Drive 3D
let scene, camera, renderer, clock;
let player, car, isDriving = false;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let carSpeed = 0, carRotation = 0;
const keys = {};

// Mobile state
let joystickActive = false;
let joystickDir = { x: 0, y: 0 };

init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 20, 100);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    clock = new THREE.Clock();

    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(1000, 1000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // City Building Blocks
    for (let x = -100; x <= 100; x += 40) {
        for (let z = -100; z <= 100; z += 40) {
            if (x === 0 && z === 0) continue;
            createBuildingBlock(x, z);
        }
    }

    // Player (Walking mode)
    const playerGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    player = new THREE.Mesh(playerGeo, playerMat);
    player.position.set(0, 1, 5);
    player.castShadow = true;
    scene.add(player);

    // Car
    createCar();

    // Input
    window.addEventListener('keydown', e => { keys[e.code] = true; if(e.code === 'KeyF') toggleDrive(); });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    
    // Mobile Controls
    const enterBtn = document.getElementById('enter-btn');
    enterBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleDrive(); });

    const joystickEl = document.getElementById('move-joystick');
    joystickEl.addEventListener('touchstart', onJoystickStart, {passive: false});
    joystickEl.addEventListener('touchmove', onJoystickMove, {passive: false});
    joystickEl.addEventListener('touchend', onJoystickEnd);

    window.addEventListener('resize', onWindowResize, false);
}

function createBuildingBlock(x, z) {
    const size = 15;
    const height = 10 + Math.random() * 30;
    const geo = new THREE.BoxGeometry(size, height, size);
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const b = new THREE.Mesh(geo, mat);
    b.position.set(x, height / 2, z);
    b.castShadow = true;
    b.receiveShadow = true;
    scene.add(b);

    // Windows
    const windowGeo = new THREE.PlaneGeometry(1, 1);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    for(let i=0; i<5; i++) {
        const w = new THREE.Mesh(windowGeo, windowMat);
        w.position.set(x + size/2 + 0.1, Math.random() * height, z + (Math.random() - 0.5) * size);
        w.rotation.y = Math.PI / 2;
        scene.add(w);
    }
}

function createCar() {
    car = new THREE.Group();
    
    // Body
    const bodyGeo = new THREE.BoxGeometry(2, 0.6, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    car.add(body);

    // Roof
    const roofGeo = new THREE.BoxGeometry(1.5, 0.8, 2);
    const roof = new THREE.Mesh(roofGeo, bodyMat);
    roof.position.y = 1.2;
    car.add(roof);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const wheelPos = [[-1, 0.4, 1.5], [1, 0.4, 1.5], [-1, 0.4, -1.5], [1, 0.4, -1.5]];
    wheelPos.forEach(p => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(...p);
        w.rotation.z = Math.PI / 2;
        car.add(w);
    });

    car.position.set(10, 0, 10);
    scene.add(car);
}

function toggleDrive() {
    const dist = player.position.distanceTo(car.position);
    if (!isDriving && dist < 5) {
        isDriving = true;
        player.visible = false;
        document.getElementById('status').innerText = 'Driving';
        document.getElementById('enter-btn').innerText = 'EXIT';
    } else if (isDriving) {
        isDriving = false;
        player.visible = true;
        player.position.copy(car.position).add(new THREE.Vector3(3, 1, 0));
        document.getElementById('status').innerText = 'Walking';
        document.getElementById('enter-btn').innerText = 'ENTER';
    }
}

// Joystick logic
function onJoystickStart(e) { joystickActive = true; onJoystickMove(e); }
function onJoystickMove(e) {
    if(!joystickActive) return;
    const rect = e.target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const touch = e.touches[0];
    joystickDir.x = (touch.clientX - centerX) / (rect.width / 2);
    joystickDir.y = (touch.clientY - centerY) / (rect.height / 2);
    // Clamp
    const mag = Math.sqrt(joystickDir.x**2 + joystickDir.y**2);
    if(mag > 1) { joystickDir.x /= mag; joystickDir.y /= mag; }
    e.preventDefault();
}
function onJoystickEnd() { joystickActive = false; joystickDir = {x:0, y:0}; }

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (isDriving) {
        updateCar(delta);
    } else {
        updatePlayer(delta);
    }

    renderer.render(scene, camera);
}

function updatePlayer(delta) {
    const speed = 10;
    const rotSpeed = 3;
    
    // Keyboard
    if (keys['KeyW'] || joystickDir.y < -0.2) {
        player.translateZ(-speed * delta);
    }
    if (keys['KeyS'] || joystickDir.y > 0.2) {
        player.translateZ(speed * delta);
    }
    if (keys['KeyA'] || joystickDir.x < -0.2) {
        player.rotation.y += rotSpeed * delta;
    }
    if (keys['KeyD'] || joystickDir.x > 0.2) {
        player.rotation.y -= rotSpeed * delta;
    }

    // Camera follow player
    const camOffset = new THREE.Vector3(0, 5, 10).applyQuaternion(player.quaternion);
    camera.position.lerp(player.position.clone().add(camOffset), 0.1);
    camera.lookAt(player.position);
}

function updateCar(delta) {
    const accel = 20;
    const friction = 10;
    const maxSpeed = 50;
    
    // Steering
    if (Math.abs(carSpeed) > 1) {
        const turnDir = carSpeed > 0 ? 1 : -1;
        if (keys['KeyA'] || joystickDir.x < -0.2) carRotation += 2 * delta * turnDir;
        if (keys['KeyD'] || joystickDir.x > 0.2) carRotation -= 2 * delta * turnDir;
    }

    car.rotation.y = carRotation;

    // Throttle
    if (keys['KeyW'] || joystickDir.y < -0.2) {
        carSpeed += accel * delta;
    } else if (keys['KeyS'] || joystickDir.y > 0.2) {
        carSpeed -= accel * delta;
    } else {
        // Friction
        if (carSpeed > 0) carSpeed = Math.max(0, carSpeed - friction * delta);
        if (carSpeed < 0) carSpeed = Math.min(0, carSpeed + friction * delta);
    }

    carSpeed = Math.max(-maxSpeed/2, Math.min(maxSpeed, carSpeed));
    
    car.translateZ(carSpeed * delta);
    document.getElementById('speed').innerText = `Speed: ${Math.round(Math.abs(carSpeed))} km/h`;

    // Camera follow car
    const camOffset = new THREE.Vector3(0, 10, 20).applyQuaternion(car.quaternion);
    camera.position.lerp(car.position.clone().add(camOffset), 0.1);
    camera.lookAt(car.position);
}
