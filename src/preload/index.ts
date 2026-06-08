import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type {
  ElectronAPI,
  CreateWindowOptions,
  UpdateInfo,
  UpdateProgress,
  SyncProgress,
  SyncState,
  RawQueryOptions,
  NarrativeQueryOptions,
  PaginatedResult,
  RawMessageRow,
  NarrativeRow,
  RemoteStats,
  EmbeddingProviderConfig,
  EmbeddingStatus,
  EmbeddingProgress,
  VectorSearchOptions,
  VectorSearchResult,
  ClusterOptions,
  ClusteringResult,
} from '../shared/types';

const electronAPI: ElectronAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),
    getName: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_NAME),
    getPath: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PATH, name),
  },
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
    create: (options: CreateWindowOptions) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CREATE, options),
    destroy: (windowId: number) => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_DESTROY, windowId),
    list: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_LIST),
  },
  store: {
    get: <T = unknown>(key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORE_GET, key) as Promise<T | undefined>,
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.STORE_SET, key, value),
    delete: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.STORE_DELETE, key),
  },
  log: {
    info: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG_INFO, message),
    warn: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG_WARN, message),
    error: (message: string) => ipcRenderer.invoke(IPC_CHANNELS.LOG_ERROR, message),
  },
  updater: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_CHECK),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_DOWNLOAD),
    install: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATER_INSTALL),
    onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
      const handler = (_: unknown, info: UpdateInfo) => callback(info);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_UPDATE_AVAILABLE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_UPDATE_AVAILABLE, handler);
    },
    onUpdateProgress: (callback: (progress: UpdateProgress) => void) => {
      const handler = (_: unknown, progress: UpdateProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_UPDATE_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_UPDATE_PROGRESS, handler);
    },
    onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
      const handler = (_: unknown, info: UpdateInfo) => callback(info);
      ipcRenderer.on(IPC_CHANNELS.UPDATER_UPDATE_DOWNLOADED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATER_UPDATE_DOWNLOADED, handler);
    },
  },
  data: {
    // 同步操作
    startSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_START) as Promise<SyncState>,
    getSyncStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_STATUS) as Promise<SyncState>,
    cancelSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_CANCEL) as Promise<void>,
    restartAutoSync: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESTART_TIMER) as Promise<void>,
    onSyncProgress: (callback: (progress: SyncProgress) => void) => {
      const handler = (_: unknown, progress: SyncProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.SYNC_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SYNC_PROGRESS, handler);
    },
    // 原始数据
    listRaw: (options?: RawQueryOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.RAW_LIST, options) as Promise<PaginatedResult<RawMessageRow>>,
    getRaw: (id: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.RAW_GET, id) as Promise<RawMessageRow | null>,
    getRawCount: () => ipcRenderer.invoke(IPC_CHANNELS.RAW_COUNT) as Promise<number>,
    // 叙事数据
    listNarratives: (options?: NarrativeQueryOptions) =>
      ipcRenderer.invoke(IPC_CHANNELS.NARRATIVE_LIST, options) as Promise<PaginatedResult<NarrativeRow>>,
    getNarrative: (narrativeId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.NARRATIVE_GET, narrativeId) as Promise<NarrativeRow | null>,
    getNarrativeByRawId: (rawId: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.NARRATIVE_BY_RAW_ID, rawId) as Promise<NarrativeRow | null>,
    getNarrativeCount: () => ipcRenderer.invoke(IPC_CHANNELS.NARRATIVE_COUNT) as Promise<number>,
    // 远程
    getRemoteStats: () => ipcRenderer.invoke(IPC_CHANNELS.REMOTE_STATS) as Promise<RemoteStats>,
    checkRemoteHealth: () => ipcRenderer.invoke(IPC_CHANNELS.REMOTE_HEALTH) as Promise<{ status: string }>,
    // 数据库操作
    clearAllData: () => ipcRenderer.invoke(IPC_CHANNELS.DB_CLEAR_ALL) as Promise<void>,
    // 向量嵌入
    getEmbeddingStatus: () => ipcRenderer.invoke(IPC_CHANNELS.EMBEDDING_STATUS) as Promise<EmbeddingStatus>,
    startEmbedding: () => ipcRenderer.invoke(IPC_CHANNELS.EMBEDDING_START) as Promise<void>,
    cancelEmbedding: () => ipcRenderer.invoke(IPC_CHANNELS.EMBEDDING_CANCEL) as Promise<void>,
    onEmbeddingProgress: (callback: (progress: EmbeddingProgress) => void) => {
      const handler = (_: unknown, progress: EmbeddingProgress) => callback(progress);
      ipcRenderer.on(IPC_CHANNELS.EMBEDDING_PROGRESS, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EMBEDDING_PROGRESS, handler);
    },
    getEmbeddingConfig: () => ipcRenderer.invoke(IPC_CHANNELS.EMBEDDING_GET_CONFIG) as Promise<EmbeddingProviderConfig | null>,
    saveEmbeddingConfig: (config: EmbeddingProviderConfig) => ipcRenderer.invoke(IPC_CHANNELS.EMBEDDING_SAVE_CONFIG, config) as Promise<void>,
    // 向量搜索
    vectorSearch: (options: VectorSearchOptions) => ipcRenderer.invoke(IPC_CHANNELS.VECTOR_SEARCH, options) as Promise<VectorSearchResult[]>,
    // 聚类分析
    runClustering: (options: ClusterOptions) => ipcRenderer.invoke(IPC_CHANNELS.CLUSTERING_RUN, options) as Promise<ClusteringResult>,
    getClusterDetails: (clusterId: number, narrativeIds: number[]) => ipcRenderer.invoke(IPC_CHANNELS.CLUSTERING_DETAILS, clusterId, narrativeIds) as Promise<NarrativeRow[]>,
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
