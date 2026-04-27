import type { TextSpan } from '../types';

export function findAllTextSpans(text: string, query: string): TextSpan[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const textLower = text.toLowerCase();
  const queryLower = trimmed.toLowerCase();
  const spans: TextSpan[] = [];
  let pos = 0;
  while (pos < text.length) {
    const index = textLower.indexOf(queryLower, pos);
    if (index === -1) {
      break;
    }
    spans.push([index, index + trimmed.length]);
    pos = index + trimmed.length;
  }
  return spans;
}
