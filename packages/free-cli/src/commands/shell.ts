import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import {
  detectShell,
  getCurrentShell,
  removeHooks,
  upsertManagedBlock,
  getAllShellConfigFiles,
  SHELL_CONFIG_PATHS,
} from '../shell';

export function shellCommand(): Command {
  const cmd = new Command('shell')
    .description('管理 shell 集成');

  cmd
    .command('init')
    .description('安装 shell hook（支持 free switch 快捷方式）')
    .action(() => {
      const shellType = detectShell();
      const shellInfo = getCurrentShell();
      const { functionCode } = shellInfo;

      const configFiles = getAllShellConfigFiles(shellType);
      const allCandidates = SHELL_CONFIG_PATHS[shellType] || SHELL_CONFIG_PATHS.bash;

      if (!allCandidates || allCandidates.length === 0) {
        console.error('Could not detect shell configuration file');
        console.error('Please manually add the free function to your shell config');
        process.exit(1);
      }

      try {
        let installed = 0;
        let alreadyInstalled = 0;
        const filesToProcess = configFiles.length > 0 ? configFiles : [allCandidates[0]];

        for (const configFile of filesToProcess) {
          fs.mkdirSync(path.dirname(configFile), { recursive: true });

          let content = '';
          if (fs.existsSync(configFile)) {
            content = fs.readFileSync(configFile, 'utf8');
          }

          const result = upsertManagedBlock(content, functionCode);
          if (result.changed) {
            fs.writeFileSync(configFile, result.content, 'utf8');
            installed++;
            console.log(`Installed to: ${configFile}`);
          } else {
            alreadyInstalled++;
          }
        }

        if (installed > 0) {
          console.log('\nShell integration installed successfully.');
          console.log('Run "source <config-file>" or restart your terminal.');
          if (alreadyInstalled > 0) {
            console.log(`${alreadyInstalled} location(s) already had the hook`);
          }
        } else if (alreadyInstalled > 0) {
          console.log('Shell integration is already installed in all locations.');
        }
      } catch (err: any) {
        console.error(`Error installing shell integration: ${err.message}`);
        process.exit(1);
      }
    });

  cmd
    .command('remove')
    .description('清理所有 shell 配置文件中的 free hook')
    .action(() => {
      const results = removeHooks();
      let removed = 0;
      let errors = 0;

      for (const result of results) {
        if (result.status === 'removed') {
          console.log(`Remove from ${result.shell}: ${result.file}`);
          removed++;
        } else if (result.status === 'error') {
          console.error(`${result.shell} error: ${result.error}`);
          errors++;
        }
      }

      if (removed === 0 && errors === 0) {
        console.log('No free hooks found');
      } else {
        console.log(`\nRemoved ${removed} hook(s)`);
        if (errors) console.log(`${errors} error(s) encountered`);
      }
    });

  return cmd;
}
