"use strict";
/* Academic Service — forms-actions.v22.js. v22 (simple mode): a short New student form that can arrange the class at the
   same time (individual or batch) — or leave it Pending; the teacher of a class is optional; one fixed monthly fee per
   class; the Due date page actions (Mark paid, Share fee with an editable amount, Edit amount, Mark as not paid, Waive);
   salary typed in by hand (Add salary). Removed: fee methods, admission fees, teacher pay rules, payroll, Pay all,
   bonus / deduction, salary report, reconcile, stop-a-class and teacher-change dialogs.
   (v21: plan open/new/edit/delete, teacher profile, Remove for mistaken entries.) */
/* ==========================================================================
   FORMS
   ========================================================================== */
/* the class days as small toggles, close together (still named day_Mon … so readDays works) */
function dayBoxes(days){
  days = days || [];
  return '<div class="daychips">' + ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d =>
    '<label class="dchip"><input type="checkbox" name="day_' + d + '"' + (days.indexOf(d) >= 0 ? " checked" : "") + '><span>' + d + '</span></label>').join("") + '</div>';
}
function readDays(form){ return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].filter(d => form.elements["day_" + d] && form.elements["day_" + d].checked); }
function dayOf(date){ return Math.min(28, Math.max(1, parseInt(String(date || today()).slice(8, 10), 10) || 1)); }

function ccOptions(sel){
  const list = [["91","🇮🇳 +91"],["971","🇦🇪 +971"],["966","🇸🇦 +966"],["974","🇶🇦 +974"],["965","🇰🇼 +965"],
    ["968","🇴🇲 +968"],["973","🇧🇭 +973"],["1","🇺🇸 +1"],["44","🇬🇧 +44"],["60","🇲🇾 +60"],["65","🇸🇬 +65"],
    ["61","🇦🇺 +61"],["49","🇩🇪 +49"],["33","🇫🇷 +33"],["92","🇵🇰 +92"],["880","🇧🇩 +880"],["94","🇱🇰 +94"],["353","🇮🇪 +353"]];
  if (sel && !list.some(c => c[0] === String(sel))) list.push([String(sel), "+" + sel]);
  return list.map(c => '<option value="' + c[0] + '"' + (String(sel) === c[0] ? " selected" : "") + '>' + c[1] + '</option>').join("");
}
/* A stored number carries its country code ("971507867080"). Split it back for the form,
   so saving does not glue the default code on the front ("91971…"). Local 10-digit numbers are left alone. */
const WA_CODES = ["971","966","974","965","968","973","880","353","91","44","60","65","61","49","33","92","94","1"];
function splitWA(num, cc){
  const d = String(num || "").replace(/[^0-9]/g, "");
  if (cc) { cc = String(cc); return { cc: cc, num: d.indexOf(cc) === 0 && d.length > 10 ? d.slice(cc.length) : d }; }
  if (d.length >= 11) { const c = WA_CODES.find(x => d.indexOf(x) === 0 && d.length - x.length >= 7); if (c) return { cc: c, num: d.slice(c.length) }; }
  return { cc: Settings().countryCode || "91", num: d };
}
/* v22: a short form — the few things needed to start, close together. The rest is under "More details". */
function studentForm(s, isNew){
  s = s || {};
  const set = Settings(), wa = splitWA(s.whatsapp, s.whatsappCC), join = s.joiningDate || today();
  const more = !!(s.phone || s.email || s.dob || s.address || s.notes);
  return '<div class="form-grid sf">' +
    field("Student name *", '<input class="input" name="name" required value="' + esc(s.name || "") + '" autocomplete="off">', "sf-wide") +
    field("WhatsApp", '<div class="ccrow"><select class="input ccsel" name="whatsappCC">' + ccOptions(wa.cc) + '</select>' +
      '<input class="input mono" name="whatsapp" inputmode="tel" value="' + esc(wa.num) + '" placeholder="Number" style="flex:1"></div>', "sf-wide") +
    field("Parent / guardian", '<input class="input" name="guardian" value="' + esc(s.guardian || "") + '">') +
    field("Gender", sel("gender", optList(["Male", "Female"], s.gender, "—"))) +
    field("Joining date", '<input class="input" type="date" name="joiningDate" value="' + esc(join) + '"' + (isNew ? ' data-act="sf-join"' : "") + '>') +
    (isNew ? "" : field("Status", sel("status", optList(set.studentStatuses, s.status || "Active")))) +
  '</div>' +
  (isNew ? classPicker(join) : "") +
  '<details class="sf-more"' + (more ? " open" : "") + '><summary>More details</summary><div class="form-grid sf">' +
    field("Phone", '<input class="input mono" name="phone" inputmode="tel" value="' + esc(s.phone || "") + '">') +
    field("Email", '<input class="input" name="email" type="email" value="' + esc(s.email || "") + '">') +
    field("Date of birth", '<input class="input" type="date" name="dob" value="' + esc(s.dob || "") + '">') +
    field("Address", '<input class="input" name="address" value="' + esc(s.address || "") + '">') +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(s.notes || "") + '"></div>' +
  '</div></details>' +
  (!isNew && (s.status || "Active") === "Active" ? '<p class="hint sf-hint">Setting the status to Left, Inactive or Completed also stops the student\'s classes.</p>' : "");
}
/* arrange the class while adding the student — or leave it for later (the class shows as Pending) */
function classPicker(join){
  const seg = (v, l, on) => '<label class="seg-o"><input type="radio" name="clsMode" value="' + v + '" data-act="cls-mode"' + (on ? " checked" : "") + '><span>' + l + '</span></label>';
  return '<div class="cls-box">' +
    '<div class="cls-hd"><span class="cls-l">Class</span><div class="seg" role="radiogroup" aria-label="Class">' +
      seg("none", "Arrange later", true) + seg("ind", "Individual") + seg("batch", "Batch") + '</div></div>' +
    '<div class="cls-sec" data-cls="none"><p class="hint" style="margin:0">Saved with the class marked <b>Pending</b> — arrange it any time from the student\'s profile.</p></div>' +
    '<div class="cls-sec" data-cls="ind" hidden><div class="form-grid sf">' +
      field("Course *", sel("course", courseOpts("", "Select course"))) +
      pickBox("Teacher (optional)", "teacherId", "", pickTeachers(), "Type a name — or leave empty") +
      '<div class="field span2"><label>Class days</label>' + dayBoxes([]) + '</div>' +
      field("Time", '<input class="input" type="time" name="time" value="">') +
      field("Minutes", '<input class="input" type="number" name="duration" min="0" value="30">') +
      field("Monthly fee *", '<input class="input amt" type="number" name="rate" min="0" step="1" inputmode="numeric" placeholder="₹">') +
      field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + dayOf(join) + '">') +
    '</div></div>' +
    '<div class="cls-sec" data-cls="batch" hidden><div class="form-grid sf">' +
      field("Batch *", sel("batchId", batchOpts("", "Select batch", true), 'data-act="sf-batch"'), "sf-wide") +
      field("Monthly fee", '<input class="input amt" type="number" name="monthlyFee" min="0" step="1" inputmode="numeric" placeholder="Batch fee">') +
      field("Due day", '<input class="input" type="number" name="bDueDay" min="1" max="28" value="' + dayOf(join) + '">') +
    '</div></div>' +
    '<label class="sf-check cls-first" hidden><input type="checkbox" name="firstFee" checked> Put the first fee on the due list now</label>' +
  '</div>';
}
function formatOpts(stream, selId){
  const fmts = (Settings().courseFormats || []).filter(f => !stream || f.stream === stream);
  return '<option value="">Custom (enter manually)</option>' +
    fmts.map(f => '<option value="' + esc(f.id) + '"' + (selId === f.id ? " selected" : "") + '>' +
      esc(f.name) + " · " + money(f.monthlyFee) + "/mo</option>").join("");
}
function formatDataAttr(){
  /* expose formats to the browser so the picker can auto-fill */
  return (Settings().courseFormats || []).map(f => f.id + "|" + f.course + "|" + f.days + "|" + f.monthlyFee).join(";;");
}
function batchForm(b){
  b = b || {};
  return '<div class="form-grid">' +
    field("Batch ID", '<input class="input mono" name="id" value="' + esc(b.id || "") + '" readonly placeholder="Generated automatically">') +
    field("Batch name", '<input class="input" name="name" required value="' + esc(b.name || "") + '">') +
    field("Use a course format", '<select class="select" data-act="apply-format" data-formats="' + esc(formatDataAttr()) + '">' + formatOpts("batch", "") + '</select>') +
    field("Course", sel("course", courseOpts(b.course, "Select course"))) +
    field("Level", sel("level", optList(Settings().levels, b.level, "Select level"))) +
    field("Teacher (optional)", sel("teacherId", teacherOpts(b.teacherId, "No teacher yet"))) +
    field("Status", sel("status", optList(Settings().batchStatuses, b.status || "Active"))) +
    '<div class="field span2"><label>Class days</label><div>' + dayBoxes(b.days) + '</div></div>' +
    field("Start time", '<input class="input" type="time" name="startTime" value="' + esc(b.startTime || "") + '">') +
    field("End time", '<input class="input" type="time" name="endTime" value="' + esc(b.endTime || "") + '">') +
    field("Class duration (min)", '<input class="input" type="number" name="duration" min="0" value="' + esc(b.duration || 60) + '">') +
    field("Maximum students", '<input class="input" type="number" name="maxStudents" min="1" value="' + esc(b.maxStudents || 15) + '">') +
    field("Monthly fee", '<input class="input" type="number" name="monthlyFee" min="0" value="' + esc(b.monthlyFee || 0) + '">') +
    field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(b.startDate || today()) + '">') +
    field("End date", '<input class="input" type="date" name="endDate" value="' + esc(b.endDate || "") + '">') +
    '<div class="field span2"><label>Notes</label><textarea class="textarea" name="notes">' + esc(b.notes || "") + '</textarea></div>' +
  '</div>';
}
/* ---- type-to-find box ----
   A dropdown with 105 students is hopeless on a phone. This is a text box with the full
   list behind it: type a few letters of the name or the ID and pick from the suggestions. */
function pickBox(label, name, value, rows, placeholder){
  const cur = rows.find(r => r.id === value);
  return '<div class="field pickwrap" data-pick-for="' + name + '">' +
    '<label>' + esc(label) + '</label>' +
    '<input type="hidden" name="' + name + '" value="' + esc(value || "") + '">' +
    '<input class="input" name="' + name + '_q" value="' + (cur ? esc(cur.name) : esc(value || "")) + '" ' +
      'placeholder="' + esc(placeholder || "Type a few letters") + '" autocomplete="off" autocorrect="off" spellcheck="false" ' +
      'data-act="pick-type" data-id="' + name + '">' +
    '<div class="pickmenu" data-pick-menu="' + name + '" hidden></div>' +
    '<span class="hint" data-pick="' + name + '">' + (cur ? esc(cur.name) + " · " + esc(cur.id) : "Type a few letters of the name or the ID") + '</span></div>';
}
/* the list under the box: whatever matches what has been typed so far */
function pickRows(name){
  return name === "teacherId" ? pickTeachers() : name === "payeeId" ? pickPayees() : pickStudents();
}
function pickExtra(name, r){
  if (name === "payeeId") return r.kind === "staff" ? (r.role || "Staff") : "Teacher";
  if (name === "teacherId") return (r.status || "Active") === "Active" ? "" : "inactive";
  const pl = DataService.getPlans({ studentId: r.id }).filter(p => p.status === "Active")[0];
  return pl ? (pl.course || "") : (r.status === "Active" ? "no class plan" : "inactive");
}
function pickRender(name, q){
  const menu = document.querySelector('[data-pick-menu="' + name + '"]');
  if (!menu) return;
  const s = String(q || "").trim().toLowerCase();
  let rows = pickRows(name);
  if (s) {
    const starts = rows.filter(r => String(r.name).toLowerCase().indexOf(s) === 0 || String(r.id).toLowerCase().indexOf(s) === 0);
    const has = rows.filter(r => starts.indexOf(r) < 0 &&
      (String(r.name).toLowerCase().indexOf(s) >= 0 || String(r.id).toLowerCase().indexOf(s) >= 0));
    rows = starts.concat(has);
  }
  const shown = rows.slice(0, 12);
  menu.innerHTML = shown.length
    ? shown.map(r => '<button type="button" class="pickitem" data-act="pick-choose" data-id="' + esc(r.id) + '" data-for="' + name + '">' +
        '<b>' + esc(r.name) + '</b><span>' + esc(r.id) + (pickExtra(name, r) ? " · " + esc(pickExtra(name, r)) : "") + '</span></button>').join("") +
      (rows.length > shown.length ? '<div class="pickmore">' + (rows.length - shown.length) + ' more — keep typing</div>' : "")
    : '<div class="pickmore">Nobody matches “' + esc(q) + '”</div>';
  menu.hidden = false;
}
function pickStudents(){ return DataService.getStudents().slice().sort((a, b) => String(a.name).localeCompare(String(b.name))); }
function pickTeachers(){ return DataService.getTeachers().filter(t => t.kind !== "staff").slice().sort((a, b) => String(a.name).localeCompare(String(b.name))); }
function pickPayees(){ return DataService.getTeachers().slice().sort((a, b) => ((a.status || "Active") === "Active" ? 0 : 1) - ((b.status || "Active") === "Active" ? 0 : 1) || String(a.name).localeCompare(String(b.name))); }

function planUsed(id){
  return DB.fees.some(f => f.planId === id) || DB.classes.some(c => c.planId === id);
}
/* v22: one fixed monthly fee; the teacher can be left empty (the class is then marked "No teacher") */
function planForm(p, presetStudent){
  p = p || {};
  const set = Settings(), sid = p.studentId || presetStudent || "", st = sid ? DataService.getStudent(sid) : null;
  const have = !p.id && sid ? DataService.getPlans({ studentId: sid }).filter(x => x.status === "Active") : [];
  return (have.length ? '<div class="note" style="border-color:#e0b25a"><b>Already has ' + (have.length > 1 ? have.length + " active classes" : "an active class") + '.</b> ' +
      'To change the fee, teacher or days, or to stop it, edit that class — a new one is only for a second, separate class.' +
      '<div class="btn-row" style="margin-top:8px">' + have.map(x => '<button type="button" class="btn btn-sm btn-primary" data-act="plan-edit" data-id="' + esc(x.id) + '">Edit ' +
        esc((x.course || "class") + " · " + x.id) + '</button>').join("") + '</div></div>' : "") +
    '<div class="form-grid sf">' +
    (p.id ? field("Student", '<input class="input" value="' + esc(st ? st.name + " · " + st.id : sid) + '" readonly>', "sf-wide") +
            '<input type="hidden" name="studentId" value="' + esc(sid) + '">'
          : pickBox("Student *", "studentId", sid, pickStudents(), "Type a student name or ID")) +
    (p.id ? "" : field("Course format", '<select class="select" data-act="apply-format" data-formats="' + esc(formatDataAttr()) + '">' + formatOpts("individual", "") + '</select>')) +
    field("Course *", sel("course", courseOpts(p.course, "Select course"))) +
    pickBox("Teacher (optional)", "teacherId", p.teacherId || "", pickTeachers(), "Type a name — or leave empty") +
    '<div class="field span2"><label>Class days</label>' + dayBoxes(p.days) + '</div>' +
    field("Time", '<input class="input" type="time" name="time" value="' + esc(p.time || "") + '">') +
    field("Minutes", '<input class="input" type="number" name="duration" min="0" value="' + esc(p.duration || 30) + '">') +
    field("Monthly fee *", '<input class="input amt" type="number" name="rate" min="0" step="1" inputmode="numeric" value="' + esc(+p.rate ? p.rate : "") + '" placeholder="₹">') +
    field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + esc(p.dueDay || dayOf(p.startDate)) + '">') +
    field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(p.startDate || today()) + '">') +
    (p.id ? field("Status", sel("status", optList(["Active", "Stopped"], p.status || "Active"))) : "") +
    (p.id ? field("End date", '<input class="input" type="date" name="endDate" value="' + esc(p.endDate || "") + '">') : "") +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(p.notes || "") + '"></div>' +
    (p.id ? "" : '<label class="sf-check span2"><input type="checkbox" name="firstFee" checked> Put the first fee on the due list now</label>') +
    (p.id && !planUsed(p.id) ? '<div class="field span2"><div class="btn-row"><button type="button" class="btn btn-sm btn-danger" data-act="plan-del" data-id="' +
      esc(p.id) + '">Delete this class</button><span class="hint">It has no fees or attendance, so it can be removed completely.</span></div></div>' : "") +
  '</div>';
}
function classForm(c, presetPlan, presetStudent){
  c = c || {};
  const planId = c.planId || presetPlan || "";
  const pl = planId ? DataService.getPlan(planId) : (presetStudent ? DataService.getActivePlan(presetStudent) : null);
  const plans = DataService.getPlans().map(function(p){
    const s = DataService.getStudent(p.studentId);
    return { value: p.id, label: (s ? s.name : p.studentId) + " · " + p.course + (p.status !== "Active" ? " (stopped)" : "") };
  });
  return '<div class="form-grid">' +
    field("Date", '<input class="input" type="date" name="date" value="' + esc(c.date || today()) + '" required>') +
    field("Class plan", sel("planId", optList(plans, pl ? pl.id : "", "Select the student's plan"), 'data-act="class-plan"')) +
    field("Teacher", sel("teacherId", teacherOpts(c.teacherId || (pl ? pl.teacherId : ""), "Select teacher"))) +
    field("Duration (min)", '<input class="input" type="number" name="duration" min="0" value="' +
      esc(c.duration !== undefined ? c.duration : (pl ? pl.duration : 45)) + '">') +
    field("Class status", sel("status", optList(CLASS_STATUSES.map(x => ({ value: x.value, label: x.code + "  " + x.label })), c.status || "Completed"))) +
    field("Taken by (substitute only)", sel("takenBy", teacherOpts(c.takenBy || "", "—"))) +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(c.notes || "") + '"></div>' +
    '<div class="field span2"><div class="note" style="margin:0">A mark is a record of what happened. It does not change any fee or salary.</div></div>' +
  '</div>';
}
/* v22: no pay rules — salary is typed in under Money → Teacher salary */
function teacherForm(t){
  t = t || {};
  const wa = splitWA(t.whatsapp, t.whatsappCC), staff = t.kind === "staff";
  return '<div class="form-grid sf">' +
    field("Name *", '<input class="input" name="name" required value="' + esc(t.name || "") + '">', "sf-wide") +
    field("WhatsApp", '<div class="ccrow"><select class="input ccsel" name="whatsappCC">' + ccOptions(wa.cc) + '</select>' +
      '<input class="input mono" name="whatsapp" inputmode="tel" value="' + esc(wa.num) + '" placeholder="Number" style="flex:1"></div>', "sf-wide") +
    field("Phone", '<input class="input mono" name="phone" inputmode="tel" value="' + esc(t.phone || "") + '">') +
    field("Joining date", '<input class="input" type="date" name="joiningDate" value="' + esc(t.joiningDate || today()) + '">') +
    field("Kind", sel("kind", optList([{ value: "teacher", label: "Teacher" }, { value: "staff", label: "Other staff" }], t.kind || "teacher"), 'data-act="kind-toggle"')) +
    '<div class="field staff-only"' + (staff ? "" : ' style="display:none"') + '><label>Role</label><input class="input" name="role" list="roleList" value="' + esc(t.role || "") + '" placeholder="Admin, Counsellor, Editor…"></div>' +
    '<datalist id="roleList"><option>Admin</option><option>Counsellor</option><option>Editor</option><option>Digital Marketer</option><option>Coordinator</option><option>Accountant</option><option>Receptionist</option><option>Support</option></datalist>' +
    field("Salary paid into", sel("payAccount", accountOpts(t.payAccount || "Bank"))) +
    field("Status", sel("status", optList(["Active", "Inactive"], t.status || "Active"))) +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(t.notes || "") + '"></div>' +
  '</div>';
}
function incomeForm(x){
  x = x || {};
  return '<div class="form-grid">' +
    field("Date", '<input class="input" type="date" name="date" value="' + esc(x.date || today()) + '" required>') +
    field("Category", sel("category", optList(Settings().incomeCategories.filter(c => c.indexOf("Class Fee") < 0), x.category || "Other Income"))) +
    '<div class="field span2"><label>Description</label><input class="input" name="description" value="' + esc(x.description || "") + '" placeholder="What was this for?"></div>' +
    field("Source / student", '<input class="input" name="source" value="' + esc(x.source || "") + '">') +
    field("Amount", '<input class="input amt" type="number" name="amount" min="0" step="0.01" value="' + esc(x.amount || "") + '" required>') +
    field("Received in", sel("account", accountOpts(x.account || "UPI"))) +
    field("Reference", '<input class="input mono" name="reference" value="' + esc(x.reference || "") + '">') +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(x.notes || "") + '"></div>' +
    '<div class="field span2"><div class="note" style="margin:0">Class fees are recorded as payments, not here — that keeps every rupee counted exactly once.</div></div>' +
  '</div>';
}
function expenseForm(x){
  x = x || {};
  return '<div class="form-grid">' +
    field("Date", '<input class="input" type="date" name="date" value="' + esc(x.date || today()) + '" required>') +
    field("Category", sel("category", optList(Settings().expenseCategories, x.category || "Office Expense"))) +
    '<div class="field span2"><label>Description</label><input class="input" name="description" value="' + esc(x.description || "") + '"></div>' +
    field("Paid to", '<input class="input" name="payee" value="' + esc(x.payee || "") + '">') +
    field("Amount", '<input class="input amt" type="number" name="amount" min="0" step="0.01" value="' + esc(x.amount || "") + '" required>') +
    field("Paid from", sel("account", accountOpts(x.account || "Cash"))) +
    field("Reference", '<input class="input mono" name="reference" value="' + esc(x.reference || "") + '">') +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(x.notes || "") + '"></div>' +
  '</div>';
}
function feeOptionsFor(studentId, selectedId){
  const list = Logic.feeViews({ studentId: studentId }).map(withBasis).sort((a, b) => a.month < b.month ? 1 : -1);
  if (!list.length) return '<option value="">No fee months calculated yet</option>';
  const open = list.filter(v => v.balance > 0), done = list.filter(v => v.balance <= 0);
  /* the oldest unpaid month is picked for you — that is nearly always the one being paid */
  const pick = selectedId || (open.length ? open[open.length - 1].id : "");
  const opt = v => '<option value="' + v.id + '" data-bal="' + v.balance + '"' + (v.id === pick ? " selected" : "") + '>' +
    esc((v.source === "batch" ? "Batch" : "Individual") + " · " + monthLabel(v.month) +
      (v.balance > 0 ? " — balance " + money(v.balance) : " — " + v.status)) + '</option>';
  return (pick ? "" : '<option value="">Select the fee month</option>') +
    (open.length ? '<optgroup label="Open">' + open.map(opt).join("") + '</optgroup>' : "") +
    (done.length ? '<optgroup label="Settled">' + done.map(opt).join("") + '</optgroup>' : "");
}

/* ==========================================================================
   ACTIONS
   ========================================================================== */
function setPath(path, value){
  const p = path.split(".");
  if (p.length === 1) State[p[0]] = value; else { if (!State[p[0]]) State[p[0]] = {}; State[p[0]][p[1]] = value; }
}
function resetLists(){ UI.limit = {}; }
function applyFset(el){
  const path = el.dataset.fset;
  setPath(path, el.value);
  if (path.indexOf("att.") === 0) State.att.marks = null;
  if (path === "att.batchId") State.att.subClassId = "";
  resetLists();
  State._focus = (el.tagName === "INPUT" && el.type !== "date") ? path : null;
  render();
}
function restoreFocus(){
  if (!State._focus) return;
  const el = $('[data-fset="' + State._focus + '"]');
  if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} }
  State._focus = null;
}
document.addEventListener("input", function(e){
  const p = e.target.closest('[data-act="pick-type"]');
  if (p) { Actions["pick-type"](p.dataset.id, p); return; }
  const f = e.target.closest("[data-fset]");
  if (f && f.tagName === "INPUT") { applyFset(f); return; }
  const g = e.target.closest('[data-act="gsearch"]');
  if (g) { Actions["gsearch"](null, g); return; }
  const r = e.target.closest('[data-act="att-remark"]');
  if (r) {
    State.att.marks[r.dataset.id] = State.att.marks[r.dataset.id] || { status: "", remarks: "" };
    State.att.marks[r.dataset.id].remarks = r.value;
  }
});
document.addEventListener("change", function(e){
  const f = e.target.closest("[data-fset]");
  if (f && f.tagName === "SELECT") { applyFset(f); return; }
  const a = e.target.closest("[data-act]");
  if (a && (a.tagName === "SELECT" || a.tagName === "INPUT")) { const A = Actions[a.dataset.act]; if (A) A(a.dataset.id, a); }
});
/* opening the box shows the list straight away; tapping elsewhere closes it */
document.addEventListener("focusin", function(e){
  const p = e.target.closest('[data-act="pick-type"]');
  if (p) { p._q = null; Actions["pick-type"](p.dataset.id, p); }
});
document.addEventListener("click", function(e){
  if (!e.target.closest(".pickwrap")) {
    document.querySelectorAll("[data-pick-menu]").forEach(m => { m.hidden = true; });
  }
  const w = e.target.closest("[data-ws-go]");
  if (w) { switchWS(w.dataset.wsGo); return; }
  const nav = e.target.closest("#navList button");
  if (nav) { go(nav.dataset.page); return; }
  const el = e.target.closest("[data-act]");
  if (!el) return;
  if (el.tagName === "SELECT" || el.tagName === "OPTION" || el.tagName === "INPUT") return;
  const A = Actions[el.dataset.act];
  if (A) { e.preventDefault(); A(el.dataset.id, el, e); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

const Actions = {
  "modal-close": () => closeModal(),
  "print": () => window.print(),
  "goto": (id, el) => go(el.dataset.page),
  /* row list */
  "lrow": (id, el) => {
    const k = el.dataset.lid + "::" + el.dataset.k;
    UI.open[el.dataset.lid] = (UI.open[el.dataset.lid] === k) ? null : k;
    render();
  },
  "lmore": (id, el) => { const l = el.dataset.lid; UI.limit[l] = (UI.limit[l] || 25) + 25; render(); },
  /* open one row as a full page — nothing clipped, and the text can be zoomed */
  "lfull": (id, el) => {
    const lid = el.dataset.lid, k = lid + "::" + el.dataset.k;
    const row = el.closest(".lrow");
    const title = row ? (row.querySelector(".lt") || {}).textContent || "Details" : "Details";
    UI.open[lid] = k; render();
    setTimeout(function(){
      const openRow = Array.prototype.slice.call(document.querySelectorAll('.lrow[data-lid="' + lid + '"]'))
        .filter(r => r.dataset.k === el.dataset.k)[0];
      const det = openRow ? openRow.nextElementSibling : null;
      if (det && det.classList.contains("ldet")) openFullView(title.trim(), det.innerHTML);
      else toast("Could not open the full view", "bad");
    }, 30);
  },
  /* the whole list as one page: every row with its details already open */
  "lfullpage": (id, el) => {
    const lid = el.dataset.lid, L = UI.lists[lid];
    if (!L || !L.rows.length) { toast("Nothing to show here yet", "warn"); return; }
    const title = ($("#pageTitle") || {}).textContent || "All records";
    openFullView(title.trim() + " · " + L.rows.length + " records", fullListHtml(lid));
  },
  /* open / close one row inside the full page, without leaving it */
  "fv-row": (id) => {
    const item = document.getElementById("flItem" + id); if (!item) return;
    const det = item.querySelector(".fl-d"); if (!det) return;
    const open = det.hasAttribute("hidden");
    if (open) det.removeAttribute("hidden"); else det.setAttribute("hidden", "");
    item.classList.toggle("is-open", open);
    fvApply();
  },
  /* ---- void: for a payment typed in by mistake (wrong student, wrong amount, entered twice).
     Not for real money going back — that is a refund. ---- */
  "pay-void": (id) => voidDialog("payment", id),
  "tpay-void": (id) => voidDialog("teacher", id),
  "fv-zoom": (id) => fullViewZoom(id === "0" ? 0 : id === "+" ? 0.15 : -0.15),
  "fv-close": () => closeFullView(),
  "lsort": (id, el) => { UI.sort[el.dataset.lid] = el.value; render(); },
  "pf-tab": (id, el) => { State.profile.tab = el.dataset.t; render(); },
  "profile-open": (id) => { closeModal(true); State.profile.studentId = id; State.profile.tab = "fees"; go("profile"); },

  /* ---------------- students ---------------- */
  "student-assign": (id) => {
    const s = DataService.getStudent(id), cur = DataService.getActiveEnrollment(id);
    openModal({
      title: (cur ? "Move batch — " : "Put in a batch — ") + s.name,
      body: (cur ? '<div class="note">Now in ' + esc((DataService.getBatch(cur.batchId) || {}).name || cur.batchId) + ' since ' + esc(fmtDate(cur.joiningDate)) +
          '. That enrolment is closed as <b>Transferred</b> and kept; the new one starts on the date below.</div>' : "") +
        '<div class="form-grid sf">' +
        field("Batch *", sel("batchId", batchOpts(cur ? cur.batchId : "", "Select batch", true), 'data-act="enrol-batch"')) +
        '<div class="field"><label>Sub-class</label><select class="select" name="subClassId">' +
          optList(DataService.getSubclasses({ batchId: cur ? cur.batchId : "" }).map(x => ({ value: x.id, label: x.name })),
            cur ? cur.subClassId : "", "Whole batch") + '</select></div>' +
        field("From", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Monthly fee", '<input class="input amt" type="number" name="monthlyFee" min="0" step="1" placeholder="Batch fee">') +
        field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + esc(cur ? cur.dueDay : dayOf(today())) + '">') +
        (cur ? '<div class="field"><label>Reason</label><input class="input" name="reason"></div>'
             : '<label class="sf-check span2"><input type="checkbox" name="firstFee" checked> Put the first fee on the due list now</label>') + '</div>',
      submitText: "Save",
      onSubmit: function(d){
        const b = DataService.getBatch(d.batchId);
        if (!b) { toast("Choose the batch", "bad"); return false; }
        if (cur) DataService.closeEnrollment(cur.id, "Transferred", d.date, d.reason || "Batch change");
        const sc2 = d.subClassId ? DataService.getSubclass(d.subClassId) : null;
        const eid = DataService.saveEnrollment({ studentId: id, batchId: b.id, subClassId: d.subClassId || "",
          joiningDate: d.date || today(), leavingDate: "",
          monthlyFee: round2(+d.monthlyFee || (sc2 && +sc2.monthlyFee) || +b.monthlyFee || 0), dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)),
          status: "Active", reason: "", notes: cur ? ("Transferred from " + cur.batchId) : "Initial enrolment" });
        let msg = s.name + " is now in " + b.name;
        if (!cur && d.firstFee) { const fm = Logic.firstMonth(d.date || today()), r = Logic.buildBatchMonth(fm, { enrollmentId: eid, first: true, remark: "First month" });
          if (r.created) msg += " · " + monthLabel(fm) + " fee on the due list"; }
        toast(msg, "ok", 4200); render();
      }
    });
  },
  "students-csv": () => downloadCSV("students.csv",
    ["Student ID","Name","Guardian","WhatsApp","Phone","Email","Joined","Status","Class","Batch","Batch fee","Individual course","Individual fee","Teacher","Outstanding"],
    DataService.getStudents().map(function(s){
      const st = Logic.streamsOf(s.id), b = st.batch ? DataService.getBatch(st.batch.batchId) : null;
      const due = Logic.feeViews({ studentId: s.id }).reduce((a, v) => a + v.balance, 0);
      const ci = Logic.classInfo(s.id), t = st.individual ? DataService.getTeacher(st.individual.teacherId) : (b ? DataService.getTeacher(b.teacherId) : null);
      return [s.id, s.name, s.guardian, s.whatsapp, s.phone, s.email, s.joiningDate, s.status,
        (s.status || "Active") === "Active" && ci.pending ? "Pending" : "Arranged",
        b ? b.name : "", st.batch ? Logic.enrolFee(st.batch) : "", st.individual ? st.individual.course : "",
        st.individual ? st.individual.rate : "", t ? t.name : "", due];
    })),

  /* ---------------- batches + enrolment ---------------- */
  "batch-new": () => openModal({ title: "Add batch", wide: true, body: batchForm({}), submitText: "Create batch",
    onSubmit: function(d, form){
      if (!d.name) { toast("Batch name is needed", "bad"); return false; }
      d.days = readDays(form);
      ["monthlyFee","admissionFee","maxStudents","duration"].forEach(k => d[k] = +d[k] || 0);
      delete d.id;
      const id = DataService.saveBatch(d);
      toast("Batch " + id + " created", "ok"); render();
    } }),
  "batch-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: batchForm(DataService.getBatch(id)), submitText: "Save changes",
    onSubmit: function(d, form){
      d.days = readDays(form); d.id = id;
      ["monthlyFee","admissionFee","maxStudents","duration"].forEach(k => d[k] = +d[k] || 0);
      DataService.saveBatch(d); toast("Batch updated", "ok"); render();
    } }),
  "batch-toggle": (id) => {
    const b = DataService.getBatch(id), to = b.status === "Active" ? "Inactive" : "Active";
    confirmAction({ title: "Change batch status", note: "Every record is kept — students, fees and attendance stay as they are.",
      message: "Set " + b.name + " to " + to + "?",
      onConfirm: function(){ DataService.saveBatch({ id: id, status: to }); toast(b.id + " is now " + to, "ok"); render(); } });
  },
  "enrol-new": (batchId) => openModal({
    title: "New enrolment",
    body: '<div class="note">If the student is already in a batch, that enrolment is closed as Transferred — nothing is deleted.</div>' +
      '<div class="form-grid sf">' +
      pickBox("Student *", "studentId", "", pickStudents(), "Type a student name or ID") +
      field("Batch *", sel("batchId", batchOpts(batchId || "", "Select batch", true), 'data-act="enrol-batch"')) +
      '<div class="field"><label>Sub-class</label><select class="select" name="subClassId">' +
        optList(DataService.getSubclasses({ batchId: batchId || "" }).map(x => ({ value: x.id, label: x.name })), "", "Whole batch") +
        '</select></div>' +
      field("Joining date", '<input class="input" type="date" name="date" value="' + today() + '">') +
      field("Monthly fee", '<input class="input amt" type="number" name="monthlyFee" min="0" step="1" placeholder="Batch fee">') +
      field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + dayOf(today()) + '">') +
      '<label class="sf-check span2"><input type="checkbox" name="firstFee" checked> Put the first fee on the due list now</label>' +
      '</div>',
    submitText: "Create enrolment",
    onSubmit: function(d){
      const b = DataService.getBatch(d.batchId);
      if (!DataService.getStudent(d.studentId) || !b) { toast("Student and batch are needed", "bad"); return false; }
      const cur = DataService.getActiveEnrollment(d.studentId);
      if (cur) DataService.closeEnrollment(cur.id, "Transferred", d.date, "Batch change");
      const sc = d.subClassId ? DataService.getSubclass(d.subClassId) : null;
      const id = DataService.saveEnrollment({ studentId: d.studentId, batchId: b.id, subClassId: d.subClassId || "",
        joiningDate: d.date || today(), leavingDate: "", monthlyFee: round2(+d.monthlyFee || (sc && +sc.monthlyFee) || +b.monthlyFee || 0),
        dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)), status: "Active", reason: "", notes: "" });
      let msg = "Enrolment " + id + " created";
      if (d.firstFee) { const fm = Logic.firstMonth(d.date || today()), r = Logic.buildBatchMonth(fm, { enrollmentId: id, first: true, remark: "First month" });
        if (r.created) msg += " · " + monthLabel(fm) + " fee on the due list"; }
      toast(msg, "ok", 4200); celebrate("🎓"); render();
    }
  }),
  "enrol-close": (id) => {
    const e = DataService.getEnrollments().find(x => x.id === id);
    const s = DataService.getStudent(e.studentId);
    openModal({ title: "Close enrolment " + id,
      body: '<div class="note">The enrolment stays in history with the status and date you choose.</div>' +
        '<p style="margin-top:0">' + esc(s ? s.name : e.studentId) + ' · batch ' + esc(e.batchId) + '</p>' +
        '<div class="form-grid">' + field("Status", sel("status", optList(["Completed","Left","Transferred"], "Completed"))) +
        field("Leaving date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        '<div class="field span2"><label>Reason</label><input class="input" name="reason"></div></div>',
      submitText: "Close enrolment",
      onSubmit: function(d){ DataService.closeEnrollment(id, d.status, d.date, d.reason);
        toast("Enrolment closed as " + d.status, "ok"); render(); } });
  },

  /* ---------------- attendance ---------------- */
  "att-quick": () => go("attendance"),

  /* ---------------- sync ---------------- */
  "sync-panel": () => {
    const st = Sync.st, box = Sync.on() ? Sync.outbox() : { count: 0 };
    const ss = (typeof Supa !== "undefined" ? Supa.st : {}) || {};
    const when = t => t ? fmtDate(ymd(new Date(t))) + " " + pad2(new Date(t).getHours()) + ":" + pad2(new Date(t).getMinutes()) : "—";
    openModal({ title: "Saving & sync", hideSubmit: true, cancelText: "Close",
      body:
        '<div class="sub-hd">Supabase — where your records are kept</div>' +
        dl([["Status", esc(ss.kind === "err" ? "Problem" : ss.kind === "busy" ? "Working" : ss.ready ? "Connected" : "Not connected")],
            ["Last message", '<span style="word-break:break-word">' + esc(ss.msg || "—") + '</span>'],
            ["Last saved", esc(when(ss.at))],
            ["Last problem", '<span style="word-break:break-word">' + esc(ss.err || "—") + (ss.errAt ? " · " + esc(when(ss.errAt)) : "") + '</span>']]) +
        '<div class="btn-row" style="margin-bottom:14px">' +
          '<button type="button" class="btn btn-primary" data-act="supa-retry">Try saving again</button>' +
          '<button type="button" class="btn" data-act="supa-copy-err">Copy the message</button>' +
          '<button type="button" class="btn" data-act="supa-test">Test the connection</button>' +
        '</div>' +
        '<div class="sub-hd">Google Sheet — backup copy</div>' +
        (Sync.on() ? "" : '<div class="note">Sync is switched off. Add the web app URL and key in Settings, ' +
          'tick the box, and this browser will keep both spreadsheets in step.</div>') +
        dl([["Status", Sync.on() ? esc(st.status === "err" ? "Problem" : st.status === "busy" ? "Working" : "Connected") : "Off"],
            ["Last message", esc(st.msg || "—")],
            ["Waiting to be sent", box.count + " change(s)"],
            ["Last exchange", st.at ? fmtDate(ymd(new Date(st.at))) + " " +
              pad2(new Date(st.at).getHours()) + ":" + pad2(new Date(st.at).getMinutes()) : "—"],
            ["Batch sheet holds", "classes · sub-classes · enrolment · attendance"],
            ["Books sheet holds", "plans · class log · fees · payments · income · expenses · salary · accounts"]]) +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button type="button" class="btn btn-primary" data-act="sync-now">Send to the Sheet now</button>' +
          '<button type="button" class="btn" data-act="sync-test">Test the connection</button>' +
          '<button type="button" class="btn" data-act="sync-full">Push everything</button>' +
          '<button type="button" class="btn" data-act="goto" data-page="settings">Settings</button>' +
        '</div>' });
  },
  "supa-retry": async () => {
    if (typeof SupaTrack === "undefined" || !SupaTrack.base) { toast("Nothing is waiting to be saved yet", "warn"); return; }
    toast("Saving again…", "ok", 1800);
    await SupaTrack.flush();
    const ss = Supa.st;
    toast(ss.kind === "err" ? "Still failing: " + (ss.err || "") : "Saved to Supabase", ss.kind === "err" ? "bad" : "ok", 7000);
  },
  "supa-copy-err": () => {
    const ss = (typeof Supa !== "undefined" ? Supa.st : {}) || {};
    const txt = "Supabase: " + (ss.err || ss.msg || "no message");
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast("Message copied", "ok"), () => toast(txt, "warn", 9000));
    else toast(txt, "warn", 9000);
  },
  "supa-test": async () => {
    if (!Settings().supabaseUrl || !Settings().supabaseKey) { toast("Add the Supabase URL and key first, then Save", "bad"); return; }
    toast("Testing Supabase…", "ok");
    Supa.init();
    try {
      const { error } = await Supa.client.from("mq_students").select("id").limit(1);
      if (error) throw new Error(error.message);
      toast("Supabase connected \u2713", "ok");
    } catch (e) { toast("Supabase error: " + (e.message || e), "bad", 6000); }
  },
  "hold-new": (studentId) => {
    const st = DataService.getStudent(studentId);
    openModal({ title: "Hold / leave — " + (st ? st.name : studentId), body: '<div class="form-grid">' +
      '<div class="field span2"><div class="note" style="margin:0">Record a leave or hold for this student. Choose whether the fee is waived for the paused period or kept as normal.</div></div>' +
      field("From month", '<input class="input" type="month" name="from" value="' + State.month + '" required>') +
      field("To month", '<input class="input" type="month" name="to" value="' + State.month + '">') +
      '<div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px"><input type="checkbox" name="waiveFee" checked> Waive the fee for this period (uncheck to keep charging)</label></div>' +
      field("Reason", '<input class="input" name="reason" placeholder="Travel, illness, Ramadan break…">') +
    '</div>', submitText: "Save hold",
      onSubmit: function(d){
        if (!d.from) { toast("Pick a start month", "bad"); return false; }
        DataService.saveHold({ studentId: studentId, from: d.from, to: d.to || d.from, waiveFee: !!d.waiveFee, reason: d.reason || "" });
        /* if waiving, also waive any already-raised fees in that range */
        if (d.waiveFee) {
          DB.fees.filter(fe => fe.studentId === studentId && fe.month >= d.from && fe.month <= (d.to || d.from) && !fe.waived)
            .forEach(fe => DataService.saveFee({ id: fe.id, waived: true, remarks: (fe.remarks ? fe.remarks + " · " : "") + "On hold" }));
        }
        toast("Hold saved", "ok"); celebrate("⏸"); render();
      } });
  },
  "hold-del": (id) => { DataService.removeHold(id); toast("Hold removed", "ok"); render(); },
  "acad-hold-new": () => {
    openModal({ title: "Academy-wide hold", body: '<div class="form-grid">' +
      '<div class="field span2"><div class="note" style="margin:0">Pause the whole academy for a period (e.g. Ramadan break, vacation). Applies to every student.</div></div>' +
      field("From month", '<input class="input" type="month" name="from" value="' + State.month + '" required>') +
      field("To month", '<input class="input" type="month" name="to" value="' + State.month + '">') +
      '<div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px"><input type="checkbox" name="waiveFee"> Waive fees for everyone during this period</label></div>' +
      field("Reason", '<input class="input" name="reason" placeholder="Ramadan, annual break…">') +
    '</div>', submitText: "Save academy hold",
      onSubmit: function(d){
        if (!d.from) { toast("Pick a start month", "bad"); return false; }
        const list = (Settings().academyHolds || []).slice();
        list.push({ id: "AH" + Date.now().toString(36), from: d.from, to: d.to || d.from, waiveFee: !!d.waiveFee, reason: d.reason || "" });
        DataService.saveSettings({ academyHolds: list });
        toast("Academy hold saved", "ok"); render();
      } });
  },
  "acad-hold-del": (id) => {
    const list = (Settings().academyHolds || []).filter(h => h.id !== id);
    DataService.saveSettings({ academyHolds: list }); toast("Removed", "ok"); render();
  },
  "sync-now": async () => {
    if (!Sync.on()) { toast("Turn sync on in Settings first", "warn"); return; }
    await Sync.pushNow(false);
  },
  "sync-test": async () => {
    if (!Settings().apiUrl) { toast("Add the web app URL first", "bad"); return; }
    toast("Contacting the sheets…", "ok");
    try {
      const r = await Sync.jsonp({ action: "ping", key: Settings().syncKey });
      toast(r && r.ok ? "Connected — the sheets answered" : "Reached it, but it said: " + ((r && r.error) || "?"),
        r && r.ok ? "ok" : "bad", 5000);
    } catch (e) { toast("No answer: " + (e.message || e), "bad", 5000); }
  },
  "sync-full": () => confirmAction({ title: "Push everything",
    note: "Every record here is written over the matching row in the sheets. Use this the first time, or after " +
      "restoring a backup. Rows that only exist in the sheets are left alone.",
    message: "Send the whole database to both spreadsheets?", submitText: "Push everything",
    onConfirm: function(){
      Sync.st.lastPushAt = 0;
      const now = Date.now();
      SYNC_COLLS.forEach(c => (DB[c] || []).forEach(r => { if (r && r.id) r._u = now; }));
      DB._settingsU = now;
      Storage.save(DB);
      Sync.pushNow(false);
    } }),

  /* ---------------- sub-classes ---------------- */
  "sub-new": () => openModal({ title: "New sub-class", wide: true, body: subForm({}), submitText: "Create sub-class",
    onSubmit: function(d, form){
      if (!d.name || !d.batchId) { toast("Name and parent batch are needed", "bad"); return false; }
      d.days = readDays(form);
      d.capacity = +d.capacity || 0; d.monthlyFee = +d.monthlyFee || 0;
      delete d.id;
      const id = DataService.saveSubclass(d);
      toast("Sub-class " + id + " created", "ok"); render();
    } }),
  "sub-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: subForm(DataService.getSubclass(id)),
    submitText: "Save changes",
    onSubmit: function(d, form){
      d.days = readDays(form); d.id = id;
      d.capacity = +d.capacity || 0; d.monthlyFee = +d.monthlyFee || 0;
      DataService.saveSubclass(d); toast("Sub-class updated", "ok"); render();
    } }),
  "sub-assign": (id) => {
    const sc = DataService.getSubclass(id);
    const inBatch = DataService.getEnrollments({ batchId: sc.batchId, status: "Active" });
    openModal({ title: "Assign students — " + sc.name, wide: true,
      body: '<div class="note">Tick the students who belong to this group. A student can sit in only one sub-class ' +
        'of a batch at a time; ticking here moves them out of any other group.</div>' +
        '<div style="max-height:52vh;overflow:auto">' + (inBatch.length ? inBatch.map(function(e){
          const st = DataService.getStudent(e.studentId);
          const other = e.subClassId && e.subClassId !== id ? (DataService.getSubclass(e.subClassId) || {}).name : "";
          return '<label class="minirow" style="cursor:pointer"><span><input type="checkbox" name="s_' + e.id + '"' +
            (e.subClassId === id ? " checked" : "") + '> ' + esc(st ? st.name : e.studentId) + ' ' + idchip(e.studentId) +
            (other ? ' <span class="tag">' + esc(other) + '</span>' : "") + '</span><b>' + money(e.monthlyFee) + '</b></label>';
        }).join("") : '<p class="hint">No active enrolments in this batch yet.</p>') + '</div>',
      submitText: "Save the group",
      onSubmit: function(d){
        let n = 0;
        inBatch.forEach(function(e){
          const want = !!d["s_" + e.id];
          if (want && e.subClassId !== id) { e.subClassId = id; n++; }
          else if (!want && e.subClassId === id) { e.subClassId = ""; n++; }
        });
        persist();
        toast(n + " enrolment(s) updated", "ok"); render();
      } });
  },
  "enrol-batch": (id, el) => {
    const form = $("#mForm");
    if (!form || !form.elements.subClassId) return;
    form.elements.subClassId.innerHTML = optList(DataService.getSubclasses({ batchId: el.value })
      .map(x => ({ value: x.id, label: x.name })), "", "Whole batch");
  },
  "sub-csv": () => downloadCSV("sub-classes.csv",
    ["Sub-class ID","Name","Batch","Teacher","Days","Time","Students","Monthly fee","Status"],
    DataService.getSubclasses().map(function(sc){
      const b = DataService.getBatch(sc.batchId), t = DataService.getTeacher(sc.teacherId);
      return [sc.id, sc.name, b ? b.name : sc.batchId, t ? t.name : "", (sc.days || []).join(" "),
        (sc.startTime || "") + "-" + (sc.endTime || ""), Logic.rosterOf(sc.batchId, null, sc.id).length, sc.monthlyFee || "", sc.status || "Active"];
    })),

  /* ---------------- teacher attendance link ---------------- */
  "link-new": (batchId, el) => {
    const subId = (el && el.dataset.sub) || "";
    openModal({ title: "Teacher attendance link", wide: true,
      body: '<div class="note">Make one link per class or sub-class and send it to the teacher on WhatsApp. ' +
        'They mark the roster on their phone — no login, no app. The link always opens on today and lets them ' +
        'fix yesterday, nothing further back.</div>' +
        '<div class="form-grid">' +
        field("Batch", sel("batchId", batchOpts(batchId || "", "Select batch", false), 'data-act="link-batch"')) +
        '<div class="field"><label>Sub-class</label><select class="select" name="subClassId">' +
          optList(DataService.getSubclasses({ batchId: batchId || "" }).map(x => ({ value: x.id, label: x.name })),
            subId, "Whole batch") + '</select></div>' +
        '<div class="field span2"><label>Where the teacher page is hosted</label>' +
          '<input class="input" name="base" value="' + esc(Settings().teacherLinkBase || "") + '" placeholder="https://manzilulquran.in/attendance/">' +
          '<span class="hint">The attendance page is already hosted here — every link works from any phone.</span></div>' +
        '</div>',
      submitText: "Build the link",
      onSubmit: function(d){
        if (!d.batchId) { toast("Pick a batch", "bad"); return false; }
        DataService.saveSettings({ teacherLinkBase: d.base });
        Actions._showLink(d.batchId, d.subClassId || "", d.base);
        return false;
      } });
  },
  "link-batch": (id, el) => {
    const form = $("#mForm");
    if (!form || !form.elements.subClassId) return;
    form.elements.subClassId.innerHTML = optList(DataService.getSubclasses({ batchId: el.value })
      .map(x => ({ value: x.id, label: x.name })), "", "Whole batch");
  },
  _showLink: (batchId, subId, base) => {
    const b = DataService.getBatch(batchId), sc = subId ? DataService.getSubclass(subId) : null;
    const t = DataService.getTeacher(sc ? sc.teacherId : b.teacherId);
    const roster = Logic.rosterOf(batchId, null, subId);
    if (!roster.length) { toast("Nobody is enrolled in that group yet", "bad"); return; }
    const set = Settings();
    const token = b64e(JSON.stringify({
      v: 1, b: batchId, s: subId, bn: b.name, sn: sc ? sc.name : "", t: t ? t.name : "",
      a: set.academyName || "ManzilulQuran", w: set.whatsappNumber || set.contactPhone || "",
      api: set.apiUrl || "", made: today(),
      r: roster.map(x => [x.id, x.name])
    }));
    const url = (base || set.teacherLinkBase || "").replace(/\/?$/, "/") + "index.html#c=" + token;
    const msg = "Assalamu Alaikum " + (t ? t.name : "") + ",\n\n" +
      "Please mark attendance for " + b.name + (sc ? " · " + sc.name : "") + " here:\n" + url +
      "\n\nThe link works every day — open it after class, mark the students, and press Submit. " +
      "You can also correct yesterday.\n\n" + (set.academyName || "ManzilulQuran");
    openModal({ title: "Link for " + b.name + (sc ? " · " + sc.name : ""), wide: true, hideSubmit: true, cancelText: "Close",
      body: dl([["Class", esc(b.name)], ["Sub-class", sc ? esc(sc.name) : "Whole batch"],
        ["Teacher", esc(t ? t.name : "—")], ["Students in the link", roster.length],
        ["Marking window", "Today and yesterday only"]]) +
        '<div class="field" style="margin-top:10px"><label>Link</label>' +
        '<textarea class="textarea" id="lnkBox" rows="4" readonly>' + esc(url) + '</textarea></div>' +
        '<input type="hidden" id="lnkMsg" value="' + esc(msg) + '">' +
        '<input type="hidden" id="lnkNum" value="' + esc(t ? (t.whatsapp || t.phone) : "") + '">' +
        '<div class="btn-row" style="margin-top:12px">' +
          '<button type="button" class="btn btn-wa" data-act="link-wa">Send to the teacher</button>' +
          '<button type="button" class="btn" data-act="link-copy">Copy link</button>' +
          '<button type="button" class="btn btn-primary" data-act="att-import">Paste a returned code</button>' +
        '</div>' +
        '<div class="note" style="margin-top:12px">The roster travels inside the link. If students join or leave this ' +
        'group later, build the link again and resend it.</div>' });
  },
  "link-copy": () => {
    const t = $("#lnkBox"); t.select();
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => toast("Link copied", "ok"));
    else { document.execCommand("copy"); toast("Link copied", "ok"); }
  },
  "link-wa": () => {
    const n = $("#lnkNum").value;
    if (!n) { toast("No WhatsApp number saved for this teacher", "bad"); return; }
    window.open(Logic.waLink(n, $("#lnkMsg").value), "_blank");
  },
  "att-import": () => openModal({ title: "Import attendance from a teacher", wide: true,
    body: '<div class="note">Paste the code the teacher sent back. Nothing is overwritten silently — you will see ' +
      'exactly what changed.</div>' +
      '<div class="field"><label>Code</label><textarea class="textarea" name="code" rows="6" placeholder="Paste the long code here"></textarea></div>',
    submitText: "Import attendance",
    onSubmit: function(d){
      let obj;
      try { obj = JSON.parse(b64d((d.code || "").replace(/^[\s\S]*CODE:\s*/i, ""))); }
      catch (e) { toast("That code could not be read", "bad"); return false; }
      if (!obj || !obj.m || !obj.b) { toast("That code is not an attendance code", "bad"); return false; }
      const b = DataService.getBatch(obj.b);
      if (!b) { toast("That batch is not in this system", "bad"); return false; }
      const marks = {};
      const map = { P: "Present", A: "Absent", L: "Leave", E: "Excused" };
      obj.m.forEach(function(x){ if (map[x[1]]) marks[x[0]] = { status: map[x[1]], remarks: x[2] || "" }; });
      const r = DataService.saveAttendance(obj.d, obj.b, b.teacherId, marks,
        { subClassId: obj.s || "", source: "teacher" });
      State.att.marks = null;
      toast(r.created + " marks imported, " + r.updated + " corrected for " + fmtDate(obj.d) +
        (obj.t ? " · from " + obj.t : ""), "ok", 5200);
      render();
    } }),

  /* ---------------- global search ---------------- */
  "global-search": () => openModal({ title: "Search the academy", hideSubmit: true, cancelText: "Close", noFocus: false,
    body: '<div class="field"><label>Student, teacher, batch, payment or transaction</label>' +
      '<input class="input" id="gq" data-act="gsearch" placeholder="Type at least two letters" autocomplete="off"></div>' +
      '<div id="gres" style="margin-top:12px"></div>' }),
  "gsearch": (id, el) => {
    const q = (el.value || "").toLowerCase().trim();
    /* v21: leaving the box (a tap on a result) fires "change" with the same text — redrawing then swapped the result
       out from under the finger and the tap was lost. Only redraw when the text changed. */
    if (el._q === q) return; el._q = q;
    const box = $("#gres");
    if (q.length < 2) { box.innerHTML = '<p class="hint">Keep typing…</p>'; return; }
    const out = [];
    DataService.getStudents().forEach(s => { if ((s.id + " " + s.name + " " + s.phone).toLowerCase().indexOf(q) >= 0)
      out.push(["Student", s.name, s.id, "profile-open", s.id]); });
    DataService.getTeachers().forEach(t => { if ((t.id + " " + t.name).toLowerCase().indexOf(q) >= 0)
      out.push([t.kind === "staff" ? "Staff" : "Teacher", t.name, t.id, "teacher-open", t.id]); });
    DataService.getBatches().forEach(b => { if ((b.id + " " + b.name + " " + b.course).toLowerCase().indexOf(q) >= 0)
      out.push(["Class", b.name, b.id, "goto-batches", b.id]); });
    DataService.getSubclasses().forEach(x => { if ((x.id + " " + x.name).toLowerCase().indexOf(q) >= 0)
      out.push(["Sub-class", x.name, x.id, "goto-subs", x.id]); });
    DataService.getPayments().forEach(pp => { if ((pp.id + " " + (pp.txnId || "")).toLowerCase().indexOf(q) >= 0)
      out.push(["Payment", pp.id + " · " + money(pp.amount), pp.studentId, "receipt", pp.id]); });
    box.innerHTML = out.length
      ? out.slice(0, 24).map(o => '<button class="minirow" style="width:100%;border:0;background:transparent;cursor:pointer;text-align:left" ' +
          'data-act="' + o[3] + '" data-id="' + esc(o[4]) + '"><span><span class="tag">' + o[0] + '</span> ' +
          esc(o[1]) + '</span><b>' + esc(o[2]) + '</b></button>').join("")
      : '<p class="hint">Nothing matched.</p>';
  },
  "goto-teachers": () => { closeModal(); go("teachers"); },
  "goto-batches": () => { closeModal(); go("batches"); },
  "goto-subs": () => { closeModal(); go("subclasses"); },
  "alerts": () => {
    const m = State.month;
    const dues = Logic.feeViews({ month: m }).filter(v => v.daysOverdue > 0 && v.balance > 0 && !v.waived);
    const waiting = DataService.getStudents().filter(s => (s.status || "Active") === "Active" && Logic.classInfo(s.id).pending);
    const noT = DataService.getPlans({ status: "Active" }).filter(p => !p.teacherId || !DataService.getTeacher(p.teacherId));
    const row = (a, b, act, id) => '<button type="button" class="minirow" style="width:100%;border:0;background:transparent;cursor:pointer;text-align:left" data-act="' + act + '" data-id="' + esc(id) + '"><span>' + a + '</span><b class="out">' + b + '</b></button>';
    openModal({ title: "Needs your attention", hideSubmit: true, cancelText: "Close",
      body: '<div class="sub-hd">Overdue fees</div>' +
        (dues.length ? dues.slice(0, 8).map(v => row(esc(v.studentName) + ' · ' + v.daysOverdue + ' days', money(v.balance), "profile-open", v.studentId)).join("")
          : '<div class="minirow"><span>Nothing overdue</span><b>—</b></div>') +
        '<div class="sub-hd">Waiting for a class</div>' +
        (waiting.length ? waiting.slice(0, 8).map(s => row(esc(s.name), "Pending", "profile-open", s.id)).join("")
          : '<div class="minirow"><span>Every student has a class</span><b>—</b></div>') +
        '<div class="sub-hd">Classes with no teacher</div>' +
        (noT.length ? noT.slice(0, 8).map(p => row(esc(((DataService.getStudent(p.studentId) || {}).name || p.studentId) + " · " + (p.course || "class")), "No teacher", "plan-edit", p.id)).join("")
          : '<div class="minirow"><span>Every class has a teacher</span><b>—</b></div>') });
  },
  "att-range": (studentId) => {
    const a = State.att;
    openModal({ title: "Attendance for a date range", wide: true,
      body: '<div class="note">Marks every class day in the range in one go — holidays and non-class days are skipped, ' +
        'and days already marked are left alone unless you tick the replace box. Use <b>Change</b> or <b>Clear</b> to fix a stretch you got wrong.</div>' +
        '<div class="form-grid">' +
        field("What to do", sel("mode", optList([{ value: "mark", label: "Mark the range" },
          { value: "change", label: "Change marks already saved" }, { value: "clear", label: "Clear marks in the range" }], "mark"))) +
        field("Batch", sel("batchId", batchOpts(a.batchId || "", "Select batch", false))) +
        field("From", '<input class="input" type="date" name="from" value="' + esc(monthStart(State.month)) + '">') +
        field("To", '<input class="input" type="date" name="to" value="' + esc(monthEnd(State.month) > today() ? today() : monthEnd(State.month)) + '">') +
        field("Status", sel("status", optList(["Present","Absent","Leave","Excused"], "Present"))) +
        field("Only this student", sel("onlyStudentId", studentOpts(studentId || "", "Everyone in the batch"))) +
        '<div class="field"><label>Class days</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
          '<input type="checkbox" name="onlyClassDays" checked> Only on the batch\'s class days</label></div>' +
        '<div class="field"><label>Holidays</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
          '<input type="checkbox" name="skipHolidays" checked> Skip holidays</label></div>' +
        '<div class="field span2"><label>Existing marks</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
          '<input type="checkbox" name="overwrite"> Replace marks that are already saved</label></div>' +
        '</div>',
      submitText: "Apply to the range",
      onSubmit: function(d){
        const r = Logic.bulkAttendance({ mode: d.mode, batchId: d.batchId, from: d.from, to: d.to, status: d.status,
          onlyStudentId: d.onlyStudentId, onlyClassDays: !!d.onlyClassDays, skipHolidays: !!d.skipHolidays,
          overwrite: !!d.overwrite });
        if (r.error) { toast(r.error, "bad"); return false; }
        State.att.marks = null;
        toast(d.mode === "clear" ? r.cleared + " marks cleared"
          : r.created + " marks saved, " + r.updated + " changed · " + r.holidays + " holiday days and " +
            r.offDays + " non-class days skipped", "ok", 5000);
        render();
      } });
  },
  "holidays": () => openModal({ title: "Holidays", hideSubmit: true, cancelText: "Close",
    body: '<div class="note">Attendance range marking skips these days. Fees do not change.</div>' +
      (DataService.getHolidays().length ? DataService.getHolidays().map(h => '<div class="minirow"><span><b>' +
        esc(h.name) + '</b> · ' + esc(fmtDate(h.from) + (h.to && h.to !== h.from ? " – " + fmtDate(h.to) : "")) +
        '</span><button type="button" class="btn btn-sm btn-danger" data-act="hol-del" data-id="' + h.id + '">Remove</button></div>').join("")
        : '<p class="hint">No holidays added yet.</p>') +
      '<div class="btn-row" style="margin-top:13px"><button type="button" class="btn btn-primary" data-act="hol-new">+ Add holiday</button></div>' }),
  "hol-new": () => openModal({ title: "Add a holiday",
    body: '<div class="form-grid">' +
      '<div class="field span2"><label>Name</label><input class="input" name="name" placeholder="Eid holiday, mid-term break…" required></div>' +
      field("From", '<input class="input" type="date" name="from" value="' + today() + '">') +
      field("To", '<input class="input" type="date" name="to" value="' + today() + '">') +
      '</div><div class="note" style="margin:13px 0 0">A single day: put the same date in both boxes.</div>',
    submitText: "Save holiday",
    onSubmit: function(d){
      if (!d.name || !d.from) { toast("Name and date are needed", "bad"); return false; }
      if (d.to && d.to < d.from) { toast("The end date is before the start date", "bad"); return false; }
      DataService.saveHoliday({ name: d.name, from: d.from, to: d.to || d.from });
      toast("Holiday saved", "ok"); render();
    } }),
  "hol-del": (id) => { DataService.deleteHoliday(id); toast("Holiday removed", "ok"); closeModal(); render(); },
  "cal-prev": () => { State.cal.month = addMonths(State.cal.month, -1); render(); },
  "cal-next": () => { State.cal.month = addMonths(State.cal.month, 1); render(); },
  "att-open": (batchId, el) => { State.att.batchId = batchId; State.att.subClassId = (el && el.dataset.sub) || "";
    State.att.marks = null; go("attendance"); },
  "att-mark": (id, el) => {
    const m = State.att.marks[id] || { status: "", remarks: "" };
    m.status = (m.status === el.dataset.s) ? "" : el.dataset.s;
    State.att.marks[id] = m; render();
  },
  "att-all": () => { Object.keys(State.att.marks).forEach(k => State.att.marks[k].status = "Present"); render(); },
  "att-tab": (id, el) => { State.att.tab = el.dataset.t; render(); },
  "att-load": (id, el) => { State.att.date = el.dataset.date; State.att.batchId = id; State.att.marks = null;
    render(); window.scrollTo({ top: 0 }); },
  "att-save": () => {
    const a = State.att, b = DataService.getBatch(a.batchId), marks = {};
    Object.keys(a.marks).forEach(k => { if (a.marks[k].status) marks[k] = a.marks[k]; });
    if (!Object.keys(marks).length) { toast("Nothing marked yet", "bad"); return; }
    const r = DataService.saveAttendance(a.date, a.batchId, b.teacherId, marks, { subClassId: a.subClassId, source: "admin" });
    a.marks = null;
    toast(r.created + " marks saved" + (r.updated ? ", " + r.updated + " corrected" : ""), "ok");
    render();
  },

  /* ---------------- plans + classes ---------------- */
  /* v21: one button for "this student's class" — opens the plan they have, or a new one when they have none */
  "plan-open": (studentId) => {
    const st = DataService.getStudent(studentId); if (!st) return;
    const act = DataService.getPlans({ studentId: studentId }).filter(x => x.status === "Active");
    if (act.length === 1) { Actions["plan-edit"](act[0].id); return; }
    if (!act.length) { Actions["plan-new"](studentId); return; }
    openModal({ title: st.name + " · class plans", hideSubmit: true, cancelText: "Close",
      body: act.map(x => { const t = DataService.getTeacher(x.teacherId);
          return '<div class="minirow"><span><b>' + esc(x.course || "Plan") + '</b> · ' + esc(t ? t.name : "no teacher") + ' · ' + money(x.rate) + ' ' + idchip(x.id) + '</span>' +
            '<b><button type="button" class="btn btn-sm btn-primary" data-act="plan-edit" data-id="' + esc(x.id) + '">Edit</button></b></div>'; }).join("") +
        '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn" data-act="plan-new" data-id="' + esc(studentId) + '">+ A separate new class</button></div>' });
  },
  "plan-new": (studentId) => openModal({ title: "New class", wide: true, body: planForm({}, studentId), submitText: "Save class",
    onSubmit: function(d, form){
      if (!DataService.getStudent(d.studentId)) { toast("Pick a student from the list", "bad"); return false; }
      if (!String(d.course || "").trim()) { toast("Choose the course", "bad"); return false; }
      if (!(+d.rate > 0)) { toast("Type the monthly fee", "bad"); return false; }
      if (d.teacherId_q && !DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list — or clear the box", "bad"); return false; }
      const same = DataService.getPlans({ studentId: d.studentId }).find(x => x.status === "Active" && x.course === d.course);
      if (same) { toast("This student already has an active " + d.course + " class (" + same.id + ") — edit that one instead", "warn", 6000); return false; }
      const days = readDays(form), start = d.startDate || today();
      const id = DataService.savePlan({ studentId: d.studentId, teacherId: DataService.getTeacher(d.teacherId) ? d.teacherId : "", course: d.course,
        days: days, perWeek: days.length, time: d.time || "", duration: +d.duration || 0, feeType: "monthly", rate: round2(+d.rate), discount: 0,
        dueDay: Math.min(28, Math.max(1, +d.dueDay || dayOf(start))), startDate: start, endDate: "", status: "Active", notes: d.notes || "" });
      let msg = "Class " + id + " saved" + (DataService.getTeacher(d.teacherId) ? "" : " · no teacher yet");
      if (d.firstFee) { const fm = Logic.firstMonth(start), r = Logic.buildIndMonth(fm, { planId: id, first: true, remark: "First month" });
        if (r.created) msg += " · " + monthLabel(fm) + " fee on the due list"; }
      toast(msg, "ok", 4200); celebrate("🎓"); render();
    } }),
  "plan-edit": (id) => { const pl0 = DataService.getPlan(id); if (!pl0) { toast("That class was not found", "bad"); return; }
    openModal({ title: "Edit class " + id, wide: true, body: planForm(pl0), submitText: "Save changes",
    onSubmit: function(d, form){
      if (!String(d.course || "").trim()) { toast("Choose the course", "bad"); return false; }
      if (d.teacherId_q && !DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list — or clear the box", "bad"); return false; }
      const days = readDays(form), stopped = d.status === "Stopped";
      const rec = { id: id, course: d.course, teacherId: DataService.getTeacher(d.teacherId) ? d.teacherId : "", days: days, perWeek: days.length,
        time: d.time || "", duration: +d.duration || 0, feeType: "monthly", rate: round2(+d.rate || 0),
        dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)), startDate: d.startDate || pl0.startDate || today(), status: d.status || "Active",
        endDate: stopped ? (d.endDate || today()) : "", notes: d.notes || "" };
      if (!stopped) rec.stopReason = "";
      if (rec.rate > 0) rec.setupNeeded = false;
      DataService.savePlan(rec);
      const n = followFee({ planId: id }, rec.rate, rec.teacherId);
      toast((stopped && pl0.status === "Active" ? "Class stopped" : "Class updated") + (n ? " · " + n + " unpaid month" + (n > 1 ? "s" : "") + " updated" : ""), "ok", 3600);
      render();
    } }); },
  "plan-del": (id) => {
    const pl = DataService.getPlan(id); if (!pl) return;
    if (planUsed(id)) { toast("This class has fees or attendance — stop it instead of deleting it", "warn", 5000); return; }
    const st = DataService.getStudent(pl.studentId);
    confirmAction({ title: "Delete " + id, danger: true, submitText: "Delete the plan",
      note: "The plan has no fees, payments or attendance, so nothing else changes.",
      message: "Delete " + (st ? st.name + "'s " : "") + (pl.course ? pl.course + " " : "") + "plan " + id + "?",
      onConfirm: function(){ removeRow("plans", id); toast("Plan " + id + " deleted", "ok"); render(); } });
  },
  "class-new": (id) => {
    const isPlan = id && String(id).indexOf("IPL") === 0;
    openModal({ title: "Record a class", body: classForm({}, isPlan ? id : "", isPlan ? "" : id), submitText: "Save class",
      onSubmit: function(d){
        if (!d.planId) { toast("Pick the class plan", "bad"); return false; }
        const pl = DataService.getPlan(d.planId);
        if (d.status === "Substitute" && !d.takenBy) { toast("Choose who took the class in Taken by", "bad"); return false; }
        if (d.status !== "Substitute") d.takenBy = "";
        d.studentId = pl.studentId; d.duration = +d.duration || 0;
        const cid = DataService.saveClass(d);
        toast("Class " + cid + " recorded", "ok"); render();
      } });
  },
  "class-plan": (id, el) => {
    const pl = DataService.getPlan(el.value); if (!pl) return;
    const form = $("#mForm");
    if (form.elements.teacherId) form.elements.teacherId.value = pl.teacherId || "";
    if (form.elements.duration) form.elements.duration.value = pl.duration || 45;
  },
  "class-edit": (id) => openModal({ title: "Edit class " + id, body: classForm(DB.classes.find(c => c.id === id)), submitText: "Save changes",
    onSubmit: function(d){
      const pl = DataService.getPlan(d.planId);
      if (d.status === "Substitute" && !d.takenBy) { toast("Choose who took the class in Taken by", "bad"); return false; }
      if (d.status !== "Substitute") d.takenBy = "";
      d.id = id; d.duration = +d.duration || 0; if (pl) d.studentId = pl.studentId;
      DataService.saveClass(d); toast("Class updated", "ok"); render();
    } }),
  "class-del": (id) => confirmAction({ title: "Remove this class", danger: true,
    note: "Only the attendance mark is removed. Fees and payments do not change.",
    message: "Remove class " + id + " from the log?", submitText: "Remove class",
    onConfirm: function(){ DataService.deleteClass(id); toast("Class removed", "ok"); render(); } }),
  "cls-range": (planId) => openModal({
    title: "Log a range of classes", wide: true,
    body: '<div class="note">Fills the whole stretch in one go — 1st to 30th, a week, a term. Non-class days and holidays are ' +
      'skipped, and a day already logged is left alone unless you tick the replace box. Use <b>Change</b> or <b>Clear</b> to fix a range.</div>' +
      '<div class="form-grid">' +
      field("What to do", sel("mode", optList([{ value: "mark", label: "Log the range" },
        { value: "change", label: "Change classes already logged" }, { value: "clear", label: "Remove classes in the range" }], "mark"))) +
      field("Class plan", sel("planId", optList(DataService.getPlans().map(function(p){
        const st = DataService.getStudent(p.studentId);
        return { value: p.id, label: (st ? st.name : p.studentId) + " · " + p.course + (p.status !== "Active" ? " (stopped)" : "") };
      }), planId || "", "Select plan"))) +
      field("From", '<input class="input" type="date" name="from" value="' + esc(monthStart(State.month)) + '">') +
      field("To", '<input class="input" type="date" name="to" value="' + esc(monthEnd(State.month) > today() ? today() : monthEnd(State.month)) + '">') +
      field("Status for each class", sel("status", optList(["Completed","Cancelled","Student Absent","Teacher Absent","Rescheduled"], "Completed"))) +
      '<div class="field"><label>Class days</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
        '<input type="checkbox" name="onlyClassDays" checked> Only on the plan\'s class days</label></div>' +
      '<div class="field"><label>Holidays</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
        '<input type="checkbox" name="skipHolidays" checked> Skip holidays</label></div>' +
      '<div class="field"><label>Existing entries</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
        '<input type="checkbox" name="overwrite"> Replace classes already logged</label></div>' +
      '</div>',
    submitText: "Apply to the range",
    onSubmit: function(d){
      const r = Logic.bulkClasses({ mode: d.mode, planId: d.planId, from: d.from, to: d.to, status: d.status,
        onlyClassDays: !!d.onlyClassDays, skipHolidays: !!d.skipHolidays, overwrite: !!d.overwrite });
      if (r.error) { toast(r.error, "bad"); return false; }
      toast(d.mode === "clear" ? r.removed + " classes removed"
        : r.created + " classes logged, " + r.updated + " changed · " + r.holidays + " holidays and " +
          r.offDays + " non-class days skipped", "ok", 5000);
      render();
    }
  }),
  "class-week": () => openModal({
    title: "Add a week of classes",
    body: '<div class="note">Fills one week from a plan\'s usual days. Any day already logged is left alone.</div>' +
      '<div class="form-grid">' +
      field("Class plan", sel("planId", optList(DataService.getPlans({ status: "Active" }).map(function(p){
        const s = DataService.getStudent(p.studentId);
        return { value: p.id, label: (s ? s.name : p.studentId) + " · " + p.course };
      }), "", "Select plan"))) +
      field("Week starting", '<input class="input" type="date" name="from" value="' + today() + '">') +
      field("Status for each", sel("status", optList(["Completed", "Cancelled"], "Completed"))) + '</div>',
    submitText: "Add the week",
    onSubmit: function(d){
      const pl = DataService.getPlan(d.planId);
      if (!pl) { toast("Pick a plan", "bad"); return false; }
      const start = parseYMD(d.from);
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const day = new Date(start); day.setDate(start.getDate() + i);
        const ds = ymd(day);
        if ((pl.days || []).indexOf(DOW[day.getDay()]) < 0) continue;
        if (DataService.getClasses({ planId: pl.id, date: ds }).length) continue;
        DataService.saveClass({ date: ds, studentId: pl.studentId, planId: pl.id, teacherId: pl.teacherId,
          duration: d.status === "Completed" ? pl.duration : 0, status: d.status, notes: "" });
        n++;
      }
      toast(n + " classes added", n ? "ok" : "warn"); render();
    }
  }),
  "classes-csv": () => downloadCSV("classes.csv", ["Class ID","Date","Student ID","Student","Teacher","Course","Duration","Status","Notes"],
    DataService.getClasses().map(function(c){
      const s = DataService.getStudent(c.studentId), t = DataService.getTeacher(c.teacherId), p = DataService.getPlan(c.planId);
      return [c.id, c.date, c.studentId, s ? s.name : "", t ? t.name : "", p ? p.course : "", c.duration, c.status, c.notes];
    })),

  "wipe-backup": () => {
    if (!WIPE_SNAPSHOT) return;
    try {
      const blob = new Blob([JSON.stringify(WIPE_SNAPSHOT, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "manzilulquran-deleted-trial-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    } catch (e) { toast("Could not create the file here", "bad"); }
  },
  /* ---- start fresh: remove every academy record (Supabase + this device). Settings and money accounts stay. ---- */
  "data-wipe": () => {
    const n = WIPE_COLLS.reduce((a, c) => a + (DB[c] || []).length, 0);
    openModal({ title: "Delete all academy records", submitText: "Delete everything",
      body: '<div class="note">This removes <b>' + n + '</b> records — students, teachers, batches, plans, classes, attendance, fees, payments, income, expenses and payroll — from Supabase and this device. ' +
        'Settings, course lists and the money accounts (Cash / Bank / UPI) are kept. The Google Sheet backup is not touched. ' +
        'When it finishes you get a result screen with a button to download a backup of what was deleted.</div>' +
        '<div class="form-grid">' +
        field("Password", '<input class="input" type="password" name="pw" autocomplete="off">') +
        field("Type DELETE to confirm", '<input class="input" name="confirm" autocomplete="off">') + '</div>',
      onSubmit: function(d){
        if (d.pw !== SHEET_LOCK_PW) { toast("Wrong password", "bad"); return false; }
        if (String(d.confirm).trim() !== "DELETE") { toast("Type DELETE in capitals", "bad"); return false; }
        setTimeout(wipeAll, 0);
      } });
  },
  /* ---- add records from a JSON file (merged by ID — nothing else is removed) ---- */
  "data-import": () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "application/json,.json";
    inp.onchange = function(){
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = function(){
        let obj;
        try { obj = JSON.parse(r.result); } catch (e) { toast("That file is not valid JSON", "bad"); return; }
        const colls = SUPA_COLLS.filter(c => c !== "settings" && Array.isArray(obj[c]) && obj[c].length);
        if (!colls.length) { toast("No academy records found in that file", "bad"); return; }
        let bad = 0;
        const plan = colls.map(function(c){
          const have = {}; (DB[c] || []).forEach(x => have[x.id] = true);
          const recs = obj[c].filter(x => x && x.id); bad += obj[c].length - recs.length;
          return { c: c, recs: recs, add: recs.filter(x => !have[x.id]).length, upd: recs.filter(x => have[x.id]).length };
        });
        confirmAction({ title: "Import records",
          note: "Records are matched by ID: new IDs are added, existing IDs are updated. Nothing else is changed." + (bad ? " " + bad + " rows without an ID are skipped." : ""),
          message: plan.map(p => p.c + ": " + p.add + " new" + (p.upd ? ", " + p.upd + " updated" : "")).join(" · "),
          submitText: "Import",
          onConfirm: function(){ importRecords(plan); } });
      };
      r.readAsText(f);
    };
    inp.click();
  },
  "dues-quick": (id, el) => { State[el.dataset.key].quick = el.dataset.q; resetLists(); render(); },
  "dues-csv": (id, el) => {
    const src = el.dataset.src || "";
    downloadCSV("due-" + (src || "all") + "-" + State.month + ".csv",
      ["Student ID","Student","Phone","WhatsApp","Stream","Class","Teacher","Month","Fee","Paid","Pending","Due Date","Days Late","Status"],
      Logic.feeViews(src ? { month: State.month, source: src } : { month: State.month }).map(withBasis).map(v => [v.studentId, v.studentName,
        v.phone, v.whatsapp, v.source, v.shortBasis, v.teacherName, v.month, v.netFee, v.paidAmount, v.balance, v.dueDate,
        v.balance > 0 ? v.daysOverdue : 0, Logic.dueStatus(v)]));
  }
};

Object.assign(Actions, {
  /* ---------------- payments ---------------- */
  "pay-new": (feeId) => {
    const fee = feeId ? withBasis(Logic.feeView(DataService.getFee(feeId))) : null;
    const sid = fee ? fee.studentId : "";
    openModal({
      title: "Record a payment",
      body: '<div class="form-grid">' +
        '<div class="field"><label>Student</label><input class="input" name="studentId" list="payStuList" value="' + esc(sid) + '" placeholder="Type name or ID to search" data-act="pay-student" autocomplete="off">' +
          '<datalist id="payStuList">' + DataService.getStudents().slice().sort((a,b)=>a.name.localeCompare(b.name)).map(x => '<option value="' + esc(x.id) + '">' + esc(x.name) + " · " + esc(x.id) + '</option>').join("") + '</datalist></div>' +
        '<div class="field span2" id="payStuHint"></div>' +
        '<div class="field"><label>Fee month</label><select class="select" name="feeId" data-act="pay-feepick">' +
          (sid ? feeOptionsFor(sid, feeId) : '<option value="">Choose a student first</option>') + '</select></div>' +
        field("Amount", '<input class="input amt" type="number" name="amount" min="0.01" step="0.01" value="' +
          (fee ? fee.balance : "") + '" required>') +
        field("Payment date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Payment method", sel("account", accountOpts("UPI"))) +
        field("Transaction / reference", '<input class="input mono" name="txnId">') +
        '<div class="field span2"><label>Remarks</label><input class="input" name="remarks"></div></div>' +
        '<div class="note" style="margin:13px 0 0">The fee month tells the system which stream this belongs to, so batch and individual money never get mixed up. Paying less than the balance is saved as a part payment.</div>',
      submitText: "Save payment",
      onSubmit: function(d){
        const amount = +d.amount;
        if (!d.feeId) { toast("Pick the fee month", "bad"); return false; }
        if (!amount || amount <= 0) { toast("Enter an amount", "bad"); return false; }
        const v = Logic.feeView(DataService.getFee(d.feeId));
        const pid = DataService.savePayment({ feeId: d.feeId, source: v.source, studentId: v.studentId, month: v.month,
          amount: amount, date: d.date || today(), account: d.account, txnId: d.txnId, remarks: d.remarks });
        const after = Logic.feeView(DataService.getFee(d.feeId));
        toast(money(amount) + " received · " + after.status + (after.balance > 0 ? " · balance " + money(after.balance) : ""), "ok", 4200);
        celebrate("₹"); render();
        setTimeout(() => Actions["receipt"](pid), 220);
      }
    });
  },
  /* show the name under the box as it is typed, so a wrong ID is obvious before saving */
  /* every letter narrows the list under the box */
  "pick-type": (name, el) => {
    const form = el.closest("form"); if (!form) return;
    /* v21: the same text again (the box losing focus as a name is tapped) must not redraw the list under the finger */
    if (el._q === el.value) return; el._q = el.value;
    pickRender(name, el.value);
    const hid = form.elements[name], hint = form.querySelector('[data-pick="' + name + '"]');
    const v = String(el.value || "").trim();
    const rows = pickRows(name);
    const exact = rows.find(r => r.id.toLowerCase() === v.toLowerCase() ||
      String(r.name).toLowerCase() === v.toLowerCase());
    if (hid) hid.value = exact ? exact.id : "";
    if (hint) {
      hint.textContent = exact ? exact.name + " · " + exact.id
        : v ? "Pick one from the list below" : "Type a few letters of the name or the ID";
      hint.style.color = "";
    }
  },
  /* tapping a name in the list fills it in */
  "pick-choose": (id, el) => {
    const name = el.dataset.for, form = el.closest("form"); if (!form) return;
    const rows = pickRows(name), r = rows.find(x => x.id === id); if (!r) return;
    form.elements[name].value = r.id;
    form.elements[name + "_q"].value = r.name;
    const menu = form.querySelector('[data-pick-menu="' + name + '"]');
    if (menu) { menu.hidden = true; menu.innerHTML = ""; }
    const hint = form.querySelector('[data-pick="' + name + '"]');
    if (hint) { hint.textContent = r.name + " · " + r.id; hint.style.color = ""; }
  },
  "pay-to-plan": (sid) => { closeModal(); setTimeout(() => Actions["plan-new"](sid), 60); },
  "pay-to-batch": (sid) => { closeModal(); setTimeout(() => Actions["student-assign"](sid), 60); },
  "pay-student": (id, el) => {
    const form = $("#mForm");
    form.elements.feeId.innerHTML = el.value ? feeOptionsFor(el.value, "") : '<option value="">Choose a student first</option>';
    Actions["pay-feepick"](null, form.elements.feeId);
    Actions["pay-showbal"](null, el);
  },
  "pay-showbal": (id, el) => {
    const form = $("#mForm"); if (!form) return;
    const hint = form.querySelector("#payStuHint"); if (!hint) return;
    const sid = el.value;
    if (!sid) { hint.innerHTML = ""; return; }
    const views = Logic.feeViews({ studentId: sid }).map(withBasis);
    const bal = views.reduce((s, v) => s + (v.balance > 0 ? v.balance : 0), 0);
    const st = DataService.getStudent(sid);
    /* a new student has no fee to pay against until a class plan or batch enrolment raises one */
    if (st && !views.length) {
      hint.innerHTML = '<div class="note" style="margin-top:6px"><b>' + esc(st.name) + ' has no fee yet.</b> ' +
        'A fee row comes from the student\'s class: arrange an individual class or a batch (tick "Put the first fee on the due list now"), ' +
        'or make the month\'s list on Due date.</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="pay-to-plan" data-id="' + esc(sid) + '">+ Individual class</button>' +
        '<button type="button" class="btn btn-sm" data-act="pay-to-batch" data-id="' + esc(sid) + '">Enrol in a batch</button></div>';
      return;
    }
    hint.innerHTML = '<div class="minirow" style="margin-top:6px"><span>' + esc(st ? st.name : sid) +
      '</span><b class="' + (bal > 0 ? "out" : "in") + '">' + (bal > 0 ? "Pending " + money(bal) : "No pending balance") + '</b></div>';
  },
  "apply-format": (id, el) => {
    const fid = el.value;
    const form = el.closest("form") || $("#mForm"); if (!form) return;
    if (!fid) return;  /* Custom — leave fields as-is */
    const map = {};
    (el.dataset.formats || "").split(";;").forEach(s => { const p = s.split("|"); if (p[0]) map[p[0]] = { course: p[1], days: p[2], fee: p[3] }; });
    const fmt = map[fid]; if (!fmt) return;
    /* course */
    if (form.elements.course) form.elements.course.value = fmt.course;
    /* days checkboxes (named day_Mon, day_Tue, …) */
    const want = (fmt.days || "").split(",").map(x => x.trim());
    ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].forEach(d => {
      const cb = form.elements["day_" + d]; if (cb) cb.checked = want.indexOf(d) >= 0;
    });
    /* fee: batch uses monthlyFee input; individual uses rate input if present */
    if (form.elements.monthlyFee) form.elements.monthlyFee.value = fmt.fee;
    if (form.elements.rate) form.elements.rate.value = fmt.fee;
    toast("Filled from format — you can still edit", "ok", 1800);
  },
  "kind-toggle": (id, el) => {
    const staff = el.value === "staff";
    const form = $("#mForm"); if (!form) return;
    form.querySelectorAll(".staff-only").forEach(x => x.style.display = staff ? "" : "none");
    form.querySelectorAll(".teacher-only").forEach(x => x.style.display = staff ? "none" : "contents");
  },
  "pay-feepick": (id, el) => {
    const opt = el.options[el.selectedIndex], bal = opt ? +opt.dataset.bal : 0;
    const form = $("#mForm");
    if (form && form.elements.amount && bal > 0) form.elements.amount.value = bal;
  },
  "pays-csv": () => downloadCSV("payments.csv",
    ["Payment ID","Date","Stream","Student ID","Student","Fee Month","Amount","Account","Transaction ID","Fee ID","Remarks"],
    DataService.getPayments().map(function(p){ const s = DataService.getStudent(p.studentId);
      return [p.id, p.date, p.source, p.studentId, s ? s.name : "", p.month, p.amount, p.account, p.txnId, p.feeId, p.remarks]; })),
  "receipt": (id) => {
    const p = DataService.getPayments().find(x => x.id === id);
    if (!p) return;
    const st = DataService.getStudent(p.studentId);
    const v = withBasis(Logic.feeView(DataService.getFee(p.feeId) || { id: "", gross: 0, discount: 0, dueDate: today() }));
    const s = Settings();
    openModal({ title: "Receipt " + p.id, hideSubmit: true, cancelText: "Close",
      body: '<div class="receipt">' +
        '<div class="receipt-hd"><div><h3>' + esc(s.academyName) + '</h3>' +
          '<div class="hint">' + esc(s.academyTagline || "") + '</div>' +
          '<div class="hint">' + esc(s.website || "") + ' · ' + esc(s.contactPhone || "") + '</div></div>' +
          '<div class="stamp ' + (v.balance > 0 ? "part" : "") + '">' + (v.balance > 0 ? "PART PAID" : "PAID") + '</div></div>' +
        [["Receipt no.", esc(p.id)], ["Date", fmtDate(p.date)], ["Student", esc(st ? st.name : p.studentId)],
         ["Student ID", esc(p.studentId)], ["Class type", p.source === "batch" ? "Batch class" + (v.batchName ? " · " + esc(v.batchName) : "") : "Individual class"],
         ["Fee month", esc(monthLabel(p.month))], ["Fee for the month", money(v.netFee)],
         ["Amount paid", money(p.amount)], ["Payment method", esc(p.account)],
         ["Transaction ID", esc(p.txnId || "—")], ["Balance remaining", money(v.balance)]]
         .map(x => '<div class="kv"><span>' + x[0] + '</span><b>' + x[1] + '</b></div>').join("") +
        '<p class="tagline" style="margin:13px 0 0">Jazakumullahu Khairan. Computer-generated receipt.</p></div>' +
        '<div class="btn-row no-print" style="margin-top:13px">' +
          '<button type="button" class="btn btn-primary" data-act="print-receipt">Print</button>' +
          '<button type="button" class="btn" data-act="print-receipt">Save as PDF</button>' +
          '<button type="button" class="btn btn-wa" data-act="wa-received" data-id="' + p.id + '">Send on WhatsApp</button></div>' });
  },
  /* ---- welcome letter: everything comes from the student's live class; terms are edited in Settings ---- */
  "welcome": (id) => {
    const st = DataService.getStudent(id);
    if (!st) { toast("Student not found", "bad"); return; }
    const str = Logic.streamsOf(st.id);
    const opts = [];
    if (str.individual) opts.push({ v: "plan:" + str.individual.id, label: (str.individual.course || "Individual class") + " · one-to-one" });
    if (str.batch) {
      const b = DataService.getBatch(str.batch.batchId);
      opts.push({ v: "enrol:" + str.batch.id, label: (b ? b.name : str.batch.batchId) + " · batch" });
    }
    if (!opts.length) { toast("Give " + st.name + " a class plan or a batch enrolment first", "warn", 5000); return; }
    const w = welcomeData(st, opts[0].v);
    openModal({ title: "Welcome letter — " + st.name, wide: true, submitText: "Open the letter",
      body: '<div class="note">Everything below is filled in from the class details already saved. Change anything here for this letter only — the wording of the terms is edited in Settings.</div>' +
        '<div class="form-grid">' +
        (opts.length > 1 ? '<div class="field span2"><label>Which class</label>' +
          sel("src", optList(opts.map(o => ({ value: o.v, label: o.label })), opts[0].v), 'data-act="wl-src" data-id="' + esc(st.id) + '"') + '</div>' : 
          '<input type="hidden" name="src" value="' + esc(opts[0].v) + '">') +
        '<div class="field span2" id="wlFields">' + welcomeFields(w) + '</div>' +
        '</div>',
      onSubmit: function(d){
        const w2 = welcomeData(st, d.src);
        ["startDate", "time", "perWeek", "holiday", "dueDate", "fee", "course", "note"].forEach(k => { if (d[k] !== undefined) w2[k] = d[k]; });
        openWelcomeLetter(st, w2);
      } });
  },
  "wl-src": (sid, el) => {
    const box = document.getElementById("wlFields");
    if (box) box.innerHTML = welcomeFields(welcomeData(DataService.getStudent(sid), el.value));
  },
  "print-receipt": () => {
    document.body.classList.add("print-receipt");
    window.print();
    setTimeout(() => document.body.classList.remove("print-receipt"), 400);
  },
  "refund-new": (id) => {
    const p = DataService.getPayments().find(x => x.id === id);
    const st = DataService.getStudent(p.studentId);
    openModal({ title: "Refund against " + p.id, danger: true,
      body: '<div class="note">The original payment stays in the books. The refund is its own line in the ledger and comes out of the account you choose.</div>' +
        '<div class="form-grid">' +
        field("Student", '<input class="input" value="' + esc(st ? st.name : p.studentId) + '" readonly>') +
        field("Original payment", '<input class="input" value="' + esc(p.id + " · " + money(p.amount) + " · " + fmtDate(p.date)) + '" readonly>') +
        field("Refund amount", '<input class="input amt" type="number" name="amount" min="0.01" step="0.01" max="' + p.amount + '" value="' + p.amount + '" required>') +
        field("Date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Refund from", sel("account", accountOpts(p.account))) +
        '<div class="field span2"><label>Reason</label><input class="input" name="reason"></div></div>',
      submitText: "Record refund",
      onSubmit: function(d){
        const amt = +d.amount;
        if (!amt || amt <= 0) { toast("Enter the refund amount", "bad"); return false; }
        DataService.saveRefund({ date: d.date || today(), studentId: p.studentId, feeId: p.feeId, paymentId: p.id,
          source: p.source, amount: amt, reason: d.reason, account: d.account });
        toast(money(amt) + " refunded", "ok"); render();
      } });
  },

  /* ---------------- WhatsApp ---------------- */
  "wa-remind": (id) => {
    const v = withBasis(Logic.feeView(DataService.getFee(id)));
    Actions._wa(v.whatsapp, Logic.reminderText(v), "Reminder — " + v.studentName);
  },
  "wa-received": (id) => {
    const p = DataService.getPayments().find(x => x.id === id);
    const v = Logic.feeView(DataService.getFee(p.feeId));
    Actions._wa(v.whatsapp, Logic.receivedText(v, p.amount), "Payment confirmation — " + v.studentName);
  },
  "wa-student": (id) => {
    const open = Logic.feeViews({ studentId: id }).filter(v => v.balance > 0).sort((a, b) => a.month < b.month ? -1 : 1);
    if (!open.length) { toast("Nothing outstanding for this student", "warn"); return; }
    Actions["wa-remind"](open[0].id);
  },
  _wa: (number, text, title) => openModal({ title: title, hideSubmit: true, cancelText: "Close",
    body: '<div class="field"><label>Message</label><textarea class="textarea" id="waText" rows="11">' + esc(text) + '</textarea></div>' +
      '<input type="hidden" id="waNum" value="' + esc(number || "") + '">' +
      '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-wa" data-act="wa-open">Open WhatsApp</button>' +
      '<button type="button" class="btn" data-act="wa-copy">Copy message</button></div>' +
      '<p class="hint" style="margin-top:9px">Sending to ' + esc(number || "no number saved") + '</p>' }),
  "wa-open": () => {
    const n = $("#waNum").value;
    if (!n) { toast("No WhatsApp number saved for this student", "bad"); return; }
    window.open(Logic.waLink(n, $("#waText").value), "_blank");
  },
  "wa-copy": () => {
    const t = $("#waText"); t.select();
    if (navigator.clipboard) navigator.clipboard.writeText(t.value).then(() => toast("Message copied", "ok"));
    else { document.execCommand("copy"); toast("Message copied", "ok"); }
  },

  /* ---------------- teachers ---------------- */
  "staff-new": () => openModal({ title: "Add staff", wide: true, body: teacherForm({ kind: "staff" }), submitText: "Save staff",
    onSubmit: function(d){
      if (!String(d.name || "").trim()) { toast("Name is needed", "bad"); return false; }
      d.kind = "staff"; delete d.id; joinCC(d);
      const id = DataService.saveTeacher(d);
      toast("Staff " + id + " added", "ok"); celebrate("👤"); render();
    } }),
  "teacher-new": () => openModal({ title: "Add teacher", wide: true, body: teacherForm({}), submitText: "Save teacher",
    onSubmit: function(d){
      if (!String(d.name || "").trim()) { toast("Name is needed", "bad"); return false; }
      delete d.id; joinCC(d);
      if (d.kind !== "staff") d.role = "";
      const id = DataService.saveTeacher(d);
      toast((d.kind === "staff" ? "Staff " : "Teacher ") + id + " added", "ok"); celebrate(d.kind === "staff" ? "👤" : "🧑‍🏫"); render();
    } }),
  "teacher-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: teacherForm(DataService.getTeacher(id)), submitText: "Save changes",
    onSubmit: function(d){ if (!String(d.name || "").trim()) { toast("Name is needed", "bad"); return false; }
      d.id = id; joinCC(d); DataService.saveTeacher(d); toast("Saved", "ok"); render(); } }),

  /* ---------------- income / expense / accounts ---------------- */
  "inc-new": () => openModal({ title: "Add income", body: incomeForm({}), submitText: "Save income",
    onSubmit: function(d){ if (!(+d.amount)) { toast("Enter the amount", "bad"); return false; }
      d.amount = +d.amount; delete d.id;
      const id = DataService.saveIncome(d); toast("Income " + id + " added", "ok"); render(); } }),
  "inc-edit": (id) => openModal({ title: "Edit " + id, body: incomeForm(DataService.getIncome().find(x => x.id === id)), submitText: "Save changes",
    onSubmit: function(d){ d.id = id; d.amount = +d.amount || 0; DataService.saveIncome(d); toast("Income updated", "ok"); render(); } }),
  "income-csv": () => downloadCSV("income.csv", ["Income ID","Date","Category","Description","Source","Amount","Account","Reference","Notes"],
    DataService.getIncome().map(x => [x.id, x.date, x.category, x.description, x.source, x.amount, x.account, x.reference, x.notes])),
  "exp-new": () => openModal({ title: "Add expense", body: expenseForm({}), submitText: "Save expense",
    onSubmit: function(d){ if (!(+d.amount)) { toast("Enter the amount", "bad"); return false; }
      d.amount = +d.amount; delete d.id;
      const id = DataService.saveExpense(d); toast("Expense " + id + " added", "ok"); render(); } }),
  "exp-edit": (id) => openModal({ title: "Edit " + id, body: expenseForm(DataService.getExpenses().find(x => x.id === id)), submitText: "Save changes",
    onSubmit: function(d){ d.id = id; d.amount = +d.amount || 0; DataService.saveExpense(d); toast("Expense updated", "ok"); render(); } }),
  "expenses-csv": () => downloadCSV("expenses.csv", ["Expense ID","Date","Category","Description","Payee","Amount","Account","Reference","Notes"],
    DataService.getExpenses().map(x => [x.id, x.date, x.category, x.description, x.payee, x.amount, x.account, x.reference, x.notes])),
  "transfer-new": () => openModal({ title: "Move money between accounts",
    body: '<div class="note">A transfer is not income and not an expense. It only moves the balance, so your profit does not change.</div>' +
      '<div class="form-grid">' + field("From", sel("from", accountOpts("Cash"))) + field("To", sel("to", accountOpts("Bank"))) +
      field("Amount", '<input class="input amt" type="number" name="amount" min="0.01" step="0.01" required>') +
      field("Date", '<input class="input" type="date" name="date" value="' + today() + '">') +
      '<div class="field span2"><label>Note</label><input class="input" name="notes"></div></div>',
    submitText: "Move it",
    onSubmit: function(d){
      const amt = +d.amount;
      if (!amt || amt <= 0) { toast("Enter the amount", "bad"); return false; }
      if (d.from === d.to) { toast("Choose two different accounts", "bad"); return false; }
      DataService.saveTransfer({ date: d.date || today(), from: d.from, to: d.to, amount: amt, notes: d.notes });
      toast(money(amt) + " moved from " + d.from + " to " + d.to, "ok"); render();
    } }),
  "opening-edit": () => openModal({ title: "Opening balances",
    body: '<div class="note">What each account held before you started using this app.</div><div class="form-grid">' +
      DataService.getAccounts().map(a => field(a.name + " opening",
        '<input class="input amt" type="number" step="0.01" name="op_' + a.id + '" value="' + (+a.opening || 0) + '">')).join("") + '</div>',
    submitText: "Save",
    onSubmit: function(d){
      DataService.getAccounts().forEach(a => DataService.saveAccount({ id: a.id, name: a.name, opening: +d["op_" + a.id] || 0 }));
      toast("Opening balances saved", "ok"); render();
    } }),
  "ledger-account": (id) => { State.ledger.account = id; go("ledger"); },
  "ledger-csv": () => downloadCSV("ledger.csv", ["Date","ID","Type","Stream","Category","Description","Income","Expense","Account","Reference"],
    Logic.ledger().map(r => [r.date, r.id, r.type, r.source, r.category, r.desc, r.inAmt || "", r.outAmt || "", r.account, r.ref])),

  /* ---------------- reports ---------------- */
  "rep-preset": (id, el) => { State.reports.preset = el.dataset.p; resetLists(); render(); },
  "rep-csv": () => { const rep = buildReport(); downloadCSV(State.reports.which + "-report.csv", rep.csv.headers, rep.csv.rows); },
  "rep-statement": (id) => { State.reports.which = "statement"; State.reports.studentId = id; State.reports.preset = "month"; go("reports"); },

  /* ---------------- course formats ---------------- */
  "fmt-new": () => Actions["_fmt-form"](null),
  "fmt-edit": (id) => Actions["_fmt-form"](id),
  "_fmt-form": (id) => {
    const fmt = id ? (Settings().courseFormats || []).find(f => f.id === id) : {};
    openModal({ title: id ? "Edit format" : "Add course format", body: '<div class="form-grid">' +
      field("Format name", '<input class="input" name="name" required value="' + esc(fmt.name || "") + '" placeholder="e.g. Tarteel — weekly 3 day">') +
      field("Course", sel("course", courseOpts(fmt.course, "Select course"))) +
      field("Stream", sel("stream", optList([{value:"batch",label:"Batch"},{value:"individual",label:"Individual"}], fmt.stream || "batch"))) +
      field("Monthly fee", '<input class="input" type="number" min="0" name="monthlyFee" value="' + esc(fmt.monthlyFee || 0) + '">') +
      '<div class="field span2"><label>Class days</label><div>' + dayBoxes(fmt.days) + '</div></div>' +
    '</div>', submitText: id ? "Save format" : "Add format",
      onSubmit: function(d){
        if (!d.name) { toast("Format name is needed", "bad"); return false; }
        const list = (Settings().courseFormats || []).slice();
        const days = Array.isArray(d.days) ? d.days.join(",") : (d.days || "");
        const rec = { id: id || ("F" + Date.now().toString(36)), name: d.name, course: d.course || "",
          stream: d.stream || "batch", days: days, monthlyFee: +d.monthlyFee || 0 };
        const i = list.findIndex(f => f.id === rec.id);
        if (i >= 0) list[i] = rec; else list.push(rec);
        DataService.saveSettings({ courseFormats: list });
        toast(id ? "Format saved" : "Format added", "ok"); render();
      } });
  },
  "fmt-del": (id) => confirmAction({ title: "Remove format", message: "Remove this course format?", danger: true, submitText: "Remove",
    onConfirm: function(){
      const list = (Settings().courseFormats || []).filter(f => f.id !== id);
      DataService.saveSettings({ courseFormats: list }); toast("Format removed", "ok"); render();
    } }),

  /* ---------------- settings + data ---------------- */
  "settings-save": () => {
    const patch = {};
    ["academyName","academyTagline","website","email","contactPhone","whatsappNumber","currency","countryCode",
     "defaultDueDay","teacherLinkBase","apiUrl","syncKey","syncEvery","welcomeTerms"].forEach(k => {
      const el = $("#set_" + k); if (el) patch[k] = el.value;
    });
    patch.defaultDueDay = +patch.defaultDueDay || 5;
    const so = $("#set_syncOn"); if (so) patch.syncOn = so.checked;
    if (patch.syncEvery !== undefined) patch.syncEvery = Math.max(1, +patch.syncEvery || 3);
    const file = $("#set_logoFile");
    if (file && file.files && file.files[0]) {
      const r = new FileReader();
      r.onload = function(){ patch.logo = r.result; DataService.saveSettings(patch); toast("Settings saved", "ok"); render(); };
      r.readAsDataURL(file.files[0]);
      return;
    }
    DataService.saveSettings(patch); toast("Settings saved", "ok"); Sync.start(); render();
  },
  "logo-clear": () => { DataService.saveSettings({ logo: "" }); toast("Logo removed", "ok"); render(); },
  "list-add": (id, el) => {
    const k = el.dataset.k, input = $("#add_" + k), val = (input.value || "").trim();
    if (!val) { toast("Type a value first", "bad"); return; }
    const list = (Settings()[k] || []).slice();
    if (list.indexOf(val) >= 0) { toast("Already in the list", "warn"); return; }
    list.push(val);
    const p = {}; p[k] = list; DataService.saveSettings(p); render();
  },
  "list-del": (id, el) => {
    const k = el.dataset.k, i = +el.dataset.i, list = (Settings()[k] || []).slice();
    confirmAction({ title: "Remove from list", note: "Records already using it keep the value — it only leaves the dropdown.",
      message: 'Remove "' + list[i] + '"?',
      onConfirm: function(){ list.splice(i, 1); const p = {}; p[k] = list; DataService.saveSettings(p); render(); } });
  },
  "backup": () => {
    try {
      const blob = new Blob([JSON.stringify(DataService.exportAll(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "manzilulquran-backup-" + today() + ".json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1500);
      toast("Backup downloaded", "ok");
    } catch (e) { toast("Could not create the file here", "bad"); }
  },
});


/* ---- start fresh / import helpers ---- */
const WIPE_COLLS = SUPA_COLLS.filter(c => c !== "settings" && c !== "accounts");
async function supaUpsert(coll, recs, deleted){
  const rows = recs.filter(x => x && x.id).map(x => ({ id: String(x.id), data: x, deleted: !!deleted }));
  for (let j = 0; j < rows.length; j += 200) {
    const { error } = await Supa.client.from(SUPA_TABLE[coll]).upsert(rows.slice(j, j + 200), { onConflict: "id" });
    if (error) throw new Error(coll + ": " + error.message);
  }
  return rows.length;
}
/* every row of a table, page by page (Supa.selectAll), in the { data, error } shape */
async function supaReadAll(c){
  try { return { data: await Supa.selectAll(SUPA_TABLE[c]), error: null }; }
  catch (e) { return { data: null, error: { message: String(e.message || e) } }; }
}
function supaReady(){ return typeof Supa !== "undefined" && Supa.on() && (Supa.st.ready || Supa.init()); }
let WIPE_SNAPSHOT = null;
function wipeScreen(title, html, done){
  openModal({ title: title, submitText: done ? "Close" : "Working…",
    body: '<div id="wipeBody">' + html + '</div>' +
      (done && WIPE_SNAPSHOT ? '<div style="margin-top:12px"><button type="button" class="btn" data-act="wipe-backup">⬇️ Download backup of the deleted data</button></div>' : "") });
  const b = document.querySelector('#mForm button[type="submit"]'); if (b) b.disabled = !done;
}
/* Deletes from what Supabase actually holds (not only what this device has), then reads Supabase again to prove it. */
async function wipeAll(){
  WIPE_SNAPSHOT = DataService.exportAll();
  const rows = [], problems = [];
  const line = () => rows.map(r => '<div class="minirow"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join("");
  wipeScreen("Deleting records…", '<div class="note">Keep this page open.</div>', false);
  const set = h => { const el = document.getElementById("wipeBody"); if (el) el.innerHTML = h; };
  if (supaReady()) {
    Supa.paint("busy", "deleting records");
    for (const c of WIPE_COLLS) {
      set('<div class="note">Keep this page open — removing <b>' + esc(c) + '</b>…</div>' + line());
      try {
        const { data, error } = await supaReadAll(c);
        if (error) throw new Error(error.message);
        const live = (data || []).filter(r => !r.deleted);
        const recs = live.map(r => Object.assign({}, r.data || {}, { id: r.id }));
        if (recs.length) await supaUpsert(c, recs, true);
        rows.push([c, recs.length + " removed"]);
      } catch (e) { rows.push([c, "FAILED"]); problems.push(c + ": " + (e.message || e)); }
    }
    /* verify: read every table back */
    const left = [];
    for (const c of WIPE_COLLS) {
      try {
        const { data, error } = await supaReadAll(c);
        if (error) throw new Error(error.message);
        const n = (data || []).filter(r => !r.deleted).length;
        if (n) left.push(c + ": " + n);
      } catch (e) { left.push(c + ": could not check (" + (e.message || e) + ")"); }
    }
    if (left.length) problems.push("Still in Supabase → " + left.join(", "));
    Supa.paint(problems.length ? "err" : "ok", problems.length ? problems[0] : "deleted");
  } else problems.push("Supabase is not connected — only this device was cleared.");
  WIPE_COLLS.forEach(c => DB[c] = []);
  persist();
  UI.open = {}; UI.limit = {};
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  render();
  wipeScreen(problems.length ? "Delete finished with problems" : "All academy records deleted",
    (problems.length
      ? '<div class="note" style="border-color:#e0776b">' + problems.map(esc).join("<br>") + '</div>'
      : '<div class="note">✅ Checked: Supabase now holds 0 academy records. Settings and money accounts were kept.</div>') +
    line() + '<div class="note" style="margin-top:10px">Next: Settings → 📥 Import records (JSON) to load the real data.</div>', true);
  toast(problems.length ? "Delete finished with problems — see the result screen" : "All academy records deleted", problems.length ? "bad" : "ok", 6000);
}
async function importRecords(plan){
  plan.forEach(function(p){
    const list = DB[p.c] = DB[p.c] || [];
    p.recs.forEach(function(x){
      const i = list.findIndex(y => y.id === x.id);
      if (i >= 0) list[i] = Object.assign({}, list[i], x); else list.push(Object.assign({}, x));
    });
  });
  persist();
  const total = plan.reduce((a, p) => a + p.recs.length, 0);
  if (supaReady()) {
    Supa.paint("busy", "saving import");
    try { for (const p of plan) await supaUpsert(p.c, p.recs.map(x => DB[p.c].find(y => y.id === x.id)), false); Supa.paint("ok", "saved"); }
    catch (e) { Supa.paint("err", String(e.message || e)); toast("Imported on this device, but Supabase refused: " + (e.message || e), "bad", 8000); render(); return; }
  }
  toast(total + " records imported", "ok", 4200); render();
}

/* v21: one "Remove (entered by mistake)" for every kind of money entry. The entry stays on record as removed with the
   reason, and drops out of every total, the ledger, the accounts and the reports at once — nothing else needs fixing. */
const VOID_KIND = {
  payment: { coll: "payments",        what: "payment",         who: x => (DataService.getStudent(x.studentId) || {}).name || x.studentId,
             hint: " If the money really went back to the family, use Refund instead." },
  teacher: { coll: "teacherPayments", what: "teacher payment", who: x => (DataService.getTeacher(x.teacherId) || {}).name || x.teacherId, hint: "" },
  expense: { coll: "expenses",        what: "expense",         who: x => x.description || x.payee || x.category, hint: "" },
  income:  { coll: "income",          what: "income entry",    who: x => x.description || x.source || x.category, hint: "" }
};
function voidDialog(kind, id){
  const K = VOID_KIND[kind] || VOID_KIND.payment;
  const p = (DB[K.coll] || []).find(x => x.id === id);
  if (!p) { toast("Entry not found", "bad"); return; }
  if (p.voided) { toast("Already removed", "warn"); return; }
  openModal({ title: "Remove " + id, submitText: "Remove it", danger: true,
    body: '<div class="note">Only for a ' + K.what + ' <b>entered by mistake</b> — wrong person, wrong amount, or entered twice. ' +
      'It comes out of every total, the ledger, the account balance and the reports at once, and stays in the history as removed.' + esc(K.hint) + '</div>' +
      dl([["Entry", esc(K.who(p))], ["Amount", money(p.amount)], ["Date", fmtDate(p.date)],
          p.month ? ["For month", monthLabel(p.month)] : null, ["Account", esc(p.account || "—")]]) +
      '<div class="form-grid">' +
      '<div class="field span2"><label>Reason *</label><input class="input" name="reason" placeholder="e.g. entered twice, wrong student" required></div>' +
      field("Password", '<input class="input" type="password" name="pw" autocomplete="off">') +
      '</div>',
    onSubmit: function(d){
      if (!String(d.reason || "").trim()) { toast("Give a reason", "bad"); return false; }
      if (d.pw !== SHEET_LOCK_PW) { toast("Wrong password", "bad"); return false; }
      const why = d.reason.trim();
      if (kind === "teacher") DataService.voidTeacherPayment(id, why);
      else if (kind === "payment") DataService.voidPayment(id, why);
      else DataService.voidEntry(K.coll, id, why);
      toast(money(p.amount) + " removed — every total is updated", "ok", 4200); render();
    } });
}

/* ---- welcome letter: the live details, the page, and the print window ---- */
const WELCOME_DUA = {
  ar: "رَبِّ زِدْنِي عِلْمًا",
  tr: "Rabbi zidni ilma",
  en: "My Lord, increase me in knowledge.",
  src: "Surah Ta-Ha 20:114"
};
const WELCOME_HADITH = {
  en: "The best of you are those who learn the Quran and teach it.",
  src: "Prophet Muhammad ﷺ · Sahih al-Bukhari"
};
const WELCOME_COURSE = {
  hifz: "A structured memorisation programme built around daily new lessons (sabaq), recent revision (sabqi) and long-term revision (manzil), so the Quran is preserved firmly in the heart.",
  base: "Foundational recitation focusing on correct pronunciation (makharij), the Arabic letters and the basics of tajweed for clear, confident reading.",
  advanced: "Refined recitation that masters the finer rules of tajweed, rhythm and fluency for beautiful and accurate recitation.",
  batch: "Group Islamic studies covering Quran reading alongside the essentials of faith, worship and good character.",
  individual: "One-to-one Islamic studies at your own pace, covering the Quran and the foundations of deen.",
  tarteel: "Clear, measured recitation of the Quran with correct pronunciation and the rules of tajweed.",
  madrasa: "Islamic studies covering the Quran along with the essentials of faith, worship and good character."
};
function welcomeCourseText(course){
  const c = String(course || "").toLowerCase();
  const key = ["hifz", "advanced", "base", "batch", "individual", "tarteel", "madrasa"].find(k => c.indexOf(k) >= 0);
  return key ? WELCOME_COURSE[key] : "A guided programme of Quran and Islamic studies suited to your level.";
}
const WELCOME_CHECKLIST = ["A clean copy of the Quran or Mushaf suited to your level",
  "A notebook and pen for lesson notes", "A stable internet connection and a charged device",
  "A quiet, well-lit place, with headphones if possible", "Join the class a few minutes early"];
const WELCOME_COMMITMENTS = ["Attend regularly and arrive on time", "Revise a little every day, even on busy days",
  "Keep the camera on during class when requested", "Keep respectful and modest conduct",
  "Tell us early whenever you need support"];
const WELCOME_TERMS_DEFAULT = [
  "If a teacher is on leave the class is rescheduled. Where rescheduling is not possible, appropriate compensation is given.",
  "Students who tell us of their leave at least one day in advance are equally eligible for a rescheduled class or compensation.",
  "Fees are paid in advance for the coming month, on the due date shown above.",
  "Hifz students who consistently complete their assigned tasks may be given a special fee concession, in sha Allah."
];
function welcomeTerms(){
  const raw = String(Settings().welcomeTerms || "").trim();
  return raw ? raw.split("\n").map(x => x.trim()).filter(Boolean) : WELCOME_TERMS_DEFAULT;
}
/* the app stores class times as 24-hour ("18:00"); letters read better as 6:00 PM */
function time12(t){
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "").trim());
  if (!m) return String(t || "");
  let h = +m[1]; const mi = m[2], ap = h >= 12 ? "PM" : "AM";
  h = h % 12; if (!h) h = 12;
  return h + ":" + mi + " " + ap;
}
function timeRange(start, end, mins){
  const a = time12(start), b = end ? time12(end) : "";
  if (!a) return "";
  return a + (b ? " – " + b : "") + (mins ? " (" + mins + " min)" : "");
}
const DOW_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
function welcomeHoliday(days){
  const all = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const off = all.filter(d => (days || []).indexOf(d) < 0).map(d => DOW_FULL[d]);
  if (!days || !days.length) return "As arranged with your teacher";
  if (!off.length) return "No weekly holiday";
  return off.length > 2 ? off.slice(0, -1).join(", ") + " and " + off[off.length - 1] : off.join(" and ");
}
/* pull everything the letter needs out of the plan or the enrolment */
function welcomeData(st, src){
  const kind = String(src || "").split(":")[0], id = String(src || "").split(":")[1];
  const out = { kind: kind, note: "", fee: "", course: "", time: "", perWeek: "", holiday: "", startDate: "", dueDate: "", teacher: "" };
  if (kind === "plan") {
    const p = DataService.getPlans().find(x => x.id === id); if (!p) return out;
    const t = DataService.getTeacher(p.teacherId);
    out.course = p.course || "Individual class";
    out.time = p.time ? timeRange(p.time, "", p.duration) : "";
    out.perWeek = (p.days || []).length || p.perWeek || "";
    out.holiday = welcomeHoliday(p.days);
    out.startDate = p.startDate || st.joiningDate || "";
    out.dueDate = Logic.feeDueDate(addMonths(currentMonth(), 1), p.dueDay || 5);
    out.fee = +p.rate ? money(p.rate) : "";
    out.teacher = t ? t.name : "";
  } else {
    const e = DataService.getEnrollments().find(x => x.id === id); if (!e) return out;
    const b = DataService.getBatch(e.batchId) || {};
    const sc = e.subClassId ? DataService.getSubclass(e.subClassId) : null;
    const days = (sc && sc.days && sc.days.length ? sc.days : b.days) || [];
    const t = DataService.getTeacher((sc && sc.teacherId) || b.teacherId);
    out.course = b.course || b.name || "Batch class";
    const t1 = (sc && sc.startTime) || b.startTime, t2 = (sc && sc.endTime) || b.endTime;
    out.time = timeRange(t1, t2, (sc && sc.duration) || b.duration);
    out.perWeek = days.length;
    out.holiday = welcomeHoliday(days);
    out.startDate = e.joiningDate || st.joiningDate || "";
    out.dueDate = Logic.feeDueDate(addMonths(currentMonth(), 1), e.dueDay || 5);
    out.fee = Logic.enrolFee(e) ? money(Logic.enrolFee(e)) : "";
    out.teacher = t ? t.name : "";
    out.batchName = b.name || e.batchId;
  }
  return out;
}
function welcomeFields(w){
  return '<div class="form-grid" style="padding:0">' +
    field("Course", '<input class="input" name="course" value="' + esc(w.course || "") + '">') +
    field("Class time", '<input class="input" name="time" value="' + esc(w.time || "") + '" placeholder="e.g. 7:00 AM – 7:45 AM">') +
    field("First class date", '<input class="input" type="date" name="startDate" value="' + esc(w.startDate || "") + '">') +
    field("Next due date", '<input class="input" type="date" name="dueDate" value="' + esc(w.dueDate || "") + '">') +
    field("Classes per week", '<input class="input" type="number" min="0" max="7" name="perWeek" value="' + esc(w.perWeek || "") + '">') +
    field("Weekly holiday", '<input class="input" name="holiday" value="' + esc(w.holiday || "") + '">') +
    field("Monthly fee", '<input class="input" name="fee" value="' + esc(w.fee || "") + '">') +
    '<div class="field span2"><label>Personal note <span class="hint">(optional)</span></label>' +
      '<textarea class="input" name="note" rows="2" placeholder="A short line to the family"></textarea></div>' +
  '</div>';
}
function welcomeLetterHTML(st, w){
  const s = Settings();
  const rows = [["Student name", st.name], ["Admission no.", st.id]];
  if (st.guardian) rows.push(["Guardian", st.guardian]);
  rows.push(["Course", w.course || "—"]);
  if (w.batchName) rows.push(["Batch", w.batchName]);
  if (w.teacher) rows.push(["Teacher", w.teacher]);
  if (st.joiningDate) rows.push(["Joining date", fmtDate(st.joiningDate)]);
  rows.push(["First class", w.startDate ? fmtDate(w.startDate) : "—"]);
  rows.push(["Class time", w.time || "As arranged with your teacher"]);
  if (w.perWeek) rows.push(["Class days", w.perWeek + " per week"]);
  rows.push(["Weekly holiday", w.holiday || "As arranged with your teacher"]);
  if (w.dueDate) rows.push(["Next due date", fmtDate(w.dueDate)]);
  if (w.fee) rows.push(["Monthly fee", w.fee]);
  const contact = [s.whatsappNumber || s.contactPhone, s.email].filter(Boolean).join("  ·  ") || s.website || "manzilulquran.in";
  const list = a => '<ul>' + a.map(x => '<li>' + esc(x) + '</li>').join("") + '</ul>';
  const sec = t => '<h4>' + esc(t) + '</h4>';
  return '<!doctype html><html><head><meta charset="utf-8"><title>Welcome — ' + esc(st.name) + '</title>' +
  '<style>' +
  '@page{ size:A4; margin:16mm 14mm; }' +
  '*{ box-sizing:border-box; }' +
  'body{ margin:0; background:#EFE9DC; color:#262824; font-family:Georgia,"Times New Roman",serif; font-size:11.4pt; line-height:1.58; }' +
  '.sheet{ max-width:190mm; margin:14px auto; background:#FDFBF5; padding:22px 26px 26px; position:relative;' +
  ' border:1px solid #E2D6BC; border-radius:6px; box-shadow:0 10px 30px rgba(0,0,0,.09); }' +
  '.sheet:before{ content:""; position:absolute; inset:7px; border:1px solid #E6CE9C; border-radius:4px; pointer-events:none; }' +
  '.sheet.editing{ outline:2px dashed #1B7A5A; outline-offset:6px; }' +
  '.wm{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none;' +
  ' font-size:150pt; color:#0B4D3B; opacity:.035; }' +
  '.hd{ text-align:center; padding:8px 0 14px; margin-bottom:16px; position:relative; }' +
  '.mark{ width:58px; height:58px; border-radius:50%; margin:0 auto 9px; background:#0B4D3B; color:#E6CE9C;' +
  ' display:flex; align-items:center; justify-content:center; font-size:27px; border:2px solid #C9A96E; }' +
  '.hd h1{ margin:0; font-size:19.5pt; color:#0B4D3B; letter-spacing:.3px; }' +
  '.hd .tag{ margin-top:5px; font-size:9.5pt; letter-spacing:.22em; text-transform:uppercase; color:#B08D57; }' +
  '.rule{ margin:12px auto 0; width:62%; height:10px; position:relative; }' +
  '.rule:before{ content:""; position:absolute; top:5px; left:0; right:0; height:1px; background:' +
  'linear-gradient(90deg,rgba(201,169,110,0),#C9A96E,rgba(201,169,110,0)); }' +
  '.rule span{ position:absolute; left:50%; top:0; transform:translateX(-50%); background:#FDFBF5; padding:0 8px; color:#C9A96E; font-size:11pt; }' +
  'h4{ margin:20px 0 7px; font-size:11.5pt; color:#0B4D3B; border-bottom:1px solid #E6CE9C; padding-bottom:4px; }' +
  '.greet{ color:#1B7A5A; font-style:italic; }' +
  '.dear{ margin:10px 0 6px; font-weight:bold; }' +
  'table.det{ width:100%; border-collapse:collapse; margin-top:4px; }' +
  'table.det td{ padding:6px 8px; border-bottom:1px solid #EFE7D6; vertical-align:top; }' +
  'table.det td.k{ width:42%; color:#6B6F66; font-size:10.4pt; }' +
  'table.det td.v{ font-weight:bold; }' +
  'ul{ margin:6px 0 0 18px; padding:0; } li{ margin:3px 0; }' +
  '.callout{ background:#F8F0DD; border-left:4px solid #C9A96E; padding:9px 12px; margin:10px 0; border-radius:0 8px 8px 0; }' +
  '.dua{ text-align:center; background:#EAF3EE; border:1px solid #CFE3D8; border-radius:12px; padding:14px; margin:18px 0 10px; }' +
  '.dua .ar{ font-family:"Traditional Arabic","Scheherazade New","Amiri","Noto Naskh Arabic",serif; font-size:21pt;' +
  ' direction:rtl; color:#0B4D3B; line-height:1.9; }' +
  '.dua .tr{ font-style:italic; color:#1B7A5A; margin-top:4px; }' +
  '.dua .en{ margin-top:2px; } .dua .src{ font-size:9.5pt; color:#8A8F86; margin-top:4px; }' +
  '.hadith{ text-align:center; border-top:1px solid #E6CE9C; border-bottom:1px solid #E6CE9C; padding:12px; margin:12px 0; font-style:italic; color:#0B4D3B; }' +
  '.hadith .src{ font-style:normal; font-size:9.5pt; color:#8A8F86; margin-top:4px; }' +
  '.sig{ margin-top:16px; }' +
  '.ft{ margin-top:18px; border-top:1px solid #C9A96E; padding-top:8px; display:flex; justify-content:space-between; font-size:9.5pt; color:#6B6F66; }' +
  '.tipline{ font-size:10pt; color:#4A5A50; margin-top:7px; }' +
  '.noprint{ text-align:center; padding:12px; }' +
  '.noprint button{ font:inherit; font-size:11pt; padding:9px 18px; margin:0 5px; border-radius:9px; border:1px solid #0B4D3B;' +
  ' background:#0B4D3B; color:#fff; cursor:pointer; }' +
  '.noprint .alt{ background:#fff; color:#0B4D3B; }' +
  '@media print{ .noprint{ display:none; } body{ background:#fff; } .sheet{ background:#fff; box-shadow:none; } }' +
  '</style>' +
  '<script>function toggleEdit(){var s=document.querySelector(".sheet"),b=document.getElementById("edit"),t=document.getElementById("tipline");' +
  'var on=s.getAttribute("contenteditable")==="true";s.setAttribute("contenteditable",on?"false":"true");' +
  's.classList.toggle("editing",!on);b.textContent=on?"Edit the text":"Done editing";' +
  't.textContent=on?"Anything can be changed before printing — tap \\u201CEdit the text\\u201D, correct it, then print.":"Editing: tap any line and type. Changes are for this printout only.";' +
  'if(!on)s.focus();}<\/script></head><body>' +
  '<div class="noprint">' +
    '<button onclick="window.print()">Save as PDF / Print</button>' +
    '<button class="alt" id="edit" onclick="toggleEdit()">Edit the text</button>' +
    '<button class="alt" onclick="window.close()">Close</button>' +
    '<div class="tipline" id="tipline">Anything can be changed before printing — tap “Edit the text”, correct it, then print.</div>' +
  '</div>' +
  '<div class="sheet">' +
    '<div class="wm">☾</div>' +
    '<div class="hd"><div class="mark">☾</div><h1>' + esc(s.academyName || "ManzilulQuran E-learning Academy") + '</h1>' +
      '<div class="tag">Admission Confirmation</div><div class="rule"><span>✦</span></div></div>' +
    '<div class="greet">Assalamu Alaikum wa Rahmatullahi wa Barakatuh,</div>' +
    '<div class="dear">Dear ' + esc(st.name) + ',</div>' +
    '<div>We are delighted to welcome you to the ' + esc(s.academyName || "ManzilulQuran") + ' family. May Allah make this the beginning of a blessed and lasting journey with His Book. Your admission is confirmed and the details of your classes are set out below. Our teachers look forward to meeting you and supporting you at every step.</div>' +
    (w.note ? '<div class="callout">' + esc(w.note) + '</div>' : "") +
    sec("Your Academic Details") +
    '<table class="det">' + rows.map(r => '<tr><td class="k">' + esc(r[0]) + '</td><td class="v">' + esc(r[1]) + '</td></tr>').join("") + '</table>' +
    sec("About Your Course") + '<div>' + esc(welcomeCourseText(w.course)) + '</div>' +
    sec("Terms & Conditions") + list(welcomeTerms()) +
    sec("Before Your First Class") + list(WELCOME_CHECKLIST) +
    sec("Our Shared Commitment") + list(WELCOME_COMMITMENTS) +
    sec("Staying in Touch") + '<div>For rescheduling, fee queries or any support, reach us at <b>' + esc(contact) + '</b>. We are always happy to help.</div>' +
    '<div class="dua"><div class="ar">' + WELCOME_DUA.ar + '</div><div class="tr">' + esc(WELCOME_DUA.tr) + '</div>' +
      '<div class="en">“' + esc(WELCOME_DUA.en) + '”</div><div class="src">' + esc(WELCOME_DUA.src) + '</div></div>' +
    '<div class="hadith">“' + esc(WELCOME_HADITH.en) + '”<div class="src">' + esc(WELCOME_HADITH.src) + '</div></div>' +
    '<div>We look forward to walking this path of learning with you.' +
      '<div class="sig">With warm regards,<br><b>The ' + esc(s.academyName || "ManzilulQuran") + ' Team</b></div></div>' +
    '<div class="ft"><span>' + esc(s.website || "manzilulquran.in") + '</span><span>' + esc(contact) + '</span></div>' +
  '</div></body></html>';
}
function openWelcomeLetter(st, w){
  const html = welcomeLetterHTML(st, w);
  const win = window.open("", "_blank");
  if (!win) { toast("Allow pop-ups for this site, then try again", "bad", 6000); return; }
  win.document.open(); win.document.write(html); win.document.close();
  closeModal();
  toast("Welcome letter ready — use Save as PDF", "ok", 4200);
}

/* ---- v19: restore fees waived by the v18 "stop a plan" mistake ----
   v18 offered to waive "this plan's" unpaid months but listed every unpaid fee in the academy. Those fees carry the
   remark "Waived — class plan stopped". One belongs to the mistake when its own plan is not stopped (or it has no plan,
   e.g. a batch fee). A stopped plan's own months are left alone — undo one by hand (fee → untick Waived) if needed. */
const STOP_WAIVE = "Waived — class plan stopped";
function stopWaiveWrong(){
  return DB.fees.filter(function(f){
    if (!f.waived || String(f.remarks || "").indexOf(STOP_WAIVE) < 0) return false;
    const pl = f.planId ? DataService.getPlan(f.planId) : null;
    return !(pl && pl.status === "Stopped");
  });
}
function stopWaiveNote(){
  const n = stopWaiveWrong().length;
  return n ? '<div class="note" style="border-color:#e0776b">⚠ ' + n + ' fee' + (n > 1 ? "s were" : " was") + ' waived by mistake when a class plan ' +
    'was stopped (they belong to other students, whose classes are still running). ' +
    '<button type="button" class="btn btn-sm btn-primary" data-act="stopwaive-fix" style="margin-left:6px">Restore ' + n + ' fee' + (n > 1 ? "s" : "") + '</button></div>' : "";
}
Actions["stopwaive-fix"] = function(){
  const list = stopWaiveWrong(); if (!list.length) { toast("Nothing to restore", "ok"); render(); return; }
  confirmAction({ title: "Restore " + list.length + " fee" + (list.length > 1 ? "s" : ""),
    note: "These fees were waived only because another student's class plan was stopped. Restoring makes them owing again, exactly as before.",
    message: list.slice(0, 12).map(f => { const st = DataService.getStudent(f.studentId); return (st ? st.name : f.studentId) + " · " + monthLabel(f.month); }).join(" · ") +
      (list.length > 12 ? " · and " + (list.length - 12) + " more" : ""),
    submitText: "Restore them",
    onConfirm: function(){
      list.forEach(function(f){
        const rem = String(f.remarks || "").split(" · ").filter(x => x !== STOP_WAIVE).join(" · ");
        DataService.saveFee({ id: f.id, waived: false, locked: false, remarks: rem });
      });
      toast(list.length + " fee" + (list.length > 1 ? "s" : "") + " restored", "ok", 4200); render();
    } });
};
if (!window.MQ_ADMIN) ["iFees", "bFees"].forEach(function(pg){
  const orig = Pages[pg]; if (typeof orig !== "function") return;
  Pages[pg] = function(){ return stopWaiveNote() + orig.apply(this, arguments); };
});


/* ==========================================================================
   v21 — teacher profile, Remove (kept in v22)
   ========================================================================== */
Object.assign(Actions, {
  "teacher-open": (id) => {
    closeModal(true);
    const from = State.page === "tprofile" ? State.tprofile.from : State.page;
    State.tprofile = { teacherId: id, tab: (State.tprofile && State.tprofile.teacherId === id && State.tprofile.tab) || "students", from: from };
    go("tprofile");
  },
  "tp-tab": (id, el) => { State.tprofile.tab = el.dataset.t; render(); },
  "tp-back": () => go(State.tprofile.from && State.tprofile.from !== "tprofile" ? State.tprofile.from : "teachers"),
  "exp-void": (id) => voidDialog("expense", id),
  /* take a payment for a student: their oldest unpaid month is picked for you */
  "pay-for": (sid) => {
    const open = Logic.feeViews({ studentId: sid }).filter(v => v.balance > 0).sort((a, b) => a.month < b.month ? -1 : 1);
    if (open.length) { Actions["pay-new"](open[0].id); return; }
    Actions["pay-new"]();
    setTimeout(function(){ const f = $("#mForm"); if (!f || !f.elements.studentId) return; f.elements.studentId.value = sid; Actions["pay-student"](null, f.elements.studentId); }, 30);
  },
  "inc-void": (id) => voidDialog("income", id)
});

/* ==========================================================================
   v22 — simple mode: Due date, classes arranged with the student, manual salary
   ========================================================================== */
/* a class's fee changed: the unpaid rows of this month and later follow it (rows already paid or typed in by hand stay) */
function followFee(filter, fee, teacherId){
  let n = 0;
  DB.fees.filter(f => f.month >= currentMonth() && !f.waived && !f.override && Logic.paidOn(f.id) <= 0 &&
      Object.keys(filter).every(k => f[k] === filter[k])).forEach(function(f){
    const upd = { id: f.id };
    if (fee !== undefined && round2(+f.gross || 0) !== round2(fee)) { upd.gross = fee; upd.rate = fee; upd.discount = 0; upd.carry = 0; upd.needsAmount = !(fee > 0); }
    if (teacherId !== undefined && (f.teacherId || "") !== (teacherId || "")) upd.teacherId = teacherId || "";
    if (Object.keys(upd).length > 1) { DataService.saveFee(upd); n++; }
  });
  return n;
}
function activeClassCount(sid){
  return DataService.getPlans({ studentId: sid }).filter(p => p.status === "Active").length +
    DataService.getEnrollments({ studentId: sid }).filter(e => e.status === "Active").length;
}
Object.assign(Actions, {
  /* ---- the student form: show the part for the class chosen ---- */
  "cls-mode": (id, el) => {
    const form = el.closest("form"); if (!form) return;
    const v = el.value;
    form.querySelectorAll(".cls-sec").forEach(x => { x.hidden = x.dataset.cls !== v; });
    const first = form.querySelector(".cls-first"); if (first) first.hidden = v === "none";
  },
  "sf-batch": (id, el) => {
    const form = el.closest("form"), b = DataService.getBatch(el.value);
    if (form && form.elements.monthlyFee) form.elements.monthlyFee.placeholder = b && +b.monthlyFee ? String(+b.monthlyFee) + " (batch fee)" : "Batch fee";
  },
  "sf-join": (id, el) => {
    const form = el.closest("form"); if (!form) return;
    ["dueDay", "bDueDay"].forEach(n => { if (form.elements[n] && !form.elements[n]._typed) form.elements[n].value = dayOf(el.value); });
  },
  "student-new": () => openModal({ title: "New student", wide: true, body: studentForm({}, true), submitText: "Save student",
    onSubmit: function(d, form){
      const name = String(d.name || "").trim();
      if (!name) { toast("Type the student's name", "bad"); return false; }
      const mode = d.clsMode || "none", join = d.joiningDate || today();
      let batch = null;
      if (mode === "ind") {
        if (!String(d.course || "").trim()) { toast("Choose the course", "bad"); return false; }
        if (!(+d.rate > 0)) { toast("Type the monthly fee", "bad"); return false; }
        if (d.teacherId_q && !DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list — or clear the box", "bad"); return false; }
      }
      if (mode === "batch") {
        batch = DataService.getBatch(d.batchId);
        if (!batch) { toast("Choose the batch", "bad"); return false; }
      }
      const stu = joinCC({ name: name, guardian: d.guardian || "", whatsapp: d.whatsapp, whatsappCC: d.whatsappCC, phone: d.phone || "",
        email: d.email || "", gender: d.gender || "", dob: d.dob || "", joiningDate: join, address: d.address || "", notes: d.notes || "", status: "Active" });
      const sid = DataService.saveStudent(stu);
      let msg = "Student " + sid + " added";
      if (mode === "ind") {
        const days = readDays(form);
        const pid = DataService.savePlan({ studentId: sid, teacherId: DataService.getTeacher(d.teacherId) ? d.teacherId : "", course: d.course,
          days: days, perWeek: days.length, time: d.time || "", duration: +d.duration || 0, feeType: "monthly", rate: round2(+d.rate), discount: 0,
          dueDay: Math.min(28, Math.max(1, +d.dueDay || dayOf(join))), startDate: join, endDate: "", status: "Active", notes: "" });
        msg += " · " + d.course + " class" + (DataService.getTeacher(d.teacherId) ? "" : " (no teacher yet)");
        if (d.firstFee) { const fm = Logic.firstMonth(join), r = Logic.buildIndMonth(fm, { planId: pid, first: true, remark: "First month" });
          if (r.created) msg += " · " + monthLabel(fm) + " fee on the due list"; }
      } else if (mode === "batch") {
        const eid = DataService.saveEnrollment({ studentId: sid, batchId: batch.id, subClassId: "", joiningDate: join, leavingDate: "",
          monthlyFee: round2(+d.monthlyFee || +batch.monthlyFee || 0), dueDay: Math.min(28, Math.max(1, +d.bDueDay || dayOf(join))),
          status: "Active", reason: "", notes: "Initial enrolment" });
        msg += " · in " + batch.name;
        if (d.firstFee) { const fm = Logic.firstMonth(join), r = Logic.buildBatchMonth(fm, { enrollmentId: eid, first: true, remark: "First month" });
          if (r.created) msg += " · " + monthLabel(fm) + " fee on the due list"; }
      } else msg += " · class pending";
      toast(msg, "ok", 4600); celebrate("🎓"); render();
    } }),
  "student-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: studentForm(DataService.getStudent(id)), submitText: "Save changes",
    onSubmit: function(d){
      if (!String(d.name || "").trim()) { toast("Type the student's name", "bad"); return false; }
      const before = activeClassCount(id);
      d.id = id; joinCC(d); DataService.saveStudent(d);
      const closed = before - activeClassCount(id);
      toast(closed > 0 ? "Saved · " + closed + " class" + (closed > 1 ? "es" : "") + " stopped (student " + String(d.status).toLowerCase() + ")" : "Student updated", "ok", 4200);
      render();
    } }),
  "status-fix": () => {
    const list = DataService.statusConflicts();
    if (!list.length) { toast("Nothing to fix", "ok"); render(); return; }
    confirmAction({ title: "Close " + list.length + " student" + (list.length > 1 ? "s'" : "'s") + " classes",
      note: "These students are not Active, but a class of theirs is still running. Each class is stopped today and kept in history.",
      message: list.slice(0, 12).map(s => s.name + " (" + s.status + ")").join(" · "), submitText: "Close the classes",
      onConfirm: function(){ let n = 0; list.forEach(s => { n += DataService.closeClassesOf(s.id, s.status); });
        toast(n + " class" + (n > 1 ? "es" : "") + " closed", "ok"); render(); } });
  },
  "plans-noteacher": () => { State.plans.teacher = "none"; State.plans.status = "Active"; resetLists(); render(); },

  /* ---- Due date ---- */
  "due-build": (id, el) => {
    const src = (el && el.dataset.src) || "", m = State.month;
    const r = Logic.buildMonth(m, src);
    toast(r.created ? r.created + " added to the " + monthLabel(m) + " list" + (r.skipped ? " · " + r.skipped + " already there" : "") +
        (r.held ? " · " + r.held + " on hold" : "")
      : (r.skipped ? "Everyone is already on the " + monthLabel(m) + " list" : "No active class to add for " + monthLabel(m)), r.created ? "ok" : "warn", 4200);
    render();
  },
  "due-paid": (feeId) => {
    const f = DataService.getFee(feeId); if (!f) return;
    const v = withBasis(Logic.feeView(f)), notSet = Logic.dueStatus(v) === "Fee not set";
    openModal({ title: "Mark paid — " + v.studentName,
      body: '<div class="note">' + esc(monthLabel(v.month)) + ' · ' + esc(v.shortBasis) + (notSet ? " · the fee is not set yet — the amount you type becomes this month's fee" : " · fee " + money(v.netFee)) + '</div>' +
        '<div class="form-grid sf">' +
        field("Amount received *", '<input class="input amt" type="number" name="amount" min="1" step="1" inputmode="numeric" value="' + (v.balance > 0 ? v.balance : "") + '" required>') +
        field("Date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Paid by", sel("account", accountOpts("UPI"))) +
        field("Reference", '<input class="input mono" name="txnId" placeholder="Optional">') +
        '</div>',
      submitText: "Save payment",
      onSubmit: function(d){
        const amt = round2(+d.amount);
        if (!(amt > 0)) { toast("Type the amount received", "bad"); return false; }
        if (notSet) DataService.saveFee({ id: feeId, gross: amt, rate: amt, discount: 0, carry: 0, override: true, needsAmount: false });
        DataService.savePayment({ feeId: feeId, source: v.source, studentId: v.studentId, month: v.month, amount: amt,
          date: d.date || today(), account: d.account, txnId: d.txnId || "", remarks: "" });
        const after = Logic.feeView(DataService.getFee(feeId));
        toast(money(amt) + " from " + v.studentName + " · " + (after.balance > 0 ? money(after.balance) + " still pending" : "paid"), "ok", 4200);
        celebrate("₹"); render();
      } });
  },
  "due-share": (feeId) => {
    const f = DataService.getFee(feeId); if (!f) return;
    const v = withBasis(Logic.feeView(f)), st = Logic.dueStatus(v);
    if (st === "Paid" && v.lastPayment) { Actions._wa(v.whatsapp, Logic.receivedText(v, v.lastPayment.amount), "Receipt — " + v.studentName); return; }
    const amt = v.paidAmount > 0 ? v.balance : (st === "Fee not set" ? "" : v.netFee);
    openModal({ title: "Share fee — " + v.studentName, hideSubmit: true, cancelText: "Close",
      body: '<div class="form-grid sf">' +
          field(v.paidAmount > 0 ? "Amount pending" : "Fee to ask", '<input class="input amt" type="number" min="0" step="1" inputmode="numeric" id="shAmt" data-act="share-amt" data-id="' + esc(feeId) + '" value="' + esc(amt) + '">') +
          (v.paidAmount > 0 ? '<div></div>' : '<label class="sf-check" style="align-self:end"><input type="checkbox" id="shSave"' + (st === "Fee not set" ? " checked" : "") + '> Save it as ' + esc(monthShort(v.month)) + '\'s fee</label>') +
        '</div>' +
        '<div class="field" style="margin-top:10px"><label>Message</label><textarea class="textarea" id="waText" rows="10">' + esc(Logic.feeText(v, amt)) + '</textarea></div>' +
        '<input type="hidden" id="waNum" value="' + esc(v.whatsapp || "") + '">' +
        '<div class="btn-row" style="margin-top:12px"><button type="button" class="btn btn-wa" data-act="due-share-send" data-id="' + esc(feeId) + '">Open WhatsApp</button>' +
        '<button type="button" class="btn" data-act="wa-copy">Copy message</button></div>' +
        '<p class="hint" style="margin-top:9px">Sending to ' + esc(v.whatsapp || "no number saved") + '</p>' });
  },
  "due-share-send": (feeId) => {
    const box = $("#shAmt"), save = $("#shSave"), f = DataService.getFee(feeId);
    if (box && save && save.checked && f) {
      const amt = round2(+box.value || 0), v = Logic.feeView(f);
      if (amt > 0 && !(v.paidAmount > 0) && round2(v.netFee) !== amt) {
        DataService.saveFee({ id: feeId, gross: amt, rate: amt, discount: 0, carry: 0, override: true, needsAmount: false });
        toast(monthShort(v.month) + " fee saved as " + money(amt), "ok"); render();
      }
    }
    Actions["wa-open"]();
  },
  "due-edit": (feeId) => {
    const f = DataService.getFee(feeId); if (!f) return;
    const v = withBasis(Logic.feeView(f));
    const cls = v.source === "batch" ? DataService.getEnrollments().find(e => e.id === v.enrollmentId) : DataService.getPlan(v.planId);
    openModal({ title: "Edit amount — " + v.studentName,
      body: '<div class="note">' + esc(monthLabel(v.month)) + ' · ' + esc(v.shortBasis) + (v.paidAmount > 0 ? ' · ' + money(v.paidAmount) + ' already paid' : "") + '</div>' +
        '<div class="form-grid sf">' +
        field("Fee for " + monthShort(v.month) + " *", '<input class="input amt" type="number" name="amount" min="0" step="1" inputmode="numeric" value="' + esc(v.needsAmount && !v.override ? "" : v.netFee) + '">') +
        field("Due date", '<input class="input" type="date" name="dueDate" value="' + esc(v.dueDate) + '">') +
        '<div class="field span2"><label>Note</label><input class="input" name="remarks" value="' + esc(v.remarks || "") + '"></div>' +
        (cls && cls.status === "Active" ? '<label class="sf-check span2"><input type="checkbox" name="always"> Use this fee for the coming months too</label>' : "") +
        '</div>',
      submitText: "Save",
      onSubmit: function(d){
        const amt = round2(+d.amount || 0);
        if (d.amount === "" || amt < 0) { toast("Type the fee", "bad"); return false; }
        DataService.saveFee({ id: feeId, gross: amt, rate: amt, discount: 0, carry: 0, override: true, needsAmount: false,
          dueDate: d.dueDate || v.dueDate, remarks: d.remarks || "" });
        let more = "";
        if (d.always && cls) {
          if (v.source === "batch") { DataService.saveEnrollment({ id: cls.id, monthlyFee: amt }); followFee({ enrollmentId: cls.id }, amt); }
          else { DataService.savePlan({ id: cls.id, rate: amt, feeType: "monthly" }); followFee({ planId: cls.id }, amt); }
          more = " · from now on " + money(amt) + " a month";
        }
        toast(monthShort(v.month) + " fee " + money(amt) + more, "ok", 4200); render();
      } });
  },
  "fee-edit": (id) => Actions["due-edit"](id),
  "due-unpay": (feeId) => {
    const pays = DataService.getPayments({ feeId: feeId });
    if (!pays.length) { toast("No payment to undo", "warn"); return; }
    if (pays.length === 1) { voidDialog("payment", pays[0].id); return; }
    openModal({ title: "Which payment was a mistake?", hideSubmit: true, cancelText: "Close",
      body: pays.map(p => '<div class="minirow"><span>' + esc(fmtDate(p.date)) + ' · ' + esc(p.account || "") + ' · ' + money(p.amount) + '</span>' +
        '<b><button type="button" class="btn btn-sm btn-danger" data-act="pay-void" data-id="' + esc(p.id) + '">Remove</button></b></div>').join("") });
  },
  "due-waive": (feeId) => {
    const v = Logic.feeView(DataService.getFee(feeId));
    confirmAction({ title: "Waive " + monthLabel(v.month), message: v.studentName + " pays nothing for " + monthLabel(v.month) + ". The row stays on the list as Waived.",
      submitText: "Waive it", onConfirm: function(){
        DataService.saveFee({ id: feeId, waived: true, remarks: (v.remarks ? v.remarks + " · " : "") + "Waived" }); toast("Waived", "ok"); render(); } });
  },
  "due-unwaive": (feeId) => {
    const f = DataService.getFee(feeId); if (!f) return;
    DataService.saveFee({ id: feeId, waived: false, locked: false, remarks: String(f.remarks || "").split(" · ").filter(x => x.indexOf("Waived") !== 0).join(" · ") });
    toast("Back on the list", "ok"); render();
  },

  /* ---- batch enrolment fee ---- */
  "enrol-fee": (id) => {
    const e = DataService.getEnrollments().find(x => x.id === id); if (!e) return;
    const b = DataService.getBatch(e.batchId);
    openModal({ title: "Batch fee — " + ((DataService.getStudent(e.studentId) || {}).name || e.studentId),
      body: '<div class="form-grid sf">' +
        field("Monthly fee", '<input class="input amt" type="number" min="0" step="1" name="monthlyFee" value="' + (+e.monthlyFee || "") + '" placeholder="' + esc(b && b.monthlyFee ? b.monthlyFee + " (batch fee)" : "Batch fee") + '">') +
        field("Due day", '<input class="input" type="number" min="1" max="28" name="dueDay" value="' + esc(e.dueDay || 5) + '">') +
        '</div><p class="hint" style="margin:10px 0 0">Unpaid rows from this month on follow the new fee. Paid months stay as they are.</p>',
      submitText: "Save",
      onSubmit: function(d){
        const fee = round2(+d.monthlyFee || 0);
        DataService.saveEnrollment({ id: id, monthlyFee: fee, dueDay: Math.min(28, Math.max(1, +d.dueDay || 5)), feeMode: "" });
        const n = followFee({ enrollmentId: id }, Logic.enrolFee(DataService.getEnrollments().find(x => x.id === id)));
        toast("Fee saved" + (n ? " · " + n + " unpaid month" + (n > 1 ? "s" : "") + " updated" : ""), "ok"); render();
      } });
  },
  "enrol-feemode": (id) => Actions["enrol-fee"](id),

  /* ---- Teacher salary: typed in by hand ---- */
  "tsal-new": (teacherId) => {
    const t = teacherId ? DataService.getTeacher(teacherId) : null;
    openModal({ title: "Add salary",
      body: '<div class="form-grid sf">' +
        pickBox("Paid to *", "payeeId", t ? t.id : "", pickPayees(), "Teacher or staff name") +
        field("Amount *", '<input class="input amt" type="number" name="amount" min="1" step="1" inputmode="numeric" required>') +
        field("For month", sel("month", monthOpts(State.month, ""))) +
        field("Date paid", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Paid from", sel("account", accountOpts(t && t.payAccount ? t.payAccount : "Bank"))) +
        field("Type", sel("category", optList([{ value: "Teacher Payment", label: "Salary" }, { value: "Teacher Advance", label: "Advance" },
          { value: "Teacher Bonus", label: "Bonus" }], "Teacher Payment"))) +
        '<div class="field span2"><label>Note</label><input class="input" name="remarks" placeholder="Optional"></div>' +
        '</div>',
      submitText: "Save salary", noFocus: !!t,
      onSubmit: function(d){
        const who = DataService.getTeacher(d.payeeId), amt = round2(+d.amount);
        if (!who) { toast("Pick the teacher from the list", "bad"); return false; }
        if (!(amt > 0)) { toast("Type the amount", "bad"); return false; }
        DataService.saveTeacherPayment({ teacherId: who.id, month: d.month || State.month, amount: amt, date: d.date || today(),
          account: d.account, category: d.category || "Teacher Payment", remarks: d.remarks || "" });
        toast(money(amt) + " to " + who.name + " for " + monthLabel(d.month || State.month), "ok", 4200); render();
      } });
  },
  "tpay-new": (id) => Actions["tsal-new"](id),
  "tsal-edit": (id) => {
    const x = DB.teacherPayments.find(p => p.id === id); if (!x) return;
    const t = DataService.getTeacher(x.teacherId);
    openModal({ title: "Edit " + id,
      body: '<div class="form-grid sf">' +
        field("Paid to", '<input class="input" value="' + esc(t ? t.name : x.teacherId) + '" readonly>') +
        field("Amount *", '<input class="input amt" type="number" name="amount" min="1" step="1" value="' + esc(x.amount) + '">') +
        field("For month", sel("month", monthOpts(x.month, ""))) +
        field("Date paid", '<input class="input" type="date" name="date" value="' + esc(x.date || today()) + '">') +
        field("Paid from", sel("account", accountOpts(x.account || "Bank"))) +
        field("Type", sel("category", optList([{ value: "Teacher Payment", label: "Salary" }, { value: "Teacher Advance", label: "Advance" },
          { value: "Teacher Bonus", label: "Bonus" }], x.category || "Teacher Payment"))) +
        '<div class="field span2"><label>Note</label><input class="input" name="remarks" value="' + esc(x.remarks || "") + '"></div>' +
        '</div>',
      submitText: "Save changes",
      onSubmit: function(d){
        const amt = round2(+d.amount);
        if (!(amt > 0)) { toast("Type the amount", "bad"); return false; }
        upsert("teacherPayments", { id: id, amount: amt, month: d.month || x.month, date: d.date || x.date, account: d.account,
          category: d.category || "Teacher Payment", remarks: d.remarks || "" }, "TPY");
        toast("Salary entry updated", "ok"); render();
      } });
  },
  "tsal-csv": () => downloadCSV("teacher-salary.csv", ["Entry","Teacher ID","Name","For month","Date paid","Amount","Paid from","Type","Note"],
    DataService.getTeacherPayments().map(function(p){ const t = DataService.getTeacher(p.teacherId);
      return [p.id, p.teacherId, t ? t.name : "", p.month, p.date, p.amount, p.account, p.category || "Teacher Payment", p.remarks || ""]; }))
});
/* the fee message follows the amount as it is typed */
document.addEventListener("input", function(e){
  const a = e.target.closest('[data-act="share-amt"]');
  if (a) {
    const f = DataService.getFee(a.dataset.id), box = $("#waText");
    if (f && box) box.value = Logic.feeText(withBasis(Logic.feeView(f)), a.value === "" ? "" : +a.value);
    return;
  }
  const dd = e.target.closest('input[name="dueDay"],input[name="bDueDay"]');
  if (dd) dd._typed = true;
});
