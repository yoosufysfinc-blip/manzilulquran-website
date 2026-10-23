"use strict";
/* Academic Service — logic.v10.js. v10: the fee month is the month it is paid in — a student whose day is the 23rd
   pays on 23 October for October (the 23 Oct – 22 Nov cycle), and a new student pays for the month they join.
   v9 (simple mode): one fixed monthly fee per class. Fees never come from attendance —
   the month's due list is made with one button (buildIndMonth / buildBatchMonth) and every row can be changed by hand.
   Teacher salary is not calculated any more: salaries are typed in under Money → Teacher salary.
   Attendance (class log, batch attendance, the sheet) is a plain record. */
/* ==========================================================================
   LOGIC
   ========================================================================== */
const SOURCES = { batch: "Batch class", individual: "Individual class" };

/* every state a logged class can be in, and the letter shown on the attendance grid */
const CLASS_STATUSES = [
  { value: "Completed",      code: "✓", label: "Class taken" },
  { value: "Student Absent", code: "A", label: "Student absent" },
  { value: "Student Leave",  code: "L", label: "Student leave" },
  { value: "Teacher Absent", code: "T", label: "Teacher leave" },
  { value: "Substitute",     code: "S", label: "Taken by another teacher" },
  { value: "Rescheduled",    code: "R", label: "Rescheduled" },
  { value: "Cancelled",      code: "C", label: "Cancelled" }
];
const CLASS_CODE = {}; CLASS_STATUSES.forEach(x => CLASS_CODE[x.value] = x.code);
/* the attendance sheet's marks and what each one saves into the class log.
   Exam and test days are classes held (status Completed) with an activity on top.
   A note-only mark is stored with status "Note", which getClasses keeps away from fees and pay. */
const ATT_MARKS = [
  { k: "P", sym: "✓",   name: "Present",          status: "Completed",      key: "p" },
  { k: "A", sym: "✕s",  name: "Absent (student)", status: "Student Absent", key: "a" },
  { k: "T", sym: "✕t",  name: "Absent (teacher)", status: "Teacher Absent", key: "t" },
  { k: "L", sym: "Lv",  name: "Leave",            status: "Student Leave",  key: "l" },
  { k: "S", sym: "Sub", name: "Substitute class", status: "Substitute",     key: "s" },
  { k: "E", sym: "Exa", name: "Exam day",         status: "Completed", activity: "Exam", key: "e" },
  { k: "X", sym: "Test", name: "Class test",      status: "Completed", activity: "Test", key: "x" },
  { k: "N", sym: "●",   name: "Note only",        status: "Note",           key: "d" },
  { k: "R", sym: "R",   name: "Rescheduled",      status: "Rescheduled",    key: "r" },
  { k: "C", sym: "C",   name: "Cancelled",        status: "Cancelled",      key: "c" }
];
const ATT_MK = {}; ATT_MARKS.forEach(m => ATT_MK[m.k] = m);
/* the mark a class record shows as — worked out from its status, so an edit in the class log stays in step */
function markOf(c){
  if (!c) return "";
  if (c.status === "Completed") return c.activity === "Exam" ? "E" : c.activity === "Test" ? "X" : "P";
  const m = ATT_MARKS.find(x => x.status === c.status && !x.activity);
  return m ? m.k : "";
}

const Logic = {
  /* ---- class log roll-up (a record only — nothing is charged or paid from it) ---- */
  classStats(rows){
    /* held for the student = taken by their teacher or by a substitute */
    const done = rows.filter(c => c.status === "Completed" || c.status === "Substitute"), days = {};
    done.forEach(c => days[c.date] = true);
    return { total: rows.length, completed: done.length,
      cancelled: rows.filter(c => c.status === "Cancelled").length,
      studentAbsent: rows.filter(c => c.status === "Student Absent").length,
      studentLeave: rows.filter(c => c.status === "Student Leave").length,
      teacherAbsent: rows.filter(c => c.status === "Teacher Absent").length,
      substitute: rows.filter(c => c.status === "Substitute").length,
      rescheduled: rows.filter(c => c.status === "Rescheduled").length,
      days: Object.keys(days).length,
      minutes: done.reduce((s, c) => s + (+c.duration || 0), 0) };
  },
  /* ---- holidays: one list used by the range tools and by prepaid planning ---- */
  isHoliday(date){
    return (DB.holidays || []).find(h => date >= h.from && date <= (h.to || h.from)) || null;
  },
  holidayName(date){ const h = Logic.isHoliday(date); return h ? h.name : ""; },
  holidaysIn(month){
    const out = [];
    for (let i = 1; i <= daysInMonth(month); i++) {
      const ds = month + "-" + pad2(i), h = Logic.isHoliday(ds);
      if (h) out.push({ date: ds, name: h.name });
    }
    return out;
  },
  prepaid(){ return (Settings().billingMode || "prepaid") === "prepaid"; },
  /* Prepaid: the month is due BEFORE it starts. Postpaid: due inside the month.
     Prepaid has two ways of fixing the date:
       "studentDay" (default) — each student's own day in the SAME month (v10). A student who
         joined on the 22nd pays on 22 October for October (the cycle 22 Oct – 21 Nov). This is how the academy works.
       "advance" — the same date for everyone, a set number of days before the month starts. */
  feeDueDate(month, dueDay){
    if (!Logic.prepaid()) return dueDateFor(month, dueDay);
    if ((Settings().prepaidDue || "studentDay") === "studentDay") return dueDateFor(month, dueDay);
    const d = parseYMD(monthStart(month));
    d.setDate(d.getDate() - (parseInt(Settings().advanceDays, 10) || 0));
    return ymd(d);
  },
  attStats(rows){
    const s = { total: rows.length, Present: 0, Absent: 0, Leave: 0, Excused: 0 };
    rows.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
    s.pct = pct(s.Present, s.total);
    return s;
  },
  batchMeetsOn(b, d){
    if (!b || !b.days || !b.days.length) return true;
    return b.days.indexOf(DOW[parseYMD(d).getDay()]) >= 0;
  },
  rosterOf(batchId, onDate, subClassId){
    const d = onDate || today();
    return DataService.getEnrollments({ batchId: batchId }).filter(function(e){
      if (subClassId && e.subClassId !== subClassId) return false;
      if (e.joiningDate > d) return false;
      if (e.status === "Active") return true;
      return !!(e.leavingDate && e.leavingDate >= d);
    }).map(e => { const s = DataService.getStudent(e.studentId); return s ? Object.assign({}, s, { enrollment: e }) : null; })
      .filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  },

  /* ---- money on a fee record: paid = payments − refunds ---- */
  paidOn(feeId){
    const paid = Cache.paymentsFor(feeId).reduce((s, p) => s + (+p.amount || 0), 0);
    const ref = DB.refunds.filter(r => r.feeId === feeId).reduce((s, r) => s + (+r.amount || 0), 0);
    return round2(paid - ref);
  },

  /* One view function for BOTH streams. Status is always derived. */
  feeView(f){
    const st = DataService.getStudent(f.studentId);
    const te = DataService.getTeacher(f.teacherId);
    const carry = round2(+f.carry || 0);
    /* a waived month is not owed: it must drop out of the dues and the receivable, not just change its label */
    const net = f.waived ? 0 : round2(Math.max(0, (+f.gross || 0) - (+f.discount || 0) + carry));
    const paid = Logic.paidOn(f.id);
    const balance = f.waived ? 0 : round2(Math.max(0, net - paid));
    const t = today();
    let status;
    if (f.waived)                     status = "Waived";
    else if (f.needsAmount && !f.override) status = "Needs amount";
    else if (net === 0 && paid === 0) status = "Nil";
    else if (paid >= net && paid > 0) status = "Paid";
    else if (paid > 0)                status = "Partial";
    else if (t < f.dueDate)           status = "Upcoming";
    else if (t === f.dueDate)         status = "Due Today";
    else                              status = "Overdue";
    const late = (status === "Paid" || status === "Waived" || status === "Nil" || status === "Needs amount") ? 0 : Math.max(0, diffDays(f.dueDate, t));
    const pays = Cache.paymentsFor(f.id).slice().sort((a, b) => a.date < b.date ? 1 : -1);
    const batch = f.batchId ? DataService.getBatch(f.batchId) : null;
    const plan = f.planId ? DataService.getPlan(f.planId) : null;
    return Object.assign({}, f, {
      course: plan ? (plan.course || "") : (batch ? (batch.course || "") : ""),
      carry: carry, netFee: net, paidAmount: paid, balance: balance, status: status, daysOverdue: late,
      credit: round2(Math.max(0, paid - net)),
      studentName: st ? st.name : f.studentId,
      whatsapp: st ? (st.whatsapp || st.phone) : "", phone: st ? st.phone : "",
      teacherName: te ? te.name : "—",
      batchName: batch ? batch.name : "",
      streamLabel: SOURCES[f.source] || f.source,
      payments: pays, lastPayment: pays.length ? pays[0] : null
    });
  },
  feeViews(f){ return DataService.getFees(f).map(Logic.feeView); },

  summarize(views){
    const s = { count: views.length, gross: 0, discount: 0, carry: 0, net: 0, paid: 0, balance: 0, overdueAmt: 0,
      paidN: 0, partialN: 0, overdueN: 0, upcomingN: 0, dueTodayN: 0, waivedN: 0, needsN: 0, students: {} };
    views.forEach(function(v){
      s.students[v.studentId] = true;
      if (v.status === "Waived") { s.waivedN++; return; }
      if (v.status === "Needs amount") { s.needsN++; return; }
      s.gross += +v.gross || 0; s.discount += +v.discount || 0; s.carry += +v.carry || 0;
      s.net += v.netFee; s.paid += v.paidAmount; s.balance += v.balance;
      if (v.daysOverdue > 0) s.overdueAmt += v.balance;
      if (v.status === "Paid") s.paidN++;
      else if (v.status === "Partial") s.partialN++;
      else if (v.status === "Overdue") s.overdueN++;
      else if (v.status === "Due Today") s.dueTodayN++;
      else if (v.status === "Upcoming") s.upcomingN++;
    });
    ["gross","discount","carry","net","paid","balance","overdueAmt"].forEach(k => s[k] = round2(s[k]));
    s.studentCount = Object.keys(s.students).length;
    s.collectionPct = pct(s.paid, s.net);
    return s;
  },

  /* ---- the month's due list ----
     One fee row per active class: an individual class plan, or a batch enrolment (one per student).
     The amount is the class's fixed monthly fee. A row that is already there is never touched or added twice,
     a class that is stopped, a student who is not Active, or a hold that waives the fee gets no row.
     opts.dry = true only counts what would be added (nothing is saved); opts.first = the first fee of a new class
     (due on its own due day, or on the joining day when that day has already gone). */
  feeSeq(){
    let seq = 0;
    DB.fees.forEach(f => { const n = parseInt(String(f.id).replace(/\D/g, ""), 10); if (!isNaN(n) && n > seq) seq = n; });
    return seq;
  },
  planFee(pl){ return round2(+(pl && pl.rate) || 0); },
  enrolFee(en){
    const b = DataService.getBatch(en.batchId), sc = en.subClassId ? DataService.getSubclass(en.subClassId) : null;
    return round2(+en.monthlyFee || (sc ? +sc.monthlyFee : 0) || (b ? +b.monthlyFee : 0) || 0);
  },
  /* the student's own day: a month before the class started is not theirs to pay */
  dueBeforeStart(month, dueDay, start){
    return !!(start && Logic.prepaid() && (Settings().prepaidDue || "studentDay") === "studentDay" &&
      month < String(start).slice(0, 7));
  },
  buildIndMonth(month, opts){
    opts = opts || {};
    let created = 0, skipped = 0, held = 0, seq = Logic.feeSeq();
    const existing = {};
    DataService.getFees({ month: month, source: "individual" }).forEach(f => existing[f.planId] = f);
    DataService.getPlans().forEach(function(pl){
      const st = DataService.getStudent(pl.studentId);
      if (!st || pl.status !== "Active") return;
      if (opts.planId && pl.id !== opts.planId) return;
      if (existing[pl.id]) { skipped++; return; }
      if (pl.startDate && pl.startDate > monthEnd(month)) return;
      if (pl.endDate && monthOf(pl.endDate) < month) return;
      if ((st.status || "Active") !== "Active") return;
      const dueDay = pl.dueDay || Settings().defaultDueDay || 5;
      if (!opts.first && Logic.dueBeforeStart(month, dueDay, pl.startDate)) return;
      const hold = DataService.holdFor(pl.studentId, month);
      if (hold && hold.waiveFee) { held++; return; }
      created++;
      if (opts.dry) return;
      const fee = Logic.planFee(pl);
      DB.fees.push({ id: "FEE" + String(++seq).padStart(5, "0"), source: "individual", month: month, studentId: pl.studentId,
        planId: pl.id, teacherId: pl.teacherId || "", feeType: "monthly", rate: fee, gross: fee, discount: 0, carry: 0,
        needsAmount: !(fee > 0), override: false, billing: "prepaid", reconciled: false, waived: false, locked: false,
        dueDate: Logic.firstDue(month, dueDay, opts.first ? pl.startDate : ""), remarks: opts.remark || "", createdAt: new Date().toISOString() });
    });
    if (!opts.dry && created) persist();
    return { created: created, skipped: skipped, held: held };
  },
  firstDue(month, dueDay, start){ const d = Logic.feeDueDate(month, dueDay); return start && d < start ? start : d; },
  /* batch: ONE row per student per month — if a student moved batch, the batch they are in now is billed */
  buildBatchMonth(month, opts){
    opts = opts || {};
    const mS = monthStart(month), mE = monthEnd(month);
    const existing = {};
    DataService.getFees({ month: month, source: "batch" }).forEach(f => existing[f.studentId] = f);
    const byStudent = {};
    DataService.getEnrollments().forEach(function(en){
      const st = DataService.getStudent(en.studentId);
      if (!st || en.status !== "Active") return;
      if (opts.enrollmentId && en.id !== opts.enrollmentId) return;
      if ((en.joiningDate || mS) > mE) return;
      if ((st.status || "Active") !== "Active") return;
      (byStudent[en.studentId] = byStudent[en.studentId] || []).push(en);
    });
    let created = 0, skipped = 0, held = 0, seq = Logic.feeSeq();
    Object.keys(byStudent).forEach(function(sid){
      if (existing[sid]) { skipped++; return; }
      const en = byStudent[sid].slice().sort((a, b) => (b.joiningDate || "").localeCompare(a.joiningDate || ""))[0];
      const dueDay = en.dueDay || Settings().defaultDueDay || 5;
      if (!opts.first && Logic.dueBeforeStart(month, dueDay, en.joiningDate)) return;
      const hold = DataService.holdFor(sid, month);
      if (hold && hold.waiveFee) { held++; return; }
      created++;
      if (opts.dry) return;
      const b = DataService.getBatch(en.batchId), fee = Logic.enrolFee(en);
      DB.fees.push({ id: "FEE" + String(++seq).padStart(5, "0"), source: "batch", month: month,
        studentId: sid, batchId: en.batchId, subClassId: en.subClassId || "", enrollmentId: en.id,
        teacherId: b ? (b.teacherId || "") : "", feeType: "monthly", rate: fee, gross: fee, discount: 0, carry: 0,
        needsAmount: !(fee > 0), override: false, waived: false, locked: false,
        dueDate: Logic.firstDue(month, dueDay, opts.first ? en.joiningDate : ""), remarks: opts.remark || "", createdAt: new Date().toISOString() });
    });
    if (!opts.dry && created) persist();
    return { created: created, skipped: skipped, held: held };
  },
  /* source "" = both */
  buildMonth(month, source, opts){
    const z = { created: 0, skipped: 0, held: 0 };
    [source === "batch" ? null : Logic.buildIndMonth(month, opts), source === "individual" ? null : Logic.buildBatchMonth(month, opts)]
      .filter(Boolean).forEach(r => { z.created += r.created; z.skipped += r.skipped; z.held += r.held; });
    return z;
  },
  /* the first fee of a new class: the month they join in (joining on 23 October pays then for October, due 23 October) */
  firstMonth(start){
    return String(start || today()).slice(0, 7);
  },

  /* ---- what the Due date page shows: paid or pending, nothing in between to learn ---- */
  dueStatus(v){
    if (v.waived) return "Waived";
    if (v.needsAmount && !v.override && !(v.paidAmount > 0)) return "Fee not set";
    if (v.netFee <= 0 && !(v.paidAmount > 0)) return "Nothing due";
    if (v.balance <= 0) return "Paid";
    if (v.paidAmount > 0) return "Part paid";
    return "Pending";
  },
  /* a student's classes: what is running, and whether one still needs to be arranged or needs a teacher */
  classInfo(studentId){
    const plans = DataService.getPlans({ studentId: studentId }).filter(p => p.status === "Active");
    const enr = DataService.getEnrollments({ studentId: studentId }).filter(e => e.status === "Active");
    const noTeacher = plans.some(p => !p.teacherId || !DataService.getTeacher(p.teacherId)) ||
      enr.some(e => { const b = DataService.getBatch(e.batchId); return !b || !b.teacherId; });
    return { plans: plans, enrollments: enr, pending: !plans.length && !enr.length, noTeacher: noTeacher };
  },

  /* ---- RANGE TOOLS: mark, change or clear a whole stretch of dates ---- */
  bulkAttendance(o){
    const b = DataService.getBatch(o.batchId);
    if (!b) return { error: "Pick a batch" };
    const res = { created: 0, updated: 0, cleared: 0, holidays: 0, offDays: 0, days: 0 };
    const from = o.from, to = o.to;
    if (!from || !to || to < from) return { error: "Check the dates" };
    for (let d = parseYMD(from); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
      const ds = ymd(d);
      if (o.onlyClassDays !== false && !Logic.batchMeetsOn(b, ds)) { res.offDays++; continue; }
      if (o.skipHolidays !== false && Logic.isHoliday(ds)) { res.holidays++; continue; }
      const roster = Logic.rosterOf(b.id, ds);
      if (!roster.length) continue;
      res.days++;
      roster.forEach(function(st){
        if (o.onlyStudentId && st.id !== o.onlyStudentId) return;
        const found = DB.attendance.find(a => a.date === ds && a.batchId === b.id && a.studentId === st.id);
        if (o.mode === "clear") { if (found) { DB.attendance = DB.attendance.filter(a => a !== found); res.cleared++; } return; }
        if (o.mode === "change") { if (found) { found.status = o.status; res.updated++; } return; }
        if (found) {
          if (!o.overwrite) return;
          found.status = o.status; res.updated++;
        } else {
          DB.attendance.push({ id: uid("ATT", DB.attendance, 5), date: ds, month: monthOf(ds), batchId: b.id,
            studentId: st.id, teacherId: b.teacherId, status: o.status, remarks: o.remarks || "" });
          res.created++;
        }
      });
    }
    persist();
    return res;
  },
  bulkClasses(o){
    const pl = DataService.getPlan(o.planId);
    if (!pl) return { error: "Pick a class plan" };
    const res = { created: 0, updated: 0, removed: 0, holidays: 0, offDays: 0 };
    const from = o.from, to = o.to;
    if (!from || !to || to < from) return { error: "Check the dates" };
    for (let d = parseYMD(from); ymd(d) <= to; d.setDate(d.getDate() + 1)) {
      const ds = ymd(d);
      if (o.onlyClassDays !== false && (pl.days || []).indexOf(DOW[d.getDay()]) < 0) { res.offDays++; continue; }
      if (o.skipHolidays !== false && Logic.isHoliday(ds)) { res.holidays++; continue; }
      const found = DB.classes.find(c => c.planId === pl.id && c.date === ds);
      if (o.mode === "clear") { if (found) { DB.classes = DB.classes.filter(c => c !== found); res.removed++; } continue; }
      if (o.mode === "change") {
        if (found) { found.status = o.status; found.duration = o.status === "Completed" ? (+pl.duration || 0) : 0; res.updated++; }
        continue;
      }
      if (found) {
        if (!o.overwrite) continue;
        found.status = o.status; found.duration = o.status === "Completed" ? (+pl.duration || 0) : 0; res.updated++;
      } else {
        DB.classes.push({ id: DataService.classKey(pl.id, ds), date: ds, studentId: pl.studentId, planId: pl.id,
          teacherId: pl.teacherId, duration: o.status === "Completed" ? (+pl.duration || 0) : 0,
          status: o.status, notes: o.notes || "" });
        res.created++;
      }
    }
    persist();
    return res;
  },

  buildBoth(month){ return Logic.buildMonth(month, ""); }
};

Object.assign(Logic, {
  /* the plans that belong on a month's attendance sheet: active in the month, or with a mark in it.
     Ordered by class time, then name — the order of the attached sheet. */
  sheetPlans(month){
    const ms = monthStart(month), me = monthEnd(month);
    const marked = {};
    DataService.getClasses({ month: month, notes: true }).forEach(c => marked[c.planId] = true);
    return DataService.getPlans().filter(function(pl){
      if (!DataService.getStudent(pl.studentId)) return false;
      if (marked[pl.id]) return true;
      if (pl.startDate && pl.startDate > me) return false;
      if (pl.endDate && pl.endDate < ms) return false;
      return pl.status === "Active" || (pl.endDate && pl.endDate >= ms);
    }).sort(function(a, b){
      return String(a.time || "99:99").localeCompare(String(b.time || "99:99")) ||
        String((DataService.getStudent(a.studentId) || {}).name || "").localeCompare(String((DataService.getStudent(b.studentId) || {}).name || ""));
    });
  },
  /* is this day one the plan should have a class on? (class day, inside start/end, not a holiday) */
  planDay(pl, ds){
    if (pl.startDate && ds < pl.startDate) return false;
    if (pl.endDate && ds > pl.endDate) return false;
    if ((pl.days || []).indexOf(DOW[parseYMD(ds).getDay()]) < 0) return false;
    return !Logic.isHoliday(ds);
  },
  /* class days that have already passed with no mark (a note alone is not a mark).
     Counted up to yesterday, so today's classes are not flagged before they happen. */
  unmarked(month, o){
    o = o || {};
    const y = parseYMD(today()); y.setDate(y.getDate() - 1);
    const upTo = monthEnd(month) < ymd(y) ? monthEnd(month) : ymd(y);
    const out = { count: 0, lines: [] };
    if (upTo < monthStart(month)) return out;
    Logic.sheetPlans(month).forEach(function(pl){
      if (pl.status !== "Active" && !pl.endDate) return;
      if (o.teacherId && pl.teacherId !== o.teacherId) return;
      const dates = [];
      for (let i = 1; i <= daysInMonth(month); i++) {
        const ds = month + "-" + pad2(i);
        if (ds > upTo) break;
        if (!Logic.planDay(pl, ds)) continue;
        const c = DataService.classAt(pl.id, ds);
        if (!c || c.status === "Note") dates.push(ds);
      }
      if (dates.length) {
        const st = DataService.getStudent(pl.studentId);
        out.lines.push({ planId: pl.id, studentId: pl.studentId, studentName: st ? st.name : pl.studentId,
          teacherId: pl.teacherId, dates: dates });
        out.count += dates.length;
      }
    });
    return out;
  },

  /* ---- ONE LEDGER for both streams. Nothing is posted by hand. ---- */
  ledger(){
    if (Cache._l) return Cache._l;
    const rows = [];
    DataService.getPayments().forEach(function(p){
      const st = DataService.getStudent(p.studentId);
      rows.push({ date: p.date, id: p.id, type: "Student Payment", source: p.source,
        category: p.source === "batch" ? "Batch Class Fee" : "Individual Class Fee",
        desc: (st ? st.name : p.studentId) + " · " + monthLabel(p.month),
        party: p.studentId, inAmt: +p.amount || 0, outAmt: 0, account: p.account, ref: p.txnId || "" });
    });
    DataService.getIncome().forEach(x => rows.push({ date: x.date, id: x.id, type: "Other Income", source: "other",
      category: x.category, desc: x.description || x.category, party: x.source || "",
      inAmt: +x.amount || 0, outAmt: 0, account: x.account, ref: x.reference || "" }));
    DataService.getRefunds().forEach(function(r){
      const st = DataService.getStudent(r.studentId);
      rows.push({ date: r.date, id: r.id, type: "Refund", source: r.source || "other", category: "Refund",
        desc: "Refund to " + (st ? st.name : r.studentId) + (r.reason ? " · " + r.reason : ""),
        party: r.studentId, inAmt: 0, outAmt: +r.amount || 0, account: r.account, ref: r.paymentId || "" });
    });
    DataService.getExpenses().forEach(x => rows.push({ date: x.date, id: x.id, type: "Expense", source: "other",
      category: x.category, desc: x.description || x.category, party: x.payee || "",
      inAmt: 0, outAmt: +x.amount || 0, account: x.account, ref: x.reference || "" }));
    DataService.getTeacherPayments().forEach(function(p){
      const t = DataService.getTeacher(p.teacherId);
      rows.push({ date: p.date, id: p.id, type: "Teacher Payment", source: "other",
        category: p.category || "Teacher Payment",
        desc: (t ? t.name : p.teacherId) + " · " + monthLabel(p.month), party: p.teacherId,
        inAmt: 0, outAmt: +p.amount || 0, account: p.account, ref: p.remarks || "" });
    });
    DataService.getTransfers().forEach(function(t){
      rows.push({ date: t.date, id: t.id + "-O", type: "Transfer", source: "other", category: "Transfer out",
        desc: t.from + " → " + t.to, party: "", inAmt: 0, outAmt: +t.amount || 0, account: t.from, ref: t.notes || "", transfer: true });
      rows.push({ date: t.date, id: t.id + "-I", type: "Transfer", source: "other", category: "Transfer in",
        desc: t.from + " → " + t.to, party: "", inAmt: +t.amount || 0, outAmt: 0, account: t.to, ref: t.notes || "", transfer: true });
    });
    rows.sort((a, b) => a.date !== b.date ? (a.date < b.date ? -1 : 1) : String(a.id).localeCompare(String(b.id)));
    Cache._l = rows;
    return rows;
  },
  accountBalances(upto){
    const bal = {};
    DataService.getAccounts().forEach(a => bal[a.id] = +a.opening || 0);
    Logic.ledger().forEach(function(r){
      if (upto && r.date > upto) return;
      if (bal[r.account] === undefined) bal[r.account] = 0;
      bal[r.account] += (r.inAmt - r.outAmt);
    });
    let total = 0;
    Object.keys(bal).forEach(k => { bal[k] = round2(bal[k]); total += bal[k]; });
    bal.total = round2(total);
    return bal;
  },
  /* Profit & loss. Transfers are skipped entirely — moving money is not income. */
  pnl(from, to){
    let income = 0, expense = 0, refunds = 0, batchFee = 0, indFee = 0;
    const byCat = {}, incByCat = {};
    Logic.ledger().forEach(function(r){
      if (r.transfer) return;
      if (from && r.date < from) return;
      if (to && r.date > to) return;
      if (r.type === "Refund") { refunds += r.outAmt; return; }
      if (r.inAmt) {
        income += r.inAmt;
        incByCat[r.category] = (incByCat[r.category] || 0) + r.inAmt;
        if (r.source === "batch") batchFee += r.inAmt;
        if (r.source === "individual") indFee += r.inAmt;
      }
      if (r.outAmt) { expense += r.outAmt; byCat[r.category] = (byCat[r.category] || 0) + r.outAmt; }
    });
    return { income: round2(income), refunds: round2(refunds), netIncome: round2(income - refunds),
      expense: round2(expense), profit: round2(income - refunds - expense),
      batchFee: round2(batchFee), indFee: round2(indFee),
      byCategory: byCat, incomeByCategory: incByCat };
  },

  /* ---- WhatsApp ---- */
  reminderText(v){
    const s = Settings();
    return "Assalamu Alaikum,\n\nThis is a friendly reminder regarding the monthly fee of " + v.studentName + ".\n\n"
      + "Class: " + (v.source === "batch" ? (v.batchName || "Batch class") : "Individual class") + "\n"
      + "Fee Month: " + monthLabel(v.month) + "\nAmount Due: " + money(v.balance) + "\n"
      + "Due Date: " + fmtDate(v.dueDate) + "\n"
      + (v.paidAmount > 0 ? "Already Paid: " + money(v.paidAmount) + "\n" : "")
      + "\nPlease complete the payment at your convenience.\n\n"
      + (s.academyName || "ManzilulQuran") + "\n" + (s.academyTagline || "E-learning Academy");
  },
  receivedText(v, amount){
    const s = Settings();
    return "Assalamu Alaikum,\n\nWe have received " + money(amount) + " towards the fee of " + v.studentName
      + " for " + monthLabel(v.month) + ".\n"
      + (v.balance > 0 ? "Remaining balance: " + money(v.balance) + "\n" : "This month is now fully paid.\n")
      + "\nJazakumullahu Khairan.\n\n" + (s.academyName || "ManzilulQuran") + "\n" + (s.academyTagline || "E-learning Academy");
  },
  waLink(number, text){
    let n = String(number || "").replace(/\D/g, "");
    const cc = String(Settings().countryCode || "91");
    if (n.length === 10) n = cc + n;
    return "https://wa.me/" + n + "?text=" + encodeURIComponent(text);
  },
  /* the fee given to the family: what the month costs, when it is due, and what is already paid */
  feeText(v, amount){
    const s = Settings();
    const amt = amount !== undefined && amount !== null && amount !== "" ? +amount : (v.balance > 0 ? v.balance : v.netFee);
    return "Assalamu Alaikum,\n\nFee details for " + v.studentName + ".\n\n"
      + "Class: " + (v.source === "batch" ? (v.batchName || "Batch class") : (v.course || "Individual class")) + "\n"
      + "Fee month: " + monthLabel(v.month) + "\n"
      + "Fee: " + money(amt) + "\n"
      + "Due date: " + fmtDate(v.dueDate) + "\n"
      + (v.paidAmount > 0 ? "Already paid: " + money(v.paidAmount) + "\n" : "")
      + "\nPlease pay on or before the due date.\n\n"
      + (s.academyName || "ManzilulQuran") + "\n" + (s.academyTagline || "E-learning Academy");
  },
  /* which streams a student is in */
  streamsOf(studentId){
    const b = DataService.getActiveEnrollment(studentId);
    const i = DataService.getActivePlan(studentId);
    return { batch: b, individual: i };
  }
});

/* ==========================================================================
   CSV
   ========================================================================== */
function toCSV(headers, rows){
  const c = v => { const s = (v === null || v === undefined) ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [headers.map(c).join(",")].concat(rows.map(r => r.map(c).join(","))).join("\n");
}
function downloadCSV(name, headers, rows){
  try {
    const blob = new Blob(["\ufeff" + toCSV(headers, rows)], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast("Downloaded " + name, "ok");
  } catch (e) { toast("Could not create the file here", "bad"); }
}
