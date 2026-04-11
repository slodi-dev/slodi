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

// ── Coin image ───────────────────────────────────────────────────────────────
const coinImg = new Image();
let coinImgReady = false;
coinImg.onload = () => (coinImgReady = true);
coinImg.src = "coin.png";

// ── Constants ────────────────────────────────────────────────────────────────
const GRAVITY = 0.45;
const JUMP_FORCE = -14;
const PLAYER_SPEED = 6;
const PLAYER_W = 56;
const PLAYER_H = 56;
const PLAT_H = 14;
const PLAT_COUNT = 12;
const SCROLL_Y = canvas.height * 0.42;

// ── Slóði color palette ───────────────────────────────────────────────────────
const C = {
  green500: "hsl(142 50% 42%)",
  green400: "hsl(142 50% 55%)",
  green600: "hsl(142 50% 35%)",
  forest500: "hsl(160 42% 32%)",
  drekar500: "hsl(48 77% 61%)",
  neutral900: "hsl(0 0% 10%)",
  neutral700: "hsl(0 0% 40%)",
  warning: "hsl(35 100% 64%)",
};
const FONT = "'Roboto Condensed', Arial, sans-serif";

// ── State ────────────────────────────────────────────────────────────────────
let state,
  score,
  highScore = 0,
  player,
  platforms,
  coins,
  tick;
const keys = {};
let touchDir = 0;

// ── Difficulty ───────────────────────────────────────────────────────────────
// Ramps from 0 → 1 over 2000 display points
function getDifficulty() {
  return Math.min(Math.floor(score / 5) / 2000, 1);
}

// Platform width: 70 → 45 px
function getPlatW() {
  return Math.round(70 - getDifficulty() * 25);
}

// Vertical gap between platforms: max grows from 100 → 180 px
function getPlatGap() {
  const d = getDifficulty();
  return 55 + Math.random() * (45 + d * 80);
}

// Spawn a single platform at the given y, applying current difficulty
function spawnPlatform(y) {
  const d = getDifficulty();
  const w = getPlatW();
  const movingChance = Math.min(Math.max(0, (d - 0.35) * 1.2), 0.7);
  const moving = Math.random() < movingChance;
  const speed = moving ? (1 + d * 2.5) * (Math.random() < 0.5 ? 1 : -1) : 0;
  return {
    x: Math.random() * (canvas.width - w),
    y,
    w,
    vx: speed,
  };
}

// ── Coins ─────────────────────────────────────────────────────────────────────
const COIN_R = 10;
const COIN_VALUE = 125; // adds 25 display points (score / 5)

function spawnCoin(x, y) {
  return { x, y, phase: Math.random() * Math.PI * 2 };
}

// ── Init ─────────────────────────────────────────────────────────────────────
function init() {
  state = "playing";
  score = 0;
  coins = [];
  tick = 0;

  player = {
    x: canvas.width / 2 - PLAYER_W / 2,
    y: canvas.height - 250,
    vx: 0,
    vy: JUMP_FORCE,
    facing: 1,
  };

  // Starting platform: always static and full-width directly under player
  platforms = [{ x: canvas.width / 2 - 35, y: canvas.height - 170, w: 70, vx: 0 }];

  // Fill upward — score=0 so getDifficulty()=0; spawnPlatform gives easy platforms
  let topY = canvas.height - 170;
  for (let i = 1; i < PLAT_COUNT; i++) {
    topY -= 55 + Math.random() * 45;
    platforms.push(spawnPlatform(topY));
  }
}

// ── Update ───────────────────────────────────────────────────────────────────
function update() {
  if (state !== "playing") return;
  tick++;

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

  const prevBottom = player.y + PLAYER_H;
  player.vy += GRAVITY;
  player.x += player.vx;
  player.y += player.vy;

  // Horizontal wrap
  if (player.x + PLAYER_W < 0) player.x = canvas.width;
  if (player.x > canvas.width) player.x = -PLAYER_W;

  // Move sliding platforms and bounce off walls
  for (const p of platforms) {
    if (p.vx !== 0) {
      p.x += p.vx;
      if (p.x <= 0) {
        p.x = 0;
        p.vx *= -1;
      }
      if (p.x + p.w >= canvas.width) {
        p.x = canvas.width - p.w;
        p.vx *= -1;
      }
    }
  }

  // Platform collision (only while falling)
  if (player.vy > 0) {
    const curBottom = player.y + PLAYER_H;
    for (const p of platforms) {
      if (
        player.x + PLAYER_W > p.x + 5 &&
        player.x < p.x + p.w - 5 &&
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
    platforms = platforms.filter((p) => p.y < canvas.height + PLAT_H + 10);

    for (const c of coins) c.y += shift;
    coins = coins.filter((c) => c.y < canvas.height + COIN_R * 2);

    let topY = Math.min(...platforms.map((p) => p.y));
    while (platforms.length < PLAT_COUNT) {
      topY -= getPlatGap();
      const p = spawnPlatform(topY);
      platforms.push(p);
      // 40% chance to spawn a coin above this platform
      if (Math.random() < 0.4) {
        coins.push(spawnCoin(p.x + p.w / 2, topY - 28 - Math.random() * 30));
      }
    }
  }

  // Coin collection
  const pLeft = player.x + 6;
  const pRight = player.x + PLAYER_W - 6;
  const pTop = player.y + 6;
  const pBottom = player.y + PLAYER_H - 6;
  coins = coins.filter((c) => {
    const bob = Math.sin(tick * 0.06 + c.phase) * 3;
    const cy = c.y + bob;
    if (
      c.x + COIN_R > pLeft &&
      c.x - COIN_R < pRight &&
      cy + COIN_R > pTop &&
      cy - COIN_R < pBottom
    ) {
      score += COIN_VALUE;
      return false;
    }
    return true;
  });

  // Game over: fell off bottom
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

function drawCoin(c) {
  const bob = Math.sin(tick * 0.06 + c.phase) * 3;
  const cy = c.y + bob;
  const size = COIN_R * 2;
  if (coinImgReady) {
    ctx.drawImage(coinImg, c.x - COIN_R, cy - COIN_R, size, size);
  } else {
    ctx.fillStyle = C.drekar500;
    ctx.beginPath();
    ctx.arc(c.x, cy, COIN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "hsl(40 70% 45%)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(c.x - 2, cy - 2, COIN_R * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlatform(p) {
  // Moving platforms use drekar (gold) to signal danger
  ctx.fillStyle = p.vx !== 0 ? C.drekar500 : C.green500;
  roundRect(p.x, p.y, p.w, PLAT_H, 7);
  ctx.fill();
  // shine strip
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  roundRect(p.x + 5, p.y + 3, p.w - 10, 4, 3);
  ctx.fill();
}

function drawPlayer() {
  ctx.save();
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
    // Fallback blob
    ctx.fillStyle = C.green400;
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
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(PLAYER_W / 2 - 9, PLAYER_H / 2, 6, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(PLAYER_W / 2 + 9, PLAYER_H / 2, 6, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.neutral900;
    ctx.beginPath();
    ctx.ellipse(PLAYER_W / 2 - 8, PLAYER_H / 2 + 1, 3, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(PLAYER_W / 2 + 10, PLAYER_H / 2 + 1, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function getLevel() {
  const ds = Math.floor(score / 5);
  if (ds < 500) return 1;
  if (ds < 1000) return 2;
  if (ds < 2000) return 3;
  if (ds < 3500) return 4;
  return 5;
}

function drawHUD() {
  const displayScore = Math.floor(score / 5);
  const level = getLevel();

  // Score pill
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  roundRect(8, 8, 138, 36, 10);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = `bold 18px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(`Stig: ${displayScore}`, 18, 32);

  // Level badge
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  roundRect(canvas.width - 90, 8, 82, 36, 10);
  ctx.fill();
  ctx.fillStyle = C.drekar500;
  ctx.font = `bold 16px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`Þrep ${level}`, canvas.width - 14, 32);

  // Controls hint (only at the very start)
  if (score < 150) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.font = `13px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("← → eða A D  ·  smelltu vinstri/hægri", canvas.width / 2, canvas.height - 12);
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

  ctx.fillStyle = C.green600;
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillText("Hörpuhopp", cx, cy - 112);

  ctx.fillStyle = C.forest500;
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText("Leik lokið", cx, cy - 62);

  ctx.fillStyle = C.neutral900;
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(`Stig: ${Math.floor(score / 5)}`, cx, cy - 14);

  ctx.fillStyle = C.warning;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(`Best: ${Math.floor(highScore / 5)}`, cx, cy + 24);

  ctx.fillStyle = C.neutral700;
  ctx.font = `15px ${FONT}`;
  ctx.fillText("Space / Enter / Smelltu til að spila aftur", cx, cy + 82);
}

// ── Draw ─────────────────────────────────────────────────────────────────────
function draw() {
  // Sky deepens slightly as difficulty rises (Icelandic sky → evening)
  const d = getDifficulty();
  const topL = Math.round(75 - d * 20); // sky-300 → sky-500
  const botL = Math.round(93 - d * 8); // sky-100 → sky-200
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, `hsl(205 89% ${topL}%)`);
  bg.addColorStop(1, `hsl(205 89% ${botL}%)`);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const p of platforms) drawPlatform(p);
  for (const c of coins) drawCoin(c);
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
