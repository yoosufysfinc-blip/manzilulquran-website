"use strict";
/* Academic Service — att-link-guard.v1.js. Loaded only by portal/attendance/ (the old attendance LINK), after att-admin.v6.js.
   · the demo class sheet's attendance now lives inside the class sheet (portal/demo/attendance/): the link with cs=demo
     only says where it went, and changes nothing
   · classes that belong to the demo class sheet ("sheet": "demo") are not shown or marked through the link —
     the class sheet is the only place they change
   · dates and "today" are India time (IST)
   PUBLISHED FILES ARE IMMUTABLE — create att-link-guard.v2.js to change this. */
today = function(){ return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); };
(function(){
  const cs = new URLSearchParams(location.search).get("cs") || "";
  if (cs === "demo") {
    admInit = function(){ admBlock("The demo class sheet's attendance is now inside the class sheet. Open the class sheet and tap Attendance."); };
    return;
  }
  const get = DataService.getPlans.bind(DataService);
  DataService.getPlans = function(f){ return get(f).filter(p => !p || p.sheet !== "demo"); };
})();
