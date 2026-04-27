import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { SearchResult, SessionDetail, TextSpan } from '../types';
import { findAllTextSpans } from '../utils/findAllTextSpans';
import { highlightText } from '../utils/highlightText';

interface ConversationPreviewProps {
  detail: SessionDetail | null;
  searchResult: SearchResult | null;
  onCopyResume: () => Promise<boolean>;
}

export function ConversationPreview({ detail, searchResult, onCopyResume }: ConversationPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const inContentMarkRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [copied, setCopied] = useState(false);
  const [matchNavIndex, setMatchNavIndex] = useState(0);
  const [inContentSearch, setInContentSearch] = useState('');
  const [inContentNavIndex, setInContentNavIndex] = useState(0);
  const [showInContentBar, setShowInContentBar] = useState(false);

  const matchedMessageIndexes = useMemo(() => {
    if (!searchResult) return [];
    return Object.keys(searchResult.message_matches)
      .map((key) => Number(key))
      .sort((a, b) => a - b);
  }, [searchResult]);

  const inContentMatches = useMemo(() => {
    if (!inContentSearch.trim() || !detail) return [];
    const matches: Array<{ messageIndex: number; spanIndex: number; span: TextSpan; globalIndex: number }> = [];
    let globalIndex = 0;
    detail.messages.forEach((message, messageIndex) => {
      const spans = findAllTextSpans(message.text, inContentSearch);
      spans.forEach((span, spanIndex) => {
        matches.push({ messageIndex, spanIndex, span, globalIndex });
        globalIndex++;
      });
    });
    return matches;
  }, [inContentSearch, detail]);

  useEffect(() => {
    setMatchNavIndex(0);
  }, [searchResult, detail?.session_id]);

  useEffect(() => {
    setInContentNavIndex(0);
  }, [inContentSearch]);

  useEffect(() => {
    setCopied(false);
  }, [detail?.session_id]);

  useEffect(() => {
    setInContentSearch('');
    setInContentNavIndex(0);
    setShowInContentBar(false);
    inContentMarkRefs.current.clear();
  }, [detail?.session_id]);

  useEffect(() => {
    if (matchedMessageIndexes.length && matchNavIndex < matchedMessageIndexes.length) {
      const targetIndex = matchedMessageIndexes[matchNavIndex];
      const targetElement = messageRefs.current.get(targetIndex);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [matchNavIndex, matchedMessageIndexes]);

  useEffect(() => {
    if (inContentMatches.length && inContentNavIndex < inContentMatches.length) {
      const targetMatch = inContentMatches[inContentNavIndex];
      const key = `${targetMatch.messageIndex}-${targetMatch.spanIndex}`;
      const targetElement = inContentMarkRefs.current.get(key);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        const messageElement = messageRefs.current.get(targetMatch.messageIndex);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }, [inContentNavIndex, inContentMatches]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        setShowInContentBar(true);
      }
      if (event.key === 'Escape' && showInContentBar) {
        setShowInContentBar(false);
        setInContentSearch('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showInContentBar]);

  if (!detail) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
        Select a session to preview
      </div>
    );
  }

  const handleCopy = async () => {
    const ok = await onCopyResume();
    if (!ok) {
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <div style={{ fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            {searchResult?.cwd_spans?.length ? highlightText(detail.cwd, searchResult.cwd_spans) : detail.cwd}
          </div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>{detail.session_id}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {matchedMessageIndexes.length > 0 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 8px', background: '#f3f4f6', borderRadius: 4 }}>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                {matchNavIndex + 1} / {matchedMessageIndexes.length}
              </span>
              <button
                onClick={() => setMatchNavIndex((prev) => (prev - 1 + matchedMessageIndexes.length) % matchedMessageIndexes.length)}
                style={{
                  padding: '2px 6px',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ↑
              </button>
              <button
                onClick={() => setMatchNavIndex((prev) => (prev + 1) % matchedMessageIndexes.length)}
                style={{
                  padding: '2px 6px',
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  borderRadius: 3,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ↓
              </button>
            </div>
          )}
          <button
            onClick={() => void handleCopy()}
            style={{
              padding: '6px 12px',
              background: copied ? '#10b981' : '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {copied ? 'Copied' : 'Copy Resume Command'}
          </button>
        </div>
      </div>
      {showInContentBar && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'center', background: '#f9fafb', flexShrink: 0 }}>
          <input
            autoFocus
            value={inContentSearch}
            onChange={(e) => setInContentSearch(e.target.value)}
            placeholder="Find in conversation..."
            style={{
              flex: 1,
              padding: '6px 10px',
              border: '1px solid #d1d5db',
              borderRadius: 4,
              fontSize: 13,
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
            {inContentMatches.length ? `${inContentNavIndex + 1} / ${inContentMatches.length}` : '0 / 0'}
          </span>
          <button
            onClick={() => setInContentNavIndex((prev) => (prev - 1 + Math.max(1, inContentMatches.length)) % Math.max(1, inContentMatches.length))}
            disabled={!inContentMatches.length}
            style={{
              padding: '4px 8px',
              background: inContentMatches.length ? '#ffffff' : '#e5e7eb',
              border: '1px solid #d1d5db',
              borderRadius: 3,
              cursor: inContentMatches.length ? 'pointer' : 'not-allowed',
              fontSize: 11,
            }}
          >
            ↑
          </button>
          <button
            onClick={() => setInContentNavIndex((prev) => (prev + 1) % Math.max(1, inContentMatches.length))}
            disabled={!inContentMatches.length}
            style={{
              padding: '4px 8px',
              background: inContentMatches.length ? '#ffffff' : '#e5e7eb',
              border: '1px solid #d1d5db',
              borderRadius: 3,
              cursor: inContentMatches.length ? 'pointer' : 'not-allowed',
              fontSize: 11,
            }}
          >
            ↓
          </button>
          <button
            onClick={() => {
              setShowInContentBar(false);
              setInContentSearch('');
            }}
            style={{
              padding: '4px 8px',
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {detail.messages.map((message, index) => {
          const isUser = message.role === 'user';
          const searchResultSpans = searchResult?.message_matches?.[String(index)] || [];
          const inContentMatchesForMessage = inContentMatches.filter((match) => match.messageIndex === index);
          const inContentSpans = inContentMatchesForMessage.map((match) => match.span);
          const activeInContentMatch = inContentMatches[inContentNavIndex];
          const activeSpanIndex = activeInContentMatch?.messageIndex === index ? activeInContentMatch.spanIndex : undefined;

          let content: React.ReactNode = message.text;
          if (showInContentBar && inContentSpans.length) {
            content = highlightText(message.text, inContentSpans, 'find', activeSpanIndex, (spanIndex, el) => {
              const key = `${index}-${spanIndex}`;
              if (el) {
                inContentMarkRefs.current.set(key, el);
              } else {
                inContentMarkRefs.current.delete(key);
              }
            });
          } else if (searchResultSpans.length) {
            content = highlightText(message.text, searchResultSpans, 'search');
          }

          return (
            <div
              key={index}
              ref={(el) => {
                if (el) {
                  messageRefs.current.set(index, el);
                } else {
                  messageRefs.current.delete(index);
                }
              }}
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 6,
                border: isUser ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                background: isUser ? '#eff6ff' : '#ffffff',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: isUser ? '#3b82f6' : '#6b7280', marginBottom: 8, textTransform: 'uppercase' }}>
                {message.role}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', color: '#111827', lineHeight: 1.6 }}>
                {content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
