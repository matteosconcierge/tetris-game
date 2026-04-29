const cvs = document.getElementById("flappy");
const ctx = cvs.getContext("2d");
const scoreElement = document.getElementById("score");

let frames = 0;
let score = 0;

// Game States
const state = {
    current: 0,
    getReady: 0,
    game: 1,
    gameOver: 2
};

// Background Clouds
const clouds = {
    position: [],
    dx: 0.5,
    draw: function() {} // Will be defined later
};

// Bird
const bird = {
    x: 50,
    y: 150,
    w: 34,
    h: 24,
    radius: 12,
    gravity: 0.3,
    jump: 5.5,
    speed: 0,
    rotation: 0,
    
    draw: function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Bird Body
        ctx.fillStyle = "#f7d302";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        
        // Main body (oval)
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius + 4, this.radius, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Wing (animation based on frames)
        let wingOffset = Math.sin(frames * 0.2) * 5;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(-8, wingOffset, 10, 6, -0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(8, -4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(10, -4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        // Beak (Protruding)
        ctx.fillStyle = "#f7941d";
        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.quadraticCurveTo(22, 2, 12, 6);
        ctx.lineTo(18, 5);
        ctx.lineTo(8, 8);
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    },
    
    flap: function() {
        this.speed = -this.jump;
    },
    
    update: function() {
        if (state.current == state.getReady) {
            this.y = 150 + Math.sin(frames * 0.1) * 5;
            this.rotation = 0;
        } else {
            this.speed += this.gravity;
            this.y += this.speed;
            
            if (this.speed >= this.jump) {
                this.rotation = Math.min(Math.PI/2, this.rotation + 0.1);
            } else {
                this.rotation = -0.3;
            }
            
            if (this.y + this.h/2 >= cvs.height - 50) {
                this.y = cvs.height - 50 - this.h/2;
                if (state.current == state.game) {
                    state.current = state.gameOver;
                }
            }
        }
    },
    
    reset: function() {
        this.y = 150;
        this.speed = 0;
    }
};

// Pipes
const pipes = {
    position: [],
    w: 53,
    h: 400,
    gap: 120,
    maxYPos: -150,
    dx: 2,
    
    draw: function() {
        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            let topYPos = p.y;
            let bottomYPos = p.y + this.h + this.gap;
            
            // Top pipe
            ctx.fillStyle = "#73bf2e";
            let gradTop = ctx.createLinearGradient(p.x, 0, p.x + this.w, 0);
            gradTop.addColorStop(0, "#558022");
            gradTop.addColorStop(0.5, "#73bf2e");
            gradTop.addColorStop(1, "#558022");
            ctx.fillStyle = gradTop;

            ctx.fillRect(p.x, topYPos, this.w, this.h);
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x, topYPos, this.w, this.h);
            
            // Top pipe cap
            ctx.fillRect(p.x - 5, topYPos + this.h - 20, this.w + 10, 20);
            ctx.strokeRect(p.x - 5, topYPos + this.h - 20, this.w + 10, 20);
            
            // Bottom pipe
            let gradBot = ctx.createLinearGradient(p.x, 0, p.x + this.w, 0);
            gradBot.addColorStop(0, "#558022");
            gradBot.addColorStop(0.5, "#73bf2e");
            gradBot.addColorStop(1, "#558022");
            ctx.fillStyle = gradBot;

            ctx.fillRect(p.x, bottomYPos, this.w, this.h);
            ctx.strokeRect(p.x, bottomYPos, this.w, this.h);

            // Bottom pipe cap
            ctx.fillRect(p.x - 5, bottomYPos, this.w + 10, 20);
            ctx.strokeRect(p.x - 5, bottomYPos, this.w + 10, 20);
        }
    },
    
    update: function() {
        if (state.current !== state.game) return;
        
        if (frames % 100 == 0) {
            this.position.push({
                x: cvs.width,
                y: this.maxYPos * (Math.random() + 1)
            });
        }
        
        for (let i = 0; i < this.position.length; i++) {
            let p = this.position[i];
            p.x -= this.dx;
            
            // Collision
            if (bird.x + bird.radius > p.x && bird.x - bird.radius < p.x + this.w &&
                (bird.y - bird.radius < p.y + this.h || bird.y + bird.radius > p.y + this.h + this.gap)) {
                state.current = state.gameOver;
            }
            
            if (p.x + this.w <= 0) {
                this.position.shift();
                score += 1;
                scoreElement.innerHTML = score;
            }
        }
    },
    
    reset: function() {
        this.position = [];
    }
};

// Ground
const bg = {
    draw: function() {
        ctx.fillStyle = "#ded895";
        ctx.fillRect(0, cvs.height - 50, cvs.width, 50);
        ctx.strokeStyle = "#73bf2e";
        ctx.lineWidth = 2;
        
        // Moving grass effect
        ctx.beginPath();
        ctx.moveTo(0, cvs.height - 50);
        ctx.lineTo(cvs.width, cvs.height - 50);
        ctx.stroke();

        // Stripes on ground
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        let rectW = 20;
        let offset = (frames * pipes.dx) % (rectW * 2);
        for(let i = -rectW*2; i < cvs.width; i += rectW * 2) {
            ctx.fillRect(i - offset, cvs.height - 50, rectW, 50);
        }
    }
};

// Clouds implementation
clouds.update = function() {
    if (frames % 150 == 0) {
        this.position.push({
            x: cvs.width,
            y: Math.random() * 150,
            w: 50 + Math.random() * 50
        });
    }
    for(let i = 0; i < this.position.length; i++) {
        this.position[i].x -= this.dx;
        if(this.position[i].x + this.position[i].w < 0) {
            this.position.shift();
        }
    }
};

clouds.draw = function() {
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for(let i = 0; i < this.position.length; i++) {
        let p = this.position[i];
        let r = p.w / 2;
        
        // Main blob
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        // Fluff 1
        ctx.arc(p.x - r * 0.5, p.y + r * 0.2, r * 0.7, 0, Math.PI * 2);
        // Fluff 2
        ctx.arc(p.x + r * 0.5, p.y + r * 0.2, r * 0.7, 0, Math.PI * 2);
        // Top fluff
        ctx.arc(p.x, p.y - r * 0.3, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
};

// Event Listeners
cvs.addEventListener("click", function() {
    handleInput();
});

cvs.addEventListener("touchstart", function(e) {
    e.preventDefault();
    handleInput();
});

window.addEventListener("keydown", function(e) {
    if (e.code === "Space") {
        handleInput();
    }
});

function handleInput() {
    switch(state.current) {
        case state.getReady:
            state.current = state.game;
            break;
        case state.game:
            bird.flap();
            break;
        case state.gameOver:
            bird.reset();
            pipes.reset();
            score = 0;
            scoreElement.innerHTML = score;
            state.current = state.getReady;
            break;
    }
}

function draw() {
    ctx.fillStyle = "#70c5ce";
    ctx.fillRect(0, 0, cvs.width, cvs.height);

    clouds.draw();
    bg.draw();
    pipes.draw();
    bird.draw();
    
    if (state.current == state.getReady) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        
        // Draw "Get Ready" banner
        ctx.lineWidth = 2;
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("TAP TO START", cvs.width/2, cvs.height/2);
    }
    
    if (state.current == state.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, cvs.width, cvs.height);
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", cvs.width/2, cvs.height/2 - 40);
        ctx.fillText("Score: " + score, cvs.width/2, cvs.height/2);
        ctx.fillText("TAP TO RESTART", cvs.width/2, cvs.height/2 + 40);
    }
}

function update() {
    bird.update();
    pipes.update();
    clouds.update();
}

function loop() {
    update();
    draw();
    frames++;
    requestAnimationFrame(loop);
}

loop();
