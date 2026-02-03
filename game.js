(() => {
  // ---------- FIREBASE ----------
  firebase.initializeApp({
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
  });

  const auth = firebase.auth();
  const db = firebase.database();

  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const cooldownFill = $("cooldownFill");

  function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  addEventListener("resize", resize);
  resize();

  // ---------- STATE ----------
  let loggedIn = false;
  let money = 0;
  let clickDelay = 1200;
  let lastLaunch = 0;
  let rockets = [];
  let particles = [];
  const gravity = 0.04;

  // ---------- FIREWORKS ----------
  class Rocket {
    constructor(x, y) {
      this.x = x;
      this.y = canvas.height;
      this.targetY = y;
      this.speed = Math.random() * 2 + 4;
      this.exploded = false;
    }
    update() {
      this.y -= this.speed;
      if (this.y <= this.targetY && !this.exploded) {
        this.explode();
        return true;
      }
      return false;
    }
    draw() {
      ctx.fillStyle = "white";
      ctx.fillRect(this.x, this.y, 2, 6);
    }
    explode() {
      this.exploded = true;
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: this.x,
          y: this.y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 1,
          color: `hsl(${Math.random()*360},100%,60%)`
        });
      }
      money++;
      $("money").textContent = money;
    }
  }

  function animate() {
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    rockets.forEach(r => { if (r.update()) rockets = rockets.filter(x=>x!==r); else r.draw(); });

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += gravity;
      p.life -= 0.02;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    particles = particles.filter(p => p.life > 0);

    // cooldown
    const t = Math.min(1,(Date.now()-lastLaunch)/clickDelay);
    cooldownFill.style.width = `${t*100}%`;

    requestAnimationFrame(animate);
  }
  animate();

  // ---------- INPUT ----------
  addEventListener("click", e => {
    if (!loggedIn) return;
    if (Date.now() - lastLaunch < clickDelay) return;
    lastLaunch = Date.now();
    rockets.push(new Rocket(e.clientX, e.clientY));
  });

  // ---------- AUTH ----------
  $("loginBtn").onclick = async () => {
    try {
      await auth.signInWithEmailAndPassword($("email").value,$("password").value);
    } catch (e) {
      $("loginMsg").textContent = e.message;
    }
  };
  $("signupBtn").onclick = async () => {
    try {
      await auth.createUserWithEmailAndPassword($("email").value,$("password").value);
    } catch (e) {
      $("loginMsg").textContent = e.message;
    }
  };
  $("logoutBtn").onclick = () => auth.signOut();
  $("resetBtn").onclick = () => { money=0; $("money").textContent=0; };

  auth.onAuthStateChanged(user => {
    loggedIn = !!user;
    $("loginBox").style.display = loggedIn ? "none" : "flex";
    $("ui").style.display = loggedIn ? "block" : "none";
    $("topRight").style.display = loggedIn ? "block" : "none";
  });
})();
