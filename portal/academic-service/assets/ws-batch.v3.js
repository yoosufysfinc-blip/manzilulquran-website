"use strict";
/* Academic Service — ws-batch.v3.js. v3 (simple mode): a batch or sub-class with no teacher is marked "No teacher";
   enrolments have one fixed monthly fee; sub-classes no longer show teacher pay; the Fees page is the Due date page.
   The dashboard lives in dash.v2.js. (v2: enrolment fee method (fixed / manual).) */
/* ==========================================================================
   BATCH WORKSPACE
   ========================================================================== */
Pages.batches = function(){
  const f = State.batches, q = f.q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getBatches().map(function(b){
    const t = DataService.getTeacher(b.teacherId);
    const s = Logic.summarize(Logic.feeViews({ month: m, source: "batch", batchId: b.id }));
    const att = Logic.attStats(DataService.getAttendance({ month: m, batchId: b.id }));
    return Object.assign({}, b, { teacherName: t ? t.name : "", filled: Logic.rosterOf(b.id).length, sum: s, att: att });
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
      sub: b => esc([b.course, b.teacherName || "no teacher", b.filled + "/" + (b.maxStudents || "—") + " students"].filter(Boolean).join(" · ")),
      amount: b => money(b.sum.paid) + '<small>of ' + money(b.sum.net) + '</small>',
      badge: b => b.status === "Active" && !b.teacherName ? badge("No teacher") : badge(b.status),
      rowClass: b => b.status === "Active" && !b.teacherName ? "row-warn" : "",
      detail: b => dl([
        ["Batch ID", idchip(b.id)], ["Course", esc(b.course)], ["Level", esc(b.level || "—")],
        ["Teacher", b.teacherName ? esc(b.teacherName) : badge("No teacher")], ["Class days", esc((b.days || []).join(", ") || "—")],
        ["Timing", esc((b.startTime || "—") + " – " + (b.endTime || "—")) + " · " + esc(b.duration || 0) + " min"],
        ["Monthly fee", money(b.monthlyFee)],
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
    return Object.assign({}, sc, { batchName: b ? b.name : sc.batchId, teacherName: t ? t.name : "",
      students: roster.length, roster: roster, att: att, fees: fees });
  });
  const noSub = DataService.getBatches().filter(b => b.status === "Active" && !DataService.getSubclasses({ batchId: b.id }).length);

  return '' +
  '<div class="note">A sub-class is a smaller group inside a batch — Group A / Group B, boys / girls, or a level split. ' +
  'Each one keeps its own teacher, timing, roster and fee.</div>' +
  '<div class="kpi-grid" style="margin-bottom:14px">' +
    kpi("Sub-classes", num(rows.length), num(new Set(rows.map(r => r.batchId)).size) + " parent batches") +
    kpi("Students grouped", num(rows.reduce((a, r) => a + r.students, 0))) +
    kpi("Batches not split", num(noSub.length), "running as one group") +
  '</div>' +
  '<div class="toolbar no-print"><div class="push btn-row">' +
    '<button class="btn btn-primary" data-act="sub-new">+ New sub-class</button>' + moreMenu([["sub-csv", "Download CSV"]]) + '</div></div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("subclasses", rows, {
      key: r => r.id, head: ["Sub-class", "Students"],
      title: r => esc(r.name) + " " + idchip(r.id),
      sub: r => esc([r.batchName, r.teacherName || "no teacher", (r.days || []).join(", ")].filter(Boolean).join(" · ")),
      amount: r => r.students + '<small>' + r.att.pct + '% attendance</small>',
      badge: r => (r.status || "Active") === "Active" && !r.teacherName ? badge("No teacher") : badge(r.status || "Active"),
      rowClass: r => (r.status || "Active") === "Active" && !r.teacherName ? "row-warn" : "",
      detail: r => dl([
        ["Sub-class", idchip(r.id)], ["Parent batch", esc(r.batchName) + " " + idchip(r.batchId)],
        ["Teacher", r.teacherName ? esc(r.teacherName) : badge("No teacher")], ["Class days", esc((r.days || []).join(", ") || "—")],
        ["Timing", esc((r.startTime || "—") + " – " + (r.endTime || "—"))],
        ["Students", r.students + (r.capacity ? " / " + r.capacity : "")],
        ["Monthly fee", r.monthlyFee ? money(r.monthlyFee) : "same as batch"],
        [monthShort(m) + " expected", money(r.fees.net)],
        [monthShort(m) + " collected", '<span class="in">' + money(r.fees.paid) + '</span>'],
        ["Attendance", r.att.pct + "% of " + num(r.att.total) + " marks"],
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
              { key: "att", label: "Lowest attendance", val: r => r.att.pct }],
      emptyTitle: "No sub-classes yet",
      emptyText: "Split a large batch into smaller groups so each teacher has their own roster.",
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
    field("Teacher (optional)", sel("teacherId", teacherOpts(x.teacherId, "No teacher yet"))) +
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
      amount: e => money(Logic.enrolFee(e)) + '<small>due day ' + esc(e.dueDay) + '</small>',
      badge: e => badge(e.status),
      detail: e => dl([
        ["Enrolment", idchip(e.id)], ["Student", esc(e.studentName) + " " + idchip(e.studentId)],
        ["Batch", esc(e.batchName) + " " + idchip(e.batchId)],
        ["Sub-class", e.subClassId ? esc((DataService.getSubclass(e.subClassId) || {}).name || e.subClassId) : "—"],
        ["Course", esc(e.course)], ["Teacher", esc(e.teacherName)],
        ["Joined", fmtDate(e.joiningDate)], ["Left", e.leavingDate ? fmtDate(e.leavingDate) : "—"],
        ["Monthly fee", money(Logic.enrolFee(e))], ["Due day", esc(e.dueDay)], ["Status", badge(e.status)],
        e.reason ? ["Reason", esc(e.reason)] : null, e.notes ? ["Notes", esc(e.notes)] : null
      ]) + acts(
        (e.status === "Active" ? '<button class="btn btn-sm" data-act="student-assign" data-id="' + e.studentId + '">Move to another batch</button>' +
          '<button class="btn btn-sm" data-act="enrol-fee" data-id="' + e.id + '">Fee</button>' +
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

Pages.bFees = function(){ return duePage("batch", "bFees"); };
