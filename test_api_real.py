# -*- coding: utf-8 -*-
import urllib.request
import json

url = 'http://localhost:3000/api/hotel/search?destName=%E4%B8%89%E4%BA%9A&checkIn=2026-04-10&checkOut=2026-04-12'
res = urllib.request.urlopen(url)
data = json.loads(res.read().decode('utf-8'))

print("=" * 60)
print("API Test Result")
print("=" * 60)
print(f"Status: {data.get('status')}")
print(f"Total Hotels: {data.get('data', {}).get('hotels', []).__len__()}")
print(f"Tuniu: {data.get('meta', {}).get('tuniuCount', 0)}")
print(f"Fliggy: {data.get('meta', {}).get('flyaiCount', 0)}")
print(f"Tuniu Success: {data.get('meta', {}).get('tuniuSuccess', False)}")
print(f"Fliggy Success: {data.get('meta', {}).get('flyaiSuccess', False)}")
print("=" * 60)

hotels = data.get('data', {}).get('hotels', [])[:10]
for i, h in enumerate(hotels, 1):
    print(f"{i}. {h['name']}")
    print(f"   Price: {h['priceStr']} | {h['src']} | {h['star']}")
    print()
