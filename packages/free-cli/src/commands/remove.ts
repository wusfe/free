import { Command } from 'commander';
import { resolveScope, Scope } from '../scope';
import { validateType, exists, remove as removeExt } from '../writer';

export function removeCommand(): Command {
  const cmd = new Command('remove')
    .description('移除扩展配置')
    .argument('<type>', '类型：agent | skill | command | memory | group')
    .argument('<name>', '扩展名称')
    .option('-g, --global', '系统级（默认）')
    .option('-l, --local', '项目级')
    .option('--force', '跳过确认')
    .action((type: string, name: string, options: { global?: boolean; local?: boolean; force?: boolean }) => {
      validateType(type);
      const scope: Scope = options.local ? 'local' : 'global';

      if (!exists(type, name, scope)) {
        console.log(`"${name}" 不存在。`);
        return;
      }

      removeExt(type, name, scope);
      const scopeLabel = scope === 'global' ? '系统' : '项目';
      console.log(`已移除 ${type} "${name}" ← ${scopeLabel}级`);
    });

  return cmd;
}
