# 测试驱动开发

> 先写测试，看它失败，再写最小代码使其通过 -- 这是 TDD 的铁律，没有例外。

## 概述

`superpowers:test-driven-development` 技能实施严格的测试驱动开发（TDD）工作流。它的核心原则是：**如果你没有看到测试失败，你就不知道它是否测试了正确的东西**。

该技能定义了一个不可妥协的规则：

```
没有先失败的测试，就不能写生产代码
```

如果你在测试之前就写了代码，唯一正确的做法是：**删除代码，重新开始**。不保留为"参考"，不"适配"，不查看它 -- 删除就是删除。从测试开始全新实现。

### Red-Green-Refactor 循环

1. **RED** -- 编写一个失败的测试
2. **验证 RED** -- 运行测试，确认它正确失败
3. **GREEN** -- 编写最小代码使测试通过
4. **验证 GREEN** -- 运行测试，确认通过且无其他测试破坏
5. **REFACTOR** -- 清理代码（保持测试绿色）
6. **重复** -- 下一个测试，下一个功能

## 使用场景

**始终应该使用的场景：**
- 开发新功能
- 修复 Bug
- 重构代码
- 行为变更

**例外（需要用户明确同意）：**
- 一次性原型
- 自动生成的代码
- 配置文件

如果你在想"这次就跳过 TDD 吧"？停下来。那是合理化借口。

## 用法

调用方式：`/superpowers:test-driven-development`

该技能在以下场景应被调用：
- 开始实现任何功能或修复之前
- 执行实施计划中的代码步骤时
- 从 `superpowers:systematic-debugging` 过渡到修复阶段时

## Red-Green-Refactor 详解

### RED -- 编写失败的测试

编写一个最小的测试，展示预期行为。

**好的测试：**
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```
清晰的命名，测试真实行为，只测一件事。

**差的测试：**
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```
命名模糊，测试的是 mock 而非代码。

**要求：**
- 只测一个行为
- 清晰的命名
- 使用真实代码（除非不得已才用 mock）

### 验证 RED -- 确认测试失败

**必须执行，不可跳过。**

```bash
npm test path/to/test.test.ts
```

确认：
- 测试失败（不是报错）
- 失败信息符合预期
- 因为功能缺失而失败（不是拼写错误）

**测试通过了？** 说明你在测试已有行为，修改测试。

**测试报错了？** 修复错误，重新运行直到它正确失败。

### GREEN -- 最小代码

编写最简单的代码使测试通过。

**好的实现：**
```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```
刚好够通过测试。

**差的实现：**
```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI -- 过度工程化
}
```

不要添加功能、重构其他代码或做超出测试范围的"改进"。

### 验证 GREEN -- 确认测试通过

**必须执行。**

```bash
npm test path/to/test.test.ts
```

确认：
- 测试通过
- 其他测试仍然通过
- 输出干净（无错误、无警告）

**测试失败？** 修改代码，不要修改测试。

**其他测试失败？** 立即修复。

### REFACTOR -- 清理代码

仅在测试全部通过后进行：
- 去除重复代码
- 改善命名
- 提取辅助函数

保持测试绿色。不添加新行为。

## 示例

### 示例 1: 基本用法 -- Bug 修复

**Bug：** 空邮箱被接受

**RED**
```typescript
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

**验证 RED**
```bash
$ npm test
FAIL: expected 'Email required', got undefined
```

**GREEN**
```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
```

**验证 GREEN**
```bash
$ npm test
PASS
```

**REFACTOR**
如需要，提取验证逻辑为独立函数。

### 示例 2: 新功能开发

```
用户: 实现用户密码强度验证

Claude: 使用 test-driven-development 技能进行开发。

RED -- 编写失败测试：
test('rejects password shorter than 8 characters', () => {
  expect(validatePassword('abc')).toEqual({
    valid: false,
    reason: 'Password must be at least 8 characters'
  });
});

验证 RED:
$ npm test -- validatePassword
FAIL: validatePassword is not defined

GREEN -- 最小实现：
function validatePassword(password: string) {
  if (password.length < 8) {
    return { valid: false, reason: 'Password must be at least 8 characters' };
  }
  return { valid: true, reason: null };
}

验证 GREEN:
$ npm test -- validatePassword
PASS (1/1)

[继续下一个测试用例：大写字母要求、数字要求等...]
```

### 示例 3: 调试集成

发现 Bug 时：编写一个能复现 Bug 的失败测试，然后遵循 TDD 循环。测试既证明了修复有效，又防止了回归。

**永远不要在没有测试的情况下修复 Bug。**

## 常见合理化借口

| 借口 | 现实 |
|------|------|
| "太简单了不需要测试" | 简单代码也会出问题，测试只需 30 秒 |
| "我先写代码再补测试" | 先通过的测试什么也证明不了 |
| "先写后写测试效果一样" | 后写的测试回答"它做了什么"；先写的测试回答"它应该做什么" |
| "我已经手动测试过了" | 随机测试不等于系统测试，没有记录，无法重跑 |
| "删除 X 小时的工作太浪费了" | 沉没成本谬误，保留未验证的代码才是技术债务 |
| "保留作为参考" | 你会适配它，那就是先写代码后补测试。删除就是删除 |
| "需要先探索" | 可以。丢弃探索结果，然后从 TDD 开始 |
| "测试太难写了" | 听测试说什么 -- 难测试 = 难使用，简化设计 |
| "TDD 会拖慢我" | TDD 比调试更快，测试先行才是务实的做法 |
| "现有代码没有测试" | 你正在改进它，为现有代码添加测试 |

## 好的测试标准

| 质量维度 | 好的 | 差的 |
|----------|------|------|
| **最小化** | 只测一件事。名称中有"and"？拆分它 | `test('validates email and domain and whitespace')` |
| **清晰** | 名称描述行为 | `test('test1')` |
| **展示意图** | 展示期望的 API 用法 | 掩盖代码应该做什么 |

## 遇到困难时的解决方案

| 问题 | 解决方案 |
|------|----------|
| 不知道如何测试 | 写出你期望的 API，先写断言，向用户请教 |
| 测试太复杂 | 设计太复杂，简化接口 |
| 必须 mock 所有东西 | 代码耦合度太高，使用依赖注入 |
| 测试设置很庞大 | 提取辅助函数。仍然复杂？简化设计 |

## 验证清单

在标记工作完成之前：

- [ ] 每个新函数/方法都有测试
- [ ] 在实现前看到每个测试失败
- [ ] 每个测试因预期原因失败（功能缺失，而非拼写错误）
- [ ] 编写了最小代码使测试通过
- [ ] 所有测试通过
- [ ] 输出干净（无错误、无警告）
- [ ] 测试使用真实代码（仅在不得已时使用 mock）
- [ ] 覆盖了边界情况和错误处理

无法勾选所有项？说明你跳过了 TDD，从头开始。

## 注意事项

- **铁律不可违反** -- 没有先失败的测试就不能写生产代码
- **"先写代码再补测试"不是 TDD** -- 如果你已经写了代码，删除它，从测试开始
- **这是刚性技能** -- 必须严格遵循，不得自行调整流程
- **测试反模式** -- 避免测试 mock 行为而非真实行为、向生产类添加仅用于测试的方法、不理解依赖就使用 mock
- **与其他技能的关系**：
  - 被调用场景：执行实施计划中的代码步骤、`superpowers:systematic-debugging` 阶段 4（创建失败测试）
  - 后续验证：使用 `superpowers:verification-before-completion` 在完成前验证
  - 核心配合：与 `superpowers:writing-plans` 配合，计划中的每个代码任务都遵循 TDD 流程
