import path from 'path';
import fs from 'fs-extra';
import simpleGit from 'simple-git';
import { resolveCacheDir, resolveConfigPath } from './scope';

interface RemoteConfig {
  [name: string]: string;
}

interface GroupMembers {
  skills: string[];
  commands: string[];
  memory: string[];
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

function parseMembers(content: string): GroupMembers {
  const result: GroupMembers = { skills: [], commands: [], memory: [] };
  const match = content.match(/---\n([\s\S]*?)\n---/);
  if (!match) return result;

  const yaml = match[1];
  const membersMatch = yaml.match(/members:\s*\n((?:[\s\S]*?))(?:\n\w|$)/);
  if (!membersMatch) return result;

  const membersBlock = membersMatch[1];
  const types = ['skills', 'commands', 'memory'] as const;

  for (const t of types) {
    const re = new RegExp(`${t}:\\s*\\[([^\\]]*)\\]`);
    const m = membersBlock.match(re);
    if (m) {
      result[t] = m[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }
  }

  return result;
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

/**
 * 判断 group 是单文件还是文件夹，返回 agent 内容和目录路径
 */
export async function getGroupInfo(
  remoteName: string,
  name: string,
): Promise<{
  agentContent: string;
  groupDir: string;
  members: GroupMembers;
  isFolder: boolean;
}> {
  const cacheDir = await ensureCache(remoteName);
  const groupsDir = path.join(cacheDir, 'groups');

  const mdPath = path.join(groupsDir, `${name}.md`);
  const folderPath = path.join(groupsDir, name);

  if (fs.existsSync(mdPath)) {
    const agentContent = fs.readFileSync(mdPath, 'utf-8');
    const members = parseMembers(agentContent);
    return { agentContent, groupDir: groupsDir, members, isFolder: false };
  }

  if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
    const agentMdPath = path.join(folderPath, 'agent.md');
    if (!fs.existsSync(agentMdPath)) {
      throw new Error(`Group folder "${name}" missing agent.md in remote "${remoteName}"`);
    }
    const agentContent = fs.readFileSync(agentMdPath, 'utf-8');
    const members = parseMembers(agentContent);
    return { agentContent, groupDir: folderPath, members, isFolder: true };
  }

  throw new Error(`Group "${name}" not found in remote "${remoteName}" (neither ${name}.md nor ${name}/)`);
}

/**
 * 根据 members 声明解析引用的文件路径（相对于缓存目录）
 */
export function resolveMemberFiles(cacheDir: string, members: GroupMembers): Record<string, string[]> {
  const files: Record<string, string[]> = { skills: [], commands: [], memory: [] };

  for (const member of members.skills) {
    if (member.includes('/')) {
      // 跨组引用: agent-code-review/explain → groups/agent-code-review/skills/explain
      const [group, rest] = member.split('/');
      files.skills.push(path.join(cacheDir, 'groups', group, 'skills', rest, 'SKILL.md'));
    } else {
      // 根目录引用: explain → skills/explain/
      files.skills.push(path.join(cacheDir, 'skills', member, 'SKILL.md'));
    }
  }

  for (const member of members.commands) {
    if (member.includes('/')) {
      const [group, rest] = member.split('/');
      files.commands.push(path.join(cacheDir, 'groups', group, 'commands', `${rest}.md`));
    } else {
      files.commands.push(path.join(cacheDir, 'commands', `${member}.md`));
    }
  }

  for (const member of members.memory) {
    if (member.includes('/')) {
      const [group, rest] = member.split('/');
      files.memory.push(path.join(cacheDir, 'groups', group, 'memory', `${rest}.md`));
    } else {
      files.memory.push(path.join(cacheDir, 'memory', `${member}.md`));
    }
  }

  return files;
}

export async function listRemote(remoteName: string): Promise<Record<string, string[]>> {
  const cacheDir = await ensureCache(remoteName);
  const result: Record<string, string[]> = {};

  const types = ['agent', 'skill', 'command', 'memory', 'group'] as const;
  const dirs: Record<string, string> = {
    agent: 'agents',
    skill: 'skills',
    command: 'commands',
    memory: 'memory',
    group: 'groups',
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
    } else if (type === 'group') {
      result[type] = fs.readdirSync(dirPath)
        .filter(f => {
          const p = path.join(dirPath, f);
          if (f.endsWith('.md')) return true;
          if (fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'agent.md'))) return true;
          return false;
        })
        .map(f => f.replace(/\.md$/, ''));
    } else {
      result[type] = fs.readdirSync(dirPath)
        .filter(f => f.endsWith('.md') && f !== 'MEMORY.md')
        .map(f => f.replace(/\.md$/, ''));
    }
  }

  return result;
}
