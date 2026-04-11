"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 400;
canvas.height = 600;

// ── Character image ──────────────────────────────────────────────────────────
const charImg = new Image();
let imgReady = false;
charImg.onload = () => (imgReady = true);
charImg.src = "character.png";

// ── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 0.45;
const JUMP_FORCE = -14;
const PLAYER_SPEED = 6;
const PLAYER_W = 56;
const PLAYER_H = 56;
const PLAT_W = 70;
const PLAT_H = 14;
const PLAT_COUNT = 12;
const SCROLL_Y = canvas.height * 0.42; // player Y that triggers scrolling

// ── State ────────────────────────────────────────────────────────────────────
let state,
  score,
  highScore = 0,
  player,
  platforms;
const keys = {};
let touchDir = 0; // -1 = left, 0 = none, 1 = right

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  state = "playing";
  score = 0;

  player = {
    x: canvas.width / 2 - PLAYER_W / 2,
    y: canvas.height - 250,
    vx: 0,
    vy: JUMP_FORCE, // start mid-jump
    facing: 1, // 1 = right, -1 = left (for sprite flip)
  };

  platforms = [];
  platforms.push({ x: canvas.width / 2 - PLAT_W / 2, y: canvas.height - 170 });

  let topY = canvas.height - 170;
  for (let i = 1; i < PLAT_COUNT; i++) {
    topY -= 55 + Math.random() * 45;
    platforms.push({ x: Math.random() * (canvas.width - PLAT_W), y: topY });
  }
}

// ── Update ───────────────────────────────────────────────────────────────────
function update() {
  if (state !== "playing") return;

  // Input
  const goLeft = keys["ArrowLeft"] || keys["a"] || keys["A"] || touchDir < 0;
  const goRight = keys["ArrowRight"] || keys["d"] || keys["D"] || touchDir > 0;

  if (goLeft) {
    player.vx = -PLAYER_SPEED;
    player.facing = -1;
  } else if (goRight) {
    player.vx = PLAYER_SPEED;
    player.facing = 1;
  } else {
    player.vx = 0;
  }

  // Physics
  const prevBottom = player.y + PLAYER_H;
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  // Horizontal wrap
  if (player.x + PLAYER_W < 0) player.x = canvas.width;
  if (player.x > canvas.width) player.x = -PLAYER_W;

  // Platform collision (only while falling)
  if (player.vy > 0) {
    const curBottom = player.y + PLAYER_H;
    for (const p of platforms) {
      if (
        player.x + PLAYER_W > p.x + 5 &&
        player.x < p.x + PLAT_W - 5 &&
        prevBottom <= p.y + 2 &&
        curBottom >= p.y
      ) {
        player.vy = JUMP_FORCE;
        player.y = p.y - PLAYER_H;
        break;
      }
    }
  }

  // Scroll world when player rises above threshold
  if (player.y < SCROLL_Y) {
    const shift = SCROLL_Y - player.y;
    player.y = SCROLL_Y;
    score += shift;

    for (const p of platforms) p.y += shift;

    // Remove platforms that fell off the bottom
    platforms = platforms.filter((p) => p.y < canvas.height + PLAT_H + 10);

    // Spawn new platforms at the top
    let topY = Math.min(...platforms.map((p) => p.y));
    while (platforms.length < PLAT_COUNT) {
      topY -= 55 + Math.random() * 45;
      platforms.push({ x: Math.random() * (canvas.width - PLAT_W), y: topY });
    }
  }

  // Game over: fell below screen
  if (player.y > canvas.height + 60) {
    state = "gameover";
    if (score > highScore) highScore = score;
    submitScore(Math.floor(score / 5));
  }
}

// ── Draw helpers ─────────────────────────────────────────────────────────────
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawPlatform(p) {
  ctx.fillStyle = "#4db84d";
  roundRect(p.x, p.y, PLAT_W, PLAT_H, 7);
  ctx.fill();
  // top shine
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  roundRect(p.x + 7, p.y + 3, PLAT_W - 14, 4, 3);
  ctx.fill();
}

function drawPlayer() {
  ctx.save();
  // Flip horizontally when facing left
  ctx.translate(player.x + PLAYER_W / 2, player.y + PLAYER_H / 2);
  ctx.scale(player.facing, 1);
  ctx.translate(-PLAYER_W / 2, -PLAYER_H / 2);

  if (imgReady) {
    const aspect = charImg.naturalWidth / charImg.naturalHeight;
    let dw, dh;
    if (aspect >= 1) {
      dw = PLAYER_W;
      dh = PLAYER_W / aspect;
    } else {
      dh = PLAYER_H;
      dw = PLAYER_H * aspect;
    }
    const dx = (PLAYER_W - dw) / 2;
    const dy = (PLAYER_H - dh) / 2;
    ctx.drawImage(charImg, dx, dy, dw, dh);
  } else {
    // Fallback: simple creature blob
    ctx.fillStyle = "#6BCB77";
    ctx.beginPath();
    ctx.ellipse(
      PLAYER_W / 2,
      PLAYER_H / 2 + 3,
      PLAYER_W / 2 - 2,
      PLAYER_H / 2 - 3,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    // eyes (white)
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(PLAYER_W / 2 - 9, PLAYER_H / 2, 6, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(PLAYER_W / 2 + 9, PLAYER_H / 2, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // pupils
    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.ellipse(PLAYER_W / 2 - 8, PLAYER_H / 2 + 1, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(PLAYER_W / 2 + 10, PLAYER_H / 2 + 1, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHUD() {
  const displayScore = Math.floor(score / 5);

  // Score pill
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  roundRect(8, 8, 138, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Score: ${displayScore}`, 18, 32);

  // Controls hint (only at the very start)
  if (score < 150) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = "13px Arial";
    ctx.textAlign = "center";
    ctx.fillText("← → or A D   ·   tap left / right half", canvas.width / 2, canvas.height - 12);
  }
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  // Card
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  roundRect(cx - 155, cy - 138, 310, 248, 20);
  ctx.fill();

  ctx.textAlign = "center";

  ctx.fillStyle = "#5c6bc0";
  ctx.font = "bold 22px Arial";
  ctx.fillText("Hörpuhopp", cx, cy - 112);

  ctx.fillStyle = "#e53935";
  ctx.font = "bold 44px Arial";
  ctx.fillText("Leik lokið", cx, cy - 62);

  ctx.fillStyle = "#333";
  ctx.font = "bold 26px Arial";
  ctx.fillText(`Stig: ${Math.floor(score / 5)}`, cx, cy - 14);

  ctx.fillStyle = "#e67e22";
  ctx.font = "bold 20px Arial";
  ctx.fillText(`Best: ${Math.floor(highScore / 5)}`, cx, cy + 24);

  ctx.fillStyle = "#666";
  ctx.font = "15px Arial";
  ctx.fillText("Space / Enter / Smelltu til að spila aftur", cx, cy + 82);
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  // Sky gradient
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#87CEEB");
  bg.addColorStop(1, "#d4eeff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of platforms) drawPlatform(p);
  drawPlayer();
  drawHUD();
  if (state === "gameover") drawGameOver();
}

// ── Game loop ────────────────────────────────────────────────────────────────
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ── Input ────────────────────────────────────────────────────────────────────
document.addEventListener("keydown", (e) => {
  keys[e.key] = true;
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
  }
  if ((e.key === " " || e.key === "Enter") && state === "gameover") init();
});
document.addEventListener("keyup", (e) => {
  keys[e.key] = false;
});

canvas.addEventListener("click", () => {
  if (state === "gameover") init();
});

// Touch: tap left half = go left, right half = go right
canvas.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    if (state === "gameover") {
      init();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const tx = (e.touches[0].clientX - rect.left) * scaleX;
    touchDir = tx < canvas.width / 2 ? -1 : 1;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const tx = (e.touches[0].clientX - rect.left) * scaleX;
    touchDir = tx < canvas.width / 2 ? -1 : 1;
  },
  { passive: false }
);

canvas.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
    touchDir = 0;
  },
  { passive: false }
);

// ── Leaderboard ──────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderLeaderboard(scores) {
  var list = document.getElementById("leaderboard-list");
  if (!list) return;
  if (!scores || scores.length === 0) {
    list.innerHTML = '<li style="color:#aaa;font-size:12px">Engar færslur</li>';
    return;
  }
  list.innerHTML = scores
    .map(function (s, i) {
      return (
        '<li><span class="lb-rank">' +
        (i + 1) +
        ".</span>" +
        '<span class="lb-name">' +
        escapeHtml(s.user_name) +
        "</span>" +
        '<span class="lb-score">' +
        s.score +
        "</span></li>"
      );
    })
    .join("");
}

function fetchLeaderboard() {
  var game = window.LEIKIR_GAME;
  if (!game) return;
  fetch("/api/leikir/" + game + "/scores")
    .then(function (r) {
      return r.json();
    })
    .then(renderLeaderboard)
    .catch(function () {});
}

function submitScore(finalScore) {
  var game = window.LEIKIR_GAME;
  if (!game || finalScore <= 0) return;
  fetch("/api/leikir/" + game + "/scores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ score: finalScore }),
  })
    .then(function (res) {
      if (res.status === 401) {
        var prompt = document.getElementById("login-prompt");
        if (prompt) prompt.style.display = "block";
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (data) renderLeaderboard(data);
    })
    .catch(function () {});
}

// ── Start ────────────────────────────────────────────────────────────────────
init();
loop();
fetchLeaderboard();
