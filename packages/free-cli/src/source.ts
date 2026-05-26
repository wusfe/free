import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import { resolveCacheDir, resolveConfigPath } from './scope';

interface RemoteConfig {
  [name: string]: string;
}

function readConfig(): RemoteConfig {
  const p = resolveConfigPath();
  if (!fs.existsSync(p)) return {};
  return fs.readJsonSync(p);
}

function writeConfig(config: RemoteConfig): void {
  const p = resolveConfigPath();
  fs.ensureDirSync(path.dirname(p));
  fs.writeJsonSync(p, config, { spaces: 2 });
}

export function addRemote(name: string, url: string): void {
  const config = readConfig();
  if (config[name]) {
    console.log(`Remote "${name}" already exists, updating URL.`);
  }
  config[name] = url;
  writeConfig(config);
  console.log(`Remote "${name}" added: ${url}`);
}

export function removeRemote(name: string): void {
  const config = readConfig();
  if (!config[name]) {
    console.log(`Remote "${name}" not found.`);
    return;
  }
  delete config[name];
  writeConfig(config);
  console.log(`Remote "${name}" removed.`);
}

export function listRemotes(): Record<string, string> {
  return readConfig();
}

export async function ensureCache(name: string): Promise<string> {
  const config = readConfig();
  const url = config[name];
  if (!url) {
    throw new Error(`Remote "${name}" not found. Use "free remote add ${name} <url>" first.`);
  }

  const cacheDir = resolveCacheDir(name);
  if (fs.existsSync(path.join(cacheDir, '.git'))) {
    const git = simpleGit(cacheDir);
    await git.pull();
  } else {
    fs.ensureDirSync(cacheDir);
    const git = simpleGit();
    await git.clone(url, cacheDir);
  }

  return cacheDir;
}

export async function getContent(remoteName: string, type: string, name: string): Promise<string> {
  const cacheDir = await ensureCache(remoteName);

  const fileMap: Record<string, string> = {
    agent: path.join(cacheDir, 'agents', `${name}.md`),
    skill: path.join(cacheDir, 'skills', name, 'SKILL.md'),
    command: path.join(cacheDir, 'commands', `${name}.md`),
    memory: path.join(cacheDir, 'memory', `${name}.md`),
  };

  const filePath = fileMap[type];
  if (!filePath) throw new Error(`Unknown type: ${type}`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`"${name}" not found in remote "${remoteName}" at ${path.relative(cacheDir, filePath)}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export async function listRemote(remoteName: string): Promise<Record<string, string[]>> {
  const cacheDir = await ensureCache(remoteName);
  const result: Record<string, string[]> = {};

  const types = ['agent', 'skill', 'command', 'memory'] as const;
  const dirs: Record<string, string> = {
    agent: 'agents',
    skill: 'skills',
    command: 'commands',
    memory: 'memory',
  };

  for (const type of types) {
    const dirPath = path.join(cacheDir, dirs[type]);
    if (!fs.existsSync(dirPath)) {
      result[type] = [];
      continue;
    }

    if (type === 'skill') {
      result[type] = fs.readdirSync(dirPath).filter(f =>
        fs.statSync(path.join(dirPath, f)).isDirectory() &&
        fs.existsSync(path.join(dirPath, f, 'SKILL.md'))
      );
    } else {
      result[type] = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
        .map(f => f.replace(/\.md$/, ''));
    }
  }

  return result;
}
