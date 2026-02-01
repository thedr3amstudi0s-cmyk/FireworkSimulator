// -------- CANVAS SETUP --------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;
window.addEventListener("resize", () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
});

// -------- UI ELEMENTS --------
const loginBox = document.getElementById("loginBox");
const ui = document.getElementById("ui");
const ownerCommands = document.getElementById("ownerCommands");
const resetBtn = document.getElementById("resetBtn");
const fireworkSound = document.getElementById("fireworkSound");

// Firebase login fields
const usernameInput = document.getElementById("username");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const forgotBtn = document.getElementById("forgotBtn");
const loginMsg = document.getElementById("loginMsg");

// Game buttons
const moneyEl = document.getElementById("money");
const unlockedColorsEl = document.getElementById("unlockedColors");
const delayDisplay = document.getElementById("delayDisplay");
const moneyMultiplier = document.getElementById("moneyMultiplier");
const autoSpeedDisplay = document.getElementById("autoSpeedDisplay");
const cooldownFill = document.getElementById("cooldownFill");

const buyColorBtn = document.getElementById("buyColor");
const reduceDelayBtn = document.getElementById("reduceDelay");
const rebirthBtn = document.getElementById("rebirth");
const buyAutoBtn = document.getElementById("buyAuto");
const goLeaderboardBtn = document.getElementById("goLeaderboardBtn");
const giveMoneyBtn = document.getElementById("giveMoneyBtn");
const unlockColorsBtn = document.getElementById("unlockColorsBtn");
const maxAutoBtn = document.getElementById("maxAutoBtn");
const viewUsersBtn = document.getElementById("viewUsersBtn");

// -------- GLOBAL VARIABLES --------
let currentUser = "";
let money = 0,
    unlockedColors = 1,
    clickDelay = 1200,
    lastClick = 0,
    rebirthCount = 0;
let colorPrice = 50,
    delayPrice = 100,
    rebirthPrice = 500,
    autoPrice = 200,
    autoAmount = 0,
    autoSpeed = 2.5,
    autoInterval = null;

let fireworks = [];
let particles = [];
const gravity = 0.04;

// Firework base colors
const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 },
];
let colors = [...baseColors];

// -------- FIREBASE SETUP --------
firebase.initializeApp({
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.firebasestorage.app",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
});
const auth = firebase.auth();
const db = firebase.database();

// -------- AUTH HANDLERS --------
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user.uid;
        loginBox.style.display = "none";
        ui.style.display = "block";
        resetBtn.style.display = "block";
        ownerCommands.style.display =
            user.email === "aaron.gatorfan@gmail.com" ? "block" : "none";
        await loadProgressOnline();
    } else {
        currentUser = "";
        loginBox.style.display = "flex";
        ui.style.display = "none";
        resetBtn.style.display = "none";
        ownerCommands.style.display = "none";

        // reset local stats
        money = 0;
        unlockedColors = 1;
        clickDelay = 1200;
        rebirthCount = 0;
        autoAmount = 0;
        autoSpeed = 2.5;
        clearInterval(autoInterval);
        autoInterval = null;
        updateUI();
    }
});

// -------- LOGIN/SIGNUP --------
loginBtn.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();
    loginMsg.style.color = "yellow";

    if (!email || !pass) {
        loginMsg.textContent = "Enter email & password!";
        return;
    }

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        loginMsg.textContent = "";
    } catch (err) {
        loginMsg.textContent = err.message;
    }
});

signupBtn.addEventListener("click", async () => {
    const uname = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passwordInput.value.trim();
    loginMsg.style.color = "yellow";

    if (!uname || !email || !pass) {
        loginMsg.textContent = "Enter all fields!";
        return;
    }
    if (pass.length < 6) {
        loginMsg.textContent = "Password must be at least 6 characters!";
        return;
    }

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        currentUser = cred.user.uid;
        await db.ref("usernames/" + currentUser).set(uname);
        loginMsg.style.color = "lime";
        loginMsg.textContent = "Account created!";
    } catch (err) {
        loginMsg.style.color = "red";
        loginMsg.textContent = err.message;
    }
});

forgotBtn.addEventListener("click", () => {
    const email = emailInput.value.trim();
    if (!email) {
        loginMsg.textContent = "Enter email!";
        return;
    }
    auth
        .sendPasswordResetEmail(email)
        .then(() => (loginMsg.textContent = "Password reset email sent!"))
        .catch((err) => (loginMsg.textContent = err.message));
});

// -------- FIREWORK CLASSES --------
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

// -------- FIREWORK LOGIC --------
function explode(x, y, colorObj) {
    fireworkSound.currentTime = 0;
    fireworkSound.play();
    for (let i = 0; i < 80; i++) particles.push(new Particle(x, y, colorObj));
    money += colorObj.value * (rebirthCount + 1);
    updateUI();
    saveProgressOnline();
    saveScore();
}

function launchFirework(x, y) {
    const colorIndex = Math.floor(Math.random() * unlockedColors);
    fireworks.push(new Firework(x, y, colors[colorIndex]));
    lastClick = Date.now();
}

// -------- CANVAS CLICK --------
document.addEventListener("click", (e) => {
    if (Date.now() - lastClick >= clickDelay) launchFirework(e.clientX, e.clientY);
});

// -------- ANIMATION LOOP --------
function animate() {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
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
    cooldownFill.style.width = Math.min(100, (elapsed / clickDelay) * 100) + "%";
    moneyMultiplier.textContent = rebirthCount + 1;

    requestAnimationFrame(animate);
}
animate();

// -------- PROGRESS --------
async function saveProgressOnline() {
    if (!currentUser) return;
    await db.ref("progress/" + currentUser).set({
        money,
        unlockedColors,
        clickDelay,
        rebirthCount,
        colorPrice,
        delayPrice,
        rebirthPrice,
        autoAmount,
        autoSpeed,
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
        colorPrice = p.colorPrice || 50;
        delayPrice = p.delayPrice || 100;
        rebirthPrice = p.rebirthPrice || 500;
        autoAmount = p.autoAmount || 0;
        autoSpeed = p.autoSpeed || 2.5;
        colors = [...baseColors];
        updateUI();
        startAutoLaunch();
    }
}

// -------- UI UPDATE --------
function updateUI() {
    moneyEl.textContent = money;
    unlockedColorsEl.textContent = unlockedColors;
    delayDisplay.textContent = clickDelay;
    moneyMultiplier.textContent = rebirthCount + 1;
    autoSpeedDisplay.textContent = autoSpeed.toFixed(2);

    buyColorBtn.textContent =
        unlockedColors >= colors.length ? "MAX" : `Buy Color ($${colorPrice})`;
    reduceDelayBtn.textContent =
        clickDelay <= 100 ? "MAX" : `Reduce Delay ($${delayPrice})`;
    buyAutoBtn.textContent =
        autoAmount >= 3 ? "MAX" : `Buy Auto-Launch ($${autoPrice})`;
    rebirthBtn.textContent = `Rebirth ($${rebirthPrice})`;
}

// -------- BUTTON LOGIC --------
buyColorBtn.addEventListener("click", () => {
    if (money >= colorPrice && unlockedColors < colors.length) {
        money -= colorPrice;
        unlockedColors++;
        colorPrice = Math.floor(colorPrice * 1.7);
        updateUI();
        saveProgressOnline();
    }
});

reduceDelayBtn.addEventListener("click", () => {
    if (money >= delayPrice && clickDelay > 100) {
        money -= delayPrice;
        clickDelay = Math.max(clickDelay - 100, 100);
        delayPrice = Math.floor(delayPrice * 1.7);
        updateUI();
        saveProgressOnline();
    }
});

buyAutoBtn.addEventListener("click", () => {
    if (money >= autoPrice && autoAmount < 3) {
        money -= autoPrice;
        autoAmount++;
        autoSpeed /= 1.2;
        autoPrice = Math.floor(autoPrice * 1.7);
        updateUI();
        saveProgressOnline();
        startAutoLaunch();
    }
});

rebirthBtn.addEventListener("click", () => {
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
        updateUI();
        saveProgressOnline();
        startAutoLaunch();
        alert("Rebirth complete!");
    } else alert(`Need $${rebirthPrice} to rebirth!`);
});

// -------- AUTO LAUNCH --------
function startAutoLaunch() {
    if (autoInterval) clearInterval(autoInterval);
    if (autoAmount > 0)
        autoInterval = setInterval(() => {
            launchFirework(Math.random() * canvas.width, Math.random() * canvas.height / 2);
        }, autoSpeed * 1000);
}

// -------- SCORE & LEADERBOARD --------
function saveScore() {
    if (!currentUser) return;
    db.ref("scores/" + currentUser)
        .set({ money })
        .catch(console.error);
}

goLeaderboardBtn.addEventListener("click", () => {
    window.open("fireworkleaderboard.html", "_blank");
});
