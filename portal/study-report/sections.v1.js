/* =================================================================
   ░░  HIFZ SECTIONS — Hifz Report ⇄ Hifz Learning App (v1)  ░░
   Adds a two-part switch at the top of the admin student list.
   Teacher share links (?s=…&t=…) open one student only, so they never get it.
   ================================================================= */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  if (q.get("s") && q.get("t")) return;
  function mount() {
    var roster = document.getElementById("v-roster");
    if (!roster || document.getElementById("hzSections")) return;
    var nav = document.createElement("nav");
    nav.id = "hzSections"; nav.className = "hz-sections"; nav.setAttribute("aria-label", "Hifz sections");
    nav.innerHTML =
      '<a class="hz-sec on" href="/portal/study-report/" aria-current="page">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6"/></svg><span><span class="hz-pre">Hifz </span>Report</span></a>' +
      '<a class="hz-sec" href="/portal/study-report/hifz-app/">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"/></svg><span><span class="hz-pre">Hifz </span>Learning App</span></a>';
    roster.insertBefore(nav, roster.firstChild);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
