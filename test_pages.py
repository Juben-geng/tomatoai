# -*- coding: utf-8 -*-
import os
import re

# 测试所有HTML页面
pages = [
    'hotel-price-comparison.html',
    'index-full.html',
    'admin-panel.html',
    'analytics.html',
    'supplier-admin.html',
    'supplier-login.html',
    'user-login.html',
    'payment.html',
    'skill-creator.html',
]

base_dir = r'C:\Users\Administrator\.qclaw\workspace\web\tomatoai'

print("=" * 60)
print("9个页面测试结果")
print("=" * 60)

results = []
for page in pages:
    filepath = os.path.join(base_dir, page)
    
    if not os.path.exists(filepath):
        results.append((page, "❌ 不存在", 0))
        continue
    
    # 读取文件内容
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查关键元素
    checks = []
    
    # 1. 检查是否有返回按钮
    has_back = 'goBack' in content or '返回' in content
    checks.append("返回按钮" if has_back else "❌无返回")
    
    # 2. 检查是否有CSS样式
    has_css = '<style>' in content or 'stylesheet' in content
    checks.append("CSS样式" if has_css else "❌无CSS")
    
    # 3. 检查是否有JS脚本
    has_js = '<script>' in content or 'onclick' in content
    checks.append("JS脚本" if has_js else "❌无JS")
    
    # 4. 检查是否有导航
    has_nav = '<nav' in content or 'nav-links' in content or '导航' in content
    checks.append("导航栏" if has_nav else "❌无导航")
    
    # 文件大小
    size = len(content)
    
    # 判断是否正常
    is_ok = has_css and has_js
    status = "✅ 正常" if is_ok else "⚠️ 异常"
    
    results.append((page, status, size, checks))

# 输出结果
with open(os.path.join(base_dir, 'page_test_result.txt'), 'w', encoding='utf-8') as f:
    f.write("=" * 60 + "\n")
    f.write("9个页面测试结果\n")
    f.write("=" * 60 + "\n")
    
    for r in results:
        if len(r) == 3:
            f.write(f"\n{r[0]}\n")
            f.write(f"  状态: {r[1]}\n")
            f.write(f"  大小: {r[2]} bytes\n")
        else:
            f.write(f"\n{r[0]}\n")
            f.write(f"  状态: {r[1]}\n")
            f.write(f"  大小: {r[2]} bytes\n")
            f.write(f"  检查: {' | '.join(r[3])}\n")
    
    # 统计
    ok_count = sum(1 for r in results if "✅" in r[1])
    f.write("\n" + "=" * 60 + "\n")
    f.write(f"总计: {len(pages)} 个页面\n")
    f.write(f"正常: {ok_count} 个\n")
    f.write(f"异常: {len(pages) - ok_count} 个\n")
    f.write("=" * 60 + "\n")

print("Done! Result saved to page_test_result.txt")
