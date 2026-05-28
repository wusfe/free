import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { CMD_NAME, ENV_PREFIX, MARKER_START, MARKER_END } from './constants';

// ===== Shell Detection =====

function getProcessCommand(pid: number): string | null {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`wmic process where processid=${pid} get commandline`, { encoding: 'utf8' });
      const lines = output.split('\n');
      if (lines.length > 1) {
        const cmdLine = lines[1].trim();
        if (cmdLine) return cmdLine;
      }
    } else {
      try {
        const cmdline = fs.readFileSync(`/proc/${pid}/comm`, 'utf8').trim();
        if (cmdline) return cmdline;
      } catch {
        const output = execSync(`ps -p ${pid} -o comm=`, { encoding: 'utf8' });
        return output.trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function detectFromCommand(cmd: string): string | null {
  const lower = cmd.toLowerCase();
  if (lower.includes('powershell')) return 'powershell';
  if (lower.includes('pwsh')) return 'powershell';
  if (lower.includes('fish')) return 'fish';
  if (lower.includes('zsh')) return 'zsh';
  if (lower.includes('bash')) return 'bash';
  if (lower.includes('ksh')) return 'ksh';
  if (lower.includes('tcsh')) return 'tcsh';
  if (lower.includes('csh')) return 'csh';
  if (lower.includes('dash')) return 'dash';
  if (lower.includes('sh')) return 'sh';
  return null;
}

function detectFromPath(shellPath: string): string | null {
  const base = path.basename(shellPath).toLowerCase();
  if (base.includes('powershell') || base.includes('pwsh')) return 'powershell';
  if (base.includes('fish')) return 'fish';
  if (base.includes('zsh')) return 'zsh';
  if (base.includes('bash')) return 'bash';
  if (base.includes('ksh')) return 'ksh';
  if (base.includes('tcsh')) return 'tcsh';
  if (base.includes('csh')) return 'csh';
  if (base.includes('dash')) return 'dash';
  if (base === 'sh') return 'sh';
  return null;
}

export function detectShell(): string {
  if (process.env.FREECC_SHELL) return process.env.FREECC_SHELL.toLowerCase();
  if (process.env.WC_SHELL) return process.env.WC_SHELL.toLowerCase();

  if (process.env.FISH_VERSION) return 'fish';
  if (process.env.ZSH_VERSION) return 'zsh';
  if (process.env.BASH_VERSION) return 'bash';

  const shellPath = process.env.SHELL || '';
  if (shellPath) {
    const shell = detectFromPath(shellPath);
    if (shell) return shell;
  }

  if (process.env.MSYSTEM) return 'bash';
  if (process.env.TERM && /(xterm|msys|mingw|cygwin)/i.test(process.env.TERM)) return 'bash';

  if (process.env.PSModulePath) return 'powershell';

  try {
    const parentCmd = getProcessCommand(process.ppid);
    if (parentCmd) {
      const shell = detectFromCommand(parentCmd);
      if (shell) return shell;
    }
  } catch {
    // ignore
  }

  if (process.platform === 'win32') {
    if (process.env.COMSPEC) {
      const shell = detectFromPath(process.env.COMSPEC);
      if (shell) return shell;
    }
  }

  if (process.env.TERM_PROGRAM) {
    const term = process.env.TERM_PROGRAM.toLowerCase();
    if (term.includes('fish')) return 'fish';
    if (term.includes('zsh')) return 'zsh';
    if (term.includes('bash')) return 'bash';
  }

  return 'bash';
}

// ===== Shell Config Paths =====

export const SHELL_CONFIG_PATHS: Record<string, string[]> = {
  bash: [path.join(os.homedir(), '.bashrc'), path.join(os.homedir(), '.bash_profile')],
  zsh: [path.join(os.homedir(), '.zshrc')],
  fish: [path.join(os.homedir(), '.config', 'fish', 'config.fish')],
  ksh: [path.join(os.homedir(), '.kshrc')],
  tcsh: [path.join(os.homedir(), '.tcshrc')],
  csh: [path.join(os.homedir(), '.cshrc')],
  dash: [path.join(os.homedir(), '.dashrc')],
  sh: [path.join(os.homedir(), '.profile')],
  powershell: [
    path.join(os.homedir(), 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(os.homedir(), '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1'),
  ],
};

export function getShellConfigFile(shellType: string): string {
  const candidates = SHELL_CONFIG_PATHS[shellType] || SHELL_CONFIG_PATHS.bash;
  for (const file of candidates) {
    if (fs.existsSync(file)) return file;
  }
  return candidates[0];
}

export function getAllShellConfigFiles(shellType: string): string[] {
  const candidates = SHELL_CONFIG_PATHS[shellType] || SHELL_CONFIG_PATHS.bash;
  return candidates.filter((file) => fs.existsSync(file));
}

// ===== Env Command Generation =====

export function generateEnvCommands(shellType: string, envVars: Record<string, string | number>, configName: string): string[] {
  const commands: string[] = [];
  switch (shellType) {
    case 'fish':
      for (const [k, v] of Object.entries(envVars)) {
        commands.push(`set -gx ${k} "${String(v).replace(/"/g, '\\"')}"`);
      }
      commands.push(`set -gx ${ENV_PREFIX} "${String(configName).replace(/"/g, '\\"')}"`);
      break;
    case 'tcsh':
    case 'csh':
      for (const [k, v] of Object.entries(envVars)) {
        commands.push(`setenv ${k} "${String(v).replace(/"/g, '\\"')}"`);
      }
      commands.push(`setenv ${ENV_PREFIX} "${String(configName).replace(/"/g, '\\"')}"`);
      break;
    case 'powershell':
      for (const [k, v] of Object.entries(envVars)) {
        commands.push(`$env:${k} = "${String(v).replace(/"/g, '""')}"`);
      }
      commands.push(`$env:${ENV_PREFIX} = "${String(configName).replace(/"/g, '""')}"`);
      break;
    default:
      for (const [k, v] of Object.entries(envVars)) {
        commands.push(`export ${k}="${String(v).replace(/"/g, '\\"')}"`);
      }
      commands.push(`export ${ENV_PREFIX}="${String(configName).replace(/"/g, '\\"')}"`);
      break;
  }
  return commands;
}

// ===== Shell Function (Hook) Generation =====

export function generateShellFunction(shellType: string): string {
  const functions: Record<string, string> = {
    bash: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
${CMD_NAME}() {
  if [ "$1" = "switch" ]; then
    eval "$(command ${CMD_NAME} model switch "$2")"
  elif [ "$1" = "git" ] && [ "$2" = "on" -o "$2" = "off" ]; then
    eval "$(command ${CMD_NAME} git "$2" "$3")"
  else
    command ${CMD_NAME} "$@"
  fi
}
echo "[OK] ${CMD_NAME}-env manager loaded"
${MARKER_END}`,
    zsh: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
${CMD_NAME}() {
  if [ "$1" = "switch" ]; then
    eval "$(command ${CMD_NAME} model switch "$2")"
  elif [ "$1" = "git" ] && [ "$2" = "on" -o "$2" = "off" ]; then
    eval "$(command ${CMD_NAME} git "$2" "$3")"
  else
    command ${CMD_NAME} "$@"
  fi
}
echo "[OK] ${CMD_NAME}-env manager loaded"
${MARKER_END}`,
    fish: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
function ${CMD_NAME}
  if test "$argv[1]" = "switch"
    eval (command ${CMD_NAME} model switch $argv[2] | source)
  else if test "$argv[1]" = "git"; and test "$argv[2]" = "on" -o "$argv[2]" = "off"
    eval (command ${CMD_NAME} git $argv[2] $argv[3] | source)
  else
    command ${CMD_NAME} $argv
  end
end
echo "[OK] ${CMD_NAME}-env manager loaded"
${MARKER_END}`,
    ksh: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
${CMD_NAME}() {
  if [ "$1" = "switch" ]; then
    eval "$(command ${CMD_NAME} model switch "$2")"
  elif [ "$1" = "git" ] && [ "$2" = "on" -o "$2" = "off" ]; then
    eval "$(command ${CMD_NAME} git "$2" "$3")"
  else
    command ${CMD_NAME} "$@"
  fi
}
echo "[OK] ${CMD_NAME}-env manager loaded"
${MARKER_END}`,
    tcsh: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
alias ${CMD_NAME} '\\
  if ("$1" == "switch") then \\
    eval \`command ${CMD_NAME} model switch $2\` \\
  else if ("$1" == "git" && "$2" == "on") then \\
    eval \`command ${CMD_NAME} git on $3\` \\
  else if ("$1" == "git" && "$2" == "off") then \\
    eval \`command ${CMD_NAME} git off\` \\
  else \\
    command ${CMD_NAME} $* \\
  endif \\
'
echo "[OK] ${CMD_NAME}-env manager loaded"
${MARKER_END}`,
    powershell: `${MARKER_START}
# Auto-generated by ${CMD_NAME}-env npm package
function ${CMD_NAME} {
  param([Parameter(ValueFromRemainingArguments=$true)]$args)
  if ($args[0] -eq "switch") {
    $output = & ${CMD_NAME}.cmd model switch $args[1] 2>&1 | Out-String
    Invoke-Expression $output
  } elseif ($args[0] -eq "git" -and ($args[1] -eq "on" -or $args[1] -eq "off")) {
    $output = & ${CMD_NAME}.cmd git $args[1] $args[2] 2>&1 | Out-String
    Invoke-Expression $output
  } else {
    & ${CMD_NAME}.cmd @args
  }
}
Write-Host "[OK] ${CMD_NAME}-env manager loaded" -ForegroundColor Green
${MARKER_END}`,
  };
  return functions[shellType] || functions.bash;
}

export function getCurrentShell(): { type: string; configFile: string; functionCode: string } {
  const type = detectShell();
  const configFile = getShellConfigFile(type);
  const functionCode = generateShellFunction(type);
  return { type, configFile, functionCode };
}

// ===== Hook Management =====

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function upsertManagedBlock(content: string, block: string): { changed: boolean; content: string } {
  const hasStart = content.includes(MARKER_START);
  const hasEnd = content.includes(MARKER_END);

  if (hasStart && hasEnd) {
    const pattern = new RegExp(
      `${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}`,
      'm'
    );
    return { changed: true, content: content.replace(pattern, block) };
  }

  if (hasStart && !hasEnd) {
    const startIndex = content.indexOf(MARKER_START);
    return { changed: true, content: `${content.slice(0, startIndex).trimEnd()}\n\n${block}\n` };
  }

  return { changed: true, content: `${content.trimEnd()}\n\n${block}\n` };
}

export function removeHooks(): Array<{ shell: string; file: string | null; status: string; error?: string }> {
  const shellTypes = ['bash', 'zsh', 'fish', 'ksh', 'tcsh', 'csh', 'dash', 'sh', 'powershell'];
  const results: Array<{ shell: string; file: string | null; status: string; error?: string }> = [];

  for (const shellType of shellTypes) {
    const configFiles = getAllShellConfigFiles(shellType);
    if (configFiles.length === 0) {
      results.push({ shell: shellType, file: null, status: 'not-found' });
      continue;
    }

    for (const configFile of configFiles) {
      try {
        let content = fs.readFileSync(configFile, 'utf8');
        const originalContent = content;

        const pattern = new RegExp(
          `\\n?${escapeRegExp(MARKER_START)}[\\s\\S]*?${escapeRegExp(MARKER_END)}\\n?`,
          'g'
        );
        content = content.replace(pattern, '\n');
        content = content.replace(/\n{3,}/g, '\n\n').trim();
        if (content) content += '\n';

        if (content !== originalContent) {
          fs.writeFileSync(configFile, content, 'utf8');
          results.push({ shell: shellType, file: configFile, status: 'removed' });
        } else {
          results.push({ shell: shellType, file: configFile, status: 'not-found' });
        }
      } catch (err: any) {
        results.push({ shell: shellType, file: configFile, status: 'error', error: err.message });
      }
    }
  }

  return results;
}
