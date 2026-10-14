"use strict";
/* Academic Service — dash.v1.js. Quiet dashboards for the three workspaces (Batch classes, Individual, Academy books):
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
function dzOwing(views){ return views.filter(v => v.balance > 0).sort((a, b) => (b.daysOverdue - a.daysOverdue) || (b.balance - a.balance)); }
function dzWhy(v, where){ return [where, v.daysOverdue ? v.daysOverdue + " day" + (v.daysOverdue > 1 ? "s" : "") + " late" : "due " + fmtDate(v.dueDate)].filter(Boolean).join(" · "); }
function dzCollected(s, m, word){
  if (!s.net) return "No " + word + " fees for " + monthLabel(m) + " yet — calculate them to begin.";
  return s.collectionPct + "% of " + money(s.net) + " " + (word === "batch" ? "expected" : "earned") +
    (s.balance > 0 ? " · " + money(s.balance) + " to come" : " · all collected") +
    (s.overdueAmt > 0 ? ' · <span class="bad">' + money(s.overdueAmt) + ' overdue</span>' : "");
}

/* ---- Batch classes ---- */
Pages.bDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "batch" });
  const s = Logic.summarize(views);
  const batches = DataService.getBatches().filter(b => b.status === "Active");
  const students = {}; batches.forEach(b => Logic.rosterOf(b.id).forEach(x => students[x.id] = true));
  const att = Logic.attStats(DataService.getAttendance({ month: m }));
  const owing = dzOwing(views);
  return dzHero({ label: "Collected · " + monthLabel(m), value: s.paid, pct: s.net ? s.collectionPct : null, sub: dzCollected(s, m, "batch") }) +
    '<div class="dz-stats">' +
      dzStat("Students", dzCount(Object.keys(students).length, "num"), num(batches.length) + " active batch" + (batches.length === 1 ? "" : "es"), "", "batches") +
      dzStat("Attendance", att.total ? dzCount(att.pct, "pct") : "—", att.total ? num(att.total) + " marks this month" : "nothing marked yet",
        att.total ? (att.pct >= 85 ? "ok" : att.pct >= 70 ? "warn" : "bad") : "", "attendance") +
      dzStat("Overdue", dzCount(s.overdueN, "num"), s.overdueAmt ? money(s.overdueAmt) + " past due" : "nobody past due", s.overdueN ? "bad" : "", "bDues") +
    '</div>' +
    dzActs([["att-quick", "Mark attendance", "", "primary"], ["batch-fees-build", "Calculate " + monthShort(m) + " fees"]],
      [["student-new", "Add student"], ["batch-new", "Add batch"], ["goto", "Batch reports", ' data-page="bReports"']]) +
    dzList("Needs attention", owing.slice(0, 5).map(v => ({ t: v.studentName, s: dzWhy(v, (DataService.getBatch(v.batchId) || {}).name),
      v: money(v.balance), tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId })),
      owing.length > 5 ? '<button type="button" class="dz-all" data-act="goto" data-page="bDues">All ' + owing.length + ' dues</button>' : "");
};

/* ---- Individual classes ---- */
Pages.iDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "individual" });
  const s = Logic.summarize(views);
  const plans = DataService.getPlans({ status: "Active" });
  const cs = Logic.classStats(DataService.getClasses({ month: m }));
  const um = Logic.unmarked(m);
  const rev = typeof revCount === "function" ? revCount() : 0;
  const owing = dzOwing(views);
  const rows = [];
  if (um.count) rows.push({ t: um.count + " class day" + (um.count > 1 ? "s" : "") + " not marked", s: "in " + monthLabel(m) + " · open the sheet to mark them", tone: "warn", act: "dz-unmarked" });
  if (rev) rows.push({ t: rev + " change" + (rev > 1 ? "s" : "") + " from class admins", s: "check and accept them on Review", tone: "warn", act: "goto", page: "iRev" });
  owing.slice(0, Math.max(3, 5 - rows.length)).forEach(v => rows.push({ t: v.studentName, s: dzWhy(v, v.course || ""), v: money(v.balance),
    tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId }));
  const missed = cs.studentAbsent + cs.teacherAbsent + cs.cancelled;
  return dzHero({ label: "Collected · " + monthLabel(m), value: s.paid, pct: s.net ? s.collectionPct : null, sub: dzCollected(s, m, "individual") }) +
    '<div class="dz-stats">' +
      dzStat("Active plans", dzCount(plans.length, "num"), num(new Set(plans.map(p => p.studentId)).size) + " students", "", "plans") +
      dzStat("Classes held", dzCount(cs.completed, "num"), round2(cs.minutes / 60) + " h this month", "", "classes") +
      dzStat("Missed", dzCount(missed, "num"), cs.studentAbsent + " student · " + cs.teacherAbsent + " teacher", missed ? "warn" : "", "classes") +
    '</div>' +
    dzActs([["goto", "Mark attendance", ' data-page="iAtt"', "primary"], ["ind-fees-build", "Calculate " + monthShort(m) + " fees"]],
      [["plan-new", "New class plan"], ["goto", "Due and overdue", ' data-page="iDues"'], ["goto", "Individual reports", ' data-page="iReports"']]) +
    dzList("Needs attention", rows, owing.length > 3 ? '<button type="button" class="dz-all" data-act="goto" data-page="iDues">All ' + owing.length + ' dues</button>' : "");
};

/* ---- Academy books ---- */
Pages.overview = function(){
  const m = State.month;
  const pl = Logic.pnl(monthStart(m), monthEnd(m));
  const all = Logic.summarize(Logic.feeViews({ month: m }));
  const bal = Logic.accountBalances();
  const payPending = Logic.payrollMonth(m).reduce((x, p) => x + Math.max(0, p.balance), 0);
  const students = DataService.getStudents().filter(x => x.status === "Active");
  const joined = students.filter(x => x.joiningDate && x.joiningDate >= monthStart(m) && x.joiningDate <= monthEnd(m)).length;
  const owing = dzOwing(Logic.feeViews({ month: m }));
  const other = pl.netIncome - pl.batchFee - pl.indFee;
  const side = [["Batch fees", pl.batchFee], ["Individual fees", pl.indFee], ["Other income", other]].map(x =>
    '<div><b>' + money(x[1]) + '</b><span>' + esc(x[0]) + '</span></div>').join("");
  return dzHero({ label: "Net profit · " + monthLabel(m), value: pl.profit, tone: pl.profit < 0 ? "bad" : "",
      sub: money(pl.netIncome) + " came in · " + money(pl.expense) + " went out" + (pl.netIncome ? " · " + pct(pl.profit, pl.netIncome) + "% margin" : ""), side: side }) +
    '<div class="dz-stats">' +
      dzStat("Collected", dzCount(all.paid, "money"), all.net ? all.collectionPct + "% of " + money(all.net) : "no fees raised yet", "", "payments") +
      dzStat("Receivable", dzCount(all.balance, "money"), all.overdueAmt ? '<span class="bad">' + money(all.overdueAmt) + ' overdue</span>' : "nothing overdue", all.overdueAmt ? "warn" : "") +
      dzStat("Teacher pay due", dzCount(payPending, "money"), monthLabel(m), "", "tpay") +
      dzStat("Balance", dzCount(bal.total, "money"), "all accounts", "", "accounts") +
      dzStat("Students", dzCount(students.length, "num"), joined ? joined + " joined in " + monthShort(m) : "active now", "", "students") +
    '</div>' +
    dzActs([["exp-new", "Add expense", "", "primary"], ["tpay-new", "Pay teacher"], ["build-both", "Calculate this month"]],
      [["next-month", "Open next month"], ["link-new", "Teacher attendance link"], ["att-import", "Import teacher code"], ["print", "Export view"]]) +
    dzList("Needs attention", owing.slice(0, 5).map(v => ({ t: v.studentName, s: (v.source === "batch" ? "Batch" : "Individual") + " · " + dzWhy(v),
      v: money(v.balance), tone: v.daysOverdue ? "bad" : "warn", act: "profile-open", id: v.studentId })), "");
};
HEAD_ACTS.overview = "";   /* Export view and Calculate this month now sit with the dashboard's actions */

Object.assign(Actions, {
  "dz-more": () => { DZ.more = !DZ.more; render(); },
  "dz-unmarked": () => { if (State.iatt) { State.iatt.unmarked = true; State.iatt.tab = "sheet"; } go("iAtt"); }
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
