/* newclass.v1.js — the demo admin class sheet makes a class in ONE window, ONE save.
   Loaded after teachers-admin.v8.js on /portal/demo/classes/.

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
if(!A){ console.error("newclass.v1.js needs teachers-admin.v8.js first"); return; }
const { TA, taLoad, sheetsOf, sameCourse, studentPhone, reloadAs, clsAfterLoad, paintWorkspace, attQuiet, siLoad,
        planOfSheet, planRunning, planDays, dayName } = A;
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
    join: todayIST(), links: [""], len: "end", lenN: 30, group: "", req: reqId(), made: {}, busy: false, fail: null, bad: {},
    fromAtt: !!(pre && pre.fromAtt) };
}

/* ---- data from the page (teachers-admin) ---- */
function students(){ return Object.values(TA.students || {}).filter(s => s && s.id && !s._gone); }
function teachers(){ return (TA.teachers || []).filter(t => (t.status || "Active") === "Active" && !t._gone); }
function courseList(){ return (typeof courses !== "undefined" ? courses : []).filter(c => c.active).map(c => c.name); }
function stSheet(st){ return String(st.sheet || ""); }
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
  if(pre && pre.studentId){ const st = (TA.students || {})[pre.studentId]; if(st) pickStudent(st.id, true); }
  paint(true);
  openModal("ncModal");
  setTimeout(() => { const f = $("ncFind"); if(f && !S.student) f.focus({ preventScroll: true }); }, 280);
}
window.NC = { open: open, monthCalendars: monthCalendars };
window.CLS_NEW = function(){ open(null); };

/* ---- painting ---- */
function paint(first){
  const body = $("ncBody");
  body.innerHTML = '<div class="nc-pane ' + (first ? "" : S.dir > 0 ? "in-r" : "in-l") + '">' +
    (S.step === 1 ? pane1() : S.step === 2 ? pane2() : pane3()) + '</div>';
  $("ncFoot").innerHTML = foot();
  document.querySelectorAll("#ncSteps li").forEach(li => {
    const n = +li.dataset.s;
    li.classList.toggle("on", n === S.step); li.classList.toggle("done", n < S.step || (n === 3 && !!S.made.done));
  });
  $("ncBar").style.width = (S.step === 1 ? 33 : S.step === 2 ? 66 : 100) + "%";
  if(!first){ const m = document.querySelector("#ncModal .modal"); if(m) m.scrollTop = 0; body.scrollTop = 0; }
}
function repaintPart(sel, html){ const el = document.querySelector(sel); if(el) el.outerHTML = html; }

/* ---------- part 1: the class ---------- */
function pane1(){
  return `<p class="nc-lead">Who, with whom, which days. The office sees it at once and sets the fee.</p>
    ${studentBox()}
    ${teacherBox()}
    <div class="nc-f"><label>Course</label><div class="nc-chips" id="ncCourses">${courseList().map(c =>
      `<button type="button" class="nc-chip${S.course === c ? " on" : ""}" data-nc="course" data-v="${esc(c)}">${esc(c)}</button>`).join("") || '<span class="nc-hint">No courses yet — add one in the menu → Courses.</span>'}</div>${errLine("course")}</div>
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
      <span class="nc-av">${esc(initialsOf(st.name))}</span><span class="nc-pm"><b>${esc(st.name)}</b><small>${esc(st.id)}${phoneOf(st) ? " · " + esc(phoneOf(st)) : ""}${stSheet(st) === "demo" ? " · demo" : ""}</small></span>
      <button type="button" class="nc-x" data-nc="unstudent" aria-label="Change the student">Change</button></div></div>`;
  }
  if(S.newSt){
    const n = S.newSt, dup = dupOf(n);
    return `<div class="nc-f nc-new" id="ncStu"><label>New student <small>gets the next MQ number</small></label>
      <div class="nc-newcard">
        <input class="nc-in" id="ncNName" value="${esc(n.name)}" placeholder="Student's name" autocomplete="off" />${errLine("name")}
        <div class="nc-wa"><select class="nc-in nc-cc" id="ncNCC" aria-label="Country code">${["91","971","966","974","965","968","973","44","1","60","65"].map(c => `<option value="${c}"${n.cc === c ? " selected" : ""}>+${c}</option>`).join("")}</select>
          <input class="nc-in" id="ncNWa" inputmode="tel" value="${esc(n.wa)}" placeholder="WhatsApp number" autocomplete="off" /></div>
        <div class="nc-dob"><label for="ncNDob">Date of birth <small>optional · for the student sign-in later</small></label><input type="date" class="nc-in" id="ncNDob" value="${esc(n.dob)}" max="${todayIST()}" /></div>
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
  if(!q) return `<button type="button" class="nc-addnew" data-nc="newst"><span>＋</span> New student</button>`;
  const hits = students().filter(s => String(s.name || "").toLowerCase().indexOf(q) >= 0 || String(s.id).toLowerCase() === q ||
      (qd.length >= 4 && (digitsOf(s.whatsapp).indexOf(qd) >= 0 || digitsOf(s.phone).indexOf(qd) >= 0)))
    .sort((a, b) => (stSheet(a) === "live") - (stSheet(b) === "live") || String(a.name).localeCompare(String(b.name))).slice(0, 6);
  return hits.map((s, i) => {
    const live = stSheet(s) === "live";
    return `<button type="button" class="nc-hit" style="--i:${i}" data-nc="student" data-v="${esc(s.id)}"${live ? " disabled" : ""}>
      <span class="nc-av sm">${esc(initialsOf(s.name))}</span><span class="nc-pm"><b>${esc(s.name)}</b><small>${esc(s.id)}${phoneOf(s) ? " · " + esc(phoneOf(s)) : ""}</small></span>
      ${live ? '<em class="nc-tag">Live sheet</em>' : stSheet(s) === "demo" ? '<em class="nc-tag d">Demo</em>' : ""}</button>`;
  }).join("") + `<button type="button" class="nc-addnew" data-nc="newst"><span>＋</span> New student “${esc(S.q.trim())}”</button>`;
}
function dupOf(n){
  const wd = digitsOf(n.wa), nm = String(n.name || "").trim().toLowerCase();
  return students().find(s => (wd.length >= 8 && (digitsOf(s.whatsapp).slice(-wd.length) === wd || digitsOf(s.phone).slice(-wd.length) === wd)) ||
                              (nm.length >= 4 && String(s.name || "").trim().toLowerCase() === nm)) || null;
}

function teacherBox(){
  const q = S.tq.trim().toLowerCase();
  const list = teachers().filter(t => !q || String(t.name).toLowerCase().indexOf(q) >= 0 || String(t.id).toLowerCase() === q);
  return `<div class="nc-f" id="ncTea"><label for="ncTFind">Teacher</label>
    ${teachers().length > 8 ? `<div class="nc-search sm"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input class="nc-in" id="ncTFind" value="${esc(S.tq)}" placeholder="Find a teacher" autocomplete="off" /></div>` : ""}
    <div class="nc-tlist">${list.map((t, i) => {
      const busy = busyAt(t.id), on = S.teacherId === t.id;
      return `<button type="button" class="nc-t${on ? " on" : ""}${busy ? " busy" : ""}" style="--i:${Math.min(i, 12)}" data-nc="teacher" data-v="${esc(t.id)}" aria-pressed="${on}">
        <span class="nc-av sm">${esc(initialsOf(t.name))}</span><span class="nc-pm"><b>${esc(t.name)}</b><small>${busy ? "Has a class at " + esc(formatTime(busy.time)) : esc(t.id)}</small></span></button>`;
    }).join("") || '<span class="nc-hint">No teacher with that name.</span>'}</div>${errLine("teacher")}</div>`;
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
        <small>${esc([t.name, S.course, S.days.map(d => d.slice(0, 2)).join(" "), formatTime(S.time), S.dur + " min"].filter(Boolean).join(" · "))}</small></span>
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
function stepState(k){
  const m = S.made;
  if(m[k]) return "ok";
  if(S.fail && S.fail.step === k) return "bad";
  if(S.busy && S.at === k) return "run";
  return "wait";
}
function pane3(){
  const m = S.made;
  const line = k => k === "student" ? (m.studentId ? who().name + " · " + m.studentId : who().name)
    : k === "class" ? (m.planId ? m.planId + " · the office sets the fee" : S.course + " with " + ((teachers().find(x => x.id === S.teacherId) || {}).name || ""))
    : k === "sheet" ? (m.classId ? "Ready" : "Its own page for the student")
    : (m.calendar ? m.calendar : calDays() + " days from " + fmt(S.join));
  return `<ol class="nc-run">${STEPS.map(([k, l], i) => `<li class="nc-rs ${stepState(k)}" style="--i:${i}"><span class="nc-dot" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>
      <span class="nc-pm"><b>${esc(l)}</b><small>${esc(line(k))}</small></span></li>`).join("")}</ol>
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
    <small>Attendance, the class sheet and the calendar are all in step.</small>
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
  if(stSheet(st) === "live"){ toast(st.name + " belongs to the live class sheet", true); return; }
  S.student = st; S.newSt = null; S.q = ""; delete S.bad.student;
  const has = sheetsOf(String(id).toUpperCase()).filter(c => (c["Status"] || "Active") === "Active");
  if(has.length && !quiet) toast(st.name + " already has " + has.map(c => c["Course"]).join(", ") + " — pick a different course for a second class");
}
function clearErr(el){ const f = el && el.closest && el.closest(".nc-f"); if(f) f.querySelectorAll(".nc-err").forEach(x => x.remove()); }
function onClick(ev){
  const b = ev.target.closest("[data-nc]"); if(!b || b.disabled) return;
  const a = b.dataset.nc, v = b.dataset.v;
  if(a !== "next" && a !== "save") clearErr(b);
  if(a === "close"){ close(); return; }
  if(a === "student"){ pickStudent(v); repaintPart("#ncStu", studentBox()); refreshTeachers(); return; }
  if(a === "unstudent"){ S.student = null; S.newSt = null; repaintPart("#ncStu", studentBox()); const f = $("ncFind"); if(f) f.focus(); return; }
  if(a === "newst"){ const q = S.q.trim(); S.newSt = { name: /\d{5,}/.test(q) ? "" : q, wa: /\d{5,}/.test(q) ? digitsOf(q) : "", cc: "91", dob: "" }; delete S.bad.student;
    repaintPart("#ncStu", studentBox()); const f = $(S.newSt.name ? "ncNWa" : "ncNName"); if(f) f.focus(); return; }
  if(a === "usedup"){ pickStudent(v); repaintPart("#ncStu", studentBox()); return; }
  if(a === "teacher"){ S.teacherId = S.teacherId === v ? "" : v; delete S.bad.teacher; refreshTeachers(); return; }
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
  $("ncBody").innerHTML = '<div class="nc-pane still">' + pane2() + '</div>';
  if(id){ const el = id[0] === "L" && !$(id) ? document.querySelector('#ncLinks input[data-link="' + id.slice(1) + '"]') : $(id); if(el && el.focus){ el.focus(); try{ el.setSelectionRange(pos, pos); }catch(x){} } }
}
function readLinks(){ document.querySelectorAll("#ncLinks input[data-link]").forEach(i => { S.links[+i.dataset.link] = i.value; }); }
let previewT = 0;
function onInput(ev){
  const t = ev.target;
  /* "change" only for dates, times and lists — a text box's change (on leaving it) would repaint the list under the finger */
  if(ev.type === "change" && !/^(date|time|select-one)$/.test(t.type)) return;
  clearErr(t);
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
  if(S.student && S.course){
    const same = sheetsOf(String(S.student.id).toUpperCase()).find(c => (c["Status"] || "Active") === "Active" && sameCourse(c["Course"], S.course));
    if(same) S.bad.course = S.student.name + " already has a " + same["Course"] + " class sheet";
  }
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
        student: S.student ? { id: S.student.id } : { name: st.name, whatsapp: st.whatsapp, whatsappCC: st.whatsappCC, dob: st.dob },
        plan: { teacherId: S.teacherId, course: S.course, days: S.days, time: S.time, duration: S.dur, startDate: S.join } });
      if(!out || out.result !== "success") throw step("student", out && out.missing ? "The server is not ready: run clsdemo-newclass-v1.sql in Supabase." : (out && out.error) || "Could not reach the server");
      m.studentId = out.studentId; m.student = true;
      if(!S.student && out.student){ TA.students[out.studentId] = out.student; }
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
window.NC.monthPlan = monthPlan;
})();
