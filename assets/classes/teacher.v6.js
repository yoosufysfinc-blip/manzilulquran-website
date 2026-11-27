/* =================================================================
   ░░  ManzilulQuran — TEACHER PAGE  v6  ░░
   -----------------------------------------------------------------
   The teacher's own page (/teacher/ — demo first at /portal/demo/teacher/).
   Needs engine.v1.js, api.v9.js and catalog.v2.js loaded before it.

   DOORS: the direct link (?tp=TOKEN) or a sign-in with phone number /
   teacher ID + date of birth. Either gives a session kept on this phone;
   the date of birth is checked on the server, never here.

   SHOWS, for the teacher's own students only (from Academic Service):
   today's classes, each student's limited class sheet (class & join,
   invite, study material, attendance as the office marked it),
   notices + updates + leave requests (leave also opens WhatsApp to the
   office), and the teacher's free time for new classes.
   NEVER: fees, salary, phone numbers, other teachers' students.
   v3: chat with each student (chat.v1.js) — text, voice, invite cards,
   kept 3 days; unread badges; Invite → in chat / WhatsApp / both.
   v4: the class days are on the student's Class tab (weekly days, time,
   the next class dates from the class sheet's calendar); the invite
   picks which class day it is for, and the WhatsApp text and the chat
   card both carry the weekly days (chat.v2.js).

   v5: the class sheet (calendar → today's link) is read through the
   teacher's own sign-in (clsdemo_tsheet, keyed by plan), so a student
   sheet with the student sign-in on still gives the teacher the link.
   COVER CLASSES: a class the office asked this teacher to cover shows in
   Today with first name, course, time, the office's note and — on that
   day only — the Join and the study material (clsdemo_tsubjoin). No chat,
   invite, phone or share link. Own classes covered by someone show
   "Covered by …". Today ends with the cover list (coming + last 45 days).
   v6: PAUSE + STOP from the attendance. A paused day is not a class day
   (not in Today, no Join, not "unmarked"); the student shows "Paused ·
   restarts …"; a stopped class shows its last day, then leaves the page
   (clsdemo_tme sends status, endDate and pauses — clsdemo-pause-stop-v1.sql).
   PUBLISHED FILES ARE IMMUTABLE. Create teacher.v7.js to change this.
   ================================================================= */
(function(){
"use strict";
const OFFICE_WA = "917025070415";
const SKEY = "mq_teacher_" + (window.MQ_SUPABASE_PREFIX || "");
const DOWS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_MARK = { "Completed":"P", "Student Absent":"A", "Teacher Absent":"T", "Student Leave":"L", "Substitute":"S", "Note":"N", "Rescheduled":"R", "Cancelled":"C" };
const HELD = { P:1, S:1, E:1, X:1 };
const e = s => escapeHtml(s == null ? "" : String(s));
const pad = n => String(n).padStart(2, "0");
const app = () => document.getElementById("app");

const T = { session: "", me: null, month: "", tab: "today", plan: null, stab: "class", menu: false,
            leave: null, draft: null, sheets: {}, busy: false, profile: false, unread: {}, chat: null,
            subs: null, cover: null, coverJoin: {} };

/* ---------------- small helpers ---------------- */
function today(){ return istTodayISO(); }
function curMonth(){ return today().slice(0, 7); }
function dowOf(ds){ return DOWS[new Date(ds + "T00:00:00Z").getUTCDay()]; }
function monthDays(m){ const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
function shiftMonth(m, n){ let [y, mo] = m.split("-").map(Number); mo += n; while(mo < 1){ mo += 12; y--; } while(mo > 12){ mo -= 12; y++; } return y + "-" + pad(mo); }
function addDaysISO(ds, n){ return new Date(Date.parse(ds + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10); }
function fmtD(ds){ try{ return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" }); }catch(x){ return ds; } }
function fmtRange(l){ return l.from === l.to ? fmtD(l.from) : fmtD(l.from) + " – " + fmtD(l.to); }
function dayCount(l){ return Math.round((Date.parse(l.to) - Date.parse(l.from)) / 864e5) + 1; }
function ago(ts){ const s = (Date.now() - new Date(ts).getTime()) / 1000; if(s < 90) return "just now"; if(s < 3600) return Math.round(s/60) + " min ago"; if(s < 86400) return Math.round(s/3600) + " h ago"; return new Date(ts).toLocaleDateString("en-IN", { day:"numeric", month:"short" }); }
function initials(n){ return String(n || "?").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
function toMin(t){ const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function minTo(m){ return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
function dayName(d){ if(typeof d === "number") return DOWS[d] || ""; const s = String(d || "").slice(0, 3); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function planDays(p){ return (p.days || []).map(dayName).filter(Boolean); }
function planTime(p){ return p.time || (p.sheet && p.sheet.classTime) || ""; }
function perms(){ return (T.me && T.me.perms) || {}; }
function plans(){ return (T.me && T.me.plans) || []; }
function planOf(id){ return plans().find(p => p.planId === id); }
function markOf(status, activity){ if(status === "Completed") return activity === "Exam" ? "E" : activity === "Test" ? "X" : "P"; return STATUS_MARK[status] || ""; }
function toast(msg){ const d = document.createElement("div"); d.className = "toast"; d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 2600); }
const IC = {
  today:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14.6c2 .7 3.2 2.6 3.5 5.4"/>',
  bell:'<path d="M6 16V11a6 6 0 0112 0v5l2 2H4z"/><path d="M10 21h4"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  back:'<path d="M15 18l-6-6 6-6"/>', video:'<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>',
  send:'<path d="M4 12l16-8-6 16-3-7z"/>', wa:'<path d="M20 11.6a8.3 8.3 0 01-12.3 7.2L3.5 20l1.3-4A8.3 8.3 0 1120 11.6z"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  chat:'<path d="M4 5h16v11H9l-5 4z"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  invite:'<path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M12 12v6M9 15h6"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

/* ---------------- session ---------------- */
function readSession(){ try{ return localStorage.getItem(SKEY) || ""; }catch(x){ return ""; } }
function writeSession(s){ try{ if(s) localStorage.setItem(SKEY, s); else localStorage.removeItem(SKEY); }catch(x){} T.session = s || ""; }

/* ---------------- screens without data ---------------- */
function crest(){ return '<div class="crest"><img src="/logo.png" alt="ManzilulQuran" onerror="this.style.display=\'none\'"></div>'; }
function showLoading(text){ document.getElementById("nav").hidden = true; app().innerHTML = `<div class="center"><div class="state-box"><div class="spin"></div><p>${e(text || "Opening…")}</p></div></div>`; }
function showState(title, text, withLogin){
  document.getElementById("nav").hidden = true;
  app().innerHTML = `<div class="center pop"><div class="state-box">${crest()}<h2>${e(title)}</h2><p>${e(text)}</p>
    <a class="btn pri" href="https://wa.me/${OFFICE_WA}" target="_blank" rel="noopener">${ic("wa")} Contact office</a>
    ${withLogin ? '<div style="margin-top:12px"><button class="btn gh sm" data-t="tologin">Sign in another way</button></div>' : ""}</div></div>`;
}
function showLogin(msg){
  document.getElementById("nav").hidden = true;
  app().innerHTML = `<div class="center pop">
    ${crest()}<h1>Teacher Profile</h1><p class="sub">ManzilulQuran E-learning Academy</p>
    <form class="card" id="loginForm" autocomplete="off">
      <div class="field"><label for="lid">Phone number or teacher ID</label><input id="lid" inputmode="text" placeholder="e.g. 9847012345 or MQ8086" autocomplete="username"></div>
      <div class="field"><label for="ldob">Date of birth</label><input id="ldob" type="date" max="${today()}"><div class="hint">The date of birth the academy has on your teacher profile.</div></div>
      <div class="err" id="lerr">${e(msg || "")}</div>
      <button class="btn pri block" id="lbtn">Open my profile</button>
    </form>
    <p class="note" style="text-align:center">No profile yet? Ask the office to make one for you.</p></div>`;
  document.getElementById("loginForm").onsubmit = async function(ev){
    ev.preventDefault();
    const id = document.getElementById("lid").value.trim(), dob = document.getElementById("ldob").value;
    const err = document.getElementById("lerr"), btn = document.getElementById("lbtn");
    if(!id || !dob){ err.textContent = "Enter both."; return; }
    btn.disabled = true; btn.textContent = "Checking…"; err.textContent = "";
    const r = await teacherLogin(id, dob, deviceId());
    btn.disabled = false; btn.textContent = "Open my profile";
    if(r && r.result === "success"){ writeSession(r.session); T.month = curMonth(); return load(); }
    const why = r && r.error;
    if(why === "paused") return showState("Profile paused", "Your teacher profile is not active right now. Please contact the academy office.", true);
    err.textContent = why === "locked" ? "Too many tries. Please wait 30 minutes and try again."
      : why === "wrong" ? "Those details don't match a teacher profile."
      : why === "not_set_up" ? "Teacher profiles are not switched on yet."
      : "Could not reach the academy. Check the internet and try again.";
  };
}

/* ---------------- load ---------------- */
async function load(month){
  if(!T.me) showLoading("Opening your profile…");
  const out = await teacherMe(T.session, month || T.month || curMonth());
  if(!out || out.result !== "success"){
    const why = out && out.error;
    if(why === "signed_out"){ writeSession(""); T.me = null; return showLogin("Please sign in again."); }
    if(why === "not_set_up") return showState("Not switched on yet", "Teacher profiles are not set up on the server yet. Please contact the office.");
    if(!T.me) return showState("Can't connect", "Could not reach the academy. Check the internet and reload.");
    toast("Could not refresh — showing the last copy"); return;
  }
  T.me = out; T.month = out.month;
  render();
  prefetchSheets();
  loadUnread();
  loadSubs();
}
/* v5: cover classes (both ways) */
async function loadSubs(){
  const out = await teacherSubs(T.session);
  if(out && out.result === "success"){
    const before = JSON.stringify(T.subs);
    T.subs = { cover: out.cover || [], covered: out.covered || [], today: out.today || today() };
    if(JSON.stringify(T.subs) !== before && T.me && !T.leave && !T.profile && (T.tab === "today" || T.tab === "students")) keepScroll(renderMain);
    if(T.plan) renderStudent();
  } else if(out && out.error === "signed_out"){ /* load() handles it */ }
  else T.subs = T.subs || { cover: [], covered: [], today: today(), off: true };
}
function coversToday(){ return ((T.subs && T.subs.cover) || []).filter(x => x.date === today()); }
function coveredOn(planId, ds){ return ((T.subs && T.subs.covered) || []).find(x => x.planId === planId && x.date === ds); }
async function loadUnread(){
  if(!T.session || perms().chat === false) return;
  const out = await teacherChat(T.session, { action: "unread" });
  if(out && out.result === "success"){
    const before = JSON.stringify(T.unread); T.unread = out.unread || {};
    if(JSON.stringify(T.unread) !== before && !T.leave && !T.profile && T.tab !== "time") keepScroll(renderMain);
  }
}
setInterval(() => { if(!document.hidden && T.me) loadUnread(); }, 45000);
function unreadOf(id){ return (T.unread && T.unread[id]) || 0; }
/* today's link + calendars come from the student's class sheet — read through
   the teacher's own sign-in (v5), so the student sign-in never blocks it.
   Old servers without clsdemo_tsheet: the public read, as before. */
function sheetOf(p){ return p ? T.sheets[p.planId] : undefined; }
async function sheetData(p){
  const tok = p.sheet && p.sheet.token; if(!tok) return null;
  if(T.sheets[p.planId] !== undefined) return T.sheets[p.planId];
  let d = null;
  try{
    d = await teacherSheet(T.session, p.planId);
    if(d && d.error === "not_set_up") d = await fetchClass(tok);
  }catch(x){ d = null; }
  const ok = d && d.result === "success";
  T.sheets[p.planId] = ok ? Object.assign({}, d.data || d) : null;   // the sheet's own fields (calendars, studyMaterial …)
  return T.sheets[p.planId];
}
async function prefetchSheets(){
  const todays = plans().filter(classToday);
  await Promise.all(todays.map(sheetData));
  if(T.tab === "today" && !T.plan) renderMain();
}

/* ---------------- class-time logic ---------------- */
function classToday(p){ return isClassOn(p, today()); }
/* v6: a paused day or a day after the last class is no class day */
function pauseOn(p, ds){ return (Array.isArray(p.pauses) ? p.pauses : []).find(x => x && x.from && ds >= x.from && (!x.until || ds <= x.until)) || null; }
function pauseNext(p, ds){ return (Array.isArray(p.pauses) ? p.pauses : []).filter(x => x && x.from && (!x.until || x.until >= ds)).sort((a, b) => a.from < b.from ? -1 : 1)[0] || null; }
function noClass(p, ds){ if(p.endDate && ds > p.endDate) return "ended"; return pauseOn(p, ds) ? "paused" : ""; }
function isClassOn(p, ds){ return planDays(p).indexOf(dowOf(ds)) >= 0 && (!p.startDate || p.startDate <= ds) && !noClass(p, ds); }
function restartDay(x){ return x && x.until ? addDaysISO(x.until, 1) : ""; }
function planNote(p){
  const t = today(), pz = pauseNext(p, t);
  if(p.endDate) return { k: "end", text: "Last class " + fmtD(p.endDate) };
  if(pz && pz.from <= t) return { k: "pz", text: "Paused" + (pz.until ? " · restarts " + fmtD(restartDay(pz)) : " · until the office restarts it") };
  if(pz) return { k: "pz", text: "Pause from " + fmtD(pz.from) + (pz.until ? " · back " + fmtD(restartDay(pz)) : "") };
  return null;
}
function liveState(p){
  const s = toMin(planTime(p)); if(s === null) return "none";
  const n = istNowMinutes(), en = s + (+p.duration || 50);
  return n >= s && n < en ? "live" : n < s && s - n <= 60 ? "soon" : n >= en ? "done" : "later";
}
function todayLink(p){ const d = sheetOf(p); if(!d) return ""; const f = todaysClassDay(d.calendars || []); return f && f.day && f.day.link || ""; }
function nextClassDate(p){
  const d = sheetOf(p);
  if(d && d.calendars){
    for(const c of d.calendars){ if(!joinAllowed(c)) continue; const n = buildDays(c).find(x => !x.isOff && isoDate(x.date) >= today() && !noClass(p, isoDate(x.date))); if(n) return isoDate(n.date); }
  }
  for(let i = 0; i < 60; i++){ const ds = addDaysISO(today(), i); if(isClassOn(p, ds)) return ds; }
  return today();
}
/* the next n class days: the class sheet's calendar when it is loaded, else the plan's weekdays */
function upcomingDates(p, n){
  const out = [], d = sheetOf(p), t = today();
  if(d && d.calendars){
    d.calendars.forEach(c => { if(!joinAllowed(c)) return; buildDays(c).forEach(x => { const ds = isoDate(x.date); if(!x.isOff && ds >= t && !noClass(p, ds) && out.indexOf(ds) < 0) out.push(ds); }); });
    out.sort();
  }
  if(!out.length){ for(let i = 0; i < 60 && out.length < n; i++){ const ds = addDaysISO(t, i); if(isClassOn(p, ds)) out.push(ds); } }
  return out.slice(0, n);
}
function invDate(p){ const up = upcomingDates(p, 6); return T.invDate && up.indexOf(T.invDate) >= 0 ? T.invDate : (classToday(p) ? today() : (up[0] || nextClassDate(p))); }
function weekLine(p){ const d = planDays(p); return d.length ? "Every " + d.join(" · ") + (planTime(p) ? " · " + formatTime(planTime(p)) : "") : ""; }
function classesLeftFor(p){
  const d = sheetOf(p); if(!d || !d.calendars) return null;
  const run = d.calendars.find(c => calStatus(c) === "Active"); return run ? classesLeft(run) : 0;
}

/* =================================================================
   MAIN
   ================================================================= */
function render(){
  if(!T.me) return;
  renderMain();
  if(T.plan) renderStudent();
}
function renderMain(){
  const me = T.me, nav = document.getElementById("nav");
  nav.hidden = !!(T.leave || T.profile);    // a bottom sheet is open: it takes the whole bottom
  const un = me.unseen || 0;
  nav.innerHTML = `<div class="in">${[["today","Today","today"],["students","Students","users"],["notices","Notices","bell"],["time","My time","cal"]]
    .map(([k, l, i]) => { const n = k === "notices" ? un : k === "students" ? Object.values(T.unread || {}).reduce((a, b) => a + b, 0) : 0;
      return `<button data-t="tab" data-v="${k}" class="${T.tab === k ? "on" : ""}">${ic(i)}${l}${n ? `<span class="dotb">${n}</span>` : ""}</button>`; }).join("")}</div>`;
  const d = new Date(Date.now() + 330 * 60000);
  const held = (me.attendance || []).filter(a => a[1] && a[1].slice(0, 7) === curMonth() && HELD[markOf(a[2], a[3])]).length;
  const todays = plans().filter(classToday);
  const head = `<header class="top"><button class="av" data-t="me" aria-label="My profile">${e(initials(me.teacher.name))}</button>
    <div class="who"><b>${e(me.teacher.name)}</b><small>${DOWS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)} · academy time</small></div>
    <div class="clock"><b class="mono" id="clk">${e(formatTime(minTo(istNowMinutes())))}</b>IST</div></header>`;
  let body = "";
  if(T.tab === "today" || T.tab === "students"){
    const cov = ((T.subs && T.subs.cover) || []).filter(x => x.date.slice(0, 7) === curMonth() && x.date <= today()).length;
    body = `<div class="chips${cov ? " four" : ""}"><div><b>${plans().length}</b><small>Students</small></div><div><b>${todays.length + coversToday().length}</b><small>Today</small></div><div><b>${T.month === curMonth() ? held : "—"}</b><small>Held · ${MONTHS[d.getUTCMonth()].slice(0, 3)}</small></div>${cov ? `<div><b>${cov}</b><small>Covers</small></div>` : ""}</div>`;
    body += (me.notes || []).filter(n => n.kind === "leave" && n.leave && n.leave.status === "pending").map(n => `<div class="banner">🗓 Leave ${e(fmtRange(n.leave))} · waiting for the office</div>`).join("");
    if(T.tab === "today"){
      const list = todays.slice().sort((a, b) => (toMin(planTime(a)) ?? 9999) - (toMin(planTime(b)) ?? 9999));
      const covs = coversToday().slice().sort((a, b) => (toMin(a.time) ?? 9999) - (toMin(b.time) ?? 9999));
      body += `<h2 class="h">Today's classes <small>${list.length}</small></h2>` + (list.length ? list.map(p => rowHtml(p, true)).join("") : '<div class="empty">No classes today.</div>');
      const offToday = plans().filter(p => planDays(p).indexOf(dowOf(today())) >= 0 && (!p.startDate || p.startDate <= today()) && noClass(p, today()) === "paused");
      if(offToday.length) body += `<div class="pzline">${offToday.map(p => `<button data-t="plan" data-id="${e(p.planId)}">${e(p.student.split(" ")[0])}</button>`).join("")}<span>paused today — no class</span></div>`;
      if(covs.length) body += `<h2 class="h">Cover classes today <small>${covs.length}</small></h2>` + covs.map(coverRow).join("");
      body += coverListHtml();
    } else {
      body += `<h2 class="h">My students <small>${plans().length}</small></h2>` + (plans().length ? plans().map(p => rowHtml(p, false)).join("") : '<div class="empty">No students yet. The office assigns students in Academic Service.</div>');
    }
  } else if(T.tab === "notices") body = noticesHtml();
  else body = timeHtml();
  app().innerHTML = head + `<main class="pop">${body}</main>` + (T.profile ? profileSheet() : "") + (T.leave ? leaveSheet() : "");
}
function rowHtml(p, withState){
  const st = liveState(p), t = planTime(p), cv = withState ? coveredOn(p.planId, today()) : null;
  const tag = !withState ? "" : cv ? `<span class="tag cov">COVER · ${e(cv.sub.split(" ")[0])}</span>` : st === "live" ? '<span class="tag live">LIVE</span>' : st === "soon" ? '<span class="tag soon">SOON</span>' : st === "done" ? '<span class="tag">DONE</span>' : "";
  return `<button class="row" data-t="plan" data-id="${e(p.planId)}"><span class="av sm">${e(initials(p.student))}</span>
    <span class="mid"><b>${e(p.student)}</b><small>${e(p.course || "")} · ${e(planDays(p).join(" "))}${!withState && t ? " · " + e(formatTime(t)) : ""}</small>${(() => { const n = withState ? null : planNote(p); return n ? `<span class="pn ${n.k}">${e(n.text)}</span>` : ""; })()}</span>
    ${unreadOf(p.planId) ? `<span class="ub" title="New messages">${unreadOf(p.planId)}</span>` : ""}
    ${withState ? `<span class="end"><b class="mono">${t ? e(formatTime(t)) : "—"}</b>${tag}</span>` : ""}</button>`;
}
function profileSheet(){
  const me = T.me;
  return `<div class="scrim" data-t="profclose"></div><div class="sheet"><div class="in"><div class="grab"></div>
    <h3>${e(me.teacher.name)}</h3><p class="dim" style="margin:-6px 0 14px">${e(me.teacher.id)} · ${plans().length} students</p>
    <a class="btn gh block" href="https://wa.me/${OFFICE_WA}" target="_blank" rel="noopener">${ic("wa")} Contact office</a>
    <button class="btn gh block" style="margin-top:8px" data-t="signout">Sign out of this phone</button>
    <p class="note">Fees, salary and students' phone numbers are not shown here. To change your details, contact the office.</p></div></div>`;
}

/* ---------------- v5: cover classes ---------------- */
function coverState(x){
  const s = toMin(x.time); if(s === null || x.date !== today()) return "";
  const n = istNowMinutes(), en = s + (+x.duration || 50);
  return n >= s && n < en ? "live" : n < s && s - n <= 60 ? "soon" : n >= en ? "done" : "";
}
function coverRow(x){
  const st = coverState(x);
  const tag = st === "live" ? '<span class="tag live">LIVE</span>' : st === "soon" ? '<span class="tag soon">SOON</span>' : st === "done" ? '<span class="tag">DONE</span>' : '<span class="tag cov">COVER</span>';
  return `<button class="row cover" data-t="cover" data-id="${e(x.id)}"><span class="av sm cov">${e(initials(x.student))}</span>
    <span class="mid"><b>${e(x.student)}</b><small>${e(x.course || "")} · for ${e(x.teacher)}</small></span>
    <span class="end"><b class="mono">${x.time ? e(formatTime(x.time)) : "—"}</b>${tag}</span></button>`;
}
function coverMark(x){
  if(x.marked && x.marked.status === "Substitute") return '<span class="tag ok">Marked</span>';
  if(x.marked && x.marked.status) return `<span class="tag">${e(x.marked.status)}</span>`;
  return x.date < today() ? '<span class="tag soon">Not marked</span>' : "";
}
function coverListHtml(){
  if(!T.subs || T.subs.off) return "";
  const mine = T.subs.cover || [], by = T.subs.covered || [];
  const coming = mine.filter(x => x.date > today()).sort((a, b) => a.date < b.date ? -1 : 1);
  const past = mine.filter(x => x.date < today()).sort((a, b) => a.date < b.date ? 1 : -1);
  const others = by.filter(x => x.date >= today()).sort((a, b) => a.date < b.date ? -1 : 1);
  if(!coming.length && !past.length && !others.length) return "";
  const line = (x, who) => `<div class="cvl"><span class="d">${e(fmtD(x.date))}</span><span class="mid">${e(x.time ? formatTime(x.time) : "")} · ${e(x.student)} · ${e(x.course || "")}<small>${who}</small></span>${coverMark(x)}</div>`;
  return `<h2 class="h">Covers</h2><div class="panel cvp">
    ${coming.length ? `<span class="k">Coming — you cover</span>${coming.map(x => line(x, "for " + e(x.teacher))).join("")}` : ""}
    ${others.length ? `<span class="k">Your classes covered by others</span>${others.map(x => line(x, "covered by " + e(x.sub))).join("")}` : ""}
    ${past.length ? `<span class="k">Covered by you · last 45 days</span>${past.map(x => line(x, "for " + e(x.teacher))).join("")}` : ""}
  </div>`;
}
async function openCover(id){
  const x = ((T.subs && T.subs.cover) || []).find(c => String(c.id) === String(id)); if(!x) return;
  T.cover = x.id; renderCover();
  if(x.date === today() && !T.coverJoin[x.id]){
    const out = await teacherSubJoin(T.session, x.id);
    T.coverJoin[x.id] = out && out.result === "success" ? { link: out.link || "", sm: out.studyMaterial || "" } : { error: (out && out.error) || "offline" };
    if(T.cover === x.id) renderCover();
  }
}
function renderCover(){
  let box = document.getElementById("cs");
  const x = ((T.subs && T.subs.cover) || []).find(c => c.id === T.cover);
  if(!x){ if(box) box.remove(); T.cover = null; return; }
  if(!box){ box = document.createElement("div"); box.id = "cs"; box.className = "ss"; document.body.appendChild(box); }
  const isToday = x.date === today(), j = T.coverJoin[x.id], st = coverState(x);
  const join = !isToday ? `<button class="btn gh" disabled>Join opens on ${e(fmtD(x.date))}</button>`
    : !j ? '<button class="btn gh" disabled>Loading link…</button>'
    : j.link ? `<a class="btn pri" href="${e(j.link)}" target="_blank" rel="noopener">${ic("video")} Join</a>`
    : `<button class="btn gh" disabled>${e(j.error === "not_today" ? "Join works on the class day" : j.error ? "Could not load the link" : "No link today — ask the office")}</button>`;
  const list = isToday && j && j.sm && typeof smParse === "function" ? smParse(j.sm) : [];
  const books = list.map(m => { const c = SM_CATALOG[m.course]; if(!c) return ""; const nums = m.lessons.length ? m.lessons : [];
    return `<a class="book" href="${e(c.path)}${nums.length ? "#lesson" + nums[0] : ""}" target="_blank" rel="noopener"><span class="bk">${e(c.title.charAt(0))}</span>
      <span class="mid"><b>${e(c.title)}</b><small>${nums.length ? "Lesson" + (nums.length > 1 ? "s " : " ") + nums.join(", ") : "Whole book"}</small></span>›</a>`; }).join("");
  box.innerHTML = `<div class="ss-in"><div class="ss-top"><button class="bk" data-t="coverclose" aria-label="Back">${ic("back")}</button>
      <span class="av sm cov">${e(initials(x.student))}</span><span class="mid"><b>${e(x.student)}</b><small>Cover class · ${e(x.course || "")}</small></span></div>
    <div class="sbody">
      <div class="panel"><span class="k">${isToday ? "Today" : e(fmtD(x.date))}</span>
        <div class="big">${x.time ? e(formatTime(x.time)) : "Time not set"}</div>
        <div class="dim" style="font-size:13px">${e(x.duration || 50)} min · for ${e(x.teacher)}${st === "live" ? ' <span class="tag live">LIVE</span>' : ""}</div>
        <div class="two">${join}</div></div>
      ${x.note ? `<div class="panel"><span class="k">Note from the office</span><div style="font-size:14px;line-height:1.55">${e(x.note).replace(/\n/g, "<br>")}</div></div>` : ""}
      ${isToday ? (books ? `<span class="k" style="display:block;margin:6px 2px 8px">Study material</span>${books}` : (j && !j.error ? '<div class="empty">No study material on this class sheet.</div>' : "")) : '<div class="empty">The join link and the study material open on the class day.</div>'}
      <p class="note">A cover class shows only what you need for this one class. After the class the office marks it in the attendance as taken by you.</p>
    </div></div>`;
}

/* ---------------- student (limited class sheet) ---------------- */
async function openPlan(id){
  T.plan = id; T.stab = "class"; T.menu = false; T.invDate = ""; T.sMonth = T.month;
  renderStudent();
  const p = planOf(id); if(p){ await sheetData(p); if(T.plan === id) renderStudent(); }
}
function renderStudent(){
  let box = document.getElementById("ss");
  const p = planOf(T.plan);
  if(!p){ if(box) box.remove(); T.plan = null; return; }
  const pr = perms();
  const tabs = [["class","Class"]];
  if(pr.material !== false) tabs.push(["material","Material"]);
  if(pr.att !== false) tabs.push(["att","Attendance"]);
  if(pr.chat !== false) tabs.push(["chat","Chat" + (unreadOf(p.planId) ? ` <span class="ub">${unreadOf(p.planId)}</span>` : "")]);
  if(!tabs.some(t => t[0] === T.stab)) T.stab = "class";
  if(!box){ box = document.createElement("div"); box.id = "ss"; box.className = "ss"; document.body.appendChild(box); }
  if(T.chat){ T.chat.destroy(); T.chat = null; }
  const body = T.stab === "class" ? classTab(p) : T.stab === "material" ? materialTab(p) : T.stab === "att" ? attTab(p) : '<div id="chatBox"></div>';
  box.innerHTML = `<div class="ss-in"><div class="ss-top"><button class="bk" data-t="close" aria-label="Back">${ic("back")}</button>
      <span class="av sm">${e(initials(p.student))}</span><span class="mid"><b>${e(p.student)}</b><small>${e(p.course || "")} · ${e(planDays(p).join(" "))}${planTime(p) ? " · " + e(formatTime(planTime(p))) : ""}</small></span></div>
    <div class="stabs">${tabs.map(([k, l]) => `<button data-t="stab" data-v="${k}" class="${T.stab === k ? "on" : ""}">${l}</button>`).join("")}</div>
    <div class="sbody${T.stab === "chat" ? " chat" : ""}">${body}</div></div>`;
  if(T.stab === "chat") mountChat(p);
}
function mountChat(p){
  const el = document.getElementById("chatBox"); if(!el) return;
  T.chat = MQChat.mount(el, {
    side: "t", names: { t: "You", s: p.student.split(" ")[0] },
    api: { list: after => teacherChat(T.session, { action: "list", planId: p.planId, after }),
           send: msg => teacherChat(T.session, Object.assign({ action: "send", planId: p.planId }, msg)),
           voice: id => teacherChat(T.session, { action: "voice", planId: p.planId, msgId: id }) },
    canInvite: perms().invite !== false, onInvite: () => chatInvite(p), toast: toast
  });
  if(T.unread[p.planId]){ T.unread[p.planId] = 0; }
}
function inviteMeta(p, ds){ return { date: ds || invDate(p), time: planTime(p) || "", days: planDays(p) }; }
async function chatInvite(p, ds){
  const out = await teacherChat(T.session, { action: "send", planId: p.planId, kind: "invite", meta: inviteMeta(p, ds) });
  if(out && out.result === "success"){ toast("Invite sent in chat"); if(T.chat) T.chat.refresh(); return true; }
  toast(out && out.error === "chat_off" ? "Chat is switched off" : "Could not send the invite"); return false;
}
function classTab(p){
  const pr = perms(), isToday = classToday(p), st = liveState(p), link = noClass(p, today()) ? "" : todayLink(p), tok = p.sheet && p.sheet.token;
  const loading = tok && sheetOf(p) === undefined;
  const status = !isToday ? "Next class" : st === "live" ? "Class is on now" : st === "soon" ? "Starts soon" : st === "done" ? "Today's class time has passed" : "Class today";
  const nd = nextClassDate(p), left = classesLeftFor(p);
  return `<div class="panel"><span class="k">${isToday ? "Today" : "Next class"}</span>
      <div class="big">${isToday ? (planTime(p) ? e(formatTime(planTime(p))) : "Time not set") : e(fmtD(nd)) + (planTime(p) ? " · " + e(formatTime(planTime(p))) : "")}</div>
      <div class="dim" style="font-size:13px">${e(status)} · ${e(p.duration || 50)} min${st === "live" && isToday ? ' <span class="tag live">LIVE</span>' : ""}</div>
      <div class="two">
        ${pr.join !== false ? (link ? `<a class="btn pri" href="${e(link)}" target="_blank" rel="noopener">${ic("video")} Join</a>` : `<button class="btn gh" disabled>${loading ? "Loading link…" : isToday ? "No link today" : "Join on class day"}</button>`) : ""}
        ${pr.invite !== false && tok ? `<div class="inv"><button class="btn gh" style="width:100%" data-t="invmenu">${ic("invite")} Invite</button>${T.menu ? inviteMenu() : ""}</div>` : ""}
      </div></div>
    ${(() => { const n = planNote(p); return n ? `<div class="banner ${n.k === "end" ? "end" : "pz"}">${n.k === "end" ? "🏁 " : "⏸ "}${e(n.text)}${n.k === "end" ? " — after it the student leaves your page." : ". No class and no join link on paused days."}</div>` : ""; })()}
    ${(() => { const cv = coveredOn(p.planId, isToday ? today() : nd); return cv ? `<div class="banner cov">${e(cv.date === today() ? "Today's" : fmtD(cv.date) + "'s")} class is covered by <b>${e(cv.sub)}</b> — arranged by the office.</div>` : ""; })()}
    ${tok ? "" : '<div class="banner">No class sheet is linked to this student yet, so there is no join link or study material. Ask the office.</div>'}
    <div class="panel"><span class="k">Class days</span>
      <div class="wk">${WEEK.map(d => `<span class="${planDays(p).indexOf(d) >= 0 ? "on" : ""}">${d.slice(0, 2)}</span>`).join("")}</div>
      <div class="dim" style="font-size:13px;margin-top:6px">${planTime(p) ? e(formatTime(planTime(p))) + " (IST) · " : ""}${e(p.duration || 50)} min${left === null ? "" : " · " + left + " class" + (left === 1 ? "" : "es") + " left in the plan"}</div>
      ${(() => { const up = upcomingDates(p, 4); return up.length ? `<div class="next"><span class="k" style="margin:0">Next classes</span>${up.map(ds => `<span>${e(ds === today() ? "Today" : fmtD(ds))}</span>`).join("")}</div>` : ""; })()}</div>
    ${pr.material !== false && p.sheet && p.sheet.hifzLink ? `<a class="book" href="${e(p.sheet.hifzLink)}" target="_blank" rel="noopener"><span class="bk">ح</span><span class="mid"><b>Hifz report</b><small>Daily Hifz tracker</small></span>›</a>` : ""}
    <p class="note" style="text-align:center">Fees, phone numbers and share-link settings are not shown to teachers.</p>`;
}
function inviteMenu(){
  const p = planOf(T.plan), up = p ? upcomingDates(p, 5) : [], sel = p ? invDate(p) : "";
  return `<div class="menu">
    ${up.length ? `<div class="invfor"><span>Invite for</span><div class="invd">${up.map(ds => `<button data-t="invdate" data-v="${ds}" class="${ds === sel ? "on" : ""}">${e(ds === today() ? "Today" : fmtD(ds))}</button>`).join("")}</div>
      ${p && weekLine(p) ? `<small>${e(weekLine(p))}</small>` : ""}</div>` : ""}
    <button data-t="invite" data-v="wa">${ic("wa")}<span>On WhatsApp<small>Opens WhatsApp with the join link</small></span></button>
    <button data-t="invite" data-v="copy">${ic("copy")}<span>Copy invite<small>To paste anywhere</small></span></button>
    ${perms().chat !== false ? `<button data-t="invite" data-v="chat">${ic("chat")}<span>In chat<small>Invite card with a Join button</small></span></button>
    <button data-t="invite" data-v="both">${ic("invite")}<span>Both<small>Chat + WhatsApp together</small></span></button>` : ""}</div>`;
}
function inviteText(p, ds){
  ds = ds || invDate(p);
  const pretty = new Date(ds + "T00:00:00").toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const url = location.origin + mqUrl("/join/") + "?t=" + encodeURIComponent(p.sheet.token) + "&dt=" + encodeURIComponent(ds);
  const wk = weekLine(p);
  return `Assalamu Alaikum 🌙\n\n*${p.student}* — ${p.course || "Quran"} class\n📅 ${pretty}${planTime(p) ? " · " + formatTime(planTime(p)) + " (IST)" : ""}` +
    (wk ? `\n🗓 ${wk} (IST)` : "") + `\n\nJoin here:\n${url}\n\n_ManzilulQuran E-learning Academy_`;
}
function materialTab(p){
  const list = typeof smParse === "function" ? smParse(p.sheet && p.sheet.studyMaterial) : [];
  if(!list.length) return `<div class="empty">${p.sheet ? "No study material is allotted on this student's class sheet." : "No class sheet is linked to this student yet."}</div>`;
  return list.map(x => { const c = SM_CATALOG[x.course]; const nums = x.lessons.length ? x.lessons : [];
    return `<a class="book" href="${e(c.path)}${nums.length ? "#lesson" + nums[0] : ""}" target="_blank" rel="noopener"><span class="bk">${e(c.title.charAt(0))}</span>
      <span class="mid"><b>${e(c.title)}</b><small>${nums.length ? nums.length + " lesson" + (nums.length > 1 ? "s" : "") + " allotted" : "Whole book · " + c.lessons.length + " lessons"}</small></span>›</a>
      ${nums.length ? `<div class="lessons">${nums.filter(n => n <= c.lessons.length).map(n => `<a href="${e(c.path)}#lesson${n}" target="_blank" rel="noopener" title="${e(c.lessons[n - 1])}">Lesson ${n}</a>`).join("")}</div>` : ""}`; }).join("")
    + '<p class="note">The same books the office allotted on the class sheet. Only the office changes them.</p>';
}
function attTab(p){
  const m = T.month, n = monthDays(m), t = today();
  const marks = {}; (T.me.attendance || []).forEach(a => { if(a[0] === p.planId) marks[a[1]] = markOf(a[2], a[3]); });
  const c = { held:0, A:0, L:0, T:0, U:0 };
  let cells = DOWS.map(d => `<div class="wd">${d[0]}</div>`).join("") + "<div></div>".repeat(new Date(m + "-01T00:00:00Z").getUTCDay());
  for(let i = 1; i <= n; i++){
    const ds = m + "-" + pad(i), k = marks[ds];
    const sch = isClassOn(p, ds), nc = noClass(p, ds);
    let cls = nc ? "pz" : "";
    if(k){ cls = "s " + k; if(HELD[k]) c.held++; else if(c[k] !== undefined) c[k]++; }
    else if(sch && ds <= t){ cls = "s U"; c.U++; }
    else if(sch) cls = "s";
    cells += `<div class="d ${cls}${ds === t ? " td" : ""}">${i}${k ? `<i>${e(k)}</i>` : ""}</div>`;
  }
  return `<div class="mon"><button data-t="smon" data-v="-1" aria-label="Previous month">‹</button><b>${MONTHS[+m.slice(5) - 1]} ${m.slice(0, 4)}</b>
      <button data-t="smon" data-v="1" ${m >= curMonth() ? "disabled" : ""} aria-label="Next month">›</button></div>
    <div class="cal">${cells}</div>
    <div class="legend"><span><i style="background:var(--ok)"></i>Present</span><span><i style="background:var(--sub)"></i>Substitute</span><span><i style="background:var(--abs)"></i>Absent</span><span><i style="background:var(--lv)"></i>Leave</span><span><i style="background:var(--tabs)"></i>My leave</span><span><i style="border:1px dashed var(--unm)"></i>Not marked yet</span></div>
    <div class="cnt"><div><b style="color:var(--ok)">${c.held}</b><small>Held</small></div><div><b style="color:var(--abs)">${c.A}</b><small>Absent</small></div><div><b style="color:var(--lv)">${c.L}</b><small>Leave</small></div><div><b>${c.U}</b><small>Unmarked</small></div></div>
    <p class="note">Marked by the office in Academic Service. If something looks wrong, tell the office.</p>`;
}
function chatTab(){
  return `<div class="panel soon-box"><div class="ico">💬</div><b>Chat is coming</b>
    <p>Text and voice messages with this student, kept for 3 days, with the join link shared right in the chat. It switches on once the office finishes setting it up.</p></div>`;
}

/* ---------------- notices ---------------- */
function noticesHtml(){
  const me = T.me, list = (me.notes || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at));
  if(me.unseen){ me.unseen = 0; teacherPost(T.session, { action: "seen" }); }
  const thread = list.map(n => {
    const mine = n.from === "t"; let body;
    if(n.kind === "leave"){ const l = n.leave || {}, st = l.status || "pending";
      body = `<div class="nk">🗓 Leave request <span class="st ${e(st)}">${st === "pending" ? "WAITING" : e(st.toUpperCase())}</span></div><b class="nt">${e(fmtRange(l))}</b>
        <div class="ns">${dayCount(l)} day${dayCount(l) > 1 ? "s" : ""} · ${l.mode === "some" ? "some classes" : "whole day"} · ${e(l.reason || "")}${l.note ? " — " + e(l.note) : ""}</div>`; }
    else if(n.kind === "avail") body = '<div class="nk">🕒 Free time updated</div>';
    else body = `<div class="nk">${n.kind === "notice" ? "📢 Notice" : "💬 Update"}</div><div>${e(n.body).replace(/\n/g, "<br>")}</div>`;
    return `<div class="msg${mine ? " mine" : ""}${n.kind === "notice" ? " ntc" : ""}">${body}<time>${mine ? "You" : "Office"} · ${e(ago(n.at))}</time></div>`;
  }).join("");
  return `<h2 class="h">Notices & updates</h2>
    <button class="btn gold block" data-t="leaveopen" style="margin-bottom:14px">🗓 Request leave</button>
    <div class="thread">${thread || '<div class="empty">Nothing yet. Notices from the office appear here.</div>'}</div>
    <div class="compose"><textarea id="upd" rows="1" placeholder="Post an update for the office…"></textarea><button class="cb" data-t="update" aria-label="Send">${ic("send")}</button></div>
    <p class="note">The office sees your updates on your teacher profile.</p>`;
}
function leaveClasses(l){
  const out = []; if(!l.from || !l.to || l.to < l.from) return out;
  for(let ds = l.from, g = 0; ds <= l.to && g < 70; ds = addDaysISO(ds, 1), g++){
    plans().forEach(p => { if(planDays(p).indexOf(dowOf(ds)) >= 0 && (!p.startDate || ds >= p.startDate) && (l.mode === "full" || (l.plans || []).indexOf(p.planId) >= 0)) out.push({ ds, p }); });
  }
  return out;
}
function leaveSheet(){
  const l = T.leave, cls = leaveClasses(l), bad = l.to < l.from;
  return `<div class="scrim" data-t="leaveclose"></div><div class="sheet"><div class="in"><div class="grab"></div>
    <h3>Request leave</h3>
    <div class="seg"><button data-t="lvmode" data-v="full" class="${l.mode === "full" ? "on" : ""}">Whole day</button><button data-t="lvmode" data-v="some" class="${l.mode === "some" ? "on" : ""}">Some classes</button></div>
    <div class="f2"><div class="field"><label>From</label><input type="date" data-lv="from" value="${e(l.from)}" min="${today()}"></div>
      <div class="field"><label>To</label><input type="date" data-lv="to" value="${e(l.to)}" min="${e(l.from)}"></div></div>
    ${l.mode === "some" ? `<div class="field"><label>Which classes</label><div class="pills">${plans().map(p => `<label><input type="checkbox" data-lvp="${e(p.planId)}" ${(l.plans || []).indexOf(p.planId) >= 0 ? "checked" : ""}>${e(p.student.split(" ")[0])}${planTime(p) ? " · " + e(formatTime(planTime(p))) : ""}</label>`).join("")}</div></div>` : ""}
    <div class="field"><label>Reason</label><div class="pills">${["Sick","Family","Travel","Personal","Other"].map(r => `<label><input type="radio" name="lvr" data-lvr="${r}" ${l.reason === r ? "checked" : ""}>${r}</label>`).join("")}</div></div>
    <div class="field"><label>Note <span style="text-transform:none;letter-spacing:0;font-weight:500">(optional)</span></label><input data-lv="note" value="${e(l.note)}" maxlength="300" placeholder="e.g. I can take a make-up class on Sunday"></div>
    <div class="sum">${bad ? "The end date is before the start date." : `${dayCount(l)} day${dayCount(l) > 1 ? "s" : ""} · <b>${cls.length}</b> class${cls.length === 1 ? "" : "es"} affected${cls.length ? ": " + e([...new Set(cls.map(c => c.p.student.split(" ")[0]))].join(", ")) : ""}`}</div>
    <div class="err" id="lvErr"></div>
    <button class="btn pri block" data-t="leavesend">${ic("wa")} Send to office</button>
    <p class="note" style="text-align:center">Saved in Notices, and WhatsApp opens to the office with the details.</p></div></div>`;
}
async function sendLeave(){
  const l = T.leave, me = T.me, err = document.getElementById("lvErr");
  if(!l.from || !l.to || l.to < l.from){ err.textContent = "Check the dates."; return; }
  if(!l.reason){ err.textContent = "Choose a reason."; return; }
  if(l.mode === "some" && !(l.plans || []).length){ err.textContent = "Choose at least one class."; return; }
  const cls = leaveClasses(l);
  const w = window.open("about:blank", "_blank");     // opened inside the tap so the phone allows it
  const out = await teacherPost(T.session, { action: "leave", leave: Object.assign({}, l, { classes: cls.length }) });
  if(!out || out.result !== "success"){ if(w) w.close(); err.textContent = (out && out.error === "signed_out") ? "Signed out — please sign in again." : (out && out.error) || "Could not send. Try again."; return; }
  me.notes = out.notes || me.notes;
  const names = [...new Set(cls.map(c => c.p.student))];
  const text = [`*Leave request* — ${me.teacher.name} (${me.teacher.id})`, `Date: ${fmtRange(l)} (${dayCount(l)} day${dayCount(l) > 1 ? "s" : ""})`,
    `Type: ${l.mode === "full" ? "Whole day" : "Some classes"}`, `Classes affected: ${cls.length}${names.length ? " — " + names.join(", ") : ""}`,
    `Reason: ${l.reason}${l.note ? " — " + l.note : ""}`, "", "_Sent from the teacher profile_"].join("\n");
  const url = "https://wa.me/" + OFFICE_WA + "?text=" + encodeURIComponent(text);
  if(w){ try{ w.opener = null; w.location.href = url; }catch(x){ location.href = url; } } else location.href = url;
  T.leave = null; T.tab = "notices"; renderMain(); toast("Leave request sent");
}

/* ---------------- my time (availability) — v2 ----------------
   Set once: the usual hours (every day). Then only the exceptions:
   whole days off, and times on a day when the teacher is not free.
   Stored as { v:2, hours:[from,to], off:{ Fri:"all", Wed:[[from,to]] },
   newStudents, maxNew, note }. The office sees free time in green,
   classes in gold, and nothing where the teacher is not free. */
const DAYNAME = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };
function draftInit(){
  if(T.draft) return T.draft;
  const a = T.me.avail || {};
  let hours = a.hours, off = JSON.parse(JSON.stringify(a.off || {}));
  if(!hours && a.days){                       // v1 data → usual hours = earliest start … latest end; empty days = off
    let lo = null, hi = null;
    WEEK.forEach(d => (a.days[d] || []).forEach(r => { const x = toMin(r[0]), y = toMin(r[1]); if(x !== null && (lo === null || x < lo)) lo = x; if(y !== null && (hi === null || y > hi)) hi = y; }));
    if(lo !== null) hours = [minTo(lo), minTo(hi)];
    WEEK.forEach(d => { if(!(a.days[d] || []).length) off[d] = "all"; });
  }
  T.draft = { v: 2, hours: hours || ["06:00", "22:00"], off: off, newStudents: a.newStudents !== false, maxNew: a.maxNew || "", note: a.note || "", fresh: !a.hours && !a.days };
  return T.draft;
}
function freeOf(dr, day){
  const off = (dr.off || {})[day]; if(off === "all") return [];
  let segs = [[toMin(dr.hours[0]), toMin(dr.hours[1])]].filter(x => x[0] !== null && x[1] > x[0]);
  (Array.isArray(off) ? off : []).forEach(b => { const bs = toMin(b[0]), be = toMin(b[1]); if(bs === null || be === null || be <= bs) return;
    segs = segs.flatMap(([a, z]) => (be <= a || bs >= z) ? [[a, z]] : [[a, Math.min(bs, z)], [Math.max(be, a), z]].filter(x => x[1] > x[0])); });
  return segs;
}
function busyList(dr){ const out = []; WEEK.forEach(d => { const o = (dr.off || {})[d]; if(Array.isArray(o)) o.forEach((r, i) => out.push({ d, i, r })); }); return out; }
function classesOn(day){ return plans().filter(p => planDays(p).indexOf(day) >= 0 && toMin(planTime(p)) !== null).map(p => ({ s: toMin(planTime(p)), e: toMin(planTime(p)) + (+p.duration || 50), name: p.student })); }
function timeOpts(sel){ let h = ""; for(let m = 4 * 60; m <= 24 * 60; m += 30){ const v = m === 24 * 60 ? "23:59" : minTo(m); h += `<option value="${v}" ${v === sel ? "selected" : ""}>${e(m === 24 * 60 ? "12:00 midnight" : formatTime(v))}</option>`; } return h; }
function cleanDraft(dr){
  const off = {};
  WEEK.forEach(d => { const o = (dr.off || {})[d]; if(o === "all") off[d] = "all"; else if(Array.isArray(o)){ const rs = o.filter(r => toMin(r[1]) > toMin(r[0])).sort((x, y) => toMin(x[0]) - toMin(y[0])); if(rs.length) off[d] = rs; } });
  return { v: 2, hours: dr.hours, off: off, newStudents: !!dr.newStudents, maxNew: dr.maxNew || "", note: (dr.note || "").trim() };
}
function timeHtml(){
  const dr = draftInit(), saved = T.me.avail;
  const T0 = 4 * 60, T1 = 24 * 60, pc = m => ((Math.max(T0, Math.min(T1, m)) - T0) / (T1 - T0) * 100).toFixed(2);
  let free = 0, daysOn = 0;
  const week = WEEK.map(d => {
    const fr = freeOf(dr, d), cl = classesOn(d), off = (dr.off || {})[d] === "all";
    fr.forEach(x => free += x[1] - x[0]); if(fr.length) daysOn++;
    return `<div class="wk"><b>${d}</b><div class="bar">${fr.map(x => `<i class="fr" style="left:${pc(x[0])}%;width:${(pc(x[1]) - pc(x[0])).toFixed(2)}%"></i>`).join("")}${cl.map(c => `<i class="cl" style="left:${pc(c.s)}%;width:${Math.max(.8, pc(c.e) - pc(c.s)).toFixed(2)}%"></i>`).join("")}</div>
      <small>${off ? '<span class="offt">Day off</span>' : fr.length ? fr.map(x => formatTime(minTo(x[0])) + "–" + formatTime(minTo(x[1]))).join(", ") : "Not free"}</small></div>`;
  }).join("");
  const changed = dr.fresh || JSON.stringify(cleanDraft(dr)) !== JSON.stringify(saved ? cleanDraft(Object.assign({ off: {} }, saved, { hours: saved.hours || dr.hours })) : null);
  const busy = busyList(dr), dayOpts = sel => WEEK.filter(d => (dr.off || {})[d] !== "all").map(d => `<option value="${d}" ${d === sel ? "selected" : ""}>${DAYNAME[d]}</option>`).join("");
  return `<h2 class="h">My free time <small>${saved ? "saved " + e(ago(saved.updatedAt)) : "not set yet"}</small></h2>
    <p class="dim" style="font-size:13px;margin:-4px 0 12px">Times you can take <b>new</b> classes, in academy time (IST). Set your usual hours once, then only mark the days or times you are not free.</p>
    <div class="av-sum"><div><b>${Math.round(free / 6) / 10}</b><small>free hrs / week</small></div><div><b>${daysOn}</b><small>days free</small></div><div><b>${plans().length}</b><small>current students</small></div></div>

    <div class="panel"><span class="k">1 · My usual hours</span>
      <div class="range"><select data-hr="0" aria-label="From">${timeOpts(dr.hours[0])}</select><span class="dim">to</span><select data-hr="1" aria-label="To">${timeOpts(dr.hours[1])}</select></div>
      ${toMin(dr.hours[1]) <= toMin(dr.hours[0]) ? '<div class="range-warn">The end time is before the start.</div>' : '<div class="hint">The same on every day. Your classes inside these hours are already taken.</div>'}</div>

    <div class="panel"><span class="k">2 · Days off</span>
      <div class="dchips">${WEEK.map(d => `<button class="${(dr.off || {})[d] === "all" ? "on" : ""}" data-t="doff" data-v="${d}">${d}</button>`).join("")}</div>
      <div class="hint">Tap a day you never take new classes.</div></div>

    <div class="panel"><span class="k">3 · Not free at some times</span>
      ${busy.map(b => `<div class="range bz"><select data-bz="${b.d}|${b.i}|d" aria-label="Day">${dayOpts(b.d)}</select>
          <select data-bz="${b.d}|${b.i}|0" aria-label="From">${timeOpts(b.r[0])}</select><select data-bz="${b.d}|${b.i}|1" aria-label="To">${timeOpts(b.r[1])}</select>
          <button class="x" data-t="bzdel" data-v="${b.d}|${b.i}" aria-label="Remove">${ic("x")}</button></div>`).join("") || '<div class="hint" style="margin:0 0 4px">None — free for all of the usual hours.</div>'}
      <button class="lnk" data-t="bzadd" style="margin-top:8px">+ Add a time I'm not free</button></div>

    <div class="panel"><span class="k">This is what the office sees</span>
      <div class="week">${week}</div>
      <div class="legend"><span><i style="background:rgba(52,211,153,.6)"></i>Free</span><span><i style="background:var(--v-gold-hi)"></i>Your classes</span><span><i style="border:1px dashed var(--v-faint)"></i>Not free</span></div></div>

    <div class="panel"><label class="day-h" style="cursor:pointer"><b>Taking new students</b><input type="checkbox" class="tog" data-opt="newStudents" ${dr.newStudents ? "checked" : ""}></label>
      <div class="field" style="margin:12px 0 0"><label>Most new classes per day</label><select data-opt="maxNew"><option value="">No limit</option>${[1,2,3,4,5,6].map(n => `<option ${String(dr.maxNew) === String(n) ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      <div class="field" style="margin:12px 0 0"><label>Note for the office <span style="text-transform:none;letter-spacing:0;font-weight:500">(optional)</span></label><textarea data-opt="note" maxlength="300" placeholder="e.g. Only girls' classes in the evening">${e(dr.note)}</textarea></div></div>
    <div class="savebar"><button class="btn pri block" data-t="availsave" ${changed ? "" : "disabled"}>${changed ? "Save & tell the office" : "Saved"}</button></div>`;
}

/* =================================================================
   EVENTS
   ================================================================= */
function keepScroll(fn){ const y = window.scrollY; fn(); window.scrollTo(0, y); }
document.addEventListener("click", async function(ev){
  const el = ev.target.closest("[data-t]"); if(!el) return;
  const a = el.dataset.t, v = el.dataset.v;
  if(a === "tologin") return showLogin();
  if(a === "tab"){ T.tab = v; T.draft = null; renderMain(); window.scrollTo(0, 0); if(v !== "time") load(); }
  else if(a === "plan") openPlan(el.dataset.id);
  else if(a === "cover") openCover(el.dataset.id);
  else if(a === "coverclose"){ T.cover = null; const b = document.getElementById("cs"); if(b) b.remove(); }
  else if(a === "close"){ if(T.chat){ T.chat.destroy(); T.chat = null; } T.plan = null; T.menu = false; const b = document.getElementById("ss"); if(b) b.remove(); loadUnread(); if(T.month !== curMonth()){ T.month = curMonth(); load(); } }
  else if(a === "stab"){ T.stab = v; T.menu = false; renderStudent(); }
  else if(a === "smon"){ const m = shiftMonth(T.month, +v); if(m > curMonth()) return; T.month = m; await load(m); renderStudent(); }
  else if(a === "invmenu"){ T.menu = !T.menu; renderStudent(); }
  else if(a === "invdate"){ T.invDate = v; renderStudent(); }
  else if(a === "invite"){
    const p = planOf(T.plan); T.menu = false; renderStudent(); if(!p || !p.sheet) return;
    const ds = invDate(p), text = inviteText(p, ds);
    if(v === "wa" || v === "both") window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank", "noopener");
    if(v === "chat" || v === "both"){ const ok = await chatInvite(p, ds); if(ok && v === "chat"){ T.stab = "chat"; renderStudent(); } }
    if(v === "copy") navigator.clipboard.writeText(text).then(() => toast("Invite copied"), () => toast("Could not copy"));
  }
  else if(a === "me"){ T.profile = true; renderMain(); }
  else if(a === "profclose"){ T.profile = false; renderMain(); }
  else if(a === "signout"){ teacherLogout(T.session); writeSession(""); T.me = null; T.profile = false; showLogin(); }
  else if(a === "update"){
    const ta = document.getElementById("upd"), body = (ta.value || "").trim(); if(!body) return;
    el.disabled = true; const out = await teacherPost(T.session, { action: "update", body }); el.disabled = false;
    if(out && out.result === "success"){ T.me.notes = out.notes; renderMain(); window.scrollTo(0, document.body.scrollHeight); toast("Sent to the office"); } else toast("Could not send");
  }
  else if(a === "leaveopen"){ const t1 = addDaysISO(today(), 1); T.leave = { mode: "full", from: t1, to: t1, reason: "", note: "", plans: [] }; renderMain(); }
  else if(a === "leaveclose"){ T.leave = null; renderMain(); }
  else if(a === "lvmode"){ T.leave.mode = v; renderMain(); }
  else if(a === "leavesend") sendLeave();
  else if(a === "doff"){ const dr = draftInit(); dr.fresh = false; if(dr.off[v] === "all") delete dr.off[v]; else dr.off[v] = "all"; keepScroll(renderMain); }
  else if(a === "bzadd"){ const dr = draftInit(); const d = WEEK.find(x => dr.off[x] !== "all") || "Mon"; const s0 = Math.max(toMin(dr.hours[0]) || 360, 12 * 60);
    if(!Array.isArray(dr.off[d])) dr.off[d] = []; dr.off[d].push([minTo(s0), minTo(Math.min(s0 + 120, 23 * 60 + 30))]); keepScroll(renderMain); }
  else if(a === "bzdel"){ const [d, i] = v.split("|"); const dr = draftInit(); (dr.off[d] || []).splice(+i, 1); if(Array.isArray(dr.off[d]) && !dr.off[d].length) delete dr.off[d]; keepScroll(renderMain); }
  else if(a === "availsave"){
    el.disabled = true;
    const out = await teacherPost(T.session, { action: "avail", avail: cleanDraft(draftInit()) });
    if(out && out.result === "success"){ T.me.avail = out.avail; T.me.notes = out.notes || T.me.notes; T.draft = null; keepScroll(renderMain); toast("Saved — the office can see it"); }
    else { el.disabled = false; toast("Could not save"); }
  }
});
document.addEventListener("change", function(ev){
  const el = ev.target;
  if(el.dataset.hr !== undefined){ const dr = draftInit(); dr.fresh = false; dr.hours[+el.dataset.hr] = el.value; keepScroll(renderMain); }
  if(el.dataset.bz){ const [d, i, k] = el.dataset.bz.split("|"); const dr = draftInit(), r = dr.off[d][+i];
    if(k === "d"){ dr.off[d].splice(+i, 1); if(!dr.off[d].length) delete dr.off[d]; if(!Array.isArray(dr.off[el.value])) dr.off[el.value] = []; dr.off[el.value].push(r); }
    else r[+k] = el.value;
    keepScroll(renderMain); }
  if(el.dataset.opt){ const dr = draftInit(); dr[el.dataset.opt] = el.type === "checkbox" ? el.checked : el.value; if(el.dataset.opt !== "note") keepScroll(renderMain); else { const b = document.querySelector('[data-t="availsave"]'); if(b){ b.disabled = false; b.textContent = "Save & tell the office"; } } }
  if(T.leave && el.dataset.lv){ T.leave[el.dataset.lv] = el.value; if(el.dataset.lv === "from" && T.leave.to < el.value) T.leave.to = el.value; if(el.dataset.lv !== "note") renderMain(); }
  if(T.leave && el.dataset.lvr) T.leave.reason = el.dataset.lvr;
  if(T.leave && el.dataset.lvp){ const ps = T.leave.plans; if(el.checked) ps.push(el.dataset.lvp); else ps.splice(ps.indexOf(el.dataset.lvp), 1); renderMain(); }
});
document.addEventListener("input", function(ev){
  if(ev.target.dataset && ev.target.dataset.opt === "note"){ draftInit().note = ev.target.value; const b = document.querySelector('[data-t="availsave"]'); if(b){ b.disabled = false; b.textContent = "Save & tell the office"; } }
  if(ev.target.id === "upd"){ ev.target.style.height = "auto"; ev.target.style.height = Math.min(130, ev.target.scrollHeight) + "px"; }
});
setInterval(function(){ const c = document.getElementById("clk"); if(c) c.textContent = formatTime(minTo(istNowMinutes())); if(T.me && T.tab === "today" && !T.plan && !T.cover && !T.leave && !T.profile && document.activeElement === document.body) renderMain(); }, 30000);
window.addEventListener("pageshow", function(ev){ if(ev.persisted && T.session) load(); });

/* =================================================================
   BOOT — direct link first, then a saved sign-in, else the sign-in form
   ================================================================= */
(async function boot(){
  if(typeof mqConfigured === "function" && !mqConfigured()) return showState("Not configured", "This page is not connected to the academy yet.");
  T.month = curMonth();
  const q = new URLSearchParams(location.search), tp = (q.get("tp") || "").trim();
  writeSession(readSession());
  if(tp){
    showLoading("Opening your profile…");
    const r = await teacherLink(tp, deviceId());
    if(r && r.result === "success"){
      writeSession(r.session);
      try{ history.replaceState(null, "", location.pathname); }catch(x){}
    } else if(r && r.error === "paused") return showState("Profile paused", "Your teacher profile is not active right now. Please contact the academy office.", true);
    else if(r && r.error === "not_set_up") return showState("Not switched on yet", "Teacher profiles are not set up on the server yet. Please contact the office.");
    else if(!T.session) return showState("Link not valid", "This link has changed or is no longer active. Ask the office for your new link, or sign in with your phone number and date of birth.", true);
  }
  if(T.session) load(); else showLogin();
})();
})();
