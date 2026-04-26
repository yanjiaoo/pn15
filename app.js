(function () {
  'use strict';

  var allData = null;
  var currentSection = 'news';
  var currentLevel = 'all';
  var currentTimeFilter = 'all';
  var currentSearch = '';
  var currentSentiment = 'all';
  var currentFbTimeFilter = 'all';
  var REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  // ========== switchBoard ==========

  function switchBoard(sectionId) {
    var sections = ['news', 'feedback', 'policy'];
    sections.forEach(function (id) {
      var el = document.getElementById('section-' + id);
      if (el) el.style.display = (id === sectionId) ? 'block' : 'none';
    });
    var tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
    currentSection = sectionId;
  }

  // ========== Data Loading ==========

  function loadData() {
    fetch('data.json?t=' + Date.now(), { cache: 'no-store' })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        allData = data;
        renderStats(data.stats);
        renderCompactTimeline();
        renderNews();
        renderFeedback();
        renderPolicyOverview();
      })
      .catch(function (err) {
        console.error('Failed to load data.json:', err);
      });
  }

  // ========== Stats ==========

  function renderStats(stats) {
    if (!stats) return;
    // 总文章数 = timeline + feedback 去重
    var totalEl = document.getElementById('stat-total');
    var updatedEl = document.getElementById('stat-updated');

    // 统计 unique source_name 按级别
    var l1Sources = new Set();
    var l2Sources = new Set();
    var l3Sources = new Set();
    var totalArticles = 0;

    if (allData && allData.timeline) {
      allData.timeline.forEach(function (item) {
        totalArticles++;
        if (item.source_level === 'L1') l1Sources.add(item.source_name);
        else if (item.source_level === 'L2') l2Sources.add(item.source_name);
        else if (item.source_level === 'L3') l3Sources.add(item.source_name);
      });
    }

    if (totalEl) totalEl.textContent = totalArticles || stats.total_articles || 0;

    var sbL1 = document.getElementById('sb-l1');
    var sbL2 = document.getElementById('sb-l2');
    var sbL3 = document.getElementById('sb-l3');
    if (sbL1) sbL1.textContent = l1Sources.size + ' 家 官方政府';
    if (sbL2) sbL2.textContent = l2Sources.size + ' 家 专业机构';
    if (sbL3) sbL3.textContent = l3Sources.size + ' 家 行业媒体';

    if (updatedEl && stats.last_updated) {
      var d = new Date(stats.last_updated);
      updatedEl.textContent = d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
  }

  // ========== Compact Timeline Bar ==========

  function renderCompactTimeline() {
    var container = document.getElementById('compact-timeline');
    if (!container || !allData) return;
    var milestones = allData.policy_timeline || [];
    if (milestones.length === 0) return;

    var html = '<div class="ct-track">';
    milestones.forEach(function (m, i) {
      var typeClass = 'ct-type-' + (m.type || 'milestone');
      var tooltip = escapeHtml(m.description || m.title || '');
      html += '<div class="ct-item ' + typeClass + '" title="' + tooltip + '">';
      html += '<span class="ct-date">' + (m.date || '') + '</span>';
      html += '<span class="ct-dot"></span>';
      html += '<span class="ct-title">' + escapeHtml(m.title || '') + '</span>';
      html += '<span class="ct-desc">' + escapeHtml((m.description || '').substring(0, 60)) + (m.description && m.description.length > 60 ? '...' : '') + '</span>';
      html += '</div>';
      if (i < milestones.length - 1) html += '<div class="ct-connector">\u2192</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ========== News Section ==========

  function renderNews() {
    if (!allData) return;

    // 重点关注 — 仅显示 L1 最新 3 条
    var hlArea = document.getElementById('highlights-area');
    if (hlArea) {
      var timeline = allData.timeline || [];
      var l1Latest = timeline.filter(function (x) { return x.source_level === 'L1'; })
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .slice(0, 3);

      if (l1Latest.length > 0) {
        var hlHtml = '<h3 class="area-title">\uD83D\uDD25 重点关注（L1最新3条）</h3><div class="highlights-grid">';
        l1Latest.forEach(function (h) { hlHtml += createHighlightCard(h); });
        hlHtml += '</div>';
        hlArea.innerHTML = hlHtml;
      } else {
        hlArea.innerHTML = '';
      }
    }

    // 热议目录 TOC
    renderNewsTOC();

    // 详情列表
    var listEl = document.getElementById('timeline-list');
    if (!listEl) return;

    var items = filterByLevel(filterByTime(allData.timeline || [], currentTimeFilter), currentLevel);
    if (currentSearch) {
      var q = currentSearch.toLowerCase();
      items = items.filter(function (item) {
        var text = (item.title || '') + ' ' + (item.source_name || '') + ' ' + (item.summary || '');
        return text.toLowerCase().indexOf(q) !== -1;
      });
    }

    if (items.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无匹配内容</div>';
      return;
    }

    // 详情列表按日期倒序
    items.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    var html = '<h3 class="area-title">\uD83D\uDCF0 详情列表</h3>';
    items.forEach(function (item) { html += createNewsCard(item); });
    listEl.innerHTML = html;
  }

  // ========== News TOC (按 L1/L2/L3 分组热议目录) ==========

  function renderNewsTOC() {
    var container = document.getElementById('news-toc');
    if (!container || !allData) return;

    var timeline = allData.timeline || [];
    var filtered = filterByLevel(filterByTime(timeline, currentTimeFilter), currentLevel);
    if (currentSearch) {
      var q = currentSearch.toLowerCase();
      filtered = filtered.filter(function (item) {
        var text = (item.title || '') + ' ' + (item.source_name || '') + ' ' + (item.summary || '');
        return text.toLowerCase().indexOf(q) !== -1;
      });
    }

    // 按级别分组
    var groups = { L1: [], L2: [], L3: [] };
    filtered.forEach(function (item) {
      var lvl = item.source_level || 'L3';
      if (groups[lvl]) groups[lvl].push(item);
    });

    // 每组内按日期倒序
    ['L1', 'L2', 'L3'].forEach(function (lvl) {
      groups[lvl].sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    });

    var html = '<h3 class="area-title">\uD83D\uDCCB 热议目录（按L1→L2→L3分组，组内按时间倒序）</h3>';
    ['L1', 'L2', 'L3'].forEach(function (lvl) {
      if (groups[lvl].length === 0) return;
      var labelMap = { L1: 'L1 官方政府', L2: 'L2 专业机构', L3: 'L3 行业媒体' };
      html += '<div class="toc-group">';
      html += '<div class="toc-group-header"><span class="toc-level-badge level-' + lvl.toLowerCase() + '">' + lvl + '</span><span class="toc-group-title">' + labelMap[lvl] + '</span><span class="toc-group-count">共 ' + groups[lvl].length + ' 篇</span></div>';
      groups[lvl].forEach(function (item) {
        var isHot = lvl === 'L1' && (item.is_highlight || /PN15|810号|15号公告|无票免税|离境即退税/.test(item.title || ''));
        var summaryShort = (item.summary || '').substring(0, 50) + ((item.summary || '').length > 50 ? '...' : '');
        var keywords = (item.matched_keywords || []).slice(0, 3);
        html += '<div class="toc-row">';
        html += '<span class="toc-date">' + (item.date || '') + '</span>';
        if (isHot) html += '<span class="toc-hot">🔥热</span>';
        html += '<span class="toc-level-badge level-' + lvl.toLowerCase() + '">' + lvl + '</span>';
        html += '<a class="toc-summary" href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer" title="' + escapeHtml(item.summary || '') + '">' + escapeHtml(summaryShort || item.title || '') + '</a>';
        html += '<span class="toc-source">' + escapeHtml(item.source_name || '') + '</span>';
        if (keywords.length > 0) {
          html += '<span class="toc-tags">';
          keywords.forEach(function (k) {
            html += '<span class="toc-tag">' + escapeHtml(k) + '</span>';
          });
          html += '</span>';
        }
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
  }

  function createHighlightCard(item) {
    return '<div class="highlight-card">' +
      '<div class="hl-badge">' + (item.source_level || 'L3') + '</div>' +
      '<h4 class="hl-title"><a href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '无标题') + '</a></h4>' +
      '<p class="hl-summary">' + escapeHtml(item.summary || '') + '</p>' +
      '<div class="hl-meta"><span class="hl-date">' + (item.date || '') + '</span><span class="hl-sources">' + escapeHtml(item.source_name || '') + '</span></div>' +
      renderWarnings(item.warnings) +
      '</div>';
  }

  function createNewsCard(item) {
    var levelClass = 'level-' + (item.source_level || 'L3').toLowerCase();
    return '<div class="news-card' + (item.is_highlight ? ' news-highlight' : '') + '">' +
      '<div class="card-header">' +
      '<span class="level-badge ' + levelClass + '">' + (item.source_level || 'L3') + '</span>' +
      '<span class="card-date">' + (item.date || '') + '</span>' +
      '<span class="card-source">' + escapeHtml(item.source_name || '') + '</span>' +
      '</div>' +
      '<h3 class="card-title"><a href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '无标题') + '</a></h3>' +
      (item.summary ? '<p class="card-summary">' + escapeHtml(item.summary) + '</p>' : '') +
      renderWarnings(item.warnings) +
      '</div>';
  }

  // ========== Feedback Section ==========

  function renderFeedback() {
    if (!allData) return;

    var hotArea = document.getElementById('hot-topics-area');
    if (hotArea) {
      var dist = (allData.stats && allData.stats.sentiment_distribution) || {};
      var hotHtml = '<h3 class="area-title">\uD83D\uDCCA 情绪分布</h3><div class="sentiment-dist">';
      var labels = ['\uD83D\uDE30焦虑', '\uD83D\uDE21不满', '\uD83D\uDE10观望', '\uD83D\uDCA1求助', '\u2705积极', '\u26A0\uFE0F恐慌'];
      labels.forEach(function (label) {
        var count = dist[label] || 0;
        hotHtml += '<div class="dist-item"><span class="dist-label">' + label + '</span><span class="dist-count">' + count + '</span></div>';
      });
      hotHtml += '</div>';
      hotArea.innerHTML = hotHtml;
    }

    var listEl = document.getElementById('feedback-list');
    if (!listEl) return;

    var items = filterBySentiment(filterByTime(allData.feedback || [], currentFbTimeFilter), currentSentiment);
    if (items.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无匹配反馈</div>';
      return;
    }
    items.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var html = '';
    items.forEach(function (item) { html += createFeedbackCard(item); });
    listEl.innerHTML = html;
  }

  function createFeedbackCard(item) {
    var sentimentClass = getSentimentClass(item.sentiment_label);
    var keywords = (item.matched_keywords || []).join('\u3001');
    return '<div class="feedback-card">' +
      '<div class="fb-header">' +
      '<span class="sentiment-badge ' + sentimentClass + '">' + (item.sentiment_label || '\uD83D\uDE10观望') + '</span>' +
      '<span class="card-date">' + (item.date || '') + '</span>' +
      '<span class="card-source">' + escapeHtml(item.source || '') + '</span>' +
      '</div>' +
      '<h3 class="card-title"><a href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '无标题') + '</a></h3>' +
      (item.summary ? '<p class="card-summary">' + escapeHtml(item.summary) + '</p>' : '') +
      (keywords ? '<div class="fb-keywords">关键词：' + escapeHtml(keywords) + '</div>' : '') +
      '</div>';
  }

  function getSentimentClass(label) {
    var map = {
      '\uD83D\uDE30焦虑': 'sent-anxious',
      '\uD83D\uDE21不满': 'sent-angry',
      '\uD83D\uDE10观望': 'sent-neutral',
      '\uD83D\uDCA1求助': 'sent-help',
      '\u2705积极': 'sent-positive',
      '\u26A0\uFE0F恐慌': 'sent-panic'
    };
    return map[label] || 'sent-neutral';
  }

  // ========== Policy Overview ==========

  function renderPolicyOverview() {
    var container = document.getElementById('policy-content');
    if (!container || !allData) return;
    var milestones = allData.policy_timeline || [];
    var html = '';

    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83D\uDCC5 政策时间线</h2>';
    html += '<div class="full-timeline">';
    milestones.forEach(function (m) {
      var typeClass = 'ft-type-' + (m.type || 'milestone');
      html += '<div class="ft-item ' + typeClass + '">';
      html += '<div class="ft-date">' + (m.date || '') + '</div>';
      html += '<div class="ft-content"><strong>' + escapeHtml(m.title || '') + '</strong><p>' + escapeHtml(m.description || '') + '</p></div>';
      html += '</div>';
    });
    html += '</div></div>';

    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83C\uDF0D 影响范围</h2>';
    html += '<div class="impact-box"><p>影响所有中国境内卖家，无论在哪个亚马逊商城销售商品。</p></div>';
    html += '</div>';

    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83D\uDCB0 增值税（VAT）</h2>';
    html += '<table class="policy-table"><thead><tr><th>纳税人类型</th><th>条件</th><th>税率</th></tr></thead><tbody>';
    html += '<tr><td>小规模纳税人</td><td>季度\u226430万</td><td>免征</td></tr>';
    html += '<tr><td>小规模纳税人</td><td>季度&gt;30万</td><td>1%</td></tr>';
    html += '<tr><td>一般纳税人</td><td>年销售额&gt;500万</td><td>13%（可抵扣进项）</td></tr>';
    html += '</tbody></table></div>';

    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83C\uDFE2 企业所得税</h2>';
    html += '<table class="policy-table"><thead><tr><th>企业类型</th><th>条件</th><th>税率</th></tr></thead><tbody>';
    html += '<tr><td>小微企业</td><td>年应纳税所得额\u2264300万</td><td>5%</td></tr>';
    html += '<tr><td>普通企业</td><td>年应纳税所得额&gt;300万</td><td>25%</td></tr>';
    html += '<tr><td>高新技术企业</td><td>认定后</td><td>15%</td></tr>';
    html += '</tbody></table></div>';

    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83D\uDEA2 出口模式</h2>';
    html += '<div class="export-modes">';
    var modes = [
      { code: '9810', name: '跨境电商出口海外仓', desc: '先批量出口至海外仓再配送', scope: '适用海关注册跨境电商企业', note: '需备案海外仓' },
      { code: '9710', name: '跨境电商B2B直接出口', desc: '通过跨境电商平台完成B2B交易直接出口', scope: '适用海关注册跨境电商企业', note: '' },
      { code: '9610', name: '跨境电商零售出口', desc: '清单核放汇总申报小包裹直邮', scope: '适用综试区注册企业', note: '可享无票免税（仅深圳有明确发文）' },
      { code: '1039', name: '市场采购贸易', desc: '市场集聚区采购单票\u226415万美元', scope: '适用试点区域市场经营户', note: '免征增值税不退税' },
      { code: '0110', name: '一般贸易出口', desc: '传统自营/代理报关出口', scope: '适用有进出口经营权企业', note: '需增值税专用发票退税率0-13%' }
    ];
    modes.forEach(function (m) {
      html += '<div class="export-card">';
      html += '<div class="ec-code">' + m.code + '</div>';
      html += '<div class="ec-body">';
      html += '<h4>' + escapeHtml(m.name) + '</h4>';
      html += '<p>' + escapeHtml(m.desc) + '</p>';
      html += '<div class="ec-scope">' + escapeHtml(m.scope) + '</div>';
      if (m.note) html += '<div class="ec-note">' + escapeHtml(m.note) + '</div>';
      html += '</div></div>';
    });
    html += '</div></div>';

    container.innerHTML = html;
  }

  // ========== Filter Functions ==========

  function filterByLevel(items, level) {
    if (!level || level === 'all') return items;
    return items.filter(function (item) { return item.source_level === level; });
  }

  function filterByTime(items, timeFilter) {
    if (!timeFilter || timeFilter === 'all') return items;
    var now = new Date();
    var days = 0;
    if (timeFilter === '7d') days = 7;
    else if (timeFilter === '30d') days = 30;
    else if (timeFilter === '90d') days = 90;
    else return items;
    var cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    var cutoffStr = cutoff.toISOString().slice(0, 10);
    return items.filter(function (item) { return (item.date || '') >= cutoffStr; });
  }

  function filterBySentiment(items, sentiment) {
    if (!sentiment || sentiment === 'all') return items;
    return items.filter(function (item) { return item.sentiment_label === sentiment; });
  }

  // ========== Utilities ==========

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function renderWarnings(warnings) {
    if (!warnings || warnings.length === 0) return '';
    var html = '<div class="card-warnings">';
    warnings.forEach(function (w) {
      html += '<span class="warning-tag">\u26A0\uFE0F ' + escapeHtml(w) + '</span>';
    });
    html += '</div>';
    return html;
  }

  // ========== Upload: Single ==========

  function handleSingleUpload() {
    var urlInput = document.getElementById('manual-url');
    var sectionSelect = document.getElementById('manual-section');
    var sentimentSelect = document.getElementById('manual-sentiment');
    var statusEl = document.getElementById('upload-status');

    if (!urlInput || !urlInput.value.trim()) {
      if (statusEl) statusEl.innerHTML = '<div class="status-err">请输入文章URL</div>';
      return;
    }
    var url = urlInput.value.trim();
    if (!/^https?:\/\//.test(url)) {
      if (statusEl) statusEl.innerHTML = '<div class="status-err">URL必须以http://或https://开头</div>';
      return;
    }

    var result = addUrlToData(url, (sectionSelect && sectionSelect.value) || 'auto', (sentimentSelect && sentimentSelect.value) || '');
    if (result.duplicate) {
      statusEl.innerHTML = '<div class="status-warn">该URL已存在于数据库中</div>';
      return;
    }

    rerenderAfterUpload();
    var info = '<div class="status-ok">';
    info += '<strong>\u2705 成功添加文章</strong><br>';
    info += '<small>标题: ' + escapeHtml(result.detected.title) + '<br>';
    info += '来源: ' + escapeHtml(result.detected.source_name) + ' (' + result.detected.source_level + ')<br>';
    info += '板块: ' + (result.addedNews ? '最新资讯' : '') + (result.addedFeedback ? (result.addedNews ? ' + 卖家反馈' : '卖家反馈') : '') + '</small>';
    info += '<br><button onclick="downloadDataJson()" class="download-btn">\uD83D\uDCE5 下载 data.json</button>';
    info += '<p class="note">下载后请将新的 data.json 上传到 GitHub 替换旧文件</p>';
    info += '</div>';
    statusEl.innerHTML = info;
    urlInput.value = '';
  }

  // ========== Upload: Bulk CSV ==========

  function handleBulkUpload() {
    var fileInput = document.getElementById('bulk-file');
    var statusEl = document.getElementById('upload-status');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      if (statusEl) statusEl.innerHTML = '<div class="status-err">请选择 CSV 文件</div>';
      return;
    }
    var file = fileInput.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
      if (lines.length > 0 && /^url$/i.test(lines[0])) lines = lines.slice(1);

      var addedNews = 0, addedFeedback = 0, duplicates = 0, errors = 0;
      var details = [];
      lines.forEach(function (url) {
        url = url.replace(/^"|"$/g, '').trim();
        if (!/^https?:\/\//.test(url)) { errors++; return; }
        var r = addUrlToData(url, 'auto', '');
        if (r.duplicate) { duplicates++; return; }
        if (r.addedNews) addedNews++;
        if (r.addedFeedback) addedFeedback++;
        details.push({ url: url, title: r.detected.title, level: r.detected.source_level });
      });
      rerenderAfterUpload();

      var html = '<div class="status-ok">';
      html += '<strong>\uD83D\uDCCB 批量导入完成</strong><br>';
      html += '<small>新增最新资讯: ' + addedNews + ' 条 &middot; 新增卖家反馈: ' + addedFeedback + ' 条 &middot; 跳过重复: ' + duplicates + ' 条 &middot; 格式错误: ' + errors + ' 条</small>';
      if (details.length > 0) {
        html += '<details class="bulk-details"><summary>查看明细</summary><ul>';
        details.forEach(function (d) {
          html += '<li>[' + d.level + '] ' + escapeHtml(d.title) + '</li>';
        });
        html += '</ul></details>';
      }
      html += '<br><button onclick="downloadDataJson()" class="download-btn">\uD83D\uDCE5 下载 data.json</button>';
      html += '<p class="note">下载后请将新的 data.json 上传到 GitHub 替换旧文件</p>';
      html += '</div>';
      statusEl.innerHTML = html;
      fileInput.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  }

  // ========== URL → Article ==========

  function addUrlToData(url, section, sentiment) {
    var existingUrls = new Set();
    (allData.timeline || []).forEach(function (a) { existingUrls.add(a.url); });
    (allData.feedback || []).forEach(function (a) { existingUrls.add(a.url); });
    if (existingUrls.has(url)) return { duplicate: true };

    var detected = detectFromUrl(url);
    section = section || detected.section;
    sentiment = sentiment || detected.sentiment;
    var today = new Date().toISOString().slice(0, 10);

    var entry = {
      title: detected.title,
      url: url,
      date: today,
      source_name: detected.source_name,
      source_level: detected.source_level,
      display_level: detected.source_level === 'L1' ? 'full' : (detected.source_level === 'L2' ? 'summary' : 'title_only'),
      summary: detected.summary,
      warnings: detected.warnings,
      is_highlight: false,
      matched_keywords: []
    };

    var addedNews = 0, addedFeedback = 0;
    if (section === 'news' || section === 'both' || section === 'auto') {
      if (!allData.timeline) allData.timeline = [];
      allData.timeline.push(entry);
      addedNews++;
    }
    if (section === 'feedback' || section === 'both' || (section === 'auto' && detected.hasSellerFeedback)) {
      if (!allData.feedback) allData.feedback = [];
      allData.feedback.push({
        title: detected.title,
        url: url,
        date: today,
        source: detected.source_name,
        sentiment_label: sentiment || '\uD83D\uDE10观望',
        matched_keywords: [],
        summary: detected.summary
      });
      addedFeedback++;
    }
    return { duplicate: false, detected: detected, addedNews: addedNews, addedFeedback: addedFeedback };
  }

  function rerenderAfterUpload() {
    if (allData.timeline) allData.timeline.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (allData.feedback) allData.feedback.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    if (allData.stats) {
      allData.stats.total_articles = (allData.timeline || []).length;
      allData.stats.feedback_count = (allData.feedback || []).length;
    }
    renderStats(allData.stats);
    renderNews();
    renderFeedback();
  }

  function detectFromUrl(url) {
    var result = {
      title: url,
      source_name: '未知来源',
      source_level: 'L3',
      summary: '',
      warnings: [],
      section: 'news',
      sentiment: '',
      hasSellerFeedback: false,
      keywords: []
    };
    try {
      var u = new URL(url);
      var host = u.hostname.toLowerCase().replace(/^www\./, '');
      var sourceMap = {
        'gov.cn': { name: '中国政府网', level: 'L1' },
        'chinatax.gov.cn': { name: '国家税务总局', level: 'L1' },
        'fgk.chinatax.gov.cn': { name: '国家税务总局法规库', level: 'L1' },
        'commerce.sz.gov.cn': { name: '深圳市商务局', level: 'L1' },
        'sz.gov.cn': { name: '深圳市政府', level: 'L1' },
        'mofcom.gov.cn': { name: '商务部', level: 'L1' },
        'customs.gov.cn': { name: '海关总署', level: 'L1' },
        'cifnews.com': { name: '雨果跨境', level: 'L3' },
        'ebrun.com': { name: '亿邦动力', level: 'L3' },
        'amz123.com': { name: 'AMZ123', level: 'L3' },
        '10100.com': { name: '大数跨境', level: 'L3' },
        'mjzj.com': { name: '卖家之家', level: 'L3' },
        'egainnews.com': { name: '跨境电商笔记', level: 'L3' },
        'wearesellers.com': { name: '知无不言', level: 'L3' },
        'baijing.cn': { name: '白鲸出海', level: 'L3' },
        'ikjds.com': { name: 'ikjds', level: 'L3' },
        'dianshangwin.com': { name: '电商赢', level: 'L3' },
        'pwccn.com': { name: '普华永道中国', level: 'L2' },
        'deloitte.com': { name: '德勤中国', level: 'L2' },
        'kpmg.com': { name: '毕马威中国', level: 'L2' },
        'ey.com': { name: '安永中国', level: 'L2' },
        'kwm.com': { name: '金杜律师事务所', level: 'L2' },
        'zhonglun.com': { name: '中伦律师事务所', level: 'L2' },
        'szceb.cn': { name: '深圳跨境电商综试区', level: 'L2' },
        'mp.weixin.qq.com': { name: '微信公众号', level: 'L3' }
      };
      for (var key in sourceMap) {
        if (host === key || host.endsWith('.' + key)) {
          result.source_name = sourceMap[key].name;
          result.source_level = sourceMap[key].level;
          break;
        }
      }
      if (result.source_name === '未知来源' && host.match(/^[a-z]+\.chinatax\.gov\.cn$/)) {
        var provMap = { 'beijing': '北京', 'shanghai': '上海', 'guangdong': '广东', 'zhejiang': '浙江', 'jiangsu': '江苏', 'shandong': '山东', 'sichuan': '四川', 'hubei': '湖北', 'fujian': '福建', 'hunan': '湖南', 'henan': '河南', 'hebei': '河北', 'anhui': '安徽', 'liaoning': '辽宁', 'heilongjiang': '黑龙江', 'jilin': '吉林', 'shanxi': '山西', 'shaanxi': '陕西', 'gansu': '甘肃', 'qinghai': '青海', 'guizhou': '贵州', 'yunnan': '云南', 'guangxi': '广西', 'neimenggu': '内蒙古', 'xinjiang': '新疆', 'xizang': '西藏', 'ningxia': '宁夏', 'hainan': '海南', 'chongqing': '重庆', 'tianjin': '天津', 'jiangxi': '江西' };
        var prov = host.split('.')[0];
        result.source_name = (provMap[prov] || prov) + '省税务局';
        result.source_level = 'L1';
      }
      var pathParts = u.pathname.split('/').filter(function (p) { return p; });
      var lastPart = pathParts[pathParts.length - 1] || '';
      var articleId = lastPart.replace(/\.(html|htm|shtml|aspx|php)$/, '');
      result.title = result.source_name + ' - 文章 ' + articleId;
      result.summary = '从 ' + result.source_name + ' 导入的文章。请访问原文查看详情：' + url;
      var whitelist = ['gov.cn', 'chinatax.gov.cn', 'commerce.sz.gov.cn', 'sz.gov.cn', 'mofcom.gov.cn', 'customs.gov.cn', 'cifnews.com', 'ebrun.com', 'amz123.com', '10100.com', 'mjzj.com', 'egainnews.com', 'wearesellers.com', 'baijing.cn', 'ikjds.com', 'dianshangwin.com', 'pwccn.com', 'deloitte.com', 'kpmg.com', 'ey.com', 'kwm.com', 'zhonglun.com', 'szceb.cn', 'weixin.qq.com'];
      var inWhitelist = false;
      for (var i = 0; i < whitelist.length; i++) {
        if (host === whitelist[i] || host.endsWith('.' + whitelist[i])) { inWhitelist = true; break; }
      }
      if (!inWhitelist) result.warnings = ['\u26A0\uFE0F 来源不在白名单，请核实信息真实性'];
      var feedbackSources = ['wearesellers.com', 'amz123.com', '10100.com', 'baijing.cn', 'mp.weixin.qq.com'];
      for (var j = 0; j < feedbackSources.length; j++) {
        if (host === feedbackSources[j] || host.endsWith('.' + feedbackSources[j])) {
          result.hasSellerFeedback = true;
          result.section = 'both';
          result.sentiment = '\uD83D\uDE30\u7126\u8651';
          break;
        }
      }
    } catch (e) {
      console.error('URL parse error:', e);
    }
    return result;
  }

  function downloadDataJson() {
    if (!allData) return;
    var blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  }
  window.downloadDataJson = downloadDataJson;

  // ========== Event Binding ==========

  function initEvents() {
    document.querySelectorAll('.nav-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchBoard(tab.dataset.section); });
    });

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentLevel = btn.dataset.level;
        renderNews();
      });
    });

    document.querySelectorAll('.time-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentTimeFilter = btn.dataset.time;
        renderNews();
      });
    });

    var searchInput = document.getElementById('news-search');
    if (searchInput) {
      var debounceTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          currentSearch = searchInput.value.trim();
          renderNews();
        }, 300);
      });
    }

    document.querySelectorAll('.sentiment-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sentiment-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSentiment = btn.dataset.sentiment;
        renderFeedback();
      });
    });

    document.querySelectorAll('.fb-time-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.fb-time-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFbTimeFilter = btn.dataset.time;
        renderFeedback();
      });
    });

    var refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () { loadData(); });
    }

    // Upload modal open/close
    var uploadBtn = document.getElementById('upload-btn');
    var uploadModal = document.getElementById('upload-modal');
    var uploadClose = document.getElementById('upload-close');

    if (uploadBtn) uploadBtn.addEventListener('click', function () { uploadModal.style.display = 'flex'; });
    if (uploadClose) uploadClose.addEventListener('click', function () { uploadModal.style.display = 'none'; });
    if (uploadModal) uploadModal.addEventListener('click', function (e) { if (e.target === uploadModal) uploadModal.style.display = 'none'; });

    // Upload tabs
    document.querySelectorAll('.upload-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        document.querySelectorAll('.upload-tab').forEach(function (t) { t.classList.remove('active'); });
        document.querySelectorAll('.upload-pane').forEach(function (p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var pane = document.getElementById('upload-pane-' + tab.dataset.tab);
        if (pane) pane.classList.add('active');
      });
    });

    var singleBtn = document.getElementById('upload-submit');
    if (singleBtn) singleBtn.addEventListener('click', handleSingleUpload);
    var bulkBtn = document.getElementById('bulk-submit');
    if (bulkBtn) bulkBtn.addEventListener('click', handleBulkUpload);
  }

  // ========== Init ==========

  document.addEventListener('DOMContentLoaded', function () {
    initEvents();
    loadData();
    setInterval(loadData, REFRESH_INTERVAL);
  });
})();
