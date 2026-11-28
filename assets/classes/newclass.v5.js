/* newclass.v5.js — the demo admin class sheet makes a class in ONE window, ONE save.
   v5 = v4 + TEST STUDENTS: "＋ Test student" beside "＋ New student" — its own series TEST-001 …, never in
   Academic Service and never an MQ number (its class is TPL…; test copies are TPL… too), a small "Test ID"
   label on its class sheet, "Remove all test students"; COPY FROM LIVE for a whole class sheet (up to 100,
   "Pick all shown"); ONE STUDENT EDITOR — "Details pending" opens every detail (the empty ones marked), saved
   through the server (clsdemo_student_edit) like the attendance's Edit everything; no "demo"/"live" tag on
   students (the wing is on the class). Needs clsdemo-onetruth-v1.sql.
   v4 = v3 + the teacher list keeps FINDING (name, ID or a language typed; "Only <language>") apart from
   ADDING a NEW TEACHER (its own card at the end → newteacher.v1.js; the new teacher is picked at once and
   waits in Academic Service → Review).
   v3 = v2 + the CLASS LANGUAGE (Malayalam first) and the teacher list shows each teacher's languages:
   teachers who teach in the chosen language come first, "Languages not set" / "No Tamil" are marked
   (still pickable). Needs clsdemo-lang-v1.sql.
   Loaded after teachers-admin.v9.js and calsync.v1.js on /portal/demo/classes/.

   v2 (needs clsdemo-newclass-v2.sql):
   · ONE class sheet per student: a student who already has a demo sheet (any status) cannot be
     picked — told before Next, never at the end
   · COPY FROM LIVE: a test copy of one or more live classes — same student (same MQ ID, no new
     number), teacher, course, days, time, minutes; the live class is only read. A test copy has
     no fee and is not in Academic Service; "Remove copy" takes it away again
   · a student with a running live class is sent to Copy from live
   · "Madrasa Individual" is always offered; a course the class sheet does not have yet is added
     to its Courses when the class is made
   · a new student's other details (email, gender, parent, address) are "pending": the Done
     screen and the class list show it, "Fill details" fills the empty ones
   · the class days changed in the attendance → the calendars follow from today (calsync)
   · Remove: a class made here by mistake (no attendance) or a test copy

   Part 1 · Class    — the student (from Academic Service, or a new one), teacher, course,
                        class days, time (IST), minutes, joining date
   Part 2 · Calendar — the Meet link(s) and how long; the weekly off comes from the class days,
                        so the calendar and the attendance never disagree
   Save              — student (next MQ number) → class (next IPL, Academic Service gets its copy,
                        the office sets the fee) → class sheet + share link → first calendar.
                        A step that fails can be tried again: nothing is made twice.

   Also here: the calendars of a new month (after "Set up <month>" in the attendance, or from
   Settings) — each running class gets a calendar with the same links, its weekly off from the
   class days, paused and stopped classes left out. */
(function(){
"use strict";

const WK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MINS = [30, 40, 45, 60];
const PRESETS = [["Mon – Sat", ["Mon","Tue","Wed","Thu","Fri","Sat"]], ["Mon – Fri", ["Mon","Tue","Wed","Thu","Fri"]],
                 ["Mon · Wed · Fri", ["Mon","Wed","Fri"]], ["Tue · Thu · Sat", ["Tue","Thu","Sat"]]];
const RM = window.matchMedia ? matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
const $ = id => document.getElementById(id);
const A = window.TA_API;
if(!A){ console.error("newclass.v4.js needs teachers-admin.v11.js first"); return; }
const { TA, taLoad, sheetsOf, sameCourse, studentPhone, reloadAs, clsAfterLoad, paintWorkspace, attQuiet, siLoad,
        planOfSheet, planRunning, planDays, dayName, snack } = A;
const EXTRA_COURSES = ["Madrasa Individual"];
const LANGS = ["Malayalam", "English", "Tamil", "Urdu", "Kannada", "Hindi", "Arabic"];
const tLangs = t => (t && Array.isArray(t.languages) ? t.languages : []);
const PEND = [["email", "Email"], ["gender", "Gender"], ["guardian", "Parent / guardian"], ["address", "Address"], ["dob", "Date of birth"]];
const esc = s => escapeHtml(s == null ? "" : String(s));
const digitsOf = v => String(v || "").replace(/\D/g, "");
const pad2 = n => String(n).padStart(2, "0");

/* ---- dates: always India time ---- */
function todayIST(){ return istTodayISO(); }
function addD(ds, n){ const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function dowOf(ds){ return DOW[new Date(ds + "T00:00:00Z").getUTCDay()]; }
function monthEnd(ds){ const [y, m] = ds.split("-").map(Number); return y + "-" + pad2(m) + "-" + pad2(new Date(Date.UTC(y, m, 0)).getUTCDate()); }
function span(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1; }
function fmt(ds, withYear){ try{ return new Date(ds + "T00:00:00Z").toLocaleDateString("en-IN", Object.assign({ weekday:"short", day:"numeric", month:"short", timeZone:"UTC" }, withYear ? { year:"numeric" } : {})); }catch(x){ return ds; } }
function monthName(ds){ return MONTHS[+ds.slice(5, 7) - 1]; }
function monthLbl(m){ return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function shiftM(m, n){ let [y, mo] = m.split("-").map(Number); mo += n; while(mo > 12){ mo -= 12; y++; } while(mo < 1){ mo += 12; y--; } return y + "-" + pad2(mo); }
function nextMonday(ds){ let d = addD(ds, 1); while(dowOf(d) !== "Mon") d = addD(d, 1); return d; }
function reqId(){ try{ return crypto.randomUUID(); }catch(x){ return "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } }
function offOf(days){ return WK.filter(d => days.indexOf(d) < 0).map(d => FULL[d]); }
function toMinutes(t){ const m = /^(\d{1,2}):(\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; }
function initialsOf(n){ return String(n || "?").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
function cleanLink(v){
  v = String(v || "").trim(); if(!v) return "";
  if(!/^https?:\/\//i.test(v) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(v)) v = "https://" + v;
  return v;
}
function linkOk(v){ return /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(v); }

/* ---- the state of the window ---- */
let S = null;
function fresh(pre){
  return { step: 1, dir: 1, q: "", tq: "", student: null, newSt: null, teacherId: "", course: "", days: [], time: "", dur: 45,
    lang: (pre && pre.lang) || "Malayalam", only: false, join: todayIST(), links: [""], len: "end", lenN: 30, group: "", req: reqId(), made: {}, busy: false, fail: null, bad: {},
    fromAtt: !!(pre && pre.fromAtt), mode: (pre && pre.mode) || "new", cq: "", sel: {}, one: true, cLinks: {}, jobs: [] };
}

/* ---- data from the page (teachers-admin) ---- */
function students(){ return Object.values(TA.students || {}).filter(s => s && s.id && !s._gone); }
function teachers(){ return (TA.teachers || []).filter(t => (t.status || "Active") === "Active" && !t._gone); }
function sheetCourses(){ return (typeof courses !== "undefined" ? courses : []).filter(c => c.active).map(c => c.name); }
function courseList(){ const l = sheetCourses(); EXTRA_COURSES.forEach(x => { if(!l.some(c => sameCourse(c, x))) l.push(x); }); return l; }
/* a course the class sheet does not have yet joins its Courses (the sheet's subjects hang off it) */
async function ensureCourse(name){
  if(sheetCourses().some(c => c === name)) return;
  const all = typeof courses !== "undefined" ? courses : [];
  const off = all.find(c => c.name === name);
  const out = await saveCourseApi({ courseId: off ? off.courseId : "", name: name, subjects: off ? (off.subjects || []) : [], active: true }).catch(() => null);
  if(out && out.result === "success" && typeof loadCourses === "function") await loadCourses();
}
/* one class sheet per student (any status) */
function demoSheet(id){ return sheetsOf(String(id || "").toUpperCase())[0] || null; }
function liveOf(id){ return (LIVE.list || []).filter(x => String(x.studentId).toUpperCase() === String(id || "").toUpperCase()); }
function pendingOf(st){ return st ? PEND.filter(([k]) => !String(st[k] || "").trim()) : []; }
function isTest(st){ return !!(st && (st.test || st.testStudent || /^TEST-/i.test(String(st.id || "")))); }
/* the test students: the next number, how many there are (from the server, on open) */
const TS = { next: "", n: 0, at: 0 };
async function loadTests(force){
  if(!force && Date.now() - TS.at < 30000) return;
  const out = await mqAdminFn("test_students", { action: "list" }).catch(() => null);
  if(out && out.result === "success"){ TS.next = out.next || ""; TS.n = (out.students || []).length; TS.at = Date.now(); TS.missing = false; }
  else if(out && out.missing) TS.missing = true;
}
function phoneOf(st){ return studentPhone(st); }
function busyAt(tid){
  /* the teacher's running classes that meet on the same day at an overlapping time */
  const a = toMinutes(S.time); if(a === null || !S.days.length) return null;
  const b = a + (+S.dur || 45), ds = S.join;
  for(const p of (TA.plans || [])){
    if(p.teacherId !== tid || !planRunning(p, ds)) continue;
    const x = toMinutes(p.time); if(x === null) continue;
    const y = x + (+p.duration || 45);
    if(x < b && a < y && (p.days || []).some(d => S.days.indexOf(dayName(d)) >= 0)) return p;
  }
  return null;
}

/* =================================================================
   WINDOW
   ================================================================= */
function ensure(){
  if($("ncModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "ncModal";
  d.innerHTML = `<div class="modal nc" role="dialog" aria-modal="true" aria-labelledby="ncTitle">
    <span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head nc-head">
      <h3 id="ncTitle">New <span class="accent">class</span></h3>
      <ol class="nc-steps" id="ncSteps" aria-label="Steps">
        <li data-s="1"><i>1</i><span>Class</span></li><li data-s="2"><i>2</i><span>Calendar</span></li><li data-s="3"><i>✓</i><span>Done</span></li>
      </ol>
      <div class="nc-bar" aria-hidden="true"><b id="ncBar"></b></div>
    </div>
    <div class="modal-body nc-body" id="ncBody"></div>
    <div class="modal-foot nc-foot" id="ncFoot"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d && !S.busy) close(); });
  d.addEventListener("click", onClick);
  d.addEventListener("input", onInput);
  d.addEventListener("change", onInput);
  d.addEventListener("keydown", ev => {
    if(ev.key === "Enter" && ev.target.matches("#ncFind") ){ ev.preventDefault(); const f = d.querySelector(".nc-res button"); if(f) f.click(); }
    if(ev.key === "Enter" && ev.target.matches("#ncTFind")){ ev.preventDefault(); const f = d.querySelector(".nc-tlist button:not([disabled])"); if(f) f.click(); }
  });
}
function close(){ closeModal("ncModal"); }

async function open(pre){
  if(!TA.loaded){ toast("Loading Academic Service…"); await taLoad(); }
  if(!TA.loaded){ toast(TA.error || "Could not read Academic Service", true); return; }
  ensure();
  S = fresh(pre);
  loadLive(false).then(() => { if(S && S.step === 1 && $("ncModal").classList.contains("show")){ if(S.mode === "copy") paintKeep(); else { const r = $("ncRes"); if(r) r.innerHTML = results(); } } });
  loadTests(false).then(() => { if(S && S.step === 1 && S.mode !== "copy" && $("ncModal").classList.contains("show")){ const r = $("ncRes"); if(r) r.innerHTML = results(); if(S.newSt && S.newSt.test) repaintPart("#ncStu", studentBox()); } });
  if(pre && pre.studentId){ const st = (TA.students || {})[pre.studentId]; if(st) pickStudent(st.id, true); }
  paint(true);
  openModal("ncModal");
  setTimeout(() => { const f = $("ncFind"); if(f && !S.student) f.focus({ preventScroll: true }); }, 280);
}
window.NC = { open: open, monthCalendars: monthCalendars, removeClass: removeClass, fill: fillOpen, editStudent: fillOpen, removeAllTests: removeAllTests };
window.CLS_NEW = function(){ open(null); };

/* ---- painting ---- */
function paint(first){
  const body = $("ncBody");
  body.innerHTML = '<div class="nc-pane ' + (first ? "" : S.dir > 0 ? "in-r" : "in-l") + '">' +
    (S.step === 1 ? pane1() : S.mode === "copy" ? (S.step === 2 ? paneCopy2() : paneCopy3()) : S.step === 2 ? pane2() : pane3()) + '</div>';
  $("ncFoot").innerHTML = foot();
  document.querySelectorAll("#ncSteps li").forEach(li => {
    const n = +li.dataset.s;
    li.classList.toggle("on", n === S.step); li.classList.toggle("done", n < S.step || (n === 3 && !!S.made.done));
  });
  $("ncTitle").innerHTML = S.mode === "copy" ? 'Copy from <span class="accent">live</span>' : 'New <span class="accent">class</span>';
  $("ncBar").style.width = (S.step === 1 ? 33 : S.step === 2 ? 66 : 100) + "%";
  if(!first){ const m = document.querySelector("#ncModal .modal"); if(m) m.scrollTop = 0; body.scrollTop = 0; }
}
function repaintPart(sel, html){ const el = document.querySelector(sel); if(el) el.outerHTML = html; }

/* ---------- part 1: the class ---------- */
function modeSwitch(){
  return `<div class="nc-mode" role="tablist" aria-label="What to make">
    <button type="button" role="tab" class="${S.mode === "new" ? "on" : ""}" aria-selected="${S.mode === "new"}" data-nc="mode" data-v="new">New class</button>
    <button type="button" role="tab" class="${S.mode === "copy" ? "on" : ""}" aria-selected="${S.mode === "copy"}" data-nc="mode" data-v="copy">Copy from live <em>test</em></button>
    <i aria-hidden="true" style="--x:${S.mode === "copy" ? 1 : 0}"></i></div>`;
}
function pane1(){
  if(S.mode === "copy") return modeSwitch() + paneCopy1();
  return modeSwitch() + `<p class="nc-lead">Who, with whom, which days. The office sees it at once and sets the fee.</p>
    ${studentBox()}
    ${teacherBox()}
    <div class="nc-f"><label>Course</label><div class="nc-chips" id="ncCourses">${courseList().map(c =>
      `<button type="button" class="nc-chip${S.course === c ? " on" : ""}" data-nc="course" data-v="${esc(c)}">${esc(c)}</button>`).join("") || '<span class="nc-hint">No courses yet — add one in the menu → Courses.</span>'}</div>${errLine("course")}</div>
    <div class="nc-f"><label>Class language</label><div class="nc-chips sm nc-langs" id="ncLangs">${LANGS.map(l =>
      `<button type="button" class="nc-chip sm${S.lang === l ? " on" : ""}" data-nc="lang" data-v="${l}" aria-pressed="${S.lang === l}">${l}</button>`).join("")}</div></div>
    ${daysBox()}
    <div class="nc-row2">
      <div class="nc-f"><label for="ncTime">Class time <small>IST</small></label>
        <input type="time" id="ncTime" class="nc-in" value="${esc(S.time)}" step="300" />
        <span class="nc-sub" id="ncTimeTxt">${S.time ? esc(formatTime(S.time)) + " India time" : "&nbsp;"}</span>${errLine("time")}</div>
      <div class="nc-f"><label>Minutes</label>${minsBox()}</div>
    </div>
    ${joinBox()}`;
}
function errLine(k){ return S.bad[k] ? `<span class="nc-err" role="alert">${esc(S.bad[k])}</span>` : ""; }

function studentBox(){
  if(S.student){
    const st = S.student;
    return `<div class="nc-f" id="ncStu"><label>Student</label><div class="nc-pick">
      <span class="nc-av">${esc(initialsOf(st.name))}</span><span class="nc-pm"><b>${esc(st.name)}</b><small>${esc(st.id)}${phoneOf(st) ? " · " + esc(phoneOf(st)) : ""}</small></span>${isTest(st) ? '<em class="nc-tag t">Test ID</em>' : ""}
      <button type="button" class="nc-x" data-nc="unstudent" aria-label="Change the student">Change</button></div></div>`;
  }
  if(S.newSt){
    const n = S.newSt, dup = n.test ? null : dupOf(n);
    return `<div class="nc-f nc-new${n.test ? " is-test" : ""}" id="ncStu"><label>${n.test ? "Test student" : "New student"} <small>${n.test ? esc(TS.next || "TEST-…") + " · only in this demo" : "gets the next MQ number"}</small></label>
      <div class="nc-kind" role="radiogroup" aria-label="Real or test student">
        <button type="button" role="radio" class="${n.test ? "" : "on"}" aria-checked="${!n.test}" data-nc="stkind" data-v="real"><b>Real student</b><small>next MQ number · in Academic Service</small></button>
        <button type="button" role="radio" class="${n.test ? "on" : ""}" aria-checked="${!!n.test}" data-nc="stkind" data-v="test"><b>Test student</b><small>${esc(TS.next || "TEST-…")} · not in Academic Service</small></button>
        <i aria-hidden="true" style="--x:${n.test ? 1 : 0}"></i></div>
      ${n.test ? `<p class="nc-tnote">For trying the class sheet: no MQ number is used, no fee, nothing goes to Academic Service. The class runs like any other — attendance, calendar, teacher page. Remove it any time.</p>` : ""}
      <div class="nc-newcard">
        <input class="nc-in" id="ncNName" value="${esc(n.name)}" placeholder="Student's name" autocomplete="off" />${errLine("name")}
        <div class="nc-wa"><select class="nc-in nc-cc" id="ncNCC" aria-label="Country code">${["91","971","966","974","965","968","973","44","1","60","65"].map(c => `<option value="${c}"${n.cc === c ? " selected" : ""}>+${c}</option>`).join("")}</select>
          <input class="nc-in" id="ncNWa" inputmode="tel" value="${esc(n.wa)}" placeholder="WhatsApp number" autocomplete="off" /></div>
        ${n.test ? "" : `<div class="nc-dob"><label for="ncNDob">Date of birth <small>optional · for the student sign-in later</small></label><input type="date" class="nc-in" id="ncNDob" value="${esc(n.dob)}" max="${todayIST()}" /></div>`}
        ${dup ? `<div class="nc-dup"><span>Already in Academic Service: <b>${esc(dup.name)}</b> · ${esc(dup.id)}</span><button type="button" class="nc-mini" data-nc="usedup" data-v="${esc(dup.id)}">Use</button></div>` : ""}
        <button type="button" class="nc-link" data-nc="unstudent">← Find a student instead</button>
      </div></div>`;
  }
  return `<div class="nc-f" id="ncStu"><label for="ncFind">Student</label>
    <div class="nc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="nc-in" id="ncFind" value="${esc(S.q)}" placeholder="Name, MQ ID or phone" autocomplete="off" /></div>
    <div class="nc-res" id="ncRes">${results()}</div>${errLine("student")}</div>`;
}
function results(){
  const q = S.q.trim().toLowerCase(), qd = digitsOf(q);
  if(!q) return addButtons("");
  const hits = students().filter(s => String(s.name || "").toLowerCase().indexOf(q) >= 0 || String(s.id).toLowerCase() === q ||
      (qd.length >= 4 && (digitsOf(s.whatsapp).indexOf(qd) >= 0 || digitsOf(s.phone).indexOf(qd) >= 0)))
    .sort((a, b) => (!!demoSheet(a.id)) - (!!demoSheet(b.id)) || isTest(a) - isTest(b) || String(a.name).localeCompare(String(b.name))).slice(0, 6);
  return hits.map((s, i) => {
    const sh = demoSheet(s.id), lv = liveOf(s.id)[0];
    const tag = sh ? `<em class="nc-tag">Has a class sheet${(sh["Status"] || "Active") !== "Active" ? " (off)" : ""}</em>`
      : lv ? '<em class="nc-tag lv">Live class · Copy</em>' : isTest(s) ? '<em class="nc-tag t">Test ID</em>' : "";
    return `<button type="button" class="nc-hit${lv && !sh ? " to-copy" : ""}" style="--i:${i}" data-nc="${lv && !sh ? "tocopy" : "student"}" data-v="${esc(lv && !sh ? lv.id : s.id)}"${sh ? " disabled" : ""}>
      <span class="nc-av sm">${esc(initialsOf(s.name))}</span><span class="nc-pm"><b>${esc(s.name)}</b><small>${esc(s.id)}${phoneOf(s) ? " · " + esc(phoneOf(s)) : ""}${sh ? " · one sheet per student" : ""}</small></span>
      ${tag}</button>`;
  }).join("") + addButtons(S.q.trim());
}
/* adding: a real student (next MQ number) or a test student (TEST-…, only in this demo) */
function addButtons(q){
  return `<div class="nc-adds"><button type="button" class="nc-addnew" data-nc="newst"><span>＋</span> New student${q ? " “" + esc(q) + "”" : ""}<small>next MQ number</small></button>
    <button type="button" class="nc-addnew t" data-nc="newtest"><span>＋</span> Test student<small>${esc(TS.next || "TEST-…")} · not in Academic Service</small></button></div>
    <p class="nc-tip">Only trying the class sheet? Use a <b>test student</b> — no MQ number is used and nothing reaches Academic Service.${TS.n ? ` <button type="button" class="nc-link" data-nc="rmtests">${TS.n} test student${TS.n === 1 ? "" : "s"} now · remove all</button>` : ""}</p>`;
}
function dupOf(n){
  const wd = digitsOf(n.wa), nm = String(n.name || "").trim().toLowerCase();
  return students().find(s => (wd.length >= 8 && (digitsOf(s.whatsapp).slice(-wd.length) === wd || digitsOf(s.phone).slice(-wd.length) === wd)) ||
                              (nm.length >= 4 && String(s.name || "").trim().toLowerCase() === nm)) || null;
}

function teacherBox(){
  const q = S.tq.trim().toLowerCase();
  const fits = t => tLangs(t).indexOf(S.lang) >= 0 ? 0 : tLangs(t).length ? 2 : 1;
  const nMatch = teachers().filter(t => tLangs(t).indexOf(S.lang) >= 0).length;
  const list = teachers().filter(t => (A.tMatch ? A.tMatch(t, S.tq.trim(), S.only ? S.lang : "") : (!q || String(t.name).toLowerCase().indexOf(q) >= 0)))
    .map((t, k) => [t, k]).sort((a, b) => fits(a[0]) - fits(b[0]) || a[1] - b[1]).map(x => x[0]);
  return `<div class="nc-f" id="ncTea"><label for="ncTFind">Teacher <small>${nMatch} teach in ${esc(S.lang)}</small></label>
    <div class="nc-tfind"><div class="nc-search sm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input class="nc-in" id="ncTFind" value="${esc(S.tq)}" placeholder="Find — name, ID or language" autocomplete="off" /></div>
      <button type="button" class="nc-tog${S.only ? " on" : ""}" data-nc="only" aria-pressed="${S.only}"><i aria-hidden="true"></i>Only ${esc(S.lang)}</button></div>
    <div class="nc-tlist">${list.map((t, i) => {
      const busy = busyAt(t.id), on = S.teacherId === t.id;
      const ls = tLangs(t), ok = ls.indexOf(S.lang) >= 0;
      return `<button type="button" class="nc-t${on ? " on" : ""}${busy ? " busy" : ""}${ls.length && !ok ? " nolang" : ""}" style="--i:${Math.min(i, 12)}" data-nc="teacher" data-v="${esc(t.id)}" aria-pressed="${on}">
        <span class="nc-av sm">${esc(initialsOf(t.name))}</span><span class="nc-pm"><b>${esc(t.name)}</b><small>${busy ? "Has a class at " + esc(formatTime(busy.time)) : esc(t.id)}</small>
        <span class="nc-tl">${ls.length ? ls.map(l => `<i class="${l === S.lang ? "on" : ""}">${esc(l.slice(0, 3))}</i>`).join("") + (ok ? "" : `<em>No ${esc(S.lang)}</em>`) : "<em>Languages not set</em>"}</span></span></button>`;
    }).join("") || `<span class="nc-hint">No teacher${S.only ? " who teaches in " + esc(S.lang) : ""}${S.tq.trim() ? " for “" + esc(S.tq.trim()) + "”" : ""}.</span>`}</div>
    <button type="button" class="nc-newt" data-nc="newt"><span class="nc-av sm" aria-hidden="true">＋</span><span class="nc-pm"><b>New teacher</b><small>Not on the list? Add them — the office confirms in Academic Service</small></span></button>${errLine("teacher")}</div>`;
}
function daysBox(){
  return `<div class="nc-f" id="ncDays"><label>Class days</label>
    <div class="nc-days">${WK.map(d => `<button type="button" class="nc-day${S.days.indexOf(d) >= 0 ? " on" : ""}" data-nc="day" data-v="${d}" aria-pressed="${S.days.indexOf(d) >= 0}">${d.slice(0, 2)}</button>`).join("")}</div>
    <div class="nc-chips sm">${PRESETS.map(([l, ds]) => `<button type="button" class="nc-chip sm${ds.join() === S.days.join() ? " on" : ""}" data-nc="preset" data-v="${ds.join(",")}">${l}</button>`).join("")}</div>
    <span class="nc-sub">${S.days.length ? S.days.length + " day" + (S.days.length === 1 ? "" : "s") + " a week · weekly off: " + esc(offOf(S.days).map(x => x.slice(0, 3)).join(", ") || "none") : "Tap the days the class meets."}</span>${errLine("days")}</div>`;
}
function minsBox(){
  return `<div class="nc-mins" id="ncMins"><button type="button" class="nc-step" data-nc="dur" data-v="-5" aria-label="5 minutes less">−</button>
    <output id="ncDur">${S.dur}<small>min</small></output>
    <button type="button" class="nc-step" data-nc="dur" data-v="5" aria-label="5 minutes more">＋</button></div>
    <div class="nc-chips sm">${MINS.map(m => `<button type="button" class="nc-chip sm${S.dur === m ? " on" : ""}" data-nc="durset" data-v="${m}">${m}</button>`).join("")}</div>`;
}
function joinBox(){
  const t = todayIST(), opts = [["Today", t], ["Tomorrow", addD(t, 1)], ["Next Monday", nextMonday(t)], ["1 " + MONTHS[+shiftM(t.slice(0, 7), 1).slice(5) - 1].slice(0, 3), shiftM(t.slice(0, 7), 1) + "-01"]]
    .filter((o, i, a) => a.findIndex(x => x[1] === o[1]) === i);
  return `<div class="nc-f" id="ncJoin"><label for="ncJoinIn">Joining date</label>
    <div class="nc-chips sm">${opts.map(([l, d]) => `<button type="button" class="nc-chip sm${S.join === d ? " on" : ""}" data-nc="join" data-v="${d}">${esc(l)}</button>`).join("")}</div>
    <input type="date" class="nc-in" id="ncJoinIn" value="${esc(S.join)}" />
    <span class="nc-sub">${esc(fmt(S.join, true))}${S.join < t ? " · already started — the attendance opens from this day" : ""}</span>${errLine("join")}</div>`;
}

/* ---------- part 2: the calendar ---------- */
function calDays(){ return S.len === "end" ? span(S.join, monthEnd(S.join)) : Math.max(1, Math.min(120, +S.lenN || 30)); }
function calEnd(){ return addD(S.join, calDays() - 1); }
function cleanLinks(){ return S.links.map(cleanLink).filter(Boolean); }
function pane2(){
  const st = who(), t = teachers().find(x => x.id === S.teacherId) || {}, n = calDays(), me = span(S.join, monthEnd(S.join));
  return `<div class="nc-sum" style="--i:0">
      <span class="nc-av">${esc(initialsOf(st.name))}</span>
      <span class="nc-pm"><b>${esc(st.name)}${st.id ? ' <small>' + esc(st.id) + '</small>' : ' <small>new</small>'}</b>
        <small>${esc([t.name, S.course, S.lang, S.days.map(d => d.slice(0, 2)).join(" "), formatTime(S.time), S.dur + " min"].filter(Boolean).join(" · "))}</small></span>
      <button type="button" class="nc-x" data-nc="back">Edit</button></div>
    <div class="nc-f" style="--i:1"><label>Meet link${S.links.length > 1 ? "s" : ""}</label>
      <div class="nc-links" id="ncLinks">${S.links.map((l, i) => `<div class="nc-lrow"><span class="nc-ln">L${i + 1}</span>
        <input class="nc-in" data-link="${i}" value="${esc(l)}" placeholder="https://meet.google.com/abc-defg-hij" inputmode="url" autocomplete="off" />
        ${S.links.length > 1 ? `<button type="button" class="nc-rm" data-nc="rmlink" data-v="${i}" aria-label="Remove link ${i + 1}">✕</button>` : ""}</div>`).join("")}</div>
      <div class="nc-lfoot"><button type="button" class="nc-link" data-nc="addlink">＋ Another link</button><span class="nc-sub">${S.links.length > 1 ? "The links take turns on class days (L1, L2…)." : "One link every class day."}</span></div>${errLine("links")}</div>
    <div class="nc-f" style="--i:2"><label>Calendar</label>
      <div class="nc-chips sm">
        <button type="button" class="nc-chip sm${S.len === "end" ? " on" : ""}" data-nc="len" data-v="end">Till month end · ${me}</button>
        ${[30, 40].map(x => `<button type="button" class="nc-chip sm${S.len === "n" && +S.lenN === x ? " on" : ""}" data-nc="len" data-v="${x}">${x} days</button>`).join("")}
      </div>
      <span class="nc-sub">From <b>${esc(fmt(S.join))}</b> to <b>${esc(fmt(calEnd(), true))}</b> · ${n} days · weekly off <b>${esc(offOf(S.days).map(x => x.slice(0, 3)).join(", ") || "none")}</b> (from the class days)</span>
      ${S.len === "end" ? '<span class="nc-sub">The next month\'s calendar is made when the month is set up in the attendance.</span>' : ""}
      ${preview()}</div>
    <div class="nc-f" style="--i:3"><label for="ncGroup">WhatsApp group link <small>optional</small></label>
      <input class="nc-in" id="ncGroup" value="${esc(S.group)}" placeholder="https://chat.whatsapp.com/…" inputmode="url" autocomplete="off" />${errLine("group")}</div>
    <p class="nc-note" style="--i:4">The student sign-in stays <b>off</b>. Switch it on later in Edit.</p>`;
}
function preview(){
  const n = calDays(), links = cleanLinks(), out = [];
  let k = 0;
  for(let i = 0; i < n; i++){
    const ds = addD(S.join, i), off = S.days.indexOf(dowOf(ds)) < 0;
    out.push(`<span class="nc-cd${off ? " off" : ""}${ds === todayIST() ? " today" : ""}" style="--i:${Math.min(i, 40)}"><small>${dowOf(ds).slice(0, 2)}</small>${+ds.slice(8)}<i>${off ? "Off" : links.length > 1 ? "L" + (k % links.length + 1) : ""}</i></span>`);
    if(!off) k++;
  }
  return `<div class="nc-cal" id="ncCal" aria-label="${k} class days">${out.join("")}</div><span class="nc-sub">${k} class day${k === 1 ? "" : "s"} in this calendar</span>`;
}

/* ---------- part 3: making it ---------- */
const STEPS = [["student", "Student"], ["class", "Class · Academic Service copy"], ["sheet", "Class sheet + share link"], ["calendar", "Calendar"]];
function stepLabel(k, l){ return k === "class" && (S.made.test || (S.newSt && S.newSt.test) || isTest(S.student)) ? "Class · demo only" : l; }
function stepState(k){
  const m = S.made;
  if(m[k]) return "ok";
  if(S.fail && S.fail.step === k) return "bad";
  if(S.busy && S.at === k) return "run";
  return "wait";
}
function pane3(){
  const m = S.made;
  const tst = !!(m.test || (S.newSt && S.newSt.test) || isTest(S.student));
  const line = k => k === "student" ? (m.studentId ? who().name + " · " + m.studentId + (tst ? " · test student" : "") : who().name + (tst ? " · test student" : ""))
    : k === "class" ? (m.planId ? m.planId + (tst ? " · test class — not in Academic Service" : " · the office sets the fee") : S.course + " with " + ((teachers().find(x => x.id === S.teacherId) || {}).name || ""))
    : k === "sheet" ? (m.classId ? "Ready" : "Its own page for the student")
    : (m.calendar ? m.calendar : calDays() + " days from " + fmt(S.join));
  return `<ol class="nc-run">${STEPS.map(([k, l], i) => `<li class="nc-rs ${stepState(k)}" style="--i:${i}"><span class="nc-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
      <span class="nc-pm"><b>${esc(stepLabel(k, l))}</b><small>${esc(line(k))}</small></span></li>`).join("")}</ol>
    ${S.fail ? `<div class="nc-fail" role="alert"><b>${esc(S.fail.msg)}</b><small>What was made stays. Try again carries on from here.</small></div>` : ""}
    ${m.done ? doneHtml() : ""}`;
}
function doneHtml(){
  const c = sheetRow(), url = c ? shareUrl(c) : "";
  const st = who(), wa = digitsOf((S.student && (S.student.whatsappCC || "") + "") + (S.student ? S.student.whatsapp : "")) || digitsOf((S.newSt && S.newSt.cc) + (S.newSt && S.newSt.wa));
  const msg = "Assalamu alaikum. " + st.name + "'s class page: " + url;
  return `<div class="nc-done">
    <div class="nc-burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join("")}<span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></div>
    <b>${esc(st.name)}'s class is ready</b>
    <small>Attendance, the class sheet and the calendar are all in step.${S.made.test ? " Test student — nothing went to Academic Service." : ""}</small>
    ${S.made.test ? "" : pendBox(S.made.studentId)}
    ${url ? `<div class="nc-share"><input class="nc-in" readonly value="${esc(url)}" id="ncUrl" aria-label="Share link" />
      <button type="button" class="nc-mini" data-nc="copy">Copy</button></div>
      <div class="nc-acts">${wa.length >= 9 ? `<a class="btn-outline sm" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(msg)}">Send on WhatsApp</a>` : ""}
        <a class="btn-outline sm" target="_blank" rel="noopener" href="${esc(url)}">Open the class page</a>
        <a class="btn-outline sm" href="calendars.html?id=${encodeURIComponent(c["Class ID"])}">Calendar</a></div>` : ""}
  </div>`;
}
function who(){
  if(S.student) return S.student;
  const n = S.newSt || {};
  return { id: S.made.studentId || "", name: String(n.name || "").trim(), whatsapp: digitsOf(n.wa), whatsappCC: n.cc || "91", dob: n.dob || "" };
}
function sheetRow(){ return S.made.classId ? (classes.find(x => x["Class ID"] === S.made.classId) || null) : null; }

function foot(){
  if(S.mode === "copy") return footCopy();
  if(S.step === 1) return `<button class="btn-ghost" data-nc="close">Cancel</button><button class="btn-solid" data-nc="next">Calendar <span aria-hidden="true">→</span></button>`;
  if(S.step === 2) return `<button class="btn-ghost" data-nc="back">← Class</button><button class="btn-solid nc-go" data-nc="save"><span>Create class</span></button>`;
  if(S.made.done) return `<button class="btn-ghost" data-nc="another">Another class</button><button class="btn-solid" data-nc="close">Done</button>`;
  if(S.fail) return `<button class="btn-ghost" data-nc="close">Close</button><button class="btn-solid" data-nc="retry">Try again</button>`;
  return `<span class="nc-sub">Making the class…</span>`;
}

/* =================================================================
   EVENTS
   ================================================================= */
function pickStudent(id, quiet){
  const st = (TA.students || {})[id]; if(!st) return;
  const sh = demoSheet(id);
  if(sh){ if(!quiet) toast(st.name + " already has a class sheet (" + (sh["Course"] || "—") + ") — one sheet per student", true); return; }
  const lv = liveOf(id)[0];
  if(lv){ if(!quiet) toast(st.name + " has a live class — make a test copy of it"); toCopy(lv.id); return; }
  S.student = st; S.newSt = null; S.q = ""; delete S.bad.student;
}
function clearErr(el){ const f = el && el.closest && el.closest(".nc-f"); if(f) f.querySelectorAll(".nc-err").forEach(x => x.remove()); }
function onClick(ev){
  const b = ev.target.closest("[data-nc]"); if(!b || b.disabled) return;
  const a = b.dataset.nc, v = b.dataset.v;
  if(a !== "next" && a !== "save") clearErr(b);
  if(a === "close"){ close(); return; }
  if(onCopyClick(a, v, b)) return;
  if(a === "student"){ pickStudent(v); repaintPart("#ncStu", studentBox()); refreshTeachers(); return; }
  if(a === "unstudent"){ S.student = null; S.newSt = null; repaintPart("#ncStu", studentBox()); const f = $("ncFind"); if(f) f.focus(); return; }
  if(a === "newst" || a === "newtest"){ const q = S.q.trim(); S.newSt = { name: /\d{5,}/.test(q) ? "" : q, wa: /\d{5,}/.test(q) ? digitsOf(q) : "", cc: "91", dob: "", test: a === "newtest" }; delete S.bad.student;
    repaintPart("#ncStu", studentBox()); const f = $(S.newSt.name ? "ncNWa" : "ncNName"); if(f) f.focus(); return; }
  if(a === "usedup"){ pickStudent(v); repaintPart("#ncStu", studentBox()); return; }
  if(a === "stkind"){ if(!S.newSt) return; readNew(); S.newSt.test = v === "test"; repaintPart("#ncStu", studentBox()); const f = $("ncNName"); if(f && !S.newSt.name) f.focus(); return; }
  if(a === "rmtests"){ removeAllTests(); return; }
  if(a === "teacher"){ S.teacherId = S.teacherId === v ? "" : v; delete S.bad.teacher; refreshTeachers(); return; }
  if(a === "only"){ S.only = !S.only; refreshTeachers(); return; }
  if(a === "newt"){ if(window.NT) NT.open({ lang: S.lang, name: A.langOfQ && A.langOfQ(S.tq) ? "" : S.tq.trim(), title: 'New <span class="accent">teacher</span> for this class',
      onDone: t => { S.teacherId = t.id; S.tq = ""; delete S.bad.teacher; refreshTeachers(); } }); return; }
  if(a === "lang"){ S.lang = v; document.querySelectorAll("#ncLangs .nc-chip").forEach(x => { x.classList.toggle("on", x.dataset.v === v); x.setAttribute("aria-pressed", x.dataset.v === v); });
    repaintPart("#ncTea", teacherBox()); return; }
  if(a === "course"){ S.course = v; delete S.bad.course; document.querySelectorAll("#ncCourses .nc-chip").forEach(x => x.classList.toggle("on", x.dataset.v === v));
    const e2 = document.querySelector("#ncCourses + .nc-err"); if(e2) e2.remove(); return; }
  if(a === "day"){ const i = S.days.indexOf(v); if(i >= 0) S.days.splice(i, 1); else S.days.push(v); S.days.sort((x, y) => WK.indexOf(x) - WK.indexOf(y)); delete S.bad.days;
    repaintPart("#ncDays", daysBox()); refreshTeachers(); return; }
  if(a === "preset"){ S.days = v.split(","); delete S.bad.days; repaintPart("#ncDays", daysBox()); refreshTeachers(); return; }
  if(a === "dur"){ S.dur = Math.max(10, Math.min(180, (+S.dur || 45) + (+v))); repaintMins(); refreshTeachers(); return; }
  if(a === "durset"){ S.dur = +v; repaintMins(); refreshTeachers(); return; }
  if(a === "join"){ S.join = v; delete S.bad.join; repaintPart("#ncJoin", joinBox()); return; }
  if(a === "next"){ if(check1()){ go(2); } return; }
  if(a === "back"){ if(S.step === 3) return; go(1); return; }
  if(a === "addlink"){ readLinks(); S.links.push(""); paintKeep(); const ins = document.querySelectorAll("#ncLinks input"); if(ins.length) ins[ins.length - 1].focus(); return; }
  if(a === "rmlink"){ readLinks(); S.links.splice(+v, 1); if(!S.links.length) S.links = [""]; paintKeep(); return; }
  if(a === "len"){ if(v === "end") S.len = "end"; else { S.len = "n"; S.lenN = +v; } paintKeep(); return; }
  if(a === "save"){ readLinks(); if(check2()){ go(3); run(); } return; }
  if(a === "retry"){ S.fail = null; run(); return; }
  if(a === "another"){ S = fresh(null); paint(false); return; }
  if(a === "copy"){ const u = $("ncUrl"); if(u){ u.select(); (navigator.clipboard ? navigator.clipboard.writeText(u.value) : Promise.reject()).then(() => toast("Link copied"), () => { document.execCommand("copy"); toast("Link copied"); }); } return; }
}
function repaintMins(){ const o = $("ncDur"); if(o){ o.innerHTML = S.dur + "<small>min</small>"; o.classList.remove("tick"); void o.offsetWidth; o.classList.add("tick"); }
  document.querySelectorAll("[data-nc=durset]").forEach(x => x.classList.toggle("on", +x.dataset.v === S.dur)); }
function refreshTeachers(){ if(S.step !== 1) return; const box = $("ncTea"); if(!box) return; const f = document.activeElement && document.activeElement.id === "ncTFind";
  repaintPart("#ncTea", teacherBox()); if(f){ const i = $("ncTFind"); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }
/* part 2 repaints in place (no slide) and keeps the caret where it was */
function paintKeep(){
  const a = document.activeElement, id = a && (a.id || (a.dataset && a.dataset.link != null ? "L" + a.dataset.link : "")), pos = a && a.selectionStart;
  $("ncBody").innerHTML = '<div class="nc-pane still">' + (S.mode === "copy" ? (S.step === 1 ? pane1() : paneCopy2()) : pane2()) + '</div>';
  if(id){ const el = id[0] === "L" && !$(id) ? document.querySelector('#ncLinks input[data-link="' + id.slice(1) + '"]') : $(id); if(el && el.focus){ el.focus(); try{ el.setSelectionRange(pos, pos); }catch(x){} } }
}
function readNew(){ const nm = $("ncNName"), wa = $("ncNWa"), cc = $("ncNCC"), dob = $("ncNDob");
  if(!S.newSt) return; if(nm) S.newSt.name = nm.value; if(wa) S.newSt.wa = wa.value; if(cc) S.newSt.cc = cc.value; if(dob) S.newSt.dob = dob.value; }
function readLinks(){ document.querySelectorAll("#ncLinks input[data-link]").forEach(i => { S.links[+i.dataset.link] = i.value; }); }
let previewT = 0;
function onInput(ev){
  const t = ev.target;
  /* "change" only for dates, times and lists — a text box's change (on leaving it) would repaint the list under the finger */
  if(ev.type === "change" && !/^(date|time|select-one)$/.test(t.type)) return;
  clearErr(t);
  if(t.id === "ncCFind"){ S.cq = t.value; const l = $("ncCList"); if(l) l.outerHTML = copyList(); return; }
  if(t.dataset && t.dataset.clink != null){ S.cLinks[t.dataset.clink] = t.value; delete S.bad.links; return; }
  if(t.id === "ncFind"){ S.q = t.value; const r = $("ncRes"); if(r) r.innerHTML = results(); return; }
  if(t.id === "ncTFind"){ S.tq = t.value; refreshTeachers(); return; }
  if(t.id === "ncNName"){ S.newSt.name = t.value; delete S.bad.name; dupLater(); return; }
  if(t.id === "ncNWa"){ S.newSt.wa = t.value; dupLater(); return; }
  if(t.id === "ncNCC"){ S.newSt.cc = t.value; return; }
  if(t.id === "ncNDob"){ S.newSt.dob = t.value; return; }
  if(t.id === "ncTime"){ S.time = t.value; delete S.bad.time; const s = $("ncTimeTxt"); if(s) s.innerHTML = S.time ? esc(formatTime(S.time)) + " India time" : "&nbsp;"; refreshTeachers(); return; }
  if(t.id === "ncJoinIn" && ev.type === "change"){ if(/^\d{4}-\d{2}-\d{2}$/.test(t.value)){ S.join = t.value; repaintPart("#ncJoin", joinBox()); } return; }
  if(t.dataset && t.dataset.link != null){ S.links[+t.dataset.link] = t.value; delete S.bad.links; clearTimeout(previewT);
    previewT = setTimeout(() => { const c = $("ncCal"); if(c){ const w = document.createElement("div"); w.innerHTML = preview(); c.parentNode.replaceChild(w.firstChild, c); } }, 250); return; }
  if(t.id === "ncGroup"){ S.group = t.value; delete S.bad.group; return; }
}
let dupT = 0;
function dupLater(){ clearTimeout(dupT); dupT = setTimeout(() => {
  const card = document.querySelector("#ncStu .nc-newcard"); if(!card) return;
  const old = card.querySelector(".nc-dup"), d = dupOf(S.newSt);
  if(old) old.remove();
  if(d){ const x = document.createElement("div"); x.className = "nc-dup"; x.innerHTML = `<span>Already in Academic Service: <b>${esc(d.name)}</b> · ${esc(d.id)}</span><button type="button" class="nc-mini" data-nc="usedup" data-v="${esc(d.id)}">Use</button>`;
    card.insertBefore(x, card.querySelector(".nc-link")); }
}, 300); }

function go(step){
  S.dir = step > S.step ? 1 : -1; S.step = step; paint(false);
  if(step === 2) setTimeout(() => { const i = document.querySelector('#ncLinks input[data-link="0"]'); if(i && !i.value) i.focus({ preventScroll: true }); }, 320);
}
function shake(){ const m = document.querySelector("#ncModal .modal"); if(!m || RM.matches) return; m.classList.remove("nc-shake"); void m.offsetWidth; m.classList.add("nc-shake"); }
function check1(){
  S.bad = {};
  if(!S.student && !S.newSt) S.bad.student = "Find the student, or add a new one";
  if(S.newSt && !String(S.newSt.name || "").trim()) S.bad.name = "Type the student's name";
  if(S.newSt && S.newSt.wa && digitsOf(S.newSt.wa).length < 7) S.bad.name = "The WhatsApp number looks short";
  if(!S.teacherId) S.bad.teacher = "Pick the teacher";
  if(!S.course) S.bad.course = "Choose the course";
  if(!S.days.length) S.bad.days = "Choose at least one class day";
  if(!/^\d{2}:\d{2}$/.test(S.time)) S.bad.time = "Set the class time";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(S.join)) S.bad.join = "Choose the joining date";
  if(S.student && demoSheet(S.student.id)) S.bad.student = S.student.name + " already has a class sheet — one sheet per student";
  if(Object.keys(S.bad).length){ paint(true); shake(); const e1 = document.querySelector("#ncBody .nc-err"); if(e1) e1.scrollIntoView({ block: "center", behavior: RM.matches ? "auto" : "smooth" }); return false; }
  return true;
}
function check2(){
  S.bad = {};
  const ls = cleanLinks();
  if(!ls.length) S.bad.links = "Add the Meet link";
  else if(ls.some(l => !linkOk(l))) S.bad.links = "A link is not right — it should start with https://";
  const g = cleanLink(S.group); if(g && !linkOk(g)) S.bad.group = "The group link should start with https://";
  if(Object.keys(S.bad).length){ paintKeep(); shake(); return false; }
  S.links = ls.slice(); S.group = g;
  return true;
}

/* =================================================================
   SAVE — student → class → class sheet → calendar
   ================================================================= */
async function run(){
  if(S.busy) return;
  S.busy = true; S.fail = null; paint(true);
  const m = S.made;
  try{
    /* 1 + 2: the student and the class, in one go on the server */
    if(!m.planId){
      setAt("student");
      const st = who();
      const out = await mqAdminFn("new_class", {
        reqId: S.req,
        student: S.student ? { id: S.student.id } : Object.assign({ name: st.name, whatsapp: st.whatsapp, whatsappCC: st.whatsappCC, dob: st.dob }, S.newSt && S.newSt.test ? { test: true } : {}),
        plan: { teacherId: S.teacherId, course: S.course, language: S.lang, days: S.days, time: S.time, duration: S.dur, startDate: S.join } });
      if(!out || out.result !== "success") throw step("student", out && out.missing ? "The server is not ready: run clsdemo-newclass-v2.sql in Supabase." : (out && out.error) || "Could not reach the server");
      m.studentId = out.studentId; m.student = true;
      if(!S.student && out.student){ TA.students[out.studentId] = out.student; m.isNew = true; }
      m.test = !!out.testStudent; if(m.test){ TS.at = 0; loadTests(true); }
      await pause(220); setAt("class");
      m.planId = out.planId; m.class = true;
      await pause(220);
    }
    /* 3: the class sheet (the one that already exists is used again) */
    if(!m.classId){
      setAt("sheet");
      const st = S.student || TA.students[m.studentId] || who();
      let c = sheetsOf(String(m.studentId).toUpperCase()).find(x => (x["Status"] || "Active") === "Active" && sameCourse(x["Course"], S.course));
      if(!c){
        await ensureCourse(S.course);
        const out = await saveClass({ studentName: st.name, studentId: m.studentId, course: S.course, mqId: m.studentId,
          classTime: S.time, subjects: [], joinDate: S.join, whatsapp: S.group || "", phone: phoneOf(Object.assign({}, st, { whatsapp: st.whatsapp, whatsappCC: st.whatsappCC })),
          status: "Active", studyMaterial: "", hifzLink: "" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
        if(!out || out.result !== "success") throw step("sheet", (out && out.error) || "Could not make the class sheet");
        await loadClasses();
        c = classes.find(x => x["Share Token"] === out.token) || (out.classId && classes.find(x => x["Class ID"] === out.classId));
        if(!c) throw step("sheet", "The class sheet was made but did not come back — reload the page");
      }
      m.classId = c["Class ID"]; m.sheet = true;
      /* the phone + date of birth wait for the sign-in; it stays off until switched on in Edit */
      const dob = st.dob || (S.newSt && S.newSt.dob) || "";
      if(dob && digitsOf(c["Phone"] || phoneOf(st)).length >= 9 && !TA.siMissing)
        await sAdmin("set", { classId: m.classId, phone: c["Phone"] || phoneOf(st), dob: dob, on: false }).then(() => siLoad()).catch(() => null);
      await pause(200);
    }
    /* 4: the first calendar */
    if(!m.calendar){
      setAt("calendar");
      const name = monthName(S.join) + " Session", days = calDays();
      const have = await fetchClassAdmin(m.classId).catch(() => null);
      const cals = (have && have.calendars) || [];
      if(!cals.some(x => String(x.startDate).slice(0, 10) === S.join)){
        const out = await saveCalendarApi({ action: "createCalendar", classId: m.classId, name: name, startDate: S.join, days: days,
          weeklyOff: offOf(S.days), links: S.links, active: true, position: "end", relativeTo: "" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
        if(!out || out.result !== "success") throw step("calendar", (out && out.error) || "Could not make the calendar");
      }
      m.calendar = name + " · " + days + " days";
    }
    m.done = true; S.at = "";
    S.busy = false; paint(true);
    afterMade();
  }catch(err){
    S.busy = false;
    S.fail = err && err.ncStep ? err : { step: S.at || "student", msg: String(err && err.message || err) };
    paint(true); shake();
  }
}
function step(k, msg){ const e2 = new Error(msg); e2.ncStep = true; e2.step = k; e2.msg = msg; return e2; }
function setAt(k){ S.at = k; paint(true); }
function pause(ms){ return new Promise(r => setTimeout(r, RM.matches ? 0 : ms)); }
async function afterMade(){
  /* the new class is in the lists, the attendance (if open) shows it */
  try{ await reloadAs(); }catch(x){}
  clsAfterLoad();
  if(currentWs() === "teachers") paintWorkspace();
  attQuiet("refresh");
  window.dispatchEvent(new CustomEvent("nc:made", { detail: Object.assign({}, S.made) }));
}

/* the attendance asked for a new class (its + Student / + Class) */
window.addEventListener("message", function(ev){
  if(ev.origin !== location.origin || !ev.data || ev.data.type !== "mq-att") return;
  if(ev.data.ev === "new-class") open({ studentId: ev.data.studentId || "", fromAtt: true });
  if(ev.data.ev === "month-setup" && ev.data.month) monthCalendars(ev.data.month, true);
});

/* =================================================================
   CALENDARS FOR A NEW MONTH
   ================================================================= */
const MC = { m: "", rows: [], busy: false, made: 0 };
function ensureMc(){
  if($("ncMonth")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "ncMonth";
  d.innerHTML = `<div class="modal nc nc-mc" role="dialog" aria-modal="true" aria-labelledby="ncMcTitle"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head"><h3 id="ncMcTitle"></h3><p id="ncMcSub"></p><div class="nc-bar" aria-hidden="true"><b id="ncMcBar"></b></div></div>
    <div class="modal-body nc-body" id="ncMcBody"></div><div class="modal-foot nc-foot" id="ncMcFoot"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => {
    if(ev.target === d && !MC.busy){ closeModal("ncMonth"); return; }
    const b = ev.target.closest("[data-mc]"); if(!b) return;
    if(b.dataset.mc === "close" && !MC.busy) closeModal("ncMonth");
    if(b.dataset.mc === "run") runMonth();
    if(b.dataset.mc === "cal") location.href = "calendars.html?id=" + encodeURIComponent(b.dataset.v);
  });
}
/* what each class needs for the month (no network) */
function monthPlan(m){
  const ms = m + "-01", me = monthEnd(ms), out = [];
  (typeof classes !== "undefined" ? classes : []).filter(c => (c["Status"] || "Active") === "Active").forEach(c => {
    const p = planOfSheet(c), r = { c: c, p: p, name: c["Student Name"], state: "wait", why: "", from: "", to: "" };
    if(!p){ r.state = "skip"; r.why = "No class in the attendance"; out.push(r); return; }
    if(p.endDate && p.endDate < ms){ r.state = "skip"; r.why = "Left · last class " + fmt(p.endDate); out.push(r); return; }
    if(!p.endDate && (p.status || "Active") !== "Active"){ r.state = "skip"; r.why = "Not running"; out.push(r); return; }
    if(p.startDate && p.startDate > me){ r.state = "skip"; r.why = "Starts " + fmt(p.startDate); out.push(r); return; }
    const days = planDays(p); if(!days.length){ r.state = "skip"; r.why = "No class days — set them in the attendance"; out.push(r); return; }
    let from = p.startDate && p.startDate > ms ? p.startDate : ms;
    const to = p.endDate && p.endDate < me ? p.endDate : me;
    /* a pause at the start of the month moves the start to the restart day */
    for(const z of (Array.isArray(p.pauses) ? p.pauses : []).filter(z => z && z.from && z.from <= from).sort((a, b) => a.from < b.from ? -1 : 1)){
      if(!z.until){ from = "9999-12-31"; break; }
      if(z.until >= from) from = addD(z.until, 1);
    }
    if(from > to){ r.state = "skip"; r.why = from === "9999-12-31" ? "Paused until restarted" : "Paused all month"; out.push(r); return; }
    r.from = from; r.to = to; r.days = days; out.push(r);
  });
  return out.sort((a, b) => (a.state === "skip") - (b.state === "skip") || String(a.name).localeCompare(String(b.name)));
}
async function monthCalendars(m, auto){
  if(!TA.loaded) await taLoad();
  if(typeof classes === "undefined" || !classes.length) await loadClasses();
  ensureMc();
  MC.m = m; MC.rows = monthPlan(m); MC.made = 0;
  paintMc(auto ? "run" : "ask");
  openModal("ncMonth");
  if(auto) runMonth();
}
function paintMc(mode){
  const todo = MC.rows.filter(r => r.state !== "skip").length;
  $("ncMcTitle").innerHTML = 'Calendars for <span class="accent">' + esc(monthLbl(MC.m)) + '</span>';
  $("ncMcSub").textContent = mode === "ask"
    ? todo + " running class" + (todo === 1 ? "" : "es") + ". Each gets a calendar with the same links, its weekly off from the class days. Classes that already have one are left as they are."
    : MC.busy ? "Making the calendars…" : MC.made + " made · " + MC.rows.filter(r => r.state === "have").length + " already had one";
  const doneN = MC.rows.filter(r => r.state !== "wait" && r.state !== "run").length;
  $("ncMcBar").style.width = (MC.rows.length ? Math.round(doneN / MC.rows.length * 100) : 100) + "%";
  $("ncMcBody").innerHTML = MC.rows.length ? '<ol class="nc-mcl">' + MC.rows.map((r, i) => {
    const s = r.state, cls = s === "ok" ? "ok" : s === "run" ? "run" : s === "bad" ? "bad" : s === "wait" ? "wait" : "skip";
    const sub = s === "wait" ? fmt(r.from) + " – " + fmt(r.to) + " · off " + offOf(r.days).map(x => x.slice(0, 3)).join(", ") : r.why;
    return `<li class="nc-rs ${cls}" style="--i:${Math.min(i, 14)}"><span class="nc-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
      <span class="nc-pm"><b>${esc(r.name)}${r.c["Course"] ? " <small>" + esc(r.c["Course"]) + "</small>" : ""}</b><small>${esc(sub)}</small></span>
      ${s === "bad" || s === "nolink" ? `<button type="button" class="nc-mini" data-mc="cal" data-v="${esc(r.c["Class ID"])}">Calendar</button>` : ""}</li>`;
  }).join("") + '</ol>' : '<p class="nc-lead">No class sheets yet.</p>';
  $("ncMcFoot").innerHTML = mode === "ask"
    ? `<button class="btn-ghost" data-mc="close">Not now</button><button class="btn-solid" data-mc="run"${todo ? "" : " disabled"}>Make ${todo} calendar${todo === 1 ? "" : "s"}</button>`
    : MC.busy ? '<span class="nc-sub">Please keep this page open…</span>' : '<button class="btn-solid" data-mc="close">Done</button>';
}
async function runMonth(){
  if(MC.busy) return;
  MC.busy = true; paintMc("run");
  const ms = MC.m + "-01";
  for(const r of MC.rows){
    if(r.state !== "wait") continue;
    r.state = "run"; paintMc("run");
    try{
      const have = await fetchClassAdmin(r.c["Class ID"]);
      const cals = ((have && have.calendars) || []).filter(x => x && x.startDate);
      const endOf = x => addD(String(x.startDate).slice(0, 10), Math.max(1, +x.days || 1) - 1);
      const act = cals.filter(x => x.active !== false);
      const lastEnd = act.reduce((mx, x) => endOf(x) > mx ? endOf(x) : mx, "");
      let from = r.from;
      if(lastEnd && lastEnd >= from) from = addD(lastEnd, 1);
      if(from > r.to){ r.state = "have"; r.why = "Already has a calendar"; paintMc("run"); continue; }
      const src = (act.length ? act : cals).slice().sort((a, b) => endOf(b) < endOf(a) ? -1 : 1)[0];
      const links = ((src && src.links) || []).filter(l => l && l !== "#");
      if(!links.length){ r.state = "bad"; r.why = "No Meet link yet — add the first calendar by hand"; paintMc("run"); continue; }
      const name = MONTHS[+MC.m.slice(5) - 1] + " Session", days = span(from, r.to);
      const out = await saveCalendarApi({ action: "createCalendar", classId: r.c["Class ID"], name: name, startDate: from, days: days,
        weeklyOff: offOf(r.days), links: links, active: true, position: "end", relativeTo: "" });
      if(!out || out.result !== "success") throw new Error((out && out.error) || "Not saved");
      r.state = "ok"; r.why = name + " · " + fmt(from) + " – " + fmt(r.to) + " · " + links.length + " link" + (links.length === 1 ? "" : "s"); MC.made++;
    }catch(err){ r.state = "bad"; r.why = String(err && err.message || err); }
    paintMc("run");
    await pause(120);
  }
  MC.busy = false; paintMc("done");
  if(MC.made) toast(MC.made + " calendar" + (MC.made === 1 ? "" : "s") + " made for " + monthLbl(MC.m));
  void ms;
}

/* =================================================================
   COPY FROM LIVE — test copies of live classes (v2)
   Same student, same MQ ID, same teacher / course / days / time. The live class is only read.
   A test copy has no fee and is not in Academic Service (clsdemo-newclass-v2.sql).
   ================================================================= */
const LIVE = { list: null, err: "", loading: null };
const MAX_COPY = 100;
async function loadLive(force){
  if(LIVE.loading) return LIVE.loading;
  if(LIVE.list && !force) return;
  LIVE.loading = (async () => {
    const out = await mqAdminFn("live_list", {}).catch(err => ({ result: "error", error: String(err && err.message || err) }));
    if(out && out.result === "success"){ LIVE.list = out.classes || []; LIVE.err = ""; }
    else { LIVE.list = LIVE.list || []; LIVE.err = out && out.missing ? "Run clsdemo-newclass-v2.sql in Supabase to copy live classes." : (out && out.error) || "Could not read the live classes"; }
  })().finally(() => { LIVE.loading = null; });
  return LIVE.loading;
}
function liveById(id){ return (LIVE.list || []).find(x => x.id === id) || null; }
function daysTxt(ds){ return (ds || []).map(d => String(d).slice(0, 2)).join(" "); }
function toCopy(liveId){
  S.mode = "copy"; S.student = null; S.newSt = null; S.q = ""; S.bad = {};
  if(liveId){ S.sel = {}; S.sel[liveId] = 1; }
  if(S.step !== 1) S.step = 1;
  paint(false);
}
function selected(){ return Object.keys(S.sel).filter(k => S.sel[k]).map(liveById).filter(Boolean); }
function paneCopy1(){
  const n = selected().length;
  return `<p class="nc-lead">A <b>test copy</b> of a live class: the same student (same MQ ID), teacher, course, days and time — so the demo runs on real classes, without made-up students. The live class is not changed. A test copy has <b>no fee</b> and is not in Academic Service.</p>
    <div class="nc-f"><label for="ncCFind">Live classes <small>${n ? n + " picked" : "pick one or more · up to " + MAX_COPY}</small></label>
      <div class="nc-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input class="nc-in" id="ncCFind" value="${esc(S.cq)}" placeholder="Student, MQ ID, teacher or course" autocomplete="off" /></div>
      ${copyList()}${errLine("copy")}</div>
    ${joinBox()}`;
}
function copyList(){
  if(!LIVE.list) return `<div class="nc-cl" id="ncCList">${[0, 1, 2].map(i => `<span class="nc-skel" style="--i:${i}"></span>`).join("")}</div>`;
  const q = S.cq.trim().toLowerCase();
  const rows = LIVE.list.filter(x => !q || [x.student && x.student.name, x.studentId, x.teacher, x.course].some(v => String(v || "").toLowerCase().indexOf(q) >= 0))
    .sort((a, b) => (!!a.copy || !!a.hasSheet) - (!!b.copy || !!b.hasSheet) || String(a.student && a.student.name).localeCompare(String(b.student && b.student.name)));
  const free = rows.filter(x => !x.copy && !x.hasSheet);
  const html = rows.slice(0, 200).map((x, i) => {
    const nm = (x.student && x.student.name) || x.studentId, on = !!S.sel[x.id];
    const sub = [x.studentId, x.course, x.language, x.teacher, daysTxt(x.days), x.time ? formatTime(x.time) : ""].filter(Boolean).join(" · ");
    if(x.copy) return `<div class="nc-ci done" style="--i:${Math.min(i, 12)}"><span class="nc-av sm">${esc(initialsOf(nm))}</span>
        <span class="nc-pm"><b>${esc(nm)}</b><small>${esc(sub)}</small></span><em class="nc-tag d">Test copy · ${esc(x.copy)}</em>
        <button type="button" class="nc-mini rm" data-nc="crm" data-v="${esc(x.copy)}">Remove copy</button></div>`;
    return `<button type="button" class="nc-ci${on ? " on" : ""}" style="--i:${Math.min(i, 12)}" data-nc="csel" data-v="${esc(x.id)}" aria-pressed="${on}"${x.hasSheet ? " disabled" : ""}>
        <span class="nc-ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
        <span class="nc-pm"><b>${esc(nm)}</b><small>${esc(sub)}</small></span>${x.hasSheet ? '<em class="nc-tag">Has a demo sheet</em>' : ""}</button>`;
  }).join("");
  const allOn = free.length && free.every(x => S.sel[x.id]);
  const head = free.length > 1 ? `<div class="nc-clh"><span>${rows.length} live class${rows.length === 1 ? "" : "es"}${q ? " found" : ""} · ${free.length} can be copied</span>
      <button type="button" class="nc-mini" data-nc="callshown" data-v="${allOn ? "0" : "1"}">${allOn ? "Clear" : "Pick all " + Math.min(free.length, MAX_COPY)}</button></div>` : "";
  return `<div class="nc-cl" id="ncCList">${LIVE.err ? `<span class="nc-err" role="alert">${esc(LIVE.err)}</span>` : ""}${head}${html || (LIVE.err ? "" : '<span class="nc-hint">No running live class' + (q ? " for “" + esc(S.cq.trim()) + "”" : "") + ".</span>")}</div>`;
}
function readCopyLinks(){ document.querySelectorAll("#ncBody input[data-clink]").forEach(i => { S.cLinks[i.dataset.clink] = i.value; }); }
function copyLinksOf(x){ const v = cleanLink(S.one ? S.cLinks.all : S.cLinks[x.id]); return v ? [v] : []; }
function paneCopy2(){
  const list = selected(), n = calDays(), me = span(S.join, monthEnd(S.join));
  return `<div class="nc-sum" style="--i:0"><span class="nc-av">${list.length}</span>
      <span class="nc-pm"><b>${list.length} test cop${list.length === 1 ? "y" : "ies"}</b><small>${esc(list.map(x => (x.student && x.student.name) || x.studentId).join(", "))}</small></span>
      <button type="button" class="nc-x" data-nc="back">Edit</button></div>
    <div class="nc-f" style="--i:1"><label>Meet link</label>
      ${list.length > 1 ? `<button type="button" class="nc-tog${S.one ? " on" : ""}" data-nc="one" aria-pressed="${S.one}"><i aria-hidden="true"></i>One link for all</button>` : ""}
      <div class="nc-links">${S.one || list.length === 1
        ? `<div class="nc-lrow"><span class="nc-ln">L1</span><input class="nc-in" data-clink="all" value="${esc(S.cLinks.all || "")}" placeholder="https://meet.google.com/abc-defg-hij" inputmode="url" autocomplete="off" /></div>`
        : list.map(x => `<div class="nc-lrow"><span class="nc-ln w">${esc(initialsOf((x.student && x.student.name) || x.studentId))}</span><input class="nc-in" data-clink="${esc(x.id)}" value="${esc(S.cLinks[x.id] || "")}" placeholder="${esc(((x.student && x.student.name) || x.studentId) + " · https://meet.google.com/…")}" inputmode="url" autocomplete="off" /></div>`).join("")}</div>${errLine("links")}</div>
    <div class="nc-f" style="--i:2"><label>Calendar</label>
      <div class="nc-chips sm">
        <button type="button" class="nc-chip sm${S.len === "end" ? " on" : ""}" data-nc="len" data-v="end">Till month end · ${me}</button>
        ${[30, 40].map(x => `<button type="button" class="nc-chip sm${S.len === "n" && +S.lenN === x ? " on" : ""}" data-nc="len" data-v="${x}">${x} days</button>`).join("")}
      </div>
      <span class="nc-sub">From <b>${esc(fmt(S.join))}</b> to <b>${esc(fmt(calEnd(), true))}</b> · ${n} days · each calendar's weekly off comes from its class days</span>
      <ul class="nc-cpl">${list.map(x => `<li><b>${esc((x.student && x.student.name) || x.studentId)}</b> <span>${esc(daysTxt(x.days))}</span> <small>off ${esc(offOf(x.days || []).map(d => d.slice(0, 3)).join(", ") || "none")}</small></li>`).join("")}</ul></div>
    <p class="nc-note" style="--i:3">Test copies: no fee, not in Academic Service, the live class stays as it is. The student sign-in stays <b>off</b>.</p>
    <p class="nc-note" style="--i:4">Teaching a real class from a copy? Its marks stay in the demo — fees and teacher pay still come from Academic Service, so mark those classes there too.</p>`;
}
function paneCopy3(){
  const all = S.jobs.length, ok = S.jobs.filter(j => j.state === "ok").length;
  return `<ol class="nc-run">${S.jobs.map((j, i) => {
      const nm = (j.x.student && j.x.student.name) || j.x.studentId, c = j.classId ? (classes.find(y => y["Class ID"] === j.classId) || null) : null, url = c ? shareUrl(c) : "";
      return `<li class="nc-rs ${j.state}" style="--i:${Math.min(i, 12)}"><span class="nc-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
        <span class="nc-pm"><b>${esc(nm)} <small>${esc(j.x.course || "")}</small></b><small>${esc(j.msg || (j.state === "wait" ? "Waiting" : ""))}</small></span>
        ${url ? `<span class="nc-ra"><button type="button" class="nc-mini" data-nc="curl" data-v="${esc(url)}">Copy link</button><a class="nc-mini" target="_blank" rel="noopener" href="${esc(url)}">Open</a></span>` : ""}</li>`;
    }).join("")}</ol>
    ${S.made.done ? `<div class="nc-done"><div class="nc-burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join("")}<span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></div>
      <b>${ok} test cop${ok === 1 ? "y is" : "ies are"} ready</b><small>Mark their attendance in the demo — the live classes are untouched.</small></div>`
      : copyBusy() ? "" : (ok < all ? '<div class="nc-fail" role="alert"><b>Some copies were not made.</b><small>What was made stays. Try again carries on.</small></div>' : "")}`;
}
function copyBusy(){ return S.busy || S.jobs.some(j => j.state === "wait" || j.state === "run"); }
function footCopy(){
  if(S.step === 1) return `<button class="btn-ghost" data-nc="close">Cancel</button><button class="btn-solid" data-nc="cnext"${LIVE.list ? "" : " disabled"}>Calendar <span aria-hidden="true">→</span></button>`;
  if(S.step === 2) return `<button class="btn-ghost" data-nc="back">← Classes</button><button class="btn-solid nc-go" data-nc="csave"><span>Make ${selected().length} cop${selected().length === 1 ? "y" : "ies"}</span></button>`;
  if(S.made.done) return `<button class="btn-ghost" data-nc="cmore">More copies</button><button class="btn-solid" data-nc="close">Done</button>`;
  if(!copyBusy()) return `<button class="btn-ghost" data-nc="close">Close</button><button class="btn-solid" data-nc="cretry">Try again</button>`;
  return `<span class="nc-sub">Making the copies…</span>`;
}
function onCopyClick(a, v, b){
  if(a === "mode"){ if(S.busy || S.step !== 1) return true; S.mode = v; S.bad = {}; paint(true); if(v === "copy") loadLive(false).then(() => { if(S.mode === "copy" && S.step === 1) paintKeep(); }); return true; }
  if(a === "tocopy"){ toCopy(v); return true; }
  if(a === "csel"){
    if(!S.sel[v] && selected().length >= MAX_COPY){ toast("Up to " + MAX_COPY + " at a time", true); return true; }
    S.sel[v] = S.sel[v] ? 0 : 1; delete S.bad.copy;
    b.classList.toggle("on", !!S.sel[v]); b.setAttribute("aria-pressed", !!S.sel[v]);
    const lb = document.querySelector('label[for="ncCFind"] small'); const n = selected().length; if(lb) lb.textContent = n ? n + " picked" : "pick one or more · up to " + MAX_COPY;
    return true;
  }
  if(a === "crm"){ removeClass(v); return true; }
  if(a === "callshown"){
    const q = S.cq.trim().toLowerCase();
    const free = (LIVE.list || []).filter(x => !x.copy && !x.hasSheet && (!q || [x.student && x.student.name, x.studentId, x.teacher, x.course].some(t => String(t || "").toLowerCase().indexOf(q) >= 0)));
    if(v === "1"){ free.slice(0, MAX_COPY).forEach(x => { S.sel[x.id] = 1; }); } else free.forEach(x => { S.sel[x.id] = 0; });
    delete S.bad.copy; paintKeep(); return true;
  }
  if(a === "one"){ readCopyLinks(); S.one = !S.one; paintKeep(); return true; }
  if(a === "cnext"){
    S.bad = {};
    if(!selected().length) S.bad.copy = "Pick at least one live class";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(S.join)) S.bad.join = "Choose the joining date";
    if(Object.keys(S.bad).length){ paint(true); shake(); return true; }
    go(2); return true;
  }
  if(a === "csave"){
    readCopyLinks(); S.bad = {};
    const list = selected();
    if(list.some(x => !copyLinksOf(x).length)) S.bad.links = S.one || list.length === 1 ? "Add the Meet link" : "Add a Meet link for each class";
    else if(list.some(x => !linkOk(copyLinksOf(x)[0]))) S.bad.links = "A link is not right — it should start with https://";
    if(Object.keys(S.bad).length){ paintKeep(); shake(); return true; }
    S.jobs = list.map(x => ({ x: x, req: reqId(), state: "wait", msg: "", planId: "", studentId: "", classId: "", cal: false }));
    go(3); runCopy(); return true;
  }
  if(a === "cretry"){ S.jobs.forEach(j => { if(j.state === "bad"){ j.state = "wait"; j.msg = ""; } }); runCopy(); return true; }
  if(a === "cmore"){ const keep = S.cLinks; S = fresh({ mode: "copy" }); S.cLinks = keep; loadLive(true).then(() => paint(false)); paint(false); return true; }
  if(a === "curl"){ (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast("Link copied"), () => toast(v)); return true; }
  if(a === "fill"){ fillOpen(v); return true; }
  return false;
}
async function runCopy(){
  if(S.busy) return;
  S.busy = true; S.made = {}; paint(true);
  for(const j of S.jobs){
    if(j.state === "ok") continue;
    const x = j.x, nm = (x.student && x.student.name) || x.studentId;
    j.state = "run"; j.msg = "The class…"; paint(true);
    try{
      if(!j.planId){
        const out = await mqAdminFn("new_class", { reqId: j.req, copyOf: x.id, plan: { startDate: S.join } });
        if(!out || out.result !== "success") throw new Error(out && out.missing ? "Run clsdemo-newclass-v2.sql in Supabase" : (out && out.error) || "Could not reach the server");
        j.planId = out.planId; j.studentId = out.studentId;
        if(out.student && !TA.students[out.studentId]) TA.students[out.studentId] = out.student;
      }
      if(!j.classId){
        j.msg = "The class sheet…"; paint(true);
        const st = TA.students[j.studentId] || x.student || {};
        let c = demoSheet(j.studentId);
        if(!c){
          const course = (sheetCourses().find(k => sameCourse(k, x.course))) || x.course;
          await ensureCourse(course);
          const out = await saveClass({ studentName: st.name || nm, studentId: j.studentId, course: course, mqId: j.studentId,
            classTime: /^\d{2}:\d{2}$/.test(x.time || "") ? x.time : "", subjects: [], joinDate: S.join, whatsapp: "", phone: phoneOf(st),
            status: "Active", studyMaterial: "", hifzLink: "" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
          if(!out || out.result !== "success") throw new Error((out && out.error) || "Could not make the class sheet");
          if(out.classId && out.token){ c = { "Class ID": out.classId, "Share Token": out.token, "Student Name": st.name || nm, "Student ID": j.studentId, mqId: j.studentId, "Course": course, "Status": "Active" };
            if(typeof classes !== "undefined" && !classes.some(y => y["Class ID"] === out.classId)) classes.push(c); }
          else { await loadClasses(); c = classes.find(y => y["Share Token"] === out.token) || (out.classId && classes.find(y => y["Class ID"] === out.classId)); }
          if(!c) throw new Error("The class sheet was made but did not come back — reload the page");
          if(st.dob && digitsOf(phoneOf(st)).length >= 9 && !TA.siMissing)
            await sAdmin("set", { classId: c["Class ID"], phone: phoneOf(st), dob: st.dob, on: false }).catch(() => null);
        }
        j.classId = c["Class ID"];
      }
      if(!j.cal){
        j.msg = "The calendar…"; paint(true);
        const have = await fetchClassAdmin(j.classId).catch(() => null);
        if(!((have && have.calendars) || []).some(k => String(k.startDate).slice(0, 10) === S.join)){
          const out = await saveCalendarApi({ action: "createCalendar", classId: j.classId, name: monthName(S.join) + " Session", startDate: S.join, days: calDays(),
            weeklyOff: offOf(x.days || []), links: copyLinksOf(x), active: true, position: "end", relativeTo: "" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
          if(!out || out.result !== "success") throw new Error((out && out.error) || "Could not make the calendar");
        }
        j.cal = true;
      }
      j.state = "ok"; j.msg = "Test copy " + j.planId + " · " + calDays() + "-day calendar";
    }catch(err){ j.state = "bad"; j.msg = String(err && err.message || err); }
    paint(true);
    await pause(150);
  }
  S.busy = false;
  if(S.jobs.every(j => j.state === "ok")) S.made.done = true; else shake();
  paint(true);
  try{ await loadClasses(); }catch(x){}
  paint(true);
  try{ await reloadAs(); }catch(x){}
  await loadLive(true); try{ await siLoad(); }catch(x){}
  clsAfterLoad(); if(currentWs() === "teachers") paintWorkspace(); attQuiet("refresh");
}

/* =================================================================
   REMOVE — a test copy, or a class made here by mistake (no attendance)
   ================================================================= */
function ensureRm(){
  if($("ncRm")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "ncRm";
  d.innerHTML = `<div class="modal nc nc-sm" role="dialog" aria-modal="true" aria-labelledby="ncRmT"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head"><h3 id="ncRmT"></h3><p id="ncRmP"></p></div><div class="modal-body nc-body" id="ncRmB"></div>
    <div class="modal-foot nc-foot"><button class="btn-ghost" data-rm="no">Keep it</button><button class="btn-solid danger" data-rm="yes">Remove</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d){ closeModal("ncRm"); return; } const b = ev.target.closest("[data-rm]"); if(!b || b.disabled) return;
    if(b.dataset.rm === "no") closeModal("ncRm"); else doRemove(b); });
}
let RMID = "";
function removeClass(planId){
  const p = (TA.plans || []).find(x => x.id === planId) || null;
  const st = p ? (TA.students[p.studentId] || {}) : {};
  ensureRm(); RMID = planId;
  const test = !!(p && p.testCopy), tst = !!(p && (p.testStudent || /^TEST-/i.test(String(p.studentId || ""))));
  $("ncRmT").innerHTML = test ? 'Remove the <span class="accent">test copy</span>?' : tst ? 'Remove the <span class="accent">test student</span>?' : 'Remove this <span class="accent">class</span>?';
  $("ncRmP").textContent = (st.name || (p && p.studentId) || planId) + " · " + ((p && p.course) || "") + " · " + planId;
  $("ncRmB").innerHTML = test
    ? '<ul class="nc-cpl"><li>The demo class, its marks, its class sheet and calendar go.</li><li>The <b>live class</b> and the student stay as they are.</li></ul>'
    : tst ? '<ul class="nc-cpl"><li>The test student, the class, its marks, its class sheet and calendar go.</li><li>Nothing in Academic Service changes — it was never there.</li></ul>'
    : '<ul class="nc-cpl"><li>Only for a class made here by mistake, with no attendance yet.</li><li>The student and their class sheet stay. Academic Service drops its copy.</li></ul>';
  const y = document.querySelector('#ncRm [data-rm="yes"]'); y.disabled = false; y.textContent = "Remove";
  openModal("ncRm");
}
async function doRemove(btn){
  btn.disabled = true; btn.textContent = "Removing…";
  const out = await mqAdminFn("remove_class", { planId: RMID }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(!out || out.result !== "success"){ btn.disabled = false; btn.textContent = "Remove"; toast(out && out.missing ? "Run clsdemo-newclass-v2.sql in Supabase" : (out && out.error) || "Not removed", true); return; }
  if(out.testCopy || out.test){
    /* its class sheet goes with it — unless another class of the student still runs here */
    const others = (TA.plans || []).filter(p => p.id !== RMID && String(p.studentId).toUpperCase() === String(out.studentId).toUpperCase() && planRunning(p, todayIST()));
    const c = demoSheet(out.studentId);
    if(c && !others.length) await deleteClassApi(c["Class ID"]).catch(() => null);
  }
  closeModal("ncRm");
  toast(out.testCopy ? "Test copy removed — the live class is untouched" : out.testStudent ? "Test student removed" : "Class removed");
  if(out.testStudent){ TS.at = 0; loadTests(true); }
  try{ await reloadAs(); }catch(x){}
  await loadClasses(); await loadLive(true);
  clsAfterLoad(); if(A.paintAsPanel) A.paintAsPanel(); attQuiet("refresh");
  if(S && $("ncModal") && $("ncModal").classList.contains("show") && S.mode === "copy" && S.step === 1) paintKeep();
}

/* =================================================================
   STUDENT DETAILS — ONE EDITOR (v5): every detail, the empty ones marked "pending",
   saved through the server (clsdemo_student_edit) — the same as the attendance's Edit everything
   ================================================================= */
function pendBox(id){
  const st = id ? TA.students[id] : null, miss = pendingOf(st);
  if(!st || isTest(st) || !miss.length || !(S.made.isNew || st.detailsPending)) return "";
  return `<div class="nc-pend"><span><b>Details pending</b> ${esc(miss.map(m => m[1]).join(" · "))}</span><button type="button" class="nc-mini" data-nc="fill" data-v="${esc(id)}">Fill details</button></div>`;
}
const EDF = [["name", "Name"], ["whatsapp", "WhatsApp"], ["dob", "Date of birth"], ["gender", "Gender"], ["guardian", "Parent / guardian"], ["email", "Email"], ["address", "Address"], ["notes", "Notes"]];
const FL = { id: "", v: {}, st: null };
function ensureFill(){
  if($("ncFill")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "ncFill";
  d.innerHTML = `<div class="modal nc nc-sm" role="dialog" aria-modal="true" aria-labelledby="ncFillT"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head"><h3 id="ncFillT">Student <span class="accent">details</span></h3><p id="ncFillP"></p></div>
    <div class="modal-body nc-body" id="ncFillB"></div>
    <div class="modal-foot nc-foot"><button class="btn-ghost" data-fl="no">Later</button><button class="btn-solid" data-fl="save">Save</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => {
    if(ev.target === d){ closeModal("ncFill"); return; }
    const g = ev.target.closest("[data-gender]"); if(g){ FL.v.gender = FL.v.gender === g.dataset.gender ? "" : g.dataset.gender;
      d.querySelectorAll("[data-gender]").forEach(x => x.classList.toggle("on", x.dataset.gender === FL.v.gender)); mark(); return; }
    const b = ev.target.closest("[data-fl]"); if(!b || b.disabled) return;
    if(b.dataset.fl === "no") closeModal("ncFill"); else saveFill(b);
  });
  d.addEventListener("input", ev => { const k = ev.target.dataset && ev.target.dataset.fk; if(k){ FL.v[k] = ev.target.value; const e2 = d.querySelector(".nc-err"); if(e2) e2.remove(); mark(); } });
  function mark(){ d.querySelectorAll(".nc-f[data-k]").forEach(f => { const k = f.dataset.k; f.classList.toggle("pend", PEND.some(x => x[0] === k) && !String(FL.v[k] || "").trim()); }); }
}
function fillOpen(id){
  const st = TA.students[id]; if(!st){ toast("Student not found", true); return; }
  ensureFill(); FL.id = id; FL.st = st;
  FL.v = {}; EDF.forEach(([k]) => { FL.v[k] = String(st[k] || ""); }); FL.v.whatsappCC = String(st.whatsappCC || "91");
  const miss = isTest(st) ? [] : pendingOf(st);
  $("ncFillP").textContent = st.name + " · " + id + (isTest(st) ? " · test student — saved only in this demo" : miss.length ? " · " + miss.length + " pending" : " · the office sees every change");
  const pend = k => !isTest(st) && PEND.some(x => x[0] === k) && !String(st[k] || "").trim();
  $("ncFillB").innerHTML = EDF.map(([k, l], i) => {
    const lab = `<label for="ncF_${k}">${l}${pend(k) ? ' <em class="nc-pt">pending</em>' : ""}</label>`, cls = `nc-f${pend(k) ? " pend" : ""}`;
    if(k === "gender") return `<div class="${cls}" data-k="${k}" style="--i:${i}"><label>${l}${pend(k) ? ' <em class="nc-pt">pending</em>' : ""}</label><div class="nc-chips">${["Male", "Female"].map(g => `<button type="button" class="nc-chip${FL.v.gender === g ? " on" : ""}" data-gender="${g}">${g}</button>`).join("")}</div></div>`;
    if(k === "dob") return `<div class="${cls}" data-k="${k}" style="--i:${i}">${lab}<input type="date" class="nc-in" id="ncF_${k}" data-fk="${k}" value="${esc(FL.v.dob)}" max="${todayIST()}" /></div>`;
    if(k === "whatsapp") return `<div class="${cls}" data-k="${k}" style="--i:${i}">${lab}<div class="nc-wa"><select class="nc-in nc-cc" data-fk="whatsappCC" aria-label="Country code">${["91","971","966","974","965","968","973","44","1","60","65"].map(c => `<option value="${c}"${FL.v.whatsappCC === c ? " selected" : ""}>+${c}</option>`).join("")}</select><input class="nc-in" id="ncF_${k}" data-fk="${k}" inputmode="tel" value="${esc(FL.v.whatsapp)}" autocomplete="off" /></div></div>`;
    if(k === "address" || k === "notes") return `<div class="${cls}" data-k="${k}" style="--i:${i}">${lab}<textarea class="nc-in" rows="2" id="ncF_${k}" data-fk="${k}"${k === "address" ? ' autocomplete="street-address"' : ""}>${esc(FL.v[k])}</textarea></div>`;
    return `<div class="${cls}" data-k="${k}" style="--i:${i}">${lab}<input class="nc-in" id="ncF_${k}" data-fk="${k}" value="${esc(FL.v[k])}" ${k === "email" ? 'type="email" inputmode="email" autocomplete="email" placeholder="name@example.com"' : 'autocomplete="off"'} /></div>`;
  }).join("") + `<p class="nc-note">${isTest(st) ? "A test student is only in this demo." : "Saved in Academic Service with a history line — the class sheet shows the new name at once."}</p>`;
  const b = document.querySelector('#ncFill [data-fl="save"]'); b.disabled = false; b.textContent = "Save";
  openModal("ncFill");
}
async function saveFill(btn){
  const st = FL.st || {}, f = {};
  EDF.concat([["whatsappCC"]]).forEach(([k]) => { const v = String(FL.v[k] || "").trim(); if(v !== String(st[k] || (k === "whatsappCC" ? "91" : "")).trim()) f[k] = v; });
  if(!Object.keys(f).length){ closeModal("ncFill"); toast("Nothing changed"); return; }
  if(f.name !== undefined && f.name.length < 2){ showErr("Type the student's name"); return; }
  btn.disabled = true; btn.textContent = "Saving…";
  let out = await mqAdminFn("student_edit", { studentId: FL.id, fields: f }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(out && out.missing && !isTest(st)){
    /* the server is one step behind (clsdemo-onetruth-v1.sql not run yet): the empty details still save, as before */
    const empty = {}; PEND.forEach(([k]) => { if(f[k] && !String(st[k] || "").trim()) empty[k] = f[k]; });
    out = Object.keys(empty).length ? await mqAdminFn("student_fill", { studentId: FL.id, fields: empty }).catch(() => null)
      : { result: "error", error: "Run clsdemo-onetruth-v1.sql in Supabase to change these details" };
  }
  btn.disabled = false; btn.textContent = "Save";
  if(!out || out.result !== "success"){ showErr(out && out.missing ? "Run clsdemo-onetruth-v1.sql in Supabase" : (out && out.error) || "Not saved"); return; }
  TA.students[FL.id] = Object.assign({}, TA.students[FL.id], out.student || {});
  closeModal("ncFill");
  toast(out.left ? "Saved · " + out.left + " detail" + (out.left === 1 ? "" : "s") + " still pending" : "Saved");
  if(f.name !== undefined){ try{ await loadClasses(); }catch(x){} }
  clsAfterLoad();
  if(S && S.step === 3 && S.mode !== "copy" && $("ncModal").classList.contains("show")) paint(true);
  function showErr(m){ const body = $("ncFillB"), old = body.querySelector(".nc-err"); if(old) old.remove(); body.insertAdjacentHTML("beforeend", `<span class="nc-err" role="alert">${esc(m)}</span>`); }
}

/* =================================================================
   REMOVE ALL TEST STUDENTS — their classes, marks, class sheets and calendars
   ================================================================= */
async function removeAllTests(){
  await loadTests(true);
  if(!TS.n){ toast("There are no test students"); return; }
  const ids = Object.values(TA.students || {}).filter(isTest).map(x => x.id);
  askConfirm("Remove all test students?", TS.n + " test student" + (TS.n === 1 ? "" : "s") + " (" + ids.slice(0, 6).join(", ") + (ids.length > 6 ? " …" : "") +
    "), their classes, marks, class sheets and calendars go. Real students and Academic Service are not touched.", async () => {
    const out = await mqAdminFn("test_students", { action: "remove_all", confirm: "REMOVE" }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
    if(!out || out.result !== "success"){ toast((out && out.error) || "Not removed", true); return; }
    let n = 0;
    for(const sid of (out.removed || [])){ const c = demoSheet(sid); if(c){ await deleteClassApi(c["Class ID"]).catch(() => null); n++; } }
    (out.removed || []).forEach(sid => { delete TA.students[sid]; });
    TS.at = 0; await loadTests(true);
    toast((out.removed || []).length + " test student" + ((out.removed || []).length === 1 ? "" : "s") + " removed" + (n ? " · " + n + " class sheet" + (n === 1 ? "" : "s") : ""));
    try{ await reloadAs(); }catch(x){}
    await loadClasses(); clsAfterLoad(); attQuiet("refresh");
    if(S && $("ncModal") && $("ncModal").classList.contains("show") && S.step === 1 && S.mode !== "copy"){ const r = $("ncRes"); if(r) r.innerHTML = results(); }
  });
}

/* each class sheet row: "Test ID", "Test copy", "Details pending" */
(function(){
  const row = window.CLS_ROW;
  window.CLS_ROW = function(c){
    let h = row ? row(c) : "";
    if(!TA.loaded) return h;
    const mq = String(c["mqId"] || c["Student ID"] || "").toUpperCase(), st = TA.students[mq], p = planOfSheet(c);
    if(isTest(st) || /^TEST-/.test(mq)) h += '<span class="row-note tid" title="Test student — only in this demo, never in Academic Service">Test ID</span>';
    else if(p && p.testCopy) h += `<span class="row-note tc" title="Test copy of live class ${esc(p.copyOf || "")} — no fee, not in Academic Service">Test copy</span>`;
    if(st && !isTest(st) && (st.detailsPending || st.addedVia === "class-sheet") && pendingOf(st).length)
      h += `<button type="button" class="row-note pend" data-ncfill="${esc(mq)}" title="${esc(pendingOf(st).map(m => m[1]).join(", "))} — tap to fill">Details pending</button>`;
    return h;
  };
  document.addEventListener("click", ev => { const b = ev.target.closest("[data-ncfill]"); if(!b) return; ev.preventDefault(); ev.stopPropagation(); fillOpen(b.dataset.ncfill); }, true);
})();

/* =================================================================
   THE CLASS DAYS CHANGED IN THE ATTENDANCE → the calendars follow from today
   ================================================================= */
window.addEventListener("message", async function(ev){
  if(ev.origin !== location.origin || !ev.data || ev.data.type !== "mq-att" || ev.data.ev !== "days-changed") return;
  const d = ev.data, c = demoSheet(d.studentId);
  if(!c || !window.CalSync){ return; }
  try{
    const r = await CalSync.follow(c["Class ID"], d.days || []);
    const n = r.updated + r.split;
    if(n) snack(c["Student Name"] + "'s calendar now follows the new class days (" + (d.days || []).join(" · ") + ") from today.",
      [["Calendar", () => { location.href = "calendars.html?id=" + encodeURIComponent(c["Class ID"]); }]]);
  }catch(err){ toast("The calendar did not follow the new days: " + String(err && err.message || err), true); }
});

window.NC.monthPlan = monthPlan;
})();
