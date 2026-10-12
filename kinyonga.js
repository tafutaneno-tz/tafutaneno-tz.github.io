/* =====================================================================
   KINYONGA – a little 2D character living inside the Tafuta Neno screen.

   Engine (one requestAnimationFrame loop, delta time, paused with the game):
     · body: x (feet centre), y (feet), vx, vy, face, ground (the platform he stands on)
     · platforms: the floor at the screen bottom, the top of the letter board and the top of every row of
       letter boxes (one-way: he lands on them from above and can jump up through them)
     · gravity, jumping, falling off edges, landing (a hard landing makes him tumble and get up)
     · one state machine: idle · walk · run · jump · fall · land · sit · sleep · talk · pose · play (laugh,
       cry, celebrate, interact) · angry · dragged – only one at a time, nothing else plays while he is in the air
     · navigation: walk on a platform, jump up to a higher one, drop through to a lower one
     · behaviour manager: picks what to do from the game situation (never the same thing twice in a row)
     · speech bubbles in Swahili; hints come from the real puzzle (the first letter of a hidden word)

   Host page calls:
     Kinyonga.init({ parent, inner, board, grid, sfx, topLimit, protect, isPlaying, starts, flashCell, softHint, cancelSelection })
     Kinyonga.onLevelStart(first) · onCorrect() · onWrong() · onBonus() · onWin()
     Kinyonga.activity() (player touched the board) · Kinyonga.boardDown(e) · Kinyonga.layout()
   Sprites: images/kinyonga-moves.webp (side animations, one row each), images/kinyonga-front.webp (front poses),
            images/kinyonga-poses.webp (sitting)
   ===================================================================== */
(function () {
  'use strict';

  const VER = 6;
  const MOVES = {                      // regions of the movement atlas (made from the character sheets)
    url: 'images/kinyonga-moves.webp?v=' + VER, cols: 11, cell: [240, 190], anchor: [130, 182], h: 140,
    anims: { idle: 0, walk: 1, run: 2, jump: 3, fall: 4, react: 5, celebrate: 6, tease: 7, cry: 8, angry: 9 },
    n: { idle: 8, walk: 9, run: 8, jump: 8, fall: 6, react: 7, celebrate: 6, tease: 8, cry: 6, angry: 8 }
  };
  const FRONT = {
    url: 'images/kinyonga-front.webp?v=' + VER, cols: 8, cell: [250, 210], anchor: [125, 204], h: 188,
    index: { point: 39, sleep: 25, hi: 19, cute: 36, think: 17, tease: 27, angry: 41, wow: 28, cheer: 2, kiss: 10, handheart: 38, shy: 33, cool: 18 }
  };
  const BRAIN = { url: 'images/kinyonga-brain.webp?v=' + VER, cols: 8, cell: [250, 230], anchor: [125, 226], h: 172,
    index: { wave: 0, thumbs: 1, laugh: 2, magnify: 3, map: 4, bulb: 5, point: 6, question: 7, heart: 8, cool: 9, celebrate: 10, trophy: 11, sleeprock: 12,
      sad: 13, grumpy: 14, playsign: 15, chest: 16, star: 17, gift: 18, compass: 19, scroll: 20, megaphone: 21, flag: 22 } };
  const THEMES = { url: 'images/kinyonga-themes.webp?v=' + VER, cols: 8, cell: [240, 230], anchor: [120, 226], h: 172,
    index: { point: 0, magnify: 1, map: 2, binoculars: 3, wave: 4, thumbs: 5, thumbs2: 6, question: 7, trophy: 8, laughthumb: 9, cool: 10, read: 11,
      stars: 14, heart: 15, monkey: 16, butterfly: 17, camera: 18, parrot: 19, exclaim: 20, shield: 21, knight: 22, builder: 23, scientist: 24, santa: 25,
      football: 26, graduate: 27, chef: 28, guitar: 29, garden: 30, painter: 31 } };
  const FACES = { url: 'images/kinyonga-faces.webp?v=' + VER, names: ['happy', 'wink', 'oh', 'laughing', 'worried', 'cool', 'cross', 'thinking'] };
  const POSES = { url: 'images/kinyonga-poses.webp?v=' + VER, cols: 6, cell: [282, 224], anchor: [141, 219], h: 149, index: { sit: 17 } };

  const SAY = {
    greet: ['Karibu! Tucheze!', 'Twende pamoja!', 'Habari! Tucheze!'],
    correct: ['Hongera!', 'Safi sana!', 'Hodari!', 'Bomba!', 'Wewe ni bingwa!'],
    wrong: ['Hehe, karibu!', 'Jaribu tena!', 'Hehe! Si hilo!', 'Umekaribia!'],
    win: ['Hongera! Umemaliza!', 'Safi sana! Twende tena!'],
    chat: ['Twende pamoja!', 'Unaona neno lolote?', 'Mimi ni Kinyonga!', 'Tafuta pamoja nami!', 'Nakuangalia! Hehe!', 'Endelea, unaweza!'],
    attention: ['Uko wapi? Tucheze!', 'Haya, tuendelee!', 'Twende pamoja!'],
    drag: ['Lo! Unanipeleka wapi?', 'Wee! Polepole!', 'Hehe!'],
    drop: ['Asante!', 'Nimefika!', 'Hapa ni pazuri!'],
    tumble: ['Lo!', 'Aaah!'], up: ['Niko sawa!', 'Sijaumia! Hehe!'],
    tap: ['Hihi! Umenipata!', 'Nakupenda!', 'Lo! Umenishtua!', 'Hehe!', 'Poa sana!', 'Wewe ni rafiki yangu!'],
    angry: ['Inatosha! Acha kunigusa!', 'Wee! Inatosha!', 'Acha basi!']
  };
  const BUBBLE = ['#ffffff', '#fff3b0', '#d9f99d', '#fbcfe8', '#bfdbfe', '#fde68a'];

  const CSS = `
  .kin-layer{position:fixed;inset:0;pointer-events:none;z-index:4;overflow:hidden}
  .kin{position:absolute;left:0;top:0;width:0;height:0;will-change:transform;pointer-events:none}
  .kin-spr{position:absolute;left:0;top:0;background-repeat:no-repeat}
  .kin-hit{position:absolute;left:0;top:0;pointer-events:auto;touch-action:none;-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none}
  .kin-say{position:absolute;left:0;top:0;max-width:220px;padding:6px 11px;border-radius:14px;background:#fff;color:#1d1630;
    font:900 .92rem/1.2 "Nunito",system-ui,sans-serif;box-shadow:0 4px 0 rgba(0,0,0,.18),0 6px 16px rgba(0,0,0,.25);
    border:2px solid rgba(29,22,48,.85);opacity:0;transform:scale(.6);transition:opacity .18s,transform .18s;pointer-events:none;white-space:normal}
  .kin-say.on{opacity:1;transform:scale(1)}
  .kin-face{display:inline-block;width:26px;height:26px;margin:-4px 6px -8px -4px;vertical-align:baseline;background:url(images/kinyonga-faces.webp?v=6) 0 0/208px 26px no-repeat}
  .kin-fx{position:absolute;font-size:20px;line-height:1;pointer-events:none;animation:kinFx 1.4s ease-out forwards}
  @keyframes kinFx{0%{opacity:0;transform:translate(0,0) scale(.5)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-70px) scale(1.15)}}
  @media (prefers-reduced-motion:reduce){.kin-fx{animation:none;opacity:0}}
  `;

  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const now = () => performance.now();
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LITE = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  /* ---------- state ---------- */
  const K = {
    ready: false, host: null, layer: null, el: null, spr: null, hit: null, bubble: null,
    x: 60, y: 0, vx: 0, vy: 0, face: 1, ground: null, ignoreAbove: null, H: 80, zoom: 1, bob: 0, cycle: 0,
    state: 'idle', st: 0, data: {}, plan: [], pending: null,
    plats: [], W: 360, Hs: 640, grid: null, inner: null, protect: [],
    lastTouch: 0, lastFind: 0, lastHint: -1e9, wrongStreak: 0, lastChat: 0, sayT: 0,
    lastActs: [], tapTimes: [], lastAngry: -1e9, lastTumble: -1e9, onBoardSince: 0, quietUntil: 0,
    frameKey: '', ghosted: false, drag: null, press: null, fallFrom: null
  };

  /* ---------- the world: platforms measured from the real screen ---------- */
  function layout() {
    if (!K.ready) return;
    const inner = K.host.inner().getBoundingClientRect();
    const vb = window.visualViewport ? visualViewport.height : innerHeight;
    const gi = K.host.grid ? K.host.grid() : null;
    K.W = innerWidth; K.Hs = vb;
    const n = gi && gi.n ? gi.n : 0, cs = n ? inner.width / n : 60;
    K.grid = n ? { left: inner.left, top: inner.top, cs, n } : null;
    K.inner = { left: inner.left, top: inner.top, right: inner.right, bottom: inner.bottom };
    K.H = clamp(cs * 1.6, 58, 100);                       // one size everywhere: about one and a half boxes tall
    const prevId = K.ground && K.ground.id;
    K.plats = [{ id: 'floor', y: vb - 4, x0: 0, x1: K.W, kind: 'floor' }];
    for (let r = 0; r < n; r++) K.plats.push({ id: 'r' + r, row: r, y: inner.top + r * cs, x0: inner.left + 2, x1: inner.right - 2, kind: r === 0 ? 'top' : 'row' });
    K.protect = (K.host.protect ? K.host.protect() : []).filter(r => r && r.width).map(r => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
    if (K.drag) return;
    K.x = clamp(K.x, minX(), maxX());
    const same = prevId && K.plats.find(p => p.id === prevId);
    if (same && K.x >= same.x0 && K.x <= same.x1) { K.ground = same; K.y = same.y; }
    else if (prevId) { K.ground = null; K.vy = 0; if (!isAir()) setState('fall'); }
    K.frameKey = ''; draw(); render();
  }
  const minX = () => K.H * .38, maxX = () => K.W - K.H * .38;
  const platById = id => K.plats.find(p => p.id === id);
  const floor = () => K.plats[0];
  const isAir = () => K.state === 'jump' || K.state === 'fall' || K.state === 'dragged';
  function platBelow(x, y) {           // the first platform under a point
    let best = null;
    for (const p of K.plats) { if (x < p.x0 || x > p.x1 || p.y < y - 1) continue; if (!best || p.y < best.y) best = p; }
    return best || floor();
  }
  const onLetters = () => !!K.ground && K.ground.kind === 'row';
  function overLetters() {             // does his body cover letters right now?
    const ib = K.inner; if (!ib) return false;
    const h = K.H * K.zoom, w = K.H * .5 * K.zoom;
    return !(K.x + w / 2 <= ib.left || K.x - w / 2 >= ib.right || K.y <= ib.top + 4 || K.y - h >= ib.bottom);
  }

  /* ---------- drawing ---------- */
  function frame(kind, idx) {
    const hh = K.H * K.zoom;
    const key = kind + idx + '/' + hh.toFixed(1);
    if (key === K.frameKey) return; K.frameKey = key;
    const m = kind === 'm' ? MOVES : kind === 'f' ? FRONT : kind === 'b' ? BRAIN : kind === 't' ? THEMES : POSES;
    const k = hh / m.h, s = K.spr.style;
    const c = idx % m.cols, r = Math.floor(idx / m.cols);
    s.width = m.cell[0] * k + 'px'; s.height = m.cell[1] * k + 'px';
    s.left = -m.anchor[0] * k + 'px'; s.top = -m.anchor[1] * k + 'px';
    s.transformOrigin = `${m.anchor[0] * k}px ${m.anchor[1] * k}px`;
    s.backgroundImage = `url(${m.url})`;
    s.backgroundSize = `${m.cols * m.cell[0] * k}px auto`;
    s.backgroundPosition = `${-c * m.cell[0] * k}px ${-r * m.cell[1] * k}px`;
    K.lastSc = '';
  }
  const moveFrame = (anim, i) => frame('m', MOVES.anims[anim] * MOVES.cols + i);
  let lastTf = '';
  function render() {
    const tf = `translate3d(${(K.x + (K.shake || 0)).toFixed(1)}px,${(K.y + K.bob).toFixed(1)}px,0)`;
    if (tf !== lastTf) { K.el.style.transform = tf; lastTf = tf; }
    const sc = K.face < 0 ? 'scaleX(-1)' : 'none';
    if (sc !== K.lastSc) { K.spr.style.transform = sc; K.lastSc = sc; }
    const h = K.H * .95 * K.zoom, w = K.H * .7 * K.zoom, hx = K.x - w / 2, hy = K.y - h;
    Object.assign(K.hit.style, { width: w + 'px', height: h + 'px', transform: `translate3d(${hx}px,${hy}px,0)` });
    const box = { left: hx, top: hy, right: hx + w, bottom: hy + h };
    const blocked = K.protect.some(r => !(box.right <= r.left || box.left >= r.right || box.bottom <= r.top || box.top >= r.bottom));
    K.hit.style.pointerEvents = (blocked || K.ghosted || K.zoom > 1.05) ? 'none' : 'auto';
    if (K.bubble.classList.contains('on')) placeBubble();
  }
  function ghost(on) { K.ghosted = on; K.layer.style.transition = 'opacity .2s'; K.layer.style.opacity = on ? '.25' : ''; }

  /* ---------- speech bubble ---------- */
  function say(text, ms, face) {
    if (!text) return;
    const b = K.bubble; b.textContent = text; b.style.background = pick(BUBBLE);
    const fi = face && K.facesReady ? FACES.names.indexOf(face) : -1;
    if (fi >= 0) { const i = document.createElement('i'); i.className = 'kin-face'; i.style.backgroundPosition = (-fi * 26) + 'px 0'; b.prepend(i); }
    b.classList.add('on'); placeBubble();
    clearTimeout(K.sayT); K.sayT = setTimeout(() => b.classList.remove('on'), ms || 2200);
  }
  function placeBubble() {
    const b = K.bubble, bw = b.offsetWidth, bh = b.offsetHeight, half = K.H * .32 * K.zoom;
    const right = K.x + half + bw + 8 <= K.W || K.x < K.W / 2;
    const bx = clamp(right ? K.x + half : K.x - half - bw, 6, K.W - bw - 6);
    const by = clamp(K.y - K.H * .85 * K.zoom - bh / 2, 6, K.Hs - bh - 6);
    b.style.transform = `translate3d(${bx}px,${by}px,0)`;
  }
  function effect(glyph, n, colors) {
    if (REDUCED) return;
    for (let i = 0; i < (n || 1); i++) {
      const h = document.createElement('div'); h.className = 'kin-fx'; h.textContent = glyph;
      if (colors) h.style.color = pick(colors);
      h.style.left = (K.x + rnd(-.2, .25) * K.H) + 'px'; h.style.top = (K.y - K.H * 1.05 * K.zoom) + 'px';
      h.style.setProperty('--dx', rnd(-26, 26).toFixed(0) + 'px'); h.style.animationDelay = (i * .18) + 's';
      K.layer.appendChild(h); setTimeout(() => h.remove(), 1700 + i * 200);
    }
  }

  /* =====================================================================
     STATE MACHINE – each state: enter(d), update(dt,d) -> true when it is over, draw(d)
     ===================================================================== */
  const WALK_SPEED = () => K.H * 1.05;
  const RUN_SPEED = () => K.H * 2.4;
  const G = () => K.H * 24;                      // gravity, scaled with his size
  const STATES = {
    idle: {
      enter(d) { d.blinkAt = rnd(2, 5); },
      update(dt, d) { return d.ms != null && K.st * 1000 >= d.ms; },
      draw(d) { const t = K.st % 6; moveFrame('idle', t > d.blinkAt && t < d.blinkAt + .25 ? 6 : 7); }   // calm smile, now and then a wink
    },
    walk: {           // to d.x on the current platform; the 8 leg pictures advance with the distance walked
      update(dt, d) {
        if (!K.ground) return true;
        const sp = d.run ? RUN_SPEED() : (d.speed || WALK_SPEED());
        const dx = d.x - K.x; if (Math.abs(dx) < 1) { K.x = d.x; return true; }
        K.face = Math.sign(dx);
        const mv = Math.min(Math.abs(dx), sp * dt); K.x += K.face * mv;
        K.cycle += mv / (K.H * (d.run ? 1.15 : .8));                       // one 8-picture cycle every .8 body heights
        K.bob = -Math.abs(Math.sin(K.cycle * Math.PI * 2)) * K.H * .02;    // the body rises a little on each step
        if (K.ground.kind !== 'floor' && ((K.x < K.ground.x0 && K.ground.x0 > minX() + 2) || (K.x > K.ground.x1 && K.ground.x1 < maxX() - 2))) {   // walked off the end of a row
          K.ground = null; K.vx = K.face * sp * .6; K.vy = 0; K.fallFrom = K.y; setState('fall'); return false;
        }
        if (K.ground.kind !== 'floor') K.x = clamp(K.x, Math.max(minX(), K.ground.x0), Math.min(maxX(), K.ground.x1));
        return false;
      },
      exit() { K.bob = 0; },
      draw(d) { { const a = d.run ? 'run' : 'walk', n = MOVES.n[a]; moveFrame(a, Math.floor((K.cycle % 1) * n) % n); } }
    },
    jump: {           // d: vx, vy, ignoreAbove (to drop through rows)
      enter(d) { K.ground = null; K.vx = d.vx || 0; K.vy = d.vy; K.ignoreAbove = d.ignoreAbove != null ? d.ignoreAbove : null; d.crouch = d.noCrouch ? 0 : .09; K.fallFrom = K.y; },
      update(dt, d) { if (K.st < d.crouch) return false; return airborne(dt); },
      draw(d) {
        if (K.st < d.crouch) return moveFrame('jump', 1);
        moveFrame('jump', K.vy < -K.H * 4 ? 2 : K.vy < 0 ? 3 : K.vy < K.H * 6 ? 4 : 5);
      }
    },
    fall: {
      enter(d) { K.ground = null; if (d.vy != null) K.vy = d.vy; if (K.fallFrom == null) K.fallFrom = K.y; },
      update(dt) { return airborne(dt); },
      draw() { moveFrame('jump', K.vy < 0 ? 4 : 5); }
    },
    land: {           // a soft landing; from high up he tumbles over and gets up again
      enter(d) { d.hard = d.drop > K.H * 3.2 && now() - K.lastTumble > 15000; if (d.hard) { K.lastTumble = now(); say(pick(SAY.tumble), 900); } },
      update(dt, d) {
        if (d.hard) { if (K.st > 2.6) { say(pick(SAY.up), 1400); return true; } return false; }
        return K.st > .22;
      },
      draw(d) { if (d.hard) moveFrame('fall', Math.min(5, Math.floor(K.st / 2.6 * 6))); else moveFrame('jump', K.st < .11 ? 6 : 7); }
    },
    sit: { update(dt, d) { return K.st * 1000 >= (d.ms || 6000); }, draw() { frame('p', POSES.index.sit); } },
    sleep: {
      enter(d) { d.z = .8; },
      update(dt, d) { if (K.st > d.z) { d.z = K.st + 1.9; effect('z', 1, ['#60a5fa', '#3b82f6']); } return false; },
      draw() { if (K.brainReady && K.ground && K.ground.kind === 'floor') frame('b', BRAIN.index.sleeprock); else frame('f', FRONT.index.sleep); }
    },
    talk: {           // mouth open / closed while the bubble is on
      enter(d) { say(d.text, d.ms); },
      update(dt, d) { return K.st * 1000 >= (d.ms || 2000); },
      draw() { moveFrame('idle', Math.floor(K.st * 4) % 2 ? 4 : 7); }
    },
    pose: {           // one picture held for a while (pointing at a letter, thumbs up, a wink…)
      enter(d) { if (d.text) say(d.text, d.ms, d.face); if (d.onStart) d.onStart(); },
      update(dt, d) { return K.st * 1000 >= d.ms; },
      draw(d) { if (d.kind === 'm') moveFrame(d.anim, d.idx); else frame(d.kind, d.idx); }
    },
    play: {           // a row of the atlas played through (laugh, cry, celebrate, interact)
      enter(d) { if (d.text) say(d.text, d.ms); d.fps = d.fps || 9; },
      update(dt, d) { return K.st * 1000 >= (d.ms || 8 / d.fps * 1000 * (d.times || 1)); },
      draw(d) { const i = Math.floor(K.st * d.fps); const n = MOVES.n[d.anim]; moveFrame(d.anim, d.hold ? Math.min(i, n - 1) : i % n); }
    },
    angry: {          // grows towards the player right where he is: cross face, tongue out, back to normal
      enter(d) {
        const room = Math.min(K.x, K.W - K.x) / (K.H * .42), up = (K.y - 14) / (K.H * 1.05);
        d.Z = clamp(Math.min(2.4, room, up), 1.25, 2.4); K.face = 1;
        K.quietUntil = now() + 9000; say('Acha!', 900);
      },
      update(dt, d) {
        const t = K.st;
        K.zoom = t < 1.2 ? 1 + (d.Z - 1) * ease(t / 1.2) : t < 4.4 ? d.Z : t < 5.4 ? d.Z + (1 - d.Z) * ease(t - 4.4) : 1;
        if (!d.s1 && t > 1.2) { d.s1 = 1; say(pick(SAY.angry), 2000); effect('💢', 3); }
        if (!d.s2 && t > 3) { d.s2 = 1; say('Bleee! 😛', 1500); }
        K.shake = t > 1.2 && t < 3 && !REDUCED ? Math.sin(t * 55) * K.H * .03 : 0;
        if (t > 5.4) { K.zoom = 1; K.shake = 0; return true; }
        return false;
      },
      exit() { K.zoom = 1; K.shake = 0; K.face = K.face; },
      draw() {
        const t = K.st;
        if (t < 3) frame('f', FRONT.index.angry);
        else if (t < 4.4) frame('f', FRONT.index.tease);
        else frame('f', FRONT.index.cute);
      }
    },
    dragged: {
      enter() { K.ground = null; K.vx = K.vy = 0; say(pick(SAY.drag), 1400); },
      update() { return false; },
      draw() { moveFrame('react', 4); }
    }
  };
  function setState(name, d) {
    const cur = STATES[K.state]; if (cur && cur.exit) cur.exit(K.data);
    K.state = name; K.st = 0; K.data = d || {};
    const s = STATES[name]; if (s.enter) s.enter(K.data);
  }
  // in the air: gravity, landing on the first platform crossed from above
  function airborne(dt) {
    const y0 = K.y;
    K.vy += G() * dt; K.x += K.vx * dt; K.y += K.vy * dt;
    if (K.x < minX()) { K.x = minX(); K.vx = Math.abs(K.vx) * .3; }
    if (K.x > maxX()) { K.x = maxX(); K.vx = -Math.abs(K.vx) * .3; }
    if (K.y < K.fallFrom) K.fallFrom = K.y;
    if (K.vy > 0) {
      let hit = null;
      for (const p of K.plats) {
        if (K.ignoreAbove != null && p.y < K.ignoreAbove) continue;
        if (y0 <= p.y + .5 && K.y >= p.y && K.x >= p.x0 && K.x <= p.x1 && (!hit || p.y < hit.y)) hit = p;
      }
      if (hit) {
        const drop = hit.y - (K.fallFrom != null ? K.fallFrom : hit.y);
        K.y = hit.y; K.ground = hit; K.vx = K.vy = 0; K.ignoreAbove = null; K.fallFrom = null;
        if (hit.kind === 'row') K.onBoardSince = now();
        setState('land', { drop });
        return false;
      }
    }
    if (K.y > K.Hs + K.H * 2) { K.y = floor().y; K.ground = floor(); K.vy = 0; K.fallFrom = null; setState('land', { drop: 0 }); }
    return false;
  }
  // jump from where he stands so that he lands on platform p near x
  function jumpTo(p, x) {
    const g = G(), dy = K.y - p.y;                 // > 0: up
    const apex = Math.max(K.H * .35, dy + K.H * .35);
    const vy = -Math.sqrt(2 * g * apex);
    const t = -vy / g + Math.sqrt(2 * Math.max(0, apex - dy) / g);
    setState('jump', { vx: (x - K.x) / t, vy, ignoreAbove: dy <= 0 ? p.y - 1 : null });
  }
  function dropTo(p, x) {              // a little hop, then down through the rows to a lower platform
    const g = G(), vy = -Math.sqrt(2 * g * K.H * .2), dy = p.y - K.y;
    const t = -vy / g + Math.sqrt(2 * (dy + K.H * .2) / g);
    setState('jump', { vx: (x - K.x) / t, vy, ignoreAbove: p.y - 1, noCrouch: true });
  }

  /* =====================================================================
     NAVIGATION + PLANS – a plan is a list of steps run one after another
     steps: {go: platformId, x}  {do: stateName, ...data}  {call: fn}
     ===================================================================== */
  const MAX_JUMP = () => K.H * 2.3;
  function navStep(s) {
    const target = platById(s.go) || floor();
    const tx = clamp(s.x, Math.max(minX(), target.x0 + K.H * .2), Math.min(maxX(), target.x1 - K.H * .2));
    if (!K.ground) return 'wait';
    if (K.ground === target) {
      if (Math.abs(K.x - tx) < 2) return 'done';
      setState('walk', { x: tx, run: Math.abs(K.x - tx) > K.H * 5 }); return 'busy';
    }
    if (target.y < K.ground.y) {                   // up: walk to the take-off point, jump (through rows); via a lower row if too high
      let to = target;
      if (K.ground.y - target.y > MAX_JUMP()) to = K.plats.filter(p => p.y < K.ground.y && K.ground.y - p.y <= MAX_JUMP()).sort((a, b) => a.y - b.y)[0] || target;
      const jx = clamp(tx, to.x0 + K.H * .3, to.x1 - K.H * .3);
      const takeoff = clamp(jx - Math.sign(jx - K.x) * K.H * .45, Math.max(minX(), K.ground.x0 + 2), Math.min(maxX(), K.ground.x1 - 2));
      if (Math.abs(K.x - takeoff) > K.H * .6) { setState('walk', { x: takeoff }); return 'busy'; }
      K.face = Math.sign(jx - K.x) || K.face; jumpTo(to, jx); return 'busy';
    }
    // down: hop through, drifting towards the target (or walk closer first when it is far to the side)
    const lx = clamp(tx, target.x0 + 4, target.x1 - 4);
    if (Math.abs(K.x - lx) > K.H * 2.2) {
      const wx = clamp(lx, Math.max(minX(), K.ground.x0 + 4), Math.min(maxX(), K.ground.x1 - 4));
      if (Math.abs(wx - K.x) > 2) { setState('walk', { x: wx }); return 'busy'; }
    }
    K.face = Math.sign(lx - K.x) || K.face; dropTo(target, clamp(lx, K.x - K.H * 1.5, K.x + K.H * 1.5)); return 'busy';
  }
  function runPlan() {
    if (K.state !== 'idle' || !K.data.soft && K.data.ms != null) return;
    while (K.plan.length) {
      const s = K.plan[0];
      if (s.go != null) { const r = navStep(s); if (r === 'done') { K.plan.shift(); continue; } return; }
      K.plan.shift();
      if (s.call) { s.call(); if (K.state !== 'idle') return; continue; }
      if (s.do) { setState(s.do, Object.assign({}, s)); return; }
    }
  }
  function plan(list, replace) { if (replace) K.plan = []; K.plan.push(...list); }
  function stateDone() {
    if (!K.ground && K.state !== 'dragged') { setState('fall'); return; }
    setState('idle', { soft: true });
  }

  /* =====================================================================
     BEHAVIOUR MANAGER – picks the next thing from the situation; never the same twice in a row
     ===================================================================== */
  const SLEEP_AFTER = 26000, ATTENTION_AFTER = 12000, STRUGGLE = 35000, HINT_GAP = 30000;
  const last = () => K.lastActs[K.lastActs.length - 1];
  function act(name, steps) { K.lastActs.push(name); if (K.lastActs.length > 2) K.lastActs.shift(); plan(steps, true); }
  function think() {
    if (K.plan.length || K.state !== 'idle' || K.drag || !K.ground) return;
    if (K.st < (K.data.wait != null ? K.data.wait : 1.2)) return;            // a short pause between activities
    const t = now(), idle = t - K.lastTouch;
    if (onLetters() && t - K.onBoardSince > 6000) { act('offLetters', [{ go: pick(['r0', 'floor']), x: K.x }]); return; }   // words stay readable
    if (idle > SLEEP_AFTER) { act('sleep', [{ do: 'sleep' }]); return; }
    if (idle > ATTENTION_AFTER && last() !== 'attention' && last() !== 'sleep') {         // the player is quiet: come closer, wave
      act('attention', [{ go: 'floor', x: clamp(K.W / 2 + rnd(-1, 1) * K.H, minX(), maxX()) }, P('megaphone', 2000, pick(SAY.attention), { face: 'happy' })]); return;
    }
    if (t >= BR.hintNext && ((t - K.lastFind > 28000 && idle < 9000) || K.wrongStreak >= 3)) { if (hintStep()) return; }
    const here = K.ground;
    const options = [
      ['stroll', 3, () => [{ go: here.id, x: K.x + (Math.random() < .5 ? -1 : 1) * rnd(1, 3) * K.H }, { do: 'idle', ms: rnd(1500, 3000) }]],
      ['explore', 1.6, () => {
        const id = here.id === 'floor' && K.grid ? 'r0' : 'floor', p = platById(id) || floor();
        return [{ go: id, x: rnd(p.x0 + K.H, p.x1 - K.H) }, { do: 'idle', ms: rnd(1500, 3000) }];
      }],
      ['boxes', K.grid ? .9 : 0, () => {           // up onto a row of boxes for a little while
        const r = Math.max(1, Math.floor(rnd(K.grid.n * .4, K.grid.n))), p = platById('r' + r);
        return [{ go: 'r' + r, x: clamp(K.x, p.x0 + K.H, p.x1 - K.H) }, { do: 'pose', kind: 'm', anim: 'react', idx: 6, ms: 1600 }, { go: pick(['r0', 'floor']), x: K.x }];
      }],
      ['hop', .7, () => [{ call: () => jumpTo(here, clamp(K.x + K.face * K.H * .4, here.x0 + 4, here.x1 - 4)) }]],
      ['wink', 1, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 6, ms: 1500 }]],
      ['thumbs', .8, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 3, ms: 1800 }]],
      ['chat', 1, () => [{ do: 'talk', text: t - K.lastChat > 15000 ? (K.lastChat = t, pick(SAY.chat)) : '', ms: 2200 }]],
      ['sit', .7, () => [{ do: 'sit', ms: rnd(4000, 7000) }]],
      ['hobby', K.themesReady ? 2 : 0, () => { const n = pickHobby(); return [T(n, rnd(4200, 5600), Math.random() < .6 ? HOBBY_SAY[n] : '', { face: 'happy' })]; }],
      ['wave', .6, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 0, ms: 1600 }]],
      ['stumble', t - K.lastTumble > 90000 ? .35 : 0, () => { K.lastTumble = t; return [{ do: 'play', anim: 'fall', fps: 3.1, ms: 2600, hold: true, text: pick(SAY.tumble) }, { do: 'talk', text: pick(SAY.up), ms: 1400 }]; }]
    ].filter(o => o[1] > 0 && !K.lastActs.includes(o[0]));
    let sum = options.reduce((s, o) => s + o[1], 0), r = Math.random() * sum, ch = options[0];
    for (const o of options) { r -= o[1]; if (r <= 0) { ch = o; break; } }
    act(ch[0], ch[2]());
  }

  // a hint from the real puzzle: stand next to the first letter of a hidden word and point at it
  function hintVisit(cell) {
    if (!K.grid) return false;
    let starts = []; try { starts = cell ? [cell] : (K.host.starts && K.host.starts()) || []; } catch (_) {}
    if (!starts.length) return false;
    const g = K.grid;
    const [r, c] = starts.slice().sort((a, b) => Math.abs(g.left + (a[1] + .5) * g.cs - K.x) - Math.abs(g.left + (b[1] + .5) * g.cs - K.x))[0];
    const side = c >= g.n - 1 ? -1 : c === 0 ? 1 : (Math.random() < .5 ? -1 : 1);
    const sx = g.left + (c + side + .5) * g.cs;
    const plat = r + 1 < g.n ? 'r' + (r + 1) : 'floor';      // on the boxes just under that letter, one box to the side
    K.lastHint = now(); K.wrongStreak = 0;
    act('hint', [
      { do: 'talk', text: pick(['Nikupe kidokezo?', 'Ngoja, nakuonyesha!']), ms: 1300 },
      { go: plat, x: sx },
      { call: () => { K.face = -side; } },
      { do: 'pose', kind: 'f', idx: FRONT.index.point, ms: 3000, text: pick(['Anza hapa!', 'Angalia herufi hizi!']),
        onStart: () => { try { K.host.flashCell ? K.host.flashCell(r, c) : K.host.softHint(); } catch (_) {} } },
      { go: pick(['r0', 'floor']), x: K.x }
    ]);
    K.hintCell = [r, c];
    return true;
  }
  const helping = () => K.lastActs[K.lastActs.length - 1] === 'hint' && K.plan.length > 0;

  // reactions to the game wait until he is standing (never mixed with a jump or a fall)
  function react(steps, quietMs) {
    if (K.drag) return;
    if (isAir() || K.state === 'land' || K.state === 'angry') { K.pending = steps; return; }
    K.plan = []; setState('idle', { soft: true, wait: 0 }); plan(steps, true);
    K.quietUntil = now() + (quietMs || 2000);
  }

  /* =====================================================================
     BRAIN – he follows the puzzle: which words are left, how the player is doing, what the level is about,
     what day it is. Hints get clearer step by step; tries that were nearly right get a helpful answer.
     ===================================================================== */
  const MEM_KEY = 'tn_kin_mem';
  const memLoad = () => { try { return JSON.parse(localStorage.getItem(MEM_KEY)) || {}; } catch (_) { return {}; } };
  const memSave = m => { try { localStorage.setItem(MEM_KEY, JSON.stringify(m)); } catch (_) {} };
  const BR = { streak: 0, prevFind: 0, levelStart: 0, found: 0, hintWord: null, hintStage: 0, hintNext: 0, greeted: false };
  function puzzle() { try { return (K.host.words && K.host.words()) || []; } catch (_) { return []; } }
  const unfound = () => puzzle().filter(w => !w.found);
  const category = () => { try { return (K.host.category && K.host.category()) || ''; } catch (_) { return ''; } };
  const dirOf = cells => cells.length > 1 ? [Math.sign(cells[1][0] - cells[0][0]), Math.sign(cells[1][1] - cells[0][1])] : [0, 1];
  function dirWord([dr, dc]) { if (dr && dc) return 'kwa mshazari'; if (dc > 0) return 'kulia'; if (dc < 0) return 'kushoto'; return dr > 0 ? 'chini' : 'juu'; }
  function placeWord([r, c]) {
    const n = K.grid ? K.grid.n : 8;
    const v = r < n / 3 ? 'juu' : r >= n * 2 / 3 ? 'chini' : '', h = c < n / 3 ? 'kushoto' : c >= n * 2 / 3 ? 'kulia' : '';
    if (!v && !h) return 'katikati ya ubao';
    if (!h) return v + ', katikati';
    return (v ? v + ', ' : '') + 'upande wa ' + h;
  }
  // a pose from the new sheets (brain first, then themes); falls back to a reaction picture
  function P(name, ms, text, extra) {
    let kind = null, idx = 0;
    if (K.brainReady && BRAIN.index[name] != null) { kind = 'b'; idx = BRAIN.index[name]; }
    else if (K.themesReady && THEMES.index[name] != null) { kind = 't'; idx = THEMES.index[name]; }
    return Object.assign(kind ? { do: 'pose', kind, idx, ms, text } : { do: 'pose', kind: 'm', anim: 'react', idx: 3, ms, text }, extra || {});
  }
  function T(name, ms, text, extra) {          // themes first (hobbies and costumes)
    if (K.themesReady && THEMES.index[name] != null) return Object.assign({ do: 'pose', kind: 't', idx: THEMES.index[name], ms, text }, extra || {});
    return P(name, ms, text, extra);
  }
  const CAT_POSES = { CHAKULA: ['chef'], JIKONI: ['chef'], MATUNDA: ['chef', 'garden'], MBOGA: ['garden', 'chef'], SOKONI: ['chef', 'map'], BUSTANI: ['garden'],
    MICHEZO: ['football'], MUZIKI: ['guitar'], KAZI: ['builder'], TEKNOLOJIA: ['scientist', 'camera'], SHULE: ['read', 'graduate'], RANGI: ['painter'],
    WANYAMA: ['monkey', 'binoculars', 'camera'], MIFUGO: ['monkey'], NDEGE: ['parrot', 'binoculars'], WADUDU: ['butterfly', 'magnify'], BAHARI: ['binoculars'],
    ANGA: ['binoculars'], USAFIRI: ['map', 'compass'], MIJI: ['map', 'camera'], NCHI: ['map', 'compass'], FAMILIA: ['heart'], HISIA: ['heart'], SALAMU: ['wave'],
    MAVAZI: ['cool'], METHALI: ['read', 'scroll'], SIFA: ['star'], NYUMBANI: ['read'], NAMBA: ['scientist'] };
  const HOBBY_SAY = { chef: 'Nitapika chakula kitamu! 🍲', garden: 'Namwagilia mmea wangu 🌱', football: 'Goli! ⚽', guitar: 'La la la! 🎵', builder: 'Ninajenga nyumba! 🔨',
    scientist: 'Jaribio la sayansi! 🧪', camera: 'Tabasamu! 📸', read: 'Ninasoma kitabu 📖', graduate: 'Nimehitimu! 🎓', painter: 'Ninachora picha 🎨',
    monkey: 'Tumbili ni rafiki yangu! 🐒', binoculars: 'Naona mbali sana! 🔭', parrot: 'Kasuku anasema habari! 🦜', butterfly: 'Kipepeo mzuri! 🦋',
    magnify: 'Ninachunguza… 🔍', map: 'Tuko wapi sasa? 🗺️', compass: 'Kaskazini iko huku! 🧭', heart: 'Nakupenda, rafiki! ❤️', wave: 'Habari yako!',
    cool: 'Mimi ni maridadi! 😎', scroll: 'Methali nzuri!', star: 'Wewe ni nyota! ⭐', knight: 'Mimi ni shujaa! 🛡️', santa: 'Heri ya Krismasi! 🎁' };
  const GENERAL_HOBBIES = ['read', 'camera', 'butterfly', 'guitar', 'binoculars', 'garden', 'painter', 'cool', 'heart', 'parrot', 'monkey'];
  function pickHobby() {
    const own = CAT_POSES[category()] || [];
    let pool = Math.random() < .6 && own.length ? own : GENERAL_HOBBIES;
    if (new Date().getMonth() === 11 && Math.random() < .3) pool = ['santa'];
    pool = pool.filter(n => n !== K.lastHobby); const n = pick(pool.length ? pool : GENERAL_HOBBIES); K.lastHobby = n; return n;
  }

  // hints: the same hidden word each time, a clearer clue each step
  function hintTarget() {
    const u = unfound(); if (!u.length) return null;
    if (BR.hintWord) { const w = u.find(x => x.w === BR.hintWord); if (w) return w; }
    const w = u.slice().sort((a, b) => a.w.length - b.w.length)[0];
    BR.hintWord = w.w; BR.hintStage = 0; return w;
  }
  function hintStep() {
    const w = hintTarget(); if (!w) return false;
    const st = BR.hintStage++, t = now();
    BR.hintNext = t + (st < 3 ? 16000 : 26000); K.lastHint = t; K.wrongStreak = 0;
    if (st === 0) act('hint', [P('magnify', 2400, 'Ngoja… ninatafuta! 🔍', { face: 'thinking' }), P('scroll', 3000, `Neno moja lina herufi ${w.w.length}.`, { face: 'thinking' })]);
    else if (st === 1) act('hint', [P('map', 3800, `Liko ${placeWord(w.cells[0])}. Linaenda ${dirWord(dirOf(w.cells))}.`, { face: 'thinking' })]);
    else if (st === 2) act('hint', [P('bulb', 3200, `Linaanza na herufi “${w.w[0]}”!`, { face: 'oh' })]);
    else return hintVisit(w.cells[0]);
    return true;
  }
  // a wrong try: was it nearly right?
  function analyse(info) {
    if (!info || !info.cells || info.cells.length < 2) return null;
    const sel = info.cells, sd = dirOf(sel), s0 = sel[0];
    const same = (a, b) => a[0] === b[0] && a[1] === b[1];
    for (const w of unfound()) {
      const wd = dirOf(w.cells), last = w.cells[w.cells.length - 1];
      const fwd = same(s0, w.cells[0]) && sd[0] === wd[0] && sd[1] === wd[1];
      const back = same(s0, last) && sd[0] === -wd[0] && sd[1] === -wd[1];
      if (fwd || back) return sel.length < w.w.length ? 'short' : 'long';
    }
    for (const w of unfound()) { const n = sel.filter(a => w.cells.some(b => same(a, b))).length; if (n >= 2) return 'close'; }
    return null;
  }
  function dayKey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function sessionGreeting() {
    const m = memLoad(), d = new Date(), today = dayKey(d), h = d.getHours();
    const tod = h < 11 ? 'Habari za asubuhi!' : h < 16 ? 'Habari za mchana!' : h < 21 ? 'Habari za jioni!' : 'Usiku mwema!';
    const steps = [P('wave', 2200, tod, { face: 'happy' })];
    if (!m.last) { m.streak = 1; steps.push(P('playsign', 2800, 'Mimi ni Kinyonga. Tucheze pamoja!', { face: 'happy' })); }
    else if (m.last !== today) {
      const gap = Math.round((new Date(today) - new Date(m.last)) / 864e5);
      m.streak = gap === 1 ? (m.streak || 1) + 1 : 1;
      if (m.streak >= 2) steps.push(P('gift', 2800, `Siku ${m.streak} mfululizo! Hongera! 🎁`, { face: 'happy' }));
      else if (gap >= 3) steps.push(P('heart', 2600, 'Nimekukumbuka, rafiki! ❤️', { face: 'happy' }));
    } else if (Math.random() < .5) steps.push(P('thumbs', 1800, 'Karibu tena!', { face: 'wink' }));
    if (h >= 23 || h < 5) steps.push({ do: 'talk', text: 'Ni usiku sana… usisahau kulala 😴', ms: 2400 });
    m.last = today; memSave(m);
    return steps;
  }
  function categoryIntro() {
    const c = category(); if (!c || c === 'KAWAIDA') return null;
    const own = CAT_POSES[c];
    const text = c === 'METHALI' ? 'Tutafute methali! 📜' : c === 'MCHANGANYIKO' ? 'Changamoto! Uko tayari? 🏁' : `Tutafute maneno ya ${c.toLowerCase()}!`;
    return own ? T(own[0], 2600, text, { face: 'happy' }) : (c === 'MCHANGANYIKO' ? P('flag', 2400, text) : { do: 'talk', text, ms: 2200 });
  }

  /* =====================================================================
     PUBLIC API
     ===================================================================== */
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
      // finger on him: tap = a reaction, press and move (or hold still) = carry him
      K.hit.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); press(e, false); try { K.hit.setPointerCapture(e.pointerId); } catch (_) {} });
      addEventListener('pointerdown', e => {      // on his body where the touch area is off (faded over the letters): the same
        if (!K.ready || K.drag || K.press || e.target === K.hit || K.layer.style.visibility === 'hidden') return;
        if (K.host.isPlaying && !K.host.isPlaying()) return;
        if (e.target.closest && e.target.closest('button,a,input')) return;
        if (!onBody(e.clientX, e.clientY)) return;
        press(e, true);
      }, true);
      addEventListener('pointermove', e => {
        if (K.drag && e.pointerId === K.drag.id) { moveDrag(e.clientX, e.clientY); return; }
        const p = K.press;
        if (p && e.pointerId === p.id && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 7) {
          clearTimeout(p.t); K.press = null;
          if (p.board) { try { K.host.cancelSelection && K.host.cancelSelection(); } catch (_) {} }
          startDrag(p.x, p.y, p.id); moveDrag(e.clientX, e.clientY);
        }
      }, { passive: true });
      const up = e => {
        if (K.ghostHold) { K.ghostHold = false; clearTimeout(K.ghostT); K.ghostT = setTimeout(() => ghost(false), 600); }
        if (K.drag && e.pointerId === K.drag.id) { endDrag(); return; }
        const p = K.press;
        if (p && e.pointerId === p.id) { clearTimeout(p.t); K.press = null; if (e.type === 'pointerup') tap(); }
      };
      addEventListener('pointerup', up); addEventListener('pointercancel', up);
      let n = 0; const need = [MOVES.url, FRONT.url, POSES.url];
      const done = () => { if (++n === need.length) {
        K.ready = true; layout(); K.ground = floor(); K.y = floor().y; K.x = rnd(minX(), K.W * .3); setState('idle');
        layer.style.visibility = ''; loop();
        [[BRAIN.url, 'brainReady'], [THEMES.url, 'themesReady'], [FACES.url, 'facesReady']].forEach(([u, f]) => { const im = new Image(); im.onload = () => { K[f] = true; }; im.src = u; });
      } };
      need.forEach(u => { const im = new Image(); im.onload = done; im.onerror = done; im.src = u; });
      addEventListener('resize', () => layout());
      document.addEventListener('visibilitychange', () => { if (!document.hidden) { K.last = 0; loop(); } });
    },
    layout,
    activity(fromEvent) {
      K.lastTouch = now();
      if (!K.ready || K.drag) return;
      if (K.state === 'sleep') { setState('idle', { soft: true, wait: 0 }); if (!fromEvent) plan([{ do: 'pose', kind: 'm', anim: 'react', idx: 4, ms: 1100, text: 'Lo! Nimeamka!' }], true); }
      if (fromEvent) return;
      if (overLetters() && K.state !== 'angry') {        // the player works on the letters: he fades and gets out of the way
        ghost(true); K.ghostHold = true; clearTimeout(K.ghostT);
        if (onLetters() && !helping() && !isAir()) { setState('idle', { soft: true, wait: 0 }); plan([{ go: pick(['r0', 'floor']), x: K.x }], true); }
      }
    },
    onLevelStart(first) {
      K.lastTouch = K.lastFind = now(); K.wrongStreak = 0;
      BR.levelStart = now(); BR.found = 0; BR.streak = 0; BR.hintWord = null; BR.hintStage = 0; BR.hintNext = 0;
      if (!K.ready) return;
      K.plan = []; K.pending = null; K.zoom = 1;
      layout();
      if (!isAir()) setState('idle', { soft: true, wait: 0 });
      let steps;
      if (!BR.greeted) { BR.greeted = true; steps = sessionGreeting(); const ci = categoryIntro(); if (ci && Math.random() < .5) steps.push(ci); }
      else { const ci = Math.random() < .45 ? categoryIntro() : null; steps = ci ? [ci] : [{ do: 'talk', text: Math.random() < .3 ? pick(SAY.greet) : '', ms: 1600 }]; }
      plan(steps, true);
    },
    onCorrect(word) {
      const t = now(); K.lastTouch = K.lastFind = t; K.wrongStreak = 0;
      BR.streak = t - BR.prevFind < 7000 ? BR.streak + 1 : 1; BR.prevFind = t; BR.found++;
      if (!K.ready) return;
      const left = unfound().length;
      let step;
      if (word && word === BR.hintWord) step = P('thumbs', 1900, 'Umeipata! Hongera! 👏', { face: 'happy' });
      else if (left === 1) step = P('megaphone', 2200, 'Neno moja tu limebaki! 📣', { face: 'oh' });
      else if (BR.streak >= 3) step = P('cool', 2000, 'Moto moto! Uko kasi! 🔥', { face: 'cool' });
      else if (word && word.length >= 7) step = P('star', 2000, 'Neno refu! Hodari! ⭐', { face: 'happy' });
      else if (BR.found === 1) step = P('laugh', 1700, 'Mwanzo mzuri!', { face: 'laughing' });
      else step = { do: 'play', anim: 'celebrate', fps: 10, ms: 1700, text: pick(SAY.correct) };
      if (word === BR.hintWord) BR.hintWord = null;
      BR.hintStage = 0; BR.hintNext = t + 12000;
      react([step]);
    },
    onBonus(word) { if (K.ready) react([P('chest', 2200, 'Hazina! Neno la ziada! 💎', { face: 'happy' })]); },
    onRepeat() { K.lastTouch = now(); if (K.ready && !helping()) react([P('question', 1800, 'Umeshalipata hili! 😄', { face: 'laughing' })]); },
    onWrong(info) {
      K.lastTouch = now(); K.wrongStreak++;
      if (!K.ready || helping()) return;
      const kind = analyse(info);
      let step;
      if (kind === 'short') step = P('question', 2000, 'Endelea kidogo! 👉', { face: 'thinking' });
      else if (kind === 'long') step = P('question', 2000, 'Umezidi kidogo!', { face: 'oh' });
      else if (kind === 'close') step = P('question', 2000, 'Umekaribia sana!', { face: 'thinking' });
      else if (K.wrongStreak >= 3) { step = P('sad', 2200, 'Usijali, tutaipata pamoja!', { face: 'worried' }); BR.hintNext = now() + 2500; }
      else step = { do: 'play', anim: 'tease', fps: 9, ms: 1700, text: pick(SAY.wrong) };
      K.lastWrongKind = kind;
      react([step]);
    },
    onWin() {
      if (!K.ready) return;
      const m = memLoad(), time = now() - BR.levelStart, avg = m.avgWin || 0;
      m.wins = (m.wins || 0) + 1; m.avgWin = avg ? avg * .8 + time * .2 : time; memSave(m);
      let lvl = 0; try { lvl = K.host.levelNo ? K.host.levelNo() : 0; } catch (_) {}
      const step = lvl && lvl % 10 === 0 ? P('celebrate', 2600, `Viwango ${lvl}! Hongera sana! 🎉`, { face: 'happy' })
        : m.wins > 3 && avg && time < avg * .75 ? P('trophy', 2600, 'Haraka sana! Bingwa! 🏆', { face: 'happy' })
        : P('flag', 2400, pick(SAY.win), { face: 'happy' });
      react([{ call: () => { if (K.ground) jumpTo(K.ground, K.x); } }, step], 3500);
    },
    boardDown(e) { return !!(K.press && K.press.id === e.pointerId); },
    // exposed for tests
    _K: K, _go: (id, x) => { setState('idle', { soft: true, wait: 0 }); plan([{ go: id, x }], true); }, _plats: () => K.plats, _hint: () => hintVisit(), _over: () => overLetters(), _setState: setState, _quiet: ms => { K.quietUntil = now() + ms; }, _BR: BR, _hintStep: () => hintStep(), _analyse: analyse
  };

  function onBody(px, py) {
    const h = K.H * .95 * K.zoom, w = K.H * .7 * K.zoom;
    return px >= K.x - w / 2 && px <= K.x + w / 2 && py >= K.y - h && py <= K.y;
  }
  function press(e, board) {
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, board };
    p.t = setTimeout(() => { if (K.press === p && !K.drag) { K.press = null; if (p.board) { try { K.host.cancelSelection(); } catch (_) {} } startDrag(p.x, p.y, p.id); } }, 450);
    K.press = p;
  }
  function tap() {
    if (!K.ready || K.state === 'angry') return;
    K.lastTouch = now();
    try { K.host.sfx && K.host.sfx.select && K.host.sfx.select(); } catch (_) {}
    if (K.state === 'sleep') { setState('idle', { soft: true, wait: 0 }); plan([{ do: 'pose', kind: 'm', anim: 'react', idx: 4, ms: 1100, text: 'Lo! Nimeamka!' }], true); return; }
    const t = now();
    K.tapTimes = K.tapTimes.filter(x => t - x < 12000); K.tapTimes.push(t);
    if (K.tapTimes.length >= 5 && t - K.lastAngry > 15000 && !isAir() && K.state !== 'land') {   // tapped again and again: cross, right where he is
      K.lastAngry = t; K.tapTimes = []; K.plan = []; K.pending = null; setState('angry'); return;
    }
    const i = pick([0, 1, 2, 3, 5, 6].filter(v => v !== K.lastTapPose)); K.lastTapPose = i;
    react([{ do: 'pose', kind: 'm', anim: 'react', idx: i, ms: 1700, text: pick(SAY.tap) }], 1700);
  }
  function startDrag(px, py, id) {
    K.plan = []; K.pending = null; K.zoom = 1; ghost(false); K.ghostHold = false;
    K.drag = { id, ox: K.x - px, oy: K.y - py, lx: px, ly: py, lt: now(), vx: 0, vy: 0 };
    setState('dragged'); K.lastTouch = now();
  }
  function moveDrag(px, py) {
    const d = K.drag; if (!d) return;
    const t = now(), dtt = Math.max(8, t - d.lt) / 1000;
    d.vx = d.vx * .5 + (px - d.lx) / dtt * .5; d.vy = d.vy * .5 + (py - d.ly) / dtt * .5;
    d.lx = px; d.ly = py; d.lt = t;
    K.x = clamp(px + d.ox, minX(), maxX()); K.y = clamp(py + d.oy, K.H + 4, floor().y);
    if (Math.abs(d.vx) > 30) K.face = Math.sign(d.vx);
  }
  function endDrag() {
    const d = K.drag; K.drag = null; K.lastTouch = now();
    // let go: he keeps a little of the finger's speed and falls onto whatever is under him
    const p = platBelow(K.x, K.y);
    K.fallFrom = K.y;
    K.pending = [{ do: 'talk', text: pick(SAY.drop), ms: 1300 }];
    K.lastActs = ['drop'];
    if (p.y - K.y < 3) { K.y = p.y; K.ground = p; if (p.kind === 'row') K.onBoardSince = now(); setState('land', { drop: 0 }); }
    else { K.ground = null; K.vx = clamp(d.vx * .25, -K.H * 3, K.H * 3); K.vy = clamp(d.vy * .25, -K.H * 4, K.H * 4); setState('fall', {}); }
  }

  /* ---------- main loop ---------- */
  function loop() {
    if (K.raf || !K.ready) return;
    const tick = ts => {
      K.raf = 0;
      if (document.hidden) return;
      const playing = K.host.isPlaying ? K.host.isPlaying() : true;
      if (!playing) { K.last = 0; K.raf = requestAnimationFrame(tick); return; }      // game paused: so is he
      if (LITE && K.last && ts - K.last < 30) { K.raf = requestAnimationFrame(tick); return; }
      const dt = K.last ? Math.min(.05, (ts - K.last) / 1000) : 0; K.last = ts;
      step(dt);
      K.raf = requestAnimationFrame(tick);
    };
    K.raf = requestAnimationFrame(tick);
  }
  function draw() { STATES[K.state].draw(K.data); }
  function step(dt) {
    K.st += dt;
    if (STATES[K.state].update(dt, K.data)) stateDone();
    if (K.pending && !isAir() && K.state !== 'land' && K.state !== 'angry' && !K.drag) { const p = K.pending; K.pending = null; K.plan = []; setState('idle', { soft: true, wait: 0 }); plan(p, true); }
    runPlan();
    if (now() > K.quietUntil) think();
    draw(); render();
  }

  window.Kinyonga = Kin;
})();
