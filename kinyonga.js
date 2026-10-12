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

  const VER = 4;
  const MOVES = {                      // regions of the movement atlas (made from the character sheets)
    url: 'images/kinyonga-moves.webp?v=' + VER, cols: 8, cell: [200, 190], anchor: [100, 182], h: 140,
    anims: { idle: 0, walk: 1, run: 2, jump: 3, fall: 4, react: 5, celebrate: 6, tease: 7, cry: 8, angry: 9 }
  };
  const FRONT = {
    url: 'images/kinyonga-front.webp?v=' + VER, cols: 8, cell: [250, 210], anchor: [125, 204], h: 188,
    index: { point: 39, sleep: 25, hi: 19, cute: 36, think: 17, tease: 27, angry: 41, wow: 28, cheer: 2, kiss: 10, handheart: 38, shy: 33, cool: 18 }
  };
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
    const key = kind + idx + '/' + K.H;
    if (key === K.frameKey) return; K.frameKey = key;
    const m = kind === 'm' ? MOVES : kind === 'f' ? FRONT : POSES;
    const k = K.H / m.h, s = K.spr.style;
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
    const tf = `translate3d(${K.x.toFixed(1)}px,${(K.y + K.bob).toFixed(1)}px,0)`;
    if (tf !== lastTf) { K.el.style.transform = tf; lastTf = tf; }
    const sc = `scale(${((K.face < 0 ? -1 : 1) * K.zoom).toFixed(3)},${K.zoom.toFixed(3)})`;
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
  function say(text, ms) {
    if (!text) return;
    const b = K.bubble; b.textContent = text; b.style.background = pick(BUBBLE);
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
      draw(d) { const t = K.st % 6; moveFrame('idle', t > d.blinkAt && t < d.blinkAt + .25 ? 3 : 2); }   // calm smile, now and then a wink
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
      draw(d) { moveFrame(d.run ? 'run' : 'walk', Math.floor((K.cycle % 1) * 8) % 8); }
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
      draw(d) { if (d.hard) moveFrame('fall', Math.min(7, Math.floor(K.st / 2.6 * 8))); else moveFrame('jump', K.st < .11 ? 6 : 7); }
    },
    sit: { update(dt, d) { return K.st * 1000 >= (d.ms || 6000); }, draw() { frame('p', POSES.index.sit); } },
    sleep: {
      enter(d) { d.z = .8; },
      update(dt, d) { if (K.st > d.z) { d.z = K.st + 1.9; effect('z', 1, ['#60a5fa', '#3b82f6']); } return false; },
      draw() { frame('f', FRONT.index.sleep); }
    },
    talk: {           // mouth open / closed while the bubble is on
      enter(d) { say(d.text, d.ms); },
      update(dt, d) { return K.st * 1000 >= (d.ms || 2000); },
      draw() { moveFrame('idle', Math.floor(K.st * 4) % 2 ? 0 : 2); }
    },
    pose: {           // one picture held for a while (pointing at a letter, thumbs up, a wink…)
      enter(d) { if (d.text) say(d.text, d.ms); if (d.onStart) d.onStart(); },
      update(dt, d) { return K.st * 1000 >= d.ms; },
      draw(d) { if (d.kind === 'm') moveFrame(d.anim, d.idx); else frame(d.kind, d.idx); }
    },
    play: {           // a row of the atlas played through (laugh, cry, celebrate, interact)
      enter(d) { if (d.text) say(d.text, d.ms); d.fps = d.fps || 9; },
      update(dt, d) { return K.st * 1000 >= (d.ms || 8 / d.fps * 1000 * (d.times || 1)); },
      draw(d) { const i = Math.floor(K.st * d.fps); moveFrame(d.anim, d.hold ? Math.min(i, 7) : i % 8); }
    },
    angry: {          // grows towards the player right where he is: cross face, tongue out, back to normal
      enter(d) {
        const room = Math.min(K.x, K.W - K.x) / (K.H * .42), up = (K.y - 14) / (K.H * 1.05);
        d.Z = clamp(Math.min(2.4, room, up), 1.25, 2.4);
        K.quietUntil = now() + 9000; say('Acha!', 900);
      },
      update(dt, d) {
        const t = K.st;
        K.zoom = t < 1.2 ? 1 + (d.Z - 1) * ease(t / 1.2) : t < 4.4 ? d.Z : t < 5.4 ? d.Z + (1 - d.Z) * ease(t - 4.4) : 1;
        if (!d.s1 && t > 1.2) { d.s1 = 1; say(pick(SAY.angry), 2000); effect('💢', 3); }
        if (!d.s2 && t > 3) { d.s2 = 1; say('Bleee! 😛', 1500); }
        if (t > 5.4) { K.zoom = 1; return true; }
        return false;
      },
      exit() { K.zoom = 1; },
      draw() {
        const t = K.st;
        if (t < 1.2) moveFrame('angry', Math.min(5, Math.floor(t / 1.2 * 6)));
        else if (t < 3) moveFrame('angry', 6 + (Math.floor(t * 3) % 2));
        else if (t < 4.4) frame('f', FRONT.index.tease);
        else moveFrame('idle', 2);
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
      act('attention', [{ go: 'floor', x: clamp(K.W / 2 + rnd(-1, 1) * K.H, minX(), maxX()) }, { do: 'pose', kind: 'm', anim: 'react', idx: 1, ms: 1800, text: pick(SAY.attention) }]); return;
    }
    if (t - K.lastHint > HINT_GAP && ((t - K.lastFind > STRUGGLE && idle < 9000) || K.wrongStreak >= 3)) { if (hintVisit()) return; }
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
      ['wink', 1, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 5, ms: 1500 }]],
      ['thumbs', .8, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 6, ms: 1800 }]],
      ['chat', 1, () => [{ do: 'talk', text: t - K.lastChat > 15000 ? (K.lastChat = t, pick(SAY.chat)) : '', ms: 2200 }]],
      ['sit', .7, () => [{ do: 'sit', ms: rnd(4000, 7000) }]],
      ['wave', .6, () => [{ do: 'pose', kind: 'm', anim: 'idle', idx: 7, ms: 1600 }]],
      ['stumble', t - K.lastTumble > 90000 ? .35 : 0, () => { K.lastTumble = t; return [{ do: 'play', anim: 'fall', fps: 3.1, ms: 2600, hold: true, text: pick(SAY.tumble) }, { do: 'talk', text: pick(SAY.up), ms: 1400 }]; }]
    ].filter(o => o[1] > 0 && !K.lastActs.includes(o[0]));
    let sum = options.reduce((s, o) => s + o[1], 0), r = Math.random() * sum, ch = options[0];
    for (const o of options) { r -= o[1]; if (r <= 0) { ch = o; break; } }
    act(ch[0], ch[2]());
  }

  // a hint from the real puzzle: stand next to the first letter of a hidden word and point at it
  function hintVisit() {
    if (!K.grid) return false;
    let starts = []; try { starts = (K.host.starts && K.host.starts()) || []; } catch (_) {}
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
        layer.style.visibility = ''; loop(); } };
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
      if (!K.ready) return;
      K.plan = []; K.pending = null; K.zoom = 1;
      layout();
      if (!isAir()) setState('idle', { soft: true, wait: 0 });
      plan([{ do: 'talk', text: first ? SAY.greet[0] : (Math.random() < .4 ? pick(SAY.greet) : ''), ms: 2000 }], true);
    },
    onCorrect() {
      K.lastTouch = K.lastFind = now(); K.wrongStreak = 0;
      if (K.ready) react([{ do: 'play', anim: 'celebrate', fps: 10, ms: 1700, text: pick(SAY.correct) }]);
    },
    onBonus() { if (K.ready) react([{ do: 'pose', kind: 'm', anim: 'react', idx: 5, ms: 1500, text: 'Neno la ziada! Safi!' }]); },
    onWrong() {
      K.lastTouch = now(); K.wrongStreak++;
      if (!K.ready || helping()) return;
      react([{ do: 'play', anim: 'tease', fps: 9, ms: 1700, text: pick(SAY.wrong) }]);
    },
    onWin() {
      if (!K.ready) return;
      react([{ call: () => { if (K.ground) jumpTo(K.ground, K.x); } }, { do: 'play', anim: 'celebrate', fps: 10, ms: 2400, text: pick(SAY.win) }], 3500);
    },
    boardDown(e) { return !!(K.press && K.press.id === e.pointerId); },
    // exposed for tests
    _K: K, _go: (id, x) => { setState('idle', { soft: true, wait: 0 }); plan([{ go: id, x }], true); }, _plats: () => K.plats, _hint: () => hintVisit(), _over: () => overLetters(), _setState: setState, _quiet: ms => { K.quietUntil = now() + ms; }
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
    const i = pick([0, 1, 2, 3, 5, 6, 7].filter(v => v !== K.lastTapPose)); K.lastTapPose = i;
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
