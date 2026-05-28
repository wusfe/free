import { Command } from 'commander';
import { execSync } from 'child_process';
import { detectShell } from '../shell';

function parseProxyArg(arg: string | undefined): { httpProxy: string; sshOption: string } {
  if (!arg) {
    return {
      httpProxy: 'http://127.0.0.1:7890',
      sshOption: 'ProxyCommand=connect -S 127.0.0.1:7890 %h %p',
    };
  }

  // 纯数字 → 端口
  if (/^\d+$/.test(arg)) {
    return {
      httpProxy: `http://127.0.0.1:${arg}`,
      sshOption: `ProxyCommand=connect -S 127.0.0.1:${arg} %h %p`,
    };
  }

  // 完整 URL
  let url: URL;
  try {
    url = new URL(arg);
  } catch {
    console.error(`Invalid proxy address: ${arg}`);
    process.exit(1);
  }

  const host = url.hostname;
  const port = url.port || '7890';

  let proxyType: string;
  switch (url.protocol) {
    case 'socks5:':
    case 'socks5h:':
      proxyType = '-S';
      break;
    case 'http:':
    case 'https:':
      proxyType = '-H';
      break;
    default:
      proxyType = '-S';
  }

  return {
    httpProxy: arg,
    sshOption: `ProxyCommand=connect ${proxyType} ${host}:${port} %h %p`,
  };
}

function status(): void {
  const httpProxy = process.env.http_proxy || process.env.HTTP_PROXY || '';
  const httpsProxy = process.env.https_proxy || process.env.HTTPS_PROXY || '';
  const sshCommand = process.env.GIT_SSH_COMMAND || '';

  if (!httpProxy && !httpsProxy && !sshCommand) {
    console.log('Git 代理: 未设置');
    return;
  }

  console.log('Git 代理: 已开启');
  if (httpProxy) console.log(`  http_proxy=${httpProxy}`);
  if (httpsProxy) console.log(`  https_proxy=${httpsProxy}`);
  else if (httpProxy) console.log(`  https_proxy=${httpProxy}`);
  if (sshCommand) console.log(`  GIT_SSH_COMMAND=${sshCommand}`);
}

function exportVars(httpProxy: string, sshOption: string): void {
  const shell = detectShell();
  const escapedHttp = httpProxy.replace(/"/g, '\\"');
  const escapedSsh = sshOption.replace(/"/g, '\\"');

  switch (shell) {
    case 'fish':
      console.log(`set -gx http_proxy "${escapedHttp}"`);
      console.log(`set -gx https_proxy "${escapedHttp}"`);
      console.log(`set -gx GIT_SSH_COMMAND "ssh -o \\"${escapedSsh}\\""`);
      break;
    case 'powershell':
      console.log(`$env:http_proxy = "${httpProxy.replace(/"/g, '""')}"`);
      console.log(`$env:https_proxy = "${httpProxy.replace(/"/g, '""')}"`);
      console.log(`$env:GIT_SSH_COMMAND = 'ssh -o "${sshOption}"'`);
      break;
    default:
      console.log(`export http_proxy="${escapedHttp}"`);
      console.log(`export https_proxy="${escapedHttp}"`);
      console.log(`export GIT_SSH_COMMAND='ssh -o "${sshOption}"'`);
  }
}

function unsetVars(): void {
  const shell = detectShell();

  switch (shell) {
    case 'fish':
      console.log('set -e http_proxy; set -e https_proxy; set -e GIT_SSH_COMMAND');
      break;
    case 'powershell':
      console.log('Remove-Item env:http_proxy, env:https_proxy, env:GIT_SSH_COMMAND -ErrorAction SilentlyContinue');
      break;
    default:
      console.log('unset http_proxy https_proxy GIT_SSH_COMMAND');
  }
}

function testProxy(url: string): void {
  const nullDev = process.platform === 'win32' ? 'NUL' : '/dev/null';
  try {
    execSync(`curl -sI --connect-timeout 5 "${url}" > ${nullDev} 2>&1`, {
      timeout: 15000,
    });
    console.log(`[OK] 代理正常 - ${url}`);
  } catch {
    console.log('[!] 代理异常或无法连接');
  }
}

export function gitCommand(): Command {
  const cmd = new Command('git')
    .description('管理 Git 代理（HTTPS + SSH），仅当前会话生效');

  cmd
    .action(() => status());

  cmd
    .command('on')
    .description('开启 Git 代理')
    .argument('[proxy]', '代理地址或端口（默认 http://127.0.0.1:7890）')
    .action((proxy?: string) => {
      const { httpProxy, sshOption } = parseProxyArg(proxy);
      exportVars(httpProxy, sshOption);
    });

  cmd
    .command('off')
    .description('关闭 Git 代理')
    .action(() => unsetVars());

  cmd
    .command('test')
    .description('测试 Git 代理是否生效')
    .argument('[url]', '测试地址', 'https://github.com/wusfe')
    .action((url: string) => testProxy(url));

  return cmd;
}
