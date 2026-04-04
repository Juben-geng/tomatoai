# -*- coding: utf-8 -*-
import subprocess
import json
import os
import sys

# 设置环境变量
env = os.environ.copy()
env['TUNIU_API_KEY'] = 'sk-287d9cbde8184f59a9bc957c85520ee3'

# 调用途牛CLI
args = {
    "cityName": "三亚",
    "checkIn": "2026-04-10",
    "checkOut": "2026-04-12"
}

# 写入临时文件
args_file = r'C:\Users\Administrator\.qclaw\workspace\web\tomatoai\tuniu_args.json'
with open(args_file, 'w', encoding='utf-8') as f:
    json.dump(args, f, ensure_ascii=False)

print(f"Args saved to: {args_file}")
print(f"Args: {args}")
print()

# 使用文件内容
with open(args_file, 'r', encoding='utf-8') as f:
    args_json = f.read().replace('"', '\\"')

# 使用shell=True
cmd = f'tuniu call hotel tuniu_hotel_search --args "{args_json}"'
print(f"Command: {cmd}")
print()

result = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding='utf-8', env=env)
print("STDOUT:")
print(result.stdout)
if result.stderr:
    print("STDERR:")
    print(result.stderr)
print(f"Return code: {result.returncode}")
