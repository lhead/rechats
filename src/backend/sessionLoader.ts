import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { Session } from '../types';
import { formatCommandTags } from '../utils/formatCommandTags';

async function findJsonlFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return findJsonlFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
}

function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return formatCommandTags(content.trim());
  }

  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (typeof block === 'string') {
        const text = formatCommandTags(block.trim());
        if (text) {
          parts.push(text);
        }
        continue;
      }

      if (!block || typeof block !== 'object') {
        continue;
      }

      const record = block as Record<string, unknown>;
      const text = record.text;
      if (typeof text === 'string' && text.trim()) {
        parts.push(formatCommandTags(text.trim()));
        continue;
      }

      if (record.type === 'tool_use') {
        const name = record.name ?? record.tool_name ?? 'tool';
        parts.push(`[tool: ${String(name)}]`);
      }
    }
    return parts.join('\n\n').trim();
  }

  return '';
}

async function parseSession(filePath: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    let cwd = '';
    let lastUserMessage = '';

    for (const line of lines) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (!parsed || typeof parsed !== 'object') {
        continue;
      }

      const record = parsed as Record<string, unknown>;
      if (!cwd && typeof record.cwd === 'string') {
        cwd = record.cwd;
      }

      if (record.type === 'user') {
        const message = record.message as Record<string, unknown> | undefined;
        if (message && message.role === 'user') {
          const text = extractText(message.content);
          if (text) {
            lastUserMessage = text;
          }
        }
      }
    }

    const stat = await fs.stat(filePath);
    return {
      session_id: path.basename(filePath, '.jsonl'),
      cwd: cwd || '(unknown cwd)',
      updated_at: stat.mtimeMs,
      last_user_message: lastUserMessage || '(no user message)',
      file_path: filePath,
    };
  } catch {
    return null;
  }
}

export async function loadRecentSessions(): Promise<Session[]> {
  const root = path.join(os.homedir(), '.claude', 'projects');

  try {
    const files = await findJsonlFiles(root);
    const sessions = await Promise.all(files.map(parseSession));
    return sessions
      .filter((session): session is Session => session !== null)
      .sort((a, b) => b.updated_at - a.updated_at);
  } catch {
    return [];
  }
}
