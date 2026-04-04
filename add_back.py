import os

pages = [
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\hotel-price-comparison.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\index-full.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\admin-panel.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\analytics.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\supplier-admin.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\supplier-login.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\user-login.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\payment.html",
    r"C:\Users\Administrator\.qclaw\workspace\web\tomatoai\skill-creator.html"
]

back_btn = '''
<!-- 返回按钮 -->
<button onclick="goBack()" style="position:fixed;bottom:30px;left:30px;width:50px;height:50px;background:linear-gradient(135deg,#FF6B35,#E55A2B);color:#fff;border:none;border-radius:50%;font-size:24px;cursor:pointer;box-shadow:0 4px 15px rgba(255,107,53,0.4);z-index:9999;transition:all 0.2s" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">←</button>
<script>function goBack(){if(document.referrer&&document.referrer.indexOf(window.location.host)!==-1){history.back()}else{window.location.href='index.html'}}</script>
</body>'''

for page in pages:
    if os.path.exists(page):
        with open(page, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if 'goBack' not in content:
            content = content.replace('</body>', back_btn)
            with open(page, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'OK: {os.path.basename(page)}')
        else:
            print(f'SKIP: {os.path.basename(page)}')

print('Done!')