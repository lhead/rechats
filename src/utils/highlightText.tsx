import React from 'react';
import type { TextSpan } from '../types';

export function highlightText(
  text: string,
  spans: TextSpan[],
  color: 'search' | 'find' = 'search',
  activeIndex?: number,
  onMarkRef?: (index: number, el: HTMLElement | null) => void
): React.ReactNode {
  if (!spans.length) {
    return text;
  }

  const merged: TextSpan[] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    if (!merged.length || start > merged[merged.length - 1][1]) {
      merged.push([start, end]);
    } else {
      merged[merged.length - 1] = [merged[merged.length - 1][0], Math.max(merged[merged.length - 1][1], end)];
    }
  }

  const bgColor = color === 'search' ? '#fef08a' : '#a7f3d0';
  const activeBgColor = color === 'search' ? '#fbbf24' : '#34d399';

  const parts: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach(([start, end], index) => {
    if (pos < start) {
      parts.push(text.slice(pos, start));
    }
    const isActive = activeIndex !== undefined && activeIndex === index;
    parts.push(
      <mark
        key={index}
        ref={(el) => onMarkRef?.(index, el)}
        style={{
          background: isActive ? activeBgColor : bgColor,
          color: '#111827',
          padding: '2px 0',
          fontWeight: isActive ? 700 : 400,
        }}
      >
        {text.slice(start, end)}
      </mark>
    );
    pos = end;
  });
  if (pos < text.length) {
    parts.push(text.slice(pos));
  }

  return <>{parts}</>;
}
