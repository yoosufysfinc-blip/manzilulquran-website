"use strict";
/* Academic Service — att-admin.v1.js. The class-admin link (/portal/attendance/#k=TOKEN).
   Loaded only by portal/attendance/index.html, after core.v7 (window.MQ_ADMIN = true), logic, ui, forms-actions and ws-attendance.v2.
   · the link's token must match an active entry in Settings().attAdminLinks (made in Academic Service → Attendance → Admin links)
   · admins mark attendance, add students / teachers / classes, and change class details — never fees, pay rules or settings
   · everything an admin adds or changes is flagged reviewed:false with a history entry, for the office review list
   · new students, teachers and plans take their number from the database (Supa.claimNew in core.v7) */

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
  if (!ADM.token || !l || !l.active) { admBlock(!ADM.token ? "This page opens only from your attendance link." :
    (l ? "This link is switched off. Ask the office for a new link." : "This link is not valid. Ask the office for your attendance link.")); ADM.ok = false; return false; }
  window.ATT_ACTOR = { name: l.name, via: "admin-link" };
  ADM.ok = true;
  const who = $("#admWho"); if (who) who.textContent = l.name;
  const b = $("#admBlock"); if (b) b.remove();
  return true;
}
function admBlock(msg){
  let b = $("#admBlock");
  if (!b) { b = document.createElement("div"); b.id = "admBlock"; b.className = "adm-block"; document.body.appendChild(b); }
  b.innerHTML = '<div class="box"><h2>Attendance</h2><p>' + esc(msg) + '</p></div>';
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
      (kind === "student" ? '<button type="button" class="btn btn-sm btn-primary" data-act="adm-use" data-id="' + esc(m.rec.id) + '">Use this student</button>' : "") + '</div>').join("") +
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
          phone: String(d.phone || "").trim(), gender: d.gender || "", joiningDate: d.joiningDate || today(), notes: String(d.notes || "").trim(),
          status: "Active", addedBy: (window.ATT_ACTOR || {}).name || "Admin", addedVia: "admin-link", addedAt: new Date().toISOString() };
        admStamp(rec, "added student", {});
        const id = DataService.saveStudent(rec);
        toast(name + " added (" + id + ")", "ok");
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
          gender: d.gender || cur.gender || "", notes: String(d.notes || "").trim() });
        const ch = admDiff(cur, next, ["name", "guardian", "whatsapp", "phone", "gender", "notes"]);
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
window.addEventListener("online", () => { if (typeof SupaTrack !== "undefined") SupaTrack.schedule(); if (Supa.retryClaims) Supa.retryClaims(); attPull(true); });

/* ---- start ---- */
async function admInit(){
  bootData();
  ADM.token = admToken();
  const months = allMonths();
  State.month = currentMonth();
  if (months.indexOf(State.month) < 0) State.month = months[months.length - 1];
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  $("#globalMonth").addEventListener("change", function(){ State.month = this.value; State.iatt.sel = null; resetLists(); render(); });
  switchWS("ind");
  const cachedOk = (Settings().attAdminLinks || []).some(l => l && l.token === ADM.token && l.active);
  if (cachedOk) attAdminCheck(); else admBlock(ADM.token ? "Opening your attendance sheet…" : "This page opens only from your attendance link.");
  if (!ADM.token) return;
  if (typeof Supa === "undefined" || !Supa.on()) { if (!cachedOk) admBlock("Cannot reach the academy records. Check the internet and reload."); return; }
  Supa.init();
  const r = await Supa.pullAll();
  if (!r.ok) {
    if (cachedOk) toast("Offline — showing the copy saved on this phone. Marks will send when you are back online.", "warn", 7000);
    else admBlock("Cannot reach the academy records. Check the internet and reload.");
    return;
  }
  if (!attAdminCheck()) { DB.students = []; DB.teachers = []; DB.plans = []; DB.classes = []; Storage.save(DB); return; }
  const m2 = allMonths();
  if (m2.indexOf(State.month) < 0) State.month = m2[m2.length - 1];
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  ATT_LIVE.at = Date.now();
  resetLists(); render(); admPaintState();
}
