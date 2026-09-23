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

/* ---------- small SVG builders (parchment palette) ---------- */
function gaugeSVG(score){
  const r=70,cx=90,cy=86,a0=Math.PI,a=a0-Math.PI*Math.min(1,score/100);
  const pt=ang=>[cx+r*Math.cos(ang),cy-r*Math.sin(ang)];
  const [x0,y0]=pt(a0),[x1,y1]=pt(0),[xa,ya]=pt(a);
  return `<svg viewBox="0 0 180 104" width="180" role="img" aria-label="Overall score ${Math.round(score)} of 100">
    <defs><linearGradient id="rpG" x1="0" x2="1"><stop offset="0" stop-color="#1f8a62"/><stop offset="1" stop-color="#c79a43"/></linearGradient></defs>
    <path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}" fill="none" stroke="rgba(29,42,34,.1)" stroke-width="14" stroke-linecap="round"/>
    ${score>0?`<path d="M${x0} ${y0} A${r} ${r} 0 0 1 ${xa.toFixed(1)} ${ya.toFixed(1)}" fill="none" stroke="url(#rpG)" stroke-width="14" stroke-linecap="round"/>`:""}
    <text x="90" y="80" text-anchor="middle" font-family="Marcellus,serif" font-size="34" fill="#0f5a41">${Math.round(score)}</text>
    <text x="90" y="98" text-anchor="middle" font-family="Outfit,sans-serif" font-size="10.5" fill="#5c6b5f">overall score / 100</text></svg>`;
}
function radarSVG(dims){
  const keys=Object.keys(WEIGHTS),cx=130,cy=112,R=78,n=keys.length;
  const pt=(i,v)=>{const ang=-Math.PI/2+i*2*Math.PI/n;return[cx+R*v*Math.cos(ang),cy+R*v*Math.sin(ang)];};
  let grid="";[.25,.5,.75,1].forEach(f=>{grid+=`<polygon points="${keys.map((_,i)=>pt(i,f).join(",")).join(" ")}" fill="none" stroke="rgba(29,42,34,.12)"/>`;});
  const axes=keys.map((_,i)=>{const[x,y]=pt(i,1);return`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(29,42,34,.12)"/>`;}).join("");
  const poly=keys.map((k,i)=>pt(i,Math.max(.02,(dims[k]??0)/100)).map(v=>v.toFixed(1)).join(",")).join(" ");
  const labels=keys.map((k,i)=>{const[x,y]=pt(i,1.2);const v=dims[k];
    return`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="Outfit,sans-serif" font-size="10.5" fill="#5c6b5f">${DIM_LABEL[k].split(" ")[0]}<tspan x="${x.toFixed(1)}" dy="12" fill="#0f5a41" font-weight="600">${v==null?"—":Math.round(v)}</tspan></text>`;}).join("");
  return `<svg viewBox="0 0 260 236" role="img" aria-label="Skill balance">${grid}${axes}
    <polygon points="${poly}" fill="rgba(31,138,98,.22)" stroke="#1f8a62" stroke-width="2"/>${labels}</svg>`;
}
function barsSVG(items,opts){ // items [{lab,v,off,absent}] ; opts {cum:[..]|null, h}
  const W=560,H=opts.h||170,pl=30,pr=opts.cum?34:8,pt=10,pb=22,n=items.length||1;
  const max=Math.max(1,...items.map(i=>i.v)),bw=(W-pl-pr)/n;
  let g="";[0,.5,1].forEach(f=>{const y=pt+(H-pt-pb)*(1-f);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="rgba(29,42,34,.08)"/><text x="${pl-4}" y="${y+3}" text-anchor="end" font-size="9" fill="#8a8f80">${Math.round(max*f)}</text>`;});
  const every=Math.ceil(n/12);
  const bars=items.map((it,i)=>{const h=(H-pt-pb)*it.v/max,x=pl+i*bw+bw*.15,w=bw*.7;
    const col=it.absent?"rgba(180,85,47,.35)":it.off?"rgba(29,42,34,.12)":"url(#rpB)";
    const bar=it.v>0?`<rect x="${x.toFixed(1)}" y="${(H-pb-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${col}"><title>${esc(it.lab)}: ${it.v}</title></rect>`
      :it.absent?`<rect x="${x.toFixed(1)}" y="${H-pb-3}" width="${w.toFixed(1)}" height="3" fill="rgba(180,85,47,.6)"><title>${esc(it.lab)}: absent</title></rect>`:"";
    const lab=i%every===0?`<text x="${(x+w/2).toFixed(1)}" y="${H-7}" text-anchor="middle" font-size="9" fill="#8a8f80">${esc(it.lab)}</text>`:"";
    return bar+lab;}).join("");
  let line="";
  if(opts.cum){const cm=Math.max(1,...opts.cum);
    const pts=opts.cum.map((c,i)=>[(pl+i*bw+bw/2).toFixed(1),(pt+(H-pt-pb)*(1-c/cm)).toFixed(1)]);
    line=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="#a8802f" stroke-width="2"/>`+
      pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="#a8802f"/>`).join("")+
      `<text x="${W-pr+4}" y="${pt+8}" font-size="9" fill="#a8802f">${fmt(cm)}</text>`;}
  return `<svg viewBox="0 0 ${W} ${H}"><defs><linearGradient id="rpB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b9a70"/><stop offset="1" stop-color="#0f5a41"/></linearGradient></defs>${g}${bars}${line}</svg>`;
}
function attLineSVG(rows){ // rows [{lab,att}]
  const W=560,H=150,pl=30,pr=10,pt=12,pb=22,n=rows.length;
  if(n<2)return "";
  const x=i=>pl+(W-pl-pr)*i/(n-1),y=v=>pt+(H-pt-pb)*(1-v/100);
  let g="";[0,50,75,100].forEach(v=>{g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(29,42,34,${v===75?.22:.08})" ${v===75?'stroke-dasharray="4 4"':""}/><text x="${pl-4}" y="${y(v)+3}" text-anchor="end" font-size="9" fill="#8a8f80">${v}</text>`;});
  const pts=rows.map((r,i)=>[x(i).toFixed(1),y(r.att).toFixed(1)]);
  const every=Math.ceil(n/12);
  return `<svg viewBox="0 0 ${W} ${H}">${g}
    <polygon points="${pl},${H-pb} ${pts.map(p=>p.join(",")).join(" ")} ${W-pr},${H-pb}" fill="rgba(31,138,98,.12)"/>
    <polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" stroke="#1f8a62" stroke-width="2.2"/>
    ${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#0f5a41"><title>${esc(rows[i].lab)}: ${Math.round(rows[i].att)}%</title></circle>`+(i%every===0?`<text x="${p[0]}" y="${H-7}" text-anchor="middle" font-size="9" fill="#8a8f80">${esc(rows[i].lab)}</text>`:"")).join("")}</svg>`;
}
function calendarHTML(st){ // month heat calendar
  const k=st.keys[0];if(!k)return "";
  const[y,m]=k.split("-").map(Number),first=(new Date(y,m-1,1).getDay()+6)%7,max=Math.max(1,...st.daily.map(d=>d.ln));
  let cells="";for(let i=0;i<first;i++)cells+=`<i style="border:0;background:none"></i>`;
  st.daily.forEach(d=>{
    let bg="rgba(29,42,34,.05)",bd="rgba(29,42,34,.1)";
    if(!d.cls&&d.p==null&&!d.ln){bg="repeating-linear-gradient(45deg,rgba(29,42,34,.05) 0 3px,transparent 3px 6px)";}
    else if(d.p===0){bg="rgba(180,85,47,.22)";bd="rgba(180,85,47,.4)";}
    else if(d.p===1||d.ln>0){const f=d.ln/max;bg=f>.85?"linear-gradient(135deg,#2b9a70,#c79a43)":`rgba(31,138,98,${(.18+f*.6).toFixed(2)})`;}
    cells+=`<i style="background:${bg};border-color:${bd}" title="${d.d}: ${d.p===0?"absent":d.ln+" lines"}"><b>${d.d}</b></i>`;
  });
  return `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;font-size:9px;color:#8a8f80;text-align:center;margin-bottom:4px">${["M","T","W","T","F","S","S"].map(x=>`<span>${x}</span>`).join("")}</div>
  <div class="rp-cal" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cells}</div>`;
}
function shelfHTML(mem,st,passed){
  let h="";
  for(let j=1;j<=30;j++){
    const f=mem.frac[j],full=f>=.995,has=f>0,rev=st&&st.juzRev.get(j),neg=mem.neglected&&mem.neglected.includes(j);
    h+=`<div class="rp-juz${full?" full":""}${has?" has":""}${rev?" rev":""}${neg?" neg":""}" title="Juz ${j}: ${Math.round(f*100)}% memorised${rev?` · revised ${rev} day${rev>1?"s":""}`:""}">
      ${passed.has(j)?'<span class="st">★</span>':""}<i style="height:${(f*100).toFixed(0)}%"></i><b>${j}</b></div>`;
  }
  return `<div class="rp-shelf">${h}</div>
  <div class="rp-legend"><span><i style="background:linear-gradient(180deg,#d8b76c,#0f5a41)"></i>Complete</span>
   <span><i style="background:linear-gradient(180deg,#2b9a70,#0f5a41)"></i>Partly memorised (fill = share)</span>
   <span><i style="background:#e9c979;border-radius:50%"></i>Revised in period</span>
   <span>★ Juz submission passed</span><span><i style="border:1.5px dashed #b4552f;background:none"></i>Not revised</span></div>`;
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
      <button class="btn gold ix-btn" id="rpPrint">⎙ Print / Save PDF</button>
      <button class="btn ghost ix-btn" id="rpCopy">Copy WhatsApp summary</button>
    </div></div>`;
}

function buildReport(){
  const P={type:RP.type,key:RP.key},detailed=RP.fmt==="detailed",cfg=S.config,lpp=cfg.lpp||15;
  const name=esc(cfg.student||"Student");
  const st=periodStats(P),pv=prevPeriod(P),prev=pv?periodStats(pv):null;
  const endKey=endKeyFor(P),cum=cumulativeTo(endKey),mem=memorised(endKey);
  const A=analyse(st,prev,mem),rank=rankFor(P),V=verdict(st.score);
  const passedAll=new Set();monthKeys().filter(k=>!endKey||k<=endKey).forEach(k=>{const days=(S.months[k]&&S.months[k].days)||{};
    Object.values(days).forEach(r=>{if(r&&r.ev&&r.ev.type==="juz"&&r.ev.result==="pass")passedAll.add(r.ev.juz);});});
  const cyc=manzilCycle(mem),plan=weekPlan(mem,cyc,P);
  const gen=new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});

  const head=`<div class="rp-head">
    <div class="rp-crest"><img src="/og-image.jpg" alt="ManzilulQuran"></div>
    <div><div class="rp-acad">${esc(cfg.academy||"ManzilulQuran E-learning Academy")}</div>
      <div class="rp-title">Hifz Progress Report<span class="ar">تقرير الحفظ</span></div></div>
    <div class="rp-meta"><div class="rp-student">${name}</div>
      <span class="rp-pill">${esc(periodLabel(P))}</span>
      ${rank?`<span class="rp-pill gold">Rank ${rank.rank} of ${rank.of} in the academy</span>`:""}
      <span class="rp-small">Generated ${gen} · ${detailed?"Complete":"Minimal"} report</span></div></div>`;

  if(!st.keys.length||(!st.eligible&&!st.log.length)){
    return head+`<div class="rp-empty">No daily records for ${esc(periodLabel(P))} yet.<br>Choose another period or add entries in the Daily Log.</div>`+foot();
  }

  const delta=(a,b,unit)=>{if(b==null)return"";const d=a-b;if(Math.abs(d)<0.5)return`<div class="d rp-muted">same as before</div>`;
    return`<div class="d ${d>0?"rp-up":"rp-down"}">${d>0?"▲":"▼"} ${fmt(Math.abs(Math.round(d)))}${unit} vs previous</div>`;};
  const hasPrev=prev&&prev.eligible;
  const summary=`${name} memorised <b>${fmt(st.lines)} lines</b> (${st.pages.toFixed(1)} pages) in ${esc(periodLabel(P).replace(/^All time · /,"all tracked months, "))}, attending <b>${st.present} of ${st.classDays}</b> class days.`
    +` Total memorised so far: <b>${(cum/lpp).toFixed(1)} pages</b> ≈ <b>${(cum/cfg.total*30).toFixed(1)} juz</b>${mem.full?`, with ${mem.full} juz fully covered`:""}.`;

  const verdictBand=`<div class="rp-verdict"><div class="rp-gauge">${gaugeSVG(st.score)}</div>
    <div><div class="rp-grade" style="color:${V.c}">${V.t}<span class="ar">${V.ar}</span></div>
      <div class="rp-summary">${summary}</div></div></div>`;

  const kp=[
    [fmt(st.lines),"New lines this period",delta(st.lines,hasPrev?prev.lines:null,"")],
    [pctTxt(st.att),"Attendance",delta(st.att,hasPrev?prev.att:null," pts")],
    [st.avg.toFixed(1)+"<small> lines</small>","Per present day",""],
    [(cum/cfg.total*100).toFixed(1)+"<small>%</small>","Of the whole Qur'an",""]
  ];
  if(detailed)kp.push(
    [(cum/lpp).toFixed(1),"Pages memorised in total",""],
    [pctTxt(st.dims.revision),"Days with revision",""],
    [st.examAvg!=null?st.examAvg.toFixed(0)+"%":"—","Exam average",""],
    [String(currentStreak()),"Current streak (days)",""]);
  const kpis=`<div class="rp-sec"><h4>At a glance</h4><div class="rp-kpis">${kp.map(k=>`<div class="rp-kpi"><div class="v">${k[0]}</div><div class="l">${k[1]}</div>${k[2]}</div>`).join("")}</div></div>`;

  // charts
  let linesChart,attChart="";
  if(P.type==="month"){
    linesChart=barsSVG(st.daily.map(d=>({lab:String(d.d),v:d.ln,off:!d.cls,absent:d.p===0})),{h:160});
    attChart=calendarHTML(st);
  }else{
    let c=cumulativeTo(prevMonthKey(st.keys[0]));
    const rows=st.keys.map(k=>{const m=periodStats({type:"month",key:k});c+=m.lines;return{lab:monthShort(k),v:m.lines,cum:c,att:m.att};});
    linesChart=barsSVG(rows.map(r=>({lab:r.lab,v:r.v})),{cum:rows.map(r=>r.cum),h:170});
    attChart=rows.length>1?attLineSVG(rows):`<div class="rp-small">Attendance: ${pctTxt(rows[0]?rows[0].att:0)}</div>`;
  }
  const charts=`<div class="rp-sec"><h4>Progress graphics</h4><div class="rp-charts${detailed?" two":""}">
    <div class="rp-chart"><div class="ct">${P.type==="month"?"Lines memorised each day (red = absent, grey = holiday)":"Lines per month · gold line = total memorised"}</div>${linesChart}</div>
    ${detailed?`<div class="rp-chart"><div class="ct">${P.type==="month"?"Attendance calendar (darker = more lines)":"Attendance % per month · dashed = 75% goal"}</div>${attChart}</div>`:""}
    ${detailed?`<div class="rp-chart"><div class="ct">Skill balance (0–100)</div>${radarSVG(st.dims)}</div>
      <div class="rp-chart"><div class="ct">How the score is made</div><table class="rp-tbl"><tbody>${Object.keys(WEIGHTS).map(k=>`<tr><td>${DIM_LABEL[k]}</td><td style="text-align:right">${st.dims[k]==null?"—":Math.round(st.dims[k])}</td><td class="rp-small" style="text-align:right">${WEIGHTS[k]}%</td></tr>`).join("")}</tbody></table>
      <div class="rp-small" style="margin-top:6px">Pace: ${lpp} lines per present day = 100. Accuracy uses exam %, or juz-test pass rate if no exams.</div></div>`:""}
  </div></div>`;

  const shelf=`<div class="rp-sec"><h4>30 Juz map <span class="ar">خريطة الأجزاء</span></h4>${shelfHTML(mem,st,passedAll)}
    ${detailed?`<div class="rp-small" style="margin-top:6px">Fill is estimated from memorised ayahs within each juz (≈). Memorised = every portion ever given as a New Lesson.</div>`:""}</div>`;

  const good=detailed?A.good:A.good.slice(0,2),imp=detailed?A.imp:A.imp.slice(0,2);
  const li=l=>l.map(x=>`<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join("");
  const insights=`<div class="rp-sec"><h4>Strengths &amp; areas to improve</h4><div class="rp-two">
    <div><div class="rp-tipgroup">Strengths</div><ul class="rp-list">${good.length?li(good):`<li><span>Keep building — strengths will show as more days are recorded.</span></li>`}</ul></div>
    <div><div class="rp-tipgroup">Areas to improve</div><ul class="rp-list imp">${imp.length?li(imp):`<li><b>No weak area found</b><span>Maintain the same routine, in shā’ Allāh.</span></li>`}</ul></div></div></div>`;

  // tips
  const order=["neglect","attendance","revision","pace","accuracy","consistency"].filter(k=>A.needs.has(k));
  let tipsHTML;
  if(detailed){
    const groups=order.map(k=>[k,TIPS[k]]).concat([["general",TIPS.general]]);
    const gl={neglect:"Unrevised juz",attendance:"Regularity",revision:"Revision",pace:"Memorisation pace",accuracy:"Accuracy",consistency:"Consistency",general:"For every student"};
    tipsHTML=groups.map(([k,t])=>`<div class="rp-tipgroup">${gl[k]}</div><ol class="rp-tips">${t.map(x=>`<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join("")}</ol>`).join("");
  }else{
    const pick=[];order.forEach(k=>TIPS[k].forEach(t=>pick.push(t)));TIPS.general.forEach(t=>pick.push(t));
    tipsHTML=`<ol class="rp-tips">${pick.slice(0,4).map(x=>`<li><b>${esc(x[0])}</b><span>${esc(x[1])}</span></li>`).join("")}</ol>`;
  }
  const tips=`<div class="rp-sec"><h4>How to improve memory</h4>${tipsHTML}</div>`;

  // revision method + week plan
  const cycTxt=!cyc.days.length?"":mem.M<=1?"The memorised portion is small — revise all of it every class day."
    :`Revise about <b>${(cyc.D).toFixed(0)} pages a day</b> (≈ ${(cyc.D/mem.ppj).toFixed(1)} juz), completing the whole memorised portion every <b>${cyc.days.length} class day${cyc.days.length>1?"s":""}</b>.`;
  const planRows=plan.rows.map(r=>{
    if(r.off)return`<tr class="off"><td class="rp-first" data-l="Day">${dLabel(r.ds)}</td><td data-l="New lesson" colspan="3">Holiday — listen to this week’s lessons; light recitation only</td><td data-l="Done"><span class="tick"></span></td></tr>`;
    const man=r.day?`${juzBadges(r.day)}${compactSeg(r.day,true)} <span class="rp-small">(≈${pagesOf(r.day).toFixed(1)} p)</span>`:"—";
    return`<tr><td class="rp-first nw" data-l="Day">${dLabel(r.ds)}${r.cycleNo&&cyc.days.length>1?`<div class="rp-small">Cycle day ${r.cycleNo}</div>`:""}</td>
      <td data-l="New lesson">≈ ${plan.target} lines<div class="rp-small">${plan.cont}</div></td>
      <td data-l="Sabqi">${plan.sabqiTxt}</td><td data-l="Juz reading">${man}</td><td data-l="Done"><span class="tick"></span></td></tr>`;}).join("");
  const planSec=`<div class="rp-sec"><h4>Daily juz reading plan <span class="ar">الورد اليومي</span></h4>
    <p class="rp-muted" style="margin:0 0 8px">${cycTxt||"Once new lessons are recorded, a revision cycle will appear here."} Sabqi = revise the last 7 lessons daily. Tick each row when done.</p>
    <table class="rp-tbl rp-stack"><thead><tr><th>Day</th><th>New lesson (Sabaq)</th><th>Sabqi (recent)</th><th>Juz reading (Manzil)</th><th>Done</th></tr></thead><tbody>${planRows}</tbody></table></div>`;

  const cycleSec=detailed&&cyc.days.length>1?`<div class="rp-sec"><h4>Full revision cycle</h4>
    <p class="rp-muted" style="margin:0 0 8px">Revision order follows the order the juz were memorised. When the cycle ends, start again from day 1.</p>
    <table class="rp-tbl rp-stack"><thead><tr><th>Cycle day</th><th>Juz</th><th>Portion to revise</th><th>≈ Pages</th></tr></thead><tbody>
    ${cyc.days.slice(0,40).map((d,i)=>`<tr><td class="rp-first" data-l="Day">Day ${i+1}</td><td data-l="Juz">${juzBadges(d)}</td><td data-l="Portion">${compactSeg(d,true)}</td><td data-l="Pages">${pagesOf(d).toFixed(1)}</td></tr>`).join("")}
    </tbody></table>${cyc.days.length>40?`<div class="rp-small">+${cyc.days.length-40} more days</div>`:""}</div>`:"";

  // juz-wise revision table (detailed)
  const juzTbl=detailed&&mem.juzOrder.length?`<div class="rp-sec"><h4>Juz-wise status</h4>
    <table class="rp-tbl rp-stack"><thead><tr><th>Juz</th><th>Memorised</th><th>Revised days (period)</th><th>Juz test</th></tr></thead><tbody>
    ${mem.juzOrder.map(j=>`<tr><td class="rp-first" data-l="Juz">Juz ${j}</td><td data-l="Memorised">${Math.round(mem.frac[j]*100)}%</td><td data-l="Revised">${st.juzRev.get(j)||`<span class="rp-no">0</span>`}</td><td data-l="Juz test">${passedAll.has(j)?`<span class="rp-ok">★ Passed</span>`:"—"}</td></tr>`).join("")}
    </tbody></table></div>`:"";

  // exams + juz tests + tasks (detailed)
  let examSec="";
  if(detailed&&(st.exams.length||st.juzTests.length)){
    examSec=`<div class="rp-sec"><h4>Exams &amp; juz submissions</h4><table class="rp-tbl rp-stack"><thead><tr><th>Date</th><th>Type</th><th>Portion</th><th>Result</th><th>Mistakes</th><th>Examiner</th></tr></thead><tbody>
    ${st.exams.map(e=>{const pct=e.max?e.obt/e.max:0,[g]=gradeOf(pct);
      const por=e.range?(e.range.from===e.range.to?esc(SURAHS[e.range.from][0]):esc(SURAHS[e.range.from][0])+" → "+esc(SURAHS[e.range.to][0])):e.portion?esc(portionText(e.portion)):"—";
      return`<tr><td class="rp-first" data-l="Date">${e.date?dLabel(e.date):"—"}</td><td data-l="Type">Exam</td><td data-l="Portion">${por}</td><td data-l="Result"><b>${(pct*100).toFixed(0)}%</b> (${esc(g)}) · ${e.obt}/${e.max}</td><td data-l="Mistakes">${e.mist??0}</td><td data-l="Examiner">${esc(e.examiner||"—")}</td></tr>`;}).join("")}
    ${st.juzTests.map(t=>`<tr><td class="rp-first" data-l="Date">${dLabel(t.ds)}</td><td data-l="Type">Juz submission</td><td data-l="Portion">Juz ${t.juz}</td><td data-l="Result">${t.result==="pass"?`<span class="rp-ok">✓ Completed</span>`:`<span class="rp-no">↻ Try again</span>`}</td><td data-l="Mistakes"></td><td data-l="Examiner">${esc(t.examiner||"—")}</td></tr>`).join("")}
    </tbody></table></div>`;
  }
  const taskSec=detailed&&S.tasks.length?`<div class="rp-sec"><h4>Memorisation tasks</h4><table class="rp-tbl rp-stack"><thead><tr><th>Task</th><th>Portion</th><th>Progress</th><th>Due</th></tr></thead><tbody>
    ${S.tasks.map(t=>{const pc=t.target?Math.min(100,t.done/t.target*100):0;return`<tr><td class="rp-first" data-l="Task">${esc(t.name)}</td><td data-l="Portion">${t.portion?esc(portionText(t.portion)):"—"}</td><td data-l="Progress">${t.done}/${t.target} (${pc.toFixed(0)}%)</td><td data-l="Due">${esc(t.due||"—")}</td></tr>`;}).join("")}
    </tbody></table></div>`:"";

  // log
  const pt=l=>l.length?l.map(p=>esc(portionText(p))).join(", "):"—";
  const logRows=(detailed?st.log:st.log.slice(-7));
  const logSec=`<div class="rp-sec"><h4>${detailed?"Daily log":"Recent log (last 7 entries)"}</h4>
    <table class="rp-tbl rp-stack"><thead><tr><th>Date</th><th>✓</th><th>New lesson</th><th>Lines</th><th>Sabq</th><th>Old lesson</th></tr></thead><tbody>
    ${logRows.map(r=>`<tr class="${r.off?"off":""}"><td class="rp-first" data-l="Date">${dLabel(r.ds)}${r.off?' <span class="rp-small">(holiday)</span>':""}</td>
      <td data-l="Present">${r.p===1?'<span class="rp-ok">✓</span>':r.p===0?'<span class="rp-no">✗ Absent</span>':"·"}</td>
      ${r.ev?`<td data-l="Event" colspan="4" class="rp-ev">${r.ev.type==="juz"?`Juz ${r.ev.juz} submission — ${r.ev.result==="pass"?"completed":"try again"}`:"Exam day"}${r.ln?` · ${r.ln} lines`:""}</td>`
      :`<td data-l="New lesson">${pt(r.nl)}</td><td data-l="Lines">${r.ln||"—"}</td><td data-l="Sabq">${pt(r.sq)}</td><td data-l="Old lesson">${pt(r.ol)}</td>`}</tr>`).join("")}
    </tbody></table>${!logRows.length?'<div class="rp-small">No entries.</div>':""}</div>`;

  const sign=`<div class="rp-sec"><h4>Teacher’s remarks</h4><div class="rp-remarks">&nbsp;</div>
    <div class="rp-sign"><div>Teacher</div><div>Parent</div><div>Date</div></div></div>`;

  const body=head+verdictBand+kpis+shelf+charts+insights+planSec+(detailed?cycleSec+juzTbl+examSec+taskSec:"")+tips+logSec+sign+foot();
  // one wrapper per labelled cell so stacked phone rows keep label | content on one line
  return body.replace(/(<td[^>]*data-l="[^"]*"[^>]*>)([\s\S]*?)(<\/td>)/g,(m,o,inner,c)=>o+"<div>"+inner+"</div>"+c);
  function foot(){return`<div class="rp-foot"><span>ManzilulQuran E-learning Academy · manzilulquran.in</span><span>info@manzilulquran.in</span></div>`;}
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

window.renderProgress=function(){
  const root=$("#progressArea");if(!root)return;
  if(!monthKeys().length){root.innerHTML=renderControls()+`<div class="rp-doc"><div class="rp-empty">Add a month in the Daily Log to generate a report.</div></div>`;bindControls();return;}
  const ctl=renderControls();                    // normalises RP.key first
  root.innerHTML=ctl+`<article class="rp-doc" id="rpDoc">${buildReport()}</article>`;
  bindControls();
};
function bindControls(){
  $$("#progressArea [data-rpt]").forEach(b=>b.onclick=()=>{RP.type=b.dataset.rpt;RP.key=null;renderProgress();});
  $$("#progressArea [data-rpf]").forEach(b=>b.onclick=()=>{RP.fmt=b.dataset.rpf;renderProgress();});
  const k=$("#rpKey");if(k)k.onchange=()=>{RP.key=k.value;renderProgress();};
  const pr=$("#rpPrint");if(pr)pr.onclick=()=>{
    const t=document.title;document.title=`Hifz Report - ${S.config.student} - ${periodLabel({type:RP.type,key:RP.key})}`;
    window.print();setTimeout(()=>{document.title=t;},800);};
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
