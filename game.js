(() => {
  // ---- Firebase config ----
  const firebaseConfig = {
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.appspot.com",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
    measurementId: "G-H07BZY385S"
  };

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.database();

  // ---- DOM ----
  const $ = id => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const loginBox = $("loginBox");
  const ui = $("ui");
  const ownerCommands = $("ownerCommands");
  const fireworkSound = $("fireworkSound");

  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ---- STATE ----
  let currentUser = "";
  let money = 0;
  let unlockedColors = 1;
  let clickDelay = 1200;
  let lastClick = 0;
  let rebirthCount = 0;

  let colorPrice = 50;
  let delayPrice = 100;
  let rebirthPrice = 500;
  let autoPrice = 200;

  let autoAmount = 0;
  let autoSpeed = 2.5;
  let autoInterval = null;

  let fireworks = [];

  const colors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];

  // ---- HELPERS ----
  const safeText = (id, txt) => {
    const el = $(id);
    if (el) el.textContent = txt;
  };
  const show = el => el && (el.style.display = "block");
  const hide = el => el && (el.style.display = "none");

  // ---- FIREWORKS ----
  class Firework {
    constructor(x, y) {
      this.particles = [];
      for (let i = 0; i < 30; i++) {
        this.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          alpha: 1,
          color: `hsl(${Math.random() * 360},100%,60%)`
        });
      }
    }
    update() {
      this.particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.alpha -= 0.02;
      });
      this.particles = this.particles.filter(p => p.alpha > 0);
    }
    draw(ctx) {
      this.particles.forEach(p => {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
  }

  function launchFirework(x, y) {
    fireworks.push(new Firework(x, y));
    if (fireworkSound) {
      fireworkSound.currentTime = 0;
      fireworkSound.play().catch(() => {});
    }
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fireworks.forEach(fw => {
      fw.update();
      fw.draw(ctx);
    });
    fireworks = fireworks.filter(fw => fw.particles.length > 0);
    requestAnimationFrame(animate);
  }
  animate();

  // ---- CLICK GAMEPLAY ----
  canvas.addEventListener("click", e => {
    const now = Date.now();
    if (now - lastClick < clickDelay) return;
    lastClick = now;

    const c = colors[Math.floor(Math.random() * unlockedColors)];
    const gain = c.value * (rebirthCount + 1);

    money += gain;
    safeText("money", money);
    launchFirework(e.clientX, e.clientY);
    saveProgressOnline();
  });

  // ---- AUTO FIRE ----
  function startAutoFire() {
    if (autoInterval) clearInterval(autoInterval);
    if (autoAmount <= 0) return;

    autoInterval = setInterval(() => {
      const x = Math.random() * canvas.width;
      const y = Math.random() * (canvas.height / 2);

      const c = colors[Math.floor(Math.random() * unlockedColors)];
      const gain = c.value * (rebirthCount + 1);

      money += gain;
      safeText("money", money);
      launchFirework(x, y);
      saveProgressOnline();
    }, autoSpeed * 1000);
  }

  // ---- SAVE / LOAD ----
  async function saveProgressOnline() {
    if (!currentUser) return;
    const data = {
      money,
      unlockedColors,
      clickDelay,
      rebirthCount,
      colorPrice,
      delayPrice,
      rebirthPrice,
      autoAmount,
      autoSpeed
    };
    await db.ref("progress/" + currentUser).set(data);
  }

  async function loadProgressOnline() {
    const snap = await db.ref("progress/" + currentUser).once("value");
    const p = snap.val();
    if (!p) return;

    money = p.money || 0;
    unlockedColors = p.unlockedColors || 1;
    clickDelay = p.clickDelay || 1200;
    rebirthCount = p.rebirthCount || 0;
    colorPrice = p.colorPrice || 50;
    delayPrice = p.delayPrice || 100;
    rebirthPrice = p.rebirthPrice || 500;
    autoAmount = p.autoAmount || 0;
    autoSpeed = p.autoSpeed || 2.5;

    safeText("money", money);
    safeText("moneyMultiplier", rebirthCount + 1);
    safeText("delayDisplay", clickDelay);
    safeText("autoSpeedDisplay", autoSpeed.toFixed(2));
    safeText("unlockedColors", unlockedColors);

    startAutoFire();
  }

  // ---- BUTTONS ----
  const attach = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener("click", fn);
  };

  attach("buyColor", () => {
    if (money >= colorPrice && unlockedColors < colors.length) {
      money -= colorPrice;
      unlockedColors++;
      colorPrice = Math.floor(colorPrice * 1.7);
      safeText("money", money);
      safeText("unlockedColors", unlockedColors);
      saveProgressOnline();
    }
  });

  attach("reduceDelay", () => {
    if (money >= delayPrice && clickDelay > 100) {
      money -= delayPrice;
      clickDelay -= 100;
      delayPrice = Math.floor(delayPrice * 1.7);
      safeText("money", money);
      safeText("delayDisplay", clickDelay);
      saveProgressOnline();
    }
  });

  attach("buyAuto", () => {
    if (money >= autoPrice && autoAmount < 3) {
      money -= autoPrice;
      autoAmount++;
      autoSpeed /= 1.2;
      autoPrice = Math.floor(autoPrice * 1.7);
      safeText("autoSpeedDisplay", autoSpeed.toFixed(2));
      startAutoFire();
      saveProgressOnline();
    }
  });

  attach("rebirth", () => {
    if (money < rebirthPrice) return alert("Not enough money!");

    money = 0;
    rebirthCount++;
    unlockedColors = 1;
    clickDelay = 1200;
    autoAmount = 0;
    autoSpeed = 2.5;
    rebirthPrice = Math.floor(rebirthPrice * 1.7);

    safeText("money", 0);
    safeText("moneyMultiplier", rebirthCount + 1);
    safeText("unlockedColors", 1);
    safeText("delayDisplay", clickDelay);
    safeText("autoSpeedDisplay", autoSpeed.toFixed(2));

    startAutoFire();
    saveProgressOnline();
  });

  // ---- AUTH ----
  auth.onAuthStateChanged(async user => {
    if (!user) {
      hide(ui);
      show(loginBox);
      return;
    }
    currentUser = user.uid;
    hide(loginBox);
    show(ui);
    await loadProgressOnline();
  });

})();
