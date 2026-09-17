/* =========================================================================
   ManzilulQuran · Course Explainer — engine
   assets/explainer/engine.v1.js

   One engine, many courses. A course file (e.g. hifz.v1.js) supplies only
   data: a narration script, a list of scenes, and optional media. Every
   visual is a pure function of the timeline position, so scrubbing is
   exact and swapping the virtual clock for real audio needs no rework.

   Usage:
     Explainer.mount({ root, end, script, scenes, media, lang });

   Scene types: presenter | tiles | rows | orbit | beat
                calendar  | medal | card  | phone | cta
   ====================================================================== */
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function add(parent) {
    for (var i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]);
    return parent;
  }

  /* ---------- maths ---------- */
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function smooth(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); }

  function fire(node, cls) {
    if (!node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  }

  /* =====================================================================
     SCENE BUILDERS
     Each returns { node, update(t) }. update() is optional.
     ================================================================== */
  var BUILD = {};

  /* ---- presenter: a filmed clip, or a placeholder until it exists ---- */
  BUILD.presenter = function (d) {
    var node = el('div', 'xp-scene'), media = null;
    node.dataset.type = 'presenter';
    if (d.src) {
      media = el('video', 'xp-vid');
      media.playsInline = true;
      media.setAttribute('playsinline', '');
      media.preload = 'auto';
      if (d.poster) media.poster = d.poster;
      var src = el('source');
      src.src = d.src; src.type = d.mime || 'video/mp4';
      media.appendChild(src);
      node.appendChild(media);
    } else {
      var slot = el('div', 'xp-slot');
      add(slot, el('div', 'tri'), el('div', 'lab', d.label || 'Presenter'),
          el('div', 'sub', d.hint || 'to be filmed'));
      node.appendChild(slot);
    }
    return { node: node, media: media };
  };

  /* ---- tiles: headline facts ---- */
  BUILD.tiles = function (d) {
    var node = el('div', 'xp-scene');
    if (d.eyebrow) node.appendChild(el('div', 'xp-eyebrow xp-rise xp-d1', d.eyebrow));
    var wrap = el('div', 'xp-tiles n' + (d.items.length));
    d.items.forEach(function (it, i) {
      var tile = el('div', 'xp-tile xp-shine xp-rise xp-d' + Math.min(5, i + 2));
      add(tile, el('div', 'big', it.big), el('div', 'cap', it.cap));
      wrap.appendChild(tile);
    });
    node.appendChild(wrap);
    return { node: node };
  };

  /* ---- rows: numbered areas, revealed one at a time ---- */
  BUILD.rows = function (d) {
    var node = el('div', 'xp-scene'), rows = [];
    if (d.eyebrow) node.appendChild(el('div', 'xp-eyebrow xp-rise xp-d1', d.eyebrow));
    var wrap = el('div', 'xp-rows');
    d.items.forEach(function (it, i) {
      var row = el('div', 'xp-row xp-shine');
      var lab = el('div', 'xp-rlab');
      add(lab, el('div', 't', it.t), it.s ? el('div', 's', it.s) : null);
      var bar = el('div', 'xp-bar'); bar.appendChild(el('i'));
      add(row, el('div', 'xp-num', String(i + 1)), lab, bar);
      wrap.appendChild(row); rows.push(row);
    });
    node.appendChild(wrap);
    var from = d.from || 0, step = d.step || 2.2;
    return {
      node: node,
      update: function (t) {
        rows.forEach(function (r, i) { r.classList.toggle('lit', t >= from + i * step); });
      }
    };
  };

  /* ---- orbit: the revision loop ---- */
  BUILD.orbit = function (d) {
    var node = el('div', 'xp-scene');
    if (d.eyebrow) node.appendChild(el('div', 'xp-eyebrow xp-rise xp-d1', d.eyebrow));
    var wrap = el('div', 'xp-orbit xp-rise xp-d2');
    var s = svg('svg', { viewBox: '0 0 180 180' });
    add(s,
      svg('circle', { cx: 90, cy: 90, r: 26, fill: 'none', stroke: 'rgba(47,174,127,.24)', 'stroke-width': 1 }),
      svg('circle', { cx: 90, cy: 90, r: 46, fill: 'none', stroke: 'rgba(240,217,168,.16)', 'stroke-width': 1, 'stroke-dasharray': '2 7' }),
      svg('circle', { cx: 90, cy: 90, r: 68, fill: 'none', stroke: 'rgba(240,217,168,.2)', 'stroke-width': 1, 'stroke-dasharray': '2 7' }),
      svg('circle', { cx: 90, cy: 90, r: 9, fill: 'rgba(47,174,127,.34)' }),
      svg('circle', { cx: 90, cy: 90, r: 4, fill: '#2fae7f' })
    );
    var g = svg('g', {}), dots = [], n = d.dots || 18;
    for (var i = 0; i < n; i++) {
      var c = svg('circle', { r: 3.4 });
      g.appendChild(c); dots.push(c);
    }
    s.appendChild(g); wrap.appendChild(s); node.appendChild(wrap);

    if (d.legend) {
      var lg = el('div', 'xp-legend xp-rise xp-d3');
      d.legend.forEach(function (L) {
        var sp = el('span'), b = el('b');
        b.style.background = L.color;
        add(sp, b, document.createTextNode(L.label));
        lg.appendChild(sp);
      });
      node.appendChild(lg);
    }

    var start = d.start || 0, P = d.period || 9;
    function radiusAt(a) {
      if (a < 0.18) return 24;
      if (a < 0.30) return lerp(24, 46, smooth((a - 0.18) / 0.12));
      if (a < 0.52) return 46;
      if (a < 0.64) return lerp(46, 68, smooth((a - 0.52) / 0.12));
      return 68;
    }
    function colourAt(a) {
      var k = smooth(Math.min(1, a / 0.64));
      return 'rgb(' + Math.round(lerp(47, 201, k)) + ',' +
                      Math.round(lerp(174, 169, k)) + ',' +
                      Math.round(lerp(127, 110, k)) + ')';
    }
    return {
      node: node,
      update: function (t) {
        var base = t - start;
        for (var i = 0; i < n; i++) {
          var a = ((base + i * (P / n)) % P) / P;
          if (a < 0) a += 1;
          var rad = radiusAt(a), ang = (i * 2.4) + a * Math.PI * 1.6;
          dots[i].setAttribute('cx', (90 + rad * Math.cos(ang)).toFixed(2));
          dots[i].setAttribute('cy', (90 + rad * Math.sin(ang)).toFixed(2));
          dots[i].setAttribute('fill', colourAt(a));
          var fade = a < 0.06 ? a / 0.06 : a > 0.94 ? (1 - a) / 0.06 : 1;
          dots[i].setAttribute('opacity', fade.toFixed(2));
        }
      }
    };
  };

  /* ---- beat: a single typographic moment ---- */
  BUILD.beat = function (d) {
    var node = el('div', 'xp-scene');
    var b = el('div', 'xp-beat');
    d.parts.forEach(function (p) {
      if (p.br) { b.appendChild(el('br')); return; }
      var s = el('s');
      if (p.em) { var e = el('em', null, p.w); s.appendChild(e); }
      else s.textContent = p.w;
      b.appendChild(s);
      b.appendChild(document.createTextNode(' '));
    });
    add(node, b, el('div', 'xp-rule'));
    return { node: node };
  };

  /* ---- calendar: a month filling, then the exam ---- */
  BUILD.calendar = function (d) {
    var node = el('div', 'xp-scene');
    if (d.badge) node.appendChild(el('div', 'xp-badge xp-rise xp-d1', d.badge));
    var cal = el('div', 'xp-cal'), cells = [], total = d.cells || 28;
    for (var i = 0; i < total; i++) { var c = el('span'); cal.appendChild(c); cells.push(c); }
    node.appendChild(cal);
    var from = d.from || 0, to = d.to || (from + 3.5), examAt = d.examAt || to;
    return {
      node: node,
      update: function (t) {
        var filled = Math.floor(seg(t, from, to) * (total - 1));
        cells.forEach(function (c, i) {
          c.classList.toggle('done', i < filled && i < total - 1);
          c.classList.toggle('exam', i === total - 1 && t >= examAt);
        });
      }
    };
  };

  /* ---- medal: a completion gate ---- */
  BUILD.medal = function (d) {
    var node = el('div', 'xp-scene');
    var m = el('div', 'xp-medal xp-rise xp-d1');
    var s = svg('svg', { viewBox: '0 0 140 140' });
    add(s,
      svg('circle', { cx: 70, cy: 70, r: 62, fill: 'none', stroke: 'rgba(240,217,168,.22)', 'stroke-width': 1 }),
      svg('circle', { cx: 70, cy: 70, r: 53, fill: 'none', stroke: 'rgba(240,217,168,.45)', 'stroke-width': 1, 'stroke-dasharray': '3 6', 'class': 'dash' })
    );
    var inner = el('div'); inner.style.textAlign = 'center';
    add(inner, el('div', 'ar', d.ar || ''), el('div', 'no', d.label || ''));
    add(m, s, inner);

    var stamp = el('div', 'xp-stamp');
    add(stamp, document.createTextNode('✓ '), el('span', null, d.stamp || ''));

    var pips = el('div', 'xp-pips'), pipEls = [], np = d.pips || 30;
    for (var i = 0; i < np; i++) { var p = el('i'); pips.appendChild(p); pipEls.push(p); }

    add(node, m, stamp, pips);
    var stampAt = d.stampAt || 0, nextAt = d.nextAt || (stampAt + 3);
    return {
      node: node,
      update: function (t) {
        stamp.classList.toggle('lit', t >= stampAt);
        var nx = t >= nextAt;
        pipEls.forEach(function (p, i) {
          p.classList.toggle('done', i === 0);
          p.classList.toggle('next', i === 1 && nx);
        });
      }
    };
  };

  /* ---- card: an app roster card with ring and counters ---- */
  BUILD.card = function (d) {
    var node = el('div', 'xp-scene');
    if (d.eyebrow) node.appendChild(el('div', 'xp-eyebrow xp-rise xp-d1', d.eyebrow));

    var push = el('div', 'xp-push xp-rise xp-d2');
    var card = el('div', 'xp-card xp-shine');
    add(card, el('div', 'xp-cname', d.name), el('div', 'xp-cmeta', d.meta));

    var row = el('div', 'xp-crow');
    var ringWrap = el('span', 'xp-ringwrap');
    var uid = 'xpg' + Math.random().toString(36).slice(2, 8);
    var rs = svg('svg', { width: 92, height: 92, viewBox: '0 0 140 140' });
    rs.style.display = 'block';
    var defs = svg('defs', {});
    var grad = svg('linearGradient', { id: uid, x1: 0, y1: 0, x2: 1, y2: 1 });
    add(grad, svg('stop', { offset: 0, 'stop-color': '#2fae7f' }),
              svg('stop', { offset: 1, 'stop-color': '#C9A96E' }));
    defs.appendChild(grad);
    var R = 52, CIRC = 2 * Math.PI * R;
    var ring = svg('circle', {
      cx: 70, cy: 70, r: R, fill: 'none', stroke: 'url(#' + uid + ')', 'stroke-width': 12,
      'stroke-linecap': 'round', 'stroke-dasharray': CIRC.toFixed(1),
      'stroke-dashoffset': CIRC.toFixed(1), transform: 'rotate(-90 70 70)'
    });
    var txt = svg('text', { x: 70, y: 79, 'text-anchor': 'middle', 'font-size': 26,
                            fill: '#F0D9A8', 'font-family': "Poppins, sans-serif" });
    txt.textContent = '0%';
    add(rs, defs,
      svg('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: 'rgba(255,255,255,.09)', 'stroke-width': 12 }),
      ring, txt);
    ringWrap.appendChild(rs);

    var stats = el('div', 'xp-cstats'), bEls = [];
    d.stats.forEach(function (st, i) {
      var b = el('b', null, '0');
      stats.appendChild(b);
      stats.appendChild(document.createTextNode(' ' + st.label));
      if (i < d.stats.length - 1) stats.appendChild(el('br'));
      bEls.push(b);
    });
    add(row, ringWrap, stats);
    card.appendChild(row);
    push.appendChild(card);
    node.appendChild(push);

    return {
      node: node,
      update: function (t) {
        var p = easeOut(seg(t, d.ring.from, d.ring.to));
        ring.setAttribute('stroke-dashoffset', (CIRC * (1 - p * d.ring.value / 100)).toFixed(1));
        txt.textContent = Math.round(p * d.ring.value) + '%';
        ringWrap.classList.toggle('hot', p > 0 && p < 1);
        d.stats.forEach(function (st, i) {
          var k = easeOut(seg(t, st.from, st.to));
          var v = Math.round(k * st.value);
          bEls[i].textContent = (st.suffix || '') === '%'
            ? v + '%'
            : v.toLocaleString('en-IN') + (st.suffix || '');
          bEls[i].classList.toggle('counting', k > 0 && k < 1);
        });
        row.classList.toggle('lit', t >= (d.rowAt || d.ring.from - 0.6));
      }
    };
  };

  /* ---- phone: the parent's view ---- */
  BUILD.phone = function (d) {
    var node = el('div', 'xp-scene');
    var ph = el('div', 'xp-phone xp-shine xp-rise xp-d1');
    var mini = el('div', 'pmini');
    var inner = el('div'); inner.style.flex = '1';
    var l1 = el('div', 'pl w70'); l1.style.marginBottom = '5px';
    add(inner, l1, el('div', 'pl w45'));
    add(mini, el('div', 'pring'), inner);
    add(ph, el('div', 'notch'), el('div', 'pl w70'), mini,
        el('div', 'pl'), el('div', 'pl w70'), el('div', 'pl w45'));
    add(node, ph, el('div', 'xp-chip xp-rise xp-d2', d.link));
    return { node: node };
  };

  /* ---- cta: the close ---- */
  BUILD.cta = function (d) {
    var node = el('div', 'xp-scene');
    var mark = el('div', 'xp-mark xp-rise xp-d2');
    mark.appendChild(document.createTextNode(d.mark[0]));
    mark.appendChild(el('b', null, d.mark[1]));
    var btn = el('a', 'xp-cta xp-rise xp-d4', d.cta);
    btn.href = d.href || '#';
    add(node,
      el('div', 'xp-crest xp-rise xp-d1', d.crest || '﷽'),
      mark,
      el('div', 'xp-rule'),
      d.fee ? el('div', 'xp-fee xp-rise xp-d3', d.fee) : null,
      btn,
      d.tagline ? el('div', 'xp-tag xp-rise xp-d5', d.tagline) : null
    );
    return { node: node };
  };

  /* =====================================================================
     MOUNT
     ================================================================== */
  function mount(cfg) {
    var root = cfg.root, END = cfg.end, SCRIPT = cfg.script.slice();

    var wrap = el('div', 'xp');
    var stage = el('div', 'xp-stage');
    var motes = el('div', 'xp-motes');
    stage.appendChild(motes);

    /* build scenes from data */
    var scenes = {}, mediaEls = [];
    Object.keys(cfg.scenes).forEach(function (key) {
      var d = cfg.scenes[key];
      var maker = BUILD[d.type];
      if (!maker) { if (global.console) console.warn('Explainer: unknown scene type', d.type); return; }
      var built = maker(d);
      built.node.dataset.scene = key;
      stage.appendChild(built.node);
      scenes[key] = built;
      if (built.media) mediaEls.push({ el: built.media, scene: key, start: d.start || 0 });
    });

    var streak = el('div', 'xp-streak');
    var vignette = el('div', 'xp-vignette');
    var flash = el('div', 'xp-flash');

    var poster = el('button', 'xp-poster');
    poster.type = 'button';
    poster.setAttribute('aria-label', 'Play');
    var disc = el('div', 'disc'); disc.appendChild(el('i'));
    add(poster, disc, el('div', 'txt', cfg.posterLabel || 'Watch'));

    var caps = el('div', 'xp-caps');
    var capwrap = el('div', 'xp-capwrap');
    var capline = el('div', 'xp-capline');
    var capbar = el('div', 'xp-capbar');
    var capsweep = el('div', 'xp-capsweep');
    add(capwrap, capline, capbar, capsweep);
    caps.appendChild(capwrap);
    add(stage, streak, vignette, flash, caps, poster);

    /* controls */
    var bar = el('div', 'xp-bar');
    var play = el('button', 'xp-btn gold', '▶ Play');
    play.type = 'button'; play.setAttribute('aria-label', 'Play');
    var replay = el('button', 'xp-btn', '↺');
    replay.type = 'button'; replay.setAttribute('aria-label', 'Replay');
    var track = el('div', 'xp-track');
    track.setAttribute('role', 'slider');
    track.setAttribute('aria-label', 'Timeline');
    track.tabIndex = 0;
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', '100');
    track.setAttribute('aria-valuenow', '0');
    var rail = el('div', 'xp-rail'), fill = el('div', 'xp-fill');
    rail.appendChild(fill);
    var chapters = el('div', 'xp-chapters');
    add(track, rail, chapters);
    var timeEl = el('div', 'xp-time', '0:00 / 0:00');
    var langs = el('div', 'xp-langs');
    (cfg.langs || []).forEach(function (L) {
      var p = el('button', 'xp-pill', L.label);
      p.type = 'button';
      p.setAttribute('aria-pressed', L.active ? 'true' : 'false');
      if (L.disabled) { p.disabled = true; if (L.title) p.title = L.title; }
      if (L.href) p.onclick = function () { location.href = L.href; };
      langs.appendChild(p);
    });
    add(bar, play, replay, track, timeEl, langs);
    add(wrap, stage, bar);
    root.appendChild(wrap);

    /* motes */
    for (var i = 0; i < 16; i++) {
      var m = el('i');
      m.style.left = (Math.random() * 100).toFixed(1) + '%';
      m.style.top = (55 + Math.random() * 50).toFixed(1) + '%';
      m.style.animationDuration = (7 + Math.random() * 7).toFixed(1) + 's';
      m.style.animationDelay = (-Math.random() * 12).toFixed(1) + 's';
      motes.appendChild(m);
    }

    /* captions: split each cue into words, *word* marks gold emphasis,
       and distribute the cue's duration across them by length           */
    SCRIPT.forEach(function (cue, i) {
      cue.end = (i + 1 < SCRIPT.length) ? SCRIPT[i + 1].t : END;
      var words = cue.tx.split(/\s+/).map(function (w) {
        var em = w.charAt(0) === '*' && w.charAt(w.length - 1) === '*';
        return { text: em ? w.slice(1, -1) : w, em: em };
      });
      var weights = words.map(function (w) { return w.text.length + 2; });
      var sum = weights.reduce(function (a, b) { return a + b; }, 0);
      var span = (cue.end - cue.t) * 0.86, acc = 0;
      cue.words = words.map(function (w, k) {
        var at = cue.t + (acc / sum) * span;
        acc += weights[k];
        return { text: w.text, em: w.em, at: at };
      });
      var line = el('div', 'xp-capline');
      line.style.display = 'none';
      cue.words.forEach(function (w, k) {
        var n = document.createElement('w');
        n.textContent = w.text;
        if (w.em) n.className = 'em';
        line.appendChild(n);
        if (k < cue.words.length - 1) line.appendChild(document.createTextNode(' '));
        w.el = n;
      });
      cue.lineEl = line;
      capline.appendChild(line);
    });

    /* chapter ticks, one per scene change */
    var lastSc = null;
    SCRIPT.forEach(function (c) {
      if (c.sc !== lastSc) {
        var tick = el('i');
        tick.style.left = (c.t / END * 100) + '%';
        chapters.appendChild(tick);
        lastSc = c.sc;
      }
    });

    /* extra media declared by the course file (narration audio) */
    (cfg.media || []).forEach(function (m) {
      var a = el('audio');
      a.preload = 'auto'; a.src = m.src;
      wrap.appendChild(a);
      mediaEls.push({ el: a, scenes: m.scenes, start: m.start || 0 });
    });

    /* ---------- clock ---------- */
    var vt = 0, playing = false, last = 0, activeCue = -1, activeWord = null, raf = null;
    function now() { return vt; }

    function fmt(s) {
      s = Math.max(0, Math.min(END, s));
      return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    }

    function syncMedia(t, sceneKey) {
      mediaEls.forEach(function (m) {
        var on = m.scene ? (sceneKey === m.scene)
                         : (m.scenes ? m.scenes.indexOf(sceneKey) >= 0 : false);
        if (!on) { if (!m.el.paused) m.el.pause(); return; }
        var local = Math.max(0, t - m.start);
        if (Math.abs(m.el.currentTime - local) > 0.3) {
          try { m.el.currentTime = local; } catch (e) { /* not seekable yet */ }
        }
        if (playing && m.el.paused) { var pr = m.el.play(); if (pr && pr.catch) pr.catch(function () {}); }
        if (!playing && !m.el.paused) m.el.pause();
      });
    }

    function render(t) {
      var idx = 0;
      for (var i = 0; i < SCRIPT.length; i++) if (t >= SCRIPT[i].t) idx = i;
      var cue = SCRIPT[idx];

      if (idx !== activeCue) {
        var changed = activeCue < 0 || SCRIPT[activeCue].sc !== cue.sc;
        for (var k in scenes) scenes[k].node.classList.toggle('on', k === cue.sc);
        SCRIPT.forEach(function (c) { c.lineEl.style.display = 'none'; });
        cue.lineEl.style.display = '';
        if (changed && activeCue >= 0) { fire(flash, 'hit'); fire(streak, 'go'); }
        fire(capsweep, 'go');
        activeCue = idx; activeWord = null;
      }

      var lastLit = null;
      cue.words.forEach(function (w) {
        var on = t >= w.at;
        w.el.classList.toggle('lit', on);
        if (on) lastLit = w.el;
      });
      if (lastLit && lastLit !== activeWord) {
        activeWord = lastLit;
        capbar.style.opacity = '1';
        capbar.style.width = lastLit.offsetWidth + 'px';
        capbar.style.transform = 'translate(' + lastLit.offsetLeft + 'px,' +
          (lastLit.offsetTop + lastLit.offsetHeight - 1) + 'px)';
      } else if (!lastLit) {
        capbar.style.opacity = '0';
        activeWord = null;
      }

      for (var key in scenes) if (scenes[key].update) scenes[key].update(t);
      syncMedia(t, cue.sc);

      var prog = clamp01(t / END);
      fill.style.width = (prog * 100) + '%';
      track.setAttribute('aria-valuenow', String(Math.round(prog * 100)));
      timeEl.textContent = fmt(t) + ' / ' + fmt(END);
    }

    function tick(ts) {
      var dt = (ts - last) / 1000; last = ts;
      if (dt > 0.25) dt = 0.25;                 /* never jump after a stall */
      if (playing) { vt += dt; if (vt >= END) { vt = END; setPlaying(false); } }
      render(now());
      raf = requestAnimationFrame(tick);
    }
    function startLoop() {
      if (raf) return;
      raf = requestAnimationFrame(function (ts) { last = ts; tick(ts); });
    }
    function stopLoop() {
      if (!raf) return;
      cancelAnimationFrame(raf); raf = null;
    }

    function setPlaying(on) {
      playing = on;
      play.textContent = on ? '❚❚ Pause' : '▶ Play';
      play.setAttribute('aria-label', on ? 'Pause' : 'Play');
      poster.hidden = on;
    }
    poster.onclick = function () { if (vt >= END) vt = 0; setPlaying(true); };

    play.onclick = function () { startLoop(); if (!playing && vt >= END) vt = 0; setPlaying(!playing); };
    replay.onclick = function () { startLoop(); vt = 0; activeCue = -1; setPlaying(true); };

    function seek(clientX) {
      var r = track.getBoundingClientRect();
      vt = clamp01((clientX - r.left) / r.width) * END;
      activeCue = -1;
      render(vt);
    }
    var dragging = false;
    track.addEventListener('pointerdown', function (e) {
      dragging = true; track.setPointerCapture(e.pointerId); seek(e.clientX);
    });
    track.addEventListener('pointermove', function (e) { if (dragging) seek(e.clientX); });
    track.addEventListener('pointerup', function (e) {
      dragging = false; track.releasePointerCapture(e.pointerId);
    });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { vt = Math.min(END, vt + 2); activeCue = -1; }
      if (e.key === 'ArrowLeft') { vt = Math.max(0, vt - 2); activeCue = -1; }
    });
    global.addEventListener('resize', function () { activeWord = null; });

    /* Only animate while the player is actually on screen. It sits below the
       fold, so without this the loop burns frames during the hero. */
    if ('IntersectionObserver' in global) {
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) startLoop();
          else { if (playing) setPlaying(false); stopLoop(); }
        });
      }, { threshold: 0.2 }).observe(stage);
    } else {
      startLoop();
    }
    global.addEventListener('visibilitychange', function () {
      if (document.hidden) { setPlaying(false); stopLoop(); }
    });

    render(0);
    setPlaying(false);

    return {
      play: function () { startLoop(); setPlaying(true); },
      pause: function () { setPlaying(false); },
      seek: function (t) { vt = clamp01(t / END) * END; activeCue = -1; render(vt); },
      destroy: function () { stopLoop(); root.removeChild(wrap); }
    };
  }

  global.Explainer = { mount: mount, builders: BUILD };

})(window);
