import path from 'path';
import fs from 'fs-extra';
import { Scope, resolveScope, getTypeDir } from './scope';

const VALID_TYPES = ['agent', 'skill', 'command', 'memory'];

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

export function exists(type: string, name: string, scope: Scope): boolean {
  const scopePath = resolveScope(scope);
  switch (type) {
    case 'agent': return fs.existsSync(agentPath(scopePath, name));
    case 'skill': return fs.existsSync(skillPath(scopePath, name));
    case 'command': return fs.existsSync(commandPath(scopePath, name));
    case 'memory': return fs.existsSync(memoryPath(scopePath, name));
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
      // 追加 MEMORY.md 索引行
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

    case 'memory': {
      const memoryFile = memoryPath(scopePath, name);
      if (fs.existsSync(memoryFile)) {
        fs.removeSync(memoryFile);
      }
      // 从 MEMORY.md 移除对应索引行
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
