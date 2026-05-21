// ============================================================
// COSMOCLASM - Neon Asteroids
// Full game: player ship, asteroids, waves, particles, scoring
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = () => canvas.width;
const H = () => canvas.height;

let dpr = 1;

function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---- DOM refs ----
const scoreEl = document.getElementById('scoreDisplay');
const waveEl = document.getElementById('waveDisplay');
const livesEl = document.getElementById('livesDisplay');
const highScoreEl = document.getElementById('highScoreDisplay');
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const finalScoreEl = document.getElementById('finalScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const mobileControls = document.getElementById('mobile-controls');
const joystickArea = document.getElementById('joystick-area');
const joystickKnob = document.getElementById('joystick-knob');
const fireBtn = document.getElementById('fire-btn');
const boostBtn = document.getElementById('boost-btn');

// ---- Game state ----
let gameRunning = false;
let score = 0;
let wave = 1;
let lives = 3;
let highScore = parseInt(localStorage.getItem('cosmoclasm_high') || '0');
highScoreEl.textContent = highScore.toLocaleString();

// ---- Input ----
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === ' ') e.preventDefault();
});
document.addEventListener('keyup', e => {
    keys[e.key.toLowerCase()] = false;
});

// ---- Touch state ----
const touch = { dx: 0, dy: 0, active: false, fire: false, boost: false };
let joystickTouchId = null;
let fireTouchId = null;
let boostTouchId = null;

// ---- GameObject classes ----
class Vec2 {
    constructor(x, y) { this.x = x; this.y = y; }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vec2(this.x * s, this.y * s); }
    len() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    norm() { const l = this.len(); return l > 0 ? this.scale(1 / l) : new Vec2(0, 0); }
    dot(v) { return this.x * v.x + this.y * v.y; }
    rotate(a) {
        const c = Math.cos(a), s = Math.sin(a);
        return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
    }
    angle() { return Math.atan2(this.y, this.x); }
}

function wrap(v) {
    const margin = 40;
    if (v.x < -margin) v.x = W() + margin;
    if (v.x > W() + margin) v.x = -margin;
    if (v.y < -margin) v.y = H() + margin;
    if (v.y > H() + margin) v.y = -margin;
    return v;
}

// ---- Stars ----
let stars = [];
function initStars() {
    stars = [];
    for (let i = 0; i < 250; i++) {
        stars.push({
            x: Math.random() * W(),
            y: Math.random() * H(),
            size: Math.random() * 1.5 + 0.3,
            speed: Math.random() * 0.3 + 0.05,
            brightness: Math.random() * 0.5 + 0.5
        });
    }
}

function drawStars() {
    for (const s of stars) {
        const twinkle = 0.7 + 0.3 * Math.sin(Date.now() * 0.002 * s.brightness + s.x);
        ctx.globalAlpha = s.brightness * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ---- Player ----
class Player {
    constructor() {
        this.reset();
    }
    reset() {
        this.pos = new Vec2(W() / 2, H() / 2);
        this.vel = new Vec2(0, 0);
        this.angle = -Math.PI / 2;
        this.radius = 16;
        this.thrusting = false;
        this.shooting = false;
        this.boostActive = false;
        this.invincible = 2.5;
        this.shootCooldown = 0;
        this.alive = true;
        this.spawnFlash = 1.0;
        this.engineGlow = 0;
    }
    update(dt) {
        if (!this.alive) return;
        if (this.invincible > 0) this.invincible -= dt;

        // Rotation
        let rot = 0;
        if (keys['a'] || keys['arrowleft']) rot = -1;
        if (keys['d'] || keys['arrowright']) rot = 1;
        if (touch.active) {
            if (Math.abs(touch.dx) > 0.15 || Math.abs(touch.dy) > 0.15) {
                this.angle = Math.atan2(touch.dy, touch.dx);
            }
        } else {
            this.angle += rot * 3.5 * dt;
        }

        // Thrust
        const joystickThrust = touch.active && (Math.abs(touch.dx) > 0.15 || Math.abs(touch.dy) > 0.15);
        this.thrusting = keys['w'] || keys['arrowup'] || joystickThrust;
        if (this.thrusting) {
            const thrust = new Vec2(Math.cos(this.angle), Math.sin(this.angle)).scale(280);
            this.vel = this.vel.add(thrust.scale(dt));
            this.engineGlow = Math.min(this.engineGlow + dt * 5, 1);
        } else {
            this.engineGlow = Math.max(this.engineGlow - dt * 3, 0);
        }

        // Boost / Hyperspace
        this.boostActive = keys['shift'] || touch.boost;
        const friction = this.boostActive ? 0.995 : 0.99;
        const maxSpeed = this.boostActive ? 550 : 350;
        this.vel = this.vel.scale(friction);
        const speed = this.vel.len();
        if (speed > maxSpeed) this.vel = this.vel.norm().scale(maxSpeed);

        this.pos = wrap(this.pos.add(this.vel.scale(dt)));

        // Spawn flash decay
        if (this.spawnFlash > 0) this.spawnFlash = Math.max(0, this.spawnFlash - dt * 2.5);

        // Shooting
        this.shootCooldown -= dt;
        const wantsShoot = keys[' '] || touch.fire;
        if (wantsShoot && this.shootCooldown <= 0 && this.alive) {
            this.shootCooldown = this.boostActive ? 0.1 : 0.18;
            return true;
        }
        return false;
    }
    draw() {
        if (!this.alive) return;
        if (this.invincible > 0 && Math.floor(this.invincible * 10) % 2 === 0) return;

        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);

        const glow = this.engineGlow;
        const boost = this.boostActive;
        const flash = this.spawnFlash || 0;

        // Spawn flash — expanding ring
        if (flash > 0.01) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(0,255,200,${flash * 0.5})`;
            ctx.lineWidth = 2;
            const ringR = 22 + (1 - flash) * 30;
            ctx.beginPath();
            ctx.arc(0, 0, ringR, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = `rgba(0,255,200,${flash * 0.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, ringR + 6, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Engine exhaust — dual nozzles
        if (glow > 0.05) {
            const len = 18 * glow;
            const wide = boost ? 10 : 6;
            ctx.shadowColor = boost ? '#ff5577' : '#00ffc8';
            ctx.shadowBlur = 25 * glow;
            ctx.fillStyle = boost
                ? `rgba(255,85,119,${0.3 * glow})`
                : `rgba(0,255,200,${0.3 * glow})`;
            // Left nozzle
            ctx.beginPath();
            ctx.moveTo(-8, -5);
            ctx.lineTo(-8 - len, -5 - wide * 0.4);
            ctx.lineTo(-8 - len, 0);
            ctx.lineTo(-8, 0);
            ctx.closePath();
            ctx.fill();
            // Right nozzle
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(-8 - len, 0);
            ctx.lineTo(-8 - len, 5 + wide * 0.4);
            ctx.lineTo(-8, 5);
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        // Ship hull
        ctx.shadowColor = boost ? '#ff5577' : '#00ffc8';
        ctx.shadowBlur = boost ? 20 : 15;
        ctx.strokeStyle = boost ? '#ff5577' : '#00ffc8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Nose
        ctx.moveTo(22, 0);
        // Right cockpit
        ctx.lineTo(16, 3);
        // Right body narrow
        ctx.lineTo(8, 6);
        // Right wing tip
        ctx.lineTo(0, 15);
        // Right wing inner
        ctx.lineTo(-4, 9);
        // Right engine fairing
        ctx.lineTo(-8, 7);
        // Rear center indent
        ctx.lineTo(-11, 0);
        // Left engine fairing
        ctx.lineTo(-8, -7);
        // Left wing inner
        ctx.lineTo(-4, -9);
        // Left wing tip
        ctx.lineTo(0, -15);
        // Left body narrow
        ctx.lineTo(8, -6);
        // Left cockpit
        ctx.lineTo(16, -3);
        ctx.closePath();
        ctx.stroke();

        // Cockpit window
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#66ffdd';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(14, -2.5);
        ctx.lineTo(9, -2);
        ctx.lineTo(9, 2);
        ctx.lineTo(14, 2.5);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = 'rgba(0,255,200,0.1)';
        ctx.fill();

        // Wingtip accent lines
        ctx.shadowBlur = 8;
        ctx.strokeStyle = boost ? 'rgba(255,85,119,0.4)' : 'rgba(0,255,200,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 15);
        ctx.lineTo(-2, 12);
        ctx.moveTo(0, -15);
        ctx.lineTo(-2, -12);
        ctx.stroke();

        // Boost overdrive glow
        if (boost) {
            ctx.shadowColor = '#ff3355';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = 'rgba(255,51,85,0.15)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(20, 0);
            ctx.lineTo(-12, 0);
            ctx.stroke();
            // Core glow line
            ctx.shadowBlur = 20;
            ctx.strokeStyle = 'rgba(255,85,119,0.3)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, 17, -0.3, 0.3);
            ctx.stroke();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }
    getPos() { return this.pos; }
    getRadius() { return this.radius; }
}

// ---- Bullets ----
class Bullet {
    constructor(x, y, angle, boost) {
        this.pos = new Vec2(x, y);
        const speed = boost ? 600 : 450;
        this.vel = new Vec2(Math.cos(angle), Math.sin(angle)).scale(speed);
        this.radius = 3;
        this.life = 1.2;
        this.boost = boost;
    }
    update(dt) {
        this.pos = wrap(this.pos.add(this.vel.scale(dt)));
        this.life -= dt;
        return this.life > 0;
    }
    draw() {
        ctx.save();
        ctx.shadowColor = this.boost ? '#ff5577' : '#00ffc8';
        ctx.shadowBlur = this.boost ? 15 : 10;
        ctx.fillStyle = this.boost ? '#ff5577' : '#00ffc8';
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        // Trail
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = this.boost ? '#ff3355' : '#00ffc8';
        ctx.beginPath();
        ctx.arc(this.pos.x - this.vel.x * 0.015, this.pos.y - this.vel.y * 0.015, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}

// ---- Asteroids ----
class Asteroid {
    constructor(x, y, size) {
        const sizes = ['large', 'medium', 'small'];
        this.sizeClass = size || 'large';
        this.radius = this.sizeClass === 'large' ? 45 : this.sizeClass === 'medium' ? 22 : 10;
        this.pos = new Vec2(x, y);
        const angle = Math.random() * Math.PI * 2;
        const speed = this.sizeClass === 'large' ? 30 + Math.random() * 40
            : this.sizeClass === 'medium' ? 50 + Math.random() * 50
            : 70 + Math.random() * 60;
        this.vel = new Vec2(Math.cos(angle), Math.sin(angle)).scale(speed);
        this.rotSpeed = (Math.random() - 0.5) * 2;
        this.rotation = Math.random() * Math.PI * 2;
        // Irregular shape
        this.vertices = [];
        const numVerts = 8 + Math.floor(Math.random() * 5);
        for (let i = 0; i < numVerts; i++) {
            const a = (i / numVerts) * Math.PI * 2;
            const r = this.radius * (0.75 + Math.random() * 0.25);
            this.vertices.push(new Vec2(Math.cos(a) * r, Math.sin(a) * r));
        }
    }
    update(dt) {
        this.rotation += this.rotSpeed * dt;
        this.pos = wrap(this.pos.add(this.vel.scale(dt)));
    }
    draw() {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.rotation);

        const color = this.sizeClass === 'large' ? 'rgba(255,200,100,' :
            this.sizeClass === 'medium' ? 'rgba(255,150,50,' : 'rgba(255,100,200,';
        const alpha = '0.8)';
        ctx.strokeStyle = color + alpha;
        ctx.shadowColor = color + '0.5)';
        ctx.shadowBlur = this.sizeClass === 'large' ? 15 : this.sizeClass === 'medium' ? 10 : 8;
        ctx.lineWidth = this.sizeClass === 'large' ? 2.5 : 2;

        ctx.beginPath();
        ctx.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1; i < this.vertices.length; i++) {
            ctx.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = color + '0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }
    getRadius() { return this.radius; }
}

// ---- Particles ----
let particles = [];
class Particle {
    constructor(x, y, color, count, speed, life) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const spd = Math.random() * speed + speed * 0.2;
            particles.push({
                pos: new Vec2(x, y),
                vel: new Vec2(Math.cos(angle), Math.sin(angle)).scale(spd),
                life: Math.random() * life + life * 0.3,
                maxLife: life * 1.3,
                size: Math.random() * 3 + 1,
                color: color
            });
        }
    }
}
function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.pos = p.pos.add(p.vel.scale(dt));
        p.vel = p.vel.scale(0.97);
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
    }
}
function drawParticles() {
    for (const p of particles) {
        const t = p.life / p.maxLife;
        ctx.globalAlpha = t;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size * t, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ---- Collision ----
function circlesCollide(a, b) {
    const dx = a.pos.x - b.pos.x;
    const dy = a.pos.y - b.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return dist < a.radius + b.radius;
}

// ---- Game objects ----
let player;
let bullets = [];
let asteroids = [];
let screenShake = 0;

function initGame() {
    player = new Player();
    bullets = [];
    asteroids = [];
    particles = [];
    screenShake = 0;
    score = 0;
    wave = 1;
    lives = 3;
    updateHUD();
    spawnWave(1);
}

function spawnWave(waveNum) {
    const count = Math.min(4 + waveNum * 1.5, 14);
    for (let i = 0; i < count; i++) {
        let x, y;
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { x = -50; y = Math.random() * H(); }
        else if (side === 1) { x = W() + 50; y = Math.random() * H(); }
        else if (side === 2) { x = Math.random() * W(); y = -50; }
        else { x = Math.random() * W(); y = H() + 50; }
        // Keep away from player
        const dx = x - player.pos.x;
        const dy = y - player.pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < 150) {
            x = (x + 200) % (W() + 100) - 50;
        }
        asteroids.push(new Asteroid(x, y, 'large'));
    }
}

function splitAsteroid(ast) {
    if (ast.sizeClass === 'large') {
        asteroids.push(new Asteroid(ast.pos.x, ast.pos.y, 'medium'));
        asteroids.push(new Asteroid(ast.pos.x, ast.pos.y, 'medium'));
        return 20;
    } else if (ast.sizeClass === 'medium') {
        asteroids.push(new Asteroid(ast.pos.x, ast.pos.y, 'small'));
        asteroids.push(new Asteroid(ast.pos.x, ast.pos.y, 'small'));
        return 50;
    } else {
        return 100;
    }
}

function updateHUD() {
    scoreEl.textContent = score.toLocaleString();
    waveEl.textContent = wave;
    livesEl.textContent = '★'.repeat(Math.max(0, lives)) + '☆'.repeat(Math.max(0, 3 - lives));
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('cosmoclasm_high', String(highScore));
        highScoreEl.textContent = highScore.toLocaleString();
    }
}

// ---- Main loop ----
let lastTime = 0;
let gameFrameCount = 0;
function gameLoop(time) {
    // Skip first frames on game start to prevent dt spikes
    gameFrameCount++;
    if (gameFrameCount < 5) { lastTime = time; requestAnimationFrame(gameLoop); draw(); return; }
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (gameRunning) {
        update(dt);
    }
    draw();
    requestAnimationFrame(gameLoop);
}

function update(dt) {
    // Player shooting
    const shot = player.update(dt);
    if (shot) {
        bullets.push(new Bullet(player.pos.x, player.pos.y, player.angle, player.boostActive));
    }

    // Bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        if (!bullets[i].update(dt)) {
            bullets.splice(i, 1);
            continue;
        }
    }

    // Asteroids
    for (const ast of asteroids) {
        ast.update(dt);
    }

    // Collisions: bullets vs asteroids
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        let hit = false;
        for (let j = asteroids.length - 1; j >= 0; j--) {
            const a = asteroids[j];
            if (circlesCollide(b, a)) {
                hit = true;
                const pts = splitAsteroid(a);
                score += pts;
                screenShake = Math.max(screenShake, a.sizeClass === 'large' ? 6 : 4);
                const color = a.sizeClass === 'small' ? '#ff64c8' : '#ffcc44';
                new Particle(a.pos.x, a.pos.y, color,
                    a.sizeClass === 'large' ? 25 : a.sizeClass === 'medium' ? 15 : 8,
                    a.sizeClass === 'large' ? 120 : 80, 0.6);
                asteroids.splice(j, 1);
                updateHUD();
                break;
            }
        }
        if (hit) bullets.splice(i, 1);
    }

    // Collisions: player vs asteroids
    if (player.alive && player.invincible <= 0) {
        for (let i = asteroids.length - 1; i >= 0; i--) {
            if (circlesCollide(player, asteroids[i])) {
                const ast = asteroids[i];
                new Particle(player.pos.x, player.pos.y, '#00ffc8', 30, 150, 0.8);
                new Particle(ast.pos.x, ast.pos.y, '#ffcc44', 15, 100, 0.6);
                screenShake = 12;
                player.alive = false;
                lives--;
                updateHUD();
                if (lives <= 0) {
                    gameOver();
                    return;
                }
                // Start respawn
                setTimeout(() => {
                    player.reset();
                    player.invincible = 2;
                    player.pos = new Vec2(W() / 2, H() / 2);
                    player.vel = new Vec2(0, 0);
                }, 1000);
                break;
            }
        }
    }

    // Particles
    updateParticles(dt);

    // Check wave clear
    if (asteroids.length === 0) {
        wave++;
        spawnWave(wave);
        updateHUD();
    }
}

function gameOver() {
    gameRunning = false;
    gameoverScreen.classList.remove('hidden');
    finalScoreEl.textContent = score.toLocaleString();
    mobileControls.classList.add('hidden');
}

function draw() {
    ctx.save();

    // Screen shake
    if (screenShake > 0) {
        const sx = (Math.random() - 0.5) * screenShake;
        const sy = (Math.random() - 0.5) * screenShake;
        ctx.translate(sx, sy);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Clear
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(-10, -10, W() + 20, H() + 20);

    // Background nebula
    const grad = ctx.createRadialGradient(W() * 0.3, H() * 0.4, 0, W() * 0.3, H() * 0.4, Math.max(W(), H()) * 0.5);
    grad.addColorStop(0, 'rgba(0,40,60,0.15)');
    grad.addColorStop(0.5, 'rgba(20,0,40,0.08)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, W() + 20, H() + 20);

    // Stars
    drawStars();

    if (gameRunning || !menuScreen.classList.contains('hidden')) {
        // Draw game objects
        for (const ast of asteroids) ast.draw();
        for (const b of bullets) b.draw();
        drawParticles();
        if (player) player.draw();
    }

    ctx.restore();
}

// ---- Controls setup ----
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    menuScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    mobileControls.classList.remove('hidden');
    initStars();
    initGame();
    gameFrameCount = 0;
    gameRunning = true;
    // Show mobile controls on touch devices
    if ('ontouchstart' in window) {
        mobileControls.classList.remove('hidden');
    } else {
        mobileControls.classList.add('hidden');
    }
}

// Keyboard shortcut
document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !gameRunning) {
        startGame();
    }
});

// ---- Touch controls ----
if ('ontouchstart' in window) {
    // Joystick
    joystickArea.addEventListener('touchstart', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        joystickTouchId = t.identifier;
        touch.active = true;
        updateJoystick(t);
    });
    joystickArea.addEventListener('touchmove', e => {
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) updateJoystick(t);
        }
    });
    joystickArea.addEventListener('touchend', e => {
        for (const t of e.changedTouches) {
            if (t.identifier === joystickTouchId) {
                joystickTouchId = null;
                touch.active = false;
                touch.dx = 0;
                touch.dy = 0;
                joystickKnob.style.transform = 'translate(-50%, -50%)';
            }
        }
    });

    function updateJoystick(touchEvent) {
        const rect = joystickArea.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        let dx = touchEvent.clientX - cx;
        let dy = touchEvent.clientY - cy;
        const maxDist = rect.width / 2 - 22;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
            dx = (dx / dist) * maxDist;
            dy = (dy / dist) * maxDist;
        }
        joystickKnob.style.transform = `translate(${-50 + (dx / maxDist) * 50}%, ${-50 + (dy / maxDist) * 50}%)`;

        // Store normalized deflection for player control
        touch.dx = dx / maxDist;
        touch.dy = dy / maxDist;
    }

    // Fire button
    fireBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        touch.fire = true;
    });
    fireBtn.addEventListener('touchend', e => {
        e.preventDefault();
        touch.fire = false;
    });

    // Boost button
    boostBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        touch.boost = true;
    });
    boostBtn.addEventListener('touchend', e => {
        e.preventDefault();
        touch.boost = false;
    });

    // Prevent scrolling
    document.addEventListener('touchmove', e => {
        if (e.target.closest('#game-wrapper')) e.preventDefault();
    }, { passive: false });
}

// ---- Resize handling for stars ----
window.addEventListener('resize', () => {
    if (stars.length > 0) initStars();
});

// ---- Start ----
initStars();
requestAnimationFrame(gameLoop);
