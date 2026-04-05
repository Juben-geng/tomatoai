#!/usr/bin/env node
/**
 * 番茄旅行 OTA API 服务 - 线上部署版
 * 使用途牛HTTP API + 飞猪HTTP API
 * 可部署到 Render/Railway/Vercel
 */

const http = require('http');
const https = require('https');
const url = require('url');

// ==================== 配置 ====================
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// API Keys (从环境变量读取)
const TUNIU_API_KEY = process.env.TUNIU_API_KEY || '';
const FLIGGY_API_KEY = process.env.FLIGGY_API_KEY || '';

// 途牛API基础URL
const TUNIU_API_BASE = 'https://openapi.tuniu.cn';

// ==================== CORS中间件 ====================
function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ==================== HTTP请求工具 ====================
function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const client = options.protocol === 'https:' ? https : http;
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve({ raw: data });
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

// ==================== 途牛API调用 ====================
async function callTuniuAPI(endpoint, params = {}) {
    const queryParams = new URLSearchParams({
        apiKey: TUNIU_API_KEY,
        ...params
    });
    
    const options = {
        hostname: 'openapi.tuniu.cn',
        path: `${endpoint}?${queryParams.toString()}`,
        method: 'GET'
    };
    
    return await httpRequest(options);
}

// ==================== 飞猪API调用（模拟）====================
async function callFliggyAPI(type, params = {}) {
    // 飞猪没有公开HTTP API，这里返回模拟数据
    // 实际部署时需要接入飞猪开放平台
    return {
        success: true,
        source: 'fliggy-mock',
        message: '飞猪API需要接入开放平台',
        data: generateMockData(type, params)
    };
}

// ==================== 模拟数据生成器 ====================
function generateMockData(type, params) {
    const { cityName, checkIn, checkOut } = params;
    
    if (type === 'hotel') {
        const hotels = [
            { name: `${cityName}希尔顿度假酒店`, star: '五星级', price: 1288, score: 4.8, address: `${cityName}海棠湾`, platform: '飞猪' },
            { name: `${cityName}亚特兰蒂斯酒店`, star: '五星级', price: 2188, score: 4.9, address: `${cityName}海棠湾`, platform: '飞猪' },
            { name: `${cityName}天域度假酒店`, star: '五星级', price: 988, score: 4.7, address: `${cityName}亚龙湾`, platform: '飞猪' },
        ];
        return { hotels, total: hotels.length };
    }
    
    if (type === 'flight') {
        const flights = [
            { flightNo: 'CA1234', airline: '国航', depTime: '08:00', arrTime: '11:30', price: 880, platform: '飞猪' },
            { flightNo: 'MU5678', airline: '东航', depTime: '14:00', arrTime: '17:30', price: 720, platform: '飞猪' },
        ];
        return { flights, total: flights.length };
    }
    
    return {};
}

// ==================== 路由处理器 ====================
const routes = {
    // 健康检查
    '/health': async (req, res) => {
        return {
            status: 'ok',
            service: '番茄旅行OTA服务-线上版',
            version: '2.0.0',
            time: new Date().toISOString(),
            apis: {
                tuniu: TUNIU_API_KEY ? 'configured' : 'not configured',
                fliggy: FLIGGY_API_KEY ? 'configured' : 'mock data'
            }
        };
    },
    
    // 酒店搜索
    '/api/hotel/search': async (req, res, query) => {
        const { destName, checkIn, checkOut } = query;
        
        // 途牛数据
        let tuniuData = { hotels: [] };
        if (TUNIU_API_KEY) {
            try {
                tuniuData = await callTuniuAPI('/hotel/search', {
                    cityName: destName,
                    checkInDate: checkIn,
                    checkOutDate: checkOut
                });
            } catch (e) {
                console.error('Tuniu API error:', e.message);
            }
        }
        
        // 飞猪数据（模拟）
        const fliggyData = await callFliggyAPI('hotel', { cityName: destName, checkIn, checkOut });
        
        // 合并数据
        const hotels = [
            ...(tuniuData.hotels || []).map(h => ({ ...h, platform: '途牛' })),
            ...(fliggyData.data?.hotels || []).map(h => ({ ...h, platform: '飞猪' }))
        ];
        
        return {
            status: 0,
            message: 'success',
            data: { hotels, total: hotels.length },
            meta: {
                tuniuCount: tuniuData.hotels?.length || 0,
                fliggyCount: fliggyData.data?.hotels?.length || 0,
                query: { destName, checkIn, checkOut }
            }
        };
    },
    
    // 机票搜索
    '/api/flight/search': async (req, res, query) => {
        const { depCity, arrCity, depDate } = query;
        
        // 途牛机票
        let tuniuData = { flights: [] };
        if (TUNIU_API_KEY) {
            try {
                tuniuData = await callTuniuAPI('/flight/search', {
                    depCity,
                    arrCity,
                    depDate
                });
            } catch (e) {
                console.error('Tuniu flight API error:', e.message);
            }
        }
        
        // 飞猪机票（模拟）
        const fliggyData = await callFliggyAPI('flight', { depCity, arrCity, depDate });
        
        const flights = [
            ...(tuniuData.flights || []).map(f => ({ ...f, platform: '途牛' })),
            ...(fliggyData.data?.flights || []).map(f => ({ ...f, platform: '飞猪' }))
        ];
        
        return {
            status: 0,
            message: 'success',
            data: { from: depCity, to: arrCity, date: depDate, flights },
            meta: { tuniuCount: tuniuData.flights?.length || 0, fliggyCount: fliggyData.data?.flights?.length || 0 }
        };
    },
    
    // 火车票搜索
    '/api/train/search': async (req, res, query) => {
        const { depCity, arrCity, depDate } = query;
        
        let trains = [];
        if (TUNIU_API_KEY) {
            try {
                const data = await callTuniuAPI('/train/search', { depCity, arrCity, depDate });
                trains = data.trains || [];
            } catch (e) {
                console.error('Tuniu train API error:', e.message);
            }
        }
        
        return {
            status: 0,
            message: 'success',
            data: { from: depCity, to: arrCity, date: depDate, trains }
        };
    },
    
    // 门票搜索
    '/api/ticket/search': async (req, res, query) => {
        const { cityName, keyword } = query;
        
        let tickets = [];
        if (TUNIU_API_KEY) {
            try {
                const data = await callTuniuAPI('/ticket/search', { cityName, keyword });
                tickets = data.tickets || [];
            } catch (e) {
                console.error('Tuniu ticket API error:', e.message);
            }
        }
        
        return {
            status: 0,
            message: 'success',
            data: { city: cityName, keyword, tickets }
        };
    },
    
    // 邮轮搜索
    '/api/cruise/search': async (req, res, query) => {
        const { route, month } = query;
        
        let cruises = [];
        if (TUNIU_API_KEY) {
            try {
                const data = await callTuniuAPI('/cruise/search', { route, month });
                cruises = data.cruises || [];
            } catch (e) {
                console.error('Tuniu cruise API error:', e.message);
            }
        }
        
        return {
            status: 0,
            message: 'success',
            data: { route, month, cruises }
        };
    }
};

// ==================== HTTP服务器 ====================
const server = http.createServer(async (req, res) => {
    setCORS(res);
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname}`);
    
    try {
        const handler = routes[pathname];
        if (handler) {
            const result = await handler(req, res, parsedUrl.query);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result));
        } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Not found', path: pathname }));
        }
    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
});

// ==================== 启动 ====================
server.listen(PORT, HOST, () => {
    console.log('========================================');
    console.log('🍅 番茄旅行 OTA API 服务 - 线上版');
    console.log('========================================');
    console.log(`📡 监听: http://${HOST}:${PORT}`);
    console.log(`🔑 途牛API: ${TUNIU_API_KEY ? '已配置' : '未配置'}`);
    console.log(`🔑 飞猪API: ${FLIGGY_API_KEY ? '已配置' : '模拟数据'}`);
    console.log('========================================');
    console.log('可用接口:');
    console.log('  GET /health              - 健康检查');
    console.log('  GET /api/hotel/search    - 酒店搜索');
    console.log('  GET /api/flight/search   - 机票搜索');
    console.log('  GET /api/train/search    - 火车票搜索');
    console.log('  GET /api/ticket/search   - 门票搜索');
    console.log('  GET /api/cruise/search   - 邮轮搜索');
    console.log('========================================');
});

module.exports = server;
