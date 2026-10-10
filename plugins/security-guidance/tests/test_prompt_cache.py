"""The code-review request leads with a static, cacheable rubric block."""
from test_review_model import api  # noqa: F401  fixture

import llm


def _review(api, files, **kw):
    api.posts.clear()
    llm.analyze_code_security(files, **kw)
    assert len(api.posts) == 1
    return api.posts[0]


def test_first_content_block_is_the_rubric_with_cache_control(api):
    post = _review(api, [("app.py", "print('hi')\n")])
    content = post["messages"][0]["content"]
    assert isinstance(content, list) and len(content) == 2
    assert content[0] == {
        "type": "text", "text": llm._CODE_REVIEW_RUBRIC,
        "cache_control": {"type": "ephemeral"},
    }
    assert "cache_control" not in content[1]
    assert post["system"] == llm.CLAUDE_CODE_SYSTEM_PROMPT


def test_rubric_has_no_unfilled_placeholders():
    rubric = llm._CODE_REVIEW_RUBRIC
    for name in ("language", "content_desc", "diff_instruction", "prev_section",
                 "file_type", "files_text"):
        assert "{" + name + "}" not in rubric
    # str.format escapes are gone: literal braces reach the model as written.
    assert "/{tenant_id}/" in rubric and "{{tenant_id}}" not in rubric


def test_rubric_block_is_identical_across_different_inputs(api):
    a = _review(api, [("main.go", "package main\n")])
    b = _review(api, [("views.py", "+x = 1\n")], is_diff=True,
                previous_findings=[{"filePath": "views.py", "category": "sqli",
                                    "vulnerableCode": "cursor.execute(q)"}])
    ca, cb = a["messages"][0]["content"], b["messages"][0]["content"]
    assert ca[0]["text"] == cb[0]["text"]
    assert ca[1]["text"] != cb[1]["text"]
    assert "Go code" in ca[1]["text"] and "main.go" in ca[1]["text"]
    assert "Python diff" in cb[1]["text"] and "unified diff" in cb[1]["text"]
    assert "PREVIOUS FINDINGS" in cb[1]["text"] and "=== DIFF: views.py ===" in cb[1]["text"]


def test_plain_prompt_without_prefix_stays_a_string(api):
    api.posts.clear()
    llm._call_claude("review this", {"type": "object"})
    assert api.posts[0]["messages"][0]["content"] == "review this"
