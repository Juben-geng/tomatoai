const fs = require('fs');
const P = 'C:/Users/Administrator/.qclaw/workspace/web/travel-ai-assistant/';

// ====== SUPPLIER-ADMIN.HTML (Phase 2: auto-reply templates + KB) ======
const supplierAdmin = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>供应商后台 - 番茄旅行AI</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{--primary:#FF6B35;--accent:#00C9A7;--bg-light:#FFF9F5;--text-dark:#1A1A2E;--text-gray:#6B7280;--border:rgba(26,58,74,0.1);--shadow:0 4px 20px rgba(0,0,0,0.08)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Noto Sans SC',sans-serif;background:#f8f9fa;color:var(--text-dark)}
.navbar{background:white;border-bottom:1px solid var(--border);padding:0 24px;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.navbar-left{display:flex;align-items:center;gap:24px}
.logo{font-size:22px;font-weight:700;color:var(--primary);display:flex;align-items:center;gap:8px;cursor:pointer}
.logo-icon{width:36px;height:36px;background:linear-gradient(135deg,var(--primary),var(--accent));border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.role-badge{background:#E3F2FD;color:#1565C0;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600}
.online-badge{background:#E8F5E9;color:#2E7D32;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px}
.online-dot{width:8px;height:8px;background:#2E7D32;border-radius:50%;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.navbar-right{display:flex;align-items:center;gap:16px}
.supplier-info{display:flex;align-items:center;gap:8px;font-size:13px}
.supplier-avatar{width:32px;height:32px;background:var(--primary);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:600;font-size:16px}
.supplier-name{color:var(--text-dark);font-weight:500}
.logout-btn{padding:6px 12px;background:var(--bg-light);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-gray);text-decoration:none}
.logout-btn:hover{background:#FFE8D6;color:var(--primary)}
.main-container{display:grid;grid-template-columns:260px 1fr;min-height:calc(100vh - 64px)}
.sidebar{background:white;border-right:1px solid var(--border);padding:24px;display:flex;flex-direction:column}
.sidebar-title{font-size:12px;font-weight:600;color:var(--text-gray);text-transform:uppercase;letter-spacing:1px;margin-bottom:16px}
.sidebar-menu{display:flex;flex-direction:column;gap:8px}
.sidebar-item{padding:12px 16px;border-radius:8px;cursor:pointer;font-size:14px;color:var(--text-gray);transition:all 0.2s;border-left:3px solid transparent;display:flex;align-items:center;justify-content:space-between}
.sidebar-item:hover{background:var(--bg-light);color:var(--primary)}
.sidebar-item.active{background:var(--bg-light);color:var(--primary);border-left-color:var(--primary);font-weight:600}
.sidebar-item-badge{background:#FF3B30;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700}
.content{padding:24px;overflow-y:auto}
.page{display:none}
.page.active{display:block}
.page-title{font-size:24px;font-weight:700;margin-bottom:24px}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:white;border-radius:12px;padding:20px;border:1px solid var(--border)}
.stat-value{font-size:32px;font-weight:700;color:var(--primary);margin-bottom:8px}
.stat-label{font-size:13px;color:var(--text-gray)}
.stat-change{font-size:12px;color:#2E7D32;margin-top:4px}
.orders-list{background:white;border-radius:12px;border:1px solid var(--border);overflow:hidden}
.order-item{padding:16px 20px;border-bottom:1px solid var(--border);cursor:pointer;transition:all 0.2s;position:relative}
.order-item:hover{background:var(--bg-light)}
.order-item:last-child{border-bottom:none}
.order-item.unread{background:#FFF9F5}
.order-item.unread::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--primary)}
.order-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.order-id{font-weight:600;color:var(--primary)}
.order-status{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600}
.order-status.pending{background:#FFF3E0;color:#E65100}
.order-status.quoted{background:#E8F5E9;color:#2E7D32}
.order-status.confirmed{background:#E3F2FD;color:#1565C0}
.order-status.completed{background:#F3E5F5;color:#7B1FA2}
.order-desc{font-size:13px;color:var(--text-gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.order-meta{display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--text-gray)}
.order-new-badge{position:absolute;top:12px;right:12px;background:#FF3B30;color:white;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;animation:pulse 2s infinite}
.empty-state{text-align:center;padding:60px 20px;color:var(--text-gray)}
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:200;align-items:center;justify-content:center;overflow-y:auto}
.modal-overlay.active{display:flex}
.modal{background:white;border-radius:16px;width:90%;max-width:720px;max-height:88vh;overflow-y:auto;margin:20px auto}
.modal-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:white;z-index:10}
.modal-title{font-size:18px;font-weight:600}
.modal-close{width:32px;height:32px;border-radius:50%;border:none;background:var(--bg-light);cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center}
.modal-close:hover{background:#FFE8D6}
.modal-body{padding:24px}
.detail-section{margin-bottom:24px}
.detail-section-title{font-size:14px;font-weight:600;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.detail-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:14px}
.detail-label{color:var(--text-gray);font-weight:500}
.detail-value{color:var(--text-dark);font-weight:600}
.itinerary-box{background:var(--bg-light);border-radius:8px;padding:12px;margin-bottom:12px;font-size:13px;line-height:1.8;white-space:pre-wrap}
.form-group{margin-bottom:16px}
.form-label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.form-input,.form-textarea,.form-select{width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;background:white}
.form-input:focus,.form-textarea:focus,.form-select:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px rgba(255,107,53,0.1)}
.form-textarea{resize:vertical;min-height:100px}
.btn{padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;border:none;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.btn-primary{background:var(--primary);color:white}
.btn-primary:hover{background:#E55A2B}
.btn-secondary{background:var(--bg-light);color:var(--text-dark);border:1px solid var(--border)}
.btn-secondary:hover{background:var(--border)}
.btn-accent{background:var(--accent);color:white}
.btn-accent:hover{background:#00B090}
.btn-danger{background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2}
.btn-danger:hover{background:#FF3B30;color:white}
.action-buttons{display:flex;gap:8px;margin-top:16px}
.action-buttons .btn{flex:1}
.success-box{background:#E8F5E9;border-radius:8px;padding:12px;color:#2E7D32;font-size:13px;margin-bottom:12px}
.error-box{background:#FFEBEE;border-radius:8px;padding:12px;color:#C62828;font-size:13px;margin-bottom:12px}
.chat-container{display:flex;flex-direction:column;height:520px;background:white;border-radius:12px;border:1px solid var(--border);overflow:hidden}
.chat-header{padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;background:white}
.chat-header-info{display:flex;align-items:center;gap:12px}
.chat-header-avatar{width:40px;height:40px;background:linear-gradient(135deg,var(--primary),var(--accent));border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:18px}
.chat-header-name{font-weight:600;font-size:15px}
.chat-header-sub{font-size:12px;color:var(--text-gray)}
.chat-messages{flex:1;overflow-y:auto;padding:16px;background:var(--bg-light);display:flex;flex-direction:column;gap:10px}
.chat-msg{margin-bottom:4px;animation:fadeIn 0.3s}
@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1}}
.chat-msg.user{text-align:right}
.chat-bubble{max-width:75%;padding:10px 14px;border-radius:12px;font-size:13px;line-height:1.5;word-break:break-word;display:inline-block;text-align:left}
.chat-msg.user .chat-bubble{background:var(--primary);color:white;border-bottom-right-radius:4px;text-align:right}
.chat-msg.supplier .chat-bubble{background:white;color:var(--text-dark);border:1px solid var(--border);border-bottom-left-radius:4px}
.chat-msg-time{font-size:10px;color:var(--text-gray);margin-top:4px;opacity:0.6}
.chat-msg-time.right{text-align:right}
.chat-typing{font-size:12px;color:var(--text-gray);font-style:italic;padding:8px 0;display:none}
.chat-input-area{padding:12px 16px;border-top:1px solid var(--border);background:white;display:flex;gap:8px;align-items:center}
.chat-input{flex:1;padding:10px 16px;border:1px solid var(--border);border-radius:24px;font-size:13px;font-family:inherit;background:white}
.chat-input:focus{outline:none;border-color:var(--primary)}
.chat-send{width:42px;height:42px;border-radius:50%;background:var(--primary);color:white;border:none;cursor:pointer;font-size:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.chat-send:hover{background:#E55A2B}
.toast-container{position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column-reverse;gap:10px;pointer-events:none}
.toast{background:white;border-radius:12px;padding:14px 18px;box-shadow:0 8px 32px rgba(0,0,0,0.15);border-left:4px solid var(--primary);min-width:280px;max-width:360px;pointer-events:auto;animation:toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1);display:flex;align-items:flex-start;gap:12px;position:relative;overflow:hidden;margin-bottom:4px}
.toast.toast-accent{border-left-color:var(--accent)}
.toast.toast-success{border-left-color:#2E7D32}
.toast.toast-exit{animation:toastOut 0.3s ease forwards}
@keyframes toastIn{from{opacity:0;transform:translateX(120px) scale(0.85)}to{opacity:1;transform:translateX(0) scale(1)}}
@keyframes toastOut{to{opacity:0;transform:translateX(120px) scale(0.85)}}
.toast-icon{font-size:22px;flex-shrink:0;margin-top:1px}
.toast-body{flex:1}
.toast-title{font-weight:600;font-size:14px;margin-bottom:3px}
.toast-text{font-size:13px;color:var(--text-gray);line-height:1.4}
.toast-close-btn{width:22px;height:22px;border-radius:50%;border:none;background:var(--bg-light);cursor:pointer;font-size:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.toast-close-btn:hover{background:#FFE8D6}
.toast-bar{position:absolute;bottom:0;left:0;height:3px;background:var(--primary);border-radius:0 0 12px 0;animation:toastBar linear forwards}
.toast.toast-accent .toast-bar{background:var(--accent)}
@keyframes toastBar{from{width:100%}to{width:0%}}
.sound-toggle{font-size:12px;cursor:pointer;padding:4px 8px;border-radius:12px;border:1px solid var(--border);background:white}

/* ====== PHASE 2: AUTO REPLY TEMPLATES ====== */
.reply-template{display:flex;align-items:center;gap:12px;padding:14px 16px;background:white;border:1px solid var(--border);border-radius:10px;margin-bottom:10px;cursor:pointer;transition:all 0.2s}
.reply-template:hover{border-color:var(--primary);box-shadow:var(--shadow)}
.reply-template.disabled{opacity:0.5}
.reply-template.active{border-color:var(--accent);border-width:2px}
.reply-template-left{flex:1;min-width:0}
.reply-template-name{font-weight:600;font-size:14px;margin-bottom:4px}
.reply-template-preview{font-size:12px;color:var(--text-gray);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.reply-template-toggle{width:44px;height:24px;border-radius:12px;background:var(--border);border:none;cursor:pointer;position:relative;transition:all 0.3s;flex-shrink:0}
.reply-template-toggle.on{background:var(--accent)}
.reply-template-toggle::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:white;transition:all 0.3s;box-shadow:0 1px 3px rgba(0,0,0,0.2)}
.reply-template-toggle.on::after{left:23px}
.reply-template-actions{display:flex;gap:4px}
.template-action-btn{width:28px;height:28px;border-radius:6px;border:none;background:var(--bg-light);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;color:var(--text-gray)}
.template-action-btn:hover{color:var(--primary)}
.add-template-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:2px dashed var(--border);border-radius:10px;background:white;cursor:pointer;font-size:14px;color:var(--text-gray);transition:all 0.2s;width:100%;font-family:inherit}
.add-template-btn:hover{border-color:var(--primary);color:var(--primary)}

/* ====== PHASE 2: KB KNOWLEDGE BASE ====== */
.kb-search-box{display:flex;gap:8px;margin-bottom:16px}
.kb-search-input{flex:1;padding:10px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-family:inherit;background:white}
.kb-search-input:focus{outline:none;border-color:var(--primary)}
.kb-category{display:inline-block;padding:4px 10px;border-radius:12px;font-size:11px;font-weight:600;margin-right:6px;margin-bottom:6px;cursor:pointer;border:1px solid var(--border);background:white;color:var(--text-gray);transition:all 0.2s;font-family:inherit}
.kb-category:hover,.kb-category.active{background:var(--primary);color:white;border-color:var(--primary)}
.kb-item{padding:12px 16px;background:white;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer;transition:all 0.2s}
.kb-item:hover{background:var(--bg-light);border-color:var(--accent)}
.kb-item-title{font-weight:600;font-size:14px;margin-bottom:4px}
.kb-item-answer{font-size:12px;color:var(--text-gray);line-height:1.5;display:none}
.kb-item.expanded .kb-item-answer{display:block}
.kb-item-tag{font-size:11px;padding:2px 6px;border-radius:4px;background:var(--bg-light);color:var(--text-gray);margin-top:6px;display:inline-block}

/* ====== PHASE 3: ANALYTICS MINI WIDGET ====== */
.analytics-mini{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}
.analytics-mini-card{background:white;border:1px solid var(--border);border-radius:8px;padding:14px;text-align:center}
.analytics-mini-val{font-size:22px;font-weight:700;color:var(--primary)}
.analytics-mini-label{font-size:11px;color:var(--text-gray);margin-top:4px}

@media(max-width:768px){.main-container{grid-template-columns:1fr}.sidebar{display:none}.modal{width:95%;max-width:none;border-radius:16px 16px 0 0;position:fixed;bottom:0;left:0;right:0;top:auto;max-height:90vh;margin:0}}
</style>
</head>
<body>
<div class="toast-container" id="toastContainer"></div>
<nav class="navbar">
<div class="navbar-left">
<div class="logo" onclick="window.location.href='index.html'"><div class="logo-icon">🍅</div>番茄旅行AI</div>
<span class="role-badge">🏢 供应商后台</span>
<span class="online-badge"><span class="online-dot"></span> 在线</span>
</div>
<div class="navbar-right">
<div class="supplier-info" id="supplierInfo">
<div class="supplier-avatar" id="supplierAvatar">-</div>
<div>
<div class="supplier-name" id="supplierName">-</div>
<div style="font-size:11px;color:var(--text-gray)" id="supplierIdDisplay">-</div>
</div>
</div>
<button class="sound-toggle" id="soundToggle" onclick="toggleSound()" title="提示音">🔔 开</button>
<button class="logout-btn" onclick="logout()">退出</button>
<a href="index.html" class="logout-btn" style="background:var(--bg-light);color:var(--primary)">← 返回</a>
</div>
</nav>

<div class="main-container">
<aside class="sidebar">
<div class="sidebar-title">菜单</div>
<div class="sidebar-menu">
<div class="sidebar-item active" onclick="switchPage('dashboard')" id="menuDashboard">📊 仪表板 <span class="sidebar-item-badge" id="badgeDashboard" style="display:none">0</span></div>
<div class="sidebar-item" onclick="switchPage('orders')" id="menuOrders">📋 订单列表 <span class="sidebar-item-badge" id="badgeOrders" style="display:none">0</span></div>
<div class="sidebar-item" onclick="switchPage('chat')" id="menuChat">💬 沟通 <span class="sidebar-item-badge" id="badgeChat" style="display:none">0</span></div>
<div class="sidebar-item" onclick="switchPage('templates')" id="menuTemplates">💌 自动回复</div>
<div class="sidebar-item" onclick="switchPage('knowledge')" id="menuKnowledge">📚 知识库</div>
<div class="sidebar-item" onclick="switchPage('settings')" id="menuSettings">⚙️ 设置</div>
</div>
</aside>

<main class="content">
<!-- Dashboard Page -->
<div id="dashboard" class="page active">
<h1 class="page-title">📊 仪表板</h1>
<div class="stats-grid">
<div class="stat-card"><div class="stat-value" id="statTotal">0</div><div class="stat-label">总订单数</div><div class="stat-change">↗ 较上月</div></div>
<div class="stat-card"><div class="stat-value" id="statPending" style="color:#FF9800">0</div><div class="stat-label">待报价</div><div class="stat-change" id="statPendingChange"></div></div>
<div class="stat-card"><div class="stat-value" id="statQuoted" style="color:#2E7D32">0</div><div class="stat-label">已报价</div></div>
<div class="stat-card"><div class="stat-value" id="statConfirmed" style="color:#1565C0">0</div><div class="stat-label">已确认</div></div>
</div>
<div class="analytics-mini">
<div class="analytics-mini-card"><div class="analytics-mini-val" id="statRevenue">¥0</div><div class="analytics-mini-label">累计收入</div></div>
<div class="analytics-mini-card"><div class="analytics-mini-val" id="statRate">0%</div><div class="analytics-mini-label">转化率</div></div>
</div>
<div style="background:white;border-radius:12px;padding:20px;border:1px solid var(--border);margin-top:24px">
<h3 style="margin-bottom:16px">📋 最近订单</h3>
<div id="recentOrdersList"></div>
</div>
</div>

<!-- Orders Page -->
<div id="orders" class="page">
<h1 class="page-title">📋 订单列表</h1>
<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
<select id="orderStatusFilter" onchange="renderOrdersList()" style="padding:8px 14px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:white">
<option value="">全部状态</option>
<option value="pending">待报价</option>
<option value="quoted">已报价</option>
<option value="confirmed">已确认</option>
<option value="completed">已完成</option>
</select>
<button class="btn btn-secondary" onclick="document.getElementById('orderStatusFilter').value='';renderOrdersList()">清除筛选</button>
</div>
<div class="orders-list" id="ordersListContainer"></div>
</div>

<!-- Chat Page -->
<div id="chat" class="page">
<h1 class="page-title">💬 沟通</h1>
<div style="display:grid;grid-template-columns:280px 1fr;gap:16px;min-height:600px">
<div style="background:white;border-radius:12px;border:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
<div style="padding:12px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:14px">选择订单</div>
<div id="chatOrderList" style="flex:1;overflow-y:auto;padding:8px"></div>
</div>
<div class="chat-container" id="chatBox" style="display:none">
<div class="chat-header">
<div class="chat-header-info">
<div class="chat-header-avatar" id="chatHeaderAvatar">?</div>
<div><div class="chat-header-name" id="chatHeaderName">-</div><div class="chat-header-sub" id="chatHeaderSub">-</div></div>
</div>
<div style="display:flex;align-items:center;gap:8px">
<span class="online-badge"><span class="online-dot"></span> 在线</span>
<button class="modal-close" onclick="closeChatView()" style="width:28px;height:28px;font-size:14px">×</button>
</div>
</div>
<div class="chat-messages" id="chatMessages"></div>
<div class="chat-typing" id="chatTyping">对方正在输入...</div>
<div class="chat-input-area">
<input type="text" class="chat-input" id="chatInputField" placeholder="输入消息，按 Enter 发送..." onkeypress="if(event.key==='Enter')sendSupplierMessage()">
<button class="chat-send" onclick="sendSupplierMessage()">➤</button>
</div>
</div>
<div id="noChatView" style="background:white;border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;min-height:400px;color:var(--text-gray);font-size:14px">
请从左侧选择一个订单开始沟通
</div>
</div>
</div>

<!-- ====== PHASE 2: AUTO REPLY TEMPLATES PAGE ====== -->
<div id="templates" class="page">
<h1 class="page-title">💌 自动回复模板</h1>
<div style="background:white;border-radius:12px;padding:20px;border:1px solid var(--border);margin-bottom:20px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
<div>
<div style="font-weight:600;margin-bottom:4px">自动回复总开关</div>
<div style="font-size:12px;color:var(--text-gray)">开启后，当客户发消息时自动发送已启用的模板</div>
</div>
<button class="btn btn-accent" id="globalAutoReplyToggle" onclick="toggleGlobalAutoReply()" style="padding:8px 16px">开启</button>
</div>
<div style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-light);border-radius:8px;font-size:13px">
<span>💡</span>
<span style="color:var(--text-gray)">自动回复仅在 <strong>首次</strong> 客户发消息时触发，避免打扰正常沟通</span>
</div>
</div>
<div id="templatesList"></div>
<button class="add-template-btn" onclick="openTemplateModal()">
<span>➕</span> 添加回复模板
</button>
</div>

<!-- ====== PHASE 2: KNOWLEDGE BASE PAGE ====== -->
<div id="knowledge" class="page">
<h1 class="page-title">📚 知识库 <span style="font-size:14px;color:var(--text-gray);font-weight:400">IMA 智能对接</span></h1>
<div style="background:white;border-radius:12px;padding:20px;border:1px solid var(--border);margin-bottom:20px">
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
<div>
<div style="font-weight:600;margin-bottom:4px">🤖 IMA 知识库状态</div>
<div style="font-size:12px;color:var(--text-gray)">对接 IMA 知识库，AI 自动生成专业回复建议</div>
</div>
<div style="display:flex;align-items:center;gap:8px">
<span style="font-size:12px;color:#2E7D32;font-weight:600">✅ 已连接</span>
<button class="btn btn-secondary" onclick="syncKnowledgeBase()" style="padding:6px 12px;font-size:12px">🔄 同步</button>
</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
<div style="padding:14px;background:var(--bg-light);border-radius:8px;text-align:center">
<div style="font-size:22px;font-weight:700;color:var(--primary)" id="kbCount">0</div>
<div style="font-size:12px;color:var(--text-gray)">知识条目</div>
</div>
<div style="padding:14px;background:var(--bg-light);border-radius:8px;text-align:center">
<div style="font-size:22px;font-weight:700;color:var(--accent)" id="kbUsed">0</div>
<div style="font-size:12px;color:var(--text-gray)">被引用次数</div>
</div>
</div>
</div>
<div style="background:white;border-radius:12px;padding:20px;border:1px solid var(--border);margin-bottom:20px">
<div style="margin-bottom:12px;font-weight:600">🔍 搜索知识库</div>
<div class="kb-search-box">
<input type="text" class="kb-search-input" id="kbSearchInput" placeholder="输入关键词搜索..." oninput="searchKnowledgeBase()">
<button class="btn btn-primary" onclick="searchKnowledgeBase()" style="padding:10px 16px">搜索</button>
</div>
</div>
<div id="kbCategories" style="margin-bottom:16px"></div>
<div id="kbList"></div>
<div style="background:white;border-radius:12px;padding:20px;border:1px solid var(--border);margin-top:16px">
<div style="margin-bottom:12px;font-weight:600">➕ 添加知识条目</div>
<div class="form-group"><label class="form-label">问题/关键词</label><input type="text" class="form-input" id="kbQ" placeholder="如：签证需要多久"></div>
<div class="form-group"><label class="form-label">标准答案</label><textarea class="form-textarea" id="kbA" placeholder="输入标准回复内容"></textarea></div>
<div class="form-group"><label class="form-label">分类标签</label><input type="text" class="form-input" id="kbTag" placeholder="如：签证,常见问题"></div>
<button class="btn btn-primary" onclick="addKbItem()">添加条目</button>
</div>
</div>

<!-- Settings Page -->
<div id="settings" class="page">
<h1 class="page-title">⚙️ 设置</h1>
<div style="background:white;border-radius:12px;padding:24px;border:1px solid var(--border);max-width:500px;margin-bottom:24px">
<h3 style="margin-bottom:16px">供应商信息</h3>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">供应商名称</span><span class="detail-value" id="setName">-</span></div>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">登录账号</span><span class="detail-value" id="setUsername">-</span></div>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">邮箱</span><span class="detail-value" id="setEmail">-</span></div>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">电话</span><span class="detail-value" id="setPhone">-</span></div>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">地区</span><span class="detail-value" id="setRegion">-</span></div>
<div class="detail-row" style="margin-bottom:12px"><span class="detail-label">类型</span><span class="detail-value" id="setType">-</span></div>
</div>
<div style="background:white;border-radius:12px;padding:24px;border:1px solid var(--border);max-width:500px">
<h3 style="margin-bottom:16px">🛠️ 功能设置</h3>
<div style="margin-bottom:12px">
<label style="font-size:13px;font-weight:500;margin-bottom:6px;display:block">自动回复消息</label>
<select id="autoReplySelect" onchange="saveAutoReply()" style="width:100%;padding:8px 14px;border:1px solid var(--border);border-radius:8px;font-size:14px;background:white">
<option value="on">开启</option><option value="off">关闭</option>
</select>
<div style="font-size:12px;color:var(--text-gray);margin-top:4px">开启后，当客户发消息时会自动发送一条礼貌回复</div>
</div>
</div>
</div>
</main>
</div>

<!-- Order Detail Modal -->
<div class="modal-overlay" id="orderModal">
<div class="modal">
<div class="modal-header"><div class="modal-title">📋 订单详情</div><button class="modal-close" onclick="closeOrderModal()">×</button></div>
<div class="modal-body" id="orderModalBody"></div>
</div>
</div>

<!-- Template Modal -->
<div class="modal-overlay" id="templateModal">
<div class="modal">
<div class="modal-header"><div class="modal-title">💌 编辑回复模板</div><button class="modal-close" onclick="closeTemplateModal()">×</button></div>
<div class="modal-body" id="templateModalBody"></div>
</div