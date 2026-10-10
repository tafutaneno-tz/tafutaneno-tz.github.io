/* =====================================================================
   NENO LA HARAKA – 30-second quick-answer mini game
   Self-contained: it only needs a page to call
       Haraka.open({ onClose(result){…}, sfx:{correct,wrong,tick,win,select} })
   Questions live in data/haraka-maswali.json (kept separate from the code).
   Modules below: Store · Bank (questions) · Score · Timer · Screen · Haraka (controller)
   ===================================================================== */
(function () {
  'use strict';

  const CFG = {
    dataUrl: 'data/haraka-maswali.json?v=1',  // bump ?v= when the question file changes (the service worker caches by URL)
    roundMs: 30000,                            // one round = 30 seconds
    feedbackOkMs: 650,                         // pause after a right answer
    feedbackBadMs: 1300,                       // longer pause after a wrong one, so the right answer can be read
    countStepMs: 750,                          // speed of the 3 · 2 · 1 · ANZA! countdown
    storagePrefix: 'tn_haraka_',               // localStorage keys: tn_haraka_best, tn_haraka_seen
    seenMemory: 120,                           // remember this many recent questions to avoid repeats across rounds
    perLevel: [5, 7]                           // how many easy, then medium questions before the hard ones start
  };

  /* ---------- Store: small safe wrapper around localStorage ---------- */
  const Store = {
    get(k, d) { try { const v = localStorage.getItem(CFG.storagePrefix + k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(CFG.storagePrefix + k, JSON.stringify(v)); } catch (_) {} }
  };

  /* ---------- Score: points and streak bonuses (change the numbers here) ---------- */
  const Score = {
    pointsFor(correct) { return correct ? 10 : 0; },
    // bonus paid at the moment a streak reaches these lengths
    streakBonus(streak) {
      if (streak > 0 && streak % 5 === 0) return 20;           // 5, 10, 15 … in a row
      if (streak === 3 || (streak > 5 && streak % 5 === 3)) return 5;  // 3, 8, 13 … in a row
      return 0;
    }
  };

  /* ---------- Bank: loading, ordering and no-repeat logic ---------- */
  const Bank = {
    all: null, loading: null,
    load() {
      if (this.all) return Promise.resolve(this.all);
      if (this.loading) return this.loading;
      this.loading = fetch(CFG.dataUrl).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(doc => {
          const qs = (doc.questions || []).filter(q => Array.isArray(q.options) && q.options.length === 4 && q.options.includes(q.correctAnswer));
          if (!qs.length) throw new Error('empty');
          this.all = qs; return qs;
        })
        .catch(e => { this.loading = null; throw e; });
      return this.loading;
    },
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    // A fresh round: easy → medium → hard, random inside each level, questions seen recently go last.
    // Every question appears at most once per round.
    buildRound() {
      const seen = new Set(Store.get('seen', []));
      const byDiff = d => {
        const list = this.shuffle(this.all.filter(q => q.difficulty === d));
        return list.filter(q => !seen.has(q.id)).concat(list.filter(q => seen.has(q.id)));
      };
      const e = byDiff(1), m = byDiff(2), h = byDiff(3);
      const [ne, nm] = CFG.perLevel;
      const order = e.slice(0, ne).concat(m.slice(0, nm), h, m.slice(nm), e.slice(ne));
      return order.map(q => ({ ...q, shown: this.shuffle(q.options) }));   // answer buttons in random order too
    },
    remember(ids) {
      const seen = Store.get('seen', []).filter(id => !ids.includes(id)).concat(ids);
      Store.set('seen', seen.slice(-CFG.seenMemory));
    }
  };

  /* ---------- Timer: one interval at most; can pause when the app is hidden ---------- */
  const Timer = {
    handle: 0, endAt: 0, left: 0, running: false, onTick: null, onEnd: null,
    start(ms, onTick, onEnd) { this.stop(); this.onTick = onTick; this.onEnd = onEnd; this.left = ms; this.resume(); },
    resume() {
      if (this.running || this.left <= 0) return;
      this.running = true; this.endAt = performance.now() + this.left;
      this.handle = setInterval(() => this.tick(), 100); this.tick();
    },
    pause() { if (!this.running) return; this.left = Math.max(0, this.endAt - performance.now()); clearInterval(this.handle); this.handle = 0; this.running = false; },
    stop() { clearInterval(this.handle); this.handle = 0; this.running = false; this.left = 0; },
    tick() {
      const left = Math.max(0, this.endAt - performance.now());
      if (this.onTick) this.onTick(left);
      if (left <= 0) { const end = this.onEnd; this.stop(); if (end) end(); }
    }
  };

  /* ---------- Sound: heartbeat and countdown beeps (Web Audio, no files) ---------- */
  const Sound = {
    ctx: null,
    on() { try { return !S.opts.sound || S.opts.sound(); } catch (_) { return true; } },
    ensure() {
      if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; } }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    },
    blip(freq, dur, vol, at, endFreq, type) {
      const c = this.ensure(); if (!c) return;
      const t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
    },
    heart() { if (!this.on()) return; this.blip(78, .16, .55, 0, 42); this.blip(66, .18, .4, .2, 38); },   // "lub-dub"
    count(n) { if (!this.on()) return; n === 0 ? this.blip(880, .35, .22, 0, 1320, 'triangle') : this.blip(520, .14, .2, 0, null, 'triangle'); }
  };

  /* ---------- Screen: builds the DOM once and only updates it afterwards ---------- */
  const CSS = `
  .hk{position:fixed;inset:0;z-index:40;display:none;flex-direction:column;align-items:center;
      background:radial-gradient(120% 80% at 50% 0%,#17694a 0%,#0d4a33 45%,#073222 100%);color:#fff;
      font-family:"Nunito","Baloo 2",system-ui,sans-serif;-webkit-user-select:none;user-select:none;
      padding:calc(10px + env(safe-area-inset-top,0px)) 16px calc(14px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
  .hk.show{display:flex}
  .hk *{box-sizing:border-box}
  .hk-wrap{width:100%;max-width:460px;height:100%;display:flex;flex-direction:column}
  .hk-top{display:flex;align-items:center;gap:10px;min-height:64px}
  .hk-x{width:44px;height:44px;border-radius:50%;border:2px solid rgba(245,197,66,.55);background:rgba(0,0,0,.2);color:#f5c542;font:900 1.3rem/1 system-ui,sans-serif;cursor:pointer;flex:none}
  .hk-title{flex:1;text-align:center;font:900 1.45rem/1.05 "Baloo 2","Nunito",sans-serif;letter-spacing:.06em;color:#f5c542;text-shadow:0 2px 0 rgba(0,0,0,.35)}
  .hk-title small{display:block;font:800 .72rem/1.2 "Nunito",sans-serif;letter-spacing:.12em;color:#c9e9d8}
  .hk-clock{position:relative;width:64px;height:64px;flex:none}
  .hk-clock svg{position:absolute;inset:0;transform:rotate(-90deg)}
  .hk-clock b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:900 1.5rem/1 "Baloo 2","Nunito",sans-serif;color:#fff}
  .hk-clock.low b{color:#ffb4a8}
  .hk-cat{margin:10px auto 0;padding:5px 14px;border-radius:99px;background:rgba(245,197,66,.16);border:1px solid rgba(245,197,66,.5);color:#f5c542;font:900 .85rem/1.2 "Nunito",sans-serif;letter-spacing:.08em;text-transform:uppercase}
  .hk-q{flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:12px 6px;overflow:hidden;
        font:900 clamp(1.35rem,6.2vw,1.85rem)/1.3 "Nunito",sans-serif;min-height:0}
  .hk-opts{display:grid;gap:12px}
  .hk-opt{min-height:64px;border-radius:18px;border:0;cursor:pointer;padding:10px 14px;
          background:#fdf8ea;color:#0d3b29;font:900 clamp(1.15rem,5.4vw,1.45rem)/1.15 "Nunito",sans-serif;letter-spacing:.03em;
          box-shadow:0 5px 0 #c9a227;transition:transform .08s}
  .hk-opt:active{transform:translateY(3px);box-shadow:0 2px 0 #c9a227}
  .hk-opt.ok{background:#22c55e;color:#fff;box-shadow:0 5px 0 #15803d}
  .hk-opt.bad{background:#ef4444;color:#fff;box-shadow:0 5px 0 #991b1b;animation:hkshake .35s}
  .hk-opt:disabled{cursor:default}
  @keyframes hkshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
  .hk-fb{min-height:52px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 1rem/1.25 "Nunito",sans-serif;color:#d7f3e4;padding:6px}
  .hk-fb.ok{color:#86efac}.hk-fb.bad{color:#fecaca}
  .hk-bot{display:flex;gap:10px}
  .hk-stat{flex:1;border-radius:16px;background:rgba(0,0,0,.22);border:1px solid rgba(245,197,66,.3);padding:8px 10px;text-align:center}
  .hk-stat small{display:block;font:800 .75rem/1.2 "Nunito",sans-serif;color:#c9e9d8;letter-spacing:.08em;text-transform:uppercase}
  .hk-stat b{font:900 1.6rem/1.1 "Baloo 2","Nunito",sans-serif;color:#f5c542}
  .hk-pop{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);pointer-events:none;font:900 1.6rem/1 "Baloo 2","Nunito",sans-serif;color:#f5c542;text-shadow:0 3px 0 rgba(0,0,0,.4);opacity:0}
  .hk-pop.go{animation:hkpop 1s ease-out}
  @keyframes hkpop{0%{opacity:0;transform:translate(-50%,-30%) scale(.7)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-110%) scale(1)}}
  .hk-panel{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;padding:10px}
  .hk-panel h2{margin:0;font:900 1.9rem/1.1 "Baloo 2","Nunito",sans-serif;color:#f5c542}
  .hk-panel p{margin:0;font:800 1.12rem/1.45 "Nunito",sans-serif;color:#eafbf1}
  .hk-rules{width:100%;border-radius:18px;background:rgba(0,0,0,.22);border:1px solid rgba(245,197,66,.3);padding:12px 14px;text-align:left;font:800 1rem/1.6 "Nunito",sans-serif;color:#eafbf1}
  .hk-rules b{color:#f5c542}
  .hk-big{font:900 4rem/1 "Baloo 2","Nunito",sans-serif;color:#f5c542;text-shadow:0 4px 0 rgba(0,0,0,.35)}
  .hk-go{min-width:220px;min-height:62px;border-radius:999px;border:0;cursor:pointer;background:linear-gradient(180deg,#ffd75e,#f0b323);
         color:#0d3b29;font:900 1.4rem/1 "Baloo 2","Nunito",sans-serif;letter-spacing:.06em;box-shadow:0 6px 0 #a87d0c}
  .hk-go:active{transform:translateY(3px);box-shadow:0 3px 0 #a87d0c}
  .hk-new{display:inline-block;padding:4px 12px;border-radius:99px;background:#f5c542;color:#0d3b29;font:900 .9rem/1.3 "Nunito",sans-serif}
  .hk-bar{height:12px;border-radius:99px;background:rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.12);overflow:hidden;margin:6px 2px 0}
  .hk-bar i{display:block;height:100%;width:100%;border-radius:99px;background:#4ade80;transition:width .1s linear,background-color .3s}
  .hk-clock.beat{animation:hkbeat .45s ease-out}
  @keyframes hkbeat{0%{transform:scale(1)}30%{transform:scale(1.3)}100%{transform:scale(1)}}
  .hk-vig{position:absolute;inset:0;pointer-events:none;opacity:0}
  .hk-vig.flash{animation:hkvig .9s ease-out}
  @keyframes hkvig{0%{opacity:1;box-shadow:inset 0 0 80px 22px rgba(255,45,45,.8)}100%{opacity:0;box-shadow:inset 0 0 80px 22px rgba(255,45,45,0)}}
  .hk-count{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px}
  .hk-count p{margin:0;font:800 1.1rem/1.3 "Nunito",sans-serif;color:#c9e9d8}
  .hk-count span{display:block;font:900 8rem/1 "Baloo 2","Nunito",sans-serif;color:#f5c542;text-shadow:0 6px 0 rgba(0,0,0,.35);animation:hkcount .75s ease-out both}
  .hk-count span.go{font-size:4.6rem;color:#4ade80}
  @keyframes hkcount{0%{transform:scale(2.3);opacity:0}25%{transform:scale(1);opacity:1}80%{opacity:1}100%{transform:scale(.85);opacity:.2}}
  @media (max-height:680px){
    .hk-top{min-height:54px}.hk-clock{width:54px;height:54px}.hk-clock b{font-size:1.3rem}.hk-title{font-size:1.25rem}
    .hk-cat{margin-top:6px}.hk-opts{gap:9px}.hk-opt{min-height:52px;padding:7px 12px;font-size:1.12rem}
    .hk-fb{min-height:40px;font-size:.92rem;padding:4px}.hk-stat{padding:5px 8px}.hk-stat b{font-size:1.3rem}
    .hk-panel{gap:10px}.hk-panel h2{font-size:1.6rem}.hk-panel p,.hk-rules{font-size:.98rem}.hk-big{font-size:3.2rem}
  }
  @media (prefers-reduced-motion:reduce){.hk-opt.bad,.hk-pop.go,.hk-clock.beat,.hk-count span{animation:none}.hk-pop.go{opacity:1}
    .hk-vig.flash{animation:none;opacity:1;box-shadow:inset 0 0 50px 10px rgba(255,45,45,.45)}}
  `;

  const Screen = {
    el: null, parts: {},
    build() {
      if (this.el) return;
      const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      const el = document.createElement('div'); el.className = 'hk'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Neno la Haraka');
      el.innerHTML = `<div class="hk-wrap">
          <div class="hk-top">
            <button class="hk-x" data-act="close" aria-label="Funga">✕</button>
            <div class="hk-title">NENO LA HARAKA<small>JIBU HARAKA!</small></div>
            <div class="hk-clock" aria-live="off"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="28" fill="rgba(0,0,0,.25)" stroke="rgba(255,255,255,.15)" stroke-width="6"/>
              <circle class="hk-ring" cx="32" cy="32" r="28" fill="none" stroke="#f5c542" stroke-width="6" stroke-linecap="round" stroke-dasharray="175.9" stroke-dashoffset="0"/></svg><b>30</b></div>
          </div>
          <div class="hk-bar"><i></i></div>
          <div class="hk-body"></div>
        </div><div class="hk-vig"></div><div class="hk-pop"></div>`;
      document.body.appendChild(el);
      this.el = el;
      this.parts = { body: el.querySelector('.hk-body'), clock: el.querySelector('.hk-clock'), clockNum: el.querySelector('.hk-clock b'),
                     ring: el.querySelector('.hk-ring'), pop: el.querySelector('.hk-pop'),
                     bar: el.querySelector('.hk-bar i'), vig: el.querySelector('.hk-vig') };
      this.parts.body.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0';
      // one listener for every button, ever (no duplicates on re-open)
      el.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) Haraka.action(b.dataset.act, b); });
    },
    show() { this.build(); this.el.classList.add('show'); },
    hide() { if (this.el) this.el.classList.remove('show'); },
    setClock(ms) {
      const s = Math.ceil(ms / 1000), frac = Math.max(0, Math.min(1, ms / CFG.roundMs));
      this.parts.clockNum.textContent = s;
      this.parts.ring.setAttribute('stroke-dashoffset', String(175.9 * (1 - frac)));
      this.parts.ring.setAttribute('stroke', s <= 5 ? '#ff8a7a' : '#f5c542');
      this.parts.clock.classList.toggle('low', s <= 5);
      this.parts.bar.style.width = (frac * 100) + '%';
      this.parts.bar.style.backgroundColor = s > 15 ? '#4ade80' : s > 5 ? '#f5c542' : '#ff5a4a';
    },
    // last 10 seconds: the clock beats once a second; last 5: the screen edges flash red as well
    beat(strong) {
      const c = this.parts.clock; c.classList.remove('beat'); void c.offsetWidth; c.classList.add('beat');
      if (strong) { const v = this.parts.vig; v.classList.remove('flash'); void v.offsetWidth; v.classList.add('flash'); }
    },
    calm() { this.parts.clock.classList.remove('beat'); this.parts.vig.classList.remove('flash'); },
    countdown() { this.parts.body.innerHTML = `<div class="hk-count"><p>Jiandae…</p><span>3</span></div>`; },
    countStep(t) {
      const box = this.parts.body.querySelector('.hk-count'); if (!box) return;
      box.innerHTML = t === 'ANZA!' ? '<p>&nbsp;</p><span class="go">ANZA!</span>' : `<p>Jiandae…</p><span>${t}</span>`;
    },
    intro(best) {
      this.setClock(CFG.roundMs);
      this.parts.body.innerHTML = `<div class="hk-panel">
        <h2>Uko tayari?</h2>
        <p>Soma maelezo, kisha chagua neno sahihi kati ya manne. Una <b style="color:#f5c542">sekunde 30</b>!</p>
        <div class="hk-rules">✔ Jibu sahihi: <b>pointi 10</b><br>✔ Majibu 3 mfululizo: <b>+5</b><br>✔ Majibu 5 mfululizo: <b>+20</b></div>
        ${best ? `<p>Rekodi yako: <b style="color:#f5c542">${best}</b></p>` : ''}
        <button class="hk-go" data-act="start">ANZA</button></div>`;
    },
    message(text, btnLabel, act) {
      this.parts.body.innerHTML = `<div class="hk-panel"><p>${text}</p>${btnLabel ? `<button class="hk-go" data-act="${act}">${btnLabel}</button>` : ''}</div>`;
    },
    playLayout() {
      this.parts.body.innerHTML = `<div class="hk-cat"></div><div class="hk-q"></div><div class="hk-opts"></div><div class="hk-fb"></div>
        <div class="hk-bot"><div class="hk-stat"><small>Pointi</small><b class="hk-score">0</b></div><div class="hk-stat"><small>Mfululizo</small><b class="hk-streak">0</b></div></div>`;
      const b = this.parts.body;
      Object.assign(this.parts, { cat: b.querySelector('.hk-cat'), q: b.querySelector('.hk-q'), opts: b.querySelector('.hk-opts'),
        fb: b.querySelector('.hk-fb'), score: b.querySelector('.hk-score'), streak: b.querySelector('.hk-streak') });
    },
    question(q, catName) {
      const p = this.parts;
      p.cat.textContent = catName || q.category; p.q.textContent = q.question;
      p.q.style.fontSize = '';
      p.opts.innerHTML = q.shown.map(o => `<button class="hk-opt" data-act="answer" data-v="${o.replace(/"/g, '&quot;')}">${o}</button>`).join('');
      p.fb.className = 'hk-fb'; p.fb.textContent = '';
      this.fitQuestion();
    },
    fitQuestion() {
      const el = this.parts.q; if (!el || !el.clientHeight) return;
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollHeight > el.clientHeight + 1 && size > 15) { size -= 1; el.style.fontSize = size + 'px'; }
    },
    mark(chosen, correct) {
      this.parts.opts.querySelectorAll('.hk-opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.v === correct) b.classList.add('ok');
        else if (b.dataset.v === chosen) b.classList.add('bad');
      });
    },
    feedback(ok, q) {
      const fb = this.parts.fb; fb.className = 'hk-fb ' + (ok ? 'ok' : 'bad');
      fb.textContent = ok ? 'Sahihi! ' + q.explanation : 'Si sahihi. Jibu ni ' + q.correctAnswer + '.';
    },
    stats(score, streak) { this.parts.score.textContent = score; this.parts.streak.textContent = streak; },
    pop(text) { const p = this.parts.pop; p.textContent = text; p.classList.remove('go'); void p.offsetWidth; p.classList.add('go'); },
    results(r, best, isRecord) {
      this.setClock(0);
      this.parts.body.innerHTML = `<div class="hk-panel">
        <h2>${r.early ? 'Mchezo umesimamishwa' : 'Muda umekwisha!'}</h2>
        <p>Pointi zako</p><div class="hk-big">${r.score}</div>
        ${isRecord ? '<span class="hk-new">REKODI MPYA!</span>' : ''}
        <div class="hk-rules">Majibu sahihi: <b>${r.correct}</b> kati ya <b>${r.answered}</b><br>Mfululizo mrefu zaidi: <b>${r.bestStreak}</b><br>Rekodi yako: <b>${best}</b></div>
        <button class="hk-go" data-act="done">ENDELEA</button></div>`;
    }
  };

  /* ---------- Haraka: the controller the main game talks to ---------- */
  const S = { open: false, phase: 'idle', list: [], i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, asked: [], next: 0, countT: [], opts: {} };
  const snd = k => { try { const f = S.opts.sfx && S.opts.sfx[k]; if (f) f(); } catch (_) {} };

  const Haraka = {
    isOpen() { return S.open; },
    open(opts) {
      if (S.open) return;                      // never two rounds at once
      S.opts = opts || {}; S.open = true; S.phase = 'intro';
      Screen.show();
      Screen.message('Inapakia maswali…');
      Bank.load().then(() => { if (S.open && S.phase === 'intro') Screen.intro(Store.get('best', 0)); })
        .catch(() => { if (S.open) { S.phase = 'error'; Screen.message('Maswali hayakupatikana. Hakikisha una mtandao kisha ujaribu tena baadaye.', 'ENDELEA', 'done'); } });
    },
    // ANZA → big 3 · 2 · 1 · ANZA! → the 30 seconds start
    start() {
      if (!Bank.all || S.phase !== 'intro') return;
      S.phase = 'count'; Sound.ensure();
      Screen.countdown(); Sound.count(3);
      const steps = ['2', '1', 'ANZA!'];
      S.countT = steps.map((t, k) => setTimeout(() => {
        if (S.phase !== 'count') return;
        Screen.countStep(t); Sound.count(t === 'ANZA!' ? 0 : +t);
      }, CFG.countStepMs * (k + 1)));
      S.countT.push(setTimeout(() => { if (S.phase === 'count') this.begin(); }, CFG.countStepMs * 3 + 500));
    },
    cancelCount() { (S.countT || []).forEach(clearTimeout); S.countT = []; },
    begin() {
      this.cancelCount();
      Object.assign(S, { phase: 'play', list: Bank.buildRound(), i: 0, score: 0, streak: 0, bestStreak: 0, correct: 0, answered: 0, asked: [] });
      clearTimeout(S.next);
      Screen.playLayout(); Screen.stats(0, 0);
      this.ask();
      let lastSec = 99;
      Timer.start(CFG.roundMs, ms => {
        Screen.setClock(ms);
        const sec = Math.ceil(ms / 1000);
        if (sec !== lastSec && sec > 0 && sec <= 10) {
          Screen.beat(sec <= 5);
          if (sec <= 5) Sound.heart(); else snd('tick');
        }
        lastSec = sec;
      }, () => this.finish(false));
      if (document.hidden) Timer.pause();
    },
    ask() {
      if (S.phase !== 'play') return;
      if (S.i >= S.list.length) { this.finish(false); return; }   // ran out of questions (very fast player)
      const q = S.list[S.i];
      S.asked.push(q.id);
      Screen.question(q, Haraka.catName(q.category));
    },
    answer(btn) {
      if (S.phase !== 'play') return;
      const q = S.list[S.i]; if (!q) return;
      const chosen = btn.dataset.v, ok = chosen === q.correctAnswer;
      S.phase = 'feedback'; S.answered++;
      Screen.mark(chosen, q.correctAnswer); Screen.feedback(ok, q);
      if (ok) {
        S.correct++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
        const bonus = Score.streakBonus(S.streak);
        S.score += Score.pointsFor(true) + bonus;
        if (bonus) { Screen.pop(`+${bonus} · ${S.streak} mfululizo!`); snd('bonus'); } else snd('correct');
      } else { S.streak = 0; S.score += Score.pointsFor(false); snd('wrong'); }
      Screen.stats(S.score, S.streak);
      S.next = setTimeout(() => {
        if (S.phase !== 'feedback') return;           // time ran out or the screen was closed meanwhile
        S.phase = 'play'; S.i++; this.ask();
      }, ok ? CFG.feedbackOkMs : CFG.feedbackBadMs);
    },
    finish(early) {
      if (S.phase !== 'play' && S.phase !== 'feedback') return;
      Timer.stop(); clearTimeout(S.next); S.phase = 'results'; Screen.calm();
      Bank.remember(S.asked);
      const r = { score: S.score, correct: S.correct, answered: S.answered, bestStreak: S.bestStreak, early: !!early };
      const prev = Store.get('best', 0), isRecord = r.score > prev && r.score > 0;
      if (isRecord) Store.set('best', r.score);
      S.result = r;
      Screen.results(r, Math.max(prev, r.score), isRecord); snd('win');
    },
    close() {
      if (!S.open) return;
      Timer.stop(); clearTimeout(S.next); this.cancelCount();
      const r = S.result || null;
      S.open = false; S.phase = 'idle'; S.result = null;
      Screen.hide();
      const cb = S.opts.onClose; S.opts = {};
      if (cb) try { cb(r); } catch (e) { console.error(e); }
    },
    // ✕ button or the phone's back button: during a round it stops the round and shows the score; otherwise it leaves
    back() {
      if (S.phase === 'play' || S.phase === 'feedback') this.finish(true);
      else if (S.phase === 'count') { this.cancelCount(); S.phase = 'intro'; Screen.intro(Store.get('best', 0)); }   // back to the start screen
      else this.close();
    },
    action(act, btn) {
      if (act === 'start') { snd('select'); this.start(); }
      else if (act === 'answer') this.answer(btn);
      else if (act === 'done') { snd('select'); this.close(); }
      else if (act === 'close') this.back();
    },
    catName(c) { return ({ wanyama: 'Wanyama', vyakula: 'Vyakula', vitu: 'Vitu vya kila siku', asili: 'Asili', kazi: 'Kazi',
                           lugha: 'Lugha', tanzania: 'Tanzania', maarifa: 'Maarifa ya jumla' })[c] || c; },
    // exposed for tests / tuning
    _cfg: CFG, _score: Score, _bank: Bank, _state: S
  };

  // pause the clock while the app is in the background, continue when it comes back
  document.addEventListener('visibilitychange', () => {
    if (!S.open) return;
    if (document.hidden) Timer.pause(); else if (S.phase === 'play' || S.phase === 'feedback') Timer.resume();
  });

  window.Haraka = Haraka;
})();
