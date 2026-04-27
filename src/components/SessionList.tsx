import React from 'react';
import type { SearchResult, Session } from '../types';
import { highlightText } from '../utils/highlightText';

interface SessionListProps {
  sessions: Session[];
  results?: SearchResult[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

function formatRelativeTime(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function SessionList({ sessions, results = [], selectedIndex, onSelect }: SessionListProps) {
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {sessions.map((session, index) => {
        const selected = index === selectedIndex;
        const result = results[index] ?? null;
        const cwdNode = result?.cwd_spans?.length
          ? highlightText(session.cwd, result.cwd_spans)
          : session.cwd;
        const lastUserText = singleLine(session.last_user_message).slice(0, 80);
        const lastUserNode = result?.last_user_spans?.length
          ? highlightText(lastUserText, result.last_user_spans)
          : lastUserText;

        return (
          <button
            key={session.session_id}
            onClick={() => onSelect(index)}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: selected ? '#eff6ff' : 'transparent',
              color: '#111827',
              padding: '12px 14px',
              cursor: 'pointer',
              borderBottom: '1px solid #e5e7eb',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {formatRelativeTime(session.updated_at)}
              </div>
              {result ? (
                <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {result.match_kind} · {result.matched_field} · {result.match_count}
                </div>
              ) : null}
            </div>
            <div style={{ fontWeight: 600, marginBottom: 6, wordBreak: 'break-all' }}>
              {cwdNode}
            </div>
            <div style={{ fontSize: 13, color: '#374151' }}>
              {lastUserNode}
            </div>
          </button>
        );
      })}
    </div>
  );
}
