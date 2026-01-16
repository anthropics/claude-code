# Claude Code 项目管理插件

面向 Claude Code 的全面 Git/GitHub 项目管理插件，提供工作流自动化、PR 管理以及 issue 跟踪。

## 功能

### 斜杠命令（用户发起）

| 命令 | 描述 |
|------|------|
| `/pm-status` | 显示完整项目 Git 状态 |
| `/pm-branch` | 分支操作（创建/切换/删除） |
| `/pm-sync` | 与主分支同步（拉取 + 变基） |
| `/pm-commit` | 以约定式格式创建语义化提交 |
| `/pm-pr` | 拉取请求操作（草稿/准备/状态） |
| `/pm-gh` | GitHub CLI 操作（issues/PRs/workflows/releases） |
| `/pm-cleanup` | 清理已合并分支 |
| `/pm-rebase` | 交互式变基以清理历史 |

### 代理（自动/手动触发）

| 代理 | 专长 |
|------|------|
| `git-workflow-agent` | 复杂 Git 操作，冲突处理 |
| `pr-reviewer-agent` | 代码审查与质量分析 |
| `issue-tracker-agent` | Issues/PR 协调与跟踪 |
| `gh-cli-agent` | GitHub CLI 操作与 API 交互 |

### 技能（Claude 自动调用）

| 技能 | 目的 |
|------|------|
| `git-workflow` | Git 工作流最佳实践 |
| `branch-strategy` | 分支命名与生命周期 |
| `pr-management` | PR 创建与审查流程 |
| `gh-cli` | GitHub CLI 命令参考 |

### 钩子（自动）

| 事件 | 操作 |
|------|------|
| `SessionStart` | 加载 Git 上下文 |
| `PostToolUse[Write\|Edit]` | 检查未提交更改 |
| `PreToolUse[Bash]` | 验证 Git 命令 |
| `Stop` | 结束前确认 Git 状态 |

## 安装

```bash
# 克隆或下载插件
 git clone <repository-url> ~/.claude/plugins/project-management

# 或通过 Claude Code 安装
 /plugin install <marketplace-url>/project-management
```

## 使用方法

### 开启新功能

```
/pm-branch create 123 user-login
```

会创建 `feature/123-user-login` 分支并设置上游。

### 查看状态

```
/pm-status
```

显示当前分支、未提交更改以及同步状态。

### 与主干同步

```
/pm-sync
```

拉取并变基到主分支。

### 创建语义提交

```
/pm-commit
```

分析改动并创建约定式提交。

### 管理 PR

```
/pm-pr draft "Add user login feature"
/pm-pr ready
/pm-pr status
```

### GitHub CLI 操作

```
/pm-gh issue list
/pm-gh pr checks
/pm-gh run watch
```

### 合并后清理

```
/pm-cleanup
```

## 工作流理念

> **Git 是记账本，不是草稿纸；PR 是战役，不是游击战。**

### 核心原则

1. **优先变基**：保持线性提交历史
2. **原子提交**：每次提交都完整且可执行
3. **先草稿 PR**：先以草稿发起，再切换到准备审查
4. **清理**：合并后删除分支

### 约定式提交

```
<type>(<scope>): <subject> (#<issue>)

Types: feat, fix, docs, style, refactor, perf, test, chore, ci
```

## 目录结构

```
project-management/
├── .claude-plugin/
│   └── plugin.json          # 插件清单
├── commands/                 # 斜杠命令
│   ├── pm-status.md
│   ├── pm-branch.md
│   ├── pm-sync.md
│   ├── pm-commit.md
│   ├── pm-pr.md
│   ├── pm-gh.md
│   ├── pm-cleanup.md
│   └── pm-rebase.md
├── agents/                   # 子代理
│   ├── git-workflow-agent.md
│   ├── pr-reviewer-agent.md
│   ├── issue-tracker-agent.md
│   └── gh-cli-agent.md
├── skills/                   # 代理技能
│   ├── git-workflow/
│   │   ├── SKILL.md
│   │   └── COMMANDS.md
│   ├── branch-strategy/
│   │   └── SKILL.md
│   ├── pr-management/
│   │   └── SKILL.md
│   └── gh-cli/
│       ├── SKILL.md
│       └── COMMANDS.md
├── hooks/
│   └── hooks.json           # 钩子配置
├── scripts/                 # 钩子脚本
│   ├── session-context.sh
│   ├── check-uncommitted.sh
│   ├── validate-git-command.sh
│   └── validate-gh-command.sh
├── README.md
├── CHANGELOG.md
└── LICENSE
```

## 要求

- Git >= 2.38
- GitHub CLI (`gh`) 以支持 PR 操作
- Claude Code >= 1.0

## 许可证

MIT
