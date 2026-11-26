/* =================================================================
   ░░  ManzilulQuran — CHAT TAB ON THE STUDENT'S CLASS SHEET  v1  ░░
   -----------------------------------------------------------------
   Individual class sheets only (?t=TOKEN). Shows the Chat tab when the
   student's teacher has chat switched on, with a dot for unread
   messages. One thread per class/teacher; if a student has more than
   one teacher, a small switcher picks the teacher.
   The share token is the door — the same as the class sheet itself.
   Needs api.v7.js and chat.v1.js; the page needs #tabChat, #tabChatDot
   and #panel-chat.
   PUBLISHED FILES ARE IMMUTABLE. Create chat-student.v2.js to change this.
   ================================================================= */
(function(){
"use strict";
const q = new URLSearchParams(location.search);
const TOK = (q.get("t") || "").trim();
if(!TOK || q.get("b") || q.get("tb") || typeof studentChat !== "function") return;
const tab = document.getElementById("tabChat"), dot = document.getElementById("tabChatDot"), panel = document.getElementById("panel-chat");
if(!tab || !panel) return;
const e = s => escapeHtml(s == null ? "" : String(s));
let threads = [], cur = "", ctrl = null;

function isOpen(){ return panel.classList.contains("show"); }
async function loadThreads(){
  let out;
  try{ out = await studentChat(TOK, { action: "threads" }); }catch(x){ return; }
  if(!out || out.result !== "success"){ if(out && out.error === "no_chat"){ tab.hidden = true; } return; }
  threads = out.threads || [];
  tab.hidden = !threads.length;
  const unread = threads.reduce((a, t) => a + (t.unread || 0), 0);
  if(dot) dot.hidden = !unread || isOpen();
  if(isOpen() && !ctrl) open();
  if(isOpen() && threads.length > 1) paintSwitch();
}
function paintSwitch(){
  const sw = panel.querySelector(".mqs-switch"); if(!sw) return;
  sw.innerHTML = threads.map(t => `<button class="${t.planId === cur ? "on" : ""}" data-plan="${e(t.planId)}">${e(t.teacher.split(" ")[0])} · ${e(t.course)}${t.unread && t.planId !== cur ? ` <i>${t.unread}</i>` : ""}</button>`).join("");
}
function open(){
  if(!threads.length) return;
  if(!cur || !threads.some(t => t.planId === cur)) cur = (threads.find(t => t.unread) || threads[0]).planId;
  const t = threads.find(x => x.planId === cur);
  if(ctrl){ ctrl.destroy(); ctrl = null; }
  panel.innerHTML = `<div class="mqs-head"><div><small>Chat with your teacher</small><b>${e(t.teacher)}</b></div><span>${e(t.course)}</span></div>
    ${threads.length > 1 ? '<div class="mqs-switch"></div>' : ""}<div class="mqs-box"></div>
    <p class="mqs-note">Only you and your teacher (and the academy office) can see this chat.</p>`;
  if(threads.length > 1) paintSwitch();
  t.unread = 0; if(dot) dot.hidden = true;
  ctrl = MQChat.mount(panel.querySelector(".mqs-box"), {
    side: "s", names: { t: t.teacher.split(" ")[0], s: "You" },
    api: { list: after => studentChat(TOK, { action: "list", planId: t.planId, after }),
           send: msg => studentChat(TOK, Object.assign({ action: "send", planId: t.planId }, msg)),
           voice: id => studentChat(TOK, { action: "voice", planId: t.planId, msgId: id }) },
    onJoin: meta => { location.href = (typeof mqUrl === "function" ? mqUrl("/join/") : "/join/") + "?t=" + encodeURIComponent(TOK) + "&dt=" + encodeURIComponent(meta.date || ""); }
  });
}
tab.addEventListener("click", () => { setTimeout(open, 0); });
panel.addEventListener("click", ev => { const b = ev.target.closest("[data-plan]"); if(b){ cur = b.dataset.plan; open(); } });
/* leaving the tab stops the 5-second check; coming back starts it again */
document.querySelectorAll(".tab").forEach(t => { if(t !== tab) t.addEventListener("click", () => { if(ctrl){ ctrl.destroy(); ctrl = null; } }); });
loadThreads();
setInterval(() => { if(!document.hidden && !isOpen()) loadThreads(); }, 45000);
})();
