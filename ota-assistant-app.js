/**
 * 番茄旅行 AI 助手 — OTA 统一交互（ota-hotel-flight-query）
 */
const API =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:3000'
    : window.location.origin;

const MEMBER_KEY_STORAGE = 'tomato_member_key_v1';

const currentMode = { mode: 'smart' };
let chatHistory = [];
let currentHotels = [];
let currentQuery = {};
let lastOtaPayload = null;
let isLoading = false;
let currentFilter = 'all';
let memberSnapshot = null;

function getMemberKey() {
  try {
    let k = localStorage.getItem(MEMBER_KEY_STORAGE);
    if (!k) {
      k =
        'mk_' +
        (crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now()) + '_' + Math.random().toString(36).slice(2, 12));
      localStorage.setItem(MEMBER_KEY_STORAGE, k);
    }
    return k;
  } catch (e) {
    return 'mk_anon';
  }
}

function memberHeaders() {
  return { 'X-Member-Key': getMemberKey() };
}

document.addEventListener('DOMContentLoaded', () => {
  loadHistory();
  checkAPIService();
  checkFlyaiStatus();
  refreshMemberBar();
  autoResize(document.getElementById('chatInput'));
});

async function refreshMemberBar() {
  const el = document.getElementById('memberBar');
  if (!el) return;
  try {
    const res = await fetch(`${API}/api/member/me?key=${encodeURIComponent(getMemberKey())}`);
    const j = await res.json();
    if (j.status !== 0 || !j.data || j.data.anonymous) {
      el.textContent = '会员：加载中…';
      return;
    }
    memberSnapshot = j.data;
    const u = j.data;
    el.innerHTML = `<span style="opacity:.9">Lv ${escapeHtml(u.tierName || u.tierId)}</span> · 积分 <strong style="color:#FF6B35">${u.points ?? 0}</strong> · OTA ${u.usage?.otaQuery ?? 0}/${u.limits?.otaQuery ?? '—'}`;
  } catch (e) {
    el.textContent = '会员：离线';
  }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

function onInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

async function checkAPIService() {
  const badge = document.getElementById('skillBadge');
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  try {
    const res = await fetch(`${API}/health`);
    const j = await res.json();
    badge.className = 'skill-badge ready';
    badge.textContent = '🎯 ota-hotel-flight-query 已加载';
    dot.className = 'status-dot ok';
    statusText.textContent =
      j.tuniuApiKey === 'configured'
        ? '🍅 OTA服务在线 · 途牛KEY已配置'
        : '🍅 OTA在线 · 请配置 TUNIU_API_KEY 获取实时途牛数据';
  } catch (e) {
    badge.className = 'skill-badge error';
    badge.textContent = '⚠️ 请启动 node hotel-api-server.js';
    dot.className = 'status-dot err';
    statusText.textContent = '⚠️ OTA API 未连接 (' + API + ')';
  }
}

async function checkFlyaiStatus() {
  const el = document.getElementById('flyaiStatus');
  try {
    const res = await fetch(`${API}/health`);
    const data = await res.json();
    el.textContent = data.flyai === 'available' ? '✅ 飞猪CLI' : '⚠️ 仅途牛(飞猪未装)';
  } catch (e) {
    el.textContent = '❌ 离线';
  }
}

function parseHotelQuery(msg) {
  const q = { dest: '', hotelName: '', checkIn: '', checkOut: '', days: 2, isHotelQuery: false };
  const dests = [
    '三亚',
    '普吉岛',
    '巴厘岛',
    '新加坡',
    '曼谷',
    '东京',
    '马尔代夫',
    '沙巴',
    '苏梅岛',
    '大阪',
    '京都',
    '台北',
    '香港',
    '悉尼',
    '巴黎',
    '伦敦',
    '北京',
    '上海',
    '广州',
    '深圳',
  ];
  for (const d of dests) {
    if (msg.includes(d)) {
      q.dest = d;
      break;
    }
  }
  if (q.dest) {
    const after = msg.split(q.dest)[1] || '';
    const hotelMatch = after.match(/([^\d\s,，。]+?(?:酒店|希尔顿|度假|民宿|宾馆|公寓|客栈))/);
    if (hotelMatch) q.hotelName = hotelMatch[1].replace(/[，,、\s]/g, '').trim();
  }
  const y = new Date().getFullYear();
  const datePattern = /(\d{1,2})[月\-/](\d{1,2})/g;
  const dates = [];
  let m;
  while ((m = datePattern.exec(msg)) !== null) {
    dates.push(`${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  }
  const fullDate = msg.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/);
  if (fullDate) {
    dates.unshift(`${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`);
  }
  if (dates.length >= 2) {
    q.checkIn = dates[0];
    q.checkOut = dates[1];
  } else if (dates.length === 1) {
    q.checkIn = dates[0];
    const d = new Date(dates[0]);
    d.setDate(d.getDate() + 2);
    q.checkOut = d.toISOString().slice(0, 10);
  } else {
    const t = new Date();
    t.setDate(t.getDate() + 7);
    const c = new Date(t);
    c.setDate(c.getDate() + 2);
    q.checkIn = t.toISOString().slice(0, 10);
    q.checkOut = c.toISOString().slice(0, 10);
  }
  q.days = Math.round((new Date(q.checkOut) - new Date(q.checkIn)) / 86400000);
  const hotelKw = ['酒店', '住宿', '民宿', '客栈', '希尔顿', '亚朵', '万豪', '比价'];
  q.isHotelQuery =
    hotelKw.some((k) => msg.includes(k)) ||
    (q.dest && (msg.includes('价格') || msg.includes('多少钱') || msg.includes('查')));
  return q;
}

function parseCityPair(msg) {
  const arrow = msg.match(/([\u4e00-\u9fa5]+)\s*[→到\-]\s*([\u4e00-\u9fa5]+)/);
  if (arrow) return { from: arrow[1].trim(), to: arrow[2].trim() };
  const m = msg.match(/从\s*([\u4e00-\u9fa5]+)\s*到\s*([\u4e00-\u9fa5]+)/);
  if (m) return { from: m[1].trim(), to: m[2].trim() };
  return { from: '北京', to: '三亚' };
}

function parseSingleDate(msg) {
  const fullDate = msg.match(/(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})/);
  if (fullDate)
    return `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`;
  const y = new Date().getFullYear();
  const m = msg.match(/(\d{1,2})[月\-/](\d{1,2})/);
  if (m) return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

/** 识别 OTA 意图 */
function detectOtaIntent(msg) {
  const m = msg.trim();
  if (/邮轮|游轮/.test(m)) return { type: 'cruise', msg: m };
  if (/跟团|自助游|自驾游|度假产品|线路/.test(m)) return { type: 'holiday', msg: m };
  if (/门票|景点|景区/.test(m)) return { type: 'ticket', msg: m };
  if (/火车|高铁|动车|车次/.test(m)) return { type: 'train', msg: m };
  if (/机票|航班|飞机|航空/.test(m)) return { type: 'flight', msg: m };
  if (/趋势|走势|未来几天/.test(m)) return { type: 'trend', msg: m };
  if (/飞书|同步.*表|推送.*表/.test(m)) return { type: 'feishu', msg: m };
  const hq = parseHotelQuery(m);
  if (hq.isHotelQuery) return { type: 'hotel', msg: m, query: hq };
  return { type: 'unknown', msg: m };
}

function getPriceColor(price) {
  if (price <= 500) return { cls: 'low', label: '🟢 经济' };
  if (price <= 1500) return { cls: 'medium', label: '🟠 舒适' };
  if (price <= 3000) return { cls: 'high', label: '🔴 高档' };
  return { cls: 'luxury', label: '🟣 豪华' };
}

async function postOta(type, body) {
  const res = await fetch(`${API}/api/ota/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...memberHeaders() },
    body: JSON.stringify({ type, ...body }),
  });
  const j = await res.json();
  if (res.status === 402) {
    throw new Error((j.message || '额度不足') + ' · 打开「会员」页查看充值与档位');
  }
  if (j.status !== 0) throw new Error(j.message || 'OTA 请求失败');
  refreshMemberBar();
  return { data: j.data, apiMeta: j.meta || {} };
}

/** 生图 / 改图 / 视频预检 */
function detectCreativeIntent(msg) {
  const m = msg.trim();
  if (/^(视频|成片|生成视频)/.test(m) || /视频生成/.test(m)) return { kind: 'video', prompt: m };
  if (/改图|修图|换背景|图生图/.test(m)) {
    const urlMatch = m.match(/https?:\/\/\S+/);
    return { kind: 'image_edit', prompt: m.replace(/https?:\/\/\S+/, '').trim(), imageUrl: urlMatch ? urlMatch[0] : '' };
  }
  if (/生图|画一张|文生图|AI画图|生成海报|海报/.test(m)) {
    const p = m.replace(/^(生图|画一张|文生图|AI画图|生成海报|海报)[:：]?\s*/i, '').trim();
    return { kind: 'image_gen', prompt: p || m };
  }
  return null;
}

async function postCreativeImage(payload) {
  const res = await fetch(`${API}/api/creative/image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...memberHeaders() },
    body: JSON.stringify({ memberKey: getMemberKey(), ...payload }),
  });
  const j = await res.json();
  if (res.status === 401 || res.status === 402) {
    throw new Error(j.message || j.detail?.reason || '积分或额度不足');
  }
  if (j.status !== 0) throw new Error(j.message || '创意请求失败');
  refreshMemberBar();
  return j.data;
}

async function postVideoReserve() {
  const res = await fetch(`${API}/api/creative/video-reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...memberHeaders() },
    body: JSON.stringify({ memberKey: getMemberKey() }),
  });
  const j = await res.json();
  if (res.status === 402) throw new Error(j.message || '视频额度不足');
  if (j.status !== 0) throw new Error(j.message || '预检失败');
  refreshMemberBar();
  return j.data;
}

async function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg || isLoading) return;

  isLoading = true;
  document.getElementById('sendBtn').disabled = true;
  input.value = '';
  input.style.height = 'auto';

  addMsg(msg, 'user');
  addToHistory(msg);

  const creative = detectCreativeIntent(msg);
  if (creative) {
    showLoading();
    try {
      if (creative.kind === 'video') {
        await postVideoReserve();
        removeLoading();
        addMsg(
          `✅ 已为你预留 <strong>1 次视频额度</strong>（演示）。<br>请在本机使用即梦/剪映 CLI 生成视频；生产环境可将网关接入同一套积分。<br><small>提示词：${escapeHtml(creative.prompt)}</small>`,
          'ai'
        );
      } else if (creative.kind === 'image_edit') {
        if (!creative.imageUrl) {
          removeLoading();
          addMsg('改图需要一张图片地址。请在同一条消息里粘贴以 http 开头的图片 URL，例如：<br><code>改图 换成水彩风格 https://example.com/a.jpg</code>', 'ai');
        } else {
          const data = await postCreativeImage({
            action: 'edit',
            prompt: creative.prompt || '优化画面',
            imageUrl: creative.imageUrl,
            provider: 'meitu',
          });
          removeLoading();
          renderCreativeResult('改图（美图引擎）', data);
        }
      } else {
        const data = await postCreativeImage({
          action: 'generate',
          prompt: creative.prompt,
          provider: 'auto',
        });
        removeLoading();
        renderCreativeResult('生图（即梦 → 美图降级）', data);
      }
    } catch (e) {
      removeLoading();
      addMsg('创意能力调用失败：' + escapeHtml(e.message), 'ai');
    }
    isLoading = false;
    document.getElementById('sendBtn').disabled = false;
    scrollBottom();
    return;
  }

  const intent = detectOtaIntent(msg);
  showLoading();

  try {
    if (intent.type === 'unknown') {
      removeLoading();
      addMsg(
        '我可以帮你查询：<br>🏨 酒店比价（途牛+飞猪）<br>✈️ 机票 · 🚄 火车 · 🎫 门票 · 🚢 邮轮 · 🧳 度假产品<br>📈 价格趋势 · 📊 同步飞书<br>🎨 <strong>生图</strong>（即梦失败自动美图）· 🖼️ 改图（美图）· 🎬 视频额度预留<br><br>示例：<em>北京到三亚机票4月10日</em>、<em>生图：夕阳下的三亚海滩</em>',
        'ai'
      );
      isLoading = false;
      document.getElementById('sendBtn').disabled = false;
      return;
    }

    if (intent.type === 'feishu') {
      removeLoading();
      showFeishuPanel();
      isLoading = false;
      document.getElementById('sendBtn').disabled = false;
      return;
    }

    let data;
    const pq = intent.query || parseHotelQuery(msg);

    if (intent.type === 'hotel') {
      data = await postOta('hotel', {
        destName: pq.dest || '三亚',
        keyWords: pq.hotelName || '',
        checkIn: pq.checkIn,
        checkOut: pq.checkOut,
      });
      currentQuery = {
        dest: data.destName,
        hotelName: data.keyWords,
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        days: pq.days,
      };
      currentHotels = data.hotels || [];
      lastOtaPayload = { type: 'hotel', data };
      removeLoading();
      renderOTAResult(currentHotels, currentQuery, {
        flyaiOK: data.meta?.flyaiSuccess,
        tnCount: data.meta?.tuniuCount,
        fyCount: data.meta?.flyaiCount,
      });
      appendFeishuHint(data.meta?.feishuBaseUrl);
    } else if (intent.type === 'flight') {
      const { from, to } = parseCityPair(msg);
      const date = parseSingleDate(msg);
      data = await postOta('flight', { fromCity: from, toCity: to, date });
      lastOtaPayload = { type: 'flight', data };
      currentQuery = { label: `${from}→${to}`, date };
      removeLoading();
      renderListResult('✈️ 机票（途牛）', data.items || [], 'flight', data.error);
    } else if (intent.type === 'train') {
      const { from, to } = parseCityPair(msg);
      const date = parseSingleDate(msg);
      data = await postOta('train', { fromCity: from, toCity: to, date });
      lastOtaPayload = { type: 'train', data };
      currentQuery = { label: `${from}→${to}`, date };
      removeLoading();
      renderListResult('🚄 火车票（途牛）', data.items || [], 'train', data.error);
    } else if (intent.type === 'ticket') {
      const scenic = msg.match(/([\u4e00-\u9fa5]{2,8})(?:景区|景点|门票)/);
      const city = pq.dest || '三亚';
      const scenicName = scenic ? scenic[1] : msg.includes('蜈支洲') ? '蜈支洲岛' : '亚龙湾';
      data = await postOta('ticket', { cityName: city, scenicName });
      lastOtaPayload = { type: 'ticket', data };
      removeLoading();
      renderListResult('🎫 门票（途牛）', data.items || [], 'ticket', data.error);
    } else if (intent.type === 'cruise') {
      const d0 = parseSingleDate(msg);
      const d1 = new Date(d0);
      d1.setDate(d1.getDate() + 5);
      data = await postOta('cruise', {
        departsDateBegin: d0,
        departsDateEnd: d1.toISOString().slice(0, 10),
      });
      lastOtaPayload = { type: 'cruise', data };
      removeLoading();
      renderListResult('🚢 邮轮（途牛）', data.items || [], 'cruise', data.error);
    } else if (intent.type === 'holiday') {
      const dest = pq.dest || '三亚';
      const d0 = pq.checkIn || parseSingleDate(msg);
      const d1 = pq.checkOut || new Date(new Date(d0).getTime() + 5 * 86400000).toISOString().slice(0, 10);
      data = await postOta('holiday', {
        destinationName: dest,
        departsDateBegin: d0,
        departsDateEnd: d1,
      });
      lastOtaPayload = { type: 'holiday', data };
      removeLoading();
      renderListResult('🧳 度假产品（途牛）', data.items || [], 'holiday', data.error);
    } else if (intent.type === 'trend') {
      data = await postOta('trend', {
        destName: pq.dest || '三亚',
        checkIn: pq.checkIn,
        days: 7,
      });
      lastOtaPayload = { type: 'trend', data };
      removeLoading();
      renderTrendResult(data);
    }
  } catch (e) {
    removeLoading();
    addMsg('查询失败：' + e.message + '<br><small>请确认已运行 <code>npm start</code> 且已安装 <code>tuniu-cli</code> 并配置 <code>TUNIU_API_KEY</code></small>', 'ai');
  }

  isLoading = false;
  document.getElementById('sendBtn').disabled = false;
  scrollBottom();
}

function appendFeishuHint(baseUrl) {
  if (!baseUrl) return;
  addMsg(`📊 飞书多维表格基址：<a href="${baseUrl}" target="_blank" style="color:#00C9A7">${baseUrl}</a>（配置 FEISHU_* 后可一键推送）`, 'ai');
}

function renderListResult(title, items, kind, error) {
  if (error) {
    addMsg(`⚠️ ${title}<br>${error}`, 'ai');
    return;
  }
  if (!items.length) {
    addMsg(`${title}<br>未查询到结果，请调整城市/日期/关键词`, 'ai');
    return;
  }
  let summary = `✅ ${title} · 共 <strong>${items.length}</strong> 条`;
  addMsg(summary, 'ai');

  const panel = document.createElement('div');
  panel.className = 'ota-panel';
  panel.innerHTML = `<div class="ota-head"><div class="ota-title-row"><span style="font-size:24px">🍅</span><div><div class="ota-title">${title}</div></div></div></div>`;
  const list = document.createElement('div');
  list.className = 'hotels-list';
  list.innerHTML = items
    .map((it, i) => {
      const p = it.price != null ? it.price : '';
      const pc = getPriceColor(Number(p) || 0);
      return `<div class="hotel-card ${kind}"><div class="hotel-card-top"><div class="hotel-rank num">${i + 1}</div><div class="hotel-name"><div class="hotel-name-text">${escapeHtml(it.title || it.name || '')}</div></div><span class="src-badge t">途牛</span></div><div class="hotel-card-body"><div class="hotel-details"><div class="hotel-addr">${escapeHtml(it.time || it.duration || it.type || it.route || '')}</div></div><div class="hotel-right"><div class="hotel-price ${pc.cls}">¥${Number(p).toLocaleString()}</div></div></div><div class="hotel-actions"><a href="${it.url || '#'}" target="_blank" class="hotel-btn book">查看详情</a></div></div>`;
    })
    .join('');
  panel.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'ota-actions';
  actions.innerHTML = `<button class="ota-act-btn f" onclick="pushLastOtaToFeishu()">📊 同步到飞书</button>`;
  panel.appendChild(actions);

  document.getElementById('messages').appendChild(panel);
  window._lastListItems = items;
  scrollBottom();
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function renderCreativeResult(title, data) {
  const cli = data.cli || {};
  const payload = cli.parsed != null ? cli.parsed : cli;
  let extra = '';
  if (data.fallbackFrom) {
    extra += `<div style="font-size:12px;color:#666;margin:8px 0">已降级：<strong>${escapeHtml(
      String(data.fallbackFrom)
    )}</strong>（即梦不可用或失败时自动尝试美图）</div>`;
  }
  if (data.jimengError && typeof data.jimengError === 'string') {
    extra += `<div style="font-size:11px;color:#999">即梦提示：${escapeHtml(data.jimengError.slice(0, 400))}</div>`;
  }
  const pre =
    typeof payload === 'object' && payload !== null
      ? JSON.stringify(payload, null, 2)
      : String(cli.raw || payload || '');
  const block = `<div class="tip-card" style="text-align:left;border-left-color:#00C9A7">
    <strong>${escapeHtml(title)}</strong> · 引擎 ${escapeHtml(String(data.engine || ''))}
    ${extra}
    <pre style="margin-top:10px;font-size:11px;overflow:auto;max-height:280px;background:#1a1a2e;color:#e8f4f8;padding:12px;border-radius:10px;border:1px solid rgba(0,201,167,0.25)">${escapeHtml(
      pre
    )}</pre>
    <div style="font-size:11px;color:#888;margin-top:8px">若 JSON 中含图片 URL，可复制到浏览器打开；CLI 未安装时会返回错误信息。</div>
  </div>`;
  addMsg(block, 'ai');
}

function renderTrendResult(data) {
  const rows = data.rows || [];
  if (!rows.length) {
    addMsg('未生成趋势数据', 'ai');
    return;
  }
  addMsg(`📈 <strong>${data.destName}</strong> 连续 ${rows.length} 天酒店最低价趋势（途牛+飞猪合并逻辑按日查询）`, 'ai');
  const panel = document.createElement('div');
  panel.className = 'price-trend';
  let bars = '';
  const maxP = Math.max(...rows.map((r) => r.lowestPrice || 0), 1);
  rows.forEach((r) => {
    const h = Math.round(((r.lowestPrice || 0) / maxP) * 80) + 8;
    bars += `<div class="trend-bar" style="height:${h}px" data-label="${r.date}"></div>`;
  });
  panel.innerHTML = `<div class="trend-title">📈 价格趋势</div><div class="trend-chart">${bars}</div><div class="trend-info">${rows
    .map((r) => `<span>${r.date}: <strong>¥${r.lowestPrice}</strong> (${r.count}家)</span>`)
    .join('')}</div>`;
  document.getElementById('messages').appendChild(panel);
}

async function pushLastOtaToFeishu() {
  const items = window._lastListItems;
  const hotels = currentHotels && currentHotels.length ? currentHotels : null;
  const rows = hotels || items;
  if (!rows || !rows.length) {
    alert('没有可同步的数据，请先查询');
    return;
  }
  const meta =
    currentQuery && currentQuery.checkIn
      ? {
          destName: currentQuery.dest,
          checkIn: currentQuery.checkIn,
          checkOut: currentQuery.checkOut,
        }
      : {};
  const kind = hotels ? 'hotel' : 'generic';
  const body =
    kind === 'hotel'
      ? { kind: 'hotel', rows, meta }
      : {
          kind: 'generic',
          typeLabel: lastOtaPayload?.type || 'OTA',
          rows: rows.map((r) => ({
            title: r.title || r.name,
            price: r.price,
            subtitle: r.time || r.duration || '',
          })),
        };
  try {
    const res = await fetch(`${API}/api/feishu/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (j.status !== 0) throw new Error(j.message);
    const url = j.data?.tableUrl;
    addMsg(
      `✅ 已写入飞书表格${url ? '：<a href="' + url + '" target="_blank">打开多维表格</a>' : ''}`,
      'ai'
    );
  } catch (e) {
    alert('飞书推送失败：' + e.message + '\n请配置 FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BASE_TOKEN / FEISHU_TABLE_ID，并在表格中创建列：类型、目的地、入住、离店、名称、平台、价格、链接、备注');
  }
}

async function callOTA(query) {
  const res = await fetch(`${API}/api/hotel/search?destName=${encodeURIComponent(query.dest)}&keyWords=${encodeURIComponent(query.hotelName)}&checkIn=${query.checkIn}&checkOut=${query.checkOut}`);
  return res.json();
}

function renderOTAResult(hotels, query, meta) {
  removeLoading();
  if (!hotels.length) {
    addMsg('未找到相关酒店', 'ai');
    return;
  }
  const { flyaiOK, tnCount, fyCount } = meta;
  const totalCount = hotels.length;
  const bestPrice = hotels[0]?.price || 0;
  const bestName = hotels[0]?.name || '';
  let summary = `✅ 查询完成！共 <strong>${totalCount}</strong> 家酒店<br>`;
  summary += `📍 ${query.dest} ${query.hotelName || ''} | ${query.checkIn} ~ ${query.checkOut}<br>`;
  summary += `🏆 最低价: <strong style="color:#FF6B35">¥${bestPrice.toLocaleString()}</strong> — ${bestName}<br>`;
  summary += `📊 途牛 ${tnCount}家 + 飞猪 ${fyCount}家`;
  if (flyaiOK) summary += '<br>💡 飞猪数据来自 flyai-cli';
  addMsg(summary, 'ai');

  const panel = document.createElement('div');
  panel.className = 'ota-panel';
  panel.innerHTML = `<div class="ota-head"><div class="ota-title-row"><span style="font-size:24px">🍅</span><div><div class="ota-title">${query.dest} ${query.hotelName || ''} 酒店比价</div><div class="ota-sub">${query.checkIn} ~ ${query.checkOut}</div></div></div><div class="ota-count-badge">${totalCount}家</div></div>`;
  const platDiv = document.createElement('div');
  platDiv.className = 'ota-platforms';
  platDiv.innerHTML = `<span class="platform-chip all active" onclick="filterHotels('all',this)">全部 (${totalCount})</span><span class="platform-chip tuniu" onclick="filterHotels('途牛',this)">途牛 (${tnCount})</span><span class="platform-chip fliggy" onclick="filterHotels('飞猪',this)">飞猪 (${fyCount})</span>`;
  panel.appendChild(platDiv);
  const list = document.createElement('div');
  list.className = 'hotels-list';
  list.id = 'hotelsList';
  list.innerHTML = hotels.map((h, i) => renderHotelCard(h, i, i === 0)).join('');
  panel.appendChild(list);
  const actions = document.createElement('div');
  actions.className = 'ota-actions';
  actions.innerHTML = `<button class="ota-act-btn" onclick="copyAllPrices()">📋 复制价格</button><button class="ota-act-btn" onclick="showFeishuPanel()">📊 飞书同步</button><button class="ota-act-btn" onclick="window.open('hotel-price-comparison.html?dest=${encodeURIComponent(query.dest)}','_blank')">🔍 完整比价页</button><button class="ota-act-btn" onclick="showPriceTrend()">📈 价格趋势</button>`;
  panel.appendChild(actions);
  document.getElementById('messages').appendChild(panel);
  window._allHotels = hotels;
  scrollBottom();
}

function renderHotelCard(h, i, isBest) {
  const pc = getPriceColor(h.price);
  const srcClass = h.src === '途牛' ? 't' : 'f';
  const rankClass = isBest ? 'gold' : 'num';
  const rankText = isBest ? '🏅' : i + 1;
  return `<div class="hotel-card ${isBest ? 'best' : ''} ${h.src === '途牛' ? 'tuniu' : 'fliggy'}" data-src="${h.src}"><div class="hotel-card-top"><div class="hotel-rank ${rankClass}">${rankText}</div><div class="hotel-name"><div class="hotel-name-text">${h.name}</div></div><span class="src-badge ${srcClass}">${h.src}</span></div><div class="hotel-card-body"><img src="${h.pic || ''}" class="hotel-pic ${!h.pic ? 'hidden' : ''}" onerror="this.classList.add('hidden')"><div class="hotel-details"><div class="hotel-addr">${h.address || ''}</div><div class="hotel-tags">${h.refund ? `<span class="hotel-tag">${h.refund}</span>` : ''}${h.meal ? `<span class="hotel-tag">${h.meal}</span>` : ''}</div></div><div class="hotel-right"><div class="hotel-price ${pc.cls}">¥${h.price.toLocaleString()}</div><div class="hotel-unit">起/晚</div></div></div><div class="hotel-actions"><a href="${h.url || '#'}" target="_blank" class="hotel-btn book">预订</a><button class="hotel-btn copy" onclick="event.stopPropagation();copyHotel(${i})">复制</button></div></div>`;
}

function filterHotels(src, el) {
  currentFilter = src;
  document.querySelectorAll('.platform-chip').forEach((c) => c.classList.remove('active'));
  el?.classList.add('active');
  const all = window._allHotels || [];
  const filtered = src === 'all' ? all : all.filter((h) => h.src === src);
  const list = document.getElementById('hotelsList');
  if (!list) return;
  const minP = all.length ? Math.min(...all.map((x) => x.price)) : 0;
  list.innerHTML = filtered
    .map((h) => {
      const gi = all.indexOf(h);
      const isBest = src === 'all' && h.price === minP;
      return renderHotelCard(h, gi, isBest);
    })
    .join('');
}

function copyHotel(index) {
  const hotels = window._allHotels || currentHotels;
  const h = hotels[index];
  if (!h) return;
  copyToClipboard(`${h.name}\t${h.src}\t¥${h.price}`, '已复制');
}

window.filterHotels = filterHotels;
window.copyHotel = copyHotel;
window.copyAllPrices = copyAllPrices;
window.showFeishuPanel = showFeishuPanel;
window.syncToFeishu = syncToFeishu;
window.showPriceTrend = showPriceTrend;
window.pushLastOtaToFeishu = pushLastOtaToFeishu;

function copyAllPrices() {
  const hotels = window._allHotels || currentHotels;
  if (!hotels.length) return;
  const text = hotels.map((h, i) => `${i + 1}. ${h.name}\t${h.src}\t¥${h.price}`).join('\n');
  copyToClipboard(`${currentQuery.dest} ${currentQuery.checkIn}~${currentQuery.checkOut}\n${text}`, '已复制');
}

function showFeishuPanel() {
  const hotels = window._allHotels || currentHotels;
  const panel = document.createElement('div');
  panel.className = 'feishu-panel';
  panel.id = 'feishuPanelEl';
  panel.innerHTML = `<div class="feishu-head"><div class="feishu-icon">📊</div><div class="feishu-title">飞书多维表格</div></div><div class="feishu-desc">将当前查询结果批量写入表格（需服务端配置 FEISHU_* 环境变量）</div><div class="feishu-btns"><button class="f-btn" onclick="syncToFeishu()">📋 推送当前数据</button></div><div id="feishuStatus" style="margin-top:12px;font-size:13px"></div>`;
  document.getElementById('messages').appendChild(panel);
  scrollBottom();
}

async function syncToFeishu() {
  const status = document.getElementById('feishuStatus');
  if (status) status.textContent = '推送中...';
  const hotels = window._allHotels || currentHotels;
  if (!hotels?.length && window._lastListItems?.length) {
    return pushLastOtaToFeishu();
  }
  if (!hotels?.length) {
    alert('暂无数据');
    return;
  }
  try {
    const res = await fetch(`${API}/api/feishu/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'hotel',
        rows: hotels,
        meta: {
          destName: currentQuery.dest,
          checkIn: currentQuery.checkIn,
          checkOut: currentQuery.checkOut,
        },
      }),
    });
    const j = await res.json();
    if (j.status !== 0) throw new Error(j.message);
    if (status) status.innerHTML = `✅ 成功 <a href="${j.data.tableUrl}" target="_blank">打开表格</a>`;
  } catch (e) {
    if (status) status.textContent = '失败: ' + e.message;
  }
}

function showPriceTrend() {
  document.getElementById('chatInput').value = `查${currentQuery.dest || '三亚'}酒店价格趋势`;
  sendMessage();
}

function addMsg(html, type) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  const inner = html.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  div.innerHTML = `<div class="bubble ${type}">${inner}</div>`;
  document.getElementById('messages').appendChild(div);
  scrollBottom();
}

function showLoading() {
  const div = document.createElement('div');
  div.id = 'loadingMsg';
  div.className = 'msg ai';
  div.innerHTML = '<div class="loading-box"><div class="loading-tomato">🍅</div><div class="loading-text">正在调用 ota-hotel-flight-query …</div></div>';
  document.getElementById('messages').appendChild(div);
  scrollBottom();
}

function removeLoading() {
  const el = document.getElementById('loadingMsg');
  if (el) el.remove();
}

function scrollBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => showToast(label)).catch(() => alert(text));
}

function showToast(msg) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:999';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function loadHistory() {
  try {
    const s = localStorage.getItem('ota_chat_history');
    chatHistory = s ? JSON.parse(s) : [];
    renderHistory();
  } catch (e) {}
}

function addToHistory(msg) {
  const title = msg.substring(0, 30) + (msg.length > 30 ? '...' : '');
  chatHistory.unshift({ msg, title, time: Date.now() });
  if (chatHistory.length > 50) chatHistory.pop();
  try {
    localStorage.setItem('ota_chat_history', JSON.stringify(chatHistory));
  } catch (e) {}
  renderHistory();
}

function renderHistory() {
  const el = document.getElementById('chatHistoryList');
  if (!chatHistory.length) {
    el.innerHTML = '<div class="ch-empty">暂无历史记录</div>';
    return;
  }
  el.innerHTML = chatHistory
    .map(
      (h, i) => `
    <div class="ch-item ${i === 0 ? 'active' : ''}" data-msg="${encodeURIComponent(h.msg)}">
      <div class="ch-time">${new Date(h.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
      <div class="ch-title">${escapeHtml(h.title)}</div>
    </div>`
    )
    .join('');
  el.querySelectorAll('.ch-item').forEach((node) => {
    node.onclick = () => {
      document.getElementById('chatInput').value = decodeURIComponent(node.getAttribute('data-msg'));
    };
  });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function toggleQuickPanel() {
  document.getElementById('quickPanel').classList.toggle('show');
}

function setMode(mode, el) {
  currentMode.mode = mode;
  document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
  el?.classList.add('active');
}

function fillQuick(text) {
  document.getElementById('chatInput').value = text;
  document.getElementById('chatInput').focus();
}

function fillAndSearch(dest) {
  document.getElementById('chatInput').value = `查${dest}酒店价格`;
  document.getElementById('quickPanel').classList.remove('show');
  setTimeout(() => sendMessage(), 100);
}

function useTool(tool) {
  const map = {
    hotel: '查三亚酒店价格',
    flight: '查北京到三亚机票',
    train: '查北京到上海火车票',
    ticket: '查三亚蜈支洲岛门票',
    cruise: '查邮轮产品',
    holiday: '查三亚跟团度假产品',
    feishu: '同步到飞书',
    trend: '查三亚酒店价格趋势',
    image: '生图：热带海岛日落旅行海报',
    edit: '改图 水彩插画风格 https://',
    video: '视频：15秒三亚旅拍预告片',
  };
  fillQuick(map[tool] || '查三亚酒店价格');
}

function handleFile(el) {
  if (el.files?.length) addMsg('📎 已选择: ' + el.files[0].name, 'user');
}

function showDailyPrices() {
  fillQuick('查三亚酒店价格趋势');
}

(function () {
  const params = new URLSearchParams(location.search);
  const dest = params.get('dest');
  if (dest) setTimeout(() => fillAndSearch(dest), 500);
})();
