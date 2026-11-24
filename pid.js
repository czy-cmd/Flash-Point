/* FLASHPOINT PROTOCOL · pid
 * PID 进程模式：进程调度、CPU / 内存、任务管理器
 */
(function () {
  const U = FP.util, S = FP.state;
  const MEM_TOTAL = 8;

  FP.initPID = function (G) {
    G.pid = {
      procs: [], anomalies: [], nextAnomaly: 2, hangAcc: 0,
      cpuOver: 0, memFull: 0, combo: 0, killedAnomaly: 0, completed: 0,
      warned: 0, renderT: 0, msg: ''
    };
    G.pid.procs.push({
      pid: '0001', name: '系统', target: null, mem: 1, kind: 'system',
      priority: 2, progress: 0, status: 'system', cpu: 0, age: 0
    });
    G.targetCount = 3;
    G.player.score = 0;
    G.player.repairs = 0;
    FP.ui.buildPID(true);
  };

  function memUsed(G) {
    return G.pid.procs.reduce((s, p) => s + ((p.status === 'killed' || p.status === 'completed') ? 0 : p.mem), 0);
  }
  FP.pidMem = memUsed;

  function cpuLoad(G) {
    const running = G.pid.procs.filter(p => p.status === 'running');
    const load = running.reduce((s, p) => s + (p.kind === 'anomaly' ? 15 : p.kind === 'gold' ? 25 : 20), 0);
    return Math.min(100, load);
  }
  FP.pidCpu = cpuLoad;

  function nextPid(G) {
    for (let i = 0; i < 50; i++) {
      const n = U.randInt(1000, 9999);
      if (!G.pid.procs.some(p => p.pid === String(n))) return String(n);
    }
    return String(U.randInt(1000, 9999));
  }

  FP.pidClick = function (G, x, y) {
    if (G.phase !== 'playing') return;
    const fp = G.flashpoints.find(f => f.x === x && f.y === y && !f.pid);
    if (fp) {
      const need = fp.type === 'golden' ? 2 : 1;
      if (memUsed(G) + need > MEM_TOTAL) {
        G.pid.msg = '内存不足，请结束进程';
        FP.ui.toast('内存不足，请结束进程');
        FP.beep(150, 0.1, 'square');
        return;
      }
      addProc(G, fp, fp.type === 'golden' ? 'gold' : 'normal');
      return;
    }
    const ai = G.pid.anomalies.findIndex(a => a.x === x && a.y === y);
    if (ai >= 0) {
      if (memUsed(G) + 1 > MEM_TOTAL) { FP.ui.toast('内存不足，请结束进程'); return; }
      const cell = G.pid.anomalies[ai];
      G.pid.anomalies.splice(ai, 1);
      addProc(G, null, 'anomaly', cell);
      return;
    }
  };

  function addProc(G, fp, kind, cell) {
    const p = {
      pid: nextPid(G),
      name: kind === 'anomaly' ? '异常进程' : '抢修-闪点' + (fp ? String.fromCharCode(65 + (G.pid.procs.length % 26)) : ''),
      target: fp,
      mem: kind === 'anomaly' ? 1 : (kind === 'gold' ? 2 : 1),
      kind, priority: 2, progress: 0, status: 'running', cpu: 0, age: 0
    };
    if (fp) fp.pid = p.pid;
    G.pid.procs.push(p);
    FP.beep(480, 0.06);
    FP.ui.buildPID();
  }

  /* ---------------- 每帧 ---------------- */
  FP.updatePID = function (dt) {
    const G = FP.game, P = G.pid;
    G.time += dt;
    G.timeLeft -= dt;
    G.floats = G.floats.filter(f => { f.life += dt; return f.life < f.maxLife; });

    /* 异常格生成 */
    P.nextAnomaly -= dt;
    if (P.nextAnomaly <= 0) {
      P.nextAnomaly = G.plugins.has('qx-thirdparty') ? 4 : 6;
      if (P.anomalies.length < 2) {
        const c = freeCell(G);
        if (c) P.anomalies.push({ x: c.x, y: c.y, born: G.time });
      }
    }

    /* CPU 分配 */
    const running = P.procs.filter(p => p.status === 'running');
    const weightOf = p => p.priority;
    const totalW = running.reduce((s, p) => s + weightOf(p), 0) || 1;
    P.procs.forEach(p => { p.cpu = p.status === 'running' ? 100 * weightOf(p) / totalW : 0; });
    const cpuTotal = cpuLoad(G);

    /* 闪点补充 */
    P.spawnT = (P.spawnT || 0) + dt;
    if (P.spawnT > 1 && G.flashpoints.filter(f => !f.pid).length < G.targetCount) {
      P.spawnT = 0;
      FP.spawnFlashpoint();
    }

    /* 进度推进 */
    const slow = P.warned ? 0.7 : 1;
    running.forEach(p => {
      p.age += dt;
      if (p.kind === 'anomaly' || p.kind === 'system') return;
      const base = p.kind === 'gold' ? 25 : 50;
      p.progress += (p.cpu / 100) * base * dt * slow;
      if (p.progress >= 100) completeProc(G, p);
    });

    /* 异常进程拖垮系统 */
    P.procs.forEach(p => {
      if (p.kind !== 'anomaly' || p.status !== 'running') return;
      if (p.age > 10 && !p.punished) {
        p.punished = true;
        const cand = P.procs.filter(q => q.status === 'running' && q.kind !== 'anomaly' && q.kind !== 'system');
        if (cand.length) {
          const victim = U.pick(cand);
          victim.status = 'not_responding';
          P.msg = '进程 ' + victim.pid + ' 无响应';
          FP.ui.toast('异常进程导致 ' + victim.pid + ' 卡死');
        }
      }
    });

    /* 卡死判定（每秒） */
    P.hangAcc += dt;
    if (P.hangAcc >= 1) {
      P.hangAcc = 0;
      const diff = S.settings.difficulty;
      const k = diff === 'easy' ? 1.6 : diff === 'hard' ? 0.6 : 1;
      P.procs.forEach(p => {
        if (p.status !== 'running' || p.kind === 'system' || p.kind === 'anomaly') return;
        const chance = (p.priority === 3 ? 0.02 : p.priority === 1 ? 0.08 : 0.05) * k;
        if (Math.random() < chance) {
          p.status = 'not_responding';
          FP.ui.toast('进程 ' + p.pid + ' 无响应');
          FP.beep(140, 0.12, 'square');
        }
      });
    }

    /* 过载 / 崩溃 */
    if (cpuTotal >= 100) P.cpuOver += dt; else { P.cpuOver = 0; P.warned = 0; }
    if (P.cpuOver > 10 && !P.warned) { P.warned = 1; FP.ui.toast('CPU 过载，进度 -30%'); }
    if (P.cpuOver > 20) return crash(G, 'CPU 持续 100%');
    const nr = P.procs.filter(p => p.status === 'not_responding').length;
    if (nr >= 5) return crash(G, '无响应进程达到 5 个');
    if (memUsed(G) >= MEM_TOTAL) { P.memFull += dt; if (P.memFull > 10) return crash(G, '内存溢出'); }
    else P.memFull = 0;

    /* 面板刷新 */
    P.renderT += dt;
    if (P.renderT > 0.25) { P.renderT = 0; FP.ui.buildPID(); }

    if (G.timeLeft <= 0) { G.timeLeft = 0; FP.endGame('time'); }
  };

  function completeProc(G, p) {
    p.status = 'completed';
    p.completedAt = G.time;
    const fp = G.flashpoints.find(f => f.pid === p.pid);
    if (fp) { G.flashpoints = G.flashpoints.filter(f => f !== fp); G.lastSpawn = -99; }
    let pts = p.kind === 'gold' ? 30 : 10;
    G.pid.combo++;
    if (G.pid.combo > 3) pts += Math.min(10, (G.pid.combo - 3) * 2);
    if (G.plugins.has('qx-double')) pts *= 2;
    G.player.score += pts;
    G.player.repairs++;
    G.pid.completed++;
    FP.addFloat(G, p.target ? p.target.x : 5, p.target ? p.target.y : 5, '+' + pts, p.kind === 'gold' ? '#ffb300' : '#5fd07a');
    FP.beep(p.kind === 'gold' ? 1000 : 700, 0.12);
    setTimeout(() => { if (FP.game === G) FP.ui.buildPID(); }, 3000);
  }

  function crash(G, why) {
    if (G.ended) return;
    G.crashed = true;
    G.pid.crashReason = why;
    G.pid.procs.forEach(p => { if (p.status === 'running' || p.status === 'suspended' || p.status === 'not_responding') p.status = 'killed'; });
    G.player.score = Math.floor(G.player.score / 2);
    FP.ui.toast('系统崩溃：' + why);
    FP.endGame('crash');
  }

  /* ---------------- 进程操作 ---------------- */
  FP.pidAction = function (pid, act) {
    const G = FP.game;
    if (!G || !G.pid) return;
    const p = G.pid.procs.find(x => x.pid === pid);
    if (!p || p.kind === 'system') return;

    if (act === 'suspend' && p.status === 'running') { p.status = 'suspended'; }
    else if (act === 'resume' && p.status === 'suspended') { p.status = 'running'; }
    else if (act === 'promote' && p.priority < 3) { p.priority++; }
    else if (act === 'demote' && p.priority > 1) { p.priority--; }
    else if (act === 'kill') {
      p.status = 'killed';
      if (p.kind === 'anomaly') { G.player.score += 5; G.pid.killedAnomaly++; FP.addFloat(G, 5, 5, '异常进程 +5', '#5fd07a'); }
      else {
        if (p.progress < 100) G.pid.combo = 0;
        const fp = G.flashpoints.find(f => f.pid === p.pid);
        if (fp) fp.pid = null;
      }
    }
    FP.ui.buildPID();
  };

  FP.pidBulk = function (kind) {
    const G = FP.game;
    if (!G || !G.pid) return;
    if (G.pid.bulkCd > G.time) return;
    G.pid.bulkCd = G.time + 1;
    if (kind === 'kill') {
      G.pid.procs.filter(p => p.status === 'not_responding').forEach(p => FP.pidAction(p.pid, 'kill'));
    } else {
      G.pid.procs.filter(p => p.priority === 1 && p.status === 'running').forEach(p => FP.pidAction(p.pid, 'suspend'));
    }
  };

  function freeCell(G) {
    for (let i = 0; i < 100; i++) {
      const x = U.randInt(0, 10), y = U.randInt(0, 10);
      if (G.walls.has(x + ',' + y)) continue;
      if (G.flashpoints.some(f => f.x === x && f.y === y)) continue;
      if (G.pid.anomalies.some(a => a.x === x && a.y === y)) continue;
      return { x, y };
    }
    return null;
  }

  /* 供渲染层使用 */
  FP.PID_MEM_TOTAL = MEM_TOTAL;
})();
