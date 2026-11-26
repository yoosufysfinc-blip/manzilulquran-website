/* =================================================================
   ManzilulQuran — STUDY MATERIAL PICKER  v1
   -----------------------------------------------------------------
   The admin's "Study Material" window, grouped by level:
     Foundation · Level 1   (books in study-material/foundation-of-islamic-studies/)
     Tharbiya   · Level 2   (books in study-material/tharbiya-level-2/)
     Thazkiya   · Level 3   (books in study-material/thazkiya-level-3/)
   The level comes from each book's PATH folder in catalog.v2.js — not
   from its key (two keys do not match their folders; see catalog.v2.js).

   The window opens on the three levels. A level that already has a
   chosen book opens by itself. Each chosen book is either the whole
   course or chosen lessons.

   Same stored value as before (smStringify(smCollect()) in the page):
     [{"course":"noorul-hayah","lessons":[1,4,7]}]   — lessons [] = whole course
   A stored key that is no longer in the catalog is kept (shown at the
   top with a remove button), so saving never drops it silently.

   Needs catalog.v2.js (SM_CATALOG) and the page's escapeHtml() and
   updateSmSummary(). Defines smBuild(), smCollect(), smSummaryLabel().
   Load it after catalog.v2.js and BEFORE the page's own script.

   PUBLISHED FILES ARE IMMUTABLE. Create sm-picker.v2.js to change this.
   ================================================================= */

const SMP_LEVELS = [
  { id: "l1", tag: "L1", name: "Foundation", sub: "Learning to read Arabic · ages 4–10", folder: "/foundation-of-islamic-studies/" },
  { id: "l2", tag: "L2", name: "Tharbiya",   sub: "Faith and good character · ages 8–12", folder: "/tharbiya-level-2/" },
  { id: "l3", tag: "L3", name: "Thazkiya",   sub: "Purifying the heart · the next step",   folder: "/thazkiya-level-3/" }
];
const SMP = { sel: {}, mode: {}, open: {}, extra: [] };

function smpLevelOf(key){
  const p = String((SM_CATALOG[key] || {}).path || "");
  const lv = SMP_LEVELS.find(l => p.indexOf(l.folder) >= 0);
  return lv ? lv.id : "other";
}
function smpLevels(){
  const out = SMP_LEVELS.map(l => Object.assign({ keys: [] }, l));
  const other = { id: "other", tag: "··", name: "Other books", sub: "Not in a level folder", keys: [] };
  Object.keys(SM_CATALOG).forEach(k => { const id = smpLevelOf(k); (out.find(l => l.id === id) || other).keys.push(k); });
  if(other.keys.length) out.push(other);
  return out;
}
function smpE(s){ return (typeof escapeHtml === "function") ? escapeHtml(s == null ? "" : String(s)) : String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }
function smpShort(t){ return String(t || "").replace(/\s*\((Foundation|Tharbiya L2|Thazkiya L3)\)\s*$/i, "").replace(/\s+—\s+.*$/, ""); }

/* Build from a stored assignment (the parsed list) */
function smBuild(assigned){
  SMP.sel = {}; SMP.mode = {}; SMP.open = {}; SMP.extra = [];
  (assigned || []).forEach(x => {
    if(!x || !x.course) return;
    if(!SM_CATALOG[x.course]){ SMP.extra.push({ course: x.course, lessons: (x.lessons || []).slice() }); return; }
    SMP.sel[x.course] = new Set((x.lessons || []).map(Number));
    SMP.mode[x.course] = (x.lessons || []).length ? "pick" : "whole";
    SMP.open[smpLevelOf(x.course)] = true;
  });
  smpPaint();
  if(typeof updateSmSummary === "function") updateSmSummary();
}

/* Read it back out — the same shape the page always stored */
function smCollect(){
  const list = [];
  smpLevels().forEach(l => l.keys.forEach(k => {
    if(!SMP.sel[k]) return;
    const n = SM_CATALOG[k].lessons.length;
    const ls = SMP.mode[k] === "pick" ? [...SMP.sel[k]].filter(i => i >= 1 && i <= n).sort((a, b) => a - b) : [];
    list.push({ course: k, lessons: ls });
  }));
  return list.concat(SMP.extra);
}

function smpLine(x){
  const c = SM_CATALOG[x.course];
  if(!c) return x.course;
  return smpShort(c.title) + (x.lessons.length ? " (" + x.lessons.length + " lesson" + (x.lessons.length === 1 ? "" : "s") + ")" : "");
}
function smSummaryLabel(){
  const list = smCollect();
  if(!list.length) return "No study material selected";
  if(list.length === 1){ const c = SM_CATALOG[list[0].course]; return c ? c.title + (list[0].lessons.length ? " · " + list[0].lessons.length + " lessons" : " · whole course") : list[0].course; }
  const names = list.slice(0, 2).map(smpLine);
  return list.length + " books: " + names.join(", ") + (list.length > 2 ? " +" + (list.length - 2) + " more" : "");
}

const SMP_CHEV = '<svg class="smp-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

function smpBook(k){
  const c = SM_CATALOG[k], on = !!SMP.sel[k], mode = SMP.mode[k] || "whole", set = SMP.sel[k] || new Set();
  const n = c.lessons.length, picked = [...set].filter(i => i >= 1 && i <= n).length;
  let state = "";
  if(on) state = mode === "pick" ? (picked ? picked + " of " + n : "choose lessons") : "whole course";
  const lessons = on && mode === "pick" ? `
      <div class="smp-ls">${c.lessons.map((t, i) => `<label class="smp-l${set.has(i + 1) ? " on" : ""}"><input type="checkbox" data-smp="lesson" data-k="${smpE(k)}" value="${i + 1}"${set.has(i + 1) ? " checked" : ""}><span class="smp-n">${i + 1}</span><span class="smp-lt">${smpE(t)}</span></label>`).join("")}</div>
      <div class="smp-tools"><button type="button" data-smp="all" data-k="${smpE(k)}">Tick all</button><button type="button" data-smp="none" data-k="${smpE(k)}">Clear</button>
        ${picked ? "" : '<span class="smp-warn">No lesson ticked yet — this still gives the whole course.</span>'}</div>` : "";
  return `<div class="smp-book${on ? " on" : ""}" data-k="${smpE(k)}">
    <label class="smp-bh"><input type="checkbox" data-smp="book" data-k="${smpE(k)}"${on ? " checked" : ""}>
      <span class="smp-bt"><b>${smpE(smpShort(c.title))}</b><small>${n} lesson${n === 1 ? "" : "s"}${c.blurb && !on ? " · " + smpE(c.blurb) : ""}</small></span>
      ${state ? `<span class="smp-st">${smpE(state)}</span>` : ""}</label>
    ${on ? `<div class="smp-mode" role="radiogroup" aria-label="How much of ${smpE(smpShort(c.title))}">
        <button type="button" role="radio" aria-checked="${mode === "whole"}" class="${mode === "whole" ? "on" : ""}" data-smp="mode" data-m="whole" data-k="${smpE(k)}">Whole course</button>
        <button type="button" role="radio" aria-checked="${mode === "pick"}" class="${mode === "pick" ? "on" : ""}" data-smp="mode" data-m="pick" data-k="${smpE(k)}">Choose lessons</button></div>` : ""}
    ${lessons}
  </div>`;
}

function smpPaint(){
  const wrap = document.getElementById("fSmList"); if(!wrap) return;
  const sc = wrap.closest(".modal-body") || wrap, keep = sc.scrollTop;
  /* keep the keyboard focus on the same control after the repaint */
  const f = document.activeElement && wrap.contains(document.activeElement) && document.activeElement.dataset ? document.activeElement : null;
  const fk = f ? [f.dataset.smp, f.dataset.k || "", f.dataset.lv || "", f.dataset.m || "", f.value || ""] : null;
  const list = smCollect();
  const chosen = list.length
    ? `<div class="smp-chosen"><span class="smp-cl">Chosen</span>${list.map(x => `<span class="smp-pill">${smpE(smpLine(x))}<button type="button" data-smp="drop" data-k="${smpE(x.course)}" aria-label="Remove ${smpE(smpLine(x))}">✕</button></span>`).join("")}</div>`
    : '<div class="smp-chosen none">Nothing chosen yet. Open a level and tick a book.</div>';
  wrap.innerHTML = `<div class="smp">${chosen}${smpLevels().map(l => {
    const n = l.keys.filter(k => SMP.sel[k]).length, open = !!SMP.open[l.id];
    return `<section class="smp-lv${open ? " open" : ""}${n ? " has" : ""}">
      <button type="button" class="smp-lvh" data-smp="level" data-lv="${l.id}" aria-expanded="${open}">
        <span class="smp-tag">${smpE(l.tag)}</span>
        <span class="smp-lvt"><b>${smpE(l.name)}</b><small>${smpE(l.sub)}</small></span>
        <span class="smp-lvn">${n ? n + " chosen" : l.keys.length + " book" + (l.keys.length === 1 ? "" : "s")}</span>${SMP_CHEV}
      </button>
      ${open ? `<div class="smp-books">${l.keys.map(smpBook).join("")}</div>` : ""}
    </section>`; }).join("")}</div>`;
  sc.scrollTop = keep;
  if(fk){
    const g = [...wrap.querySelectorAll("[data-smp]")].find(x => x.dataset.smp === fk[0] && (x.dataset.k || "") === fk[1] &&
      (x.dataset.lv || "") === fk[2] && (x.dataset.m || "") === fk[3] && (x.value || "") === fk[4]);
    if(g) g.focus({ preventScroll: true });
  }
}

function smpChanged(){ smpPaint(); if(typeof updateSmSummary === "function") updateSmSummary(); }

document.addEventListener("click", function(ev){
  const el = ev.target.closest("#fSmList [data-smp]"); if(!el) return;
  const a = el.dataset.smp, k = el.dataset.k;
  if(a === "level"){ SMP.open[el.dataset.lv] = !SMP.open[el.dataset.lv]; smpPaint(); }
  else if(a === "mode"){ SMP.mode[k] = el.dataset.m; smpChanged(); }
  else if(a === "all"){ SMP.sel[k] = new Set(SM_CATALOG[k].lessons.map((t, i) => i + 1)); smpChanged(); }
  else if(a === "none"){ SMP.sel[k] = new Set(); smpChanged(); }
  else if(a === "drop"){
    if(SM_CATALOG[k]){ delete SMP.sel[k]; delete SMP.mode[k]; } else SMP.extra = SMP.extra.filter(x => x.course !== k);
    smpChanged();
  }
});
document.addEventListener("change", function(ev){
  const el = ev.target; if(!el.closest || !el.closest("#fSmList")) return;
  const a = el.dataset.smp, k = el.dataset.k;
  if(a === "book"){
    if(el.checked){ SMP.sel[k] = SMP.sel[k] || new Set(); SMP.mode[k] = SMP.mode[k] || "whole"; }
    else { delete SMP.sel[k]; delete SMP.mode[k]; }
    smpChanged();
  } else if(a === "lesson"){
    const set = SMP.sel[k] || (SMP.sel[k] = new Set()), i = Number(el.value);
    if(el.checked) set.add(i); else set.delete(i);
    smpChanged();
  }
});
