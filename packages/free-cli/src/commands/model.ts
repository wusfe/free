import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { CONFIG_FILE, LEGACY_CONFIG_FILE, ENV_PREFIX } from '../constants';
import { getCurrentShell, generateEnvCommands } from '../shell';

function migrateLegacyConfig(): void {
  if (fs.existsSync(CONFIG_FILE) || !fs.existsSync(LEGACY_CONFIG_FILE)) return;

  console.log('Migrating ~/.free.json → ~/.free/model.json');
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  fs.renameSync(LEGACY_CONFIG_FILE, CONFIG_FILE);
}

function loadAllConfigs(): Record<string, Record<string, string | number>> {
  migrateLegacyConfig();
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }
  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(content);
  } catch (err: any) {
    console.error(`Failed to parse ${CONFIG_FILE}:`, err.message);
    process.exit(1);
  }
}

function loadConfig(name: string): { name: string; env: Record<string, string | number> } {
  const all = loadAllConfigs();
  if (!all[name]) {
    const available = Object.keys(all);
    console.error(`Config "${name}" not found`);
    if (available.length) {
      console.error('\nAvailable configs:');
      available.forEach((c) => console.error(`  ${c}`));
    }
    process.exit(1);
  }
  return { name, env: all[name] };
}

export function modelCommand(): Command {
  const cmd = new Command('model')
    .description('管理 API 提供商配置');

  cmd
    .command('switch')
    .description('切换 API 提供商')
    .argument('<name>', '配置名称')
    .action((configName: string) => {
      const config = loadConfig(configName);
      const shellInfo = getCurrentShell();
      const commands = generateEnvCommands(shellInfo.type, config.env, configName);
      commands.forEach((c) => console.log(c));

      switch (shellInfo.type) {
        case 'powershell':
          console.log(`Write-Host "[OK] Switched to config: ${configName}" -ForegroundColor Green`);
          break;
        case 'fish':
          console.log(`echo "[OK] Switched to config: ${configName}"`);
          break;
        default:
          console.log(`echo "[OK] Switched to config: ${configName}"`);
      }
    });

  cmd
    .command('list')
    .description('列出所有 API 提供商配置')
    .action(() => {
      const all = loadAllConfigs();
      const names = Object.keys(all);
      if (names.length === 0) {
        console.log('No configurations found.');
        console.log(`\nCreate your first config in ${CONFIG_FILE}`);
        return;
      }
      console.log('Available configurations:');
      names.forEach((name) => console.log(`  ${name}`));
    });

  cmd
    .command('current')
    .description('显示当前使用的 API 提供商')
    .action(() => {
      const current = process.env[ENV_PREFIX];
      if (current) {
        console.log(`Current config: ${current}`);
      } else {
        console.log('No active configuration');
      }
    });

  cmd
    .command('init')
    .description(`初始化 ${CONFIG_FILE} 配置文件`)
    .action(() => {
      fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });

      if (!fs.existsSync(CONFIG_FILE)) {
        const example: Record<string, Record<string, string | number>> = {
          kimi: {
            ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/',
            ANTHROPIC_AUTH_TOKEN: '',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'kimi-k2.5',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'kimi-k2.5',
            ENABLE_TOOL_SEARCH: 'false',
          },
          minimax: {
            ANTHROPIC_BASE_URL: 'https://api.minimaxi.com/anthropic',
            ANTHROPIC_AUTH_TOKEN: '',
            API_TIMEOUT_MS: '3000000',
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
            ANTHROPIC_MODEL: 'MiniMax-M2.7',
            ANTHROPIC_SMALL_FAST_MODEL: 'MiniMax-M2.7',
            ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M2.7',
            ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M2.7',
            ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M2.7',
          },
        };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(example, null, 2));
        console.log(`Created example config file: ${CONFIG_FILE}`);
        console.log('\nEdit this file to add your own configurations and API keys.');
      } else {
        console.log(`Config file already exists: ${CONFIG_FILE}`);
      }
    });

  return cmd;
}
