/* =================================================================
   ░░  ManzilulQuran — CHAT UI  v1  ░░
   -----------------------------------------------------------------
   One chat thread, used in three places: the teacher page, the
   student's class sheet and the admin's read-only view.

     const c = MQChat.mount(el, {
       side: "t" | "s" | "a",            // who is looking (a = admin, read only)
       api:  { list(after), send(msg), voice(msgId) },   // → server answers
       names: { t: "Ustadha …", s: "Aysha" },
       onJoin(meta),                     // student: open the class for an invite card
       canInvite, onInvite(),            // teacher: the invite button in the bar
       pollMs: 5000
     });
     c.destroy();

   Text, voice notes (max 60 s) and invite cards. Messages older than
   3 days are removed by the server; this view says so at the top.
   Needs escapeHtml (engine.v1.js). Styles: chat.v1.css.
   PUBLISHED FILES ARE IMMUTABLE. Create chat.v2.js to change this.
   ================================================================= */
(function(){
"use strict";
const e = s => escapeHtml(s == null ? "" : String(s));
const pad = n => String(n).padStart(2, "0");
const MAX_SEC = 60;
const ICONS = {
  send:'<path d="M4 12l16-8-6 16-3-7z"/>', mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>', play:'<path d="M7 5v14l12-7z" fill="currentColor" stroke="none"/>', pause:'<path d="M8 5v14M16 5v14"/>',
  video:'<rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="M15.5 10.5 21 7.5v9l-5.5-3"/>', inv:'<path d="M4 4h16v16H4z"/><path d="M4 9h16"/><path d="M12 12v6M9 15h6"/>'
};
const ic = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;
function hm(ts){ return new Date(ts).toLocaleTimeString("en-IN", { hour:"numeric", minute:"2-digit", timeZone:"Asia/Kolkata" }); }
function dayKey(ts){ return new Date(ts).toLocaleDateString("en-CA", { timeZone:"Asia/Kolkata" }); }
function dayLabel(k){
  const today = new Date().toLocaleDateString("en-CA", { timeZone:"Asia/Kolkata" });
  const y = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone:"Asia/Kolkata" });
  if(k === today) return "Today"; if(k === y) return "Yesterday";
  return new Date(k + "T00:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" });
}
function fmtDate(ds){ try{ return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { weekday:"short", day:"numeric", month:"short" }); }catch(x){ return ds; } }
function fmtTime(t){ if(!t) return ""; return typeof formatTime === "function" ? formatTime(t) : t; }
function bars(seed){ let h = 0; for(const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0; let out = ""; for(let i = 0; i < 26; i++){ h = (h * 1103515245 + 12345) >>> 0; out += `<i style="height:${28 + (h % 70)}%"></i>`; } return out; }
function pickMime(){
  if(typeof MediaRecorder === "undefined") return "";
  const list = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/aac"];
  for(const m of list){ try{ if(MediaRecorder.isTypeSupported(m)) return m; }catch(x){} }
  return "";
}

function mount(el, o){
  const S = { msgs: [], lastId: 0, theirSeen: 0, timer: null, dead: false, rec: null, audio: null, playing: null, cache: {}, err: "" };
  const ro = o.side === "a";
  el.classList.add("mqc");
  el.innerHTML = `<div class="mqc-msgs" role="log" aria-live="polite"><div class="mqc-keep">🕒 Messages are kept for 3 days</div><div class="mqc-list"></div></div>
    ${ro ? "" : `<div class="mqc-comp">
      ${o.canInvite ? `<button class="mqc-b" data-c="inv" title="Send today's class invite" aria-label="Send class invite">${ic("inv")}</button>` : ""}
      <textarea rows="1" placeholder="Message" maxlength="2000" aria-label="Message"></textarea>
      <button class="mqc-b" data-c="mic" title="Voice note" aria-label="Record a voice note">${ic("mic")}</button>
      <button class="mqc-b go" data-c="send" aria-label="Send">${ic("send")}</button></div>`}`;
  const box = el.querySelector(".mqc-msgs"), list = el.querySelector(".mqc-list"), ta = el.querySelector("textarea"), comp = el.querySelector(".mqc-comp");

  function nearBottom(){ return box.scrollHeight - box.scrollTop - box.clientHeight < 120; }
  function paint(stick){
    const keep = stick || nearBottom();
    if(S.err && !S.msgs.length){ list.innerHTML = `<div class="mqc-empty">${e(S.err)}</div>`; return; }
    if(!S.msgs.length){ list.innerHTML = `<div class="mqc-empty">${ro ? "No messages in the last 3 days." : "No messages yet. Say salaam 👋"}</div>`; return; }
    let h = "", last = "";
    S.msgs.forEach(m => {
      const k = dayKey(m.at); if(k !== last){ last = k; h += `<div class="mqc-day">${e(dayLabel(k))}</div>`; }
      const mine = !ro && m.from === o.side, who = m.from === "t" ? (o.names && o.names.t) || "Teacher" : (o.names && o.names.s) || "Student";
      let body;
      if(m.kind === "voice"){
        const on = S.playing === m.id;
        body = `<div class="mqc-vn"><button data-c="play" data-id="${m.id}" aria-label="${on ? "Pause" : "Play"} voice note">${ic(on ? "pause" : "play")}</button>
          <div class="mqc-wave${on ? " on" : ""}">${bars(m.id)}</div><span>${m.meta && m.meta.dur ? Math.floor(Math.round(m.meta.dur) / 60) + ":" + pad(Math.round(m.meta.dur) % 60) : ""}</span></div>`;
      } else if(m.kind === "invite"){
        const meta = m.meta || {};
        body = `<div class="mqc-inv"><small>CLASS INVITE</small><b>${e(fmtDate(meta.date))}${meta.time ? " · " + e(fmtTime(meta.time)) : ""}</b>
          ${o.side === "s" ? `<button class="mqc-join" data-c="join" data-id="${m.id}">${ic("video")} Join class</button>` : `<span class="mqc-sub">${o.side === "t" ? "Sent to the student" : "Invite from the teacher"}</span>`}</div>`;
      } else body = e(m.body).replace(/\n/g, "<br>");
      const seen = mine && m.id <= S.theirSeen ? " · Seen" : "";
      h += `<div class="mqc-m ${mine ? "me" : "them"}${m.kind === "invite" ? " inv" : ""}">${ro ? `<span class="mqc-who">${e(who)}</span>` : ""}${body}<time>${e(hm(m.at))}${seen}</time></div>`;
    });
    list.innerHTML = h;
    if(keep) box.scrollTop = box.scrollHeight;
  }
  async function pull(first){
    if(S.dead) return;
    try{
      const out = await o.api.list(first ? 0 : S.lastId);
      if(S.dead) return;
      if(!out || out.result !== "success"){
        const why = out && out.error;
        S.err = why === "chat_off" || why === "no_chat" ? "Chat is switched off for this class." : why === "signed_out" ? "Signed out — please sign in again." : "Could not load messages.";
        if(first || why) paint(); return;
      }
      S.err = "";
      const fresh = (out.messages || []).filter(m => m.id > S.lastId);
      if(first){ S.msgs = out.messages || []; }
      else S.msgs = S.msgs.concat(fresh);
      const cut = Date.now() - 72 * 3600e3;
      S.msgs = S.msgs.filter(m => new Date(m.at).getTime() > cut);
      S.lastId = S.msgs.reduce((a, m) => Math.max(a, m.id), S.lastId);
      const seenChanged = (out.theirSeen || 0) !== S.theirSeen; S.theirSeen = out.theirSeen || 0;
      if(first || fresh.length || seenChanged) paint(first || fresh.some(m => m.from === o.side));
    }catch(x){ if(first){ S.err = "Could not load messages."; paint(); } }
  }
  function schedule(){
    clearInterval(S.timer);
    S.timer = setInterval(() => { if(!document.hidden && document.body.contains(el)) pull(false); else if(!document.body.contains(el)) api.destroy(); }, o.pollMs || 5000);
  }
  async function send(msg){
    const out = await o.api.send(msg);
    if(out && out.result === "success"){ await pull(false); return true; }
    toast(out && out.error === "slow" ? "Too many messages — wait a minute" : (out && out.error) || "Could not send");
    return false;
  }
  function toast(t){ if(typeof o.toast === "function") return o.toast(t); const d = document.createElement("div"); d.className = "mqc-toast"; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); }

  /* ---- voice ---- */
  async function startRec(){
    const mime = pickMime();
    if(!mime || !navigator.mediaDevices){ toast("Voice notes need a newer browser"); return; }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch(x){ toast("Allow the microphone to send a voice note"); return; }
    const rec = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
    const chunks = []; rec.ondataavailable = ev => { if(ev.data && ev.data.size) chunks.push(ev.data); };
    S.rec = { rec, stream, chunks, t0: Date.now(), mime, cancel: false };
    rec.onstop = () => finishRec();
    rec.start(250);
    comp.classList.add("rec");
    comp.insertAdjacentHTML("afterbegin", `<div class="mqc-rec"><i></i><span>0:00</span><small>Recording… tap ✓ to send</small></div>`);
    el.querySelector('[data-c="mic"]').innerHTML = ic("x"); el.querySelector('[data-c="mic"]').dataset.c = "cancel";
    S.rec.tick = setInterval(() => { const s = Math.floor((Date.now() - S.rec.t0) / 1000); const sp = el.querySelector(".mqc-rec span"); if(sp) sp.textContent = "0:" + pad(s); if(s >= MAX_SEC) stopRec(false); }, 250);
  }
  function stopRec(cancel){ if(!S.rec) return; S.rec.cancel = cancel; clearInterval(S.rec.tick); try{ S.rec.rec.stop(); }catch(x){ finishRec(); } }
  function finishRec(){
    const r = S.rec; if(!r) return; S.rec = null;
    r.stream.getTracks().forEach(t => t.stop());
    comp.classList.remove("rec"); const rb = el.querySelector(".mqc-rec"); if(rb) rb.remove();
    const b = el.querySelector('[data-c="cancel"]'); if(b){ b.dataset.c = "mic"; b.innerHTML = ic("mic"); }
    if(r.cancel || !r.chunks.length) return;
    const dur = Math.min(MAX_SEC, Math.max(1, Math.round((Date.now() - r.t0) / 1000)));
    const blob = new Blob(r.chunks, { type: r.mime.split(";")[0] });
    const fr = new FileReader();
    fr.onload = () => { const b64 = String(fr.result).split(",")[1] || ""; send({ kind: "voice", mime: r.mime, audio: b64, meta: { dur } }); };
    fr.readAsDataURL(blob);
  }
  async function play(id){
    if(S.audio){ S.audio.pause(); S.audio = null; }
    if(S.playing === id){ S.playing = null; paint(); return; }
    S.playing = id; paint();
    try{
      let url = S.cache[id];
      if(!url){
        const out = await o.api.voice(id);
        if(!out || out.result !== "success"){ toast((out && out.error) || "Could not play"); S.playing = null; paint(); return; }
        const bin = atob(out.audio), arr = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        url = S.cache[id] = URL.createObjectURL(new Blob([arr], { type: out.mime }));
      }
      if(S.playing !== id) return;
      const a = S.audio = new Audio(url);
      a.onended = () => { if(S.playing === id){ S.playing = null; paint(); } };
      await a.play();
    }catch(x){ toast("This phone could not play the voice note"); S.playing = null; paint(); }
  }

  /* ---- events ---- */
  el.addEventListener("click", async ev => {
    const b = ev.target.closest("[data-c]"); if(!b) return;
    const c = b.dataset.c;
    if(c === "send"){
      if(S.rec){ stopRec(false); return; }
      const t = (ta.value || "").trim(); if(!t) return;
      b.disabled = true; const ok = await send({ kind: "text", body: t }); b.disabled = false;
      if(ok){ ta.value = ""; ta.style.height = ""; ta.focus(); }
    }
    else if(c === "mic") startRec();
    else if(c === "cancel") stopRec(true);
    else if(c === "play") play(+b.dataset.id);
    else if(c === "join"){ const m = S.msgs.find(x => x.id === +b.dataset.id); if(m && o.onJoin) o.onJoin(m.meta || {}); }
    else if(c === "inv" && o.onInvite) o.onInvite();
  });
  if(ta){
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    ta.addEventListener("keydown", ev => { if(ev.key === "Enter" && !ev.shiftKey && window.matchMedia("(hover:hover)").matches){ ev.preventDefault(); el.querySelector('[data-c="send"]').click(); } });
  }
  const onVis = () => { if(!document.hidden) pull(false); };
  document.addEventListener("visibilitychange", onVis);

  const api = {
    destroy(){ S.dead = true; clearInterval(S.timer); if(S.rec) stopRec(true); if(S.audio) S.audio.pause(); Object.values(S.cache).forEach(u => URL.revokeObjectURL(u)); document.removeEventListener("visibilitychange", onVis); },
    refresh(){ return pull(false); },
    sendInvite(meta){ return send({ kind: "invite", meta }); }
  };
  list.innerHTML = '<div class="mqc-empty">Loading…</div>';
  pull(true).then(schedule);
  return api;
}
window.MQChat = { mount };
})();
