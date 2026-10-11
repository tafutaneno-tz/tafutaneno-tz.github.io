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

  const VER = 1;
  const META = {
    cell: [176, 140], k: 1.6, charPx: 112,         // character is ~112px tall inside a 176×140 cell
    anim: { cols: 12, url: 'images/kinyonga-anim.webp?v=' + VER, seq: {
      walk: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], run: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], jump: [21, 22, 23, 24, 25, 26, 27, 28, 29],
      idle: [30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40], sleep: [41], laugh: [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
      cry: [53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63], talk: [64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74],
      shy: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86], joke: [87, 88, 89, 90, 91], surprise: [92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102] } },
    poses: { cols: 6, url: 'images/kinyonga-poses.webp?v=' + VER, index: {
      magnify: 0, point: 1, winkwalk: 2, cheer: 3, dash: 4, think: 5, shock: 6, slip: 7, dizzy: 8, kiss: 9, laughpoint: 10, cry: 11,
      cool: 12, dance: 13, peek: 14, crawl: 15, yawn: 16, sit: 17, question: 18, confetti: 19, dash2: 20, sleep: 21 } }
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
  .kin{position:absolute;left:0;top:0;will-change:transform;pointer-events:none}
  .kin-spr{width:100%;height:100%;background-repeat:no-repeat;transform-origin:50% 100%}
  .kin-spr.flip{transform:scaleX(-1)}
  .kin-hit{position:absolute;left:0;top:0;pointer-events:auto;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
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
    x: 40, y: 0, face: 1, queue: [], act: null, frameKey: '', raf: 0, last: 0,
    lastTouch: 0, hintStage: 0, nextBrain: 0, lastSlip: 0, lastSay: 0, sayT: 0, busyUntil: 0
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
    } else {
      const c = idx % META.poses.cols, r = Math.floor(idx / META.poses.cols), d = K.d;   // pose cells are k× bigger, shown at the same size
      s.backgroundImage = `url(${META.poses.url})`;
      s.backgroundSize = `${META.poses.cols * CW * d}px auto`;
      s.backgroundPosition = `${-c * CW * d}px ${-r * CH * d}px`;
    }
  }
  function place() {
    const top = K.ground - K.h - K.y;
    K.el.style.transform = `translate3d(${K.x.toFixed(1)}px,${top.toFixed(1)}px,0)`;
    K.spr.classList.toggle('flip', K.face < 0);
    // the touch area covers only the body and is switched off while it is in the air (never blocks letters)
    const hw = K.charH * .85, hh = K.charH * .95;
    const hx = K.x + K.w / 2 - hw / 2, hy = K.ground - hh;
    Object.assign(K.hit.style, { width: hw + 'px', height: hh + 'px', transform: `translate3d(${hx}px,${hy}px,0)` });
    K.hit.style.pointerEvents = K.y > 2 ? 'none' : 'auto';
    if (K.bubble.classList.contains('on')) placeBubble();
  }

  /* ---------- layout: stand on the strip under the letter grid ---------- */
  function layout() {
    if (!K.ready) return;
    const inner = K.host.inner().getBoundingClientRect();
    const vb = (window.visualViewport ? visualViewport.height : innerHeight);
    const ground = vb - 4;
    const space = ground - inner.bottom - 4;                  // free height between the last row of letters and the screen bottom
    K.charH = Math.max(40, Math.min(66, space));
    K.d = K.charH / META.charPx;
    K.w = META.cell[0] * K.d; K.h = META.cell[1] * K.d;
    K.ground = ground + 3 * K.d;                              // cells keep 3px under the feet
    K.el.style.width = K.w + 'px'; K.el.style.height = K.h + 'px';
    K.minX = -K.w * .12; K.maxX = innerWidth - K.w * .88;
    K.x = Math.max(K.minX, Math.min(K.maxX, K.x));
    K.layer.style.display = space < 34 ? 'none' : '';          // too little room on this screen: stay hidden instead of covering letters
    K.frameKey = ''; draw(); place();
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
    const leftSpace = K.x + K.w * .2 - 8, rightSpace = room - (K.x + K.w * .8);
    const right = rightSpace >= leftSpace;
    b.style.maxWidth = Math.max(110, Math.min(240, (right ? rightSpace : leftSpace) - 6)) + 'px';
    const bw = b.offsetWidth, bh = b.offsetHeight;
    let bx = right ? K.x + K.w * .78 : K.x + K.w * .22 - bw;
    bx = Math.max(6, Math.min(room - bw, bx));
    let by = K.ground - K.charH * .78 - bh / 2;
    by = Math.min(by, K.ground - bh - 2);
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
    } else {                       // 'play' (frame sequence) or 'pose' (single picture) or 'wait'
      if (a.t * 1000 >= a.ms) done = true;
    }
    if (done) { if (a.onEnd) a.onEnd(); K.act = null; }
  }
  function frameFor(a) {
    if (!a) return ['a', META.anim.seq.idle[0]];
    if (a.pose) return ['p', META.poses.index[a.pose]];
    const seq = META.anim.seq[a.anim || 'idle'], from = Math.min(a.from || 0, seq.length - 1), n = seq.length - from;
    let i = Math.floor((a.t || 0) * (a.fps || 10));
    if (a.hold) i = Math.min(i, n - 1);
    return ['a', seq[from + (i % n)]];
  }
  function draw() { const [k, i] = frameFor(K.act || K.idleAct); setFrame(k, i); }

  const A = {
    walk: to => ({ type: 'move', to, speed: K.charH * 1.1, anim: 'walk', fps: 12 }),
    run: to => ({ type: 'move', to, speed: K.charH * 3, anim: 'run', fps: 16 }),
    hopTo: to => ({ type: 'move', to, speed: K.charH * 1.8, anim: 'jump', fps: 13, hop: .55 }),
    jump: (dx, h) => ({ type: 'jump', ms: 700, dx: dx || 0, height: h || .45, anim: 'jump', fps: 13 }),
    play: (anim, ms, fps, extra) => Object.assign({ type: 'play', anim, ms, fps: fps || 11 }, extra || {}),
    pose: (pose, ms, extra) => Object.assign({ type: 'pose', pose, ms }, extra || {}),
    wait: ms => ({ type: 'wait', ms, anim: 'idle', fps: 5 })
  };
  function doNow(list, busyMs) { K.queue = list.slice(); K.act = null; K.y = 0; K.busyUntil = performance.now() + (busyMs || 0); K.nextBrain = performance.now() + (busyMs || 1500) + rnd(800, 2000); }
  const randX = () => rnd(K.minX + 10, K.maxX - 10);

  /* ---------- free-time behaviour ---------- */
  function brain(now) {
    if (K.act || K.queue.length || now < K.nextBrain) return;
    const r = Math.random();
    if (!REDUCED && now - K.lastSlip > 75000 && r < .07) slip();
    else if (r < .42) K.queue.push(A.walk(randX()), A.wait(rnd(900, 2200)));
    else if (r < .55 && !REDUCED) K.queue.push(A.run(randX()), A.wait(900));
    else if (r < .68 && !REDUCED) K.queue.push(A.hopTo(Math.max(K.minX, Math.min(K.maxX, K.x + rnd(-1, 1) * K.w * 2))), A.wait(700));
    else if (r < .78) K.queue.push(A.play('idle', 2200, 5));
    else if (r < .86) K.queue.push(A.pose(pick(['think', 'magnify', 'peek', 'question']), 1800, { fx: 'wobble' }));
    else if (r < .93) K.queue.push(A.jump(rnd(-1, 1) * K.w * .8));
    else K.queue.push(A.pose('dance', 1400, { fx: 'bounce' }), A.pose('cheer', 900));
    K.nextBrain = now + rnd(2500, 5500);
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
      layer.innerHTML = '<div class="kin"><div class="kin-spr"></div></div><div class="kin-hit"></div><div class="kin-say"></div>';
      (host.parent || document.body).appendChild(layer);
      Object.assign(K, { layer, el: layer.querySelector('.kin'), spr: layer.querySelector('.kin-spr'), hit: layer.querySelector('.kin-hit'), bubble: layer.querySelector('.kin-say') });
      layer.style.visibility = 'hidden';
      K.hit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); Kin.tap(); });
      // both sprite sheets must be loaded before Kinyonga shows up
      let n = 0; const done = () => { if (++n === 2) { K.ready = true; K.x = rnd(10, 60); layout(); layer.style.visibility = ''; loop(); } };
      [META.anim.url, META.poses.url].forEach(u => { const im = new Image(); im.onload = done; im.onerror = () => { layer.remove(); }; im.src = u; });
      addEventListener('resize', () => layout());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { K.last = 0; loop(); } });
    },
    layout,
    activity() {
      K.lastTouch = performance.now();
      const sleeping = K.hintStage >= 4 && K.act && (K.act.anim === 'sleep' || K.act.pose === 'yawn');
      K.hintStage = 0;
      if (sleeping) doNow([A.play('surprise', 900, 10, { hold: true, say: 'Lo! Nimeamka!', sayMs: 1500 })], 900);   // woke up
    },
    onLevelStart(first) {
      Kin.activity(); if (!K.ready) return;
      layout();
      doNow([A.walk(Math.max(K.minX, Math.min(K.maxX, K.x + rnd(-1, 1) * K.w))), A.play('talk', 1600, 10, { say: first ? SAY.greet[0] : (Math.random() < .35 ? pick(SAY.greet) : '') })], 1200);
    },
    onCorrect() {
      Kin.activity(); if (!K.ready) return;
      const r = Math.random();
      const list = r < .4 ? [A.pose('cheer', 900, { fx: 'bounce' }), A.pose('dance', 800, { fx: 'bounce' })]
                 : r < .7 ? [A.jump(0, .55), A.pose('confetti', 1000, { fx: 'bounce' })]
                 : [A.pose('laughpoint', 1100, { fx: 'bounce' })];
      if (Math.random() < .5) list[0].say = pick(SAY.correct);
      doNow(list, 1500);
    },
    onBonus() { if (!K.ready) return; doNow([A.pose('magnify', 1100, { fx: 'wobble', say: 'Neno la ziada! Safi!' })], 1100); },
    onWrong() {
      Kin.activity(); if (!K.ready) return;
      const list = Math.random() < .55 ? [A.play('laugh', 1300, 12)] : [A.play('joke', 1300, 6, { hold: true })];
      if (Math.random() < .65) list[0].say = pick(SAY.wrong);
      doNow(list, 1300);
    },
    onWin() {
      if (!K.ready) return;
      doNow([A.jump(0, .6), A.pose('confetti', 1100, { fx: 'bounce', say: pick(SAY.win) }), A.pose('dance', 900, { fx: 'bounce' }), A.jump(0, .5)], 3000);
    },
    tap() {
      if (!K.ready || K.y > 2) return;
      Kin.activity();
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
    // exposed for tests
    _K: K, _say: say
  };

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
      if (!K.act && !K.queue.length) { K.idleAct = K.idleAct || { anim: 'idle', fps: 4, t: 0 }; K.idleAct.t += dt; }
      update(dt); brain(now); stuck(now);
      draw(); place();
      K.raf = requestAnimationFrame(tick);
    };
    K.raf = requestAnimationFrame(tick);
  }
  // the player has not touched anything for a while: offer help, then point at a letter
  function stuck(now) {
    if (!K.lastTouch) K.lastTouch = now;
    const idle = now - K.lastTouch;
    if (K.hintStage === 0 && idle > 20000) {
      K.hintStage = 1; doNow([A.play('talk', 2200, 10, { say: pick(SAY.hint1), sayMs: 2600 })], 2200);
    } else if (K.hintStage === 1 && idle > 34000) {
      K.hintStage = 2;
      doNow([A.pose('point', 2200, { fx: 'bounce', say: pick(SAY.hint2), sayMs: 2600, onStart: () => { try { K.host.softHint && K.host.softHint(); } catch (_) {} } })], 2200);
    } else if (K.hintStage === 2 && idle > 60000) {
      K.hintStage = 3; doNow([A.pose('cheer', 1600, { fx: 'bounce', say: pick(SAY.cheer), sayMs: 2400 })], 1600);
    } else if (K.hintStage === 3 && idle > 90000) {
      K.hintStage = 4; doNow([A.pose('yawn', 1500), A.play('sleep', 6000, 1)], 7000);   // falls asleep; any touch wakes it
    }
  }

  window.Kinyonga = Kin;
})();
