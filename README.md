# PN15 新闻聚合器 V2

## 项目简介

PN15 新闻聚合器 V2 是一个基于 Web 的信息聚合工具，自动抓取、验证、摘要并展示与中国国务院令第810号及国家税务总局2025年第15号公告（PN15）相关的政策信息与卖家反馈。

PN15 规定了互联网平台企业涉税信息报送的新要求，影响所有在 Amazon 各站点运营的中国卖家。本工具通过 GitHub Pages 部署至 [github.com/yanjiaoo/pn15](https://github.com/yanjiaoo/pn15)，通过 GitHub Actions 实现每小时自动数据采集。

## V2 升级内容

相较于 V1 版本，V2 的核心升级包括：

| 维度 | V1 | V2 |
|------|----|----|
| 静态文件位置 | `site/` 子目录 | 仓库根目录 |
| 前端布局 | 单一时间线视图 | 三栏布局（📰最新资讯 / 🗣️卖家反馈 / 📋政策概览） |
| 信息源 | L3-B 5个媒体 | L3-B 8个垂直媒体 + L3-C 4个微信公众号 |
| 关键词组 | 3组 | 5组（新增"平台报送动态"和"卖家反馈"） |
| 情绪分析 | 无 | 基于规则的卖家情绪标注模块 |
| 微信抓取 | 无 | 通过搜狗微信搜索抓取公众号文章 |
| 政策概览 | 无 | 政策时间线 + 出口模式对照表 |

## 主要功能

- **多层级信息源抓取**：支持 L1（政府官方）、L2（专业机构）、L3（媒体/垂直网站/微信公众号）三个层级的信息源
- **自动内容验证**：基于规则 A（来源引用）、B（事实一致性）、C（时间合理性）、D（白名单）进行内容可信度验证
- **事实数据库**：从 L1 来源自动提取结构化事实，用于交叉验证
- **智能摘要生成**：纯规则方式提取文章摘要，优先使用 meta description，回退到正文前 N 句
- **跨源排序与高亮**：基于关键词匹配频率和来源层级权重进行内容排序，最新时间 + 最高频率 + 自动高亮
- **卖家情绪分析**：基于规则的关键词匹配情绪标注系统，支持六种情绪标签（😰焦虑、😡不满、😐观望、💡求助、✅积极、⚠️恐慌）
- **三栏布局前端**：最新资讯、卖家反馈、政策概览三个独立板块，通过 switchBoard() 切换
- **政策时间线**：按时间顺序展示 PN15 相关政策关键里程碑
- **出口模式对照表**：展示五种出口模式下的增值税和企业所得税差异
- **数据归档**：按月归档历史数据，永久保留

## 目录结构

```
pn15-news-aggregator new/
├── index.html             # 静态站点主页面（三栏布局）
├── app.js                 # 前端逻辑（switchBoard 模式）
├── style.css              # 样式表
├── data.json              # 展示数据（5个顶层字段）
├── .github/workflows/     # GitHub Actions 工作流配置
│   ├── fetch.yml          # 定时抓取工作流（每小时）
│   └── issue-on-fail.yml  # 失败告警工作流
├── scripts/               # 核心脚本
│   ├── fetchers/          # 各源抓取器
│   │   ├── base_fetcher.py
│   │   ├── l1_fetchers.py
│   │   ├── l2_fetchers.py
│   │   ├── l3_fetchers.py
│   │   └── wechat_fetcher.py  # 微信公众号抓取器（V2 新增）
│   ├── validator.py       # 验证引擎
│   ├── fact_extractor.py  # 事实提取
│   ├── summarizer.py      # 摘要生成
│   ├── sorter.py          # 排序引擎
│   ├── sentiment.py       # 情绪分析模块（V2 新增）
│   ├── build.py           # 静态站点构建
│   └── main.py            # 主编排脚本
├── config/                # 配置文件
│   ├── sources.json       # 信息源配置
│   ├── keywords.json      # 关键词组配置（5组）
│   ├── whitelist.json     # 白名单域名配置
│   ├── l2_platforms.json  # 跨境电商综试区平台配置
│   └── sentiment_rules.json  # 情绪关键词映射规则（V2 新增）
├── data/                  # 数据文件
│   ├── facts.json         # 事实数据库
│   ├── verified.json      # 已验证内容
│   ├── feedback.json      # 卖家反馈数据（V2 新增）
│   ├── fetch_log.json     # 抓取日志
│   └── archive/           # 月度归档（YYYY-MM.json）
├── tests/                 # 测试文件
├── requirements.txt       # Python 依赖
└── README.md              # 项目说明
```

## 安装与使用

### 环境要求

- Python 3.9+

### 安装步骤

1. 克隆仓库：

```bash
git clone https://github.com/yanjiaoo/pn15.git
cd pn15
```

2. 安装 Python 依赖：

```bash
pip install -r requirements.txt
```

依赖包括：
- `requests` — HTTP 请求
- `beautifulsoup4` + `lxml` — HTML 解析
- `pytest` + `hypothesis` — 单元测试与属性测试
- `pytest-cov` — 测试覆盖率

### 手动运行

执行完整的 V2 数据处理管道（抓取 → 事实提取 → 验证 → 摘要 → 排序 → 情绪分析 → 站点生成）：

```bash
python -m scripts.main
```

### 自动运行

项目通过 GitHub Actions 实现自动化：

- **定时抓取**：每小时自动执行一次数据抓取和站点更新（`fetch.yml`）
- **手动触发**：支持通过 GitHub Actions `workflow_dispatch` 手动触发抓取
- **失败告警**：抓取失败时自动创建 GitHub Issue（`issue-on-fail.yml`）
- **站点部署**：静态文件直接放置在仓库根目录，GitHub Pages 直接服务

### 配置管理

所有配置通过 JSON 文件管理，修改配置无需改代码：

- `config/sources.json` — 添加或修改信息源（含微信公众号）
- `config/keywords.json` — 更新关键词组（5组）
- `config/whitelist.json` — 管理白名单域名
- `config/l2_platforms.json` — 扩展跨境电商综试区平台
- `config/sentiment_rules.json` — 调整情绪关键词映射规则

### 运行测试

运行全部测试：

```bash
pytest tests/
```

运行测试并查看覆盖率：

```bash
pytest tests/ --cov=scripts --cov-report=term-missing
```

## 部署说明

本项目部署至 [github.com/yanjiaoo/pn15](https://github.com/yanjiaoo/pn15)，使用 GitHub Pages 托管。

静态文件（`index.html`、`app.js`、`style.css`、`data.json`）直接放置在仓库根目录，GitHub Pages 从根目录直接服务，无需配置子目录。

### GitHub Actions 设置

1. **fetch.yml** — 定时抓取工作流
   - 每小时自动执行（cron: `0 * * * *`）
   - 支持 `workflow_dispatch` 手动触发
   - 步骤：checkout → 安装依赖 → 运行管道 → 提交数据和站点文件更新

2. **issue-on-fail.yml** — 失败告警工作流
   - 当 fetch.yml 运行失败时自动创建 GitHub Issue
   - 需要确保仓库 Actions 权限允许创建 Issue

## 信息源层级说明

| 层级 | 说明 | 验证规则 | 展示方式 |
|------|------|----------|----------|
| L1 | 政府官方来源 | 基础检查（域名+HTTPS+关键词） | 完整展示（摘要+高亮） |
| L2 | 专业机构来源 | 规则 A+D 必须通过 | 通过后展示摘要 |
| L3 | 媒体/垂直网站/微信公众号 | 默认仅标题+链接 | 通过 A+B+C+D 后升级展示 |

## 许可证

本项目仅供内部使用。
