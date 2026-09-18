/* =========================================================================
   ManzilulQuran · Course Explainer — Tartheel data
   assets/explainer/tartheel.v1.js

   Data only. Behaviour lives in engine.v1.js.

   LANGUAGE NOTE: this course is Malayalam-first (the source dialogue was
   written in Malayalam), the reverse of the Hifz page. English becomes the
   second track. Malayalam captions need 'Noto Sans Malayalam', which the
   page loads alongside Poppins.

   All Malayalam wording is taken from the academy's own dialogue script,
   trimmed for spoken delivery. Timings are estimates until recording.
   ====================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('course-explainer');
  if (!root || !window.Explainer) return;

  window.Explainer.mount({
    root: root,
    end: 114.5,
    posterLabel: 'കാണുക',

    /* ---------------- narration ---------------- */
    script: [
      /* 1 · hook */
      { t: 0.5,   sc: 'pOpen',   tx: "ഖുർആൻ *ശരിയായ* *രീതിയിൽ* വായിക്കാൻ പഠിക്കണം എന്ന ആഗ്രഹമുണ്ടോ?" },
      { t: 5.6,   sc: 'pOpen',   tx: "അക്ഷരങ്ങൾ മുതൽ തുടങ്ങേണ്ടവർക്കും, ഇതിനകം ഖുർആൻ വായിക്കുന്നവർക്കും — ManzilulQuran-ന്റെ *Tarteel* *Course.*" },

      /* 2 · two levels */
      { t: 13.0,  sc: 'levels',  tx: "ഞങ്ങളുടെ Tarteel Course രണ്ട് ലെവലുകളിലായാണ് — *Base* *Level,* *Advanced* *Level.*" },

      /* 3 · base level */
      { t: 20.5,  sc: 'base',    tx: "അറബിക് അക്ഷരങ്ങൾ പോലും അറിയാത്തവർക്കായി, *അക്ഷരങ്ങൾ* *മുതൽ* പഠനം ആരംഭിക്കുന്നു." },
      { t: 27.0,  sc: 'base',    tx: "അക്ഷരങ്ങൾ തിരിച്ചറിയുന്നതിൽ നിന്ന്, അവ ചേർത്ത് വായിക്കുന്നതിലേക്കും, പിന്നീട് ഖുർആൻ വായനയിലേക്കും — *ഘട്ടം* *ഘട്ടമായി.*" },

      /* 4 · tajweed */
      { t: 36.0,  sc: 'tajweed', tx: "കൃത്യമായ *ഉച്ചാരണവും* തജ്‌വീദിന്റെ അടിസ്ഥാന നിയമങ്ങളും ഉൾപ്പെടുത്തി പരിശീലനം നൽകുന്നു." },

      /* 5 · advanced */
      { t: 46.0,  sc: 'adv',     tx: "അടിസ്ഥാനമായി ഖുർആൻ വായിക്കാൻ കഴിയുന്നവർക്ക്, *Advanced* *Level* വഴി" },
      { t: 51.4,  sc: 'adv',     tx: "തജ്‌വീദ്, ഉച്ചാരണം, വായനയുടെ *ഒഴുക്ക്* — എല്ലാം കൂടുതൽ മെച്ചപ്പെടുത്താം." },

      /* 6 · personal support */
      { t: 57.0,  sc: 'beat',    tx: "ഓരോ വിദ്യാർത്ഥിക്കും *വ്യക്തിഗത* *മാർഗനിർദേശം.*" },

      /* 7 · flexible timing */
      { t: 65.5,  sc: 'timing',  tx: "നിങ്ങൾക്ക് സൗകര്യപ്രദമായ *സമയം* തിരഞ്ഞെടുക്കാം." },
      { t: 70.0,  sc: 'timing',  tx: "ആഴ്ചയിൽ *അഞ്ച്* ദിവസമോ, *മൂന്ന്* ദിവസമോ — നിങ്ങളുടെ സൗകര്യത്തിനനുസരിച്ച്." },

      /* 8 · class details */
      { t: 75.0,  sc: 'details', tx: "ഓരോ ക്ലാസും *45* *മിനിറ്റ്* ദൈർഘ്യമുള്ള live session ആണ്." },
      { t: 80.4,  sc: 'details', tx: "കൃത്യമായ *study* *materials*-ഉം regular practice-ഉം ഉൾപ്പെടുത്തി, പഠനം കൂടുതൽ systematic ആക്കുന്നു." },

      /* 9 · fee */
      { t: 86.0,  sc: 'fee',     tx: "അഞ്ച് ദിവസത്തെ ക്ലാസിന് പ്രതിമാസം *2,699* രൂപ, മൂന്ന് ദിവസത്തെ ക്ലാസിന് *2,000* രൂപ." },

      /* 10 · closing */
      { t: 95.0,  sc: 'pClose',  tx: "അക്ഷരങ്ങളിൽ നിന്ന് ആരംഭിച്ച്, ശരിയായ തജ്‌വീദോടുകൂടിയ ഖുർആൻ വായനയിലേക്ക്." },
      { t: 100.4, sc: 'pClose',  tx: "നിങ്ങളുടെ പഠനയാത്ര *ഇന്ന്* *തന്നെ* ആരംഭിക്കാം." },

      /* 11 · cta */
      { t: 106.0, sc: 'cta',     tx: "ManzilulQuran — *Learn.* *Read.* *Improve.*" }
    ],

    /* ---------------- scenes ---------------- */
    scenes: {
      pOpen: {
        type: 'presenter', start: 0.5,
        label: 'Presenter · മലയാളം', hint: 'to be filmed'
        // src: '../assets/explainer/media/tartheel/presenter-open-ml.mp4',
        // poster: '../assets/explainer/media/tartheel/presenter-open-ml.jpg'
      },

      /* 2 · two levels */
      levels: {
        type: 'tiles', eyebrow: 'രണ്ട് ലെവലുകൾ',
        from: 15.4, step: 2.8, hold: 2.8,
        items: [
          { big: 'Base',     cap: 'അക്ഷരങ്ങൾ മുതൽ' },
          { big: 'Advanced', cap: 'തജ്‌വീദും ഒഴുക്കും' }
        ]
      },

      /* 3 · base level — the signature animation for this course */
      base: {
        type: 'ladder', eyebrow: 'Base Level · ഘട്ടം ഘട്ടമായി',
        from: 22.0, step: 4.6,
        steps: [
          { ar: 'ا   ب   ت   ث',                        label: 'അക്ഷരങ്ങൾ' },
          { ar: 'كتاب',                                  label: 'ചേർത്ത് വായന' },
          { ar: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ', label: 'ഖുർആൻ വായന' }
        ]
      },

      /* 4 · tajweed & pronunciation */
      tajweed: {
        type: 'rows', eyebrow: 'തജ്‌വീദ് & ഉച്ചാരണം',
        from: 37.0, step: 2.6, hold: 2.6,
        items: [
          { t: 'ഉച്ചാരണം',           s: 'Correct pronunciation of every letter' },
          { t: 'അടിസ്ഥാന നിയമങ്ങൾ',  s: 'The foundational rules of Tajwīd' },
          { t: 'പരിശീലനം',           s: 'Guided practice in every session' }
        ]
      },

      /* 5 · advanced */
      adv: {
        type: 'waveform', eyebrow: 'Advanced Level',
        from: 47.6, step: 2.9,
        marks: [
          { x: 0.20, ar: 'تجويد', label: 'തജ്‌വീദ്' },
          { x: 0.50, ar: 'نطق',   label: 'ഉച്ചാരണം' },
          { x: 0.80, ar: 'ترتيل', label: 'ഒഴുക്ക്' }
        ]
      },

      /* 6 · personal support */
      beat: {
        type: 'beat',
        parts: [
          { w: 'ഓരോ' }, { w: 'വിദ്യാർത്ഥിക്കും' }, { br: true },
          { w: 'വ്യക്തിഗത' }, { w: 'മാർഗനിർദേശം.', em: true }
        ]
      },

      /* 7 · flexible timing */
      timing: {
        type: 'tiles', eyebrow: 'നിങ്ങളുടെ സൗകര്യത്തിന്',
        from: 70.6, step: 2.1, hold: 2.4,
        items: [
          { big: '5', count: 5, cap: 'ദിവസം / ആഴ്ച' },
          { big: '3', count: 3, cap: 'ദിവസം / ആഴ്ച' }
        ]
      },

      /* 8 · class details */
      details: {
        type: 'tiles', eyebrow: 'ക്ലാസ് വിവരങ്ങൾ',
        from: 76.2, step: 2.4, hold: 2.6,
        items: [
          { big: '45',   count: 45, cap: 'മിനിറ്റ്' },
          { big: 'Live', cap: 'One-to-one' },
          { big: '1:1',  cap: 'ഒരു അധ്യാപകൻ' },
          { big: '✓',    cap: 'Study materials' }
        ]
      },

      /* 9 · fee */
      fee: {
        type: 'pricing', eyebrow: 'ഫീസ്',
        from: 87.2, step: 1.8,
        tiers: [
          { days: '5 ദിവസം / ആഴ്ച', price: '₹0', count: 2699, per: 'പ്രതിമാസം', badge: 'Best Value' },
          { days: '3 ദിവസം / ആഴ്ച', price: '₹0', count: 2000, per: 'പ്രതിമാസം' }
        ]
      },

      pClose: {
        type: 'presenter', start: 95.0,
        label: 'Presenter · closing', hint: 'to be filmed'
        // src: '../assets/explainer/media/tartheel/presenter-close-ml.mp4',
        // poster: '../assets/explainer/media/tartheel/presenter-close-ml.jpg'
      },

      cta: {
        type: 'cta',
        crest: 'ترتيل',
        mark: ['Manzilul', 'Quran'],
        fee: 'Learn · Read · Improve',
        cta: 'സൗജന്യ ഡെമോ ബുക്ക് ചെയ്യുക',
        href: '#demoBtn',
        tagline: 'manzilulquran.in'
      }
    },

    /* Narration tracks. Presenter clips carry their own audio, so these
       cover only the gaps between them.
         narration-a  → 13.0s to 95.0s  (levels … fee)
         narration-b  → 106.0s to 114.5s (cta)                         */
    // media: [
    //   { src: '../assets/explainer/media/tartheel/narration-a-ml.mp3', start: 13.0,
    //     scenes: ['levels','base','tajweed','adv','beat','timing','details','fee'] },
    //   { src: '../assets/explainer/media/tartheel/narration-b-ml.mp3', start: 106.0,
    //     scenes: ['cta'] }
    // ],

    langs: [
      { label: 'മലയാളം', active: true },
      { label: 'English', disabled: true, title: 'Awaiting English voice track' }
    ]
  });
})();
