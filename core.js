/* FLASHPOINT PROTOCOL · core
 * 状态、存档、工具、渲染、主循环
 */
(function () {
  const U = FP.util;
  const C = FP.CONFIG;

  /* ---------------- 状态 ---------------- */
  const S = {
    screen: 'loading',
    dev: false,
    src: false,
    degraded: false,
    debug: false,
    mode: null,
    settings: { sound: false, anim: true, difficulty: 'normal', duration: 60 },
    sysPlugins: {},
    external: [],          // 已启用的 qx id
    custom: [],            // 自定义插件
    highscores: {},
    lastResult: null,
    garble: null
  };
  FP.state = S;

  /* 默认启用所有系统插件 */
  ['core-loop', 'core-render', 'core-input', 'core-state', 'core-time',
    'use-basic_system', 'use-harness', 'use-simple', 'use-with',
    'mode-standard', 'mode-triangle', 'mode-multi', 'mode-xhigh', 'mode-qwq', 'mode-pid',
    'DEVELOPE-time_up', 'DEVELOPE-shop', 'DEVELOPE-level', 'DEVELOPE-save', 'DEVELOPE-daily',
    'internet'].forEach(id => { S.sysPlugins[id] = true; });
  S.sysPlugins['DEVELOPE-time_up'] = false;   // 默认 60 秒
  S.sysPlugins['DEVELOPE-shop'] = false;
  S.sysPlugins['DEVELOPE-level'] = false;
  S.sysPlugins['DEVELOPE-daily'] = false;

  /* ---------------- 存档 ---------------- */
  const LS = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  FP.LS = LS;

  FP.saveSettings = function () { LS.set('fp_settings', S.settings); };
  FP.activePlugins = function () {
    return S.external.concat(S.custom.filter(c => c.enabled).map(c => c.id)).slice(0, 5);
  };
  FP.savePlugins = function () { LS.set('fp_plugins_enabled', { sys: S.sysPlugins, ext: S.external }); };
  FP.saveHighscores = function () { LS.set('fp_highscores', S.highscores); };
  FP.saveCustom = function () { LS.set('fp_plugins_custom', S.custom); };

  FP.load = function () {
    const s = LS.get('fp_settings', null);
    if (s) S.settings = Object.assign(S.settings, s);
    const p = LS.get('fp_plugins_enabled', null);
    if (p) {
      if (p.sys) S.sysPlugins = Object.assign(S.sysPlugins, p.sys);
      if (Array.isArray(p.ext)) S.external = p.ext.slice(0, 5);
    }
    S.highscores = LS.get('fp_highscores', {});
    S.custom = LS.get('fp_plugins_custom', []);
  };

  /* ---------------- 密码哈希 ---------------- */
  FP.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  };
  /* 只保存哈希，明文不出现（含源码里） */
  const DEV_HASH = '2ed0da44';
  const CODE_HASH = 'f9316cf4';
  FP.checkDev = s => FP.hash(String(s || '').trim()) === DEV_HASH;
  FP.checkCode = s => FP.hash(String(s || '').trim()) === CODE_HASH;

  /* ---------------- DOM ---------------- */
  FP.$ = id => document.getElementById(id);
  FP.el = function (tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };

  /* ---------------- 音频 ---------------- */
  let actx = null;
  FP.beep = function (freq, dur, type) {
    if (!S.settings.sound) return;
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.value = 0.05;
      o.connect(g); g.connect(actx.destination);
      o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + (dur || 0.12));
      o.stop(actx.currentTime + (dur || 0.12) + 0.02);
    } catch (e) {}
  };

  /* ---------------- 寻路 ---------------- */
  FP.bfs = function (sx, sy, tx, ty, walls) {
    if (sx === tx && sy === ty) return [];
    const cols = C.cols, rows = C.rows;
    const k = (x, y) => y * cols + x;
    const prev = new Map();
    prev.set(k(sx, sy), null);
    const q = [[sx, sy]];
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let head = 0, found = false;
    while (head < q.length) {
      const [x, y] = q[head++];
      for (let d = 0; d < 4; d++) {
        const nx = x + dirs[d][0], ny = y + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (walls.has(nx + ',' + ny)) continue;
        const kk = k(nx, ny);
        if (prev.has(kk)) continue;
        prev.set(kk, [x, y]);
        if (nx === tx && ny === ty) { found = true; head = q.length + 1; break; }
        q.push([nx, ny]);
      }
      if (found) break;
    }
    if (!prev.has(k(tx, ty))) return null;
    const path = [];
    let cur = [tx, ty];
    while (cur && !(cur[0] === sx && cur[1] === sy)) {
      path.push({ x: cur[0], y: cur[1] });
      cur = prev.get(k(cur[0], cur[1]));
    }
    path.reverse();
    return path;
  };

  /* ---------------- 画布 ---------------- */
  let canvas = null, ctx = null;
  FP.initCanvas = function () {
    canvas = FP.$('board');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    const w = C.cols * C.cell + C.pad * 2;
    canvas.width = w;
    canvas.height = w;
    canvas.style.width = '100%';
    canvas.style.maxWidth = w + 'px';
  };

  const cx = g => C.pad + g * C.cell + C.cell / 2;
  const cy = g => C.pad + g * C.cell + C.cell / 2;

  FP.canvasToGrid = function (ev) {
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width;
    const scaleY = canvas.height / r.height;
    const px = (ev.clientX - r.left) * scaleX;
    const py = (ev.clientY - r.top) * scaleY;
    const gx = Math.floor((px - C.pad) / C.cell);
    const gy = Math.floor((py - C.pad) / C.cell);
    if (gx < 0 || gy < 0 || gx >= C.cols || gy >= C.rows) return null;
    return { x: gx, y: gy };
  };

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  FP.render = function (t) {
    const G = FP.game;
    if (!ctx || !G) return;
    const anim = S.settings.anim;
    const W = canvas.width;
    ctx.clearRect(0, 0, W, W);

    /* 背景 */
    const g = ctx.createLinearGradient(0, 0, W, W);
    g.addColorStop(0, '#0b1220');
    g.addColorStop(1, '#0e1a2b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, W);

    /* 网格 */
    ctx.lineWidth = 1;
    for (let i = 0; i <= C.cols; i++) {
      ctx.strokeStyle = 'rgba(79,195,247,0.11)';
      ctx.beginPath();
      ctx.moveTo(C.pad + i * C.cell, C.pad);
      ctx.lineTo(C.pad + i * C.cell, C.pad + C.rows * C.cell);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(C.pad, C.pad + i * C.cell);
      ctx.lineTo(C.pad + C.cols * C.cell, C.pad + i * C.cell);
      ctx.stroke();
    }

    /* 格子 */
    ctx.fillStyle = 'rgba(79,195,247,0.035)';
    ctx.strokeStyle = 'rgba(79,195,247,0.07)';
    ctx.lineWidth = 1;
    for (let y = 0; y < C.rows; y++) {
      for (let x = 0; x < C.cols; x++) {
        roundRect(ctx, C.pad + x * C.cell + 1.5, C.pad + y * C.cell + 1.5, C.cell - 3, C.cell - 3, 5);
        ctx.fill();
        ctx.stroke();
      }
    }

    /* 障碍 */
    ctx.fillStyle = 'rgba(120,140,160,0.22)';
    G.walls.forEach(k => {
      const [x, y] = k.split(',').map(Number);
      roundRect(ctx, C.pad + x * C.cell + 2, C.pad + y * C.cell + 2, C.cell - 4, C.cell - 4, 6);
      ctx.fill();
    });

    /* 传送带 */
    if (G.conveyor) {
      ctx.fillStyle = 'rgba(255,138,101,0.12)';
      G.conveyor.forEach((dir, k) => {
        const [x, y] = k.split(',').map(Number);
        ctx.fillRect(C.pad + x * C.cell + 3, C.pad + y * C.cell + 3, C.cell - 6, C.cell - 6);
      });
    }

    /* 传送门 */
    (G.portals || []).forEach((p, i) => {
      ctx.strokeStyle = i % 2 ? '#c07be0' : '#4FC3F7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx(p.x), cy(p.y), 12, 0, Math.PI * 2);
      ctx.stroke();
    });

    /* 闪点 */
    const now = t / 1000;
    G.flashpoints.forEach(f => {
      let col = '#ffd54f';
      if (f.type === 'golden') col = '#ffb300';
      if (f.type === 'unstable') col = '#ff6b6b';
      if (f.type === 'chain') col = '#5fd07a';
      if (f.type === 'emergency') col = '#ff8a65';
      if (f.type === 'decoy') col = '#9aa4b2';
      const pulse = anim ? (Math.sin(now * 4 + f.seed) + 1) / 2 : 0.5;
      const r = 8 + pulse * 4;
      ctx.beginPath();
      ctx.arc(cx(f.x), cy(f.y), r + 9 + pulse * 5, 0, Math.PI * 2);
      ctx.fillStyle = hexA(col, 0.10 + pulse * 0.10);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx(f.x), cy(f.y), r, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = hexA(col, 0.9);
      ctx.lineWidth = 2;
      ctx.stroke();

      if (f.owner) {
        ctx.beginPath();
        ctx.arc(cx(f.x), cy(f.y), r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f.owner.progress);
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    });

    /* 模块核心 */
    G.cores.forEach(c => {
      const p = (Math.sin(now * 5 + c.seed) + 1) / 2;
      ctx.beginPath();
      ctx.arc(cx(c.x), cy(c.y), 7 + p * 3, 0, Math.PI * 2);
      ctx.fillStyle = hexA('#5fd07a', 0.25);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx(c.x), cy(c.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = '#9dffb8';
      ctx.fill();
    });

    const pl = G.player;
    if (G.mode !== 'pid') {
      /* AI */
      G.ais.forEach(a => {
        const col = a.team === 'enemy' ? (a.color || '#ff8a65') : '#5fd07a';
        drawDot(cx(a.x), cy(a.y), col, a.slowUntil > G.time, a.label);
      });

      /* 玩家 */
      const blink = pl.shieldUntil > G.time && anim ? (Math.sin(now * 12) + 1) / 2 : 0;
      if (pl.shieldUntil > G.time) {
        ctx.beginPath();
        ctx.arc(cx(pl.x), cy(pl.y), 20 + blink * 3, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(95,208,122,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      drawDot(cx(pl.x), cy(pl.y), '#4FC3F7', false, null, true);
      if (pl.progress > 0) {
        ctx.beginPath();
        ctx.arc(cx(pl.x), cy(pl.y), 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, pl.progress));
        ctx.strokeStyle = '#4FC3F7';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
    } else if (G.pid) {
      /* PID：异常格 */
      const pulse2 = anim ? (Math.sin(now * 6) + 1) / 2 : 0.5;
      G.pid.anomalies.forEach(a => {
        ctx.fillStyle = `rgba(229,115,115,${0.14 + pulse2 * 0.22})`;
        ctx.fillRect(C.pad + a.x * C.cell + 2, C.pad + a.y * C.cell + 2, C.cell - 4, C.cell - 4);
        ctx.strokeStyle = '#E57373';
        ctx.lineWidth = 2;
        ctx.strokeRect(C.pad + a.x * C.cell + 3, C.pad + a.y * C.cell + 3, C.cell - 6, C.cell - 6);
      });
      /* 进程占用标记 */
      G.pid.procs.forEach(p => {
        if (!p.target || p.status === 'killed') return;
        ctx.beginPath();
        ctx.arc(cx(p.target.x), cy(p.target.y), 20, 0, Math.PI * 2);
        ctx.strokeStyle = p.status === 'not_responding' ? '#E57373' : 'rgba(79,195,247,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    }

    /* 迷雾 */
    if (G.plugins.has('qx-fog')) {
      ctx.save();
      ctx.fillStyle = 'rgba(6,10,18,0.88)';
      ctx.beginPath();
      ctx.rect(0, 0, W, W);
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) {
        if (Math.abs(x - pl.x) <= 2 && Math.abs(y - pl.y) <= 2) {
          ctx.rect(C.pad + x * C.cell, C.pad + y * C.cell, C.cell, C.cell);
        }
      }
      ctx.fill('evenodd');
      ctx.restore();
    }

    /* 停电 */
    if (G.blackoutUntil > G.time) {
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, W, W);
    }

    /* 飘字 */
    G.floats.forEach(f => {
      const k = 1 - f.life / f.maxLife;
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 16px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, cx(f.x), cy(f.y) - 18 - k * 28);
      ctx.globalAlpha = 1;
    });
  };

  function drawDot(x, y, col, slowed, label, isPlayer) {
    ctx.beginPath();
    ctx.arc(x, y, isPlayer ? 14 : 12, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (slowed) {
      ctx.beginPath();
      ctx.arc(x, y, isPlayer ? 19 : 17, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,107,107,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (label) {
      ctx.fillStyle = 'rgba(230,240,255,0.75)';
      ctx.font = '11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y + 26);
    }
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  FP.hexA = hexA;

  /* ---------------- 主循环 ---------------- */
  const FIXED = 1000 / 60;
  let last = 0, acc = 0;

  FP.startLoop = function () {
    last = performance.now();
    requestAnimationFrame(loop);
  };

  function loop(now) {
    const delta = Math.min(now - last, 250);
    last = now;
    acc += delta;
    let guard = 0;
    while (acc >= FIXED && guard < 6) {
      FP.update(FIXED / 1000);
      if (FP.Ani) FP.Ani.update(FIXED / 1000);
      acc -= FIXED;
      guard++;
    }
    if (acc > FIXED * 6) acc = 0;
    FP.render(now);
    if (FP.ui && FP.ui.hud) FP.ui.hud(now);
    requestAnimationFrame(loop);
  }
})();
