# 执行实施计划

> 在独立会话中逐任务执行实施计划，设置审查检查点，遇到阻塞时立即停止而非猜测。

## 概述

`superpowers:executing-plans` 技能负责加载、审查并逐步执行由 `superpowers:writing-plans` 生成的实施计划。它的核心理念是：**严格按照计划执行，遇到问题立即停止请求帮助，不要猜测或跳过验证步骤**。

该技能是实施计划的"内联执行"模式，适合在当前会话中按批次执行任务并设置审查检查点。如果平台支持子代理（subagent），推荐使用 `superpowers:subagent-driven-development` 替代，可获得更高的工作质量。

### 核心机制

执行分为三个阶段：
1. **加载和审查计划** -- 批判性地审查计划，发现问题在开始前提出
2. **逐任务执行** -- 严格按照计划步骤执行，完成每步的验证
3. **完成开发** -- 所有任务完成后，使用 finishing-a-development-branch 技能收尾

## 使用场景

- 有一个已编写好的实施计划文件需要执行时
- 在 `superpowers:writing-plans` 完成后选择"内联执行"模式时
- 需要在当前会话中按步骤执行多任务计划时
- 不使用子代理而是直接在主会话中执行计划时

## 用法

调用方式：`/superpowers:executing-plans`

该技能通常在以下场景被调用：
- `superpowers:writing-plans` 完成后，用户选择 "Inline Execution" 时
- 手动调用以执行已有的计划文件

启动时会宣告："I'm using the executing-plans skill to implement this plan."

## 执行流程

### 阶段 1：加载和审查计划

1. 读取计划文件
2. 批判性审查 -- 识别任何问题或疑虑
3. 如果有疑虑：在开始前向用户提出
4. 如果没有疑虑：创建 TodoWrite 任务列表并继续

### 阶段 2：逐任务执行

对于每个任务：
1. 将任务标记为 `in_progress`
2. 严格按照每个步骤执行（计划中有细粒度步骤）
3. 按指定要求运行验证
4. 将任务标记为 `completed`

### 阶段 3：完成开发

所有任务完成并验证后：
- 宣告："I'm using the finishing-a-development-branch skill to complete this work."
- 调用 `superpowers:finishing-a-development-branch` 技能
- 按照该技能指引验证测试、展示选项、执行用户选择

```
加载计划文件
    |
    v
批判性审查计划
    |
    v
有疑虑？ --是--> 向用户提出问题 --> 等待回复
    |                                    |
    否                                   |
    |<-----------------------------------+
    v
创建 TodoWrite 任务列表
    |
    v
[循环] 对每个任务：
    标记为 in_progress
    -> 执行步骤 1
    -> 执行步骤 2
    -> ...
    -> 运行验证
    -> 标记为 completed
    |
    v
所有任务完成
    |
    v
调用 finishing-a-development-branch
```

## 示例

### 示例 1: 基本执行流程

```
用户: 请执行 docs/superpowers/plans/2026-04-09-auth-module.md 中的计划

Claude: I'm using the executing-plans skill to implement this plan.

[读取计划文件]

计划审查完成，未发现问题。开始执行。

Task 1: 用户模型 [in_progress]
- Step 1: 编写失败的测试... [完成]
- Step 2: 运行测试确认失败... [确认：FAIL - User not defined]
- Step 3: 编写最小实现... [完成]
- Step 4: 运行测试确认通过... [确认：PASS]
- Step 5: 提交... [完成]
Task 1: [completed]

Task 2: 认证服务 [in_progress]
...
```

### 示例 2: 遇到阻塞时停止

```
Claude: Task 3: 邮件通知服务 [in_progress]
- Step 1: 编写失败的测试... [完成]
- Step 2: 运行测试确认失败...

BLOCKED: 计划中指定的 email-service 包在 npm registry 中不存在。
计划可能需要更新。需要您的帮助来决定：
A) 使用替代的 nodemailer 包
B) 更新计划以使用不同的邮件方案
C) 跳过此任务先执行其他任务
```

### 示例 3: 计划审查发现问题

```
Claude: I'm using the executing-plans skill to implement this plan.

[读取计划文件]

计划审查发现以下问题：
1. Task 4 引用了 Task 2 中未定义的 UserService.validate() 方法
2. Task 7 的测试文件路径与项目现有结构不一致

建议在开始执行前修正这些问题。您希望：
A) 我来修正这些问题并继续
B) 返回 writing-plans 重新编写计划
```

## 何时停止并请求帮助

**以下情况必须立即停止执行：**

- 遇到阻塞（缺少依赖、测试失败、指令不清晰）
- 计划存在关键缺陷导致无法开始
- 不理解某个指令
- 验证反复失败

**宁可请求澄清，不要猜测。**

## 何时回退到早期步骤

**回退到审查阶段（阶段 1）的情况：**

- 用户根据反馈更新了计划
- 基本方法需要重新思考

**不要硬撑过阻塞** -- 停下来并询问。

## 注意事项

- **严格按计划执行** -- 不要跳过步骤或自行发挥
- **不要跳过验证** -- 每个步骤的验证都是必需的
- **遇到阻塞立即停止** -- 不要猜测，请求帮助
- **不要在 main/master 分支上开始实施** -- 除非用户明确同意
- **先审查再执行** -- 在开始前批判性地审查计划
- **与其他技能的关系**：
  - 前置：由 `superpowers:writing-plans` 生成的计划
  - 替代方案：`superpowers:subagent-driven-development`（推荐，质量更高）
  - 前置环境：`superpowers:using-git-worktrees` -- 在隔离的工作区中执行
  - 后续：`superpowers:finishing-a-development-branch` -- 完成开发后的收尾工作
  - 引用：当计划中指定时，引用对应技能（如 TDD、debugging 等）
