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
  const eventBanner = $("eventBanner");
  const eventNameEl = $("eventName");
  const eventDescEl = $("eventDesc");
  const eventTimerEl = $("eventTimer");

  const resizeCanvas = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  // ---- STATE ----
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
    active:false,
    doubleMoney:false,
    rainbowMode:false,
    chainReaction:false,
    cosmicMode:false,
    luckyExplosions:false,
    chaosRoll:false,
    goldenFirework:false,
    adminStorm:false,
    blackout:false,
    glitch:false,
    name:"",
    description:"",
    endsAt:null
  };
  const eventIntervals = {};
  let gravity = 0.04;

  // ---- HELPERS ----
  const safeText = (id, txt) => { const el=$(id); if(el) el.textContent=txt; };
  const show = el => { if(el) el.style.display="block"; };
  const hide = el => { if(el) el.style.display="none"; };

  function showEventBanner(name, desc="", endsAt=null){
    if(!eventBanner||!eventNameEl) return;
    eventNameEl.textContent=name;
    if(eventDescEl) eventDescEl.textContent=desc;
    if(eventTimerEl){
      if(!endsAt) eventTimerEl.textContent="";
      else {
        const update=()=>{
          const left=Math.max(0, endsAt-Date.now());
          eventTimerEl.textContent=left>0?`Ends in ${Math.ceil(left/1000)}s`:"Ending...";
          if(left<=0) clearInterval(eventIntervals._bannerTimer);
        };
        clearInterval(eventIntervals._bannerTimer);
        update();
        eventIntervals._bannerTimer=setInterval(update,1000);
      }
    }
    show(eventBanner);
  }
  const hideEventBanner = () => { if(eventBanner) hide(eventBanner); if(eventTimerEl) eventTimerEl.textContent=""; };

  // ---- FIREWORKS ----
  class Firework {
    constructor(x,y){
      this.particles=[];
      for(let i=0;i<30;i++){
        this.particles.push({
          x:x,
          y:y,
          vx:(Math.random()-0.5)*6,
          vy:(Math.random()-0.5)*6,
          alpha:1,
          color:`hsl(${Math.random()*360},100%,60%)`
        });
      }
    }
    update(){
      this.particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.05;p.alpha-=0.02;});
      this.particles=this.particles.filter(p=>p.alpha>0);
    }
    draw(ctx){
      this.particles.forEach(p=>{
        ctx.fillStyle=p.color;
        ctx.globalAlpha=p.alpha;
        ctx.beginPath();
        ctx.arc(p.x,p.y,3,0,Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha=1;
    }
  }

  function launchFirework(x,y){
    fireworks.push(new Firework(x,y));
    if(fireworkSound) fireworkSound.currentTime=0, fireworkSound.play();
  }

  function animate(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    fireworks.forEach(fw=>{fw.update();fw.draw(ctx);});
    fireworks=fireworks.filter(fw=>fw.particles.length>0);
    requestAnimationFrame(animate);
  }
  animate();

  // ---- SAVE / LOAD ----
  async function saveProgressOnline(){
    if(!currentUser) return;
    const progress={money,unlockedColors,clickDelay,rebirthCount,rebirthPrice,colorPrice,delayPrice,autoAmount,autoSpeed};
    try{await db.ref("progress/"+currentUser).set(progress);}catch(e){console.error(e);}
  }

  async function loadProgressOnline(){
    if(!currentUser) return;
    try{
      const snap=await db.ref("progress/"+currentUser).once("value");
      const p=snap.val();
      if(p){money=p.money||0;unlockedColors=p.unlockedColors||1;clickDelay=p.clickDelay||1200;
        rebirthCount=p.rebirthCount||0;rebirthPrice=p.rebirthPrice||500;colorPrice=p.colorPrice||50;delayPrice=p.delayPrice||100;
        autoAmount=p.autoAmount||0;autoSpeed=p.autoSpeed||2.5; safeText("money",money);
        safeText("moneyMultiplier",rebirthCount+1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2));
        safeText("unlockedColors",unlockedColors);
      }
    }catch(e){console.error(e);}
  }

  // ---- BUTTON LOGIC ----
  const attach=(id,fn)=>{const el=$(id);if(el) el.addEventListener("click",fn);};

  attach("buyColor",()=>{
    if(money>=colorPrice && unlockedColors<colors.length){
      money-=colorPrice; unlockedColors++; colorPrice=Math.floor(colorPrice*1.7);
      safeText("money",money); safeText("unlockedColors",unlockedColors);
      launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2));
      saveProgressOnline();
    }
  });

  attach("reduceDelay",()=>{
    if(money>=delayPrice && clickDelay>100){
      money-=delayPrice; clickDelay=Math.max(clickDelay-100,100); delayPrice=Math.floor(delayPrice*1.7);
      safeText("money",money); safeText("delayDisplay",clickDelay);
      launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2));
      saveProgressOnline();
    }
  });

  attach("buyAuto",()=>{
    if(autoAmount<3 && money>=autoPrice){
      money-=autoPrice; autoAmount++; autoSpeed/=1.2; autoPrice=Math.floor(autoPrice*1.7);
      safeText("money",money); safeText("autoSpeedDisplay",autoSpeed.toFixed(2));
      launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2));
      saveProgressOnline();
    }
  });

  attach("rebirth",()=>{
    if(money>=rebirthPrice){
      money=0; rebirthCount++; unlockedColors=1; clickDelay=1200; autoAmount=0; autoSpeed=2.5;
      colorPrice=50; delayPrice=100; rebirthPrice=Math.floor(rebirthPrice*1.7);
      safeText("money",money); safeText("moneyMultiplier",rebirthCount+1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2));
      launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2));
      saveProgressOnline();
    } else alert(`Need $${rebirthPrice} to rebirth!`);
  });

  attach("resetBtn",()=>{
    if(confirm("Reset progress?")){
      money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; autoAmount=0; autoSpeed=2.5;
      colorPrice=50; delayPrice=100; rebirthPrice=500;
      safeText("money",money); safeText("moneyMultiplier",1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); safeText("unlockedColors",unlockedColors);
      launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2));
      saveProgressOnline();
    }
  });

  attach("giveMoneyBtn",()=>{money+=1000; safeText("money",money); launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2)); saveProgressOnline();});
  attach("unlockColorsBtn",()=>{unlockedColors=colors.length; safeText("unlockedColors",unlockedColors); launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2)); saveProgressOnline();});
  attach("maxAutoBtn",()=>{autoAmount=3; autoSpeed=0.1; safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); launchFirework(Math.random()*canvas.width,Math.random()*(canvas.height/2)); saveProgressOnline();});
  attach("goLeaderboardBtn",()=>{try{window.open("fireworkleaderboard.html","_blank");}catch(e){console.error(e);});

  });

  // ---- LOGOUT ----
  attach("logoutBtn",()=>{
    if(confirm("Log out?")){
      auth.signOut();
      currentUser=""; money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; autoAmount=0; autoSpeed=2.5;
      safeText("money",0); safeText("moneyMultiplier",1); safeText("delayDisplay",clickDelay); safeText("autoSpeedDisplay",autoSpeed.toFixed(2)); safeText("unlockedColors",1);
      hide(ui); show(loginBox); hide(ownerCommands);
    }
  });

  // ---- AUTH ----
  auth.onAuthStateChanged(async user=>{
    if(user){
      currentUser=user.uid; hide(loginBox); show(ui);
      await loadProgressOnline();
      // show owner commands only to specific UID
      if(currentUser==="FaZgGtIHzVcnSS6c8JAoir9RG8J2"){show(ownerCommands);}
      else{hide(ownerCommands);}
    } else {
      currentUser=""; hide(ui); hide(ownerCommands); show(loginBox);
    }
  });

  // ---- LOGIN / SIGNUP ----
  attach("loginBtn", async ()=>{
    const email=$("email").value.trim(), pass=$("password").value.trim();
    if(!email||!pass){ $("loginMsg").textContent="Enter email & password!"; return;}
    try{
      const cred=await auth.signInWithEmailAndPassword(email,pass);
      $("loginMsg").textContent="";
    } catch(e){ $("loginMsg").textContent=e.message; }
  });

  attach("signupBtn", async ()=>{
    const email=$("email").value.trim(), uname=$("username").value.trim(), pass=$("password").value.trim();
    if(!email||!pass||!uname){ $("loginMsg").textContent="Enter all fields!"; return;}
    try{
      const cred=await auth.createUserWithEmailAndPassword(email,pass);
      await db.ref("users/"+cred.user.uid).set({username:uname});
      $("loginMsg").style.color="lime"; $("loginMsg").textContent="Account created!";
    }catch(e){ $("loginMsg").style.color="red"; $("loginMsg").textContent=e.message;}
  });

  attach("forgotBtn", ()=>{
    const email=$("email").value.trim();
    if(!email){$("loginMsg").textContent="Enter email!"; return;}
    auth.sendPasswordResetEmail(email).then(()=>{$("loginMsg").textContent="Password reset email sent!";}).catch(err=>{$("loginMsg").textContent=err.message;});
  });

})();
