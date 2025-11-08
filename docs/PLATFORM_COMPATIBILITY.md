# Claude Code 插件平台兼容性指南

本文档说明官方插件在不同 Git 平台（GitHub、GitLab、Bitbucket）上的兼容性。

## 📋 快速参考表

| 插件名 | GitHub | GitLab | Bitbucket | 依赖要求 |
|-------|--------|--------|-----------|---------|
| commit-commands | ✅ | ✅ | ✅ | Git |
| feature-dev | ✅ | ✅ | ✅ | 无 |
| pr-review-toolkit | ✅ | ✅ | ✅ | Git |
| agent-sdk-dev | ✅ | ✅ | ✅ | Python/TypeScript |
| security-guidance | ✅ | ✅ | ✅ | Python 3 |
| explanatory-output-style | ✅ | ✅ | ✅ | 无 |
| learning-output-style | ✅ | ✅ | ✅ | 无 |
| **code-review** | ✅ | ❌ | ❌ | **GitHub CLI (gh)** |

## 🔍 详细说明

### 平台无关插件（7个）

这些插件可以在任何 Git 平台上使用：

#### **1. commit-commands**
- **功能**：Git 工作流自动化
- **命令**：`/commit`、`/commit-push-pr`、`/clean_gone`
- **依赖**：Git（所有平台都支持）
- **推荐度**：⭐⭐⭐⭐⭐

#### **2. feature-dev**
- **功能**：完整的特性开发工作流
- **包含**：代码探索、架构设计、质量审查
- **依赖**：无
- **推荐度**：⭐⭐⭐⭐⭐

#### **3. pr-review-toolkit**
- **功能**：PR/MR 审查工具包
- **包含 6 个专化代理**：
  - comment-analyzer（注释分析）
  - pr-test-analyzer（测试覆盖率）
  - silent-failure-hunter（错误处理）
  - type-design-analyzer（类型设计）
  - code-reviewer（代码质量）
  - code-simplifier（代码简化）
- **工作方式**：基于 `git diff` 分析
- **输出**：终端输出（需要手动复制到 GitLab/Bitbucket MR）
- **推荐度**：⭐⭐⭐⭐⭐（GitLab/Bitbucket 的最佳代码审查选择）

#### **4. agent-sdk-dev**
- **功能**：Agent SDK 开发工具
- **依赖**：Python 或 TypeScript
- **推荐度**：⭐⭐⭐⭐

#### **5. security-guidance**
- **功能**：安全提示钩子
- **检查**：XSS、命令注入、不安全代码模式
- **依赖**：Python 3
- **推荐度**：⭐⭐⭐⭐⭐

#### **6. explanatory-output-style**
- **功能**：教育性输出风格
- **依赖**：无
- **推荐度**：⭐⭐⭐

#### **7. learning-output-style**
- **功能**：交互式学习模式
- **依赖**：无
- **推荐度**：⭐⭐⭐

### GitHub 专用插件（1个）

#### **8. code-review**
- **功能**：自动化 PR 代码审查
- **平台**：仅 GitHub
- **依赖**：GitHub CLI (`gh`)
- **限制**：
  ```yaml
  allowed-tools: Bash(gh issue view:*), Bash(gh pr comment:*), etc.
  ```
- **特点**：
  - ✅ 自动在 GitHub PR 上发布评论
  - ✅ 置信度评分（80+ 阈值过滤假阳性）
  - ✅ CLAUDE.md 合规检查
  - ❌ 不支持 GitLab/Bitbucket

## 🏢 不同平台的推荐配置

### GitHub 用户

```bash
# 基础套件
/plugin install commit-commands@claude-code-plugins
/plugin install security-guidance@claude-code-plugins

# 代码审查（两个都可以安装）
/plugin install code-review@claude-code-plugins        # 自动发布评论
/plugin install pr-review-toolkit@claude-code-plugins  # 更全面的分析

# 开发工作流
/plugin install feature-dev@claude-code-plugins
```

### GitLab 用户

```bash
# 基础套件
/plugin install commit-commands@claude-code-plugins
/plugin install security-guidance@claude-code-plugins

# 代码审查（推荐）
/plugin install pr-review-toolkit@claude-code-plugins

# 开发工作流
/plugin install feature-dev@claude-code-plugins
```

### Bitbucket 用户

```bash
# 基础套件
/plugin install commit-commands@claude-code-plugins
/plugin install security-guidance@claude-code-plugins

# 代码审查（推荐）
/plugin install pr-review-toolkit@claude-code-plugins

# 开发工作流
/plugin install feature-dev@claude-code-plugins
```

## 🔧 GitLab/Bitbucket 代码审查工作流

### 使用 pr-review-toolkit

#### 基本用法

```bash
# 完整审查
/pr-review-toolkit:review-pr all

# 特定方面审查
/pr-review-toolkit:review-pr tests errors
/pr-review-toolkit:review-pr comments
/pr-review-toolkit:review-pr simplify

# 并行审查（更快）
/pr-review-toolkit:review-pr all parallel
```

#### 集成到 GitLab CI

在 `.gitlab-ci.yml` 中：

```yaml
code-review:
  stage: test
  script:
    - npm install -g @anthropic-ai/claude-code
    - claude --non-interactive "/pr-review-toolkit:review-pr all" > review.md
    - glab mr comment -F review.md  # 使用 GitLab CLI
  only:
    - merge_requests
```

#### 集成到 Bitbucket Pipelines

在 `bitbucket-pipelines.yml` 中：

```yaml
pipelines:
  pull-requests:
    '**':
      - step:
          name: Code Review
          script:
            - npm install -g @anthropic-ai/claude-code
            - claude --non-interactive "/pr-review-toolkit:review-pr all" > review.md
            # 使用 Bitbucket API 发布评论
            - curl -X POST -H "Content-Type: application/json" \
                   -d @review.md \
                   https://api.bitbucket.org/2.0/repositories/.../pullrequests/.../comments
```

## 📊 功能对比：code-review vs pr-review-toolkit

| 功能 | code-review | pr-review-toolkit |
|-----|-------------|-------------------|
| **平台支持** | 仅 GitHub | 所有 Git 平台 |
| **自动发布评论** | ✅ | ❌（需手动/CI集成） |
| **CLAUDE.md 检查** | ✅ | ✅ |
| **Bug 检测** | ✅ | ✅ |
| **测试覆盖率分析** | ❌ | ✅ |
| **错误处理检查** | ❌ | ✅ |
| **类型设计分析** | ❌ | ✅ |
| **代码简化建议** | ❌ | ✅ |
| **置信度评分** | ✅（80+） | ❌ |
| **专化代理数量** | 4 个 | 6 个 |
| **审查深度** | 中等 | 深入 |

### 选择建议

- **GitHub 用户**：两个都可以用
  - `code-review`：快速自动审查，自动发布评论
  - `pr-review-toolkit`：更全面的深度分析

- **GitLab/Bitbucket 用户**：只能用 `pr-review-toolkit`
  - 功能更全面（6 个专化代理）
  - 需要配置 CI/CD 自动发布评论（可选）

## 💡 最佳实践

### GitLab/Bitbucket 团队配置

在项目 `.claude/settings.json` 中：

```json
{
  "extraKnownMarketplaces": [
    {
      "source": {
        "source": "github",
        "repo": "anthropics/claude-code"
      }
    }
  ],
  "plugins": {
    "commit-commands": { "enabled": true },
    "feature-dev": { "enabled": true },
    "security-guidance": { "enabled": true },
    "pr-review-toolkit": { "enabled": true }
  }
}
```

**注意**：不要启用 `code-review` 插件，因为它在 GitLab/Bitbucket 上无法工作。

### 创建自定义命令

对于 GitLab 用户，可以在 `.claude/commands/gitlab-review.md` 创建：

```markdown
---
description: Review code and post to GitLab MR
---

1. 运行全面代码审查
2. 使用 /pr-review-toolkit:review-pr all
3. 获取审查结果后使用 glab CLI 发布到 MR：
   - 运行 `glab mr comment -m "$(上一步的输出)"`
```

## 🔗 相关文档

- [Claude Code 插件文档](https://docs.claude.com/en/docs/claude-code/plugins)
- [Plugin Marketplaces](https://docs.claude.com/en/docs/claude-code/plugin-marketplaces)
- [GitLab CLI (glab)](https://gitlab.com/gitlab-org/cli)
- [Bitbucket API](https://developer.atlassian.com/cloud/bitbucket/rest/api-group-pullrequests/)

## 📝 总结

- **7/8 插件**适用于所有 Git 平台（GitHub、GitLab、Bitbucket）
- **1/8 插件**（`code-review`）仅适用于 GitHub
- GitLab/Bitbucket 用户应使用 **`pr-review-toolkit`** 进行代码审查
- 所有平台都能享受 Claude Code 插件系统的核心优势
