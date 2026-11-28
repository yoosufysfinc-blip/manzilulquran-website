/* calsync.v1.js — THE CLASS DAYS AND THE CALENDARS STAY IN STEP (demo class sheet)
   Needs api.v10.js (fetchClassAdmin, saveCalendarApi, mqAdminFn) and engine.v1.js (istTodayISO).

   One rule: the CLASS DAYS (the class in the attendance) are the truth. A calendar's weekly off
   is "the days that are not class days".
   · CalSync.follow(classId, days) — the class days changed: every running calendar of that class
     sheet takes the new weekly off FROM TODAY. A calendar that started before today is split:
     the part before today stays as it was, a new calendar (same name and links) carries on from
     today. Calendars that already match, or have ended, are left alone.
   · CalSync.planOf(studentId, course) / CalSync.setDays(planId, days) — the class behind a sheet,
     and changing its days (clsdemo_days, clsdemo-newclass-v2.sql). Academic Service, the teacher
     page and the attendance follow the class.
   PUBLISHED FILES ARE IMMUTABLE — create calsync.v2.js to change this. */
(function(){
"use strict";
const WK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const FULL = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };
const SHORT = {}; Object.keys(FULL).forEach(k => { SHORT[FULL[k]] = k; });

function today(){ return typeof istTodayISO === "function" ? istTodayISO() : new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); }
function addD(ds, n){ const d = new Date(ds + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function span(a, b){ return Math.round((Date.parse(b) - Date.parse(a)) / 864e5) + 1; }
function short(d){ d = String(d || ""); return SHORT[d] || (WK.indexOf(d.slice(0, 3)) >= 0 ? d.slice(0, 3) : ""); }
/* class days (Mon, Tue …) → weekly off (Monday, Tuesday …) */
function offOf(days){ const on = (days || []).map(short); return WK.filter(d => on.indexOf(d) < 0).map(d => FULL[d]); }
/* weekly off (Monday …) → class days (Mon …) */
function daysOf(off){ const o = (off || []).map(short); return WK.filter(d => o.indexOf(d) < 0); }
function sameSet(a, b){ const x = (a || []).map(short).filter(Boolean).sort().join(), y = (b || []).map(short).filter(Boolean).sort().join(); return x === y; }
function startOf(c){ return String(c.startDate || "").slice(0, 10); }
function endOf(c){ return addD(startOf(c), Math.max(1, +c.days || 1) - 1); }
function linksOf(c){ return (Array.isArray(c.links) ? c.links : []).filter(Boolean); }
function payload(c, classId, over){
  return Object.assign({ action: "updateCalendar", calendarId: c.calendarId, classId: classId, name: c.name, startDate: startOf(c),
    days: +c.days || 1, weeklyOff: c.weeklyOff || [], links: linksOf(c).length ? linksOf(c) : ["#"], active: c.active !== false,
    position: "end", relativeTo: "" }, over || {});
}
async function save(body){
  const out = await saveCalendarApi(body).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  if(!out || out.result !== "success") throw new Error((out && out.error) || "The calendar was not saved");
  return out;
}

/* the class days changed → the running calendars follow from today */
async function follow(classId, days, opts){
  opts = opts || {};
  const t = today(), off = offOf(days), done = { updated: 0, split: 0, same: 0, names: [] };
  if(!classId || !daysOf(off).length) return done;
  const have = await fetchClassAdmin(classId);
  if(!have || have.result !== "success") throw new Error((have && have.error) || "Could not read the calendars");
  for(const c of (have.calendars || [])){
    if(!c || !startOf(c) || c.active === false || c.calendarId === opts.except) continue;
    if(endOf(c) < t) continue;
    if(sameSet(c.weeklyOff, off)){ done.same++; continue; }
    if(startOf(c) >= t){
      await save(payload(c, classId, { weeklyOff: off }));
      done.updated++;
    } else {
      /* keep what is past, carry on from today with the new days */
      const end = endOf(c);
      await save(payload(c, classId, { days: Math.max(1, span(startOf(c), addD(t, -1))) }));
      await save(payload(c, classId, { action: "createCalendar", calendarId: "", startDate: t, days: span(t, end), weeklyOff: off, active: true }));
      done.split++;
    }
    done.names.push(c.name);
  }
  return done;
}

async function planOf(studentId, course){
  const out = await mqAdminFn("days", { action: "get", studentId: studentId, course: course || "" });
  if(!out || out.result !== "success") return { error: (out && out.missing) ? "Run clsdemo-newclass-v2.sql in Supabase" : (out && out.error) || "Could not read the class" };
  return { plan: out.plan || null };
}
async function setDays(planId, days){
  const out = await mqAdminFn("days", { action: "set", planId: planId, days: (days || []).map(short).filter(Boolean) });
  if(!out || out.result !== "success") throw new Error((out && out.missing) ? "Run clsdemo-newclass-v2.sql in Supabase" : (out && out.error) || "The class days were not changed");
  return out.days || days;
}

window.CalSync = { WK: WK, FULL: FULL, offOf: offOf, daysOf: daysOf, sameSet: sameSet, short: short, endOf: endOf, startOf: startOf,
  follow: follow, planOf: planOf, setDays: setDays, today: today };
})();
