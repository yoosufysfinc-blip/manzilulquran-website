"use strict";
/* Academic Service — ws-books.v4.js. v4: prepaid due-date choice in Settings. */
/* one line per individual student on a teacher's month — rule, amount and an Override button */
function payLinesHtml(pv){
  const L = (pv && pv.indLines) || [];
  if (!L.length) return "";
  return '<div class="sub-hd">Individual students</div>' + L.map(function(x){
    const amt = x.source === "default" ? '<small style="opacity:.7">in default</small>'
      : x.needsAmount ? '<span class="badge b-warn">Needs amount</span>' : money(x.amount);
    return '<div class="minirow" style="flex-wrap:wrap;gap:6px"><span style="flex:1 1 200px">' + esc(x.studentName) +
      ' <span class="tag">' + x.classes + ' cl</span> — ' + esc(x.basis) +
      (x.source === "override" ? ' <span class="tag">override</span>' : "") + '</span>' +
      '<b>' + amt + '</b>' +
      '<button class="btn btn-sm" data-act="tline-edit" data-id="' + esc(pv.teacherId + "|" + x.planId) + '">' +
        (x.source === "override" || x.needsAmount ? "Edit" : "Override") + '</button></div>';
  }).join("") + (L.some(x => x.source !== "default")
    ? '<div class="minirow"><span>Teacher default (other students)</span><b>' + money(pv.indDefaultAmount) + '</b></div>' : "");
}
/* ==========================================================================
   BOOKS WORKSPACE
   ========================================================================== */
Pages.overview = function(){
  const m = State.month, t = today();
  const led = Logic.ledger();
  const pl = Logic.pnl(monthStart(m), monthEnd(m));
  const bs = Logic.summarize(Logic.feeViews({ month: m, source: "batch" }));
  const is = Logic.summarize(Logic.feeViews({ month: m, source: "individual" }));
  const all = Logic.summarize(Logic.feeViews({ month: m }));
  const bal = Logic.accountBalances();
  const payroll = Logic.payrollMonth(m);
  const payPending = payroll.reduce((x, p) => x + Math.max(0, p.balance), 0);
  const todayIn = led.filter(r => r.date === t && !r.transfer).reduce((x, r) => x + r.inAmt, 0);
  const todayOut = led.filter(r => r.date === t && !r.transfer).reduce((x, r) => x + r.outAmt, 0);
  const att = Logic.attStats(DataService.getAttendance({ month: m }));
  const cls = Logic.classStats(DataService.getClasses({ month: m }));
  const students = DataService.getStudents().filter(x => x.status === "Active");
  const advance = DataService.getPayments().filter(x => x.date < monthStart(x.month))
    .reduce((x, p) => x + (+p.amount || 0), 0);

  /* six month trend + a 30 day collection heat strip */
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const mm = addMonths(m, -i), p = Logic.pnl(monthStart(mm), monthEnd(mm));
    trend.push({ label: monthShort(mm), income: p.netIncome, expense: p.expense, profit: p.profit,
      batch: p.batchFee, ind: p.indFee });
  }
  const heat = [];
  for (let i = 29; i >= 0; i--) {
    const d = ymd(new Date(Date.now() - i * 86400000));
    heat.push({ d: d, v: led.filter(r => r.date === d && r.inAmt && !r.transfer).reduce((x, r) => x + r.inAmt, 0) });
  }

  /* colour-coded league tables */
  const byBatch = DataService.getBatches().filter(x => x.status === "Active").map(function(b){
    const g = Logic.summarize(Logic.feeViews({ month: m, source: "batch", batchId: b.id }));
    return { label: b.name, value: g.paid, text: money(g.paid) + " of " + money(g.net),
      color: g.collectionPct >= 80 ? "#2F7D4F" : g.collectionPct >= 50 ? "#C07C1E" : "#B2402F" };
  }).sort((x, y) => y.value - x.value).slice(0, 6);
  const expCats = Object.keys(pl.byCategory).map(k => ({ label: k, value: pl.byCategory[k], color: "#B2402F" }))
    .sort((x, y) => y.value - x.value).slice(0, 6);
  /* per-class collection, per-group attendance and who to chase — detail, not decoration */
  const byBatchRows = DataService.getBatches().filter(x => x.status === "Active").map(function(b){
    const g = Logic.summarize(Logic.feeViews({ month: m, source: "batch", batchId: b.id }));
    const te = DataService.getTeacher(b.teacherId);
    return { name: b.name, teacher: te ? te.name : "—", students: Logic.rosterOf(b.id).length,
      paid: g.paid, net: g.net, pctv: g.collectionPct };
  }).sort((x, y) => y.net - x.net).slice(0, 6);
  const attByGroup = (function(){
    const rows = [], seen = {};
    DataService.getSubclasses().forEach(function(sc){
      const list = DataService.getAttendance({ month: m, subClassId: sc.id });
      if (!list.length) return;
      const st = Logic.attStats(list), b = DataService.getBatch(sc.batchId);
      const days = {}; list.forEach(x => days[x.date] = true);
      seen[sc.batchId] = true;
      rows.push({ label: (b ? b.name + " · " : "") + sc.name, pct: st.pct, total: st.total,
        absent: st.Absent, sessions: Object.keys(days).length });
    });
    DataService.getBatches().forEach(function(b){
      if (DataService.getSubclasses({ batchId: b.id }).length) return;
      const list = DataService.getAttendance({ month: m, batchId: b.id });
      if (!list.length) return;
      const st = Logic.attStats(list), days = {};
      list.forEach(x => days[x.date] = true);
      rows.push({ label: b.name, pct: st.pct, total: st.total, absent: st.Absent, sessions: Object.keys(days).length });
    });
    return rows.sort((x, y) => x.pct - y.pct).slice(0, 6);
  })();
  const watch = Logic.feeViews({ month: m }).filter(v => v.balance > 0)
    .sort((x, y) => (y.daysOverdue - x.daysOverdue) || (y.balance - x.balance)).slice(0, 6);
  const teacherCost = payroll.map(p => ({ label: p.teacherName, value: p.payable,
    text: money(p.payable), color: "#8A6A2A" })).sort((x, y) => y.value - x.value);
  const topDebt = Logic.feeViews({ month: m }).filter(v => v.balance > 0)
    .sort((x, y) => y.balance - x.balance).slice(0, 6);

  return '' +
  '<div class="qbar no-print">' +
    '<button class="qbtn" data-act="pay-new"><span class="qi">₹</span> Record payment</button>' +
    '<button class="qbtn" data-act="next-month"><span class="qi">▸</span> Open next month</button>' +
    '<button class="qbtn" data-act="link-new"><span class="qi">⇗</span> Teacher attendance link</button>' +
    '<button class="qbtn" data-act="att-import"><span class="qi">⇩</span> Import teacher code</button>' +
    '<button class="qbtn" data-act="exp-new"><span class="qi">↓</span> Add expense</button>' +
    '<button class="qbtn" data-act="tpay-new"><span class="qi">◇</span> Pay teacher</button>' +
  '</div>' +

  /* ---- hero: the one number that matters, plus the split behind it ---- */
  '<div class="hero">' +
    '<div class="hero-main">' +
      '<div class="lab">Net profit · ' + esc(monthLabel(m)) + '</div>' +
      '<div class="big">' + money(pl.profit) + '</div>' +
      '<div class="sub">' + money(pl.netIncome) + ' came in, ' + money(pl.expense) + ' went out · ' +
        pct(pl.profit, pl.netIncome) + '% margin</div>' +
      '<div class="hero-split">' +
        '<div><div class="n">' + money(pl.batchFee) + '</div><div class="l">Batch fees</div></div>' +
        '<div><div class="n">' + money(pl.indFee) + '</div><div class="l">Individual fees</div></div>' +
        '<div><div class="n">' + money(pl.netIncome - pl.batchFee - pl.indFee) + '</div><div class="l">Other income</div></div>' +
        '<div><div class="n">' + money(todayIn - todayOut) + '</div><div class="l">Net today</div></div>' +
      '</div>' +
      '<div style="margin-top:18px"><div class="lab" style="margin-bottom:7px">Collection · last 30 days</div>' +
        heatStrip(heat) + '</div>' +
    '</div>' +
    '<div class="card"><div class="card-bd">' +
      '<div class="ring-wrap">' + ring(all.collectionPct, "#2F7D4F", all.collectionPct + "%", "COLLECTED") +
        '<div style="flex:1 1 150px">' +
          '<div class="stat-line"><span>Expected this month</span><b>' + money(all.net) + '</b></div>' +
          '<div class="stat-line"><span>Collected</span><b style="color:var(--ok)">' + money(all.paid) + '</b></div>' +
          '<div class="stat-line"><span>Still to come</span><b style="color:var(--bad)">' + money(all.balance) + '</b></div>' +
          '<div class="stat-line"><span>Paid in advance</span><b>' + money(advance) + '</b></div>' +
        '</div>' +
      '</div>' +
      '<div style="height:14px"></div>' +
      accountRail(bal) +
      '<div style="height:12px"></div>' + accountCards(bal) +
    '</div></div>' +
  '</div>' +

  /* ---- headline tiles ---- */
  '<div class="kpi-grid">' +
    kpi("Active students", num(students.length),
      num(DataService.getBatches().filter(x => x.status === "Active").length) + " classes · " +
      num(DataService.getSubclasses().length) + " sub-classes") +
    kpi("Attendance", att.pct + '<span class="u">%</span>', num(att.total) + " marks in " + monthShort(m),
      att.pct >= 85 ? "a-ok" : att.pct >= 70 ? "a-warn" : "a-bad") +
    kpi("Individual classes", num(cls.completed), num(cls.total) + " logged · " + round2(cls.minutes / 60) + " h") +
    kpi("Receivable", money(all.balance), num(all.count - all.paidN) + " students owing", "a-warn") +
    kpi("Overdue", money(all.overdueAmt), num(all.overdueN) + " past the due date", "a-bad") +
    kpi("Payable to teachers", money(payPending), esc(monthLabel(m)), "a-acc") +
  '</div>' +

  /* ---- colour infographics ---- */
  '<div class="section-title">This month in detail</div>' +
  '<div class="chart-grid">' +
    '<div class="card chart-box"><h3>Where the money came from</h3>' +
      splitBar([{ label: "Batch", value: pl.batchFee, color: "#1E7A52" },
                { label: "Individual", value: pl.indFee, color: "#137C6E" },
                { label: "Other", value: Math.max(0, pl.netIncome - pl.batchFee - pl.indFee), color: "#8FD3AE" }]) +
      '<div style="height:6px"></div>' +
      detailRow({ title: "Income", sub: "six month trend", spark: spark(trend.map(x => x.income), "#1E7A52"),
        value: money(pl.netIncome), meta: pct(pl.netIncome, Math.max(...trend.map(x => x.income))) + "% of best month" }) +
      detailRow({ title: "Expense", sub: "six month trend", spark: spark(trend.map(x => x.expense), "#B2402F"),
        value: money(pl.expense), meta: pct(pl.expense, pl.netIncome) + "% of income" }) +
      detailRow({ title: "Profit", sub: "six month trend", spark: spark(trend.map(x => x.profit), "#137C6E"),
        value: money(pl.profit), meta: pct(pl.profit, pl.netIncome) + "% margin" }) +
    '</div>' +

    '<div class="card chart-box"><h3>Fee collection</h3>' +
      splitBar([{ label: "Collected", value: all.paid, color: "#1E7A52" },
                { label: "Still due", value: Math.max(0, all.balance - all.overdueAmt), color: "#C07C1E" },
                { label: "Overdue", value: all.overdueAmt, color: "#B2402F" }]) +
      '<div style="height:6px"></div>' +
      detailRow({ title: "Batch stream", sub: num(bs.count) + " records · " + num(bs.paidN) + " settled",
        spark: spark(trend.map(x => x.batch), "#1E7A52"), value: money(bs.paid), meta: "of " + money(bs.net),
        pct: bs.collectionPct, color: "#1E7A52" }) +
      detailRow({ title: "Individual stream", sub: num(is.count) + " records · " + num(is.paidN) + " settled",
        spark: spark(trend.map(x => x.ind), "#137C6E"), value: money(is.paid), meta: "of " + money(is.net),
        pct: is.collectionPct, color: "#137C6E" }) +
      detailRow({ title: "Paid before the month began", sub: "prepaid advantage",
        value: money(advance), meta: pct(advance, all.paid) + "% of what came in" }) +
    '</div>' +

    '<div class="card chart-box"><h3>Attendance</h3>' +
      splitBar([{ label: "Present", value: att.Present, color: "#1E7A52", text: num(att.Present) },
                { label: "Absent", value: att.Absent, color: "#B2402F", text: num(att.Absent) },
                { label: "Leave", value: att.Leave, color: "#C07C1E", text: num(att.Leave) },
                { label: "Excused", value: att.Excused, color: "#35638C", text: num(att.Excused) }]) +
      '<div style="height:6px"></div>' +
      (attByGroup.length ? attByGroup.map(g => detailRow({ title: esc(g.label),
          sub: g.sessions + " sessions · " + num(g.total) + " marks",
          value: g.pct + "%", meta: g.absent + " absent", pct: g.pct,
          color: g.pct >= 85 ? "#1E7A52" : g.pct >= 70 ? "#C07C1E" : "#B2402F" })).join("")
        : '<div class="empty" style="padding:18px">Nothing marked yet this month.</div>') +
    '</div>' +

    '<div class="card chart-box"><h3>Class collection</h3>' +
      (byBatchRows.length ? byBatchRows.map(r => detailRow({ title: esc(r.name),
          sub: r.students + " students · " + esc(r.teacher),
          value: money(r.paid), meta: "of " + money(r.net), pct: r.pctv,
          color: r.pctv >= 80 ? "#1E7A52" : r.pctv >= 50 ? "#C07C1E" : "#B2402F" })).join("")
        : '<div class="empty" style="padding:18px">No batch fees yet.</div>') +
    '</div>' +

    '<div class="card chart-box"><h3>Teacher cost</h3>' +
      (payroll.length ? payroll.slice().sort((x, y) => y.payable - x.payable).map(pp => detailRow({
          title: esc(pp.teacherName),
          sub: (pp.groups || []).length + " group(s) · " + pp.sessions + " sessions · " +
            round2(pp.classStats.minutes / 60) + " h individual",
          value: money(pp.payable), meta: pp.balance > 0 ? money(pp.balance) + " unpaid" : "settled",
          pct: pct(pp.paid, pp.payable), color: pp.balance > 0 ? "#C07C1E" : "#1E7A52" })).join("")
        : '<div class="empty" style="padding:18px">No teachers yet.</div>') +
    '</div>' +

    '<div class="card chart-box"><h3>Watchlist</h3>' +
      (watch.length ? watch.map(v => detailRow({ title: esc(v.studentName),
          sub: (v.source === "batch" ? "Batch" : "Individual") + " · " + esc(monthShort(v.month)) +
            (v.daysOverdue ? " · " + v.daysOverdue + " days late" : " · due " + fmtDate(v.dueDate)),
          value: money(v.balance), meta: v.paidAmount ? money(v.paidAmount) + " paid" : "nothing paid",
          pct: pct(v.paidAmount, v.netFee), color: v.daysOverdue ? "#B2402F" : "#C07C1E" })).join("")
        : '<div class="empty" style="padding:18px">Nobody is behind. Alhamdulillah.</div>') +
    '</div>' +
  '</div>' +

  '<div class="section-title">Streams side by side</div>' +
  '<div class="grid-2">' +
    ['batch|Batch classes|' + bs.net + '|' + bs.paid + '|' + bs.balance + '|' + bs.collectionPct + '|' + bs.count,
     'ind|Individual classes|' + is.net + '|' + is.paid + '|' + is.balance + '|' + is.collectionPct + '|' + is.count]
    .map(function(x){
      const p = x.split("|");
      const col = p[0] === "batch" ? "#2F6B4A" : "#2C5A80";
      return '<div class="card"><div class="card-bd">' +
        '<div class="spread"><h3 style="font-size:17px">' + p[1] + '</h3>' +
          '<span class="tag" style="background:' + col + '18;color:' + col + '">' + p[6] + ' fee records</span></div>' +
        '<div class="ring-wrap" style="margin-top:12px">' + ring(+p[5], col, p[5] + "%", "COLLECTED", 118) +
          '<div style="flex:1 1 150px">' +
            '<div class="stat-line"><span>Expected</span><b>' + money(+p[2]) + '</b></div>' +
            '<div class="stat-line"><span>Collected</span><b style="color:var(--ok)">' + money(+p[3]) + '</b></div>' +
            '<div class="stat-line"><span>Balance</span><b style="color:var(--bad)">' + money(+p[4]) + '</b></div>' +
          '</div></div></div></div>';
    }).join("") +
  '</div>';
};

Pages.students = function(){
  const f = State.students, q = f.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getStudents().map(function(s){
    const str = Logic.streamsOf(s.id);
    const fees = Logic.feeViews({ studentId: s.id, month: m }).map(withBasis);
    const due = Logic.feeViews({ studentId: s.id }).reduce((a, v) => a + v.balance, 0);
    const b = str.batch ? DataService.getBatch(str.batch.batchId) : null;
    const t = str.individual ? DataService.getTeacher(str.individual.teacherId) : (b ? DataService.getTeacher(b.teacherId) : null);
    return Object.assign({}, s, { str: str, fees: fees, due: due, batch: b, teacher: t,
      monthFee: fees.reduce((a, v) => a + v.netFee, 0) });
  }).filter(function(s){
    if (f.status && s.status !== f.status) return false;
    if (f.stream === "batch" && !s.str.batch) return false;
    if (f.stream === "individual" && !s.str.individual) return false;
    if (f.stream === "both" && !(s.str.batch && s.str.individual)) return false;
    return search(s.id + " " + s.name + " " + s.phone + " " + s.whatsapp + " " + (s.guardian || ""), q);
  });
  const both = rows.filter(s => s.str.batch && s.str.individual).length;

  return '' +
  '<div class="note">One registry for the whole academy. ' + num(both) + ' student(s) currently sit in a batch <b>and</b> take individual classes — each stream is billed on its own fee record, so nothing is charged or counted twice.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="students.q" value="' + esc(f.q) + '" placeholder="Name, ID, phone or WhatsApp">', "grow") +
    field("Status", sel("s", optList(Settings().studentStatuses, f.status, "All"), 'data-fset="students.status"')) +
    field("Stream", sel("st", optList([{ value: "batch", label: "In a batch" }, { value: "individual", label: "Individual classes" },
      { value: "both", label: "Both streams" }], f.stream, "All streams"), 'data-fset="students.stream"')) +
    '<div class="push btn-row">' +
      '<button class="btn" data-act="students-csv">CSV</button>' +
      '<button class="btn btn-primary" data-act="student-new">+ Add student</button>' +
    '</div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("students", rows, {
      key: s => s.id, head: ["Student", monthShort(m) + " fee"],
      title: s => esc(s.name) + " " + idchip(s.id),
      sub: s => [s.str.batch ? "Batch: " + (s.batch ? s.batch.name : s.str.batch.batchId) : null,
                 s.str.individual ? "Individual: " + s.str.individual.course : null,
                 (!s.str.batch && !s.str.individual) ? "No active class" : null].filter(Boolean).join(" · "),
      amount: s => money(s.monthFee) + (s.due ? '<small class="out">' + money(s.due) + ' due</small>' : '<small>settled</small>'),
      badge: s => (s.str.batch && s.str.individual) ? '<span class="badge b-acc">Both</span>' :
                  s.str.batch ? streamChip("batch") : s.str.individual ? streamChip("individual") : badge(s.status),
      rowClass: s => s.due > 0 ? "row-bad" : "",
      detail: s => dl([
        ["Student ID", idchip(s.id)], ["Guardian", esc(s.guardian || "—")],
        ["Phone", '<span class="mono">' + esc(s.phone || "—") + '</span>'],
        ["WhatsApp", '<span class="mono">' + esc(s.whatsapp || "—") + '</span>'],
        ["Email", esc(s.email || "—")], ["Joined", fmtDate(s.joiningDate)], ["Status", badge(s.status)],
        ["Batch", s.str.batch ? esc((s.batch ? s.batch.name : s.str.batch.batchId)) + " · " + money(s.str.batch.monthlyFee) : "—"],
        ["Individual plan", s.str.individual ? esc(s.str.individual.course) + " · " + Logic.methodLabel(s.str.individual.feeType) +
          " @ " + money(s.str.individual.rate) : "—"],
        ["Teacher", esc(s.teacher ? s.teacher.name : "—")],
        ["Outstanding (all months)", s.due ? '<span class="out">' + money(s.due) + '</span>' : '<span class="in">Nil</span>'],
        s.address ? ["Address", esc(s.address)] : null, s.notes ? ["Notes", esc(s.notes)] : null
      ]) +
      (DataService.getHolds({ studentId: s.id }).length ? ('<div class="sub-hd">Holds / leave</div>' +
        DataService.getHolds({ studentId: s.id }).map(h => '<div class="minirow"><span>⏸ ' + esc(h.from) + " → " + esc(h.to || "open") +
          (h.reason ? " · " + esc(h.reason) : "") + '</span><b>' + (h.waiveFee ? "fee waived" : "fee kept") +
          ' <button class="btn btn-sm" data-act="hold-del" data-id="' + h.id + '">✕</button></b></div>').join("")) : "") +
      '<div class="sub-hd">' + esc(monthLabel(m)) + ' fees</div>' +
      (s.fees.length ? s.fees.map(v => '<div class="minirow"><span>' + streamChip(v.source) + ' ' + esc(v.shortBasis) +
          ' · ' + v.status + '</span><b>' + money(v.paidAmount) + " / " + money(v.netFee) + '</b></div>').join("")
        : '<div class="minirow"><span>No fee record this month</span><b>—</b></div>') +
      acts('<button class="btn btn-sm btn-primary" data-act="profile-open" data-id="' + s.id + '">Open profile</button>' +
        '<button class="btn btn-sm" data-act="student-edit" data-id="' + s.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-act="student-assign" data-id="' + s.id + '">Batch</button>' +
        '<button class="btn btn-sm" data-act="plan-new" data-id="' + s.id + '">Individual plan</button>' +
        '<button class="btn btn-sm" data-act="hold-new" data-id="' + s.id + '">⏸ Hold / Leave</button>' +
        (s.due > 0 ? '<button class="btn btn-sm btn-wa" data-act="wa-student" data-id="' + s.id + '">WhatsApp</button>' : "")),
      sorts: [{ key: "name", label: "Name", val: s => s.name }, { key: "id", label: "Student ID", val: s => s.id },
              { key: "due", label: "Most outstanding first", val: s => s.due, desc: true }],
      emptyTitle: "No students match", emptyText: "Change the filters, or register the student.",
      emptyAction: '<button class="btn btn-primary" data-act="student-new">+ Add student</button>'
    }) +
  '</div></div>';
};

Pages.teachers = function(){
  const q = State.teachers.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getTeachers().filter(t => t.kind !== "staff").map(function(t){
    const v = Logic.payrollView(t, m);
    const batches = DataService.getBatches().filter(b => b.teacherId === t.id);
    const plans = DataService.getPlans({ teacherId: t.id, status: "Active" });
    return Object.assign({}, t, { pv: v, batches: batches, plans: plans });
  }).filter(t => search(t.id + " " + t.name + " " + (t.phone || ""), q));

  return '' +
  '<div class="note">One teacher record covers both streams. Batch pay and individual pay are worked out separately and added into a single monthly payable.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="teachers.q" value="' + esc(State.teachers.q) + '" placeholder="Teacher name or ID">', "grow") +
    '<div class="push"><button class="btn btn-primary" data-act="teacher-new">+ Add teacher</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("teachers", rows, {
      key: t => t.id, head: ["Teacher", monthShort(m) + " payable"],
      title: t => esc(t.name) + " " + idchip(t.id),
      sub: t => esc(t.batches.length + " batches · " + t.plans.length + " individual plans · " +
        Logic.indRateLabel(t.indRateType) + " / " + Logic.batchPayLabel(t.batchPayType)),
      amount: t => money(t.pv.payable) + '<small>' + (t.pv.balance > 0 ? money(t.pv.balance) + " unpaid" : "settled") + '</small>',
      badge: t => badge(t.pv.status, FEE_BADGE),
      detail: t => dl([
        ["Teacher ID", idchip(t.id)], ["Phone", '<span class="mono">' + esc(t.phone || "—") + '</span>'],
        ["WhatsApp", '<span class="mono">' + esc(t.whatsapp || "—") + '</span>'],
        ["Joined", fmtDate(t.joiningDate)], ["Paid into", esc(t.payAccount || "—")], ["Status", badge(t.status)],
        ["Individual pay", esc(Logic.indRateLabel(t.indRateType)) + (t.indRateType === "percent" ? " · " + t.indRate + "%" :
          t.indRateType === "none" ? "" : " · " + money(t.indRate))],
        ["Batch pay", esc(Logic.batchPayLabel(t.batchPayType)) + (t.batchPayType === "percent" ? " · " + t.batchRate + "%" :
          t.batchPayType === "none" ? "" : " · " + money(t.batchRate))]
      ]) +
      '<div class="sub-hd">' + esc(monthLabel(m)) + ' payslip</div>' +
      '<div class="minirow"><span>Individual — ' + esc(t.pv.indBasis) + '</span><b>' + money(t.pv.indAmount) + '</b></div>' +
      payLinesHtml(t.pv) +
      (t.pv.groups || []).map(g => '<div class="minirow"><span>' + esc(g.label) +
        (g.subClassId ? ' <span class="tag">sub</span>' : "") + ' — ' + esc(g.basis) + '</span><b>' + money(g.amount) + '</b></div>').join("") +
      '<div class="minirow"><span>Batch total — ' + esc(t.pv.batchBasis) + '</span><b>' + money(t.pv.batchAmount) + '</b></div>' +
      '<div class="minirow"><span>Bonus</span><b>' + money(t.pv.bonus) + '</b></div>' +
      '<div class="minirow"><span>Deduction</span><b>− ' + money(t.pv.deduction) + '</b></div>' +
      '<div class="minirow"><span>Net payable</span><b>' + money(t.pv.payable) + '</b></div>' +
      '<div class="minirow"><span>Paid</span><b class="in">' + money(t.pv.paid) + '</b></div>' +
      '<div class="minirow"><span>Balance</span><b class="' + (t.pv.balance > 0 ? "out" : "in") + '">' + money(t.pv.balance) + '</b></div>' +
      acts('<button class="btn btn-sm" data-act="teacher-edit" data-id="' + t.id + '">Edit</button>' +
        (t.pv.balance > 0 ? '<button class="btn btn-sm btn-primary" data-act="tpay-new" data-id="' + t.id + '">Pay ' + money(t.pv.balance) + '</button>' : "") +
        '<button class="btn btn-sm" data-act="tadj-edit" data-id="' + t.id + '">Bonus / deduction</button>' +
        '<button class="btn btn-sm" data-act="tstatement" data-id="' + t.id + '">Statement</button>'),
      sorts: [{ key: "name", label: "Name", val: t => t.name },
              { key: "pay", label: "Highest payable first", val: t => t.pv.payable, desc: true },
              { key: "bal", label: "Most unpaid first", val: t => t.pv.balance, desc: true }],
      emptyTitle: "No teachers yet", emptyText: "Add a teacher and set how they are paid across the two streams.",
      emptyAction: '<button class="btn btn-primary" data-act="teacher-new">+ Add teacher</button>'
    }) +
  '</div></div>';
};

/* ---- Dedicated OTHER STAFF page: monthly salary + incentive ---- */
Pages.staff = function(){
  const q = State.staff.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getTeachers().filter(t => t.kind === "staff").map(function(t){
    return Object.assign({}, t, { pv: Logic.payrollView(t, m) });
  }).filter(t => search(t.id + " " + t.name + " " + (t.phone || "") + " " + (t.role || ""), q));

  const totPayable = rows.reduce((s, t) => s + t.pv.payable, 0);
  const totPaid = rows.reduce((s, t) => s + t.pv.paid, 0);
  const totBal = rows.reduce((s, t) => s + t.pv.balance, 0);

  return '' +
  '<div class="note">Other staff — admin, counsellors, editors, digital marketers and the like — are paid a fixed monthly salary plus optional incentive. They appear in payments, the ledger and reports just like teachers.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="staff.q" value="' + esc(State.staff.q) + '" placeholder="Name, role or ID">', "grow") +
    '<div class="push"><button class="btn btn-primary" data-act="staff-new">+ Add staff</button></div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Staff", num(rows.length)) + kpi(monthShort(m) + " payable", money(totPayable)) +
    kpi("Paid", money(totPaid), "", "a-ok") + kpi("Balance", money(totBal), "", totBal > 0 ? "a-warn" : "") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("staff", rows, {
      key: t => t.id, head: ["Staff", monthShort(m) + " payable"],
      title: t => esc(t.name) + " " + idchip(t.id),
      sub: t => esc((t.role || "Staff") + " · monthly " + money(+t.monthlySalary || 0)),
      amount: t => money(t.pv.payable) + '<small>' + (t.pv.balance > 0 ? money(t.pv.balance) + " unpaid" : "settled") + '</small>',
      badge: t => badge(t.pv.status, FEE_BADGE),
      detail: t => dl([
        ["Staff ID", idchip(t.id)], ["Role", '<b>' + esc(t.role || "—") + '</b>'],
        ["Phone", '<span class="mono">' + esc(t.phone || "—") + '</span>'],
        ["WhatsApp", '<span class="mono">' + esc(t.whatsapp || "—") + '</span>'],
        ["Joined", fmtDate(t.joiningDate)], ["Paid into", esc(t.payAccount || "—")], ["Status", badge(t.status)],
        ["Monthly salary", money(+t.monthlySalary || 0)]
      ]) +
      '<div class="sub-hd">' + esc(monthLabel(m)) + ' payslip</div>' +
      '<div class="minirow"><span>Monthly salary</span><b>' + money(t.pv.monthlySalary || 0) + '</b></div>' +
      '<div class="minirow"><span>Bonus</span><b>' + money(t.pv.bonus) + '</b></div>' +
      '<div class="minirow"><span>Incentive</span><b>' + money(t.pv.incentive) + '</b></div>' +
      '<div class="minirow"><span>Deduction</span><b>− ' + money(t.pv.deduction) + '</b></div>' +
      '<div class="minirow"><span>Net payable</span><b>' + money(t.pv.payable) + '</b></div>' +
      '<div class="minirow"><span>Paid</span><b class="in">' + money(t.pv.paid) + '</b></div>' +
      '<div class="minirow"><span>Balance</span><b class="' + (t.pv.balance > 0 ? "out" : "in") + '">' + money(t.pv.balance) + '</b></div>' +
      acts('<button class="btn btn-sm" data-act="teacher-edit" data-id="' + t.id + '">Edit</button>' +
        (t.pv.balance > 0 ? '<button class="btn btn-sm btn-primary" data-act="tpay-new" data-id="' + t.id + '">Pay ' + money(t.pv.balance) + '</button>' : "") +
        '<button class="btn btn-sm" data-act="tadj-edit" data-id="' + t.id + '">Bonus / incentive</button>' +
        '<button class="btn btn-sm" data-act="tstatement" data-id="' + t.id + '">Statement</button>'),
      sorts: [{ key: "name", label: "Name", val: t => t.name },
              { key: "role", label: "Role", val: t => t.role || "" },
              { key: "pay", label: "Highest payable first", val: t => t.pv.payable, desc: true }],
      emptyTitle: "No other staff yet", emptyText: "Add admin, counsellors, editors, digital marketers and others on a monthly salary.",
      emptyAction: '<button class="btn btn-primary" data-act="staff-new">+ Add staff</button>'
    }) +
  '</div></div>';
};

Pages.payments = function(){
  const p = State.pays, q = p.q.toLowerCase().trim();
  const rows = DataService.getPayments().map(function(x){
    const s = DataService.getStudent(x.studentId);
    return Object.assign({}, x, { studentName: s ? s.name : x.studentId });
  }).filter(function(x){
    if (p.month && x.month !== p.month) return false;
    if (p.account && x.account !== p.account) return false;
    if (p.source && x.source !== p.source) return false;
    return search(x.id + " " + x.studentId + " " + x.studentName + " " + (x.txnId || ""), q);
  });
  const total = rows.reduce((s, x) => s + (+x.amount || 0), 0);
  const bTot = rows.filter(x => x.source === "batch").reduce((s, x) => s + x.amount, 0);
  const iTot = total - bTot;
  const refunds = DataService.getRefunds();

  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="pays.q" value="' + esc(p.q) + '" placeholder="Student, payment ID or transaction ID">', "grow") +
    field("Month", sel("m", monthOpts(p.month, "All months"), 'data-fset="pays.month"')) +
    field("Stream", sel("s", optList([{ value: "batch", label: "Batch" }, { value: "individual", label: "Individual" }], p.source, "Both streams"), 'data-fset="pays.source"')) +
    field("Account", sel("a", accountOpts(p.account, "All accounts"), 'data-fset="pays.account"')) +
    '<div class="push btn-row"><button class="btn" data-act="pays-csv">CSV</button>' +
      '<button class="btn btn-primary" data-act="pay-new">+ Record payment</button></div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Payments", num(rows.length)) + kpi("Total received", money(total), "", "a-ok") +
    kpi("Batch stream", money(bTot)) + kpi("Individual stream", money(iTot)) +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("pays", rows, {
      key: x => x.id, head: ["Payment", "Amount"],
      title: x => esc(x.studentName) + " · " + esc(monthLabel(x.month)),
      sub: x => fmtDate(x.date) + " · " + esc(x.account) + " · " + esc(x.id) + (x.txnId ? " · " + esc(x.txnId) : ""),
      amount: x => money(x.amount),
      badge: x => streamChip(x.source),
      detail: function(x){
        const v = Logic.feeView(DataService.getFee(x.feeId) || { id: "", gross: 0, discount: 0, dueDate: today() });
        return dl([["Payment ID", idchip(x.id)], ["Date", fmtDate(x.date)],
          ["Student", esc(x.studentName) + " " + idchip(x.studentId)], ["Stream", streamChip(x.source)],
          ["Fee month", monthLabel(x.month)], ["Amount", '<b class="in">' + money(x.amount) + '</b>'],
          ["Received in", badge(x.account)], ["Transaction ID", esc(x.txnId || "—")],
          ["Fee record", idchip(x.feeId)], ["Balance after", money(v.balance)],
          x.remarks ? ["Remarks", esc(x.remarks)] : null]) +
          acts('<button class="btn btn-sm" data-act="receipt" data-id="' + x.id + '">Receipt</button>' +
            '<button class="btn btn-sm btn-wa" data-act="wa-received" data-id="' + x.id + '">WhatsApp</button>' +
            '<button class="btn btn-sm btn-danger" data-act="refund-new" data-id="' + x.id + '">Refund</button>' +
            '<button class="btn btn-sm" data-act="profile-open" data-id="' + x.studentId + '">Open student</button>');
      },
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true },
              { key: "name", label: "Student name", val: x => x.studentName }],
      emptyTitle: "No payments match", emptyText: "Record the first payment — the ledger and balances follow by themselves.",
      emptyAction: '<button class="btn btn-primary" data-act="pay-new">+ Record payment</button>'
    }) +
  '</div></div>' +
  (refunds.length ? '<div class="section-title">Refunds</div><div class="card"><div class="card-bd tight">' +
    renderList("refunds", refunds, {
      key: r => r.id,
      title: r => { const s = DataService.getStudent(r.studentId); return esc(s ? s.name : r.studentId) + " · " + esc(r.id); },
      sub: r => fmtDate(r.date) + " · " + esc(r.account) + (r.reason ? " · " + esc(r.reason) : ""),
      amount: r => '<span class="out">' + money(r.amount) + '</span>',
      detail: r => dl([["Refund", idchip(r.id)], ["Date", fmtDate(r.date)], ["Student", idchip(r.studentId)],
        ["Against payment", idchip(r.paymentId || "—")], ["Amount", money(r.amount)], ["From account", badge(r.account)],
        ["Reason", esc(r.reason || "—")]]),
      emptyTitle: "No refunds", emptyText: ""
    }) + '</div></div>' : "");
};

Pages.income = function(){
  const f = State.income, q = f.q.toLowerCase().trim();
  const rows = DataService.getIncome().filter(function(x){
    if (f.month && monthOf(x.date) !== f.month) return false;
    if (f.category && x.category !== f.category) return false;
    return search(x.id + " " + x.description + " " + (x.source || "") + " " + x.category, q);
  });
  const total = rows.reduce((s, x) => s + (+x.amount || 0), 0);
  const feeIn = DataService.getPayments().filter(p => !f.month || monthOf(p.date) === f.month)
    .reduce((s, p) => s + (+p.amount || 0), 0);

  return '' +
  '<div class="note">Class fees are recorded on the Payments page and are already counted as income. This page is only for what the academy earns outside class fees.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="income.q" value="' + esc(f.q) + '" placeholder="Description, source or ID">', "grow") +
    field("Month", sel("m", monthOpts(f.month, "All months"), 'data-fset="income.month"')) +
    field("Category", sel("c", optList(Settings().incomeCategories, f.category, "All categories"), 'data-fset="income.category"')) +
    '<div class="push btn-row"><button class="btn" data-act="income-csv">CSV</button>' +
      '<button class="btn btn-primary" data-act="inc-new">+ Add income</button></div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Other income", money(total), num(rows.length) + " entries", "a-ok") +
    kpi("Class fees received", money(feeIn), "from both streams") +
    kpi("Total income", money(total + feeIn), "", "a-acc") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("income", rows, {
      key: x => x.id, head: ["Income", "Amount"],
      title: x => esc(x.description || x.category),
      sub: x => fmtDate(x.date) + " · " + esc(x.category) + " · " + esc(x.account) + " · " + esc(x.id),
      amount: x => '<span class="in">' + money(x.amount) + '</span>',
      detail: x => dl([["Income ID", idchip(x.id)], ["Date", fmtDate(x.date)], ["Category", esc(x.category)],
        ["Description", esc(x.description || "—")], ["Source", esc(x.source || "—")],
        ["Amount", '<b class="in">' + money(x.amount) + '</b>'], ["Received in", badge(x.account)],
        ["Reference", esc(x.reference || "—")], x.notes ? ["Notes", esc(x.notes)] : null]) +
        acts('<button class="btn btn-sm" data-act="inc-edit" data-id="' + x.id + '">Edit</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true }],
      emptyTitle: "No other income recorded", emptyText: "Admission fees, recorded courses, books and so on go here.",
      emptyAction: '<button class="btn btn-primary" data-act="inc-new">+ Add income</button>'
    }) +
  '</div></div>';
};

Pages.expenses = function(){
  const f = State.expenses, q = f.q.toLowerCase().trim();
  const rows = DataService.getExpenses().filter(function(x){
    if (f.month && monthOf(x.date) !== f.month) return false;
    if (f.category && x.category !== f.category) return false;
    return search(x.id + " " + x.description + " " + (x.payee || "") + " " + x.category, q);
  });
  const total = rows.reduce((s, x) => s + (+x.amount || 0), 0);
  const tp = DataService.getTeacherPayments().filter(p => !f.month || monthOf(p.date) === f.month)
    .reduce((s, p) => s + (+p.amount || 0), 0);
  const byCat = {};
  rows.forEach(x => byCat[x.category] = (byCat[x.category] || 0) + (+x.amount || 0));

  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="expenses.q" value="' + esc(f.q) + '" placeholder="Description, payee or ID">', "grow") +
    field("Month", sel("m", monthOpts(f.month, "All months"), 'data-fset="expenses.month"')) +
    field("Category", sel("c", optList(Settings().expenseCategories, f.category, "All categories"), 'data-fset="expenses.category"')) +
    '<div class="push btn-row"><button class="btn" data-act="expenses-csv">CSV</button>' +
      '<button class="btn btn-primary" data-act="exp-new">+ Add expense</button></div>' +
  '</div>' +
  '<div class="grid-2" style="margin-bottom:12px">' +
    '<div class="kpi-grid">' +
      kpi("Expenses listed", money(total), num(rows.length) + " entries", "a-bad") +
      kpi("Teacher payments", money(tp), "recorded separately") +
      kpi("Total spent", money(total + tp), "", "a-acc") +
    '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 8px">By category</h3>' +
      chartHBars(Object.keys(byCat).map(k => ({ label: k, value: byCat[k], color: "var(--bad)" }))
        .sort((a, b) => b.value - a.value).slice(0, 7)) + '</div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("expenses", rows, {
      key: x => x.id, head: ["Expense", "Amount"],
      title: x => esc(x.description || x.category),
      sub: x => fmtDate(x.date) + " · " + esc(x.category) + " · " + esc(x.account) + " · " + esc(x.id),
      amount: x => '<span class="out">' + money(x.amount) + '</span>',
      detail: x => dl([["Expense ID", idchip(x.id)], ["Date", fmtDate(x.date)], ["Category", esc(x.category)],
        ["Description", esc(x.description || "—")], ["Paid to", esc(x.payee || "—")],
        ["Amount", '<b class="out">' + money(x.amount) + '</b>'], ["Paid from", badge(x.account)],
        ["Reference", esc(x.reference || "—")], x.notes ? ["Notes", esc(x.notes)] : null]) +
        acts('<button class="btn btn-sm" data-act="exp-edit" data-id="' + x.id + '">Edit</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true }],
      emptyTitle: "No expenses recorded", emptyText: "Add the first expense — it comes off the account you choose.",
      emptyAction: '<button class="btn btn-primary" data-act="exp-new">+ Add expense</button>'
    }) +
  '</div></div>';
};

Pages.tpay = function(){
  const m = State.tpay.month || State.month;
  const rows = Logic.payrollMonth(m);
  const tot = rows.reduce(function(a, p){ a.payable += p.payable; a.paid += p.paid; a.bal += Math.max(0, p.balance);
    a.ind += p.indAmount; a.bat += p.batchAmount; return a; }, { payable: 0, paid: 0, bal: 0, ind: 0, bat: 0 });
  const history = DataService.getTeacherPayments({ month: m }).map(function(x){
    const t = DataService.getTeacher(x.teacherId);
    return Object.assign({}, x, { teacherName: t ? t.name : x.teacherId });
  });

  return '' +
  '<div class="note">Each teacher gets one payable for the month: what they earned from individual classes plus what they earned from batch classes, then bonus and deduction. Paying them is a single expense in the books.</div>' +
  '<div class="toolbar no-print">' +
    field("Month", sel("m", monthOpts(m, ""), 'data-fset="tpay.month"')) +
    '<div class="push btn-row"><button class="btn" data-act="tpay-csv">CSV</button>' +
      '<button class="btn" data-act="print">Print</button>' +
      '<button class="btn btn-primary" data-act="tpay-new">+ Pay teacher</button></div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Total payable", money(tot.payable)) +
    kpi("From individual", money(tot.ind)) + kpi("From batch", money(tot.bat)) +
    kpi("Paid", money(tot.paid), "", "a-ok") + kpi("Still to pay", money(tot.bal), "", "a-bad") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("tpayList", rows, {
      key: p => p.teacherId, head: ["Teacher", "Payable"],
      title: p => esc(p.teacherName) + " " + idchip(p.teacherId),
      sub: p => esc(p.indBasis + " + " + p.batchBasis),
      amount: p => money(p.payable) + '<small>' + (p.balance > 0 ? money(p.balance) + " unpaid" : "settled") + '</small>',
      badge: p => badge(p.status, FEE_BADGE),
      rowClass: p => p.balance > 0 ? "row-bad" : "row-ok",
      detail: p => '<div class="minirow"><span>Individual classes — ' + esc(p.indBasis) + '</span><b>' + money(p.indAmount) + '</b></div>' +
        payLinesHtml(p) +
        (p.groups && p.groups.length
          ? '<div class="sub-hd">Batch groups taught</div>' + p.groups.map(g =>
              '<div class="minirow"><span>' + esc(g.label) + (g.subClassId ? ' <span class="tag">sub-class</span>' : "") +
              ' — ' + esc(g.basis) + '</span><b>' + money(g.amount) + '</b></div>').join("") +
            '<div class="sub-hd">Summary</div>'
          : "") +
        '<div class="minirow"><span>Batch classes — ' + esc(p.batchBasis) + '</span><b>' + money(p.batchAmount) + '</b></div>' +
        '<div class="minirow"><span>Gross</span><b>' + money(p.gross) + '</b></div>' +
        '<div class="minirow"><span>Bonus</span><b>' + money(p.bonus) + '</b></div>' +
        '<div class="minirow"><span>Deduction</span><b>− ' + money(p.deduction) + '</b></div>' +
        '<div class="minirow"><span>Net payable</span><b>' + money(p.payable) + '</b></div>' +
        '<div class="minirow"><span>Paid so far</span><b class="in">' + money(p.paid) + '</b></div>' +
        '<div class="minirow"><span>Balance</span><b class="' + (p.balance > 0 ? "out" : "in") + '">' + money(p.balance) + '</b></div>' +
        dl([["Individual classes completed", p.classStats.completed], ["Taught hours", round2(p.classStats.minutes / 60)],
            ["Batch sessions held", p.sessions], ["Batch students", p.batchStudents],
            p.remarks ? ["Remarks", esc(p.remarks)] : null]) +
        acts((p.balance > 0 ? '<button class="btn btn-sm btn-primary" data-act="tpay-new" data-id="' + p.teacherId + '">Pay ' + money(p.balance) + '</button>' : "") +
          '<button class="btn btn-sm" data-act="tadj-edit" data-id="' + p.teacherId + '">Bonus / deduction</button>' +
          '<button class="btn btn-sm" data-act="tstatement" data-id="' + p.teacherId + '">Statement</button>'),
      sorts: [{ key: "bal", label: "Most unpaid first", val: p => p.balance, desc: true },
              { key: "pay", label: "Highest payable first", val: p => p.payable, desc: true },
              { key: "name", label: "Teacher name", val: p => p.teacherName }],
      emptyTitle: "No teachers yet", emptyText: "Add a teacher first."
    }) +
  '</div></div>' +
  '<div class="section-title">Payments made in ' + esc(monthLabel(m)) + '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("tpayHist", history, {
      key: x => x.id,
      title: x => esc(x.teacherName) + " · " + money(x.amount),
      sub: x => fmtDate(x.date) + " · " + esc(x.category || "Teacher Payment") + " · " + esc(x.account) + " · " + esc(x.id),
      amount: x => '<span class="out">' + money(x.amount) + '</span>',
      badge: x => badge(x.category || "Teacher Payment"),
      detail: x => dl([["Payment", idchip(x.id)], ["Teacher", esc(x.teacherName) + " " + idchip(x.teacherId)],
        ["For month", monthLabel(x.month)], ["Date", fmtDate(x.date)], ["Amount", money(x.amount)],
        ["Paid from", badge(x.account)], ["Type", esc(x.category || "Teacher Payment")],
        x.remarks ? ["Remarks", esc(x.remarks)] : null]),
      emptyTitle: "Nothing paid yet for " + monthLabel(m), emptyText: "Use Pay teacher above."
    }) +
  '</div></div>';
};

Pages.accounts = function(){
  const bal = Logic.accountBalances(), led = Logic.ledger();
  const rows = DataService.getAccounts().map(function(a){
    const mine = led.filter(r => r.account === a.id);
    return { id: a.id, name: a.name, opening: +a.opening || 0, count: mine.length,
      inAmt: mine.reduce((s, r) => s + r.inAmt, 0), outAmt: mine.reduce((s, r) => s + r.outAmt, 0),
      balance: bal[a.id] || 0 };
  });
  return '' +
  '<div class="qbar no-print">' +
    '<button class="qbtn" data-act="transfer-new"><span class="qi">⇄</span> Move money between accounts</button>' +
    '<button class="qbtn" data-act="opening-edit"><span class="qi">⚙</span> Set opening balances</button>' +
  '</div>' +
  '<div class="card"><div class="card-bd">' + accountRail(bal) + '<div style="height:12px"></div>' + accountCards(bal) + '</div></div>' +
  '<div class="section-title">How each balance was reached</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("accts", rows, {
      key: a => a.id, head: ["Account", "Balance"],
      title: a => esc(a.name),
      sub: a => num(a.count) + " transactions · opening " + money(a.opening),
      amount: a => money(a.balance),
      detail: a => dl([["Opening balance", money(a.opening)], ["Money in", '<span class="in">' + money(a.inAmt) + '</span>'],
        ["Money out", '<span class="out">' + money(a.outAmt) + '</span>'], ["Balance now", '<b>' + money(a.balance) + '</b>'],
        ["Transactions", num(a.count)]]) +
        acts('<button class="btn btn-sm" data-act="ledger-account" data-id="' + a.id + '">See in ledger</button>'),
      emptyTitle: "No accounts", emptyText: ""
    }) +
  '</div></div>' +
  '<div class="section-title">Transfers</div>' +
  '<div class="note">A transfer only moves money between your own accounts. It is never income and never an expense, so it cannot change your profit.</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("transfers", DataService.getTransfers(), {
      key: t => t.id,
      title: t => esc(t.from) + " → " + esc(t.to),
      sub: t => fmtDate(t.date) + " · " + esc(t.id) + (t.notes ? " · " + esc(t.notes) : ""),
      amount: t => money(t.amount),
      detail: t => dl([["Transfer", idchip(t.id)], ["Date", fmtDate(t.date)], ["From", badge(t.from)],
        ["To", badge(t.to)], ["Amount", money(t.amount)], ["Note", esc(t.notes || "—")],
        ["Effect on profit", "None — this is not income or expense"]]),
      sorts: [{ key: "date", label: "Newest first", val: t => t.date + t.id, desc: true }],
      emptyTitle: "No transfers yet", emptyText: "Move cash to the bank and the balances follow.",
      emptyAction: '<button class="btn btn-primary" data-act="transfer-new">Move money</button>'
    }) +
  '</div></div>';
};

Pages.ledger = function(){
  const f = State.ledger, q = f.q.toLowerCase().trim();
  const accounts = DataService.getAccounts();
  const opening = f.account ? (+(accounts.find(a => a.id === f.account) || {}).opening || 0)
                            : accounts.reduce((s, a) => s + (+a.opening || 0), 0);
  let run = opening;
  const rows = Logic.ledger().filter(r => !f.account || r.account === f.account).map(function(r){
    run += (r.inAmt - r.outAmt);
    return Object.assign({}, r, { balance: round2(run) });
  }).filter(function(r){
    if (f.type && r.type !== f.type) return false;
    if (f.source && r.source !== f.source) return false;
    if (f.from && r.date < f.from) return false;
    if (f.to && r.date > f.to) return false;
    return search(r.id + " " + r.desc + " " + r.category + " " + (r.ref || "") + " " + r.party, q);
  }).reverse();
  const tIn = rows.reduce((s, r) => s + r.inAmt, 0), tOut = rows.reduce((s, r) => s + r.outAmt, 0);

  return '' +
  '<div class="note">Nothing here is typed in. Every line comes from a payment, income entry, expense, teacher payment, refund or transfer you recorded — in either stream.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="ledger.q" value="' + esc(f.q) + '" placeholder="Description, ID or reference">', "grow") +
    field("Type", sel("t", optList(["Student Payment","Other Income","Expense","Teacher Payment","Refund","Transfer"], f.type, "All types"), 'data-fset="ledger.type"')) +
    field("Stream", sel("s", optList([{ value: "batch", label: "Batch" }, { value: "individual", label: "Individual" },
      { value: "other", label: "Not class fees" }], f.source, "All"), 'data-fset="ledger.source"')) +
    field("Account", sel("a", accountOpts(f.account, "All accounts"), 'data-fset="ledger.account"')) +
    field("From", '<input class="input" type="date" data-fset="ledger.from" value="' + esc(f.from) + '">') +
    field("To", '<input class="input" type="date" data-fset="ledger.to" value="' + esc(f.to) + '">') +
    '<div class="push btn-row"><button class="btn" data-act="ledger-csv">CSV</button>' +
      '<button class="btn" data-act="print">Print</button></div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Money in", money(tIn), "", "a-ok") + kpi("Money out", money(tOut), "", "a-bad") +
    kpi("Closing balance", money(rows.length ? rows[0].balance : opening), f.account || "All accounts", "a-acc") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("ledger", rows, {
      key: r => r.id, head: ["Transaction", "In / out"], pageSize: 30,
      title: r => esc(r.desc),
      sub: r => fmtDate(r.date) + " · " + esc(r.type) + " · " + esc(r.account) + " · " + esc(r.id),
      amount: r => (r.inAmt ? '<span class="in">+' + money(r.inAmt) + '</span>' : '<span class="out">−' + money(r.outAmt) + '</span>') +
        '<small>bal ' + money(r.balance) + '</small>',
      badge: r => r.source === "batch" || r.source === "individual" ? streamChip(r.source) : badge(r.type),
      detail: r => dl([["Transaction", idchip(r.id)], ["Date", fmtDate(r.date)], ["Type", badge(r.type)],
        ["Category", esc(r.category)], ["Description", esc(r.desc)],
        ["Income", r.inAmt ? '<span class="in">' + money(r.inAmt) + '</span>' : "—"],
        ["Expense", r.outAmt ? '<span class="out">' + money(r.outAmt) + '</span>' : "—"],
        ["Account", badge(r.account)], ["Running balance", money(r.balance)],
        r.ref ? ["Reference", esc(r.ref)] : null,
        r.transfer ? ["Note", "Transfers do not affect profit"] : null]),
      emptyTitle: "No transactions match", emptyText: "Clear the filters, or record a payment or expense."
    }) +
  '</div></div>';
};

/* ------------------------------- REPORTS -------------------------------- */
const REPORTS = [
  { id: "pnl", n: "01", label: "Profit & loss" },
  { id: "dailyIncome", n: "02", label: "Daily income" },
  { id: "dailyExpense", n: "03", label: "Daily expense" },
  { id: "monthlyIncome", n: "04", label: "Monthly income" },
  { id: "monthlyExpense", n: "05", label: "Monthly expense" },
  { id: "feeReport", n: "06", label: "Student fees" },
  { id: "pending", n: "07", label: "Pending fees (receivable)" },
  { id: "payable", n: "08", label: "Teacher payments (payable)" },
  { id: "accounts", n: "09", label: "Account balances" },
  { id: "ledgerRep", n: "10", label: "Transaction ledger" },
  { id: "statement", n: "11", label: "Student statement" }
];
function rangeFor(){
  const r = State.reports, t = today();
  if (r.preset === "today") return { from: t, to: t, label: "Today" };
  if (r.preset === "week") { const d = new Date(); d.setDate(d.getDate() - 6); return { from: ymd(d), to: t, label: "Last 7 days" }; }
  if (r.preset === "month") return { from: monthStart(State.month), to: monthEnd(State.month), label: monthLabel(State.month) };
  if (r.preset === "prev") { const p = addMonths(State.month, -1); return { from: monthStart(p), to: monthEnd(p), label: monthLabel(p) }; }
  return { from: r.from || monthStart(State.month), to: r.to || t, label: "Custom range" };
}
function buildReport(){
  const R = State.reports, rg = rangeFor();
  const srcOK = r => !R.source || r.source === R.source;
  const led = Logic.ledger().filter(r => r.date >= rg.from && r.date <= rg.to);

  if (R.which === "pnl") {
    const p = Logic.pnl(rg.from, rg.to);
    const rows = [];
    Object.keys(p.incomeByCategory).forEach(k => rows.push({ id: "in-" + k, group: "Income", name: k, amount: p.incomeByCategory[k] }));
    if (p.refunds) rows.push({ id: "refund", group: "Income", name: "Less: refunds", amount: -p.refunds });
    Object.keys(p.byCategory).forEach(k => rows.push({ id: "ex-" + k, group: "Expense", name: k, amount: -p.byCategory[k] }));
    return { title: "Profit & loss", sub: rg.label,
      cards: [["Income", money(p.netIncome), "a-ok"], ["Expense", money(p.expense), "a-bad"],
              ["Net profit", money(p.profit), "a-acc"], ["Margin", pct(p.profit, p.netIncome) + "%", ""],
              ["Batch fees", money(p.batchFee), ""], ["Individual fees", money(p.indFee), ""]],
      chart: chartHBars([{ label: "Income", value: p.netIncome, text: money(p.netIncome), color: "var(--ok)" },
                         { label: "Expense", value: p.expense, text: money(p.expense), color: "var(--bad)" },
                         { label: "Profit", value: Math.max(0, p.profit), text: money(p.profit), color: "var(--acc)" }]),
      rows: rows,
      list: { key: x => x.id, title: x => esc(x.name), sub: x => x.group,
        amount: x => x.amount >= 0 ? '<span class="in">' + money(x.amount) + '</span>' : '<span class="out">' + money(x.amount) + '</span>',
        badge: x => badge(x.group === "Income" ? "Other Income" : "Expense"),
        detail: x => dl([["Group", x.group], ["Category", esc(x.name)], ["Amount", money(x.amount)], ["Period", rg.label]]) },
      csv: { headers: ["Group", "Category", "Amount"], rows: rows.map(x => [x.group, x.name, x.amount]) } };
  }

  if (R.which === "dailyIncome" || R.which === "monthlyIncome") {
    const daily = R.which === "dailyIncome", map = {};
    led.filter(x => x.inAmt > 0 && !x.transfer && srcOK(x)).forEach(function(x){
      const k = daily ? x.date : monthOf(x.date);
      map[k] = map[k] || { id: k, key: k, batch: 0, ind: 0, other: 0, total: 0, n: 0, items: [] };
      if (x.source === "batch") map[k].batch += x.inAmt;
      else if (x.source === "individual") map[k].ind += x.inAmt;
      else map[k].other += x.inAmt;
      map[k].total += x.inAmt; map[k].n++; map[k].items.push(x);
    });
    const rows = Object.keys(map).sort().reverse().map(k => map[k]);
    return { title: (daily ? "Daily" : "Monthly") + " income", sub: rg.label,
      cards: [["Total", money(rows.reduce((s, x) => s + x.total, 0)), "a-ok"],
              ["Batch fees", money(rows.reduce((s, x) => s + x.batch, 0)), ""],
              ["Individual fees", money(rows.reduce((s, x) => s + x.ind, 0)), ""],
              ["Other income", money(rows.reduce((s, x) => s + x.other, 0)), ""]],
      rows: rows,
      list: { key: x => x.id, title: x => daily ? fmtDate(x.key) : monthLabel(x.key),
        sub: x => x.n + " entries", amount: x => '<span class="in">' + money(x.total) + '</span>',
        detail: x => dl([["Batch fees", money(x.batch)], ["Individual fees", money(x.ind)],
          ["Other income", money(x.other)], ["Total", '<b>' + money(x.total) + '</b>']]) +
          '<div class="sub-hd">Entries</div>' + x.items.map(i => '<div class="minirow"><span>' + esc(i.desc) +
            ' · ' + esc(i.account) + '</span><b class="in">' + money(i.inAmt) + '</b></div>').join("") },
      csv: { headers: [daily ? "Date" : "Month", "Entries", "Batch Fees", "Individual Fees", "Other", "Total"],
             rows: rows.map(x => [x.key, x.n, x.batch, x.ind, x.other, x.total]) } };
  }

  if (R.which === "dailyExpense" || R.which === "monthlyExpense") {
    const daily = R.which === "dailyExpense", map = {};
    led.filter(x => x.outAmt > 0 && !x.transfer).forEach(function(x){
      const k = daily ? x.date : monthOf(x.date);
      map[k] = map[k] || { id: k, key: k, teacher: 0, other: 0, total: 0, n: 0, items: [] };
      if (x.type === "Teacher Payment") map[k].teacher += x.outAmt; else map[k].other += x.outAmt;
      map[k].total += x.outAmt; map[k].n++; map[k].items.push(x);
    });
    const rows = Object.keys(map).sort().reverse().map(k => map[k]);
    return { title: (daily ? "Daily" : "Monthly") + " expense", sub: rg.label,
      cards: [["Total spent", money(rows.reduce((s, x) => s + x.total, 0)), "a-bad"],
              ["Teacher payments", money(rows.reduce((s, x) => s + x.teacher, 0)), ""],
              ["Other expenses", money(rows.reduce((s, x) => s + x.other, 0)), ""]],
      rows: rows,
      list: { key: x => x.id, title: x => daily ? fmtDate(x.key) : monthLabel(x.key),
        sub: x => x.n + " entries", amount: x => '<span class="out">' + money(x.total) + '</span>',
        detail: x => dl([["Teacher payments", money(x.teacher)], ["Other expenses", money(x.other)],
          ["Total", '<b>' + money(x.total) + '</b>']]) + '<div class="sub-hd">Entries</div>' +
          x.items.map(i => '<div class="minirow"><span>' + esc(i.desc) + ' · ' + esc(i.category) +
            '</span><b class="out">' + money(i.outAmt) + '</b></div>').join("") },
      csv: { headers: [daily ? "Date" : "Month", "Entries", "Teacher Payments", "Other", "Total"],
             rows: rows.map(x => [x.key, x.n, x.teacher, x.other, x.total]) } };
  }

  if (R.which === "feeReport" || R.which === "pending") {
    const pendingOnly = R.which === "pending";
    let views = Logic.feeViews().filter(v => v.dueDate >= rg.from && v.dueDate <= rg.to);
    if (!views.length) views = Logic.feeViews({ month: State.month });
    views = views.filter(v => !R.source || v.source === R.source).map(withBasis);
    if (pendingOnly) views = views.filter(v => v.balance > 0);
    const s = Logic.summarize(views);
    return { title: pendingOnly ? "Pending fees (receivable)" : "Student fees", sub: rg.label,
      cards: pendingOnly
        ? [["Total receivable", money(s.balance), "a-warn"], ["Overdue", num(views.filter(v => v.daysOverdue > 0).length), "a-bad"],
           ["Due today", num(s.dueTodayN), ""], ["Part paid", num(s.partialN), ""]]
        : [["Net fee", money(s.net), ""], ["Collected", money(s.paid), "a-ok"], ["Balance", money(s.balance), "a-warn"],
           ["Collection", s.collectionPct + "%", ""]],
      rows: views,
      listFn: lid => feeRowList(lid, views, { emptyTitle: "Nothing in this period", emptyText: "Widen the range." }),
      csv: { headers: ["Fee ID","Stream","Student ID","Student","Month","Teacher","Basis","Gross","Discount","Net","Paid","Balance","Due Date","Days Overdue","Status"],
             rows: views.map(v => [v.id, v.source, v.studentId, v.studentName, v.month, v.teacherName, v.shortBasis,
               v.gross, v.discount, v.netFee, v.paidAmount, v.balance, v.dueDate, v.daysOverdue, v.status]) } };
  }

  if (R.which === "payable") {
    const rows = [];
    allMonths().filter(m => m >= monthOf(rg.from) && m <= monthOf(rg.to))
      .forEach(m => Logic.payrollMonth(m).forEach(p => { if (p.payable > 0 || p.paid > 0) rows.push(Object.assign({ id: p.teacherId + p.month }, p)); }));
    return { title: "Teacher payments (payable)", sub: rg.label,
      cards: [["Payable", money(rows.reduce((s, p) => s + p.payable, 0)), ""],
              ["Paid", money(rows.reduce((s, p) => s + p.paid, 0)), "a-ok"],
              ["Pending", money(rows.reduce((s, p) => s + Math.max(0, p.balance), 0)), "a-bad"]],
      rows: rows,
      list: { key: p => p.id, title: p => esc(p.teacherName) + " · " + monthLabel(p.month),
        sub: p => esc(p.indBasis + " + " + p.batchBasis),
        amount: p => money(p.payable) + '<small>' + (p.balance > 0 ? money(p.balance) + " due" : "settled") + '</small>',
        badge: p => badge(p.status, FEE_BADGE),
        detail: p => dl([["Individual", money(p.indAmount)], ["Batch", money(p.batchAmount)], ["Gross", money(p.gross)],
          ["Bonus", money(p.bonus)], ["Deduction", money(p.deduction)], ["Payable", money(p.payable)],
          ["Paid", money(p.paid)], ["Balance", money(p.balance)], ["Status", badge(p.status, FEE_BADGE)]]) },
      csv: { headers: ["Teacher ID","Teacher","Month","Individual","Batch","Gross","Bonus","Deduction","Payable","Paid","Balance","Status"],
             rows: rows.map(p => [p.teacherId, p.teacherName, p.month, p.indAmount, p.batchAmount, p.gross, p.bonus,
               p.deduction, p.payable, p.paid, p.balance, p.status]) } };
  }

  if (R.which === "accounts") {
    const bal = Logic.accountBalances(rg.to);
    const rows = DataService.getAccounts().map(function(a){
      const mine = led.filter(x => x.account === a.id);
      return { id: a.id, name: a.name, opening: +a.opening || 0, balance: bal[a.id] || 0,
        inAmt: mine.reduce((s, x) => s + x.inAmt, 0), outAmt: mine.reduce((s, x) => s + x.outAmt, 0) };
    });
    return { title: "Account balances", sub: rg.label + " · as on " + fmtDate(rg.to),
      cards: DataService.getAccounts().map(a => [a.name, money(bal[a.id] || 0), ""]).concat([["Total", money(bal.total), "a-acc"]]),
      rows: rows,
      list: { key: a => a.id, title: a => esc(a.name), sub: a => "opening " + money(a.opening),
        amount: a => money(a.balance),
        detail: a => dl([["Opening", money(a.opening)], ["In", '<span class="in">' + money(a.inAmt) + '</span>'],
          ["Out", '<span class="out">' + money(a.outAmt) + '</span>'], ["Balance", '<b>' + money(a.balance) + '</b>']]) },
      csv: { headers: ["Account","Opening","In","Out","Balance"], rows: rows.map(a => [a.name, a.opening, a.inAmt, a.outAmt, a.balance]) } };
  }

  if (R.which === "statement") {
    const sid = R.studentId || (DataService.getStudents()[0] || {}).id;
    const st = DataService.getStudent(sid);
    if (!st) return { title: "Student statement", sub: "", cards: [], rows: [], list: { key: x => x.id, title: () => "", detail: () => "" }, csv: { headers: [], rows: [] } };
    const fees = Logic.feeViews({ studentId: sid }).map(withBasis).sort((a, b) => a.month < b.month ? 1 : -1);
    const rows = [];
    fees.forEach(function(v){
      rows.push({ id: "f" + v.id, date: v.dueDate, kind: "Fee", source: v.source,
        desc: monthLabel(v.month) + " · " + v.shortBasis, charge: v.netFee, credit: 0 });
      v.payments.forEach(p => rows.push({ id: "p" + p.id, date: p.date, kind: "Payment", source: p.source,
        desc: p.account + (p.txnId ? " · " + p.txnId : ""), charge: 0, credit: +p.amount }));
      DB.refunds.filter(x => x.feeId === v.id).forEach(x => rows.push({ id: "r" + x.id, date: x.date, kind: "Refund",
        source: v.source, desc: x.reason || "Refund", charge: +x.amount, credit: 0 }));
    });
    rows.sort((a, b) => a.date < b.date ? -1 : 1);
    let run = 0; rows.forEach(x => { run += x.charge - x.credit; x.running = round2(run); });
    return { title: "Statement — " + st.name, sub: st.id + (st.guardian ? " · " + st.guardian : ""),
      cards: [["Charged", money(rows.reduce((s, x) => s + x.charge, 0)), ""],
              ["Paid", money(rows.reduce((s, x) => s + x.credit, 0)), "a-ok"],
              ["Outstanding", money(fees.reduce((s, v) => s + v.balance, 0)), "a-warn"]],
      picker: '<div class="field" style="max-width:300px"><label>Student</label>' +
        sel("s", studentOpts(sid, ""), 'data-fset="reports.studentId"') + '</div>',
      rows: rows,
      list: { key: x => x.id, title: x => esc(x.desc), sub: x => fmtDate(x.date) + " · " + x.kind,
        amount: x => (x.credit ? '<span class="in">' + money(x.credit) + '</span>' : '<span class="out">' + money(x.charge) + '</span>') +
          '<small>bal ' + money(x.running) + '</small>',
        badge: x => x.source === "batch" || x.source === "individual" ? streamChip(x.source) : badge(x.kind),
        detail: x => dl([["Date", fmtDate(x.date)], ["Entry", x.kind], ["Details", esc(x.desc)],
          ["Charged", x.charge ? money(x.charge) : "—"], ["Paid", x.credit ? money(x.credit) : "—"],
          ["Running balance", money(x.running)]]) },
      csv: { headers: ["Date","Entry","Stream","Details","Charged","Paid","Running Balance"],
             rows: rows.map(x => [x.date, x.kind, x.source, x.desc, x.charge, x.credit, x.running]) } };
  }

  const rows = led.filter(srcOK).slice().reverse();
  return { title: "Transaction ledger", sub: rg.label,
    cards: [["Money in", money(rows.reduce((s, x) => s + x.inAmt, 0)), "a-ok"],
            ["Money out", money(rows.reduce((s, x) => s + x.outAmt, 0)), "a-bad"]],
    rows: rows,
    list: { key: x => x.id, title: x => esc(x.desc), sub: x => fmtDate(x.date) + " · " + esc(x.type) + " · " + esc(x.account),
      amount: x => x.inAmt ? '<span class="in">+' + money(x.inAmt) + '</span>' : '<span class="out">−' + money(x.outAmt) + '</span>',
      badge: x => badge(x.type),
      detail: x => dl([["ID", idchip(x.id)], ["Date", fmtDate(x.date)], ["Type", esc(x.type)], ["Category", esc(x.category)],
        ["Account", badge(x.account)], ["In", x.inAmt ? money(x.inAmt) : "—"], ["Out", x.outAmt ? money(x.outAmt) : "—"]]) },
    csv: { headers: ["Date","ID","Type","Stream","Category","Description","In","Out","Account"],
           rows: rows.map(x => [x.date, x.id, x.type, x.source, x.category, x.desc, x.inAmt, x.outAmt, x.account]) } };
}
Pages.reports = function(){
  const R = State.reports, rep = buildReport(), rg = rangeFor();
  const presets = [["today","Today"],["week","This week"],["month","This month"],["prev","Previous month"],["custom","Custom"]];
  const lid = "rep_" + R.which;
  return '' +
  '<div class="toolbar no-print">' +
    field("Report", sel("r", optList(REPORTS.map(x => ({ value: x.id, label: x.n + " · " + x.label })), R.which), 'data-fset="reports.which"'), "grow") +
    field("Stream", sel("s", optList([{ value: "batch", label: "Batch only" }, { value: "individual", label: "Individual only" }], R.source, "Both streams"), 'data-fset="reports.source"')) +
    (rep.picker || "") +
    '<div class="push btn-row"><button class="btn" data-act="rep-csv">Export CSV</button>' +
      '<button class="btn" data-act="print">Print</button></div>' +
  '</div>' +
  '<div class="chips no-print" style="margin-bottom:12px">' + presets.map(p =>
    '<button class="chip ' + (R.preset === p[0] ? "is-on" : "") + '" data-act="rep-preset" data-p="' + p[0] + '">' + p[1] + '</button>').join("") +
    '</div>' +
  (R.preset === "custom" ? '<div class="toolbar no-print">' +
    field("From", '<input class="input" type="date" data-fset="reports.from" value="' + esc(R.from || rg.from) + '">') +
    field("To", '<input class="input" type="date" data-fset="reports.to" value="' + esc(R.to || rg.to) + '">') + '</div>' : "") +
  '<h2 style="font-size:18px">' + esc(rep.title) + '</h2>' +
  '<p class="tagline">' + esc(Settings().academyName) + ' · ' + esc(rep.sub) +
    (R.source ? ' · ' + esc(R.source === "batch" ? "batch stream only" : "individual stream only") : ' · both streams') +
    ' · generated ' + esc(fmtDate(today())) + '</p>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' + rep.cards.map(c => kpi(c[0], c[1], "", c[2])).join("") + '</div>' +
  (rep.chart ? '<div class="card" style="margin-bottom:12px"><div class="card-bd">' + rep.chart + '</div></div>' : "") +
  '<div class="card"><div class="card-bd tight">' +
    (rep.listFn ? rep.listFn(lid) : renderList(lid, rep.rows, Object.assign({
      emptyTitle: "Nothing in this period", emptyText: "Widen the date range or record some transactions." }, rep.list))) +
  '</div></div>';
};

/* ---------------------------- STUDENT PROFILE --------------------------- */
Pages.profile = function(){
  const p = State.profile, s = DataService.getStudent(p.studentId);
  if (!s) return '<div class="empty"><h4>Pick a student</h4><p>Open a profile from the Students page.</p>' +
    '<button class="btn btn-primary" data-act="goto" data-page="students">Go to students</button></div>';
  const str = Logic.streamsOf(s.id);
  const batch = str.batch ? DataService.getBatch(str.batch.batchId) : null;
  const fees = Logic.feeViews({ studentId: s.id }).map(withBasis).sort((a, b) => a.month < b.month ? 1 : -1);
  const cur = fees.filter(f => f.month === State.month);
  const paidAll = fees.reduce((a, f) => a + f.paidAmount, 0);
  const dueAll = fees.reduce((a, f) => a + f.balance, 0);
  const classes = DataService.getClasses({ studentId: s.id });
  const cs = Logic.classStats(classes);
  const att = Logic.attStats(DataService.getAttendance({ studentId: s.id }));

  let body = "";
  if (p.tab === "fees") {
    body = feeRowList("pfFees", fees, { emptyTitle: "No fee records", emptyText: "Calculate a month to create them." });
  } else if (p.tab === "payments") {
    body = renderList("pfPays", DataService.getPayments({ studentId: s.id }), {
      key: x => x.id, title: x => monthLabel(x.month) + " · " + money(x.amount),
      sub: x => fmtDate(x.date) + " · " + esc(x.account) + " · " + esc(x.id),
      amount: x => '<span class="in">' + money(x.amount) + '</span>', badge: x => streamChip(x.source),
      detail: x => dl([["Payment", idchip(x.id)], ["Date", fmtDate(x.date)], ["Stream", streamChip(x.source)],
        ["Fee month", monthLabel(x.month)], ["Amount", money(x.amount)], ["Account", badge(x.account)],
        ["Transaction", esc(x.txnId || "—")]]) +
        acts('<button class="btn btn-sm" data-act="receipt" data-id="' + x.id + '">Receipt</button>' +
          '<button class="btn btn-sm btn-danger" data-act="refund-new" data-id="' + x.id + '">Refund</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true }],
      emptyTitle: "No payments yet", emptyText: "" });
  } else if (p.tab === "classes") {
    body = renderList("pfCls", classes, {
      key: c => c.id, title: c => fmtDate(c.date) + " · " + esc(c.status),
      sub: c => { const t = DataService.getTeacher(c.teacherId); return esc(t ? t.name : c.teacherId) + " · " + esc(c.id); },
      amount: c => c.duration ? c.duration + " min" : "—", badge: c => badge(c.status),
      detail: c => dl([["Class", idchip(c.id)], ["Date", fmtDate(c.date)], ["Status", badge(c.status)],
        ["Duration", c.duration ? c.duration + " min" : "—"], c.notes ? ["Notes", esc(c.notes)] : null]),
      sorts: [{ key: "date", label: "Newest first", val: c => c.date + c.id, desc: true }],
      emptyTitle: "No individual classes", emptyText: "This student has no class plan yet." });
  } else if (p.tab === "calendar") {
    body = '<div class="card-bd">' + studentCalendarBlock(s.id, State.cal.month, true) + '</div>';
  } else if (p.tab === "attendance") {
    body = renderList("pfAtt", DataService.getAttendance({ studentId: s.id }), {
      key: a => a.id, title: a => fmtDate(a.date) + " · " + esc(a.status),
      sub: a => { const b = DataService.getBatch(a.batchId); return esc(b ? b.name : a.batchId); },
      badge: a => badge(a.status),
      detail: a => dl([["Date", fmtDate(a.date)], ["Batch", esc(a.batchId)], ["Status", badge(a.status)],
        a.remarks ? ["Remarks", esc(a.remarks)] : null]),
      sorts: [{ key: "date", label: "Newest first", val: a => a.date, desc: true }],
      emptyTitle: "No attendance yet", emptyText: "This student is not in a batch." });
  } else {
    const enr = DataService.getEnrollments({ studentId: s.id });
    const pls = DataService.getPlans({ studentId: s.id });
    body = renderList("pfHist", enr.map(e => Object.assign({ kind: "Batch" }, e))
      .concat(pls.map(x => Object.assign({ kind: "Individual" }, x))), {
      key: x => x.id,
      title: x => x.kind === "Batch" ? ((DataService.getBatch(x.batchId) || {}).name || x.batchId) : esc(x.course),
      sub: x => (x.kind === "Batch" ? "Batch enrolment" : "Individual plan") + " · from " + fmtDate(x.joiningDate || x.startDate) +
        (x.leavingDate ? " to " + fmtDate(x.leavingDate) : ""),
      amount: x => money(x.monthlyFee || x.rate), badge: x => badge(x.status),
      detail: x => x.kind === "Batch"
        ? dl([["Enrolment", idchip(x.id)], ["Batch", esc(x.batchId)], ["Joined", fmtDate(x.joiningDate)],
            ["Left", x.leavingDate ? fmtDate(x.leavingDate) : "—"], ["Monthly fee", money(x.monthlyFee)],
            ["Due day", esc(x.dueDay)], ["Status", badge(x.status)], x.reason ? ["Reason", esc(x.reason)] : null])
        : dl([["Plan", idchip(x.id)], ["Course", esc(x.course)], ["Fee method", esc(Logic.methodLabel(x.feeType))],
            ["Rate", money(x.rate)], ["Days", esc((x.days || []).join(", "))], ["Duration", esc(x.duration) + " min"],
            ["Started", fmtDate(x.startDate)], ["Status", badge(x.status)]]),
      emptyTitle: "No history", emptyText: "" });
  }

  return '' +
  '<div class="btn-row no-print" style="margin-bottom:12px">' +
    '<button class="btn" data-act="goto" data-page="students">← All students</button>' +
    '<button class="btn" data-act="student-edit" data-id="' + s.id + '">Edit</button>' +
    '<button class="btn" data-act="student-assign" data-id="' + s.id + '">Batch</button>' +
    '<button class="btn" data-act="plan-new" data-id="' + s.id + '">Individual plan</button>' +
    (dueAll > 0 ? '<button class="btn btn-wa" data-act="wa-student" data-id="' + s.id + '">WhatsApp reminder</button>' : "") +
    '<button class="btn" data-act="rep-statement" data-id="' + s.id + '">Statement</button>' +
    '<button class="btn" data-act="print">Print</button>' +
  '</div>' +
  '<div class="card"><div class="card-bd"><div class="profile-hd">' +
    '<div class="avatar">' + esc(s.name.slice(0, 1)) + '</div>' +
    '<div style="flex:1 1 280px"><h2 style="font-size:20px">' + esc(s.name) + '</h2>' +
      '<div style="margin:4px 0 10px">' + idchip(s.id) + ' ' + badge(s.status) + ' ' +
        (str.batch ? streamChip("batch") : "") + " " + (str.individual ? streamChip("individual") : "") + '</div>' +
      '<dl class="deflist">' +
        [["Guardian", esc(s.guardian || "—")], ["Phone", '<span class="mono">' + esc(s.phone || "—") + '</span>'],
         ["WhatsApp", '<span class="mono">' + esc(s.whatsapp || "—") + '</span>'],
         ["Batch", str.batch ? esc(batch ? batch.name : str.batch.batchId) + " · " + money(str.batch.monthlyFee) : "Not in a batch"],
         ["Individual plan", str.individual ? esc(str.individual.course) + " · " + Logic.methodLabel(str.individual.feeType) +
           " @ " + money(str.individual.rate) : "None"],
         ["Joined", fmtDate(s.joiningDate)], ["Address", esc(s.address || "—")]]
        .map(x => '<div><dt>' + esc(x[0]) + '</dt><dd>' + x[1] + '</dd></div>').join("") +
      '</dl></div>' +
    '<div style="flex:0 0 210px;min-width:190px">' +
      '<div class="section-title" style="margin:0 0 5px">' + esc(monthLabel(State.month)) + '</div>' +
      cur.map(v => '<div class="kv"><span>' + (v.source === "batch" ? "Batch" : "Individual") + '</span><b>' +
        money(v.paidAmount) + " / " + money(v.netFee) + '</b></div>').join("") +
      (cur.length ? "" : '<div class="kv"><span>No fee record</span><b>—</b></div>') +
      '<div class="kv"><span>Paid to date</span><b>' + money(paidAll) + '</b></div>' +
      '<div class="kv"><span>Outstanding</span><b class="' + (dueAll > 0 ? "out" : "in") + '">' + money(dueAll) + '</b></div>' +
      '<div class="kv"><span>Individual classes</span><b>' + cs.completed + '</b></div>' +
      '<div class="kv"><span>Batch attendance</span><b>' + att.pct + '%</b></div>' +
    '</div>' +
  '</div></div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd" style="padding-bottom:0;border:0"><div class="tabs" style="width:100%">' +
    ["fees|Fees", "payments|Payments", "calendar|Calendar", "classes|Individual classes",
     "attendance|Batch attendance", "history|Enrolment history"]
      .map(function(t){ const x = t.split("|");
        return '<button class="tab ' + (p.tab === x[0] ? "is-on" : "") + '" data-act="pf-tab" data-t="' + x[0] + '">' + x[1] + '</button>'; })
      .join("") + '</div></div><div class="card-bd tight">' + body + '</div></div>';
};

/* ------------------------------- SETTINGS ------------------------------- */
Pages.settings = function(){
  const s = Settings();
  const listEditor = (k, label) => '<div style="margin-bottom:16px"><div class="section-title" style="margin-top:0">' + esc(label) + '</div>' +
    '<div class="listeditor">' + (s[k] || []).map((v, i) => '<span class="li">' + esc(v) +
      '<button data-act="list-del" data-k="' + k + '" data-i="' + i + '">×</button></span>').join("") + '</div>' +
    '<div class="btn-row"><input class="input" style="max-width:250px" id="add_' + k + '" placeholder="Add to ' + esc(label.toLowerCase()) + '">' +
    '<button class="btn" data-act="list-add" data-k="' + k + '">Add</button></div></div>';

  return '' +
  '<div class="card" style="margin-bottom:14px; border:1.5px solid rgba(143,211,174,.45); background:linear-gradient(135deg,#173d29,#0f3222); box-shadow:0 10px 30px rgba(0,0,0,.3)">' +
    '<div class="card-bd" style="text-align:center; padding:26px 22px">' +
      '<div style="font-size:34px; line-height:1">📊</div>' +
      '<h3 style="font-family:var(--f-d,serif); font-size:22px; margin:8px 0 4px; color:#eafff2">Data Sync &amp; Backup</h3>' +
      '<div style="margin:0 auto 18px; max-width:540px; color:#eafff2; font-size:14px; line-height:1.5; background:rgba(0,0,0,.18); padding:12px 16px; border-radius:12px">Supabase is the live database. Your Google Sheet is a full backup — you can pull everything back from it any time (for example if Supabase ever has a problem).</div>' +
      '<div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center; align-items:center">' +
        '<button data-act="imp-open" style="cursor:pointer; border:none; border-radius:14px; padding:15px 30px; font-size:17px; font-weight:700; color:#06140e; background:linear-gradient(90deg,#8fe0b6,#5fbf88); box-shadow:0 8px 22px rgba(95,191,136,.4)">🔄 Import from Sheet</button>' +
        '<button class="btn" data-act="sync-full" style="padding:15px 24px; font-size:15px">⬆️ Export to Sheet</button>' +
      '</div>' +
      '<div style="margin:14px auto 4px; max-width:520px; font-size:13px; color:#cfeeda; line-height:1.5">Import pulls the latest data from the Google Sheet into the app, overwriting the local copy on this device.</div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(143,211,174,.2)">' +
        '<button class="btn" data-act="backup" style="font-size:13.5px">⬇️ Export backup (JSON file)</button>' +
        '<button class="btn" data-act="restore" style="font-size:13.5px">⬆️ Import backup (JSON file)</button>' +
      '</div>' +
      '<div style="margin:10px auto 0; max-width:520px; font-size:12px; color:#9fd8b6">A JSON file is a full offline copy of everything — handy to keep on your computer.</div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(143,211,174,.2)">' +
        '<button class="btn" data-act="data-import" style="font-size:13.5px">📥 Import records (JSON)</button>' +
        '<button class="btn btn-danger" data-act="data-wipe" style="font-size:13.5px">🗑️ Delete all records</button>' +
      '</div>' +
      '<div style="margin:10px auto 0; max-width:520px; font-size:12px; color:#9fd8b6">Import adds or updates records by ID and saves them to Supabase. Delete removes every academy record everywhere (password + DELETE).</div>' +
    '</div>' +
  '</div>' +
  '<div class="card"><div class="card-hd"><h3>Academy details</h3></div><div class="card-bd">' +
    '<div class="form-grid">' +
      field("Academy name", '<input class="input" id="set_academyName" value="' + esc(s.academyName || "") + '">') +
      field("Tagline", '<input class="input" id="set_academyTagline" value="' + esc(s.academyTagline || "") + '">') +
      field("Website", '<input class="input" id="set_website" value="' + esc(s.website || "") + '">') +
      field("Email", '<input class="input" id="set_email" value="' + esc(s.email || "") + '">') +
      field("Contact number", '<input class="input mono" id="set_contactPhone" value="' + esc(s.contactPhone || "") + '">') +
      field("Academy WhatsApp", '<input class="input mono" id="set_whatsappNumber" value="' + esc(s.whatsappNumber || "") + '">') +
      field("Currency symbol", '<input class="input" id="set_currency" value="' + esc(s.currency || "₹") + '">') +
      field("WhatsApp country code", '<input class="input mono" id="set_countryCode" value="' + esc(s.countryCode || "91") + '">') +
      field("Default due day", '<input class="input" type="number" min="1" max="28" id="set_defaultDueDay" value="' + esc(s.defaultDueDay || 5) + '">') +
      field("Default fee method", '<select class="select" id="set_defaultFeeMethod">' + optList(FEE_METHODS, s.defaultFeeMethod) + '</select>') +

      '<div class="field span2"><label>Academy logo</label><input class="input" type="file" accept="image/*" id="set_logoFile">' +
        '<span class="hint">Shown in the header and on printed receipts.</span></div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:13px"><button class="btn btn-primary" data-act="settings-save">Save settings</button>' +
      (s.logo ? '<button class="btn" data-act="logo-clear">Remove logo</button>' : "") + '</div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Supabase — live database</h3></div>' +
    '<div class="card-bd">' +
    '<div class="note">Supabase is the <b>primary live database</b>. Every device reads and writes here live, so everyone always sees the same up-to-date data. The Google Sheet below keeps running as a <b>backup</b>. Paste your project URL and the <b>anon public / publishable</b> key from Supabase → Project Settings → API. Use the base URL only (no /rest/v1 at the end).</div>' +
    '<div class="form-grid">' +
      '<div class="field span2"><label>Project URL</label>' +
        '<input class="input" id="set_supabaseUrl" value="' + esc(s.supabaseUrl || "") + '" placeholder="https://xxxxxxxx.supabase.co"></div>' +
      '<div class="field span2"><label>Anon public / publishable key</label>' +
        '<input class="input mono" id="set_supabaseKey" value="' + esc(s.supabaseKey || "") + '" placeholder="eyJhbGciOi… or sb_publishable_…"></div>' +
      '<div class="field"><label>Use Supabase</label><label style="display:flex;gap:8px;align-items:center;padding-top:9px;font-size:13.5px">' +
        '<input type="checkbox" id="set_supabaseOn"' + (s.supabaseOn ? " checked" : "") + '> Make Supabase the live source of truth</label></div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn btn-primary" data-act="settings-save">Save settings</button>' +
      '<button class="btn" data-act="supa-test">Test Supabase</button>' +
      '<button class="btn" data-act="supa-push">⬆️ Upload everything to Supabase</button>' +
      '<button class="btn" data-act="supa-pull">⬇️ Load everything from Supabase</button>' +
    '</div>' +
    '<div class="note" style="margin-top:10px; font-size:12.5px">First time moving to Supabase? Connect above, then click <b>Upload everything to Supabase</b> to send this device\'s current data up. After that every device shares it live.</div>' +
    '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Google Sheets backup</h3>' +
    '<span class="spacer"></span><button class="btn btn-sm" data-act="sync-panel">Open backup panel</button></div>' +
    '<div class="card-bd">' +
    '<div class="note">Two spreadsheets sit behind this app: <b>MQ Batch</b> (classes, sub-classes, enrolment, attendance) ' +
    'and <b>MQ Individual + Books</b> (class plans, class log, fees and all the money). One Apps Script web app writes to both. ' +
    'The app never waits for the sheets — everything saves here first and goes up a few seconds later.</div>' +
    '<div class="form-grid">' +
      '<div class="field span2"><label>Web app URL</label>' +
        '<input class="input" id="set_apiUrl" value="' + esc(s.apiUrl || "") + '" placeholder="https://script.google.com/macros/s/…/exec"></div>' +
      field("Shared key", '<input class="input mono" id="set_syncKey" value="' + esc(s.syncKey || "") + '" placeholder="the API_KEY from Code.gs">') +
      field("Check the sheets every", '<input class="input" type="number" min="1" max="60" id="set_syncEvery" value="' + esc(s.syncEvery || 3) + '"> ') +
      '<div class="field"><label>Sync</label><label style="display:flex;gap:8px;align-items:center;padding-top:9px;font-size:13.5px">' +
        '<input type="checkbox" id="set_syncOn"' + (s.syncOn ? " checked" : "") + '> Keep this browser and the sheets in step</label></div>' +
      '<div class="field"><label>Teacher page address</label>' +
        '<input class="input" id="set_teacherLinkBase" value="' + esc(s.teacherLinkBase || "") + '"></div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:13px">' +
      '<button class="btn btn-primary" data-act="settings-save">Save settings</button>' +
      '<button class="btn" data-act="sync-test">Test the connection</button>' +
      '<button class="btn" data-act="sync-now">Sync now</button>' +
      '<button class="btn" data-act="sync-full">Push everything</button>' +
    '</div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Billing</h3></div><div class="card-bd">' +
    '<div class="note">In <b>prepaid</b> mode a month falls due before it starts, and individual classes are billed on the ' +
    'planned timetable. Reconcile at month end and any difference moves to the next month.</div>' +
    '<div class="form-grid">' +
      field("Billing mode", '<select class="select" id="set_billingMode">' +
        optList([{ value: "prepaid", label: "Prepaid — collect before the month" },
                 { value: "postpaid", label: "Postpaid — bill after the classes" }], s.billingMode || "prepaid") + '</select>') +
      field("Days before the month that fees fall due",
        '<input class="input" type="number" min="0" max="31" id="set_advanceDays" value="' + esc(s.advanceDays || 0) + '">') +
      field("Prepaid due date", '<select class="input" id="set_prepaidDue">' +
        optList([{ value: "studentDay", label: "Each student's own day, in the month before" },
                 { value: "advance",    label: "Same day for everyone, X days before the month" }],
                s.prepaidDue || "studentDay") + '</select>') +
      '<div class="field span2"><span class="hint">With the student\'s own day, someone who joined on the 22nd pays on 22 October for November. The "days before" box is then ignored.</span></div>' +
    '</div>' +
    '<p class="hint" style="margin-top:8px">A ' + esc(monthLabel(addMonths(currentMonth(), 1))) +
      ' fee would fall due on <b>' + esc(fmtDate(Logic.feeDueDate(addMonths(currentMonth(), 1), s.defaultDueDay))) + '</b>.</p>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="settings-save">Save settings</button></div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Course formats</h3></div><div class="card-bd">' +
    '<div class="note">Prepare your standard course formats — course, class days and the monthly fee. When you create a batch or an individual plan you can pick one to fill the fields instantly, or still enter everything manually.</div>' +
    '<div class="tbl-wrap"><table><thead><tr><th>Format</th><th>Course</th><th>Stream</th><th>Days</th><th>Monthly fee</th><th></th></tr></thead><tbody>' +
    ((s.courseFormats || []).length ? (s.courseFormats || []).map(fm => '<tr>' +
      '<td><b>' + esc(fm.name) + '</b></td><td>' + esc(fm.course || "—") + '</td>' +
      '<td>' + esc(fm.stream === "individual" ? "Individual" : "Batch") + '</td>' +
      '<td style="font-size:12px">' + esc(fm.days || "—") + '</td>' +
      '<td class="mono">' + money(+fm.monthlyFee || 0) + '</td>' +
      '<td><button class="btn btn-sm" data-act="fmt-edit" data-id="' + fm.id + '">Edit</button> ' +
        '<button class="btn btn-sm" data-act="fmt-del" data-id="' + fm.id + '">✕</button></td></tr>').join("")
      : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">No formats yet.</td></tr>') +
    '</tbody></table></div>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="fmt-new">+ Add format</button></div>' +
    '<div class="form-grid" style="margin-top:16px">' +
      field("Default admission fee", '<input class="input" type="number" min="0" id="set_admissionFeeDefault" value="' + esc(s.admissionFeeDefault || 0) + '">') +
    '</div>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="settings-save">Save settings</button></div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Academy holds / breaks</h3></div><div class="card-bd">' +
    '<div class="note">Pause the whole academy for a period (Ramadan, annual break). You can waive fees for everyone during that time, or keep them. For a single student on leave, use the ⏸ Hold / Leave button beside them in Students.</div>' +
    ((s.academyHolds || []).length ? '<div class="tbl-wrap"><table><thead><tr><th>From</th><th>To</th><th>Fees</th><th>Reason</th><th></th></tr></thead><tbody>' +
      (s.academyHolds || []).map(h => '<tr><td>' + esc(h.from) + '</td><td>' + esc(h.to || h.from) + '</td><td>' +
        (h.waiveFee ? "Waived" : "Kept") + '</td><td>' + esc(h.reason || "—") + '</td>' +
        '<td><button class="btn btn-sm" data-act="acad-hold-del" data-id="' + h.id + '">✕</button></td></tr>').join("") +
      '</tbody></table></div>' : '<div class="note" style="opacity:.7">No academy holds set.</div>') +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="acad-hold-new">+ Add academy hold</button></div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Holidays</h3>' +
    '<span class="spacer"></span><button class="btn btn-sm btn-primary" data-act="hol-new">+ Add holiday</button></div>' +
    '<div class="card-bd">' +
    '<p class="tagline">Range marking skips these days, and prepaid planning does not charge for them.</p>' +
    (DataService.getHolidays().length ? DataService.getHolidays().map(h => '<span class="holchip">' +
      '<span><b>' + esc(h.name) + '</b> <span class="hd">' + esc(fmtDate(h.from) +
      (h.to && h.to !== h.from ? " – " + fmtDate(h.to) : "")) + '</span></span>' +
      '<button data-act="hol-del" data-id="' + h.id + '">×</button></span>').join("")
      : '<p class="hint">No holidays added yet.</p>') +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Lists</h3></div><div class="card-bd">' +
    listEditor("courses", "Courses") + listEditor("levels", "Levels") +
    listEditor("incomeCategories", "Income categories") + listEditor("expenseCategories", "Expense categories") +
    '<div class="section-title">Built into the calculation engine</div>' +
    '<p class="hint" style="margin-top:0">Fee methods: ' + FEE_METHODS.map(m => '<span class="badge b-acc" style="margin-right:4px">' +
      esc(m.label) + '</span>').join("") + '<br><br>Teacher pay — individual: ' +
      IND_RATE_TYPES.map(m => '<span class="badge b-info" style="margin-right:4px">' + esc(m.label) + '</span>').join("") +
      '<br><br>Teacher pay — batch: ' + BATCH_PAY_TYPES.map(m => '<span class="badge stream-b" style="margin-right:4px">' +
      esc(m.label) + '</span>').join("") + '</p>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Data overview</h3></div><div class="card-bd">' +
    '<p class="tagline">A quick count of what is stored. Use the Data Sync &amp; Backup section at the top to import, export or back up.</p>' +
    '<div class="grid-2">' +
      '<div>' + [["Students", DB.students.length], ["Teachers", DB.teachers.length], ["Batches", DB.batches.length],
        ["Enrolments", DB.enrollments.length], ["Attendance marks", DB.attendance.length]]
        .map(x => '<div class="kv"><span>' + x[0] + '</span><b>' + num(x[1]) + '</b></div>').join("") + '</div>' +
      '<div>' + [["Class plans", DB.plans.length], ["Classes logged", DB.classes.length], ["Fee records", DB.fees.length],
        ["Payments", DB.payments.length], ["Expenses", DB.expenses.length]]
        .map(x => '<div class="kv"><span>' + x[0] + '</span><b>' + num(x[1]) + '</b></div>').join("") + '</div>' +
    '</div>' +
  '</div></div>';
};
