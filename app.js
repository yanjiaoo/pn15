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
      if (el) {
        el.style.display = (id === sectionId) ? 'block' : 'none';
      }
    });
    var tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.section === sectionId);
    });
    currentSection = sectionId;
  }

  // ========== Data Loading ==========

  function loadData() {
    fetch('data.json?t=' + Date.now())
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
    var totalEl = document.getElementById('stat-total');
    var sourcesEl = document.getElementById('stat-sources');
    var updatedEl = document.getElementById('stat-updated');

    if (totalEl) totalEl.textContent = stats.total_articles || 0;
    if (sourcesEl) {
      sourcesEl.textContent = (stats.l1_count || 0) + '+' + (stats.l2_count || 0) + '+' + (stats.l3_count || 0);
    }
    if (updatedEl && stats.last_updated) {
      var d = new Date(stats.last_updated);
      updatedEl.textContent = d.toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
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
      html += '<div class="ct-item ' + typeClass + '">';
      html += '<span class="ct-date">' + (m.date || '') + '</span>';
      html += '<span class="ct-dot"></span>';
      html += '<span class="ct-title">' + (m.title || '') + '</span>';
      html += '</div>';
      if (i < milestones.length - 1) {
        html += '<div class="ct-connector">\u2192</div>';
      }
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ========== News Section ==========

  function renderNews() {
    if (!allData) return;

    // Render highlights
    var hlArea = document.getElementById('highlights-area');
    if (hlArea) {
      var highlights = allData.highlights || [];
      if (highlights.length > 0) {
        var hlHtml = '<h3 class="area-title">\uD83D\uDD25 重点关注</h3><div class="highlights-grid">';
        highlights.forEach(function (h) {
          hlHtml += createHighlightCard(h);
        });
        hlHtml += '</div>';
        hlArea.innerHTML = hlHtml;
      } else {
        hlArea.innerHTML = '';
      }
    }

    // Render timeline list
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

    var html = '';
    items.forEach(function (item) {
      html += createNewsCard(item);
    });
    listEl.innerHTML = html;
  }

  function createHighlightCard(item) {
    var sources = (item.matched_sources || []).join('\u3001') || item.source_name || '';
    return '<div class="highlight-card">' +
      '<div class="hl-badge">' + (item.source_level || 'L3') + '</div>' +
      '<h4 class="hl-title"><a href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '无标题') + '</a></h4>' +
      '<p class="hl-summary">' + escapeHtml(item.summary || '') + '</p>' +
      '<div class="hl-meta"><span class="hl-date">' + (item.date || '') + '</span><span class="hl-sources">' + escapeHtml(sources) + '</span></div>' +
      renderWarnings(item.warnings) +
      '</div>';
  }

  function createNewsCard(item) {
    var levelClass = 'level-' + (item.source_level || 'L3').toLowerCase();
    var dl = item.display_level || 'title_only';
    var summaryHtml = '';
    if ((dl === 'full' || dl === 'summary') && item.summary) {
      summaryHtml = '<p class="card-summary">' + escapeHtml(item.summary) + '</p>';
    }
    return '<div class="news-card' + (item.is_highlight ? ' news-highlight' : '') + '">' +
      '<div class="card-header">' +
      '<span class="level-badge ' + levelClass + '">' + (item.source_level || 'L3') + '</span>' +
      '<span class="card-date">' + (item.date || '') + '</span>' +
      '<span class="card-source">' + escapeHtml(item.source_name || '') + '</span>' +
      '</div>' +
      '<h3 class="card-title"><a href="' + (item.url || '#') + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(item.title || '无标题') + '</a></h3>' +
      summaryHtml +
      renderWarnings(item.warnings) +
      '</div>';
  }

  // ========== Feedback Section ==========

  function renderFeedback() {
    if (!allData) return;

    // Render hot topics / sentiment distribution
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

    // Render feedback list
    var listEl = document.getElementById('feedback-list');
    if (!listEl) return;

    var items = filterBySentiment(filterByTime(allData.feedback || [], currentFbTimeFilter), currentSentiment);

    if (items.length === 0) {
      listEl.innerHTML = '<div class="empty-state">暂无匹配反馈</div>';
      return;
    }

    var html = '';
    items.forEach(function (item) {
      html += createFeedbackCard(item);
    });
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

    // Full policy timeline
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

    // Impact scope
    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83C\uDF0D 影响范围</h2>';
    html += '<div class="impact-box"><p>影响所有中国境内卖家，无论在哪个亚马逊商城销售商品。</p></div>';
    html += '</div>';

    // VAT table
    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83D\uDCB0 增值税（VAT）</h2>';
    html += '<table class="policy-table"><thead><tr><th>纳税人类型</th><th>条件</th><th>税率</th></tr></thead><tbody>';
    html += '<tr><td>小规模纳税人</td><td>季度\u226430万</td><td>免征</td></tr>';
    html += '<tr><td>小规模纳税人</td><td>季度&gt;30万</td><td>1%</td></tr>';
    html += '<tr><td>一般纳税人</td><td>年销售额&gt;500万</td><td>13%（可抵扣进项）</td></tr>';
    html += '</tbody></table></div>';

    // Corporate Income Tax table
    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83C\uDFE2 企业所得税</h2>';
    html += '<table class="policy-table"><thead><tr><th>企业类型</th><th>条件</th><th>税率</th></tr></thead><tbody>';
    html += '<tr><td>小微企业</td><td>年应纳税所得额\u2264300万</td><td>5%</td></tr>';
    html += '<tr><td>普通企业</td><td>年应纳税所得额&gt;300万</td><td>25%</td></tr>';
    html += '<tr><td>高新技术企业</td><td>认定后</td><td>15%</td></tr>';
    html += '</tbody></table></div>';

    // Export modes
    html += '<div class="policy-section">';
    html += '<h2 class="policy-title">\uD83D\uDEA2 出口模式</h2>';
    html += '<div class="export-modes">';

    var modes = [
      {code:'9810', name:'跨境电商出口海外仓', desc:'先批量出口至海外仓再配送', scope:'适用海关注册跨境电商企业', note:'需备案海外仓'},
      {code:'9710', name:'跨境电商B2B直接出口', desc:'通过跨境电商平台完成B2B交易直接出口', scope:'适用海关注册跨境电商企业', note:''},
      {code:'9610', name:'跨境电商零售出口', desc:'清单核放汇总申报小包裹直邮', scope:'适用综试区注册企业', note:'可享无票免税（仅深圳有明确发文）'},
      {code:'1039', name:'市场采购贸易', desc:'市场集聚区采购单票\u226415万美元', scope:'适用试点区域市场经营户', note:'免征增值税不退税'},
      {code:'0110', name:'一般贸易出口', desc:'传统自营/代理报关出口', scope:'适用有进出口经营权企业', note:'需增值税专用发票退税率0-13%'}
    ];

    modes.forEach(function (m) {
      html += '<div class="export-card">';
      html += '<div class="ec-code">' + m.code + '</div>';
      html += '<div class="ec-body">';
      html += '<h4>' + escapeHtml(m.name) + '</h4>';
      html += '<p>' + escapeHtml(m.desc) + '</p>';
      html += '<div class="ec-scope">' + escapeHtml(m.scope) + '</div>';
      if (m.note) {
        html += '<div class="ec-note">' + escapeHtml(m.note) + '</div>';
      }
      html += '</div></div>';
    });

    html += '</div></div>';

    container.innerHTML = html;
  }

  // ========== Filter Functions ==========

  function filterByLevel(items, level) {
    if (!level || level === 'all') return items;
    return items.filter(function (item) {
      return item.source_level === level;
    });
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

    return items.filter(function (item) {
      return (item.date || '') >= cutoffStr;
    });
  }

  function filterBySentiment(items, sentiment) {
    if (!sentiment || sentiment === 'all') return items;
    return items.filter(function (item) {
      return item.sentiment_label === sentiment;
    });
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

  // ========== Event Binding ==========

  function initEvents() {
    // Nav tabs
    document.querySelectorAll('.nav-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        switchBoard(tab.dataset.section);
      });
    });

    // News level filters
    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentLevel = btn.dataset.level;
        renderNews();
      });
    });

    // News time filters
    document.querySelectorAll('.time-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.time-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentTimeFilter = btn.dataset.time;
        renderNews();
      });
    });

    // News search
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

    // Feedback sentiment filters
    document.querySelectorAll('.sentiment-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.sentiment-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentSentiment = btn.dataset.sentiment;
        renderFeedback();
      });
    });

    // Feedback time filters
    document.querySelectorAll('.fb-time-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.fb-time-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        currentFbTimeFilter = btn.dataset.time;
        renderFeedback();
      });
    });

    // Refresh button
    var refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadData();
      });
    }
  }

  // ========== Init ==========

  document.addEventListener('DOMContentLoaded', function () {
    initEvents();
    loadData();
    // Auto-refresh every 5 minutes
    setInterval(loadData, REFRESH_INTERVAL);
  });
})();