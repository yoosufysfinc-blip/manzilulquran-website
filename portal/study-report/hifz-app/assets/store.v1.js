/* =====================================================================
   ManzilulQuran · Hifz Learning App — storage (v1)
   Step 1: student accounts and progress are kept in THIS BROWSER only
   (localStorage). Every read and write goes through HifzStore, so a later
   step can move the same records to the Hifz Report's Supabase project
   without changing the screens.

   Keys
     mqhifz.students.v1            the student list (accounts)
     mqhifz.s.<id>.settings.v1     one student's learning settings
     mqhifz.s.<id>.lesson.v1       one student's open lesson
     mqhifz.s.<id>.history.v1      one student's last 10 lessons
     mqhifz.s.<id>.done.v1         ayahs this student has memorized (global ayah numbers)
     mqhifz.textcache.v1           recently loaded Quran text, shared by all students
   ===================================================================== */
const HifzStore = (function () {
  'use strict';
  const REG = 'mqhifz.students.v1';
  const CACHE = 'mqhifz.textcache.v1';
  const ls = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* storage unavailable */ } }
  };
  function available() { try { const k = 'mqhifz.__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; } catch (e) { return false; } }

  const keys = sid => ({
    settings: `mqhifz.s.${sid}.settings.v1`, lesson: `mqhifz.s.${sid}.lesson.v1`,
    history: `mqhifz.s.${sid}.history.v1`, done: `mqhifz.s.${sid}.done.v1`, cache: CACHE
  });
  const newId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  /* ---------- one student record, always in this shape ---------- */
  const txt = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
  const int = (v, lo, hi) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
  function clean(o) {
    const r = o || {};
    const su = int(r.start && r.start.surah, 1, 114) || 1;
    const maxA = SURAHS[su - 1][4];
    return {
      id: /^s[a-z0-9]{6,20}$/.test(r.id || '') ? r.id : newId(),
      name: txt(r.name, 60),
      mqId: txt(r.mqId, 20).toUpperCase(),
      age: int(r.age, 3, 99),
      guardian: txt(r.guardian, 60),
      teacher: txt(r.teacher, 60),
      batch: txt(r.batch, 60),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(r.startDate || '') ? r.startDate : today(),
      status: r.status === 'paused' ? 'paused' : 'active',
      start: { surah: su, from: Math.min(maxA, int(r.start && r.start.from, 1, 286) || 1), page: int(r.start && r.start.page, 1, 604) || 1 },
      notes: String(r.notes == null ? '' : r.notes).trim().slice(0, 600),
      created: +r.created || Date.now(),
      updated: +r.updated || Date.now()
    };
  }
  const valid = s => !!s && typeof s.id === 'string' && typeof s.name === 'string' && s.name.length > 0;

  function list() { const a = ls.get(REG); return Array.isArray(a) ? a.filter(valid).map(clean) : []; }
  function get(id) { return list().find(s => s.id === id) || null; }
  function save(rec) {
    const s = clean(rec);
    if (!s.name) return { ok: false, error: 'name' };
    const all = list();
    if (s.mqId) { const dup = all.find(x => x.id !== s.id && x.mqId === s.mqId); if (dup) return { ok: false, error: 'mqId', other: dup.name }; }
    const i = all.findIndex(x => x.id === s.id);
    s.updated = Date.now();
    if (i >= 0) { s.created = all[i].created; all[i] = s; } else all.push(s);
    return ls.set(REG, all) ? { ok: true, student: s } : { ok: false, error: 'storage' };
  }
  function remove(id) {
    const all = list().filter(x => x.id !== id);
    const ok = ls.set(REG, all);
    if (ok) { const k = keys(id); [k.settings, k.lesson, k.history, k.done].forEach(ls.del); }
    return ok;
  }

  /* ---------- per-student data ---------- */
  const settings = sid => ls.get(keys(sid).settings) || {};
  function setSettings(sid, patch) { return ls.set(keys(sid).settings, Object.assign(settings(sid), patch || {})); }
  function doneSet(sid) { const a = ls.get(keys(sid).done); return new Set(Array.isArray(a) ? a.filter(n => Number.isInteger(n) && n >= 1 && n <= 6236) : []); }
  // record memorized ayahs (global numbers); returns how many were new
  function markDone(sid, gids) {
    if (!sid || !gids || !gids.length) return 0;
    const set = doneSet(sid), before = set.size;
    gids.forEach(g => { if (Number.isInteger(g) && g >= 1 && g <= 6236) set.add(g); });
    if (set.size !== before) ls.set(keys(sid).done, Array.from(set).sort((a, b) => a - b));
    return set.size - before;
  }

  /* ---------- what the dashboard shows for one student ---------- */
  function summary(sid) {
    const k = keys(sid), lesson = ls.get(k.lesson), hist = ls.get(k.history), set = doneSet(sid), st = settings(sid);
    let last = 0;
    if (lesson && +lesson.updated) last = +lesson.updated;
    if (Array.isArray(hist)) hist.forEach(e => { if (e && +e.at > last) last = +e.at; });
    let current = null;
    if (lesson && Array.isArray(lesson.ayahs) && lesson.ayahs.length) {
      if (lesson.kind === 'page' && lesson.page >= 1 && lesson.page <= 604) {
        const u = lesson.ayahs[0] || {}, segs = QuranMeta.pageSegments(lesson.page);
        current = { kind: 'page', title: `Page ${lesson.page}`, sub: segs.map(sg => `${SURAHS[sg.s - 1][2]} ${sg.f === sg.t ? sg.f : sg.f + '–' + sg.t}`).join(' · '),
          detail: u.result === 'mastered' ? 'Memorized' : `Stage ${Math.min(6, Math.max(1, +u.stage || 1))} of 6` };
      } else if (lesson.surah >= 1 && lesson.surah <= 114) {
        const n = lesson.ayahs.length, m = lesson.ayahs.filter(a => a && a.result === 'mastered').length;
        current = { kind: 'ayah', title: SURAHS[lesson.surah - 1][2], sub: lesson.from === lesson.to ? `Ayah ${lesson.from}` : `Ayahs ${lesson.from}–${lesson.to}`,
          detail: m === n ? 'Memorized' : `${m} of ${n} memorized` };
      }
    }
    // complete pages and juz, from the memorized ayahs
    let pages = 0, juz = 0;
    if (set.size) {
      for (let p = 1; p <= 604; p++) { const [a, b] = QuranMeta.pageSpan(p); let all = true; for (let g = a; g < b && all; g++) if (!set.has(g)) all = false; if (all) pages++; }
      for (let j = 1; j <= 30; j++) { const [a, b] = QuranMeta.juzSpan(j); let all = true; for (let g = a; g < b && all; g++) if (!set.has(g)) all = false; if (all) juz++; }
    }
    return { last, current, ayahs: set.size, pages, juz, mode: st.startMode === 'page' ? 'page' : 'ayah', uiLang: st.uiLang === 'en' ? 'en' : 'ml' };
  }

  return { available, keys, newId, today, clean, list, get, save, remove, settings, setSettings, doneSet, markDone, summary };
})();
