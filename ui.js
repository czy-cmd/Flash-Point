/* FLASHPOINT PROTOCOL · ui
 * 界面、菜单、插件设置、弹窗、HUD、结算
 */
(function () {
  const U = FP.util, S = FP.state;
  const $ = id => document.getElementById(id);
  const UI = FP.ui = {};

  const SCREENS = ['loading', 'menu', 'modes', 'plugins', 'settings', 'changelog', 'selfcheck', 'game', 'result'];

  let screenToken = 0;

  function showInstant(name) {
    SCREENS.forEach(k => {
      const el = $('screen-' + k);
      if (!el) return;
      el.classList.toggle('active', k === name);
      if (k !== name) FP.Ani.clear(el);
    });
    const target = $('screen-' + name);
    if (target) FP.Ani.clearDeep(target);
  }

  FP.showScreen = function (name) {
    const target = $('screen-' + name);
    if (!target) return;
    const token = ++screenToken;
    S.screen = name;
    if (name === 'game') {
      FP.initCanvas();
      const isPid = S.mode === 'pid';
      $('pid-panel').classList.toggle('show', isPid);
      $('btn-short').style.display = isPid ? 'none' : '';
      $('slots').style.display = isPid ? 'none' : '';
      document.querySelectorAll('.pid-only').forEach(e => e.classList.toggle('show', isPid));
      $('badge-dev').classList.toggle('show', S.dev);
      $('badge-src').classList.toggle('show', S.src);
      $('badge-deg').classList.toggle('show', S.degraded);
    }
    if (name === 'menu' || name === 'modes') updateMenuMeta();
    if (name === 'settings') renderSettings();
    if (name !== 'game') {
      const pm = $('pause-mask');
      if (pm) pm.classList.remove('active', 'closing');
      if (FP.game) FP.game.paused = false;
    }
    window.scrollTo(0, 0);

    const old = SCREENS.map(k => $('screen-' + k))
      .filter(el => el && el !== target && el.classList.contains('active'));
    const anim = S.settings.anim !== false && name !== 'loading';
    if (!anim || !old.length) {
      showInstant(name);
      if (anim) FP.Ani.pageIn(target, { scale: name !== 'game' });
      return;
    }
    FP.Ani.pageOut(old[0], () => {
      if (token !== screenToken) return;
      showInstant(name);
      FP.Ani.pageIn(target, { scale: name !== 'game' });
    });
  };

  /* ---------------- toast / modal ---------------- */
  UI.toast = function (msg) {
    const t = FP.el('div', 'toast', msg);
    $('toasts').appendChild(t);
    FP.Ani.toastIn(t);
    setTimeout(() => FP.Ani.toastOut(t, () => t.remove()), 1650);
  };

  function closeModal() {
    const root = $('modal-root');
    if (!root || !root.classList.contains('active')) return;
    const box = $('modal-box');
    root.classList.add('closing');
    FP.Ani.modalOut(box, () => root.classList.remove('active', 'closing'));
  }
  UI.closeModal = closeModal;

  function openModal(html, setup) {
    const root = $('modal-root');
    const box = $('modal-box');
    root.classList.remove('closing');
    box.innerHTML = html;
    root.classList.add('active');
    root.onclick = e => { if (e.target.id === 'modal-root') closeModal(); };
    if (setup) setup(box);
    FP.Ani.modalIn(box);
  }

  UI.confirm = function (title, msg, okText, onOk, danger) {
    openModal(
      `<h3>${title}</h3><p>${msg}</p>
       <div class="modal-actions">
         <button class="btn ghost" data-a="no">取消</button>
         <button class="btn ${danger ? 'danger' : 'primary'}" data-a="yes">${okText || '确定'}</button>
       </div>`, box => {
        box.querySelector('[data-a="no"]').onclick = closeModal;
        box.querySelector('[data-a="yes"]').onclick = () => { closeModal(); onOk && onOk(); };
      });
  };

  UI.prompt = function (title, placeholder, onOk) {
    openModal(
      `<h3>${title}</h3>
       <input type="password" id="pw-input" placeholder="${placeholder || ''}" autocomplete="off" />
       <div class="modal-actions">
         <button class="btn ghost" data-a="no">取消</button>
         <button class="btn primary" data-a="yes">确定</button>
       </div>`, box => {
        const input = box.querySelector('#pw-input');
        setTimeout(() => input.focus(), 60);
        const submit = () => { const v = input.value; closeModal(); onOk(v); };
        box.querySelector('[data-a="no"]').onclick = closeModal;
        box.querySelector('[data-a="yes"]').onclick = submit;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      });
  };

  /* ---------------- 主菜单 ---------------- */
  function updateMenuMeta() {
    const hs = Math.max(0, ...Object.values(S.highscores || { 0: 0 }));
    $('menu-hs').textContent = hs || 0;
    $('menu-ext').textContent = FP.activePlugins().length + ' / 5';
  }
  UI.menuMeta = updateMenuMeta;

  /* ---------------- 主题 ---------------- */
  const THEMES = ['dark', 'light', 'cool'];
  function applyTheme() {
    const t = THEMES.indexOf(S.settings.theme) >= 0 ? S.settings.theme : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#eef3f9' : t === 'cool' ? '#050812' : '#070c14');
  }
  FP.applyTheme = applyTheme;

  /* ---------------- 暂停 ---------------- */
  UI.pause = function (on) {
    const G = FP.game;
    if (!G) return;
    const mask = $('pause-mask');
    if (!mask) return;
    if (on) {
      if (G.paused) return;
      if (G.phase !== 'playing' && G.phase !== 'countdown') return;
      G.paused = true;
      $('pause-time').textContent = Math.ceil(Math.max(0, G.timeLeft || 0)) + 's';
      mask.classList.remove('closing');
      mask.classList.add('active');
      FP.Ani.modalIn(mask.querySelector('.modal'));
      FP.log('paused');
    } else {
      if (!G.paused) return;
      G.paused = false;
      mask.classList.add('closing');
      FP.Ani.modalOut(mask.querySelector('.modal'), () => mask.classList.remove('active', 'closing'));
      FP.log('resumed');
    }
  };

  /* ---------------- 开发者模式 ---------------- */
  function setDev(on) {
    S.dev = !!on;
    if (!on) S.src = false;
    const bd = $('badge-dev'), bs = $('badge-src');
    if (bd) bd.classList.toggle('show', S.dev);
    if (bs) bs.classList.toggle('show', S.src);
  }
  FP.setDev = setDev;

  /* 预热：加载页里先把模式卡片与插件列表构建好，进场不卡 */
  UI.prewarm = function () {
    try { renderModes(); } catch (e) {}
    try { renderPluginBody(); } catch (e) {}
    try { renderSelfcheck(); } catch (e) {}
  };

  /* ---------------- 模式 ---------------- */
  function renderModes() {
    const grid = $('mode-grid');
    grid.innerHTML = '';
    FP.MODES.forEach((m, i) => {
      const ok = !!S.sysPlugins[m.plugin];
      const card = FP.el('button', 'mode-card' + (ok ? '' : ' locked'));
      card.innerHTML = `
        <div class="mc-top"><span class="mc-idx">0${i + 1}</span><span class="mc-name">${m.name}</span></div>
        <div class="mc-desc">${m.desc}</div>
        <div class="mc-meta"><span>AI ${m.ai}</span><span>${m.dur}s</span><span>${m.plugin}</span></div>
        ${ok ? '' : `<div class="mc-lock">需要插件：${m.plugin}</div>`}`;
      if (ok) card.onclick = () => startMode(m.id);
      grid.appendChild(card);
    });
  }

  function startMode(id) {
    if (S.mode === 'pid' || id === 'pid') { /* noop */ }
    FP.startGame(id);
  }

  /* ---------------- 插件页 ---------------- */
  let pluginTab = 'sys';

  function switchTab(tab) {
    pluginTab = tab;
    document.querySelectorAll('#plugin-tabs .tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    renderPluginBody();
  }
  UI.switchTab = switchTab;

  function renderPluginBody() {
    const body = $('plugin-body');    $('plugin-counter').style.display = pluginTab === 'ext' || pluginTab === 'custom' ? '' : 'none';
    $('plugin-counter').textContent = '已选 ' + FP.activePlugins().length + ' / 5';
    if (pluginTab === 'sys') renderSys(body);
    else if (pluginTab === 'ext') renderExt(body);
    else if (pluginTab === 'custom') renderCustom(body);
    else renderWrite(body);
  }

  function switchEl(on, onToggle, dev) {
    const b = FP.el('button', 'switch' + (on ? ' on' : ''));
    b.onclick = () => { onToggle(); };
    return b;
  }

  function renderSys(body) {
    body.innerHTML = '';
    const groups = [
      { title: '核心层（开发者模式可关闭）', list: FP.SYS.core, locked: true },
      { title: '用户层', list: FP.SYS.use },
      { title: '模式核心', list: FP.SYS.mode },
      { title: '功能拓展', list: FP.SYS.develope },
      { title: '独立插件', list: [{ id: 'internet', name: 'Internet', locked: true }], locked: true }
    ];

    groups.forEach(g => {
      const box = FP.el('div', 'sys-group');
      const h = FP.el('h4', null, g.title);
      box.appendChild(h);
      g.list.forEach(p => {
        const row = FP.el('div', 'sys-row');
        row.appendChild(FP.el('span', 'pid', p.id));
        row.appendChild(FP.el('span', 'nm', p.name));
        const on = !!S.sysPlugins[p.id];
        const isCore = p.id.startsWith('core-') || p.id === 'internet';
        if (isCore && !S.dev) {
          const tag = FP.el('span', 'tag lock', '已启用 · 锁');
          row.appendChild(tag);
        } else {
          if (isCore) {
            const dev = FP.el('span', 'tag dev', 'DEV');
            row.appendChild(dev);
          }
          row.appendChild(switchEl(on, () => toggleSys(p)));
        }
        box.appendChild(row);

        if (p.id === 'core-time' && S.sysPlugins['DEVELOPE-time_up']) {
          const warn = FP.el('div', 'small-note');
          warn.style.cssText = 'border-left:2px solid #E57373;padding:6px 10px;margin:4px 0 6px 6px;line-height:1.9;color:#ffb3b3';
          warn.innerHTML = `⚠ 被修改<br>来源：DEVELOPE-time_up（system 插件）→ 120 秒
            <button class="btn tiny" id="close-timeup" style="margin-left:8px">关闭</button><br>
            当前值：120 秒（默认 60 秒）`;
          box.appendChild(warn);
          warn.querySelector('#close-timeup').onclick = () => {
            S.sysPlugins['DEVELOPE-time_up'] = false;
            FP.savePlugins(); renderPluginBody();
            UI.toast('已关闭时间扩展，恢复 60 秒');
          };
        }
      });
      body.appendChild(box);
    });
  }

  function toggleSys(p) {
    const isCore = p.id.startsWith('core-') || p.id === 'internet';
    const turnOff = S.sysPlugins[p.id];
    if (isCore && turnOff) {
      if (p.id === 'core-state') {
        openModal(`<h3>关闭 ${p.id}</h3>
          <p>状态内核负责错误捕获与崩溃遮罩。关闭后异常将直接白屏。</p>
          <div class="modal-actions">
            <button class="btn ghost" data-a="cancel">取消</button>
            <button class="btn" data-a="deg">尝试降级运行</button>
            <button class="btn danger" data-a="crash">直接关闭</button>
          </div>`, box => {
          box.querySelector('[data-a="cancel"]').onclick = closeModal;
          box.querySelector('[data-a="deg"]').onclick = () => {
            closeModal(); S.sysPlugins[p.id] = false; S.degraded = true;
            FP.savePlugins(); renderPluginBody(); UI.toast('DEGRADED · 成绩不计入最高分');
          };
          box.querySelector('[data-a="crash"]').onclick = () => { closeModal(); simulateCrash(p.id); };
        });
        return;
      }
      openModal(`<h3>关闭 ${p.id}</h3><p>关闭核心层可能导致游戏无法运行。</p>
        <div class="modal-actions">
          <button class="btn ghost" data-a="cancel">取消</button>
          <button class="btn" data-a="deg">尝试降级运行</button>
          <button class="btn danger" data-a="crash">直接关闭</button>
        </div>`, box => {
        box.querySelector('[data-a="cancel"]').onclick = closeModal;
        box.querySelector('[data-a="deg"]').onclick = () => {
          closeModal(); S.sysPlugins[p.id] = false; S.degraded = true;
          FP.savePlugins(); renderPluginBody(); UI.toast('DEGRADED · 成绩不计入最高分');
        };
        box.querySelector('[data-a="crash"]').onclick = () => { closeModal(); simulateCrash(p.id); };
      });
      return;
    }
    S.sysPlugins[p.id] = !S.sysPlugins[p.id];
    if (p.id === 'use-basic_system' && !S.sysPlugins[p.id]) {
      S.sysPlugins[p.id] = true;
      UI.toast('基础系统不可关闭');
      return;
    }
    FP.savePlugins();
    renderPluginBody();
  }

  function simulateCrash(id) {
    openModal(`<h3>游戏崩溃</h3><p>已关闭 ${id}，运行环境失去必需内核。</p>
      <div class="modal-actions">
        <button class="btn" data-a="re">重新启用</button>
        <button class="btn ghost" data-a="rf">刷新页面</button>
      </div>`, box => {
      box.querySelector('[data-a="re"]').onclick = () => { closeModal(); S.sysPlugins[id] = true; FP.savePlugins(); renderPluginBody(); };
      box.querySelector('[data-a="rf"]').onclick = () => location.reload();
    });
  }

  function flagHtml(f) {
    const keys = [['map', 'map change'], ['skill', 'skill change'], ['rule', 'rule change'],
      ['event', 'event change'], ['opp', 'opponent change'], ['game', 'gameplay change']];
    let html = '<div class="flags">';
    keys.forEach(([k, label]) => {
      html += `<span class="${f[k] ? 't' : ''}" title="${label}">${k} ${f[k] ? '✓' : '✗'}</span>`;
    });
    html += '<span class="sys" title="system change">system 🔒</span></div>';
    return html;
  }

  function renderExt(body) {
    body.innerHTML = '';
    const bar = FP.el('div', 'ext-toolbar');
    bar.innerHTML = `<button class="btn small" id="import-plugins">导入插件</button>
      <span class="small-note">支持 .json / .js（JSON 格式）。一局最多 5 个外置插件。</span>`;
    body.appendChild(bar);
    bar.querySelector('#import-plugins').onclick = importPlugins;

    const grid = FP.el('div', 'ext-grid');
    const all = FP.QX.concat(S.custom.map(c => ({
      id: c.id, name: c.name + '（自定义）', desc: c.desc, f: { rule: 1 }, custom: true
    })));

    all.forEach(p => {
      const on = S.external.includes(p.id) || S.custom.some(c => c.id === p.id && c.enabled);
      const full = FP.activePlugins().length >= 5;
      const card = FP.el('div', 'ext-card' + (on ? ' on' : '') + (!on && full ? ' disabled' : ''));
      card.innerHTML = `
        <div class="ec-title"><b>${p.name}</b><span class="ec-id">${p.id}</span></div>
        <div class="ec-desc">${p.desc}</div>
        ${flagHtml(p.f)}`;
      card.onclick = () => {
        if (!on && full) { UI.toast('已达上限（5 个）'); return; }
        toggleExt(p.id, on);
      };
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  function toggleExt(id, on) {
    if (S.custom.some(c => c.id === id)) {
      const c = S.custom.find(x => x.id === id);
      c.enabled = !on;
      FP.saveCustom();
    } else {
      if (on) S.external = S.external.filter(x => x !== id);
      else S.external.push(id);
    }
    FP.savePlugins();
    renderPluginBody();
    updateMenuMeta();
  }

  function importPlugins() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.js';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          let raw = r.result;
          raw = raw.replace(/^\s*(window\.__PLUGIN_EXPORT__\s*=\s*)/, '').replace(/;\s*$/, '');
          const obj = JSON.parse(raw);
          if (!obj.id || !/^qx-/.test(obj.id)) throw new Error('插件 ID 必须以 qx- 开头');
          S.custom.push({ id: obj.id, name: obj.name || obj.id, desc: obj.desc || '', params: obj.params || {}, enabled: false });
          FP.saveCustom();
          UI.toast('已导入 ' + obj.id);
          renderPluginBody();
        } catch (e) {
          UI.toast('导入失败：' + e.message);
        }
      };
      r.readAsText(f);
    };
    input.click();
  }

  function renderCustom(body) {
    body.innerHTML = '';
    const box = FP.el('div', 'panel');
    box.innerHTML = `
      <div class="form-row"><label>插件名称</label><input id="cu-name" placeholder="我的规则" maxlength="12" /></div>
      <div class="form-row"><label>同时闪点数</label><input id="cu-count" type="number" value="3" min="2" max="8" /></div>
      <div class="form-row"><label>读条时间（秒）</label><input id="cu-read" type="number" value="2" min="0.5" max="6" step="0.5" /></div>
      <div class="form-row"><label>得分倍率</label><input id="cu-mult" type="number" value="1" min="0.5" max="4" step="0.5" /></div>
      <div class="form-row"><button class="btn primary" id="cu-save">生成 qx-custom 插件</button></div>`;
    body.appendChild(box);
    box.querySelector('#cu-save').onclick = () => {
      const name = box.querySelector('#cu-name').value.trim() || '自定义规则';
      const params = {
        count: +box.querySelector('#cu-count').value,
        read: +box.querySelector('#cu-read').value,
        mult: +box.querySelector('#cu-mult').value
      };
      const id = 'qx-custom-' + Date.now().toString(36).slice(-4);
      S.custom.push({ id, name, desc: `闪点 ${params.count} · 读条 ${params.read}s · 得分 ×${params.mult}`, params, enabled: false });
      FP.saveCustom();
      UI.toast('已生成 ' + id);
      renderPluginBody();
    };

    if (S.custom.length) {
      const list = FP.el('div', 'ext-grid');
      list.style.marginTop = '14px';
      S.custom.forEach(c => {
        const card = FP.el('div', 'ext-card' + (c.enabled ? ' on' : ''));
        card.innerHTML = `<div class="ec-title"><b>${c.name}</b><span class="ec-id">${c.id}</span></div>
          <div class="ec-desc">${c.desc}</div>
          <div class="flags"><span class="t">rule change : true</span><span class="sys">system change : false 🔒</span></div>`;
        card.onclick = () => toggleExt(c.id, c.enabled);
        list.appendChild(card);
      });
      body.appendChild(list);
    }
  }

  function renderWrite(body) {
    body.innerHTML = '';
    const tpl = `window.__PLUGIN_EXPORT__ = {
  id: "qx-myplugin",
  name: "我的插件",
  desc: "一句话说明这个插件改了什么",
  flags: { map: false, skill: false, rule: false, event: false, opponent: false, gameplay: false },
  system: false,
  hooks: {
    onInit(state) {},
    onTick(state, dt) {},
    onScore(score) { return score; }
  }
};
/using by system
/token & (this is a password)`;
    const wrap = FP.el('div', 'panel');
    wrap.innerHTML = `
      <p class="small-note" style="line-height:1.8">插件只能通过钩子介入游戏，不允许直接改全局变量。<br>
      <code>system change</code> 需要 ID 命中 16 个系统白名单，且文件末两行包含 token。</p>
      <textarea class="editor" id="wr-code" spellcheck="false"></textarea>
      <div class="ext-toolbar" style="margin-top:10px">
        <button class="btn small" id="wr-check">校验</button>
        <button class="btn small" id="wr-save">保存为外置插件</button>
        <span class="small-note" id="wr-status">状态：未校验</span>
      </div>`;
    body.appendChild(wrap);
    const ta = wrap.querySelector('#wr-code');
    ta.value = tpl;
    const status = wrap.querySelector('#wr-status');

    wrap.querySelector('#wr-check').onclick = () => {
      const r = validate(ta.value);
      status.textContent = '状态：' + (r.ok ? '校验通过（' + r.id + '，system ' + (r.system ? 'true' : 'false') + '）' : '校验失败 · ' + r.msg);
    };
    wrap.querySelector('#wr-save').onclick = () => {
      const r = validate(ta.value);
      if (!r.ok) { status.textContent = '状态：校验失败 · ' + r.msg; return; }
      S.custom.push({ id: r.id, name: r.name, desc: r.desc, code: ta.value, enabled: false });
      FP.saveCustom();
      status.textContent = '状态：已保存为 ' + r.id;
      UI.toast('已保存 ' + r.id);
      updateMenuMeta();
    };
  }

  function validate(code) {
    let obj;
    try {
      let raw = code.replace(/^\s*window\.__PLUGIN_EXPORT__\s*=\s*/, '').replace(/;\s*$/, '');
      obj = JSON.parse(raw);
    } catch (e) {
      try {
        obj = (new Function('return (' + code.replace(/\/using by system[\s\S]*$/, '') + ')'))();
      } catch (e2) { return { ok: false, msg: '不是合法对象' }; }
    }
    if (!obj || !obj.id) return { ok: false, msg: '缺少 id' };
    if (!/^qx-/.test(obj.id)) return { ok: false, msg: 'id 必须以 qx- 开头' };
    const hasToken = /\/using by system/.test(code) && /\/token & \(this is a password\)/.test(code);
    const inWhite = FP.SYSTEM_WHITELIST.includes(obj.id);
    const system = !!(obj.system && inWhite && hasToken);
    if (obj.system && !system) {
      return { ok: true, id: obj.id, name: obj.name || obj.id, desc: obj.desc || '', system: false };
    }
    return { ok: true, id: obj.id, name: obj.name || obj.id, desc: obj.desc || '', system };
  }

  /* ---------------- 设置 ---------------- */
  function renderSettings() {
    $('set-sound').className = 'switch' + (S.settings.sound ? ' on' : '');
    $('set-anim').className = 'switch' + (S.settings.anim ? ' on' : '');
    $('set-diff').value = S.settings.difficulty;
    $('set-duration').textContent = (S.sysPlugins['DEVELOPE-time_up'] ? 120 : 60) + ' 秒';
    $('set-sound').onclick = () => { S.settings.sound = !S.settings.sound; FP.saveSettings(); renderSettings(); };
    $('set-anim').onclick = () => { S.settings.anim = !S.settings.anim; FP.saveSettings(); renderSettings(); };
    $('set-diff').onchange = e => { S.settings.difficulty = e.target.value; FP.saveSettings(); };

    /* 主题：深色 / 浅色 / 冷色 */
    const themeWrap = $('set-theme');
    if (themeWrap) {
      themeWrap.querySelectorAll('button').forEach(b => {
        b.classList.toggle('on', (S.settings.theme || 'dark') === b.dataset.theme);
        b.onclick = () => {
          S.settings.theme = b.dataset.theme;
          FP.applyTheme();
          FP.saveSettings();
          renderSettings();
        };
      });
    }

    /* 开发者模式开关 */
    const devSw = $('set-dev');
    if (devSw) {
      devSw.className = 'switch' + (S.dev ? ' on' : '');
      devSw.onclick = () => {
        if (S.dev) { setDev(false); UI.toast('开发者模式已关闭'); renderSettings(); return; }
        UI.prompt('输入管理员密码', '请输入密码', v => {
          if (FP.checkDev(v)) { setDev(true); UI.toast('开发者模式已开启'); renderSettings(); }
          else UI.toast('密码错误');
        });
      };
    }

    /* 重新加载：重新打开本页 */
    const rl = $('set-reload');
    if (rl) rl.onclick = () => { if (S.screen !== 'loading') location.reload(); };
    $('set-clear-hs').onclick = () => UI.confirm('清除最高分', '确定清空本地全部最高分记录？', '清除', () => {
      S.highscores = {}; FP.saveHighscores(); updateMenuMeta(); UI.toast('最高分已清空');
    }, true);
    $('set-clear-all').onclick = () => UI.confirm('清除存档', '确定清空设置、插件选择、自定义插件与最高分？', '清除', () => {
      ['fp_settings', 'fp_progress', 'fp_highscores', 'fp_plugins_enabled', 'fp_plugins_custom', 'fp_daily'].forEach(k => FP.LS.del(k));
      location.reload();
    }, true);
  }

  /* ---------------- 自检 ---------------- */
  function renderSelfcheck() {
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail == null ? '' : String(detail) });
    const count = (obj) => Object.keys(obj || {}).length;

    /* 数据表 */
    const modN = count(FP.MODULES), lvN = count(FP.LEVELS);
    add('module table', modN >= 6, modN + ' modules');
    add('level table', lvN === 5, lvN + ' levels');
    add('external plugin defs', (FP.QX || []).length === 50, (FP.QX || []).length + ' defs');
    add('mode table', (FP.MODES || []).length >= 6, (FP.MODES || []).length + ' modes');
    const sysN = FP.SYS.core.length + FP.SYS.use.length + FP.SYS.mode.length + FP.SYS.develope.length + 1;
    add('system registry', sysN >= 20, sysN + ' entries');

    /* 内核 */
    add('animation engine', typeof FP.Ani === 'object' && typeof FP.Ani.update === 'function' && typeof FP.Ani.ease.outBack === 'function',
      FP.Ani ? 'loaded' : 'missing');
    add('loader', typeof FP.Loader === 'object' && typeof FP.Loader.run === 'function', FP.Loader ? 'loaded' : 'missing');
    add('game core', typeof FP.update === 'function' && typeof FP.startGame === 'function' && typeof FP.render === 'function',
      'update / startGame / render');
    add('pid module', typeof FP.updatePID === 'function', 'updatePID');
    add('path finder', typeof FP.bfs === 'function', 'bfs');

    /* 运行环境 */
    let ctxOk = false;
    try { ctxOk = !!document.createElement('canvas').getContext('2d'); } catch (e) {}
    add('canvas 2d', ctxOk, ctxOk ? 'ok' : 'unavailable');
    add('requestAnimationFrame', !!window.requestAnimationFrame, 'ok');
    let lsOk = false;
    try { localStorage.setItem('fp_selfcheck', '1'); localStorage.removeItem('fp_selfcheck'); lsOk = true; } catch (e) {}
    add('localStorage', lsOk, lsOk ? 'read / write' : 'blocked');
    add('audio bus', !!(window.AudioContext || window.webkitAudioContext), 'AudioContext');

    /* 设置 */
    add('theme set', ['dark', 'light', 'cool'].indexOf(S.settings.theme || 'dark') >= 0, S.settings.theme || 'dark');
    add('plugin limit', FP.activePlugins().length <= 5, FP.activePlugins().length + ' / 5');
    add('password hash', FP.hash('probe') !== FP.hash('probe2'), 'fnv-1a');

    const failed = checks.filter(c => !c.ok);
    const lines = [];
    lines.push('FLASHPOINT PROTOCOL · SELF CHECK');
    lines.push('time       : ' + new Date().toLocaleString());
    lines.push('version    : v1.2');
    lines.push('screen     : ' + S.screen + '   dev: ' + (S.dev ? 'on' : 'off'));
    lines.push('');
    lines.push('[checks]');
    checks.forEach(c => {
      lines.push('  ' + (c.ok ? 'ok  ' : 'FAIL') + '  ' + pad(c.name, 22) + c.detail);
    });
    lines.push('');
    lines.push('[plugins]');
    lines.push('  core      ' + FP.SYS.core.filter(c => S.sysPlugins[c.id]).length + ' / ' + FP.SYS.core.length + ' active');
    lines.push('  user      ' + FP.SYS.use.filter(c => S.sysPlugins[c.id]).length + ' / ' + FP.SYS.use.length + ' active');
    lines.push('  mode      ' + FP.SYS.mode.filter(c => S.sysPlugins[c.id]).length + ' / ' + FP.SYS.mode.length + ' active');
    lines.push('  external  ' + FP.activePlugins().length + ' / 5 selected');
    lines.push('');
    lines.push('[storage]');
    ['fp_settings', 'fp_highscores', 'fp_plugins_enabled', 'fp_plugins_custom'].forEach(k => {
      let st = 'empty';
      try { st = localStorage.getItem(k) ? 'present' : 'empty'; } catch (e) { st = 'blocked'; }
      lines.push('  ' + pad(k, 20) + st);
    });
    lines.push('');
    lines.push('result: ' + (failed.length ? 'FAIL · ' + failed.length + ' check(s)' : 'PASS · ' + checks.length + ' checks, 0 failed'));
    const out = $('selfcheck-out');
    out.textContent = lines.join('\n');
    out.style.color = failed.length ? 'var(--red)' : '';
    return { pass: failed.length === 0, checks: checks.length, failed: failed.map(f => f.name) };
  }
  FP.selfcheck = renderSelfcheck;

  function pad(s, n) { while (s.length < n) s += ' '; return s; }

  /* ---------------- HUD ---------------- */
  let hudAcc = 0;

  UI.renderHUDStatic = function (G) {
    const q = G.mode === 'qwq';
    const set = (id, txt) => { const e = $(id); if (e) e.textContent = q ? UI.g(txt) : txt; };
    document.querySelectorAll('.hud-item .k').forEach(e => { e.textContent = q ? UI.g(e.textContent) : e.dataset.orig || e.textContent; });
    $('btn-short').style.display = G.mode === 'pid' ? 'none' : '';
    const lbl = $('short-label');
    if (lbl) lbl.textContent = q ? UI.g('短路') : '短路';
    const modeEl = $('hud-mode');
    if (modeEl) modeEl.textContent = q ? UI.g(FP.MODE_MAP[G.mode].name) : FP.MODE_MAP[G.mode].name;
    const pl = $('hud-plugins');
    if (pl) pl.textContent = '外置插件 ' + FP.activePlugins().length + ' / 5';
    const quit = $('btn-quit');
    if (quit) quit.textContent = q ? UI.g('结束本局') : '结束本局';
  };

  UI.g = function (t) { return FP.garble(t); };

  UI.hud = function (now) {
    const G = FP.game;
    if (!G || S.screen !== 'game') return;
    hudAcc += 1;
    if (hudAcc % 5 !== 0) return;

    const t = Math.max(0, Math.ceil(G.timeLeft));
    const timeEl = $('hud-time');
    timeEl.textContent = t + 's';
    timeEl.classList.toggle('urgent', t <= 10);

    $('hud-score').textContent = G.player.score;
    $('hud-combo').textContent = '×' + (G.player.combo || 0);
    $('hud-energy').textContent = Math.round(G.player.energy);

    const cdEl = $('short-cd');
    if (G.shortCd > 0) cdEl.textContent = G.shortCd.toFixed(1) + 's';
    else cdEl.textContent = '就绪';

    /* 槽位热量 */
    document.querySelectorAll('.slot[data-mid]').forEach(el => {
      const i = +el.dataset.i;
      const s = G.player.mods[i];
      if (!s) return;
      const bar = el.querySelector('.s-heat i');
      if (bar) bar.style.width = s.heat + '%';
      el.classList.toggle('overheated', !!s.overheatUntil);
    });

    /* PID 面板数值 */
    if (G.mode === 'pid' && G.pid) {
      const cpu = FP.pidCpu(G);
      const mem = FP.pidMem(G);
      const cb = $('pid-cpu-bar');
      cb.style.width = cpu + '%';
      cb.className = cpu >= 100 ? 'max' : cpu >= 80 ? 'hi' : '';
      $('pid-cpu').textContent = cpu + '%';
      const mb = $('pid-mem-bar');
      mb.style.width = (mem / FP.PID_MEM_TOTAL * 100) + '%';
      mb.className = mem >= 8 ? 'max' : mem >= 6 ? 'hi' : '';
      $('pid-mem').textContent = mem + ' / ' + FP.PID_MEM_TOTAL + ' GB';
      $('pid-count').textContent = G.pid.procs.length + ' 进程';
      const hc = $('hud-cpu'), hm = $('hud-mem');
      if (hc) { hc.textContent = cpu + '%'; hc.style.color = cpu >= 100 ? 'var(--red)' : cpu >= 80 ? 'var(--gold)' : ''; }
      if (hm) { hm.textContent = mem + '/8G'; hm.style.color = mem >= 8 ? 'var(--red)' : mem >= 6 ? 'var(--gold)' : ''; }
    }
  };

  UI.countdown = function (text) {
    const el = $('countdown');
    if (!text) { el.classList.remove('show'); el.textContent = ''; return; }
    el.classList.add('show');
    el.textContent = text;
  };

  /* ---------------- 模块槽 ---------------- */
  UI.buildSlots = function () {
    const G = FP.game;
    const wrap = $('slots');
    if (!G || !wrap) return;
    wrap.innerHTML = '';
    const q = G.mode === 'qwq';
    for (let i = 0; i < 3; i++) {
      const s = G.player.mods[i];
      if (!s) {
        wrap.appendChild(FP.el('div', 'slot empty', q ? UI.g('空槽') : '空槽'));
        continue;
      }
      const lv = FP.LEVELS[s.level];
      const mod = FP.MODULES[s.mid];
      const el = FP.el('button', 'slot' + (s.overheatUntil ? ' overheated' : ''));
      el.dataset.i = i;
      el.dataset.mid = s.mid;
      el.innerHTML = `
        <div class="s-top">
          <span style="color:${mod.color}">${q ? UI.g(mod.name) : mod.name}</span>
          <span class="s-lv" style="color:${lv.color}">[${s.level}]</span>
        </div>
        <div class="s-heat"><i style="width:${s.heat}%"></i></div>
        <div class="s-cost">${s.overheatUntil ? '过热中' : '消耗 ' + lv.cost + ' 能量'} · 热量 ${s.heat}/100</div>`;
      el.onclick = () => FP.useModule(i);
      wrap.appendChild(el);
    }
  };

  /* ---------------- PID 面板 ---------------- */
  UI.buildPID = function () {
    const G = FP.game;
    if (!G || !G.pid) return;
    const list = $('pid-list');
    if (!list) return;
    const rows = G.pid.procs.slice().sort((a, b) => {
      const rank = s => s === 'not_responding' ? 0 : s === 'running' ? 1 : s === 'suspended' ? 2 : s === 'system' ? 3 : 4;
      return rank(a.status) - rank(b.status) || a.pid.localeCompare(b.pid);
    });
    list.innerHTML = rows.map(p => {
      const st = { running: '运行中', suspended: '已挂起', not_responding: '无响应', completed: '已完成', killed: '已结束', system: '系统' }[p.status] || p.status;
      const cpu = Math.round(p.cpu);
      const prog = p.kind === 'gold' ? Math.min(100, p.progress) : Math.min(100, p.progress || 0);
      const ops = [];
      if (p.kind !== 'system' && p.status !== 'killed' && p.status !== 'completed') {
        if (p.status === 'running') ops.push(`<button data-pid="${p.pid}" data-act="suspend">挂起</button>`);
        if (p.status === 'suspended') ops.push(`<button data-pid="${p.pid}" data-act="resume">恢复</button>`);
        ops.push(`<button data-pid="${p.pid}" data-act="kill">结束</button>`);
        if (p.status !== 'not_responding') {
          ops.push(`<button data-pid="${p.pid}" data-act="promote">提权</button>`);
          ops.push(`<button data-pid="${p.pid}" data-act="demote">降权</button>`);
        }
      }
      const pc = p.priority === 3 ? 'var(--gold)' : p.priority === 1 ? '#7e93ab' : '#cfe6ff';
      return `<div class="pid-row ${p.status === 'not_responding' ? 'nr' : ''} ${p.kind === 'system' ? 'sys' : ''}">
        <div class="pr-top">
          <span class="pr-pid">${p.pid}</span>
          <span class="pr-name" style="color:${pc}">${p.name}</span>
          <span class="pr-st ${p.status}">${st}</span>
        </div>
        <div class="pr-bar"><i style="width:${prog}%;background:${p.kind === 'gold' ? 'var(--gold)' : p.kind === 'anomaly' ? 'var(--red)' : 'var(--blue)'}"></i></div>
        <div class="pr-ops">
          <span style="color:#7e93ab;align-self:center">CPU ${cpu}% · ${p.mem}GB · P${p.priority}</span>
          <span style="flex:1"></span>${ops.join('')}
        </div>
      </div>`;
    }).join('');
  };

  /* ---------------- 结算 ---------------- */
  UI.renderResult = function () {
    const r = S.lastResult;
    if (!r) return;
    const G = FP.game;
    $('res-title').textContent = r.reason === 'crash' ? '系统崩溃' : '挑战结束';
    $('res-score').textContent = r.score;
    let tag = '';
    if (r.isRecord) tag = '新纪录';
    else if (r.noRecord) tag = S.debug ? '调试模式下成绩不计入最高分' : '本局在降级模式下进行，成绩不计入最高分';
    $('res-tag').textContent = tag;

    $('res-list').innerHTML = r.list.map((x, i) => `
      <div class="res-row ${x.isPlayer ? 'me' : ''}">
        <span class="rk">第 ${i + 1} 名</span>
        <span class="nm">${x.name}</span>
        <span class="sc">${x.score} 分</span>
        <span class="rp">修复 ${x.repairs}</span>
      </div>`).join('');

    let stats = `最高连击 ${r.maxCombo} · 模块使用 ${r.modsUsed} 次`;
    if (r.pid) stats += ` · 完成进程 ${r.pid.completed} · 清理异常 ${r.pid.killedAnomaly}`;
    if (r.reason === 'crash') stats += ' · 系统崩溃，分数减半';
    $('res-stats').textContent = stats;
  };

  /* ---------------- 开发者 ---------------- */
  UI.openDevPanel = function () {
    openModal(`<h3>开发者模式</h3>
      <p>已解锁核心层与 Internet 开关，HUD 显示 DEV 徽章。调试模式的成绩不计入最高分。</p>
      <div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap">
        <button class="btn small" data-a="src">源码编辑器</button>
        <button class="btn small" data-a="cmd">调试命令</button>
        <button class="btn small" data-a="reset">恢复系统参数</button>
        <button class="btn small ghost" data-a="off">退出开发者模式</button>
      </div>`, box => {
      box.querySelector('[data-a="src"]').onclick = () => {
        if (!S.src) {
          UI.prompt('输入源码编辑器密码', '二级密码', v => {
            if (FP.checkCode(v)) { S.src = true; UI.toast('源码编辑器已解锁'); openEditor(); }
            else { UI.toast('二级密码错误'); }
          });
        } else openEditor();
      };
      box.querySelector('[data-a="cmd"]').onclick = openConsole;
      box.querySelector('[data-a="reset"]').onclick = () => { closeModal(); S.degraded = false; UI.toast('系统参数已恢复默认'); };
      box.querySelector('[data-a="off"]').onclick = () => {
        closeModal(); setDev(false);
        UI.toast('已退出开发者模式');
      };
    });
  };

  function openConsole() {
    openModal(`<h3>command命令</h3>
      <div class="console-out" id="cmd-out">FP debug console · 输入 fp help 查看命令</div>
      <input type="text" id="cmd-input" placeholder="fp state dump" />
      <div class="modal-actions"><button class="btn ghost" data-a="close">关闭</button></div>`, box => {
      const out = box.querySelector('#cmd-out');
      const input = box.querySelector('#cmd-input');
      box.querySelector('[data-a="close"]').onclick = closeModal;
      setTimeout(() => input.focus(), 60);
      input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const cmd = input.value.trim();
        input.value = '';
        out.textContent += '\n> ' + cmd + '\n' + runCmd(cmd);
        out.scrollTop = out.scrollHeight;
      });
    });
  }

  const LOG = [];
  FP.log = function (msg) {
    LOG.push(new Date().toLocaleTimeString() + '  ' + msg);
    if (LOG.length > 300) LOG.shift();
  };

  function runCmd(cmd) {
    const G = FP.game;
    const parts = cmd.split(/\s+/);
    if (parts[0] !== 'fp') return '未知命令（命令以 fp 开头）';
    const sub = parts.slice(1).join(' ');
    if (sub === 'debug on') { S.debug = true; return 'debug mode on（成绩不计入最高分）'; }
    if (sub === 'debug off') { S.debug = false; return 'debug mode off'; }
    if (sub === 'off dev' || sub === 'dev off') {
      setDev(false);
      return '开发者模式已关闭（DEV 标记移除）';
    }
    if (sub === 'dev on') {
      setDev(true);
      return '开发者模式已开启';
    }
    if (sub === 'plugins list') return FP.QX.slice(0, 12).map(p => p.id).join('\n') + '\n…共 ' + FP.QX.length + ' 个';
    if (sub.startsWith('plugins toggle ')) {
      const id = sub.split(' ')[2];
      const on = S.external.includes(id);
      if (on) S.external = S.external.filter(x => x !== id); else if (S.external.length < 5) S.external.push(id);
      FP.savePlugins(); return id + ' -> ' + (on ? 'off' : 'on');
    }
    if (sub === 'state dump') {
      if (!G) return '当前没有对局';
      return JSON.stringify({ mode: G.mode, time: G.timeLeft.toFixed(1), score: G.player.score, repairs: G.player.repairs, fp: G.flashpoints.length }, null, 2);
    }
    if (sub.startsWith('state set score ')) { if (G) { G.player.score = +parts[4]; return 'score = ' + G.player.score; } return '没有对局'; }
    if (sub.startsWith('time set ')) { if (G) { G.timeLeft = +parts[3]; return 'timeLeft = ' + G.timeLeft; } return '没有对局'; }
    if (sub === 'ai freeze') { if (G) { G.ais.forEach(a => a.decisionT = 999); return 'AI frozen'; } return '没有对局'; }
    if (sub.startsWith('ai speed ')) { if (G) { G.ais.forEach(a => a.moveMul = 1 / (+parts[3])); return 'AI speed = ' + parts[3]; } return '没有对局'; }
    if (sub === 'spawn flashpoint') { if (G) { FP.spawnFlashpoint(); return 'spawned'; } return '没有对局'; }
    if (sub === 'metrics') return 'fps≈60 · state ' + S.screen + ' · plugins ' + S.external.length;
    if (sub === 'help') return 'fp debug on|off\nfp dev on|off dev\nfp plugins list|toggle <id>\nfp state dump|set score <n>\nfp time set <s>\nfp ai freeze|speed <n>\nfp spawn flashpoint\nfp metrics';
    return '未识别：' + sub;
  }

  function openEditor() {
    const tabs = ['插件源码', '系统源码', '模式源码', '控制台'];
    openModal(`<h3>源码编辑器</h3>
      <div class="tabs" id="ed-tabs">${tabs.map((t, i) => `<button class="tab ${i === 0 ? 'active' : ''}" data-t="${i}">${t}</button>`).join('')}</div>
      <textarea class="editor" id="ed-code" spellcheck="false"></textarea>
      <div class="ext-toolbar" style="margin-top:10px">
        <button class="btn small" id="ed-check">校验</button>
        <button class="btn small" id="ed-save">保存为外置插件</button>
        <button class="btn small ghost" id="ed-reset">重置</button>
        <span class="small-note" id="ed-status">状态：未校验</span>
      </div>`, box => {
      const code = box.querySelector('#ed-code');
      const status = box.querySelector('#ed-status');
      const tplCode = `window.__PLUGIN_EXPORT__ = {\n  id: "qx-editor",\n  name: "编辑器插件",\n  desc: "在源码编辑器里写的插件",\n  flags: { map: false, skill: false, rule: true, event: false, opponent: false, gameplay: false },\n  system: false\n};`;
      const readonly = {
        1: '// 系统源码（只读）\n\ncore-loop   rAF + 固定时间步 FIXED_DT = 1000/60\ncore-render Canvas 2D 绘制 / DOM 降级\ncore-input  点击队列，每帧最多处理一次移动\ncore-state  状态机 / 序列化 / 错误捕获\ncore-time   倒计时，默认 60 秒',
        2: '// 模式源码（只读）\n\nmode-standard  1 人 vs 1 AI，3 闪点，读条 2s，+10 分\nmode-triangle  1 人 + 2 AI，三方抢修\nmode-multi     2—4 人，人机混合，带排名\nmode-xhigh     高压连续抢修\nmode-qwq       只乱码显示层\nmode-pid       进程调度模式，见 pid.js',
        3: '// 控制台\n// 调试命令请使用「调试命令」面板\n'
      };
      code.value = tplCode;
      box.querySelectorAll('#ed-tabs .tab').forEach(tb => {
        tb.onclick = () => {
          box.querySelectorAll('#ed-tabs .tab').forEach(x => x.classList.remove('active'));
          tb.classList.add('active');
          const i = +tb.dataset.t;
          code.readOnly = i !== 0;
          code.value = i === 0 ? tplCode : readonly[i];
          status.textContent = '状态：' + (i === 0 ? '未校验' : '只读');
        };
      });
      box.querySelector('#ed-check').onclick = () => {
        const r = validate(code.value);
        status.textContent = '状态：' + (r.ok ? '校验通过（' + r.id + '）' : '失败 · ' + r.msg);
      };
      box.querySelector('#ed-save').onclick = () => {
        const r = validate(code.value);
        if (!r.ok) { status.textContent = '状态：失败 · ' + r.msg; return; }
        S.custom.push({ id: r.id, name: r.name, desc: r.desc, code: code.value, enabled: false });
        FP.saveCustom(); status.textContent = '状态：已保存 ' + r.id; UI.toast('已保存 ' + r.id);
      };
      box.querySelector('#ed-reset').onclick = () => { code.value = tplCode; status.textContent = '状态：未校验'; };
    });
  }

  function openLog() {
    openModal(`<h3>日志</h3><div class="console-out" id="log-out">${LOG.length ? LOG.join('\n') : '暂无日志'}</div>
      <div class="modal-actions"><button class="btn ghost" data-a="c">关闭</button></div>`, box => {
      box.querySelector('[data-a="c"]').onclick = closeModal;
    });
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('btn-start').onclick = () => { renderModes(); FP.showScreen('modes'); };
    $('btn-plugins').onclick = () => { renderPluginBody(); FP.showScreen('plugins'); };
    $('btn-settings').onclick = () => { renderSettings(); FP.showScreen('settings'); };
    $('btn-changelog').onclick = () => FP.showScreen('changelog');
    $('btn-selfcheck').onclick = () => { renderSelfcheck(); FP.showScreen('selfcheck'); };

    $('btn-log').onclick = () => {
      if (S.dev) { openLog(); return; }
      UI.prompt('输入管理员密码', '请输入密码', v => {
        if (FP.checkDev(v)) { setDev(true); openLog(); }
        else UI.toast('密码错误');
      });
    };
    $('btn-command').onclick = () => {
      if (S.dev) { openConsole(); return; }
      UI.prompt('输入管理员密码', '请输入密码', v => {
        if (FP.checkDev(v)) { setDev(true); openConsole(); }
        else UI.toast('密码错误');
      });
    };

    $('dev-entry').onclick = () => {
      if (S.dev) { UI.openDevPanel(); return; }
      UI.prompt('输入管理员密码', '请输入密码', v => {
        if (FP.checkDev(v)) { setDev(true); UI.toast('开发者模式已开启'); UI.openDevPanel(); }
        else UI.toast('密码错误');
      });
    };

    $('pause-resume').onclick = () => UI.pause(false);
    $('pause-restart').onclick = () => {
      const m = S.mode;
      UI.pause(false);
      if (m) FP.startGame(m);
    };
    $('pause-quit').onclick = () => {
      UI.pause(false);
      if (FP.game) FP.endGame('quit');
    };

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const asm = $('asm-panel');
      if (asm && asm.classList.contains('active')) return;
      const modal = $('modal-root');
      if (modal && modal.classList.contains('active')) { closeModal(); return; }
      if (S.screen === 'game' && FP.game) {
        const G = FP.game;
        if (G.phase === 'playing' || G.phase === 'countdown') {
          e.preventDefault();
          UI.pause(!G.paused);
        }
      }
    });

    document.querySelectorAll('[data-back]').forEach(b => {
      b.onclick = () => FP.showScreen(b.dataset.back);
    });

    document.querySelectorAll('#plugin-tabs .tab').forEach(t => {
      t.onclick = () => switchTab(t.dataset.tab);
    });

    $('board').addEventListener('click', ev => FP.onBoardClick(ev));
    $('btn-short').onclick = () => FP.shortCircuit();
    $('btn-quit').onclick = () => {
      UI.confirm('结束本局', '确定立刻结束当前对局并结算？', '结束', () => {
        if (FP.game) FP.endGame('quit');
      }, true);
    };

    $('pid-killall').onclick = () => FP.pidBulk('kill');
    $('pid-suspendlow').onclick = () => FP.pidBulk('low');
    $('pid-list').addEventListener('click', ev => {
      const b = ev.target.closest('button[data-pid]');
      if (!b) return;
      FP.pidAction(b.dataset.pid, b.dataset.act);
    });

    $('res-again').onclick = () => { const m = S.mode; FP.startGame(m, true); };
    $('res-mode').onclick = () => { renderModes(); FP.showScreen('modes'); };
    $('res-home').onclick = () => FP.showScreen('menu');

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ---------------- 启动 ---------------- */
  function boot() {
    FP.load();
    applyTheme();
    bind();
    FP.startLoop();
    FP.log('loaded, version v1.2');

    FP.Loader.run(() => {
      FP.showScreen('menu');
      updateMenuMeta();
      FP.log('boot ok');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
