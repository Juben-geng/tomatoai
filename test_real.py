import urllib.request
import json
from urllib.parse import quote

# 测试酒店API
url = 'http://localhost:3000/api/hotel/search?destName=' + quote('三亚') + '&checkIn=2026-04-05&checkOut=2026-04-07'
res = urllib.request.urlopen(url, timeout=30)
data = json.loads(res.read().decode('utf-8'))

# 分别统计途牛和飞猪
tuniu = [h for h in data['data']['hotels'] if h['src'] == '途牛']
fliggy = [h for h in data['data']['hotels'] if h['src'] == '飞猪']

# 写入文件
with open('test_result.txt', 'w', encoding='utf-8') as f:
    f.write('=== 酒店API真实测试 ===\n')
    f.write(f'状态: {data["status"]}\n')
    f.write(f'总数: {len(data["data"]["hotels"])}\n\n')
    
    f.write(f'【途牛酒店】数量: {len(tuniu)}\n')
    for h in tuniu[:3]:
        f.write(f'  - {h["name"][:30]} | ¥{h["price"]} | {h.get("url", "无")[:50]}\n')
    
    f.write(f'\n【飞猪酒店】数量: {len(fliggy)}\n')
    for h in fliggy[:3]:
        f.write(f'  - {h["name"][:30]} | ¥{h["price"]} | {h.get("url", "无")[:50]}\n')
    
    f.write('\n=== 结论 ===\n')
    f.write(f'途牛: {len(tuniu)}家 ({"✅ 有真实数据" if len(tuniu) > 0 else "❌ 无数据"})\n')
    f.write(f'飞猪: {len(fliggy)}家 ({"✅ 有真实数据" if len(fliggy) > 0 else "❌ 无数据"})\n')

print('Done')