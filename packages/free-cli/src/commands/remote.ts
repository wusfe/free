import { Command } from 'commander';
import { addRemote, removeRemote, listRemotes, listRemote } from '../source';

export function remoteCommand(): Command {
  const cmd = new Command('remote')
    .description('管理源文件仓库');

  cmd
    .command('add')
    .description('注册源文件仓库')
    .argument('<name>', '仓库别名')
    .argument('<url>', 'Git 仓库地址')
    .action((name: string, url: string) => {
      addRemote(name, url);
    });

  cmd
    .command('list')
    .description('列出已注册的仓库')
    .action(async () => {
      const remotes = listRemotes();
      const names = Object.keys(remotes);
      if (names.length === 0) {
        console.log('没有已注册的仓库。使用 "free remote add <name> <url>" 添加。');
        return;
      }
      for (const name of names) {
        console.log(`  ${name}  ${remotes[name]}`);
        try {
          const entries = await listRemote(name);
          const counts = Object.entries(entries)
            .filter(([, items]) => items.length > 0)
            .map(([type, items]) => `${items.length} ${type}`)
            .join(', ');
          if (counts) {
            console.log(`    ├─ ${counts}`);
          }
        } catch {
          console.log(`    └─ (无法连接)`);
        }
      }
    });

  cmd
    .command('remove')
    .description('移除注册的仓库')
    .argument('<name>', '仓库别名')
    .action((name: string) => {
      removeRemote(name);
    });

  return cmd;
}
