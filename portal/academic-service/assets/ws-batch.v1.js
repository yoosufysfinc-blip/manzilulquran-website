"use strict";
/* Academic Service — ws-batch.v1.js (split from index.html). Immutable: edit a copy as v2. */
/* ==========================================================================
   BATCH WORKSPACE
   ========================================================================== */
Pages.bDash = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "batch" });
  const s = Logic.summarize(views);
  const batches = DataService.getBatches().filter(b => b.status === "Active");
  const students = {}; batches.forEach(b => Logic.rosterOf(b.id).forEach(x => students[x.id] = true));
  const att = Logic.attStats(DataService.getAttendance({ month: m }));
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const mm = addMonths(m, -i);
    const t = Logic.summarize(Logic.feeViews({ month: mm, source: "batch" }));
    trend.push({ label: monthShort(mm), expected: t.net, collected: t.paid });
  }
  const byBatch = batches.map(function(b){
    const t = Logic.summarize(views.filter(v => v.batchId === b.id));
    return { label: b.name, value: t.paid, text: money(t.paid) + " / " + money(t.net),
      color: t.collectionPct >= 80 ? "var(--ok)" : t.collectionPct >= 50 ? "var(--acc)" : "var(--bad)" };
  }).sort((a, b) => b.value - a.value);

  return '' +
  '<div class="qbar no-print">' +
    '<button class="qbtn" data-act="att-quick"><span class="qi">✓</span> Mark attendance</button>' +
    '<button class="qbtn" data-act="batch-fees-build"><span class="qi">₹</span> Calculate ' + esc(monthShort(m)) + ' fees</button>' +
    '<button class="qbtn" data-act="student-new"><span class="qi">＋</span> Add student</button>' +
    '<button class="qbtn" data-act="batch-new"><span class="qi">▤</span> Add batch</button>' +
  '</div>' +
  '<div class="kpi-grid">' +
    kpi("Batch students", num(Object.keys(students).length), num(batches.length) + " active batches") +
    kpi("Expected", money(s.net), num(s.count) + " fee records", "a-acc") +
    kpi("Collected", money(s.paid), s.collectionPct + "% of expected", "a-ok") +
    kpi("Pending", money(s.balance), num(s.count - s.paidN) + " open", "a-warn") +
    kpi("Overdue", money(s.overdueAmt), num(s.overdueN) + " past due", "a-bad") +
    kpi("Attendance", att.pct + "%", num(att.total) + " marks this month") +
  '</div>' +
  '<div class="section-title">Charts</div>' +
  '<div class="chart-grid">' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Batch fee collection</h3>' +
      legend([{ label: "Expected", color: "#C9D8D3" }, { label: "Collected", color: "#0E6E5E" }]) +
      chartGrouped(trend, [{ key: "expected", label: "Expected", color: "#C9D8D3" },
                           { key: "collected", label: "Collected", color: "#0E6E5E" }]) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Paid vs pending</h3>' +
      chartDonut([{ label: "Collected", value: s.paid, color: "#0C7A4E" },
                  { label: "Pending", value: Math.max(0, s.balance - s.overdueAmt), color: "#B9C8C3" },
                  { label: "Overdue", value: s.overdueAmt, color: "#BE3A2B" }], s.collectionPct + "%", "collected") +
      legend([{ label: "Collected", color: "#0C7A4E" }, { label: "Pending", color: "#B9C8C3" }, { label: "Overdue", color: "#BE3A2B" }]) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 8px">Batch-wise collection</h3>' + chartHBars(byBatch) + '</div>' +
    '<div class="card chart-box"><h3 style="font-size:14px;padding:2px 2px 4px">Attendance</h3>' +
      chartDonut([{ label: "Present", value: att.Present, color: "#0C7A4E" }, { label: "Absent", value: att.Absent, color: "#BE3A2B" },
                  { label: "Leave", value: att.Leave, color: "#C08A2E" }, { label: "Excused", value: att.Excused, color: "#37648F" }],
                 att.pct + "%", num(att.total) + " marks") +
      legend([{ label: "Present " + att.Present, color: "#0C7A4E" }, { label: "Absent " + att.Absent, color: "#BE3A2B" },
              { label: "Leave " + att.Leave, color: "#C08A2E" }, { label: "Excused " + att.Excused, color: "#37648F" }]) + '</div>' +
  '</div>';
};

Pages.batches = function(){
  const f = State.batches, q = f.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getBatches().map(function(b){
    const t = DataService.getTeacher(b.teacherId);
    const s = Logic.summarize(Logic.feeViews({ month: m, source: "batch", batchId: b.id }));
    const att = Logic.attStats(DataService.getAttendance({ month: m, batchId: b.id }));
    return Object.assign({}, b, { teacherName: t ? t.name : "—", filled: Logic.rosterOf(b.id).length, sum: s, att: att });
  }).filter(function(b){
    if (f.status && b.status !== f.status) return false;
    if (f.course && b.course !== f.course) return false;
    if (f.teacher && b.teacherId !== f.teacher) return false;
    return search(b.id + " " + b.name + " " + b.course + " " + b.teacherName, q);
  });

  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="batches.q" value="' + esc(f.q) + '" placeholder="Batch ID, name, course or teacher">', "grow") +
    field("Status", sel("s", optList(Settings().batchStatuses, f.status, "All"), 'data-fset="batches.status"')) +
    field("Course", sel("c", courseOpts(f.course), 'data-fset="batches.course"')) +
    field("Teacher", sel("t", teacherOpts(f.teacher), 'data-fset="batches.teacher"')) +
    '<div class="push"><button class="btn btn-primary" data-act="batch-new">+ Add batch</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("batches", rows, {
      key: b => b.id, head: ["Batch", "Collected"],
      title: b => esc(b.name) + " " + idchip(b.id),
      sub: b => esc(b.course + " · " + b.teacherName + " · " + b.filled + "/" + (b.maxStudents || "—") + " students"),
      amount: b => money(b.sum.paid) + '<small>of ' + money(b.sum.net) + '</small>',
      badge: b => badge(b.status),
      detail: b => dl([
        ["Batch ID", idchip(b.id)], ["Course", esc(b.course)], ["Level", esc(b.level || "—")],
        ["Teacher", esc(b.teacherName)], ["Class days", esc((b.days || []).join(", ") || "—")],
        ["Timing", esc((b.startTime || "—") + " – " + (b.endTime || "—")) + " · " + esc(b.duration || 0) + " min"],
        ["Monthly fee", money(b.monthlyFee)], ["Admission fee", money(b.admissionFee)],
        ["Seats", b.filled + " / " + (b.maxStudents || "—")], ["Started", fmtDate(b.startDate)],
        ["Status", badge(b.status)],
        [monthShort(State.month) + " expected", money(b.sum.net)],
        [monthShort(State.month) + " collected", '<span class="in">' + money(b.sum.paid) + '</span>'],
        [monthShort(State.month) + " pending", b.sum.balance ? '<span class="out">' + money(b.sum.balance) + '</span>' : "—"],
        ["Attendance", b.att.pct + "% of " + num(b.att.total) + " marks"],
        b.notes ? ["Notes", esc(b.notes)] : null
      ]) + '<div class="sub-hd">Students in this batch</div>' +
        (b.filled ? Logic.rosterOf(b.id).map(s => '<div class="minirow"><span>' + esc(s.name) + ' · ' + esc(s.id) +
          '</span><b>' + money(s.enrollment.monthlyFee) + '</b></div>').join("")
          : '<div class="minirow"><span>No active enrolments</span><b>—</b></div>') +
        acts('<button class="btn btn-sm" data-act="batch-edit" data-id="' + b.id + '">Edit batch</button>' +
          '<button class="btn btn-sm" data-act="batch-toggle" data-id="' + b.id + '">' +
            (b.status === "Active" ? "Deactivate" : "Activate") + '</button>' +
          '<button class="btn btn-sm" data-act="enrol-new" data-id="' + b.id + '">Enrol a student</button>' +
          '<button class="btn btn-sm" data-act="att-open" data-id="' + b.id + '">Mark attendance</button>'),
      sorts: [{ key: "id", label: "Batch ID", val: b => b.id }, { key: "name", label: "Name", val: b => b.name },
              { key: "coll", label: "Most collected", val: b => b.sum.paid, desc: true },
              { key: "pend", label: "Most pending", val: b => b.sum.balance, desc: true }],
      emptyTitle: "No batches match", emptyText: "Change the filters, or create the batch.",
      emptyAction: '<button class="btn btn-primary" data-act="batch-new">+ Add batch</button>'
    }) +
  '</div></div>';
};

Pages.subclasses = function(){
  const m = State.month;
  const rows = DataService.getSubclasses().map(function(sc){
    const b = DataService.getBatch(sc.batchId), t = DataService.getTeacher(sc.teacherId);
    const roster = Logic.rosterOf(sc.batchId, null, sc.id);
    const att = Logic.attStats(DataService.getAttendance({ month: m, subClassId: sc.id }));
    const fees = Logic.summarize(Logic.feeViews({ month: m, source: "batch", batchId: sc.batchId })
      .filter(v => (v.subClassId || "") === sc.id));
    const pv = t ? Logic.payrollView(t, m) : null;
    const line = pv ? (pv.groups || []).find(g => g.subClassId === sc.id) : null;
    return Object.assign({}, sc, { batchName: b ? b.name : sc.batchId, teacherName: t ? t.name : "—",
      students: roster.length, roster: roster, att: att, fees: fees, pay: line });
  });
  const noSub = DataService.getBatches().filter(b => b.status === "Active" && !DataService.getSubclasses({ batchId: b.id }).length);

  return '' +
  '<div class="note">A sub-class is a smaller group inside a batch — Group A / Group B, boys / girls, or a level split. ' +
  'Each one keeps its own teacher, timing, roster and fee, and the teacher is paid separately for it.</div>' +
  '<div class="kpi-grid" style="margin-bottom:14px">' +
    kpi("Sub-classes", num(rows.length), num(new Set(rows.map(r => r.batchId)).size) + " parent batches") +
    kpi("Students grouped", num(rows.reduce((a, r) => a + r.students, 0))) +
    kpi("Teacher cost this month", money(rows.reduce((a, r) => a + (r.pay ? r.pay.amount : 0), 0)), esc(monthShort(m)), "a-acc") +
    kpi("Batches not split", num(noSub.length), "running as one group") +
  '</div>' +
  '<div class="toolbar no-print"><div class="push btn-row">' +
    '<button class="btn" data-act="sub-csv">CSV</button>' +
    '<button class="btn btn-primary" data-act="sub-new">+ New sub-class</button></div></div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("subclasses", rows, {
      key: r => r.id, head: ["Sub-class", "Teacher pay"],
      title: r => esc(r.name) + " " + idchip(r.id),
      sub: r => esc(r.batchName + " · " + r.teacherName + " · " + (r.days || []).join(", ") + " · " + r.students + " students"),
      amount: r => (r.pay ? money(r.pay.amount) : "—") + '<small>' + r.att.pct + '% attendance</small>',
      badge: r => badge(r.status || "Active"),
      detail: r => dl([
        ["Sub-class", idchip(r.id)], ["Parent batch", esc(r.batchName) + " " + idchip(r.batchId)],
        ["Teacher", esc(r.teacherName)], ["Class days", esc((r.days || []).join(", ") || "—")],
        ["Timing", esc((r.startTime || "—") + " – " + (r.endTime || "—"))],
        ["Students", r.students + (r.capacity ? " / " + r.capacity : "")],
        ["Monthly fee", r.monthlyFee ? money(r.monthlyFee) : "same as batch"],
        [monthShort(m) + " expected", money(r.fees.net)],
        [monthShort(m) + " collected", '<span class="in">' + money(r.fees.paid) + '</span>'],
        ["Attendance", r.att.pct + "% of " + num(r.att.total) + " marks"],
        ["Sessions held", r.pay ? r.pay.sessions : 0],
        ["Teacher pay this month", r.pay ? money(r.pay.amount) + " · " + r.pay.basis : "—"],
        r.notes ? ["Notes", esc(r.notes)] : null
      ]) +
      '<div class="sub-hd">Students in this group</div>' +
      (r.roster.length ? r.roster.map(x => '<div class="minirow"><span>' + esc(x.name) + ' · ' + esc(x.id) +
        '</span><b>' + money(x.enrollment.monthlyFee) + '</b></div>').join("")
        : '<div class="minirow"><span>Nobody assigned yet</span><b>—</b></div>') +
      acts('<button class="btn btn-sm" data-act="sub-edit" data-id="' + r.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-act="sub-assign" data-id="' + r.id + '">Assign students</button>' +
        '<button class="btn btn-sm" data-act="att-open" data-id="' + r.batchId + '" data-sub="' + r.id + '">Mark attendance</button>' +
        '<button class="btn btn-sm btn-primary" data-act="link-new" data-id="' + r.batchId + '" data-sub="' + r.id + '">Teacher link</button>'),
      sorts: [{ key: "batch", label: "Batch", val: r => r.batchName + r.name },
              { key: "pay", label: "Highest teacher pay", val: r => r.pay ? r.pay.amount : 0, desc: true },
              { key: "att", label: "Lowest attendance", val: r => r.att.pct }],
      emptyTitle: "No sub-classes yet",
      emptyText: "Split a large batch into smaller groups so each teacher has their own roster and pay.",
      emptyAction: '<button class="btn btn-primary" data-act="sub-new">+ New sub-class</button>'
    }) +
  '</div></div>';
};

function subForm(x){
  x = x || {};
  return '<div class="form-grid">' +
    field("Sub-class ID", '<input class="input mono" name="id" value="' + esc(x.id || "") + '" readonly placeholder="Generated automatically">') +
    field("Name", '<input class="input" name="name" required placeholder="Group A / Boys / Level 2" value="' + esc(x.name || "") + '">') +
    field("Parent batch", sel("batchId", batchOpts(x.batchId, "Select batch", false))) +
    field("Teacher", sel("teacherId", teacherOpts(x.teacherId, "Select teacher"))) +
    '<div class="field span2"><label>Class days</label><div>' + dayBoxes(x.days) + '</div></div>' +
    field("Start time", '<input class="input" type="time" name="startTime" value="' + esc(x.startTime || "") + '">') +
    field("End time", '<input class="input" type="time" name="endTime" value="' + esc(x.endTime || "") + '">') +
    field("Capacity", '<input class="input" type="number" name="capacity" min="1" value="' + esc(x.capacity || 10) + '">') +
    field("Monthly fee (blank = batch fee)", '<input class="input" type="number" name="monthlyFee" min="0" value="' + esc(x.monthlyFee || "") + '">') +
    field("Status", sel("status", optList(["Active", "Inactive"], x.status || "Active"))) +
    '<div></div>' +
    '<div class="field span2"><label>Notes</label><input class="input" name="notes" value="' + esc(x.notes || "") + '"></div>' +
  '</div>';
}

Pages.enrol = function(){
  const f = State.enrol, q = f.q.toLowerCase().trim();
  const rows = DataService.getEnrollments().map(function(e){
    const s = DataService.getStudent(e.studentId), b = DataService.getBatch(e.batchId);
    const t = b ? DataService.getTeacher(b.teacherId) : null;
    return Object.assign({}, e, { studentName: s ? s.name : e.studentId, batchName: b ? b.name : e.batchId,
      course: b ? b.course : "—", teacherName: t ? t.name : "—" });
  }).filter(function(e){
    if (f.status && e.status !== f.status) return false;
    if (f.batch && e.batchId !== f.batch) return false;
    return search(e.id + " " + e.studentId + " " + e.studentName + " " + e.batchId + " " + e.batchName, q);
  });
  return '' +
  '<div class="note">Moving a student closes the old enrolment and opens a new one. Fee records already generated stay attached to the batch the student was in at the time, so history can never be rewritten.</div>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="enrol.q" value="' + esc(f.q) + '" placeholder="Enrolment ID, student or batch">', "grow") +
    field("Status", sel("s", optList(["Active","Transferred","Completed","Left"], f.status, "All"), 'data-fset="enrol.status"')) +
    field("Batch", sel("b", batchOpts(f.batch), 'data-fset="enrol.batch"')) +
    '<div class="push"><button class="btn btn-primary" data-act="enrol-new">+ New enrolment</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("enrol", rows, {
      key: e => e.id, head: ["Student → batch", "Monthly fee"],
      title: e => esc(e.studentName) + " " + idchip(e.studentId),
      sub: e => esc(e.batchName + (e.subClassId ? " · " + ((DataService.getSubclass(e.subClassId) || {}).name || e.subClassId) : "") +
        " · joined " + fmtDate(e.joiningDate) + (e.leavingDate ? " · left " + fmtDate(e.leavingDate) : "")),
      amount: e => money(e.monthlyFee) + '<small>due day ' + esc(e.dueDay) + '</small>',
      badge: e => badge(e.status),
      detail: e => dl([
        ["Enrolment", idchip(e.id)], ["Student", esc(e.studentName) + " " + idchip(e.studentId)],
        ["Batch", esc(e.batchName) + " " + idchip(e.batchId)],
        ["Sub-class", e.subClassId ? esc((DataService.getSubclass(e.subClassId) || {}).name || e.subClassId) : "—"],
        ["Course", esc(e.course)], ["Teacher", esc(e.teacherName)],
        ["Joined", fmtDate(e.joiningDate)], ["Left", e.leavingDate ? fmtDate(e.leavingDate) : "—"],
        ["Monthly fee", money(e.monthlyFee)], ["Due day", esc(e.dueDay)], ["Status", badge(e.status)],
        e.reason ? ["Reason", esc(e.reason)] : null, e.notes ? ["Notes", esc(e.notes)] : null
      ]) + acts(
        (e.status === "Active" ? '<button class="btn btn-sm" data-act="student-assign" data-id="' + e.studentId + '">Move to another batch</button>' +
          '<button class="btn btn-sm btn-danger" data-act="enrol-close" data-id="' + e.id + '">Close enrolment</button>' : "") +
        '<button class="btn btn-sm" data-act="profile-open" data-id="' + e.studentId + '">Open student</button>'),
      sorts: [{ key: "id", label: "Newest first", val: e => e.id, desc: true },
              { key: "name", label: "Student name", val: e => e.studentName },
              { key: "batch", label: "Batch", val: e => e.batchId }],
      emptyTitle: "No enrolment records", emptyText: "Assign a student to a batch to open the first enrolment."
    }) +
  '</div></div>';
};

/* ---- attendance ---- */
function loadMarks(){
  const a = State.att;
  a.marks = {};
  if (!a.batchId) return;
  const saved = DataService.getAttendance({ date: a.date, batchId: a.batchId });
  Logic.rosterOf(a.batchId, a.date, a.subClassId).forEach(function(st){
    const rec = saved.find(x => x.studentId === st.id);
    a.marks[st.id] = { status: rec ? rec.status : "", remarks: rec ? rec.remarks : "" };
  });
  a.savedCount = saved.length;
}
Pages.attendance = function(){
  const a = State.att;
  if (a.marks === null) loadMarks();
  const batch = a.batchId ? DataService.getBatch(a.batchId) : null;
  const roster = a.batchId ? Logic.rosterOf(a.batchId, a.date, a.subClassId) : [];
  const meets = batch ? Logic.batchMeetsOn(batch, a.date) : true;
  const marked = Object.keys(a.marks || {}).filter(k => a.marks[k].status).length;
  const segs = ["Present", "Absent", "Leave", "Excused"];

  const rosterHtml = !a.batchId
    ? '<div class="empty"><h4>Pick a batch to load the roster</h4><p>Attendance for every batch is marked from this one page.</p></div>'
    : (!roster.length
      ? '<div class="empty"><h4>No students enrolled on this date</h4><p>This batch had no active enrolment on ' + esc(fmtDate(a.date)) + '.</p></div>'
      : '<div class="roster">' + roster.map(function(st){
          const mk = a.marks[st.id] || { status: "" };
          return '<div class="rrow"><div class="rname">' + esc(st.name) + ' ' + idchip(st.id) + '</div>' +
            '<div class="segbtns">' + segs.map(s => '<button type="button" class="' + (mk.status === s ? "on-" + s[0] : "") +
              '" data-act="att-mark" data-id="' + st.id + '" data-s="' + s + '">' + s + '</button>').join("") + '</div>' +
            '<input class="input" style="flex:1 1 150px;max-width:230px" placeholder="Remarks" data-act="att-remark" data-id="' +
              st.id + '" value="' + esc(mk.remarks || "") + '"></div>';
        }).join("") + '</div>');

  const rmonth = monthOf(a.date);
  const scope = DataService.getAttendance({ month: rmonth });
  let report = "";
  if (a.tab === "student") {
    const map = {};
    scope.filter(x => !a.batchId || x.batchId === a.batchId).forEach(x => (map[x.studentId] = map[x.studentId] || []).push(x));
    const rows = Object.keys(map).map(function(sid){
      const st = DataService.getStudent(sid), s = Logic.attStats(map[sid]);
      return { id: sid, name: st ? st.name : sid, s: s };
    });
    report = renderList("attStudent", rows, {
      key: r => r.id, head: ["Student", "Attendance"],
      title: r => esc(r.name) + " " + idchip(r.id),
      sub: r => r.s.total + " classes · " + r.s.Present + " present",
      amount: r => r.s.pct + "%" + '<small>' + r.s.Absent + ' absent</small>',
      badge: r => badge(r.s.pct >= 80 ? "Present" : r.s.pct >= 60 ? "Leave" : "Absent"),
      detail: r => dl([["Classes", r.s.total], ["Present", r.s.Present], ["Absent", r.s.Absent],
        ["Leave", r.s.Leave], ["Excused", r.s.Excused], ["Attendance", r.s.pct + "%"]]) +
        '<div class="sub-hd">' + esc(monthLabel(rmonth)) + ' calendar</div>' +
        studentCalendarBlock(r.id, rmonth, false) +
        acts('<button class="btn btn-sm" data-act="profile-open" data-id="' + r.id + '">Open student</button>' +
          '<button class="btn btn-sm" data-act="att-range" data-id="' + r.id + '">Fix a date range</button>'),
      sorts: [{ key: "pct", label: "Lowest attendance first", val: r => r.s.pct },
              { key: "name", label: "Student name", val: r => r.name }],
      emptyTitle: "Nothing marked in " + monthLabel(rmonth), emptyText: "Save a roster above to start."
    });
  } else if (a.tab === "batch") {
    const rows = DataService.getBatches().map(function(b){
      return { id: b.id, name: b.name, s: Logic.attStats(scope.filter(x => x.batchId === b.id)) };
    }).filter(r => r.s.total > 0);
    report = renderList("attBatch", rows, {
      key: r => r.id, head: ["Batch", "Attendance"],
      title: r => esc(r.name) + " " + idchip(r.id),
      sub: r => r.s.total + " marks · " + r.s.Present + " present",
      amount: r => r.s.pct + "%",
      detail: r => dl([["Marks", r.s.total], ["Present", r.s.Present], ["Absent", r.s.Absent],
        ["Leave", r.s.Leave], ["Excused", r.s.Excused]]),
      emptyTitle: "Nothing marked in " + monthLabel(rmonth), emptyText: ""
    });
  } else {
    const byDate = {};
    DataService.getAttendance({ month: rmonth }).filter(x => !a.batchId || x.batchId === a.batchId)
      .forEach(x => (byDate[x.date + "|" + x.batchId] = byDate[x.date + "|" + x.batchId] || []).push(x));
    const rows = Object.keys(byDate).map(function(k){
      const p = k.split("|"), b = DataService.getBatch(p[1]);
      return { key: k, date: p[0], batchId: p[1], batchName: b ? b.name : p[1], s: Logic.attStats(byDate[k]) };
    });
    report = renderList("attHist", rows, {
      key: r => r.key, head: ["Class", "Present"],
      title: r => fmtDate(r.date) + " · " + esc(r.batchName),
      sub: r => r.s.total + " marked · " + r.s.Absent + " absent",
      amount: r => r.s.Present + "/" + r.s.total + '<small>' + r.s.pct + '%</small>',
      detail: r => dl([["Date", fmtDate(r.date)], ["Batch", esc(r.batchName) + " " + idchip(r.batchId)],
        ["Marked", r.s.total], ["Present", r.s.Present], ["Absent", r.s.Absent], ["Leave", r.s.Leave],
        ["Excused", r.s.Excused], ["Attendance", r.s.pct + "%"]]) +
        acts('<button class="btn btn-sm btn-primary" data-act="att-load" data-date="' + r.date + '" data-id="' + r.batchId + '">Open and edit</button>'),
      sorts: [{ key: "date", label: "Newest first", val: r => r.date, desc: true },
              { key: "pct", label: "Lowest attendance first", val: r => r.s.pct }],
      emptyTitle: "Nothing marked in " + monthLabel(rmonth), emptyText: "Load a batch above and save the first roster."
    });
  }

  return '' +
  '<div class="toolbar no-print">' +
    field("Class date", '<input class="input" type="date" data-fset="att.date" value="' + esc(a.date) + '">') +
    field("Batch", sel("b", batchOpts(a.batchId, "Select batch", false), 'data-fset="att.batchId"')) +
    (a.batchId && DataService.getSubclasses({ batchId: a.batchId }).length
      ? field("Sub-class", sel("sc", optList(DataService.getSubclasses({ batchId: a.batchId })
          .map(x => ({ value: x.id, label: x.name })), a.subClassId, "Whole batch"), 'data-fset="att.subClassId"')) : "") +
    '<div class="push btn-row">' +
      '<button class="btn" data-act="link-new" data-id="' + esc(a.batchId) + '" data-sub="' + esc(a.subClassId) + '">Teacher link</button>' +
      '<button class="btn btn-dark" data-act="att-range">Mark a date range</button>' +
      '<button class="btn" data-act="att-all"' + (roster.length ? "" : " disabled") + '>Mark all present</button>' +
      '<button class="btn btn-primary" data-act="att-save"' + (marked ? "" : " disabled") + '>Save attendance</button>' +
    '</div>' +
  '</div>' +
  (batch && !meets ? '<div class="note">' + esc(batch.name) + ' does not normally meet on ' + esc(fmtDate(a.date)) +
    ' (class days: ' + esc((batch.days || []).join(", ")) + '). You can still mark an extra class.</div>' : "") +
  '<div class="card"><div class="card-hd"><h3>' + (batch ? esc(batch.name) : "Roster") + '</h3>' +
    (batch ? '<span class="hint">' + esc(fmtDate(a.date)) + '</span>' : "") + '<span class="spacer"></span>' +
    '<span class="badge ' + (marked ? "b-ok" : "b-idle") + '">' + marked + ' of ' + roster.length + ' marked</span>' +
    (a.savedCount ? '<span class="badge b-info">' + a.savedCount + ' already saved</span>' : "") +
  '</div><div class="card-bd">' + rosterHtml + '</div></div>' +
  '<div class="section-title">Attendance in ' + esc(monthLabel(rmonth)) + '</div>' +
  '<div class="card"><div class="card-hd" style="padding-bottom:0;border:0"><div class="tabs" style="width:100%">' +
    ["history|Class history", "student|Student-wise", "batch|Batch-wise"].map(function(t){
      const p = t.split("|");
      return '<button class="tab ' + (a.tab === p[0] ? "is-on" : "") + '" data-act="att-tab" data-t="' + p[0] + '">' + p[1] + '</button>';
    }).join("") + '</div></div><div class="card-bd tight">' + report + '</div></div>';
};

Pages.bFees = function(){ return feesPage("batch", "bFees", "batch-fees-build"); };
Pages.bDues = function(){ return duesPage("batch", "bDues"); };

Pages.bReports = function(){
  const m = State.month;
  const views = Logic.feeViews({ month: m, source: "batch" }).map(withBasis);
  const rows = DataService.getBatches().map(function(b){
    const v = views.filter(x => x.batchId === b.id);
    const s = Logic.summarize(v);
    const att = Logic.attStats(DataService.getAttendance({ month: m, batchId: b.id }));
    const t = DataService.getTeacher(b.teacherId);
    return { id: b.id, name: b.name, teacher: t ? t.name : "—", course: b.course, students: Logic.rosterOf(b.id).length,
      s: s, att: att, views: v };
  }).filter(r => r.students > 0 || r.s.count > 0);
  const tot = Logic.summarize(views);

  return '' +
  '<div class="toolbar no-print"><div class="push btn-row">' +
    '<button class="btn" data-act="brep-csv">Export CSV</button>' +
    '<button class="btn" data-act="print">Print</button></div></div>' +
  '<h2 style="font-size:18px">Batch report — ' + esc(monthLabel(m)) + '</h2>' +
  '<p class="tagline">' + esc(Settings().academyName) + ' · generated ' + esc(fmtDate(today())) + '</p>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Batches", num(rows.length)) + kpi("Students", num(tot.studentCount)) +
    kpi("Expected", money(tot.net), "", "a-acc") + kpi("Collected", money(tot.paid), tot.collectionPct + "%", "a-ok") +
    kpi("Pending", money(tot.balance), "", "a-warn") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("bRep", rows, {
      key: r => r.id, head: ["Batch", "Collected"],
      title: r => esc(r.name) + " " + idchip(r.id),
      sub: r => esc(r.course + " · " + r.teacher + " · " + r.students + " students"),
      amount: r => money(r.s.paid) + '<small>of ' + money(r.s.net) + '</small>',
      badge: r => badge(r.s.collectionPct >= 80 ? "Paid" : r.s.collectionPct >= 50 ? "Partial" : "Overdue", FEE_BADGE),
      detail: r => dl([["Teacher", esc(r.teacher)], ["Students", r.students], ["Expected", money(r.s.net)],
        ["Collected", '<span class="in">' + money(r.s.paid) + '</span>'],
        ["Pending", r.s.balance ? '<span class="out">' + money(r.s.balance) + '</span>' : "—"],
        ["Collection", r.s.collectionPct + "%"], ["Attendance", r.att.pct + "% of " + num(r.att.total) + " marks"],
        ["Paid / partial / overdue", r.s.paidN + " / " + r.s.partialN + " / " + r.s.overdueN]]) +
        '<div class="sub-hd">Students</div>' +
        (r.views.length ? r.views.map(v => '<div class="minirow"><span>' + esc(v.studentName) + ' · ' + v.status +
          '</span><b>' + money(v.paidAmount) + " / " + money(v.netFee) + '</b></div>').join("")
          : '<div class="minirow"><span>No fee records this month</span><b>—</b></div>'),
      sorts: [{ key: "pend", label: "Most pending first", val: r => r.s.balance, desc: true },
              { key: "coll", label: "Most collected first", val: r => r.s.paid, desc: true },
              { key: "name", label: "Batch name", val: r => r.name }],
      emptyTitle: "No batch data for " + monthLabel(m), emptyText: "Calculate the month on the batch fees page."
    }) +
  '</div></div>';
};

