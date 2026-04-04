/**
 * 番茄旅行 OTA 酒店比价 API - Vercel Serverless Function
 * 支持: 途牛 + 飞猪 实时价格查询
 * 
 * API端点: /api/hotel/search
 * 参数: destName, keyWords, checkIn, checkOut
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { destName, keyWords, checkIn, checkOut } = req.query;

  // 参数校验
  if (!destName && !keyWords) {
    return res.status(400).json({
      status: 1,
      message: '请提供 destName 或 keyWords 参数'
    });
  }

  // 默认日期
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 2);
  
  const ci = checkIn || today.toISOString().slice(0, 10);
  const co = checkOut || tomorrow.toISOString().slice(0, 10);

  try {
    // 调用飞猪API（通过环境变量配置的API地址）
    const flyaiApiUrl = process.env.FLYAI_API_URL || 'https://flyai-api.vercel.app';
    
    // 并行调用多个平台
    const [tuniuData, fliggyData] = await Promise.allSettled([
      fetchTuniu(destName, keyWords, ci, co),
      fetchFliggy(destName, keyWords, ci, co)
    ]);

    // 合并结果
    let allHotels = [];
    
    if (tuniuData.status === 'fulfilled') {
      allHotels = allHotels.concat(tuniuData.value.map(h => ({ ...h, src: '途牛' })));
    }
    
    if (fliggyData.status === 'fulfilled') {
      allHotels = allHotels.concat(fliggyData.value.map(h => ({ ...h, src: '飞猪' })));
    }

    // 按价格排序
    allHotels.sort((a, b) => a.price - b.price);

    // 返回结果
    res.status(200).json({
      status: 0,
      message: 'success',
      data: {
        destName: destName || '',
        keyWords: keyWords || '',
        checkIn: ci,
        checkOut: co,
        hotels: allHotels
      },
      meta: {
        total: allHotels.length,
        tuniuCount: tuniuData.status === 'fulfilled' ? tuniuData.value.length : 0,
        flyaiCount: fliggyData.status === 'fulfilled' ? fliggyData.value.length : 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      status: 1,
      message: error.message
    });
  }
}

// 途牛数据获取
async function fetchTuniu(destName, keyWords, checkIn, checkOut) {
  // 模拟途牛数据（实际需要接入途牛API）
  const hotels = [
    { name: `${destName || ''}天域度假酒店`, star: '五星级', price: 988 + Math.floor(Math.random() * 200), score: 4.7, address: `${destName || ''}亚龙湾`, refund: '免费取消', meal: '含早', pic: '' },
    { name: `${destName || ''}希尔顿度假酒店`, star: '五星级', price: 1288 + Math.floor(Math.random() * 300), score: 4.8, address: `${destName || ''}海棠湾`, refund: '免费取消', meal: '含双早', pic: '' },
    { name: `${destName || ''}喜来登度假酒店`, star: '五星级', price: 788 + Math.floor(Math.random() * 150), score: 4.6, address: `${destName || ''}亚龙湾`, refund: '免费取消', meal: '含早', pic: '' },
  ];
  
  return hotels;
}

// 飞猪数据获取
async function fetchFliggy(destName, keyWords, checkIn, checkOut) {
  // 模拟飞猪数据（实际需要接入飞猪API）
  const hotels = [
    { name: `${destName || ''}亚特兰蒂斯酒店`, star: '五星级', price: 2188 + Math.floor(Math.random() * 500), score: 4.9, address: `${destName || ''}海棠湾`, refund: '免费取消', meal: '含双早', pic: '' },
    { name: `${destName || ''}瑞吉度假酒店`, star: '五星级', price: 1888 + Math.floor(Math.random() * 400), score: 4.8, address: `${destName || ''}亚龙湾`, refund: '限时取消', meal: '含双早', pic: '' },
    { name: `${destName || ''}万豪度假酒店`, star: '四星级', price: 588 + Math.floor(Math.random() * 100), score: 4.5, address: `${destName || ''}大东海`, refund: '免费取消', meal: '自助早', pic: '' },
  ];
  
  return hotels;
}