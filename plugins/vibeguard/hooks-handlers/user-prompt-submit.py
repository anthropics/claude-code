#!/usr/bin/env python3
"""
Claude Code 插件：VibeGuard（UserPromptSubmit）

目标：在**不使用 MITM 代理**的前提下，尽可能降低“用户把敏感信息直接发给模型提供商”的风险。

实现方式：
- 在 UserPromptSubmit 事件中读取用户输入（user_prompt）
- 使用本地规则检测关键词/正则/内置 PII 模式
- 若命中则默认阻断发送，并输出一份“占位符替换版文本”供用户复制粘贴

说明：
- 该模式无法在客户端插件层面“自动改写即将发送的 prompt”，因此采用“阻断 + 提示复制替换版”的交互
- 占位符格式保持与 VibeGuard 一致：__VG_<CATEGORY>_<hash12>__（hash12 为 HMAC-SHA256 截断）
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Iterable


_CONFIG_REL_PATH = os.path.join(".claude", "vibeguard.local.md")


@dataclass(frozen=True)
class _GuardConfig:
    enabled: bool
    action: str  # "block" | "warn"
    fail_closed: bool
    redact_config_path: str | None


@dataclass(frozen=True)
class _RedactConfig:
    enabled: bool
    debug: bool
    prefix: str
    patterns: "_PatternSet"
    loaded_from: str


@dataclass(frozen=True)
class _KeywordRule:
    value: str
    category: str


@dataclass(frozen=True)
class _RegexRule:
    pattern: str
    flags: str
    category: str


@dataclass(frozen=True)
class _PatternSet:
    keywords: list[_KeywordRule]
    regex: list[_RegexRule]
    exclude: set[str]


def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _parse_frontmatter(md: str) -> dict[str, Any]:
    # 轻量 frontmatter 解析：只支持 key: value 形式（与仓库内其它插件保持一致）
    lines = md.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}

    end_index = None
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            end_index = i
            break

    if end_index is None:
        return {}

    cfg: dict[str, Any] = {}
    for raw in lines[1:end_index]:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        lower = value.lower()
        if lower == "true":
            cfg[key] = True
            continue
        if lower == "false":
            cfg[key] = False
            continue
        if len(value) >= 2 and (
            (value[0] == '"' and value[-1] == '"') or (value[0] == "'" and value[-1] == "'")
        ):
            value = value[1:-1]
        cfg[key] = value
    return cfg


def _load_guard_config(project_dir: str) -> _GuardConfig | None:
    cfg_path = os.path.join(project_dir, _CONFIG_REL_PATH)
    if not os.path.isfile(cfg_path):
        return None

    fm = _parse_frontmatter(_read_text(cfg_path))
    enabled = bool(fm.get("enabled", False))
    if not enabled:
        return _GuardConfig(enabled=False, action="block", fail_closed=True, redact_config_path=None)

    guard_prompt = bool(fm.get("guard_prompt", False))
    if not guard_prompt:
        return _GuardConfig(enabled=False, action="block", fail_closed=True, redact_config_path=None)

    action_raw = str(fm.get("guard_action", "block")).strip().lower()
    action = "warn" if action_raw == "warn" else "block"
    fail_closed = bool(fm.get("guard_fail_closed", True))

    path_raw = fm.get("redact_config") or fm.get("redaction_config") or fm.get("config_json")
    redact_config_path = None
    if isinstance(path_raw, str) and path_raw.strip():
        redact_config_path = os.path.expanduser(path_raw.strip())
        if not os.path.isabs(redact_config_path):
            redact_config_path = os.path.join(project_dir, redact_config_path)

    return _GuardConfig(
        enabled=True,
        action=action,
        fail_closed=fail_closed,
        redact_config_path=redact_config_path,
    )


def _read_json(path: str) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _sanitize_category(input_value: Any) -> str:
    raw = str(input_value or "").strip()
    if not raw:
        return "TEXT"
    upper = raw.upper()
    safe = re.sub(r"[^A-Z0-9_]", "_", upper)
    safe = re.sub(r"_+", "_", safe).strip("_")
    return safe or "TEXT"


def _peel_inline_flags(pattern: str, flags: str) -> tuple[str, str]:
    # 与 opencode-vibeguard 的实现保持一致：只处理开头连续的 (?i)/( ?m )
    p = str(pattern or "")
    f = str(flags or "")
    while True:
        if p.startswith("(?i)"):
            p = p[4:]
            if "i" not in f:
                f += "i"
            continue
        if p.startswith("(?m)"):
            p = p[4:]
            if "m" not in f:
                f += "m"
            continue
        break
    return p, f


_BUILTIN: dict[str, tuple[str, str, str]] = {
    # name: (pattern, flags, category)
    "email": (r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", "i", "EMAIL"),
    "china_phone": (r"(?<!\d)1[3-9]\d{9}(?!\d)", "", "CHINA_PHONE"),
    "china_id": (r"(?<!\d)\d{17}[\dXx](?!\d)", "", "CHINA_ID"),
    "uuid": (r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}", "", "UUID"),
    "ipv4": (r"(?:\d{1,3}\.){3}\d{1,3}", "", "IPV4"),
    "mac": (r"(?:[0-9a-f]{2}:){5}[0-9a-f]{2}", "i", "MAC"),
}


def _build_pattern_set(patterns: dict[str, Any]) -> _PatternSet:
    raw = patterns if isinstance(patterns, dict) else {}

    keywords_raw = raw.get("keywords") if isinstance(raw.get("keywords"), list) else []
    regex_raw = raw.get("regex") if isinstance(raw.get("regex"), list) else []
    builtin_raw = raw.get("builtin") if isinstance(raw.get("builtin"), list) else []
    exclude_raw = raw.get("exclude") if isinstance(raw.get("exclude"), list) else []

    keywords: list[_KeywordRule] = []
    for item in keywords_raw:
        if not isinstance(item, dict):
            continue
        value = str(item.get("value") or "").strip()
        if not value:
            continue
        category = _sanitize_category(item.get("category"))
        keywords.append(_KeywordRule(value=value, category=category))

    regex: list[_RegexRule] = []
    for item in regex_raw:
        if not isinstance(item, dict):
            continue
        pattern = str(item.get("pattern") or "").strip()
        if not pattern:
            continue
        category = _sanitize_category(item.get("category"))
        flags = str(item.get("flags") or "")
        peeled_pattern, peeled_flags = _peel_inline_flags(pattern, flags)
        regex.append(_RegexRule(pattern=peeled_pattern, flags=peeled_flags, category=category))

    for name in builtin_raw:
        key = str(name or "").strip()
        if not key:
            continue
        rule = _BUILTIN.get(key)
        if not rule:
            continue
        pattern, flags, category = rule
        regex.append(_RegexRule(pattern=pattern, flags=flags, category=category))

    exclude = {str(x or "") for x in exclude_raw}

    return _PatternSet(keywords=keywords, regex=regex, exclude=exclude)


def _default_redact_config_candidates(project_dir: str) -> list[str]:
    home = os.path.expanduser("~")
    return [
        os.path.join(project_dir, "vibeguard.config.json"),
        os.path.join(project_dir, ".claude", "vibeguard.config.json"),
        os.path.join(home, ".claude", "vibeguard.config.json"),
    ]


def _load_redact_config(project_dir: str, guard_cfg: _GuardConfig) -> _RedactConfig | None:
    candidates: list[str] = []

    env = os.environ.get("CLAUDE_VIBEGUARD_CONFIG")
    if env and str(env).strip():
        p = os.path.expanduser(str(env).strip())
        if not os.path.isabs(p):
            p = os.path.join(project_dir, p)
        candidates.append(p)

    if guard_cfg.redact_config_path:
        candidates.append(guard_cfg.redact_config_path)

    candidates.extend(_default_redact_config_candidates(project_dir))

    seen = set()
    for path in candidates:
        if not path:
            continue
        path = os.path.abspath(path)
        if path in seen:
            continue
        seen.add(path)
        if not os.path.isfile(path):
            continue
        raw = _read_json(path)
        if not isinstance(raw, dict):
            continue
        enabled = bool(raw.get("enabled", False))
        debug = bool(raw.get("debug", False))
        prefix = str(raw.get("placeholder_prefix") or "__VG_").strip() or "__VG_"
        patterns = _build_pattern_set(raw.get("patterns") if isinstance(raw.get("patterns"), dict) else {})
        return _RedactConfig(enabled=enabled, debug=debug, prefix=prefix, patterns=patterns, loaded_from=path)

    return None


@dataclass
class _Match:
    start: int
    end: int
    original: str
    category: str
    placeholder: str = ""


def _subtract_covered(start: int, end: int, covered: list[tuple[int, int]]) -> list[tuple[int, int]]:
    if start >= end:
        return []
    out: list[tuple[int, int]] = []
    cur = start
    for c_start, c_end in covered:
        if c_end <= cur:
            continue
        if c_start >= end:
            break
        if c_start > cur:
            out.append((cur, min(c_start, end)))
        if c_end >= end:
            cur = end
            break
        cur = max(cur, c_end)
    if cur < end:
        out.append((cur, end))
    return out


def _insert_covered(covered: list[tuple[int, int]], span: tuple[int, int]) -> list[tuple[int, int]]:
    s, e = span
    if s >= e:
        return covered

    i = 0
    while i < len(covered) and covered[i][0] <= s:
        i += 1
    covered.insert(i, (s, e))

    if len(covered) <= 1:
        return covered

    merged: list[tuple[int, int]] = []
    for cs, ce in covered:
        if not merged:
            merged.append((cs, ce))
            continue
        ls, le = merged[-1]
        if cs <= le:
            merged[-1] = (ls, max(le, ce))
            continue
        merged.append((cs, ce))
    return merged


class _PlaceholderSession:
    def __init__(self, prefix: str, key: bytes):
        self.prefix = prefix
        self.key = key
        self.forward: dict[str, str] = {}
        self.reverse: dict[str, str] = {}

    def _generate_base(self, original: str, category: str) -> str:
        cat = _sanitize_category(category)
        digest = hmac.new(self.key, original.encode("utf-8"), hashlib.sha256).digest()
        hash12 = digest.hex()[:12]  # 小写十六进制
        return f"{self.prefix}{cat}_{hash12}"

    def get_or_create_placeholder(self, original: str, category: str) -> str:
        existing = self.reverse.get(original)
        if existing:
            return existing

        base = self._generate_base(original, category) + "__"
        current = self.forward.get(base)
        if current is None:
            self.forward[base] = original
            self.reverse[original] = base
            return base

        if current == original:
            self.reverse[original] = base
            return base

        # 极低概率：hash12 冲突，按 VibeGuard 风格追加 _N 后缀
        without_suffix = base[:-2]
        i = 2
        while True:
            candidate = f"{without_suffix}_{i}__"
            prev = self.forward.get(candidate)
            if prev is None:
                self.forward[candidate] = original
                self.reverse[original] = candidate
                return candidate
            if prev == original:
                self.reverse[original] = candidate
                return candidate
            i += 1


def _iter_keyword_matches(text: str, rules: Iterable[_KeywordRule], exclude: set[str]) -> list[_Match]:
    found: list[_Match] = []
    for rule in rules:
        needle = rule.value
        if not needle:
            continue
        idx = 0
        while True:
            pos = text.find(needle, idx)
            if pos < 0:
                break
            start = pos
            end = pos + len(needle)
            idx = end
            original = text[start:end]
            if original in exclude:
                continue
            found.append(_Match(start=start, end=end, original=original, category=rule.category))
    return found


def _regex_flags_to_re(flags: str) -> int:
    out = 0
    f = str(flags or "")
    if "i" in f:
        out |= re.IGNORECASE
    if "m" in f:
        out |= re.MULTILINE
    return out


def _iter_regex_matches(text: str, rules: Iterable[_RegexRule], exclude: set[str]) -> list[_Match]:
    found: list[_Match] = []
    for rule in rules:
        try:
            r = re.compile(rule.pattern, _regex_flags_to_re(rule.flags))
        except re.error:
            # 无效正则：忽略（避免因为配置错误导致整个会话不可用）
            continue
        for m in r.finditer(text):
            s, e = m.span(0)
            if s < 0 or e <= s:
                continue
            original = text[s:e]
            if original in exclude:
                continue
            found.append(_Match(start=s, end=e, original=original, category=rule.category))
    return found


def _redact_text(text: str, patterns: _PatternSet, session: _PlaceholderSession) -> tuple[str, list[_Match]]:
    src = str(text or "")
    if not src:
        return src, []

    found: list[_Match] = []
    found.extend(_iter_keyword_matches(src, patterns.keywords, patterns.exclude))
    found.extend(_iter_regex_matches(src, patterns.regex, patterns.exclude))

    if not found:
        return src, []

    # 右侧优先；同起点优先更长（与 opencode-vibeguard 一致）
    found.sort(key=lambda m: (m.start, m.end), reverse=True)

    planned: list[_Match] = []
    covered: list[tuple[int, int]] = []
    for m in found:
        segments = _subtract_covered(m.start, m.end, covered)
        for s, e in segments:
            if s < 0 or e > len(src) or s >= e:
                continue
            planned.append(_Match(start=s, end=e, original=src[s:e], category=m.category))
            covered = _insert_covered(covered, (s, e))

    planned.sort(key=lambda m: m.start, reverse=True)

    out = src
    for m in planned:
        placeholder = session.get_or_create_placeholder(m.original, m.category)
        out = out[: m.start] + placeholder + out[m.end :]
        m.placeholder = placeholder

    return out, planned


def _format_category_counts(matches: list[_Match]) -> str:
    counts: dict[str, int] = {}
    for m in matches:
        counts[m.category] = counts.get(m.category, 0) + 1
    items = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    return ", ".join([f"{k}({v})" for k, v in items])


def _emit_json(*, should_continue: bool, system_message: str = "", suppress_output: bool = True) -> None:
    # 为了让 Claude Code 能可靠解析并执行“阻断/放行”，这里必须输出 JSON 到 stdout。
    # 备注：systemMessage 既可用于向 Claude 注入上下文，也可能用于向用户展示拦截原因（取决于宿主实现）。
    msg = str(system_message or "").strip()
    payload: dict[str, Any] = {
        "continue": bool(should_continue),
        "suppressOutput": bool(suppress_output),
    }
    if msg:
        payload["systemMessage"] = msg
        payload["suppressOutput"] = False
    print(json.dumps(payload, ensure_ascii=False), file=sys.stdout)


def main() -> None:
    # 重要：无论什么情况都输出 JSON（至少输出 {}），否则宿主会把输出当作纯文本，
    # 导致 continue / systemMessage 等字段无法生效。
    guard_cfg: _GuardConfig | None = None

    try:
        try:
            input_data = json.load(sys.stdin)
        except Exception:
            input_data = {}

        project_dir = (
            os.environ.get("CLAUDE_PROJECT_DIR")
            or str(input_data.get("cwd") or "").strip()
            or str(input_data.get("project_dir") or "").strip()
        )
        if not project_dir:
            project_dir = os.getcwd()

        guard_cfg = _load_guard_config(project_dir)
        if guard_cfg is None or not guard_cfg.enabled:
            _emit_json(should_continue=True, suppress_output=True)
            return

        user_prompt = str(
            input_data.get("user_prompt")
            or input_data.get("userPrompt")
            or input_data.get("prompt")
            or ""
        )
        if not user_prompt.strip():
            _emit_json(should_continue=True, suppress_output=True)
            return

        redact_cfg = _load_redact_config(project_dir, guard_cfg)
        if redact_cfg is None or not redact_cfg.enabled:
            if guard_cfg.fail_closed:
                _emit_json(
                    should_continue=False,
                    system_message=(
                        "🔒 VibeGuard：已启用提示词防泄漏，但未找到可用的 redaction 配置（vibeguard.config.json）。\n"
                        "为避免误发送敏感信息，本次已阻止发送。\n\n"
                        "解决方法：\n"
                        "- 在项目根目录创建 vibeguard.config.json 并设置 enabled=true；或\n"
                        "- 在 .claude/vibeguard.local.md 中设置 redact_config 指向配置文件；或\n"
                        "- 临时关闭 guard_prompt。\n"
                    ),
                )
                return
            _emit_json(should_continue=True, suppress_output=True)
            return

        session_id = str(input_data.get("session_id") or "").strip()
        if session_id:
            key = hashlib.sha256(f"claude-code-vibeguard:{session_id}".encode("utf-8")).digest()
        else:
            key = os.urandom(32)

        session = _PlaceholderSession(prefix=redact_cfg.prefix, key=key)
        redacted, matches = _redact_text(user_prompt, redact_cfg.patterns, session)
        if not matches:
            _emit_json(should_continue=True, suppress_output=True)
            return

        counts = _format_category_counts(matches)
        if guard_cfg.action == "warn":
            message = (
                f"🔒 VibeGuard：检测到可能的敏感信息（{len(matches)} 处；{counts}）。\n"
                "本次仅提醒（不会阻止发送）。为避免把明文泄漏给模型提供商，建议改用下面的“占位符替换版”文本重新发送（可直接复制）：\n\n"
                f"{redacted}\n"
            )
            _emit_json(should_continue=True, system_message=message)
            return

        message = (
            f"🔒 VibeGuard：检测到可能的敏感信息（{len(matches)} 处；{counts}）。\n"
            "已阻止发送以避免把明文泄漏给模型提供商。\n\n"
            "建议改用下面的“占位符替换版”文本重新发送（可直接复制）：\n\n"
            f"{redacted}\n"
        )
        _emit_json(should_continue=False, system_message=message)
        return

    except Exception as e:
        # 钩子出错时的兜底：优先不让用户误以为“已保护”，并尽量遵循 fail-closed。
        # 注意：这里不要直接回显异常文本，避免把潜在敏感信息写进日志/界面。
        should_block = bool(guard_cfg and guard_cfg.enabled and guard_cfg.fail_closed)
        error_kind = type(e).__name__
        _emit_json(
            should_continue=not should_block,
            system_message=(
                "🔒 VibeGuard：提示词防泄漏钩子执行失败。\n"
                f"错误类型：{error_kind}\n\n"
                + (
                    "为避免误发送敏感信息，本次已阻止发送。\n"
                    "你可以临时关闭 guard_prompt，或修复配置/环境后再试。"
                    if should_block
                    else "为避免影响流程，本次未阻止发送。建议检查配置后重试。"
                )
            ),
        )
        return

    finally:
        # 必须始终 exit 0：避免因为钩子自身异常导致宿主把它当作“系统错误”
        sys.exit(0)


if __name__ == "__main__":
    main()
