# -*- coding: utf-8 -*-
"""
途牛MCP酒店查询脚本
用于绕过Node.js libuv bug
"""
import subprocess
import json
import sys
import os

os.environ['TUNIU_API_KEY'] = 'sk-287d9cbde8184f59a9bc957c85520ee3'

if len(sys.argv) < 4:
    print(json.dumps({"success": False, "error": "Usage: python tuniu_hotel.py <cityName> <checkIn> <checkOut>"}))
    sys.exit(1)

city_name = sys.argv[1]
check_in = sys.argv[2]
check_out = sys.argv[3]

args = {
    "cityName": city_name,
    "checkIn": check_in,
    "checkOut": check_out
}

# 写入临时文件
args_file = os.path.join(os.path.dirname(__file__), 'tuniu_args_temp.json')
with open(args_file, 'w', encoding='utf-8') as f:
    json.dump(args, f, ensure_ascii=False)

# 从文件读取
with open(args_file, 'r', encoding='utf-8') as f:
    args_json = f.read()

cmd = f'tuniu call hotel tuniu_hotel_search --args "{args_json}"'

try:
    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=30, shell=True)
    print(result.stdout)
except Exception as e:
    print(json.dumps({"success": False, "error": str(e)}))
