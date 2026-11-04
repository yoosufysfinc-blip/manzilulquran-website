/* =====================================================================
   ManzilulQuran · Hifz Learning App — the learner (v1)
   The six-stage Hifz method for ONE student at a time: learn by ayahs
   (word groups) or by mushaf page (ayah groups).
   Opened by admin.v1.js with HifzLearn.mount(student, route).
   Needs: quran-data.v1.js (SURAHS, PAGE_STARTS, JUZ_STARTS, QuranMeta)
          store.v1.js (HifzStore — per-student storage keys)
   ===================================================================== */
const HifzLearn = (function () {
'use strict';

/* ---------------------------------------------------------------------
   1. Configuration
   --------------------------------------------------------------------- */
// External data dependency (kept separate from the local interface):
// AlQuran Cloud API — serves the Tanzil Uthmani text and Tanzil translations.
const API_BASE = 'https://api.alquran.cloud/v1';
const QURAN_EDITION = 'quran-uthmani';
const MAX_AYAHS = 50;
const PAGE_COUNT = 604;
const FETCH_TIMEOUT = 20000;
// Storage keys belong to the student who is open (see HifzStore.keys); the Quran text cache is shared.
let SID = null, STUDENT = null;
let KEY = HifzStore.keys('none');
const CACHE_MAX = 24;

const TRANSLATIONS = [
  { id: 'ml.abdulhameed', lang: 'ml', name: 'Malayalam', short: 'Abdul Hameed & Kunhi Mohammed', by: 'Cheriyamundam Abdul Hameed & Kunhi Mohammed Parappoor' },
  { id: 'ml.karakunnu', lang: 'ml', name: 'Malayalam', short: 'Karakunnu & Elayavoor', by: 'Muhammad Karakunnu & Vanidas Elayavoor' },
  { id: 'en.sahih', lang: 'en', name: 'English', short: 'Saheeh International', by: 'Saheeh International' },
  { id: 'none', lang: '', name: 'No translation', short: '', by: '' }
];
const trInfo = id => TRANSLATIONS.find(t => t.id === id) || TRANSLATIONS[0];

const DEFAULTS = {
  uiLang: 'ml',
  groupSize: 3, followWaqf: false, joinMethod: 'cumulative',
  groupReps: 5, comboReps: 5, ayahReps: 10, joinReps: 3,
  pageSplit: 3, pageReps: 5,
  recallMode: 'full', translation: 'ml.abdulhameed',
  arSize: 'l', quranFont: 'amiri', englishHelp: true, trAlways: true,
  autoScroll: true, vibrate: true, reduceMotion: false,
  startMode: 'ayah'
};
const PALETTE = ['Green', 'Gold', 'Blue', 'Lavender', 'Rose', 'Teal', 'Peach', 'Slate'];

const STAGE_TXT = {
  ayah: [
    ['Read & understand', 'Read', 'വായിച്ച് മനസ്സിലാക്കുക'],
    ['Divide into groups', 'Divide', 'ഭാഗങ്ങളായി തിരിക്കുക'],
    ['Memorize each group', 'Memorize', 'ഓരോ ഭാഗവും മനഃപാഠമാക്കുക'],
    ['Join the groups', 'Join', 'ഭാഗങ്ങൾ ചേർത്ത് ഓതുക'],
    ['Repeat the full ayah', 'Full ayah', 'മുഴുവൻ ആയത്ത് ആവർത്തിക്കുക'],
    ['Hide & recall', 'Recall', 'മറച്ച് ഓർത്ത് ഓതുക']],
  page: [
    ['Read & understand', 'Read', 'വായിച്ച് മനസ്സിലാക്കുക'],
    ['Divide into parts', 'Divide', 'ഭാഗങ്ങളായി തിരിക്കുക'],
    ['Memorize each part', 'Memorize', 'ഓരോ ഭാഗവും മനഃപാഠമാക്കുക'],
    ['Join the parts', 'Join', 'ഭാഗങ്ങൾ ചേർത്ത് ഓതുക'],
    ['Repeat the full page', 'Full page', 'മുഴുവൻ പേജ് ആവർത്തിക്കുക'],
    ['Hide & recall', 'Recall', 'മറച്ച് ഓർത്ത് ഓതുക']]
};

/* ---------------------------------------------------------------------
   2. Small utilities
   --------------------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const toAr = n => String(n).replace(/\d/g, d => AR_DIGITS[+d]);
const clampInt = (v, lo, hi, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const plural = (n, one, many) => (n === 1 ? one : (many || one + 's'));
const range = (a, b) => { const out = []; for (let k = a; k <= b; k++) out.push(k); return out; };
const rangeLabel = (f, t) => (f === t ? `Ayah ${f}` : `Ayahs ${f}–${t}`);
const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const checkIcon = () => '<svg class="ic check-draw" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
// Keep an ayah-end marker on the same line as the ayah's last word (a no-break space alone is not enough
// next to an inline-block, so the pair is wrapped in a no-wrap span).
const glueEnd = (parts, endHTML) => (parts.length
  ? (parts.length > 1 ? parts.slice(0, -1).join(' ') + ' ' : '') + `<span class="nb">${parts[parts.length - 1]}&nbsp;${endHTML}</span>`
  : endHTML);
const numArr = v => (Array.isArray(v) ? v.map(x => clampInt(x, 0, 999, 0)) : []);
const boolArr = v => (Array.isArray(v) ? v.map(Boolean) : []);
const isCoarse = () => window.matchMedia && matchMedia('(pointer: coarse)').matches;

const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
};

const surahOf = QuranMeta.surahOf;

let S = Object.assign({}, DEFAULTS);           // settings
let L = null;                                   // the active lesson
const H = { mode: 'ayah', surah: 1, from: 1, to: 7, page: 1, link: null }; // start-form state
const P = { filter: 'all', reverse: false, forPage: false };                 // surah picker state

const reduceMotion = () => S.reduceMotion || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const scrollBehavior = () => (reduceMotion() ? 'auto' : 'smooth');
const topBarHeight = () => { const t = $('#topbar'); return t ? t.getBoundingClientRect().height : 64; };

/* ---------- language: Malayalam + English, or simple English only ---------- */
const EN = () => S.uiLang === 'en';
// a Malayalam line with optional English help — or English only
const bi = (ml, en) => (EN() ? en : `<span lang="ml">${ml}</span>${S.englishHelp && en ? `<span class="bi-en">${en}</span>` : ''}`);
const mlSub = t => (EN() ? '' : `<span class="ml-sub" lang="ml">${t}</span>`);
const mlTag = t => (EN() ? '' : ` <span lang="ml">${t}</span>`);
function instr(ml, en) {
  if (EN()) return `<div class="instr"><p class="lead">${en}</p></div>`;
  return `<div class="instr"><p class="ml" lang="ml">${ml}</p>${S.englishHelp && en ? `<p class="en">${en}</p>` : ''}</div>`;
}
function okNote(ml, en, tone, icon) {
  const body = EN() ? `<p class="n-ml">${en}</p>` : `<p class="n-ml" lang="ml">${ml}</p>${S.englishHelp && en ? `<p class="n-en">${en}</p>` : ''}`;
  return `<div class="note-ok${tone ? ' ' + tone : ''}" role="status"><span class="ic-wrap">${icon ? ic(icon) : checkIcon()}</span><div>${body}</div></div>`;
}
function maskHTML(ml, en, extra) {
  const body = EN() ? `<p class="m-ml">${en}</p>` : `<p class="m-ml" lang="ml">${ml}</p>${S.englishHelp ? `<p class="m-en">${en}</p>` : ''}`;
  return `<div class="mask"><span class="m-ic">${ic('eye-off')}</span>${body}${extra || ''}</div>`;
}

let liveTimer;
function announce(msg) {
  const el = $('#live'); if (!el) return;
  el.textContent = ''; clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { el.textContent = msg; }, 40);
}
let toastTimer;
function toast(en, ml, icon) {
  const t = $('#toast'); if (!t) return;
  t.innerHTML = `${ic(icon || 'info')}<span>${esc(en)}${ml && !EN() ? `<span lang="ml">${esc(ml)}</span>` : ''}</span>`;
  t.classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

/* ---------------------------------------------------------------------
   3. Arabic text processing (never alters letters — only splits on spaces)
   --------------------------------------------------------------------- */
const LETTER = /[ؠ-يٮٯٱ-ۓەۮۯۺ-ۼۿ]/;
const PAUSE_TOKEN = /[ۖ-ۜ]/;   // stand-alone waqf (pause) sign separated by a space
const PAUSE_TAIL = /[ۖ-ۛ]$/;    // waqf sign attached to the end of a word

// Split an ayah into words. A token without any Arabic letter (a pause sign,
// a sajdah sign, the rub‘ al-hizb sign …) stays attached to its neighbouring word,
// so it never counts as a "word" and never starts a group by itself.
function tokenize(text) {
  const toks = String(text).replace(/[﻿​]/g, '').trim().split(/\s+/).filter(Boolean);
  const words = []; let lead = '';
  for (const t of toks) {
    if (LETTER.test(t)) { words.push({ t: lead ? lead + ' ' + t : t, pause: PAUSE_TAIL.test(t) }); lead = ''; }
    else if (words.length) { const w = words[words.length - 1]; w.t += ' ' + t; if (PAUSE_TOKEN.test(t)) w.pause = true; }
    else lead = lead ? lead + ' ' + t : t;
  }
  if (lead) words.push({ t: lead, pause: false });
  return words;
}

// The API prepends the Basmalah to ayah 1 of surahs 2–114 (except 9).
// It is detected by comparing the first four words without diacritics, then shown separately.
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const normAr = s => String(s).replace(AR_MARKS, '').replace(/[آأإٱ]/g, 'ا');
const BASMALAH = ['بسم', 'الله', 'الرحمن', 'الرحيم'];
function splitBasmalah(text) {
  const toks = String(text).replace(/[﻿​]/g, '').trim().split(/\s+/);
  if (toks.length > 4 && BASMALAH.every((w, i) => normAr(toks[i]) === w)) {
    return { basmalah: toks.slice(0, 4).join(' '), rest: toks.slice(4).join(' ') };
  }
  return { basmalah: null, rest: text };
}

// Partition one ayah's words into groups of `size` (optionally ending a group at a pause sign).
function partition(words, size, followWaqf) {
  const groups = []; let cur = [];
  words.forEach((w, i) => {
    cur.push(i);
    if (cur.length >= size || (followWaqf && w.pause && i < words.length - 1)) { groups.push(cur); cur = []; }
  });
  if (cur.length) groups.push(cur);
  return groups;
}

// Joining steps: cumulative (1+2, 1–3, 1–4 …) or pairs (1+2, 2+3, 3+4 …).
function comboSteps(n, method) {
  const steps = [];
  for (let k = 1; k < n; k++) steps.push(method === 'pairs' ? [k - 1, k] : [0, k]);
  return steps;
}

/* ---------------------------------------------------------------------
   4. Mushaf pages (Madani mushaf, 604 pages — verified page table)
   --------------------------------------------------------------------- */
// (shared helpers live in quran-data.v1.js)
const { gid, pageAyahs, pageSegments, pageOf, juzOf } = QuranMeta;
function pageSummary(p) {
  const segs = pageSegments(p);
  return {
    segs, juz: juzOf(segs[0].s, segs[0].f),
    count: segs.reduce((n, sg) => n + sg.t - sg.f + 1, 0),
    label: segs.map(sg => `${surahOf(sg.s).en} ${sg.f === sg.t ? sg.f : sg.f + '–' + sg.t}`).join(' · '),
    ar: segs.map(sg => surahOf(sg.s).ar).join(' · ')
  };
}
// the same label as HTML, each "Surah a–b" kept on one line
const pageLabelHTML = ps => ps.segs.map(sg => `<span class="nb">${esc(surahOf(sg.s).en)} ${sg.f === sg.t ? sg.f : sg.f + '–' + sg.t}</span>`).join(' · ');

/* ---------------------------------------------------------------------
   5. Data layer (AlQuran Cloud)
   --------------------------------------------------------------------- */
class DataError extends Error { constructor(kind, status) { super(kind); this.kind = kind; this.status = status; } }
const memCache = new Map();
// Recently loaded ranges are kept, exactly as received, in this browser (small LRU list).
const textCache = {
  read() { const c = store.get(KEY.cache); return Array.isArray(c) ? c : []; },
  get(key, from, to) {
    const hit = this.read().find(e => e && e.k === key && e.t && typeof e.t === 'object');
    if (!hit) return null;
    const texts = new Map();
    for (let n = from; n <= to; n++) { const v = hit.t[n]; if (typeof v !== 'string' || !v.trim()) return null; texts.set(n, v); }
    return { texts, edition: null, cached: true };
  },
  put(key, texts) {
    const t = {}; texts.forEach((v, n) => { t[n] = v; });
    const list = this.read().filter(e => e && e.k !== key);
    list.unshift({ k: key, t, at: Date.now() });
    let ok = store.set(KEY.cache, list.slice(0, CACHE_MAX));
    for (let keep = CACHE_MAX - 2; !ok && keep >= 0; keep -= 2) ok = store.set(KEY.cache, list.slice(0, keep + 1));
  }
};

async function fetchEdition(surah, from, to, edition) {
  const key = `${edition}|${surah}|${from}-${to}`;
  if (memCache.has(key)) return memCache.get(key);
  try { return await fetchNetwork(key, surah, from, to, edition); }
  catch (err) {
    const c = textCache.get(key, from, to);
    if (c) { memCache.set(key, c); return c; }
    throw err;
  }
}
async function fetchNetwork(key, surah, from, to, edition) {
  const url = `${API_BASE}/surah/${surah}/${encodeURIComponent(edition)}?offset=${from - 1}&limit=${to - from + 1}`;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, FETCH_TIMEOUT);
  let res;
  try { res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined); }
  catch (e) { throw new DataError(e && e.name === 'AbortError' ? 'timeout' : (navigator.onLine === false ? 'offline' : 'network')); }
  finally { clearTimeout(timer); }
  if (!res.ok) throw new DataError('http', res.status);
  let json;
  try { json = await res.json(); } catch (e) { throw new DataError('format'); }
  const data = json && json.data;
  if (!data || !Array.isArray(data.ayahs) || +data.number !== surah) throw new DataError('format');
  const texts = new Map();
  for (const a of data.ayahs) {
    const n = +a.numberInSurah;
    if (n >= from && n <= to && typeof a.text === 'string' && a.text.trim()) texts.set(n, a.text);
  }
  // Never show a partial lesson: every requested ayah must be present.
  for (let n = from; n <= to; n++) if (!texts.has(n)) throw new DataError('incomplete');
  const out = { texts, edition: data.edition || null };
  memCache.set(key, out);
  textCache.put(key, texts);
  return out;
}

function errText(err) {
  const k = err && err.kind;
  if (k === 'offline') return { icon: 'wifi-off', en: 'You seem to be offline. Connect to the internet and try again.', ml: 'ഇന്റർനെറ്റ് ബന്ധം ഇല്ലെന്ന് തോന്നുന്നു. ബന്ധിപ്പിച്ച ശേഷം വീണ്ടും ശ്രമിക്കുക.' };
  if (k === 'timeout') return { icon: 'wifi-off', en: 'The Quran text server is too slow right now. Please try again.', ml: 'സെർവർ പ്രതികരിക്കാൻ വൈകുന്നു. വീണ്ടും ശ്രമിക്കുക.' };
  if (k === 'http') return { icon: 'info', en: `The Quran text server gave an error (HTTP ${err.status}). Please try again soon.`, ml: 'സെർവറിൽ ഒരു പിശക് സംഭവിച്ചു. അൽപസമയത്തിന് ശേഷം വീണ്ടും ശ്രമിക്കുക.' };
  if (k === 'format' || k === 'incomplete') return { icon: 'info', en: 'The text did not arrive complete, so it is not shown. Please try again.', ml: 'ലഭിച്ച വാചകം പൂർണ്ണമല്ലാത്തതിനാൽ കാണിക്കുന്നില്ല. വീണ്ടും ശ്രമിക്കുക.' };
  return { icon: 'wifi-off', en: 'Could not reach the Quran text server. Check your internet and try again.', ml: 'ഖുർആൻ വാചകം ലോഡ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ഇന്റർനെറ്റ് ബന്ധം പരിശോധിച്ച് വീണ്ടും ശ്രമിക്കുക.' };
}

/* ---------------------------------------------------------------------
   6. Audio — integration point for the academy's own audio connection
   ---------------------------------------------------------------------
   No audio API is connected and nothing is generated or simulated.
   To integrate later, define before this script runs (or any time after):
     window.MQAudio = { play(request) { … } }
   request = { kind: 'ayah' | 'group' | 'range' | 'page' | 'part', surah, ayah, words: [first, last], ayahs: [[surah, ayah], …] }
   Until then, every audio button shows a "Coming soon" message.            */
const AudioBridge = {
  provider() { return (window.MQAudio && typeof window.MQAudio.play === 'function') ? window.MQAudio : null; },
  play(request) {
    const p = this.provider();
    if (p) { try { p.play(request); return; } catch (e) { console.warn('Audio provider error', e); } }
    toast('Audio recitation is coming soon.', 'ഓഡിയോ പാരായണം ഉടൻ ലഭ്യമാകും.', 'volume');
  }
};

/* ---------------------------------------------------------------------
   7. Settings
   --------------------------------------------------------------------- */
function loadSettings() {
  const s = Object.assign({}, DEFAULTS, store.get(KEY.settings) || {});
  s.uiLang = s.uiLang === 'en' ? 'en' : 'ml';
  s.groupSize = [2, 3, 4, 5, 6].includes(+s.groupSize) ? +s.groupSize : DEFAULTS.groupSize;
  s.pageSplit = [3, 4, 5].includes(+s.pageSplit) ? +s.pageSplit : DEFAULTS.pageSplit;
  ['groupReps', 'comboReps', 'joinReps', 'pageReps'].forEach(k => { s[k] = clampInt(s[k], 1, 50, DEFAULTS[k]); });
  s.ayahReps = clampInt(s.ayahReps, 1, 99, DEFAULTS.ayahReps);
  if (!['cumulative', 'pairs'].includes(s.joinMethod)) s.joinMethod = DEFAULTS.joinMethod;
  if (!['full', 'first', 'groups'].includes(s.recallMode)) s.recallMode = DEFAULTS.recallMode;
  if (!TRANSLATIONS.some(t => t.id === s.translation)) s.translation = DEFAULTS.translation;
  if (!['s', 'm', 'l', 'xl'].includes(s.arSize)) s.arSize = DEFAULTS.arSize;
  if (!['amiri', 'naskh'].includes(s.quranFont)) s.quranFont = DEFAULTS.quranFont;
  if (!['ayah', 'page'].includes(s.startMode)) s.startMode = DEFAULTS.startMode;
  ['followWaqf', 'englishHelp', 'trAlways', 'autoScroll', 'vibrate', 'reduceMotion'].forEach(k => { s[k] = !!s[k]; });
  return s;
}
const saveSettings = () => store.set(KEY.settings, S);
function applyDisplay() {
  const r = document.documentElement;
  r.setAttribute('data-arsize', S.arSize);
  r.setAttribute('data-qfont', S.quranFont);
  r.classList.toggle('rm', !!S.reduceMotion);
  r.classList.toggle('lang-en', EN());
}

/* ---------------------------------------------------------------------
   8. Lesson model — a lesson holds "units": ayahs, or one page
   --------------------------------------------------------------------- */
const isPage = a => !!a && a.kind === 'page';
const NOUN = a => (isPage(a)
  ? { u: 'page', U: 'Page', g: 'part', G: 'Part', gs: 'parts', Gs: 'Parts' }
  : { u: 'ayah', U: 'Ayah', g: 'group', G: 'Group', gs: 'groups', Gs: 'Groups' });
const stageOf = (a, n) => { const t = STAGE_TXT[isPage(a) ? 'page' : 'ayah'][n - 1]; return { n, en: t[0], short: t[1], ml: t[2] }; };

function makeLesson(ref, mode) {
  const l = { v: 2, kind: ref.kind === 'page' ? 'page' : 'ayah', mode: mode === 'revise' ? 'revise' : 'learn', trEd: S.translation, basmalah: null,
    ayahs: [], active: 0, join: { count: 0, hidden: true }, created: Date.now(), updated: Date.now(), status: 'loading', error: null };
  if (l.kind === 'page') l.page = ref.page; else Object.assign(l, { surah: ref.surah, from: ref.from, to: ref.to });
  return l;
}
function newAyah(n, text) {
  return { kind: 'ayah', n, text, tr: '', trSt: 'none', sel: true, hidden: false, stage: 1, d1: false, d2: false,
    size: null, pkey: '', skey: '', g: 0, gc: [], gh: [], cs: 0, cc: [], fc: 0, ft: null,
    peek: 0, hints: 0, revealed: false, result: null, weak: [], note: '', showTr: false };
}
function newPage(p) { return Object.assign(newAyah(p, ''), { kind: 'page', items: [], split: null, colors: [], brush: 0 }); }
function resetAyahProgress(a) {
  Object.assign(a, { hidden: false, stage: 1, d1: false, d2: false, pkey: '', skey: '', g: 0, gc: [], gh: [], cs: 0, cc: [], fc: 0,
    peek: 0, hints: 0, revealed: false, result: null, weak: [], showTr: false });
}

// Page parts: groups of 3/4/5 ayahs that never run across two surahs, or hand-painted colors.
function autoParts(items, size) {
  const parts = []; let cur = [];
  items.forEach((it, k) => { if (cur.length && (cur.length >= size || it.a === 1)) { parts.push(cur); cur = []; } cur.push(k); });
  if (cur.length) parts.push(cur);
  return parts;
}
function pagePartition(a) {
  const split = a.split || S.pageSplit;
  if (split === 'manual' && a.colors.length === a.items.length) {
    const parts = [], pcols = [];
    a.colors.forEach((c, k) => { if (k && c === a.colors[k - 1]) parts[parts.length - 1].push(k); else { parts.push([k]); pcols.push(c); } });
    return { parts, pcols };
  }
  const parts = autoParts(a.items, split === 'manual' ? S.pageSplit : split);
  return { parts, pcols: parts.map((_, j) => j % 4) };
}
const partitionKey = parts => parts.map(p => p.length).join('.');

// Derived data per unit (words, groups, steps) — recomputed only when needed.
const DER = new WeakMap();
const sizeOf = a => a.size || S.groupSize;
function syncCounters(a, d) {
  if (a.pkey !== d.pkey || a.gc.length !== d.groups.length) {
    a.pkey = d.pkey; a.g = 0; a.gc = d.groups.map(() => 0); a.gh = d.groups.map(() => false); a.weak = []; a.skey = '';
  }
  if (a.gh.length !== d.groups.length) a.gh = d.groups.map(() => false);
  if (a.skey !== d.skey || a.cc.length !== d.steps.length) { a.skey = d.skey; a.cs = 0; a.cc = d.steps.map(() => 0); }
  if (a.g >= d.groups.length) a.g = 0;
  if (a.cs >= Math.max(1, d.steps.length)) a.cs = 0;
}
function D(a) {
  if (isPage(a)) return Dpage(a);
  const pkey = sizeOf(a) + '|' + (S.followWaqf ? 'w' : '-');
  let d = DER.get(a);
  if (!d || d.text !== a.text || d.pkey !== pkey || d.skey !== S.joinMethod) {
    const sameText = d && d.text === a.text;
    const words = sameText ? d.words : tokenize(a.text);
    const groups = sameText && d.pkey === pkey ? d.groups : partition(words, sizeOf(a), S.followWaqf);
    d = { text: a.text, pkey, skey: S.joinMethod, words, groups, steps: comboSteps(groups.length, S.joinMethod), starts: new Set(groups.map(g => g[0])) };
    DER.set(a, d);
  }
  syncCounters(a, d);
  return d;
}
function Dpage(a) {
  const { parts, pcols } = pagePartition(a);
  const pkey = 'p|' + partitionKey(parts), sig = a.n + '|' + a.items.length;
  let d = DER.get(a);
  if (!d || d.sig !== sig) {
    const words = [], itemWords = [];
    a.items.forEach((it, k) => { itemWords[k] = []; tokenize(it.text).forEach(w => { w.ai = k; itemWords[k].push(words.length); words.push(w); }); });
    d = { sig, words, itemWords };
    DER.set(a, d);
  }
  if (d.pkey !== pkey || d.skey !== S.joinMethod) {
    d.pkey = pkey; d.skey = S.joinMethod; d.parts = parts;
    d.groups = parts.map(p => p.reduce((acc, k) => acc.concat(d.itemWords[k]), []));
    d.steps = comboSteps(parts.length, S.joinMethod);
    d.starts = new Set(d.groups.map(g => g[0]));
    d.partOf = []; parts.forEach((p, gi) => p.forEach(k => { d.partOf[k] = gi; }));
  }
  d.pcols = pcols;
  syncCounters(a, d);
  return d;
}
const colorOf = (a, d, gi) => (isPage(a) ? d.pcols[gi] : gi % 4) + 1;
// "Ayahs 1–3" on a page with one surah; "Al-Falaq 1–3" when the page has more than one surah.
function partRef(a, d, gis) {
  const ks = gis.reduce((acc, gi) => acc.concat(d.parts[gi]), []);
  const f = a.items[ks[0]], t = a.items[ks[ks.length - 1]];
  const multi = a.items[0].s !== a.items[a.items.length - 1].s;
  if (f.s !== t.s) return `${surahOf(f.s).en} ${f.a} – ${surahOf(t.s).en} ${t.a}`;
  if (multi) return `${surahOf(f.s).en} ${f.a === t.a ? f.a : f.a + '–' + t.a}`;
  return f.a === t.a ? `Ayah ${f.a}` : `Ayahs ${f.a}–${t.a}`;
}

const fullTarget = a => a.ft || (isPage(a) ? S.pageReps : S.ayahReps);
const groupsDone = a => { const d = D(a); return d.groups.every((_, i) => a.gc[i] >= S.groupReps); };
const stepsDone = a => { const d = D(a); return d.steps.every((_, i) => a.cc[i] >= S.comboReps); };
const fullDone = a => a.fc >= fullTarget(a);
const hasGroupProgress = a => a.gc.some(c => c > 0) || a.cc.some(c => c > 0);
const isMastered = a => a.result === 'mastered';
function stageDone(a, s) {
  switch (s) {
    case 1: return a.d1;
    case 2: return a.d2;
    case 3: return groupsDone(a);
    case 4: return D(a).steps.length ? stepsDone(a) : groupsDone(a);
    case 5: return fullDone(a);
    case 6: return a.result !== null;
    default: return false;
  }
}
function firstOpenGroup(a, from) {
  const d = D(a), n = d.groups.length;
  for (let k = 0; k < n; k++) { const i = ((from || 0) + k) % n; if (a.gc[i] < S.groupReps) return i; }
  return -1;
}
const firstOpenStep = a => D(a).steps.findIndex((_, i) => a.cc[i] < S.comboReps);
function wordVisible(a, d, wi) {
  if (!a.hidden) return true;
  if (wi < a.peek) return true;
  if (S.recallMode === 'first' && wi === 0) return true;
  if (S.recallMode === 'groups' && d.starts.has(wi)) return true;
  return false;
}
function statusOf(a) {
  if (a.result === 'mastered') return { cls: 'gold', icon: 'check', en: 'Memorized' };
  if (a.result === 'assisted') return { cls: 'blue', icon: 'hand', en: 'Almost there' };
  if (a.result === 'revise') return { cls: 'amber', icon: 'repeat', en: 'Needs revision' };
  return { cls: '', icon: '', en: `Stage ${a.stage} of 6` };
}
function progressInfo(a) {
  const d = D(a), N = NOUN(a);
  switch (a.stage) {
    case 1: return 'Reading';
    case 2: return `${d.groups.length} ${plural(d.groups.length, N.g)}`;
    case 3: return `${N.G} ${a.g + 1}/${d.groups.length} · ${a.gc[a.g] || 0}/${S.groupReps}`;
    case 4: {
      if (!d.steps.length) return 'Nothing to join';
      const [r0, r1] = d.steps[a.cs];
      return `${N.Gs} ${r0 + 1}–${r1 + 1} · ${a.cc[a.cs] || 0}/${S.comboReps}`;
    }
    case 5: return `Full ${N.u} · ${a.fc}/${fullTarget(a)}`;
    default:
      return a.result === 'mastered' ? 'Memorized' : a.result === 'assisted' ? 'Almost there'
        : a.result === 'revise' ? 'Needs revision' : a.revealed ? 'Self-check' : 'Hidden recall';
  }
}

/* ---------------------------------------------------------------------
   9. Persistence (this browser only)
   --------------------------------------------------------------------- */
let saveTimer, saveWarned = false;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function serialize(l) {
  const o = { v: 2, kind: l.kind, mode: l.mode, trEd: l.trEd, basmalah: l.basmalah, active: l.active, join: l.join, created: l.created, updated: l.updated };
  if (l.kind === 'page') o.page = l.page; else Object.assign(o, { surah: l.surah, from: l.from, to: l.to });
  o.ayahs = l.ayahs.map(a => {
    const s = { n: a.n, text: a.text, tr: a.tr, trSt: a.trSt === 'loading' ? 'error' : a.trSt, sel: a.sel, hidden: a.hidden,
      stage: a.stage, d1: a.d1, d2: a.d2, size: a.size, pkey: a.pkey, skey: a.skey, g: a.g, gc: a.gc, gh: a.gh, cs: a.cs, cc: a.cc,
      fc: a.fc, ft: a.ft, peek: a.peek, hints: a.hints, revealed: a.revealed, result: a.result, weak: a.weak, note: a.note };
    if (isPage(a)) Object.assign(s, { kind: 'page', split: a.split, colors: a.colors, brush: a.brush,
      items: a.items.map(x => ({ s: x.s, a: x.a, text: x.text, basmalah: x.basmalah, tr: x.tr })) });
    return s;
  });
  return o;
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!L || L.status !== 'ready') return;
  L.updated = Date.now();
  const ok = store.set(KEY.lesson, serialize(L));
  upsertHistory();
  if (!ok && !saveWarned) { saveWarned = true; toast('Progress cannot be saved in this browser (storage is blocked or full).'); }
}
function restoreLesson(o) {
  try {
    if (!o || (o.v !== 1 && o.v !== 2) || !Array.isArray(o.ayahs)) return null;
    let l;
    if (o.kind === 'page') {
      const p = +o.page;
      if (!(p >= 1 && p <= PAGE_COUNT) || o.ayahs.length !== 1) return null;
      l = makeLesson({ kind: 'page', page: p }, o.mode);
    } else {
      const su = surahOf(+o.surah); if (!su) return null;
      const from = +o.from, to = +o.to;
      if (!(from >= 1 && to <= su.ayahs && from <= to) || o.ayahs.length !== to - from + 1) return null;
      l = makeLesson({ kind: 'ayah', surah: su.n, from, to }, o.mode);
    }
    Object.assign(l, {
      trEd: TRANSLATIONS.some(t => t.id === o.trEd) ? o.trEd : S.translation,
      basmalah: typeof o.basmalah === 'string' ? o.basmalah : null,
      active: clampInt(o.active, 0, Math.max(0, o.ayahs.length - 1), 0),
      join: { count: clampInt(o.join && o.join.count, 0, 999, 0), hidden: !(o.join && o.join.hidden === false) },
      created: +o.created || Date.now(), updated: +o.updated || Date.now(), status: 'ready'
    });
    o.ayahs.forEach((s, k) => {
      if (!s) throw new Error('bad unit');
      let a;
      if (l.kind === 'page') {
        const exp = pageAyahs(l.page);
        if (!Array.isArray(s.items) || s.items.length !== exp.length) throw new Error('bad page');
        a = newPage(l.page);
        a.items = s.items.map((x, j) => {
          if (!x || +x.s !== exp[j][0] || +x.a !== exp[j][1] || typeof x.text !== 'string' || !x.text.trim()) throw new Error('bad item');
          return { s: +x.s, a: +x.a, text: x.text, basmalah: typeof x.basmalah === 'string' ? x.basmalah : null, tr: typeof x.tr === 'string' ? x.tr : '' };
        });
        a.split = [3, 4, 5].includes(+s.split) ? +s.split : (s.split === 'manual' ? 'manual' : null);
        a.colors = Array.isArray(s.colors) && s.colors.length === a.items.length ? s.colors.map(c => clampInt(c, 0, 7, 0)) : [];
        a.brush = clampInt(s.brush, 0, 7, 0);
        a.trSt = ['ok', 'error', 'none'].includes(s.trSt) ? s.trSt : 'error';
      } else {
        if (+s.n !== l.from + k || typeof s.text !== 'string' || !s.text.trim()) throw new Error('bad ayah');
        a = newAyah(+s.n, s.text);
        a.tr = typeof s.tr === 'string' ? s.tr : '';
        a.trSt = ['ok', 'error', 'none'].includes(s.trSt) ? s.trSt : (a.tr ? 'ok' : 'error');
        a.size = [2, 3, 4, 5, 6].includes(+s.size) ? +s.size : null;
      }
      a.sel = s.sel !== false; a.hidden = !!s.hidden; a.stage = clampInt(s.stage, 1, 6, 1); a.d1 = !!s.d1; a.d2 = !!s.d2;
      a.pkey = String(s.pkey || ''); a.skey = String(s.skey || '');
      a.g = clampInt(s.g, 0, 999, 0); a.gc = numArr(s.gc); a.gh = boolArr(s.gh); a.cs = clampInt(s.cs, 0, 999, 0); a.cc = numArr(s.cc);
      a.fc = clampInt(s.fc, 0, 999, 0); a.ft = s.ft ? clampInt(s.ft, 1, 99, null) : null;
      a.peek = clampInt(s.peek, 0, 99999, 0); a.hints = clampInt(s.hints, 0, 999, 0); a.revealed = !!s.revealed;
      a.result = ['mastered', 'assisted', 'revise'].includes(s.result) ? s.result : null;
      a.weak = numArr(s.weak); a.note = typeof s.note === 'string' ? s.note.slice(0, 600) : '';
      l.ayahs.push(a);
    });
    return l;
  } catch (e) { return null; }
}
const savedLesson = () => restoreLesson(store.get(KEY.lesson));
const lessonStarted = l => !!l && l.ayahs.some(a => a.stage > 1 || a.result || a.fc || a.gc.some(Boolean) || a.note);
const lessonComplete = l => !!l && l.ayahs.length > 0 && l.ayahs.every(a => a.result === 'mastered');
const lessonInProgress = l => lessonStarted(l) && !lessonComplete(l);
const refOf = l => (l.kind === 'page' ? { kind: 'page', page: l.page } : { kind: 'ayah', surah: l.surah, from: l.from, to: l.to });
const sameRange = (a, b) => !!a && !!b && (a.kind || 'ayah') === (b.kind || 'ayah') &&
  (a.kind === 'page' ? a.page === b.page : a.surah === b.surah && a.from === b.from && a.to === b.to);

const histKey = r => (r.kind === 'page' ? `p${r.page}` : `a${r.surah}:${r.from}-${r.to}`);
const entryRef = e => (e.k === 'p' ? { kind: 'page', page: e.p } : { kind: 'ayah', surah: e.s, from: e.f, to: e.t });
const entryValid = e => !!e && (e.k === 'p' ? e.p >= 1 && e.p <= PAGE_COUNT : !!surahOf(e.s));
function upsertHistory() {
  if (!L || L.status !== 'ready') return;
  const key = histKey(refOf(L));
  const h = (store.get(KEY.history) || []).filter(e => entryValid(e) && histKey(entryRef(e)) !== key);
  const mastered = L.ayahs.filter(isMastered).length;
  if (lessonStarted(L) || mastered) {
    h.unshift(L.kind === 'page' ? { k: 'p', p: L.page, m: mastered, n: 1, at: Date.now() }
      : { k: 'a', s: L.surah, f: L.from, t: L.to, m: mastered, n: L.ayahs.length, at: Date.now() });
  }
  store.set(KEY.history, h.slice(0, 10));
}
const history10 = () => (store.get(KEY.history) || []).filter(entryValid);
// Most students go forward (page 1 → 2 …); many start from the end of the mushaf (604 → 603 …).
// The direction is read from the page lesson studied just before this one.
function nextPageOf(p) {
  const prev = history10().find(e => e.k === 'p' && e.p !== p);
  const n = p + (prev && prev.p === p + 1 ? -1 : 1);
  return n >= 1 && n <= PAGE_COUNT ? n : null;
}
function refTitle(r) {
  if (r.kind === 'page') return `Page ${r.page} · ${pageSummary(r.page).label}`;
  return `${surahOf(r.surah).en} · ${rangeLabel(r.from, r.to)}`;
}
function relTime(t) {
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/* ---------------------------------------------------------------------
   10. Views & navigation
   --------------------------------------------------------------------- */
// Links: #student=<id>  ·  #student=<id>&page=N  ·  #student=<id>&lesson=S:F-T
const homeHash = () => `#student=${encodeURIComponent(SID || '')}`;
const lessonHash = r => homeHash() + (r.kind === 'page' ? `&page=${r.page}` : `&lesson=${r.surah}:${r.from}-${r.to}`);
function parseLink(params) {
  const q = params || new URLSearchParams((location.hash || '').replace(/^#/, ''));
  const pg = q.get('page');
  if (pg != null) { const p = /^\d{1,3}$/.test(pg) ? +pg : 0; return p >= 1 && p <= PAGE_COUNT ? { kind: 'page', page: p } : null; }
  const m = /^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(q.get('lesson') || '');
  if (!m) return null;
  const s = +m[1], f = +m[2], t = m[3] ? +m[3] : f, su = surahOf(s);
  if (!su || f < 1 || t > su.ayahs || f > t || t - f + 1 > MAX_AYAHS) return null;
  return { kind: 'ayah', surah: s, from: f, to: t };
}
function showView(v, opts) {
  const o = opts || {};
  const t = $('#toast'); if (t) t.classList.remove('show');
  $('#homeView').hidden = v !== 'home';
  $('#lessonView').hidden = v !== 'lesson';
  $('#statusChip').hidden = true; $('#topbar').classList.remove('has-status');
  if (o.push) {
    try {
      const base = location.href.split('#')[0];
      history.pushState({ v, sid: SID }, '', base + (v === 'lesson' && L ? lessonHash(refOf(L)) : homeHash()));
    } catch (e) { /* history API unavailable (e.g. sandboxed preview) */ }
  }
  window.scrollTo({ top: 0, behavior: 'auto' });
}
const baseTitle = () => `${STUDENT ? STUDENT.name + ' · ' : ''}Hifz Learning App · ManzilulQuran`;
// After a lesson, the start form offers what comes next (same mode; the next page or ayahs once it is done).
function syncStartForm() {
  if (!L || L.status !== 'ready') return;
  H.mode = L.kind;
  const nx = lessonComplete(L) ? nextRefOf(L) : null;
  if (!nx) return;
  if (nx.kind === 'page') H.page = nx.page; else { H.surah = nx.surah; H.from = nx.from; H.to = nx.to; }
}
function goHome(opts) {
  saveNow();
  syncStartForm();
  document.title = baseTitle();
  showView('home', { push: !opts || opts.push !== false });
  renderHome();
}

/* ---------------------------------------------------------------------
   11. Home view
   --------------------------------------------------------------------- */
function initHomeState() {
  H.mode = S.startMode;
  const hist = history10();
  const lastA = hist.find(e => e.k !== 'p'), lastP = hist.find(e => e.k === 'p');
  const su = lastA && surahOf(lastA.s);
  if (su && lastA.t < su.ayahs) {
    const len = Math.max(1, lastA.t - lastA.f + 1);
    H.surah = su.n; H.from = lastA.t + 1; H.to = Math.min(su.ayahs, lastA.t + len);
  } else if (!lastA && STUDENT && STUDENT.start) {
    const ss = surahOf(STUDENT.start.surah) || surahOf(1), f = Math.min(ss.ayahs, Math.max(1, STUDENT.start.from || 1));
    H.surah = ss.n; H.from = f; H.to = f === 1 && ss.ayahs <= 10 ? ss.ayahs : Math.min(ss.ayahs, f + 4);
  } else { H.surah = 1; H.from = 1; H.to = 7; }
  H.page = lastP ? (nextPageOf(lastP.p) || lastP.p) : (STUDENT && STUDENT.start && STUDENT.start.page) || 1;
}
function defaultRangeFor(n) {
  const su = surahOf(n);
  const hist = history10().filter(e => e.k !== 'p' && e.s === n).sort((a, b) => b.t - a.t)[0];
  if (hist && hist.t < su.ayahs) { const len = Math.max(1, hist.t - hist.f + 1); return { from: hist.t + 1, to: Math.min(su.ayahs, hist.t + len) }; }
  if (su.ayahs <= 10) return { from: 1, to: su.ayahs };
  return { from: 1, to: 5 };
}

function renderHome() {
  const saved = savedLesson();
  const hist = history10().filter(e => e.m > 0 && !(saved && sameRange(refOf(saved), entryRef(e)))).slice(0, 3);
  const linkNote = H.link && saved && !sameRange(refOf(saved), H.link) && lessonInProgress(saved)
    ? `<div class="banner info">${ic('link')}<div>Lesson link opened: <b>${esc(refTitle(H.link))}</b>. Press <b>Start</b> to begin it.</div></div>` : '';
  let resume = '';
  if (saved) {
    const total = saved.ayahs.length, m = saved.ayahs.filter(isMastered).length, page = saved.kind === 'page';
    const frac = total ? m / total : 0, C = 2 * Math.PI * 22;
    const complete = m === total, nx = complete ? nextRefOf(saved) : null;
    const ring = page ? (complete ? '✓' : `${toAr(saved.page)}`) : `${m}/${total}`;
    const acts = complete
      ? `<button class="btn btn-primary btn-stack" type="button" data-act="revise" ${refAttrs(refOf(saved))}><span>Revise from memory</span>${mlSub('ഓർമ്മയിൽ നിന്ന് ഓതി നോക്കുക')}</button>${nx ? `<button class="btn" type="button" data-act="startref" ${refAttrs(nx)}>Next: ${esc(nx.kind === 'page' ? 'page ' + nx.page : rangeLabel(nx.from, nx.to).toLowerCase())}${ic('arrow-r')}</button>` : ''}<button class="btn btn-ghost" type="button" data-act="resume">Open lesson</button>`
      : `<button class="btn btn-primary btn-stack" type="button" data-act="resume"><span>Continue lesson</span>${mlSub('പാഠം തുടരുക')}</button><button class="btn btn-ghost" type="button" data-act="discard">${ic('x')}Remove</button>`;
    const metaTxt = complete
      ? `${page ? 'Page memorized' : `All ${total} ${plural(total, 'ayah')} memorized`} · ${relTime(saved.updated)}. Revise before starting new ${page ? 'pages' : 'ayahs'}.`
      : `${page ? `Stage ${saved.ayahs[0].stage} of 6` : `${m} of ${total} memorized`} · ${saved.mode === 'revise' ? 'revision · ' : ''}last opened ${relTime(saved.updated)}`;
    resume = `<section class="card resume-card" aria-labelledby="resT">
      <div class="resume-top">
        <svg class="resume-ring" viewBox="0 0 54 54" aria-hidden="true"><circle cx="27" cy="27" r="22" stroke="#ECE5D6"/><circle cx="27" cy="27" r="22" stroke="#B99A5D" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - (page ? (complete ? 1 : (saved.ayahs[0].stage - 1) / 6) : frac))).toFixed(1)}" transform="rotate(-90 27 27)"/><text x="27" y="31" text-anchor="middle" font-size="${page ? 14 : 12}" font-weight="700" fill="#174A39" font-family="${page && !complete ? 'Noto Naskh Arabic, serif' : 'DM Sans, sans-serif'}">${ring}</text></svg>
        <div><span class="eyebrow">${complete ? 'Last lesson · completed' : 'Continue where you left off'}</span><h2 class="h2" id="resT">${esc(refTitle(refOf(saved)))}</h2>
        <p class="muted small">${metaTxt}</p></div>
      </div>
      <div class="resume-actions">${acts}</div>
    </section>`;
  }
  const revision = hist.length ? `<section class="card" aria-labelledby="revT">
      <span class="eyebrow">Revision reminder</span>
      <h2 class="h2" id="revT" style="margin-top:8px">Revise before new lessons</h2>
      <p class="sub-ml">${bi('പുതിയ പാഠം പഠിക്കുന്നതിന് മുമ്പ്, മുമ്പ് പഠിച്ചവ ഒരിക്കൽ നോക്കാതെ ഓതുക.', 'Before a new lesson, recite your earlier lessons once from memory.')}</p>
      <div class="rev-list">${hist.map(e => { const r = entryRef(e); const badge = r.kind === 'page' ? `<span class="num-badge" title="Page">${r.page}</span>` : `<span class="num-badge">${r.surah}</span>`;
        return `<div class="rev-item">${badge}<div class="ri-main"><span class="ri-t">${esc(refTitle(r))}</span><span class="ri-m">${r.kind === 'page' ? 'Page memorized' : `${e.m} of ${e.n} memorized`} · ${relTime(e.at)}</span></div><button class="btn btn-sm btn-soft" type="button" data-act="revise" ${refAttrs(r)}>${ic('repeat')}Revise</button></div>`; }).join('')}</div>
    </section>` : '';

  $('#homeView').innerHTML = `
    <section class="hero">
      <span class="eyebrow">Hifz Learning Method${mlTag('· ഹിഫ്‌ള് പഠന രീതി')}</span>
      <h1>Memorize the Quran, one step at a time.</h1>
      <p class="lead-ml" lang="ml">ആയത്ത് ആയോ പേജ് ആയോ പഠിക്കാം — ചെറിയ നിറമുള്ള ഭാഗങ്ങളായി തിരിച്ച്, ആവർത്തിച്ച്, മറച്ച് ഓതി ഉറപ്പിക്കാം.</p>
      <p class="lead-en">Learn ayah by ayah, or page by page. Understand the meaning, learn small color-coded parts, join them, then recite from memory.</p>
      <div class="hero-meta"><span class="tag">${ic('book')}Uthmani script</span><span class="tag">${ic('layers')}Color-coded parts</span><span class="tag">${ic('eye-off')}Hide &amp; recall</span></div>
    </section>
    <div class="stack">
      ${resume}
      ${startCardHTML(linkNote)}
      ${revision}
      ${methodHTML()}
      <section class="card" aria-labelledby="tipT"><span class="eyebrow">Learning guidance</span><h2 class="h2" id="tipT" style="margin-top:8px">How to memorize well</h2><p class="sub-ml" lang="ml">നന്നായി മനഃപാഠമാക്കാൻ</p>${tipsHTML()}</section>
    </div>
    ${footerHTML()}`;
  bindStartForm();
}
const refAttrs = r => (r.kind === 'page' ? `data-k="page" data-p="${r.page}"` : `data-k="ayah" data-s="${r.surah}" data-f="${r.from}" data-t="${r.to}"`);
const refFromEl = el => (el.dataset.k === 'page' ? { kind: 'page', page: +el.dataset.p } : { kind: 'ayah', surah: +el.dataset.s, from: +el.dataset.f, to: +el.dataset.t });

function startCardHTML(linkNote) {
  const trOpts = TRANSLATIONS.map(t => `<option value="${t.id}"${t.id === S.translation ? ' selected' : ''}>${esc(t.name + (t.short ? ' — ' + t.short : ''))}</option>`).join('');
  const pageMode = H.mode === 'page';
  return `<section class="card start-card" id="startCard" aria-labelledby="startT">
    <div class="sc-head"><div><span class="eyebrow">New lesson</span><h2 class="h2" id="startT" style="margin-top:8px">Start a lesson</h2><p class="sub-ml" lang="ml">പുതിയ പാഠം തുടങ്ങുക</p></div></div>
    <div class="form-grid">
      ${linkNote || ''}
      <div class="field">
        <span class="field-label" id="lblMode">Learn by${mlTag('പഠിക്കേണ്ട രീതി')}</span>
        <div class="seg mode-seg" role="radiogroup" aria-labelledby="lblMode">
          <button type="button" role="radio" aria-checked="${!pageMode}" data-act="startmode" data-m="ayah">${ic('layers')}Ayahs</button>
          <button type="button" role="radio" aria-checked="${pageMode}" data-act="startmode" data-m="page">${ic('book')}Mushaf page</button>
        </div>
      </div>
      <div id="formAyah"${pageMode ? ' hidden' : ''} class="form-grid">
        <div class="field">
          <span class="field-label" id="lblSurah">Surah${mlTag('സൂറത്ത്')}</span>
          <button type="button" class="surah-field" data-act="openpicker" aria-haspopup="dialog">
            <span class="sr">Surah, change: </span><span class="num-badge" id="sfNum"></span>
            <span class="sf-main"><span class="sf-en" id="sfName"></span><span class="sf-meta" id="sfMeta"></span></span>
            <span class="sf-ar ar-ui" lang="ar" id="sfAr"></span>
            ${ic('chev-d', 'sf-chev')}
          </button>
        </div>
        <div class="field">
          <span class="field-label">Ayahs${mlTag('ആയത്തുകൾ')}</span>
          <div class="range-row">
            <div class="field"><label class="field-label" for="inFrom">From</label>
              <div class="stepper"><button type="button" data-act="rng" data-f="from" data-d="-1" aria-label="Decrease the first ayah">−</button><input id="inFrom" type="number" inputmode="numeric" min="1"><button type="button" data-act="rng" data-f="from" data-d="1" aria-label="Increase the first ayah">+</button></div></div>
            <div class="field"><label class="field-label" for="inTo">To</label>
              <div class="stepper"><button type="button" data-act="rng" data-f="to" data-d="-1" aria-label="Decrease the last ayah">−</button><input id="inTo" type="number" inputmode="numeric" min="1"><button type="button" data-act="rng" data-f="to" data-d="1" aria-label="Increase the last ayah">+</button></div></div>
          </div>
          <div class="quick" id="quickRanges"></div>
          <p class="form-msg ok" id="rangeMsg" aria-live="polite"></p>
        </div>
      </div>
      <div id="formPage"${pageMode ? '' : ' hidden'} class="form-grid">
        <div class="field">
          <label class="field-label" for="inPage">Page number${mlTag('പേജ് നമ്പർ')}</label>
          <div class="page-row">
            <div class="stepper"><button type="button" data-act="pgstep" data-d="-1" aria-label="Previous page">−</button><input id="inPage" type="number" inputmode="numeric" min="1" max="${PAGE_COUNT}"><button type="button" data-act="pgstep" data-d="1" aria-label="Next page">+</button></div>
            <button class="btn btn-sm" type="button" data-act="openpicker" data-for="page">${ic('search')}Find page by surah</button>
          </div>
          <p class="hint">Pages follow the standard Madani mushaf (604 pages).</p>
        </div>
        <div class="page-preview" id="pagePreview" aria-live="polite"></div>
        <div class="quick" id="quickPages"></div>
        <p class="form-msg ok" id="pageMsg" aria-live="polite"></p>
      </div>
      <div class="field">
        <label class="field-label" for="selTr">Translation${mlTag('പരിഭാഷ')}</label>
        <select class="select" id="selTr">${trOpts}</select>
      </div>
      <div class="start-row">
        <button class="btn btn-primary btn-stack" type="button" data-act="start" id="btnStart"><span id="btnStartTxt">${pageMode ? 'Start page lesson' : 'Start lesson'}</span>${mlSub('പഠനം തുടങ്ങുക')}</button>
        <p class="src-note">${ic('info')}<span>Quran text: Tanzil Uthmani, loaded from AlQuran Cloud. You need internet to open new ayahs.</span></p>
      </div>
    </div>
  </section>`;
}

function bindStartForm() {
  const f = $('#inFrom'), t = $('#inTo'), pg = $('#inPage'), sel = $('#selTr');
  if (!f) return;
  f.addEventListener('input', () => { H.from = parseInt(f.value, 10); refreshStartForm(false); });
  t.addEventListener('input', () => { H.to = parseInt(t.value, 10); refreshStartForm(false); });
  pg.addEventListener('input', () => { H.page = parseInt(pg.value, 10); refreshStartForm(false); });
  [f, t, pg].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); startFromForm(); } }));
  sel.addEventListener('change', () => changeSetting('translation', sel.value));
  refreshStartForm(true);
}
function rangeError() {
  const su = surahOf(H.surah), f = H.from, t = H.to;
  if (!Number.isInteger(f) || !Number.isInteger(t)) return 'Enter the first and last ayah numbers.';
  if (f < 1) return 'Ayah numbers start from 1.';
  if (t > su.ayahs || f > su.ayahs) return `${su.en} has ${su.ayahs} ayahs.`;
  if (f > t) return '“From” must not be after “To”.';
  if (t - f + 1 > MAX_AYAHS) return `Choose up to ${MAX_AYAHS} ayahs at a time — you chose ${t - f + 1}.`;
  return '';
}
const pageError = () => (Number.isInteger(H.page) && H.page >= 1 && H.page <= PAGE_COUNT ? '' : `Enter a page number from 1 to ${PAGE_COUNT}.`);
function refreshStartForm(writeInputs) {
  if (!$('#sfName')) return;
  const pageMode = H.mode === 'page';
  $('#formAyah').hidden = pageMode; $('#formPage').hidden = !pageMode;
  $$('[data-act="startmode"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.m === H.mode)));
  $('#btnStartTxt').textContent = pageMode ? 'Start page lesson' : 'Start lesson';
  // ayah form
  const su = surahOf(H.surah);
  $('#sfNum').textContent = su.n;
  $('#sfName').textContent = su.en;
  $('#sfMeta').textContent = `${su.meaning} · ${su.ayahs} ayahs · ${su.type}`;
  $('#sfAr').textContent = su.ar;
  const f = $('#inFrom'), t = $('#inTo'), pg = $('#inPage');
  f.max = su.ayahs; t.max = su.ayahs;
  if (writeInputs) {
    f.value = Number.isInteger(H.from) ? H.from : ''; t.value = Number.isInteger(H.to) ? H.to : '';
    pg.value = Number.isInteger(H.page) ? H.page : '';
  }
  const q = [];
  const add = (a, b, label) => { if (a >= 1 && b <= su.ayahs && a <= b && b - a + 1 <= MAX_AYAHS && !q.some(x => x.a === a && x.b === b)) q.push({ a, b, label }); };
  const hist = history10().filter(e => e.k !== 'p' && e.s === su.n).sort((x, y) => y.t - x.t)[0];
  if (hist && hist.t < su.ayahs) { const len = Math.max(1, hist.t - hist.f + 1); add(hist.t + 1, Math.min(su.ayahs, hist.t + len), `Next: ${hist.t + 1}–${Math.min(su.ayahs, hist.t + len)}`); }
  if (su.ayahs > 3) add(1, 3, 'Ayahs 1–3');
  if (su.ayahs > 5) add(1, 5, 'Ayahs 1–5');
  if (su.ayahs <= MAX_AYAHS) add(1, su.ayahs, `Whole surah (${su.ayahs})`);
  $('#quickRanges').innerHTML = q.map(x => `<button class="chip" type="button" data-act="quick" data-a="${x.a}" data-b="${x.b}" aria-pressed="${x.a === H.from && x.b === H.to}">${esc(x.label)}</button>`).join('');
  const err = rangeError(), msg = $('#rangeMsg');
  if (err) { msg.textContent = err; msg.classList.remove('ok'); }
  else { const c = H.to - H.from + 1; msg.textContent = `${c} ${plural(c, 'ayah')} selected — each one gets its own lesson card.`; msg.classList.add('ok'); }
  // page form
  const perr = pageError(), pmsg = $('#pageMsg'), prev = $('#pagePreview');
  if (perr) { prev.innerHTML = `<div class="pp-main"><p class="pp-m">${esc(perr)}</p></div>`; pmsg.textContent = ''; }
  else {
    const ps = pageSummary(H.page);
    prev.innerHTML = `<span class="pp-n" aria-hidden="true">${toAr(H.page)}</span><div class="pp-main"><p class="pp-t">Page ${H.page} · Juz ${ps.juz}</p><p class="pp-m">${pageLabelHTML(ps)} · <span class="nb">${ps.count} ${plural(ps.count, 'ayah')}</span></p></div><span class="pp-ar ar-ui" lang="ar">${esc(ps.ar)}</span>`;
    pmsg.textContent = `The page will be divided into colored parts of ${S.pageSplit} ayahs. You can change this, or color it by hand, in Stage 2.`;
  }
  const lastP = history10().find(e => e.k === 'p');
  const pq = [];
  const addP = (p, label) => { if (p >= 1 && p <= PAGE_COUNT && !pq.some(x => x.p === p)) pq.push({ p, label }); };
  const np = lastP && nextPageOf(lastP.p);
  if (np) addP(np, `Next: page ${np}`);
  addP(1, 'Page 1 · Al-Fatihah'); addP(2, 'Page 2 · Al-Baqarah'); addP(582, 'Juzʾ ʿAmma · page 582'); addP(PAGE_COUNT, `Last page · ${PAGE_COUNT}`);
  $('#quickPages').innerHTML = pq.map(x => `<button class="chip" type="button" data-act="quickpage" data-p="${x.p}" aria-pressed="${x.p === H.page}">${esc(x.label)}</button>`).join('');
  $('#btnStart').disabled = !!(pageMode ? perr : err);
}
async function startFromForm() {
  const pageMode = H.mode === 'page';
  if (pageMode ? pageError() : rangeError()) { refreshStartForm(false); return; }
  const target = pageMode ? { kind: 'page', page: H.page } : { kind: 'ayah', surah: H.surah, from: H.from, to: H.to };
  const saved = savedLesson();
  if (saved && sameRange(refOf(saved), target)) { openSaved(saved, true); return; }
  if (!(await okToReplace(saved))) return;
  H.link = null;
  startLesson(target, 'learn', { push: true });
}
async function okToReplace(saved) {
  if (!saved || !lessonInProgress(saved)) return true;
  return confirmBox({ title: 'Start a new lesson?', body: `Your saved lesson (${refTitle(refOf(saved))}) will be replaced. Memorized work stays in your revision list.`,
    ml: 'ഇപ്പോഴത്തെ പാഠത്തിന് പകരം പുതിയ പാഠം തുടങ്ങും.', ok: 'Start new lesson' });
}

const METHOD = () => [
  ['Read & understand', 'വായിച്ച് മനസ്സിലാക്കുക', 'Read slowly and learn the meaning.'],
  ['Divide into parts', 'ഭാഗങ്ങളായി തിരിക്കുക', `An ayah is split into color-coded groups of ${S.groupSize} words. A page is split into parts of ${S.pageSplit} ayahs — or you color it yourself.`],
  ['Memorize each part', 'ഓരോ ഭാഗവും മനഃപാഠമാക്കുക', `Repeat one part at a time — ${S.groupReps} times.`],
  ['Join the parts', 'ഭാഗങ്ങൾ ചേർത്ത് ഓതുക', `Recite 1+2, then 1–3 … until everything is joined (${S.comboReps} times each).`],
  ['Repeat it all', 'മുഴുവനും ആവർത്തിക്കുക', `Recite the whole ayah ${S.ayahReps} times, or the whole page ${S.pageReps} times.`],
  ['Hide & recall', 'മറച്ച് ഓർത്ത് ഓതുക', 'Hide it, recite from memory, then show it and check yourself.']
];
function methodHTML() {
  return `<section class="card" aria-labelledby="mT"><span class="eyebrow">The academy method</span><h2 class="h2" id="mT" style="margin-top:8px">Six stages, for an ayah or a page</h2>
    <p class="sub-ml" lang="ml">ഓരോ ആയത്തിനും പേജിനും ആറ് ഘട്ടങ്ങൾ — പുരോഗതി പ്രത്യേകം സൂക്ഷിക്കുന്നു.</p>
    <ol class="method-list">${METHOD().map(([en, ml, d], k) => `<li><span class="m-n">${k + 1}</span><div><p class="m-t">${en}</p><p class="m-ml" lang="ml">${ml}</p><p class="m-d">${d}</p>${k === 1 ? '<span class="mini-chips" aria-hidden="true"><i class="c1"></i><i class="c2"></i><i class="c3"></i><i class="c4"></i></span>' : ''}</div></li>`).join('')}</ol>
    <p class="hint" style="margin-top:14px">You count each repetition yourself by tapping the counter. The app does not listen to your recitation — recite to your teacher as usual.</p>
  </section>`;
}

const TIPS = [
  ['അർത്ഥം ആദ്യം മനസ്സിലാക്കുക. അർത്ഥം അറിയുമ്പോൾ ഓർമ്മ എളുപ്പമാകും.', 'Understand the meaning first. When you know the meaning, it is easier to remember.'],
  ['ഒരു സമയം 2 മുതൽ 5 വരെ വാക്കുകൾ മാത്രം പഠിക്കുക.', 'Learn only 2 to 5 words at a time. Small parts are easier to remember.'],
  ['ചെറിയ ഭാഗങ്ങൾ പഠിച്ച ശേഷം അവ ക്രമേണ ചേർത്ത് ഓതുക.', 'Join small parts step by step: 1+2, then 1–3, until the whole ayah or page is done.'],
  ['ആവർത്തിച്ചു വരുന്ന വാക്കുകളും അർത്ഥത്തിലെ ബന്ധങ്ങളും ശ്രദ്ധിക്കുക.', 'Notice words that come again, and how the meanings connect. This helps you remember.'],
  ['ബുദ്ധിമുട്ടുള്ള വാക്കുകളും ഭാഗങ്ങളും കൂടുതൽ പ്രാവശ്യം ആവർത്തിക്കുക.', 'Repeat hard words and parts more times. Come back to them later.'],
  ['പുതിയ ആയത്ത് പഠിച്ച ശേഷം, മുമ്പ് പഠിച്ച ആയത്തുകളോട് ചേർത്ത് ഓതുക.', 'After a new ayah or page, recite it together with what you learned before.']
];
function tipsHTML() {
  return `<ol class="tips">${TIPS.map(([ml, en], k) => `<li><span class="t-n">${k + 1}</span><div><p class="t-ml" lang="ml">${ml}</p>${EN() || S.englishHelp ? `<p class="t-en">${en}</p>` : ''}</div></li>`).join('')}</ol>
  <div class="callout">${ic('info')}<div><b>About your notes.</b> Your note is only your own reminder. It is not a translation or tafsir. For meanings, use the translation and ask your teacher.${mlTag('<br>ഓർമ്മക്കുറിപ്പ് നിങ്ങളുടെ സ്വന്തം സഹായം മാത്രമാണ് — അത് പരിഭാഷയോ തഫ്‌സീറോ അല്ല.')}</div></div>`;
}
function footerHTML() {
  return `<footer class="footer">
    <p><b>ManzilulQuran.in – E-Learning Academy</b> · Hifz Learning Method</p>
    <p>Quran text: Tanzil Uthmani text (tanzil.net), loaded from the AlQuran Cloud API. Page numbers follow the Madani mushaf (604 pages). Translations: Cheriyamundam Abdul Hameed &amp; Kunhi Mohammed Parappoor, and Muhammad Karakunnu &amp; Vanidas Elayavoor (Malayalam); Saheeh International (English).</p>
    <p>You count your own repetitions — this tool does not listen to or check recitation. Settings and progress are stored only in this browser.</p>
  </footer>`;
}

/* ---------------------------------------------------------------------
   12. Surah picker (also used to find a page by surah)
   --------------------------------------------------------------------- */
const simp = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/(.)\1+/g, '$1');
const normArSearch = s => normAr(s).replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '');
const normMl = s => String(s).replace(/ല്‍/g, 'ൽ').replace(/ന്‍/g, 'ൻ').replace(/ര്‍/g, 'ർ')
  .replace(/ള്‍/g, 'ൾ').replace(/ണ്‍/g, 'ൺ').replace(/[‌‍\s]/g, '');
let SEARCH_INDEX = null;
function searchIndex() {
  if (!SEARCH_INDEX) SEARCH_INDEX = SURAHS.map(r => ({ n: r[0], en: simp(r[2]), alias: simp(r[6]), meaning: simp(r[3]), ar: normArSearch(r[1]), ml: normMl(r[7]) }));
  return SEARCH_INDEX;
}
function searchSurahs(list, q) {
  const allowed = new Set(list.map(s => s.n));
  if (/^\d+$/.test(q)) {
    const n = +q;
    return list.filter(s => String(s.n).startsWith(q)).sort((a, b) => (a.n === n ? -1 : b.n === n ? 1 : a.n - b.n));
  }
  const qs = simp(q), qa = /[؀-ۿ]/.test(q) ? normArSearch(q) : '', qm = /[ഀ-ൿ]/.test(q) ? normMl(q) : '';
  const out = [];
  for (const e of searchIndex()) {
    if (!allowed.has(e.n)) continue;
    let sc = Infinity;
    if (qs) {
      const bare = e.en.replace(/^(adh|ash|al|an|ar|as|at|ad|az)/, '');
      if (e.en.startsWith(qs) || bare.startsWith(qs)) sc = 0;
      else if (e.en.includes(qs)) sc = 1;
      else if (e.alias.includes(qs)) sc = 2;
      else if (e.meaning.includes(qs)) sc = 3;
    }
    if (qa && e.ar.includes(qa)) sc = Math.min(sc, (e.ar.startsWith(qa) || e.ar.startsWith('ال' + qa)) ? 0 : 1);
    if (qm && e.ml.includes(qm)) sc = Math.min(sc, 1);
    if (sc < Infinity) out.push([sc, e.n]);
  }
  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return out.map(x => surahOf(x[1]));
}
function renderSurahList() {
  const q = $('#surahSearch').value.trim();
  let list = SURAHS.map(r => surahOf(r[0]));
  if (P.filter === 'amma') list = list.filter(s => s.n >= 78);
  if (q) list = searchSurahs(list, q);
  else if (P.reverse) list = list.slice().reverse();
  const cur = P.forPage ? pageSegments(H.page)[0].s : H.surah;
  $('#pickerCount').textContent = `${list.length} ${plural(list.length, 'surah')}`;
  $('#surahList').innerHTML = list.length
    ? list.map(s => `<li><button type="button" class="s-item" data-act="pick" data-n="${s.n}"${s.n === cur ? ' aria-current="true"' : ''}><span class="num-badge">${s.n}</span><span class="s-main"><span class="s-en">${esc(s.en)}</span><span class="s-meta">${esc(s.meaning)} · ${s.ayahs} ayahs · ${P.forPage ? `starts on page ${pageOf(s.n, 1)}` : s.type}</span></span><span class="s-ar ar-ui" lang="ar">${esc(s.ar)}</span></button></li>`).join('')
    : `<li class="s-empty">No surah matches “${esc(q)}”.${mlTag('<br>ഈ പേരിൽ സൂറത്ത് കണ്ടെത്താനായില്ല.')}</li>`;
  $$('[data-act="pfilter"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === P.filter)));
  const ord = $('[data-act="porder"]'); if (ord) ord.setAttribute('aria-pressed', String(P.reverse));
}
function openPicker(forPage) {
  P.forPage = !!forPage;
  $('#dlgSurahT').textContent = P.forPage ? 'Find a page by surah' : 'Choose a surah';
  $('#surahSearch').value = '';
  renderSurahList();
  openDialog($('#dlgSurah'));
  setTimeout(() => {
    const cur = $('#surahList [aria-current="true"]');
    if (cur) cur.scrollIntoView({ block: 'center' });
    if (!isCoarse()) $('#surahSearch').focus();
  }, 40);
}
function pickSurah(n) {
  const su = surahOf(n); if (!su) return;
  const dlg = $('#dlgSurah');
  if (P.forPage) {
    H.page = pageOf(n, 1);
    dlg._ret = $('[data-act="openpicker"][data-for="page"]');
  } else {
    H.surah = n;
    const r = defaultRangeFor(n); H.from = r.from; H.to = r.to;
    dlg._ret = $('.surah-field');
  }
  closeDialog(dlg);
  refreshStartForm(true);
}

/* ---------------------------------------------------------------------
   13. Loading a lesson
   --------------------------------------------------------------------- */
let loadSeq = 0;
const segmentsOf = r => (r.kind === 'page' ? pageSegments(r.page) : [{ s: r.surah, f: r.from, t: r.to }]);
async function startLesson(ref, mode, opts) {
  const seq = ++loadSeq;
  const lesson = makeLesson(ref, mode);
  L = lesson;
  showView('lesson', { push: !!(opts && opts.push) });
  renderLessonLoading();
  const trEd = S.translation, segs = segmentsOf(ref);
  try {
    const [ar, tr] = await Promise.allSettled([
      Promise.all(segs.map(sg => fetchEdition(sg.s, sg.f, sg.t, QURAN_EDITION))),
      trEd !== 'none' ? Promise.all(segs.map(sg => fetchEdition(sg.s, sg.f, sg.t, trEd))) : Promise.resolve(null)
    ]);
    if (seq !== loadSeq) return;
    if (ar.status === 'rejected') throw ar.reason;
    const trOK = tr.status === 'fulfilled' && !!tr.value;
    if (lesson.kind === 'page') {
      const u = newPage(ref.page);
      segs.forEach((sg, j) => {
        for (let n = sg.f; n <= sg.t; n++) {
          let text = ar.value[j].texts.get(n), bas = null;
          if (n === 1 && sg.s !== 1 && sg.s !== 9) { const sp = splitBasmalah(text); if (sp.basmalah) { text = sp.rest; bas = sp.basmalah; } }
          u.items.push({ s: sg.s, a: n, text, basmalah: bas, tr: trOK ? (tr.value[j].texts.get(n) || '') : '' });
        }
      });
      u.trSt = trEd === 'none' ? 'none' : (trOK && u.items.every(x => x.tr) ? 'ok' : 'error');
      if (lesson.mode === 'revise') Object.assign(u, { stage: 6, d1: true, d2: true, hidden: true });
      lesson.ayahs.push(u);
    } else {
      for (let n = ref.from; n <= ref.to; n++) {
        let text = ar.value[0].texts.get(n);
        if (n === 1 && ref.surah !== 1 && ref.surah !== 9) {
          const sp = splitBasmalah(text);
          if (sp.basmalah) { text = sp.rest; lesson.basmalah = sp.basmalah; }
        }
        const a = newAyah(n, text);
        if (trEd === 'none') a.trSt = 'none';
        else if (trOK) { a.tr = tr.value[0].texts.get(n) || ''; a.trSt = a.tr ? 'ok' : 'error'; }
        else a.trSt = 'error';
        if (lesson.mode === 'revise') { a.stage = 6; a.d1 = true; a.d2 = true; a.hidden = true; }
        lesson.ayahs.push(a);
      }
    }
    lesson.trEd = trEd;
    lesson.status = 'ready';
    renderLesson();
    saveNow();
    if (trEd !== 'none' && !trOK) toast('The translation could not be loaded — you can still memorize. Tap “Retry”.', 'പരിഭാഷ ലോഡ് ചെയ്യാനായില്ല.', 'info');
  } catch (err) {
    if (seq !== loadSeq) return;
    lesson.status = 'error'; lesson.error = err;
    renderLessonError(err);
  }
}
function openSaved(saved, push) {
  L = saved;
  showView('lesson', { push: !!push });
  renderLesson();
  if (L.trEd !== S.translation || L.ayahs.some(a => a.trSt === 'error')) reloadTranslation();
}
async function reloadTranslation() {
  if (!L || L.status !== 'ready') return;
  const ed = S.translation, lesson = L;
  L.trEd = ed;
  if (ed === 'none') {
    L.ayahs.forEach(a => { a.tr = ''; a.trSt = 'none'; if (isPage(a)) a.items.forEach(x => { x.tr = ''; }); });
    updateAll(); persist(); return;
  }
  L.ayahs.forEach(a => { a.trSt = 'loading'; });
  updateAll('xw');
  try {
    const segs = segmentsOf(refOf(L));
    const res = await Promise.all(segs.map(sg => fetchEdition(sg.s, sg.f, sg.t, ed)));
    if (lesson !== L || L.trEd !== ed) return;
    if (L.kind === 'page') {
      const u = L.ayahs[0];
      u.items.forEach(x => { const j = segs.findIndex(sg => sg.s === x.s); x.tr = (j >= 0 && res[j].texts.get(x.a)) || ''; });
      u.trSt = u.items.every(x => x.tr) ? 'ok' : 'error';
    } else L.ayahs.forEach(a => { a.tr = res[0].texts.get(a.n) || ''; a.trSt = a.tr ? 'ok' : 'error'; });
  } catch (e) {
    if (lesson !== L || L.trEd !== ed) return;
    L.ayahs.forEach(a => { a.trSt = 'error'; });
    toast('The translation could not be loaded. ' + errText(e).en, 'പരിഭാഷ ലോഡ് ചെയ്യാനായില്ല.', 'info');
  }
  updateAll('xw'); refreshMeta(); persist();
}

function loadingTitle() {
  if (L.kind === 'page') { const ps = pageSummary(L.page); return { t: `Page ${L.page}`, m: `Juz ${ps.juz} · ${ps.label}`, ar: ps.ar, n: 1 }; }
  const su = surahOf(L.surah);
  return { t: su.en, m: `${su.meaning} · ${rangeLabel(L.from, L.to)}`, ar: su.ar, n: L.to - L.from + 1 };
}
function renderLessonLoading() {
  const h = loadingTitle();
  $('#lessonView').innerHTML = `<div class="stack">
    <section class="card lesson-head load-card" aria-busy="true">
      <div class="lh-title"><div><span class="eyebrow">Loading lesson</span><h2>${esc(h.t)}</h2><p class="meta">${esc(h.m)}</p></div><p class="lh-ar ar-ui" lang="ar">${esc(h.ar)}</p></div>
      <p class="muted small" role="status">Loading the Quran text…${mlTag('ഖുർആൻ വാചകം ലോഡ് ചെയ്യുന്നു…')}</p>
    </section>
    <div class="cards">${range(1, Math.min(h.n, 4)).map(k => `<div class="card" aria-hidden="true"><div class="sk" style="height:26px;width:42%"></div><div class="sk" style="height:5px;margin-top:20px"></div><div class="sk" style="height:${L.kind === 'page' ? 420 : (k % 2 ? 120 : 96)}px;margin-top:22px;border-radius:16px"></div><div class="sk sk-line" style="width:88%;margin-top:18px"></div><div class="sk sk-line" style="width:64%"></div><div class="sk" style="height:150px;margin-top:18px;border-radius:18px"></div></div>`).join('')}</div>
  </div>`;
}
function renderLessonError(err) {
  const e = errText(err), h = loadingTitle();
  $('#lessonView').innerHTML = `<div class="stack"><section class="card err" role="alert">
    <span class="e-ic">${ic(e.icon, 'ic-lg')}</span>
    <h2 class="h2">Could not load ${esc(h.t)}${L.kind === 'page' ? '' : ' · ' + rangeLabel(L.from, L.to)}</h2>
    <p>${esc(e.en)}</p>${EN() ? '' : `<p lang="ml" class="muted">${esc(e.ml)}</p>`}
    <div class="row"><button class="btn btn-primary" type="button" data-act="retryload">${ic('refresh')}Try again</button><button class="btn" type="button" data-act="home">${ic('arrow-l')}Back to lesson setup</button></div>
    <p class="hint">The app still works, but new ayahs come from the AlQuran Cloud server. Ayahs and pages you opened recently on this device open again without internet.</p>
  </section></div>`;
}

/* ---------------------------------------------------------------------
   14. Lesson rendering
   --------------------------------------------------------------------- */
const cardEl = i => document.querySelector(`.ayah-card[data-i="${i}"]`);

function renderLesson() {
  if (!L || L.status !== 'ready') return;
  document.title = `${refTitle(refOf(L))} — ${baseTitle()}`;
  const basm = L.kind === 'ayah' && L.basmalah ? `<div class="basmalah"><p class="bl orn">Basmalah</p><p class="bt" lang="ar" dir="rtl">${esc(L.basmalah)}</p></div>` : '';
  $('#lessonView').innerHTML = `<div class="stack">
    ${lessonHeadHTML()}
    ${basm}
    <div class="cards" id="cards">${L.ayahs.map((_, i) => cardHTML(i)).join('')}</div>
    ${joinCardHTML()}
  </div>${footerHTML()}`;
  L.ayahs.forEach((a, i) => { const el = cardEl(i); if (el) { el.classList.toggle('active', i === L.active); el.classList.toggle('mastered', isMastered(a)); } });
  refreshMeta();
}

function lessonHeadHTML() {
  const page = L.kind === 'page';
  let title, meta, ar;
  if (page) { const ps = pageSummary(L.page); title = `Page ${L.page}`; meta = `Juz ${ps.juz} · ${pageLabelHTML(ps)} · <span class="nb">${ps.count} ${plural(ps.count, 'ayah')}</span>`; ar = ps.ar; }
  else { const su = surahOf(L.surah); title = su.en; meta = esc(`${su.meaning} · Surah ${su.n} · ${rangeLabel(L.from, L.to)}`); ar = su.ar; }
  const rev = L.mode === 'revise'
    ? `<div class="banner info">${ic('repeat')}<div>${bi(page ? 'പുനരാവർത്തനം: പേജ് മറച്ചാണ് തുടങ്ങുന്നത്. നോക്കാതെ ഓതിയ ശേഷം കാണിച്ച് പരിശോധിക്കുക.' : 'പുനരാവർത്തനം: ഓരോ ആയത്തും മറച്ചാണ് തുടങ്ങുന്നത്. നോക്കാതെ ഓതിയ ശേഷം കാണിച്ച് പരിശോധിക്കുക.',
      page ? 'Revision: the page starts hidden. Recite it from memory, then show it and check.' : 'Revision: every ayah starts hidden. Recite it from memory, then show it and check.')}</div></div>` : '';
  return `<section class="card lesson-head" aria-labelledby="lhT">
    <div class="lh-top"><button class="btn btn-sm btn-ghost" type="button" data-act="home">${ic('arrow-l')}Change lesson</button>
      <div class="lh-tools"><button class="btn btn-sm btn-ghost" type="button" data-act="restart" aria-label="Restart lesson">${ic('refresh')}<span class="hide-sm">Restart</span></button></div></div>
    <div class="lh-title"><div><span class="eyebrow">${L.mode === 'revise' ? 'Revision lesson' : page ? 'Page lesson' : 'Hifz lesson'}</span><h1 id="lhT">${esc(title)}</h1><p class="meta">${meta}</p></div><p class="lh-ar ar-ui" lang="ar">${esc(ar)}</p></div>
    ${rev}
    <div id="trBanner"></div>
    <div class="stats" id="lhStats"></div>
    ${page ? '' : `<div class="lh-nav"><span class="k">Jump to ayah</span><div class="pills" id="lhPills"></div></div>
    <div class="lh-actions">
      <label class="sel-all"><span class="chk"><input type="checkbox" id="selAll" data-chg="selall"><span class="box">${ic('check')}</span></span>Select all ayahs</label>
      <button class="btn btn-sm" type="button" data-act="hidesel" id="btnHideSel">${ic('eye-off')}Hide selected ayahs</button>
    </div>`}
    <p class="local-note">${ic('lock')}<span>Progress is saved in this browser for now. Cloud sync comes in the next step.${mlTag('പുരോഗതി ഇപ്പോൾ ഈ ബ്രൗസറിൽ മാത്രമാണ് സൂക്ഷിക്കുന്നത്.')}</span></p>
  </section>`;
}

function cardHTML(i) {
  const a = L.ayahs[i], pg = isPage(a), tid = pg ? `t-p${a.n}` : `t-${a.n}`;
  return `<article class="card ayah-card${pg ? ' page-card' : ''}" id="${pg ? 'page-' : 'ayah-'}${a.n}" data-i="${i}" style="--d:${Math.min(i, 8)}" aria-labelledby="${tid}">
    <header class="ac-head">${headHTML(i)}</header>
    <div class="ac-steps">${stepsHTML(i)}</div>
    <div class="ac-text">${textHTML(i)}</div>
    <div class="ac-trans">${transHTML(i)}</div>
    <section class="ac-work" aria-label="Memorization workspace for ${pg ? 'page' : 'ayah'} ${a.n}">${workHTML(i, false)}</section>
    <footer class="ac-foot">${footHTML(i)}</footer>
  </article>`;
}

function headHTML(i) {
  const a = L.ayahs[i], st = statusOf(a), pg = isPage(a), N = NOUN(a);
  const eye = a.hidden ? 'Show' : 'Hide';
  const medal = `<span class="ac-medal${a.n >= 100 ? ' n3' : ''}" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#i-medal"/></svg><span style="position:relative">${toAr(a.n)}</span></span>`;
  let id;
  if (pg) {
    const ps = pageSummary(a.n);
    id = `${medal}<span class="ac-name"><h2 class="ac-t" id="t-p${a.n}">Page ${a.n}</h2><span><span class="ac-sname">Juz ${ps.juz} · </span>${pageLabelHTML(ps)}</span></span>`;
  } else {
    const su = surahOf(L.surah);
    id = `<label class="chk" title="Select this ayah"><input type="checkbox" data-chg="sel" ${a.sel ? 'checked' : ''}><span class="box">${ic('check')}</span><span class="sr">Select ayah ${a.n}</span></label>
    ${medal}<span class="ac-name"><h2 class="ac-t" id="t-${a.n}">Ayah ${a.n}</h2><span><span class="ac-sname">${esc(su.en)} · </span>${L.surah}:${a.n}</span></span>`;
  }
  return `${id}
    <span class="state ${st.cls}">${st.icon ? ic(st.icon) : ''}${esc(st.en)}</span>
    <div class="ac-tools">
      <button class="btn btn-sm btn-ghost" type="button" data-act="audio" data-kind="${pg ? 'page' : 'ayah'}" aria-label="Listen to ${N.u} ${a.n}">${ic('volume')}<span class="lbl">Listen</span></button>
      <button class="btn btn-sm" type="button" data-act="toggleayah" data-fk="eye" aria-pressed="${a.hidden}" aria-label="${eye} ${N.u} ${a.n}">${ic(a.hidden ? 'eye' : 'eye-off')}<span class="lbl">${eye} ${N.u}</span></button>
    </div>`;
}

function stepsHTML(i) {
  const a = L.ayahs[i];
  const items = range(1, 6).map(n => {
    const s = stageOf(a, n), done = stageDone(a, n), cur = a.stage === n;
    return `<li><button type="button" class="step${cur ? ' cur' : done ? ' done' : ''}" data-act="stage" data-stage="${n}"${cur ? ' aria-current="step"' : ''}><span class="bar"></span><span class="lbl"><span class="sr">Stage </span><span class="n">${done && !cur ? ic('check') + `<span class="sr">${n}</span>` : n}</span><span class="t">${s.short}</span><span class="sr"> — ${s.en}${done ? ', done' : ''}</span></span></button></li>`;
  }).join('');
  const cs = stageOf(a, a.stage);
  return `<ol class="steps" aria-label="Memorization stages for ${NOUN(a).u} ${a.n}">${items}</ol><p class="steps-cap">Stage <b>${a.stage}</b> of 6 · ${cs.en}</p>`;
}

function chipHTML(a, d, gi, st, r0, r1) {
  const cur = (st === 2 || st === 3) && a.g === gi;
  const inR = st === 4 && r0 >= 0 && gi >= r0 && gi <= r1;
  const dim = (st === 3 && !cur) || (st === 4 && r0 >= 0 && !inR);
  const hid = !!a.gh[gi];
  const ok = st === 3 && a.gc[gi] >= S.groupReps;
  const cls = `grp c${(gi % 4) + 1}${cur || inR ? ' on' : ''}${dim ? ' dim' : ''}${hid ? ' hid' : ''}${ok ? ' gdone' : ''}`;
  return `<button type="button" class="${cls}" data-act="selgroup" data-g="${gi}" aria-pressed="${cur || inR}"><span class="gnum" aria-hidden="true">${ok && !cur ? ic('check') : gi + 1}</span><span class="sr">Group ${gi + 1}${hid ? ', hidden' : ''}: </span><span class="gtxt"${hid ? ' aria-hidden="true"' : ''}>${d.groups[gi].map(wi => `<span class="w">${esc(d.words[wi].t)}</span>`).join(' ')}</span></button>`;
}

function hiddenMask(a, inStage6) {
  const pg = isPage(a);
  const ml = pg ? 'പേജ് മറച്ചിരിക്കുന്നു — ഓർത്ത് ഓതിയ ശേഷം കാണിക്കുക.' : 'ആയത്ത് മറച്ചിരിക്കുന്നു — ഓർത്ത് ഓതിയ ശേഷം കാണിക്കുക.';
  const en = `The ${pg ? 'page' : 'ayah'} is hidden. Recite it from memory, then ${inStage6 ? 'show it below to check' : 'show it'}.`;
  const btn = inStage6 ? '' : `<div class="m-act"><button class="btn btn-sm btn-primary" type="button" data-act="toggleayah" data-fk="mshow">${ic('eye')}Show ${pg ? 'page' : 'ayah'}</button></div>`;
  return maskHTML(ml, en, btn);
}

function textHTML(i) {
  const a = L.ayahs[i];
  if (isPage(a)) return pageTextHTML(i);
  const d = D(a), st = a.stage;
  const end = `<span class="ayah-end" role="img" aria-label="end of ayah ${a.n}">${toAr(a.n)}</span>`;
  const chips = st >= 2 && st <= 4;
  const wordMode = st === 6 && a.hidden && (S.recallMode !== 'full' || a.peek > 0);
  const concealed = a.hidden && !wordMode;
  const ah = concealed ? ' aria-hidden="true"' : '';
  let body;
  if (chips) {
    let r0 = -1, r1 = -1;
    if (st === 4 && d.steps.length) [r0, r1] = d.steps[a.cs];
    body = `<div class="ar-groups" lang="ar" dir="rtl"${ah}>${d.groups.map((g, gi) => chipHTML(a, d, gi, st, r0, r1)).join('')}${end}</div>`;
  } else {
    body = `<p class="ar-flow" lang="ar" dir="rtl"${ah}>${glueEnd(d.words.map((w, wi) => {
      const m = wordMode && !wordVisible(a, d, wi);
      return `<span class="w${m ? ' m' : ''}"${m ? ' aria-hidden="true"' : ''}>${esc(w.t)}</span>`;
    }), end)}</p>`;
  }
  const mask = concealed ? hiddenMask(a, st === 6) : '';
  const rv = a._rv && !concealed; a._rv = false;
  return `<div class="tx${concealed ? ' concealed' : ''}${rv ? ' rv' : ''}">${body}${mask}</div>`;
}

// A mushaf-style page: surah headings, Basmalah lines, ayahs flowing with end markers.
// Each part is one continuous colored run (.pp); each ayah inside it is a .pa span.
function pageTextHTML(i) {
  const a = L.ayahs[i], d = D(a), st = a.stage;
  const review = st === 6 && a.result === 'revise' && !a.hidden && d.groups.length > 1;   // pick the hard parts on the page
  const colored = (st >= 2 && st <= 4) || review;
  let r0 = -1, r1 = -1;
  if (st === 4 && d.steps.length) [r0, r1] = d.steps[a.cs];
  const wordMode = st === 6 && a.hidden && (S.recallMode !== 'full' || a.peek > 0);
  const concealed = a.hidden && !wordMode;
  const paint = st === 2 && a.split === 'manual';
  const openPart = gi => {
    if (!colored) return '<span class="pp">';
    const cur = (st === 2 || st === 3) && a.g === gi, inR = st === 4 && gi >= r0 && gi <= r1;
    const dim = (st === 3 && a.g !== gi) || (st === 4 && r0 >= 0 && !inR);
    const cls = `pp c${colorOf(a, d, gi)}${cur || inR ? ' on' : ''}${dim ? ' dim' : ''}${a.gh[gi] && !review ? ' hid' : ''}${review && a.weak.includes(gi) ? ' weak' : ''}`;
    const act = paint ? '' : ` data-act="${review ? 'weak' : 'selpart'}" data-g="${gi}"`;
    return `<span class="${cls}"${act}>`;
  };
  let html = '', para = false, part = -1;
  const endPara = () => { if (para) { html += (part >= 0 ? '</span>' : '') + '</p>'; para = false; part = -1; } };
  a.items.forEach((it, k) => {
    const gi = d.partOf[k];
    if (it.a === 1) {
      endPara();
      const su = surahOf(it.s);
      html += `<div class="sura-head"><span class="sh-ar">سورة ${esc(su.ar)}</span><span class="sh-en">Surah ${su.n} · ${esc(su.en)}</span></div>`;
      if (it.basmalah) html += `<p class="sura-bas">${esc(it.basmalah)}</p>`;
    }
    if (!para) { html += '<p class="mflow">'; para = true; }
    if (gi !== part) { html += (part >= 0 ? '</span> ' : '') + openPart(gi); part = gi; }
    else html += ' ';
    const attrs = paint ? ` role="button" tabindex="0" data-act="paint" data-k="${k}"` : '';
    const lead = paint ? `<span class="sr" lang="en" dir="ltr">Ayah ${it.s}:${it.a}, part ${gi + 1}. Tap to color it ${PALETTE[a.brush]}: </span>` : '';
    const words = d.itemWords[k].map(wi => {
      const m = wordMode && !wordVisible(a, d, wi);
      return `<span class="w${m ? ' m' : ''}"${m ? ' aria-hidden="true"' : ''}>${esc(d.words[wi].t)}</span>`;
    });
    const end = paint ? `<span class="ayah-end" aria-hidden="true">${toAr(it.a)}</span>` : `<span class="ayah-end" role="img" aria-label="end of ayah ${it.a}">${toAr(it.a)}</span>`;
    html += `<span class="pa"${attrs}>${lead}${glueEnd(words, end)}</span>`;
  });
  endPara();
  const mask = concealed ? hiddenMask(a, st === 6) : '';
  const rv = a._rv && !concealed; a._rv = false;
  return `<div class="tx page-tx${concealed ? ' concealed' : ''}${rv ? ' rv' : ''}${paint ? ' painting' : ''}"><div class="mushaf ar-flow" lang="ar" dir="rtl"${concealed ? ' aria-hidden="true"' : ''}>${html}</div>${mask}</div>`;
}

function transHTML(i) {
  const a = L.ayahs[i], info = trInfo(L.trEd);
  if (L.trEd === 'none') return '';
  if (a.trSt === 'loading') return '<div aria-busy="true"><div class="sk sk-line" style="width:92%"></div><div class="sk sk-line" style="width:70%"></div></div>';
  const failed = isPage(a) ? (a.trSt !== 'ok' || !a.items.some(x => x.tr)) : (a.trSt !== 'ok' || !a.tr);
  if (failed) return `<div class="tr-collapsed"><span>${ic('info', 'ic-sm')} The translation is not available right now.</span><button class="btn btn-xs" type="button" data-act="retrytr">${ic('refresh', 'ic-sm')}Retry</button></div>`;
  if (!S.trAlways && [3, 4, 6].includes(a.stage) && !a.showTr) return `<div class="tr-collapsed"><span>The meaning is hidden while you practice.</span><button class="btn btn-xs" type="button" data-act="showtr">${ic('eye', 'ic-sm')}Show meaning</button></div>`;
  const src = `<p class="tr-src">${ic('book')}${esc(info.name)} translation · ${esc(info.by)}</p>`;
  if (!isPage(a)) return `<p class="tr-txt" lang="${info.lang}" dir="ltr">${esc(a.tr)}</p>${src}`;
  const d = D(a);
  let ks = a.items.map((_, k) => k), label = `Meanings of the ${a.items.length} ${plural(a.items.length, 'ayah')} on this page`;
  if (a.stage === 3) { ks = d.parts[a.g]; label = `Meaning of part ${a.g + 1}`; }
  if (a.stage === 4 && d.steps.length) { const [r0, r1] = d.steps[a.cs]; ks = d.parts.slice(r0, r1 + 1).reduce((x, p) => x.concat(p), []); label = `Meaning of parts ${r0 + 1}–${r1 + 1}`; }
  const open = [1, 3, 4].includes(a.stage);
  return `<details class="meanings"${open ? ' open' : ''}><summary>${ic('book')}<span>${label}</span>${ic('chev-d', 'chev ic-sm')}</summary>
    <ol class="mlist">${ks.map(k => { const it = a.items[k]; return `<li><span class="mref">${it.s}:${it.a}</span><span class="tr-txt" lang="${info.lang}" dir="ltr">${esc(it.tr)}</span></li>`; }).join('')}</ol>${src}</details>`;
}

function footHTML(i) {
  const a = L.ayahs[i], last = i === L.ayahs.length - 1, pg = isPage(a);
  const memo = `<details class="memo"${a.note ? ' open' : ''}><summary>${ic('pen')}<span>My note</span>${EN() ? '' : '<span class="muted hide-sm" lang="ml" style="font-weight:500">· എന്റെ ഓർമ്മക്കുറിപ്പ്</span>'}${a.note ? '<span class="has" aria-label="has a note"></span>' : ''}${ic('chev-d', 'chev ic-sm')}</summary>
      <div class="memo-body"><label class="sr" for="memo-${pg ? 'p' : ''}${a.n}">My note for ${pg ? 'page' : 'ayah'} ${a.n}</label>
      <textarea id="memo-${pg ? 'p' : ''}${a.n}" data-memo maxlength="600" rows="2" placeholder="${pg ? 'Write your own hint — for example, the first word of each part.' : 'Write your own hint — for example, the first word of each group.'}">${esc(a.note)}</textarea>
      <p class="hint">Only a personal note — not a translation or tafsir. Saved in this browser.</p></div></details>`;
  if (pg) {
    const prev = a.n > 1 ? `<button class="btn btn-sm btn-ghost" type="button" data-act="gopage" data-p="${a.n - 1}">${ic('chev-l')}Page ${a.n - 1}</button>` : '';
    const next = a.n < PAGE_COUNT ? `<button class="btn btn-sm btn-soft" type="button" data-act="gopage" data-p="${a.n + 1}">Page ${a.n + 1}${ic('chev-r')}</button>` : '';
    return `${memo}<div class="pg-nav">${prev}${next}</div>`;
  }
  return `${memo}<button class="btn btn-sm btn-soft next" type="button" data-act="nextayah">${last ? 'Join all ayahs' : 'Next ayah'}${ic('arrow-d')}</button>`;
}

/* ---------- workspace building blocks ---------- */
function wsHead(a, extra) {
  const s = stageOf(a, a.stage);
  return `<div class="ws-head"><div class="ws-t"><p class="ws-kicker">Stage ${s.n} of 6</p><h3 class="ws-title" tabindex="-1">${s.en}</h3><p class="ws-ml" lang="ml">${s.ml}</p></div>${extra || ''}</div>`;
}
const audioBtn = (kind, label) => `<button class="btn btn-sm btn-ghost" type="button" data-act="audio" data-kind="${kind}">${ic('volume')}<span>${label}</span></button>`;
const primaryBtn = (act, label, attrs) => `<button class="btn btn-primary grow" type="button" data-act="${act}" data-fk="primary"${attrs || ''}>${label}${ic('arrow-r')}</button>`;
const backBtn = stage => `<button class="btn btn-sm btn-ghost" type="button" data-act="goto" data-stage="${stage}">${ic('chev-l')}Back</button>`;

const RING_R = 52, RING_C = 2 * Math.PI * RING_R;
function counterHTML(kind, c, N, label) {
  const done = c >= N, frac = Math.min(1, c / N);
  const beads = N <= 20 ? `<div class="beads${done ? ' done' : ''}" aria-hidden="true">${range(1, N).map(k => `<i class="${k <= c ? 'on' : ''}"></i>`).join('')}</div>` : '';
  return `<div class="counter" data-kind="${kind}">
    <button class="count-btn${done ? ' done' : ''}" type="button" data-act="count" data-kind="${kind}" data-fk="count-${kind}"><span class="sr">${esc(label)} — count one repetition: </span>
      <svg viewBox="0 0 118 118" aria-hidden="true"><circle class="ring-bg" cx="59" cy="59" r="${RING_R}"/><circle class="ring-fg" cx="59" cy="59" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" style="stroke-dashoffset:${(RING_C * (1 - frac)).toFixed(2)}"/></svg>
      <span class="c-in"><span class="c-num">${c}</span><span class="c-of">of ${N}</span><span class="c-tap">${done ? 'Done ✓' : 'Tap +1'}</span></span>
    </button>
    <div class="c-meta"><p class="c-label">${c} / ${N} repetitions completed</p><p class="c-label-ml" lang="ml">${c} / ${N} പ്രാവശ്യം പൂർത്തിയായി</p>${beads}
      <div class="c-tools"><button class="btn btn-xs btn-ghost" type="button" data-act="uncount" data-kind="${kind}" data-fk="undo-${kind}"${c ? '' : ' disabled'}>${ic('undo', 'ic-sm')}Undo</button><button class="btn btn-xs btn-ghost" type="button" data-act="resetcount" data-kind="${kind}"${c ? '' : ' disabled'}>${ic('refresh', 'ic-sm')}Reset</button></div>
    </div>
  </div>`;
}
function patchCounter(root, kind, c, N) {
  const box = root && root.querySelector(`.counter[data-kind="${kind}"]`);
  if (!box) return false;
  const btn = box.querySelector('.count-btn');
  box.querySelector('.ring-fg').style.strokeDashoffset = (RING_C * (1 - Math.min(1, c / N))).toFixed(2);
  box.querySelector('.c-num').textContent = c;
  box.querySelector('.c-label').textContent = `${c} / ${N} repetitions completed`;
  box.querySelector('.c-label-ml').textContent = `${c} / ${N} പ്രാവശ്യം പൂർത്തിയായി`;
  $$('.beads i', box).forEach((b, k) => b.classList.toggle('on', k < c));
  $$('[data-act="uncount"],[data-act="resetcount"]', box).forEach(b => { b.disabled = !c; });
  btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
  return true;
}

function focusHTML(a, d, gis, toggle) {
  const single = gis.length === 1, pg = isPage(a), N = NOUN(a);
  const hid = gis.every(gi => a.gh[gi]);
  const cls = (single ? `c${colorOf(a, d, gis[0])}` : 'multi') + (pg ? ' pg' : '');
  let lbl = single ? `${N.G} ${gis[0] + 1} of ${d.groups.length}` : `${N.Gs} ${gis[0] + 1}–${gis[gis.length - 1] + 1} together`;
  if (pg) lbl += ` · ${partRef(a, d, gis)}`;
  const words = gi => (pg
    ? d.parts[gi].map(k => glueEnd(d.itemWords[k].map(wi => `<span class="w">${esc(d.words[wi].t)}</span>`), `<span class="ayah-end" aria-hidden="true">${toAr(a.items[k].a)}</span>`)).join(' ')
    : d.groups[gi].map(wi => `<span class="w">${esc(d.words[wi].t)}</span>`).join(' '));
  const txt = single ? words(gis[0]) : gis.map(gi => `<span class="seg-g c${colorOf(a, d, gi)}">${words(gi)}</span>`).join(' ');
  const mask = hid ? `<div class="fmask">${EN() ? `<p class="m-ml">This ${single ? N.g : N.g + ' set'} is hidden. Recite it from memory, then show it.</p>`
    : `<p class="m-ml" lang="ml">ഭാഗം മറച്ചിരിക്കുന്നു — ഓർത്ത് ഓതിയ ശേഷം കാണിക്കുക.</p>${S.englishHelp ? `<p class="m-en">Hidden — recite it from memory, then show it.</p>` : ''}`}</div>` : '';
  const allHid = a.gh.length > 0 && a.gh.every(Boolean);
  const tools = toggle ? `<div class="f-tools"><button class="btn btn-sm${hid ? ' btn-primary' : ''}" type="button" data-act="togglefocus" data-fk="ftoggle" aria-pressed="${hid}">${ic(hid ? 'eye' : 'eye-off')}${hid ? 'Show' : 'Hide &amp; test myself'}</button><button class="btn btn-sm btn-ghost" type="button" data-act="hideallgroups" data-fk="fall" aria-pressed="${allHid}">${ic(allHid ? 'eye' : 'layers')}${allHid ? `Show all ${N.gs}` : `Hide all ${N.gs}`}</button>${audioBtn(pg ? 'part' : (single ? 'group' : 'range'), 'Listen')}</div>` : '';
  const frv = a._frv && !hid; a._frv = false;
  return `<div class="focus ${cls}${hid ? ' hid' : ''}${frv ? ' rv' : ''}"><span class="f-lbl">${lbl}</span><div class="ftxt" lang="ar" dir="rtl"${hid ? ' aria-hidden="true"' : ''}>${txt}</div>${mask}</div>${tools}`;
}
function groupNavHTML(a, d) {
  const n = d.groups.length, g = a.g, N = NOUN(a);
  if (n < 2) return '';
  return `<div class="gnav"><button class="btn btn-sm" type="button" data-act="gmove" data-d="-1" data-fk="gprev" ${g === 0 ? ' disabled' : ''}>${ic('chev-l')}Previous<span class="hide-sm"> ${N.g}</span></button><span class="gpos">${N.G} <b>${g + 1}</b> of ${n}</span><button class="btn btn-sm" type="button" data-act="gmove" data-d="1" data-fk="gnext" ${g === n - 1 ? ' disabled' : ''}>Next<span class="hide-sm"> ${N.g}</span>${ic('chev-r')}</button></div>`;
}

/* ---------- the six stages ---------- */
function workHTML(i, enter) {
  const a = L.ayahs[i];
  const fn = [ws1, ws2, ws3, ws4, ws5, ws6][a.stage - 1];
  return `<div class="ws${enter ? ' enter' : ''}">${fn(a, i)}</div>`;
}

function miniTip(ml, en) { return `<li>${ic('check')}<span>${EN() ? en : `<span lang="ml">${ml}</span>${S.englishHelp ? `<br><span class="muted small">${en}</span>` : ''}`}</span></li>`; }
function ws1(a) {
  const hasTr = L.trEd !== 'none', pg = isPage(a);
  const ml = pg ? 'ആദ്യം ഈ പേജ് മുഴുവനും ശ്രദ്ധിച്ച് പതുക്കെ വായിക്കുക. ' + (hasTr ? 'എന്നിട്ട് പേജിന് താഴെയുള്ള അർത്ഥങ്ങൾ വായിച്ച് മനസ്സിലാക്കുക.' : 'അർത്ഥം കാണാൻ ക്രമീകരണങ്ങളിൽ ഒരു പരിഭാഷ തിരഞ്ഞെടുക്കുക.')
    : 'ആദ്യം ഈ ആയത്ത് ശ്രദ്ധിച്ച് പതുക്കെ വായിക്കുക. ' + (hasTr ? 'എന്നിട്ട് ആയത്തിന് താഴെയുള്ള അർത്ഥം വായിച്ച് മനസ്സിലാക്കുക.' : 'അർത്ഥം കാണാൻ ക്രമീകരണങ്ങളിൽ ഒരു പരിഭാഷ തിരഞ്ഞെടുക്കുക.');
  const en = (pg ? 'First read the whole page slowly and carefully. ' : 'First read the ayah slowly and carefully. ')
    + (hasTr ? (pg ? 'Then read the meanings under the page and understand them.' : 'Then read the meaning under it and understand it.') : 'To see the meaning, choose a translation in Settings.');
  return wsHead(a, audioBtn(pg ? 'page' : 'ayah', 'Listen')) + instr(ml, en) +
    `<ul class="mini-tips">
      ${miniTip('ഓരോ വാക്കും വ്യക്തമായി, തജ്‌വീദ് ശ്രദ്ധിച്ച് വായിക്കുക.', 'Read every word clearly, with correct tajweed.')}
      ${miniTip('അർത്ഥം അറിയുമ്പോൾ മനഃപാഠമാക്കാൻ എളുപ്പമാകും.', 'Knowing the meaning makes memorizing easier.')}
    </ul>
    <div class="ws-actions"><span class="hint">Next, the ${pg ? 'page' : 'ayah'} is divided into small color-coded ${pg ? 'parts' : 'groups'}.</span>${primaryBtn('goto', pg ? 'I have read it — divide into parts' : 'I have read it — divide into groups', ' data-stage="2" data-mark="1"')}</div>`;
}

function ws2(a) {
  if (isPage(a)) return ws2page(a);
  const d = D(a), n = d.groups.length, size = sizeOf(a);
  const allHid = a.gh.length > 0 && a.gh.every(Boolean);
  const seg = `<div class="row"><span class="row-label">Words per group</span><div class="seg" role="radiogroup" aria-label="Words per group for this ayah">${[2, 3, 4, 5, 6].map(k => `<button type="button" role="radio" aria-checked="${k === size}" data-act="setsize" data-size="${k}">${k}</button>`).join('')}</div>${a.size ? `<button class="btn btn-xs btn-ghost" type="button" data-act="setsize" data-size="0">Use default (${S.groupSize})</button>` : ''}</div>`;
  return wsHead(a, audioBtn('group', 'Listen')) +
    instr(n > 1 ? `ഈ ആയത്ത് ${n} ഭാഗങ്ങളായി തിരിച്ചിരിക്കുന്നു. ഓരോ നിറവും ഓരോ ഭാഗമാണ്. ആദ്യം ഈ ഭാഗം ശ്രദ്ധിച്ച് വായിക്കുക.` : 'ഈ ആയത്ത് ചെറുതായതിനാൽ ഒരൊറ്റ ഭാഗമാണ്. ആദ്യം ഈ ഭാഗം ശ്രദ്ധിച്ച് വായിക്കുക.',
      n > 1 ? `This ayah is divided into ${n} groups of up to ${size} words. Each color is one group. Read the highlighted group carefully.` : 'This ayah is short, so it is one group. Read it carefully.') +
    focusHTML(a, d, [a.g], false) + groupNavHTML(a, d) + seg +
    `<div class="ws-actions"><button class="btn btn-sm btn-ghost" type="button" data-act="hideallgroups" aria-pressed="${allHid}">${ic(allHid ? 'eye' : 'eye-off')}${allHid ? 'Show all groups' : 'Hide all groups'}</button>${primaryBtn('goto', 'Start memorizing groups', ' data-stage="3" data-mark="2"')}</div>`;
}

function ws2page(a) {
  const d = D(a), n = d.groups.length, split = a.split || S.pageSplit, manual = split === 'manual';
  const allHid = a.gh.length > 0 && a.gh.every(Boolean);
  const seg = `<div class="row"><span class="row-label">Ayahs per part</span><div class="seg" role="radiogroup" aria-label="How to divide this page">${[3, 4, 5].map(k => `<button type="button" role="radio" aria-checked="${split === k}" data-act="setsplit" data-v="${k}">${k} ayahs</button>`).join('')}<button type="button" role="radio" aria-checked="${manual}" data-act="setsplit" data-v="manual">${ic('pen', 'ic-sm')}Color by hand</button></div></div>`;
  let body = instr(manual ? 'ഒരു നിറം തിരഞ്ഞെടുക്കുക, എന്നിട്ട് ആ നിറം നൽകേണ്ട ആയത്തുകളിൽ തൊടുക. അടുത്തടുത്തുള്ള ഒരേ നിറമുള്ള ആയത്തുകൾ ഒരു ഭാഗമാകും.'
      : `ഈ പേജ് ${n} ഭാഗങ്ങളായി തിരിച്ചിരിക്കുന്നു. ഓരോ നിറവും ഓരോ ഭാഗമാണ്. ആദ്യം ഈ ഭാഗം ശ്രദ്ധിച്ച് വായിക്കുക.`,
    manual ? 'Pick a color. Then tap the ayahs on the page to give them that color. Ayahs next to each other with the same color become one part.'
      : `This page is divided into ${n} ${plural(n, 'part')} of up to ${split} ayahs. Each color is one part. A part never runs across two surahs.`) + seg;
  if (manual) {
    body += `<div class="row"><span class="row-label">Color</span><div class="palette" role="radiogroup" aria-label="Color for tapping ayahs">${PALETTE.map((nm, c) => `<button type="button" class="swatch c${c + 1}" role="radio" aria-checked="${a.brush === c}" aria-label="${nm}" title="${nm}" data-act="brush" data-c="${c}">${ic('check')}</button>`).join('')}</div>
      <button class="btn btn-xs btn-ghost" type="button" data-act="resetpaint">${ic('refresh', 'ic-sm')}Start again from ${S.pageSplit} per part</button></div>`;
  }
  body += `<div class="parts-list" role="group" aria-label="Parts of this page">${d.parts.map((p, gi) => `<button type="button" class="pchip c${colorOf(a, d, gi)}" data-act="gjump" data-g="${gi}"${gi === a.g ? ' aria-current="true"' : ''}><span class="pn">${gi + 1}</span><span class="pr">${partRef(a, d, [gi])}</span></button>`).join('')}</div>`;
  body += focusHTML(a, d, [a.g], false) + groupNavHTML(a, d);
  body += `<div class="ws-actions"><button class="btn btn-sm btn-ghost" type="button" data-act="hideallgroups" aria-pressed="${allHid}">${ic(allHid ? 'eye' : 'eye-off')}${allHid ? 'Show all parts' : 'Hide all parts'}</button>${primaryBtn('goto', 'Start memorizing parts', ' data-stage="3" data-mark="2"')}</div>`;
  return wsHead(a, audioBtn('part', 'Listen')) + body;
}

function ws3(a) {
  const d = D(a), n = d.groups.length, g = a.g, N = S.groupReps, c = a.gc[g] || 0, done = c >= N, all = groupsDone(a), W = NOUN(a), pg = isPage(a);
  let html = wsHead(a) +
    instr(`ഭാഗം ${g + 1}: ആദ്യം ഈ ഭാഗം ശ്രദ്ധിച്ച് വായിക്കുക. എന്നിട്ട് ഈ ഭാഗം ${N} പ്രാവശ്യം ആവർത്തിക്കുക.`,
      `${W.G} ${g + 1} of ${n}: read it carefully. Then recite it ${N} times. Tap the circle each time you finish.`) +
    focusHTML(a, d, [g], true) +
    counterHTML('g', c, N, `${W.G} ${g + 1}`);
  if (all) html += okNote(n > 1 ? 'എല്ലാ ഭാഗങ്ങളും പൂർത്തിയായി. ഇനി അവ ചേർത്ത് ഓതാം.' : (pg ? 'ഈ ഭാഗം പൂർത്തിയായി. ഇനി മുഴുവൻ പേജ് ആവർത്തിക്കാം.' : 'ഈ ഭാഗം പൂർത്തിയായി. ഇനി മുഴുവൻ ആയത്ത് ആവർത്തിക്കാം.'),
    n > 1 ? `All ${W.gs} are done. Now let us join them together.` : `Done! Now repeat the whole ${W.u}.`);
  else if (done) html += okNote(`ഭാഗം ${g + 1} പൂർത്തിയായി! ഇനി ഈ ഭാഗം മറച്ച് നോക്കാതെ ഒരിക്കൽ ഓതി നോക്കുക.`, `${W.G} ${g + 1} is done! Now hide it and try once without looking.`);
  html += groupNavHTML(a, d);
  const next = all ? (n > 1 ? primaryBtn('goto', `Join the ${W.gs}`, ' data-stage="4"') : primaryBtn('goto', `Repeat the full ${W.u}`, ' data-stage="5"'))
    : done ? primaryBtn('nextgroup', `Continue to ${W.g} ${(() => { const og = firstOpenGroup(a, g + 1); return (og >= 0 ? og : Math.min(n - 1, g + 1)) + 1; })()}`) : '';
  return html + `<div class="ws-actions">${backBtn(2)}${next}</div>`;
}

function ws4(a) {
  const d = D(a), steps = d.steps, N = S.comboReps, pairs = S.joinMethod === 'pairs', W = NOUN(a), pg = isPage(a);
  let html = wsHead(a);
  if (!steps.length) {
    return html + instr(pg ? 'ഈ പേജ് ഒരൊറ്റ ഭാഗമായതിനാൽ ചേർക്കേണ്ടതില്ല. അടുത്ത ഘട്ടത്തിലേക്ക് പോകാം.' : 'ഈ ആയത്ത് ഒരൊറ്റ ഭാഗമായതിനാൽ ചേർക്കേണ്ടതില്ല. അടുത്ത ഘട്ടത്തിലേക്ക് പോകാം.',
      `This ${W.u} has only one ${W.g}, so there is nothing to join. Go to the next stage.`) +
      `<div class="ws-actions">${backBtn(3)}${primaryBtn('goto', `Repeat the full ${W.u}`, ' data-stage="5"')}</div>`;
  }
  const si = a.cs, [r0, r1] = steps[si], c = a.cc[si] || 0, done = c >= N, all = stepsDone(a);
  let ml, en;
  if (pairs) { ml = `ഭാഗം ${r0 + 1}, ${r1 + 1} എന്നിവ ചേർത്ത് ${N} പ്രാവശ്യം ഓതുക.`; en = `Recite ${W.gs} ${r0 + 1} and ${r1 + 1} together ${N} times.`; }
  else if (si === 0) { ml = `ഇപ്പോൾ ഭാഗം 1, 2 എന്നിവ ചേർത്ത് ${N} പ്രാവശ്യം ഓതുക.`; en = `Now recite ${W.gs} 1 and 2 together ${N} times.`; }
  else { ml = `ഇപ്പോൾ അടുത്ത ഭാഗം ചേർത്ത് ഓതുക: ഭാഗം 1 മുതൽ ${r1 + 1} വരെ ${N} പ്രാവശ്യം.`; en = `Now add the next ${W.g}: recite ${W.gs} 1 to ${r1 + 1} together ${N} times.`; }
  html += instr(ml, en);
  if (!pairs && d.groups.length > 8) html += `<div class="banner info">${ic('bulb')}<div>${bi(pg ? 'ഈ പേജിൽ ധാരാളം ഭാഗങ്ങളുണ്ട് — ജോഡികളായി ചേർത്ത് ഓതുന്നത് എളുപ്പമായേക്കാം.' : 'നീളമുള്ള ആയത്താണ് — ജോഡികളായി ചേർത്ത് ഓതുന്നത് എളുപ്പമായേക്കാം.',
    `This ${W.u} has ${d.groups.length} ${W.gs}. Joining them in pairs (1+2, 2+3 …) can be easier.`)}</div><button class="btn btn-xs b-act" type="button" data-set="joinMethod" data-val="pairs">Join in pairs</button></div>`;
  html += `<div class="csteps" role="group" aria-label="Joining steps">${steps.map(([s0, s1], k) => {
    const ok = a.cc[k] >= N;
    return `<button type="button" class="cstep${k === si ? ' on' : ''}${ok ? ' ok' : ''}" data-act="cstep" data-s="${k}"${k === si ? ' aria-current="step"' : ''}><span class="sr">Join ${W.gs} </span>${ok ? ic('check') : ''}${s0 + 1}${s1 - s0 === 1 ? ' + ' : '–'}${s1 + 1}${ok ? '<span class="sr">, done</span>' : ''}</button>`;
  }).join('')}</div>`;
  html += focusHTML(a, d, range(r0, r1), true);
  html += counterHTML('c', c, N, `${W.Gs} ${r0 + 1} to ${r1 + 1}`);
  const nxt = firstOpenStep(a);
  if (all) html += okNote(pg ? 'ഭാഗങ്ങൾ എല്ലാം ചേർന്നു! ഇനി മുഴുവൻ പേജ് ആവർത്തിക്കാം.' : 'ഭാഗങ്ങൾ എല്ലാം ചേർന്നു! ഇനി മുഴുവൻ ആയത്ത് ആവർത്തിക്കാം.', `All ${W.gs} are joined! Now repeat the whole ${W.u}.`);
  else if (done) html += okNote('നന്നായി! ഇനി അടുത്ത ഭാഗം ചേർക്കാം.', `Well done! Now add the next ${W.g}.`);
  const nextBtn = all ? primaryBtn('goto', `Repeat the full ${W.u}`, ' data-stage="5"')
    : done ? primaryBtn('nextstep', pairs ? 'Next pair' : `Add ${W.g} ${steps[nxt >= 0 ? nxt : Math.min(si + 1, steps.length - 1)][1] + 1}`) : '';
  return html + `<div class="ws-actions">${backBtn(3)}${nextBtn}</div>`;
}

function ws5(a) {
  const N = fullTarget(a), c = a.fc, done = c >= N, W = NOUN(a), pg = isPage(a);
  const base = pg ? [3, 5, 7, 10, S.pageReps] : [5, 10, 15, S.ayahReps];
  const opts = Array.from(new Set(base.concat(N))).sort((x, y) => x - y);
  let html = wsHead(a, audioBtn(pg ? 'page' : 'ayah', 'Listen')) +
    instr(pg ? `മുഴുവൻ പേജും ${N} പ്രാവശ്യം ആവർത്തിക്കുക.` : `മുഴുവൻ ആയത്തും ${N} പ്രാവശ്യം ആവർത്തിക്കുക.`, `Repeat the whole ${W.u} ${N} times.`) +
    `<div class="row"><span class="row-label">Target</span><div class="seg" role="radiogroup" aria-label="Full ${W.u} repetition target">${opts.map(k => `<button type="button" role="radio" aria-checked="${k === N}" data-act="settarget" data-n="${k}">${k}×</button>`).join('')}</div>
      <button class="btn btn-xs btn-ghost" type="button" data-act="toggleayah" data-fk="hide5">${ic(a.hidden ? 'eye' : 'eye-off', 'ic-sm')}${a.hidden ? `Show ${W.u}` : `Recite with the ${W.u} hidden`}</button></div>` +
    counterHTML('f', c, N, `Full ${W.u}`);
  if (done) html += okNote(pg ? 'നന്നായി! ഇനി പേജ് മറച്ച് നോക്കാതെ ഓതാൻ ശ്രമിക്കാം.' : 'നന്നായി! ഇനി ആയത്ത് മറച്ച് നോക്കാതെ ഓതാൻ ശ്രമിക്കാം.', `Well done! Now hide the ${W.u} and recite it from memory.`);
  return html + `<div class="ws-actions">${backBtn(4)}${done ? primaryBtn('goto', 'Hide &amp; recall', ' data-stage="6"') : '<button class="btn btn-sm grow" type="button" data-act="goto" data-stage="6">Skip to hide &amp; recall</button>'}</div>`;
}

function optHTML(r, cls, icon, en, ml) {
  return `<button type="button" class="opt ${cls}" data-act="assess" data-r="${r}"><span class="o-ic">${ic(icon)}</span><span class="o-en">${en}</span><span class="o-ml" lang="ml">${ml}</span></button>`;
}
function ws6(a, i) {
  const d = D(a), n = d.groups.length, last = i === L.ayahs.length - 1, W = NOUN(a), pg = isPage(a);
  let html = wsHead(a);
  if (!a.revealed) {
    const allShown = d.words.every((_, wi) => wordVisible(a, d, wi));
    return html + instr(pg ? 'ഇപ്പോൾ പേജ് മറച്ച് നോക്കാതെ ഓതാൻ ശ്രമിക്കുക. ഓതിയ ശേഷം പേജ് കാണിച്ച് ശരിയാണോ എന്ന് പരിശോധിക്കുക.' : 'ഇപ്പോൾ ആയത്ത് മറച്ച് നോക്കാതെ ഓതാൻ ശ്രമിക്കുക. ഓതിയ ശേഷം ആയത്ത് കാണിച്ച് ശരിയാണോ എന്ന് പരിശോധിക്കുക.',
      `Recite the ${W.u} from memory. When you finish, show it and check.`) +
      `<div class="ws-actions"><button class="btn btn-sm" type="button" data-act="peek" data-fk="peek"${allShown ? ' disabled' : ''}>${ic('spark')}Peek next word</button>${a.hints ? `<span class="hint">You peeked at ${a.hints} ${plural(a.hints, 'word')}.</span>` : ''}<button class="btn btn-primary grow" type="button" data-act="reveal" data-fk="primary">${ic('eye')}Show &amp; check</button></div>`;
  }
  if (a.result === null) {
    html += instr(pg ? 'പേജ് നോക്കി, നിങ്ങൾ ഓതിയത് ശരിയായിരുന്നോ എന്ന് പരിശോധിക്കുക. എങ്ങനെയുണ്ടായിരുന്നു?' : 'ആയത്ത് നോക്കി, നിങ്ങൾ ഓതിയത് ശരിയായിരുന്നോ എന്ന് പരിശോധിക്കുക. എങ്ങനെയുണ്ടായിരുന്നു?',
      `Look at the ${W.u} above. Was your recitation correct? Choose honestly.`) +
      `<div class="assess" role="group" aria-label="How well did you recall this ${W.u}?">
        ${optHTML('mastered', 'o1', 'check', 'Memorized without looking', 'നോക്കാതെ ശരിയായി ഓതി')}
        ${optHTML('assisted', 'o2', 'hand', 'Memorized with some help', 'ചെറിയ സഹായത്തോടെ ഓതി')}
        ${optHTML('revise', 'o3', 'repeat', 'Needs more revision', 'ഇനിയും പഠിക്കണം')}
      </div>`;
    if (a.hints) html += `<p class="hint">You peeked at ${a.hints} ${plural(a.hints, 'word')}, so “with some help” may fit best.</p>`;
    return html + `<div class="ws-actions"><button class="btn btn-sm btn-ghost" type="button" data-act="retest">${ic('eye-off')}Hide again &amp; retry</button></div>`;
  }
  if (a.result === 'mastered') {
    const np = pg ? nextPageOf(a.n) : null;
    const nextBtn = pg ? (np ? `<button class="btn btn-gold grow" type="button" data-act="gopage" data-p="${np}" data-fk="primary">Next page: ${np}${ic('arrow-r')}</button>` : '')
      : `<button class="btn btn-gold grow" type="button" data-act="nextayah" data-fk="primary">${last ? 'Join all ayahs' : 'Next ayah'}${ic('arrow-d')}</button>`;
    return html + okNote(pg ? 'അൽഹംദുലില്ലാഹ്! ഈ പേജ് മനഃപാഠമായി.' : 'അൽഹംദുലില്ലാഹ്! ഈ ആയത്ത് മനഃപാഠമായി.', `Alhamdulillah! This ${W.u} is memorized.`, 'gold') +
      `<div class="ws-actions"><button class="btn btn-sm btn-ghost" type="button" data-act="retest">${ic('repeat')}Test again</button>${nextBtn}</div>`;
  }
  if (a.result === 'assisted') {
    return html + okNote(pg ? 'ഏകദേശം ശരിയായി. മുഴുവൻ പേജ് കുറച്ചുകൂടി ആവർത്തിച്ച് വീണ്ടും ശ്രമിക്കുക.' : 'ഏകദേശം ശരിയായി. മുഴുവൻ ആയത്ത് കുറച്ചുകൂടി ആവർത്തിച്ച് വീണ്ടും ശ്രമിക്കുക.',
      `Almost there. Repeat the whole ${W.u} a few more times, then try again.`, 'blue', 'hand') +
      `<div class="ws-actions"><button class="btn btn-sm" type="button" data-act="repeatfull">${ic('repeat')}Repeat the full ${W.u}</button><button class="btn btn-primary grow" type="button" data-act="retest" data-fk="primary">${ic('eye-off')}Hide &amp; try again</button></div>`;
  }
  html += okNote('ശരിയായി ഓർത്തെടുക്കാൻ കഴിയാത്ത ഭാഗം വീണ്ടും പഠിക്കുക.', 'Study again the part you could not remember well.', 'amber', 'repeat');
  if (n > 1) {
    const chips = pg
      ? `<div class="parts-list">${d.parts.map((p, gi) => `<button type="button" class="pchip c${colorOf(a, d, gi)}" data-act="weak" data-g="${gi}" data-fk="weak-${gi}" aria-pressed="${a.weak.includes(gi)}"><span class="pn">${gi + 1}</span><span class="pr">${partRef(a, d, [gi])}</span></button>`).join('')}</div>`
      : `<div class="weak-pick" lang="ar" dir="rtl">${d.groups.map((g, gi) => `<button type="button" class="grp c${(gi % 4) + 1}" data-act="weak" data-g="${gi}" data-fk="weak-${gi}" aria-pressed="${a.weak.includes(gi)}"><span class="gnum" aria-hidden="true">${gi + 1}</span><span class="sr">Group ${gi + 1}: </span><span class="gtxt">${g.map(wi => `<span class="w">${esc(d.words[wi].t)}</span>`).join(' ')}</span></button>`).join('')}</div>`;
    html += `<div><p class="row-label" style="margin-bottom:12px">Tap the ${W.gs} that were hard${pg ? ' — here or on the page' : ''}${mlTag('· ബുദ്ധിമുട്ടുള്ള ഭാഗങ്ങൾ തിരഞ്ഞെടുക്കുക')}</p>${chips}</div>`;
  }
  const k = a.weak.length;
  return html + `<div class="ws-actions"><button class="btn btn-sm btn-ghost" type="button" data-act="retest">${ic('eye-off')}Hide &amp; test again</button><button class="btn btn-sm btn-ghost" type="button" data-act="restartayah">${ic('refresh')}Start this ${W.u} again</button>${primaryBtn('practiceweak', n > 1 ? (k ? `Practice ${k} ${plural(k, W.g)} again` : `Choose ${W.gs} to practice`) : 'Practice again', n > 1 && !k ? ' disabled' : '')}</div>`;
}

/* ---------- lesson-level: join card & meta ---------- */
function nextRefOf(l) {
  if (l.kind === 'page') { const n = nextPageOf(l.page); return n ? { kind: 'page', page: n } : null; }
  const su = surahOf(l.surah);
  if (l.to >= su.ayahs) return null;
  const len = Math.min(MAX_AYAHS, l.to - l.from + 1);
  return { kind: 'ayah', surah: l.surah, from: l.to + 1, to: Math.min(su.ayahs, l.to + len) };
}
function joinCardHTML() {
  if (L.kind === 'page') return pageAfterHTML();
  const sel = L.ayahs.filter(a => a.sel), total = L.ayahs.length, mastered = L.ayahs.filter(isMastered).length, N = S.joinReps;
  const allDone = mastered === total;
  let html = `<section class="card join-card" id="joinCard" aria-labelledby="joinT">
    <div class="ws-head"><div class="ws-t"><p class="ws-kicker">After the ayahs</p><h2 class="ws-title" id="joinT">Join the ayahs together</h2><p class="ws-ml" lang="ml">ആയത്തുകൾ ചേർത്ത് ഓതുക</p></div>${audioBtn('range', 'Listen')}</div>`;
  if (allDone) html += `<div class="done-card"><span class="badge">${ic('check')}</span><p class="h2">Alhamdulillah!</p>${EN() ? '' : '<p lang="ml">ഈ പാഠത്തിലെ എല്ലാ ആയത്തുകളും മനഃപാഠമായി.</p>'}<p class="muted small">All ${total} ${plural(total, 'ayah')} in this lesson are marked as memorized.</p></div>`;
  html += instr(`പഠിച്ച ആയത്തുകൾ ക്രമത്തിൽ ചേർത്ത് ${N} പ്രാവശ്യം ഓതുക. പുതിയ ആയത്തുകൾ മുമ്പ് പഠിച്ചവയോട് ചേർത്ത് ഓതുമ്പോൾ മനഃപാഠം ഉറയ്ക്കും.`,
    `Recite the selected ayahs together, in order, ${N} times. Joining new ayahs with old ones makes your memory strong.`);
  if (!sel.length) html += '<p class="hint">Tick the checkbox on each ayah card to include it here.</p>';
  else {
    const hid = L.join.hidden;
    const maskBtn = `<div class="m-act"><button class="btn btn-sm btn-primary" type="button" data-act="jtoggle" data-fk="jshow">${ic('eye')}Show ayahs</button></div>`;
    html += `<div class="join-txt${hid ? ' concealed' : ''}"><p class="ar-flow" lang="ar" dir="rtl"${hid ? ' aria-hidden="true"' : ''}>${sel.map(a => glueEnd(a.text.trim().split(/\s+/).map(esc), `<span class="ayah-end">${toAr(a.n)}</span>`)).join(' ')}</p>${hid ? maskHTML(sel.length > 1 ? 'ആയത്തുകൾ മറച്ചിരിക്കുന്നു — ഓർത്ത് ഓതിയ ശേഷം കാണിക്കുക.' : 'ആയത്ത് മറച്ചിരിക്കുന്നു — ഓർത്ത് ഓതിയ ശേഷം കാണിക്കുക.', 'The ayahs are hidden. Recite them from memory, then show them.', maskBtn) : ''}</div>
      <div class="row"><span class="row-label">${sel.length === total ? 'All ayahs' : 'Ayahs ' + sel.map(a => a.n).join(', ')}</span>${hid ? '' : `<button class="btn btn-xs btn-ghost" type="button" data-act="jtoggle" data-fk="jhide">${ic('eye-off', 'ic-sm')}Hide ayahs</button>`}</div>
      ${counterHTML('j', L.join.count, N, 'Joined ayahs')}`;
    if (L.join.count >= N) html += okNote('നന്നായി! ആയത്തുകൾ ചേർത്ത് ഓതി.', 'Well done! The ayahs are joined.');
  }
  html += `<div class="callout">${ic('bulb')}<div>${bi('ഓർമ്മിക്കുക: ഇന്ന് പഠിച്ച ആയത്തുകൾ ഇന്ന് രാത്രിയും നാളെ പുതിയ പാഠത്തിന് മുമ്പും ഒരിക്കൽക്കൂടി ഓതുക.', 'Revision reminder: recite today’s ayahs again tonight, and once more tomorrow before your new lesson.')}</div></div>`;
  if (allDone) {
    const nx = nextRefOf(L);
    html += `<div class="ws-actions">${nx ? `<button class="btn btn-primary grow" type="button" data-act="startref" ${refAttrs(nx)}>Next lesson: ${rangeLabel(nx.from, nx.to).toLowerCase()}${ic('arrow-r')}</button>` : `<button class="btn btn-primary grow" type="button" data-act="home">Choose another surah${ic('arrow-r')}</button>`}</div>`;
  }
  return html + '</section>';
}
function pageAfterHTML() {
  const u = L.ayahs[0], done = isMastered(u), N = S.joinReps, p = L.page;
  const lastP = history10().find(e => e.k === 'p' && e.p !== p);
  let html = `<section class="card join-card" id="joinCard" aria-labelledby="joinT">
    <div class="ws-head"><div class="ws-t"><p class="ws-kicker">After this page</p><h2 class="ws-title" id="joinT">Join with your earlier pages</h2><p class="ws-ml" lang="ml">മുമ്പ് പഠിച്ച പേജുകളുമായി ചേർത്ത് ഓതുക</p></div></div>`;
  if (done) html += `<div class="done-card"><span class="badge">${ic('check')}</span><p class="h2">Alhamdulillah!</p>${EN() ? '' : '<p lang="ml">ഈ പേജ് മനഃപാഠമായി.</p>'}<p class="muted small">Page ${p} is marked as memorized.</p></div>`;
  html += instr(`ഈ പേജ് മനഃപാഠമായ ശേഷം, മുമ്പ് പഠിച്ച പേജുകളുമായി ചേർത്ത് ${N} പ്രാവശ്യം ഓതുക. പുതിയ പേജ് പഴയവയോട് ചേർക്കുമ്പോൾ മനഃപാഠം ഉറയ്ക്കും.`,
    `When this page is memorized, recite it together with the pages you learned before, ${N} times. Joining new pages with old ones makes your memory strong.`);
  if (lastP) html += `<p class="hint">${ic('book', 'ic-sm')} Your last page lesson: page ${lastP.p} · ${esc(pageSummary(lastP.p).label)}</p>`;
  html += counterHTML('j', L.join.count, N, 'Recited with earlier pages');
  if (L.join.count >= N) html += okNote('നന്നായി! പേജുകൾ ചേർത്ത് ഓതി.', 'Well done! The pages are joined.');
  html += `<div class="callout">${ic('bulb')}<div>${bi('ഓർമ്മിക്കുക: ഇന്ന് പഠിച്ച പേജ് ഇന്ന് രാത്രിയും നാളെ പുതിയ പേജിന് മുമ്പും ഒരിക്കൽക്കൂടി ഓതുക.', 'Revision reminder: recite today’s page again tonight, and once more tomorrow before your new page.')}</div></div>`;
  const np = nextPageOf(p), other = np === p - 1 ? p + 1 : p - 1;
  const otherBtn = other >= 1 && other <= PAGE_COUNT ? `<button class="btn btn-sm btn-ghost" type="button" data-act="gopage" data-p="${other}">${ic(other < p ? 'chev-l' : 'chev-r')}Page ${other}</button>` : '';
  html += `<div class="ws-actions">${otherBtn}${np ? `<button class="btn btn-primary grow" type="button" data-act="gopage" data-p="${np}">Next page: ${np}${ic('arrow-r')}</button>` : `<button class="btn btn-primary grow" type="button" data-act="home">Back to lessons${ic('arrow-r')}</button>`}</div>`;
  return html + '</section>';
}
function updateJoin() {
  const el = $('#joinCard'); if (!el || !L) return;
  const ae = document.activeElement, fk = ae && el.contains(ae) ? ae.getAttribute('data-fk') : null;
  el.outerHTML = joinCardHTML();
  if (fk) { const t = $(`#joinCard [data-fk="${fk}"]`); if (t && !t.disabled) t.focus({ preventScroll: true }); }
}

function refreshMeta() {
  if (!L || L.status !== 'ready' || $('#lessonView').hidden) { $('#statusChip').hidden = true; $('#topbar').classList.remove('has-status'); return; }
  const a = L.ayahs[L.active] || L.ayahs[0], info = progressInfo(a);
  const stats = $('#lhStats');
  if (L.kind === 'page') {
    const d = D(a), split = a.split || S.pageSplit, ps = pageSummary(L.page);
    if (stats) stats.innerHTML = `
      <div class="stat"><p class="k">Ayahs on page</p><p class="v">${a.items.length} <small class="sep">Juz ${ps.juz}</small></p></div>
      <div class="stat"><p class="k">Parts</p><p class="v">${d.groups.length} <small class="sep">${split === 'manual' ? 'colored by hand' : `${split} ayahs each`}</small></p></div>
      <div class="stat"><p class="k">Current</p><p class="v">Stage ${a.stage} <small class="sep">of 6</small></p></div>
      <div class="stat"><p class="k">Progress</p><p class="v" title="${esc(info)}">${esc(info)}</p></div>`;
  } else {
    const total = L.ayahs.length, mastered = L.ayahs.filter(isMastered).length, selected = L.ayahs.filter(x => x.sel).length;
    if (stats) stats.innerHTML = `
      <div class="stat"><p class="k">Ayahs in lesson</p><p class="v">${total} <small class="sep">${selected} selected</small></p></div>
      <div class="stat"><p class="k">Memorized</p><p class="v">${mastered} <small>of ${total}</small></p><div class="bar"><i style="width:${(mastered / total * 100).toFixed(1)}%"></i></div></div>
      <div class="stat"><p class="k">Current</p><p class="v">Ayah ${a.n} <small class="sep">Stage ${a.stage} of 6</small></p></div>
      <div class="stat"><p class="k">Progress</p><p class="v" title="${esc(info)}">${esc(info)}</p></div>`;
    const pills = $('#lhPills');
    if (pills) pills.innerHTML = L.ayahs.map((x, i) => `<button type="button" class="pill${isMastered(x) ? ' m' : x.result === 'revise' ? ' r' : ''}${i === L.active ? ' cur' : ''}" data-act="jump" data-i="${i}" aria-label="Ayah ${x.n}${isMastered(x) ? ', memorized' : ''}"${i === L.active ? ' aria-current="true"' : ''}>${isMastered(x) ? ic('check') : ''}${x.n}</button>`).join('');
    const sa = $('#selAll');
    if (sa) { sa.checked = selected === total; sa.indeterminate = selected > 0 && selected < total; }
    const hb = $('#btnHideSel');
    if (hb) { const sel = L.ayahs.filter(x => x.sel); const anyShown = sel.some(x => !x.hidden); hb.innerHTML = `${ic(anyShown || !sel.length ? 'eye-off' : 'eye')}${anyShown || !sel.length ? 'Hide selected ayahs' : 'Show selected ayahs'}`; hb.disabled = !sel.length; }
  }
  const tb = $('#trBanner');
  if (tb) tb.innerHTML = L.trEd !== 'none' && L.ayahs.some(x => x.trSt === 'error')
    ? `<div class="banner warn">${ic('info')}<div>The ${esc(trInfo(L.trEd).name)} translation could not be loaded. You can still memorize — the Arabic text is complete.</div><button class="btn btn-xs b-act" type="button" data-act="retrytr">${ic('refresh', 'ic-sm')}Retry</button></div>` : '';
  const chip = $('#statusChip');
  chip.hidden = false; $('#topbar').classList.add('has-status');
  $('#statusTxt').textContent = `${L.kind === 'page' ? 'Page' : 'Ayah'} ${a.n} · Stage ${a.stage}`;
  $('#statusExtra').textContent = ' · ' + info;
}

function updateCard(i, parts, enter) {
  const el = cardEl(i); if (!el) return;
  const p = parts || 'hstxw';
  const ae = document.activeElement, fk = ae && el.contains(ae) ? ae.getAttribute('data-fk') : null;
  if (p.includes('h')) el.querySelector('.ac-head').innerHTML = headHTML(i);
  if (p.includes('s')) el.querySelector('.ac-steps').innerHTML = stepsHTML(i);
  if (p.includes('t')) el.querySelector('.ac-text').innerHTML = textHTML(i);
  if (p.includes('x')) el.querySelector('.ac-trans').innerHTML = transHTML(i);
  if (p.includes('w')) el.querySelector('.ac-work').innerHTML = workHTML(i, !!enter);
  el.classList.toggle('mastered', isMastered(L.ayahs[i]));
  if (fk) { const t = el.querySelector(`[data-fk="${fk}"]`); if (t && !t.disabled) t.focus({ preventScroll: true }); }
}
function updateAll(parts) { if (!L || L.status !== 'ready') return; L.ayahs.forEach((_, i) => updateCard(i, parts || 'hstxw')); updateJoin(); refreshMeta(); }

function setActive(i) {
  if (!L || L.status !== 'ready' || i == null || !L.ayahs[i]) return;
  if (L.active !== i) {
    L.active = i;
    $$('.ayah-card').forEach(el => el.classList.toggle('active', +el.dataset.i === i));
    persist();
  }
  refreshMeta();
}
function ensureVisible(el) {
  if (!el) return;
  const r = el.getBoundingClientRect(), top = topBarHeight() + 10;
  if (r.top < top || r.top > window.innerHeight * 0.6) window.scrollTo({ top: Math.max(0, window.scrollY + r.top - top), behavior: scrollBehavior() });
}
function scrollToCard(i) {
  const el = cardEl(i); if (!el) return;
  el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
}

/* ---------------------------------------------------------------------
   15. Actions
   --------------------------------------------------------------------- */
function goStage(i, s, mark) {
  const a = L.ayahs[i]; if (!a || s < 1 || s > 6) return;
  if (mark === 1) a.d1 = true;
  if (mark === 2) a.d2 = true;
  const d = D(a);
  if (s !== a.stage) a.gh = d.groups.map(() => false);
  if (s === 6) {
    if (a.result === null) { a.hidden = true; a.revealed = false; a.peek = 0; a.hints = 0; }
    else { a.hidden = false; a.revealed = true; }
  } else a.hidden = false;
  if (s === 3 && a.stage !== 3) { const og = firstOpenGroup(a, 0); if (og >= 0) a.g = og; }
  if (s === 4) { const os = firstOpenStep(a); if (os >= 0) a.cs = os; }
  a.stage = s; a.showTr = false;
  updateCard(i, 'hstxw', true);
  setActive(i); updateJoin(); persist();
  const el = cardEl(i);
  const title = el && el.querySelector('.ws-title');
  if (title) title.focus({ preventScroll: true });
  if (S.autoScroll && el) ensureVisible(el.querySelector(isPage(a) && s >= 3 && s <= 4 ? '.ac-work' : '.ac-text'));
  announce(`${NOUN(a).U} ${a.n}, stage ${s}: ${stageOf(a, s).en}`);
}

let lastTap = 0;
function count(i, kind, delta) {
  if (delta > 0) { const now = Date.now(); if (now - lastTap < 200) return; lastTap = now; }
  let a = null, N, get, set;
  if (kind === 'j') { N = S.joinReps; get = () => L.join.count; set = v => { L.join.count = v; }; }
  else {
    a = L.ayahs[i]; if (!a) return;
    const d = D(a);
    if (kind === 'g') { N = S.groupReps; get = () => a.gc[a.g] || 0; set = v => { a.gc[a.g] = v; }; }
    else if (kind === 'c') { if (!d.steps.length) return; N = S.comboReps; get = () => a.cc[a.cs] || 0; set = v => { a.cc[a.cs] = v; }; }
    else { N = fullTarget(a); get = () => a.fc; set = v => { a.fc = v; }; }
  }
  const before = get(), after = delta === 0 ? 0 : Math.max(0, Math.min(999, before + delta));
  if (after === before) return;
  set(after);
  const crossed = (before >= N) !== (after >= N);
  if (kind === 'j') { if (crossed || delta === 0 || !patchCounter($('#joinCard'), 'j', after, N)) updateJoin(); }
  else if (crossed || delta === 0 || !patchCounter(cardEl(i), kind, after, N)) updateCard(i, 'hstw');
  if (delta > 0 && S.vibrate && navigator.vibrate) { try { navigator.vibrate(after === N ? [18, 60, 18] : 10); } catch (e) { /* ignore */ } }
  announce(after >= N && before < N ? `${after} of ${N}. Target reached.` : `${after} of ${N}`);
  if (a) setActive(i); else refreshMeta();
  persist();
}

function toggleAyah(i) {
  const a = L.ayahs[i];
  if (a.stage === 6) {
    if (a.hidden) { reveal(i); return; }
    a.hidden = true; a.peek = 0;
    if (a.result === null) a.revealed = false;
  } else { a.hidden = !a.hidden; a._rv = !a.hidden; }
  updateCard(i, 'htw'); setActive(i); persist();
}
function reveal(i) {
  const a = L.ayahs[i];
  a.hidden = false; a.revealed = true; a._rv = true;
  updateCard(i, 'htw'); setActive(i); persist();
  announce(`${NOUN(a).U} ${a.n} shown. Choose how well you recalled it.`);
}
function peek(i) {
  const a = L.ayahs[i], d = D(a);
  if (!a.hidden) return;
  const idx = d.words.findIndex((_, wi) => !wordVisible(a, d, wi));
  if (idx < 0) return;
  a.peek = idx + 1; a.hints += 1;
  updateCard(i, 'tw'); setActive(i); persist();
}
function assess(i, r) {
  const a = L.ayahs[i];
  a.result = r; a.weak = []; a.hidden = false; a.revealed = true;
  if (r === 'mastered' && SID) HifzStore.markDone(SID, isPage(a) ? a.items.map(x => gid(x.s, x.a)) : [gid(L.surah, a.n)]);
  updateCard(i, 'hstw'); setActive(i); updateJoin(); saveNow();
  if (r === 'mastered' && L.ayahs.every(isMastered)) toast(L.kind === 'page' ? 'Alhamdulillah! This page is memorized.' : 'Alhamdulillah! Every ayah in this lesson is memorized.', 'അൽഹംദുലില്ലാഹ്! ഈ പാഠം പൂർത്തിയായി.', 'check');
}
function retest(i) {
  const a = L.ayahs[i];
  Object.assign(a, { hidden: true, revealed: false, peek: 0, hints: 0, result: null, weak: [] });
  updateCard(i, 'hstw'); setActive(i); updateJoin(); persist();
  const el = cardEl(i); if (el && S.autoScroll) ensureVisible(el.querySelector('.ac-text'));
}
function practiceWeak(i) {
  const a = L.ayahs[i], d = D(a);
  const list = d.groups.length > 1 ? a.weak.slice().sort((x, y) => x - y) : [0];
  if (!list.length) return;
  list.forEach(gi => { a.gc[gi] = 0; });
  d.steps.forEach(([s0, s1], k) => { if (list.some(gi => gi >= s0 && gi <= s1)) a.cc[k] = 0; });
  a.fc = 0; a.result = null; a.revealed = false; a.weak = []; a.g = list[0];
  goStage(i, 3);
}
async function setAyahSize(i, k) {
  const a = L.ayahs[i], next = k || null;
  if ((a.size || null) === next) return;
  if (hasGroupProgress(a)) {
    const ok = await confirmBox({ title: 'Divide this ayah again?', body: `Ayah ${a.n} will be divided into groups of ${next || S.groupSize} words. Its group and joining counts will start again.`, ml: 'ഈ ആയത്തിന്റെ ഭാഗങ്ങളുടെ ആവർത്തന എണ്ണം വീണ്ടും തുടങ്ങും.', ok: 'Divide again' });
    if (!ok) return;
  }
  a.size = next; D(a);
  updateCard(i, 'hstw'); setActive(i); persist();
}
// page: how to divide (3/4/5 ayahs, or colored by hand)
async function confirmRepartition(a, trial) {
  const before = partitionKey(D(a).parts), after = partitionKey(pagePartition(trial).parts);
  if (before === after || !hasGroupProgress(a)) return true;
  return confirmBox({ title: 'Change the parts?', body: 'The part and joining counts for this page will start again. Your full-page count is kept.', ml: 'ഭാഗങ്ങളുടെ ആവർത്തന എണ്ണം വീണ്ടും തുടങ്ങും.', ok: 'Change parts' });
}
async function setSplit(i, v) {
  const a = L.ayahs[i]; if (!isPage(a)) return;
  const next = v === 'manual' ? 'manual' : clampInt(v, 3, 5, 3);
  if ((a.split || S.pageSplit) === next) return;
  let colors = a.colors;
  if (next === 'manual' && colors.length !== a.items.length) { const d = D(a); colors = a.items.map((_, k) => d.pcols[d.partOf[k]]); }
  if (!(await confirmRepartition(a, Object.assign({}, a, { split: next, colors })))) return;
  a.split = next; a.colors = colors;
  D(a); updateCard(i, 'hstxw'); setActive(i); refreshMeta(); persist();
}
async function paint(i, k) {
  const a = L.ayahs[i]; if (!isPage(a) || a.split !== 'manual' || a.stage !== 2 || !a.items[k]) return;
  if (a.colors[k] === a.brush) return;
  const colors = a.colors.slice(); colors[k] = a.brush;
  if (!(await confirmRepartition(a, Object.assign({}, a, { colors })))) return;
  a.colors = colors;
  const d = D(a); a.g = d.partOf[k];
  updateCard(i, 'stxw'); setActive(i); refreshMeta(); persist();
  const el = cardEl(i), t = el && el.querySelector(`[data-act="paint"][data-k="${k}"]`); if (t) t.focus({ preventScroll: true });
  announce(`Ayah ${a.items[k].a} colored ${PALETTE[a.brush]}. The page now has ${d.groups.length} parts.`);
}
async function resetPaint(i) {
  const a = L.ayahs[i]; if (!isPage(a)) return;
  const parts = autoParts(a.items, S.pageSplit), colors = [];
  parts.forEach((p, j) => p.forEach(k => { colors[k] = j % 4; }));
  if (!(await confirmRepartition(a, Object.assign({}, a, { colors })))) return;
  a.colors = colors; D(a); updateCard(i, 'stxw'); refreshMeta(); persist();
}
function hideSelected() {
  if (L.kind === 'page') return;
  const sel = L.ayahs.filter(a => a.sel);
  if (!sel.length) { toast('Select at least one ayah first.', 'ആദ്യം ഒരു ആയത്തെങ്കിലും തിരഞ്ഞെടുക്കുക.'); return; }
  const hide = sel.some(a => !a.hidden);
  L.ayahs.forEach((a, i) => {
    if (!a.sel) return;
    if (hide) { a.hidden = true; a.peek = 0; if (a.stage === 6 && a.result === null) a.revealed = false; }
    else { a.hidden = false; a._rv = true; if (a.stage === 6) a.revealed = true; }
    updateCard(i, 'htw');
  });
  refreshMeta(); persist();
  announce(hide ? 'Selected ayahs hidden' : 'Selected ayahs shown');
}
async function restartLesson() {
  const ok = await confirmBox({ title: 'Restart this lesson?', body: 'All stages and repetition counts will start again. Your notes are kept.', ml: 'ഈ പാഠം ആദ്യം മുതൽ വീണ്ടും തുടങ്ങും.', ok: 'Restart' });
  if (!ok) return;
  L.ayahs.forEach(a => { resetAyahProgress(a); if (L.mode === 'revise') { a.stage = 6; a.d1 = true; a.d2 = true; a.hidden = true; } });
  L.join = { count: 0, hidden: true }; L.active = 0;
  renderLesson(); saveNow();
  window.scrollTo({ top: 0, behavior: scrollBehavior() });
}
function lessonLink() { return location.href.split('#')[0] + lessonHash(refOf(L)); }
async function copyLink() {
  const url = lessonLink();
  try { await navigator.clipboard.writeText(url); toast('Lesson link copied. Anyone who opens it starts this lesson.', 'പാഠത്തിന്റെ ലിങ്ക് കോപ്പി ചെയ്തു.', 'link'); }
  catch (e) { window.prompt('Copy this lesson link:', url); }
}
function nextAyah(i) {
  if (L.kind !== 'page' && i < L.ayahs.length - 1) { setActive(i + 1); scrollToCard(i + 1); }
  else { const j = $('#joinCard'); if (j) j.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }
}
async function goToRef(ref) {
  if (L && L.status === 'ready' && sameRange(refOf(L), ref)) return;
  saveNow();
  const saved = savedLesson();
  if (saved && sameRange(refOf(saved), ref)) { openSaved(saved, true); return; }
  if (!(await okToReplace(saved))) return;
  H.link = null;
  startLesson(ref, 'learn', { push: true });
}

/* ---------------------------------------------------------------------
   16. Dialogs
   --------------------------------------------------------------------- */
function openDialog(d) {
  if (!d) return;
  d._ret = document.activeElement;
  if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  document.documentElement.classList.add('modal-open');
}
function closeDialog(d) {
  if (!d) return;
  if (typeof d.close === 'function') { if (d.open) d.close(); } else { d.removeAttribute('open'); onDialogClosed(d); }
}
function onDialogClosed(d) {
  if (!$$('dialog').some(x => x.open)) document.documentElement.classList.remove('modal-open');
  const r = d && d._ret; if (d) d._ret = null;
  if (r && document.contains(r) && typeof r.focus === 'function') { try { r.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
}
function confirmBox(o) {
  return new Promise(resolve => {
    const d = $('#dlgConfirm'), yes = $('#confYes'), no = $('#confNo');
    const prevFocus = document.activeElement;
    $('#dlgConfT').textContent = o.title || 'Are you sure?';
    $('#confBody').innerHTML = `<p>${esc(o.body || '')}</p>${o.ml && !EN() ? `<p class="c-ml" lang="ml">${esc(o.ml)}</p>` : ''}`;
    yes.textContent = o.ok || 'Continue'; no.textContent = o.cancel || 'Cancel';
    let settled = false;
    const finish = v => {
      if (settled) return; settled = true;
      yes.onclick = null; no.onclick = null; d.oncancel = null;
      if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
      if (!$$('dialog').some(x => x.open)) document.documentElement.classList.remove('modal-open');
      if (prevFocus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
      resolve(v);
    };
    yes.onclick = () => finish(true);
    no.onclick = () => finish(false);
    d.oncancel = e => { e.preventDefault(); finish(false); };
    if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
    document.documentElement.classList.add('modal-open');
    setTimeout(() => no.focus(), 30);
  });
}

/* ---------------------------------------------------------------------
   17. Settings panel
   --------------------------------------------------------------------- */
function renderSettings() {
  const seg = (key, opts, label) => `<div class="seg" role="radiogroup" aria-label="${label}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${S[key] === v}" data-set="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
  const num = (key, min, max, label) => `<div class="stepper sm"><button type="button" data-act="snum" data-key="${key}" data-d="-1" aria-label="Decrease ${label}">−</button><input type="number" inputmode="numeric" min="${min}" max="${max}" value="${S[key]}" data-set="${key}" data-min="${min}" data-max="${max}" aria-label="${label}"><button type="button" data-act="snum" data-key="${key}" data-d="1" aria-label="Increase ${label}">+</button></div>`;
  const sw = (key, label, small) => `<label class="switch"><input type="checkbox" data-set="${key}"${S[key] ? ' checked' : ''}><span class="track"></span><span class="sw-txt">${label}${small ? `<small>${small}</small>` : ''}</span></label>`;
  const radio = (key, v, label, small) => `<label class="radio"><input type="radio" name="r-${key}" data-set="${key}" value="${v}"${S[key] === v ? ' checked' : ''}><span class="dot"></span><span class="r-txt"><span>${label}</span>${small ? `<small>${small}</small>` : ''}</span></label>`;
  $('#settingsBody').innerHTML = `
    <p class="set-who">${ic('info', 'ic-sm')}<span>Settings for <b>${esc(STUDENT ? STUDENT.name : 'this student')}</b> only.</span></p>
    <section class="set-sec"><h3>Language <span lang="ml" class="keep-ml">· ഭാഷ</span></h3><div class="radio-list">
      ${radio('uiLang', 'ml', '<span lang="ml" class="keep-ml">മലയാളം</span> + English', 'Malayalam instructions, with English help.')}
      ${radio('uiLang', 'en', 'English only', 'Simple English everywhere. Malayalam is hidden.')}
    </div><p class="desc">Changing the language also changes the translation to match. You can still pick any translation below.</p></section>
    <section class="set-sec"><h3>Word groups (ayah lessons)</h3>
      <div class="set-row"><span class="lbl">Words per group${mlTag('<small>ഒരു ഭാഗത്തിലെ വാക്കുകൾ</small>')}</span>${seg('groupSize', [[2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6']], 'Words per group')}<p class="desc">Each ayah is divided on its own — words from two ayahs are never mixed. You can also change one ayah in Stage 2.</p></div>
      ${sw('followWaqf', 'Break groups at pause signs', 'Start a new group after a waqf (pause) sign, when the text has one.')}
      <div class="set-row"><span class="lbl">How to join groups and parts</span>${seg('joinMethod', [['cumulative', 'Step by step: 1+2, 1–3 …'], ['pairs', 'In pairs: 1+2, 2+3 …']], 'How to join')}</div>
    </section>
    <section class="set-sec"><h3>Page lessons</h3>
      <div class="set-row"><span class="lbl">Ayahs per part${mlTag('<small>ഒരു ഭാഗത്തിലെ ആയത്തുകൾ</small>')}</span>${seg('pageSplit', [[3, '3 ayahs'], [4, '4 ayahs'], [5, '5 ayahs']], 'Ayahs per part')}<p class="desc">Each page is divided into colored parts. A part never runs across two surahs. In Stage 2 you can also color a page by hand.</p></div>
      <div class="set-row"><span class="lbl">Full page <small>default 5</small></span>${num('pageReps', 1, 50, 'Full page repetitions')}</div>
      <p class="desc">Page numbers follow the standard Madani mushaf (604 pages).</p>
    </section>
    <section class="set-sec"><h3>Repetitions</h3>
      <div class="set-row"><span class="lbl">Each group or part <small>default 5</small></span>${num('groupReps', 1, 50, 'Repetitions per group or part')}</div>
      <div class="set-row"><span class="lbl">Joined groups or parts <small>default 5</small></span>${num('comboReps', 1, 50, 'Repetitions for joined groups or parts')}</div>
      <div class="set-row"><span class="lbl">Full ayah <small>default 10</small></span><div class="set-inline">${seg('ayahReps', [[5, '5'], [10, '10'], [15, '15']], 'Full ayah repetitions')}${num('ayahReps', 1, 99, 'Full ayah repetitions')}</div></div>
      <div class="set-row"><span class="lbl">Joining ayahs or pages <small>default 3</small></span>${num('joinReps', 1, 50, 'Repetitions when joining ayahs or pages')}</div>
      <p class="desc">You count every repetition yourself by tapping the counter. The app does not listen to your recitation.</p>
    </section>
    <section class="set-sec"><h3>Hidden recall (Stage 6)</h3><div class="radio-list">
      ${radio('recallMode', 'full', 'Hide everything', 'Nothing is shown until you show it.')}
      ${radio('recallMode', 'first', 'Show the first word', 'A small hint to start.')}
      ${radio('recallMode', 'groups', 'Show the first word of each group or part', 'A hint at the start of every group or part.')}
    </div></section>
    <section class="set-sec"><h3>Translation</h3><div class="radio-list">
      ${TRANSLATIONS.map(t => radio('translation', t.id, esc(t.name + (t.short ? ' — ' + t.short : '')), t.by ? esc(t.by) : 'Show only the Arabic text.')).join('')}
    </div></section>
    <section class="set-sec"><h3>Display</h3>
      <div class="set-row"><span class="lbl">Arabic text size</span>${seg('arSize', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']], 'Arabic text size')}</div>
      <div class="set-row"><span class="lbl">Quran font</span>${seg('quranFont', [['amiri', 'Amiri Quran'], ['naskh', 'Noto Naskh Arabic']], 'Quran font')}<p class="font-prev" lang="ar" dir="rtl" style="font-family:var(--ar-font)">مَنْزِلُ الْقُرْآنِ</p></div>
      ${EN() ? '' : sw('englishHelp', 'Show English help text', 'Malayalam instructions are always shown.')}
      ${sw('trAlways', 'Show the translation while practicing', 'When off, the meaning is hidden in stages 3, 4 and 6.')}
      ${sw('autoScroll', 'Scroll to the next step by itself')}
      ${navigator.vibrate ? sw('vibrate', 'Vibrate when counting', 'On phones that support it.') : ''}
      ${sw('reduceMotion', 'Reduce motion', 'Turns animations off. Your device setting is always respected.')}
    </section>
    <section class="set-sec"><h3>Saved in this browser</h3>
      <p class="local-note">${ic('lock')}<span>These settings and lessons belong to <b>${esc(STUDENT ? STUDENT.name : 'this student')}</b> and are kept in this browser for now. Cloud sync comes in the next step.${mlTag('<br>ഈ ക്രമീകരണങ്ങളും പുരോഗതിയും ഇപ്പോൾ ഈ ബ്രൗസറിൽ മാത്രമാണ് സൂക്ഷിക്കുന്നത്.')}</span></p>
      <div class="set-inline"><button class="btn btn-sm" type="button" data-act="resetsettings">${ic('refresh')}Reset settings</button><button class="btn btn-sm danger" type="button" data-act="cleardata">${ic('x')}Clear this student’s progress</button></div>
    </section>`;
}
function syncSettingsUI() {
  const body = $('#settingsBody'); if (!body) return;
  $$('[data-set]', body).forEach(el => {
    const key = el.dataset.set, v = S[key];
    if (el.matches('button[data-val]')) el.setAttribute('aria-checked', String(String(v) === el.dataset.val));
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = el.value === v;
    else if (el.type === 'number' && document.activeElement !== el) el.value = v;
  });
}
function settingValue(key, raw) {
  if (typeof DEFAULTS[key] === 'number') {
    const lim = { groupSize: [2, 6], pageSplit: [3, 5], groupReps: [1, 50], comboReps: [1, 50], joinReps: [1, 50], pageReps: [1, 50], ayahReps: [1, 99] }[key] || [1, 99];
    return clampInt(raw, lim[0], lim[1], S[key]);
  }
  if (typeof DEFAULTS[key] === 'boolean') return !!raw;
  return String(raw);
}
function rerenderEverything() {
  applyDisplay();
  $('#tipsBody').innerHTML = tipsHTML();
  if ($('#dlgSettings').open) renderSettings();
  if (!$('#homeView').hidden) { const keep = Object.assign({}, H); renderHome(); Object.assign(H, keep); refreshStartForm(true); }
  if (L && L.status === 'ready' && !$('#lessonView').hidden) renderLesson();
  else if (L && L.status === 'error' && !$('#lessonView').hidden) renderLessonError(L.error);
}
async function changeSetting(key, raw) {
  const val = settingValue(key, raw);
  if (S[key] === val) { syncSettingsUI(); return; }
  if (L && L.status === 'ready' && ['groupSize', 'followWaqf', 'joinMethod', 'pageSplit'].includes(key)) {
    const affected = L.ayahs.filter(a => {
      if (key === 'joinMethod') return a.cc.some(c => c > 0);
      if (isPage(a)) return key === 'pageSplit' && !a.split && hasGroupProgress(a);
      return key !== 'pageSplit' && (key === 'followWaqf' || !a.size) && hasGroupProgress(a);
    });
    if (affected.length) {
      const ok = await confirmBox({ title: key === 'joinMethod' ? 'Change how parts are joined?' : 'Divide again?',
        body: `Group and joining counts will start again where you have progress. Full counts and memorized work are kept.`,
        ml: 'ഭാഗങ്ങളുടെ ആവർത്തന എണ്ണം വീണ്ടും തുടങ്ങും. മനഃപാഠമായവ അതേപടി നിലനിൽക്കും.', ok: 'Apply change' });
      if (!ok) { syncSettingsUI(); return; }
    }
  }
  S[key] = val;
  // the language switch also switches the translation to match
  let trChanged = key === 'translation';
  if (key === 'uiLang') {
    if (val === 'en' && trInfo(S.translation).lang === 'ml') { S.translation = 'en.sahih'; trChanged = true; }
    if (val === 'ml' && trInfo(S.translation).lang === 'en') { S.translation = 'ml.abdulhameed'; trChanged = true; }
  }
  saveSettings(); applyDisplay(); syncSettingsUI();
  const sel = $('#selTr'); if (sel) sel.value = S.translation;
  if (key === 'uiLang') {
    rerenderEverything();
    const r = $('#dlgSettings').open && $('#settingsBody input[data-set="uiLang"]:checked');
    if (r) r.focus({ preventScroll: true });   // the panel was re-drawn in the new language — keep keyboard focus on the choice
    if (trChanged && L && L.status === 'ready' && !$('#lessonView').hidden) reloadTranslation();
    toast(val === 'en' ? 'Language: English only.' : 'Language: Malayalam + English.', val === 'ml' ? 'ഭാഷ: മലയാളം + ഇംഗ്ലീഷ്' : '', 'check');
    return;
  }
  if (L && L.status === 'ready' && !$('#lessonView').hidden) {
    if (trChanged) reloadTranslation();
    else if (!['arSize', 'quranFont', 'reduceMotion', 'autoScroll', 'vibrate', 'startMode'].includes(key)) { updateAll(); persist(); }
  }
  if (!$('#homeView').hidden && ['groupSize', 'groupReps', 'comboReps', 'ayahReps', 'pageSplit', 'pageReps', 'englishHelp'].includes(key)) {
    const keep = Object.assign({}, H); renderHome(); Object.assign(H, keep); refreshStartForm(true);
  }
}

/* ---------------------------------------------------------------------
   18. Event wiring
   --------------------------------------------------------------------- */
const ACTIONS = {
  // global
  home: () => goHome(),
  settings: () => { renderSettings(); openDialog($('#dlgSettings')); },
  tips: () => openDialog($('#dlgTips')),
  closedlg: (i, el) => closeDialog(el.closest('dialog')),
  skip: () => { const m = $('#main'); if (m) { m.focus({ preventScroll: true }); m.scrollIntoView({ block: 'start' }); } },
  toactive: () => { if (L && L.status === 'ready') scrollToCard(L.active); },
  // home & picker
  startmode: (i, el) => { H.mode = el.dataset.m === 'page' ? 'page' : 'ayah'; S.startMode = H.mode; saveSettings(); refreshStartForm(true); },
  openpicker: (i, el) => openPicker(el.dataset.for === 'page'),
  pick: (i, el) => pickSurah(+el.dataset.n),
  pfilter: (i, el) => { P.filter = el.dataset.f; renderSurahList(); },
  porder: () => { P.reverse = !P.reverse; renderSurahList(); },
  rng: (i, el) => {
    const su = surahOf(H.surah), f = el.dataset.f, dlt = +el.dataset.d;
    const cur = Number.isInteger(H[f]) ? H[f] : 1;
    H[f] = Math.min(su.ayahs, Math.max(1, cur + dlt));
    if (f === 'from' && Number.isInteger(H.to) && H.from > H.to) H.to = H.from;
    if (f === 'to' && Number.isInteger(H.from) && H.to < H.from) H.from = H.to;
    refreshStartForm(true);
  },
  pgstep: (i, el) => { const cur = Number.isInteger(H.page) ? H.page : 1; H.page = Math.min(PAGE_COUNT, Math.max(1, cur + (+el.dataset.d))); refreshStartForm(true); },
  quick: (i, el) => { H.from = +el.dataset.a; H.to = +el.dataset.b; refreshStartForm(true); },
  quickpage: (i, el) => { H.page = +el.dataset.p; refreshStartForm(true); },
  start: () => startFromForm(),
  resume: () => { const s = savedLesson(); if (s) openSaved(s, true); else { toast('The saved lesson could not be opened.'); renderHome(); } },
  discard: async () => {
    const ok = await confirmBox({ title: 'Remove the saved lesson?', body: 'Its progress will be removed from this browser. Memorized work stays in your revision list.', ml: 'സൂക്ഷിച്ച പാഠം ഈ ബ്രൗസറിൽ നിന്ന് നീക്കം ചെയ്യും.', ok: 'Remove' });
    if (ok) { store.del(KEY.lesson); L = null; renderHome(); }
  },
  revise: (i, el) => startLesson(refFromEl(el), 'revise', { push: true }),
  startref: (i, el) => { H.link = null; startLesson(refFromEl(el), 'learn', { push: true }); },
  retryload: () => { if (L) startLesson(refOf(L), L.mode, { push: false }); },
  // lesson-level
  copylink: () => copyLink(),
  restart: () => restartLesson(),
  hidesel: () => hideSelected(),
  jump: (i, el) => { const k = +el.dataset.i; setActive(k); scrollToCard(k); },
  retrytr: () => reloadTranslation(),
  jtoggle: () => { L.join.hidden = !L.join.hidden; updateJoin(); persist(); },
  gopage: (i, el) => goToRef({ kind: 'page', page: clampInt(el.dataset.p, 1, PAGE_COUNT, 1) }),
  // per-card
  audio: (i, el) => {
    const kind = el.dataset.kind, req = { kind };
    if (L && L.status === 'ready') {
      const a = L.ayahs[i == null ? 0 : i];
      if (isPage(a)) {
        const d = D(a);
        req.page = a.n;
        const ks = kind === 'part' ? (a.stage === 4 && d.steps.length ? d.parts.slice(d.steps[a.cs][0], d.steps[a.cs][1] + 1).reduce((x, p) => x.concat(p), []) : d.parts[a.g]) : a.items.map((_, k) => k);
        req.ayahs = ks.map(k => [a.items[k].s, a.items[k].a]);
      } else if (i != null) {
        const d = D(a); req.surah = L.surah; req.ayah = a.n;
        if (kind === 'group') { const g = d.groups[a.g]; req.words = [g[0], g[g.length - 1]]; }
        if (kind === 'range' && a.stage === 4 && d.steps.length) { const [r0, r1] = d.steps[a.cs]; req.words = [d.groups[r0][0], d.groups[r1][d.groups[r1].length - 1]]; }
      } else { req.surah = L.surah; req.ayahs = L.ayahs.filter(x => x.sel).map(x => [L.surah, x.n]); }
    }
    AudioBridge.play(req);
  },
  toggleayah: i => toggleAyah(i),
  stage: (i, el) => goStage(i, +el.dataset.stage),
  goto: (i, el) => goStage(i, +el.dataset.stage, el.dataset.mark ? +el.dataset.mark : 0),
  setsize: (i, el) => setAyahSize(i, +el.dataset.size),
  setsplit: (i, el) => setSplit(i, el.dataset.v),
  brush: (i, el) => { const a = L.ayahs[i]; a.brush = clampInt(el.dataset.c, 0, 7, 0); updateCard(i, 'tw'); persist(); const s = cardEl(i).querySelector(`[data-act="brush"][data-c="${a.brush}"]`); if (s) s.focus({ preventScroll: true }); },
  paint: (i, el) => paint(i, +el.dataset.k),
  resetpaint: i => resetPaint(i),
  selpart: (i, el) => {
    const a = L.ayahs[i], d = D(a), gi = +el.dataset.g;
    if (!(gi >= 0 && gi < d.groups.length)) return;
    if (a.stage === 2 || a.stage === 3) a.g = gi;
    else if (a.stage === 4 && d.steps.length) a.cs = Math.min(d.steps.length - 1, Math.max(0, gi - 1));
    else return;
    updateCard(i, 'txw'); setActive(i); persist();
  },
  gmove: (i, el) => { const a = L.ayahs[i], n = D(a).groups.length; a.g = Math.min(n - 1, Math.max(0, a.g + (+el.dataset.d))); updateCard(i, 'txw'); setActive(i); persist(); },
  gjump: (i, el) => { const a = L.ayahs[i], n = D(a).groups.length; a.g = Math.min(n - 1, Math.max(0, +el.dataset.g)); updateCard(i, 'txw'); setActive(i); persist(); },
  selgroup: (i, el) => {
    const a = L.ayahs[i], d = D(a), gi = +el.dataset.g;
    if (a.stage === 2 || a.stage === 3) a.g = gi;
    else if (a.stage === 4 && d.steps.length) a.cs = Math.min(d.steps.length - 1, Math.max(0, gi - 1));
    else return;
    updateCard(i, 'tw'); setActive(i); persist();
  },
  hideallgroups: i => { const a = L.ayahs[i], all = a.gh.every(Boolean); a.gh = a.gh.map(() => !all); if (all) a._frv = true; updateCard(i, 'tw'); setActive(i); persist(); announce(all ? 'All shown' : 'All hidden'); },
  togglefocus: i => {
    const a = L.ayahs[i], d = D(a);
    const gis = a.stage === 4 && d.steps.length ? range(d.steps[a.cs][0], d.steps[a.cs][1]) : [a.g];
    const hid = gis.every(g => a.gh[g]);
    gis.forEach(g => { a.gh[g] = !hid; });
    a._frv = hid;
    updateCard(i, 'tw'); setActive(i); persist();
    announce(hid ? 'Shown' : 'Hidden — recite from memory');
  },
  count: (i, el) => count(i, el.dataset.kind, 1),
  uncount: (i, el) => count(i, el.dataset.kind, -1),
  resetcount: (i, el) => count(i, el.dataset.kind, 0),
  nextgroup: i => { const a = L.ayahs[i], n = D(a).groups.length, og = firstOpenGroup(a, a.g + 1); a.g = og >= 0 ? og : Math.min(n - 1, a.g + 1); updateCard(i, 'txw'); setActive(i); persist(); },
  cstep: (i, el) => { L.ayahs[i].cs = +el.dataset.s; updateCard(i, 'txw'); setActive(i); persist(); },
  nextstep: i => { const a = L.ayahs[i], st = D(a).steps, os = firstOpenStep(a); a.cs = os >= 0 ? os : Math.min(st.length - 1, a.cs + 1); updateCard(i, 'txw'); setActive(i); persist(); },
  settarget: (i, el) => { const a = L.ayahs[i], n = +el.dataset.n; a.ft = n === (isPage(a) ? S.pageReps : S.ayahReps) ? null : n; updateCard(i, 'hstw'); setActive(i); persist(); },
  peek: i => peek(i),
  reveal: i => reveal(i),
  assess: (i, el) => assess(i, el.dataset.r),
  retest: i => retest(i),
  repeatfull: i => { const a = L.ayahs[i]; a.fc = 0; a.result = null; a.revealed = false; goStage(i, 5); },
  weak: (i, el) => { const a = L.ayahs[i], g = +el.dataset.g; a.weak = a.weak.includes(g) ? a.weak.filter(x => x !== g) : a.weak.concat(g); updateCard(i, isPage(a) ? 'tw' : 'w'); persist(); },
  practiceweak: i => practiceWeak(i),
  restartayah: async i => {
    const a = L.ayahs[i], W = NOUN(a);
    const ok = await confirmBox({ title: `Start this ${W.u} again?`, body: `All six stages for this ${W.u} start again from Stage 1. Your note is kept.`, ml: isPage(a) ? 'ഈ പേജ് ഒന്നാം ഘട്ടം മുതൽ വീണ്ടും തുടങ്ങും.' : 'ഈ ആയത്ത് ഒന്നാം ഘട്ടം മുതൽ വീണ്ടും തുടങ്ങും.', ok: 'Start again' });
    if (!ok) return;
    resetAyahProgress(a); updateCard(i, 'hstxw', true); setActive(i); updateJoin(); persist();
  },
  showtr: i => { L.ayahs[i].showTr = true; updateCard(i, 'x'); },
  nextayah: i => nextAyah(i),
  // settings
  snum: (i, el) => { const k = el.dataset.key; changeSetting(k, S[k] + (+el.dataset.d)); },
  resetsettings: async () => {
    const ok = await confirmBox({ title: 'Reset all settings?', body: 'Language, group sizes, repetition targets and display options go back to the academy defaults.', ml: 'എല്ലാ ക്രമീകരണങ്ങളും ആദ്യത്തെ നിലയിലേക്ക് മാറും.', ok: 'Reset' });
    if (!ok) return;
    const prevTr = S.translation;
    S = Object.assign({}, DEFAULTS); saveSettings();
    rerenderEverything(); renderSettings();
    if (L && L.status === 'ready' && !$('#lessonView').hidden && prevTr !== S.translation) reloadTranslation();
  },
  cleardata: async () => {
    const ok = await confirmBox({ title: 'Clear this student’s progress?', body: `${STUDENT ? STUDENT.name + '’s' : 'The'} saved lesson, revision list and memorized-ayah count will be removed from this browser. Their account and settings are kept.`, ml: 'ഈ വിദ്യാർത്ഥിയുടെ സൂക്ഷിച്ച പുരോഗതി ഈ ബ്രൗസറിൽ നിന്ന് മായ്ക്കും.', ok: 'Clear progress' });
    if (!ok) return;
    store.del(KEY.lesson); store.del(KEY.history); store.del(KEY.done);
    closeDialog($('#dlgSettings'));
    L = null; initHomeState(); goHome();
    toast('Saved progress cleared from this browser.');
  }
};

function bindEvents() {
  document.addEventListener('click', e => {
    const setBtn = e.target.closest('button[data-set][data-val]');
    if (setBtn) { changeSetting(setBtn.dataset.set, setBtn.dataset.val); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act]; if (!fn) return;
    if (el.tagName === 'A') e.preventDefault();
    const card = el.closest('.ayah-card');
    fn(card ? +card.dataset.i : null, el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('[data-chg="sel"]')) {
      const card = el.closest('.ayah-card'); if (!card) return;
      const i = +card.dataset.i; L.ayahs[i].sel = el.checked; setActive(i); updateJoin(); persist(); return;
    }
    if (el.matches('[data-chg="selall"]')) { const v = el.checked; L.ayahs.forEach((a, i) => { a.sel = v; const c = cardEl(i); const box = c && c.querySelector('[data-chg="sel"]'); if (box) box.checked = v; }); updateJoin(); refreshMeta(); persist(); return; }
    if (el.matches('[data-set]')) {
      const key = el.dataset.set;
      if (el.type === 'checkbox') changeSetting(key, el.checked);
      else if (el.type === 'radio') { if (el.checked) changeSetting(key, el.value); }
      else changeSetting(key, el.value);
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-memo]')) { const card = el.closest('.ayah-card'); if (card && L) { L.ayahs[+card.dataset.i].note = el.value.slice(0, 600); persist(); } }
    else if (el.id === 'surahSearch') renderSurahList();
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'surahSearch' && e.key === 'Enter') { e.preventDefault(); const first = $('#surahList [data-act="pick"]'); if (first) pickSurah(+first.dataset.n); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('span[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('pointerdown', e => { const c = e.target.closest && e.target.closest('.ayah-card'); if (c && L && L.status === 'ready') setActive(+c.dataset.i); }, { passive: true });
  document.addEventListener('focusin', e => { const c = e.target.closest && e.target.closest('.ayah-card'); if (c && L && L.status === 'ready') setActive(+c.dataset.i); });
  $$('dialog').forEach(d => {
    if (d.id !== 'dlgConfirm') d.addEventListener('close', () => onDialogClosed(d));
    d.addEventListener('click', e => { if (e.target === d && d.id !== 'dlgConfirm' && !d.hasAttribute('data-keep')) closeDialog(d); });
  });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { $('#topbar').classList.toggle('scrolled', window.scrollY > 4); ticking = false; });
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('online', () => { if (L && L.status === 'error' && !$('#lessonView').hidden) toast('You are back online — press “Try again”.'); });
}

function openLink(link, push) {
  const saved = savedLesson();
  if (saved && sameRange(refOf(saved), link)) { openSaved(saved, push); return; }
  if (saved && lessonInProgress(saved)) {
    // keep the student's saved progress safe: pre-fill the form and let them decide
    if (link.kind === 'page') { H.mode = 'page'; H.page = link.page; }
    else { H.mode = 'ayah'; H.surah = link.surah; H.from = link.from; H.to = link.to; }
    H.link = link;
    showView('home'); renderHome();
    const sc = $('#startCard'); if (sc) setTimeout(() => sc.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }), 60);
    return;
  }
  startLesson(link, 'learn', { push });
}

/* ---------------------------------------------------------------------
   19. Start
   --------------------------------------------------------------------- */
let booted = false;
// Called once by admin.v1.js: event wiring for the learner screens and the shared dialogs.
function boot() {
  if (booted) return; booted = true;
  S = Object.assign({}, DEFAULTS); applyDisplay();
  bindEvents();
}
// Open one student's learning space. params: URLSearchParams of the location hash (page= / lesson=).
function mount(student, params) {
  boot();
  if (SID && SID !== student.id) unmount();
  SID = student.id; STUDENT = student; KEY = HifzStore.keys(SID);
  S = loadSettings(); applyDisplay();
  L = null; H.link = null; initHomeState();
  $('#tipsBody').innerHTML = tipsHTML();
  route(params);
}
// Back/forward inside a student's space (also used for the first screen).
function route(params) {
  const link = parseLink(params);
  if (link && L && L.status === 'ready' && sameRange(refOf(L), link)) { showView('lesson'); refreshMeta(); }
  else if (link) openLink(link, false);
  else goHome({ push: false });
}
// Leave the student's space (back to the dashboard). Everything is saved first.
function unmount() {
  if (L && L.status === 'ready') saveNow();
  loadSeq++; L = null; SID = null; STUDENT = null; KEY = HifzStore.keys('none');
  S = Object.assign({}, DEFAULTS); applyDisplay();
  $$('dialog').forEach(d => { if (d.open && d.id !== 'dlgStudent') closeDialog(d); });
  $('#homeView').hidden = true; $('#lessonView').hidden = true;
  $('#homeView').innerHTML = ''; $('#lessonView').innerHTML = '';
  $('#statusChip').hidden = true; $('#topbar').classList.remove('has-status');
}
// The admin edited this student's details or preferences: reload them and redraw.
function refresh(student) {
  if (!SID || !student || student.id !== SID) return;
  const prevTr = S.translation;
  STUDENT = student; S = loadSettings();
  if (!$('#homeView').hidden) initHomeState();
  rerenderEverything();
  if (prevTr !== S.translation && L && L.status === 'ready' && !$('#lessonView').hidden) reloadTranslation();
}

// Expose pure helpers for automated checks (no side effects).
window.MQHifz = { tokenize, partition, splitBasmalah, comboSteps, pageAyahs, pageSegments, pageOf, juzOf, autoParts, version: 'portal-1' };

return {
  boot, mount, route, unmount, refresh,
  studentId: () => SID,
  // shared helpers for the dashboard
  confirm: confirmBox, toast, openDialog, closeDialog, ic, esc, relTime, TRANSLATIONS
};
})();
