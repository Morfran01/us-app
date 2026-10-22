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

const configured = firebaseConfig.apiKey && !String(firebaseConfig.apiKey).startsWith("PASTE");
let auth, db;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const TAGS = ["Free", "At work", "Driving", "Eating", "Resting", "Studying", "Out", "Busy"];
const svg = (d) => `<svg class="i" aria-hidden="true" viewBox="0 0 24 24">${d}</svg>`;
const ICON = {
  home: svg('<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>'),
  plan: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>'),
  cycle: svg('<path d="M12 3c3.5 4.2 6 7.2 6 10.5A6 6 0 0 1 6 13.5C6 10.2 8.5 7.2 12 3z"/>'),
  dates: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  notes: svg('<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H10l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>'),
  settings: svg('<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>'),
  trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5"/>'),
};
const TABS = [
  ["home", ICON.home, "Home"],
  ["plan", ICON.plan, "Plan"],
  ["cycle", ICON.cycle, "Cycle"],
  ["dates", ICON.dates, "Dates"],
  ["notes", ICON.notes, "Notes"],
];

const S = {
  uid: null, name: "", email: "", cid: null, couple: null, partnerUid: null,
  people: {}, schedule: [], events: [], thoughts: [], cycle: {}, pcErr: false,
  tab: "home", weekOff: 0, schedDate: L.ymd(L.today()), pendingTag: null,
  authMode: "signin", settings: false, lastLoc: 0, unsubs: [], pcUnsub: null,
};

// ---------------------------------------------------------------- small helpers
let toastTimer;
function toast(msg) {
  const t = $("#toast");
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
    "permission-denied": "Permission denied. Check that the Firestore rules were published.",
    unavailable: "Can't reach the server. Check your internet.",
  };
  return map[c] || err?.message || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------- screens
const root = () => $("#app");

function screenSetup() {
  root().innerHTML = `<div class="center"><div class="card narrow">
    <h1>Almost there</h1>
    <p>The app is online, but it isn't connected to your Firebase project yet.</p>
    <p class="muted">Open <b>firebase-config.js</b> on GitHub, paste your Firebase settings into it, and save. Then refresh this page.</p>
  </div></div>`;
}

function screenLoading() {
  root().innerHTML = `<div class="center"><div class="brand">${ICON.dates}</div></div>`;
}

function screenAuth() {
  const up = S.authMode === "signup";
  root().innerHTML = `<div class="center"><div class="card narrow">
    <div class="brand">${ICON.dates}</div>
    <h1>Us</h1>
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

function renderShell() {
  root().innerHTML = `
    <header class="top"><span>Us</span><button class="icon round" data-act="settings" aria-label="Settings">${ICON.settings}</button></header>
    <main id="view"></main>
    <nav class="tabs">${TABS.map(([k, ic, lb]) =>
      `<button data-act="tab" data-id="${k}" aria-label="${lb}" class="${S.tab === k ? "on" : ""}">${ic}<span class="lb">${lb}</span></button>`).join("")}</nav>
    <div id="sheet"></div>`;
  renderView(true);
}

// ---------------------------------------------------------------- view rendering
function keepInputs(fn) {
  const view = $("#view");
  if (!view) return;
  const saved = [...view.querySelectorAll("input,textarea,select")]
    .filter((x) => x.id)
    .map((x) => ({ id: x.id, v: x.type === "checkbox" ? x.checked : x.value, f: document.activeElement === x, s: x.selectionStart }));
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
  window.scrollTo(0, y);
}

function renderView(fresh = false) {
  const view = $("#view");
  if (!view) return;
  const draw = () => {
    view.innerHTML = { home: homeView, plan: planView, cycle: cycleView, dates: datesView, notes: notesView }[S.tab]();
  };
  if (fresh) { draw(); window.scrollTo(0, 0); } else keepInputs(draw);
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b.dataset.id === S.tab));
  renderSheet();
}

function renderSheet() {
  const el = $("#sheet");
  if (!el) return;
  if (!S.settings) { el.innerHTML = ""; return; }
  const code = S.couple?.code || "";
  el.innerHTML = `<div class="overlay" data-act="closeSettings"><div class="sheet">
    <h3>Settings</h3>
    <p class="muted">Signed in as ${esc(S.email)}</p>
    ${code ? `<p>Our code: <b class="code">${esc(code)}</b></p>` : ""}
    <p class="muted small">Install on your phone: Android Chrome, menu, <i>Add to Home screen</i>. iPhone Safari, Share, <i>Add to Home Screen</i>.</p>
    <button class="btn" data-act="signout">Sign out</button>
    <button class="link" data-act="closeSettings">Close</button>
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
      dist = `<span class="chip">${L.fmtDistance(L.haversineKm(mine, p.location))} away from you</span>`;
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
    <div class="row"><div class="avatar ${isMe ? "me" : ""}">${esc((p.name || "?")[0].toUpperCase())}</div>
      <div class="grow"><div class="who">${isMe ? "You" : esc(p.name || "Partner")}</div>
      <div class="status">${line}</div></div>
      ${st.at ? `<div class="muted small">${L.timeAgo(st.at)}</div>` : ""}</div>
    ${locBlock(uid, isMe)}
  </section>`;
}

function homeView() {
  const me = S.people[S.uid] || {};
  const waiting = !S.partnerUid;
  const sel = S.pendingTag ?? me.status?.tag ?? "";
  return `
    ${waiting ? `<section class="card banner"><b>Waiting for your partner</b>
      <p>Send them this code. They sign up, choose <i>Join with a code</i> and enter it.</p>
      <div class="code big">${esc(S.couple?.code || "…")}</div>
      <div class="row gap"><button class="btn" data-act="shareCode">Share</button><button class="btn" data-act="copyCode">Copy</button></div></section>` : ""}
    ${S.partnerUid ? personCard(S.partnerUid, false) : ""}
    ${personCard(S.uid, true)}
    <section class="card">
      <h3>Update my status</h3>
      <div class="tags">${TAGS.map((e) => `<button type="button" class="tag ${sel === e ? "on" : ""}" aria-pressed="${sel === e}" data-act="pickTag" data-id="${e}">${e}</button>`).join("")}</div>
      <form data-form="status" class="row gap">
        <input id="stText" name="text" class="grow" maxlength="80" placeholder="What's up? e.g. On my way home" value="${esc(me.status?.text || "")}">
        <button class="btn primary" type="submit">Save</button>
      </form>
    </section>
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
      ${b.owner === S.uid ? `<button class="icon" data-act="delSched" data-id="${esc(b.id)}" aria-label="Delete">${ICON.trash}</button>` : ""}</li>`).join("");
  return `
    <section class="card">
      <div class="row"><button class="icon" data-act="weekPrev" aria-label="Earlier">‹</button>
        <div class="grow center-t"><b>${fmtD(S.schedDate)}</b></div>
        <button class="icon" data-act="weekNext" aria-label="Later">›</button></div>
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
  return `${S.partnerUid ? cycleCard(S.partnerUid, false) : ""}${cycleCard(S.uid, true)}
    <p class="muted small pad">These are estimates based on past dates, not medical advice. Only the person who owns the data can edit it, and sharing can be switched off any time.</p>`;
}

// ---- Dates (events)
const EVENT_TYPES = { anniversary: "Anniversary", birthday: "Birthday", date: "Date night", trip: "Trip", other: "Other" };

function datesView() {
  const list = S.events.map((e) => ({ e, o: L.nextOccurrence(e.date, !!e.yearly) })).sort((a, b) => a.o.days - b.o.days);
  const up = list.filter((x) => x.o.days >= 0);
  const past = list.filter((x) => x.o.days < 0).reverse();
  const row = ({ e, o }) => `<li class="item">
    <div class="datetile"><b>${o.date.getDate()}</b>${o.date.toLocaleDateString("en-IN", { month: "short" })}</div>
    <div class="grow"><b>${esc(e.title)}</b><div class="muted small">${esc(EVENT_TYPES[e.type] || EVENT_TYPES.other)} · ${fmtDate(o.date)}${e.yearly ? " · every year" : ""} · ${L.countdownText(o.days)}</div></div>
    <button class="icon" data-act="delEvent" data-id="${esc(e.id)}" aria-label="Delete">${ICON.trash}</button></li>`;
  return `
    <section class="card"><h3>Coming up</h3><ul class="list">${up.map(row).join("") || `<li class="empty">No upcoming dates yet.</li>`}</ul></section>
    <section class="card">
      <h3>Add a date</h3>
      <form data-form="event">
        <label>Title<input id="eTitle" name="title" required maxlength="60" placeholder="e.g. Our anniversary"></label>
        <label>Date<input id="eDate" name="date" type="date" required></label>
        <label>Type<select id="eType" name="type">${Object.entries(EVENT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
        <label class="switch"><input id="eYearly" name="yearly" type="checkbox"><span>Repeats every year</span></label>
        <button class="btn primary" type="submit">Add</button>
      </form>
    </section>
    ${past.length ? `<section class="card"><h3>Past</h3><ul class="list dim">${past.map(row).join("")}</ul></section>` : ""}`;
}

// ---- Notes
function notesView() {
  const items = S.thoughts.map((t) => `<li class="note ${t.author === S.uid ? "mine" : ""}">
    <div class="muted small">${t.kind === "idea" ? "Idea" : "Thought"} · ${esc(nameOf(t.author))} · ${L.timeAgo(t.createdAt)}</div>
    <p>${esc(t.text)}</p>
    ${t.author === S.uid ? `<button class="icon small" data-act="delThought" data-id="${esc(t.id)}" aria-label="Delete">${ICON.trash}</button>` : ""}</li>`).join("");
  return `
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
  Object.assign(S, { cid: null, couple: null, partnerUid: null, people: {}, schedule: [], events: [], thoughts: [], cycle: {}, pcErr: false, lastLoc: 0 });
}
const onErr = (err) => { console.error(err); toast(friendlyError(err)); };

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
  }
});
setInterval(() => { if (document.visibilityState === "visible") maybeUpdateLocation(); }, 5 * 60 * 1000);

// ---------------------------------------------------------------- actions
const personDoc = () => doc(db, "couples", S.cid, "people", S.uid);

const actions = {
  authMode() { S.authMode = S.authMode === "signin" ? "signup" : "signin"; screenAuth(); },
  tab(el, id) { S.tab = id; renderView(true); },
  settings() { S.settings = true; renderSheet(); },
  closeSettings() { S.settings = false; renderSheet(); },
  async signout() { S.settings = false; stopSession(); await signOut(auth); },
  pickTag(el, id) { S.pendingTag = S.pendingTag === id ? "" : id; renderView(); },
  async updateLoc() { await maybeUpdateLocation(true); },
  pickDay(el, id) { S.schedDate = id; renderView(true); },
  weekPrev() { S.weekOff -= 1; renderView(); },
  weekNext() { S.weekOff += 1; renderView(); },
  async delSched(el, id) { if (confirm("Delete this item?")) await deleteDoc(doc(db, "couples", S.cid, "schedule", id)); },
  async delEvent(el, id) { if (confirm("Delete this date?")) await deleteDoc(doc(db, "couples", S.cid, "events", id)); },
  async delThought(el, id) { if (confirm("Delete this note?")) await deleteDoc(doc(db, "couples", S.cid, "thoughts", id)); },
  async copyCode() {
    try { await navigator.clipboard.writeText(S.couple?.code || ""); toast("Code copied"); } catch { toast("Couldn't copy. Please type it out."); }
  },
  async shareCode() {
    const code = S.couple?.code || "";
    const text = `Join me on our little app. Sign up, choose "Join with a code" and enter: ${code}\n${location.origin}${location.pathname}`;
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
};

document.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  // the dark backdrop closes the sheet only when the backdrop itself is tapped, not the sheet content
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
});

// ---------------------------------------------------------------- boot
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
