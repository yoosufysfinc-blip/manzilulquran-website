/* =========================================================================
   ManzilulQuran · Course Explainer — Madrasa Batch data
   assets/explainer/madrasa-batch.v1.js

   Same language model: all on-screen animation text is English in every
   version; only the caption track changes. ?lang= picks it, default ml.

   Each scene also declares a camera move — push, pull, panL, panR, tilt or
   orbit — so the frame is always travelling rather than sitting still.

   FEE NOTE — NEEDS VERIFICATION
   The supplied dialogue says ₹980 per month. The live
   fees/madrasa-batch.html still shows ₹799 (data-count="799"). These figures
   follow the dialogue; the page's own stat chip needs updating to match
   before this goes live, or the card and the video will contradict each
   other on the same screen.
   ====================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('course-explainer');
  if (!root || !window.Explainer) return;

  var q = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  var LANG = (q === 'en') ? 'en' : 'ml';
  var M = '../assets/explainer/media/madrasa-batch/';

  var CAPTIONS = {

    ml: [
      { t: 0.5,   sc: 'pOpen',      tx: "ManzilulQuran-ന്റെ *Madrasa* *Batch* *Class.*" },
      { t: 5.0,   sc: 'pOpen',      tx: "ഖുർആൻ പഠനത്തോടൊപ്പം, കുട്ടികൾക്ക് ആവശ്യമായ അടിസ്ഥാന ഇസ്‌ലാമിക അറിവുകൾ" },
      { t: 10.6,  sc: 'pOpen',      tx: "ക്രമമായി പഠിക്കാനുള്ള ഒരു *structured* *learning* *program.*" },

      { t: 16.0,  sc: 'subjects',   tx: "ഖുർആൻ പഠനം, അഖീദ, ഫിഖ്ഹ്, ഹദീസ്, ദുആകൾ, നമസ്കാരം," },
      { t: 24.0,  sc: 'subjects',   tx: "ഇസ്‌ലാമിക ചരിത്രം, നല്ല സ്വഭാവം, ദൈനംദിന ജീവിതത്തിലെ ഇസ്‌ലാമിക രീതികൾ — *എല്ലാം* പഠനത്തിന്റെ ഭാഗമാണ്." },

      { t: 34.0,  sc: 'batch',      tx: "Individual class-ൽ നിന്ന് വ്യത്യസ്തമായി, ഇവിടെ കുട്ടികൾ *batch* *ആയി* *ഒരുമിച്ച്* പഠിക്കുന്നു." },
      { t: 41.0,  sc: 'batch',      tx: "അതിലൂടെ regular learning-ഉം revision-ഉം practice-ഉം ഉൾപ്പെടുത്തിയ *systematic* പഠനരീതി സാധ്യമാകുന്നു." },

      { t: 48.0,  sc: 'frequency',  tx: "ആഴ്ചയിൽ *അഞ്ച്* *ദിവസമാണ്* ക്ലാസുകൾ." },
      { t: 52.6,  sc: 'frequency',  tx: "തുടർച്ചയായ പഠനത്തിലൂടെ പഠിച്ച കാര്യങ്ങൾ *revise* ചെയ്യാനും *practice* ചെയ്യാനും കൂടുതൽ അവസരം." },

      { t: 59.0,  sc: 'timing',     tx: "മദ്രസാ Batch Classes *വൈകുന്നേരം* *മുതൽ* ലഭ്യമായ fixed timings-ലാണ്." },
      { t: 65.0,  sc: 'timing',     tx: "ഓരോ batch-നും അതിന്റേതായ ക്ലാസ് സമയമാണ് ഉണ്ടായിരിക്കുക." },

      { t: 70.0,  sc: 'counsellor', tx: "നിങ്ങളുടെ കുട്ടിക്ക് അനുയോജ്യമായ batch അറിയാൻ, ഞങ്ങളുടെ *Admin* *Counsellor*-ുമായി സംസാരിക്കാം." },
      { t: 76.0,  sc: 'counsellor', tx: "കുട്ടിയുടെ ആവശ്യത്തിനും ലഭ്യമായ batch timings-നും അനുസരിച്ച് സഹായിക്കും." },

      { t: 80.0,  sc: 'support',    tx: "Structured *study* *materials,* regular revision, practice activities," },
      { t: 86.0,  sc: 'support',    tx: "teacher guidance, കൂടാതെ learning *progress* നിരീക്ഷിക്കുന്നതിനുള്ള support-ഉം ലഭ്യമാണ്." },

      { t: 94.0,  sc: 'fee',        tx: "ആഴ്ചയിൽ അഞ്ച് ദിവസത്തെ Madrasa Batch Class-ിന് പ്രതിമാസം *980* രൂപയാണ്." },

      { t: 102.0, sc: 'pClose',     tx: "ക്രമമായ പഠനം, സ്ഥിരമായ practice, അധ്യാപകരുടെ guidance — *എല്ലാം* *ഒരുമിച്ച്.*" },
      { t: 108.0, sc: 'pClose',     tx: "നിങ്ങളുടെ കുട്ടിക്ക് അനുയോജ്യമായ batch അറിയാൻ *ഇന്ന്* *തന്നെ* ബന്ധപ്പെടൂ." },

      { t: 113.0, sc: 'cta',        tx: "ManzilulQuran — *Madrasa* *Batch* *Class.*" }
    ],

    en: [
      { t: 0.5,   sc: 'pOpen',      tx: "This is ManzilulQuran's *Madrasa* *Batch* *Class.*" },
      { t: 5.0,   sc: 'pOpen',      tx: "Alongside the Qur'an, the Islamic knowledge every child needs —" },
      { t: 10.6,  sc: 'pOpen',      tx: "taught in order, as a *structured* *learning* *program.*" },

      { t: 16.0,  sc: 'subjects',   tx: "Qur'an, Aqīdah, Fiqh, Hadīth, the du'ās, Salāh," },
      { t: 24.0,  sc: 'subjects',   tx: "Islamic history, good character and daily practice — *all* part of the syllabus." },

      { t: 34.0,  sc: 'batch',      tx: "Unlike the individual class, here children learn *together,* *as* *a* *batch.*" },
      { t: 41.0,  sc: 'batch',      tx: "That makes regular learning, revision and practice possible as one *systematic* method." },

      { t: 48.0,  sc: 'frequency',  tx: "Classes run *five* *days* a week." },
      { t: 52.6,  sc: 'frequency',  tx: "Continuous study means more chances to *revise* and to *practise* what was learned." },

      { t: 59.0,  sc: 'timing',     tx: "Batch classes run at fixed timings from the *evening* *onwards.*" },
      { t: 65.0,  sc: 'timing',     tx: "Each batch has its own class hour." },

      { t: 70.0,  sc: 'counsellor', tx: "To find the batch that suits your child, speak to our *Admin* *Counsellor.*" },
      { t: 76.0,  sc: 'counsellor', tx: "They will match your child's needs to the timings available." },

      { t: 80.0,  sc: 'support',    tx: "Structured *study* *materials,* regular revision, practice activities," },
      { t: 86.0,  sc: 'support',    tx: "teacher guidance, and support for tracking each child's *progress.*" },

      { t: 94.0,  sc: 'fee',        tx: "Five days a week — *980* rupees per month." },

      { t: 102.0, sc: 'pClose',     tx: "Steady learning, constant practice, a teacher's guidance — *all* *together.*" },
      { t: 108.0, sc: 'pClose',     tx: "To find your child's batch, get in touch *today.*" },

      { t: 113.0, sc: 'cta',        tx: "ManzilulQuran — *Madrasa* *Batch* *Class.*" }
    ]
  };

  window.Explainer.mount({
    root: root,
    end: 121.5,
    posterLabel: 'Watch',
    script: CAPTIONS[LANG],

    /* ---------------- scenes · English in every version ---------------- */
    scenes: {
      pOpen: {
        type: 'presenter', start: 0.5,
        label: 'Presenter · ' + (LANG === 'ml' ? 'Malayalam' : 'English'),
        hint: 'to be filmed'
        // src:    M + 'presenter-open-' + LANG + '.mp4',
        // poster: M + 'presenter-open-' + LANG + '.jpg'
      },

      /* 2 · what the syllabus covers — camera drifts across the subjects */
      subjects: {
        type: 'chips', eyebrow: 'The syllabus', camera: 'panL',
        from: 17.0, step: 1.85, hold: 2.7,
        items: [
          { t: "Qur'an",         ar: 'القرآن'  },
          { t: 'Aqīdah',         ar: 'العقيدة' },
          { t: 'Fiqh',           ar: 'الفقه'   },
          { t: 'Hadīth',         ar: 'الحديث'  },
          { t: "Du'ās",          ar: 'الأدعية' },
          { t: 'Salāh',          ar: 'الصلاة'  },
          { t: 'Islamic history' },
          { t: 'Good character'  },
          { t: 'Daily practice'  }
        ]
      },

      /* 3 · the batch itself — the signature rotating visual */
      batch: {
        type: 'group', eyebrow: 'Learning together', camera: 'orbit',
        from: 35.0, step: 0.85, count: 7, radius: 68, spin: 0.26,
        legend: [
          { color: '#2fae7f', label: 'Teacher' },
          { color: '#E9B949', label: 'The batch' }
        ]
      },

      /* 4 · five days a week */
      frequency: {
        type: 'tiles', eyebrow: 'Every week', camera: 'push',
        from: 49.0, step: 2.0, hold: 2.4,
        items: [
          { big: '5', count: 5, cap: 'Days a week' },
          { big: '↻', cap: 'Revision built in' },
          { big: '✎', cap: 'Practice each week' }
        ]
      },

      /* 5 · fixed evening timings */
      timing: {
        type: 'timeband', eyebrow: 'Fixed batch timings', camera: 'panR',
        from: 60.0, to: 67.5, ticks: 12,
        start: 'Evening', end: 'Night',
        slots: [
          { label: 'Batch A', at: 0.16 },
          { label: 'Batch B', at: 0.48 },
          { label: 'Batch C', at: 0.80 }
        ]
      },

      /* 6 · talk to the counsellor */
      counsellor: {
        type: 'beat', camera: 'tilt',
        parts: [
          { w: 'Not' }, { w: 'sure' }, { w: 'which' }, { w: 'batch?' }, { br: true },
          { w: 'Ask' }, { w: 'our counsellor.', em: true }
        ]
      },

      /* 7 · what surrounds every class */
      support: {
        type: 'rows', eyebrow: 'Around every class', camera: 'pull',
        from: 81.0, step: 2.4, hold: 2.4,
        items: [
          { t: 'Study materials',   s: 'Structured, not improvised' },
          { t: 'Regular revision',  s: 'Earlier lessons kept alive' },
          { t: 'Practice activities', s: 'Set week by week' },
          { t: 'Teacher guidance',  s: 'Corrected as they learn' },
          { t: 'Progress tracking', s: 'So you can see it moving' }
        ]
      },

      /* 8 · fee */
      fee: {
        type: 'pricing', eyebrow: 'Fee', camera: 'push',
        from: 95.2, step: 1.6,
        tiers: [
          { days: '5 days a week', price: '₹0', count: 980, per: 'per month' }
        ]
      },

      pClose: {
        type: 'presenter', start: 102.0,
        label: 'Presenter · closing', hint: 'to be filmed'
        // src:    M + 'presenter-close-' + LANG + '.mp4',
        // poster: M + 'presenter-close-' + LANG + '.jpg'
      },

      cta: {
        type: 'cta', camera: 'push',
        crest: 'مدرسة',
        mark: ['Manzilul', 'Quran'],
        fee: 'Madrasa Batch Class',
        cta: 'Talk to our counsellor',
        href: '#demoBtn',
        tagline: 'manzilulquran.in'
      }
    },

    /* Narration per language. Presenter clips carry their own audio.
         narration-a  → 16.0s to 102.0s  (subjects … fee)
         narration-b  → 113.0s to 121.5s (cta)                          */
    // media: [
    //   { src: M + 'narration-a-' + LANG + '.mp3', start: 16.0,
    //     scenes: ['subjects','batch','frequency','timing','counsellor','support','fee'] },
    //   { src: M + 'narration-b-' + LANG + '.mp3', start: 113.0,
    //     scenes: ['cta'] }
    // ],

    langs: [
      { label: 'മലയാളം', active: LANG === 'ml', href: '?lang=ml' },
      { label: 'English', active: LANG === 'en', href: '?lang=en' }
    ]
  });
})();
