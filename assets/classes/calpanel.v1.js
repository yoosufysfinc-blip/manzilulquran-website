/* calpanel.v1.js — THE CALENDAR INSIDE THE CLASS SHEET (demo admin, individual classes).
   Loaded after newclass.v2.js on /portal/demo/classes/. Needs calsync.v1.js, api.v10.js, engine.v1.js.

   One panel instead of the separate calendar page — only what is needed, always in step with the class:
   · CLASS DAYS on top — change them here: the class (attendance, teacher page, Academic Service) and the
     calendars change together, the calendars from today. The weekly off is never set by hand.
   · NOW: this month's calendar — dates, class days left, Meet links.
       Meet link → this and the coming calendars use it.   Length → month end, ±7 days, or a date (≤ 40 days).
   · NEXT: calendars still to come — Remove (only a calendar that has not started).   Make next month.
   · PAST: finished calendars, read only.
   · No separate deactivate / delete / order: the calendar goes with its class sheet — switching the sheet off
     closes it for the student; deleting the sheet deletes its calendars too.
   · Calendar buttons, links and old calendar-page addresses of an INDIVIDUAL class open this panel
     (?cal=<Class ID>); batches keep the calendar page.
   · "Test copy" on a class row: tap to remove the copy.  Attendance → student menu → Calendar opens it too.
   PUBLISHED FILES ARE IMMUTABLE — create calpanel.v2.js to change this. */
(function(){
"use strict";
const A = window.TA_API, CS = window.CalSync;
if(!A || !CS){ console.error("calpanel.v1.js needs teachers-admin.v9.js and calsync.v1.js"); return; }
const esc = s => escapeHtml(s == null ? "" : String(s));
const MAXD = 40;
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const FULLM = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const today = () => CS.today();
const addD = (ds, n) => { const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const span = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1;
const monthEnd = ds => { const d = new Date(ds.slice(0, 7) + "-01T00:00:00Z"); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const fmt = (ds, y) => { const d = new Date(ds + "T00:00:00Z"); return d.getUTCDate() + " " + MON[d.getUTCMonth()] + (y ? " " + d.getUTCFullYear() : ""); };
const dowOf = ds => CS.WK[(new Date(ds + "T00:00:00Z").getUTCDay() + 6) % 7];
const startOf = c => CS.startOf(c), endOf = c => CS.endOf(c);
const linksOf = c => (Array.isArray(c.links) ? c.links : []).filter(x => x && x !== "#");
const offShort = c => (c.weeklyOff || []).map(CS.short);
function classDaysIn(c, from){
  let n = 0; const off = offShort(c), e = endOf(c);
  for(let d = from && from > startOf(c) ? from : startOf(c); d <= e; d = addD(d, 1)) if(off.indexOf(dowOf(d)) < 0) n++;
  return n;
}
const cleanLink = v => { v = String(v || "").trim(); if(!v) return ""; return /^https?:\/\//i.test(v) ? v : "https://" + v.replace(/^\/+/, ""); };
const linkOk = v => /^https:\/\/[^\s.]+\.[^\s]+$/i.test(v);

const P = { c: null, cals: [], plan: undefined, err: "", edit: "", busy: false, days: null, links: [], end: "" };
function cls(id){ return (typeof classes !== "undefined" ? classes : []).find(x => x["Class ID"] === id) || null; }

/* ---------------- the panel ---------------- */
function ensure(){
  if(document.getElementById("cpModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back cp-back"; d.id = "cpModal";
  d.innerHTML = `<div class="modal nc cp" role="dialog" aria-modal="true" aria-labelledby="cpTitle"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head cp-head"><h3 id="cpTitle">Calendar</h3><p id="cpSub"></p>
      <div class="cp-top"><a class="cp-mini" id="cpView" target="_blank" rel="noopener">Student view</a><button type="button" class="cp-x" data-cp="close" aria-label="Close">✕</button></div></div>
    <div class="modal-body cp-body" id="cpBody"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d && !P.busy) close(); else onClick(ev); });
  d.addEventListener("input", onInput);
  d.addEventListener("change", onInput);
}
function close(){ closeModal("cpModal"); const u = new URL(location.href); if(u.searchParams.has("cal")){ u.searchParams.delete("cal"); history.replaceState(null, "", u.toString()); } }
async function open(classId){
  const c = cls(classId);
  if(!c){ toast("Class sheet not found", true); return; }
  ensure();
  Object.assign(P, { c: c, cals: [], plan: undefined, err: "", edit: "", busy: false, days: null, links: [], end: "" });
  document.getElementById("cpTitle").innerHTML = esc(c["Student Name"]) + ' · <span class="accent">calendar</span>';
  document.getElementById("cpSub").textContent = [c["Student ID"], c["Course"], c["Class Time"] ? formatTime(c["Class Time"]) + " IST" : ""].filter(Boolean).join(" · ");
  const v = document.getElementById("cpView"); v.href = shareUrl(c);
  paint(true);
  openModal("cpModal");
  await load();
}
async function load(){
  const id = P.c["Class ID"];
  const [have, pl] = await Promise.all([
    fetchClassAdmin(id).catch(err => ({ result: "error", error: String(err && err.message || err) })),
    P.plan === undefined ? CS.planOf(String(P.c["mqId"] || P.c["Student ID"] || ""), P.c["Course"] || "").catch(() => ({ plan: null })) : Promise.resolve({ plan: P.plan, error: P.err })
  ]);
  if(!have || have.result !== "success"){ P.err = (have && have.error) || "Could not read the calendars"; P.cals = []; }
  else { P.cals = (have.calendars || []).filter(c => c && startOf(c)).sort((a, b) => startOf(a) < startOf(b) ? -1 : 1); }
  P.plan = pl.plan || null; if(pl.error) P.err = P.err || pl.error;
  paint(false);
}

/* which calendar is which */
function sort(){
  const t = today();
  const live = P.cals.filter(c => c.active !== false);
  const now = live.find(c => startOf(c) <= t && endOf(c) >= t) || null;
  const next = live.filter(c => startOf(c) > t);
  const past = P.cals.filter(c => c !== now && next.indexOf(c) < 0);
  return { now: now, next: next, past: past.reverse(), last: live.filter(c => endOf(c) >= t).sort((a, b) => endOf(a) < endOf(b) ? 1 : -1)[0] || null };
}
function classDays(){
  if(P.plan && (P.plan.days || []).length) return P.plan.days.map(CS.short);
  const g = sort(), c = g.now || g.next[0] || g.past[0];
  return c ? CS.daysOf(c.weeklyOff || []) : [];
}

function paint(loading){
  const b = document.getElementById("cpBody"); if(!b) return;
  if(loading){ b.innerHTML = `<div class="cp-sk">${[0, 1, 2].map(i => `<span style="--i:${i}"></span>`).join("")}</div>`; return; }
  const g = sort(), days = classDays();
  let h = "";
  /* class days */
  const ed = P.edit === "days", sel = ed ? P.days : days;
  h += `<section class="cp-sec cp-days${ed ? " ed" : ""}" style="--i:0"><div class="cp-sh"><b>Class days</b>
      ${ed ? "" : `<button type="button" class="cp-mini" data-cp="days">Change</button>`}</div>
    <div class="cp-wk">${CS.WK.map(d => `<button type="button" class="cp-d${sel.indexOf(d) >= 0 ? " on" : ""}${ed && (sel.indexOf(d) >= 0) !== (days.indexOf(d) >= 0) ? " ch" : ""}" data-cp="${ed ? "dtog" : "days"}" data-v="${d}"${ed ? ` aria-pressed="${sel.indexOf(d) >= 0}"` : ' tabindex="-1"'}>${d.slice(0, 2)}</button>`).join("")}</div>
    <small class="cp-h">${P.plan ? "Weekly off " + esc(CS.offOf(sel).map(x => x.slice(0, 3)).join(", ") || "none") + (P.plan.testCopy ? " · Test copy" : "")
      : esc(P.err && P.plan === null ? P.err : "No running class in the attendance — these days come from the calendar")}</small>
    ${ed ? `<div class="cp-note">${sel.length ? (P.plan ? "The <b>class</b> changes too — attendance, teacher page and Academic Service follow. " : "") + "The calendars follow <b>from today</b>; past days stay as they were." : '<span class="cp-err">A class needs at least one class day.</span>'}</div>
      <div class="cp-acts"><button type="button" class="btn-ghost" data-cp="cancel">Cancel</button><button type="button" class="btn-solid" data-cp="dsave"${sel.length && !CS.sameSet(sel, days) ? "" : " disabled"}>Save days</button></div>` : ""}
  </section>`;
  /* now */
  if(g.now) h += card(g.now, "now", 1);
  else if(!g.next.length) h += `<section class="cp-sec cp-empty" style="--i:1"><div class="cp-sh"><b>No calendar running</b></div>
      <p>The student sees no class days. Make one from ${esc(fmt(today()))} to the end of the month.</p>
      ${P.edit === "make" ? linkEditor("make") : `<div class="cp-acts"><button type="button" class="btn-solid" data-cp="make">Make calendar</button></div>`}</section>`;
  /* next */
  if(g.next.length) h += `<section class="cp-sec" style="--i:2"><div class="cp-sh"><b>Next</b></div>${g.next.map((c, i) => g.now || i ? row(c, true) : card(c, "next", 2)).join("")}</section>`;
  const nm = nextMonthPlan(g);
  if(nm && g.now) h += `<div class="cp-mk" style="--i:3"><button type="button" class="btn-outline" data-cp="nextm">+ ${esc(FULLM[+nm.start.slice(5, 7) - 1])} calendar <small>${esc(fmt(nm.start))} – ${esc(fmt(nm.end))}</small></button></div>`;
  /* past */
  if(g.past.length) h += `<details class="cp-past" style="--i:4"><summary>Past · ${g.past.length}</summary>${g.past.map(c => row(c, false)).join("")}</details>`;
  if(P.err && P.plan !== null && !P.cals.length) h += `<p class="cp-err">${esc(P.err)}</p>`;
  b.innerHTML = h;
}
function card(c, kind, i){
  const t = today(), left = classDaysIn(c, t), all = classDaysIn(c), ls = linksOf(c), match = CS.sameSet(c.weeklyOff, CS.offOf(classDays()));
  const pct = Math.max(0, Math.min(100, Math.round((span(startOf(c), t > endOf(c) ? endOf(c) : t < startOf(c) ? startOf(c) : t) / (+c.days || 1)) * 100)));
  return `<section class="cp-sec cp-now" style="--i:${i}">
    <div class="cp-sh"><b>${esc(c.name || "Calendar")}</b><em class="cp-tag ${kind}">${kind === "now" ? "Now" : "Starts " + esc(fmt(startOf(c)))}</em></div>
    <div class="cp-range"><span>${esc(fmt(startOf(c)))}</span><i style="--p:${kind === "now" ? pct : 0}%"></i><span>${esc(fmt(endOf(c), true))}</span></div>
    <div class="cp-stats"><span><b>${left}</b> class day${left === 1 ? "" : "s"} left</span><span>${all} in all · ${+c.days} days</span>
      ${match ? '<span class="cp-ok">✓ In step with the class days</span>' : `<span class="cp-bad">⚠ Weekly off differs <button type="button" class="cp-mini" data-cp="fix" data-v="${esc(c.calendarId)}">Fix</button></span>`}</div>
    <div class="cp-links">${ls.length ? ls.map((l, k) => `<a class="cp-l" href="${esc(l)}" target="_blank" rel="noopener"><i>L${k + 1}</i><span>${esc(l.replace(/^https?:\/\//, ""))}</span></a>`).join("") : '<span class="cp-err">No Meet link</span>'}</div>
    ${P.edit === "link:" + c.calendarId ? linkEditor(c.calendarId)
      : P.edit === "len:" + c.calendarId ? lenEditor(c)
      : P.edit === "rm:" + c.calendarId ? `<div class="cp-acts"><span class="cp-ask">Remove this calendar?</span><button type="button" class="btn-ghost" data-cp="cancel">No</button><button type="button" class="btn-solid danger" data-cp="rmyes" data-v="${esc(c.calendarId)}">Remove</button></div>`
      : `<div class="cp-acts"><button type="button" class="btn-outline sm" data-cp="link" data-v="${esc(c.calendarId)}">Meet link</button><button type="button" class="btn-outline sm" data-cp="len" data-v="${esc(c.calendarId)}">Length</button>${kind === "next" ? `<button type="button" class="btn-ghost sm danger" data-cp="rm" data-v="${esc(c.calendarId)}">Remove</button>` : ""}</div>`}
  </section>`;
}
function row(c, canRm){
  const off = c.active === false;
  return `<div class="cp-row${off ? " off" : ""}"><span><b>${esc(c.name || "Calendar")}</b><small>${esc(fmt(startOf(c)))} – ${esc(fmt(endOf(c), true))} · ${classDaysIn(c)} class days${off ? " · off" : ""}</small></span>
    ${canRm ? (P.edit === "rm:" + c.calendarId ? `<span class="cp-ask">Remove?<button type="button" class="cp-mini danger" data-cp="rmyes" data-v="${esc(c.calendarId)}">Yes</button><button type="button" class="cp-mini" data-cp="cancel">No</button></span>`
      : `<button type="button" class="cp-mini danger" data-cp="rm" data-v="${esc(c.calendarId)}">Remove</button>`) : ""}</div>`;
}
function linkEditor(id){
  if(!P.links.length) P.links = [""];
  return `<div class="cp-ed"><label>Meet link${P.links.length > 1 ? "s — used in turn" : ""}</label>
    ${P.links.map((l, k) => `<div class="cp-lr"><i>L${k + 1}</i><input class="nc-in" data-cpl="${k}" value="${esc(l)}" placeholder="https://meet.google.com/abc-defg-hij" inputmode="url" autocomplete="off" />${P.links.length > 1 ? `<button type="button" class="cp-mini" data-cp="ldel" data-v="${k}" aria-label="Remove link">✕</button>` : ""}</div>`).join("")}
    <button type="button" class="cp-add" data-cp="ladd">+ Another link</button>
    <small class="cp-h">${id === "make" ? "From " + esc(fmt(today())) + " to " + esc(fmt(monthEnd(today()), true)) + " · weekly off from the class days" : "This calendar and the coming ones use it."}</small>
    <span class="cp-err" id="cpLErr" role="alert"></span>
    <div class="cp-acts"><button type="button" class="btn-ghost" data-cp="cancel">Cancel</button><button type="button" class="btn-solid" data-cp="${id === "make" ? "makeyes" : "lsave"}" data-v="${esc(id)}">${id === "make" ? "Make calendar" : "Save link"}</button></div></div>`;
}
function lenEditor(c){
  const s = startOf(c), e = P.end || endOf(c), t = today();
  const opts = [["Till " + fmt(monthEnd(s)), monthEnd(s)], ["Till " + fmt(monthEnd(addD(monthEnd(s), 1))), monthEnd(addD(monthEnd(s), 1))], ["+7 days", addD(endOf(c), 7)], ["−7 days", addD(endOf(c), -7)]]
    .filter(x => span(s, x[1]) >= 1 && span(s, x[1]) <= MAXD && x[1] >= (s < t ? t : s));
  const n = span(s, e), bad = n < 1 || n > MAXD || e < (s < t ? t : s);
  return `<div class="cp-ed"><label>Ends on</label>
    <div class="cp-chips">${opts.map(o => `<button type="button" class="nc-chip sm${o[1] === e ? " on" : ""}" data-cp="lenset" data-v="${o[1]}">${esc(o[0])}</button>`).join("")}</div>
    <input type="date" class="nc-in" id="cpEnd" value="${esc(e)}" min="${esc(s < t ? t : s)}" max="${esc(addD(s, MAXD - 1))}" />
    <small class="cp-h">${bad ? '<span class="cp-err">' + (n > MAXD ? "At most " + MAXD + " days — make the next month instead" : "Pick a day from " + esc(fmt(s < t ? t : s))) + "</span>" : esc(fmt(s)) + " – " + esc(fmt(e, true)) + " · " + n + " days"}</small>
    <div class="cp-acts"><button type="button" class="btn-ghost" data-cp="cancel">Cancel</button><button type="button" class="btn-solid" data-cp="lensave" data-v="${esc(c.calendarId)}"${bad || e === endOf(c) ? " disabled" : ""}>Save length</button></div></div>`;
}
function nextMonthPlan(g){
  const last = g.last; if(!last) return null;
  if(g.next.length) return null;                                   /* the next one is already made */
  const start = addD(endOf(last), 1);
  let end = monthEnd(start);
  if(span(start, end) < 7) end = monthEnd(addD(end, 1));             /* a few days left in the month: run to the next month's end */
  if(span(start, end) > MAXD) end = addD(start, MAXD - 1);
  return { start: start, end: end, base: last };
}

/* ---------------- actions ---------------- */
function body(c, over){ return Object.assign({ action: "updateCalendar", calendarId: c.calendarId, classId: P.c["Class ID"], name: c.name, startDate: startOf(c), days: +c.days || 1,
  weeklyOff: c.weeklyOff || [], links: linksOf(c).length ? linksOf(c) : ["#"], active: c.active !== false, position: "end", relativeTo: "" }, over || {}); }
async function save(b){
  const out = await saveCalendarApi(b).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(!out || out.result !== "success") throw new Error((out && out.error) || "Not saved");
  return out;
}
async function act(fn, okMsg){
  if(P.busy) return; P.busy = true;
  document.getElementById("cpBody").classList.add("busy");
  try{ await fn(); if(okMsg) toast(okMsg); P.edit = ""; P.links = []; P.end = ""; await load(); }
  catch(err){ toast(String(err && err.message || err), true); }
  finally{ P.busy = false; const b = document.getElementById("cpBody"); if(b) b.classList.remove("busy"); }
}
function onInput(ev){
  const t = ev.target;
  if(t.dataset && t.dataset.cpl != null){ P.links[+t.dataset.cpl] = t.value; const e = document.getElementById("cpLErr"); if(e) e.textContent = ""; return; }
  if(t.id === "cpEnd" && ev.type === "change"){ P.end = t.value; paint(false); }
}
function readLinks(){ return P.links.map(cleanLink).filter(Boolean); }
function linksBad(ls){ if(!ls.length) return "Add the Meet link"; if(ls.some(l => !linkOk(l))) return "A link is not right — it should start with https://"; return ""; }
function onClick(ev){
  const b = ev.target.closest("[data-cp]"); if(!b || b.disabled || P.busy) return;
  const a = b.dataset.cp, v = b.dataset.v;
  const cal = id => P.cals.find(c => c.calendarId === id);
  if(a === "close"){ close(); return; }
  if(a === "cancel"){ P.edit = ""; P.links = []; P.end = ""; paint(false); return; }
  if(a === "days"){ P.edit = "days"; P.days = classDays().slice(); paint(false); return; }
  if(a === "dtog"){ const i = P.days.indexOf(v); if(i >= 0) P.days.splice(i, 1); else P.days.push(v); P.days = CS.WK.filter(d => P.days.indexOf(d) >= 0); paint(false); return; }
  if(a === "dsave"){ const days = P.days.slice();
    act(async () => { if(P.plan) P.plan.days = await CS.setDays(P.plan.id, days); await CS.follow(P.c["Class ID"], days); attTell(); }, "Class days: " + days.join(" · ")); return; }
  if(a === "fix"){ act(() => CS.follow(P.c["Class ID"], classDays()), "The calendar follows the class days"); return; }
  if(a === "link"){ const c = cal(v); P.edit = "link:" + v; P.links = linksOf(c).slice(); paint(false); return; }
  if(a === "make"){ P.edit = "make"; P.links = (sort().past[0] ? linksOf(sort().past[0]) : []).slice(); paint(false); return; }
  if(a === "ladd"){ P.links.push(""); paint(false); const ins = document.querySelectorAll("#cpBody [data-cpl]"); if(ins.length) ins[ins.length - 1].focus(); return; }
  if(a === "ldel"){ P.links.splice(+v, 1); paint(false); return; }
  if(a === "lsave"){ const ls = readLinks(), err = linksBad(ls); if(err){ document.getElementById("cpLErr").textContent = err; return; }
    const c0 = cal(v);
    act(async () => { for(const c of P.cals.filter(c => c.active !== false && endOf(c) >= today() && (c === c0 || startOf(c) > startOf(c0)))) await save(body(c, { links: ls })); }, "Meet link saved"); return; }
  if(a === "makeyes"){ const ls = readLinks(), err = linksBad(ls); if(err){ document.getElementById("cpLErr").textContent = err; return; }
    const s = today(), e = monthEnd(s), days = classDays();
    act(() => save({ action: "createCalendar", classId: P.c["Class ID"], name: FULLM[+s.slice(5, 7) - 1] + " Session", startDate: s, days: Math.min(MAXD, span(s, e)),
      weeklyOff: days.length ? CS.offOf(days) : [], links: ls, active: true, position: "end", relativeTo: "" }), "Calendar made"); return; }
  if(a === "len"){ P.edit = "len:" + v; P.end = endOf(cal(v)); paint(false); return; }
  if(a === "lenset"){ P.end = v; paint(false); return; }
  if(a === "lensave"){ const c = cal(v), n = span(startOf(c), P.end); act(() => save(body(c, { days: n })), "Ends " + fmt(P.end, true)); return; }
  if(a === "rm"){ P.edit = "rm:" + v; paint(false); return; }
  if(a === "rmyes"){ act(() => del(v), "Calendar removed"); return; }
  if(a === "nextm"){ const nm = nextMonthPlan(sort()); if(!nm) return; const days = classDays();
    act(() => save({ action: "createCalendar", classId: P.c["Class ID"], name: FULLM[+nm.start.slice(5, 7) - 1] + " Session", startDate: nm.start, days: span(nm.start, nm.end),
      weeklyOff: days.length ? CS.offOf(days) : (nm.base.weeklyOff || []), links: linksOf(nm.base).length ? linksOf(nm.base) : ["#"], active: true, position: "end", relativeTo: "" }),
      FULLM[+nm.start.slice(5, 7) - 1] + " calendar made"); return; }
}
async function del(id){
  const c = P.cals.find(x => x.calendarId === id);
  if(!c || startOf(c) <= today()) throw new Error("Only a calendar that has not started can be removed");
  const out = await deleteCalendarApi(id).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(!out || out.result !== "success") throw new Error((out && out.error) || "Not removed");
}
function attTell(){ try{ const f = document.getElementById("attFrame"); if(f && f.contentWindow) f.contentWindow.postMessage({ type: "mq-att-cmd", cmd: "refresh" }, location.origin); }catch(e){} }

/* ---------------- the calendar goes with its class sheet ---------------- */
if(typeof deleteClassApi === "function"){
  const del0 = deleteClassApi;
  deleteClassApi = async function(classId){
    try{
      const have = await fetchClassAdmin(classId);
      for(const c of ((have && have.calendars) || [])) await deleteCalendarApi(c.calendarId).catch(() => null);
    }catch(e){}
    return del0(classId);
  };
}

/* ---------------- ways in ---------------- */
function isClass(id){ const c = cls(id); return !!c; }
document.addEventListener("click", ev => {
  const b = ev.target.closest('#listContent button[data-act="cal"][data-id], #alertRows [data-cal], a[href^="calendars.html?id="]');
  if(!b) return;
  const id = b.dataset.id || b.dataset.cal || new URLSearchParams((b.getAttribute("href") || "").split("?")[1] || "").get("id");
  if(!id || !isClass(id)) return;                                  /* a batch keeps the calendar page */
  ev.preventDefault(); ev.stopImmediatePropagation();
  const m = document.querySelector(".modal-backdrop.show:not(#cpModal)"); if(m && m.id) closeModal(m.id);
  open(id);
}, true);
/* attendance → student menu → Calendar */
window.addEventListener("message", ev => {
  if(ev.origin !== location.origin || !ev.data || ev.data.type !== "mq-att" || ev.data.ev !== "open-calendar") return;
  const c = A.sheetsOf(String(ev.data.studentId || "").toUpperCase())[0];
  if(!c){ toast("This student has no class sheet", true); return; }
  if(A.closeAtt) A.closeAtt();
  open(c["Class ID"]);
});
/* ?cal=<Class ID> (old calendar-page addresses come back here) */
(function(){
  const id = new URLSearchParams(location.search).get("cal"); if(!id) return;
  let n = 0;
  const t = setInterval(() => { n++; if(isClass(id)){ clearInterval(t); open(id); } else if(n > 60) clearInterval(t); }, 250);
})();

/* ---------------- "Test copy" on a row: tap to remove ---------------- */
(function(){
  const row = window.CLS_ROW;
  window.CLS_ROW = function(c){
    let h = row ? row(c) : "";
    if(h.indexOf('class="row-note tc"') < 0) return h;
    const p = A.planOfSheet(c);
    if(!p) return h;
    return h.replace(/<span class="row-note tc"([^>]*)>Test copy<\/span>/, `<button type="button" class="row-note tc" data-cprm="${esc(p.id)}" title="Test copy of live class ${esc(p.copyOf || "")} — tap to remove the copy">Test copy ✕</button>`);
  };
  document.addEventListener("click", ev => { const b = ev.target.closest("[data-cprm]"); if(!b) return; ev.preventDefault(); ev.stopPropagation(); if(window.NC && NC.removeClass) NC.removeClass(b.dataset.cprm); }, true);
})();

window.CalPanel = { open: open };
})();
