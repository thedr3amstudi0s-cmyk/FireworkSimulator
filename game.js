(() => {
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

  const $ = id => document.getElementById(id);
  const canvas = $("canvas");
  const ctx = canvas?.getContext("2d");
  const loginBox = $("loginBox");
  const ui = $("ui");
  const ownerCommands = $("ownerCommands");

  // Prevent text selection
  document.body.style.userSelect = "none";
  document.body.style.webkitUserSelect = "none";
  document.body.style.msUserSelect = "none";

  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  window.addEventListener("resize", resize);
  resize();

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
  const gravity = 0.04;

  const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];
  let colors = [...baseColors];

  const EVENTS_STATE = {};
  const eventIntervals = {};

  function safeText(id, txt) { const el = $(id); if (el) el.textContent = txt; }
  function show(el) { if (!el) return; el.style.display = "block"; }
  function hide(el) { if (!el) return; el.style.display = "none"; }

  function showEventBanner(name) {
    const eventBanner = $("eventBanner");
    const eventNameEl = $("eventName");
    if(!eventBanner || !eventNameEl) return;
    eventNameEl.textContent = name || "Event";
    show(eventBanner);
  }
  function hideEventBanner() {
    const eventBanner = $("eventBanner");
    const eventNameEl = $("eventName");
    if(!eventBanner || !eventNameEl) return;
    hide(eventBanner);
    eventNameEl.textContent = "";
  }

  class Firework {
    constructor(x, y, colorObj) { this.x = x; this.y = canvas.height; this.targetY = y; this.speed = Math.random() * 2 + 4; this.colorObj = colorObj; }
    update() { this.y -= this.speed; if (this.y <= this.targetY) { explode(this.x, this.y, this.colorObj); return true; } return false; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, 2, 0, Math.PI*2); ctx.fillStyle = this.colorObj.color; ctx.fill(); }
  }

  class Particle {
    constructor(x, y, color) { this.x=x; this.y=y; this.color=color.color||color; this.speedX=(Math.random()-0.5)*6; this.speedY=(Math.random()-0.5)*6; this.life=100; }
    update() { this.speedY += gravity; this.x+=this.speedX; this.y+=this.speedY; this.life--; }
    draw() { ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fillStyle=this.color; ctx.fill(); }
  }

  function awardAndSave(amount){ money+=Math.floor(amount); safeText("money",money); saveProgressOnline(); }

  function explode(x,y,colorObj){ for(let i=0;i<80;i++) particles.push(new Particle(x,y,colorObj)); const base=colorObj.value||1; awardAndSave(base*(rebirthCount+1)); }

  function launchFirework(x,y){ const colorObj=colors[Math.floor(Math.random()*Math.max(1,unlockedColors))]; fireworks.push(new Firework(x,y,colorObj)); lastClick=Date.now(); }

  function animate(){
    if(!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let i=fireworks.length-1;i>=0;i--){if(fireworks[i].update())fireworks.splice(i,1); else fireworks[i].draw();}
    for(let i=particles.length-1;i>=0;i--){particles[i].update(); particles[i].draw(); if(particles[i].life<=0) particles.splice(i,1);}
    requestAnimationFrame(animate);
  }

  async function saveProgressOnline(){ if(!currentUser) return; const progress={money,unlockedColors,clickDelay,rebirthCount,colorPrice,delayPrice,rebirthPrice,autoAmount,autoSpeed}; try{await db.ref("progress/"+currentUser).set(progress);}catch(e){console.error(e);} }

  async function loadProgressOnline(){
    if(!currentUser) return;
    try{
      const snap=await db.ref("progress/"+currentUser).once("value"); const p=snap.val();
      if(p){ money=p.money||0; unlockedColors=p.unlockedColors||1; clickDelay=p.clickDelay||1200; rebirthCount=p.rebirthCount||0; autoAmount=p.autoAmount||0; autoSpeed=p.autoSpeed||2.5; colors=[...baseColors]; safeText("money",money); startAutoLaunch();}
    }catch(e){console.error(e);}
  }

  function attach(id,fn){const el=$(id); if(el) el.addEventListener("click",fn);}

  // Buttons also launch fireworks when clicked
  function attachButtonFirework(id){ attach(id,(e)=>{launchFirework(e.clientX,e.clientY);}); }

  ["buyColor","reduceDelay","buyAuto","rebirth","resetBtn","goLeaderboardBtn","giveMoneyBtn","unlockColorsBtn","maxAutoBtn"].forEach(attachButtonFirework);

  attach("rebirth",()=>{ if(money>=rebirthPrice){ money=0; rebirthCount++; unlockedColors=1; clickDelay=1200; autoAmount=0; autoSpeed=2.5; colors=[...baseColors]; safeText("money",money); startAutoLaunch(); alert("Rebirth complete!"); }else alert(`Need $${rebirthPrice} to rebirth!`); });

  function startAutoLaunch(){ if(autoInterval) clearInterval(autoInterval); if(autoAmount>0){ autoInterval=setInterval(()=>{ launchFirework(Math.random()*canvas.width, Math.random()*(canvas.height/2)); }, Math.max(50,autoSpeed*1000)); } }

  function triggerEventByName(name){ 
    const duration = parseInt(prompt("Enter event duration in seconds:", "10")) || 10;
    EVENTS_STATE[name]=true;
    showEventBanner(name);
    setTimeout(()=>{EVENTS_STATE[name]=false; hideEventBanner();}, duration*1000);
  }

  auth.onAuthStateChanged(async user=>{
    if(user){currentUser=user.uid; hide(loginBox); show(ui); show(ownerCommands); await loadProgressOnline(); animate(); }
    else{currentUser=""; show(loginBox); hide(ui); hide(ownerCommands); }
  });

  attach("loginBtn",()=>{ const em=$("email"); const pw=$("password"); if(!em||!pw)return; auth.signInWithEmailAndPassword(em.value,pw.value).catch(e=>alert(e.message)); });
  attach("signupBtn",()=>{ const em=$("email"); const pw=$("password"); if(!em||!pw)return; auth.createUserWithEmailAndPassword(em.value,pw.value).catch(e=>alert(e.message)); });
  attach("logoutBtn",()=>{ auth.signOut().catch(console.error); });

  // Launch fireworks anywhere on canvas click
  if(canvas) canvas.addEventListener("click",(e)=>{ if(Date.now()-lastClick>=clickDelay) launchFirework(e.clientX,e.clientY); });

})();
