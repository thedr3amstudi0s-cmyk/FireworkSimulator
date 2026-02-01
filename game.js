const canvas = document.getElementById("canvas"),
      ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;
window.addEventListener("resize", () => { canvas.width = innerWidth; canvas.height = innerHeight; });

const loginBox = document.getElementById("loginBox"),
      loginBtn = document.getElementById("loginBtn"),
      ui = document.getElementById("ui"),
      ownerCommands = document.getElementById("ownerCommands"),
      resetBtn = document.getElementById("resetBtn"),
      logoutBtn = document.getElementById("logoutBtn"),
      fireworkSound = document.getElementById("fireworkSound"),
      eventBanner = document.getElementById("eventBanner"),
      eventNameEl = document.getElementById("eventName"),
      eventDescEl = document.getElementById("eventDesc"),
      eventTimerEl = document.getElementById("eventTimer");

let currentUser = "", money = 0, unlockedColors = 1, clickDelay = 1200, lastClick = 0,
    rebirthCount = 0, colorPrice = 50, delayPrice = 100, rebirthPrice = 500,
    autoAmount = 0, autoSpeed = 2.5, autoInterval = null,
    fireworks = [], particles = [], gravity = 0.04;

const baseColors = [
  { color: "hsl(0,100%,60%)", value: 1 },
  { color: "hsl(30,100%,60%)", value: 2 },
  { color: "hsl(60,100%,60%)", value: 3 },
  { color: "hsl(120,100%,60%)", value: 4 },
  { color: "hsl(180,100%,60%)", value: 5 },
  { color: "hsl(240,100%,60%)", value: 6 }
];
let colors = [...baseColors];

firebase.initializeApp({
  apiKey: "...",
  authDomain: "fireworkleaderboard.firebaseapp.com",
  databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
  projectId: "fireworkleaderboard",
  storageBucket: "fireworkleaderboard.firebasestorage.app",
  messagingSenderId: "...",
  appId: "...",
  measurementId: "..."
});

const auth = firebase.auth(), db = firebase.database();
let EVENTS_STATE = {
  active: false, chainReaction: false, doubleMoney: false, rainbowMode: false,
  cosmicMode: false, luckyExplosions: false, chaosRoll: false, goldenFirework: false,
  adminStorm: false, blackout: false, glitch: false, name: "", description: "", endsAt: null
};
let eventIntervalHandles = [];

function showEventBanner(name, desc, endTime) {
  eventNameEl.textContent = name;
  eventDescEl.textContent = desc || "";
  if (!endTime) { eventTimerEl.textContent = ""; return; }
  const updateTimer = () => {
    const t = Math.max(0, endTime - Date.now());
    eventTimerEl.textContent = t > 0 ? "Ends in " + Math.ceil(t / 1000) + "s" : "Ending...";
  };
  updateTimer();
  eventIntervalHandles.push(setInterval(updateTimer, 1000));
  eventBanner.style.display = "block";
}

function hideEventBanner() {
  eventBanner.style.display = "none";
  eventNameEl.textContent = "";
  eventDescEl.textContent = "";
  eventTimerEl.textContent = "";
  eventIntervalHandles.forEach(i => clearInterval(i));
  eventIntervalHandles = [];
}

auth.onAuthStateChanged(async u => {
  if (u) {
    currentUser = u.uid;
    loginBox.style.display = "none";
    ui.style.display = "block";
    resetBtn.style.display = "block";
    ownerCommands.style.display = (u.email === "aaron.gatorfan@gmail.com") ? "block" : "none";
    await loadProgressOnline();
  } else {
    currentUser = "";
    loginBox.style.display = "block";
    ui.style.display = "none";
    resetBtn.style.display = "none";
    ownerCommands.style.display = "none";
  }
});

loginBtn.addEventListener("click", async () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  try { await auth.signInWithPopup(provider); } catch (e) { alert("Login failed: " + e.message); }
});

class Firework {
  constructor(x, y, colorObj, owner) {
    this.x = x; this.y = canvas.height; this.targetY = y;
    this.speed = Math.random() * 2 + 4;
    this.colorObj = colorObj; this.owner = owner;
  }
  update() { if ((this.y -= this.speed) <= this.targetY) { explode(this.x, this.y, this.colorObj, this.owner); return true; } return false; }
  draw() { ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI); ctx.fillStyle = this.colorObj.color; ctx.fill(); }
}

class Particle {
  constructor(x, y, colorObj) { this.x = x; this.y = y; this.color = colorObj.color; this.speedX = (Math.random() - 0.5) * 6; this.speedY = (Math.random() - 0.5) * 6; this.life = 100; }
  update() { this.speedY += gravity; this.x += this.speedX; this.y += this.speedY; this.life--; }
  draw() { ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, 2 * Math.PI); ctx.fillStyle = this.color; ctx.fill(); }
}

function explode(x, y, c, o) {
  fireworkSound.currentTime = 0; fireworkSound.play();
  for (let i = 0; i < 80; i++) particles.push(new Particle(x, y, c));
  if (EVENTS_STATE.rainbowMode) c = { color: `hsl(${Math.floor(Math.random()*360)},100%,60%)`, value: c.value };
  computeAndAward(c.value * (rebirthCount + 1));
}

function launchFirework(x, y) {
  const i = Math.floor(Math.random() * unlockedColors);
  fireworks.push(new Firework(x, y, colors[i], true));
  lastClick = Date.now();
}

document.addEventListener("click", e => { if (Date.now() - lastClick >= clickDelay) launchFirework(e.clientX, e.clientY); });

function awardAndSave(amount) { if (!Number.isFinite(amount)) return; money += Math.floor(Math.max(0, amount)); document.getElementById("money").textContent = money; saveProgressOnline(); saveScore(); }

function computeAndAward(base, skipChain = false, chainLvl = 1) {
  let chaosMultiplier = 1, goldenMultiplier = EVENTS_STATE.goldenFirework && Math.random() < 0.01 ? 10 : 1,
      luckyMultiplier = EVENTS_STATE.luckyExplosions && Math.random() < 0.1 ? 4 : 1,
      cosmicMultiplier = EVENTS_STATE.cosmicMode ? 2 : 1,
      doubleMultiplier = EVENTS_STATE.doubleMoney ? 2 : 1,
      rainbowMultiplier = EVENTS_STATE.rainbowMode ? 5 : 1,
      blackoutMultiplier = EVENTS_STATE.blackout ? 3 : 1,
      glitchMultiplier = EVENTS_STATE.glitch ? Math.random() * 3 : 1;
  awardAndSave(Math.round(base * chaosMultiplier * goldenMultiplier * luckyMultiplier * cosmicMultiplier * doubleMultiplier * rainbowMultiplier * blackoutMultiplier * glitchMultiplier));
  if (EVENTS_STATE.chainReaction && !skipChain) doChainReaction(base, chainLvl, 2);
}

function doChainReaction(base, level = 1, max = 2) {
  if (!EVENTS_STATE.chainReaction || level > max) return;
  for (let i = 0; i < 2; i++) {
    computeAndAward(Math.ceil(base / 2), true, level + 1);
    for (let j = 0; j < 20; j++) particles.push(new Particle(Math.random() * 100 + canvas.width / 2, Math.random() * canvas.height / 2, { color: `hsl(${Math.random()*360},100%,60%)` }));
  }
}

function animate() {
  ctx.fillStyle = EVENTS_STATE.blackout ? "rgba(0,0,0,0.98)" : "rgba(0,0,0,0.2)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.shadowBlur = EVENTS_STATE.doubleMoney ? 12 : (EVENTS_STATE.rainbowMode ? 20 : 0);
  ctx.shadowColor = EVENTS_STATE.doubleMoney ? "#ff0" : (EVENTS_STATE.rainbowMode ? "#f0f" : "#000");
  for (let i = fireworks.length-1; i >=0; i--) { if (fireworks[i].update()) fireworks.splice(i, 1); else fireworks[i].draw(); }
  for (let i = particles.length-1; i >=0; i--) { particles[i].update(); particles[i].draw(); if (particles[i].life <= 0) particles.splice(i,1); }
  const percent = Math.min(100, ((Date.now()-lastClick)/clickDelay)*100);
  document.getElementById("cooldownFill").style.width = percent + "%";
  document.getElementById("moneyMultiplier").textContent = rebirthCount + 1;
  requestAnimationFrame(animate);
}

animate();
