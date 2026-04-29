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

// Bird
const bird = {
    x: 50,
    y: 150,
    w: 34,
    h: 24,
    radius: 12,
    gravity: 0.25,
    jump: 4.6,
    speed: 0,
    rotation: 0,
    
    draw: function() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        // Bird Body
        ctx.fillStyle = "#f7d302";
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.stroke();
        
        // Eye
        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(5, -4, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.arc(7, -4, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Beak
        ctx.fillStyle = "#f7941d";
        ctx.beginPath();
        ctx.moveTo(8, 2);
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
            ctx.fillRect(p.x, topYPos, this.w, this.h);
            ctx.strokeStyle = "#000";
            ctx.strokeRect(p.x, topYPos, this.w, this.h);
            
            // Bottom pipe
            ctx.fillRect(p.x, bottomYPos, this.w, this.h);
            ctx.strokeRect(p.x, bottomYPos, this.w, this.h);
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
        ctx.strokeRect(0, cvs.height - 50, cvs.width, 2);
    }
};

// Event Listeners
cvs.addEventListener("click", function() {
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
    
    pipes.draw();
    bg.draw();
    bird.draw();
    
    if (state.current == state.getReady) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, cvs.width, cvs.height);
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
}

function loop() {
    update();
    draw();
    frames++;
    requestAnimationFrame(loop);
}

loop();
