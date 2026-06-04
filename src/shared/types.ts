// IPC 通信类型定义

// ============================================================
// 远程 API 响应类型
// ============================================================

export interface RemoteStats {
  raw_count: number;
  narrative_count: number;
  avg_sentiment: number;
  avg_intensity: number;
  distribution: Record<string, Record<string, number>>;
}

export interface RemoteStock {
  code: string;
  name: string;
  change: string;
}

export interface RemoteRawItem {
  id: number;
  level: string;
  time: string;
  title: string;
  brief: string;
  content: string;
  stocks: RemoteStock[];
  subjects: string[];
  received_at: number;
}

export interface RemoteRawListResponse {
  total: number;
  items: RemoteRawItem[];
}

export interface RemoteActor {
  name: string;
  role: string;
}

export interface RemoteCausalLink {
  cause: string;
  effect: string;
  confidence: string;
}

export interface RemoteRiskBenefit {
  direction: string;
  description: string;
  targets: string[];
}

export interface RemoteAffectedTarget {
  name: string;
  target_type: string;
  impact: string;
}

export interface RemoteNarrativeLink {
  related_event: string;
  link_type: string;
}

export interface RemoteNarrativeItem {
  id: number;
  raw_id: number;
  narrative_id: string;
  publish_time: string;
  source: string;
  text_type: string;
  main_subject: string;
  core_story: string;
  actor_list: RemoteActor[];
  action_behavior: string;
  scene_context: string;
  narrative_mode: string;
  narrative_trend: string;
  narrative_firmness: string;
  keyword_core: string[];
  direct_causal_chain: RemoteCausalLink[];
  potential_risk_benefit: RemoteRiskBenefit[];
  sentiment_score: number;
  narrative_intensity: number;
  affected_targets: RemoteAffectedTarget[];
  narrative_link: RemoteNarrativeLink[];
  extracted_at: number;
  model_version: string;
  retry_count: number;
}

export interface RemoteNarrativeListResponse {
  total: number;
  items: RemoteNarrativeItem[];
}

// ============================================================
// 本地数据库行类型
// ============================================================

export interface RawMessageRow {
  id: number;
  level: string | null;
  time: string | null;
  title: string;
  brief: string | null;
  content: string | null;
  stocks: RemoteStock[];
  subjects: string[];
  received_at: string | null;
  synced_at: string;
}

export interface NarrativeRow {
  id: number;
  narrative_id: string;
  raw_id: number | null;
  publish_time: string | null;
  source: string | null;
  text_type: string | null;
  main_subject: string | null;
  core_story: string | null;
  actor_list: RemoteActor[];
  action_behavior: string | null;
  scene_context: string | null;
  narrative_mode: string | null;
  narrative_trend: string | null;
  narrative_firmness: string | null;
  keyword_core: string[];
  direct_causal_chain: RemoteCausalLink[];
  potential_risk_benefit: RemoteRiskBenefit[];
  sentiment_score: number | null;
  narrative_intensity: number | null;
  affected_targets: RemoteAffectedTarget[];
  narrative_link: RemoteNarrativeLink[];
  extracted_at: string | null;
  model_version: string | null;
  retry_count: number;
  synced_at: string;
}

// ============================================================
// 同步类型
// ============================================================

export interface SyncState {
  lastSyncTime: string | null;
  rawCount: number;
  narrativeCount: number;
  isSyncing: boolean;
}

export interface SyncProgress {
  phase: 'raw' | 'narrative' | 'done' | 'error';
  fetched: number;
  total: number;
  message: string;
}

// ============================================================
// 查询/过滤类型
// ============================================================

export interface RawQueryOptions {
  limit?: number;
  offset?: number;
  level?: string;
  search?: string;
}

export interface NarrativeQueryOptions {
  limit?: number;
  offset?: number;
  text_type?: string;
  narrative_mode?: string;
  narrative_trend?: string;
  narrative_firmness?: string;
  sentiment_min?: number;
  sentiment_max?: number;
  intensity_min?: number;
  intensity_max?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  total: number;
  items: T[];
}

// ============================================================
// IPC 通道类型定义
// ============================================================

export interface IPCChannels {
  // 应用信息
  'app:getVersion': () => string;
  'app:getName': () => string;
  'app:getPath': (name: string) => string;

  // 窗口操作
  'window:minimize': () => void;
  'window:maximize': () => void;
  'window:close': () => void;
  'window:isMaximized': () => boolean;

  // 数据存储
  'store:get': (key: string) => unknown;
  'store:set': (key: string, value: unknown) => void;
  'store:delete': (key: string) => void;

  // 日志
  'log:info': (message: string) => void;
  'log:warn': (message: string) => void;
  'log:error': (message: string) => void;

  // 更新
  'updater:check': () => void;
  'updater:download': () => void;
  'updater:install': () => void;

  // 多窗口
  'window:create': (options: CreateWindowOptions) => void;
  'window:destroy': (windowId: number) => void;
  'window:list': () => WindowInfo[];

  // 数据同步
  'sync:start': () => SyncState;
  'sync:status': () => SyncState;
  'sync:cancel': () => void;

  // 原始数据
  'raw:list': (options?: RawQueryOptions) => PaginatedResult<RawMessageRow>;
  'raw:get': (id: number) => RawMessageRow | null;
  'raw:count': () => number;

  // 叙事数据
  'narrative:list': (options?: NarrativeQueryOptions) => PaginatedResult<NarrativeRow>;
  'narrative:get': (narrativeId: string) => NarrativeRow | null;
  'narrative:byRawId': (rawId: number) => NarrativeRow | null;
  'narrative:count': () => number;

  // 远程 API
  'remote:stats': () => RemoteStats;
  'remote:health': () => { status: string };
}

export interface CreateWindowOptions {
  name: string;
  url?: string;
  width?: number;
  height?: number;
  title?: string;
  modal?: boolean;
  parent?: number;
}

export interface WindowInfo {
  id: number;
  name: string;
  title: string;
  isVisible: boolean;
}

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

// 预加载脚本暴露的 API 类型
export interface ElectronAPI {
  app: {
    getVersion: () => Promise<string>;
    getName: () => Promise<string>;
    getPath: (name: string) => Promise<string>;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    create: (options: CreateWindowOptions) => Promise<void>;
    destroy: (windowId: number) => Promise<void>;
    list: () => Promise<WindowInfo[]>;
  };
  store: {
    get: <T = unknown>(key: string) => Promise<T | undefined>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  log: {
    info: (message: string) => Promise<void>;
    warn: (message: string) => Promise<void>;
    error: (message: string) => Promise<void>;
  };
  updater: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void;
    onUpdateProgress: (callback: (progress: UpdateProgress) => void) => () => void;
    onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => () => void;
  };
  data: {
    // 同步操作
    startSync: () => Promise<SyncState>;
    getSyncStatus: () => Promise<SyncState>;
    cancelSync: () => Promise<void>;
    restartAutoSync: () => Promise<void>;
    onSyncProgress: (callback: (progress: SyncProgress) => void) => () => void;
    // 原始数据
    listRaw: (options?: RawQueryOptions) => Promise<PaginatedResult<RawMessageRow>>;
    getRaw: (id: number) => Promise<RawMessageRow | null>;
    getRawCount: () => Promise<number>;
    // 叙事数据
    listNarratives: (options?: NarrativeQueryOptions) => Promise<PaginatedResult<NarrativeRow>>;
    getNarrative: (narrativeId: string) => Promise<NarrativeRow | null>;
    getNarrativeByRawId: (rawId: number) => Promise<NarrativeRow | null>;
    getNarrativeCount: () => Promise<number>;
    // 远程
    getRemoteStats: () => Promise<RemoteStats>;
    checkRemoteHealth: () => Promise<{ status: string }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
