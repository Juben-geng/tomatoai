# 为所有页面添加返回按钮的脚本

$pages = @(
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\hotel-price-comparison.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\index-full.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\admin-panel.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\analytics.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\supplier-admin.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\supplier-login.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\user-login.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\payment.html",
    "C:\Users\Administrator\.qclaw\workspace\web\tomatoai\skill-creator.html"
)

$backBtn = @"
<!-- 返回按钮 -->
<button onclick="goBack()" style="position:fixed;bottom:30px;left:30px;width:50px;height:50px;background:linear-gradient(135deg,#FF6B35,#E55A2B);color:#fff;border:none;border-radius:50%;font-size:24px;cursor:pointer;box-shadow:0 4px 15px rgba(255,107,53,0.4);z-index:9999;transition:all 0.2s" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">←</button>
<script>function goBack(){if(document.referrer&&document.referrer.indexOf(window.location.host)!==-1){history.back()}else{window.location.href='index.html'}}</script>
"@

foreach ($page in $pages) {
    if (Test-Path $page) {
        $content = Get-Content $page -Raw -Encoding UTF8
        if ($content -notmatch "goBack") {
            # 在 </body> 前插入返回按钮
            $content = $content -replace "</body>", "$backBtn`n</body>"
            Set-Content $page $content -Encoding UTF8
            Write-Host "✅ 已添加返回按钮: $page"
        } else {
            Write-Host "⏭️ 已有返回按钮: $page"
        }
    }
}

Write-Host "`n✅ 完成！"