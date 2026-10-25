// Pure helper functions (no Firebase, no DOM) so they can be tested on their own.

export const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};
export const addDays = (d, n) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
};
// whole days from b to a (a - b), immune to daylight-saving shifts
export const diffDays = (a, b) =>
  Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000
  );

// ---- Cycle prediction -------------------------------------------------
// c = { lastStart: "YYYY-MM-DD", cycleLen, periodLen }
export function cycleInfo(c, now = today()) {
  if (!c || !c.lastStart) return null;
  const cycleLen = Math.max(15, Math.min(60, Number(c.cycleLen) || 28));
  const periodLen = Math.max(1, Math.min(10, Number(c.periodLen) || 5));
  const start = parseYmd(c.lastStart);
  const since = diffDays(now, start);
  if (since < 0) return { future: true, cycleLen, periodLen };
  const k = Math.floor(since / cycleLen);
  const currentStart = addDays(start, k * cycleLen);
  const dayOfCycle = since - k * cycleLen + 1;
  const nextStart = addDays(currentStart, cycleLen);
  const upcoming = [nextStart, addDays(nextStart, cycleLen), addDays(nextStart, cycleLen * 2)];
  return {
    cycleLen,
    periodLen,
    dayOfCycle,
    inPeriod: dayOfCycle <= periodLen,
    daysToNext: diffDays(nextStart, now),
    nextStart,
    upcoming,
    stale: k >= 2, // last logged start is 2+ cycles old
  };
}

// ---- Events -----------------------------------------------------------
// Returns { date: Date, days: number } where days<0 means in the past.
export function nextOccurrence(dateStr, yearly, now = today()) {
  const d = parseYmd(dateStr);
  if (!yearly) return { date: d, days: diffDays(d, now) };
  let cand = new Date(now.getFullYear(), d.getMonth(), d.getDate());
  if (diffDays(cand, now) < 0) cand = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate());
  return { date: cand, days: diffDays(cand, now) };
}

export function countdownText(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}

// ---- Schedule ---------------------------------------------------------
// block = { date: "YYYY-MM-DD", repeat: "weekly" | "" }
export function occursOn(block, dateStr) {
  if (block.repeat === "weekly") {
    const diff = diffDays(parseYmd(dateStr), parseYmd(block.date));
    return diff >= 0 && diff % 7 === 0;
  }
  return block.date === dateStr;
}

// ---- Location ---------------------------------------------------------
export function haversineKm(a, b) {
  const R = 6371;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDistance(km) {
  if (km < 1) return `${Math.max(10, Math.round(km * 100) * 10)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// ---- Misc -------------------------------------------------------------
export function timeAgo(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alike characters
export function makeCode(len = 8) {
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// ---- Memories ---------------------------------------------------------
// How many whole years ago this date was, if it falls on today's day and month (else 0).
// A 29 Feb memory shows on 28 Feb in non-leap years.
export function yearsAgoToday(dateStr, now = today()) {
  if (!dateStr) return 0;
  const d = parseYmd(dateStr);
  const years = now.getFullYear() - d.getFullYear();
  if (years < 1) return 0;
  const leap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  let m = d.getMonth(), day = d.getDate();
  if (m === 1 && day === 29 && !leap(now.getFullYear())) day = 28;
  return m === now.getMonth() && day === now.getDate() ? years : 0;
}

// ---- Images -----------------------------------------------------------
// Shrink (w,h) to fit inside a max x max box, keeping the shape. Never enlarges.
export function fitSize(w, h, max) {
  if (!w || !h) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

// ---- Theme ------------------------------------------------------------
// pref: "brown" | "panda" | "auto"; prefersDark: boolean from the phone setting
export const resolveTheme = (pref, prefersDark) =>
  pref === "brown" || pref === "panda" ? pref : prefersDark ? "brown" : "panda";
