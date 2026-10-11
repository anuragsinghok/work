'use strict';

// ---------- Data ----------

const THEMES = [
  ['#7c5cff', '#ff5ca8'],
  ['#0f2027', '#2c5364'],
  ['#ff7e5f', '#feb47b'],
  ['#00b09b', '#96c93d'],
  ['#1e3c72', '#2a5298'],
  ['#232526', '#414345'],
  ['#ee0979', '#ff6a00'],
  ['#4568dc', '#b06ab3'],
  ['#11998e', '#38ef7d'],
  ['#141e30', '#243b55'],
  ['#c94b4b', '#4b134f'],
  ['#000000', '#1c1c1c'],
];

const UNITS = [
  ['weeks', 7 * 24 * 3600e3],
  ['days', 24 * 3600e3],
  ['hours', 3600e3],
  ['minutes', 60e3],
  ['seconds', 1e3],
];

const STORE_KEY = 'countdowns.v1';

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch {}
}

let items = load();
const byId = id => items.find(i => i.id === id);

// Splits a duration into weeks / days / hours / minutes / seconds.
function breakdown(ms) {
  let rest = Math.abs(ms);
  const out = {};
  for (const [name, size] of UNITS) {
    out[name] = Math.floor(rest / size);
    rest -= out[name] * size;
  }
  return out;
}

const fmtDate = ts => new Date(ts).toLocaleString(undefined, {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});
const num = n => n.toLocaleString();
const gradient = theme => `linear-gradient(150deg, ${THEMES[theme][0]}, ${THEMES[theme][1]})`;

function unitsHTML(ms) {
  const b = breakdown(ms);
  return UNITS.map(([name]) => `<div class="unit"><b>${String(b[name]).padStart(2, '0')}</b><span>${name}</span></div>`).join('');
}

function totalsText(ms) {
  const abs = Math.abs(ms);
  return `${num(Math.floor(abs / 864e5))} days · ${num(Math.floor(abs / 36e5))} hours · ${num(Math.floor(abs / 6e4))} minutes`;
}

const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Home list ----------

const $ = sel => document.querySelector(sel);
const list = $('#list');

function renderList() {
  const now = Date.now();
  $('#empty').hidden = items.length > 0;
  const sorted = [...items].sort((a, b) => {
    const pa = a.at < now, pb = b.at < now;
    return pa === pb ? (pa ? b.at - a.at : a.at - b.at) : pa - pb;
  });
  list.innerHTML = sorted.map(it => {
    const ms = it.at - now;
    const body = ms > 0
      ? `<div class="units">${unitsHTML(ms)}</div>`
      : `<div class="done">🎉 ${breakdown(ms).days + breakdown(ms).weeks * 7} days ago</div>`;
    return `<li class="card" data-id="${it.id}" style="background:${gradient(it.theme)}">
      <h3>${esc(it.title)}</h3><div class="when">${fmtDate(it.at)}</div>${body}</li>`;
  }).join('');
}

list.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openLive(card.dataset.id);
});

// ---------- Live / wallpaper mode ----------

const live = $('#live');
let liveId = null;
let wakeLock = null;
let chromeTimer = null;

function openLive(id) {
  liveId = id;
  if (location.hash !== '#view=' + id) history.pushState(null, '', '#view=' + id);
  renderLive();
  live.hidden = false;
  $('#home').hidden = true;
  showChrome();
  requestWakeLock();
}

function closeLive() {
  liveId = null;
  live.hidden = true;
  $('#home').hidden = false;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  wakeLock?.release().catch(() => {});
  wakeLock = null;
  if (location.hash) history.pushState(null, '', location.pathname + location.search);
  renderList();
}

function renderLive() {
  const it = byId(liveId);
  if (!it) return closeLive();
  const ms = it.at - Date.now();
  live.style.background = gradient(it.theme);
  $('#liveTitle').textContent = it.title;
  $('#liveDate').textContent = (ms < 0 ? 'Happened ' : '') + fmtDate(it.at);
  $('#liveUnits').innerHTML = unitsHTML(ms);
  $('#liveTotal').textContent = (ms < 0 ? 'ago: ' : 'or ') + totalsText(ms);
}

// Tapping the countdown hides the buttons so it looks like a clean wallpaper.
function showChrome() {
  live.classList.remove('chromeless');
  clearTimeout(chromeTimer);
  chromeTimer = setTimeout(() => live.classList.add('chromeless'), 4000);
}

live.addEventListener('click', e => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (!act) {
    if (live.classList.contains('chromeless')) showChrome();
    else live.classList.add('chromeless');
    document.documentElement.requestFullscreen?.().catch(() => {});
    return;
  }
  showChrome();
  const it = byId(liveId);
  if (act === 'close') closeLive();
  if (act === 'edit') openEditor(it);
  if (act === 'wallpaper') openWallpaper(it);
  if (act === 'calendar') downloadICS(it);
  if (act === 'share') shareLink(it);
});

async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && liveId) requestWakeLock();
});

// ---------- Editor ----------

const editor = $('#editor');
const form = $('#form');
let editingId = null;
let pickedTheme = 0;

$('#themes').innerHTML = THEMES.map((_, i) =>
  `<button type="button" class="swatch" role="radio" data-theme="${i}" style="background:${gradient(i)}" aria-label="Style ${i + 1}"></button>`).join('');
$('#themes').addEventListener('click', e => {
  const sw = e.target.closest('.swatch');
  if (sw) pickTheme(+sw.dataset.theme);
});
function pickTheme(i) {
  pickedTheme = i;
  document.querySelectorAll('.swatch').forEach(s => s.setAttribute('aria-checked', String(+s.dataset.theme === i)));
}

const pad = n => String(n).padStart(2, '0');

function openEditor(it) {
  editingId = it?.id || null;
  $('#formTitle').textContent = it ? 'Edit countdown' : 'New countdown';
  $('#deleteBtn').hidden = !it;
  const d = new Date(it ? it.at : Date.now() + 7 * 864e5);
  form.title.value = it?.title || '';
  form.date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  form.time.value = it ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '09:00';
  form.remind.value = String(it?.remind ?? 0);
  pickTheme(it?.theme ?? Math.floor(Math.random() * THEMES.length));
  editor.showModal();
}

$('#addBtn').addEventListener('click', () => openEditor(null));
$('#cancelBtn').addEventListener('click', () => editor.close());

$('#deleteBtn').addEventListener('click', () => {
  if (!confirm('Delete this countdown?')) return;
  items = items.filter(i => i.id !== editingId);
  save();
  editor.close();
  closeLive();
});

form.addEventListener('submit', e => {
  e.preventDefault();
  const at = new Date(`${form.date.value}T${form.time.value}`).getTime();
  if (Number.isNaN(at)) return;
  const data = { title: form.title.value.trim(), at, remind: +form.remind.value, theme: pickedTheme, notified: false };
  if (editingId) Object.assign(byId(editingId), data);
  else items.push({ id: Math.random().toString(36).slice(2, 10), ...data });
  save();
  editor.close();
  if (data.remind >= 0) enableNotifications();
  scheduleReminders();
  if (liveId) renderLive(); else renderList();
});

// ---------- Reminders ----------
// In-app notifications only fire while the app is open (browsers don't allow
// web pages to wake up on their own). For a real alarm that rings even when the
// app is closed, "Alarm (.ics)" adds the event to the phone's calendar.

const timers = [];

async function enableNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  try { await Notification.requestPermission(); } catch {}
}

async function notify(it) {
  const body = it.remind > 0 ? `${it.title} — ${fmtDate(it.at)}` : `${it.title} is now!`;
  toast('⏰ ' + body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) reg.showNotification('Countdown', { body, icon: 'icons/icon-192.png', tag: it.id });
    else new Notification('Countdown', { body });
  } catch {}
}

function scheduleReminders() {
  timers.splice(0).forEach(clearTimeout);
  const now = Date.now();
  for (const it of items) {
    if (it.remind < 0 || it.notified) continue;
    const fireAt = it.at - it.remind * 60e3;
    if (now > it.at + 3600e3) continue;
    const delay = Math.max(0, fireAt - now);
    if (delay > 2 ** 31 - 1) continue; // setTimeout limit (~24 days); rescheduled on next open
    timers.push(setTimeout(() => {
      it.notified = true;
      save();
      notify(it);
    }, delay));
  }
}

function downloadICS(it) {
  const stamp = ts => new Date(ts).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const alarm = it.remind >= 0
    ? `BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:${it.title}\r\nTRIGGER:-PT${it.remind}M\r\nEND:VALARM\r\n`
    : '';
  const ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Countdown//EN\r\nBEGIN:VEVENT\r\n' +
    `UID:${it.id}@countdown\r\nDTSTAMP:${stamp(Date.now())}\r\nDTSTART:${stamp(it.at)}\r\nDTEND:${stamp(it.at + 3600e3)}\r\n` +
    `SUMMARY:${it.title.replace(/[,;\\]/g, m => '\\' + m)}\r\n${alarm}END:VEVENT\r\nEND:VCALENDAR\r\n`;
  downloadBlob(new Blob([ics], { type: 'text/calendar' }), slug(it.title) + '.ics');
}

// ---------- Wallpaper image ----------

const SIZES = [
  ['This phone', Math.round(screen.width * devicePixelRatio), Math.round(screen.height * devicePixelRatio)],
  ['iPhone 15/16 Pro', 1179, 2556],
  ['iPhone Pro Max', 1290, 2796],
  ['iPhone SE', 750, 1334],
  ['Android (FHD+)', 1080, 2400],
  ['Android (QHD+)', 1440, 3200],
  ['Desktop 1080p', 1920, 1080],
  ['Desktop 4K', 3840, 2160],
];

const wallDialog = $('#wallDialog');
const canvas = $('#wallCanvas');
let wallItem = null;
$('#wallSize').innerHTML = SIZES.map(([n, w, h], i) => `<option value="${i}">${n} · ${w}×${h}</option>`).join('');

function openWallpaper(it) {
  wallItem = it;
  drawWallpaper();
  wallDialog.showModal();
}

function drawWallpaper() {
  const [, w, h] = SIZES[+$('#wallSize').value];
  const it = wallItem;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const [c1, c2] = THEMES[it.theme];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // Soft glow for depth.
  const glow = ctx.createRadialGradient(w * .8, h * .15, 0, w * .8, h * .15, Math.max(w, h) * .6);
  glow.addColorStop(0, 'rgba(255,255,255,.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  const s = Math.min(w, h) / 1000; // scale factor
  const cy = $('#wallLayout').value === 'lock' && h > w ? h * 0.6 : h * 0.5;
  const font = (weight, px) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = font(800, 76 * s);
  ctx.fillText(it.title, w / 2, cy - 230 * s, w * 0.9);
  ctx.globalAlpha = .8;
  ctx.font = font(500, 36 * s);
  ctx.fillText(fmtDate(it.at), w / 2, cy - 160 * s, w * 0.9);
  ctx.globalAlpha = 1;

  const ms = it.at - Date.now();
  const b = breakdown(ms);
  // A still image can't tick, so seconds are left off.
  const shown = UNITS.slice(0, 4).map(([n]) => n);
  const colW = Math.min(w * 0.9, 900 * s * (w > h ? 1.4 : 1)) / shown.length;
  const x0 = w / 2 - (colW * shown.length) / 2 + colW / 2;
  shown.forEach((name, i) => {
    const x = x0 + i * colW;
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    roundRect(ctx, x - colW * .44, cy - 80 * s, colW * .88, 210 * s, 32 * s);
    ctx.fillStyle = '#fff';
    ctx.font = font(800, 110 * s);
    ctx.fillText(String(b[name]).padStart(2, '0'), x, cy + 10 * s);
    ctx.globalAlpha = .75;
    ctx.font = font(600, 26 * s);
    ctx.fillText(name.toUpperCase(), x, cy + 90 * s);
    ctx.globalAlpha = 1;
  });

  ctx.globalAlpha = .75;
  ctx.font = font(500, 30 * s);
  ctx.fillText((ms < 0 ? 'ago · ' : '') + totalsText(ms), w / 2, cy + 200 * s, w * 0.9);
  ctx.globalAlpha = 1;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.fill();
}

$('#wallSize').addEventListener('change', drawWallpaper);
$('#wallLayout').addEventListener('change', drawWallpaper);
$('#wallClose').addEventListener('click', () => wallDialog.close());
$('#wallSave').addEventListener('click', () => {
  drawWallpaper(); // refresh numbers to "now"
  canvas.toBlob(async blob => {
    const name = slug(wallItem.title) + '-wallpaper.png';
    const file = new File([blob], name, { type: 'image/png' });
    // On phones the share sheet has "Save Image" / "Use as wallpaper".
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    downloadBlob(blob, name);
  }, 'image/png');
});

// ---------- Sharing ----------

function encodeShare(it) {
  const json = JSON.stringify({ t: it.title, a: it.at, r: it.remind, s: it.theme });
  return btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function shareLink(it) {
  const url = `${location.origin}${location.pathname}#share=${encodeShare(it)}`;
  if (navigator.share) {
    try { await navigator.share({ title: it.title, text: `Countdown to ${it.title}`, url }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); }
}

function importShare(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const d = JSON.parse(decodeURIComponent(escape(atob(b64))));
    const existing = items.find(i => i.title === d.t && i.at === d.a);
    if (existing) return existing.id;
    const it = { id: Math.random().toString(36).slice(2, 10), title: String(d.t).slice(0, 60), at: +d.a, remind: +d.r, theme: (+d.s || 0) % THEMES.length, notified: false };
    items.push(it);
    save();
    toast('Countdown added');
    return it.id;
  } catch { return null; }
}

// ---------- Helpers ----------

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'countdown'; }

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10e3);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

// ---------- Routing & start-up ----------

function route() {
  const share = location.hash.match(/^#share=(.+)$/);
  if (share) {
    const id = importShare(share[1]);
    history.replaceState(null, '', id ? '#view=' + id : location.pathname);
  }
  const view = location.hash.match(/^#view=(\w+)$/);
  if (view && byId(view[1])) openLive(view[1]);
  else if (liveId) closeLive();
}
window.addEventListener('popstate', route);

function installHint() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (standalone) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const hint = $('#installHint');
  hint.textContent = ios
    ? 'Tip: tap the Share button, then “Add to Home Screen” to install this as an app.'
    : 'Tip: use your browser menu → “Install app” / “Add to Home screen” to install this as an app.';
  hint.hidden = false;
}

// One clock for everything, aligned to the start of each second.
function tick() {
  if (liveId) renderLive(); else renderList();
  setTimeout(tick, 1000 - (Date.now() % 1000));
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

installHint();
route();
scheduleReminders();
tick();
