/**
 * 飞书开放平台 — 多维表格写入（tenant_access_token + bitable batch_create）
 * 文档: https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create
 *
 * 环境变量:
 *   FEISHU_APP_ID
 *   FEISHU_APP_SECRET
 *   FEISHU_BASE_TOKEN  (多维表格 app_token，URL 中 base 后一段)
 *   FEISHU_TABLE_ID
 *   FEISHU_BASE_URL    (可选，用于生成分享链接，如 https://xxx.feishu.cn/base/xxx)
 */

const FEISHU_API = 'https://open.feishu.cn/open-apis';

let tokenCache = { token: null, expire: 0 };

async function getTenantAccessToken() {
  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error('未配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
  }
  const now = Date.now();
  if (tokenCache.token && tokenCache.expire > now + 60000) {
    return tokenCache.token;
  }
  const res = await fetch(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const j = await res.json();
  if (j.code !== 0) {
    throw new Error(j.msg || `飞书 token 失败 code=${j.code}`);
  }
  tokenCache = {
    token: j.tenant_access_token,
    expire: now + (j.expire || 7000) * 1000,
  };
  return tokenCache.token;
}

/**
 * @param {Array<{fields: object}>} records Feishu 列名需与多维表格字段名一致
 */
async function batchCreateRecords(records) {
  const appToken = process.env.FEISHU_BASE_TOKEN;
  const tableId = process.env.FEISHU_TABLE_ID;
  if (!appToken || !tableId) {
    throw new Error('未配置 FEISHU_BASE_TOKEN / FEISHU_TABLE_ID');
  }
  if (!records?.length) {
    throw new Error('records 为空');
  }
  const token = await getTenantAccessToken();
  const url = `${FEISHU_API}/bitable/v1/apps/${encodeURIComponent(appToken)}/tables/${encodeURIComponent(tableId)}/records/batch_create`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({ records }),
  });
  const j = await res.json();
  if (j.code !== 0) {
    throw new Error(j.msg || JSON.stringify(j));
  }
  return j.data;
}

/**
 * 将 OTA 比价行转为飞书字段（默认字段名，用户可在表格中创建同名列）
 */
function buildHotelQuoteRecords(rows, meta = {}) {
  const fieldMap = {
    类型: (r) => r.type || '酒店比价',
    目的地: () => meta.destName || '',
    入住: () => meta.checkIn || '',
    离店: () => meta.checkOut || '',
    名称: (r) => r.name || '',
    平台: (r) => r.src || r.platform || '',
    价格: (r) => r.price,
    链接: (r) => (r.url || '').toString(),
    备注: (r) => r.address || '',
  };

  const keys = Object.keys(fieldMap);
  return rows.map((r) => ({
    fields: Object.fromEntries(keys.map((k) => [k, fieldMap[k](r)])),
  }));
}

function buildGenericRecords(items, typeLabel) {
  return items.map((item) => ({
    fields: {
      类型: typeLabel,
      摘要: typeof item.title === 'string' ? item.title : JSON.stringify(item).slice(0, 500),
      价格: item.price != null ? item.price : '',
      详情: item.subtitle || item.time || '',
    },
  }));
}

function getConfiguredBaseUrl() {
  const t = process.env.FEISHU_BASE_TOKEN;
  const custom = process.env.FEISHU_BASE_URL;
  if (custom) return custom.replace(/\/$/, '');
  if (t) return `https://www.feishu.cn/base/${t}`;
  return '';
}

module.exports = {
  getTenantAccessToken,
  batchCreateRecords,
  buildHotelQuoteRecords,
  buildGenericRecords,
  getConfiguredBaseUrl,
};
