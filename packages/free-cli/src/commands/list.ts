import { Command } from 'commander';
import { resolveScope, Scope } from '../scope';
import { listAll } from '../writer';
import { listRemote } from '../source';

export function listCommand(): Command {
  const cmd = new Command('list')
    .description('列出已安装的扩展')
    .option('-g, --global', '系统级（默认）')
    .option('-l, --local', '项目级')
    .option('-f, --from <remote>', '列出远程仓库中可用的扩展')
    .action(async (options: { global?: boolean; local?: boolean; from?: string }) => {
      if (options.from) {
        const entries = await listRemote(options.from);

        console.log(`远程仓库 "${options.from}" 可用的扩展：\n`);

        let total = 0;
        const labels: Record<string, string> = {
          agent: 'Agent',
          skill: 'Skill',
          command: 'Command',
          memory: 'Memory',
          group: 'Group',
        };

        for (const type of Object.keys(labels)) {
          const items = entries[type] || [];
          console.log(`  ${labels[type]} (${items.length})`);
          if (items.length > 0) {
            for (const name of items) {
              console.log(`    - ${name}`);
            }
          } else {
            console.log('    (空)');
          }
          console.log('');
          total += items.length;
        }

        console.log(`总计: ${total} 个扩展`);
        return;
      }

      const scope: Scope = options.local ? 'local' : 'global';
      const scopeLabel = scope === 'global' ? '系统' : '项目';
      const entries = listAll(scope);

      console.log(`${scopeLabel}级已安装的扩展：\n`);

      let total = 0;
      const labels: Record<string, string> = {
        agent: 'Agent',
        skill: 'Skill',
        command: 'Command',
        memory: 'Memory',
      };

      for (const type of Object.keys(labels)) {
        const items = entries[type] || [];
        console.log(`  ${labels[type]} (${items.length})`);
        if (items.length > 0) {
          for (const name of items) {
            console.log(`    - ${name}`);
          }
        } else {
          console.log('    (空)');
        }
        console.log('');
        total += items.length;
      }

      console.log(`总计: ${total} 个扩展`);
    });

  return cmd;
}
