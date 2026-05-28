#!/usr/bin/env node

import { Command } from 'commander';
import { modelCommand } from './commands/model';
import { shellCommand } from './commands/shell';
import { addCommand } from './commands/add';
import { removeCommand } from './commands/remove';
import { listCommand } from './commands/list';
import { remoteCommand } from './commands/remote';
import { gitCommand } from './commands/git';
import { version } from '../package.json';

const program = new Command();

program
  .name('free')
  .description('Claude Code 配置管理工具（API 提供商切换 + 扩展管理）')
  .version(version);

program.addCommand(modelCommand());
program.addCommand(shellCommand());
program.addCommand(remoteCommand());
program.addCommand(addCommand());
program.addCommand(removeCommand());
program.addCommand(listCommand());
program.addCommand(gitCommand());

program.parse();
