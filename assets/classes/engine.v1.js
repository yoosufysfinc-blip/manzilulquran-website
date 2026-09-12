/* =================================================================
   ManzilulQuran — CLASS SYSTEM ENGINE  v1
   -----------------------------------------------------------------
   The calendar rule engine, shared by every page in the class system.

   Before this file existed the same functions were copied into
   class/index.html, join/index.html and portal/classes/index.html.
   Three copies meant a fix applied to two of them produced wrong
   dates or wrong meeting links for some students, silently. This is
   the one copy.

   PUBLISHED FILES ARE IMMUTABLE. Never edit this file once it is
   live. Create engine.v2.js and point new pages at it. A phone
   holding cached HTML then keeps loading the script that matches it.

   Classic script, no modules — everything here is global, exactly as
   it was when it lived inline. Load order is what matters.
   ================================================================= */

/* ---------------- Primitives ---------------- */
const $ = (id) => document.getElementById(id);

function escapeHtml(str){
  if(str == null) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* join/ called this esc(). Same function, same output. */
const esc = escapeHtml;

function fmtDate(v){
  if(!v) return '—';
  if(v instanceof Date){
    if(isNaN(v.getTime())) return '—';
    return v.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }
  const s = String(v);
  const plain = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(plain){
    const d = new Date(Date.UTC(+plain[1], +plain[2]-1, +plain[3]));
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' });
  }
  const d = new Date(s);
  if(isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
}

function accentLastWord(name){
  const parts = String(name).trim().split(/\s+/);
  if(parts.length === 1) return escapeHtml(parts[0]);
  const last = parts.pop();
  return escapeHtml(parts.join(' ')) + ' <span class="accent">' + escapeHtml(last) + '</span>';
}

/* Twinkling starfield. class/ spawned 46, join/ spawned 40 — the count
   stays a per-page decision, so it is an argument. */
function spawnStars(count, skyId){
  const sky = $(skyId || 'sky');
  if(!sky) return;
  for(let i=0;i<count;i++){
    const s = document.createElement('div');
    s.className = 'star';
    const size = Math.random() < 0.85 ? (1 + Math.random()*1.4) : (2 + Math.random()*1.2);
    s.style.width  = size + 'px';
    s.style.height = size + 'px';
    s.style.left = (Math.random()*100) + '%';
    s.style.top  = (Math.random()*100) + '%';
    s.style.animationDelay    = (Math.random()*4) + 's';
    s.style.animationDuration = (3 + Math.random()*3.5) + 's';
    sky.appendChild(s);
  }
}

/* Where this build lives. The live pages leave it unset, so links come
   out as /class/ and /join/ exactly as before. A demo build sets
   window.MQ_BASE = "/portal/demo" in its inline script, and every
   cross-page link then stays inside the demo instead of jumping to the
   live pages mid-test. One line per page, no forked logic. */
function mqUrl(path){
  return (window.MQ_BASE || '') + path;
}

/* ---------------- Dates ---------------- */
const DAYS_FULL  = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const DAYS_SHORT = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function parseDate(s){
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return null;
  return new Date(+m[1], +m[2]-1, +m[3]);   // local midnight — no timezone drift
}
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function today0(){ const t = new Date(); t.setHours(0,0,0,0); return t; }
function sameDay(a, b){ return a.getTime() === b.getTime(); }

function isoDate(d){
  return d.getFullYear() + '-' +
         String(d.getMonth()+1).padStart(2,'0') + '-' +
         String(d.getDate()).padStart(2,'0');
}

/* ---------------- Calendar rules ---------------- */
function endDate(cal){
  const s = parseDate(cal.startDate);
  return s ? addDays(s, (cal.days || 1) - 1) : null;
}

/* Active / Upcoming / Completed / Inactive — worked out from the date,
   never stored. This is what makes a calendar expire on its own. */
function calStatus(cal){
  if(!cal.active) return 'Inactive';
  const s = parseDate(cal.startDate);
  const e = endDate(cal);
  if(!s || !e) return 'Inactive';
  const t = today0();
  if(t < s) return 'Upcoming';
  if(t > e) return 'Completed';
  return 'Active';
}

/* The calendar as a whole is joinable unless the academy switched it
   off or it has ended. Whether one specific DAY is joinable is a
   separate question, and is decided by the page. */
function joinAllowed(cal){
  const st = calStatus(cal);
  return st === 'Active' || st === 'Upcoming';
}

/* The 40 day rows are never stored. The academy saves only the rule
   (start + days + weekly off + links) and we rebuild the days here.
   A weekly-off day consumes no link, so the rotation advances across
   teaching days only. */
function buildDays(cal){
  const start = parseDate(cal.startDate);
  if(!start) return [];
  const off = new Set((cal.weeklyOff || []).map(n => DAYS_FULL.indexOf(n)).filter(i => i >= 0));
  const links = cal.links || [];
  const out = [];
  let linkIdx = 0;

  for(let i = 0; i < cal.days; i++){
    const date = addDays(start, i);
    const isOff = off.has(date.getDay());
    let link = null;
    if(!isOff && links.length){
      link = links[linkIdx % links.length];
      linkIdx++;
    }
    out.push({ n: i+1, date, isOff, link });
  }
  return out;
}

/* Teaching days still to come, today included. Used for the low-class
   warning and, later, for deciding whether to offer a direct join. */
function classesLeft(cal){
  const t = today0().getTime();
  return buildDays(cal).filter(d => !d.isOff && d.date.getTime() >= t).length;
}
