/* =====================================================================
   Study Report · Academy Insights + Individual Progress Report
   Depends on globals from index.html (classic scripts share scope):
     S, activeMonth, defaultState, monthKeys, monthStats, isClassDay,
     daysInMonth, normPortions, portionText, currentStreak, gradeOf,
     SURAHS, DOWS, MONTH_NAMES, pad, esc, fmt, monthLabel, monthShort,
     todayStr, toast, $, $$, roster, currentId, LINK, openStudent,
     gotoView, showOnly, enterRoster
   Nothing here writes to Supabase — it only reads `state` blobs.
   ===================================================================== */
"use strict";
(function(){

/* ---------- Juz boundaries (Madani/Tanzil), [surah 1-based, ayah] ---------- */
const JUZ_START=[[1,1],[2,142],[2,253],[3,93],[4,24],[4,148],[5,82],[6,111],[7,88],[8,41],
  [9,93],[11,6],[12,53],[15,1],[17,1],[18,75],[21,1],[23,1],[25,21],[27,56],
  [29,46],[33,31],[36,28],[39,32],[41,47],[46,1],[51,31],[58,1],[67,1],[78,1]];
const PREFIX=[];{let c=0;SURAHS.forEach((s,i)=>{PREFIX[i]=c;c+=s[2];});PREFIX.push(c);}
const gIdx=(si,a)=>PREFIX[si]+a;                         // global ayah index (1-based ayah)
const JUZ_IDX=JUZ_START.map(([s,a])=>gIdx(s-1,a));
const TOTAL_AYAH=PREFIX[SURAHS.length];
const JUZ_AYAHS=JUZ_IDX.map((st,i)=>(i<29?JUZ_IDX[i+1]:TOTAL_AYAH+1)-st);
function juzOfAyah(si,a){const g=gIdx(si,a);let j=1;for(let i=0;i<30;i++){if(JUZ_IDX[i]<=g)j=i+1;else break;}return j;}

/* ---------- score model (shared by leaderboard + report) ---------- */
const WEIGHTS={pace:30,attendance:25,revision:20,consistency:15,accuracy:10};
const DIM_LABEL={pace:"Memorisation pace",attendance:"Attendance",revision:"Revision",consistency:"Consistency",accuracy:"Accuracy"};
function overall(dims){
  let w=0,s=0;
  Object.keys(WEIGHTS).forEach(k=>{if(dims[k]!=null){w+=WEIGHTS[k];s+=WEIGHTS[k]*dims[k];}});
  return w?s/w:0;
}
function verdict(score){
  if(score>=85)return{t:"Excellent",ar:"ممتاز",c:"var(--p-ok)"};
  if(score>=70)return{t:"Very good",ar:"جيد جدًا",c:"var(--p-em2)"};
  if(score>=55)return{t:"Good",ar:"جيد",c:"var(--p-gold)"};
  if(score>=40)return{t:"Needs more effort",ar:"مقبول",c:"var(--p-warn)"};
  return{t:"Needs attention",ar:"يحتاج متابعة",c:"var(--p-bad)"};
}

/* ---------- period helpers ---------- */
// P = {type:"month"|"year"|"all", key}
const prevMonthKey=k=>{let[y,m]=k.split("-").map(Number);m--;if(!m){m=12;y--;}return y+"-"+pad(m);};
function keysFor(P){
  const ks=monthKeys();
  if(P.type==="month")return ks.filter(k=>k===P.key);
  if(P.type==="year")return ks.filter(k=>k.startsWith(P.key+"-"));
  return ks;
}
function endKeyFor(P){return P.type==="month"?P.key:P.type==="year"?P.key+"-12":null;}
function inPeriod(ds,P){if(!ds)return false;if(P.type==="month")return ds.startsWith(P.key);if(P.type==="year")return ds.startsWith(P.key+"-");return true;}
function prevPeriod(P){
  if(P.type==="month")return{type:"month",key:prevMonthKey(P.key)};
  if(P.type==="year")return{type:"year",key:String(+P.key-1)};
  return null;
}
function periodLabel(P){
  if(P.type==="month")return monthLabel(P.key);
  if(P.type==="year")return "Year "+P.key;
  const ks=monthKeys();return ks.length?"All time · "+monthShort(ks[0])+" – "+monthShort(ks[ks.length-1]):"All time";
}
const dLabel=ds=>{const[y,m,d]=ds.split("-").map(Number);const dt=new Date(y,m-1,d);return DOWS[(dt.getDay()+6)%7].slice(0,3)+" "+d+" "+MONTH_NAMES[m-1].slice(0,3);};
const pctTxt=v=>v==null?"—":Math.round(v)+"%";

/* ---------- run fn against another student's state (same swap pattern as summarize()) ---------- */
function withState(state,fn){
  const keep=S,keepAM=activeMonth;
  S=Object.assign(defaultState(),state||{});
  S.config=Object.assign(defaultState().config,(state||{}).config||{});
  S.months=S.months||{};S.tasks=S.tasks||[];S.exams=S.exams||[];
  try{return fn();}finally{S=keep;activeMonth=keepAM;}
}

/* ---------- period statistics for the student currently in S ---------- */
function periodStats(P){
  const keys=keysFor(P),lpp=S.config.lpp||15;
  let classDays=0,present=0,absent=0,lines=0,revDays=0,nlDays=0,sqDays=0,olDays=0,maxDay=0;
  const juzRev=new Map(),log=[],juzTests=[],daily=[];
  keys.forEach(k=>{
    const st=monthStats(k);present+=st.present;absent+=st.absent;lines+=st.lines;
    const days=(S.months[k]&&S.months[k].days)||{},dim=daysInMonth(k),today=todayStr();
    // class days so far: future days of the running month are not counted as missed
    for(let d=1;d<=dim;d++){if(isClassDay(k,d)&&k+"-"+pad(d)<=today)classDays++;}
    for(let d=1;d<=dim;d++){
      const r=days[pad(d)];const ds=k+"-"+pad(d);
      const ln=Number((r&&r.ln)||0);
      daily.push({ds,d,k,p:r?r.p:null,ln,cls:isClassDay(k,d)});
      if(!r)continue;
      const nl=normPortions(r.nl),sq=normPortions(r.sq),ol=normPortions(r.ol),ev=r.ev||null;
      if(r.p===1){if(sq.length||ol.length)revDays++;if(ln>0)nlDays++;if(ln>maxDay)maxDay=ln;}
      if(sq.length)sqDays++;if(ol.length)olDays++;
      const seen=new Set();
      sq.concat(ol).forEach(p=>{if(p&&p.s!=null)seen.add(juzOfAyah(p.s,p.a1||1));});
      seen.forEach(j=>juzRev.set(j,(juzRev.get(j)||0)+1));
      if(ev&&ev.type==="juz")juzTests.push({ds,juz:ev.juz,result:ev.result,examiner:ev.examiner||""});
      if(r.p!=null||ln>0||nl.length||sq.length||ol.length||ev)
        log.push({ds,p:r.p,nl,ln,sq,ol,ev,off:!isClassDay(k,d)});
    }
  });
  const exams=S.exams.filter(e=>inPeriod(e.date,P)).sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  const examAvg=exams.length?exams.reduce((a,e)=>a+(e.max?e.obt/e.max*100:0),0)/exams.length:null;
  const mist=exams.reduce((a,e)=>a+(+e.mist||0),0);
  const jtPass=juzTests.filter(t=>t.result==="pass").length,jtRetry=juzTests.length-jtPass;
  const att=classDays?present/classDays*100:0,avg=present?lines/present:0;
  const accuracy=examAvg!=null?examAvg:(juzTests.length?jtPass/juzTests.length*100:null);
  const dims={
    pace:Math.min(100,avg/lpp*100),
    attendance:att,
    revision:present?revDays/present*100:0,
    consistency:present?nlDays/present*100:0,
    accuracy
  };
  const eligible=present>0||lines>0;
  return{P,keys,classDays,present,absent,lines,pages:lines/lpp,att,avg,revDays,nlDays,sqDays,olDays,maxDay,
    juzRev,log,juzTests,jtPass,jtRetry,exams,examAvg,mist,daily,dims,score:eligible?overall(dims):0,eligible};
}
function cumulativeTo(endKey){return monthKeys().filter(k=>!endKey||k<=endKey).reduce((a,k)=>a+monthStats(k).lines,0);}

/* ---------- memorised portion as ayah units split by juz ---------- */
function memorised(endKey){
  const bySurah=new Map(),first=new Map();
  monthKeys().filter(k=>!endKey||k<=endKey).forEach(k=>{
    const days=(S.months[k]&&S.months[k].days)||{};
    Object.keys(days).sort().forEach(dd=>{
      normPortions((days[dd]||{}).nl).forEach(p=>{
        if(!p||p.s==null)return;
        const a1=p.a1||1,a2=p.a2||p.a1||SURAHS[p.s][2];
        if(!bySurah.has(p.s))bySurah.set(p.s,[]);
        bySurah.get(p.s).push({a1:Math.min(a1,a2),a2:Math.max(a1,a2)});
        if(!first.has(p.s))first.set(p.s,k+"-"+dd);
      });
    });
  });
  const ppj=(S.config.total||9060)/(S.config.lpp||15)/30;
  const units=[],frac=new Array(31).fill(0),juzFirst=new Array(31).fill(null);
  bySurah.forEach((ranges,si)=>{
    ranges.sort((a,b)=>a.a1-b.a1);const merged=[];
    ranges.forEach(r=>{const l=merged[merged.length-1];if(l&&r.a1<=l.a2+1)l.a2=Math.max(l.a2,r.a2);else merged.push({...r});});
    merged.forEach(r=>{
      let a=r.a1;
      while(a<=r.a2){
        const j=juzOfAyah(si,a);
        let end=r.a2;
        if(j<30){const ns=JUZ_START[j];if(ns[0]-1===si&&ns[1]-1<end)end=ns[1]-1;}
        const n=end-a+1;
        units.push({si,a1:a,a2:end,j,pages:n/JUZ_AYAHS[j-1]*ppj,first:first.get(si)});
        frac[j]+=n/JUZ_AYAHS[j-1];
        const f=first.get(si);if(!juzFirst[j]||f<juzFirst[j])juzFirst[j]=f;
        a=end+1;
      }
    });
  });
  for(let j=1;j<=30;j++)frac[j]=Math.min(1,frac[j]);
  const juzOrder=[];for(let j=1;j<=30;j++)if(frac[j]>0)juzOrder.push(j);
  juzOrder.sort((a,b)=>(juzFirst[a]||"").localeCompare(juzFirst[b]||"")||a-b);
  const pos=new Map(juzOrder.map((j,i)=>[j,i]));
  units.sort((u,v)=>pos.get(u.j)-pos.get(v.j)||u.si-v.si||u.a1-v.a1);
  const M=frac.reduce((a,b)=>a+b,0);
  return{units,frac,juzOrder,M,ppj,full:frac.filter((f,j)=>j&&f>=0.995).length};
}

/* ---------- revision (manzil) cycle ---------- */
function dailyTargetPages(M,ppj){
  if(M<=0)return 0;
  if(M<=1)return M*ppj;                       // small hifz: revise all of it daily
  if(M<=5)return Math.max(ppj*0.25,M*ppj/7);  // whole portion every 7 days
  if(M<=15)return ppj;                        // 1 juz a day
  if(M<=20)return ppj*1.5;
  return ppj*2;                               // 2 juz a day for large hifz
}
function manzilCycle(mem){
  const D=dailyTargetPages(mem.M,mem.ppj);if(!D)return{D:0,days:[]};
  if(mem.M<=1)return{D,days:[mem.units.map(u=>({...u}))]};
  const q=mem.units.map(u=>({...u}));const days=[];let cur=[],curP=0,guard=0;
  while(q.length&&guard++<6000){
    const u=q.shift(),room=D-curP,n=u.a2-u.a1+1;
    if(u.pages<=room+D*0.15||n===1){cur.push(u);curP+=u.pages;}
    else if(room<D*0.2&&cur.length){days.push(cur);cur=[];curP=0;q.unshift(u);continue;}
    else{
      const take=Math.max(1,Math.floor(n*room/u.pages));
      if(take>=n){cur.push(u);curP+=u.pages;}
      else{cur.push({...u,a2:u.a1+take-1,pages:u.pages*take/n});curP+=u.pages*take/n;
           q.unshift({...u,a1:u.a1+take,pages:u.pages*(n-take)/n});}
    }
    if(curP>=D*0.95){days.push(cur);cur=[];curP=0;}
  }
  if(cur.length)days.push(cur);
  return{D,days};
}
function segText(list){ // merge contiguous pieces of the same surah
  const out=[];
  list.forEach(u=>{const l=out[out.length-1];if(l&&l.si===u.si&&u.a1<=l.a2+1)l.a2=Math.max(l.a2,u.a2);else out.push({si:u.si,a1:u.a1,a2:u.a2});});
  return out.map(u=>{const s=SURAHS[u.si];const whole=u.a1===1&&u.a2>=s[2];
    return esc(s[0])+(whole?"":" "+u.a1+"–"+u.a2);}).join(" · ");
}
function compactSeg(list,byJuz){
  const groups=[];
  list.forEach(u=>{const k=byJuz?u.j:0;let g=groups.find(x=>x.k===k);if(!g){g={k,items:[]};groups.push(g);}g.items.push(u);});
  return groups.map(g=>{
    const m=[];g.items.slice().sort((a,b)=>a.si-b.si||a.a1-b.a1).forEach(u=>{const l=m[m.length-1];
      if(l&&l.si===u.si&&u.a1<=l.a2+1)l.a2=Math.max(l.a2,u.a2);else m.push({si:u.si,a1:u.a1,a2:u.a2});});
    if(byJuz&&g.k){const ay=m.reduce((a,u)=>a+u.a2-u.a1+1,0);if(ay>=JUZ_AYAHS[g.k-1])return "Whole Juz "+g.k;}
    const nm=(u,end)=>{const s=SURAHS[u.si];const whole=u.a1===1&&u.a2>=s[2];
      return esc(s[0])+(whole?"":end?" "+u.a2:" "+u.a1+(u.a2!==u.a1?"–"+u.a2:""));};
    if(m.length<=3)return m.map(u=>nm(u)).join(" · ");
    const f=m[0],l=m[m.length-1],fs=SURAHS[f.si],ls=SURAHS[l.si];
    return esc(fs[0])+(f.a1>1?" "+f.a1:"")+" → "+esc(ls[0])+(l.a2<ls[2]?" "+l.a2:"")+` <span class="rp-small">(${m.length} surahs)</span>`;
  }).join(" · ");
}
const juzBadges=list=>[...new Set(list.map(u=>u.j))].map(j=>`<span class="rp-jb">J${j}</span>`).join("");
const pagesOf=list=>list.reduce((a,u)=>a+u.pages,0);

/* ---------- next 7 days plan ---------- */
function weekPlan(mem,cyc,P){
  const lpp=S.config.lpp||15;
  // recent new lessons (last 7 recorded new-lesson days) → Sabqi
  const nlDays=[];
  monthKeys().forEach(k=>{const days=(S.months[k]&&S.months[k].days)||{};
    Object.keys(days).sort().forEach(dd=>{const nl=normPortions((days[dd]||{}).nl).filter(p=>p&&p.s!=null);if(nl.length)nlDays.push({ds:k+"-"+dd,nl});});});
  const recent=nlDays.slice(-7);
  const sabqi=[];recent.forEach(x=>x.nl.forEach(p=>sabqi.push({si:p.s,a1:p.a1||1,a2:p.a2||p.a1||SURAHS[p.s][2],j:0,pages:0})));
  sabqi.sort((a,b)=>a.si-b.si||a.a1-b.a1);
  const sabqiTxt=sabqi.length?compactSeg(sabqi,false):"—";
  const last=nlDays.length?nlDays[nlDays.length-1].nl.slice(-1)[0]:null;
  let cont="Next portion set by the teacher";
  if(last){const s=SURAHS[last.s],a2=last.a2||last.a1||s[2];
    cont=a2>=s[2]?esc(s[0])+" completed — begin the next assigned surah":"Continue "+esc(s[0])+" from ayah "+(a2+1);}
  // pace = average lines per present day across all records
  const st=periodStats({type:"all"});
  const target=Math.round(Math.max(3,Math.min(lpp*2,st.avg||lpp/2)));
  const rows=[];const d=new Date();let ci=0;
  for(let i=0;i<7;i++){
    const dow=(d.getDay()+6)%7,ds=d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
    const off=S.config.weekly[dow]||S.config.holDates.includes(ds);
    if(off)rows.push({ds,off:true});
    else{const day=cyc.days.length?cyc.days[ci%cyc.days.length]:null;ci++;rows.push({ds,off:false,day,cycleNo:day?((ci-1)%cyc.days.length)+1:0});}
    d.setDate(d.getDate()+1);
  }
  return{rows,target,cont,sabqiTxt};
}

/* ---------- strengths / areas / tips ---------- */
function analyse(st,prev,mem){
  const good=[],imp=[],needs=new Set(),lpp=S.config.lpp||15;
  const D=st.dims;
  if(!st.eligible)return{good,imp,needs};
  if(D.attendance>=85)good.push(["Excellent regularity",`Present ${st.present} of ${st.classDays} class days (${pctTxt(D.attendance)}).`]);
  else if(D.attendance<75){imp.push(["Attendance",`Present ${st.present} of ${st.classDays} class days (${pctTxt(D.attendance)}). Missed days break the revision chain.`]);needs.add("attendance");}
  if(D.pace>=80)good.push(["Strong memorisation pace",`${st.avg.toFixed(1)} lines per present day — close to a page a day.`]);
  else if(D.pace<45){imp.push(["Memorisation pace",`${st.avg.toFixed(1)} lines per present day (goal: ${lpp} lines ≈ 1 page).`]);needs.add("pace");}
  if(st.present>=3){
    if(D.revision>=80)good.push(["Revision kept daily",`Sabq / old lesson recorded on ${st.revDays} of ${st.present} present days.`]);
    else if(D.revision<60){imp.push(["Daily revision",`Revision recorded on only ${st.revDays} of ${st.present} present days.`]);needs.add("revision");}
    if(D.consistency>=80)good.push(["Steady new lessons",`New lesson given on ${st.nlDays} of ${st.present} present days.`]);
    else if(D.consistency<55){imp.push(["Consistency",`New lesson on ${st.nlDays} of ${st.present} present days — aim for a small portion every class.`]);needs.add("consistency");}
  }
  if(st.examAvg!=null){
    if(st.examAvg>=85)good.push(["Accurate recitation",`Exam average ${st.examAvg.toFixed(0)}% with ${st.mist} mistake${st.mist===1?"":"s"}.`]);
    else if(st.examAvg<70){imp.push(["Accuracy in exams",`Exam average ${st.examAvg.toFixed(0)}% (${st.mist} mistakes noted).`]);needs.add("accuracy");}
  }
  if(st.jtPass)good.push(["Juz milestones",`Passed ${st.jtPass} juz submission${st.jtPass>1?"s":""} this period, mā shā’ Allāh.`]);
  if(st.jtRetry){imp.push(["Juz submissions to retry",`${st.jtRetry} juz test${st.jtRetry>1?"s":""} marked “try again”.`]);needs.add("accuracy");}
  if(prev&&prev.eligible&&prev.lines>0){
    const ch=(st.lines-prev.lines)/prev.lines*100;
    if(ch>=15)good.push(["Improving trend",`${Math.round(ch)}% more lines than the previous period.`]);
    else if(ch<=-25){imp.push(["Slowing down",`${Math.abs(Math.round(ch))}% fewer lines than the previous period.`]);needs.add("pace");}
  }
  // memorised juz that were not revised at all in this period
  if(st.present>=5){
    const neg=mem.juzOrder.filter(j=>mem.frac[j]>=0.2&&!st.juzRev.get(j));
    if(neg.length){imp.push(["Juz not revised this period",`Juz ${neg.join(", ")} did not appear in sabq or old-lesson revision.`]);needs.add("neglect");mem.neglected=neg;}
  }
  return{good,imp,needs};
}
const TIPS={
  attendance:[["Fix one daily slot","Same time and place every day — after Fajr or Maghrib works best for most children."],
    ["Never a zero day","On a busy day do 10 minutes of revision instead of skipping completely."]],
  pace:[["Listen before memorising","Listen to the new lesson 5–10 times from a teacher-style reciter (e.g. Al-Husary muallim) before starting."],
    ["Small pieces, many repetitions","Split the lesson into 2–3 line pieces; repeat each 10–20 times, then join them and recite together."],
    ["Fresh mind for new lessons","Take the new lesson when the mind is fresh; keep phones and noise away."]],
  revision:[["Sabqi every day","Recite the last 7 days’ lessons daily before taking a new lesson — it seals them."],
    ["Recite in salah","Use memorised surahs in sunnah and nafl prayers; it is revision that never feels like homework."]],
  consistency:[["Small but steady","Two lines every day beats ten lines once a week — consistency builds long-term memory."],
    ["Track it visibly","Tick the daily plan table on the fridge or study wall; children love completing the row."]],
  accuracy:[["Mark your weak spots","Lightly mark in pencil where mistakes happen in your own mushaf and revise those first."],
    ["Record and compare","Record yourself reciting and follow along in the mushaf to catch slips."],
    ["One mushaf only","Always use the same printed mushaf — the page picture becomes part of the memory."]],
  neglect:[["Bring the juz back","Add the unrevised juz into this week’s manzil cycle before new lessons grow further."]],
  general:[["Understand what you recite","Know the short meaning of each surah — understanding makes recall easier."],
    ["Revise before sleep","A short recitation before sleeping helps memory settle overnight."],
    ["Recite to someone","Recite the day’s portion to a parent or sibling — it adds gentle accountability."],
    ["Make duʿā’","Ask Allah for ease and barakah in memorisation; keep intention sincere."]]
};

/* ---------- infographic builders (green / white palette) ---------- */
const C={g9:"#064e3b",g8:"#065f46",g7:"#047857",g6:"#059669",g5:"#10b981",g3:"#6ee7b7",g1:"#d1fae5",g0:"#ecfdf5",
  au7:"#a8740f",au5:"#e0a526",au4:"#f2c84b",au3:"#f7dc84",ink:"#0f2a1f",mut:"#5b6f66",dim:"#94a39b",line:"#e2efe7",red:"#e05a47",amber:"#d98a1c",gold:"#c9961a"};
const FF="Plus Jakarta Sans,Outfit,sans-serif";
let _gid=0;const gid=()=>"rg"+(++_gid);
const ICON={
  book:'<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5"/>',
  cal:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><path d="m9 15 2 2 4-4"/>',
  bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  globe:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 12 10 5 10-5M2 17l10 5 10-5"/>',
  loop:'<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M8.2 13.2 7 22l5-3 5 3-1.2-8.8"/>',
  flame:'<path d="M12 22c4 0 7-3 7-7 0-5-5-8-6-13-2 3-3 5-3 7-1-1-2-2-2-4-2 3-3 6-3 10 0 4 3 7 7 7z"/>'
};
const ico=k=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[k]}</svg>`;

function ringSVG(score){
  const r=52,c=2*Math.PI*r,v=Math.max(0,Math.min(100,score)),id=gid();
  return `<svg viewBox="0 0 130 130" width="130" role="img" aria-label="Overall score ${Math.round(v)} of 100">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.g7}"/><stop offset=".6" stop-color="${C.g5}"/><stop offset="1" stop-color="#f2c94c"/></linearGradient></defs>
  <circle cx="65" cy="65" r="${r}" fill="none" stroke="#fbf1d6" stroke-width="12"/>
  <circle cx="65" cy="65" r="${r}" fill="none" stroke="url(#${id})" stroke-width="12" stroke-linecap="round"
    stroke-dasharray="${(c*v/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 65 65)"/>
  <text x="65" y="68" text-anchor="middle" font-family="${FF}" font-size="32" font-weight="800" fill="${C.au7}">${Math.round(v)}</text>
  <text x="65" y="86" text-anchor="middle" font-family="${FF}" font-size="10" fill="${C.mut}">score / 100</text></svg>`;
}
function donutSVG(parts,center,sub){
  const tot=parts.reduce((a,p)=>a+p.v,0)||1,r=40,c=2*Math.PI*r;let off=0;
  const segs=parts.filter(p=>p.v>0).map(p=>{const len=c*p.v/tot;
    const s=`<circle cx="55" cy="55" r="${r}" fill="none" stroke="${p.c}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(c-len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 55 55)"/>`;
    off+=len;return s;}).join("");
  return `<svg viewBox="0 0 110 110"><circle cx="55" cy="55" r="${r}" fill="none" stroke="${C.g0}" stroke-width="16"/>${segs}
    <text x="55" y="57" text-anchor="middle" font-family="${FF}" font-size="18" font-weight="800" fill="${C.g9}">${center}</text>
    <text x="55" y="71" text-anchor="middle" font-family="${FF}" font-size="8.5" fill="${C.mut}">${sub}</text></svg>`;
}
const donutKey=parts=>`<div class="rp-key">${parts.map(p=>`<div><i style="background:${p.c}"></i>${p.l}<b>${p.v}</b></div>`).join("")}</div>`;
function radarSVG(dims){
  const keys=Object.keys(WEIGHTS),cx=120,cy=100,R=66,n=keys.length;
  const pt=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/n;return[cx+R*v*Math.cos(a),cy+R*v*Math.sin(a)];};
  let grid="";[.25,.5,.75,1].forEach(f=>{grid+=`<polygon points="${keys.map((_,i)=>pt(i,f).join(",")).join(" ")}" fill="${f===1?C.g0:"none"}" stroke="${C.g1}"/>`;});
  const axes=keys.map((_,i)=>{const[x,y]=pt(i,1);return`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${C.g1}"/>`;}).join("");
  const poly=keys.map((k,i)=>pt(i,Math.max(.03,(dims[k]??0)/100)).map(v=>v.toFixed(1)).join(",")).join(" ");
  const short={pace:"Pace",attendance:"Attendance",revision:"Revision",consistency:"Consistency",accuracy:"Accuracy"};
  const labels=keys.map((k,i)=>{const[x,y]=pt(i,1.28);const v=dims[k];
    return`<text x="${x.toFixed(1)}" y="${(y-2).toFixed(1)}" text-anchor="middle" font-family="${FF}" font-size="9.5" fill="${C.mut}">${short[k]}<tspan x="${x.toFixed(1)}" dy="11" fill="${C.g8}" font-weight="800">${v==null?"—":Math.round(v)}</tspan></text>`;}).join("");
  return `<svg viewBox="0 0 240 205" role="img" aria-label="Skill balance">${grid}${axes}
    <polygon points="${poly}" fill="rgba(16,185,129,.28)" stroke="${C.g6}" stroke-width="2"/>
    ${keys.map((k,i)=>{const[x,y]=pt(i,Math.max(.03,(dims[k]??0)/100));return`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="${C.g7}"/>`;}).join("")}${labels}</svg>`;
}
function barsSVG(items,opts){ // items [{lab,v,off,absent,hi}] ; opts {cum,h,w}
  const W=opts.w||560,H=opts.h||150,pl=26,pr=opts.cum?34:6,pt=8,pb=20,n=items.length||1,id=gid();
  const max=Math.max(1,...items.map(i=>i.v)),bw=(W-pl-pr)/n;
  let g="";[0,.5,1].forEach(f=>{const y=pt+(H-pt-pb)*(1-f);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="${C.line}"/><text x="${pl-4}" y="${y+3}" text-anchor="end" font-family="${FF}" font-size="9" fill="${C.dim}">${Math.round(max*f)}</text>`;});
  const every=Math.ceil(n/14);
  const bars=items.map((it,i)=>{const h=(H-pt-pb)*it.v/max,x=pl+i*bw+bw*.14,w=bw*.72;
    const col=it.off?C.g1:it.hi?`url(#${id}g)`:`url(#${id})`;
    const bar=it.v>0?`<rect x="${x.toFixed(1)}" y="${(H-pb-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${Math.min(4,w/3).toFixed(1)}" fill="${col}"/>`
      :it.absent?`<circle cx="${(x+w/2).toFixed(1)}" cy="${H-pb-4}" r="2.6" fill="${C.red}"/>`:"";
    const lab=i%every===0?`<text x="${(x+w/2).toFixed(1)}" y="${H-6}" text-anchor="middle" font-family="${FF}" font-size="9" fill="${C.dim}">${esc(it.lab)}</text>`:"";
    return bar+lab;}).join("");
  let line="";
  if(opts.cum){const cm=Math.max(1,...opts.cum);
    const pts=opts.cum.map((c,i)=>[(pl+i*bw+bw/2).toFixed(1),(pt+(H-pt-pb)*(1-c/cm)).toFixed(1)]);
    line=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${C.gold}" stroke-width="2.2" stroke-linejoin="round"/>`+
      pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.8" fill="#fff" stroke="${C.gold}" stroke-width="1.8"/>`).join("")+
      `<text x="${W-pr+4}" y="${pt+8}" font-family="${FF}" font-size="9" font-weight="700" fill="${C.gold}">${fmt(cm)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.g5}"/><stop offset="1" stop-color="${C.g7}"/></linearGradient><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.au4}"/><stop offset="1" stop-color="${C.au7}"/></linearGradient></defs>${g}${bars}${line}</svg>`;
}
function attLineSVG(rows){
  const W=560,H=140,pl=26,pr=8,pt=10,pb=20,n=rows.length;if(n<2)return"";
  const x=i=>pl+(W-pl-pr)*i/(n-1),y=v=>pt+(H-pt-pb)*(1-v/100),id=gid();
  let g="";[0,50,75,100].forEach(v=>{g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="${v===75?C.g3:C.line}" ${v===75?'stroke-dasharray="4 4"':""}/><text x="${pl-4}" y="${y(v)+3}" text-anchor="end" font-family="${FF}" font-size="9" fill="${C.dim}">${v}</text>`;});
  const pts=rows.map((r,i)=>[x(i).toFixed(1),y(r.att).toFixed(1)]),every=Math.ceil(n/12);
  return `<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.g5}" stop-opacity=".35"/><stop offset="1" stop-color="${C.g5}" stop-opacity="0"/></linearGradient></defs>${g}
    <polygon points="${pl},${H-pb} ${pts.map(p=>p.join(",")).join(" ")} ${W-pr},${H-pb}" fill="url(#${id})"/>
    <polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="${C.g6}" stroke-width="2.4" stroke-linejoin="round"/>
    ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#fff" stroke="${C.g7}" stroke-width="2"/>`+(i%every===0?`<text x="${p[0]}" y="${H-5}" text-anchor="middle" font-family="${FF}" font-size="9" fill="${C.dim}">${esc(rows[i].lab)}</text>`:"")).join("")}</svg>`;
}
function calendarHTML(st){
  const k=st.keys[0];if(!k)return"";
  const[y,m]=k.split("-").map(Number),first=(new Date(y,m-1,1).getDay()+6)%7,max=Math.max(1,...st.daily.map(d=>d.ln)),today=todayStr();
  let cells=["M","T","W","T","F","S","S"].map(x=>`<span class="h">${x}</span>`).join("");
  for(let i=0;i<first;i++)cells+=`<i></i>`;
  st.daily.forEach(d=>{
    let bg="#f4f7f5",cls="";
    if(d.ds>today&&d.p==null)bg="#fafcfb";
    else if(!d.cls&&d.p==null&&!d.ln)bg=`repeating-linear-gradient(45deg,${C.g0} 0 3px,#fff 3px 6px)`;
    else if(d.p===0){bg="#fde3df";}
    else if(d.p===1||d.ln>0){const f=d.ln/max;bg=f>.66?C.g6:f>.33?C.g5:C.g3;cls=f>.33?"w":"";}
    cells+=`<i class="${cls}" style="background:${bg}">${d.d}</i>`;
  });
  return `<div class="rp-cal">${cells}</div><div class="rp-legend" style="margin-top:6px"><span><i style="background:${C.g3}"></i>light</span><span><i style="background:${C.g6}"></i>strong day</span><span><i style="background:#fde3df"></i>absent</span><span><i style="background:repeating-linear-gradient(45deg,${C.g0} 0 3px,#fff 3px 6px);border:1px solid ${C.g1}"></i>holiday</span></div>`;
}
function shelfHTML(mem,st,passed){
  let h="";
  for(let j=1;j<=30;j++){
    const f=mem.frac[j],full=f>=.995,has=f>.12,rev=st&&st.juzRev.get(j),neg=mem.neglected&&mem.neglected.includes(j);
    h+=`<div class="rp-juz${full?" full":""}${has?" has":""}${rev?" rev":""}${neg?" neg":""}">${passed.has(j)?'<span class="st">★</span>':""}<i style="height:${(f*100).toFixed(0)}%"></i><b>${j}</b></div>`;
  }
  return `<div class="rp-shelf">${h}</div>
  <div class="rp-legend"><span><i style="background:linear-gradient(180deg,#ffe08a,#b8860b)"></i>Complete</span>
   <span><i style="background:linear-gradient(180deg,${C.g5},${C.g7})"></i>Partly (fill = share)</span>
   <span><i style="background:#fff;border:1.5px solid ${C.g6};border-radius:50%"></i>Revised in period</span>
   <span>★ Juz test passed</span><span><i style="border:1.5px dashed ${C.red}"></i>Not revised</span></div>`;
}
function journeyHTML(cum,total){
  const pct=Math.min(100,cum/total*100),juz=cum/total*30;
  const ticks=[0,5,10,15,20,25,30].map(j=>`<span class="tick" style="left:${(j/30*100).toFixed(2)}%">${j===30?"Ḥāfiẓ":"J"+j}</span>`).join("");
  return `<div class="rp-journey"><div class="ct" style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:${C.g8}"><span>Journey to complete Ḥifẓ</span><span>${pct.toFixed(1)}% · ≈${juz.toFixed(1)} juz</span></div>
   <div class="rp-track"><i style="width:${Math.max(1.5,pct).toFixed(2)}%"></i><span class="flag" style="left:${Math.min(96,Math.max(4,pct)).toFixed(2)}%">▼ ${pct.toFixed(1)}%</span>${ticks}</div></div>`;
}

/* ---------- capacity, milestones, celebration, duas ---------- */
function capacityInfo(st){
  const cfg=S.config,lpp=cfg.lpp||15,all=periodStats({type:"all"});
  const days=st.daily.filter(d=>d.p===1&&d.ln>0).map(d=>d.ln).sort((a,b)=>a-b);
  const median=days.length?days[Math.floor(days.length/2)]:0;
  const base=all.avg||st.avg||0;
  const target=Math.round(Math.max(3,Math.min(lpp*2,Math.max(base,median)*1.1||lpp/2)));
  const lvl=base>=lpp?["A","High capacity","Comfortably memorises a page or more per class."]
    :base>=lpp*.6?["B","Good capacity","Memorises more than half a page per class."]
    :base>=lpp*.3?["C","Developing","Steady pace — ready to grow with regular revision."]
    :["D","Building foundation","Short portions now; capacity grows with daily practice."];
  const classPerWeek=Math.max(1,7-(cfg.weekly||[]).filter(Boolean).length);
  const attRate=all.classDays?Math.max(.3,all.present/all.classDays):.8;
  const lpw=base*classPerWeek*attRate,remaining=Math.max(0,(cfg.total||9060)-cumulativeTo(null));
  let finish=null;
  if(lpw>0&&remaining>0){const d=new Date();d.setDate(d.getDate()+Math.round(remaining/lpw*7));finish=d;}
  // weekday pattern (period)
  const wd=[0,0,0,0,0,0,0],wc=[0,0,0,0,0,0,0];
  st.daily.forEach(d=>{if(d.p===1){const[y,m,dd]=d.ds.split("-").map(Number);const w=(new Date(y,m-1,dd).getDay()+6)%7;wd[w]+=d.ln;wc[w]++;}});
  const wavg=wd.map((v,i)=>wc[i]?v/wc[i]:0);
  let bestW=-1;wavg.forEach((v,i)=>{if(v>0&&(bestW<0||v>wavg[bestW]))bestW=i;});
  return{avg:st.avg,avgAll:base,best:st.maxDay,bestAll:all.maxDay,median,target,lvl,lpp,finish,remaining,lpw,wavg,bestW};
}
function capacityHTML(cap){
  const max=Math.max(cap.lpp*2,cap.bestAll||0,cap.target)*1.05,pos=v=>(Math.min(v,max)/max*100).toFixed(1);
  const mk=(v,c,l,up)=>`<span class="mk" style="left:${pos(v)}%;background:${c}"></span><span class="lb ${up?"up":"dn"}" style="left:${pos(v)}%;color:${c}">${l}</span>`;
  const years=cap.lpw>0?cap.remaining/cap.lpw/52:null;
  return `<div class="rp-cap"><div>
    <div class="lvl"><div class="badge">${cap.lvl[0]}</div><div><b>${cap.lvl[1]}</b><span class="rp-small">${cap.lvl[2]}</span></div></div>
    <div class="rp-meter">${(()=>{ // greedy label slots: up, down, up-2, down-2 — first slot whose last label is ≥17% away
      const m=[[cap.avg,C.g7,"avg "+cap.avg.toFixed(1)],[cap.lpp,C.dim,"1 page"],[cap.best,C.gold,"best "+cap.best]];
      if(cap.target!==Math.round(cap.avg))m.push([cap.target,C.g5,"target "+cap.target]);
      const last={u0:-99,d0:-99,u1:-99,d1:-99};
      return m.sort((x,y)=>x[0]-y[0]).map(x=>{const p=+pos(x[0]);
        const slot=["u0","d0","u1","d1"].find(k=>p-last[k]>=17)||"d1";last[slot]=p;
        return`<span class="mk" style="left:${p}%;background:${x[1]}"></span><span class="lb ${slot}" style="left:${p}%;color:${x[1]}">${x[2]}</span>`;}).join("");})()}</div>
    <div class="rp-small">Lines per class day · this period</div></div>
    <div class="rp-facts">
      <div class="rp-fact"><div class="v">${cap.target} lines</div><div class="l">Recommended daily new lesson</div></div>
      <div class="rp-fact"><div class="v">${cap.median||"—"}</div><div class="l">Typical (median) day</div></div>
      <div class="rp-fact"><div class="v">${cap.bestW>=0?DOWS[cap.bestW].slice(0,3):"—"}</div><div class="l">Strongest weekday</div></div>
      <div class="rp-fact"><div class="v">${cap.finish?cap.finish.toLocaleDateString("en-GB",{month:"short",year:"numeric"}):"—"}</div><div class="l">${years!=null?`Ḥifẓ completion at this pace (≈${years<1?Math.max(1,Math.round(years*12))+" months":years.toFixed(1)+" years"})`:"Completion estimate"}</div></div>
    </div></div>`;
}
function nextMilestone(mem,lpp){
  const part=mem.juzOrder.filter(j=>mem.frac[j]<.995).sort((a,b)=>mem.frac[b]-mem.frac[a])[0];
  if(part){const left=Math.max(1,Math.round((1-mem.frac[part])*mem.ppj*lpp));return`Next milestone: complete <b>Juz ${part}</b> — about ${fmt(left)} lines to go.`;}
  return mem.juzOrder.length?"Next milestone: begin the next juz with a strong start.":"Next milestone: complete the first surah of the plan.";
}
function completedJuz(P,st){
  const set=new Set(st.juzTests.filter(t=>t.result==="pass").map(t=>+t.juz));
  const end=endKeyFor(P),pv=prevPeriod(P);
  if(P.type!=="all"){
    const now=memorised(end),before=memorised(pv?endKeyFor(pv):"0000-00");
    for(let j=1;j<=30;j++)if(now.frac[j]>=.995&&before.frac[j]<.995)set.add(j);
  }else{const now=memorised(null);for(let j=1;j<=30;j++)if(now.frac[j]>=.995)set.add(j);}
  return[...set].filter(Boolean).sort((a,b)=>a-b);
}
const DUA={
  zidni:{ar:"رَّبِّ زِدْنِي عِلْمًا",tr:"Rabbi zidnī ʿilmā",mn:"“My Lord, increase me in knowledge.”",src:"Sūrah Ṭā-Hā 20:114"},
  sharh:{ar:"رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي ۝ وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي ۝ يَفْقَهُوا قَوْلِي",tr:"Rabbish-raḥ lī ṣadrī, wa yassir lī amrī, waḥlul ʿuqdatam-min lisānī, yafqahū qawlī",mn:"“My Lord, expand my chest, ease my task for me, and untie the knot from my tongue, so they may understand my speech.”",src:"Sūrah Ṭā-Hā 20:25–28"},
  tatim:{ar:"الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ",mn:"“All praise is for Allah, by whose favour good deeds are completed.”",src:"Ibn Mājah"},
  rabi:{ar:"اللَّهُمَّ اجْعَلِ الْقُرْآنَ رَبِيعَ قَلْبِي، وَنُورَ صَدْرِي",mn:"“O Allah, make the Qur’an the spring of my heart and the light of my chest.”",src:"Musnad Aḥmad"}
};
const duaCard=(d,label)=>`<div class="rp-dua"><div class="lb">${label}</div><span class="rp-ar">${d.ar}</span>${d.tr?`<div class="tr">${d.tr}</div>`:""}<div class="mn">${d.mn}</div><div class="src">${d.src}</div></div>`;
function motivationText(name,V,st,A,cap){
  const weak=A.imp[0]?A.imp[0][0].toLowerCase():"daily revision";
  if(!st.eligible)return`${name}, every ḥāfiẓ began with a single line. Let’s start again with ${cap.target} lines a day — you can do it, in shā’ Allāh!`;
  if(st.score>=85)return`Mā shā’ Allāh, ${name}! You are among the shining students of this period. Keep the same routine — consistency is your superpower.`;
  if(st.score>=70)return`Great effort, ${name}! A little more focus on ${weak} will take you to excellent, in shā’ Allāh.`;
  if(st.score>=55)return`Good progress, ${name}. Small steps every day with steady revision will lift you quickly — keep going!`;
  return`${name}, the Qur’an rewards the one who keeps trying. Let’s build back with a small target of ${cap.target} lines a day and daily revision — you can do this!`;
}
function celebrateHTML(name,juzList,full,msg){
  if(!juzList.length)return"";
  const medals=juzList.slice(0,4).map(j=>`<div class="rp-medal">Juz<br>${j}</div>`).join("");
  return `<div class="rp-celebrate"><div class="top">${medals}<div><h5>Mabrūk! ${juzList.length>1?juzList.length+" juz completed":"Juz "+juzList[0]+" completed"} 🎉</h5>
    <p>${msg||`${name} has completed ${juzList.length>1?"Juz "+juzList.join(", "):"Juz "+juzList[0]} — a milestone for the family and the academy.`} Bārak Allāhu fīk!</p></div></div>
    <span class="rp-ar">${DUA.tatim.ar}</span><div class="mn">${DUA.tatim.mn} · ${DUA.tatim.src}</div>
    ${full?`<span class="rp-ar" style="font-size:17px;margin-top:6px">${DUA.rabi.ar}</span><div class="mn">${DUA.rabi.mn} · ${DUA.rabi.src}</div>`:""}</div>`;
}

/* ---------- live-report poster (share link + QR) ---------- */
const LIB={
  h2c:"https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
  pdf:"https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
  qr:"https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js"
};
const _libs={};
function loadLib(k){
  if(!_libs[k])_libs[k]=new Promise((res,rej)=>{const sc=document.createElement("script");sc.src=LIB[k];sc.async=true;
    sc.onload=()=>res();sc.onerror=()=>{delete _libs[k];rej(new Error("Could not load "+k));};document.head.appendChild(sc);});
  return _libs[k];
}
// read-only teacher/parent link for the open student (share links boot with CAN_EDIT=false)
function studentLink(){
  if(location.protocol==="file:")return null;
  const base=location.origin+"/portal/study-report/";
  if(LINK&&LINK.sid&&LINK.tok)return base+"?s="+encodeURIComponent(LINK.sid)+"&t="+encodeURIComponent(LINK.tok);
  const r=Array.isArray(roster)?roster.find(x=>x.id===currentId):null;
  return r&&r.share_token?base+"?s="+encodeURIComponent(r.id)+"&t="+encodeURIComponent(r.share_token):null;
}
function qrSVG(url){
  if(!window.qrcode||!url)return"";
  try{const q=qrcode(0,"M");q.addData(url);q.make();
    return q.createSvgTag({cellSize:4,margin:0,scalable:true});}catch(e){return"";}
}
function posterHTML(first){
  const url=studentLink();if(!url)return"";
  const qr=qrSVG(url);
  return `<a class="rp-poster" href="${esc(url)}" target="_blank" rel="noopener">
    <div class="qr">${qr||'<span class="rp-small">QR</span>'}</div>
    <div class="tx"><div class="k">Live Ḥifẓ report · <span class="rp-ar">التقرير المباشر</span></div>
      <div class="h">Scan or tap to open ${first}’s live study report</div>
      <div class="d">Daily log, progress and plan — updated after every class. View-only link.</div>
      <div class="u">${esc(url.replace(/^https?:\/\//,"").replace(/&t=.*/,"&t=…"))}</div></div></a>`;
}

/* =====================================================================
   INDIVIDUAL PROGRESS REPORT (view v-progress)
   ===================================================================== */
const RP={type:"month",key:null,fmt:"minimal"};
window.setReportPeriod=function(P){RP.type=P.type;RP.key=P.key||null;};

function rankFor(P){
  if(LINK||!Array.isArray(roster)||roster.length<2)return null;
  const list=roster.map(r=>{const state=r.id===currentId?S:r.state;
    const st=r.id===currentId?periodStats(P):withState(state,()=>periodStats(P));
    return{id:r.id,score:st.score,eligible:st.eligible};}).filter(x=>x.eligible).sort((a,b)=>b.score-a.score);
  const i=list.findIndex(x=>x.id===currentId);
  return i<0?null:{rank:i+1,of:list.length};
}

function renderControls(){
  const ks=monthKeys(),years=[...new Set(ks.map(k=>k.slice(0,4)))].sort().reverse();
  if(RP.type==="month"&&!ks.includes(RP.key))RP.key=(activeMonth&&ks.includes(activeMonth))?activeMonth:ks[ks.length-1]||null;
  if(RP.type==="year"&&!years.includes(RP.key))RP.key=years[0]||null;
  const opts=RP.type==="month"?ks.slice().reverse().map(k=>`<option value="${k}"${k===RP.key?" selected":""}>${monthLabel(k)}</option>`).join("")
    :RP.type==="year"?years.map(y=>`<option value="${y}"${y===RP.key?" selected":""}>${y}</option>`).join(""):"";
  return `<div class="rp-controls no-print">
    <div class="rp-seg" role="group" aria-label="Report period">
      ${[["month","Monthly"],["year","Yearly"],["all","All time"]].map(([v,l])=>`<button data-rpt="${v}" class="${RP.type===v?"on":""}">${l}</button>`).join("")}
    </div>
    ${RP.type!=="all"?`<select class="ix-select" id="rpKey" aria-label="Choose period">${opts}</select>`:""}
    <div class="rp-seg" role="group" aria-label="Report format">
      <button data-rpf="minimal" class="${RP.fmt==="minimal"?"on":""}">Minimal</button>
      <button data-rpf="detailed" class="${RP.fmt==="detailed"?"on":""}">Complete</button>
    </div>
    <span class="grow"></span>
    <div class="rp-actions">
      <button class="btn gold ix-btn" id="rpPdf">⬇ Download HD PDF</button>
      <button class="btn ghost ix-btn" id="rpCopy">Copy WhatsApp summary</button>
    </div></div>`;
}

function buildReport(){
  const P={type:RP.type,key:RP.key},detailed=RP.fmt==="detailed",cfg=S.config,lpp=cfg.lpp||15;
  const name=esc(cfg.student||"Student"),first=esc(String(cfg.student||"Student").split(" ")[0]);
  const st=periodStats(P),pv=prevPeriod(P),prev=pv?periodStats(pv):null;
  const endKey=endKeyFor(P),cum=cumulativeTo(endKey),mem=memorised(endKey);
  const A=analyse(st,prev,mem),rank=rankFor(P),V=verdict(st.score);
  const passedAll=new Set();monthKeys().filter(k=>!endKey||k<=endKey).forEach(k=>{const days=(S.months[k]&&S.months[k].days)||{};
    Object.values(days).forEach(r=>{if(r&&r.ev&&r.ev.type==="juz"&&r.ev.result==="pass")passedAll.add(+r.ev.juz);});});
  const cyc=manzilCycle(mem),plan=weekPlan(mem,cyc,P),cap=capacityInfo(st),done=completedJuz(P,st);
  const gen=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});
  const plabel=esc(periodLabel(P));
  const foot=`<div class="rp-foot"><span>ManzilulQuran E-learning Academy · manzilulquran.in</span><span>info@manzilulquran.in</span></div>`;
  const band=`<div class="rp-band"><div class="crest"><img src="${location.origin}/og-image.jpg" alt="" crossorigin="anonymous"></div>
    <div style="position:relative;z-index:1"><div class="t1">${esc(cfg.academy||"ManzilulQuran E-learning Academy")}</div>
      <div class="t2">Ḥifẓ Progress Report<span class="rp-ar">تقرير الحفظ</span></div></div>
    <div class="who"><div class="nm rp-gold-lt">${name}</div>
      <span class="rp-chip">${plabel}</span>${rank&&rank.rank<=Math.max(3,Math.ceil(rank.of/2))?`<span class="rp-chip gold">★ Rank ${rank.rank} of ${rank.of}</span>`:""}
      <span class="gen">Generated ${gen} · ${detailed?"Complete":"Minimal"} report</span></div></div>`;
  const slim=(t,n)=>`<div class="rp-band slim"><div style="position:relative;z-index:1"><div class="t2"><span class="rp-gold-lt">${name}</span> · ${t}</div></div><div class="pg">${plabel} · Page ${n} of 3</div></div>`;
  const sheet=(inner)=>`<article class="rp-doc">${inner}</article>`;

  if(!st.keys.length||(!st.eligible&&!st.log.length)){
    return sheet(band+`<div class="rp-body"><div class="rp-empty">No daily records for ${plabel} yet.<br>Choose another period or add entries in the Daily Log.</div></div>`+foot);
  }

  /* ---- shared blocks ---- */
  const hasPrev=prev&&prev.eligible;
  const delta=(a,b,unit)=>{if(b==null)return"";const d=a-b;if(Math.abs(d)<0.5)return`<div class="d rp-muted">= previous</div>`;
    return`<div class="d ${d>0?"rp-up":"rp-down"}">${d>0?"▲":"▼"} ${fmt(Math.abs(Math.round(d)))}${unit}</div>`;};
  const summary=`${name} memorised <b>${fmt(st.lines)} lines</b> (${st.pages.toFixed(1)} pages) and attended <b>${st.present} of ${st.classDays}</b> class days.
    Total memorised: <b>${(cum/lpp).toFixed(1)} pages ≈ ${(cum/cfg.total*30).toFixed(1)} juz</b>.`;
  const hero=`<div class="rp-hero"><div class="ring">${ringSVG(st.score)}</div><div>
    <span class="rp-grade">${V.t}<span class="rp-ar">${V.ar}</span></span>
    ${done.length?`<span class="rp-grade" style="background:linear-gradient(90deg,#c9961a,#f5c542);color:#3d2a00;margin-left:6px">🎉 Juz ${done.join(", ")} completed</span>`:""}
    <div class="rp-sum">${summary}</div></div></div>`;
  const kp=[
    ["book",fmt(st.lines),"New lines",delta(st.lines,hasPrev?prev.lines:null,"")],
    ["cal",pctTxt(st.att),"Attendance",delta(st.att,hasPrev?prev.att:null," pts")],
    ["bolt",st.avg.toFixed(1)+"<small> /day</small>","Lines per class day",""],
    ["globe",(cum/cfg.total*100).toFixed(1)+"<small>%</small>","Of the Qur’an memorised",""]];
  if(detailed)kp.push(
    ["layers",(cum/lpp).toFixed(1),"Pages memorised in total",""],
    ["loop",pctTxt(st.dims.revision),"Class days with revision",""],
    ["award",st.examAvg!=null?Math.round(st.examAvg)+"%":"—","Exam average",""],
    ["flame",String(currentStreak()),"Current streak (days)",""]);
  const kpis=`<div class="rp-kpis">${kp.map(k=>`<div class="rp-kpi"><div class="ic">${ico(k[0])}</div><div><div class="v">${k[1]}</div><div class="l">${k[2]}</div>${k[3]}</div></div>`).join("")}</div>`;
  const shelf=`<div class="rp-h">30 Juz map <span class="rp-ar">خريطة الأجزاء</span><small>fill ≈ share memorised</small></div>${shelfHTML(mem,st,passedAll)}`;

  let linesChart,attChart,monthRows=null;
  if(P.type==="month"){
    const bestD=Math.max(...st.daily.map(d=>d.ln));
    linesChart=barsSVG(st.daily.map(d=>({lab:String(d.d),v:d.ln,off:!d.cls,absent:d.p===0,hi:d.ln>0&&d.ln===bestD})),detailed?{h:210,w:360}:{h:130});
    attChart=calendarHTML(st);
  }else{
    let c=cumulativeTo(prevMonthKey(st.keys[0]));
    monthRows=st.keys.map(k=>{const m=periodStats({type:"month",key:k});c+=m.lines;return{k,lab:monthShort(k),v:m.lines,cum:c,att:m.att,present:m.present,classDays:m.classDays};});
    linesChart=barsSVG(monthRows.map(r=>({lab:r.lab,v:r.v})),{cum:monthRows.map(r=>r.cum),h:detailed?190:130,w:detailed?360:560});
    attChart=monthRows.length>1?attLineSVG(monthRows):`<div class="rp-small">Attendance ${pctTxt(monthRows[0]?monthRows[0].att:0)}</div>`;
  }
  const linesCard=`<div class="rp-card"><div class="ct">${P.type==="month"?"Lines memorised each day":"Lines per month"}<span>${P.type==="month"?"gold = best day · red dot = absent":"gold line = total memorised"}</span></div>${linesChart}</div>`;

  const nGood=2,nImp=detailed?3:2;
  const li=l=>l.map(x=>`<li><div><b>${esc(x[0])}</b><span>${esc(x[1])}</span></div></li>`).join("");
  const strengths=`<div class="rp-grid g2"><div><div class="rp-sub">Strengths</div><ul class="rp-list">${A.good.length?li(A.good.slice(0,nGood)):`<li><div><b>Keep building</b><span>Strengths will show as more days are recorded.</span></div></li>`}</ul></div>
    <div><div class="rp-sub imp">Areas to improve</div><ul class="rp-list imp">${A.imp.length?li(A.imp.slice(0,nImp)):`<li><div><b>No weak area found</b><span>Maintain the same routine, in shā’ Allāh.</span></div></li>`}</ul></div></div>`;

  // 7-day checklist plan
  const cycTxt=!cyc.days.length?"Revision cycle appears once new lessons are recorded."
    :mem.M<=1?"Memorised portion is small — revise all of it every class day."
    :`Revise ≈${cyc.D.toFixed(0)} pages a day · full cycle every ${cyc.days.length} class days.`;
  const planRows=plan.rows.map(r=>r.off
    ?`<tr class="off"><td class="rp-first nw" data-l="Day">${dLabel(r.ds)}</td><td data-l="Juz reading" colspan="4">Holiday — listen to this week’s lessons, light recitation</td></tr>`
    :`<tr><td class="rp-first nw" data-l="Day">${dLabel(r.ds)}</td>
      <td data-l="Juz reading">${r.day?`${juzBadges(r.day)}${compactSeg(r.day,true)} <span class="rp-small">≈${pagesOf(r.day).toFixed(1)}p</span>`:"—"}</td>
      <td data-l="Sabaq" style="text-align:center"><span class="tick"></span></td><td data-l="Sabqi" style="text-align:center"><span class="tick"></span></td><td data-l="Manzil" style="text-align:center"><span class="tick"></span></td></tr>`).join("");
  const planSec=`<div class="rp-h">Daily juz reading plan <span class="rp-ar">الورد اليومي</span><small>next 7 days</small></div>
    <div class="rp-grid g2" style="margin-bottom:8px">
      <div class="rp-fact"><div class="v" style="font-size:12.5px">New lesson (Sabaq): ≈ ${plan.target} lines</div><div class="l">${plan.cont}</div></div>
      <div class="rp-fact"><div class="v" style="font-size:12.5px">Sabqi — every day</div><div class="l">${plan.sabqiTxt}</div></div></div>
    <table class="rp-tbl rp-stack"><thead><tr><th>Day</th><th>Juz reading (Manzil)</th><th style="text-align:center">Sabaq</th><th style="text-align:center">Sabqi</th><th style="text-align:center">Manzil</th></tr></thead><tbody>${planRows}</tbody></table>
    <div class="rp-small" style="margin-top:4px">${cycTxt} Tick each box when done.</div>`;

  const motiv=`<div class="rp-motiv"><div class="msg">${motivationText(first,V,st,A,cap)}</div><div class="next">${nextMilestone(mem,lpp)}</div>
    ${detailed?`<div class="hd"><span class="rp-ar">اقْرَأْ وَارْتَقِ وَرَتِّلْ كَمَا كُنْتَ تُرَتِّلُ فِي الدُّنْيَا</span>
      <span>“It will be said to the companion of the Qur’an: recite and rise, and recite as you used to recite in the world — your rank is at the last verse you recite.” — Abū Dāwūd, at-Tirmidhī</span></div>`
      :`<div class="hd"><span>“The best of you are those who learn the Qur’an and teach it.” — al-Bukhārī</span></div>`}</div>`;
  const remarks=`<div class="rp-h">Teacher’s remarks</div><div class="rp-rem"><div class="rp-remarks">&nbsp;</div><div class="rp-sign"><div>Teacher</div><div>Parent</div><div>Date</div></div></div>`;

  /* ---------------- MINIMAL: one sheet ---------------- */
  if(!detailed){
    const pt=l=>l.length?l.map(p=>esc(portionText(p))).join(", "):"—";
    const recent=st.log.slice(-5);
    const recentSec=`<div class="rp-h">Recent sessions <small>last ${recent.length}</small></div>
      <table class="rp-tbl rp-stack"><thead><tr><th>Date</th><th>✓</th><th>New lesson</th><th>Lines</th><th>Revision</th></tr></thead><tbody>
      ${recent.map(r=>`<tr><td class="rp-first nw" data-l="Date">${dLabel(r.ds)}</td><td data-l="Present">${r.p===1?'<span class="rp-ok">✓</span>':r.p===0?'<span class="rp-no">✗</span>':"·"}</td>
        ${r.ev?`<td data-l="Event" colspan="3" class="rp-ev">${r.ev.type==="juz"?`Juz ${r.ev.juz} submission — ${r.ev.result==="pass"?"completed ★":"try again"}`:"Exam day"}</td>`
        :`<td data-l="New lesson">${pt(r.nl)}</td><td data-l="Lines">${r.ln||"—"}</td><td data-l="Revision">${pt(r.sq.concat(r.ol))}</td>`}</tr>`).join("")}</tbody></table>`;
    const sec=h=>`<section class="rp-sec">${h}</section>`;
    return sheet(band+`<div class="rp-body">
      ${hero}
      ${done.length?`<div style="margin-top:10px">${celebrateHTML(first,done,false)}</div>`:""}
      ${sec(`<div class="rp-h">At a glance</div>${kpis}<div style="margin-top:10px">${journeyHTML(cum,cfg.total)}</div>`)}
      ${sec(shelf)}
      ${sec(`<div class="rp-h">Progress</div>${linesCard}`)}
      ${sec(`<div class="rp-h">Strengths &amp; areas to improve</div>${strengths}`)}
      ${sec(planSec)}
      ${sec(recentSec)}
      ${sec(`<div class="rp-h">Motivation &amp; duʿā’</div><div class="rp-grid g2">${motiv}${duaCard(DUA.zidni,"Duʿā’ before lessons")}</div>`)}
      ${sec(remarks)}
      ${posterHTML(first)}</div>`+foot);
  }

  /* ---------------- COMPLETE: three designed A4 pages ---------------- */
  // page 1 — overview
  const p1=sheet(band+`<div class="rp-body">
    ${hero}
    <div class="rp-h">At a glance <small>${hasPrev?"▲▼ vs previous period":""}</small></div>${kpis}
    <div style="margin-top:10px">${journeyHTML(cum,cfg.total)}</div>
    ${shelf}
    <div class="rp-h">Student capacity <small>how much ${first} can memorise</small></div>${capacityHTML(cap)}
  </div>`+foot);

  // page 2 — infographics
  const unmarked=Math.max(0,st.classDays-st.present-st.absent);
  const attParts=[{v:st.present,c:C.g6,l:"Present"},{v:st.absent,c:C.red,l:"Absent"},{v:unmarked,c:C.g1,l:"Not marked"}];
  const mixParts=[{v:st.nlDays,c:C.g7,l:"New lesson"},{v:st.sqDays,c:C.g5,l:"Sabq"},{v:st.olDays,c:C.au5,l:"Old lesson"}];
  let summaryBlock;
  if(P.type==="month"){
    const today=todayStr(),wk=[];
    for(let w=0;w*7<st.daily.length;w++){
      const ds=st.daily.slice(w*7,w*7+7);
      const cls=ds.filter(d=>d.cls&&d.ds<=today).length,pr=ds.filter(d=>d.p===1).length,ln=ds.reduce((a,d)=>a+d.ln,0);
      wk.push({lab:`Week ${w+1}`,sub:`${ds[0].d}–${ds[ds.length-1].d}`,ln,pr,cls});}
    const mx=Math.max(1,...wk.map(w=>w.ln));
    summaryBlock=`<div class="rp-weeks">${wk.map(w=>`<div class="rp-wk"><div class="a">${w.lab} <span style="font-weight:400">· ${w.sub}</span></div><div class="b">${fmt(w.ln)}</div><div class="c">lines · ${w.pr}/${w.cls} days</div><div class="bar"><i style="width:${(w.ln/mx*100).toFixed(0)}%"></i></div></div>`).join("")}</div>`;
  }else{
    const rows=monthRows.slice(-12),mx=Math.max(1,...rows.map(r=>r.v));
    summaryBlock=`<div class="rp-weeks">${rows.map(r=>`<div class="rp-wk"><div class="a">${esc(r.lab)}</div><div class="b">${fmt(r.v)}</div><div class="c">lines · ${pctTxt(r.att)} att.</div><div class="bar"><i style="width:${(r.v/mx*100).toFixed(0)}%"></i></div></div>`).join("")}</div>`;
  }
  const wdBars=barsSVG(cap.wavg.map((v,i)=>({lab:DOWS[i].slice(0,3),v:Math.round(v*10)/10,off:!!(cfg.weekly||[])[i],hi:i===cap.bestW})),{h:150,w:360});
  const p2=sheet(slim("Progress infographics",2)+`<div class="rp-body">
    <div class="rp-h">Memorisation &amp; attendance</div>
    <div class="rp-grid g2">${linesCard}<div class="rp-card"><div class="ct">${P.type==="month"?"Attendance calendar":"Attendance % per month"}<span>${P.type==="month"?"":"dashed = 75% goal"}</span></div>${attChart}</div></div>
    <div class="rp-h">Balance of learning</div>
    <div class="rp-grid g3">
      <div class="rp-card"><div class="ct">Attendance</div><div class="rp-donut">${donutSVG(attParts,pctTxt(st.att),"attendance")}${donutKey(attParts)}</div></div>
      <div class="rp-card"><div class="ct">Lesson mix</div><div class="rp-donut">${donutSVG(mixParts,pctTxt(st.dims.revision),"revised")}${donutKey(mixParts)}</div></div>
      <div class="rp-card"><div class="ct">Skill balance<span>0–100</span></div>${radarSVG(st.dims)}</div></div>
    <div class="rp-h">${P.type==="month"?"Week by week":"Month by month"} <small>log summary</small></div>
    <div class="rp-grid g2"><div>${summaryBlock}</div><div class="rp-card"><div class="ct">Average lines by weekday<span>gold = strongest</span></div>${wdBars}</div></div>
    <div class="rp-h">Strengths &amp; areas to improve</div>${strengths}
  </div>`+foot);

  // page 3 — plan, assessments, guidance, duas
  const cycSec=cyc.days.length>1?`<div class="rp-h">Revision cycle <small>${cyc.days.length} days · in memorisation order</small></div>
    <div class="rp-cycle">${cyc.days.slice(0,12).map((d,i)=>`<div><b>Day ${i+1}</b> ${[...new Set(d.map(u=>"J"+u.j))].join(" ")} · ≈${pagesOf(d).toFixed(0)}p</div>`).join("")}${cyc.days.length>12?`<div>+${cyc.days.length-12} more days</div>`:""}</div>`:"";
  const exRows=st.exams.slice(-3).map(e=>{const pct=e.max?e.obt/e.max:0,[g]=gradeOf(pct);
      const por=e.range?(e.range.from===e.range.to?esc(SURAHS[e.range.from][0]):esc(SURAHS[e.range.from][0])+" → "+esc(SURAHS[e.range.to][0])):e.portion?esc(portionText(e.portion)):"—";
      return`<tr><td class="rp-first nw" data-l="Date">${e.date?dLabel(e.date):"—"}</td><td data-l="Portion">${por}</td><td data-l="Result"><b>${Math.round(pct*100)}%</b> ${esc(g)}</td></tr>`;})
    .concat(st.juzTests.slice(-2).map(t=>`<tr><td class="rp-first nw" data-l="Date">${dLabel(t.ds)}</td><td data-l="Portion">Juz ${t.juz} submission</td><td data-l="Result">${t.result==="pass"?'<span class="rp-ok">★ Passed</span>':'<span class="rp-no">Retry</span>'}</td></tr>`)).join("");
  const tasks=S.tasks.slice(0,4);
  const assess=(exRows||tasks.length)?`<div class="rp-h">Assessments &amp; tasks</div><div class="rp-grid g2">
    <div>${exRows?`<table class="rp-tbl rp-stack"><thead><tr><th>Date</th><th>Exam / juz test</th><th>Result</th></tr></thead><tbody>${exRows}</tbody></table>`:'<div class="rp-small">No exams in this period.</div>'}</div>
    <div class="rp-card"><div class="ct">Memorisation tasks</div>${tasks.length?`<div class="rp-prog">${tasks.map(t=>{const pc=t.target?Math.min(100,t.done/t.target*100):0;
      return`<div class="r"><div class="top"><span>${esc(t.name)}</span><b>${t.done}/${t.target}</b></div><div class="bar"><i style="width:${pc.toFixed(0)}%"></i></div></div>`;}).join("")}</div>`:'<div class="rp-small">No tasks set.</div>'}</div></div>`:"";
  const order=["neglect","attendance","revision","pace","accuracy","consistency"].filter(k=>A.needs.has(k));
  const pick=[];order.forEach(k=>TIPS[k].forEach(t=>pick.push(t)));TIPS.general.forEach(t=>pick.push(t));
  const tips=`<div class="rp-h">How to improve memory <small>chosen for ${first}</small></div><ol class="rp-tips">${pick.slice(0,4).map(x=>`<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join("")}</ol>`;
  const p3=sheet(slim("Plan, guidance & duʿā’",3)+`<div class="rp-body">
    ${planSec}${cycSec}${assess}${tips}
    ${done.length
      ?`<div class="rp-h">Celebration, motivation &amp; duʿā’ <span class="rp-ar">مبروك</span></div><div class="rp-grid g2">${celebrateHTML(first,done,false,motivationText(first,V,st,A,cap))}${duaCard(DUA.zidni,"Duʿā’ for more knowledge")}</div>`
      :`<div class="rp-h">Motivation &amp; duʿā’</div><div class="rp-grid g2">${motiv}${duaCard(DUA.sharh,"Duʿā’ for ease in learning")}</div>`}
    ${remarks}
    ${posterHTML(first)}</div>`+foot);
  return p1+p2+p3;
}

function whatsappText(){
  const P={type:RP.type,key:RP.key},st=periodStats(P),cfg=S.config,lpp=cfg.lpp||15;
  const cum=cumulativeTo(endKeyFor(P)),mem=memorised(endKeyFor(P)),V=verdict(st.score);
  const pv=prevPeriod(P),prev=pv?periodStats(pv):null,A=analyse(st,prev,mem);
  const L=[`*${cfg.student} — Hifz Report*`,`_${periodLabel(P)}_`,"",
    `⭐ Overall: ${Math.round(st.score)}/100 (${V.t})`,
    `📖 New: ${fmt(st.lines)} lines (${st.pages.toFixed(1)} pages)`,
    `🕌 Attendance: ${st.present}/${st.classDays} days (${pctTxt(st.att)})`,
    `🌙 Total memorised: ${(cum/lpp).toFixed(1)} pages ≈ ${(cum/cfg.total*30).toFixed(1)} juz`];
  if(A.good.length)L.push("",`✅ ${A.good[0][0]}`);
  if(A.imp.length)L.push(`🎯 Improve: ${A.imp.slice(0,2).map(x=>x[0]).join(", ")}`);
  L.push("","— ManzilulQuran E-learning Academy");
  return L.join("\n");
}

/* fit each sheet to A4 before printing (Complete: 1 page per sheet, Minimal: 2 pages) */
function fitSheets(on){
  const docs=$$("#rpDoc .rp-doc");
  document.body.classList.toggle("rp-fit",!!on&&docs.length>0);
  docs.forEach(d=>{d.style.zoom="";});
  if(!on||!docs.length)return;
  const PAGE=1040,lim=docs.length>1?PAGE:PAGE*2-120;          // px at 96dpi, A4 minus 8mm margins, small safety
  docs.forEach(d=>{const h=d.offsetHeight;if(h>lim)d.style.zoom=(lim/h).toFixed(3);});
}
window.__rpFit=fitSheets;
window.addEventListener("beforeprint",()=>{const v=$("#v-progress");if(v&&v.offsetParent!==null)fitSheets(true);});
window.addEventListener("afterprint",()=>fitSheets(false));

window.renderProgress=function(){
  if(LINK){const r=$("#progressArea");if(r)r.innerHTML="";return;}   // admin-only feature
  if(!window.qrcode&&studentLink())loadLib("qr").then(()=>{if($("#v-progress")&&$("#v-progress").offsetParent!==null)renderProgress();}).catch(()=>{});
  const root=$("#progressArea");if(!root)return;
  if(!monthKeys().length){root.innerHTML=renderControls()+`<div class="rp-docs"><article class="rp-doc"><div class="rp-empty">Add a month in the Daily Log to generate a report.</div></article></div>`;bindControls();return;}
  const ctl=renderControls();                    // normalises RP.key first
  // one wrapper per labelled cell so stacked phone rows keep label | content on one line
  const html=buildReport().replace(/(<td[^>]*data-l="[^"]*"[^>]*>)([\s\S]*?)(<\/td>)/g,(m,o,inner,c)=>o+"<div>"+inner+"</div>"+c);
  root.innerHTML=ctl+`<div class="rp-docs" id="rpDoc">${html}</div>`;
  bindControls();
};
/* ---------- PDF: phone layout, one continuous page (no A4 page breaks) ----------
   The sheets are laid out in a hidden 400px-wide frame — the same phone layout as the
   on-screen preview on any device — captured with html2canvas, then stacked on a single
   tall PDF page. Each sheet is captured separately to stay under iOS canvas limits. */
const PHONE_W=400,PAD=12,GAP=12,BG="#07140f";
async function buildFrame(){
  const ifr=document.createElement("iframe");
  ifr.setAttribute("aria-hidden","true");
  ifr.style.cssText=`position:fixed;left:-12000px;top:0;width:${PHONE_W}px;height:900px;border:0;`;
  document.body.appendChild(ifr);
  const links=[...document.querySelectorAll('link[rel="stylesheet"]')].filter(l=>/fonts\.googleapis|insights\.css/.test(l.href))
    .map(l=>`<link rel="stylesheet" href="${l.href}">`).join("");
  const html=$("#rpDoc").innerHTML;
  const d=ifr.contentDocument;
  const loaded=new Promise(res=>{ifr.onload=res;setTimeout(res,9000);});
  d.open();
  d.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${PHONE_W}"><base href="${location.origin}/">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Amiri:wght@400;700&display=block">${links}
    </head><body class="rp-phone" style="margin:0;background:${BG}"><div class="rp-docs" style="padding:${PAD}px;gap:${GAP}px">${html}</div></body></html>`);
  d.close();
  await loaded;
  try{await Promise.race([d.fonts.ready,new Promise(r=>setTimeout(r,6000))]);}catch(e){}
  await Promise.all([...d.images].map(im=>im.complete?0:new Promise(r=>{im.onload=im.onerror=r;setTimeout(r,5000);})));
  await new Promise(r=>setTimeout(r,120));
  return ifr;
}
function linkRect(sheet){
  const a=sheet.querySelector(".rp-poster");if(!a)return null;
  const s=sheet.getBoundingClientRect(),r=a.getBoundingClientRect();
  return{x:r.left-s.left,y:r.top-s.top,w:r.width,h:r.height,url:a.getAttribute("href")};
}
async function downloadPDF(btn){
  const label=btn.textContent;btn.disabled=true;btn.textContent="Preparing HD PDF…";
  let ifr=null;
  try{
    await Promise.all([loadLib("h2c"),loadLib("pdf"),loadLib("qr").catch(()=>{})]);
    if(window.qrcode&&!$("#rpDoc .rp-poster svg"))renderProgress();      // make sure the QR is in the sheet
    ifr=await buildFrame();
    const d=ifr.contentDocument,sheets=[...d.querySelectorAll(".rp-doc")];
    const sw=sheets[0].offsetWidth,hs=sheets.map(el=>el.offsetHeight);
    const W=PHONE_W,H=PAD*2+hs.reduce((a,b)=>a+b,0)+GAP*(sheets.length-1);
    const k=Math.min(.75,14000/H);                                       // css px → pt; PDF pages max out at 14400pt
    const pdf=new window.jspdf.jsPDF({unit:"pt",format:[W*k,H*k],orientation:"portrait",compress:true});
    pdf.setFillColor(7,20,15);pdf.rect(0,0,W*k,H*k,"F");
    // HD: 4× resolution, lossless PNG, captured in horizontal strips so each canvas stays
    // well under the iOS canvas-area limit (~16.7M px) however long the report is.
    const SCALE=4,MAXPX=12e6;
    const stripH=Math.max(200,Math.floor(MAXPX/(sw*SCALE*SCALE)));
    const win=d.defaultView;let y=PAD;
    for(let i=0;i<sheets.length;i++){
      const el=sheets[i],h=hs[i],r=el.getBoundingClientRect(),top=r.top+win.scrollY,left=r.left+win.scrollX;
      for(let off=0;off<h;off+=stripH){
        const th=Math.min(stripH,h-off);
        btn.textContent=`Preparing HD PDF… ${Math.round((y+off)/H*100)}%`;
        const c=await window.html2canvas(el,{scale:SCALE,useCORS:true,backgroundColor:BG,logging:false,
          x:left,y:top+off,width:sw,height:th,windowWidth:PHONE_W,scrollX:0,scrollY:0});
        pdf.addImage(c.toDataURL("image/png"),"PNG",PAD*k,(y+off)*k,sw*k,th*k,undefined,"FAST");
        c.width=c.height=0;                                                // free memory right away (iOS)
      }
      const L=linkRect(el);if(L)pdf.link((PAD+L.x)*k,(y+L.y)*k,L.w*k,L.h*k,{url:L.url});
      y+=h+GAP;
    }
    const nm=String(S.config.student||"Student").replace(/[\\/:*?"<>|]/g,"");
    pdf.save(`Hifz Report - ${nm} - ${periodLabel({type:RP.type,key:RP.key}).replace(/[·]/g,"-")}.pdf`);
    toast("HD PDF downloaded ✓");
  }catch(e){console.error(e);toast("Couldn't build the PDF — check the connection and try again");}
  finally{if(ifr)ifr.remove();btn.disabled=false;btn.textContent=label;}
}

function bindControls(){
  $$("#progressArea [data-rpt]").forEach(b=>b.onclick=()=>{RP.type=b.dataset.rpt;RP.key=null;renderProgress();});
  $$("#progressArea [data-rpf]").forEach(b=>b.onclick=()=>{RP.fmt=b.dataset.rpf;renderProgress();});
  const k=$("#rpKey");if(k)k.onchange=()=>{RP.key=k.value;renderProgress();};
  const pd=$("#rpPdf");if(pd)pd.onclick=()=>downloadPDF(pd);
  const cp=$("#rpCopy");if(cp)cp.onclick=async()=>{const txt=whatsappText();
    try{await navigator.clipboard.writeText(txt);toast("Summary copied — paste it in WhatsApp ✓");}catch(e){prompt("Copy this summary:",txt);}};
}

/* =====================================================================
   ACADEMY INSIGHTS (view v-insights, admin roster only)
   ===================================================================== */
const IX={P:null,sort:"score"};
function allMonthKeys(){const s=new Set();roster.forEach(r=>Object.keys((r.state&&r.state.months)||{}).forEach(k=>s.add(k)));return[...s].sort();}
function computeAll(P){
  return roster.map(r=>withState(r.state,()=>{
    const st=periodStats(P),pv=prevPeriod(P),prev=pv?periodStats(pv):null;
    const ks=monthKeys(),spark=ks.slice(-6).map(k=>monthStats(k).lines);
    return{id:r.id,name:r.name||S.config.student,st,prev,cum:cumulativeTo(null),total:S.config.total||9060,
      streak:currentStreak(),spark,updated:r.updated_at};
  }));
}
function sparkSVG(v){if(v.length<2)return"";const m=Math.max(1,...v),W=80,H=22;
  const pts=v.map((x,i)=>`${(i*W/(v.length-1)).toFixed(1)},${(H-2-(H-4)*x/m).toFixed(1)}`).join(" ");
  return`<svg viewBox="0 0 ${W} ${H}" width="80" height="22" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#C9A96E" stroke-width="1.6"/></svg>`;}

window.openInsights=function(){
  showOnly("v-insights");
  const ks=allMonthKeys(),now=todayStr().slice(0,7);
  if(!IX.P)IX.P=ks.includes(now)?{type:"month",key:now}:ks.length?{type:"month",key:ks[ks.length-1]}:{type:"all"};
  renderInsights();window.scrollTo({top:0});
};
function renderInsights(){
  const root=$("#insightsArea");if(!root)return;
  const ks=allMonthKeys(),years=[...new Set(ks.map(k=>k.slice(0,4)))].sort().reverse(),P=IX.P;
  const sel=`<select class="ix-select" id="ixPeriod" aria-label="Period">
    <optgroup label="Month">${ks.slice().reverse().map(k=>`<option value="month:${k}"${P.type==="month"&&P.key===k?" selected":""}>${monthLabel(k)}</option>`).join("")}</optgroup>
    <optgroup label="Year">${years.map(y=>`<option value="year:${y}"${P.type==="year"&&P.key===y?" selected":""}>Year ${y}</option>`).join("")}</optgroup>
    <option value="all:"${P.type==="all"?" selected":""}>All time</option></select>`;
  const top=`<div class="ix-top"><button class="btn ghost ix-btn" id="ixBack">← Students</button><h2>Academy Insights</h2>${sel}
    <div class="ix-sub">Who is leading, who attends most, and who needs help — calculated live from every student’s daily log.</div></div>`;
  if(!roster.length){root.innerHTML=top+`<div class="empty-note">No students yet.</div>`;bindIx();return;}

  const all=computeAll(P),act=all.filter(x=>x.st.eligible);
  const plabel=P.type==="month"?monthLabel(P.key):P.type==="year"?"Year "+P.key:"All time";
  const by=(f)=>act.slice().sort((a,b)=>f(b)-f(a));
  const ranked=by(x=>x.st.score);
  const totLines=act.reduce((a,x)=>a+x.st.lines,0);
  const avgAtt=act.length?act.reduce((a,x)=>a+x.st.att,0)/act.length:0;
  const passes=act.reduce((a,x)=>a+x.st.jtPass,0);
  const kpis=`<div class="ix-kpis">
    <div class="ix-kpi"><div class="v">${act.length}<span style="font-size:15px;color:var(--dim)"> / ${all.length}</span></div><div class="l">Active students</div></div>
    <div class="ix-kpi"><div class="v">${fmt(totLines)}</div><div class="l">Lines memorised</div></div>
    <div class="ix-kpi"><div class="v">${Math.round(avgAtt)}%</div><div class="l">Average attendance</div></div>
    <div class="ix-kpi"><div class="v">${passes}</div><div class="l">Juz submissions passed</div></div></div>`;

  const pod=[ranked[1],ranked[0],ranked[2]].map((x,i)=>{const pos=[2,1,3][i];
    if(!x)return`<div class="ix-pod p${pos} empty"></div>`;
    return`<div class="ix-pod p${pos}" data-open="${x.id}" role="button" tabindex="0"><div class="ix-medal">${pos}</div>
      <div class="ix-pname">${esc(x.name)}</div><div class="ix-pscore">${Math.round(x.st.score)} pts · ${fmt(x.st.lines)} lines</div>
      <div class="ix-plinth">${pos===1?"Best of the "+(P.type==="month"?"month":"period"):"#"+pos}</div></div>`;}).join("");
  const hero=`<div class="ix-hero"><h3>${P.type==="month"?"Stars of the month":"Top students"}</h3><div class="ix-hsub">${esc(plabel)} · ranked by overall score</div>
    <div class="ix-podium">${pod}</div></div>`;

  const award=(ic,t,x,m)=>x?`<button class="ix-award" data-open="${x.id}"><span class="ic">${ic}</span><span><span class="t">${t}</span><div class="n">${esc(x.name)}</div><span class="m">${m}</span></span></button>`
    :`<div class="ix-award none"><span class="ic">${ic}</span><span><span class="t">${t}</span><div class="n">—</div></span></div>`;
  const topMem=by(x=>x.st.lines)[0];
  const topAtt=act.filter(x=>x.st.classDays>=3).sort((a,b)=>b.st.att-a.st.att||b.st.present-a.st.present)[0];
  const topRev=by(x=>x.st.revDays)[0];
  const impr=act.filter(x=>x.prev&&x.prev.eligible).map(x=>({x,d:x.st.lines-x.prev.lines})).filter(o=>o.d>0).sort((a,b)=>b.d-a.d)[0];
  const topEx=act.filter(x=>x.st.examAvg!=null).sort((a,b)=>b.st.examAvg-a.st.examAvg)[0];
  const topStr=by(x=>x.streak)[0];
  const awards=`<div class="ix-awards">
    ${award("📖","Top memoriser",topMem&&topMem.st.lines>0?topMem:null,topMem?`${fmt(topMem.st.lines)} lines · ${topMem.st.pages.toFixed(1)} pages`:"")}
    ${award("🕌","Attends the most",topAtt,topAtt?`${pctTxt(topAtt.st.att)} · ${topAtt.st.present}/${topAtt.st.classDays} days`:"")}
    ${award("🔁","Best reviser",topRev&&topRev.st.revDays>0?topRev:null,topRev?`Revision on ${topRev.st.revDays} days`:"")}
    ${award("📈","Most improved",impr?impr.x:null,impr?`+${fmt(impr.d)} lines vs previous`:"")}
    ${award("🎓","Top exam score",topEx,topEx?`${topEx.st.examAvg.toFixed(0)}% average`:"")}
    ${award("🔥","Longest current streak",topStr&&topStr.streak>0?topStr:null,topStr?`${topStr.streak} class days in a row`:"")}</div>`;

  const maxL=Math.max(1,...act.map(x=>x.st.lines));
  const bars=`<div class="ix-card"><h3>Lines memorised <small>${esc(plabel)}</small></h3><div class="ix-bars">
    ${by(x=>x.st.lines).map(x=>`<div class="ix-bar"><span class="nm">${esc(x.name)}</span><span class="tr"><i data-w="${(x.st.lines/maxL*100).toFixed(1)}"></i></span><span class="vv">${fmt(x.st.lines)}</span></div>`).join("")||'<div class="ix-note">No lines recorded.</div>'}</div></div>`;

  const sorts={score:["Score",x=>x.st.score],lines:["Lines",x=>x.st.lines],att:["Attendance",x=>x.st.att],rev:["Revision",x=>x.st.revDays],exam:["Exams",x=>x.st.examAvg??-1],total:["Total hifz",x=>x.cum]};
  const list=act.slice().sort((a,b)=>sorts[IX.sort][1](b)-sorts[IX.sort][1](a));
  const board=`<div class="ix-card"><h3>Leaderboard <small>tap a student for the full report</small></h3>
    <div class="ix-sort">${Object.entries(sorts).map(([k,v])=>`<button data-sort="${k}" class="${IX.sort===k?"on":""}">${v[0]}</button>`).join("")}</div>
    <div class="ix-head"><span>#</span><span>Student</span><span>Score</span><span>Lines</span><span>Attend.</span><span>Revision</span><span>Exams</span><span>Total</span><span>6 months</span></div>
    <div class="ix-list">${list.map((x,i)=>`<div class="ix-row" data-open="${x.id}" role="button" tabindex="0">
      <span class="ix-rank">${i+1}</span>
      <span class="who"><b>${esc(x.name)}</b><span>${fmt(x.st.lines)} lines · ${pctTxt(x.st.att)} att. · ${(x.cum/x.total*100).toFixed(1)}% hifz</span></span>
      <span class="sc">${Math.round(x.st.score)}<small>score</small></span>
      <span class="cols"><span>${fmt(x.st.lines)}</span><span>${pctTxt(x.st.att)}</span><span>${x.st.revDays} d</span><span>${x.st.examAvg!=null?Math.round(x.st.examAvg)+"%":"—"}</span><span>${(x.cum/x.total*100).toFixed(1)}%</span></span>
      <span class="spark">${sparkSVG(x.spark)}</span></div>`).join("")||'<div class="ix-note">No activity in this period.</div>'}</div></div>`;

  // needs attention
  const attn=[];
  act.forEach(x=>{
    if(x.st.classDays>=4&&x.st.att<60)attn.push([x,`attendance ${pctTxt(x.st.att)}`]);
    else if(x.st.present>=3&&x.st.lines===0)attn.push([x,`present ${x.st.present} days but no new lines recorded`]);
    else if(x.st.present>=3&&x.st.dims.revision<40)attn.push([x,`revision on only ${x.st.revDays} of ${x.st.present} present days`]);
  });
  if(P.type==="month"&&P.key===todayStr().slice(0,7))all.forEach(x=>{
    if(x.updated&&(Date.now()-new Date(x.updated).getTime())>10*864e5)attn.push([x,`log not updated for ${Math.floor((Date.now()-new Date(x.updated).getTime())/864e5)} days`]);});
  const idle=all.filter(x=>!x.st.eligible);
  const attnCard=`<div class="ix-card"><h3>Needs attention</h3><div class="ix-attn">
    ${attn.map(([x,why])=>`<div data-open="${x.id}" role="button" tabindex="0" style="cursor:pointer"><span>⚠</span><span><b>${esc(x.name)}</b> — <span>${esc(why)}</span></span></div>`).join("")||'<div style="background:rgba(47,174,127,.08);border-color:rgba(47,174,127,.25)"><span>✓</span><span>No concerns in this period, al-ḥamdu lillāh.</span></div>'}
    ${idle.length?`<div style="background:rgba(255,255,255,.03);border-color:var(--line)"><span>○</span><span><b>No records:</b> <span>${idle.map(x=>esc(x.name)).join(", ")}</span></span></div>`:""}
    </div><p class="ix-note" style="margin-top:12px">Score = pace ${WEIGHTS.pace}% (1 page per present day = full marks) · attendance ${WEIGHTS.attendance}% · revision ${WEIGHTS.revision}% · consistency ${WEIGHTS.consistency}% · exams ${WEIGHTS.accuracy}%. Students with no exams are scored on the other four.</p></div>`;

  root.innerHTML=top+kpis+hero+awards+board+`<div class="ix-grid2">${bars}${attnCard}</div>`;
  requestAnimationFrame(()=>$$("#insightsArea .ix-bar .tr i").forEach(b=>b.style.width=b.dataset.w+"%"));
  bindIx();
}
function bindIx(){
  const b=$("#ixBack");if(b)b.onclick=()=>enterRoster();
  const s=$("#ixPeriod");if(s)s.onchange=()=>{const[t,k]=s.value.split(":");IX.P={type:t,key:k||null};renderInsights();};
  $$("#insightsArea [data-sort]").forEach(x=>x.onclick=()=>{IX.sort=x.dataset.sort;renderInsights();});
  $$("#insightsArea [data-open]").forEach(el=>{
    const go=()=>{const id=el.dataset.open;openStudent(id);RP.type=IX.P.type;RP.key=IX.P.key;RP.fmt="minimal";gotoView("progress");window.scrollTo({top:0});};
    el.onclick=go;el.onkeydown=e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go();}};
  });
}
})();
