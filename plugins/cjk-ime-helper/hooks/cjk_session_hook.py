#!/usr/bin/env python3
"""
CJK IME Helper - Session Start Hook

Detects if the user's locale is CJK (Chinese, Japanese, Korean)
and provides guidance about known IME input issues and workarounds.
"""

import json
import os
import sys


def detect_cjk_locale() -> str | None:
    """Detect if the current locale is a CJK language."""
    locale_vars = ["LANG", "LC_ALL", "LC_CTYPE", "LANGUAGE"]
    cjk_prefixes = {
        "ko": "Korean",
        "ja": "Japanese",
        "zh": "Chinese",
        "vi": "Vietnamese",
    }

    for var in locale_vars:
        locale_val = os.environ.get(var, "").lower()
        if locale_val:
            for prefix, language in cjk_prefixes.items():
                if locale_val.startswith(prefix):
                    return language
    return None


def get_ime_status() -> dict:
    """Check platform-specific IME indicators."""
    platform = sys.platform
    result = {"platform": platform, "has_ime": False}

    if platform == "darwin":
        # macOS - check for common IME indicators
        input_source = os.environ.get("__CF_USER_TEXT_ENCODING", "")
        result["has_ime"] = True  # macOS always has IME available
    elif platform == "win32":
        result["has_ime"] = True  # Windows always has IME
    elif platform.startswith("linux"):
        # Check for common Linux IME frameworks
        for ime_var in ["XMODIFIERS", "GTK_IM_MODULE", "QT_IM_MODULE", "IBUS_DAEMON"]:
            if os.environ.get(ime_var):
                result["has_ime"] = True
                break

    return result


def main():
    language = detect_cjk_locale()

    if not language:
        # Not a CJK locale, no action needed
        print(json.dumps({"hookSpecificOutput": {}}))
        return

    workaround_tips = {
        "Korean": (
            "한글 입력 시 조합 중인 글자가 보이지 않을 수 있습니다. "
            "외부 에디터에서 작성 후 붙여넣기(Cmd+V/Ctrl+V)를 권장합니다. "
            "또는 /cjk-paste 명령어를 사용하세요."
        ),
        "Japanese": (
            "日本語入力時、変換中の文字が表示されない場合があります。"
            "外部エディタで入力後、貼り付け(Cmd+V/Ctrl+V)をお勧めします。"
            "または /cjk-paste コマンドをご利用ください。"
        ),
        "Chinese": (
            "中文输入时，正在组合的字符可能不会显示。"
            "建议在外部编辑器中输入后粘贴(Cmd+V/Ctrl+V)。"
            "或者使用 /cjk-paste 命令。"
        ),
        "Vietnamese": (
            "When typing Vietnamese with Telex, composing characters may not display. "
            "Try composing in an external editor and pasting (Cmd+V/Ctrl+V). "
            "Or use the /cjk-paste command."
        ),
    }

    tip = workaround_tips.get(language, "")

    output = {
        "hookSpecificOutput": {
            "additionalContext": (
                f"[CJK IME Helper] Detected {language} locale. "
                f"Known issue: IME composition characters may be invisible in the input field. "
                f"Tip: {tip} "
                f"See: https://github.com/anthropics/claude-code/issues/22732"
            )
        }
    }

    print(json.dumps(output))


if __name__ == "__main__":
    main()
