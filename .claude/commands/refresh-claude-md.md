---
description: 生成或更新 CLAUDE.md（專案指引，供 Claude Code 使用）
allowed-tools: Read(*), Grep(*), Glob(*), Write(*), Edit(*), Bash(ls:*), Bash(rg:*), Bash(cat:*), Bash(tree:*), Bash(python3:*)
---

## Context

- 掃描專案以判斷：語言/框架、建置/測試/格式指令、README 節錄、主要目錄樹
- 模板：`.claude/templates/CLAUDE.md.tmpl`

## Your task

1) 掃描專案：
   - 讀取 `README*`, `pyproject.toml/requirements*`, `package.json`, `Makefile`, `mkdocs.yml` 等
   - 推測 Stack/Build/Test/Lint/Docs 指令；擷取 `tree`（或用 `rg --files` 近似）
2) 以模板產生 CLAUDE.md 內容：
   - 替換模板占位符（{{PROJECT_NAME}}, {{STACK}}, {{PURPOSE}}, {{BUILD_CMD}}, {{TEST_CMD}}, {{LINT_CMD}}, {{DOCS_CMD}}, {{TREE}}）
3) 若專案根已有 CLAUDE.md，請比對並整合：保留既有自定章節，新內容放在「建議補充」段落
4) 寫入專案根 `CLAUDE.md`，並顯示主要段落摘要
5) 不要做其它事。

