/* calendars-sync.v1.js — the calendar page (demo) keeps the CLASS DAYS and the WEEKLY OFF in step.
   Loaded by portal/demo/classes/calendars.html after its main script, with calsync.v1.js.

   · A strip at the top: the class days (from the attendance) and the weekly off they give.
   · Each running calendar: "✓ In step with the class days", or "⚠ Weekly off differs" + Fix.
   · A NEW calendar starts with the weekly off of the class days.
   · Editing the weekly off of a running calendar: before saving, one clear box —
       "Change the class days too" → the class days change (teacher page, attendance, Academic
         Service follow), this calendar saves, the other running calendars follow from today;
       "Keep the class days"       → the weekly off goes back to the class days; nothing is saved;
       Cancel                      → back to the editor.
     So a slip of the finger can never leave the calendar and the class disagreeing unnoticed.
   PUBLISHED FILES ARE IMMUTABLE — create calendars-sync.v2.js to change this. */
(function(){
"use strict";
const CS = window.CalSync;
if(!CS){ console.error("calendars-sync.v1.js needs calsync.v1.js"); return; }
const esc = s => escapeHtml(s == null ? "" : String(s));
const P = { plan: undefined, err: "", key: "", okSave: false, follow: null, busy: false };
const dayChips = ds => ds.map(d => CS.short(d).slice(0, 2)).join(" · ");

/* ---- the class behind this sheet ---- */
async function loadPlan(force){
  if(!classInfo) return;
  const key = (classInfo.studentId || "") + "|" + (classInfo.course || "");
  if(!force && P.key === key && P.plan !== undefined) return;
  P.key = key;
  const r = await CS.planOf(classInfo.studentId || "", classInfo.course || "").catch(err => ({ error: String(err && err.message || err) }));
  P.plan = r.plan || null; P.err = r.error || "";
}
function classOff(){ return P.plan ? CS.offOf(P.plan.days || []) : null; }
function running(c){ return c && c.active !== false && CS.endOf(c) >= CS.today(); }

/* ---- the list: strip + badges ---- */
const _render = renderList;
renderList = function(){
  _render();
  decorate();
  if(P.plan === undefined || (classInfo && P.key !== (classInfo.studentId || "") + "|" + (classInfo.course || "")))
    loadPlan(false).then(() => { decorate(); afterSave(); });
  else afterSave();
};
function decorate(){
  let strip = document.getElementById("csStrip");
  if(!strip){ strip = document.createElement("div"); strip.id = "csStrip"; strip.className = "cs-strip"; const list = $("calList"); list.parentNode.insertBefore(strip, list); }
  if(P.plan === undefined){ strip.innerHTML = '<span class="cs-k">Class days</span><span class="cs-v cs-wait">Reading the class…</span>'; return; }
  if(!P.plan){
    strip.innerHTML = `<span class="cs-k">Class days</span><span class="cs-v cs-none">${esc(P.err || "No running class in the attendance for this sheet")}</span>`;
    return;
  }
  const off = classOff();
  strip.innerHTML = `<span class="cs-k">Class days</span>
    <span class="cs-days">${CS.WK.map(d => `<i class="${(P.plan.days || []).map(CS.short).indexOf(d) >= 0 ? "on" : ""}">${d.slice(0, 2)}</i>`).join("")}</span>
    <span class="cs-v">Weekly off <b>${esc(off.map(x => x.slice(0, 3)).join(", ") || "none")}</b>${P.plan.testCopy ? ' · <em class="cs-tc">Test copy</em>' : ""}</span>
    <small class="cs-h">Change a running calendar's weekly off and the class days change with it — you will be asked first.</small>`;
  (calendars || []).forEach(c => {
    const btn = document.querySelector('#calList button[data-act="edit"][data-id="' + CSS.escape(c.calendarId) + '"]');
    const card = btn && btn.closest(".cal"); if(!card) return;
    const meta = card.querySelector(".cal-meta"); if(!meta) return;
    const old = meta.querySelector(".cs-badge"); if(old) old.remove();
    if(!running(c)) return;
    const ok = CS.sameSet(c.weeklyOff, off), b = document.createElement("span");
    b.className = "cs-badge " + (ok ? "ok" : "bad");
    b.innerHTML = ok ? "✓ In step with the class days"
      : `⚠ Weekly off differs from the class days (${esc(dayChips(P.plan.days || []))}) <button type="button" class="cs-fix" data-cs="fix" data-id="${esc(c.calendarId)}">Fix</button>`;
    meta.appendChild(document.createElement("br")); meta.appendChild(b);
  });
}
/* a save that changed the class days: the other running calendars follow */
async function afterSave(){
  if(!P.follow || P.busy) return;
  const f = P.follow; P.follow = null; P.busy = true;
  try{
    const r = await CS.follow(classId, f.days, { except: f.except });
    if(r.updated || r.split){ toast((r.updated + r.split) + " more calendar" + (r.updated + r.split === 1 ? "" : "s") + " now follow the new class days from today"); load(); }
  }catch(err){ toast(String(err && err.message || err), true); }
  finally{ P.busy = false; }
}

/* ---- Fix: the calendar takes the class days' weekly off ---- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest('[data-cs="fix"]'); if(!b || !P.plan) return;
  ev.stopPropagation();
  const c = calendars.find(x => x.calendarId === b.dataset.id); if(!c) return;
  b.disabled = true; b.textContent = "Fixing…";
  try{
    const t = CS.today();
    if(CS.startOf(c) >= t) await saveCalendarApi(Object.assign(base(c), { weeklyOff: classOff() })).then(chk);
    else await CS.follow(classId, P.plan.days || [], {});
    toast("“" + c.name + "” follows the class days now");
    load();
  }catch(err){ b.disabled = false; b.textContent = "Fix"; toast(String(err && err.message || err), true); }
}, true);
function base(c){ return { action: "updateCalendar", calendarId: c.calendarId, classId: classId, name: c.name, startDate: CS.startOf(c), days: +c.days || 1,
  weeklyOff: c.weeklyOff || [], links: (c.links || []).length ? c.links : ["#"], active: c.active !== false, position: "end", relativeTo: "" }; }
function chk(out){ if(!out || out.result !== "success") throw new Error((out && out.error) || "Not saved"); return out; }

/* ---- the editor: a new calendar starts with the class days; a live line says if it matches ---- */
const _open = openForm;
openForm = function(c){
  _open(c);
  if(!c && P.plan) buildDowChips(classOff());
  P.okSave = false;
  line();
};
function line(){
  let el = document.getElementById("csLine");
  const row = $("dowRow"); if(!row) return;
  if(!el){ el = document.createElement("div"); el.id = "csLine"; el.className = "cs-line"; row.parentNode.insertBefore(el, row.nextSibling); }
  if(!P.plan){ el.innerHTML = ""; return; }
  const ok = CS.sameSet(getWeeklyOff(), classOff());
  el.className = "cs-line " + (ok ? "ok" : "bad");
  el.innerHTML = ok ? `✓ Same as the class days (${esc(dayChips(P.plan.days || []))})`
    : `⚠ The class meets ${esc(dayChips(P.plan.days || []))}. Saving this asks whether the class days change too. <button type="button" class="cs-fix" data-cs="back">Use the class days</button>`;
}
document.addEventListener("click", ev => {
  if(ev.target.closest("#dowRow .dow")) setTimeout(line, 0);
  const b = ev.target.closest('[data-cs="back"]'); if(b){ ev.stopPropagation(); buildDowChips(classOff()); line(); if(typeof paintEndLine === "function") paintEndLine(); if(typeof updateRotateNote === "function") updateRotateNote(); }
});

/* ---- before saving: a running calendar whose weekly off no longer matches ---- */
function formEnd(){ const s = $("fStart").value, n = Math.max(1, parseInt($("fDays").value, 10) || 1); return s ? CS.endOf({ startDate: s, days: n }) : ""; }
document.addEventListener("click", ev => {
  if(!ev.target.closest("#formSaveBtn") || P.okSave || !P.plan) return;
  const off = getWeeklyOff();
  if(CS.sameSet(off, classOff())) return;                          // in step: save as usual
  if($("fActive").value !== "true" || formEnd() < CS.today()) return;   // not running: the class is not touched
  ev.preventDefault(); ev.stopImmediatePropagation();
  ask(CS.daysOf(off));
}, true);

function ensureAsk(){
  if(document.getElementById("csAsk")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "csAsk";
  d.innerHTML = `<div class="modal cs-ask" role="dialog" aria-modal="true" aria-labelledby="csAskT"><div class="modal-head"><h3 id="csAskT">Change the <span class="accent">class days</span> too?</h3>
    <p>The calendar and the class must agree, or the teacher and the attendance show the wrong days.</p></div>
    <div class="modal-body" id="csAskB"></div>
    <div class="modal-foot cs-askf"><button class="btn-outline" data-ask="cancel">Cancel</button>
      <button class="btn-outline" data-ask="keep">Keep the class days</button>
      <button class="btn-solid" data-ask="change">Change the class days</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", onAsk);
}
let ASK = null;
function ask(newDays){
  ensureAsk();
  ASK = { days: newDays };
  const was = P.plan.days || [];
  const box = document.getElementById("csAskB");
  if(!newDays.length){
    box.innerHTML = '<p class="cs-warn">Every day is a weekly off. A class needs at least one class day.</p>';
    document.querySelector('#csAsk [data-ask="change"]').disabled = true;
  } else {
    document.querySelector('#csAsk [data-ask="change"]').disabled = false;
    box.innerHTML = `<div class="cs-cmp">
        <div><span class="cs-k">Now</span><span class="cs-days">${CS.WK.map(d => `<i class="${was.map(CS.short).indexOf(d) >= 0 ? "on" : ""}">${d.slice(0, 2)}</i>`).join("")}</span></div>
        <span class="cs-arrow" aria-hidden="true">→</span>
        <div><span class="cs-k">New</span><span class="cs-days new">${CS.WK.map(d => `<i class="${newDays.indexOf(d) >= 0 ? "on" : ""}${(newDays.indexOf(d) >= 0) !== (was.map(CS.short).indexOf(d) >= 0) ? " ch" : ""}">${d.slice(0, 2)}</i>`).join("")}</span></div></div>
      <ul class="cs-list"><li>The <b>class</b> changes to ${esc(newDays.join(" · "))}: the teacher page, the attendance and Academic Service follow.</li>
        <li>This calendar saves as you set it. The other running calendars follow <b>from today</b>; past days stay as they were.</li></ul>`;
  }
  openModal("csAsk");
}
async function onAsk(ev){
  const b = ev.target.closest("[data-ask]"); if(ev.target.id === "csAsk"){ closeModal("csAsk"); return; } if(!b || b.disabled) return;
  const a = b.dataset.ask;
  if(a === "cancel"){ closeModal("csAsk"); return; }
  if(a === "keep"){ closeModal("csAsk"); buildDowChips(classOff()); line(); if(typeof paintEndLine === "function") paintEndLine(); toast("Weekly off set back to the class days — check and Save"); return; }
  if(a === "change"){
    b.disabled = true; b.textContent = "Changing…";
    try{
      const days = await CS.setDays(P.plan.id, ASK.days);
      P.plan.days = days;
      P.follow = { days: days, except: editingId || "__new__" };
      closeModal("csAsk");
      P.okSave = true;
      $("formSaveBtn").click();            // the page's own save, now in step
      P.okSave = false;
      toast("Class days changed to " + days.join(" · "));
    }catch(err){ toast(String(err && err.message || err), true); }
    finally{ b.disabled = false; b.textContent = "Change the class days"; }
  }
}
})();
