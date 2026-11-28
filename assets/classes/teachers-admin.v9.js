/* =================================================================
   ░░  ManzilulQuran — TEACHERS WORKSPACE (admin)  v9  ░░
   v9 = v8 + a class whose student already has a sheet offers Remove (made
   here by mistake) instead of Create sheet — one class sheet per student.
   
   -----------------------------------------------------------------
   Loaded by the Classes admin AFTER its main script (demo first).
   Needs api.v10.js, engine.v1.js, catalog.v2.js and chat.v2.js, and the
   page's own helpers: $, escapeHtml, toast, openModal, closeModal,
   shareUrl, classes, courses, mqUrl, currentWs, openForm, openShare,
   loadClasses, applyView, editingId.

   v4:
   · THIS CLASS SHEET'S TEACHERS ONLY ("wing"): teachers of the students
     that have a class sheet here, teachers added through this class
     sheet's attendance link, and teachers with a profile here.
   · Each class sheet row shows its teacher (from Academic Service).
   · CLASSES WITHOUT A CLASS SHEET: Active Academic Service classes of
     this class sheet's students (or added through its attendance link)
     that have no sheet yet — one tap makes the sheet (calendar is still
     added by hand). "+ New class sheet" offers: from Academic Service ·
     new student + class (through the attendance link, so the office
     reviews it and sets the fee) · class sheet only.
   · STUDENT SIGN-IN in the class sheet form: phone + date of birth,
     on/off, sign out all devices (<prefix>sadmin).
   · The attendance button shows only on the main screens: hidden while a
     window or the attendance sheet is open; on a computer it sits in the
     top bar. The attendance sheet opens as a 90% sheet with its own ✕.
     It opens the link for this class sheet (?cs=demo) and hears when a
     class is added there.

   WHERE THE DATA COMES FROM
   · Teachers, their students (plans) and attendance → Academic Service
     (mq_teachers, mq_plans, mq_students, mq_classes, mq_holidays).
     READ ONLY. The attendance shown is exactly what the class admin
     marked there.
   · Study material and the class-sheet link → this page's own class
     sheets, matched by MQ ID (Student ID = mqId).
   · Profiles, notices, leave, availability, settings → <prefix>tadmin
     (clsdemo-teachers-v1.sql). Until that SQL is run, those parts say
     so and everything read-only still works.

   ALSO HERE: Settings (attendance link) and the fixed attendance button
   in the bottom-right corner that opens the attendance sheet over this
   page and keeps it loaded, so going back and forth is instant.

   v5:
   · COVER CLASSES: "Cover a class" (Teachers bar, a teacher's sheet, an
     approved leave) — pick the day, then a covering teacher for each of
     the absent teacher's classes; free teachers first. The covering
     teacher sees only first name, course, time, material and a Join for
     that day (clsdemo_tsubadmin / tsubs_me / tsubjoin). A teacher's sheet
     has a Covers tab.
   · ACADEMIC SERVICE BACKUP: lists are read through the class sheet's
     kept copy (clsdemo_as_view; a kept copy shows "Not in Academic
     Service"); the copy is refreshed in the background (clsdemo_as_sync);
     Settings → Academic Service backup → review and send records back in
     3 steps (clsdemo_as_restore); download a JSON backup.
   v6: PAUSE + STOP from the attendance link reach the class sheet list:
   rows show "Paused · restarts …" / "Last class …"; a stopped class (last
   day passed) keeps its row until the sheet is turned off; on load the
   sheets whose class ended are turned off (clsdemo_sheet_autoend) and the
   admin is told; no cover on a paused day.
   v7: the demo class sheet's attendance is its OWN (portal/demo/attendance/,
   clsdemo-own-v1.sql) — no attendance link to set, the Attendance button
   always opens it; student sign-in is off unless switched on in Edit.
   v8: + New opens the two-part New class (newclass.v1.js: class + calendar,
   one save); Settings makes the calendars of a month; the "send back to
   Academic Service" screen is hidden (the kept copy, the download and the
   "Not in Academic Service" marks stay); TA_API lets newclass.v1.js use
   this file's lists and helpers.
   PUBLISHED FILES ARE IMMUTABLE. Create teachers-admin.v10.js to change this.
   ================================================================= */
(function(){
"use strict";

const TA = {
  loaded: false, loading: null, error: "",
  teachers: [], plans: [], students: {}, holidays: [],
  profiles: {}, avail: {}, leaves: [], unseen: {}, settings: {}, noSql: false,
  att: {},                       // month → { planId → { date → record } }
  month: "", open: null, tab: "students", student: null, notes: {}, q: "",
  linkName: "", signins: {}, siMissing: false, asOpen: false,
  subs: [], subsLoaded: false, backup: null, viaCopy: false
};
const DOWS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const WEEK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MON_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const STATUS_MARK = { "Completed":"P", "Student Absent":"A", "Teacher Absent":"T", "Student Leave":"L",
                      "Substitute":"S", "Note":"N", "Rescheduled":"R", "Cancelled":"C" };
const MARK_LABEL = { P:"Present", S:"Substitute", E:"Exam", X:"Test", A:"Absent", L:"Leave", T:"Teacher absent",
                     N:"Note", R:"Rescheduled", C:"Cancelled", U:"Not marked", H:"Holiday" };
const HELD = { P:1, S:1, E:1, X:1 };
const PERMS = [
  ["join",     "Join button",       "Today's class link for each student"],
  ["invite",   "Send invites",      "WhatsApp invite with the student's join link"],
  ["material", "Study material",    "The books allotted on each class sheet"],
  ["att",      "Attendance",        "Read-only marks from Academic Service"],
  ["chat",     "Chat with students","Text + voice, kept 3 days; you can read it here"]
];
const ATT_KEY = "mq_att_link_" + (window.MQ_SUPABASE_PREFIX || "");
const e = s => escapeHtml(s == null ? "" : String(s));
const pad = n => String(n).padStart(2, "0");

/* ---------------- dates (academy clock) ---------------- */
function today(){ return istTodayISO(); }
function curMonth(){ return today().slice(0, 7); }
function monthDays(m){ const [y, mo] = m.split("-").map(Number); return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
function dowOf(ds){ return DOWS[new Date(ds + "T00:00:00Z").getUTCDay()]; }
function monthLabel(m){ const [y, mo] = m.split("-").map(Number); return MON_NAMES[mo - 1] + " " + y; }
function shiftMonth(m, n){ let [y, mo] = m.split("-").map(Number); mo += n; while(mo < 1){ mo += 12; y--; } while(mo > 12){ mo -= 12; y++; } return y + "-" + pad(mo); }
function fmtD(ds){ try{ return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" }); }catch(x){ return ds; } }
function fmtDob(ds){ try{ return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }); }catch(x){ return ds; } }
function fmtRange(l){ return l.from === l.to ? fmtD(l.from) : fmtD(l.from) + " – " + fmtD(l.to); }
function dayCount(l){ return Math.round((Date.parse(l.to) - Date.parse(l.from)) / 864e5) + 1; }
function ago(ts){
  if(!ts) return "never";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if(s < 90) return "just now"; if(s < 3600) return Math.round(s / 60) + " min ago";
  if(s < 86400) return Math.round(s / 3600) + " h ago";
  return new Date(ts).toLocaleDateString("en-IN", { day:"numeric", month:"short" });
}
function initials(n){ return String(n || "?").split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase(); }
function digits(v){ return String(v || "").replace(/\D/g, ""); }
function toMin(t){ const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : null; }
function minTo(m){ return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }

/* ---------------- Academic Service data ---------------- */
function dayName(d){ if(typeof d === "number") return DOWS[d] || ""; const s = String(d || "").slice(0, 3); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }
function planDays(p){ return (p.days || []).map(dayName).filter(Boolean); }
function isHoliday(ds){ return TA.holidays.find(h => ds >= h.from && ds <= (h.to || h.from)) || null; }
function scheduled(p, ds){
  if(p.startDate && ds < p.startDate) return false;
  if(p.endDate && ds > p.endDate) return false;
  if(isHoliday(ds)) return false;
  const d = planDays(p);
  return d.length ? d.indexOf(dowOf(ds)) >= 0 : false;
}
function markOf(rec){
  if(!rec) return "";
  if(rec.status === "Completed") return rec.activity === "Exam" ? "E" : rec.activity === "Test" ? "X" : "P";
  return STATUS_MARK[rec.status] || "";
}
/* ---------------- v4: this class sheet's wing ---------------- */
let WING = { ref: null, len: -1, set: {} };
function wingSet(){
  const cl = typeof classes !== "undefined" ? classes : [];
  if(WING.ref !== cl || WING.len !== cl.length){
    const s = {};
    cl.forEach(c => {
      const id = String(c["mqId"] || "").toUpperCase() || (/^MQ\d+$/i.test(String(c["Student ID"] || "")) ? String(c["Student ID"]).toUpperCase() : "");
      if(id) s[id] = 1;
    });
    WING = { ref: cl, len: cl.length, set: s };
  }
  return WING.set;
}
function byLink(r){ return !!(r && TA.linkName && r.addedVia === "admin-link" && r.addedBy === TA.linkName); }
function inWing(p){ return !!wingSet()[String(p.studentId || "").toUpperCase()] || byLink(p); }
function wingTeachers(){
  const mine = {};
  TA.plans.forEach(p => { if((p.status || "Active") === "Active" && inWing(p)) mine[p.teacherId] = 1; });
  return TA.teachers.filter(t => mine[t.id] || byLink(t) || TA.profiles[t.id]);
}
function teacherPlans(tid){ return TA.plans.filter(p => p.teacherId === tid && (p.status || "Active") === "Active" && inWing(p)); }
function attToken(v){ const m = /[#?&]k=([^&#]+)/.exec(v || ""); return m ? decodeURIComponent(m[1]) : ""; }
function linkNameFrom(rows){
  const tok = attToken(attLink()); if(!tok) return "";
  const r = (rows || [])[0], list = r ? (r.value !== undefined ? r.value : []) : [];
  const l = (Array.isArray(list) ? list : []).find(x => x && x.token === tok);
  return l ? String(l.name || "") : "";
}
function studentName(id){ return (TA.students[id] && TA.students[id].name) || id || "—"; }
function teacher(tid){ return TA.teachers.find(t => t.id === tid); }
function sheetFor(mqId){
  if(typeof classes === "undefined" || !mqId) return null;
  const list = classes.filter(c => String(c["mqId"] || c["Student ID"] || "").toUpperCase() === String(mqId).toUpperCase());
  return list.find(c => (c["Status"] || "Active") === "Active") || list[0] || null;
}

async function taLoad(force){
  if(TA.loading) return TA.loading;
  if(TA.loaded && !force) return;
  TA.loading = (async function(){
    TA.error = "";
    try{
      const [asl, prof, links] = await Promise.all([
        readAs(), tAdminList().catch(() => ({ result:"error", missing:true })),
        mqAcRead("mq_settings", [["id", "eq.attAdminLinks"]]).catch(() => [])
      ]);
      const [ts, ps, ss, hs] = asl;
      TA.linkRows = links;
      TA.teachers = ts.filter(t => (t.kind || "teacher") !== "staff")
        .sort((a, b) => ((a.status || "Active") !== "Active") - ((b.status || "Active") !== "Active") || String(a.name).localeCompare(String(b.name)));
      TA.plans = ps;
      TA.students = {}; ss.forEach(s => { TA.students[s.id] = s; });
      TA.holidays = hs;
      applyList(prof);
      TA.linkName = linkNameFrom(TA.linkRows);
      TA.att = {};
      TA.loaded = true;
      loadSubs();
      backupSync(false);
      autoEnd();
    }catch(err){
      console.error(err);
      TA.error = String(err && err.message || err);
    }finally{ TA.loading = null; }
  })();
  return TA.loading;
}
function applyList(out){
  if(out && out.result === "success"){
    TA.noSql = false;
    TA.profiles = {}; (out.profiles || []).forEach(p => { TA.profiles[p.teacherId] = p; });
    TA.avail = out.avail || {}; TA.leaves = out.leaves || []; TA.unseen = out.unseen || {};
    TA.settings = out.settings || {};
    if(TA.settings.attendanceLink !== undefined) setAttLink(TA.settings.attendanceLink || "", true);
  } else {
    TA.noSql = !!(out && (out.missing || /not set up|404/i.test(out.error || "")));
    if(out && out.signedOut) return;
  }
}
async function taRefreshList(){ try{ applyList(await tAdminList()); }catch(x){} }

async function loadMonth(m){
  if(TA.att[m]) return TA.att[m];
  const by = {};
  try{
    const rows = await readAsClasses(m + "-01", m + "-" + pad(monthDays(m)));
    rows.forEach(r => {
      if(!r.planId || !r.date) return;
      const box = by[r.planId] = by[r.planId] || {};
      const keyed = r.id === r.planId + "-" + r.date.replace(/-/g, "");
      if(!box[r.date] || keyed) box[r.date] = r;
    });
  }catch(err){ console.error(err); toast("Could not read attendance from Academic Service", true); }
  TA.att[m] = by;
  return by;
}
/* one student-month: marks per day + totals */
function monthSummary(p, m){
  const marks = (TA.att[m] || {})[p.id] || {}, n = monthDays(m), t = today();
  const s = { days: {}, P:0, S:0, E:0, X:0, A:0, L:0, T:0, N:0, R:0, C:0, U:0, held:0, sched:0 };
  for(let i = 1; i <= n; i++){
    const ds = m + "-" + pad(i), k = markOf(marks[ds]);
    if(k){ s.days[ds] = k; s[k]++; if(HELD[k]) s.held++; }
    else if(isHoliday(ds)) s.days[ds] = "H";
    else if(scheduled(p, ds)){ s.days[ds] = ds <= t ? "U" : "F"; if(ds <= t) s.U++; }
    if(scheduled(p, ds) && ds <= t) s.sched++;
  }
  const base = s.held + s.A + s.L;
  s.pct = base ? Math.round(s.held / base * 100) : null;
  return s;
}

/* =================================================================
   WORKSPACE
   ================================================================= */
/* v2: painted BEFORE the switch shows the workspace, as separate blocks
   (--i stagger) like the other two workspaces, and never repainted while
   its entrance is still moving — that repaint was the jerk in v1. */
window.taOpenWorkspace = async function(){
  if(!TA.loaded){ paintLoading(); await taLoad(); }
  paintWorkspace();
};
function wsRoot(){ return $("wsTeachers"); }
function moving(){ const w = wsRoot(); return !!(w && (w.classList.contains("ws-in") || w.classList.contains("ws-out"))); }
function paintLoading(){ const r = wsRoot(); r._html = ""; r.innerHTML = '<div class="loading" style="--i:2"><div class="loading-spin"></div><div>Loading teachers from Academic Service…</div></div>'; }

function pendingFor(tid){ return TA.leaves.filter(l => l.teacherId === tid && (l.leave || {}).status === "pending"); }

function paintWorkspace(){
  const root = wsRoot(); if(!root) return;
  if(moving()){ clearTimeout(root._later); root._later = setTimeout(paintWorkspace, 400); return; }
  if(TA.error){
    root.innerHTML = `<div class="empty-state">Could not read Academic Service.<br><small style="color:var(--err)">${e(TA.error)}</small><br><br>
      <button class="btn-outline" data-ta="reload">Try again</button></div>`;
    return;
  }
  const active = wingTeachers().filter(t => (t.status || "Active") === "Active");
  const withProfile = active.filter(t => TA.profiles[t.id]).length;
  const studs = new Set(TA.plans.filter(p => p.teacherId && (p.status || "Active") === "Active" && inWing(p)).map(p => p.studentId)).size;
  const waiting = TA.leaves.filter(l => (l.leave || {}).status === "pending");
  $("wsCountTeachers").textContent = active.length;
  const html = `
  <div class="statbar ta-stat" style="--i:2">
    <div class="sb-nums">
      <span class="sb-n"><b>${withProfile}</b> with a profile</span>
      <span class="sb-n dim"><b>${studs}</b> students</span>
      <span class="sb-n total"><b>${active.length}</b> teachers</span>
    </div>
    <div class="sb-track" aria-hidden="true"><i class="sb-fill" style="--p:${active.length ? (withProfile / active.length).toFixed(3) : 0}"></i></div>
  </div>
  <div class="ta-top" style="--i:3">
  ${TA.noSql ? `<div class="ta-note warn"><b>Teacher profiles are not switched on yet.</b> Run <code>clsdemo-teachers-v1.sql</code> in Supabase. Teachers, students and attendance below already work.</div>` : ""}
  ${waiting.length ? `<div class="ta-alerts">${waiting.map(l => { const t = teacher(l.teacherId) || { name: l.teacherId };
     return `<button class="ta-alert" data-ta="open" data-id="${e(l.teacherId)}" data-tab="notices">
       <span class="ta-al-ic">🗓</span><span><b>${e(t.name)}</b> asked for leave · ${e(fmtRange(l.leave))}</span><span class="ta-al-go">Review ›</span></button>`; }).join("")}</div>` : ""}
  </div>
  <div class="list-tools" style="--i:4">
    <label class="list-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="search" id="taQ" placeholder="Search teacher or ID" value="${e(TA.q)}" autocomplete="off" aria-label="Search teachers" />
    </label>
  </div>
  <div class="ta-list" style="--i:5">${listHtml()}</div>
  ${goneTotal() ? `<div class="bk-banner" style="--i:6"><span class="bk-ic" aria-hidden="true">⛁</span><span class="bk-t"><b>Academic Service no longer has ${e(goneLine())}.</b><small>The class sheet keeps working from its copy — they show “Not in Academic Service”.</small></span></div>` : ""}
  <p class="ta-foot" style="--i:6">This class sheet's teachers: those teaching its students, those added through its attendance link${TA.linkName ? " (" + e(TA.linkName) + ")" : ""}, and those with a profile here. Teachers come from Academic Service.</p>`;
  if(root._html === html) return;            // nothing changed: leave the DOM (and any motion) alone
  root._html = html; root.innerHTML = html;
}
function listHtml(){
  const q = TA.q.toLowerCase();
  const list = wingTeachers().filter(t => !q || (t.name + " " + t.id).toLowerCase().indexOf(q) >= 0);
  return list.map(cardHtml).join("") || (q ? '<div class="empty-state">No teachers match.</div>'
    : '<div class="empty-state">No teachers yet. A teacher shows here once one of this class sheet\'s students has a class with them in Academic Service.</div>');
}
function cardHtml(t, i){
  const ps = teacherPlans(t.id), pr = TA.profiles[t.id], off = (t.status || "Active") !== "Active";
  const courses = [...new Set(ps.map(p => p.course).filter(Boolean))].join(", ");
  const wd = dowOf(today()), todayN = ps.filter(p => scheduled(p, today()) && planDays(p).indexOf(wd) >= 0).length;
  const chip = off ? '<span class="ta-chip off">Inactive in Academic Service</span>'
    : !pr ? '<span class="ta-chip">No profile</span>'
    : pr.active ? '<span class="ta-chip ok">Profile on</span>' : '<span class="ta-chip off">Profile off</span>';
  const lv = pendingFor(t.id).length, un = TA.unseen[t.id] || 0;
  return `<button class="ta-card${off ? " paused" : ""}${i < 12 ? " rv" : ""}" style="--r:${Math.min(i, 12)}" data-ta="open" data-id="${e(t.id)}">
    <span class="ta-av">${e(initials(t.name))}</span>
    <span class="ta-mid"><b>${e(t.name)}</b><small>${e(t.id)}${courses ? " · " + e(courses) : ""}</small>
      <span class="ta-chips">${chip}${lv ? `<span class="ta-chip warn">Leave waiting</span>` : ""}${un ? `<span class="ta-chip new">${un} new</span>` : ""}</span></span>
    <span class="ta-nums"><b>${ps.length}</b><small>students</small>${todayN ? `<em>${todayN} today</em>` : ""}</span>
  </button>`;
}

/* =================================================================
   TEACHER SHEET
   ================================================================= */
function ensureSheet(){
  if($("taModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop sheet-backdrop ta-backdrop";
  d.id = "taModal";
  d.innerHTML = '<div class="modal ta-sheet" role="dialog" aria-modal="true" aria-labelledby="taName"><div class="sheet-grab" aria-hidden="true"></div><div id="taSheetIn"></div></div>';
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taModal"); });
  if(typeof sheetDrag === "function") sheetDrag([d.querySelector(".sheet-grab")], d.querySelector(".ta-sheet"), () => closeModal("taModal"));
}
async function openTeacher(tid, tab){
  ensureSheet();
  TA.open = tid; TA.tab = tab || "students"; TA.student = null;
  TA.month = TA.month || curMonth();
  paintSheet();
  openModal("taModal");
  await loadMonth(TA.month);
  if(TA.tab === "notices") await loadNotes(tid);
  paintSheet();
}
function paintSheet(){
  const t = teacher(TA.open); if(!t) return;
  const pr = TA.profiles[t.id], off = (t.status || "Active") !== "Active";
  const un = TA.unseen[t.id] || 0, lv = pendingFor(t.id).length;
  const tabs = [["students","Students"],["att","Attendance"],["notices","Notices" + ((un || lv) ? ` <i class="ta-dot">${un + lv}</i>` : "")],["covers","Covers"],["avail","Free time"],["access","Access"]];
  const chip = (t._gone ? '<span class="ta-chip warn" title="Deleted in Academic Service — the class sheet keeps its copy">Not in Academic Service</span> ' : "") +
             (off ? '<span class="ta-chip off">Inactive in AS</span>' : !pr ? '<span class="ta-chip">No profile</span>'
             : pr.active ? '<span class="ta-chip ok">Profile on</span>' : '<span class="ta-chip off">Profile off</span>');
  let body;
  if(TA.student) body = studentView(TA.student);
  else body = { students: tabStudents, att: tabAtt, notices: tabNotices, covers: tabCovers, avail: tabAvail, access: tabAccess }[TA.tab](t);
  $("taSheetIn").innerHTML = `
    <div class="ta-head">
      <span class="ta-av lg">${e(initials(t.name))}</span>
      <div class="ta-hmid"><h3 id="taName">${e(t.name)}</h3><small>${e(t.id)} · ${teacherPlans(t.id).length} students</small><div>${chip}</div></div>
      <button class="ib ta-x" data-ta="close" aria-label="Close">${'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'}</button>
    </div>
    <div class="ta-tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" class="${TA.tab === k && !TA.student ? "on" : ""}" data-ta="tab" data-v="${k}">${l}</button>`).join("")}</div>
    <div class="ta-body" id="taBody">${body}</div>`;
  if(TA.tab === "notices" && !TA.student){ const th = $("taThread"); if(th) th.scrollTop = th.scrollHeight; }
  if(TA.chat){ TA.chat.destroy(); TA.chat = null; }
  const cb = $("taChat");
  if(cb && typeof MQChat !== "undefined"){
    if(TA.noSql){ cb.innerHTML = '<div class="ta-empty">Chat needs the chat SQL.</div>'; }
    else {
      const p = TA.plans.find(x => x.id === cb.dataset.plan);
      TA.chat = MQChat.mount(cb, { side: "a", pollMs: 15000, names: { t: (teacher(TA.open) || {}).name || "Teacher", s: studentName(p && p.studentId) },
        api: { list: () => tAdminChat({ action: "list", planId: cb.dataset.plan }).then(o => o && o.missing ? { result: "error", error: "Chat is not set up yet (run the chat SQL)." } : o),
               voice: id => tAdminChat({ action: "voice", planId: cb.dataset.plan, msgId: id }), send: () => null } });
    }
  }
}
function monthBar(){
  const atNow = TA.month >= curMonth();
  return `<div class="ta-month"><button class="ib" data-ta="mon" data-v="-1" aria-label="Previous month">‹</button>
    <b>${e(monthLabel(TA.month))}</b><button class="ib" data-ta="mon" data-v="1" ${atNow ? "disabled" : ""} aria-label="Next month">›</button></div>`;
}

/* ---- Students ---- */
function tabStudents(t){
  const ps = teacherPlans(t.id);
  if(!ps.length) return '<div class="empty-state">No students. In Academic Service, give this teacher a class (plan) and they show here.</div>';
  return monthBar() + `<div class="ta-rows">${ps.map(p => {
    const s = monthSummary(p, TA.month), sh = sheetFor(p.studentId);
    return `<button class="ta-row" data-ta="student" data-id="${e(p.id)}">
      <span class="ta-av sm">${e(initials(studentName(p.studentId)))}</span>
      <span class="ta-mid"><b>${e(studentName(p.studentId))}</b>
        <small>${e(p.studentId)} · ${e(p.course || "—")} · ${e(planDays(p).join(" ") || "no days")}${p.time ? " · " + e(formatTime(p.time)) : ""}</small>
        ${sh ? "" : '<small class="ta-warn">No class sheet with this MQ ID</small>'}${p._gone ? '<small class="ta-warn">Not in Academic Service (kept copy)</small>' : ""}</span>
      <span class="ta-nums"><b>${s.held}</b><small>of ${s.sched} held</small>${s.U ? `<em class="u">${s.U} unmarked</em>` : (s.pct !== null ? `<em>${s.pct}%</em>` : "")}</span>
    </button>`; }).join("")}</div>`;
}
function studentView(planId){
  const p = TA.plans.find(x => x.id === planId); if(!p) return "";
  const s = monthSummary(p, TA.month), sh = sheetFor(p.studentId);
  const first = new Date(TA.month + "-01T00:00:00Z").getUTCDay();
  let cells = DOWS.map(d => `<div class="wd">${d[0]}</div>`).join("") + "<div></div>".repeat(first);
  for(let i = 1; i <= monthDays(TA.month); i++){
    const ds = TA.month + "-" + pad(i), k = s.days[ds] || "";
    cells += `<div class="cd ${k ? "k-" + k : ""}${ds === today() ? " td" : ""}" title="${e(MARK_LABEL[k] || "")}">${i}${k && k !== "F" && k !== "U" && k !== "H" ? `<i>${k}</i>` : ""}</div>`;
  }
  const sm = sh && typeof smParse === "function" ? smParse(sh["Study Material"]) : [];
  const smHtml = sm.length ? sm.map(x => { const c = SM_CATALOG[x.course];
      return `<a class="ta-book" href="${e(c.path)}" target="_blank" rel="noopener"><span class="bk">${e(c.title.charAt(0))}</span>
        <span class="ta-mid"><b>${e(c.title)}</b><small>${x.lessons.length ? "Lessons " + e(x.lessons.join(", ")) : "Whole book · " + c.lessons.length + " lessons"}</small></span><span>›</span></a>`; }).join("")
    : `<div class="ta-empty">${sh ? "No study material on this class sheet." : "No class sheet found for " + e(p.studentId) + "."}</div>`;
  return `<button class="btn-ghost ta-back" data-ta="back">‹ All students</button>
    <div class="ta-shead"><b>${e(studentName(p.studentId))}</b><small>${e(p.studentId)} · ${e(p.course || "")} · ${e(planDays(p).join(" "))}${p.time ? " · " + e(formatTime(p.time)) : ""}</small></div>
    ${monthBar()}
    <div class="ta-cal">${cells}</div>
    ${legendHtml()}
    <div class="ta-kpis">${[["held","Held",s.held],["A","Absent",s.A],["L","Leave",s.L],["T","Teacher absent",s.T],["U","Not marked",s.U]].map(k => `<div class="k-${k[0]}"><b>${k[2]}</b><small>${k[1]}</small></div>`).join("")}</div>
    <h4 class="ta-h4">Chat · last 3 days <span class="dim" style="text-transform:none;letter-spacing:0;font-weight:600">(read only)</span></h4>
    <div class="ta-chatbox" id="taChat" data-plan="${e(p.id)}"></div>
    <h4 class="ta-h4">Study material</h4>${smHtml}
    ${sh && sh["Hifz Link"] ? `<a class="ta-book" href="${e(sh["Hifz Link"])}" target="_blank" rel="noopener"><span class="bk">ح</span><span class="ta-mid"><b>Hifz report</b><small>From the class sheet</small></span><span>›</span></a>` : ""}
    <div class="ta-actions">${sh ? `<a class="btn-outline" href="${e(shareUrl(sh))}" target="_blank" rel="noopener">Open class sheet</a>` : ""}</div>
    <p class="ta-foot">Marks are read from Academic Service. Change them on the attendance sheet.</p>`;
}
function legendHtml(){
  return `<div class="ta-legend">${[["P","Present"],["S","Substitute"],["A","Absent"],["L","Leave"],["T","Teacher absent"],["U","Not marked"],["H","Holiday"]]
    .map(x => `<span><i class="k-${x[0]}"></i>${x[1]}</span>`).join("")}</div>`;
}

/* ---- Attendance (all students of this teacher) ---- */
function tabAtt(t){
  const ps = teacherPlans(t.id);
  if(!ps.length) return '<div class="empty-state">No students to show.</div>';
  const n = monthDays(TA.month), sums = ps.map(p => [p, monthSummary(p, TA.month)]);
  const tot = sums.reduce((a, x) => { ["held","A","L","T","U","sched"].forEach(k => a[k] += x[1][k]); return a; }, { held:0, A:0, L:0, T:0, U:0, sched:0 });
  const base = tot.held + tot.A + tot.L, pct = base ? Math.round(tot.held / base * 100) : null;
  let head = "<tr><th class='nm'>Student</th>";
  for(let i = 1; i <= n; i++){ const ds = TA.month + "-" + pad(i); head += `<th class="${isHoliday(ds) ? "h" : ""}${ds === today() ? " td" : ""}">${i}<small>${dowOf(ds)[0]}</small></th>`; }
  head += "</tr>";
  const rows = sums.map(([p, s]) => { let r = `<tr><td class="nm" title="${e(studentName(p.studentId))}">${e(studentName(p.studentId).split(" ")[0])}</td>`;
    for(let i = 1; i <= n; i++){ const k = s.days[TA.month + "-" + pad(i)] || ""; r += `<td>${k && k !== "F" ? `<i class="mx k-${k}">${k === "U" ? "·" : k === "H" ? "" : k}</i>` : ""}</td>`; }
    return r + "</tr>"; }).join("");
  return monthBar() + `
    <div class="ta-kpis wide">
      <div class="k-held"><b>${tot.held}</b><small>Classes held</small></div><div class="k-A"><b>${tot.A}</b><small>Student absent</small></div>
      <div class="k-L"><b>${tot.L}</b><small>Leave</small></div><div class="k-T"><b>${tot.T}</b><small>Teacher absent</small></div>
      <div class="k-U"><b>${tot.U}</b><small>Not marked</small></div><div><b>${pct === null ? "—" : pct + "%"}</b><small>Attendance</small></div>
    </div>
    <div class="ta-tablewrap"><table class="ta-sum"><thead><tr><th>Student</th><th>Held</th><th>Abs</th><th>Lv</th><th>T-abs</th><th>Unm.</th><th>%</th></tr></thead><tbody>
      ${sums.map(([p, s]) => `<tr data-ta="student" data-id="${e(p.id)}"><td>${e(studentName(p.studentId))}<small>${e(p.course || "")}</small></td><td>${s.held}</td><td>${s.A}</td><td>${s.L}</td><td>${s.T}</td><td class="${s.U ? "u" : ""}">${s.U}</td><td>${s.pct === null ? "—" : s.pct + "%"}</td></tr>`).join("")}
      <tr class="tot"><td>Total</td><td>${tot.held}</td><td>${tot.A}</td><td>${tot.L}</td><td>${tot.T}</td><td>${tot.U}</td><td>${pct === null ? "—" : pct + "%"}</td></tr>
    </tbody></table></div>
    <h4 class="ta-h4">Day by day</h4>
    <div class="ta-matrix"><table>${head}${rows}</table></div>
    ${legendHtml()}
    <p class="ta-foot">Held = present, substitute, exam or test. Attendance % = held ÷ (held + absent + leave). Teacher-absent days are not counted against the student.</p>`;
}

/* ---- Notices ---- */
async function loadNotes(tid){
  if(TA.noSql) return;
  const out = await tAdminNotes(tid);
  if(out && out.result === "success"){ TA.notes[tid] = out.notes || []; TA.unseen[tid] = 0; }
  else if(out && out.missing) TA.noSql = true;
}
function noSqlBox(what){ return `<div class="ta-note warn">${e(what)} need the teacher SQL. Run <code>clsdemo-teachers-v1.sql</code> in Supabase, then reload.</div>`; }
function tabNotices(t){
  if(TA.noSql) return noSqlBox("Notices and leave requests");
  const list = TA.notes[t.id];
  if(!list) return '<div class="loading"><div class="loading-spin"></div></div>';
  const wa = digits(t.whatsapp) ? (t.whatsappCC || "91") + digits(t.whatsapp).slice(-10) : (digits(t.phone).length >= 10 ? "91" + digits(t.phone).slice(-10) : "");
  const thread = list.map(n => {
    const mine = n.from === "a";
    let body;
    if(n.kind === "leave"){
      const l = n.leave || {}, st = l.status || "pending";
      body = `<div class="nk">🗓 Leave request <span class="ta-chip ${st === "approved" ? "ok" : st === "declined" ? "off" : "warn"}">${e(st)}</span></div>
        <b class="nt">${e(fmtRange(l))}</b><div class="ns">${dayCount(l)} day${dayCount(l) > 1 ? "s" : ""} · ${l.mode === "some" ? "some classes" : "whole day"}${l.classes ? " · " + l.classes + " class" + (l.classes > 1 ? "es" : "") + " affected" : ""}</div>
        <div class="ns">Reason: ${e(l.reason || "—")}${l.note ? " — " + e(l.note) : ""}</div>
        ${st === "pending" ? `<div class="nact"><button class="btn-solid sm" data-ta="leave" data-id="${n.id}" data-v="approved">Approve</button><button class="btn-outline sm" data-ta="leave" data-id="${n.id}" data-v="declined">Decline</button>${wa ? `<a class="btn-outline sm" target="_blank" rel="noopener" href="https://wa.me/${e(wa)}">WhatsApp</a>` : ""}</div>` : ""}
        ${st !== "declined" && l.to >= today() ? `<div class="nact"><button class="btn-outline sm" data-ta="coverleave" data-v="${e(l.from > today() ? l.from : today())}" data-to="${e(l.to)}">Arrange cover</button></div>` : ""}`;
    } else if(n.kind === "avail"){
      body = `<div class="nk">🕒 Availability updated</div><button class="ta-link" data-ta="tab" data-v="avail">See their free time ›</button>`;
    } else {
      body = `<div class="nk">${n.kind === "notice" ? "📢 Notice" : "💬 Update"}</div><div>${e(n.body).replace(/\n/g, "<br>")}</div>`;
    }
    return `<div class="ta-msg${mine ? " mine" : ""}">${body}<time>${mine ? "Office" : e(t.name.split(" ")[0])} · ${e(ago(n.at))}${mine && n.kind === "notice" ? ` · <button class="ta-link" data-ta="delnote" data-id="${n.id}">remove</button>` : ""}</time></div>`;
  }).join("");
  return `<div class="ta-thread" id="taThread">${thread || '<div class="ta-empty">No notices yet. Write the first one below.</div>'}</div>
    <div class="ta-compose"><textarea id="taNotice" rows="2" placeholder="Notice to ${e(t.name.split(" ")[0])}…"></textarea>
      <button class="btn-solid" data-ta="notice">Post</button></div>
    <p class="ta-foot">The teacher sees a badge on their Notices tab. Leave requests arrive here and on WhatsApp.</p>`;
}

/* ---- Availability ---- */
/* Free time, v2 shape: { v:2, hours:["05:00","22:00"], off:{ Fri:"all", Wed:[["13:00","15:00"]] } }
   = the usual hours every day, minus whole days off, minus "not free" times.
   The v1 shape ({ days:{ Mon:[[from,to],…] } }) is still read. */
function rangesOf(av, day){
  if(!av) return [];
  if(av.hours){
    const off = (av.off || {})[day];
    if(off === "all") return [];
    let segs = [[toMin(av.hours[0]), toMin(av.hours[1])]].filter(x => x[0] !== null && x[1] > x[0]);
    (Array.isArray(off) ? off : []).forEach(b => {
      const bs = toMin(b[0]), be = toMin(b[1]); if(bs === null || be === null || be <= bs) return;
      segs = segs.flatMap(([a, z]) => (be <= a || bs >= z) ? [[a, z]] : [[a, Math.min(bs, z)], [Math.max(be, a), z]].filter(x => x[1] > x[0]));
    });
    return segs.map(x => [minTo(x[0]), minTo(x[1])]);
  }
  return ((av.days && av.days[day]) || []).filter(r => Array.isArray(r) && toMin(r[0]) !== null && toMin(r[1]) !== null && toMin(r[1]) > toMin(r[0]));
}
function dayOff(av, day){ return !!(av && av.hours && (av.off || {})[day] === "all"); }
function classBlocks(tid, day){
  return teacherPlans(tid).filter(p => planDays(p).indexOf(day) >= 0 && toMin(p.time) !== null)
    .map(p => ({ s: toMin(p.time), e: toMin(p.time) + (+p.duration || 50), name: studentName(p.studentId) }));
}
function fmtRanges(rs){ return rs.map(r => formatTime(r[0]) + "–" + formatTime(r[1])).join(", "); }
function tabAvail(t){
  if(TA.noSql) return noSqlBox("Availability");
  const av = TA.avail[t.id];
  const T0 = 5 * 60, T1 = 23 * 60, span = T1 - T0, pc = m => ((Math.max(T0, Math.min(T1, m)) - T0) / span * 100).toFixed(2);
  let freeMin = 0, classMin = 0;
  const rows = WEEK.map(d => {
    const rs = rangesOf(av, d), cb = classBlocks(t.id, d);
    rs.forEach(r => freeMin += toMin(r[1]) - toMin(r[0])); cb.forEach(b => classMin += b.e - b.s);
    return `<div class="ta-tl-row"><span class="ta-tl-d">${d}</span>
      <div class="ta-tl-bar">${rs.map(r => `<i class="fr" style="left:${pc(toMin(r[0]))}%;width:${(pc(toMin(r[1])) - pc(toMin(r[0]))).toFixed(2)}%"></i>`).join("")}
        ${cb.map(b => `<i class="cl" title="${e(b.name)}" style="left:${pc(b.s)}%;width:${Math.max(.8, pc(b.e) - pc(b.s)).toFixed(2)}%"></i>`).join("")}</div>
      <span class="ta-tl-t">${dayOff(av, d) ? '<span class="ta-off">Day off</span>' : rs.length ? e(fmtRanges(rs)) : '<span class="dim">Not free</span>'}</span></div>`;
  }).join("");
  const ticks = [6, 9, 12, 15, 18, 21].map(h => `<span style="left:${pc(h * 60)}%">${h % 12 || 12}${h < 12 ? "a" : "p"}</span>`).join("");
  return `
    <div class="ta-kpis">
      <div class="k-held"><b>${Math.round(freeMin / 60 * 10) / 10}</b><small>free hrs / week</small></div>
      <div><b>${Math.round(classMin / 60 * 10) / 10}</b><small>class hrs / week</small></div>
      <div><b>${av ? (av.newStudents === false ? "No" : "Yes") : "—"}</b><small>takes new students</small></div>
      <div><b>${av && av.maxNew ? e(av.maxNew) : "—"}</b><small>max new / day</small></div>
    </div>
    ${av ? (av.hours ? `<div class="ta-note">Usual hours <b>${e(formatTime(av.hours[0]))} – ${e(formatTime(av.hours[1]))}</b>${Object.keys(av.off || {}).filter(k => av.off[k] === "all").length ? " · days off: <b>" + e(WEEK.filter(k => (av.off || {})[k] === "all").join(", ")) + "</b>" : ""}</div>` : "")
         : '<div class="ta-note">This teacher has not set their free time yet. They do it from their profile → My time.</div>'}
    <div class="ta-tl"><div class="ta-tl-ticks">${ticks}</div>${rows}</div>
    <div class="ta-legend"><span><i class="k-P"></i>Free (set by the teacher)</span><span><i class="k-cls"></i>Has a class</span><span><i class="k-none"></i>Not free / not given</span></div>
    ${av && av.note ? `<div class="ta-note">“${e(av.note)}”</div>` : ""}
    <p class="ta-foot">${av ? "Last updated " + e(ago(av.updatedAt)) + ". " : ""}All times are academy time (IST). Use <b>Who's free?</b> to check a date and time across all teachers.</p>`;
}

/* ---- Access ---- */
function teacherUrl(pr){ return window.location.origin + mqUrl("/teacher/") + "?tp=" + encodeURIComponent(pr.token); }
function tabAccess(t){
  if(TA.noSql) return noSqlBox("Profiles");
  const pr = TA.profiles[t.id], off = (t.status || "Active") !== "Active";
  const phone = digits(t.whatsapp) || digits(t.phone);
  const loginInfo = `<dl class="ta-kv"><dt>Signs in with</dt><dd>${phone ? e(phone.slice(-10)) + " <span class='dim'>or</span> " : ""}${e(t.id)}</dd>
    <dt>Password</dt><dd>Date of birth${pr && pr.dob ? " · " + e(fmtDob(pr.dob)) : ""}</dd>
    ${pr ? `<dt>Last opened</dt><dd>${e(ago(pr.lastSeen))}</dd>` : ""}</dl>`;
  if(!pr){
    return `${off ? '<div class="ta-note warn">This teacher is Inactive in Academic Service, so a profile would not open.</div>' : ""}
      <div class="ta-card-in"><h4 class="ta-h4" style="margin-top:0">Make a teacher profile</h4>
      <p class="ta-p">The teacher opens it from a link, or signs in with their phone number (or ${e(t.id)}) and date of birth.</p>
      <div class="field"><label>Date of birth <span class="req">*</span></label><input type="date" id="taDob" max="${today()}" /></div>
      ${!phone ? '<div class="ta-note">No phone in Academic Service — they will sign in with the teacher ID.</div>' : ""}
      <div class="ta-actions"><button class="btn-solid" data-ta="create">Make profile</button></div></div>`;
  }
  const perms = pr.perms || {};
  const wa = phone ? (t.whatsappCC || "91") + phone.slice(-10) : "";
  const msg = `Assalamu alaikum ${t.name},\nYour ManzilulQuran teacher profile:\n${teacherUrl(pr)}\n\nYou can also sign in with your phone number (or ${t.id}) and your date of birth.`;
  return `${loginInfo}
    <div class="ta-linkbox"><input readonly value="${e(teacherUrl(pr))}" id="taLinkIn" onclick="this.select()" />
      <div class="ta-actions">
        <button class="btn-outline sm" data-ta="copy">Copy</button>
        ${wa ? `<a class="btn-outline sm" target="_blank" rel="noopener" href="https://wa.me/${e(wa)}?text=${encodeURIComponent(msg)}">WhatsApp</a>` : ""}
        <a class="btn-outline sm" target="_blank" rel="noopener" href="${e(teacherUrl(pr))}">Preview</a>
        <button class="btn-outline sm" data-ta="reset">New link</button>
      </div></div>
    <h4 class="ta-h4">What this teacher can use</h4>
    <div class="ta-perms">${PERMS.map(([k, l, s, locked]) => `<label class="ta-perm${locked ? " locked" : ""}"><span class="ta-mid"><b>${l}</b><small>${s}</small></span>
      <input type="checkbox" class="ta-tog" data-perm="${k}" ${perms[k] && !locked ? "checked" : ""} ${locked ? "disabled" : ""} /></label>`).join("")}</div>
    <h4 class="ta-h4">Never shown to teachers</h4>
    <div class="ta-never">${["Fees & paid status","Salary","Student phone, email, DOB","Share-link reset","Other teachers' students","Notice board admin"].map(x => `<span>${x}</span>`).join("")}</div>
    <h4 class="ta-h4">Date of birth (password)</h4>
    <div class="ta-inline"><input type="date" id="taDob" value="${e(pr.dob || "")}" max="${today()}" /><button class="btn-outline sm" data-ta="dob">Save</button></div>
    <h4 class="ta-h4">Status</h4>
    ${pr.active
      ? `<button class="btn-solid danger" data-ta="active" data-v="0">Deactivate profile</button><p class="ta-foot">The teacher is signed out at once and the link stops working. Nothing is deleted.</p>`
      : `<button class="btn-solid" data-ta="active" data-v="1">Activate profile</button><p class="ta-foot">The same link starts working again.</p>`}`;
}

/* =================================================================
   WHO'S FREE?
   ================================================================= */
function ensureFree(){
  if($("taFreeModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "taFreeModal";
  d.innerHTML = '<div class="modal modal-wide"><div class="modal-head"><h3>Who\'s <span class="accent">free?</span></h3><p>Free time the teachers set, minus their classes and leave.</p></div><div class="modal-body" id="taFreeBody"></div><div class="modal-foot"><button class="btn-ghost" data-ta="freeclose">Close</button></div></div>';
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taFreeModal"); });
}
const FREE = { date: "", from: "18:00", to: "19:00", mode: "date", days: ["Mon","Tue","Wed","Thu","Fri","Sat"] };
async function openFree(){
  ensureFree();
  FREE.date = FREE.date || today();
  $("taFreeBody").innerHTML = '<div class="loading"><div class="loading-spin"></div></div>';
  openModal("taFreeModal");
  if(!TA.loaded) await taLoad();
  paintFree();
}
function timeOpts(sel){ let h = ""; for(let m = 5 * 60; m <= 23 * 60; m += 30) h += `<option value="${minTo(m)}" ${minTo(m) === sel ? "selected" : ""}>${e(formatTime(minTo(m)))}</option>`; return h; }
function paintFree(){ return FREE.mode === "week" ? paintFreeWeek() : paintFreeDate(); }
function freeModeBar(){
  return `<div class="ta-seg"><button class="${FREE.mode === "date" ? "on" : ""}" data-ta="freemode" data-v="date">One date</button><button class="${FREE.mode === "week" ? "on" : ""}" data-ta="freemode" data-v="week">New student · weekly</button></div>`;
}
/* New student: the teachers free at this time on EVERY chosen weekday — free time
   covers it, no class overlaps, not a day off. Best fits first. */
function paintFreeWeek(){
  const a = toMin(FREE.from), b = toMin(FREE.to), days = FREE.days;
  const res = wingTeachers().filter(t => (t.status || "Active") === "Active").map(t => {
    const av = TA.avail[t.id];
    const per = days.map(d => {
      const clash = teacherPlans(t.id).find(p => planDays(p).indexOf(d) >= 0 && toMin(p.time) !== null && toMin(p.time) < b && toMin(p.time) + (+p.duration || 50) > a);
      const ok = !clash && rangesOf(av, d).some(r => toMin(r[0]) <= a && toMin(r[1]) >= b);
      return { d, ok, clash };
    });
    const n = per.filter(x => x.ok).length;
    let st;
    if(!av) st = ["", "Has not set free time", 90];
    else if(n === days.length && days.length) st = [av.newStudents === false ? "warn" : "ok", (av.newStudents === false ? "Free, but not taking new students" : "Free on all " + days.length + " days") + (av.maxNew ? " · max " + av.maxNew + " new/day" : ""), av.newStudents === false ? 5 : 0];
    else if(n) st = ["new", "Free " + n + " of " + days.length + " · not " + per.filter(x => !x.ok).map(x => x.d).join(", "), 10 + (days.length - n)];
    else st = ["", "Not free then", 80];
    return { t, st, per };
  }).sort((x, y) => x.st[2] - y.st[2] || x.t.name.localeCompare(y.t.name));
  $("taFreeBody").innerHTML = freeModeBar() + `
    <div class="field ta-dfield"><label>Class days</label><div class="ta-dchips">${WEEK.map(d => `<button class="${days.indexOf(d) >= 0 ? "on" : ""}" data-ta="freeday" data-v="${d}">${d}</button>`).join("")}</div></div>
    <div class="field-row"><div class="field"><label>From</label><select id="taFreeFrom">${timeOpts(FREE.from)}</select></div>
      <div class="field"><label>To</label><select id="taFreeTo">${timeOpts(FREE.to)}</select></div></div>
    <p class="ta-p">${days.length ? e(days.join(" · ")) : "Choose the class days"} · ${e(formatTime(FREE.from))} – ${e(formatTime(FREE.to))} (IST)${b <= a ? ' · <b style="color:var(--err)">end time is before start</b>' : ""}</p>
    ${TA.noSql ? noSqlBox("Free time") : ""}
    <div class="ta-rows wk">${res.map(r => `<button class="ta-row" data-ta="open" data-id="${e(r.t.id)}" data-tab="avail"><span class="ta-av sm">${e(initials(r.t.name))}</span>
      <span class="ta-mid"><b>${e(r.t.name)}</b><small>${teacherPlans(r.t.id).length} students · ${r.per.map(x => `<span class="${x.ok ? "dok" : "dno"}">${x.d[0]}${x.d === "Thu" || x.d === "Tue" || x.d === "Sat" || x.d === "Sun" ? x.d[1] : ""}</span>`).join("")}</small></span>
      <span class="ta-chip ${r.st[0]}">${e(r.st[1])}</span></button>`).join("")}</div>
    <p class="ta-foot">After choosing a teacher, add the class in Academic Service as usual.</p>`;
}
function paintFreeDate(){
  const day = dowOf(FREE.date), a = toMin(FREE.from), b = toMin(FREE.to);
  const res = wingTeachers().filter(t => (t.status || "Active") === "Active").map(t => {
    const lv = TA.leaves.find(l => l.teacherId === t.id && (l.leave || {}).status !== "declined" && FREE.date >= l.leave.from && FREE.date <= l.leave.to);
    const clash = teacherPlans(t.id).filter(p => scheduled(p, FREE.date) && toMin(p.time) !== null)
      .find(p => { const s = toMin(p.time), en = s + (+p.duration || 50); return s < b && en > a; });
    const av = TA.avail[t.id], rs = rangesOf(av, day);
    const covers = rs.some(r => toMin(r[0]) <= a && toMin(r[1]) >= b);
    const part = !covers && rs.some(r => toMin(r[0]) < b && toMin(r[1]) > a);
    let st;
    if(lv) st = ["off", "On leave" + (lv.leave.status === "pending" ? " (asked)" : ""), 4];
    else if(clash) st = ["warn", "Class · " + studentName(clash.studentId) + " " + formatTime(clash.time), 3];
    else if(!av) st = ["", "Has not set free time", 5];
    else if(covers) st = ["ok", av.newStudents === false ? "Free · not taking new students" : "Free", av.newStudents === false ? 1 : 0];
    else if(part) st = ["new", "Partly free · " + fmtRanges(rs.filter(r => toMin(r[0]) < b && toMin(r[1]) > a)), 2];
    else st = ["", dayOff(av, day) ? "Day off (" + day + ")" : rs.length ? "Not free then · free " + fmtRanges(rs) : "Not free on " + day, 6];
    return { t, st };
  }).sort((x, y) => x.st[2] - y.st[2]);
  $("taFreeBody").innerHTML = freeModeBar() + `
    <div class="field-row three"><div class="field"><label>Date</label><input type="date" id="taFreeDate" value="${e(FREE.date)}" /></div>
      <div class="field"><label>From</label><select id="taFreeFrom">${timeOpts(FREE.from)}</select></div>
      <div class="field"><label>To</label><select id="taFreeTo">${timeOpts(FREE.to)}</select></div></div>
    <p class="ta-p">${e(fmtD(FREE.date))} · ${e(formatTime(FREE.from))} – ${e(formatTime(FREE.to))} (IST)${b <= a ? ' · <b style="color:var(--err)">end time is before start</b>' : ""}</p>
    ${TA.noSql ? noSqlBox("Free time") : ""}
    <div class="ta-rows">${res.map(r => `<button class="ta-row" data-ta="open" data-id="${e(r.t.id)}" data-tab="avail"><span class="ta-av sm">${e(initials(r.t.name))}</span>
      <span class="ta-mid"><b>${e(r.t.name)}</b><small>${teacherPlans(r.t.id).length} students</small></span><span class="ta-chip ${r.st[0]}">${e(r.st[1])}</span></button>`).join("")}</div>`;
}

/* =================================================================
   SETTINGS + FIXED ATTENDANCE BUTTON
   ================================================================= */
function attOwn(){ return /^clsdemo_/.test(window.MQ_SUPABASE_PREFIX || ""); }
function attLink(){ if(attOwn()) return "/portal/demo/attendance/"; try{ return localStorage.getItem(ATT_KEY) || ""; }catch(x){ return ""; } }
function setAttLink(v, fromServer){
  try{ if(v) localStorage.setItem(ATT_KEY, v); else localStorage.removeItem(ATT_KEY); }catch(x){}
  const f = $("attFab"); if(f) f.classList.toggle("unset", !v);
  const tb = $("attTopBtn"); if(tb) tb.classList.toggle("unset", !v);
  if(TA.linkRows){ const n = linkNameFrom(TA.linkRows); if(n !== TA.linkName){ TA.linkName = n; WING.ref = null; if(TA.loaded){ paintWorkspace(); paintAsPanel(); } } }
  if(!fromServer){ const fr = $("attFrame"); if(fr){ fr.remove(); } }
  if(fromServer){ const fr = $("attFrame"); if(fr && fr.dataset.src !== v){ fr.remove(); } }
}
function ensureSettings(){
  if($("taSetModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "taSetModal";
  d.innerHTML = `<div class="modal"><div class="modal-head"><h3>Class sheet <span class="accent">settings</span></h3><p>Saved for every admin on the demo.</p></div>
    <div class="modal-body">
      <div class="field"><label>Attendance link</label><input type="url" id="taAttIn" placeholder="https://manzilulquran.in/portal/attendance/#k=…" autocomplete="off" />
        <span class="ta-p">Paste the class-admin link made in Academic Service → Attendance → Admin links. The button in the bottom-right corner opens it over this page.</span></div>
      <div class="field" style="margin-top:14px"><label>Teacher page</label><span class="ta-p">Each teacher's own link is in Teachers → teacher → Access. Teachers can also sign in at<br><b>${e(window.location.origin + mqUrl("/teacher/"))}</b></span></div>
      <div class="field" style="margin-top:14px"><label>Academic Service backup</label><div id="taBkInfo"></div>
        <div class="bk-acts"><button type="button" class="btn-outline sm" data-ta="bksync">Copy now</button><button type="button" class="btn-outline sm" data-ta="bkdown">Download backup</button></div></div>
      <div class="field" style="margin-top:14px"><label>Calendars</label><span class="ta-p">Each running class gets the month's calendar — the same links, the weekly off from its class days. A class that already has one is left as it is. This also runs when a month is set up in the attendance.</span>
        <div class="bk-acts" id="taCalActs"></div></div>
      <div id="taSetMsg" class="ta-p"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" data-ta="setclose">Cancel</button><button class="btn-solid" data-ta="setsave">Save</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taSetModal"); });
}
async function openSettings(){
  ensureSettings();
  $("taAttIn").value = attOwn() ? "" : attLink();
  { const f = $("taAttIn").closest(".field"); if(f) f.hidden = attOwn(); }
  $("taSetMsg").textContent = "";
  paintBackupInfo();
  { const ca = $("taCalActs"), m0 = curMonth(), m1 = shiftMonth(m0, 1);
    if(ca) ca.innerHTML = [m0, m1].map(m => `<button type="button" class="btn-outline sm" data-ta="mcal" data-v="${m}">${e(monthLabel(m))}</button>`).join(""); }
  openModal("taSetModal");
  try{
    const out = await tAdminSettings();
    if(out && out.result === "success"){ const v = (out.settings || {}).attendanceLink || ""; if(v && !$("taAttIn").value) $("taAttIn").value = v; }
    else if(out && out.missing) $("taSetMsg").textContent = "Server settings are not set up yet — the link will be kept on this device only.";
  }catch(x){}
}
async function saveSettings(){
  const v = ($("taAttIn").value || "").trim();
  if(v && !/^https:\/\//i.test(v) && !/^\//.test(v)){ $("taSetMsg").textContent = "The link should start with https://"; return; }
  setAttLink(v);
  const out = await tAdminSetSetting("attendanceLink", v).catch(() => null);
  closeModal("taSetModal");
  toast(out && out.result === "success" ? "Settings saved" : "Saved on this device (server settings not set up yet)", !(out && out.result === "success"));
}

/* v4: the link for THIS class sheet, on this site (so the sheet can talk to this page) */
function attFrameUrl(v){
  if(attOwn()) return new URL("/portal/demo/attendance/", location.origin).toString();
  try{
    const u = new URL(v, location.origin);
    const local = /^\/portal\/attendance\/?$/.test(u.pathname) ? new URL(u.pathname + u.search + u.hash, location.origin) : u;
    local.searchParams.set("cs", /^clsdemo_/.test(window.MQ_SUPABASE_PREFIX || "") ? "demo" : "live");
    return local.toString();
  }catch(x){ return v; }
}
function buildFab(){
  if($("attFab")) return;
  const tb = document.querySelector("#adminView .topbar"), mb = $("menuBtn");
  if(tb && mb && !$("attTopBtn")){
    const t = document.createElement("button");
    t.id = "attTopBtn"; t.type = "button"; t.className = "att-top";
    t.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2v4M16 2v4M8 12l2.5 2.5L16 9"/></svg><span>Attendance</span>';
    tb.insertBefore(t, mb);
    t.addEventListener("click", toggleAtt);
  }
  const dim = document.createElement("div");
  dim.id = "attDim"; dim.className = "att-dim"; dim.hidden = true;
  document.body.appendChild(dim);
  dim.addEventListener("click", closeAtt);
  const b = document.createElement("button");
  b.id = "attFab"; b.type = "button"; b.className = "att-fab" + (attLink() ? "" : " unset");
  b.setAttribute("aria-label", "Attendance");
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2v4M16 2v4M8 12l2.5 2.5L16 9"/></svg><span>Attendance</span>';
  document.body.appendChild(b);
  const o = document.createElement("div");
  o.id = "attOverlay"; o.className = "att-overlay"; o.hidden = true;
  o.innerHTML = `<div class="att-bar"><span class="att-grab" aria-hidden="true"></span><b>Attendance</b><span class="att-sub">${attOwn() ? "This class sheet's attendance · Academic Service gets a copy" : "This class sheet's students · marks save straight to Academic Service"}</span>
    <a class="ib" id="attNewTab" target="_blank" rel="noopener" aria-label="Open in a new tab" title="Open in a new tab">↗</a>
    <button class="ib" data-ta="attreload" aria-label="Reload" title="Reload">↻</button>
    <button class="ib" data-ta="attclose" aria-label="Close" title="Close">✕</button></div><div class="att-frame" id="attFrameBox"></div>`;
  document.body.appendChild(o);
  b.addEventListener("click", toggleAtt);
}
function toggleAtt(){
  const o = $("attOverlay");
  if(!o.hidden){ closeAtt(); return; }
  const v = attLink();
  if(!v){ openSettings(); toast("Add the attendance link first"); return; }
  let fr = $("attFrame");
  if(!fr){
    fr = document.createElement("iframe");
    fr.id = "attFrame"; fr.title = "Attendance"; fr.src = attFrameUrl(v); fr.dataset.src = v;
    fr.setAttribute("allow", "clipboard-write");
    fr.addEventListener("load", () => { fr.dataset.ready = "1"; });
    $("attFrameBox").appendChild(fr);
  }
  $("attNewTab").href = attFrameUrl(v);
  o.hidden = false; $("attDim").hidden = false;
  requestAnimationFrame(() => { o.classList.add("open"); $("attDim").classList.add("open"); });
  $("attFab").classList.add("on");
  document.body.classList.add("att-open");
}
/* tell the attendance sheet to open + Student (or + Class), once it is ready */
function attCommand(cmd, extra){
  if(!attLink()){ openSettings(); toast("Add the attendance link first"); return; }
  if($("attOverlay").hidden) toggleAtt();
  const fr = $("attFrame");
  const send = () => { try{ fr.contentWindow.postMessage(Object.assign({ type: "mq-att-cmd", cmd: cmd }, extra || {}), location.origin); }catch(x){} };
  if(fr.dataset.ready) setTimeout(send, 150); else fr.addEventListener("load", () => setTimeout(send, 900), { once: true });
}
function closeAtt(){
  const o = $("attOverlay"); if(!o || o.hidden) return;
  o.classList.remove("open"); $("attDim").classList.remove("open");
  $("attFab").classList.remove("on");
  document.body.classList.remove("att-open");
  setTimeout(() => { if(!o.classList.contains("open")){ o.hidden = true; $("attDim").hidden = true; } }, 280);   // the frame stays loaded
}
/* on a phone the button steps aside while the list scrolls down, and comes back on the way up */
(function(){
  let last = window.scrollY, tm = null;
  window.addEventListener("scroll", function(){
    const f = $("attFab"); if(!f) return;
    const y = window.scrollY;
    if(y > last + 6 && y > 120) f.classList.add("away"); else if(y < last - 6) f.classList.remove("away");
    last = y;
    clearTimeout(tm); tm = setTimeout(() => f.classList.remove("away"), 1400);
  }, { passive: true });
})();

/* =================================================================
   EVENTS
   ================================================================= */
document.addEventListener("click", async function(ev){
  const el = ev.target.closest("[data-ta]"); if(!el) return;
  const a = el.dataset.ta, id = el.dataset.id, v = el.dataset.v;
  const t = TA.open ? teacher(TA.open) : null;
  if(a === "reload"){ paintLoading(); await taLoad(true); paintWorkspace(); }
  else if(a === "open"){ if($("taFreeModal") && $("taFreeModal").classList.contains("show")) closeModal("taFreeModal"); openTeacher(id, el.dataset.tab); }
  else if(a === "close"){ if(TA.chat){ TA.chat.destroy(); TA.chat = null; } closeModal("taModal"); }
  else if(a === "tab"){ TA.tab = v; TA.student = null; paintSheet(); if(v === "notices" && t){ await loadNotes(t.id); paintSheet(); paintWorkspace(); } }
  else if(a === "mon"){ TA.month = shiftMonth(TA.month, +v); paintSheet(); await loadMonth(TA.month); paintSheet(); }
  else if(a === "student"){ TA.student = id; paintSheet(); $("taBody").scrollTop = 0; }
  else if(a === "back"){ TA.student = null; paintSheet(); }
  else if(a === "notice" && t){
    const ta = $("taNotice"), body = (ta.value || "").trim(); if(!body) return;
    el.disabled = true;
    const out = await tAdminNotice(t.id, body); el.disabled = false;
    if(out && out.result === "success"){ TA.notes[t.id] = out.notes; paintSheet(); toast("Notice posted"); } else toast((out && out.error) || "Could not post", true);
  }
  else if(a === "leave" && t){
    const n = (TA.notes[t.id] || []).find(x => String(x.id) === String(id)); if(!n) return;
    const text = v === "approved" ? `Leave ${fmtRange(n.leave)} approved ✅` : `Leave ${fmtRange(n.leave)} not approved — please contact the office.`;
    const out = await tAdminLeave(id, v, text);
    if(out && out.result === "success"){ TA.notes[t.id] = out.notes; await taRefreshList(); paintSheet(); paintWorkspace(); toast("Leave " + v); } else toast((out && out.error) || "Could not save", true);
  }
  else if(a === "delnote" && t){
    const out = await tAdminDeleteNote(id);
    if(out && out.result === "success"){ TA.notes[t.id] = out.notes; paintSheet(); }
  }
  else if(a === "create" && t){
    const dob = $("taDob").value; if(!dob){ toast("Enter the date of birth", true); return; }
    el.disabled = true;
    const out = await tAdminSaveProfile(t.id, dob); el.disabled = false;
    if(out && out.result === "success"){ TA.profiles[t.id] = out.profile; paintSheet(); paintWorkspace(); toast("Profile made"); } else toast((out && out.error) || "Could not save", true);
  }
  else if(a === "dob" && t){
    const dob = $("taDob").value; if(!dob) return;
    const out = await tAdminSaveProfile(t.id, dob);
    if(out && out.result === "success"){ TA.profiles[t.id] = out.profile; paintSheet(); toast("Date of birth saved"); } else toast((out && out.error) || "Could not save", true);
  }
  else if(a === "active" && t){
    const on = v === "1";
    if(!on && !confirm("Deactivate " + t.name + "'s profile? They are signed out at once.")) return;
    const out = await tAdminSetActive(t.id, on);
    if(out && out.result === "success"){ TA.profiles[t.id] = out.profile; paintSheet(); paintWorkspace(); toast(on ? "Profile switched on" : "Profile switched off"); } else toast((out && out.error) || "Could not save", true);
  }
  else if(a === "reset" && t){
    if(!confirm("Make a new link? The old link stops working and the teacher is signed out.")) return;
    const out = await tAdminResetLink(t.id);
    if(out && out.result === "success"){ TA.profiles[t.id] = out.profile; paintSheet(); toast("New link made — send it to the teacher"); } else toast((out && out.error) || "Could not reset", true);
  }
  else if(a === "copy"){ const i = $("taLinkIn"); if(i){ navigator.clipboard.writeText(i.value).then(() => toast("Link copied"), () => { i.select(); toast("Select and copy the link"); }); } }
  else if(a === "freeclose") closeModal("taFreeModal");
  else if(a === "freemode"){ FREE.mode = v; paintFree(); }
  else if(a === "freeday"){ const i = FREE.days.indexOf(v); if(i >= 0) FREE.days.splice(i, 1); else FREE.days.push(v); FREE.days.sort((x, y) => WEEK.indexOf(x) - WEEK.indexOf(y)); paintFree(); }
  else if(a === "setclose") closeModal("taSetModal");
  else if(a === "setsave") saveSettings();
  else if(a === "mcal"){ closeModal("taSetModal"); if(window.NC) NC.monthCalendars(el.dataset.v, false); }
  else if(a === "attclose") closeAtt();
  else if(a === "acsopen"){ TA.asOpen = !TA.asOpen; paintAsPanel(); }
  else if(a === "acsmake") makeSheet(id, el);
  else if(a === "acsrm"){ if(window.NC && NC.removeClass) NC.removeClass(id); }
  else if(a === "acssame"){ hidePlan(id); paintAsPanel(); toast("Kept with its existing sheet"); }
  else if(a === "newclose") closeModal("taNewModal");
  else if(a === "newfrom"){
    closeModal("taNewModal");
    if(!TA.loaded) await taLoad();
    TA.asOpen = true; paintAsPanel();
    const bx = $("asPanel"); if(bx && !bx.hidden) bx.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  else if(a === "newboth"){ closeModal("taNewModal"); attCommand("add-student"); }
  else if(a === "newonly"){ closeModal("taNewModal"); openForm(null); }
  else if(a === "attreload"){ const fr = $("attFrame"); if(fr) fr.src = fr.dataset.src; }
});
document.addEventListener("change", async function(ev){
  const el = ev.target;
  if(el.matches && el.matches(".ta-tog") && TA.open){
    const k = el.dataset.perm, on = el.checked;
    const out = await tAdminPerms(TA.open, { [k]: on });
    if(out && out.result === "success"){ TA.profiles[TA.open] = out.profile; toast("Saved"); } else { el.checked = !on; toast((out && out.error) || "Could not save", true); }
  }
  if(el.id === "taFreeDate"){ FREE.date = el.value || today(); paintFree(); }
  if(el.id === "taFreeFrom"){ FREE.from = el.value; if(toMin(FREE.to) <= toMin(FREE.from)) FREE.to = minTo(toMin(FREE.from) + 60); paintFree(); }
  if(el.id === "taFreeTo"){ FREE.to = el.value; paintFree(); }
});
document.addEventListener("input", function(ev){
  if(ev.target.id === "acsFind"){
    TA.asFind = ev.target.value; const pos = ev.target.selectionStart;
    paintAsPanel(); const i = $("acsFind"); if(i){ i.focus(); try{ i.setSelectionRange(pos, pos); }catch(x){} }
    return;
  }
  if(ev.target.id === "taQ"){ TA.q = ev.target.value; const box = document.querySelector("#wsTeachers .ta-list"); if(box) box.innerHTML = listHtml(); }
});
document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && $("attOverlay") && !$("attOverlay").hidden && !document.querySelector(".modal-backdrop.show")) closeAtt();
});

/* =================================================================
   v4 — CLASS SHEET ↔ ACADEMIC SERVICE
   Academic Service owns the student, the class (teacher, days, time),
   the attendance and the fee. The class sheet owns its link, calendar,
   study material, chat and sign-in. They meet on the MQ ID: one class
   sheet per MQ ID + course, so nothing is made twice.
   ================================================================= */
const ICON_T = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 10L12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/></svg>';
function sameCourse(a, b){
  a = String(a || "").toLowerCase().trim(); b = String(b || "").toLowerCase().trim();
  return !!a && !!b && (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0);
}
function sheetsOf(mq){ return (typeof classes !== "undefined" ? classes : []).filter(c => String(c["mqId"] || c["Student ID"] || "").toUpperCase() === mq); }
function plansOfSheet(c){
  const mq = String(c["mqId"] || c["Student ID"] || "").toUpperCase(); if(!mq) return [];
  return TA.plans.filter(p => String(p.studentId || "").toUpperCase() === mq && planRunning(p, today()));
}
/* v6: a class runs on a day when it is Active, or Stopped with its last class day still ahead */
function planRunning(p, ds){ return p.endDate ? p.endDate >= ds : (p.status || "Active") === "Active"; }
function planPauseOn(p, ds){ return (Array.isArray(p.pauses) ? p.pauses : []).find(x => x && x.from && ds >= x.from && (!x.until || ds <= x.until)) || null; }
function planPauseNext(p, ds){ return (Array.isArray(p.pauses) ? p.pauses : []).filter(x => x && x.from && (!x.until || x.until >= ds)).sort((a, b) => a.from < b.from ? -1 : 1)[0] || null; }
function planNoteHtml(p){
  const t = today(), pz = planPauseNext(p, t);
  if(p.endDate) return `<span class="row-note end" title="Stopped in the attendance">Last class ${e(fmtD(p.endDate))}</span>`;
  if(pz) return `<span class="row-note pz" title="${e(pz.reason || "Paused in the attendance")}">${pz.from <= t ? "Paused" : "Pause " + e(fmtD(pz.from))}${pz.until ? " · back " + e(fmtD(addDaysISO(pz.until, 1))) : ""}</span>`;
  return "";
}
function planOfSheet(c){ const ps = plansOfSheet(c); return ps.find(p => sameCourse(p.course, c["Course"])) || ps[0] || null; }

/* each class sheet row: its teacher, and whether the student signs in */
window.CLS_ROW = function(c){
  let h = "";
  if(TA.loaded){
    const p = planOfSheet(c);
    if(p){ const t = teacher(p.teacherId); h += `<small class="row-teacher">${ICON_T}<span>${e(t ? t.name : "No teacher yet")}</span></small>`;
      if(p._gone) h += '<span class="row-note gone" title="Deleted in Academic Service — the class sheet keeps its copy">Not in Academic Service</span>';
      h += planNoteHtml(p); }
    else if(c["mqId"]) h += '<small class="row-teacher none">No class in Academic Service</small>';
  }
  const si = TA.signins[c["Class ID"]];
  if(si && si.on) h += '<span class="row-note si" title="The student signs in once with phone + date of birth">Sign-in</span>';
  return h;
};

/* ---------------- classes without a class sheet ---------------- */
function hideKey(){ return "mq_as_same_" + (window.MQ_SUPABASE_PREFIX || ""); }
function hiddenPlans(){ try{ return JSON.parse(localStorage.getItem(hideKey()) || "{}") || {}; }catch(x){ return {}; } }
function hidePlan(id){ const h = hiddenPlans(); h[id] = 1; try{ localStorage.setItem(hideKey(), JSON.stringify(h)); }catch(x){} }
function missingSheets(){
  const hid = hiddenPlans();
  return TA.plans.filter(p => (p.status || "Active") === "Active" && !hid[p.id] && inWing(p)).map(p => {
    const own = sheetsOf(String(p.studentId || "").toUpperCase());
    if(own.some(c => !c["Course"] || sameCourse(c["Course"], p.course))) return null;
    return { p: p, other: own[0] || null };
  }).filter(Boolean).sort((a, b) => String(b.p.addedAt || b.p.startDate || "").localeCompare(String(a.p.addedAt || a.p.startDate || "")));
}
function waitingOffice(p){ return p.reviewed === false || !!p.setupNeeded; }
function acsRow(x){
  const p = x.p, st = TA.students[p.studentId] || {}, t = teacher(p.teacherId), days = planDays(p).join(" · ");
  return `<div class="acs-row"><div class="acs-mid"><b>${e(st.name || p.studentId)}</b> <span class="acs-id">${e(p.studentId)}</span>
      <small>${e(p.course || "—")} · ${e(t ? t.name : "No teacher")}${days ? " · " + e(days) : ""}${p.time ? " · " + e(formatTime(p.time)) : ""}</small>
      <span class="acs-chips">${waitingOffice(p) ? '<span class="ta-chip warn">Waiting for the office</span>' : ""}${x.other ? `<span class="ta-chip">Has a sheet: ${e(x.other["Course"] || "—")}</span>` : ""}${st.dob ? "" : '<span class="ta-chip">No date of birth · sign-in stays off</span>'}</span></div>
    <div class="acs-acts">${x.other ? `<button class="btn-ghost acs-b" data-ta="acssame" data-id="${e(p.id)}" title="This class is the one on that sheet">Same class</button>` : ""}
      ${x.other ? (p.addedVia === "class-sheet" || p.testCopy ? `<button class="btn-ghost acs-b danger" data-ta="acsrm" data-id="${e(p.id)}" title="Made here by mistake — one class sheet per student">Remove</button>` : "")
        : `<button class="btn-solid acs-b" data-ta="acsmake" data-id="${e(p.id)}">Create sheet</button>`}</div></div>`;
}
function paintAsPanel(){
  const box = $("asPanel"); if(!box) return;
  if(!TA.loaded || TA.error){ box.hidden = true; return; }
  const list = missingSheets();
  if(!list.length && !TA.asOpen){ box.hidden = true; box.innerHTML = ""; return; }
  const q = (TA.asFind || "").trim().toUpperCase();
  const found = q ? TA.plans.filter(p => String(p.studentId || "").toUpperCase() === q && (p.status || "Active") === "Active") : [];
  const html = `<button class="acs-head" data-ta="acsopen" aria-expanded="${!!TA.asOpen}">
      <span class="acs-ic" aria-hidden="true">⇄</span>
      <span class="acs-t"><b>${list.length ? list.length + " class" + (list.length === 1 ? "" : "es") + " without a class sheet" : "Every class has its sheet"}</b>
        <small>From Academic Service · one tap makes the sheet; add its calendar after</small></span>
      <span class="acs-cv" aria-hidden="true">${TA.asOpen ? "▴" : "▾"}</span></button>
    ${TA.asOpen ? `<div class="acs-list">${list.map(acsRow).join("")}
      <div class="acs-find"><input id="acsFind" value="${e(TA.asFind || "")}" placeholder="Another student? Type the MQ ID" autocomplete="off" /></div>
      ${q ? (found.length ? found.map(p => acsRow({ p: p, other: sheetsOf(q).find(c => !sameCourse(c["Course"], p.course)) || null })).join("")
             : '<div class="acs-empty">No active class for ' + e(q) + ' in Academic Service.</div>') : ""}</div>` : ""}`;
  box.hidden = false;
  if(box._html !== html){ box._html = html; box.innerHTML = html; }
}
function matchCourse(name){
  const list = (typeof courses !== "undefined" ? courses : []).filter(c => c.active);
  const n = String(name || "").toLowerCase().trim(); if(!n) return "";
  const hit = list.find(c => String(c.name).toLowerCase() === n) || list.find(c => sameCourse(c.name, n));
  return hit ? hit.name : "";
}
function studentPhone(st){
  const w = digits(st.whatsapp), cc = digits(st.whatsappCC);
  if(w) return (cc && w.length <= 10 ? "+" + cc + " " : "") + w;
  return String(st.phone || "");
}
function sheetPayload(p){
  const st = TA.students[p.studentId] || {};
  return { studentName: st.name || p.studentId, studentId: p.studentId, course: matchCourse(p.course), mqId: p.studentId,
    classTime: /^\d{1,2}:\d{2}$/.test(p.time || "") ? p.time : "", subjects: [], joinDate: p.startDate || today(),
    whatsapp: "", phone: studentPhone(st), status: "Active", studyMaterial: "", hifzLink: "" };
}
/* the course has no match in this class sheet's courses: the form opens filled in, the admin picks the course */
function prefillForm(pl, dob, asCourse){
  openForm(null);
  $("fName").value = pl.studentName; $("fStudentId").value = pl.studentId; $("fMqId").value = pl.mqId;
  $("fClassTime").value = pl.classTime; $("fJoinDate").value = pl.joinDate; $("fPhone").value = pl.phone;
  if($("fSiDob")){ $("fSiDob").value = dob || ""; $("fSiOn").checked = false; }
  setTimeout(() => { const c = $("fCourse"); if(c) c.focus(); }, 260);
  toast("Choose the course (" + (asCourse || "—") + " in Academic Service), then Save");
}
async function makeSheet(planId, btn){
  const p = TA.plans.find(x => x.id === planId); if(!p) return;
  const st = TA.students[p.studentId] || {}, pl = sheetPayload(p);
  if(sheetsOf(String(p.studentId).toUpperCase()).some(c => !c["Course"] || sameCourse(c["Course"], p.course))){ toast("This class already has a sheet"); paintAsPanel(); return; }
  if(!pl.course){ prefillForm(pl, st.dob, p.course); return; }
  if(btn){ btn.disabled = true; btn.textContent = "Making…"; }
  let out = null;
  try{ out = await saveClass(pl); }catch(err){ out = { result: "error", error: String(err && err.message || err) }; }
  if(!out || out.result !== "success"){ if(btn){ btn.disabled = false; btn.textContent = "Create sheet"; } toast((out && out.error) || "Could not make the sheet", true); return; }
  await loadClasses();
  const c = classes.find(x => x["Share Token"] === out.token);
  let si = "";
  if(c && st.dob && digits(pl.phone).length >= 9 && !TA.siMissing){
    /* v7: the phone + date of birth are kept ready, the sign-in stays off until switched on in Edit */
    const r = await sAdmin("set", { classId: c["Class ID"], phone: pl.phone, dob: st.dob, on: false }).catch(() => null);
    if(r && r.result === "success") await siLoad();
  }
  WING.ref = null; paintAsPanel();
  snack("Class sheet made for " + (st.name || p.studentId) + "." + si + " Add its calendar next.", c ? [
    ["Add calendar", () => { location.href = "calendars.html?id=" + encodeURIComponent(c["Class ID"]); }],
    ["Share link", () => openShare(c)]] : []);
}

/* ---------------- + New class sheet: three ways ---------------- */
function ensureNewModal(){
  if($("taNewModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "taNewModal";
  d.innerHTML = `<div class="modal ta-new"><div class="modal-head"><h3>New <span class="accent">class sheet</span></h3>
      <p>A class sheet belongs to a class in Academic Service, so the office sees the student and sets the fee.</p></div>
    <div class="modal-body" id="taNewBody"></div>
    <div class="modal-foot"><button class="btn-ghost" data-ta="newclose">Cancel</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taNewModal"); });
}
window.CLS_NEW = function(){
  ensureNewModal();
  const n = TA.loaded ? missingSheets().length : 0;
  $("taNewBody").innerHTML = `
    <button class="new-opt" data-ta="newfrom"><span class="no-ic">⇄</span><span><b>From Academic Service</b>
      <small>${n ? n + " class" + (n === 1 ? " is" : "es are") + " waiting for a sheet" : "A class already in Academic Service"} — one tap each</small></span></button>
    <button class="new-opt" data-ta="newboth"><span class="no-ic">＋</span><span><b>New student or new class</b>
      <small>Add them in the attendance sheet (+ Student / + Class). The office reviews it and sets the fee; the class then waits here for its sheet.</small></span></button>
    <button class="new-opt quiet" data-ta="newonly"><span class="no-ic">✎</span><span><b>Class sheet only</b>
      <small>Not in Academic Service — fill the form by hand</small></span></button>`;
  openModal("taNewModal");
};

/* ---------------- a small message with buttons ---------------- */
function snack(msg, acts){
  let s = $("taSnack");
  if(!s){ s = document.createElement("div"); s.id = "taSnack"; s.className = "ta-snack"; s.setAttribute("role", "status"); document.body.appendChild(s); }
  s._acts = acts || [];
  s.innerHTML = `<span class="sn-t">${e(msg)}</span>` + s._acts.map((a, i) => `<button class="sn-b" data-snack="${i}">${e(a[0])}</button>`).join("") +
    '<button class="sn-x" data-snack="x" aria-label="Close">✕</button>';
  s.classList.add("show"); clearTimeout(s._t); s._t = setTimeout(() => s.classList.remove("show"), 14000);
}
document.addEventListener("click", function(ev){
  const b = ev.target.closest("[data-snack]"); if(!b) return;
  const s = $("taSnack"); s.classList.remove("show");
  const i = b.dataset.snack; if(i !== "x" && s._acts[+i]) s._acts[+i][1]();
});

/* ---------------- the attendance sheet says a student / class was added ---------------- */
async function reloadAs(){
  try{
    const [ts, ps, ss] = await readAs();
    TA.teachers = ts.filter(t => (t.kind || "teacher") !== "staff")
      .sort((a, b) => ((a.status || "Active") !== "Active") - ((b.status || "Active") !== "Active") || String(a.name).localeCompare(String(b.name)));
    TA.plans = ps; TA.students = {}; ss.forEach(x => { TA.students[x.id] = x; });
    return true;
  }catch(x){ return false; }
}
window.addEventListener("message", async function(ev){
  if(ev.origin !== location.origin || !ev.data || ev.data.type !== "mq-att" || !TA.loaded) return;
  if(ev.data.ev === "plan-paused" || ev.data.ev === "plan-stopped"){
    /* the attendance changed a class: refresh the rows (the change reaches Supabase a moment later) */
    for(const wait of [2500, 6000]){ await new Promise(r => setTimeout(r, wait)); if(await reloadAs()) break; }
    clsAfterLoad(); if(currentWs() === "teachers") paintWorkspace();
    if(ev.data.ev === "plan-stopped" && ev.data.endDate) snack("Class stopped — the class sheet turns off after " + fmtD(ev.data.endDate) + ", and the student is signed out.");
    return;
  }
  if(ev.data.ev !== "plan-added" && ev.data.ev !== "student-added") return;
  let p = null;
  for(const wait of [2500, 5000]){
    await new Promise(r => setTimeout(r, wait));
    if(!(await reloadAs())) continue;
    if(ev.data.ev !== "plan-added") break;
    p = TA.plans.find(x => x.id === ev.data.planId) ||
        TA.plans.filter(x => x.studentId === ev.data.studentId && byLink(x)).sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")))[0] || null;
    if(p) break;
  }
  WING.ref = null; paintAsPanel();
  if(currentWs() === "teachers") paintWorkspace();
  if(p && missingSheets().some(x => x.p.id === p.id)){
    const st = TA.students[p.studentId] || {};
    snack("New class in Academic Service: " + (st.name || p.studentId) + " · " + (p.course || ""), [["Create class sheet", () => makeSheet(p.id)]]);
  }
});

/* ---------------- student sign-in (class sheet form) ---------------- */
async function siLoad(){
  const out = await sAdmin("get").catch(() => null);
  if(out && out.result === "success"){ TA.signins = out.signins || {}; TA.siMissing = false; }
  else if(out && out.missing) TA.siMissing = true;
  if(typeof applyView === "function" && typeof classes !== "undefined" && classes.length) applyView();
}
function siNote(c, si){
  if(TA.siMissing) return "Student sign-in is not set up on the server yet (run clsdemo-signin-wing-v1.sql).";
  if(si && si.on) return "On · " + si.devices + " phone" + (si.devices === 1 ? "" : "s") + " signed in" + (si.lastSeen ? " · last opened " + ago(si.lastSeen) : "");
  return c ? "Off — the link alone opens this sheet." : "Turns on when the contact number and the date of birth are filled.";
}
window.CLS_SI = {
  fill(c){
    if(!$("fSiField")) return;
    const si = c ? TA.signins[c["Class ID"]] : null;
    /* one phone number: the sign-in uses the sheet's contact number, so an empty contact takes the sign-in's */
    if(si && si.phone && !$("fPhone").value.trim()) $("fPhone").value = si.phone;
    $("fSiDob").value = si && si.dob ? si.dob : "";
    $("fSiOn").checked = c ? !!(si && si.on) : false;   // v7: off unless switched on
    $("fSiOut").hidden = !(si && si.devices);
    $("fSiNote").textContent = siNote(c, si);
    $("fSiField").classList.toggle("off", !!TA.siMissing);
  },
  async save(classId){
    if(!$("fSiField") || !classId || TA.siMissing) return;
    const prev = TA.signins[classId], dob = $("fSiDob").value, phone = $("fPhone").value.trim();
    let on = $("fSiOn").checked;
    if(!prev && !dob) return;
    if(on && (!dob || digits(phone).length < 9)){ on = false; toast("Sign-in stays off: it needs the contact number and the date of birth", true); }
    const out = await sAdmin("set", { classId: classId, phone: phone, dob: dob, on: on }).catch(() => null);
    if(out && out.result === "success") await siLoad();
    else if(out && out.missing) TA.siMissing = true;
    else toast((out && out.error) || "Could not save the sign-in", true);
  }
};
const siOut = $("fSiOut");
if(siOut) siOut.addEventListener("click", async function(){
  if(typeof editingId === "undefined" || !editingId) return;
  if(!confirm("Sign this student out on every phone? They sign in again with the phone number and date of birth.")) return;
  const out = await sAdmin("signout", { classId: editingId }).catch(() => null);
  if(out && out.result === "success"){ await siLoad(); CLS_SI.fill(classes.find(x => x["Class ID"] === editingId) || null); toast("Signed out on every phone"); }
  else toast((out && out.error) || "Could not sign out", true);
});

/* after the teachers load: teacher names on the rows, the waiting classes */
function clsAfterLoad(){
  WING.ref = null;
  paintAsPanel();
  if(typeof applyView === "function" && typeof classes !== "undefined" && classes.length) applyView();
}
/* the class list was repainted (a save, a refresh): the waiting classes may have changed */
(function(){
  const lc = $("listContent"); if(!lc) return;
  let tm = null;
  new MutationObserver(() => { clearTimeout(tm); tm = setTimeout(() => { WING.ref = null; if(TA.loaded) paintAsPanel(); }, 250); })
    .observe(lc, { childList: true });
})();

/* =================================================================
   v5 — ACADEMIC SERVICE THROUGH THE KEPT COPY
   ================================================================= */
async function readAs(){
  const v = await asView({ action: "lists" }).catch(() => null);
  if(v && v.result === "success"){
    TA.viaCopy = true;
    TA.backup = Object.assign({}, TA.backup || {}, { kept: v.kept || {}, gone: v.gone || {}, at: v.at || "" });
    return [v.teachers || [], v.plans || [], v.students || [], v.holidays || []];
  }
  TA.viaCopy = false;   // the backup SQL is not run yet: read Academic Service directly, as before
  return Promise.all([fetchAcTeachers(), fetchAcPlans(), fetchAcStudents(), fetchAcHolidays().catch(() => [])]);
}
async function readAsClasses(from, to){
  if(TA.viaCopy){
    const v = await asView({ action: "classes", from: from, to: to }).catch(() => null);
    if(v && v.result === "success") return v.classes || [];
  }
  return fetchAcClasses(from, to);
}
function goneTotal(){ const g = (TA.backup && TA.backup.gone) || {}; return (g.student || 0) + (g.teacher || 0) + (g.plan || 0); }
function goneLine(){
  const g = (TA.backup && TA.backup.gone) || {}, parts = [];
  if(g.student) parts.push(g.student + " student" + (g.student === 1 ? "" : "s"));
  if(g.teacher) parts.push(g.teacher + " teacher" + (g.teacher === 1 ? "" : "s"));
  if(g.plan) parts.push(g.plan + " class" + (g.plan === 1 ? "" : "es"));
  if(g.class) parts.push(g.class + " attendance mark" + (g.class === 1 ? "" : "s"));
  return parts.join(", ");
}
async function backupSync(force){
  const r = await asSync(force).catch(() => null);
  if(r && r.result === "success"){ TA.backup = { kept: r.kept || {}, gone: r.gone || {}, at: r.at || "", skipped: !!r.skipped }; }
  else if(r && r.missing) TA.backup = null;
  paintBackupBanner();
  if($("taBkInfo")) paintBackupInfo();
  return r;
}
function paintBackupBanner(){
  let b = $("bkBanner");
  const box = $("asPanel");
  if(!b && box){ b = document.createElement("div"); b.id = "bkBanner"; b.className = "bk-banner"; box.parentNode.insertBefore(b, box); }
  if(!b) return;
  const n = goneTotal();
  b.hidden = !n;
  if(n) b.innerHTML = `<span class="bk-ic" aria-hidden="true">⛁</span><span class="bk-t"><b>Academic Service no longer has ${e(goneLine())}.</b>
    <small>The class sheet keeps working from its own copy — they show “Not in Academic Service”.</small></span>`;
}
function paintBackupInfo(){
  const box = $("taBkInfo"); if(!box) return;
  if(!TA.backup){ box.innerHTML = '<span class="ta-p">The backup needs <code>clsdemo-cover-backup-v1.sql</code> in Supabase.</span>'; return; }
  const k = TA.backup.kept || {}, n = goneTotal();
  box.innerHTML = `<div class="bk-kept">${[["student","students"],["teacher","teachers"],["plan","classes"],["class","attendance marks"],["holiday","holidays"]]
      .map(([key, l]) => `<span><b>${k[key] || 0}</b> ${l}</span>`).join("")}</div>
    <span class="ta-p">Kept here from Academic Service${TA.backup.at ? " · last copy " + e(ago(TA.backup.at)) : ""}. Refreshed by itself every 3 hours while the admin is open.</span>
    ${n ? `<div class="ta-note warn">Academic Service no longer has ${e(goneLine())}. The class sheet is using its copy.</div>` : ""}`;
}

/* =================================================================
   v5 — BACKUP: review and send back to Academic Service (3 steps)
   ================================================================= */
const BK = { step: 1, items: [], months: [], pick: {}, busy: false, result: null };
function ensureBkModal(){
  if($("taBkModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "taBkModal";
  d.innerHTML = `<div class="modal ta-bk"><div class="modal-head"><h3>Send back to <span class="accent">Academic Service</span></h3>
      <p>Records the class sheet still has, but Academic Service no longer has.</p></div>
    <div class="modal-body" id="taBkBody"></div>
    <div class="modal-foot" id="taBkFoot"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d && !BK.busy) closeModal("taBkModal"); });
}
async function openBackup(){
  ensureBkModal();
  BK.step = 1; BK.result = null;
  $("taBkBody").innerHTML = '<div class="loading"><div class="loading-spin"></div></div>'; $("taBkFoot").innerHTML = "";
  openModal("taBkModal");
  const out = await asRestore({ action: "preview" }).catch(() => null);
  if(!out || out.result !== "success"){
    $("taBkBody").innerHTML = `<div class="ta-note warn">${e((out && out.missing) ? "The backup needs clsdemo-cover-backup-v1.sql in Supabase." : (out && out.error) || "Could not read the backup.")}</div>`;
    $("taBkFoot").innerHTML = '<button class="btn-ghost" data-ta="bkclose">Close</button>'; return;
  }
  BK.items = out.items || []; BK.months = out.months || []; BK.pick = {};
  BK.items.forEach(x => { BK.pick[x.kind + "|" + x.id] = true; });
  BK.months.forEach(x => { BK.pick["m|" + x.planId + "|" + x.month] = true; });
  TA.backup = Object.assign({}, TA.backup || {}, { kept: out.kept || {}, gone: out.gone || {}, at: out.at || "" });
  paintBk();
}
function bkLabel(x){
  if(x.kind === "student") return [x.name || x.id, x.id + " · student"];
  if(x.kind === "teacher") return [x.name || x.id, x.id + " · teacher"];
  if(x.kind === "plan") return [studentName(x.studentId) + " · " + (x.course || "class"), x.id + " · class with " + ((teacher(x.teacherId) || {}).name || x.teacherId || "no teacher")];
  return [x.name || x.id, x.id + " · holiday " + (x.from || "") + (x.to && x.to !== x.from ? " – " + x.to : "")];
}
function bkChosen(){
  return { items: BK.items.filter(x => BK.pick[x.kind + "|" + x.id]).map(x => ({ kind: x.kind, id: x.id })),
           months: BK.months.filter(x => BK.pick["m|" + x.planId + "|" + x.month]).map(x => ({ planId: x.planId, month: x.month })) };
}
function paintBk(){
  const steps = `<div class="bk-steps">${["Review", "Check", "Confirm"].map((l, i) => `<span class="${BK.step === i + 1 ? "on" : BK.step > i + 1 ? "done" : ""}">${i + 1}. ${l}</span>`).join("")}</div>`;
  const ch = bkChosen(), n = ch.items.length + ch.months.length;
  let body = "", foot = "";
  if(BK.result){
    body = steps + `<div class="ta-note ok">Sent back: <b>${BK.result.restored || 0}</b> record${BK.result.restored === 1 ? "" : "s"}${BK.result.skipped ? " · " + BK.result.skipped + " skipped (Academic Service has them now)" : ""}.</div>
      <p class="ta-p">The office sees them after reloading Academic Service. Nothing that already existed there was changed.</p>`;
    foot = '<button class="btn-solid" data-ta="bkclose">Done</button>';
  } else if(!BK.items.length && !BK.months.length){
    body = steps + '<div class="ta-empty">Academic Service has every record the class sheet uses. Nothing to send back.</div>';
    foot = '<button class="btn-ghost" data-ta="bkclose">Close</button>';
  } else if(BK.step === 1){
    const row = (key, title, sub, forget) => `<label class="bk-row"><input type="checkbox" data-bk="${e(key)}" ${BK.pick[key] ? "checked" : ""}/>
      <span class="bk-mid"><b>${e(title)}</b><small>${e(sub)}</small></span>${forget ? `<button type="button" class="ta-link" data-ta="bkforget" data-v="${e(forget)}" title="It was deleted on purpose — stop keeping it here">Forget</button>` : ""}</label>`;
    body = steps + `<p class="ta-p">Tick what should go back. <b>Forget</b> = it was deleted on purpose; the class sheet stops keeping it.</p>
      <div class="bk-list">${BK.items.map(x => { const l = bkLabel(x); return row(x.kind + "|" + x.id, l[0], l[1] + " · gone " + ago(x.goneAt), x.kind + "|" + x.id); }).join("")}
      ${BK.months.map(x => row("m|" + x.planId + "|" + x.month, "Attendance · " + x.month, x.marks + " mark" + (x.marks === 1 ? "" : "s") + " of " + x.planId + " (" + studentName(((TA.plans.find(p => p.id === x.planId)) || {}).studentId) + ")", "")).join("")}</div>`;
    foot = `<button class="btn-ghost" data-ta="bkclose">Cancel</button><button class="btn-solid" data-ta="bknext" ${n ? "" : "disabled"}>Next · ${n} chosen</button>`;
  } else if(BK.step === 2){
    const by = {}; ch.items.forEach(x => { by[x.kind] = (by[x.kind] || 0) + 1; });
    body = steps + `<div class="bk-sum">${Object.keys(by).map(k => `<span><b>${by[k]}</b> ${k}${by[k] === 1 ? "" : "s"}</span>`).join("")}${ch.months.length ? `<span><b>${ch.months.length}</b> month${ch.months.length === 1 ? "" : "s"} of attendance</span>` : ""}</div>
      <ul class="bk-rules"><li>Each record goes back exactly as the class sheet last copied it, marked <i>restored from the class sheet</i>.</li>
        <li>A record that exists in Academic Service now is <b>never</b> changed.</li>
        <li>Attendance goes back only for a month that has no marks there now.</li>
        <li>Fees and payments are not part of this — they stay with the office.</li></ul>`;
    foot = '<button class="btn-ghost" data-ta="bkback">Back</button><button class="btn-solid" data-ta="bknext">Next</button>';
  } else {
    body = steps + `<p class="ta-p">Type <b>RESTORE</b> to send ${n} record${n === 1 ? "" : "s"} back to Academic Service.</p>
      <input id="bkWord" class="bk-word" autocomplete="off" autocapitalize="characters" placeholder="RESTORE" />`;
    foot = `<button class="btn-ghost" data-ta="bkback">Back</button><button class="btn-solid danger" data-ta="bkapply" id="bkApply" disabled>${BK.busy ? "Sending…" : "Send to Academic Service"}</button>`;
  }
  $("taBkBody").innerHTML = body; $("taBkFoot").innerHTML = foot;
  if(BK.step === 3 && !BK.result) setTimeout(() => { const w = $("bkWord"); if(w) w.focus(); }, 60);
}
async function bkApply(){
  if(BK.busy) return;
  const ch = bkChosen();
  BK.busy = true; paintBk(); $("bkWord") && ($("bkWord").value = "RESTORE");
  const out = await asRestore({ action: "apply", confirm: "RESTORE", items: ch.items, months: ch.months }).catch(() => null);
  BK.busy = false;
  if(out && out.result === "success"){
    BK.result = out; TA.backup = Object.assign({}, TA.backup || {}, { kept: out.kept || {}, gone: out.gone || {} });
    paintBk(); paintBackupBanner(); taLoad(true).then(() => { paintWorkspace(); clsAfterLoad(); });
  } else { paintBk(); toast((out && out.error) || "Could not send back", true); }
}
/* a JSON file the admin keeps: the class sheets (with calendars) + the kept Academic Service copy */
async function downloadBackup(){
  const v = TA.viaCopy ? await asView({ action: "lists" }).catch(() => null) : null;
  const data = { exportedAt: new Date().toISOString(), prefix: window.MQ_SUPABASE_PREFIX || "",
    classSheets: typeof classes !== "undefined" ? classes : [], batches: typeof batches !== "undefined" ? batches : [],
    academicService: v && v.result === "success" ? { teachers: v.teachers, students: v.students, plans: v.plans, holidays: v.holidays } : null,
    covers: TA.subs || [] };
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "class-sheet-backup-" + today() + ".json";
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast("Backup downloaded — keep it somewhere safe; it holds the share links");
}

/* =================================================================
   v5 — COVER CLASSES
   ================================================================= */
const COVER = { tid: "", date: "", from: "", to: "", sel: {}, note: {}, busy: "" };
async function loadSubs(){
  const out = await tSubAdmin({ action: "list", from: addDaysISO(today(), -30), to: addDaysISO(today(), 60) }).catch(() => null);
  if(out && out.result === "success"){ TA.subs = out.subs || []; TA.subsLoaded = true; TA.subsMissing = false; }
  else if(out && out.missing){ TA.subsMissing = true; }
}
function addDaysISO(ds, n){ const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/* tell an open attendance sheet (same site) to re-read the planned covers — never opens it */
function attQuiet(cmd){ const fr = $("attFrame"); if(!fr || !fr.dataset.ready) return; try{ fr.contentWindow.postMessage({ type: "mq-att-cmd", cmd: cmd }, location.origin); }catch(x){} }
function classesOn(tid, ds){
  const dw = dowOf(ds);
  return TA.plans.filter(p => p.teacherId === tid && planRunning(p, ds) && inWing(p) && !planPauseOn(p, ds) &&
    planDays(p).indexOf(dw) >= 0 && (!p.startDate || p.startDate <= ds))
    .sort((a, b) => (toMin(a.time) || 0) - (toMin(b.time) || 0));
}
function subOf(planId, ds){ return TA.subs.find(x => x.planId === planId && x.date === ds && x.status === "planned"); }
function holidayOn(ds){ return (TA.holidays || []).find(h => h.from && ds >= h.from && ds <= (h.to || h.from)); }
/* 0 free · 1 free time not set · 2 outside free time / day off · 3 busy (class, another cover, leave) */
function coverFit(tid, ds, a, b){
  const dw = dowOf(ds);
  const clash = TA.plans.find(p => p.teacherId === tid && (p.status || "Active") === "Active" && planDays(p).indexOf(dw) >= 0 &&
    (!p.startDate || p.startDate <= ds) && toMin(p.time) !== null && toMin(p.time) < b && toMin(p.time) + (+p.duration || 50) > a);
  if(clash) return [3, "Has a class then"];
  const cov = TA.subs.find(x => x.status === "planned" && x.subId === tid && x.date === ds && toMin(x.time) !== null && toMin(x.time) < b && toMin(x.time) + (+x.duration || 50) > a);
  if(cov) return [3, "Covering another class then"];
  const lv = (TA.leaves || []).find(l => l.teacherId === tid && (l.leave || {}).status !== "declined" && ds >= l.leave.from && ds <= l.leave.to);
  if(lv) return [3, "On leave"];
  const av = TA.avail[tid];
  if(!av) return [1, "Free time not set"];
  if(dayOff(av, dw)) return [2, "Day off"];
  if(a === null) return [1, "No class time"];
  return rangesOf(av, dw).some(r => toMin(r[0]) <= a && toMin(r[1]) >= b) ? [0, "Free"] : [2, "Outside their free time"];
}
function coverCandidates(p, ds){
  const a = toMin(p.time), b = a === null ? null : a + (+p.duration || 50);
  return wingTeachers().filter(t => t.id !== p.teacherId && (t.status || "Active") === "Active")
    .map(t => ({ t: t, fit: coverFit(t.id, ds, a, b), prof: !!(TA.profiles[t.id] && TA.profiles[t.id].active) }))
    .sort((x, y) => x.fit[0] - y.fit[0] || (y.prof - x.prof) || String(x.t.name).localeCompare(String(y.t.name)));
}
function ensureCoverModal(){
  if($("taCoverModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop"; d.id = "taCoverModal";
  d.innerHTML = `<div class="modal ta-cover"><div class="modal-head"><h3>Cover a <span class="accent">class</span></h3>
      <p>Another teacher takes the class for one day. They see only the student's first name, course, time and material, and a Join that works on that day.</p></div>
    <div class="modal-body" id="taCoverBody"></div>
    <div class="modal-foot"><button class="btn-ghost" data-ta="covclose">Close</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taCoverModal"); });
}
/* from/to: the days of an approved leave (the day chips then show those days) */
async function openCover(tid, ds, from, to){
  ensureCoverModal();
  if(!TA.loaded) await taLoad();
  COVER.tid = tid || ""; COVER.date = ds || today(); COVER.from = from || ""; COVER.to = to || ""; COVER.sel = {}; COVER.note = {};
  $("taCoverBody").innerHTML = '<div class="loading"><div class="loading-spin"></div></div>';
  openModal("taCoverModal");
  await loadSubs();
  paintCover();
}
function coverDates(){
  const out = [];
  if(COVER.from && COVER.to){ for(let d = COVER.from; d <= COVER.to && out.length < 14; d = addDaysISO(d, 1)) out.push(d); return out; }
  for(let i = 0; i < 7; i++) out.push(addDaysISO(today(), i));
  return out;
}
function paintCover(){
  const box = $("taCoverBody"); if(!box) return;
  if(TA.subsMissing){ box.innerHTML = '<div class="ta-note warn">Covers need <code>clsdemo-cover-backup-v1.sql</code> in Supabase. Run it, then reload.</div>'; return; }
  const teachers = wingTeachers().filter(t => (t.status || "Active") === "Active");
  const ds = COVER.date, list = COVER.tid ? classesOn(COVER.tid, ds) : [], hol = holidayOn(ds);
  const dates = coverDates();
  const rows = list.map(p => {
    const cur = subOf(p.id, ds), when = (p.time ? formatTime(p.time) : "No time") + " · " + (p.duration || 50) + " min";
    if(cur) return `<div class="cov-row done"><div class="cov-mid"><b>${e(studentName(p.studentId))}</b><small>${e(p.course || "—")} · ${e(when)}</small></div>
      <div class="cov-who"><span class="ta-chip ok">Covered by ${e(cur.sub)}</span>
        <button class="btn-ghost sm" data-ta="covcancel" data-id="${e(cur.id)}">Cancel cover</button></div></div>`;
    const cands = coverCandidates(p, ds), pick = COVER.sel[p.id] || "";
    const opts = '<option value="">Choose who covers…</option>' + cands.map(c => `<option value="${e(c.t.id)}" ${pick === c.t.id ? "selected" : ""}>${e(c.t.name)} — ${e(c.fit[1])}${c.prof ? "" : " · no profile"}</option>`).join("");
    const best = cands.filter(c => c.fit[0] === 0).slice(0, 3);
    return `<div class="cov-row"><div class="cov-mid"><b>${e(studentName(p.studentId))}</b><small>${e(p.course || "—")} · ${e(when)}</small>
        ${best.length ? `<div class="cov-sugg">${best.map(c => `<button type="button" class="${pick === c.t.id ? "on" : ""}" data-ta="covpick" data-id="${e(p.id)}" data-v="${e(c.t.id)}">${e(c.t.name.split(" ")[0])}</button>`).join("")}<span>free then</span></div>` : '<div class="cov-sugg"><span>No one is marked free then — check below.</span></div>'}</div>
      <div class="cov-form"><select class="cov-sub" data-plan="${e(p.id)}">${opts}</select>
        <input class="cov-note" data-plan="${e(p.id)}" placeholder="Note for them (lesson, page…)" value="${e(COVER.note[p.id] || "")}" maxlength="300" />
        <button class="btn-solid sm" data-ta="covsave" data-id="${e(p.id)}" ${COVER.busy === p.id ? "disabled" : ""}>${COVER.busy === p.id ? "Saving…" : "Save cover"}</button></div></div>`;
  }).join("");
  const coming = TA.subs.filter(x => x.status === "planned" && x.date >= today()).slice(0, 30);
  box.innerHTML = `
    <div class="cov-top">
      <div class="field"><label>Teacher on leave</label><select id="covTeacher"><option value="">Choose the teacher…</option>${teachers.map(t => `<option value="${e(t.id)}" ${COVER.tid === t.id ? "selected" : ""}>${e(t.name)}</option>`).join("")}</select></div>
      <div class="field"><label>Day</label><input type="date" id="covDate" value="${e(ds)}" /></div>
    </div>
    <div class="cov-days">${dates.map(d => `<button class="${d === ds ? "on" : ""}" data-ta="covday" data-v="${d}">${e(d === today() ? "Today" : fmtD(d))}</button>`).join("")}</div>
    ${hol ? `<div class="ta-note warn">${e(fmtD(ds))} is a holiday in Academic Service (${e(hol.name || "holiday")}).</div>` : ""}
    ${!COVER.tid ? '<div class="ta-empty">Choose the teacher who is away.</div>'
      : list.length ? `<div class="cov-list">${rows}</div>` : `<div class="ta-empty">${e((teacher(COVER.tid) || {}).name || "This teacher")} has no class here on ${e(fmtD(ds))}.</div>`}
    <h4 class="ta-h4">Coming covers</h4>
    ${coming.length ? `<div class="cov-coming">${coming.map(x => `<div class="cov-c"><span><b>${e(fmtD(x.date))}</b> · ${e(x.time ? formatTime(x.time) : "")} · ${e(x.student)} (${e(x.course || "—")})</span>
        <span class="dim">${e(x.teacher)} → <b>${e(x.sub)}</b></span><button class="ta-link" data-ta="covcancel" data-id="${e(x.id)}">cancel</button></div>`).join("")}</div>`
      : '<div class="ta-empty">No covers planned.</div>'}
    <p class="ta-foot">Both teachers get a notice. After the class, mark it <b>Sub</b> in the attendance — the covering teacher is filled in for you.</p>`;
}
async function coverSave(planId){
  const subId = COVER.sel[planId]; if(!subId){ toast("Choose who covers", true); return; }
  COVER.busy = planId; paintCover();
  const out = await tSubAdmin({ action: "save", planId: planId, date: COVER.date, subId: subId, note: COVER.note[planId] || "", notify: true }).catch(() => null);
  COVER.busy = "";
  if(out && out.result === "success"){
    await loadSubs(); delete COVER.sel[planId]; delete COVER.note[planId]; paintCover(); attQuiet("subs");
    const t = teacher(subId) || {}, p = TA.plans.find(x => x.id === planId) || {};
    const wa = digits(t.whatsapp) ? (digits(t.whatsappCC) || "91") + digits(t.whatsapp).slice(-10) : (digits(t.phone).length >= 10 ? "91" + digits(t.phone).slice(-10) : "");
    const msg = "Assalamu alaikum " + (t.name || "").split(" ")[0] + ",\nplease cover a class on " + fmtD(COVER.date) + (p.time ? " at " + formatTime(p.time) + " (IST)" : "") +
      " — " + studentName(p.studentId).split(" ")[0] + " · " + (p.course || "") + ".\nIt is in your teacher page under Today. Join works on that day.\n\n— ManzilulQuran office";
    snack("Cover saved: " + (t.name || subId) + (out.subHasProfile ? " sees it on the teacher page." : " has no teacher profile — send it on WhatsApp."),
      wa ? [["WhatsApp " + (t.name || "").split(" ")[0], () => window.open("https://wa.me/" + wa + "?text=" + encodeURIComponent(msg), "_blank", "noopener")]] : []);
    if(TA.open && $("taModal") && $("taModal").classList.contains("show") && TA.tab === "covers") paintSheet();
  } else { paintCover(); toast((out && out.error) || "Could not save the cover", true); }
}
async function coverCancel(id){
  if(!confirm("Cancel this cover? Both teachers get a notice.")) return;
  const out = await tSubAdmin({ action: "cancel", id: Number(id), notify: true }).catch(() => null);
  if(out && out.result === "success"){ await loadSubs(); paintCover(); attQuiet("subs"); toast("Cover cancelled"); if(TA.open && TA.tab === "covers") paintSheet(); }
  else toast((out && out.error) || "Could not cancel", true);
}
function coverMarkLine(x){
  if(x.marked && x.marked.status === "Substitute" && x.marked.takenBy === x.subId) return '<span class="ta-chip ok">Marked Sub ✓</span>';
  if(x.marked && x.marked.status) return `<span class="ta-chip warn">Marked ${e(x.marked.status)}</span>`;
  return x.date < today() ? '<span class="ta-chip warn">Not marked yet</span>' : '<span class="ta-chip">Planned</span>';
}
function tabCovers(t){
  if(TA.subsMissing) return '<div class="ta-note warn">Covers need <code>clsdemo-cover-backup-v1.sql</code> in Supabase.</div>';
  if(!TA.subsLoaded) return '<div class="loading"><div class="loading-spin"></div></div>';
  const mine = TA.subs.filter(x => x.teacherId === t.id && x.status === "planned"), did = TA.subs.filter(x => x.subId === t.id && x.status === "planned");
  const row = (x, other) => `<div class="cov-c"><span><b>${e(fmtD(x.date))}</b> · ${e(x.time ? formatTime(x.time) : "")} · ${e(x.student)} (${e(x.course || "—")})</span>
      <span class="dim">${other}</span>${coverMarkLine(x)}${x.date >= today() ? `<button class="ta-link" data-ta="covcancel" data-id="${e(x.id)}">cancel</button>` : ""}</div>`;
  return `<div class="cov-bar"><button class="btn-solid sm" data-ta="coverteacher" data-id="${e(t.id)}">Arrange cover for ${e(t.name.split(" ")[0])}</button></div>
    <h4 class="ta-h4">${e(t.name.split(" ")[0])}'s classes covered by others</h4>
    ${mine.length ? `<div class="cov-coming">${mine.map(x => row(x, "covered by <b>" + e(x.sub) + "</b>")).join("")}</div>` : '<div class="ta-empty">None in the last 30 days or coming.</div>'}
    <h4 class="ta-h4">Classes ${e(t.name.split(" ")[0])} covers</h4>
    ${did.length ? `<div class="cov-coming">${did.map(x => row(x, "for <b>" + e(x.teacher) + "</b>")).join("")}</div>` : '<div class="ta-empty">None in the last 30 days or coming.</div>'}`;
}
document.addEventListener("change", function(ev){
  const el = ev.target;
  if(el.id === "covTeacher"){ COVER.tid = el.value; COVER.sel = {}; paintCover(); }
  else if(el.id === "covDate" && el.value){ COVER.date = el.value; COVER.sel = {}; paintCover(); }
  else if(el.classList && el.classList.contains("cov-sub")){ COVER.sel[el.dataset.plan] = el.value; paintCover(); }
  else if(el.dataset && el.dataset.bk){ BK.pick[el.dataset.bk] = el.checked; paintBk(); }
});
document.addEventListener("input", function(ev){
  const el = ev.target;
  if(el.classList && el.classList.contains("cov-note")) COVER.note[el.dataset.plan] = el.value;
  if(el.id === "bkWord"){ const b = $("bkApply"); if(b) b.disabled = el.value.trim().toUpperCase() !== "RESTORE"; }
});
document.addEventListener("click", async function(ev){
  const el = ev.target.closest("[data-ta]"); if(!el) return;
  const a = el.dataset.ta, id = el.dataset.id, v = el.dataset.v;
  if(a === "coverbar") openCover("", today());
  else if(a === "coverteacher") openCover(id, today());
  else if(a === "coverleave") openCover(TA.open, v, v, el.dataset.to);
  else if(a === "covclose") closeModal("taCoverModal");
  else if(a === "covday"){ COVER.date = v; COVER.sel = {}; paintCover(); }
  else if(a === "covpick"){ COVER.sel[id] = v; paintCover(); }
  else if(a === "covsave") coverSave(id);
  else if(a === "covcancel") coverCancel(id);
  else if(a === "bkopen"){ if($("taSetModal") && $("taSetModal").classList.contains("show")) closeModal("taSetModal"); openBackup(); }
  else if(a === "bkclose" && !BK.busy) closeModal("taBkModal");
  else if(a === "bknext"){ BK.step = Math.min(3, BK.step + 1); paintBk(); }
  else if(a === "bkback"){ BK.step = Math.max(1, BK.step - 1); paintBk(); }
  else if(a === "bkapply"){ const w = $("bkWord"); if(w && w.value.trim().toUpperCase() === "RESTORE") bkApply(); }
  else if(a === "bkforget"){
    const [kind, rid] = String(v).split("|");
    if(!confirm("Stop keeping this record? Do this only when it was deleted in Academic Service on purpose.")) return;
    const out = await asRestore({ action: "forget", kind: kind, id: rid }).catch(() => null);
    if(out && out.result === "success"){ BK.items = BK.items.filter(x => !(x.kind === kind && x.id === rid)); delete BK.pick[v]; paintBk(); backupSync(false); }
    else toast((out && out.error) || "Could not forget it", true);
  }
  else if(a === "bksync"){ el.disabled = true; el.textContent = "Copying…"; await backupSync(true); el.disabled = false; el.textContent = "Copy now"; toast("Copied from Academic Service"); }
  else if(a === "bkdown") downloadBackup();
});
/* "Cover a class" beside "Who's free?" in the Teachers bar (shown with it) */
(function(){
  const fb = $("tFreeBtn"); if(!fb || $("tCoverBtn")) return;
  const b = document.createElement("button");
  b.id = "tCoverBtn"; b.type = "button"; b.className = fb.className; b.dataset.ta = "coverbar"; b.hidden = fb.hidden;
  b.setAttribute("aria-label", "Cover a class");
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg><span class="lbl">Cover a class</span>';
  fb.parentNode.insertBefore(b, fb.nextSibling);
  new MutationObserver(() => { b.hidden = fb.hidden; }).observe(fb, { attributes: true, attributeFilter: ["hidden"] });
})();

const freeBtn = $("tFreeBtn"); if(freeBtn) freeBtn.addEventListener("click", openFree);
const setBtn = $("settingsBtn"); if(setBtn) setBtn.addEventListener("click", openSettings);

/* The attendance button lives only while the admin is signed in. */
function syncFab(){
  const on = $("adminView") && $("adminView").classList.contains("show");
  if(on && !TA.loaded && !TA.loading) setTimeout(() => taLoad().then(() => {
    if(!TA.loaded) return;
    $("wsCountTeachers").textContent = wingTeachers().filter(t => (t.status || "Active") === "Active").length;
    if(currentWs() === "teachers") paintWorkspace();
    clsAfterLoad();
  }), 300);
  if(on){
    buildFab(); $("attFab").hidden = false; if($("attTopBtn")) $("attTopBtn").hidden = false;
    tAdminSettings().then(out => { if(out && out.result === "success") setAttLink((out.settings || {}).attendanceLink || "", true); }).catch(() => {});
    siLoad();
  }
  else { const f = $("attFab"); if(f){ closeAtt(); f.hidden = true; } if($("attTopBtn")) $("attTopBtn").hidden = true; TA.loaded = false; }
}
new MutationObserver(syncFab).observe($("adminView"), { attributes: true, attributeFilter: ["class"] });
syncFab();
if(typeof currentWs === "function" && currentWs() === "teachers") window.taOpenWorkspace();
/* v8: what newclass.v1.js needs from this file */
window.TA_API = { TA: TA, taLoad: taLoad, sheetsOf: sheetsOf, sameCourse: sameCourse, studentPhone: studentPhone,
  reloadAs: reloadAs, clsAfterLoad: clsAfterLoad, paintWorkspace: paintWorkspace, attQuiet: attQuiet, siLoad: siLoad,
  planOfSheet: planOfSheet, planRunning: planRunning, planDays: planDays, dayName: dayName, snack: snack, closeAtt: closeAtt,
  plansOfSheet: plansOfSheet, teacher: teacher, paintAsPanel: paintAsPanel, today: today };
})();

/* =================================================================
   v6 — sheets whose class ended turn off (once; switching on again sticks)
   ================================================================= */
let AUTOEND_DONE = false;
async function autoEnd(){
  if(AUTOEND_DONE || typeof sheetAutoEnd !== "function") return;
  AUTOEND_DONE = true;
  const out = await sheetAutoEnd().catch(() => null);
  if(out && out.result === "success" && out.ended > 0){
    try{ await loadClasses(); }catch(x){}
    snack((out.ended === 1 ? "1 class sheet was" : out.ended + " class sheets were") + " turned off — the class ended: " + (out.names || []).slice(0, 4).join(", ") + (out.ended > 4 ? "…" : "") + ". Switch on again if needed.");
  }
}
