import { Command } from 'commander';
import { resolveScope, Scope } from '../scope';
import { validateType, exists, write, remove as removeExt } from '../writer';
import { getContent } from '../source';

function generateTemplate(type: string, name: string): string {
  switch (type) {
    case 'agent':
      return `---
name: ${name}
description: TODO
type: general-purpose
---

# ${name}

`;
    case 'skill':
      return `---
name: ${name}
description: TODO
---

# ${name}

`;
    case 'command':
      return `# ${name}

`;
    case 'memory':
      return `---
name: ${name}
description: TODO
type: user
---

`;
    default:
      return '';
  }
}

export function addCommand(): Command {
  const cmd = new Command('add')
    .description('添加扩展配置')
    .argument('<type>', '类型：agent | skill | command | memory')
    .argument('<name>', '扩展名称')
    .option('-g, --global', '系统级（默认）')
    .option('-l, --local', '项目级')
    .option('-f, --from <remote>', '从指定仓库拉取')
    .action(async (type: string, name: string, options: { global?: boolean; local?: boolean; from?: string }) => {
      validateType(type);
      const scope: Scope = options.local ? 'local' : 'global';

      if (exists(type, name, scope)) {
        console.log(`"${name}" 已存在，使用 --force 覆盖或先 remove。`);
        return;
      }

      let content: string;
      if (options.from) {
        console.log(`从仓库 "${options.from}" 拉取 ${type} "${name}"...`);
        content = await getContent(options.from, type, name);
      } else {
        console.log(`使用内置模板生成 ${type} "${name}"...`);
        content = generateTemplate(type, name);
      }

      write(type, name, content, scope, name);
      const scopeLabel = scope === 'global' ? '系统' : '项目';
      console.log(`已安装 ${type} "${name}" → ${scopeLabel}级`);
    });

  return cmd;
}
