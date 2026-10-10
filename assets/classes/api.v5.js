/* =================================================================
   ManzilulQuran — CLASS SYSTEM API  v5
   -----------------------------------------------------------------
   Every call to the backend goes through this file. Nothing else in
   the system builds a URL, picks a method, or knows the word
   "action".

   v5 — STAGE 4. SUPABASE IS THE BACKEND.
   ---------------------------------------
   Every admin read and save now goes to <prefix>admin in Supabase,
   with the SAME action names and bodies the pages always sent, so the
   pages' logic does not change. The admin signs in with a Supabase
   account (e-mail + password); the old admin password does nothing.

   Student pages: class sheet, batch page and batch sign-in go to
   Supabase as in v3/v4.

   APPS SCRIPT IS USED ONLY IF A PAGE STILL SETS window.MQ_SCRIPT_URL.
   A page with no MQ_SCRIPT_URL never falls back: a reset link stays
   dead and nothing is ever read from the retired Sheet.

   CONFIGURATION, set by each page before this file loads:
     window.MQ_SUPABASE_URL     https://uuwboujrotmmpofjynhz.supabase.co
     window.MQ_SUPABASE_KEY     the PUBLIC (anon / publishable) key only.
                                NEVER the secret / service_role key.
     window.MQ_SUPABASE_PREFIX  "clsdemo_" on demo pages, "cls_" on live
     window.MQ_ON_SIGNED_OUT    (admin pages, optional) called when the
                                admin's sign-in has expired
     window.MQ_PERF             true to record timings (temporary)

   The public key can call only <prefix>get_class, <prefix>list_courses,
   <prefix>get_batch and <prefix>batch_login. <prefix>admin needs a
   signed-in user whose e-mail is in cls_admins. The tables themselves
   are closed to both.

   PUBLISHED FILES ARE IMMUTABLE. Create api.v6.js to change this.
   ================================================================= */

const MQ_CACHE_PREFIX = 'mq_class_';

function mqEndpoint(){
  return (window.MQ_SCRIPT_URL || '').trim();
}
function mqGasOn(){
  const u = mqEndpoint();
  return !!u && !u.startsWith('PASTE_');
}
function mqSbConfigured(){
  const u = (window.MQ_SUPABASE_URL || '').trim();
  const k = (window.MQ_SUPABASE_KEY || '').trim();
  const p = (window.MQ_SUPABASE_PREFIX || '').trim();
  return !!u && !!k && (p === 'cls_' || p === 'clsdemo_');
}
/* Pages ask this before loading. True when either backend is set up. */
function mqConfigured(){
  return mqSbConfigured() || mqGasOn();
}
function mqAdminPassword(){
  return window.MQ_ADMIN_PASSWORD || '';
}
function mqSbUrl(){ return (window.MQ_SUPABASE_URL || '').trim().replace(/\/+$/, ''); }
function mqSbKey(){ return (window.MQ_SUPABASE_KEY || '').trim(); }
function mqNow(){ return (window.performance && performance.now) ? performance.now() : Date.now(); }

/* =================================================================
   TIMING — TEMPORARY. Remove this block once the measurements are in.
   -----------------------------------------------------------------
   Records how long each call took and whether it was the first in a
   while. It writes nothing to the page and changes no behaviour: if
   window.MQ_PERF is not set, every function here is a no-op.

   WHAT IT CANNOT MEASURE. Server execution time. Apps Script does not
   report it, and reading it would mean adding a field to every
   response — a backend change, which is out of scope. So a "cold"
   figure here is cold start PLUS network PLUS execution, together.
   Comparing cold against warm separates the cold-start share.

   Read the results in the browser console with:  mqPerf()
   Clear them with:                               mqPerf.clear()
   ================================================================= */
const MQ_PERF_KEY  = 'mq_perf_log';
const MQ_COLD_MS   = 120000;   // no call for 2 min → treat the next as cold
let   mqLastCallAt = 0;

function mqPerfOn(){ return !!window.MQ_PERF; }

function mqPerfRecord(action, ms, ok, cold, extra){
  if(!mqPerfOn()) return;
  try{
    const log = JSON.parse(localStorage.getItem(MQ_PERF_KEY) || '[]');
    log.push({
      a: action,
      ms: Math.round(ms),
      ok: !!ok,
      cold: !!cold,
      at: new Date().toISOString(),
      x: extra || ''
    });
    // Keep the last 500 — enough for a few days, small enough to paste.
    localStorage.setItem(MQ_PERF_KEY, JSON.stringify(log.slice(-500)));
  }catch(e){}
}

window.mqPerf = function(){
  let log = [];
  try{ log = JSON.parse(localStorage.getItem(MQ_PERF_KEY) || '[]'); }catch(e){}
  if(!log.length){ console.log('No timings recorded. Set window.MQ_PERF = true first.'); return; }

  const by = {};
  log.forEach(r => {
    const k = r.a + (r.cold ? ' (cold)' : '');
    (by[k] = by[k] || []).push(r.ms);
  });

  const rows = Object.keys(by).sort().map(k => {
    const v = by[k].slice().sort((a, b) => a - b);
    const sum = v.reduce((a, b) => a + b, 0);
    return {
      call: k,
      n: v.length,
      min: v[0],
      median: v[Math.floor(v.length / 2)],
      max: v[v.length - 1],
      mean: Math.round(sum / v.length)
    };
  });

  console.table(rows);
  const cold = log.filter(r => r.cold).map(r => r.ms);
  const warm = log.filter(r => !r.cold).map(r => r.ms);
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
  console.log(`cold calls: ${cold.length}, average ${avg(cold)} ms`);
  console.log(`warm calls: ${warm.length}, average ${avg(warm)} ms`);
  console.log(`cold-start share: about ${Math.max(0, avg(cold) - avg(warm))} ms`);
  console.log('Copy the raw log with:  copy(localStorage.getItem("mq_perf_log"))');
  return rows;
};
window.mqPerf.clear = function(){
  try{ localStorage.removeItem(MQ_PERF_KEY); }catch(e){}
  console.log('Timings cleared.');
};

/* =================================================================
   ADMIN SIGN-IN  (v5) — Supabase Auth, e-mail + password
   -----------------------------------------------------------------
   The session is kept in this browser (localStorage), one per prefix,
   so the demo and live admins never share a sign-in. The access token
   lasts about an hour and is renewed automatically with the refresh
   token. "Lock" signs out.
   ================================================================= */
function mqAuthKey(){ return 'mq_cls_admin_' + (window.MQ_SUPABASE_PREFIX || '').trim(); }

function mqAuthRead(){
  try{ return JSON.parse(localStorage.getItem(mqAuthKey()) || 'null'); }catch(e){ return null; }
}
function mqAuthWrite(s){
  try{
    if(s) localStorage.setItem(mqAuthKey(), JSON.stringify(s));
    else localStorage.removeItem(mqAuthKey());
  }catch(e){}
}
function mqAuthFrom(out){
  return {
    access: out.access_token,
    refresh: out.refresh_token,
    expires: Date.now() + ((out.expires_in || 3600) * 1000),
    email: (out.user && out.user.email) || ''
  };
}

async function mqAuthCall(grant, body){
  const res = await fetch(mqSbUrl() + '/auth/v1/token?grant_type=' + grant, {
    method: 'POST',
    headers: { 'apikey': mqSbKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let out = {};
  try{ out = await res.json(); }catch(e){}
  return { ok: res.ok && !!out.access_token, out: out, status: res.status };
}

/* Sign in. Resolves to { ok: true } or { ok: false, error: "…" }. */
async function mqAdminSignIn(email, password){
  if(!mqSbConfigured()) return { ok: false, error: 'This page is not connected to Supabase.' };
  try{
    const r = await mqAuthCall('password', { email: String(email || '').trim(), password: String(password || '') });
    if(!r.ok){
      const msg = r.out.error_description || r.out.msg || r.out.message || '';
      return { ok: false, error: /invalid/i.test(msg) || r.status === 400
        ? 'Wrong e-mail or password.' : (msg || 'Could not sign in. Please try again.') };
    }
    mqAuthWrite(mqAuthFrom(r.out));
    return { ok: true };
  }catch(e){
    return { ok: false, error: 'Could not reach the server. Check the internet and try again.' };
  }
}

function mqAdminSignedIn(){
  const s = mqAuthRead();
  return !!(s && s.refresh);
}
function mqAdminEmail(){
  const s = mqAuthRead();
  return (s && s.email) || '';
}

async function mqAdminSignOut(){
  const s = mqAuthRead();
  mqAuthWrite(null);
  if(s && s.access && mqSbConfigured()){
    try{
      await fetch(mqSbUrl() + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': mqSbKey(), 'Authorization': 'Bearer ' + s.access }
      });
    }catch(e){}
  }
}

/* A valid access token, renewing it when it has under a minute left.
   null if the admin must sign in again. */
let mqRefreshing = null;
async function mqAdminToken(force){
  const s = mqAuthRead();
  if(!s || !s.refresh) return null;
  if(!force && s.access && s.expires - Date.now() > 60000) return s.access;
  if(!mqRefreshing){
    mqRefreshing = (async function(){
      try{
        const r = await mqAuthCall('refresh_token', { refresh_token: s.refresh });
        if(!r.ok){
          // A refresh token that is refused is final. Network trouble is not.
          if(r.status >= 400 && r.status < 500) mqAuthWrite(null);
          return null;
        }
        const n = mqAuthFrom(r.out);
        if(!n.email) n.email = s.email;
        mqAuthWrite(n);
        return n.access;
      }catch(e){ return null; }
    })().finally(function(){ mqRefreshing = null; });
  }
  return mqRefreshing;
}

function mqSignedOutAnswer(){
  try{ if(typeof window.MQ_ON_SIGNED_OUT === 'function') window.MQ_ON_SIGNED_OUT(); }catch(e){}
  return { result: 'error', error: 'Your sign-in has expired. Please sign in again.', signedOut: true };
}

/* =================================================================
   SUPABASE CALLS
   ================================================================= */

/* One database function, as the public (anon) caller. Throws on any
   network or HTTP failure so a caller can decide what to do. */
async function mqRpc(name, args){
  const url = mqSbUrl() + '/rest/v1/rpc/' + window.MQ_SUPABASE_PREFIX.trim() + name;
  const key = mqSbKey();
  const headers = { 'apikey': key, 'Content-Type': 'application/json' };
  // A legacy anon key is a JWT and also goes in Authorization; a new
  // sb_publishable_ key is not, and must not.
  if(/^eyJ/.test(key)) headers['Authorization'] = 'Bearer ' + key;

  const started = mqNow();
  const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
  try{
    const res = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(args || {}) });
    if(!res.ok) throw new Error('Supabase HTTP ' + res.status);
    const out = await res.json();
    mqPerfRecord('sb:' + name, mqNow() - started, true, cold);
    mqLastCallAt = Date.now();
    return out;
  }catch(err){
    mqPerfRecord('sb:' + name, mqNow() - started, false, cold, String(err && err.message || err));
    mqLastCallAt = Date.now();
    throw err;
  }
}

/* Every admin read and save. `body` is exactly what the page would have
   sent Apps Script; the old password is stripped, the sign-in is used. */
async function mqAdminRpc(body){
  const p = Object.assign({}, body || {});
  delete p.password;
  const action = String(p.action || '');

  async function once(token){
    const started = mqNow();
    const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
    const res = await fetch(mqSbUrl() + '/rest/v1/rpc/' + window.MQ_SUPABASE_PREFIX.trim() + 'admin', {
      method: 'POST',
      headers: { 'apikey': mqSbKey(), 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p: p })
    });
    mqLastCallAt = Date.now();
    if(res.status === 401 || res.status === 403){
      mqPerfRecord('sb:admin:' + action, mqNow() - started, false, cold, 'HTTP ' + res.status);
      return null;   // token refused — caller renews once
    }
    if(!res.ok){
      mqPerfRecord('sb:admin:' + action, mqNow() - started, false, cold, 'HTTP ' + res.status);
      let msg = '';
      try{ const j = await res.json(); msg = j.message || j.error || ''; }catch(e){}
      return { result: 'error', error: 'Server error ' + res.status + (msg ? ': ' + msg : '') };
    }
    const out = await res.json();
    mqPerfRecord('sb:admin:' + action, mqNow() - started, true, cold);
    return out;
  }

  let token = await mqAdminToken(false);
  if(!token) return mqSignedOutAnswer();
  let out = await once(token);
  if(out === null){
    token = await mqAdminToken(true);
    if(!token) return mqSignedOutAnswer();
    out = await once(token);
    if(out === null) return mqSignedOutAnswer();
  }
  if(out && out.result === 'error' && /Not signed in as an admin/.test(out.error || '')){
    out.error = 'This account is not on the admin list.';
  }
  return out;
}

/* =================================================================
   APPS SCRIPT  (only for pages that still set MQ_SCRIPT_URL)
   ================================================================= */
async function mqGasGet(action, params){
  const parts = [];
  Object.keys(params || {}).forEach(function(k){
    const v = params[k];
    if(v === undefined || v === null || v === '') return;
    parts.push(k + '=' + encodeURIComponent(v));
  });
  const url = mqEndpoint() + '?action=' + action + (parts.length ? '&' + parts.join('&') : '');
  const started = mqNow();
  const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
  try{
    const res = await fetch(url);
    const out = await res.json();
    mqPerfRecord(action, mqNow() - started, true, cold);
    mqLastCallAt = Date.now();
    return out;
  }catch(err){
    mqPerfRecord(action, mqNow() - started, false, cold, String(err && err.message || err));
    mqLastCallAt = Date.now();
    throw err;
  }
}
/* text/plain avoids the CORS preflight against Apps Script. */
async function mqGasPost(body){
  const started = mqNow();
  const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
  try{
    const res = await fetch(mqEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const out = await res.json();
    mqPerfRecord(body.action, mqNow() - started, true, cold);
    mqLastCallAt = Date.now();
    return out;
  }catch(err){
    mqPerfRecord(body.action, mqNow() - started, false, cold, String(err && err.message || err));
    mqLastCallAt = Date.now();
    throw err;
  }
}

/* =================================================================
   THE TWO DOORS THE PAGES USE — mqGet(action, params), mqPost(body)
   ================================================================= */
const MQ_PUBLIC_ACTIONS = { getclass: 1, getbatch: 1, listcourses: 1, batchlogin: 1 };

async function mqGet(action, params){
  const a = String(action || '').toLowerCase();
  if(mqSbConfigured() && !MQ_PUBLIC_ACTIONS[a]){
    return mqAdminRpc(Object.assign({ action: action }, params || {}));
  }
  if(!mqGasOn()) throw new Error('No backend for ' + action);
  return mqGasGet(action, params);
}

async function mqPost(body){
  const a = String((body && body.action) || '').toLowerCase();
  if(mqSbConfigured() && !MQ_PUBLIC_ACTIONS[a]){
    return mqAdminRpc(body);
  }
  if(!mqGasOn()) throw new Error('No backend for ' + (body && body.action));
  return mqGasPost(body);
}

// Admin POSTs all carried the password. Kept for the pages that call it.
function mqPostAdmin(body){
  return mqPost(Object.assign({ password: mqAdminPassword() }, body));
}

/* =================================================================
   STUDENT-FACING  (no admin rights, ever)
   -----------------------------------------------------------------
   Supabase answers. Apps Script is asked only if this page still sets
   MQ_SCRIPT_URL AND Supabase could not be reached or did not know the
   link — the same safety net as v3/v4.
   ================================================================= */
async function mqStudentCall(name, args, gasAction, gasParams, isPost){
  let sbOut = null;
  if(mqSbConfigured()){
    try{
      sbOut = await mqRpc(name, args);
      const unknownLink = sbOut && sbOut.result === 'error' &&
        (sbOut.error === 'invalid_link' || sbOut.error === 'invalid_token');
      if(sbOut && sbOut.result && (!unknownLink || !mqGasOn())) return sbOut;
    }catch(e){
      if(!mqGasOn()) throw e;
    }
  }
  if(!mqGasOn()){
    if(sbOut) return sbOut;
    throw new Error('No backend configured');
  }
  return isPost ? mqGasPost(gasParams) : mqGasGet(gasAction, gasParams);
}

function fetchClass(token){
  return mqStudentCall('get_class', { p_token: token || '' }, 'getClass', { token: token });
}
function fetchBatch(token, session){
  return mqStudentCall('get_batch', { p_token: token || '', p_session: session || '' },
                       'getBatch', { token: token, session: session });
}
function fetchBatchAsTeacher(teacherToken){
  return mqStudentCall('get_batch', { p_teacher: teacherToken || '' },
                       'getBatch', { teacher: teacherToken });
}
function batchLogin(batchToken, email, dob, deviceId){
  return mqStudentCall('batch_login',
    { p_token: batchToken || '', p_email: email || '', p_dob: dob || '', p_device: deviceId || '' },
    null, { action: 'batchLogin', batchToken: batchToken, email: email, dob: dob, deviceId: deviceId }, true);
}
// Public, read-only: no student data.
function fetchCourses(){
  return mqStudentCall('list_courses', {}, 'listCourses', {});
}

/* =================================================================
   ADMIN — READ
   ================================================================= */
function fetchClasses(){            return mqGet('listClasses', { password: mqAdminPassword() }); }
function fetchClassAdmin(classId){  return mqGet('getClassAdmin', { classId: classId, password: mqAdminPassword() }); }
function fetchNotices(){            return mqGet('listNotices', { password: mqAdminPassword() }); }
function fetchBatches(){            return mqGet('listBatches', { password: mqAdminPassword() }); }
function fetchBatchAdmin(batchId, month){
  return mqGet('getBatchAdmin', { password: mqAdminPassword(), batchId: batchId, month: month });
}
/* Fee status for one student, by their Academic Service id. THE ONE
   SEAM — answer shape unchanged. */
function fetchFeeStatus(mqId, month){
  return mqGet('getFeeStatus', { password: mqAdminPassword(), mqId: mqId, month: month });
}

/* =================================================================
   ADMIN — WRITE
   ================================================================= */
function saveClass(payload){          return mqPostAdmin(Object.assign({ action: 'createClass' }, payload)); }
function updateClassApi(payload){     return mqPostAdmin(Object.assign({ action: 'updateClass' }, payload)); }
function deleteClassApi(classId){     return mqPostAdmin({ action: 'deleteClass', classId: classId }); }
function resetClassToken(classId){    return mqPostAdmin({ action: 'resetToken', classId: classId }); }

function saveCourseApi(payload){      return mqPostAdmin(Object.assign({ action: 'saveCourse' }, payload)); }

function saveNoticeApi(payload){      return mqPostAdmin(Object.assign({ action: 'saveNotice' }, payload)); }
function deleteNoticeApi(noticeId){   return mqPostAdmin({ action: 'deleteNotice', noticeId: noticeId }); }
function toggleNoticeApi(noticeId, active){
  return mqPostAdmin({ action: 'toggleNotice', noticeId: noticeId, active: active });
}

function saveBatchApi(payload){       return mqPostAdmin(Object.assign({ action: 'saveBatch' }, payload)); }
function setClassTimeApi(classId, classTime){
  return mqPostAdmin({ action: 'setClassTime', classId: classId, classTime: classTime });
}
function setClassTimesApi(entries){
  return mqPostAdmin({ action: 'setClassTimes', entries: entries });
}
function setBatchTimeApi(batchId, classTime){
  return mqPostAdmin({ action: 'setBatchTime', batchId: batchId, classTime: classTime });
}
function setBatchSessionApi(payload){ return mqPostAdmin(Object.assign({ action: 'setBatchSession' }, payload)); }
function deactivateCourseApi(courseId, active){
  return mqPostAdmin({ action: 'deactivateCourse', courseId: courseId, active: active });
}
function deleteBatchApi(batchId){     return mqPostAdmin({ action: 'deleteBatch', batchId: batchId }); }
function resetBatchTokenApi(batchId){ return mqPostAdmin({ action: 'resetBatchToken', batchId: batchId }); }
function resetTeacherTokenApi(batchId){ return mqPostAdmin({ action: 'resetTeacherToken', batchId: batchId }); }

function saveRosterStudentApi(payload){ return mqPostAdmin(Object.assign({ action: 'saveRosterStudent' }, payload)); }
function removeRosterStudentApi(batchId, studentId){
  return mqPostAdmin({ action: 'removeRosterStudent', batchId: batchId, studentId: studentId });
}
function setAccessApi(batchId, month, entries){
  return mqPostAdmin({ action: 'setAccess', batchId: batchId, month: month, entries: entries });
}
function resetDevicesApi(batchId, studentId){
  return mqPostAdmin({ action: 'resetDevices', batchId: batchId, studentId: studentId });
}

function saveCalendarApi(payload){    return mqPostAdmin(payload); }   // createCalendar / updateCalendar
function deleteCalendarApi(calendarId){ return mqPostAdmin({ action: 'deleteCalendar', calendarId: calendarId }); }
function toggleCalendarApi(calendarId, active){
  return mqPostAdmin({ action: 'toggleCalendar', calendarId: calendarId, active: active });
}
function moveCalendarApi(calendarId, direction){
  return mqPostAdmin({ action: 'moveCalendar', calendarId: calendarId, direction: direction });
}

/* =================================================================
   LOCAL COPY — unchanged from v1
   Apps Script needs a few seconds from cold and there is no way round
   that on a first ever open. There is no reason to pay it twice.
   ================================================================= */
function mqCacheKey(token){ return MQ_CACHE_PREFIX + token; }

function readCache(token){
  try{
    const raw = localStorage.getItem(mqCacheKey(token));
    if(!raw) return null;
    const o = JSON.parse(raw);
    return (o && o.data) ? o : null;
  }catch(e){ return null; }
}
function writeCache(token, data){
  try{ localStorage.setItem(mqCacheKey(token), JSON.stringify({ at: Date.now(), data: data })); }catch(e){}
}
function clearCache(token){
  try{ localStorage.removeItem(mqCacheKey(token)); }catch(e){}
}
