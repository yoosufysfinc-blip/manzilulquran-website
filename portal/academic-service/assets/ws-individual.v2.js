"use strict";
/* Academic Service — ws-individual.v2.js. v2: plan fee rule + teacher pay per student shown. */
/* ==========================================================================
   INDIVIDUAL WORKSPACE
   ========================================================================== */
Pages.iDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "individual" }).map(withBasis);
  const s = Logic.summarize(views);
  const plans = DataService.getPlans({ status: "Active" });
  const cs = Logic.classStats(DataService.getClasses({ month: m }));
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const mm = addMonths(m, -i);
    const t = Logic.summarize(Logic.feeViews({ month: mm, source: "individual" }));
    trend.push({ label: monthShort(mm), expected: t.net, collected: t.paid });
  }
  const byTeacher = DataService.getTeachers().map(function(t){
    const v = views.filter(x => x.teacherId === t.id);
    const q = Logic.summarize(v);
    return { label: t.name, value: q.net, text: money(q.paid) + " / " + money(q.net), color: "var(--pri)" };
  }).filter(x => x.value > 0);

  return '' +
  '<div class="qbar no-print">' +
    '<button class="qbtn" data-act="class-new"><span class="qi">✓</span> Record class</button>' +
    '<button class="qbtn" data-act="ind-fees-build"><span class="qi">₹</span> Calculate ' + esc(monthShort(m)) + ' fees</button>' +
    '<button class="qbtn" data-act="plan-new"><span class="qi">＋</span> New class plan</button>' +
    '<button class="qbtn" data-act="cls-range"><span class="qi">▤</span> Log a date range</button>' +
  '</div>' +
  '<div class="kpi-grid">' +
    kpi("Active plans", num(plans.length), num(new Set(plans.map(p => p.studentId)).size) + " students") +
    kpi("Classes this month", num(cs.completed), num(cs.total) + " logged · " + round2(cs.minutes / 60) + " h") +
    kpi("Fee earned", money(s.net), num(s.count) + " records", "a-acc") +
    kpi("Collected", money(s.paid), s.collectionPct + "%", "a-ok") +
    kpi("Pending", money(s.balance), num(s.overdueN) + " overdue", "a-warn") +
    kpi("Missed classes", num(cs.studentAbsent + cs.cancelled + cs.teacherAbsent),
        cs.studentAbsent + " student · " + cs.teacherAbsent + " teacher") +
  '</div>' +
  '<div class="section-title">Charts</div>' +
  '<div class="chart-grid">' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Individual fee collection</h3>' +
      legend([{ label: "Earned", color: "#BFCEE4" }, { label: "Collected", color: "#2A5EA8" }]) +
      chartGrouped(trend, [{ key: "expected", label: "Earned", color: "#BFCEE4" },
                           { key: "collected", label: "Collected", color: "#2A5EA8" }]) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Class outcomes</h3>' +
      chartDonut([{ label: "Completed", value: cs.completed, color: "#0C7A4E" },
                  { label: "Student absent", value: cs.studentAbsent, color: "#BE3A2B" },
                  { label: "Cancelled", value: cs.cancelled, color: "#B9C8C3" },
                  { label: "Teacher absent", value: cs.teacherAbsent, color: "#C0762E" }],
                 pct(cs.completed, cs.total) + "%", "completed") +
      legend([{ label: "Completed " + cs.completed, color: "#0C7A4E" }, { label: "Student absent " + cs.studentAbsent, color: "#BE3A2B" },
              { label: "Cancelled " + cs.cancelled, color: "#B9C8C3" }, { label: "Teacher absent " + cs.teacherAbsent, color: "#C0762E" }]) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 8px">Fee by teacher</h3>' + chartHBars(byTeacher) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Paid vs pending</h3>' +
      chartDonut([{ label: "Collected", value: s.paid, color: "#0C7A4E" },
                  { label: "Pending", value: Math.max(0, s.balance - s.overdueAmt), color: "#B9C8C3" },
                  { label: "Overdue", value: s.overdueAmt, color: "#BE3A2B" }], s.collectionPct + "%", "collected") +
      legend([{ label: "Collected", color: "#0C7A4E" }, { label: "Pending", color: "#B9C8C3" }, { label: "Overdue", color: "#BE3A2B" }]) + '</div>' +
  '</div>';
};

Pages.plans = function(){
  const f = State.plans, q = f.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getPlans().map(function(p){
    const st = DataService.getStudent(p.studentId), t = DataService.getTeacher(p.teacherId);
    const cs = Logic.classStats(DataService.getClasses({ planId: p.id, month: m }));
    const fee = Logic.feeViews({ month: m, source: "individual" }).find(v => v.planId === p.id);
    return Object.assign({}, p, { studentName: st ? st.name : p.studentId, teacherName: t ? t.name : "—",
      cs: cs, thisMonth: fee ? fee.netFee : Math.max(0, Logic.computeGross(p.feeType, p.rate, cs, Logic.ruleExtra(p, "fee")) - (+p.discount || 0)),
      balance: fee ? fee.balance : 0, feeStatus: fee ? fee.status : "Not calculated" });
  }).filter(function(p){
    if (f.status && p.status !== f.status) return false;
    if (f.teacher && p.teacherId !== f.teacher) return false;
    return search(p.id + " " + p.studentId + " " + p.studentName + " " + p.course, q);
  });

  return '' +
  '<div class="note">A class plan holds one student\'s own schedule, fee method and rate. The same student can also sit in a batch — the two are billed separately and never mixed.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="plans.q" value="' + esc(f.q) + '" placeholder="Student name, ID or course">', "grow") +
    field("Status", sel("s", optList(["Active", "Stopped"], f.status, "All"), 'data-fset="plans.status"')) +
    field("Teacher", sel("t", teacherOpts(f.teacher), 'data-fset="plans.teacher"')) +
    '<div class="push"><button class="btn btn-primary" data-act="plan-new">+ New class plan</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("plans", rows, {
      key: p => p.id, head: ["Student", monthShort(m) + " fee"],
      title: p => esc(p.studentName) + " " + idchip(p.studentId),
      sub: p => esc(p.course + " · " + p.teacherName + " · " + Logic.methodLabel(p.feeType) + " @ " + money(p.rate)),
      amount: p => money(p.thisMonth) + '<small>' + p.cs.completed + ' classes done</small>',
      badge: p => badge(p.status),
      detail: p => dl([
        ["Plan", idchip(p.id)], ["Student", esc(p.studentName) + " " + idchip(p.studentId)],
        ["Teacher", esc(p.teacherName)], ["Course", esc(p.course)],
        ["Class days", esc((p.days || []).join(", ") || "—")], ["Duration", esc(p.duration) + " min"],
        ["Per week", esc(p.perWeek || (p.days || []).length)],
        ["Fee method", esc(Logic.methodLabel(p.feeType))], ["Rate", p.feeType === "manual" ? "—" : money(p.rate)],
        Logic.isHybrid(p.feeType) ? ["Fee rule", esc(p.feeType === "hybridH1" ? money(p.feeBase) + " base + " + money(p.rate) + " per class"
          : p.feeType === "hybridH2" ? money(p.feeBase) + " covers " + (+p.feeIncluded || 0) + " classes, extra " + money(p.rate) + " each"
          : money(p.rate) + " per class, min " + money(p.feeMin) + (+p.feeMax > 0 ? ", max " + money(p.feeMax) : ""))] : null,
        ["Teacher pay", esc(Logic.planPayLabel(p.payType)) + (p.payType && p.payType !== "manual" && p.payType !== "none"
          ? " · " + (p.payType === "percent" ? (+p.payRate || 0) + "%" : money(p.payRate)) : "")],
        ["Standing discount", p.discount ? money(p.discount) : "—"], ["Due day", esc(p.dueDay)],
        ["Started", fmtDate(p.startDate)], ["Status", badge(p.status)],
        [monthShort(m) + " classes", p.cs.completed + " of " + p.cs.total + " logged"],
        [monthShort(m) + " fee", p.feeType === "manual" && !p.thisMonth ? "Typed in each month" : money(p.thisMonth)],
        [monthShort(m) + " balance", p.balance ? '<span class="out">' + money(p.balance) + '</span>' : "—"],
        p.notes ? ["Notes", esc(p.notes)] : null
      ]) + acts('<button class="btn btn-sm" data-act="plan-edit" data-id="' + p.id + '">Edit plan</button>' +
        '<button class="btn btn-sm" data-act="class-new" data-id="' + p.id + '">Record class</button>' +
        '<button class="btn btn-sm" data-act="cls-range" data-id="' + p.id + '">Log a range</button>' +
        '<button class="btn btn-sm" data-act="profile-open" data-id="' + p.studentId + '">Open student</button>'),
      sorts: [{ key: "name", label: "Student name", val: p => p.studentName },
              { key: "fee", label: "Highest fee first", val: p => p.thisMonth, desc: true },
              { key: "bal", label: "Largest balance first", val: p => p.balance, desc: true }],
      emptyTitle: "No class plans match", emptyText: "Create a plan to start billing individual classes.",
      emptyAction: '<button class="btn btn-primary" data-act="plan-new">+ New class plan</button>'
    }) +
  '</div></div>';
};

Pages.classes = function(){
  const f = State.classes, q = f.q.toLowerCase().trim();
  const m = f.month || State.month;
  const rows = DataService.getClasses({ month: m }).map(function(c){
    const s = DataService.getStudent(c.studentId), t = DataService.getTeacher(c.teacherId);
    const p = DataService.getPlan(c.planId);
    return Object.assign({}, c, { studentName: s ? s.name : c.studentId, teacherName: t ? t.name : c.teacherId,
      course: p ? p.course : "" });
  }).filter(function(c){
    if (f.student && c.studentId !== f.student) return false;
    if (f.teacher && c.teacherId !== f.teacher) return false;
    if (f.status && c.status !== f.status) return false;
    return search(c.id + " " + c.studentName + " " + c.teacherName + " " + c.date, q);
  });
  const st = Logic.classStats(rows);

  return '' +
  '<div class="toolbar no-print">' +
    field("Month", sel("m", monthOpts(m, ""), 'data-fset="classes.month"')) +
    field("Student", sel("s", studentOpts(f.student, "All students"), 'data-fset="classes.student"')) +
    field("Teacher", sel("t", teacherOpts(f.teacher), 'data-fset="classes.teacher"')) +
    field("Status", sel("q", optList(["Completed","Cancelled","Student Absent","Teacher Absent","Rescheduled"], f.status, "All"), 'data-fset="classes.status"')) +
    '<div class="push btn-row">' +
      '<button class="btn btn-dark" data-act="cls-range">Range / bulk log</button>' +
      '<button class="btn" data-act="classes-csv">CSV</button>' +
      '<button class="btn btn-primary" data-act="class-new">+ Record class</button>' +
    '</div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Logged", num(st.total)) + kpi("Completed", num(st.completed), "", "a-ok") +
    kpi("Cancelled", num(st.cancelled)) + kpi("Student absent", num(st.studentAbsent), "", "a-bad") +
    kpi("Teacher absent", num(st.teacherAbsent), "", "a-warn") + kpi("Taught hours", round2(st.minutes / 60)) +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("classes", rows, {
      key: c => c.id, head: ["Class", "Duration"],
      title: c => fmtDate(c.date) + " · " + esc(c.studentName),
      sub: c => esc(c.teacherName + (c.course ? " · " + c.course : "") + " · " + c.id),
      amount: c => (c.duration ? c.duration + " min" : "—"),
      badge: c => badge(c.status),
      detail: c => dl([["Class", idchip(c.id)], ["Date", fmtDate(c.date)],
        ["Student", esc(c.studentName) + " " + idchip(c.studentId)], ["Teacher", esc(c.teacherName)],
        ["Course", esc(c.course || "—")], ["Duration", c.duration ? c.duration + " min" : "—"],
        ["Status", badge(c.status)], c.notes ? ["Notes", esc(c.notes)] : null]) +
        '<div class="note" style="margin:10px 0 0">Only a <b>Completed</b> class counts towards the student fee and the teacher payment.</div>' +
        acts('<button class="btn btn-sm" data-act="class-edit" data-id="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-act="class-del" data-id="' + c.id + '">Remove</button>' +
          '<button class="btn btn-sm" data-act="profile-open" data-id="' + c.studentId + '">Open student</button>'),
      sorts: [{ key: "date", label: "Newest first", val: c => c.date + c.id, desc: true },
              { key: "name", label: "Student name", val: c => c.studentName }],
      emptyTitle: "No classes logged for " + monthLabel(m),
      emptyText: "Record a class and the fee follows from it automatically.",
      emptyAction: '<button class="btn btn-primary" data-act="class-new">+ Record class</button>'
    }) +
  '</div></div>';
};

Pages.iFees = function(){ return feesPage("individual", "iFees", "ind-fees-build"); };
Pages.iDues = function(){ return duesPage("individual", "iDues"); };

Pages.iReports = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "individual" }).map(withBasis);
  const tot = Logic.summarize(views);
  const byStudent = views.map(function(v){
    const cs = Logic.classStats(DataService.getClasses({ planId: v.planId, month: m }));
    return Object.assign({}, v, { cs: cs });
  });
  return '' +
  '<div class="toolbar no-print"><div class="push btn-row">' +
    '<button class="btn" data-act="irep-csv">Export CSV</button><button class="btn" data-act="print">Print</button></div></div>' +
  '<h2 style="font-size:18px">Individual class report — ' + esc(monthLabel(m)) + '</h2>' +
  '<p class="tagline">' + esc(Settings().academyName) + ' · generated ' + esc(fmtDate(today())) + '</p>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Students", num(tot.studentCount)) + kpi("Fee earned", money(tot.net), "", "a-acc") +
    kpi("Collected", money(tot.paid), tot.collectionPct + "%", "a-ok") + kpi("Pending", money(tot.balance), "", "a-warn") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("iRep", byStudent, {
      key: v => v.id, head: ["Student", "Fee"],
      title: v => esc(v.studentName) + " " + idchip(v.studentId),
      sub: v => esc(v.teacherName + " · " + v.basisText),
      amount: v => money(v.netFee) + '<small>paid ' + money(v.paidAmount) + '</small>',
      badge: v => feeBadge(v.status),
      detail: v => dl([["Teacher", esc(v.teacherName)], ["Fee method", esc(Logic.methodLabel(v.feeType))],
        ["Rate", money(v.rate)], ["Classes completed", v.cs.completed + " of " + v.cs.total],
        ["Days", v.cs.days], ["Hours", round2(v.cs.minutes / 60)],
        ["Gross", money(v.gross)], ["Discount", v.discount ? money(v.discount) : "—"], ["Net", money(v.netFee)],
        ["Paid", '<span class="in">' + money(v.paidAmount) + '</span>'],
        ["Balance", v.balance ? '<span class="out">' + money(v.balance) + '</span>' : "—"],
        ["Status", feeBadge(v.status)]]) +
        acts('<button class="btn btn-sm" data-act="profile-open" data-id="' + v.studentId + '">Open student</button>'),
      sorts: [{ key: "fee", label: "Highest fee first", val: v => v.netFee, desc: true },
              { key: "name", label: "Student name", val: v => v.studentName },
              { key: "bal", label: "Largest balance first", val: v => v.balance, desc: true }],
      emptyTitle: "No individual fees for " + monthLabel(m), emptyText: "Calculate the month on the fees page."
    }) +
  '</div></div>';
};

