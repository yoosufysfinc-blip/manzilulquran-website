"use strict";
/* Academic Service — forms-actions.v14.js. v14: the type-to-find box lists matching people as you type, with one tap to pick. */
/* ==========================================================================
   FORMS
   ========================================================================== */
function dayBoxes(days){
  days = days || [];
  return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d =>
    '<label style="display:inline-flex;gap:6px;align-items:center;font-size:13px;margin-right:10px">' +
    '<input type="checkbox" name="day_' + d + '"' + (days.indexOf(d) >= 0 ? " checked" : "") + '> ' + d + '</label>').join("");
}
function readDays(form){ return ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].filter(d => form.elements["day_" + d].checked); }

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
function studentForm(s, isNew){
  s = s || {};
  const set = Settings();
  return '<div class="form-grid">' +
    field("Student ID", '<input class="input mono" name="id" value="' + esc(s.id || "") + '" readonly placeholder="Generated automatically">') +
    field("Student name", '<input class="input" name="name" required value="' + esc(s.name || "") + '">') +
    field("Parent / guardian", '<input class="input" name="guardian" value="' + esc(s.guardian || "") + '">') +
    field("WhatsApp number", '<div class="ccrow"><select class="input ccsel" name="whatsappCC">' + ccOptions(splitWA(s.whatsapp, s.whatsappCC).cc) + '</select>' +
      '<input class="input mono" name="whatsapp" value="' + esc(splitWA(s.whatsapp, s.whatsappCC).num) + '" placeholder="Number without country code" style="flex:1"></div>') +
    field("Phone number", '<input class="input mono" name="phone" value="' + esc(s.phone || "") + '">') +
    field("Email", '<input class="input" name="email" value="' + esc(s.email || "") + '">') +
    field("Gender", sel("gender", optList(["Male", "Female"], s.gender, "Select"))) +
    field("Date of birth", '<input class="input" type="date" name="dob" value="' + esc(s.dob || "") + '">') +
    field("Joining date", '<input class="input" type="date" name="joiningDate" value="' + esc(s.joiningDate || today()) + '">') +
    field("Status", sel("status", optList(set.studentStatuses, s.status || "Active"))) +
    '<div class="field span2"><label>Address</label><input class="input" name="address" value="' + esc(s.address || "") + '"></div>' +
    '<div class="field span2"><label>Notes</label><textarea class="textarea" name="notes">' + esc(s.notes || "") + '</textarea></div>' +
    (isNew ? '<div class="field span2"><div class="note" style="margin:0">Add the student first. You can then put them in a batch, give them an individual class plan, or both — each is billed on its own fee record.</div></div>' : "") +
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
    field("Teacher", sel("teacherId", teacherOpts(b.teacherId, "Select teacher"))) +
    field("Status", sel("status", optList(Settings().batchStatuses, b.status || "Active"))) +
    '<div class="field span2"><label>Class days</label><div>' + dayBoxes(b.days) + '</div></div>' +
    field("Start time", '<input class="input" type="time" name="startTime" value="' + esc(b.startTime || "") + '">') +
    field("End time", '<input class="input" type="time" name="endTime" value="' + esc(b.endTime || "") + '">') +
    field("Class duration (min)", '<input class="input" type="number" name="duration" min="0" value="' + esc(b.duration || 60) + '">') +
    field("Maximum students", '<input class="input" type="number" name="maxStudents" min="1" value="' + esc(b.maxStudents || 15) + '">') +
    field("Monthly fee", '<input class="input" type="number" name="monthlyFee" min="0" value="' + esc(b.monthlyFee || 0) + '">') +
    field("Admission fee", '<input class="input" type="number" name="admissionFee" min="0" value="' + esc(b.admissionFee || 0) + '">') +
    field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(b.startDate || today()) + '">') +
    field("End date", '<input class="input" type="date" name="endDate" value="' + esc(b.endDate || "") + '">') +
    '<div class="field span2"><label>Notes</label><textarea class="textarea" name="notes">' + esc(b.notes || "") + '</textarea></div>' +
  '</div>';
}
/* ---- rule fields: one select + only the number boxes that rule needs ---- */
const RULE_NEEDS = { monthly: ["rate"], perClass: ["rate"], perDay: ["rate"], perHour: ["rate"], percent: ["rate"],
  hybridH1: ["base", "rate"], hybridH2: ["base", "included", "rate"], hybridH3: ["rate", "min", "max"] };
const RULE_RATE_LABEL = { monthly: "Monthly amount", perClass: "Rate per class", perDay: "Rate per day", perHour: "Rate per hour",
  percent: "Percent (%)", hybridH1: "Rate per class", hybridH2: "Rate per extra class", hybridH3: "Rate per class" };
const RULE_KEY_LABEL = { base: "Base amount", included: "Classes included in base", min: "Minimum (0 = none)", max: "Maximum (0 = none)" };
const RULE_HINT = {
  monthly: "Same amount every month.", perClass: "Completed classes × rate.", perDay: "Days a class happened × rate.",
  perHour: "Taught hours × hourly rate.", percent: "A percentage of the fee.", custom: "Typed in each month under Bonus / deduction.",
  hybridH1: "Base + every class × rate. e.g. ₹500 + 12 × ₹80 = ₹1,460.",
  hybridH2: "Base covers the included classes; each extra class × rate. e.g. ₹1,500 for 12, 14 held → ₹1,740.",
  hybridH3: "Classes × rate, never below the minimum or above the maximum.",
  manual: "Nothing is calculated — the month shows “Needs amount” until you type it in.",
  none: "Nothing is paid.", "": "Uses the teacher's own pay setting for this student." };
/* g = group key, typeName = the select's field name, opts = option list, names = {rate, base, included, min, max} field names */
function ruleBlock(g, label, typeName, opts, cur, names, obj){
  const need = RULE_NEEDS[cur] || [];
  let h = '<div class="field span2"><label>' + esc(label) + '</label>' +
    sel(typeName, optList(opts, cur), 'data-act="rule-ui" data-id="' + g + '"') +
    '<span class="hint" data-rh="' + g + '">' + esc(RULE_HINT[cur] || "") + '</span></div>';
  ["rate", "base", "included", "min", "max"].forEach(function(k){
    if (!names[k]) return;
    const lab = k === "rate" ? (RULE_RATE_LABEL[cur] || "Rate") : RULE_KEY_LABEL[k];
    h += '<div class="field rf" data-rg="' + g + '" data-rk="' + k + '"' + (need.indexOf(k) < 0 ? ' style="display:none"' : "") + '>' +
      '<label>' + esc(lab) + '</label><input class="input" type="number" min="0" step="' + (k === "included" ? "1" : "0.01") +
      '" name="' + names[k] + '" value="' + esc(+(obj || {})[names[k]] || 0) + '"></div>';
  });
  return h;
}
function ruleUI(form, g){
  if (!form) return;
  const s = form.querySelector('[data-act="rule-ui"][data-id="' + g + '"]'); if (!s) return;
  const need = RULE_NEEDS[s.value] || [];
  form.querySelectorAll('.rf[data-rg="' + g + '"]').forEach(function(el){
    el.style.display = need.indexOf(el.dataset.rk) < 0 ? "none" : "";
    if (el.dataset.rk === "rate") el.querySelector("label").textContent = RULE_RATE_LABEL[s.value] || "Rate";
  });
  const h = form.querySelector('[data-rh="' + g + '"]'); if (h) h.textContent = RULE_HINT[s.value] || "";
}
const RULE_NUM = ["feeBase", "feeIncluded", "feeMin", "feeMax", "payRate", "payBase", "payIncluded", "payMin", "payMax"];
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
  return name === "teacherId" ? pickTeachers() : pickStudents();
}
function pickExtra(name, r){
  if (name === "teacherId") return Logic.indRateLabel(r.indRateType || "") || "";
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

function planForm(p, presetStudent){
  p = p || {};
  const set = Settings();
  return '<div class="form-grid">' +
    field("Plan ID", '<input class="input mono" name="id" value="' + esc(p.id || "") + '" readonly placeholder="Generated automatically">') +
    pickBox("Student", "studentId", p.studentId || presetStudent || "", pickStudents(), "Type a student name or ID") +
    pickBox("Teacher", "teacherId", p.teacherId || "", pickTeachers(), "Type a teacher name or ID") +
    field("Use a course format", '<select class="select" data-act="apply-format" data-formats="' + esc(formatDataAttr()) + '">' + formatOpts("individual", "") + '</select>') +
    field("Course", sel("course", courseOpts(p.course, "Select course"))) +
    '<div class="field span2"><label>Class days</label><div>' + dayBoxes(p.days) + '</div></div>' +
    field("Class time", '<input class="input" type="time" name="time" value="' + esc(p.time || "18:00") + '">') +
    field("Class duration (min)", '<input class="input" type="number" name="duration" min="0" value="' + esc(p.duration || 45) + '">') +
    '<div class="field span2"><div class="sub-hd" style="margin:4px 0 0">Student fee</div></div>' +
    ruleBlock("fee", "Fee method", "feeType", FEE_METHODS.map(m => ({ value: m.value, label: m.label + " — " + m.hint })),
      p.feeType || set.defaultFeeMethod || "perClass",
      { rate: "rate", base: "feeBase", included: "feeIncluded", min: "feeMin", max: "feeMax" }, p) +
    field("Standing discount", '<input class="input" type="number" name="discount" min="0" value="' + esc(p.discount || 0) + '">') +
    '<div class="field span2"><div class="sub-hd" style="margin:4px 0 0">Teacher pay for this student</div></div>' +
    ruleBlock("pay", "Pay rule", "payType", PLAN_PAY_TYPES, p.payType || "",
      { rate: "payRate", base: "payBase", included: "payIncluded", min: "payMin", max: "payMax" }, p) +
    field("Fee due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + esc(p.dueDay || set.defaultDueDay || 5) + '">') +
    field("Status", sel("status", optList(["Active", "Stopped"], p.status || "Active"))) +
    field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(p.startDate || today()) + '">') +
    field("End date", '<input class="input" type="date" name="endDate" value="' + esc(p.endDate || "") + '">') +
    (p.id ? "" :
      field("Admission fee", '<input class="input" type="number" min="0" name="admissionFee" value="' + (set.admissionFeeDefault || 0) + '" placeholder="0 = none">') +
      '<div class="field"><label>Options</label><label style="display:flex;gap:7px;align-items:center;padding-top:9px;font-size:13px"><input type="checkbox" name="waiveAdmission"> Waive admission fee</label></div>' +
      '<div class="field span2"><label style="display:flex;gap:7px;align-items:center;font-size:13px"><input type="checkbox" name="raiseFirst" checked> Raise this month\'s fee now (prepaid) using the Rate above so I can collect it</label>' +
      '<span class="hint">For prepaid collection at signup. Later months are billed normally from the class log.</span></div>') +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(p.notes || "") + '"></div>' +
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
    field("Class status", sel("status", optList(["Completed","Cancelled","Student Absent","Teacher Absent","Rescheduled"], c.status || "Completed"))) +
    '<div></div>' +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(c.notes || "") + '"></div>' +
    '<div class="field span2"><div class="note" style="margin:0">Only a <b>Completed</b> class counts towards the student fee and the teacher payment.</div></div>' +
  '</div>';
}
function teacherForm(t){
  t = t || {};
  return '<div class="form-grid">' +
    field("Teacher ID", '<input class="input mono" name="id" value="' + esc(t.id || "") + '" readonly placeholder="Generated automatically">') +
    field("Teacher name", '<input class="input" name="name" required value="' + esc(t.name || "") + '">') +
    field("Phone", '<input class="input mono" name="phone" value="' + esc(t.phone || "") + '">') +
    field("WhatsApp", '<div class="ccrow"><select class="input ccsel" name="whatsappCC">' + ccOptions(splitWA(t.whatsapp, t.whatsappCC).cc) + '</select>' +
      '<input class="input mono" name="whatsapp" value="' + esc(splitWA(t.whatsapp, t.whatsappCC).num) + '" placeholder="Number only" style="flex:1"></div>') +
    field("Joining date", '<input class="input" type="date" name="joiningDate" value="' + esc(t.joiningDate || today()) + '">') +
    field("Paid into", sel("payAccount", accountOpts(t.payAccount || "Bank"))) +
    field("Kind", sel("kind", optList([{value:"teacher",label:"Teacher"},{value:"staff",label:"Other staff"}], t.kind || "teacher"), 'data-act="kind-toggle"')) +
    field("Role", '<input class="input" name="role" list="roleList" value="' + esc(t.role || "") + '" placeholder="Admin, Counsellor, Editor, Digital Marketer…">') +
    '<datalist id="roleList"><option>Admin</option><option>Counsellor</option><option>Editor</option><option>Digital Marketer</option><option>Coordinator</option><option>Accountant</option><option>Receptionist</option><option>Support</option></datalist>' +
    '<div class="field span2 staff-only"' + (t.kind === "staff" ? "" : ' style="display:none"') + '><div class="note" style="margin:0">Other staff are paid a fixed monthly salary plus optional incentive. Set the salary below; leave the class-pay rates alone.</div></div>' +
    '<div class="field staff-only"' + (t.kind === "staff" ? "" : ' style="display:none"') + '><label>Monthly salary</label><input class="input" type="number" name="monthlySalary" min="0" step="0.01" value="' + esc(t.monthlySalary || 0) + '"></div>' +
    '<div class="field staff-only"' + (t.kind === "staff" ? "" : ' style="display:none"') + '></div>' +
    '<div class="teacher-only"' + (t.kind === "staff" ? ' style="display:none"' : "") + ' style="display:contents">' +
    '<div class="field span2"><div class="note" style="margin:0">A teacher can teach in both streams. Set how they are paid for each — the two amounts are added into one monthly payable.</div></div>' +
    ruleBlock("ind", "Individual class pay (default for all their students)", "indRateType", IND_RATE_TYPES, t.indRateType || "perClass",
      { rate: "indRate", base: "indBase", included: "indIncluded", min: "indMin", max: "indMax" }, t) +
    '<div class="field span2"><span class="hint">A different rule for one student can be set on that student\'s class plan.</span></div>' +
    field("Batch class pay", sel("batchPayType", optList(BATCH_PAY_TYPES, t.batchPayType || "none"))) +
    field("Batch rate", '<input class="input" type="number" name="batchRate" min="0" step="0.01" value="' + esc(t.batchRate || 0) + '">') +
    '</div>' +
    field("Status", sel("status", optList(["Active", "Inactive"], t.status || "Active"))) +
    '<div></div>' +
    '<div class="field span2"><label>Notes</label><textarea class="textarea" name="notes">' + esc(t.notes || "") + '</textarea></div>' +
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
  if (p) Actions["pick-type"](p.dataset.id, p);
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
  "profile-open": (id) => { State.profile.studentId = id; State.profile.tab = "fees"; go("profile"); },

  /* ---------------- students ---------------- */
  "student-new": () => openModal({ title: "Add student", wide: true, body: studentForm({}, true), submitText: "Save student",
    onSubmit: function(d){
      if (!d.name) { toast("Student name is needed", "bad"); return false; }
      delete d.id; joinCC(d);
      const id = DataService.saveStudent(d);
      toast("Student " + id + " added", "ok"); celebrate("🎓"); render();
    } }),
  "student-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: studentForm(DataService.getStudent(id)), submitText: "Save changes",
    onSubmit: function(d){ d.id = id; joinCC(d); DataService.saveStudent(d); toast("Student updated", "ok"); render(); } }),
  "student-assign": (id) => {
    const s = DataService.getStudent(id), cur = DataService.getActiveEnrollment(id);
    openModal({
      title: (cur ? "Move batch — " : "Put in a batch — ") + s.name,
      body: (cur ? '<div class="note">Currently in ' + esc(cur.batchId) + ' since ' + esc(fmtDate(cur.joiningDate)) +
          '. That enrolment is closed as <b>Transferred</b> and kept; a new one starts on the date below.</div>' : "") +
        '<div class="form-grid">' +
        field("Batch", sel("batchId", batchOpts(cur ? cur.batchId : "", "Select batch", false), 'data-act="enrol-batch"')) +
        '<div class="field"><label>Sub-class</label><select class="select" name="subClassId">' +
          optList(DataService.getSubclasses({ batchId: cur ? cur.batchId : "" }).map(x => ({ value: x.id, label: x.name })),
            cur ? cur.subClassId : "", "Whole batch") + '</select></div>' +
        field("Effective date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Fee method", sel("feeMode", optList(ENROL_FEE_MODES, cur ? (cur.feeMode || "") : ""))) +
        field("Monthly fee", '<input class="input" type="number" name="monthlyFee" placeholder="Blank = batch fee">') +
        field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' +
          esc(cur ? cur.dueDay : (Settings().defaultDueDay || 5)) + '">') +
        '<div class="field span2"><label>Reason for the move</label><input class="input" name="reason"></div></div>',
      submitText: "Save enrolment",
      onSubmit: function(d){
        if (!d.batchId) { toast("Pick a batch", "bad"); return false; }
        const b = DataService.getBatch(d.batchId);
        if (cur) DataService.closeEnrollment(cur.id, "Transferred", d.date, d.reason || "Batch change");
        const sc2 = d.subClassId ? DataService.getSubclass(d.subClassId) : null;
        DataService.saveEnrollment({ studentId: id, batchId: d.batchId, subClassId: d.subClassId || "",
          joiningDate: d.date || today(), leavingDate: "",
          monthlyFee: +d.monthlyFee || (sc2 && sc2.monthlyFee) || b.monthlyFee, dueDay: +d.dueDay || 5,
          feeMode: d.feeMode === "manual" ? "manual" : "",
          status: "Active", reason: "", notes: cur ? ("Transferred from " + cur.batchId) : "Initial enrolment" });
        toast(s.name + " is now in " + b.name, "ok"); render();
      }
    });
  },
  "students-csv": () => downloadCSV("students.csv",
    ["Student ID","Name","Guardian","WhatsApp","Phone","Email","Joined","Status","Batch","Batch fee","Individual course","Fee method","Rate","Outstanding"],
    DataService.getStudents().map(function(s){
      const st = Logic.streamsOf(s.id), b = st.batch ? DataService.getBatch(st.batch.batchId) : null;
      const due = Logic.feeViews({ studentId: s.id }).reduce((a, v) => a + v.balance, 0);
      return [s.id, s.name, s.guardian, s.whatsapp, s.phone, s.email, s.joiningDate, s.status,
        b ? b.name : "", st.batch ? st.batch.monthlyFee : "", st.individual ? st.individual.course : "",
        st.individual ? Logic.methodLabel(st.individual.feeType) : "", st.individual ? st.individual.rate : "", due];
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
      '<div class="form-grid">' +
      pickBox("Student", "studentId", "", pickStudents(), "Type a student name or ID") +
      field("Batch", sel("batchId", batchOpts(batchId || "", "Select batch", false), 'data-act="enrol-batch"')) +
      '<div class="field"><label>Sub-class</label><select class="select" name="subClassId">' +
        optList(DataService.getSubclasses({ batchId: batchId || "" }).map(x => ({ value: x.id, label: x.name })), "", "Whole batch") +
        '</select></div>' +
      field("Joining date", '<input class="input" type="date" name="date" value="' + today() + '">') +
      field("Fee method", sel("feeMode", optList(ENROL_FEE_MODES, ""))) +
      field("Monthly fee", '<input class="input" type="number" name="monthlyFee" placeholder="Blank = batch fee">') +
      field("Due day", '<input class="input" type="number" name="dueDay" min="1" max="28" value="' + (Settings().defaultDueDay || 5) + '">') +
      field("Admission fee", '<input class="input" type="number" name="admissionFee" min="0" value="' + (Settings().admissionFeeDefault || 0) + '" placeholder="0 = none">') +
      '<div class="field"><label>Options</label><label style="display:flex;gap:7px;align-items:center;padding-top:9px;font-size:13px"><input type="checkbox" name="waiveAdmission"> Waive admission fee</label></div>' +
      '<div class="field span2"><label style="display:flex;gap:7px;align-items:center;font-size:13px"><input type="checkbox" name="raiseFirst" checked> Raise this month\'s fee now so I can collect it (prepaid)</label></div>' +
      '</div>',
    submitText: "Create enrolment",
    onSubmit: function(d){
      if (!d.studentId || !d.batchId) { toast("Student and batch are needed", "bad"); return false; }
      const b = DataService.getBatch(d.batchId), cur = DataService.getActiveEnrollment(d.studentId);
      if (cur) DataService.closeEnrollment(cur.id, "Transferred", d.date, "Batch change");
      const sc = d.subClassId ? DataService.getSubclass(d.subClassId) : null;
      const monthlyFee = +d.monthlyFee || (sc && sc.monthlyFee) || b.monthlyFee;
      const id = DataService.saveEnrollment({ studentId: d.studentId, batchId: d.batchId, subClassId: d.subClassId || "",
        joiningDate: d.date, leavingDate: "", monthlyFee: monthlyFee, feeMode: d.feeMode === "manual" ? "manual" : "",
        dueDay: +d.dueDay || 5, status: "Active", reason: "", notes: "" });
      /* prepaid: raise the first month's fee immediately so it can be collected */
      const m = String(d.date || today()).slice(0, 7);
      const holdB = DataService.holdFor(d.studentId, m);
      if (d.raiseFirst && !(holdB && holdB.waiveFee)) {
        const due = Logic.feeDueDate(m, +d.dueDay || Settings().defaultDueDay || 5);
        DataService.saveFee({ source: "batch", month: m, studentId: d.studentId, batchId: d.batchId,
          subClassId: d.subClassId || "", enrollmentId: id, teacherId: b ? b.teacherId : "",
          feeType: d.feeMode === "manual" ? "manual" : "monthly", rate: d.feeMode === "manual" ? 0 : monthlyFee,
          gross: d.feeMode === "manual" ? 0 : monthlyFee, discount: 0, waived: false, locked: false,
          needsAmount: d.feeMode === "manual", override: false,
          dueDate: due, remarks: d.feeMode === "manual" ? "First month — enter the amount" : "First month (prepaid)", createdAt: new Date().toISOString() });
      }
      /* admission fee as a one-off fee, unless waived */
      const adm = +d.admissionFee || 0;
      if (adm > 0 && !d.waiveAdmission) {
        DataService.saveFee({ source: "batch", month: m, studentId: d.studentId, batchId: d.batchId,
          subClassId: d.subClassId || "", enrollmentId: id, teacherId: b ? b.teacherId : "",
          feeType: "admission", rate: adm, gross: adm, discount: 0, waived: false, locked: true,
          dueDate: Logic.feeDueDate(m, +d.dueDay || 5), remarks: "Admission fee", createdAt: new Date().toISOString() });
      }
      toast("Enrolment " + id + " created" + (d.raiseFirst ? " · fee raised for " + monthLabel(m) : ""), "ok");
      celebrate("🎓"); render();
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
    ["Sub-class ID","Name","Batch","Teacher","Days","Time","Students","Monthly fee","Sessions this month","Teacher pay","Status"],
    DataService.getSubclasses().map(function(sc){
      const b = DataService.getBatch(sc.batchId), t = DataService.getTeacher(sc.teacherId);
      const pv = t ? Logic.payrollView(t, State.month) : null;
      const line = pv ? (pv.groups || []).find(g => g.subClassId === sc.id) : null;
      return [sc.id, sc.name, b ? b.name : sc.batchId, t ? t.name : "", (sc.days || []).join(" "),
        (sc.startTime || "") + "-" + (sc.endTime || ""), Logic.rosterOf(sc.batchId, null, sc.id).length,
        sc.monthlyFee || "", line ? line.sessions : 0, line ? line.amount : 0, sc.status || "Active"];
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
    const box = $("#gres");
    if (q.length < 2) { box.innerHTML = '<p class="hint">Keep typing…</p>'; return; }
    const out = [];
    DataService.getStudents().forEach(s => { if ((s.id + " " + s.name + " " + s.phone).toLowerCase().indexOf(q) >= 0)
      out.push(["Student", s.name, s.id, "profile-open", s.id]); });
    DataService.getTeachers().forEach(t => { if ((t.id + " " + t.name).toLowerCase().indexOf(q) >= 0)
      out.push(["Teacher", t.name, t.id, "goto-teachers", t.id]); });
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
    const dues = Logic.feeViews({ month: m }).filter(v => v.daysOverdue > 0 && v.balance > 0);
    const pay = Logic.payrollMonth(m).filter(p => p.balance > 0);
    const low = DataService.getStudents().map(function(s){
      const a = Logic.attStats(DataService.getAttendance({ studentId: s.id, month: m }));
      return { name: s.name, id: s.id, pct: a.pct, total: a.total };
    }).filter(x => x.total >= 4 && x.pct < 70);
    openModal({ title: "Needs your attention", hideSubmit: true, cancelText: "Close",
      body: '<div class="sub-hd">Overdue fees</div>' +
        (dues.length ? dues.slice(0, 8).map(v => '<div class="minirow"><span>' + esc(v.studentName) + ' · ' +
          v.daysOverdue + ' days</span><b class="out">' + money(v.balance) + '</b></div>').join("")
          : '<div class="minirow"><span>Nothing overdue</span><b>—</b></div>') +
        '<div class="sub-hd">Teachers still to be paid</div>' +
        (pay.length ? pay.map(p => '<div class="minirow"><span>' + esc(p.teacherName) + '</span><b class="out">' +
          money(p.balance) + '</b></div>').join("") : '<div class="minirow"><span>All settled</span><b>—</b></div>') +
        '<div class="sub-hd">Attendance below 70%</div>' +
        (low.length ? low.slice(0, 8).map(x => '<div class="minirow"><span>' + esc(x.name) + '</span><b class="out">' +
          x.pct + '%</b></div>').join("") : '<div class="minirow"><span>Nobody is slipping</span><b>—</b></div>') });
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
    body: '<div class="note">Range marking skips these days, and prepaid planning does not charge for them.</div>' +
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
  "next-month": () => {
    const nm = addMonths(State.month, 1);
    const r = Logic.buildBoth(nm);
    State.month = nm; $("#globalMonth").innerHTML = monthOpts(State.month, "");
    toast(monthLabel(nm) + " opened · " + r.created + " fee records raised" +
      (r.skipped ? ", " + r.skipped + " already existed" : ""), "ok", 4500);
    render();
  },
  "reconcile": () => {
    const m = State.month, unfinished = monthEnd(m) > today();
    confirmAction({ title: "Reconcile " + monthLabel(m), danger: unfinished,
      note: (unfinished ? "⚠ " + monthLabel(m) + " has not finished yet — classes still to come would be credited back as if " +
          "they never happened. Reconcile once the month is over. " : "") +
        "Each individual class fee is compared with the class log. Classes not held come back as a credit on " +
        monthLabel(addMonths(m, 1)) + "; extra classes are added on. The month is then locked and never rewritten.",
      message: "Close and reconcile " + monthLabel(m) + "?", submitText: "Reconcile the month",
      onConfirm: function(){
        const r = Logic.reconcileMonth(m);
        toast(r.done + " fee records reconciled · " + money(r.credit) + " credited forward, " +
          money(r.extra) + " charged forward · " + (r.carried ? r.carried + " set off against " + monthLabel(addMonths(m, 1))
            : "waiting for the next month to be raised") + (r.skipped ? " · " + r.skipped + " already done" : ""), "ok", 6000);
        render();
      } });
  },
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
  "plan-new": (studentId) => openModal({ title: "New class plan", wide: true, body: planForm({}, studentId), submitText: "Save plan",
    onSubmit: function(d, form){
      if (!DataService.getStudent(d.studentId)) { toast("Pick a student from the list", "bad"); return false; }
      if (d.teacherId && !DataService.getTeacher(d.teacherId)) { toast("That teacher was not found — pick one from the list", "bad"); return false; }
      d.days = readDays(form);
      d.perWeek = d.days.length;
      ["duration","rate","discount","dueDay"].concat(RULE_NUM).forEach(k => d[k] = +d[k] || 0);
      const raiseFirst = d.raiseFirst, adm = +d.admissionFee || 0, waiveAdm = d.waiveAdmission;
      const dueDay = d.dueDay || Settings().defaultDueDay || 5;
      delete d.id; delete d.raiseFirst; delete d.admissionFee; delete d.waiveAdmission;
      const id = DataService.savePlan(d);
      const m = String(d.startDate || today()).slice(0, 7);
      /* prepaid: raise the first month's fee now using the plan rate, so it can be collected immediately */
      const holdI = DataService.holdFor(d.studentId, m);
      /* new rule types raise the first month from the planned classes; the original four keep their old behaviour */
      const newRule = Logic.isHybrid(d.feeType) || d.feeType === "manual";
      const firstGross = newRule ? Logic.computeGross(d.feeType, d.rate, Logic.plannedStats(DataService.getPlan(id), m), Logic.ruleExtra(d, "fee"))
                                 : Math.max(0, (+d.rate || 0) - (+d.discount || 0));
      if (raiseFirst && (d.feeType === "manual" || (newRule ? firstGross > 0 : (+d.rate || 0) > 0)) && !(holdI && holdI.waiveFee)) {
        const gross = firstGross;
        const fx = Logic.ruleExtra(d, "fee");
        DataService.saveFee({ source: "individual", month: m, studentId: d.studentId, planId: id,
          teacherId: d.teacherId || "", feeType: newRule ? d.feeType : "monthly", rate: +d.rate || 0, gross: gross, discount: +d.discount || 0,
          feeBase: fx.base, feeIncluded: fx.included, feeMin: fx.min, feeMax: fx.max,
          needsAmount: d.feeType === "manual", override: false,
          carry: 0, billing: "prepaid", reconciled: false, waived: false, locked: false,
          dueDate: Logic.feeDueDate(m, dueDay), remarks: "First month (prepaid)", createdAt: new Date().toISOString() });
      }
      /* admission fee as a one-off */
      if (adm > 0 && !waiveAdm) {
        DataService.saveFee({ source: "individual", month: m, studentId: d.studentId, planId: id,
          teacherId: d.teacherId || "", feeType: "admission", rate: adm, gross: adm, discount: 0,
          carry: 0, billing: "prepaid", reconciled: false, waived: false, locked: true,
          dueDate: Logic.feeDueDate(m, dueDay), remarks: "Admission fee", createdAt: new Date().toISOString() });
      }
      toast("Class plan " + id + " created" + (raiseFirst && (+d.rate || 0) > 0 ? " · fee raised for " + monthLabel(m) : ""), "ok");
      celebrate("🎓"); render();
    } }),
  "plan-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: planForm(DataService.getPlan(id)), submitText: "Save changes",
    onSubmit: function(d, form){
      d.days = readDays(form); d.perWeek = d.days.length; d.id = id;
      ["duration","rate","discount","dueDay"].concat(RULE_NUM).forEach(k => d[k] = +d[k] || 0);
      DataService.savePlan(d);
      toast("Plan updated. Recalculate the month if the rate changed.", "ok", 4200); render();
    } }),
  "class-new": (id) => {
    const isPlan = id && String(id).indexOf("IPL") === 0;
    openModal({ title: "Record a class", body: classForm({}, isPlan ? id : "", isPlan ? "" : id), submitText: "Save class",
      onSubmit: function(d){
        if (!d.planId) { toast("Pick the class plan", "bad"); return false; }
        const pl = DataService.getPlan(d.planId);
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
      d.id = id; d.duration = +d.duration || 0; if (pl) d.studentId = pl.studentId;
      DataService.saveClass(d); toast("Class updated", "ok"); render();
    } }),
  "class-del": (id) => confirmAction({ title: "Remove this class", danger: true,
    note: "The fee for that month will be lower once you recalculate. Payments already received are untouched.",
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

  /* ---------------- fees ---------------- */
  "batch-fees-build": () => openModal({
    title: "Calculate batch fees",
    body: '<div class="note">One record per active enrolment. A student who already has a record for the month is skipped, and earlier months are never touched.</div>' +
      '<div class="form-grid">' + field("Month", sel("month", monthOpts(State.month, ""))) +
      '<div class="field"><label>Mid-month joiners</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
      '<input type="checkbox" name="prorate" checked> Charge only the remaining part of the month</label></div></div>',
    submitText: "Calculate",
    onSubmit: function(d){
      const r = Logic.buildBatchMonth(d.month, { prorate: !!d.prorate });
      State.month = d.month; $("#globalMonth").innerHTML = monthOpts(State.month, "");
      toast(r.created + " batch fee records created for " + monthLabel(d.month) +
        (r.skipped ? " · " + r.skipped + " already existed" : ""), r.created ? "ok" : "warn", 4200);
      render();
    }
  }),
  "ind-fees-build": () => openModal({
    title: "Calculate individual fees",
    body: '<div class="note">Each active plan is worked out from its class log for the month. Locked months are skipped and payments are never touched.</div>' +
      '<div class="form-grid">' + field("Month", sel("month", monthOpts(State.month, ""))) + '</div>',
    submitText: "Calculate",
    onSubmit: function(d){
      const r = Logic.buildIndMonth(d.month);
      State.month = d.month; $("#globalMonth").innerHTML = monthOpts(State.month, "");
      toast(r.created + " created, " + r.updated + " updated from the class log" +
        (r.skipped ? ", " + r.skipped + " unchanged" : ""), "ok", 4200);
      render();
    }
  }),
  "build-both": () => {
    const r = Logic.buildBoth(State.month);
    toast(r.created + " fee records created, " + r.updated + " updated for " + monthLabel(State.month), "ok", 4200);
    render();
  },
  "fee-edit": (id) => {
    const v = withBasis(Logic.feeView(DataService.getFee(id)));
    openModal({ title: "Adjust fee — " + v.studentName,
      body: '<div class="note">' + streamChip(v.source) + ' ' + esc(monthLabel(v.month)) + ' · gross comes from ' +
        esc(v.source === "batch" ? "the enrolment fee" : "the class log (" + v.basisText + ")") +
        '. Payments already received (' + money(v.paidAmount) + ') are untouched. A discount is not an expense — it lowers the fee.' +
        ' Changing the gross fee makes it this month\'s agreed amount — recalculation will not change it.</div>' +
        '<div class="form-grid">' +
        field("Gross fee", '<input class="input" type="number" name="gross" step="0.01" value="' + v.gross + '">') +
        field("Discount", '<input class="input" type="number" name="discount" min="0" step="0.01" value="' + (+v.discount || 0) + '">') +
        field("Due date", '<input class="input" type="date" name="dueDate" value="' + esc(v.dueDate) + '">') +
        '<div class="field"><label>Waive this month</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
          '<input type="checkbox" name="waived"' + (v.waived ? " checked" : "") + '> Nothing payable</label></div>' +
        '<div class="field"><label>Lock this month</label><label style="display:flex;gap:8px;align-items:center;padding-top:8px;font-size:13.5px">' +
          '<input type="checkbox" name="locked"' + (v.locked ? " checked" : "") + '> Final — recalculation skips it</label></div>' +
        (v.override ? '<div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px">' +
          '<input type="checkbox" name="clearOverride"> Go back to the calculated amount' +
          (v.autoGross !== undefined && v.autoGross !== null ? ' (' + money(v.autoGross) + ')' : '') + '</label></div>' : "") +
        '<div class="field span2"><label>Remarks</label><input class="input" name="remarks" value="' + esc(v.remarks || "") + '"></div></div>',
      submitText: "Save adjustment",
      onSubmit: function(d){
        const f0 = DataService.getFee(id), g = +d.gross || 0;
        const upd = { id: id, gross: g, discount: +d.discount || 0, dueDate: d.dueDate,
          waived: !!d.waived, locked: !!d.locked, remarks: d.remarks };
        if (d.clearOverride) {
          upd.override = false;
          upd.gross = f0.autoGross !== undefined && f0.autoGross !== null ? +f0.autoGross : g;
          upd.needsAmount = f0.feeType === "manual";
        } else if (f0.needsAmount || round2(g) !== round2(+f0.gross || 0)) {
          /* a typed amount: keep what the calculation said, then stop recalculation touching it */
          upd.override = true; upd.needsAmount = false;
          if (!f0.override) upd.autoGross = f0.needsAmount ? null : (+f0.gross || 0);
        }
        DataService.saveFee(upd);
        toast(upd.override ? "Amount set for this month" : "Fee record updated", "ok"); render();
      } });
  },
  "rule-ui": (g, el) => ruleUI(el.closest("form"), g),
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
  /* batch enrolment: fixed monthly fee or typed in each month (applies from the next month raised) */
  "enrol-feemode": (id) => {
    const e = DataService.getEnrollments().find(x => x.id === id); if (!e) return;
    openModal({ title: "Fee method — " + id,
      body: '<div class="note">Applies to months raised from now on. Months already raised keep their amount — use Adjust on a month to change it.</div>' +
        '<div class="form-grid">' +
        field("Fee method", sel("feeMode", optList(ENROL_FEE_MODES, e.feeMode || ""))) +
        field("Monthly fee (fixed)", '<input class="input" type="number" min="0" step="0.01" name="monthlyFee" value="' + (+e.monthlyFee || 0) + '">') +
        '</div>',
      submitText: "Save",
      onSubmit: function(d){
        DataService.saveEnrollment({ id: id, feeMode: d.feeMode === "manual" ? "manual" : "", monthlyFee: +d.monthlyFee || 0 });
        toast("Fee method saved", "ok"); render();
      } });
  },
  /* one student's line on a teacher's month: type the amount (override) or go back to the rule */
  "tline-edit": (key) => {
    const parts = String(key).split("|"), teacherId = parts[0], planId = parts[1];
    const m = State.tpay.month || State.month, t = DataService.getTeacher(teacherId);
    const v = Logic.payrollView(t, m), L = (v.indLines || []).find(x => x.planId === planId);
    if (!L) { toast("That line is not in this month", "bad"); return; }
    const a = DataService.getAdjust(teacherId, m) || {}, lines = Logic.parseLines(a.planLines), cur = lines[planId];
    openModal({ title: "Pay for " + L.studentName + " — " + monthLabel(m),
      body: '<div class="note">' + esc(t.name) + ' · ' + esc(L.course) + ' · ' + L.classes + ' classes. Rule: ' +
        esc(cur ? "override" : (L.source === "plan" ? Logic.planPayLabel(L.payType) : "teacher's default")) +
        '. The amount typed here is used for this month only.</div>' +
        '<div class="form-grid">' +
        field("Amount for this month", '<input class="input" type="number" min="0" step="0.01" name="amount" value="' + (cur ? (+cur.amount || 0) : (L.source === "plan" ? L.amount : "")) + '">') +
        field("Note", '<input class="input" name="note" value="' + esc(cur ? cur.note || "" : "") + '" placeholder="e.g. agreed extra for revision week">') +
        (cur ? '<div class="field span2"><label style="display:flex;gap:8px;align-items:center;font-size:13.5px"><input type="checkbox" name="clear"> Remove the override — use the rule again</label></div>' : "") +
        '</div>',
      submitText: "Save",
      onSubmit: function(d){
        if (d.clear) delete lines[planId];
        else {
          if (d.amount === "" || isNaN(+d.amount)) { toast("Type an amount", "bad"); return false; }
          lines[planId] = { amount: round2(+d.amount), note: d.note || "" };
        }
        DataService.saveAdjust({ teacherId: teacherId, month: m, planLines: JSON.stringify(lines) });
        toast(d.clear ? "Override removed" : "Amount saved for " + L.studentName, "ok"); render();
      } });
  },
  "fees-csv": (id, el) => {
    const src = el.dataset.src;
    downloadCSV("fees-" + src + "-" + State.month + ".csv",
      ["Fee ID","Stream","Month","Student ID","Student","Teacher","Basis","Gross","Discount","Net","Paid","Balance","Due Date","Days Overdue","Status"],
      Logic.feeViews({ month: State.month, source: src }).map(withBasis).map(v => [v.id, v.source, v.month, v.studentId,
        v.studentName, v.teacherName, v.shortBasis, v.gross, v.discount, v.netFee, v.paidAmount, v.balance, v.dueDate, v.daysOverdue, v.status]));
  },
  "dues-quick": (id, el) => { State[el.dataset.key].quick = el.dataset.q; resetLists(); render(); },
  "dues-csv": (id, el) => {
    const src = el.dataset.src;
    downloadCSV("dues-" + src + "-" + State.month + ".csv",
      ["Student ID","Student","Phone","WhatsApp","Stream","Month","Net","Paid","Balance","Due Date","Days Overdue","Status"],
      Logic.feeViews({ month: State.month, source: src }).filter(v => v.balance > 0).map(v => [v.studentId, v.studentName,
        v.phone, v.whatsapp, v.source, v.month, v.netFee, v.paidAmount, v.balance, v.dueDate, v.daysOverdue, v.status]));
  },
  "brep-csv": () => downloadCSV("batch-report-" + State.month + ".csv",
    ["Batch ID","Batch","Teacher","Students","Expected","Collected","Pending","Collection %","Attendance %"],
    DataService.getBatches().map(function(b){
      const s = Logic.summarize(Logic.feeViews({ month: State.month, source: "batch", batchId: b.id }));
      const a = Logic.attStats(DataService.getAttendance({ month: State.month, batchId: b.id }));
      const t = DataService.getTeacher(b.teacherId);
      return [b.id, b.name, t ? t.name : "", Logic.rosterOf(b.id).length, s.net, s.paid, s.balance, s.collectionPct + "%", a.pct + "%"];
    })),
  "irep-csv": () => downloadCSV("individual-report-" + State.month + ".csv",
    ["Student ID","Student","Teacher","Method","Rate","Basis","Gross","Discount","Net","Paid","Balance","Status"],
    Logic.feeViews({ month: State.month, source: "individual" }).map(withBasis).map(v => [v.studentId, v.studentName,
      v.teacherName, Logic.methodLabel(v.feeType), v.rate, v.shortBasis, v.gross, v.discount, v.netFee, v.paidAmount, v.balance, v.status]))
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
        'A fee is created when the student gets a class: a <b>class plan</b> (one-to-one) or a <b>batch enrolment</b>. ' +
        'Leave "Raise this month\'s fee now" ticked there, then come back here.</div>' +
        '<div class="btn-row" style="margin-top:8px">' +
        '<button type="button" class="btn btn-sm btn-primary" data-act="pay-to-plan" data-id="' + esc(sid) + '">+ New class plan</button>' +
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
      if (!d.name) { toast("Name is needed", "bad"); return false; }
      d.indRate = +d.indRate || 0; ["indBase","indIncluded","indMin","indMax"].forEach(k => d[k] = +d[k] || 0); d.batchRate = +d.batchRate || 0; d.monthlySalary = +d.monthlySalary || 0; d.kind = "staff"; delete d.id; joinCC(d);
      const id = DataService.saveTeacher(d);
      toast("Staff " + id + " added", "ok"); celebrate("👤"); render();
    } }),
  "teacher-new": () => openModal({ title: "Add teacher", wide: true, body: teacherForm({}), submitText: "Save teacher",
    onSubmit: function(d){
      if (!d.name) { toast("Name is needed", "bad"); return false; }
      d.indRate = +d.indRate || 0; ["indBase","indIncluded","indMin","indMax"].forEach(k => d[k] = +d[k] || 0); d.batchRate = +d.batchRate || 0; d.monthlySalary = +d.monthlySalary || 0; delete d.id; joinCC(d);
      const id = DataService.saveTeacher(d);
      toast((d.kind === "staff" ? "Staff " : "Teacher ") + id + " added", "ok"); celebrate(d.kind === "staff" ? "👤" : "🧑‍🏫"); render();
    } }),
  "teacher-edit": (id) => openModal({ title: "Edit " + id, wide: true, body: teacherForm(DataService.getTeacher(id)), submitText: "Save changes",
    onSubmit: function(d){ d.id = id; d.indRate = +d.indRate || 0; ["indBase","indIncluded","indMin","indMax"].forEach(k => d[k] = +d[k] || 0); d.batchRate = +d.batchRate || 0; d.monthlySalary = +d.monthlySalary || 0; joinCC(d);
      DataService.saveTeacher(d); toast("Saved", "ok"); render(); } }),
  "tpay-new": (teacherId) => {
    const m = State.tpay.month || State.month;
    const t = teacherId ? DataService.getTeacher(teacherId) : DataService.getTeachers()[0];
    const v = t ? Logic.payrollView(t, m) : null;
    openModal({ title: "Pay teacher",
      body: (v ? '<div class="note"><b>' + esc(v.teacherName) + '</b> · ' + esc(monthLabel(m)) + '<br>Individual ' +
        money(v.indAmount) + ' + batch ' + money(v.batchAmount) + ' = payable ' + money(v.payable) +
        ', already paid ' + money(v.paid) + ', balance <b>' + money(v.balance) + '</b>.</div>' : "") +
        '<div class="form-grid">' +
        field("Teacher", sel("teacherId", teacherOpts(t ? t.id : "", "Select teacher"))) +
        field("For month", sel("month", monthOpts(m, ""))) +
        field("Amount", '<input class="input amt" type="number" name="amount" min="0.01" step="0.01" value="' +
          (v && v.balance > 0 ? v.balance : "") + '" required>') +
        field("Date", '<input class="input" type="date" name="date" value="' + today() + '">') +
        field("Paid from", sel("account", accountOpts(t && t.payAccount ? t.payAccount : "Bank"))) +
        field("Type", sel("category", optList(["Teacher Payment","Teacher Advance","Teacher Bonus"], "Teacher Payment"))) +
        '<div class="field span2"><label>Remarks</label><input class="input" name="remarks"></div></div>',
      submitText: "Record payment",
      onSubmit: function(d){
        const amt = +d.amount;
        if (!d.teacherId || !amt) { toast("Teacher and amount are needed", "bad"); return false; }
        DataService.saveTeacherPayment({ teacherId: d.teacherId, month: d.month, amount: amt, date: d.date || today(),
          account: d.account, category: d.category, remarks: d.remarks });
        toast(money(amt) + " paid to " + (DataService.getTeacher(d.teacherId) || {}).name, "ok"); render();
      } });
  },
  "tadj-edit": (teacherId) => {
    const m = State.tpay.month || State.month, t = DataService.getTeacher(teacherId);
    const a = DataService.getAdjust(teacherId, m) || {}, v = Logic.payrollView(t, m);
    openModal({ title: "Bonus · incentive · deduction — " + t.name,
      body: '<div class="note">' + esc(monthLabel(m)) + ' gross is ' + money(v.gross) + ' (individual ' + money(v.indAmount) +
        ' + batch ' + money(v.batchAmount) + ').</div>' +
        '<div class="form-grid">' +
        field("Bonus", '<input class="input" type="number" name="bonus" min="0" step="0.01" value="' + (+a.bonus || 0) + '">') +
        field("Incentive", '<input class="input" type="number" name="incentive" min="0" step="0.01" value="' + (+a.incentive || 0) + '">') +
        field("Deduction", '<input class="input" type="number" name="deduction" min="0" step="0.01" value="' + (+a.deduction || 0) + '">') +
        (t.indRateType === "custom" ? field("Custom individual amount",
          '<input class="input" type="number" name="custom" min="0" step="0.01" value="' + (+a.custom || 0) + '">') : "") +
        '<div class="field span2"><label>Remarks</label><input class="input" name="remarks" value="' + esc(a.remarks || "") + '"></div></div>',
      submitText: "Save",
      onSubmit: function(d){
        DataService.saveAdjust({ teacherId: teacherId, month: m, bonus: +d.bonus || 0, incentive: +d.incentive || 0, deduction: +d.deduction || 0,
          custom: +d.custom || 0, remarks: d.remarks });
        toast("Saved", "ok"); render();
      } });
  },
  "tstatement": (teacherId) => {
    const t = DataService.getTeacher(teacherId);
    const rows = allMonths().map(m => Logic.payrollView(t, m)).filter(p => p.payable > 0 || p.paid > 0);
    openModal({ title: "Statement — " + t.name, wide: true, hideSubmit: true, cancelText: "Close",
      body: '<div class="tablewrap"><table class="tbl"><thead><tr><th>Month</th><th class="right">Individual</th>' +
        '<th class="right">Batch</th><th class="right">Payable</th><th class="right">Paid</th><th class="right">Balance</th></tr></thead><tbody>' +
        (rows.length ? rows.map(p => '<tr><td>' + esc(monthLabel(p.month)) + '</td>' +
          '<td class="right amt">' + money(p.indAmount) + '</td><td class="right amt">' + money(p.batchAmount) + '</td>' +
          '<td class="right amt">' + money(p.payable) + '</td><td class="right amt in">' + money(p.paid) + '</td>' +
          '<td class="right amt">' + money(p.balance) + '</td></tr>').join("")
          : '<tr><td colspan="6" style="color:var(--muted)">Nothing yet.</td></tr>') + '</tbody></table></div>' });
  },
  "tpay-csv": () => {
    const m = State.tpay.month || State.month;
    downloadCSV("teacher-payments-" + m + ".csv",
      ["Teacher ID","Teacher","Month","Group","Group type","Sessions","Students","Group pay","Individual","Batch total","Gross","Bonus","Deduction","Payable","Paid","Balance","Status"],
      Logic.payrollMonth(m).reduce(function(rows, p){
        const gs = (p.groups && p.groups.length) ? p.groups : [{ label: "—", subClassId: "", sessions: 0, students: 0, amount: 0 }];
        gs.forEach(function(g, i){
          rows.push([p.teacherId, p.teacherName, p.month, g.label, g.subClassId ? "Sub-class" : "Batch",
            g.sessions, g.students, g.amount,
            i === 0 ? p.indAmount : "", i === 0 ? p.batchAmount : "", i === 0 ? p.gross : "",
            i === 0 ? p.bonus : "", i === 0 ? p.deduction : "", i === 0 ? p.payable : "",
            i === 0 ? p.paid : "", i === 0 ? p.balance : "", i === 0 ? p.status : ""]);
        });
        return rows;
      }, []));
  },

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
     "defaultDueDay","defaultFeeMethod","billingMode","advanceDays","prepaidDue","teacherLinkBase","apiUrl",
     "syncKey","syncEvery","admissionFeeDefault"].forEach(k => {
      const el = $("#set_" + k); if (el) patch[k] = el.value;
    });
    patch.defaultDueDay = +patch.defaultDueDay || 5;
    if (patch.admissionFeeDefault !== undefined) patch.admissionFeeDefault = Math.max(0, +patch.admissionFeeDefault || 0);
    const so = $("#set_syncOn"); if (so) patch.syncOn = so.checked;
    if (patch.syncEvery !== undefined) patch.syncEvery = Math.max(1, +patch.syncEvery || 3);
    if (patch.advanceDays !== undefined) patch.advanceDays = Math.max(0, +patch.advanceDays || 0);
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
        const { data, error } = await Supa.client.from(SUPA_TABLE[c]).select("id,data,deleted").limit(10000);
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
        const { data, error } = await Supa.client.from(SUPA_TABLE[c]).select("id,data,deleted").limit(10000);
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

function voidDialog(kind, id){
  const isT = kind === "teacher";
  const p = (isT ? DB.teacherPayments : DB.payments).find(x => x.id === id);
  if (!p) { toast("Payment not found", "bad"); return; }
  if (p.voided) { toast("Already voided", "warn"); return; }
  const who = isT ? DataService.getTeacher(p.teacherId) : DataService.getStudent(p.studentId);
  openModal({ title: "Void payment " + id, submitText: "Void payment",
    body: '<div class="note">Use this only for a payment <b>entered by mistake</b> — wrong ' + (isT ? "teacher" : "student") +
      ', wrong amount, or entered twice. It is taken out of every total but stays in the history as voided.' +
      (isT ? "" : ' If the money really went back to the family, use <b>Refund</b> instead.') + '</div>' +
      dl([[isT ? "Teacher" : "Student", esc(who ? who.name : (p.teacherId || p.studentId))],
          ["Amount", money(p.amount)], ["Date", fmtDate(p.date)], ["For month", monthLabel(p.month)],
          ["Account", esc(p.account || "—")]]) +
      '<div class="form-grid">' +
      '<div class="field span2"><label>Reason *</label><input class="input" name="reason" placeholder="e.g. entered twice, wrong student" required></div>' +
      field("Password", '<input class="input" type="password" name="pw" autocomplete="off">') +
      '</div>',
    onSubmit: function(d){
      if (!String(d.reason || "").trim()) { toast("Give a reason", "bad"); return false; }
      if (d.pw !== SHEET_LOCK_PW) { toast("Wrong password", "bad"); return false; }
      if (isT) DataService.voidTeacherPayment(id, d.reason.trim()); else DataService.voidPayment(id, d.reason.trim());
      toast(money(p.amount) + " voided — taken out of the totals", "ok", 4200); render();
    } });
}
