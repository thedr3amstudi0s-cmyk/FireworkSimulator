const canvas = document.getElementById("canvas"),
      ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;
window.addEventListener("resize", () => {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
});

const loginBox = document.getElementById("loginBox"),
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
    autoAmount = 0, autoSpeed = 2.5, autoInterval = null, fireworks = [], particles = [],
    gravity = 0.04;

const baseColors = [
    {color: "hsl(0,100%,60%)", value: 1},
    {color: "hsl(30,100%,60%)", value: 2},
    {color: "hsl(60,100%,60%)", value: 3},
    {color: "hsl(120,100%,60%)", value: 4},
    {color: "hsl(180,100%,60%)", value: 5},
    {color: "hsl(240,100%,60%)", value: 6}
];
let colors = [...baseColors];

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
const auth = firebase.auth(), db = firebase.database();

let EVENTS_STATE = {active:false, chainReaction:false, doubleMoney:false, rainbowMode:false, cosmicMode:false, luckyExplosions:false, chaosRoll:false, goldenFirework:false, adminStorm:false, blackout:false, glitch:false, name:"", description:"", endsAt:null};
let eventIntervalHandles = [];

function showEventBanner(name, desc, endsAt){
    eventNameEl.textContent = name;
    eventDescEl.textContent = desc || "";
    if(!endsAt){ eventTimerEl.textContent = ""; } 
    else { 
        const update = () => {
            const left = Math.max(0, endsAt - Date.now());
            eventTimerEl.textContent = left > 0 ? "Ends in "+Math.ceil(left/1000)+"s" : "Ending...";
        }; 
        update(); 
        eventIntervalHandles.push(setInterval(update,1000));
    }
    eventBanner.style.display = "block";
}

function hideEventBanner(){
    eventBanner.style.display = "none";
    eventNameEl.textContent = "";
    eventDescEl.textContent = "";
    eventTimerEl.textContent = "";
    eventIntervalHandles.forEach(i=>clearInterval(i));
    eventIntervalHandles=[];
}

// --- LOGIN FIX: SHOW/HIDE UI PROPERLY ---
auth.onAuthStateChanged(async user=>{
    if(user){
        currentUser=user.uid;
        loginBox.style.display="none";
        ui.style.display="block";
        resetBtn.style.display="block";
        ownerCommands.style.display=(user.email==="aaron.gatorfan@gmail.com"||user.uid==="ADMIN_UID_OR_EMAIL")?"block":"none";
        await loadProgressOnline();
    } else {
        currentUser="";
        loginBox.style.display="flex";  // <-- show login box
        ui.style.display="block";       // <-- keep original UI layout
        resetBtn.style.display="none";
        ownerCommands.style.display="none";
        money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; autoAmount=0; autoSpeed=2.5;
        clearInterval(autoInterval); autoInterval=null;
        document.getElementById("money").textContent="0";
        document.getElementById("unlockedColors").textContent="1";
        document.getElementById("moneyMultiplier").textContent="1";
        document.getElementById("delayDisplay").textContent="1200";
        document.getElementById("autoSpeedDisplay").textContent="2.50";
    }
});
