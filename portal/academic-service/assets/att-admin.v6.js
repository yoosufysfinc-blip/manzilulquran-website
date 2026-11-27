"use strict";
/* Academic Service — att-admin.v6.js. The class-admin link (/portal/attendance/#k=TOKEN).
   v6 = v5 + · a student who left this month is easy to spot in the sheet (red "Left · date" tag, the days after it struck)
             · after a mark the next cell is the NEXT STUDENT on the same day (not the same student's next day)
             · a new month is SET UP with a check first: month menu → "Set up <month>…" → the classes that ended, stop,
               pause, start, or miss days/time — each with Edit — then "Set up"
             · Class days tab: one row per student (tap to open), with the full class edit inside — no big table
   v5 = v4 + (needs plan-pause.v1.js loaded before it):
     · STUDENT PROFILE: tapping a student opens their profile — this month, class, student details, class status —
       with Edit (comes back to the profile after saving), Pause / Restart, Stop / Undo stop
     · PAUSE: "no class from" + "classes restart on" (or until restarted); paused days are not class days
       (greyed, never "unmarked"); the office sees it in Review and decides about fees
     · NEW STUDENT joining mid-month: one window for the student and the class, from the joining day
     · CLASS MINUTES for a day: a drag scale that clicks onto every 5 minutes (P and Sub marks)
     · tapping the same mark again clears it; an Undo bar after every change
   v4 = v3 + COVER CLASSES from the class sheet (clsdemo_att_subs / cls_att_subs, same link check as the wing):
     · a day the class sheet planned a cover for has a small corner (in the Sub colour) on the sheet, a "Cover: name" line on Today,
       and a "Cover · name" flag on the slim line
     · Sub (S) on such a day marks it Substitute with that teacher straight away — no window to fill;
       the Note window opens with Sub and the planned teacher chosen
     · the covering teacher is in the teacher lists of this sheet even when they have no class in it
   PUBLISHED FILES ARE IMMUTABLE. Create att-admin.v7.js to change this.
   v3 (loaded only by portal/attendance/, the shared Academy Manager files are untouched):
     · ONE marking bar: a tapped day no longer opens a second card of marks — the marks already on the screen
       (the bar at the bottom on a phone, the row at the top on a computer) mark the chosen day and step to the
       next class day; a slim line shows who, which day and what is marked, with Note / WhatsApp / Student
     · Today: small mark buttons (they were stretched across the whole row); bigger on touch screens
     · date of birth on the student form (the class sheet's student sign-in uses phone + date of birth)
     · class-sheet wing: opened from a class sheet (…/portal/attendance/?cs=demo#k=…), the sheet shows only
       the students that have a class sheet there, their teachers, and the students / teachers / classes added
       through this link (the class sheet's clsdemo_att_scope / cls_att_scope confirms the link)
     · tells the class sheet when a student or class is added (window.postMessage, same site only), and
       opens + Student / + Class when the class sheet asks
   (v2:)
   v2: a link that stops working (switched off, replaced with a new secret link, or deleted) clears this phone's copy AND stops
       change tracking first, so nothing on the phone can be pushed back as deleted; + Add (student / class / teacher) items for
       the v4 sheet; the blocked screen in the Class Sheets look.
   Loaded only by portal/attendance/index.html, after core.v7 (window.MQ_ADMIN = true), logic, ui, forms-actions and ws-attendance.v4.
   · the link's token must match an active entry in Settings().attAdminLinks (made in Academic Service → Attendance → Admin links)
   · admins mark attendance, add students / teachers / classes, and change class details — never fees, pay rules or settings
   · everything an admin adds or changes is flagged reviewed:false with a history entry, for the office review list
   · new students, teachers and plans take their number from the database (Supa.claimNew in core.v7) */

/* ---- v3: the class sheet this page is opened for (wing), and talking to it ---- */
const ADM_SCOPE = { on: false, students: {}, extra: [] };
const ADM_SUBS = { by: {}, ids: {}, from: "", to: "" };   /* v4: planned covers, key planId|date → { subId, sub } */
function admScopePrefix(){
  const cs = new URLSearchParams(location.search).get("cs") || "";
  return cs === "demo" ? "clsdemo_" : cs === "live" ? "cls_" : "";
}
function admLinkName(){ return (window.ATT_ACTOR && window.ATT_ACTOR.name) || ""; }
function admByLink(r){ return !!r && r.addedVia === "admin-link" && !!admLinkName() && r.addedBy === admLinkName(); }
function admPlanIn(p){ return !!p && (!!ADM_SCOPE.students[p.studentId] || admByLink(p)); }
const _admGetPlans = DataService.getPlans.bind(DataService), _admGetTeachers = DataService.getTeachers.bind(DataService);
DataService.getPlans = function(f){ const r = _admGetPlans(f); return ADM_SCOPE.on ? r.filter(admPlanIn) : r; };
DataService.getTeachers = function(){
  const r = _admGetTeachers(); if (!ADM_SCOPE.on) return r;
  const mine = {}; _admGetPlans().forEach(p => { if (admPlanIn(p)) mine[p.teacherId] = 1; });
  ADM_SCOPE.extra.forEach(id => mine[id] = 1);
  Object.keys(ADM_SUBS.ids).forEach(id => mine[id] = 1);
  return r.filter(t => mine[t.id] || admByLink(t));
};
const _admPickStudents = pickStudents;
pickStudents = function(){
  const r = _admPickStudents(); if (!ADM_SCOPE.on) return r;
  const mine = Object.assign({}, ADM_SCOPE.students); _admGetPlans().forEach(p => { if (admPlanIn(p)) mine[p.studentId] = 1; });
  return r.filter(st => mine[st.id] || admByLink(st));
};
function admExtraKey(){ return "mq_att_wing_extra_" + admScopePrefix() + (admLinkName() || "").replace(/\W+/g, "_"); }
function admLoadExtra(){ try { ADM_SCOPE.extra = JSON.parse(localStorage.getItem(admExtraKey()) || "[]") || []; } catch (e) { ADM_SCOPE.extra = []; } }
function admAddExtra(id){ if (ADM_SCOPE.extra.indexOf(id) < 0) ADM_SCOPE.extra.push(id); try { localStorage.setItem(admExtraKey(), JSON.stringify(ADM_SCOPE.extra)); } catch (e) {} }
/* asks the class sheet which students have a sheet there; only a link saved in that class sheet's Settings is answered */
async function admLoadScope(){
  const px = admScopePrefix(), s = Settings();
  if (!px || !ADM.token || !s.supabaseUrl || !s.supabaseKey) return;
  try {
    const h = { "apikey": s.supabaseKey, "Content-Type": "application/json" };
    if (/^eyJ/.test(s.supabaseKey)) h.Authorization = "Bearer " + s.supabaseKey;
    const res = await fetch(String(s.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/rpc/" + px + "att_scope", { method: "POST", headers: h, body: JSON.stringify({ p_k: ADM.token }) });
    if (!res.ok) return;
    const out = await res.json();
    if (!out || out.result !== "success") return;
    const next = {}; (out.students || []).forEach(id => next[id] = 1);
    const was = JSON.stringify(ADM_SCOPE.students) + ADM_SCOPE.on;
    ADM_SCOPE.on = true; ADM_SCOPE.students = next; admLoadExtra();
    if (was !== JSON.stringify(next) + true) { Cache.clear(); State.iatt.teacher = ""; render(); }
    admLoadSubs(true);
  } catch (e) {}
}
/* v4: the covers the class sheet planned (planned only), for the month on screen and the ones beside it */
function admMonthShift(m, n){ let y = +m.slice(0, 4), mo = +m.slice(5, 7) + n; while (mo < 1) { mo += 12; y--; } while (mo > 12) { mo -= 12; y++; } return y + "-" + String(mo).padStart(2, "0"); }
async function admLoadSubs(force){
  const px = admScopePrefix(), s = Settings();
  if (!px || !ADM.token || !s.supabaseUrl || !s.supabaseKey) return;
  const m = State.month || currentMonth(), from = admMonthShift(m, -1) + "-01", to = admMonthShift(m, 2) + "-01";
  if (!force && ADM_SUBS.from === from && ADM_SUBS.to === to) return;
  try {
    const h = { "apikey": s.supabaseKey, "Content-Type": "application/json" };
    if (/^eyJ/.test(s.supabaseKey)) h.Authorization = "Bearer " + s.supabaseKey;
    const res = await fetch(String(s.supabaseUrl).replace(/\/+$/, "") + "/rest/v1/rpc/" + px + "att_subs", { method: "POST", headers: h, body: JSON.stringify({ p_k: ADM.token, p_from: from, p_to: to }) });
    if (!res.ok) return;                                   /* the cover SQL is not run yet: nothing changes */
    const out = await res.json();
    if (!out || out.result !== "success") return;
    const by = {}, ids = {};
    (out.subs || []).forEach(x => { if (x && x.planId && x.date && x.subId) { by[x.planId + "|" + String(x.date).slice(0, 10)] = { subId: x.subId, sub: x.sub || x.subId }; ids[x.subId] = 1; } });
    const was = JSON.stringify(ADM_SUBS.by);
    ADM_SUBS.by = by; ADM_SUBS.ids = ids; ADM_SUBS.from = from; ADM_SUBS.to = to;
    if (was !== JSON.stringify(by)) { Cache.clear(); render(); }
  } catch (e) {}
}
function admSubFor(planId, ds){
  const x = ADM_SUBS.by[planId + "|" + ds]; if (!x) return null;
  const pl = DataService.getPlan(planId);
  return pl && pl.teacherId === x.subId ? null : x;        /* the plan's own teacher is never their own cover */
}
/* the class sheet (parent window) hears about new students and classes, and can open + Student / + Class */
function admTell(ev, data){
  try { if (window.parent && window.parent !== window) window.parent.postMessage(Object.assign({ type: "mq-att", ev: ev }, data || {}), location.origin); } catch (e) {}
}
window.addEventListener("message", function(e){
  if (e.origin !== location.origin || !e.data || e.data.type !== "mq-att-cmd" || !ADM.ok) return;
  if (e.data.cmd === "add-student") Actions["adm-student"]();
  else if (e.data.cmd === "add-class") Actions["adm-plan"](e.data.studentId || "");
  else if (e.data.cmd === "refresh") { admLoadScope(); attPull(true); }
  else if (e.data.cmd === "subs") admLoadSubs(true);
});

/* ---- this page shows one thing: the attendance sheet ---- */
WS.ind.nav = [["Attendance", [["iAtt", "▦", "Attendance", "Attendance"]]]];
WS.ind.home = "iAtt";
WS.ind.label = "Class admin";
PAGE_SUB.iAtt = "Mark each class. Marks save straight to the academy records.";

const ADM = { token: "", ok: false };
function admToken(){
  const h = String(location.hash || "").replace(/^#/, ""), q = new URLSearchParams(location.search);
  const m = /(?:^|&)k=([^&]+)/.exec(h);
  return (m ? decodeURIComponent(m[1]) : (q.get("k") || "")).trim();
}
/* checks the link against the office's list; called on open and after every refresh */
function attAdminCheck(){
  const links = Settings().attAdminLinks || [];
  const l = links.find(x => x && x.token === ADM.token);
  if (!ADM.token || !l || !l.active) {
    admBlock(!ADM.token ? "This page opens only from your attendance link." :
      (l ? "This link is switched off. Ask the office to switch it on, then open your link again." : "This link no longer works. Ask the office for your new attendance link."));
    ADM.ok = false;
    if (ADM.token) admWipe();
    return false;
  }
  window.ATT_ACTOR = { name: l.name, via: "admin-link" };
  ADM.ok = true;
  const who = $("#admWho"); if (who) who.textContent = l.name;
  const b = $("#admBlock"); if (b) b.remove();
  return true;
}
function admBlock(msg){
  let b = $("#admBlock");
  if (!b) { b = document.createElement("div"); b.id = "admBlock"; b.className = "adm-block"; document.body.appendChild(b); }
  b.innerHTML = '<div class="box" role="alert"><div class="lg" aria-hidden="true"></div><h2>Class <em>Attendance</em></h2><p>' + esc(msg) + '</p></div>';
}
/* the link stopped working: stop tracking changes FIRST (an emptied list must never be sent as "deleted"), then forget the copy */
function admWipe(){
  if (typeof SupaTrack !== "undefined") { clearTimeout(SupaTrack.timer); SupaTrack.base = null; }
  if (typeof Supa !== "undefined" && Supa.claimQueue) Supa.claimQueue.length = 0;
  if (typeof attUnmount === "function") attUnmount();
  DB.students = []; DB.teachers = []; DB.plans = []; DB.classes = [];
  Cache.clear(); Storage.save(DB);
}

/* ---- matching: spot a student or teacher who is already in the records ---- */
function admDigits(v){ return String(v || "").replace(/\D/g, ""); }
function admSamePhone(a, b){
  a = admDigits(a); b = admDigits(b);
  if (a.length < 9 || b.length < 9) return false;
  const n = Math.min(10, a.length, b.length);
  return a.slice(-n) === b.slice(-n);
}
/* spelling clean-up so Mohammed / Muhammad, Fathima / Fatimah, Shareef / Sharif read as one name */
function admNameKey(s){
  let t = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ");
  t = t.replace(/\b(muhammed|mohammed|mohamed|muhammad|mohammad|muhamad|mohamad|mohd|md)\b/g, "muhammad")
       .replace(/\b(fathima|fatima|fathimah|fatimah|fathema)\b/g, "fatima")
       .replace(/\b(abdul|abdhul|abdool)\b/g, "abdul");
  t = t.replace(/th/g, "t").replace(/dh/g, "d").replace(/kh/g, "k").replace(/ph/g, "f").replace(/bh/g, "b")
       .replace(/ee/g, "i").replace(/oo/g, "u").replace(/(.)\1+/g, "$1").replace(/h\b/g, "");
  return t.split(/\s+/).filter(Boolean).sort().join(" ");
}
function admSimilar(a, b){
  a = admNameKey(a); b = admNameKey(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) { d[i] = [i]; }
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
/* returns [{ rec, score, why }] best first; score 100 phone · 80 same name · 70 parent + similar name · 50 similar name */
function admMatches(c, list, kind){
  const out = [];
  list.forEach(function(r){
    let score = 0, why = "";
    if (c.phone && (admSamePhone(c.phone, r.phone) || admSamePhone(c.phone, r.whatsapp))) { score = 100; why = "same phone number"; }
    else if (c.whatsapp && (admSamePhone(c.whatsapp, r.whatsapp) || admSamePhone(c.whatsapp, r.phone))) { score = 100; why = "same WhatsApp number"; }
    else if (c.name && admNameKey(c.name) === admNameKey(r.name)) { score = 80; why = "same name"; }
    else if (kind === "student" && c.guardian && r.guardian && admNameKey(c.guardian) === admNameKey(r.guardian) && admSimilar(c.name, r.name) >= 0.75) { score = 70; why = "same parent, similar name"; }
    else if (c.name && admSimilar(c.name, r.name) >= 0.85) { score = 50; why = "similar name"; }
    if (score) out.push({ rec: r, score: score, why: why });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 6);
}
function admTail(v){ const d = admDigits(v); return d ? "•••• " + d.slice(-4) : "no phone"; }
function admStudentLine(s){
  const plans = DataService.getPlans({ studentId: s.id }).filter(p => p.status === "Active").map(p => p.course).filter(Boolean);
  return esc(s.name) + ' <span class="idchip">' + esc(s.id) + '</span><br><small>' + esc((s.guardian ? s.guardian + " · " : "") + admTail(s.whatsapp || s.phone) +
    (plans.length ? " · " + plans.join(", ") : "") + (s.status && s.status !== "Active" ? " · " + s.status : "")) + '</small>';
}

/* ---- history: every admin change is kept on the record, for the office to see and undo ---- */
function admStamp(rec, what, changes){
  const a = window.ATT_ACTOR || { name: "Admin", via: "admin-link" }, at = new Date().toISOString();
  rec.history = (rec.history || []).concat([{ at: at, by: a.name, via: a.via, what: what, changes: changes || {} }]).slice(-30);
  rec.reviewed = false; rec.lastChangeBy = a.name; rec.lastChangeAt = at;
  return rec;
}
function admDiff(before, after, keys){
  const ch = {};
  keys.forEach(k => { const o = before[k], n = after[k];
    if (JSON.stringify(o === undefined ? "" : o) !== JSON.stringify(n === undefined ? "" : n)) ch[k] = [o === undefined ? "" : o, n === undefined ? "" : n]; });
  return ch;
}
async function admFresh(colls){ if (typeof Supa !== "undefined" && Supa.on()) { try { await Supa.refresh(colls); } catch (e) {} } }

/* ---- add a student: search first ---- */
function admFindHtml(q){
  q = String(q || "").trim();
  if (q.length < 2) return '<div class="muted small">Type at least two letters of the name, or the phone number.</div>';
  const c = /\d{5,}/.test(q) ? { phone: q, whatsapp: q } : { name: q };
  let hits = admMatches(c, DataService.getStudents(), "student");
  const low = q.toLowerCase();
  DataService.getStudents().forEach(s => {
    if (hits.some(h => h.rec.id === s.id)) return;
    if (String(s.name || "").toLowerCase().indexOf(low) >= 0 || String(s.id).toLowerCase() === low) hits.push({ rec: s, score: 40, why: "name contains it" });
  });
  hits = hits.slice(0, 8);
  if (!hits.length) return '<div class="note" style="margin:0">Not found in the academy records.</div>';
  return hits.map(h => '<div class="minirow"><span>' + admStudentLine(h.rec) + '</span>' +
    '<button type="button" class="btn btn-sm btn-primary" data-act="adm-use" data-id="' + esc(h.rec.id) + '">Use</button></div>').join("");
}
document.addEventListener("input", function(e){
  if (e.target && e.target.id === "admFind") { const box = $("#admFindRes"); if (box) box.innerHTML = admFindHtml(e.target.value); }
});
function admStudentForm(s){
  s = s || {};
  const w = splitWA(s.whatsapp, s.whatsappCC);
  return '<div class="form-grid">' +
    field("Student name", '<input class="input" name="name" required value="' + esc(s.name || "") + '">') +
    field("Parent / guardian", '<input class="input" name="guardian" value="' + esc(s.guardian || "") + '">') +
    field("WhatsApp number", '<div class="ccrow"><select class="input ccsel" name="whatsappCC">' + ccOptions(w.cc) + '</select>' +
      '<input class="input mono" name="whatsapp" value="' + esc(w.num) + '" placeholder="Number without country code" style="flex:1"></div>') +
    field("Phone number", '<input class="input mono" name="phone" value="' + esc(s.phone || "") + '">') +
    field("Date of birth", '<input class="input" type="date" name="dob" value="' + esc(s.dob || "") + '">') +
    field("Gender", sel("gender", optList(["Male", "Female"], s.gender || "", "Select"))) +
    (s.id ? "" : field("Joining date", '<input class="input" type="date" name="joiningDate" value="' + esc(s.joiningDate || today()) + '">')) +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(s.notes || "") + '"></div>' +
    '<div class="field span2" id="admDup"></div>' +
  '</div>';
}
function admDupBox(matches, kind){
  return '<div class="note" style="border-color:#e0776b;margin:0"><b>Already in the records?</b> ' +
    (kind === "student" ? "Use the existing student instead of adding them twice." : "Use the existing teacher instead of adding them twice.") +
    matches.map(m => '<div class="minirow"><span>' + (kind === "student" ? admStudentLine(m.rec) : esc(m.rec.name) + ' <span class="idchip">' + esc(m.rec.id) + '</span><br><small>' + esc(admTail(m.rec.whatsapp || m.rec.phone)) + '</small>') +
      '<br><small class="out">' + esc(m.why) + '</small></span>' +
      (kind === "student" ? '<button type="button" class="btn btn-sm btn-primary" data-act="adm-use" data-id="' + esc(m.rec.id) + '">Use this student</button>'
        : '<button type="button" class="btn btn-sm btn-primary" data-act="adm-use-teacher" data-id="' + esc(m.rec.id) + '">Use this teacher</button>') + '</div>').join("") +
    '<label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-size:13px"><input type="checkbox" name="confirmNew"> No — this is a different ' + kind + '</label></div>';
}

/* ---- add a class (plan) for a student: operational details only; the office sets fee and pay ---- */
function admPlanForm(p, studentId){
  p = p || {};
  return '<div class="form-grid">' +
    pickBox("Student", "studentId", p.studentId || studentId || "", pickStudents(), "Type a student name or ID") +
    pickBox("Teacher", "teacherId", p.teacherId || "", pickTeachers(), "Type a teacher name or ID") +
    field("Course", sel("course", courseOpts(p.course || "", "Select course"))) +
    field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(p.startDate || today()) + '">') +
    '<div class="field span2"><label>Class days</label><div>' + dayBoxes(p.days) + '</div></div>' +
    field("Class time (IST)", '<input class="input" type="time" name="time" value="' + esc(p.time || "") + '">') +
    field("Class minutes", '<input class="input" type="number" min="0" name="duration" value="' + esc(p.duration || 45) + '">') +
    '<div class="field span2"><div class="note" style="margin:0">The office sets the fee and the teacher\'s pay for this class. Attendance can be marked from today.</div></div>' +
  '</div>';
}

Object.assign(Actions, {
  "adm-student": () => openModal({ title: "Add a student", wide: true, hideSubmit: true, cancelText: "Close", noFocus: false,
    body: '<div class="field"><label>Search first — name or phone</label><input class="input" id="admFind" autocomplete="off" placeholder="e.g. Aisha or 9847…"></div>' +
      '<div id="admFindRes" style="margin:8px 0 12px">' + admFindHtml("") + '</div>' +
      '<button type="button" class="btn" data-act="adm-student-new">Not in the list — add a new student</button>' }),
  "adm-use": (studentId) => { closeModal(); setTimeout(() => Actions["adm-plan"](studentId), 30); },
  "adm-use-teacher": (teacherId) => {
    const t = DataService.getTeacher(teacherId); if (!t) return;
    admAddExtra(teacherId); closeModal(); toast(t.name + " can now be picked for a class here", "ok"); render();
  },
  "adm-student-new": () => {
    const q = ($("#admFind") || {}).value || "";
    openModal({ title: "New student", wide: true, submitText: "Save student", body: admStudentForm(/\d{5,}/.test(q) ? { whatsapp: q } : { name: q }),
      onSubmit: function(d, form){
        const name = String(d.name || "").trim();
        if (!name) { toast("Type the student's name", "bad"); return false; }
        joinCC(d);
        const matches = admMatches({ name: name, guardian: d.guardian, phone: d.phone, whatsapp: d.whatsapp }, DataService.getStudents(), "student").filter(m => m.score >= 50);
        if (matches.length && !d.confirmNew) {
          const box = form.querySelector("#admDup"); if (box) box.innerHTML = admDupBox(matches, "student");
          toast("Check the possible matches first", "warn"); return false;
        }
        const rec = { name: name, guardian: String(d.guardian || "").trim(), whatsapp: d.whatsapp || "", whatsappCC: d.whatsappCC || "",
          phone: String(d.phone || "").trim(), dob: d.dob || "", gender: d.gender || "", joiningDate: d.joiningDate || today(), notes: String(d.notes || "").trim(),
          status: "Active", addedBy: (window.ATT_ACTOR || {}).name || "Admin", addedVia: "admin-link", addedAt: new Date().toISOString() };
        admStamp(rec, "added student", {});
        const id = DataService.saveStudent(rec);
        toast(name + " added (" + id + ")", "ok");
        admTell("student-added", { studentId: id });
        setTimeout(() => Actions["adm-plan"](id), 60);
      } });
  },
  "adm-plan": (studentId) => openModal({ title: "Add a class", wide: true, submitText: "Save class", body: admPlanForm({}, studentId || ""),
    onSubmit: function(d, form){
      const st = DataService.getStudent(d.studentId);
      if (!st) { toast("Pick the student from the list", "bad"); return false; }
      if (!DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list", "bad"); return false; }
      if (!d.course) { toast("Choose the course", "bad"); return false; }
      const days = readDays(form);
      const same = DataService.getPlans({ studentId: st.id }).find(p => p.status === "Active" && p.course === d.course);
      if (same && !form.dataset.okDup) {
        form.dataset.okDup = "1";
        toast(st.name + " already has an active " + d.course + " class (" + same.id + "). Press Save again to add another.", "warn", 6000); return false;
      }
      const start = d.startDate || today();
      const rec = { studentId: st.id, teacherId: d.teacherId, course: d.course, days: days, perWeek: days.length,
        time: d.time || "", duration: +d.duration || 0, startDate: start, endDate: "", status: "Active",
        feeType: "manual", rate: 0, discount: 0, payType: "", dueDay: Math.min(28, +start.slice(8) || 1),
        setupNeeded: true, addedBy: (window.ATT_ACTOR || {}).name || "Admin", addedVia: "admin-link", addedAt: new Date().toISOString(), notes: "" };
      admStamp(rec, "added class", {});
      const id = DataService.savePlan(rec);
      toast("Class added for " + st.name + " (" + id + ") — the office will set the fee", "ok", 4500);
      admTell("plan-added", { planId: id, studentId: st.id });
      render();
    } }),
  "adm-teacher": () => openModal({ title: "Add a teacher", wide: true, submitText: "Save teacher",
    body: '<div class="form-grid">' +
      field("Teacher name", '<input class="input" name="name" required>') +
      field("Phone / WhatsApp", '<input class="input mono" name="phone" placeholder="91…">') +
      '<div class="field span2" id="admDup"></div></div>' +
      '<div class="note" style="margin:0">The office sets how this teacher is paid.</div>',
    onSubmit: function(d, form){
      const name = String(d.name || "").trim();
      if (!name) { toast("Type the teacher's name", "bad"); return false; }
      const phone = admDigits(d.phone);
      const matches = admMatches({ name: name, phone: phone, whatsapp: phone }, DataService.getTeachers(), "teacher").filter(m => m.score >= 50);
      if (matches.length && !d.confirmNew) { const box = form.querySelector("#admDup"); if (box) box.innerHTML = admDupBox(matches, "teacher"); toast("Check the possible matches first", "warn"); return false; }
      const rec = { name: name, phone: phone, whatsapp: phone, kind: "teacher", role: "", status: "Active", joiningDate: today(),
        indRateType: "manual", indRate: 0, batchPayType: "none", batchRate: 0, setupNeeded: true,
        addedBy: (window.ATT_ACTOR || {}).name || "Admin", addedVia: "admin-link", addedAt: new Date().toISOString() };
      admStamp(rec, "added teacher", {});
      const id = DataService.saveTeacher(rec);
      toast(name + " added (" + id + ")", "ok"); render();
    } }),

  /* ---- changes to what is already there ---- */
  "adm-edit-student": async (planId) => {
    await admFresh(["students"]);
    const pl = DataService.getPlan(planId), s = pl ? DataService.getStudent(pl.studentId) : null; if (!s) return;
    openModal({ title: "Edit " + s.name, wide: true, submitText: "Save changes", body: admStudentForm(s),
      onSubmit: function(d){
        joinCC(d);
        const cur = DataService.getStudent(s.id), next = Object.assign({}, cur, { name: String(d.name || "").trim() || cur.name,
          guardian: String(d.guardian || "").trim(), whatsapp: d.whatsapp || "", whatsappCC: d.whatsappCC || "", phone: String(d.phone || "").trim(),
          dob: d.dob || cur.dob || "", gender: d.gender || cur.gender || "", notes: String(d.notes || "").trim() });
        const ch = admDiff(cur, next, ["name", "guardian", "whatsapp", "phone", "dob", "gender", "notes"]);
        if (!Object.keys(ch).length) { toast("Nothing changed", "warn"); return; }
        admStamp(next, "edited student", ch);
        DataService.saveStudent(next); toast("Saved — the office sees what changed", "ok"); render();
      } });
  },
  "adm-edit-plan": async (planId) => {
    await admFresh(["plans", "classes"]);
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {};
    openModal({ title: "Change class · " + (st.name || pl.studentId), wide: true, submitText: "Save changes",
      body: '<div class="form-grid">' +
        pickBox("Teacher", "teacherId", pl.teacherId || "", pickTeachers(), "Type a teacher name or ID") +
        field("New teacher from", '<input class="input" type="date" name="from" value="' + esc(today()) + '">') +
        field("Course", sel("course", courseOpts(pl.course || "", "Select course"))) +
        field("Class time (IST)", '<input class="input" type="time" name="time" value="' + esc(pl.time || "") + '">') +
        '<div class="field span2"><label>Class days</label><div>' + dayBoxes(pl.days) + '</div></div>' +
        field("Class minutes", '<input class="input" type="number" min="0" name="duration" value="' + esc(pl.duration || 45) + '">') +
        '<div class="field span2"><div class="note" style="margin:0">A new teacher takes the marks from the date you choose; earlier marks stay with the old teacher.</div></div></div>',
      onSubmit: function(d, form){
        if (!DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list", "bad"); return false; }
        const cur = DataService.getPlan(planId);
        const next = Object.assign({}, cur, { teacherId: d.teacherId, course: d.course || cur.course, time: d.time || "",
          days: readDays(form), duration: +d.duration || 0 });
        next.perWeek = next.days.length;
        const ch = admDiff(cur, next, ["teacherId", "course", "time", "days", "duration"]);
        if (!Object.keys(ch).length) { toast("Nothing changed", "warn"); return; }
        let moved = 0;
        if (ch.teacherId) {
          const from = d.from || today();
          ch.teacherId.push("from " + from);
          DB.classes.forEach(c => { if (c.planId === planId && c.date >= from && c.teacherId !== d.teacherId) { c.teacherId = d.teacherId; moved++; } });
          next.teacherChangedFrom = from;
        }
        admStamp(next, ch.teacherId ? "changed teacher" : "changed class details", ch);
        DataService.savePlan(next);
        toast("Saved" + (moved ? " · " + moved + " mark" + (moved > 1 ? "s" : "") + " moved to the new teacher" : "") + " — the office sees what changed", "ok", 4500);
        render();
      } });
  },
  "adm-stop-plan": async (planId) => {
    await admFresh(["plans"]);
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {};
    openModal({ title: "Stop class · " + (st.name || pl.studentId), submitText: "Stop the class", danger: true,
      body: '<div class="form-grid">' + field("Last class day", '<input class="input" type="date" name="end" value="' + esc(today()) + '">') +
        field("Reason", '<input class="input" name="reason" placeholder="e.g. finished, paused, moved">') + '</div>' +
        '<div class="note" style="margin:0">The office is told, so they can settle the fees.</div>',
      onSubmit: function(d){
        const cur = DataService.getPlan(planId);
        const next = Object.assign({}, cur, { status: "Stopped", endDate: d.end || today(), stopReason: String(d.reason || "").trim() });
        admStamp(next, "stopped class", admDiff(cur, next, ["status", "endDate", "stopReason"]));
        DataService.savePlan(next); toast("Class stopped — the office will settle the fees", "ok", 4500); render();
      } });
  }
});
ATT_HOOKS.addItems = () => [["adm-student", "New student…"], ["adm-plan", "New class…"], ["adm-teacher", "New teacher…"]];
ATT_HOOKS.toolbar = () =>
  '<button type="button" class="btn btn-sm btn-primary" data-act="adm-student">+ Student</button>' +
  '<button type="button" class="btn btn-sm" data-act="adm-plan">+ Class</button>' +
  '<button type="button" class="btn btn-sm" data-act="adm-teacher">+ Teacher</button>';
ATT_HOOKS.rowButtons = pl =>
  '<button type="button" class="btn" data-act="adm-edit-student" data-id="' + esc(pl.id) + '">Edit student</button>' +
  '<button type="button" class="btn" data-act="adm-edit-plan" data-id="' + esc(pl.id) + '">Change teacher / days</button>' +
  (pl.status === "Active" ? '<button type="button" class="btn btn-danger" data-act="adm-stop-plan" data-id="' + esc(pl.id) + '">Stop class</button>' : "");

/* ---- "waiting to send" ---- */
function admPending(){
  if (typeof SupaTrack === "undefined" || !SupaTrack.base) return 0;
  let n = 0;
  SUPA_COLLS.forEach(function(c){
    if (c === "settings") return;
    const base = SupaTrack.base[c] || {}, seen = {};
    (DB[c] || []).forEach(r => { if (!r || !r.id) return; seen[r.id] = 1; if (base[r.id] !== JSON.stringify(r)) n++; });
    Object.keys(base).forEach(id => { if (!seen[id]) n++; });
  });
  return n + Supa.claimQueue.length;
}
function admPaintState(){
  const el = $("#admSave"); if (!el) return;
  const n = admPending(), off = !navigator.onLine;
  el.className = "adm-save " + (n ? "wait" : "ok");
  el.textContent = n ? (off ? "Offline · " : "") + n + " waiting to send" : (off ? "Offline · all saved on this phone" : "All saved");
}
setInterval(admPaintState, 2500);
window.addEventListener("online", () => { if (!ADM.ok) return; if (typeof SupaTrack !== "undefined") SupaTrack.schedule(); if (Supa.retryClaims) Supa.retryClaims(); attPull(true); });

/* ---- start ---- */
async function admInit(){
  bootData();
  ADM.token = admToken();
  const months = allMonths();
  State.month = currentMonth();
  if (months.indexOf(State.month) < 0) State.month = months[months.length - 1];
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  $("#globalMonth").addEventListener("change", function(){ State.month = this.value; State.iatt.sel = null; resetLists(); render(); admLoadSubs(false); });
  switchWS("ind");
  const cachedOk = (Settings().attAdminLinks || []).some(l => l && l.token === ADM.token && l.active);
  if (cachedOk) attAdminCheck(); else admBlock(ADM.token ? "Opening your attendance sheet…" : "This page opens only from your attendance link.");
  if (!ADM.token) return;
  if (cachedOk) admLoadScope();
  if (typeof Supa === "undefined" || !Supa.on()) { if (!cachedOk) admBlock("Cannot reach the academy records. Check the internet and reload."); return; }
  Supa.init();
  const r = await Supa.pullAll();
  if (!r.ok) {
    if (cachedOk) toast("Offline — showing the copy saved on this phone. Marks will send when you are back online.", "warn", 7000);
    else admBlock("Cannot reach the academy records. Check the internet and reload.");
    return;
  }
  if (!attAdminCheck()) return;   /* attAdminCheck has already stopped tracking and cleared the copy */
  const m2 = allMonths();
  if (m2.indexOf(State.month) < 0) State.month = m2[m2.length - 1];
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  ATT_LIVE.at = Date.now();
  resetLists(); render(); admPaintState();
  admLoadScope();
}


/* =======================================================================
   v3 — ONE MARKING BAR, SMALL MARK BUTTONS
   The marks on screen already mark the chosen day in Select mode (ws-attendance "ax-mk"). The card that rose
   with a second set of marks is now a slim line: who, which day, what is marked, and Note / WhatsApp / Student.
   ======================================================================= */
function admTouch(){ try { return window.matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } }
function admSelMark(){
  const s = State.iatt.sel; if (!s || State.iatt.mode !== "select" || attTab() !== "sheet") return null;
  return markOf(DataService.classAt(s.planId, s.ds)) || "";
}
attPick = function(month){
  const s = State.iatt.sel;
  if (!s || monthOf(s.ds) !== month || State.iatt.mode !== "select") return "";
  const pl = DataService.getPlan(s.planId); if (!pl) return "";
  const st = DataService.getStudent(pl.studentId) || {}, c = DataService.classAt(s.planId, s.ds), k = markOf(c);
  const hol = Logic.isHoliday(s.ds), key = s.planId + "|" + s.ds;
  const flag = hol ? "Holiday · " + hol.name : (!Logic.planDay(pl, s.ds) && !attNoDays(pl) ? "Not a class day" : "");
  const cov = admSubFor(s.planId, s.ds), covDone = cov && c && c.status === "Substitute" && c.takenBy === cov.subId;
  const when = c && c.markedAt ? "by " + (c.markedBy || "—") + " · " + fmtDate(c.markedAt.slice(0, 10)) : "";
  const what = k ? (ATT_MK[k] ? ATT_MK[k].name : k) : "Not marked";
  return '<div class="ax-pick slim' + (ATT_FX.pick !== key ? " in" : "") + '" role="status" aria-live="polite">' +
    '<div class="sl-t"><b>' + esc(st.name || pl.studentId) + '</b><span class="d">' + esc(DOW[parseYMD(s.ds).getDay()] + " " + fmtDate(s.ds)) + '</span>' +
      (flag ? '<span class="fl">' + esc(flag) + '</span>' : "") +
      (cov ? '<span class="fl cov">' + (covDone ? "Covered · " : "Cover · ") + esc(cov.sub) + '</span>' : "") +
      '<small><span class="mkn' + (k ? " m-" + k : "") + '">' + esc(what) + '</span>' + (attNoteLine(c) ? " · " + esc(attNoteLine(c)) : "") + (when ? " · " + esc(when) : "") +
      '<span class="sl-h">' + (cov && !covDone ? (admTouch() ? " · tap Sub to mark the cover" : " · press s (Sub) to mark the cover") : admTouch() ? " · tap a mark below" : " · press p a t l s e x d r c, or click a mark above") + '</span></small></div>' +
    '<div class="sl-b">' +
      (k === "A" ? '<button type="button" class="ax-pill primary" data-act="ax-wa" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '" title="WhatsApp the parent">💬</button>' : "") +
      '<button type="button" class="ax-pill" data-act="att-note" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '">Note</button>' +
      '<button type="button" class="ax-pill" data-act="att-row" data-id="' + esc(pl.id) + '">Student</button>' +
      '<button type="button" class="ax-x" data-act="att-unsel" aria-label="Done">×</button></div></div>';
};
/* the mark of the chosen day is ringed on the bar, so the bar reads as "this day is …" */
const _admDock = attDock, _admChips = attMarkChips;
function admRing(html){
  const k = admSelMark(); if (k === null) return html;
  return k ? html.replace('class="mkb m-' + k + '"', 'class="mkb m-' + k + ' cur"').replace('class="mkb m-' + k + ' on"', 'class="mkb m-' + k + ' on cur"') : html;
}
attDock = function(tab){ return admRing(_admDock(tab)); };
attMarkChips = function(){ return admRing(_admChips()); };
/* the class sheet's students only: say so in the title line */
const _admTop = attTop;
attTop = function(month, R){
  const h = _admTop(month, R);
  return ADM_SCOPE.on ? h.replace("<small>Marking as ", "<small>Class sheet students · ") : h;
};


/* =======================================================================
   v4 — COVER CLASSES planned in the class sheet
   ======================================================================= */
/* Sub on a planned cover day: marked with the planned teacher, no window */
const _admMark = attMark;
attMark = function(planId, ds, k){
  if (k === "S") {
    const cov = admSubFor(planId, ds), cur = DataService.classAt(planId, ds);
    if (cov && !(cur && cur.status === "Substitute" && cur.takenBy)) {
      if (!attCanEdit(monthOf(ds))) return;
      attWrite([{ planId: planId, ds: ds, k: "S", extra: { takenBy: cov.subId } }], "mark");
      toast("Sub · taken by " + cov.sub, "ok", 2400);
      const s = State.iatt.sel;
      if (s && s.planId === planId && s.ds === ds && State.iatt.mode === "select" && attTab() === "sheet") attNextDay();
      render();
      return;
    }
  }
  return _admMark(planId, ds, k);
};
/* the Note window on an empty planned-cover day opens on Sub with the planned teacher */
const _admNote = attNote;
attNote = function(planId, ds, preset, extraPreset){
  const cov = admSubFor(planId, ds), cur = DataService.classAt(planId, ds);
  if (cov && !(cur && cur.takenBy)) {
    const k = preset || markOf(cur) || "";
    if (!k || k === "S") return _admNote(planId, ds, "S", Object.assign({ takenBy: cov.subId }, extraPreset || {}));
  }
  return _admNote(planId, ds, preset, extraPreset);
};
/* a small corner on planned-cover days in the sheet */
const _admSheet = attSheet;
attSheet = function(month, rows){
  let h = _admSheet(month, rows);
  Object.keys(ADM_SUBS.by).forEach(function(key){
    const i = key.lastIndexOf("|"), pid = key.slice(0, i), ds = key.slice(i + 1);
    if (ds.slice(0, 7) !== month || !admSubFor(pid, ds)) return;
    h = h.replace('" data-pid="' + esc(pid) + '" data-ds="' + ds + '"', ' pc" data-pid="' + esc(pid) + '" data-ds="' + ds + '" data-cov="' + esc(ADM_SUBS.by[key].sub) + '"');
  });
  return h;
};
/* "Cover: name" on the Today list */
const _admToday = attToday;
attToday = function(R){
  let h = _admToday(R);
  const ds = State.iatt.date || today();
  Object.keys(ADM_SUBS.by).forEach(function(key){
    const i = key.lastIndexOf("|"), pid = key.slice(0, i);
    if (key.slice(i + 1) !== ds) return;
    const cov = admSubFor(pid, ds); if (!cov) return;
    const at = h.indexOf('data-act="att-row" data-id="' + esc(pid) + '"'); if (at < 0) return;
    const end = h.indexOf("</small>", at); if (end < 0) return;
    const c = DataService.classAt(pid, ds), done = c && c.status === "Substitute" && c.takenBy === cov.subId;
    const line = '<small class="axcov">' + (done ? "Covered by " : "Cover: ") + esc(cov.sub) + (done ? "" : " — tap Sub") + '</small>';
    h = h.slice(0, end + 8) + line + h.slice(end + 8);
  });
  return h;
};


/* =======================================================================
   v5 — PROFILE · PAUSE · STOP · NEW STUDENT · MINUTES · TOGGLE · UNDO
   ======================================================================= */
function admAddDays(ds, n){ const d = parseYMD(ds); d.setDate(d.getDate() + n); return ymd(d); }
function admPP(){ return typeof PlanPause !== "undefined" ? PlanPause : { list: () => [], on: () => null, current: () => null, restartDay: () => "", label: () => "", overlaps: () => false }; }
/* where the class stands today */
function admPlanState(pl){
  const t = today(), P = admPP();
  if (pl.endDate && pl.endDate < t) return { k: "stopped", label: "Stopped · last class " + fmtDate(pl.endDate) };
  if (pl.status === "Stopped" && !pl.endDate) return { k: "stopped", label: "Stopped" };
  if (pl.endDate) return { k: "stopping", label: "Last class " + fmtDate(pl.endDate) };
  const p = P.current(pl, t);
  if (p && p.from <= t) return { k: "paused", label: P.label(p), p: p };
  if (pl.startDate && pl.startDate > t) return { k: "starting", label: "Starts " + fmtDate(pl.startDate) };
  if (p) return { k: "pausing", label: "Pause from " + fmtDate(p.from) + (p.until ? " to " + fmtDate(p.until) : ""), p: p };
  return { k: "active", label: "Active" };
}
function admIni(n){ return String(n || "?").trim().split(/\s+/).map(w => w[0] || "").slice(0, 2).join("").toUpperCase() || "?"; }
function admDl(rows){ return '<dl class="ap-dl">' + rows.filter(Boolean).map(r => '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>').join("") + '</dl>'; }

/* ---- the profile ---- */
let ADM_BACK = "", ADM_BACK_T = 0;
function admProfile(planId){
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
  const month = State.month, tt = attTotals(pl, month), P = admPP();
  const um = (Logic.unmarked(month).lines.find(l => l.planId === planId) || { dates: [] }).dates;
  const mins = DataService.getClasses({ planId: planId, month: month }).reduce((n, c) => n + (+c.duration || 0), 0);
  const ps = admPlanState(pl), wa = st.whatsapp || st.phone;
  const canEdit = ps.k !== "stopped";
  const pauses = P.list(pl).slice().sort((a, b) => a.from < b.from ? 1 : -1);
  const days = (pl.days || []).length ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => '<span class="ap-day' + ((pl.days || []).indexOf(d) >= 0 ? " on" : "") + '">' + esc(d.slice(0, 2)) + '</span>').join("") : '<span class="out">Not set</span>';
  const stat = [["P", tt.p, "Present"], ["A", tt.a, "Absent"], ["T", tt.t, "Teacher absent"], ["L", tt.l, "Leave"], ["S", tt.s, "Sub"]]
    .map(x => '<span class="ap-n m-' + x[0] + '" title="' + esc(x[2]) + '"><b>' + x[1] + '</b><small>' + esc(x[2]) + '</small></span>').join("");
  let acts = "";
  if (ps.k === "paused" || ps.k === "pausing") acts += '<button type="button" class="btn btn-primary" data-act="adm-restart" data-id="' + esc(pl.id) + '">' + (ps.k === "paused" ? "Restart classes" : "Change / cancel the pause") + '</button>';
  else if (ps.k === "active" || ps.k === "starting") acts += '<button type="button" class="btn" data-act="adm-pause" data-id="' + esc(pl.id) + '">Pause classes</button>';
  if (ps.k === "stopped" || ps.k === "stopping") acts += '<button type="button" class="btn" data-act="adm-unstop" data-id="' + esc(pl.id) + '">' + (ps.k === "stopping" ? "Cancel the stop" : "Undo stop") + '</button>';
  else acts += '<button type="button" class="btn btn-danger" data-act="adm-stop-plan" data-id="' + esc(pl.id) + '">Stop class (left)</button>';
  const body = '<div class="ap" data-plan="' + esc(pl.id) + '">' +
    '<div class="ap-head"><span class="ap-av">' + esc(admIni(st.name)) + '</span><div class="ap-t"><b>' + esc(st.name || pl.studentId) + '</b>' +
      '<small>' + esc([pl.studentId, pl.course, t.name].filter(Boolean).join(" · ")) + '</small></div>' +
      '<span class="ap-st st-' + ps.k + '">' + esc(ps.label) + '</span></div>' +
    '<div class="ap-month"><div class="ap-mh"><b>' + esc(monthLabel(month)) + '</b><span>' + (mins ? mins + " class minutes" : "") + '</span></div>' +
      '<div class="ap-ns">' + stat + '</div>' +
      (um.length ? '<div class="ap-um"><span>' + um.length + ' unmarked day' + (um.length > 1 ? "s" : "") + ': ' + esc(um.map(d => +d.slice(8)).join(", ")) + '</span>' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="att-fill" data-id="' + esc(pl.id) + '">Mark them ✓ Present</button></div>' : "") + '</div>' +
    '<section class="ap-sec"><div class="ap-sh"><b>Class</b>' + (canEdit ? '<button type="button" class="ap-ed" data-act="adm-edit-plan" data-id="' + esc(pl.id) + '">Edit</button>' : "") + '</div>' +
      admDl([["Teacher", esc(t.name || "—")], ["Course", esc(pl.course || "—")], ["Days", '<span class="ap-days">' + days + '</span>'],
        ["Time", esc(pl.time ? time12(pl.time) + " IST" : "—")], ["Minutes", esc(String(pl.duration || 45))],
        ["Started", esc(pl.startDate ? fmtDate(pl.startDate) : "—")], pl.endDate ? ["Last class", esc(fmtDate(pl.endDate)) + (pl.stopReason ? " · " + esc(pl.stopReason) : "")] : null]) + '</section>' +
    '<section class="ap-sec"><div class="ap-sh"><b>Student</b><button type="button" class="ap-ed" data-act="adm-edit-student" data-id="' + esc(pl.id) + '">Edit</button></div>' +
      admDl([["Parent", esc(st.guardian || "—")],
        ["WhatsApp", wa ? '<a class="ap-wa" href="' + esc(Logic.waLink(wa, "")) + '" target="_blank" rel="noopener">' + esc(st.whatsapp ? "+" + (st.whatsappCC || "91") + " " + st.whatsapp : st.phone) + '</a>' : "—"],
        st.phone && st.whatsapp ? ["Phone", esc(st.phone)] : null, ["Date of birth", esc(st.dob ? fmtDate(st.dob) : "—")],
        st.gender ? ["Gender", esc(st.gender)] : null, st.notes ? ["Notes", esc(st.notes)] : null]) + '</section>' +
    '<section class="ap-sec"><div class="ap-sh"><b>Class status</b></div>' +
      '<div class="ap-acts">' + acts + '</div>' +
      (pauses.length ? '<div class="ap-pz"><small>Pauses</small>' + pauses.map(p => '<div class="ap-pzr"><span>' + esc(fmtDate(p.from)) + ' – ' + esc(p.until ? fmtDate(p.until) : "until restarted") +
        (p.reason ? ' · ' + esc(p.reason) : "") + '</span>' + (p.from > today() ? '<button type="button" class="ap-ed" data-act="adm-pause-del" data-id="' + esc(pl.id) + '" data-ds="' + esc(p.from) + '">Remove</button>' : "") + '</div>').join("") + '</div>' : "") +
      '<p class="ap-note">Pause and stop reach the teacher page and the student\'s class sheet. The office sees every change in Review and settles the fees.</p></section>' +
    '<div class="ap-foot"><button type="button" class="btn btn-sm" data-act="ax-rep-plan" data-id="' + esc(pl.id) + '">Attendance report (PDF)</button></div>' +
  '</div>';
  openModal({ title: "Student profile", wide: true, hideSubmit: true, cancelText: "Close", noFocus: true, body: body });
}
Actions["att-row"] = function(planId){ admProfile(planId); };
/* an Edit / Pause / Stop started from the profile comes back to the profile after saving */
document.addEventListener("click", function(e){
  const b = e.target.closest && e.target.closest(".ap [data-act]"); if (!b) return;
  const box = b.closest(".ap"); ADM_BACK = box ? box.dataset.plan : "";
  clearTimeout(ADM_BACK_T); ADM_BACK_T = setTimeout(() => { ADM_BACK = ""; }, 4000);
}, true);
const _admOpenModal = openModal;
openModal = function(o){
  const back = ADM_BACK; ADM_BACK = "";
  if (back && o && o.onSubmit) {
    const f = o.onSubmit;
    o = Object.assign({}, o, { onSubmit: function(d, form){ const r = f(d, form); if (r !== false) setTimeout(() => { if (!$("#mScrim")) admProfile(back); }, 240); return r; } });
  }
  return _admOpenModal(o);
};

/* ---- pause / restart ---- */
function admDateChips(name, base, list){
  return '<div class="ap-chips">' + list.map(x => '<button type="button" class="ap-chip" data-act="adm-setdate" data-id="' + esc(name) + '" data-v="' + esc(x[1]) + '" data-base="' + esc(base || "") + '">' + esc(x[0]) + '</button>').join("") + '</div>';
}
function admPauseMarks(pl, from, until){
  const end = until || "9999-12-31";
  return DataService.getClasses({ planId: pl.id }).filter(c => c.date >= from && c.date <= end && markOf(c)).length;
}
Object.assign(Actions, {
  /* date quick buttons: data-v = "+7" days from the 'from' field, "" = clear, or a date */
  "adm-setdate": (name, el) => {
    const form = $("#mForm"); if (!form || !form.elements[name]) return;
    const v = el.dataset.v;
    if (/^[+-]\d+$/.test(v)) { const fromEl = form.elements[el.dataset.base] || form.elements.from; const b = (fromEl && fromEl.value) || today(); form.elements[name].value = admAddDays(b, +v); }
    else form.elements[name].value = v;
    form.elements[name].dispatchEvent(new Event("change", { bubbles: true }));
    el.parentNode.querySelectorAll(".ap-chip").forEach(x => x.classList.toggle("on", x === el));
  },
  "adm-pause": (planId) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {};
    const from0 = pl.startDate && pl.startDate > today() ? pl.startDate : today();
    openModal({ title: "Pause classes · " + (st.name || pl.studentId), wide: true, submitText: "Pause",
      body: '<div class="form-grid">' +
        field("No class from", '<input class="input" type="date" name="from" value="' + esc(from0) + '" min="' + esc(pl.startDate || "") + '">' +
          admDateChips("from", "", [["Today", today()], ["Tomorrow", admAddDays(today(), 1)]])) +
        field("Classes restart on", '<input class="input" type="date" name="restart" value="">' +
          admDateChips("restart", "from", [["1 week", "+7"], ["2 weeks", "+14"], ["1 month", "+30"], ["Not decided", ""]])) +
        '<div class="field span2"><label>Reason</label><input class="input" name="reason" placeholder="e.g. exams, travel, illness"></div>' +
        '<div class="field span2"><div class="note" style="margin:0">These days are not class days: no unmarked days, the teacher sees “Paused”, and the student\'s class sheet has no join link. Leave “restart” empty to restart by hand later. The office sees the pause in Review and decides about the fees.</div></div>' +
        '<div class="field span2" id="admPzWarn"></div></div>',
      onSubmit: function(d, form){
        const cur = DataService.getPlan(planId), P = admPP();
        const from = d.from || today(), restart = d.restart || "";
        if (cur.startDate && from < cur.startDate) { toast("The class starts on " + fmtDate(cur.startDate), "bad"); return false; }
        if (restart && restart <= from) { toast("Restart must be after the first paused day", "bad"); return false; }
        if (cur.endDate && from > cur.endDate) { toast("The class ends on " + fmtDate(cur.endDate), "bad"); return false; }
        const until = restart ? admAddDays(restart, -1) : "";
        if (P.overlaps(cur, from, until)) { toast("These days overlap another pause", "bad"); return false; }
        const n = admPauseMarks(cur, from, until);
        if (n && !form.dataset.okMarks) {
          form.dataset.okMarks = "1";
          const w = form.querySelector("#admPzWarn"); if (w) w.innerHTML = '<div class="note" style="border-color:#e0a54b;margin:0">' + n + ' day' + (n > 1 ? "s" : "") + ' in this pause already have a mark. The marks stay. Press Pause again to go on.</div>';
          return false;
        }
        const p = { from: from, until: until, reason: String(d.reason || "").trim(), by: (window.ATT_ACTOR || {}).name || "Admin", at: new Date().toISOString() };
        const next = Object.assign({}, cur, { pauses: P.list(cur).concat([p]) });
        admStamp(next, "paused class", { pause: ["", P.label(p) + (p.reason ? " (" + p.reason + ")" : "")] });
        DataService.savePlan(next);
        admTell("plan-paused", { planId: planId, from: from, until: until });
        toast("Paused — " + P.label(p), "ok", 4000); render();
      } });
  },
  "adm-restart": (planId) => {
    const pl = DataService.getPlan(planId), P = admPP(); if (!pl) return;
    const p = P.current(pl, today()); if (!p) { toast("This class is not paused", "warn"); return; }
    const st = DataService.getStudent(pl.studentId) || {};
    const future = p.from > today();
    openModal({ title: (future ? "Change the pause · " : "Restart classes · ") + (st.name || pl.studentId), wide: true, submitText: future ? "Save" : "Restart",
      body: '<div class="form-grid">' +
        field("Paused from", '<input class="input" type="date" name="from" value="' + esc(p.from) + '"' + (future ? "" : " readonly") + '>') +
        field("Classes restart on", '<input class="input" type="date" name="restart" value="' + esc(future ? P.restartDay(p) : today()) + '">' +
          admDateChips("restart", "", future ? [["Not decided", ""]] : [["Today", today()], ["Tomorrow", admAddDays(today(), 1)]].concat(P.restartDay(p) && P.restartDay(p) > admAddDays(today(), 1) ? [["As planned · " + fmtDate(P.restartDay(p)), P.restartDay(p)]] : []))) +
        '<div class="field span2"><div class="note" style="margin:0">' + (future ? "To cancel the pause, use Remove in the profile." : "Classes are expected again from this day — it shows on the teacher page and the class sheet.") + '</div></div></div>',
      onSubmit: function(d){
        const cur = DataService.getPlan(planId), list = P.list(cur).map(x => Object.assign({}, x));
        const me = list.find(x => x.from === p.from); if (!me) return;
        const from = future ? (d.from || p.from) : p.from, restart = d.restart || "";
        if (restart && restart <= from) {
          if (future) { toast("Restart must be after the first paused day", "bad"); return false; }
          list.splice(list.indexOf(me), 1);                       /* restarted on its first day: no pause at all */
        } else { me.from = from; me.until = restart ? admAddDays(restart, -1) : ""; }
        if (list.indexOf(me) >= 0 && P.overlaps(Object.assign({}, cur, { pauses: list }), me.from, me.until, me)) { toast("These days overlap another pause", "bad"); return false; }
        const next = Object.assign({}, cur, { pauses: list });
        admStamp(next, future ? "changed pause" : "restarted class", { pause: [P.label(p), list.indexOf(me) >= 0 ? P.label(me) : "removed"] });
        DataService.savePlan(next);
        admTell("plan-paused", { planId: planId });
        toast(future ? "Pause changed" : "Classes restart " + (restart ? fmtDate(restart) : "— date not set"), "ok", 3500); render();
      } });
  },
  "adm-pause-del": (planId, el) => {
    const pl = DataService.getPlan(planId), P = admPP(); if (!pl) return;
    const from = el.dataset.ds;
    confirmAction({ title: "Remove this pause?", message: "The class runs as usual on these days.", submitText: "Remove", danger: true,
      onConfirm: () => {
        const cur = DataService.getPlan(planId), old = P.list(cur).find(x => x.from === from);
        const next = Object.assign({}, cur, { pauses: P.list(cur).filter(x => x.from !== from) });
        admStamp(next, "removed pause", { pause: [old ? P.label(old) : from, "removed"] });
        DataService.savePlan(next); admTell("plan-paused", { planId: planId }); toast("Pause removed", "ok"); render();
      } });
  },
  /* stop: the last class day; the class sheet turns off after it and the teacher page drops the student */
  "adm-stop-plan": (planId) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {};
    const last = DataService.getClasses({ planId: planId }).filter(c => markOf(c) && c.date <= today()).map(c => c.date).sort().pop() || today();
    openModal({ title: "Stop class · " + (st.name || pl.studentId), wide: true, submitText: "Stop the class", danger: true,
      body: '<div class="form-grid">' +
        field("Last class day", '<input class="input" type="date" name="end" value="' + esc(last) + '" min="' + esc(pl.startDate || "") + '">' +
          admDateChips("end", "", [["Last marked · " + fmtDate(last), last], ["Today", today()], ["Yesterday", admAddDays(today(), -1)]])) +
        field("Reason", '<input class="input" name="reason" placeholder="e.g. finished, moved, fees">') +
        '<div class="field span2"><div class="note" style="margin:0">After the last class day the student leaves this list, the teacher page drops them and their class sheet link turns off (the student is signed out). Marks before it stay. The office is told, so they can settle the fees.</div></div></div>',
      onSubmit: function(d){
        const cur = DataService.getPlan(planId), end = d.end || today();
        if (cur.startDate && end < cur.startDate) { toast("The class starts on " + fmtDate(cur.startDate), "bad"); return false; }
        const after = DataService.getClasses({ planId: planId }).filter(c => c.date > end && markOf(c)).length;
        const P = admPP(), pz = P.list(cur).filter(p => p.from <= end).map(p => (!p.until || p.until > end) ? Object.assign({}, p, { until: end }) : p);
        const next = Object.assign({}, cur, { status: "Stopped", endDate: end, stopReason: String(d.reason || "").trim(), pauses: pz });
        admStamp(next, "stopped class", admDiff(cur, next, ["status", "endDate", "stopReason"]));
        DataService.savePlan(next);
        admTell("plan-stopped", { planId: planId, endDate: end });
        toast("Class stopped — last class " + fmtDate(end) + (after ? " · " + after + " mark" + (after > 1 ? "s" : "") + " after it stay for the office to check" : ""), "ok", 5000); render();
      } });
  },
  "adm-unstop": (planId) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {};
    confirmAction({ title: (pl.endDate && pl.endDate >= today() ? "Cancel the stop · " : "Undo stop · ") + (st.name || pl.studentId),
      message: "The class becomes active again with no last day. If the class sheet was already turned off, switch it on again in the class sheet list.", submitText: "Make active",
      onConfirm: () => {
        const cur = DataService.getPlan(planId), next = Object.assign({}, cur, { status: "Active", endDate: "", stopReason: "" });
        admStamp(next, "undid stop", admDiff(cur, next, ["status", "endDate", "stopReason"]));
        DataService.savePlan(next); admTell("plan-stopped", { planId: planId, endDate: "" });
        toast("Class active again", "ok"); render();
      } });
  },

  /* ---- a new student joining (any day of the month): student + class in one window ---- */
  "adm-student-new": () => {
    const q = ($("#admFind") || {}).value || "";
    const pre = /\d{5,}/.test(q) ? { whatsapp: q } : { name: q };
    openModal({ title: "New student", wide: true, submitText: "Add student and class",
      body: '<div class="ap-form"><h4 class="ap-fh">Student</h4>' + admStudentForm(pre).replace('name="joiningDate"', 'name="joiningDate" data-join="1"') +
        '<h4 class="ap-fh">Class</h4><div class="form-grid">' +
        pickBox("Teacher", "teacherId", "", pickTeachers(), "Type a teacher name or ID") +
        field("Course", sel("course", courseOpts("", "Select course"))) +
        '<div class="field span2"><label>Class days</label><div>' + dayBoxes([]) + '</div></div>' +
        field("Class time (IST)", '<input class="input" type="time" name="time" value="">') +
        field("Class minutes", '<input class="input" type="number" min="0" name="duration" value="45">') +
        '<div class="field span2"><div class="note" style="margin:0">The student is in the attendance from the joining date — days before it are greyed. The office sets the fee and the teacher\'s pay.</div></div></div></div>',
      onSubmit: function(d, form){
        const name = String(d.name || "").trim();
        if (!name) { toast("Type the student's name", "bad"); return false; }
        if (!DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list", "bad"); return false; }
        if (!d.course) { toast("Choose the course", "bad"); return false; }
        const days = readDays(form);
        if (!days.length && !form.dataset.okDays) { form.dataset.okDays = "1"; toast("No class days ticked. Press again to add without days.", "warn", 5000); return false; }
        joinCC(d);
        const matches = admMatches({ name: name, guardian: d.guardian, phone: d.phone, whatsapp: d.whatsapp }, DataService.getStudents(), "student").filter(m => m.score >= 50);
        if (matches.length && !d.confirmNew) {
          const box = form.querySelector("#admDup"); if (box) box.innerHTML = admDupBox(matches, "student");
          box && box.scrollIntoView({ block: "center", behavior: "smooth" });
          toast("Check the possible matches first", "warn"); return false;
        }
        const join = d.joiningDate || today(), who = (window.ATT_ACTOR || {}).name || "Admin", at = new Date().toISOString();
        const srec = { name: name, guardian: String(d.guardian || "").trim(), whatsapp: d.whatsapp || "", whatsappCC: d.whatsappCC || "",
          phone: String(d.phone || "").trim(), dob: d.dob || "", gender: d.gender || "", joiningDate: join, notes: String(d.notes || "").trim(),
          status: "Active", addedBy: who, addedVia: "admin-link", addedAt: at };
        admStamp(srec, "added student", {});
        const sid = DataService.saveStudent(srec);
        const prec = { studentId: sid, teacherId: d.teacherId, course: d.course, days: days, perWeek: days.length,
          time: d.time || "", duration: +d.duration || 0, startDate: join, endDate: "", status: "Active",
          feeType: "manual", rate: 0, discount: 0, payType: "", dueDay: Math.min(28, +join.slice(8) || 1),
          setupNeeded: true, addedBy: who, addedVia: "admin-link", addedAt: at, notes: "" };
        admStamp(prec, "added class", {});
        const pid = DataService.savePlan(prec);
        if (monthOf(join) !== State.month && join <= today()) { State.month = monthOf(join); const gm = $("#globalMonth"); if (gm) gm.value = State.month; }
        toast(name + " added (" + sid + ") from " + fmtDate(join) + " — the office will set the fee", "ok", 5000);
        admTell("student-added", { studentId: sid });
        admTell("plan-added", { planId: pid, studentId: sid });
        render();
      } });
  }
});
document.addEventListener("change", function(e){
  const t = e.target; if (!t || !t.form || t.form.id !== "mForm") return;
  if (t.name === "joiningDate" || t.name === "from" || t.name === "restart" || t.name === "end")
    t.closest(".field") && t.closest(".field").querySelectorAll(".ap-chip").forEach(x => x.classList.toggle("on", x.dataset.v === t.value));
});
/* joining date chips under the date in the new-student window */
const _admStudentForm = admStudentForm;
admStudentForm = function(s){
  const h = _admStudentForm(s);
  if (s && s.id) return h;
  const m1 = today().slice(0, 8) + "01";
  return h.replace(/(name="joiningDate"[^>]*>)/, '$1' + admDateChips("joiningDate", "", [["Today", today()], ["Yesterday", admAddDays(today(), -1)], ["1st of the month", m1]]));
};

/* the slim line says when a day is paused, and offers the class minutes */
const _admPick5 = attPick;
attPick = function(month){
  let h = _admPick5(month); if (!h) return h;
  const s = State.iatt.sel, pl = DataService.getPlan(s.planId), P = admPP();
  const pz = pl && P.on(pl, s.ds);
  if (pz) h = h.replace('<span class="fl">Not a class day</span>', '').replace('<small>', '<span class="fl pz">' + esc(P.label(pz)) + '</span><small>');
  const c = DataService.classAt(s.planId, s.ds), k = markOf(c);
  if (pl && (k === "P" || k === "S")) {
    const m = +(c && c.mins) || 0, def = +pl.duration || 45;
    h = h.replace('<div class="sl-b">', '<div class="sl-b"><button type="button" class="ax-pill dur' + (m && m !== def ? " chg" : "") + '" data-act="adm-dur" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '" title="Class minutes for this day">⏱ ' + (m || def) + ' min</button>');
  }
  return h;
};
/* Today: a minutes chip on a held class */
const _admToday5 = attToday;
attToday = function(R){
  let h = _admToday5(R);
  const ds = State.iatt.date || today();
  DataService.getPlans().forEach(function(pl){
    const c = DataService.classAt(pl.id, ds), k = markOf(c); if (k !== "P" && k !== "S") return;
    const at = h.indexOf('data-act="att-row" data-id="' + esc(pl.id) + '"'); if (at < 0) return;
    const end = h.indexOf("</small>", at); if (end < 0) return;
    const m = +(c && c.mins) || 0, def = +pl.duration || 45;
    const chip = '<button type="button" class="axdur' + (m && m !== def ? " chg" : "") + '" data-act="adm-dur" data-id="' + esc(pl.id) + '" data-ds="' + ds + '">⏱ ' + (m || def) + ' min</button>';
    h = h.slice(0, end + 8) + chip + h.slice(end + 8);
  });
  return h;
};

/* ---- class minutes: a drag scale that clicks onto every 5 minutes ---- */
const DUR = { min: 5, max: 120, step: 5, v: 45, def: 45, planId: "", ds: "", drag: false, last: 0 };
function durX(v){ return (v - DUR.min) / (DUR.max - DUR.min) * 100; }
function durSnap(raw){
  let v = Math.round(raw / DUR.step) * DUR.step;
  if (Math.abs(raw - DUR.def) <= 3.2) v = DUR.def;              /* the class's usual minutes pull a little harder */
  return Math.max(DUR.min, Math.min(DUR.max, v));
}
function durPaint(){
  const box = $("#admDur"); if (!box) return;
  const v = DUR.v;
  box.querySelector(".du-v b").textContent = v;
  box.querySelector(".du-v small").textContent = v === DUR.def ? "the usual " + DUR.def + " min" : (v > DUR.def ? "+" : "−") + Math.abs(v - DUR.def) + " from the usual " + DUR.def;
  box.querySelector(".du-fill").style.width = durX(v) + "%";
  const th = box.querySelector(".du-th"); th.style.left = durX(v) + "%"; th.setAttribute("aria-valuenow", v); th.setAttribute("aria-valuetext", v + " minutes");
  box.querySelectorAll(".du-q").forEach(q => q.classList.toggle("on", +q.dataset.v === v));
}
function durSet(v, buzz){
  v = Math.max(DUR.min, Math.min(DUR.max, v));
  if (v !== DUR.v) { DUR.v = v; if (buzz && navigator.vibrate) try { navigator.vibrate(6); } catch (e) {} }
  durPaint();
}
function durOpen(planId, ds){
  const pl = DataService.getPlan(planId); if (!pl) return;
  const c = DataService.classAt(planId, ds), k = markOf(c); if (k !== "P" && k !== "S") { toast("Mark the day Present or Sub first", "warn"); return; }
  if (!attCanEdit(monthOf(ds))) return;
  const st = DataService.getStudent(pl.studentId) || {};
  DUR.planId = planId; DUR.ds = ds; DUR.def = +pl.duration || 45; DUR.v = +(c && c.mins) || DUR.def;
  DUR.max = Math.max(120, Math.ceil((DUR.def + 30) / 30) * 30);
  durClose();
  const ticks = []; for (let m = DUR.min; m <= DUR.max; m += 5) ticks.push('<i class="' + (m % 15 === 0 ? "maj" : "") + (m === DUR.def ? " def" : "") + '" style="left:' + durX(m) + '%">' + (m % 15 === 0 || m === DUR.def ? '<em>' + m + '</em>' : "") + '</i>');
  const quick = [DUR.def - 15, DUR.def - 10, DUR.def - 5, DUR.def, DUR.def + 5, DUR.def + 15].filter((v, i, a) => v >= DUR.min && v <= DUR.max && a.indexOf(v) === i);
  const el = document.createElement("div");
  el.id = "admDur"; el.className = "du-scrim";
  el.innerHTML = '<div class="du" role="dialog" aria-label="Class minutes"><div class="du-hd"><b>Class minutes</b><small>' + esc((st.name || pl.studentId) + " · " + DOW[parseYMD(ds).getDay()] + " " + fmtDate(ds)) + '</small>' +
      '<button type="button" class="du-x" data-du="close" aria-label="Close">×</button></div>' +
    '<div class="du-v"><b>' + DUR.v + '</b><span>min</span><small></small></div>' +
    '<div class="du-row"><button type="button" class="du-pm" data-du="-5" aria-label="5 minutes less">−5</button>' +
      '<div class="du-tr"><div class="du-ticks">' + ticks.join("") + '</div><div class="du-bar"><div class="du-fill"></div></div>' +
        '<button type="button" class="du-th" role="slider" aria-label="Class minutes" aria-valuemin="' + DUR.min + '" aria-valuemax="' + DUR.max + '" aria-valuenow="' + DUR.v + '"></button></div>' +
      '<button type="button" class="du-pm" data-du="+5" aria-label="5 minutes more">+5</button></div>' +
    '<div class="du-qs">' + quick.map(v => '<button type="button" class="du-q" data-du="q" data-v="' + v + '">' + v + (v === DUR.def ? " · usual" : "") + '</button>').join("") + '</div>' +
    '<div class="du-ft"><button type="button" class="btn" data-du="close">Cancel</button><button type="button" class="btn btn-primary" data-du="save">Save</button></div></div>';
  document.body.appendChild(el);
  durPaint();
  const tr = el.querySelector(".du-tr"), th = el.querySelector(".du-th");
  const at = e => { const r = tr.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); return DUR.min + x * (DUR.max - DUR.min); };
  tr.addEventListener("pointerdown", function(e){ e.preventDefault(); DUR.drag = true; try { tr.setPointerCapture(e.pointerId); } catch (x) {} el.classList.add("drag"); durSet(durSnap(at(e)), true); th.focus({ preventScroll: true }); });
  tr.addEventListener("pointermove", function(e){ if (DUR.drag) durSet(durSnap(at(e)), true); });
  const up = function(){ DUR.drag = false; el.classList.remove("drag"); };
  tr.addEventListener("pointerup", up); tr.addEventListener("pointercancel", up);
  th.addEventListener("keydown", function(e){
    const d = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 }[e.key];
    if (d) { e.preventDefault(); durSet(DUR.v + d, false); }
    else if (e.key === "Home") { e.preventDefault(); durSet(DUR.min); } else if (e.key === "End") { e.preventDefault(); durSet(DUR.max); }
  });
  el.addEventListener("click", function(e){
    if (e.target === el) { durClose(); return; }
    const b = e.target.closest("[data-du]"); if (!b) return;
    const a = b.dataset.du;
    if (a === "close") durClose();
    else if (a === "save") durSave();
    else if (a === "q") durSet(+b.dataset.v, true);
    else durSet(DUR.v + (+a), true);
  });
  el.addEventListener("keydown", function(e){ if (e.key === "Escape") { e.stopPropagation(); durClose(); } else if (e.key === "Enter" && e.target.tagName !== "BUTTON") durSave(); });
  setTimeout(() => th.focus({ preventScroll: true }), 30);
}
function durClose(){ const el = $("#admDur"); if (el) el.remove(); }
function durSave(){
  const c = DataService.classAt(DUR.planId, DUR.ds), k = markOf(c);
  if (!c || (k !== "P" && k !== "S")) { durClose(); return; }
  const v = DUR.v === DUR.def ? "" : DUR.v;
  if (String(c.mins || "") === String(v)) { durClose(); return; }
  attWrite([{ planId: DUR.planId, ds: DUR.ds, k: k, extra: { mins: v } }], "minutes");
  durClose(); render();
}
Actions["adm-dur"] = (planId, el) => durOpen(planId, el.dataset.ds);

/* ---- tap the same mark again = clear it; an Undo bar after each change ---- */
let ADM_TOGGLED = false, ADM_UNDO_T = 0;
const _admWrite = attWrite;
attWrite = function(list, label, noUndo){
  let out;
  if (label === "mark" && list.length === 1 && list[0].k && !(list[0].extra && Object.keys(list[0].extra).length)) {
    const it = list[0], cur = DataService.classAt(it.planId, it.ds);
    if (cur && markOf(cur) === it.k) {
      ADM_TOGGLED = true; setTimeout(() => { ADM_TOGGLED = false; }, 0);
      out = _admWrite([{ planId: it.planId, ds: it.ds, k: "" }], "clear", noUndo);
      if (out && !noUndo) admUndoBar("clear", it);
      return out;
    }
  }
  out = _admWrite(list, label, noUndo);
  if (out && !noUndo) admUndoBar(label, list[0], list.length);
  return out;
};
const _admNextDay = attNextDay;
attNextDay = function(){ if (ADM_TOGGLED) { ADM_TOGGLED = false; return; } return _admNextDay.apply(this, arguments); };
function admUndoBar(label, it, n){
  if (!it) return;
  const pl = DataService.getPlan(it.planId), st = pl ? DataService.getStudent(pl.studentId) || {} : {};
  const what = label === "clear" ? "Cleared" : label === "minutes" ? "Minutes saved" : label === "mark" && it.k && ATT_MK[it.k] ? ATT_MK[it.k].name : (label.charAt(0).toUpperCase() + label.slice(1));
  const txt = (n > 1 ? what + " · " + n + " days" : what + " · " + (st.name || "").split(" ")[0] + " · " + fmtDate(it.ds));
  let bar = $("#admUndo");
  if (!bar) {
    bar = document.createElement("div"); bar.id = "admUndo"; bar.setAttribute("role", "status"); bar.setAttribute("aria-live", "polite");
    bar.addEventListener("click", function(e){
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.u === "undo") Actions["att-undo"]();
      bar.classList.remove("show");
    });
    document.body.appendChild(bar);
  }
  bar.innerHTML = '<span class="u-t">' + esc(txt) + '</span><button type="button" class="u-b" data-u="undo">↶ Undo</button><button type="button" class="u-x" data-u="x" aria-label="Hide">×</button>';
  const slim = document.querySelector(".ax-pick.slim"), dock = document.querySelector(".ax-dock");
  let bottom = 14;
  [slim, dock].forEach(x => { if (x) { const r = x.getBoundingClientRect(); if (r.height && r.top < innerHeight) bottom = Math.max(bottom, innerHeight - r.top + 10); } });
  bar.style.bottom = bottom + "px";
  bar.classList.add("show");
  clearTimeout(ADM_UNDO_T); ADM_UNDO_T = setTimeout(() => bar.classList.remove("show"), 7000);
}


/* =======================================================================
   v6 — LEFT STUDENTS · NEXT STUDENT · MONTH SET-UP · CLASS DAYS ROWS
   ======================================================================= */
/* ---- a student who left: tag on the name, days after the last class struck ---- */
const _admSheet6 = attSheet;
attSheet = function(month, rows){
  let h = _admSheet6(month, rows);
  const ms = month + "-01", me = month + "-" + pad2(daysInMonth(month));
  (rows || []).forEach(function(r){
    const pl = r.pl; if (!pl.endDate || pl.endDate > me) return;
    const tag = '<span class="ax-st left" title="' + esc("Stopped" + (pl.stopReason ? " · " + pl.stopReason : "")) + '">Left · ' + esc(+pl.endDate.slice(8) + " " + MONTHS[+pl.endDate.slice(5, 7) - 1].slice(0, 3)) + '</span>';
    const tr = '<tr data-pid="' + esc(pl.id) + '">';
    let i = h.indexOf(tr); if (i < 0) return;
    h = h.slice(0, i) + '<tr data-pid="' + esc(pl.id) + '" class="left">' + h.slice(i + tr.length);
    i = h.indexOf('<tr data-pid="' + esc(pl.id) + '" class="left">');
    const end = h.indexOf("</tr>", i), row = h.slice(i, end);
    /* the tag goes in front of the name, so it shows even when a long name is cut on a phone */
    let nrow = row.replace(/<span class="ax-st">[^<]*<\/span>/, "").replace('<span class="nm">', tag.replace('class="ax-st left"', 'class="ax-st left pre"') + '<span class="nm">');
    for (let d = +pl.endDate.slice(8) + 1; pl.endDate >= ms && d <= daysInMonth(month); d++) {
      const key = '" data-pid="' + esc(pl.id) + '" data-ds="' + month + "-" + pad2(d) + '"';
      nrow = nrow.replace(key, ' gone' + key);
    }
    h = h.slice(0, i) + nrow + h.slice(end);
  });
  return h;
};

/* ---- after a mark: the next student, same day ---- */
attNextDay = function(){
  if (ADM_TOGGLED) { ADM_TOGGLED = false; return; }
  const s = State.iatt.sel; if (!s) return;
  const rows = attRows(State.month).rows, ri = rows.findIndex(r => r.pl.id === s.planId);
  if (ri < 0) return;
  for (let i = ri + 1; i < rows.length; i++) {
    const pl = rows[i].pl;
    if (attPossible(pl, s.ds) && !markOf(DataService.classAt(pl.id, s.ds))) { State.iatt.sel = { planId: pl.id, ds: s.ds }; admSelShow(); return; }
  }
  for (let i = ri + 1; i < rows.length; i++) {
    if (attPossible(rows[i].pl, s.ds)) { State.iatt.sel = { planId: rows[i].pl.id, ds: s.ds }; admSelShow(); return; }
  }
  toast("Last student for " + fmtDate(s.ds), "ok", 1600);
};
function admSelShow(){
  setTimeout(function(){ const c = document.querySelector("#axGrid td.dc.sel"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "nearest" }); }, 30);
}

/* ---- month set-up: a check of the classes before a new month opens ---- */
function admMonthKey(){ return "mq_att_months_" + (ADM.token || "x").slice(0, 12); }
function admMonthsReady(){ try { return JSON.parse(localStorage.getItem(admMonthKey()) || "[]"); } catch (e) { return []; } }
/* past months are open; this month and the next open once checked (this month also after "Later") */
function admMonthReady(m){
  if (m < currentMonth()) return true;
  return admMonthsReady().indexOf(m) >= 0 || (m === currentMonth() && !!attPref("monthSkip_" + m));
}
function admSetReady(m){ try { const l = admMonthsReady(); if (l.indexOf(m) < 0) l.push(m); localStorage.setItem(admMonthKey(), JSON.stringify(l)); } catch (e) {} }
attMonthSelect = function(month){
  const cur = currentMonth(), next = addMonths(cur, 1);
  let ms = allMonths().filter(m => m <= cur || admMonthsReady().indexOf(m) >= 0);
  if (ms.indexOf(month) < 0) ms = ms.concat([month]).sort();
  const setup = [cur, next].filter(m => !admMonthReady(m));
  return '<select class="ax-msel" data-act="ax-pickmonth" aria-label="Choose a month">' +
    setup.slice().reverse().map(m => '<option value="setup:' + m + '">＋ Set up ' + esc(monthLabel(m)) + '…</option>').join("") +
    ms.slice().reverse().map(m => '<option value="' + m + '"' + (m === month ? " selected" : "") + '>' + esc(monthLabel(m)) + (m === cur ? " · this month" : "") + '</option>').join("") + '</select>';
};
const _admPickMonth = Actions["ax-pickmonth"];
Actions["ax-pickmonth"] = function(id, el){
  if (el && /^setup:/.test(el.value)) { const m = el.value.slice(6); el.value = State.month; admMonthSetup(m); return; }
  return _admPickMonth(id, el);
};
/* a nudge when this month has not been checked yet */
const _admTop6 = attTop;
attTop = function(month, R){
  let h = _admTop6(month, R);
  const cur = currentMonth();
  if (!admMonthReady(cur) && +today().slice(8) <= 10) h += '<div class="adm-mbar"><span><b>' + esc(monthLabel(cur)) + '</b> — check the classes for the new month</span><button type="button" class="ax-pill primary" data-act="adm-msetup" data-id="' + cur + '">Check &amp; set up</button><button type="button" class="ax-pill" data-act="adm-mskip" data-id="' + cur + '">Later</button></div>';
  return h;
};
let ADM_SETUP = "";
function admSetupGroups(m){
  const ms = m + "-01", me = m + "-" + pad2(daysInMonth(m)), prev = addMonths(m, -1), P = admPP();
  const inScope = DataService.getPlans().filter(p => DataService.getStudent(p.studentId));
  const g = { ended: [], stopping: [], paused: [], starting: [], fix: [], running: [] };
  inScope.forEach(function(p){
    const ended = p.endDate ? p.endDate < ms : p.status !== "Active";
    if (ended) { if (!p.endDate || p.endDate >= prev + "-01") g.ended.push(p); return; }
    if (p.startDate && p.startDate > me) return;
    if (p.endDate && p.endDate <= me) g.stopping.push(p);
    const pz = P.list(p).filter(x => x.from <= me && (!x.until || x.until >= ms));
    if (pz.length) g.paused.push(p);
    if ((p.startDate && p.startDate >= prev + "-01") || p.setupNeeded) g.starting.push(p);
    if (attNoDays(p) || !p.time) g.fix.push(p);
    g.running.push(p);
  });
  return g;
}
function admSetupRow(p, why){
  const st = DataService.getStudent(p.studentId) || {}, t = DataService.getTeacher(p.teacherId) || {};
  const days = (p.days || []).length ? p.days.map(d => d.slice(0, 2)).join(" ") : "no days";
  return '<div class="ms-row"><div class="ms-mid"><b>' + esc(st.name || p.studentId) + '</b><small>' + esc([t.name, p.course, days, p.time ? time12(p.time) : "no time"].filter(Boolean).join(" · ")) + '</small>' +
    (why ? '<span class="ms-why">' + why + '</span>' : "") + '</div>' +
    '<button type="button" class="ap-ed" data-act="adm-msedit" data-id="' + esc(p.id) + '">Edit</button></div>';
}
function admMonthSetup(m){
  ADM_SETUP = m;
  const g = admSetupGroups(m), P = admPP(), ms = m + "-01";
  const sec = (title, note, list, why, cls) => list.length ? '<section class="ms-sec ' + (cls || "") + '"><div class="ms-h"><b>' + esc(title) + '</b><span>' + list.length + '</span></div>' +
    (note ? '<p class="ms-note">' + esc(note) + '</p>' : "") + list.map(p => admSetupRow(p, why ? why(p) : "")).join("") + '</section>' : "";
  const body = '<div class="ms">' +
    '<p class="ms-lead">Check the classes before <b>' + esc(monthLabel(m)) + '</b> opens. Tap Edit to fix a class — you come back here.</p>' +
    sec("Needs class days or time", "These cannot be marked well until the days and time are set.", g.fix, p => attNoDays(p) ? "No class days" : "No class time", "warn") +
    sec("New classes", "Started last month or this month — check the teacher, days and time.", g.starting, p => "Starts " + esc(fmtDate(p.startDate || ms)) + (p.setupNeeded ? " · office still to set the fee" : "")) +
    sec("Left", "Stopped before this month — they are not in " + monthLabel(m) + ". Undo stop from Edit if this is wrong.", g.ended, p => "Last class " + esc(p.endDate ? fmtDate(p.endDate) : "—") + (p.stopReason ? " · " + esc(p.stopReason) : ""), "left") +
    sec("Stop during the month", "", g.stopping, p => "Last class " + esc(fmtDate(p.endDate)), "left") +
    sec("Paused in " + monthLabel(m), "", g.paused, p => esc(P.list(p).filter(x => !x.until || x.until >= ms).map(x => fmtDate(x.from) + " – " + (x.until ? fmtDate(x.until) : "until restarted")).join(", ")), "pz") +
    '<section class="ms-sec"><div class="ms-h"><b>All classes in ' + esc(monthLabel(m)) + '</b><span>' + g.running.length + '</span></div>' +
      '<details class="ms-all"><summary>Show the list</summary>' + g.running.map(p => admSetupRow(p, "")).join("") + '</details></section>' +
    '<label class="ms-ok"><input type="checkbox" name="checked"> I checked the class days, the new classes and the students who left</label>' +
  '</div>';
  openModal({ title: "Set up " + monthLabel(m), wide: true, submitText: "Set up " + monthLabel(m), noFocus: true, body: body,
    onSubmit: function(d){
      if (!d.checked) { toast("Tick the box after checking the classes", "warn"); return false; }
      admSetReady(m); ADM_SETUP = "";
      if (m !== State.month) Actions["ax-setmonth"](m); else render();
      toast(monthLabel(m) + " is set up", "ok");
    } });
}
Object.assign(Actions, {
  "adm-msetup": (m) => admMonthSetup(m),
  "adm-mskip": (m) => { attPref("monthSkip_" + m, 1); render(); },
  "adm-msedit": (planId) => { admProfile(planId); },
  "adm-msback": () => { const m = ADM_SETUP; if (m) admMonthSetup(m); }
});
/* the profile opened from the month set-up has a way back */
const _admProfile6 = admProfile;
admProfile = function(planId){
  _admProfile6(planId);
  if (ADM_SETUP) {
    const ft = document.querySelector("#mForm .modal-ft");
    if (ft && !ft.querySelector("[data-act=adm-msback]")) ft.insertAdjacentHTML("afterbegin", '<button type="button" class="btn" data-act="adm-msback">← Back to ' + esc(monthLabel(ADM_SETUP)) + ' set-up</button>');
  }
};
Actions["att-row"] = function(planId){ ADM_SETUP = ""; admProfile(planId); };

/* ---- Class days tab: one row per student, the full class edit inside ---- */
let ADM_DOPEN = "";
attDays = function(){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim(), t0 = today(), P = admPP();
  const all = DataService.getPlans().filter(p => DataService.getStudent(p.studentId)).filter(function(p){
    if (f.teacher && p.teacherId !== f.teacher) return false;
    if (f.onlyNoDays && !attNoDays(p)) return false;
    const st = DataService.getStudent(p.studentId) || {}, t = DataService.getTeacher(p.teacherId) || {};
    return !q || (st.name + " " + p.studentId + " " + (t.name || "") + " " + (p.course || "")).toLowerCase().indexOf(q) >= 0;
  });
  const running = all.filter(p => p.endDate ? p.endDate >= t0 : p.status === "Active");
  const left = all.filter(p => running.indexOf(p) < 0 && (!p.endDate || p.endDate >= addMonths(currentMonth(), -1) + "-01"));
  const nm = p => String((DataService.getStudent(p.studentId) || {}).name || "");
  running.sort((a, b) => (attNoDays(b) ? 1 : 0) - (attNoDays(a) ? 1 : 0) || String(a.time || "99").localeCompare(String(b.time || "99")) || nm(a).localeCompare(nm(b)));
  const row = function(p){
    const st = DataService.getStudent(p.studentId) || {}, t = DataService.getTeacher(p.teacherId) || {}, ps = admPlanState(p), open = ADM_DOPEN === p.id;
    const chips = ATT_WEEK.map(d => '<i class="' + ((p.days || []).indexOf(d) >= 0 ? "on" : "") + '">' + d.slice(0, 1) + '</i>').join("");
    let h = '<div class="cd' + (open ? " open" : "") + (attNoDays(p) ? " nodays" : "") + ' st-' + ps.k + '">' +
      '<button type="button" class="cd-h" data-act="adm-dopen" data-id="' + esc(p.id) + '" aria-expanded="' + open + '">' +
        '<span class="cd-av">' + esc(admIni(st.name)) + '</span>' +
        '<span class="cd-t"><b>' + esc(st.name || p.studentId) + '</b><small>' + esc([t.name || "No teacher", p.course].filter(Boolean).join(" · ")) + '</small></span>' +
        '<span class="cd-r"><span class="cd-days">' + chips + '</span><small>' + esc(p.time ? time12(p.time) : "no time") + '</small></span>' +
        (ps.k !== "active" ? '<span class="cd-st">' + esc(ps.k === "stopped" ? "Left" : ps.k === "stopping" ? "Last " + fmtDate(p.endDate) : ps.k === "paused" ? "Paused" : ps.k === "pausing" ? "Pause soon" : "Starts " + fmtDate(p.startDate)) + '</span>' : "") +
      '</button>';
    if (open) {
      const ro = ps.k === "stopped";
      h += '<div class="cd-b">' +
        '<div class="cd-f"><label>Class days</label><div class="ax-wk">' + ATT_WEEK.map(d => '<button type="button" class="ax-dayb' + ((p.days || []).indexOf(d) >= 0 ? " on" : "") + '" data-act="ax-pday" data-id="' + esc(p.id) + '" data-day="' + d + '" aria-pressed="' + ((p.days || []).indexOf(d) >= 0) + '"' + (ro ? " disabled" : "") + '>' + d.slice(0, 2) + '</button>').join("") + '</div></div>' +
        '<div class="cd-grid">' +
          '<div class="cd-f"><label>Time (IST)</label><input class="input" type="time" data-act="ax-ptime" data-id="' + esc(p.id) + '" value="' + esc(p.time || "") + '"' + (ro ? " disabled" : "") + '></div>' +
          '<div class="cd-f"><label>Minutes</label><input class="input" type="number" min="0" data-act="ax-pmin" data-id="' + esc(p.id) + '" value="' + esc(p.duration || "") + '" placeholder="45"' + (ro ? " disabled" : "") + '></div>' +
          '<div class="cd-f"><label>Start date</label><input class="input" type="date" data-act="ax-pstart" data-id="' + esc(p.id) + '" value="' + esc(p.startDate || "") + '"' + (ro ? " disabled" : "") + '></div>' +
        '</div>' +
        '<div class="cd-meta">' + esc(ps.label) + (p.endDate && p.stopReason ? " · " + esc(p.stopReason) : "") + '</div>' +
        '<div class="cd-acts">' +
          (ro ? "" : '<button type="button" class="btn btn-sm" data-act="adm-edit-plan" data-id="' + esc(p.id) + '">Teacher / course</button>') +
          (ps.k === "paused" || ps.k === "pausing" ? '<button type="button" class="btn btn-sm" data-act="adm-restart" data-id="' + esc(p.id) + '">Restart / change pause</button>'
            : ro || ps.k === "stopping" ? "" : '<button type="button" class="btn btn-sm" data-act="adm-pause" data-id="' + esc(p.id) + '">Pause</button>') +
          (ro || ps.k === "stopping" ? '<button type="button" class="btn btn-sm" data-act="adm-unstop" data-id="' + esc(p.id) + '">Undo stop</button>'
            : '<button type="button" class="btn btn-sm btn-danger" data-act="adm-stop-plan" data-id="' + esc(p.id) + '">Stop (left)</button>') +
          '<button type="button" class="btn btn-sm" data-act="att-row" data-id="' + esc(p.id) + '">Profile</button>' +
        '</div></div>';
    }
    return h + '</div>';
  };
  const noDays = running.filter(attNoDays).length;
  let h = '<div class="ax-h">Class days</div><div class="ax-sub">' + (noDays ? '<b>' + noDays + '</b> class' + (noDays > 1 ? "es have" : " has") + ' no class days — first in the list. ' : "") +
    'Tap a student to change days, time, minutes, start, teacher, pause or stop. Changes save as you go.</div>';
  if (!running.length && !left.length) return '<div class="ax-scroll pad" id="axScroll">' + h + '<div class="ax-empty"><h2>No classes match</h2><p>Clear the search or the teacher.</p></div></div>';
  h += '<div class="cd-list">' + running.map(row).join("") + '</div>';
  if (left.length) h += '<div class="cd-sub">Left recently · ' + left.length + '</div><div class="cd-list">' + left.map(row).join("") + '</div>';
  return '<div class="ax-scroll pad" id="axScroll">' + h + '</div>';
};
Actions["adm-dopen"] = (planId) => { ADM_DOPEN = ADM_DOPEN === planId ? "" : planId; render(); };
/* the Undo bar steps aside when a window opens */
const _admOpenModal6 = openModal;
openModal = function(o){ const ub = $("#admUndo"); if (ub) ub.classList.remove("show"); return _admOpenModal6(o); };
