# 番茄旅行AI - 逐日查询飞书同步脚本
# 文件: scripts/hotel_to_feishu.py
# 功能: 自动逐日查询飞猪、途牛价格并写入飞书多维表格

import requests
import json
from datetime import datetime, timedelta
import time

# ==================== 配置 ====================
API_URL = "https://tomatoai.vercel.app"  # 番茄旅行API地址

# 飞书配置
FEISHU_BASE_TOKEN = "YOUR_BASE_TOKEN"  # 替换为你的飞书多维表格 Token
FEISHU_TABLE_ID = "YOUR_TABLE_ID"      # 替换为你的表格 ID
FEISHU_API = "https://open.feishu.cn/open-apis/bitable/v1/apps"

# ==================== 核心函数 ====================

def query_hotel_prices(dest, check_in, check_out):
    """查询酒店价格"""
    try:
        res = requests.get(f"{API_URL}/api/hotel/search", params={
            "destName": dest,
            "checkIn": check_in,
            "checkOut": check_out
        }, timeout=30)
        data = res.json()
        
        if data["status"] == 0:
            return data["data"]["hotels"]
        else:
            print(f"❌ 查询失败: {data.get('message')}")
            return []
    except Exception as e:
        print(f"❌ API调用失败: {e}")
        return []

def write_to_feishu(hotels, date, dest):
    """写入飞书多维表格"""
    if not hotels:
        return 0
    
    headers = {
        "Authorization": f"Bearer {FEISHU_BASE_TOKEN}",
        "Content-Type": "application/json"
    }
    
    records = []
    for h in hotels[:5]:  # 每天只写入前5家最低价酒店
        records.append({
            "fields": {
                "日期": date,
                "城市": dest,
                "酒店名称": h["name"],
                "平台": h["src"],
                "价格": h["price"],
                "星级": h.get("star", ""),
                "评分": h.get("score", ""),
                "取消政策": h.get("refund", ""),
                "早餐": h.get("meal", ""),
                "预订链接": h.get("url", "")
            }
        })
    
    try:
        res = requests.post(
            f"{FEISHU_API}/{FEISHU_TABLE_ID}/tables/{FEISHU_TABLE_ID}/records/batch_create",
            headers=headers,
            json={"records": records}
        )
        
        if res.status_code == 200:
            print(f"  ✅ 飞书写入成功: {len(records)} 条")
            return len(records)
        else:
            print(f"  ❌ 飞书写入失败: {res.text}")
            return 0
    except Exception as e:
        print(f"  ❌ 飞书写入异常: {e}")
        return 0

def sync_daily_prices(dest, start_date, days=7):
    """逐日查询并同步"""
    print(f"\n🍅 番茄旅行 - 逐日价格同步")
    print(f"📍 目的地: {dest}")
    print(f"📅 开始日期: {start_date}")
    print(f"📊 查询天数: {days}")
    print("=" * 50)
    
    total_hotels = 0
    total_records = 0
    
    for i in range(days):
        check_in = (datetime.strptime(start_date, "%Y-%m-%d") + timedelta(days=i)).strftime("%Y-%m-%d")
        check_out = (datetime.strptime(check_in, "%Y-%m-%d") + timedelta(days=1)).strftime("%Y-%m-%d")
        
        print(f"\n[{i+1}/{days}] {check_in}")
        
        # 查询酒店价格
        hotels = query_hotel_prices(dest, check_in, check_out)
        
        if hotels:
            print(f"  🏨 查询到 {len(hotels)} 家酒店")
            print(f"  💰 最低价: ¥{hotels[0]['price']} - {hotels[0]['name']}")
            total_hotels += len(hotels)
            
            # 写入飞书
            records = write_to_feishu(hotels, check_in, dest)
            total_records += records
        else:
            print(f"  ⚠️ 无数据")
        
        # 避免请求过快
        time.sleep(1)
    
    print("\n" + "=" * 50)
    print(f"✅ 同步完成!")
    print(f"📊 总计: {total_hotels} 家酒店, {total_records} 条飞书记录")

# ==================== 主程序 ====================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='番茄旅行 - 逐日价格同步到飞书')
    parser.add_argument('--dest', default='三亚', help='目的地城市')
    parser.add_argument('--start', default=datetime.now().strftime('%Y-%m-%d'), help='开始日期')
    parser.add_argument('--days', type=int, default=7, help='查询天数')
    
    args = parser.parse_args()
    
    sync_daily_prices(args.dest, args.start, args.days)