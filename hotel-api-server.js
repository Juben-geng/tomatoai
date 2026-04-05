#!/usr/bin/env node
/**
 * 番茄旅行 OTA 统一 API 服务
 * 途牛 tuniu-cli + 飞猪 @fly-ai/flyai-cli
 * 启动: node hotel-api-server.js  或  npm start
 */
const http = require('http');
const path = require('path');
const fs = require('fs');
const url = require('url');

const ota = require('./lib/ota_engine');
const feishu = require('./lib/feishu_open');
const member = require('./lib/membership_store');
const creative = require('./lib/creative_pipeline');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'tomato-admin-dev';

const CORS_JSON = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Member-Key, x-admin-secret, X-Tomato-Vip',
};

function sendJSON(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...CORS_JSON,
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function getMemberKey(req) {
  const h = req.headers['x-member-key'] || req.headers['X-Member-Key'];
  return h && String(h).trim() ? String(h).trim() : '';
}

function parseCliCreative(raw) {
  if (!raw || typeof raw !== 'string') return { parsed: null, raw: '' };
  const t = raw.trim();
  try {
    const parsed = JSON.parse(t);
    return { parsed, raw: t };
  } catch (e) {
    const m = t.match(/\{[\s\S]*\}\s*$/);
    if (m) {
      try {
        return { parsed: JSON.parse(m[0]), raw: t };
      } catch (e2) {}
    }
    return { parsed: { message: t }, raw: t };
  }
}

function adminOk(req) {
  const s = req.headers['x-admin-secret'] || req.headers['X-Admin-Secret'];
  return s && String(s) === ADMIN_SECRET;
}

function sendFile(res, filePath, root) {
  const fullPath = path.join(root || __dirname, filePath);
  const ext = path.extname(fullPath).toLowerCase();
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
  };
  const mime = MIME[ext] || 'text/plain; charset=utf-8';
  try {
    const content = fs.readFileSync(fullPath);
    res.writeHead(200, {
      'Content-Type': mime,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function defaultDates() {
  const today = new Date();
  const out = new Date(today);
  out.setDate(out.getDate() + 2);
  return {
    checkIn: today.toISOString().slice(0, 10),
    checkOut: out.toISOString().slice(0, 10),
  };
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_JSON);
    res.end();
    return;
  }

  try {
    if (pathname === '/health') {
      const flyaiPath = ota.getFlyaiCliPath();
      const hasKey = !!process.env.TUNIU_API_KEY;
      sendJSON(res, 200, {
        status: 'ok',
        service: '番茄旅行OTA',
        skill: 'ota-hotel-flight-query',
        tuniuApiKey: hasKey ? 'configured' : 'missing',
        tuniuCli: 'use `tuniu list` locally',
        flyai: flyaiPath ? 'available' : 'not-found',
        flyaiPath: flyaiPath || null,
        feishu: process.env.FEISHU_APP_ID && process.env.FEISHU_BASE_TOKEN ? 'configured' : 'optional',
        membership: 'enabled',
        creative: '/api/creative/image',
        time: new Date().toISOString(),
      });
      return;
    }

    // —— 会员：公开配置 / 当前用户 / 演示充值 ——
    if (pathname === '/api/member/config' && req.method === 'GET') {
      sendJSON(res, 200, { status: 0, data: member.publicConfig() });
      return;
    }

    if (pathname === '/api/member/me' && req.method === 'GET') {
      const mk = getMemberKey(req) || (parsedUrl.query && parsedUrl.query.key) || '';
      if (!mk) {
        sendJSON(res, 200, { status: 0, data: { anonymous: true, hint: '传 X-Member-Key 或使用 ?key=' } });
        return;
      }
      sendJSON(res, 200, { status: 0, data: member.publicUser(mk) });
      return;
    }

    if (pathname === '/api/member/recharge' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      if (!mk) {
        sendJSON(res, 400, { status: 1, message: '缺少 X-Member-Key 或 memberKey' });
        return;
      }
      const r = member.applyRechargePackage(mk, body.packageId || body.id);
      if (!r.ok) {
        sendJSON(res, 400, { status: 1, message: '套餐不存在', detail: r });
        return;
      }
      sendJSON(res, 200, { status: 0, message: 'demo_recharge_ok', data: r });
      return;
    }

    // 生图 / 改图（即梦 → 美图降级）
    if (pathname === '/api/creative/image' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      const action = body.action === 'edit' ? 'edit' : 'generate';
      const kind = action === 'edit' ? 'imageEdit' : 'imageGen';
      if (!mk) {
        sendJSON(res, 401, { status: 1, message: '请先获取会员密钥：打开助手页自动分配，或传 X-Member-Key' });
        return;
      }
      const c = member.tryConsume(mk, kind);
      if (!c.ok) {
        sendJSON(res, 402, {
          status: 1,
          message: '额度或积分不足',
          code: 'PAYMENT_REQUIRED',
          detail: c,
        });
        return;
      }
      const result = creative.runImage({
        action,
        prompt: body.prompt || '',
        imageUrl: body.imageUrl || body.image || '',
        provider: body.provider || 'auto',
      });
      const parsed = parseCliCreative(result.raw || '');
      sendJSON(res, result.ok ? 200 : 500, {
        status: result.ok ? 0 : 1,
        message: result.ok ? 'ok' : result.error || 'creative_failed',
        data: {
          engine: result.engine,
          provider: result.provider,
          fallbackFrom: result.fallbackFrom,
          jimengError: result.jimengError,
          cli: parsed,
          consume: c,
        },
      });
      return;
    }

    // 视频能力预检（扣积分/配额）
    if (pathname === '/api/creative/video-reserve' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const mk = getMemberKey(req) || body.memberKey || '';
      if (!mk) {
        sendJSON(res, 401, { status: 1, message: '缺少 X-Member-Key' });
        return;
      }
      const c = member.tryConsume(mk, 'videoGen');
      if (!c.ok) {
        sendJSON(res, 402, { status: 1, message: '视频额度不足', detail: c });
        return;
      }
      sendJSON(res, 200, { status: 0, message: 'reserved', data: { consume: c, user: member.publicUser(mk) } });
      return;
    }

    // 管理端：会员与积分
    if (pathname === '/api/admin/membership' && (req.method === 'POST' || req.method === 'GET')) {
      if (!adminOk(req)) {
        sendJSON(res, 403, { status: 1, message: '需要 x-admin-secret' });
        return;
      }
      if (req.method === 'GET') {
        const st = member.getState();
        sendJSON(res, 200, {
          status: 0,
          data: { config: st.config, userCount: Object.keys(st.users || {}).length, users: st.users },
        });
        return;
      }
      const body = await readJsonBody(req);
      const act = body.action || 'updateConfig';
      if (act === 'updateConfig') {
        member.updateConfig(body.config || body);
        sendJSON(res, 200, { status: 0, data: member.publicConfig() });
        return;
      }
      if (act === 'setUser') {
        const mk = body.memberKey;
        if (!mk) {
          sendJSON(res, 400, { status: 1, message: 'memberKey 必填' });
          return;
        }
        if (body.tierId) member.setTier(mk, body.tierId);
        if (body.pointsDelta != null) member.addPoints(mk, Number(body.pointsDelta));
        if (body.points != null) {
          const u = member.ensureUser(mk);
          u.points = Math.max(0, Number(body.points));
          member.persist();
        }
        sendJSON(res, 200, { status: 0, data: member.publicUser(mk) });
        return;
      }
      sendJSON(res, 400, { status: 1, message: 'unknown action' });
      return;
    }

    // 统一 OTA 查询 POST /api/ota/query  { type, ... }
    if (pathname === '/api/ota/query' && (req.method === 'POST' || req.method === 'GET')) {
      let body = {};
      if (req.method === 'POST') {
        body = await readJsonBody(req);
      } else {
        body = query;
      }

      const mkOta = getMemberKey(req) || body.memberKey || '';
      if (mkOta) {
        const oc = member.tryConsume(mkOta, 'otaQuery');
        if (!oc.ok) {
          sendJSON(res, 402, {
            status: 1,
            message: 'OTA 查询次数或积分不足',
            code: 'OTA_QUOTA',
            detail: oc,
          });
          return;
        }
      }

      const type = body.type || query.type || 'hotel';
      const d = defaultDates();

      let result;
      switch (type) {
        case 'hotel': {
          const destName = body.destName || body.cityName || query.destName || '三亚';
          const keyWords = body.keyWords || body.hotelName || query.keyWords || '';
          const checkIn = body.checkIn || query.checkIn || d.checkIn;
          const checkOut = body.checkOut || query.checkOut || d.checkOut;
          result = await ota.searchHotels({ destName, keyWords, checkIn, checkOut });
          break;
        }
        case 'flight': {
          const fromCity = body.fromCity || body.from || query.fromCity || '北京';
          const toCity = body.toCity || body.to || query.toCity || '三亚';
          const date = body.date || query.date || d.checkIn;
          result = await ota.searchFlights({ fromCity, toCity, date });
          break;
        }
        case 'train': {
          const fromCity = body.fromCity || body.from || query.fromCity || '北京';
          const toCity = body.toCity || body.to || query.toCity || '上海';
          const date = body.date || query.date || d.checkIn;
          result = await ota.searchTrains({ fromCity, toCity, date });
          break;
        }
        case 'ticket': {
          const cityName = body.cityName || body.city_name || query.cityName || '三亚';
          const scenicName = body.scenicName || body.scenic_name || query.scenicName || '蜈支洲岛';
          result = await ota.searchTickets({ cityName, scenicName });
          break;
        }
        case 'cruise': {
          const departsDateBegin = body.departsDateBegin || query.departsDateBegin || d.checkIn;
          const departsDateEnd = body.departsDateEnd || query.departsDateEnd || d.checkOut;
          result = await ota.searchCruises({ departsDateBegin, departsDateEnd });
          break;
        }
        case 'holiday': {
          const destinationName = body.destinationName || body.destName || query.destinationName || '三亚';
          const departsDateBegin = body.departsDateBegin || query.departsDateBegin || d.checkIn;
          const departsDateEnd = body.departsDateEnd || query.departsDateEnd || d.checkOut;
          result = await ota.searchHolidays({ destinationName, departsDateBegin, departsDateEnd });
          break;
        }
        case 'trend': {
          const destName = body.destName || query.destName || '三亚';
          const checkIn = body.checkIn || query.checkIn || d.checkIn;
          const days = Number(body.days || query.days || 7);
          result = await ota.priceTrendHotel({ destName, checkIn, days });
          break;
        }
        default:
          sendJSON(res, 400, { status: 1, message: unknownType(type) });
          return;
      }

      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: result,
        meta: {
          skill: 'ota-hotel-flight-query',
          feishuBaseUrl: feishu.getConfiguredBaseUrl(),
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 酒店 GET（兼容旧前端）
    if (pathname === '/api/hotel/search' && req.method === 'GET') {
      const destName = query.destName || '三亚';
      const keyWords = query.keyWords || query.hotelName || '';
      const checkIn = query.checkIn || defaultDates().checkIn;
      const checkOut = query.checkOut || defaultDates().checkOut;
      const data = await ota.searchHotels({ destName, keyWords, checkIn, checkOut });
      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: {
          destName: data.destName,
          keyWords: data.keyWords,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          hotels: data.hotels,
        },
        meta: {
          total: data.hotels.length,
          tuniuCount: data.meta.tuniuCount,
          flyaiCount: data.meta.flyaiCount,
          tuniuSuccess: data.meta.tuniuSuccess,
          flyaiSuccess: data.meta.flyaiSuccess,
          skill: 'ota-hotel-flight-query',
          feishuBaseUrl: feishu.getConfiguredBaseUrl(),
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    // 飞书推送
    if (pathname === '/api/feishu/push' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const kind = body.kind || 'hotel';
      const rows = body.rows || body.hotels || [];
      if (!rows.length) {
        sendJSON(res, 400, { status: 1, message: 'rows 不能为空' });
        return;
      }
      let records;
      if (kind === 'hotel') {
        records = feishu.buildHotelQuoteRecords(rows, body.meta || {});
      } else {
        records = feishu.buildGenericRecords(rows, body.typeLabel || 'OTA');
      }
      const data = await feishu.batchCreateRecords(records);
      const baseUrl = feishu.getConfiguredBaseUrl();
      sendJSON(res, 200, {
        status: 0,
        message: 'success',
        data: {
          feishu: data,
          tableUrl: baseUrl,
          hint: baseUrl ? '已写入多维表格，请点击链接查看' : '请配置 FEISHU_BASE_URL 以生成直达链接',
        },
      });
      return;
    }

    // 兼容旧 GET
    if (pathname === '/api/feishu/write' && req.method === 'GET') {
      sendJSON(res, 200, {
        status: 0,
        message: '请使用 POST /api/feishu/push 推送数据',
        data: { doc: 'https://open.feishu.cn/document/server-docs/docs/bitable-v1/app-table-record/batch_create' },
      });
      return;
    }

    // 静态
    const staticFile = pathname.replace(/^\//, '');
    if (pathname.startsWith('/api/')) {
      sendJSON(res, 404, { status: 1, message: 'API 不存在: ' + pathname });
      return;
    }
    if (staticFile && fs.existsSync(path.join(__dirname, staticFile))) {
      sendFile(res, staticFile, __dirname);
      return;
    }

    sendFile(res, 'index.html', __dirname);
  } catch (err) {
    console.error('[API]', err);
    sendJSON(res, 500, { status: 1, message: err.message || String(err) });
  }
});

function unknownType(t) {
  return `未知 type: ${t}`;
}

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  🍅 番茄旅行 OTA API 已启动               ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  http://${HOST}:${PORT}`);
  console.log('║  GET  /health');
  console.log('║  GET  /api/hotel/search');
  console.log('║  POST /api/ota/query  { type: hotel|flight|... }');
  console.log('║  POST /api/feishu/push');
  console.log('║  GET  /api/member/config   GET /api/member/me');
  console.log('║  POST /api/creative/image  POST /api/creative/video-reserve');
  console.log('║  POST /api/admin/membership (x-admin-secret)');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
