"use strict";
/* Academic Service — att-import.v1.js. Brings marks from the old single-file attendance sheet (MQ-Attendance.html)
   into the class log. Reads its Backup file ({ app:"mq-attendance", data:{ teachers, students, months } }).
   Office only. Students and teachers are matched with the Review page's rules (revNameKey / revSamePhone,
   ws-review.v1.js); you confirm which class plan each old row belongs to. Marks already in Academic Service are kept. */

HEAD_ACTS.iAtt = (HEAD_ACTS.iAtt || "") + (window.MQ_ADMIN ? "" : '<button class="btn" data-act="imp-open">Import old sheet</button>');
const IMP = { data: null, rows: [] };
const IMP_MARKS = { P: 1, A: 1, T: 1, L: 1, S: 1, E: 1, X: 1, N: 1 };

function impParse(text){
  const j = JSON.parse(text);
  const d = j && j.app === "mq-attendance" && j.data ? j.data : j;
  if (!d || !Array.isArray(d.students) || !d.months || typeof d.months !== "object") throw new Error("This is not a backup file from the attendance sheet");
  return d;
}
function impBestTeacher(t){
  if (!t) return null;
  const list = DB.teachers.filter(x => x.kind !== "staff");
  return list.find(x => revNameKey(x.name) === revNameKey(t.name)) ||
    list.map(x => ({ x: x, s: revSimilar(x.name, t.name) })).filter(o => o.s >= 0.85).sort((a, b) => b.s - a.s).map(o => o.x)[0] || null;
}
function impBestStudent(s){
  return DB.students.find(x => s.phone && (revSamePhone(s.phone, x.phone) || revSamePhone(s.phone, x.whatsapp))) ||
    DB.students.find(x => revNameKey(x.name) === revNameKey(s.name)) ||
    DB.students.map(x => ({ x: x, s: revSimilar(x.name, s.name) })).filter(o => o.s >= 0.85).sort((a, b) => b.s - a.s).map(o => o.x)[0] || null;
}
/* one line per old student + course: the plan it most likely is */
function impBuild(d){
  const tMap = {}; (d.teachers || []).forEach(t => { const m = impBestTeacher(t); tMap[t.id] = m ? m.id : ""; });
  const sById = {}; (d.students || []).forEach(s => sById[s.id] = s);
  const groups = {};
  Object.keys(d.months).sort().forEach(function(k){
    const mo = d.months[k] || {};
    (mo.rows || []).forEach(function(r){
      const key = r.sid + "|" + String(r.course || "").toLowerCase();
      const g = groups[key] = groups[key] || { key: key, sid: r.sid, name: r.name || (sById[r.sid] || {}).name || "?", course: r.course || "", tid: r.tid, rows: [], marks: 0 };
      g.rows.push({ month: k, rid: r.rid, from: r.from, to: r.to });
      const cells = (mo.cells || {})[r.rid] || {}, notes = (mo.notes || {})[r.rid] || {};
      Object.keys(cells).forEach(dd => { if (IMP_MARKS[cells[dd]]) g.marks++; });
      Object.keys(notes).forEach(dd => { if (!cells[dd] && notes[dd]) g.marks++; });
    });
  });
  return { tMap: tMap, list: Object.keys(groups).map(function(key){
    const g = groups[key], old = sById[g.sid] || { name: g.name };
    const st = impBestStudent(old);
    let plan = "";
    if (st) {
      const plans = DataService.getPlans({ studentId: st.id });
      const same = plans.filter(p => String(p.course || "").toLowerCase() === String(g.course || "").toLowerCase());
      const pick = same.find(p => p.status === "Active") || same[0] || (plans.length === 1 ? plans[0] : null);
      plan = pick ? pick.id : "";
    }
    return Object.assign(g, { studentId: st ? st.id : "", planId: plan, teacherName: ((d.teachers || []).find(t => t.id === g.tid) || {}).name || "" });
  }).sort((a, b) => (a.planId ? 1 : 0) - (b.planId ? 1 : 0) || String(a.name).localeCompare(String(b.name))) };
}
function impPlanOpts(g){
  const st = g.studentId ? DataService.getStudent(g.studentId) : null;
  const mine = st ? DataService.getPlans({ studentId: st.id }) : [];
  const label = p => { const s = DataService.getStudent(p.studentId) || {}; return (s.name || p.studentId) + " · " + (p.course || "") + " · " + p.id + (p.status !== "Active" ? " (stopped)" : ""); };
  const rest = DataService.getPlans().filter(p => mine.indexOf(p) < 0).sort((a, b) => label(a).localeCompare(label(b)));
  return '<option value="">Skip — do not import</option>' +
    (mine.length ? '<optgroup label="' + esc(st.name) + '">' + mine.map(p => '<option value="' + esc(p.id) + '"' + (p.id === g.planId ? " selected" : "") + '>' + esc(label(p)) + '</option>').join("") + '</optgroup>' : "") +
    '<optgroup label="Every other plan">' + rest.map(p => '<option value="' + esc(p.id) + '"' + (p.id === g.planId ? " selected" : "") + '>' + esc(label(p)) + '</option>').join("") + '</optgroup>';
}
function impPreview(){
  const R = IMP.rows, ok = R.list.filter(g => g.planId).length;
  const months = Object.keys(IMP.data.months).sort();
  openModal({ title: "Import the old attendance sheet", wide: true, submitText: "Import marks",
    body: '<div class="note">' + R.list.length + ' student rows · ' + months.length + ' month' + (months.length > 1 ? "s" : "") + ' (' + esc(months.map(monthShort).join(", ")) + '). ' +
        ok + ' matched to a class plan; check them, and choose a plan or Skip for the rest. Marks already in Academic Service are kept unless you tick the box below.</div>' +
      R.list.map((g, i) => '<div class="minirow" style="flex-wrap:wrap;gap:8px"><span><b>' + esc(g.name) + '</b> · ' + esc(g.course || "—") +
          '<br><small>' + g.marks + ' marks · old teacher ' + esc(g.teacherName || "—") + (g.planId ? "" : ' · <span class="out">not matched</span>') + '</small></span>' +
          '<select class="select" name="map_' + i + '" style="max-width:100%;min-width:220px">' + impPlanOpts(g) + '</select></div>').join("") +
      '<label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px"><input type="checkbox" name="overwrite"> Replace marks already in Academic Service on the same days</label>' +
      (Object.keys(IMP.data.holidays || {}).length ? '<div class="note" style="margin-top:10px">The old sheet has ' + Object.keys(IMP.data.holidays).length +
        (Object.keys(IMP.data.holidays).length > 1 ? ' holidays' : ' holiday') + '. They are not imported — holidays change fees, so add them yourself with Holidays if they are right.</div>' : ""),
    onSubmit: function(d){
      R.list.forEach((g, i) => { g.planId = d["map_" + i] || ""; });
      const res = impRun(!!d.overwrite);
      setTimeout(() => openModal({ title: "Import finished", hideSubmit: true, cancelText: "Close",
        body: dl([["Marks imported", res.done], ["Kept (already marked here)", res.kept], ["Outside the plan's dates (skipped)", res.outside],
          ["Rows skipped", res.skippedRows.length ? esc(res.skippedRows.join(", ")) : "None"],
          ["Substitute marks with no teacher found", res.subNoTeacher ? '<span class="out">' + res.subNoTeacher + ' — set the substitute on those days</span>' : "None"]]) +
          '<div class="note" style="margin-top:10px">Undo on the Attendance page takes the whole import back.</div>' }), 60);
      render();
    } });
}
function impRun(overwrite){
  const d = IMP.data, R = IMP.rows, list = [], res = { done: 0, kept: 0, outside: 0, skippedRows: [], subNoTeacher: 0 };
  R.list.forEach(function(g){
    if (!g.planId) { res.skippedRows.push(g.name + (g.course ? " (" + g.course + ")" : "")); return; }
    const pl = DataService.getPlan(g.planId); if (!pl) return;
    g.rows.forEach(function(rr){
      const mo = d.months[rr.month] || {}, cells = (mo.cells || {})[rr.rid] || {}, notes = (mo.notes || {})[rr.rid] || {};
      const days = {}; Object.keys(cells).forEach(x => days[x] = 1); Object.keys(notes).forEach(x => days[x] = 1);
      Object.keys(days).forEach(function(dd){
        const day = +dd; if (!day) return;
        const ds = rr.month + "-" + pad2(day);
        let k = cells[dd] || ""; const n = notes[dd] || null;
        if (!IMP_MARKS[k]) k = n ? "N" : "";
        if (!k) return;
        if ((pl.startDate && ds < pl.startDate) || (pl.endDate && ds > pl.endDate)) { res.outside++; return; }
        const cur = DataService.classAt(pl.id, ds);
        if (cur && !overwrite) { res.kept++; return; }
        const extra = {};
        if (n) {
          if (n.by) extra.takenBy = R.tMap[n.by] || "";
          if (n.mins) extra.mins = +n.mins || "";
          if (n.inf) extra.informed = n.inf;
          if (n.before) extra.informedBefore = +n.before || "";
          if (n.makeup) extra.makeup = n.makeup;
          if (n.until) extra.leaveUntil = n.until;
          if (n.portion) extra.portion = String(n.portion);
          if (n.result) extra.result = String(n.result);
          if (Array.isArray(n.tags)) extra.tags = n.tags.slice();
          if (n.text) extra.notes = String(n.text);
        }
        if (k === "S" && !extra.takenBy) res.subNoTeacher++;
        list.push({ planId: pl.id, ds: ds, k: k, extra: extra });
      });
    });
  });
  const keep = window.ATT_ACTOR;
  window.ATT_ACTOR = { name: "Old attendance sheet", via: "import" };
  try { res.done = attWrite(list, "import from old sheet"); } finally { window.ATT_ACTOR = keep; }
  return res;
}
Object.assign(Actions, {
  "imp-open": () => openModal({ title: "Import the old attendance sheet", hideSubmit: true, cancelText: "Close",
    body: '<div class="note">In the old sheet (MQ-Attendance.html) press <b>Backup</b>; it downloads a .json file. Choose that file here. ' +
      'You see every row and its class plan before anything is saved.</div>' +
      '<input type="file" class="input" accept=".json,application/json" data-act="imp-file">' }),
  "imp-file": (id, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = function(){
      try { IMP.data = impParse(String(rd.result)); IMP.rows = impBuild(IMP.data); }
      catch (e) { toast(String(e.message || e), "bad", 5000); return; }
      if (!IMP.rows.list.length) { toast("The file has no month rows", "warn"); return; }
      impPreview();
    };
    rd.readAsText(f);
  }
});
