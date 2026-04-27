import { contextBridge, ipcRenderer } from 'electron';
import type { SearchOptions, SearchResult, Session, SessionDetail } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  loadSessions: (): Promise<Session[]> => ipcRenderer.invoke('load-sessions'),
  loadSessionDetail: (filePath: string): Promise<SessionDetail | null> =>
    ipcRenderer.invoke('load-session-detail', filePath),
  searchSessions: (options: SearchOptions): Promise<SearchResult[]> =>
    ipcRenderer.invoke('search-sessions', options),
  copyText: (text: string): Promise<boolean> => ipcRenderer.invoke('copy-text', text),
});

declare global {
  interface Window {
    api: {
      loadSessions: () => Promise<Session[]>;
      loadSessionDetail: (filePath: string) => Promise<SessionDetail | null>;
      searchSessions: (options: SearchOptions) => Promise<SearchResult[]>;
      copyText: (text: string) => Promise<boolean>;
    };
  }
}
