/* =================================================================
   ManzilulQuran — CLASS SYSTEM API  v1
   -----------------------------------------------------------------
   Talks to the Classes Apps Script, and keeps the local copy that
   makes a repeat open feel instant.

   NO ADMIN PASSWORD LIVES HERE, and none ever may. Every page that
   loads this file is student-facing and authenticates with nothing
   but the share token in the URL. The server's publicClass() is an
   allowlist, so the Phone column and the Class ID never travel.

   The endpoint is NOT hardcoded. Each page sets window.MQ_SCRIPT_URL
   in a small inline script, then loads this file with a src tag. That
   is what lets the demo pages point at the demo spreadsheet
   while the live pages point at the live one, with one shared file.

   PUBLISHED FILES ARE IMMUTABLE. Create api.v2.js rather than
   editing this once it is live.
   ================================================================= */

const MQ_CACHE_PREFIX = 'mq_class_';

function mqEndpoint(){
  return (window.MQ_SCRIPT_URL || '').trim();
}
function mqConfigured(){
  const u = mqEndpoint();
  return !!u && !u.startsWith('PASTE_');
}

/* ---------------- Local copy ----------------
   Apps Script needs ~3s from cold, and there is no way around that on
   the first ever open. But there is no reason to pay it twice. */
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

/* ---------------- Read one class sheet ----------------
   Returns the raw Apps Script envelope: {result:'success', data:{…}}
   or {result:'error', error:'invalid_token'}. Callers decide what a
   failure means, because /class/ and /join/ handle it differently. */
async function fetchClass(token){
  const res = await fetch(mqEndpoint() + '?action=getClass&token=' + encodeURIComponent(token));
  return await res.json();
}
