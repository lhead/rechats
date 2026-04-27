import * as fs from 'fs/promises';
import type { SessionDetail, SessionMessage } from '../types';
import { formatCommandTags } from '../utils/formatCommandTags';

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

export async function loadSessionDetail(filePath: string): Promise<SessionDetail | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const messages: SessionMessage[] = [];
    let cwd = '';

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

      if (record.type === 'user' || record.type === 'assistant') {
        const message = record.message as Record<string, unknown> | undefined;
        if (!message) {
          continue;
        }

        const role = message.role;
        if (role !== 'user' && role !== 'assistant') {
          continue;
        }

        const text = extractText(message.content);
        if (!text) {
          continue;
        }

        messages.push({
          role,
          text,
        });
      }
    }

    const stat = await fs.stat(filePath);
    return {
      session_id: filePath.split('/').pop()?.replace(/\.jsonl$/, '') || filePath,
      cwd: cwd || '(unknown cwd)',
      updated_at: stat.mtimeMs,
      file_path: filePath,
      messages,
    };
  } catch {
    return null;
  }
}
