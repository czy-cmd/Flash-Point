/* FLASHPOINT PROTOCOL · ani
 * 动画引擎。缓动函数、时长与错峰节奏移植自 PCL2 的 ModAnimation / MyPageRight / MyButton。
 */
(function () {
  const FP = window.FP;
  const Ani = FP.Ani = {};
  const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);

  /* PCL 缓动族 */
  const ease = Ani.ease = {
    linear: t => clamp01(t),
    /* AniEaseOutFluent：1 - (1-t)^p */
    outFluent: (p = 3) => t => 1 - Math.pow(1 - clamp01(t), p),
    /* AniEaseInFluent：t^p */
    inFluent: (p = 3) => t => Math.pow(clamp01(t), p),
    /* AniEaseOutBack：1 - (1-t)^p * cos(1.5πt)，尾部轻微过冲 */
    outBack: (p = 3) => t => {
      const x = clamp01(t);
      return 1 - Math.pow(1 - x, p) * Math.cos(1.5 * Math.PI * x);
    },
    /* AniEaseInBack */
    inBack: (p = 3) => t => {
      const x = clamp01(t);
      return Math.pow(x, p) * Math.cos(1.5 * Math.PI * (1 - x));
    },
    /* AniEaseInout */
    inout: (a, b, mid = 0.5) => t => {
      const x = clamp01(t);
      if (x < mid) return mid * a(x / mid);
      return (1 - mid) * b((x - mid) / (1 - mid)) + mid;
    }
  };

  /* ---------------- 时间轴 ---------------- */
  const items = [];
  const MAX_DT = 0.05;

  Ani.tween = function (o) {
    if (!o) return null;
    const it = {
      wait: Math.max(0, (o.delay || 0) / 1000),
      dur: Math.max(0.001, (o.dur || 1) / 1000),
      e: o.ease || ease.linear,
      ap: o.apply || null,
      done: o.done || null,
      t: 0,
      alive: true
    };
    items.push(it);
    return it;
  };

  Ani.update = function (dt) {
    if (!items.length) return;
    dt = Math.min(dt, MAX_DT);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (!it.alive) { items.splice(i, 1); continue; }
      let local = dt;
      if (it.wait > 0) {
        if (it.wait >= local) { it.wait -= local; continue; }
        local -= it.wait;
        it.wait = 0;
      }
      it.t = Math.min(it.dur, it.t + local);
      const p = it.t / it.dur;
      try { if (it.ap) it.ap(it.e(p), p); } catch (e) { it.alive = false; }
      if (it.t >= it.dur) {
        it.alive = false;
        try { if (it.done) it.done(); } catch (e) {}
      }
    }
  };

  Ani.clear = function (el) {
    if (!el) return;
    el.style.opacity = '';
    el.style.transform = '';
    el.style.willChange = '';
  };

  /* 清掉整棵子树的动画残留（切换页面时防止上一次动画卡在中途） */
  Ani.clearDeep = function (el) {
    if (!el) return;
    Ani.clear(el);
    const all = el.querySelectorAll('*');
    for (let i = 0; i < all.length; i++) {
      if (all[i].style && (all[i].style.opacity || all[i].style.transform)) Ani.clear(all[i]);
    }
  };

  const kidsOf = el => Array.prototype.filter.call(el.children, c => c.nodeType === 1 && !c.classList.contains('no-ani'));

  /* ---------------- 页面入场（PCL MyPageRight 逐元素） ---------------- */
  Ani.pageIn = function (root, opts) {
    if (!root) return;
    opts = opts || {};
    const off = FP.state && FP.state.settings && FP.state.settings.anim === false;
    const kids = kidsOf(root);
    if (off) { kids.forEach(Ani.clear); Ani.clear(root); return; }

    /* 整体：0.985 → 1，400ms outBack(2)，同步淡入 100ms */
    if (opts.scale !== false) {
      root.style.transformOrigin = '50% 40%';
      Ani.tween({
        dur: 400, ease: ease.outBack(2),
        apply: v => { root.style.transform = 'scale(' + (0.985 + 0.015 * v) + ')'; },
        done: () => { root.style.transform = ''; }
      });
    }
    root.style.opacity = '0';
    Ani.tween({ dur: opts.scale === false ? 180 : 100, ease: ease.outFluent(2), apply: v => { root.style.opacity = v; }, done: () => { root.style.opacity = ''; } });

    kids.forEach((el, i) => {
      const delay = Math.min(i * 32, 280);
      el.style.opacity = '0';
      el.style.transform = 'translateY(-14px)';
      el.style.willChange = 'transform, opacity';
      /* 透明度：100ms */
      Ani.tween({ dur: 100, delay, ease: ease.outFluent(2), apply: v => { el.style.opacity = v; } });
      /* 位移：-14 → -11，250ms outFluent(3) */
      Ani.tween({
        dur: 250, delay, ease: ease.outFluent(3),
        apply: v => { el.style.transform = 'translateY(' + (-14 + 3 * v) + 'px)'; }
      });
      /* 落定：-11 → 0，350ms outBack(3) 轻微回弹 */
      Ani.tween({
        dur: 350, delay: delay + 250, ease: ease.outBack(3),
        apply: v => { el.style.transform = 'translateY(' + (-11 + 11 * v) + 'px)'; },
        done: () => { el.style.transform = ''; el.style.willChange = ''; }
      });
    });
  };

  /* ---------------- 页面退场 ---------------- */
  Ani.pageOut = function (root, done) {
    if (!root) { if (done) done(); return; }
    const off = FP.state && FP.state.settings && FP.state.settings.anim === false;
    if (off) { kidsOf(root).forEach(Ani.clear); if (done) done(); return; }
    const kids = kidsOf(root);
    let last = 0;
    kids.forEach((el, i) => {
      const delay = Math.min(i * 16, 110);
      last = Math.max(last, delay);
      Ani.tween({
        dur: 90, delay, ease: ease.inFluent(2),
        apply: v => { el.style.opacity = String(1 - v); el.style.transform = 'translateY(' + (-7 * v) + 'px)'; },
        done: () => Ani.clear(el)
      });
    });
    setTimeout(done || (() => {}), last + 95);
  };

  /* ---------------- 按钮按下（PCL MyButton） ---------------- */
  Ani.press = function (el) {
    if (!el || (FP.state && FP.state.settings && FP.state.settings.anim === false)) return;
    const tok = (el._aniTok = (el._aniTok || 0) + 1);
    el.style.willChange = 'transform';
    /* 80ms 压到 0.955（ExtraStrong = 5） */
    Ani.tween({
      dur: 80, ease: ease.outFluent(5),
      apply: v => { if (el._aniTok === tok) el.style.transform = 'scale(' + (1 - 0.045 * v) + ')'; }
    });
    /* 700ms 弹回，outBack(2) 带一丝过冲 */
    Ani.tween({
      dur: 700, delay: 80, ease: ease.outBack(2),
      apply: v => {
        if (el._aniTok !== tok) return;
        const s = 0.955 + 0.045 * v;
        el.style.transform = 'scale(' + s + ')';
      },
      done: () => {
        if (el._aniTok !== tok) return;
        el.style.transform = '';
        el.style.willChange = '';
      }
    });
  };

  /* ---------------- 弹窗（PCL MyMsgInput） ---------------- */
  Ani.modalIn = function (box) {
    if (!box) return;
    box._aniTok = (box._aniTok || 0) + 1;
    const tok = box._aniTok;
    box.style.opacity = '0';
    box.style.transform = 'translateY(-14px)';
    Ani.tween({ dur: 120, delay: 60, ease: ease.outFluent(2), apply: v => { if (box._aniTok === tok) box.style.opacity = v; } });
    Ani.tween({
      dur: 300, delay: 60, ease: ease.outBack(2),
      apply: v => { if (box._aniTok === tok) box.style.transform = 'translateY(' + (-14 + 14 * v) + 'px)'; },
      done: () => {
        if (box._aniTok !== tok) return;
        box.style.transform = '';
        box.style.opacity = '';
      }
    });
  };

  Ani.modalOut = function (box, done) {
    if (!box) { if (done) done(); return; }
    box._aniTok = (box._aniTok || 0) + 1;
    const tok = box._aniTok;
    Ani.tween({
      dur: 80, delay: 20, ease: ease.inFluent(2),
      apply: v => {
        if (box._aniTok !== tok) return;
        box.style.opacity = String(1 - v);
        box.style.transform = 'translateY(' + (14 * v) + 'px)';
      },
      done: () => {
        if (box._aniTok !== tok) return;
        box.style.opacity = '';
        box.style.transform = '';
        if (done) done();
      }
    });
  };

  /* ---------------- 提示条 ---------------- */
  Ani.toastIn = function (el) {
    if (!el) return;
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    Ani.tween({
      dur: 240, ease: ease.outBack(3),
      apply: v => {
        el.style.opacity = String(Math.min(1, v * 1.7));
        el.style.transform = 'translateY(' + (12 * (1 - v)) + 'px)';
      },
      done: () => { el.style.transform = ''; el.style.opacity = ''; }
    });
  };

  Ani.toastOut = function (el, done) {
    if (!el) { if (done) done(); return; }
    Ani.tween({
      dur: 160, ease: ease.inFluent(2),
      apply: v => { el.style.opacity = String(1 - v); },
      done: () => { if (done) done(); }
    });
  };

  /* ---------------- 浮动数字（PCL 式上浮淡出） ---------------- */
  Ani.floatUp = function (el, dist, dur) {
    if (!el) return;
    el.style.opacity = '0';
    Ani.tween({
      dur: 120, ease: ease.outFluent(2), apply: v => { el.style.opacity = v; }
    });
    Ani.tween({
      dur: dur || 700, ease: ease.outFluent(2),
      apply: v => { el.style.transform = 'translateY(' + (-(dist || 26) * v) + 'px)'; },
      done: () => { el.style.transform = ''; }
    });
    Ani.tween({ dur: 220, delay: (dur || 700) - 220, ease: ease.inFluent(2), apply: v => { el.style.opacity = String(1 - v); } });
  };
})();
