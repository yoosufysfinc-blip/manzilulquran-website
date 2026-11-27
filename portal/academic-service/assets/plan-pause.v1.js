"use strict";
/* Academic Service — plan-pause.v1.js. A class (plan) can be PAUSED for a while.
   Stored on the plan:  pauses: [{ from: "YYYY-MM-DD", until: "YYYY-MM-DD" | "", reason, by, at }]
     from  = first day with no class
     until = last day with no class ("" = until someone presses Restart)
   A paused day is not a class day: it is not counted as unmarked, it is greyed in the attendance sheet,
   the teacher page shows "Paused" and the student's class sheet has no join link on it.
   Fees are not changed here — the office sees the pause in Review and decides.
   Load after logic.v10.js and ws-attendance.v6.js (both the office app and the class-admin link load it).
   PUBLISHED FILES ARE IMMUTABLE — create plan-pause.v2.js to change this. */
const PlanPause = {
  list(pl){ return (pl && Array.isArray(pl.pauses)) ? pl.pauses.filter(p => p && p.from) : []; },
  /* the pause that covers this day, or null */
  on(pl, ds){ return PlanPause.list(pl).find(p => ds >= p.from && (!p.until || ds <= p.until)) || null; },
  /* the pause covering today, else the next one coming */
  current(pl, ds){
    ds = ds || today();
    return PlanPause.list(pl).filter(p => !p.until || p.until >= ds).sort((a, b) => a.from < b.from ? -1 : 1)[0] || null;
  },
  /* the day classes come back ("" = not set) */
  restartDay(p){ if (!p || !p.until) return ""; const d = parseYMD(p.until); d.setDate(d.getDate() + 1); return ymd(d); },
  label(p){
    if (!p) return "";
    const back = PlanPause.restartDay(p);
    return "Paused " + fmtDate(p.from) + (back ? " · restarts " + fmtDate(back) : " · until restarted");
  },
  overlaps(pl, from, until, skip){
    const end = until || "9999-12-31";
    return PlanPause.list(pl).some(p => p !== skip && p.from <= end && (!p.until || p.until >= from));
  }
};
(function(){
  if (typeof Logic !== "undefined" && Logic.planDay && !Logic._pauseWrapped) {
    const base = Logic.planDay;
    Logic.planDay = function(pl, ds){ return base.call(Logic, pl, ds) && !PlanPause.on(pl, ds); };
    Logic._pauseWrapped = true;
  }
  if (typeof attPossible === "function") {
    const baseP = attPossible;
    attPossible = function(pl, ds){ return baseP(pl, ds) && !PlanPause.on(pl, ds); };
  }
  /* the attendance sheet: a paused day is greyed (out) and hatched (pz), never "unmarked" */
  if (typeof attSheet === "function") {
    const baseS = attSheet;
    attSheet = function(month, rows){
      let h = baseS(month, rows);
      const ms = month + "-01", me = month + "-" + pad2(daysInMonth(month));
      DataService.getPlans().forEach(function(pl){
        PlanPause.list(pl).forEach(function(p){
          if (p.from > me || (p.until && p.until < ms)) return;
          const d = parseYMD(p.from < ms ? ms : p.from);
          for (let ds = ymd(d); ds <= me && (!p.until || ds <= p.until); d.setDate(d.getDate() + 1), ds = ymd(d)) {
            const key = '" data-pid="' + esc(pl.id) + '" data-ds="' + ds + '"', i = h.indexOf(key); if (i < 0) continue;
            const j = h.lastIndexOf('class="', i); if (j < 0) continue;
            let cls = h.slice(j + 7, i).replace(" um", "").replace(" off", "");
            if (cls.indexOf(" out") < 0 && cls.indexOf(" hol") < 0) cls += " out";
            h = h.slice(0, j + 7) + cls + " pz" + h.slice(i);
          }
        });
      });
      return h;
    };
  }
})();
