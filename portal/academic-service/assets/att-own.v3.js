"use strict";
/* Academic Service — att-own.v3.js. THE CLASS SHEET'S OWN ATTENDANCE (no link).
   Loaded by portal/demo/attendance/ (the demo class sheet), after att-admin.v6.js; the page sets
   window.MQ_SUPABASE_URL / _KEY / _PREFIX ("clsdemo_") and calls ownInit().
   · opens only for a signed-in class-sheet admin (the class sheet's own sign-in, renewed here)
   · classes and marks are read from and saved to the class sheet's tables (clsdemo_plans / clsdemo_att);
     Academic Service gets a copy through the database (clsdemo-own-v1.sql) — students and teachers stay there
   · a new class takes the next IPL number over Academic Service and both class sheets; a new student the next
     MQ number of the one shared series, tagged with this sheet ("sheet": "demo")
   · its own copy on the device (never mixed with the old attendance link's copy)
   · dates and "today" are always India time (IST)
   v2: inside the class sheet, + Student / + Class open the class sheet's New class (class + calendar,
       one save), so a class never waits for its sheet; "Set up <month>" tells the class sheet, which
       makes the month's calendars. Opened on its own, the page works as in v1.
   v3: when a class's days change here, the class sheet is told ("days-changed"), so its calendars
       follow from today; past days stay as they were.
   PUBLISHED FILES ARE IMMUTABLE — create att-own.v4.js to change this. */
const OWN = { px: String(window.MQ_SUPABASE_PREFIX || "clsdemo_").trim(), sheet: "", email: "", planMax: 0, ok: false };
OWN.sheet = OWN.px === "clsdemo_" ? "demo" : "live";

/* the class sheet's tables for classes and marks */
SUPA_TABLE.plans = OWN.px + "plans";
SUPA_TABLE.classes = OWN.px + "att";

/* own copy on this device */
(function(){
  const KEY = "mq_att_own_" + OWN.px + "v1";
  Storage.load = function(){ try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
  Storage.save = function(db){ try { localStorage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; } };
})();

/* India time, whatever the device's clock zone */
today = function(){ return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); };

/* ---- the class sheet admin's sign-in (same keys as the class sheet pages) ---- */
function ownUrl(){ return String(window.MQ_SUPABASE_URL || "").trim().replace(/\/+$/, ""); }
function ownKey(){ return String(window.MQ_SUPABASE_KEY || "").trim(); }
function ownAuthKey(){ return "mq_cls_admin_" + OWN.px; }
function ownAuthRead(){ try { return JSON.parse(localStorage.getItem(ownAuthKey()) || "null"); } catch (e) { return null; } }
let OWN_REFRESH = null;
async function ownToken(){
  const s = ownAuthRead(); if (!s || !s.refresh) return null;
  if (s.access && s.expires - Date.now() > 60000) return s.access;
  if (!OWN_REFRESH) OWN_REFRESH = (async function(){
    try {
      const res = await fetch(ownUrl() + "/auth/v1/token?grant_type=refresh_token", { method: "POST",
        headers: { "apikey": ownKey(), "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.access_token) { if (res.status >= 400 && res.status < 500) localStorage.removeItem(ownAuthKey()); return null; }
      const n = { access: out.access_token, refresh: out.refresh_token, expires: Date.now() + (out.expires_in || 3600) * 1000, email: (out.user && out.user.email) || s.email || "" };
      localStorage.setItem(ownAuthKey(), JSON.stringify(n));
      return n.access;
    } catch (e) { return null; }
  })().finally(() => { OWN_REFRESH = null; });
  return OWN_REFRESH;
}
async function ownRpc(name, body){
  const t = await ownToken(); if (!t) return { result: "error", error: "signed_out" };
  try {
    const res = await fetch(ownUrl() + "/rest/v1/rpc/" + OWN.px + name, { method: "POST",
      headers: { "apikey": ownKey(), "Authorization": "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
    if (res.status === 404) return { result: "error", error: "not_set_up" };
    return await res.json();
  } catch (e) { return { result: "error", error: "offline" }; }
}

/* ---- the database client: the class sheet's tables go with the admin's sign-in ---- */
Supa.on = function(){ return !!(window.supabase && ownUrl() && ownKey()); };
Supa.init = function(){
  if (!this.on()) { this.st.ready = false; return false; }
  try {
    const mine = ["/rest/v1/" + OWN.px, "/rest/v1/rpc/" + OWN.px];
    this.client = window.supabase.createClient(ownUrl(), ownKey(), { auth: { persistSession: false }, global: { fetch: async function(url, opts){
      const u = String(url && url.url || url);
      if (mine.some(m => u.indexOf(m) >= 0)) {
        const t = await ownToken(); opts = Object.assign({}, opts || {});
        const h = new Headers(opts.headers || {}); if (t) h.set("Authorization", "Bearer " + t); opts.headers = h;
      }
      return fetch(url, opts);
    } } });
    this.st.ready = true; this.st.err = ""; return true;
  } catch (e) { this.st.ready = false; this.st.err = String(e.message || e); return false; }
};
/* class numbers: the highest IPL anywhere (Academic Service + both class sheets) */
const _ownMaxId = Supa.maxId.bind(Supa);
Supa.maxId = async function(table, prefix){
  let m = await _ownMaxId(table, prefix);
  if (table === SUPA_TABLE.plans && prefix === "IPL") {
    const c = await ownRpc("own_check"); if (c && c.result === "success") { OWN.planMax = +c.planMax || 0; m = Math.max(m, OWN.planMax); }
  }
  return m;
};

/* ---- every class in this table is this sheet's; the lists show their students and teachers ---- */
admPlanIn = function(p){ return !!p; };
attAdminCheck = function(){ return OWN.ok; };
admLoadScope = async function(){ ADM_SCOPE.on = true; };

/* a new class starts from the next IPL number over Academic Service and both class sheets */
(function(){
  const save = DataService.savePlan.bind(DataService);
  DataService.savePlan = function(rec){
    if (rec && !rec.id && OWN.planMax) {
      const local = (DB.plans || []).reduce((m, p) => { const x = /^IPL(\d+)$/.exec(String(p.id)); return x ? Math.max(m, +x[1]) : m; }, 0);
      rec = Object.assign({}, rec, { id: "IPL" + String(Math.max(local, OWN.planMax) + 1).padStart(4, "0") });
      OWN.planMax = Math.max(local, OWN.planMax) + 1;
    }
    return save(rec);
  };
})();
/* a new student made here is tagged with this sheet */
(function(){
  const save = DataService.saveStudent.bind(DataService);
  DataService.saveStudent = function(rec){
    if (rec && !rec.id && !rec.sheet) rec = Object.assign({}, rec, { sheet: OWN.sheet });
    return save(rec);
  };
})();

/* planned covers: the admin's own check, no link */
admLoadSubs = async function(force){
  const m = State.month || currentMonth(), from = admMonthShift(m, -1) + "-01", to = admMonthShift(m, 2) + "-01";
  if (!force && ADM_SUBS.from === from && ADM_SUBS.to === to) return;
  const out = await ownRpc("own_subs", { p_from: from, p_to: to });
  if (!out || out.result !== "success") return;
  const by = {}, ids = {};
  (out.subs || []).forEach(x => { if (x && x.planId && x.date && x.subId) { by[x.planId + "|" + String(x.date).slice(0, 10)] = { subId: x.subId, sub: x.sub || x.subId }; ids[x.subId] = 1; } });
  const was = JSON.stringify(ADM_SUBS.by);
  ADM_SUBS.by = by; ADM_SUBS.ids = ids; ADM_SUBS.from = from; ADM_SUBS.to = to;
  if (was !== JSON.stringify(by)) { Cache.clear(); render(); }
};

/* ---- start ---- */
async function ownInit(){
  bootData();
  ADM.token = "own-" + OWN.px;
  window.ATT_ACTOR = { name: "Class sheet", via: "class-sheet" };
  State.month = currentMonth();
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  $("#globalMonth").addEventListener("change", function(){ State.month = this.value; State.iatt.sel = null; resetLists(); render(); admLoadSubs(false); });
  switchWS("ind");
  const hadCopy = (DB.plans || []).length > 0;
  if (!(await ownToken())) { admBlock("Sign in to the class sheet first, then open Attendance from it."); return; }
  if (!Supa.on()) { admBlock("Cannot reach the records. Check the internet and reload."); return; }
  Supa.init();
  const chk = await ownRpc("own_check");
  if (!chk || chk.result !== "success") {
    if (chk && chk.error === "offline" && hadCopy) { OWN.ok = ADM.ok = true; ADM_SCOPE.on = true; render(); toast("Offline — showing the copy saved on this device.", "warn", 6000); return; }
    admBlock(chk && chk.error === "not_set_up" ? "The class sheet's attendance is not set up yet (clsdemo-own-v1.sql)." :
             chk && chk.error === "signed_out" ? "Sign in to the class sheet first, then open Attendance from it." : "This account is not a class-sheet admin.");
    return;
  }
  OWN.ok = ADM.ok = true; OWN.email = chk.email || ""; OWN.planMax = +chk.planMax || 0;
  window.ATT_ACTOR = { name: OWN.email || "Class sheet", via: "class-sheet" };
  const who = $("#admWho"); if (who) who.textContent = OWN.email || "Class sheet";
  ADM_SCOPE.on = true; admLoadExtra();
  admLoadSubs(true);                 /* planned covers load alongside the records */
  const b = $("#admBlock"); if (b) b.remove();
  if (hadCopy) { resetLists(); render(); }
  const r = await Supa.pullAll();
  if (!r.ok) { if (hadCopy) toast("Offline — showing the copy saved on this device. Marks send when you are back online.", "warn", 7000); else admBlock("Cannot reach the records. Check the internet and reload."); return; }
  const m2 = allMonths(); if (m2.indexOf(State.month) < 0) State.month = currentMonth();
  $("#globalMonth").innerHTML = monthOpts(State.month, "");
  ATT_LIVE.at = Date.now();
  resetLists(); render(); admPaintState(); admLoadSubs(false);
}

/* ---- v2: inside the class sheet ---- */
const OWN_IN_SHEET = (function(){ try { return window.parent && window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { return false; } })();
if (OWN_IN_SHEET) {
  Actions["adm-plan"] = function(studentId){ closeModal(true); admTell("new-class", { studentId: studentId || "" }); };
  Actions["adm-student-new"] = function(){ closeModal(true); admTell("new-class", {}); };
}
const _ownSetReady = admSetReady;
admSetReady = function(m){
  _ownSetReady(m);
  if (OWN_IN_SHEET) admTell("month-setup", { month: m });
  else toast("Open Attendance from the class sheet to make " + monthLabel(m) + "'s calendars.", "warn", 6000);
};

/* ---- v3: the class days changed — the class sheet moves its calendars along ---- */
(function(){
  const save = DataService.savePlan.bind(DataService);
  DataService.savePlan = function(rec){
    const was = rec && rec.id ? (DB.plans || []).find(x => x.id === rec.id) : null;
    const before = was ? JSON.stringify((was.days || []).slice().sort()) : "";
    const id = save(rec);
    const now = (DB.plans || []).find(x => x.id === id);
    if (was && now && before !== JSON.stringify((now.days || []).slice().sort()) && (now.days || []).length) {
      if (OWN_IN_SHEET) admTell("days-changed", { planId: id, studentId: now.studentId, course: now.course, days: (now.days || []).slice() });
      else toast("Open Attendance from the class sheet next time — the calendar changes its weekly off there.", "warn", 6000);
    }
    return id;
  };
})();
