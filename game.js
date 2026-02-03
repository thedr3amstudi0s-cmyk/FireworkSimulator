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
  let fireworks = [];

  // ---------- FIREWORKS ----------
  class Rocket {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vy = -7;
      this.exploded = false;
    }
    update() {
      this.y += this.vy;
      this.vy += 0.05;
      if (this.vy > -1 && !this.exploded) {
        this.exploded = true;
        explode(this.x, this.y);
      }
    }
    draw() {
      ctx.fillStyle = "white";
      ctx.fillRect(this.x, this.y, 2, 6);
    }
  }

  function explode(x, y) {
    for (let i = 0; i < 30; i++) {
      fireworks.push({
        x, y,
        vx:(Math.random()-0.5)*6,
        vy:(Math.random()-0.5)*6,
        life:1,
        color:`hsl(${Math.random()*360},100%,60%)`
      });
    }
  }

  function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);

    rockets.forEach(r => { r.update(); r.draw(); });
    rockets = rockets.filter(r => !r.exploded);

    fireworks.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05;
      p.life -= 0.02;
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x,p.y,3,0,Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    fireworks = fireworks.filter(p => p.life > 0);

    // cooldown bar
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
    rockets.push(new Rocket(e.clientX, canvas.height));
    money++;
    $("money").textContent = money;
  });

  // ---------- AUTH ----------
  $("loginBtn").onclick = async () => {
    try {
      await auth.signInWithEmailAndPassword(
        $("email").value,
        $("password").value
      );
    } catch (e) {
      $("loginMsg").textContent = e.message;
    }
  };

  $("signupBtn").onclick = async () => {
    try {
      await auth.createUserWithEmailAndPassword(
        $("email").value,
        $("password").value
      );
    } catch (e) {
      $("loginMsg").textContent = e.message;
    }
  };

  $("logoutBtn").onclick = () => auth.signOut();

  $("resetBtn").onclick = () => {
    if (!confirm("Reset progress?")) return;
    money = 0;
    clickDelay = 1200;
    $("money").textContent = 0;
  };

  auth.onAuthStateChanged(user => {
    loggedIn = !!user;
    $("loginBox").style.display = loggedIn ? "none" : "flex";
    $("ui").style.display = loggedIn ? "block" : "none";
    $("topRight").style.display = loggedIn ? "block" : "none";
  });
})();
