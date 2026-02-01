(() => {
  // ---- Firebase config ----
  const firebaseConfig = {
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.firebaseapp.com",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
    measurementId: "G-H07BZY385S"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.database();

  // ---- query DOM safely ----
  const $ = id => document.getElementById(id);
  const canvas = $("canvas") || document.getElementById("canvas");
  const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
  const loginBox = $("loginBox");
  const ui = $("ui");
  const ownerCommands = $("ownerCommands");
  const resetBtn = $("resetBtn");
  const logoutBtn = $("logoutBtn");
  const fireworkSound = $("fireworkSound");
  const eventBanner = $("eventBanner");
  const eventNameEl = $("eventName");
  const eventDescEl = $("eventDesc");
  const eventTimerEl = $("eventTimer");

  // ---- canvas setup ----
  if (canvas && ctx) {
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);
    resize();
  }

  // ---- state ----
  let currentUser = "";
  let money = 0;
  let unlockedColors = 1;
  let clickDelay = 1200;
  let lastClick = Date.now();
  let rebirthCount = 0;
  let colorPrice = 50;
  let delayPrice = 100;
  let rebirthPrice = 500;
  let autoPrice = 200;
  let autoAmount = 0;
  let autoSpeed = 2.5;
  let autoInterval = null;
  let fireworks = [];
  let particles = [];
  let gravity = 0.04;

  const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];
  let colors = [...baseColors];

  // ---- events state ----
  const EVENTS_STATE = {
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
  const eventIntervals = {};

  // ---- helpers ----
  function safeText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function show(el) { if (!el) return; el.style.display = "block"; }
  function hide(el) { if (!el) return; el.style.display = "none"; }

  function showEventBanner(name, description = "", endsAt = null) {
    if (!eventBanner || !eventNameEl) return;
    eventNameEl.textContent = name || "Event";
    eventDescEl && (eventDescEl.textContent = description || "");
    if (eventTimerEl) {
      if (!endsAt) eventTimerEl.textContent = "";
      else {
        const update = () => {
          const left = Math.max(0, endsAt - Date.now());
          eventTimerEl.textContent = left > 0 ? `Ends in ${Math.ceil(left / 1000)}s` : "Ending...";
          if (left <= 0) clearInterval(eventIntervals._bannerTimer);
        };
        clearInterval(eventIntervals._bannerTimer);
        update();
        eventIntervals._bannerTimer = setInterval(update, 1000);
      }
    }
    show(eventBanner);
  }
  function hideEventBanner() {
    if (!eventBanner) return;
    hide(eventBanner);
    eventNameEl && (eventNameEl.textContent = "");
    eventDescEl && (eventDescEl.textContent = "");
    eventTimerEl && (eventTimerEl.textContent = "");
    clearInterval(eventIntervals._bannerTimer);
    delete eventIntervals._bannerTimer;
  }

  // ---- firework / particle classes ----
  class Firework {
    constructor(x, y, colorObj, owner = false) {
      this.x = x; this.y = canvas.height; this.targetY = y; this.speed = Math.random() * 2 + 4;
      this.colorObj = colorObj; this.owner = !!owner;
    }
    update() {
      this.y -= this.speed;
      if (this.y <= this.targetY) {
        explode(this.x, this.y, this.colorObj, this.owner);
        return true;
      }
      return false;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = this.colorObj.color; ctx.fill();
    }
  }

  class Particle {
    constructor(x, y, color) {
      this.x = x; this.y = y;
      this.color = color.color || color;
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
      ctx.fillStyle = this.color; ctx.fill();
    }
  }

  function awardAndSave(amount) {
    if (!Number.isFinite(amount)) return;
    if (amount < 0) amount = 0;
    money += Math.floor(amount);
    safeText("money", money);
    saveProgressOnline();
    saveScore();
  }

  function computeAndAward(baseMoney, isChild = false, chainLevel = 1) {
    const base = Math.max(0, Math.floor(baseMoney));
    awardAndSave(base); // simple for now, events multipliers handled via EVENTS_STATE on everyone
  }

  function explode(x, y, colorObj, ownerFlag = false) {
    if (fireworkSound) { try { fireworkSound.currentTime = 0; fireworkSound.play(); } catch(e){} }
    for (let i = 0; i < 80; i++) particles.push(new Particle(x, y, colorObj));
    const base = (colorObj.value || 1) * (rebirthCount + 1);
    computeAndAward(base);
  }

  function launchFirework(x, y) {
    const colorIndex = Math.floor(Math.random() * Math.max(1, unlockedColors));
    const colorObj = colors[colorIndex] || colors[0];
    fireworks.push(new Firework(x, y, colorObj, true));
    lastClick = Date.now();
  }

  // ---- animate ----
  function animate() {
    if (!ctx) return;
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

    requestAnimationFrame(animate);
  }

  // ---- save/load ----
  async function saveProgressOnline() {
    if (!currentUser) return;
    const progress = { money, unlockedColors, clickDelay, rebirthCount, rebirthPrice, colorPrice, delayPrice, autoAmount, autoSpeed };
    try { await db.ref("progress/" + currentUser).set(progress); } catch(e){console.error(e);}
  }
  async function loadProgressOnline() {
    if (!currentUser) return;
    try {
      const snap = await db.ref("progress/" + currentUser).once("value");
      const p = snap.val();
      if (p) { money = p.money || 0; unlockedColors = p.unlockedColors || 1; safeText("money", money); }
    } catch(e){console.error(e);}
  }
  function saveScore() { if(!currentUser) return; db.ref("scores/" + currentUser).set({money}).catch(console.error); }

  // ---- Owner/Events ----
  function isOwner(){ return currentUser === "Dreamcrusher41"; }

  function triggerEventByName(name) {
    if(!name || !isOwner()) return;
    const seconds = parseInt(prompt("How long should this event last (seconds)?")) || 10;
    const endsAt = Date.now() + seconds*1000;
    db.ref("activeEvent").set({name, description:"", endsAt}).catch(console.error);
  }

  // ---- listen for events from DB ----
  db.ref("activeEvent").on("value", snapshot=>{
    const event = snapshot.val(); if(!event) return;
    EVENTS_STATE.active = true; EVENTS_STATE.name = event.name; EVENTS_STATE.endsAt = event.endsAt;
    showEventBanner(EVENTS_STATE.name,"",EVENTS_STATE.endsAt);
    const remaining = event.endsAt - Date.now();
    if(remaining>0){
      setTimeout(()=>{hideEventBanner(); EVENTS_STATE.active=false; EVENTS_STATE.name=""; EVENTS_STATE.endsAt=null;},remaining);
    }
  });

  // ---- disable highlighting ----
  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";

  // ---- click anywhere to launch ----
  document.addEventListener("click", e=>{
    if(!canvas) return;
    const now = Date.now();
    if(now-lastClick>=clickDelay){
      lastClick=now;
      launchFirework(e.clientX||canvas.width/2,e.clientY||canvas.height/2);
    }
  },{passive:true});

  // ---- start ----
  animate();

  // ---- Auth listener ----
  auth.onAuthStateChanged(async user=>{
    if(user){
      currentUser=user.uid;
      if(loginBox) loginBox.style.display="none";
      if(ui) ui.style.display="block";
      if(ownerCommands) ownerCommands.style.display = isOwner() ? "block" : "none";
      await loadProgressOnline();
    }else{
      currentUser="";
      if(loginBox) loginBox.style.display="flex";
      if(ui) ui.style.display="none";
      if(ownerCommands) ownerCommands.style.display="none";
      money=0; unlockedColors=1; clickDelay=1200;
      safeText("money","0");
      hideEventBanner();
    }
  });

})();
