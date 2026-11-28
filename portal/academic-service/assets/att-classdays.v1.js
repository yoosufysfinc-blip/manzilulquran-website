"use strict";
/* Academic Service — att-classdays.v1.js. THE CLASS SHEET'S OWN ATTENDANCE (demo): Class days, Inactive,
   select many, edit everything, and a menu instead of a straight jump into the profile.
   Loaded by portal/demo/attendance/ after att-own.v3.js.

   · INACTIVE instead of Stop: "Make inactive" (last class day + reason) and "Make active". The data stay as
     Academic Service knows them (status "Stopped" + last day), only the words change.
   · CLASS DAYS tab: sort (time, name, teacher, course, days, start · up / down), show (all, active, paused,
     inactive, no days), search as before. LONG-PRESS a row (or "Select") to pick several: make inactive,
     make active, pause, change teacher, change time.
   · EDIT EVERYTHING: one window with the whole class (teacher, course, start, days, time, minutes) and the whole
     student (name, parent, WhatsApp, phone, email, date of birth, gender, address, notes).
   · On the SHEET / TODAY, tapping a student opens a small MENU (profile, edit, class days, mark unmarked,
     WhatsApp, calendar, pause, inactive, report) — nothing opens straight away.
   · Days changed many times in a row reach the class sheet once (its calendar follows from today).
   PUBLISHED FILES ARE IMMUTABLE — create att-classdays.v2.js to change this. */

const CDX = { sort: "time", dir: 1, show: "all", sel: {}, selOn: false, pressed: "" };
(function(){ try { const s = JSON.parse(localStorage.getItem("mq_cdx_v1") || "{}"); if (s.sort) CDX.sort = s.sort; if (s.dir) CDX.dir = s.dir; if (s.show) CDX.show = s.show; } catch (e) {} })();
function cdxKeep(){ try { localStorage.setItem("mq_cdx_v1", JSON.stringify({ sort: CDX.sort, dir: CDX.dir, show: CDX.show })); } catch (e) {} }
const CDX_SORTS = [["time", "Time"], ["name", "Name"], ["teacher", "Teacher"], ["course", "Course"], ["days", "Days"], ["start", "Start"]];
const CDX_SHOWS = [["all", "All"], ["active", "Active"], ["paused", "Paused"], ["inactive", "Inactive"], ["nodays", "No days"]];
const cdxStu = p => DataService.getStudent(p.studentId) || {};
const cdxTea = p => DataService.getTeacher(p.teacherId) || {};
const cdxName = p => String(cdxStu(p).name || p.studentId || "");

/* ---- the words: Inactive, not Stop ---- */
const _cdxPS = admPlanState;
admPlanState = function(pl){
  const r = _cdxPS(pl);
  if (r && r.label) r.label = r.label.replace(/^Stopped · last class/, "Inactive · last class").replace(/^Stopped$/, "Inactive").replace(/^Last class /, "Inactive after ");
  return r;
};
const _cdxOpen = openModal;
openModal = function(o){
  if (o && typeof o.body === "string" && o.body.indexOf('class="ap"') >= 0) {
    o = Object.assign({}, o, { body: o.body
      .replace(">Stop class (left)<", ">Make inactive<").replace(">Undo stop<", ">Make active<").replace(">Cancel the stop<", ">Cancel inactive<")
      .replace("Pause and stop reach", "Pause and inactive reach")
      .replace('<button type="button" class="ap-ed" data-act="adm-edit-plan"', '<button type="button" class="ap-ed" data-act="cdx-edit"')
      .replace('<button type="button" class="ap-ed" data-act="adm-edit-student"', '<button type="button" class="ap-ed" data-act="cdx-edit"') });
  }
  return _cdxOpen(o);
};
function cdxLast(planId){ return DataService.getClasses({ planId: planId }).filter(c => markOf(c) && c.date <= today()).map(c => c.date).sort().pop() || today(); }
function cdxInactive(cur, end, reason){
  const P = admPP(), pz = P.list(cur).filter(p => p.from <= end).map(p => (!p.until || p.until > end) ? Object.assign({}, p, { until: end }) : p);
  const next = Object.assign({}, cur, { status: "Stopped", endDate: end, stopReason: String(reason || "").trim(), pauses: pz });
  admStamp(next, "made inactive", admDiff(cur, next, ["status", "endDate", "stopReason"]));
  DataService.savePlan(next);
  admTell("plan-stopped", { planId: cur.id, endDate: end });
}
function cdxActive(cur){
  const next = Object.assign({}, cur, { status: "Active", endDate: "", stopReason: "" });
  admStamp(next, "made active", admDiff(cur, next, ["status", "endDate", "stopReason"]));
  DataService.savePlan(next);
  admTell("plan-stopped", { planId: cur.id, endDate: "" });
}
Actions["adm-stop-plan"] = function(planId){
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = cdxStu(pl), last = cdxLast(planId);
  openModal({ title: "Make inactive · " + (st.name || pl.studentId), wide: true, submitText: "Make inactive", danger: true,
    body: '<div class="form-grid">' +
      field("Last class day", '<input class="input" type="date" name="end" value="' + esc(last) + '" min="' + esc(pl.startDate || "") + '">' +
        admDateChips("end", "", [["Last marked · " + fmtDate(last), last], ["Today", today()], ["Yesterday", admAddDays(today(), -1)]])) +
      field("Reason", '<input class="input" name="reason" placeholder="e.g. finished, moved, fees">') +
      '<div class="field span2"><div class="note" style="margin:0">After the last class day the class is inactive: the teacher page drops it and the class sheet link turns off. Marks before it stay. Make active brings it back any time.</div></div></div>',
    onSubmit: function(d){
      const cur = DataService.getPlan(planId), end = d.end || today();
      if (cur.startDate && end < cur.startDate) { toast("The class starts on " + fmtDate(cur.startDate), "bad"); return false; }
      cdxInactive(cur, end, d.reason);
      toast("Inactive after " + fmtDate(end), "ok", 4000); render();
    } });
};
Actions["adm-unstop"] = function(planId){
  const pl = DataService.getPlan(planId); if (!pl) return;
  confirmAction({ title: "Make active · " + (cdxStu(pl).name || pl.studentId),
    message: "The class is active again with no last day. If its class sheet was switched off, switch it on again in the class sheet list.", submitText: "Make active",
    onConfirm: () => { cdxActive(DataService.getPlan(planId)); toast("Active again", "ok"); render(); } });
};

/* ---- days changed several times in a row: the class sheet hears it once ---- */
(function(){
  const tell = admTell, wait = {};
  admTell = function(ev, data){
    if (ev !== "days-changed" || !data || !data.planId) return tell(ev, data);
    clearTimeout(wait[data.planId]);
    wait[data.planId] = setTimeout(() => { delete wait[data.planId]; const p = DataService.getPlan(data.planId); tell(ev, Object.assign({}, data, { days: p ? (p.days || []).slice() : data.days })); }, 1600);
  };
})();

/* ---- CLASS DAYS ---- */
function cdxKind(p){ const k = admPlanState(p).k; return k === "stopped" || k === "stopping" ? "inactive" : k === "paused" || k === "pausing" ? "paused" : "active"; }
function cdxRows(){
  const f = State.iatt, q = (f.q || "").toLowerCase().trim(), t0 = today();
  const all = DataService.getPlans().filter(p => DataService.getStudent(p.studentId)).filter(function(p){
    if (f.teacher && p.teacherId !== f.teacher) return false;
    if (f.onlyNoDays && !attNoDays(p)) return false;
    const st = cdxStu(p), t = cdxTea(p);
    return !q || (st.name + " " + p.studentId + " " + (t.name || "") + " " + (p.course || "")).toLowerCase().indexOf(q) >= 0;
  });
  const keyOf = {
    time: p => String(p.time || "99:99"), name: p => cdxName(p).toLowerCase(), teacher: p => String(cdxTea(p).name || "~").toLowerCase(),
    course: p => String(p.course || "~").toLowerCase(), start: p => String(p.startDate || "9999"),
    days: p => ATT_WEEK.map(d => (p.days || []).indexOf(d) >= 0 ? "0" : "1").join("") + String((p.days || []).length)
  }[CDX.sort] || (p => "");
  all.sort((a, b) => (keyOf(a) < keyOf(b) ? -1 : keyOf(a) > keyOf(b) ? 1 : cdxName(a).localeCompare(cdxName(b))) * CDX.dir);
  const run = p => p.endDate ? p.endDate >= t0 : p.status === "Active";
  const recent = p => !p.endDate || p.endDate >= addMonths(currentMonth(), -1) + "-01";
  if (CDX.show === "active") return { main: all.filter(p => run(p) && cdxKind(p) === "active"), rest: [] };
  if (CDX.show === "paused") return { main: all.filter(p => run(p) && cdxKind(p) === "paused"), rest: [] };
  if (CDX.show === "inactive") return { main: all.filter(p => !run(p) || cdxKind(p) === "inactive"), rest: [] };
  if (CDX.show === "nodays") return { main: all.filter(p => run(p) && attNoDays(p)), rest: [] };
  const main = all.filter(run);
  main.sort((a, b) => (attNoDays(b) ? 1 : 0) - (attNoDays(a) ? 1 : 0));
  return { main: main, rest: all.filter(p => !run(p) && recent(p)) };
}
attDays = function(){
  const R = cdxRows(), counts = {};
  const allRun = DataService.getPlans().filter(p => DataService.getStudent(p.studentId));
  CDX_SHOWS.forEach(s => { counts[s[0]] = 0; });
  allRun.forEach(p => { const run = p.endDate ? p.endDate >= today() : p.status === "Active"; counts.all++;
    if (!run) counts.inactive++; else { counts[cdxKind(p)]++; if (attNoDays(p) && cdxKind(p) !== "inactive") counts.nodays++; } });
  const nSel = Object.keys(CDX.sel).filter(k => CDX.sel[k]).length;
  const row = function(p, i){
    const st = cdxStu(p), t = cdxTea(p), ps = admPlanState(p), open = !CDX.selOn && ADM_DOPEN === p.id, on = !!CDX.sel[p.id];
    const chips = ATT_WEEK.map(d => '<i class="' + ((p.days || []).indexOf(d) >= 0 ? "on" : "") + '">' + d.slice(0, 1) + '</i>').join("");
    const stTxt = ps.k === "stopped" ? "Inactive" : ps.k === "stopping" ? "Inactive after " + fmtDate(p.endDate) : ps.k === "paused" ? "Paused" : ps.k === "pausing" ? "Pause soon" : ps.k === "starting" ? "Starts " + fmtDate(p.startDate) : "";
    let h = '<div class="cd cdx' + (open ? " open" : "") + (on ? " picked" : "") + (attNoDays(p) ? " nodays" : "") + ' st-' + ps.k + '" style="--i:' + Math.min(i, 14) + '">' +
      '<button type="button" class="cd-h" data-act="cdx-row" data-id="' + esc(p.id) + '" aria-expanded="' + open + '"' + (CDX.selOn ? ' aria-pressed="' + on + '"' : "") + '>' +
        (CDX.selOn ? '<span class="cdx-ck" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>' : '<span class="cd-av">' + esc(admIni(st.name)) + '</span>') +
        '<span class="cd-t"><b>' + esc(st.name || p.studentId) + '</b><small>' + esc([t.name || "No teacher", p.course].filter(Boolean).join(" · ")) + '</small></span>' +
        '<span class="cd-r"><span class="cd-days">' + chips + '</span><small>' + esc(p.time ? time12(p.time) : "no time") + (p.duration ? " · " + esc(String(p.duration)) + "m" : "") + '</small></span>' +
        (stTxt ? '<span class="cd-st">' + esc(stTxt) + '</span>' : "") +
      '</button>';
    if (open) {
      const ro = ps.k === "stopped";
      h += '<div class="cd-b">' +
        '<div class="cd-f"><label>Class days</label><div class="ax-wk">' + ATT_WEEK.map(d => '<button type="button" class="ax-dayb' + ((p.days || []).indexOf(d) >= 0 ? " on" : "") + '" data-act="ax-pday" data-id="' + esc(p.id) + '" data-day="' + d + '" aria-pressed="' + ((p.days || []).indexOf(d) >= 0) + '"' + (ro ? " disabled" : "") + '>' + d.slice(0, 2) + '</button>').join("") + '</div></div>' +
        '<div class="cd-grid">' +
          '<div class="cd-f"><label>Time (IST)</label><input class="input" type="time" data-act="ax-ptime" data-id="' + esc(p.id) + '" value="' + esc(p.time || "") + '"' + (ro ? " disabled" : "") + '></div>' +
          '<div class="cd-f"><label>Minutes</label><input class="input" type="number" min="0" data-act="ax-pmin" data-id="' + esc(p.id) + '" value="' + esc(p.duration || "") + '" placeholder="45"' + (ro ? " disabled" : "") + '></div>' +
          '<div class="cd-f"><label>Start date</label><input class="input" type="date" data-act="ax-pstart" data-id="' + esc(p.id) + '" value="' + esc(p.startDate || "") + '"' + (ro ? " disabled" : "") + '></div>' +
        '</div>' +
        '<div class="cd-meta">' + esc(ps.label) + (p.endDate && p.stopReason ? " · " + esc(p.stopReason) : "") + '</div>' +
        '<div class="cd-acts">' +
          '<button type="button" class="btn btn-sm btn-primary" data-act="cdx-edit" data-id="' + esc(p.id) + '">Edit everything</button>' +
          (ps.k === "paused" || ps.k === "pausing" ? '<button type="button" class="btn btn-sm" data-act="adm-restart" data-id="' + esc(p.id) + '">Restart / change pause</button>'
            : ro || ps.k === "stopping" ? "" : '<button type="button" class="btn btn-sm" data-act="adm-pause" data-id="' + esc(p.id) + '">Pause</button>') +
          (ro || ps.k === "stopping" ? '<button type="button" class="btn btn-sm" data-act="adm-unstop" data-id="' + esc(p.id) + '">Make active</button>'
            : '<button type="button" class="btn btn-sm btn-danger" data-act="adm-stop-plan" data-id="' + esc(p.id) + '">Make inactive</button>') +
          '<button type="button" class="btn btn-sm" data-act="cdx-profile" data-id="' + esc(p.id) + '">Profile</button>' +
          '<button type="button" class="btn btn-sm cdx-more" data-act="cdx-menu" data-id="' + esc(p.id) + '" aria-label="More">More ⋯</button>' +
        '</div></div>';
    }
    return h + '</div>';
  };
  let h = '<div class="ax-h cdx-hd">Class days <span class="cdx-n">' + (R.main.length + R.rest.length) + '</span>' +
      '<button type="button" class="btn btn-sm cdx-selb' + (CDX.selOn ? " on" : "") + '" data-act="cdx-seltog">' + (CDX.selOn ? "Done" : "Select") + '</button></div>' +
    '<div class="cdx-bar" role="toolbar" aria-label="Sort and show">' +
      '<div class="cdx-seg" aria-label="Show">' + CDX_SHOWS.map(s => '<button type="button" class="cdx-chip' + (CDX.show === s[0] ? " on" : "") + '" data-act="cdx-show" data-id="' + s[0] + '">' + s[1] +
        (counts[s[0]] ? '<em>' + counts[s[0]] + '</em>' : "") + '</button>').join("") + '</div>' +
      '<div class="cdx-sort"><label for="cdxSort">Sort</label><select id="cdxSort" class="input cdx-sel" data-cdx="sort">' +
        CDX_SORTS.map(s => '<option value="' + s[0] + '"' + (CDX.sort === s[0] ? " selected" : "") + '>' + s[1] + '</option>').join("") + '</select>' +
        '<button type="button" class="cdx-dir" data-act="cdx-dir" aria-label="' + (CDX.dir > 0 ? "A to Z — tap for Z to A" : "Z to A — tap for A to Z") + '"><span style="--r:' + (CDX.dir > 0 ? 0 : 180) + 'deg">↑</span></button></div>' +
    '</div>' +
    '<div class="ax-sub">' + (CDX.selOn ? "Tap rows to pick them, then choose what to do below." : "Tap a student for days, time and minutes · long-press to pick several.") + '</div>';
  if (!R.main.length && !R.rest.length) h += '<div class="ax-empty"><h2>No classes here</h2><p>Change Show, clear the search or the teacher.</p></div>';
  else {
    h += '<div class="cd-list">' + R.main.map(row).join("") + '</div>';
    if (R.rest.length) h += '<div class="cd-sub">Inactive recently · ' + R.rest.length + '</div><div class="cd-list">' + R.rest.map(row).join("") + '</div>';
  }
  CDX.bar = !CDX.selOn ? "" : '<div class="cdx-bulk' + (nSel ? " has" : "") + '" id="cdxBulk" role="toolbar" aria-label="With the picked classes">' +
    '<span class="cdx-bn"><b>' + nSel + '</b> picked</span>' +
    '<button type="button" class="cdx-bb" data-act="cdx-all">All</button>' +
    '<button type="button" class="cdx-bb" data-act="cdx-bulk" data-id="teacher"' + (nSel ? "" : " disabled") + '>Teacher</button>' +
    '<button type="button" class="cdx-bb" data-act="cdx-bulk" data-id="time"' + (nSel ? "" : " disabled") + '>Time</button>' +
    '<button type="button" class="cdx-bb" data-act="cdx-bulk" data-id="pause"' + (nSel ? "" : " disabled") + '>Pause</button>' +
    '<button type="button" class="cdx-bb" data-act="cdx-bulk" data-id="active"' + (nSel ? "" : " disabled") + '>Make active</button>' +
    '<button type="button" class="cdx-bb bad" data-act="cdx-bulk" data-id="inactive"' + (nSel ? "" : " disabled") + '>Make inactive</button></div>';
  return '<div class="ax-scroll pad' + (CDX.selOn ? " cdx-selon" : "") + '" id="axScroll">' + h + '</div>';
};
Object.assign(Actions, {
  "cdx-row": (planId) => {
    if (CDX.pressed === planId) { CDX.pressed = ""; return; }    /* the long-press already picked it */
    if (CDX.selOn) { CDX.sel[planId] = !CDX.sel[planId]; render(); return; }
    ADM_DOPEN = ADM_DOPEN === planId ? "" : planId; render();
  },
  "cdx-seltog": () => { CDX.selOn = !CDX.selOn; CDX.sel = {}; render(); },
  "cdx-show": (k) => { CDX.show = k; cdxKeep(); render(); },
  "cdx-dir": () => { CDX.dir = -CDX.dir; cdxKeep(); render(); },
  "cdx-all": () => { const R = cdxRows(), ids = R.main.concat(R.rest).map(p => p.id), every = ids.every(id => CDX.sel[id]);
    ids.forEach(id => { CDX.sel[id] = !every; }); render(); },
  "cdx-profile": (planId) => { ADM_SETUP = ""; admProfile(planId); },
  "cdx-edit": (planId) => cdxEdit(planId),
  "cdx-menu": (planId, el) => cdxMenu(planId, el),
  "cdx-bulk": (k) => cdxBulk(k),
  /* on the sheet and Today a tap asks first */
  "att-row": (planId, el) => cdxMenu(planId, el)
});
document.addEventListener("change", function(e){
  const s = e.target && e.target.closest && e.target.closest("[data-cdx=sort]"); if (!s) return;
  CDX.sort = s.value; cdxKeep(); render();
});

/* the bar lives on the page itself, so no scrolling box can hide it */
(function(){
  const r = render;
  render = function(){
    CDX.bar = "";
    const out = r.apply(this, arguments);
    const tabOn = typeof attTab === "function" && attTab() === "days" && document.getElementById("axScroll");
    let el = document.getElementById("cdxBulk");
    if (!tabOn || !CDX.bar) { if (el) el.remove(); if (!tabOn) { CDX.selOn = false; CDX.sel = {}; } return out; }
    const keep = !!el;
    if (el) el.remove();
    document.body.insertAdjacentHTML("beforeend", CDX.bar);
    if (keep) document.getElementById("cdxBulk").classList.add("still");
    return out;
  };
})();

/* ---- long-press: pick several ---- */
(function(){
  let t = 0, x0 = 0, y0 = 0, id = "";
  const stop = () => { clearTimeout(t); t = 0; };
  document.addEventListener("pointerdown", function(e){
    const b = e.target.closest && e.target.closest('.cdx [data-act="cdx-row"]'); if (!b || e.button > 0) return;
    id = b.dataset.id; x0 = e.clientX; y0 = e.clientY; stop(); CDX.pressed = "";
    b.classList.add("pressing");
    t = setTimeout(function(){
      t = 0; b.classList.remove("pressing");
      CDX.pressed = id;
      if (!CDX.selOn) { CDX.selOn = true; CDX.sel = {}; ADM_DOPEN = ""; }
      CDX.sel[id] = true;
      if (navigator.vibrate) try { navigator.vibrate(18); } catch (er) {}
      render();
    }, 480);
  }, { passive: true });
  document.addEventListener("pointermove", function(e){ if (t && (Math.abs(e.clientX - x0) > 9 || Math.abs(e.clientY - y0) > 9)) { stop(); document.querySelectorAll(".cd-h.pressing").forEach(x => x.classList.remove("pressing")); } }, { passive: true });
  ["pointerup", "pointercancel"].forEach(n => document.addEventListener(n, function(){ stop(); document.querySelectorAll(".cd-h.pressing").forEach(x => x.classList.remove("pressing")); }, { passive: true }));
  document.addEventListener("contextmenu", function(e){ if (e.target.closest && e.target.closest(".cdx .cd-h")) e.preventDefault(); });
})();

/* ---- with the picked classes ---- */
function cdxPicked(){ return Object.keys(CDX.sel).filter(k => CDX.sel[k]).map(id => DataService.getPlan(id)).filter(Boolean); }
function cdxDone(n, what, skipped){
  toast(n + " class" + (n === 1 ? "" : "es") + " " + what + (skipped ? " · " + skipped + " left as they were" : ""), "ok", 4500);
  CDX.sel = {}; CDX.selOn = false; render();
}
function cdxBulk(k){
  const list = cdxPicked(); if (!list.length) return;
  const names = '<div class="cdx-who">' + list.slice(0, 8).map(p => '<span>' + esc(cdxName(p)) + '</span>').join("") + (list.length > 8 ? '<span>+' + (list.length - 8) + '</span>' : "") + '</div>';
  const run = list.filter(p => admPlanState(p).k !== "stopped");
  if (k === "inactive") return openModal({ title: "Make inactive · " + list.length, wide: true, submitText: "Make inactive", danger: true,
    body: names + '<div class="form-grid">' + field("Last class day", '<input class="input" type="date" name="end" value="' + esc(today()) + '">' +
      admDateChips("end", "", [["Today", today()], ["Yesterday", admAddDays(today(), -1)]])) + field("Reason", '<input class="input" name="reason" placeholder="optional">') + '</div>',
    onSubmit: function(d){ let n = 0, s = 0; const end = d.end || today();
      list.forEach(p => { const cur = DataService.getPlan(p.id); if (admPlanState(cur).k === "stopped" || (cur.startDate && end < cur.startDate)) { s++; return; } cdxInactive(cur, end, d.reason); n++; });
      cdxDone(n, "inactive after " + fmtDate(end), s); } });
  if (k === "active") { let n = 0, s = 0; list.forEach(p => { const cur = DataService.getPlan(p.id); const ps = admPlanState(cur).k; if (ps !== "stopped" && ps !== "stopping") { s++; return; } cdxActive(cur); n++; }); return cdxDone(n, "active again", s); }
  if (k === "pause") return openModal({ title: "Pause · " + run.length, wide: true, submitText: "Pause",
    body: names + '<div class="form-grid">' + field("No class from", '<input class="input" type="date" name="from" value="' + esc(today()) + '">' +
      admDateChips("from", "", [["Today", today()], ["Tomorrow", admAddDays(today(), 1)]])) +
      field("Classes restart on", '<input class="input" type="date" name="restart" value="">' + admDateChips("restart", "from", [["1 week", "+7"], ["2 weeks", "+14"], ["1 month", "+30"], ["Not decided", ""]])) +
      '<div class="field span2"><label>Reason</label><input class="input" name="reason" placeholder="e.g. exams, Ramadan, holidays"></div></div>',
    onSubmit: function(d){
      const from = d.from || today(), restart = d.restart || "", until = restart ? admAddDays(restart, -1) : "", P = admPP();
      if (restart && restart <= from) { toast("Restart must be after the first paused day", "bad"); return false; }
      let n = 0, s = 0;
      run.forEach(p => { const cur = DataService.getPlan(p.id);
        if ((cur.startDate && from < cur.startDate) || (cur.endDate && from > cur.endDate) || P.overlaps(cur, from, until)) { s++; return; }
        const pz = { from: from, until: until, reason: String(d.reason || "").trim(), by: (window.ATT_ACTOR || {}).name || "Admin", at: new Date().toISOString() };
        const next = Object.assign({}, cur, { pauses: P.list(cur).concat([pz]) });
        admStamp(next, "paused class", { pause: ["", P.label(pz)] }); DataService.savePlan(next); admTell("plan-paused", { planId: cur.id, from: from, until: until }); n++; });
      cdxDone(n, "paused from " + fmtDate(from), s + (list.length - run.length)); } });
  if (k === "teacher") return openModal({ title: "Change teacher · " + run.length, wide: true, submitText: "Change teacher",
    body: names + '<div class="form-grid">' + pickBox("New teacher", "teacherId", "", pickTeachers(), "Type a teacher name or ID") +
      field("From", '<input class="input" type="date" name="from" value="' + esc(today()) + '">') +
      '<div class="field span2"><div class="note" style="margin:0">Marks from this day move to the new teacher; earlier marks stay with the old one.</div></div></div>',
    onSubmit: function(d){
      if (!DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list", "bad"); return false; }
      const from = d.from || today(); let n = 0, s = 0;
      run.forEach(p => { const cur = DataService.getPlan(p.id); if (cur.teacherId === d.teacherId) { s++; return; }
        const next = Object.assign({}, cur, { teacherId: d.teacherId, teacherChangedFrom: from });
        const ch = admDiff(cur, next, ["teacherId"]); ch.teacherId.push("from " + from);
        DB.classes.forEach(c => { if (c.planId === cur.id && c.date >= from && c.teacherId !== d.teacherId) c.teacherId = d.teacherId; });
        admStamp(next, "changed teacher", ch); DataService.savePlan(next); n++; });
      cdxDone(n, "moved to " + (DataService.getTeacher(d.teacherId) || {}).name, s + (list.length - run.length)); } });
  if (k === "time") return openModal({ title: "Change time · " + run.length, wide: true, submitText: "Save time",
    body: names + '<div class="form-grid">' + field("Class time (IST)", '<input class="input" type="time" name="time" value="">') +
      field("Class minutes", '<input class="input" type="number" min="0" name="duration" value="" placeholder="leave as it is">') + '</div>',
    onSubmit: function(d){
      if (!d.time && !d.duration) { toast("Choose a time or minutes", "bad"); return false; }
      let n = 0;
      run.forEach(p => { const patch = {}; if (d.time) patch.time = d.time; if (d.duration) patch.duration = +d.duration || 0; if (attPlanSave(DataService.getPlan(p.id), patch, "changed class time")) n++; });
      cdxDone(n, "changed", run.length - n + (list.length - run.length)); } });
}

/* ---- EDIT EVERYTHING: the class and the student in one window ---- */
async function cdxEdit(planId){
  await admFresh(["students", "plans", "classes"]);
  const pl = DataService.getPlan(planId); if (!pl) return;
  const s = DataService.getStudent(pl.studentId) || { id: pl.studentId };
  const ro = admPlanState(pl).k === "stopped";
  const stForm = admStudentForm(s).replace('<div class="field span2"><label>Notes</label>',
    field("Email", '<input class="input" type="email" name="email" inputmode="email" value="' + esc(s.email || "") + '" placeholder="name@example.com">') +
    '<div class="field span2"><label>Address</label><input class="input" name="address" value="' + esc(s.address || "") + '"></div>' +
    '<div class="field span2"><label>Notes</label>');
  openModal({ title: "Edit · " + (s.name || pl.studentId), wide: true, submitText: "Save all",
    body: '<div class="cdx-ed">' +
      '<div class="cdx-tabs" role="tablist"><button type="button" class="on" data-cdxt="c" role="tab">Class</button><button type="button" data-cdxt="s" role="tab">Student</button><i aria-hidden="true"></i></div>' +
      '<section class="cdx-pn on" data-pn="c">' + (ro ? '<div class="note">This class is inactive. Make it active to change it.</div>' : "") +
      '<div class="form-grid">' +
        pickBox("Teacher", "teacherId", pl.teacherId || "", pickTeachers(), "Type a teacher name or ID") +
        field("New teacher from", '<input class="input" type="date" name="from" value="' + esc(today()) + '">') +
        field("Course", sel("course", courseOpts(pl.course || "", "Select course"))) +
        field("Start date", '<input class="input" type="date" name="startDate" value="' + esc(pl.startDate || "") + '">') +
        '<div class="field span2"><label>Class days</label><div>' + dayBoxes(pl.days) + '</div></div>' +
        field("Class time (IST)", '<input class="input" type="time" name="time" value="' + esc(pl.time || "") + '">') +
        field("Class minutes", '<input class="input" type="number" min="0" name="duration" value="' + esc(pl.duration || 45) + '">') +
      '</div><p class="cdx-ft">' + esc(pl.id) + ' · ' + esc(admPlanState(pl).label) + ' · changed days move the class sheet\'s calendar from today</p></section>' +
      '<section class="cdx-pn" data-pn="s">' + stForm + '<p class="cdx-ft">' + esc(s.id || "") + ' · the office sees every change</p></section></div>',
    onSubmit: function(d, form){
      const curP = DataService.getPlan(planId), curS = DataService.getStudent(pl.studentId);
      let changed = 0, moved = 0;
      /* the class */
      if (!ro) {
        if (!DataService.getTeacher(d.teacherId)) { toast("Pick the teacher from the list", "bad"); cdxTab(form, "c"); return false; }
        const nextP = Object.assign({}, curP, { teacherId: d.teacherId, course: d.course || curP.course, time: d.time || "", days: readDays(form),
          duration: +d.duration || 0, startDate: d.startDate || curP.startDate });
        nextP.perWeek = nextP.days.length;
        if (nextP.startDate && curP.endDate && nextP.startDate > curP.endDate) { toast("The start is after the last class day", "bad"); cdxTab(form, "c"); return false; }
        const ch = admDiff(curP, nextP, ["teacherId", "course", "time", "days", "duration", "startDate"]);
        if (Object.keys(ch).length) {
          if (ch.teacherId) { const from = d.from || today(); ch.teacherId.push("from " + from); nextP.teacherChangedFrom = from;
            DB.classes.forEach(c => { if (c.planId === planId && c.date >= from && c.teacherId !== d.teacherId) { c.teacherId = d.teacherId; moved++; } }); }
          admStamp(nextP, ch.teacherId ? "changed teacher" : "changed class details", ch);
          DataService.savePlan(nextP); changed++;
        }
      }
      /* the student */
      if (curS) {
        joinCC(d);
        const email = String(d.email || "").trim();
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast("The email does not look right", "bad"); cdxTab(form, "s"); return false; }
        const nextS = Object.assign({}, curS, { name: String(d.name || "").trim() || curS.name, guardian: String(d.guardian || "").trim(),
          whatsapp: d.whatsapp || "", whatsappCC: d.whatsappCC || "", phone: String(d.phone || "").trim(), dob: d.dob || "", gender: d.gender || "",
          email: email, address: String(d.address || "").trim(), notes: String(d.notes || "").trim() });
        const left = ["email", "gender", "guardian", "address", "dob"].filter(k => !String(nextS[k] || "").trim()).length;
        if (curS.detailsPending) nextS.detailsPending = left > 0;
        const chs = admDiff(curS, nextS, ["name", "guardian", "whatsapp", "phone", "dob", "gender", "email", "address", "notes"]);
        if (Object.keys(chs).length) { admStamp(nextS, "edited student", chs); DataService.saveStudent(nextS); changed++; }
      }
      if (!changed) { toast("Nothing changed", "warn"); return; }
      toast("Saved" + (moved ? " · " + moved + " mark" + (moved > 1 ? "s" : "") + " moved to the new teacher" : "") + " — the office sees what changed", "ok", 4000);
      render();
    } });
  const form = document.querySelector("#mScrim form") || document.querySelector("#mScrim");
  if (form && ro) form.querySelectorAll('[data-pn="c"] input, [data-pn="c"] select').forEach(x => { x.disabled = true; });
}
function cdxTab(root, k){
  const box = (root && root.closest ? root.closest("#mScrim") : null) || document;
  box.querySelectorAll("[data-cdxt]").forEach(b => b.classList.toggle("on", b.dataset.cdxt === k));
  box.querySelectorAll(".cdx-pn").forEach(p => p.classList.toggle("on", p.dataset.pn === k));
  const tb = box.querySelector(".cdx-tabs"); if (tb) tb.style.setProperty("--x", k === "s" ? 1 : 0);
}
document.addEventListener("click", function(e){ const b = e.target.closest && e.target.closest("[data-cdxt]"); if (b) { e.preventDefault(); cdxTab(b, b.dataset.cdxt); } });

/* ---- the menu (a tap on a student never opens a window straight away) ---- */
function cdxMenuClose(){ const m = document.getElementById("cdxMenu"); if (m) { m.classList.remove("show"); setTimeout(() => { if (!m.classList.contains("show")) m.remove(); }, 220); } }
function cdxMenu(planId, el){
  cdxMenuClose();
  const pl = DataService.getPlan(planId); if (!pl) return;
  const st = cdxStu(pl), ps = admPlanState(pl), wa = st.whatsapp || st.phone;
  const um = (Logic.unmarked(State.month).lines.find(l => l.planId === planId) || { dates: [] }).dates.length;
  const it = (act, label, sub, cls) => '<button type="button" class="cdx-mi' + (cls ? " " + cls : "") + '" data-mact="' + act + '"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : "") + '</button>';
  const m = document.createElement("div");
  m.id = "cdxMenu"; m.className = "cdx-menu"; m.dataset.id = planId;
  m.innerHTML = '<div class="cdx-mbox" role="menu" aria-label="' + esc(st.name || pl.studentId) + '"><span class="cdx-grab" aria-hidden="true"></span>' +
    '<div class="cdx-mh"><span class="cd-av">' + esc(admIni(st.name)) + '</span><span><b>' + esc(st.name || pl.studentId) + '</b><small>' + esc([pl.studentId, pl.course, ps.label].filter(Boolean).join(" · ")) + '</small></span></div>' +
    '<div class="cdx-mg">' +
      it("profile", "Profile", "this month, class, student") +
      it("edit", "Edit everything", "class and student details") +
      it("days", "Class days & time", "in the Class days tab") +
      (um ? it("fill", "Mark " + um + " unmarked ✓ Present", "this month") : "") +
      (wa ? it("wa", "WhatsApp", st.whatsapp ? "+" + (st.whatsappCC || "91") + " " + st.whatsapp : st.phone) : "") +
      (OWN_IN_SHEET ? it("cal", "Calendar", "the class sheet's calendar") : "") +
      (ps.k === "paused" || ps.k === "pausing" ? it("restart", "Restart classes", "or change the pause") : ps.k === "stopped" || ps.k === "stopping" ? "" : it("pause", "Pause", "no classes for a while")) +
      (ps.k === "stopped" || ps.k === "stopping" ? it("active", "Make active", "") : it("inactive", "Make inactive", "left / finished", "bad")) +
      it("report", "Attendance report", "PDF") +
    '</div></div>';
  document.body.appendChild(m);
  const box = m.querySelector(".cdx-mbox");
  if (window.innerWidth >= 700 && el && el.getBoundingClientRect) {
    const r = el.getBoundingClientRect(), w = 300, hgt = Math.min(box.offsetHeight || 420, window.innerHeight - 24);
    let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left)), y = r.bottom + 6;
    if (y + hgt > window.innerHeight - 12) y = Math.max(12, r.top - hgt - 6);
    m.classList.add("pop"); box.style.left = x + "px"; box.style.top = y + "px";
  }
  requestAnimationFrame(() => m.classList.add("show"));
  const first = m.querySelector(".cdx-mi"); if (first) try { first.focus({ preventScroll: true }); } catch (e) {}
}
document.addEventListener("click", function(e){
  const m = document.getElementById("cdxMenu"); if (!m) return;
  const b = e.target.closest && e.target.closest("[data-mact]");
  if (!b) { if (!e.target.closest(".cdx-mbox")) cdxMenuClose(); return; }
  e.preventDefault(); e.stopPropagation();
  const id = m.dataset.id, a = b.dataset.mact, pl = DataService.getPlan(id), st = pl ? cdxStu(pl) : {};
  cdxMenuClose();
  if (a === "profile") { ADM_SETUP = ""; admProfile(id); }
  else if (a === "edit") cdxEdit(id);
  else if (a === "days") { State.iatt.tab = "days"; ADM_DOPEN = id; CDX.selOn = false; if (CDX.show !== "all") CDX.show = "all"; render();
    setTimeout(() => { const r = document.querySelector('.cdx [data-act="cdx-row"][data-id="' + CSS.escape(id) + '"]'); if (r) r.scrollIntoView({ block: "center", behavior: "smooth" }); }, 80); }
  else if (a === "fill") Actions["att-fill"](id);
  else if (a === "wa") window.open(Logic.waLink(st.whatsapp || st.phone, ""), "_blank", "noopener");
  else if (a === "cal") admTell("open-calendar", { planId: id, studentId: pl.studentId, course: pl.course });
  else if (a === "pause") Actions["adm-pause"](id);
  else if (a === "restart") Actions["adm-restart"](id);
  else if (a === "inactive") Actions["adm-stop-plan"](id);
  else if (a === "active") Actions["adm-unstop"](id);
  else if (a === "report") Actions["ax-rep-plan"](id);
}, true);
document.addEventListener("keydown", function(e){ if (e.key === "Escape") cdxMenuClose(); });
window.addEventListener("scroll", function(){ const m = document.getElementById("cdxMenu"); if (m && m.classList.contains("pop")) cdxMenuClose(); }, true);
