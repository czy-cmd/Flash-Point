/* FLASHPOINT PROTOCOL · data
 * 所有静态数据：级别、模块、插件、模式、加载页词库
 */
window.FP = window.FP || {};

FP.CONFIG = { cols: 11, rows: 11, cell: 48, pad: 24 };

/* ---------------- 模块核心级别 ---------------- */
FP.LEVEL_ORDER = ['SP', 'ARC', 'BLT', 'SRG', 'PKS'];

FP.LEVELS = {
  SP:  { key: 'SP',  full: 'Spark',      cn: '火花',     color: '#9aa4b2', nodes: 3, flash: 0.8, cost: 20, heat: 20, mult: 1.0, drop: 50, overheat: 10, chain: false },
  ARC: { key: 'ARC', full: 'Arc',        cn: '电弧',     color: '#5fd07a', nodes: 4, flash: 0.7, cost: 25, heat: 25, mult: 1.2, drop: 30, overheat: 10, chain: false },
  BLT: { key: 'BLT', full: 'Bolt',       cn: '闪电',     color: '#4FC3F7', nodes: 4, flash: 0.6, cost: 30, heat: 30, mult: 1.5, drop: 15, overheat: 9,  chain: true },
  SRG: { key: 'SRG', full: 'Surge',      cn: '浪涌',     color: '#c07be0', nodes: 5, flash: 0.5, cost: 35, heat: 35, mult: 2.0, drop: 4,  overheat: 8,  chain: true },
  PKS: { key: 'PKS', full: 'Peak Surge', cn: '峰值浪涌', color: '#ffd54f', nodes: 5, flash: 0.4, cost: 40, heat: 40, mult: 3.0, drop: 1,  overheat: 6,  chain: true }
};

FP.MODULES = {
  pulse:    { id: 'pulse',    name: '脉冲放电', color: '#4FC3F7' },
  shield:   { id: 'shield',   name: '绝缘护盾', color: '#5fd07a' },
  speed:    { id: 'speed',    name: '加速',     color: '#ffd54f' },
  decoy:    { id: 'decoy',    name: '诱饵电箱', color: '#ff9f6b' },
  overload: { id: 'overload', name: '过载协议', color: '#ff6b6b' },
  jam:      { id: 'jam',      name: '干扰信号', color: '#c07be0' }
};

/* 模块按级别的具体数值（key 顺序同 LEVEL_ORDER） */
FP.MODULE_EFFECT = {
  pulse: {
    range: [2, 2, 3, 3, 4],
    slow:  [0, 0.5, 1, 1.5, 2],
    shield:[0, 0, 0, 1, 2]
  },
  shield: {
    dur:  [2, 2.5, 3, 4, 5],
    move: [0, 0, 0.1, 0.2, 0.3]
  },
  speed: {
    dur:  [4, 4.5, 5, 5.5, 6],
    mul:  [1.8, 2.0, 2.2, 2.5, 3.0],
    read: [0, 0, 0.1, 0.15, 0.2]
  },
  decoy: {
    dur:  [4, 5, 6, 7, 8],
    range:[0, 1, 1, 2, 2],
    slow: [0, 1, 1.5, 2, 2]
  },
  overload: {
    overheat: [5, 4, 3, 2, 1],
    immune:   [0, 0, 2, 3, 5]
  },
  jam: {
    dur: [2, 2.5, 3, 3.5, 4]
  }
};

/* ---------------- 系统插件 ---------------- */
FP.SYS = {
  core: [
    { id: 'core-loop',   name: '主循环内核', locked: true },
    { id: 'core-render', name: '渲染内核',   locked: true },
    { id: 'core-input',  name: '输入内核',   locked: true },
    { id: 'core-state',  name: '状态内核',   locked: true },
    { id: 'core-time',   name: '计时内核',   locked: true }
  ],
  use: [
    { id: 'use-basic_system', name: '基础系统', warn: true },
    { id: 'use-harness',      name: '插件运行时' },
    { id: 'use-simple',       name: '轻量规则内核' },
    { id: 'use-with',         name: '人机混合支持' }
  ],
  mode: [
    { id: 'mode-standard', name: '普通模式核心', mode: 'standard' },
    { id: 'mode-triangle', name: '三角模式核心', mode: 'triangle' },
    { id: 'mode-multi',    name: '多人运动核心', mode: 'multi' },
    { id: 'mode-xhigh',    name: '极限挑战核心', mode: 'xhigh' },
    { id: 'mode-qwq',      name: 'QWQ 模式核心', mode: 'qwq' },
    { id: 'mode-pid',      name: 'PID 模式核心', mode: 'pid' }
  ],
  develope: [
    { id: 'DEVELOPE-time_up', name: '时间扩展', system: true },
    { id: 'DEVELOPE-shop',    name: '商店' },
    { id: 'DEVELOPE-level',   name: '关卡模式' },
    { id: 'DEVELOPE-save',    name: '存档系统' },
    { id: 'DEVELOPE-daily',   name: '每日挑战' }
  ],
  internet: { id: 'internet', name: 'Internet', locked: true }
};

/* ---------------- 50 个外置插件 ---------------- */
/* flags: map skill rule event opp game */
FP.QX = [
  { id: 'qx-portal',      name: '传送门',   desc: '地图生成 2 对传送门，踩上传到另一端', f: { map: 1 } },
  { id: 'qx-wall',        name: '障碍墙',   desc: '随机 6 格不可通行', f: { map: 1 } },
  { id: 'qx-fog',         name: '迷雾',     desc: '周围 2 格以外不可见', f: { map: 1 } },
  { id: 'qx-shrink',      name: '缩圈',     desc: '每 10 秒边缘一圈变障碍', f: { map: 1 } },
  { id: 'qx-moving',      name: '移动平台', desc: '每 8 秒 2 个闪点随机换位', f: { map: 1 } },
  { id: 'qx-conveyor',    name: '传送带',   desc: '部分格子把角色往固定方向推', f: { map: 1 } },
  { id: 'qx-multiply',    name: '闪点增殖', desc: '同时存在的闪点 +2', f: { map: 1 } },
  { id: 'qx-invert',      name: '地形反转', desc: '明暗反转，障碍与通路互换', f: { map: 1 } },
  { id: 'qx-randomtp',    name: '随机传送', desc: '每 15 秒所有角色随机传送', f: { map: 1 } },
  { id: 'qx-symmetric',   name: '对称地图', desc: '地图左右对称，闪点成对出现', f: { map: 1 } },

  { id: 'qx-boots',       name: '加速靴',   desc: '移速 +50%，读条 +0.5 秒', f: { skill: 1 } },
  { id: 'qx-freeze',      name: '冻结',     desc: '短路改为冻结 2 秒，冷却 15 秒', f: { skill: 1 } },
  { id: 'qx-clone',       name: '分身',     desc: '每局一次，5 秒假身吸引 AI', f: { skill: 1 } },
  { id: 'qx-rewind',      name: '时间回溯', desc: '每局一次，回到 3 秒前的位置', f: { skill: 1 } },
  { id: 'qx-backfire',    name: '短路反噬', desc: '短路后自己也减速 1 秒', f: { skill: 1 } },
  { id: 'qx-dual',        name: '技能双持', desc: '短路冷却减半，读条 +1 秒', f: { skill: 1 } },
  { id: 'qx-overload',    name: '过载协议', desc: '立刻完成读条，自身过热 5 秒', f: { skill: 1 } },
  { id: 'qx-shield',      name: '绝缘护盾', desc: '3 秒免疫短路和减速', f: { skill: 1 } },
  { id: 'qx-decoy',       name: '诱饵电箱', desc: '放假闪点引开 AI，持续 5 秒', f: { skill: 1 } },
  { id: 'qx-jam',         name: '干扰信号', desc: '最近 AI 随机走错方向 2 秒', f: { skill: 1 } },

  { id: 'qx-double',      name: '双倍分数', desc: '所有得分 ×2', f: { rule: 1 } },
  { id: 'qx-combo',       name: '连击保护', desc: '连击中断时间 8 → 12 秒', f: { rule: 1 } },
  { id: 'qx-speedread',   name: '读条竞速', desc: '读条减半，移动永久 -1 分', f: { rule: 1 } },
  { id: 'qx-timelimit',   name: '闪点限时', desc: '闪点只存在 5 秒', f: { rule: 1 } },
  { id: 'qx-bounty',      name: '分数悬赏', desc: '第一名修闪点时，其他人 +5', f: { rule: 1 } },
  { id: 'qx-nocombo',     name: '无连击',   desc: '取消连击，每次修复 +15', f: { rule: 1 } },
  { id: 'qx-accel',       name: '时间加速', desc: '最后 15 秒读条和移速 +30%', f: { rule: 1 } },
  { id: 'qx-lucky',       name: '幸运闪点', desc: '随机金色闪点，修复得 30 分', f: { rule: 1 } },
  { id: 'qx-penalty',     name: '读条扣分', desc: '读条被打断扣 5 分', f: { rule: 1 } },
  { id: 'qx-reverse',     name: '价值反转', desc: '闪点分数随机反转', f: { rule: 1 } },
  { id: 'qx-chain',       name: '连续翻倍', desc: '连续修复同一区域，第二次 ×1.5', f: { rule: 1 } },

  { id: 'qx-randomevent', name: '随机事件', desc: '每 10 秒触发随机电网事件', f: { event: 1 } },
  { id: 'qx-explode',     name: '闪点爆炸', desc: '修复时周围 1 格减速 1 秒', f: { event: 1 } },
  { id: 'qx-globalshort', name: '全图短路', desc: '每 15 秒所有人减速 1 秒', f: { event: 1 } },
  { id: 'qx-timeevent',   name: '时间事件', desc: '随机 5 秒读条速度翻倍', f: { event: 1 } },
  { id: 'qx-luckyevent',  name: '幸运事件', desc: '随机给某位玩家 +10 分', f: { event: 1 } },
  { id: 'qx-fluctuation', name: '电网波动', desc: '读条速度每 5 秒波动 ±30%', f: { event: 1 } },
  { id: 'qx-emergency',   name: '紧急维修', desc: '随机 3 秒限时高价值闪点', f: { event: 1 } },
  { id: 'qx-blackout',    name: '停电',     desc: '每 20 秒全图黑屏 2 秒', f: { event: 1 } },
  { id: 'qx-voltage',     name: '电压不稳', desc: '读条 20% 概率自动中断', f: { event: 1 } },
  { id: 'qx-storm',       name: '雷暴',     desc: '随机雷击某格，减速 2 秒', f: { event: 1 } },

  { id: 'qx-rage',        name: 'AI 狂暴',  desc: 'AI 反应 +50%，读条 +1 秒', f: { opp: 1 } },
  { id: 'qx-infight',     name: 'AI 内讧',  desc: '双 AI 模式下 AI 互相短路', f: { opp: 1 } },
  { id: 'qx-mimic',       name: 'AI 模仿',  desc: 'AI 模仿你上次移动路线', f: { opp: 1 } },
  { id: 'qx-thirdparty',  name: '第三方 AI', desc: '只捣乱不抢分的 AI', f: { opp: 1 } },
  { id: 'qx-teammate',    name: 'AI 队友',  desc: '帮你抢闪点的 AI，分数算你', f: { opp: 1 } },
  { id: 'qx-ailag',       name: 'AI 延迟',  desc: 'AI 反应速度 -40%', f: { opp: 1 } },
  { id: 'qx-aimiss',      name: 'AI 失误',  desc: 'AI 读条 25% 概率中断', f: { opp: 1 } },
  { id: 'qx-aievolve',    name: 'AI 进化',  desc: 'AI 每回合反应 +5%', f: { opp: 1 } },

  { id: 'qx-reverseop',   name: '反向操作', desc: '点击方向反转', f: { game: 1 } }
];

FP.QX_MAP = {};
FP.QX.forEach(p => { FP.QX_MAP[p.id] = p; });

FP.SYSTEM_WHITELIST = ['core-loop', 'core-render', 'core-input', 'core-state', 'core-time',
  'use-basic_system', 'use-harness', 'use-simple', 'use-with',
  'mode-standard', 'mode-triangle', 'mode-multi', 'mode-xhigh', 'mode-qwq', 'mode-pid', 'internet'];

/* ---------------- 模式 ---------------- */
FP.MODES = [
  { id: 'standard', name: '普通模式', plugin: 'mode-standard', ai: 1, dur: 60,
    desc: '单人 vs 1 AI。3 个闪点同时存在，读条 2 秒，修复 +10 分。最基础规则。' },
  { id: 'triangle', name: '三角模式', plugin: 'mode-triangle', ai: 2, dur: 60,
    desc: '1 人 + 2 AI 三方同场抢修，AI 之间可能互相干扰，也可能联合对付你。' },
  { id: 'multi',    name: '多人运动', plugin: 'mode-multi', ai: 3, dur: 75,
    desc: '2—4 人轮流操作，共用一张地图和闪点，带排名与分数悬赏。' },
  { id: 'xhigh',    name: '极限挑战', plugin: 'mode-xhigh', ai: 2, dur: 45,
    desc: '高压连续抢修，闪点更多、读条更短、AI 更凶。' },
  { id: 'qwq',      name: 'QWQ我也不知道这是什么模式', plugin: 'mode-qwq', ai: 1, dur: 60,
    desc: '全界面乱码的搞笑模式，实际逻辑不变。' },
  { id: 'pid',      name: 'PID 进程模式', plugin: 'mode-pid', ai: 0, dur: 60,
    desc: '不点读条，改为创建/调度抢修进程。CPU 与内存有限，过载会崩溃。' }
];
FP.MODE_MAP = {};
FP.MODES.forEach(m => { FP.MODE_MAP[m.id] = m; });

/* ---------------- 加载页词库 ---------------- */
FP.LOADER = {
  verbs: ['reconfiguring', 'recalibrating', 'initializing', 'aligning', 'finalizing', 'decrypting',
    'bootstrapping', 'validating', 'optimizing', 'synchronizing', 'compiling', 'indexing',
    'patching', 'streaming', 'calibrating', 'verifying'],
  nouns: ['synaptic lattice', 'quantum harmonics', 'probabilistic inference engine', 'temporal coherence',
    'neural handshake', 'heuristic cache', 'semantic manifold', 'recursive parser', 'entropy buffer',
    'voltage regulator', 'temporal index', 'flashpoint registry', 'grid topology', 'repair scheduler']
};

/* ---------------- 工具 ---------------- */
FP.util = {
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  key(x, y) { return x + ',' + y; }
};
