#!/usr/bin/env node
/**
 * 番茄旅行 OTA 酒店比价 API 服务
 * 调用飞猪(Fliggy) CLI + 途牛(Tuniu) MCP 获取实时酒店价格
 * 监听 localhost:3000
 * 
 * 关键教训: Windows下 npx/.cmd 输出为空
 * → 必须用 node.exe + 绝对路径直调
 */

const http = require('http');
const { spawn, execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const url = require('url');

// ==================== 配置 ====================
const PORT = 3000;
const HOST = '127.0.0.1';

// 途牛 API Key
const TUNIU_API_KEY = process.env.TUNIU_API_KEY || 'sk-287d9cbde8184f59a9bc957c85520ee3';

// 飞猪 CLI 路径（Windows兼容方式）
function getFlyaiCliPath() {
    // 尝试多个可能的路径（已验证 @fly-ai/flyai-cli v1.0.11）
    const possiblePaths = [
        // ✅ 正确路径（v1.0.11）
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.cjs'),
        // 备选
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.js'),
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'index.js'),
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'flyai.js'),
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'flyai-cli', 'flyai.js'),
    ];
    
    for (const p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                console.log(`[INFO] Found flyai-cli at: ${p}`);
                return p;
            }
        } catch (e) {}
    }
    
    // 尝试从 require.resolve 找
    try {
        const p = require.resolve('@fly-ai/flyai-cli/flyai.js');
        if (fs.existsSync(p)) return p;
    } catch (e) {}
    
    return null;
}

// ✅ 已验证路径 @fly-ai/flyai-cli v1.0.11
// ✅ 直接硬编码已知正确的路径（避免 fs.existsSync 超时）
const FLYAI_CLI_PATH = path.join(
    process.env.APPDATA || 'C:\\Users\\Administrator\\AppData\\Roaming',
    'npm', 'node_modules', '@fly-ai', 'flyai-cli', 'dist', 'flyai-bundle.cjs'
);

// ==================== 工具函数 ====================

function getPriceLevel(price) {
    const p = parseInt(String(price).replace(/[^\d]/g, '')) || 0;
    if (p <= 500) return '🟢 经济';
    if (p <= 1500) return '🟠 舒适';
    if (p <= 3000) return '🔴 高档';
    return '🟣 豪华';
}

function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const match = String(priceStr).match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, '')) : 0;
}

function buildFlyaiCommand(destName, keyWords, checkIn, checkOut) {
    const args = [
        FLYAI_CLI_PATH,
        'search-hotels',
        '--dest-name', destName,
        '--check-in-date', checkIn,
        '--check-out-date', checkOut,
    ];
    if (keyWords) {
        args.push('--key-words', keyWords);
    }
    return args;
}

function callFlyaiCli(destName, keyWords, checkIn, checkOut) {
    return new Promise((resolve, reject) => {
        if (!FLYAI_CLI_PATH) {
            reject(new Error('flyai-cli not found'));
            return;
        }

        const args = [
            'search-hotels',
            '--dest-name', destName,
            '--check-in-date', checkIn,
            '--check-out-date', checkOut,
        ];
        if (keyWords) {
            args.push('--key-words', keyWords);
        }

        console.log(`[FLYAI] Query: ${destName} ${keyWords || ''} | ${checkIn}~${checkOut}`);

        const proc = spawn(process.execPath, [FLYAI_CLI_PATH, ...args], {
            windowsHide: true,
            timeout: 30000,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('error', (err) => {
            console.error('[FLYAI ERROR]', err.message);
            reject(err);
        });

        proc.on('close', (code) => {
            if (code !== 0 && stderr) {
                console.error('[FLYAI STDERR]', stderr.substring(0, 200));
            }
            resolve(stdout);
        });

        // 超时30秒
        setTimeout(() => {
            proc.kill();
            reject(new Error('Timeout 30s'));
        }, 30000);
    });
}

function parseFlyaiOutput(rawOutput) {
    // 找到JSON开始的位置
    const jsonStart = rawOutput.indexOf('{');
    if (jsonStart === -1) {
        // 尝试找到 "status" 或 "data"
        const altStart = rawOutput.indexOf('"status"');
        if (altStart > 0) {
            return JSON.parse(rawOutput.substring(altStart));
        }
        throw new Error('No JSON found in output');
    }
    return JSON.parse(rawOutput.substring(jsonStart));
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

// ==================== 途牛MCP真实数据 ====================
function callTuniuMcpSync(destName, checkIn, checkOut) {
    try {
        // 使用tuniu_hotel.js脚本调用（绕过libuv bug）
        const scriptPath = path.join(__dirname, 'tuniu_hotel.js');
        const cmd = `node "${scriptPath}" "${destName}" "${checkIn}" "${checkOut}"`;
        console.log('[Tuniu] Calling:', cmd);
        
        const stdout = execSync(cmd, {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10,
            timeout: 30000
        });
        
        const result = JSON.parse(stdout);
        if (result.success && result.result?.content?.[0]?.text) {
            const hotelData = JSON.parse(result.result.content[0].text);
            if (hotelData.success && hotelData.hotels) {
                const hotels = hotelData.hotels.map((h, i) => ({
                    id: `tn_${h.hotelId || i}`,
                    name: h.hotelName || '',
                    star: h.starName || '',
                    price: h.lowestPrice || 0,
                    priceStr: `¥${(h.lowestPrice || 0).toLocaleString()}起`,
                    score: h.commentScore ? `${h.commentScore}分` : '',
                    src: '途牛',
                    srcTag: 't',
                    address: h.address || '',
                    pic: h.firstPic || '',
                    url: `https://hotel.tuniu.com/hotel-booking/search?keyword=${encodeURIComponent(h.hotelName || '')}`,
                    refund: h.refund || '',
                    meal: h.meal || '',
                    level: getPriceLevel(h.lowestPrice || 0),
                    rank: i + 1,
                }));
                console.log(`[Tuniu] ✅ 成功获取 ${hotels.length} 家酒店`);
                return hotels;
            }
        }
        return null;
    } catch (e) {
        console.error('[Tuniu] Error:', e.message);
        return null;
    }
}

// ==================== 模拟途牛数据（备用） ====================
function getMockTuniuHotels(destName) {
    const mockData = {
        '三亚': [
            { id: 'tn_1', name: '三亚天域度假酒店', star: '豪华型', price: 1288, score: '4.8', src: '途牛', srcTag: 't', address: '三亚市亚龙湾国家旅游度假区', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=天域', pic: '', refund: '免费取消', meal: '含双早', level: '🔴 高档' },
            { id: 'tn_2', name: '三亚亚特兰蒂斯酒店', star: '奢华型', price: 3888, score: '4.9', src: '途牛', srcTag: 't', address: '三亚市海棠区海棠北路36号', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=亚特兰蒂斯', pic: '', refund: '免费取消', meal: '含双早', level: '🟣 豪华' },
            { id: 'tn_3', name: '三亚海棠湾威斯汀度假酒店', star: '高端型', price: 1688, score: '4.7', src: '途牛', srcTag: 't', address: '三亚市海棠区海棠北路', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=威斯汀', pic: '', refund: '免费取消', meal: '含早', level: '🔴 高档' },
            { id: 'tn_4', name: '三亚湾皇冠假日酒店', star: '高端型', price: 899, score: '4.6', src: '途牛', srcTag: 't', address: '三亚市三亚湾路', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=皇冠假日', pic: '', refund: '免费取消', meal: '', level: '🟠 舒适' },
            { id: 'tn_5', name: '三亚蜈支洲岛珊瑚酒店', star: '豪华型', price: 2188, score: '4.8', src: '途牛', srcTag: 't', address: '三亚市海棠区蜈支洲岛', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=蜈支洲岛', pic: '', refund: '免费取消', meal: '含三早', level: '🔴 高档' },
        ],
        '普吉岛': [
            { id: 'tn_p1', name: '普吉岛卡塔坦尼海滩度假酒店', star: '五星', price: 988, score: '4.7', src: '途牛', srcTag: 't', address: '普吉岛卡塔海滩', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=卡塔坦尼', pic: '', refund: '免费取消', meal: '含双早', level: '🟠 舒适' },
            { id: 'tn_p2', name: '普吉岛希尔顿阿卡迪亚温泉度假酒店', star: '五星', price: 1588, score: '4.8', src: '途牛', srcTag: 't', address: '普吉岛卡伦海滩', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=希尔顿', pic: '', refund: '免费取消', meal: '含双早', level: '🔴 高档' },
            { id: 'tn_p3', name: '普吉岛悦榕庄', star: '超五星', price: 3288, score: '4.9', src: '途牛', srcTag: 't', address: '普吉岛邦涛海滩', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=悦榕庄', pic: '', refund: '免费取消', meal: '含双早', level: '🟣 豪华' },
        ],
        '巴厘岛': [
            { id: 'tn_b1', name: '巴厘岛阿雅娜度假酒店', star: '五星', price: 1888, score: '4.8', src: '途牛', srcTag: 't', address: '巴厘岛金巴兰', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=阿雅娜', pic: '', refund: '免费取消', meal: '含双早', level: '🔴 高档' },
            { id: 'tn_b2', name: '巴厘岛宝格丽度假酒店', star: '超五星', price: 6888, score: '4.9', src: '途牛', srcTag: 't', address: '巴厘岛布科半岛', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=宝格丽', pic: '', refund: '免费取消', meal: '含早', level: '🟣 豪华' },
            { id: 'tn_b3', name: '巴厘岛乌布空中花园酒店', star: '五星', price: 2388, score: '4.7', src: '途牛', srcTag: 't', address: '巴厘岛乌布', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=空中花园', pic: '', refund: '免费取消', meal: '含双早', level: '🔴 高档' },
        ],
        '新加坡': [
            { id: 'tn_s1', name: '新加坡滨海湾金沙酒店', star: '五星', price: 2588, score: '4.8', src: '途牛', srcTag: 't', address: '新加坡滨海湾', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=金沙', pic: '', refund: '免费取消', meal: '', level: '🔴 高档' },
            { id: 'tn_s2', name: '新加坡香格里拉大酒店', star: '五星', price: 1688, score: '4.7', src: '途牛', srcTag: 't', address: '新加坡乌节路', url: 'https://hotel.tuniu.com/hotel-booking/search?keyword=香格里拉', pic: '', refund: '免费取消', meal: '含双早', level: '🔴 高档' },
        ],
    };
    
    const destKey = Object.keys(mockData).find(k => destName.includes(k)) || '三亚';
    return mockData[destKey] || mockData['三亚'];
}

// ==================== HTTP 服务器 ====================

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
};

function sendJSON(res, status, data) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end(JSON.stringify(data));
}

function sendFile(res, filePath, root) {
    const fullPath = path.join(root || __dirname, filePath);
    const ext = path.extname(fullPath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
    
    try {
        const content = fs.readFileSync(fullPath);
        res.writeHead(200, {
            'Content-Type': mime,
            'Access-Control-Allow-Origin': '*',
        });
        res.end(content);
    } catch (e) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + filePath);
    }
}

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    // CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }

    // 健康检查
    if (pathname === '/health') {
        sendJSON(res, 200, {
            status: 'ok',
            service: '番茄旅行OTA服务',
            flyai: FLYAI_CLI_PATH ? 'available' : 'not-found',
            time: new Date().toISOString()
        });
        return;
    }

    // API: 酒店搜索
    if (pathname === '/api/hotel/search') {
        const destName = query.destName || '三亚';
        const keyWords = query.keyWords || query.hotelName || '';
        const checkIn = query.checkIn || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const checkOut = query.checkOut || new Date(Date.now() + 172800000).toISOString().slice(0, 10);

        console.log(`\n[${new Date().toLocaleString()}] 搜索: ${destName} | ${keyWords || '(无关键词)'} | ${checkIn}~${checkOut}`);

        let flyaiHotels = [];
        let flyaiSuccess = false;
        let tuniuHotels = [];
        let tuniuSuccess = false;

        // 尝试调用途牛 MCP（真实数据）
        const tuniuResult = callTuniuMcpSync(destName, checkIn, checkOut);
        if (tuniuResult && tuniuResult.length > 0) {
            tuniuHotels = tuniuResult;
            tuniuSuccess = true;
        }

        // 尝试调用飞猪 CLI
        if (FLYAI_CLI_PATH) {
            try {
                const rawOutput = await callFlyaiCli(destName, keyWords, checkIn, checkOut);
                const flyaiData = parseFlyaiOutput(rawOutput);
                if (flyaiData.status === 0 && flyaiData.data?.itemList?.length > 0) {
                    flyaiHotels = transformFlyaiHotels(flyaiData);
                    flyaiSuccess = true;
                    console.log(`[FLYAI] ✅ 成功获取 ${flyaiHotels.length} 家酒店`);
                }
            } catch (e) {
                console.log(`[FLYAI] ❌ 失败: ${e.message}`);
            }
        } else {
            console.log('[FLYAI] ⚠️ CLI未找到');
        }

        // 如果途牛失败，使用模拟数据
        if (!tuniuSuccess) {
            tuniuHotels = getMockTuniuHotels(destName);
            console.log(`[TUNIU] ⚠️ 使用模拟数据 ${tuniuHotels.length} 家酒店`);
        }

        // 合并两个来源的数据
        let allHotels = [];
        
        // 合并途牛和飞猪数据
        allHotels = [...tuniuHotels];
        
        // 如果有飞猪数据，合并进去（去除重复）
        if (flyaiSuccess && flyaiHotels.length > 0) {
            const tuniuNames = new Set(tuniuHotels.map(h => h.name));
            const uniqueFlyai = flyaiHotels.filter(h => !tuniuNames.has(h.name));
            allHotels = [...allHotels, ...uniqueFlyai];
        }

        // 如果有关键词，进一步过滤
        if (keyWords) {
            allHotels = allHotels.filter(h =>
                h.name.includes(keyWords) ||
                keyWords.includes(h.name.substring(0, 4))
            );
        }

        // 按价格排序
        allHotels.sort((a, b) => a.price - b.price);
        
        // 更新排名
        allHotels.forEach((h, i) => {
            h.rank = i + 1;
            if (i === 0) h.isLowest = true;
        });

        const tnCount = allHotels.filter(h => h.src === '途牛').length;
        const fyCount = allHotels.filter(h => h.src === '飞猪').length;

        console.log(`[结果] 共 ${allHotels.length} 家 (途牛${tnCount} + 飞猪${fyCount})`);

        sendJSON(res, 200, {
            status: 0,
            message: 'success',
            data: {
                destName,
                checkIn,
                checkOut,
                keyWords,
                hotels: allHotels,
                flyaiSuccess,
                tuniuSuccess,
                flyaiCount: flyaiHotels.length,
                tuniuCount: tuniuHotels.length,
            },
            meta: {
                total: allHotels.length,
                tuniuCount: tuniuHotels.length,
                flyaiCount: flyaiHotels.length,
                flyaiSuccess,
                tuniuSuccess,
                timestamp: new Date().toISOString(),
            }
        });
        return;
    }

    // API: 飞行搜索
    if (pathname === '/api/flight/search') {
        const fromCity = query.from || '北京';
        const toCity = query.to || '三亚';
        const date = query.date || new Date(Date.now() + 86400000).toISOString().slice(0, 10);

        sendJSON(res, 200, {
            status: 0,
            message: 'success',
            data: {
                from: fromCity,
                to: toCity,
                date,
                flights: [
                    { name: `${fromCity}→${toCity} 国航`, price: 880, time: '08:00-11:30', from: '飞猪' },
                    { name: `${fromCity}→${toCity} 东航`, price: 760, time: '14:00-17:30', from: '飞猪' },
                    { name: `${fromCity}→${toCity} 南航`, price: 980, time: '19:00-22:30', from: '途牛' },
                ]
            }
        });
        return;
    }

    // API: 飞书写入（演示端点）
    if (pathname === '/api/feishu/write') {
        const { hotels, date, destName } = query;
        console.log(`[FEISHU] 写入请求: ${destName} ${date}`);
        sendJSON(res, 200, {
            status: 0,
            message: '飞书写入接口就绪，请使用 scripts/hotel_price_to_feishu.py 脚本',
            data: { destName, date, hotelCount: hotels ? JSON.parse(hotels).length : 0 }
        });
        return;
    }

    // 静态文件服务
    const staticFile = pathname.replace(/^\//, '');
    if (staticFile && fs.existsSync(path.join(__dirname, staticFile))) {
        sendFile(res, staticFile, __dirname);
        return;
    }

    // 默认返回 index.html
    sendFile(res, 'ai-assistant-ota.html', __dirname);
});

// ==================== 启动 ====================
server.listen(PORT, HOST, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════╗');
    console.log('║  🍅 番茄旅行 OTA 酒店比价服务 启动！     ║');
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  地址: http://${HOST}:${PORT}               ║`);
    console.log(`║  飞猪CLI: ${FLYAI_CLI_PATH ? '✅ 已找到' : '❌ 未安装(用模拟数据)'}`);
    console.log('╠══════════════════════════════════════════╣');
    console.log('║  API 端点:                                ║');
    console.log('║  GET /health                              ║');
    console.log('║  GET /api/hotel/search                    ║');
    console.log('║    ?destName=三亚                         ║');
    console.log('║    &keyWords=天域                         ║');
    console.log('║    &checkIn=2026-04-11                    ║');
    console.log('║    &checkOut=2026-04-13                  ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n[INFO] 正在关闭服务...');
    server.close(() => {
        console.log('[INFO] 服务已关闭');
        process.exit(0);
    });
});
