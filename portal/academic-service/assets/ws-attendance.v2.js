"use strict";
/* Academic Service — ws-attendance.v2.js. v2: shared by Academic Service and the class-admin link (/portal/attendance/):
   who marked (ATT_ACTOR), other devices' marks pulled in every minute, Admin links manager (office only).
   The attendance sheet for individual classes (Individual workspace → Attendance).
   Every mark is saved straight into the class log (mq_classes) that fees and teacher pay already read:
     one record per class plan per day, with the fixed ID plan + date (DataService.classKey).
   Batch classes are not here — their teachers mark them on the teacher link. */

/* ---- register the page (no change needed in ui.vN.js) ---- */
(function(){
  const manage = WS.ind.nav.find(g => g[0] === "Manage");
  if (manage && !manage[1].some(x => x[0] === "iAtt")) manage[1].unshift(["iAtt", "▦", "Attendance", "Attendance"]);
  PAGE_WS.iAtt = "ind";
  PAGE_SUB.iAtt = "Mark each class day. Marks go straight into the class log — fees, reconciliation and teacher pay read them.";
  HEAD_ACTS.iAtt = window.MQ_ADMIN
    ? '<button class="btn" data-act="att-full">Full view</button>'
    : '<button class="btn" data-act="att-admins">Admin links</button>' +
      '<button class="btn" data-act="holidays">Holidays</button>' +
      '<button class="btn" data-act="att-full">Full view</button>';
})();
/* who is marking: the office, or the admin whose link opened the page (set by att-admin.vN.js) */
function attActor(){ return window.ATT_ACTOR || { name: Settings().markerName || "Academic Service", via: "academic-service" }; }
/* the admin page adds its own buttons through these */
const ATT_HOOKS = { toolbar: () => "", rowButtons: () => "" };

State.iatt = { view: "", date: today(), teacher: "", q: "", unmarked: false, brush: "", sel: null, open: {} };
const ATT_TAGS = ["Starts", "Restarts", "Stopped", "Class finished", "Paused", "Teacher changed", "Rescheduled",
  "Payment pending", "Payment done", "Juz submitted"];
/* the note fields each mark asks for (as in the attached attendance sheet) */
const ATT_FIELDS = { P: ["by", "mins", "makeup"], A: ["inf", "before"], T: ["inf", "makeup"], L: ["inf", "until"],
  S: ["by", "mins"], E: ["portion", "result", "by"], X: ["portion", "result", "by"], N: [], R: ["makeup"], C: [] };
const ATT_TEXT = { "✅": "P", "✓": "P", "✔": "P", "p": "P", "present": "P", "❌s": "A", "✕s": "A", "xs": "A", "a": "A", "absent": "A",
  "❌t": "T", "✕t": "T", "xt": "T", "t": "T", "leave": "L", "lv": "L", "l": "L", "sub": "S", "s": "S", "substitute": "S",
  "exa": "E", "exam": "E", "e": "E", "test": "X", "x": "X", "⚫": "N", "●": "N", "n": "N", "note": "N",
  "r": "R", "rescheduled": "R", "c": "C", "cancelled": "C" };
function attFromText(s){
  const n = String(s == null ? "" : s).replace(/️/g, "").trim().toLowerCase();
  if (!n) return "";
  return ATT_TEXT[n] || ATT_TEXT[n.replace(/\s+/g, "")] || "";
}
const ATT_UNDO = [], ATT_REDO = [];

/* ---- month lock (Close month) ---- */
function attLocked(month){ const l = Settings().attLockedThrough || ""; return !!l && month <= l; }
function attCanEdit(month){
  if (!attLocked(month)) return true;
  if (window.MQ_ADMIN) { toast(monthLabel(month) + " is closed by the office — ask them to change it", "warn", 4500); return false; }
  if (State.iatt.open[month]) return true;
  confirmAction({ title: monthLabel(month) + " is closed",
    note: "Payroll and reconciliation for this month may already be done. If you change a mark, recalculate the month and check Teacher pay afterwards.",
    message: "Allow changes to " + monthLabel(month) + " for this visit?", submitText: "Allow changes",
    onConfirm: function(){ State.iatt.open[month] = true; toast("Changes allowed for " + monthLabel(month) + " until you reload", "warn", 4200); } });
  return false;
}

/* ---- writing marks: one persist for the whole batch, undo kept ---- */
function attKey(planId, ds){ return planId + "|" + ds; }
function attRecord(pl, ds, k, extra, cur){
  const m = ATT_MK[k];
  const rec = cur ? Object.assign({}, cur) : { id: "", date: ds, planId: pl.id, studentId: pl.studentId };
  if (!rec.id) {
    const key = DataService.classKey(pl.id, ds);
    rec.id = DB.classes.some(x => x.id === key) ? uid("CLS", DB.classes, 4) : key;
  }
  rec.studentId = pl.studentId;
  rec.teacherId = (cur && cur.teacherId) || pl.teacherId || "";
  rec.status = m.status; rec.activity = m.activity || ""; rec.mark = k;
  const x = Object.assign({ takenBy: cur ? cur.takenBy || "" : "", mins: cur ? cur.mins || "" : "",
    informed: cur ? cur.informed || "" : "", informedBefore: cur ? cur.informedBefore || "" : "",
    makeup: cur ? cur.makeup || "" : "", leaveUntil: cur ? cur.leaveUntil || "" : "",
    portion: cur ? cur.portion || "" : "", result: cur ? cur.result || "" : "",
    tags: cur ? (cur.tags || []) : [], notes: cur ? cur.notes || "" : "" }, extra || {});
  /* fields that do not belong to this mark are cleared, so an old substitute never lingers */
  const keep = ATT_FIELDS[k] || [];
  if (keep.indexOf("by") < 0) x.takenBy = "";
  if (keep.indexOf("mins") < 0) x.mins = "";
  if (keep.indexOf("inf") < 0) { x.informed = ""; }
  if (keep.indexOf("before") < 0) x.informedBefore = "";
  if (keep.indexOf("makeup") < 0) x.makeup = "";
  if (keep.indexOf("until") < 0) x.leaveUntil = "";
  if (keep.indexOf("portion") < 0) { x.portion = ""; x.result = ""; }
  Object.assign(rec, x);
  const noClass = k === "T" || k === "R" || k === "C" || k === "N";
  rec.duration = noClass ? 0 : (+x.mins || +pl.duration || 0);
  rec.markedBy = attActor().name;
  rec.markedAt = new Date().toISOString();
  rec.via = attActor().via;
  return rec;
}
/* list = [{ planId, ds, k, extra }] ; k "" clears the day */
function attWrite(list, label, noUndo){
  const undo = [];
  list.forEach(function(it){
    const pl = DataService.getPlan(it.planId); if (!pl) return;
    const cur = DataService.classAt(it.planId, it.ds);
    undo.push({ planId: it.planId, ds: it.ds, before: cur ? JSON.parse(JSON.stringify(cur)) : null });
    if (!it.k) { if (cur) { DB.classes = DB.classes.filter(c => c !== cur); Cache.clear(); } return; }
    const rec = attRecord(pl, it.ds, it.k, it.extra, cur);
    if (cur) { const i = DB.classes.indexOf(cur); if (i >= 0) DB.classes[i] = rec; else DB.classes.push(rec); } else DB.classes.push(rec);
    Cache.clear();
  });
  if (!undo.length) return 0;
  persist();
  if (!noUndo) { ATT_UNDO.push({ label: label || "change", items: undo }); if (ATT_UNDO.length > 60) ATT_UNDO.shift(); ATT_REDO.length = 0; }
  return undo.length;
}
function attRestore(items){
  const back = [];
  items.forEach(function(u){
    const cur = DataService.classAt(u.planId, u.ds);
    back.push({ planId: u.planId, ds: u.ds, before: cur ? JSON.parse(JSON.stringify(cur)) : null });
    if (cur) DB.classes = DB.classes.filter(c => c !== cur);
    if (u.before) DB.classes.push(u.before);
    Cache.clear();
  });
  persist();
  return back;
}
/* "leave until": the plan's class days after this one, up to the date, become leave (marked days are left alone) */
function attLeaveFill(pl, ds, until){
  const out = [];
  if (!until || until <= ds) return out;
  const d = parseYMD(ds);
  for (let i = 0; i < 120; i++) {
    d.setDate(d.getDate() + 1);
    const s = ymd(d); if (s > until) break;
    if (!Logic.planDay(pl, s)) continue;
    const c = DataService.classAt(pl.id, s);
    if (c && c.status !== "Note") continue;
    out.push({ planId: pl.id, ds: s, k: "L", extra: { leaveUntil: until } });
  }
  return out;
}
function attMark(planId, ds, k){
  if (!attCanEdit(monthOf(ds))) return;
  const cur = DataService.classAt(planId, ds);
  if (k === "S" && !(cur && cur.status === "Substitute" && cur.takenBy)) { attNote(planId, ds, "S"); return; }
  attWrite([{ planId: planId, ds: ds, k: k }], "mark");
  render();
}

/* ---- rows and cells ---- */
function attRows(month){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim();
  const um = Logic.unmarked(month);
  const umSet = {}; um.lines.forEach(l => umSet[l.planId] = l.dates.length);
  return { um: um, rows: Logic.sheetPlans(month).map(function(pl){
    const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
    return { pl: pl, name: st.name || pl.studentId, teacher: t.name || "—", unmarked: umSet[pl.id] || 0 };
  }).filter(function(r){
    if (f.teacher && r.pl.teacherId !== f.teacher) return false;
    if (f.unmarked && !r.unmarked) return false;
    return !q || (r.name + " " + r.pl.studentId + " " + r.teacher + " " + (r.pl.course || "")).toLowerCase().indexOf(q) >= 0;
  }) };
}
function attTotals(pl, month){
  const t = { p: 0, a: 0, t: 0, l: 0, s: 0, h: 0, pct: null };
  DataService.getClasses({ planId: pl.id, month: month }).forEach(function(c){
    if (Logic.isHoliday(c.date)) return;
    const k = markOf(c);
    if (k === "P" || k === "E" || k === "X") t.p++; else if (k === "A") t.a++; else if (k === "T") t.t++;
    else if (k === "L") t.l++; else if (k === "S") t.s++;
  });
  t.h = t.p + t.s + t.a; t.pct = t.h ? Math.round((t.p + t.s) * 1000 / t.h) / 10 : null;
  return t;
}
function attSym(k){ const m = ATT_MK[k]; return m ? m.sym : ""; }
function attCellClass(pl, ds, c, yday){
  const k = markOf(c), cls = ["ac"];
  const hol = Logic.isHoliday(ds), off = !attNoDays(pl) && (pl.days || []).indexOf(DOW[parseYMD(ds).getDay()]) < 0,
        out = (pl.startDate && ds < pl.startDate) || (pl.endDate && ds > pl.endDate);
  if (hol) cls.push("hol"); else if (out) cls.push("out"); else if (off) cls.push("off");
  if (k) cls.push("m-" + k);
  if (c && (c.notes || (c.tags && c.tags.length) || c.portion || c.makeup || c.leaveUntil)) cls.push("has-note");
  if (!k && !hol && !out && !off && ds <= yday && !attNoDays(pl)) cls.push("um");
  if (ds === today()) cls.push("tdy");
  const s = State.iatt.sel; if (s && s.planId === pl.id && s.ds === ds) cls.push("sel");
  return cls.join(" ");
}
/* a plan with no class days set could meet on any day: nothing is greyed, nothing is flagged unmarked */
function attNoDays(pl){ return !(pl.days || []).length; }
function attPossible(pl, ds){
  if (pl.startDate && ds < pl.startDate) return false;
  if (pl.endDate && ds > pl.endDate) return false;
  if (Logic.isHoliday(ds)) return false;
  return attNoDays(pl) || (pl.days || []).indexOf(DOW[parseYMD(ds).getDay()]) >= 0;
}
function attDayLabel(ds){ return DOW[parseYMD(ds).getDay()].slice(0, 2); }

function attGrid(month, rows, forFull){
  const n = daysInMonth(month), y = parseYMD(today()); y.setDate(y.getDate() - 1);
  const yday = ymd(y);
  let h = '<table class="att-grid"><thead><tr><th class="att-name">Student</th>';
  for (let i = 1; i <= n; i++) {
    const ds = month + "-" + pad2(i), hol = Logic.isHoliday(ds);
    h += '<th class="' + (hol ? "hol" : "") + (ds === today() ? " tdy" : "") + '" title="' + esc(hol ? hol.name : fmtDate(ds)) + '">' +
      '<span>' + i + '</span><small>' + attDayLabel(ds) + '</small></th>';
  }
  h += '<th class="att-tot">✓</th><th class="att-tot">✕s</th><th class="att-tot">✕t</th><th class="att-tot">Lv</th>' +
       '<th class="att-tot">Sub</th><th class="att-tot">Held</th><th class="att-tot">%</th></tr></thead><tbody>';
  rows.forEach(function(r){
    const pl = r.pl, tt = attTotals(pl, month);
    h += '<tr><th class="att-name"><button type="button" class="att-who" data-act="att-row" data-id="' + esc(pl.id) + '">' +
      '<b>' + esc(r.name) + '</b><small>' + esc((pl.time ? time12(pl.time) + " · " : "") + r.teacher) + '</small>' +
      (attNoDays(pl) ? '<small class="att-nodays">class days not set</small>' : "") + '</button></th>';
    for (let i = 1; i <= n; i++) {
      const ds = month + "-" + pad2(i), c = DataService.classAt(pl.id, ds), k = markOf(c);
      h += '<td class="' + attCellClass(pl, ds, c, yday) + '"' + (forFull ? "" : ' data-act="att-cell" data-id="' + esc(pl.id) + '" data-ds="' + ds + '"') +
        '>' + esc(attSym(k)) + '</td>';
    }
    h += '<td class="att-tot">' + tt.p + '</td><td class="att-tot">' + tt.a + '</td><td class="att-tot">' + tt.t + '</td>' +
      '<td class="att-tot">' + tt.l + '</td><td class="att-tot">' + tt.s + '</td><td class="att-tot">' + tt.h + '</td>' +
      '<td class="att-tot ' + (tt.pct === null ? "" : tt.pct >= 80 ? "good" : tt.pct < 50 ? "bad" : "") + '">' + (tt.pct === null ? "" : tt.pct + "%") + '</td></tr>';
  });
  return h + '</tbody></table>';
}

function attMarkButtons(planId, ds, cur, big){
  const k = markOf(cur);
  return ATT_MARKS.map(m => '<button type="button" class="am m-' + m.k + (k === m.k ? " on" : "") + (big ? " big" : "") +
    '" data-act="att-set" data-id="' + esc(planId) + '" data-ds="' + ds + '" data-k="' + m.k + '" title="' + esc(m.name) +
    ' (' + m.key + ')" aria-pressed="' + (k === m.k) + '">' + esc(m.sym) + '</button>').join("") +
    '<button type="button" class="am clr" data-act="att-set" data-id="' + esc(planId) + '" data-ds="' + ds + '" data-k="" title="Clear (Delete)">⌫</button>';
}
function attNoteLine(c){
  if (!c) return "";
  const p = [];
  if (c.takenBy) { const t = DataService.getTeacher(c.takenBy); p.push((c.status === "Substitute" ? "Substitute: " : "Taken by ") + (t ? t.name : c.takenBy)); }
  if (c.mins) p.push(c.mins + " min class");
  if (c.informed === "yes") p.push(c.status === "Teacher Absent" ? "Reported" : "Informed");
  if (c.informed === "no") p.push(c.status === "Teacher Absent" ? "Not reported" : "Not informed");
  if (c.informedBefore) p.push("informed " + c.informedBefore + " min before");
  if (c.makeup) p.push((c.status === "Teacher Absent" || c.status === "Rescheduled" ? "Make-up on " : "Make-up for ") + fmtDate(c.makeup));
  if (c.leaveUntil) p.push("Leave until " + fmtDate(c.leaveUntil));
  if (c.portion) p.push(c.portion);
  if (c.result) p.push("Result: " + c.result);
  if (c.tags && c.tags.length) p.push(c.tags.join(", "));
  if (c.notes) p.push(c.notes);
  return p.join(" · ");
}
function attPickBar(month){
  const s = State.iatt.sel; if (!s || monthOf(s.ds) !== month) return "";
  const pl = DataService.getPlan(s.planId); if (!pl) return "";
  const st = DataService.getStudent(pl.studentId) || {}, c = DataService.classAt(s.planId, s.ds);
  const when = c && c.markedAt ? "Marked by " + (c.markedBy || "—") + " · " + fmtDate(c.markedAt.slice(0, 10)) + ", " + c.markedAt.slice(11, 16) + " UTC" : "Not marked";
  const hol = Logic.isHoliday(s.ds);
  return '<div class="att-pick no-print" role="region" aria-label="Mark this day">' +
    '<div class="att-pick-hd"><div><b>' + esc(st.name || pl.studentId) + '</b> · ' + esc(fmtDate(s.ds)) + ' (' + DOW[parseYMD(s.ds).getDay()] + ')' +
      (hol ? ' · <span class="out">Holiday: ' + esc(hol.name) + '</span>' : "") +
      (!Logic.planDay(pl, s.ds) && !hol ? ' · <span class="muted">not a class day</span>' : "") +
      '<small>' + esc(attNoteLine(c) || when) + (attNoteLine(c) ? " · " + esc(when) : "") + '</small></div>' +
      '<button type="button" class="x" data-act="att-unsel" aria-label="Close">×</button></div>' +
    '<div class="att-pick-row">' + attMarkButtons(s.planId, s.ds, c, true) +
      '<button type="button" class="am big note-btn" data-act="att-note" data-id="' + esc(s.planId) + '" data-ds="' + s.ds + '">Note…</button></div>' +
    '<div class="att-pick-ft">Keys: p a t l s e x d r c · arrows move · Delete clears · Ctrl+Z undo · paste from Google Sheets</div>' +
  '</div>';
}

/* ---- the page ---- */
Pages.iAtt = function(){
  const f = State.iatt, month = State.month;
  if (!window.MQ_ADMIN && Date.now() - ATT_LIVE.at > 60000) setTimeout(() => attPull(false), 50);
  const view = f.view || (window.innerWidth < 700 ? "today" : "month");
  const locked = attLocked(month);
  const R = attRows(month);
  const tools = '<div class="toolbar no-print">' +
    '<div class="seg" role="tablist">' +
      '<button type="button" class="' + (view === "today" ? "on" : "") + '" data-act="att-view" data-id="today">Today list</button>' +
      '<button type="button" class="' + (view === "month" ? "on" : "") + '" data-act="att-view" data-id="month">Month sheet</button></div>' +
    field("Teacher", sel("t", teacherOpts(f.teacher), 'data-fset="iatt.teacher"')) +
    field("Search", '<input class="input" data-fset="iatt.q" value="' + esc(f.q) + '" placeholder="Student, teacher or course">', "grow") +
    '<div class="push btn-row">' +
      '<button type="button" class="btn btn-sm" data-act="att-undo"' + (ATT_UNDO.length ? "" : " disabled") + '>↶ Undo</button>' +
      '<button type="button" class="btn btn-sm" data-act="att-redo"' + (ATT_REDO.length ? "" : " disabled") + '>↷ Redo</button>' +
      '<button type="button" class="btn btn-sm" data-act="att-refresh" title="Bring in marks saved on other devices">↻</button>' +
      ATT_HOOKS.toolbar() +
      (window.MQ_ADMIN ? "" : locked ? '<button type="button" class="btn btn-sm" data-act="att-reopen">🔒 Reopen ' + esc(monthShort(month)) + '</button>'
              : '<button type="button" class="btn btn-sm" data-act="att-close">Close ' + esc(monthShort(month)) + '</button>') +
    '</div></div>';
  const info = '<div class="att-info">' +
    (R.um.count ? '<button type="button" class="chip' + (f.unmarked ? " on" : "") + '" data-act="att-um">⚠ ' + R.um.count + ' unmarked class day' + (R.um.count > 1 ? "s" : "") +
      ' in ' + esc(monthShort(month)) + (f.unmarked ? " · showing only these" : " · show") + '</button>'
      : '<span class="chip ok">✓ No unmarked class days in ' + esc(monthShort(month)) + '</span>') +
    (locked ? '<span class="chip">🔒 ' + esc(monthLabel(month)) + ' is closed</span>' : "") +
    (function(){ const n = R.rows.filter(r => attNoDays(r.pl)).length;
      if (!n) return "";
      const txt = '⚠ ' + n + ' plan' + (n > 1 ? "s have" : " has") + ' no class days set — missed days can\'t be flagged until the days are set ' +
        (window.MQ_ADMIN ? "(tap a student → Change teacher / days)" : "in Class plans");
      return window.MQ_ADMIN ? '<span class="chip warn">' + txt + '</span>' : '<button type="button" class="chip warn" data-act="goto" data-page="plans">' + txt + '</button>'; })() +
    '</div>';
  return tools + info + (view === "today" ? attToday(R) : attMonth(month, R.rows));
};
function attMonth(month, rows){
  const f = State.iatt;
  const brush = '<div class="att-brush no-print"><span class="muted">Brush:</span>' +
    ATT_MARKS.map(m => '<button type="button" class="am m-' + m.k + (f.brush === m.k ? " on" : "") + '" data-act="att-brush" data-id="' + m.k +
      '" title="Tap cells to mark them ' + esc(m.name) + '">' + esc(m.sym) + '</button>').join("") +
    '<button type="button" class="am clr' + (f.brush === "-" ? " on" : "") + '" data-act="att-brush" data-id="-" title="Tap cells to clear them">⌫</button>' +
    (f.brush ? '<button type="button" class="btn btn-sm" data-act="att-brush" data-id="">Stop brush</button>'
             : '<span class="muted small">Pick one to mark many cells with taps, or tap a cell to choose.</span>') + '</div>';
  if (!rows.length) return brush + '<div class="empty"><h4>No class plans in ' + esc(monthLabel(month)) + '</h4>' +
    '<p>Plans active this month appear here as rows. Add a plan in Class plans.</p></div>';
  return brush + '<div class="card"><div class="att-scroll" id="attScroll">' + attGrid(month, rows) + '</div></div>' +
    '<div class="att-legend no-print">' + ATT_MARKS.map(m => '<span><i class="am m-' + m.k + '">' + esc(m.sym) + '</i>' + esc(m.name) + '</span>').join("") +
    '<span><i class="ac um sw"></i>Unmarked</span><span><i class="ac hol sw"></i>Holiday</span><span><i class="ac off sw"></i>No class</span></div>' +
    attPickBar(month);
}
function attToday(R){
  const f = State.iatt, ds = f.date || today();
  const pick = '<div class="no-print" style="display:flex;gap:8px;align-items:center;margin:0 0 12px">' +
    '<button type="button" class="btn" style="min-width:44px" data-act="att-day" data-id="-1" aria-label="Previous day">‹</button>' +
    '<input class="input" type="date" data-act="att-date" value="' + esc(ds) + '" aria-label="Day" style="flex:1;min-width:0;margin:0">' +
    '<button type="button" class="btn" style="min-width:44px" data-act="att-day" data-id="1" aria-label="Next day">›</button>' +
    (ds !== today() ? '<button type="button" class="btn" data-act="att-day" data-id="0">Today</button>' : "") + '</div>';
  const hol = Logic.isHoliday(ds);
  const ids = {};
  R.rows.forEach(r => ids[r.pl.id] = r);
  /* the day's own list (its month may differ from the sheet month) */
  const list = Logic.sheetPlans(monthOf(ds)).filter(pl => {
    const r = ids[pl.id] || (monthOf(ds) !== State.month ? { pl: pl } : null);
    if (!r) return false;
    if (f.teacher && pl.teacherId !== f.teacher) return false;
    const c = DataService.classAt(pl.id, ds);
    return attPossible(pl, ds) || !!c;
  });
  /* plans with class days first; plans whose days are not set yet follow under their own heading */
  list.sort((a, b) => (attNoDays(a) ? 1 : 0) - (attNoDays(b) ? 1 : 0));
  if (hol) return pick + '<div class="empty"><h4>Holiday: ' + esc(hol.name) + '</h4><p>No classes are expected on ' + esc(fmtDate(ds)) + '.</p></div>';
  if (!list.length) return pick + '<div class="empty"><h4>No classes on ' + esc(fmtDate(ds)) + '</h4><p>No class plan meets on this day.</p></div>';
  const done = list.filter(pl => { const c = DataService.classAt(pl.id, ds); return c && c.status !== "Note"; }).length;
  return pick + '<div class="att-count">' + done + ' of ' + list.length + ' marked · ' + esc(fmtDate(ds)) + '</div>' +
    '<div class="att-today">' + list.map(function(pl, i){
      const head = attNoDays(pl) && (i === 0 || !attNoDays(list[i - 1]))
        ? '<div class="att-thead">Class days not set — mark the ones that had a class on this day</div>' : "";
      const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
      const c = DataService.classAt(pl.id, ds), note = attNoteLine(c);
      return head + '<div class="att-trow' + (c && c.status !== "Note" ? " done" : "") + (attNoDays(pl) && !c ? " nodays" : "") + '">' +
        '<div class="att-tinfo"><button type="button" data-act="att-row" data-id="' + esc(pl.id) + '" style="all:unset;cursor:pointer;display:block;font-weight:700;font-size:14.5px" title="Details and changes">' +
          esc(st.name || pl.studentId) + ' <span style="color:var(--muted-2);font-weight:400">›</span></button>' +
          '<small>' + esc((pl.time ? time12(pl.time) + " · " : "") + (t.name || "—") + (pl.course ? " · " + pl.course : "")) + '</small>' +
          (note ? '<small class="att-tnote">' + esc(note) + '</small>' : "") + '</div>' +
        '<div class="att-tbtns">' +
          ["P", "A", "T", "L", "S"].map(k => '<button type="button" class="am big m-' + k + (markOf(c) === k ? " on" : "") +
            '" data-act="att-set" data-id="' + esc(pl.id) + '" data-ds="' + ds + '" data-k="' + k + '" aria-pressed="' + (markOf(c) === k) +
            '" title="' + esc(ATT_MK[k].name) + '">' + esc(ATT_MK[k].sym) + '</button>').join("") +
          '<button type="button" class="am big more' + (["E", "X", "N", "R", "C"].indexOf(markOf(c)) >= 0 ? " on" : "") +
            '" data-act="att-note" data-id="' + esc(pl.id) + '" data-ds="' + ds + '" title="More marks and notes">' +
            (["E", "X", "N", "R", "C"].indexOf(markOf(c)) >= 0 ? esc(attSym(markOf(c))) : "…") + '</button>' +
        '</div></div>';
    }).join("") + '</div>';
}

/* ---- note window: every mark, its own fields, tags and text ---- */
function attNote(planId, ds, preset){
  if (!attCanEdit(monthOf(ds))) return;
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = DataService.getStudent(pl.studentId) || {}, c = DataService.classAt(planId, ds) || {};
  const k0 = preset || markOf(c) || "P";
  const tOpts = sel_ => teacherOpts(sel_, "—");
  const tags = c.tags || [];
  const show = (k, f) => (ATT_FIELDS[k] || []).indexOf(f) >= 0;
  const fld = (f, html, label) => '<div class="field" data-af="' + f + '"' + (show(k0, f) ? "" : ' style="display:none"') + '><label>' + esc(label) + '</label>' + html + '</div>';
  openModal({ title: (st.name || pl.studentId) + " · " + fmtDate(ds), wide: true, submitText: "Save",
    body: '<div class="field span2"><label>Mark</label><select class="select" name="k" data-act="att-nk">' +
        optList(ATT_MARKS.map(m => ({ value: m.k, label: m.sym + "  " + m.name })), k0) + '</select></div>' +
      '<div class="form-grid">' +
      fld("by", sel("takenBy", tOpts(c.takenBy || "")), k0 === "S" ? "Substitute teacher (gets paid)" : "Taken by") +
      fld("mins", '<input class="input" type="number" min="0" name="mins" value="' + esc(c.mins || "") + '" placeholder="' + esc(pl.duration || 45) + '">', "Class minutes") +
      fld("inf", sel("informed", optList([{ value: "", label: "—" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }], c.informed || "")), "Informed / reported") +
      fld("before", '<input class="input" type="number" min="0" name="informedBefore" value="' + esc(c.informedBefore || "") + '">', "Informed how many minutes before") +
      fld("makeup", '<input class="input" type="date" name="makeup" value="' + esc(c.makeup || "") + '">', "Make-up date") +
      fld("until", '<input class="input" type="date" name="leaveUntil" value="' + esc(c.leaveUntil || "") + '">', "Leave until (fills the class days up to it)") +
      fld("portion", '<input class="input" name="portion" value="' + esc(c.portion || "") + '" placeholder="Juz / surah / pages">', "Portion") +
      fld("result", '<input class="input" name="result" value="' + esc(c.result || "") + '" placeholder="Mark or grade">', "Result") +
      '</div>' +
      '<div class="field"><label>Tags</label><div class="att-tags">' + ATT_TAGS.map((tg, i) =>
        '<label class="chip' + (tags.indexOf(tg) >= 0 ? " on" : "") + '"><input type="checkbox" name="tag_' + i + '"' + (tags.indexOf(tg) >= 0 ? " checked" : "") + '> ' + esc(tg) + '</label>').join("") + '</div></div>' +
      '<div class="field"><label>Note</label><textarea class="textarea" name="notes" rows="2">' + esc(c.notes || "") + '</textarea></div>' +
      (c.markedAt ? '<div class="note" style="margin:0">Marked by ' + esc(c.markedBy || "—") + ' · ' + esc(c.markedAt.replace("T", " ").slice(0, 16)) + ' UTC</div>' : ""),
    onSubmit: function(d){
      const k = d.k;
      if (k === "S" && !d.takenBy) { toast("Choose the substitute teacher — they are paid for this class", "bad"); return false; }
      if (k === "S" && d.takenBy === pl.teacherId) { toast("The substitute must be a different teacher", "bad"); return false; }
      const extra = { takenBy: d.takenBy || "", mins: d.mins ? +d.mins : "", informed: d.informed || "",
        informedBefore: d.informedBefore ? +d.informedBefore : "", makeup: d.makeup || "", leaveUntil: d.leaveUntil || "",
        portion: (d.portion || "").trim(), result: (d.result || "").trim(),
        tags: ATT_TAGS.filter((tg, i) => d["tag_" + i]), notes: (d.notes || "").trim() };
      let list = [{ planId: planId, ds: ds, k: k, extra: extra }];
      if (k === "L" && extra.leaveUntil) list = list.concat(attLeaveFill(pl, ds, extra.leaveUntil));
      attWrite(list, "note");
      toast(list.length > 1 ? "Saved · leave filled on " + (list.length - 1) + " more class day" + (list.length > 2 ? "s" : "") : "Saved", "ok");
      render();
    } });
}

/* ---- keyboard, paste ---- */
function attMove(dx, dy){
  const s = State.iatt.sel; if (!s) return;
  const month = State.month, rows = attRows(month).rows;
  let ri = rows.findIndex(r => r.pl.id === s.planId), d = +s.ds.slice(8);
  if (ri < 0) return;
  ri = Math.max(0, Math.min(rows.length - 1, ri + dy));
  d = Math.max(1, Math.min(daysInMonth(month), d + dx));
  State.iatt.sel = { planId: rows[ri].pl.id, ds: month + "-" + pad2(d) };
}
function attNextDay(){
  const s = State.iatt.sel; if (!s) return;
  const pl = DataService.getPlan(s.planId), month = monthOf(s.ds);
  for (let d = +s.ds.slice(8) + 1; d <= daysInMonth(month); d++) {
    const ds = month + "-" + pad2(d);
    if (pl && attPossible(pl, ds)) { State.iatt.sel = { planId: s.planId, ds: ds }; return; }
  }
}
document.addEventListener("keydown", function(e){
  if (State.page !== "iAtt" || $("#mScrim")) return;
  const tg = e.target.tagName;
  if (tg === "INPUT" || tg === "SELECT" || tg === "TEXTAREA") return;
  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); Actions[e.shiftKey ? "att-redo" : "att-undo"](); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); Actions["att-redo"](); return; }
  const s = State.iatt.sel; if (!s || e.ctrlKey || e.metaKey || e.altKey) return;
  const mv = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (mv) { e.preventDefault(); attMove(mv[0], mv[1]); render(); return; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); if (attCanEdit(monthOf(s.ds))) { attWrite([{ planId: s.planId, ds: s.ds, k: "" }], "clear"); render(); } return; }
  if (e.key === "Enter") { e.preventDefault(); attNote(s.planId, s.ds); return; }
  const hit = ATT_MARKS.find(m => m.key === e.key.toLowerCase());
  if (hit) {
    e.preventDefault();
    if (hit.k === "S") { attMark(s.planId, s.ds, "S"); return; }
    if (!attCanEdit(monthOf(s.ds))) return;
    attWrite([{ planId: s.planId, ds: s.ds, k: hit.k }], "mark");
    attNextDay(); render();
  }
});
/* paste a block copied from Google Sheets: rows go down the sheet, columns across the days */
document.addEventListener("paste", function(e){
  if (State.page !== "iAtt" || $("#mScrim") || !State.iatt.sel) return;
  const tg = e.target.tagName;
  if (tg === "INPUT" || tg === "SELECT" || tg === "TEXTAREA") return;
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if (!text) return;
  e.preventDefault();
  const s = State.iatt.sel, month = monthOf(s.ds);
  if (!attCanEdit(month)) return;
  const rows = attRows(month).rows, r0 = rows.findIndex(r => r.pl.id === s.planId), d0 = +s.ds.slice(8);
  const list = []; let skipped = 0;
  text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1).forEach(function(line, ri){
    const row = rows[r0 + ri]; if (!row) return;
    line.split("\t").forEach(function(cell, ci){
      const d = d0 + ci; if (d > daysInMonth(month)) return;
      const k = attFromText(cell);
      if (!String(cell).trim()) return;
      if (!k) { skipped++; return; }
      list.push({ planId: row.pl.id, ds: month + "-" + pad2(d), k: k === "S" ? "P" : k });
    });
  });
  if (!list.length) { toast("Nothing in the clipboard looked like a mark", "warn"); return; }
  attWrite(list, "paste");
  toast(list.length + " marks pasted" + (skipped ? " · " + skipped + " cells not understood" : "") +
    (text.match(/sub/i) ? " · Substitute cells were pasted as ✓ — set the substitute teacher on each" : ""), "ok", 5200);
  render();
});

/* ---- other devices: pull their marks in while this page is open ---- */
const ATT_LIVE = { busy: false, at: 0 };
function attRedraw(){
  const sc = $("#attScroll"), x = sc ? sc.scrollLeft : 0, y = window.scrollY;
  render(); const sc2 = $("#attScroll"); if (sc2) sc2.scrollLeft = x; window.scrollTo(0, y);
}
async function attPull(force){
  if (ATT_LIVE.busy || typeof Supa === "undefined" || !Supa.on() || !Supa.refresh) return { changed: 0 };
  const live = window.MQ_ADMIN || State.page === "iAtt" || State.page === "tpay";
  if (!force && (!live || document.hidden)) return { changed: 0 };
  ATT_LIVE.busy = true;
  try {
    const colls = ["classes", "plans", "students", "teachers", "holidays"].concat(window.MQ_ADMIN ? ["settings"] : []);
    const r = await Supa.refresh(colls);
    ATT_LIVE.at = Date.now();
    if (r.changed && !$("#mScrim") && (State.page === "iAtt" || State.page === "tpay")) attRedraw();
    if (window.MQ_ADMIN && typeof attAdminCheck === "function") attAdminCheck();
    return r;
  } finally { ATT_LIVE.busy = false; }
}
setInterval(() => attPull(false), 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - ATT_LIVE.at > 20000) attPull(false); });

/* ---- Admin links (office only): one secret link per class admin ---- */
function attLinkUrl(token){ return location.origin + "/portal/attendance/#k=" + token; }
function attNewToken(){
  const a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a);
  return btoa(String.fromCharCode.apply(null, Array.from(a))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function attAdminsBody(){
  const links = Settings().attAdminLinks || [];
  return '<div class="note">Each class admin gets their own link. Anyone holding a link can use the attendance page, so send it only to that person. ' +
      'Switch a link off and it stops working within a minute.</div>' +
    (links.length ? links.map(function(l, i){
      return '<div class="minirow" style="flex-wrap:wrap;gap:6px"><span><b>' + esc(l.name) + '</b>' + (l.active ? "" : ' <span class="out">· switched off</span>') +
        '<br><small class="mono">' + esc(attLinkUrl(l.token)).slice(0, 60) + '…</small></span><span class="btn-row">' +
        (l.active ? '<button type="button" class="btn btn-sm" data-act="att-admin-copy" data-id="' + i + '">Copy link</button>' +
          '<button type="button" class="btn btn-sm btn-wa" data-act="att-admin-wa" data-id="' + i + '">WhatsApp</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-act="att-admin-off" data-id="' + i + '">Switch off</button>'
          : '<button type="button" class="btn btn-sm" data-act="att-admin-on" data-id="' + i + '">Switch on</button>') + '</span></div>';
    }).join("") : '<div class="minirow"><span>No admin links yet</span><b>—</b></div>') +
    '<div class="form-grid" style="margin-top:12px">' +
      field("Admin's name", '<input class="input" name="name" placeholder="e.g. Farisa">') +
      field("WhatsApp (optional)", '<input class="input mono" name="phone" placeholder="91…">') + '</div>';
}
function attSaveLinks(links){ DataService.saveSettings({ attAdminLinks: links }); }
Object.assign(Actions, {
  "att-admins": () => openModal({ title: "Attendance admin links", wide: true, submitText: "Make a new link", body: attAdminsBody(),
    onSubmit: function(d){
      const name = String(d.name || "").trim();
      if (!name) { toast("Type the admin's name", "bad"); return false; }
      const links = (Settings().attAdminLinks || []).slice();
      links.push({ token: attNewToken(), name: name, phone: String(d.phone || "").replace(/\D/g, ""), active: true, created: today() });
      attSaveLinks(links); toast("Link made for " + name, "ok");
      setTimeout(() => Actions["att-admins"](), 50);
    } }),
  "att-admin-copy": (i) => {
    const l = (Settings().attAdminLinks || [])[+i]; if (!l) return;
    const url = attLinkUrl(l.token);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link copied", "ok"), () => prompt("Copy this link", url));
    else prompt("Copy this link", url);
  },
  "att-admin-wa": (i) => {
    const l = (Settings().attAdminLinks || [])[+i]; if (!l) return;
    const msg = "Assalamu Alaikum " + l.name + ",\n\nThis is your attendance link for " + (Settings().academyName || "ManzilulQuran") +
      ". Please keep it private — it works like a password.\n" + attLinkUrl(l.token);
    window.open(Logic.waLink(l.phone || "", msg), "_blank");
  },
  "att-admin-off": (i) => { const links = (Settings().attAdminLinks || []).slice(); if (!links[+i]) return;
    links[+i] = Object.assign({}, links[+i], { active: false }); attSaveLinks(links); toast(links[+i].name + "'s link switched off", "ok"); Actions["att-admins"](); },
  "att-admin-on": (i) => { const links = (Settings().attAdminLinks || []).slice(); if (!links[+i]) return;
    links[+i] = Object.assign({}, links[+i], { active: true }); attSaveLinks(links); toast(links[+i].name + "'s link switched on", "ok"); Actions["att-admins"](); },
  "att-refresh": async () => { const r = await attPull(true); toast(r && r.changed ? r.changed + " change" + (r.changed > 1 ? "s" : "") + " brought in" : "Up to date", "ok"); attRedraw(); }
});

/* ---- actions ---- */
Object.assign(Actions, {
  "att-view": (v) => { State.iatt.view = v; render(); },
  "att-um": () => { State.iatt.unmarked = !State.iatt.unmarked; if (State.iatt.unmarked) State.iatt.view = "month"; render(); },
  "att-day": (n) => {
    if (+n === 0) State.iatt.date = today();
    else { const d = parseYMD(State.iatt.date || today()); d.setDate(d.getDate() + (+n)); State.iatt.date = ymd(d); }
    render();
  },
  "att-date": (id, el) => { if (el.value) { State.iatt.date = el.value; render(); } },
  "att-cell": (planId, el) => {
    const ds = el.dataset.ds, b = State.iatt.brush;
    if (b) {
      if (!attCanEdit(monthOf(ds))) return;
      if (b === "S") { attNote(planId, ds, "S"); return; }
      attWrite([{ planId: planId, ds: ds, k: b === "-" ? "" : b }], "brush");
      State.iatt.sel = { planId: planId, ds: ds };
      const sc = $("#attScroll"), x = sc ? sc.scrollLeft : 0;
      render(); const sc2 = $("#attScroll"); if (sc2) sc2.scrollLeft = x;
      return;
    }
    State.iatt.sel = { planId: planId, ds: ds };
    const sc = $("#attScroll"), x = sc ? sc.scrollLeft : 0, y = window.scrollY;
    render(); const sc2 = $("#attScroll"); if (sc2) sc2.scrollLeft = x; window.scrollTo(0, y);
  },
  "att-set": (planId, el) => {
    const sc = $("#attScroll"), x = sc ? sc.scrollLeft : 0, y = window.scrollY;
    attMark(planId, el.dataset.ds, el.dataset.k);
    const sc2 = $("#attScroll"); if (sc2) sc2.scrollLeft = x; window.scrollTo(0, y);
  },
  "att-note": (planId, el) => attNote(planId, el.dataset.ds),
  "att-nk": (id, el) => {
    const form = $("#mForm"); if (!form) return;
    form.querySelectorAll("[data-af]").forEach(function(box){
      box.style.display = (ATT_FIELDS[el.value] || []).indexOf(box.dataset.af) >= 0 ? "" : "none";
      if (box.dataset.af === "by") box.querySelector("label").textContent = el.value === "S" ? "Substitute teacher (gets paid)" : "Taken by";
    });
  },
  "att-unsel": () => { State.iatt.sel = null; render(); },
  "att-brush": (k) => { State.iatt.brush = k || ""; render(); },
  "att-undo": () => {
    const u = ATT_UNDO.pop(); if (!u) { toast("Nothing to undo", "warn"); return; }
    ATT_REDO.push({ label: u.label, items: attRestore(u.items) }); toast("Undone: " + u.label, "ok"); render();
  },
  "att-redo": () => {
    const u = ATT_REDO.pop(); if (!u) { toast("Nothing to redo", "warn"); return; }
    ATT_UNDO.push({ label: u.label, items: attRestore(u.items) }); toast("Redone: " + u.label, "ok"); render();
  },
  "att-close": () => {
    const m = State.month;
    const um = Logic.unmarked(m).count;
    confirmAction({ title: "Close " + monthLabel(m), danger: um > 0,
      note: (um ? "⚠ " + um + " class days in " + monthLabel(m) + " still have no mark. " : "") +
        "Closing marks the month as finished: changing a mark afterwards asks for confirmation first. Do it after payroll and reconciliation.",
      message: "Close " + monthLabel(m) + " for attendance?", submitText: "Close the month",
      onConfirm: function(){
        const cur = Settings().attLockedThrough || "";
        if (m > cur) DataService.saveSettings({ attLockedThrough: m });
        toast(monthLabel(m) + " closed", "ok"); render();
      } });
  },
  "att-reopen": () => {
    const m = State.month;
    confirmAction({ title: "Reopen " + monthLabel(m),
      note: "This also reopens every later closed month. Recalculate fees and check Teacher pay after any change.",
      message: "Reopen " + monthLabel(m) + "?", submitText: "Reopen",
      onConfirm: function(){ DataService.saveSettings({ attLockedThrough: addMonths(m, -1) }); toast(monthLabel(m) + " reopened", "ok"); render(); } });
  },
  "att-row": (planId) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
    const month = State.month, um = (Logic.unmarked(month).lines.find(l => l.planId === planId) || { dates: [] }).dates;
    const tt = attTotals(pl, month);
    openModal({ title: (st.name || pl.studentId) + " · " + monthLabel(month), wide: true, hideSubmit: true, cancelText: "Close",
      body: dl([["Student", esc(st.name || "") + " " + idchip(pl.studentId)], ["Plan", idchip(pl.id) + " " + esc(pl.course || "")],
          ["Teacher", esc(t.name || "—")], ["Class days", ((pl.days || []).length ? esc(pl.days.join(", ")) : '<span class="out">Not set — set them in Class plans so missed days are flagged</span>') + (pl.time ? " · " + esc(time12(pl.time)) : "")],
          ["This month", tt.p + " present · " + tt.a + " absent · " + tt.t + " teacher absent · " + tt.l + " leave · " + tt.s + " substitute"],
          ["Unmarked", um.length ? '<span class="out">' + um.length + ' day' + (um.length > 1 ? "s" : "") + ': ' + um.map(d => +d.slice(8)).join(", ") + '</span>' : "None"]]) +
        '<div class="btn-row" style="margin-top:12px">' +
          (um.length ? '<button type="button" class="btn btn-primary" data-act="att-fill" data-id="' + esc(planId) + '">Mark the ' + um.length + ' unmarked day' + (um.length > 1 ? "s" : "") + ' ✓ Present</button>' : "") +
          ATT_HOOKS.rowButtons(pl) +
          (window.MQ_ADMIN ? "" : '<button type="button" class="btn" data-act="profile-open" data-id="' + esc(pl.studentId) + '">Open student</button>') +
        '</div>' });
  },
  "att-fill": (planId) => {
    const month = State.month;
    if (!attCanEdit(month)) return;
    const um = (Logic.unmarked(month).lines.find(l => l.planId === planId) || { dates: [] }).dates;
    const n = attWrite(um.map(ds => ({ planId: planId, ds: ds, k: "P" })), "fill row");
    closeModal(); toast(n + " day" + (n > 1 ? "s" : "") + " marked ✓ Present — Undo if that was not right", "ok", 4200); render();
  },
  "att-full": () => {
    if (State.page !== "iAtt") return;
    const rows = attRows(State.month).rows;
    openFullView("Attendance · " + monthLabel(State.month), '<div class="att-scroll full">' + attGrid(State.month, rows, true) + '</div>');
  }
});
