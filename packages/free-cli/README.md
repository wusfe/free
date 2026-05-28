# @free-air/cli

Claude Code 一站式配置工具。三个核心能力：

- **切换 API 提供商** — 在 Kimi、DeepSeek、MiniMax 等之间随时切换，像 nvm 切 Node 版本一样简单
- **管理 Git 代理** — 一键开关 HTTPS/SSH 代理，仅当前会话生效
- **管理扩展文件** — 从 Git 仓库一键安装 agent、skill、command、memory

## 快速开始

```bash
npm i -g @free-air/cli

# 初始化模型配置
free model init

# 填入 API key，然后切换
free switch kimi

# 开启 Git 代理（默认 7890 端口）
free git on
```

安装时自动注册 shell 钩子，`free switch <name>` 可直接在终端生效。

## 命令

### model — API 提供商管理

| 命令 | 说明 |
|------|------|
| `free model init` | 创建配置文件 `~/.free/model.json`（含示例） |
| `free model list` | 列出所有提供商 |
| `free model switch <name>` | 切换提供商 |
| `free model current` | 显示当前使用的提供商 |

### 扩展管理

| 命令 | 说明 |
|------|------|
| `free remote add <name> <url>` | 注册源文件仓库 |
| `free remote list` | 查看已注册仓库 |
| `free remote remove <name>` | 移除仓库 |
| `free list [--global\|--local]` | 列出本地已安装扩展 |
| `free list --from <remote>` | 浏览远程仓库可用的扩展 |
| `free add <type> <name> [--from <remote>] [--global\|--local]` | 安装扩展 |
| `free remove <type> <name> [--global\|--local]` | 卸载扩展 |

扩展类型：`agent` | `skill` | `command` | `memory` | `group`

`group` 是带私有能力的 agent，安装后 agent 入口写入 `.claude/agents/`，配套的 skill/command/memory 写入 `.claude/agent-sort/<name>/`。

安装到 `--global`（`~/.claude/`）或 `--local`（项目 `.claude/`）。默认全局。

### git — Git 代理管理

通过环境变量控制 Git 代理，仅当前终端会话生效。

| 命令 | 说明 |
|------|------|
| `free git` | 查看当前代理状态（http_proxy、GIT_SSH_COMMAND） |
| `free git on [proxy]` | 开启代理，可自定义地址或端口（默认 `http://127.0.0.1:7890`） |
| `free git off` | 关闭代理 |
| `free git test [url]` | 测试代理连通性（默认 `https://github.com/wusfe`） |

`free git on` 同时设置 HTTPS 代理（`http_proxy` / `https_proxy`）和 SSH 代理（`GIT_SSH_COMMAND`），方式为环境变量而非 `git config --global`，关闭终端即失效。

### shell — Shell 集成

| 命令 | 说明 |
|------|------|
| `free shell init` | 往 shell 配置文件注入钩子函数 |
| `free shell remove` | 清理所有 shell 配置中的钩子 |

钩子安装后，`free switch <name>` 无需显式写 `model` 前缀。

## 配置文件

### 模型配置（`~/.free/model.json`）

```json
{
  "kimi": {
    "ANTHROPIC_BASE_URL": "https://api.kimi.com/coding/",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "kimi-k2.6",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "kimi-k2.6",
    "ENABLE_TOOL_SEARCH": "false"
  },
  "deepseek": {
    "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "sk-xxx",
    "API_TIMEOUT_MS": "3000000",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": 1,
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash[1m]"
  }
}
```

每个 provider 支持以下环境变量：

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_BASE_URL` | API 端点地址 |
| `ANTHROPIC_AUTH_TOKEN` | API Key |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Sonnet 对应模型 |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Opus 对应模型 |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Haiku 对应模型 |
| `ANTHROPIC_MODEL` | 默认模型（优先级最高） |
| `ANTHROPIC_SMALL_FAST_MODEL` | 轻量模型 |
| `API_TIMEOUT_MS` | 超时时间 |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | 关闭非必要流量（设为 1） |
| `ENABLE_TOOL_SEARCH` | 工具搜索开关 |

### 扩展源仓库

```bash
free remote add my git@github.com:user/free-extensions.git
```

仓库目录结构：

```
free-extensions/
├── agents/
│   └── code-reviewer.md
├── skills/
│   └── git-workflow/
│       └── SKILL.md
├── commands/
│   └── review.md
├── memory/
│   └── methodology.md
└── groups/
    ├── agent-code-review.md
    └── agent-code-review/
        ├── agent.md
        ├── skills/
        ├── commands/
        └── memory/
```

结构完全对应 `~/.claude/`，`free add` 从仓库复制到本地即可用。

### agent 文件格式

```markdown
---
name: code-reviewer
description: 代码审查专家
type: general-purpose
---

# 角色
你是一个代码审查专家...
```

## 目录结构

```
~/.free/
├── model.json        # API 提供商配置
├── remote.json       # 注册的源仓库
└── cache/            # git clone 缓存

~/.claude/
├── agents/           # agent / group 入口 → 这里
├── skills/           # free add skill → 这里
├── commands/         # free add command → 这里
├── memory/           # free add memory → 这里
└── agent-sort/       # group 私有能力 → 这里
```

## 常见用法

```bash
# 切换模型
free switch kimi
free switch deepseek

# 开启/关闭 Git 代理
free git on              # 开启（默认 http://127.0.0.1:7890）
free git on 1080         # 自定义端口
free git test            # 测试连通性
free git off             # 关闭

# 从仓库安装 code-reviewer agent
free remote add lab git@github.com:my/free-extensions.git
free list --from lab
free add agent code-reviewer --from lab --global

# 安装 group（agent + 配套 skill/command/memory 一起到位）
free add group agent-code-review --from lab --global

# 项目级安装（只在当前项目生效）
free add command review --from lab --local

# 查看装了什么
free list --global
```

## License

MIT
