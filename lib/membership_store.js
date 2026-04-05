/**
 * 会员、积分、等级与月度配额（持久化 JSON）
 * 数据文件: data/membership.json（自动创建）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'membership.json');

const DEFAULT_CONFIG = {
  welcomePoints: 380,
  costs: {
    otaQuery: 2,
    imageGen: 18,
    imageEdit: 15,
    videoGen: 88,
  },
  rechargePackages: [
    { id: 'p100', label: '入门包', points: 100, priceYuan: 9.9, note: '演示充值' },
    { id: 'p500', label: '旅行包', points: 500, priceYuan: 39, note: '热门' },
    { id: 'p2000', label: '专业包', points: 2000, priceYuan: 128, note: '团队' },
  ],
  tiers: [
    {
      id: 'free',
      name: '免费版',
      subtitle: '体验 · 个人',
      monthly: { otaQuery: 40, imageGen: 4, imageEdit: 3, videoGen: 0 },
      perks: ['OTA 比价基础次数', '生图少量试用', '社区支持'],
    },
    {
      id: 'travel',
      name: '旅行版',
      subtitle: '成长型团队',
      monthly: { otaQuery: 400, imageGen: 45, imageEdit: 35, videoGen: 6 },
      perks: ['途牛/飞猪全品类查询', '即梦+美图降级生图', '飞书同步'],
    },
    {
      id: 'pro',
      name: '专业版',
      subtitle: '中大型企业',
      monthly: { otaQuery: 8000, imageGen: 400, imageEdit: 280, videoGen: 60 },
      perks: ['高频 OTA 与趋势分析', '创意大图与改图', '视频生成额度', '优先支持'],
    },
    {
      id: 'enterprise',
      name: '企业版',
      subtitle: '定制与私有化',
      monthly: { otaQuery: 999999, imageGen: 999999, imageEdit: 999999, videoGen: 999999 },
      perks: ['不限或单独签约', '私域部署与数据自有', '定制集成', '专属 SLA'],
    },
  ],
};

function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState() {
  ensureDir();
  if (!fs.existsSync(DATA_FILE)) {
    const initial = { config: { ...DEFAULT_CONFIG }, users: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const s = JSON.parse(raw);
    if (!s.config) s.config = {};
    if (!s.users) s.users = {};
    s.config = {
      ...DEFAULT_CONFIG,
      ...s.config,
      costs: { ...DEFAULT_CONFIG.costs, ...(s.config.costs || {}) },
    };
    if (!Array.isArray(s.config.tiers) || s.config.tiers.length === 0) s.config.tiers = DEFAULT_CONFIG.tiers;
    if (!Array.isArray(s.config.rechargePackages) || s.config.rechargePackages.length === 0) {
      s.config.rechargePackages = DEFAULT_CONFIG.rechargePackages;
    }
    return s;
  } catch (e) {
    return { config: { ...DEFAULT_CONFIG }, users: {} };
  }
}

function saveState(state) {
  ensureDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), 'utf8');
}

let _cache = null;
function getState() {
  if (!_cache) _cache = loadState();
  return _cache;
}

function persist() {
  saveState(getState());
}

function getTierDef(tierId) {
  const cfg = getState().config;
  return cfg.tiers.find((t) => t.id === tierId) || cfg.tiers[0];
}

function ensureUser(memberKey) {
  if (!memberKey || typeof memberKey !== 'string') return null;
  const st = getState();
  const mk = monthKey();
  if (!st.users[memberKey]) {
    st.users[memberKey] = {
      tierId: 'free',
      points: st.config.welcomePoints ?? DEFAULT_CONFIG.welcomePoints,
      createdAt: new Date().toISOString(),
      usageMonth: mk,
      usage: { otaQuery: 0, imageGen: 0, imageEdit: 0, videoGen: 0 },
    };
    persist();
  }
  const u = st.users[memberKey];
  if (u.usageMonth !== mk) {
    u.usageMonth = mk;
    u.usage = { otaQuery: 0, imageGen: 0, imageEdit: 0, videoGen: 0 };
    persist();
  }
  return u;
}

const KIND_MAP = {
  otaQuery: 'otaQuery',
  imageGen: 'imageGen',
  imageEdit: 'imageEdit',
  videoGen: 'videoGen',
};

/**
 * 尝试消耗一次额度：先月度配额，再扣积分
 * @returns {{ ok: boolean, reason?: string, balance?: number, usedQuota?: boolean, tierId?: string }}
 */
function tryConsume(memberKey, kind) {
  const k = KIND_MAP[kind] || kind;
  const u = ensureUser(memberKey);
  if (!u) return { ok: false, reason: 'invalid_member_key' };
  const cfg = getState().config;
  const tier = getTierDef(u.tierId);
  const limit = tier.monthly[k] ?? 0;
  const cost = cfg.costs[k] ?? 0;
  const usage = u.usage[k] ?? 0;

  if (usage < limit) {
    u.usage[k] = usage + 1;
    persist();
    return { ok: true, usedQuota: true, balance: u.points, tierId: u.tierId };
  }
  if (u.points >= cost) {
    u.points -= cost;
    persist();
    return { ok: true, usedQuota: false, balance: u.points, tierId: u.tierId, cost };
  }
  return {
    ok: false,
    reason: 'insufficient',
    needPoints: cost,
    balance: u.points,
    tierId: u.tierId,
    limit,
    used: usage,
  };
}

function addPoints(memberKey, delta) {
  const u = ensureUser(memberKey);
  u.points = Math.max(0, (u.points || 0) + Number(delta));
  persist();
  return u;
}

function setTier(memberKey, tierId) {
  const u = ensureUser(memberKey);
  if (getTierDef(tierId)) u.tierId = tierId;
  persist();
  return u;
}

function applyRechargePackage(memberKey, packageId) {
  const cfg = getState().config;
  const pkg = cfg.rechargePackages.find((p) => p.id === packageId);
  if (!pkg) return { ok: false, reason: 'unknown_package' };
  const u = addPoints(memberKey, pkg.points);
  return { ok: true, package: pkg, user: publicUser(memberKey) };
}

function publicConfig() {
  const c = getState().config;
  return {
    welcomePoints: c.welcomePoints,
    costs: c.costs,
    rechargePackages: c.rechargePackages,
    tiers: c.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      subtitle: t.subtitle,
      monthly: t.monthly,
      perks: t.perks,
    })),
  };
}

function publicUser(memberKey) {
  const u = ensureUser(memberKey);
  const tier = getTierDef(u.tierId);
  return {
    tierId: u.tierId,
    tierName: tier.name,
    points: u.points,
    usageMonth: u.usageMonth,
    usage: { ...u.usage },
    limits: { ...tier.monthly },
  };
}

function updateConfig(partial) {
  const st = getState();
  if (partial.welcomePoints != null) st.config.welcomePoints = Number(partial.welcomePoints);
  if (partial.costs && typeof partial.costs === 'object') Object.assign(st.config.costs, partial.costs);
  if (Array.isArray(partial.rechargePackages)) st.config.rechargePackages = partial.rechargePackages;
  if (Array.isArray(partial.tiers)) st.config.tiers = partial.tiers;
  persist();
  return st.config;
}

module.exports = {
  getState,
  persist,
  ensureUser,
  tryConsume,
  addPoints,
  setTier,
  applyRechargePackage,
  publicConfig,
  publicUser,
  updateConfig,
  monthKey,
  DEFAULT_CONFIG,
};
