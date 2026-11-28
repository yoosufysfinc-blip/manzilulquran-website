/* motion.v1.js — CALM, USEFUL MOTION for the demo admin class sheet (/portal/demo/classes/).
   Loaded last. Nothing here changes what a button does; it only makes changes easy to follow and keeps
   the page smooth on every phone.

   · LITE MODE on slower phones (Save-Data, ≤ 2 GB memory, a slow first frames test) or a long list:
     the frosted-glass blur, tap rings and long staggers are dropped — the page stays light and quick.
   · A list refresh never blanks the page: the old list stays, a thin bar runs on top, then the new one
     replaces it in place. Rows that are NEW glow once, so you see what just arrived.
   · Every window closes as smoothly as it opened; bottom sheets on a phone can be PULLED DOWN to close.
   · The toast shows how long it stays (a thin bar).
   · MQMotion.flash(el) — one soft glow on anything that just changed (used by the other files).
   Everything respects "reduce motion" on the device.
   PUBLISHED FILES ARE IMMUTABLE — create motion.v2.js to change this. */
(function(){
"use strict";
const html = document.documentElement;
const RMQ = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
const calm = () => RMQ.matches;

/* ---------- lite mode ---------- */
function guessLite(){
  const c = navigator.connection || {};
  if(c.saveData) return true;
  if((navigator.deviceMemory || 8) <= 2) return true;
  if((navigator.hardwareConcurrency || 8) <= 2) return true;
  return false;
}
function setLite(on, why){ html.classList.toggle("mq-lite", !!on); if(on) html.dataset.lite = why || "device"; }
if(guessLite()) setLite(true, "device");
/* a short test of the first frames once the page is quiet: slow frames → lite */
function probe(){
  if(html.classList.contains("mq-lite") || document.hidden) return;
  let n = 0, slow = 0, last = 0;
  const step = t => {
    if(last){ const dt = t - last; if(dt > 34) slow++; }
    last = t;
    if(++n < 50) requestAnimationFrame(step);
    else if(slow >= 10) setLite(true, "frames");
  };
  requestAnimationFrame(step);
}
window.addEventListener("load", () => setTimeout(probe, 1800), { once: true });

/* ---------- a soft glow on what just changed ---------- */
function flash(el){
  if(typeof el === "string") el = document.querySelector(el);
  if(!el) return;
  el.classList.remove("mo-flash"); void el.offsetWidth; el.classList.add("mo-flash");
  clearTimeout(el._moFlash); el._moFlash = setTimeout(() => el.classList.remove("mo-flash"), 1800);
}

/* ---------- the class list refreshes in place ---------- */
let SILENT = false;
if(typeof loadClasses === "function"){
  const load0 = loadClasses;
  loadClasses = function(){
    const box = document.getElementById("listContent");
    const ids = (typeof classes !== "undefined" ? classes : []).map(c => c["Class ID"]);
    const had = ids.length && box && !box.querySelector(".loading") ? box.innerHTML : null;
    const sy = window.scrollY;
    SILENT = had !== null;
    const pr = load0.apply(this, arguments);          /* sets the spinner at once, then waits for the list */
    if(had !== null){ box.innerHTML = had; box.classList.add("mo-refreshing"); window.scrollTo(0, sy); }
    return Promise.resolve(pr).finally(() => {
      SILENT = false;
      if(box) box.classList.remove("mo-refreshing");
      const now = (typeof classes !== "undefined" ? classes : []).map(c => c["Class ID"]);
      if(had !== null) now.filter(id => ids.indexOf(id) < 0).forEach(id => {
        const b = document.querySelector('#listContent [data-id="' + CSS.escape(id) + '"]');
        const row = b && b.closest("tr");
        if(row){ flash(row); if(now.length > 8) row.scrollIntoView({ block: "center", behavior: calm() ? "auto" : "smooth" }); }
      });
      const n = now.length; if(n > 60) html.classList.add("mq-long"); else html.classList.remove("mq-long");
    });
  };
}
if(typeof revealRows === "function"){
  const rr0 = revealRows;
  revealRows = function(box){ if(SILENT) return; return rr0.apply(this, arguments); };
}

/* ---------- windows close smoothly ---------- */
if(typeof closeModal === "function" && typeof openModal === "function"){
  const close0 = closeModal, open0 = openModal;
  closeModal = function(id){
    const el = document.getElementById(id);
    if(!el || !el.classList.contains("show") || el.classList.contains("sheet-backdrop") || calm()) return close0.apply(this, arguments);
    if(el.classList.contains("mo-closing")) return;
    const panel = el.querySelector(".modal");
    if(panel){ const tr = panel.style.translate; if(tr && tr !== "none"){ const m = /(-?\d+(?:\.\d+)?)px\s*$/.exec(tr); if(m) panel.style.setProperty("--drag", m[1] + "px"); } panel.style.translate = ""; }
    el.classList.add("mo-closing");
    const timers = typeof modalCloseTimers !== "undefined" ? modalCloseTimers : (window._moTimers = window._moTimers || {});
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => {
      el.classList.remove("mo-closing");
      if(panel) panel.style.removeProperty("--drag");
      close0.call(null, id);
    }, html.classList.contains("mq-lite") ? 120 : 200);
  };
  openModal = function(id){
    const el = document.getElementById(id);
    if(el){ el.classList.remove("mo-closing"); const p = el.querySelector(".modal"); if(p){ p.style.translate = ""; p.style.removeProperty("--drag"); } bindPull(el, id); }
    return open0.apply(this, arguments);
  };
}

/* ---------- pull a bottom sheet down to close it (phone) ---------- */
const PHONE = window.matchMedia ? window.matchMedia("(max-width:640px)") : { matches: false };
function bindPull(back, id){
  if(back._moPull || back.classList.contains("sheet-backdrop") && back.id === "liveModal") return;
  const panel = back.querySelector(".modal"); if(!panel) return;
  back._moPull = true;
  let y0 = null, dy = 0, t0 = 0, pid = null, from = null;
  const handles = () => [panel.querySelector(".nc-grab, .sheet-grab"), panel.querySelector(".modal-head, .ta-head")].filter(Boolean);
  const onDown = e => {
    if(!PHONE.matches || calm() || (e.button && e.button !== 0)) return;
    if(e.target.closest("button, a, input, select, textarea, label")) return;
    if(!handles().some(h => h.contains(e.target))) return;
    const body = panel.querySelector(".modal-body"); if(body && body.scrollTop > 4 && !e.target.closest(".nc-grab, .sheet-grab")) return;
    y0 = e.clientY; dy = 0; t0 = performance.now(); pid = e.pointerId; from = e.target;
    try{ from.setPointerCapture(pid); }catch(er){}
    panel.style.transition = "none";
  };
  const onMove = e => {
    if(y0 === null || e.pointerId !== pid) return;
    dy = Math.max(0, e.clientY - y0);
    panel.style.translate = "0 " + dy + "px";
  };
  const onUp = e => {
    if(y0 === null || (e && e.pointerId !== pid)) return;
    const fast = dy > 40 && dy / Math.max(1, performance.now() - t0) > 0.6;
    y0 = null;
    if(dy > 110 || fast){ panel.style.transition = ""; closeModal(id); }
    else { panel.style.transition = "translate .38s cubic-bezier(.2,.9,.25,1)"; panel.style.translate = ""; setTimeout(() => { panel.style.transition = ""; }, 400); }
    dy = 0;
  };
  panel.addEventListener("pointerdown", onDown);
  panel.addEventListener("pointermove", onMove);
  panel.addEventListener("pointerup", onUp);
  panel.addEventListener("pointercancel", onUp);
}
document.querySelectorAll(".modal-backdrop").forEach(b => { if(b.querySelector(".sheet-grab, .nc-grab") && b.id !== "liveModal") bindPull(b, b.id); });

/* ---------- the toast shows how long it stays ---------- */
if(typeof toast === "function"){
  const toast0 = toast;
  toast = function(){ const t = document.getElementById("toast"); if(t){ t.classList.remove("show", "mo-t"); void t.offsetWidth; } const r = toast0.apply(this, arguments); if(t) t.classList.add("mo-t"); return r; };
}

window.MQMotion = { flash: flash, lite: () => html.classList.contains("mq-lite"), calm: calm };
})();
