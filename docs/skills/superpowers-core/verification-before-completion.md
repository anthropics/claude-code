# 完成前验证

> 在声称工作完成之前，必须运行验证命令并确认输出 -- 没有证据的完成声明等同于谎言。

## 概述

`superpowers:verification-before-completion` 技能解决一个关键问题：**在没有实际运行验证命令的情况下声称工作已完成，是不诚实的行为**。该技能要求在任何完成声明之前，必须提供新鲜的验证证据。

### 铁律

```
没有新鲜的验证证据，就不能声称完成
```

如果在当前消息中没有运行过验证命令，就不能声称它通过了。

### 门控函数

在声称任何状态或表达满意之前：

1. **IDENTIFY** -- 什么命令能证明这个声明？
2. **RUN** -- 执行完整的命令（新鲜的、完整的）
3. **READ** -- 完整输出，检查退出码，计数失败
4. **VERIFY** -- 输出是否确认了声明？
   - 如果否：陈述实际状态并附上证据
   - 如果是：陈述声明并附上证据
5. **只有在此之后** -- 才能做出声明

跳过任何步骤 = 撒谎，而非验证。

## 使用场景

**在以下操作之前始终使用：**
- 任何"完成"、"通过"、"修复了"等成功声明
- 任何表达满意的语句
- 任何关于工作状态的积极陈述
- 提交代码、创建 PR、标记任务完成
- 移动到下一个任务
- 将工作委派给子代理

**规则适用于：**
- 精确的短语（如 "All tests pass"）
- 释义和同义词（如 "Everything looks good"）
- 隐含的成功暗示
- 任何暗示完成/正确的沟通

## 用法

调用方式：`/superpowers:verification-before-completion`

该技能在以下场景应被调用：
- 即将声称工作完成、Bug 已修复、测试通过时
- 在提交代码或创建 PR 之前
- 在从一个任务移动到下一个任务之前
- 在接受子代理的"成功"报告之前

## 验证要求

### 各类声明的验证标准

| 声明 | 需要的验证 | 不够的验证 |
|------|-----------|-----------|
| 测试通过 | 测试命令输出：0 failures | 之前的运行结果、"应该通过" |
| Linter 通过 | Linter 输出：0 errors | 部分检查、推测 |
| 构建成功 | 构建命令：exit 0 | Linter 通过、日志看起来不错 |
| Bug 修复 | 测试原始症状：通过 | 代码改了、假设修好了 |
| 回归测试有效 | Red-Green 循环验证 | 测试只通过一次 |
| Agent 完成 | VCS diff 显示变更 | Agent 报告"成功" |
| 需求满足 | 逐行对照检查清单 | 测试通过 |

### 正确与错误的验证模式

**测试：**
```
正确: [运行测试命令] [看到: 34/34 pass] "All tests pass"
错误: "Should pass now" / "Looks correct"
```

**回归测试（TDD Red-Green）：**
```
正确: 编写 -> 运行(通过) -> 回退修复 -> 运行(必须失败) -> 恢复 -> 运行(通过)
错误: "I've written a regression test"（没有 Red-Green 验证）
```

**构建：**
```
正确: [运行构建] [看到: exit 0] "Build passes"
错误: "Linter passed"（Linter 不检查编译）
```

**需求：**
```
正确: 重读计划 -> 创建检查清单 -> 逐项验证 -> 报告差距或完成
错误: "Tests pass, phase complete"
```

**Agent 委派：**
```
正确: Agent 报告成功 -> 检查 VCS diff -> 验证变更 -> 报告实际状态
错误: 信任 Agent 报告
```

## 示例

### 示例 1: 基本用法 -- 验证测试通过

```
[编写代码完成]

Claude: 让我运行测试来验证...

$ npm test
  PASS src/auth/login.test.ts (34 tests)
  PASS src/auth/register.test.ts (12 tests)
  Test Suites: 2 passed, 2 total
  Tests: 46 passed, 46 total

所有 46 个测试通过（2 个测试套件）。
```

**错误的做法：**
```
Claude: 代码看起来正确，测试应该通过了。Great! 工作完成。
```

### 示例 2: 验证失败时的正确处理

```
Claude: 让我运行测试来验证...

$ npm test
  FAIL src/auth/login.test.ts
    - rejects expired tokens (Expected: 'Token expired', Received: undefined)
  Tests: 45 passed, 1 failed, 46 total

实际状态：46 个测试中有 1 个失败。
失败测试：rejects expired tokens
需要修复 token 过期检查逻辑后才能声称完成。
```

### 示例 3: 子代理委派后的验证

```
[子代理报告: "Task completed successfully, all tests pass"]

Claude: Agent 报告成功，但我需要独立验证。

$ git diff HEAD~1 --stat
 src/utils/cache.ts    | 45 +++++++++
 tests/cache.test.ts   | 78 +++++++++++++
 2 files changed, 123 insertions(+)

$ npm test tests/cache.test.ts
  PASS tests/cache.test.ts (8 tests)
  Tests: 8 passed, 8 total

独立验证确认：变更已应用，8 个测试全部通过。
```

## 红旗信号 -- 立即停止

- 使用"应该"、"可能"、"似乎"
- 在验证前表达满意（"太好了！"、"完美！"、"完成了！"）
- 即将提交/推送/创建 PR 但未验证
- 信任 Agent 的成功报告
- 依赖部分验证
- 想"就这一次"
- 感觉累了想结束工作
- **任何暗示成功但未运行验证的措辞**

## 合理化借口防线

| 借口 | 现实 |
|------|------|
| "现在应该行了" | 运行验证命令 |
| "我很有信心" | 信心不等于证据 |
| "就这一次" | 没有例外 |
| "Linter 通过了" | Linter 不等于编译器 |
| "Agent 说成功了" | 独立验证 |
| "我累了" | 疲劳不是借口 |
| "部分检查够了" | 部分检查什么也证明不了 |
| "换个说法就不算违规" | 重精神而非字面 |

## 为什么这很重要

来自 24 次失败记录的教训：

- 用户说"我不相信你" -- 信任破裂
- 未定义的函数被提交 -- 会导致崩溃
- 缺失的需求被提交 -- 功能不完整
- 虚假完成声明导致的时间浪费 -> 纠正 -> 返工

## 注意事项

- **这是刚性技能** -- 必须严格遵循，没有例外
- **"新鲜"证据** -- 必须在当前消息中运行验证命令，不能依赖之前的运行结果
- **完整的验证** -- 部分验证不算验证，必须运行完整的命令并读取完整输出
- **适用于所有完成声明** -- 不仅是"完成了"，还包括任何暗示成功的表述
- **与其他技能的关系**：
  - 前置调用：`superpowers:test-driven-development` -- TDD 中的验证步骤也遵循此原则
  - 前置调用：`superpowers:systematic-debugging` -- 调试完成后验证修复是否真正生效
  - 前置调用：`superpowers:executing-plans` -- 每个任务完成后的验证
  - 核心地位：这是所有工作流的最后一道防线，确保在声称完成前有真实的证据
