import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { SearchOptions, SearchResult, Session, SessionMessage, TextSpan } from '../types';
import { formatCommandTags } from '../utils/formatCommandTags';

interface SearchableSession extends Session {
  messages: SessionMessage[];
}

interface MessageMatch {
  message_index: number;
  spans: TextSpan[];
  score: number;
  match_kind: 'exact' | 'fuzzy';
}

let cachedSessions: SearchableSession[] | null = null;

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

async function parseSearchableSession(filePath: string): Promise<SearchableSession | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const messages: SessionMessage[] = [];
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

      if (record.type !== 'user' && record.type !== 'assistant') {
        continue;
      }

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

      messages.push({ role, text });
      if (role === 'user') {
        lastUserMessage = text;
      }
    }

    const stat = await fs.stat(filePath);
    return {
      session_id: path.basename(filePath, '.jsonl'),
      cwd: cwd || '(unknown cwd)',
      updated_at: stat.mtimeMs,
      last_user_message: lastUserMessage || '(no user message)',
      file_path: filePath,
      messages,
    };
  } catch {
    return null;
  }
}

async function loadSearchableSessions(): Promise<SearchableSession[]> {
  if (cachedSessions) {
    return cachedSessions;
  }

  const root = path.join(os.homedir(), '.claude', 'projects');
  const files = await findJsonlFiles(root);
  const sessions = await Promise.all(files.map(parseSearchableSession));
  cachedSessions = sessions
    .filter((session): session is SearchableSession => session !== null)
    .sort((a, b) => b.updated_at - a.updated_at);
  return cachedSessions;
}

function normalizeForFuzzy(text: string): [string, number[]] {
  const normalizedChars: string[] = [];
  const indexMap: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const lower = text[i].toLowerCase();
    if (/^[a-z0-9]$/i.test(lower)) {
      normalizedChars.push(lower);
      indexMap.push(i);
    }
  }
  return [normalizedChars.join(''), indexMap];
}

function findExactSpans(text: string, query: string): TextSpan[] {
  if (!query.trim()) {
    return [];
  }
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  const spans: TextSpan[] = [];
  let pos = 0;
  while (pos < text.length) {
    const index = textLower.indexOf(queryLower, pos);
    if (index === -1) {
      break;
    }
    spans.push([index, index + query.length]);
    pos = index + query.length;
  }
  return spans;
}

function findFuzzySpans(text: string, query: string): { spans: TextSpan[]; score: number } | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }

  const [normalizedText, indexMap] = normalizeForFuzzy(text);
  const [normalizedQuery] = normalizeForFuzzy(trimmed);
  if (!normalizedQuery) {
    return null;
  }

  const positions: number[] = [];
  let searchPos = 0;
  for (const ch of normalizedQuery) {
    const idx = normalizedText.indexOf(ch, searchPos);
    if (idx === -1) {
      return null;
    }
    positions.push(idx);
    searchPos = idx + 1;
  }

  const originalPositions = positions.map((pos) => indexMap[pos]);
  if (!originalPositions.length) {
    return null;
  }

  const spans: TextSpan[] = [];
  let start = originalPositions[0];
  let prev = originalPositions[0];
  for (const pos of originalPositions.slice(1)) {
    if (pos === prev + 1) {
      prev = pos;
      continue;
    }
    spans.push([start, prev + 1]);
    start = pos;
    prev = pos;
  }
  spans.push([start, prev + 1]);

  const gapPenalty = originalPositions[originalPositions.length - 1] - originalPositions[0] - originalPositions.length + 1;
  const segmentPenalty = spans.length - 1;
  const score = gapPenalty * 4 + segmentPenalty * 12 + originalPositions[0];
  return { spans, score };
}

function buildMessageMatches(session: SearchableSession, query: string, fuzzyEnabled: boolean): MessageMatch[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const exactMatches: MessageMatch[] = [];
  const fuzzyMatches: MessageMatch[] = [];

  session.messages.forEach((message, index) => {
    const exactSpans = findExactSpans(message.text, trimmed);
    if (exactSpans.length) {
      const fieldBonus = message.role === 'user' ? 0 : 1;
      exactMatches.push({
        message_index: index,
        spans: exactSpans,
        score: fieldBonus * 1000 + index,
        match_kind: 'exact',
      });
      return;
    }

    if (!fuzzyEnabled) {
      return;
    }

    const fuzzy = findFuzzySpans(message.text, trimmed);
    if (fuzzy) {
      const fieldBonus = message.role === 'user' ? 0 : 1;
      fuzzyMatches.push({
        message_index: index,
        spans: fuzzy.spans,
        score: fieldBonus * 1000 + fuzzy.score + index,
        match_kind: 'fuzzy',
      });
    }
  });

  return [...exactMatches, ...fuzzyMatches];
}

function previewIndexesAround(index: number, total: number, radius = 2): number[] {
  const start = Math.max(0, index - radius);
  const end = Math.min(total, index + radius + 1);
  return Array.from({ length: end - start }, (_, i) => start + i);
}

function tokenizePatterns(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function matchesCwdFilters(cwd: string, includeCwd: string, excludeCwd: string): boolean {
  const cwdLower = cwd.toLowerCase();
  const includePatterns = tokenizePatterns(includeCwd);
  const excludePatterns = tokenizePatterns(excludeCwd);

  if (includePatterns.length && !includePatterns.some((pattern) => cwdLower.includes(pattern))) {
    return false;
  }

  if (excludePatterns.some((pattern) => cwdLower.includes(pattern))) {
    return false;
  }

  return true;
}

export async function searchSessions(options: SearchOptions): Promise<SearchResult[]> {
  const trimmed = options.query.trim();
  if (!trimmed) {
    return [];
  }

  const sessions = await loadSearchableSessions();
  const filteredSessions = sessions.filter((session) => matchesCwdFilters(session.cwd, options.includeCwd, options.excludeCwd));
  const results: Array<{ result: SearchResult; score: [number, number, number] }> = [];

  for (const session of filteredSessions) {
    const lastUserSpans = findExactSpans(session.last_user_message, trimmed);
    const cwdSpans = findExactSpans(session.cwd, trimmed);
    const messageMatches = buildMessageMatches(session, trimmed, options.fuzzy);
    const exactMessageMatches = messageMatches.filter((match) => match.match_kind === 'exact');
    const fuzzyMessageMatches = messageMatches.filter((match) => match.match_kind === 'fuzzy');
    const fuzzyLast = options.fuzzy ? findFuzzySpans(session.last_user_message, trimmed) : null;
    const fuzzyCwd = options.fuzzy ? findFuzzySpans(session.cwd, trimmed) : null;

    // Collect all message matches
    const allMessageMatches: Record<string, TextSpan[]> = {};
    for (const match of messageMatches) {
      allMessageMatches[String(match.message_index)] = match.spans;
    }
    const matchedIndexes = Object.keys(allMessageMatches)
      .map((value) => Number(value))
      .sort((a, b) => a - b);

    const previewSet = new Set<number>();
    matchedIndexes.forEach((index) => {
      previewIndexesAround(index, session.messages.length).forEach((previewIndex) => {
        previewSet.add(previewIndex);
      });
    });

    // Determine best match type for scoring
    let matchKind: 'exact' | 'fuzzy' = 'fuzzy';
    let matchedField: 'last_user' | 'message' | 'cwd' = 'cwd';
    let scoreValue = 999999;

    if (lastUserSpans.length) {
      matchKind = 'exact';
      matchedField = 'last_user';
      scoreValue = 0;
    } else if (exactMessageMatches.length) {
      matchKind = 'exact';
      matchedField = 'message';
      scoreValue = 1;
    } else if (cwdSpans.length) {
      matchKind = 'exact';
      matchedField = 'cwd';
      scoreValue = 2;
    } else if (fuzzyLast) {
      matchKind = 'fuzzy';
      matchedField = 'last_user';
      scoreValue = fuzzyLast.score;
    } else if (fuzzyMessageMatches.length) {
      matchKind = 'fuzzy';
      matchedField = 'message';
      const best = fuzzyMessageMatches.reduce((a, b) => (a.score < b.score ? a : b));
      scoreValue = best.score;
    } else if (fuzzyCwd) {
      matchKind = 'fuzzy';
      matchedField = 'cwd';
      scoreValue = fuzzyCwd.score;
    } else {
      continue;
    }

    results.push({
      result: {
        session,
        match_kind: matchKind,
        matched_field: matchedField,
        preview_message_indexes: Array.from(previewSet).sort((a, b) => a - b),
        message_matches: allMessageMatches,
        cwd_spans: cwdSpans.length ? cwdSpans : (fuzzyCwd?.spans || []),
        last_user_spans: lastUserSpans.length ? lastUserSpans : (fuzzyLast?.spans || []),
        match_count: Object.keys(allMessageMatches).length + (cwdSpans.length || fuzzyCwd ? 1 : 0) + (lastUserSpans.length || fuzzyLast ? 1 : 0),
      },
      score: [matchKind === 'exact' ? 0 : 1, scoreValue, -session.updated_at],
    });
  }

  return results.sort((a, b) => {
    if (a.score[0] !== b.score[0]) {
      return a.score[0] - b.score[0];
    }
    if (a.score[1] !== b.score[1]) {
      return a.score[1] - b.score[1];
    }
    return a.score[2] - b.score[2];
  }).map((entry) => entry.result);
}
