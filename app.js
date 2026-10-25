import { firebaseConfig } from "./firebase-config.js";
import * as L from "./logic.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  onSnapshot, query, orderBy, limit, arrayUnion, deleteField,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// ---------------------------------------------------------------- setup
const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// only allow our own shrunk images as <img src>
const safeImg = (s) => (typeof s === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : "");

const configured = firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const PHOTO_LIMIT = 30;
const TAGS = ["Free", "At work", "Driving", "Eating", "Resting", "Studying", "Out", "Busy"];
const svg = (d) => `<svg class="i" aria-hidden="true" viewBox="0 0 24 24">${d}</svg>`;
const ICON = {
  home: svg('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>'),
  plan: svg('<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  cycle: svg('<path d="M12 3c3.5 4.2 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 8.5 7.2 12 3z"/>'),
  photos: svg('<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-5-5-8 8"/>'),
  memories: svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'),
  notes: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  heart: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  left: svg('<path d="M15 5l-7 7 7 7"/>'),
  right: svg('<path d="M9 5l7 7-7 7"/>'),
};
const TABS = [
  ["home", ICON.home, "Home"],
  ["plan", ICON.plan, "Plan"],
  ["cycle", ICON.cycle, "Cycle"],
  ["photos", ICON.photos, "Photos"],
  ["memories", ICON.memories, "Memories and dates"],
  ["notes", ICON.notes, "Notes"],
];

// Original bear + panda faces, drawn once and reused everywhere.
const FACES = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="gBrown" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E9C48A"/><stop offset="0.5" stop-color="#B9844E"/><stop offset="1" stop-color="#7C5129"/></linearGradient>
<symbol id="faceBrown" viewBox="0 0 100 100">
<circle cx="24" cy="26" r="15" fill="url(#gBrown)"/><circle cx="76" cy="26" r="15" fill="url(#gBrown)"/>
<circle cx="24" cy="26" r="7" fill="#3A2416" opacity="0.5"/><circle cx="76" cy="26" r="7" fill="#3A2416" opacity="0.5"/>
<circle cx="50" cy="55" r="36" fill="url(#gBrown)"/><ellipse cx="50" cy="68" rx="17" ry="13" fill="#F6E3C0"/>
<circle cx="37" cy="50" r="4.6" fill="#2A1A0E"/><circle cx="63" cy="50" r="4.6" fill="#2A1A0E"/>
<ellipse cx="50" cy="62.5" rx="6.5" ry="4.8" fill="#2A1A0E"/>
<path d="M50 67v4.5M44.5 73.5q5.5 4 11 0" stroke="#2A1A0E" stroke-width="2.6" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="facePanda" viewBox="0 0 100 100">
<circle cx="23" cy="25" r="15" fill="#2B2326"/><circle cx="77" cy="25" r="15" fill="#2B2326"/>
<circle cx="50" cy="55" r="36" fill="#FFFFFF" stroke="#EFC6D2" stroke-width="1.5"/>
<ellipse cx="36" cy="51" rx="9" ry="11" fill="#2B2326" transform="rotate(-28 36 51)"/>
<ellipse cx="64" cy="51" rx="9" ry="11" fill="#2B2326" transform="rotate(28 64 51)"/>
<circle cx="37.5" cy="49.5" r="3" fill="#FFFFFF"/><circle cx="62.5" cy="49.5" r="3" fill="#FFFFFF"/>
<ellipse cx="50" cy="64" rx="6" ry="4.4" fill="#2B2326"/>
<path d="M50 68v3.5M45 73q5 3.6 10 0" stroke="#2B2326" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<circle cx="30" cy="66" r="4.5" fill="#F4A9BE" opacity="0.85"/><circle cx="70" cy="66" r="4.5" fill="#F4A9BE" opacity="0.85"/>
</symbol></defs></svg>`;
const face = (kind, px) => `<svg class="bear" width="${px}" height="${px}" aria-hidden="true"><use href="#${kind === "panda" ? "facePanda" : "faceBrown"}"/></svg>`;

const S = {
  uid: null, name: "", email: "", cid: null, couple: null, partnerUid: null,
  people: {}, schedule: [], events: [], thoughts: [], cycle: {}, pcErr: false,
  photos: [], memories: [], pings: [], viewing: null, busy: false,
  tab: "home", weekOff: 0, schedDate: L.ymd(L.today()), pendingTag: null,
  authMode: "signin", settings: false, lastLoc: 0, unsubs: [], pcUnsub: null,
  themePref: "auto", lastPingSent: 0, sessionStart: Date.now(),
};

// ---------------------------------------------------------------- small helpers
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
let toastTimer;
function toast(msg) {
  const t = $("#toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3500);
}
const fmtD = (s) => L.parseYmd(s).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtDate = (d) => d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
const fmtDY = (s) => L.parseYmd(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const partnerName = () => (S.partnerUid && S.people[S.partnerUid]?.name) || "Partner";
const nameOf = (uid) => (uid === S.uid ? "You" : S.people[uid]?.name || "Partner");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function friendlyError(err) {
  const c = err?.code || "";
  const map = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "That email doesn't look right.",
    "auth/email-already-in-use": "That email already has an account. Try Sign in.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/network-request-failed": "No internet connection.",
    "auth/too-many-requests": "Too many tries. Wait a bit and try again.",
    "auth/operation-not-allowed": "Email/password sign-in isn't switched on in Firebase yet.",
    "permission-denied": "Permission denied. Check that the latest Firestore rules were published.",
    unavailable: "Can't reach the server. Check your internet.",
  };
  return map[c] || err?.message || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------- theme
const darkQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;
const currentTheme = () => L.resolveTheme(S.themePref, !!darkQuery?.matches);
function applyTheme() {
  const t = currentTheme();
  const html = document.documentElement;
  if (html) html.dataset.theme = t;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", t === "panda" ? "#F6DCE4" : "#2A1A0F"));
  document.querySelectorAll(".sw button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === t)));
  const logo = $(".brandline use");
  if (logo) logo.setAttribute("href", t === "panda" ? "#facePanda" : "#faceBrown");
}
S.themePref = store.get("bear-theme") || "auto";
applyTheme();
darkQuery?.addEventListener?.("change", () => { applyTheme(); if (S.settings) renderSheet(); });

// ---------------------------------------------------------------- images
// Shrinks a picked photo in the browser so it fits comfortably in the free database.
function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("That file couldn't be opened as a photo.")); };
    img.src = url;
  });
}
async function shrink(file, steps) {
  if (!file || !file.type?.startsWith("image/")) throw new Error("Please pick a photo.");
  const img = await loadImage(file);
  for (const [max, q, cap] of steps) {
    const { w, h } = L.fitSize(img.naturalWidth, img.naturalHeight, max);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const data = c.toDataURL("image/jpeg", q);
    if (data.length <= cap) return data;
  }
  throw new Error("That photo is too large even after shrinking. Try another one.");
}
const shrinkPhoto = (f) => shrink(f, [[1280, 0.72, 850000], [1024, 0.65, 850000], [800, 0.6, 850000]]);
const shrinkAvatar = (f) => shrink(f, [[256, 0.8, 120000], [180, 0.7, 120000]]);

// ---------------------------------------------------------------- screens
const root = () => $("#app");
function mountFaces() {
  if (!document.getElementById("bear-faces") && document.body?.insertAdjacentHTML) {
    document.body.insertAdjacentHTML("afterbegin", FACES.replace("<svg ", '<svg id="bear-faces" '));
  }
}

function screenSetup() {
  root().innerHTML = `<div class="center"><div class="card narrow">
    <h1>Almost there</h1>
    <p>The app is online, but it isn't connected to your Firebase project yet.</p>
    <p class="muted">Open <b>firebase-config.js</b> on GitHub, paste your Firebase settings into it, and save. Then refresh this page.</p>
  </div></div>`;
}

function screenLoading() {
  root().innerHTML = `<div class="center"><div class="brand">${face(currentTheme(), 72)}</div></div>`;
}

function screenAuth() {
  const up = S.authMode === "signup";
  root().innerHTML = `<div class="center"><div class="card narrow">
    <div class="brand">${face(currentTheme(), 80)}</div>
    <h1>Bear</h1>
    <p class="muted">A small private space for the two of you.</p>
    <form data-form="auth" autocomplete="on">
      ${up ? `<label>Your name<input id="aName" name="name" required maxlength="30" autocomplete="given-name"></label>` : ""}
      <label>Email<input id="aEmail" name="email" type="email" required autocomplete="email"></label>
      <label>Password<input id="aPass" name="pass" type="password" required minlength="6" autocomplete="${up ? "new-password" : "current-password"}"></label>
      <button class="btn primary" type="submit">${up ? "Create account" : "Sign in"}</button>
    </form>
    <button class="link" data-act="authMode">${up ? "I already have an account" : "New here? Create an account"}</button>
  </div></div>`;
}

function screenPair() {
  root().innerHTML = `<div class="center"><div class="stack narrow">
    <div class="card">
      <h2>Hi ${esc(S.name || "there")}</h2>
      <p class="muted">One of you starts the space, the other joins with a code.</p>
    </div>
    <div class="card">
      <h3>Start our space</h3>
      <p class="muted">You'll get an 8-letter code to send to your partner.</p>
      <button class="btn primary" data-act="createCouple">Create our space</button>
    </div>
    <div class="card">
      <h3>Join with a code</h3>
      <form data-form="join">
        <label>Code from your partner<input id="jCode" name="code" required maxlength="12" autocapitalize="characters" autocomplete="off"></label>
        <button class="btn" type="submit">Join</button>
      </form>
    </div>
    <button class="link" data-act="signout">Sign out</button>
  </div></div>`;
}

function themeSwitch() {
  const t = currentTheme();
  return `<div class="sw glass" role="group" aria-label="Look">
    <button data-act="setTheme" data-id="brown" aria-label="Brownie Bear look (dark)" aria-pressed="${t === "brown"}">${face("brown", 28)}</button>
    <button data-act="setTheme" data-id="panda" aria-label="Panda Bear look (light)" aria-pressed="${t === "panda"}">${face("panda", 28)}</button>
  </div>`;
}

function renderShell() {
  root().innerHTML = `
    <header class="top">
      <div class="brandline">${face(currentTheme(), 34)}<span class="name">Bear</span></div>
      <div class="toprow">${themeSwitch()}<button class="icon glass" data-act="settings" aria-label="Settings">${ICON.settings}</button></div>
    </header>
    <main id="view"></main>
    <nav class="tabs glass">${TABS.map(([k, ic, lb]) =>
      `<button data-act="tab" data-id="${k}" aria-label="${lb}" class="${S.tab === k ? "on" : ""}">${ic}</button>`).join("")}</nav>
    <div id="sheet"></div>`;
  renderView(true);
}

// ---------------------------------------------------------------- view rendering
function keepInputs(fn) {
  const view = $("#view");
  if (!view) return;
  const saved = [...view.querySelectorAll("input,textarea,select")]
    .filter((x) => x.id && x.type !== "file")
    .map((x) => ({ id: x.id, v: x.type === "checkbox" ? x.checked : x.value, f: document.activeElement === x, s: x.selectionStart }));
  const open = [...view.querySelectorAll("details[id]")].filter((d) => d.open).map((d) => d.id);
  const y = window.scrollY;
  fn();
  for (const s of saved) {
    const x = document.getElementById(s.id);
    if (!x) continue;
    if (x.type === "checkbox") x.checked = s.v;
    else x.value = s.v;
    if (s.f) {
      x.focus();
      try { x.setSelectionRange(s.s, s.s); } catch { /* not a text input */ }
    }
  }
  open.forEach((id) => { const d = document.getElementById(id); if (d) d.open = true; });
  window.scrollTo(0, y);
}

const VIEWS = () => ({ home: homeView, plan: planView, cycle: cycleView, photos: photosView, memories: memoriesView, notes: notesView });
function renderView(fresh = false) {
  const view = $("#view");
  if (!view) return;
  const draw = () => { view.innerHTML = (VIEWS()[S.tab] || homeView)(); };
  if (fresh) { draw(); window.scrollTo(0, 0); } else keepInputs(draw);
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.id === S.tab));
  renderSheet();
}

function avatarHtml(uid, big = false) {
  const p = S.people[uid] || {};
  const img = safeImg(p.photo);
  const inner = img ? `<img src="${img}" alt="">` : `<span>${esc((p.name || "?")[0].toUpperCase())}</span>`;
  return `<div class="avatar ${big ? "big" : ""}">${inner}</div>`;
}

function renderSheet() {
  const el = $("#sheet");
  if (!el) return;
  if (S.viewing) { el.innerHTML = photoViewer(); return; }
  if (!S.settings) { el.innerHTML = ""; return; }
  const code = S.couple?.code || "";
  const me = S.people[S.uid] || {};
  const t = currentTheme();
  const choice = (key, name, sub, prev) => `<button class="choice" data-act="setTheme" data-id="${key}" aria-pressed="${S.themePref !== "auto" && t === key}">
      <span class="sw-prev" style="background:${prev}">${face(key, 46)}</span>
      <span class="grow"><b class="serif" style="font-size:19px">${name}</b><br><span class="muted small">${sub}</span></span>
      <span class="tick">${S.themePref !== "auto" && t === key ? ICON.check : ""}</span></button>`;
  el.innerHTML = `<div class="overlay" data-act="closeSettings"><div class="sheet" role="dialog" aria-label="Settings">
    <div class="row between"><h2 style="margin:0">Settings</h2><button class="icon" data-act="closeSettings" aria-label="Close">${ICON.close}</button></div>
    <div class="row">
      ${avatarHtml(S.uid, true)}
      <div class="grow stack" style="gap:8px">
        <label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">${me.photo ? "Change my photo" : "Add my photo"}
          <input type="file" accept="image/*" data-change="avatarFile" hidden></label>
        ${me.photo ? `<button class="btn danger" data-act="removeAvatar">Remove photo</button>` : ""}
      </div>
    </div>
    <hr>
    <h3>Choose your bear</h3>
    ${choice("brown", "Brownie Bear", "Dark · warm brown and gold", "linear-gradient(160deg,#5A3A22,#1E120A)")}
    ${choice("panda", "Panda Bear", "Light · soft blush pink", "linear-gradient(160deg,#FCE8EE,#EBBDCC)")}
    <label class="switch"><input type="checkbox" data-change="themeAuto" ${S.themePref === "auto" ? "checked" : ""}><span>Match my phone<br><span class="muted small">Brownie at night, Panda by day</span></span></label>
    <hr>
    <p class="muted">Signed in as ${esc(S.email)}</p>
    ${code ? `<p>Our code: <b class="code">${esc(code)}</b></p>` : ""}
    <p class="muted small">Install on your phone: Android Chrome, menu, <i>Add to Home screen</i>. iPhone Safari, Share, <i>Add to Home Screen</i>.</p>
    <button class="btn" data-act="signout">Sign out</button>
  </div></div>`;
}

// ---- Home
function locBlock(uid, isMe) {
  const p = S.people[uid] || {};
  if (!p.sharing) return `<p class="muted small">${isMe ? "Location sharing is off" : "Location is not being shared"}</p>`;
  if (!p.location) return `<p class="muted small">Waiting for the first location…</p>`;
  const { lat, lng, at } = p.location;
  let extra = "", dist = "";
  if (!isMe) {
    const mine = S.people[S.uid]?.location;
    if (mine && S.people[S.uid]?.sharing) {
      dist = `<span class="pill glass">${L.fmtDistance(L.haversineKm(mine, p.location))} away from you</span>`;
    }
    const bbox = [lng - 0.008, lat - 0.005, lng + 0.008, lat + 0.005].join("%2C");
    extra += `<iframe class="map" loading="lazy" title="Map" src="https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}"></iframe>
      <a class="small" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${lat},${lng}">Open in Maps</a>`;
  }
  return `<div class="locline"><span>Last seen ${L.timeAgo(at)}</span>${dist}</div>${extra}`;
}

function personCard(uid, isMe) {
  const p = S.people[uid] || {};
  const st = p.status || {};
  const line = st.text || st.tag ? esc(st.text || st.tag) : "No status yet";
  return `<section class="card">
    <div class="row">${avatarHtml(uid)}
      <div class="grow"><div class="who">${isMe ? "You" : esc(p.name || "Partner")}${st.at ? ` · ${L.timeAgo(st.at)}` : ""}</div>
      <div class="status">${line}</div></div></div>
    ${locBlock(uid, isMe)}
  </section>`;
}

const pingSeenKey = () => `bear-ping-seen-${S.cid}`;
const unseenPings = () => {
  const seen = Number(store.get(pingSeenKey()) || 0);
  return S.pings.filter((p) => p.from !== S.uid && (p.at || 0) > seen);
};
const onThisDay = () => S.memories
  .map((m) => ({ m, years: L.yearsAgoToday(m.date) }))
  .filter((x) => x.years > 0)
  .sort((a, b) => a.years - b.years);

function homeView() {
  const me = S.people[S.uid] || {};
  const waiting = !S.partnerUid;
  const sel = S.pendingTag ?? me.status?.tag ?? "";
  const pings = unseenPings();
  const otd = onThisDay();
  const todays = S.schedule.filter((b) => L.occursOn(b, L.ymd(L.today()))).sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  return `
    ${waiting ? `<section class="card banner"><b>Waiting for your partner</b>
      <p>Send them this code. They sign up, choose <i>Join with a code</i> and enter it.</p>
      <div class="code big">${esc(S.couple?.code || "…")}</div>
      <div class="row gap"><button class="btn" data-act="shareCode">Share</button><button class="btn" data-act="copyCode">Copy</button></div></section>` : ""}
    ${pings.length ? `<section class="card pinged"><span class="heart acc-bg">${ICON.heart}</span>
      <div class="grow"><b>${esc(partnerName())} thought about you</b><div class="muted small">${pings.length > 1 ? `${pings.length} times · ` : ""}${L.timeAgo(pings[0].at)}</div></div>
      <button class="icon small" data-act="seenPing" aria-label="Dismiss">${ICON.close}</button></section>` : ""}
    ${S.partnerUid ? personCard(S.partnerUid, false) : ""}
    ${S.partnerUid ? `<button class="thought" data-act="sendPing"><span class="bub">${ICON.heart}</span>I thought about you</button>` : ""}
    ${otd.length ? `<button class="card row" data-act="tab" data-id="memories" style="text-align:left;color:inherit;font:inherit;cursor:pointer;width:100%">
      <span class="datetile"><b>${otd[0].years}</b>${otd[0].years === 1 ? "year" : "years"}</span>
      <span class="grow"><span class="muted small">On this day</span><br><b>${esc(otd[0].m.title)}</b></span></button>` : ""}
    ${personCard(S.uid, true)}
    <section class="card">
      <h3>Update my status</h3>
      <div class="tags">${TAGS.map((e) => `<button type="button" class="tag ${sel === e ? "on" : ""}" aria-pressed="${sel === e}" data-act="pickTag" data-id="${e}">${e}</button>`).join("")}</div>
      <form data-form="status" class="row gap">
        <input id="stText" name="text" class="grow" maxlength="80" placeholder="What's up? e.g. On my way home" value="${esc(me.status?.text || "")}">
        <button class="btn primary" type="submit">Save</button>
      </form>
    </section>
    ${todays.length ? `<section class="card"><div class="row between"><h3 style="margin:0">Today</h3><span class="muted small">${fmtDate(L.today())}</span></div>
      <ul class="list" style="margin-top:10px">${todays.map((b) => `<li class="row"><span class="time">${b.start ? esc(b.start) : "All day"}</span><span class="grow"><b>${esc(b.title)}</b><br><span class="muted small">${esc(nameOf(b.owner))}</span></span></li>`).join("")}</ul></section>` : ""}
    <section class="card">
      <label class="switch"><input type="checkbox" data-change="locShare" ${me.sharing ? "checked" : ""}><span>Share my location while the app is open</span></label>
      <p class="muted small">Updates whenever you open the app. Switch off any time to pause.</p>
      ${me.sharing ? `<button class="btn" data-act="updateLoc">Update now</button>` : ""}
    </section>`;
}

// ---- Plan (schedule)
function planView() {
  const base = L.addDays(L.today(), S.weekOff * 7);
  const days = Array.from({ length: 7 }, (_, i) => L.addDays(base, i));
  const strip = days.map((d) => {
    const key = L.ymd(d);
    const has = S.schedule.some((b) => L.occursOn(b, key));
    return `<button class="day ${key === S.schedDate ? "on" : ""}" data-act="pickDay" data-id="${key}">
      <small>${d.toLocaleDateString("en-IN", { weekday: "short" })}</small><b>${d.getDate()}</b><i class="${has ? "dot" : "nodot"}"></i></button>`;
  }).join("");
  const items = S.schedule
    .filter((b) => L.occursOn(b, S.schedDate))
    .sort((a, b) => (a.start || "").localeCompare(b.start || ""))
    .map((b) => `<li class="item ${b.owner === S.uid ? "mine" : "theirs"}">
      <div class="time">${b.start ? esc(b.start) + (b.end ? "–" + esc(b.end) : "") : "All day"}</div>
      <div class="grow"><b>${esc(b.title)}</b><div class="muted small">${esc(nameOf(b.owner))}${b.repeat === "weekly" ? " · every week" : ""}</div></div>
      ${b.owner === S.uid ? `<button class="icon small" data-act="delSched" data-id="${esc(b.id)}" aria-label="Delete">${ICON.trash}</button>` : ""}</li>`).join("");
  return `
    <h1 class="pad" style="margin:4px 0 0">Plan</h1>
    <section class="card">
      <div class="row"><button class="icon" data-act="weekPrev" aria-label="Earlier">${ICON.left}</button>
        <div class="grow center-t"><b>${fmtD(S.schedDate)}</b></div>
        <button class="icon" data-act="weekNext" aria-label="Later">${ICON.right}</button></div>
      <div class="strip">${strip}</div>
      <ul class="list">${items || `<li class="empty">Nothing planned for this day.</li>`}</ul>
    </section>
    <section class="card">
      <h3>Add to my schedule</h3>
      <form data-form="sched">
        <label>What<input id="sTitle" name="title" required maxlength="60" placeholder="e.g. Class, Gym, Free after 6"></label>
        <label>Date<input id="sDate" name="date" type="date" required value="${S.schedDate}"></label>
        <div class="row gap"><label class="grow">From<input id="sStart" name="start" type="time"></label>
          <label class="grow">To<input id="sEnd" name="end" type="time"></label></div>
        <label class="switch"><input id="sRep" name="repeat" type="checkbox"><span>Repeats every week</span></label>
        <button class="btn primary" type="submit">Add</button>
      </form>
    </section>`;
}

// ---- Cycle
function cycleCard(uid, isMe) {
  const c = S.cycle[uid];
  const who = isMe ? "My cycle" : `${esc(partnerName())}'s cycle`;
  if (!isMe && !c) {
    return `<section class="card"><h3>${who}</h3><p class="muted">Not shared yet. It will show up here once ${esc(partnerName())} adds it and chooses to share.</p></section>`;
  }
  const info = L.cycleInfo(c);
  let body = "";
  if (!info) body = `<p class="muted">No dates added yet.</p>`;
  else if (info.future) body = `<p class="muted">The last start date is in the future. Please check it.</p>`;
  else {
    body = `<div class="bigstat">${info.inPeriod
      ? `Period days<small>day ${info.dayOfCycle} of about ${info.periodLen}</small>`
      : `${info.daysToNext}<small>${info.daysToNext === 1 ? "day" : "days"} to next period · ${fmtDate(info.nextStart)}</small>`}</div>
      <p class="muted">Day ${info.dayOfCycle} of a ${info.cycleLen}-day cycle</p>
      <p class="small"><b>Next three:</b> ${info.upcoming.map(fmtDate).join(" · ")}</p>
      ${info.stale ? `<p class="muted small">The last logged start is a while ago. Log the latest one for better estimates.</p>` : ""}`;
  }
  const form = isMe ? `
    <hr>
    <form data-form="cycle">
      <label>First day of last period<input id="cStart" name="lastStart" type="date" required value="${esc(c?.lastStart || "")}"></label>
      <div class="row gap"><label class="grow">Cycle length (days)<input id="cLen" name="cycleLen" type="number" min="15" max="60" required value="${esc(c?.cycleLen || 28)}"></label>
        <label class="grow">Period length (days)<input id="pLen" name="periodLen" type="number" min="1" max="10" required value="${esc(c?.periodLen || 5)}"></label></div>
      <label class="switch"><input id="cShare" name="share" type="checkbox" ${c ? (c.share ? "checked" : "") : "checked"}><span>Show this to ${esc(partnerName())}</span></label>
      <button class="btn primary" type="submit">Save</button>
    </form>` : "";
  return `<section class="card"><h3>${who}</h3>${body}${form}</section>`;
}

function cycleView() {
  return `<h1 class="pad" style="margin:4px 0 0">Cycle</h1>${S.partnerUid ? cycleCard(S.partnerUid, false) : ""}${cycleCard(S.uid, true)}
    <p class="muted small pad">These are estimates based on past dates, not medical advice. Only the person who owns the data can edit it, and sharing can be switched off any time.</p>`;
}

// ---- Photos
function photosView() {
  const n = S.photos.length;
  const full = n >= PHOTO_LIMIT;
  const tiles = S.photos.map((p) => {
    const img = safeImg(p.img);
    return img ? `<button class="ph" data-act="viewPhoto" data-id="${esc(p.id)}" aria-label="Open photo${p.caption ? ": " + esc(p.caption) : ""}"><img src="${img}" alt="" loading="lazy">${p.caption ? `<span class="cap glass">${esc(p.caption)}</span>` : ""}</button>` : "";
  }).join("");
  return `
    <div class="row between pad" style="margin-top:4px"><div><h1 style="margin:0">Photos</h1><div class="muted small">${n} of ${PHOTO_LIMIT} spaces used</div></div></div>
    <div class="meter"><div style="width:${Math.min(100, Math.round((n / PHOTO_LIMIT) * 100))}%"></div></div>
    ${n ? `<div class="grid">${tiles}</div>` : `<p class="empty">No photos yet. Add your first one.</p>`}
    ${full ? `<p class="muted small center-t">The board is full. Remove one of your photos to add a new one.</p>`
      : `<label class="addph" aria-label="Add a photo"><span class="icon gold small">${ICON.plus}</span>${S.busy ? "Adding…" : "Add a photo"}
        <input type="file" accept="image/*" data-change="photoFile" hidden ${S.busy ? "disabled" : ""}></label>`}`;
}

function photoViewer() {
  const p = S.photos.find((x) => x.id === S.viewing);
  if (!p) { S.viewing = null; return ""; }
  return `<div class="overlay" data-act="closeViewer"><div class="sheet viewer" role="dialog" aria-label="Photo">
    <div class="row between"><div class="muted small">${esc(nameOf(p.by))} · ${L.timeAgo(p.createdAt)}</div><button class="icon" data-act="closeViewer" aria-label="Close">${ICON.close}</button></div>
    <img src="${safeImg(p.img)}" alt="${esc(p.caption || "Photo")}">
    ${p.by === S.uid ? `<form data-form="caption" class="row gap"><input id="pCap" name="caption" class="grow" maxlength="60" placeholder="Add a caption" value="${esc(p.caption || "")}"><button class="btn primary" type="submit">Save</button></form>
      <button class="btn danger" data-act="delPhoto" data-id="${esc(p.id)}">Remove photo</button>` : (p.caption ? `<p class="serif" style="font-size:20px">${esc(p.caption)}</p>` : "")}
  </div></div>`;
}

// ---- Memories + dates
const EVENT_TYPES = { anniversary: "Anniversary", birthday: "Birthday", date: "Date night", trip: "Trip", other: "Other" };

function memoCard(m, years = 0) {
  const img = safeImg(m.img);
  return `<section class="card memo">${img ? `<img src="${img}" alt="" loading="lazy">` : ""}
    <div class="body">
      ${years ? `<span class="ago acc-bg">${years === 1 ? "A year ago today" : `${years} years ago today`}</span>` : ""}
      <div class="serif" style="font-size:21px;line-height:1.25;padding-right:40px">${esc(m.title)}</div>
      <div class="muted small">${m.date ? fmtDY(m.date) : ""} · added by ${esc(nameOf(m.by))}</div>
      ${m.note ? `<p>${esc(m.note)}</p>` : ""}
      <button class="icon small" data-act="delMemory" data-id="${esc(m.id)}" aria-label="Delete memory">${ICON.trash}</button>
    </div></section>`;
}

function memoriesView() {
  const list = S.events.map((e) => ({ e, o: L.nextOccurrence(e.date, !!e.yearly) })).sort((a, b) => a.o.days - b.o.days);
  const up = list.filter((x) => x.o.days >= 0);
  const past = list.filter((x) => x.o.days < 0).reverse();
  const row = ({ e, o }) => `<li class="item">
    <div class="datetile ${o.days < 0 ? "ring" : ""}"><b>${o.date.getDate()}</b>${o.date.toLocaleDateString("en-IN", { month: "short" })}</div>
    <div class="grow"><b>${esc(e.title)}</b><div class="muted small">${esc(EVENT_TYPES[e.type] || EVENT_TYPES.other)} · ${fmtDate(o.date)}${e.yearly ? " · every year" : ""} · ${L.countdownText(o.days)}</div></div>
    <button class="icon small" data-act="delEvent" data-id="${esc(e.id)}" aria-label="Delete">${ICON.trash}</button></li>`;
  const otd = onThisDay();
  const otdIds = new Set(otd.map((x) => x.m.id));
  const rest = S.memories.filter((m) => !otdIds.has(m.id)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return `
    <h1 class="pad" style="margin:4px 0 0">Memories</h1>
    ${otd.map((x) => memoCard(x.m, x.years)).join("")}
    <section class="card"><h3>Coming up</h3><ul class="list">${up.map(row).join("") || `<li class="empty">No upcoming dates yet.</li>`}</ul></section>
    <details class="card" id="dAddMemory"><summary>Add a memory <span class="icon gold small">${ICON.plus}</span></summary>
      <form data-form="memory">
        <label>What happened<input id="mTitle" name="title" required maxlength="80" placeholder="e.g. Sunset at Varkala cliff"></label>
        <label>When<input id="mDate" name="date" type="date" required max="${L.ymd(L.today())}"></label>
        <label>A few words (optional)<textarea id="mNote" name="note" rows="2" maxlength="400"></textarea></label>
        <label>Photo (optional)<input name="photo" type="file" accept="image/*"></label>
        <p class="muted small" style="margin:0">On the same day next year, Bear will show it at the top.</p>
        <button class="btn primary" type="submit">Save memory</button>
      </form>
    </details>
    <details class="card" id="dAddDate"><summary>Add a date <span class="icon gold small">${ICON.plus}</span></summary>
      <form data-form="event">
        <label>Title<input id="eTitle" name="title" required maxlength="60" placeholder="e.g. Our anniversary"></label>
        <label>Date<input id="eDate" name="date" type="date" required></label>
        <label>Type<select id="eType" name="type">${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="switch"><input id="eYearly" name="yearly" type="checkbox"><span>Repeats every year</span></label>
        <button class="btn primary" type="submit">Add</button>
      </form>
    </details>
    ${rest.length ? `<h3 class="pad" style="margin:8px 0 0">All memories</h3>${rest.map((m) => memoCard(m)).join("")}` : (otd.length ? "" : `<p class="empty">No memories yet. Add the first one.</p>`)}
    ${past.length ? `<section class="card"><h3>Past dates</h3><ul class="list dim">${past.map(row).join("")}</ul></section>` : ""}`;
}
const datesView = memoriesView;

// ---- Notes
function notesView() {
  const items = S.thoughts.map((t) => `<li class="note card ${t.author === S.uid ? "mine" : ""}">
    <div class="muted small">${t.kind === "idea" ? "Idea" : "Thought"} · ${esc(nameOf(t.author))} · ${L.timeAgo(t.createdAt)}</div>
    <p>${esc(t.text)}</p>
    ${t.author === S.uid ? `<button class="icon small" data-act="delThought" data-id="${esc(t.id)}" aria-label="Delete">${ICON.trash}</button>` : ""}</li>`).join("");
  return `
    <h1 class="pad" style="margin:4px 0 0">Notes</h1>
    <section class="card">
      <form data-form="thought">
        <label>Share something<textarea id="tText" name="text" rows="3" required maxlength="600" placeholder="A thought, a plan, an idea…"></textarea></label>
        <div class="row gap"><select id="tKind" name="kind" class="grow"><option value="thought">Thought</option><option value="idea">Idea</option></select>
          <button class="btn primary" type="submit">Post</button></div>
      </form>
    </section>
    <ul class="notes">${items || `<li class="empty">No notes yet. Be the first.</li>`}</ul>`;
}

// ---------------------------------------------------------------- data (Firestore)
function sub(unsub) { S.unsubs.push(unsub); }
function stopSession() {
  S.unsubs.forEach((u) => { try { u(); } catch { /* ignore */ } });
  S.unsubs = [];
  if (S.pcUnsub) { S.pcUnsub(); S.pcUnsub = null; }
  Object.assign(S, { cid: null, couple: null, partnerUid: null, people: {}, schedule: [], events: [], thoughts: [], cycle: {}, pcErr: false, lastLoc: 0, photos: [], memories: [], pings: [], viewing: null });
}
const onErr = (err) => { console.error(err); toast(friendlyError(err)); };
// a collection that may be blocked by old rules: show a hint once instead of an error on every screen
const softErr = (what) => (err) => { console.warn(what, err); if (err?.code === "permission-denied") toast(`${what} need the new database rules. See the README.`); };

function subscribePartnerCycle() {
  if (S.pcUnsub) { S.pcUnsub(); S.pcUnsub = null; }
  S.pcErr = false;
  if (!S.partnerUid || !S.cid) return;
  S.pcUnsub = onSnapshot(
    doc(db, "couples", S.cid, "cycle", S.partnerUid),
    (snap) => { S.cycle[S.partnerUid] = snap.exists() ? snap.data() : null; renderView(); },
    () => { S.cycle[S.partnerUid] = null; S.pcErr = true; renderView(); } // not shared (or not created) yet
  );
}

function startSession(cid) {
  stopSession();
  S.cid = cid;
  S.sessionStart = Date.now();
  renderShell();
  const col = (n) => collection(db, "couples", cid, n);
  // make sure my own card exists with my name
  setDoc(doc(db, "couples", cid, "people", S.uid), { name: S.name, uid: S.uid }, { merge: true }).catch(onErr);

  sub(onSnapshot(doc(db, "couples", cid), (snap) => {
    if (!snap.exists()) return;
    S.couple = snap.data();
    const pu = (S.couple.members || []).find((u) => u !== S.uid) || null;
    if (pu !== S.partnerUid) { S.partnerUid = pu; subscribePartnerCycle(); }
    renderView();
  }, onErr));

  let firstPeople = true;
  sub(onSnapshot(col("people"), (s) => {
    S.people = {};
    s.forEach((d) => { S.people[d.id] = d.data(); });
    renderView();
    if (firstPeople) { firstPeople = false; maybeUpdateLocation(); }
  }, onErr));
  sub(onSnapshot(col("schedule"), (s) => { S.schedule = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderView(); }, onErr));
  sub(onSnapshot(col("events"), (s) => { S.events = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderView(); }, onErr));
  sub(onSnapshot(query(col("thoughts"), orderBy("createdAt", "desc"), limit(100)),
    (s) => { S.thoughts = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderView(); }, onErr));
  sub(onSnapshot(doc(db, "couples", cid, "cycle", S.uid), (snap) => { S.cycle[S.uid] = snap.exists() ? snap.data() : null; renderView(); }, onErr));
  sub(onSnapshot(query(col("photos"), orderBy("createdAt", "desc"), limit(PHOTO_LIMIT + 5)),
    (s) => { S.photos = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderView(); }, softErr("Photos")));
  sub(onSnapshot(col("memories"), (s) => { S.memories = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderView(); }, softErr("Memories")));
  sub(onSnapshot(query(col("pings"), orderBy("at", "desc"), limit(20)), (s) => {
    const before = new Set(S.pings.map((p) => p.id));
    S.pings = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    const fresh = S.pings.find((p) => !before.has(p.id) && p.from !== S.uid && (p.at || 0) > S.sessionStart);
    if (fresh) { toast(`${partnerName()} thought about you`); try { navigator.vibrate?.([60, 40, 60]); } catch { /* no vibration */ } }
    renderView();
  }, softErr("Thought-about-you taps")));
}

// ---------------------------------------------------------------- location
const getPos = () => new Promise((res, rej) =>
  navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }));

async function maybeUpdateLocation(manual = false) {
  const me = S.people[S.uid];
  if (!S.cid || !me?.sharing || !navigator.geolocation) return;
  if (!manual && Date.now() - S.lastLoc < 60000) return;
  S.lastLoc = Date.now();
  try {
    const p = await getPos();
    await setDoc(doc(db, "couples", S.cid, "people", S.uid), {
      location: { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy), at: Date.now() },
    }, { merge: true });
    if (manual) toast("Location updated");
  } catch (err) {
    if (manual) toast(err.code === 1 ? "Location permission is blocked in your browser settings." : "Couldn't get your location. Try again outside or near a window.");
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && S.cid) {
    maybeUpdateLocation();
    if (S.pcErr) subscribePartnerCycle();
    renderView(); // refresh "x min ago" and on-this-day after the phone was asleep
  }
});
setInterval(() => { if (document.visibilityState === "visible") maybeUpdateLocation(); }, 5 * 60 * 1000);

// ---------------------------------------------------------------- actions
const personDoc = () => doc(db, "couples", S.cid, "people", S.uid);

function setTheme(pref) {
  S.themePref = pref;
  store.set("bear-theme", pref);
  applyTheme();
  renderSheet();
}

const actions = {
  authMode() { S.authMode = S.authMode === "signin" ? "signup" : "signin"; screenAuth(); },
  tab(el, id) { S.tab = id; renderView(true); },
  settings() { S.settings = true; renderSheet(); },
  closeSettings() { S.settings = false; renderSheet(); },
  setTheme(el, id) { setTheme(id); },
  async signout() { S.settings = false; stopSession(); await signOut(auth); },
  pickTag(el, id) { S.pendingTag = S.pendingTag === id ? "" : id; renderView(); },
  async updateLoc() { await maybeUpdateLocation(true); },
  pickDay(el, id) { S.schedDate = id; renderView(true); },
  weekPrev() { S.weekOff -= 1; renderView(); },
  weekNext() { S.weekOff += 1; renderView(); },
  async delSched(el, id) { if (confirm("Delete this item?")) await deleteDoc(doc(db, "couples", S.cid, "schedule", id)); },
  async delEvent(el, id) { if (confirm("Delete this date?")) await deleteDoc(doc(db, "couples", S.cid, "events", id)); },
  async delThought(el, id) { if (confirm("Delete this note?")) await deleteDoc(doc(db, "couples", S.cid, "thoughts", id)); },
  async delMemory(el, id) { if (confirm("Delete this memory?")) await deleteDoc(doc(db, "couples", S.cid, "memories", id)); },
  viewPhoto(el, id) { S.viewing = id; renderSheet(); },
  closeViewer() { S.viewing = null; renderSheet(); },
  async delPhoto(el, id) {
    if (!confirm("Remove this photo from the board?")) return;
    await deleteDoc(doc(db, "couples", S.cid, "photos", id));
    S.viewing = null; renderSheet(); toast("Photo removed");
  },
  async removeAvatar() { await setDoc(personDoc(), { photo: deleteField() }, { merge: true }); toast("Photo removed"); },
  async sendPing() {
    if (Date.now() - S.lastPingSent < 10000) { toast("Sent! Give it a moment before the next one."); return; }
    S.lastPingSent = Date.now();
    await addDoc(collection(db, "couples", S.cid, "pings"), { from: S.uid, at: Date.now() });
    try { navigator.vibrate?.(40); } catch { /* no vibration */ }
    toast(`${partnerName()} will see that you thought about them`);
  },
  async seenPing() {
    const mine = unseenPings();
    store.set(pingSeenKey(), String(Math.max(...mine.map((p) => p.at || 0), Date.now())));
    renderView();
    // tidy up: taps that have been seen are no longer needed
    await Promise.all(mine.map((p) => deleteDoc(doc(db, "couples", S.cid, "pings", p.id)).catch(() => {})));
  },
  async copyCode() {
    try { await navigator.clipboard.writeText(S.couple?.code || ""); toast("Code copied"); } catch { toast("Couldn't copy. Please type it out."); }
  },
  async shareCode() {
    const code = S.couple?.code || "";
    const text = `Join me on Bear, our little app. Sign up, choose "Join with a code" and enter: ${code}\n${location.origin}${location.pathname}`;
    if (navigator.share) { try { await navigator.share({ text }); } catch { /* cancelled */ } }
    else { await navigator.clipboard.writeText(text).catch(() => {}); toast("Invite message copied"); }
  },
  async createCouple() {
    const uid = S.uid;
    const ref = doc(collection(db, "couples"));
    let code, tries = 0;
    do { code = L.makeCode(); tries++; } while ((await getDoc(doc(db, "invites", code))).exists() && tries < 5);
    await setDoc(ref, { members: [uid], code, createdAt: Date.now() });
    await setDoc(doc(db, "invites", code), { coupleId: ref.id, createdBy: uid });
    await setDoc(doc(db, "users", uid), { coupleId: ref.id, name: S.name });
    startSession(ref.id);
  },
};

const forms = {
  async auth(f, fd) {
    const email = fd.get("email").trim(), pass = fd.get("pass");
    if (S.authMode === "signup") {
      const name = fd.get("name").trim();
      S.name = name; // used right after sign-up completes
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, pass);
    }
  },
  async join(f, fd) {
    const code = fd.get("code").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const inv = await getDoc(doc(db, "invites", code));
    if (!inv.exists()) throw new Error("Code not found. Check the letters and try again.");
    const cid = inv.data().coupleId;
    try { await updateDoc(doc(db, "couples", cid), { members: arrayUnion(S.uid) }); }
    catch { throw new Error("That space is already full, or the code isn't valid."); }
    await setDoc(doc(db, "users", S.uid), { coupleId: cid, name: S.name });
    startSession(cid);
  },
  async status(f, fd) {
    const me = S.people[S.uid] || {};
    const tag = S.pendingTag ?? me.status?.tag ?? "";
    await setDoc(personDoc(), { status: { tag, text: fd.get("text").trim(), at: Date.now() } }, { merge: true });
    S.pendingTag = null;
    toast("Status updated");
  },
  async sched(f, fd) {
    await addDoc(collection(db, "couples", S.cid, "schedule"), {
      owner: S.uid, title: fd.get("title").trim(), date: fd.get("date"),
      start: fd.get("start") || "", end: fd.get("end") || "",
      repeat: fd.get("repeat") ? "weekly" : "", createdAt: Date.now(),
    });
    S.schedDate = fd.get("date");
    f.reset();
    renderView(true);
    toast("Added");
  },
  async cycle(f, fd) {
    await setDoc(doc(db, "couples", S.cid, "cycle", S.uid), {
      lastStart: fd.get("lastStart"), cycleLen: Number(fd.get("cycleLen")), periodLen: Number(fd.get("periodLen")),
      share: !!fd.get("share"), updatedAt: Date.now(),
    });
    toast("Saved");
  },
  async event(f, fd) {
    await addDoc(collection(db, "couples", S.cid, "events"), {
      title: fd.get("title").trim(), date: fd.get("date"), type: fd.get("type"),
      yearly: !!fd.get("yearly"), createdBy: S.uid, createdAt: Date.now(),
    });
    f.reset();
    toast("Added");
  },
  async memory(f, fd) {
    const file = fd.get("photo");
    let img = "";
    if (file && file.size) { toast("Shrinking the photo…"); img = await shrink(file, [[1024, 0.7, 700000], [800, 0.6, 700000]]); }
    await addDoc(collection(db, "couples", S.cid, "memories"), {
      title: fd.get("title").trim(), date: fd.get("date"), note: (fd.get("note") || "").trim(),
      img, by: S.uid, createdAt: Date.now(),
    });
    f.reset();
    const d = document.getElementById("dAddMemory");
    if (d) d.open = false;
    toast("Memory saved");
  },
  async caption(f, fd) {
    await updateDoc(doc(db, "couples", S.cid, "photos", S.viewing), { caption: fd.get("caption").trim() });
    toast("Caption saved");
  },
  async thought(f, fd) {
    await addDoc(collection(db, "couples", S.cid, "thoughts"), {
      text: fd.get("text").trim(), kind: fd.get("kind"), author: S.uid, createdAt: Date.now(),
    });
    f.reset();
  },
};

const changes = {
  async locShare(el) {
    if (el.checked) {
      if (!navigator.geolocation) { el.checked = false; throw new Error("This browser can't share location."); }
      await setDoc(personDoc(), { sharing: true }, { merge: true });
      S.lastLoc = 0;
      await maybeUpdateLocation(true);
      // if permission was refused, turn sharing back off
      if (!S.people[S.uid]?.location) {
        try { await getPos(); } catch { await setDoc(personDoc(), { sharing: false }, { merge: true }); }
      }
    } else {
      await setDoc(personDoc(), { sharing: false, location: deleteField() }, { merge: true });
      toast("Location sharing paused");
    }
  },
  themeAuto(el) { setTheme(el.checked ? "auto" : currentTheme()); },
  async avatarFile(el) {
    const file = el.files?.[0];
    if (!file) return;
    const photo = await shrinkAvatar(file);
    await setDoc(personDoc(), { photo }, { merge: true });
    toast("Profile photo updated");
  },
  async photoFile(el) {
    const file = el.files?.[0];
    if (!file) return;
    if (S.photos.length >= PHOTO_LIMIT) throw new Error("The board is full.");
    S.busy = true; renderView();
    try {
      const img = await shrinkPhoto(file);
      await addDoc(collection(db, "couples", S.cid, "photos"), { img, caption: "", by: S.uid, createdAt: Date.now() });
      toast(`Added · ${plural(PHOTO_LIMIT - S.photos.length - 1, "space")} left`);
    } finally { S.busy = false; renderView(); }
  },
};

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  // the dark backdrop closes a sheet only when the backdrop itself is tapped, not the sheet content
  if (el.classList.contains("overlay") && e.target !== el) return;
  try { await actions[el.dataset.act]?.(el, el.dataset.id); } catch (err) { onErr(err); }
});
document.addEventListener("submit", async (e) => {
  const f = e.target.closest("form[data-form]");
  if (!f) return;
  e.preventDefault();
  const btn = f.querySelector("button[type=submit]");
  if (btn) btn.disabled = true;
  try { await forms[f.dataset.form](f, new FormData(f)); } catch (err) { onErr(err); }
  if (btn) btn.disabled = false;
});
document.addEventListener("change", async (e) => {
  const el = e.target.closest("[data-change]");
  if (!el) return;
  try { await changes[el.dataset.change](el); } catch (err) { onErr(err); }
  if (el.type === "file") el.value = "";
});

// ---------------------------------------------------------------- boot
mountFaces();
if (!configured) {
  screenSetup();
} else {
  screenLoading();
  onAuthStateChanged(auth, async (user) => {
    if (!user) { stopSession(); S.uid = null; screenAuth(); return; }
    S.uid = user.uid;
    S.email = user.email || "";
    S.name = user.displayName || S.name || (user.email || "").split("@")[0];
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      const data = snap.exists() ? snap.data() : null;
      if (data?.name && !user.displayName) S.name = data.name;
      if (data?.coupleId) startSession(data.coupleId);
      else screenPair();
    } catch (err) {
      onErr(err);
      screenPair();
    }
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
