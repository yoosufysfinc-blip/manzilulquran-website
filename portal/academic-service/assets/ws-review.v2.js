"use strict";
/* Academic Service — ws-review.v1.js. Individual workspace → Review: everything a class admin added or changed
   on the attendance link (records with reviewed === false, see att-admin.v1.js), for the office to check:
   set fee and pay, merge duplicates, undo a change, deactivate, waive fees after a stopped class. */

(function(){
  const manage = WS.ind.nav.find(g => g[0] === "Manage");
  if (manage && !manage[1].some(x => x[0] === "iRev")) {
    const at = manage[1].findIndex(x => x[0] === "iAtt");
    manage[1].splice(at >= 0 ? at + 1 : 0, 0, ["iRev", "✓", "Review", "Review"]);
  }
  PAGE_WS.iRev = "ind";
  PAGE_SUB.iRev = "Students, teachers and classes added or changed by class admins. Nothing about money changes until you act here.";
})();
State.irev = { kind: "" };
/* this page's few styles travel with it (no stylesheet version needed) */
(function(){
  const css = ".rev-list{display:grid;gap:10px}.rev-card .card-bd{padding:14px 15px}.rev-top b{font-size:15px}" +
    ".rev-kind{display:inline-block;text-transform:uppercase;font-size:10.5px;letter-spacing:.06em;font-weight:700;color:var(--pri);background:var(--tint);border-radius:6px;padding:2px 7px;margin-right:4px}" +
    ".rev-sub{color:var(--muted);font-size:12.5px;margin-top:3px}.rev-flags{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    ".rev-flags .chip.warn{background:var(--warn-bg);color:var(--warn);border-color:transparent}" +
    ".rev-dup{margin:10px 0 0;border-color:#e0776b}.rev-h{border-top:1px solid var(--line-2);margin-top:10px;padding-top:8px}" +
    ".rev-h small{color:var(--muted)}.rev-card .btn-row .btn{min-height:40px}";
  const el = document.createElement("style"); el.textContent = css; document.head.appendChild(el);
})();

/* ---- the list ---- */
const REV_COLLS = [["students", "student"], ["teachers", "teacher"], ["plans", "class"]];
function revItems(){
  const out = [];
  REV_COLLS.forEach(function(p){
    (DB[p[0]] || []).forEach(function(r){
      if (r.reviewed !== false) return;
      const h = r.history || [], last = h[h.length - 1] || {};
      out.push({ coll: p[0], kind: p[1], rec: r, last: last, at: last.at || r.addedAt || "" });
    });
  });
  return out.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function revCount(){ return revItems().length; }

/* ---- matching (same rules as the admin link's search, att-admin.v1.js — keep both copies in step) ---- */
function revDigits(v){ return String(v || "").replace(/\D/g, ""); }
function revSamePhone(a, b){ a = revDigits(a); b = revDigits(b); if (a.length < 9 || b.length < 9) return false;
  const n = Math.min(10, a.length, b.length); return a.slice(-n) === b.slice(-n); }
function revNameKey(s){
  let t = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ");
  t = t.replace(/\b(muhammed|mohammed|mohamed|muhammad|mohammad|muhamad|mohamad|mohd|md)\b/g, "muhammad")
       .replace(/\b(fathima|fatima|fathimah|fatimah|fathema)\b/g, "fatima").replace(/\b(abdul|abdhul|abdool)\b/g, "abdul");
  t = t.replace(/th/g, "t").replace(/dh/g, "d").replace(/kh/g, "k").replace(/ph/g, "f").replace(/bh/g, "b")
       .replace(/ee/g, "i").replace(/oo/g, "u").replace(/(.)\1+/g, "$1").replace(/h\b/g, "");
  return t.split(/\s+/).filter(Boolean).sort().join(" ");
}
function revSimilar(a, b){
  a = revNameKey(a); b = revNameKey(b); if (!a || !b) return 0; if (a === b) return 1;
  const m = a.length, n = b.length, d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}
function revMatches(rec, list){
  const out = [];
  list.forEach(function(r){
    if (r.id === rec.id) return;
    let score = 0, why = "";
    if ((rec.phone && (revSamePhone(rec.phone, r.phone) || revSamePhone(rec.phone, r.whatsapp))) ||
        (rec.whatsapp && (revSamePhone(rec.whatsapp, r.whatsapp) || revSamePhone(rec.whatsapp, r.phone)))) { score = 100; why = "same phone number"; }
    else if (rec.name && revNameKey(rec.name) === revNameKey(r.name)) { score = 80; why = "same name"; }
    else if (rec.guardian && r.guardian && revNameKey(rec.guardian) === revNameKey(r.guardian) && revSimilar(rec.name, r.name) >= 0.75) { score = 70; why = "same parent, similar name"; }
    else if (rec.name && revSimilar(rec.name, r.name) >= 0.85) { score = 50; why = "similar name"; }
    if (score) out.push({ rec: r, score: score, why: why });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/* ---- how a change reads ---- */
const REV_LABEL = { name: "Name", guardian: "Parent", whatsapp: "WhatsApp", phone: "Phone", gender: "Gender", notes: "Notes",
  teacherId: "Teacher", course: "Course", time: "Time", days: "Class days", duration: "Minutes", status: "Status", endDate: "Last class day", stopReason: "Reason" };
function revVal(field, v){
  if (v === "" || v === undefined || v === null) return "—";
  if (field === "teacherId") { const t = DataService.getTeacher(v); return t ? t.name : v; }
  if (Array.isArray(v)) return v.join(", ") || "—";
  if (field === "time") return time12(v);
  return String(v);
}
function revWhen(iso){ return iso ? fmtDate(iso.slice(0, 10)) + ", " + iso.slice(11, 16) + " UTC" : ""; }
function revHistoryHtml(rec){
  return (rec.history || []).slice(-5).reverse().map(function(h){
    const ch = Object.keys(h.changes || {}).map(function(f){
      const c = h.changes[f];
      return '<div class="minirow"><span>' + esc(REV_LABEL[f] || f) + '</span><b>' + esc(revVal(f, c[0])) + ' → ' + esc(revVal(f, c[1])) +
        (c[2] ? ' <small>(' + esc(c[2]) + ')</small>' : "") + '</b></div>';
    }).join("");
    return '<div class="rev-h"><small>' + esc(h.what || "changed") + ' · ' + esc(h.by || "—") + ' · ' + esc(revWhen(h.at)) + (h.undone ? ' · <b>undone</b>' : "") + '</small>' + ch + '</div>';
  }).join("");
}
function revOpenFees(pl){
  if (!pl || !pl.endDate) return [];
  const after = monthOf(pl.endDate);
  return DB.fees.filter(f => f.planId === pl.id && f.month > after && !f.waived && !(Logic.paidOn(f.id) > 0));
}
function revTitle(it){
  const r = it.rec;
  if (it.kind === "class") { const st = DataService.getStudent(r.studentId) || {}; return (st.name || r.studentId) + " · " + (r.course || "class"); }
  return r.name || r.id;
}
function revCard(it){
  const r = it.rec, k = it.kind, last = it.last;
  const added = /^added/.test(last.what || "") && (r.history || []).length === 1;
  const flags = [];
  if (k === "class" && r.setupNeeded) flags.push("Fee and teacher pay not set");
  if (k === "teacher" && r.setupNeeded) flags.push("Pay not set");
  if (k === "class" && r.status === "Stopped") { const n = revOpenFees(r).length; flags.push("Stopped" + (r.endDate ? " after " + fmtDate(r.endDate) : "") + (n ? " · " + n + " unpaid fee month" + (n > 1 ? "s" : "") + " after it" : "")); }
  if (k === "class" && r.teacherChangedFrom) flags.push("Teacher changed from " + fmtDate(r.teacherChangedFrom) + " — check the pay rule on this plan");
  const dups = k === "student" ? revMatches(r, DB.students) : k === "teacher" ? revMatches(r, DB.teachers.filter(t => t.kind !== "staff")) : [];
  let btn = "";
  const ref = esc(it.coll + "|" + r.id);
  if (k === "class") btn += '<button type="button" class="btn btn-sm' + (r.setupNeeded ? " btn-primary" : "") + '" data-act="plan-edit" data-id="' + esc(r.id) + '">Set fee &amp; pay</button>';
  if (k === "teacher") btn += '<button type="button" class="btn btn-sm' + (r.setupNeeded ? " btn-primary" : "") + '" data-act="teacher-edit" data-id="' + esc(r.id) + '">Set pay</button>';
  if (k === "class" && r.status === "Stopped" && revOpenFees(r).length) btn += '<button type="button" class="btn btn-sm" data-act="rev-waive" data-id="' + esc(r.id) + '">Waive fees after the last class</button>';
  if ((k === "student" || k === "teacher") && dups.length) btn += '<button type="button" class="btn btn-sm btn-primary" data-act="rev-merge" data-id="' + ref + '">Merge duplicate…</button>';
  if (!added && Object.keys(last.changes || {}).length && !last.undone) btn += '<button type="button" class="btn btn-sm" data-act="rev-undo" data-id="' + ref + '">Undo this change</button>';
  if (added && k !== "class") btn += '<button type="button" class="btn btn-sm btn-danger" data-act="rev-off" data-id="' + ref + '">Deactivate</button>';
  if (added && k === "class") btn += '<button type="button" class="btn btn-sm btn-danger" data-act="rev-off" data-id="' + ref + '">Remove / stop</button>';
  btn += '<button type="button" class="btn btn-sm" data-act="rev-ok" data-id="' + ref + '">✓ Looks right</button>';
  return '<div class="card rev-card"><div class="card-bd">' +
    '<div class="rev-top"><span class="rev-kind">' + esc(k) + '</span> <b>' + esc(revTitle(it)) + '</b> ' + idchip(r.id) +
      '<div class="rev-sub">' + esc((last.what || "changed") + " by " + (last.by || r.addedBy || "—") + " · " + revWhen(last.at)) + '</div></div>' +
    (flags.length ? '<div class="rev-flags">' + flags.map(f => '<span class="chip warn">⚠ ' + esc(f) + '</span>').join("") + '</div>' : "") +
    (dups.length ? '<div class="note rev-dup"><b>Possibly already in the records:</b>' + dups.map(m => '<div class="minirow"><span>' + esc(m.rec.name) + ' ' + idchip(m.rec.id) +
      '</span><b class="out">' + esc(m.why) + '</b></div>').join("") + '</div>' : "") +
    revHistoryHtml(r) +
    '<div class="btn-row" style="margin-top:10px;flex-wrap:wrap">' + btn + '</div>' +
  '</div></div>';
}
Pages.iRev = function(){
  const all = revItems(), f = State.irev;
  const list = all.filter(it => !f.kind || it.kind === f.kind);
  const n = k => all.filter(it => it.kind === k).length;
  return '<div class="att-info">' +
      [["", "All", all.length], ["student", "Students", n("student")], ["class", "Classes", n("class")], ["teacher", "Teachers", n("teacher")]]
        .map(c => '<button type="button" class="chip' + (f.kind === c[0] ? " on" : "") + '" data-act="rev-kind" data-id="' + c[0] + '">' + c[1] + ' · ' + c[2] + '</button>').join("") +
    '</div>' +
    (list.length ? '<div class="rev-list">' + list.map(revCard).join("") + '</div>'
      : '<div class="empty"><h4>Nothing to review</h4><p>When a class admin adds or changes a student, teacher or class on their link, it appears here.</p></div>');
};

/* a count on the Review button, and a reminder on the Attendance page */
const _revChrome = chrome;
chrome = function(){
  _revChrome();
  const b = document.querySelector('#navList button[data-page="iRev"]'); if (!b) return;
  let s = b.querySelector(".nb"); const n = revCount();
  if (!s) { s = document.createElement("span"); s.className = "nb"; b.appendChild(s); }
  s.textContent = n; s.style.display = n ? "" : "none";
};
const _revAtt = Pages.iAtt;
Pages.iAtt = function(){
  const n = revCount();
  return (n ? '<div class="att-info"><button type="button" class="chip warn" data-act="goto" data-page="iRev">' + n +
    ' change' + (n > 1 ? "s" : "") + ' from class admins to review</button></div>' : "") + _revAtt();
};

/* ---- acting on it ---- */
function revSplit(ref){ const p = String(ref).split("|"); return { coll: p[0], id: p.slice(1).join("|") }; }
function revGet(ref){ const x = revSplit(ref); return { coll: x.coll, rec: (DB[x.coll] || []).find(r => r.id === x.id) }; }
function revSave(coll, rec){
  if (coll === "students") DataService.saveStudent(rec); else if (coll === "teachers") DataService.saveTeacher(rec); else DataService.savePlan(rec);
}
function revOfficeNote(rec, what, changes){
  rec.history = (rec.history || []).concat([{ at: new Date().toISOString(), by: Settings().markerName || "Office", via: "academic-service", what: what, changes: changes || {} }]).slice(-30);
}
/* every record that points at `from` now points at `to` */
function revRepoint(kind, from, to){
  const fields = kind === "student" ? ["studentId"] : ["teacherId", "takenBy"];
  let n = 0;
  Object.keys(SUPA_TABLE).forEach(function(c){
    if (c === "settings" || !Array.isArray(DB[c])) return;
    DB[c].forEach(r => fields.forEach(f => { if (r[f] === from) { r[f] = to; n++; } }));
  });
  return n;
}
const REV_MERGE_FIELDS = { students: ["name", "guardian", "whatsapp", "whatsappCC", "phone", "email", "gender", "dob", "address", "joiningDate", "notes"],
  teachers: ["name", "phone", "whatsapp", "notes"] };
Object.assign(Actions, {
  "rev-kind": (k) => { State.irev.kind = k || ""; render(); },
  "rev-ok": (ref) => {
    const g = revGet(ref); if (!g.rec) return;
    const next = Object.assign({}, g.rec, { reviewed: true, reviewedAt: new Date().toISOString() });
    if (g.coll === "plans" && next.feeType !== "manual") next.setupNeeded = false;
    if (g.coll === "teachers" && next.indRateType !== "manual") next.setupNeeded = false;
    revSave(g.coll, next);
    toast("Marked as reviewed" + (next.setupNeeded ? " — fee / pay is still manual" : ""), "ok"); render();
  },
  "rev-undo": (ref) => {
    const g = revGet(ref); if (!g.rec) return;
    const h = (g.rec.history || [])[(g.rec.history || []).length - 1]; if (!h || !h.changes) return;
    const lines = Object.keys(h.changes).map(f => (REV_LABEL[f] || f) + ": back to " + revVal(f, h.changes[f][0]));
    confirmAction({ title: "Undo this change", note: lines.join(" · "), message: "Put back the values before " + (h.by || "the admin") + "'s change?", submitText: "Undo",
      onConfirm: function(){
        const cur = (DB[g.coll] || []).find(r => r.id === g.rec.id), next = Object.assign({}, cur);
        Object.keys(h.changes).forEach(f => { next[f] = h.changes[f][0]; });
        let moved = 0;
        if (g.coll === "plans" && h.changes.teacherId && h.changes.teacherId[2]) {
          const from = String(h.changes.teacherId[2]).replace(/^from /, ""), oldT = h.changes.teacherId[0], newT = h.changes.teacherId[1];
          DB.classes.forEach(c => { if (c.planId === cur.id && c.date >= from && c.teacherId === newT) { c.teacherId = oldT; moved++; } });
          delete next.teacherChangedFrom;
        }
        if (g.coll === "plans" && h.changes.status && h.changes.status[1] === "Stopped") delete next.stopReason;
        next.history = (cur.history || []).map((x, i, a) => i === a.length - 1 ? Object.assign({}, x, { undone: true }) : x);
        revOfficeNote(next, "undid " + (h.what || "change"), {});
        next.reviewed = true;
        revSave(g.coll, next);
        toast("Change undone" + (moved ? " · " + moved + " marks back to the earlier teacher" : ""), "ok"); render();
      } });
  },
  "rev-off": (ref) => {
    const g = revGet(ref); if (!g.rec) return;
    if (g.coll === "plans") {
      const marks = DataService.getClasses({ planId: g.rec.id, notes: true }).length, fees = DB.fees.filter(f => f.planId === g.rec.id).length;
      if (!marks && !fees) {
        confirmAction({ title: "Remove this class", danger: true, message: "Remove " + g.rec.id + "? It has no marks and no fees.", submitText: "Remove",
          onConfirm: () => { removeRow("plans", g.rec.id); toast("Class removed", "ok"); render(); } });
      } else {
        confirmAction({ title: "Stop this class", note: marks + " marks and " + fees + " fee records stay as they are.", message: "Stop " + g.rec.id + " from today?", submitText: "Stop",
          onConfirm: () => { const next = Object.assign({}, g.rec, { status: "Stopped", endDate: g.rec.endDate || today(), reviewed: true });
            revOfficeNote(next, "stopped by office", {}); revSave("plans", next); toast("Class stopped", "ok"); render(); } });
      }
      return;
    }
    confirmAction({ title: "Deactivate " + g.rec.name, danger: true,
      note: g.coll === "students" ? "The student becomes Inactive and their active classes stop today. Nothing is deleted." : "The teacher becomes Inactive. Nothing is deleted.",
      message: "Deactivate " + g.rec.name + "?", submitText: "Deactivate",
      onConfirm: function(){
        const next = Object.assign({}, g.rec, { status: "Inactive", reviewed: true });
        revOfficeNote(next, "deactivated by office", {});
        revSave(g.coll, next);
        if (g.coll === "students") DataService.getPlans({ studentId: g.rec.id }).filter(p => p.status === "Active")
          .forEach(p => DataService.savePlan(Object.assign({}, p, { status: "Stopped", endDate: today(), reviewed: true })));
        toast(g.rec.name + " deactivated", "ok"); render();
      } });
  },
  "rev-waive": (planId) => {
    const pl = DataService.getPlan(planId), open = revOpenFees(pl); if (!open.length) return;
    confirmAction({ title: "Waive " + open.length + " fee month" + (open.length > 1 ? "s" : ""),
      note: "Months after the last class (" + fmtDate(pl.endDate) + "): " + open.map(f => monthLabel(f.month)).join(", ") + ". Paid months are never touched.",
      message: "Waive them?", submitText: "Waive",
      onConfirm: function(){
        open.forEach(v => DataService.saveFee({ id: v.id, waived: true, locked: true, remarks: (v.remarks ? v.remarks + " · " : "") + "Waived — class stopped" }));
        toast(open.length + " month" + (open.length > 1 ? "s" : "") + " waived", "ok"); render();
      } });
  },
  "rev-merge": (ref) => {
    const g = revGet(ref); if (!g.rec) return;
    const kind = g.coll === "students" ? "student" : "teacher";
    const pool = g.coll === "students" ? DB.students : DB.teachers.filter(t => t.kind !== "staff");
    const dups = revMatches(g.rec, pool);
    openModal({ title: "Merge " + g.rec.name + " (" + g.rec.id + ")", wide: true, submitText: "Merge",
      body: '<div class="note">Everything linked to ' + esc(g.rec.id) + ' — ' + (kind === "student" ? "class plans, marks, fees and payments" : "plans, marks and payments") +
          ' — moves to the record you keep. ' + esc(g.rec.id) + ' is then removed.</div>' +
        field("Keep this record", sel("keep", optList(pool.filter(r => r.id !== g.rec.id)
          .sort((a, b) => (dups.findIndex(d => d.rec.id === b.id) >= 0) - (dups.findIndex(d => d.rec.id === a.id) >= 0) || String(a.name).localeCompare(String(b.name)))
          .map(r => ({ value: r.id, label: r.name + " · " + r.id + (dups.some(d => d.rec.id === r.id) ? " · " + dups.find(d => d.rec.id === r.id).why : "") })),
          dups.length ? dups[0].rec.id : "", "Choose"), 'data-act="rev-merge-pick" data-id="' + esc(ref) + '"')) +
        '<div id="revMergeFields">' + (dups.length ? revMergeFields(g.coll, g.rec, dups[0].rec) : "") + '</div>',
      onSubmit: function(d){
        const keep = (DB[g.coll] || []).find(r => r.id === d.keep);
        if (!keep) { toast("Choose the record to keep", "bad"); return false; }
        const next = Object.assign({}, keep);
        (REV_MERGE_FIELDS[g.coll] || []).forEach(function(f){
          if (d["use_" + f] === "dup") next[f] = g.rec[f];
          else if ((next[f] === undefined || next[f] === "") && g.rec[f]) next[f] = g.rec[f];
        });
        const moved = revRepoint(kind, g.rec.id, keep.id);
        revOfficeNote(next, "merged " + g.rec.id + " into this record", {});
        revSave(g.coll, next);
        removeRow(g.coll, g.rec.id);
        persist();
        toast(g.rec.id + " merged into " + keep.id + " · " + moved + " linked record" + (moved === 1 ? "" : "s") + " moved", "ok", 5200); render();
      } });
  },
  "rev-merge-pick": (ref, el) => {
    const g = revGet(ref), keep = (DB[g.coll] || []).find(r => r.id === el.value), box = $("#revMergeFields");
    if (box) box.innerHTML = keep ? revMergeFields(g.coll, g.rec, keep) : "";
  }
});
/* where both records have a value and they differ, the office picks one; empty fields are filled from the duplicate */
function revMergeFields(coll, dup, keep){
  const rows = (REV_MERGE_FIELDS[coll] || []).filter(f => dup[f] && keep[f] && String(dup[f]) !== String(keep[f]));
  if (!rows.length) return '<div class="note" style="margin:8px 0 0">No conflicting details — empty fields on ' + esc(keep.id) + ' are filled from ' + esc(dup.id) + '.</div>';
  return '<div class="sub-hd">Different details — choose which to keep</div>' + rows.map(f =>
    '<div class="minirow" style="flex-wrap:wrap;gap:8px"><span>' + esc(REV_LABEL[f] || f) + '</span><span>' +
      '<select class="select" name="use_' + f + '"><option value="keep">' + esc(keep[f]) + ' (' + esc(keep.id) + ')</option>' +
      '<option value="dup">' + esc(dup[f]) + ' (' + esc(dup.id) + ')</option></select></span></div>').join("");
}
