# 编写实施计划

> 将设计规格转化为详尽的、分步骤的实施计划，假设执行者对代码库零了解，确保每个步骤都有具体代码和验证命令。

## 概述

`superpowers:writing-plans` 技能负责将经过头脑风暴阶段确认的设计规格，转化为可直接执行的详细实施计划。该技能的核心理念是：**假设执行计划的工程师对代码库和问题领域几乎一无所知**，因此计划中的每一步都必须包含完整的代码、精确的文件路径和具体的验证命令。

### 核心原则

- **DRY**（Don't Repeat Yourself）-- 避免重复
- **YAGNI**（You Aren't Gonna Need It）-- 不添加不需要的功能
- **TDD**（Test-Driven Development）-- 测试驱动开发
- **频繁提交** -- 每个任务完成后提交代码

### 计划保存位置

默认保存到：`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`（用户偏好优先）

## 使用场景

- 有了经过批准的设计规格/需求文档，准备开始编码之前
- 多步骤任务需要拆分为可独立执行的子任务时
- 需要为其他 Agent 或开发者提供可执行的工作指引时
- 从 `superpowers:brainstorming` 过渡到实施阶段时

## 用法

调用方式：`/superpowers:writing-plans`

该技能通常在以下场景被调用：
- `superpowers:brainstorming` 完成后自动过渡
- 用户直接提供了需求规格并要求制定实施计划时
- 手动调用以对已有需求创建计划

启动时会宣告："I'm using the writing-plans skill to create the implementation plan."

## 计划结构

### 文档头部

每个计划必须以标准头部开始：

```markdown
# [功能名称] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task.

**Goal:** [一句话描述构建目标]

**Architecture:** [2-3 句话描述技术方案]

**Tech Stack:** [关键技术/库]

---
```

### 文件结构映射

在定义任务之前，先列出所有将被创建或修改的文件及其职责。这是分解决策被锁定的地方：

- 设计边界清晰、接口明确的单元
- 优先使用小而专注的文件，而非大而杂的文件
- 一起变更的文件应放在一起，按职责拆分而非按技术层拆分
- 在现有代码库中遵循已有模式

### 任务粒度

**每一步是一个动作（2-5 分钟）：**

- "编写失败的测试" -- 一步
- "运行测试确认它失败" -- 一步
- "编写最小代码使测试通过" -- 一步
- "运行测试确认它通过" -- 一步
- "提交代码" -- 一步

### 任务结构模板

````markdown
### Task N: [组件名称]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: 编写失败的测试**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: 编写最小实现**

```python
def function(input):
    return expected
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

## 示例

### 示例 1: 基本用法

```
用户: [已完成 brainstorming，设计文档已获批准]

Claude: I'm using the writing-plans skill to create the implementation plan.

[分析设计文档]
[映射文件结构]
[按 TDD 流程拆分为 bite-sized 任务]
[每个步骤包含完整代码、文件路径和验证命令]

Plan complete and saved to docs/superpowers/plans/2026-04-09-user-auth.md.

Two execution options:
1. Subagent-Driven (recommended) - 每个任务分派独立子代理，任务间审查
2. Inline Execution - 在当前会话中执行，带审查检查点

Which approach?
```

### 示例 2: 范围检查

如果设计规格覆盖了多个独立子系统，技能会建议将计划拆分为多个独立计划，每个计划应能独立产出可工作、可测试的软件。

### 示例 3: 自审流程

计划编写完成后，会自动进行自审：

1. **规格覆盖检查** -- 浏览规格中的每个需求，确认是否有对应任务
2. **占位符扫描** -- 搜索 TBD、TODO、"implement later" 等红旗标记
3. **类型一致性** -- 确认后续任务中的类型、方法签名、属性名与早期定义一致

发现问题则内联修复，无需重新审查。

## 禁止使用占位符

以下内容在计划中属于**失败**，绝不允许出现：

- "TBD"、"TODO"、"implement later"、"fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above"（没有实际测试代码）
- "Similar to Task N"（必须重复代码，执行者可能不按顺序阅读）
- 描述要做什么但不展示如何做的步骤（代码步骤必须有代码块）
- 引用未在任何任务中定义的类型、函数或方法

## 注意事项

- **精确的文件路径** -- 每个步骤都必须包含完整的文件路径
- **完整的代码** -- 如果步骤涉及代码变更，必须展示代码
- **精确的命令和预期输出** -- 验证步骤必须包含具体命令和预期结果
- **遵循 TDD 流程** -- 先写测试，看它失败，再写实现
- **频繁提交** -- 每个任务完成后提交代码
- **与其他技能的关系**：
  - 前置：通常由 `superpowers:brainstorming` 触发
  - 后续执行选项：
    - `superpowers:subagent-driven-development`（推荐）-- 子代理驱动开发
    - `superpowers:executing-plans` -- 内联执行
  - 上下文：应在专用 worktree 中运行（由 brainstorming 技能创建）
