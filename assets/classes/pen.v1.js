/* =================================================================
   ManzilulQuran — PEN & WHITEBOARD  v1
   -----------------------------------------------------------------
   A drawing layer over the whole class sheet, for use while the screen
   is being shared. Works on every tab, over study material opened in
   the reader, and on the Whiteboard tab.

   DELIBERATELY NOT DONE
     - Nothing is saved. Drawings live in memory and vanish on reload.
     - Nothing is shared. There is no sync; the other side sees the
       drawing because the screen is being shared, not through us.

   HOW DRAWINGS BEHAVE
     Drawings sit on the SCREEN, not on the document, like any screen
     annotation tool. Scrolling the page does not move them. Each tab —
     and each book opened in the reader — keeps its own drawing, so the
     board's sketch never floats over the calendar.

   THE ONE RULE THIS FILE MUST NEVER BREAK
     When the pen is off, the drawing layer takes no pointer events. An
     invisible full-screen layer that swallows taps is exactly the bug
     that once killed every Join button on this page. The layer is
     pointer-events:none unless the pen is on, and that is checked in
     one place: setPenOn().

   Self-contained: its styles are injected below, so adding it to a
   page is one <script> tag and nothing else.
   ================================================================= */
(function(){
  'use strict';

  /* ---------------- Styles ---------------- */
  const css = `
  .mqpen-canvas{
    position:fixed;inset:0;width:100vw;height:100vh;
    z-index:90;pointer-events:none;touch-action:auto;
  }
  .mqpen-canvas.on{ pointer-events:auto; touch-action:none; cursor:crosshair; }
  .mqpen-canvas.hidden-ink{ visibility:hidden; }

  .mqpen-fab{
    position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));
    z-index:96;width:52px;height:52px;border-radius:17px;border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    color:#02120c;background:linear-gradient(135deg,#34d399,#10b981 55%,#059669);
    box-shadow:0 10px 30px -10px rgba(16,185,129,.7), inset 0 1px 0 rgba(255,255,255,.35);
    transition:transform .18s cubic-bezier(.32,.72,0,1), opacity .18s ease;
    -webkit-tap-highlight-color:transparent;
  }
  .mqpen-fab svg{width:23px;height:23px}
  .mqpen-fab:active{transform:scale(.94)}
  .mqpen-fab.on{ opacity:0; pointer-events:none; transform:scale(.8); }

  .mqpen-bar{
    position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));
    z-index:96;display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:center;
    max-width:calc(100vw - 20px);
    padding:8px 10px;border-radius:20px;
    background:rgba(8,20,17,.86);
    -webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);
    border:1px solid rgba(120,190,165,.22);
    box-shadow:0 18px 50px -14px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.08);
    transform:translate(-50%,16px);opacity:0;pointer-events:none;
    transition:transform .3s cubic-bezier(.32,.72,0,1), opacity .22s ease;
  }
  .mqpen-bar.show{ transform:translate(-50%,0);opacity:1;pointer-events:auto; }

  .mqpen-btn{
    width:38px;height:38px;border-radius:12px;border:1px solid transparent;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    color:rgba(238,245,241,.78);background:rgba(255,255,255,.05);
    transition:transform .12s ease, background .15s ease, color .15s ease;
    -webkit-tap-highlight-color:transparent;
  }
  .mqpen-btn svg{width:19px;height:19px}
  .mqpen-btn:active{transform:scale(.92)}
  .mqpen-btn.active{ color:#02120c;background:#34d399; }
  .mqpen-btn.close{ color:#ffb4b4; }
  .mqpen-sep{width:1px;height:24px;background:rgba(120,190,165,.2);margin:0 2px}

  .mqpen-dot{
    width:26px;height:26px;border-radius:50%;cursor:pointer;flex:0 0 auto;
    border:2px solid rgba(255,255,255,.18);
    transition:transform .12s ease, box-shadow .15s ease;
  }
  .mqpen-dot.active{ transform:scale(1.14); box-shadow:0 0 0 2px #071210, 0 0 0 4px #34d399; }

  .mqpen-size{
    width:38px;height:38px;border-radius:12px;cursor:pointer;border:1px solid transparent;
    display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);
  }
  .mqpen-size i{display:block;border-radius:50%;background:rgba(238,245,241,.85)}
  .mqpen-size.active{ background:rgba(52,211,153,.2); border-color:rgba(52,211,153,.5); }

  /* ---------- Whiteboard surface ---------- */
  .mqboard{
    position:relative;width:100%;min-height:72vh;border-radius:18px;overflow:hidden;
    border:1px solid rgba(120,190,165,.18);
    background:#fbfaf6;
  }
  .mqboard.dark{ background:#0c1512; }
  .mqboard.grid{
    background-color:#fbfaf6;
    background-image:
      linear-gradient(rgba(16,60,48,.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16,60,48,.08) 1px, transparent 1px);
    background-size:28px 28px;
  }
  .mqboard-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
  .mqboard-bar button{
    padding:8px 14px;border-radius:11px;cursor:pointer;
    font:inherit;font-size:12.5px;font-weight:700;
    color:rgba(238,245,241,.8);background:rgba(255,255,255,.05);
    border:1px solid rgba(120,190,165,.2);
  }
  .mqboard-bar button.active{ color:#02120c;background:#34d399;border-color:transparent; }
  .mqboard-hint{
    position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font-size:14px;color:rgba(16,60,48,.35);pointer-events:none;text-align:center;padding:20px;
  }
  .mqboard.dark .mqboard-hint{ color:rgba(238,245,241,.25); }

  /* ---------- Study material reader ---------- */
  .mqreader{
    position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;
    background:#050a08;
    opacity:0;transform:translateY(10px);
    transition:opacity .25s ease, transform .32s cubic-bezier(.32,.72,0,1);
  }
  .mqreader.show{ opacity:1;transform:none; }
  .mqreader-head{
    display:flex;align-items:center;gap:10px;
    padding:calc(10px + env(safe-area-inset-top,0px)) 14px 10px;
    background:rgba(8,20,17,.95);border-bottom:1px solid rgba(120,190,165,.18);
  }
  .mqreader-title{flex:1;min-width:0;font-size:14px;font-weight:700;color:#eef5f1;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mqreader-head a, .mqreader-head button{
    padding:8px 13px;border-radius:10px;cursor:pointer;text-decoration:none;
    font:inherit;font-size:12.5px;font-weight:700;color:#eef5f1;
    background:rgba(255,255,255,.06);border:1px solid rgba(120,190,165,.22);
  }
  .mqreader iframe{flex:1;width:100%;border:0;background:#fff}

  @media (prefers-reduced-motion: reduce){
    .mqpen-fab,.mqpen-bar,.mqpen-btn,.mqpen-dot,.mqreader{ transition:none; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'mqpen-style';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------- Icons ---------------- */
  const I = {
    pen:   '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    hl:    '<path d="M9 15l-4 4h6l1-1"/><path d="M14.5 4.5l5 5L12 17l-5-5 7.5-7.5z"/>',
    erase: '<path d="M7 20h10"/><path d="M5 15l8.5-8.5a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L12 18H8l-3-3z"/>',
    undo:  '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
    clear: '<path d="M4 7h16M9 7V4.8A.8.8 0 019.8 4h4.4a.8.8 0 01.8.8V7M6.5 7l1 12.2a1.8 1.8 0 001.8 1.8h5.4a1.8 1.8 0 001.8-1.8L17.5 7"/>',
    eye:   '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const svg = (d) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* ---------------- State ---------------- */
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#111827', '#ffffff'];
  const SIZES  = [2.5, 5, 10];

  let penOn = false;
  let tool = 'pen';            // pen | hl | erase
  let color = COLORS[0];
  let size = SIZES[1];
  let inkHidden = false;

  // One drawing per context, so switching tabs swaps the drawing.
  const boards = {};           // context -> { strokes:[], undone:[] }
  let context = 'overview';
  let current = null;          // stroke being drawn

  function board(){
    if(!boards[context]) boards[context] = { strokes: [], undone: [] };
    return boards[context];
  }

  /* ---------------- Canvas ---------------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'mqpen-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function resize(){
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.width  = Math.round(window.innerWidth  * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    redraw();
  }

  /* Draws one stroke as a smooth curve through the midpoints of its
     samples. Raw line segments look like a polygon on a phone. */
  function drawStroke(st){
    const p = st.points;
    if(!p.length) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.globalAlpha = st.tool === 'hl' ? 0.32 : 1;
    ctx.lineWidth = st.size;

    if(p.length === 1){
      ctx.beginPath();
      ctx.arc(p[0].x, p[0].y, st.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = st.color;
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(p[0].x, p[0].y);
    for(let i = 1; i < p.length - 1; i++){
      const mx = (p[i].x + p[i + 1].x) / 2;
      const my = (p[i].y + p[i + 1].y) / 2;
      ctx.quadraticCurveTo(p[i].x, p[i].y, mx, my);
    }
    const last = p[p.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  }

  function redraw(){
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    const b = board();
    b.strokes.forEach(drawStroke);
    if(current) drawStroke(current);
  }

  /* Stroke-level eraser: touching a stroke removes it whole, and undo
     brings it back. Pixel erasing would leave ragged half-lines and could
     not be undone cleanly. */
  function eraseAt(x, y){
    const b = board();
    const r = 14;
    for(let i = b.strokes.length - 1; i >= 0; i--){
      const pts = b.strokes[i].points;
      for(let j = 0; j < pts.length; j++){
        const dx = pts[j].x - x, dy = pts[j].y - y;
        if(dx * dx + dy * dy < r * r){
          const gone = b.strokes.splice(i, 1)[0];
          b.undone.push({ erased: gone, at: i });
          redraw();
          return;
        }
      }
    }
  }

  /* ---------------- Pointer input ----------------
     Pointer events cover mouse, finger and stylus with one code path.
     Only the pen that started a stroke may continue it, so a resting
     palm on a tablet cannot add a second line. */
  let activePointer = null;

  canvas.addEventListener('pointerdown', (e) => {
    if(!penOn || activePointer !== null) return;
    activePointer = e.pointerId;
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    e.preventDefault();

    if(tool === 'erase'){ eraseAt(e.clientX, e.clientY); return; }

    current = {
      tool: tool,
      color: tool === 'hl' ? (color === '#ffffff' ? '#fde047' : color) : color,
      size: tool === 'hl' ? size * 3.2 : size,
      points: [{ x: e.clientX, y: e.clientY }]
    };
    board().undone = [];       // a new stroke ends the redo trail
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    if(e.pointerId !== activePointer) return;
    e.preventDefault();
    if(tool === 'erase'){ eraseAt(e.clientX, e.clientY); return; }
    if(!current) return;
    // Coalesced events give the full stylus trail, not one sample a frame.
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
    evs.forEach(ev => current.points.push({ x: ev.clientX, y: ev.clientY }));
    redraw();
  });

  function endStroke(e){
    if(e.pointerId !== activePointer) return;
    activePointer = null;
    if(current && current.points.length){ board().strokes.push(current); }
    current = null;
    redraw();
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  /* ---------------- Toolbar ---------------- */
  const fab = document.createElement('button');
  fab.className = 'mqpen-fab';
  fab.type = 'button';
  fab.title = 'Pen';
  fab.setAttribute('aria-label', 'Turn on the pen');
  fab.innerHTML = svg(I.pen);

  const bar = document.createElement('div');
  bar.className = 'mqpen-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Pen tools');

  function btn(name, icon, title){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mqpen-btn';
    b.dataset.act = name;
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg(icon);
    return b;
  }
  function sep(){ const s = document.createElement('span'); s.className = 'mqpen-sep'; return s; }

  const bPen = btn('pen', I.pen, 'Pen');
  const bHl  = btn('hl', I.hl, 'Highlighter');
  const bEr  = btn('erase', I.erase, 'Eraser');
  bar.append(bPen, bHl, bEr, sep());

  const dots = COLORS.map(c => {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'mqpen-dot';
    d.style.background = c;
    d.dataset.color = c;
    d.title = 'Colour';
    d.setAttribute('aria-label', 'Colour ' + c);
    bar.appendChild(d);
    return d;
  });
  bar.appendChild(sep());

  const sizeBtns = SIZES.map(sz => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mqpen-size';
    b.dataset.size = sz;
    b.title = 'Thickness';
    b.setAttribute('aria-label', 'Thickness ' + sz);
    const i = document.createElement('i');
    const dim = Math.max(4, Math.min(14, sz * 1.3));
    i.style.width = dim + 'px'; i.style.height = dim + 'px';
    b.appendChild(i);
    bar.appendChild(b);
    return b;
  });
  bar.appendChild(sep());

  const bUndo  = btn('undo', I.undo, 'Undo');
  const bClear = btn('clear', I.clear, 'Clear this page');
  const bEye   = btn('eye', I.eye, 'Hide drawing');
  const bOff   = btn('off', I.close, 'Turn the pen off');
  bOff.classList.add('close');
  bar.append(bUndo, bClear, bEye, bOff);

  function syncBar(){
    bPen.classList.toggle('active', tool === 'pen');
    bHl.classList.toggle('active', tool === 'hl');
    bEr.classList.toggle('active', tool === 'erase');
    dots.forEach(d => d.classList.toggle('active', d.dataset.color === color && tool !== 'erase'));
    sizeBtns.forEach(b => b.classList.toggle('active', +b.dataset.size === size));
    bEye.classList.toggle('active', inkHidden);
  }

  /* The single switch. Every route to turning the pen on or off goes
     through here, so the pointer-events rule cannot be forgotten. */
  function setPenOn(on){
    penOn = !!on;
    canvas.classList.toggle('on', penOn);
    bar.classList.toggle('show', penOn);
    fab.classList.toggle('on', penOn);
    if(penOn && inkHidden){ inkHidden = false; canvas.classList.remove('hidden-ink'); }
    if(!penOn){ activePointer = null; current = null; redraw(); }
    syncBar();
  }

  fab.addEventListener('click', () => setPenOn(true));
  bar.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if(!t) return;
    if(t.dataset.color){ color = t.dataset.color; if(tool === 'erase') tool = 'pen'; syncBar(); return; }
    if(t.dataset.size){ size = +t.dataset.size; syncBar(); return; }
    switch(t.dataset.act){
      case 'pen':   tool = 'pen'; break;
      case 'hl':    tool = 'hl'; break;
      case 'erase': tool = 'erase'; break;
      case 'undo':  undo(); break;
      case 'clear': clearBoard(); break;
      case 'eye':   inkHidden = !inkHidden; canvas.classList.toggle('hidden-ink', inkHidden); break;
      case 'off':   setPenOn(false); break;
    }
    syncBar();
  });

  function undo(){
    const b = board();
    const last = b.undone.length ? b.undone[b.undone.length - 1] : null;
    // An erase is undone by putting the stroke back where it was.
    if(last && last.erased){
      b.undone.pop();
      b.strokes.splice(Math.min(last.at, b.strokes.length), 0, last.erased);
    } else if(b.strokes.length){
      b.strokes.pop();
    }
    redraw();
  }
  function clearBoard(){
    board().strokes = [];
    board().undone = [];
    redraw();
  }

  /* Keyboard, for a teacher presenting from a laptop. */
  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if(typing) return;
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && penOn){ e.preventDefault(); undo(); return; }
    if(e.key === 'Escape' && penOn){ setPenOn(false); return; }
    if(e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey){ setPenOn(!penOn); }
  });

  /* ---------------- Context: which drawing is showing ----------------
     Follows the active tab, or the book open in the reader. Watching the
     panels rather than hooking the tab code means this file needs no
     cooperation from the page to know where it is. */
  function currentTab(){
    const t = document.querySelector('.tab.active');
    return (t && t.dataset.tab) || 'overview';
  }
  function setContext(next){
    if(next === context) return;
    if(current){ board().strokes.push(current); current = null; activePointer = null; }
    context = next;
    redraw();
  }

  let readerOpen = null;
  const tabObserver = new MutationObserver(() => {
    if(!readerOpen) setContext(currentTab());
    // The Whiteboard exists to be drawn on: opening it switches the pen on.
    if(currentTab() === 'board' && !readerOpen && !penOn){
      tool = 'pen';
      if(color === '#ffffff' && !boardDark) color = COLORS[4];
      setPenOn(true);
    }
  });

  /* ---------------- Whiteboard ---------------- */
  let boardDark = false;
  function setupBoard(){
    const panel = document.getElementById('panel-board');
    if(!panel || panel.dataset.mqready) return;
    panel.dataset.mqready = '1';
    panel.innerHTML =
      '<div class="mqboard-bar">' +
        '<button type="button" data-bg="light" class="active">White</button>' +
        '<button type="button" data-bg="grid">Grid</button>' +
        '<button type="button" data-bg="dark">Dark</button>' +
        '<button type="button" data-bg="clear">Clear board</button>' +
      '</div>' +
      '<div class="mqboard" id="mqBoard"><div class="mqboard-hint">Draw anywhere with the pen.<br>Nothing here is saved.</div></div>';

    panel.querySelector('.mqboard-bar').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if(!b) return;
      const surf = document.getElementById('mqBoard');
      if(b.dataset.bg === 'clear'){ clearBoard(); return; }
      surf.classList.remove('dark', 'grid');
      if(b.dataset.bg !== 'light') surf.classList.add(b.dataset.bg);
      boardDark = (b.dataset.bg === 'dark');
      // Pick an ink that shows on the new background.
      if(boardDark && color === '#111827') color = '#ffffff';
      if(!boardDark && color === '#ffffff') color = '#111827';
      panel.querySelectorAll('.mqboard-bar [data-bg]').forEach(x =>
        x.classList.toggle('active', x === b));
      syncBar();
    });
  }

  /* ---------------- Study material reader ----------------
     Books open inside the class sheet instead of a new browser tab, so
     the pen is still over them. They are on the same site, so an iframe
     loads them as-is: no change to any of the book pages. "Open in new
     tab" is still one tap away for anyone who wants the full page. */
  let reader = null;
  function openReader(url, title){
    if(!reader){
      reader = document.createElement('div');
      reader.className = 'mqreader';
      reader.innerHTML =
        '<div class="mqreader-head">' +
          '<div class="mqreader-title"></div>' +
          '<a target="_blank" rel="noopener" class="mqreader-ext">New tab</a>' +
          '<button type="button" class="mqreader-close">Close</button>' +
        '</div>' +
        '<iframe title="Study material"></iframe>';
      document.body.appendChild(reader);
      reader.querySelector('.mqreader-close').addEventListener('click', closeReader);
    }
    reader.querySelector('.mqreader-title').textContent = title || 'Study material';
    reader.querySelector('.mqreader-ext').href = url;
    reader.querySelector('iframe').src = url;
    reader.hidden = false;
    requestAnimationFrame(() => reader.classList.add('show'));
    readerOpen = url;
    setContext('reader:' + url.split('#')[0]);
  }
  function closeReader(){
    if(!reader) return;
    reader.classList.remove('show');
    readerOpen = null;
    setTimeout(() => {
      if(!readerOpen){ reader.hidden = true; reader.querySelector('iframe').src = 'about:blank'; }
    }, 280);
    setContext(currentTab());
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.sm-item, a.sm-open');
    if(!a) return;
    // Only books on this site; anything else keeps its normal behaviour.
    let u;
    try{ u = new URL(a.getAttribute('href'), location.href); }catch(err){ return; }
    if(u.origin !== location.origin) return;
    e.preventDefault();
    const card = a.closest('.sm-course, .sm-block, [data-key]');
    const title = (card && card.querySelector('.sm-title, h4, .sm-name'))
      ? card.querySelector('.sm-title, h4, .sm-name').textContent.trim()
      : a.textContent.trim();
    openReader(u.href, title);
  }, true);   /* CAPTURE phase, deliberately. The page's "Open the book"
                 link calls stopPropagation() so a tap does not collapse
                 its card — which also hides the click from any normal
                 listener. Capturing sees it first, without changing the
                 page's own handler. */

  /* ---------------- Boot ---------------- */
  function boot(){
    document.body.appendChild(canvas);
    document.body.appendChild(bar);
    document.body.appendChild(fab);
    resize();
    syncBar();
    setupBoard();
    context = currentTab();
    document.querySelectorAll('.tab-panel, .tab').forEach(el =>
      tabObserver.observe(el, { attributes: true, attributeFilter: ['class'] }));
  }
  window.addEventListener('resize', resize);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Small surface for the page and for testing.
  window.mqPen = { on: () => setPenOn(true), off: () => setPenOn(false),
                   isOn: () => penOn, context: () => context,
                   strokes: () => board().strokes.length, openReader: openReader, closeReader: closeReader };
})();
