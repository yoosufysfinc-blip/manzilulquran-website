/* =========================================================================
   ManzilulQuran · Course Explainer — Madrasa Individual data
   assets/explainer/madrasa-individual.v1.js

   Same language model as Tartheel: all on-screen animation text is English
   in every version; only the caption track changes. ?lang= picks it,
   defaulting to Malayalam.

   FEE NOTE — NEEDS VERIFICATION
   The supplied dialogue gives three tiers: 5 days ₹2,699, 3 days ₹2,099,
   2 days ₹1,859. The live fees/madrasa-individual.html currently shows two
   tiers, ₹2,699 and ₹2,000. These figures follow the dialogue, so the page's
   own price cards need updating to match before this goes live.
   ====================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('course-explainer');
  if (!root || !window.Explainer) return;

  var q = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  var LANG = (q === 'en') ? 'en' : 'ml';
  var M = '../assets/explainer/media/madrasa-individual/';

  var CAPTIONS = {

    ml: [
      { t: 0.5,   sc: 'pOpen',     tx: "നിങ്ങളുടെ കുട്ടിക്ക് ഖുർആൻ പഠനത്തോടൊപ്പം, ഇസ്‌ലാമിക അറിവും നല്ല സ്വഭാവവും വളർത്താൻ" },
      { t: 6.4,   sc: 'pOpen',     tx: "*വ്യക്തിഗത* *ശ്രദ്ധയോടെയുള്ള* ഒരു മദ്രസാ ക്ലാസ്…" },
      { t: 10.0,  sc: 'pOpen',     tx: "അതിനായി ManzilulQuran ഒരുക്കുന്നത് — *Individual* *Madrasa* *Class.*" },

      { t: 15.0,  sc: 'subjects',  tx: "ഖുർആൻ പഠനം ഉൾപ്പെടെ, അഖീദ, ഫിഖ്ഹ്, ഹദീസ്, ദുആകൾ, നമസ്കാരം," },
      { t: 23.0,  sc: 'subjects',  tx: "ഇസ്‌ലാമിക ചരിത്രം, നല്ല സ്വഭാവം, ദൈനംദിന ജീവിതത്തിലെ ഇസ്‌ലാമിക രീതികൾ — *ക്രമമായി* പഠിക്കാം." },

      { t: 33.0,  sc: 'attention', tx: "ഓരോ കുട്ടിയുടെയും നിലവാരവും പഠന വേഗതയും പരിഗണിച്ച് *വ്യക്തിഗത* *ശ്രദ്ധ.*" },

      { t: 40.0,  sc: 'schedule',  tx: "ക്ലാസിന്റെ ദിവസങ്ങളും സമയവും *നിങ്ങൾക്ക്* *തന്നെ* തിരഞ്ഞെടുക്കാം." },
      { t: 44.8,  sc: 'schedule',  tx: "ആഴ്ചയിൽ *അഞ്ച്* ദിവസം, *മൂന്ന്* ദിവസം, അല്ലെങ്കിൽ *രണ്ട്* ദിവസം." },

      { t: 50.0,  sc: 'timing',    tx: "രാവിലെ *6* മണി മുതൽ രാത്രി *11* മണി വരെ ലഭ്യമായ സമയങ്ങളിൽ," },
      { t: 55.0,  sc: 'timing',    tx: "അനുയോജ്യമായ സമയം തിരഞ്ഞെടുക്കാം." },

      { t: 60.0,  sc: 'support',   tx: "Live classes-നൊപ്പം structured *study* *materials,*" },
      { t: 65.0,  sc: 'support',   tx: "practice, revision, teacher guidance — പഠനം കൂടുതൽ *systematic* ആക്കുന്നു." },

      { t: 73.0,  sc: 'fee',       tx: "അഞ്ച് ദിവസം *2,699* രൂപ, മൂന്ന് ദിവസം *2,099* രൂപ, രണ്ട് ദിവസം *1,859* രൂപ." },

      { t: 85.0,  sc: 'pClose',    tx: "കുട്ടിയുടെ സൗകര്യത്തിനും പഠനനിലവാരത്തിനും അനുയോജ്യമായ രീതിയിൽ," },
      { t: 90.0,  sc: 'pClose',    tx: "*വ്യക്തിഗത* *ശ്രദ്ധയോടെ* ഇസ്‌ലാമിക വിദ്യാഭ്യാസം." },

      { t: 96.0,  sc: 'cta',       tx: "ManzilulQuran — *Individual* *Madrasa* *Class.*" }
    ],

    en: [
      { t: 0.5,   sc: 'pOpen',     tx: "A madrasa class that builds Islamic knowledge and good character alongside the Qur'an —" },
      { t: 6.4,   sc: 'pOpen',     tx: "with *personal* *attention* for your child." },
      { t: 10.0,  sc: 'pOpen',     tx: "That is what ManzilulQuran offers — the *Individual* *Madrasa* *Class.*" },

      { t: 15.0,  sc: 'subjects',  tx: "Alongside the Qur'an — Aqīdah, Fiqh, Hadīth, the du'ās, and Salāh," },
      { t: 23.0,  sc: 'subjects',  tx: "Islamic history, good character, and daily Islamic practice — learned *in* *order.*" },

      { t: 33.0,  sc: 'attention', tx: "Taught at each child's own level and pace, with *personal* *attention.*" },

      { t: 40.0,  sc: 'schedule',  tx: "*You* choose the days and the time." },
      { t: 44.8,  sc: 'schedule',  tx: "*Five* days a week, *three* days, or *two* — whichever suits you." },

      { t: 50.0,  sc: 'timing',    tx: "Slots run from *6* in the morning to *11* at night," },
      { t: 55.0,  sc: 'timing',    tx: "so you can pick the hour that fits." },

      { t: 60.0,  sc: 'support',   tx: "Live classes come with structured *study* *materials,*" },
      { t: 65.0,  sc: 'support',   tx: "practice, revision and teacher guidance — keeping learning *systematic.*" },

      { t: 73.0,  sc: 'fee',       tx: "*2,699* rupees for five days, *2,099* for three, *1,859* for two." },

      { t: 85.0,  sc: 'pClose',    tx: "Shaped around your child's convenience and their level," },
      { t: 90.0,  sc: 'pClose',    tx: "*Islamic* *education* with personal attention." },

      { t: 96.0,  sc: 'cta',       tx: "ManzilulQuran — *Individual* *Madrasa* *Class.*" }
    ]
  };

  window.Explainer.mount({
    root: root,
    end: 104.5,
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

      /* 3 · what they learn — the signature scene for this course */
      subjects: {
        type: 'chips', eyebrow: 'What your child learns',
        from: 16.2, step: 1.75, hold: 2.6,
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

      /* 4 · personal attention */
      attention: {
        type: 'beat',
        parts: [
          { w: 'One' }, { w: 'teacher,' }, { br: true },
          { w: 'one' }, { w: 'child.', em: true }
        ]
      },

      /* 5 · flexible schedule */
      schedule: {
        type: 'tiles', eyebrow: 'You choose the days',
        from: 45.4, step: 1.6, hold: 2.2,
        items: [
          { big: '5', count: 5, cap: 'Days a week' },
          { big: '3', count: 3, cap: 'Days a week' },
          { big: '2', count: 2, cap: 'Days a week' }
        ]
      },

      /* 6 · convenient timing */
      timing: {
        type: 'timeband', eyebrow: 'Available hours · IST',
        from: 51.0, to: 58.5, ticks: 18,
        start: '6:00 AM', end: '11:00 PM',
        slots: [
          { label: 'Before school', at: 0.14 },
          { label: 'Afternoon',     at: 0.46 },
          { label: 'After Maghrib', at: 0.78 }
        ]
      },

      /* 7 · study support */
      support: {
        type: 'rows', eyebrow: 'Around every live class',
        from: 61.0, step: 2.6, hold: 2.6,
        items: [
          { t: 'Study materials',  s: 'Structured, not improvised' },
          { t: 'Practice',         s: 'Set after each session' },
          { t: 'Revision',         s: 'Earlier lessons kept alive' },
          { t: 'Teacher guidance', s: 'Corrected as they learn' }
        ]
      },

      /* 8 · fee plans */
      fee: {
        type: 'pricing', eyebrow: 'Fee plans',
        from: 74.2, step: 1.7,
        tiers: [
          { days: '5 days', price: '₹0', count: 2699, per: 'per month', badge: 'Most Popular' },
          { days: '3 days', price: '₹0', count: 2099, per: 'per month' },
          { days: '2 days', price: '₹0', count: 1859, per: 'per month' }
        ]
      },

      pClose: {
        type: 'presenter', start: 85.0,
        label: 'Presenter · closing', hint: 'to be filmed'
        // src:    M + 'presenter-close-' + LANG + '.mp4',
        // poster: M + 'presenter-close-' + LANG + '.jpg'
      },

      cta: {
        type: 'cta',
        crest: 'مدرسة',
        mark: ['Manzilul', 'Quran'],
        fee: 'Individual Madrasa Class',
        cta: 'Book a free demo',
        href: '#demoBtn',
        tagline: 'manzilulquran.in'
      }
    },

    /* Narration per language. Presenter clips carry their own audio.
         narration-a  → 15.0s to 85.0s  (subjects … fee)
         narration-b  → 96.0s to 104.5s (cta)                           */
    // media: [
    //   { src: M + 'narration-a-' + LANG + '.mp3', start: 15.0,
    //     scenes: ['subjects','attention','schedule','timing','support','fee'] },
    //   { src: M + 'narration-b-' + LANG + '.mp3', start: 96.0,
    //     scenes: ['cta'] }
    // ],

    langs: [
      { label: 'മലയാളം', active: LANG === 'ml', href: '?lang=ml' },
      { label: 'English', active: LANG === 'en', href: '?lang=en' }
    ]
  });
})();
