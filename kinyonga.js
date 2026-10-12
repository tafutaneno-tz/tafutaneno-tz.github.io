/* =====================================================================
   KINYONGA – the chameleon friend of the player.
   - walks with real steps (one foot up, a stride, the foot down – no sliding)
   - stays calm: goes to a spot, then spends a good while there playing,
     talking and laughing while looking at the player
   - carried with a finger, he stays exactly where he is put and plays there
   - laughs at wrong words, celebrates right ones, reacts when tapped,
     gives Swahili tips when the player is stuck

   Host page calls:
     Kinyonga.init({ parent, inner, board, grid, sfx, topLimit, protect, isPlaying, softHint, hintCell, cancelSelection })
     Kinyonga.onLevelStart(first) · onCorrect() · onWrong() · onBonus() · onWin()
     Kinyonga.activity()  (player touched the board)  · Kinyonga.boardDown(e) · Kinyonga.layout()
   Sprites: images/kinyonga-front.webp (front poses, looking at the player),
            images/kinyonga-anim.webp (side hop frames), kinyonga-poses.webp (sitting), kinyonga-close.webp (close-ups)
   ===================================================================== */
(function () {
  'use strict';

  const VER = 3;   // sprite sheet version (bump when the .webp files change)
  const META = {
    cell: [176, 140], charPx: 112,                 // side frames: character ~106px tall inside a 176×140 cell
    anim: { cols: 12, url: 'images/kinyonga-anim.webp?v=' + VER, seq: { jump: [21, 22, 23, 24, 25, 26, 27, 28, 29] } },
    walk: { cols: 8, n: 8, stride: 40, url: 'images/kinyonga-walk.webp?v=' + VER },   // side walking cycle; stride = ground per cycle (sheet px)
    front: { cols: 8, cell: [250, 210], foot: 6, h: 188, url: 'images/kinyonga-front.webp?v=' + VER, index: {
      wave: 0, thumbs: 1, cheer: 2, yay: 3, stepL: 4, stepR: 5, dash: 6, hello: 7, wide: 8, love: 9, kiss: 10, inlove: 11,
      idea: 12, oh: 13, magnify: 14, map: 15, question: 16, think: 17, cool: 18, hi: 19, fall: 20, slip: 21, cry: 22, sob: 23,
      sad: 24, sleep: 25, laughpoint: 26, tease: 27, wow: 28, giggle: 29, dance: 30, party: 31, jumpjoy: 32, shy: 33, kiss2: 34,
      shy2: 35, cute: 36, hearts: 37, handheart: 38, point: 39, tada: 40, angry: 41 } },
    poses: { cols: 6, url: 'images/kinyonga-poses.webp?v=' + VER, index: { sit: 17 } },
    close: { cols: 4, url: 'images/kinyonga-close.webp?v=' + VER, index: { point: 0, winkwalk: 1, cheer: 2, kiss: 3, laughpoint: 4, magnify: 5, think: 6, shock: 7 } }
  };
  // when he is close to the camera the sharp close-up pictures are used
  const CLOSE_OF = { point: 'point', hi: 'winkwalk', wave: 'winkwalk', hello: 'winkwalk', tada: 'winkwalk', cheer: 'cheer', yay: 'cheer', party: 'cheer',
    kiss: 'kiss', kiss2: 'kiss', love: 'kiss', laughpoint: 'laughpoint', giggle: 'laughpoint', magnify: 'magnify',
    think: 'think', question: 'think', wow: 'shock', oh: 'shock' };

  const SAY = {
    greet: ['Karibu! Tuanze!', 'Twende tena!', 'Habari! Tucheze!', 'Niko tayari! Na wewe?'],
    correct: ['Hongera!', 'Safi sana!', 'Unacheza vizuri!', 'Hodari!', 'Bomba!', 'Wewe ni bingwa!'],
    wrong: ['Hehe! Umekosea!', 'Jaribu tena!', 'Umekaribia!', 'Hehe! Si hilo!', 'Karibu kupata!'],
    win: ['Hongera! Umemaliza!', 'Safi sana! Twende tena!', 'Wewe ni bingwa!'],
    hint1: ['Nikupe kidokezo?', 'Umekwama? Nisaidie kidogo?'],
    hint2: ['Angalia herufi hizi!', 'Tazama hapa!'],
    cheer: ['Unaweza! Endelea!', 'Usikate tamaa!', 'Polepole ndio mwendo!'],
    slip: ['Lo!', 'Aaah!'], up: ['Niko sawa! Twende tena!', 'Sijaumia! Hehe!'],
    tap: { shy: 'Hihi! Umenipata!', kiss: 'Nakupenda!', inlove: 'Wewe ni rafiki yangu!', handheart: 'Nakupenda, rafiki!', tease: 'Hehe! Unanicheka?',
      wow: 'Lo! Umenishtua!', cool: 'Poa sana!', yay: 'Juu! Juu!', dance: 'Tucheze!' }
  };
  const CHAT = ['Hapa ni pazuri!', 'Unaona neno lolote?', 'Mimi ni Kinyonga!', 'Herufi hizi ni nyingi!', 'Tafuta pamoja nami!', 'Je, umeliona hili?',
    'Nakuangalia! Hehe!', 'Wewe ni rafiki yangu!', 'Endelea, unaweza!', 'Nimefurahi kucheza nawe!'];
  const DRAG_SAY = ['Lo! Unanipeleka wapi?', 'Wee! Naruka!', 'Hehe! Polepole!'];
  const DROP_SAY = ['Asante! Nitakaa hapa!', 'Hapa ni pazuri!', 'Nimefika!', 'Nitabaki hapa nawe!'];
  const BUBBLE_COLORS = ['#ffffff', '#fff3b0', '#d9f99d', '#fbcfe8', '#bfdbfe', '#fde68a'];

  const CSS = `
  .kin-layer{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden}
  .kin{position:absolute;left:0;top:0;will-change:transform;pointer-events:none;transform-origin:50% 100%}
  .kin-bob,.kin-fx{position:relative;width:100%;height:100%;transform-origin:50% 100%}
  .kin-spr{position:absolute;left:0;top:0;width:100%;height:100%;background-repeat:no-repeat;transform-origin:50% 100%}
  .kin-spr.flip{transform:scaleX(-1)}
  .kin-hit{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
  .kin-fx-bounce{animation:kinBounce .5s ease-out}
  .kin-fx-shake{animation:kinShake .45s ease-in-out}
  .kin-fx-wobble{animation:kinWobble .9s ease-in-out}
  .kin-fx-angry{animation:kinShake .28s ease-in-out 6}
  @keyframes kinBounce{0%{transform:scale(1,1)}40%{transform:scale(1.07,1.05)}100%{transform:scale(1,1)}}
  @keyframes kinShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px) rotate(-3deg)}75%{transform:translateX(4px) rotate(3deg)}}
  @keyframes kinWobble{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
  .kin-say{position:absolute;left:0;top:0;max-width:240px;padding:6px 11px;border-radius:14px;background:#fff;color:#1d1630;
    font:900 .92rem/1.2 "Nunito",system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.18),0 6px 16px rgba(0,0,0,.25);
    border:2px solid rgba(29,22,48,.85);opacity:0;transform:scale(.6);transition:opacity .18s,transform .18s;pointer-events:none;white-space:normal}
  .kin-say.on{opacity:1;transform:scale(1)}
  .kin-heart{position:absolute;font-size:20px;line-height:1;pointer-events:none;animation:kinHeart 1.4s ease-out forwards}
  @keyframes kinHeart{0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-70px) scale(1.15)}}
  @media (prefers-reduced-motion:reduce){.kin-fx-bounce,.kin-fx-shake,.kin-fx-wobble,.kin-heart{animation:none}}
  `;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LITE = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  /* ---------- state ---------- */
  const K = {
    ready: false, host: null, layer: null, el: null, bob: null, fxEl: null, spr: null, hit: null, bubble: null,
    d: .5, w: 88, h: 70, charH: 56, ground: 0, minX: 4, maxX: 200,
    x: 40, y: 0, lift: 0, face: 1, lane: 'bot', cell: null, grid: null, leaping: false, gBot: 0, queue: [], act: null, frameKey: '', sprKind: '', raf: 0, last: 0,
    lastTouch: 0, hintStage: 0, nextBrain: 0, lastSlip: 0, lastSay: 0, lastChat: 0, sayT: 0, busyUntil: 0, stepN: 0, clock: 0,
    depth: 1, zoom: 1, sink: 0, closeReady: false, lastZoom: -1e9, protect: [], freeTop: 0,
    home: null, idlePose: 'cute', ghosted: false, sleeping: false, nextZ: 0, nextVar: 0, lastFind: 0, wrongStreak: 0, lastHint: -1e9, lastWake: 0
  };

  /* ---------- drawing ---------- */
  function sprBox(kind) {
    if (kind === K.sprKind) return; K.sprKind = kind;
    const s = K.spr.style;
    if (kind === 'f') {            // front pictures: own cell size, feet on the same line as the side frames
      const f = META.front, df = K.charH * (106 / 112) / f.h, w = f.cell[0] * df, h = f.cell[1] * df;
      s.width = w + 'px'; s.height = h + 'px'; s.left = ((K.w - w) / 2) + 'px'; s.top = (K.h - 3 * K.d - (f.cell[1] - f.foot) * df) + 'px';
    } else if (kind === 'p') {     // the sitting picture is drawn smaller in its sheet: enlarge it to match
      const k = 1.2, w = K.w * k, h = K.h * k;
      s.width = w + 'px'; s.height = h + 'px'; s.left = ((K.w - w) / 2) + 'px'; s.top = (K.h - h + 3 * K.d * (k - 1)) + 'px';
    } else { s.width = '100%'; s.height = '100%'; s.left = '0'; s.top = '0'; }
  }
  function setFrame(kind, idx) {
    const key = kind + idx; if (key === K.frameKey) return; K.frameKey = key;
    sprBox(kind);
    const s = K.spr.style, d = K.d, [CW, CH] = META.cell;
    if (kind === 'f') {
      const f = META.front, df = K.charH * (106 / 112) / f.h, c = idx % f.cols, r = Math.floor(idx / f.cols);
      s.backgroundImage = `url(${f.url})`;
      s.backgroundSize = `${f.cols * f.cell[0] * df}px auto`;
      s.backgroundPosition = `${-c * f.cell[0] * df}px ${-r * f.cell[1] * df}px`;
      return;
    }
    const m = kind === 'a' ? META.anim : kind === 'w' ? META.walk : kind === 'c' ? META.close : META.poses, k = kind === 'p' ? 1.2 : 1;
    const c = idx % m.cols, r = Math.floor(idx / m.cols);
    s.backgroundImage = `url(${m.url})`;
    s.backgroundSize = `${m.cols * CW * d * k}px auto`;
    s.backgroundPosition = `${-c * CW * d * k}px ${-r * CH * d * k}px`;
  }
  const S = () => K.depth * K.zoom;
  function place() {
    const sc = S(), feet = K.ground + K.sink;
    const top = feet - K.h - K.y;
    K.el.style.transform = `translate3d(${K.x.toFixed(1)}px,${top.toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
    K.spr.classList.toggle('flip', K.face < 0);
    // the touch area covers only the body; it is off in the air, near the camera, and wherever it would cover
    // letters or buttons – a finger there always reaches the game underneath
    const hw = K.charH * .85 * sc;
    let hh = K.charH * .95 * sc, hy = feet - K.y - hh;
    const hx = K.x + K.w / 2 - hw / 2;
    if (K.lane === 'bot' && K.innerBox && hy < K.innerBox.bottom) { const nb = Math.min(feet - 14, K.innerBox.bottom); hh = feet - K.y - nb; hy = nb; }
    Object.assign(K.hit.style, { width: hw + 'px', height: hh + 'px', transform: `translate3d(${hx}px,${hy}px,0)` });
    const box = { left: hx, top: hy, right: hx + hw, bottom: hy + hh };
    const blocked = K.protect.some(r => !(box.right <= r.left || box.left >= r.right || box.bottom <= r.top || box.top >= r.bottom));
    K.hit.style.pointerEvents = (K.y > 2 || K.leaping || K.lane === 'grid' || K.zoom > 1.05 || blocked) ? 'none' : 'auto';
    if (K.bubble.classList.contains('on')) placeBubble();
  }

  /* ---------- layout ---------- */
  function layout() {
    if (!K.ready) return;
    const inner = K.host.inner().getBoundingClientRect();
    const board = K.host.board ? K.host.board().getBoundingClientRect() : inner;
    const vb = (window.visualViewport ? visualViewport.height : innerHeight);
    const ground = vb - 4;
    const space = ground - inner.bottom - 4;                  // free height between the last row of letters and the screen bottom
    const gi = K.host.grid ? K.host.grid() : null;
    const cs = gi && gi.n ? inner.width / gi.n : 60;
    K.charH = Math.max(58, Math.min(100, Math.max(space, innerWidth * .21)));
    K.gridDepth = Math.min(1, cs * 1.9 / K.charH);    // on the letters: about two boxes tall
    const sameGrid = K.grid && gi && K.grid.n === gi.n;
    K.grid = gi && gi.n ? { left: inner.left, top: inner.top, cs, n: gi.n } : null;
    K.d = K.charH / META.charPx;
    K.w = META.cell[0] * K.d; K.h = META.cell[1] * K.d;
    K.gBot = ground + 3 * K.d;
    const topLimit = K.host.topLimit ? K.host.topLimit() : 0;
    K.protect = (K.host.protect ? K.host.protect() : []).filter(r => r && r.width).map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
    K.freeTop = topLimit + K.charH * .8;            // highest the feet may go: the head stays under the word card
    K.boardTop = board.top; K.innerBox = { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom };
    K.topEdgeOk = K.boardTop - topLimit >= K.charH * .8;
    K.minX = -K.w * .12; K.maxX = innerWidth - K.w * .88;
    if (K.lane === 'grid' && !(sameGrid && K.cell)) { K.lane = 'bot'; K.cell = null; ghost(false); }
    if (K.zoom !== 1 && !(K.act && K.act.type === 'zoom')) { K.zoom = 1; K.sink = 0; }
    // his home spot (under the board unless the player carried him somewhere else); kept on the screen
    if (!K.home) K.home = { x: clampX(K.x), g: K.gBot, bot: true };
    const h = K.home;
    h.x = Math.max(K.minX, Math.min(K.maxX, h.x));
    h.g = h.bot ? K.gBot : Math.max(K.charH + 4, Math.min(K.gBot, h.g));
    if (!h.bot && homeOnLetters()) { h.bot = true; h.g = K.gBot; }      // the board grew over it: back under the board
    if (!K.drag && !(K.act && (K.act.type === 'walk' || K.act.type === 'leap'))) { K.x = h.x; K.ground = h.g; K.lane = h.bot ? 'bot' : 'free'; K.cell = null; }
    if (K.lane === 'bot') { K.ground = K.gBot; K.depth = 1; }
    else if (K.lane === 'free') K.depth = depthAt(K.ground);
    if (K.lane === 'grid') { const q = cellPos(K.cell[0], K.cell[1]); K.x = q.x; K.ground = q.g; K.depth = K.gridDepth; }
    K.el.style.width = K.w + 'px'; K.el.style.height = K.h + 'px';
    if (K.lane !== 'grid') K.x = Math.max(K.minX, Math.min(K.maxX, K.x));
    K.layer.style.display = space < 34 ? 'none' : '';          // too little room on this screen: stay hidden
    K.frameKey = ''; K.sprKind = ''; draw(); place();
  }
  function cellPos(r, c) { const g = K.grid; return { x: g.left + (c + .5) * g.cs - K.w / 2, g: g.top + (r + .5) * g.cs + g.cs * .42 + 3 * K.d }; }
  function ghost(on) { K.ghosted = on; K.layer.style.transition = 'opacity .25s'; K.layer.style.opacity = on ? '.22' : ''; }
  function depthAt(g) {           // farther up the screen = a little smaller, like walking away from the camera
    const t = Math.max(0, Math.min(1, (g - K.freeTop) / Math.max(1, K.gBot - K.freeTop)));
    return .72 + .28 * t;
  }
  const clampX = x => Math.max(K.minX, Math.min(K.maxX, x));

  /* ---------- speech bubble beside the head ---------- */
  function say(text, ms) {
    if (!text) return;
    const b = K.bubble; b.textContent = text;
    b.style.background = pick(BUBBLE_COLORS);
    b.classList.add('on'); placeBubble();
    clearTimeout(K.sayT); K.lastSay = performance.now();
    K.sayT = setTimeout(() => b.classList.remove('on'), ms || 2300);
  }
  function placeBubble() {
    const b = K.bubble, room = innerWidth - 8;
    const half = K.w * S() / 2, mid = K.x + K.w / 2;
    const leftSpace = mid - half * .6 - 8, rightSpace = room - (mid + half * .6);
    const right = rightSpace >= leftSpace;
    b.style.maxWidth = Math.max(110, Math.min(240, (right ? rightSpace : leftSpace) - 6)) + 'px';
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let bx = right ? mid + half * .56 : mid - half * .56 - bw;
    bx = Math.max(6, Math.min(room - bw, bx));
    const sc = S(), feet = K.ground + K.sink - K.y;
    let by = feet - K.charH * sc * .78 - bh / 2;
    by = Math.max(6, Math.min(by, innerHeight - bh - 6));
    b.style.transform = `translate3d(${bx}px,${by}px,0)`;
    b.style.transformOrigin = right ? '0% 50%' : '100% 50%';
  }
  function hearts(n, glyph, colors) {
    const sc = S();
    for (let i = 0; i < (n || 3); i++) {
      const h = document.createElement('div'); h.className = 'kin-heart'; h.textContent = glyph || '❤';
      h.style.color = pick(colors || ['#ff4d6d', '#ff8fab', '#f43f5e']);
      h.style.left = (K.x + K.w * (.45 + Math.random() * .3)) + 'px';
      h.style.top = (K.ground - K.charH * .9 * sc) + 'px';
      h.style.setProperty('--dx', rnd(-26, 26).toFixed(0) + 'px');
      h.style.animationDelay = (i * .18) + 's';
      K.layer.appendChild(h); setTimeout(() => h.remove(), 1800 + i * 200);
    }
  }
  function fx(cls) { const s = K.fxEl; s.classList.remove('kin-fx-bounce', 'kin-fx-shake', 'kin-fx-wobble', 'kin-fx-angry'); if (!cls || REDUCED) return; void s.offsetWidth; s.classList.add(cls); }

  /* ---------- actions ---------- */
  const STEP = { ms: 270 };                // one step (half a walking cycle)
  function start(a) {
    a.t = 0; a.started = true;
    if (a.type === 'jump') a.x0 = K.x;
    if (a.say) say(a.say, a.sayMs);
    if (a.fx) fx(a.fx);
    if (a.hearts) hearts(a.hearts, a.glyph);
    if (a.onStart) a.onStart();
    return a;
  }
  function nextStep(a) {          // where the next footstep lands
    const dx = a.x1 - K.x, dg = a.g1 - K.ground, dist = Math.hypot(dx, dg);
    const stride = K.charH * .3 * (K.lane === 'bot' ? 1 : Math.max(.7, K.depth));
    a.sx = K.x; a.sg = K.ground;
    if (dist <= stride * 1.25) { a.tx = a.x1; a.tg = a.g1; a.last = true; }
    else { a.tx = K.x + dx / dist * stride; a.tg = K.ground + dg / dist * stride; a.last = false; }
    if (Math.abs(a.tx - a.sx) > 1) K.face = Math.sign(a.tx - a.sx);
    a.st = 0;
  }
  function update(dt) {
    if (!K.act) { K.act = K.queue.length ? start(K.queue.shift()) : null; if (!K.act) return; }
    const a = K.act; a.t += dt;
    let done = false;
    K.lift = 0;
    if (a.type === 'walk') {
      if (!a.init) {
        a.init = true;
        if (Math.hypot(a.x1 - K.x, a.g1 - K.ground) < 2) { done = true; }
        else { if (!(a.lane === 'bot' && K.lane === 'bot')) K.lane = 'free'; }
      }
      if (!done) {
        // real walking: the legs swing through an 8-picture cycle and the body moves exactly as far as the
        // foot on the ground pushes it – so the feet never slide and he never leaves the ground
        const T = (a.stepMs || STEP.ms) * 2 / 1000;                 // one cycle = two steps
        const stride = META.walk.stride * K.d * K.depth;
        const dx = a.x1 - K.x, dg = a.g1 - K.ground, d = Math.hypot(dx, dg), mv = stride / T * dt;
        if (Math.abs(dx) > 1) K.face = Math.sign(dx);
        if (d <= mv) { K.x = a.x1; K.ground = a.g1; done = true; }
        else { K.x += dx / d * mv; K.ground += dg / d * mv; }
        K.walkPh = (K.walkPh || 0) + Math.min(d, mv) / Math.max(1, stride);
      }
      if (K.lane === 'free') { const want = overLetters() ? Math.min(depthAt(K.ground), K.gridDepth * 1.1) : depthAt(K.ground); K.depth += (want - K.depth) * Math.min(1, dt * 5); }
      if (done) { K.x = a.x1; K.ground = a.g1; K.lift = 0; if (a.lane === 'bot') { K.lane = 'bot'; K.depth = 1; K.ground = K.gBot; } else if (a.lane) K.lane = a.lane; }
    } else if (a.type === 'jump') {
      const T = a.ms / 1000, p = Math.min(1, a.t / T);
      K.y = Math.sin(p * Math.PI) * K.charH * (a.height || .45);
      if (a.dx) { K.x = clampX(a.x0 + a.dx * p); K.face = Math.sign(a.dx); }
      if (p >= 1) { K.y = 0; done = true; }
    } else if (a.type === 'leap') {
      if (a.x0 === undefined) {
        if (a.cell && K.grid) { const q = cellPos(a.cell[0], a.cell[1]); a.x1 = q.x; a.g1 = q.g; }
        if (a.lane === 'bot') { a.g1 = K.gBot; if (a.x1 === undefined) a.x1 = clampX(K.x); }
        a.x0 = K.x; a.g0 = K.ground; a.d0 = K.depth; K.leaping = true; if (Math.abs(a.x1 - a.x0) > 1) K.face = Math.sign(a.x1 - a.x0);
      }
      const p = Math.min(1, a.t / (a.ms / 1000)), e = ease(p);
      K.x = a.x0 + (a.x1 - a.x0) * e; K.ground = a.g0 + (a.g1 - a.g0) * e;
      const dt1 = a.lane === 'grid' ? K.gridDepth : a.lane === 'free' ? depthAt(a.g1) : 1; K.depth = a.d0 + (dt1 - a.d0) * e;
      if (a.step) K.lift = Math.sin(p * Math.PI) * K.charH * (a.h || .16); else K.y = Math.sin(p * Math.PI) * K.charH * (a.h || .3);
      if (p >= 1) { K.y = 0; K.leaping = false; K.lane = a.lane; K.cell = a.cell || null; if (a.step) K.stepN++; if (a.lane !== 'grid') ghost(false); done = true; }
    } else if (a.type === 'zoom') {
      if (a.z0 === undefined) a.z0 = K.zoom;
      const p = Math.min(1, a.t / (a.ms / 1000)), e = ease(p);
      K.zoom = a.z0 + (a.to - a.z0) * e; K.sink = (K.zoom - 1) * K.charH * .42;
      if (a.walking) { K.lift = 0; K.stepN = Math.floor(a.t / .3); }      // stepping towards / away from the camera
      if (p >= 1) { K.zoom = a.to; if (a.to === 1) K.sink = 0; done = true; }
    } else if (a.type === 'call') {    // decides the next steps at the moment it runs
      const more = a.fn() || []; K.queue.unshift(...more); done = true;
    } else {                       // 'pose', 'seq', 'talk', 'wait'
      if (a.t * 1000 >= a.ms) done = true;
    }
    if (done) { K.lift = 0; if (a.onEnd) a.onEnd(); K.act = null; }
  }
  function front(name) {
    if (K.zoom > 1.35 && K.closeReady && CLOSE_OF[name]) return ['c', META.close.index[CLOSE_OF[name]]];
    if (META.front.index[name] != null) return ['f', META.front.index[name]];
    if (META.poses.index[name] != null) return ['p', META.poses.index[name]];
    return ['f', META.front.index.cute];
  }
  function frameFor(a) {
    if (!a) return front(K.idlePose);
    if (a.type === 'zoom' && a.walking) return front(K.stepN % 2 ? 'stepR' : 'stepL');
    if (a.type === 'walk' || (a.type === 'leap' && a.step)) return K.walkReady ? ['w', Math.floor((((K.walkPh || 0) % 1) + 1) % 1 * META.walk.n) % META.walk.n] : front(((K.walkPh || 0) % 1 + 1) % 1 < .5 ? 'stepL' : 'stepR');
    if (a.type === 'leap') {        // hop: arms up on the way up, happy face on the way down
      const p = a.t / (a.ms / 1000);
      return front(p < .5 ? 'jumpjoy' : 'yay');
    }
    if (a.type === 'seq') return front(a.poses[Math.floor(a.t * 1000 / a.every) % a.poses.length]);
    if (a.pose) return front(a.pose);
    return front(K.idlePose);
  }
  function draw() { const [k, i] = frameFor(K.act); setFrame(k, i); }
  // small life on top of the pictures: breathing when standing, a little bounce when talking, the foot lift when stepping
  function bobAnim(dt) {
    K.clock += dt;
    const a = K.act; let tf;
    if (K.lift) tf = `translateY(${(-K.lift).toFixed(1)}px)`;
    else if (REDUCED) tf = '';
    else if (a && a.type === 'talk') tf = `translateY(${(-Math.abs(Math.sin(K.clock * 9)) * K.charH * .025).toFixed(1)}px)`;
    else if (!a || a.type === 'pose' || a.type === 'wait') tf = `scale(1,${(1 + Math.sin(K.clock * 2.6) * .012).toFixed(4)})`;
    else tf = '';
    if (tf !== K.bobTf) { K.bob.style.transform = tf; K.bobTf = tf; }
  }

  const A = {
    walkTo: (x1, g1, lane, extra) => Object.assign({ type: 'walk', x1, g1, lane: lane || 'free' }, extra || {}),
    jump: (dx, h, pose) => ({ type: 'jump', ms: 900, dx: dx || 0, height: h || .4, pose: pose || 'jumpjoy' }),
    pose: (pose, ms, extra) => Object.assign({ type: 'pose', pose, ms }, extra || {}),
    talk: (pose, ms, text, extra) => Object.assign({ type: 'talk', pose, ms, say: text || '', sayMs: Math.max(1500, ms) }, extra || {}),
    seq: (poses, every, ms, extra) => Object.assign({ type: 'seq', poses, every, ms }, extra || {}),
    wait: ms => ({ type: 'wait', ms })
  };
  function doNow(list, busyMs) {
    if (K.leaping) {   // interrupted mid-hop: land where it was heading
      const a = K.act; K.leaping = false; K.y = 0;
      if (a && a.x1 !== undefined) { K.x = a.x1; K.ground = a.g1; K.lane = a.lane; K.cell = a.cell || null; }
      if (K.lane !== 'grid') ghost(false);
    }
    if (K.act && K.act.type === 'walk' && K.act.tx !== undefined && K.act.st / (STEP.ms / 1000) < STEP.move) { K.x = K.act.sx; K.ground = K.act.sg; }   // put the foot back down
    K.queue = list.slice(); K.act = null; K.y = 0; K.lift = 0; K.angry = false;
    if (K.zoom > 1.02 && !(K.queue[0] && K.queue[0].type === 'zoom')) K.queue.unshift({ type: 'zoom', to: 1, ms: 320 });
    K.busyUntil = performance.now() + (busyMs || 0); K.nextBrain = performance.now() + (busyMs || 1500) + rnd(600, 1400);
  }

  /* ---------- a calm friend: lives at his home spot, rests, sleeps when the player rests ---------- */
  const SLEEP_AFTER = 10000;     // no touch for 10 s: he lies down and sleeps
  const STRUGGLE = 35000;        // no new word for 35 s while the player keeps trying: he shows where a word starts
  const HINT_GAP = 30000;        // at most one shown word start every 30 s
  // calm variations, each held for several seconds (no flickering from picture to picture)
  const CALM = [
    () => A.pose('thumbs', 4500),
    () => A.pose('hi', 4000, { say: chat() }),
    () => A.pose('think', 5000),
    () => A.pose('sit', 7000),
    () => A.pose('cool', 5000),
    () => A.pose('giggle', 3500),
    () => A.pose('handheart', 4000, { hearts: 2 }),
    () => A.talk('cute', 3500, chat())
  ];
  function chat() {
    const now = performance.now();
    if (now - K.lastChat < 20000 || Math.random() < .5) return '';
    K.lastChat = now; return pick(CHAT);
  }
  const call = fn => ({ type: 'call', fn });
  const dist = (x, g) => Math.hypot(K.x - x, K.ground - g);
  function atHome() { const h = K.home; return !!h && K.lane !== 'grid' && dist(h.x, h.g) < 3; }
  function homeOnLetters() {
    const h = K.home, ib = K.innerBox; if (!h || !ib) return false;
    const cx = h.x + K.w / 2, hw = K.charH * .35;
    return !(cx + hw <= ib.left || cx - hw >= ib.right || h.g <= ib.top || h.g - K.charH >= ib.bottom);
  }
  function crossesLetters(x1, g1) {        // would a straight walk pass over the letters?
    const ib = K.innerBox; if (!ib) return false;
    for (let i = 1; i < 12; i++) {
      const t = i / 12, x = K.x + (x1 - K.x) * t + K.w / 2, g = K.ground + (g1 - K.ground) * t;
      if (x > ib.left && x < ib.right && g > ib.top && g - K.charH * .5 < ib.bottom) return true;
    }
    return false;
  }
  // back home: hop off the letters, then walk – or one big hop when the way home crosses the letters
  function routeHome() {
    const h = K.home;
    if (K.lane === 'grid') K.lane = 'free';
    if (dist(h.x, h.g) < 3) { K.lane = h.bot ? 'bot' : 'free'; K.depth = h.bot ? 1 : depthAt(h.g); K.onHint = false; return []; }
    return [A.walkTo(h.x, h.g, h.bot ? 'bot' : 'free'), call(routeHome)];
  }
  const goHome = () => call(routeHome);
  // a few steps away from his place and back, right where the player put him
  function homeStroll() {
    const h = K.home; if (!h) return null;
    for (const dir of Math.random() < .5 ? [1, -1] : [-1, 1]) {
      const x = clampX(h.x + dir * rnd(.8, 1.6) * K.charH);
      if (Math.abs(x - h.x) < K.charH * .5 || crossesLetters(x, h.g)) continue;
      const lane = h.bot ? 'bot' : 'free';
      return [A.walkTo(x, h.g, lane, { stepMs: 420 }), A.pose(pick(['think', 'magnify', 'hi', 'cute']), 2200), A.walkTo(h.x, h.g, lane, { stepMs: 420 })];
    }
    return null;
  }

  function sleepNow() {
    K.sleeping = true; K.nextZ = performance.now() + 900;
    K.queue.push(A.pose('sleep', 1e12, { say: Math.random() < .3 ? 'Nalala kidogo… Niamshe!' : '', sayMs: 2200 }));
  }
  function wake(quiet) {
    if (!K.sleeping) return false;
    K.sleeping = false; K.lastWake = performance.now();
    if (K.act && K.act.pose === 'sleep') K.act = null;
    if (!quiet) doNow([A.pose('oh', 1100, { fx: 'bounce', say: Math.random() < .5 ? pick(['Lo! Nimeamka!', 'Habari! Niko hapa!', 'Aah… nimeamka!']) : '', sayMs: 1500 })], 1100);
    return true;
  }
  function zzz(now) {
    if (!K.sleeping || !K.act || K.act.pose !== 'sleep' || now < K.nextZ || REDUCED) return;
    K.nextZ = now + 1900;
    hearts(1, 'z', ['#60a5fa', '#93c5fd', '#3b82f6']);
  }

  function brain(now) {
    if (K.act && K.act.calm && !K.queue.length && now - K.lastTouch > SLEEP_AFTER) K.act = null;   // time to sleep: the calm pose may end early
    if (K.drag || K.act || K.queue.length) return;
    if (K.zoom > 1.02) { K.queue.push({ type: 'zoom', to: 1, ms: 500 }); return; }
    if (!atHome()) { K.queue.push(goHome()); return; }
    K.onHint = false;
    const idle = now - K.lastTouch;
    if (K.sleeping || idle > SLEEP_AFTER) { sleepNow(); return; }
    // the player keeps trying but finds nothing: he goes and shows where a word starts
    if (now - K.lastHint > HINT_GAP && ((now - K.lastFind > STRUGGLE && idle < 8000) || K.wrongStreak >= 3)) { if (hintVisit()) return; }
    if (now < K.nextVar) return;              // standing calmly, breathing, looking at the player
    K.nextVar = now + rnd(9000, 15000);
    if (Math.random() < .4 && !REDUCED) { const st = homeStroll(); if (st) { K.queue.push(...st); return; } }
    const c = pick(CALM)(); c.calm = true; K.queue.push(c);
  }

  // ---------- the boxes ----------
  const neighbours = (r, c) => [[r, c + 1], [r, c - 1], [r + 1, c], [r - 1, c]].filter(([a, b]) => a >= 0 && b >= 0 && a < K.grid.n && b < K.grid.n);
  function freeCells() { try { const f = K.host.grid().free; return f && f.length ? f : null; } catch (_) { return null; } }
  function steps(from, to, max) {          // box-by-box path (row first, then column)
    const out = []; let [r, c] = from;
    while ((r !== to[0] || c !== to[1]) && out.length < (max || 7)) {
      if (c !== to[1]) c += Math.sign(to[1] - c); else r += Math.sign(to[0] - r);
      out.push([r, c]);
    }
    return out;
  }
  const stepTo = cell => ({ type: 'leap', lane: 'grid', cell, ms: 560, h: .12, step: true });
  // the nearest spot off the letters: the top edge if it is closer, otherwise under the board
  function stepOff(sayText) {
    const ib = K.innerBox;
    const feet = K.ground, toTop = ib ? Math.abs(feet - K.boardTop) < Math.abs(K.gBot - feet) : false;
    if (toTop && K.topEdgeOk) return { type: 'leap', lane: 'free', x1: clampX(K.x), g1: K.boardTop + 3 * K.d, ms: 700, h: .45, say: sayText || '' };
    return { type: 'leap', lane: 'bot', ms: 750, h: .5, say: sayText || '' };
  }
  function onBody(px, py) {
    const sc = S(), hw = K.charH * .85 * sc, hh = K.charH * .95 * sc, cx = K.x + K.w / 2, feet = K.ground + K.sink - K.y;
    return px >= cx - hw / 2 && px <= cx + hw / 2 && py >= feet - hh && py <= feet;
  }
  function overLetters() {
    const ib = K.innerBox; if (!ib) return false;
    const sc = S(), hw = K.charH * .7 * sc, cx = K.x + K.w / 2, feet = K.ground + K.sink;
    return !(cx + hw / 2 <= ib.left || cx - hw / 2 >= ib.right || feet <= ib.top || feet - K.charH * sc >= ib.bottom);
  }
  function offLetters() { return []; }        // reactions happen right where he is; then he walks home

  // ---------- showing where a hidden word starts: walks onto the boxes and points at its first letter ----------
  function hintVisit() {
    if (!K.grid || REDUCED) return false;
    let starts = []; try { starts = (K.host.starts && K.host.starts()) || []; } catch (_) {}
    if (!starts.length) return false;
    const g = K.grid, above = K.ground <= g.top;
    const entryRow = above ? 0 : g.n - 1;
    const cx = Math.max(0, Math.min(g.n - 1, Math.floor((K.x + K.w / 2 - g.left) / g.cs)));
    const cost = ([r, c]) => Math.abs(r - entryRow) + Math.abs(c - cx) * .6;
    const target = starts.slice().sort((a, b) => cost(a) - cost(b))[0];          // the word start that is quickest to reach
    const free = freeCells() || [], isFree = ([a, b]) => free.some(([x, y]) => x === a && y === b);
    const nb = neighbours(target[0], target[1])
      .sort((p, q) => (isFree(q) - isFree(p)) || (Math.abs(p[0] - entryRow) - Math.abs(q[0] - entryRow)))[0] || target;
    K.lastHint = performance.now(); K.wrongStreak = 0; K.onHint = true;
    const entry = [entryRow, nb[1]], colX = clampX(g.left + (nb[1] + .5) * g.cs - K.w / 2);
    const spot = cellPos(nb[0], nb[1]);
    const list = [A.walkTo(spot.x, spot.g, 'free', { stepMs: 230, say: pick(['Nifuate!', 'Ngoja, nakuonyesha!', 'Nimeona kitu!']), sayMs: 1600, onEnd: () => { K.cell = nb; } })];
    void entry; void colX;
    const tx = g.left + (target[1] + .5) * g.cs;
    list.push(A.pose('point', 3400, { fx: 'bounce', say: pick(['Anza hapa!', 'Neno linaanza hapa!', 'Tazama herufi hii!']), sayMs: 3000,
      onStart: () => { K.face = tx >= K.x + K.w / 2 ? 1 : -1; try { K.host.flashCell ? K.host.flashCell(target[0], target[1]) : K.host.softHint(); } catch (_) {} } }));
    list.push(A.wait(400), goHome());
    K.queue.push(...list);
    return true;
  }

  // ---------- put down on the letters: a slow little walk there, then back home ----------
  function strollOnLetters() {
    const ib = K.innerBox, out = [A.pose('oh', 900, { say: pick(['Lo! Herufi nyingi!', 'Hapa kuna maneno!']), sayMs: 1400 })];
    let x = K.x, g = K.ground;
    for (let i = 0; i < 3; i++) {
      x = Math.max(ib.left - K.w * .4, Math.min(ib.right - K.w * .6, x + rnd(-1, 1) * K.charH * .9));
      g = Math.max(ib.top + K.charH * .6, Math.min(ib.bottom, g + rnd(-.5, .5) * K.charH));
      out.push(A.walkTo(x, g, 'free', { stepMs: 400 }), A.pose(pick(['magnify', 'think', 'question']), 1600));
    }
    out.push(goHome());
    return out;
  }

  /* ---------- reactions to the game (in place, looking at the player) ---------- */
  const Kin = {
    init(host) {
      if (K.ready || !host) return;
      K.host = host;
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const layer = document.createElement('div'); layer.className = 'kin-layer'; layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<div class="kin"><div class="kin-bob"><div class="kin-fx"><div class="kin-spr"></div></div></div></div><div class="kin-hit"></div><div class="kin-say"></div>';
      (host.parent || document.body).appendChild(layer);
      Object.assign(K, { layer, el: layer.querySelector('.kin'), bob: layer.querySelector('.kin-bob'), fxEl: layer.querySelector('.kin-fx'), spr: layer.querySelector('.kin-spr'),
        hit: layer.querySelector('.kin-hit'), bubble: layer.querySelector('.kin-say') });
      layer.style.visibility = 'hidden';
      // press: tap = a reaction; press and move = carry Kinyonga somewhere else
      K.hit.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        K.press = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { K.hit.setPointerCapture(e.pointerId); } catch (_) {}
        const pr = K.press;     // held still for a moment: picked up as well
        pr.t = setTimeout(() => { if (K.press === pr && !K.drag) { K.press = null; startDrag(pr.x, pr.y, pr.id); } }, 450);
      });
      addEventListener('pointermove', e => {
        if (K.drag && e.pointerId === K.drag.id) { moveDrag(e.clientX, e.clientY); return; }
        if (K.press && e.pointerId === K.press.id && Math.hypot(e.clientX - K.press.x, e.clientY - K.press.y) > 7) { clearTimeout(K.press.t); startDrag(K.press.x, K.press.y, e.pointerId); K.press = null; moveDrag(e.clientX, e.clientY); return; }
        // finger on him over the letters and moving: he is picked up (the letter selection under him is cancelled)
        if (K.lp && e.pointerId === K.lp.id && Math.hypot(e.clientX - K.lp.x, e.clientY - K.lp.y) > 7) {
          const lp = K.lp; clearTimeout(lp.t); K.lp = null;
          try { K.host.cancelSelection && K.host.cancelSelection(); } catch (_) {}
          startDrag(lp.x, lp.y, lp.id); moveDrag(e.clientX, e.clientY);
        }
      }, { passive: true });
      const up = e => {
        if (K.ghostHold) { K.ghostHold = false; clearTimeout(K.ghostT); K.ghostT = setTimeout(() => { if (!K.drag && K.lane !== 'grid' && !K.leaping) ghost(false); }, 700); }
        if (K.drag && e.pointerId === K.drag.id) { endDrag(); return; }
        if (K.press && e.pointerId === K.press.id) { clearTimeout(K.press.t); K.press = null; if (e.type === 'pointerup') Kin.tap(); return; }
        if (K.lp && e.pointerId === K.lp.id) { clearTimeout(K.lp.t); K.lp = null; if (e.type === 'pointerup') Kin.tap(); }
      };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
      // a finger on his body where the touch area is off (on the boxes, in the middle of a hop) still presses him:
      // move = carry him, short tap = a reaction. Real buttons under him keep working.
      addEventListener('pointerdown', e => {
        if (!K.ready || K.drag || K.press || e.target === K.hit || K.layer.style.display === 'none' || K.layer.style.visibility === 'hidden') return;
        if (K.host.isPlaying && !K.host.isPlaying()) return;
        if (e.target.closest && e.target.closest('button,a,input,[role=button]')) return;
        if (!onBody(e.clientX, e.clientY)) return;
        clearTimeout(K.lp && K.lp.t);
        K.lp = { id: e.pointerId, x: e.clientX, y: e.clientY };
        K.lp.t = setTimeout(() => {
          if (!K.lp) return; const lp = K.lp; K.lp = null;
          try { K.host.cancelSelection && K.host.cancelSelection(); } catch (_) {}
          startDrag(lp.x, lp.y, lp.id);
        }, 380);
      }, true);
      // the sprite sheets must be loaded before Kinyonga shows up
      const need = [META.front.url, META.poses.url];
      let n = 0; const done = () => { if (++n === need.length) { K.ready = true;
          const cl = new Image(); cl.onload = () => { K.closeReady = true; }; cl.src = META.close.url;
          const wk = new Image(); wk.onload = () => { K.walkReady = true; }; wk.src = META.walk.url;   /* walking cycle; if it is missing he walks with the front pictures */
          K.x = rnd(10, 60); layout(); layer.style.visibility = ''; loop(); } };
      need.forEach(u => { const im = new Image(); im.onload = done; im.onerror = () => { layer.remove(); }; im.src = u; });
      addEventListener('resize', () => layout());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { K.last = 0; loop(); } });
    },
    layout,
    activity(fromEvent) {
      K.lastTouch = performance.now();
      if (!K.ready || K.drag) return;
      wake(!!fromEvent);
      if (fromEvent || K.angry) return;
      if (K.lane === 'grid' || overLetters() || (K.leaping && K.act && K.act.lane === 'grid')) {
        ghost(true); K.ghostHold = true; clearTimeout(K.ghostT);      // the letters under him stay readable and selectable
        if (!K.onHint && !atHome()) doNow([goHome()], 600);
      }
    },
    onLevelStart(first) {
      K.lastTouch = K.lastFind = performance.now(); K.wrongStreak = 0;
      if (!K.ready) return;
      wake(true);
      if (K.lane === 'grid' || K.leaping) { K.leaping = false; K.lane = 'bot'; K.cell = null; ghost(false); }
      K.onHint = false;
      layout();
      const r = Math.random();
      const text = first ? SAY.greet[0] : r < .3 ? pick(SAY.greet) : '';
      doNow([A.talk('hi', 2400, text)], 2400);
      K.nextVar = performance.now() + rnd(9000, 14000);
    },
    onCorrect() {
      K.lastTouch = K.lastFind = performance.now(); K.wrongStreak = 0;
      if (!K.ready) return; wake(true);
      const r = Math.random();
      const list = r < .35 ? [A.pose('cheer', 2000, { fx: 'bounce' })]
                 : r < .7 ? [A.pose('thumbs', 2000, { fx: 'bounce' })]
                 : [A.pose('yay', 1800, { fx: 'bounce' })];
      if (Math.random() < .65) list[0].say = pick(SAY.correct);
      K.onHint = false;
      doNow(offLetters().concat(list, [goHome()]), 2000);
    },
    onBonus() { if (!K.ready) return; wake(true); doNow(offLetters().concat([A.pose('magnify', 1800, { fx: 'wobble', say: 'Neno la ziada! Safi!' }), goHome()]), 1800); },
    onWrong() {
      K.lastTouch = performance.now(); K.wrongStreak++;
      if (!K.ready) return; wake(true);
      if (K.onHint) return;                               // he is already on his way to help
      const r = Math.random();
      const list = r < .45 ? [A.pose('giggle', 2000, { fx: 'shake', say: Math.random() < .7 ? pick(SAY.wrong) : '' })]
                 : r < .7 ? [A.pose('tease', 1800, { fx: 'wobble', say: 'Hehe! Si hilo!' })]
                 : [A.pose('thumbs', 2000, { say: pick(['Jaribu tena!', 'Umekaribia!', 'Unaweza!']) })];
      doNow(offLetters().concat(list, [goHome()]), 2000);
    },
    onWin() {
      if (!K.ready) return; wake(true); K.onHint = false;
      doNow([A.pose('party', 1800, { fx: 'bounce', say: pick(SAY.win), sayMs: 2400 }), A.pose('cheer', 1500), A.pose('tada', 1200), goHome()], 3500);
    },
    tap() {
      if (!K.ready || K.y > 2) return;
      K.lastTouch = performance.now();
      try { K.host.sfx && K.host.sfx.select && K.host.sfx.select(); } catch (_) {}
      if (wake(false)) return;                            // a tap on a sleeping Kinyonga wakes him up
      if (K.angry) return;
      const tnow = performance.now();
      // five taps within 12 seconds (even when the player waits to watch each reaction): he gets cross
      K.tapTimes = (K.tapTimes || []).filter(t => tnow - t < 12000); K.tapTimes.push(tnow);
      if (K.tapTimes.length >= 5 && tnow - (K.lastAngry || -1e9) > 15000) { angry(); return; }
      const now = performance.now();
      const T = SAY.tap, choices = [
        () => [A.pose('shy', 2000, { say: T.shy, hearts: 2 })],
        () => [A.pose('kiss', 2000, { fx: 'bounce', say: T.kiss, hearts: 4 })],
        () => [A.pose('inlove', 2000, { fx: 'bounce', say: T.inlove, hearts: 3 })],
        () => [A.pose('handheart', 2000, { say: T.handheart, hearts: 3 })],
        () => [A.pose('tease', 1800, { fx: 'wobble', say: T.tease })],
        () => [A.pose('wow', 1800, { fx: 'shake', say: T.wow })],
        () => [A.pose('cool', 2000, { say: T.cool })],
        () => [A.pose('yay', 2000, { fx: 'bounce', say: T.yay })]
      ];
      let i; do { i = Math.floor(Math.random() * choices.length); } while (i === K.lastTap && choices.length > 1);
      K.lastTap = i;
      doNow(choices[i](), 2000);
      K.nextVar = now + rnd(9000, 14000);
    },
    // a finger went down on the letter board: if it is on Kinyonga, a long press picks him up
    // the letter board asks: is this finger pressing Kinyonga? (then it is not the start of a letter swipe)
    boardDown(e) { return !!(K.lp && K.lp.id === e.pointerId); },
    // exposed for tests
    _K: K, _say: say, _hint: () => hintVisit(), _over: () => overLetters(), _home: () => K.home, _angry: () => angry()
  };

  /* ---------- tapped too much: he walks up to the camera, grows big, looks cross, sticks his tongue out ---------- */
  function angry() {
    const Z = Math.max(1.8, Math.min(2.5, innerHeight * .3 / K.charH));
    const cx = innerWidth / 2 - K.w / 2;
    doNow([
      A.pose('oh', 700, { say: 'Acha!', sayMs: 900 }),
      A.walkTo(cx, K.gBot, 'bot', { stepMs: 230 }),
      { type: 'zoom', to: Z, ms: 1500, walking: true, onStart: () => { K.face = 1; } },
      A.pose('angry', 2200, { fx: 'angry', hearts: 3, glyph: '💢', say: pick(['Inatosha! Acha kunigusa!', 'Wee! Inatosha!', 'Acha basi!']), sayMs: 2200 }),
      A.pose('tease', 1900, { fx: 'wobble', say: 'Bleee! 😛', sayMs: 1800 }),
      { type: 'zoom', to: 1, ms: 1100, walking: true, onEnd: () => { K.angry = false; } },
      goHome()
    ], 9000);
    K.angry = true; K.lastAngry = performance.now(); K.tapTimes = [];
  }

  /* ---------- carrying Kinyonga with a finger ---------- */
  function startDrag(px, py, id) {
    const feet = K.ground + K.sink;
    wake(true);
    doNow([], 0); K.queue = [];
    K.leaping = false; K.zoom = 1; K.sink = 0; K.y = 0; K.lift = 0; ghost(false); K.ghostHold = false; K.onHint = false;
    K.lane = 'free'; K.cell = null;
    K.drag = { id, ox: K.x + K.w / 2 - px, oy: feet - py, lx: px };
    K.act = start({ type: 'drag', pose: 'wow', ms: 1e12, fx: 'wobble', say: pick(DRAG_SAY), sayMs: 1600 });
    K.lastTouch = performance.now();
  }
  function moveDrag(px, py) {
    const d = K.drag; if (!d) return;
    const sc = S();
    const minG = Math.max(K.charH * sc + 4, 0), maxG = K.gBot;
    K.x = clampX(px + d.ox - K.w / 2);
    K.ground = Math.max(minG, Math.min(maxG, py + d.oy));
    K.depth = depthAt(K.ground);
    if (Math.abs(px - d.lx) > 3) { K.face = Math.sign(px - d.lx); d.lx = px; }
  }
  function endDrag() {
    K.drag = null; K.act = null;
    const bot = K.ground >= K.gBot - K.charH * .15;
    if (bot) { K.lane = 'bot'; K.ground = K.gBot; K.depth = 1; } else K.lane = 'free';
    K.lastTouch = performance.now(); K.nextVar = performance.now() + rnd(9000, 13000);
    if (!bot && overLetters()) { K.queue = strollOnLetters(); return; }     // on the letters: a slow walk, then back home
    K.home = { x: K.x, g: K.ground, bot };                                // anywhere else: this is his new home
    K.face = K.x + K.w / 2 < innerWidth / 2 ? 1 : -1;
    K.queue = [A.pose('tada', 1800, { fx: 'bounce', say: pick(DROP_SAY), sayMs: 1800 })].concat(homeStroll() || []);
  }

  /* ---------- main loop ---------- */
  function loop() {
    if (K.raf || !K.ready) return;
    const tick = now => {
      K.raf = 0;
      if (document.hidden) return;
      const playing = K.host.isPlaying ? K.host.isPlaying() : true;
      if (!playing) { K.raf = requestAnimationFrame(tick); return; }
      if (LITE && K.last && now - K.last < 30) { K.raf = requestAnimationFrame(tick); return; }
      const dt = K.last ? Math.min(.06, (now - K.last) / 1000) : 0; K.last = now;
      update(dt); brain(now); zzz(now);
      bobAnim(dt); draw(); place();
      K.raf = requestAnimationFrame(tick);
    };
    K.raf = requestAnimationFrame(tick);
  }

  window.Kinyonga = Kin;
})();
