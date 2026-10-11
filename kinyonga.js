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

  const VER = 2;   // sprite sheet version (bump when the .webp files change)
  const META = {
    cell: [176, 140], charPx: 112,                 // side frames: character ~106px tall inside a 176×140 cell
    anim: { cols: 12, url: 'images/kinyonga-anim.webp?v=' + VER, seq: { jump: [21, 22, 23, 24, 25, 26, 27, 28, 29] } },
    front: { cols: 8, cell: [250, 210], foot: 6, h: 188, url: 'images/kinyonga-front.webp?v=' + VER, index: {
      wave: 0, thumbs: 1, cheer: 2, yay: 3, stepL: 4, stepR: 5, dash: 6, hello: 7, wide: 8, love: 9, kiss: 10, inlove: 11,
      idea: 12, oh: 13, magnify: 14, map: 15, question: 16, think: 17, cool: 18, hi: 19, fall: 20, slip: 21, cry: 22, sob: 23,
      sad: 24, sleep: 25, laughpoint: 26, tease: 27, wow: 28, giggle: 29, dance: 30, party: 31, jumpjoy: 32, shy: 33, kiss2: 34,
      shy2: 35, cute: 36, hearts: 37, handheart: 38, point: 39, tada: 40 } },
    poses: { cols: 6, url: 'images/kinyonga-poses.webp?v=' + VER, index: { sit: 17 } },
    close: { cols: 4, url: 'images/kinyonga-close.webp?v=' + VER, index: { point: 0, winkwalk: 1, cheer: 2, kiss: 3, laughpoint: 4, magnify: 5, think: 6, shock: 7 } }
  };
  // when he is close to the camera the sharp close-up pictures are used
  const CLOSE_OF = { point: 'point', hi: 'winkwalk', wave: 'winkwalk', hello: 'winkwalk', tada: 'winkwalk', cheer: 'cheer', yay: 'cheer', party: 'cheer',
    kiss: 'kiss', kiss2: 'kiss', love: 'kiss', laughpoint: 'laughpoint', giggle: 'laughpoint', tease: 'laughpoint', magnify: 'magnify',
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
  @keyframes kinBounce{0%{transform:translateY(0) scale(1,1)}30%{transform:translateY(-14px) scale(.95,1.06)}60%{transform:translateY(0) scale(1.06,.94)}100%{transform:translateY(0) scale(1,1)}}
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
    pinned: null, hangLeft: 0, lastFun: '', idlePose: 'cute', ghosted: false
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
    const m = kind === 'a' ? META.anim : kind === 'c' ? META.close : META.poses, k = kind === 'p' ? 1.2 : 1;
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
    const hw = K.charH * .85 * sc, hh = K.charH * .95 * sc;
    const hx = K.x + K.w / 2 - hw / 2, hy = feet - K.y - hh;
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
    K.charH = Math.max(44, Math.min(82, space));
    K.gridDepth = Math.min(1, cs * 1.25 / K.charH);
    const sameGrid = K.grid && gi && K.grid.n === gi.n;
    K.grid = gi && gi.n ? { left: inner.left, top: inner.top, cs, n: gi.n } : null;
    K.d = K.charH / META.charPx;
    K.w = META.cell[0] * K.d; K.h = META.cell[1] * K.d;
    K.gBot = ground + 3 * K.d;
    const topLimit = K.host.topLimit ? K.host.topLimit() : 0;
    K.protect = (K.host.protect ? K.host.protect() : []).filter(r => r && r.width).map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
    K.protect.push({ left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom });
    K.freeTop = topLimit + K.charH * .8;            // highest the feet may go: the head stays under the word card
    K.boardTop = board.top; K.innerBox = { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom };
    K.topEdgeOk = K.boardTop - topLimit >= K.charH * .8;
    K.minX = -K.w * .12; K.maxX = innerWidth - K.w * .88;
    if (K.lane === 'grid' && !(sameGrid && K.cell)) { K.lane = 'bot'; K.cell = null; ghost(false); }
    if (K.zoom !== 1 && !(K.act && K.act.type === 'zoom')) { K.zoom = 1; K.sink = 0; }
    if (K.pinned) {                // he stays where the player put him (kept on the screen)
      K.pinned.x = Math.max(K.minX, Math.min(K.maxX, K.pinned.x));
      K.pinned.g = Math.max(K.charH + 4, Math.min(K.gBot, K.pinned.g));
      if (K.pinned.bot) K.pinned.g = K.gBot;
      if (!K.drag && !(K.act && K.act.type === 'walk')) { K.x = K.pinned.x; K.ground = K.pinned.g; K.lane = K.pinned.bot ? 'bot' : 'free'; }
    } else if (K.lane === 'free') {
      // a spot above the board stays valid only if it is still above the board
      if (!(K.ground <= K.boardTop + 6 * K.d && K.ground >= K.freeTop)) { K.lane = 'bot'; }
    }
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
  function hearts(n, glyph) {
    const sc = S();
    for (let i = 0; i < (n || 3); i++) {
      const h = document.createElement('div'); h.className = 'kin-heart'; h.textContent = glyph || '❤';
      h.style.color = pick(['#ff4d6d', '#ff8fab', '#f43f5e']);
      h.style.left = (K.x + K.w * (.45 + Math.random() * .3)) + 'px';
      h.style.top = (K.ground - K.charH * .9 * sc) + 'px';
      h.style.setProperty('--dx', rnd(-26, 26).toFixed(0) + 'px');
      h.style.animationDelay = (i * .18) + 's';
      K.layer.appendChild(h); setTimeout(() => h.remove(), 1800 + i * 200);
    }
  }
  function fx(cls) { const s = K.fxEl; s.classList.remove('kin-fx-bounce', 'kin-fx-shake', 'kin-fx-wobble'); if (!cls || REDUCED) return; void s.offsetWidth; s.classList.add(cls); }

  /* ---------- actions ---------- */
  const STEP = { ms: 440, move: .62 };     // one step: foot up and body forward (62%), then the foot is down and the body still
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
        else { if (!(a.lane === 'bot' && K.lane === 'bot')) K.lane = 'free'; nextStep(a); }
      }
      if (!done) {
        const SD = (a.stepMs || STEP.ms) / 1000;
        a.st += dt;
        if (a.st >= SD) {                               // foot is down: start the next step or stop
          K.x = a.tx; K.ground = a.tg; K.stepN++;
          if (a.last) done = true; else { const over = a.st - SD; nextStep(a); a.st = over; }
        }
        if (!done) {
          const p = a.st / SD;
          if (p < STEP.move) { const e = ease(p / STEP.move); K.x = a.sx + (a.tx - a.sx) * e; K.ground = a.sg + (a.tg - a.sg) * e; K.lift = Math.sin(p / STEP.move * Math.PI) * K.charH * .07; }
          else { K.x = a.tx; K.ground = a.tg; }
        }
      }
      if (K.lane === 'free') K.depth = depthAt(K.ground);
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
      if (a.walking) { const sp = (a.t % (STEP.ms / 1000)) / (STEP.ms / 1000); K.lift = Math.sin(sp * Math.PI) * K.charH * .05; K.stepN = Math.floor(a.t / (STEP.ms / 1000)); }
      if (p >= 1) { K.zoom = a.to; if (a.to === 1) K.sink = 0; done = true; }
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
    if (a.type === 'walk' || (a.type === 'zoom' && a.walking) || (a.type === 'leap' && a.step)) return front(K.stepN % 2 ? 'stepR' : 'stepL');
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
    K.queue = list.slice(); K.act = null; K.y = 0; K.lift = 0;
    if (K.zoom > 1.02 && !(K.queue[0] && K.queue[0].type === 'zoom')) K.queue.unshift({ type: 'zoom', to: 1, ms: 320 });
    K.busyUntil = performance.now() + (busyMs || 0); K.nextBrain = performance.now() + (busyMs || 1500) + rnd(600, 1400);
  }

  /* ---------- free time: stay in one place for a good while and play there ---------- */
  // every block faces the player: talking, laughing, joking, dancing, thinking, sitting…
  const FUN = [
    { k: 'talk', w: 3, make: () => A.talk(pick(['hi', 'cute', 'thumbs', 'wave', 'tada']), 2400, chat()) },
    { k: 'giggle', w: 1.4, make: () => A.pose('giggle', 1700, { fx: 'shake', say: Math.random() < .4 ? 'Hihihi!' : '' }) },
    { k: 'tease', w: 1, make: () => A.pose('tease', 1500, { fx: 'wobble', say: Math.random() < .5 ? 'Hehe! Nakuona!' : '' }) },
    { k: 'laughpoint', w: 1, make: () => A.pose('laughpoint', 1600, { fx: 'bounce' }) },
    { k: 'dance', w: 1.3, make: () => A.seq(['dance', 'party', 'jumpjoy', 'dance', 'cheer', 'party'], 420, 2500, { fx: 'bounce', say: Math.random() < .35 ? 'Tucheze!' : '' }) },
    { k: 'think', w: 1.2, make: () => A.pose(pick(['think', 'question', 'idea', 'magnify', 'map']), 2200, { fx: 'wobble' }) },
    { k: 'cool', w: .8, make: () => A.pose('cool', 2200, { say: Math.random() < .3 ? 'Poa sana!' : '' }) },
    { k: 'love', w: 1, make: () => { const p = pick(['handheart', 'hearts', 'love', 'kiss']); return A.pose(p, 1900, { hearts: 3, say: Math.random() < .3 ? 'Nakupenda, rafiki!' : '' }); } },
    { k: 'shy', w: .8, make: () => A.pose(pick(['shy', 'shy2', 'kiss2']), 1800) },
    { k: 'sit', w: 1.4, make: () => A.pose('sit', 3200, { say: Math.random() < .3 ? 'Nimekaa kidogo.' : '' }) },
    { k: 'calm', w: 2, make: () => A.pose(pick(['cute', 'hi', 'thumbs']), 2600) },
    { k: 'yay', w: .35, make: () => A.jump(0, .35, 'yay') }
  ];
  function chat() {
    const now = performance.now();
    if (now - K.lastChat < 9000 || Math.random() < .35) return '';
    K.lastChat = now; return pick(CHAT);
  }
  function funBlock() {
    let opts = FUN.filter(f => f.k !== K.lastFun);
    if (REDUCED) opts = opts.filter(f => f.k !== 'dance' && f.k !== 'yay');
    let sum = opts.reduce((s, f) => s + f.w, 0), r = Math.random() * sum, f = opts[0];
    for (const o of opts) { r -= o.w; if (r <= 0) { f = o; break; } }
    K.lastFun = f.k;
    return [f.make(), A.wait(rnd(500, 1200))];
  }
  function brain(now) {
    if (K.drag) return;
    if (!K.act && !K.queue.length && K.lane === 'grid' && !K.leaping) { K.queue.push(A.wait(600), stepOff()); return; }   // never parked on the boxes
    if (!K.act && !K.queue.length && K.zoom > 1.02) { K.queue.push({ type: 'zoom', to: 1, ms: 500 }); return; }
    if (K.act || K.queue.length || now < K.nextBrain) return;
    if (K.pinned || K.hangLeft > 0) { K.hangLeft--; K.queue.push(...funBlock()); return; }
    // time for a small trip, then a long stay at the new place
    const r = Math.random();
    if (!REDUCED && now - K.lastTouch > 6000 && now - K.lastZoom > 45000 && r < .18) camera();
    else if (K.grid && r < .36) gridTrip();
    else { wander(); if (!REDUCED && now - K.lastSlip > 90000 && r > .9) slip(); }
    K.hangLeft = Math.floor(rnd(4, 7));          // 4–6 play blocks ≈ 10–20 seconds in the new spot
  }

  // a new spot not far away: along the strip under the board, the top edge of the board, or the picture above it
  function region() { return K.lane === 'bot' || K.ground > (K.innerBox ? K.innerBox.bottom : 0) ? 'below' : 'above'; }
  function wander() {
    const ib = K.innerBox, W = innerWidth;
    // walk a real distance (several steps), towards the side with more room
    const dir = K.x + K.w / 2 < W / 2 ? (Math.random() < .75 ? 1 : -1) : (Math.random() < .75 ? -1 : 1);
    const near = () => { const x = clampX(K.x + dir * rnd(.22, .45) * W); return Math.abs(x - K.x) < W * .15 ? clampX(K.x - dir * rnd(.22, .4) * W) : x; };
    const tx = near();
    const spots = [['bot', 3]];
    if (ib && K.topEdgeOk) spots.push(['edge', 1.6]);
    if (ib && K.boardTop - K.freeTop > K.charH * .3) spots.push(['photo', 1.6]);
    let sum = spots.reduce((s, x) => s + x[1], 0), r = Math.random() * sum, kind = 'bot';
    for (const [k, w] of spots) { r -= w; if (r <= 0) { kind = k; break; } }
    const here = region();
    if (kind === 'bot') {
      if (here === 'above') K.queue.push(hopDown(clampX(K.x)));
      K.queue.push(A.walkTo(tx, K.gBot, 'bot'));
    } else {
      const edgeG = K.boardTop + 3 * K.d;
      if (here === 'below') K.queue.push(hopUp(clampX(K.x)));
      if (kind === 'edge') K.queue.push(A.walkTo(Math.max(ib.left - K.w * .3, Math.min(ib.right - K.w * .7, tx)), edgeG, 'free'));
      else K.queue.push(A.walkTo(tx, rnd(K.freeTop, K.boardTop - 4), 'free'));
    }
  }
  // a big hop over the letters (quick, in the air – never stands on the words)
  function hopUp(x) { return { type: 'leap', lane: 'free', x1: x, g1: K.boardTop + 3 * K.d, ms: 1000, h: .7, say: Math.random() < .25 ? 'Hop!' : '' }; }
  function hopDown(x) { return { type: 'leap', lane: 'bot', x1: x, ms: 950, h: .5 }; }
  // the nearest spot off the letters: the top edge if it is closer, otherwise under the board
  function stepOff(sayText) {
    const ib = K.innerBox;
    const feet = K.ground, toTop = ib ? Math.abs(feet - K.boardTop) < Math.abs(K.gBot - feet) : false;
    if (toTop && K.topEdgeOk) return { type: 'leap', lane: 'free', x1: clampX(K.x), g1: K.boardTop + 3 * K.d, ms: 700, h: .45, say: sayText || '' };
    return { type: 'leap', lane: 'bot', ms: 750, h: .5, say: sayText || '' };
  }
  function overLetters() {
    const ib = K.innerBox; if (!ib) return false;
    const sc = S(), hw = K.charH * .7 * sc, cx = K.x + K.w / 2, feet = K.ground + K.sink;
    return !(cx + hw / 2 <= ib.left || cx - hw / 2 >= ib.right || feet <= ib.top || feet - K.charH * sc >= ib.bottom);
  }

  // ---------- on the letter boxes: step from box to box, sit, chat, then hop back down ----------
  const neighbours = (r, c) => [[r, c + 1], [r, c - 1], [r + 1, c], [r - 1, c]].filter(([a, b]) => a >= 0 && b >= 0 && a < K.grid.n && b < K.grid.n);
  function freeCells() { try { const f = K.host.grid().free; return f && f.length ? f : null; } catch (_) { return null; } }
  function steps(from, to, max) {
    const out = []; let [r, c] = from;
    while ((r !== to[0] || c !== to[1]) && out.length < (max || 7)) {
      if (c !== to[1]) c += Math.sign(to[1] - c); else r += Math.sign(to[0] - r);
      out.push([r, c]);
    }
    return out;
  }
  const stepTo = cell => ({ type: 'leap', lane: 'grid', cell, ms: 560, h: .12, step: true });
  function enterGrid() {
    const g = K.grid, cx = K.x + K.w / 2;
    const c = Math.max(0, Math.min(g.n - 1, Math.floor((cx - g.left) / g.cs)));
    const above = region() === 'above', r = above ? 0 : g.n - 1;
    const colX = g.left + (c + .5) * g.cs - K.w / 2, list = [];
    if (!above) list.push(A.walkTo(colX, K.gBot, 'bot')); else list.push(A.walkTo(colX, K.ground, 'free'));
    list.push({ type: 'leap', lane: 'grid', cell: [r, c], ms: 800, h: .5 });
    return { at: [r, c], list };
  }
  function gridTrip(target, then) {
    if (!K.grid) return false;
    let at, list = [];
    if (K.lane === 'grid' && K.cell) at = K.cell; else { const e = enterGrid(); at = e.at; list = e.list; }
    const free = freeCells() || [];
    const goal = target || (free.length ? pick(free) : at);
    for (const st of steps(at, goal, target ? 7 : 3)) list.push(stepTo(st));
    list.push(...(then || [A.pose('sit', 1800), A.talk('hi', 1600, pick(CHAT)), stepOff()]));
    K.queue.push(...list);
    return true;
  }
  function offGrid(sayText) { return !K.pinned && (K.lane === 'grid' || K.leaping || overLetters()) ? [stepOff(sayText)] : []; }

  // ---------- coming up to the camera: walks to the middle, grows big, looks the player in the eye ----------
  const CAMERA = [['hi', 'Nakuona!'], ['kiss', 'Nakupenda, rafiki!'], ['laughpoint', 'Hehe! Ni mimi tena!'], ['point', 'Wewe ni hodari!'], ['cheer', 'Twende tena!']];
  function camera() {
    const Z = Math.max(1.7, Math.min(2.6, innerHeight * .32 / K.charH));
    const [p1, s1] = pick(CAMERA), [p2, s2] = pick(CAMERA.filter(c => c[0] !== p1));
    K.lastZoom = performance.now();
    if (region() === 'above') K.queue.push(hopDown(clampX(K.x)));
    K.queue.push(A.walkTo(innerWidth / 2 - K.w / 2, K.gBot, 'bot'),
      { type: 'zoom', to: Z, ms: 1800, walking: true },
      A.pose(p1, 1800, { say: s1, sayMs: 1800, hearts: p1 === 'kiss' ? 4 : 0 }),
      A.pose(p2, 1600, { say: s2, sayMs: 1600, hearts: p2 === 'kiss' ? 4 : 0 }),
      { type: 'zoom', to: 1, ms: 1100, pose: 'hi' });
  }
  function slip() {          // trips over, sits up crying a little, gets back up – all in place
    K.lastSlip = performance.now();
    K.queue.push(A.pose('slip', 700, { fx: 'shake', say: pick(SAY.slip), sayMs: 1200 }),
      A.pose('fall', 1300, { fx: 'wobble' }),
      A.pose('sob', 1300),
      A.pose('sad', 1100, { say: pick(SAY.up), sayMs: 1800 }),
      A.jump(0, .35, 'yay'));
  }

  /* ---------- reactions to the game (always in place, looking at the player) ---------- */
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
      });
      addEventListener('pointermove', e => {
        if (K.drag && e.pointerId === K.drag.id) { moveDrag(e.clientX, e.clientY); return; }
        if (K.press && e.pointerId === K.press.id && Math.hypot(e.clientX - K.press.x, e.clientY - K.press.y) > 7) { startDrag(K.press.x, K.press.y, e.pointerId); K.press = null; moveDrag(e.clientX, e.clientY); return; }
        if (K.lp && e.pointerId === K.lp.id && Math.hypot(e.clientX - K.lp.x, e.clientY - K.lp.y) > 10) { clearTimeout(K.lp.t); K.lp = null; Kin.activity(); }   // it was a letter swipe after all
      }, { passive: true });
      const up = e => {
        if (K.ghostHold) { K.ghostHold = false; clearTimeout(K.ghostT); K.ghostT = setTimeout(() => { if (!K.drag && K.lane !== 'grid' && !K.leaping) ghost(false); }, 700); }
        if (K.drag && e.pointerId === K.drag.id) { endDrag(); return; }
        if (K.press && e.pointerId === K.press.id) { K.press = null; if (e.type === 'pointerup') Kin.tap(); return; }
        if (K.lp && e.pointerId === K.lp.id) { clearTimeout(K.lp.t); K.lp = null; if (e.type === 'pointerup') Kin.tap(); }
      };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
      // the sprite sheets must be loaded before Kinyonga shows up
      const need = [META.front.url, META.poses.url];
      let n = 0; const done = () => { if (++n === need.length) { K.ready = true;
          const cl = new Image(); cl.onload = () => { K.closeReady = true; }; cl.src = META.close.url; K.x = rnd(10, 60); layout(); layer.style.visibility = ''; loop(); } };
      need.forEach(u => { const im = new Image(); im.onload = done; im.onerror = () => { layer.remove(); }; im.src = u; });
      addEventListener('resize', () => layout());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { K.last = 0; loop(); } });
    },
    layout,
    activity(fromEvent) {
      K.lastTouch = performance.now();
      if (!fromEvent && K.ready && !K.drag) {
        if (K.pinned && (overLetters() || K.zoom > 1.02)) {      // he stays, but lets the player see the letters under him
          ghost(true); K.ghostHold = true; clearTimeout(K.ghostT);
        } else if (!K.pinned && (K.lane === 'grid' || K.zoom > 1.02 || overLetters() || (K.leaping && K.act && K.act.lane === 'grid'))) {
          K.hintStage = 0; ghost(true); doNow([stepOff(Math.random() < .5 ? 'Samahani! Nakupisha!' : '')], 900); K.hangLeft = 3; return;
        }
      }
      const sleeping = K.hintStage >= 4 && K.act && K.act.pose === 'sleep';
      K.hintStage = 0;
      if (sleeping) doNow([A.pose('wow', 1100, { fx: 'bounce', say: 'Lo! Nimeamka!', sayMs: 1500 })], 1100);
    },
    onLevelStart(first) {
      Kin.activity(true); if (!K.ready) return;
      if (K.lane === 'grid' || K.leaping) { K.leaping = false; K.lane = 'bot'; K.cell = null; ghost(false); }
      layout();
      doNow([A.talk('hi', 2000, first ? SAY.greet[0] : (Math.random() < .4 ? pick(SAY.greet) : ''))], 2000);
      K.hangLeft = Math.max(K.hangLeft, 3);
    },
    onCorrect() {
      Kin.activity(true); if (!K.ready) return; const off = offGrid();
      const r = Math.random();
      const list = r < .3 ? [A.jump(0, .5, 'jumpjoy'), A.pose('cheer', 900, { fx: 'bounce' })]
                 : r < .55 ? [A.seq(['party', 'dance', 'party'], 380, 1300, { fx: 'bounce' })]
                 : r < .8 ? [A.pose('thumbs', 1300, { fx: 'bounce' })]
                 : [A.jump(0, .45, 'yay'), A.pose('tada', 900)];
      if (Math.random() < .6) list[0].say = pick(SAY.correct);
      doNow(off.concat(list), 1600);
    },
    onBonus() { if (!K.ready) return; doNow(offGrid().concat([A.pose('magnify', 1300, { fx: 'wobble', say: 'Neno la ziada! Safi!' })]), 1300); },
    onWrong() {
      Kin.activity(true); if (!K.ready) return; const off = offGrid();
      const r = Math.random();
      const list = r < .4 ? [A.pose('giggle', 1400, { fx: 'shake' })] : r < .7 ? [A.pose('laughpoint', 1400, { fx: 'bounce' })] : [A.pose('tease', 1400, { fx: 'wobble' })];
      if (Math.random() < .7) list[0].say = pick(SAY.wrong);
      doNow(off.concat(list), 1400);
    },
    onWin() {
      if (!K.ready) return;
      doNow([...offGrid(), A.jump(0, .55, 'jumpjoy'), A.seq(['party', 'dance', 'cheer', 'party'], 400, 1600, { fx: 'bounce', say: pick(SAY.win) }), A.jump(0, .45, 'yay')], 3200);
    },
    tap() {
      if (!K.ready || K.y > 2) return;
      Kin.activity(true);
      try { K.host.sfx && K.host.sfx.select && K.host.sfx.select(); } catch (_) {}
      const T = SAY.tap, choices = [
        () => [A.pose('shy', 1500, { say: T.shy, hearts: 2 })],
        () => [A.pose('kiss', 1400, { fx: 'bounce', say: T.kiss, hearts: 4 })],
        () => [A.pose('inlove', 1500, { fx: 'bounce', say: T.inlove, hearts: 3 })],
        () => [A.pose('handheart', 1500, { say: T.handheart, hearts: 3 })],
        () => [A.pose('tease', 1300, { fx: 'wobble', say: T.tease })],
        () => [A.pose('wow', 1300, { fx: 'shake', say: T.wow })],
        () => [A.pose('cool', 1400, { say: T.cool })],
        () => [A.jump(0, .6, 'yay'), A.pose('cheer', 700, { say: T.yay })],
        () => [A.seq(['dance', 'party', 'dance'], 400, 1300, { fx: 'bounce', say: T.dance })]
      ];
      let i; do { i = Math.floor(Math.random() * choices.length); } while (i === K.lastTap && choices.length > 1);
      K.lastTap = i;
      doNow(choices[i](), 1500);
      K.hangLeft = Math.max(K.hangLeft, 2);
    },
    // a finger went down on the letter board: if it is on Kinyonga, a long press picks him up
    boardDown(e) {
      if (!K.ready || K.drag || K.layer.style.display === 'none') return false;
      const sc = S(), hw = K.charH * .8 * sc, hh = K.charH * .95 * sc, cx = K.x + K.w / 2, feet = K.ground + K.sink - K.y;
      if (e.clientX < cx - hw / 2 || e.clientX > cx + hw / 2 || e.clientY < feet - hh || e.clientY > feet) return false;
      clearTimeout(K.lp && K.lp.t);
      K.lp = { id: e.pointerId, x: e.clientX, y: e.clientY };
      K.lp.t = setTimeout(() => {
        if (!K.lp) return; const lp = K.lp; K.lp = null;
        try { K.host.cancelSelection && K.host.cancelSelection(); } catch (_) {}
        startDrag(lp.x, lp.y, lp.id);
      }, 380);
      return true;
    },
    // exposed for tests
    _K: K, _say: say, _camera: () => camera(), _gridTrip: () => gridTrip(), _wander: () => wander(), _over: () => overLetters(), _slip: () => slip()
  };

  /* ---------- carrying Kinyonga with a finger: he stays exactly where he is put ---------- */
  function startDrag(px, py, id) {
    const feet = K.ground + K.sink;
    doNow([], 0); K.queue = [];
    K.leaping = false; K.zoom = 1; K.sink = 0; K.y = 0; K.lift = 0; ghost(false); K.ghostHold = false;
    K.lane = 'free'; K.cell = null;
    K.drag = { id, ox: K.x + K.w / 2 - px, oy: feet - py, lx: px };
    K.act = start({ type: 'drag', pose: 'wow', ms: 1e12, fx: 'wobble', say: pick(DRAG_SAY), sayMs: 1600 });
    K.lastTouch = performance.now(); K.hintStage = 0;
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
    K.pinned = { x: K.x, g: K.ground, bot };
    K.face = K.x + K.w / 2 < innerWidth / 2 ? 1 : -1;             // turns towards the middle of the screen
    K.queue = [A.pose('tada', 1500, { fx: 'bounce', say: pick(DROP_SAY), sayMs: 1800 }), A.pose('sit', 2600)];
    K.nextBrain = performance.now() + 600; K.lastTouch = performance.now();
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
      update(dt); brain(now); stuck(now);
      bobAnim(dt); draw(); place();
      K.raf = requestAnimationFrame(tick);
    };
    K.raf = requestAnimationFrame(tick);
  }
  // the player has not touched anything for a while: offer help, then point at a letter
  function stuck(now) {
    if (K.drag) return;
    if (!K.lastTouch) K.lastTouch = now;
    const idle = now - K.lastTouch;
    if (K.hintStage === 0 && idle > 20000) {
      K.hintStage = 1; doNow([A.talk('think', 2400, pick(SAY.hint1))], 2400);
    } else if (K.hintStage === 1 && idle > 34000) {
      K.hintStage = 2;
      const flash = () => { try { K.host.softHint && K.host.softHint(); } catch (_) {} };
      let hc = null; try { hc = K.host.hintCell && K.host.hintCell(); } catch (_) {}
      if (hc && K.grid && !REDUCED && !K.pinned) {
        const free = freeCells() || [], isFree = ([a, b]) => free.some(([x, y]) => x === a && y === b);
        const nb = neighbours(hc[0], hc[1]).sort((p, q) => isFree(q) - isFree(p))[0] || hc;
        const hx = K.grid.left + (hc[1] + .5) * K.grid.cs;
        doNow([], 7000);
        gridTrip(nb, [A.pose('point', 2600, { fx: 'bounce', say: pick(SAY.hint2), sayMs: 2600,
          onStart: () => { K.face = hx >= K.x + K.w / 2 ? 1 : -1; flash(); } }), A.wait(700), stepOff()]);
      } else doNow([A.pose('point', 2400, { fx: 'bounce', say: pick(SAY.hint2), sayMs: 2600, onStart: flash })], 2400);
    } else if (K.hintStage === 2 && idle > 60000) {
      K.hintStage = 3; doNow([A.pose('cheer', 1800, { fx: 'bounce', say: pick(SAY.cheer), sayMs: 2400 })], 1800);
    } else if (K.hintStage === 3 && idle > 90000) {
      K.hintStage = 4; doNow([A.pose('sleep', 8000, { say: 'Zzz…', sayMs: 2000 })], 8000);   // falls asleep; any touch wakes him
    }
  }

  window.Kinyonga = Kin;
})();
