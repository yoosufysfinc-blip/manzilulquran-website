/* =================================================================
   ManzilulQuran — NOTICE BOARD  v1
   -----------------------------------------------------------------
   Renders the notices a student receives. Shared, because the batch
   page will show the same board and neither page should own a second
   copy of these animations.

   The server has ALREADY filtered these: a student is only ever sent
   notices addressed to them and live today. Nothing here decides who
   sees what — it only decides how it looks.

   "Seen" is per device, in localStorage, keyed by notice id. That is
   deliberate: an announcement should announce itself once, not lunge
   at the student every time they open their sheet. The academy can
   still force a re-read by editing the notice, because an edited
   notice keeps its id but the student may not have dismissed it.

   PUBLISHED FILES ARE IMMUTABLE. Create notices.v2.js to change this.
   ================================================================= */

const NTC_SEEN_KEY = 'mq_notice_seen';

/* ---------------- Seen state ---------------- */
function ntcSeen(){
  try{
    const raw = localStorage.getItem(NTC_SEEN_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  }catch(e){ return {}; }
}
function ntcMarkSeen(id){
  try{
    const s = ntcSeen();
    s[id] = Date.now();
    localStorage.setItem(NTC_SEEN_KEY, JSON.stringify(s));
  }catch(e){}
}
function ntcUnseen(notices){
  const seen = ntcSeen();
  return (notices || []).filter(n => !seen[n.id]);
}

/* ---------------- Type presentation ---------------- */
const NTC_LOOK = {
  info:        { icon: 'M12 16v-4M12 8h.01', label: 'Notice' },
  urgent:      { icon: 'M12 9v4M12 17h.01', label: 'Important' },
  holiday:     { icon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z', label: 'Holiday' },
  celebration: { icon: 'M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z', label: 'Good news' }
};
function ntcLook(type){ return NTC_LOOK[type] || NTC_LOOK.info; }

function ntcIcon(type){
  const d = ntcLook(type).icon;
  const circle = (type === 'info' || type === 'urgent')
    ? '<circle cx="12" cy="12" r="10"/>' : '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round">${circle}<path d="${d}"/></svg>`;
}

/* ---------------- The bell ---------------- */
function ntcRenderBell(notices){
  const bell = document.getElementById('ntcBell');
  if(!bell) return;

  const unseen = ntcUnseen(notices).length;
  const dot = document.getElementById('ntcCount');

  bell.hidden = !(notices && notices.length);
  if(dot){
    dot.textContent = unseen > 9 ? '9+' : String(unseen);
    dot.hidden = unseen === 0;
  }
  bell.classList.toggle('has-new', unseen > 0);
}

/* ---------------- The list ---------------- */
function ntcRenderList(notices){
  const wrap = document.getElementById('ntcList');
  if(!wrap) return;

  if(!notices || !notices.length){
    wrap.innerHTML = '<div class="ntc-empty">No notices right now.</div>';
    return;
  }

  const seen = ntcSeen();
  wrap.innerHTML = notices.map((n, i) => `
    <article class="ntc-card ntc-${escapeHtml(n.type)}${seen[n.id] ? '' : ' fresh'}"
             style="animation-delay:${Math.min(i * 70, 420)}ms">
      <div class="ntc-head">
        <span class="ntc-ico">${ntcIcon(n.type)}</span>
        <div class="ntc-headtext">
          <h4>${escapeHtml(n.title)}</h4>
          <span class="ntc-kind">${escapeHtml(ntcLook(n.type).label)}${n.pinned ? ' · Pinned' : ''}</span>
        </div>
      </div>
      <p class="ntc-msg">${escapeHtml(n.message).replace(/\n/g, '<br>')}</p>
      ${n.end ? `<div class="ntc-until">Until ${fmtDate(n.end)}</div>` : ''}
    </article>`).join('');
}

/* ---------------- The ticker ----------------
   Pinned notices only, running under the header. Deliberately quiet:
   it repeats all day, so it must never demand attention. */
function ntcRenderTicker(notices){
  const bar = document.getElementById('ntcTicker');
  if(!bar) return;

  const pinned = (notices || []).filter(n => n.pinned);
  if(!pinned.length){ bar.hidden = true; bar.innerHTML = ''; return; }

  const text = pinned.map(n => escapeHtml(n.title)).join('   ·   ');
  bar.innerHTML = `<div class="ntc-tick-track"><span>${text}</span><span aria-hidden="true">${text}</span></div>`;
  bar.hidden = false;
}

/* ---------------- The announcement ----------------
   Shown once per device, for the most important unseen notice. Urgent
   beats celebration beats holiday beats info; within a type, whatever
   the server put first. Only ONE is ever shown at a time — a stack of
   modal announcements is how a student learns to dismiss without
   reading. The rest are waiting in the tab. */
const NTC_WEIGHT = { urgent: 0, celebration: 1, holiday: 2, info: 3 };

function ntcAnnounce(notices, onOpenList){
  const modal = document.getElementById('ntcModal');
  if(!modal) return;

  const unseen = ntcUnseen(notices).slice().sort(
    (a, b) => (NTC_WEIGHT[a.type] ?? 9) - (NTC_WEIGHT[b.type] ?? 9)
  );
  if(!unseen.length) return;

  const n = unseen[0];
  const more = unseen.length - 1;

  modal.className = 'ntc-modal ntc-' + n.type;
  modal.innerHTML = `
    <div class="ntc-modal-card">
      ${n.type === 'celebration' ? '<div class="ntc-burst" aria-hidden="true">' +
        Array.from({length: 12}, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join('') + '</div>' : ''}
      ${n.type === 'urgent' ? '<div class="ntc-sweep" aria-hidden="true"></div>' : ''}
      <span class="ntc-modal-ico">${ntcIcon(n.type)}</span>
      <div class="ntc-modal-kind">${escapeHtml(ntcLook(n.type).label)}</div>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.message).replace(/\n/g, '<br>')}</p>
      ${more > 0 ? `<div class="ntc-more">${more} more notice${more === 1 ? '' : 's'} in the Notices tab</div>` : ''}
      <button class="ntc-got" type="button">Got it</button>
    </div>`;

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('show'));

  const close = () => {
    ntcMarkSeen(n.id);
    modal.classList.remove('show');
    setTimeout(() => { modal.hidden = true; }, 320);
    ntcRenderBell(notices);
    ntcRenderList(notices);
    if(more > 0 && typeof onOpenList === 'function') onOpenList();
  };

  modal.querySelector('.ntc-got').addEventListener('click', close);
  modal.addEventListener('click', (e) => { if(e.target === modal) close(); });
}

/* Mark everything read — used when the student opens the Notices tab,
   because at that point they have genuinely been shown. */
function ntcMarkAllSeen(notices){
  (notices || []).forEach(n => ntcMarkSeen(n.id));
}
