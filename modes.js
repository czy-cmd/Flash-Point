/* FLASHPOINT PROTOCOL · modes
 * 常规模式（standard / triangle / multi / xhigh / qwq）玩法
 */
(function () {
  const U = FP.util, C = FP.CONFIG, S = FP.state;

  let uid = 1;
  const now = () => (FP.game ? FP.game.time : 0);

  /* ---------------- 创建一局 ---------------- */
  FP.startGame = function (modeId, rerun) {
    const mode = FP.MODE_MAP[modeId];
    if (!mode) return;
    S.mode = modeId;

    const enabled = FP.activePlugins();
    const G = {
      mode: modeId,
      phase: 'countdown',
      countdown: 3.0,
      time: 0,
      timeLeft: 0,
      duration: mode.dur + (S.sysPlugins['DEVELOPE-time_up'] ? 60 : 0),
      plugins: new Set(enabled),
      walls: new Set(),
      portals: [],
      conveyor: new Map(),
      flashpoints: [],
      cores: [],
      floats: [],
      ais: [],
      player: null,
      shortCd: 0,
      shortCdMax: 10,
      readMul: 1,
      spawnQueue: [],
      targetCount: 3,
      events: [],
      nextEvt: {},
      blackoutUntil: -1,
      lastSpawn: 0,
      evt: {},
      pid: null,
      garbleMap: null,
      ended: false
    };
    FP.game = G;
    G.timeLeft = G.duration;

    if (modeId === 'qwq') G.garbleMap = makeGarbleMap();
    if (modeId === 'xhigh') { G.targetCount = 4; }

    /* 地图插件 */
    if (G.plugins.has('qx-multiply')) G.targetCount += 2;
    if (G.plugins.has('qx-wall') || G.plugins.has('qx-invert')) buildWalls(G);
    if (G.plugins.has('qx-portal')) buildPortals(G);
    if (G.plugins.has('qx-conveyor')) buildConveyor(G);

    /* 玩家 */
    G.player = makeEntity('player', 5, 8, '你', '#4FC3F7');
    G.player.energy = 40;
    G.player.mods = [];

    /* AI */
    const types = ['drone', 'truck', 'faulty', 'drone'];
    const cols = ['#ff8a65', '#ff6b6b', '#e57373', '#ffb74d'];
    const spots = [[1, 1], [9, 1], [1, 9], [9, 9]];
    for (let i = 0; i < mode.ai; i++) {
      const sp = spots[i % spots.length];
      const a = makeEntity('ai', sp[0], sp[1], 'AI-' + '蓝红橙紫'[i], cols[i % cols.length]);
      a.team = 'enemy';
      a.type = types[i % types.length];
      applyAIType(a);
      G.ais.push(a);
    }
    if (G.plugins.has('qx-teammate')) {
      const a = makeEntity('ai', 4, 9, 'AI-队友', '#5fd07a');
      a.team = 'ally';
      a.type = 'drone';
      applyAIType(a);
      G.ais.push(a);
    }
    if (G.plugins.has('qx-thirdparty')) {
      const a = makeEntity('ai', 0, 5, 'AI-捣乱', '#c07be0');
      a.team = 'chaos';
      a.type = 'faulty';
      applyAIType(a);
      G.ais.push(a);
    }

    /* 闪点 */
    for (let i = 0; i < G.targetCount; i++) spawnFlashpoint(G);

    /* 开始 */
    FP.showScreen('game');
    FP.ui.buildSlots();
    FP.ui.renderHUDStatic(G);
    if (modeId === 'pid') FP.initPID(G);
    FP.beep(660, 0.1);
  };

  function makeEntity(kind, x, y, label, color) {
    return {
      id: uid++, kind, x, y, label, color,
      path: [], stepT: 0, target: null, pending: null,
      progress: 0, score: 0, repairs: 0, combo: 0, lastRepair: -99, maxCombo: 0,
      slowUntil: 0, speedUntil: 0, shieldUntil: 0, speedMul: 1,
      jamUntil: 0, jamDir: null, overheatUntil: 0, modsUsed: 0,
      decisionT: 0, state: 'idle', team: 'enemy', finished: false
    };
  }

  function applyAIType(a) {
    if (a.type === 'drone') { a.moveMul = 0.8; a.readMul = 1.4; }
    else if (a.type === 'truck') { a.moveMul = 1.35; a.readMul = 0.8; }
    else { a.moveMul = 1.0; a.readMul = 1.1; }
    if (a.team === 'ally' || a.team === 'chaos') { a.moveMul = 0.9; a.readMul = 1.1; }
  }

  function buildWalls(G) {
    let n = G.plugins.has('qx-wall') ? 6 : 0;
    if (G.plugins.has('qx-invert')) {
      /* 先铺一半墙，再反转 */
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) {
        if ((x + y) % 3 === 0 && Math.random() < 0.55) G.walls.add(x + ',' + y);
      }
      const inv = new Set();
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) {
        if (!G.walls.has(x + ',' + y)) inv.add(x + ',' + y);
      }
      /* 反转后清掉四角，保证可站立 */
      [[5, 8], [1, 1], [9, 1], [1, 9], [9, 9], [5, 5], [0, 5], [4, 9]].forEach(p => inv.delete(p[0] + ',' + p[1]));
      G.walls = inv;
      n = 0;
    }
    for (let i = 0; i < n; i++) {
      const x = U.randInt(0, C.cols - 1), y = U.randInt(0, C.rows - 1);
      if (Math.abs(x - 5) < 2 && Math.abs(y - 8) < 2) continue;
      if (G.walls.has(x + ',' + y)) continue;
      G.walls.add(x + ',' + y);
    }
  }

  function buildPortals(G) {
    const used = new Set();
    for (let i = 0; i < 4; i++) {
      let x, y, k;
      do { x = U.randInt(0, C.cols - 1); y = U.randInt(0, C.rows - 1); k = x + ',' + y; } while (used.has(k) || G.walls.has(k));
      used.add(k);
      G.portals.push({ x, y });
    }
  }

  function buildConveyor(G) {
    for (let i = 0; i < 6; i++) {
      const x = U.randInt(0, C.cols - 1), y = U.randInt(0, C.rows - 1);
      const k = x + ',' + y;
      if (G.walls.has(k)) continue;
      G.conveyor.set(k, U.randInt(0, 3));
    }
  }

  function occupied(G, x, y) {
    if (G.player && G.player.x === x && G.player.y === y) return true;
    if (G.ais.some(a => a.x === x && a.y === y)) return true;
    if (G.flashpoints.some(f => f.x === x && f.y === y)) return true;
    if (G.cores.some(c => c.x === x && c.y === y)) return true;
    return false;
  }

  function freeCell(G) {
    for (let i = 0; i < 200; i++) {
      const x = U.randInt(0, C.cols - 1), y = U.randInt(0, C.rows - 1);
      if (G.walls.has(x + ',' + y)) continue;
      if (occupied(G, x, y)) continue;
      return { x, y };
    }
    return null;
  }

  function spawnFlashpoint(G, forceType) {
    const cell = freeCell(G);
    if (!cell) return null;
    let type = forceType || 'normal';
    if (!forceType) {
      const r = Math.random();
      if (G.plugins.has('qx-lucky') && r < 0.18) type = 'golden';
      else if (r < 0.28) type = 'golden';
      else if (r < 0.40) type = 'unstable';
      else if (r < 0.52) type = 'chain';
    }
    let value = 10;
    if (type === 'golden') value = 30;
    if (type === 'emergency') value = 25;
    if (G.plugins.has('qx-reverse') && Math.random() < 0.5 && type === 'normal') value = 4;
    const f = {
      id: uid++, x: cell.x, y: cell.y, type, value,
      seed: Math.random() * 10,
      ttl: (G.plugins.has('qx-timelimit') || type === 'emergency') ? 5 : (type === 'unstable' ? 3 : Infinity),
      born: G.time, owner: null, decoy: type === 'decoy'
    };
    G.flashpoints.push(f);
    if (G.plugins.has('qx-symmetric') && !forceType) {
      const mx = C.cols - 1 - cell.x;
      if (!G.walls.has(mx + ',' + cell.y) && !G.flashpoints.some(o => o.x === mx && o.y === cell.y)) {
        G.flashpoints.push(Object.assign({}, f, { id: uid++, x: mx, seed: Math.random() * 10 }));
      }
    }
    return f;
  }
  FP.spawnFlashpoint = () => spawnFlashpoint(FP.game);

  /* ---------------- 输入 ---------------- */
  FP.onBoardClick = function (ev) {
    const G = FP.game;
    if (!G) return;
    const cell = FP.canvasToGrid(ev);
    if (!cell) return;
    if (G.mode === 'pid') { FP.pidClick(G, cell.x, cell.y); return; }
    if (G.phase !== 'playing') return;

    let gx = cell.x, gy = cell.y;
    const p = G.player;
    if (G.plugins.has('qx-reverseop')) {
      gx = U.clamp(2 * p.x - cell.x, 0, C.cols - 1);
      gy = U.clamp(2 * p.y - cell.y, 0, C.rows - 1);
    }
    if (G.walls.has(gx + ',' + gy)) { G.flash = { x: gx, y: gy, t: G.time + 0.3 }; FP.beep(180, 0.06, 'square'); return; }

    const fp = G.flashpoints.find(f => f.x === gx && f.y === gy);
    if (fp && p.x === gx && p.y === gy) {
      if (p.target === fp) return;
      startRead(p, fp);
      return;
    }

    const path = FP.bfs(p.x, p.y, gx, gy, G.walls);
    if (!path) { FP.beep(180, 0.06, 'square'); return; }
    p.path = path;
    p.pending = fp || null;
    p.progress = 0;
    if (p.target) { interrupt(p, true); }
    p.target = null;
  };

  function startRead(e, fp) {
    if (fp.decoy) return;
    e.target = fp;
    e.progress = 0;
    e.path = [];
    e.pending = null;
    fp.owner = e;
    FP.beep(520, 0.07);
  }

  function interrupt(e, penalty) {
    if (!e.target) return;
    const G = FP.game;
    if (e.target.owner === e) e.target.owner = null;
    if (penalty && G.plugins.has('qx-penalty')) {
      e.score = Math.max(0, e.score - 5);
      addFloat(G, e.x, e.y, '-5 打断', '#ff6b6b');
    }
    e.target = null;
    e.progress = 0;
  }
  FP.interrupt = interrupt;

  /* ---------------- 更新 ---------------- */
  FP.update = function (dt) {
    const G = FP.game;
    if (!G) return;
    if (G.paused) return;
    if (G.phase === 'countdown') {
      const before = Math.ceil(G.countdown);
      G.countdown -= dt;
      const after = Math.ceil(G.countdown);
      if (after !== before && after > 0) FP.beep(440, 0.08);
      if (G.countdown > 0) { FP.ui.countdown(String(Math.ceil(G.countdown))); return; }
      G.phase = 'playing';
      G.time = 0;
      G.timeLeft = G.duration;
      FP.ui.countdown('');
      FP.beep(880, 0.16);
      return;
    }
    if (G.mode === 'pid') { if (G.phase === 'playing') FP.updatePID(dt); return; }
    if (G.phase !== 'playing') return;

    G.time += dt;
    G.timeLeft -= dt;
    if (G.shortCd > 0) G.shortCd = Math.max(0, G.shortCd - dt);
    G.readMul = 1;
    if (G.plugins.has('qx-accel') && G.timeLeft <= 15) G.readMul = 1.3;
    FP.tickMods();

    tickEvents(G, dt);
    updateEntity(G, G.player, dt, true);
    G.ais.forEach(a => updateEntity(G, a, dt, false));
    updateFlashpoints(G, dt);
    updateCores(G, dt);

    /* 维持闪点数量 */
    if (G.flashpoints.filter(f => !f.decoy).length < G.targetCount && G.time > G.lastSpawn + 1) {
      G.lastSpawn = G.time;
      spawnFlashpoint(G);
    }

    /* 飘字寿命 */
    G.floats.forEach(f => { f.life += dt; });
    G.floats = G.floats.filter(f => f.life < f.maxLife);

    if (G.timeLeft <= 0) { G.timeLeft = 0; FP.endGame('time'); }
  };

  function updateEntity(G, e, dt, isPlayer) {
    /* 读条推进 */
    if (e.target) {
      const fp = e.target;
      if (!G.flashpoints.includes(fp)) { e.target = null; e.progress = 0; }
      else if (e.x !== fp.x || e.y !== fp.y) { e.target = null; e.progress = 0; }
      else {
        let readTime = 2 * (e.readMul || 1) * (fp.type === 'unstable' ? 0.5 : 1);
        if (e.slowUntil > G.time) readTime *= 1.5;
        if (G.plugins.has('qx-boots')) readTime += 0.5;
        if (G.plugins.has('qx-dual')) readTime += 1;
        if (G.plugins.has('qx-speedread')) readTime *= 0.5;
        if (e.speedUntil > G.time && e.speedReading) readTime *= (1 - e.speedReading);
        readTime /= G.readMul;
        e.progress += dt / Math.max(0.4, readTime);
        if (G.plugins.has('qx-voltage') && Math.random() < dt * 0.08 * 2) {
          interrupt(e, true);
          addFloat(G, e.x, e.y, '电压中断', '#ff6b6b');
        }
        if (e.progress >= 1) completeFlashpoint(G, e, fp);
      }
    }

    /* 移动 */
    if (e.path.length) {
      e.stepT -= dt;
      if (e.stepT <= 0) {
        const nxt = e.path.shift();
        e.x = nxt.x; e.y = nxt.y;
        let step = 0.135 * (e.moveMul || 1);
        if (e.slowUntil > G.time) step *= 1.7;
        if (e.speedUntil > G.time) step /= (e.speedMul || 1.8);
        if (G.plugins.has('qx-boots')) step /= 1.5;
        if (G.plugins.has('qx-accel') && G.timeLeft <= 15) step /= 1.3;
        e.stepT = step;

        /* 传送带 */
        const convKey = e.x + ',' + e.y;
        if (G.conveyor && G.conveyor.has(convKey)) {
          const d = G.conveyor.get(convKey);
          const dx = [1, -1, 0, 0][d], dy = [0, 0, 1, -1][d];
          const nx = U.clamp(e.x + dx, 0, C.cols - 1), ny = U.clamp(e.y + dy, 0, C.rows - 1);
          if (!G.walls.has(nx + ',' + ny)) { e.x = nx; e.y = ny; }
        }
        /* 传送门 */
        G.portals.forEach((p, i) => {
          if (p.x === e.x && p.y === e.y) {
            const o = G.portals[i % 2 === 0 ? i + 1 : i - 1];
            if (o) { e.x = o.x; e.y = o.y; e.path = []; }
          }
        });

        if (e.path.length === 0 && e.pending) {
          const fp2 = e.pending;
          e.pending = null;
          if (G.flashpoints.includes(fp2) && fp2.x === e.x && fp2.y === e.y) startRead(e, fp2);
        }
        /* 拾取核心 */
        if (e.path.length === 0) checkCorePickup(G, e);
      }
    }

    if (!isPlayer) aiThink(G, e, dt);
  }

  function completeFlashpoint(G, e, fp) {
    const base = fp.value;
    G.flashpoints = G.flashpoints.filter(f => f !== fp);
    if (fp.owner) fp.owner.progress = 0;

    if (fp.decoy) { e.target = null; e.progress = 0; return; }

    /* 连击 */
    const window = G.plugins.has('qx-combo') ? 12 : 8;
    if (G.time - e.lastRepair <= window) e.combo++; else e.combo = 1;
    e.lastRepair = G.time;
    e.maxCombo = Math.max(e.maxCombo, e.combo);

    let pts = base;
    let bonus = 0;
    if (!G.plugins.has('qx-nocombo')) {
      bonus = Math.min(10, Math.max(0, (e.combo - 1) * 2));
      pts += bonus;
    } else {
      pts = 15;
    }
    if (G.plugins.has('qx-double')) pts *= 2;
    if (G.plugins.has('qx-chain') && e.lastChainPos) {
      const dx = Math.abs(e.lastChainPos.x - fp.x), dy = Math.abs(e.lastChainPos.y - fp.y);
      if (dx <= 2 && dy <= 2) pts = Math.round(pts * 1.5);
    }
    e.lastChainPos = { x: fp.x, y: fp.y };
    if (fp.type === 'chain') {
      G.flashpoints.forEach(o => { if (Math.abs(o.x - fp.x) <= 1 && Math.abs(o.y - fp.y) <= 1) o.quick = true; });
    }
    if (G.plugins.has('qx-bounty') && G.ais.length) {
      const leader = [G.player, ...G.ais].sort((a, b) => b.score - a.score)[0];
      if (leader === e) G.ais.forEach(a => { a.score += 5; });
    }
    if (G.plugins.has('qx-explode')) {
      G.ais.forEach(a => { if (Math.abs(a.x - fp.x) <= 1 && Math.abs(a.y - fp.y) <= 1) a.slowUntil = G.time + 1; });
    }

    e.score += Math.round(pts);
    e.repairs++;
    e.target = null;
    e.progress = 0;

    if (e === G.player) {
      G.player.energy = Math.min(100, G.player.energy + 10);
      addFloat(G, fp.x, fp.y, '+' + Math.round(pts), fcOf(fp.type));
      if (bonus > 0) addFloat(G, fp.x, fp.y - 0.6, '连击 +' + bonus, '#5fd07a');
      /* 掉落 */
      if (Math.random() < 0.4 && G.cores.length < 2) {
        G.cores.push({ x: fp.x, y: fp.y, seed: Math.random() * 10, ttl: 5 });
      }
      if (fp.type === 'golden') FP.beep(1040, 0.16);
      else FP.beep(760, 0.1);
    } else if (e.team === 'ally') {
      G.player.score += Math.round(pts);
      G.player.repairs++;
      addFloat(G, fp.x, fp.y, '队友 +' + Math.round(pts), '#5fd07a');
    } else {
      addFloat(G, fp.x, fp.y, '+' + Math.round(pts), '#ff8a65');
    }

    if (fp.type === 'unstable') {
      G.ais.forEach(a => { if (Math.abs(a.x - fp.x) <= 1 && Math.abs(a.y - fp.y) <= 1) a.slowUntil = G.time + 1; });
    }
  }

  function fcOf(t) {
    return t === 'golden' ? '#ffb300' : t === 'unstable' ? '#ff6b6b' : t === 'chain' ? '#5fd07a' : '#ffd54f';
  }

  function updateFlashpoints(G, dt) {
    G.flashpoints.forEach(f => {
      if (f.ttl !== Infinity && G.time - f.born > f.ttl) {
        if (f.type === 'unstable' && Math.random() < 1) {
          G.ais.forEach(a => { if (Math.abs(a.x - f.x) <= 1 && Math.abs(a.y - f.y) <= 1) a.slowUntil = G.time + 1.5; });
        }
        if (f.owner) { f.owner.target = null; f.owner.progress = 0; }
      }
    });
    const before = G.flashpoints.length;
    G.flashpoints = G.flashpoints.filter(f => f.ttl === Infinity || G.time - f.born <= f.ttl);
    if (before !== G.flashpoints.length && G.time > 1) {
      /* 被清理的闪点稍后补上 */
      G.lastSpawn = -99;
    }
  }

  function updateCores(G, dt) {
    G.cores = G.cores.filter(c => G.time - (c.born || (c.born = G.time)) < c.ttl);
  }

  function checkCorePickup(G, e) {
    const i = G.cores.findIndex(c => c.x === e.x && c.y === e.y);
    if (i < 0) return;
    const c = G.cores[i];
    if (e === G.player) {
      G.cores.splice(i, 1);
      FP.openAssembly();
    } else if (e.team === 'enemy') {
      G.cores.splice(i, 1);
      addFloat(G, e.x, e.y, 'AI 抢走核心', '#ff8a65');
    }
  }

  /* ---------------- AI ---------------- */
  function aiThink(G, a, dt) {
    a.decisionT -= dt;
    if (a.decisionT > 0) return;
    const diff = S.settings.difficulty;
    let base = diff === 'easy' ? 12 : diff === 'hard' ? 3 : 6;
    base *= (a.moveMul || 1);
    if (G.plugins.has('qx-rage')) base *= 0.5;
    if (G.plugins.has('qx-ailag')) base *= 2;
    a.decisionT = base / 60;

    if (a.slowUntil > G.time) return;
    if (a.jamUntil > G.time) return;

    if (a.target) return; /* 正在读条 */

    /* 找目标 */
    let best = null, bestD = 1e9;
    G.flashpoints.forEach(f => {
      if (f.owner && f.owner !== a) return;
      const d = Math.abs(f.x - a.x) + Math.abs(f.y - a.y);
      if (d < bestD) { bestD = d; best = f; }
    });
    if (!best) return;
    if (a.x === best.x && a.y === best.y) { startRead(a, best); return; }
    const path = FP.bfs(a.x, a.y, best.x, best.y, G.walls);
    if (path && path.length) { a.path = path; a.pending = best; }
  }

  /* ---------------- 事件插件 ---------------- */
  function tickEvents(G, dt) {
    const P = G.plugins;
    G.evt.gs = (G.evt.gs || 0) + dt;
    if (P.has('qx-globalshort') && G.evt.gs > 15) {
      G.evt.gs = 0;
      [G.player, ...G.ais].forEach(e => { e.slowUntil = G.time + 1; });
      addFloat(G, 5, 5, '全图短路', '#4FC3F7');
    }
    G.evt.bo = (G.evt.bo || 0) + dt;
    if (P.has('qx-blackout') && G.evt.bo > 20) { G.evt.bo = 0; G.blackoutUntil = G.time + 2; }
    G.evt.fl = (G.evt.fl || 0) + dt;
    if (P.has('qx-fluctuation') && G.evt.fl > 5) {
      G.evt.fl = 0;
      G.readMul = 0.7 + Math.random() * 0.6;
    }
    G.evt.tp = (G.evt.tp || 0) + dt;
    if (P.has('qx-randomtp') && G.evt.tp > 15) {
      G.evt.tp = 0;
      [G.player, ...G.ais].forEach(e => {
        const c = freeCell(G);
        if (c) { e.x = c.x; e.y = c.y; e.path = []; }
      });
    }
    G.evt.mv = (G.evt.mv || 0) + dt;
    if (P.has('qx-moving') && G.evt.mv > 8) {
      G.evt.mv = 0;
      G.flashpoints.slice(0, 2).forEach(f => {
        const c = freeCell(G);
        if (c) { f.x = c.x; f.y = c.y; }
      });
    }
    G.evt.sh = (G.evt.sh || 0) + dt;
    if (P.has('qx-shrink') && G.evt.sh > 10) {
      G.evt.sh = 0;
      G.shrink = (G.shrink || 0) + 1;
      const r = G.shrink;
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) {
        if (x < r || y < r || x >= C.cols - r || y >= C.rows - r) G.walls.add(x + ',' + y);
      }
    }
    G.evt.re = (G.evt.re || 0) + dt;
    if (P.has('qx-randomevent') && G.evt.re > 10) {
      G.evt.re = 0;
      const pool = ['storm', 'lucky', 'short', 'spawn'];
      const pick = U.pick(pool);
      if (pick === 'storm') {
        const e = U.pick(G.ais.concat([G.player]));
        e.slowUntil = G.time + 2;
        addFloat(G, e.x, e.y, '雷击', '#4FC3F7');
      } else if (pick === 'lucky') {
        const e = U.pick([G.player, ...G.ais]);
        e.score += 10;
        addFloat(G, e.x, e.y, '+10 幸运', '#ffd54f');
      } else if (pick === 'short') {
        G.ais.forEach(a => { a.slowUntil = G.time + 1; });
      } else {
        spawnFlashpoint(G, 'emergency');
      }
    }
    G.evt.em = (G.evt.em || 0) + dt;
    if (P.has('qx-emergency') && G.evt.em > 18) {
      G.evt.em = 0;
      spawnFlashpoint(G, 'emergency');
    }
    /* 相位：不稳定闪点快照 */
    if (P.has('qx-freeze') && G.shortCdMax !== 15) G.shortCdMax = 15;
  }

  /* ---------------- 短路 ---------------- */
  FP.shortCircuit = function () {
    const G = FP.game;
    if (!G || G.phase !== 'playing' || G.shortCd > 0) return;
    if (G.mode === 'pid') return;
    let near = null, nd = 1e9;
    G.ais.forEach(a => {
      if (a.team !== 'enemy') return;
      const d = Math.abs(a.x - G.player.x) + Math.abs(a.y - G.player.y);
      if (d < nd) { nd = d; near = a; }
    });
    if (!near) return;
    const dur = G.plugins.has('qx-freeze') ? 2 : 1.5;
    near.slowUntil = G.time + dur;
    if (G.plugins.has('qx-backfire')) G.player.slowUntil = G.time + 1;
    G.shortCd = G.shortCdMax / (G.plugins.has('qx-dual') ? 2 : 1);
    addFloat(G, near.x, near.y, G.plugins.has('qx-freeze') ? '冻结' : '短路', '#4FC3F7');
    FP.beep(300, 0.14, 'sawtooth');
  };

  /* ---------------- 模块使用 ---------------- */
  FP.useModule = function (i) {
    const G = FP.game;
    if (!G || G.phase !== 'playing') return;
    const p = G.player;
    const slot = p.mods[i];
    if (!slot) return;
    const lv = FP.LEVELS[slot.level];
    if (slot.overheatUntil > G.time) { FP.ui.toast('模块过热中'); return; }
    if (p.energy < lv.cost) { FP.ui.toast('能量不足'); FP.beep(160, 0.08, 'square'); return; }

    p.energy -= lv.cost;
    p.modsUsed++;
    const idx = FP.LEVEL_ORDER.indexOf(slot.level);
    const eff = FP.MODULE_EFFECT[slot.mid];
    const t = G.time;

    if (slot.mid === 'pulse') {
      const range = eff.range[idx];
      let hit = 0;
      G.ais.forEach(a => {
        if (Math.abs(a.x - p.x) <= range && Math.abs(a.y - p.y) <= range) {
          a.slowUntil = Math.max(a.slowUntil, t + eff.slow[idx]);
          a.progress = 0;
          hit++;
          if (G.plugins.has('qx-decoy')) a.score = Math.max(0, a.score - 5);
        }
      });
      if (eff.shield[idx] > 0) p.shieldUntil = Math.max(p.shieldUntil, t + eff.shield[idx]);
      addFloat(G, p.x, p.y, '脉冲 · 命中 ' + hit, '#4FC3F7');
    } else if (slot.mid === 'shield') {
      p.shieldUntil = t + eff.dur[idx];
      p.speedReading = eff.move[idx];
      addFloat(G, p.x, p.y, '护盾 ' + eff.dur[idx] + 's', '#5fd07a');
    } else if (slot.mid === 'speed') {
      p.speedUntil = t + eff.dur[idx];
      p.speedMul = eff.mul[idx];
      p.speedReading = eff.read[idx];
      addFloat(G, p.x, p.y, '加速 ×' + eff.mul[idx], '#ffd54f');
    } else if (slot.mid === 'decoy') {
      const c = freeCell(G) || { x: p.x, y: p.y };
      G.flashpoints.push({
        id: uid++, x: c.x, y: c.y, type: 'decoy', value: 0, decoy: true,
        seed: Math.random() * 10, ttl: eff.dur[idx], born: t, owner: null
      });
      if (eff.range[idx] > 0) {
        setTimeout(() => {
          if (!FP.game || FP.game !== G) return;
          G.ais.forEach(a => {
            if (Math.abs(a.x - c.x) <= eff.range[idx] && Math.abs(a.y - c.y) <= eff.range[idx]) a.slowUntil = G.time + eff.slow[idx];
          });
        }, eff.dur[idx] * 1000);
      }
      addFloat(G, p.x, p.y, '诱饵部署', '#ff9f6b');
    } else if (slot.mid === 'overload') {
      if (p.target) { p.progress = 1; completeFlashpoint(G, p, p.target); }
      p.overheatUntil = t + eff.overheat[idx];
      if (eff.immune[idx] > 0) p.shieldUntil = t + eff.immune[idx];
      addFloat(G, p.x, p.y, '过载', '#ff6b6b');
    } else if (slot.mid === 'jam') {
      let near = null, nd = 1e9;
      G.ais.forEach(a => {
        const d = Math.abs(a.x - p.x) + Math.abs(a.y - p.y);
        if (d < nd) { nd = d; near = a; }
      });
      if (near) {
        near.jamUntil = t + eff.dur[idx];
        near.path = [];
        near.target = null;
        addFloat(G, near.x, near.y, '干扰', '#c07be0');
      }
    }

    slot.heat += lv.heat;
    if (slot.heat >= 100) { slot.heat = 100; slot.overheatUntil = t + lv.overheat; }
    FP.ui.buildSlots();
    FP.beep(620, 0.1, 'triangle');
  };

  /* 过热冷却 */
  FP.tickMods = function () {
    const G = FP.game;
    if (!G || !G.player) return;
    G.player.mods.forEach(s => {
      if (s.overheatUntil && s.overheatUntil <= G.time) { s.overheatUntil = 0; s.heat = 0; }
    });
  };

  /* ---------------- 装配 ---------------- */
  const ASM = { open: false, module: null, level: null, seq: [], input: [], phase: 'flash', timeLeft: 6, wrongs: 0, timer: null, flashIdx: 0 };
  FP.asm = ASM;

  function rollLevel(G) {
    const weights = FP.LEVEL_ORDER.map(k => FP.LEVELS[k].drop / 100);
    /* 连击加成 */
    let boost = 0;
    if (G.player.combo >= 3) boost = 0.05;
    if (G.player.combo >= 5) boost = 0.10;
    let w = [weights[0] - boost, weights[1], weights[2] + boost * 0.7, weights[3] + boost * 0.25, weights[4] + boost * 0.05];
    if (G.player.combo >= 8) w = [0, 0.4, 0.6, 0.2, 0.02];
    if (G.player.combo >= 10) w = [0, 0.05, 0.55, 0.45, 0.08];
    const sum = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return FP.LEVEL_ORDER[i]; }
    return 'SP';
  }

  FP.openAssembly = function () {
    const G = FP.game;
    if (!G) return;
    const mids = Object.keys(FP.MODULES);
    ASM.open = true;
    ASM.module = U.pick(mids);
    ASM.level = rollLevel(G);
    ASM.phase = 'flash';
    ASM.timeLeft = 6;
    ASM.wrongs = 0;
    ASM.input = [];
    ASM.flashIdx = 0;

    const lv = FP.LEVELS[ASM.level];
    const cells = U.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, lv.nodes);
    ASM.seq = cells;

    const root = FP.$('asm-panel');
    root.classList.add('active');
    FP.$('asm-title').textContent = '装配：' + FP.MODULES[ASM.module].name;
    const badge = FP.$('asm-badge');
    badge.textContent = ASM.level;
    badge.style.color = lv.color;
    FP.$('asm-sub').textContent = lv.full + ' · ' + lv.cn;
    FP.$('asm-time').textContent = '限时 6s';
    FP.$('asm-nodes').textContent = '节点 ' + lv.nodes;
    FP.$('asm-msg').textContent = '记住闪烁顺序…';

    const grid = FP.$('asm-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const b = FP.el('button', 'asm-cell');
      b.dataset.i = i;
      b.addEventListener('click', () => asmClick(i));
      grid.appendChild(b);
    }

    /* 闪烁演示 */
    let k = 0;
    const flashNext = () => {
      if (!ASM.open || ASM.phase !== 'flash') return;
      grid.children[ASM.seq[k]].classList.add('flash');
      setTimeout(() => {
        if (grid.children[ASM.seq[k]]) grid.children[ASM.seq[k]].classList.remove('flash');
        k++;
        if (k < ASM.seq.length) setTimeout(flashNext, 180);
        else { ASM.phase = 'input'; FP.$('asm-msg').textContent = '按顺序点击'; }
      }, lv.flash * 1000);
    };
    setTimeout(flashNext, 400);

    clearInterval(ASM.timer);
    ASM.timer = setInterval(() => {
      if (!ASM.open) return;
      if (ASM.phase === 'input') {
        ASM.timeLeft -= 0.1;
        FP.$('asm-time').textContent = '限时 ' + Math.max(0, ASM.timeLeft).toFixed(1) + 's';
        if (ASM.timeLeft <= 0) asmFail('超时');
      }
    }, 100);
  };

  function asmClick(i) {
    if (!ASM.open || ASM.phase !== 'input') return;
    if (ASM.seq[ASM.input.length] === i) {
      ASM.input.push(i);
      const cell = FP.$('asm-grid').children[i];
      if (cell) { cell.classList.add('ok'); }
      FP.beep(700 + ASM.input.length * 60, 0.06);
      if (ASM.input.length === ASM.seq.length) asmSuccess();
    } else {
      ASM.wrongs++;
      ASM.timeLeft -= 1;
      FP.$('asm-msg').textContent = '点错 ' + ASM.wrongs + '/2 · 扣 1 秒';
      FP.beep(150, 0.1, 'square');
      const cell = FP.$('asm-grid').children[i];
      if (cell) { cell.classList.add('bad'); setTimeout(() => cell.classList.remove('bad'), 300); }
      if (ASM.wrongs >= 2) asmFail('点错两次');
    }
  }

  function asmSuccess() {
    clearInterval(ASM.timer);
    ASM.open = false;
    FP.$('asm-panel').classList.remove('active');
    const G = FP.game;
    const lv = FP.LEVELS[ASM.level];
    const p = G.player;
    const mod = { mid: ASM.module, level: ASM.level, heat: 0, overheatUntil: 0 };

    if (p.mods.length >= 3) {
      /* 替换级别最低的 */
      let worst = 0;
      p.mods.forEach((m, i) => { if (FP.LEVEL_ORDER.indexOf(m.level) < FP.LEVEL_ORDER.indexOf(p.mods[worst].level)) worst = i; });
      p.mods[worst] = mod;
    } else p.mods.push(mod);

    if (ASM.level === 'ARC') p.energy = Math.min(100, p.energy + 2);
    if (ASM.level === 'BLT') p.energy = Math.min(100, p.energy + 5);
    if (ASM.level === 'SRG') { p.energy = Math.min(100, p.energy + 8); mod.heat = Math.max(0, mod.heat); }
    if (ASM.level === 'PKS') { p.energy = Math.min(100, p.energy + 10); mod.heat = 0; G.lastSpawn = -99; }

    FP.ui.buildSlots();
    FP.ui.toast('装配成功：' + FP.MODULES[ASM.module].name + ' [' + ASM.level + ']');
    FP.beep(980, 0.16);
  }

  function asmFail(reason) {
    clearInterval(ASM.timer);
    ASM.open = false;
    FP.$('asm-panel').classList.remove('active');
    FP.ui.toast('核心碎裂（' + reason + '）');
    FP.beep(120, 0.25, 'square');
  }
  FP.asmFail = asmFail;

  /* ---------------- 飘字 ---------------- */
  function addFloat(G, x, y, text, color) {
    G.floats.push({ x, y, text, color: color || '#e6f0ff', life: 0, maxLife: 0.9 });
  }
  FP.addFloat = addFloat;

  /* ---------------- 结束 ---------------- */
  FP.endGame = function (reason) {
    const G = FP.game;
    if (!G || G.ended) return;
    G.ended = true;
    G.phase = 'over';
    if (ASM.open) asmFail('退出');

    const list = [{ name: '你', score: G.player.score, repairs: G.player.repairs, combo: G.player.maxCombo, isPlayer: true }];
    G.ais.forEach(a => {
      if (a.team === 'ally') return;
      list.push({
        name: a.label,
        score: a.team === 'chaos' ? 0 : a.score,
        repairs: a.repairs, combo: a.maxCombo,
        isPlayer: false
      });
    });
    list.sort((a, b) => b.score - a.score);
    const rank = list.findIndex(x => x.isPlayer) + 1;

    const noRecord = S.degraded || S.debug;
    let isRecord = false;
    const key = G.mode;
    if (!noRecord) {
      if ((S.highscores[key] || 0) < G.player.score) { S.highscores[key] = G.player.score; isRecord = true; FP.saveHighscores(); }
    }

    S.lastResult = {
      mode: G.mode, reason, list, rank, score: G.player.score,
      repairs: G.player.repairs, maxCombo: G.player.maxCombo,
      modsUsed: G.player.modsUsed, isRecord, noRecord,
      crash: !!G.crashed, pid: G.pid
    };
    FP.showScreen('result');
    FP.ui.renderResult();
    FP.beep(520, 0.3);
  };

  /* ---------------- 乱码 ---------------- */
  function makeGarbleMap() {
    const pool = 'ÆØÅæøåßþðÐÞ∇∆∑∏∫√∞≈≠≤≥';
    const map = new Map();
    return {
      get(text) {
        if (!text) return text;
        if (!map.has(text)) {
          map.set(text, text.split('').map(ch => ch === ' ' ? ' ' : pool[Math.floor(Math.random() * pool.length)]).join(''));
        }
        return map.get(text);
      }
    };
  }
  FP.garble = function (text) {
    const G = FP.game;
    if (!G || !G.garbleMap) return text;
    return G.garbleMap.get(text);
  };
})();
