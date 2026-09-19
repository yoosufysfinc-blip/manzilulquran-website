"use strict";
/* Academic Service — ui.v2.js. v2: "Needs amount" status, override marker, hybrid fee basis. */
/* ==========================================================================
   UI KIT
   ========================================================================== */
function toast(msg, type, ms){
  const el = document.createElement("div");
  el.className = "toast" + (type ? " t-" + type : "");
  el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), ms || 3300);
}
/* subtle one-shot success animation — a small disc + expanding ring */
function celebrate(icon){
  try{
    const b = document.createElement("div");
    b.className = "mq-burst";
    b.innerHTML = '<span class="ring"></span><span class="disc">' + (icon || "✓") + '</span>';
    document.body.appendChild(b);
    if (navigator.vibrate) { try { navigator.vibrate(18); } catch(e){} }
    setTimeout(() => b.remove(), 760);
  }catch(e){}
}
/* combine a country-code select + number into one WhatsApp value on save */
function joinCC(d){
  if (d && d.whatsapp) {
    const cc = (d.whatsappCC || "").replace(/[^0-9]/g, "");
    let num = String(d.whatsapp).replace(/[^0-9]/g, "");
    if (cc && num && num.indexOf(cc) !== 0) num = cc + num;
    d.whatsapp = num;
  }
  if (d) delete d.whatsappCC;
  return d;
}
let modalSubmit = null;
function openModal(o){
  closeModal();
  $("#modalRoot").innerHTML =
    '<div class="modal-scrim" id="mScrim"><div class="modal' + (o.wide ? " wide" : "") + '" role="dialog" aria-modal="true">' +
      '<div class="modal-hd"><h3>' + esc(o.title) + '</h3><button class="x" data-act="modal-close">×</button></div>' +
      '<form id="mForm" novalidate><div class="modal-bd">' + o.body + '</div><div class="modal-ft">' +
        '<button type="button" class="btn" data-act="modal-close">' + esc(o.cancelText || "Cancel") + '</button>' +
        (o.hideSubmit ? "" : '<button type="submit" class="btn ' + (o.danger ? "btn-danger" : "btn-primary") + '">' +
          esc(o.submitText || "Save") + '</button>') +
      '</div></form></div></div>';
  modalSubmit = o.onSubmit || null;
  const form = $("#mForm");
  form.addEventListener("submit", function(e){
    e.preventDefault();
    if (!modalSubmit) { closeModal(); return; }
    const d = {};
    Array.from(form.elements).forEach(function(el){
      if (!el.name) return;
      d[el.name] = el.type === "checkbox" ? el.checked : el.value;
    });
    if (modalSubmit(d, form) !== false) closeModal();
  });
  $("#mScrim").addEventListener("mousedown", e => { if (e.target.id === "mScrim") closeModal(); });
  const first = form.querySelector("input:not([readonly]),select,textarea");
  if (first && !o.noFocus) setTimeout(() => first.focus(), 40);
}
function closeModal(){ $("#modalRoot").innerHTML = ""; modalSubmit = null; }
function confirmAction(o){
  openModal({ title: o.title || "Please confirm", danger: o.danger, submitText: o.submitText || "Yes, continue",
    body: '<div class="note">' + esc(o.note || "This changes saved records.") + '</div><p style="margin:0">' + esc(o.message) + '</p>',
    onSubmit: () => o.onConfirm() });
}

const FEE_BADGE = { "Paid":"b-ok","Partial":"b-warn","Overdue":"b-bad","Due Today":"b-warn","Upcoming":"b-info",
  "Waived":"b-idle","Nil":"b-idle","Pending":"b-bad","Needs amount":"b-warn" };
const GEN_BADGE = { "Active":"b-ok","Inactive":"b-idle","Suspended":"b-bad","Completed":"b-ok","Left":"b-idle",
  "Stopped":"b-idle","Upcoming":"b-acc","Transferred":"b-info","Present":"b-ok","Absent":"b-bad","Leave":"b-warn",
  "Excused":"b-info","Cancelled":"b-idle","Student Absent":"b-bad","Teacher Absent":"b-warn","Rescheduled":"b-info",
  "Cash":"b-ok","Bank":"b-info","UPI":"b-acc","Other":"b-idle","Student Payment":"b-ok","Other Income":"b-ok",
  "Expense":"b-bad","Teacher Payment":"b-bad","Refund":"b-warn","Transfer":"b-info","Teacher Advance":"b-warn",
  "Teacher Bonus":"b-acc" };
function badge(t, map){ return '<span class="badge ' + ((map || GEN_BADGE)[t] || "b-idle") + '">' + esc(t) + '</span>'; }
function feeBadge(s){ return badge(s, FEE_BADGE); }
function idchip(id){ return '<span class="idchip">' + esc(id) + '</span>'; }
function streamChip(src){
  return '<span class="badge ' + (src === "batch" ? "stream-b" : "stream-i") + '">' + (src === "batch" ? "Batch" : "Individual") + '</span>';
}

/* ---- THE ROW LIST: one line per record, details open in place ---- */
const UI = { open: {}, limit: {}, sort: {} };
function renderList(lid, rows, o){
  o = o || {};
  const sorts = o.sorts || [];
  if (sorts.length) {
    const key = UI.sort[lid] || sorts[0].key;
    const s = sorts.find(x => x.key === key) || sorts[0];
    rows = rows.slice().sort(function(a, b){
      const A = s.val(a), B = s.val(b);
      const r = (typeof A === "number" && typeof B === "number") ? A - B : String(A).localeCompare(String(B));
      return s.desc ? -r : r;
    });
  }
  if (!rows.length) {
    return '<div class="empty"><h4>' + esc(o.emptyTitle || "Nothing here yet") + '</h4>' +
      '<p>' + esc(o.emptyText || "") + '</p>' + (o.emptyAction || "") + '</div>';
  }
  const limit = UI.limit[lid] || o.pageSize || 25;
  const shown = rows.slice(0, limit);
  const openKey = UI.open[lid];

  const head = o.head ? '<div class="lhead"><span style="width:14px"></span><span class="lmain">' + esc(o.head[0]) +
    '</span><span>' + esc(o.head[1] || "") + '</span></div>' : "";

  const body = shown.map(function(r){
    const k = String(o.key(r));
    const isOpen = openKey === lid + "::" + k;
    return '<button class="lrow ' + (isOpen ? "is-open " : "") + (o.rowClass ? o.rowClass(r) : "") + '" type="button" ' +
        'data-act="lrow" data-lid="' + lid + '" data-k="' + esc(k) + '" aria-expanded="' + isOpen + '">' +
        '<span class="lchev">›</span>' +
        '<span class="lmain"><span class="lt">' + o.title(r) + '</span>' +
          '<span class="ls">' + (o.sub ? o.sub(r) : "") + '</span></span>' +
        '<span class="lright">' +
          (o.amount ? '<span class="lamt">' + o.amount(r) + '</span>' : "") +
          (o.badge ? o.badge(r) : "") +
        '</span></button>' +
      (isOpen ? '<div class="ldet">' + o.detail(r) + '</div>' : "");
  }).join("");

  const more = rows.length > limit
    ? '<button class="more no-print" data-act="lmore" data-lid="' + lid + '">Show ' +
      Math.min(25, rows.length - limit) + ' more · ' + num(rows.length - limit) + ' left</button>' : "";
  const foot = o.foot ? '<div class="lfoot">' + o.foot + '</div>' : "";
  const sortBar = sorts.length > 1 ? '<div class="lfoot no-print"><span>Sort by</span>' +
    '<select class="select" style="max-width:220px;min-height:34px" data-act="lsort" data-lid="' + lid + '">' +
    sorts.map(s => '<option value="' + s.key + '"' + ((UI.sort[lid] || sorts[0].key) === s.key ? " selected" : "") + '>' +
      esc(s.label) + '</option>').join("") + '</select>' +
    '<span class="push" style="margin-left:auto">' + num(rows.length) + ' records</span></div>' : "";

  return '<div class="list">' + head + body + more + '</div>' + foot + sortBar;
}
function dl(pairs){
  return '<dl class="dl">' + pairs.filter(Boolean).map(p =>
    '<div><dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd></div>').join("") + '</dl>';
}
function acts(html){ return '<div class="btn-row no-print" style="margin-top:4px">' + html + '</div>'; }

/* ---- charts ---- */
function shortMoney(v){
  if (Math.abs(v) >= 100000) return (v / 100000).toFixed(1) + "L";
  if (Math.abs(v) >= 1000) return Math.round(v / 1000) + "k";
  return String(Math.round(v));
}
function chartGrouped(items, series){
  const W = 440, H = 180, padL = 46, padB = 24, padT = 10;
  const max = Math.max(1, ...items.map(it => Math.max(...series.map(s => +it[s.key] || 0))));
  const bw = (W - padL - 8) / Math.max(items.length, 1);
  let bars = "", labels = "", grid = "";
  items.forEach(function(it, i){
    const x0 = padL + i * bw;
    series.forEach(function(s, j){
      const v = +it[s.key] || 0;
      const h = (H - padT - padB) * (Math.max(0, v) / max);
      const w = (bw - 12) / series.length;
      bars += '<rect x="' + (x0 + 6 + j * w) + '" y="' + (H - padB - h) + '" width="' + (w - 3) + '" height="' +
        Math.max(h, 1) + '" rx="2.5" fill="' + s.color + '"><title>' + esc(it.label + " " + s.label + ": " + money(v)) + '</title></rect>';
    });
    labels += '<text class="lbl" x="' + (x0 + bw / 2) + '" y="' + (H - 7) + '" text-anchor="middle">' + esc(it.label) + '</text>';
  });
  for (let g = 0; g <= 2; g++) {
    const y = padT + (H - padT - padB) * (g / 2);
    grid += '<line x1="' + padL + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#E4EBE8"/>' +
      '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + shortMoney(max * (1 - g / 2)) + '</text>';
  }
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' + grid + bars + labels + '</svg>';
}
function chartDonut(parts, top, sub){
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  const R = 62, r = 40, cx = 80, cy = 80;
  let a0 = -Math.PI / 2, paths = "";
  if (total <= 0) paths = '<circle cx="80" cy="80" r="51" fill="none" stroke="#E4EBE8" stroke-width="22"/>';
  else parts.forEach(function(p){
    if (p.value <= 0) return;
    const a1 = a0 + (p.value / total) * Math.PI * 2, big = (a1 - a0) > Math.PI ? 1 : 0;
    const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
    const x2 = cx + r * Math.cos(a1), y2 = cy + r * Math.sin(a1), x3 = cx + r * Math.cos(a0), y3 = cy + r * Math.sin(a0);
    paths += '<path d="M' + x0 + ' ' + y0 + ' A' + R + ' ' + R + ' 0 ' + big + ' 1 ' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 +
      ' A' + r + ' ' + r + ' 0 ' + big + ' 0 ' + x3 + ' ' + y3 + ' Z" fill="' + p.color + '"><title>' +
      esc(p.label + ": " + money(p.value)) + '</title></path>';
    a0 = a1;
  });
  return '<svg class="chart" viewBox="0 0 160 160" style="max-height:180px">' + paths +
    '<text x="80" y="78" text-anchor="middle" style="font-size:19px;fill:var(--ink);font-weight:700">' + esc(top) + '</text>' +
    '<text x="80" y="94" text-anchor="middle">' + esc(sub || "") + '</text></svg>';
}
function chartHBars(items){
  if (!items.length) return '<div class="empty" style="padding:20px">Nothing to show yet.</div>';
  const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
  return '<div style="display:flex;flex-direction:column;gap:8px;padding:2px 0 8px">' + items.map(it =>
    '<div><div class="spread" style="font-size:12.3px;margin-bottom:3px"><span style="font-weight:600">' + esc(it.label) +
    '</span><span class="amt" style="color:var(--muted)">' + esc(it.text || money(it.value)) + '</span></div>' +
    '<div class="rail" style="height:8px"><div style="width:' + (Math.abs(it.value) / max * 100).toFixed(1) +
    '%;background:' + (it.color || "var(--pri)") + '"></div></div></div>').join("") + '</div>';
}
function legend(items){
  return '<div class="legend">' + items.map(i => '<span><i style="background:' + i.color + '"></i>' + esc(i.label) + '</span>').join("") + '</div>';
}
const ACCT_COLOR = { Cash: "#0C7A4E", Bank: "#37648F", UPI: "#C08A2E" };
function accountRail(bal){
  const accts = DataService.getAccounts();
  const tot = Math.max(accts.reduce((s, a) => s + Math.max(0, bal[a.id] || 0), 0), 1);
  return '<div class="rail">' + accts.map(a => '<div style="width:' + (Math.max(0, bal[a.id] || 0) / tot * 100).toFixed(2) +
    '%;background:' + (ACCT_COLOR[a.id] || "#7A8B86") + '"><title>' + esc(a.name + ": " + money(bal[a.id] || 0)) + '</title></div>').join("") + '</div>';
}
function accountCards(bal){
  return '<div class="acct-grid">' + DataService.getAccounts().map(a =>
    '<div class="acct"><div class="an"><i style="background:' + (ACCT_COLOR[a.id] || "#7A8B86") + '"></i>' + esc(a.name) +
    '</div><div class="av">' + money(bal[a.id] || 0) + '</div><div class="ad">Opening ' + money(a.opening) + '</div></div>').join("") +
    '<div class="acct total"><div class="an">Total balance</div><div class="av">' + money(bal.total) + '</div>' +
    '<div class="ad">All accounts</div></div></div>';
}
/* ---- CALENDAR: a month grid of what actually happened, per student ---- */
const CAL_DOT = { "Present":"d-P", "Absent":"d-A", "Leave":"d-L", "Excused":"d-E", "Completed":"d-C",
  "Cancelled":"d-X", "Student Absent":"d-A", "Teacher Absent":"d-L", "Rescheduled":"d-R" };
function monthCalendar(month, byDate){
  const n = daysInMonth(month), first = parseYMD(monthStart(month)).getDay(), t = today();
  let cells = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => '<div class="dow">' + d + '</div>').join("");
  for (let i = 0; i < first; i++) cells += '<div class="cd blank"></div>';
  for (let i = 1; i <= n; i++) {
    const ds = month + "-" + pad2(i), info = byDate[ds] || {}, hol = Logic.isHoliday(ds);
    const dots = info.dots || [];
    const title = [fmtDate(ds), hol ? "Holiday: " + hol.name : null, info.title].filter(Boolean).join(" · ");
    cells += '<div class="cd ' + (hol ? "is-hol " : "") + (ds === t ? "is-today" : "") + '" title="' + esc(title) + '">' +
      '<span class="dn">' + i + '</span><span class="dots">' +
      (hol && !dots.length ? '<i class="d-H"></i>' : "") +
      dots.map(c => '<i class="' + c + '"></i>').join("") + '</span></div>';
  }
  return '<div class="cal">' + cells + '</div>';
}
function studentCalendarBlock(studentId, month, withNav){
  const att = DataService.getAttendance({ studentId: studentId, month: month });
  const cls = DataService.getClasses({ studentId: studentId, month: month });
  const byDate = {};
  const push = function(ds, dot, label){
    byDate[ds] = byDate[ds] || { dots: [], title: "" };
    byDate[ds].dots.push(dot);
    byDate[ds].title = (byDate[ds].title ? byDate[ds].title + " · " : "") + label;
  };
  att.forEach(a => push(a.date, CAL_DOT[a.status] || "d-H", "Batch: " + a.status + (a.remarks ? " (" + a.remarks + ")" : "")));
  cls.forEach(c => push(c.date, CAL_DOT[c.status] || "d-H", "Individual: " + c.status));
  const A = Logic.attStats(att), C = Logic.classStats(cls);
  const hols = Logic.holidaysIn(month);
  return '' +
    (withNav ? '<div class="spread" style="margin-bottom:10px"><div class="cal-nav no-print">' +
      '<button class="btn btn-sm" data-act="cal-prev">‹</button><b>' + esc(monthLabel(month)) + '</b>' +
      '<button class="btn btn-sm" data-act="cal-next">›</button></div>' +
      '<span class="hint">' + (A.total ? A.pct + "% batch attendance · " : "") +
      C.completed + ' individual classes</span></div>' : "") +
    monthCalendar(month, byDate) +
    '<div class="cal-legend">' +
      [["d-P","Present"],["d-A","Absent"],["d-L","Leave / teacher absent"],["d-E","Excused"],
       ["d-C","Individual class held"],["d-X","Cancelled"],["d-R","Rescheduled"],["d-H","Holiday"]]
      .map(x => '<span><i class="' + x[0] + '"></i>' + x[1] + '</span>').join("") + '</div>' +
    '<div class="sub-hd">Report for ' + esc(monthLabel(month)) + '</div>' +
    (A.total ? '<div class="minirow"><span>Batch classes marked</span><b>' + A.total + '</b></div>' +
      '<div class="minirow"><span>Present</span><b class="in">' + A.Present + '</b></div>' +
      '<div class="minirow"><span>Absent</span><b class="out">' + A.Absent + '</b></div>' +
      '<div class="minirow"><span>Leave / excused</span><b>' + (A.Leave + A.Excused) + '</b></div>' +
      '<div class="minirow"><span>Attendance</span><b>' + A.pct + '%</b></div>' : "") +
    (C.total ? '<div class="minirow"><span>Individual classes logged</span><b>' + C.total + '</b></div>' +
      '<div class="minirow"><span>Completed</span><b class="in">' + C.completed + '</b></div>' +
      '<div class="minirow"><span>Student absent / cancelled</span><b class="out">' + (C.studentAbsent + C.cancelled) + '</b></div>' +
      '<div class="minirow"><span>Taught hours</span><b>' + round2(C.minutes / 60) + '</b></div>' : "") +
    (!A.total && !C.total ? '<div class="minirow"><span>Nothing recorded this month</span><b>—</b></div>' : "") +
    '<div class="minirow"><span>Holidays in the month</span><b>' + hols.length + '</b></div>' +
    (hols.length ? '<p class="hint" style="margin:6px 0 0">' + hols.map(h => esc(fmtDate(h.date) + " " + h.name)).join(" · ") + '</p>' : "");
}
/* ---- infographic pieces for the dashboard ---- */
function ring(pct, color, top, sub, size){
  size = size || 132;
  const R = 54, C = 2 * Math.PI * R, v = Math.max(0, Math.min(100, pct));
  return '<svg class="chart" viewBox="0 0 132 132" width="' + size + '" height="' + size + '" style="flex:none">' +
    '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="#E6E4D6" stroke-width="15"/>' +
    '<circle cx="66" cy="66" r="' + R + '" fill="none" stroke="' + color + '" stroke-width="15" stroke-linecap="round" ' +
      'stroke-dasharray="' + (C * v / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 66 66)"/>' +
    '<text x="66" y="68" text-anchor="middle" style="font-family:var(--f-d);font-size:26px;fill:#14201B">' + esc(top) + '</text>' +
    '<text x="66" y="86" text-anchor="middle" style="font-size:9px;letter-spacing:1.4px;fill:#8B9990">' + esc(sub || "") + '</text></svg>';
}
function barList(items){
  const max = Math.max(1, ...items.map(i => Math.abs(i.value)));
  return '<div class="bars">' + items.map(i =>
    '<div><div class="bar-l"><span style="font-weight:600">' + esc(i.label) + '</span>' +
    '<span class="amt" style="color:var(--muted)">' + esc(i.text !== undefined ? i.text : money(i.value)) + '</span></div>' +
    '<div class="bar-t"><i style="width:' + (Math.abs(i.value) / max * 100).toFixed(1) + '%;background:' +
    (i.color || "var(--pri)") + '"></i></div></div>').join("") + '</div>';
}
function heatStrip(days){
  const max = Math.max(1, ...days.map(d => d.v));
  return '<div class="heat">' + days.map(function(d){
    const t = d.v / max;
    const bg = d.v <= 0 ? "#E6E4D6"
      : t > .66 ? "#2F7D4F" : t > .33 ? "#6BA377" : "#B9D6BE";
    return '<i style="background:' + bg + '" title="' + esc(fmtDate(d.d) + ": " + money(d.v)) + '"></i>';
  }).join("") + '</div>';
}
/* ---- small, dense visuals: a sparkline, a split bar and a detail row ---- */
function spark(values, color, fill){
  const W = 104, H = 26, max = Math.max(1, ...values.map(v => Math.abs(v))), n = values.length;
  const pts = values.map(function(v, i){
    return [(i / Math.max(n - 1, 1)) * W, H - 2 - (Math.max(0, v) / max) * (H - 5)];
  });
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = line + " L" + W + " " + H + " L0 " + H + " Z";
  const last = pts[pts.length - 1] || [0, H];
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" style="flex:none">' +
    (fill !== false ? '<path d="' + area + '" fill="' + color + '" opacity=".13"/>' : "") +
    '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="2.4" fill="' + color + '"/></svg>';
}
function splitBar(segs, opts){
  opts = opts || {};
  const total = Math.max(segs.reduce((a, s) => a + Math.max(0, s.value), 0), 1);
  return '<div class="rail" style="height:' + (opts.h || 14) + 'px">' + segs.map(s =>
    '<div style="width:' + (Math.max(0, s.value) / total * 100).toFixed(2) + '%;background:' + s.color + '">' +
    '<title>' + esc(s.label + ": " + (s.text !== undefined ? s.text : money(s.value))) + '</title></div>').join("") + '</div>' +
    '<div class="seglegend">' + segs.filter(s => s.value > 0 || opts.showAll).map(s =>
      '<span><i style="background:' + s.color + '"></i>' + esc(s.label) +
      '<b>' + esc(s.text !== undefined ? s.text : money(s.value)) + '</b></span>').join("") + '</div>';
}
function detailRow(r){
  return '<div class="drow">' +
    '<div class="dl1"><span class="dt">' + r.title + '</span>' +
      (r.sub ? '<span class="ds">' + r.sub + '</span>' : "") + '</div>' +
    (r.spark ? r.spark : "") +
    '<div class="dv">' + r.value + (r.meta ? '<small>' + r.meta + '</small>' : "") + '</div>' +
    (r.pct !== undefined ? '<div class="dbar"><i style="width:' + Math.max(0, Math.min(100, r.pct)) +
      '%;background:' + (r.color || "var(--pri)") + '"></i></div>' : "") +
  '</div>';
}
function kpi(l, v, m, cls){
  return '<div class="kpi ' + (cls || "") + '"><div class="kpi-l">' + esc(l) + '</div><div class="kpi-v">' + v + '</div>' +
    (m ? '<div class="kpi-m">' + m + '</div>' : "") + '</div>';
}

/* ==========================================================================
   SAMPLE DATA — shared people, both streams, one set of books
   ========================================================================== */
function rng(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function defaultSettings(){
  return {
    academyName: "ManzilulQuran", academyTagline: "E-learning Academy", logo: "",
    website: "manzilulquran.in", email: "info@manzilulquran.in",
    contactPhone: "7025070415", whatsappNumber: "9995360416",
    currency: "₹", countryCode: "91", defaultDueDay: 5, defaultFeeMethod: "perClass",
    billingMode: "prepaid", advanceDays: 5,
    supabaseUrl: "https://uuwboujrotmmpofjynhz.supabase.co", supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1d2JvdWpyb3RtbXBvZmp5bmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0Mjk4OTQsImV4cCI6MjEwMjAwNTg5NH0.z0_G7oKlmGILPr8zzOOQEgtUDrT8rNQLjrV9GQQdA9U", supabaseOn: true,
    teacherLinkBase: "https://manzilulquran.in/attendance/", apiUrl: "https://script.google.com/macros/s/AKfycbzuGmaPn2PQGyS_64RQFF8rY2ZRhb37HTFFjRuvfVEsGn8DB8O8AZsnEbvPdrOSCMuo/exec", syncKey: "mq-7f3a91c4e85b426d9a0c", syncOn: true, syncEvery: 3,
    courses: ["Hifz", "Tarteel Base", "Tarteel Advanced", "Madrasa Batch", "Madrasa Individual", "Tajweed", "Arabic"],
    levels: ["Beginner", "Level 1", "Level 2", "Level 3", "Advanced"],
    paymentMethods: ["Cash", "UPI", "Bank", "Other"],
    incomeCategories: ["Batch Class Fee", "Individual Class Fee", "Admission Fee", "Course Fee",
                       "Recorded Course", "Study Material", "Other Income"],
    expenseCategories: ["Teacher Payment", "Teacher Advance", "Teacher Bonus", "Internet", "Electricity", "Software",
                        "Hosting", "Domain", "Advertising", "Marketing", "Study Materials", "Printing", "Equipment",
                        "Office Expense", "Bank Charges", "Refund", "Miscellaneous"],
    studentStatuses: ["Active", "Inactive", "Suspended", "Completed", "Left"],
    batchStatuses: ["Active", "Inactive", "Completed", "Upcoming"],
    admissionFeeDefault: 0,
    courseFormats: [
      { id: "F1", name: "Tarteel — weekly 3 day", course: "Tarteel Base", stream: "batch", days: "Mon,Wed,Fri", monthlyFee: 2000 },
      { id: "F2", name: "Tarteel — weekly 5 day", course: "Tarteel Advanced", stream: "batch", days: "Mon,Tue,Wed,Thu,Fri", monthlyFee: 2699 },
      { id: "F3", name: "Hifz — weekly 6 day", course: "Hifz", stream: "batch", days: "Mon,Tue,Wed,Thu,Fri,Sat", monthlyFee: 3000 },
      { id: "F4", name: "Madrasa Batch — weekly 5 day", course: "Madrasa Batch", stream: "batch", days: "Mon,Tue,Wed,Thu,Fri", monthlyFee: 1000 }
    ]
  };
}
function emptyDB(){
  return { meta: { version: 1, createdAt: new Date().toISOString() }, settings: defaultSettings(),
    students: [], teachers: [], batches: [], subclasses: [], enrollments: [], attendance: [], plans: [], classes: [],
    fees: [], payments: [], refunds: [], income: [], expenses: [], teacherPayments: [], teacherAdjust: [],
    holidays: [], holds: [], adjustments: [], transfers: [], accounts: [{ id: "Cash", name: "Cash", opening: 0 },
      { id: "Bank", name: "Bank", opening: 0 }, { id: "UPI", name: "UPI", opening: 0 }] };
}

function seedDatabase(){
  const R = rng(20260809);
  DB = emptyDB();
  DB.meta.seeded = true;

  DB.teachers = [
    { id:"T001", name:"Ustadh Abdul Hameed", phone:"9995360416", whatsapp:"9995360416", joiningDate:"2025-04-01",
      payAccount:"Bank", indRateType:"perClass", indRate:60, batchPayType:"perSession", batchRate:250,
      status:"Active", notes:"Hifz and Tajweed" },
    { id:"T002", name:"Ustadha Fathima Suhra", phone:"7025070415", whatsapp:"7025070415", joiningDate:"2025-06-15",
      payAccount:"UPI", indRateType:"perHour", indRate:250, batchPayType:"perStudent", batchRate:120,
      status:"Active", notes:"Ladies and children" },
    { id:"T003", name:"Ustadh Muhammed Rashid", phone:"9847112233", whatsapp:"9847112233", joiningDate:"2026-01-10",
      payAccount:"Bank", indRateType:"percent", indRate:45, batchPayType:"monthly", batchRate:4000,
      status:"Active", notes:"Madrasa and Arabic" }
  ];

  DB.batches = [
    { id:"B001", name:"Hifz Morning A", course:"Hifz", level:"Level 2", teacherId:"T001",
      days:["Mon","Tue","Wed","Thu","Fri"], startTime:"06:00", endTime:"07:00", duration:60,
      monthlyFee:1200, admissionFee:500, maxStudents:12, startDate:"2025-11-01", endDate:"", status:"Active",
      notes:"Daily morning memorisation." },
    { id:"B002", name:"Tarteel Base — Evening", course:"Tarteel Base", level:"Beginner", teacherId:"T002",
      days:["Sat","Sun"], startTime:"19:00", endTime:"20:00", duration:60,
      monthlyFee:800, admissionFee:300, maxStudents:15, startDate:"2025-12-01", endDate:"", status:"Active",
      notes:"Weekend beginners." },
    { id:"B003", name:"Tarteel Advanced", course:"Tarteel Advanced", level:"Advanced", teacherId:"T002",
      days:["Tue","Thu"], startTime:"20:00", endTime:"21:00", duration:60,
      monthlyFee:1000, admissionFee:300, maxStudents:12, startDate:"2026-01-05", endDate:"", status:"Active",
      notes:"Tajweed refinement." },
    { id:"B004", name:"Madrasa Kids Batch", course:"Madrasa Batch", level:"Level 1", teacherId:"T003",
      days:["Mon","Wed","Fri"], startTime:"17:30", endTime:"18:30", duration:60,
      monthlyFee:600, admissionFee:200, maxStudents:20, startDate:"2025-11-15", endDate:"", status:"Active",
      notes:"Salah basics and duas." },
    { id:"B005", name:"Hifz Evening B", course:"Hifz", level:"Beginner", teacherId:"T001",
      days:["Mon","Wed","Fri"], startTime:"21:00", endTime:"22:00", duration:60,
      monthlyFee:1200, admissionFee:500, maxStudents:10, startDate:"2026-09-01", endDate:"", status:"Upcoming",
      notes:"Opens next term." }
  ];

  /* name, guardian, gender, dob, joined, batchId(or ""), individual plan or null */
  const people = [
    ["Muhammed Ahmed","Abdul Salam","M","2012-04-18","2025-11-01","B001",null],
    ["Fathima Rinsha","Nizar Ahmed","F","2011-09-02","2025-11-01","B001",null],
    ["Abdul Basith","Yoosuf Kutty","M","2013-01-25","2025-12-05","B001",["Tajweed","T001",["Tue","Thu"],60,"perHour",300,10]],
    ["Ayisha Henna","Shameer Ali","F","2012-11-11","2026-01-08","B001",null],
    ["Muhammed Sinan","Rasheed K","M","2010-06-30","2026-03-02","B001",null],
    ["Hafsa Mariyam","Jaleel Rahman","F","2014-02-14","2025-12-01","B002",null],
    ["Ibrahim Faris","Noushad P","M","2013-07-21","2025-12-01","B002",null],
    ["Zainab Nasrin","Kamarudheen","F","2012-05-09","2026-01-15","B002",["Arabic","T003",["Mon","Thu"],45,"perClass",60,5]],
    ["Yasir Arafath","Abdul Kareem","M","2011-03-27","2026-02-10","B002",null],
    ["Aamina Shifa","Sidheeq Ahmed","F","2013-10-04","2026-04-01","B003",null],
    ["Muhammed Rehan","Ashraf Ali","M","2009-08-16","2026-01-05","B003",null],
    ["Safa Mehrin","Hussain Koya","F","2010-12-22","2026-01-05","B004",null],
    ["Nihal Ahmed","Shafeeq V","M","2015-01-09","2025-11-15","B004",null],
    ["Ruqayya Fida","Anwar Sadath","F","2016-03-12","2025-11-15","B004",null],
    ["Muhammed Ayaan","Jasim Muhammed","M","2015-07-07","2026-01-10","B004",null],
    ["Maryam Sana","Iqbal Hassan","F","2016-09-28","2026-02-05","","Madrasa Individual|T003|Sat,Sun|30|monthly|900|5"],
    ["Ahmed Shibili","Sulaiman T","M","2014-11-30","2026-02-01","",["Hifz","T001",["Mon","Tue","Wed","Thu","Fri"],45,"perClass",50,5]],
    ["Aysha Nadha","Rafeeq Muhammed","F","2017-06-06","2026-03-01","",["Tarteel Base","T002",["Mon","Wed","Fri"],30,"perDay",120,5]],
    ["Muhammed Zayan","Haris Abdulla","M","2016-12-19","2026-07-18","",["Hifz","T001",["Tue","Thu","Sat"],45,"perClass",70,10]],
    ["Ruqiya Thasneem","Basheer M","F","2011-02-08","2026-05-01","",["Tajweed","T002",["Sat","Sun"],60,"perHour",280,10]]
  ];

  people.forEach(function(p, i){
    const id = "ST" + String(i + 1).padStart(3, "0");
    const phone = "98" + String(4000000 + Math.floor(R() * 999999)).slice(0, 8);
    DB.students.push({ id: id, name: p[0], guardian: p[1], phone: phone, whatsapp: phone,
      email: p[0].toLowerCase().split(" ")[0] + (i + 1) + "@example.com",
      gender: p[2] === "M" ? "Male" : "Female", dob: p[3], joiningDate: p[4],
      address: ["Malappuram, Kerala","Kozhikode, Kerala","Kannur, Kerala","Doha, Qatar","Sharjah, UAE"][i % 5],
      status: "Active", admissionFee: 0, notes: "" });

    if (p[5]) {
      const b = DB.batches.find(x => x.id === p[5]);
      DB.enrollments.push({ id: "ENR" + String(DB.enrollments.length + 1).padStart(3, "0"),
        studentId: id, batchId: p[5], joiningDate: p[4], leavingDate: "",
        monthlyFee: b.monthlyFee, dueDay: (i % 3 === 0) ? 10 : 5, status: "Active", reason: "", notes: "Initial enrolment" });
    }
    let plan = p[6];
    if (typeof plan === "string") { const q = plan.split("|"); plan = [q[0], q[1], q[2].split(","), +q[3], q[4], +q[5], +q[6]]; }
    if (plan) {
      DB.plans.push({ id: "IPL" + String(DB.plans.length + 1).padStart(3, "0"), studentId: id, teacherId: plan[1],
        course: plan[0], days: plan[2], time: "18:00", duration: plan[3], perWeek: plan[2].length,
        feeType: plan[4], rate: plan[5], dueDay: plan[6], discount: i === 16 ? 150 : 0,
        status: "Active", startDate: p[4], endDate: "", notes: i === 16 ? "Sibling discount." : "" });
    }
  });

  /* one real batch transfer and one student who left */
  (function(){
    const old = DB.enrollments.find(e => e.studentId === "ST010" && e.status === "Active");
    if (old) {
      old.status = "Transferred"; old.leavingDate = "2026-07-01"; old.reason = "Promoted to advanced";
      DB.enrollments.push({ id: "ENR" + String(DB.enrollments.length + 1).padStart(3, "0"), studentId: "ST010",
        batchId: "B003", joiningDate: "2026-07-01", leavingDate: "", monthlyFee: 1000, dueDay: old.dueDay,
        status: "Active", reason: "", notes: "Transferred from B003" });
    }
  })();

  /* two large batches are split into groups, each with its own teacher */
  DB.subclasses = [
    { id:"SUB001", batchId:"B001", name:"Group A · Morning", teacherId:"T001", days:["Mon","Tue","Wed","Thu","Fri"],
      startTime:"06:00", endTime:"07:00", capacity:8, monthlyFee:0, status:"Active", notes:"Advanced memorisers" },
    { id:"SUB002", batchId:"B001", name:"Group B · Morning", teacherId:"T003", days:["Mon","Tue","Wed","Thu","Fri"],
      startTime:"07:00", endTime:"08:00", capacity:8, monthlyFee:0, status:"Active", notes:"Building fluency" },
    { id:"SUB003", batchId:"B004", name:"Juniors", teacherId:"T003", days:["Mon","Wed","Fri"],
      startTime:"17:30", endTime:"18:30", capacity:12, monthlyFee:0, status:"Active", notes:"Under 8" },
    { id:"SUB004", batchId:"B004", name:"Seniors", teacherId:"T002", days:["Mon","Wed","Fri"],
      startTime:"18:30", endTime:"19:30", capacity:12, monthlyFee:700, status:"Active", notes:"8 and above" }
  ];
  DB.enrollments.forEach(function(e, i){
    if (e.batchId === "B001") e.subClassId = (i % 2 === 0) ? "SUB001" : "SUB002";
    if (e.batchId === "B004") e.subClassId = (i % 2 === 0) ? "SUB003" : "SUB004";
  });

  DB.holidays = [
    { id: "HOL001", from: "2026-06-16", to: "2026-06-16", name: "Public holiday" },
    { id: "HOL002", from: "2026-07-06", to: "2026-07-08", name: "Mid-term break" },
    { id: "HOL003", from: "2026-08-15", to: "2026-08-15", name: "Independence Day" }
  ];

  /* attendance for the batch stream */
  DB.batches.forEach(function(b){
    if (b.status !== "Active") return;
    for (let d = parseYMD("2026-06-01"); ymd(d) <= today(); d.setDate(d.getDate() + 1)) {
      const ds = ymd(d);
      if (!Logic.batchMeetsOn(b, ds)) continue;
      if (Logic.isHoliday(ds)) continue;
      Logic.rosterOf(b.id, ds).forEach(function(st){
        const r = R();
        const sub = st.enrollment.subClassId ? DataService.getSubclass(st.enrollment.subClassId) : null;
        DB.attendance.push({ id: uid("ATT", DB.attendance, 5), date: ds, month: monthOf(ds), batchId: b.id,
          subClassId: st.enrollment.subClassId || "", studentId: st.id,
          teacherId: (sub && sub.teacherId) || b.teacherId,
          status: r > 0.14 ? "Present" : r > 0.07 ? "Absent" : r > 0.03 ? "Leave" : "Excused",
          remarks: "", source: "admin" });
      });
    }
  });

  /* class log for the individual stream */
  DB.plans.forEach(function(pl){
    for (let d = parseYMD("2026-06-01"); ymd(d) <= today(); d.setDate(d.getDate() + 1)) {
      const ds = ymd(d);
      if (ds < pl.startDate) continue;
      if (pl.days.indexOf(DOW[d.getDay()]) < 0) continue;
      if (Logic.isHoliday(ds)) continue;
      const r = R();
      const status = r > 0.16 ? "Completed" : r > 0.10 ? "Student Absent" : r > 0.06 ? "Cancelled"
                   : r > 0.03 ? "Teacher Absent" : "Rescheduled";
      DB.classes.push({ id: uid("CLS", DB.classes, 4), date: ds, studentId: pl.studentId, planId: pl.id,
        teacherId: pl.teacherId, duration: status === "Completed" ? pl.duration : 0, status: status, notes: "" });
    }
  });

  /* closed months are billed, then reconciled so any difference rolls forward */
  Logic.buildBoth("2026-06"); Logic.reconcileMonth("2026-06");
  Logic.buildBoth("2026-07"); Logic.reconcileMonth("2026-07");
  Logic.buildBoth("2026-08");

  /* payments across both streams */
  DB.fees.forEach(function(f, i){
    const net = Math.max(0, f.gross - f.discount);
    if (net <= 0) return;
    const r = R();
    let share = 0;
    if (f.month === "2026-06") share = r < 0.9 ? 1 : (r < 0.97 ? 0.5 : 0);
    else if (f.month === "2026-07") share = r < 0.74 ? 1 : (r < 0.92 ? 0.6 : 0);
    else share = r < 0.4 ? 1 : (r < 0.58 ? 0.5 : 0);
    if (!share) return;
    const acc = ["UPI", "Bank", "Cash", "UPI"][i % 4];
    const d = parseYMD(f.dueDate); d.setDate(d.getDate() - Math.floor(R() * 5) + 1);
    let date = ymd(d); if (date > today()) date = today();
    DB.payments.push({ id: uid("PAY", DB.payments, 5), feeId: f.id, source: f.source, studentId: f.studentId,
      month: f.month, amount: Math.round(net * share), date: date, account: acc,
      txnId: "TXN" + String(100000 + Math.floor(R() * 899999)), remarks: share < 1 ? "Part payment" : "",
      createdAt: new Date().toISOString() });
  });

  [["2026-06-03","Admission Fee","Admission — Aamina Shifa","ST010",500,"UPI"],
   ["2026-06-18","Recorded Course","Tajweed recorded course","Website",1500,"UPI"],
   ["2026-07-02","Admission Fee","Admission — Ahmed Shibili","ST017",500,"Cash"],
   ["2026-07-14","Study Material","Qaida books — 6 copies","Parents",1800,"Cash"],
   ["2026-07-26","Course Fee","Ramadan short course","Batch",3200,"Bank"],
   ["2026-08-04","Admission Fee","Admission — Muhammed Zayan","ST019",500,"UPI"],
   ["2026-08-06","Recorded Course","Nazrah recorded course","Website",900,"UPI"]
  ].forEach(x => DB.income.push({ id: uid("INC", DB.income), date: x[0], category: x[1], description: x[2],
    source: x[3], amount: x[4], account: x[5], reference: "", notes: "" }));

  [["2026-06-02","Internet","Monthly broadband","Airtel",1499,"Bank"],
   ["2026-06-05","Hosting","Portal hosting renewal","Hostinger",2400,"Bank"],
   ["2026-06-12","Advertising","Instagram promotion","Meta",1200,"UPI"],
   ["2026-06-28","Study Materials","Printed Qaida stock","Local press",2200,"Cash"],
   ["2026-07-02","Internet","Monthly broadband","Airtel",1499,"Bank"],
   ["2026-07-09","Software","Zoom subscription","Zoom",1350,"Bank"],
   ["2026-07-21","Printing","Certificates and receipts","Local press",850,"Cash"],
   ["2026-07-30","Bank Charges","Quarterly charges","Bank",118,"Bank"],
   ["2026-08-02","Internet","Monthly broadband","Airtel",1499,"Bank"],
   ["2026-08-05","Domain","manzilulquran.in renewal","Registrar",950,"UPI"],
   ["2026-08-07","Office Expense","Stationery","Local store",420,"Cash"]
  ].forEach(x => DB.expenses.push({ id: uid("EXP", DB.expenses), date: x[0], category: x[1], description: x[2],
    payee: x[3], amount: x[4], account: x[5], reference: "", notes: "" }));

  ["2026-06", "2026-07", "2026-08"].forEach(function(m){
    DB.teachers.forEach(function(t){
      const v = Logic.payrollView(t, m);
      if (v.payable <= 0) return;
      const share = m === "2026-08" ? (t.id === "T001" ? 0.5 : 0) : 1;
      if (!share) return;
      DB.teacherPayments.push({ id: uid("TPY", DB.teacherPayments), teacherId: t.id, month: m,
        amount: Math.round(v.payable * share), date: m === "2026-08" ? "2026-08-06" : dueDateFor(m, 28),
        account: t.payAccount === "UPI" ? "UPI" : "Bank",
        category: share < 1 ? "Teacher Advance" : "Teacher Payment",
        remarks: share < 1 ? "Advance for August" : "Monthly settlement" });
    });
  });

  DB.transfers.push({ id: "TRF001", date: "2026-06-20", from: "Cash", to: "Bank", amount: 8000, notes: "Cash deposit" });
  DB.transfers.push({ id: "TRF002", date: "2026-07-18", from: "UPI", to: "Bank", amount: 12000, notes: "UPI settlement" });
  const rp = DB.payments.find(p => p.month === "2026-07" && p.source === "individual");
  if (rp) DB.refunds.push({ id: "REF001", date: "2026-07-25", studentId: rp.studentId, feeId: rp.feeId,
    paymentId: rp.id, source: rp.source, amount: 300, reason: "Classes missed — teacher absent", account: rp.account });

  persist();
}
function bootData(){
  const saved = Storage.load();
  if (saved && saved.students && saved.fees) {
    DB = Object.assign(emptyDB(), saved);
    DB.settings = Object.assign(defaultSettings(), saved.settings || {});
    /* adopt the built-in sync endpoint if this browser never had one set */
    const dflt = defaultSettings();
    if (!DB.settings.apiUrl) DB.settings.apiUrl = dflt.apiUrl;
    if (!DB.settings.syncKey) DB.settings.syncKey = dflt.syncKey;
    if (!DB.settings.supabaseUrl) DB.settings.supabaseUrl = dflt.supabaseUrl;
    if (!DB.settings.supabaseKey) DB.settings.supabaseKey = dflt.supabaseKey;
    if (!DB.accounts || !DB.accounts.length) DB.accounts = emptyDB().accounts;
  } else { DB = emptyDB(); persist(); }
}

/* ==========================================================================
   STATE + ROUTER (three workspaces, one page registry)
   ========================================================================== */
const WS = {
  batch: { label: "Batch classes", sub: "Batch workspace", home: "bDash", nav: [
    ["Overview", [["bDash", "◱", "Batch dashboard", "Dashboard"]]],
    ["Manage", [["batches", "▤", "Courses & classes", "Classes"], ["subclasses", "◨", "Sub-classes", "Sub-classes"],
      ["enrol", "⇄", "Enrolment", "Enrolment"], ["attendance", "✓", "Attendance", "Attendance"]]],
    ["Fees", [["bFees", "₹", "Batch fees", "Fees"], ["bDues", "!", "Due & overdue", "Dues"]]],
    ["Reports", [["bReports", "▥", "Batch reports", "Reports"]]]
  ]},
  ind: { label: "Individual classes", sub: "Individual workspace", home: "iDash", nav: [
    ["Overview", [["iDash", "◱", "Individual dashboard", "Dashboard"]]],
    ["Manage", [["plans", "☺", "Class plans", "Plans"], ["classes", "✓", "Class log", "Class log"]]],
    ["Fees", [["iFees", "₹", "Individual fees", "Fees"], ["iDues", "!", "Due & overdue", "Dues"]]],
    ["Reports", [["iReports", "▥", "Individual reports", "Reports"]]]
  ]},
  books: { label: "Academy books", sub: "Shared workspace", home: "overview", nav: [
    ["Overview", [["overview", "◱", "Academy overview", "Dashboard"]]],
    ["People", [["students", "☺", "Students", "Students"], ["teachers", "✎", "Teachers", "Teachers"], ["staff", "◉", "Other staff", "Staff"]]],
    ["Money in", [["payments", "◈", "All payments", "Payments"], ["income", "↑", "Other income", "Income"]]],
    ["Money out", [["expenses", "↓", "Expenses", "Expenses"]]],
    ["Books", [["accounts", "▦", "Accounts", "Accounts"], ["ledger", "☰", "Ledger", "Ledger"],
      ["reports", "▥", "Reports", "Reports"]]],
    ["System", [["settings", "⚙", "Settings", "Settings"]]]
  ]}
};
const PAGE_WS = {}; /* page -> workspace */
Object.keys(WS).forEach(ws => WS[ws].nav.forEach(g => g[1].forEach(item => PAGE_WS[item[0]] = ws)));
PAGE_WS.profile = "books";

const PAGE_SUB = {
  staff: "Admin, counsellors, editors and other staff on a monthly salary plus incentive.",
  bDash: "Batch collection, attendance and dues for the selected month.",
  batches: "One central register of every batch and course.",
  subclasses: "Split a big batch into smaller groups, each with its own teacher, timing and pay.",
  enrol: "Batch history is added to, never overwritten.",
  attendance: "Pick a date and batch, mark the roster, save.",
  bFees: "One record per enrolment per month. Tap a row for the detail.",
  bDues: "Who to follow up with, latest first.",
  bReports: "Batch-wise and monthly collection.",
  iDash: "Individual classes, fees earned and dues.",
  plans: "Each student's own schedule, fee method and rate.",
  classes: "Record a class once — the fee follows from it.",
  iFees: "Calculated from the class log. Tap a row for the working.",
  iDues: "Individual class dues, latest first.",
  iReports: "Per student and per teacher.",
  overview: "Both streams together — one income, one expense, one profit.",
  students: "One registry. A student can be in a batch, in individual classes, or both.",
  teachers: "One registry, paid for both streams from one payslip.",
  payments: "Every payment from both streams, in one ledger.",
  income: "Anything earned outside class fees.",
  expenses: "Running costs, paid from a chosen account.",
  tpay: "Batch pay and individual pay, added up per teacher.",
  accounts: "Cash, Bank and UPI, and transfers between them.",
  ledger: "Built automatically from what you record.",
  reports: "Filter by stream, print or export.",
  settings: "Academy details, categories, backup.",
  profile: "Everything about one student, both streams."
};

const State = {
  ws: "batch", page: "bDash", month: currentMonth(),
  batches:  { q: "", status: "", course: "", teacher: "" },
  enrol:    { q: "", status: "", batch: "" },
  att:      { date: today(), batchId: "", subClassId: "", marks: null, tab: "history" },
  bFees:    { q: "", status: "", batch: "" },
  bDues:    { quick: "all", q: "", batch: "" },
  bRep:     { batchId: "" },
  plans:    { q: "", status: "Active", teacher: "" },
  classes:  { q: "", student: "", teacher: "", status: "", month: "" },
  iFees:    { q: "", status: "", teacher: "" },
  iDues:    { quick: "all", q: "", teacher: "" },
  students: { q: "", status: "Active", stream: "" },
  teachers: { q: "" },
  staff:    { q: "" },
  pays:     { q: "", month: "", account: "", source: "" },
  income:   { q: "", month: "", category: "" },
  expenses: { q: "", month: "", category: "" },
  tpay:     { month: "" },
  ledger:   { q: "", type: "", account: "", source: "", from: "", to: "" },
  reports:  { which: "pnl", preset: "month", from: "", to: "", source: "", studentId: "" },
  profile:  { studentId: "", tab: "fees" },
  cal:      { month: currentMonth() }
};

function switchWS(ws){
  State.ws = ws;
  document.body.setAttribute("data-ws", ws);
  $$(".ws-btn").forEach(b => b.classList.toggle("is-on", b.dataset.wsGo === ws));
  buildNav();
  go(WS[ws].home);
}
function buildNav(){
  const ws = WS[State.ws];
  $("#navList").innerHTML = ws.nav.reduce((a, g) => a.concat(g[1]), []).map(function(it){
    const badgeId = it[0] === "bDues" ? "bDueBadge" : it[0] === "iDues" ? "iDueBadge" : "";
    return '<button data-page="' + it[0] + '">' + esc(it[3] || it[2]) +
      (badgeId ? '<span class="nb" id="' + badgeId + '">0</span>' : "") + '</button>';
  }).join("");
}
function go(page){
  const ws = PAGE_WS[page];
  if (ws && ws !== State.ws) {
    State.ws = ws;
    document.body.setAttribute("data-ws", ws);
    $$(".ws-btn").forEach(b => b.classList.toggle("is-on", b.dataset.wsGo === ws));
    buildNav();
  }
  State.page = page;
  $$("#navList button").forEach(b => b.classList.toggle("is-on", b.dataset.page === page));
  const nav = (WS[State.ws].nav.reduce((a, g) => a.concat(g[1]), []).find(x => x[0] === page));
  $("#pageTitle").textContent = nav ? nav[2] : (page === "profile" ? "Student profile" : page);
  $("#pageSub").textContent = PAGE_SUB[page] || "";
  $("#crumb").textContent = WS[State.ws].label + "  /  " + (nav ? nav[2] : "Student profile");
  $("#headActs").innerHTML = HEAD_ACTS[page] || "";
  render();
  window.scrollTo({ top: 0 });
}
function render(){
  const fn = Pages[State.page];
  $("#view").innerHTML = fn ? fn() : '<div class="empty"><h4>Page not found</h4></div>';
  chrome();
  restoreFocus();
}
function chrome(){
  const bd = Logic.feeViews({ month: State.month, source: "batch" }).filter(v => v.balance > 0).length;
  const idn = Logic.feeViews({ month: State.month, source: "individual" }).filter(v => v.balance > 0).length;
  const set = function(id, n){ const el = $("#" + id); if (el) { el.textContent = n; el.style.display = n ? "" : "none"; } };
  set("bDueBadge", bd); set("iDueBadge", idn);
  const s = Settings();
  $("#brandName").textContent = s.academyName || "ManzilulQuran";
  $("#brandSub").textContent = s.academyTagline || "Learn Quran";
  const mk = $("#brandMark");
  if (s.logo) { mk.style.backgroundImage = "url(" + s.logo + ")"; mk.textContent = ""; }
  else { mk.style.backgroundImage = ""; mk.textContent = (s.academyName || "MQ").slice(0, 2).toUpperCase(); }
}
function closeDrawer(){ /* top navigation — nothing to close */ }
const HEAD_ACTS = {
  overview: '<button class="btn" data-act="print">Export view</button>' +
            '<button class="btn btn-primary" data-act="build-both">Calculate this month</button>',
  bFees:    '<button class="btn btn-primary" data-act="next-month">Open next month</button>',
  iFees:    '<button class="btn btn-primary" data-act="next-month">Open next month</button>',
  attendance: '<button class="btn" data-act="holidays">Holidays</button>' +
              '<button class="btn btn-primary" data-act="att-range">Mark a date range</button>',
  students: '<button class="btn btn-primary" data-act="student-new">+ Add student</button>',
  teachers: '<button class="btn btn-primary" data-act="teacher-new">+ Add teacher</button>',
  batches:  '<button class="btn btn-primary" data-act="batch-new">+ Create class</button>',
  plans:    '<button class="btn btn-primary" data-act="plan-new">+ New class plan</button>',
  reports:  '<button class="btn" data-act="print">Print</button><button class="btn btn-primary" data-act="rep-csv">Export CSV</button>'
};

/* ---- form helpers ---- */
function optList(values, selected, ph){
  return (ph ? '<option value="">' + esc(ph) + '</option>' : "") + values.map(function(v){
    const val = (typeof v === "object") ? v.value : v, lab = (typeof v === "object") ? v.label : v;
    return '<option value="' + esc(val) + '"' + (String(val) === String(selected) ? " selected" : "") + '>' + esc(lab) + '</option>';
  }).join("");
}
function field(l, inner, cls){ return '<div class="field ' + (cls || "") + '"><label>' + esc(l) + '</label>' + inner + '</div>'; }
function sel(name, inner, attrs){ return '<select class="select" name="' + name + '" ' + (attrs || "") + '>' + inner + '</select>'; }
function batchOpts(s, ph, activeOnly){
  return optList(DataService.getBatches().filter(b => !activeOnly || b.status === "Active")
    .map(b => ({ value: b.id, label: b.id + " · " + b.name })), s, ph === undefined ? "All batches" : ph);
}
function teacherOpts(s, ph){ return optList(DataService.getTeachers().map(t => ({ value: t.id, label: t.name })), s,
  ph === undefined ? "All teachers" : ph); }
function studentOpts(s, ph, filter){
  return optList(DataService.getStudents().filter(x => !filter || filter(x)).sort((a, b) => a.name.localeCompare(b.name))
    .map(x => ({ value: x.id, label: x.id + " · " + x.name })), s, ph === undefined ? "All students" : ph);
}
function accountOpts(s, ph){ return optList(DataService.getAccounts().map(a => ({ value: a.id, label: a.name })), s, ph); }
function courseOpts(s, ph){ return optList(Settings().courses || [], s, ph === undefined ? "All courses" : ph); }
function allMonths(){
  const set = {};
  DB.fees.forEach(f => set[f.month] = true);
  DB.classes.forEach(c => set[monthOf(c.date)] = true);
  DB.attendance.forEach(a => set[a.month] = true);
  set[currentMonth()] = true; set[addMonths(currentMonth(), 1)] = true;
  return Object.keys(set).sort();
}
function monthOpts(s, ph){ return optList(allMonths().map(m => ({ value: m, label: monthLabel(m) })), s, ph); }
function money2(v){ return '<span class="amt">' + money(v) + '</span>'; }
function search(hay, q){ return !q || hay.toLowerCase().indexOf(q) >= 0; }

const Pages = {};

/* ==========================================================================
   SHARED BUILDERS — fee list + dues list work for either stream
   ========================================================================== */
function feeDetail(v){
  const pays = v.payments.slice().sort((a, b) => a.date < b.date ? 1 : -1);
  return dl([
    ["Fee record", idchip(v.id)],
    ["Stream", streamChip(v.source)],
    ["Month", monthLabel(v.month)],
    ["Student", esc(v.studentName) + " " + idchip(v.studentId)],
    ["Teacher", esc(v.teacherName)],
    v.source === "batch" ? ["Batch", esc(v.batchName || "—")] : ["Fee method", esc(Logic.methodLabel(v.feeType))],
    v.source === "individual" ? ["Worked out from", esc(v.basisText || "—")] : ["Monthly fee", money(v.rate)],
    v.source === "individual" && v.billing === "prepaid"
      ? ["Billed in advance for", (v.plannedUnits || 0) + " planned classes" +
          (v.plannedHolidays ? " (" + v.plannedHolidays + " holidays skipped)" : "")] : null,
    v.reconciled ? ["Actually held", (v.actualUnits || 0) + " classes · " + money(v.actualGross)] : null,
    ["Gross fee", money(v.gross)],
    ["Discount", v.discount ? "− " + money(v.discount) : "—"],
    v.carry ? ["Carried forward", (v.carry < 0 ? "− " + money(-v.carry) + " credit" : "+ " + money(v.carry))] : null,
    ["Net fee", '<b>' + money(v.netFee) + '</b>'],
    ["Paid", '<span class="in">' + money(v.paidAmount) + '</span>'],
    ["Balance", v.balance > 0 ? '<span class="out">' + money(v.balance) + '</span>' : '<span class="in">Settled</span>'],
    v.credit ? ["Paid in excess", '<span class="in">' + money(v.credit) + '</span>'] : null,
    ["Due date", fmtDate(v.dueDate)],
    v.daysOverdue ? ["Days overdue", '<span class="out">' + v.daysOverdue + ' days</span>'] : null,
    ["Status", feeBadge(v.status)],
    v.override ? ["Amount", 'Typed in for this month' + (v.autoGross !== undefined && v.autoGross !== null ? ' (calculated was ' + money(v.autoGross) + ')' : '')] : null,
    v.status === "Needs amount" ? ["Action", '<span class="out">Enter this month\'s amount with Adjust</span>'] : null,
    v.locked ? ["Locked", "Yes — recalculation skips this month"] : null,
    v.remarks ? ["Remarks", esc(v.remarks)] : null
  ]) +
  '<div class="sub-hd">Payments against this month</div>' +
  (pays.length ? pays.map(p => '<div class="minirow"><span>' + fmtDate(p.date) + ' · ' + esc(p.account) +
      ' · ' + esc(p.id) + (p.txnId ? ' · ' + esc(p.txnId) : "") + '</span><b class="in">' + money(p.amount) + '</b></div>').join("")
    : '<div class="minirow"><span>No payment received yet</span><b>—</b></div>') +
  acts(
    (v.balance > 0 ? '<button class="btn btn-sm btn-primary" data-act="pay-new" data-id="' + v.id + '">Take payment</button>' +
      '<button class="btn btn-sm btn-wa" data-act="wa-remind" data-id="' + v.id + '">WhatsApp</button>' : "") +
    '<button class="btn btn-sm" data-act="fee-edit" data-id="' + v.id + '">Adjust</button>' +
    '<button class="btn btn-sm" data-act="profile-open" data-id="' + v.studentId + '">Open student</button>');
}
function withBasis(v){
  if (v.source === "individual") {
    const st = Logic.classStats(DataService.getClasses({ planId: v.planId, month: v.month }));
    const fx = Logic.ruleExtra(v, "fee");
    v.basisText = v.feeType === "manual" ? "typed in each month" : Logic.feeBasis(v.feeType, st, fx) + " @ " + money(v.rate);
    v.shortBasis = Logic.feeBasis(v.feeType, st, fx);
    if (v.override) { v.basisText += " · amount typed in"; v.shortBasis += " · typed in"; }
  } else v.shortBasis = v.batchName || "Batch";
  return v;
}
function feeRowList(lid, views, extra){
  return renderList(lid, views, Object.assign({
    key: v => v.id,
    title: v => esc(v.studentName) + ' <span class="idchip">' + esc(v.studentId) + '</span>',
    sub: v => esc(v.shortBasis + " · due " + fmtDate(v.dueDate) + (v.daysOverdue ? " · " + v.daysOverdue + "d late" : "")),
    amount: v => money(v.balance > 0 ? v.balance : v.netFee) +
      '<small>' + (v.balance > 0 ? "balance of " + money(v.netFee) : "paid in full") + '</small>',
    badge: v => feeBadge(v.status),
    rowClass: v => v.daysOverdue > 0 && v.balance > 0 ? "row-bad" : (v.balance <= 0 && v.netFee > 0 ? "row-ok" : ""),
    detail: feeDetail,
    head: ["Student", "Balance"],
    sorts: [
      { key: "late", label: "Most overdue first", val: v => v.daysOverdue * 1000 + v.balance, desc: true },
      { key: "bal", label: "Largest balance first", val: v => v.balance, desc: true },
      { key: "name", label: "Student name", val: v => v.studentName },
      { key: "due", label: "Due date", val: v => v.dueDate }
    ]
  }, extra || {}));
}
function feeSummaryCards(s){
  return '<div class="kpi-grid">' +
    kpi("Gross", money(s.gross)) +
    kpi("Discount", money(s.discount)) +
    (s.carry ? kpi("Carried forward", money(s.carry), s.carry < 0 ? "credit from last month" : "extra from last month") : "") +
    kpi("Net fee", money(s.net), num(s.count) + " records", "a-acc") +
    kpi("Collected", money(s.paid), s.collectionPct + "% of net", "a-ok") +
    kpi("Balance", money(s.balance), num(s.overdueN) + " overdue", "a-warn") +
  '</div>';
}

function feesPage(source, key, buildAct){
  const f = State[key], m = State.month, q = f.q.toLowerCase().trim();
  const all = Logic.feeViews({ month: m, source: source }).map(withBasis);
  const views = all.filter(function(v){
    if (f.status && v.status !== f.status) return false;
    if (f.batch && v.batchId !== f.batch) return false;
    if (f.teacher && v.teacherId !== f.teacher) return false;
    return search(v.id + " " + v.studentId + " " + v.studentName + " " + v.phone + " " + v.shortBasis, q);
  });
  const s = Logic.summarize(all);
  return '' +
  (source === "individual"
    ? (Logic.prepaid()
      ? '<div class="note"><b>Prepaid.</b> The month is billed up front on the classes the timetable plans, with holidays taken out. ' +
        'At the end of the month press <b>Reconcile</b> — classes that did not happen come back as a credit on the next month, ' +
        'and extra classes are added on. The month just closed is locked, never rewritten.</div>'
      : '<div class="note">Class-based fees grow as classes are logged, so this month keeps changing until it ends. ' +
        'Press <b>Calculate month</b> after logging classes, and lock a month from <b>Adjust</b> once it is final.</div>')
    : (Logic.prepaid()
      ? '<div class="note"><b>Prepaid.</b> Batch fees for ' + esc(monthLabel(m)) + ' fall due ' +
        esc(fmtDate(Logic.feeDueDate(m, Settings().defaultDueDay))) + ' — before the month starts. ' +
        'Use <b>Open next month</b> to raise the next month early so parents can pay in advance.</div>' : "")) +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="' + key + '.q" value="' + esc(f.q) + '" placeholder="Student name or ID">', "grow") +
    field("Status", sel("s", optList(["Paid","Partial","Upcoming","Due Today","Overdue","Waived","Nil"], f.status, "All statuses"), 'data-fset="' + key + '.status"')) +
    (source === "batch" ? field("Batch", sel("b", batchOpts(f.batch), 'data-fset="' + key + '.batch"'))
                        : field("Teacher", sel("t", teacherOpts(f.teacher), 'data-fset="' + key + '.teacher"'))) +
    '<div class="push btn-row">' +
      '<button class="btn btn-dark" data-act="' + buildAct + '">Calculate month</button>' +
      '<button class="btn" data-act="next-month">Open next month</button>' +
      (source === "individual" && Logic.prepaid() ? '<button class="btn" data-act="reconcile">Reconcile ' +
        esc(monthShort(m)) + '</button>' : "") +
      '<button class="btn" data-act="fees-csv" data-src="' + source + '">CSV</button>' +
      '<button class="btn" data-act="print">Print</button>' +
    '</div>' +
  '</div>' +
  feeSummaryCards(s) +
  '<div class="section-title">' + esc(monthLabel(m)) + ' · tap a row for the full record</div>' +
  '<div class="card"><div class="card-bd tight">' +
    feeRowList(key, views, {
      emptyTitle: "No fees for " + monthLabel(m),
      emptyText: source === "batch"
        ? "Calculate the month to create one record per active enrolment. Existing records are never duplicated."
        : "Calculate the month to work out every active plan from its class log.",
      emptyAction: '<button class="btn btn-primary" data-act="' + buildAct + '">Calculate month</button>'
    }) +
  '</div></div>';
}

function duesPage(source, key){
  const d = State[key], m = State.month, q = d.q.toLowerCase().trim();
  const all = Logic.feeViews({ month: m, source: source }).map(withBasis);
  const tests = {
    all: v => v.balance > 0, overdue: v => v.balance > 0 && v.daysOverdue > 0,
    today: v => v.status === "Due Today", upcoming: v => v.status === "Upcoming",
    partial: v => v.status === "Partial", paid: v => v.status === "Paid"
  };
  const counts = {}; Object.keys(tests).forEach(k => counts[k] = all.filter(tests[k]).length);
  const views = all.filter(tests[d.quick] || tests.all).filter(function(v){
    if (d.batch && v.batchId !== d.batch) return false;
    if (d.teacher && v.teacherId !== d.teacher) return false;
    return search(v.studentId + " " + v.studentName + " " + v.phone, q);
  });
  const outstanding = views.reduce((s, v) => s + v.balance, 0);
  const chip = (k, l) => '<button class="chip ' + (d.quick === k ? "is-on" : "") + '" data-act="dues-quick" data-key="' + key +
    '" data-q="' + k + '">' + l + '<span class="ct">' + counts[k] + '</span></button>';

  return '' +
  '<div class="toolbar no-print">' +
    field("Search", '<input class="input" data-fset="' + key + '.q" value="' + esc(d.q) + '" placeholder="Student name, ID or phone">', "grow") +
    (source === "batch" ? field("Batch", sel("b", batchOpts(d.batch), 'data-fset="' + key + '.batch"'))
                        : field("Teacher", sel("t", teacherOpts(d.teacher), 'data-fset="' + key + '.teacher"'))) +
    '<div class="push btn-row"><button class="btn" data-act="dues-csv" data-src="' + source + '">CSV</button></div>' +
  '</div>' +
  '<div class="chips no-print" style="margin-bottom:12px">' +
    chip("all", "All outstanding") + chip("overdue", "Overdue") + chip("today", "Due today") +
    chip("upcoming", "Upcoming") + chip("partial", "Part paid") + chip("paid", "Settled") + '</div>' +
  '<div class="kpi-grid" style="margin-bottom:12px">' +
    kpi("Students to follow up", num(views.length)) +
    kpi("Outstanding", money(outstanding), esc(monthLabel(m)), "a-warn") +
    kpi("Overdue amount", money(all.filter(v => v.daysOverdue > 0).reduce((s, v) => s + v.balance, 0)), "", "a-bad") +
  '</div>' +
  '<div class="card"><div class="card-bd tight">' +
    feeRowList(key + "L", views, {
      emptyTitle: "Nothing to chase here",
      emptyText: "No records match this filter for " + monthLabel(m) + "."
    }) +
  '</div></div>';
}

