import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { resolveScope, Scope } from '../scope';
import { validateType, exists, write, writeGroup, remove as removeExt } from '../writer';
import { getContent, getGroupInfo, resolveMemberFiles, ensureCache } from '../source';

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
    .argument('<type>', '类型：agent | skill | command | memory | group')
    .argument('<name>', '扩展名称')
    .option('-g, --global', '系统级（默认）')
    .option('-l, --local', '项目级')
    .option('-f, --from <remote>', '从指定仓库拉取')
    .action(async (type: string, name: string, options: { global?: boolean; local?: boolean; from?: string }) => {
      validateType(type);
      const scope: Scope = options.local ? 'local' : 'global';

      // —— group 安装 ——
      if (type === 'group') {
        if (!options.from) {
          console.log('group 类型必须指定 --from <remote>');
          return;
        }

        if (exists('group', name, scope)) {
          console.log(`group "${name}" 已存在，使用 --force 覆盖或先 remove。`);
          return;
        }

        console.log(`从仓库 "${options.from}" 拉取 group "${name}"...`);
        const { agentContent, groupDir, members, isFolder } = await getGroupInfo(options.from, name);

        // 写入 group
        const { agentSortDir } = await writeGroup(name, scope, groupDir, agentContent, isFolder);

        // 处理 members 引用
        const cacheDir = await ensureCache(options.from);
        const memberFiles = resolveMemberFiles(cacheDir, members);

        for (const [mtype, filePaths] of Object.entries(memberFiles)) {
          for (const srcPath of filePaths) {
            if (fs.existsSync(srcPath)) {
              const relPath = path.relative(cacheDir, srcPath);

              if (relPath.startsWith('skills')) {
                // skills/explain/SKILL.md → agent-sort/<name>/skills/explain/SKILL.md
                const dest = path.join(agentSortDir, relPath);
                fs.ensureDirSync(path.dirname(dest));
                fs.copyFileSync(srcPath, dest);
                console.log(`  → members: ${relPath}`);
              } else if (relPath.startsWith('commands') || relPath.startsWith('memory')) {
                const dest = path.join(agentSortDir, relPath);
                fs.ensureDirSync(path.dirname(dest));
                fs.copyFileSync(srcPath, dest);
                console.log(`  → members: ${relPath}`);
              } else if (relPath.includes('groups/')) {
                // 跨组引用: groups/<g>/skills/<s>/SKILL.md
                const relAfterGroups = relPath.replace(/^groups\/[^/]+\//, '');
                const dest = path.join(agentSortDir, relAfterGroups);
                fs.ensureDirSync(path.dirname(dest));
                fs.copyFileSync(srcPath, dest);
                console.log(`  → members: ${relPath}`);
              }
            }
          }
        }

        const scopeLabel = scope === 'global' ? '系统' : '项目';
        const formLabel = isFolder ? '文件夹' : '单文件';
        console.log(`已安装 group "${name}" (${formLabel}) → ${scopeLabel}级`);
        return;
      }

      // —— 普通类型安装 ——
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
