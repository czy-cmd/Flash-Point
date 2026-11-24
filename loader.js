/* FLASHPOINT PROTOCOL · loader
 * 加载页：进度由真实启动步骤驱动，逐帧平滑推进，不做分段跳变。
 */
(function () {
  const FP = window.FP;
  const Loader = FP.Loader = {};
  const $ = id => document.getElementById(id);

  const MIN_SPEED = 72;   /* 每秒最少推进的百分比，保证没有停顿 */
  const CATCH = 5.2;      /* 追赶系数 */

  Loader.run = function (onDone) {
    const ring = $('load-ring');
    const pctEl = $('load-pct');
    const logEl = $('load-log');
    const instant = FP.state.settings.anim === false;

    let target = 0;
    let shown = 0;
    let fin = false;
    let alive = true;
    let last = performance.now();
    const waits = [];

    function paint() {
      ring.style.setProperty('--p', shown.toFixed(2));
      const n = Math.floor(shown);
      if (pctEl.textContent !== n + '%') pctEl.textContent = n + '%';
    }

    function tick() {
      if (!alive) return;
      const now = performance.now();
      const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
      last = now;
      if (shown < target) {
        const k = Math.max((target - shown) * Math.min(1, dt * CATCH), dt * MIN_SPEED);
        shown = Math.min(target, shown + k);
      }
      if (target >= 100 && target - shown < 0.75) shown = 100;
      paint();
      for (let i = waits.length - 1; i >= 0; i--) {
        if (shown >= waits[i].v - 0.6) {
          const w = waits.splice(i, 1)[0];
          w.resolve();
        }
      }
      setTimeout(tick, 16);
    }

    function waitTo(v) {
      if (instant || shown >= v - 0.6) return Promise.resolve();
      return new Promise(resolve => waits.push({ v, resolve }));
    }

    function addLine(pct, text) {
      const cur = logEl.querySelector('.load-line.cur');
      if (cur) cur.classList.remove('cur');
      const row = document.createElement('div');
      row.className = 'load-line cur';
      const num = document.createElement('i');
      num.textContent = String(Math.round(pct)).padStart(3, ' ') + '%';
      const label = document.createElement('span');
      label.textContent = text;
      row.appendChild(num);
      row.appendChild(label);
      logEl.appendChild(row);
      while (logEl.children.length > 4) logEl.removeChild(logEl.firstChild);
      if (instant) return;
      row.style.opacity = '0';
      row.style.transform = 'translateY(4px)';
      FP.Ani.tween({
        dur: 280, ease: FP.Ani.ease.outFluent(3),
        apply: v => {
          row.style.opacity = String(Math.min(1, v * 2));
          row.style.transform = 'translateY(' + (4 * (1 - v)) + 'px)';
        },
        done: () => { row.style.transform = ''; row.style.opacity = ''; }
      });
    }

    const stages = [
      ['indexing flashpoint registry', 12, () => {
        const sys = FP.SYS ? (FP.SYS.core.length + FP.SYS.use.length + FP.SYS.mode.length + FP.SYS.develope.length) : 0;
        const ext = FP.QX ? FP.QX.length : 0;
        if (!sys || !ext) throw new Error('registry incomplete');
      }],
      ['validating save partition', 10, () => {
        if (!FP.LS) throw new Error('storage offline');
        FP.LS.get('fp_settings', null);
        FP.LS.get('fp_highscores', {});
      }],
      ['compiling module table', 10, () => {
        const n = Object.keys(FP.MODULES || {}).length;
        if (!n) throw new Error('module table empty');
        FP.LEVEL_ORDER.forEach(k => { if (!FP.LEVELS[k]) throw new Error('level ' + k); });
      }],
      ['testing render surface', 14, () => {
        FP.initCanvas();
        const cv = $('board');
        const ctx = cv && cv.getContext && cv.getContext('2d');
        if (!ctx) throw new Error('2d context unavailable');
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, 1, 1);
        ctx.restore();
      }],
      ['priming ui templates', 16, () => {
        if (FP.ui && FP.ui.prewarm) FP.ui.prewarm();
      }],
      ['handshaking audio bus', 8, () => {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (FP.state.settings.sound && !AC) throw new Error('audio bus missing');
      }],
      ['awaiting font metrics', 12, () => (document.fonts && document.fonts.ready) || Promise.resolve()],
      ['painting frame zero', 10, () => new Promise(res => setTimeout(res, 40))],
      ['sealing session', 8, () => {
        if (FP.ui && FP.ui.menuMeta) FP.ui.menuMeta();
      }]
    ];

    async function run() {
      tick();
      for (let i = 0; i < stages.length; i++) {
        const text = stages[i][0], weight = stages[i][1], work = stages[i][2];
        target = Math.min(100, target + weight);
        try { await work(); } catch (e) { /* 单步失败不阻断启动 */ }
        await waitTo(target);
        addLine(target, text);
      }
      target = 100;
      await waitTo(100);
      if (!instant) await new Promise(r => setTimeout(r, 180));
      fin = true;
      alive = false;
      paint();
      onDone && onDone();
    }

    paint();
    run();
  };
})();
