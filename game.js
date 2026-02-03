// 🔥 FIREBASE CONFIG (use YOURS)
firebase.initializeApp({
    apiKey: "AIzaSyD_OXSvcK9AWoCU0AaXuc7Z7sMhEV1nBg4",
    authDomain: "fireworkleaderboard.firebaseapp.com",
    databaseURL: "https://fireworkleaderboard-default-rtdb.firebaseio.com",
    projectId: "fireworkleaderboard",
    storageBucket: "fireworkleaderboard.appspot.com",
    messagingSenderId: "243474267364",
    appId: "1:243474267364:web:8f0f2bedbbbca3c05f40f1",
    measurementId: "G-H07BZY385S"
});

// ---------- CANVAS ----------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
resize();
window.onresize = resize;

function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

// ---------- STATE ----------
let loggedIn = false;
let money = 0;
let colors = 1;
let delay = 1200;
let lastLaunch = 0;

const fireworks = [];
const particles = [];

// ---------- LOGIN ----------
loginBtn.onclick = () => auth(false);
signupBtn.onclick = () => auth(true);

function auth(signup) {
  const email = emailInput.value;
  const pass = passwordInput.value;
  const fn = signup
    ? firebase.auth().createUserWithEmailAndPassword
    : firebase.auth().signInWithEmailAndPassword;

  fn(email, pass)
    .then(() => loginMsg.textContent = "")
    .catch(e => loginMsg.textContent = e.message);
}

firebase.auth().onAuthStateChanged(user => {
  if (!user) return;

  loggedIn = true;
  loginBox.style.display = "none";
  ui.style.display = "block";
  logoutBtn.style.display = "block";
  resetBtn.style.display = "block";

  const ref = firebase.database().ref("players/" + user.uid);
  ref.once("value").then(snap => {
    if (snap.exists()) Object.assign(window, snap.val());
  });
});

// ---------- LOGOUT / RESET ----------
logoutBtn.onclick = () => firebase.auth().signOut();

resetBtn.onclick = () => {
  money = 0;
  colors = 1;
  delay = 1200;
  save();
};

// ---------- SAVE ----------
function save() {
  const u = firebase.auth().currentUser;
  if (!u) return;
  firebase.database().ref("players/" + u.uid).set({ money, colors, delay });
}

// ---------- FIREWORKS ----------
canvas.addEventListener("click", e => {
  if (!loggedIn) return;
  if (Date.now() - lastLaunch < delay) return;
  launch(e.clientX, e.clientY);
});

function launch(x, y) {
  lastLaunch = Date.now();
  fireworks.push({ x, y: canvas.height, tx: x, ty: y });
  money += 10;
  save();
}

function explode(x, y) {
  for (let i = 0; i < 50; i++) {
    particles.push({
      x, y,
      vx: Math.cos(i) * Math.random() * 4,
      vy: Math.sin(i) * Math.random() * 4,
      life: 60,
      color: `hsl(${Math.random() * 360},100%,60%)`
    });
  }
}

// ---------- LOOP ----------
function loop() {
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  fireworks.forEach((f, i) => {
    f.y -= 8;
    ctx.fillStyle = "white";
    ctx.fillRect(f.x, f.y, 2, 10);
    if (f.y <= f.ty) {
      explode(f.x, f.y);
      fireworks.splice(i, 1);
    }
  });

  particles.forEach((p, i) => {
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
    if (p.life <= 0) particles.splice(i, 1);
  });

  moneySpan.textContent = money;
  colorText.textContent = colors;

  const cd = Math.min((Date.now() - lastLaunch) / delay, 1);
  cooldownFill.style.width = (cd * 100) + "%";

  requestAnimationFrame(loop);
}
loop();
