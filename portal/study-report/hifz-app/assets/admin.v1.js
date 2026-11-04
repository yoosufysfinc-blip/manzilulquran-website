/* =====================================================================
   ManzilulQuran · Hifz Learning App — students dashboard & routing (v1)

   Screens   #dashView  the student list (admin)
             a student's learning space  (HifzLearn, learn.v1.js)
   Links     /portal/study-report/hifz-app/                    students
             /portal/study-report/hifz-app/#student=<id>       that student
             …#student=<id>&page=N  ·  …#student=<id>&lesson=S:F-T
   Step 1    accounts and progress are saved in this browser (HifzStore).
   ===================================================================== */
(function () {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const { esc, ic, relTime } = HifzLearn;
const say = (msg, icon) => HifzLearn.toast(msg, '', icon || 'check');
const plural = (n, one, many) => (n === 1 ? one : (many || one + 's'));

const D = { q: '', filter: 'all', sort: 'recent', flash: null };   // dashboard view state
const F = { mode: 'ayah', lang: 'ml', status: 'active' };          // form segmented choices
let editing = null;                                                // student in the form (null = adding)

const initials = name => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const tone = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 'c' + ((h % 4) + 1); };
function startLabel(st) {
  const set = HifzStore.settings(st.id);
  if (set.startMode === 'page') return `page ${st.start.page}`;
  const su = SURAHS[st.start.surah - 1];
  return `${su[2]} ${st.start.from}`;
}

/* ---------------------------------------------------------------------
   Routing
   --------------------------------------------------------------------- */
const hashParams = () => new URLSearchParams((location.hash || '').replace(/^#/, ''));
const baseURL = () => location.href.split('#')[0];
function go(hash) {
  try { history.pushState({ adm: 1 }, '', baseURL() + hash); } catch (e) { location.hash = hash; return; }
  route();
}
function route() {
  const p = hashParams(), sid = p.get('student');
  if (sid) {
    const st = HifzStore.get(sid);
    if (st) { openStudent(st, p); return; }
    try { history.replaceState({ adm: 1 }, '', baseURL()); } catch (e) { /* ignore */ }
    showDashboard();
    say('That student is not saved in this browser.', 'info');
    return;
  }
  showDashboard();
}
function setMode(mode) {
  document.body.dataset.mode = mode;
  $('#dashView').hidden = mode !== 'dash';
  $('#studentBar').hidden = mode !== 'student';
  $('#btnTips').hidden = mode !== 'student';
  $('#btnSettings').hidden = mode !== 'student';
  $('#btnAddTop').hidden = mode !== 'dash';
}
function showDashboard() {
  HifzLearn.unmount();
  setMode('dash');
  document.title = 'Hifz Learning App · ManzilulQuran';
  renderDashboard();
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function openStudent(st, p) {
  setMode('student');
  paintStudentBar(st);
  if (HifzLearn.studentId() === st.id) HifzLearn.route(p);   // back / forward inside the same student
  else HifzLearn.mount(st, p);
}
function paintStudentBar(st) {
  const av = $('#sbAvatar');
  av.className = 'av ' + tone(st.id); av.textContent = initials(st.name);
  $('#sbName').textContent = st.name;
  $('#sbMeta').textContent = [st.mqId, st.teacher ? 'Teacher: ' + st.teacher : '', st.status === 'paused' ? 'Paused' : ''].filter(Boolean).join(' · ') || 'Hifz student';
}

/* ---------------------------------------------------------------------
   Dashboard
   --------------------------------------------------------------------- */
function sectionsHTML() {
  return `<nav class="hz-sections" aria-label="Hifz sections">
    <a class="hz-sec" href="/portal/study-report/">${ic('chart')}<span><span class="hz-pre">Hifz </span>Report</span></a>
    <a class="hz-sec on" href="/portal/study-report/hifz-app/" aria-current="page" data-adm="dash">${ic('book')}<span><span class="hz-pre">Hifz </span>Learning App</span></a>
  </nav>`;
}
function rows() { return HifzStore.list().map(st => ({ st, sum: HifzStore.summary(st.id) })); }

function renderDashboard() {
  const all = rows(), total = all.length;
  const active = all.filter(r => r.st.status === 'active').length;
  const week = Date.now() - 7 * 864e5;
  const ayahs = all.reduce((n, r) => n + r.sum.ayahs, 0), pages = all.reduce((n, r) => n + r.sum.pages, 0);
  const recent = all.filter(r => r.sum.last >= week).length;
  const canSave = HifzStore.available();
  $('#btnAddTop').disabled = !canSave;
  $('#dashView').innerHTML = `
    ${sectionsHTML()}
    <section class="dash-head">
      <div><span class="eyebrow">Hifz Learning App</span><h1>Students</h1>
        <p class="muted">Each student has their own lessons, settings and progress. Open a student to start or continue their Hifz lesson.</p></div>
      ${total ? `<button class="btn btn-primary dash-add" type="button" data-adm="add"${canSave ? '' : ' disabled'}>${ic('user-plus')}Add student</button>` : ''}
    </section>
    ${canSave ? '' : `<div class="banner warn">${ic('info')}<div>This browser is blocking storage, so student accounts cannot be saved here. Allow site data for manzilulquran.in, or use another browser.</div></div>`}
    <div class="kpis" role="list">
      <div class="kpi" role="listitem"><p class="k">Students</p><p class="v">${active}</p><p class="s">${total === active ? (total ? 'all active' : 'none yet') : `active · ${total - active} paused`}</p></div>
      <div class="kpi" role="listitem"><p class="k">Ayahs memorized</p><p class="v">${ayahs}</p><p class="s">all students</p></div>
      <div class="kpi" role="listitem"><p class="k">Pages complete</p><p class="v">${pages}</p><p class="s">Madani mushaf</p></div>
      <div class="kpi" role="listitem"><p class="k">Active this week</p><p class="v">${recent}</p><p class="s">of ${total} ${plural(total, 'student')}</p></div>
    </div>
    <div class="step-note">${ic('lock')}<div><b>Step 1 — saved in this browser.</b> Student accounts and their progress are kept on this device for now. In the next step they will be saved to the Hifz Report’s Supabase, so they open on any device.</div></div>
    ${total ? `<div class="dash-tools">
      <label class="dsearch">${ic('search')}<span class="sr">Search students</span><input id="dashSearch" type="search" placeholder="Search name, MQ ID or teacher" autocomplete="off" value="${esc(D.q)}"></label>
      <div class="dfilters" role="group" aria-label="Show students">
        ${[['all', 'All', total], ['active', 'Active', active], ['paused', 'Paused', total - active]].map(([v, l, n]) => `<button class="chip" type="button" data-adm="filter" data-v="${v}" aria-pressed="${D.filter === v}">${l} <span class="cnt">${n}</span></button>`).join('')}
      </div>
      <label class="dsort"><span class="sr">Sort students</span><select class="select" id="dashSort">
        <option value="recent"${D.sort === 'recent' ? ' selected' : ''}>Recently active</option>
        <option value="name"${D.sort === 'name' ? ' selected' : ''}>Name A–Z</option></select></label>
    </div>
    <ul class="st-list" id="stList" aria-label="Students"></ul>` : `<section class="card empty-dash">
      <span class="ed-ic">${ic('users')}</span>
      <h2 class="h2">No students yet</h2>
      <p class="muted">Add the first student. Each one gets their own Hifz lessons — ayah by ayah or page by page — with their own progress.</p>
      <button class="btn btn-primary" type="button" data-adm="add"${canSave ? '' : ' disabled'}>${ic('user-plus')}Add the first student</button>
    </section>`}
    <footer class="footer"><p><b>ManzilulQuran.in – E-Learning Academy</b> · Hifz Learning App</p>
      <p>Quran text: Tanzil Uthmani text, loaded from the AlQuran Cloud API when a lesson opens. Page numbers follow the Madani mushaf (604 pages).</p></footer>`;
  if (total) {
    renderList(all);
    $('#dashSearch').addEventListener('input', e => { D.q = e.target.value; renderList(); });
    $('#dashSort').addEventListener('change', e => { D.sort = e.target.value; renderList(); });
  }
}

function renderList(cached) {
  const box = $('#stList'); if (!box) return;
  const q = D.q.trim().toLowerCase();
  let list = (cached || rows()).filter(r => D.filter === 'all' || r.st.status === D.filter);
  if (q) list = list.filter(r => [r.st.name, r.st.mqId, r.st.teacher, r.st.batch, r.st.guardian].some(v => String(v || '').toLowerCase().includes(q)));
  list.sort(D.sort === 'name'
    ? (a, b) => a.st.name.localeCompare(b.st.name)
    : (a, b) => (b.sum.last || 0) - (a.sum.last || 0) || b.st.created - a.st.created);
  box.innerHTML = list.length ? list.map(rowHTML).join('')
    : `<li class="st-empty">${q ? `No student matches “${esc(D.q.trim())}”.` : D.filter === 'paused' ? 'No paused students.' : 'No active students.'}</li>`;
  $$('[data-adm="filter"]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === D.filter)));
  if (D.flash) { const id = D.flash; D.flash = null; const el = box.querySelector(`.st-row[data-id="${CSS.escape(id)}"]`); if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'nearest' }); const b = el.querySelector('.st-open'); if (b) b.focus({ preventScroll: true }); } }
}

function rowHTML(r) {
  const { st, sum } = r;
  const now = sum.current
    ? `<span class="st-now"><b>${esc(sum.current.title)}</b> · ${esc(sum.current.sub)} · <span class="${sum.current.detail === 'Memorized' ? 'ok' : ''}">${esc(sum.current.detail)}</span></span>`
    : `<span class="st-now none">No lesson yet · starts at ${esc(startLabel(st))}</span>`;
  const stats = [sum.ayahs ? `${sum.ayahs} ${plural(sum.ayahs, 'ayah')} memorized` : 'Nothing memorized yet',
    sum.pages ? `${sum.pages} ${plural(sum.pages, 'page')} complete` : '',
    sum.last ? `active ${relTime(sum.last)}` : `added ${relTime(st.created)}`].filter(Boolean).join(' · ');
  return `<li class="st-row${st.status === 'paused' ? ' paused' : ''}" data-id="${esc(st.id)}">
    <button class="st-open" type="button" data-adm="open" data-id="${esc(st.id)}">
      <span class="av ${tone(st.id)}" aria-hidden="true">${esc(initials(st.name))}</span>
      <span class="st-main">
        <span class="st-name"><span class="nm">${esc(st.name)}</span>${st.mqId ? `<span class="st-id">${esc(st.mqId)}</span>` : ''}${st.status === 'paused' ? '<span class="st-badge">Paused</span>' : ''}</span>
        ${now}
        <span class="st-meta">${esc(stats)}${st.teacher ? ` · ${esc(st.teacher)}` : ''}</span>
      </span>
      ${ic('chev-r', 'st-chev')}
    </button>
    <button class="st-edit" type="button" data-adm="edit" data-id="${esc(st.id)}" title="Edit details"><span class="sr">Edit details of ${esc(st.name)}</span>${ic('pen')}</button>
  </li>`;
}

/* ---------------------------------------------------------------------
   Add / edit a student
   --------------------------------------------------------------------- */
function formHTML(st) {
  const s = st || { name: '', mqId: '', age: null, guardian: '', teacher: '', batch: '', startDate: HifzStore.today(), status: 'active', start: { surah: 1, from: 1, page: 1 }, notes: '' };
  const set = st ? HifzStore.settings(st.id) : {};
  F.mode = set.startMode === 'page' ? 'page' : 'ayah';
  F.lang = set.uiLang === 'en' ? 'en' : 'ml';
  F.status = s.status === 'paused' ? 'paused' : 'active';
  const tr = HifzLearn.TRANSLATIONS.some(t => t.id === set.translation) ? set.translation : (F.lang === 'en' ? 'en.sahih' : 'ml.abdulhameed');
  const surahOpts = SURAHS.map(r => `<option value="${r[0]}"${r[0] === s.start.surah ? ' selected' : ''}>${r[0]}. ${esc(r[2])} (${r[4]})</option>`).join('');
  const trOpts = HifzLearn.TRANSLATIONS.map(t => `<option value="${t.id}"${t.id === tr ? ' selected' : ''}>${esc(t.name + (t.short ? ' — ' + t.short : ''))}</option>`).join('');
  const seg = (key, opts, label) => `<div class="seg${key === 'mode' ? ' mode-seg' : ''}" role="radiogroup" aria-labelledby="${label}">${opts.map(([v, l]) => `<button type="button" role="radio" aria-checked="${F[key] === v}" data-fseg="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const maxA = SURAHS[s.start.surah - 1][4];
  return `
  <fieldset class="fs"><legend>${ic('users', 'ic-sm')}Student</legend>
    <div class="f-grid">
      <div class="field f-full"><label class="field-label" for="fName">Full name <span class="req">required</span></label>
        <input class="inp" id="fName" maxlength="60" required value="${esc(s.name)}" autocomplete="off" spellcheck="false"></div>
      <div class="field"><label class="field-label" for="fMq">MQ ID</label>
        <input class="inp" id="fMq" maxlength="20" placeholder="e.g. MQ4156" value="${esc(s.mqId)}" autocapitalize="characters" spellcheck="false">
        <p class="hint">The same ID as the class sheet and Academic Service.</p></div>
      <div class="field"><label class="field-label" for="fAge">Age</label>
        <input class="inp" id="fAge" type="number" inputmode="numeric" min="3" max="99" value="${s.age || ''}"></div>
      <div class="field"><label class="field-label" for="fGuardian">Parent or guardian</label>
        <input class="inp" id="fGuardian" maxlength="60" value="${esc(s.guardian)}"></div>
      <div class="field"><label class="field-label" for="fTeacher">Teacher</label>
        <input class="inp" id="fTeacher" maxlength="60" value="${esc(s.teacher)}"></div>
      <div class="field"><label class="field-label" for="fBatch">Class or batch</label>
        <input class="inp" id="fBatch" maxlength="60" value="${esc(s.batch)}" placeholder="e.g. Hifz evening batch"></div>
      <div class="field"><label class="field-label" for="fDate">Start date</label>
        <input class="inp" id="fDate" type="date" value="${esc(s.startDate)}"></div>
      <div class="field f-full"><span class="field-label" id="lblFStatus">Status</span>
        ${seg('status', [['active', 'Active'], ['paused', `${ic('pause', 'ic-sm')}Paused`]], 'lblFStatus')}
        <p class="hint">A paused student stays in the list with all their progress.</p></div>
    </div>
  </fieldset>
  <fieldset class="fs"><legend>${ic('book', 'ic-sm')}Learning</legend>
    <div class="f-grid">
      <div class="field f-full"><span class="field-label" id="lblFMode">Learn by</span>
        ${seg('mode', [['ayah', `${ic('layers')}Ayahs`], ['page', `${ic('book')}Mushaf page`]], 'lblFMode')}</div>
      <div class="field f-full" id="fStartAyah"${F.mode === 'page' ? ' hidden' : ''}><label class="field-label" for="fSurah">Start from</label>
        <div class="f-row"><select class="select" id="fSurah">${surahOpts}</select>
          <span class="f-from"><span class="f-pre" aria-hidden="true">Ayah</span><input class="inp" id="fFrom" type="number" inputmode="numeric" min="1" max="${maxA}" value="${s.start.from}" aria-label="From ayah"></span></div>
        <p class="hint">The student’s first lesson opens here.</p></div>
      <div class="field f-full" id="fStartPage"${F.mode === 'page' ? '' : ' hidden'}><label class="field-label" for="fPage">Start from page</label>
        <div class="f-row"><input class="inp f-page" id="fPage" type="number" inputmode="numeric" min="1" max="604" value="${s.start.page}"><span class="f-pageinfo" id="fPageInfo" aria-live="polite"></span></div>
        <p class="hint">Madani mushaf, 604 pages. Juzʾ ʿAmma starts on page 582.</p></div>
      <div class="field f-full"><span class="field-label" id="lblFLang">App language</span>
        ${seg('lang', [['ml', '<span lang="ml" class="keep-ml">മലയാളം</span> + English'], ['en', 'English only']], 'lblFLang')}</div>
      <div class="field f-full"><label class="field-label" for="fTr">Translation</label><select class="select" id="fTr">${trOpts}</select></div>
    </div>
  </fieldset>
  <fieldset class="fs"><legend>${ic('pen', 'ic-sm')}Notes</legend>
    <div class="field"><label class="sr" for="fNotes">Notes</label>
      <textarea class="inp" id="fNotes" rows="3" maxlength="600" placeholder="For the teacher — e.g. revision days, strong and weak areas.">${esc(s.notes)}</textarea></div>
  </fieldset>
  ${st ? `<div class="danger-zone"><div><p class="dz-t">Delete this student</p><p class="hint">Removes the account and all their lessons and progress in this browser. To keep them, choose Paused instead.</p></div>
    <button class="btn btn-sm danger" type="button" data-adm="delete">${ic('trash')}Delete</button></div>` : ''}`;
}

function openForm(st) {
  editing = st || null;
  $('#dlgStuT').textContent = st ? 'Edit student' : 'Add student';
  $('#dlgStuSub').textContent = st ? `Details and learning preferences for ${st.name}.` : 'Name and details for this student’s Hifz account.';
  $('#stuSave').textContent = st ? 'Save changes' : 'Add student';
  $('#stuMsg').textContent = '';
  $('#stuBody').innerHTML = formHTML(st);
  $('#stuBody').scrollTop = 0;
  paintPageInfo();
  $('#fSurah').addEventListener('change', () => { const mx = SURAHS[+$('#fSurah').value - 1][4], f = $('#fFrom'); f.max = mx; if (+f.value > mx) f.value = mx; });
  $('#fPage').addEventListener('input', paintPageInfo);
  HifzLearn.openDialog($('#dlgStudent'));
  setTimeout(() => { const n = $('#fName'); if (n && !(window.matchMedia && matchMedia('(pointer: coarse)').matches)) n.focus(); }, 60);
}
function closeForm() { HifzLearn.closeDialog($('#dlgStudent')); editing = null; }

function paintPageInfo() {
  const el = $('#fPageInfo'); if (!el) return;
  const p = parseInt($('#fPage').value, 10);
  if (!(p >= 1 && p <= 604)) { el.textContent = 'Enter 1–604'; return; }
  const segs = QuranMeta.pageSegments(p);
  el.textContent = `Juz ${QuranMeta.juzOf(segs[0].s, segs[0].f)} · ` + segs.map(sg => `${SURAHS[sg.s - 1][2]} ${sg.f === sg.t ? sg.f : sg.f + '–' + sg.t}`).join(' · ');
}

function setSeg(btn) {
  const key = btn.dataset.fseg, v = btn.dataset.v;
  F[key] = v;
  $$(`[data-fseg="${key}"]`).forEach(b => b.setAttribute('aria-checked', String(b === btn)));
  if (key === 'mode') { $('#fStartAyah').hidden = v === 'page'; $('#fStartPage').hidden = v !== 'page'; }
  if (key === 'lang') {   // keep the translation in step with the language, as the learner's Settings do
    const sel = $('#fTr'), cur = HifzLearn.TRANSLATIONS.find(t => t.id === sel.value);
    if (v === 'en' && cur && cur.lang === 'ml') sel.value = 'en.sahih';
    if (v === 'ml' && cur && cur.lang === 'en') sel.value = 'ml.abdulhameed';
  }
}

function fieldError(id, msg) {
  $$('#stuBody [aria-invalid]').forEach(el => el.removeAttribute('aria-invalid'));
  $('#stuMsg').textContent = msg;
  if (id) { const el = $('#' + id); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } }
}

function saveForm() {
  const val = id => $('#' + id).value;
  const name = val('fName').replace(/\s+/g, ' ').trim();
  if (name.length < 2) return fieldError('fName', 'Enter the student’s full name.');
  const ageTxt = val('fAge').trim();
  if (ageTxt && !(+ageTxt >= 3 && +ageTxt <= 99)) return fieldError('fAge', 'Age must be a number from 3 to 99.');
  const su = +val('fSurah'), maxA = SURAHS[su - 1][4], from = parseInt(val('fFrom'), 10), page = parseInt(val('fPage'), 10);
  if (F.mode === 'ayah' && !(from >= 1 && from <= maxA)) return fieldError('fFrom', `${SURAHS[su - 1][2]} has ${maxA} ayahs — choose an ayah from 1 to ${maxA}.`);
  if (F.mode === 'page' && !(page >= 1 && page <= 604)) return fieldError('fPage', 'Choose a page from 1 to 604.');
  const rec = Object.assign({}, editing || { id: HifzStore.newId(), created: Date.now() }, {
    name, mqId: val('fMq'), age: ageTxt ? +ageTxt : null, guardian: val('fGuardian'), teacher: val('fTeacher'), batch: val('fBatch'),
    startDate: val('fDate'), status: F.status,
    start: { surah: su, from: from >= 1 && from <= maxA ? from : 1, page: page >= 1 && page <= 604 ? page : 1 },
    notes: val('fNotes')
  });
  const res = HifzStore.save(rec);
  if (!res.ok) {
    if (res.error === 'mqId') return fieldError('fMq', `This MQ ID is already used by ${res.other}.`);
    if (res.error === 'storage') return fieldError(null, 'Could not save — this browser is blocking storage or it is full.');
    return fieldError('fName', 'Enter the student’s full name.');
  }
  const st = res.student, wasNew = !editing;
  HifzStore.setSettings(st.id, { startMode: F.mode, uiLang: F.lang, translation: $('#fTr').value });
  closeForm();
  if (HifzLearn.studentId() === st.id) { paintStudentBar(st); HifzLearn.refresh(st); say('Details saved.'); return; }
  if (wasNew) D.flash = st.id;
  renderDashboard();
  say(wasNew ? `${st.name} added.` : 'Details saved.');
}

async function deleteStudent() {
  const st = editing; if (!st) return;
  const ok = await HifzLearn.confirm({ title: `Delete ${st.name}?`, body: `${st.name}’s account, lessons and progress will be removed from this browser. This cannot be undone. To keep the record, choose Paused instead.`, ok: 'Delete student' });
  if (!ok) return;
  const open = HifzLearn.studentId() === st.id;
  if (open) HifzLearn.unmount();
  if (!HifzStore.remove(st.id)) { say('Could not delete — storage is blocked.', 'info'); return; }
  closeForm();
  if (open) go(''); else renderDashboard();
  say(`${st.name} deleted.`);
}

/* ---------------------------------------------------------------------
   Events
   --------------------------------------------------------------------- */
const ACT = {
  dash: () => { if (document.body.dataset.mode === 'dash' && !location.hash) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } go(''); },
  add: () => openForm(null),
  open: el => go('#student=' + encodeURIComponent(el.dataset.id)),
  edit: el => { const st = HifzStore.get(el.dataset.id); if (st) openForm(st); },
  'edit-current': () => { const st = HifzStore.get(HifzLearn.studentId()); if (st) openForm(st); },
  filter: el => { D.filter = el.dataset.v; renderList(); },
  closeform: () => closeForm(),
  delete: () => deleteStudent()
};
document.addEventListener('click', e => {
  const seg = e.target.closest('[data-fseg]');
  if (seg) { setSeg(seg); return; }
  const el = e.target.closest('[data-adm]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.adm]; if (!fn) return;
  if (el.tagName === 'A') e.preventDefault();
  fn(el, e);
});
$('#stuForm').addEventListener('submit', e => { e.preventDefault(); saveForm(); });
$('#dlgStudent').addEventListener('close', () => { editing = null; });
window.addEventListener('popstate', route);

/* ---------------------------------------------------------------------
   Start
   --------------------------------------------------------------------- */
HifzLearn.boot();
route();
})();
