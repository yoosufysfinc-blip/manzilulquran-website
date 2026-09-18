/* =========================================================================
   ManzilulQuran · Course Explainer — Hifz data
   assets/explainer/hifz.v1.js

   Data only. All behaviour lives in engine.v1.js.
   To add another course, copy this file and change the contents — no
   engine changes needed unless the course needs a new scene type.

   Timings are estimates until the voice track is recorded, at which point
   each `t` is snapped to the real audio.
   ====================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('course-explainer');
  if (!root || !window.Explainer) return;

  /* Demo figures follow the study-report app's own arithmetic:
     summarize() computes pct = cumLines / config.total, config.total = 9060 */
  var LINES = 3180, TOTAL = 9060;

  window.Explainer.mount({
    root: root,
    end: 108.5,

    /* ---------------- narration ----------------
       *asterisks* mark words highlighted in gold as they are spoken   */
    script: [
      { t: 0.5,   sc: 'pOpen',  tx: "At ManzilulQuran, Hifz is not simply about memorising something *new* *every* *day.*" },
      { t: 6.4,   sc: 'pOpen',  tx: "It is a *structured* *system,* built around each child's own ability, capacity and time." },
      { t: 12.6,  sc: 'format', tx: "Classes are *live,* *one-to-one,* six days a week." },
      { t: 17.8,  sc: 'format', tx: "Each session runs about *fifty* *minutes,* and moves at the pace of the *child.*" },
      { t: 24.4,  sc: 'areas',  tx: "Every class gives attention to *three* *areas.*" },
      { t: 28.6,  sc: 'areas',  tx: "The *New* *Lesson,* the *Sabq* revision, and the *Old* *Lesson.*" },
      { t: 36.4,  sc: 'loop',   tx: "So while the child moves forward into new portions of the Qur'an," },
      { t: 42.2,  sc: 'loop',   tx: "everything already memorised keeps *coming* *back* — again and again." },
      { t: 50.4,  sc: 'beat',   tx: "*Nothing* is left to memory." },
      { t: 54.8,  sc: 'exam',   tx: "At the end of every month, an *examination.*" },
      { t: 61.4,  sc: 'juz',    tx: "And when a Juz is complete, it is recited to the *Chief* *Examiner* before the next Juz begins." },
      { t: 72.0,  sc: 'report', tx: "Every student has their *own* *report.*" },
      { t: 76.4,  sc: 'report', tx: "Months tracked, *lines* *memorised,* attendance — all of it recorded." },
      { t: 84.4,  sc: 'parent', tx: "Parents receive their own *link.*" },
      { t: 90.8,  sc: 'pClose', tx: "Our goal is not simply that a child *memorises* the Qur'an." },
      { t: 95.4,  sc: 'pClose', tx: "It is that they *keep* it, *revise* it, and carry it with *confidence.*" },
      { t: 101.0, sc: 'cta',    tx: "Hifzul Qur'an at ManzilulQuran. *Enrolment* *is* *open.*" }
    ],

    /* ---------------- scenes ---------------- */
    scenes: {
      /* Drop `src` and `poster` in once the clips are filmed; until then
         the engine renders a dashed placeholder in the same slot.       */
      pOpen: {
        type: 'presenter', start: 0.5,
        label: 'Presenter · English', hint: 'to be filmed'
        // src: '../assets/explainer/media/hifz/presenter-open-en.mp4',
        // poster: '../assets/explainer/media/hifz/presenter-open-en.jpg'
      },

      format: {
        type: 'tiles', eyebrow: 'How the class runs',
        from: 13.6, step: 2.5, hold: 2.7,
        items: [
          { big: 'Live', cap: 'Not recorded' },
          { big: '1:1',  cap: 'One teacher, one child' },
          { big: '6',    count: 6,  cap: 'Days a week' },
          { big: '50',   count: 50, cap: 'Minutes a session' }
        ]
      },

      areas: {
        type: 'rows', eyebrow: 'Every class · three areas',
        from: 25.4, step: 2.6, hold: 2.6,
        items: [
          { t: 'New Lesson',       s: 'The portion committed to memory today' },
          { t: 'Sabq (Revision)',  s: 'What was memorised in recent days' },
          { t: 'Old Lesson',       s: 'Everything held from before' }
        ]
      },

      loop: {
        type: 'orbit', eyebrow: 'Nothing moves on alone',
        start: 36.4, period: 9, dots: 18,
        legend: [
          { color: '#2fae7f', label: 'New Lesson' },
          { color: '#8ab98f', label: 'Sabq' },
          { color: '#C9A96E', label: 'Old Lesson' }
        ]
      },

      beat: {
        type: 'beat',
        parts: [
          { w: 'Nothing' }, { w: 'is' }, { w: 'left' }, { br: true },
          { w: 'to' }, { w: 'memory.', em: true }
        ]
      },

      exam: {
        type: 'calendar', badge: 'Monthly examination',
        cells: 28, from: 55.4, to: 59.0, examAt: 58.8
      },

      juz: {
        type: 'medal',
        ar: 'جزء', label: 'JUZ 1 · COMPLETE',
        stamp: 'Recited to the Chief Examiner',
        stampAt: 65.2, pips: 30, nextAt: 68.6
      },

      report: {
        type: 'card', eyebrow: 'Hifz Command Center',
        name: 'Muhammad Ameen',
        meta: 'Updated 14 Sep · 14 months tracked',
        rowAt: 73.4,
        ring: { value: LINES / TOTAL * 100, from: 74.0, to: 78.4 },
        stats: [
          { value: LINES, label: 'lines memorised', from: 74.6, to: 79.2 },
          { value: 96, suffix: '%', label: 'attendance', from: 76.0, to: 79.8 }
        ]
      },

      parent: {
        type: 'phone',
        link: 'manzilulquran.in/portal/study-report/'
      },

      pClose: {
        type: 'presenter', start: 90.8,
        label: 'Presenter · closing', hint: 'to be filmed'
        // src: '../assets/explainer/media/hifz/presenter-close-en.mp4',
        // poster: '../assets/explainer/media/hifz/presenter-close-en.jpg'
      },

      cta: {
        type: 'cta',
        crest: '﷽',
        mark: ['Manzilul', 'Quran'],
        fee: '₹3,000 per month',
        cta: 'Enquire about Hifz',
        href: '../join/',
        tagline: 'manzilulquran.in'
      }
    },

    /* Narration. Two tracks, because the presenter's own voice covers the
       gap between them. Uncomment once recorded.
         narration-a  → 12.6s to 90.8s   (format … parent)
         narration-b  → 101.0s to 108.5s (cta)                          */
    // media: [
    //   { src: '../assets/explainer/media/hifz/narration-a-en.mp3', start: 12.6,
    //     scenes: ['format','areas','loop','beat','exam','juz','report','parent'] },
    //   { src: '../assets/explainer/media/hifz/narration-b-en.mp3', start: 101.0,
    //     scenes: ['cta'] }
    // ],

    langs: [
      { label: 'English', active: true },
      { label: 'മലയാളം', disabled: true, title: 'Awaiting Malayalam voice track' }
    ]
  });
})();
