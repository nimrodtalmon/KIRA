const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const msgEl = document.getElementById('message');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let snake, dir, nextDir, food, score, best, running, loopId;

best = parseInt(localStorage.getItem('snake_best') || '0');
bestEl.textContent = best;

function init() {
  snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  scoreEl.textContent = 0;
  running = true;
  placeFood();
  msgEl.textContent = '';
  clearInterval(loopId);
  loopId = setInterval(tick, 120);
}

function placeFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

function tick() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

  // Wall collision
  if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    return gameOver();
  }
  // Self collision
  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    return gameOver();
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score++;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('snake_best', best);
    }
    placeFood();
  } else {
    snake.pop();
  }

  draw();
}

function gameOver() {
  clearInterval(loopId);
  running = false;
  msgEl.textContent = 'Game over! Press any arrow key to restart';
  draw();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Food
  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.arc(
    food.x * GRID + GRID / 2,
    food.y * GRID + GRID / 2,
    GRID / 2 - 2, 0, Math.PI * 2
  );
  ctx.fill();

  // Snake
  snake.forEach((seg, i) => {
    ctx.fillStyle = i === 0 ? '#a78bfa' : '#6d28d9';
    ctx.beginPath();
    ctx.roundRect(seg.x * GRID + 1, seg.y * GRID + 1, GRID - 2, GRID - 2, 4);
    ctx.fill();
  });
}

const DIRS = {
  ArrowUp:    { x: 0, y: -1 }, w: { x: 0, y: -1 },
  ArrowDown:  { x: 0, y:  1 }, s: { x: 0, y:  1 },
  ArrowLeft:  { x: -1, y: 0 }, a: { x: -1, y: 0 },
  ArrowRight: { x: 1,  y: 0 }, d: { x: 1,  y: 0 },
};

document.addEventListener('keydown', e => {
  const d = DIRS[e.key];
  if (!d) return;
  e.preventDefault();

  if (!running) {
    init();
    return;
  }

  // Prevent reversing
  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
});

// Draw initial state
snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
dir = { x: 1, y: 0 };
food = { x: 15, y: 10 };
draw();
