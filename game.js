// game.js
// Drop this file into your project and include <script src="game.js"></script> after Firebase scripts.

(() => {
  // ---- Firebase config (same as your index) ----
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
  const giveMoneyBtn = $("giveMoneyBtn");
  const goLeaderboardBtn = $("goLeaderboardBtn");

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
  const eventIntervals = {}; // store { name: timerId } and other handles

  // ---- helpers ----
  function safeText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function show(el) { if (!el) return; el.style.display = "block"; }
  function hide(el) { if (!el) return; el.style.display = "none"; }

  // ---- banner logic ----
  function showEventBanner(name, description = "", endsAt = null) {
    if (!eventBanner || !eventNameEl) return;
    eventNameEl.textContent = name || "Event";
    eventDescEl && (eventDescEl.textContent = description || "");
    if (eventTimerEl) {
      if (!endsAt) {
        eventTimerEl.textContent = "";
      } else {
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

  // ---- event-influenced reward calculation ----
  function awardAndSave(amount) {
    if (!Number.isFinite(amount)) return;
    if (amount < 0) amount = 0;
    money += Math.floor(amount);
    safeText("money", money);
    saveProgressOnline();
    saveScore();
  }

  function doChainReaction(baseValue, level = 1, maxLevel = 2) {
    if (!EVENTS_STATE.chainReaction || level > maxLevel) return;
    const children = 2;
    for (let i = 0; i < children; i++) {
      const childBase = Math.ceil(baseValue / 2);
      computeAndAward(childBase, true, level + 1);
      // some tiny visual particles near center
      for (let p = 0; p < 18; p++) {
        particles.push(new Particle(
          Math.random() * canvas.width,
          Math.random() * (canvas.height / 2),
          { color: `hsl(${Math.random() * 360},100%,60%)` }
        ));
      }
    }
  }

  function computeAndAward(baseMoney, isChild = false, chainLevel = 1) {
    const base = Math.max(0, Math.floor(baseMoney));
    // chaos roll outcome
    let chaosMultiplier = 1;
    let triggeredChainFromChaos = false;
    if (EVENTS_STATE.chaosRoll) {
      const choices = ["0.5", "1", "2", "5", "chain"];
      const pick = choices[Math.floor(Math.random() * choices.length)];
      if (pick === "chain") triggeredChainFromChaos = true;
      else chaosMultiplier = parseFloat(pick);
    }

    // golden
    const goldenMultiplier = (EVENTS_STATE.goldenFirework && Math.random() < 0.01) ? 10 : 1;
    const luckyMultiplier = (EVENTS_STATE.luckyExplosions && Math.random() < 0.10) ? 4 : 1;
    const cosmicMultiplier = EVENTS_STATE.cosmicMode ? 2 : 1;
    const doubleMultiplier = EVENTS_STATE.doubleMoney ? 2 : 1;
    const rainbowMultiplier = EVENTS_STATE.rainbowMode ? 5 : 1;
    const blackoutMultiplier = EVENTS_STATE.blackout ? 3 : 1;
    const glitchMultiplier = EVENTS_STATE.glitch ? (Math.random() * 3) : 1;

    const finalMultiplier = chaosMultiplier * luckyMultiplier * goldenMultiplier * cosmicMultiplier * doubleMultiplier * rainbowMultiplier * blackoutMultiplier * glitchMultiplier;
    const awarded = Math.round(base * finalMultiplier);

    awardAndSave(awarded);

    if ((EVENTS_STATE.chainReaction && !isChild) || triggeredChainFromChaos) {
      doChainReaction(base, chainLevel, 2);
    }

    // Visual cue: small flash if golden or lucky
    if (goldenMultiplier > 1) flashScreen("#ffd700", 180);
    else if (luckyMultiplier > 1) flashScreen("#00ff00", 140);
  }

  function flashScreen(color, duration = 150) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // let animation loop repaint shortly after - no blocking
  }

  // ---- explosion / launch ----
  function explode(x, y, colorObj, ownerFlag = false) {
    if (fireworkSound) {
      try { fireworkSound.currentTime = 0; fireworkSound.play(); } catch (e) { /* autoplay might be blocked until user interacts */ }
    }
    for (let i = 0; i < 80; i++) particles.push(new Particle(x, y, colorObj));
    // rainbow override color used for visual only in compute stage
    let usedColor = colorObj;
    if (EVENTS_STATE.rainbowMode) {
      usedColor = { color: `hsl(${Math.floor(Math.random() * 360)},100%,60%)`, value: colorObj.value };
    }

    // base money
    const base = (usedColor.value || 1) * (rebirthCount + 1);
    computeAndAward(base, false, 1);
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
    ctx.fillStyle = EVENTS_STATE.blackout ? "rgba(0,0,0,0.98)" : "rgba(0,0,0,0.2)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (EVENTS_STATE.doubleMoney) {
      ctx.shadowBlur = 12; ctx.shadowColor = "#ff0";
    } else if (EVENTS_STATE.rainbowMode) {
      ctx.shadowBlur = 20; ctx.shadowColor = "#f0f";
    } else {
      ctx.shadowBlur = 0; ctx.shadowColor = "#000";
    }

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
    const cdFill = $("cooldownFill"); if (cdFill) cdFill.style.width = fill + "%";
    safeText("moneyMultiplier", (rebirthCount + 1));
    requestAnimationFrame(animate);
  }

  // ---- save/load ----
  async function saveProgressOnline() {
    if (!currentUser) return;
    // basic client-side sanity checks
    if (!Number.isFinite(money) || money < 0) money = Math.max(0, Math.floor(money));
    if (money > 1e9) money = 1e9;
    if (clickDelay < 100) clickDelay = 100;
    if (unlockedColors > colors.length) unlockedColors = colors.length;
    if (rebirthCount < 0) rebirthCount = 0;
    if (autoAmount < 0) autoAmount = 0;
    if (autoAmount > 3) autoAmount = 3;

    const progress = { money, unlockedColors, clickDelay, rebirthCount, rebirthPrice, colorPrice, delayPrice, autoAmount, autoSpeed };
    try {
      await db.ref("progress/" + currentUser).set(progress);
    } catch (e) {
      console.error("saveProgressOnline error:", e);
    }
  }

  async function loadProgressOnline() {
    if (!currentUser) return;
    try {
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
        colors = [...baseColors, ...getRebirthColors(rebirthCount)];
        if (unlockedColors > colors.length) unlockedColors = colors.length;
        safeText("money", money);
        updateButtons();
        startAutoLaunch();
      }
    } catch (e) {
      console.error("loadProgressOnline error:", e);
    }
  }

  function getRebirthColors(rebirthCount) {
    const scheme = [{ base: 60 }, { base: 80 }, { base: 100 }, { base: 120 }][rebirthCount % 4] || { base: 80 };
    const numColors = Math.min(10 + rebirthCount, 50);
    const newColors = [];
    for (let i = 0; i < numColors; i++) {
      const hue = Math.floor(Math.random() * 360);
      newColors.push({ color: `hsl(${hue}, ${scheme.base}%, 60%)`, value: i + 1 });
    }
    return newColors;
  }

  function saveScore() {
    if (!currentUser) return;
    const scoreRef = db.ref("scores/" + currentUser);
    scoreRef.once("value").then(snapshot => {
      const oldMoney = snapshot.val()?.money || 0;
      const newMoney = Math.max(oldMoney, money || 0);
      scoreRef.set({ money: newMoney }).catch(console.error);
    }).catch(console.error);
  }

  // ---- UI actions / upgrades ----
  function updateButtons() {
    const buyColor = $("buyColor"); if (buyColor) buyColor.textContent = unlockedColors >= colors.length ? "MAX" : `Buy Color ($${colorPrice})`;
    const reduceDelay = $("reduceDelay"); if (reduceDelay) reduceDelay.textContent = clickDelay <= 100 ? "MAX" : `Reduce Delay ($${delayPrice})`;
    const buyAuto = $("buyAuto"); if (buyAuto) buyAuto.textContent = autoAmount >= 3 ? "MAX" : `Buy Auto-Launch ($${autoPrice})`;
    const reb = $("rebirth"); if (reb) reb.textContent = `Rebirth ($${rebirthPrice})`;
    safeText("delayDisplay", clickDelay);
    safeText("autoSpeedDisplay", (autoSpeed).toFixed(2));
    safeText("unlockedColors", unlockedColors);
  }

  // attach core buttons (guard existence)
  const attach = (id, fn) => { const el = $(id); if (el) el.addEventListener("click", fn); };

  attach("buyColor", () => {
    if (money >= colorPrice && unlockedColors < colors.length) {
      money -= colorPrice; unlockedColors++; colorPrice = Math.floor(colorPrice * 1.7);
      safeText("money", money);
      updateButtons(); saveProgressOnline();
    }
  });

  attach("reduceDelay", () => {
    if (money >= delayPrice && clickDelay > 100) {
      money -= delayPrice; clickDelay = Math.max(clickDelay - 100, 100); delayPrice = Math.floor(delayPrice * 1.7);
      safeText("money", money);
      updateButtons(); saveProgressOnline();
    }
  });

  attach("buyAuto", () => {
    if (autoAmount < 3 && money >= autoPrice) {
      money -= autoPrice; autoAmount++; autoSpeed /= 1.2; autoPrice = Math.floor(autoPrice * 1.7);
      safeText("money", money);
      updateButtons(); saveProgressOnline(); startAutoLaunch();
    }
  });

  attach("rebirth", async () => {
    if (money >= rebirthPrice) {
      money = 0; rebirthCount++; unlockedColors = 1; clickDelay = 1200;
      autoAmount = 0; autoSpeed = 2.5; autoInterval && clearInterval(autoInterval); autoInterval = null;
      colorPrice = 50; delayPrice = 100; rebirthPrice = Math.floor(rebirthPrice * 1.7);
      colors = [...baseColors, ...getRebirthColors(rebirthCount)];
      updateButtons(); safeText("money", money);
      await saveProgressOnline(); saveScore(); startAutoLaunch();
      alert("Rebirth complete!");
    } else alert(`Need $${rebirthPrice} to rebirth!`);
  });

  attach("resetBtn", async () => {
    if (!confirm("Reset progress?")) return;
    money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0;
    colorPrice = 50; delayPrice = 100; rebirthPrice = 500; autoAmount = 0; autoSpeed = 2.5;
    clearInterval(autoInterval); autoInterval = null; colors = [...baseColors];
    updateButtons(); safeText("money", money);
    await saveProgressOnline(); saveScore();
    alert("Progress reset!");
  });

  attach("goLeaderboardBtn", () => { try { window.open("fireworkleaderboard.html", "_blank"); } catch (e) { console.error(e); } });

  attach("giveMoneyBtn", () => { money += 1000; safeText("money", money); saveProgressOnline(); });
  attach("unlockColorsBtn", () => { unlockedColors = colors.length; updateButtons(); saveProgressOnline(); });
  attach("maxAutoBtn", () => { autoAmount = 3; autoSpeed = 0.1; updateButtons(); startAutoLaunch(); saveProgressOnline(); });
  attach("viewUsersBtn", async () => {
    // lightweight admin info
    try {
      const s = await db.ref("users").once("value");
      console.log("users snapshot:", s.val());
      alert("Check console for user list (admins only).");
    } catch (e) { console.error(e); alert("Failed to read users"); }
  });

  attach("logoutBtn", () => {
    if (!confirm("Are you sure you want to log out?")) return;
    auth.signOut().then(() => {
      // restore login UI
      if (loginBox) loginBox.style.display = "flex";
      if (ui) ui.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      if (ownerCommands) ownerCommands.style.display = "none";
      currentUser = "";
      money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0; autoAmount = 0; autoSpeed = 2.5;
      clearInterval(autoInterval); autoInterval = null;
      safeText("money", "0"); safeText("unlockedColors", "1");
      safeText("moneyMultiplier", "1"); safeText("delayDisplay", "1200"); safeText("autoSpeedDisplay", "2.50");
    }).catch(err => alert("Error logging out: " + err.message));
  });

  // ---- auto launch control ----
  function startAutoLaunch() {
    if (autoInterval) clearInterval(autoInterval);
    if (autoAmount > 0) {
      autoInterval = setInterval(() => {
        launchFirework(Math.random() * canvas.width, Math.random() * (canvas.height / 2));
      }, Math.max(50, autoSpeed * 1000));
    }
  }

  // ---- attach owner commands events (data-event or id mapping) ----
  function bindOwnerButtons() {
    if (!ownerCommands) return;
    const buttons = ownerCommands.querySelectorAll("button");
    buttons.forEach(btn => {
      const evtName = (btn.dataset && btn.dataset.event) ? btn.dataset.event : btn.id || btn.getAttribute("data-event");
      // map some likely ID names to event names
      const idMap = {
        "doubleMoney": "doubleMoney",
        "toggleDouble": "doubleMoney",
        "rainbowMode": "rainbowMode",
        "toggleRainbow": "rainbowMode",
        "chaosRoll": "chaosRoll",
        "toggleChaos": "chaosRoll",
        "blackout": "blackout",
        "toggleBlackout": "blackout",
        "glitch": "glitch",
        "toggleGlitch": "glitch",
        "chainReaction": "chainReaction",
        "toggleChain": "chainReaction",
        "cosmicMode": "cosmicMode",
        "toggleCosmic": "cosmicMode",
        "luckyExplosions": "luckyExplosions",
        "toggleLucky": "luckyExplosions",
        "goldenFirework": "goldenFirework",
        "triggerAdminStorm": "adminStorm",
        "adminStorm": "adminStorm",
      };
      const eventKey = idMap[evtName] || evtName;
      btn.addEventListener("click", () => triggerEventByName(eventKey));
    });
  }

  function clearEventTimers(name) {
    if (eventIntervals[name]) {
      clearTimeout(eventIntervals[name]);
      delete eventIntervals[name];
    }
  }

  function triggerEventByName(name) {
    if (!name) return;
    // make sure event resets previous timers if same event re-triggered
    const seconds = 10 * 1000; // default duration
    EVENTS_STATE.active = true;
    EVENTS_STATE.name = name;
    EVENTS_STATE.description = "";
    EVENTS_STATE.endsAt = Date.now() + seconds;

    // turn on the event flag
    switch (name) {
      case "doubleMoney":
        EVENTS_STATE.doubleMoney = true; showEventBanner("Double Money", "All fireworks give 2x money!", EVENTS_STATE.endsAt);
        clearEventTimers("doubleMoney");
        eventIntervals.doubleMoney = setTimeout(() => { EVENTS_STATE.doubleMoney = false; hideEventBanner(); }, seconds);
        break;
      case "rainbowMode":
        EVENTS_STATE.rainbowMode = true; showEventBanner("Rainbow Mode", "Fireworks are rainbow and give x5!", EVENTS_STATE.endsAt);
        clearEventTimers("rainbowMode");
        eventIntervals.rainbowMode = setTimeout(() => { EVENTS_STATE.rainbowMode = false; hideEventBanner(); }, seconds);
        break;
      case "chainReaction":
        EVENTS_STATE.chainReaction = true; showEventBanner("Chain Reaction", "Explosions spawn smaller ones!", EVENTS_STATE.endsAt);
        clearEventTimers("chainReaction");
        eventIntervals.chainReaction = setTimeout(() => { EVENTS_STATE.chainReaction = false; hideEventBanner(); }, seconds);
        break;
      case "cosmicMode":
        EVENTS_STATE.cosmicMode = true; showEventBanner("Cosmic Mode", "2x money + visuals!", EVENTS_STATE.endsAt);
        clearEventTimers("cosmicMode");
        eventIntervals.cosmicMode = setTimeout(() => { EVENTS_STATE.cosmicMode = false; hideEventBanner(); }, seconds);
        break;
      case "luckyExplosions":
        EVENTS_STATE.luckyExplosions = true; showEventBanner("Lucky Explosions", "10% chance for 4x!", EVENTS_STATE.endsAt);
        clearEventTimers("luckyExplosions");
        eventIntervals.luckyExplosions = setTimeout(() => { EVENTS_STATE.luckyExplosions = false; hideEventBanner(); }, seconds);
        break;
      case "chaosRoll":
        EVENTS_STATE.chaosRoll = true; showEventBanner("Chaos Roll", "Each launch gets a random modifier!", EVENTS_STATE.endsAt);
        clearEventTimers("chaosRoll");
        eventIntervals.chaosRoll = setTimeout(() => { EVENTS_STATE.chaosRoll = false; hideEventBanner(); }, seconds);
        break;
      case "goldenFirework":
        EVENTS_STATE.goldenFirework = true; showEventBanner("Golden Firework", "Rare 10x rewards possible!", EVENTS_STATE.endsAt);
        clearEventTimers("goldenFirework");
        eventIntervals.goldenFirework = setTimeout(() => { EVENTS_STATE.goldenFirework = false; hideEventBanner(); }, seconds);
        break;
      case "blackout":
        EVENTS_STATE.blackout = true; showEventBanner("Blackout", "Screen darkens, big rewards!", EVENTS_STATE.endsAt);
        clearEventTimers("blackout");
        eventIntervals.blackout = setTimeout(() => { EVENTS_STATE.blackout = false; hideEventBanner(); }, seconds);
        break;
      case "glitch":
        EVENTS_STATE.glitch = true; showEventBanner("Glitch", "Weird physics + random multipliers!", EVENTS_STATE.endsAt);
        clearEventTimers("glitch");
        // glitch effect changes gravity periodically
        if (eventIntervals._glitchPhysics) clearInterval(eventIntervals._glitchPhysics);
        eventIntervals._glitchPhysics = setInterval(() => {
          gravity = (Math.random() * 0.4) - 0.1; // -0.1 .. 0.3
          setTimeout(() => { gravity = 0.04; }, 800);
        }, 900);
        eventIntervals.glitch = setTimeout(() => {
          EVENTS_STATE.glitch = false;
          clearInterval(eventIntervals._glitchPhysics);
          delete eventIntervals._glitchPhysics;
          gravity = 0.04;
          hideEventBanner();
        }, seconds);
        break;
      case "adminStorm":
        EVENTS_STATE.adminStorm = true; showEventBanner("Admin Storm", "Rapid fireworks everywhere!", EVENTS_STATE.endsAt);
        // spawn fireworks for duration on client
        const stormInterval = setInterval(() => {
          for (let i = 0; i < 3; i++) launchFirework(Math.random() * canvas.width, Math.random() * (canvas.height / 2));
        }, 700);
        clearEventTimers("adminStorm");
        eventIntervals.adminStorm = setTimeout(() => {
          EVENTS_STATE.adminStorm = false;
          clearInterval(stormInterval);
          hideEventBanner();
        }, seconds);
        break;
      default:
        console.warn("Unknown event:", name);
        break;
    }
  }

  // ---- auth UI behavior ----
  auth.onAuthStateChanged(async user => {
    if (user) {
      currentUser = user.uid;
      if (loginBox) loginBox.style.display = "none";
      if (ui) ui.style.display = "block";
      if (resetBtn) resetBtn.style.display = "block";
      // owner flag for showing ownerCommands
      if (ownerCommands) ownerCommands.style.display = (user.email === "aaron.gatorfan@gmail.com") ? "block" : "none";
      bindOwnerButtons();
      await loadProgressOnline();
    } else {
      currentUser = "";
      if (loginBox) loginBox.style.display = "flex";
      if (ui) ui.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      if (ownerCommands) ownerCommands.style.display = "none";
      // clear client state visually
      money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0; autoAmount = 0; autoSpeed = 2.5;
      clearInterval(autoInterval); autoInterval = null;
      safeText("money", "0"); safeText("unlockedColors", "1"); safeText("moneyMultiplier", "1");
      safeText("delayDisplay", "1200"); safeText("autoSpeedDisplay", "2.50");
      hideEventBanner();
    }
  });

  // ---- login/signup binding (the HTML uses loginBtn & signupBtn) ----
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");
  const forgotBtn = $("forgotBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = $("email") ? $("email").value.trim() : "";
      const pass = $("password") ? $("password").value.trim() : "";
      if (!email || !pass) { if ($("loginMsg")) $("loginMsg").textContent = "Enter email & password!"; return; }
      try {
        const cred = await auth.signInWithEmailAndPassword(email, pass);
        currentUser = cred.user.uid;
        if ($("loginMsg")) $("loginMsg").textContent = "";
      } catch (err) {
        if ($("loginMsg")) $("loginMsg").textContent = err.message;
      }
    });
  }
  if (signupBtn) {
    signupBtn.addEventListener("click", async () => {
      const uname = $("username") ? $("username").value.trim() : "";
      const email = $("email") ? $("email").value.trim() : "";
      const pass = $("password") ? $("password").value.trim() : "";
      if (!uname || !email || !pass) { if ($("loginMsg")) $("loginMsg").textContent = "Enter all fields!"; return; }
      if (pass.length < 6) { if ($("loginMsg")) $("loginMsg").textContent = "Password must be at least 6 characters!"; return; }
      if (!/^[a-zA-Z0-9_]{3,16}$/.test(uname)) { if ($("loginMsg")) $("loginMsg").textContent = "Username must be 3-16 characters (letters, numbers, _)"; return; }
      try {
        const cred = await auth.createUserWithEmailAndPassword(email, pass);
        currentUser = cred.user.uid;
        // save username under /users to match your leaderboard lookup
        await db.ref("users/" + currentUser).set({ username: uname });
        if ($("loginMsg")) { $("loginMsg").style.color = "lime"; $("loginMsg").textContent = "Account created!"; }
      } catch (err) {
        if ($("loginMsg")) { $("loginMsg").style.color = "red"; $("loginMsg").textContent = err.message; }
      }
    });
  }
  if (forgotBtn) {
    forgotBtn.addEventListener("click", () => {
      const email = $("email") ? $("email").value.trim() : "";
      if (!email) { if ($("loginMsg")) $("loginMsg").textContent = "Enter email!"; return; }
      auth.sendPasswordResetEmail(email).then(() => {
        if ($("loginMsg")) $("loginMsg").textContent = "Password reset email sent!";
      }).catch(err => { if ($("loginMsg")) $("loginMsg").textContent = err.message; });
    });
  }

  // ---- click handler for launching ----
  document.addEventListener("click", (e) => {
    // ignore clicks that are on UI elements (so user can press buttons)
    const path = e.composedPath ? e.composedPath() : (e.path || []);
    // if any element in path has id = ui or is a button inside UI, ignore launching
    for (const node of path) {
      if (!node || !node.id) continue;
      if (node.id === "ui" || node.id === "ownerCommands" || node.id === "loginBox" || node.tagName === "BUTTON" || node.tagName === "INPUT") {
        return; // clicked on UI - don't launch
      }
    }
    const now = Date.now();
    if (now - lastClick >= clickDelay) {
      lastClick = now;
      launchFirework(e.clientX || (canvas.width / 2), e.clientY || (canvas.height / 2));
    }
  }, { passive: true });

  // ---- owner button binding (call after DOM ready) ----
  bindOwnerButtons();

  // ---- admin button fallback: if someone used #ownerCommands buttons without data-event,
  // attach mapping for common ids
  const fallbackMap = {
    "toggleDouble": "doubleMoney",
    "toggleRainbow": "rainbowMode",
    "toggleChain": "chainReaction",
    "toggleCosmic": "cosmicMode",
    "toggleLucky": "luckyExplosions",
    "toggleChaos": "chaosRoll",
    "triggerAdminStorm": "adminStorm",
    "toggleBlackout": "blackout",
    "toggleGlitch": "glitch"
  };
  Object.keys(fallbackMap).forEach(id => {
    const el = $(id);
    if (el) el.addEventListener("click", () => triggerEventByName(fallbackMap[id]));
  });

  // ---- small anti-cheat sanity check on load (so older progress doesn't break) ----
  window.addEventListener("load", () => {
    if (!("money" in window) && $("money")) $("money").textContent = money;
  });

  // ---- start ----
  animate();

  // expose some functions for debugging in console (optional)
  window._FS = {
    triggerEventByName,
    EVENTS_STATE,
    saveProgressOnline,
    loadProgressOnline,
    saveScore
  };

})();
