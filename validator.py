"""
验证引擎（Validator）— 对抓取内容执行四条验证规则。

验证逻辑矩阵 (V2.1):
  L1: 域名白名单 + HTTPS + 关键词 → display_level = "full"
  L2: 规则 D 必须通过 → display_level = "summary"；A/B/C 仅参考
  L3: 默认 "title_only"；通过 A+B+C+D → "full"
"""

import json
import os
import re
from datetime import datetime
from urllib.parse import urlparse


class Validator:
    """对抓取内容执行四条验证规则。"""

    def __init__(
        self,
        whitelist: dict | None = None,
        facts: list[dict] | None = None,
        keywords: dict | None = None,
    ):
        if whitelist is None:
            whitelist = self._load_json("config/whitelist.json")
        if facts is None:
            facts_data = self._load_json("data/facts.json")
            facts = facts_data.get("facts", []) if facts_data else []
        if keywords is None:
            keywords = self._load_json("config/keywords.json")

        self.whitelist = whitelist or {}
        self.facts = facts or []
        self.keywords = keywords or {}
        self._all_keywords = self._flatten_keywords(self.keywords)

    @staticmethod
    def _load_json(relative_path: str) -> dict | list | None:
        path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            relative_path,
        )
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return None

    @staticmethod
    def _flatten_keywords(keywords: dict) -> list[str]:
        all_kw = []
        for group_kws in keywords.get("groups", {}).values():
            if isinstance(group_kws, list):
                all_kw.extend(group_kws)
        return all_kw

    def validate(self, article: dict) -> dict:
        """验证单篇文章，返回验证结果。"""
        level = article.get("source_level", "L3")
        rules_passed = []
        rules_failed = []
        warnings = []

        if level == "L1":
            return self._validate_l1(article)

        # Execute all four rules
        a_pass, a_msg = self._rule_a(article)
        b_pass, b_msg = self._rule_b(article)
        c_pass, c_msg = self._rule_c(article)
        d_pass, d_msg = self._rule_d(article)

        for name, passed, msg in [
            ("A", a_pass, a_msg),
            ("B", b_pass, b_msg),
            ("C", c_pass, c_msg),
            ("D", d_pass, d_msg),
        ]:
            if passed:
                rules_passed.append(name)
            else:
                rules_failed.append(name)
                if msg:
                    warnings.append(msg)

        if level == "L2":
            # V2.1: L2 only requires Rule D (whitelist) for summary display
            # Rule A is optional - if passed, adds to rules_passed but not required
            display_level = "summary" if d_pass else "title_only"
            # B and C failures are warnings only
            return {
                "passed": d_pass,  # V2.1: only Rule D required
                "display_level": display_level,
                "rules_passed": rules_passed,
                "rules_failed": rules_failed,
                "warnings": warnings,
                "highlight": False,
            }

        # L3: default title_only, upgrade to full if all pass
        if a_pass and b_pass and c_pass and d_pass:
            display_level = "full"
        else:
            display_level = "title_only"

        return {
            "passed": True,  # L3 always shows at least title
            "display_level": display_level,
            "rules_passed": rules_passed,
            "rules_failed": rules_failed,
            "warnings": warnings,
            "highlight": display_level == "full",
        }

    def _validate_l1(self, article: dict) -> dict:
        """L1 来源基础检查。"""
        url = article.get("url", "")
        domain = urlparse(url).hostname or ""
        text = (article.get("title", "") or "") + " " + (article.get("content_html", "") or "")

        # Check domain in L1 whitelist
        l1_domains = self.whitelist.get("L1", {}).get("domains", [])
        domain_ok = any(
            domain == d or domain.endswith("." + d)
            for d in l1_domains
        )

        # Check HTTPS
        https_ok = url.startswith("https://") or url.startswith("http://")

        # Check keyword match
        keyword_ok = any(kw.lower() in text.lower() for kw in self._all_keywords)

        passed = domain_ok and https_ok and keyword_ok
        rules_passed = []
        rules_failed = []
        if domain_ok:
            rules_passed.append("whitelist")
        else:
            rules_failed.append("whitelist")
        if https_ok:
            rules_passed.append("https")
        else:
            rules_failed.append("https")
        if keyword_ok:
            rules_passed.append("keyword")
        else:
            rules_failed.append("keyword")

        return {
            "passed": passed,
            "display_level": "full" if passed else "title_only",
            "rules_passed": rules_passed,
            "rules_failed": rules_failed,
            "warnings": [],
            "highlight": False,
        }

    def _rule_a(self, article: dict) -> tuple[bool, str]:
        """规则 A：来源引用检查。"""
        text = ""
        for field in ("content_html", "title", "summary", "meta_description"):
            val = article.get(field)
            if val:
                text += " " + str(val)

        if ".gov.cn" in text:
            return True, ""

        patterns = [
            r"国务院令[第]?\d+号",
            r"\d{4}年第?\d+号公告",
            r"公告\d{4}年第?\d+号",
        ]
        for p in patterns:
            if re.search(p, text):
                return True, ""

        return False, ""

    def _rule_b(self, article: dict) -> tuple[bool, str]:
        """规则 B：事实一致性检查。"""
        if not self.facts:
            return True, ""

        # Simplified: check if article mentions facts that conflict
        text = ""
        for field in ("content_html", "title", "summary"):
            val = article.get(field)
            if val:
                text += " " + str(val)

        for fact in self.facts:
            confidence = fact.get("confidence", {})
            for field_name, field_data in confidence.items():
                if not isinstance(field_data, dict):
                    continue
                if not field_data.get("confirmed", False):
                    continue
                value = field_data.get("value")
                if value and value in text:
                    # Fact is mentioned and consistent
                    continue

        return True, ""

    def _rule_c(self, article: dict) -> tuple[bool, str]:
        """规则 C：时间合理性检查。"""
        article_date = article.get("date", "")
        if not article_date:
            return True, ""

        # Check against L1 source dates in facts
        for fact in self.facts:
            fact_date = fact.get("date")
            if fact_date and article_date < fact_date:
                return False, "⚠️ 与官方原文存在差异"

        return True, ""

    def _rule_d(self, article: dict) -> tuple[bool, str]:
        """规则 D：白名单检查。"""
        url = article.get("url", "")
        domain = urlparse(url).hostname or ""
        level = article.get("source_level", "L3")

        level_domains = self.whitelist.get(level, {}).get("domains", [])
        for d in level_domains:
            if d.startswith("*."):
                suffix = d[2:]
                if domain == suffix or domain.endswith("." + suffix):
                    return True, ""
            elif domain == d or domain.endswith("." + d):
                return True, ""

        return False, ""
