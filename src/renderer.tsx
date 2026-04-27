import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConversationPreview } from './components/ConversationPreview';
import { SessionList } from './components/SessionList';
import type { SearchOptions, SearchResult, Session, SessionDetail } from './types';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [draftQuery, setDraftQuery] = useState('');
  const [submittedOptions, setSubmittedOptions] = useState<SearchOptions>({
    query: '',
    fuzzy: true,
    includeCwd: '',
    excludeCwd: '',
  });
  const [fuzzyEnabled, setFuzzyEnabled] = useState(true);
  const [includeCwd, setIncludeCwd] = useState('');
  const [excludeCwd, setExcludeCwd] = useState('');
  const [showCwdFilters, setShowCwdFilters] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [leftWidth, setLeftWidth] = useState(420);
  const [isDragging, setIsDragging] = useState(false);
  const [detail, setDetail] = useState<SessionDetail | null>(null);

  useEffect(() => {
    void window.api.loadSessions().then((loaded) => {
      setSessions(loaded);
      setSelectedIndex(0);
    });
  }, []);

  useEffect(() => {
    const trimmed = submittedOptions.query.trim();
    if (!trimmed) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    void window.api.searchSessions(submittedOptions).then((loaded) => {
      setResults(loaded);
      setSelectedIndex(0);
    });
  }, [submittedOptions]);

  const visibleSessions = useMemo(
    () => (submittedOptions.query.trim() ? results.map((result) => result.session) : sessions),
    [submittedOptions.query, results, sessions]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!visibleSessions.length) {
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, visibleSessions.length - 1));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [visibleSessions]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      setLeftWidth(Math.max(280, Math.min(e.clientX, 800)));
    };

    const onMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!submittedOptions.query.trim()) {
      return;
    }
    submitSearch();
  }, [fuzzyEnabled, includeCwd, excludeCwd]);

  const selected = visibleSessions[selectedIndex] ?? null;
  const selectedResult = submittedOptions.query.trim() ? results[selectedIndex] ?? null : null;

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }

    void window.api.loadSessionDetail(selected.file_path).then((loaded) => {
      setDetail(loaded);
    });
  }, [selected]);

  const resumeCommand = useMemo(() => {
    if (!selected) {
      return '';
    }
    return `cd ${JSON.stringify(selected.cwd)} && claude --resume ${selected.session_id}`;
  }, [selected]);

  const handleCopyResume = async () => {
    if (!resumeCommand) {
      return false;
    }
    return await window.api.copyText(resumeCommand);
  };

  const submitSearch = (overrides?: Partial<SearchOptions>) => {
    setSubmittedOptions({
      query: draftQuery,
      fuzzy: fuzzyEnabled,
      includeCwd,
      excludeCwd,
      ...overrides,
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      submitSearch();
    }
    if (event.key === 'Escape') {
      setDraftQuery('');
      setSubmittedOptions((current) => ({ ...current, query: '' }));
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#ffffff' }}>
      <div style={{ width: leftWidth, borderRight: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, color: '#111827', marginBottom: 10 }}>
            {submittedOptions.query.trim() ? 'Search Results' : 'Recent Sessions'}
          </div>
          <input
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search conversations... (press Enter)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '10px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              background: '#ffffff',
              color: '#111827',
            }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={fuzzyEnabled}
              onChange={(event) => setFuzzyEnabled(event.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Fuzzy match
          </label>
          <button
            onClick={() => setShowCwdFilters((current) => !current)}
            style={{
              marginTop: 10,
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 0',
              border: 'none',
              background: 'transparent',
              color: '#374151',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <span>Folders to include / exclude</span>
            <span style={{ color: '#6b7280' }}>{showCwdFilters ? '▾' : '▸'}</span>
          </button>
          {showCwdFilters && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input
                value={includeCwd}
                onChange={(event) => setIncludeCwd(event.target.value)}
                placeholder="Include cwd (comma-separated)"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  background: '#ffffff',
                  color: '#111827',
                }}
              />
              <input
                value={excludeCwd}
                onChange={(event) => setExcludeCwd(event.target.value)}
                placeholder="Exclude cwd (comma-separated)"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 10px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 12,
                  outline: 'none',
                  background: '#ffffff',
                  color: '#111827',
                }}
              />
            </div>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <SessionList
            sessions={visibleSessions}
            results={submittedOptions.query.trim() ? results : []}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />
        </div>
      </div>
      <div
        onMouseDown={() => setIsDragging(true)}
        style={{
          width: 4,
          cursor: 'col-resize',
          background: isDragging ? '#3b82f6' : 'transparent',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <ConversationPreview detail={detail} searchResult={selectedResult} onCopyResume={handleCopyResume} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280' }}>
            {submittedOptions.query.trim() ? 'No matches found' : 'No sessions found'}
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
