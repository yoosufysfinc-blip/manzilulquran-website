/* =====================================================================
   ManzilulQuran \u00b7 Hifz Learning App \u2014 the learner (v3)
   One student at a time. The academy's way of memorizing:
     1. read every ayah once, looking at it;
     2. memorize the first ayah part by part (parts sized Min / Medium / Max
        to the ayah's length), then join the parts;
     3. memorize the next ayah the same way, then \u201cMake together\u201d (1+2);
     4. continue (1\u20133, 1\u20134 \u2026) and finish by reciting everything together.
   Tools: one Hide button (faint \u2192 pinned words only \u2192 hidden \u2192 shown),
   pins between two words, a translation switch on every ayah.
   Opened by admin.v2.js with HifzLearn.mount(student, route).
   Needs: quran-data.v1.js (SURAHS, PAGE_STARTS, JUZ_STARTS, QuranMeta)
          store.v2.js (HifzStore \u2014 per-student storage keys)
   ===================================================================== */
const HifzLearn = (function () {
'use strict';

/* ---------------------------------------------------------------------
   1. Configuration
   --------------------------------------------------------------------- */
// External data dependency (kept separate from the local interface):
// AlQuran Cloud API \u2014 serves the Tanzil Uthmani text and Tanzil translations.
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
  level: 'med', pauseBreak: true, ayahGroup: 1, pageSplit: 3, joinMethod: 'cumulative',
  groupReps: 5, comboReps: 5, ayahReps: 10, joinReps: 3, pageReps: 5,
  translation: 'ml.abdulhameed', trShow: true,
  arSize: 'l', quranFont: 'amiri', englishHelp: true,
  autoScroll: true, vibrate: true, reduceMotion: false,
  startMode: 'ayah', partColors: true, tgView: 'mushaf', dockMini: false,
  reciter: 'ar.alafasy', audioRep: 1, audioRate: '1'
};

/* ---------------------------------------------------------------------
   2. Small utilities
   --------------------------------------------------------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const AR_DIGITS = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
const toAr = n => String(n).replace(/\d/g, d => AR_DIGITS[+d]);
const clampInt = (v, lo, hi, dflt) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt; };
const plural = (n, one, many) => (n === 1 ? one : (many || one + 's'));
const range = (a, b) => { const out = []; for (let k = a; k <= b; k++) out.push(k); return out; };
const rangeLabel = (f, t) => (f === t ? `Ayah ${f}` : `Ayahs ${f}\u2013${t}`);
const ic = (name, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true" focusable="false"><use href="#i-${name}"/></svg>`;
const checkIcon = () => '<svg class="ic check-draw" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
// Keep an ayah-end marker on the same line as the ayah's last word (a no-break space alone is not enough
// next to an inline-block, so the pair is wrapped in a no-wrap span).
const glueEnd = (parts, endHTML) => (parts.length
  ? (parts.length > 1 ? parts.slice(0, -1).join(' ') + ' ' : '') + `<span class="nb">${parts[parts.length - 1]}&nbsp;${endHTML}</span>`
  : endHTML);
const numArr = v => (Array.isArray(v) ? v.map(x => clampInt(x, 0, 999, 0)) : []);
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

/* ---------- language: Malayalam + English, or simple English only ---------- */
const EN = () => S.uiLang === 'en';
// a Malayalam line with optional English help \u2014 or English only
const bi = (ml, en) => (EN() ? en : `<span lang="ml">${ml}</span>${S.englishHelp && en ? `<span class="bi-en">${en}</span>` : ''}`);
const mlTag = t => (EN() ? '' : ` <span lang="ml">${t}</span>`);

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
   3. Arabic text processing (never alters letters \u2014 only splits on spaces)
   --------------------------------------------------------------------- */
const LETTER = /[\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06ee\u06ef\u06fa-\u06fc\u06ff]/;
const PAUSE_TOKEN = /[\u06d6-\u06dc]/;   // stand-alone waqf (pause) sign separated by a space
const PAUSE_TAIL = /[\u06d6-\u06db]$/;    // waqf sign attached to the end of a word

// Split an ayah into words. A token without any Arabic letter (a pause sign,
// a sajdah sign, the rub\u2018 al-hizb sign \u2026) stays attached to its neighbouring word,
// so it never counts as a "word" and never starts a group by itself.
function tokenize(text) {
  const toks = String(text).replace(/[\ufeff\u200b]/g, '').trim().split(/\s+/).filter(Boolean);
  const words = []; let lead = '';
  for (const t of toks) {
    if (LETTER.test(t)) { words.push({ t: lead ? lead + ' ' + t : t, pause: PAUSE_TAIL.test(t) }); lead = ''; }
    else if (words.length) { const w = words[words.length - 1]; w.t += ' ' + t; if (PAUSE_TOKEN.test(t)) w.pause = true; }
    else lead = lead ? lead + ' ' + t : t;
  }
  if (lead) words.push({ t: lead, pause: false });
  return words;
}

// The API prepends the Basmalah to ayah 1 of surahs 2\u2013114 (except 9).
// It is detected by comparing the first four words without diacritics, then shown separately.
const AR_MARKS = /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g;
const normAr = s => String(s).replace(AR_MARKS, '').replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
const BASMALAH = ['\u0628\u0633\u0645', '\u0627\u0644\u0644\u0647', '\u0627\u0644\u0631\u062d\u0645\u0646', '\u0627\u0644\u0631\u062d\u064a\u0645'];
function splitBasmalah(text) {
  const toks = String(text).replace(/[\ufeff\u200b]/g, '').trim().split(/\s+/);
  if (toks.length > 4 && BASMALAH.every((w, i) => normAr(toks[i]) === w)) {
    return { basmalah: toks.slice(0, 4).join(' '), rest: toks.slice(4).join(' ') };
  }
  return { basmalah: null, rest: text };
}

// Parts of one ayah, sized to the chosen level and to the ayah itself:
//   Min \u2248 2\u20133 words, Medium \u2248 3\u20134, Max \u2248 5\u20136 words per part.
// An ayah that already fits in one part is not split. Longer ayahs are cut into
// evenly sized parts (no 1-word leftovers), preferring to end a part at a pause sign.
const LEVELS = {
  min: { max: 3, ideal: 2.5, en: 'Min', hint: '2\u20133 words a part' },
  med: { max: 4, ideal: 3.5, en: 'Medium', hint: '3\u20134 words a part' },
  max: { max: 6, ideal: 5.5, en: 'Max', hint: '5\u20136 words a part' }
};
function levelParts(words, level, pauseBreak) {
  const lv = LEVELS[level] || LEVELS.med, n = words.length;
  if (n <= lv.max) return [[0, Math.max(0, n - 1)]];
  const best = new Array(n + 1).fill(Infinity), prev = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let j = 1; j <= n; j++) {
    for (let len = 1; len <= Math.min(lv.max, j); len++) {
      const i = j - len;
      let c = (len - lv.ideal) * (len - lv.ideal) + 0.6;
      if (len === 1) c += 4;
      if (pauseBreak && j < n && words[j - 1].pause) c -= 1.5;
      if (best[i] + c < best[j]) { best[j] = best[i] + c; prev[j] = i; }
    }
  }
  const parts = [];
  for (let j = n; j > 0; j = prev[j]) parts.unshift([prev[j], j - 1]);
  return parts;
}

// Joining steps: cumulative (1+2, 1\u20133, 1\u20134 \u2026) or pairs (1+2, 2+3, 3+4 \u2026).
function comboSteps(n, method) {
  const steps = [];
  for (let k = 1; k < n; k++) steps.push(method === 'pairs' ? [k - 1, k] : [0, k]);
  return steps;
}

/* ---------------------------------------------------------------------
   4. Mushaf pages (Madani mushaf, 604 pages \u2014 verified page table)
   --------------------------------------------------------------------- */
// (shared helpers live in quran-data.v1.js)
const { gid, pageAyahs, pageSegments, pageOf, juzOf } = QuranMeta;
function pageSummary(p) {
  const segs = pageSegments(p);
  return {
    segs, juz: juzOf(segs[0].s, segs[0].f),
    count: segs.reduce((n, sg) => n + sg.t - sg.f + 1, 0),
    label: segs.map(sg => `${surahOf(sg.s).en} ${sg.f === sg.t ? sg.f : sg.f + '\u2013' + sg.t}`).join(' \u00b7 '),
    ar: segs.map(sg => surahOf(sg.s).ar).join(' \u00b7 ')
  };
}
// the same label as HTML, each "Surah a\u2013b" kept on one line
const pageLabelHTML = ps => ps.segs.map(sg => `<span class="nb">${esc(surahOf(sg.s).en)} ${sg.f === sg.t ? sg.f : sg.f + '\u2013' + sg.t}</span>`).join(' \u00b7 ');

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
  if (k === 'offline') return { icon: 'wifi-off', en: 'You seem to be offline. Connect to the internet and try again.', ml: '\u0d07\u0d28\u0d4d\u0d31\u0d7c\u0d28\u0d46\u0d31\u0d4d\u0d31\u0d4d \u0d2c\u0d28\u0d4d\u0d27\u0d02 \u0d07\u0d32\u0d4d\u0d32\u0d46\u0d28\u0d4d\u0d28\u0d4d \u0d24\u0d4b\u0d28\u0d4d\u0d28\u0d41\u0d28\u0d4d\u0d28\u0d41. \u0d2c\u0d28\u0d4d\u0d27\u0d3f\u0d2a\u0d4d\u0d2a\u0d3f\u0d1a\u0d4d\u0d1a \u0d36\u0d47\u0d37\u0d02 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d36\u0d4d\u0d30\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.' };
  if (k === 'timeout') return { icon: 'wifi-off', en: 'The Quran text server is too slow right now. Please try again.', ml: '\u0d38\u0d46\u0d7c\u0d35\u0d7c \u0d2a\u0d4d\u0d30\u0d24\u0d3f\u0d15\u0d30\u0d3f\u0d15\u0d4d\u0d15\u0d3e\u0d7b \u0d35\u0d48\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d41. \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d36\u0d4d\u0d30\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.' };
  if (k === 'http') return { icon: 'info', en: `The Quran text server gave an error (HTTP ${err.status}). Please try again soon.`, ml: '\u0d38\u0d46\u0d7c\u0d35\u0d31\u0d3f\u0d7d \u0d12\u0d30\u0d41 \u0d2a\u0d3f\u0d36\u0d15\u0d4d \u0d38\u0d02\u0d2d\u0d35\u0d3f\u0d1a\u0d4d\u0d1a\u0d41. \u0d05\u0d7d\u0d2a\u0d38\u0d2e\u0d2f\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d4d \u0d36\u0d47\u0d37\u0d02 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d36\u0d4d\u0d30\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.' };
  if (k === 'format' || k === 'incomplete') return { icon: 'info', en: 'The text did not arrive complete, so it is not shown. Please try again.', ml: '\u0d32\u0d2d\u0d3f\u0d1a\u0d4d\u0d1a \u0d35\u0d3e\u0d1a\u0d15\u0d02 \u0d2a\u0d42\u0d7c\u0d23\u0d4d\u0d23\u0d2e\u0d32\u0d4d\u0d32\u0d3e\u0d24\u0d4d\u0d24\u0d24\u0d3f\u0d28\u0d3e\u0d7d \u0d15\u0d3e\u0d23\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d28\u0d4d\u0d28\u0d3f\u0d32\u0d4d\u0d32. \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d36\u0d4d\u0d30\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.' };
  return { icon: 'wifi-off', en: 'Could not reach the Quran text server. Check your internet and try again.', ml: '\u0d16\u0d41\u0d7c\u0d06\u0d7b \u0d35\u0d3e\u0d1a\u0d15\u0d02 \u0d32\u0d4b\u0d21\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d3e\u0d7b \u0d15\u0d34\u0d3f\u0d1e\u0d4d\u0d1e\u0d3f\u0d32\u0d4d\u0d32. \u0d07\u0d28\u0d4d\u0d31\u0d7c\u0d28\u0d46\u0d31\u0d4d\u0d31\u0d4d \u0d2c\u0d28\u0d4d\u0d27\u0d02 \u0d2a\u0d30\u0d3f\u0d36\u0d4b\u0d27\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d36\u0d4d\u0d30\u0d2e\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.' };
}

/* ---------------------------------------------------------------------
   6. Audio \u2014 the same recitation source as the academy's share player
   ---------------------------------------------------------------------
   share.html and tools/quran-generator.html play one MP3 per ayah from the
   AlQuran Cloud CDN (cdn.islamic.network). The learner uses the same files and
   the same reciter list, so a student hears the same recitation everywhere.
   An outside provider can still take over: window.MQAudio = { play(request) {\u2026} }. */
const AUDIO_URL = (edition, g) => `https://cdn.islamic.network/quran/audio/128/${edition}/${g}.mp3`;
// Reciter registry \u2014 the same list and order as share.html (its ?r= index)
const RECITERS = [
  { name: 'Mishary Rashid Alafasy', edition: 'ar.alafasy' },
  { name: 'Maher Al Muaiqly', edition: 'ar.mahermuaiqly' },
  { name: 'Abdul Basit (Murattal)', edition: 'ar.abdulbasitmurattal' },
  { name: 'Saad Al-Ghamdi', edition: 'ar.saadalghamdi' },
  { name: 'Saud Al-Shuraim', edition: 'ar.saoodshuraym' },
  { name: 'Abdurrahman As-Sudais', edition: 'ar.abdurrahmaansudais' },
  { name: 'Hani Ar-Rifai', edition: 'ar.hanirifai' },
  { name: 'Mahmoud Khalil Al-Husary', edition: 'ar.husary' },
  { name: 'Muhammad Ayyub', edition: 'ar.muhammadayyoub' },
  { name: 'Muhammad Jibreel', edition: 'ar.muhammadjibreel' }
];
// plays a list of ayahs one after another; each ayah is repeated S.audioRep times
const Player = {
  el: null, list: [], idx: 0, rep: 0, onChange: null,
  get on() { return !!(this.el && this.list.length && !this.el.paused); },
  get current() { return this.list.length ? this.list[this.idx] : null; },
  audio() {
    if (this.el) return this.el;
    const a = this.el = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', () => this.advance());
    a.addEventListener('error', () => { if (!this.list.length) return; this.stop(); toast('The recitation could not be played. Check the internet and try again.', '\u0d13\u0d21\u0d3f\u0d2f\u0d4b \u0d2a\u0d4d\u0d32\u0d47 \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d3e\u0d28\u0d3e\u0d2f\u0d3f\u0d32\u0d4d\u0d32.', 'volume'); });
    a.addEventListener('play', () => this.changed());
    a.addEventListener('pause', () => this.changed());
    return a;
  },
  changed() { if (this.onChange) this.onChange(); },
  start(list) {
    const p = window.MQAudio && typeof window.MQAudio.play === 'function' ? window.MQAudio : null;
    if (p) { try { p.play({ kind: 'range', ayahs: list.map(x => [x.s, x.a]) }); return; } catch (e) { console.warn('Audio provider error', e); } }
    this.list = list.slice(); this.idx = 0; this.rep = 0;
    this.load(true);
  },
  load(play) {
    const a = this.audio(), x = this.current;
    if (!x) return;
    const ed = (RECITERS.find(r => r.edition === S.reciter) || RECITERS[0]).edition;
    a.src = AUDIO_URL(ed, gid(x.s, x.a));
    a.playbackRate = +S.audioRate || 1;
    if (play) a.play().catch(() => { this.stop(); toast('Tap Listen again to play the recitation.', '', 'volume'); });
    this.changed();
  },
  advance() {
    if (++this.rep < S.audioRep) { this.load(true); return; }
    this.rep = 0;
    if (++this.idx < this.list.length) this.load(true); else this.stop();
  },
  stop() {
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); try { this.el.load(); } catch (e) { /* ignore */ } }
    this.list = []; this.idx = 0; this.rep = 0;
    this.changed();
  }
};

/* ---------------------------------------------------------------------
   7. Settings
   --------------------------------------------------------------------- */
function loadSettings() {
  const s = Object.assign({}, DEFAULTS, store.get(KEY.settings) || {});
  s.uiLang = s.uiLang === 'en' ? 'en' : 'ml';
  if (!LEVELS[s.level]) s.level = DEFAULTS.level;
  s.ayahGroup = [1, 2, 3, 4, 5].includes(+s.ayahGroup) ? +s.ayahGroup : DEFAULTS.ayahGroup;
  s.pageSplit = [3, 4, 5].includes(+s.pageSplit) ? +s.pageSplit : DEFAULTS.pageSplit;
  ['groupReps', 'comboReps', 'joinReps', 'pageReps'].forEach(k => { s[k] = clampInt(s[k], 1, 50, DEFAULTS[k]); });
  s.ayahReps = clampInt(s.ayahReps, 1, 99, DEFAULTS.ayahReps);
  if (!['cumulative', 'pairs'].includes(s.joinMethod)) s.joinMethod = DEFAULTS.joinMethod;
  if (!TRANSLATIONS.some(t => t.id === s.translation)) s.translation = DEFAULTS.translation;
  if (!['s', 'm', 'l', 'xl'].includes(s.arSize)) s.arSize = DEFAULTS.arSize;
  if (!['amiri', 'naskh'].includes(s.quranFont)) s.quranFont = DEFAULTS.quranFont;
  if (!['ayah', 'page'].includes(s.startMode)) s.startMode = DEFAULTS.startMode;
  if (!['mushaf', 'ayahs'].includes(s.tgView)) s.tgView = DEFAULTS.tgView;
  if (!RECITERS.some(r => r.edition === s.reciter)) s.reciter = DEFAULTS.reciter;
  s.audioRep = [1, 3, 5, 10].includes(+s.audioRep) ? +s.audioRep : DEFAULTS.audioRep;
  if (!['0.75', '1', '1.25'].includes(String(s.audioRate))) s.audioRate = DEFAULTS.audioRate; else s.audioRate = String(s.audioRate);
  ['pauseBreak', 'trShow', 'englishHelp', 'autoScroll', 'vibrate', 'reduceMotion', 'partColors', 'dockMini'].forEach(k => { s[k] = !!s[k]; });
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
   8. Lesson model
   A lesson is a list of ayahs (items). Items are grouped into units \u2014
   one ayah each by default; a page uses groups of 3 ayahs; "Ayah groups"
   can change that, or groups can be coloured by hand.
   The steps follow the academy method:
     read \u2192 unit 1 \u2192 unit 2 \u2192 together 1\u20132 \u2192 unit 3 \u2192 together 1\u20133 \u2026 \u2192 all together
   Inside a unit: parts (memorize one part at a time) \u2192 join the parts \u2192 the full unit.
   Hide states (one button cycles them): 0 shown \u00b7 1 faint \u00b7 2 only the edges of linked words \u00b7 3 hidden
   --------------------------------------------------------------------- */
const HIDE_TXT = [
  { en: 'Hide', ml: '\u0d2e\u0d31\u0d2f\u0d4d\u0d15\u0d4d\u0d15\u0d41\u0d15', icon: 'eye-off', note: 'Shown' },
  { en: 'Faint', ml: '\u0d2e\u0d19\u0d4d\u0d19\u0d3f', icon: 'eye-faint', note: 'Faint (10%)' },
  { en: 'Links', ml: '\u0d32\u0d3f\u0d19\u0d4d\u0d15\u0d4d \u0d2e\u0d3e\u0d24\u0d4d\u0d30\u0d02', icon: 'link', note: 'Only the linked words, partly' },
  { en: 'Hidden', ml: '\u0d2e\u0d31\u0d1a\u0d4d\u0d1a\u0d41', icon: 'eye', note: 'Hidden' }
];
function nextHide(h, hasPins) { let n = ((h || 0) + 1) % 4; if (n === 2 && !hasPins) n = 3; return n; }

function makeLesson(ref, mode) {
  const l = { v: 3, kind: ref.kind === 'page' ? 'page' : 'ayah', mode: mode === 'revise' ? 'revise' : 'learn', trEd: S.translation,
    basmalah: null, items: [], group: null, colors: [], brush: 0, level: null, segLevel: {}, pins: [], trFlip: [],
    read: [], cur: 0, step: 0, seg: [], chain: {}, fin: { c: 0, result: null }, notes: {}, segKey: '',
    rowHide: {}, focusHide: 0, pinMode: false, paintMode: false,
    created: Date.now(), updated: Date.now(), status: 'loading', error: null };
  if (l.kind === 'page') l.page = ref.page; else Object.assign(l, { surah: ref.surah, from: ref.from, to: ref.to });
  return l;
}

/* ---------- units (groups of ayahs) ---------- */
// groups of `size` ayahs that never run across two surahs
function autoParts(items, size) {
  const parts = []; let cur = [];
  items.forEach((it, k) => { if (cur.length && (cur.length >= size || it.a === 1)) { parts.push(cur); cur = []; } cur.push(k); });
  if (cur.length) parts.push(cur);
  return parts;
}
const groupOf = l => l.group || (l.kind === 'page' ? S.pageSplit : S.ayahGroup);
const defaultGroup = l => (l.kind === 'page' ? S.pageSplit : S.ayahGroup);
function unitsOf(l) {
  const g = groupOf(l);
  if (g === 'manual' && l.colors.length === l.items.length) {
    const parts = [], cols = [];
    l.colors.forEach((c, k) => { if (k && c === l.colors[k - 1]) parts[parts.length - 1].push(k); else { parts.push([k]); cols.push(c); } });
    return { parts, cols };
  }
  const parts = autoParts(l.items, g === 'manual' ? defaultGroup(l) : g);
  return { parts, cols: parts.map((_, j) => j % 4) };
}
const partitionKey = parts => parts.map(p => p.length).join('.');

/* ---------- words and parts (cached per lesson) ---------- */
const DER = new WeakMap();
function wordsOf(l) {
  let d = DER.get(l);
  if (!d || d.n !== l.items.length || d.t0 !== (l.items[0] && l.items[0].text)) {
    d = { n: l.items.length, t0: l.items[0] && l.items[0].text, words: l.items.map(it => tokenize(it.text)) };
    DER.set(l, d);
  }
  return d.words;
}
const levelOf = (l, u) => { const first = unitsOf(l).parts[u][0]; return l.segLevel[first] || l.level || S.level; };
// the parts of one unit: [{ i: item, w0, w1 }] \u2014 a part never runs across two ayahs
function piecesOf(l, u) {
  const words = wordsOf(l), lv = levelOf(l, u), out = [];
  unitsOf(l).parts[u].forEach(i => levelParts(words[i], lv, S.pauseBreak).forEach(([w0, w1]) => out.push({ i, w0, w1 })));
  return out;
}

/* ---------- the steps of a lesson ---------- */
function stepsOf(l) {
  const n = unitsOf(l).parts.length, out = [{ t: 'read' }];
  for (let u = 0; u < n; u++) {
    out.push({ t: 'seg', u });
    if (u >= 1 && u < n - 1) out.push({ t: 'chain', u });
  }
  out.push({ t: 'final' });
  return out;
}
const curStep = () => { const st = stepsOf(L); return st[Math.min(L.step, st.length - 1)]; };
const finalReps = () => (L.kind === 'page' ? S.pageReps : S.joinReps);

// joining steps inside one unit \u2014 the last join (all the parts) is the full unit itself, so it is not repeated
const joinSteps = n => comboSteps(n, S.joinMethod).filter(([a, b]) => !(a === 0 && b === n - 1));
// keep each unit's progress in step with the current groups and part sizes
function segState(u) {
  const ps = piecesOf(L, u), key = levelOf(L, u) + '|' + ps.length + '|' + (S.pauseBreak ? 'p' : '-') + '|' + S.joinMethod;
  let g = L.seg[u];
  if (!g) g = L.seg[u] = { key: '', ph: 'parts', k: 0, pc: [], cs: 0, cc: [], fc: 0, done: false };
  if (g.key !== key) {
    g.key = key; g.k = 0; g.cs = 0; g.pc = ps.map(() => 0); g.cc = joinSteps(ps.length).map(() => 0);
    if (ps.length < 2) g.ph = 'full'; else if (g.ph !== 'full') g.ph = 'parts';
  }
  if (g.ph === 'join' && !g.cc.length) g.ph = 'full';
  if (g.k >= ps.length) g.k = 0;
  if (g.cs >= Math.max(1, g.cc.length)) g.cs = Math.max(0, g.cc.length - 1);
  if (ps.length < 2) g.ph = 'full';
  return g;
}
function syncUnits() {
  const key = partitionKey(unitsOf(L).parts);
  if (L.segKey !== key) { L.segKey = key; L.seg = []; L.chain = {}; L.fin = { c: 0, result: null }; }
  const n = stepsOf(L).length;
  if (L.step >= n) L.step = n - 1;
  if (L.cur >= L.items.length) L.cur = 0;
}
const unitDone = u => !!(L.seg[u] && L.seg[u].done);
function stepDone(st) {
  if (st.t === 'read') return L.items.length > 0 && L.items.every((_, i) => L.read.includes(i));
  if (st.t === 'seg') return unitDone(st.u);
  if (st.t === 'chain') return (L.chain[st.u] || 0) >= S.joinReps;
  return L.fin.result === 'mastered';
}
const hasProgress = l => !!l && (l.read.length > 0 || l.seg.some(g => g && (g.done || g.fc || g.pc.some(Boolean) || g.cc.some(Boolean)))
  || Object.values(l.chain).some(Boolean) || l.fin.c > 0 || l.fin.result !== null);

/* ---------- labels ---------- */
function unitLabel(u, short) {
  const p = unitsOf(L).parts[u], f = L.items[p[0]], t = L.items[p[p.length - 1]];
  if (short) return f.a === t.a ? `${f.a}` : `${f.a}\u2013${t.a}`;
  if (L.kind === 'page') {
    const r = f.s !== t.s ? `${surahOf(f.s).en} ${f.a} \u2013 ${surahOf(t.s).en} ${t.a}` : (f.a === t.a ? `Ayah ${f.a}` : `Ayahs ${f.a}\u2013${t.a}`);
    return `Group ${u + 1} \u00b7 ${r}`;
  }
  return f.a === t.a ? `Ayah ${f.a}` : `Ayahs ${f.a}\u2013${t.a}`;
}
function togetherLabel(u, short) {
  const parts = unitsOf(L).parts, f = L.items[parts[0][0]], t = L.items[parts[u][parts[u].length - 1]];
  if (short) return `${f.a}\u2013${t.a}`;
  if (L.kind === 'page') return `Groups 1\u2013${u + 1}`;
  return `Ayahs ${f.a}\u2013${t.a}`;
}
const unitNoun = u => (unitsOf(L).parts[u].length === 1 ? 'ayah' : 'group');

/* ---------- pins: "item:word" joins that word to the next one ---------- */
const pinSet = () => new Set(L.pins);
function pinnedWord(set, i, wi) {
  if (set.has(`${i}:${wi}`) || (wi > 0 && set.has(`${i}:${wi - 1}`))) return true;
  if (wi === 0 && i > 0) { const pw = wordsOf(L)[i - 1]; return set.has(`${i - 1}:${pw.length - 1}`); }
  return false;
}
const itemsHavePins = idxs => { const set = pinSet(); return idxs.some(i => wordsOf(L)[i].some((_, wi) => pinnedWord(set, i, wi))); };

/* ---------- translation shown? (global switch, flipped per ayah) ---------- */
const trVisible = i => L.trEd !== 'none' && !!L.items[i].tr && (S.trShow !== L.trFlip.includes(i));

/* ---------------------------------------------------------------------
   9. Persistence (this browser only)
   --------------------------------------------------------------------- */
let saveTimer, saveWarned = false;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 300); }
function serialize(l) {
  const o = { v: 3, kind: l.kind, mode: l.mode, trEd: l.trEd, basmalah: l.basmalah, group: l.group, colors: l.colors, brush: l.brush,
    level: l.level, segLevel: l.segLevel, pins: l.pins, trFlip: l.trFlip, read: l.read, cur: l.cur, step: l.step, seg: l.seg,
    chain: l.chain, fin: l.fin, notes: l.notes, segKey: l.segKey, created: l.created, updated: l.updated,
    items: l.items.map(x => ({ s: x.s, a: x.a, text: x.text, bas: x.bas || null, tr: x.tr || '' })),
    prog: { m: memorizedItems(l).length, n: l.items.length, pct: Math.round(lessonPercent(l) * 100), done: lessonComplete(l) } };
  if (l.kind === 'page') o.page = l.page; else Object.assign(o, { surah: l.surah, from: l.from, to: l.to });
  return o;
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!L || L.status !== 'ready') return;
  L.updated = Date.now();
  const ok = store.set(KEY.lesson, serialize(L));
  upsertHistory();
  const m = memorizedItems(L);   // the student's memorized-ayah record (shown on the dashboard)
  if (SID && m.length) HifzStore.markDone(SID, m.map(i => gid(L.items[i].s, L.items[i].a)));
  if (!ok && !saveWarned) { saveWarned = true; toast('Progress cannot be saved in this browser (storage is blocked or full).'); }
}
// A lesson saved by the first version (v1 app, format 2) keeps its text, notes and memorized ayahs.
function migrateOld(o) {
  try {
    if (!o || (o.v !== 1 && o.v !== 2) || !Array.isArray(o.ayahs) || !o.ayahs.length) return null;
    const n = { v: 3, kind: o.kind === 'page' ? 'page' : 'ayah', mode: o.mode, trEd: o.trEd, basmalah: o.basmalah || null,
      created: o.created, updated: o.updated, read: [], seg: [], notes: {}, fin: { c: 0, result: null } };
    let done = [];
    if (n.kind === 'page') {
      const u = o.ayahs[0] || {};
      n.page = o.page; n.basmalah = null;
      n.items = (u.items || []).map(x => ({ s: x.s, a: x.a, text: x.text, bas: x.basmalah || null, tr: x.tr || '' }));
      if ([3, 4, 5].includes(+u.split)) n.group = +u.split;
      if (u.result === 'mastered') { done = n.items.map((_, i) => i); n.fin.result = 'mastered'; }
      if (typeof u.note === 'string' && u.note.trim()) n.notes[0] = u.note;
      if ((+u.stage || 1) >= 2) n.read = n.items.map((_, i) => i);
    } else {
      Object.assign(n, { surah: o.surah, from: o.from, to: o.to });
      n.items = o.ayahs.map(a => ({ s: +o.surah, a: +a.n, text: a.text, bas: null, tr: a.tr || '' }));
      if (o.basmalah && n.items[0] && n.items[0].a === 1) n.items[0].bas = o.basmalah;
      o.ayahs.forEach((a, i) => {
        if (a.result === 'mastered') done.push(i);
        if ((+a.stage || 1) >= 2 || a.result === 'mastered') n.read.push(i);
        if (typeof a.note === 'string' && a.note.trim()) n.notes[i] = a.note;
      });
      if (done.length === n.items.length) n.fin.result = 'mastered';
    }
    n.migrated = done;
    return n;
  } catch (e) { return null; }
}
function restoreLesson(o) {
  if (o && (o.v === 1 || o.v === 2)) {
    const m = migrateOld(o), l = m && restoreLesson(m);
    if (l) {   // mark the ayahs memorized in the first version (one ayah per unit there)
      const saved = L; L = l;
      try { l.segKey = partitionKey(unitsOf(l).parts); unitsOf(l).parts.forEach((p, u) => { if (p.every(i => m.migrated.includes(i))) { segState(u); l.seg[u].done = true; } }); } finally { L = saved; }
      const st = stepsOf(l); let k = 0; const saved2 = L; L = l;
      try { while (k < st.length - 1 && stepDone(st[k])) k++; } finally { L = saved2; }
      l.step = k;
    }
    return l;
  }
  try {
    if (!o || o.v !== 3 || !Array.isArray(o.items) || !o.items.length) return null;   // older lessons (v1/v2) are not reused
    let ref, exp;
    if (o.kind === 'page') {
      const p = +o.page; if (!(p >= 1 && p <= PAGE_COUNT)) return null;
      ref = { kind: 'page', page: p }; exp = pageAyahs(p);
    } else {
      const su = surahOf(+o.surah); if (!su) return null;
      const from = +o.from, to = +o.to;
      if (!(from >= 1 && to <= su.ayahs && from <= to && to - from + 1 <= MAX_AYAHS)) return null;
      ref = { kind: 'ayah', surah: su.n, from, to }; exp = range(from, to).map(a => [su.n, a]);
    }
    if (o.items.length !== exp.length) return null;
    const l = makeLesson(ref, o.mode);
    l.items = o.items.map((x, j) => {
      if (!x || +x.s !== exp[j][0] || +x.a !== exp[j][1] || typeof x.text !== 'string' || !x.text.trim()) throw new Error('bad item');
      return { s: +x.s, a: +x.a, text: x.text, bas: typeof x.bas === 'string' ? x.bas : null, tr: typeof x.tr === 'string' ? x.tr : '' };
    });
    const n = l.items.length, idx = v => (Array.isArray(v) ? Array.from(new Set(v.map(x => clampInt(x, 0, n - 1, 0)))) : []);
    Object.assign(l, {
      trEd: TRANSLATIONS.some(t => t.id === o.trEd) ? o.trEd : S.translation,
      basmalah: typeof o.basmalah === 'string' ? o.basmalah : null,
      group: [1, 2, 3, 4, 5].includes(+o.group) ? +o.group : (o.group === 'manual' ? 'manual' : null),
      colors: Array.isArray(o.colors) && o.colors.length === n ? o.colors.map(c => clampInt(c, 0, 7, 0)) : [],
      brush: clampInt(o.brush, 0, 7, 0),
      level: LEVELS[o.level] ? o.level : null,
      segLevel: {}, pins: Array.isArray(o.pins) ? o.pins.filter(k => /^\d+:\d+$/.test(k) && +k.split(':')[0] < n) : [],
      trFlip: idx(o.trFlip), read: idx(o.read), cur: clampInt(o.cur, 0, n - 1, 0), step: clampInt(o.step, 0, 999, 0),
      seg: Array.isArray(o.seg) ? o.seg.map(g => g && typeof g === 'object' ? { key: String(g.key || ''), ph: ['parts', 'join', 'full'].includes(g.ph) ? g.ph : 'parts',
        k: clampInt(g.k, 0, 999, 0), pc: numArr(g.pc), cs: clampInt(g.cs, 0, 999, 0), cc: numArr(g.cc), fc: clampInt(g.fc, 0, 999, 0), done: !!g.done } : null) : [],
      chain: {}, fin: { c: clampInt(o.fin && o.fin.c, 0, 999, 0), result: ['mastered', 'assisted', 'revise'].includes(o.fin && o.fin.result) ? o.fin.result : null },
      notes: {}, segKey: String(o.segKey || ''), created: +o.created || Date.now(), updated: +o.updated || Date.now(), status: 'ready'
    });
    if (o.segLevel && typeof o.segLevel === 'object') Object.keys(o.segLevel).forEach(k => { if (+k < n && LEVELS[o.segLevel[k]]) l.segLevel[+k] = o.segLevel[k]; });
    if (o.chain && typeof o.chain === 'object') Object.keys(o.chain).forEach(k => { l.chain[+k] = clampInt(o.chain[k], 0, 999, 0); });
    if (o.notes && typeof o.notes === 'object') Object.keys(o.notes).forEach(k => { if (+k < n && typeof o.notes[k] === 'string') l.notes[+k] = o.notes[k].slice(0, 600); });
    return l;
  } catch (e) { return null; }
}
const savedLesson = () => restoreLesson(store.get(KEY.lesson));
const lessonStarted = l => !!l && (hasProgress(l) || Object.keys(l.notes).length > 0 || l.pins.length > 0);
const lessonComplete = l => !!l && l.fin.result === 'mastered';
const lessonInProgress = l => lessonStarted(l) && !lessonComplete(l);
const refOf = l => (l.kind === 'page' ? { kind: 'page', page: l.page } : { kind: 'ayah', surah: l.surah, from: l.from, to: l.to });
const sameRange = (a, b) => !!a && !!b && (a.kind || 'ayah') === (b.kind || 'ayah') &&
  (a.kind === 'page' ? a.page === b.page : a.surah === b.surah && a.from === b.from && a.to === b.to);
// ayahs memorized in this lesson: every ayah of a finished unit (all of them once the lesson is memorized)
function memorizedItems(l) {
  if (lessonComplete(l)) return l.items.map((_, i) => i);
  return unitsOf(l).parts.reduce((acc, p, u) => (l.seg[u] && l.seg[u].done ? acc.concat(p) : acc), []);
}

const histKey = r => (r.kind === 'page' ? `p${r.page}` : `a${r.surah}:${r.from}-${r.to}`);
const entryRef = e => (e.k === 'p' ? { kind: 'page', page: e.p } : { kind: 'ayah', surah: e.s, from: e.f, to: e.t });
const entryValid = e => !!e && (e.k === 'p' ? e.p >= 1 && e.p <= PAGE_COUNT : !!surahOf(e.s));
function upsertHistory() {
  if (!L || L.status !== 'ready') return;
  const key = histKey(refOf(L));
  const h = (store.get(KEY.history) || []).filter(e => entryValid(e) && histKey(entryRef(e)) !== key);
  const m = memorizedItems(L).length;
  if (lessonStarted(L) || m) {
    h.unshift(L.kind === 'page' ? { k: 'p', p: L.page, m: lessonComplete(L) ? 1 : 0, n: 1, at: Date.now() }
      : { k: 'a', s: L.surah, f: L.from, t: L.to, m, n: L.items.length, at: Date.now() });
  }
  store.set(KEY.history, h.slice(0, 10));
}
const history10 = () => (store.get(KEY.history) || []).filter(entryValid);
// Most students go forward (page 1 \u2192 2 \u2026); many start from the end of the mushaf (604 \u2192 603 \u2026).
// The direction is read from the page lesson studied just before this one.
function nextPageOf(p) {
  const prev = history10().find(e => e.k === 'p' && e.p !== p);
  const n = p + (prev && prev.p === p + 1 ? -1 : 1);
  return n >= 1 && n <= PAGE_COUNT ? n : null;
}
function nextRefOf(l) {
  if (l.kind === 'page') { const n = nextPageOf(l.page); return n ? { kind: 'page', page: n } : null; }
  const su = surahOf(l.surah);
  if (l.to >= su.ayahs) return null;
  const len = Math.min(MAX_AYAHS, l.to - l.from + 1);
  return { kind: 'ayah', surah: l.surah, from: l.to + 1, to: Math.min(su.ayahs, l.to + len) };
}
function refTitle(r) {
  if (r.kind === 'page') return `Page ${r.page} \u00b7 ${pageSummary(r.page).label}`;
  return `${surahOf(r.surah).en} \u00b7 ${rangeLabel(r.from, r.to)}`;
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
// Links: #student=<id>  \u00b7  #student=<id>&page=N  \u00b7  #student=<id>&lesson=S:F-T
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
  document.body.dataset.view = v;
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
const baseTitle = () => `${STUDENT ? STUDENT.name + ' \u00b7 ' : ''}Hifz Learning App \u00b7 ManzilulQuran`;
// After a lesson, the start form offers what comes next (same mode; the next page or ayahs once it is done).
function syncStartForm() {
  if (!L || L.status !== 'ready') return;
  H.mode = L.kind;
  const nx = lessonComplete(L) ? nextRefOf(L) : null;
  if (!nx) return;
  if (nx.kind === 'page') H.page = nx.page; else { H.surah = nx.surah; H.from = nx.from; H.to = nx.to; }
}
function goHome(opts) {
  Player.stop();
  saveNow();
  syncStartForm();
  document.title = baseTitle();
  showView('home', { push: !opts || opts.push !== false });
  renderHome();
}

/* ---------------------------------------------------------------------
   11. Home view \u2014 kept short: continue, start, revise. The method and tips sit behind buttons.
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

function lessonPercent(l) {
  if (lessonComplete(l)) return 1;
  const st = stepsOf(l);
  const saved = L; L = l;
  try { return st.filter(stepDone).length / st.length; } finally { L = saved; }
}
function renderHome() {
  const saved = savedLesson();
  const hist = history10().filter(e => e.m > 0 && !(saved && sameRange(refOf(saved), entryRef(e)))).slice(0, 4);
  const linkNote = H.link && saved && !sameRange(refOf(saved), H.link) && lessonInProgress(saved)
    ? `<div class="banner info">${ic('link')}<div>Lesson link opened: <b>${esc(refTitle(H.link))}</b>. Press <b>Start</b> to begin it.</div></div>` : '';
  let resume = '';
  if (saved) {
    const complete = lessonComplete(saved), nx = complete ? nextRefOf(saved) : null, frac = lessonPercent(saved);
    const C = 2 * Math.PI * 20;
    const acts = complete
      ? `<button class="btn btn-primary" type="button" data-act="revise" ${refAttrs(refOf(saved))}>${ic('repeat')}Revise</button>${nx ? `<button class="btn btn-soft" type="button" data-act="startref" ${refAttrs(nx)}>Next: ${esc(nx.kind === 'page' ? 'page ' + nx.page : rangeLabel(nx.from, nx.to).toLowerCase())}${ic('arrow-r')}</button>` : ''}`
      : `<button class="btn btn-primary" type="button" data-act="resume">${ic('arrow-r')}Continue</button><button class="btn btn-ghost btn-icon" type="button" data-act="discard" title="Remove this lesson"><span class="sr">Remove this lesson</span>${ic('x')}</button>`;
    resume = `<section class="card hm-resume" aria-labelledby="resT">
      <svg class="hm-ring" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="#ECE5D6"/><circle cx="24" cy="24" r="20" stroke="#B99A5D" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - frac)).toFixed(1)}" transform="rotate(-90 24 24)"/></svg>
      <div class="hm-r-main"><p class="hm-k">${complete ? 'Memorized' : 'Continue'}${mlTag(complete ? '\u00b7 \u0d2e\u0d28\u0d03\u0d2a\u0d3e\u0d20\u0d2e\u0d3e\u0d2f\u0d3f' : '\u00b7 \u0d24\u0d41\u0d1f\u0d30\u0d41\u0d15')}</p><h2 class="hm-t" id="resT">${esc(refTitle(refOf(saved)))}</h2>
        <p class="hm-m">${complete ? 'Revise before a new lesson' : `${Math.round(frac * 100)}% \u00b7 ${saved.mode === 'revise' ? 'revision \u00b7 ' : ''}${relTime(saved.updated)}`}</p></div>
      <div class="hm-r-acts">${acts}</div>
    </section>`;
  }
  const revision = hist.length ? `<section class="card hm-rev" aria-labelledby="revT">
      <div class="hm-sec-h"><h2 class="hm-st" id="revT">${ic('repeat', 'ic-sm')}Revise${mlTag('\u00b7 \u0d06\u0d35\u0d7c\u0d24\u0d4d\u0d24\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15')}</h2></div>
      <ul class="hm-rlist">${hist.map(e => { const r = entryRef(e);
        return `<li><button class="hm-ritem" type="button" data-act="revise" ${refAttrs(r)}><span class="num-badge">${r.kind === 'page' ? r.page : r.surah}</span><span class="hm-ri"><span class="hm-rt">${esc(refTitle(r))}</span><span class="hm-rm">${r.kind === 'page' ? 'Page memorized' : `${e.m}/${e.n} ayahs`} \u00b7 ${relTime(e.at)}</span></span>${ic('chev-r', 'hm-chev')}</button></li>`; }).join('')}</ul>
    </section>` : '';
  $('#homeView').innerHTML = `
    <div class="hm">
      <h1 class="sr">Hifz lessons${STUDENT ? ' \u00b7 ' + esc(STUDENT.name) : ''}</h1>
      ${resume}
      ${startCardHTML(linkNote)}
      ${revision}
      <div class="hm-links"><button class="chip" type="button" data-act="method">${ic('layers', 'ic-sm')}How it works</button><button class="chip" type="button" data-act="tips">${ic('bulb', 'ic-sm')}Tips</button></div>
      ${footerHTML()}
    </div>`;
  bindStartForm();
}
const refAttrs = r => (r.kind === 'page' ? `data-k="page" data-p="${r.page}"` : `data-k="ayah" data-s="${r.surah}" data-f="${r.from}" data-t="${r.to}"`);
const refFromEl = el => (el.dataset.k === 'page' ? { kind: 'page', page: +el.dataset.p } : { kind: 'ayah', surah: +el.dataset.s, from: +el.dataset.f, to: +el.dataset.t });

function levelSegHTML(cur, act, label) {
  return `<div class="seg lvl-seg" role="radiogroup" aria-label="${label}">${Object.keys(LEVELS).map(k => `<button type="button" role="radio" aria-checked="${cur === k}" data-act="${act}" data-v="${k}">${LEVELS[k].en}</button>`).join('')}</div>`;
}
function startCardHTML(linkNote) {
  const pageMode = H.mode === 'page';
  return `<section class="card start-card" id="startCard" aria-labelledby="startT">
    <h2 class="hm-st" id="startT">${ic('book', 'ic-sm')}New lesson${mlTag('\u00b7 \u0d2a\u0d41\u0d24\u0d3f\u0d2f \u0d2a\u0d3e\u0d20\u0d02')}</h2>
    ${linkNote || ''}
    <div class="seg mode-seg" role="radiogroup" aria-label="Learn by">
      <button type="button" role="radio" aria-checked="${!pageMode}" data-act="startmode" data-m="ayah">${ic('layers')}Ayahs</button>
      <button type="button" role="radio" aria-checked="${pageMode}" data-act="startmode" data-m="page">${ic('book')}Mushaf page</button>
    </div>
    <div id="formAyah"${pageMode ? ' hidden' : ''} class="form-grid">
      <button type="button" class="surah-field" data-act="openpicker" aria-haspopup="dialog">
        <span class="sr">Surah, change: </span><span class="num-badge" id="sfNum"></span>
        <span class="sf-main"><span class="sf-en" id="sfName"></span><span class="sf-meta" id="sfMeta"></span></span>
        <span class="sf-ar ar-ui" lang="ar" id="sfAr"></span>
        ${ic('chev-d', 'sf-chev')}
      </button>
      <div class="range-row">
        <div class="field"><label class="field-label" for="inFrom">From ayah</label>
          <div class="stepper"><button type="button" data-act="rng" data-f="from" data-d="-1" aria-label="Decrease the first ayah">\u2212</button><input id="inFrom" type="number" inputmode="numeric" min="1"><button type="button" data-act="rng" data-f="from" data-d="1" aria-label="Increase the first ayah">+</button></div></div>
        <div class="field"><label class="field-label" for="inTo">To ayah</label>
          <div class="stepper"><button type="button" data-act="rng" data-f="to" data-d="-1" aria-label="Decrease the last ayah">\u2212</button><input id="inTo" type="number" inputmode="numeric" min="1"><button type="button" data-act="rng" data-f="to" data-d="1" aria-label="Increase the last ayah">+</button></div></div>
      </div>
      <div class="quick" id="quickRanges"></div>
      <p class="form-msg ok" id="rangeMsg" aria-live="polite"></p>
    </div>
    <div id="formPage"${pageMode ? '' : ' hidden'} class="form-grid">
      <div class="page-row">
        <label class="sr" for="inPage">Page number</label>
        <div class="stepper"><button type="button" data-act="pgstep" data-d="-1" aria-label="Previous page">\u2212</button><input id="inPage" type="number" inputmode="numeric" min="1" max="${PAGE_COUNT}"><button type="button" data-act="pgstep" data-d="1" aria-label="Next page">+</button></div>
        <button class="btn btn-sm btn-soft" type="button" data-act="openpicker" data-for="page">${ic('search')}Find by surah</button>
      </div>
      <div class="page-preview" id="pagePreview" aria-live="polite"></div>
      <div class="quick" id="quickPages"></div>
      <p class="form-msg ok" id="pageMsg" aria-live="polite"></p>
    </div>
    <div class="lvl-row"><span class="field-label" id="lblLvl">Part size${mlTag('\u00b7 \u0d2d\u0d3e\u0d17\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d4d\u0d31\u0d46 \u0d35\u0d32\u0d41\u0d2a\u0d4d\u0d2a\u0d02')}</span>${levelSegHTML(S.level, 'startlevel', 'Part size')}<span class="lvl-hint" id="lvlHint">${esc(LEVELS[S.level].hint)}</span></div>
    <button class="btn btn-primary start-btn" type="button" data-act="start" id="btnStart"><span id="btnStartTxt">${pageMode ? 'Start page lesson' : 'Start lesson'}</span>${ic('arrow-r')}</button>
  </section>`;
}

function bindStartForm() {
  const f = $('#inFrom'), t = $('#inTo'), pg = $('#inPage');
  if (!f) return;
  f.addEventListener('input', () => { H.from = parseInt(f.value, 10); refreshStartForm(false); });
  t.addEventListener('input', () => { H.to = parseInt(t.value, 10); refreshStartForm(false); });
  pg.addEventListener('input', () => { H.page = parseInt(pg.value, 10); refreshStartForm(false); });
  [f, t, pg].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); startFromForm(); } }));
  refreshStartForm(true);
}
function rangeError() {
  const su = surahOf(H.surah), f = H.from, t = H.to;
  if (!Number.isInteger(f) || !Number.isInteger(t)) return 'Enter the first and last ayah numbers.';
  if (f < 1) return 'Ayah numbers start from 1.';
  if (t > su.ayahs || f > su.ayahs) return `${su.en} has ${su.ayahs} ayahs.`;
  if (f > t) return '\u201cFrom\u201d must not be after \u201cTo\u201d.';
  if (t - f + 1 > MAX_AYAHS) return `Choose up to ${MAX_AYAHS} ayahs at a time \u2014 you chose ${t - f + 1}.`;
  return '';
}
const pageError = () => (Number.isInteger(H.page) && H.page >= 1 && H.page <= PAGE_COUNT ? '' : `Enter a page number from 1 to ${PAGE_COUNT}.`);
function refreshStartForm(writeInputs) {
  if (!$('#sfName')) return;
  const pageMode = H.mode === 'page';
  $('#formAyah').hidden = pageMode; $('#formPage').hidden = !pageMode;
  $$('[data-act="startmode"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.m === H.mode)));
  $$('[data-act="startlevel"]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === S.level)));
  $('#lvlHint').textContent = LEVELS[S.level].hint;
  $('#btnStartTxt').textContent = pageMode ? 'Start page lesson' : 'Start lesson';
  const su = surahOf(H.surah);
  $('#sfNum').textContent = su.n;
  $('#sfName').textContent = su.en;
  $('#sfMeta').textContent = `${su.meaning} \u00b7 ${su.ayahs} ayahs`;
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
  if (hist && hist.t < su.ayahs) { const len = Math.max(1, hist.t - hist.f + 1); add(hist.t + 1, Math.min(su.ayahs, hist.t + len), `Next: ${hist.t + 1}\u2013${Math.min(su.ayahs, hist.t + len)}`); }
  if (su.ayahs > 3) add(1, 3, '1\u20133');
  if (su.ayahs > 5) add(1, 5, '1\u20135');
  if (su.ayahs <= MAX_AYAHS) add(1, su.ayahs, `Whole surah (${su.ayahs})`);
  $('#quickRanges').innerHTML = q.map(x => `<button class="chip" type="button" data-act="quick" data-a="${x.a}" data-b="${x.b}" aria-pressed="${x.a === H.from && x.b === H.to}">${esc(x.label)}</button>`).join('');
  const err = rangeError(), msg = $('#rangeMsg');
  if (err) { msg.textContent = err; msg.classList.remove('ok'); }
  else { const c = H.to - H.from + 1; msg.textContent = `${c} ${plural(c, 'ayah')}`; msg.classList.add('ok'); }
  const perr = pageError(), pmsg = $('#pageMsg'), prev = $('#pagePreview');
  if (perr) { prev.innerHTML = `<div class="pp-main"><p class="pp-m">${esc(perr)}</p></div>`; pmsg.textContent = ''; }
  else {
    const ps = pageSummary(H.page);
    prev.innerHTML = `<span class="pp-n" aria-hidden="true">${toAr(H.page)}</span><div class="pp-main"><p class="pp-t">Page ${H.page} \u00b7 Juz ${ps.juz}</p><p class="pp-m">${pageLabelHTML(ps)} \u00b7 <span class="nb">${ps.count} ${plural(ps.count, 'ayah')}</span></p></div><span class="pp-ar ar-ui" lang="ar">${esc(ps.ar)}</span>`;
    pmsg.textContent = '';
  }
  const lastP = history10().find(e => e.k === 'p');
  const pq = [];
  const addP = (p, label) => { if (p >= 1 && p <= PAGE_COUNT && !pq.some(x => x.p === p)) pq.push({ p, label }); };
  const np = lastP && nextPageOf(lastP.p);
  if (np) addP(np, `Next: page ${np}`);
  addP(1, 'Page 1'); addP(582, 'Juz\u02be \u02bfAmma \u00b7 582'); addP(PAGE_COUNT, `${PAGE_COUNT}`);
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
  return confirmBox({ title: 'Start a new lesson?', body: `Your saved lesson (${refTitle(refOf(saved))}) will be replaced. Memorized ayahs stay in the revision list.`,
    ml: '\u0d07\u0d2a\u0d4d\u0d2a\u0d4b\u0d34\u0d24\u0d4d\u0d24\u0d46 \u0d2a\u0d3e\u0d20\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d4d \u0d2a\u0d15\u0d30\u0d02 \u0d2a\u0d41\u0d24\u0d3f\u0d2f \u0d2a\u0d3e\u0d20\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d41\u0d02.', ok: 'Start new lesson' });
}

const METHOD = () => [
  ['Read', '\u0d15\u0d23\u0d4d\u0d1f\u0d4d \u0d13\u0d24\u0d41\u0d15', 'Read every ayah once, looking at it. Use the translation if it helps.'],
  ['Memorize in parts', '\u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d33\u0d3e\u0d2f\u0d3f \u0d2e\u0d28\u0d03\u0d2a\u0d3e\u0d20\u0d2e\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15', 'Learn the ayah part by part without looking. Part size: Min, Medium or Max.'],
  ['Join the parts', '\u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d7e \u0d1a\u0d47\u0d7c\u0d15\u0d4d\u0d15\u0d41\u0d15', 'Join the parts (1+2, 1\u20133 \u2026) until the whole ayah is memorized.'],
  ['Make together', '\u0d12\u0d30\u0d41\u0d2e\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d \u0d13\u0d24\u0d41\u0d15', 'After the next ayah, join it with the ones before: 1+2, then 1\u20133 \u2026'],
  ['All together', '\u0d0e\u0d32\u0d4d\u0d32\u0d3e\u0d02 \u0d12\u0d30\u0d41\u0d2e\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d', 'Finally recite everything together from memory and check yourself.']
];
function methodHTML() {
  return `<ol class="method-list">${METHOD().map(([en, ml, d], k) => `<li><span class="m-n">${k + 1}</span><div><p class="m-t">${en}</p><p class="m-ml" lang="ml">${ml}</p><p class="m-d">${d}</p></div></li>`).join('')}</ol>
    <div class="callout">${ic('eye-off')}<div><b>Hide button.</b> Tap once: faint. Again: only pinned words. Again: hidden. Again: shown.${mlTag('<br>\u0d12\u0d30\u0d41 \u0d24\u0d35\u0d23: \u0d2e\u0d19\u0d4d\u0d19\u0d41\u0d02 \u00b7 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02: \u0d2a\u0d3f\u0d7b \u0d1a\u0d46\u0d2f\u0d4d\u0d24 \u0d35\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15\u0d7e \u0d2e\u0d3e\u0d24\u0d4d\u0d30\u0d02 \u00b7 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02: \u0d2e\u0d31\u0d2f\u0d41\u0d02 \u00b7 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02: \u0d15\u0d3e\u0d23\u0d41\u0d02.')}</div></div>
    <div class="callout">${ic('pin')}<div><b>Pin.</b> Where two words don\u2019t connect in your memory, pin them together. Pinned words stay visible in the \u201cPins\u201d hide step.</div></div>
    <p class="hint" style="margin-top:12px">You count each repetition yourself. The app does not listen to your recitation.</p>`;
}

const TIPS = [
  ['\u0d05\u0d7c\u0d24\u0d4d\u0d25\u0d02 \u0d06\u0d26\u0d4d\u0d2f\u0d02 \u0d2e\u0d28\u0d38\u0d4d\u0d38\u0d3f\u0d32\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15. \u0d05\u0d7c\u0d24\u0d4d\u0d25\u0d02 \u0d05\u0d31\u0d3f\u0d2f\u0d41\u0d2e\u0d4d\u0d2a\u0d4b\u0d7e \u0d13\u0d7c\u0d2e\u0d4d\u0d2e \u0d0e\u0d33\u0d41\u0d2a\u0d4d\u0d2a\u0d2e\u0d3e\u0d15\u0d41\u0d02.', 'Understand the meaning first. When you know the meaning, it is easier to remember.'],
  ['\u0d1a\u0d46\u0d31\u0d3f\u0d2f \u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d33\u0d3e\u0d2f\u0d3f \u0d2a\u0d20\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15. \u0d28\u0d40\u0d33\u0d2e\u0d41\u0d33\u0d4d\u0d33 \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d4d Min, \u0d1a\u0d46\u0d31\u0d3f\u0d2f\u0d35\u0d2f\u0d4d\u0d15\u0d4d\u0d15\u0d4d Max \u0d09\u0d2a\u0d2f\u0d4b\u0d17\u0d3f\u0d15\u0d4d\u0d15\u0d3e\u0d02.', 'Learn in small parts. Use Min for long, hard ayahs and Max for easy ones.'],
  ['\u0d1a\u0d46\u0d31\u0d3f\u0d2f \u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d7e \u0d2a\u0d20\u0d3f\u0d1a\u0d4d\u0d1a \u0d36\u0d47\u0d37\u0d02 \u0d05\u0d35 \u0d15\u0d4d\u0d30\u0d2e\u0d47\u0d23 \u0d1a\u0d47\u0d7c\u0d24\u0d4d\u0d24\u0d4d \u0d13\u0d24\u0d41\u0d15.', 'Join small parts step by step: 1+2, then 1\u20133, until the whole ayah is done.'],
  ['\u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d2f\u0d3f\u0d7d \u0d24\u0d41\u0d1f\u0d7c\u0d1a\u0d4d\u0d1a \u0d15\u0d3f\u0d1f\u0d4d\u0d1f\u0d3e\u0d24\u0d4d\u0d24 \u0d35\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15\u0d7e \u0d2a\u0d3f\u0d7b \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d41\u0d15.', 'Pin the places where the words don\u2019t connect in your memory.'],
  ['\u0d2c\u0d41\u0d26\u0d4d\u0d27\u0d3f\u0d2e\u0d41\u0d1f\u0d4d\u0d1f\u0d41\u0d33\u0d4d\u0d33 \u0d35\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15\u0d33\u0d41\u0d02 \u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d02 \u0d15\u0d42\u0d1f\u0d41\u0d24\u0d7d \u0d2a\u0d4d\u0d30\u0d3e\u0d35\u0d36\u0d4d\u0d2f\u0d02 \u0d06\u0d35\u0d7c\u0d24\u0d4d\u0d24\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.', 'Repeat hard words and parts more times. Come back to them later.'],
  ['\u0d2a\u0d41\u0d24\u0d3f\u0d2f \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d4d \u0d2a\u0d20\u0d3f\u0d1a\u0d4d\u0d1a \u0d36\u0d47\u0d37\u0d02, \u0d2e\u0d41\u0d2e\u0d4d\u0d2a\u0d4d \u0d2a\u0d20\u0d3f\u0d1a\u0d4d\u0d1a \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d41\u0d15\u0d33\u0d4b\u0d1f\u0d4d \u0d1a\u0d47\u0d7c\u0d24\u0d4d\u0d24\u0d4d \u0d13\u0d24\u0d41\u0d15.', 'After a new ayah, make it together with the ayahs before it.']
];
function tipsHTML() {
  return `<ol class="tips">${TIPS.map(([ml, en], k) => `<li><span class="t-n">${k + 1}</span><div><p class="t-ml" lang="ml">${ml}</p>${EN() || S.englishHelp ? `<p class="t-en">${en}</p>` : ''}</div></li>`).join('')}</ol>
  <div class="callout">${ic('info')}<div><b>About your notes.</b> Your note is only your own reminder. It is not a translation or tafsir.${mlTag('<br>\u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d15\u0d4d\u0d15\u0d41\u0d31\u0d3f\u0d2a\u0d4d\u0d2a\u0d4d \u0d28\u0d3f\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d1f\u0d46 \u0d38\u0d4d\u0d35\u0d28\u0d4d\u0d24\u0d02 \u0d38\u0d39\u0d3e\u0d2f\u0d02 \u0d2e\u0d3e\u0d24\u0d4d\u0d30\u0d2e\u0d3e\u0d23\u0d4d \u2014 \u0d05\u0d24\u0d4d \u0d2a\u0d30\u0d3f\u0d2d\u0d3e\u0d37\u0d2f\u0d4b \u0d24\u0d2b\u0d4d\u200c\u0d38\u0d40\u0d31\u0d4b \u0d05\u0d32\u0d4d\u0d32.')}</div></div>`;
}
function footerHTML() {
  return `<footer class="footer"><p>Quran text: Tanzil Uthmani (AlQuran Cloud) \u00b7 Madani mushaf pages \u00b7 Saved in this browser.</p></footer>`;
}

/* ---------------------------------------------------------------------
   12. Surah picker (also used to find a page by surah)
   --------------------------------------------------------------------- */
const simp = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
  .replace(/ee/g, 'i').replace(/oo/g, 'u').replace(/(.)\1+/g, '$1');
const normArSearch = s => normAr(s).replace(/\u0629/g, '\u0647').replace(/\u0649/g, '\u064a').replace(/\s+/g, '');
const normMl = s => String(s).replace(/\u0d32\u0d4d\u200d/g, '\u0d7d').replace(/\u0d28\u0d4d\u200d/g, '\u0d7b').replace(/\u0d30\u0d4d\u200d/g, '\u0d7c')
  .replace(/\u0d33\u0d4d\u200d/g, '\u0d7e').replace(/\u0d23\u0d4d\u200d/g, '\u0d7a').replace(/[\u200c\u200d\s]/g, '');
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
  const qs = simp(q), qa = /[\u0600-\u06ff]/.test(q) ? normArSearch(q) : '', qm = /[\u0d00-\u0d7f]/.test(q) ? normMl(q) : '';
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
    if (qa && e.ar.includes(qa)) sc = Math.min(sc, (e.ar.startsWith(qa) || e.ar.startsWith('\u0627\u0644' + qa)) ? 0 : 1);
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
    ? list.map(s => `<li><button type="button" class="s-item" data-act="pick" data-n="${s.n}"${s.n === cur ? ' aria-current="true"' : ''}><span class="num-badge">${s.n}</span><span class="s-main"><span class="s-en">${esc(s.en)}</span><span class="s-meta">${esc(s.meaning)} \u00b7 ${s.ayahs} ayahs \u00b7 ${P.forPage ? `starts on page ${pageOf(s.n, 1)}` : s.type}</span></span><span class="s-ar ar-ui" lang="ar">${esc(s.ar)}</span></button></li>`).join('')
    : `<li class="s-empty">No surah matches \u201c${esc(q)}\u201d.${mlTag('<br>\u0d08 \u0d2a\u0d47\u0d30\u0d3f\u0d7d \u0d38\u0d42\u0d31\u0d24\u0d4d\u0d24\u0d4d \u0d15\u0d23\u0d4d\u0d1f\u0d46\u0d24\u0d4d\u0d24\u0d3e\u0d28\u0d3e\u0d2f\u0d3f\u0d32\u0d4d\u0d32.')}</li>`;
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
  Player.stop();
  const lesson = makeLesson(ref, mode);
  lesson.level = S.level;
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
    segs.forEach((sg, j) => {
      for (let n = sg.f; n <= sg.t; n++) {
        let text = ar.value[j].texts.get(n), bas = null;
        if (n === 1 && sg.s !== 1 && sg.s !== 9) { const sp = splitBasmalah(text); if (sp.basmalah) { text = sp.rest; bas = sp.basmalah; } }
        lesson.items.push({ s: sg.s, a: n, text, bas, tr: trOK ? (tr.value[j].texts.get(n) || '') : '' });
      }
    });
    lesson.trEd = trEd;
    lesson.trErr = trEd !== 'none' && (!trOK || lesson.items.some(x => !x.tr));
    lesson.status = 'ready';
    syncUnits();
    if (lesson.mode === 'revise') prepRevise();
    renderLesson();
    saveNow();
    if (lesson.trErr) toast('The translation could not be loaded \u2014 you can still memorize.', '\u0d2a\u0d30\u0d3f\u0d2d\u0d3e\u0d37 \u0d32\u0d4b\u0d21\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d3e\u0d28\u0d3e\u0d2f\u0d3f\u0d32\u0d4d\u0d32.', 'info');
  } catch (err) {
    if (seq !== loadSeq) return;
    lesson.status = 'error'; lesson.error = err;
    renderLessonError(err);
  }
}
// Revision: the ayahs are already memorized \u2014 go straight to \u201cAll together\u201d, hidden.
function prepRevise() {
  L.read = L.items.map((_, i) => i);
  unitsOf(L).parts.forEach((_, u) => { segState(u).done = true; });
  L.step = stepsOf(L).length - 1;
  L.focusHide = 3;
}
function openSaved(saved, push) {
  L = saved;
  showView('lesson', { push: !!push });
  renderLesson();
  if (L.trEd !== S.translation || (L.trEd !== 'none' && L.items.some(x => !x.tr))) reloadTranslation();
}
async function reloadTranslation() {
  if (!L || L.status !== 'ready') return;
  const ed = S.translation, lesson = L;
  L.trEd = ed;
  if (ed === 'none') { L.items.forEach(x => { x.tr = ''; }); L.trErr = false; renderLesson(); persist(); return; }
  L.trLoading = true; renderLesson();
  try {
    const segs = segmentsOf(refOf(L));
    const res = await Promise.all(segs.map(sg => fetchEdition(sg.s, sg.f, sg.t, ed)));
    if (lesson !== L || L.trEd !== ed) return;
    L.items.forEach(x => { const j = segs.findIndex(sg => sg.s === x.s && x.a >= sg.f && x.a <= sg.t); x.tr = (j >= 0 && res[j].texts.get(x.a)) || ''; });
    L.trErr = L.items.some(x => !x.tr);
  } catch (e) {
    if (lesson !== L || L.trEd !== ed) return;
    L.trErr = true;
    toast('The translation could not be loaded. ' + errText(e).en, '\u0d2a\u0d30\u0d3f\u0d2d\u0d3e\u0d37 \u0d32\u0d4b\u0d21\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d3e\u0d28\u0d3e\u0d2f\u0d3f\u0d32\u0d4d\u0d32.', 'info');
  }
  L.trLoading = false; renderLesson(); persist();
}

function loadingTitle() {
  if (L.kind === 'page') { const ps = pageSummary(L.page); return { t: `Page ${L.page}`, m: `Juz ${ps.juz} \u00b7 ${ps.label}`, n: 1 }; }
  const su = surahOf(L.surah);
  return { t: su.en, m: rangeLabel(L.from, L.to), n: L.to - L.from + 1 };
}
function renderLessonLoading() {
  const h = loadingTitle();
  $('#lessonView').innerHTML = `<div class="lx"><section class="cv" aria-busy="true">
    <header class="cv-head"><button class="cv-back" type="button" data-act="home" aria-label="Back to lessons">${ic('chev-l')}</button>
      <div class="cv-title"><h1>${esc(h.t)}</h1><p>${esc(h.m)}</p></div></header>
    <p class="st-tip" role="status">Loading the Quran text\u2026${mlTag('\u00b7 \u0d16\u0d41\u0d7c\u0d06\u0d7b \u0d35\u0d3e\u0d1a\u0d15\u0d02 \u0d32\u0d4b\u0d21\u0d4d \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d41\u0d28\u0d4d\u0d28\u0d41\u2026')}</p>
    ${range(1, Math.min(h.n === 1 && L.kind === 'page' ? 5 : h.n, 4)).map(k => `<div class="ay sk-row" aria-hidden="true"><div class="sk" style="height:14px;width:22%"></div><div class="sk" style="height:${k % 2 ? 54 : 40}px;margin-top:14px"></div></div>`).join('')}
  </section></div>`;
}
function renderLessonError(err) {
  const e = errText(err), h = loadingTitle();
  $('#lessonView').innerHTML = `<div class="lx"><section class="cv"><div class="err" role="alert">
    <span class="e-ic">${ic(e.icon, 'ic-lg')}</span>
    <h2 class="h2">Could not load ${esc(h.t)}${L.kind === 'page' ? '' : ' \u00b7 ' + esc(h.m)}</h2>
    <p>${esc(e.en)}</p>${EN() ? '' : `<p lang="ml" class="muted">${esc(e.ml)}</p>`}
    <div class="row"><button class="btn btn-primary" type="button" data-act="retryload">${ic('refresh')}Try again</button><button class="btn" type="button" data-act="home">${ic('arrow-l')}Back</button></div>
    <p class="hint">Ayahs and pages opened recently on this device open again without internet.</p>
  </div></section></div>`;
}

/* ---------------------------------------------------------------------
   14. Lesson screen
   Left / top: the text being learned (light, quiet).
   Right / bottom: the controls (dark panel) \u2014 counter, hide, next, tools.
   --------------------------------------------------------------------- */
// what the current step works on
function focusOf() {
  const st = curStep();
  if (st.t === 'seg') {
    const ps = piecesOf(L, st.u), g = segState(st.u), js = joinSteps(ps.length);
    const on = g.ph === 'parts' ? [g.k, g.k] : g.ph === 'join' ? (js[g.cs] || [0, ps.length - 1]) : [0, ps.length - 1];
    return { st, u: st.u, ps, g, js, on, items: unitsOf(L).parts[st.u] };
  }
  if (st.t === 'chain') return { st, u: st.u, items: [].concat(...unitsOf(L).parts.slice(0, st.u + 1)) };
  return { st, items: L.items.map((_, i) => i) };
}
function counterOf(f) {
  const st = f.st;
  if (st.t === 'seg') {
    const g = f.g;
    if (g.ph === 'parts') return { c: g.pc[g.k] || 0, t: S.groupReps };
    if (g.ph === 'join') return { c: g.cc[g.cs] || 0, t: S.comboReps };
    return { c: g.fc, t: S.ayahReps };
  }
  if (st.t === 'chain') return { c: L.chain[st.u] || 0, t: S.joinReps };
  if (st.t === 'final') return { c: L.fin.c, t: finalReps() };
  return null;
}
function focusHasPins(f) {
  if (f.st.t !== 'seg') return itemsHavePins(f.items);
  const set = pinSet();
  for (let k = f.on[0]; k <= f.on[1]; k++) { const p = f.ps[k]; for (let w = p.w0; w <= p.w1; w++) if (pinnedWord(set, p.i, w)) return true; }
  return false;
}
const trLang = () => trInfo(L.trEd).lang || 'en';
const trTag = () => (trLang() === 'ml' ? 'ML' : 'EN');
const itemLabel = i => (L.kind === 'page' ? `${surahOf(L.items[i].s).en} ${L.items[i].a}` : `Ayah ${L.items[i].a}`);

/* ---------- Arabic text: words, part colours, links and hiding ---------- */
// One word. A link "i:w" joins word w to the next word: the first word gets "la", the second "lb".
// Nothing is inserted between the words, so linking never moves the text.
function wordSpan(i, w, set, h, extra) {
  const la = set.has(`${i}:${w}`), lb = w > 0 && set.has(`${i}:${w - 1}`);
  return `<span class="w${la ? ' la' : ''}${lb ? ' lb' : ''}${h ? ' h' + h : ''}${extra ? ' ' + extra : ''}" data-w="${i}:${w}">${esc(wordsOf(L)[i][w].t)}</span>`;
}
const partTint = k => (S.partColors ? `tint c${(k % 4) + 1}` : '');
const unitOfItem = i => unitsOf(L).parts.findIndex(p => p.includes(i));
// the parts of one ayah (each in its own colour), for the "together" views
function itemRuns(i, focus) {
  const ws = wordsOf(L)[i];
  if (!S.partColors) return [{ w0: 0, w1: ws.length - 1, cls: '', focus }];
  return levelParts(ws, levelOf(L, Math.max(0, unitOfItem(i))), S.pauseBreak).map(([w0, w1], k) => ({ w0, w1, focus, cls: partTint(k) }));
}
// runs: [{ w0, w1, cls, focus }] \u2014 the parts of this ayah; focus parts take the main Hide state
function wordsHTML(i, o) {
  const ws = wordsOf(L)[i], set = pinSet(), it = L.items[i];
  const runs = o.runs || [{ w0: 0, w1: ws.length - 1, cls: '', focus: !!o.allFocus }];
  return runs.map(r => {
    const h = Math.max(o.rowH || 0, r.focus ? (o.focusH || 0) : 0);
    let s = '';
    for (let w = r.w0; w <= r.w1; w++) {
      const word = wordSpan(i, w, set, h);
      if (w === ws.length - 1) { s += `<span class="nb">${word}&nbsp;<span class="ayah-end">${toAr(it.a)}</span></span>`; break; }
      s += word + (w < r.w1 ? ' ' : '');
    }
    return `<span class="pc${r.cls ? ' ' + r.cls : ''}${h >= 2 ? ' hid' : ''}">${s}</span>`;
  }).join(' ');
}
function suraHeadHTML(s) {
  const su = surahOf(s);
  return `<div class="sura-head"><span class="sh-ar" lang="ar">\u0633\u0648\u0631\u0629 ${esc(su.ar)}</span><span class="sh-en">${esc(su.en)}</span></div>`;
}
function unitColOf() {
  const { parts, cols } = unitsOf(L), out = [];
  parts.forEach((p, u) => p.forEach(i => { out[i] = cols[u] % 8; }));
  return out;
}
// one ayah row. o: { runs, allFocus, focusH, readMode, cur, noHide }
function rowHTML(i, o) {
  const it = L.items[i], label = itemLabel(i), rh = o.noHide ? 0 : (L.rowHide[i] || 0);
  const tv = trVisible(i), hasTr = L.trEd !== 'none' && !!it.tr;
  const read = L.read.includes(i);
  let pre = '';
  if (L.kind === 'page' && it.a === 1) pre += suraHeadHTML(it.s);
  if (it.bas) pre += `<p class="bas" lang="ar" dir="rtl">${esc(it.bas)}</p>`;
  const multi = unitsOf(L).parts.some(p => p.length > 1), col = multi ? unitColOf()[i] : -1;
  const tools = [
    L.notes[i] ? `<button class="ib" type="button" data-act="note" data-i="${i}" title="Your note"><span class="sr">Your note for ${esc(label)}</span>${ic('pen')}</button>` : '',
    hasTr ? `<button class="ib trk${tv ? ' on' : ''}" type="button" data-act="rowtr" data-i="${i}" aria-pressed="${tv}" title="Translation"><span class="sr">Translation of ${esc(label)}</span><span class="trk-t" aria-hidden="true">${trTag()}</span></button>` : '',
    o.noHide ? '' : `<button class="ib${rh ? ' on' : ''}" type="button" data-act="rowhide" data-i="${i}" title="Hide this ayah"><span class="sr">Hide ${esc(label)} \u2014 now ${HIDE_TXT[rh].note.toLowerCase()}</span>${ic(rh ? HIDE_TXT[rh].icon : 'eye-off')}</button>`,
    o.readMode ? `<button class="ib ay-chk${read ? ' on' : ''}" type="button" data-act="read" data-i="${i}" aria-pressed="${read}" title="Read"><span class="sr">${esc(label)} read</span>${ic('check')}</button>` : ''
  ].join('');
  return `${pre}<article class="ay${o.cur ? ' cur' : ''}${col >= 0 ? ' c' + (col + 1) : ''}" data-i="${i}">
    <div class="ay-bar"><span class="ay-ref">${esc(label)}</span><span class="ay-tools">${tools}</span></div>
    <p class="ar" lang="ar" dir="rtl">${wordsHTML(i, { runs: o.runs, allFocus: o.allFocus, rowH: rh, focusH: o.focusH })}</p>
    ${tv ? `<p class="tr tr-txt" lang="${trLang()}">${esc(it.tr)}</p>` : ''}
  </article>`;
}
function mushafHTML() {
  const colOf = unitColOf();
  let html = '', flow = '';
  const flush = () => { if (flow) { html += `<p class="mflow">${flow}</p>`; flow = ''; } };
  L.items.forEach((it, i) => {
    if (it.a === 1) { flush(); html += suraHeadHTML(it.s); if (it.bas) html += `<p class="sura-bas">${esc(it.bas)}</p>`; }
    const ws = wordsOf(L)[i].map(w => `<span class="w">${esc(w.t)}</span>`);
    flow += `<span class="pp c${colOf[i] + 1}">${glueEnd(ws, `<span class="ayah-end">${toAr(it.a)}</span>`)}</span> `;
  });
  flush();
  return `<div class="mushaf" lang="ar" dir="rtl">${html}</div>`;
}

/* ---------- the Madani mushaf (exact 15-line pages, mushaf.v1.js) ---------- */
const BASMALAH_TXT = '\u0628\u0650\u0633\u0652\u0645\u0650 \u0671\u0644\u0644\u064e\u0651\u0647\u0650 \u0671\u0644\u0631\u064e\u0651\u062d\u0652\u0645\u064e\u0670\u0646\u0650 \u0671\u0644\u0631\u064e\u0651\u062d\u0650\u064a\u0645\u0650';
const MTX = new Map();   // "s:a" \u2192 Arabic text of every ayah on the pages shown (ayah 1 without the basmalah)
const hasMushaf = () => typeof MUSHAF_LINES !== 'undefined' && Array.isArray(MUSHAF_LINES) && MUSHAF_LINES.length === PAGE_COUNT;
const lessonPages = () => Array.from(new Set(L.items.map(it => pageOf(it.s, it.a))));
const pagesReady = ps => ps.every(p => pageAyahs(p).every(([s, a]) => MTX.has(`${s}:${a}`)));
let mtxLoad = null;
function loadPages(ps) {
  if (mtxLoad) return;
  const lesson = L;
  mtxLoad = Promise.all(ps.map(p => Promise.all(pageSegments(p).map(sg => fetchEdition(sg.s, sg.f, sg.t, QURAN_EDITION).then(r => {
    for (let n = sg.f; n <= sg.t; n++) {
      let t = r.texts.get(n);
      if (n === 1 && sg.s !== 1 && sg.s !== 9) { const sp = splitBasmalah(t); if (sp.basmalah) t = sp.rest; }
      MTX.set(`${sg.s}:${n}`, t);
    }
  }))))).then(() => true, () => false).then(ok => {
    mtxLoad = null;
    if (lesson !== L) return;
    if (!ok) { L.mtxErr = true; toast('The full mushaf page could not be loaded \u2014 showing the ayahs.', '', 'info'); }
    renderLesson();
  });
}
function mushafLines(p) {
  let cur = 0;
  return MUSHAF_LINES[p - 1].split('|').map(x => {
    if (x[0] === 'H') { cur = +x.slice(1); return { t: 'h', s: cur }; }
    if (x === 'B') return { t: 'b', s: cur };
    const star = x[0] === '*', q = (star ? x.slice(1) : x).split(':').map(Number);
    if (q.length === 3) cur = q.shift();
    return { t: 'x', s: cur, a: q[0], w: q[1] - 1, star };
  });
}
// o: { focus: Set of item indexes that take the Hide state, colorOf(i, w) \u2192 class, ctxDim }
function mushafPageHTML(p, o) {
  const set = pinSet(), idx = new Map(L.items.map((it, i) => [`${it.s}:${it.a}`, i]));
  const stream = [], pos = new Map();
  pageAyahs(p).forEach(([s, a]) => {
    const ws = tokenize(MTX.get(`${s}:${a}`) || '');
    ws.forEach((w, k) => { pos.set(`${s}:${a}:${k}`, stream.length); stream.push({ s, a, k, t: w.t, last: k === ws.length - 1 }); });
  });
  const lines = mushafLines(p), starts = lines.map(l => (l.t === 'x' ? pos.get(`${l.s}:${l.a}:${l.w}`) : null));
  const marker = (s, a, i) => `<span class="ayah-end${i == null ? ' cx' : ''}">${toAr(a)}</span>`;
  let html = '';
  lines.forEach((l, li) => {
    if (l.t === 'h') { html += `<div class="ml mh">${suraHeadHTML(l.s)}</div>`; return; }
    if (l.t === 'b') { const i = idx.get(`${l.s}:1`); html += `<div class="ml mb${i == null ? ' cx' : ''}">${esc((i != null && L.items[i].bas) || BASMALAH_TXT)}</div>`; return; }
    const from = starts[li];
    let to = stream.length;
    for (let k = li + 1; k < lines.length; k++) if (starts[k] != null) { to = starts[k]; break; }
    if (from == null) return;
    const nextStar = (() => { for (let k = li + 1; k < lines.length; k++) if (lines[k].t === 'x') return lines[k].star; return false; })();
    const items = [];
    if (l.star && from > 0) { const pw = stream[from - 1]; items.push(marker(pw.s, pw.a, idx.get(`${pw.s}:${pw.a}`))); }
    for (let n = from; n < to; n++) {
      const x = stream[n], i = idx.get(`${x.s}:${x.a}`);
      let word;
      if (i == null || !wordsOf(L)[i][x.k]) word = `<span class="w cx">${esc(x.t)}</span>`;
      else {
        const h = o.focus && o.focus.has(i) ? L.focusHide : 0;
        word = wordSpan(i, x.k, set, h, [o.colorOf ? o.colorOf(i, x.k) : '', o.focus && !o.focus.has(i) ? 'cx' : ''].filter(Boolean).join(' '));
      }
      if (x.last && !(n === to - 1 && nextStar)) word = `<span class="nb">${word}&nbsp;${marker(x.s, x.a, i)}</span>`;
      items.push(word);
    }
    html += `<div class="ml">${items.join(' ')}</div>`;
  });
  const ps = pageSummary(p);
  return `<section class="mp" data-p="${p}" aria-label="Mushaf page ${p}"><p class="mp-h"><span>Page ${p}</span><span>Juz ${ps.juz}</span></p>
    <div class="mp-l${p <= 2 ? ' cen' : ''}" lang="ar" dir="rtl">${html}</div></section>`;
}
// every page of the lesson, exactly as in the mushaf (loads the rest of the page first)
function mushafViewHTML(o) {
  const ps = lessonPages();
  L.items.forEach(it => { if (!MTX.has(`${it.s}:${it.a}`)) MTX.set(`${it.s}:${it.a}`, it.text); });
  if (!pagesReady(ps)) {
    setTimeout(() => loadPages(ps), 0);
    return `<div class="mp-load" role="status"><div class="sk" style="height:18px;width:40%"></div><div class="sk" style="height:220px;margin-top:12px"></div><p class="hint">Loading the mushaf page\u2026</p></div>`;
  }
  return `<div class="mps">${ps.map(p => mushafPageHTML(p, o)).join('')}</div>`;
}
const useMushaf = () => hasMushaf() && !L.mtxErr && S.tgView === 'mushaf';
function viewSegHTML() {
  if (!hasMushaf() || L.mtxErr) return '';
  return `<div class="seg view-seg" role="radiogroup" aria-label="View">${[['mushaf', `${ic('book', 'ic-sm')}Mushaf`], ['ayahs', `${ic('layers', 'ic-sm')}Ayahs`]].map(([v, l]) => `<button type="button" role="radio" aria-checked="${S.tgView === v}" data-act="tgview" data-v="${v}">${l}</button>`).join('')}</div>`;
}
function partColorFn() {
  if (!S.partColors) return null;
  const cache = new Map();
  return (i, w) => {
    if (!cache.has(i)) { const m = []; levelParts(wordsOf(L)[i], levelOf(L, Math.max(0, unitOfItem(i))), S.pauseBreak).forEach(([a, b], k) => { for (let x = a; x <= b; x++) m[x] = k; }); cache.set(i, m); }
    return partTint(cache.get(i)[w] || 0);
  };
}
function meaningsHTML(idxs) {
  if (L.trEd === 'none' || !idxs.some(i => L.items[i].tr)) return '';
  return `<details class="meanings"${S.trShow ? ' open' : ''}><summary><span class="trk-t" aria-hidden="true">${trTag()}</span>Meanings${ic('chev-d', 'chev')}</summary><ul class="mlist">${idxs.map(i => `<li><span class="mref">${L.items[i].a}</span><span class="tr-txt" lang="${trLang()}">${esc(L.items[i].tr || '\u2014')}</span></li>`).join('')}</ul></details>`;
}

/* ---------- canvas ---------- */
const TIP = {
  read: ['\u0d13\u0d30\u0d4b \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d41\u0d02 \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3f \u0d12\u0d30\u0d41 \u0d24\u0d35\u0d23 \u0d13\u0d24\u0d41\u0d15.', 'Read each ayah once, looking at it.'],
  readPage: ['\u0d2a\u0d47\u0d1c\u0d4d \u0d2e\u0d41\u0d34\u0d41\u0d35\u0d7b \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3f \u0d12\u0d30\u0d41 \u0d24\u0d35\u0d23 \u0d13\u0d24\u0d41\u0d15. \u0d28\u0d3f\u0d31\u0d19\u0d4d\u0d19\u0d7e \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d4d \u0d17\u0d4d\u0d30\u0d42\u0d2a\u0d4d\u0d2a\u0d41\u0d15\u0d33\u0d3e\u0d23\u0d4d.', 'Read the whole page once, looking at it. The colours are the ayah groups.'],
  parts: ['\u0d2d\u0d3e\u0d17\u0d02 \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3f \u0d13\u0d24\u0d41\u0d15, \u0d2a\u0d3f\u0d28\u0d4d\u0d28\u0d46 \u0d2e\u0d31\u0d1a\u0d4d\u0d1a\u0d4d \u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d2f\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d13\u0d24\u0d41\u0d15.', 'Look at the part, then hide it and recite it from memory.'],
  join: ['\u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d7e \u0d1a\u0d47\u0d7c\u0d24\u0d4d\u0d24\u0d4d \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3e\u0d24\u0d46 \u0d13\u0d24\u0d41\u0d15.', 'Join the parts and recite them without looking.'],
  full: ['\u0d2e\u0d41\u0d34\u0d41\u0d35\u0d28\u0d3e\u0d2f\u0d3f \u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d2f\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d13\u0d24\u0d41\u0d15.', 'Recite it whole, from memory.'],
  whole: ['\u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d4d \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3f \u0d13\u0d24\u0d41\u0d15, \u0d2a\u0d3f\u0d28\u0d4d\u0d28\u0d46 \u0d2e\u0d31\u0d1a\u0d4d\u0d1a\u0d4d \u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d2f\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d13\u0d24\u0d41\u0d15.', 'Look at it, then hide it and recite it from memory.'],
  chain: ['\u0d06\u0d26\u0d4d\u0d2f\u0d02 \u0d2e\u0d41\u0d24\u0d7d \u0d1a\u0d47\u0d7c\u0d24\u0d4d\u0d24\u0d4d \u0d28\u0d4b\u0d15\u0d4d\u0d15\u0d3e\u0d24\u0d46 \u0d13\u0d24\u0d41\u0d15.', 'Make them together: recite from the start without looking.'],
  final: ['\u0d0e\u0d32\u0d4d\u0d32\u0d3e\u0d02 \u0d12\u0d30\u0d41\u0d2e\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d \u0d13\u0d7c\u0d2e\u0d4d\u0d2e\u0d2f\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d13\u0d24\u0d41\u0d15, \u0d2a\u0d3f\u0d28\u0d4d\u0d28\u0d46 \u0d38\u0d4d\u0d35\u0d2f\u0d02 \u0d2a\u0d30\u0d3f\u0d36\u0d4b\u0d27\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.', 'Recite everything together from memory, then check yourself.']
};
const tipHTML = k => `<p class="st-tip">${bi(TIP[k][0], TIP[k][1])}</p>`;

function railHTML() {
  const st = stepsOf(L);
  return `<nav class="rail" aria-label="Lesson steps"><ol>${st.map((s, k) => {
    const done = stepDone(s), cur = k === L.step;
    let lbl, full;
    if (s.t === 'read') { lbl = `${ic('eye', 'ic-sm')}Read`; full = 'Read'; }
    else if (s.t === 'seg') { lbl = esc(unitLabel(s.u, true)); full = unitLabel(s.u); }
    else if (s.t === 'chain') { lbl = `${ic('merge', 'ic-sm')}${esc(togetherLabel(s.u, true))}`; full = `Make together, ${togetherLabel(s.u)}`; }
    else { lbl = `${ic('layers', 'ic-sm')}All`; full = 'All together'; }
    return `<li><button class="rs${done ? ' done' : ''}${cur ? ' cur' : ''}${s.t === 'chain' ? ' ch' : ''}" type="button" data-act="step" data-s="${k}"${cur ? ' aria-current="step"' : ''}><span class="sr">${esc(full)}${done ? ', done' : ''}</span><span aria-hidden="true">${lbl}</span>${done ? ic('check', 'rs-ok') : ''}</button></li>`;
  }).join('')}</ol></nav>`;
}
function canvasHeadHTML() {
  const pct = Math.round(lessonPercent(L) * 100);
  const t = L.kind === 'page' ? `Page ${L.page}` : surahOf(L.surah).en;
  const m = L.kind === 'page' ? pageSummary(L.page).label : rangeLabel(L.from, L.to);
  return `<header class="cv-head">
    <button class="cv-back" type="button" data-act="home" aria-label="Back to ${esc(STUDENT ? STUDENT.name + '\u2019s ' : '')}lessons">${ic('chev-l')}</button>
    <div class="cv-title"><h1>${esc(t)}${L.mode === 'revise' ? ' <span class="badge">Revision</span>' : ''}</h1><p>${esc(m)}${STUDENT ? ` \u00b7 ${esc(STUDENT.name)}` : ''}</p></div>
    <span class="cv-pct" aria-label="${pct}% done">${pct}%</span>
  </header>`;
}
function readBodyHTML() {
  if (L.kind === 'page') {
    const hasTr = L.trEd !== 'none' && L.items.some(x => x.tr);
    return `<div class="st-head"><h2 class="st-t">Read the page</h2><span class="st-c">${L.items.length} ayahs</span></div>${tipHTML('readPage')}
      ${hasMushaf() && !L.mtxErr ? (() => { const col = unitColOf(); return mushafViewHTML({ colorOf: i => `tint c${col[i] + 1}` }); })() : `<div class="mushaf-wrap">${mushafHTML()}</div>`}
      ${hasTr ? meaningsHTML(L.items.map((_, i) => i)) : ''}`;
  }
  return `<div class="st-head"><h2 class="st-t">Read</h2><span class="st-c">${L.read.length}/${L.items.length}</span></div>${tipHTML('read')}
    <div class="rows">${L.items.map((_, i) => rowHTML(i, { readMode: true, noHide: true, cur: i === L.cur })).join('')}</div>`;
}
function phaseSegHTML(f) {
  const n = f.ps.length;
  if (n < 2) return '';
  const opts = [['parts', `Parts <small>${n}</small>`]];
  if (f.js.length) opts.push(['join', 'Join']);
  opts.push(['full', 'Full']);
  return `<div class="seg ph-seg" role="radiogroup" aria-label="Practice">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${f.g.ph === v}" data-act="phase" data-v="${v}">${l}</button>`).join('')}</div>`;
}
function segBodyHTML(f) {
  const n = f.ps.length, lv = levelOf(L, f.u), ph = f.g.ph;
  const runsFor = i => f.ps.map((p, k) => ({ p, k })).filter(x => x.p.i === i).map(({ p, k }) => {
    const on = k >= f.on[0] && k <= f.on[1];
    const state = n < 2 || ph === 'full' ? 'pf' : (on ? 'on' : 'off');
    return { w0: p.w0, w1: p.w1, focus: on, cls: n < 2 ? state : `${state} ${partTint(k)}`.trim() };
  });
  return `<div class="st-head"><h2 class="st-t">${esc(unitLabel(f.u))}</h2>
      <button class="chip lvl-chip" type="button" data-act="more" data-sec="lvl" title="Part size">${ic('layers', 'ic-sm')}${LEVELS[lv].en} \u00b7 ${n} ${plural(n, 'part')}</button>
      ${phaseSegHTML(f)}</div>
    ${tipHTML(n < 2 ? 'whole' : ph)}
    <div class="rows">${f.items.map(i => rowHTML(i, { runs: runsFor(i), focusH: L.focusHide, cur: f.items.length > 1 && i === L.cur })).join('')}</div>`;
}
function chainBodyHTML(f) {
  return `<div class="st-head"><h2 class="st-t">${ic('merge')}Make together</h2><span class="st-c">${esc(togetherLabel(f.u))}</span>${viewSegHTML()}</div>${tipHTML('chain')}
    ${togetherHTML(f)}`;
}
function finalBodyHTML(f) {
  const done = lessonComplete(L), nx = done ? nextRefOf(L) : null;
  const card = done ? `<div class="done-card" role="status"><span class="dc-ic">${checkIcon()}</span><div class="dc-main"><p class="dc-t">Memorized${mlTag('\u00b7 \u0d2e\u0d28\u0d03\u0d2a\u0d3e\u0d20\u0d2e\u0d3e\u0d2f\u0d3f')}</p><p class="dc-m">${esc(refTitle(refOf(L)))}</p></div>
      <div class="dc-acts">${nx ? `<button class="btn btn-primary btn-sm" type="button" data-act="startref" ${refAttrs(nx)}>Next${ic('arrow-r')}</button>` : ''}<button class="btn btn-sm" type="button" data-act="home">Lessons</button></div></div>`
    : (L.fin.result === 'revise' ? `<div class="banner warn">${ic('repeat')}<div>Practise the ayahs that slipped, then recite all together again.${mlTag('\u00b7 \u0d24\u0d46\u0d31\u0d4d\u0d31\u0d3f\u0d2f \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d41\u0d15\u0d7e \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d2a\u0d20\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.')}</div></div>` : '');
  return `${card}<div class="st-head"><h2 class="st-t">${ic('layers')}All together</h2><span class="st-c">${L.items.length} ${plural(L.items.length, 'ayah')}</span>${viewSegHTML()}</div>${tipHTML('final')}
    ${togetherHTML(f)}`;
}
function togetherHTML(f) {
  if (useMushaf()) return mushafViewHTML({ focus: new Set(f.items), colorOf: partColorFn() }) + meaningsHTML(f.items);
  return `<div class="rows">${f.items.map(i => rowHTML(i, { runs: itemRuns(i, true), focusH: L.focusHide, cur: i === L.cur })).join('')}</div>`;
}
function canvasHTML(f) {
  const st = f.st;
  let body;
  if (st.t === 'read') body = readBodyHTML();
  else if (st.t === 'seg') body = segBodyHTML(f);
  else if (st.t === 'chain') body = chainBodyHTML(f);
  else body = finalBodyHTML(f);
  const trNote = L.trLoading ? `<p class="hint tr-note">${ic('refresh', 'ic-sm')}Loading the translation\u2026</p>`
    : (L.trErr ? `<p class="hint tr-note">${ic('info', 'ic-sm')}The translation is not loaded. <button class="linkbtn" type="button" data-act="retrytr">Retry</button></p>` : '');
  const pinNote = L.pinMode ? `<div class="banner info pin-note">${ic('link')}<div>Tap <b>between two words</b> to link them. Tap again to remove.${mlTag('\u00b7 \u0d30\u0d23\u0d4d\u0d1f\u0d4d \u0d35\u0d3e\u0d15\u0d4d\u0d15\u0d41\u0d15\u0d7e\u0d15\u0d4d\u0d15\u0d3f\u0d1f\u0d2f\u0d3f\u0d7d \u0d24\u0d4a\u0d1f\u0d41\u0d15.')}</div><button class="btn btn-sm btn-soft b-act" type="button" data-act="linkmode">Done</button></div>` : '';
  return `<section class="cv${L.pinMode ? ' linking' : ''}" aria-label="Lesson text">${canvasHeadHTML()}${railHTML()}<div class="cv-body">${pinNote}${body}${trNote}</div></section>`;
}

/* ---------- panel ---------- */
function panelLabel(f) {
  const st = f.st;
  if (st.t === 'read') return L.kind === 'page' ? { b: 'Read', s: `Page ${L.page}` } : { b: 'Read', s: `${itemLabel(L.cur)} \u00b7 ${L.read.length}/${L.items.length}` };
  if (st.t === 'seg') {
    const g = f.g, n = f.ps.length;
    if (n >= 2 && g.ph === 'parts') return { b: `Part ${g.k + 1} of ${n}`, s: unitLabel(f.u) };
    if (n >= 2 && g.ph === 'join') return { b: `Parts ${f.on[0] + 1}\u2013${f.on[1] + 1}`, s: `${unitLabel(f.u)} \u00b7 join` };
    return { b: `Whole ${unitNoun(f.u)}`, s: unitLabel(f.u) };
  }
  if (st.t === 'chain') return { b: 'Make together', s: togetherLabel(f.u) };
  return { b: 'All together', s: L.kind === 'page' ? `Page ${L.page}` : rangeLabel(L.from, L.to) };
}
function goLabel(f) {
  const st = f.st, steps = stepsOf(L), nx = steps[L.step + 1];
  const after = () => {
    if (!nx) return ['Finish', 'check'];
    if (nx.t === 'chain') return ['Make together', 'merge'];
    if (nx.t === 'seg') return [`Next ${unitNoun(nx.u)}`, 'arrow-r'];
    return ['All together', 'layers'];
  };
  if (st.t === 'seg') {
    const g = f.g, n = f.ps.length;
    if (n >= 2 && g.ph === 'parts') return g.k < n - 1 ? ['Next part', 'arrow-r'] : (f.js.length ? ['Join parts', 'arrow-r'] : [`Whole ${unitNoun(f.u)}`, 'arrow-r']);
    if (n >= 2 && g.ph === 'join') return g.cs < f.js.length - 1 ? ['Next join', 'arrow-r'] : [`Whole ${unitNoun(f.u)}`, 'arrow-r'];
    return after();
  }
  return after();
}
function counterHTML(c) {
  const C = 2 * Math.PI * 26, fr = Math.min(1, c.c / c.t), done = c.c >= c.t;
  return `<button class="pn-count${done ? ' done' : ''}" type="button" data-act="count">
    <svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" class="rg-b"/><circle cx="30" cy="30" r="26" class="rg-f" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - fr)).toFixed(1)}" transform="rotate(-90 30 30)"/></svg>
    <span class="c-n">${c.c}</span> <span class="c-t">of ${c.t}</span><span class="sr">, count one repetition</span></button>`;
}
function hideBtnHTML(f) {
  const h = L.focusHide, nx = nextHide(h, focusHasPins(f)), T = HIDE_TXT[h];
  return `<button class="pn-hide h${h}" type="button" data-act="hide" aria-label="Hide. Now: ${T.note}. Next: ${HIDE_TXT[nx].note}.">${ic(h ? T.icon : 'eye-off')}<span class="ph-l">${h ? T.en : 'Hide'}</span><span class="hd" aria-hidden="true"><i></i><i></i><i></i></span></button>`;
}
function panelHTML(f) {
  const st = f.st, lb = panelLabel(f), cnt = counterOf(f);
  const atStart = L.step === 0 && (L.kind === 'page' || L.cur === 0);
  let main;
  if (st.t === 'read') {
    const all = L.read.length >= L.items.length;
    const go = L.kind === 'page' ? ['Done reading', 'check'] : (all ? ['Start memorizing', 'arrow-r'] : ['Read', 'check']);
    main = `<div class="pn-prog" aria-hidden="true"><span class="pp-n">${L.read.length}<small>/${L.items.length}</small></span><span class="pp-l">read</span></div>
      <button class="pn-go${all || L.kind === 'page' ? ' ready' : ''}" type="button" data-act="next">${go[0]}${ic(go[1])}</button>`;
  } else if (st.t === 'final' && !lessonComplete(L)) {
    main = `${hideBtnHTML(f)}${counterHTML(cnt)}<div class="pn-assess"><button class="pn-go${cnt.c >= cnt.t ? ' ready' : ''}" type="button" data-act="assess" data-r="mastered">${ic('check')}Memorized</button><button class="pn-alt" type="button" data-act="assess" data-r="revise">${ic('repeat')}Practise more</button></div>`;
  } else if (st.t === 'final') {
    const nx = nextRefOf(L);
    main = `${hideBtnHTML(f)}${counterHTML(cnt)}${nx ? `<button class="pn-go ready" type="button" data-act="startref" ${refAttrs(nx)}>Next lesson${ic('arrow-r')}</button>` : `<button class="pn-go ready" type="button" data-act="home">Lessons${ic('arrow-r')}</button>`}`;
  } else {
    const gl = goLabel(f);
    main = `${hideBtnHTML(f)}${counterHTML(cnt)}<button class="pn-go${cnt.c >= cnt.t ? ' ready' : ''}" type="button" data-act="next">${gl[0]}${ic(gl[1])}</button>`;
  }
  const hasTr = L.trEd !== 'none' && L.items.some(x => x.tr);
  const tool = (act, icon, label, extra) => `<button class="pt" type="button" data-act="${act}"${extra || ''}>${icon}<span>${label}</span></button>`;
  if (S.dockMini) return miniPanelHTML(f, cnt, atStart);
  return `<aside class="pn" aria-label="Practice controls">
    <div class="pn-top">
      <button class="pn-nav" type="button" data-act="prev"${atStart ? ' disabled' : ''} aria-label="Back one step">${ic('chev-l')}</button>
      <div class="pn-lbl"><b>${esc(lb.b)}</b><span>${esc(lb.s)}</span></div>
      <button class="pn-min" type="button" data-act="dock" aria-label="Make the controls small">${ic('chev-d')}</button>
    </div>
    <div class="pn-main${st.t === 'read' ? ' rd' : ''}">${main}</div>
    <div class="pn-tools">
      ${cnt ? tool('undo', ic('undo'), 'Undo', cnt.c ? '' : ' disabled') : ''}
      ${tool('linkmode', ic('link'), 'Link', ` aria-pressed="${L.pinMode}" title="Drag between two words \u2014 or tap, then tap between two words"`).replace('class="pt"', 'class="pt pt-drag"')}
      ${hasTr ? tool('trall', `<span class="trk-t" aria-hidden="true">${trTag()}</span>`, 'Meaning', ` aria-pressed="${S.trShow}"`) : ''}
      ${Player.list.length ? tool('audio', ic('x'), 'Stop', ' aria-pressed="true"') : tool('audio', ic('volume'), 'Listen', ' aria-pressed="false"')}
      ${tool('more', ic('more'), 'More')}
    </div>
  </aside>`;
}

// the small panel: only counter, hide and next (about a tenth of the space)
function miniPanelHTML(f, cnt, atStart) {
  const st = f.st;
  let mid = '', go;
  if (st.t === 'read') {
    mid = `<span class="mini-l">${L.read.length}/${L.items.length} read</span>`;
    const all = L.read.length >= L.items.length;
    go = `<button class="mini-go${all || L.kind === 'page' ? ' ready' : ''}" type="button" data-act="next">${L.kind === 'page' ? 'Done' : (all ? 'Start' : 'Read')}${ic(all ? 'arrow-r' : 'check')}</button>`;
  } else {
    const h = L.focusHide, T = HIDE_TXT[h], C = 2 * Math.PI * 17, fr = Math.min(1, cnt.c / cnt.t);
    mid = `<button class="mini-hide h${h}" type="button" data-act="hide" aria-label="Hide. Now: ${T.note}.">${ic(h ? T.icon : 'eye-off')}</button>
      <button class="mini-count${cnt.c >= cnt.t ? ' done' : ''}" type="button" data-act="count"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" class="rg-b"/><circle cx="20" cy="20" r="17" class="rg-f" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - fr)).toFixed(1)}" transform="rotate(-90 20 20)"/></svg><span class="c-n">${cnt.c}</span><span class="sr"> of ${cnt.t}, count one repetition</span></button>`;
    go = st.t === 'final'
      ? (lessonComplete(L) ? `<button class="mini-go ready" type="button" data-act="home">Lessons${ic('arrow-r')}</button>` : `<button class="mini-go" type="button" data-act="dock">Check${ic('chev-d', 'up')}</button>`)
      : `<button class="mini-go${cnt.c >= cnt.t ? ' ready' : ''}" type="button" data-act="next" aria-label="${esc(goLabel(f)[0])}">${ic('arrow-r')}</button>`;
  }
  return `<aside class="pn mini" aria-label="Practice controls">
    <button class="pn-min" type="button" data-act="dock" aria-label="Show all controls">${ic('chev-d', 'up')}</button>
    <button class="pn-nav" type="button" data-act="prev"${atStart ? ' disabled' : ''} aria-label="Back one step">${ic('chev-l')}</button>
    ${mid}${go}
  </aside>`;
}

/* ---------- drawing ---------- */
function focusKey() {
  const a = document.activeElement;
  if (!a || !a.dataset || !a.dataset.act || !$('#lessonView').contains(a)) return null;
  let sel = `[data-act="${a.dataset.act}"]`;
  ['i', 'k', 's', 'v', 'r'].forEach(k => { if (a.dataset[k] != null) sel += `[data-${k}="${CSS.escape(a.dataset[k])}"]`; });
  return sel;
}
let lastFocusSig = '';
function renderLesson(opts) {
  if (!L || L.status !== 'ready') return;
  syncUnits();
  document.title = `${refTitle(refOf(L))} \u2014 ${baseTitle()}`;
  const fk = focusKey(), f = focusOf();
  $('#lessonView').innerHTML = `<div class="lx">${canvasHTML(f)}${panelHTML(f)}</div>`;
  if (fk) { const el = $('#lessonView ' + fk) || (fk.includes('"next"') || fk.includes('"assess"') ? $('#lessonView .pn-go') : null); if (el && !el.disabled) { try { el.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
  // the phone dock covers the bottom of the screen: keep that much space under the text
  const pn = $('#lessonView .pn');
  if (pn && getComputedStyle(pn).position === 'fixed') document.documentElement.style.setProperty('--dock-h', Math.ceil(pn.getBoundingClientRect().height) + 'px');
  fitMushaf();
  markPlaying();
  const rail = $('#lessonView .rail'), cur = rail && rail.querySelector('.rs.cur');
  if (cur) rail.scrollLeft = Math.max(0, cur.offsetLeft - rail.clientWidth / 2 + cur.offsetWidth / 2);
  // keep the part being learned in view when it changes
  const sig = `${L.step}|${f.g ? f.g.ph + f.on.join('-') : ''}|${L.cur}`;
  if (sig !== lastFocusSig) {
    const first = !lastFocusSig || (opts && opts.top);
    lastFocusSig = sig;
    if (first) window.scrollTo({ top: 0, behavior: 'auto' });
    else if (S.autoScroll) ensureVisible($('#lessonView .pc.on') || $('#lessonView .ay.cur') || $('#lessonView .st-head'));
  }
}
// Each mushaf line is one row, justified like the printed page. The font is made just small enough
// that the longest line of the page fits the width \u2014 lines are never re-wrapped.
function fitMushaf() {
  $$('#lessonView .mp-l').forEach(el => {
    el.style.fontSize = '';
    const base = parseFloat(getComputedStyle(el).fontSize), avail = el.clientWidth;
    if (!avail) return;
    el.classList.add('measure');
    const widest = Math.max(1, ...$$('.ml:not(.mh)', el).map(x => x.scrollWidth));
    el.classList.remove('measure');
    el.style.fontSize = (base * Math.min(1, avail * 0.975 / widest)).toFixed(2) + 'px';
  });
}
function ensureVisible(el) {
  if (!el) return;
  const r = el.getBoundingClientRect(), dock = $('#lessonView .pn');
  const docked = dock && getComputedStyle(dock).position === 'fixed';
  const top = 12, bottom = window.innerHeight - (docked ? dock.getBoundingClientRect().height : 0) - 12;
  if (r.top >= top && r.bottom <= bottom) return;
  const target = r.height > bottom - top ? r.top - top : r.top - (top + (bottom - top - r.height) / 2);
  window.scrollBy({ top: target, behavior: scrollBehavior() });
}

/* ---------------------------------------------------------------------
   15. Actions
   --------------------------------------------------------------------- */
function goStep(k, auto) {
  const st = stepsOf(L);
  L.step = Math.min(st.length - 1, Math.max(0, k));
  L.focusHide = 0; L.pinMode = false;
  const s = st[L.step];
  if (s.t === 'read') { const nx = L.items.findIndex((_, i) => !L.read.includes(i)); L.cur = nx >= 0 ? nx : 0; }
  else if (s.t === 'seg') { L.cur = unitsOf(L).parts[s.u][0]; segState(s.u); }
  renderLesson({ top: !auto });
  if (auto) window.scrollTo({ top: 0, behavior: scrollBehavior() });
  persist();
}
function goNext() {
  const f = focusOf(), st = f.st;
  if (st.t === 'read') {
    if (L.kind === 'page') { L.read = L.items.map((_, i) => i); goStep(1, true); return; }
    if (L.read.length >= L.items.length) { goStep(1, true); return; }
    if (!L.read.includes(L.cur)) L.read.push(L.cur);
    const n = L.items.length;
    for (let d = 1; d <= n; d++) { const j = (L.cur + d) % n; if (!L.read.includes(j)) { L.cur = j; break; } }
    renderLesson(); persist();
    if (L.read.length >= n) announce('All ayahs read. Start memorizing.');
    return;
  }
  L.focusHide = 0;
  if (st.t === 'seg') {
    const g = f.g, n = f.ps.length;
    if (n >= 2 && g.ph === 'parts') { if (g.k < n - 1) g.k++; else { g.ph = f.js.length ? 'join' : 'full'; g.cs = 0; } }
    else if (n >= 2 && g.ph === 'join') { if (g.cs < f.js.length - 1) g.cs++; else g.ph = 'full'; }
    else {
      g.done = true;
      const nx = stepsOf(L)[L.step + 1];
      toast(`${unitLabel(f.u)} memorized.`, nx && nx.t === 'chain' ? '\u0d07\u0d28\u0d3f \u0d12\u0d30\u0d41\u0d2e\u0d3f\u0d1a\u0d4d\u0d1a\u0d4d \u0d1a\u0d47\u0d7c\u0d24\u0d4d\u0d24\u0d4d \u0d13\u0d24\u0d41\u0d15.' : '', 'check');
      goStep(L.step + 1, true); return;
    }
    renderLesson(); persist(); return;
  }
  goStep(L.step + 1, true);
}
function goPrev() {
  const f = focusOf(), st = f.st;
  L.focusHide = 0;
  if (st.t === 'read') { if (L.kind !== 'page' && L.cur > 0) { L.cur--; renderLesson(); persist(); } else if (L.step > 0) goStep(L.step - 1); return; }
  if (st.t === 'seg') {
    const g = f.g, n = f.ps.length;
    if (n >= 2 && g.ph === 'parts' && g.k > 0) g.k--;
    else if (n >= 2 && g.ph === 'join') { if (g.cs > 0) g.cs--; else { g.ph = 'parts'; g.k = n - 1; } }
    else if (n >= 2 && g.ph === 'full') { if (f.js.length) { g.ph = 'join'; g.cs = f.js.length - 1; } else { g.ph = 'parts'; g.k = n - 1; } }
    else { goStep(L.step - 1); return; }
    renderLesson(); persist(); return;
  }
  goStep(L.step - 1);
}
function count(d) {
  const f = focusOf(), st = f.st, c = counterOf(f);
  if (!c) return;
  const v = d === 0 ? 0 : Math.max(0, Math.min(999, c.c + d));
  if (st.t === 'seg') { const g = f.g; if (g.ph === 'parts' && f.ps.length >= 2) g.pc[g.k] = v; else if (g.ph === 'join' && f.ps.length >= 2) g.cc[g.cs] = v; else g.fc = v; }
  else if (st.t === 'chain') L.chain[st.u] = v;
  else if (st.t === 'final') L.fin.c = v;
  const reached = d > 0 && v === c.t;
  if (d > 0 && S.vibrate && navigator.vibrate) { try { navigator.vibrate(reached ? [18, 50, 18] : 12); } catch (e) { /* ignore */ } }
  renderLesson(); persist();
  if (reached) {
    announce(`${v} of ${c.t}. Target reached.`);
    const b = $('#lessonView .pn-count'); if (b && !reduceMotion()) { b.classList.add('pop'); }
  } else if (d !== 0) announce(`${v} of ${c.t}`);
}
function cycleHide() {
  const f = focusOf();
  L.focusHide = nextHide(L.focusHide, focusHasPins(f));
  renderLesson();
  announce(HIDE_TXT[L.focusHide].note);
}
function cycleRowHide(i) {
  L.rowHide[i] = nextHide(L.rowHide[i] || 0, itemsHavePins([i]));
  if (!L.rowHide[i]) delete L.rowHide[i];
  L.cur = i;
  renderLesson();
  announce(`${itemLabel(i)}: ${HIDE_TXT[L.rowHide[i] || 0].note}`);
}
function togglePin(k) {
  L.pins = L.pins.includes(k) ? L.pins.filter(x => x !== k) : L.pins.concat(k);
  renderLesson(); persist();
  announce(L.pins.includes(k) ? 'Linked' : 'Link removed');
}
function toggleRowTr(i) {
  L.trFlip = L.trFlip.includes(i) ? L.trFlip.filter(x => x !== i) : L.trFlip.concat(i);
  renderLesson(); persist();
}
function assess(r) {
  if (r === 'mastered') {
    L.fin.result = 'mastered'; L.focusHide = 0;
    saveNow(); renderLesson();
    toast('Lesson memorized. Revise it again tomorrow.', '\u0d28\u0d3e\u0d33\u0d46 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d06\u0d35\u0d7c\u0d24\u0d4d\u0d24\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.', 'check');
  } else {
    L.fin.result = 'revise'; L.fin.c = 0;
    renderLesson(); persist();
    toast('Practise the ayahs that slipped, then try again.', '\u0d24\u0d46\u0d31\u0d4d\u0d31\u0d3f\u0d2f \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d41\u0d15\u0d7e \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d2a\u0d20\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d15.', 'repeat');
  }
}
// Listen: the ayahs being learned, one after another (a part cannot be played alone \u2014 the files are per ayah)
function audioList() {
  const f = focusOf(), st = f.st;
  let idxs;
  if (st.t === 'seg') idxs = Array.from(new Set(f.ps.slice(f.on[0], f.on[1] + 1).map(p => p.i)));
  else if (st.t === 'read') idxs = L.kind === 'page' ? L.items.map((_, i) => i) : range(L.cur, L.items.length - 1);
  else idxs = f.items;
  return idxs.map(i => ({ s: L.items[i].s, a: L.items[i].a, i, lesson: L }));
}
function playAudio() {
  if (Player.list.length) { Player.stop(); return; }
  Player.start(audioList());
}
// show which ayah is being recited, and the Listen button's state
function markPlaying() {
  $$('#lessonView .playing').forEach(e => e.classList.remove('playing'));
  const x = Player.current, on = Player.list.length > 0;
  if (x && L && x.lesson === L) $$(`#lessonView .ay[data-i="${x.i}"], #lessonView .w[data-w^="${x.i}:"]`).forEach(e => e.classList.add('playing'));
  const b = $('#lessonView .pt[data-act="audio"]');
  if (b) { b.setAttribute('aria-pressed', String(on)); b.innerHTML = `${ic(on ? 'x' : 'volume')}<span>${on ? 'Stop' : 'Listen'}</span>`; }
}
function shareAudioURL() {
  const segs = segmentsOf(refOf(L));
  if (segs.length !== 1) return null;
  const r = Math.max(0, RECITERS.findIndex(x => x.edition === S.reciter));
  return `${location.origin}/share.html?s=${segs[0].s}&f=${segs[0].f}&t=${segs[0].t}&r=${r}`;
}
async function restartLesson() {
  const ok = await confirmBox({ title: 'Start this lesson again?', body: 'Reading, part counts and \u201ctogether\u201d counts start again. Your links and notes are kept.',
    ml: '\u0d08 \u0d2a\u0d3e\u0d20\u0d02 \u0d06\u0d26\u0d4d\u0d2f\u0d02 \u0d2e\u0d41\u0d24\u0d7d \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d41\u0d02. \u0d32\u0d3f\u0d19\u0d4d\u0d15\u0d41\u0d15\u0d33\u0d41\u0d02 \u0d15\u0d41\u0d31\u0d3f\u0d2a\u0d4d\u0d2a\u0d41\u0d15\u0d33\u0d41\u0d02 \u0d28\u0d3f\u0d32\u0d28\u0d3f\u0d7d\u0d15\u0d4d\u0d15\u0d41\u0d02.', ok: 'Start again' });
  if (!ok) return;
  closeDialog($('#dlgTool'));
  Object.assign(L, { read: [], seg: [], chain: {}, fin: { c: 0, result: null }, step: 0, cur: 0, focusHide: 0, rowHide: {}, mode: 'learn' });
  renderLesson({ top: true }); saveNow();
}
const copyLink = () => copyText(location.href.split('#')[0] + lessonHash(refOf(L)), 'Lesson link copied.');
async function copyText(url, done) {
  let ok = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); ok = true; } } catch (e) { /* fall back */ }
  if (!ok) {
    const ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
  }
  toast(ok ? done : 'Could not copy the link.', '', ok ? 'check' : 'info');
}

/* ---------- lesson tools sheet (More) ---------- */
function partCount(idxs, lv) { const ws = wordsOf(L); return idxs.reduce((n, i) => n + levelParts(ws[i], lv, S.pauseBreak).length, 0); }
function toolsHTML() {
  const f = focusOf(), st = f.st, inUnit = st.t === 'seg';
  const all = L.items.map((_, i) => i), lvL = L.level || S.level;
  const lvSeg = (scope, cur, idxs, label) => `<div class="seg lvl-seg" role="radiogroup" aria-label="${esc(label)}">${Object.keys(LEVELS).map(k => `<button type="button" role="radio" aria-checked="${cur === k}" data-act="lvl" data-scope="${scope}" data-v="${k}">${LEVELS[k].en}<small>${partCount(idxs, k)}</small></button>`).join('')}</div>`;
  const g = groupOf(L), gOpts = L.kind === 'page' ? [3, 4, 5] : [1, 2, 3, 4, 5];
  const { parts, cols } = unitsOf(L);
  const ci = Math.min(L.cur, L.items.length - 1);
  const grpEditor = g === 'manual' ? `<div class="g-edit"><p class="hint">Tap an ayah to start a new group there.</p><div class="g-chips">${L.items.map((it, i) => {
      const u = parts.findIndex(p => p.includes(i)), first = parts[u][0] === i;
      return `<button type="button" class="gchip c${(cols[u] % 8) + 1}${first ? ' first' : ''}" data-act="gbreak" data-i="${i}"${i === 0 ? ' disabled' : ''} aria-pressed="${first}" aria-label="${esc(itemLabel(i))}${first ? ', starts a group' : ''}">${it.a}</button>`; }).join('')}</div></div>` : '';
  return `
    <section class="tl-sec" id="tlLvl"><h3>${ic('layers', 'ic-sm')}Part size${mlTag('\u00b7 \u0d2d\u0d3e\u0d17\u0d24\u0d4d\u0d24\u0d3f\u0d28\u0d4d\u0d31\u0d46 \u0d35\u0d32\u0d41\u0d2a\u0d4d\u0d2a\u0d02')}</h3>
      <p class="hint">Min \u2248 2\u20133 words \u00b7 Medium \u2248 3\u20134 \u00b7 Max \u2248 5\u20136. Short ayahs stay whole. The small number is how many parts.</p>
      ${inUnit ? `<div class="tl-row"><span class="tl-k">${esc(unitLabel(f.u))}</span>${lvSeg('unit', levelOf(L, f.u), f.items, 'Part size for ' + unitLabel(f.u))}</div>` : ''}
      <div class="tl-row"><span class="tl-k">Whole lesson</span>${lvSeg('lesson', lvL, all, 'Part size for the whole lesson')}</div>
    </section>
    <section class="tl-sec"><label class="switch"><input type="checkbox" data-set="partColors"${S.partColors ? ' checked' : ''}><span class="track"></span><span class="sw-txt">Colour each part<small>Every part keeps its own colour, so it stays apart in memory.</small></span></label></section>
    <section class="tl-sec"><h3>${ic('book', 'ic-sm')}Ayah groups${mlTag('\u00b7 \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d4d \u0d17\u0d4d\u0d30\u0d42\u0d2a\u0d4d\u0d2a\u0d41\u0d15\u0d7e')}</h3>
      <p class="hint">${L.kind === 'page' ? 'The page is learned in groups of ayahs.' : 'Learn one ayah at a time, or a few ayahs together as one group.'}</p>
      <div class="seg" role="radiogroup" aria-label="Ayahs per group">${gOpts.map(v => `<button type="button" role="radio" aria-checked="${g === v}" data-act="grp" data-v="${v}">${v}</button>`).join('')}<button type="button" role="radio" aria-checked="${g === 'manual'}" data-act="grp" data-v="manual">By hand</button></div>
      ${grpEditor}
    </section>
    ${linksSecHTML()}
    <section class="tl-sec"><h3>${ic('volume', 'ic-sm')}Recitation${mlTag('\u00b7 \u0d2a\u0d3e\u0d30\u0d3e\u0d2f\u0d23\u0d02')}</h3>
      <p class="hint">${esc((RECITERS.find(r => r.edition === S.reciter) || RECITERS[0]).name)} \u00b7 the same audio as the academy\u2019s share player. Each ayah plays whole.</p>
      <div class="tl-row"><span class="tl-k">Repeat each ayah</span><div class="seg" role="radiogroup" aria-label="Repeat each ayah">${[1, 3, 5, 10].map(v => `<button type="button" role="radio" aria-checked="${S.audioRep === v}" data-set="audioRep" data-val="${v}">${v}\u00d7</button>`).join('')}</div></div>
      ${shareAudioURL() ? `<button class="btn btn-sm" type="button" data-act="shareaudio">${ic('link')}Copy audio share link</button>` : ''}
    </section>
    <section class="tl-sec"><h3>${ic('pen', 'ic-sm')}Note \u00b7 ${esc(itemLabel(ci))}</h3>
      <label class="sr" for="noteBox">Your note for ${esc(itemLabel(ci))}</label>
      <textarea class="inp note-box" id="noteBox" rows="2" maxlength="600" data-note="${ci}" placeholder="A short reminder for yourself (not a translation)">${esc(L.notes[ci] || '')}</textarea>
    </section>
    <section class="tl-sec tl-acts">
      ${counterOf(f) ? `<button class="btn btn-sm" type="button" data-act="resetcount">${ic('undo')}Reset this count</button>` : ''}
      <button class="btn btn-sm" type="button" data-act="copylink">${ic('link')}Copy lesson link</button>
      <button class="btn btn-sm" type="button" data-act="settings">${ic('sliders')}Settings</button>
      <button class="btn btn-sm danger" type="button" data-act="restart">${ic('refresh')}Start lesson again</button>
    </section>`;
}
function linksSecHTML() {
  const links = L.pins.map(k => { const [i, w] = k.split(':').map(Number), ws = wordsOf(L)[i]; return ws && ws[w + 1] ? { k, i, a: ws[w].t, b: ws[w + 1].t } : null; }).filter(Boolean);
  return `<section class="tl-sec"><h3>${ic('link', 'ic-sm')}Links${links.length ? ` \u00b7 ${links.length}` : ''}${mlTag('\u00b7 \u0d32\u0d3f\u0d19\u0d4d\u0d15\u0d41\u0d15\u0d7e')}</h3>
    <p class="hint">Where two words don\u2019t connect in memory: <b>hold</b> between them, or drag the Link icon from the panel. In the Links hide step only their joining edges stay.</p>
    ${links.length ? `<ul class="lk-list">${links.map(x => `<li><span class="lk-ref">${esc(itemLabel(x.i))}</span><span class="lk-w" lang="ar" dir="rtl">${esc(x.a)}<span class="lk-arc" aria-hidden="true"></span>${esc(x.b)}</span><button class="ib" type="button" data-act="unlink" data-k="${x.k}"><span class="sr">Remove the link in ${esc(itemLabel(x.i))}</span>${ic('x')}</button></li>`).join('')}</ul>` : ''}
  </section>`;
}
function openTools(sec) {
  $('#toolBody').innerHTML = toolsHTML();
  const d = $('#dlgTool');
  openDialog(d);
  if (sec === 'lvl') setTimeout(() => { const b = $('#toolBody [data-act="lvl"][aria-checked="true"]'); if (b) b.focus(); }, 40);
}
function refreshTools() {
  if (!$('#dlgTool').open) return;
  const fk = (() => { const a = document.activeElement; if (!a || !a.dataset || !$('#toolBody').contains(a)) return null; let s = `[data-act="${a.dataset.act}"]`; ['scope', 'v', 'i'].forEach(k => { if (a.dataset[k] != null) s += `[data-${k}="${a.dataset[k]}"]`; }); return s; })();
  const st = $('#toolBody').scrollTop;
  $('#toolBody').innerHTML = toolsHTML();
  $('#toolBody').scrollTop = st;
  if (fk) { const el = $('#toolBody ' + fk); if (el && !el.disabled) el.focus({ preventScroll: true }); }
}
async function setLevel(scope, v) {
  if (!LEVELS[v]) return;
  const f = focusOf();
  if (scope === 'unit' && f.st.t === 'seg') {
    if (levelOf(L, f.u) === v) return;
    const g = L.seg[f.u];
    if (g && !g.done && (g.pc.some(Boolean) || g.cc.some(Boolean) || g.fc)) {
      const ok = await confirmBox({ title: 'Change the part size?', body: `${unitLabel(f.u)} will be divided again. Its part counts start again.`, ml: '\u0d2d\u0d3e\u0d17\u0d19\u0d4d\u0d19\u0d7e \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d35\u0d3f\u0d2d\u0d1c\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d02. \u0d0e\u0d23\u0d4d\u0d23\u0d02 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d41\u0d02.', ok: 'Change' });
      if (!ok) return;
    }
    const first = unitsOf(L).parts[f.u][0];
    if (v === (L.level || S.level)) delete L.segLevel[first]; else L.segLevel[first] = v;
  } else {
    if ((L.level || S.level) === v && !Object.keys(L.segLevel).length) return;
    const busy = L.seg.some(g => g && !g.done && (g.pc.some(Boolean) || g.cc.some(Boolean) || g.fc));
    if (busy) {
      const ok = await confirmBox({ title: 'Change the part size for every ayah?', body: 'Ayahs you are still learning are divided again and their part counts start again. Memorized ayahs stay memorized.', ml: '\u0d0e\u0d32\u0d4d\u0d32\u0d3e \u0d06\u0d2f\u0d24\u0d4d\u0d24\u0d41\u0d15\u0d33\u0d41\u0d02 \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d35\u0d3f\u0d2d\u0d1c\u0d3f\u0d15\u0d4d\u0d15\u0d41\u0d02. \u0d2e\u0d28\u0d03\u0d2a\u0d3e\u0d20\u0d2e\u0d3e\u0d2f\u0d35 \u0d05\u0d24\u0d47\u0d2a\u0d1f\u0d3f \u0d28\u0d3f\u0d32\u0d28\u0d3f\u0d7d\u0d15\u0d4d\u0d15\u0d41\u0d02.', ok: 'Change' });
      if (!ok) return;
    }
    L.level = v; L.segLevel = {};
    S.level = v; saveSettings();
  }
  renderLesson(); refreshTools(); persist();
  toast(`Part size: ${LEVELS[v].en}`, '', 'layers');
}
async function setGroup(v) {
  const nv = v === 'manual' ? 'manual' : clampInt(v, 1, 5, 1);
  if (groupOf(L) === nv) return;
  const before = partitionKey(unitsOf(L).parts);
  const prev = { group: L.group, colors: L.colors };
  L.group = nv;
  if (nv === 'manual') { const { parts } = unitsOf(Object.assign({}, L, { group: prev.group })); L.colors = []; parts.forEach((p, u) => p.forEach(() => L.colors.push(u % 8))); }
  if (partitionKey(unitsOf(L).parts) !== before && hasProgress(L)) {
    const ok = await confirmBox({ title: 'Change the ayah groups?', body: 'The steps of this lesson change, so its progress starts again from reading. Pins and notes are kept.', ml: '\u0d17\u0d4d\u0d30\u0d42\u0d2a\u0d4d\u0d2a\u0d41\u0d15\u0d7e \u0d2e\u0d3e\u0d31\u0d41\u0d2e\u0d4d\u0d2a\u0d4b\u0d7e \u0d2a\u0d41\u0d30\u0d4b\u0d17\u0d24\u0d3f \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d41\u0d02.', ok: 'Change groups' });
    if (!ok) { L.group = prev.group; L.colors = prev.colors; refreshTools(); return; }
    Object.assign(L, { read: [], step: 0, cur: 0 });
  }
  syncUnits(); renderLesson({ top: true }); refreshTools(); persist();
}
async function toggleBreak(i) {
  if (groupOf(L) !== 'manual' || i <= 0 || i >= L.items.length) return;
  const breaks = L.colors.map((c, k) => k > 0 && c !== L.colors[k - 1]);
  breaks[i] = !breaks[i];
  const next = []; let c = 0;
  L.items.forEach((_, k) => { if (k && breaks[k]) c = (c + 1) % 8; next.push(c); });
  if (hasProgress(L)) {
    const ok = await confirmBox({ title: 'Change the ayah groups?', body: 'The steps of this lesson change, so its progress starts again from reading. Pins and notes are kept.', ml: '\u0d17\u0d4d\u0d30\u0d42\u0d2a\u0d4d\u0d2a\u0d41\u0d15\u0d7e \u0d2e\u0d3e\u0d31\u0d41\u0d2e\u0d4d\u0d2a\u0d4b\u0d7e \u0d2a\u0d41\u0d30\u0d4b\u0d17\u0d24\u0d3f \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d41\u0d02.', ok: 'Change groups' });
    if (!ok) return;
    Object.assign(L, { read: [], step: 0, cur: 0 });
  }
  L.colors = next;
  syncUnits(); renderLesson({ top: true }); refreshTools(); persist();
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
  const seg = (key, opts, label) => `<div class="seg" role="radiogroup" aria-label="${label}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${String(S[key]) === String(v)}" data-set="${key}" data-val="${v}">${l}</button>`).join('')}</div>`;
  const num = (key, min, max, label) => `<div class="stepper sm"><button type="button" data-act="snum" data-key="${key}" data-d="-1" aria-label="Decrease ${label}">\u2212</button><input type="number" inputmode="numeric" min="${min}" max="${max}" value="${S[key]}" data-set="${key}" data-min="${min}" data-max="${max}" aria-label="${label}"><button type="button" data-act="snum" data-key="${key}" data-d="1" aria-label="Increase ${label}">+</button></div>`;
  const sw = (key, label, small) => `<label class="switch"><input type="checkbox" data-set="${key}"${S[key] ? ' checked' : ''}><span class="track"></span><span class="sw-txt">${label}${small ? `<small>${small}</small>` : ''}</span></label>`;
  const radio = (key, v, label, small) => `<label class="radio"><input type="radio" name="r-${key}" data-set="${key}" value="${v}"${S[key] === v ? ' checked' : ''}><span class="dot"></span><span class="r-txt"><span>${label}</span>${small ? `<small>${small}</small>` : ''}</span></label>`;
  const rep = (key, min, max, label, dflt) => `<div class="set-line"><span class="lbl">${label}<small>default ${dflt}</small></span>${num(key, min, max, label)}</div>`;
  $('#settingsBody').innerHTML = `
    <p class="set-who">${ic('info', 'ic-sm')}<span>Settings for <b>${esc(STUDENT ? STUDENT.name : 'this student')}</b> only.</span></p>
    <details class="set-sec" open><summary><h3>Language${mlTag('\u00b7 \u0d2d\u0d3e\u0d37')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in"><div class="radio-list">
      ${radio('uiLang', 'ml', '<span lang="ml" class="keep-ml">\u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02</span> + English', 'Malayalam, with English help.')}
      ${radio('uiLang', 'en', 'English only', 'Simple English. Malayalam is hidden.')}
    </div></div></details>
    <details class="set-sec" open><summary><h3>Memorizing${mlTag('\u00b7 \u0d2e\u0d28\u0d03\u0d2a\u0d3e\u0d20\u0d02')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      <div class="set-row"><span class="lbl">Part size for new lessons</span>${seg('level', Object.keys(LEVELS).map(k => [k, LEVELS[k].en]), 'Part size')}<p class="desc">Min \u2248 2\u20133 words a part, Medium \u2248 3\u20134, Max \u2248 5\u20136. Every ayah is divided by its own length, so short ayahs stay whole.</p></div>
      ${sw('pauseBreak', 'End parts at pause signs', 'When the text has a waqf sign near the end of a part.')}
      <div class="set-row"><span class="lbl">Join the parts</span>${seg('joinMethod', [['cumulative', '1+2, 1\u20133 \u2026'], ['pairs', '1+2, 2+3 \u2026']], 'Join the parts')}</div>
      <div class="set-row"><span class="lbl">Ayah groups (ayah lessons)</span>${seg('ayahGroup', [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], 'Ayahs per group')}<p class="desc">1 = one ayah at a time. A group is memorized like one ayah, then made together with the ones before.</p></div>
      <div class="set-row"><span class="lbl">Ayah groups (page lessons)</span>${seg('pageSplit', [[3, '3'], [4, '4'], [5, '5']], 'Ayahs per page group')}</div>
    </div></details>
    <details class="set-sec"><summary><h3>Repetitions${mlTag('\u00b7 \u0d06\u0d35\u0d7c\u0d24\u0d4d\u0d24\u0d28\u0d02')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      ${rep('groupReps', 1, 50, 'Each part', 5)}
      ${rep('comboReps', 1, 50, 'Joined parts', 5)}
      ${rep('ayahReps', 1, 99, 'Whole ayah', 10)}
      ${rep('joinReps', 1, 50, 'Make together \u00b7 all together', 3)}
      ${rep('pageReps', 1, 50, 'Whole page (all together)', 5)}
      <p class="desc">You count every repetition yourself. The app does not listen to your recitation.</p>
    </div></details>
    <details class="set-sec"><summary><h3>Translation${mlTag('\u00b7 \u0d2a\u0d30\u0d3f\u0d2d\u0d3e\u0d37')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      ${sw('trShow', 'Show the translation under each ayah', 'Each ayah also has its own small switch.')}
      <div class="radio-list">${TRANSLATIONS.map(t => radio('translation', t.id, esc(t.name + (t.short ? ' \u2014 ' + t.short : '')), t.by ? esc(t.by) : 'Only the Arabic text.')).join('')}</div>
    </div></details>
    <details class="set-sec"><summary><h3>Recitation${mlTag('\u00b7 \u0d2a\u0d3e\u0d30\u0d3e\u0d2f\u0d23\u0d02')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      <div class="set-row"><label class="lbl" for="selReciter">Reciter</label><select class="select" id="selReciter" data-set="reciter">${RECITERS.map(r => `<option value="${r.edition}"${S.reciter === r.edition ? ' selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>
      <div class="set-row"><span class="lbl">Repeat each ayah</span>${seg('audioRep', [[1, '1\u00d7'], [3, '3\u00d7'], [5, '5\u00d7'], [10, '10\u00d7']], 'Repeat each ayah')}</div>
      <div class="set-row"><span class="lbl">Speed</span>${seg('audioRate', [['0.75', '0.75\u00d7'], ['1', '1\u00d7'], ['1.25', '1.25\u00d7']], 'Speed')}</div>
      <p class="desc">The same recitations as the academy\u2019s share player (AlQuran Cloud audio, one file per ayah).</p>
    </div></details>
    <details class="set-sec"><summary><h3>Display${mlTag('\u00b7 \u0d15\u0d3e\u0d34\u0d4d\u0d1a')}</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      <div class="set-row"><span class="lbl">Arabic text size</span>${seg('arSize', [['s', 'S'], ['m', 'M'], ['l', 'L'], ['xl', 'XL']], 'Arabic text size')}</div>
      <div class="set-row"><span class="lbl">Quran font</span>${seg('quranFont', [['amiri', 'Amiri Quran'], ['naskh', 'Noto Naskh']], 'Quran font')}<p class="font-prev" lang="ar" dir="rtl" style="font-family:var(--ar-font)">\u0645\u064e\u0646\u0652\u0632\u0650\u0644\u064f \u0627\u0644\u0652\u0642\u064f\u0631\u0652\u0622\u0646\u0650</p></div>
      ${sw('partColors', 'Colour each part', 'Every part of an ayah keeps its own colour, in every step.')}
      ${EN() ? '' : sw('englishHelp', 'Show English help', 'Malayalam is always shown.')}
      ${sw('autoScroll', 'Keep the current part in view')}
      ${navigator.vibrate ? sw('vibrate', 'Vibrate when counting', 'On phones that support it.') : ''}
      ${sw('reduceMotion', 'Reduce motion', 'Your device setting is always respected.')}
    </div></details>
    <details class="set-sec"><summary><h3>Saved in this browser</h3>${ic('chev-d', 'chev')}</summary><div class="set-in">
      <p class="local-note">${ic('lock')}<span>Settings and lessons of <b>${esc(STUDENT ? STUDENT.name : 'this student')}</b> are kept in this browser for now. Cloud sync comes in the next step.</span></p>
      <div class="set-inline"><button class="btn btn-sm" type="button" data-act="resetsettings">${ic('refresh')}Reset settings</button><button class="btn btn-sm danger" type="button" data-act="cleardata">${ic('x')}Clear progress</button></div>
    </div></details>`;
}
function syncSettingsUI() {
  const body = $('#settingsBody'); if (!body) return;
  $$('[data-set]', body).forEach(el => {
    const key = el.dataset.set, v = S[key];
    if (el.matches('button[data-val]')) el.setAttribute('aria-checked', String(String(v) === el.dataset.val));
    else if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'radio') el.checked = el.value === v;
    else if (el.type === 'number' && document.activeElement !== el) el.value = v;
    else if (el.tagName === 'SELECT') el.value = v;
  });
}
const LIMITS = { audioRep: [1, 10], ayahGroup: [1, 5], pageSplit: [3, 5], groupReps: [1, 50], comboReps: [1, 50], joinReps: [1, 50], pageReps: [1, 50], ayahReps: [1, 99] };
function settingValue(key, raw) {
  if (typeof DEFAULTS[key] === 'number') { const lim = LIMITS[key] || [1, 99]; return clampInt(raw, lim[0], lim[1], S[key]); }
  if (typeof DEFAULTS[key] === 'boolean') return raw === true || raw === 'true';
  return String(raw);
}
function rerenderEverything() {
  applyDisplay();
  $('#tipsBody').innerHTML = tipsHTML();
  if ($('#dlgSettings').open) renderSettings();
  if ($('#dlgTool').open && L && L.status === 'ready') refreshTools();
  if (!$('#homeView').hidden) { const keep = Object.assign({}, H); renderHome(); Object.assign(H, keep); refreshStartForm(true); }
  if (L && L.status === 'ready' && !$('#lessonView').hidden) renderLesson();
  else if (L && L.status === 'error' && !$('#lessonView').hidden) renderLessonError(L.error);
}
const STRUCT = ['pauseBreak', 'joinMethod', 'ayahGroup', 'pageSplit'];
async function changeSetting(key, raw) {
  if (!(key in DEFAULTS)) return;
  const val = settingValue(key, raw);
  if (key === 'level' && !LEVELS[val]) return;
  if (key === 'audioRep' && ![1, 3, 5, 10].includes(val)) return;
  if (key === 'audioRate' && !['0.75', '1', '1.25'].includes(val)) return;
  if (key === 'reciter' && !RECITERS.some(r => r.edition === val)) return;
  if (S[key] === val) { syncSettingsUI(); return; }
  const live = L && L.status === 'ready';
  if (live && STRUCT.includes(key)) {
    const groupsChange = (key === 'ayahGroup' && L.kind === 'ayah' && !L.group) || (key === 'pageSplit' && L.kind === 'page' && !L.group);
    const busy = groupsChange ? hasProgress(L) : L.seg.some(g => g && !g.done && (g.pc.some(Boolean) || g.cc.some(Boolean)));
    if (busy) {
      const ok = await confirmBox({ title: groupsChange ? 'Change the ayah groups?' : 'Divide the parts again?',
        body: groupsChange ? 'The steps of the open lesson change, so its progress starts again from reading.' : 'Ayahs you are still learning are divided again and their part counts start again. Memorized ayahs stay memorized.',
        ml: '\u0d24\u0d41\u0d31\u0d28\u0d4d\u0d28 \u0d2a\u0d3e\u0d20\u0d24\u0d4d\u0d24\u0d3f\u0d32\u0d46 \u0d2a\u0d41\u0d30\u0d4b\u0d17\u0d24\u0d3f \u0d35\u0d40\u0d23\u0d4d\u0d1f\u0d41\u0d02 \u0d24\u0d41\u0d1f\u0d19\u0d4d\u0d19\u0d3f\u0d2f\u0d47\u0d15\u0d4d\u0d15\u0d3e\u0d02.', ok: 'Apply' });
      if (!ok) { syncSettingsUI(); return; }
      if (groupsChange) Object.assign(L, { read: [], step: 0, cur: 0 });
    }
  }
  S[key] = val;
  let trChanged = key === 'translation';
  if (key === 'uiLang') {   // the language switch also switches the translation to match
    if (val === 'en' && trInfo(S.translation).lang === 'ml') { S.translation = 'en.sahih'; trChanged = true; }
    if (val === 'ml' && trInfo(S.translation).lang === 'en') { S.translation = 'ml.abdulhameed'; trChanged = true; }
  }
  if (key === 'trShow' && live) L.trFlip = [];
  if (key === 'audioRate' && Player.el) Player.el.playbackRate = +val;
  if (key === 'reciter' && Player.list.length) Player.stop();
  saveSettings(); applyDisplay(); syncSettingsUI();
  if (key === 'uiLang') {
    rerenderEverything();
    const r = $('#dlgSettings').open && $('#settingsBody input[data-set="uiLang"]:checked');
    if (r) r.focus({ preventScroll: true });
    if (trChanged && live && !$('#lessonView').hidden) reloadTranslation();
    toast(val === 'en' ? 'Language: English only.' : 'Language: Malayalam + English.', val === 'ml' ? '\u0d2d\u0d3e\u0d37: \u0d2e\u0d32\u0d2f\u0d3e\u0d33\u0d02 + \u0d07\u0d02\u0d17\u0d4d\u0d32\u0d40\u0d37\u0d4d' : '', 'check');
    return;
  }
  if (live && !$('#lessonView').hidden) {
    if (trChanged) reloadTranslation();
    else if (!['arSize', 'quranFont', 'reduceMotion', 'autoScroll', 'vibrate', 'startMode', 'level', 'audioRep', 'audioRate', 'reciter'].includes(key)) { renderLesson(); persist(); }
  }
  if (!$('#homeView').hidden && ['level', 'englishHelp'].includes(key)) { const keep = Object.assign({}, H); renderHome(); Object.assign(H, keep); refreshStartForm(true); }
  if (key === 'englishHelp' && $('#dlgSettings').open) { renderSettings(); }
  if (['audioRep', 'reciter'].includes(key)) refreshTools();
}

/* ---------------------------------------------------------------------
   18. Event wiring
   --------------------------------------------------------------------- */
const ready = () => L && L.status === 'ready' && !$('#lessonView').hidden;
const ACTIONS = {
  // global
  home: () => { closeDialog($('#dlgTool')); Player.stop(); goHome(); },
  settings: () => { closeDialog($('#dlgTool')); renderSettings(); openDialog($('#dlgSettings')); },
  tips: () => { $('#dlgTipsT').textContent = 'Memorization tips'; $('#tipsBody').innerHTML = tipsHTML(); openDialog($('#dlgTips')); },
  method: () => { $('#dlgTipsT').textContent = 'How it works'; $('#tipsBody').innerHTML = methodHTML(); openDialog($('#dlgTips')); },
  closedlg: el => closeDialog(el.closest('dialog')),
  skip: () => { const m = $('#main'); if (m) { m.focus({ preventScroll: true }); m.scrollIntoView({ block: 'start' }); } },
  // home & picker
  startmode: el => { H.mode = el.dataset.m === 'page' ? 'page' : 'ayah'; S.startMode = H.mode; saveSettings(); refreshStartForm(true); },
  startlevel: el => { if (LEVELS[el.dataset.v]) { S.level = el.dataset.v; saveSettings(); refreshStartForm(false); } },
  openpicker: el => openPicker(el.dataset.for === 'page'),
  pick: el => pickSurah(+el.dataset.n),
  pfilter: el => { P.filter = el.dataset.f; renderSurahList(); },
  porder: () => { P.reverse = !P.reverse; renderSurahList(); },
  rng: el => {
    const su = surahOf(H.surah), f = el.dataset.f, dlt = +el.dataset.d;
    const cur = Number.isInteger(H[f]) ? H[f] : 1;
    H[f] = Math.min(su.ayahs, Math.max(1, cur + dlt));
    if (f === 'from' && Number.isInteger(H.to) && H.from > H.to) H.to = H.from;
    if (f === 'to' && Number.isInteger(H.from) && H.to < H.from) H.from = H.to;
    refreshStartForm(true);
  },
  pgstep: el => { const cur = Number.isInteger(H.page) ? H.page : 1; H.page = Math.min(PAGE_COUNT, Math.max(1, cur + (+el.dataset.d))); refreshStartForm(true); },
  quick: el => { H.from = +el.dataset.a; H.to = +el.dataset.b; refreshStartForm(true); },
  quickpage: el => { H.page = +el.dataset.p; refreshStartForm(true); },
  start: () => startFromForm(),
  resume: () => { const s = savedLesson(); if (s) openSaved(s, true); else { toast('The saved lesson could not be opened.'); renderHome(); } },
  discard: async () => {
    const ok = await confirmBox({ title: 'Remove the saved lesson?', body: 'Its progress is removed from this browser. Memorized ayahs stay in the revision list.', ml: '\u0d38\u0d42\u0d15\u0d4d\u0d37\u0d3f\u0d1a\u0d4d\u0d1a \u0d2a\u0d3e\u0d20\u0d02 \u0d08 \u0d2c\u0d4d\u0d30\u0d57\u0d38\u0d31\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d28\u0d40\u0d15\u0d4d\u0d15\u0d02 \u0d1a\u0d46\u0d2f\u0d4d\u0d2f\u0d41\u0d02.', ok: 'Remove' });
    if (ok) { store.del(KEY.lesson); L = null; renderHome(); }
  },
  revise: async el => { const r = refFromEl(el); if (!(await okToReplace(savedLesson()))) return; startLesson(r, 'revise', { push: true }); },
  startref: async el => { const r = refFromEl(el); if (!(await okToReplace(savedLesson()))) return; H.link = null; startLesson(r, 'learn', { push: true }); },
  retryload: () => { if (L) startLesson(refOf(L), L.mode, { push: false }); },
  // lesson
  step: el => { if (ready()) goStep(+el.dataset.s); },
  phase: el => { if (!ready()) return; const f = focusOf(); if (f.st.t !== 'seg') return; f.g.ph = el.dataset.v; L.focusHide = 0; renderLesson(); persist(); },
  next: () => { if (ready()) goNext(); },
  prev: () => { if (ready()) goPrev(); },
  count: () => { if (ready()) count(1); },
  undo: () => { if (ready()) count(-1); },
  resetcount: () => { if (ready()) { count(0); refreshTools(); } },
  hide: () => { if (ready()) cycleHide(); },
  rowhide: el => { if (ready()) cycleRowHide(+el.dataset.i); },
  rowtr: el => { if (ready()) toggleRowTr(+el.dataset.i); },
  read: el => {
    if (!ready()) return;
    const i = +el.dataset.i;
    L.read = L.read.includes(i) ? L.read.filter(x => x !== i) : L.read.concat(i);
    L.cur = i; renderLesson(); persist();
  },
  linkmode: () => {
    if (!ready()) return;
    if (linkDrag.justDropped) return;   // the link was just dragged into place
    L.pinMode = !L.pinMode; renderLesson();
    if (L.pinMode) announce('Link mode on. Tap between two words.');
  },
  tgview: el => { if (ready()) changeSetting('tgView', el.dataset.v); },
  dock: () => { if (ready()) changeSetting('dockMini', !S.dockMini); },
  trall: () => { if (ready()) changeSetting('trShow', !S.trShow); },
  audio: () => { if (ready()) playAudio(); },
  unlink: el => { if (ready() && L.pins.includes(el.dataset.k)) { togglePin(el.dataset.k); refreshTools(); } },
  shareaudio: () => { const u = ready() && shareAudioURL(); if (u) copyText(u, 'Audio share link copied.'); },
  more: el => { if (ready()) openTools(el.dataset.sec); },
  note: el => { if (!ready()) return; L.cur = +el.dataset.i; openTools(); setTimeout(() => { const t = $('#noteBox'); if (t) t.focus(); }, 60); },
  lvl: el => { if (ready()) setLevel(el.dataset.scope, el.dataset.v); },
  grp: el => { if (ready()) setGroup(el.dataset.v); },
  gbreak: el => { if (ready()) toggleBreak(+el.dataset.i); },
  assess: el => { if (ready()) assess(el.dataset.r); },
  restart: () => { if (ready()) restartLesson(); },
  copylink: () => { if (ready()) copyLink(); },
  retrytr: () => { if (ready()) reloadTranslation(); },
  // settings
  snum: el => { const k = el.dataset.key; changeSetting(k, S[k] + (+el.dataset.d)); },
  resetsettings: async () => {
    const ok = await confirmBox({ title: 'Reset all settings?', body: 'Language, part size, groups, repetitions and display go back to the academy defaults.', ml: '\u0d0e\u0d32\u0d4d\u0d32\u0d3e \u0d15\u0d4d\u0d30\u0d2e\u0d40\u0d15\u0d30\u0d23\u0d19\u0d4d\u0d19\u0d33\u0d41\u0d02 \u0d06\u0d26\u0d4d\u0d2f\u0d24\u0d4d\u0d24\u0d46 \u0d28\u0d3f\u0d32\u0d2f\u0d3f\u0d32\u0d47\u0d15\u0d4d\u0d15\u0d4d \u0d2e\u0d3e\u0d31\u0d41\u0d02.', ok: 'Reset' });
    if (!ok) return;
    const prevTr = S.translation;
    S = Object.assign({}, DEFAULTS); saveSettings();
    rerenderEverything(); renderSettings();
    if (ready() && prevTr !== S.translation) reloadTranslation();
  },
  cleardata: async () => {
    const ok = await confirmBox({ title: 'Clear this student\u2019s progress?', body: `${STUDENT ? STUDENT.name + '\u2019s' : 'The'} saved lesson, revision list and memorized-ayah count are removed from this browser. The account and settings are kept.`, ml: '\u0d08 \u0d35\u0d3f\u0d26\u0d4d\u0d2f\u0d3e\u0d7c\u0d24\u0d4d\u0d25\u0d3f\u0d2f\u0d41\u0d1f\u0d46 \u0d38\u0d42\u0d15\u0d4d\u0d37\u0d3f\u0d1a\u0d4d\u0d1a \u0d2a\u0d41\u0d30\u0d4b\u0d17\u0d24\u0d3f \u0d08 \u0d2c\u0d4d\u0d30\u0d57\u0d38\u0d31\u0d3f\u0d7d \u0d28\u0d3f\u0d28\u0d4d\u0d28\u0d4d \u0d2e\u0d3e\u0d2f\u0d4d\u0d15\u0d4d\u0d15\u0d41\u0d02.', ok: 'Clear progress' });
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
    fn(el, e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.matches('[data-set]')) {
      const key = el.dataset.set;
      if (el.type === 'checkbox') changeSetting(key, el.checked);
      else if (el.type === 'radio') { if (el.checked) changeSetting(key, el.value); }
      else changeSetting(key, el.value);
    }
  });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.matches('[data-note]') && L && L.status === 'ready') {
      const i = +el.dataset.note, v = el.value.slice(0, 600);
      if (v.trim()) L.notes[i] = v; else delete L.notes[i];
      persist();
    } else if (el.id === 'surahSearch') renderSurahList();
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'surahSearch' && e.key === 'Enter') { e.preventDefault(); const first = $('#surahList [data-act="pick"]'); if (first) pickSurah(+first.dataset.n); }
  });
  // link mode: a tap near the gap between two words links (or unlinks) them
  document.addEventListener('click', e => {
    if (!L || !L.pinMode || !ready() || linkDrag.justDropped) return;
    const g = gapAt(e.clientX, e.clientY, e.target);
    if (g) togglePin(g.key);
  });
  bindLinkDrag();
  // hold between two words (about half a second) to link or unlink them \u2014 no mode needed
  let hold = null;
  const holdOff = () => { if (hold) { clearTimeout(hold.t); hold = null; } };
  document.addEventListener('pointerdown', e => {
    holdOff();
    if (!L || L.pinMode || !ready() || e.button > 0) return;
    const w = e.target.closest && e.target.closest('#lessonView .w[data-w]');
    if (!w) return;
    const x = e.clientX, y = e.clientY;
    hold = { x, y, t: setTimeout(() => {
      hold = null;
      const g = gapAt(x, y, w);
      if (!g) return;
      linkDrag.justDropped = true; setTimeout(() => { linkDrag.justDropped = false; }, 400);
      if (S.vibrate && navigator.vibrate) { try { navigator.vibrate(15); } catch (er) { /* ignore */ } }
      togglePin(g.key);
    }, 480) };
  });
  document.addEventListener('pointermove', e => { if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 10) holdOff(); });
  document.addEventListener('pointerup', holdOff);
  document.addEventListener('pointercancel', holdOff);
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('#lessonView .w[data-w]')) e.preventDefault(); });
  Player.onChange = markPlaying;
  let fitT;
  window.addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(() => { if (ready()) fitMushaf(); }, 120); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (ready()) fitMushaf(); });
  // tapping an ayah row makes it the current ayah (for notes, translation and hiding)
  document.addEventListener('pointerdown', e => {
    const row = e.target.closest && e.target.closest('#lessonView .ay[data-i]');
    if (row && L && L.status === 'ready') { const i = +row.dataset.i; if (L.cur !== i) { L.cur = i; $$('#lessonView .ay.cur').forEach(x => x.classList.remove('cur')); if (curStep().t !== 'seg' || focusOf().items.length > 1) row.classList.add('cur'); } }
  }, { passive: true });
  $$('dialog').forEach(d => {
    if (d.id !== 'dlgConfirm') d.addEventListener('close', () => {
      onDialogClosed(d);
      if (d.id === 'dlgTool' && ready()) renderLesson();   // a note may have been added
    });
    d.addEventListener('click', e => { if (e.target === d && d.id !== 'dlgConfirm' && !d.hasAttribute('data-keep')) closeDialog(d); });
  });
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { $('#topbar').classList.toggle('scrolled', window.scrollY > 4); ticking = false; });
  }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('online', () => { if (L && L.status === 'error' && !$('#lessonView').hidden) toast('You are back online \u2014 press \u201cTry again\u201d.'); });
}

/* ---------- links: drag the link icon from the panel and drop it between two words ---------- */
const linkDrag = { on: false, justDropped: false };
// the gap nearest to (x, y): Arabic runs right to left, so the next word is on the left
function gapAt(x, y, target) {
  const el = target && target.closest ? target : document.elementFromPoint(x, y);
  const w = el && el.closest && el.closest('#lessonView .w[data-w]');
  if (!w) return null;
  const [i, wi] = w.dataset.w.split(':').map(Number), n = wordsOf(L)[i].length, r = w.getBoundingClientRect();
  const wordEl = k => $(`#lessonView .w[data-w="${i}:${k}"]`);
  if (x < r.left + r.width / 2) return wi < n - 1 ? { key: `${i}:${wi}`, a: w, b: wordEl(wi + 1) } : null;
  return wi > 0 ? { key: `${i}:${wi - 1}`, a: wordEl(wi - 1), b: w } : null;
}
function bindLinkDrag() {
  let st = null, ghost = null, mark = null;
  const clear = () => { if (ghost) ghost.remove(); if (mark) mark.remove(); ghost = mark = null; document.documentElement.classList.remove('dragging-link'); st = null; linkDrag.on = false; };
  document.addEventListener('pointerdown', e => {
    const b = e.target.closest && e.target.closest('#lessonView [data-act="linkmode"]');
    if (!b || !ready() || e.button > 0) return;
    st = { x: e.clientX, y: e.clientY, key: null };
  });
  document.addEventListener('pointermove', e => {
    if (!st) return;
    if (!linkDrag.on) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 8) return;
      linkDrag.on = true;
      document.documentElement.classList.add('dragging-link');
      ghost = document.createElement('div'); ghost.className = 'lk-ghost'; ghost.innerHTML = ic('link'); document.body.appendChild(ghost);
      mark = document.createElement('div'); mark.className = 'lk-mark'; mark.hidden = true; document.body.appendChild(mark);
    }
    const x = e.clientX, y = e.clientY - 34;   // the icon floats just above the finger
    ghost.style.transform = `translate(${x - 18}px, ${y - 18}px)`;
    const g = gapAt(x, y);
    st.key = g ? g.key : null;
    if (g && g.a && g.b) {
      const ra = g.a.getBoundingClientRect(), rb = g.b.getBoundingClientRect();
      const sameLine = Math.abs(ra.top - rb.top) < ra.height / 2;
      const gx = sameLine ? (ra.left + rb.right) / 2 : ra.left;
      mark.hidden = false; mark.style.transform = `translate(${gx - 2}px, ${ra.top}px)`; mark.style.height = ra.height + 'px';
    } else mark.hidden = true;
  });
  const end = () => {
    if (!st) return;
    const key = linkDrag.on ? st.key : null, dragged = linkDrag.on;
    clear();
    if (dragged) {
      linkDrag.justDropped = true; setTimeout(() => { linkDrag.justDropped = false; }, 350);
      if (key) togglePin(key); else announce('Drop the link between two words.');
    }
  };
  document.addEventListener('pointerup', end);
  document.addEventListener('pointercancel', clear);
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
// Called once by admin.v2.js: event wiring for the learner screens and the shared dialogs.
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
  if (link && L && L.status === 'ready' && sameRange(refOf(L), link)) { showView('lesson'); renderLesson(); }
  else if (link) openLink(link, false);
  else goHome({ push: false });
}
// Leave the student's space (back to the dashboard). Everything is saved first.
function unmount() {
  Player.stop();
  if (L && L.status === 'ready') saveNow();
  loadSeq++; L = null; SID = null; STUDENT = null; KEY = HifzStore.keys('none');
  S = Object.assign({}, DEFAULTS); applyDisplay();
  $$('dialog').forEach(d => { if (d.open && d.id !== 'dlgStudent') closeDialog(d); });
  $('#homeView').hidden = true; $('#lessonView').hidden = true;
  $('#homeView').innerHTML = ''; $('#lessonView').innerHTML = '';
  $('#statusChip').hidden = true; $('#topbar').classList.remove('has-status');
  document.body.dataset.view = '';
}
// The admin edited this student's details or preferences: reload them and redraw.
function refresh(student) {
  if (!SID || !student || student.id !== SID) return;
  const prevTr = S.translation;
  STUDENT = student; S = loadSettings();
  if (!$('#homeView').hidden) initHomeState();
  rerenderEverything();
  if (prevTr !== S.translation && ready()) reloadTranslation();
}

// Expose pure helpers for automated checks (no side effects).
window.MQHifz = { tokenize, levelParts, LEVELS, splitBasmalah, comboSteps, pageAyahs, pageSegments, pageOf, juzOf, autoParts, nextHide, version: 'portal-2' };

return {
  boot, mount, route, unmount, refresh,
  studentId: () => SID,
  // shared helpers for the dashboard
  confirm: confirmBox, toast, openDialog, closeDialog, ic, esc, relTime, TRANSLATIONS, LEVELS
};
})();
