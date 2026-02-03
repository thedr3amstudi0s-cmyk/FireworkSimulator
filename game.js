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

  // ---- DOM helpers ----
  const $ = id => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const loginBox = $("loginBox");
  const ui = $("ui");
  const ownerCommands = $("ownerCommands");
  const fireworkSound = $("fireworkSound");

  const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
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

  const OWNER_UID = "FaZgGtIHzVcnSS6c8JAoir9RG8J2"; // keep or replace with your owner uid

  // Events / modes
  let rainbowEventActive = false; // rainbow only during event, default off

  // color economy
  const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];
  const colors = [...baseColors];

  // ---- HELPERS ----
  const safeText = (id, txt) => { const el=$(id); if(el) el.textContent = txt; };
  const show = el => { if(el) el.style.display = "block"; };
  const hide = el => { if(el) el.style.display = "none"; };

  // ---- PARTICLES / ROCKETS / FIREWORKS ----
  class Particle {
    constructor(x,y,vx,vy,color,size=3,life=1){
      this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.color = color;
      this.alpha = 1; this.size = size; this.life = life;
    }
    update(){
      this.x += this.vx;
      this.y += this.vy;
      this.vy += 0.04; // gravity
      this.alpha -= 0.02 * this.life;
      if(this.alpha < 0) this.alpha = 0;
    }
    draw(ctx){
      if(this.alpha <= 0) return;
      ctx.globalAlpha = this.alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  class RocketTo {
    // rocket that travels from bottom to target, with a trail, then explodes
    constructor(targetX, targetY, colorCue=null){
      this.x = targetX;
      this.y = canvas.height + 6; // start below bottom
      this.tx = targetX;
      this.ty = Math.max(60, targetY); // cap top
      this.speed = 6 + Math.random()*2;
      this.trail = [];
      this.exploded = false;
      this.colorCue = colorCue; // can be null
      this.hue = Math.random()*360;
    }
    update(){
      if(this.exploded) {
        // gradually clear trail
        this.trail.forEach(p => p.update());
        this.trail = this.trail.filter(p => p.alpha > 0.02);
        return;
      }
      // move toward target
      const dx = this.tx - this.x;
      const dy = this.ty - this.y;
      const dist = Math.hypot(dx, dy) || 1;
      const stepX = (dx / dist) * this.speed;
      const stepY = (dy / dist) * this.speed;
      this.x += stepX;
      this.y += stepY;

      // leave small trail particles
      for(let i=0;i<2;i++){
        const angle = (Math.random()-0.5)*Math.PI;
        const sp = Math.random()*1.2 + 0.3;
        const c = rainbowEventActive ? `hsl(${(this.hue + (Math.random()*60 - 30) + 360)%360},100%,60%)`
                                     : colors[Math.floor(Math.random()*unlockedColors)].color;
        this.trail.push(new Particle(this.x, this.y, Math.cos(angle)*sp, Math.sin(angle)*sp + 0.6, c, 2, 0.8));
      }

      this.trail.forEach(p => p.update());
      this.trail = this.trail.filter(p => p.alpha > 0.02);

      if(dist < this.speed + 1){
        this.explode();
      }
    }
    explode(){
      if(this.exploded) return;
      this.exploded = true;
      // create explosion particles
      const hueBase = this.colorCue !== null ? this.colorCue : this.hue;
      const cnt = 30 + Math.floor(Math.random()*30);
      for(let i=0;i<cnt;i++){
        const ang = Math.random()*Math.PI*2;
        const sp = 1 + Math.random()*4;
        const hue = rainbowEventActive ? (hueBase + (Math.random()*120 - 60) + 360) % 360 : (Math.random()*360);
        const c = `hsl(${hue},100%,60%)`;
        fireworksParticles.push(new Particle(this.x, this.y, Math.cos(ang)*sp, Math.sin(ang)*sp, c, 3 + Math.random()*2, 1 + Math.random()*0.6));
      }
      // play sound
      if(fireworkSound){
        fireworkSound.currentTime = 0;
        fireworkSound.play().catch(()=>{});
      }
    }
    draw(ctx){
      // rocket head
      if(!this.exploded){
        ctx.fillStyle = `hsl(${this.hue},100%,70%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI*2);
        ctx.fill();
      }
      // trail
      this.trail.forEach(p => p.draw(ctx));
    }
    isDone(){
      return this.exploded && this.trail.length === 0;
    }
  }

  // arrays
  const rockets = [];
  const fireworksParticles = [];

  // launch helper
  function launchRocketTo(x,y){
    // colorCue: if event active, keep explosion biased to a hue; else null
    const colorCue = rainbowEventActive ? Math.random()*360 : null;
    rockets.push(new RocketTo(x,y,colorCue));
  }

  // animation
  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    // update/draw rockets
    for(let i=0;i<rockets.length;i++){
      rockets[i].update();
      rockets[i].draw(ctx);
    }
    for(let i=rockets.length-1;i>=0;i--){
      if(rockets[i].isDone()) rockets.splice(i,1);
    }

    // update/draw fireworks particles
    for(let i=0;i<fireworksParticles.length;i++){
      fireworksParticles[i].update();
      fireworksParticles[i].draw(ctx);
    }
    for(let i=fireworksParticles.length-1;i>=0;i--){
      if(fireworksParticles[i].alpha <= 0.02) fireworksParticles.splice(i,1);
    }

    requestAnimationFrame(animate);
  }
  animate();

  // ---- SAVE / LOAD ----
  async function saveProgressOnline(){
    if(!currentUser) return;
    const progress = { money, unlockedColors, clickDelay, rebirthCount, colorPrice, delayPrice, rebirthPrice, autoAmount, autoSpeed };
    try{ await db.ref("progress/"+currentUser).set(progress); } catch(e){ console.error("Save failed", e); }
  }

  async function loadProgressOnline(){
    if(!currentUser) return;
    try{
      const snap = await db.ref("progress/"+currentUser).once("value");
      const p = snap.val();
      if(p){
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
      } else {
        // if no progress, still show values
        safeText("money", money);
        safeText("moneyMultiplier", rebirthCount + 1);
        safeText("delayDisplay", clickDelay);
        safeText("autoSpeedDisplay", autoSpeed.toFixed(2));
        safeText("unlockedColors", unlockedColors);
      }
    } catch(e){ console.error("Load failed", e); }
  }

  // ---- CLICK HANDLING (reward + rocket) ----
  canvas.addEventListener("click", e => {
    const now = Date.now();
    if(now - lastClick < clickDelay) return;
    lastClick = now;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // calculate reward
    const c = colors[Math.floor(Math.random() * unlockedColors)];
    const gain = c.value * (rebirthCount + 1);
    money += gain;
    safeText("money", money);

    // launch rocket with color cue if rainbow event active, else null
    launchRocketTo(x, y);

    saveProgressOnline();
  });

  // ---- AUTO FIRE ----
  function startAutoFire(){
    if(autoInterval) clearInterval(autoInterval);
    if(autoAmount <= 0) return;
    autoInterval = setInterval(()=> {
      const x = Math.random() * canvas.width;
      const y = Math.random() * (canvas.height * 0.6);
      // reward
      const c = colors[Math.floor(Math.random()*unlockedColors)];
      const gain = c.value * (rebirthCount + 1);
      money += gain;
      safeText("money", money);
      launchRocketTo(x,y);
      saveProgressOnline();
    }, Math.max(120, autoSpeed * 1000));
  }

  // ---- BUTTONS / ATTACH ----
  const attach = (id,fn) => { const el=$(id); if(el) el.addEventListener("click", fn); };

  attach("buyColor", ()=> {
    if(money >= colorPrice && unlockedColors < colors.length){
      money -= colorPrice;
      unlockedColors++;
      colorPrice = Math.floor(colorPrice * 1.7);
      safeText("money", money);
      safeText("unlockedColors", unlockedColors);
      launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.5));
      saveProgressOnline();
    }
  });

  attach("reduceDelay", ()=> {
    if(money >= delayPrice && clickDelay > 100){
      money -= delayPrice;
      clickDelay = Math.max(100, clickDelay - 100);
      delayPrice = Math.floor(delayPrice * 1.7);
      safeText("money", money);
      safeText("delayDisplay", clickDelay);
      saveProgressOnline();
    }
  });

  attach("buyAuto", ()=> {
    if(money >= autoPrice && autoAmount < 3){
      money -= autoPrice;
      autoAmount++;
      autoSpeed /= 1.2;
      autoPrice = Math.floor(autoPrice * 1.7);
      safeText("money", money);
      safeText("autoSpeedDisplay", autoSpeed.toFixed(2));
      startAutoFire();
      saveProgressOnline();
    }
  });

  attach("rebirth", ()=> {
    if(money < rebirthPrice){ alert(`Need $${rebirthPrice} to rebirth!`); return; }
    money = 0;
    rebirthCount++;
    unlockedColors = 1;
    clickDelay = 1200;
    autoAmount = 0;
    autoSpeed = 2.5;
    rebirthPrice = Math.floor(rebirthPrice * 1.7);
    colorPrice = 50; delayPrice = 100;
    safeText("money", money);
    safeText("moneyMultiplier", rebirthCount + 1);
    safeText("delayDisplay", clickDelay);
    safeText("autoSpeedDisplay", autoSpeed.toFixed(2));
    safeText("unlockedColors", unlockedColors);
    startAutoFire();
    launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.5));
    saveProgressOnline();
  });

  attach("resetBtn", async ()=> {
    if(!confirm("Reset progress?")) return;
    if(!currentUser){
      // local reset
      money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0; autoAmount = 0; autoSpeed = 2.5;
      colorPrice = 50; delayPrice = 100; rebirthPrice = 500;
      safeText("money",0); safeText("moneyMultiplier",1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); safeText("unlockedColors",unlockedColors);
      return;
    }
    try{
      await db.ref("progress/" + currentUser).remove();
      money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0; autoAmount = 0; autoSpeed = 2.5;
      colorPrice = 50; delayPrice = 100; rebirthPrice = 500;
      safeText("money",0); safeText("moneyMultiplier",1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); safeText("unlockedColors",unlockedColors);
      alert("Progress reset.");
    } catch(e){ console.error(e); alert("Reset failed."); }
  });

  attach("giveMoneyBtn", ()=> { money += 1000; safeText("money",money); launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.5)); saveProgressOnline(); });
  attach("unlockColorsBtn", ()=> { unlockedColors = colors.length; safeText("unlockedColors",unlockedColors); launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.5)); saveProgressOnline(); });
  attach("maxAutoBtn", ()=> { autoAmount = 3; autoSpeed = 0.1; safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); startAutoFire(); launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.5)); saveProgressOnline(); });

  attach("goLeaderboardBtn", ()=> { try{ window.open("fireworkleaderboard.html","_blank"); } catch(e){ console.error(e); } });

  // Owner commands
  attach("adminStormBtn", ()=> {
    for(let i=0;i<18;i++) launchRocketTo(Math.random()*canvas.width, Math.random()*(canvas.height*0.7));
  });
  attach("adminGiveMoneyBtn", ()=> { money += 5000; safeText("money",money); saveProgressOnline(); });
  attach("adminToggleRainbowBtn", ()=> { rainbowEventActive = !rainbowEventActive; alert("Rainbow event: " + (rainbowEventActive ? "ON" : "OFF")); });

  // Logout
  attach("logoutBtn", ()=> {
    if(!confirm("Log out?")) return;
    auth.signOut().then(()=> {
      currentUser = "";
      money = 0; unlockedColors = 1; clickDelay = 1200; rebirthCount = 0; autoAmount = 0; autoSpeed = 2.5;
      colorPrice = 50; delayPrice = 100; rebirthPrice = 500;
      safeText("money",0); safeText("moneyMultiplier",1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); safeText("unlockedColors",1);
      hide(ui); show(loginBox); hide(ownerCommands);
    }).catch(e => console.error("Sign out failed", e));
  });

  // ---- AUTH ----
  auth.onAuthStateChanged(async user => {
    if(user){
      currentUser = user.uid;
      hide(loginBox);
      show(ui);
      if(currentUser === OWNER_UID) show(ownerCommands); else hide(ownerCommands);
      await loadProgressOnline();
    } else {
      currentUser = "";
      hide(ui);
      hide(ownerCommands);
      show(loginBox);
    }
  });

  // LOGIN / SIGNUP
  attach("loginBtn", async ()=> {
    const email = $("email").value.trim();
    const pass = $("password").value.trim();
    if(!email || !pass){ $("loginMsg").textContent = "Enter email & password!"; return; }
    try {
      await auth.signInWithEmailAndPassword(email, pass);
      $("loginMsg").textContent = "";
    } catch(e){ $("loginMsg").textContent = e.message; }
  });

  attach("signupBtn", async ()=> {
    const email = $("email").value.trim();
    const pass = $("password").value.trim();
    const uname = $("username").value.trim();
    if(!email || !pass || !uname){ $("loginMsg").textContent = "Enter all fields!"; return; }
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.ref("users/" + cred.user.uid).set({ username: uname });
      $("loginMsg").style.color = "lime"; $("loginMsg").textContent = "Account created!";
    } catch(e){ $("loginMsg").style.color = "red"; $("loginMsg").textContent = e.message; }
  });

  attach("forgotBtn", ()=> {
    const email = $("email").value.trim();
    if(!email){ $("loginMsg").textContent = "Enter email!"; return; }
    auth.sendPasswordResetEmail(email).then(()=> { $("loginMsg").textContent = "Password reset email sent!"; }).catch(err => { $("loginMsg").textContent = err.message; });
  });

  // ensure audio can be played after gesture
  let userGestureRegistered = false;
  function ensureSoundGesture(){
    if(userGestureRegistered) return;
    userGestureRegistered = true;
    try { if(fireworkSound){ fireworkSound.play().then(()=>fireworkSound.pause()); } } catch(e){}
  }
  window.addEventListener("pointerdown", ensureSoundGesture, { once: true });

  // ---- startAutoFire if needed ----
  function startAutoFire(){
    if(autoInterval) clearInterval(autoInterval);
    if(autoAmount <= 0) return;
    autoInterval = setInterval(()=> {
      const x = Math.random()*canvas.width;
      const y = Math.random()*(canvas.height*0.6);
      const c = colors[Math.floor(Math.random()*unlockedColors)];
      const gain = c.value * (rebirthCount + 1);
      money += gain;
      safeText("money", money);
      launchRocketTo(x,y);
      saveProgressOnline();
    }, Math.max(120, autoSpeed * 1000));
  }

  // expose startAutoFire used earlier
  window.startAutoFire = startAutoFire;

})();
