/* =====================================================================
   ManzilulQuran · Hifz Learning App — the student's own door (v1)
   Opened from a student's class sheet when their course is Hifz.

   What this file does, and nothing more:
     · reads the name and the student id out of the link,
     · keeps one learning space per student in THIS browser,
     · plays the opening, then hands the page to HifzLearn.

   There is no dashboard here, no student list, no password and no account
   to create: the class sheet has already decided who this is. Nothing is
   sent anywhere — the lesson, the settings and the progress stay in this
   browser, exactly as they do in the academy's own copy of the app. A later
   step can move them to the Hifz Report's Supabase without touching this
   page, because every read and write still goes through HifzStore.

   The link:  student.html?n=<student name>&k=<student id>
     n  the name as the class sheet shows it — displayed, never trusted as markup
     k  the class sheet's Student ID — only used to name this browser's storage
     #lesson=S:F-T  or  #page=N   opens straight into that lesson (optional)
   ===================================================================== */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const param = new URLSearchParams(location.search);
  const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

  /* ---------- who is learning ----------
     The id names this browser's storage, so it must be the same every time
     the same student opens their sheet, and different for a sibling sharing
     the phone. The class sheet's Student ID does that; the name is the
     fallback. HifzStore ids are 's' + 6–20 letters or digits, so whatever
     comes in is folded into that shape, with a short checksum of the whole
     value appended so two ids cannot collide after the folding. */
  function storeId(raw) {
    const v = txt(raw, 80).toLowerCase();
    if (!v) return 'sguest00';
    let h = 5381;
    for (let i = 0; i < v.length; i++) h = ((h * 33) ^ v.charCodeAt(i)) >>> 0;
    const base = v.replace(/[^a-z0-9]/g, '').slice(0, 12);
    return ('s' + base + h.toString(36)).slice(0, 20);
  }

  const name = txt(param.get('n'), 60) || 'Student';
  const sid = storeId(param.get('k') || param.get('n') || '');

  // the record this browser keeps for them; an existing one keeps its settings
  const student = Object.assign(HifzStore.get(sid) || {}, { id: sid, name: name, status: 'active' });
  const saved = HifzStore.save(student);
  const me = saved.ok ? saved.student : HifzStore.clean(student);

  $('#stuName').textContent = me.name;
  $('#spName').textContent = me.name;
  document.title = me.name + ' · Hifz Learning';

  /* ---------- the opening ----------
     It covers the page while the app draws behind it, so the student never
     sees a half-built screen. It leaves after the app is ready and the
     animation has had its moment — whichever is later — and a hard ceiling
     makes sure a slow network can never leave it stuck. */
  const splash = $('#splash');
  const quick = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOLD = quick ? 260 : 1500, CEILING = quick ? 900 : 3200;
  const opened = Date.now();
  let gone = false;
  function dismiss() {
    if (gone) return;
    gone = true;
    const wait = Math.max(0, HOLD - (Date.now() - opened));
    setTimeout(() => {
      splash.classList.add('out');
      setTimeout(() => { splash.remove(); document.body.classList.add('ready'); }, quick ? 160 : 420);
    }, wait);
  }
  setTimeout(dismiss, CEILING);

  /* ---------- hand over to the learner ---------- */
  const params = () => new URLSearchParams(location.hash.replace(/^#/, ''));
  HifzLearn.boot();
  HifzLearn.mount(me, params());
  window.addEventListener('hashchange', () => HifzLearn.route(params()));

  // the fonts decide how the Arabic sits on the line, so wait for them if we can
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 2200))]).then(dismiss, dismiss);

  /* ---------- the way back ----------
     The class sheet opens this in a tab of its own, so closing it returns the
     student to their sheet. A tab the browser will not let us close keeps its
     own Back button, and the button stays hidden rather than lying. */
  if (window.opener || history.length <= 1) {
    const b = $('#btnClose');
    b.hidden = false;
    b.addEventListener('click', () => {
      window.close();
      setTimeout(() => { if (!window.closed) { if (history.length > 1) history.back(); else b.hidden = true; } }, 120);
    });
  }
})();
