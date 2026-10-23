"use strict";
/* Academic Service — dash.v2.js. v2 (simple mode): the dashboards point at the Due date page (make the month's list,
   who is pending), show students still waiting for a class and classes with no teacher, and the salary entered for the
   month — no teacher pay is worked out. (v1:) Quiet dashboards for the three workspaces (Batch classes, Individual, Academy books):
   one headline number, a few figures that open their own page, the two or three actions that matter (the rest under More),
   and a short "Needs attention" list. Same data as before (Logic.feeViews / summarize / pnl / attStats / classStats /
   unmarked / payrollMonth / accountBalances); the charts and long lists now live only on their own pages.
   Also: a calmer page header on dashboards, page / window / toast motion, numbers that count up when a dashboard opens,
   and a tighter top bar on phones (styles in dash.v1.css). Loaded last by portal/academic-service/index.html. */

const DZ = { more: false };
const DZ_PAGES = { bDash: 1, iDash: 1, overview: 1 };
function dzCalm(){ try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }
function dzFmt(v, f){ return f === "money" ? money(v) : f === "pct" ? Math.round(+v || 0) + "%" : num(Math.round(+v || 0)); }
function dzCount(v, f){ return '<span class="dz-n" data-count="' + (+v || 0) + '" data-fmt="' + f + '">' + dzFmt(v, f) + '</span>'; }
function dzStat(label, valueHtml, sub, tone, page){
  const open = page ? '<button type="button" class="dz-stat' + (tone ? " t-" + tone : "") + '" data-act="goto" data-page="' + page + '">' : '<div class="dz-stat' + (tone ? " t-" + tone : "") + '">';
  return open + '<span class="l">' + esc(label) + '</span><span class="v">' + valueHtml + '</span>' + (sub ? '<span class="s">' + sub + '</span>' : "") + (page ? '</button>' : '</div>');
}
function dzHero(o){
  const bar = typeof o.pct === "number" ? '<div class="dz-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(o.pct) + '">' +
    '<i style="width:' + Math.max(0, Math.min(100, o.pct)) + '%"></i></div>' : "";
  return '<section class="dz-hero' + (o.tone ? " t-" + o.tone : "") + '"><div class="dz-main"><div class="dz-k">' + esc(o.label) + '</div>' +
    '<div class="dz-big">' + dzCount(o.value, o.fmt || "money") + '</div>' + bar + (o.sub ? '<div class="dz-sub">' + o.sub + '</div>' : "") + '</div>' +
    (o.side ? '<div class="dz-side">' + o.side + '</div>' : "") + '</section>';
}
/* a: [action, label, extra attributes, "primary"] */
function dzActs(main, more){
  const b = (a, cls) => '<button type="button" class="' + cls + (a[3] ? " " + a[3] : "") + '" data-act="' + a[0] + '"' + (a[2] || "") + '>' + esc(a[1]) + '</button>';
  return '<div class="dz-acts no-print">' + main.map(a => b(a, "dz-act")).join("") +
    (more && more.length ? '<div class="dz-morew"><button type="button" class="dz-act ghost" data-act="dz-more" aria-haspopup="menu" aria-expanded="' + DZ.more + '">More<i aria-hidden="true"></i></button>' +
      (DZ.more ? '<div class="dz-pop" role="menu">' + more.map(a => b(a, "dz-mi")).join("") + '</div>' : "") + '</div>' : "") + '</div>';
}
/* rows: { t, s, v, tone, act, id, page } */
function dzList(title, rows, foot){
  return '<section class="dz-list"><div class="dz-lh">' + esc(title) + '</div>' +
    (rows.length ? rows.map((r, i) => '<button type="button" class="dz-row' + (r.tone ? " t-" + r.tone : "") + '" data-act="' + (r.act || "goto") + '"' +
      (r.id ? ' data-id="' + esc(r.id) + '"' : "") + (r.page ? ' data-page="' + r.page + '"' : "") + ' style="--i:' + i + '">' +
      '<span class="dz-dot" aria-hidden="true"></span><span class="dz-rm"><b>' + esc(r.t) + '</b>' + (r.s ? '<small>' + esc(r.s) + '</small>' : "") + '</span>' +
      (r.v ? '<span class="dz-rv">' + r.v + '</span>' : "") + '<span class="dz-go" aria-hidden="true">›</span></button>').join("")
      : '<div class="dz-empty">Nothing needs attention right now. Alhamdulillah.</div>') + (foot || "") + '</section>';
}
function dzOwing(views){ return views.filter(v => v.balance > 0 && !v.waived).sort((a, b) => (b.daysOverdue - a.daysOverdue) || (b.balance - a.balance)); }
function dzWhy(v, where){ return [where, v.daysOverdue ? v.daysOverdue + " day" + (v.daysOverdue > 1 ? "s" : "") + " late" : "due " + fmtDate(v.dueDate)].filter(Boolean).join(" · "); }
function dzCollected(s, m, word){
  if (!s.net) return "No " + word + " due list for " + monthLabel(m) + " yet — make it on Due date.";
  return s.collectionPct + "% of " + money(s.net) + " expected" +
    (s.balance > 0 ? " · " + money(s.balance) + " to come" : " · all collected") +
    (s.overdueAmt > 0 ? ' · <span class="bad">' + money(s.overdueAmt) + ' overdue</span>' : "");
}

/* students still waiting for a class, and classes that have no teacher — a row each, shown first */
function dzSetupRows(stream){
  const rows = [];
  if (stream !== "batch") {
    const noT = DataService.getPlans({ status: "Active" }).filter(p => !p.teacherId || !DataService.getTeacher(p.teacherId));
    if (noT.length) rows.push({ t: noT.length + " class" + (noT.length > 1 ? "es have" : " has") + " no teacher", s: "assign a teacher on Classes", tone: "warn", act: "plans-noteacher-go" });
  }
  if (stream !== "individual") {
    const noTB = DataService.getBatches().filter(b => (b.status || "Active") === "Active" && !b.teacherId);
    if (noTB.length) rows.push({ t: noTB.length + " batch" + (noTB.length > 1 ? "es have" : " has") + " no teacher", s: "set it on Classes", tone: "warn", act: "goto", page: "batches" });
  }
  if (!stream) {
    const wait = DataService.getStudents().filter(s => (s.status || "Active") === "Active" && Logic.classInfo(s.id).pending);
    if (wait.length) rows.push({ t: wait.length + " student" + (wait.length > 1 ? "s are" : " is") + " waiting for a class", s: "class pending", tone: "warn", act: "students-pending" });
  }
  return rows;
}
function dzMissing(m, src){ const n = Logic.buildMonth(m, src, { dry: true }).created; return n; }

/* ---- Batch classes ---- */
Pages.bDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "batch" });
  const s = Logic.summarize(views.filter(v => !v.waived));
  const batches = DataService.getBatches().filter(b => b.status === "Active");
  const students = {}; batches.forEach(b => Logic.rosterOf(b.id).forEach(x => students[x.id] = true));
  const att = Logic.attStats(DataService.getAttendance({ month: m }));
  const owing = dzOwing(views), miss = dzMissing(m, "batch");
  const rows = dzSetupRows("batch");
  if (miss) rows.unshift({ t: miss + " student" + (miss > 1 ? "s are" : " is") + " not on the " + monthShort(m) + " due list", s: views.length ? "add them on Due date" : "make the list on Due date", tone: "warn", act: "goto", page: "bFees" });
  owing.slice(0, Math.max(3, 5 - rows.length)).forEach(v => rows.push({ t: v.studentName, s: dzWhy(v, (DataService.getBatch(v.batchId) || {}).name),
    v: money(v.balance), tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId }));
  return dzHero({ label: "Collected · " + monthLabel(m), value: s.paid, pct: s.net ? s.collectionPct : null, sub: dzCollected(s, m, "batch") }) +
    '<div class="dz-stats">' +
      dzStat("Students", dzCount(Object.keys(students).length, "num"), num(batches.length) + " active batch" + (batches.length === 1 ? "" : "es"), "", "batches") +
      dzStat("Pending", dzCount(views.filter(v => v.balance > 0 && !v.waived).length, "num"), s.balance ? money(s.balance) + " to collect" : "nothing to collect", s.balance ? "warn" : "", "bFees") +
      dzStat("Attendance", att.total ? dzCount(att.pct, "pct") : "—", att.total ? num(att.total) + " marks this month" : "nothing marked yet",
        att.total ? (att.pct >= 85 ? "ok" : att.pct >= 70 ? "warn" : "bad") : "", "attendance") +
    '</div>' +
    dzActs([["att-quick", "Mark attendance", "", "primary"], ["goto", "Due date", ' data-page="bFees"']],
      [["student-new", "New student"], ["enrol-new", "Enrol a student"], ["batch-new", "Add batch"]]) +
    dzList("Needs attention", rows, owing.length > 3 ? '<button type="button" class="dz-all" data-act="goto" data-page="bFees">All ' + owing.length + ' pending</button>' : "");
};

/* ---- Individual classes ---- */
Pages.iDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "individual" });
  const s = Logic.summarize(views.filter(v => !v.waived));
  const plans = DataService.getPlans({ status: "Active" });
  const cs = Logic.classStats(DataService.getClasses({ month: m }));
  const um = Logic.unmarked(m);
  const rev = typeof revCount === "function" ? revCount() : 0;
  const owing = dzOwing(views), miss = dzMissing(m, "individual");
  const rows = dzSetupRows("individual");
  if (miss) rows.unshift({ t: miss + " class" + (miss > 1 ? "es are" : " is") + " not on the " + monthShort(m) + " due list", s: views.length ? "add them on Due date" : "make the list on Due date", tone: "warn", act: "goto", page: "iFees" });
  if (um.count) rows.push({ t: um.count + " class day" + (um.count > 1 ? "s" : "") + " not marked", s: "in " + monthLabel(m) + " · open the sheet to mark them", tone: "warn", act: "dz-unmarked" });
  if (rev) rows.push({ t: rev + " change" + (rev > 1 ? "s" : "") + " from class admins", s: "check and accept them on Review", tone: "warn", act: "goto", page: "iRev" });
  owing.slice(0, Math.max(3, 5 - rows.length)).forEach(v => rows.push({ t: v.studentName, s: dzWhy(v, v.course || ""), v: money(v.balance),
    tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId }));
  return dzHero({ label: "Collected · " + monthLabel(m), value: s.paid, pct: s.net ? s.collectionPct : null, sub: dzCollected(s, m, "individual") }) +
    '<div class="dz-stats">' +
      dzStat("Active classes", dzCount(plans.length, "num"), num(new Set(plans.map(p => p.studentId)).size) + " students", "", "plans") +
      dzStat("Pending", dzCount(views.filter(v => v.balance > 0 && !v.waived).length, "num"), s.balance ? money(s.balance) + " to collect" : "nothing to collect", s.balance ? "warn" : "", "iFees") +
      dzStat("Classes taken", dzCount(cs.completed, "num"), num(cs.total) + " marks this month", "", "classes") +
    '</div>' +
    dzActs([["goto", "Mark attendance", ' data-page="iAtt"', "primary"], ["goto", "Due date", ' data-page="iFees"']],
      [["student-new", "New student"], ["plan-new", "New class"]]) +
    dzList("Needs attention", rows, owing.length > 3 ? '<button type="button" class="dz-all" data-act="goto" data-page="iFees">All ' + owing.length + ' pending</button>' : "");
};

/* ---- Academy books ---- */
Pages.overview = function(){
  const m = State.month;
  const pl = Logic.pnl(monthStart(m), monthEnd(m));
  const views = Logic.feeViews({ month: m });
  const all = Logic.summarize(views.filter(v => !v.waived));
  const bal = Logic.accountBalances();
  const salary = round2(DataService.getTeacherPayments({ month: m }).reduce((x, p) => x + (+p.amount || 0), 0));
  const students = DataService.getStudents().filter(x => x.status === "Active");
  const joined = students.filter(x => x.joiningDate && x.joiningDate >= monthStart(m) && x.joiningDate <= monthEnd(m)).length;
  const owing = dzOwing(views), miss = dzMissing(m, "");
  const other = pl.netIncome - pl.batchFee - pl.indFee;
  const side = [["Batch fees", pl.batchFee], ["Individual fees", pl.indFee], ["Other income", other]].map(x =>
    '<div><b>' + money(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>').join("");
  const rows = dzSetupRows("");
  if (miss) rows.unshift({ t: miss + " not on the " + monthShort(m) + " due list", s: views.length ? "add them on Due date" : "make the list on Due date", tone: "warn", act: "goto", page: "dues" });
  owing.slice(0, Math.max(3, 6 - rows.length)).forEach(v => rows.push({ t: v.studentName, s: (v.source === "batch" ? "Batch" : "Individual") + " · " + dzWhy(v),
    v: money(v.balance), tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId }));
  return dzHero({ label: "Net profit · " + monthLabel(m), value: pl.profit, tone: pl.profit < 0 ? "bad" : "",
      sub: money(pl.netIncome) + " came in · " + money(pl.expense) + " went out" + (pl.netIncome ? " · " + pct(pl.profit, pl.netIncome) + "% margin" : ""), side: side }) +
    '<div class="dz-stats">' +
      dzStat("Collected", dzCount(all.paid, "money"), all.net ? all.collectionPct + "% of " + money(all.net) : "no due list yet", "", "dues") +
      dzStat("Pending", dzCount(all.balance, "money"), all.overdueAmt ? '<span class="bad">' + money(all.overdueAmt) + ' overdue</span>' : "nothing overdue", all.overdueAmt ? "warn" : "", "dues") +
      dzStat("Salary paid", dzCount(salary, "money"), monthLabel(m), "", "tsalary") +
      dzStat("Balance", dzCount(bal.total, "money"), "all accounts", "", "accounts") +
      dzStat("Students", dzCount(students.length, "num"), joined ? joined + " joined in " + monthShort(m) : "active now", "", "students") +
    '</div>' +
    dzActs([["student-new", "New student", "", "primary"], ["goto", "Due date", ' data-page="dues"'], ["tsal-new", "Add salary"]],
      [["exp-new", "Add expense"], ["inc-new", "Add income"], ["link-new", "Teacher attendance link"], ["att-import", "Import teacher code"], ["print", "Export view"]]) +
    dzList("Needs attention", rows, owing.length > 3 ? '<button type="button" class="dz-all" data-act="goto" data-page="dues">All ' + owing.length + ' pending</button>' : "");
};
HEAD_ACTS.overview = "";   /* Export view and Calculate this month now sit with the dashboard's actions */

Object.assign(Actions, {
  "dz-more": () => { DZ.more = !DZ.more; render(); },
  "dz-unmarked": () => { if (State.iatt) { State.iatt.unmarked = true; State.iatt.tab = "sheet"; } go("iAtt"); },
  "plans-noteacher-go": () => { State.plans.teacher = "none"; State.plans.status = "Active"; resetLists(); go("plans"); },
  "students-pending": () => { State.students.cls = "pending"; State.students.status = "Active"; resetLists(); go("students"); }
});
/* a More item closes its menu at once; a tap anywhere else closes it too */
document.addEventListener("click", function(e){
  if (!DZ.more) return;
  if (e.target.closest(".dz-pop .dz-mi")) { DZ.more = false; const p = document.querySelector(".dz-pop"); if (p) p.remove();
    const b = document.querySelector('[data-act="dz-more"]'); if (b) b.setAttribute("aria-expanded", "false"); return; }
  if (!e.target.closest(".dz-morew")) { DZ.more = false; render(); }
}, true);
document.addEventListener("keydown", function(e){ if (e.key === "Escape" && DZ.more) { DZ.more = false; render(); } });

/* ---- motion: a page rises in when you open it; dashboard numbers count up ---- */
function dzEnter(){
  if (dzCalm()) return;
  ["#view", ".head"].forEach(function(sel){
    const el = document.querySelector(sel); if (!el) return;
    el.classList.remove("pg-in"); void el.offsetWidth; el.classList.add("pg-in");
    clearTimeout(el._pgT); el._pgT = setTimeout(() => el.classList.remove("pg-in"), 700);
  });
}
function dzCountUp(){
  if (dzCalm()) return;
  const els = Array.prototype.slice.call(document.querySelectorAll("#view .dz-n[data-count]"));
  if (!els.length || typeof requestAnimationFrame !== "function") return;
  const to = els.map(el => +el.dataset.count || 0), t0 = (window.performance && performance.now) ? performance.now() : Date.now(), dur = 900;
  els.forEach(el => { el.textContent = dzFmt(0, el.dataset.fmt); });
  (function step(now){
    const p = Math.min(1, ((now || Date.now()) - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    els.forEach((el, i) => { if (el.isConnected) el.textContent = p < 1 ? dzFmt(Math.round(to[i] * e), el.dataset.fmt) : dzFmt(to[i], el.dataset.fmt); });
    if (p < 1) requestAnimationFrame(step);
  })(t0);
}
const _dzGo = go;
go = function(page){
  DZ.more = false;
  _dzGo(page);
  document.body.classList.toggle("dz-on", !!DZ_PAGES[page]);
  if (page !== "iAtt") dzEnter();
  if (DZ_PAGES[page]) dzCountUp();
};
