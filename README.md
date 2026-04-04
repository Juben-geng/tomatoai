# 番茄旅行AI

🍅 企业级AI驱动旅游定制师平台 — 智能匹配供应商，一键生成行程方案

## 🚀 在线演示

**Vercel 部署地址**: [https://tomatoai.vercel.app](https://tomatoai.vercel.app)

## ✨ 核心功能

### 🏨 实时酒店比价
- 多平台价格对比（途牛 + 飞猪）
- 支持 **城市查询** + **酒店名搜索** + **日期查询**
- 实时价格、评分、取消政策
- 一键预订链接
- 价格颜色分级（经济/舒适/高档/豪华）

### 🤖 AI智能助手
- 自然语言查询酒店价格
- 自动调用 OTA 技能
- 示例："查三亚天域酒店4月11号价格"

### 📊 飞书多维表格同步
- **自动逐日查询** 飞猪、途牛价格
- **自动写入** 飞书多维表格
- 用于报价和价格趋势分析

### ⚡ 快捷工具栏
- 🏨 酒店比价
- ✈️ 机票查询
- 🎫 门票查询
- 🚄 火车票
- 📈 价格趋势

## 📦 部署说明

### Vercel 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Juben-geng/tomatoai)

### 环境变量

| 变量名 | 说明 |
|--------|------|
| TUNIU_CLI_PATH | 途牛CLI路径（可选） |
| FLYAI_CLI_PATH | 飞猪CLI路径（可选） |

## 🛠️ 技术栈

- 前端: HTML + CSS + JavaScript
- 后端: Vercel Serverless Functions
- API: 途牛开放平台 CLI + 飞猪 CLI
- 数据同步: 飞书多维表格

## 📄 文件说明

| 文件 | 功能 |
|------|------|
| index.html | 🏠 首页 |
| hotel-price.html | 🏨 酒店比价（主功能） |
| ai-assistant.html | 🤖 AI助手 |
| api/hotel/search.js | 📡 酒店API |
| scripts/hotel_to_feishu.py | 📊 飞书同步脚本 |

## 🔄 飞书同步使用

```bash
# 安装依赖
pip install requests

# 运行脚本（逐日查询7天价格并写入飞书）
python scripts/hotel_to_feishu.py --dest 三亚 --start 2026-04-05 --days 7
```

## 📡 API 文档

### 酒店搜索

```
GET /api/hotel/search

参数:
- destName: 目的地城市（如：三亚）
- keyWords: 酒店名称关键词（可选）
- checkIn: 入住日期 YYYY-MM-DD
- checkOut: 离店日期 YYYY-MM-DD

返回:
{
  "status": 0,
  "data": {
    "hotels": [
      {
        "name": "酒店名称",
        "price": 988,
        "src": "途牛",
        "star": "五星级",
        "score": 4.7,
        "url": "预订链接"
      }
    ]
  }
}
```

---

🍅 番茄旅行AI — 让旅游定制更智能