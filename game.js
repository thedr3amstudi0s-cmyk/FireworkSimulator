// ---- Fully patched game.js ----
(() => {
  // Firebase config
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
  const ctx = canvas.getContext("2d");
  const loginBox = $("loginBox");
  const ui = $("ui");
  const ownerCommands = $("ownerCommands");
  const fireworkSound = $("fireworkSound");
  const eventBanner = $("eventBanner");
  const eventNameEl = $("eventName");
  const eventDescEl = $("eventDesc");
  const eventTimerEl = $("eventTimer");

  if (canvas) {
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    resize();
  }

  // ---- State ----
  let currentUser = "";
  let money = 0, unlockedColors = 1, clickDelay = 1200, lastClick = Date.now();
  let rebirthCount = 0, colorPrice = 50, delayPrice = 100, rebirthPrice = 500;
  let autoAmount = 0, autoSpeed = 2.5, autoInterval = null;
  let fireworks = [], particles = [];
  const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];
  let colors = [...baseColors];

  const EVENTS_STATE = {
    active: false, doubleMoney:false, rainbowMode:false, chainReaction:false,
    cosmicMode:false, luckyExplosions:false, chaosRoll:false, goldenFirework:false,
    adminStorm:false, blackout:false, glitch:false, name: "", description: "", endsAt: null
  };
  const eventIntervals = {};

  function safeText(id, txt){ const el = $(id); if(el) el.textContent = txt; }
  function show(el){ if(el) el.style.display = "block"; }
  function hide(el){ if(el) el.style.display = "none"; }

  // ---- Firework Classes ----
  class Firework {
    constructor(x, y, colorObj, owner=false){ this.x=x;this.y=canvas.height;this.targetY=y;this.speed=Math.random()*2+4;this.colorObj=colorObj;this.owner=owner; }
    update(){
      this.y-=this.speed;
      if(this.y<=this.targetY){ explode(this.x,this.y,this.colorObj,this.owner); return true; }
      return false;
    }
    draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fillStyle=this.colorObj.color; ctx.fill(); }
  }
  class Particle {
    constructor(x,y,color){ this.x=x; this.y=y; this.color=color.color||color; this.speedX=(Math.random()-0.5)*6; this.speedY=(Math.random()-0.5)*6; this.life=100; }
    update(){ this.speedY+=0.04; this.x+=this.speedX; this.y+=this.speedY; this.life--; }
    draw(){ ctx.beginPath(); ctx.arc(this.x,this.y,2,0,Math.PI*2); ctx.fillStyle=this.color; ctx.fill(); }
  }

  function awardAndSave(amount){ if(!Number.isFinite(amount)) return; if(amount<0) amount=0; money+=Math.floor(amount); safeText("money",money); saveProgressOnline(); saveScore(); }

  function explode(x,y,colorObj,ownerFlag=false){ if(fireworkSound){ try{ fireworkSound.currentTime=0; fireworkSound.play(); }catch{} }
    for(let i=0;i<80;i++) particles.push(new Particle(x,y,colorObj));
    let base=(colorObj.value||1)*(rebirthCount+1); computeAndAward(base);
  }
  function computeAndAward(baseMoney){ let base=Math.max(0,Math.floor(baseMoney)); awardAndSave(base); }
  function launchFirework(x,y){ const colorIndex=Math.floor(Math.random()*Math.max(1,unlockedColors)); const colorObj=colors[colorIndex]||colors[0]; fireworks.push(new Firework(x,y,colorObj,true)); lastClick=Date.now(); }

  function animate(){
    ctx.fillStyle="rgba(0,0,0,0.2)";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    for(let i=fireworks.length-1;i>=0;i--){ if(fireworks[i].update()) fireworks.splice(i,1); else fireworks[i].draw(); }
    for(let i=particles.length-1;i>=0;i--){ particles[i].update(); particles[i].draw(); if(particles[i].life<=0) particles.splice(i,1); }
    safeText("moneyMultiplier",rebirthCount+1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2));
    const elapsed=Date.now()-lastClick; const fill=Math.min(100,(elapsed/clickDelay)*100); const cdFill=$("cooldownFill"); if(cdFill) cdFill.style.width=fill+"%";
    requestAnimationFrame(animate);
  }

  // ---- Save/Load ----
  async function saveProgressOnline(){ if(!currentUser) return; const progress={money, unlockedColors, clickDelay, rebirthCount, colorPrice, delayPrice, rebirthPrice, autoAmount, autoSpeed}; try{ await db.ref("progress/"+currentUser).set(progress); }catch(e){ console.error(e); } }
  async function loadProgressOnline(){ if(!currentUser) return; try{ const snap=await db.ref("progress/"+currentUser).once("value"); const p=snap.val(); if(p){ money=p.money||0; unlockedColors=p.unlockedColors||1; clickDelay=p.clickDelay||1200; rebirthCount=p.rebirthCount||0;
    autoAmount=p.autoAmount||0; autoSpeed=p.autoSpeed||2.5; colors=[...baseColors]; safeText("money",money); startAutoLaunch(); }}catch(e){ console.error(e);} }
  function saveScore(){ if(!currentUser) return; const scoreRef=db.ref("scores/"+currentUser); scoreRef.once("value").then(snap=>{ const oldMoney=snap.val()?.money||0; scoreRef.set({money:Math.max(oldMoney,money)}).catch(console.error); }).catch(console.error); }

  function startAutoLaunch(){ if(autoInterval) clearInterval(autoInterval); if(autoAmount>0){ autoInterval=setInterval(()=>{ launchFirework(Math.random()*canvas.width,Math.random()*canvas.height/2); },Math.max(50,autoSpeed*1000)); }}

  // ---- Event Banner ----
  function showEventBanner(name){ if(eventBanner&&eventNameEl){ eventNameEl.textContent=name; show(eventBanner); }}
  function hideEventBanner(){ if(eventBanner) hide(eventBanner); }

  function triggerEventByName(name,duration=10000){
    EVENTS_STATE.active=true; EVENTS_STATE.name=name; EVENTS_STATE.endsAt=Date.now()+duration;
    showEventBanner(name);
    setTimeout(()=>{ EVENTS_STATE.active=false; hideEventBanner(); },duration);
    db.ref("events/current").set({name,duration,ts:Date.now()});
  }

  // Listen for events from owner
  db.ref("events/current").on("value",snap=>{ const e=snap.val(); if(e) triggerEventByName(e.name,e.duration); });

  // ---- Click handler ----
  document.addEventListener("click",e=>{ const now=Date.now(); if(now-lastClick>=clickDelay){ lastClick=now; launchFirework(e.clientX,e.clientY); } });

  // ---- Owner Commands ----
  function bindOwnerButtons(){ if(!ownerCommands) return; const userEmail=(auth.currentUser?.email||""); if(userEmail!="Dreamcrusher41") return; ownerCommands.style.display="block";
    const buttons=ownerCommands.querySelectorAll("button"); buttons.forEach(btn=>{ const evt=btn.dataset.event; btn.addEventListener("click",()=>{ const dur=parseInt(prompt("Event duration (ms):",10000))||10000; triggerEventByName(evt,dur); }); });
  }

  // ---- Auth ----
  auth.onAuthStateChanged(async user=>{
    if(user){ currentUser=user.uid; if(loginBox) loginBox.style.display="none"; if(ui) ui.style.display="block"; bindOwnerButtons(); await loadProgressOnline(); }
    else{ currentUser=""; if(loginBox) loginBox.style.display="flex"; if(ui) ui.style.display="none"; if(ownerCommands) ownerCommands.style.display="none"; money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; autoAmount=0; autoSpeed=2.5; safeText("money",0); safeText("moneyMultiplier",1); safeText("delayDisplay",1200); safeText("autoSpeedDisplay",2.5); hideEventBanner(); }
  });

  $("loginBtn")?.addEventListener("click",async()=>{ const email=$("email").value.trim(); const pass=$("password").value.trim(); if(!email||!pass){ if($("loginMsg")) $("loginMsg").textContent="Enter email & password!"; return; }
    try{ const cred=await auth.signInWithEmailAndPassword(email,pass); currentUser=cred.user.uid; if($("loginMsg")) $("loginMsg").textContent=""; }catch(err){ if($("loginMsg")) $("loginMsg").textContent=err.message; }
  });
  $("signupBtn")?.addEventListener("click",async()=>{ const uname=$("username").value.trim(); const email=$("email").value.trim(); const pass=$("password").value.trim(); if(!uname||!email||!pass){ if($("loginMsg")) $("loginMsg").textContent="Enter all fields!"; return; }
    try{ const cred=await auth.createUserWithEmailAndPassword(email,pass); currentUser=cred.user.uid; await db.ref("users/"+currentUser).set({username:uname}); if($("loginMsg")){ $("loginMsg").style.color="lime"; $("loginMsg").textContent="Account created!"; } }catch(err){ if($("loginMsg")){ $("loginMsg").style.color="red"; $("loginMsg").textContent=err.message; } } });

  animate();
})();
