/* =====================================================================
   KINYONGA – the chameleon friend who lives under the letter board.
   Walks, runs and hops along the bottom edge of the board, laughs at
   wrong words, celebrates right ones, reacts when tapped, gives Swahili
   tips when the player is stuck, and sometimes slips and gets back up.

   Host page calls:
     Kinyonga.init({ board, inner, isPlaying, softHint, sfx })
     Kinyonga.onLevelStart(first) · onCorrect() · onWrong() · onBonus() · onWin()
     Kinyonga.activity()  (player touched the board)   · Kinyonga.layout()
   Sprites: images/kinyonga-anim.webp (frame sequences) + images/kinyonga-poses.webp (single poses)
   ===================================================================== */
(function () {
  'use strict';

  const VER = 1;   // sprite sheet version (bump when the .webp files change)
  const META = {
    cell: [176, 140], k: 1.6, charPx: 112,         // character is ~112px tall inside a 176×140 cell
    anim: { cols: 12, url: 'images/kinyonga-anim.webp?v=' + VER, seq: {
      walk: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], run: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], jump: [21, 22, 23, 24, 25, 26, 27, 28, 29],
      idle: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40], sleep: [41], laugh: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
      cry: [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63], talk: [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74],
      shy: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86], joke: [87, 88, 89, 90, 91], surprise: [92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102] } },
    poses: { cols: 6, url: 'images/kinyonga-poses.webp?v=' + VER, index: {
      magnify: 0, point: 1, winkwalk: 2, cheer: 3, dash: 4, think: 5, shock: 6, slip: 7, dizzy: 8, kiss: 9, laughpoint: 10, cry: 11,
      cool: 12, dance: 13, peek: 14, crawl: 15, yawn: 16, sit: 17, question: 18, confetti: 19, dash2: 20, sleep: 21 } },
    close: { cols: 4, url: 'images/kinyonga-close.webp?v=' + VER, index: { point: 0, winkwalk: 1, cheer: 2, kiss: 3, laughpoint: 4, magnify: 5, think: 6, shock: 7 } }
  };

  const SAY = {
    greet: ['Karibu! Tuanze!', 'Twende tena!', 'Habari! Tucheze!', 'Niko tayari! Na wewe?'],
    correct: ['Hongera!', 'Safi sana!', 'Unacheza vizuri!', 'Hodari!', 'Bomba!', 'Wewe ni bingwa!'],
    wrong: ['Hehe! Umekosea!', 'Jaribu tena!', 'Umekaribia!', 'Hehe! Si hilo!', 'Karibu kupata!'],
    win: ['Hongera! Umemaliza!', 'Safi sana! Twende tena!', 'Wewe ni bingwa!'],
    hint1: ['Nikupe kidokezo?', 'Umekwama? Nisaidie kidogo?'],
    hint2: ['Angalia herufi hizi!', 'Tazama hapa!'],
    cheer: ['Unaweza! Endelea!', 'Usikate tamaa!', 'Polepole ndio mwendo!'],
    slip: ['Lo!', 'Aaah!'], up: ['Niko sawa! Twende tena!', 'Sijaumia! Hehe!'],
    tap: {
      shy: 'Hihi! Umenipata!', kiss: 'Nakupenda!', wink: 'Umenipata!', laugh: 'Hehe! Unanicheka?',
      surprise: 'Lo! Umenishtua!', cool: 'Poa sana!', jump: 'Juu! Juu!', dance: 'Tucheze!'
    }
  };
  const BUBBLE_COLORS = ['#ffffff', '#fff3b0', '#d9f99d', '#fbcfe8', '#bfdbfe', '#fde68a'];

  const CSS = `
  .kin-layer{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden}
  .kin{position:absolute;left:0;top:0;will-change:transform;pointer-events:none;transform-origin:50% 100%}
  .kin-bob{width:100%;height:100%;transform-origin:50% 100%}
  .kin-spr{width:100%;height:100%;background-repeat:no-repeat;transform-origin:50% 100%}
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
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LITE = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  /* ---------- state ---------- */
  const K = {
    ready: false, host: null, layer: null, el: null, spr: null, hit: null, bubble: null,
    d: .5, w: 88, h: 70, charH: 56, ground: 0, minX: 4, maxX: 200,
    x: 40, y: 0, face: 1, lane: 'bot', cell: null, grid: null, leaping: false, gBot: 0, gTop: 0, topOk: false, climbing: false, queue: [], act: null, frameKey: '', raf: 0, last: 0,
    lastTouch: 0, hintStage: 0, nextBrain: 0, lastSlip: 0, lastSay: 0, sayT: 0, busyUntil: 0,
    depth: 1, zoom: 1, sink: 0, closeReady: false, lastZoom: -1e9, protect: [], freeTop: 0
  };

  /* ---------- drawing ---------- */
  function setFrame(kind, idx) {
    const key = kind + idx; if (key === K.frameKey) return; K.frameKey = key;
    const [CW, CH] = META.cell, s = K.spr.style;
    if (kind === 'a') {
      const c = idx % META.anim.cols, r = Math.floor(idx / META.anim.cols), d = K.d;
      s.backgroundImage = `url(${META.anim.url})`;
      s.backgroundSize = `${META.anim.cols * CW * d}px auto`;
      s.backgroundPosition = `${-c * CW * d}px ${-r * CH * d}px`;
    } else if (kind === 'c') {
      const c = idx % META.close.cols, r = Math.floor(idx / META.close.cols), d = K.d;
      s.backgroundImage = `url(${META.close.url})`;
      s.backgroundSize = `${META.close.cols * CW * d}px auto`;
      s.backgroundPosition = `${-c * CW * d}px ${-r * CH * d}px`;
    } else {
      const c = idx % META.poses.cols, r = Math.floor(idx / META.poses.cols), d = K.d;   // pose cells are k× bigger, shown at the same size
      s.backgroundImage = `url(${META.poses.url})`;
      s.backgroundSize = `${META.poses.cols * CW * d}px auto`;
      s.backgroundPosition = `${-c * CW * d}px ${-r * CH * d}px`;
    }
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
    K.hit.style.pointerEvents = (K.y > 2 || K.climbing || K.leaping || K.lane === 'grid' || K.zoom > 1.05 || blocked) ? 'none' : 'auto';
    if (K.bubble.classList.contains('on')) placeBubble();
  }

  /* ---------- layout: stand on the strip under the letter grid ---------- */
  function layout() {
    if (!K.ready) return;
    const inner = K.host.inner().getBoundingClientRect();
    const board = K.host.board ? K.host.board().getBoundingClientRect() : inner;
    const vb = (window.visualViewport ? visualViewport.height : innerHeight);
    const ground = vb - 4;
    const space = ground - inner.bottom - 4;                  // free height between the last row of letters and the screen bottom
    const gi = K.host.grid ? K.host.grid() : null;
    const cs = gi && gi.n ? inner.width / gi.n : 60;
    K.charH = Math.max(44, Math.min(82, space));        // as big as the room under the board allows
    K.gridDepth = Math.min(1, cs * 1.25 / K.charH);   // shrinks to box size while walking on the letters
    const sameGrid = K.grid && gi && K.grid.n === gi.n;
    K.grid = gi && gi.n ? { left: inner.left, top: inner.top, cs, n: gi.n } : null;
    K.d = K.charH / META.charPx;
    K.w = META.cell[0] * K.d; K.h = META.cell[1] * K.d;
    K.gBot = ground + 3 * K.d;                                // cells keep 3px under the feet
    // second lane: standing on the top edge of the board, below the word card, left of the hint button
    const topLimit = K.host.topLimit ? K.host.topLimit() : 0;
    const topSpace = board.top - topLimit - 2;
    K.gTop = board.top + 3 * K.d;
    const avoid = K.host.avoid ? K.host.avoid().filter(r => r && r.width && r.bottom > board.top - K.charH && r.top < board.top) : [];
    K.topMaxX = avoid.length ? Math.min(...avoid.map(r => r.left)) - K.w * .82 : innerWidth - K.w * .88;
    K.topMinX = Math.max(-K.w * .12, board.left - K.w * .2);
    K.topOk = topSpace >= K.charH * .95 && K.topMaxX - K.topMinX > K.w * 1.2;
    K.protect = (K.host.protect ? K.host.protect() : []).filter(r => r && r.width).map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
    K.protect.push({ left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom });
    K.freeTop = topLimit + K.charH * .8;            // highest the feet may go: the head stays under the word card
    K.boardTop = board.top; K.innerBox = { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom };
    if (!K.topOk && K.lane === 'top') K.lane = 'bot';
    if (K.lane === 'grid' && !(sameGrid && K.cell)) { K.lane = 'bot'; K.cell = null; ghost(false); }
    if (K.lane === 'free') { K.lane = 'bot'; K.depth = 1; ghost(false); }
    if (K.zoom !== 1 && !(K.act && K.act.type === 'zoom')) { K.zoom = 1; K.sink = 0; }
    K.ground = K.lane === 'top' ? K.gTop : K.gBot;
    if (K.lane === 'grid') { const q = cellPos(K.cell[0], K.cell[1]); K.x = q.x; K.ground = q.g; K.depth = K.gridDepth; }
    K.el.style.width = K.w + 'px'; K.el.style.height = K.h + 'px';
    setLaneX();
    if (K.lane !== 'grid') K.x = Math.max(K.minX, Math.min(K.maxX, K.x));
    K.layer.style.display = space < 34 ? 'none' : '';          // too little room on this screen: stay hidden instead of covering letters
    K.frameKey = ''; draw(); place();
  }

  // where Kinyonga stands when it is on a letter box: feet near the bottom of the box
  function cellPos(r, c) { const g = K.grid; return { x: g.left + (c + .5) * g.cs - K.w / 2, g: g.top + (r + .5) * g.cs + g.cs * .42 + 3 * K.d }; }
  function ghost(on) { K.layer.style.transition = 'opacity .25s'; K.layer.style.opacity = on ? '.22' : ''; }
  function setLaneX() {
    if (K.lane === 'top') { K.minX = K.topMinX; K.maxX = K.topMaxX; }
    else { K.minX = -K.w * .12; K.maxX = innerWidth - K.w * .88; }
  }

  /* ---------- speech bubble beside the head (never over the letters) ---------- */
  function say(text, ms) {
    if (!text) return;
    const b = K.bubble; b.textContent = text;
    b.style.background = pick(BUBBLE_COLORS);
    b.classList.add('on'); placeBubble();
    clearTimeout(K.sayT); K.lastSay = performance.now();
    K.sayT = setTimeout(() => b.classList.remove('on'), ms || 2300);
  }
  function placeBubble() {
    const b = K.bubble, cx = K.x + K.w / 2;
    const room = innerWidth - 8;
    const hs = K.w * S() / 2, cxm = K.x + K.w / 2;
    const leftSpace = cxm - hs * .6 - 8, rightSpace = room - (cxm + hs * .6);
    const right = rightSpace >= leftSpace;
    b.style.maxWidth = Math.max(110, Math.min(240, (right ? rightSpace : leftSpace) - 6)) + 'px';
    const bw = b.offsetWidth, bh = b.offsetHeight;
    const half = K.w * S() / 2, mid = K.x + K.w / 2;
    let bx = right ? mid + half * .56 : mid - half * .56 - bw;
    bx = Math.max(6, Math.min(room - bw, bx));
    const sc = S(), feet = K.ground + K.sink - K.y;
    let by = feet - K.charH * sc * .78 - bh / 2;
    by = Math.max(6, Math.min(by, innerHeight - bh - 6));
    b.style.transform = `translate3d(${bx}px,${by}px,0)`;
    b.style.transformOrigin = right ? '0% 50%' : '100% 50%';
    void cx;
  }
  function hearts(n, glyph) {
    for (let i = 0; i < (n || 3); i++) {
      const h = document.createElement('div'); h.className = 'kin-heart'; h.textContent = glyph || '❤';
      h.style.color = pick(['#ff4d6d', '#ff8fab', '#f43f5e']);
      h.style.left = (K.x + K.w * (.45 + Math.random() * .3)) + 'px';
      h.style.top = (K.ground - K.charH * .9) + 'px';
      h.style.setProperty('--dx', rnd(-26, 26).toFixed(0) + 'px');
      h.style.animationDelay = (i * .18) + 's';
      K.layer.appendChild(h); setTimeout(() => h.remove(), 1800 + i * 200);
    }
  }
  function fx(cls) { const s = K.spr; s.classList.remove('kin-fx-bounce', 'kin-fx-shake', 'kin-fx-wobble'); if (!cls || REDUCED) return; void s.offsetWidth; s.classList.add(cls); }

  /* ---------- actions (a small queue; events clear it and push their own) ---------- */
  // act: {type, ...}; every action is updated each frame until done
  function start(a) { a.t = 0; a.started = true; if (a.type === 'jump') a.x0 = K.x; if (a.say) say(a.say, a.sayMs); if (a.fx) fx(a.fx); if (a.hearts) hearts(a.hearts, a.glyph); if (a.onStart) a.onStart(); return a; }
  function update(dt) {
    if (!K.act) { K.act = K.queue.length ? start(K.queue.shift()) : null; if (!K.act) return; }
    const a = K.act; a.t += dt;
    let done = false;
    if (a.type === 'move') {
      const dir = Math.sign(a.to - K.x); K.face = dir || K.face;
      const step = a.speed * dt;
      if (Math.abs(a.to - K.x) <= step) { K.x = a.to; done = true; } else K.x += dir * step;
      if (a.hop) K.y = Math.abs(Math.sin(a.t * Math.PI / a.hop)) * K.charH * .28;
      if (done) K.y = 0;
    } else if (a.type === 'jump') {
      const T = a.ms / 1000, p = Math.min(1, a.t / T);
      K.y = Math.sin(p * Math.PI) * K.charH * (a.height || .45);
      if (a.dx) { K.x = Math.max(K.minX, Math.min(K.maxX, a.x0 + a.dx * p)); K.face = Math.sign(a.dx); }
      if (p >= 1) { K.y = 0; done = true; }
    } else if (a.type === 'leap') {
      if (a.x0 === undefined) {
        if (a.cell && K.grid) { const q = cellPos(a.cell[0], a.cell[1]); a.x1 = q.x; a.g1 = q.g; }
        if (a.lane === 'bot') { a.g1 = K.gBot; if (a.x1 === undefined) a.x1 = Math.max(-K.w * .12, Math.min(innerWidth - K.w * .88, K.x)); }
        a.x0 = K.x; a.g0 = K.ground; K.leaping = true; if (Math.abs(a.x1 - a.x0) > 1) K.face = Math.sign(a.x1 - a.x0);
      }
      const p = Math.min(1, a.t / (a.ms / 1000)), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      K.x = a.x0 + (a.x1 - a.x0) * e; K.ground = a.g0 + (a.g1 - a.g0) * e;
      if (a.d0 === undefined) a.d0 = K.depth;
      { const dt1 = a.lane === 'grid' ? K.gridDepth : a.lane === 'free' ? depthAt(a.g1) : 1; K.depth = a.d0 + (dt1 - a.d0) * e; }
      K.y = Math.sin(p * Math.PI) * K.charH * (a.h || .3);
      if (p >= 1) { K.y = 0; K.leaping = false; K.lane = a.lane; K.cell = a.cell || null; if (a.lane !== 'grid') { ghost(false); setLaneX(); } done = true; }
    } else if (a.type === 'walk2') {
      if (!a.on) { a.on = true; K.lane = 'free'; }
      const hurry = !a.slowOnLetters && overLetters();
      a.fast = hurry ? 1.5 : 1;          // a little quicker over the letters, but still walking
      const dx = a.x1 - K.x, dg = a.g1 - K.ground, dist = Math.hypot(dx, dg), step = a.speed * a.fast * dt * Math.max(.6, K.depth);
      if (Math.abs(dx) > 2) K.face = Math.sign(dx);
      if (dist <= step) { K.x = a.x1; K.ground = a.g1; done = true; }
      else { K.x += dx / dist * step; K.ground += dg / dist * step; }
      K.depth = depthAt(K.ground);
      if (done && a.lane === 'bot') { K.lane = 'bot'; K.depth = 1; K.ground = K.gBot; setLaneX(); ghost(false); }
    } else if (a.type === 'zoom') {
      if (a.z0 === undefined) a.z0 = K.zoom;
      const p = Math.min(1, a.t / (a.ms / 1000)), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      K.zoom = a.z0 + (a.to - a.z0) * e; K.sink = (K.zoom - 1) * K.charH * .42;
      if (p >= 1) { K.zoom = a.to; if (a.to === 1) K.sink = 0; done = true; }
    } else if (a.type === 'climb') {
      if (a.g0 === undefined) { a.g0 = K.ground; a.g1 = a.to === 'top' ? K.gTop : K.gBot; K.climbing = true; }
      const p = Math.min(1, a.t / (a.ms / 1000)), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      K.ground = a.g0 + (a.g1 - a.g0) * e;
      K.y = Math.sin(p * Math.PI) * K.charH * .25;
      if (p >= 1) { K.lane = a.to; K.ground = a.g1; K.y = 0; K.climbing = false; setLaneX(); done = true; }
    } else {                       // 'play' (frame sequence) or 'pose' (single picture) or 'wait'
      if (a.t * 1000 >= a.ms) done = true;
    }
    if (done) { if (a.onEnd) a.onEnd(); K.act = null; }
  }
  function frameFor(a) {
    if (!a) return ['a', META.anim.seq.idle[0]];
    if (a.pose) {
      if (K.zoom > 1.35 && K.closeReady && META.close.index[a.pose] != null) return ['c', META.close.index[a.pose]];   // sharp picture when close to the camera
      return ['p', META.poses.index[a.pose]];
    }
    const seq = META.anim.seq[a.anim || 'idle'], from = Math.min(a.from || 0, seq.length - 1), n = seq.length - from;
    let i = Math.floor((a.t || 0) * (a.fps || 10));
    if (a.hold) i = Math.min(i, n - 1);
    return ['a', seq[from + (i % n)]];
  }
  // walking: the face stays turned to the player (the front walking picture with a step bounce);
  // now and then it turns its head to look where it is going (the side walking frames)
  const isWalk = a => !!a && !a.pose && a.anim === 'walk' && ((a.type === 'move' && !a.hop) || a.type === 'walk2' || a.type === 'leap' || a.type === 'zoom');
  function walkRate(a) {          // steps per second, from the speed
    if (a.type === 'leap') return 1000 / a.ms * 1.6;
    if (a.type === 'zoom') return 1.7;
    return Math.max(1.3, Math.min(3.2, (a.speed || K.charH) * (a.fast || 1) / (K.charH * .45)));
  }
  function stepAnim(dt, now) {
    const a = K.act, wk = isWalk(a) && !REDUCED;
    if (wk) {
      if (!K.wasWalking) { K.nextTurn = now + rnd(1600, 3000); K.turnUntil = 0; }
      if (now > K.nextTurn) { K.turnUntil = now + rnd(650, 1050); K.nextTurn = K.turnUntil + rnd(2400, 4500); }
      K.turning = now < K.turnUntil;
      K.stepPh = (K.stepPh || 0) + dt * walkRate(a);
    } else { K.turning = false; }
    K.wasWalking = wk;
    K.front = wk && !K.turning;
    let tf = '';
    if (wk) {
      const s = Math.sin(K.stepPh * Math.PI), up = Math.abs(s), lean = K.front ? 5 : 2.5;
      const q = (1 - up) * .035;   // tiny squash when the foot lands
      tf = `translateY(${(-up * K.charH * .07).toFixed(1)}px) rotate(${(s * lean).toFixed(2)}deg) scale(${(1 + q).toFixed(3)},${(1 - q).toFixed(3)})`;
    }
    if (tf !== K.bobTf) { K.bob.style.transform = tf; K.bobTf = tf; }
  }
  function draw() {
    if (K.front) {
      const close = K.zoom > 1.35 && K.closeReady;
      setFrame(close ? 'c' : 'p', close ? META.close.index.winkwalk : META.poses.index.winkwalk);
      return;
    }
    const [k, i] = frameFor(K.act || K.idleAct); setFrame(k, i);
  }

  const A = {
    walk: to => ({ type: 'move', to, speed: K.charH * .65, anim: 'walk', fps: 7 }),
    run: to => ({ type: 'move', to, speed: K.charH * .95, anim: 'walk', fps: 8 }),
    hopTo: to => ({ type: 'move', to, speed: K.charH * 1.1, anim: 'jump', fps: 9, hop: .8 }),
    jump: (dx, h) => ({ type: 'jump', ms: 950, dx: dx || 0, height: h || .45, anim: 'jump', fps: 9 }),
    climb: to => ({ type: 'climb', to, ms: 1500, anim: 'jump', fps: 8 }),
    play: (anim, ms, fps, extra) => Object.assign({ type: 'play', anim, ms, fps: Math.round((fps || 11) * .75) }, extra || {}),
    pose: (pose, ms, extra) => Object.assign({ type: 'pose', pose, ms }, extra || {}),
    wait: ms => ({ type: 'wait', ms, anim: 'idle', fps: 3 })
  };
  function doNow(list, busyMs) {
    if (K.climbing) { K.lane = K.ground < (K.gTop + K.gBot) / 2 ? 'top' : 'bot'; K.ground = K.lane === 'top' ? K.gTop : K.gBot; K.climbing = false; setLaneX(); }
    if (K.leaping) {   // interrupted mid-hop: land where it was heading
      const a = K.act; K.leaping = false; K.y = 0;
      if (a && a.x1 !== undefined) { K.x = a.x1; K.ground = a.g1; K.lane = a.lane; K.cell = a.cell || null; }
      if (K.lane !== 'grid') { ghost(false); setLaneX(); }
    }
    K.queue = list.slice(); K.act = null; K.y = 0;
    if (K.zoom > 1.02 && !(K.queue[0] && K.queue[0].type === 'zoom')) K.queue.unshift({ type: 'zoom', to: 1, ms: 320, anim: 'idle', fps: 3 }); K.busyUntil = performance.now() + (busyMs || 0); K.nextBrain = performance.now() + (busyMs || 1500) + rnd(800, 2000); }
  const randX = () => rnd(K.minX + 10, K.maxX - 10);

  /* ---------- free-time behaviour ---------- */
  function brain(now) {
    if (K.drag) return;
    if (!K.act && !K.queue.length && K.lane === 'grid' && !K.leaping) { K.queue.push(A.wait(700), stepOff()); return; }   // never parked on the boxes
    if (!K.act && !K.queue.length && K.zoom > 1.02) { K.queue.push({ type: 'zoom', to: 1, ms: 500, anim: 'idle', fps: 3 }); return; }
    if (K.act || K.queue.length || now < K.nextBrain) return;
    const r = Math.random();
    if (!REDUCED && now - K.lastTouch > 6000 && now - K.lastZoom > 30000 && r < .15) { camera(); K.nextBrain = now + 2000; return; }
    if (!REDUCED && now - K.lastSlip > 60000 && r < .22) { slip(); K.nextBrain = now + 2000; return; }
    explore();
    K.nextBrain = now + rnd(600, 1600);
  }

  /* ---------- exploring: a new place every time (never ping-pong between two points) ---------- */
  // places: above the board (photo / landscape), the top edge, the left and right sides, along a row of letters,
  // down a column, over the boxes step by step, and the strip under the board
  const ZONES = ['photo', 'topEdge', 'left', 'right', 'row', 'column', 'boxes', 'bottom', 'climb'];
  function zoneOk(z) {
    if (!K.innerBox) return z === 'bottom';
    if (z === 'photo') return K.boardTop - K.freeTop > K.charH * .3;
    if (z === 'climb') return K.topOk;
    if (z === 'boxes' || z === 'row' || z === 'column') return !!K.grid;
    return true;
  }
  const clampX = x => Math.max(-K.w * .1, Math.min(innerWidth - K.w * .9, x));
  function explore() {
    K.lastZones = K.lastZones || [];
    let options = ZONES.filter(z => zoneOk(z) && !K.lastZones.includes(z));
    if (!options.length) options = ZONES.filter(zoneOk);
    // after a visit to the letters, the next stop is always off the letters (words are never hidden for long)
    const ON = ['boxes', 'row', 'column', 'left', 'right'], prev = K.lastZones[K.lastZones.length - 1];
    if (ON.includes(prev)) { const off = options.filter(z => !ON.includes(z)); if (off.length) options = off; }
    if (REDUCED) options = options.filter(z => z === 'bottom' || z === 'photo' || z === 'topEdge');
    // a little bias: more time on and around the board
    const weights = { photo: 3, topEdge: 2.5, left: .5, right: .5, row: .8, column: .6, boxes: 1.3, bottom: 2.4, climb: 1.2 };
    let sum = options.reduce((a, z) => a + (weights[z] || 1), 0), roll = Math.random() * sum, zone = options[0];
    for (const z of options) { roll -= weights[z] || 1; if (roll <= 0) { zone = z; break; } }
    K.lastZones.push(zone); if (K.lastZones.length > 3) K.lastZones.shift();
    K.zone = zone;
    if (K.lane === 'grid' && zone !== 'boxes') K.queue.push(stepOff());
    const ib = K.innerBox, g = K.grid, after = () => {
      const t = Math.random();
      return t < .25 ? A.pose(pick(['magnify', 'think', 'question', 'peek']), 1400, { fx: 'wobble' })
           : t < .5 ? A.play('talk', 1400, 9, { say: Math.random() < .45 ? pick(CHAT) : '' })
           : t < .65 ? A.jump(rnd(-1, 1) * K.w * .5, .4)
           : t < .75 ? A.pose('dance', 1100, { fx: 'bounce' })
           : A.play('idle', 1100, 4);
    };
    const sp = {};
    switch (zone) {
      case 'photo': K.queue.push(W2(clampX(rnd(0, innerWidth - K.w)), rnd(K.freeTop, K.boardTop - 4), 'free', sp), after()); break;
      case 'topEdge': K.queue.push(W2(clampX(rnd(ib.left, ib.right - K.w)), K.boardTop + 3 * K.d, 'free', sp), after()); break;
      case 'left': case 'right': {
        const x = zone === 'left' ? -K.w * .1 : innerWidth - K.w * .9;
        K.queue.push(W2(x, rnd(ib.top + K.charH * .8, ib.bottom), 'free', sp), A.pose('peek', 1000)); break;
      }
      case 'row': {     // walk between two rows of letters from one side to the other
        const rr = Math.floor(rnd(1, g.n)), y = g.top + rr * g.cs + 2 * K.d;
        const fromLeft = K.x + K.w / 2 < innerWidth / 2;
        const part = rnd(.4, .6) * (ib.right - ib.left);          // only part of the row, then off the letters again
        const xa = fromLeft ? ib.left - K.w * .3 : ib.right - K.w * .7, xb = fromLeft ? xa + part : xa - part;
        K.queue.push(W2(clampX(xa), y), W2(clampX(xb), y, 'free', { speed: K.charH * 1.05, slowOnLetters: true }), A.play('talk', 900, 9)); break;
      }
      case 'column': {  // down (or up) a column of letters
        const cc = Math.floor(rnd(0, g.n)), x = clampX(g.left + (cc + .5) * g.cs - K.w / 2);
        const half = (ib.bottom - ib.top) * rnd(.4, .55), y1 = Math.random() < .5 ? ib.top + K.charH * .8 : ib.bottom - half, y2 = Math.min(ib.bottom, y1 + half);
        const down = Math.random() < .5;
        K.queue.push(W2(x, down ? y1 : y2), W2(x, down ? y2 : y1, 'free', { speed: K.charH * 1.0, slowOnLetters: true }), A.play('talk', 900, 9)); break;
      }
      case 'boxes': gridTrip(); break;
      case 'climb': travel(); break;
      default: K.queue.push(W2(clampX(rnd(0, innerWidth - K.w)), K.gBot, 'bot', sp), after());
    }
  }
  // the nearest spot off the letters: the top edge if it is closer, otherwise under the board
  function stepOff(sayText) {
    const ib = K.innerBox;
    const feet = K.ground, toTop = ib ? Math.abs(feet - K.boardTop) < Math.abs(K.gBot - feet) : false;
    if (toTop && K.boardTop - K.freeTop > K.charH * .3)
      return { type: 'leap', lane: 'free', x1: clampX(K.x), g1: K.boardTop + 3 * K.d, ms: 700, h: .45, anim: 'jump', fps: 9, say: sayText || '' };
    return { type: 'leap', lane: 'bot', ms: 750, h: .5, anim: 'jump', fps: 9, say: sayText || '' };
  }
  function overLetters() {
    const ib = K.innerBox; if (!ib) return false;
    const sc = S(), hw = K.charH * .7 * sc, cx = K.x + K.w / 2, feet = K.ground + K.sink;
    return !(cx + hw / 2 <= ib.left || cx - hw / 2 >= ib.right || feet <= ib.top || feet - K.charH * sc >= ib.bottom);
  }
  // ---------- on the letter boxes: step from box to box, sit down, chat, then hop back down ----------
  const CHAT = ['Hapa ni pazuri!', 'Unaona neno lolote?', 'Mimi ni Kinyonga!', 'Herufi hizi ni nyingi!', 'Nimekaa kidogo.', 'Tafuta pamoja nami!', 'Je, umeliona hili?'];
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
  const stepTo = cell => ({ type: 'leap', lane: 'grid', cell, ms: 620, h: .16, anim: 'walk', fps: 9 });
  function enterGrid() {        // hop from the edge onto the nearest box of the first / last row
    const g = K.grid, cx = K.x + K.w / 2;
    const c = Math.max(0, Math.min(g.n - 1, Math.floor((cx - g.left) / g.cs)));
    const r = K.lane === 'top' ? 0 : g.n - 1;
    const colX = g.left + (c + .5) * g.cs - K.w / 2;
    return { at: [r, c], list: [A.walk(colX), { type: 'leap', lane: 'grid', cell: [r, c], ms: 800, h: .55, anim: 'jump', fps: 9 }] };
  }
  const leaveGrid = say => ({ type: 'leap', lane: 'bot', ms: 750, h: .5, anim: 'jump', fps: 9, say: say || '' });
  function gridTrip(target, then) {
    if (!K.grid || K.climbing) return false;
    let at, list = [];
    if (K.lane === 'grid' && K.cell) at = K.cell; else { const e = enterGrid(); at = e.at; list = e.list; }
    const free = freeCells() || [];
    const goal = target || (free.length ? pick(free) : at);
    let prev = at;
    for (const st of steps(at, goal, target ? 7 : 4)) { list.push(stepTo(st), A.wait(200)); prev = st; }
    list.push(...(then || [A.pose('sit', 1600), A.play('talk', 1500, 9, { say: pick(CHAT) })]));
    if (!then) {     // maybe a few more steps before going home
      if (Math.random() < .2 && free.length) { const g2 = pick(free); for (const st of steps(prev, g2, 4)) list.push(stepTo(st), A.wait(260)); list.push(A.pose('think', 1500)); }
      list.push(stepOff());
    }
    K.queue.push(...list);
    return true;
  }
  function offGrid(sayText) { return K.lane === 'grid' || K.leaping || overLetters() ? [stepOff(sayText)] : []; }
  const offStage = offGrid;

  // ---------- roaming the whole screen: above the board, across it, along the sides, with depth ----------
  function depthAt(g) {           // farther up the screen = a little smaller, like walking away from the camera
    const t = Math.max(0, Math.min(1, (g - K.freeTop) / Math.max(1, K.gBot - K.freeTop)));
    return .72 + .28 * t;
  }
  const W2 = (x1, g1, lane, extra) => Object.assign({ type: 'walk2', x1, g1, lane: lane || 'free', speed: K.charH * .85, anim: 'walk', fps: 8 }, extra || {});
  function roam() {
    if (!K.innerBox) return false;
    const pts = [], ib = K.innerBox, xr = () => rnd(-K.w * .1, innerWidth - K.w * .9);
    const photoRoom = K.boardTop - K.freeTop;
    const kinds = ['across', 'side']; if (photoRoom > K.charH * .3) kinds.push('photo', 'photo');
    const n = Math.random() < .5 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const k = pick(kinds);
      if (k === 'photo') pts.push([xr(), rnd(K.freeTop, K.boardTop - 4)]);
      else if (k === 'side') pts.push([Math.random() < .5 ? -K.w * .2 : innerWidth - K.w * .8, rnd(ib.top + K.charH, ib.bottom)]);
      else pts.push([xr(), rnd(ib.top + K.charH * .6, ib.bottom)]);
    }
    for (const [x, g] of pts) {
      K.queue.push(W2(x, g));
      const r = Math.random();
      K.queue.push(r < .3 ? A.pose(pick(['magnify', 'think', 'question', 'peek']), 1500, { fx: 'wobble' })
                 : r < .55 ? A.play('talk', 1500, 9, { say: Math.random() < .5 ? pick(CHAT) : '' })
                 : A.play('idle', 1200, 4));
    }
    K.queue.push(W2(xr(), K.gBot, 'bot'), A.wait(900));
    return true;
  }
  // walk to the middle and lean in towards the player, as if coming up to the camera
  const CAMERA = [['winkwalk', 'Nakuona!'], ['kiss', 'Nakupenda, rafiki!'], ['laughpoint', 'Hehe! Ni mimi tena!'], ['point', 'Wewe ni hodari!'], ['cheer', 'Twende tena!']];
  function camera() {
    const Z = Math.max(1.8, Math.min(3.4, innerHeight * .4 / K.charH));
    const [p1, s1] = pick(CAMERA), [p2, s2] = pick(CAMERA.filter(c => c[0] !== p1));
    K.lastZoom = performance.now();
    K.queue.push(W2(innerWidth / 2 - K.w / 2, K.gBot, 'bot', { speed: K.charH * .9 }),
      { type: 'zoom', to: Z, ms: 1300, anim: 'walk', fps: 6 },
      A.pose(p1, 1700, { say: s1, sayMs: 1700, hearts: p1 === 'kiss' ? 4 : 0 }),
      A.pose(p2, 1500, { say: s2, sayMs: 1500, hearts: p2 === 'kiss' ? 4 : 0 }),
      { type: 'zoom', to: 1, ms: 1000, anim: 'walk', fps: 6 },
      A.walk(rnd(K.minX, K.maxX)));
  }

  // walk to one side of the board, climb up (or down) along it, and wander on the other edge
  function travel() {
    const to = K.lane === 'top' ? 'bot' : 'top';
    // climb on the left when something (the hint button) sits at the top right; otherwise on the nearer side
    const blockedRight = K.topMaxX < innerWidth - K.w * 1.2;
    const leftSide = blockedRight || K.x + K.w / 2 < innerWidth / 2;
    const sideX = leftSide ? -K.w * .12 : innerWidth - K.w * .88;
    const land = to === 'top' ? (leftSide ? K.topMinX + K.w * .3 : K.topMaxX) : rnd(K.w, innerWidth - K.w * 1.5);
    K.queue.push(A.run(sideX), A.climb(to),
      { type: 'move', to: land, speed: K.charH * .7, anim: 'walk', fps: 7 },
      A.play('talk', 1200, 8, { say: Math.random() < .3 ? (to === 'top' ? 'Naona vizuri hapa juu!' : 'Nimerudi!') : '' }),
      A.wait(1200));
  }
  function slip() {
    K.lastSlip = performance.now();
    K.queue.push(A.run(randX()),
      A.pose('slip', 650, { fx: 'shake', say: pick(SAY.slip), sayMs: 1200 }),
      A.pose('dizzy', 1300, { fx: 'wobble' }),
      A.play('cry', 1400, 9),
      A.play('cry', 1300, 9, { from: 6, hold: true, say: pick(SAY.up), sayMs: 1800 }),
      A.jump(0, .35));
  }

  /* ---------- reactions to the game ---------- */
  const Kin = {
    init(host) {
      if (K.ready || !host) return;
      K.host = host;
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const layer = document.createElement('div'); layer.className = 'kin-layer'; layer.setAttribute('aria-hidden', 'true');
      layer.innerHTML = '<div class="kin"><div class="kin-bob"><div class="kin-spr"></div></div></div><div class="kin-hit"></div><div class="kin-say"></div>';
      (host.parent || document.body).appendChild(layer);
      Object.assign(K, { layer, el: layer.querySelector('.kin'), spr: layer.querySelector('.kin-spr'), bob: layer.querySelector('.kin-bob'), hit: layer.querySelector('.kin-hit'), bubble: layer.querySelector('.kin-say') });
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
        if (K.drag && e.pointerId === K.drag.id) { endDrag(); return; }
        if (K.press && e.pointerId === K.press.id) { K.press = null; if (e.type === 'pointerup') Kin.tap(); return; }
        if (K.lp && e.pointerId === K.lp.id) { clearTimeout(K.lp.t); K.lp = null; if (e.type === 'pointerup') Kin.tap(); }
      };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
      // both sprite sheets must be loaded before Kinyonga shows up
      let n = 0; const done = () => { if (++n === 2) { K.ready = true;
          const cl = new Image(); cl.onload = () => { K.closeReady = true; }; cl.src = META.close.url; K.x = rnd(10, 60); layout(); layer.style.visibility = ''; loop(); } };
      [META.anim.url, META.poses.url].forEach(u => { const im = new Image(); im.onload = done; im.onerror = () => { layer.remove(); }; im.src = u; });
      addEventListener('resize', () => layout());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { K.last = 0; loop(); } });
    },
    layout,
    activity(fromEvent) {
      K.lastTouch = performance.now();
      if (!fromEvent && K.ready && !K.drag && (K.lane === 'grid' || K.zoom > 1.02 || overLetters() || (K.leaping && K.act && K.act.lane === 'grid'))) {
        K.hintStage = 0; ghost(true); doNow([stepOff(Math.random() < .5 ? 'Samahani! Nakupisha!' : '')], 900); return;
      }
      const sleeping = K.hintStage >= 4 && K.act && (K.act.anim === 'sleep' || K.act.pose === 'yawn');
      K.hintStage = 0;
      if (sleeping) doNow([A.play('surprise', 900, 10, { hold: true, say: 'Lo! Nimeamka!', sayMs: 1500 })], 900);   // woke up
    },
    onLevelStart(first) {
      Kin.activity(true); if (!K.ready) return;
      if (K.lane === 'grid' || K.leaping) { K.leaping = false; K.lane = 'bot'; K.cell = null; ghost(false); }
      layout();
      doNow([A.play('talk', 1800, 10, { say: first ? SAY.greet[0] : (Math.random() < .35 ? pick(SAY.greet) : '') }), A.walk(Math.max(K.minX, Math.min(K.maxX, K.x + rnd(-1, 1) * K.w)))], 1800);
    },
    onCorrect() {
      Kin.activity(true); if (!K.ready) return; const off = offGrid();
      const r = Math.random();
      const list = r < .4 ? [A.pose('cheer', 900, { fx: 'bounce' }), A.pose('dance', 800, { fx: 'bounce' })]
                 : r < .7 ? [A.jump(0, .55), A.pose('confetti', 1000, { fx: 'bounce' })]
                 : [A.pose('laughpoint', 1100, { fx: 'bounce' })];
      if (Math.random() < .5) list[0].say = pick(SAY.correct);
      doNow(off.concat(list), 1500);
    },
    onBonus() { if (!K.ready) return; doNow(offGrid().concat([A.pose('magnify', 1100, { fx: 'wobble', say: 'Neno la ziada! Safi!' })]), 1100); },
    onWrong() {
      Kin.activity(true); if (!K.ready) return; const off = offGrid();
      const list = Math.random() < .55 ? [A.play('laugh', 1300, 12)] : [A.play('joke', 1300, 6, { hold: true })];
      if (Math.random() < .65) list[0].say = pick(SAY.wrong);
      doNow(off.concat(list), 1300);
    },
    onWin() {
      if (!K.ready) return;
      doNow([...offGrid(), A.jump(0, .6), A.pose('confetti', 1100, { fx: 'bounce', say: pick(SAY.win) }), A.pose('dance', 900, { fx: 'bounce' }), A.jump(0, .5)], 3000);
    },
    tap() {
      if (!K.ready || K.y > 2) return;
      Kin.activity(true);
      try { K.host.sfx && K.host.sfx.select && K.host.sfx.select(); } catch (_) {}
      const T = SAY.tap, choices = [
        () => [A.play('shy', 1500, 9, { say: T.shy, hearts: 2 })],
        () => [A.pose('kiss', 1300, { fx: 'bounce', say: T.kiss, hearts: 4 })],
        () => [A.pose('winkwalk', 1000, { fx: 'wobble', say: T.wink })],
        () => [A.play('laugh', 1300, 12, { say: T.laugh })],
        () => [A.play('surprise', 1300, 10, { say: T.surprise, hold: true })],
        () => [A.pose('cool', 1300, { say: T.cool })],
        () => [A.jump(0, .7), A.jump(0, .45), A.pose('cheer', 600, { say: T.jump })],
        () => [A.pose('dance', 900, { fx: 'bounce', say: T.dance }), A.pose('cheer', 700, { fx: 'bounce' })]
      ];
      let i; do { i = Math.floor(Math.random() * choices.length); } while (i === K.lastTap && choices.length > 1);
      K.lastTap = i;
      doNow(choices[i](), 1400);
    },
    // a finger went down on the letter board: if it is on Kinyonga, a long press picks him up
    // (a normal swipe still selects letters; returns true while it waits to see which one it is)
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
    _K: K, _say: say, _camera: () => camera(), _roam: () => roam(), _gridTrip: () => gridTrip(), _over: () => overLetters(), _isWalk: isWalk
  };

  /* ---------- carrying Kinyonga with a finger ---------- */
  const DRAG_SAY = ['Lo! Unanipeleka wapi?', 'Wee! Naruka!', 'Hehe! Polepole!', 'Niweke chini!'];
  const DROP_SAY = ['Asante!', 'Nimefika!', 'Hapa ni pazuri!', 'Tuendelee!'];
  function startDrag(px, py, id) {
    const feet = K.ground + K.sink;
    doNow([], 0); K.queue = [];
    K.leaping = false; K.climbing = false; K.zoom = 1; K.sink = 0; K.y = 0; ghost(false);
    K.lane = 'free'; K.cell = null;
    K.drag = { id, ox: K.x + K.w / 2 - px, oy: feet - py, lx: px };
    K.act = start({ type: 'drag', anim: 'surprise', fps: 8, hold: true, ms: 1e12, fx: 'wobble', say: pick(DRAG_SAY), sayMs: 1600 });
    K.lastTouch = performance.now(); K.hintStage = 0;
  }
  function moveDrag(px, py) {
    const d = K.drag; if (!d) return;
    const sc = S();
    const minG = Math.max(K.charH * sc + 4, 0), maxG = innerHeight - 2;
    K.x = Math.max(-K.w * .1, Math.min(innerWidth - K.w * .9, px + d.ox - K.w / 2));
    K.ground = Math.max(minG, Math.min(maxG, py + d.oy));
    K.depth = depthAt(K.ground);
    if (Math.abs(px - d.lx) > 3) { K.face = Math.sign(px - d.lx); d.lx = px; }
  }
  function endDrag() {
    K.drag = null; K.act = null;
    if (K.ground >= K.gBot - 2) { K.lane = 'bot'; K.ground = K.gBot; K.depth = 1; setLaneX(); } else K.lane = 'free';
    K.queue = [A.jump(0, .3), A.play('talk', 1300, 9, { say: pick(DROP_SAY), sayMs: 1500 })].concat(stroll(K.x, K.ground, K.lane === 'bot'));
    K.nextBrain = performance.now() + 900; K.lastTouch = performance.now();
  }
  // a few slow steps around one spot, stopping to look at the player in between
  function stroll(hx, hg, onBot) {
    const out = [], n = 3 + (Math.random() < .5 ? 1 : 0), R = K.charH;
    for (let i = 0; i < n; i++) {
      const x = clampX(hx + rnd(-1.4, 1.4) * R);
      const g = onBot ? K.gBot : Math.max(K.freeTop, Math.min(K.gBot, hg + rnd(-.5, .5) * R));
      out.push(W2(x, g, onBot ? 'bot' : 'free', { speed: R * .6, slowOnLetters: true }));
      const t = Math.random();
      out.push(t < .3 ? A.pose(pick(['think', 'question', 'magnify']), 1300, { fx: 'wobble' })
             : t < .55 ? A.play('talk', 1300, 9, { say: Math.random() < .4 ? pick(CHAT) : '' })
             : t < .7 ? A.pose('point', 1100)
             : A.play('idle', 1100, 4));
    }
    return out;
  }

  /* ---------- main loop: one requestAnimationFrame, paused when hidden or not playing ---------- */
  function loop() {
    if (K.raf || !K.ready) return;
    const tick = now => {
      K.raf = 0;
      if (document.hidden) return;
      const playing = K.host.isPlaying ? K.host.isPlaying() : true;
      if (!playing) { K.raf = requestAnimationFrame(tick); return; }    // cheap wait while menus / popups are open
      if (LITE && K.last && now - K.last < 30) { K.raf = requestAnimationFrame(tick); return; }   // weak phones: ~30 fps is plenty
      const dt = K.last ? Math.min(.06, (now - K.last) / 1000) : 0; K.last = now;
      if (!K.act && !K.queue.length) { K.idleAct = K.idleAct || { anim: 'idle', fps: 3, t: 0 }; K.idleAct.t += dt; }
      update(dt); brain(now); stuck(now);
      stepAnim(dt, now); draw(); place();
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
      K.hintStage = 1; doNow([A.play('talk', 2200, 10, { say: pick(SAY.hint1), sayMs: 2600 })], 2200);
    } else if (K.hintStage === 1 && idle > 34000) {
      K.hintStage = 2;
      const flash = () => { try { K.host.softHint && K.host.softHint(); } catch (_) {} };
      let hc = null; try { hc = K.host.hintCell && K.host.hintCell(); } catch (_) {}
      if (hc && K.grid && !REDUCED && !K.climbing) {
        const free = freeCells() || [], isFree = ([a, b]) => free.some(([x, y]) => x === a && y === b);
        const nb = neighbours(hc[0], hc[1]).sort((p, q) => isFree(q) - isFree(p))[0] || hc;
        const hx = K.grid.left + (hc[1] + .5) * K.grid.cs;
        doNow([], 6000);
        gridTrip(nb, [A.pose('point', 2600, { fx: 'bounce', say: pick(SAY.hint2), sayMs: 2600,
          onStart: () => { K.face = hx >= K.x + K.w / 2 ? 1 : -1; flash(); } }), A.wait(700), stepOff()]);
      } else doNow([A.pose('point', 2200, { fx: 'bounce', say: pick(SAY.hint2), sayMs: 2600, onStart: flash })], 2200);
    } else if (K.hintStage === 2 && idle > 60000) {
      K.hintStage = 3; doNow([A.pose('cheer', 1600, { fx: 'bounce', say: pick(SAY.cheer), sayMs: 2400 })], 1600);
    } else if (K.hintStage === 3 && idle > 90000) {
      K.hintStage = 4; doNow([A.pose('yawn', 1500), A.play('sleep', 6000, 1)], 7000);   // falls asleep; any touch wakes it
    }
  }

  window.Kinyonga = Kin;
})();
