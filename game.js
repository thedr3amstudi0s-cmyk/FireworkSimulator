(() => {
  // ---- FIREWORK SIMULATOR: FULL FIXED GAME.JS ----

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

  let currentUser = "";
  let username = "";
  let money = 0;
  let unlockedColors = 1;
  let clickDelay = 1200;
  let rebirthCount = 0;
  let colorPrice = 50;
  let delayPrice = 100;
  let rebirthPrice = 500;
  let autoPrice = 200;
  let autoAmount = 0;
  let autoSpeed = 2.5;

  const baseColors = [
    { color: "hsl(0,100%,60%)", value: 1 },
    { color: "hsl(30,100%,60%)", value: 2 },
    { color: "hsl(60,100%,60%)", value: 3 },
    { color: "hsl(120,100%,60%)", value: 4 },
    { color: "hsl(180,100%,60%)", value: 5 },
    { color: "hsl(240,100%,60%)", value: 6 }
  ];
  let colors = [...baseColors];

  function safeText(id, txt) { const el = $(id); if(el) el.textContent = txt; }
  function show(el) { if(el) el.style.display="block"; }
  function hide(el) { if(el) el.style.display="none"; }

  function saveProgressOnline() {
    if(!currentUser) return;
    db.ref("progress/" + currentUser).set({
      money, unlockedColors, clickDelay, rebirthCount,
      colorPrice, delayPrice, rebirthPrice,
      autoAmount, autoSpeed
    });
    saveScore();
  }

  function loadProgressOnline() {
    if(!currentUser) return;
    db.ref("progress/"+currentUser).once("value").then(snapshot=>{
      const p = snapshot.val();
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
        updateButtons();
      }
    });
  }

  function saveScore() {
    if(!currentUser) return;
    const scoreRef = db.ref("scores/"+currentUser);
    scoreRef.once("value").then(snap=>{
      const oldMoney = snap.val()?.money || 0;
      const newMoney = Math.max(oldMoney, money);
      scoreRef.set({ money:newMoney });
    });
  }

  function updateButtons() {
    safeText("money", money);
    safeText("moneyMultiplier", rebirthCount+1);
    safeText("unlockedColors", unlockedColors);
    safeText("delayDisplay", clickDelay);
    safeText("autoSpeedDisplay", autoSpeed.toFixed(2));

    const buyColor = $("buyColor"); if(buyColor) buyColor.textContent = unlockedColors>=colors.length ? "MAX" : `Buy Color ($${colorPrice})`;
    const reduceDelay = $("reduceDelay"); if(reduceDelay) reduceDelay.textContent = clickDelay<=100 ? "MAX" : `Reduce Delay ($${delayPrice})`;
    const buyAuto = $("buyAuto"); if(buyAuto) buyAuto.textContent = autoAmount>=3 ? "MAX" : `Buy Auto-Launch ($${autoPrice})`;
    const reb = $("rebirth"); if(reb) reb.textContent = `Rebirth ($${rebirthPrice})`;
  }

  function attach(id, fn){ const el = $(id); if(el) el.onclick = fn; }

  // ---- BUTTONS ----
  attach("buyColor", ()=>{ if(money>=colorPrice && unlockedColors<colors.length){ money-=colorPrice; unlockedColors++; colorPrice=Math.floor(colorPrice*1.7); updateButtons(); saveProgressOnline(); }});
  attach("reduceDelay", ()=>{ if(money>=delayPrice && clickDelay>100){ money-=delayPrice; clickDelay=Math.max(clickDelay-100,100); delayPrice=Math.floor(delayPrice*1.7); updateButtons(); saveProgressOnline(); }});
  attach("buyAuto", ()=>{ if(money>=autoPrice && autoAmount<3){ money-=autoPrice; autoAmount++; autoSpeed/=1.2; autoPrice=Math.floor(autoPrice*1.7); updateButtons(); saveProgressOnline(); }});
  attach("rebirth", ()=>{ if(money>=rebirthPrice){ money=0; rebirthCount++; unlockedColors=1; clickDelay=1200; autoAmount=0; autoSpeed=2.5; colorPrice=50; delayPrice=100; rebirthPrice=Math.floor(rebirthPrice*1.7); updateButtons(); saveProgressOnline(); } else alert(`Need $${rebirthPrice} to rebirth!`);});
  attach("resetBtn", ()=>{ if(confirm("Reset progress?")){ money=0; unlockedColors=1; clickDelay=1200; rebirthCount=0; colorPrice=50; delayPrice=100; rebirthPrice=500; autoAmount=0; autoSpeed=2.5; updateButtons(); saveProgressOnline(); }});
  attach("giveMoneyBtn", ()=>{ money+=1000; updateButtons(); saveProgressOnline(); });
  attach("unlockColorsBtn", ()=>{ unlockedColors=colors.length; updateButtons(); saveProgressOnline(); });
  attach("maxAutoBtn", ()=>{ autoAmount=3; autoSpeed=0.1; updateButtons(); saveProgressOnline(); });
  attach("goLeaderboardBtn", ()=>{ window.open("fireworkleaderboard.html","_blank"); });

  // ---- LOGIN / SIGNUP ----
  const loginBtn = $("loginBtn");
  const signupBtn = $("signupBtn");
  const forgotBtn = $("forgotBtn");

  if(loginBtn) loginBtn.onclick = async ()=>{
    const email=$("email").value.trim(), pass=$("password").value.trim();
    if(!email||!pass){ $("loginMsg").textContent="Enter email & password!"; return; }
    try{ const cred = await auth.signInWithEmailAndPassword(email, pass); currentUser=cred.user.uid; $("loginMsg").textContent=""; loginSuccess(); } 
    catch(err){ $("loginMsg").textContent = err.message; }
  };

  if(signupBtn) signupBtn.onclick = async ()=>{
    const uname=$("username").value.trim(), email=$("email").value.trim(), pass=$("password").value.trim();
    if(!uname||!email||!pass){ $("loginMsg").textContent="Enter all fields!"; return; }
    try{ const cred = await auth.createUserWithEmailAndPassword(email, pass); currentUser=cred.user.uid; username=uname; await db.ref("users/"+currentUser).set({username: uname}); $("loginMsg").textContent="Account created!"; loginSuccess(); }
    catch(err){ $("loginMsg").textContent=err.message; }
  };

  if(forgotBtn) forgotBtn.onclick = ()=>{
    const email=$("email").value.trim();
    if(!email){ $("loginMsg").textContent="Enter email!"; return; }
    auth.sendPasswordResetEmail(email).then(()=>{$("loginMsg").textContent="Password reset email sent!";}).catch(err=>{$("loginMsg").textContent=err.message;});
  };

  attach("logoutBtn", ()=>{ auth.signOut().then(()=>{ currentUser=""; hide(ui); hide(ownerCommands); show(loginBox); }).catch(err=>alert(err.message)); });

  function loginSuccess(){
    hide(loginBox); show(ui);
    loadProgressOnline();
    updateButtons();

    // ---- OWNER COMMANDS VISIBILITY ----
    if(currentUser==="FaZgGtIHzVcnSS6c8JAoir9RG8J2") show(ownerCommands); 
    else hide(ownerCommands);

    // ---- LISTEN FOR GLOBAL EVENTS ----
    db.ref("events").on("child_added", snapshot=>{
      const e = snapshot.val();
      if(!e) return;
      const banner = $("eventBanner");
      if(banner){ 
        $("eventName").textContent=e.name; 
        $("eventDesc").textContent=e.desc; 
        let remaining = e.duration || 5;
        $("eventTimer").textContent = `Time left: ${remaining}s`;
        show(banner);
        const interval = setInterval(()=>{
          remaining--; $("eventTimer").textContent=`Time left: ${remaining}s`;
          if(remaining<=0){ hide(banner); clearInterval(interval); }
        },1000);
      }
    });
  }

  // ---- OWNER EVENT BUTTONS ----
  if(ownerCommands){
    const buttons = ownerCommands.querySelectorAll(".ownerBtn");
    buttons.forEach(btn=>{
      btn.onclick = ()=>{
        if(!currentUser) return;
        const eventName = btn.dataset.event || "ownerEvent";
        const duration = parseInt(prompt("Event duration in seconds:", "10")) || 5;
        const desc = `Triggered by ${username || "Owner"}`;
        const newEvent = {name:eventName, desc, duration};
        db.ref("events").push(newEvent); // broadcast to everyone
      };
    });
  }

  // ---- FIREWORKS ----
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let fireworks = [];

class Firework {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.particles = [];
    for(let i=0;i<30;i++){
      this.particles.push({
        x: x,
        y: y,
        vx: (Math.random()-0.5)*6,
        vy: (Math.random()-0.5)*6,
        alpha: 1,
        color: `hsl(${Math.random()*360},100%,60%)`
      });
    }
  }
  update() {
    this.particles.forEach(p=>{
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.05; // gravity
      p.alpha -= 0.02;
    });
    this.particles = this.particles.filter(p=>p.alpha>0);
  }
  draw(ctx) {
    this.particles.forEach(p=>{
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x,p.y,3,0,Math.PI*2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }
}

function launchFirework(x, y){
  fireworks.push(new Firework(x,y));
  if(fireworkSound) fireworkSound.currentTime=0, fireworkSound.play();
}

function animate() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  fireworks.forEach(fw=>{ fw.update(); fw.draw(ctx); });
  fireworks = fireworks.filter(fw=>fw.particles.length>0);
  requestAnimationFrame(animate);
}
animate();

// ---- CLICK ANY BUTTON OR AREA AROUND IT TO LAUNCH ----
function attachFireworkClicks(btnIds){
  btnIds.forEach(id=>{
    const el = $(id);
    if(el){
      el.addEventListener("click", e=>{
        const rect = el.getBoundingClientRect();
        launchFirework(rect.left+rect.width/2, rect.top+rect.height/2);
      });
    }
  });
}

// Launch fireworks on all buttons
attachFireworkClicks([
  "buyColor","reduceDelay","buyAuto","rebirth","resetBtn",
  "giveMoneyBtn","unlockColorsBtn","maxAutoBtn","goLeaderboardBtn",
  "logoutBtn"
]);


})();
