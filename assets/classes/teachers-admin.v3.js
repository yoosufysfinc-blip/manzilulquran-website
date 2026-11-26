/* =================================================================
   ░░  ManzilulQuran — TEACHERS WORKSPACE (admin)  v3  ░░
   -----------------------------------------------------------------
   Loaded by the Classes admin AFTER its main script (demo first).
   Needs api.v6.js, engine.v1.js and catalog.v2.js, and the page's own
   helpers: $, escapeHtml, toast, openModal, closeModal, shareUrl,
   classes, mqUrl, currentWs.

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

   PUBLISHED FILES ARE IMMUTABLE. Create teachers-admin.v4.js to change this.
   ================================================================= */
(function(){
"use strict";

const TA = {
  loaded: false, loading: null, error: "",
  teachers: [], plans: [], students: {}, holidays: [],
  profiles: {}, avail: {}, leaves: [], unseen: {}, settings: {}, noSql: false,
  att: {},                       // month → { planId → { date → record } }
  month: "", open: null, tab: "students", student: null, notes: {}, q: ""
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
function teacherPlans(tid){ return TA.plans.filter(p => p.teacherId === tid && (p.status || "Active") === "Active"); }
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
      const [ts, ps, ss, hs, prof] = await Promise.all([
        fetchAcTeachers(), fetchAcPlans(), fetchAcStudents(),
        fetchAcHolidays().catch(() => []), tAdminList().catch(() => ({ result:"error", missing:true }))
      ]);
      TA.teachers = ts.filter(t => (t.kind || "teacher") !== "staff")
        .sort((a, b) => ((a.status || "Active") !== "Active") - ((b.status || "Active") !== "Active") || String(a.name).localeCompare(String(b.name)));
      TA.plans = ps;
      TA.students = {}; ss.forEach(s => { TA.students[s.id] = s; });
      TA.holidays = hs;
      applyList(prof);
      TA.att = {};
      TA.loaded = true;
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
    const rows = await fetchAcClasses(m + "-01", m + "-" + pad(monthDays(m)));
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
  const active = TA.teachers.filter(t => (t.status || "Active") === "Active");
  const withProfile = active.filter(t => TA.profiles[t.id]).length;
  const studs = new Set(TA.plans.filter(p => p.teacherId && (p.status || "Active") === "Active").map(p => p.studentId)).size;
  const waiting = TA.leaves.filter(l => (l.leave || {}).status === "pending");
  $("wsCountTeachers").textContent = active.length;
  const q = TA.q.toLowerCase();
  const list = TA.teachers.filter(t => !q || (t.name + " " + t.id).toLowerCase().indexOf(q) >= 0);

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
  <p class="ta-foot" style="--i:6">Teachers come from Academic Service. Add or edit a teacher there; make their profile here.</p>`;
  if(root._html === html) return;            // nothing changed: leave the DOM (and any motion) alone
  root._html = html; root.innerHTML = html;
}
function listHtml(){
  const q = TA.q.toLowerCase();
  const list = TA.teachers.filter(t => !q || (t.name + " " + t.id).toLowerCase().indexOf(q) >= 0);
  return list.map(cardHtml).join("") || '<div class="empty-state">No teachers match.</div>';
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
  const tabs = [["students","Students"],["att","Attendance"],["notices","Notices" + ((un || lv) ? ` <i class="ta-dot">${un + lv}</i>` : "")],["avail","Free time"],["access","Access"]];
  const chip = off ? '<span class="ta-chip off">Inactive in AS</span>' : !pr ? '<span class="ta-chip">No profile</span>'
             : pr.active ? '<span class="ta-chip ok">Profile on</span>' : '<span class="ta-chip off">Profile off</span>';
  let body;
  if(TA.student) body = studentView(TA.student);
  else body = { students: tabStudents, att: tabAtt, notices: tabNotices, avail: tabAvail, access: tabAccess }[TA.tab](t);
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
        ${sh ? "" : '<small class="ta-warn">No class sheet with this MQ ID</small>'}</span>
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
        ${st === "pending" ? `<div class="nact"><button class="btn-solid sm" data-ta="leave" data-id="${n.id}" data-v="approved">Approve</button><button class="btn-outline sm" data-ta="leave" data-id="${n.id}" data-v="declined">Decline</button>${wa ? `<a class="btn-outline sm" target="_blank" rel="noopener" href="https://wa.me/${e(wa)}">WhatsApp</a>` : ""}</div>` : ""}`;
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
  const res = TA.teachers.filter(t => (t.status || "Active") === "Active").map(t => {
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
  const res = TA.teachers.filter(t => (t.status || "Active") === "Active").map(t => {
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
function attLink(){ try{ return localStorage.getItem(ATT_KEY) || ""; }catch(x){ return ""; } }
function setAttLink(v, fromServer){
  try{ if(v) localStorage.setItem(ATT_KEY, v); else localStorage.removeItem(ATT_KEY); }catch(x){}
  const f = $("attFab"); if(f) f.classList.toggle("unset", !v);
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
      <div id="taSetMsg" class="ta-p"></div>
    </div>
    <div class="modal-foot"><button class="btn-ghost" data-ta="setclose">Cancel</button><button class="btn-solid" data-ta="setsave">Save</button></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", ev => { if(ev.target === d) closeModal("taSetModal"); });
}
async function openSettings(){
  ensureSettings();
  $("taAttIn").value = attLink();
  $("taSetMsg").textContent = "";
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

function buildFab(){
  if($("attFab")) return;
  const b = document.createElement("button");
  b.id = "attFab"; b.type = "button"; b.className = "att-fab" + (attLink() ? "" : " unset");
  b.setAttribute("aria-label", "Attendance");
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="3"/><path d="M8 2v4M16 2v4M8 12l2.5 2.5L16 9"/></svg><span>Attendance</span>';
  document.body.appendChild(b);
  const o = document.createElement("div");
  o.id = "attOverlay"; o.className = "att-overlay"; o.hidden = true;
  o.innerHTML = `<div class="att-bar"><b>Attendance</b><span class="att-sub">Academic Service · marks save straight to the records</span>
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
    fr.id = "attFrame"; fr.title = "Attendance"; fr.src = v; fr.dataset.src = v;
    fr.setAttribute("allow", "clipboard-write");
    $("attFrameBox").appendChild(fr);
  }
  $("attNewTab").href = v;
  o.hidden = false;
  requestAnimationFrame(() => o.classList.add("open"));
  $("attFab").classList.add("on");
  document.body.classList.add("att-open");
}
function closeAtt(){
  const o = $("attOverlay"); if(!o || o.hidden) return;
  o.classList.remove("open");
  $("attFab").classList.remove("on");
  document.body.classList.remove("att-open");
  setTimeout(() => { if(!o.classList.contains("open")) o.hidden = true; }, 260);   // the frame stays loaded
}

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
  else if(a === "attclose") closeAtt();
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
  if(ev.target.id === "taQ"){ TA.q = ev.target.value; const box = document.querySelector("#wsTeachers .ta-list"); if(box) box.innerHTML = listHtml(); }
});
document.addEventListener("keydown", function(ev){
  if(ev.key === "Escape" && $("attOverlay") && !$("attOverlay").hidden && !document.querySelector(".modal-backdrop.show")) closeAtt();
});

const freeBtn = $("tFreeBtn"); if(freeBtn) freeBtn.addEventListener("click", openFree);
const setBtn = $("settingsBtn"); if(setBtn) setBtn.addEventListener("click", openSettings);

/* The attendance button lives only while the admin is signed in. */
function syncFab(){
  const on = $("adminView") && $("adminView").classList.contains("show");
  if(on && !TA.loaded && !TA.loading) setTimeout(() => taLoad().then(() => {
    if(!TA.loaded) return;
    $("wsCountTeachers").textContent = TA.teachers.filter(t => (t.status || "Active") === "Active").length;
    if(currentWs() === "teachers") paintWorkspace();
  }), 300);
  if(on){ buildFab(); $("attFab").hidden = false; tAdminSettings().then(out => { if(out && out.result === "success") setAttLink((out.settings || {}).attendanceLink || "", true); }).catch(() => {}); }
  else { const f = $("attFab"); if(f){ closeAtt(); f.hidden = true; } TA.loaded = false; }
}
new MutationObserver(syncFab).observe($("adminView"), { attributes: true, attributeFilter: ["class"] });
syncFab();
if(typeof currentWs === "function" && currentWs() === "teachers") window.taOpenWorkspace();
})();
