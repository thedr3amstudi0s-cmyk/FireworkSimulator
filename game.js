// ---------------------- CANVAS SETUP ----------------------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;
window.addEventListener("resize", () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
});

// ---------------------- DOM ELEMENTS ----------------------
const loginBox = document.getElementById("loginBox");
const ui = document.getElementById("ui");
const ownerCommands = document.getElementById("ownerCommands");
const resetBtn = document.getElementById("resetBtn");
const logoutBtn = document.getElementById("logoutBtn");
const fireworkSound = document.getElementById("fireworkSound");
const eventBanner = document.getElementById("eventBanner");
const eventNameEl = document.getElementById("eventName");
const eventDescEl = document.getElementById("eventDesc");
const eventTimerEl = document.getElementById("eventTimer");

// ---------------------- GLOBAL VARIABLES ----------------------
let currentUser = "";
let money = 0,
    unlockedColors = 1,
    clickDelay = 1200,
    lastClick = 0,
    rebirthCount = 0,
    colorPrice = 50,
    delayPrice = 100,
    rebirthPrice = 500,
    autoAmount = 0,
    autoSpeed = 2.5,
    autoInterval = null,
    fireworks = [],
    particles = [],
    gravity = 0.04;

const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
];
let colors = [...baseColors];

// ---------------------- FIREBASE ----------------------
firebase.initializeApp({
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.firebasestorage.app",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
    measurementId: "G-H07BZY385S"
});
const auth = firebase.auth();
const db = firebase.database();

// ---------------------- EVENTS ----------------------
let EVENTS_STATE = {
    doubleMoney: false,
    rainbowMode: false,
    cosmicMode: false,
    chainReaction: false,
    luckyExplosions: false,
    goldenFirework: false,
    adminStorm: false,
    blackout: false,
    glitch: false
};
let eventTimeouts = [];
let adminStormInterval = null;

function showEventBanner(name, desc, duration = 0) {
    eventNameEl.textContent = name;
    eventDescEl.textContent = desc;
    if (duration > 0) {
        let endTime = Date.now() + duration;
        const updateTimer = () => {
            const remaining = Math.max(0, endTime - Date.now());
            eventTimerEl.textContent = remaining > 0 ? `Ends in ${Math.ceil(remaining / 1000)}s` : "Ending...";
            if (remaining <= 0) clearInterval(timerInterval);
        };
        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
        eventTimeouts.push(timerInterval);
    } else {
        eventTimerEl.textContent = "";
    }
    eventBanner.style.display = "block";
}

function hideEventBanner() {
    eventBanner.style.display = "none";
    eventNameEl.textContent = "";
    eventDescEl.textContent = "";
    eventTimerEl.textContent = "";
    eventTimeouts.forEach(t => clearInterval(t));
    eventTimeouts = [];
}

// ---------------------- AUTH ----------------------
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user.uid;
        loginBox.style.display = "none";
        ui.style.display = "block";
        resetBtn.style.display = "block";
        ownerCommands.style.display = (user.email === "aaron.gatorfan@gmail.com") ? "block" : "none";
        await loadProgressOnline();
    } else {
        currentUser = "";
        loginBox.style.display = "flex";
        ui.style.display = "none";
        resetBtn.style.display = "none";
        ownerCommands.style.display = "none";
        money = 0;
        unlockedColors = 1;
        clickDelay = 1200;
        rebirthCount = 0;
        autoAmount = 0;
        autoSpeed = 2.5;
        clearInterval(autoInterval);
        autoInterval = null;
        document.getElementById("money").textContent = "0";
        document.getElementById("unlockedColors").textContent = "1";
        document.getElementById("moneyMultiplier").textContent = "1";
        document.getElementById("delayDisplay").textContent = "1200";
        document.getElementById("autoSpeedDisplay").textContent = "2.50";
    }
});

// ---------------------- FIREWORK CLASSES ----------------------
class Firework {
    constructor(x, y, colorObj) {
        this.x = x;
        this.y = canvas.height;
        this.targetY = y;
        this.speed = Math.random() * 2 + 4;
        this.colorObj = colorObj;
    }
    update() {
        this.y -= this.speed;
        if (this.y <= this.targetY) {
            explode(this.x, this.y, this.colorObj);
            return true;
        }
        return false;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.colorObj.color;
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, colorObj) {
        this.x = x;
        this.y = y;
        this.color = colorObj.color;
        this.speedX = (Math.random() - 0.5) * 6;
        this.speedY = (Math.random() - 0.5) * 6;
        this.life = 100;
    }
    update() {
        this.speedY += gravity;
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

// ---------------------- FIREWORK LOGIC ----------------------
function explode(x, y, colorObj) {
    fireworkSound.currentTime = 0;
    fireworkSound.play();

    for (let i = 0; i < 80; i++)
        particles.push(new Particle(x, y, colorObj));

    // Rainbow Mode: random color
    if (EVENTS_STATE.rainbowMode)
        colorObj = { color: `hsl(${Math.random() * 360},100%,60%)`, value: colorObj.value };

    // Golden Firework
    let goldenMultiplier = EVENTS_STATE.goldenFirework && Math.random() < 0.01 ? 10 : 1;
    let cosmicMultiplier = EVENTS_STATE.cosmicMode ? 2 : 1;
    let doubleMultiplier = EVENTS_STATE.doubleMoney ? 2 : 1;
    let rainbowMultiplier = EVENTS_STATE.rainbowMode ? 1 : 1;
    let blackoutMultiplier = EVENTS_STATE.blackout ? 3 : 1;
    let glitchMultiplier = EVENTS_STATE.glitch ? Math.random() * 3 : 1;
    let luckyMultiplier = EVENTS_STATE.luckyExplosions && Math.random() < 0.1 ? 4 : 1;

    let total = colorObj.value * (rebirthCount + 1) * goldenMultiplier * cosmicMultiplier *
        doubleMultiplier * rainbowMultiplier * blackoutMultiplier * glitchMultiplier * luckyMultiplier;

    awardAndSave(total);

    // Chain Reaction
    if (EVENTS_STATE.chainReaction)
        for (let i = 0; i < 2; i++)
            launchFirework(Math.random() * canvas.width, Math.random() * canvas.height / 2);
}

function launchFirework(x, y) {
    const i = Math.floor(Math.random() * unlockedColors);
    fireworks.push(new Firework(x, y, colors[i]));
    lastClick = Date.now();
}

document.addEventListener("click", e => {
    if (Date.now() - lastClick >= clickDelay)
        launchFirework(e.clientX, e.clientY);
});

function awardAndSave(amount) {
    if (!Number.isFinite(amount)) return;
    money += Math.floor(amount);
    document.getElementById("money").textContent = money;
    saveProgressOnline();
    saveScore();
}

// ---------------------- ANIMATION ----------------------
function animate() {
    ctx.fillStyle = EVENTS_STATE.blackout ? "rgba(0,0,0,0.98)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let i = fireworks.length - 1; i >= 0; i--) {
        if (fireworks[i].update()) fireworks.splice(i, 1);
        else fireworks[i].draw();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        particles[i].draw();
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    const elapsed = Date.now() - lastClick;
    const fill = Math.min(100, (elapsed / clickDelay) * 100);
    document.getElementById("cooldownFill").style.width = fill + "%";

    document.getElementById("moneyMultiplier").textContent = (rebirthCount + 1);

    requestAnimationFrame(animate);
}
animate();

// ---------------------- SAVE / LOAD ----------------------
async function saveProgressOnline() {
    if (!currentUser) return;
    await db.ref("progress/" + currentUser).set({
        money,
        unlockedColors,
        clickDelay,
        rebirthCount,
        rebirthPrice,
        colorPrice,
        delayPrice,
        autoAmount,
        autoSpeed
    });
}

async function loadProgressOnline() {
    if (!currentUser) return;
    const snap = await db.ref("progress/" + currentUser).once("value");
    const p = snap.val();
    if (p) {
        money = p.money || 0;
        unlockedColors = p.unlockedColors || 1;
        clickDelay = p.clickDelay || 1200;
        rebirthCount = p.rebirthCount || 0;
        rebirthPrice = p.rebirthPrice || 500;
        colorPrice = p.colorPrice || 50;
        delayPrice = p.delayPrice || 100;
        autoAmount = p.autoAmount || 0;
        autoSpeed = p.autoSpeed || 2.5;
        colors = [...baseColors];
        for (let i = 0; i < rebirthCount; i++)
            colors.push({ color: `hsl(${Math.random() * 360},100%,70%)`, value: i + 7 });
        if (unlockedColors > colors.length) unlockedColors = colors.length;
        document.getElementById("money").textContent = money;
        updateButtons();
        startAutoLaunch();
    }
}

// ---------------------- BUTTONS ----------------------
function updateButtons() {
    document.getElementById("buyColor").textContent = unlockedColors >= colors.length ? "MAX" : `Buy Color ($${colorPrice})`;
    document.getElementById("reduceDelay").textContent = clickDelay <= 100 ? "MAX" : `Reduce Delay ($${delayPrice})`;
    document.getElementById("buyAuto").textContent = autoAmount >= 3 ? "MAX" : `Buy Auto-Launch ($${autoPrice})`;
    document.getElementById("rebirth").textContent = `Rebirth ($${rebirthPrice})`;
    document.getElementById("delayDisplay").textContent = clickDelay;
    document.getElementById("autoSpeedDisplay").textContent = autoSpeed.toFixed(2);
    document.getElementById("unlockedColors").textContent = unlockedColors;
}

document.getElementById("buyColor").addEventListener("click", () => {
    if (money >= colorPrice && unlockedColors < colors.length) {
        money -= colorPrice;
        unlockedColors++;
        colorPrice = Math.floor(colorPrice * 1.7);
        updateButtons();
        document.getElementById("money").textContent = money;
        saveProgressOnline();
    }
});
document.getElementById("reduceDelay").addEventListener("click", () => {
    if (money >= delayPrice && clickDelay > 100) {
        money -= delayPrice;
        clickDelay = Math.max(clickDelay - 100, 100);
        delayPrice = Math.floor(delayPrice * 1.7);
        updateButtons();
        document.getElementById("money").textContent = money;
        saveProgressOnline();
    }
});
document.getElementById("buyAuto").addEventListener("click", () => {
    if (autoAmount < 3 && money >= autoPrice) {
        money -= autoPrice;
        autoAmount++;
        autoSpeed /= 1.2;
        autoPrice = Math.floor(autoPrice * 1.7);
        document.getElementById("money").textContent = money;
        updateButtons();
        saveProgressOnline();
        startAutoLaunch();
    }
});
document.getElementById("rebirth").addEventListener("click", async () => {
    if (money >= rebirthPrice) {
        money = 0;
        rebirthCount++;
        unlockedColors = 1;
        clickDelay = 1200;
        autoAmount = 0;
        autoSpeed = 2.5;
        autoPrice = 200;
        colorPrice = 50;
        delayPrice = 100;
        rebirthPrice = Math.floor(rebirthPrice * 1.7);
        colors = [...baseColors];
        for (let i = 0; i < rebirthCount; i++)
            colors.push({ color: `hsl(${Math.random() * 360},100%,70%)`, value: i + 7 });
        updateButtons();
        document.getElementById("money").textContent = money;
        await saveProgressOnline();
        saveScore();
        startAutoLaunch();
        alert("Rebirth complete!");
    } else alert(`Need $${rebirthPrice} to rebirth!`);
});

resetBtn.addEventListener("click", async () => {
    if (confirm("Reset progress?")) {
        money = 0;
        unlockedColors = 1;
        clickDelay = 1200;
        rebirthCount = 0;
        colorPrice = 50;
        delayPrice = 100;
        rebirthPrice = 500;
        autoAmount = 0;
        autoSpeed = 2.5;
        clearInterval(autoInterval);
        autoInterval = null;
        colors = [...baseColors];
        updateButtons();
        document.getElementById("money").textContent = money;
        await saveProgressOnline();
        saveScore();
        alert("Progress reset!");
    }
});

logoutBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to log out?"))
        auth.signOut();
});

function startAutoLaunch() {
    if (autoInterval) clearInterval(autoInterval);
    if (autoAmount > 0) autoInterval = setInterval(() => {
        launchFirework(Math.random() * canvas.width, Math.random() * canvas.height / 2);
    }, autoSpeed * 1000);
}

function saveScore() {
    if (!currentUser) return;
    db.ref("scores/" + currentUser).once("value").then(s => {
        const old = s.val()?.money || 0;
        const newM = Math.max(old, money);
        db.ref("scores/" + currentUser).set({ money: newM });
    }).catch(console.error);
}

// ---------------------- OWNER EVENTS ----------------------
const adminBtns = document.querySelectorAll("#ownerCommands button");
adminBtns.forEach(btn => btn.addEventListener("click", () => {
    const eventName = btn.dataset.event;
    const duration = 10000; // 10 seconds for testing
    clearAllEvents();
    switch (eventName) {
        case "doubleMoney": EVENTS_STATE.doubleMoney = true; showEventBanner("Double Money!", "All fireworks give double rewards!", duration); break;
        case "rainbowMode": EVENTS_STATE.rainbowMode = true; showEventBanner("Rainbow Mode!", "Fireworks have random colors!", duration); break;
        case "cosmicMode": EVENTS_STATE.cosmicMode = true; showEventBanner("Cosmic Mode!", "Double multiplier!", duration); break;
        case "chainReaction": EVENTS_STATE.chainReaction = true; showEventBanner("Chain Reaction!", "Extra chain fireworks!", duration); break;
        case "luckyExplosions": EVENTS_STATE.luckyExplosions = true; showEventBanner("Lucky Explosions!", "10% chance 4x reward!", duration); break;
        case "goldenFirework": EVENTS_STATE.goldenFirework = true; showEventBanner("Golden Firework!", "1% chance 10x reward!", duration); break;
        case "blackout": EVENTS_STATE.blackout = true; showEventBanner("Blackout!", "Screen dims, multipliers active.", duration); break;
        case "glitch": EVENTS_STATE.glitch = true; showEventBanner("Glitch!", "Random physics!", duration); break;
        case "adminStorm":
            EVENTS_STATE.adminStorm = true;
            showEventBanner("Admin Storm!", "Rapid fireworks everywhere!", duration);
            adminStormInterval = setInterval(() => {
                launchFirework(Math.random() * canvas.width, Math.random() * canvas.height / 2);
            }, 200);
            break;
    }
    setTimeout(() => {
        clearAllEvents();
    }, duration);
}));

function clearAllEvents() {
    for (let key in EVENTS_STATE) EVENTS_STATE[key] = false;
    hideEventBanner();
    if (adminStormInterval) clearInterval(adminStormInterval);
}

// ---------------------- LEADERBOARD ----------------------
document.getElementById("goLeaderboardBtn").addEventListener("click", () => {
    window.open("fireworkleaderboard.html", "_blank");
});
