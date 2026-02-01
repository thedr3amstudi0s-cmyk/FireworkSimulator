// -------- FIREBASE CONFIG --------
const firebaseConfig = {
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.firebasestorage.app",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
    measurementId: "G-H07BZY385S"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// -------- GLOBAL VARIABLES --------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });

const loginBox = document.getElementById("loginBox");
const loginBtn = document.getElementById("loginBtn");
const signupBtn = document.getElementById("signupBtn");
const loginMsg = document.getElementById("loginMsg");
const ui = document.getElementById("ui");
const resetBtn = document.getElementById("resetBtn");
const ownerCommands = document.getElementById("ownerCommands");
const goLeaderboardBtn = document.getElementById("goLeaderboardBtn");
const eventBanner = document.getElementById("eventBanner");
const eventNameEl = document.getElementById("eventName");
const eventDescEl = document.getElementById("eventDesc");
const eventTimerEl = document.getElementById("eventTimer");
const fireworkSound = document.getElementById("fireworkSound");

let currentUser = "";
let money = 0, unlockedColors = 1, clickDelay = 1200, lastClick = 0, rebirthCount = 0;
let colorPrice = 50, delayPrice = 100, rebirthPrice = 500, autoPrice = 200, autoAmount = 0, autoSpeed = 2.5;
let fireworks = [], particles = [], gravity = 0.04, autoInterval = null;

const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
];
let colors = [...baseColors];

// -------- EVENTS STATE --------
let EVENTS_STATE = {
    active: false,
    chainReaction: false,
    doubleMoney: false,
    rainbowMode: false,
    cosmicMode: false,
    luckyExplosions: false,
    chaosRoll: false,
    goldenFirework: false,
    adminStorm: false,
    blackout: false,
    glitch: false,
    name: "",
    description: "",
    endsAt: null
};
let eventIntervals = [];

// -------- HELPER FUNCTIONS --------
function showEventBanner(name, desc, endsAt) {
    eventNameEl.textContent = name;
    eventDescEl.textContent = desc || "";
    if (!endsAt) {
        eventTimerEl.textContent = "";
    } else {
        const update = () => {
            const remaining = Math.max(0, endsAt - Date.now());
            if (remaining <= 0) { eventTimerEl.textContent = "Ending..."; return; }
            eventTimerEl.textContent = `Ends in ${Math.ceil(remaining/1000)}s`;
        };
        update();
        const id = setInterval(update, 1000);
        eventIntervals.push(id);
    }
    eventBanner.style.display = "block";
}

function hideEventBanner() {
    eventBanner.style.display = "none";
    eventNameEl.textContent = "";
    eventDescEl.textContent = "";
    eventTimerEl.textContent = "";
    eventIntervals.forEach(i => clearInterval(i));
    eventIntervals = [];
}

function flashScreen(color, duration=150) {
    ctx.fillStyle = color;
    ctx.fillRect(0,0,canvas.width,canvas.height);
}

// -------- AUTH --------
auth.onAuthStateChanged(async user => {
    if (user) {
        currentUser = user.uid;
        loginBox.style.display = "none";
        ui.style.display = "block";
        resetBtn.style.display = "block";
        ownerCommands.style.display = (user.email==="aaron.gatorfan@gmail.com") ? "block" : "none";
        await loadProgressOnline();
    } else {
        currentUser = "";
        loginBox.style.display = "block";
        ui.style.display = "none";
        resetBtn.style.display = "none";
        ownerCommands.style.display = "none";
    }
});

// Forgot password
document.getElementById("forgotBtn").addEventListener("click", () => {
    const email = document.getElementById("email").value.trim();
    if (!email) { loginMsg.textContent = "Enter email!"; return; }
    auth.sendPasswordResetEmail(email)
        .then(()=>loginMsg.textContent="Password reset email sent!")
        .catch(err=>loginMsg.textContent=err.message);
});

// Login
loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();
    if (!email || !pass) { loginMsg.textContent="Enter email & password!"; return; }
    try {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        currentUser = cred.user.uid;
        loginBox.style.display = "none";
        ui.style.display = "block";
        resetBtn.style.display = "block";
        ownerCommands.style.display = (cred.user.email==="aaron.gatorfan@gmail.com") ? "block" : "none";
        await loadProgressOnline();
    } catch(err){ loginMsg.textContent = err.message; }
});

// Signup
signupBtn.addEventListener("click", async () => {
    const uname = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const pass = document.getElementById("password").value.trim();
    if (!uname || !email || !pass) { loginMsg.textContent="Enter all fields!"; return; }
    if (pass.length<6) { loginMsg.textContent="Password min 6 chars"; return; }
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        currentUser = cred.user.uid;
        await db.ref("users/" + currentUser).set({username: uname});
        loginBox.style.display = "none"; ui.style.display = "block"; resetBtn.style.display = "block";
        ownerCommands.style.display = (cred.user.email==="aaron.gatorfan@gmail.com") ? "block" : "none";
        await saveProgressOnline();
    } catch(err){ loginMsg.textContent = err.message; }
});

// -------- FIREWORK & PARTICLE CLASSES --------
class Firework{
    constructor(x,y,colorObj){ this.x=x; this.y=canvas.height; this.targetY=y; this.speed=Math.random()*2+4; this.colorObj=colorObj; }
    update(){ this.y-=this.speed; if(this.y<=this.targetY){ explode(this.x,this.y,this.colorObj); return true;} return false; }
    draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fillStyle=this.colorObj.color; ctx.fill(); }
}

class Particle{
    constructor(x,y,colorObj){ this.x=x; this.y=y; this.color=colorObj.color; this.speedX=(Math.random()-0.5)*6; this.speedY=(Math.random()-0.5)*6; this.life=100; }
    update(){ this.speedY+=gravity; this.x+=this.speedX; this.y+=this.speedY; this.life--; }
    draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fillStyle=this.color; ctx.fill(); }
}

// -------- EXPLOSIONS --------
function explode(x,y,colorObj){
    fireworkSound.currentTime=0; fireworkSound.play();
    for(let i=0;i<80;i++) particles.push(new Particle(x,y,colorObj));
    if(EVENTS_STATE.rainbowMode) colorObj = {color:`hsl(${Math.floor(Math.random()*360)},100%,60%)`, value: colorObj.value};
    computeAndAward(colorObj.value*(rebirthCount+1));
}

// -------- AWARD MONEY & EVENTS --------
function awardAndSave(amount){
    if (!Number.isFinite(amount)) return;
    amount = Math.max(0, Math.floor(amount));
    money+=amount;
    document.getElementById("money").textContent = money;
    saveProgressOnline();
    saveScore();
}

function computeAndAward(baseMoney){
    let base = Math.max(0, Math.floor(baseMoney));
    let multiplier = 1;
    if(EVENTS_STATE.doubleMoney) multiplier*=2;
    if(EVENTS_STATE.rainbowMode) multiplier*=5;
    if(EVENTS_STATE.cosmicMode) multiplier*=2;
    if(EVENTS_STATE.luckyExplosions && Math.random()<0.10) multiplier*=4;
    if(EVENTS_STATE.blackout) multiplier*=3;
    if(EVENTS_STATE.glitch) multiplier*=(Math.random()*3);
    if(EVENTS_STATE.chaosRoll){
        const chaosPick = ["0.5","1","2","5","chain"][Math.floor(Math.random()*5)];
        if(chaosPick!=="chain") multiplier*=parseFloat(chaosPick);
    }
    const awarded = Math.round(base*multiplier);
    awardAndSave(awarded);
}

// -------- LAUNCH --------
function launchFirework(x,y){
    const colorIndex = Math.floor(Math.random()*unlockedColors);
    const colorObj = colors[colorIndex];
    fireworks.push(new Firework(x,y,colorObj));
    lastClick = Date.now();
}

// Click event with rate limit
document.addEventListener("click", e=>{
    if(Date.now()-lastClick>=clickDelay) launchFirework(e.clientX,e.clientY);
});

// -------- ANIMATION LOOP --------
function animate(){
    ctx.fillStyle = EVENTS_STATE.blackout ? "rgba(0,0,0,0.98)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if(EVENTS_STATE.doubleMoney) { ctx.shadowBlur=12; ctx.shadowColor="#ff0"; }
    else if(EVENTS_STATE.rainbowMode) { ctx.shadowBlur=20; ctx.shadowColor="#f0f"; }
    else ctx.shadowBlur=0;
    for(let i=fireworks.length-1;i>=0;i--) if(fireworks[i].update()) fireworks.splice(i,1); else fireworks[i].draw();
    for(let i=particles.length-1;i>=0;i--){ particles[i].update(); particles[i].draw(); if(particles[i].life<=0) particles.splice(i,1); }
    const fill = Math.min(100,((Date.now()-lastClick)/clickDelay)*100);
    document.getElementById("cooldownFill").style.width=fill+"%";
    document.getElementById("moneyMultiplier").textContent=(rebirthCount+1);
    requestAnimationFrame(animate);
}
animate();

// -------- SAVE/LOAD --------
async function saveProgressOnline(){
    if(!currentUser) return;
    money=Math.max(0,Math.min(money,1e9));
    clickDelay=Math.max(100,clickDelay);
    unlockedColors=Math.min(unlockedColors,colors.length);
    rebirthCount=Math.max(0,rebirthCount);
    autoAmount=Math.min(Math.max(autoAmount,0),3);
    const progress={money,unlockedColors,clickDelay,rebirthCount,rebirthPrice,colorPrice,delayPrice,autoAmount,autoSpeed};
    await db.ref("progress/"+currentUser).set(progress);
}

async function loadProgressOnline(){
    if(!currentUser) return;
    const snap = await db.ref("progress/"+currentUser).once("value");
    const p = snap.val();
    if(p){
        money=p.money||0; unlockedColors=p.unlockedColors||1; clickDelay=p.clickDelay||1200;
        rebirthCount=p.rebirthCount||0; rebirthPrice=p.rebirthPrice||500;
        colorPrice=p.colorPrice||50; delayPrice=p.delayPrice||100;
        autoAmount=p.autoAmount||0; autoSpeed=p.autoSpeed||2.5;
        colors=[...baseColors];
        if(unlockedColors>colors.length) unlockedColors=colors.length;
        document.getElementById("money").textContent=money;
        updateButtons();
        startAutoLaunch();
    }
}

// -------- BUTTONS --------
function updateButtons(){
    document.getElementById("buyColor").textContent=unlockedColors>=colors.length?"MAX":`Buy Color ($${colorPrice})`;
    document.getElementById("reduceDelay").textContent=clickDelay<=100?"MAX":`Reduce Delay ($${delayPrice})`;
    document.getElementById("buyAuto").textContent=autoAmount>=3?"MAX":`Buy Auto-Launch ($${autoPrice})`;
    document.getElementById("rebirth").textContent=`Rebirth ($${rebirthPrice})`;
    document.getElementById("delayDisplay").textContent=clickDelay;
    document.getElementById("autoSpeedDisplay").textContent=autoSpeed.toFixed(2);
    document.getElementById("unlockedColors").textContent=unlockedColors;
}

document.getElementById("buyColor").addEventListener("click",()=>{
    if(money>=colorPrice && unlockedColors<colors.length){ money-=colorPrice; unlockedColors++; colorPrice=Math.floor(colorPrice*1.7); updateButtons(); document.getElementById("money").textContent=money; saveProgressOnline(); }
});
document.getElementById("reduceDelay").addEventListener("click",()=>{
    if(money>=delayPrice && clickDelay>100){ money-=delayPrice; clickDelay=Math.max(clickDelay-100,100); delayPrice=Math.floor(delayPrice*1.7); updateButtons(); document.getElementById("money").textContent=money; saveProgressOnline(); }
});
document.getElementById("buyAuto").addEventListener("click",()=>{
    if(autoAmount<3 && money>=autoPrice){ money-=autoPrice; autoAmount++; autoSpeed/=1.2; autoPrice=Math.floor(autoPrice*1.7); document.getElementById("money").textContent=money; updateButtons(); saveProgressOnline(); startAutoLaunch(); }
});

document.getElementById("rebirth").addEventListener("click", async ()=>{
    if(money>=rebirthPrice){
        money=0; rebirthCount++; unlockedColors=1; clickDelay=1200; autoAmount=0; autoSpeed=2.5; autoPrice=200; colorPrice=50; delayPrice=100; rebirthPrice=Math.floor(rebirthPrice*1.7);
        colors=[...baseColors];
        updateButtons(); document.getElementById("money").textContent=money; await saveProgressOnline(); startAutoLaunch(); alert("Rebirth complete!");
    } else alert(`Need $${rebirthPrice} to rebirth!`);
});

resetBtn.addEventListener("click", async ()=>{
    if(confirm("Reset progress?")){
        money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; colorPrice=50; delayPrice=100; rebirthPrice=500; autoAmount=0; autoSpeed=2.5; clearInterval(autoInterval); autoInterval=null; colors=[...baseColors]; updateButtons(); document.getElementById("money").textContent=money; await saveProgressOnline(); alert("Progress reset!");
    }
});

document.getElementById("logoutBtn").addEventListener("click", ()=>{
    if(confirm("Log out?")){ auth.signOut().then(()=>location.reload()); }
});

function startAutoLaunch(){
    if(autoInterval) clearInterval(autoInterval);
    if(autoAmount>0) autoInterval=setInterval(()=>launchFirework(Math.random()*canvas.width,Math.random()*canvas.height/2),autoSpeed*1000);
}

// -------- SAVE SCORE --------
function saveScore(){
    if(!currentUser) return;
    db.ref("scores/"+currentUser).once("value").then(snap=>{
        const oldMoney=snap.val()?.money||0;
        db.ref("scores/"+currentUser).set({money:Math.max(oldMoney,money)});
    }).catch(err=>console.error(err));
}

goLeaderboardBtn.addEventListener("click",()=>{ window.open("fireworkleaderboard.html","_blank"); });

// -------- OWNER EVENTS --------
async function toggleEvent(flag, name, desc, duration){
    const snap = await db.ref("events").once("value"); const cur = snap.val() || {};
    cur[flag] = !cur[flag]; cur.active=true; cur.name=name; cur.description=cur[flag]?desc:""; cur.endsAt=cur[flag]?Date.now()+duration:null;
    await db.ref("events").set(cur);
}

// Admin buttons simplified
document.getElementById("toggleDouble").addEventListener("click",()=>toggleEvent("doubleMoney","Double Money","2x rewards",60000));
document.getElementById("toggleRainbow").addEventListener("click",()=>toggleEvent("rainbowMode","Rainbow Mode","5x rewards",30000));
document.getElementById("toggleChain").addEventListener("click",()=>toggleEvent("chainReaction","Chain Reaction","Explosions spawn smaller explosions",45000));
document.getElementById("toggleCosmic").addEventListener("click",()=>toggleEvent("cosmicMode","Cosmic Mode","2x rewards + visuals",60000));
document.getElementById("toggleLucky").addEventListener("click",()=>toggleEvent("luckyExplosions","Lucky Explosions","10% chance for 4x reward",30000));
document.getElementById("toggleChaos").addEventListener("click",()=>toggleEvent("chaosRoll","Chaos Roll","Random multipliers",60000));
document.getElementById("toggleBlackout").addEventListener("click",()=>toggleEvent("blackout","Blackout","Dark screen + rewards",30000));
document.getElementById("toggleGlitch").addEventListener("click",()=>toggleEvent("glitch","Glitch Event","Random multiplier + chaos",30000));
document.getElementById("triggerAdminStorm").addEventListener("click",()=>toggleEvent("adminStorm","Admin Firework Storm","Owner triggered storm!",20000));
document.getElementById("giveMoneyBtn").addEventListener("click",()=>{ money+=10000; document.getElementById("money").textContent=money; saveProgressOnline(); });
document.getElementById("unlockColorsBtn").addEventListener("click",()=>{ unlockedColors=colors.length; updateButtons(); });
document.getElementById("maxAutoBtn").addEventListener("click",()=>{ autoAmount=3; autoSpeed=0.5; startAutoLaunch(); updateButtons(); });

// -------- EVENTS SYNC --------
db.ref("events").on("value", snap=>{
    const e = snap.val() || {};
    Object.assign(EVENTS_STATE,e);
    if(EVENTS_STATE.active && EVENTS_STATE.name) showEventBanner(EVENTS_STATE.name,EVENTS_STATE.description,EVENTS_STATE.endsAt);
    else hideEventBanner();
});

// -------- GLOBAL ANNOUNCE --------
document.getElementById("adminAnnounce").addEventListener("click",async ()=>{
    const msg = prompt("Enter announcement:"); if(!msg) return;
    await db.ref("announcements").push({text: msg, ts: Date.now()});
});

// Display announcements
db.ref("announcements").on("child_added", snap=>{
    const a = snap.val();
    alert("Announcement: "+a.text);
});
