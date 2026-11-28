/* newteacher.v1.js — ADD A NEW TEACHER from the demo class sheet. One window, used from three places:
   the Teachers workspace (+ New teacher), New class (the teacher list) and Cover a class.
   Needs teachers-admin (window.TA_API), api.v10.js (mqAdminFn) and clsdemo-newteacher-v1.sql.

   · Name, WhatsApp, the languages they teach in (the class's language is already on), gender, email, note.
   · Before saving: an existing teacher with a similar name or the same number is shown first —
     "Use <name>" picks them instead (no duplicate). The server checks the number and the name again.
   · Saved in Academic Service's teacher series (MQ8086 …) with "Pay not set": it waits in
     Academic Service → Review, where the office confirms it (✓ Looks right · Set pay · Merge duplicate ·
     Deactivate). The class sheet can use the teacher at once.
   NT.open({ lang, name, onDone(teacher, isNew), title }) — onDone gets the new or the picked teacher.
   PUBLISHED FILES ARE IMMUTABLE — create newteacher.v2.js to change this. */
(function(){
"use strict";
const A = window.TA_API;
if(!A){ console.error("newteacher.v1.js needs teachers-admin first"); return; }
const LANGS = ["Malayalam", "English", "Tamil", "Urdu", "Kannada", "Hindi", "Arabic"];
const CCS = ["91", "971", "966", "974", "965", "968", "973", "44", "1", "60", "65"];
const esc = s => escapeHtml(s == null ? "" : String(s));
const digits = v => String(v || "").replace(/\D/g, "");
const ini = n => String(n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
const reqId = () => "nt-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
let F = null;

/* a name in plain letters, common spellings folded together (same idea as Academic Service's Review) */
function key(s){
  let t = String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s]/g, " ");
  t = t.replace(/\b(muhammed|mohammed|mohamed|muhammad|mohammad|muhamad|mohamad|mohd|md)\b/g, "muhammad")
       .replace(/\b(fathima|fatima|fathimah|fatimah|fathema)\b/g, "fatima").replace(/\b(abdul|abdhul|abdool)\b/g, "abdul")
       .replace(/th/g, "t").replace(/dh/g, "d").replace(/kh/g, "k").replace(/ee/g, "i").replace(/oo/g, "u").replace(/(.)\1+/g, "$1");
  return t.split(/\s+/).filter(Boolean).sort().join(" ");
}
function similar(a, b){
  a = key(a); b = key(b); if(!a || !b) return false; if(a === b) return true;
  const wa = a.split(" "), wb = b.split(" ");
  return wa.length > 1 && wb.length > 1 && wa.filter(w => w.length > 2 && wb.indexOf(w) >= 0).length >= Math.min(wa.length, wb.length);
}
function matches(){
  const nm = F.name.trim(), wa = digits(F.wa);
  if(nm.length < 3 && wa.length < 9) return [];
  return (A.TA.teachers || []).filter(t => t.kind !== "staff" && !t._gone).map(t => {
    const tw = digits(t.whatsapp || t.phone);
    const sameNum = wa.length >= 9 && tw.length >= 9 && tw.slice(-9) === wa.slice(-9);
    return sameNum ? [t, "Same number"] : nm.length >= 3 && similar(nm, t.name) ? [t, "Similar name"] : null;
  }).filter(Boolean).slice(0, 4);
}

function ensure(){
  if(document.getElementById("ntModal")) return;
  const d = document.createElement("div");
  d.className = "modal-backdrop nc-back"; d.id = "ntModal";
  d.innerHTML = `<div class="modal nc nc-sm nt" role="dialog" aria-modal="true" aria-labelledby="ntT"><span class="nc-grab" aria-hidden="true"></span>
    <div class="modal-head"><h3 id="ntT">New <span class="accent">teacher</span></h3><p id="ntP">Joins Academic Service's teachers — the office confirms and sets the pay there.</p></div>
    <div class="modal-body nc-body" id="ntB"></div>
    <div class="modal-foot nc-foot" id="ntF"></div></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", onClick);
  d.addEventListener("input", onInput);
  d.addEventListener("change", onInput);
}
function open(o){
  o = o || {};
  ensure();
  F = { name: o.name || "", wa: "", cc: "91", email: "", gender: "", note: "", langs: o.lang ? [o.lang] : ["Malayalam"], req: reqId(), busy: false,
        err: "", server: null, onDone: o.onDone || null, done: null };
  document.getElementById("ntT").innerHTML = o.title || 'New <span class="accent">teacher</span>';
  paint();
  openModal("ntModal");
  setTimeout(() => { const i = document.getElementById("ntName"); if(i) i.focus(); }, 120);
}
function paint(){
  const b = document.getElementById("ntB"), f = document.getElementById("ntF"); if(!b) return;
  if(F.done){
    const t = F.done;
    b.innerHTML = `<div class="nc-done"><div class="nc-burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join("")}<span><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></div>
      <b>${esc(t.name)} · ${esc(t.id)}</b><small>${esc((t.languages || []).join(" · ") || "No language set")}</small>
      <div class="nt-wait"><b>Waiting in Academic Service → Review</b> The office checks the details and sets the pay. You can give classes and covers now.</div></div>`;
    f.innerHTML = `<button class="btn-ghost" data-nt="profile">Teacher profile</button><button class="btn-solid" data-nt="close">Done</button>`;
    return;
  }
  const m = matches();
  b.innerHTML = `
    <div class="nc-f" style="--i:0"><label for="ntName">Name</label><input class="nc-in" id="ntName" value="${esc(F.name)}" autocomplete="off" placeholder="Full name" /></div>
    <div class="nc-f" style="--i:1"><label for="ntWa">WhatsApp</label>
      <div class="nc-wa"><select class="nc-in nc-cc" id="ntCC" aria-label="Country code">${CCS.map(c => `<option value="${c}"${F.cc === c ? " selected" : ""}>+${c}</option>`).join("")}</select>
        <input class="nc-in" id="ntWa" value="${esc(F.wa)}" inputmode="tel" autocomplete="off" placeholder="98470 12345" /></div></div>
    <div id="ntDup">${dupBox(m)}</div>
    <div class="nc-f" style="--i:2"><label>Teaches in <small>tap all that fit</small></label>
      <div class="nc-chips sm">${LANGS.map(l => `<button type="button" class="nc-chip sm${F.langs.indexOf(l) >= 0 ? " on" : ""}" data-nt="lang" data-v="${l}" aria-pressed="${F.langs.indexOf(l) >= 0}">${l}</button>`).join("")}</div></div>
    <div class="nc-row2" style="--i:3">
      <div class="nc-f"><label>Gender</label><div class="nc-chips sm">${["Female", "Male"].map(g => `<button type="button" class="nc-chip sm${F.gender === g ? " on" : ""}" data-nt="gender" data-v="${g}">${g}</button>`).join("")}</div></div>
      <div class="nc-f"><label for="ntEm">Email <small>optional</small></label><input class="nc-in" id="ntEm" type="email" inputmode="email" value="${esc(F.email)}" autocomplete="off" placeholder="name@example.com" /></div>
    </div>
    <div class="nc-f" style="--i:4"><label for="ntNote">Note <small>optional · for the office</small></label><input class="nc-in" id="ntNote" value="${esc(F.note)}" autocomplete="off" placeholder="e.g. Hifz, ladies only, evenings" /></div>
    ${F.server ? serverBox() : ""}
    ${F.err ? `<span class="nc-err" role="alert">${esc(F.err)}</span>` : ""}`;
  f.innerHTML = `<button class="btn-ghost" data-nt="close">Cancel</button>
    <button class="btn-solid nc-go" data-nt="save"${F.busy ? " disabled" : ""}><span>${F.busy ? "Saving…" : F.server ? "No — it's a new teacher" : "Add teacher"}</span></button>`;
}
function dupBox(m){
  if(!m.length) return "";
  return `<div class="nt-dup" role="status"><b>Already a teacher?</b>${m.map(([t, why]) => `<div class="nt-dr"><span class="nc-av sm">${esc(ini(t.name))}</span>
      <span class="nc-pm"><b>${esc(t.name)}</b><small>${esc(t.id)} · ${esc(why)}${(t.status || "Active") !== "Active" ? " · inactive" : ""}</small></span>
      ${F.onDone ? `<button type="button" class="nc-mini" data-nt="use" data-v="${esc(t.id)}">Use</button>` : ""}</div>`).join("")}</div>`;
}
function serverBox(){
  return `<div class="nt-dup hard" role="alert"><b>Academic Service already has:</b>${F.server.map(x => `<div class="nt-dr"><span class="nc-av sm">${esc(ini(x.name))}</span>
      <span class="nc-pm"><b>${esc(x.name)}</b><small>${esc(x.id)} · ${esc(x.why)}${x.status !== "Active" ? " · " + esc(x.status) : ""}</small></span>
      ${F.onDone ? `<button type="button" class="nc-mini" data-nt="use" data-v="${esc(x.id)}">Use</button>` : ""}</div>`).join("")}
    <small>If this is a different person, press “No — it's a new teacher”.</small></div>`;
}
function onInput(ev){
  const t = ev.target;
  if(t.id === "ntName"){ F.name = t.value; F.server = null; F.err = ""; repaintDup(); }
  else if(t.id === "ntWa"){ F.wa = t.value; F.server = null; F.err = ""; repaintDup(); }
  else if(t.id === "ntCC") F.cc = t.value;
  else if(t.id === "ntEm") F.email = t.value;
  else if(t.id === "ntNote") F.note = t.value;
}
function repaintDup(){
  const box = document.getElementById("ntDup"); if(box) box.innerHTML = dupBox(matches());
  const e2 = document.querySelector("#ntB .nc-err, #ntB .nt-dup.hard"); if(e2) e2.remove();
  const go = document.querySelector('#ntF [data-nt="save"] span'); if(go) go.textContent = "Add teacher";
}
function onClick(ev){
  const d = document.getElementById("ntModal");
  if(ev.target === d){ if(!F.busy) closeModal("ntModal"); return; }
  const b = ev.target.closest("[data-nt]"); if(!b || b.disabled) return;
  const a = b.dataset.nt, v = b.dataset.v;
  if(a === "close"){ closeModal("ntModal"); return; }
  if(a === "lang"){ const i = F.langs.indexOf(v); if(i >= 0) F.langs.splice(i, 1); else F.langs.push(v); F.langs = LANGS.filter(l => F.langs.indexOf(l) >= 0);
    b.classList.toggle("on", i < 0); b.setAttribute("aria-pressed", i < 0); return; }
  if(a === "gender"){ F.gender = F.gender === v ? "" : v; document.querySelectorAll('#ntB [data-nt="gender"]').forEach(x => x.classList.toggle("on", x.dataset.v === F.gender)); return; }
  if(a === "use"){ const t = (A.TA.teachers || []).find(x => x.id === v) || { id: v, name: v }; closeModal("ntModal"); if(F.onDone) F.onDone(t, false); return; }
  if(a === "save"){ save(!!F.server); return; }
  if(a === "profile"){ const id = F.done && F.done.id; closeModal("ntModal"); if(id && window.TA_API && typeof window.TA_OPEN === "function") window.TA_OPEN(id, "access"); return; }
}
async function save(confirmNew){
  F.err = "";
  const nm = F.name.trim().replace(/\s+/g, " "), wa = digits(F.wa);
  if(nm.length < 2){ F.err = "Type the teacher's name"; paint(); return; }
  if(wa && wa.length < 7){ F.err = "The WhatsApp number is too short"; paint(); return; }
  if(F.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(F.email.trim())){ F.err = "The email does not look right"; paint(); return; }
  if(!F.langs.length){ F.err = "Tap at least one language they teach in"; paint(); return; }
  F.busy = true; paint();
  const out = await mqAdminFn("new_teacher", { reqId: F.req, name: nm, whatsapp: wa, whatsappCC: F.cc, email: F.email.trim(), gender: F.gender,
    languages: F.langs, notes: F.note.trim(), confirmNew: confirmNew }).catch(err => ({ result: "error", error: String(err && err.message || err) }));
  F.busy = false;
  if(out && out.result === "duplicate"){ F.server = out.matches || []; paint(); return; }
  if(!out || out.result !== "success"){ F.err = out && out.missing ? "Run clsdemo-newteacher-v1.sql in Supabase" : (out && out.error) || "Not saved"; paint(); return; }
  const t = Object.assign({ id: out.teacherId }, out.teacher || {});
  const list = A.TA.teachers || (A.TA.teachers = []);
  if(!list.some(x => x.id === t.id)) list.push(t);
  F.done = t; paint();
  if(F.onDone) F.onDone(t, true);
  if(typeof currentWs === "function" && currentWs() === "teachers") A.paintWorkspace();
  /* the new teacher glows once wherever it now shows */
  setTimeout(() => { if(!window.MQMotion) return;
    MQMotion.flash('.ta-card[data-id="' + t.id + '"]'); MQMotion.flash('#ncTea .nc-t[data-v="' + t.id + '"]');
    const sel = Array.from(document.querySelectorAll("#taCoverBody .cov-sub")).find(s2 => s2.value === t.id); if(sel) MQMotion.flash(sel); }, 260);
}

window.NT = { open: open, LANGS: LANGS };
})();
