"use strict";
/* Academic Service — ws-books.v15.js. v15 (simple mode): no teacher pay is worked out any more — Teachers and Other staff
   list who they teach and what salary was entered; Money → Teacher salary is where salaries are typed in by hand; a
   student with no class arranged shows "Class pending", a class with no teacher shows "No teacher"; the Due date page for
   both streams; Settings keeps only what is still used. The dashboard lives in dash.v2.js.
   (v14: profiles for students and teachers, Remove for mistaken entries, CSV / Print under ⋯.) */
/* ==========================================================================
   BOOKS WORKSPACE
   ========================================================================== */
Pages.dues = function(){ return duePage("", "dues"); };

Pages.students = function(){
  const f = State.students, q = f.q.toLowerCase().trim(), m = State.month;
  const conflicts = DataService.statusConflicts ? DataService.statusConflicts() : [];
  const rows = DataService.getStudents().map(function(s){
    const str = Logic.streamsOf(s.id), ci = Logic.classInfo(s.id);
    const fees = Logic.feeViews({ studentId: s.id, month: m });
    const due = Logic.feeViews({ studentId: s.id }).reduce((a, v) => a + v.balance, 0);
    const b = str.batch ? DataService.getBatch(str.batch.batchId) : null;
    const t = str.individual ? DataService.getTeacher(str.individual.teacherId) : (b ? DataService.getTeacher(b.teacherId) : null);
    return Object.assign({}, s, { str: str, ci: ci, due: due, batch: b, teacher: t,
      monthFee: fees.reduce((a, v) => a + v.netFee, 0),
      pending: (s.status || "Active") === "Active" && ci.pending, noTeacher: (s.status || "Active") === "Active" && !ci.pending && ci.noTeacher });
  }).filter(function(s){
    if (f.status && s.status !== f.status) return false;
    if (f.stream === "batch" && !s.str.batch) return false;
    if (f.stream === "individual" && !s.str.individual) return false;
    if (f.cls === "pending" && !s.pending) return false;
    if (f.cls === "noteacher" && !s.noTeacher) return false;
    return search(s.id + " " + s.name + " " + s.phone + " " + s.whatsapp + " " + (s.guardian || ""), q);
  });
  const nPend = DataService.getStudents().filter(s => (s.status || "Active") === "Active" && Logic.classInfo(s.id).pending).length;

  return '' +
  (conflicts.length ? '<div class="note warn-note no-print">' + conflicts.length + ' student' + (conflicts.length > 1 ? "s are" : " is") +
    ' not Active but still ha' + (conflicts.length > 1 ? "ve" : "s") + ' a running class (' + esc(conflicts.slice(0, 4).map(x => x.name).join(", ")) +
    (conflicts.length > 4 ? "…" : "") + '). <button type="button" class="btn btn-sm btn-primary" data-act="status-fix">Close those classes</button></div>' : "") +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="students.q" value="' + esc(f.q) + '" placeholder="Name, ID, phone or WhatsApp">', "grow") +
    field("Status", sel("s", optList(Settings().studentStatuses, f.status, "All"), 'data-fset="students.status"')) +
    field("Class", sel("c", optList([{ value: "pending", label: "Class pending" + (nPend ? " (" + nPend + ")" : "") },
      { value: "noteacher", label: "No teacher" }], f.cls, "All classes"), 'data-fset="students.cls"')) +
    field("Stream", sel("st", optList([{ value: "batch", label: "In a batch" }, { value: "individual", label: "Individual classes" }],
      f.stream, "All streams"), 'data-fset="students.stream"')) +
    '<div class="push btn-row">' +
      '<button class="btn btn-primary" data-act="student-new">+ Add student</button>' +
      moreMenu([["students-csv", "Download CSV"]]) +
    '</div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("students", rows, {
      key: s => s.id, head: ["Student", monthShort(m) + " fee"], go: s => ({ act: "profile-open", id: s.id }),
      title: s => esc(s.name) + " " + idchip(s.id),
      sub: s => esc([s.str.batch ? (s.batch ? s.batch.name : s.str.batch.batchId) : null,
                 s.str.individual ? (s.str.individual.course || "Individual class") : null,
                 s.teacher ? s.teacher.name : null,
                 s.pending ? "no class arranged yet" : null].filter(Boolean).join(" · ")),
      amount: s => (s.monthFee ? money(s.monthFee) : "—") + (s.due ? '<small class="out">' + money(s.due) + ' due</small>' : '<small>settled</small>'),
      badge: s => s.pending ? badge("Class pending") : s.noTeacher ? badge("No teacher") :
                  (s.status || "Active") !== "Active" ? badge(s.status) :
                  (s.str.batch && s.str.individual) ? '<span class="badge b-acc">Both</span>' :
                  s.str.batch ? streamChip("batch") : streamChip("individual"),
      rowClass: s => s.pending || s.noTeacher ? "row-warn" : s.due > 0 ? "row-bad" : "",
      sorts: [{ key: "name", label: "Name A–Z", val: s => s.name },
              { key: "nameZ", label: "Name Z–A", val: s => s.name, desc: true },
              { key: "idNew", label: "Newest first", val: s => s.id, desc: true },
              { key: "id", label: "Oldest first", val: s => s.id },
              { key: "joinNew", label: "Joined — newest first", val: s => s.joiningDate || "", desc: true },
              { key: "due", label: "Most outstanding first", val: s => s.due, desc: true }],
      emptyTitle: "No students match", emptyText: "Change the filters, or add the student.",
      emptyAction: '<button class="btn btn-primary" data-act="student-new">+ Add student</button>'
    }) +
  '</div></div>';
};

/* salary paid to a teacher in a month (by "for month"), and in all */
function salaryPaid(teacherId, month){
  return round2(DataService.getTeacherPayments(month ? { teacherId: teacherId, month: month } : { teacherId: teacherId })
    .reduce((a, p) => a + (+p.amount || 0), 0));
}
function peopleList(kind){
  const key = kind === "staff" ? "staff" : "teachers", q = State[key].q.toLowerCase().trim(), m = State.month;
  const rows = DataService.getTeachers().filter(t => kind === "staff" ? t.kind === "staff" : t.kind !== "staff").map(function(t){
    return Object.assign({}, t, { plans: DataService.getPlans({ teacherId: t.id, status: "Active" }),
      batches: DataService.getBatches().filter(b => b.teacherId === t.id && (b.status || "Active") === "Active"),
      paid: salaryPaid(t.id, m) });
  }).filter(t => search(t.id + " " + t.name + " " + (t.phone || "") + " " + (t.role || ""), q));
  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="' + key + '.q" value="' + esc(State[key].q) + '" placeholder="Name' + (kind === "staff" ? ", role" : "") + ' or ID">', "grow") +
    '<div class="push btn-row"><button class="btn btn-primary" data-act="' + (kind === "staff" ? "staff-new" : "teacher-new") + '">+ Add ' + (kind === "staff" ? "staff" : "teacher") + '</button>' +
      '<button class="btn" data-act="tsal-new">+ Add salary</button></div>' +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList(key, rows, {
      key: t => t.id, head: [kind === "staff" ? "Staff" : "Teacher", monthShort(m) + " salary"], go: t => ({ act: "teacher-open", id: t.id }),
      title: t => esc(t.name) + " " + idchip(t.id),
      sub: t => esc(kind === "staff" ? (t.role || "Staff") : [t.plans.length ? t.plans.length + (t.plans.length === 1 ? " student" : " students") : "no students",
        t.batches.length ? t.batches.length + (t.batches.length === 1 ? " batch" : " batches") : ""].filter(Boolean).join(" · ")),
      amount: t => t.paid ? money(t.paid) + '<small>paid</small>' : '—<small>nothing entered</small>',
      badge: t => badge(t.status || "Active"),
      sorts: [{ key: "name", label: "Name A–Z", val: t => t.name },
              { key: "idNew", label: "Newest first", val: t => t.id, desc: true },
              { key: "students", label: "Most students first", val: t => t.plans.length + t.batches.length, desc: true },
              { key: "paid", label: "Highest salary first", val: t => t.paid, desc: true }],
      emptyTitle: kind === "staff" ? "No other staff yet" : "No teachers yet", emptyText: "",
      emptyAction: '<button class="btn btn-primary" data-act="' + (kind === "staff" ? "staff-new" : "teacher-new") + '">+ Add ' + (kind === "staff" ? "staff" : "teacher") + '</button>'
    }) +
  '</div></div>';
}
Pages.teachers = function(){ return peopleList("teacher"); };
Pages.staff = function(){ return peopleList("staff"); };

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
    '<div class="push btn-row"><button class="btn btn-primary" data-act="pay-new">+ Record payment</button>' +
      moreMenu([["pays-csv", "Download CSV"]]) + '</div>' +
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
            '<button class="btn btn-sm" data-act="profile-open" data-id="' + x.studentId + '">Open student</button>' +
            moreMenu([["pay-void", "Remove (entered by mistake)", ' data-id="' + x.id + '"', "danger"],
                      ["refund-new", "Refund (money given back)", ' data-id="' + x.id + '"']], "Fix…"));
      },
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true },
              { key: "name", label: "Student name", val: x => x.studentName }],
      emptyTitle: "No payments match", emptyText: "Record the first payment — the ledger and balances follow by themselves.",
      emptyAction: '<button class="btn btn-primary" data-act="pay-new">+ Record payment</button>'
    }) +
  '</div></div>' +
  voidedSection(DataService.getPayments({ voided: true }).filter(x => !p.month || x.month === p.month).map(function(x){
      const s = DataService.getStudent(x.studentId);
      return Object.assign({}, x, { who: s ? s.name : x.studentId });
    }), "paysVoid") +
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
  '<p class="tagline" style="margin:0 0 10px">Only money earned outside class fees — class fees are under Fees received.</p>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="income.q" value="' + esc(f.q) + '" placeholder="Description, source or ID">', "grow") +
    field("Month", sel("m", monthOpts(f.month, "All months"), 'data-fset="income.month"')) +
    field("Category", sel("c", optList(Settings().incomeCategories, f.category, "All categories"), 'data-fset="income.category"')) +
    '<div class="push btn-row"><button class="btn btn-primary" data-act="inc-new">+ Add income</button>' +
      moreMenu([["income-csv", "Download CSV"]]) + '</div>' +
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
        acts('<button class="btn btn-sm" data-act="inc-edit" data-id="' + x.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-act="inc-void" data-id="' + x.id + '">Remove (entered by mistake)</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true }],
      emptyTitle: "No other income recorded", emptyText: "Admission fees, recorded courses, books and so on go here.",
      emptyAction: '<button class="btn btn-primary" data-act="inc-new">+ Add income</button>'
    }) +
  '</div></div>' +
  voidedSection(DataService.getIncome({ voided: true }).map(x => Object.assign({}, x, { who: x.description || x.category })), "incVoid");
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
    '<div class="push btn-row"><button class="btn btn-primary" data-act="exp-new">+ Add expense</button>' +
      moreMenu([["expenses-csv", "Download CSV"]]) + '</div>' +
  '</div>' +
  '<div class="grid-2" style="margin-bottom:12px">' +
    '<div class="kpi-grid">' +
      kpi("Expenses listed", money(total), num(rows.length) + " entries", "a-bad") +
      kpi("Teacher salary", money(tp), "under Teacher salary") +
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
        acts('<button class="btn btn-sm" data-act="exp-edit" data-id="' + x.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-act="exp-void" data-id="' + x.id + '">Remove (entered by mistake)</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true }],
      emptyTitle: "No expenses recorded", emptyText: "Add the first expense — it comes off the account you choose.",
      emptyAction: '<button class="btn btn-primary" data-act="exp-new">+ Add expense</button>'
    }) +
  '</div></div>' +
  voidedSection(DataService.getExpenses({ voided: true }).map(x => Object.assign({}, x, { who: x.description || x.category })), "expVoid");
};

/* ---- Teacher salary: typed in by hand, one entry per payment ---- */
Pages.tsalary = function(){
  const f = State.tsal, q = String(f.q || "").toLowerCase().trim();
  const m = f.month === "all" ? "" : (f.month || State.month);
  const rows = DataService.getTeacherPayments(m ? { month: m } : undefined).map(function(x){
    const t = DataService.getTeacher(x.teacherId);
    return Object.assign({}, x, { teacherName: t ? t.name : x.teacherId, role: t ? (t.kind === "staff" ? (t.role || "Staff") : "Teacher") : "" });
  }).filter(x => search(x.id + " " + x.teacherName + " " + (x.remarks || "") + " " + (x.category || ""), q));
  const total = round2(rows.reduce((a, x) => a + (+x.amount || 0), 0));
  const people = new Set(rows.map(x => x.teacherId)).size;
  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="tsal.q" value="' + esc(f.q || "") + '" placeholder="Teacher, note or ID">', "grow") +
    field("For month", sel("m", '<option value="all"' + (f.month === "all" ? " selected" : "") + '>All months</option>' + monthOpts(m || "", ""), 'data-fset="tsal.month"')) +
    '<div class="push btn-row"><button class="btn btn-primary" data-act="tsal-new">+ Add salary</button>' +
      moreMenu([["tsal-csv", "Download CSV"], ["print", "Print"]]) + '</div>' +
  '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Salary paid", money(total), m ? esc(monthLabel(m)) : "all months", "a-bad") +
    kpi("Entries", num(rows.length)) + kpi("People paid", num(people)) +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    renderList("tsal", rows, {
      key: x => x.id, head: ["Paid to", "Amount"],
      title: x => esc(x.teacherName) + " · " + esc(monthShort(x.month)),
      sub: x => esc([fmtDate(x.date), x.account, x.category && x.category !== "Teacher Payment" ? x.category.replace("Teacher ", "") : "", x.remarks].filter(Boolean).join(" · ")),
      amount: x => '<span class="out">' + money(x.amount) + '</span>',
      badge: x => badge(x.role || "Teacher", { "Teacher": "b-info" }),
      detail: x => dl([["Entry", idchip(x.id)], ["Paid to", esc(x.teacherName) + " " + idchip(x.teacherId)],
        ["For month", monthLabel(x.month)], ["Date paid", fmtDate(x.date)], ["Amount", '<b>' + money(x.amount) + '</b>'],
        ["Paid from", badge(x.account)], ["Type", esc(x.category || "Teacher Payment")], x.remarks ? ["Note", esc(x.remarks)] : null]) +
        acts('<button class="btn btn-sm" data-act="tsal-edit" data-id="' + x.id + '">Edit</button>' +
          '<button class="btn btn-sm" data-act="teacher-open" data-id="' + x.teacherId + '">Open teacher</button>' +
          '<button class="btn btn-sm btn-danger" data-act="tpay-void" data-id="' + x.id + '">Remove (entered by mistake)</button>'),
      sorts: [{ key: "date", label: "Newest first", val: x => x.date + x.id, desc: true },
              { key: "name", label: "Name", val: x => x.teacherName },
              { key: "amt", label: "Largest first", val: x => +x.amount, desc: true }],
      emptyTitle: "No salary entered" + (m ? " for " + monthLabel(m) : ""), emptyText: "Type in each salary as you pay it.",
      emptyAction: '<button class="btn btn-primary" data-act="tsal-new">+ Add salary</button>'
    }) +
  '</div></div>' +
  voidedSection(DataService.getTeacherPayments(m ? { voided: true, month: m } : { voided: true }).map(function(x){
    const t = DataService.getTeacher(x.teacherId);
    return Object.assign({}, x, { who: t ? t.name : x.teacherId });
  }), "tsalVoid");
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
  '<p class="tagline" style="margin:0 0 10px">Built by itself from what you record. To correct a line, remove or edit the entry it came from.</p>' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="ledger.q" value="' + esc(f.q) + '" placeholder="Description, ID or reference">', "grow") +
    field("Type", sel("t", optList(["Student Payment","Other Income","Expense","Teacher Payment","Refund","Transfer"], f.type, "All types"), 'data-fset="ledger.type"')) +
    field("Stream", sel("s", optList([{ value: "batch", label: "Batch" }, { value: "individual", label: "Individual" },
      { value: "other", label: "Not class fees" }], f.source, "All"), 'data-fset="ledger.source"')) +
    field("Account", sel("a", accountOpts(f.account, "All accounts"), 'data-fset="ledger.account"')) +
    field("From", '<input class="input" type="date" data-fset="ledger.from" value="' + esc(f.from) + '">') +
    field("To", '<input class="input" type="date" data-fset="ledger.to" value="' + esc(f.to) + '">') +
    '<div class="push btn-row">' + moreMenu([["ledger-csv", "Download CSV"], ["print", "Print"]]) + '</div>' +
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
  { id: "salary", n: "08", label: "Teacher salary paid" },
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

  if (R.which === "salary") {
    const by = {};
    DataService.getTeacherPayments().filter(p => p.date >= rg.from && p.date <= rg.to).forEach(function(p){
      const t = DataService.getTeacher(p.teacherId);
      const k = p.teacherId; by[k] = by[k] || { id: k, name: t ? t.name : k, total: 0, n: 0, items: [] };
      by[k].total += +p.amount || 0; by[k].n++; by[k].items.push(p);
    });
    const rows = Object.keys(by).map(k => by[k]).sort((a, b) => b.total - a.total);
    return { title: "Teacher salary paid", sub: rg.label,
      cards: [["Paid", money(rows.reduce((s, x) => s + x.total, 0)), "a-bad"], ["People", num(rows.length), ""],
              ["Entries", num(rows.reduce((s, x) => s + x.n, 0)), ""]],
      rows: rows,
      list: { key: x => x.id, title: x => esc(x.name), sub: x => x.n + " entr" + (x.n === 1 ? "y" : "ies"),
        amount: x => '<span class="out">' + money(x.total) + '</span>',
        detail: x => x.items.map(i => '<div class="minirow"><span>' + esc(fmtDate(i.date)) + ' · for ' + esc(monthLabel(i.month)) + ' · ' + esc(i.account || "") +
          '</span><b class="out">' + money(i.amount) + '</b></div>').join("") },
      csv: { headers: ["Teacher ID", "Teacher", "Entries", "Paid"], rows: rows.map(x => [x.id, x.name, x.n, round2(x.total)]) } };
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
      if (v.waived) return;
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
    body = feeRowList("pfFees", fees, { emptyTitle: "No fees yet", emptyText: "A fee row appears when the month's list is made on Due date." });
  } else if (p.tab === "payments") {
    body = renderList("pfPays", DataService.getPayments({ studentId: s.id }), {
      key: x => x.id, title: x => monthLabel(x.month) + " · " + money(x.amount),
      sub: x => fmtDate(x.date) + " · " + esc(x.account) + " · " + esc(x.id),
      amount: x => '<span class="in">' + money(x.amount) + '</span>', badge: x => streamChip(x.source),
      detail: x => dl([["Payment", idchip(x.id)], ["Date", fmtDate(x.date)], ["Stream", streamChip(x.source)],
        ["Fee month", monthLabel(x.month)], ["Amount", money(x.amount)], ["Account", badge(x.account)],
        ["Transaction", esc(x.txnId || "—")]]) +
        acts('<button class="btn btn-sm" data-act="receipt" data-id="' + x.id + '">Receipt</button>' +
          moreMenu([["pay-void", "Remove (entered by mistake)", ' data-id="' + x.id + '"', "danger"],
                    ["refund-new", "Refund (money given back)", ' data-id="' + x.id + '"']], "Fix…")),
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
      emptyTitle: "Nothing marked yet", emptyText: "Attendance marks for individual classes show here." });
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
      amount: x => money(x.kind === "Batch" ? Logic.enrolFee(x) : x.rate), badge: x => badge(x.status),
      detail: x => x.kind === "Batch"
        ? dl([["Enrolment", idchip(x.id)], ["Batch", esc(x.batchId)], ["Joined", fmtDate(x.joiningDate)],
            ["Left", x.leavingDate ? fmtDate(x.leavingDate) : "—"], ["Monthly fee", money(x.monthlyFee)],
            ["Due day", esc(x.dueDay)], ["Status", badge(x.status)], x.reason ? ["Reason", esc(x.reason)] : null])
        : dl([["Class", idchip(x.id)], ["Course", esc(x.course)], ["Monthly fee", money(x.rate)],
            ["Days", esc((x.days || []).join(", ") || "—")], ["Started", fmtDate(x.startDate)],
            x.endDate ? ["Ended", fmtDate(x.endDate)] : null, ["Status", badge(x.status)], x.stopReason ? ["Why", esc(x.stopReason)] : null]),
      emptyTitle: "No history", emptyText: "" });
  }

  /* v14: the student's class plans, each with Edit — the place to change a fee, a teacher, days, or to stop a class */
  const plansAll = DataService.getPlans({ studentId: s.id }).slice().sort((a, b) => (a.status === "Active" ? 0 : 1) - (b.status === "Active" ? 0 : 1) || String(b.startDate || "").localeCompare(String(a.startDate || "")));
  const holds = DataService.getHolds({ studentId: s.id });
  const ci = Logic.classInfo(s.id), active = (s.status || "Active") === "Active";
  const classesCard = '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Classes</h3>' +
      (active && ci.pending ? ' ' + badge("Class pending") : "") + '<span class="spacer"></span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-act="plan-new" data-id="' + s.id + '">+ Individual class</button>' +
      '<button type="button" class="btn btn-sm" data-act="student-assign" data-id="' + s.id + '">' + (str.batch ? "Change batch" : "+ Batch") + '</button></div><div class="card-bd">' +
    (plansAll.length ? plansAll.map(function(x){
      const t = DataService.getTeacher(x.teacherId);
      return '<div class="pf-plan' + (x.status === "Active" ? "" : " off") + '"><div class="pf-pm"><b>' + esc(x.course || "Class") + '</b> ' +
        (x.status === "Active" && !t ? badge("No teacher") : badge(x.status)) +
        '<small>' + esc([t ? t.name : "no teacher yet", (+x.rate ? money(x.rate) + " a month" : "fee not set"), (x.days || []).length ? x.days.join(" ") + (x.time ? " · " + time12(x.time) : "") : "",
          x.status === "Active" ? "since " + fmtDate(x.startDate) : "ended " + fmtDate(x.endDate)].filter(Boolean).join(" · ")) + '</small></div>' +
        '<div class="btn-row">' + (t ? '<button type="button" class="btn btn-sm" data-act="teacher-open" data-id="' + esc(t.id) + '">Teacher</button>' : "") +
          '<button type="button" class="btn btn-sm btn-primary" data-act="plan-edit" data-id="' + esc(x.id) + '">Edit</button></div></div>';
    }).join("") : "") +
    (str.batch ? '<div class="pf-plan"><div class="pf-pm"><b>' + esc(batch ? batch.name : str.batch.batchId) + '</b> ' +
      (batch && !batch.teacherId ? badge("No teacher") : streamChip("batch")) +
      '<small>' + esc("Batch · " + money(Logic.enrolFee(str.batch)) + " a month · due day " + (str.batch.dueDay || "—")) + '</small></div>' +
      '<div class="btn-row"><button type="button" class="btn btn-sm" data-act="enrol-fee" data-id="' + esc(str.batch.id) + '">Fee</button></div></div>' : "") +
    (!plansAll.length && !str.batch ? '<p class="hint" style="margin:0">' + (active ? "No class arranged yet — add an individual class or put the student in a batch." : "No class.") + '</p>' : "") +
    (holds.length ? '<div class="sub-hd">Holds / leave</div>' + holds.map(h => '<div class="minirow"><span>⏸ ' + esc(h.from) + " → " + esc(h.to || "open") +
        (h.reason ? " · " + esc(h.reason) : "") + '</span><b>' + (h.waiveFee ? "fee waived" : "fee kept") +
        ' <button class="btn btn-sm" data-act="hold-del" data-id="' + h.id + '">✕</button></b></div>').join("") : "") +
    '</div></div>';

  return '' +
  '<div class="btn-row no-print pf-acts" style="margin-bottom:12px">' +
    '<button class="btn" data-act="goto" data-page="students">← Students</button>' +
    (dueAll > 0 ? '<button class="btn btn-primary" data-act="pay-for" data-id="' + s.id + '">Take payment</button>' +
      '<button class="btn btn-wa" data-act="wa-student" data-id="' + s.id + '">WhatsApp</button>' : "") +
    '<button class="btn" data-act="student-edit" data-id="' + s.id + '">Edit</button>' +
    moreMenu([dueAll > 0 ? null : ["pay-for", "Take a payment", ' data-id="' + s.id + '"'],
      ["hold-new", "⏸ Hold / leave", ' data-id="' + s.id + '"'],

      ["welcome", "Welcome letter", ' data-id="' + s.id + '"'],
      ["rep-statement", "Statement", ' data-id="' + s.id + '"'], ["print", "Print"]]) +
  '</div>' +
  '<div class="card"><div class="card-bd"><div class="profile-hd">' +
    '<div class="avatar">' + esc(s.name.slice(0, 1)) + '</div>' +
    '<div style="flex:1 1 280px"><h2 style="font-size:20px">' + esc(s.name) + '</h2>' +
      '<div style="margin:4px 0 10px">' + idchip(s.id) + ' ' + badge(s.status) + ' ' +
        (str.batch ? streamChip("batch") : "") + " " + (str.individual ? streamChip("individual") : "") + '</div>' +
      '<dl class="deflist">' +
        [["Guardian", esc(s.guardian || "—")], ["Phone", '<span class="mono">' + esc(s.phone || "—") + '</span>'],
         ["WhatsApp", '<span class="mono">' + esc(s.whatsapp || "—") + '</span>'],
         ["Batch", str.batch ? esc(batch ? batch.name : str.batch.batchId) + " · " + money(Logic.enrolFee(str.batch)) : "Not in a batch"],
         ["Individual class", str.individual ? esc(str.individual.course || "Class") + " · " + money(str.individual.rate) + " a month" : "None"],
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
      '<div class="kv"><span>Classes taken</span><b>' + cs.completed + '</b></div>' +
      (att.total ? '<div class="kv"><span>Batch attendance</span><b>' + att.pct + '%</b></div>' : "") +
    '</div>' +
  '</div></div></div>' +
  classesCard +
  '<div class="card" style="margin-top:12px"><div class="card-hd" style="padding-bottom:0;border:0"><div class="tabs" style="width:100%">' +
    ["fees|Fees", "payments|Payments", "calendar|Attendance", "classes|Class log", "history|History"]
      .map(function(t){ const x = t.split("|");
        return '<button class="tab ' + (p.tab === x[0] ? "is-on" : "") + '" data-act="pf-tab" data-t="' + x[0] + '">' + x[1] + '</button>'; })
      .join("") + '</div></div><div class="card-bd tight">' + body + '</div></div>';
};

/* ---------------------------- TEACHER PROFILE ---------------------------- */
Pages.tprofile = function(){
  const P = State.tprofile, t = DataService.getTeacher(P.teacherId), m = State.month;
  if (!t) return '<div class="empty"><h4>Pick a teacher</h4><p>Open a teacher from the Teachers page.</p>' +
    '<button class="btn btn-primary" data-act="goto" data-page="teachers">Go to teachers</button></div>';
  const staff = t.kind === "staff";
  const plans = DataService.getPlans({ teacherId: t.id }).slice().sort(function(a, b){
    const x = (a.status === "Active" ? 0 : 1) - (b.status === "Active" ? 0 : 1); if (x) return x;
    return String((DataService.getStudent(a.studentId) || {}).name || "").localeCompare(String((DataService.getStudent(b.studentId) || {}).name || ""));
  });
  const active = plans.filter(x => x.status === "Active");
  const batches = DataService.getBatches().filter(b => b.teacherId === t.id && (b.status || "Active") === "Active");
  const pays = DataService.getTeacherPayments({ teacherId: t.id }).slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
  const tab = P.tab === "payments" ? "payments" : "students";
  let body = "";
  if (tab === "payments") body = renderList("tpPays", pays, {
      key: x => x.id, title: x => esc(monthLabel(x.month)) + " · " + money(x.amount),
      sub: x => esc([fmtDate(x.date), x.account, x.category && x.category !== "Teacher Payment" ? x.category : "", x.remarks].filter(Boolean).join(" · ")),
      amount: x => '<span class="out">' + money(x.amount) + '</span>',
      detail: x => dl([["Entry", idchip(x.id)], ["For month", monthLabel(x.month)], ["Date paid", fmtDate(x.date)], ["Amount", money(x.amount)],
          ["Paid from", badge(x.account)], ["Type", esc(x.category || "Teacher Payment")], x.remarks ? ["Note", esc(x.remarks)] : null]) +
        acts('<button class="btn btn-sm" data-act="tsal-edit" data-id="' + x.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger" data-act="tpay-void" data-id="' + x.id + '">Remove (entered by mistake)</button>'),
      emptyTitle: "No salary entered yet", emptyText: "Salary paid to " + t.name + " shows here." });
  else body = '<div class="card-bd">' + (plans.length ? plans.map(function(x){
      const s2 = DataService.getStudent(x.studentId) || {};
      return '<div class="pf-plan' + (x.status === "Active" ? "" : " off") + '"><div class="pf-pm"><b>' + esc(s2.name || x.studentId) + '</b> ' + badge(x.status) +
        '<small>' + esc([x.course, (x.days || []).length ? x.days.join(" ") : "", x.time ? time12(x.time) : "", x.duration ? x.duration + " min" : ""]
          .filter(Boolean).join(" · ")) + '</small></div>' +
        '<div class="btn-row"><button type="button" class="btn btn-sm" data-act="profile-open" data-id="' + esc(x.studentId) + '">Student</button>' +
          '<button type="button" class="btn btn-sm btn-primary" data-act="plan-edit" data-id="' + esc(x.id) + '">Edit</button></div></div>';
    }).join("") : '<p class="hint" style="margin:0">' + (staff ? "Staff do not teach individual classes." : "No students yet.") + '</p>') +
    (batches.length ? '<div class="sub-hd">Batches</div>' + batches.map(b => '<div class="minirow"><span>' + esc(b.name) + '</span><b>' + esc(b.course || "") + '</b></div>').join("") : "") +
    '</div>';

  return '' +
  '<div class="btn-row no-print pf-acts" style="margin-bottom:12px">' +
    '<button class="btn" data-act="tp-back">← Back</button>' +
    '<button class="btn btn-primary" data-act="tsal-new" data-id="' + t.id + '">+ Add salary</button>' +
    '<button class="btn" data-act="teacher-edit" data-id="' + t.id + '">Edit</button>' +
  '</div>' +
  '<div class="card"><div class="card-bd"><div class="profile-hd">' +
    '<div class="avatar">' + esc(String(t.name || "?").slice(0, 1)) + '</div>' +
    '<div style="flex:1 1 280px"><h2 style="font-size:20px">' + esc(t.name) + '</h2>' +
      '<div style="margin:4px 0 10px">' + idchip(t.id) + ' ' + badge(t.status || "Active") + ' <span class="tag">' + esc(staff ? (t.role || "Staff") : "Teacher") + '</span></div>' +
      '<dl class="deflist">' +
        [["Phone", '<span class="mono">' + esc(t.phone || "—") + '</span>'], ["WhatsApp", '<span class="mono">' + esc(t.whatsapp || "—") + '</span>'],
         ["Joined", fmtDate(t.joiningDate)], ["Paid into", esc(t.payAccount || "—")],
         staff ? null : ["Students", active.length + " active" + (batches.length ? " · " + batches.length + " batch" + (batches.length > 1 ? "es" : "") : "")]]
        .filter(Boolean).map(x => '<div><dt>' + esc(x[0]) + '</dt><dd>' + x[1] + '</dd></div>').join("") +
      '</dl></div>' +
    '<div style="flex:0 0 210px;min-width:190px">' +
      '<div class="section-title" style="margin:0 0 5px">Salary</div>' +
      '<div class="kv"><span>' + esc(monthLabel(m)) + '</span><b>' + money(salaryPaid(t.id, m)) + '</b></div>' +
      '<div class="kv"><span>All months</span><b>' + money(salaryPaid(t.id)) + '</b></div>' +
    '</div>' +
  '</div></div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd" style="padding-bottom:0;border:0"><div class="tabs" style="width:100%">' +
    [["students", staff ? "Work" : "Students"], ["payments", "Salary paid"]].map(x =>
      '<button class="tab ' + (tab === x[0] ? "is-on" : "") + '" data-act="tp-tab" data-t="' + x[0] + '">' + esc(x[1]) + '</button>').join("") +
  '</div></div><div class="card-bd tight">' + body + '</div></div>';
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
      '<div style="margin:0 auto 18px; max-width:540px; color:#eafff2; font-size:14px; line-height:1.5; background:rgba(0,0,0,.18); padding:12px 16px; border-radius:12px">Supabase is the live database — every change is saved there within a second. The Google Sheet is a one-way backup copy: the app sends to it but never reads from it.</div>' +
      '<div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center; align-items:center">' +
        '<button class="btn" data-act="sync-full" style="padding:15px 24px; font-size:15px">⬆️ Send everything to the Sheet</button>' +
      '</div>' +
      '<div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(143,211,174,.2)">' +
        '<button class="btn" data-act="backup" style="font-size:13.5px">⬇️ Export backup (JSON file)</button>' +

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
    '</div>' +
    '<div class="note" style="margin-top:10px; font-size:12.5px">Every change is saved to Supabase automatically, and each device loads from it when the page opens. Tap the chip at the top to see the last save and any problem.</div>' +
    '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Google Sheets backup</h3>' +
    '<span class="spacer"></span><button class="btn btn-sm" data-act="sync-panel">Open backup panel</button></div>' +
    '<div class="card-bd">' +
    '<div class="note">Two spreadsheets sit behind this app: <b>MQ Batch</b> (classes, sub-classes, enrolment, attendance) ' +
    'and <b>MQ Individual + Books</b> (class plans, class log, fees and all the money). One Apps Script web app writes to both. ' +
    'It is a one-way backup: changes are sent a few seconds after you make them, and nothing is ever read back from the sheets.</div>' +
    '<div class="form-grid">' +
      '<div class="field span2"><label>Web app URL</label>' +
        '<input class="input" id="set_apiUrl" value="' + esc(s.apiUrl || "") + '" placeholder="https://script.google.com/macros/s/…/exec"></div>' +
      field("Shared key", '<input class="input mono" id="set_syncKey" value="' + esc(s.syncKey || "") + '" placeholder="the API_KEY from Code.gs">') +
      field("Send to the sheets every (minutes)", '<input class="input" type="number" min="1" max="60" id="set_syncEvery" value="' + esc(s.syncEvery || 3) + '"> ') +
      '<div class="field"><label>Sync</label><label style="display:flex;gap:8px;align-items:center;padding-top:9px;font-size:13.5px">' +
        '<input type="checkbox" id="set_syncOn"' + (s.syncOn ? " checked" : "") + '> Send a backup copy to the sheets</label></div>' +
      '<div class="field"><label>Teacher page address</label>' +
        '<input class="input" id="set_teacherLinkBase" value="' + esc(s.teacherLinkBase || "") + '"></div>' +
    '</div>' +
    '<div class="btn-row" style="margin-top:13px">' +
      '<button class="btn btn-primary" data-act="settings-save">Save settings</button>' +
      '<button class="btn" data-act="sync-test">Test the connection</button>' +
      '<button class="btn" data-act="sync-now">Send changes now</button>' +
      '<button class="btn" data-act="sync-full">Send everything</button>' +
    '</div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Fees</h3></div><div class="card-bd">' +
    '<div class="note">Every class has one fixed monthly fee. A month is paid before it starts, on the student\'s own day — ' +
    'someone who joined on the 22nd pays on 22 October for November. The list for a month is made with one button on Due date.</div>' +
    '<div class="form-grid">' +
      '<div class="field span2"><label>Welcome letter — terms &amp; conditions</label>' +
        '<textarea class="input" id="set_welcomeTerms" rows="5" placeholder="One line per term">' +
        esc(s.welcomeTerms || "") + '</textarea>' +
        '<span class="hint">Printed under “Terms &amp; Conditions” in the welcome letter. Leave empty to use the standard lines.</span></div>' +
    '</div>' +
    '<p class="hint" style="margin-top:8px">A ' + esc(monthLabel(addMonths(currentMonth(), 1))) +
      ' fee with due day ' + esc(s.defaultDueDay || 5) + ' falls due on <b>' + esc(fmtDate(Logic.feeDueDate(addMonths(currentMonth(), 1), s.defaultDueDay))) + '</b>.</p>' +
    '<div class="btn-row" style="margin-top:12px"><button class="btn btn-primary" data-act="settings-save">Save settings</button></div>' +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Course formats</h3></div><div class="card-bd">' +
    '<div class="note">Standard course formats — course, class days and the monthly fee. Pick one when adding a batch or a class to fill the fields.</div>' +
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
    '<p class="tagline">Attendance skips these days. Fees do not change.</p>' +
    (DataService.getHolidays().length ? DataService.getHolidays().map(h => '<span class="holchip">' +
      '<span><b>' + esc(h.name) + '</b> <span class="hd">' + esc(fmtDate(h.from) +
      (h.to && h.to !== h.from ? " – " + fmtDate(h.to) : "")) + '</span></span>' +
      '<button data-act="hol-del" data-id="' + h.id + '">×</button></span>').join("")
      : '<p class="hint">No holidays added yet.</p>') +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Lists</h3></div><div class="card-bd">' +
    listEditor("courses", "Courses") + listEditor("levels", "Levels") +
    listEditor("incomeCategories", "Income categories") + listEditor("expenseCategories", "Expense categories") +
  '</div></div>' +
  '<div class="card" style="margin-top:12px"><div class="card-hd"><h3>Data overview</h3></div><div class="card-bd">' +
    '<p class="tagline">A quick count of what is stored. Use the Data Sync &amp; Backup section at the top to import, export or back up.</p>' +
    '<div class="grid-2">' +
      '<div>' + [["Students", DB.students.length], ["Teachers", DB.teachers.length], ["Batches", DB.batches.length],
        ["Enrolments", DB.enrollments.length], ["Attendance marks", DB.attendance.length]]
        .map(x => '<div class="kv"><span>' + x[0] + '</span><b>' + num(x[1]) + '</b></div>').join("") + '</div>' +
      '<div>' + [["Individual classes", DB.plans.length], ["Attendance marks (individual)", DB.classes.length], ["Fee records", DB.fees.length],
        ["Payments", DB.payments.length], ["Expenses", DB.expenses.length]]
        .map(x => '<div class="kv"><span>' + x[0] + '</span><b>' + num(x[1]) + '</b></div>').join("") + '</div>' +
    '</div>' +
  '</div></div>';
};

/* voided payments: shown for the record, struck through, never counted */
function voidedSection(rows, lid){
  if (!rows.length) return "";
  return '<div class="section-title">Removed (' + rows.length + ')</div><div class="card"><div class="card-bd tight">' +
    renderList(lid, rows, {
      key: x => x.id,
      title: x => '<s>' + esc(x.who) + ' · ' + money(x.amount) + '</s>',
      sub: x => "removed " + fmtDate(String(x.voidAt || "").slice(0, 10)) + " · " + esc(x.voidReason || "no reason") + " · " + esc(x.id),
      amount: x => '<s class="muted">' + money(x.amount) + '</s>',
      badge: x => badge("Removed", { "Removed": "b-idle" }),
      detail: x => dl([["Payment", idchip(x.id)], ["Amount", money(x.amount)], ["Paid on", fmtDate(x.date)],
        x.month ? ["For month", monthLabel(x.month)] : null, ["Account", esc(x.account || "—")],
        ["Removed on", fmtDate(String(x.voidAt || "").slice(0, 10))], ["Reason", esc(x.voidReason || "—")]]),
      pageSize: 10
    }) + '</div></div>';
}
