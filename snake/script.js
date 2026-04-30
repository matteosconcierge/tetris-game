const canvas = document.getElementById("snake");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score");

const box = 20;
const canvasSize = 400;
let score = 0;
let gameInterval;
let snake = [{ x: 9 * box, y: 10 * box }];
let food = {
    x: Math.floor(Math.random() * 19) * box,
    y: Math.floor(Math.random() * 19) * box
};
let d = "RIGHT";
let nextD = "RIGHT";

// Controls
document.addEventListener("keydown", direction);
function direction(event) {
    let key = event.keyCode;
    // Prevent reverse turn
    if (key == 37 && d != "RIGHT") nextD = "LEFT";
    else if (key == 38 && d != "DOWN") nextD = "UP";
    else if (key == 39 && d != "LEFT") nextD = "RIGHT";
    else if (key == 40 && d != "UP") nextD = "DOWN";
}

// Touch Controls (Swipe detection)
let touchStartX = 0;
let touchStartY = 0;
canvas.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, {passive: true});

canvas.addEventListener('touchend', e => {
    let touchEndX = e.changedTouches[0].clientX;
    let touchEndY = e.changedTouches[0].clientY;
    let dx = touchEndX - touchStartX;
    let dy = touchEndY - touchStartY;

    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 20 && d != "LEFT") nextD = "RIGHT";
        else if (dx < -20 && d != "RIGHT") nextD = "LEFT";
    } else {
        if (dy > 20 && d != "UP") nextD = "DOWN";
        else if (dy < -20 && d != "DOWN") nextD = "UP";
    }
}, {passive: true});

function collision(head, array) {
    for (let i = 0; i < array.length; i++) {
        if (head.x == array[i].x && head.y == array[i].y) return true;
    }
    return false;
}

function draw() {
    ctx.fillStyle = "#111116";
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw Grid (Subtle)
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1;
    for(let i=0; i<=canvasSize; i+=box) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvasSize); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvasSize, i); ctx.stroke();
    }

    // Draw Snake
    for (let i = 0; i < snake.length; i++) {
        ctx.fillStyle = (i == 0) ? "#00ffcc" : "#00aa88";
        ctx.shadowBlur = (i == 0) ? 15 : 0;
        ctx.shadowColor = "#00ffcc";
        ctx.fillRect(snake[i].x, snake[i].y, box, box);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#000";
        ctx.strokeRect(snake[i].x, snake[i].y, box, box);
    }

    // Food
    ctx.fillStyle = "#ff0066";
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff0066";
    ctx.beginPath();
    ctx.arc(food.x + box/2, food.y + box/2, box/2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    d = nextD;
    let snakeX = snake[0].x;
    let snakeY = snake[0].y;

    if (d == "LEFT") snakeX -= box;
    if (d == "UP") snakeY -= box;
    if (d == "RIGHT") snakeX += box;
    if (d == "DOWN") snakeY += box;

    if (snakeX == food.x && snakeY == food.y) {
        score++;
        scoreElement.innerHTML = "Score: " + score;
        food = {
            x: Math.floor(Math.random() * 19) * box,
            y: Math.floor(Math.random() * 19) * box
        };
    } else {
        snake.pop();
    }

    let newHead = { x: snakeX, y: snakeY };

    // Game Over conditions
    if (snakeX < 0 || snakeX >= canvasSize || snakeY < 0 || snakeY >= canvasSize || collision(newHead, snake)) {
        clearInterval(gameInterval);
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0,0,canvasSize, canvasSize);
        ctx.fillStyle = "white";
        ctx.font = "40px Arial";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvasSize / 2, canvasSize / 2);
        ctx.font = "20px Arial";
        ctx.fillText("Score: " + score, canvasSize / 2, canvasSize / 2 + 40);
        ctx.fillText("Tap to Restart", canvasSize / 2, canvasSize / 2 + 80);
        
        canvas.onclick = restart;
        canvas.addEventListener('touchstart', touchRestart, {once: true});
        return;
    }

    snake.unshift(newHead);
}

function touchRestart(e) {
    e.preventDefault();
    restart();
}

function restart() {
    snake = [{ x: 9 * box, y: 10 * box }];
    food = {
        x: Math.floor(Math.random() * 19) * box,
        y: Math.floor(Math.random() * 19) * box
    };
    score = 0;
    scoreElement.innerHTML = "Score: " + score;
    d = "RIGHT";
    nextD = "RIGHT";
    canvas.onclick = null;
    canvas.removeEventListener('touchstart', touchRestart);
    clearInterval(gameInterval);
    gameInterval = setInterval(draw, 100);
}

gameInterval = setInterval(draw, 100);
