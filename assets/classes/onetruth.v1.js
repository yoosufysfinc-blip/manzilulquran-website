/* onetruth.v1.js — the demo admin class sheet keeps ONE TRUTH with its classes (needs clsdemo-onetruth-v1.sql).
   Loaded on /portal/demo/classes/ after newclass.v5.js and calpanel.v2.js, before motion.v1.js.

   · THE SHEET FOLLOWS ITS CLASS — a class sheet's student name, class time and joining date come from the class
     (the server keeps them in step; this page asks it to refresh every sheet when the list opens). In Edit they
     are shown, not typed; the Student ID never changes once the sheet belongs to a student.
   · CLASS TIME — "Class time" on an individual sheet (and in All class times) changes the CLASS: the attendance,
     the teacher page and Academic Service all get the new time; the sheet follows. Batches keep their own time.
   · ONE ON/OFF — switching a sheet Inactive / Active in Edit asks once, then the class goes with it.
     Deleting a sheet whose class still runs asks what to do with the class; a test sheet goes with its class.
   · CALENDARS — "Needs attention" offers the next month's calendars for every running class (the same as the
     attendance's month set-up), so there is one place for many and the Calendar button for one.
   PUBLISHED FILES ARE IMMUTABLE — create onetruth.v2.js to change this. */
(function(){
"use strict";
const A = window.TA_API;
if(!A){ console.error("onetruth.v1.js needs teachers-admin.v12.js first"); return; }
const { TA, planOfSheet, sameCourse, planRunning, reloadAs, clsAfterLoad, attQuiet } = A;
const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? "" : String(s));
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const ONE = { syncAt: 0, syncP: null, missing: false, edit: null };
const today = () => istTodayISO();
function addD(ds, n){ const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function fmt(ds){ try{ return new Date(ds + "T00:00:00Z").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); }catch(x){ return ds; } }
function sheetById(id){ return (typeof classes !== "undefined" ? classes : []).find(c => c["Class ID"] === id) || null; }
function sid(c){ return String((c && (c["mqId"] || c["Student ID"])) || "").toUpperCase(); }
function isTestPlan(p){ return !!(p && (p.testCopy || p.testStudent || /^TEST-/i.test(String(p.studentId || "")))); }
/* the class behind a sheet: the running one (as the list shows), else the student's latest — an inactive class too */
function classOf(c){
  if(!c || !TA.loaded) return null;
  const run = planOfSheet(c); if(run) return run;
  const ps = (TA.plans || []).filter(p => String(p.studentId || "").toUpperCase() === sid(c));
  if(!ps.length) return null;
  return ps.slice().sort((a, b) => (sameCourse(b.course, c["Course"]) - sameCourse(a.course, c["Course"])) || String(b.startDate || "").localeCompare(String(a.startDate || "")))[0];
}
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

/* =================================================================
   THE SHEET FOLLOWS ITS CLASS — refresh every sheet when the list opens (then at most every 5 minutes)
   ================================================================= */
async function syncSheets(){
  ONE.tryAt = Date.now();
  const out = await mqAdminFn("sheet_sync", {}).catch(() => null);
  if(out && out.missing) ONE.missing = true;
  if(out && out.result === "success") ONE.syncAt = Date.now();
  return out;
}
const due = () => !ONE.missing && !ONE.syncP && Date.now() - ONE.syncAt > 300000 && Date.now() - (ONE.tryAt || 0) > 20000 && typeof mqAdminFn === "function";
const _load = window.loadClasses;
if(typeof _load === "function"){
  loadClasses = async function(){
    if(due()) ONE.syncP = syncSheets().finally(() => { ONE.syncP = null; });
    if(ONE.syncP) await Promise.race([ONE.syncP, wait(2500)]);
    return _load.apply(this, arguments);
  };
}

/* the list may have loaded before this file: refresh once now, and show what moved */
setTimeout(async () => {
  if(!due()) return;
  ONE.syncP = syncSheets().finally(() => { ONE.syncP = null; });
  const out = await ONE.syncP;
  if(out && out.result === "success" && out.changed > 0 && typeof classes !== "undefined" && classes.length) loadClasses();
}, 400);

/* =================================================================
   CLASS TIME — an individual sheet's time is its class's time
   ================================================================= */
async function classTime(classId, time){
  const p = classOf(sheetById(classId));
  if(!p || ONE.missing) return null;
  const out = await mqAdminFn("class_time", { planId: p.id, time: time || "" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(out && out.missing){ ONE.missing = true; return null; }
  if(out && out.result === "success") p.time = out.classTime;
  return out || { result: "error", error: "Not saved" };
}
if(typeof setClassTimeApi === "function"){
  const _one = setClassTimeApi;
  setClassTimeApi = async function(classId, time){
    const out = await classTime(classId, time);
    if(out === null) return _one(classId, time);
    if(out.result === "success"){ attQuiet("refresh"); return { result: "success", classTime: out.classTime }; }
    return out;
  };
}
if(typeof setClassTimesApi === "function"){
  const _many = setClassTimesApi;
  setClassTimesApi = async function(entries){
    const own = [], rest = [];
    (entries || []).forEach(x => (classOf(sheetById(x.classId)) && !ONE.missing ? own : rest).push(x));
    let saved = 0; const refused = [];
    for(const x of own){
      const out = await classTime(x.classId, x.classTime);
      if(out === null) rest.push(x); else if(out.result === "success") saved++; else refused.push(x.classId);
    }
    if(rest.length){
      const o = await _many(rest);
      if(!o || o.result !== "success") return own.length ? { result: "success", saved: saved, refused: refused.concat(rest.map(x => x.classId)) } : o;
      saved += +o.saved || 0; (o.refused || []).forEach(r => refused.push(r));
    }
    if(own.length) attQuiet("refresh");
    return { result: "success", saved: saved, refused: refused };
  };
}
if(typeof openTimeModal === "function"){
  const _tm = openTimeModal;
  openTimeModal = function(id, kind){
    _tm(id, kind);
    const p = kind === "batch" ? null : classOf(sheetById(id)), f = $("timeFor");
    if(f && p) f.textContent += " · the class time — attendance and teacher page follow";
  };
}

/* =================================================================
   EDIT — what comes from the class is shown, not typed; the Student ID stays
   ================================================================= */
const LOCK = [["fName", "name"], ["fClassTime", "time"], ["fJoinDate", "join"]];
if(typeof openForm === "function"){
  const _openForm = openForm;
  openForm = function(c){
    _openForm(c);
    const p = c ? classOf(c) : null, st = p ? (TA.students || {})[String(p.studentId || "").toUpperCase()] : null;
    ONE.edit = c ? { c: c, plan: p, status: c["Status"] || "Active" } : null;
    let note = $("otNote");
    const box = $("fName") && $("fName").closest(".modal-body");
    if(!note && box){ note = document.createElement("div"); note.id = "otNote"; note.className = "ot-note"; box.insertBefore(note, box.firstChild); }
    const idLock = !!(c && sid(c));
    const sidEl = $("fStudentId");
    if(sidEl){ sidEl.readOnly = idLock; sidEl.closest(".field").classList.toggle("ot-lock", idLock); }
    LOCK.forEach(([id, k]) => {
      const el = $(id); if(!el) return;
      el.readOnly = !!p; el.closest(".field").classList.toggle("ot-lock", !!p);
      if(!p) return;
      if(k === "name" && st && st.name) el.value = st.name;
      if(k === "time" && /^\d{2}:\d{2}$/.test(p.time || "")) el.value = p.time;
      if(k === "join" && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate || "")) el.value = p.startDate;
    });
    if(note){
      note.hidden = !(p || idLock);
      note.innerHTML = p ? `<b>From the class ${esc(p.id)}</b><span>The name, class time and joining date come from the class — change them in the attendance (Edit everything) or with the Class time button. ${isTestPlan(p) ? "Test class · only in this demo." : ""}</span>`
        : idLock ? `<b>Student ${esc(sid(c))}</b><span>The Student ID stays with this student.</span>` : "";
    }
  };
}

/* =================================================================
   ONE ON/OFF — the sheet's Status and its class go together
   ================================================================= */
function ensureAsk(){
  if($("otAsk")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "otAsk";
  d.innerHTML = `<div class="modal nc nc-sm" role="dialog" aria-modal="true" aria-labelledby="otAskT"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head"><h3 id="otAskT"></h3><p id="otAskP"></p></div><div class="modal-body nc-body" id="otAskB"></div>
    <div class="modal-foot nc-foot" id="otAskF"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => {
    if(ev.target === d){ answer(null); return; }
    const ch = ev.target.closest("[data-otday]"); if(ch){ const i = $("otLast"); if(i) i.value = ch.dataset.otday; d.querySelectorAll("[data-otday]").forEach(x => x.classList.toggle("on", x === ch)); return; }
    const b = ev.target.closest("[data-ot]"); if(!b || b.disabled) return;
    if(b.dataset.ot === "no") answer(null);
    else answer({ how: b.dataset.ot, lastDay: ($("otLast") && $("otLast").value) || today(), reason: ($("otWhy") && $("otWhy").value.trim()) || "" });
  });
}
let ASK = null;
function answer(v){ closeModal("otAsk"); const r = ASK; ASK = null; if(r) r(v); }
function ask(o){
  ensureAsk();
  $("otAskT").innerHTML = o.title; $("otAskP").textContent = o.sub || "";
  $("otAskB").innerHTML = o.body || "";
  $("otAskF").innerHTML = `<button class="btn-ghost" data-ot="no">Cancel</button>` + o.buttons.map(([k, l, cls]) => `<button class="${cls || "btn-solid"}" data-ot="${k}">${l}</button>`).join("");
  openModal("otAsk");
  return new Promise(r => { ASK = r; });
}
function lastDayBox(p){
  const t = today(), y = addD(t, -1);
  return `<div class="nc-f"><label for="otLast">Last class day</label>
      <div class="nc-chips sm"><button type="button" class="nc-chip sm on" data-otday="${t}">Today</button><button type="button" class="nc-chip sm" data-otday="${y}">Yesterday</button></div>
      <input type="date" class="nc-in" id="otLast" value="${t}" min="${esc(p.startDate || "")}" /></div>
    <div class="nc-f"><label for="otWhy">Reason <small>optional</small></label><input class="nc-in" id="otWhy" placeholder="e.g. finished, moved, fees" autocomplete="off" /></div>`;
}
async function onoff(p, on, a){
  const out = await mqAdminFn("class_onoff", { planId: p.id, on: on, lastDay: a.lastDay, reason: a.reason }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(out && out.missing){ ONE.missing = true; return { result: "missing" }; }
  if(out && out.result === "success"){
    if(on){ p.status = "Active"; p.endDate = ""; } else { p.status = "Stopped"; p.endDate = out.lastDay || a.lastDay; }
    attQuiet("refresh");
  }
  return out || { result: "error", error: "Not saved" };
}
const saveBtn = $("formSaveBtn");
if(saveBtn && typeof saveBtn.onclick === "function"){
  const _save = saveBtn.onclick;
  saveBtn.onclick = async function(ev){
    const E = ONE.edit, now = $("fStatus") ? $("fStatus").value : "";
    if(!E || !E.c || ONE.missing || now === E.status) return _save.call(this, ev);
    const p = classOf(E.c);
    if(!p) return _save.call(this, ev);
    const running = planRunning(p, today()) && !p.endDate, nm = E.c["Student Name"] || p.studentId;
    if(now === "Inactive" && planRunning(p, today())){
      const a = await ask({ title: 'Make the <span class="accent">class</span> inactive too?', sub: nm + " · " + (p.course || "") + " · " + p.id,
        body: `<p class="nc-lead">One switch: the class sheet and its class go together. The sheet turns off now; the attendance and the teacher page keep the class until its last day.</p>${lastDayBox(p)}`,
        buttons: [["both", "Make both inactive", "btn-solid danger"]] });
      if(!a){ $("fStatus").value = E.status; return; }
      const out = await onoff(p, false, a);
      if(out.result === "missing") return _save.call(this, ev);
      if(out.result !== "success"){ toast(out.error || "Not saved", true); return; }
      toast("Class inactive after " + fmt(out.lastDay || a.lastDay) + " · the sheet is off");
    }
    else if(now === "Active" && !running){
      const a = await ask({ title: 'Make the <span class="accent">class</span> active again too?', sub: nm + " · " + (p.course || "") + " · " + p.id,
        body: `<p class="nc-lead">${p.endDate ? "The class was inactive after " + esc(fmt(p.endDate)) + "." : "The class is inactive."} Both come back: the attendance and the teacher page show it again, with no last day.</p>`,
        buttons: [["both", "Make both active"]] });
      if(!a){ $("fStatus").value = E.status; return; }
      const out = await onoff(p, true, a);
      if(out.result === "missing") return _save.call(this, ev);
      if(out.result !== "success"){ toast(out.error || "Not saved", true); return; }
      toast("The class is active again");
    }
    E.status = now;
    const r = await _save.call(this, ev);
    try{ await reloadAs(); }catch(x){} clsAfterLoad();
    return r;
  };
}
if(typeof askDelete === "function"){
  const _del = askDelete;
  askDelete = async function(c){
    const p = TA.loaded ? planOfSheet(c) : null;
    if(!p) return _del(c);
    if(isTestPlan(p)){ if(window.NC && NC.removeClass) return NC.removeClass(p.id); return _del(c); }
    const nm = c["Student Name"] || p.studentId;
    const a = await ask({ title: 'Delete the <span class="accent">class sheet</span>?', sub: nm + " · " + (c["Student ID"] || "") + " · the share link stops working",
      body: `<p class="nc-lead">${esc(nm)}'s class (${esc(p.course || "")}, ${esc(p.id)}) still runs in the attendance.</p>${lastDayBox(p)}
        <p class="nc-note"><b>Delete both</b>: the sheet goes and the class is inactive after the last class day. <b>Sheet only</b>: the class keeps running and shows under “Classes without a class sheet”.</p>`,
      buttons: [["only", "Sheet only", "btn-ghost"], ["both", "Delete both", "btn-solid danger"]] });
    if(!a) return;
    if(a.how === "both"){
      const out = await onoff(p, false, a);
      if(out.result !== "success" && out.result !== "missing"){ toast(out.error || "The class was not changed", true); return; }
    }
    try{
      const data = await deleteClassApi(c["Class ID"]);
      if(data.result !== "success") throw new Error(data.error || "Delete failed");
      toast(a.how === "both" ? "Class sheet deleted · the class is inactive after " + fmt(a.lastDay) : "Class sheet deleted · the class still runs");
      try{ await reloadAs(); }catch(x){}
      loadClasses();
    }catch(err){ toast(err.message, true); }
  };
}

/* =================================================================
   CALENDARS — many at once from "Needs attention"
   ================================================================= */
function calMonth(){ const t = today(); const m = t.slice(0, 7); if(+t.slice(8) < 20) return m;
  let [y, mo] = m.split("-").map(Number); mo++; if(mo > 12){ mo = 1; y++; } return y + "-" + String(mo).padStart(2, "0"); }
function paintCalBtn(){
  const box = $("alerts"); if(!box) return;
  let b = $("otCal");
  if(!box.classList.contains("show") || !window.NC || !NC.monthCalendars){ if(b) b.hidden = true; return; }
  const m = calMonth(), label = MONTHS[+m.slice(5) - 1] + " calendars for every class";
  if(!b){ b = document.createElement("button"); b.type = "button"; b.id = "otCal"; b.className = "ot-cal";
    b.addEventListener("click", () => NC.monthCalendars(b.dataset.m, false));
    const rows = $("alertRows"); if(rows) rows.parentNode.insertBefore(b, rows); else box.appendChild(b); }
  b.hidden = false; b.dataset.m = m;
  b.innerHTML = `<span aria-hidden="true">＋</span><b>${esc(label)}</b><small>the same links · classes that have one are left as they are</small>`;
}
if(typeof renderAlerts === "function"){
  const _ra = renderAlerts;
  renderAlerts = function(){ const r = _ra.apply(this, arguments); try{ paintCalBtn(); }catch(x){} return r; };
}

/* the attendance changed a student or switched a class on/off: the server moved the sheet — show it */
window.addEventListener("message", async function(ev){
  if(ev.origin !== location.origin || !ev.data || ev.data.type !== "mq-att") return;
  if(ev.data.ev !== "student-edited" && ev.data.ev !== "plan-stopped") return;
  clearTimeout(ONE.msgT);
  const back = ev.data.ev === "plan-stopped" && !ev.data.endDate;
  ONE.msgT = setTimeout(async () => { try{ await reloadAs(); }catch(x){} try{ await loadClasses(); }catch(x){} clsAfterLoad();
    if(back) toast("Active again — its class sheet is on"); }, 700);
});

window.ONE_TRUTH = { classOf: classOf, sync: syncSheets };
})();
