"use strict";
/* Academic Service — logic.v2.js. v2 adds the fee / teacher-pay rule engine (hybrids, manual, per-student pay, overrides). */
/* ==========================================================================
   LOGIC
   ========================================================================== */
const FEE_METHODS = [
  { value: "monthly",  label: "Fixed monthly fee",         hint: "Same amount every month" },
  { value: "perClass", label: "Classes × rate",            hint: "Completed classes × rate" },
  { value: "perDay",   label: "Days × rate",               hint: "Days a class happened × rate" },
  { value: "perHour",  label: "Classes × duration × rate", hint: "Taught hours × hourly rate" },
  { value: "hybridH1", label: "Base + per class",          hint: "Fixed base + classes × rate" },
  { value: "hybridH2", label: "Package + extra classes",   hint: "Base covers N classes, each extra class × rate" },
  { value: "hybridH3", label: "Per class with min / max",  hint: "Classes × rate, kept between a minimum and a maximum" },
  { value: "manual",   label: "Manual each month",         hint: "You type the amount every month" }
];
const IND_RATE_TYPES = [
  { value: "perClass", label: "Per class" }, { value: "perDay", label: "Per day" },
  { value: "perHour",  label: "Per hour" },  { value: "monthly", label: "Monthly fixed" },
  { value: "percent",  label: "Percentage of their students' fees" }, { value: "custom", label: "Custom each month" },
  { value: "hybridH1", label: "Base + per class" }, { value: "hybridH2", label: "Package + extra classes" },
  { value: "hybridH3", label: "Per class with min / max" },
  { value: "none",     label: "Not paid for individual classes" }
];
/* teacher pay set on ONE student's plan — overrides the teacher's default for that student only */
const PLAN_PAY_TYPES = [
  { value: "",         label: "Teacher's default" },
  { value: "perClass", label: "Per class" }, { value: "perDay", label: "Per day" }, { value: "perHour", label: "Per hour" },
  { value: "monthly",  label: "Fixed monthly" }, { value: "percent", label: "Percentage of this student's fee" },
  { value: "hybridH1", label: "Base + per class" }, { value: "hybridH2", label: "Package + extra classes" },
  { value: "hybridH3", label: "Per class with min / max" }, { value: "manual", label: "Manual each month" },
  { value: "none",     label: "Not paid for this student" }
];
/* batch enrolment fee: fixed (the existing monthly fee) or typed in each month */
const ENROL_FEE_MODES = [ { value: "", label: "Fixed monthly fee" }, { value: "manual", label: "Manual each month" } ];
const BATCH_PAY_TYPES = [
  { value: "perSession", label: "Per class session held" },
  { value: "perStudent", label: "Per active student" },
  { value: "monthly",    label: "Monthly fixed" },
  { value: "percent",    label: "Percentage of their batch fees" },
  { value: "none",       label: "Not paid for batch classes" }
];
const SOURCES = { batch: "Batch class", individual: "Individual class" };

const Logic = {
  methodLabel(v){ const m = FEE_METHODS.find(x => x.value === v); return m ? m.label : v; },
  indRateLabel(v){ const m = IND_RATE_TYPES.find(x => x.value === v); return m ? m.label : v; },
  batchPayLabel(v){ const m = BATCH_PAY_TYPES.find(x => x.value === v); return m ? m.label : v; },
  planPayLabel(v){ const m = PLAN_PAY_TYPES.find(x => x.value === (v || "")); return m ? m.label : v; },
  /* the extra numbers a hybrid rule needs, read from any record by field prefix
     ("fee" on a plan or fee row, "pay" on a plan, "ind" on a teacher) */
  ruleExtra(o, p){
    o = o || {};
    return { base: +o[p + "Base"] || 0, included: +o[p + "Included"] || 0, min: +o[p + "Min"] || 0, max: +o[p + "Max"] || 0 };
  },
  isHybrid(t){ return t === "hybridH1" || t === "hybridH2" || t === "hybridH3"; },
  /* overrides for individual lines on a teacher's month, kept as JSON text so the sheet keeps them in one column */
  parseLines(v){
    if (!v) return {};
    if (typeof v === "object") return v;
    try { const o = JSON.parse(v); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; }
  },

  /* ---- class log roll-up (individual stream) ---- */
  classStats(rows){
    const done = rows.filter(c => c.status === "Completed"), days = {};
    done.forEach(c => days[c.date] = true);
    return { total: rows.length, completed: done.length,
      cancelled: rows.filter(c => c.status === "Cancelled").length,
      studentAbsent: rows.filter(c => c.status === "Student Absent").length,
      teacherAbsent: rows.filter(c => c.status === "Teacher Absent").length,
      rescheduled: rows.filter(c => c.status === "Rescheduled").length,
      days: Object.keys(days).length,
      minutes: done.reduce((s, c) => s + (+c.duration || 0), 0) };
  },
  computeGross(feeType, rate, st, x){
    rate = +rate || 0; x = x || {};
    if (feeType === "monthly")  return round2(rate);
    if (feeType === "perClass") return round2(st.completed * rate);
    if (feeType === "perDay")   return round2(st.days * rate);
    if (feeType === "perHour")  return round2((st.minutes / 60) * rate);
    if (feeType === "hybridH1") return round2((+x.base || 0) + st.completed * rate);
    if (feeType === "hybridH2") return round2((+x.base || 0) + Math.max(0, st.completed - (+x.included || 0)) * rate);
    if (feeType === "hybridH3") {
      let v = st.completed * rate;
      if (+x.min > 0) v = Math.max(v, +x.min);
      if (+x.max > 0) v = Math.min(v, +x.max);
      return round2(v);
    }
    return 0; /* manual, admission and unknown types are never calculated */
  },
  feeBasis(feeType, st, x){
    x = x || {};
    if (feeType === "monthly")  return "Fixed monthly";
    if (feeType === "perClass") return st.completed + " classes";
    if (feeType === "perDay")   return st.days + " days";
    if (feeType === "perHour")  return round2(st.minutes / 60) + " hours";
    if (feeType === "hybridH1") return money(x.base) + " base + " + st.completed + " classes";
    if (feeType === "hybridH2") return money(x.base) + " for " + (+x.included || 0) + " classes + " +
                                       Math.max(0, st.completed - (+x.included || 0)) + " extra";
    if (feeType === "hybridH3") return st.completed + " classes (min " + money(x.min) + (+x.max > 0 ? ", max " + money(x.max) : "") + ")";
    if (feeType === "manual")   return "Manual";
    return "—";
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
  /* Prepaid: the month is due BEFORE it starts. Postpaid: due inside the month. */
  feeDueDate(month, dueDay){
    if (!Logic.prepaid()) return dueDateFor(month, dueDay);
    const d = parseYMD(monthStart(month));
    d.setDate(d.getDate() - (parseInt(Settings().advanceDays, 10) || 0));
    return ymd(d);
  },
  /* What the timetable says SHOULD happen in a month — the basis for prepaid billing. */
  plannedStats(plan, month){
    let sessions = 0, holidays = 0;
    const start = plan.startDate || "", end = plan.endDate || "";
    for (let i = 1; i <= daysInMonth(month); i++) {
      const ds = month + "-" + pad2(i);
      if (start && ds < start) continue;
      if (end && ds > end) continue;
      if ((plan.days || []).indexOf(DOW[parseYMD(ds).getDay()]) < 0) continue;
      if (Logic.isHoliday(ds)) { holidays++; continue; }
      sessions++;
    }
    return { total: sessions, completed: sessions, days: sessions, minutes: sessions * (+plan.duration || 0),
      cancelled: 0, studentAbsent: 0, teacherAbsent: 0, rescheduled: 0, holidays: holidays, planned: true };
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
  /* every teaching group a teacher is responsible for: whole batches plus sub-classes */
  groupsOf(teacherId){
    const out = [];
    DataService.getBatches().forEach(function(b){
      const subs = DataService.getSubclasses({ batchId: b.id });
      if (subs.length) {
        subs.forEach(function(sc){
          if (sc.teacherId === teacherId && sc.status !== "Inactive")
            out.push({ key: b.id + "|" + sc.id, batchId: b.id, subClassId: sc.id,
              label: b.name + " · " + sc.name, monthlyFee: +sc.monthlyFee || +b.monthlyFee || 0 });
        });
      } else if (b.teacherId === teacherId && b.status === "Active") {
        out.push({ key: b.id + "|", batchId: b.id, subClassId: "", label: b.name, monthlyFee: +b.monthlyFee || 0 });
      }
    });
    return out;
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
    const net = round2(Math.max(0, (+f.gross || 0) - (+f.discount || 0) + carry));
    const paid = Logic.paidOn(f.id);
    const balance = round2(Math.max(0, net - paid));
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
    return Object.assign({}, f, {
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

  /* ---- BATCH fee generation ----
     ONE record per student per month, never one per enrolment: if a student
     moved batch mid-month, only the enrolment they ended up in is billed. ---- */
  buildBatchMonth(month, opts){
    opts = opts || {};
    const prorate = opts.prorate !== false;
    const mS = monthStart(month), mE = monthEnd(month);
    const existing = {};
    DataService.getFees({ month: month, source: "batch" }).forEach(f => existing[f.studentId] = f);

    /* candidates: enrolments that actually overlap the month */
    const byStudent = {};
    DataService.getEnrollments().forEach(function(en){
      const st = DataService.getStudent(en.studentId);
      if (!st) return;
      const joined = en.joiningDate || mS;
      if (joined > mE) return;
      if (en.leavingDate && en.leavingDate <= mS) return;
      if (!en.leavingDate && en.status !== "Active") return;
      if (month >= currentMonth() && (st.status === "Inactive" || st.status === "Suspended")) return;
      (byStudent[en.studentId] = byStudent[en.studentId] || []).push(en);
    });

    let created = 0, skipped = 0, seq = 0;
    DB.fees.forEach(f => { const n = parseInt(String(f.id).replace(/\D/g, ""), 10); if (!isNaN(n) && n > seq) seq = n; });

    Object.keys(byStudent).forEach(function(sid){
      if (existing[sid]) { skipped++; return; }
      /* the enrolment they ended the month in wins: active first, then newest */
      const en = byStudent[sid].slice().sort(function(a, b){
        const aa = a.status === "Active" ? 0 : 1, bb = b.status === "Active" ? 0 : 1;
        if (aa !== bb) return aa - bb;
        return (b.joiningDate || "").localeCompare(a.joiningDate || "");
      })[0];
      const b = DataService.getBatch(en.batchId);
      const sc = en.subClassId ? DataService.getSubclass(en.subClassId) : null;
      const full = +en.monthlyFee || (sc ? +sc.monthlyFee : 0) || (b ? +b.monthlyFee : 0) || 0;
      const joined = en.joiningDate || mS;
      let fee = full, remark = "";
      const midJoin = joined > mS && joined <= mE;
      if (midJoin && prorate) {
        const tot = daysInMonth(month), left = tot - parseYMD(joined).getDate() + 1;
        fee = Math.round((full * left / tot) / 10) * 10;
        remark = "Prorated — joined " + fmtDate(joined) + " (" + left + "/" + tot + " days)";
      } else if (midJoin) remark = "Joined " + fmtDate(joined);
      if (byStudent[sid].length > 1) remark = (remark ? remark + " · " : "") + "Billed on the batch held at month end";

      let due = Logic.feeDueDate(month, en.dueDay || Settings().defaultDueDay || 5);
      if (midJoin && joined > due) due = ymd(new Date(parseYMD(joined).getTime() + 3 * 86400000));

      const manual = en.feeMode === "manual";
      DB.fees.push({ id: "FEE" + String(++seq).padStart(5, "0"), source: "batch", month: month,
        studentId: sid, batchId: en.batchId, subClassId: en.subClassId || "", enrollmentId: en.id,
        teacherId: b ? b.teacherId : "", feeType: manual ? "manual" : "monthly", rate: manual ? 0 : full,
        gross: manual ? 0 : fee, discount: manual ? 0 : Math.max(0, full - fee), waived: false, locked: false,
        needsAmount: manual, override: false,
        dueDate: due, remarks: manual ? "Manual — enter this month's amount" + (remark ? " · " + remark : "") : remark,
        createdAt: new Date().toISOString() });
      created++;
    });
    persist();
    return { created: created, skipped: skipped };
  },

  /* ---- INDIVIDUAL fee generation ----
     PREPAID  : billed up front on the classes the timetable plans for the month
                (holidays excluded), plus any credit or shortfall carried in from
                the month that was reconciled.
     POSTPAID : billed on the classes actually completed, refreshed on demand. ---- */
  buildIndMonth(month){
    let created = 0, updated = 0, skipped = 0, seq = 0;
    DB.fees.forEach(f => { const n = parseInt(String(f.id).replace(/\D/g, ""), 10); if (!isNaN(n) && n > seq) seq = n; });
    const existing = {};
    DataService.getFees({ month: month, source: "individual" }).forEach(f => existing[f.planId] = f);
    const prepaid = Logic.prepaid();

    DataService.getPlans().forEach(function(pl){
      const st = DataService.getStudent(pl.studentId);
      if (!st) return;
      if (pl.startDate && pl.startDate > monthEnd(month)) return;
      if (pl.status !== "Active" && !existing[pl.id]) {
        if (!(pl.endDate && monthOf(pl.endDate) >= month)) return;
      }
      const stats = prepaid ? Logic.plannedStats(pl, month)
                            : Logic.classStats(DataService.getClasses({ planId: pl.id, month: month }));
      const fx = Logic.ruleExtra(pl, "fee"), manual = pl.feeType === "manual";
      const gross = Logic.computeGross(pl.feeType, pl.rate, stats, fx);
      const found = existing[pl.id];
      if (found) {
        /* A settled, locked or already-paid month is never rewritten. */
        /* prepaid: once money is in against the planned month, that month stands */
        /* an amount typed in by hand (override / manual) is never recalculated */
        if (found.locked || found.reconciled || found.override || (prepaid && Logic.paidOn(found.id) > 0)) { skipped++; return; }
        if (round2(found.gross) !== gross || (manual && !found.needsAmount)) {
          found.gross = gross; found.feeType = pl.feeType; found.rate = +pl.rate || 0;
          found.feeBase = fx.base; found.feeIncluded = fx.included; found.feeMin = fx.min; found.feeMax = fx.max;
          found.needsAmount = manual;
          found.plannedUnits = stats.completed; found.plannedHolidays = stats.holidays || 0;
          updated++;
        } else skipped++;
        return;
      }
      const id = "FEE" + String(++seq).padStart(5, "0");
      DB.fees.push({ id: id, source: "individual", month: month, studentId: pl.studentId, planId: pl.id,
        teacherId: pl.teacherId, feeType: pl.feeType, rate: +pl.rate || 0, gross: gross,
        feeBase: fx.base, feeIncluded: fx.included, feeMin: fx.min, feeMax: fx.max,
        needsAmount: manual, override: false,
        discount: +pl.discount || 0, carry: 0, plannedUnits: stats.completed, plannedHolidays: stats.holidays || 0,
        billing: prepaid ? "prepaid" : "postpaid", reconciled: false, waived: false, locked: false,
        dueDate: Logic.feeDueDate(month, pl.dueDay || Settings().defaultDueDay || 5),
        remarks: "", createdAt: new Date().toISOString() });
      created++;
    });
    persist();
    const carried = Logic.applyPending(month);
    return { created: created, updated: updated, skipped: skipped, carried: carried };
  },

  /* Anything a reconciliation left waiting is set off against the first month
     that is still open — so a credit is never lost when the next month was
     already raised in advance, and a month already paid is never disturbed. */
  applyPending(month){
    let n = 0;
    (DB.adjustments || []).filter(a => !a.appliedFeeId && a.toMonth <= month).forEach(function(a){
      const f = DB.fees.find(x => x.source === "individual" && x.planId === a.planId && x.month === month);
      if (!f) return;
      if (f.locked || f.reconciled || Logic.paidOn(f.id) > 0) return;
      f.carry = round2((+f.carry || 0) + (+a.amount || 0));
      const line = (a.amount < 0 ? money(-a.amount) + " credit from " : money(a.amount) + " extra from ") + monthLabel(a.fromMonth);
      f.remarks = f.remarks ? f.remarks + " · " + line : line;
      a.appliedFeeId = f.id;
      n++;
    });
    if (n) persist();
    return n;
  },

  /* ---- RECONCILE a prepaid month ----
     Compares what was planned and billed against what the class log actually
     shows. The difference is carried into the next month as a credit or an
     extra charge — the month just closed is left exactly as it was paid. ---- */
  reconcileMonth(month){
    let done = 0, credit = 0, extra = 0, skipped = 0;
    DataService.getFees({ month: month, source: "individual" }).forEach(function(f){
      if (f.reconciled) { skipped++; return; }
      const pl = DataService.getPlan(f.planId);
      if (!pl) { skipped++; return; }
      /* one-off admission fees are not class-based: nothing to reconcile */
      if (f.feeType === "admission") { skipped++; return; }
      const actual = Logic.classStats(DataService.getClasses({ planId: f.planId, month: month }));
      /* an amount typed in by hand stands as agreed — close the month with no carry */
      if (f.override || f.feeType === "manual") {
        f.actualUnits = actual.completed; f.reconciled = true; f.locked = true;
        f.remarks = (f.remarks ? f.remarks + " · " : "") + "Reconciled: agreed amount, no carry (held " + actual.completed + ")";
        done++; return;
      }
      const actualGross = Logic.computeGross(f.feeType, f.rate, actual, Logic.ruleExtra(f, "fee"));
      const diff = round2(actualGross - (+f.gross || 0));
      f.actualUnits = actual.completed; f.actualGross = actualGross;
      f.reconciled = true; f.locked = true;
      f.remarks = (f.remarks ? f.remarks + " · " : "") + "Reconciled: planned " + (f.plannedUnits || 0) +
        ", held " + actual.completed;
      if (diff !== 0) {
        DB.adjustments.push({ id: uid("ADJ", DB.adjustments || []), planId: f.planId, studentId: f.studentId,
          fromMonth: month, toMonth: addMonths(month, 1), amount: diff, appliedFeeId: "",
          note: (diff < 0 ? "Credit for classes not held in " : "Extra classes held in ") + monthLabel(month) });
        if (diff < 0) credit += -diff; else extra += diff;
      }
      done++;
    });
    persist();
    const carried = Logic.applyPending(addMonths(month, 1));
    return { done: done, credit: round2(credit), extra: round2(extra), skipped: skipped, carried: carried };
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
        DB.classes.push({ id: uid("CLS", DB.classes, 4), date: ds, studentId: pl.studentId, planId: pl.id,
          teacherId: pl.teacherId, duration: o.status === "Completed" ? (+pl.duration || 0) : 0,
          status: o.status, notes: o.notes || "" });
        res.created++;
      }
    }
    persist();
    return res;
  },

  buildBoth(month){
    const b = Logic.buildBatchMonth(month), i = Logic.buildIndMonth(month);
    return { created: b.created + i.created, updated: i.updated, skipped: b.skipped + i.skipped };
  }
};

/* ---- TEACHER PAY: individual part + batch part, shown separately so the
        two streams can never be confused with each other ---- */
Object.assign(Logic, {
  payrollView(t, month){
    /* Other staff: fixed monthly salary + incentive, no class-based math */
    if (t.kind === "staff") {
      const adj = DataService.getAdjust(t.id, month) || { bonus: 0, deduction: 0, incentive: 0, remarks: "" };
      const sal = round2(+t.monthlySalary || 0);
      const payable = round2(sal + (+adj.bonus || 0) + (+adj.incentive || 0) - (+adj.deduction || 0));
      const paid = round2(DataService.getTeacherPayments({ teacherId: t.id, month: month }).reduce((s, p) => s + (+p.amount || 0), 0));
      const balance = round2(payable - paid);
      return { teacherId: t.id, teacherName: t.name, month: month, kind: "staff", role: t.role || "",
        indAmount: 0, indBasis: "—", batchAmount: 0, batchBasis: "—",
        classStats: { completed: 0, days: 0, minutes: 0 }, sessions: 0, batchStudents: 0, groups: [],
        monthlySalary: sal, gross: sal, bonus: +adj.bonus || 0, incentive: +adj.incentive || 0,
        deduction: +adj.deduction || 0, remarks: adj.remarks || "", payable: payable, paid: paid, balance: balance,
        status: balance <= 0 && paid > 0 ? "Paid" : (paid > 0 ? "Partial" : (payable > 0 ? "Pending" : "Nil")) };
    }
    /* individual side, from the class log */
    const rows = DataService.getClasses({ teacherId: t.id, month: month });
    const cs = Logic.classStats(rows);
    const rate = +t.indRate || 0;

    /* per-student lines: a plan with its own pay rule, or a month override, is paid on its own line;
       everything else falls to the teacher's default below — exactly as before when no plan has a rule */
    const ov = Logic.parseLines((DataService.getAdjust(t.id, month) || {}).planLines);
    const seenPlan = {}, planIds = [];
    rows.forEach(r => { if (r.planId && !seenPlan[r.planId]) { seenPlan[r.planId] = true; planIds.push(r.planId); } });
    DataService.getPlans({ teacherId: t.id }).forEach(function(p){
      if (seenPlan[p.id] || p.status !== "Active") return;
      if (p.startDate && p.startDate > monthEnd(month)) return;
      seenPlan[p.id] = true; planIds.push(p.id);
    });
    const handled = {}, indLines = [];
    let lineSum = 0, needsN = 0;
    planIds.forEach(function(pid){
      const pl = DataService.getPlan(pid); if (!pl) return;
      const st = DataService.getStudent(pl.studentId);
      const pcs = Logic.classStats(rows.filter(r => r.planId === pid));
      const L = { planId: pid, studentId: pl.studentId, studentName: st ? st.name : pl.studentId, course: pl.course || "",
        classes: pcs.completed, payType: pl.payType || "", amount: 0, basis: "", source: "default", needsAmount: false, note: "" };
      const o = ov[pid];
      if (o && o.amount !== undefined && o.amount !== "") {
        L.source = "override"; L.amount = round2(+o.amount || 0); L.note = o.note || "";
        L.basis = "Override" + (o.note ? " — " + o.note : "");
      } else if (pl.payType) {
        L.source = "plan"; const pr = +pl.payRate || 0;
        if (pl.payType === "manual") { L.needsAmount = true; L.basis = "Manual — enter this month's amount"; needsN++; }
        else if (pl.payType === "none") L.basis = "Not paid for this student";
        else if (pl.payType === "percent") {
          const base = Logic.feeViews({ month: month, source: "individual" }).filter(v => v.planId === pid).reduce((s, v) => s + v.netFee, 0);
          L.amount = round2(base * pr / 100); L.basis = pr + "% of " + money(base) + " fee";
        } else {
          const px = Logic.ruleExtra(pl, "pay");
          L.amount = Logic.computeGross(pl.payType, pr, pcs, px);
          L.basis = Logic.feeBasis(pl.payType, pcs, px) + (pl.payType === "monthly" ? "" : " × " + money(pr));
        }
      } else { L.basis = "Teacher's default"; }
      if (L.source !== "default") { handled[pid] = true; lineSum += L.amount; }
      indLines.push(L);
    });
    const anyHandled = Object.keys(handled).length > 0;
    const drows = anyHandled ? rows.filter(r => !handled[r.planId]) : rows;
    const dcs = anyHandled ? Logic.classStats(drows) : cs;

    let ind = 0, indBasis = "Not paid for individual classes";
    if (t.indRateType === "perClass") { ind = dcs.completed * rate; indBasis = dcs.completed + " classes × " + money(rate); }
    else if (t.indRateType === "perDay") { ind = dcs.days * rate; indBasis = dcs.days + " days × " + money(rate); }
    else if (t.indRateType === "perHour") { ind = (dcs.minutes / 60) * rate; indBasis = round2(dcs.minutes / 60) + " hours × " + money(rate); }
    else if (t.indRateType === "monthly") { ind = rate; indBasis = "Monthly fixed"; }
    else if (t.indRateType === "percent") {
      const base = Logic.feeViews({ month: month, source: "individual", teacherId: t.id })
        .filter(v => !handled[v.planId]).reduce((s, v) => s + v.netFee, 0);
      ind = base * rate / 100; indBasis = rate + "% of " + money(base) + " individual fees";
    } else if (t.indRateType === "custom") {
      const a = DataService.getAdjust(t.id, month);
      ind = a ? (+a.custom || 0) : 0; indBasis = "Custom amount";
    } else if (Logic.isHybrid(t.indRateType)) {
      const tx = Logic.ruleExtra(t, "ind");
      ind = Logic.computeGross(t.indRateType, rate, dcs, tx);
      indBasis = Logic.feeBasis(t.indRateType, dcs, tx) + " × " + money(rate);
    }
    const defaultAmount = round2(ind);
    if (anyHandled) {
      const n = Object.keys(handled).length;
      indBasis = "Default: " + indBasis + " + " + n + " student rule" + (n > 1 ? "s" : "");
      ind += lineSum;
    }

    /* batch side — worked out per teaching group, so every sub-class is paid on its own */
    const groups = Logic.groupsOf(t.id);
    const att = DataService.getAttendance({ month: month, teacherId: t.id });
    const brate = +t.batchRate || 0;
    const bFees = Logic.feeViews({ month: month, source: "batch" });
    const lines = groups.map(function(g){
      const seen = {};
      att.filter(a => a.batchId === g.batchId && (a.subClassId || "") === g.subClassId)
         .forEach(a => seen[a.date] = true);
      const sessions = Object.keys(seen).length;
      const students = Logic.rosterOf(g.batchId, null, g.subClassId).length;
      const feeBase = bFees.filter(v => v.batchId === g.batchId && (v.subClassId || "") === g.subClassId)
        .reduce((x, v) => x + v.netFee, 0);
      let amt = 0, basis = "—";
      if (t.batchPayType === "perSession") { amt = sessions * brate; basis = sessions + " sessions × " + money(brate); }
      else if (t.batchPayType === "perStudent") { amt = students * brate; basis = students + " students × " + money(brate); }
      else if (t.batchPayType === "percent") { amt = feeBase * brate / 100; basis = brate + "% of " + money(feeBase); }
      return { key: g.key, label: g.label, batchId: g.batchId, subClassId: g.subClassId,
        sessions: sessions, students: students, feeBase: round2(feeBase), amount: round2(amt), basis: basis };
    });
    const sessionCount = lines.reduce((x, l) => x + l.sessions, 0);
    const batchStudents = lines.reduce((x, l) => x + l.students, 0);
    let bat = 0, batBasis = "Not paid for batch classes";
    if (t.batchPayType === "monthly") {
      bat = brate; batBasis = "Monthly fixed across " + lines.length + " group(s)";
      if (lines.length) { const each = round2(brate / lines.length); lines.forEach(l => { l.amount = each; l.basis = "share of monthly fixed"; }); }
    } else if (t.batchPayType && t.batchPayType !== "none") {
      bat = lines.reduce((x, l) => x + l.amount, 0);
      batBasis = t.batchPayType === "perSession" ? sessionCount + " sessions × " + money(brate)
               : t.batchPayType === "perStudent" ? batchStudents + " students × " + money(brate)
               : brate + "% of " + money(lines.reduce((x, l) => x + l.feeBase, 0)) + " batch fees";
    } else lines.forEach(l => { l.amount = 0; l.basis = "not paid for batch classes"; });

    const adj = DataService.getAdjust(t.id, month) || { bonus: 0, deduction: 0, custom: 0, incentive: 0, remarks: "" };
    ind = round2(ind); bat = round2(bat);
    const gross = round2(ind + bat);
    const payable = round2(gross + (+adj.bonus || 0) + (+adj.incentive || 0) - (+adj.deduction || 0));
    const paid = round2(DataService.getTeacherPayments({ teacherId: t.id, month: month })
      .reduce((s, p) => s + (+p.amount || 0), 0));
    const balance = round2(payable - paid);
    return {
      teacherId: t.id, teacherName: t.name, month: month,
      indAmount: ind, indBasis: indBasis, batchAmount: bat, batchBasis: batBasis,
      indLines: indLines, indDefaultAmount: defaultAmount, needsN: needsN,
      classStats: cs, sessions: sessionCount, batchStudents: batchStudents, groups: lines,
      gross: gross, bonus: +adj.bonus || 0, incentive: +adj.incentive || 0, deduction: +adj.deduction || 0, remarks: adj.remarks || "",
      payable: payable, paid: paid, balance: balance,
      status: balance <= 0 && paid > 0 ? "Paid" : (paid > 0 ? "Partial" : (payable > 0 ? "Pending" : "Nil"))
    };
  },
  payrollMonth(month){ return DataService.getTeachers().map(t => Logic.payrollView(t, month)); },

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

