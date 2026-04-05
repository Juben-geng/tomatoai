/**
 * 番茄旅行 OTA 统一引擎：途牛 CLI + 飞猪 flyai-cli
 */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { promisify } = require('util');
const { callTuniuCli } = require('./tuniu_cli');

function getFlyaiCliPath() {
  const candidates = [
    path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.cjs'),
    path.join(process.env.HOME || '', '.npm-global', 'lib', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.cjs'),
  ];
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return p;
    } catch (e) {}
  }
  return null;
}

const FLYAI_CLI_PATH = getFlyaiCliPath() || path.join(
  process.env.APPDATA || '',
  'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.cjs'
);

function getPriceLevel(price) {
  const p = parseInt(String(price).replace(/[^\d]/g, ''), 10) || 0;
  if (p <= 500) return '🟢 经济';
  if (p <= 1500) return '🟠 舒适';
  if (p <= 3000) return '🔴 高档';
  return '🟣 豪华';
}

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  const match = String(priceStr).match(/[\d,]+/);
  return match ? parseInt(match[0].replace(/,/g, ''), 10) : 0;
}

function parseFlyaiOutput(rawOutput) {
  // 飞猪CLI输出可能包含多个JSON对象（由node的assertion错误分隔）
  // 尝试在 "}{" 边界分割，然后重组每个完整JSON
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch (e) { return null; }
  };
  // 方法1: 找第一个 { 开始，截取到最后一个 } 结束，再试
  const firstBrace = rawOutput.indexOf('{');
  const lastBrace = rawOutput.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = rawOutput.substring(firstBrace, lastBrace + 1);
    const parsed = tryParse(candidate);
    if (parsed && parsed.data?.itemList) return parsed;
  }
  // 方法2: 按 "}{" 分割（JSON边界）
  const parts = rawOutput.split(/\}\s*\{/);
  for (const p of parts) {
    const candidate = (p.startsWith('{') ? '' : '{') + p + (p.endsWith('}') ? '' : '}');
    const parsed = tryParse(candidate);
    if (parsed && (parsed.data?.itemList || parsed.data?.hotels || parsed.data?.list)) {
      return parsed;
    }
  }
  // 方法3: 遍历找第一个包含 itemList 的
  let depth = 0, start = -1;
  for (let i = 0; i < rawOutput.length; i++) {
    if (rawOutput[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (rawOutput[i] === '}') {
      depth--;
      if (depth === 0) {
        const candidate = rawOutput.substring(start, i + 1);
        const parsed = tryParse(candidate);
        if (parsed && (parsed.data?.itemList || parsed.data?.hotels)) return parsed;
        start = -1;
      }
    }
  }
  throw new Error('飞猪输出中无法解析有效的JSON');
}

function transformFlyaiHotels(flyaiData) {
  if (!flyaiData.data?.itemList) return [];
  return flyaiData.data.itemList.map((h, i) => ({
    id: `fy_${h.shId || i}`,
    name: h.name || '',
    star: h.star || '',
    price: parsePrice(h.price),
    priceStr: h.price || '¥0',
    score: h.score || '',
    scoreDesc: h.scoreDesc || '',
    src: '飞猪',
    srcTag: 'f',
    address: h.address || '',
    review: h.review || '',
    interestsPoi: h.interestsPoi || '',
    pic: h.mainPic || '',
    url: h.detailUrl || '',
    decorationTime: h.decorationTime || '',
    brandName: h.brandName || '',
    refund: '',
    meal: '',
    level: getPriceLevel(parsePrice(h.price)),
    rank: i + 1,
  }));
}

function callFlyaiCliAsync(destName, keyWords, checkIn, checkOut) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(FLYAI_CLI_PATH)) {
      reject(new Error('flyai-cli 未安装'));
      return;
    }
    const args = [
      FLYAI_CLI_PATH,
      'search-hotels',
      '--dest-name', destName,
      '--check-in-date', checkIn,
      '--check-out-date', checkOut,
    ];
    if (keyWords) args.push('--key-words', keyWords);

    const proc = spawn(process.execPath, args, { windowsHide: true });

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stdout += d.toString(); });
    const to = setTimeout(() => {
      try {
        proc.kill();
      } catch (e) {}
      reject(new Error('飞猪查询超时 30s'));
    }, 30000);
    proc.on('error', (e) => {
      clearTimeout(to);
      reject(e);
    });
    proc.on('close', () => {
      clearTimeout(to);
      resolve(stdout);
    });
  });
}

/** 途牛酒店 -> 统一结构 */
function mapTuniuHotels(hotels) {
  if (!Array.isArray(hotels)) return [];
  return hotels.map((h, i) => ({
    id: `tn_${h.hotelId || i}`,
    name: h.hotelName || h.name || '',
    star: h.starName || h.star || '',
    price: h.lowestPrice ?? h.price ?? 0,
    priceStr: `¥${(h.lowestPrice ?? h.price ?? 0).toLocaleString()}起`,
    score: h.commentScore ? `${h.commentScore}分` : h.score || '',
    src: '途牛',
    srcTag: 't',
    address: h.address || '',
    pic: h.firstPic || h.pic || '',
    url: h.url || `https://hotel.tuniu.com/hotel-booking/search?keyword=${encodeURIComponent(h.hotelName || h.name || '')}`,
    refund: h.refund || '',
    meal: h.meal || '',
    level: getPriceLevel(h.lowestPrice ?? h.price ?? 0),
    rank: i + 1,
  }));
}

function getMockTuniuHotels(destName) {
  const mockData = {
    三亚: [
      { id: 'tn_1', name: '三亚天域度假酒店', star: '豪华型', price: 1288, score: '4.8', src: '途牛', srcTag: 't', address: '三亚市亚龙湾', url: 'https://hotel.tuniu.com', pic: '', refund: '', meal: '', level: '🔴 高档' },
      { id: 'tn_2', name: '三亚亚特兰蒂斯酒店', star: '奢华型', price: 3888, score: '4.9', src: '途牛', srcTag: 't', address: '三亚市海棠湾', url: 'https://hotel.tuniu.com', pic: '', refund: '', meal: '', level: '🟣 豪华' },
    ],
  };
  const key = Object.keys(mockData).find((k) => destName.includes(k)) || '三亚';
  return mockData[key] || mockData['三亚'];
}

function extractArray(inner, names) {
  for (const n of names) {
    if (Array.isArray(inner[n])) return inner[n];
  }
  if (inner.data && Array.isArray(inner.data)) return inner.data;
  return [];
}

function normalizeFlights(inner) {
  const list = extractArray(inner, ['flights', 'flightList', 'list']);
  return list.map((f, i) => {
    const price = Number(f.basePrice ?? f.price ?? f.lowestPrice ?? f.totalPrice ?? 0) || 0;
    return {
      id: `fl_${i}`,
      title: `${f.flightNumber || f.flightNo || '航班'} ${f.departureCityName || f.fromCity || ''}→${f.arrivalCityName || f.toCity || ''}`,
      airline: f.airlineName || f.airline || '',
      price,
      time: `${f.departureTime || f.departTime || '--'} - ${f.arrivalTime || f.arriveTime || '--'}`,
      src: '途牛',
      url: f.bookingUrl || f.url || 'https://www.tuniu.com',
      raw: f,
    };
  }).sort((a, b) => a.price - b.price);
}

function normalizeTrains(inner) {
  const list = extractArray(inner, ['trains', 'trainList', 'list']);
  return list.map((t, i) => {
    const price = Number(t.price ?? t.minPrice ?? t.lowestPrice ?? 0) || 0;
    return {
      id: `tr_${i}`,
      title: `${t.trainNo || t.trainNumber || '车次'} ${t.departureStation || ''}→${t.arrivalStation || ''}`,
      price,
      time: `${t.departureTime || '--'} - ${t.arrivalTime || '--'}`,
      duration: t.duration || t.runTime || '',
      type: t.trainType || '',
      src: '途牛',
      url: 'https://www.tuniu.com',
      raw: t,
    };
  }).sort((a, b) => a.price - b.price);
}

function normalizeTickets(inner) {
  const list = extractArray(inner, ['tickets', 'ticketList', 'products', 'list']);
  return list.map((t, i) => ({
    id: `tk_${i}`,
    title: t.name || t.scenicName || t.title || `门票${i + 1}`,
    price: Number(t.price ?? t.lowestPrice ?? t.salePrice ?? 0) || 0,
    type: t.type || t.ticketType || '门票',
    src: '途牛',
    url: t.url || 'https://www.tuniu.com',
    raw: t,
  })).sort((a, b) => a.price - b.price);
}

function normalizeCruises(inner) {
  const list = extractArray(inner, ['cruises', 'cruiseList', 'products', 'list']);
  return list.map((c, i) => ({
    id: `cr_${i}`,
    title: c.name || c.productName || c.title || `邮轮${i + 1}`,
    price: Number(c.price ?? c.lowestPrice ?? c.minPrice ?? 0) || 0,
    route: c.routeName || c.lineName || '',
    src: '途牛',
    url: c.url || 'https://www.tuniu.com',
    raw: c,
  })).sort((a, b) => a.price - b.price);
}

function normalizeHolidays(inner) {
  const list = extractArray(inner, ['products', 'holidayList', 'list', 'dataList']);
  return list.map((p, i) => ({
    id: `hd_${i}`,
    title: p.productName || p.name || p.title || `度假产品${i + 1}`,
    price: Number(p.price ?? p.minPrice ?? p.lowestPrice ?? p.adultPrice ?? 0) || 0,
    days: p.travelDays || p.days || '',
    dest: p.destinationName || p.destName || '',
    src: '途牛',
    url: p.url || p.detailUrl || 'https://www.tuniu.com',
    raw: p,
  })).sort((a, b) => a.price - b.price);
}

async function searchHotels({ destName, keyWords, checkIn, checkOut }) {
  const cityName = destName || '三亚';
  const ci = checkIn;
  const co = checkOut;

  let tuniuHotels = [];
  let tuniuSuccess = false;
  const tn = callTuniuCli('hotel', 'tuniu_hotel_search', {
    cityName,
    checkIn: ci,
    checkOut: co,
  });

  if (tn.ok && tn.data) {
    const hotels = tn.data.hotels || (Array.isArray(tn.data.data) ? tn.data.data : null);
    if (Array.isArray(hotels) && hotels.length) {
      tuniuHotels = mapTuniuHotels(hotels);
      tuniuSuccess = true;
    }
  }

  if (!tuniuSuccess) {
    tuniuHotels = getMockTuniuHotels(cityName);
    console.warn('[OTA] 途牛酒店使用备用数据:', tn.error || 'no hotels');
  }

  let flyaiHotels = [];
  let flyaiSuccess = false;
  if (fs.existsSync(FLYAI_CLI_PATH)) {
    try {
      const raw = await callFlyaiCliAsync(cityName, keyWords || '', ci, co);
      const flyaiData = parseFlyaiOutput(raw);
      if (flyaiData.status === 0 && flyaiData.data?.itemList?.length) {
        flyaiHotels = transformFlyaiHotels(flyaiData);
        flyaiSuccess = true;
      }
    } catch (e) {
      console.warn('[OTA] 飞猪:', e.message);
    }
  }

  let allHotels = [...tuniuHotels];
  if (flyaiSuccess && flyaiHotels.length) {
    const names = new Set(tuniuHotels.map((h) => h.name));
    allHotels = allHotels.concat(flyaiHotels.filter((h) => !names.has(h.name)));
  }

  if (keyWords) {
    allHotels = allHotels.filter(
      (h) => h.name.includes(keyWords) || keyWords.includes((h.name || '').substring(0, 4))
    );
  }

  allHotels.sort((a, b) => a.price - b.price);
  allHotels.forEach((h, i) => {
    h.rank = i + 1;
    if (i === 0) h.isLowest = true;
  });

  return {
    type: 'hotel',
    destName: cityName,
    keyWords: keyWords || '',
    checkIn: ci,
    checkOut: co,
    hotels: allHotels,
    meta: {
      tuniuSuccess,
      flyaiSuccess,
      tuniuCount: tuniuHotels.length,
      flyaiCount: flyaiHotels.length,
      tuniuError: tuniuSuccess ? null : (tn.error || null),
    },
  };
}

async function searchFlights({ fromCity, toCity, date }) {
  const from = fromCity || '北京';
  const to = toCity || '三亚';
  const r = callTuniuCli('flight', 'searchLowestPriceFlight', {
    departureCityName: from,
    arrivalCityName: to,
    departureDate: date,
  });
  let items = [];
  let success = false;
  if (r.ok && r.data) {
    items = normalizeFlights(r.data);
    if (items.length) success = true;
  }
  if (!success) {
    console.warn('[OTA] 机票途牛API失败，使用备用数据:', r.error);
    items = getMockFlights(from, to, date);
  }
  return {
    type: 'flight',
    fromCity: from,
    toCity: to,
    date,
    items,
    meta: { total: items.length, source: success ? '途牛' : '途牛(备用数据)', success },
    rawMessage: r.data?.message,
  };
}

async function searchTrains({ fromCity, toCity, date }) {
  const from = fromCity || '北京';
  const to = toCity || '上海';
  const r = callTuniuCli('train', 'searchLowestPriceTrain', {
    departureCityName: from,
    arrivalCityName: to,
    departureDate: date,
  });
  let items = [];
  let success = false;
  if (r.ok && r.data) {
    items = normalizeTrains(r.data);
    if (items.length) success = true;
  }
  if (!success) {
    console.warn('[OTA] 火车途牛API失败，使用备用数据:', r.error);
    items = getMockTrains(from, to, date);
  }
  return {
    type: 'train',
    fromCity: from,
    toCity: to,
    date,
    items,
    meta: { total: items.length, source: success ? '途牛' : '途牛(备用数据)', success },
  };
}

async function searchTickets({ cityName, scenicName }) {
  const city = cityName || '三亚';
  const scenic = scenicName || '蜈支洲岛';
  const r = callTuniuCli('ticket', 'query_cheapest_tickets', {
    city_name: city,
    scenic_name: scenic,
  });
  let items = [];
  let success = false;
  if (r.ok && r.data) {
    items = normalizeTickets(r.data);
    if (items.length) success = true;
  }
  if (!success) {
    console.warn('[OTA] 门票途牛API失败，使用备用数据:', r.error);
    items = getMockTickets(city, scenic);
  }
  return {
    type: 'ticket',
    cityName: city,
    scenicName: scenic,
    items,
    meta: { total: items.length, source: success ? '途牛' : '途牛(备用数据)', success },
  };
}

async function searchCruises({ departsDateBegin, departsDateEnd }) {
  const r = callTuniuCli('cruise', 'searchCruiseList', {
    departsDateBegin,
    departsDateEnd,
  });
  let items = [];
  let success = false;
  if (r.ok && r.data) {
    items = normalizeCruises(r.data);
    if (items.length) success = true;
  }
  if (!success) {
    console.warn('[OTA] 邮轮途牛API失败，使用备用数据:', r.error);
    items = getMockCruises();
  }
  return {
    type: 'cruise',
    departsDateBegin,
    departsDateEnd,
    items,
    meta: { total: items.length, source: success ? '途牛' : '途牛(备用数据)', success },
  };
}

async function searchHolidays({ destinationName, departsDateBegin, departsDateEnd }) {
  const dest = destinationName || '三亚';
  const r = callTuniuCli('holiday', 'searchHolidayList', {
    destinationName: dest,
    departsDateBegin,
    departsDateEnd,
  });
  let items = [];
  let success = false;
  if (r.ok && r.data) {
    items = normalizeHolidays(r.data);
    if (items.length) success = true;
  }
  if (!success) {
    console.warn('[OTA] 度假途牛API失败，使用备用数据:', r.error);
    items = getMockHolidays(dest);
  }
  return {
    type: 'holiday',
    destinationName: dest,
    departsDateBegin,
    departsDateEnd,
    items,
    meta: { total: items.length, source: success ? '途牛' : '途牛(备用数据)', success },
  };
}

// ============ 备用数据（途牛API失败时使用）============

function getMockFlights(from, to, date) {
  const flights = [
    { id: 'fl_1', title: `CA1234 北京→${to}`, airline: '国航', price: 980, time: '08:00 - 11:30', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
    { id: 'fl_2', title: `MU5678 北京→${to}`, airline: '东航', price: 860, time: '09:30 - 13:00', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
    { id: 'fl_3', title: `CZ3456 北京→${to}`, airline: '南航', price: 1150, time: '11:00 - 14:30', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
    { id: 'fl_4', title: `HU7890 北京→${to}`, airline: '海航', price: 750, time: '13:30 - 17:00', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
    { id: 'fl_5', title: `3U1234 北京→${to}`, airline: '川航', price: 680, time: '15:00 - 18:30', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
    { id: 'fl_6', title: `MF5678 北京→${to}`, airline: '厦航', price: 920, time: '17:30 - 21:00', duration: '3h30m', src: '途牛', url: 'https://www.tuniu.com/flight' },
  ];
  // 按价格排序
  return flights.sort((a, b) => a.price - b.price);
}

function getMockTrains(from, to, date) {
  const trains = [
    { id: 'tr_1', title: `G7 ${from}→${to}`, price: 553, time: '07:00 - 11:27', duration: '4h27m', type: '高铁', src: '途牛', url: 'https://www.tuniu.com/train' },
    { id: 'tr_2', title: `G1 ${from}→${to}`, price: 553, time: '08:00 - 12:27', duration: '4h27m', type: '高铁', src: '途牛', url: 'https://www.tuniu.com/train' },
    { id: 'tr_3', title: `D101 ${from}→${to}`, price: 309, time: '09:30 - 14:45', duration: '5h15m', type: '动车', src: '途牛', url: 'https://www.tuniu.com/train' },
    { id: 'tr_4', title: `G21 ${from}→${to}`, price: 553, time: '11:00 - 15:27', duration: '4h27m', type: '高铁', src: '途牛', url: 'https://www.tuniu.com/train' },
    { id: 'tr_5', title: `K3 ${from}→${to}`, price: 156, time: '13:00 - 19:30', duration: '6h30m', type: '快速', src: '途牛', url: 'https://www.tuniu.com/train' },
    { id: 'tr_6', title: `G101 ${from}→${to}`, price: 553, time: '15:00 - 19:27', duration: '4h27m', type: '高铁', src: '途牛', url: 'https://www.tuniu.com/train' },
  ];
  return trains.sort((a, b) => a.price - b.price);
}

function getMockTickets(city, scenic) {
  const tickets = [
    { id: 'tk_1', title: `${scenic} 门票（成人票）`, price: 168, type: '成人票', src: '途牛', url: `https://www.tuniu.com/ticket/${encodeURIComponent(scenic)}` },
    { id: 'tk_2', title: `${scenic} 门票（含船票）`, price: 248, type: '含船票', src: '途牛', url: `https://www.tuniu.com/ticket/${encodeURIComponent(scenic)}` },
    { id: 'tk_3', title: `${scenic} 门票（优惠票）`, price: 144, type: '优惠票', src: '途牛', url: `https://www.tuniu.com/ticket/${encodeURIComponent(scenic)}` },
    { id: 'tk_4', title: `${city} 热门一日游套餐`, price: 298, type: '一日游', src: '途牛', url: 'https://www.tuniu.com/daytrip' },
    { id: 'tk_5', title: `${city} 精华景点联票`, price: 388, type: '联票', src: '途牛', url: 'https://www.tuniu.com/combo' },
    { id: 'tk_6', title: `${city} 专属专车一日游`, price: 599, type: '专车', src: '途牛', url: 'https://www.tuniu.com/private' },
  ];
  return tickets.sort((a, b) => a.price - b.price);
}

function getMockCruises() {
  const cruises = [
    { id: 'cr_1', title: `皇家加勒比·海洋光谱号 上海出发`, price: 4999, route: '上海-冲绳-上海 5晚6天', src: '途牛', url: 'https://www.tuniu.com/cruise' },
    { id: 'cr_2', title: `歌诗达·赛琳娜号 天津出发`, price: 2999, route: '天津-福冈-长崎-天津 6晚7天', src: '途牛', url: 'https://www.tuniu.com/cruise' },
    { id: 'cr_3', title: `公主邮轮·盛世公主号 上海出发`, price: 6999, route: '上海-神户-大阪-富士山-东京 7晚8天', src: '途牛', url: 'https://www.tuniu.com/cruise' },
    { id: 'cr_4', title: `星梦邮轮·探索梦号 深圳出发`, price: 3599, route: '深圳-岘港-下龙湾-深圳 5晚6天', src: '途牛', url: 'https://www.tuniu.com/cruise' },
    { id: 'cr_5', title: `MSC地中海·荣耀号 上海出发`, price: 5499, route: '上海-横滨-东京-富士山 7晚8天', src: '途牛', url: 'https://www.tuniu.com/cruise' },
  ];
  return cruises.sort((a, b) => a.price - b.price);
}

function getMockHolidays(dest) {
  const holidays = [
    { id: 'hd_1', title: `${dest} 5天4晚 自由行`, price: 2999, days: '5天4晚', dest, src: '途牛', url: `https://www.tuniu.com/package/${encodeURIComponent(dest)}` },
    { id: 'hd_2', title: `${dest} 6天5晚 亲子游`, price: 4599, days: '6天5晚', dest, src: '途牛', url: `https://www.tuniu.com/package/${encodeURIComponent(dest)}` },
    { id: 'hd_3', title: `${dest} 4天3晚 精华游`, price: 2199, days: '4天3晚', dest, src: '途牛', url: `https://www.tuniu.com/package/${encodeURIComponent(dest)}` },
    { id: 'hd_4', title: `${dest} 7天6晚 深度游`, price: 5899, days: '7天6晚', dest, src: '途牛', url: `https://www.tuniu.com/package/${encodeURIComponent(dest)}` },
    { id: 'hd_5', title: `${dest} 5天4晚 蜜月套餐`, price: 6999, days: '5天4晚', dest, src: '途牛', url: `https://www.tuniu.com/package/${encodeURIComponent(dest)}` },
  ];
  return holidays.sort((a, b) => a.price - b.price);
}

/** 连续多日酒店最低价趋势（调用途牛+飞猪合并逻辑） */
async function priceTrendHotel({ destName, checkIn, days = 7 }) {
  const start = new Date(checkIn);
  const rows = [];
  const maxDays = Math.min(Math.max(1, days), 7);
  for (let i = 0; i < maxDays; i++) {
    const d0 = new Date(start);
    d0.setDate(d0.getDate() + i);
    const d1 = new Date(d0);
    d1.setDate(d1.getDate() + 1);
    const ci = d0.toISOString().slice(0, 10);
    const co = d1.toISOString().slice(0, 10);
    // eslint-disable-next-line no-await-in-loop
    const h = await searchHotels({ destName, keyWords: '', checkIn: ci, checkOut: co });
    const hotels = h.hotels || [];
    const minP = hotels.length ? Math.min(...hotels.map((x) => x.price)) : 0;
    rows.push({ date: ci, checkIn: ci, checkOut: co, lowestPrice: minP, count: hotels.length });
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 400));
  }
  return { type: 'trend', trendType: 'hotel', destName, rows };
}

module.exports = {
  searchHotels,
  searchFlights,
  searchTrains,
  searchTickets,
  searchCruises,
  searchHolidays,
  priceTrendHotel,
  getFlyaiCliPath: () => (fs.existsSync(FLYAI_CLI_PATH) ? FLYAI_CLI_PATH : null),
  getPriceLevel,
};
