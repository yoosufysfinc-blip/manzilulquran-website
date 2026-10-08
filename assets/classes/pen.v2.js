/* =================================================================
   ManzilulQuran — PEN & WHITEBOARD  v2
   -----------------------------------------------------------------
   Drawing for screen-shared lessons, in exactly two places:

     1. The WHITEBOARD — its own infinite surface, panned and zoomed.
     2. STUDY MATERIAL opened in the reader — annotation over the book.

   Nowhere else. Overview, calendar, Hifz and notices have no pen: a
   stray stroke over a schedule helps nobody, and a drawing layer that
   is not needed is one more thing that could catch a tap.

   Nothing is saved, nothing is shared. The other side sees the drawing
   because the screen is being shared, not through this file.

   THE ONE RULE THIS FILE MUST NEVER BREAK
     When the pen is off, the drawing layer takes no pointer events. An
     invisible full-screen layer that swallows taps is exactly the bug
     that once killed every Join button on this page. setPenOn() is the
     only place that switches it.

   WHY v2 EXISTS
     v1 sized the drawing layer with CSS height:100vh but sized its
     pixels from window.innerHeight. On a phone those differ — 100vh is
     the height with the address bar hidden — so the layer was stretched
     taller than its own drawing surface and every stroke landed below
     the finger, worst at the bottom of the screen. v2 sets both from the
     same measurement, and re-measures whenever the visible area changes.
   ================================================================= */
(function(){
  'use strict';

  /* ---------------- Styles ---------------- */
  const css = `
  .mqp-canvas{
    position:fixed;left:0;top:0;
    z-index:90;pointer-events:none;touch-action:auto;display:none;
  }
  .mqp-canvas.live{ display:block; }
  .mqp-canvas.on{ pointer-events:auto; touch-action:none; cursor:crosshair; }
  .mqp-canvas.on.hand{ cursor:grab; }

  /* The pen button, shown only where drawing is allowed and only while
     the pen is off. */
  .mqp-fab{
    position:fixed;right:14px;bottom:calc(14px + env(safe-area-inset-bottom,0px));
    z-index:96;width:46px;height:46px;border-radius:15px;border:none;cursor:pointer;
    display:none;align-items:center;justify-content:center;
    color:#02120c;background:linear-gradient(135deg,#34d399,#10b981 55%,#059669);
    box-shadow:0 10px 26px -10px rgba(16,185,129,.75), inset 0 1px 0 rgba(255,255,255,.35);
    -webkit-tap-highlight-color:transparent;
    transition:transform .16s cubic-bezier(.32,.72,0,1);
  }
  .mqp-fab.show{ display:flex; }
  .mqp-fab svg{ width:21px;height:21px; }
  .mqp-fab:active{ transform:scale(.92); }

  /* ---------- The dock: one toolbar, movable, collapsible ---------- */
  .mqp-dock{
    position:fixed;z-index:97;display:none;align-items:center;gap:3px;
    padding:5px;border-radius:16px;
    background:rgba(8,20,17,.9);
    -webkit-backdrop-filter:blur(18px) saturate(140%);backdrop-filter:blur(18px) saturate(140%);
    border:1px solid rgba(120,190,165,.22);
    box-shadow:0 14px 40px -12px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.07);
    touch-action:none;user-select:none;-webkit-user-select:none;
  }
  .mqp-dock.show{ display:flex; }
  .mqp-dock.mini .mqp-full{ display:none; }

  .mqp-b{
    width:32px;height:32px;border-radius:10px;border:none;cursor:pointer;flex:0 0 auto;
    display:flex;align-items:center;justify-content:center;
    color:rgba(238,245,241,.8);background:transparent;
    -webkit-tap-highlight-color:transparent;
    transition:transform .12s ease, background .15s ease, color .15s ease;
  }
  .mqp-b svg{ width:18px;height:18px; }
  .mqp-b:active{ transform:scale(.88); }
  .mqp-b.on{ color:#02120c;background:#34d399; }
  .mqp-b.x{ color:#ffb4b4; }
  .mqp-grip{ cursor:grab;color:rgba(238,245,241,.45); }
  .mqp-grip:active{ cursor:grabbing; }
  .mqp-swatch{
    width:20px;height:20px;border-radius:50%;
    border:2px solid rgba(255,255,255,.75);box-shadow:0 0 0 1px rgba(0,0,0,.35);
  }

  /* Pop-overs open above the dock, or below it if it sits near the top. */
  .mqp-pop{
    position:fixed;z-index:98;display:none;
    padding:10px;border-radius:15px;
    background:rgba(8,20,17,.95);
    -webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
    border:1px solid rgba(120,190,165,.22);
    box-shadow:0 16px 44px -12px rgba(0,0,0,.8);
  }
  .mqp-pop.show{ display:block; }
  .mqp-row{ display:flex;gap:7px;align-items:center;flex-wrap:wrap; }
  .mqp-row + .mqp-row{ margin-top:9px;padding-top:9px;border-top:1px solid rgba(120,190,165,.14); }
  .mqp-dot{
    width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid rgba(255,255,255,.18);
    -webkit-tap-highlight-color:transparent;
  }
  .mqp-dot.on{ box-shadow:0 0 0 2px #071210, 0 0 0 4px #34d399; }
  .mqp-sz{
    width:32px;height:32px;border-radius:10px;cursor:pointer;border:1px solid transparent;
    display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.05);
  }
  .mqp-sz i{ display:block;border-radius:50%;background:rgba(238,245,241,.85); }
  .mqp-sz.on{ background:rgba(52,211,153,.2);border-color:rgba(52,211,153,.5); }
  .mqp-txt{
    height:32px;padding:0 11px;border-radius:10px;cursor:pointer;border:1px solid transparent;
    font:inherit;font-size:12px;font-weight:700;color:rgba(238,245,241,.85);
    background:rgba(255,255,255,.05);display:flex;align-items:center;gap:5px;
  }
  .mqp-txt.on{ color:#02120c;background:#34d399; }
  .mqp-txt svg{ width:16px;height:16px; }
  .mqp-pct{ min-width:50px;justify-content:center;font-variant-numeric:tabular-nums; }

  /* ---------- Whiteboard surface ---------- */
  .mqp-board{
    position:fixed;inset:0;z-index:86;display:none;background-color:#fbfaf6;
  }
  .mqp-board.show{ display:block; }
  .mqp-board.grid{
    background-image:
      linear-gradient(rgba(16,60,48,.09) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16,60,48,.09) 1px, transparent 1px);
  }
  .mqp-board.dark{ background-color:#0c1512; }
  .mqp-board.dark.grid{
    background-image:
      linear-gradient(rgba(190,230,214,.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(190,230,214,.07) 1px, transparent 1px);
  }
  body.mqp-lock{ overflow:hidden; }

  /* ---------- Study material reader ---------- */
  .mqp-reader{
    position:fixed;inset:0;z-index:80;display:flex;flex-direction:column;
    background:#050a08;opacity:0;transform:translateY(10px);
    transition:opacity .25s ease, transform .32s cubic-bezier(.32,.72,0,1);
  }
  .mqp-reader.show{ opacity:1;transform:none; }
  .mqp-rhead{
    display:flex;align-items:center;gap:8px;
    padding:calc(9px + env(safe-area-inset-top,0px)) 12px 9px;
    background:rgba(8,20,17,.96);border-bottom:1px solid rgba(120,190,165,.18);
  }
  .mqp-rtitle{flex:1;min-width:0;font-size:14px;font-weight:700;color:#eef5f1;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mqp-rbtn{
    height:34px;padding:0 11px;border-radius:10px;cursor:pointer;text-decoration:none;
    display:flex;align-items:center;gap:6px;
    font:inherit;font-size:12.5px;font-weight:700;color:#eef5f1;
    background:rgba(255,255,255,.06);border:1px solid rgba(120,190,165,.22);
    -webkit-tap-highlight-color:transparent;
  }
  .mqp-rbtn svg{ width:16px;height:16px; }
  .mqp-rbtn.board{ color:#02120c;background:#34d399;border-color:transparent; }
  .mqp-reader iframe{ flex:1;width:100%;border:0;background:#fff; }
  @media (max-width:420px){ .mqp-rbtn .lbl{ display:none; } }

  @media (prefers-reduced-motion: reduce){
    .mqp-fab,.mqp-b,.mqp-reader{ transition:none; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'mqp-style';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------------- Icons ---------------- */
  const I = {
    pen:   '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
    hl:    '<path d="M9 15l-4 4h6l1-1"/><path d="M14.5 4.5l5 5L12 17l-5-5 7.5-7.5z"/>',
    erase: '<path d="M7 20h10"/><path d="M5 15l8.5-8.5a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L12 18H8l-3-3z"/>',
    undo:  '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
    clear: '<path d="M4 7h16M9 7V4.8A.8.8 0 019.8 4h4.4a.8.8 0 01.8.8V7M6.5 7l1 12.2a1.8 1.8 0 001.8 1.8h5.4a1.8 1.8 0 001.8-1.8L17.5 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    grip:  '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>',
    more:  '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    hand:  '<path d="M8 13V5.5a1.5 1.5 0 013 0V12M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6a1.5 1.5 0 013 0v7a7 7 0 01-7 7h-.6a6 6 0 01-4.8-2.4L4.6 16a1.6 1.6 0 012.4-2.1L8 15"/>',
    zin:   '<circle cx="11" cy="11" r="7"/><path d="M11 8v6M8 11h6M20 20l-4-4"/>',
    zout:  '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M20 20l-4-4"/>',
    fit:   '<path d="M4 9V5a1 1 0 011-1h4M20 9V5a1 1 0 00-1-1h-4M4 15v4a1 1 0 001 1h4M20 15v4a1 1 0 01-1 1h-4"/>',
    board: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l4-4 4 4"/>',
    ext:   '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>'
  };
  const svg = (d, filled) => '<svg viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') +
    '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

  /* ---------------- State ---------------- */
  const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#111827', '#ffffff'];
  const SIZES  = [2.5, 5, 10];

  let penOn = false;
  let tool  = 'pen';            // pen | hl | erase | hand
  let color = COLORS[0];
  let size  = SIZES[1];

  // Where drawing is allowed right now: null | 'board' | 'reader'
  let place = null;
  let readerUrl = null;
  let boardFrom = null;         // what to return to when the board closes

  // One drawing per surface, so the board's sketch never sits over a book.
  const boards = {};
  let context = null;
  let current = null;

  function board(){
    if(!boards[context]) boards[context] = { strokes: [], undone: [] };
    return boards[context];
  }

  /* ---------------- The whiteboard camera ----------------
     The board is an infinite surface: strokes live in BOARD coordinates
     and a camera (x, y, zoom) decides which part is on screen. Over a
     book the drawing stays on the screen instead. */
  const view = { x: 0, y: 0, s: 1 };
  const ZOOM_MIN = 0.25, ZOOM_MAX = 4;
  const isBoard = () => place === 'board';

  function toWorld(sx, sy){
    if(!isBoard()) return { x: sx, y: sy };
    return { x: (sx - view.x) / view.s, y: (sy - view.y) / view.s };
  }
  // Zoom about a screen point, keeping whatever is under it still.
  function zoomAt(sx, sy, next){
    const s2 = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
    const wx = (sx - view.x) / view.s, wy = (sy - view.y) / view.s;
    view.s = s2;
    view.x = sx - wx * s2;
    view.y = sy - wy * s2;
    applyView();
  }
  function resetView(){ view.x = 0; view.y = 0; view.s = 1; applyView(); }

  /* ---------------- Canvas ---------------- */
  const canvas = document.createElement('canvas');
  canvas.className = 'mqp-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  let dpr = 1, W = 0, H = 0;

  /* The fix for the offset. The VISIBLE area is measured once, and both
     the element's CSS size and its pixel buffer are set from that same
     number, so one CSS pixel on screen is always one unit of drawing. */
  function measure(){
    const vv = window.visualViewport;
    return {
      w: Math.round(vv ? vv.width  : window.innerWidth),
      h: Math.round(vv ? vv.height : window.innerHeight),
      l: vv ? vv.offsetLeft : 0,
      t: vv ? vv.offsetTop  : 0
    };
  }
  function resize(){
    const m = measure();
    W = m.w; H = m.h;
    dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    canvas.style.left = m.l + 'px';
    canvas.style.top  = m.t + 'px';
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    redraw();
    clampDock();
  }

  /* Pointer position relative to the drawing layer itself — never the
     page — so it is right even if the layer is not at the top-left. */
  function pt(e){
    const r = canvas.getBoundingClientRect();
    const sx = r.width  ? W / r.width  : 1;
    const sy = r.height ? H / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  function drawStroke(st){
    const p = st.points;
    if(!p.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = st.color;
    ctx.globalAlpha = st.tool === 'hl' ? 0.32 : 1;
    ctx.lineWidth = st.size;
    if(p.length === 1){
      ctx.beginPath(); ctx.arc(p[0].x, p[0].y, st.size / 2, 0, Math.PI * 2);
      ctx.fillStyle = st.color; ctx.fill(); ctx.restore(); return;
    }
    // A smooth curve through the midpoints: raw segments look polygonal.
    ctx.beginPath(); ctx.moveTo(p[0].x, p[0].y);
    for(let i = 1; i < p.length - 1; i++){
      ctx.quadraticCurveTo(p[i].x, p[i].y, (p[i].x + p[i + 1].x) / 2, (p[i].y + p[i + 1].y) / 2);
    }
    const last = p[p.length - 1];
    ctx.lineTo(last.x, last.y); ctx.stroke(); ctx.restore();
  }

  function redraw(){
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if(!context) return;
    if(isBoard()) ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.x, dpr * view.y);
    board().strokes.forEach(drawStroke);
    if(current) drawStroke(current);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Stroke eraser: touching a stroke removes it whole, and undo brings it
     back. Pixel erasing leaves ragged half-lines and cannot be undone. */
  function eraseAt(sx, sy){
    const w0 = toWorld(sx, sy);
    const r = 14 / (isBoard() ? view.s : 1);
    const b = board();
    for(let i = b.strokes.length - 1; i >= 0; i--){
      const ps = b.strokes[i].points;
      for(let j = 0; j < ps.length; j++){
        const dx = ps[j].x - w0.x, dy = ps[j].y - w0.y;
        if(dx * dx + dy * dy < r * r){
          b.undone.push({ erased: b.strokes.splice(i, 1)[0], at: i });
          redraw(); return;
        }
      }
    }
  }
  function undo(){
    const b = board();
    const last = b.undone.length ? b.undone[b.undone.length - 1] : null;
    if(last && last.erased){ b.undone.pop(); b.strokes.splice(Math.min(last.at, b.strokes.length), 0, last.erased); }
    else if(b.strokes.length){ b.strokes.pop(); }
    redraw();
  }
  function clearAll(){ board().strokes = []; board().undone = []; redraw(); }

  /* ---------------- Pointer input ----------------
     One pointer draws. On the board a second pointer turns it into a
     pan-and-pinch, and the half-drawn stroke is dropped; elsewhere the
     second pointer is ignored, so a resting palm cannot draw. */
  let activePointer = null;
  const pointers = new Map();
  let gesture = null, panDrag = null, spaceDown = false;

  canvas.addEventListener('pointerdown', (e) => {
    if(!penOn) return;
    e.preventDefault();
    const p = pt(e);

    if(isBoard()){
      pointers.set(e.pointerId, p);
      try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
      if(pointers.size === 2){
        current = null; activePointer = null;
        const [a, b] = [...pointers.values()];
        gesture = { d0: Math.hypot(b.x - a.x, b.y - a.y) || 1, s0: view.s,
                    mx0: (a.x + b.x) / 2, my0: (a.y + b.y) / 2, vx0: view.x, vy0: view.y };
        redraw(); return;
      }
      if(pointers.size > 2) return;
      if(tool === 'hand' || spaceDown || e.button === 1){
        panDrag = { x: p.x, y: p.y, vx: view.x, vy: view.y, id: e.pointerId }; return;
      }
    } else if(activePointer !== null){
      return;
    }

    activePointer = e.pointerId;
    try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
    if(tool === 'erase'){ eraseAt(p.x, p.y); return; }

    current = {
      tool: tool,
      color: tool === 'hl' ? (color === '#ffffff' ? '#fde047' : color) : color,
      // Width set on screen, stored in board units, so zooming out later
      // does not turn a line drawn while zoomed in into a hair.
      size: (tool === 'hl' ? size * 3.2 : size) / (isBoard() ? view.s : 1),
      points: [toWorld(p.x, p.y)]
    };
    board().undone = [];
    redraw();
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pt(e);
    if(isBoard() && pointers.has(e.pointerId)){
      pointers.set(e.pointerId, p);
      if(gesture && pointers.size >= 2){
        e.preventDefault();
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        view.x = gesture.vx0 + (mx - gesture.mx0);
        view.y = gesture.vy0 + (my - gesture.my0);
        view.s = gesture.s0;
        zoomAt(mx, my, gesture.s0 * d / gesture.d0);
        return;
      }
      if(panDrag && panDrag.id === e.pointerId){
        e.preventDefault();
        view.x = panDrag.vx + (p.x - panDrag.x);
        view.y = panDrag.vy + (p.y - panDrag.y);
        applyView(); return;
      }
    }
    if(e.pointerId !== activePointer) return;
    e.preventDefault();
    if(tool === 'erase'){ eraseAt(p.x, p.y); return; }
    if(!current) return;
    // Coalesced events: the full stylus trail, not one sample per frame.
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
    evs.forEach(ev => { const q = pt(ev); current.points.push(toWorld(q.x, q.y)); });
    redraw();
  });

  function endStroke(e){
    if(pointers.has(e.pointerId)){
      pointers.delete(e.pointerId);
      if(pointers.size < 2) gesture = null;
      if(panDrag && panDrag.id === e.pointerId) panDrag = null;
    }
    if(e.pointerId !== activePointer) return;
    activePointer = null;
    if(current && current.points.length) board().strokes.push(current);
    current = null;
    redraw();
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  canvas.addEventListener('wheel', (e) => {
    if(!penOn || !isBoard()) return;
    e.preventDefault();
    const p = pt(e);
    if(e.ctrlKey || e.metaKey) zoomAt(p.x, p.y, view.s * Math.exp(-e.deltaY * 0.0022));
    else { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
  }, { passive: false });

  /* ---------------- The dock ---------------- */
  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'mqp-fab';
  fab.setAttribute('aria-label', 'Turn on the pen');
  fab.title = 'Pen';
  fab.innerHTML = svg(I.pen);

  const dock = document.createElement('div');
  dock.className = 'mqp-dock';
  dock.setAttribute('role', 'toolbar');
  dock.setAttribute('aria-label', 'Pen tools');

  function b(act, icon, label, extra){
    return '<button type="button" class="mqp-b ' + (extra || '') + '" data-act="' + act +
           '" aria-label="' + label + '" title="' + label + '">' + icon + '</button>';
  }
  /* Nine buttons at 32px fit a 360px phone in one row. The grip moves the
     dock when dragged and shrinks it to one button when tapped. */
  dock.innerHTML =
    b('grip', svg(I.grip, true), 'Move, or tap to shrink', 'mqp-grip') +
    '<span class="mqp-full" style="display:contents">' +
      b('pen',   svg(I.pen),   'Pen') +
      b('hl',    svg(I.hl),    'Highlighter') +
      b('erase', svg(I.erase), 'Eraser') +
      '<button type="button" class="mqp-b" data-act="color" aria-label="Colour and size" title="Colour and size"><span class="mqp-swatch"></span></button>' +
      b('undo',  svg(I.undo),  'Undo') +
      b('clear', svg(I.clear), 'Clear everything') +
      b('more',  svg(I.more),  'Board options', 'mqp-board-only') +
      b('close', svg(I.close), 'Close', 'x') +
    '</span>';

  const popColor = document.createElement('div');
  popColor.className = 'mqp-pop';
  popColor.innerHTML =
    '<div class="mqp-row">' + COLORS.map(c =>
      '<button type="button" class="mqp-dot" data-color="' + c + '" style="background:' + c + '" aria-label="Colour"></button>').join('') + '</div>' +
    '<div class="mqp-row">' + SIZES.map(s => {
      const d = Math.max(4, Math.min(14, s * 1.3));
      return '<button type="button" class="mqp-sz" data-size="' + s + '" aria-label="Thickness"><i style="width:' + d + 'px;height:' + d + 'px"></i></button>';
    }).join('') + '</div>';

  const popMore = document.createElement('div');
  popMore.className = 'mqp-pop';
  popMore.innerHTML =
    '<div class="mqp-row">' +
      '<button type="button" class="mqp-txt" data-bg="light">White</button>' +
      '<button type="button" class="mqp-txt" data-bg="grid">Grid</button>' +
      '<button type="button" class="mqp-txt" data-bg="dark">Dark</button>' +
    '</div>' +
    '<div class="mqp-row">' +
      '<button type="button" class="mqp-txt" data-z="out" aria-label="Zoom out">' + svg(I.zout) + '</button>' +
      '<button type="button" class="mqp-txt mqp-pct" data-z="reset" title="Back to 100%">100%</button>' +
      '<button type="button" class="mqp-txt" data-z="in" aria-label="Zoom in">' + svg(I.zin) + '</button>' +
      '<button type="button" class="mqp-txt" data-z="fit" aria-label="Back to the start">' + svg(I.fit) + '</button>' +
    '</div>' +
    '<div class="mqp-row">' +
      '<button type="button" class="mqp-txt" data-act="hand">' + svg(I.hand) + 'Move the board</button>' +
    '</div>';

  function syncDock(){
    dock.querySelectorAll('[data-act]').forEach(x => {
      const a = x.dataset.act;
      x.classList.toggle('on', a === tool && ['pen','hl','erase'].indexOf(a) >= 0);
    });
    dock.querySelector('.mqp-swatch').style.background = color;
    dock.querySelectorAll('.mqp-board-only').forEach(x => x.style.display = isBoard() ? 'flex' : 'none');
    popColor.querySelectorAll('.mqp-dot').forEach(d => d.classList.toggle('on', d.dataset.color === color));
    popColor.querySelectorAll('.mqp-sz').forEach(z => z.classList.toggle('on', +z.dataset.size === size));
    popMore.querySelector('[data-act="hand"]').classList.toggle('on', tool === 'hand');
    popMore.querySelectorAll('[data-bg]').forEach(x => x.classList.toggle('on',
      (x.dataset.bg === 'grid' && boardGrid) ||
      (x.dataset.bg === 'dark' && boardDark) ||
      (x.dataset.bg === 'light' && !boardDark)));
    const pct = popMore.querySelector('.mqp-pct');
    if(pct) pct.textContent = Math.round(view.s * 100) + '%';
    canvas.classList.toggle('hand', tool === 'hand');
  }

  /* ---- Pop-overs, placed against the dock wherever it has been moved ---- */
  function openPop(pop){
    [popColor, popMore].forEach(p => { if(p !== pop) p.classList.remove('show'); });
    if(pop.classList.contains('show')){ pop.classList.remove('show'); return; }
    pop.classList.add('show');
    const d = dock.getBoundingClientRect(), r = pop.getBoundingClientRect();
    let left = Math.max(8, Math.min(window.innerWidth - r.width - 8, d.left + d.width / 2 - r.width / 2));
    let top  = d.top - r.height - 8;
    if(top < 8) top = d.bottom + 8;               // no room above: open below
    pop.style.left = left + 'px';
    pop.style.top  = top + 'px';
  }
  function closePops(){ popColor.classList.remove('show'); popMore.classList.remove('show'); }

  /* ---- Moving the dock: drag the grip. A tap without movement shrinks it.
     The position is remembered — it is a preference, not a drawing. */
  const DOCK_KEY = 'mqp_dock';
  let dockPos = null;
  try{ dockPos = JSON.parse(localStorage.getItem(DOCK_KEY) || 'null'); }catch(e){}

  function placeDock(){
    const r = dock.getBoundingClientRect();
    let x, y;
    if(dockPos){ x = dockPos.x; y = dockPos.y; }
    else { x = (window.innerWidth - r.width) / 2; y = window.innerHeight - r.height - 14 - safeBottom(); }
    dock.style.left = x + 'px';
    dock.style.top  = y + 'px';
    clampDock();
  }
  function clampDock(){
    if(!dock.classList.contains('show')) return;
    const r = dock.getBoundingClientRect();
    const x = Math.max(6, Math.min(window.innerWidth  - r.width  - 6, r.left));
    const y = Math.max(6, Math.min(window.innerHeight - r.height - 6, r.top));
    dock.style.left = x + 'px';
    dock.style.top  = y + 'px';
  }
  function safeBottom(){
    const probe = parseFloat(getComputedStyle(fab).bottom) || 14;
    return Math.max(0, probe - 14);
  }

  const grip = dock.querySelector('[data-act="grip"]');
  let drag = null;
  grip.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = dock.getBoundingClientRect();
    drag = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    try{ grip.setPointerCapture(e.pointerId); }catch(err){}
    closePops();
  });
  grip.addEventListener('pointermove', (e) => {
    if(!drag || drag.id !== e.pointerId) return;
    if(Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
    if(!drag.moved) return;
    dock.style.left = (e.clientX - drag.ox) + 'px';
    dock.style.top  = (e.clientY - drag.oy) + 'px';
    clampDock();
  });
  grip.addEventListener('pointerup', (e) => {
    if(!drag || drag.id !== e.pointerId) return;
    if(drag.moved){
      const r = dock.getBoundingClientRect();
      dockPos = { x: r.left, y: r.top };
      try{ localStorage.setItem(DOCK_KEY, JSON.stringify(dockPos)); }catch(err){}
    } else {
      dock.classList.toggle('mini');   // tap: shrink or expand
      clampDock();
    }
    drag = null;
  });

  /* The single switch. Every route to turning the pen on or off goes
     through here, so the pointer-events rule cannot be forgotten. */
  function setPenOn(on){
    penOn = !!on && !!place;
    canvas.classList.toggle('on', penOn);
    dock.classList.toggle('show', penOn);
    fab.classList.toggle('show', !penOn && place === 'reader');
    if(penOn){ dock.classList.remove('mini'); placeDock(); }
    else { activePointer = null; current = null; pointers.clear(); gesture = null; panDrag = null; closePops(); redraw(); }
    syncDock();
  }

  fab.addEventListener('click', () => setPenOn(true));

  dock.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if(!t) return;
    switch(t.dataset.act){
      case 'pen': case 'hl': case 'erase': tool = t.dataset.act; closePops(); break;
      case 'color': openPop(popColor); break;
      case 'more':  openPop(popMore); break;
      case 'undo':  undo(); break;
      case 'clear': clearAll(); break;
      // Close means: over a book, put the pen away; on the board, leave it.
      case 'close': if(isBoard()) closeBoard(); else setPenOn(false); break;
    }
    syncDock();
  });
  popColor.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if(!t) return;
    if(t.dataset.color){ color = t.dataset.color; if(tool === 'erase' || tool === 'hand') tool = 'pen'; }
    if(t.dataset.size){ size = +t.dataset.size; }
    syncDock();
  });
  popMore.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if(!t) return;
    const cx = W / 2, cy = H / 2;
    if(t.dataset.z === 'in')    zoomAt(cx, cy, view.s * 1.25);
    if(t.dataset.z === 'out')   zoomAt(cx, cy, view.s / 1.25);
    if(t.dataset.z === 'reset') zoomAt(cx, cy, 1);
    if(t.dataset.z === 'fit')   resetView();
    if(t.dataset.act === 'hand') tool = (tool === 'hand') ? 'pen' : 'hand';
    if(t.dataset.bg){
      if(t.dataset.bg === 'grid') boardGrid = !boardGrid;
      else {
        boardDark = (t.dataset.bg === 'dark');
        // keep the ink visible on the new background
        if(boardDark && color === '#111827') color = '#ffffff';
        if(!boardDark && color === '#ffffff') color = '#111827';
      }
      boardEl.classList.toggle('dark', boardDark);
      boardEl.classList.toggle('grid', boardGrid);
      applyView();
    }
    syncDock();
  });
  // A tap anywhere else closes an open pop-over.
  document.addEventListener('pointerdown', (e) => {
    if(!e.target.closest || (!e.target.closest('.mqp-pop') && !e.target.closest('.mqp-dock'))) closePops();
  }, true);

  document.addEventListener('keydown', (e) => {
    const typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
    if(typing || !place) return;
    if(e.code === 'Space' && isBoard()) spaceDown = true;
    if((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && penOn){ e.preventDefault(); undo(); return; }
    if(e.key === 'Escape'){ if(isBoard()) closeBoard(); else setPenOn(false); return; }
    if(e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey && place === 'reader') setPenOn(!penOn);
  });
  document.addEventListener('keyup', (e) => { if(e.code === 'Space') spaceDown = false; });

  /* ---------------- Whiteboard ---------------- */
  let boardDark = false, boardGrid = false;
  const boardEl = document.createElement('div');
  boardEl.className = 'mqp-board';
  boardEl.id = 'mqpBoard';

  function applyView(){
    const g = 28 * view.s;
    boardEl.style.backgroundSize = g + 'px ' + g + 'px';
    boardEl.style.backgroundPosition = view.x + 'px ' + view.y + 'px';
    syncDock();
    redraw();
  }

  /* Opens the board, remembering where it was opened from: a tab, or a
     book in the reader. Closing goes back to exactly that place. */
  function openBoard(from){
    boardFrom = from || boardFrom || { tab: currentTab() };
    place = 'board';
    context = 'board';
    boardEl.classList.add('show');
    document.body.classList.add('mqp-lock');
    canvas.classList.add('live');
    tool = (tool === 'erase' || tool === 'hand') ? 'pen' : tool;
    if(!boardDark && color === '#ffffff') color = COLORS[4];
    applyView();
    setPenOn(true);
  }
  function closeBoard(){
    boardEl.classList.remove('show');
    document.body.classList.remove('mqp-lock');
    const from = boardFrom; boardFrom = null;
    if(from && from.reader){
      // back to the book that was open
      place = 'reader'; context = 'reader:' + from.reader;
      setPenOn(false); redraw();
    } else {
      leaveDrawing();
      const tab = document.querySelector('.tab[data-tab="' + ((from && from.tab) || 'overview') + '"]') ||
                  document.querySelector('.tab[data-tab="overview"]');
      if(tab && currentTab() === 'board') tab.click();
    }
  }
  // No drawing surface: the layer hides entirely and takes nothing.
  function leaveDrawing(){
    place = null; context = null;
    setPenOn(false);
    canvas.classList.remove('live');
    fab.classList.remove('show');
    redraw();
  }

  /* ---------------- Study material reader ----------------
     Books open inside the class sheet so the pen can be over them. They
     are on this site, so an iframe loads them unchanged — no edit to any
     of the books. "New tab" stays one tap away. */
  let reader = null;
  function openReader(url, title){
    if(!reader){
      reader = document.createElement('div');
      reader.className = 'mqp-reader';
      reader.innerHTML =
        '<div class="mqp-rhead">' +
          '<div class="mqp-rtitle"></div>' +
          '<button type="button" class="mqp-rbtn board" data-r="board" aria-label="Open the whiteboard">' + svg(I.board) + '<span class="lbl">Board</span></button>' +
          '<a class="mqp-rbtn" target="_blank" rel="noopener" data-r="ext" aria-label="Open in a new tab">' + svg(I.ext) + '<span class="lbl">New tab</span></a>' +
          '<button type="button" class="mqp-rbtn" data-r="close" aria-label="Close">' + svg(I.close) + '</button>' +
        '</div>' +
        '<iframe title="Study material"></iframe>';
      document.body.appendChild(reader);
      reader.querySelector('[data-r="close"]').addEventListener('click', closeReader);
      reader.querySelector('[data-r="board"]').addEventListener('click', () => openBoard({ reader: readerUrl }));
    }
    reader.querySelector('.mqp-rtitle').textContent = title || 'Study material';
    reader.querySelector('[data-r="ext"]').href = url;
    reader.querySelector('iframe').src = url;
    reader.hidden = false;
    requestAnimationFrame(() => reader.classList.add('show'));
    readerUrl = url.split('#')[0];
    place = 'reader';
    context = 'reader:' + readerUrl;
    canvas.classList.add('live');
    setPenOn(false);                 // shows the pen button, pen still off
    redraw();
  }
  function closeReader(){
    if(!reader) return;
    reader.classList.remove('show');
    readerUrl = null;
    leaveDrawing();
    setTimeout(() => {
      if(!readerUrl){ reader.hidden = true; reader.querySelector('iframe').src = 'about:blank'; }
    }, 280);
  }

  /* Capture phase on purpose: the page's "Open the book" link calls
     stopPropagation() so a tap does not collapse its card, which also
     hides the click from a normal listener. */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.sm-item, a.sm-open');
    if(!a) return;
    let u;
    try{ u = new URL(a.getAttribute('href'), location.href); }catch(err){ return; }
    if(u.origin !== location.origin) return;
    e.preventDefault();
    const card = a.closest('.sm-block, .sm-course, [data-key]');
    const t = card && card.querySelector('.sm-title, h4, .sm-name');
    openReader(u.href, t ? t.textContent.trim() : a.textContent.trim());
  }, true);

  /* ---------------- Following the tabs ----------------
     Only the Whiteboard tab opens a drawing surface. Every other tab
     closes it, so the pen cannot appear over the overview, calendar,
     Hifz report or notices. */
  function currentTab(){
    const t = document.querySelector('.tab.active');
    return (t && t.dataset.tab) || 'overview';
  }
  let lastTab = 'overview';
  const tabObserver = new MutationObserver(() => {
    const t = currentTab();
    if(t === 'board'){
      if(place !== 'board') openBoard({ tab: lastTab });
    } else {
      lastTab = t;
      if(place === 'board' && boardFrom && boardFrom.tab){ boardEl.classList.remove('show');
        document.body.classList.remove('mqp-lock'); boardFrom = null; leaveDrawing(); }
    }
  });

  /* ---------------- Boot ---------------- */
  function boot(){
    document.body.append(boardEl, canvas, dock, popColor, popMore, fab);
    const panel = document.getElementById('panel-board');
    if(panel && !panel.dataset.mqp){
      panel.dataset.mqp = '1';
      panel.innerHTML = '<div style="padding:30px 10px;text-align:center;opacity:.6">The whiteboard opens full screen.</div>';
    }
    resize();
    syncDock();
    document.querySelectorAll('.tab, .tab-panel').forEach(el =>
      tabObserver.observe(el, { attributes: true, attributeFilter: ['class'] }));
    if(currentTab() === 'board') openBoard({ tab: 'overview' });
  }
  window.addEventListener('resize', resize);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', resize);
    window.visualViewport.addEventListener('scroll', resize);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.mqPen = {
    on: () => setPenOn(true), off: () => setPenOn(false), isOn: () => penOn,
    place: () => place, context: () => context, strokes: () => context ? board().strokes.length : 0,
    openReader: openReader, closeReader: closeReader, openBoard: openBoard, closeBoard: closeBoard
  };
})();
