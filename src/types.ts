export type MatchKind = 'exact' | 'fuzzy';
export type MatchedField = 'recent' | 'last_user' | 'message' | 'cwd';
export type TextSpan = [number, number];

export interface SearchOptions {
  query: string;
  fuzzy: boolean;
  includeCwd: string;
  excludeCwd: string;
}

export interface Session {
  session_id: string;
  cwd: string;
  updated_at: number;
  last_user_message: string;
  file_path: string;
}

export interface SessionMessage {
  role: 'user' | 'assistant';
  text: string;
}

export interface SessionDetail {
  session_id: string;
  cwd: string;
  updated_at: number;
  file_path: string;
  messages: SessionMessage[];
}

export interface SearchResult {
  session: Session;
  match_kind: MatchKind;
  matched_field: MatchedField;
  preview_message_indexes: number[];
  message_matches: Record<string, TextSpan[]>;
  cwd_spans: TextSpan[];
  last_user_spans: TextSpan[];
  match_count: number;
}
