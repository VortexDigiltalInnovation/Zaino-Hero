'use strict';
/* Zaino Hero — checklist giornaliera dello zaino. Nessuna dipendenza esterna: funziona offline. */

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const SCHOOL_END_HOUR = 15; // dopo quest'ora si prepara lo zaino per il giorno di scuola successivo
const GLOBAL_KEYS = { mute: 'zaino_mute', catalog: 'zaino_prize_catalog_v1', kids: 'zaino_kids_v1', profile: 'zaino_profile' };
/* Dati di ogni figlio: il primo figlio (k1) mantiene le chiavi storiche, così i dati esistenti restano al loro posto. */
const KID_BASE = { schedule: 'zaino_schedule', subjects: 'zaino_subjects_multi', checks: 'zaino_checks_v2', rewards: 'zaino_rewards_v1', history: 'zaino_history_v1' };
const LEGACY_KID = 'k1';
const AVATARS = ['mantello', 'visore', 'orario', 'trofeo'];
const AVATAR_NAMES = { mantello: 'Eroe col mantello', visore: 'Eroe con visore', orario: 'Eroe dell\'orario', trofeo: 'Eroe del trofeo' };
const MAX_KIDS = 8;
const kidKey = (base, id) => (id === LEGACY_KID ? base : `${base}__${id}`);
let activeKidId = LEGACY_KID;
const KEYS = Object.assign({}, GLOBAL_KEYS);
Object.keys(KID_BASE).forEach((k) => Object.defineProperty(KEYS, k, { get: () => kidKey(KID_BASE[k], activeKidId), enumerable: true }));
const PALETTE = ['#2563eb', '#dc2626', '#eab308', '#ea580c', '#16a34a', '#854d0e', '#9333ea', '#db2777', '#0891b2', '#64748b'];
/* 10 spicchi equivalenti: 6 simbolici, 3 privilegi, 1 fisico (60/30/10). */
const WHEEL_PRIZES = [
  { id: 'badge-ready', type: 'symbolic', short: 'Badge', title: 'Badge digitale: Zaino pronto' },
  { id: 'badge-organized', type: 'symbolic', short: 'Trofeo', title: 'Trofeo digitale: Super organizzato' },
  { id: 'ticket-a', type: 'symbolic', short: 'Ticket', title: 'Ticket +1 punto per la ricompensa di fine mese', ticket: true },
  { id: 'badge-sprint', type: 'symbolic', short: 'Badge', title: 'Badge digitale: Partenza sprint' },
  { id: 'ticket-b', type: 'symbolic', short: 'Ticket', title: 'Ticket +1 punto per la ricompensa di fine mese', ticket: true },
  { id: 'badge-hero', type: 'symbolic', short: 'Medaglia', title: 'Medaglia digitale: Zaino Hero' },
  { id: 'extra-time', type: 'privilege', short: '+15 min', title: '+15 minuti di gioco o TV' },
  { id: 'choose-film', type: 'privilege', short: 'Film', title: 'Scegliere il film della serata' },
  { id: 'skip-chore', type: 'privilege', short: 'Salta', title: 'Salta una piccola faccenda di casa' },
  { id: 'snack', type: 'physical', short: 'Snack', title: 'Snack speciale o piccolo oggetto di cancelleria' }
];

const DEFAULT_SUBJECTS = {
  'Matematica': { color: '#2563eb', emoji: '➗', materials: ['Quaderno a quadretti 0.5cm', 'Libro Aritmetica e Logica'] },
  'Italiano': { color: '#dc2626', emoji: '📖', materials: ['Quaderno a righe 5ª', 'Libro di Lettura & Grammatica'] },
  'Inglese': { color: '#eab308', emoji: '🇬🇧', materials: ['Quaderno unico Inglese', "Student's Book & Workbook"] },
  'Storia': { color: '#ea580c', emoji: '🏛️', materials: ['Quaderno di Storia', 'Sussidiario di Storia'] },
  'Scienze': { color: '#16a34a', emoji: '🔬', materials: ['Quaderno di Scienze', 'Sussidiario di Scienze'] },
  'Geografia': { color: '#854d0e', emoji: '🌍', materials: ['Quaderno di Geografia', 'Atlante e Sussidiario'] },
  'Tecnologia': { color: '#475569', emoji: '💻', materials: ['Quaderno / Schede Tecnologia'] },
  'Arte e Immagine': { color: '#9333ea', emoji: '🎨', materials: ['Album da disegno F4', 'Valigetta Colori & Pennarelli'] },
  'Musica': { color: '#db2777', emoji: '🎵', materials: ['Quaderno pentagrammato', 'Flauto e Spartiti'] },
  'Ed. Fisica': { color: '#64748b', emoji: '⚽', materials: ['Sacca Ginnastica (Tuta & Scarpe)'] }
};
const GENERIC_SUBJECTS = Object.fromEntries(Object.entries(DEFAULT_SUBJECTS).map(([k, v]) =>
  [k, { color: v.color, emoji: v.emoji, materials: k === 'Italiano' ? ['Quaderno di Italiano'] : [v.materials[0]] }]));
const DEFAULT_SCHEDULE = {
  'Lunedì': ['Matematica', 'Matematica', 'Tecnologia', 'Italiano / Matematica', 'Italiano', 'Arte e Immagine'],
  'Martedì': ['Inglese', 'Inglese', 'Musica', 'Matematica', 'Storia', 'Storia'],
  'Mercoledì': ['Italiano', 'Italiano', 'Italiano', 'Matematica', 'Scienze', 'Scienze'],
  'Giovedì': ['Italiano', 'Italiano', 'Geografia', 'Geografia'],
  'Venerdì': ['Matematica', 'Matematica', 'Inglese', 'Ed. Fisica', 'Ed. Fisica']
};

/* ---------- utilità ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const uid = () => 'm' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const clone = (o) => JSON.parse(JSON.stringify(o));
const pad = (n) => String(n).padStart(2, '0');
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
  set(k, v, silent) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { if (!silent) toast('Memoria piena: non riesco a salvare. Prova a togliere qualche foto.'); return false; }
  }
};

const safeColor = (c, fb) => (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : fb);
const safePhoto = (p) => (typeof p === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]*$/.test(p) ? p : '');
function cleanMaterials(list, fallback) {
  const arr = Array.isArray(list) ? list : fallback;
  return arr.filter((m) => m != null).map((m) => (typeof m === 'string'
    ? { id: uid(), name: m.slice(0, 60), photo: '', barcode: '', cls: '' }
    : { id: typeof m.id === 'string' && /^[\w-]{1,24}$/.test(m.id) ? m.id : uid(), name: String(m.name || 'Libro').slice(0, 60), photo: safePhoto(m.photo), barcode: String(m.barcode || '').slice(0, 64), cls: /^[1-5]$/.test(String(m.cls)) ? String(m.cls) : '' }));
}
function cleanChecks(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  DAYS.forEach((day) => {
    const entry = raw[day];
    if (!entry || typeof entry !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '') || !entry.items || typeof entry.items !== 'object') return;
    const items = {};
    Object.entries(entry.items).forEach(([id, checked]) => {
      if (/^[\w-]{1,24}$/.test(id) && checked === true) items[id] = true;
    });
    out[day] = { date: entry.date, items };
  });
  return out;
}
function cleanCatalog(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = {};
  WHEEL_PRIZES.forEach((prize) => {
    const value = typeof source[prize.id] === 'string' ? source[prize.id].trim().slice(0, 80) : '';
    out[prize.id] = value || prize.title;
  });
  return out;
}
function cleanRewards(raw) {
  const draws = {};
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.draws && typeof raw.draws === 'object'
    ? raw.draws : {};
  Object.entries(source).slice(-1000).forEach(([date, entry]) => {
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
    const prize = WHEEL_PRIZES.find((item) => entry && item.id === entry.prizeId);
    if (!dateIsValid || !prize) return;
    const timestamp = typeof entry.awardedAt === 'string' && !Number.isNaN(Date.parse(entry.awardedAt))
      ? new Date(entry.awardedAt).toISOString() : `${date}T00:00:00.000Z`;
    const prizeTitle = typeof entry.prizeTitle === 'string' && entry.prizeTitle.trim()
      ? entry.prizeTitle.trim().slice(0, 80) : prize.title;
    draws[date] = { prizeId: prize.id, prizeTitle, awardedAt: timestamp };
  });
  const count = raw && Number.isSafeInteger(raw.tickets) ? Math.max(0, Math.min(1000000, raw.tickets)) : 0;
  return { draws, tickets: count };
}
function cleanHistory(raw) {
  const completed = {};
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) && raw.completed && typeof raw.completed === 'object'
    ? raw.completed : {};
  Object.entries(source).slice(-1000).forEach(([date, entry]) => {
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
    if (!dateIsValid || !entry || !DAYS.includes(entry.day)) return;
    const total = Number.isSafeInteger(entry.total) ? Math.max(0, Math.min(10000, entry.total)) : 0;
    const done = Number.isSafeInteger(entry.done) ? Math.max(0, Math.min(10000, entry.done)) : 0;
    if (!total || done < total) return;
    const completedAt = typeof entry.completedAt === 'string' && !Number.isNaN(Date.parse(entry.completedAt))
      ? new Date(entry.completedAt).toISOString() : `${date}T00:00:00.000Z`;
    completed[date] = { day: entry.day, completedAt, done, total };
  });
  return { completed };
}

/* ---------- figli ---------- */
function cleanKids(raw) {
  const list = [];
  (raw && Array.isArray(raw.list) ? raw.list : []).slice(0, MAX_KIDS).forEach((k) => {
    if (!k || typeof k.id !== 'string' || !/^[\w-]{1,16}$/.test(k.id) || list.some((x) => x.id === k.id)) return;
    list.push({
      id: k.id, name: String(k.name || '').trim().slice(0, 30) || 'Studente', cls: String(k.cls || '').trim().slice(0, 10) || '-',
      avatar: AVATARS.includes(k.avatar) ? k.avatar : AVATARS[list.length % AVATARS.length]
    });
  });
  if (!list.length) return null;
  return { list, active: list.some((x) => x.id === raw.active) ? raw.active : list[0].id };
}
function loadKids() {
  let k = cleanKids(store.get(GLOBAL_KEYS.kids, null));
  if (!k) {
    const old = store.get(GLOBAL_KEYS.profile, {}) || {};
    k = { list: [{ id: LEGACY_KID, name: String(old.name || 'Gabriele').slice(0, 30), cls: String(old.cls || '5ª A').slice(0, 10), avatar: 'mantello' }], active: LEGACY_KID };
    store.set(GLOBAL_KEYS.kids, k, true);
  }
  return k;
}
let kids = loadKids();
activeKidId = kids.active;
const activeKid = () => kids.list.find((k) => k.id === activeKidId) || kids.list[0];
const saveKids = () => store.set(GLOBAL_KEYS.kids, kids);
const isLegacyKid = () => activeKidId === LEGACY_KID;

/* ---------- stato ---------- */
let subjects = loadSubjects();
let schedule = loadSchedule();
let checks = cleanChecks(store.get(KEYS.checks, {}));
let rewards = cleanRewards(store.get(KEYS.rewards, {}));
let progressLog = cleanHistory(store.get(KEYS.history, {}));
let prizeCatalog = cleanCatalog(store.get(KEYS.catalog, {}));
let profile = activeKid();
let muted = store.get(KEYS.mute, false) === true;
let state = { day: defaultDay(), edit: false };
let draft = null;        // copia di lavoro nella finestra "materiali"
let draftKey = null;
function prizesForWheel() {
  return WHEEL_PRIZES.map((prize) => ({
    ...prize, title: prizeCatalog[prize.id] || prize.title,
    short: (prizeCatalog[prize.id] || prize.title).slice(0, 10)
  }));
}
function prizeFromDraw(draw) {
  const prize = draw && WHEEL_PRIZES.find((item) => item.id === draw.prizeId);
  return prize ? { ...prize, title: draw.prizeTitle || prizeCatalog[prize.id] || prize.title } : null;
}

function loadSubjects() {
  const raw = store.get(KEYS.subjects, null);
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  const out = {};
  const defs = isLegacyKid() ? DEFAULT_SUBJECTS : GENERIC_SUBJECTS;
  Object.keys(src || defs).forEach((name, i) => {
    const s = (src ? src[name] : defs[name]);
    const def = defs[name] || {};
    const o = s && typeof s === 'object' ? s : {};
    out[name] = {
      color: safeColor(o.color, safeColor(def.color, PALETTE[i % PALETTE.length])),
      emoji: typeof o.emoji === 'string' && o.emoji ? o.emoji.slice(0, 8) : (def.emoji || '📚'),
      materials: cleanMaterials(o.materials, def.materials || [])
    };
  });
  // Gli ID dei libri devono restare gli stessi tra un'apertura e l'altra, altrimenti le spunte si perdono.
  if (!src || JSON.stringify(out) !== JSON.stringify(src)) store.set(KEYS.subjects, out, true);
  return out;
}
function loadSchedule() {
  const raw = store.get(KEYS.schedule, null);
  const out = {};
  DAYS.forEach((d) => {
    const v = raw && Array.isArray(raw[d]) ? raw[d] : (isLegacyKid() ? DEFAULT_SCHEDULE[d] : []);
    out[d] = v.map((x) => String(x).slice(0, 60));
  });
  return out;
}
const saveSubjects = () => store.set(KEYS.subjects, subjects);
const saveSchedule = () => store.set(KEYS.schedule, schedule);
const saveChecks = () => store.set(KEYS.checks, checks);

/* ---------- giorni e date ---------- */
function defaultDay(now = new Date()) {
  const dow = now.getDay(); // 0 dom … 6 sab
  if (dow >= 1 && dow <= 5) {
    if (now.getHours() < SCHOOL_END_HOUR) return DAYS[dow - 1];
    return dow === 5 ? DAYS[0] : DAYS[dow];
  }
  return DAYS[0];
}
/* Data in cui quel giorno di scuola va "usato": le spunte valgono solo per quella data. */
function targetDate(day, now = new Date()) {
  const idx = DAYS.indexOf(day) + 1;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let diff = (idx - d.getDay() + 7) % 7;
  if (diff === 0 && now.getHours() >= SCHOOL_END_HOUR) diff = 7;
  d.setDate(d.getDate() + diff);
  return { iso: isoDate(d), diff };
}
function whenLabel(day) {
  const { diff } = targetDate(day);
  return diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : diff === 2 ? 'Dopodomani' : `tra ${diff} giorni`;
}

/* ---------- materie / lista zaino ---------- */
function findSubject(raw) {
  const n = norm(raw);
  if (!n) return null;
  const names = Object.keys(subjects);
  return names.find((k) => norm(k) === n) || names.find((k) => n.includes(norm(k))) || null;
}
function parseHour(raw) {
  return String(raw).split('/').map((s) => s.trim()).filter(Boolean)
    .map((part) => ({ raw: part, key: findSubject(part) }));
}
/* Ogni libro compare UNA volta, anche se la materia ha più ore. */
function packList(day) {
  const order = [];
  const map = new Map();
  (schedule[day] || []).forEach((hourRaw, h) => {
    parseHour(hourRaw).forEach(({ raw, key }) => {
      const id = key || 'unk:' + norm(raw);
      if (!map.has(id)) { map.set(id, { key, label: key || raw, hours: [], mats: key ? subjects[key].materials : [] }); order.push(id); }
      map.get(id).hours.push(h + 1);
    });
  });
  return order.map((id) => map.get(id));
}
function dayItems(day) { const ids = []; packList(day).forEach((g) => g.mats.forEach((m) => ids.push(m.id))); return ids; }
function dayChecks(day) {
  const t = targetDate(day).iso;
  if (!checks[day] || checks[day].date !== t) checks[day] = { date: t, items: {} };
  return checks[day].items;
}
function progress(day) {
  const ids = dayItems(day); const c = dayChecks(day);
  const done = ids.filter((id) => c[id]).length;
  return { total: ids.length, done, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
}
function missingNames(day) {
  const c = dayChecks(day); const out = [];
  packList(day).forEach((g) => g.mats.forEach((m) => { if (!c[m.id]) out.push(m.name); }));
  return out;
}
function findMaterial(id) {
  for (const k of Object.keys(subjects)) { const m = subjects[k].materials.find((x) => x.id === id); if (m) return { key: k, mat: m }; }
  return null;
}
function recordCompletion(day) {
  const p = progress(day);
  const date = targetDate(day).iso;
  if (!p.total || p.done !== p.total || progressLog.completed[date]) return;
  const next = {
    completed: Object.assign({}, progressLog.completed, {
      [date]: { day, completedAt: new Date().toISOString(), done: p.done, total: p.total }
    })
  };
  if (store.set(KEYS.history, next, true)) progressLog = next;
}
function previousSchoolDate(dateIso) {
  const date = new Date(`${dateIso}T12:00:00`);
  do { date.setDate(date.getDate() - 1); } while (date.getDay() === 0 || date.getDay() === 6);
  return isoDate(date);
}
function renderHistory() {
  const completed = progressLog.completed;
  const dates = Object.keys(completed).sort().reverse();
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = dates[dates.length - 1];
  while (cursor && dateSet.has(cursor)) {
    streak += 1;
    cursor = previousSchoolDate(cursor);
  }
  const prizeCount = Object.keys(rewards.draws).length;
  $('stats-summary').textContent = `${dates.length} giornate · serie ${streak} · ${prizeCount} premi · ${rewards.tickets} ticket`;
  $('history-list').innerHTML = dates.length ? dates.slice(0, 5).map((date) => {
    const entry = completed[date];
    const prizeDraw = rewards.draws[date];
    const prize = prizeDraw && prizeFromDraw(prizeDraw);
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
    return `<div class="history-row"><span><strong>${esc(entry.day)}</strong><span class="muted"> · ${esc(dateLabel)}</span></span>
      <span class="history-count">${entry.done}/${entry.total}</span><span class="history-prize">${prize ? `🎟️ ${esc(prize.title)}` : '✅ Completato'}</span></div>`;
  }).join('') : '<p class="muted small">Completa uno zaino per iniziare lo storico.</p>';
}

/* ---------- rendering ---------- */
function render() {
  recordCompletion(state.day);
  $('profile-line').textContent = `${profile.name} — Classe ${profile.cls}`;
  $('hero-eyebrow').textContent = `Carica dello zaino · ${profile.name}`;
  renderKids();
  $('day-label').textContent = state.day;
  $('day-when').textContent = whenLabel(state.day);
  $('btn-edit').textContent = state.edit ? '✅ Fatto' : '✏️ Modifica orario';

  const todayDow = new Date().getDay();
  $('days').innerHTML = DAYS.map((d, i) =>
    `<button class="day${todayDow === i + 1 ? ' today' : ''}" data-day="${d}" aria-pressed="${d === state.day}">${d}</button>`).join('');

  renderStrip();
  state.edit ? renderEdit() : renderList();
  renderProgress();
  renderHistory();
  renderSubjects();
  $('subject-list').innerHTML = Object.keys(subjects).map((k) => `<option value="${esc(k)}">`).join('');
}

function renderStrip() {
  const hours = schedule[state.day] || [];
  $('strip').innerHTML = hours.map((raw, i) => {
    const parts = parseHour(raw);
    const first = parts[0] && parts[0].key ? subjects[parts[0].key] : null;
    return `<span class="chip" style="--c:${first ? first.color : '#475569'}"><i>${i + 1}ª</i> ${esc(raw)}</span>`;
  }).join('') || '<span class="muted small">Nessuna ora: nessuna scuola?</span>';
}

function renderList() {
  const c = dayChecks(state.day);
  const groups = packList(state.day);
  if (!groups.length) { $('list').innerHTML = '<div class="card muted">Nessuna materia per questo giorno. Usa «Modifica orario» per aggiungerne.</div>'; return; }
  $('list').innerHTML = groups.map((g) => {
    const meta = g.key ? subjects[g.key] : null;
    const color = meta ? meta.color : '#f59e0b';
    const hoursTxt = g.hours.length === 1 ? `${g.hours[0]}ª ora` : `ore ${g.hours.join(', ')}`;
    const allDone = g.mats.length > 0 && g.mats.every((m) => c[m.id]);
    let body;
    if (!meta) {
      body = `<p class="warn-box">⚠️ «${esc(g.label)}» non è nella legenda materie. Aggiungila qui sotto in «Materie e foto dei libri» (＋ Nuova materia) oppure correggi l'orario.</p>`;
    } else if (!g.mats.length) {
      body = '<p class="muted small">Nessun libro registrato per questa materia: aggiungilo nella legenda qui sotto.</p>';
    } else {
      body = '<div class="mats">' + g.mats.map((m) => `
        <div class="mat${c[m.id] ? ' on' : ''}">
          <label><input type="checkbox" data-mid="${m.id}" ${c[m.id] ? 'checked' : ''}><span class="mname">${esc(m.name)}</span>${m.cls ? `<span class="mtag">${m.cls}ª</span>` : ''}</label>
          ${m.photo ? `<button class="thumb" data-zoom="${m.id}" aria-label="Ingrandisci foto di ${esc(m.name)}"><img src="${m.photo}" alt=""></button>` : ''}
        </div>`).join('') + '</div>';
    }
    return `<article class="subj${allDone ? ' done' : ''}" style="--c:${color}">
      <div class="subj-h"><h4>${meta ? esc(meta.emoji) : '❓'} ${esc(g.label)}${allDone ? ' ✓' : ''}</h4><span class="hours">${hoursTxt}</span></div>${body}</article>`;
  }).join('');
}

function renderEdit() {
  const hours = schedule[state.day] || [];
  $('list').innerHTML = hours.map((raw, i) => {
    const bad = parseHour(raw).some((p) => !p.key) || !String(raw).trim();
    return `<div class="edit-row${bad ? ' bad' : ''}">
      <span class="n">${i + 1}ª</span>
      <input type="text" list="subject-list" value="${esc(raw)}" data-hour="${i}" aria-label="Materia ${i + 1}ª ora" placeholder="Materia (più materie: A / B)">
      <button class="btn btn-icon" data-rmhour="${i}" aria-label="Elimina ${i + 1}ª ora">🗑</button>
    </div>${bad ? '<p class="warn-box small">⚠️ Materia non riconosciuta nella legenda: scegline una dall\'elenco.</p>' : ''}`;
  }).join('') + '<button class="add-hour" id="btn-add-hour" type="button">＋ Aggiungi ora</button>';
}

function renderProgress(celebrate) {
  const p = progress(state.day);
  const full = p.pct === 100 && p.total > 0;
  $('hero-pct').textContent = p.pct + '%'; $('hero-pct').classList.toggle('hidden', full); $('hero-trophy').classList.toggle('hidden', !full);
  $('bar-fill').style.width = p.pct + '%';
  $('bar').setAttribute('aria-valuenow', p.pct);
  $('hero-sub').textContent = p.total ? `${p.done} di ${p.total} cose nello zaino · ${state.day} (${whenLabel(state.day).toLowerCase()})` : 'Niente da preparare';
  $('hero-title').textContent = p.pct === 100 && p.total ? 'Zaino pronto al 100%! Super! 🎉' : p.pct > 50 ? 'Sei a buon punto! Continua così 💪' : 'Iniziamo a preparare! 🚀';
  const date = targetDate(state.day).iso;
  const draw = rewards.draws[date];
  const prize = draw && prizeFromDraw(draw);
  const rewardButton = $('btn-open-wheel');
  rewardButton.classList.toggle('hidden', !full && !draw);
  rewardButton.textContent = draw ? '🎟️ Rivedi il coupon' : '🎡 Gira la ruota';
  $('reward-status').textContent = prize
    ? `Premio già ottenuto per questa giornata: ${prize.title}. Coupon da mostrare a un adulto.`
    : full ? 'Zaino completo! Hai un giro disponibile per questa giornata.'
      : 'Completa lo zaino per sbloccare la ruota.';
  if (rewards.tickets) $('reward-status').textContent += ` Ticket accumulati: ${rewards.tickets}.`;
  return p;
}

function renderSubjects() {
  $('subjects').innerHTML = Object.keys(subjects).map((k) => {
    const s = subjects[k];
    return `<button class="s-card" data-subj="${esc(k)}"><span class="row gap"><span class="dot" style="background:${s.color}"></span>
      <span><h4>${esc(s.emoji)} ${esc(k)}</h4><span class="muted small">${s.materials.length} materiale/i</span></span></span><span aria-hidden="true">✏️</span></button>`;
  }).join('') + '<button class="s-card add" id="btn-new-subj" type="button">＋ Nuova materia</button>';
}

/* ---------- interazioni lista ---------- */
function toggleItem(id, value) {
  const before = progress(state.day).pct;
  const c = dayChecks(state.day);
  if (value) c[id] = true; else delete c[id];
  saveChecks();
  render();
  const again = document.querySelector(`#list input[data-mid="${id}"]`);
  if (again && document.activeElement !== again && (document.activeElement === document.body || !document.activeElement)) again.focus({ preventScroll: true });
  beep();
  const after = progress(state.day).pct;
  if (after === 100 && before < 100) { confetti(); speak('Zaino pronto! Bravo!'); }
}

/* ---------- ruota dei premi ---------- */
let activeWheelDate = null;
let wheelBusy = false;
const wheelDateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});
function renderWheelLabels() {
  $('wheel-labels').innerHTML = prizesForWheel().map((prize, i) =>
    `<span class="wheel-label" style="--angle:${i * 36}deg;--counter:${-i * 36}deg">${esc(prize.short)}</span>`).join('');
}
function showWheelCoupon(date, prize) {
  $('coupon-prize').textContent = prize.title;
  $('coupon-detail').textContent = prize.ticket
    ? `Ticket aggiunto. Saldo attuale: ${rewards.tickets}. Mostra il coupon a un adulto.`
    : 'Mostra il coupon a un adulto per confermare il premio.';
  $('coupon-date').textContent = `Giornata: ${wheelDateLabel(date)}`;
  $('reward-coupon').classList.remove('hidden');
  $('wheel-message').textContent = 'Il tuo premio è pronto!';
  $('btn-spin').classList.add('hidden');
  $('btn-close-wheel').classList.remove('hidden');
  $('ticket-count').textContent = `Ticket accumulati: ${rewards.tickets}.`;
}
function renderPrizeEditor() {
  const groups = [
    { type: 'symbolic', label: 'Premi simbolici · 6 settori · 60%' },
    { type: 'privilege', label: 'Privilegi · 3 settori · 30%' },
    { type: 'physical', label: 'Premio fisico · 1 settore · 10%' }
  ];
  $('prize-fields').innerHTML = groups.map((group) => {
    const fields = WHEEL_PRIZES.filter((prize) => prize.type === group.type).map((prize) =>
      `<label class="field"><span class="small muted">${esc(prize.short)}</span>
        <input type="text" data-prize-id="${esc(prize.id)}" maxlength="80" value="${esc(prizeCatalog[prize.id])}" autocomplete="off"></label>`
    ).join('');
    return `<fieldset class="prize-group"><legend>${esc(group.label)}</legend><div class="grid">${fields}</div></fieldset>`;
  }).join('');
}
$('btn-manage-prizes').onclick = () => {
  renderPrizeEditor();
  openDialog($('dlg-prizes'));
};
$('prize-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const next = {};
  let invalid = false;
  $('prize-fields').querySelectorAll('[data-prize-id]').forEach((input) => {
    const value = input.value.trim();
    if (!value) { invalid = true; input.focus(); }
    next[input.dataset.prizeId] = value.slice(0, 80);
  });
  if (invalid) { toast('Inserisci un nome per tutti i premi.'); return; }
  if (!store.set(KEYS.catalog, next)) return;
  prizeCatalog = cleanCatalog(next);
  renderWheelLabels(); render();
  $('dlg-prizes').close();
  toast('Catalogo premi salvato ✅');
});
$('btn-reset-prizes').onclick = () => {
  if (!confirm('Ripristinare i nomi iniziali dei premi? I coupon già vinti resteranno invariati.')) return;
  const defaults = cleanCatalog(null);
  if (!store.set(KEYS.catalog, defaults)) return;
  prizeCatalog = defaults;
  renderPrizeEditor(); renderWheelLabels(); render();
  toast('Premi iniziali ripristinati ✅');
};
function openWheel() {
  if (wheelBusy) return;
  const date = targetDate(state.day).iso;
  const draw = rewards.draws[date];
  const p = progress(state.day);
  if (!draw && (!p.total || p.pct !== 100)) return;
  activeWheelDate = date;
  const wheel = $('prize-wheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  $('reward-coupon').classList.add('hidden');
  $('btn-close-wheel').classList.add('hidden');
  $('ticket-count').textContent = `Ticket accumulati: ${rewards.tickets}.`;
  if (draw) {
    const prize = prizeFromDraw(draw);
    const index = WHEEL_PRIZES.findIndex((item) => item.id === draw.prizeId);
    if (prize) {
      wheel.style.transform = `rotate(${(360 - index * 36) % 360}deg)`;
      showWheelCoupon(date, prize);
    }
  } else {
    $('btn-spin').disabled = false;
    $('btn-spin').textContent = 'Fai girare la ruota';
    $('btn-spin').classList.remove('hidden');
    $('wheel-message').textContent = 'Un solo giro per questa giornata. Pronto?';
  }
  openDialog($('dlg-wheel'));
}
$('btn-open-wheel').onclick = openWheel;
$('btn-spin').onclick = () => {
  if (wheelBusy || !activeWheelDate) return;
  const date = activeWheelDate;
  const existing = rewards.draws[date];
  if (existing) {
    const prize = prizeFromDraw(existing);
    if (prize) showWheelCoupon(date, prize);
    return;
  }
  const p = progress(state.day);
  if (date !== targetDate(state.day).iso || !p.total || p.pct !== 100) {
    toast('Completa lo zaino del giorno per sbloccare la ruota.');
    return;
  }
  const index = Math.floor(Math.random() * WHEEL_PRIZES.length);
  const prize = prizesForWheel()[index];
  const next = {
    draws: Object.assign({}, rewards.draws, { [date]: { prizeId: prize.id, prizeTitle: prize.title, awardedAt: new Date().toISOString() } }),
    tickets: Math.min(1000000, rewards.tickets + (prize.ticket ? 1 : 0))
  };
  if (!store.set(KEYS.rewards, next)) return;
  rewards = next;
  wheelBusy = true;
  $('btn-spin').disabled = true;
  $('btn-spin').textContent = 'La ruota gira…';
  $('wheel-message').textContent = 'Vediamo cosa hai vinto…';
  const wheel = $('prize-wheel');
  const stopAt = 360 * 5 + ((360 - index * 36) % 360);
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  wheel.style.transition = '';
  wheel.style.transform = `rotate(${stopAt}deg)`;
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    wheelBusy = false;
    showWheelCoupon(date, prize);
    render();
    confetti();
    speak(`Hai vinto: ${prize.title}.`);
  }, reducedMotion ? 0 : 4300);
};
$('list').addEventListener('change', (e) => {
  if (e.target.dataset.mid) toggleItem(e.target.dataset.mid, e.target.checked);
  else if (e.target.dataset.hour !== undefined) {
    schedule[state.day][+e.target.dataset.hour] = e.target.value.trim();
    saveSchedule(); render();
  }
});
$('list').addEventListener('click', (e) => {
  const z = e.target.closest('[data-zoom]');
  if (z) { const f = findMaterial(z.dataset.zoom); if (f) openZoom(f.mat.photo, f.mat.name); return; }
  const rm = e.target.closest('[data-rmhour]');
  if (rm) { schedule[state.day].splice(+rm.dataset.rmhour, 1); saveSchedule(); render(); return; }
  if (e.target.closest('#btn-add-hour')) { schedule[state.day].push(''); saveSchedule(); render(); const ins = $('list').querySelectorAll('input[data-hour]'); ins[ins.length - 1]?.focus(); }
});
$('days').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]'); if (!b) return;
  state.day = b.dataset.day; render();
});
$('btn-edit').onclick = () => { state.edit = !state.edit; render(); };
$('btn-reset').onclick = () => {
  if (!confirm(`Azzerare le spunte di ${state.day}?`)) return;
  checks[state.day] = { date: targetDate(state.day).iso, items: {} }; saveChecks(); render();
};
$('btn-read').onclick = () => {
  const miss = missingNames(state.day);
  speak(miss.length ? `Per ${state.day} ti manca ancora: ${miss.join(', ')}.` : `Per ${state.day} lo zaino è pronto!`);
};
$('btn-share-missing').onclick = async () => {
  const miss = missingNames(state.day);
  const p = progress(state.day);
  const text = !p.total
    ? `Per ${state.day} non ci sono materiali configurati.`
    : miss.length
    ? `Per ${state.day} da mettere nello zaino:\n${miss.map((name) => `• ${name}`).join('\n')}`
    : `Per ${state.day} lo zaino è pronto! 🎒`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Lista dello zaino', text }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      toast('Lista copiata negli appunti ✅');
      return;
    }
  } catch (err) { /* prova il metodo compatibile più sotto */ }
  const area = document.createElement('textarea');
  area.value = text; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';
  document.body.appendChild(area); area.select();
  let copied = false;
  try { copied = document.execCommand('copy'); } catch (err) { /* copia non disponibile */ }
  area.remove();
  if (copied) toast('Lista copiata negli appunti ✅');
  else window.prompt('Copia la lista dello zaino:', text);
};

/* ---------- finestre (dialog) ---------- */
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
});
function openDialog(d) { if (!d.open) d.showModal(); }

function openZoom(src, cap) { $('zoom-img').src = src; $('zoom-img').alt = cap || ''; $('zoom-cap').textContent = cap || ''; openDialog($('dlg-zoom')); }

/* --- editor materiali (lavora su una copia: "✕" annulla davvero) --- */
$('subjects').addEventListener('click', (e) => {
  const b = e.target.closest('[data-subj]'); if (b) openMaterials(b.dataset.subj);
});
$('subjects').addEventListener('click', (e) => { if (e.target.closest('#btn-new-subj')) newSubject(); });
function newSubject() {
  const name = (prompt('Nome della nuova materia (es. Religione):') || '').trim().slice(0, 30);
  if (!name) return;
  if (Object.keys(subjects).some((k) => norm(k) === norm(name))) { toast('Esiste già una materia con questo nome.'); return; }
  subjects[name] = { color: PALETTE[Object.keys(subjects).length % PALETTE.length], emoji: '📚', materials: [{ id: uid(), name: 'Quaderno di ' + name, photo: '', barcode: '' }] };
  saveSubjects(); render(); openMaterials(name);
}
function openMaterials(key) {
  draftKey = key; draft = clone(subjects[key]);
  $('mat-title').textContent = `${draft.emoji} ${key}`;
  renderDraft(); openDialog($('dlg-mat'));
}
function renderDraft() {
  $('mat-list').innerHTML = draft.materials.map((m, i) => `
    <div class="mat-edit">
      <div class="row between"><strong class="small accent">Materiale ${i + 1}</strong><button class="btn btn-icon" data-del="${i}" aria-label="Elimina materiale ${i + 1}">🗑</button></div>
      <input type="text" value="${esc(m.name)}" data-name="${i}" aria-label="Nome materiale ${i + 1}" maxlength="60">
      <div class="row gap">
        <button class="btn btn-soft" data-photo="${i}" type="button">📷 ${m.photo ? 'Cambia foto' : 'Aggiungi foto'}</button>
        ${m.photo ? `<img src="${m.photo}" alt=""><button class="link" data-nophoto="${i}" type="button">Togli</button>` : '<span class="muted small">Nessuna foto</span>'}
      </div>
      ${m.barcode ? `<div class="row between"><span class="code">Codice collegato: ${esc(m.barcode)}</span><button class="link" data-nocode="${i}" type="button">Scollega</button></div>` : ''}
    </div>`).join('') || '<p class="muted small">Nessun materiale. Aggiungine uno.</p>';
}
$('mat-list').addEventListener('input', (e) => { if (e.target.dataset.name !== undefined) draft.materials[+e.target.dataset.name].name = e.target.value; });
$('mat-list').addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.dataset.del !== undefined) { draft.materials.splice(+t.dataset.del, 1); renderDraft(); }
  else if (t.dataset.nophoto !== undefined) { draft.materials[+t.dataset.nophoto].photo = ''; renderDraft(); }
  else if (t.dataset.nocode !== undefined) { draft.materials[+t.dataset.nocode].barcode = ''; renderDraft(); }
  else if (t.dataset.photo !== undefined) pickPhoto((url) => { draft.materials[+t.dataset.photo].photo = url; renderDraft(); });
});
$('btn-mat-add').onclick = () => { draft.materials.push({ id: uid(), name: 'Nuovo libro/quaderno', photo: '', barcode: '' }); renderDraft(); $('mat-list').lastElementChild?.scrollIntoView(); };
$('btn-mat-save').onclick = () => {
  draft.materials.forEach((m) => { m.name = m.name.trim() || 'Senza nome'; });
  subjects[draftKey] = draft;
  if (saveSubjects()) { $('dlg-mat').close(); render(); }
};
$('btn-subj-del').onclick = () => {
  const used = DAYS.some((d) => schedule[d].some((h) => parseHour(h).some((p) => p.key === draftKey)));
  if (!confirm(`Eliminare «${draftKey}» con i suoi libri?` + (used ? '\nÈ usata nell\'orario: resterà segnata come non riconosciuta.' : ''))) return;
  delete subjects[draftKey]; saveSubjects(); $('dlg-mat').close(); render();
};
function pickPhoto(cb) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => { const f = inp.files[0]; if (f) resizeImage(f, 480).then(cb).catch(() => toast('Non riesco a leggere questa foto.')); };
  inp.click();
}
function resizeImage(file, max, minSide = 0) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      if (Math.min(img.width, img.height) < minSide) { URL.revokeObjectURL(url); reject(new Error('small')); return; }
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
    img.src = url;
  });
}

/* ---------- ISBN ---------- */
const ean13Check = (d12) => { let t = 0; for (let i = 0; i < 12; i++) t += +d12[i] * (i % 2 ? 3 : 1); return String((10 - (t % 10)) % 10); };
/* Restituisce l'ISBN-13 (anche da un ISBN-10) se valido, altrimenti null. */
function normIsbn(raw) {
  const c = String(raw ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{13}$/.test(c)) return ean13Check(c.slice(0, 12)) === c[12] && /^97[89]/.test(c) ? c : null;
  if (/^\d{9}[\dX]$/.test(c)) {
    let t = 0; for (let i = 0; i < 10; i++) t += (10 - i) * (c[i] === 'X' ? 10 : +c[i]);
    if (t % 11 !== 0) return null;
    const b = '978' + c.slice(0, 9); return b + ean13Check(b);
  }
  return null;
}

/* ---------- lettore EAN-13 (per i browser senza BarcodeDetector, es. iPhone) ---------- */
const EAN = {
  L: ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'],
  G: ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'],
  R: ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'],
  P: ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']
};
const runsOf = (bits) => { const r = []; let n = 1; for (let i = 1; i < bits.length; i++) { if (bits[i] === bits[i - 1]) n++; else { r.push(n); n = 1; } } r.push(n); return r; };
const EAN_RUNS = { L: EAN.L.map(runsOf), G: EAN.G.map(runsOf), R: EAN.R.map(runsOf) };
function matchDigit(runs, sets) {
  const sum = runs[0] + runs[1] + runs[2] + runs[3]; if (!sum) return null;
  let best = null;
  for (const set of sets) EAN_RUNS[set].forEach((ref, d) => {
    let err = 0; for (let k = 0; k < 4; k++) err += Math.abs(runs[k] * 7 / sum - ref[k]);
    if (!best || err < best.err) best = { err, d, set };
  });
  return best && best.err < 1.1 ? best : null;
}
function decodeRuns(runs, i) { // runs[i] = prima barra della guardia iniziale
  const seg = runs.slice(i, i + 59); if (seg.length < 59) return null;
  const u = seg.reduce((a, b) => a + b, 0) / 95;
  for (const k of [0, 1, 2, 27, 28, 29, 30, 31, 56, 57, 58]) if (Math.abs(seg[k] - u) > u * 0.75) return null;
  const left = [], right = []; let par = '';
  for (let g = 0; g < 6; g++) { const m = matchDigit(seg.slice(3 + g * 4, 7 + g * 4), ['L', 'G']); if (!m) return null; left.push(m.d); par += m.set; }
  for (let g = 0; g < 6; g++) { const m = matchDigit(seg.slice(32 + g * 4, 36 + g * 4), ['R']); if (!m) return null; right.push(m.d); }
  const first = EAN.P.indexOf(par); if (first < 0) return null;
  const code = String(first) + left.join('') + right.join('');
  return ean13Check(code.slice(0, 12)) === code[12] ? code : null;
}
function decodeRow(lum) {
  const n = lum.length; const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(n * 0.05)], hi = sorted[Math.floor(n * 0.95)];
  if (hi - lo < 40) return null;
  const th = (lo + hi) / 2;
  const runs = []; let cur = lum[0] < th, len = 0, startDark = cur;
  for (let x = 0; x < n; x++) { const d = lum[x] < th; if (d === cur) len++; else { runs.push(len); cur = d; len = 1; } }
  runs.push(len);
  for (let i = startDark ? 0 : 1; i + 59 <= runs.length; i += 2) { const c = decodeRuns(runs, i); if (c) return c; }
  return null;
}
/* Prova molte righe dell'immagine, dritte e capovolte. */
function decodeEan13(canvas) {
  const w = canvas.width, h = canvas.height, ctx = canvas.getContext('2d', { willReadFrequently: true });
  const rows = 48;
  for (let r = 0; r < rows; r++) {
    // parte dal centro e si allarga, così il codice inquadrato al centro viene trovato prima
    const off = Math.ceil(r / 2) * (r % 2 ? 1 : -1);
    const y = Math.round(h / 2 + off * (h / (rows + 2)));
    if (y < 0 || y >= h) continue;
    const px = ctx.getImageData(0, y, w, 1).data, lum = new Float32Array(w);
    for (let x = 0; x < w; x++) lum[x] = px[x * 4] * 0.299 + px[x * 4 + 1] * 0.587 + px[x * 4 + 2] * 0.114;
    // leggero smussamento contro il rumore
    const sm = new Float32Array(w); for (let x = 0; x < w; x++) sm[x] = (lum[Math.max(0, x - 1)] + lum[x] * 2 + lum[Math.min(w - 1, x + 1)]) / 4;
    const c = decodeRow(sm) || decodeRow(sm.slice().reverse());
    if (c) return c;
  }
  return null;
}
const scanCanvas = document.createElement('canvas');
function frameToCanvas(src, sw, sh, maxSide = 1280, fresh = false) {
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const cv = fresh ? document.createElement('canvas') : scanCanvas;
  cv.width = Math.max(1, Math.round(sw * s)); cv.height = Math.max(1, Math.round(sh * s));
  cv.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, cv.width, cv.height);
  return cv;
}
const loadedScripts = {};
function loadScript(src) {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.async = true;
      s.onload = () => res();
      s.onerror = () => { delete loadedScripts[src]; rej(new Error('script')); };
      document.head.appendChild(s);
    });
  }
  return loadedScripts[src];
}
/* Lettore ZXing (WebAssembly, ospitato nella cartella vendor/): funziona su tutti i browser, anche offline. */
let zxPromise = null;
function loadZX() {
  if (!zxPromise) {
    zxPromise = loadScript('./vendor/zxing/zxing-reader.iife.js').then(() => {
      const base = new URL('./vendor/zxing/', location.href).href;
      window.ZXingWASM.setZXingModuleOverrides({ locateFile: (p, prefix) => (/\.wasm$/.test(p) ? base + p : prefix + p) });
      return window.ZXingWASM;
    }).catch((e) => { zxPromise = null; throw e; });
  }
  return zxPromise;
}
async function zxRead(cv) {
  const Z = await loadZX();
  const img = cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height);
  const res = await Z.readBarcodes(img, {
    formats: ['EAN-13', 'EAN-8', 'UPC-A'], tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 1
  });
  const hit = res.find((r) => r.text && r.isValid !== false);
  return hit ? hit.text : null;
}
/* Legge un codice da un video o da un'immagine: BarcodeDetector (se c'è), poi ZXing, poi il lettore interno. */
async function readCode(src, sw, sh, maxSide) {
  const det = getDetector();
  if (det) { try { const r = await det.detect(src); if (r.length) return r[0].rawValue; } catch (e) { /* prosegue */ } }
  const cv = frameToCanvas(src, sw, sh, maxSide || 1280);
  try { const c = await zxRead(cv); if (c) return c; } catch (e) { console.warn('ZXing:', e); }
  return decodeEan13(cv);
}

/* ---------- ricerca libro su Internet (Google Libri, poi Open Library) ---------- */
async function fetchJson(url) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('http'); return await r.json(); } finally { clearTimeout(t); }
}
async function fetchCover(url) {
  if (!url) return '';
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url.replace(/^http:/, 'https:'), { signal: ctl.signal }); clearTimeout(t);
    if (!r.ok) return '';
    const b = await r.blob(); if (!/^image\//.test(b.type)) return '';
    return await resizeImage(b, 480, 40);
  } catch (e) { return ''; }
}
async function lookupIsbn(isbn) {
  let found = null;
  try {
    const d = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`);
    const v = d.items && d.items[0] && d.items[0].volumeInfo;
    if (v && v.title) found = { title: v.title + (v.subtitle ? ': ' + v.subtitle : ''), authors: (v.authors || []).join(', '), hint: (v.categories || []).join(' ') + ' ' + (v.title || ''), coverUrl: v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail) || '' };
  } catch (e) { /* prova la fonte successiva */ }
  if (!found) {
    try {
      const d = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const v = d['ISBN:' + isbn];
      if (v && v.title) found = { title: v.title + (v.subtitle ? ': ' + v.subtitle : ''), authors: (v.authors || []).map((a) => a.name).join(', '), hint: (v.subjects || []).map((x) => x.name).join(' ') + ' ' + v.title, coverUrl: v.cover && (v.cover.medium || v.cover.large) || '' };
    } catch (e) { /* nessuna fonte raggiungibile */ }
  }
  if (!found) return null;
  found.cover = await fetchCover(found.coverUrl) || await fetchCover(`https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`);
  return found;
}
/* ---------- materia e classe dal testo ---------- */
const SUBJECT_HINTS = [
  [/matemat|aritmet|geometri|numer[io]\b|problem[ai]\b|calcol|operazion|frazion|logica/, 'Matematica'],
  [/ital[iy]ano|grammatic|lettur|antologi|raccont|scrittur|ortograf|linguagg|favol|poesi/, 'Italiano'],
  [/english|inglese|workbook|student'?s|grammar|oxford|cambridge|macmillan|black cat|pearson english/, 'Inglese'],
  [/stori[ac]|antichit|medioev|civilt|romani|egizi|preistoria/, 'Storia'],
  [/geograf|paesagg|atlante|territori/, 'Geografia'],
  [/scienz|natura\b|ambient|corpo umano|biolog|esperiment/, 'Scienze'],
  [/tecnolog|informatic|coding|computer|digital/, 'Tecnologia'],
  [/\barte\b|immagin|disegn|pittur|artistic/, 'Arte e Immagine'],
  [/music|flauto|canto\b|pentagramm/, 'Musica'],
  [/ed\.? ?fisica|educazione fisica|motori|sport|ginnastic/, 'Ed. Fisica'],
  [/religion|cattolic|bibbia|vangel/, 'Religione']
];
function resolveSubject(name) {
  const n = norm(name);
  const keys = Object.keys(subjects);
  return keys.find((k) => norm(k) === n) || keys.find((k) => norm(k).includes(n) || n.includes(norm(k))) || null;
}
function guessSubject(text) {
  const n = norm(text);
  for (const [re, name] of SUBJECT_HINTS) { const k = resolveSubject(name); if (k && re.test(n)) return k; }
  return Object.keys(subjects).find((k) => n.includes(norm(k))) || null;
}
/* Sceglie la materia con più indizi: le parole del titolo pesano il triplo. */
function detectSubject(titleText, allText) {
  const nt = norm(titleText), na = norm(allText);
  let best = null, bestScore = 0;
  const count = (re, text) => (text.match(new RegExp(re.source, 'g')) || []).length;
  SUBJECT_HINTS.forEach(([re, name]) => {
    const k = resolveSubject(name); if (!k) return;
    const score = count(re, nt) * 3 + count(re, na);
    if (score > bestScore) { bestScore = score; best = k; }
  });
  Object.keys(subjects).forEach((k) => {
    const nk = norm(k); if (nk.length < 4) return;
    const score = (nt.includes(nk) ? 4 : 0) + (na.includes(nk) ? 2 : 0);
    if (score > bestScore) { bestScore = score; best = k; }
  });
  return best;
}
const ORD_CLS = { prima: 1, primo: 1, seconda: 2, secondo: 2, terza: 3, terzo: 3, quarta: 4, quarto: 4, quinta: 5, quinto: 5 };
const toCls = (v) => ORD_CLS[v] || (/^[1-5]$/.test(v) ? +v : 0) || null;
function detectClass(textRaw) {
  const t = norm(String(textRaw).replace(/[°º^ª]/g, ' '));
  const ord = '(prim[ao]|second[ao]|terz[ao]|quart[ao]|quint[ao]|[1-5])';
  let m;
  if ((m = t.match(new RegExp('\\bclass[ei]\\s*' + ord + '\\b')))) return toCls(m[1]);
  if ((m = t.match(new RegExp('\\b' + ord + '\\s*a?\\s*(?:class[ei]|elementare|primaria)\\b')))) return toCls(m[1]);
  if ((m = t.match(/\b(?:volume|vol|per la|per il|anno)\s*([1-5])\b/))) return +m[1];
  return null;
}
function detectYear(textRaw) {
  const max = new Date().getFullYear() + 1;
  const years = (String(textRaw).match(/\b20[0-3]\d\b/g) || []).map(Number).filter((y) => y <= max);
  return years.length ? Math.max(...years) : null;
}

/* ---------- lettura del testo di una copertina ---------- */
const PUBLISHERS = /\b(giunti|mondadori|pearson|de agostini|deagostini|dea scuola|raffaello|zanichelli|fabbri|lisciani|mursia|capitello|la spiga|loescher|oxford|cambridge|macmillan|black cat|cideb|hoepli|lattes|principato|elmedi|erickson|helbling|hachette|editrice|edizioni|editore|tredieci|il castoro|la scuola)\b/;
const META_LINE = /^(per la|per le|per il|classe|classi|volume|vol\b|ed\b|edizione|isbn|www|http|copia|prezzo|\d+$)|\bisbn\b|www\.|\.it\b|\.com\b|scuola primaria|per la scuola|scuola elementare|nuova edizione|con (cd|dvd|contenuti)|libro di testo/;
const SMALL_WORDS = new Set(['di', 'e', 'la', 'il', 'lo', 'le', 'dei', 'delle', 'del', 'della', 'a', 'in', 'per', 'con', 'da', 'al', 'ai', 'alle', 'un', 'una', 'i', 'gli']);
function tidyTitle(str) {
  let t = String(str).replace(/[|_~=<>{}[\]\\^*#@]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[-–—.,:;\s]+|[-–—.,:;\s]+$/g, '');
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    t = t.toLowerCase().split(' ').map((w, i) => (i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
  }
  return t.slice(0, 60);
}
/* Raggruppa le parole in righe, sceglie come titolo le righe con le lettere più grandi
   e ricava classe ed edizione. Funzione pura: prende le parole di Tesseract (testo + riquadro + affidabilità). */
function parseCover(words) {
  const ws = [];
  (words || []).forEach((w) => {
    const t = String(w.text || '').trim(), b = w.bbox || {};
    if (!t || !(w.confidence >= 30) || !/[A-Za-zÀ-ÿ0-9]/.test(t) || !Number.isFinite(b.y1) || !Number.isFinite(b.y0)) return;
    const h = b.y1 - b.y0; if (h < 6) return;
    ws.push({ t, x0: b.x0, x1: b.x1, h, cy: (b.y0 + b.y1) / 2, conf: w.confidence });
  });
  ws.sort((a, b) => a.cy - b.cy);
  const raw = [];
  ws.forEach((w) => {
    const ln = raw.find((l) => Math.abs(l.cy - w.cy) < 0.55 * Math.max(l.h, w.h) && w.x0 < l.x1 + 2.5 * l.h && w.x1 > l.x0 - 2.5 * l.h);
    if (ln) { ln.ws.push(w); ln.x0 = Math.min(ln.x0, w.x0); ln.x1 = Math.max(ln.x1, w.x1); ln.cy = ln.ws.reduce((a, x) => a + x.cy, 0) / ln.ws.length; }
    else raw.push({ ws: [w], x0: w.x0, x1: w.x1, cy: w.cy, h: w.h });
  });
  const lines = raw.map((l) => {
    l.ws.sort((a, b) => a.x0 - b.x0);
    const hs = l.ws.map((x) => x.h).sort((a, b) => a - b);
    const text = l.ws.map((x) => x.t).join(' ').replace(/\s+/g, ' ').trim();
    const letters = (text.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    const n = norm(text);
    return {
      text, cy: l.cy, h: hs[Math.floor(hs.length / 2)], letters,
      conf: l.ws.reduce((a, x) => a + x.conf, 0) / l.ws.length,
      meta: META_LINE.test(n) || PUBLISHERS.test(n)
    };
  }).filter((l) => l.letters >= 3 && l.conf >= 45 && l.letters / l.text.length >= 0.6).sort((a, b) => a.cy - b.cy);

  const cand = lines.filter((l) => !l.meta && l.letters >= 4);
  let titleIdx = [];
  if (cand.length) {
    const anchor = cand.reduce((best, l) => (l.h * Math.min(1, l.conf / 75) > best.h * Math.min(1, best.conf / 75) ? l : best), cand[0]);
    const ai = lines.indexOf(anchor);
    const ok = (l) => !l.meta && l.h >= 0.5 * anchor.h;
    titleIdx = [ai];
    for (let i = ai - 1; i >= 0 && ok(lines[i]) && Math.abs(lines[i + 1].cy - lines[i].cy) <= 2.4 * anchor.h; i--) titleIdx.unshift(i);
    for (let i = ai + 1; i < lines.length && ok(lines[i]) && Math.abs(lines[i].cy - lines[i - 1].cy) <= 2.4 * anchor.h; i++) titleIdx.push(i);
  }
  const title = tidyTitle(titleIdx.map((i) => lines[i].text).join(' '));
  const allText = lines.map((l) => l.text).join(' \n ');
  const wordsText = ws.map((w) => w.t).join(' ');
  let cls = detectClass(allText) || detectClass(wordsText), clsGuess = false;
  if (!cls) { // un numero grande da solo (1–5) sulla copertina: probabile classe, ma incerta
    const maxH = Math.max(0, ...ws.map((w) => w.h));
    const big = ws.find((w) => /^[1-5][ªa°º^]?$/.test(w.t) && w.h >= 0.9 * maxH && w.conf >= 60);
    if (big) { cls = +big.t[0]; clsGuess = true; }
  }
  const quality = titleIdx.length ? titleIdx.reduce((a, i) => a + lines[i].conf, 0) / titleIdx.length : 0;
  return { title, lines, titleIdx, allText, titleText: titleIdx.map((i) => lines[i].text).join(' '), cls, clsGuess, year: detectYear(wordsText), quality };
}

/* ---------- OCR (Tesseract.js ospitato in vendor/: nessun download esterno) ---------- */
let ocrWorker = null, ocrLoading = null;
const OCR_STEPS = {
  'loading tesseract core': 'Preparo il lettore…', 'initializing tesseract': 'Preparo il lettore…', 'initialized tesseract': 'Preparo il lettore…',
  'loading language traineddata': 'Carico la lingua italiana…', 'loaded language traineddata': 'Carico la lingua italiana…',
  'initializing api': 'Preparo il lettore…', 'initialized api': 'Preparo il lettore…', 'recognizing text': 'Leggo il testo'
};
function ocrProgress(m) {
  if (!m || !m.status || !$('dlg-scan').open) return;
  const pct = Math.round((m.progress || 0) * 100);
  const el = $('ocr-progress'); el.classList.remove('hidden'); el.value = pct;
  setStatus('📖 ' + (OCR_STEPS[m.status] || 'Lavoro…') + (m.status === 'recognizing text' ? ` ${pct}%` : ''));
}
async function getOcr() {
  if (ocrWorker) return ocrWorker;
  if (!ocrLoading) {
    ocrLoading = (async () => {
      await loadScript('./vendor/tesseract/tesseract.min.js');
      const abs = (p) => new URL(p, location.href).href;
      const w = await window.Tesseract.createWorker('ita', 1, {
        workerPath: abs('./vendor/tesseract/worker.min.js'), corePath: abs('./vendor/tesseract/core'), langPath: abs('./vendor/tesseract/lang'),
        logger: ocrProgress
      });
      await w.setParameters({ tessedit_pageseg_mode: window.Tesseract.PSM.SPARSE_TEXT, preserve_interword_spaces: '1' });
      ocrWorker = w; return w;
    })().catch((e) => { ocrLoading = null; throw e; });
  }
  return ocrLoading;
}
/* Scala di grigi + contrasto automatico (e, al secondo tentativo, colori invertiti per il testo chiaro su fondo scuro). */
function prepForOcr(cv, invert) {
  const side = Math.max(cv.width, cv.height);
  const s = side > 2200 ? 2200 / side : side < 1200 ? Math.min(2, 1400 / side) : 1;
  const out = document.createElement('canvas');
  out.width = Math.round(cv.width * s); out.height = Math.round(cv.height * s);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(cv, 0, 0, out.width, out.height);
  const img = ctx.getImageData(0, 0, out.width, out.height), d = img.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0; d[i] = g; hist[g]++; }
  const total = d.length / 4; let acc = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
  acc = 0; for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }
  const span = Math.max(30, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    let g = Math.max(0, Math.min(255, (d[i] - lo) * 255 / span)); if (invert) g = 255 - g;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}
async function ocrCover(cv) {
  const w = await getOcr();
  let best = null;
  for (const invert of [false, true]) {
    const { data } = await w.recognize(prepForOcr(cv, invert));
    const p = parseCover(data.words || []);
    if (!best || p.quality > best.quality || (!best.title && p.title)) best = p;
    if (best.title.length >= 4 && best.quality >= 70) break;
  }
  return best;
}
const canvasToJpeg = (cv, max) => {
  const s = Math.min(1, max / Math.max(cv.width, cv.height));
  const o = document.createElement('canvas'); o.width = Math.round(cv.width * s); o.height = Math.round(cv.height * s);
  o.getContext('2d').drawImage(cv, 0, 0, o.width, o.height);
  return o.toDataURL('image/jpeg', 0.72);
};

/* ---------- scanner ---------- */
let stream = null, scanTimer = null, scanBusy = false, detector = null, lastCode = '', lastAt = 0, pendingCode = '', pendingCover = '', lookupToken = 0;
let scanMode = 'code', torchOn = false, chipLines = [], chipSel = [], suggestions = [];
function setStatus(html, cls) { const s = $('scan-status'); s.className = 'status' + (cls ? ' ' + cls : ''); s.innerHTML = html; }
function getDetector() {
  if (detector) return detector;
  try { if ('BarcodeDetector' in window) detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] }); } catch (e) { detector = null; }
  return detector;
}
function resetScanPanel() {
  $('scan-result').classList.add('hidden'); pendingCode = ''; pendingCover = ''; lookupToken++;
  chipLines = []; chipSel = []; suggestions = [];
  ['res-sugg', 'res-lines-box', 'res-hint'].forEach((id) => $(id).classList.add('hidden'));
  $('link-box').classList.remove('hidden');
}
const SCAN_HELP = {
  code: 'Inquadra il <strong>codice a barre</strong> sul retro del libro (ISBN): fermo, ben illuminato, a circa 15–20 cm.',
  cover: 'Inquadra la <strong>copertina davanti</strong>, intera e dritta, con buona luce e senza riflessi; poi tocca «Scatta e leggi». Cerco titolo, materia e classe.'
};
function setScanMode(mode) {
  scanMode = mode;
  $('tab-code').setAttribute('aria-selected', String(mode === 'code'));
  $('tab-cover').setAttribute('aria-selected', String(mode === 'cover'));
  $('scan-help').innerHTML = SCAN_HELP[mode];
  $('scan-laser').classList.toggle('hidden', mode !== 'code');
  $('cover-guide').classList.toggle('hidden', mode !== 'cover');
  $('cover-actions').classList.toggle('hidden', mode !== 'cover');
  $('isbn-form').classList.toggle('hidden', mode !== 'code');
  if (stream && !scanBusy) setStatus(mode === 'code' ? 'Inquadra il codice a barre…' : 'Inquadra la copertina e tocca «Scatta e leggi».');
  scheduleScan();
}
$('tab-code').onclick = () => setScanMode('code');
$('tab-cover').onclick = () => setScanMode('cover');
async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
  });
  const v = $('scan-video'); v.srcObject = stream;
  try { await v.play(); } catch (e) { /* autoplay già attivo */ }
  const track = stream.getVideoTracks()[0];
  const caps = track && track.getCapabilities ? track.getCapabilities() : {};
  if (caps.focusMode && caps.focusMode.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
  torchOn = false;
  $('btn-torch').classList.toggle('hidden', !caps.torch);
  $('btn-torch').setAttribute('aria-pressed', 'false');
}
$('btn-torch').onclick = () => {
  const track = stream && stream.getVideoTracks()[0]; if (!track) return;
  torchOn = !torchOn;
  track.applyConstraints({ advanced: [{ torch: torchOn }] }).then(() => $('btn-torch').setAttribute('aria-pressed', String(torchOn))).catch(() => { torchOn = false; });
};
$('btn-scan').onclick = async () => {
  resetScanPanel(); lastCode = ''; scanBusy = false; $('ocr-progress').classList.add('hidden');
  setScanMode('code'); setStatus('Avvio fotocamera…');
  openDialog($('dlg-scan'));
  if (!navigator.mediaDevices?.getUserMedia) { setStatus('Fotocamera non disponibile qui (serve https). Usa «Foto con la fotocamera» o la galleria, oppure scrivi l\'ISBN.', 'warn'); return; }
  try { await startCamera(); setStatus('Inquadra il codice a barre…'); scheduleScan(); }
  catch (e) { setStatus('Non posso usare la fotocamera. Usa «Foto con la fotocamera» o la galleria, oppure scrivi l\'ISBN.', 'warn'); }
};
function stopScanner() {
  clearTimeout(scanTimer); scanTimer = null;
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  $('scan-video').srcObject = null; torchOn = false;
}
$('dlg-scan').addEventListener('close', () => { stopScanner(); resetScanPanel(); scanBusy = false; $('ocr-progress').classList.add('hidden'); });
function scheduleScan() {
  clearTimeout(scanTimer); scanTimer = null;
  if (!stream || scanMode !== 'code') return;
  scanTimer = setTimeout(async () => { await scanFrame(); scheduleScan(); }, 300);
}
async function scanFrame() {
  const v = $('scan-video'); if (scanBusy || v.readyState < 2 || !v.videoWidth) return;
  scanBusy = true;
  try { const c = await readCode(v, v.videoWidth, v.videoHeight, 1280); if (c && scanMode === 'code') handleCode(c); } catch (e) { /* frame non leggibile */ } finally { scanBusy = false; }
}
function setBusyUi(b) { ['btn-cover-shot', 'btn-scan-photo', 'btn-scan-file'].forEach((id) => { $(id).disabled = b; }); if (!b) $('ocr-progress').classList.add('hidden'); }

/* Foto (fotocamera o galleria): prima cerco un codice a barre, poi leggo la copertina. */
async function handlePhotoFile(f) {
  if (!f || scanBusy) return;
  setStatus('🔎 Analizzo la foto…');
  let bmp;
  try { bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
  catch (e) { try { bmp = await createImageBitmap(f); } catch (e2) { setStatus('Non riesco a leggere questa foto.', 'warn'); return; } }
  const cv = frameToCanvas(bmp, bmp.width, bmp.height, 2200, true);
  if (bmp.close) bmp.close();
  await analyzeCover(cv, scanMode === 'code');
}
$('btn-scan-file').onclick = () => $('scan-file').click();
$('btn-scan-photo').onclick = () => $('scan-photo').click();
['scan-file', 'scan-photo'].forEach((id) => { $(id).onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; handlePhotoFile(f); }; });
$('btn-cover-shot').onclick = async () => {
  const v = $('scan-video');
  if (!stream || !v.videoWidth || scanBusy) { setStatus(scanBusy ? 'Sto ancora leggendo…' : 'La fotocamera non è pronta: usa «Foto con la fotocamera».', 'warn'); return; }
  const cv = frameToCanvas(v, v.videoWidth, v.videoHeight, 2200, true);
  v.pause();
  try { await analyzeCover(cv, false); } finally { if (stream) v.play().catch(() => {}); }
};
async function analyzeCover(cv, codeFirst) {
  if (scanBusy) return;
  scanBusy = true; resetScanPanel(); setBusyUi(true);
  const token = lookupToken;
  try {
    setStatus(codeFirst ? '🔎 Cerco il codice a barre…' : '📖 Leggo la copertina…');
    let code = null;
    try { code = await readCode(cv, cv.width, cv.height, 2200); } catch (e) { /* nessun codice */ }
    if (token !== lookupToken) return;
    if (code && normIsbn(code)) { scanBusy = false; handleCode(code, true); return; }
    setStatus('📖 Leggo la copertina… (la prima volta ci vuole qualche secondo in più)');
    const photo = canvasToJpeg(cv, 480);
    const parsed = await ocrCover(cv);
    if (token !== lookupToken) return;
    showCoverResult(parsed, photo);
  } catch (e) {
    console.warn('Copertina:', e);
    if (token === lookupToken) setStatus('Non riesco a leggere la copertina (modulo di lettura non disponibile: aprilo almeno una volta online). Scrivi tu il titolo e scegli la materia.', 'warn');
  } finally { scanBusy = false; setBusyUi(false); }
}
$('isbn-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = $('isbn-input').value.trim(); if (!raw) return;
  const isbn = normIsbn(raw);
  if (!isbn) { setStatus('Questo ISBN non è valido: controlla le cifre (13, oppure 10).', 'warn'); return; }
  handleCode(isbn, true);
});
const sameCode = (a, b) => !!a && !!b && (normIsbn(a) || a) === (normIsbn(b) || b);
function handleCode(raw, force) {
  const code = normIsbn(raw) || String(raw);
  const now = Date.now();
  if (!force && code === lastCode && now - lastAt < 2500) return;
  if (!$('scan-result').classList.contains('hidden') && pendingCode === code) return;
  lastCode = code; lastAt = now;
  let hit = null;
  Object.keys(subjects).forEach((k) => subjects[k].materials.forEach((m) => { if (sameCode(m.barcode, code)) hit = { key: k, mat: m }; }));
  if (hit) {
    resetScanPanel();
    if (dayItems(state.day).includes(hit.mat.id)) {
      if (!dayChecks(state.day)[hit.mat.id]) toggleItem(hit.mat.id, true);
      setStatus(`✅ <b>${esc(hit.mat.name)}</b> è nello zaino!`, 'ok'); speak(`${hit.mat.name}, nello zaino!`);
    } else {
      setStatus(`ℹ️ <b>${esc(hit.mat.name)}</b> non serve per ${esc(state.day)}.`, 'warn');
    }
    return;
  }
  showNewCode(code);
}
function fillSelects(preferred) {
  $('scan-select').innerHTML = Object.keys(subjects).map((k) => `<optgroup label="${esc(k)}">` +
    subjects[k].materials.map((m) => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join('') + '</optgroup>').join('');
  $('res-subj').innerHTML = Object.keys(subjects).map((k) => `<option value="${esc(k)}">${esc(subjects[k].emoji)} ${esc(k)}</option>`).join('');
  const dayFirst = packList(state.day).find((g) => g.key);
  const pick = preferred || (dayFirst && dayFirst.key) || Object.keys(subjects)[0];
  if (pick) $('res-subj').value = pick;
}
async function showNewCode(code) {
  const token = ++lookupToken, isbn = normIsbn(code);
  pendingCode = code; pendingCover = '';
  chipLines = []; chipSel = []; suggestions = [];
  ['res-sugg', 'res-lines-box', 'res-hint'].forEach((id) => $(id).classList.add('hidden'));
  $('link-box').classList.remove('hidden');
  $('res-code').textContent = (isbn ? 'ISBN ' : 'Codice ') + code;
  $('res-title').textContent = ''; $('res-author').textContent = ''; $('res-name').value = ''; $('res-cls').value = '';
  $('res-cover').classList.add('hidden'); $('res-cover').removeAttribute('src');
  fillSelects(); $('scan-result').classList.remove('hidden');
  if (!isbn) { setStatus('Codice nuovo (non è un ISBN). Scrivi il nome del libro e scegli la materia, oppure collegalo a un libro che hai già.', 'warn'); return; }
  setStatus('📚 Libro nuovo! Lo cerco su Internet…');
  const info = await lookupIsbn(isbn);
  if (token !== lookupToken) return; // nel frattempo è cambiato codice o la finestra è stata chiusa
  if (!info) {
    setStatus(navigator.onLine ? 'Non ho trovato questo libro su Internet. Scrivi tu il nome e scegli la materia (oppure prova con la scheda «Copertina»).' : 'Sei offline: non posso cercare il libro. Scrivi tu il nome e scegli la materia.', 'warn');
    return;
  }
  $('res-title').textContent = info.title; $('res-author').textContent = info.authors;
  $('res-name').value = info.title.slice(0, 60);
  const cls = detectClass(info.title + ' ' + info.hint); if (cls) $('res-cls').value = String(cls);
  if (info.cover) { pendingCover = info.cover; $('res-cover').src = info.cover; $('res-cover').classList.remove('hidden'); }
  fillSelects(guessSubject(info.hint));
  setStatus('✅ Trovato! Controlla nome, materia e classe, poi aggiungilo.' + (info.cover ? '' : ' (Senza copertina: potrai aggiungere una foto dopo.)'), 'ok');
}

/* ---------- risultato dalla copertina ---------- */
async function searchBooks(title) {
  const d = await fetchJson(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent('intitle:' + title)}&maxResults=4&printType=books&langRestrict=it`);
  return (d.items || []).map((it) => {
    const v = it.volumeInfo || {}, ids = v.industryIdentifiers || [];
    const i13 = ids.find((x) => x.type === 'ISBN_13'), i10 = ids.find((x) => x.type === 'ISBN_10');
    return {
      title: (v.title || '') + (v.subtitle ? ': ' + v.subtitle : ''), authors: (v.authors || []).join(', '),
      isbn: normIsbn(i13 && i13.identifier) || normIsbn(i10 && i10.identifier) || '',
      hint: (v.categories || []).join(' ') + ' ' + (v.title || ''), coverUrl: (v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail)) || ''
    };
  }).filter((x) => x.title);
}
function chipName() { return tidyTitle(chipSel.slice().sort((a, b) => a - b).map((i) => chipLines[i].text).join(' ')); }
function renderChips() {
  $('res-lines').innerHTML = chipLines.map((l, i) =>
    `<button type="button" class="chip-sel" data-i="${i}" aria-pressed="${chipSel.includes(i)}">${esc(l.text)}</button>`).join('');
  $('res-lines-box').classList.toggle('hidden', !chipLines.length);
}
$('res-lines').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]'); if (!b) return;
  const i = +b.dataset.i;
  chipSel = chipSel.includes(i) ? chipSel.filter((x) => x !== i) : chipSel.concat(i);
  const name = chipName(); $('res-name').value = name; $('res-title').textContent = name || 'Titolo non riconosciuto';
  renderChips();
});
function showCoverResult(p, photo) {
  const token = lookupToken;
  pendingCode = ''; pendingCover = photo || '';
  chipLines = p.lines.slice(0, 14); chipSel = p.titleIdx.filter((i) => i < 14);
  $('res-code').textContent = 'Da copertina' + (p.year ? ` · edizione ${p.year}` : '');
  $('res-title').textContent = p.title || 'Titolo non riconosciuto'; $('res-author').textContent = '';
  $('res-name').value = p.title || '';
  if (pendingCover) { $('res-cover').src = pendingCover; $('res-cover').classList.remove('hidden'); }
  const subj = detectSubject(p.titleText, p.allText);
  fillSelects(subj);
  $('res-cls').value = p.cls ? String(p.cls) : '';
  renderChips();
  $('link-box').classList.add('hidden');
  const hints = [];
  if (!subj) hints.push('Materia non riconosciuta: scegli quella giusta.');
  if (!p.cls) hints.push('Classe non trovata: scegli tu la classe (se serve).');
  else if (p.clsGuess) hints.push('Classe incerta: controlla.');
  const kidCls = (String(profile.cls).match(/[1-5]/) || [])[0];
  if (p.cls && kidCls && String(p.cls) !== kidCls) hints.push(`Attenzione: sembra un libro di ${p.cls}ª, ${profile.name} è in ${profile.cls}.`);
  $('res-hint').textContent = hints.join(' '); $('res-hint').classList.toggle('hidden', !hints.length);
  $('scan-result').classList.remove('hidden');
  if (p.title) setStatus('✅ Letto! Controlla titolo, materia e classe, poi aggiungilo.' + (chipLines.length ? ' Se il titolo è sbagliato, tocca le parole giuste.' : ''), 'ok');
  else setStatus(chipLines.length ? 'Non sono sicuro del titolo: tocca le parole giuste qui sotto, oppure scrivilo tu.' : 'Non riesco a leggere il testo. Riprova con più luce e la copertina dritta e intera, oppure scrivi il titolo.', 'warn');
  if (navigator.onLine && p.title && p.title.length >= 4) {
    searchBooks(p.title).then((list) => {
      if (token !== lookupToken || !list.length) return;
      suggestions = list;
      $('res-sugg-list').innerHTML = list.map((s, i) => `<button type="button" class="sugg" data-sg="${i}"><span><strong>${esc(s.title.slice(0, 70))}</strong><br><span class="muted small">${esc(s.authors)}${s.isbn ? ' · ISBN ' + esc(s.isbn) : ''}</span></span></button>`).join('');
      $('res-sugg').classList.remove('hidden');
    }).catch(() => { /* suggerimenti non disponibili */ });
  }
}
$('res-sugg-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-sg]'); if (!b) return;
  const s = suggestions[+b.dataset.sg]; if (!s) return;
  const token = lookupToken;
  $('res-name').value = s.title.slice(0, 60); $('res-title').textContent = s.title; $('res-author').textContent = s.authors;
  if (s.isbn) { pendingCode = s.isbn; $('res-code').textContent = 'ISBN ' + s.isbn; $('link-box').classList.remove('hidden'); }
  const sub = guessSubject(s.hint); if (sub) $('res-subj').value = sub;
  const cls = detectClass(s.title); if (cls) $('res-cls').value = String(cls);
  const cover = await fetchCover(s.coverUrl);
  if (cover && token === lookupToken) { pendingCover = cover; $('res-cover').src = cover; $('res-cover').classList.remove('hidden'); }
});
$('btn-add-book').onclick = () => {
  const name = $('res-name').value.trim(), key = $('res-subj').value;
  if (!subjects[key]) return;
  if (!name) { toast('Scrivi il nome del libro.'); $('res-name').focus(); return; }
  if (pendingCode) Object.keys(subjects).forEach((k) => subjects[k].materials.forEach((m) => { if (sameCode(m.barcode, pendingCode)) m.barcode = ''; }));
  const cls = /^[1-5]$/.test($('res-cls').value) ? $('res-cls').value : '';
  const mat = { id: uid(), name: name.slice(0, 60), photo: pendingCover, barcode: pendingCode, cls };
  subjects[key].materials.push(mat);
  if (!saveSubjects()) { subjects[key].materials.pop(); return; }
  const needed = dayItems(state.day).includes(mat.id);
  resetScanPanel(); lastCode = '';
  if (needed) toggleItem(mat.id, true); else render();
  setStatus(`✅ <b>${esc(mat.name)}</b> aggiunto a ${esc(key)}.` + (needed ? ' È nello zaino!' : ` Non serve per ${esc(state.day)}, ma da ora lo trovi nelle ore di ${esc(key)}.`), 'ok');
};
$('btn-rescan').onclick = () => {
  resetScanPanel(); lastCode = '';
  setScanMode(scanMode);
  setStatus(scanMode === 'code' ? 'Inquadra il codice a barre…' : 'Inquadra la copertina e tocca «Scatta e leggi».');
};
$('btn-link').onclick = () => {
  const f = findMaterial($('scan-select').value); if (!f || !pendingCode) return;
  Object.keys(subjects).forEach((k) => subjects[k].materials.forEach((m) => { if (sameCode(m.barcode, pendingCode)) m.barcode = ''; }));
  f.mat.barcode = pendingCode;
  if (saveSubjects()) {
    resetScanPanel(); lastCode = '';
    setStatus(`🔗 Collegato a <b>${esc(f.mat.name)}</b>. Alla prossima scansione si spunta da solo.`, 'ok'); render();
  }
};

/* ---------- assistente (regole locali, nessun servizio esterno) ---------- */
function listFor(day) {
  const g = packList(day);
  if (!g.length) return `${day}: nessuna materia in orario.`;
  const c = dayChecks(day);
  return `${day} — ${g.map((x) => {
    const mats = x.mats.map((m) => (c[m.id] ? '✓ ' : '') + m.name).join(', ') || 'nessun libro registrato';
    return `\n• ${x.label}: ${mats}`;
  }).join('')}`;
}
function answer(q) {
  const n = norm(q); const now = new Date();
  let day = state.day, note = '';
  const addDays = (k) => {
    const d = new Date(now); d.setDate(d.getDate() + k); const dow = d.getDay();
    if (dow === 0 || dow === 6) { note = 'Quel giorno non c\'è scuola, ti mostro lunedì.\n'; return DAYS[0]; }
    return DAYS[dow - 1];
  };
  if (/dopodomani/.test(n)) day = addDays(2);
  else if (/\bdomani\b/.test(n)) day = addDays(1);
  else if (/\boggi\b/.test(n)) day = addDays(0);
  const named = DAYS.find((d) => n.includes(norm(d)));
  if (named) day = named;

  if (/manc|rimast|ho tutto|pronto|dimentic/.test(n)) {
    const miss = missingNames(day);
    return note + (miss.length ? `Per ${day} manca ancora: ${miss.join(', ')}.` : `Per ${day} hai spuntato tutto: zaino pronto! 🎉`);
  }
  const subj = Object.keys(subjects).find((k) => n.includes(norm(k)) || (norm(k) === 'ed. fisica' && /ginnastica|educazione fisica|palestra/.test(n)));
  if (subj) {
    const days = DAYS.filter((d) => (schedule[d] || []).some((h) => parseHour(h).some((p) => p.key === subj)));
    const mats = subjects[subj].materials.map((m) => m.name).join(', ') || 'nessun libro registrato';
    return `${subj}: ${mats}.\nIn orario: ${days.join(', ') || 'mai'}.`;
  }
  if (/orario|ore\b|lezion/.test(n)) return note + `${day}: ` + (schedule[day] || []).map((h, i) => `${i + 1}ª ${h}`).join(', ') + '.';
  return note + listFor(day);
}
function chatAdd(who, text) {
  const d = document.createElement('div'); d.className = 'msg ' + who;
  if (who === 'ai') { const a = document.createElement('img'); a.className = 'ava'; a.src = 'img/hero-orario.webp'; a.alt = ''; d.appendChild(a); }
  d.appendChild(document.createTextNode(text));
  $('chat').appendChild(d); $('chat').scrollTop = $('chat').scrollHeight;
}
function send() {
  const t = $('ai-input').value.trim(); if (!t) return;
  chatAdd('me', t); $('ai-input').value = '';
  const a = answer(t); chatAdd('ai', a); speak(a.replace(/[•✓]/g, ''));
}
$('btn-ai').onclick = () => {
  if (!$('chat').children.length) chatAdd('ai', 'Ciao! 🎒 Chiedimi: «Cosa porto domani?», «Cosa manca?», «Libri di Matematica?»');
  openDialog($('dlg-ai'));
};
$('btn-send').onclick = send;
$('ai-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });

let recog = null;
$('btn-mic').onclick = () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Il riconoscimento vocale non è supportato qui.'); return; }
  if (recog) { recog.stop(); return; }
  recog = new SR(); recog.lang = 'it-IT';
  $('btn-mic').classList.add('btn-primary');
  recog.onresult = (e) => { $('ai-input').value = e.results[0][0].transcript; send(); };
  recog.onend = recog.onerror = () => { recog = null; $('btn-mic').classList.remove('btn-primary'); };
  try { recog.start(); } catch (e) { recog = null; }
};

/* ---------- audio / festa ---------- */
let actx = null;
function beep() {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = 587.33; g.gain.value = 0.08; o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + 0.1);
  } catch (e) { /* audio non disponibile */ }
}
function speak(text) {
  if (muted || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'it-IT'; speechSynthesis.speak(u);
}
function setMuted(v) {
  muted = v; store.set(KEYS.mute, v);
  const b = $('btn-mute'); b.textContent = v ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(v)); b.setAttribute('aria-label', v ? 'Audio disattivato' : 'Audio attivo');
  if (v && 'speechSynthesis' in window) speechSynthesis.cancel();
}
$('btn-mute').onclick = () => setMuted(!muted);

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = $('confetti'), ctx = cv.getContext('2d');
  cv.width = innerWidth; cv.height = innerHeight;
  const cols = ['#6366f1', '#a855f7', '#34d399', '#fbbf24', '#f472b6', '#38bdf8'];
  const ps = Array.from({ length: 120 }, () => ({
    x: cv.width / 2, y: cv.height * 0.55, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6
  }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ps.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += 0.2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); });
    if (++f < 110) requestAnimationFrame(tick); else ctx.clearRect(0, 0, cv.width, cv.height);
  })();
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, action) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = action.fn; t.appendChild(b); }
  clearTimeout(toastTimer); if (!action) toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}

/* ---------- figli: scelta, aggiunta, modifica, eliminazione ---------- */
function renderKids() {
  $('kids').innerHTML = kids.list.map((k) =>
    `<button class="kid${k.id === activeKidId ? ' on' : ''}" type="button" data-kid="${esc(k.id)}" aria-pressed="${k.id === activeKidId}"><img src="./img/avatar-${esc(k.avatar)}.webp" alt="" width="34" height="34"><span>${esc(k.name)}</span></button>`).join('')
    + `<button class="kid-act" id="btn-kid-edit" type="button" aria-label="Modifica ${esc(activeKid().name)}">✏️</button>`
    + (kids.list.length < MAX_KIDS ? '<button class="kid-act" id="btn-kid-add" type="button">＋ Figlio</button>' : '');
}
function readKidData(id) {
  const prev = activeKidId; activeKidId = id;
  try {
    return {
      schedule: loadSchedule(), subjects: loadSubjects(), checks: cleanChecks(store.get(KEYS.checks, {})),
      rewards: cleanRewards(store.get(KEYS.rewards, {})), history: cleanHistory(store.get(KEYS.history, {}))
    };
  } finally { activeKidId = prev; }
}
function loadKidData() {
  activeKidId = kids.active;
  subjects = loadSubjects(); schedule = loadSchedule();
  checks = cleanChecks(store.get(KEYS.checks, {})); rewards = cleanRewards(store.get(KEYS.rewards, {}));
  progressLog = cleanHistory(store.get(KEYS.history, {}));
  profile = activeKid();
  $('set-name').value = profile.name; $('set-class').value = profile.cls;
}
function switchKid(id) {
  if (id === activeKidId || !kids.list.some((k) => k.id === id)) return;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  kids.active = id; saveKids(); loadKidData();
  state.edit = false; state.day = defaultDay();
  render(); toast(`Zaino di ${profile.name} 🎒`);
}
$('kids').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kid]');
  if (b) { switchKid(b.dataset.kid); return; }
  if (e.target.closest('#btn-kid-add')) openKidDialog(null);
  else if (e.target.closest('#btn-kid-edit')) openKidDialog(activeKidId);
});
let kidEditId = null;
function openKidDialog(id) {
  kidEditId = id;
  const k = id ? kids.list.find((x) => x.id === id) : null;
  $('kid-title').textContent = k ? `Modifica ${k.name}` : 'Aggiungi un figlio';
  $('kid-name').value = k ? k.name : ''; $('kid-cls').value = k ? (k.cls === '-' ? '' : k.cls) : '';
  const used = kids.list.map((x) => x.avatar);
  const pick = k ? k.avatar : (AVATARS.find((a) => !used.includes(a)) || AVATARS[kids.list.length % AVATARS.length]);
  $('kid-avatars').innerHTML = AVATARS.map((a) =>
    `<label class="avatar-opt"><input type="radio" name="kid-avatar" value="${a}" ${a === pick ? 'checked' : ''} aria-label="${esc(AVATAR_NAMES[a])}"><img src="./img/avatar-${a}.webp" alt="" width="56" height="56"></label>`).join('');
  $('kid-from-box').classList.toggle('hidden', !!k);
  $('kid-from').innerHTML = '<option value="">Da zero (materie standard, orario vuoto)</option>'
    + kids.list.map((x) => `<option value="${esc(x.id)}">Copia orario e materie di ${esc(x.name)}</option>`).join('');
  $('btn-kid-del').classList.toggle('hidden', !k || kids.list.length < 2);
  openDialog($('dlg-kid')); setTimeout(() => $('kid-name').focus(), 60);
}
$('kid-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = $('kid-name').value.trim().slice(0, 30);
  if (!name) { $('kid-name').focus(); return; }
  const cls = $('kid-cls').value.trim().slice(0, 10) || '-';
  const sel = document.querySelector('input[name="kid-avatar"]:checked');
  const avatar = sel && AVATARS.includes(sel.value) ? sel.value : AVATARS[0];
  if (kidEditId) {
    const k = kids.list.find((x) => x.id === kidEditId); if (!k) return;
    Object.assign(k, { name, cls, avatar });
    if (!saveKids()) return;
    if (k.id === activeKidId) { $('set-name').value = name; $('set-class').value = cls; }
    $('dlg-kid').close(); render(); toast('Salvato ✅'); return;
  }
  if (kids.list.length >= MAX_KIDS) { toast(`Puoi inserire al massimo ${MAX_KIDS} figli.`); return; }
  const id = 'k' + Math.random().toString(36).slice(2, 8);
  const from = $('kid-from').value;
  if (from) {
    const data = readKidData(from);
    if (!store.set(kidKey(KID_BASE.subjects, id), data.subjects) || !store.set(kidKey(KID_BASE.schedule, id), data.schedule)) {
      Object.values(KID_BASE).forEach((b) => localStorage.removeItem(kidKey(b, id))); return;
    }
  }
  kids.list.push({ id, name, cls, avatar });
  if (!saveKids()) { kids.list.pop(); return; }
  $('dlg-kid').close();
  switchKid(id);
});
$('btn-kid-del').onclick = () => {
  const k = kids.list.find((x) => x.id === kidEditId); if (!k || kids.list.length < 2) return;
  if (!confirm(`Eliminare ${k.name} con orario, materie, libri, premi e cronologia? L'operazione non si può annullare.`)) return;
  Object.values(KID_BASE).forEach((b) => { try { localStorage.removeItem(kidKey(b, k.id)); } catch (e) { /* niente */ } });
  kids.list = kids.list.filter((x) => x.id !== k.id);
  if (kids.active === k.id) kids.active = kids.list[0].id;
  saveKids(); loadKidData(); state.edit = false; state.day = defaultDay();
  $('dlg-kid').close(); render(); toast(`${k.name} eliminato.`);
};

/* ---------- impostazioni e backup ---------- */
$('set-name').value = profile.name; $('set-class').value = profile.cls;
['set-name', 'set-class'].forEach((id) => $(id).addEventListener('change', () => {
  const k = activeKid();
  k.name = $('set-name').value.trim().slice(0, 30) || 'Studente'; k.cls = $('set-class').value.trim().slice(0, 10) || '-';
  saveKids(); render();
}));
const snapshotStore = () => {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('zaino_')) o[k] = localStorage.getItem(k); }
  return o;
};
const restoreStore = (o) => {
  try { Object.keys(snapshotStore()).forEach((k) => localStorage.removeItem(k)); Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v)); } catch (e) { /* niente */ }
};
$('btn-export').onclick = () => {
  const kidData = {};
  kids.list.forEach((k) => { kidData[k.id] = readKidData(k.id); });
  const cur = kidData[activeKidId];
  /* versione 6: tutti i figli. Restano anche i campi del figlio attivo, così una versione più vecchia dell'app può ancora leggere la copia. */
  const data = {
    app: 'zaino-hero', version: 6, exported: new Date().toISOString(), kids, kidData, catalog: prizeCatalog,
    profile: { name: profile.name, cls: profile.cls }, schedule: cur.schedule, subjects: cur.subjects, checks: cur.checks, rewards: cur.rewards, history: cur.history
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
  a.download = `zaino-hero-backup-${isoDate(new Date())}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('btn-import').onclick = () => $('file-import').click();
$('file-import').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let d;
  try {
    d = JSON.parse(await f.text());
    if (!d || d.app !== 'zaino-hero' || !d.schedule || typeof d.schedule !== 'object' || !d.subjects || typeof d.subjects !== 'object') throw new Error('formato');
  } catch (err) { toast('File non valido: non è una copia di Zaino Hero.'); return; }
  const snap = snapshotStore();
  const fail = () => { restoreStore(snap); toast('La copia è troppo grande per questo dispositivo: non è stato cambiato nulla.'); };
  const newKids = d.version >= 6 && d.kidData && typeof d.kidData === 'object' ? cleanKids(d.kids) : null;
  if (newKids) {
    if (!confirm(`Sostituire tutti i figli (${newKids.list.length}) con orari, materie, spunte, premi e cronologia della copia?`)) return;
    Object.keys(snap).forEach((k) => { if (k !== GLOBAL_KEYS.mute) localStorage.removeItem(k); });
    let ok = store.set(GLOBAL_KEYS.kids, newKids, true) && store.set(GLOBAL_KEYS.catalog, cleanCatalog(d.catalog), true);
    newKids.list.forEach((k) => {
      const kd = d.kidData[k.id] || {};
      ok = ok && store.set(kidKey(KID_BASE.schedule, k.id), kd.schedule && typeof kd.schedule === 'object' ? kd.schedule : {}, true)
        && store.set(kidKey(KID_BASE.subjects, k.id), kd.subjects && typeof kd.subjects === 'object' ? kd.subjects : {}, true)
        && store.set(kidKey(KID_BASE.checks, k.id), cleanChecks(kd.checks), true)
        && store.set(kidKey(KID_BASE.rewards, k.id), cleanRewards(kd.rewards), true)
        && store.set(kidKey(KID_BASE.history, k.id), cleanHistory(kd.history), true);
    });
    if (!ok) { fail(); return; }
    kids = newKids;
  } else {
    /* copia di una versione precedente: riguarda un solo figlio, quello selezionato */
    if (!confirm(`Questa copia riguarda un solo figlio. Sostituire orario, materie, spunte, premi e cronologia di ${profile.name}?`)) return;
    if (!store.set(KEYS.schedule, d.schedule, true) || !store.set(KEYS.subjects, d.subjects, true)
        || !store.set(KEYS.checks, cleanChecks(d.checks), true) || !store.set(KEYS.rewards, cleanRewards(d.rewards), true)
        || !store.set(KEYS.history, cleanHistory(d.history), true) || !store.set(GLOBAL_KEYS.catalog, cleanCatalog(d.catalog), true)) { fail(); return; }
    if (d.profile && typeof d.profile === 'object') {
      const k = activeKid();
      k.name = String(d.profile.name || '').trim().slice(0, 30) || k.name; k.cls = String(d.profile.cls || '').trim().slice(0, 10) || k.cls;
      saveKids();
    }
  }
  prizeCatalog = cleanCatalog(store.get(GLOBAL_KEYS.catalog, {}));
  loadKidData(); state.edit = false;
  renderWheelLabels(); render(); toast('Copia ripristinata ✅');
};

/* ---------- rete, installazione, service worker ---------- */
function netStatus() {
  const n = $('net'), on = navigator.onLine;
  n.textContent = on ? 'Online' : 'Offline'; n.className = 'pill ' + (on ? 'pill-ok' : 'pill-off');
}
addEventListener('online', netStatus); addEventListener('offline', netStatus);
function checkBundledImages() {
  const images = Array.from(document.querySelectorAll('img[src]'))
    .filter((img) => /^(?:\.\/)?img\//.test(img.getAttribute('src') || ''));
  let warned = false;
  const report = (img) => {
    img.hidden = true;
    if (warned) return;
    warned = true;
    toast('Alcune immagini non si caricano: estrai e pubblica anche la cartella img accanto a index.html.');
  };
  images.forEach((img) => {
    img.addEventListener('error', () => report(img), { once: true });
    if (img.complete && img.naturalWidth === 0) report(img);
  });
}

let installEvt = null;
const isStandalone = () => (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function showInstallHelp() {
  const secure = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(navigator.userAgent);
  const isMacSafari = /Macintosh|Mac OS X/i.test(navigator.userAgent)
    && /Safari/i.test(navigator.userAgent) && !/Chrome|Chromium/i.test(navigator.userAgent);
  const steps = isIos
    ? ['Apri questa pagina in Safari.', 'Tocca Condividi.', 'Scegli «Aggiungi alla schermata Home» e conferma.']
    : isAndroid
      ? ['Apri questa pagina in Chrome.', 'Tocca il menu ⋮.', 'Scegli «Installa app» oppure «Aggiungi a schermata Home».']
      : isMacSafari
        ? ['Apri la pagina in Safari.', 'Dal menu File scegli «Aggiungi al Dock».', 'Conferma.']
        : ['Apri la pagina in Chrome o Edge.', 'Usa l’icona Installa nella barra degli indirizzi oppure il menu del browser.', 'Conferma l’installazione.'];
  $('install-status').className = 'status ' + (secure ? 'ok' : 'warn');
  $('install-status').textContent = secure
    ? (installEvt ? 'Installazione disponibile: premi «Installa app» nella barra in alto.' : 'Il browser richiede una conferma manuale per installare l’app.')
    : 'Per installazione, fotocamera e uso offline serve HTTPS. Non aprire index.html direttamente dallo ZIP.';
  $('install-steps').innerHTML = steps.map((step) => `<li>${esc(step)}</li>`).join('');
}
if (isStandalone()) $('btn-install').classList.add('hidden');
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); installEvt = e;
  $('btn-install').textContent = '⬇ Installa ora';
  $('btn-install').classList.remove('hidden');
});
$('btn-install').onclick = async () => {
  if (isStandalone()) { $('btn-install').classList.add('hidden'); return; }
  if (!installEvt) { showInstallHelp(); openDialog($('dlg-install')); return; }
  const promptEvent = installEvt; installEvt = null;
  try {
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    $('btn-install').textContent = choice && choice.outcome === 'accepted' ? '✅ Installazione avviata' : '📲 Come installarla';
  } catch (err) {
    $('btn-install').textContent = '📲 Come installarla';
    showInstallHelp(); openDialog($('dlg-install'));
  }
};
addEventListener('appinstalled', () => {
  $('btn-install').classList.add('hidden');
  toast('Zaino Hero installata ✅');
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch(() => {
    toast('PWA non attiva: verifica HTTPS e che lo ZIP sia stato estratto con tutte le cartelle.');
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (had) toast('Nuova versione pronta.', { label: 'Aggiorna', fn: () => location.reload() });
  });
}

/* Se l'app resta aperta a cavallo delle 15:00 / mezzanotte, passa al giorno giusto. */
let lastDefault = state.day;
setInterval(() => { const d = defaultDay(); if (d !== lastDefault) { lastDefault = d; if (!state.edit) { state.day = d; render(); } } }, 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
/* Dopo l'avvio, se la rete lo permette, scarica in background il lettore di copertine così funziona anche offline. */
setTimeout(() => {
  const c = navigator.connection;
  if (!navigator.onLine || (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')))) return;
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((reg) => { if (reg.active) reg.active.postMessage('warm-vendor'); }).catch(() => {});
}, 10000);
renderWheelLabels(); setMuted(muted); netStatus(); render(); checkBundledImages();
