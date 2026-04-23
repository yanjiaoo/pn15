---
inclusion: auto
---
# PN15 编辑指南

## 项目背景
PN15 模块数据，展示在 Seller Learning Hub (https://yanjiaoo.github.io/competitor-study-hub/)。
编辑 pn15-data.json 后 push，网页自动加载最新内容。

## 数据结构
每条记录包含：id, title, date, summary, source, links
- title: 中文标题，陈述式
- summary: 内容摘要
- links: 参考链接数组，每条含 label 和 url
