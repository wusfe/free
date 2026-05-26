import path from 'path';
import os from 'os';
import fs from 'fs-extra';

export type Scope = 'global' | 'local';

export function resolveScope(flag: Scope): string {
  if (flag === 'global') {
    return path.join(os.homedir(), '.claude');
  }
  return path.resolve(process.cwd(), '.claude');
}

export function resolveConfigPath(): string {
  return path.join(os.homedir(), '.free', 'remote.json');
}

export function resolveCacheDir(remoteName: string): string {
  return path.join(os.homedir(), '.free', 'cache', remoteName);
}

export function getTypeDir(type: string): string {
  const dirs: Record<string, string> = {
    agent: 'agents',
    skill: 'skills',
    command: 'commands',
    memory: 'memory',
  };
  const dir = dirs[type];
  if (!dir) throw new Error(`Unknown type: ${type}. Use agent|skill|command|memory`);
  return dir;
}
