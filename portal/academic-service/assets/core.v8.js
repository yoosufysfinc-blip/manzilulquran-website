"use strict";
/* Academic Service — core.v8.js. v8: a save made while a load from Supabase is still on its way is no longer
   overwritten by the older copy the load brings back (pullAll on opening, refresh on the attendance sheet) —
   e.g. a class plan switched to Stopped jumped back to Active. getFees / feeViews now filter by planId (it was ignored).
   (v7: several people can work at once — new students, teachers and plans take their number from the database (claim), Supa.refresh merges other devices' changes, and an attendance-admin mode (window.MQ_ADMIN) loads only what the admin link needs. (v6: paged loading, fixed mark IDs.) */
/* ==========================================================================
   ManzilulQuran — Academy Manager (single file)

   THREE WORKSPACES, ONE DATABASE
     Batch classes      · batches, enrolment, attendance, batch fees
     Individual classes · class plans, class log, per-class fees
     Books              · shared people, all payments, income, expense,
                          accounts, ledger, reports, settings

   The two teaching streams never overlap in the books:
     · every fee record carries source = "batch" or "individual"
     · every payment points at exactly one fee record
     · income is therefore counted once, under its own category
     · students and teachers live in ONE registry used by both streams
   ========================================================================== */

/* ------------------------------ utilities ------------------------------ */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function esc(v){ return v === null || v === undefined ? "" :
  String(v).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c])); }
function pad2(n){ return String(n).padStart(2, "0"); }
function ymd(d){ return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function parseYMD(s){ if (!s) return null; const p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
function today(){ return ymd(new Date()); }
function currentMonth(){ return today().slice(0, 7); }
function monthOf(d){ return (d || "").slice(0, 7); }
function daysInMonth(m){ const p = m.split("-"); return new Date(+p[0], +p[1], 0).getDate(); }
function monthStart(m){ return m + "-01"; }
function monthEnd(m){ return m + "-" + pad2(daysInMonth(m)); }
function dueDateFor(m, day){ return m + "-" + pad2(Math.min(Math.max(parseInt(day, 10) || 5, 1), daysInMonth(m))); }
function diffDays(a, b){
  const A = parseYMD(a), B = parseYMD(b); if (!A || !B) return 0;
  return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate())
                   - Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
}
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function monthLabel(m){ if (!m) return "—"; const p = m.split("-"); return MONTHS[+p[1] - 1] + " " + p[0]; }
function monthShort(m){ const p = m.split("-"); return MONTHS[+p[1] - 1].slice(0, 3) + " " + String(p[0]).slice(2); }
function fmtDate(s){ const d = parseYMD(s); if (!d) return "—";
  return pad2(d.getDate()) + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); }
function addMonths(m, n){ const p = m.split("-"); const d = new Date(+p[0], +p[1] - 1 + n, 1);
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1); }
function round2(n){ return Math.round((+n || 0) * 100) / 100; }
function money(n){
  const v = round2(n), s = (Settings().currency || "₹");
  return (v < 0 ? "-" : "") + s + Math.abs(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
function num(n){ return (+n || 0).toLocaleString("en-IN"); }
function pct(a, b){ return b > 0 ? Math.round((a / b) * 100) : 0; }
function uid(prefix, list, pad, start){
  pad = pad || 3; let max = (start ? start - 1 : 0);
  /* only IDs of this form count (CLS0042), so fixed mark IDs such as IPL0012-20261012 never push the counter */
  const re = new RegExp("^" + prefix + "(\\d+)$");
  list.forEach(o => { const m = re.exec(String(o.id)); const n = m ? parseInt(m[1], 10) : NaN; if (!isNaN(n) && n > max) max = n; });
  return prefix + String(max + 1).padStart(pad, "0");
}
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
/* url-safe base64 — used for the teacher attendance links and return codes */
function b64e(str){ return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function b64d(str){
  str = String(str).trim().replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return decodeURIComponent(escape(atob(str)));
}

/* ==========================================================================
   STORAGE ADAPTER — the only place that touches localStorage
   ========================================================================== */
/* the admin link keeps its own copy on the device, never mixed with the office copy */
const STORE_KEY = (typeof window !== "undefined" && window.MQ_ADMIN) ? "mq_att_admin_v1" : "mq_academy_v1";
const Storage = {
  load(){ try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : null; }
          catch (e) { console.warn(e); return null; } },
  save(db){ try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); return true; }
            catch (e) { console.warn(e); return false; } }
};
let DB = {};
function persist(){
  Cache.clear();
  if (typeof SupaTrack !== "undefined") SupaTrack.schedule();
  if (typeof Sync !== "undefined" && Sync._hash) { Sync.stamp(); Sync.nudge(); }
  Storage.save(DB);
}
function Settings(){ return DB.settings || {}; }
/* this device's records as text, collection by collection — compared after a load to see what changed meanwhile */
function supaSnap(colls){
  const s = {};
  colls.forEach(function(c){
    if (c === "settings") return;
    const m = s[c] = {};
    (DB[c] || []).forEach(r => { if (r && r.id) m[String(r.id)] = JSON.stringify(r); });
  });
  return s;
}

/* ==========================================================================
   Supabase — the primary live database (the "bank").
   Every save writes here immediately so all devices share one truth.
   The Google Sheet keeps running as a readable backup mirror (see Sync).
   ========================================================================== */
const SUPA_TABLE = {
  students:"mq_students", teachers:"mq_teachers", batches:"mq_batches", subclasses:"mq_subclasses",
  enrollments:"mq_enrollments", attendance:"mq_attendance", plans:"mq_plans", classes:"mq_classes",
  fees:"mq_fees", payments:"mq_payments", refunds:"mq_refunds", income:"mq_income", expenses:"mq_expenses",
  teacherPayments:"mq_teacherpayments", teacherAdjust:"mq_teacheradjust", holidays:"mq_holidays",
  adjustments:"mq_adjustments", transfers:"mq_transfers", accounts:"mq_accounts", settings:"mq_settings",
  holds:"mq_holds"
};
/* the attendance-admin link loads only names, plans, the class log and holidays — never fees, payments or books */
const ADMIN_COLLS = ["students", "teachers", "plans", "classes", "holidays", "settings"];
const SUPA_COLLS = (typeof window !== "undefined" && window.MQ_ADMIN) ? ADMIN_COLLS.slice() : Object.keys(SUPA_TABLE);
/* records whose number is claimed in the database before they are saved there */
const CLAIM_COLLS = { students: { prefix: "MQ", pad: 4, start: 4150 }, teachers: { prefix: "MQ", pad: 4, start: 8086 }, plans: { prefix: "IPL", pad: 4 } };

const Supa = {
  client: null, claiming: {}, claimQueue: [],
  st: { ready:false, busy:false, at:0, err:"", pending:0 },

  on(){ const s = Settings(); return !!(s.supabaseOn && s.supabaseUrl && s.supabaseKey && window.supabase); },

  init(){
    if (!this.on()) { this.st.ready = false; return false; }
    try {
      const s = Settings();
      this.client = window.supabase.createClient(s.supabaseUrl, s.supabaseKey, { auth: { persistSession: false } });
      this.st.ready = true; this.st.err = "";
      return true;
    } catch (e) { this.st.ready = false; this.st.err = String(e.message || e); return false; }
  },

  /* every row of one table, page by page. Supabase sends at most its "Max rows" per request
     (1,000 by default), so one request would silently cut a big table short. Reads continue
     until an empty page comes back, so it works whatever that limit is set to. */
  async selectAll(table, cols){
    const out = []; let from = 0;
    for (let guard = 0; guard < 500; guard++) {
      const { data, error } = await this.client.from(table).select(cols || "id,data,deleted")
        .order("id", { ascending: true }).range(from, from + 999);
      if (error) throw new Error(error.message);
      const n = (data || []).length;
      if (!n) break;
      for (let i = 0; i < n; i++) out.push(data[i]);
      from += n;
    }
    return out;
  },

  /* bring in what other devices saved since this page loaded, without losing this device's unsent changes.
     A record changed here and not yet sent stays as it is here; everything else takes the database copy. */
  async refresh(colls){
    if (!this.on() || (!this.st.ready && !this.init())) return { ok: false, changed: 0 };
    if (SupaTrack.busy || !SupaTrack.base) return { ok: false, changed: 0 };
    let changed = 0;
    /* v8: what was waiting to send when the read began, and this device's copy at that moment. The read can come back
       older than a save that finished while it was on its way (the save marks the record as sent, but the rows read
       still hold the old version) — anything pending at the start, or changed since, keeps this device's copy. */
    const snap0 = supaSnap(colls), pend0 = {};
    colls.forEach(function(c){
      if (c === "settings") return;
      const base = SupaTrack.base[c] || {}, s = snap0[c] || {}, p = pend0[c] = {};
      Object.keys(s).forEach(id => { if (base[id] !== s[id]) p[id] = 1; });
      Object.keys(base).forEach(id => { if (s[id] === undefined) p[id] = 1; });
    });
    try {
      const got = await Promise.all(colls.map(c => this.selectAll(SUPA_TABLE[c])));
      if (SupaTrack.busy) return { ok: false, changed: 0 };
      colls.forEach((c, ci) => {
        const rows = got[ci];
        if (c === "settings") {
          rows.forEach(r => { if (r.deleted) return; const v = r.data && r.data.value !== undefined ? r.data.value : r.data;
            if (JSON.stringify(DB.settings[r.id]) !== JSON.stringify(v)) { DB.settings[r.id] = v; changed++; } });
          return;
        }
        const base = SupaTrack.base[c] = SupaTrack.base[c] || {};
        const local = {}; (DB[c] || []).forEach(r => { if (r && r.id) local[String(r.id)] = r; });
        const s0 = snap0[c] || {}, p0 = pend0[c] || {};
        const pending = id => p0[id] ||
          (local[id] ? s0[id] !== JSON.stringify(local[id]) : s0[id] !== undefined) ||
          (local[id] && base[id] !== JSON.stringify(local[id])) || (!local[id] && base[id] !== undefined) || Supa.claiming[c + "|" + id];
        const next = [], seen = {};
        rows.forEach(function(r){
          const id = String(r.id); seen[id] = true;
          if (pending(id)) { if (local[id]) next.push(local[id]); return; }
          if (r.deleted) { if (local[id]) changed++; delete base[id]; return; }
          const rec = Object.assign({ id: id }, r.data), sig = JSON.stringify(rec);
          if (!local[id] || JSON.stringify(local[id]) !== sig) changed++;
          next.push(rec); base[id] = sig;
        });
        Object.keys(local).forEach(id => { if (!seen[id]) { if (pending(id)) next.push(local[id]); else { changed++; delete base[id]; } } });
        DB[c] = next;
      });
      if (changed) { Cache.clear(); Storage.save(DB); }
      this.st.at = Date.now();
      this.retryClaims();
      return { ok: true, changed: changed };
    } catch (e) { this.st.err = String(e.message || e); return { ok: false, changed: 0, error: this.st.err }; }
  },
  /* highest number of this form already in the database table */
  async maxId(table, prefix){
    const { data, error } = await this.client.from(table).select("id").like("id", prefix + "%").order("id", { ascending: false }).limit(300);
    if (error) throw new Error(error.message);
    const re = new RegExp("^" + prefix + "(\\d+)$");
    return (data || []).reduce((m, r) => { const x = re.exec(String(r.id)); return x ? Math.max(m, +x[1]) : m; }, 0);
  },
  /* a new student / teacher / plan is INSERTED (never upserted): if another device already took the
     number, the insert fails and the next free number is used — the record and everything pointing at it are renamed */
  async claimNew(coll, rec){
    const cfg = CLAIM_COLLS[coll], table = SUPA_TABLE[coll];
    const first = rec.id; let id = rec.id;
    this.claiming[coll + "|" + first] = true;
    try {
      for (let tries = 0; tries < 25; tries++) {
        const cur = (DB[coll] || []).find(r => r.id === first) || rec;
        const { error } = await this.client.from(table).insert({ id: id, data: Object.assign({}, cur, { id: id }), deleted: false });
        if (!error) break;
        const dup = error.code === "23505" || /duplicate key/i.test(error.message || "");
        if (!dup) throw new Error(error.message || "insert failed");
        const localMax = parseInt(uid(cfg.prefix, DB[coll] || [], cfg.pad, cfg.start).slice(cfg.prefix.length), 10) - 1;
        const remoteMax = await this.maxId(table, cfg.prefix);
        id = cfg.prefix + String(Math.max(localMax, remoteMax, cfg.start ? cfg.start - 1 : 0) + 1 + tries).padStart(cfg.pad, "0");
      }
      delete this.claiming[coll + "|" + first];
      if (id !== first) {
        renameId(coll, first, id);
        if (typeof toast === "function") toast(first + " was just taken on another device — saved as " + id, "warn", 6000);
        if (typeof render === "function") try { render(); } catch (e) {}
      }
      const saved = (DB[coll] || []).find(r => r.id === id);
      if (saved) SupaTrack.mark(coll, saved);
      this.st.at = Date.now(); this.paint("ok", "saved");
    } catch (e) {
      /* offline or refused: keep it out of the normal push and try again later */
      if (!this.claimQueue.some(q => q.coll === coll && q.id === first)) this.claimQueue.push({ coll: coll, id: first });
      this.st.err = String(e.message || e); this.paint("err", "waiting to save " + first);
    }
  },
  retryClaims(){
    const q = this.claimQueue.splice(0);
    q.forEach(it => { const r = (DB[it.coll] || []).find(x => x.id === it.id); if (r) { delete this.claiming[it.coll + "|" + it.id]; this.claimNew(it.coll, r); } });
  },

  /* pull EVERY row from EVERY table into the in-memory DB (source of truth on load) */
  async pullAll(){
    if (!this.st.ready && !this.init()) return { ok:false, error:"Supabase not configured" };
    this.st.busy = true; this.paint("busy", "loading from Supabase…");
    /* v8: this device's copy as the load starts — anything saved, added or removed while the tables are on their way
       is kept as it is here (and sent), instead of being replaced by the older rows the load brings back */
    const before = supaSnap(SUPA_COLLS), kept = {};
    try {
      /* all tables at once (was one after another); applied only when every table arrived */
      const res = await Promise.all(SUPA_COLLS.map(c => this.selectAll(SUPA_TABLE[c])
        .then(data => ({ data: data }), e => ({ error: { message: String(e.message || e) } }))));
      res.forEach((r, i) => { if (r.error) throw new Error(SUPA_COLLS[i] + ": " + r.error.message); });
      SUPA_COLLS.forEach((c, i) => {
        const data = res[i].data;
        if (c === "settings") {
          const patch = {};
          (data || []).forEach(r => { if (!r.deleted) patch[r.id] = r.data && r.data.value !== undefined ? r.data.value : r.data; });
          DB.settings = Object.assign({}, DB.settings, patch);
        } else {
          const server = (data || []).filter(r => !r.deleted).map(r => Object.assign({ id: r.id }, r.data));
          const b = before[c] || {}, now = {}, keep = {};
          (DB[c] || []).forEach(r => { if (r && r.id) now[String(r.id)] = r; });
          Object.keys(now).forEach(id => { if (b[id] !== JSON.stringify(now[id])) keep[id] = now[id]; });
          Object.keys(b).forEach(id => { if (!now[id]) keep[id] = null; });
          const ids = Object.keys(keep);
          if (!ids.length) { DB[c] = server; return; }
          const srv = {}; server.forEach(r => srv[String(r.id)] = JSON.stringify(r));
          DB[c] = server.filter(r => keep[String(r.id)] === undefined).concat(ids.filter(id => keep[id]).map(id => keep[id]));
          kept[c] = { ids: ids, srv: srv };
        }
      });
      Cache.clear(); Storage.save(DB);
      SupaTrack.reset();
      /* the kept records are marked against what the database holds, so the tracker sends them */
      let nKept = 0;
      Object.keys(kept).forEach(function(c){
        const base = SupaTrack.base[c] = SupaTrack.base[c] || {};
        kept[c].ids.forEach(id => { nKept++; if (kept[c].srv[id] !== undefined) base[id] = kept[c].srv[id]; else delete base[id]; });
      });
      if (nKept) SupaTrack.schedule();
      this.st.at = Date.now(); this.paint("ok", "loaded from Supabase");
      return { ok:true };
    } catch (e) {
      this.st.err = String(e.message || e); this.paint("err", this.st.err);
      return { ok:false, error: this.st.err };
    } finally { this.st.busy = false; }
  },

  /* upsert a single record live. coll = collection name, rec = the object (must have id) */
  async put(coll, rec){
    if (!this.on()) return;
    if (!this.st.ready && !this.init()) return;
    const table = SUPA_TABLE[coll]; if (!table || !rec || !rec.id) return;
    try {
      const row = { id: String(rec.id), data: rec, deleted: !!rec._d };
      const { error } = await this.client.from(table).upsert(row, { onConflict: "id" });
      if (error) throw new Error(error.message);
      SupaTrack.mark(coll, rec);
      this.st.at = Date.now(); this.paint("ok", "saved");
    } catch (e) {
      this.st.pending++; this.st.err = String(e.message || e); this.paint("err", this.st.err);
    }
  },

  /* push EVERYTHING currently in the app up to Supabase (clean upload / migration) */
  async pushAll(onProgress){
    if (!this.st.ready && !this.init()) return { ok:false, error:"Supabase not configured" };
    this.st.busy = true;
    let total = 0;
    try {
      for (let i = 0; i < SUPA_COLLS.length; i++) {
        const c = SUPA_COLLS[i];
        if (onProgress) onProgress(i, SUPA_COLLS.length, c);
        if (c === "settings") {
          const st = DB.settings || {};
          const rows = Object.keys(st).map(k => ({ id: k, data: { value: st[k] }, deleted: false }));
          if (rows.length) { const { error } = await this.client.from("mq_settings").upsert(rows, { onConflict: "id" }); if (error) throw new Error("settings: " + error.message); total += rows.length; }
        } else {
          const list = (DB[c] || []).filter(x => x && x.id);
          if (list.length) {
            const rows = list.map(x => ({ id: String(x.id), data: x, deleted: !!x._d }));
            /* chunk to keep requests small */
            for (let j = 0; j < rows.length; j += 200) {
              const chunk = rows.slice(j, j + 200);
              const { error } = await this.client.from(SUPA_TABLE[c]).upsert(chunk, { onConflict: "id" });
              if (error) throw new Error(c + ": " + error.message);
              total += chunk.length;
            }
          }
        }
      }
      this.st.at = Date.now();
      return { ok:true, count: total };
    } catch (e) {
      return { ok:false, error: String(e.message || e) };
    } finally { this.st.busy = false; }
  },

  /* settings are key/value: store each key as its own row */
  async putSetting(key, value){
    if (!this.on()) return;
    if (!this.st.ready && !this.init()) return;
    try {
      const { error } = await this.client.from("mq_settings").upsert({ id: key, data: { value: value }, deleted: false }, { onConflict: "id" });
      if (error) throw new Error(error.message);
    } catch (e) { this.st.pending++; this.paint("err", String(e.message || e)); }
  },

  paint(kind, msg){
    /* keep the message: a tooltip cannot be read on a phone, so the sync panel shows it */
    this.st.kind = kind; this.st.msg = msg || ""; this.st.msgAt = Date.now();
    if (kind === "err") { this.st.err = msg || ""; this.st.errAt = Date.now(); }
    const chip = document.getElementById("syncChip"); if (!chip) return;
    /* Supabase drives the chip now; the sheet mirror runs quietly behind it */
    chip.className = "syncchip " + (kind === "ok" ? "ok" : kind === "busy" ? "busy" : kind === "err" ? "err" : "off");
    const label = kind === "ok" ? "Saved" : kind === "busy" ? (/^loading/.test(msg || "") ? "Updating…" : "Saving…") : kind === "err" ? "Save problem" : "Not connected";
    chip.innerHTML = "<i></i>" + label;
    chip.title = msg || "";
  }
};


/* ---- change tracker ----
   Many saves (payments, refunds, teacher payments, payroll adjustments, monthly fee builds,
   reconciliation) write straight into DB and never called Supa.put, so they lived only on the
   device and vanished at the next Supabase load. After every persist() this compares each record
   with what Supabase last held and sends only what changed (and marks removed records deleted).
   It starts only after a successful load from Supabase, so a stale device copy is never pushed. */
const SupaTrack = {
  base: null, timer: 0, busy: false, again: false,
  reset(){
    const b = {};
    SUPA_COLLS.forEach(function(c){
      if (c === "settings") return;
      const m = b[c] = {};
      (DB[c] || []).forEach(r => { if (r && r.id) m[r.id] = JSON.stringify(r); });
    });
    this.base = b;
  },
  mark(c, rec){
    if (!this.base || !this.base[c] || !rec || !rec.id) return;
    if (rec._d) delete this.base[c][rec.id]; else this.base[c][rec.id] = JSON.stringify(rec);
  },
  schedule(){
    if (!this.base) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 600);
  },
  async flush(){
    if (!this.base || typeof Supa === "undefined" || !Supa.on() || (!Supa.st.ready && !Supa.init())) return;
    if (this.busy) { this.again = true; return; }
    this.busy = true;
    try {
      for (const c of SUPA_COLLS) {
        if (c === "settings") continue;
        const base = this.base[c] = this.base[c] || {}, seen = {}, rows = [], sigs = {};
        (DB[c] || []).forEach(function(r){
          if (!r || !r.id) return;
          const id = String(r.id), sig = JSON.stringify(r);
          seen[id] = true;
          if (Supa.claiming[c + "|" + id]) return;   /* a new record still claiming its number */
          if (base[id] !== sig) { rows.push({ id: id, data: r, deleted: false }); sigs[id] = sig; }
        });
        Object.keys(base).forEach(function(id){
          if (!seen[id]) rows.push({ id: id, data: JSON.parse(base[id]), deleted: true });
        });
        for (let j = 0; j < rows.length; j += 200) {
          const chunk = rows.slice(j, j + 200);
          const { error } = await Supa.client.from(SUPA_TABLE[c]).upsert(chunk, { onConflict: "id" });
          if (error) throw new Error(c + ": " + error.message);
          chunk.forEach(r => { if (r.deleted) delete base[r.id]; else base[r.id] = sigs[r.id]; });
        }
      }
      Supa.st.at = Date.now(); Supa.paint("ok", "saved");
    } catch (e) {
      Supa.st.err = String(e.message || e); Supa.paint("err", Supa.st.err);  /* kept as changed — retried on the next save */
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.schedule(); }
    }
  }
};

/* Derived data is cached and dropped on every write, so nothing can go stale. */
const Cache = {
  _p: null, _pLen: -1, _l: null, _c: null, _cRef: null, _cLen: -1,
  clear(){ Cache._p = null; Cache._pLen = -1; Cache._l = null; Cache._c = null; },
  /* plan + date → class record, so the attendance sheet does not search the whole log for every cell */
  classIndex(){
    if (Cache._c === null || Cache._cRef !== DB.classes || Cache._cLen !== DB.classes.length) {
      const idx = {};
      DB.classes.forEach(c => { const k = c.planId + "|" + c.date; if (!idx[k]) idx[k] = c; });
      Cache._c = idx; Cache._cRef = DB.classes; Cache._cLen = DB.classes.length;
    }
    return Cache._c;
  },
  paymentsFor(feeId){
    if (Cache._p === null || Cache._pLen !== DB.payments.length) {
      const idx = {};
      DB.payments.forEach(p => { if (!p.voided) (idx[p.feeId] = idx[p.feeId] || []).push(p); });
      Cache._p = idx; Cache._pLen = DB.payments.length;
    }
    return Cache._p[feeId] || [];
  }
};

/* ==========================================================================
   SYNC — local first, Google Sheets second
   ---------------------------------------------------------------------------
   Nothing on screen ever waits for the network. Every change is written to
   this browser immediately; a moment later it is pushed to the two sheets.
   Records carry _u (last changed, ms). Newest _u wins on both sides, so the
   same record can be edited here and in the sheet without corrupting either.
   ========================================================================== */
const SYNC_COLLS = ["students","teachers","batches","subclasses","enrollments","attendance","holidays","holds",
  "plans","classes","fees","payments","refunds","income","expenses","teacherPayments","teacherAdjust",
  "adjustments","transfers","accounts"];

const Sync = {
  st: { status: "off", msg: "", lastPull: 0, lastPushAt: 0, pending: 0, busy: false, at: 0 },
  _hash: null, _timer: null, _tick: null,

  on(){ return !!Settings().apiUrl; },  /* always sync when a URL is set */
  load(){
    try {
      const raw = localStorage.getItem(STORE_KEY + "_sync");
      if (raw) Object.assign(Sync.st, JSON.parse(raw));
    } catch (e) {}
    Sync.st.busy = false;
  },
  save(){
    try {
      localStorage.setItem(STORE_KEY + "_sync", JSON.stringify({
        lastPull: Sync.st.lastPull, lastPushAt: Sync.st.lastPushAt })); 
    } catch (e) {}
  },

  /* --- change detection: diff every record against the last known copy --- */
  snapshot(){
    const h = {};
    SYNC_COLLS.forEach(function(c){
      h[c] = {};
      (DB[c] || []).forEach(function(r){ if (r && r.id) h[c][r.id] = Sync.body(r); });
    });
    h.settings = Sync.body(DB.settings || {});
    Sync._hash = h;
  },
  body(r){
    const o = {};
    Object.keys(r).forEach(function(k){ if (k !== "_u" && k !== "_d") o[k] = r[k]; });
    return JSON.stringify(o);
  },
  /* called on every write: stamp what changed, remember what vanished */
  stamp(){
    if (!Sync._hash) { Sync.snapshot(); return 0; }
    const now = Date.now();
    let n = 0;
    DB._tomb = DB._tomb || [];
    SYNC_COLLS.forEach(function(c){
      const prev = Sync._hash[c] || {}, seen = {};
      (DB[c] || []).forEach(function(r){
        if (!r || !r.id) return;
        seen[r.id] = true;
        const b = Sync.body(r);
        if (prev[r.id] !== b) { r._u = now; prev[r.id] = b; n++; }
      });
      Object.keys(prev).forEach(function(id){
        if (seen[id]) return;
        delete prev[id];
        DB._tomb.push({ c: c, id: id, _u: now });
        n++;
      });
      Sync._hash[c] = prev;
    });
    const sb = Sync.body(DB.settings || {});
    if (Sync._hash.settings !== sb) { Sync._hash.settings = sb; DB._settingsU = now; n++; }
    if (n) Sync.st.pending += n;
    return n;
  },

  /* --- what still needs to go up --- */
  outbox(){
    const since = Sync.st.lastPushAt || 0;
    const changes = {};
    let newest = since;
    SYNC_COLLS.forEach(function(c){
      const rows = (DB[c] || []).filter(r => r && r.id && (+r._u || 0) > since);
      if (rows.length) changes[c] = rows;
      rows.forEach(r => { if (+r._u > newest) newest = +r._u; });
    });
    if ((+DB._settingsU || 0) > since) {
      changes.settings = Object.keys(DB.settings || {}).map(k => ({
        id: k, value: typeof DB.settings[k] === "object" ? JSON.stringify(DB.settings[k]) : DB.settings[k],
        _u: DB._settingsU }));
      if (+DB._settingsU > newest) newest = +DB._settingsU;
    }
    const tombs = (DB._tomb || []).filter(t => (+t._u || 0) > since);
    tombs.forEach(t => { if (+t._u > newest) newest = +t._u; });
    return { changes: changes, tombstones: tombs, newest: newest,
      count: Object.keys(changes).reduce((a, k) => a + changes[k].length, 0) + tombs.length };
  },

  /* --- transport: POST for pushing, JSONP for pulling (no CORS surprises) --- */
  post(payload){
    return fetch(Settings().apiUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload) }).then(r => r.json());
  },
  jsonp(params){
    return new Promise(function(resolve, reject){
      const cb = "mqcb" + Date.now() + Math.floor(Math.random() * 1000);
      const url = Settings().apiUrl + (Settings().apiUrl.indexOf("?") < 0 ? "?" : "&") +
        Object.keys(params).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(params[k])).join("&") +
        "&callback=" + cb;
      const sc = document.createElement("script");
      const done = function(v, err){
        delete window[cb]; sc.remove();
        clearTimeout(to);
        err ? reject(err) : resolve(v);
      };
      const to = setTimeout(() => done(null, new Error("timed out")), 25000);
      window[cb] = v => done(v);
      sc.onerror = () => done(null, new Error("could not reach the sheet"));
      sc.src = url;
      document.body.appendChild(sc);
    });
  },

  async pushNow(silent){
    if (!Sync.on() || Sync.st.busy) return;
    const box = Sync.outbox();
    if (!box.count) { Sync.st.pending = 0; Sync.mark("ok", "nothing new to send"); return; }
    Sync.st.busy = true; Sync.mark("busy", "sending " + box.count + " change(s)…");
    try {
      const r = await Sync.post({ action: "push", key: Settings().syncKey, changes: box.changes, tombstones: box.tombstones });
      if (!r || !r.ok) throw new Error((r && r.error) || "the sheet refused the data");
      Sync.st.lastPushAt = box.newest;
      DB._tomb = (DB._tomb || []).filter(t => (+t._u || 0) > box.newest);
      Sync.st.pending = 0; Sync.st.at = Date.now();
      Sync.save();
      Sync.mark("ok", r.written + " row(s) written to the sheets");
      if (!silent) toast("Synced — " + r.written + " row(s) written", "ok");
    } catch (e) {
      Sync.mark("err", String(e.message || e));
      if (!silent) toast("Could not sync: " + (e.message || e), "bad", 5000);
    } finally { Sync.st.busy = false; Sync.paint(); }
  },

  mark(status, msg){ Sync.st.status = status; Sync.st.msg = msg || ""; Sync.paint(); },
  /* The chip belongs to Supabase (where the records live). The Sheet backup reports only in the panel,
     so a slow or failing backup can no longer make the chip say "Sync problem". */
  paint(){
    const el = null;
    if (!el) return;
    if (!Sync.on()) { el.className = "syncchip off"; el.innerHTML = '<i></i>Sync off'; return; }
    const ago = Sync.st.at ? Math.round((Date.now() - Sync.st.at) / 60000) : null;
    const label = Sync.st.status === "busy" ? "Syncing…"
      : Sync.st.status === "err" ? "Sync problem"
      : Sync.st.pending ? Sync.st.pending + " to send"
      : (ago === null ? "Synced" : ago < 1 ? "Synced just now" : "Synced " + ago + "m ago");
    el.className = "syncchip " + (Sync.st.status === "err" ? "err" : Sync.st.status === "busy" ? "busy" : "ok");
    el.innerHTML = '<i></i>' + esc(label);
  },
  /* a write happened: push shortly after the user stops typing */
  nudge(){
    if (!Sync.on()) { Sync.paint(); return; }
    clearTimeout(Sync._timer);
    Sync._timer = setTimeout(() => Sync.pushNow(true), 4000);
    Sync.paint();
  },
  start(){
    Sync.load(); Sync.snapshot(); Sync.paint();
    if (!Sync.on()) return;
    /* Sheets is a one-way backup: changes are sent automatically, nothing is ever read back */
    clearInterval(Sync._tick);
    Sync._tick = setInterval(function(){
      Sync.pushNow(true);
    }, Math.max(1, +Settings().syncEvery || 3) * 60000);
  }
};

/* ==========================================================================
   DATA SERVICE — every read and write goes through here
   ========================================================================== */
function coll(name){ return DB[name] || (DB[name] = []); }
function upsert(name, obj, prefix, pad, start){
  const list = coll(name);
  const isNew = !obj.id;
  if (!obj.id) obj.id = uid(prefix, list, pad, start);
  const online = typeof Supa !== "undefined" && Supa.on() && SUPA_TABLE[name];
  const claim = isNew && online && CLAIM_COLLS[name];
  if (claim) Supa.claiming[name + "|" + obj.id] = true;
  const i = list.findIndex(x => x.id === obj.id);
  if (i >= 0) list[i] = Object.assign({}, list[i], obj); else list.push(obj);
  persist();
  /* live write to Supabase (the primary bank); the sheet mirror runs via Sync */
  const rec = list[i >= 0 ? i : list.length - 1];
  if (claim) Supa.claimNew(name, rec);
  else if (online) Supa.put(name, rec);
  return obj.id;
}
/* give a record a new ID and repoint everything that refers to it */
function renameId(collName, from, to){
  const rec = (DB[collName] || []).find(r => r.id === from);
  if (rec) rec.id = to;
  const fields = { students: ["studentId"], teachers: ["teacherId", "takenBy"], plans: ["planId"] }[collName] || [];
  Object.keys(SUPA_TABLE).forEach(function(c){
    if (c === "settings" || !Array.isArray(DB[c])) return;
    DB[c].forEach(function(r){ fields.forEach(f => { if (r[f] === from) r[f] = to; }); });
  });
  /* a mark's fixed ID carries its plan ID */
  if (collName === "plans") (DB.classes || []).forEach(c => { if (String(c.id).indexOf(from + "-") === 0) c.id = to + String(c.id).slice(from.length); });
  persist();
}
/* remove-from-store also needs to reach Supabase as a soft delete */
function removeRow(name, id){
  const list = coll(name); const i = list.findIndex(x => x.id === id);
  if (i < 0) return;
  const rec = list[i]; list.splice(i, 1); persist();
  if (typeof Supa !== "undefined" && Supa.on() && SUPA_TABLE[name]) Supa.put(name, Object.assign({}, rec, { _d: true }));
}
const DataService = {
  /* --- shared people --- */
  getStudents(){ return DB.students.slice(); },
  getStudent(id){ return DB.students.find(s => s.id === id) || null; },
  saveStudent(s){ return upsert("students", s, "MQ", 4, 4150); },
  getTeachers(){ return DB.teachers.slice(); },
  getTeacher(id){ return DB.teachers.find(t => t.id === id) || null; },
  saveTeacher(t){ return upsert("teachers", t, "MQ", 4, 8086); },

  /* --- batch stream --- */
  getBatches(){ return DB.batches.slice(); },
  getBatch(id){ return DB.batches.find(b => b.id === id) || null; },
  saveBatch(b){ return upsert("batches", b, "B"); },
  /* --- sub-classes: smaller groups inside a batch --- */
  getSubclasses(f){
    let r = (DB.subclasses || []).slice();
    if (!f) return r;
    if (f.batchId)   r = r.filter(x => x.batchId === f.batchId);
    if (f.teacherId) r = r.filter(x => x.teacherId === f.teacherId);
    if (f.status)    r = r.filter(x => x.status === f.status);
    return r;
  },
  getSubclass(id){ return (DB.subclasses || []).find(x => x.id === id) || null; },
  saveSubclass(x){ return upsert("subclasses", x, "SUB"); },

  getEnrollments(f){
    let r = DB.enrollments.slice();
    if (!f) return r;
    if (f.studentId) r = r.filter(e => e.studentId === f.studentId);
    if (f.batchId)   r = r.filter(e => e.batchId === f.batchId);
    if (f.subClassId) r = r.filter(e => e.subClassId === f.subClassId);
    if (f.status)    r = r.filter(e => e.status === f.status);
    return r;
  },
  getActiveEnrollment(studentId){ return DB.enrollments.find(e => e.studentId === studentId && e.status === "Active") || null; },
  saveEnrollment(e){ return upsert("enrollments", e, "ENR"); },
  closeEnrollment(id, status, date, reason){
    const e = DB.enrollments.find(x => x.id === id); if (!e) return false;
    e.status = status || "Left"; e.leavingDate = date || today(); e.reason = reason || "";
    persist(); return true;
  },
  getAttendance(f){
    let r = DB.attendance.slice();
    if (!f) return r;
    if (f.date)      r = r.filter(a => a.date === f.date);
    if (f.batchId)   r = r.filter(a => a.batchId === f.batchId);
    if (f.studentId) r = r.filter(a => a.studentId === f.studentId);
    if (f.month)     r = r.filter(a => a.month === f.month);
    if (f.teacherId) r = r.filter(a => a.teacherId === f.teacherId);
    if (f.subClassId) r = r.filter(a => a.subClassId === f.subClassId);
    return r;
  },
  saveAttendance(date, batchId, teacherId, marks, opts){
    opts = opts || {};
    let created = 0, updated = 0;
    Object.keys(marks).forEach(function(sid){
      /* the group a student sits in decides who gets credited for the session */
      const en = DataService.getEnrollments({ studentId: sid }).find(e => e.batchId === batchId && e.status === "Active")
              || DataService.getEnrollments({ studentId: sid })[0] || {};
      const subId = opts.subClassId || en.subClassId || "";
      const sub = subId ? DataService.getSubclass(subId) : null;
      const tid = (sub && sub.teacherId) || teacherId;
      const found = DB.attendance.find(a => a.date === date && a.batchId === batchId && a.studentId === sid);
      if (found) {
        found.status = marks[sid].status; found.remarks = marks[sid].remarks || "";
        found.subClassId = subId; found.teacherId = tid;
        if (opts.source) found.source = opts.source;
        updated++;
      } else {
        DB.attendance.push({ id: uid("ATT", DB.attendance, 5), date: date, month: monthOf(date), batchId: batchId,
          subClassId: subId, studentId: sid, teacherId: tid, status: marks[sid].status,
          remarks: marks[sid].remarks || "", source: opts.source || "admin", markedAt: new Date().toISOString() });
        created++;
      }
    });
    persist(); return { created: created, updated: updated };
  },

  /* --- individual stream --- */
  getPlans(f){
    let r = DB.plans.slice();
    if (!f) return r;
    if (f.studentId) r = r.filter(p => p.studentId === f.studentId);
    if (f.teacherId) r = r.filter(p => p.teacherId === f.teacherId);
    if (f.status)    r = r.filter(p => p.status === f.status);
    return r;
  },
  getPlan(id){ return DB.plans.find(p => p.id === id) || null; },
  getActivePlan(studentId){ return DB.plans.find(p => p.studentId === studentId && p.status === "Active") || null; },
  savePlan(p){ return upsert("plans", p, "IPL", 4); },
  /* note-only marks (status "Note") never reach fees or pay: only the attendance sheet asks for them */
  getClasses(f){
    let r = DB.classes.filter(c => c.status !== "Note" || (f && f.notes));
    if (!f) return r;
    if (f.studentId) r = r.filter(c => c.studentId === f.studentId);
    if (f.teacherId) r = r.filter(c => c.teacherId === f.teacherId);
    if (f.planId)    r = r.filter(c => c.planId === f.planId);
    if (f.month)     r = r.filter(c => monthOf(c.date) === f.month);
    if (f.date)      r = r.filter(c => c.date === f.date);
    return r;
  },
  /* a mark's fixed ID: the same plan on the same day is always the same record, from any device */
  classKey(planId, date){ return String(planId) + "-" + String(date).replace(/-/g, ""); },
  classAt(planId, date){ return Cache.classIndex()[planId + "|" + date] || null; },
  saveClass(c){
    if (!c.id && c.planId && c.date) {
      const k = DataService.classKey(c.planId, c.date);
      if (!DB.classes.some(x => x.id === k)) c.id = k;
    }
    return upsert("classes", c, "CLS", 4);
  },
  deleteClass(id){ DB.classes = DB.classes.filter(c => c.id !== id); persist(); },

  /* --- fees (both streams live in one table, tagged by source) --- */
  getFees(f){
    let r = DB.fees.slice();
    if (!f) return r;
    if (f.source)    r = r.filter(x => x.source === f.source);
    if (f.month)     r = r.filter(x => x.month === f.month);
    if (f.studentId) r = r.filter(x => x.studentId === f.studentId);
    if (f.batchId)   r = r.filter(x => x.batchId === f.batchId);
    if (f.teacherId) r = r.filter(x => x.teacherId === f.teacherId);
    if (f.planId)    r = r.filter(x => x.planId === f.planId);   /* v8: was ignored, so a plan's fees meant every fee */
    return r;
  },
  getFee(id){ return DB.fees.find(f => f.id === id) || null; },
  saveFee(f){ return upsert("fees", f, "FEE", 5); },
  getHolds(filter){ let l = DB.holds.slice(); if (filter && filter.studentId) l = l.filter(h => h.studentId === filter.studentId); return l; },
  saveHold(h){ return upsert("holds", h, "HOLD", 4); },
  removeHold(id){ removeRow("holds", id); },
  /* is a student (or the whole academy) on hold for a given YYYY-MM month? returns the hold or null */
  holdFor(studentId, month){
    const acad = (Settings().academyHolds || []).find(h => month >= h.from && month <= h.to);
    if (acad) return Object.assign({ scope: "academy" }, acad);
    const h = DB.holds.find(h => h.studentId === studentId && month >= (h.from||"") && month <= (h.to||"9999-99"));
    return h ? Object.assign({ scope: "student" }, h) : null;
  },

  /* --- money --- */
  /* voided payments stay on record but are left out of balances, dues, income and accounts —
     ask for them explicitly with { voided: true } (only the voided ones) */
  getPayments(f){
    let r = DB.payments.filter(p => (f && f.voided) ? !!p.voided : !p.voided);
    if (!f) return r;
    if (f.studentId) r = r.filter(p => p.studentId === f.studentId);
    if (f.feeId)     r = r.filter(p => p.feeId === f.feeId);
    if (f.month)     r = r.filter(p => p.month === f.month);
    if (f.source)    r = r.filter(p => p.source === f.source);
    return r;
  },
  savePayment(p){ p.id = uid("PAY", DB.payments, 5); p.createdAt = new Date().toISOString(); DB.payments.push(p); persist(); return p.id; },
  getRefunds(){ return DB.refunds.slice(); },
  saveRefund(r){ r.id = uid("REF", DB.refunds); DB.refunds.push(r); persist(); return r.id; },
  getIncome(){ return DB.income.slice(); },
  saveIncome(x){ return upsert("income", x, "INC"); },
  getExpenses(){ return DB.expenses.slice(); },
  saveExpense(x){ return upsert("expenses", x, "EXP"); },
  getTeacherPayments(f){
    let r = DB.teacherPayments.filter(p => (f && f.voided) ? !!p.voided : !p.voided);
    if (!f) return r;
    if (f.teacherId) r = r.filter(p => p.teacherId === f.teacherId);
    if (f.month)     r = r.filter(p => p.month === f.month);
    return r;
  },
  saveTeacherPayment(p){ p.id = uid("TPY", DB.teacherPayments); DB.teacherPayments.push(p); persist(); return p.id; },
  /* a payment entered by mistake: marked void with a reason, never removed, IDs never reused */
  voidPayment(id, reason){
    const p = DB.payments.find(x => x.id === id); if (!p || p.voided) return null;
    p.voided = true; p.voidReason = reason || ""; p.voidAt = new Date().toISOString(); persist(); return p;
  },
  voidTeacherPayment(id, reason){
    const p = DB.teacherPayments.find(x => x.id === id); if (!p || p.voided) return null;
    p.voided = true; p.voidReason = reason || ""; p.voidAt = new Date().toISOString(); persist(); return p;
  },
  getAdjust(teacherId, month){ return DB.teacherAdjust.find(a => a.teacherId === teacherId && a.month === month) || null; },
  saveAdjust(a){
    const f = DB.teacherAdjust.find(x => x.teacherId === a.teacherId && x.month === a.month);
    if (f) Object.assign(f, a); else { a.id = uid("TADJ", DB.teacherAdjust); DB.teacherAdjust.push(a); }
    persist();
  },
  /* --- holidays --- */
  getHolidays(){ return (DB.holidays || []).slice().sort((a, b) => a.from < b.from ? -1 : 1); },
  saveHoliday(h){ return upsert("holidays", h, "HOL"); },
  deleteHoliday(id){ DB.holidays = (DB.holidays || []).filter(h => h.id !== id); persist(); },

  /* --- prepaid carry-forward adjustments --- */
  getAdjustments(f){
    let r = (DB.adjustments || []).slice();
    if (!f) return r;
    if (f.planId) r = r.filter(a => a.planId === f.planId);
    if (f.pending) r = r.filter(a => !a.appliedFeeId);
    return r;
  },

  getAccounts(){ return DB.accounts.slice(); },
  saveAccount(a){ const i = DB.accounts.findIndex(x => x.id === a.id);
    if (i >= 0) DB.accounts[i] = Object.assign({}, DB.accounts[i], a); else DB.accounts.push(a); persist(); },
  getTransfers(){ return DB.transfers.slice(); },
  saveTransfer(t){ t.id = uid("TRF", DB.transfers); DB.transfers.push(t); persist(); return t.id; },

  saveSettings(patch){
    DB.settings = Object.assign({}, DB.settings, patch); persist();
    if (typeof Supa !== "undefined" && Supa.on()) { Object.keys(patch).forEach(k => Supa.putSetting(k, patch[k])); }
  },
  exportAll(){ return JSON.parse(JSON.stringify(DB)); },
  importAll(o){ DB = o; persist(); }
};


/* ---- Sheet lock: anything that reads FROM Google Sheets asks for the password first ---- */
const SHEET_LOCK_PW = "manzil786";
