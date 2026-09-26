/* =================================================================
   ManzilulQuran — CLASS SYSTEM API  v2
   -----------------------------------------------------------------
   Every call to the backend goes through this file. Nothing else in
   the system builds a URL, picks a method, or knows the word
   "action".

   WHY THIS EXISTS
   ---------------
   Not for speed. This file makes the system no faster on its own.
   It exists so the backend is reachable from exactly ONE place. If
   Apps Script is ever replaced — by Supabase or anything else — the
   pages do not change; this file does. Before it, 23 call sites
   across four pages each knew the endpoint, the action name and the
   admin password.

   WHAT IT MUST NOT DO
   -------------------
   Change behaviour. Every function below sends the same URL, method,
   headers, body and password the page sent before, and returns the
   same raw response. Anything the pages do with the answer stays in
   the pages.

   CONFIGURATION, set by each page before this file loads:
     window.MQ_SCRIPT_URL      the /exec endpoint        (all pages)
     window.MQ_ADMIN_PASSWORD  admin password            (admin pages ONLY)
     window.MQ_PERF            true to record timings    (temporary)

   Student-facing pages never set MQ_ADMIN_PASSWORD, so an admin
   action attempted from one sends no password and the server refuses
   it — the same as before.

   PUBLISHED FILES ARE IMMUTABLE. Create api.v3.js to change this.
   ================================================================= */

const MQ_CACHE_PREFIX = 'mq_class_';

function mqEndpoint(){
  return (window.MQ_SCRIPT_URL || '').trim();
}
function mqConfigured(){
  const u = mqEndpoint();
  return !!u && !u.startsWith('PASTE_');
}
function mqAdminPassword(){
  return window.MQ_ADMIN_PASSWORD || '';
}

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
   THE ONE PLACE A REQUEST IS MADE
   ================================================================= */

/* GET. Params are appended in the order given, exactly as the pages
   built them by hand, so the request is unchanged. */
async function mqGet(action, params){
  const parts = [];
  Object.keys(params || {}).forEach(function(k){
    const v = params[k];
    if(v === undefined || v === null || v === '') return;
    parts.push(k + '=' + encodeURIComponent(v));
  });
  const url = mqEndpoint() + '?action=' + action + (parts.length ? '&' + parts.join('&') : '');

  const started = (window.performance && performance.now) ? performance.now() : Date.now();
  const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
  try{
    const res = await fetch(url);
    const out = await res.json();
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    mqPerfRecord(action, now - started, true, cold);
    mqLastCallAt = Date.now();
    return out;
  }catch(err){
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    mqPerfRecord(action, now - started, false, cold, String(err && err.message || err));
    mqLastCallAt = Date.now();
    throw err;
  }
}

/* POST. Same content type the pages used — text/plain avoids the
   CORS preflight that application/json would trigger against Apps
   Script. Do not "fix" this to application/json. */
async function mqPost(body){
  const started = (window.performance && performance.now) ? performance.now() : Date.now();
  const cold = mqPerfOn() && (Date.now() - mqLastCallAt > MQ_COLD_MS);
  try{
    const res = await fetch(mqEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const out = await res.json();
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    mqPerfRecord(body.action, now - started, true, cold);
    mqLastCallAt = Date.now();
    return out;
  }catch(err){
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    mqPerfRecord(body.action, now - started, false, cold, String(err && err.message || err));
    mqLastCallAt = Date.now();
    throw err;
  }
}

// Admin POSTs all carry the password. One place to add it.
function mqPostAdmin(body){
  return mqPost(Object.assign({ password: mqAdminPassword() }, body));
}

/* =================================================================
   STUDENT-FACING  (no admin password, ever)
   ================================================================= */
function fetchClass(token){
  return mqGet('getClass', { token: token });
}
function fetchBatch(token, session){
  return mqGet('getBatch', { token: token, session: session });
}
function fetchBatchAsTeacher(teacherToken){
  return mqGet('getBatch', { teacher: teacherToken });
}
function batchLogin(batchToken, email, dob, deviceId){
  return mqPost({
    action: 'batchLogin',
    batchToken: batchToken,
    email: email,
    dob: dob,
    deviceId: deviceId
  });
}
// Public, read-only: no student data, so no password.
function fetchCourses(){
  return mqGet('listCourses', {});
}

/* =================================================================
   ADMIN — READ
   ================================================================= */
function fetchClasses(){
  return mqGet('listClasses', { password: mqAdminPassword() });
}
function fetchClassAdmin(classId){
  return mqGet('getClassAdmin', { classId: classId, password: mqAdminPassword() });
}
function fetchNotices(){
  return mqGet('listNotices', { password: mqAdminPassword() });
}
function fetchBatches(){
  return mqGet('listBatches', { password: mqAdminPassword() });
}
function fetchBatchAdmin(batchId, month){
  return mqGet('getBatchAdmin', { password: mqAdminPassword(), batchId: batchId, month: month });
}

/* Fee status for one student, by their Academic Service id.
   THE ONE SEAM. Today the server answers from the Classes spreadsheet;
   after the migration it answers from Supabase. Callers never change. */
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
