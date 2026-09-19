/* =========================================================================
   ManzilulQuran · Course Explainer — Tartheel data
   assets/explainer/tartheel.v1.js

   LANGUAGE MODEL (applies to every course from here on):
     · All on-screen animation text is ENGLISH, in every version —
       eyebrows, tile labels, row titles, ladder steps, price cards, CTA.
     · Only the CAPTION track changes language: Malayalam captions in the
       Malayalam version, English captions in the English version.
     · Version chosen by ?lang= on the URL. Defaults to Malayalam here.

   One set of graphics serves every language. A new language is a caption
   array plus two recordings — never a rebuild.
   ====================================================================== */
(function () {
  'use strict';

  var root = document.getElementById('course-explainer');
  if (!root || !window.Explainer) return;

  var q = (location.search.match(/[?&]lang=([a-z]{2})/) || [])[1];
  var LANG = (q === 'en') ? 'en' : 'ml';
  var M = '../assets/explainer/media/tartheel/';

  /* ---------------- captions, one array per language ----------------
     *asterisks* mark words highlighted in gold as they are spoken.
     Timings match across languages and are re-snapped per recording. */
  var CAPTIONS = {

    ml: [
      { t: 0.5,   sc: 'pOpen',   tx: "ഖുർആൻ *ശരിയായ* *രീതിയിൽ* വായിക്കാൻ പഠിക്കണം എന്ന ആഗ്രഹമുണ്ടോ?" },
      { t: 5.6,   sc: 'pOpen',   tx: "അക്ഷരങ്ങൾ മുതൽ തുടങ്ങേണ്ടവർക്കും, ഇതിനകം ഖുർആൻ വായിക്കുന്നവർക്കും — ManzilulQuran-ന്റെ *Tarteel* *Course.*" },
      { t: 13.0,  sc: 'levels',  tx: "ഞങ്ങളുടെ Tarteel Course രണ്ട് ലെവലുകളിലായാണ് — *Base* *Level,* *Advanced* *Level.*" },
      { t: 20.5,  sc: 'base',    tx: "അറബിക് അക്ഷരങ്ങൾ പോലും അറിയാത്തവർക്കായി, *അക്ഷരങ്ങൾ* *മുതൽ* പഠനം ആരംഭിക്കുന്നു." },
      { t: 27.0,  sc: 'base',    tx: "അക്ഷരങ്ങൾ തിരിച്ചറിയുന്നതിൽ നിന്ന്, അവ ചേർത്ത് വായിക്കുന്നതിലേക്കും, പിന്നീട് ഖുർആൻ വായനയിലേക്കും — *ഘട്ടം* *ഘട്ടമായി.*" },
      { t: 36.0,  sc: 'tajweed', tx: "കൃത്യമായ *ഉച്ചാരണവും* തജ്‌വീദിന്റെ അടിസ്ഥാന നിയമങ്ങളും ഉൾപ്പെടുത്തി പരിശീലനം നൽകുന്നു." },
      { t: 46.0,  sc: 'adv',     tx: "അടിസ്ഥാനമായി ഖുർആൻ വായിക്കാൻ കഴിയുന്നവർക്ക്, *Advanced* *Level* വഴി" },
      { t: 51.4,  sc: 'adv',     tx: "തജ്‌വീദ്, ഉച്ചാരണം, വായനയുടെ *ഒഴുക്ക്* — എല്ലാം കൂടുതൽ മെച്ചപ്പെടുത്താം." },
      { t: 57.0,  sc: 'beat',    tx: "ഓരോ വിദ്യാർത്ഥിക്കും *വ്യക്തിഗത* *മാർഗനിർദേശം.*" },
      { t: 65.5,  sc: 'timing',  tx: "നിങ്ങൾക്ക് സൗകര്യപ്രദമായ *സമയം* തിരഞ്ഞെടുക്കാം." },
      { t: 70.0,  sc: 'timing',  tx: "ആഴ്ചയിൽ *അഞ്ച്* ദിവസമോ, *മൂന്ന്* ദിവസമോ — നിങ്ങളുടെ സൗകര്യത്തിനനുസരിച്ച്." },
      { t: 75.0,  sc: 'details', tx: "ഓരോ ക്ലാസും *45* *മിനിറ്റ്* ദൈർഘ്യമുള്ള live session ആണ്." },
      { t: 80.4,  sc: 'details', tx: "കൃത്യമായ *study* *materials*-ഉം regular practice-ഉം ഉൾപ്പെടുത്തി, പഠനം കൂടുതൽ systematic ആക്കുന്നു." },
      { t: 86.0,  sc: 'fee',     tx: "അഞ്ച് ദിവസത്തെ ക്ലാസിന് പ്രതിമാസം *2,699* രൂപ, മൂന്ന് ദിവസത്തെ ക്ലാസിന് *2,000* രൂപ." },
      { t: 95.0,  sc: 'pClose',  tx: "അക്ഷരങ്ങളിൽ നിന്ന് ആരംഭിച്ച്, ശരിയായ തജ്‌വീദോടുകൂടിയ ഖുർആൻ വായനയിലേക്ക്." },
      { t: 100.4, sc: 'pClose',  tx: "നിങ്ങളുടെ പഠനയാത്ര *ഇന്ന്* *തന്നെ* ആരംഭിക്കാം." },
      { t: 106.0, sc: 'cta',     tx: "ManzilulQuran — *Learn.* *Read.* *Improve.*" }
    ],

    en: [
      { t: 0.5,   sc: 'pOpen',   tx: "Do you want to learn to read the Qur'an *properly?*" },
      { t: 5.6,   sc: 'pOpen',   tx: "Whether you begin at the *letters,* or already read — this is ManzilulQuran's *Tarteel* *Course.*" },
      { t: 13.0,  sc: 'levels',  tx: "The course runs at two levels — *Base* and *Advanced.*" },
      { t: 20.5,  sc: 'base',    tx: "For those who do not yet know the Arabic letters, learning begins at the *very* *first* *letter.*" },
      { t: 27.0,  sc: 'base',    tx: "From recognising letters, to joining them, to reading the Qur'an — *step* *by* *step.*" },
      { t: 36.0,  sc: 'tajweed', tx: "Correct *pronunciation* and the foundational rules of Tajwīd, taught through guided practice." },
      { t: 46.0,  sc: 'adv',     tx: "For those who can already read, the *Advanced* *Level*" },
      { t: 51.4,  sc: 'adv',     tx: "deepens Tajwīd, pronunciation, and the *flow* of recitation." },
      { t: 57.0,  sc: 'beat',    tx: "*Personal* guidance for every student." },
      { t: 65.5,  sc: 'timing',  tx: "Choose the *time* that suits you." },
      { t: 70.0,  sc: 'timing',  tx: "*Five* days a week, or *three* — whichever fits your week." },
      { t: 75.0,  sc: 'details', tx: "Each class is a *45-minute* live session." },
      { t: 80.4,  sc: 'details', tx: "With proper *study* *materials* and regular practice, learning stays systematic." },
      { t: 86.0,  sc: 'fee',     tx: "*2,699* rupees a month for five days a week, *2,000* for three." },
      { t: 95.0,  sc: 'pClose',  tx: "From the letters, to reading the Qur'an with correct Tajwīd." },
      { t: 100.4, sc: 'pClose',  tx: "Begin your journey *today.*" },
      { t: 106.0, sc: 'cta',     tx: "ManzilulQuran — *Learn.* *Read.* *Improve.*" }
    ]
  };

  window.Explainer.mount({
    root: root,
    end: 114.5,
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

      levels: {
        type: 'tiles', eyebrow: 'Two levels',
        from: 15.4, step: 2.8, hold: 2.8,
        items: [
          { big: 'Base',     cap: 'From the letters' },
          { big: 'Advanced', cap: 'Tajwīd and flow' }
        ]
      },

      base: {
        type: 'ladder', eyebrow: 'Base Level · step by step',
        from: 22.0, step: 4.6,
        steps: [
          { ar: 'ا   ب   ت   ث',                        label: 'The letters' },
          { ar: 'كتاب',                                  label: 'Joining letters' },
          { ar: 'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ', label: "Reading the Qur'an" }
        ]
      },

      tajweed: {
        type: 'rows', eyebrow: 'Tajwīd & pronunciation',
        from: 37.0, step: 2.6, hold: 2.6,
        items: [
          { t: 'Pronunciation',       s: 'Every letter from its correct point' },
          { t: 'The rules of Tajwīd', s: 'Foundations taught in order' },
          { t: 'Guided practice',     s: 'Corrected live, every session' }
        ]
      },

      adv: {
        type: 'waveform', eyebrow: 'Advanced Level',
        from: 47.6, step: 2.9,
        marks: [
          { x: 0.20, ar: 'تجويد', label: 'Tajwīd' },
          { x: 0.50, ar: 'نطق',   label: 'Pronunciation' },
          { x: 0.80, ar: 'ترتيل', label: 'Flow' }
        ]
      },

      beat: {
        type: 'beat',
        parts: [
          { w: 'Personal' }, { w: 'guidance' }, { br: true },
          { w: 'for every' }, { w: 'student.', em: true }
        ]
      },

      timing: {
        type: 'tiles', eyebrow: 'Choose your days',
        from: 70.6, step: 2.1, hold: 2.4,
        items: [
          { big: '5', count: 5, cap: 'Days a week' },
          { big: '3', count: 3, cap: 'Days a week' }
        ]
      },

      details: {
        type: 'tiles', eyebrow: 'Class details',
        from: 76.2, step: 2.4, hold: 2.6,
        items: [
          { big: '45',   count: 45, cap: 'Minutes' },
          { big: 'Live', cap: 'Never recorded' },
          { big: '1:1',  cap: 'One teacher' },
          { big: '✓',    cap: 'Study materials' }
        ]
      },

      fee: {
        type: 'pricing', eyebrow: 'Fee',
        from: 87.2, step: 1.8,
        tiers: [
          { days: '5 days a week', price: '₹0', count: 2699, per: 'per month', badge: 'Best Value' },
          { days: '3 days a week', price: '₹0', count: 2000, per: 'per month' }
        ]
      },

      pClose: {
        type: 'presenter', start: 95.0,
        label: 'Presenter · closing', hint: 'to be filmed'
        // src:    M + 'presenter-close-' + LANG + '.mp4',
        // poster: M + 'presenter-close-' + LANG + '.jpg'
      },

      cta: {
        type: 'cta',
        crest: 'ترتيل',
        mark: ['Manzilul', 'Quran'],
        fee: 'Learn · Read · Improve',
        cta: 'Book a free demo',
        href: '#demoBtn',
        tagline: 'manzilulquran.in'
      }
    },

    /* Narration per language. Presenter clips carry their own audio.
         narration-a  → 13.0s to 95.0s   (levels … fee)
         narration-b  → 106.0s to 114.5s (cta)                          */
    // media: [
    //   { src: M + 'narration-a-' + LANG + '.mp3', start: 13.0,
    //     scenes: ['levels','base','tajweed','adv','beat','timing','details','fee'] },
    //   { src: M + 'narration-b-' + LANG + '.mp3', start: 106.0,
    //     scenes: ['cta'] }
    // ],

    langs: [
      { label: 'മലയാളം', active: LANG === 'ml', href: '?lang=ml' },
      { label: 'English', active: LANG === 'en', href: '?lang=en' }
    ]
  });
})();
