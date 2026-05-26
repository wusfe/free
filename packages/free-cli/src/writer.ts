import path from 'path';
import fs from 'fs-extra';
import { Scope, resolveScope, getTypeDir } from './scope';

const VALID_TYPES = ['agent', 'skill', 'command', 'memory', 'group'];

export function validateType(type: string): void {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid type "${type}". Must be one of: ${VALID_TYPES.join(', ')}`);
  }
}

function agentPath(scopePath: string, name: string): string {
  return path.join(scopePath, 'agents', `${name}.md`);
}

function skillPath(scopePath: string, name: string): string {
  return path.join(scopePath, 'skills', name, 'SKILL.md');
}

function commandPath(scopePath: string, name: string): string {
  return path.join(scopePath, 'commands', `${name}.md`);
}

function memoryPath(scopePath: string, name: string): string {
  return path.join(scopePath, 'memory', `${name}.md`);
}

function memoryIndexPath(scopePath: string): string {
  return path.join(scopePath, 'memory', 'MEMORY.md');
}

export function resolveAgentSortDir(scope: Scope, groupName: string): string {
  return path.join(resolveScope(scope), 'agent-sort', groupName);
}

export function exists(type: string, name: string, scope: Scope): boolean {
  const scopePath = resolveScope(scope);
  switch (type) {
    case 'agent': return fs.existsSync(agentPath(scopePath, name));
    case 'skill': return fs.existsSync(skillPath(scopePath, name));
    case 'command': return fs.existsSync(commandPath(scopePath, name));
    case 'memory': return fs.existsSync(memoryPath(scopePath, name));
    case 'group': return fs.existsSync(agentPath(scopePath, name));
    default: return false;
  }
}

export function write(type: string, name: string, content: string, scope: Scope, description?: string): void {
  const scopePath = resolveScope(scope);

  switch (type) {
    case 'agent':
      fs.ensureDirSync(path.dirname(agentPath(scopePath, name)));
      fs.writeFileSync(agentPath(scopePath, name), content, 'utf-8');
      break;

    case 'skill':
      fs.ensureDirSync(path.dirname(skillPath(scopePath, name)));
      fs.writeFileSync(skillPath(scopePath, name), content, 'utf-8');
      break;

    case 'command':
      fs.ensureDirSync(path.dirname(commandPath(scopePath, name)));
      fs.writeFileSync(commandPath(scopePath, name), content, 'utf-8');
      break;

    case 'memory':
      fs.ensureDirSync(path.dirname(memoryPath(scopePath, name)));
      fs.writeFileSync(memoryPath(scopePath, name), content, 'utf-8');
      const indexLine = `- [${description || name}](${name}.md) — ${description || name}`;
      const indexPath = memoryIndexPath(scopePath);
      fs.ensureDirSync(path.dirname(indexPath));
      if (fs.existsSync(indexPath)) {
        const existing = fs.readFileSync(indexPath, 'utf-8');
        if (!existing.includes(`(${name}.md)`)) {
          fs.appendFileSync(indexPath, `${indexLine}\n`, 'utf-8');
        }
      } else {
        fs.writeFileSync(indexPath, `${indexLine}\n`, 'utf-8');
      }
      break;
  }
}

/**
 * 安装 group：单文件 → 写入 agents/，文件夹 → 写入 agents/ + agent-sort/
 * 返回 { agentName, agentSortDir } 供外部处理 members
 */
export async function writeGroup(
  name: string,
  scope: Scope,
  groupDir: string,
  agentContent: string,
  isFolder: boolean,
): Promise<{ agentName: string; agentSortDir: string }> {
  const scopePath = resolveScope(scope);
  const agentSortDir = resolveAgentSortDir(scope, name);

  // 写入 agent 入口
  fs.ensureDirSync(path.dirname(agentPath(scopePath, name)));
  fs.writeFileSync(agentPath(scopePath, name), agentContent, 'utf-8');

  if (isFolder) {
    // 复制私有 skills/commands/memory
    const dirs = ['skills', 'commands', 'memory'] as const;
    for (const d of dirs) {
      const srcDir = path.join(groupDir, d);
      if (fs.existsSync(srcDir)) {
        const dstDir = path.join(agentSortDir, d);
        fs.ensureDirSync(dstDir);
        fs.copySync(srcDir, dstDir);
      }
    }
  }

  return { agentName: name, agentSortDir };
}

export function remove(type: string, name: string, scope: Scope): void {
  const scopePath = resolveScope(scope);

  switch (type) {
    case 'agent':
      fs.removeSync(agentPath(scopePath, name));
      break;

    case 'skill':
      fs.removeSync(path.join(scopePath, 'skills', name));
      break;

    case 'command':
      fs.removeSync(commandPath(scopePath, name));
      break;

    case 'group': {
      fs.removeSync(agentPath(scopePath, name));
      fs.removeSync(resolveAgentSortDir(scope, name));
      break;
    }

    case 'memory': {
      const memoryFile = memoryPath(scopePath, name);
      if (fs.existsSync(memoryFile)) {
        fs.removeSync(memoryFile);
      }
      const indexPath = memoryIndexPath(scopePath);
      if (fs.existsSync(indexPath)) {
        const lines = fs.readFileSync(indexPath, 'utf-8').split('\n');
        const filtered = lines.filter(line => !line.includes(`(${name}.md)`));
        fs.writeFileSync(indexPath, filtered.join('\n'), 'utf-8');
      }
      break;
    }
  }
}

export function listAll(scope: Scope): Record<string, string[]> {
  const scopePath = resolveScope(scope);
  const result: Record<string, string[]> = {};

  for (const type of VALID_TYPES) {
    if (type === 'group') {
      result[type] = [];
      continue;
    }
    const typeDir = getTypeDir(type);
    const dirPath = path.join(scopePath, typeDir);

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
