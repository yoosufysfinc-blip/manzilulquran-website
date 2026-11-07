/* =====================================================================
   ManzilulQuran · Hifz Learning App — the tutorial video (v1)

   One button in the help dialog, one player over the page. Nothing else:
   no language switch, no 3D card, no end card. The student presses it,
   watches, and closes it.

   The file lives in the academy's Cloudflare R2 bucket (mq-media), served
   from media.manzilulquran.in, the same place the course videos are served
   from. To put up a new cut, upload it under a new name and change the one
   line below — a name already served is never overwritten, so nobody is
   left with a half-cached mix of the old file and the new one.
   ===================================================================== */
(function () {
  'use strict';

  const VIDEO = {
    src: 'https://media.manzilulquran.in/hifz-app-tutorial-v1.mp4',
    poster: 'https://media.manzilulquran.in/hifz-app-tutorial-poster.jpg',
    title: 'How to use the Hifz Learning App'
  };

  const $ = s => document.querySelector(s);
  const dlg = $('#dlgVideo');
  const vid = $('#tutVideo');
  if (!dlg || !vid) return;

  $('#tutTitle').textContent = VIDEO.title;

  // Nothing is fetched until the student asks for it — not the video, not even
  // the poster: on a phone on mobile data an unopened tutorial costs nothing.
  let loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    if (VIDEO.poster) vid.poster = VIDEO.poster;
    const src = document.createElement('source');
    src.src = VIDEO.src;
    src.type = 'video/mp4';
    // A <source> that fails reports it on itself and does not bubble, so the
    // listener goes here as well as on the video.
    src.addEventListener('error', fail);
    vid.appendChild(src);
    vid.load();
  }

  function open() {
    load();
    dlg.classList.remove('err');
    if (typeof dlg.showModal === 'function' && !dlg.open) dlg.showModal();
    else dlg.setAttribute('open', '');
    // the browser may refuse to start without a tap of its own; the controls stay
    const go = vid.play();
    if (go && go.catch) go.catch(() => { /* the student presses play */ });
  }
  function close() {
    vid.pause();
    if (dlg.open && typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  function fail() { dlg.classList.add('err'); }
  vid.addEventListener('error', fail);
  dlg.addEventListener('close', () => { vid.pause(); });
  // tapping the dark area around the video closes it
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  document.addEventListener('click', e => {
    const t = e.target.closest && e.target.closest('[data-tut]');
    if (!t) return;
    e.preventDefault();
    if (t.dataset.tut === 'close') close(); else open();
  });

  // the help dialog scrolls behind the player; closing it should stop the video
  const tips = $('#dlgTips');
  if (tips) tips.addEventListener('close', close);
})();
