# free

Claude Code 配置管理工具集。

## 主要特性

- **一键切换 API 提供商** — Kimi、DeepSeek、MiniMax 等随时切，终端直接生效
- **Git 仓库即扩展源** — agent、skill、command、memory 从仓库一键安装
- **Shell 原生集成** — 自动注入钩子，`free switch kimi` 像 nvm 一样自然
- **项目级 + 系统级** — `--global` 全局生效，`--local` 仅当前项目
- **零配置起步** — `model init` 即有示例，`remote add` 即连仓库

## 包

| 包 | 说明 |
|---|---|
| [@free-air/cli](packages/free-cli) | CLI 工具 |

```bash
npm i -g @free-air/cli
```

## License

MIT
