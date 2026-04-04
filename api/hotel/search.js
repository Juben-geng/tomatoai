/**
 * 番茄旅行 OTA 酒店比价 API - Vercel Serverless Function
 * 
 * 支持:
 * - 途牛开放平台 CLI
 * - 飞猪 CLI (flyai-cli)
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

  console.log(`[OTA] 查询: ${destName} ${keyWords || ''} ${ci} ~ ${co}`);

  try {
    // 并行调用多个平台
    const [tuniuResult, fliggyResult] = await Promise.allSettled([
      callTuniuAPI(destName, keyWords, ci, co),
      callFliggyAPI(destName, keyWords, ci, co)
    ]);

    // 合并结果
    let allHotels = [];
    let tuniuCount = 0;
    let flyaiCount = 0;
    
    if (tuniuResult.status === 'fulfilled' && tuniuResult.value.length > 0) {
      allHotels = allHotels.concat(tuniuResult.value);
      tuniuCount = tuniuResult.value.length;
    }
    
    if (fliggyResult.status === 'fulfilled' && fliggyResult.value.length > 0) {
      allHotels = allHotels.concat(fliggyResult.value);
      flyaiCount = fliggyResult.value.length;
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
        tuniuCount,
        flyaiCount,
        flyaiSuccess: flyaiCount > 0,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[OTA] Error:', error);
    res.status(500).json({
      status: 1,
      message: error.message
    });
  }
}

// 途牛API调用
async function callTuniuAPI(destName, keyWords, checkIn, checkOut) {
  // 途牛开放平台 CLI 调用
  // 文档: https://open.tuniu.com/mcp/docs/apidoc/cli/install.html
  
  // 模拟数据（实际需要调途径牛CLI）
  const hotels = [
    { 
      name: `${destName || ''}天域度假酒店`, 
      star: '五星级', 
      price: 988 + Math.floor(Math.random() * 200), 
      score: 4.7, 
      address: `${destName || ''}亚龙湾`, 
      refund: '免费取消', 
      meal: '含早',
      pic: 'https://m.tuniucdn.com/fb3/s1/2n9c/XV1BoFpT1EZ9MLraRmQDmPoQjSS_w200_h327_c1_t0.jpg',
      src: '途牛',
      url: 'https://hotel.tuniu.com'
    },
    { 
      name: `${destName || ''}希尔顿度假酒店`, 
      star: '五星级', 
      price: 1288 + Math.floor(Math.random() * 300), 
      score: 4.8, 
      address: `${destName || ''}海棠湾`, 
      refund: '免费取消', 
      meal: '含双早',
      pic: 'https://m.tuniucdn.com/fb3/s1/2n9c/4M9fsHhrrFjiJPYFc1rntM3wiEBi_w200_h327_c1_t0.jpg',
      src: '途牛',
      url: 'https://hotel.tuniu.com'
    },
    { 
      name: `${destName || ''}喜来登度假酒店`, 
      star: '五星级', 
      price: 788 + Math.floor(Math.random() * 150), 
      score: 4.6, 
      address: `${destName || ''}亚龙湾`, 
      refund: '免费取消', 
      meal: '含早',
      pic: '',
      src: '途牛',
      url: 'https://hotel.tuniu.com'
    },
  ];
  
  return hotels;
}

// 飞猪API调用
async function callFliggyAPI(destName, keyWords, checkIn, checkOut) {
  // 飞猪 CLI (flyai-cli) 调用
  // 安装: npm install -g @fly-ai/flyai-cli
  
  // 模拟数据（实际需要调用飞猪CLI）
  const hotels = [
    { 
      name: `${destName || ''}亚特兰蒂斯酒店`, 
      star: '五星级', 
      price: 2188 + Math.floor(Math.random() * 500), 
      score: 4.9, 
      address: `${destName || ''}海棠湾`, 
      refund: '免费取消', 
      meal: '含双早',
      pic: 'https://img.alicdn.com/imgextra/i3/6000000007645/O1CN01abmXJ626LT0oHkwy2_!!6000000007645-2-hotel.png',
      src: '飞猪',
      url: 'https://www.fliggy.com'
    },
    { 
      name: `${destName || ''}瑞吉度假酒店`, 
      star: '五星级', 
      price: 1888 + Math.floor(Math.random() * 400), 
      score: 4.8, 
      address: `${destName || ''}亚龙湾`, 
      refund: '限时取消', 
      meal: '含双早',
      pic: '',
      src: '飞猪',
      url: 'https://www.fliggy.com'
    },
    { 
      name: `${destName || ''}万豪度假酒店`, 
      star: '四星级', 
      price: 588 + Math.floor(Math.random() * 100), 
      score: 4.5, 
      address: `${destName || ''}大东海`, 
      refund: '免费取消', 
      meal: '自助早',
      pic: '',
      src: '飞猪',
      url: 'https://www.fliggy.com'
    },
  ];
  
  return hotels;
}