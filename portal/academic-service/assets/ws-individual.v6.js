"use strict";
/* Academic Service — ws-individual.v6.js. v6 (simple mode): a class shows its fixed monthly fee and its teacher — or a
   "No teacher" mark when none is set; the class log is a plain record of attendance; the Fees page is the Due date page.
   The dashboard lives in dash.v2.js. (v5: a plan opens its student or its teacher in one tap.) */
/* ==========================================================================
   INDIVIDUAL WORKSPACE
   ========================================================================== */
function hasTeacher(id){ return !!(id && DataService.getTeacher(id)); }

Pages.plans = function(){
  const f = State.plans, q = f.q.toLowerCase().trim();
  const rows = DataService.getPlans().filter(p => DataService.getStudent(p.studentId) || p.course).map(function(p){
    const st = DataService.getStudent(p.studentId), t = DataService.getTeacher(p.teacherId);
    return Object.assign({}, p, { studentName: st ? st.name : p.studentId, teacherName: t ? t.name : "", fee: Logic.planFee(p) });
  }).filter(function(p){
    if (f.status && p.status !== f.status) return false;
    if (f.teacher === "none" && hasTeacher(p.teacherId)) return false;
    if (f.teacher && f.teacher !== "none" && p.teacherId !== f.teacher) return false;
    return search(p.id + " " + p.studentId + " " + p.studentName + " " + (p.course || "") + " " + p.teacherName, q);
  });
  const noT = DataService.getPlans({ status: "Active" }).filter(p => !hasTeacher(p.teacherId)).length;

  return '' +
  (noT ? '<div class="note warn-note no-print">' + noT + ' active class' + (noT > 1 ? "es have" : " has") + ' no teacher yet. ' +
    '<button type="button" class="btn btn-sm" data-act="plans-noteacher">Show ' + (noT > 1 ? "them" : "it") + '</button></div>' : "") +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="plans.q" value="' + esc(f.q) + '" placeholder="Student, course or teacher">', "grow") +
    field("Status", sel("s", optList(["Active", "Stopped"], f.status, "All"), 'data-fset="plans.status"')) +
    field("Teacher", sel("t", '<option value="">All teachers</option><option value="none"' + (f.teacher === "none" ? " selected" : "") + '>No teacher yet</option>' +
      optList(DataService.getTeachers().filter(t => t.kind !== "staff").map(t => ({ value: t.id, label: t.name })), f.teacher), 'data-fset="plans.teacher"')) +
    '<div class="push"><button class="btn btn-primary" data-act="plan-new">+ New class</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("plans", rows, {
      key: p => p.id, head: ["Student", "Monthly fee"],
      title: p => esc(p.studentName) + " " + idchip(p.studentId),
      sub: p => esc([p.course || "No course", p.teacherName || "no teacher", (p.days || []).length ? p.days.join(" ") : "",
        p.time ? time12(p.time) : ""].filter(Boolean).join(" · ")),
      amount: p => (p.fee ? money(p.fee) : "—") + '<small>' + (p.fee ? "a month" : "fee not set") + '</small>',
      badge: p => p.status === "Active" && !hasTeacher(p.teacherId) ? badge("No teacher") : badge(p.status),
      rowClass: p => p.status === "Active" && !hasTeacher(p.teacherId) ? "row-warn" : (p.status === "Active" ? "" : "row-off"),
      detail: p => dl([
        ["Class", idchip(p.id)], ["Student", esc(p.studentName) + " " + idchip(p.studentId)],
        ["Course", esc(p.course || "—")],
        ["Teacher", hasTeacher(p.teacherId) ? esc(p.teacherName) : badge("No teacher")],
        ["Days", esc((p.days || []).join(", ") || "—")],
        ["Time", p.time ? esc(time12(p.time)) + (p.duration ? " · " + esc(p.duration) + " min" : "") : "—"],
        ["Monthly fee", p.fee ? '<b>' + money(p.fee) + '</b>' : '<span class="out">Not set</span>'], ["Due day", esc(p.dueDay || "—")],
        ["Started", fmtDate(p.startDate)], p.endDate ? ["Ended", fmtDate(p.endDate)] : null, ["Status", badge(p.status)],
        p.stopReason ? ["Why stopped", esc(p.stopReason)] : null, p.notes ? ["Notes", esc(p.notes)] : null
      ]) + acts('<button class="btn btn-sm btn-primary" data-act="plan-edit" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn btn-sm" data-act="profile-open" data-id="' + p.studentId + '">Student</button>' +
        (p.teacherId ? '<button class="btn btn-sm" data-act="teacher-open" data-id="' + p.teacherId + '">Teacher</button>' : "") +
        '<button class="btn btn-sm" data-act="goto" data-page="iAtt">Attendance</button>'),
      sorts: [{ key: "name", label: "Student name A–Z", val: p => p.studentName },
              { key: "sid", label: "Student ID", val: p => p.studentId },
              { key: "startNew", label: "Started — newest first", val: p => p.startDate || "", desc: true },
              { key: "teacher", label: "Teacher", val: p => p.teacherName || "" },
              { key: "fee", label: "Highest fee first", val: p => p.fee, desc: true }],
      emptyTitle: "No classes match", emptyText: "Arrange a class for a student — it can also be done while adding the student.",
      emptyAction: '<button class="btn btn-primary" data-act="plan-new">+ New class</button>'
    }) +
  '</div></div>';
};

Pages.classes = function(){
  const f = State.classes, q = f.q.toLowerCase().trim();
  const m = f.month || State.month;
  const rows = DataService.getClasses({ month: m }).map(function(c){
    const s = DataService.getStudent(c.studentId), t = DataService.getTeacher(c.teacherId);
    const p = DataService.getPlan(c.planId);
    return Object.assign({}, c, { studentName: s ? s.name : c.studentId, teacherName: t ? t.name : (c.teacherId || "—"),
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
    field("Status", sel("q", optList(CLASS_STATUSES.map(x => x.value), f.status, "All"), 'data-fset="classes.status"')) +
    '<div class="push btn-row">' +
      '<button class="btn btn-primary" data-act="goto" data-page="iAtt">Open attendance</button>' +
      moreMenu([["classes-csv", "Download CSV"]]) +
    '</div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Marked", num(st.total)) + kpi("Class taken", num(st.completed), "", "a-ok") +
    kpi("Student absent", num(st.studentAbsent), "", "a-bad") + kpi("Teacher leave", num(st.teacherAbsent), "", "a-warn") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("classes", rows, {
      key: c => c.id, head: ["Class", "Duration"],
      title: c => fmtDate(c.date) + " · " + esc(c.studentName),
      sub: c => esc(c.teacherName + (c.course ? " · " + c.course : "")),
      amount: c => (c.duration ? c.duration + " min" : "—"),
      badge: c => badge(c.status),
      detail: c => dl([["Mark", idchip(c.id)], ["Date", fmtDate(c.date)],
        ["Student", esc(c.studentName) + " " + idchip(c.studentId)], ["Teacher", esc(c.teacherName)],
        ["Course", esc(c.course || "—")], ["Duration", c.duration ? c.duration + " min" : "—"],
        ["Status", badge(c.status)], c.notes ? ["Notes", esc(c.notes)] : null]) +
        acts('<button class="btn btn-sm" data-act="class-edit" data-id="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-act="class-del" data-id="' + c.id + '">Remove</button>' +
          '<button class="btn btn-sm" data-act="profile-open" data-id="' + c.studentId + '">Open student</button>'),
      sorts: [{ key: "date", label: "Newest first", val: c => c.date + c.id, desc: true },
              { key: "name", label: "Student name", val: c => c.studentName }],
      emptyTitle: "Nothing marked in " + monthLabel(m),
      emptyText: "Attendance is marked on the Attendance page. It is a record only — fees and salaries do not change.",
      emptyAction: '<button class="btn btn-primary" data-act="goto" data-page="iAtt">Open attendance</button>'
    }) +
  '</div></div>';
};

Pages.iFees = function(){ return duePage("individual", "iFees"); };
