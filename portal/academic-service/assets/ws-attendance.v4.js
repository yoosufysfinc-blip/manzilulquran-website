"use strict";
/* Academic Service — ws-attendance.v4.js. v4: a quieter sheet.
     · one clean top bar: tap the month to jump, a save dot, ⋯ — the month tabs, the counts line and the refresh button are gone
     · the marks are one compact control; teacher and find sit together; three totals (Present, Absent, %) instead of seven;
       a paid fee is a quiet dot, a fee that needs action is a word
     · the office copy wears the Academy Manager look; the class-admin link (/portal/attendance/) wears the Class Sheets look
       (html.adm-skin — styles in att-sheet.v2.css)
     · motion: the sheet slides in, a new view rises, a changed day pops, the picker and menus rise, the tab marker slides —
       only when something changed, never on a plain repaint; reduced motion is respected
     · Admin links: edit a name or number, switch on or off, make a new secret link (the old one stops), delete a switched-off
       link; the same list sits on Settings → Attendance admin links
   (v3: the full-screen sheet — Today / Sheet / Class days / Make-ups / Results, WhatsApp to a parent, fee badge, reports, drag rows.)
   Shared by Academic Service and the class-admin link. Data rules unchanged from v2:
   every mark is one record in mq_classes with the fixed ID plan + date (DataService.classKey). Batch classes are not here. */

/* ---- register the page ---- */
(function(){
  const manage = WS.ind.nav.find(g => g[0] === "Manage");
  if (manage && !manage[1].some(x => x[0] === "iAtt")) manage[1].unshift(["iAtt", "▦", "Attendance", "Attendance"]);
  PAGE_WS.iAtt = "ind";
  PAGE_SUB.iAtt = "Mark each class day. Marks go straight into the class log — fees, reconciliation and teacher pay read them.";
  HEAD_ACTS.iAtt = "";
})();
function attActor(){ return window.ATT_ACTOR || { name: Settings().markerName || "Academic Service", via: "academic-service" }; }
/* hooks the class-admin link fills in (att-admin): extra buttons on a student's window, and the items under + Add */
const ATT_HOOKS = { toolbar: () => "", rowButtons: () => "", addItems: () => [] };
if (window.MQ_ADMIN) document.documentElement.classList.add("adm-skin");
/* motion bookkeeping: what changed since the last paint, so only that moves */
const ATT_FX = { cells: {}, menu: false, add: false, pick: "", ind: null, save: "", bulk: false };
function attCalm(){ try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } }

State.iatt = { tab: "", date: today(), teacher: "", q: "", unmarked: false, mode: "select", brush: "P", sel: null, open: {},
  menu: false, add: false, pick: {}, bulkDays: [], bulkTime: "", onlyNoDays: false, shrink: null };
const ATT_TAGS = ["Starts", "Restarts", "Stopped", "Class finished", "Paused", "Teacher changed", "Rescheduled",
  "Payment pending", "Payment done", "Juz submitted"];
const ATT_FIELDS = { P: ["by", "mins", "makeup"], A: ["inf", "before"], T: ["inf", "makeup"], L: ["inf", "until"],
  S: ["by", "mins"], E: ["portion", "result", "by"], X: ["portion", "result", "by"], N: [], R: ["makeup"], C: [] };
const ATT_LABEL = { P: "Present", A: "Abs-S", T: "Abs-T", L: "Leave", S: "Sub", E: "Exam", X: "Test", N: "Note", R: "Resch.", C: "Cancel" };
const ATT_TEXT = { "✅": "P", "✓": "P", "✔": "P", "p": "P", "present": "P", "❌s": "A", "✕s": "A", "xs": "A", "a": "A", "absent": "A",
  "❌t": "T", "✕t": "T", "xt": "T", "t": "T", "leave": "L", "lv": "L", "l": "L", "sub": "S", "s": "S", "substitute": "S",
  "exa": "E", "exam": "E", "e": "E", "test": "X", "x": "X", "⚫": "N", "●": "N", "n": "N", "note": "N",
  "r": "R", "rescheduled": "R", "c": "C", "cancelled": "C" };
const ATT_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z"/></svg>';
function attFromText(s){
  const n = String(s == null ? "" : s).replace(/️/g, "").trim().toLowerCase();
  if (!n) return "";
  return ATT_TEXT[n] || ATT_TEXT[n.replace(/\s+/g, "")] || "";
}
const ATT_UNDO = [], ATT_REDO = [];
/* per-device conveniences: theme, zoom, row order (never needed by anyone else) */
function attPref(k, v){
  const key = "mq_att_" + k;
  try { if (v === undefined) { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } localStorage.setItem(key, JSON.stringify(v)); } catch (e) {}
  return null;
}
function attTheme(){ return attPref("theme") || "auto"; }
function attZoom(){ const z = +attPref("zoom"); return z >= 0.7 && z <= 1.6 ? z : 1; }

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
  const keep = ATT_FIELDS[k] || [];
  if (keep.indexOf("by") < 0) x.takenBy = "";
  if (keep.indexOf("mins") < 0) x.mins = "";
  if (keep.indexOf("inf") < 0) x.informed = "";
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
function attWrite(list, label, noUndo){
  const undo = [];
  list.forEach(function(it){
    const pl = DataService.getPlan(it.planId); if (!pl) return;
    ATT_FX.cells[it.planId + "|" + it.ds] = 1;
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
    ATT_FX.cells[u.planId + "|" + u.ds] = 1;
    const cur = DataService.classAt(u.planId, u.ds);
    back.push({ planId: u.planId, ds: u.ds, before: cur ? JSON.parse(JSON.stringify(cur)) : null });
    if (cur) DB.classes = DB.classes.filter(c => c !== cur);
    if (u.before) DB.classes.push(u.before);
    Cache.clear();
  });
  persist();
  return back;
}
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

/* ---- rows ---- */
function attNoDays(pl){ return !(pl.days || []).length; }
function attPossible(pl, ds){
  if (pl.startDate && ds < pl.startDate) return false;
  if (pl.endDate && ds > pl.endDate) return false;
  if (Logic.isHoliday(ds)) return false;
  return attNoDays(pl) || (pl.days || []).indexOf(DOW[parseYMD(ds).getDay()]) >= 0;
}
/* rows follow the order you dragged them into (kept on this device); new plans join by class time */
function attOrdered(plans){
  const order = attPref("order") || [];
  if (!order.length) return plans;
  const pos = {}; order.forEach((id, i) => pos[id] = i);
  return plans.map((p, i) => ({ p: p, i: i })).sort(function(a, b){
    const x = pos[a.p.id], y = pos[b.p.id];
    if (x !== undefined && y !== undefined) return x - y;
    if (x !== undefined) return -1;
    if (y !== undefined) return 1;
    return a.i - b.i;
  }).map(o => o.p);
}
function attRows(month){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim();
  const um = Logic.unmarked(month);
  const umSet = {}; um.lines.forEach(l => umSet[l.planId] = l.dates.length);
  return { um: um, rows: attOrdered(Logic.sheetPlans(month)).map(function(pl){
    const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
    return { pl: pl, st: st, name: st.name || pl.studentId, teacher: t.name || "—", unmarked: umSet[pl.id] || 0 };
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
/* fee status for each plan this month (office only — the admin link has no fees) */
function attFeeMap(month){
  if (window.MQ_ADMIN || !DB.fees || !DB.fees.length) return {};
  const map = {};
  /* by class; a fee with no class (older imported fees) shows on that student's rows. The worst state wins. */
  const rank = s => ({ Overdue: 6, "Due Today": 5, Partial: 4, "Needs amount": 3, Paid: 1, Waived: 1, Nil: 0 }[s] || 2);
  const put = (k, v) => { if (!map[k] || rank(v.status) > rank(map[k].status)) map[k] = v; };
  try {
    Logic.feeViews({ month: month, source: "individual" }).forEach(v => {
      if (v.feeType === "admission") return;
      if (v.planId) put(v.planId, v); else if (v.studentId) put("s:" + v.studentId, v);
    });
  } catch (e) {}
  return map;
}
/* a paid fee is a quiet dot, a fee not due yet a hollow one; only what needs action gets a word */
function attFeeBadge(v){
  if (!v || v.status === "Nil") return "";
  const s = v.status, tip = esc(monthLabel(v.month) + " fee · " + (s === "Upcoming" ? "due " + fmtDate(v.dueDate) : s));
  if (s === "Paid" || s === "Waived") return '<span class="ax-fee ok" title="' + tip + '" role="img" aria-label="' + tip + '"></span>';
  if (s === "Upcoming") return '<span class="ax-fee up" title="' + tip + '" role="img" aria-label="' + tip + '"></span>';
  const cls = s === "Overdue" ? "fee-bad" : "fee-due";
  const txt = s === "Overdue" ? "Overdue" : s === "Partial" ? "Part paid" : s === "Needs amount" ? "Fee not set" : s === "Due Today" ? "Due today" : s;
  return '<span class="ax-st ' + cls + '" title="' + tip + '">' + esc(txt) + '</span>';
}

/* ---- WhatsApp to a parent ---- */
function attAbsentText(st, pl, ds){
  const tpl = Settings().absentWaText ||
    "Assalamu Alaikum. {name} was absent from the {course} class on {date}. Please let us know if everything is fine.\n\n{academy}";
  return tpl.replace(/\{name\}/g, st.name || "").replace(/\{course\}/g, pl.course || "").replace(/\{date\}/g, fmtDate(ds))
    .replace(/\{academy\}/g, Settings().academyName || "ManzilulQuran");
}

/* ---- note window: every mark, its own fields, tags and text ---- */
function attNote(planId, ds, preset, extraPreset){
  if (!attCanEdit(monthOf(ds))) return;
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = DataService.getStudent(pl.studentId) || {}, c = Object.assign({}, DataService.classAt(planId, ds) || {}, extraPreset || {});
  const k0 = preset || markOf(c) || "P";
  const tags = c.tags || [];
  const show = (k, f) => (ATT_FIELDS[k] || []).indexOf(f) >= 0;
  const fld = (f, html, label) => '<div class="field" data-af="' + f + '"' + (show(k0, f) ? "" : ' style="display:none"') + '><label>' + esc(label) + '</label>' + html + '</div>';
  openModal({ title: (st.name || pl.studentId) + " · " + fmtDate(ds), wide: true, submitText: "Save",
    body: '<div class="field span2"><label>Mark</label><select class="select" name="k" data-act="att-nk">' +
        optList(ATT_MARKS.map(m => ({ value: m.k, label: m.sym + "  " + m.name })), k0) + '</select></div>' +
      '<div class="form-grid">' +
      fld("by", sel("takenBy", teacherOpts(c.takenBy || "", "—")), k0 === "S" ? "Substitute teacher (gets paid)" : "Taken by") +
      fld("mins", '<input class="input" type="number" min="0" name="mins" value="' + esc(c.mins || "") + '" placeholder="' + esc(pl.duration || 45) + '">', "Class minutes") +
      fld("inf", sel("informed", optList([{ value: "", label: "—" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }], c.informed || "")), "Informed / reported") +
      fld("before", '<input class="input" type="number" min="0" name="informedBefore" value="' + esc(c.informedBefore || "") + '">', "Informed how many minutes before") +
      fld("makeup", '<input class="input" type="date" name="makeup" value="' + esc(c.makeup || "") + '">', k0 === "P" ? "Make-up for (the missed day)" : "Make-up on") +
      fld("until", '<input class="input" type="date" name="leaveUntil" value="' + esc(c.leaveUntil || "") + '">', "Leave until (fills the class days up to it)") +
      fld("portion", '<input class="input" name="portion" value="' + esc(c.portion || "") + '" placeholder="Juz / surah / pages">', "Portion") +
      fld("result", '<input class="input" name="result" value="' + esc(c.result || "") + '" placeholder="Mark or grade">', "Result") +
      '</div>' +
      '<div class="field"><label>Tags</label><div class="chips">' + ATT_TAGS.map((tg, i) =>
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

/* ==========================================================================
   THE SHEET — a full-screen layer over the page while Attendance is open
   ========================================================================== */
function attTab(){ return State.iatt.tab || (window.innerWidth < 761 ? "today" : "sheet"); }
function attPending(){
  if (typeof SupaTrack === "undefined" || !SupaTrack.base) return 0;
  let n = 0;
  ["students", "teachers", "plans", "classes"].forEach(function(c){
    const base = SupaTrack.base[c] || {}, seen = {};
    (DB[c] || []).forEach(r => { if (!r || !r.id) return; seen[r.id] = 1; if (base[r.id] !== JSON.stringify(r)) n++; });
    Object.keys(base).forEach(id => { if (!seen[id]) n++; });
  });
  return n + ((typeof Supa !== "undefined" && Supa.claimQueue) ? Supa.claimQueue.length : 0);
}
/* the save state: a dot that is calm when everything is saved, and pulses while something waits to send */
function attSaveState(){
  const n = attPending(), off = !navigator.onLine;
  const st = n ? "wait" : off ? "off" : "ok";
  const txt = n ? (off ? "Offline · " : "") + n + " to send" : off ? "Offline" : "Saved";
  const tip = n ? n + " change" + (n > 1 ? "s" : "") + " waiting to send" + (off ? " — they go when you are back online" : "")
    : off ? "Offline — everything is kept on this device" : "All saved";
  return '<span class="ax-save ' + st + '" id="axSave" title="' + esc(tip) + '" role="status"><i aria-hidden="true"></i><em>' + esc(txt) + '</em></span>';
}
function attSaveText(){ ATT_FX.save = attSaveState(); return ATT_FX.save; }
setInterval(function(){
  const el = document.getElementById("axSave"); if (!el) return;
  const h = attSaveState(); if (h !== ATT_FX.save) { el.outerHTML = h; ATT_FX.save = h; }
}, 2500);

/* ---- top bar: brand, the month (tap it to jump), save dot, ⋯ ---- */
function attMonthSelect(month){
  const cur = currentMonth();
  let ms = allMonths();
  if (ms.indexOf(month) < 0) ms = ms.concat([month]).sort();
  return '<select class="ax-msel" data-act="ax-pickmonth" aria-label="Choose a month">' + ms.slice().reverse().map(m =>
    '<option value="' + m + '"' + (m === month ? " selected" : "") + '>' + esc(monthLabel(m)) + (m === cur ? " · this month" : "") + '</option>').join("") + '</select>';
}
function attTop(month, R){
  const s = Settings(), admin = !!window.MQ_ADMIN;
  const rev = !admin && typeof revCount === "function" ? revCount() : 0;
  const who = admin && window.ATT_ACTOR ? window.ATT_ACTOR.name : "";
  return '<header class="ax-top">' +
    '<div class="ax-brand"><span class="ax-logo" aria-hidden="true"></span><div class="ax-bt">' +
      (admin ? '<b>Class <em>Attendance</em></b><small>' + esc(who ? "Marking as " + who : (s.academyName || "ManzilulQuran")) + '</small>'
             : '<b>Attendance</b><small>Individual classes</small>') + '</div></div>' +
    '<div class="ax-ttl">' +
      '<button type="button" class="ax-nav" data-act="ax-month" data-id="-1" aria-label="Previous month">‹</button>' +
      '<label class="ax-mon" title="Choose a month"><span class="lg">' + esc(monthLabel(month)) + '</span><span class="sm">' + esc(monthShort(month)) + '</span>' +
        (attLocked(month) ? '<span class="lk" title="Closed by the office">🔒</span>' : "") + '<span class="cv" aria-hidden="true"></span>' + attMonthSelect(month) + '</label>' +
      '<button type="button" class="ax-nav" data-act="ax-month" data-id="1" aria-label="Next month">›</button>' +
    '</div>' +
    '<div class="ax-topr">' +
      (rev ? '<button type="button" class="ax-pill warn" data-act="ax-go" data-id="iRev">' + rev + ' to review</button>' : "") +
      attSaveText() +
      '<button type="button" class="ax-ib" data-act="ax-menu" aria-label="More" aria-haspopup="menu" aria-expanded="' + !!State.iatt.menu + '">⋯</button>' +
      (admin ? "" : '<button type="button" class="ax-ib" data-act="ax-exit" title="Back to Academic Service" aria-label="Close attendance">✕</button>') +
    '</div></header>';
}
function attHookHtml(h){
  return String(h || "").replace(/class="btn btn-sm btn-primary"/g, 'class="ax-pill primary"').replace(/class="btn btn-sm"/g, 'class="ax-pill"')
    .replace(/class="btn btn-primary"/g, 'class="ax-pill primary"').replace(/class="btn btn-danger"/g, 'class="ax-pill bad"').replace(/class="btn"/g, 'class="ax-pill"');
}
/* the ten marks and Clear as one compact control (names and keys in the tooltip) */
function attMarkChips(){
  const f = State.iatt, b = f.mode === "brush" ? f.brush : null;
  return '<div class="ax-marks" role="toolbar" aria-label="Marks">' + ATT_MARKS.map(m =>
    '<button type="button" class="mkb m-' + m.k + (b === m.k ? " on" : "") + '" data-act="ax-mk" data-id="' + m.k + '" title="' + esc(m.name + " · key " + m.key) +
      '" aria-label="' + esc(m.name) + '">' + esc(m.sym) + '</button>').join("") +
    '<button type="button" class="mkb clr' + (b === "-" ? " on" : "") + '" data-act="ax-mk" data-id="-" title="Clear · Delete" aria-label="Clear">⌫</button></div>';
}
/* teacher and find, folded into one control */
function attFilter(){
  const f = State.iatt;
  return '<div class="ax-filter' + (f.teacher || f.q ? " on" : "") + '">' +
    '<select class="ax-sel" data-fset="iatt.teacher" aria-label="Teacher">' + teacherOpts(f.teacher) + '</select>' +
    '<span class="ax-findw"><input class="ax-find" type="search" data-fset="iatt.q" value="' + esc(f.q) + '" placeholder="Find" aria-label="Find a student or teacher" autocomplete="off"></span>' +
  '</div>';
}
/* class-admin link: + Add opens Student / Class / Teacher */
function attAddMenu(){
  const items = ATT_HOOKS.addItems ? ATT_HOOKS.addItems() : [];
  if (!items.length) return attHookHtml(ATT_HOOKS.toolbar());
  return '<div class="ax-addw"><button type="button" class="ax-pill primary" data-act="ax-add" aria-haspopup="menu" aria-expanded="' + !!State.iatt.add + '">＋ Add</button>' +
    (State.iatt.add ? '<div class="ax-pop' + (ATT_FX.add ? " in" : "") + '" role="menu">' + items.map(it =>
      '<button type="button" class="ax-mi" role="menuitem" data-act="' + esc(it[0]) + '">' + esc(it[1]) + '</button>').join("") + '</div>' : "") + '</div>';
}
function attTools(tab, month, R){
  const f = State.iatt;
  const right = extra => '<span class="sp"></span>' + (extra || "") + attFilter() + attAddMenu();
  if (tab === "days") return '<div class="ax-tools"><button type="button" class="ax-pill' + (f.onlyNoDays ? " on" : "") + '" data-act="ax-nodays" aria-pressed="' + !!f.onlyNoDays + '">No class days only</button>' + right() + '</div>';
  if (tab === "makeups") return '<div class="ax-tools">' + right() + '</div>';
  if (tab === "results") return '<div class="ax-tools"><button type="button" class="ax-pill" data-act="ax-rep-results">Print results</button>' + right() + '</div>';
  const ur = '<div class="ax-ur"><button type="button" class="ax-ib sm" data-act="att-undo" title="Undo (Ctrl+Z)" aria-label="Undo"' + (ATT_UNDO.length ? "" : " disabled") + '>↶</button>' +
    '<button type="button" class="ax-ib sm" data-act="att-redo" title="Redo" aria-label="Redo"' + (ATT_REDO.length ? "" : " disabled") + '>↷</button></div>';
  const um = R.um.count ? '<button type="button" class="ax-pill ' + (f.unmarked ? "on" : "bad") + '" data-act="att-um" aria-pressed="' + !!f.unmarked +
    '" title="Show only the rows with unmarked class days">' + R.um.count + ' unmarked</button>' : "";
  if (tab === "today") return '<div class="ax-tools">' + ur + right(um) + '</div>';
  return '<div class="ax-tools">' +
    '<div class="ax-seg modeseg" role="group" aria-label="Mode"><button type="button" class="' + (f.mode === "select" ? "on" : "") + '" data-act="ax-mode" data-id="select">Select</button>' +
      '<button type="button" class="' + (f.mode === "brush" ? "on" : "") + '" data-act="ax-mode" data-id="brush">Brush</button></div>' +
    attMarkChips() + ur + right(um) + '</div>';
}
function attDock(tab){
  if (tab !== "sheet") return "";
  const f = State.iatt;
  return '<div class="ax-dock" role="toolbar" aria-label="Marking tools">' +
    '<div class="modes"><button type="button" class="' + (f.mode === "select" ? "on" : "") + '" data-act="ax-mode" data-id="select">Select</button>' +
      '<button type="button" class="' + (f.mode === "brush" ? "on" : "") + '" data-act="ax-mode" data-id="brush">Brush</button></div>' +
    '<div class="dm">' + ATT_MARKS.map(m => '<button type="button" class="mkb m-' + m.k + (f.mode === "brush" && f.brush === m.k ? " on" : "") +
      '" data-act="ax-mk" data-id="' + m.k + '" title="' + esc(m.name) + '" aria-label="' + esc(m.name) + '">' + esc(m.sym) + '</button>').join("") +
      '<button type="button" class="mkb clr' + (f.mode === "brush" && f.brush === "-" ? " on" : "") + '" data-act="ax-mk" data-id="-" title="Clear" aria-label="Clear">⌫</button></div></div>';
}
/* five views along the bottom; the marker slides from the old tab to the new one */
function attTabs(tab, month){
  const mu = attMakeups(month).filter(x => x.state === "overdue" || x.state === "nodate").length;
  const nod = DataService.getPlans().filter(p => p.status === "Active" && attNoDays(p)).length;
  const t = (id, label, n, tip) => '<button type="button" class="ax-tab' + (tab === id ? " on" : "") + '" data-act="ax-tab" data-id="' + id + '"' +
    (tab === id ? ' aria-current="page"' : "") + (tip ? ' title="' + esc(tip) + '"' : "") + '>' + label + (n ? '<span class="n">' + n + '</span>' : "") + '</button>';
  return '<nav class="ax-tabs" aria-label="Views"><div class="ax-tabin"><span class="ax-ind" aria-hidden="true"></span>' +
    t("today", "Today") + t("sheet", "Sheet") + t("days", "Class days", nod, nod ? nod + " active plans have no class days" : "") +
    t("makeups", "Make-ups", mu, mu ? mu + " make-ups need a date or are overdue" : "") + t("results", "Results") + '</div></nav>';
}
function attTabInd(app){
  const box = app.querySelector(".ax-tabin"), on = box && box.querySelector(".ax-tab.on"), ind = box && box.querySelector(".ax-ind");
  if (!on || !ind || !on.offsetWidth) return;
  const L = on.offsetLeft, W = on.offsetWidth, prev = ATT_FX.ind;
  box.classList.add("has-ind");
  if (prev && (prev.l !== L || prev.w !== W) && !attCalm()) {
    ind.style.transition = "none"; ind.style.transform = "translateX(" + prev.l + "px)"; ind.style.width = prev.w + "px";
    void ind.offsetWidth;
    ind.style.transition = "";
  }
  ind.style.transform = "translateX(" + L + "px)"; ind.style.width = W + "px";
  ATT_FX.ind = { l: L, w: W };
}

/* ---- Sheet tab: the month grid ---- */
function attCols(){
  const z = attZoom(), phone = window.innerWidth < 761;
  const shrink = State.iatt.shrink === null ? phone : State.iatt.shrink;
  const w = v => Math.round(v * z);
  const cols = shrink ? [["idx", "#", w(38)], ["student", "Student", w(phone ? 136 : 186)]]
    : [["idx", "#", w(40)], ["student", "Student", w(196)], ["time", "Time", w(72)], ["teacher", "Teacher", w(124)]];
  let left = 0; cols.forEach(c => { c[3] = left; left += c[2]; });
  return { cols: cols, shrink: shrink, day: w(34), tot: w(50), width: left };
}
function attSheet(month, rows){
  if (!rows.length) return '<div class="ax-scroll pad" id="axScroll"><div class="ax-empty"><h2>No classes in ' + esc(monthLabel(month)) + '</h2>' +
    '<p>' + (State.iatt.q || State.iatt.teacher || State.iatt.unmarked ? "Nothing matches — clear the search or the teacher." : "Class plans active this month show here as rows.") + '</p></div></div>';
  const C = attCols(), n = daysInMonth(month), td = today();
  const y = parseYMD(td); y.setDate(y.getDate() - 1); const yday = ymd(y);
  const fees = attFeeMap(month), sel = State.iatt.sel, last = C.cols[C.cols.length - 1][0];
  const stk = (c, extra) => ' class="stk k-' + c[0] + (extra ? " " + extra : "") + (c[0] === last ? " edge" : "") + '" style="left:' + c[3] + 'px;width:' + c[2] + 'px;min-width:' + c[2] + 'px;max-width:' + c[2] + 'px"';
  let h = '<table class="ax-g" id="axGrid"><thead><tr>';
  C.cols.forEach(c => { h += '<th' + stk(c) + '>' + esc(c[1]) + (c[0] === "student" ? '<button type="button" class="ax-shr" data-act="ax-shrink" title="' +
    (C.shrink ? "Show time and teacher" : "Hide time and teacher") + '" aria-label="' + (C.shrink ? "Show more columns" : "Show fewer columns") + '">' + (C.shrink ? "»" : "«") + '</button>' : "") + '</th>'; });
  for (let i = 1; i <= n; i++) {
    const ds = month + "-" + pad2(i), hol = Logic.isHoliday(ds);
    h += '<th class="dh' + (ds === td ? " today" : "") + (hol ? " hol" : "") + '" style="width:' + C.day + 'px;min-width:' + C.day + 'px" title="' + esc(hol ? hol.name : fmtDate(ds)) + '"><b>' + i + '</b><i>' + DOW[parseYMD(ds).getDay()].slice(0, 2) + '</i></th>';
  }
  [["Present", "Classes held with the student there (a substitute class counts)"], ["Absent", "Student absent"], ["%", "Attendance this month"]].forEach((t, i) => {
    h += '<th class="tot' + (i === 0 ? " first" : "") + '" style="width:' + C.tot + 'px;min-width:' + C.tot + 'px" title="' + esc(t[1]) + '">' + t[0] + '</th>'; });
  h += '</tr></thead><tbody>';
  const daily = new Array(n + 1).fill(0); let sumP = 0;
  rows.forEach(function(r, ri){
    const pl = r.pl, tt = attTotals(pl, month), pres = tt.p + tt.s;
    sumP += pres;
    h += '<tr data-pid="' + esc(pl.id) + '">';
    C.cols.forEach(function(c){
      if (c[0] === "idx") h += '<td' + stk(c) + ' title="Drag to move this row"><span class="gr" aria-hidden="true">⋮⋮</span>' + (ri + 1) + '</td>';
      else if (c[0] === "student") h += '<td' + stk(c, "inf") + ' data-act="att-row" data-id="' + esc(pl.id) + '" title="' + esc([r.name, r.teacher, pl.course, pl.time ? time12(pl.time) : ""].filter(Boolean).join(" · ")) + '">' +
        '<span class="nm">' + esc(r.name) + '</span>' + attFeeBadge(fees[pl.id] || fees["s:" + pl.studentId]) +
        (attNoDays(pl) ? '<span class="ax-st nodays" title="Class days not set — set them on Class days">no days</span>' : "") +
        (pl.status !== "Active" ? '<span class="ax-st">' + esc(pl.status) + '</span>' : "") + '</td>';
      else if (c[0] === "time") h += '<td' + stk(c, "inf num") + ' data-act="att-row" data-id="' + esc(pl.id) + '">' + esc(pl.time ? time12(pl.time) : "") + '</td>';
      else h += '<td' + stk(c, "inf") + ' data-act="att-row" data-id="' + esc(pl.id) + '" title="' + esc(r.teacher + (pl.course ? " · " + pl.course : "")) + '">' + esc(r.teacher) + '</td>';
    });
    for (let i = 1; i <= n; i++) {
      const ds = month + "-" + pad2(i), c = DataService.classAt(pl.id, ds), k = markOf(c);
      const hol = Logic.isHoliday(ds), off = !attNoDays(pl) && (pl.days || []).indexOf(DOW[parseYMD(ds).getDay()]) < 0,
            out = (pl.startDate && ds < pl.startDate) || (pl.endDate && ds > pl.endDate);
      let cls = "dc";
      if (hol) cls += " hol"; else if (out) cls += " out"; else if (off) cls += " off";
      if (k) cls += " m-" + k;
      if (c && (c.notes || (c.tags && c.tags.length) || c.portion || c.makeup || c.leaveUntil || c.takenBy)) cls += " nt";
      if (!k && !hol && !out && !off && ds <= yday && !attNoDays(pl)) cls += " um";
      if (ds === td) cls += " tdy";
      if (sel && sel.planId === pl.id && sel.ds === ds) cls += " sel";
      if (ATT_FX.cells[pl.id + "|" + ds]) cls += " pop";
      if (k === "P" || k === "E" || k === "X" || k === "S") daily[i]++;
      h += '<td class="' + cls + '" data-pid="' + esc(pl.id) + '" data-ds="' + ds + '"' + (c ? ' title="' + esc((ATT_MK[k] ? ATT_MK[k].name : "") + (attNoteLine(c) ? " · " + attNoteLine(c) : "")) + '"' : "") + '>' +
        (k ? '<span class="mk">' + esc(attSym(k)) + '</span>' : "") + '</td>';
    }
    h += '<td class="tot k-p first">' + pres + '</td><td class="tot k-a">' + (tt.a || "") + '</td>' +
      '<td class="tot k-pct ' + (tt.pct === null ? "" : tt.pct >= 80 ? "good" : tt.pct < 50 ? "bad" : "") + '">' + (tt.pct === null ? "–" : Math.round(tt.pct) + "%") + '</td></tr>';
  });
  h += '</tbody><tfoot><tr>' + C.cols.map(c => '<td' + stk(c, c[0] === last ? "lbl" : "") + '>' + (c[0] === last ? "Present each day" : "") + '</td>').join("");
  for (let i = 1; i <= n; i++) h += '<td' + (Logic.isHoliday(month + "-" + pad2(i)) ? ' class="hol"' : "") + '>' + (daily[i] || "") + '</td>';
  h += '<td class="first">' + sumP + '</td><td colspan="2"></td></tr></tfoot></table>';
  return '<div class="ax-scroll' + (State.iatt.mode === "brush" ? " brush" : "") + '" id="axScroll" tabindex="0" aria-label="Attendance sheet">' + h + '</div>' + attPick(month);
}
/* the mark picker: rises as a card on a computer, a bottom sheet on a phone */
function attPick(month){
  const s = State.iatt.sel;
  if (!s || monthOf(s.ds) !== month || State.iatt.mode !== "select") return "";
  const pl = DataService.getPlan(s.planId); if (!pl) return "";
  const st = DataService.getStudent(pl.studentId) || {}, c = DataService.classAt(s.planId, s.ds), k = markOf(c);
  const hol = Logic.isHoliday(s.ds), key = s.planId + "|" + s.ds;
  const when = c && c.markedAt ? "Marked by " + (c.markedBy || "—") + " · " + fmtDate(c.markedAt.slice(0, 10)) + ", " + c.markedAt.slice(11, 16) + " UTC" : "Not marked yet";
  const flag = hol ? "Holiday · " + hol.name : (!Logic.planDay(pl, s.ds) && !attNoDays(pl) ? "Not a class day" : "");
  return '<div class="ax-pick' + (ATT_FX.pick !== key ? " in" : "") + '" role="dialog" aria-label="Mark this day">' +
    '<div class="ph"><div><b>' + esc(st.name || pl.studentId) + '</b><span class="d">' + esc(DOW[parseYMD(s.ds).getDay()] + " " + fmtDate(s.ds)) + '</span>' +
      (flag ? '<span class="fl">' + esc(flag) + '</span>' : "") +
      '<small>' + esc(attNoteLine(c) ? attNoteLine(c) + " · " + when : when) + '</small></div>' +
      '<button type="button" class="ax-x" data-act="att-unsel" aria-label="Close">×</button></div>' +
    '<div class="row">' + ATT_MARKS.map(m => '<button type="button" class="mkb m-' + m.k + (k === m.k ? " on" : "") + '" data-act="att-set" data-id="' + esc(pl.id) +
      '" data-ds="' + s.ds + '" data-k="' + m.k + '" title="' + esc(m.name) + '" aria-label="' + esc(m.name) + '" aria-pressed="' + (k === m.k) + '">' + esc(m.sym) + '</button>').join("") +
      '<button type="button" class="mkb clr" data-act="att-set" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '" data-k="" title="Clear" aria-label="Clear">⌫</button></div>' +
    '<div class="ft"><button type="button" class="ax-pill" data-act="att-note" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '">Note…</button>' +
      (k === "A" ? '<button type="button" class="ax-pill primary" data-act="ax-wa" data-id="' + esc(pl.id) + '" data-ds="' + s.ds + '">💬 WhatsApp parent</button>' : "") +
      '<button type="button" class="ax-pill" data-act="att-row" data-id="' + esc(pl.id) + '">Student…</button>' +
      '<span class="hint">p a t l s e x d r c · arrows · Enter = note</span></div></div>';
}

/* ---- Today tab ---- */
function attToday(R){
  const f = State.iatt, ds = f.date || today(), td = today();
  const lab = (ds === td ? "Today · " : "") + DOW[parseYMD(ds).getDay()] + " " + fmtDate(ds);
  const head = '<div class="ax-dayhead">' +
    '<button type="button" class="ax-ib" data-act="att-day" data-id="-1" aria-label="Previous day">‹</button>' +
    '<label class="ax-dayl"><b>' + esc(lab) + '</b><span class="cv" aria-hidden="true"></span><input type="date" data-act="att-date" value="' + esc(ds) + '" aria-label="Choose a day"></label>' +
    '<button type="button" class="ax-ib" data-act="att-day" data-id="1" aria-label="Next day">›</button>' +
    (ds !== td ? '<button type="button" class="ax-pill" data-act="att-day" data-id="0">Today</button>' : "") + '</div>';
  const hol = Logic.isHoliday(ds);
  if (hol) return '<div class="ax-scroll pad" id="axScroll">' + head + '<div class="ax-empty"><h2>Holiday · ' + esc(hol.name) + '</h2><p>No classes are expected on ' + esc(fmtDate(ds)) + '.</p></div></div>';
  const ids = {}; R.rows.forEach(r => ids[r.pl.id] = r);
  const q = (f.q || "").toLowerCase().trim();
  const list = attOrdered(Logic.sheetPlans(monthOf(ds))).filter(pl => {
    if (monthOf(ds) === State.month && !ids[pl.id]) return false;
    if (f.teacher && pl.teacherId !== f.teacher) return false;
    if (q) { const st = DataService.getStudent(pl.studentId) || {}; if ((st.name + " " + pl.course).toLowerCase().indexOf(q) < 0) return false; }
    return attPossible(pl, ds) || !!DataService.classAt(pl.id, ds);
  });
  list.sort((a, b) => (attNoDays(a) ? 1 : 0) - (attNoDays(b) ? 1 : 0));
  if (!list.length) return '<div class="ax-scroll pad" id="axScroll">' + head + '<div class="ax-empty"><h2>No classes on this day</h2><p>No class plan meets on ' + esc(fmtDate(ds)) + '.</p></div></div>';
  const done = list.filter(pl => { const c = DataService.classAt(pl.id, ds); return c && c.status !== "Note"; }).length;
  const fees = attFeeMap(monthOf(ds)), pct = Math.round(done * 100 / list.length);
  return '<div class="ax-scroll pad" id="axScroll">' + head +
    '<div class="ax-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + list.length + '" aria-valuenow="' + done + '"><div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<span><b>' + done + '</b> of ' + list.length + ' marked</span></div>' +
    '<div class="ax-list">' + list.map(function(pl, i){
      const grp = attNoDays(pl) && (i === 0 || !attNoDays(list[i - 1])) ? '<div class="ax-grp">Class days not set — mark the ones that had a class today</div>' : "";
      const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {};
      const c = DataService.classAt(pl.id, ds), k = markOf(c), note = attNoteLine(c), hit = !!ATT_FX.cells[pl.id + "|" + ds];
      return grp + '<div class="ax-row' + (c && c.status !== "Note" ? " done" : attNoDays(pl) ? " plain" : "") + '" style="--i:' + Math.min(i, 14) + '">' +
        '<div class="info"><button type="button" class="ax-namebtn" data-act="att-row" data-id="' + esc(pl.id) + '">' + esc(st.name || pl.studentId) + '</button>' +
          '<small>' + esc((pl.time ? time12(pl.time) + " · " : "") + (t.name || "—") + (pl.course ? " · " + pl.course : "")) + attFeeBadge(fees[pl.id] || fees["s:" + pl.studentId]) + '</small>' +
          (note ? '<small class="axnote">' + esc(note) + '</small>' : "") + '</div>' +
        '<div class="btns">' + ["P", "A", "T", "L", "S"].map(m => '<button type="button" class="mkb m-' + m + (k === m ? " on" + (hit ? " pop" : "") : "") +
            '" data-act="att-set" data-id="' + esc(pl.id) + '" data-ds="' + ds + '" data-k="' + m + '" aria-pressed="' + (k === m) + '" title="' + esc(ATT_MK[m].name) + '" aria-label="' + esc(ATT_MK[m].name) + '">' + esc(ATT_MK[m].sym) + '</button>').join("") +
          (k === "A" ? '<button type="button" class="mkb more wa" data-act="ax-wa" data-id="' + esc(pl.id) + '" data-ds="' + ds + '" title="WhatsApp the parent" aria-label="WhatsApp the parent">💬</button>' : "") +
          '<button type="button" class="mkb more' + ("EXNRC".indexOf(k) >= 0 && k ? " m-" + k + " on" + (hit ? " pop" : "") : "") + '" data-act="att-note" data-id="' + esc(pl.id) + '" data-ds="' + ds + '" title="More marks and notes" aria-label="More marks and notes">' +
            ("EXNRC".indexOf(k) >= 0 && k ? esc(attSym(k)) : "…") + '</button>' +
        '</div></div>';
    }).join("") + '</div></div>';
}

/* ---- Class days tab: days, time and minutes for many plans at once ---- */
function attSchedRows(){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim();
  return DataService.getPlans().filter(p => p.status === "Active" && DataService.getStudent(p.studentId)).filter(function(p){
    if (f.teacher && p.teacherId !== f.teacher) return false;
    if (f.onlyNoDays && !attNoDays(p)) return false;
    const st = DataService.getStudent(p.studentId) || {}, t = DataService.getTeacher(p.teacherId) || {};
    return !q || (st.name + " " + p.studentId + " " + (t.name || "") + " " + (p.course || "")).toLowerCase().indexOf(q) >= 0;
  }).sort((a, b) => (attNoDays(b) ? 1 : 0) - (attNoDays(a) ? 1 : 0) || String(a.time || "99").localeCompare(String(b.time || "99")) ||
    String((DataService.getStudent(a.studentId) || {}).name).localeCompare(String((DataService.getStudent(b.studentId) || {}).name)));
}
const ATT_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
function attDays(){
  const f = State.iatt, rows = attSchedRows(), picked = Object.keys(f.pick).filter(k => f.pick[k]);
  const noDays = DataService.getPlans().filter(p => p.status === "Active" && attNoDays(p)).length;
  const rise = picked.length && !ATT_FX.bulk; ATT_FX.bulk = picked.length > 0;
  const bulk = picked.length ? '<div class="ax-bulk' + (rise ? " in" : "") + '"><b>' + picked.length + ' selected</b><div class="ax-wk">' +
      ATT_WEEK.map(d => '<button type="button" class="ax-dayb' + (f.bulkDays.indexOf(d) >= 0 ? " on" : "") + '" data-act="ax-bday" data-id="' + d + '" aria-pressed="' + (f.bulkDays.indexOf(d) >= 0) + '">' + d.slice(0, 2) + '</button>').join("") + '</div>' +
      '<input class="ax-time" type="time" data-act="ax-btime" value="' + esc(f.bulkTime) + '" aria-label="Class time for the selected plans">' +
      '<button type="button" class="ax-pill primary" data-act="ax-bapply">Apply to ' + picked.length + '</button>' +
      '<button type="button" class="ax-pill" data-act="ax-bclear">Clear</button></div>' : "";
  let h = '<div class="ax-h">Class days</div><div class="ax-sub">' + (noDays ? '<b>' + noDays + '</b> active plan' + (noDays > 1 ? "s have" : " has") + ' no class days — listed first. ' : "") +
    'Tap the days each class meets; changes save as you go. Tick rows to set many at once.</div>' + bulk;
  if (!rows.length) return '<div class="ax-scroll pad" id="axScroll">' + h + '<div class="ax-empty"><h2>No active plans match</h2><p>Clear the search or the teacher.</p></div></div>';
  h += '<table class="ax-g sched"><thead><tr><th style="width:38px"><input type="checkbox" data-act="ax-pickall" aria-label="Select all"' + (rows.every(p => f.pick[p.id]) ? " checked" : "") + '></th>' +
    '<th style="width:190px">Student</th><th style="width:130px">Teacher</th><th style="width:96px">Course</th><th style="width:118px">Time</th>' +
    '<th style="width:250px">Class days</th><th style="width:84px">Minutes</th><th style="width:140px">Start</th></tr></thead><tbody>';
  rows.forEach(function(p){
    const st = DataService.getStudent(p.studentId) || {}, t = DataService.getTeacher(p.teacherId) || {};
    h += '<tr class="' + (attNoDays(p) ? "nodays" : "") + (f.pick[p.id] ? " picked" : "") + '"><td class="c" style="text-align:center"><input type="checkbox" data-act="ax-pickrow" data-id="' + esc(p.id) + '"' + (f.pick[p.id] ? " checked" : "") + ' aria-label="Select ' + esc(st.name || p.studentId) + '"></td>' +
      '<td class="k-student" title="' + esc(p.id) + '">' + esc(st.name || p.studentId) + '</td><td>' + esc(t.name || "—") + '</td><td>' + esc(p.course || "") + '</td>' +
      '<td class="c"><input type="time" data-act="ax-ptime" data-id="' + esc(p.id) + '" value="' + esc(p.time || "") + '" aria-label="Class time"></td>' +
      '<td class="c"><div class="ax-wk">' + ATT_WEEK.map(d => '<button type="button" class="ax-dayb' + ((p.days || []).indexOf(d) >= 0 ? " on" : "") + '" data-act="ax-pday" data-id="' + esc(p.id) + '" data-day="' + d + '" aria-pressed="' + ((p.days || []).indexOf(d) >= 0) + '">' + d.slice(0, 2) + '</button>').join("") + '</div></td>' +
      '<td class="c"><input type="number" min="0" data-act="ax-pmin" data-id="' + esc(p.id) + '" value="' + esc(p.duration || "") + '" placeholder="45" aria-label="Minutes"></td>' +
      '<td class="c"><input type="date" data-act="ax-pstart" data-id="' + esc(p.id) + '" value="' + esc(p.startDate || "") + '" aria-label="Start date"></td></tr>';
  });
  return '<div class="ax-scroll pad" id="axScroll">' + h + '</tbody></table></div>';
}
function attPlanSave(pl, patch, what){
  const cur = DataService.getPlan(pl.id) || pl;
  const next = Object.assign({}, cur, patch);
  if (patch.days) next.perWeek = patch.days.length;
  if (window.MQ_ADMIN && typeof admStamp === "function" && typeof admDiff === "function") {
    const ch = admDiff(cur, next, Object.keys(patch).filter(k => k !== "perWeek"));
    if (!Object.keys(ch).length) return false;
    admStamp(next, what || "changed class details", ch);
  }
  DataService.savePlan(next);
  return true;
}

/* ---- Make-ups tab: teacher-absent and rescheduled days, until the class is made up ---- */
function attMakeups(month){
  const months = [addMonths(month, -1), month], out = [], td = today();
  DataService.getClasses({ notes: false }).forEach(function(c){
    if (months.indexOf(monthOf(c.date)) < 0) return;
    if (c.status !== "Teacher Absent" && c.status !== "Rescheduled") return;
    const pl = DataService.getPlan(c.planId); if (!pl) return;
    const held = DataService.getClasses({ planId: c.planId }).find(x => x.makeup === c.date && (x.status === "Completed" || x.status === "Substitute"));
    const onDay = c.makeup ? DataService.classAt(c.planId, c.makeup) : null;
    const doneRec = held || (onDay && (onDay.status === "Completed" || onDay.status === "Substitute") ? onDay : null);
    const state = doneRec ? "done" : !c.makeup ? "nodate" : c.makeup < td ? "overdue" : "planned";
    out.push({ c: c, pl: pl, state: state, done: doneRec });
  });
  return out.sort((a, b) => String(a.c.date).localeCompare(String(b.c.date)));
}
function attMakeupsHtml(month){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim();
  const all = attMakeups(month).filter(function(x){
    if (f.teacher && x.c.teacherId !== f.teacher && x.pl.teacherId !== f.teacher) return false;
    const st = DataService.getStudent(x.pl.studentId) || {};
    return !q || (st.name + " " + (x.pl.course || "")).toLowerCase().indexOf(q) >= 0;
  });
  const cnt = s => all.filter(x => x.state === s).length;
  const label = { overdue: "Make-up date passed — not marked yet", nodate: "No make-up date", planned: "Planned", done: "Made up" };
  let h = '<div class="ax-h">Make-ups</div><div class="ax-sub">Teacher-absent and rescheduled days in ' + esc(monthShort(addMonths(month, -1))) + ' and ' + esc(monthShort(month)) +
    '. A day counts as made up once a class is marked on its make-up date.</div>' +
    '<div class="ax-counts">' + [["overdue", "overdue"], ["nodate", "no date"], ["planned", "planned"], ["done", "made up"]].map(k =>
      '<span class="c-' + k[0] + (cnt(k[0]) ? "" : " zero") + '"><b>' + cnt(k[0]) + '</b> ' + k[1] + '</span>').join("") + '</div>';
  if (!all.length) return '<div class="ax-scroll pad" id="axScroll">' + h + '<div class="ax-empty"><h2>Nothing to make up</h2><p>No teacher-absent or rescheduled days in these two months.</p></div></div>';
  let i = 0;
  ["overdue", "nodate", "planned", "done"].forEach(function(s){
    const list = all.filter(x => x.state === s); if (!list.length) return;
    h += '<div class="ax-grp">' + label[s] + ' · ' + list.length + '</div><div class="ax-list">' + list.map(function(x){
      const st = DataService.getStudent(x.pl.studentId) || {}, t = DataService.getTeacher(x.c.teacherId || x.pl.teacherId) || {};
      return '<div class="ax-row' + (s === "done" ? " done" : s === "planned" ? " plain" : "") + '" style="--i:' + Math.min(i++, 14) + '"><div class="info"><b>' + esc(st.name || x.pl.studentId) + '</b>' +
        '<small>' + esc((x.c.status === "Teacher Absent" ? "Teacher absent" : "Rescheduled") + " · " + DOW[parseYMD(x.c.date).getDay()] + " " + fmtDate(x.c.date) + " · " + (t.name || "—") + (x.pl.course ? " · " + x.pl.course : "")) + '</small>' +
        '<small class="axnote">' + esc(s === "done" ? "Made up on " + fmtDate(x.done.date) : x.c.makeup ? "Make-up on " + fmtDate(x.c.makeup) : "No make-up date yet") + '</small></div>' +
        '<div class="btns">' + (s === "done" ? "" :
          '<button type="button" class="ax-pill" data-act="att-note" data-id="' + esc(x.pl.id) + '" data-ds="' + x.c.date + '">' + (x.c.makeup ? "Change date" : "Set date") + '</button>' +
          '<button type="button" class="ax-pill primary" data-act="ax-mu-held" data-id="' + esc(x.pl.id) + '" data-ds="' + x.c.date + '">Mark held</button>') + '</div></div>';
    }).join("") + '</div>';
  });
  return '<div class="ax-scroll pad" id="axScroll">' + h + '</div>';
}

/* ---- Results tab: exam and test days with portion and result ---- */
function attResults(month){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim();
  return DataService.getClasses({ month: month }).filter(c => c.status === "Completed" && (c.activity === "Exam" || c.activity === "Test")).filter(function(c){
    const pl = DataService.getPlan(c.planId); if (!pl) return false;
    if (f.teacher && c.teacherId !== f.teacher && pl.teacherId !== f.teacher) return false;
    const st = DataService.getStudent(c.studentId) || {};
    return !q || (st.name + " " + (pl.course || "") + " " + (c.portion || "")).toLowerCase().indexOf(q) >= 0;
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
function attResultsHtml(month){
  const list = attResults(month);
  let h = '<div class="ax-h">Exam and test results · ' + esc(monthLabel(month)) + '</div><div class="ax-sub">Days marked Exa or Test. Tap a row to change the portion or result.</div>';
  if (!list.length) return '<div class="ax-scroll pad" id="axScroll">' + h + '<div class="ax-empty"><h2>No exams or tests yet</h2><p>Mark a day Exa or Test, then add the portion and result in its note.</p></div></div>';
  h += '<table class="ax-g sched"><thead><tr><th style="width:96px">Date</th><th style="width:190px">Student</th><th style="width:90px">Kind</th><th style="width:110px">Course</th>' +
    '<th style="width:220px">Portion</th><th style="width:110px">Result</th><th style="width:130px">Teacher</th></tr></thead><tbody>' +
    list.map(function(c){
      const st = DataService.getStudent(c.studentId) || {}, pl = DataService.getPlan(c.planId) || {}, t = DataService.getTeacher(c.takenBy || c.teacherId) || {};
      return '<tr class="inf" data-act="att-note" data-id="' + esc(c.planId) + '" data-ds="' + c.date + '" style="cursor:pointer"><td>' + esc(fmtDate(c.date)) + '</td><td class="k-student">' + esc(st.name || c.studentId) +
        '</td><td><span class="ax-st m-' + (c.activity === "Exam" ? "E" : "X") + '">' + esc(c.activity) + '</span></td><td>' + esc(pl.course || "") + '</td><td title="' + esc(c.portion || "") + '">' + esc(c.portion || "—") +
        '</td><td><b>' + esc(c.result || "—") + '</b></td><td>' + esc(t.name || "—") + '</td></tr>';
    }).join("") + '</tbody></table>';
  return '<div class="ax-scroll pad" id="axScroll">' + h + '</div>';
}

/* ---- ⋯ menu ---- */
function attMenu(){
  if (!State.iatt.menu) return "";
  const admin = !!window.MQ_ADMIN, locked = attLocked(State.month), th = attTheme(), z = attZoom();
  const mi = (act, label, id, cls) => '<button type="button" class="ax-mi' + (cls ? " " + cls : "") + '" role="menuitem" data-act="' + act + '"' + (id !== undefined ? ' data-id="' + esc(id) + '"' : "") + '>' + label + '</button>';
  const seg = (items) => '<div class="ax-seg sm">' + items.map(it => '<button type="button" class="' + (it[3] ? "on" : "") + '" data-act="' + it[0] + '" data-id="' + esc(it[1]) + '"' +
    (it[4] ? ' aria-label="' + esc(it[4]) + '"' : "") + '>' + esc(it[2]) + '</button>').join("") + '</div>';
  return '<div class="ax-menu' + (ATT_FX.menu ? " in" : "") + '" role="menu">' +
    '<div class="ax-mh">Reports</div>' +
    mi("ax-rep-student", "Student report…") + mi("ax-rep-teacher", "Teacher report…") + mi("ax-rep-results", "Exam and test results") +
    '<div class="ax-msep"></div><div class="ax-mh">View</div>' +
    mi("ax-sort", "Sort rows by class time") +
    '<div class="ax-mrow"><span>Zoom</span>' + seg([["ax-zoom", "-1", "−", false, "Zoom out"], ["ax-zoom", "0", Math.round(z * 100) + "%", false, "Zoom 100%"], ["ax-zoom", "1", "+", false, "Zoom in"]]) + '</div>' +
    (admin ? "" : '<div class="ax-mrow"><span>Theme</span>' + seg([["ax-theme", "auto", "Auto", th === "auto"], ["ax-theme", "light", "Light", th === "light"], ["ax-theme", "dark", "Dark", th === "dark"]]) + '</div>') +
    mi("ax-refresh", "Refresh now") +
    (admin ? "" : '<div class="ax-msep"></div><div class="ax-mh">Office</div>' +
      mi("att-admins", "Admin links…") + mi("holidays", "Holidays…") + mi("ax-wa-text", "Absent message…") +
      (Actions["imp-open"] ? mi("imp-open", "Import old sheet…") : "") +
      (locked ? mi("att-reopen", "Reopen " + esc(monthLabel(State.month))) : mi("att-close", "Close " + esc(monthLabel(State.month)) + "…"))) +
  '</div>';
}

/* ---- paint ---- */
const ATT_VIEW = { key: "", left: 0, top: 0, first: true };
function attUnmount(){
  const app = document.getElementById("attApp");
  if (app) app.remove();
  document.body.classList.remove("ax-open");
  ATT_VIEW.key = "";
}
function attPaint(){
  if (State.page !== "iAtt") { attUnmount(); return; }
  const month = State.month, tab = attTab(), R = attRows(month);
  let app = document.getElementById("attApp");
  if (!app) {
    app = document.createElement("div"); app.id = "attApp"; app.className = "ax mount" + (window.MQ_ADMIN ? " adm" : "");
    document.body.appendChild(app); document.body.classList.add("ax-open");
    attWire(app);
    setTimeout(() => app.classList.remove("mount"), 800);
  }
  const sc0 = document.getElementById("axScroll");
  const key = tab + "|" + month, fresh = ATT_VIEW.key !== key;
  if (sc0 && !fresh) { ATT_VIEW.left = sc0.scrollLeft; ATT_VIEW.top = sc0.scrollTop; }
  if (window.MQ_ADMIN) app.removeAttribute("data-theme"); else app.setAttribute("data-theme", attTheme());
  const z = attZoom();
  app.style.setProperty("--fs", (13 * z).toFixed(1) + "px"); app.style.setProperty("--rh", Math.round(32 * z) + "px"); app.style.setProperty("--hh", Math.round(40 * z) + "px");
  const body = tab === "today" ? attToday(R) : tab === "days" ? attDays() : tab === "makeups" ? attMakeupsHtml(month) : tab === "results" ? attResultsHtml(month) : attSheet(month, R.rows);
  app.innerHTML = attTop(month, R) + attTools(tab, month, R) + '<main class="ax-stage' + (fresh && !ATT_VIEW.first ? " enter" : "") + '">' + body + attMenu() + '</main>' + attDock(tab) + attTabs(tab, month);
  const sc = document.getElementById("axScroll");
  if (sc) {
    if (!fresh) { sc.scrollLeft = ATT_VIEW.left; sc.scrollTop = ATT_VIEW.top; }
    else if (tab === "sheet") {
      const th = sc.querySelector("th.dh.today"), C = attCols();
      if (th) sc.scrollLeft = Math.max(0, th.offsetLeft - C.width - C.day * 3);
    }
  }
  attTabInd(app);
  const s = State.iatt.sel;
  ATT_FX.cells = {}; ATT_FX.menu = false; ATT_FX.add = false;
  ATT_FX.pick = s && tab === "sheet" && State.iatt.mode === "select" ? s.planId + "|" + s.ds : "";
  ATT_VIEW.key = key; ATT_VIEW.first = false;
}
Pages.iAtt = function(){
  if (!window.MQ_ADMIN && Date.now() - ATT_LIVE.at > 60000) setTimeout(() => attPull(false), 50);
  attPaint();
  return '<div class="empty"><h4>Attendance is open</h4><p>The sheet covers this page. <button class="btn btn-primary" data-act="goto" data-page="iAtt">Open it again</button></p></div>';
};
const _attGo = go;
go = function(page){ _attGo(page); if (page !== "iAtt") attUnmount(); };

/* ---- pointer: tap a cell, brush across cells, drag a row by its number, pinch to zoom ---- */
const ATT_DRAG = { brush: null, row: null, pinch: null };
function attCellAt(x, y){ const el = document.elementFromPoint(x, y); return el ? el.closest("#axGrid td.dc") : null; }
function attWire(app){
  /* a menu item closes its menu at once, before its action runs; a tap on the day opens the date picker */
  app.addEventListener("click", function(e){
    if (e.target.closest(".ax-menu .ax-mi, .ax-pop .ax-mi")) {
      State.iatt.menu = false; State.iatt.add = false;
      app.querySelectorAll(".ax-menu, .ax-pop").forEach(m => m.remove());
    }
    const dl = e.target.closest(".ax-dayl input");
    if (dl && typeof dl.showPicker === "function") { try { dl.showPicker(); } catch (er) {} }
  }, true);
  app.addEventListener("pointerdown", function(e){
    const td = e.target.closest("#axGrid td.dc");
    const idx = e.target.closest("#axGrid td.k-idx");
    if (State.iatt.menu && !e.target.closest(".ax-menu") && !e.target.closest('[data-act="ax-menu"]')) { State.iatt.menu = false; render(); return; }
    if (State.iatt.add && !e.target.closest(".ax-addw")) { State.iatt.add = false; render(); return; }
    if (idx && e.button === 0) {
      const tr = idx.closest("tr");
      ATT_DRAG.row = { pid: tr.dataset.pid, y: e.clientY, moved: false, target: null, after: false };
      e.preventDefault();
      return;
    }
    if (!td || e.button !== 0) return;
    const pid = td.dataset.pid, ds = td.dataset.ds;
    if (State.iatt.mode === "brush") {
      const b = State.iatt.brush;
      if (!attCanEdit(monthOf(ds))) return;
      if (b === "S") { attNote(pid, ds, "S"); return; }
      e.preventDefault();
      ATT_DRAG.brush = { k: b === "-" ? "" : b, cells: {} };
      attBrushCell(td);
    } else {
      State.iatt.sel = { planId: pid, ds: ds };
      render();
    }
  });
  window.addEventListener("pointermove", function(e){
    if (ATT_DRAG.brush) { const td = attCellAt(e.clientX, e.clientY); if (td) attBrushCell(td); return; }
    const R = ATT_DRAG.row; if (!R) return;
    if (Math.abs(e.clientY - R.y) > 4) R.moved = true;
    if (!R.moved) return;
    const el = document.elementFromPoint(e.clientX, e.clientY), tr = el ? el.closest("#axGrid tbody tr") : null;
    const grid = document.getElementById("axGrid"), sc = document.getElementById("axScroll");
    let line = document.getElementById("axDrop");
    if (!tr || !grid || !sc) return;
    const rect = tr.getBoundingClientRect(), after = e.clientY > rect.top + rect.height / 2;
    R.target = tr.dataset.pid; R.after = after;
    if (!line) { line = document.createElement("div"); line.id = "axDrop"; line.className = "ax-drop"; sc.appendChild(line); }
    line.style.top = (tr.offsetTop + (after ? tr.offsetHeight : 0) - 1) + "px";
    line.style.width = grid.offsetWidth + "px";
    const src = grid.querySelector('tr[data-pid="' + CSS.escape(R.pid) + '"]'); if (src) src.classList.add("drag");
  });
  window.addEventListener("pointerup", function(){
    if (ATT_DRAG.brush) {
      const B = ATT_DRAG.brush; ATT_DRAG.brush = null;
      const list = Object.keys(B.cells).map(k => B.cells[k]);
      if (list.length) attWrite(list.map(c => ({ planId: c.pid, ds: c.ds, k: B.k })), "brush");
      render(); return;
    }
    const R = ATT_DRAG.row; ATT_DRAG.row = null;
    if (!R) return;
    if (!R.moved) { Actions["att-row"](R.pid); return; }
    if (!R.target || R.target === R.pid) { render(); return; }
    const all = attOrdered(Logic.sheetPlans(State.month)).map(p => p.id).filter(id => id !== R.pid);
    let at = all.indexOf(R.target); if (at < 0) at = all.length - 1;
    all.splice(R.after ? at + 1 : at, 0, R.pid);
    const prev = (attPref("order") || []).filter(id => all.indexOf(id) < 0);
    attPref("order", all.concat(prev));
    render();
  });
  /* two fingers on the sheet zoom it, like a spreadsheet app */
  app.addEventListener("touchstart", function(e){
    if (e.touches.length !== 2 || !e.target.closest("#axScroll")) return;
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    ATT_DRAG.pinch = { d: d, z: attZoom(), z1: attZoom() };
  }, { passive: true });
  app.addEventListener("touchmove", function(e){
    const P = ATT_DRAG.pinch; if (!P || e.touches.length !== 2) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    P.z1 = Math.max(0.7, Math.min(1.6, P.z * d / P.d));
    app.style.setProperty("--fs", (13 * P.z1).toFixed(1) + "px"); app.style.setProperty("--rh", Math.round(32 * P.z1) + "px");
  }, { passive: false });
  app.addEventListener("touchend", function(){
    const P = ATT_DRAG.pinch; if (!P) return;
    ATT_DRAG.pinch = null; attPref("zoom", Math.round(P.z1 * 100) / 100); render();
  });
  app.addEventListener("wheel", function(e){
    if (!e.ctrlKey || !e.target.closest("#axScroll")) return;
    e.preventDefault(); Actions["ax-zoom"](e.deltaY < 0 ? "1" : "-1");
  }, { passive: false });
}
function attBrushCell(td){
  const B = ATT_DRAG.brush; if (!B) return;
  const key = td.dataset.pid + "|" + td.dataset.ds;
  if (B.cells[key]) return;
  B.cells[key] = { pid: td.dataset.pid, ds: td.dataset.ds };
  td.className = td.className.replace(/\bm-[A-Z]\b/g, "").replace(/\bum\b/, "") + (B.k ? " m-" + B.k : "");
  td.innerHTML = B.k ? '<span class="mk">' + esc(attSym(B.k)) + '</span>' : "";
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
  if (e.key === "Escape") { if (State.iatt.menu || State.iatt.sel || State.iatt.add) { State.iatt.menu = false; State.iatt.add = false; State.iatt.sel = null; render(); } return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); Actions[e.shiftKey ? "att-redo" : "att-undo"](); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) { e.preventDefault(); Actions["att-redo"](); return; }
  const s = State.iatt.sel; if (!s || e.ctrlKey || e.metaKey || e.altKey || attTab() !== "sheet") return;
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
document.addEventListener("paste", function(e){
  if (State.page !== "iAtt" || $("#mScrim") || !State.iatt.sel || attTab() !== "sheet") return;
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
function attRedraw(){ render(); }
async function attPull(force){
  if (ATT_LIVE.busy || typeof Supa === "undefined" || !Supa.on() || !Supa.refresh) return { changed: 0 };
  const live = window.MQ_ADMIN || State.page === "iAtt" || State.page === "tpay";
  if (!force && (!live || document.hidden)) return { changed: 0 };
  ATT_LIVE.busy = true;
  try {
    const colls = ["classes", "plans", "students", "teachers", "holidays"].concat(window.MQ_ADMIN ? ["settings"] : []);
    const r = await Supa.refresh(colls);
    ATT_LIVE.at = Date.now();
    if (r.changed && !$("#mScrim") && !ATT_DRAG.brush && !ATT_DRAG.row && (State.page === "iAtt" || State.page === "tpay")) attRedraw();
    if (window.MQ_ADMIN && typeof attAdminCheck === "function") attAdminCheck();
    return r;
  } finally { ATT_LIVE.busy = false; }
}
setInterval(() => attPull(false), 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - ATT_LIVE.at > 20000) attPull(false); });

/* ---- Admin links (office only): one private link per class admin ----
   The token is 18 random bytes (base64url). The list shows only its last four characters; Copy and WhatsApp send the full link.
   A link that is switched off, deleted or replaced stops working on the admin's phone at its next check (within a minute). */
function attLinkUrl(token){ return location.origin + "/portal/attendance/#k=" + token; }
function attNewToken(){
  const a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a);
  return btoa(String.fromCharCode.apply(null, Array.from(a))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function attMask(t){ t = String(t || ""); return t ? "••••" + t.slice(-4) : "—"; }
function attLinkLine(l){
  return [l.phone ? "WhatsApp •••• " + String(l.phone).slice(-4) : "no WhatsApp number", "link " + attMask(l.token),
    l.rotated ? "new link " + fmtDate(l.rotated) : (l.created ? "made " + fmtDate(l.created) : "")].filter(Boolean).join(" · ");
}
function attLinkRows(links, compact){
  if (!links.length) return '<div class="lk-empty">No admin links yet.</div>';
  return links.map(function(l, i){
    return '<div class="lk-row' + (l.active ? "" : " off") + '">' +
      '<div class="lk-main"><b>' + esc(l.name) + '</b>' + (l.active ? '<span class="badge b-ok">On</span>' : '<span class="badge b-idle">Off</span>') +
        '<small>' + esc(attLinkLine(l)) + '</small></div>' +
      '<div class="lk-acts">' +
        (l.active ? '<button type="button" class="btn btn-sm" data-act="att-admin-copy" data-id="' + i + '">Copy link</button>' +
          (compact ? "" : '<button type="button" class="btn btn-sm btn-wa" data-act="att-admin-wa" data-id="' + i + '">WhatsApp</button>') : "") +
        '<button type="button" class="btn btn-sm" data-act="att-admin-edit" data-id="' + i + '">Edit</button>' +
      '</div></div>';
  }).join("");
}
function attAdminsBody(){
  const links = Settings().attAdminLinks || [];
  return '<div class="note">Each class admin has their own private link — it works like a password, so send it only to that person. ' +
      'Edit a link to change the name or number, switch it off, or make a new secret link if it reached the wrong person.</div>' +
    '<div class="lk-list">' + attLinkRows(links) + '</div>' +
    '<div class="lk-new"><div class="lk-h">New link</div><div class="form-grid">' +
      field("Admin's name", '<input class="input" name="name" placeholder="e.g. Farisa" autocomplete="off">') +
      field("WhatsApp (optional)", '<input class="input mono" name="phone" placeholder="91…" inputmode="tel" autocomplete="off">') + '</div></div>';
}
function attSaveLinks(links){ DataService.saveSettings({ attAdminLinks: links }); }
function attLinkAt(i){ return (Settings().attAdminLinks || [])[+i] || null; }
function attLinkPatch(i, patch){
  const all = (Settings().attAdminLinks || []).slice(); if (!all[+i]) return null;
  all[+i] = Object.assign({}, all[+i], patch, { updated: today() });
  attSaveLinks(all); return all[+i];
}
/* after a change: back to the list — or, when the change was made from Settings, just refresh that page */
function attLinksReopen(){ setTimeout(() => { if (State.page === "settings") render(); else Actions["att-admins"](); }, 50); }
Object.assign(Actions, {
  "att-admins": () => { State.iatt.menu = false; openModal({ title: "Attendance admin links", wide: true, submitText: "Make a new link", body: attAdminsBody(),
    onSubmit: function(d){
      const name = String(d.name || "").trim();
      if (!name) { toast("Type the admin's name", "bad"); return false; }
      const links = (Settings().attAdminLinks || []).slice();
      links.push({ token: attNewToken(), name: name, phone: String(d.phone || "").replace(/\D/g, ""), active: true, created: today() });
      attSaveLinks(links); toast("Link made for " + name + " — copy it or send it on WhatsApp", "ok", 4200);
      setTimeout(() => Actions["att-admins"](), 50);
    } }); },
  "att-admin-copy": (i) => {
    const l = attLinkAt(i); if (!l) return;
    const url = attLinkUrl(l.token);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast("Link copied", "ok"), () => prompt("Copy this link", url));
    else prompt("Copy this link", url);
  },
  "att-admin-wa": (i) => {
    const l = attLinkAt(i); if (!l) return;
    const msg = "Assalamu Alaikum " + l.name + ",\n\nThis is your attendance link for " + (Settings().academyName || "ManzilulQuran") +
      ". Please keep it private — it works like a password.\n" + attLinkUrl(l.token);
    window.open(Logic.waLink(l.phone || "", msg), "_blank");
  },
  /* edit one link: name, number, on / off — plus a new secret link, and delete once it is off */
  "att-admin-edit": (i) => {
    const l = attLinkAt(i); if (!l) return;
    openModal({ title: "Edit link · " + l.name, submitText: "Save changes",
      body: '<div class="form-grid">' +
          field("Admin's name", '<input class="input" name="name" value="' + esc(l.name) + '" autocomplete="off">') +
          field("WhatsApp", '<input class="input mono" name="phone" value="' + esc(l.phone || "") + '" placeholder="91…" inputmode="tel" autocomplete="off">') +
          '<div class="field span2"><label>Link</label>' + sel("active", optList([{ value: "1", label: "On — the link works" }, { value: "0", label: "Off — the link stops working" }], l.active ? "1" : "0")) + '</div>' +
        '</div>' +
        '<div class="lk-secret"><div><b>Secret link</b><small class="mono">' + esc(location.host + "/portal/attendance/#k=" + attMask(l.token)) + '</small>' +
          '<small>' + esc(l.rotated ? "Replaced on " + fmtDate(l.rotated) : (l.created ? "Made on " + fmtDate(l.created) : "")) + '</small></div>' +
          '<button type="button" class="btn btn-sm" data-act="att-admin-rotate" data-id="' + esc(i) + '">Make a new secret link</button></div>' +
        '<div class="note" style="margin:12px 0 0">A new name shows on marks made from now on; earlier marks keep the name they were made with.</div>' +
        (!l.active ? '<div class="lk-del"><button type="button" class="btn btn-sm btn-danger" data-act="att-admin-del" data-id="' + esc(i) + '">Delete this link</button></div>' : ""),
      onSubmit: function(d){
        const name = String(d.name || "").trim();
        if (!name) { toast("Type the admin's name", "bad"); return false; }
        const was = attLinkAt(i); if (!was) return;
        const on = d.active === "1";
        attLinkPatch(i, { name: name, phone: String(d.phone || "").replace(/\D/g, ""), active: on });
        toast(was.active && !on ? name + "'s link switched off — it stops within a minute" : !was.active && on ? name + "'s link switched on" : "Saved", "ok", 3600);
        attLinksReopen();
      } });
  },
  "att-admin-rotate": (i) => {
    const l = attLinkAt(i); if (!l) return;
    confirmAction({ title: "New secret link for " + l.name, danger: true,
      note: "The old link stops working within a minute on every phone that has it. Send the new link to " + l.name + " straight after.",
      message: "Make a new link for " + l.name + "?", submitText: "Make the new link",
      onConfirm: function(){
        attLinkPatch(i, { token: attNewToken(), rotated: today() });
        toast("New link made for " + l.name + " — copy it or send it on WhatsApp", "ok", 4500);
        attLinksReopen();
      } });
  },
  "att-admin-del": (i) => {
    const l = attLinkAt(i); if (!l) return;
    if (l.active) { toast("Switch the link off first", "warn"); return; }
    confirmAction({ title: "Delete " + l.name + "'s link", danger: true,
      note: "The link is already off. Marks made with it stay, with " + l.name + "'s name on them.",
      message: "Delete this link from the list?", submitText: "Delete",
      onConfirm: function(){
        const all = (Settings().attAdminLinks || []).slice(); all.splice(+i, 1); attSaveLinks(all);
        toast("Link deleted", "ok"); attLinksReopen();
      } });
  },
  /* kept for older buttons: switch off / on straight from a list */
  "att-admin-off": (i) => { const l = attLinkPatch(i, { active: false }); if (l) { toast(l.name + "'s link switched off", "ok"); attLinksReopen(); } },
  "att-admin-on": (i) => { const l = attLinkPatch(i, { active: true }); if (l) { toast(l.name + "'s link switched on", "ok"); attLinksReopen(); } },
  "att-refresh": async () => { const r = await attPull(true); toast(r && r.changed ? r.changed + " change" + (r.changed > 1 ? "s" : "") + " brought in" : "Up to date", "ok"); attRedraw(); }
});
/* Settings gets its own card for the links, so they are easy to find outside the attendance sheet */
if (!window.MQ_ADMIN && typeof Pages.settings === "function") {
  const _attSettings = Pages.settings;
  Pages.settings = function(){
    const html = _attSettings();
    const links = Settings().attAdminLinks || [];
    const card = '<div class="card lk-card" style="margin-bottom:14px"><div class="card-hd"><h3>Attendance admin links</h3><span class="spacer"></span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-act="att-admins">Manage links</button></div><div class="card-bd">' +
      '<div class="tagline">Class admins open the attendance sheet with their own private link. Edit a name or number, switch a link off, or make a new secret link here.</div>' +
      '<div class="lk-list">' + attLinkRows(links, true) + '</div></div></div>';
    const at = html.indexOf('<div class="card"><div class="card-hd"><h3>Academy details</h3>');
    return at >= 0 ? html.slice(0, at) + card + html.slice(at) : card + html;
  };
}

/* ---- reports: a page to print or save as PDF ---- */
function attReportWindow(title, body){
  const s = Settings();
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>' +
    '<style>' +
    '@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:12.5px/1.45 "Public Sans",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#12261B;background:#EAF1ED}' +
    '.page{max-width:820px;margin:20px auto;background:#fff;padding:28px 30px;border-radius:12px;box-shadow:0 2px 10px rgba(9,40,26,.08)}' +
    '.bar{max-width:820px;margin:16px auto 0;display:flex;gap:8px;justify-content:flex-end}.bar button{height:36px;padding:0 14px;border-radius:8px;border:1px solid #BACFC3;background:#fff;font:600 13px system-ui;cursor:pointer}.bar .p{background:#137A52;border-color:#137A52;color:#fff}' +
    'header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #137A52;padding-bottom:12px;margin-bottom:16px}header img{width:48px;height:48px;object-fit:contain}' +
    'header h1{margin:0;font:600 21px/1.2 Newsreader,Georgia,serif}header small{display:block;color:#4A6054}h2{font:600 15px/1.3 Newsreader,Georgia,serif;margin:18px 0 8px}' +
    '.meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;margin:0 0 12px}.meta div{display:flex;gap:8px}.meta b{min-width:96px;color:#4A6054;font-weight:600}' +
    '.kpis{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 6px}.kpi{border:1px solid #D8E3DD;border-radius:8px;padding:6px 10px;min-width:82px}.kpi b{display:block;font-size:17px}.kpi span{font-size:11px;color:#4A6054}' +
    'table{width:100%;border-collapse:collapse;margin:6px 0}th,td{border:1px solid #D8E3DD;padding:5px 6px;text-align:left;vertical-align:top}th{background:#F2F7F4;font-size:11.5px}td.n,th.n{text-align:center}' +
    '.cal td{height:46px;width:14.28%;padding:3px 5px}.cal .d{font-size:10.5px;color:#7E9388}.cal .x{background:#F4F8F5}.mk{display:inline-block;margin-top:3px;padding:1px 6px;border-radius:5px;font-weight:700;font-size:12px}' +
    '.m-P{background:#CDF2DA;color:#14803C}.m-A{background:#FFDCDC;color:#D42626}.m-T{background:#DFE3FF;color:#4338CA}.m-L{background:#FFE9C2;color:#B25A00}.m-S{background:#F9DDFC;color:#A21CAF}' +
    '.m-E{background:#C9F3EC;color:#0F766E}.m-X{background:#D6EEFD;color:#0369A1}.m-N{background:#E2E8F0;color:#475569}.m-R,.m-C{background:#E7E9EC;color:#5B6470}' +
    '.lg{display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;color:#4A6054;margin:6px 0}.foot{margin-top:22px;border-top:1px solid #D8E3DD;padding-top:8px;font-size:11px;color:#7E9388;display:flex;justify-content:space-between}' +
    '@media print{body{background:#fff}.page{box-shadow:none;margin:0;max-width:none;padding:0;border-radius:0}.bar{display:none}}' +
    '</style></head><body><div class="bar"><button onclick="window.close()">Close</button><button class="p" onclick="window.print()">Print / Save as PDF</button></div>' +
    '<div class="page"><header>' + (s.logo ? '<img src="' + esc(s.logo) + '" alt="">' : "") + '<div><h1>' + esc(s.academyName || "ManzilulQuran") + '</h1><small>' + esc(title) + '</small></div></header>' +
    body + '<div class="foot"><span>' + esc(s.academyName || "ManzilulQuran") + (s.contactPhone ? " · " + esc(s.contactPhone) : "") + '</span><span>Issued ' + esc(fmtDate(today())) + '</span></div></div></body></html>';
  const win = window.open("", "_blank");
  if (!win) { toast("Allow pop-ups for this site, then try again", "bad", 6000); return; }
  win.document.open(); win.document.write(html); win.document.close();
  toast("Report ready — use Print / Save as PDF", "ok", 4200);
}
const ATT_LEGEND = '<div class="lg">' + ["P", "A", "T", "L", "S", "E", "X", "N", "R", "C"].map(k => '<span><span class="mk m-' + k + '">' + esc(attSym(k)) + '</span> ' + esc(ATT_MK[k].name) + '</span>').join("") + '</div>';
function attStudentReport(planId, month){
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = DataService.getStudent(pl.studentId) || {}, t = DataService.getTeacher(pl.teacherId) || {}, tt = attTotals(pl, month);
  const rows = DataService.getClasses({ planId: pl.id, month: month, notes: true });
  const n = daysInMonth(month), first = (parseYMD(month + "-01").getDay() + 6) % 7;
  let cal = '<table class="cal"><tr>' + ATT_WEEK.map(d => '<th>' + d + '</th>').join("") + '</tr><tr>';
  for (let i = 0; i < first; i++) cal += '<td class="x"></td>';
  for (let d = 1; d <= n; d++) {
    const ds = month + "-" + pad2(d), c = DataService.classAt(pl.id, ds), k = markOf(c), hol = Logic.isHoliday(ds);
    if ((first + d - 1) % 7 === 0 && d > 1) cal += '</tr><tr>';
    cal += '<td' + (!attPossible(pl, ds) && !k ? ' class="x"' : "") + '><div class="d">' + d + (hol ? " · " + esc(hol.name) : "") + '</div>' + (k ? '<span class="mk m-' + k + '">' + esc(attSym(k)) + '</span>' : "") + '</td>';
  }
  const tail = (7 - (first + n) % 7) % 7; for (let i = 0; i < tail; i++) cal += '<td class="x"></td>';
  cal += '</tr></table>';
  const notes = rows.filter(c => attNoteLine(c)).sort((a, b) => a.date.localeCompare(b.date));
  const res = rows.filter(c => c.activity === "Exam" || c.activity === "Test");
  attReportWindow("Attendance report · " + monthLabel(month),
    '<div class="meta"><div><b>Student</b>' + esc(st.name || pl.studentId) + ' (' + esc(pl.studentId) + ')</div><div><b>Month</b>' + esc(monthLabel(month)) + '</div>' +
      '<div><b>Course</b>' + esc(pl.course || "—") + '</div><div><b>Teacher</b>' + esc(t.name || "—") + '</div>' +
      '<div><b>Class days</b>' + esc((pl.days || []).join(", ") || "—") + '</div><div><b>Time</b>' + esc(pl.time ? time12(pl.time) + " (IST)" : "—") + '</div></div>' +
    '<div class="kpis">' + [[tt.p, "Present"], [tt.s, "With substitute"], [tt.a, "Absent"], [tt.l, "Leave"], [tt.t, "Teacher absent"], [tt.h, "Classes held"], [tt.pct === null ? "—" : tt.pct + "%", "Attendance"]]
      .map(k => '<div class="kpi"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>').join("") + '</div>' +
    '<h2>Day by day</h2>' + cal + ATT_LEGEND +
    (res.length ? '<h2>Exams and tests</h2><table><tr><th>Date</th><th>Kind</th><th>Portion</th><th>Result</th></tr>' + res.map(c => '<tr><td>' + esc(fmtDate(c.date)) + '</td><td>' + esc(c.activity) + '</td><td>' + esc(c.portion || "—") + '</td><td><b>' + esc(c.result || "—") + '</b></td></tr>').join("") + '</table>' : "") +
    (notes.length ? '<h2>Notes</h2><table>' + notes.map(c => '<tr><td style="width:90px">' + esc(fmtDate(c.date)) + '</td><td>' + esc(attNoteLine(c)) + '</td></tr>').join("") + '</table>' : ""));
}
function attTeacherReport(teacherId, month){
  const t = DataService.getTeacher(teacherId); if (!t) return;
  const own = DataService.getClasses({ month: month }).filter(c => c.teacherId === teacherId);
  const planIds = {}; own.forEach(c => planIds[c.planId] = 1);
  Logic.sheetPlans(month).filter(p => p.teacherId === teacherId).forEach(p => planIds[p.id] = 1);
  const lines = Object.keys(planIds).map(function(pid){
    const pl = DataService.getPlan(pid); if (!pl) return null;
    const st = DataService.getStudent(pl.studentId) || {};
    const mine = own.filter(c => c.planId === pid), k = x => mine.filter(c => markOf(c) === x).length;
    const p = k("P") + k("E") + k("X"), a = k("A"), l = k("L"), ta = k("T"), s = k("S"), h = p + a;
    return { name: st.name || pl.studentId, course: pl.course || "", days: (pl.days || []).join(" "), p: p, a: a, l: l, t: ta, s: s, h: h, pct: h ? Math.round(p * 1000 / h) / 10 : null };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  const subs = DataService.getClasses({ month: month }).filter(c => c.status === "Substitute" && c.takenBy === teacherId);
  const sum = k => lines.reduce((x, L) => x + L[k], 0);
  attReportWindow("Teacher attendance report · " + monthLabel(month),
    '<div class="meta"><div><b>Teacher</b>' + esc(t.name) + ' (' + esc(t.id) + ')</div><div><b>Month</b>' + esc(monthLabel(month)) + '</div></div>' +
    '<div class="kpis">' + [[lines.length, "Students"], [sum("p"), "Classes taken"], [sum("a") + sum("l"), "Student absent / leave"], [sum("t"), "Teacher absent"], [sum("s"), "Taken by a substitute"], [subs.length, "Substitute classes for others"]]
      .map(k => '<div class="kpi"><b>' + k[0] + '</b><span>' + k[1] + '</span></div>').join("") + '</div>' +
    '<h2>Students</h2><table><tr><th>Student</th><th>Course</th><th>Days</th><th class="n">Present</th><th class="n">Absent</th><th class="n">Leave</th><th class="n">Teacher absent</th><th class="n">Substitute</th><th class="n">Attend %</th></tr>' +
      lines.map(L => '<tr><td><b>' + esc(L.name) + '</b></td><td>' + esc(L.course) + '</td><td>' + esc(L.days || "—") + '</td><td class="n">' + L.p + '</td><td class="n">' + L.a + '</td><td class="n">' + L.l +
        '</td><td class="n">' + L.t + '</td><td class="n">' + L.s + '</td><td class="n">' + (L.pct === null ? "—" : L.pct + "%") + '</td></tr>').join("") + '</table>' +
    (subs.length ? '<h2>Classes taken as a substitute</h2><table><tr><th>Date</th><th>Student</th><th>Usual teacher</th></tr>' + subs.sort((a, b) => a.date.localeCompare(b.date)).map(function(c){
      const st = DataService.getStudent(c.studentId) || {}, reg = DataService.getTeacher(c.teacherId) || {};
      return '<tr><td>' + esc(fmtDate(c.date)) + '</td><td>' + esc(st.name || c.studentId) + '</td><td>' + esc(reg.name || "—") + '</td></tr>'; }).join("") + '</table>' : ""));
}
function attResultsReport(month){
  const list = attResults(month);
  if (!list.length) { toast("No exams or tests in " + monthLabel(month), "warn"); return; }
  attReportWindow("Exam and test results · " + monthLabel(month),
    '<table><tr><th>Date</th><th>Student</th><th>Kind</th><th>Course</th><th>Portion</th><th>Result</th><th>Teacher</th></tr>' + list.map(function(c){
      const st = DataService.getStudent(c.studentId) || {}, pl = DataService.getPlan(c.planId) || {}, t = DataService.getTeacher(c.takenBy || c.teacherId) || {};
      return '<tr><td>' + esc(fmtDate(c.date)) + '</td><td><b>' + esc(st.name || c.studentId) + '</b></td><td><span class="mk m-' + (c.activity === "Exam" ? "E" : "X") + '">' + esc(c.activity) + '</span></td><td>' +
        esc(pl.course || "") + '</td><td>' + esc(c.portion || "—") + '</td><td><b>' + esc(c.result || "—") + '</b></td><td>' + esc(t.name || "—") + '</td></tr>'; }).join("") + '</table>');
}

/* ---- actions ---- */
Object.assign(Actions, {
  "ax-exit": () => { attUnmount(); go(WS.ind.home === "iAtt" ? "iDash" : WS.ind.home); },
  "ax-go": (page) => { attUnmount(); go(page); },
  "ax-tab": (t) => { State.iatt.tab = t; State.iatt.menu = false; if (t !== "sheet") State.iatt.sel = null; render(); },
  "ax-month": (n) => { State.month = addMonths(State.month, +n); State.iatt.sel = null; const gm = $("#globalMonth"); if (gm) gm.innerHTML = monthOpts(State.month, ""); render(); },
  "ax-setmonth": (m) => { State.month = m; State.iatt.sel = null; if (State.iatt.tab === "today") State.iatt.tab = "sheet"; const gm = $("#globalMonth"); if (gm) gm.innerHTML = monthOpts(State.month, ""); render(); },
  "ax-menu": () => { State.iatt.menu = !State.iatt.menu; State.iatt.add = false; ATT_FX.menu = State.iatt.menu; render(); },
  "ax-add": () => { State.iatt.add = !State.iatt.add; State.iatt.menu = false; ATT_FX.add = State.iatt.add; render(); },
  "ax-pickmonth": (id, el) => { if (el && el.value && el.value !== State.month) Actions["ax-setmonth"](el.value); },
  "ax-refresh": () => { State.iatt.menu = false; Actions["att-refresh"](); },
  "ax-mode": (m) => { State.iatt.mode = m; if (m === "brush") State.iatt.sel = null; render(); },
  "ax-mk": (k) => {
    const f = State.iatt, s = f.sel;
    if (f.mode === "select" && s && attTab() === "sheet") {
      if (k === "-") { if (attCanEdit(monthOf(s.ds))) { attWrite([{ planId: s.planId, ds: s.ds, k: "" }], "clear"); render(); } return; }
      if (k === "S") { attMark(s.planId, s.ds, "S"); return; }
      if (!attCanEdit(monthOf(s.ds))) return;
      attWrite([{ planId: s.planId, ds: s.ds, k: k }], "mark"); attNextDay(); render(); return;
    }
    f.mode = "brush"; f.brush = k; f.sel = null;
    if (attTab() !== "sheet") f.tab = "sheet";
    toast("Brush on — tap or drag across days to mark them " + (k === "-" ? "empty" : ATT_MK[k].name), "ok", 2600);
    render();
  },
  "ax-shrink": () => { const C = attCols(); State.iatt.shrink = !C.shrink; render(); },
  "ax-sort": () => { attPref("order", []); State.iatt.menu = false; toast("Rows sorted by class time", "ok"); render(); },
  "ax-zoom": (d) => { const z = +d === 0 ? 1 : Math.max(0.7, Math.min(1.6, Math.round((attZoom() + (+d) * 0.1) * 100) / 100)); attPref("zoom", z); render(); },
  "ax-theme": (t) => { attPref("theme", t); render(); },
  "ax-nodays": () => { State.iatt.onlyNoDays = !State.iatt.onlyNoDays; render(); },
  "ax-wa": (planId, el) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const st = DataService.getStudent(pl.studentId) || {}, num = st.whatsapp || st.phone;
    if (!num) { toast("No WhatsApp number saved for " + (st.name || "this student"), "bad"); return; }
    window.open(Logic.waLink(num, attAbsentText(st, pl, el.dataset.ds || today())), "_blank");
  },
  "ax-wa-text": () => { State.iatt.menu = false; openModal({ title: "Absent WhatsApp message", wide: true, submitText: "Save",
    body: '<div class="note">Sent from the 💬 button on an absent mark. {name}, {course}, {date} and {academy} are filled in.</div>' +
      '<textarea class="textarea" name="t" rows="5">' + esc(Settings().absentWaText || "Assalamu Alaikum. {name} was absent from the {course} class on {date}. Please let us know if everything is fine.\n\n{academy}") + '</textarea>',
    onSubmit: function(d){ DataService.saveSettings({ absentWaText: String(d.t || "").trim() }); toast("Message saved", "ok"); } }); },
  /* class days tab */
  "ax-pday": (planId, el) => {
    const pl = DataService.getPlan(planId); if (!pl) return;
    const days = (pl.days || []).slice(), d = el.dataset.day, i = days.indexOf(d);
    if (i >= 0) days.splice(i, 1); else days.push(d);
    attPlanSave(pl, { days: ATT_WEEK.filter(x => days.indexOf(x) >= 0) }, "changed class days"); render();
  },
  "ax-ptime": (planId, el) => { const pl = DataService.getPlan(planId); if (pl && attPlanSave(pl, { time: el.value || "" }, "changed class time")) toast("Time saved", "ok", 1400); },
  "ax-pmin": (planId, el) => { const pl = DataService.getPlan(planId); if (pl && attPlanSave(pl, { duration: +el.value || 0 }, "changed class minutes")) toast("Minutes saved", "ok", 1400); },
  "ax-pstart": (planId, el) => { const pl = DataService.getPlan(planId); if (pl && el.value && attPlanSave(pl, { startDate: el.value }, "changed start date")) toast("Start date saved", "ok", 1400); },
  "ax-pickrow": (planId, el) => { State.iatt.pick[planId] = !!el.checked; render(); },
  "ax-pickall": (id, el) => { attSchedRows().forEach(p => { State.iatt.pick[p.id] = !!el.checked; }); render(); },
  "ax-bday": (d) => { const b = State.iatt.bulkDays, i = b.indexOf(d); if (i >= 0) b.splice(i, 1); else b.push(d); render(); },
  "ax-btime": (id, el) => { State.iatt.bulkTime = el.value || ""; },
  "ax-bclear": () => { State.iatt.pick = {}; render(); },
  "ax-bapply": () => {
    const f = State.iatt, ids = Object.keys(f.pick).filter(k => f.pick[k]);
    if (!f.bulkDays.length && !f.bulkTime) { toast("Choose the days or a time first", "warn"); return; }
    let n = 0;
    ids.forEach(function(id){
      const pl = DataService.getPlan(id); if (!pl) return;
      const patch = {};
      if (f.bulkDays.length) patch.days = ATT_WEEK.filter(x => f.bulkDays.indexOf(x) >= 0);
      if (f.bulkTime) patch.time = f.bulkTime;
      if (attPlanSave(pl, patch, "changed class days")) n++;
    });
    f.pick = {}; toast(n + " plan" + (n === 1 ? "" : "s") + " updated", "ok"); render();
  },
  /* make-ups */
  "ax-mu-held": (planId, el) => {
    const c = DataService.classAt(planId, el.dataset.ds); if (!c) return;
    const ds = c.makeup || "";
    if (!ds) { attNote(planId, today(), "P", { makeup: c.date }); return; }
    if (!attCanEdit(monthOf(ds))) return;
    const cur = DataService.classAt(planId, ds);
    if (cur && (cur.status === "Completed" || cur.status === "Substitute")) { attWrite([{ planId: planId, ds: ds, k: markOf(cur), extra: { makeup: c.date } }], "make-up"); }
    else attWrite([{ planId: planId, ds: ds, k: "P", extra: { makeup: c.date } }], "make-up");
    toast("Make-up marked on " + fmtDate(ds), "ok"); render();
  },
  /* reports */
  "ax-rep-student": () => {
    State.iatt.menu = false;
    const plans = Logic.sheetPlans(State.month);
    openModal({ title: "Student attendance report", submitText: "Open the report",
      body: field("Student", sel("p", optList(plans.map(p => ({ value: p.id, label: ((DataService.getStudent(p.studentId) || {}).name || p.studentId) + " · " + (p.course || "") })), State.iatt.sel ? State.iatt.sel.planId : "", "Choose"))) +
        field("Month", sel("m", monthOpts(State.month, ""))),
      onSubmit: function(d){ if (!d.p) { toast("Choose the student", "bad"); return false; } attStudentReport(d.p, d.m || State.month); } });
  },
  "ax-rep-teacher": () => {
    State.iatt.menu = false;
    openModal({ title: "Teacher attendance report", submitText: "Open the report",
      body: field("Teacher", sel("t", teacherOpts(State.iatt.teacher, "Choose"))) + field("Month", sel("m", monthOpts(State.month, ""))),
      onSubmit: function(d){ if (!d.t) { toast("Choose the teacher", "bad"); return false; } attTeacherReport(d.t, d.m || State.month); } });
  },
  "ax-rep-results": () => { State.iatt.menu = false; attResultsReport(State.month); },
  "ax-rep-plan": (planId) => { closeModal(); attStudentReport(planId, State.month); },

  "att-um": () => { State.iatt.unmarked = !State.iatt.unmarked; if (State.iatt.unmarked) State.iatt.tab = "sheet"; render(); },
  "att-day": (n) => {
    if (+n === 0) State.iatt.date = today();
    else { const d = parseYMD(State.iatt.date || today()); d.setDate(d.getDate() + (+n)); State.iatt.date = ymd(d); }
    render();
  },
  "att-date": (id, el) => { if (el.value) { State.iatt.date = el.value; render(); } },
  "att-set": (planId, el) => attMark(planId, el.dataset.ds, el.dataset.k),
  "att-note": (planId, el) => attNote(planId, el.dataset.ds),
  "att-nk": (id, el) => {
    const form = $("#mForm"); if (!form) return;
    form.querySelectorAll("[data-af]").forEach(function(box){
      box.style.display = (ATT_FIELDS[el.value] || []).indexOf(box.dataset.af) >= 0 ? "" : "none";
      if (box.dataset.af === "by") box.querySelector("label").textContent = el.value === "S" ? "Substitute teacher (gets paid)" : "Taken by";
      if (box.dataset.af === "makeup") box.querySelector("label").textContent = el.value === "P" ? "Make-up for (the missed day)" : "Make-up on";
    });
  },
  "att-unsel": () => { State.iatt.sel = null; render(); },
  "att-undo": () => {
    const u = ATT_UNDO.pop(); if (!u) { toast("Nothing to undo", "warn"); return; }
    ATT_REDO.push({ label: u.label, items: attRestore(u.items) }); toast("Undone: " + u.label, "ok"); render();
  },
  "att-redo": () => {
    const u = ATT_REDO.pop(); if (!u) { toast("Nothing to redo", "warn"); return; }
    ATT_UNDO.push({ label: u.label, items: attRestore(u.items) }); toast("Redone: " + u.label, "ok"); render();
  },
  "att-close": () => {
    State.iatt.menu = false;
    const m = State.month, um = Logic.unmarked(m).count;
    confirmAction({ title: "Close " + monthLabel(m), danger: um > 0,
      note: (um ? "⚠ " + um + " class days in " + monthLabel(m) + " still have no mark. " : "") +
        "Closing marks the month as finished: changing a mark afterwards asks for confirmation first. Do it after payroll and reconciliation.",
      message: "Close " + monthLabel(m) + " for attendance?", submitText: "Close the month",
      onConfirm: function(){ const cur = Settings().attLockedThrough || ""; if (m > cur) DataService.saveSettings({ attLockedThrough: m }); toast(monthLabel(m) + " closed", "ok"); render(); } });
  },
  "att-reopen": () => {
    State.iatt.menu = false;
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
          ["Teacher", esc(t.name || "—")], ["Class days", ((pl.days || []).length ? esc(pl.days.join(", ")) : '<span class="out">Not set — set them on the Class days tab</span>') + (pl.time ? " · " + esc(time12(pl.time)) : "")],
          ["This month", tt.p + " present · " + tt.a + " absent · " + tt.t + " teacher absent · " + tt.l + " leave · " + tt.s + " substitute"],
          ["Unmarked", um.length ? '<span class="out">' + um.length + ' day' + (um.length > 1 ? "s" : "") + ': ' + um.map(d => +d.slice(8)).join(", ") + '</span>' : "None"]]) +
        '<div class="btn-row" style="margin-top:12px;flex-wrap:wrap">' +
          (um.length ? '<button type="button" class="btn btn-primary" data-act="att-fill" data-id="' + esc(planId) + '">Mark the ' + um.length + ' unmarked day' + (um.length > 1 ? "s" : "") + ' ✓ Present</button>' : "") +
          '<button type="button" class="btn" data-act="ax-rep-plan" data-id="' + esc(planId) + '">Attendance report (PDF)</button>' +
          ATT_HOOKS.rowButtons(pl) +
          (window.MQ_ADMIN ? "" : '<button type="button" class="btn" data-act="ax-profile" data-id="' + esc(pl.studentId) + '">Open student</button>') +
        '</div>' });
  },
  "ax-profile": (sid) => { closeModal(); attUnmount(); Actions["profile-open"](sid); },
  "att-fill": (planId) => {
    const month = State.month;
    if (!attCanEdit(month)) return;
    const um = (Logic.unmarked(month).lines.find(l => l.planId === planId) || { dates: [] }).dates;
    const n = attWrite(um.map(ds => ({ planId: planId, ds: ds, k: "P" })), "fill row");
    closeModal(); toast(n + " day" + (n > 1 ? "s" : "") + " marked ✓ Present — Undo if that was not right", "ok", 4200); render();
  },
  "att-full": () => {}
});
