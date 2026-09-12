/* =================================================================
   ManzilulQuran — STUDY MATERIAL CATALOG  v1
   -----------------------------------------------------------------
   The list of lesson books a student may be assigned, plus the two
   helpers that turn a stored assignment into cards.

   This used to exist twice: portal/classes/index.html held a copy
   without blurbs, class/index.html held one with them, and a comment
   in the admin copy asked whoever edited it to remember the other.
   This is the one copy. Add a course here and it appears in both.

   NOTE ON THE KEYS. Two of them do not match their folder names:
     "tharbiya-level-2"              -> a file in foundation-of-islamic-studies/
     "foundation-of-islamic-studies" -> a file in tharbiya-level-2/
   That is residue from the 2026-07-26 folder reshuffle. The paths are
   right, so links resolve; only the key names are misleading. Do NOT
   rename a key without rewriting every stored studyMaterial value
   that references it.

   PUBLISHED FILES ARE IMMUTABLE. Create catalog.v2.js to change this.

   The assignment arrives as a JSON string on the class record:
     [{"course":"noorul-hayah","lessons":[1,4,7]}]
   An empty lessons array means the whole course. Older single-object
   values are still read correctly.
   ================================================================= */

const SM_CATALOG = {
  "alif-ba-learning": {
    title: "Alif-Ba for Little Ones",
    blurb: "A playful first meeting with all 28 Arabic letters and their harakat \u2014 tap to listen. For our youngest learners.",
    path : "/portal/study-material/foundation-of-islamic-studies/alif-ba-learning.html",
    lessons: [
      "Letters \u0627 \u0628 \u062a \u062b \u062c \u062d",
      "Letters \u062e \u062f \u0630 \u0631 \u0632 \u0633",
      "Letters \u0634 \u0635 \u0636 \u0637 \u0638 \u0639",
      "Letters \u063a \u0641 \u0642 \u0643 \u0644 \u0645",
      "Letters \u0646 \u0647 \u0648 \u064a"
    ]
  },
  "tharbiya-level-2": {
    title: "Basic Arabic for Kids (Foundation)",
    blurb: "Basic Arabic for children \u2014 all 28 letters across 9 lessons, with tracing, activity scenes and a certificate.",
    path : "/portal/study-material/foundation-of-islamic-studies/basic-arabic.html",
    lessons: [
      "Letters \u0627 \u0628 \u062a",
      "Letters \u062b \u062c \u062d",
      "Letters \u062e \u062f \u0630",
      "Letters \u0631 \u0632 \u0633",
      "Letters \u0634 \u0635 \u0636",
      "Letters \u0637 \u0638 \u0639",
      "Letters \u063a \u0641 \u0642",
      "Letters \u0643 \u0644 \u0645",
      "Letters \u0646 \u0647 \u0648 \u064a"
    ]
  },
  "foundation-of-islamic-studies": {
    title: "Islamic Foundations (Tharbiya L2)",
    blurb: "The beautiful basics \u2014 faith, worship, the Qur\u2019an, the prophets and more. In English and Malayalam.",
    path : "/portal/study-material/tharbiya-level-2/islamic-foundations.html",
    lessons: [
      "The Six Articles of Faith",
      "The Five Pillars of Islam",
      "Getting to Know Allah",
      "Wudu \u2014 Getting Clean for Prayer",
      "Sawm \u2014 Fasting in Ramadan",
      "Salah & the Friday Prayer",
      "Makkah & Madinah",
      "The Holy Qur\u2019an",
      "The Prophets of Allah (25)",
      "The Angels \u2014 Malaikah (10)"
    ]
  },
  "noorul-hayah": {
    title: "Noorul Hayah \u2014 Akhlaq (Tharbiya L2)",
    blurb: "Ten lessons on beautiful character \u2014 truth, trust, honouring parents, mercy, patience and more. In English and Malayalam.",
    path : "/portal/study-material/tharbiya-level-2/noorul-hayah.html",
    lessons: [
      "Speaking the Truth",
      "Trustworthiness",
      "Honouring Parents",
      "Respecting Teachers & Elders",
      "Mercy & Gentleness",
      "Cooperation & Helping Others",
      "Cleanliness",
      "Patience",
      "Manners of Speech",
      "Conduct with Friends"
    ]
  }
};

function smParse(raw){
  if(!raw) return [];
  try{
    const o = (typeof raw === "string") ? JSON.parse(raw) : raw;
    const arr = Array.isArray(o) ? o : (o && o.course ? [o] : []);   // older single-course value still works
    return arr.filter(x => x && x.course && SM_CATALOG[x.course])
              .map(x => ({ course:x.course,
                           lessons: Array.isArray(x.lessons) ? x.lessons.map(Number).filter(n => n > 0) : [] }));
  }catch(e){ return []; }
}

function smBlock(entry, n, many){
  const cat  = SM_CATALOG[entry.course];
  const all  = entry.lessons.length === 0;
  const nums = all ? cat.lessons.map((_,i) => i+1)
                   : entry.lessons.filter(v => v <= cat.lessons.length);
  if(!nums.length) return "";

  const rows = nums.map(v =>
    `<a class="sm-item" href="${cat.path}#lesson${v}" target="_blank" rel="noopener">
       <span class="sm-n">${v}</span>
       <span class="sm-t">${escapeHtml(cat.lessons[v-1])}</span>
       <span class="sm-go">\u203a</span>
     </a>`).join("");

  return `<div class="sm-block">
    ${many ? `<div class="sm-index">Course ${n}</div>` : ""}
    <div class="sm-course">
      <div class="sm-kicker">${many ? "Course" : "Your course"}</div>
      <h3>${escapeHtml(cat.title)}</h3>
      <p>${cat.blurb}</p>
      <a class="sm-open" href="${cat.path}${all ? "" : "#lesson"+nums[0]}" target="_blank" rel="noopener">Open the book \u2192</a>
      <div class="sm-tap">Tap this card to see your ${nums.length} lesson${nums.length>1?"s":""} \u25be</div>
      <span class="sm-chev">\u25be</span>
    </div>
    <div class="sm-label">${all ? "All " + nums.length + " lessons"
                                : nums.length + " lesson" + (nums.length>1?"s":"") + " for you"}</div>
    <div class="sm-list">${rows}</div>
  </div>`;
}

