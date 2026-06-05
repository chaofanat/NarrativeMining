import { IPC_CHANNELS } from '../../shared/constants';

// IPC 频道定义
export const channels = {
  // 应用信息
  app: {
    getVersion: IPC_CHANNELS.APP_GET_VERSION,
    getName: IPC_CHANNELS.APP_GET_NAME,
    getPath: IPC_CHANNELS.APP_GET_PATH,
  },
  // 窗口操作
  window: {
    minimize: IPC_CHANNELS.WINDOW_MINIMIZE,
    maximize: IPC_CHANNELS.WINDOW_MAXIMIZE,
    close: IPC_CHANNELS.WINDOW_CLOSE,
    isMaximized: IPC_CHANNELS.WINDOW_IS_MAXIMIZED,
    create: IPC_CHANNELS.WINDOW_CREATE,
    destroy: IPC_CHANNELS.WINDOW_DESTROY,
    list: IPC_CHANNELS.WINDOW_LIST,
  },
  // 数据存储
  store: {
    get: IPC_CHANNELS.STORE_GET,
    set: IPC_CHANNELS.STORE_SET,
    delete: IPC_CHANNELS.STORE_DELETE,
  },
  // 日志
  log: {
    info: IPC_CHANNELS.LOG_INFO,
    warn: IPC_CHANNELS.LOG_WARN,
    error: IPC_CHANNELS.LOG_ERROR,
  },
  // 更新
  updater: {
    check: IPC_CHANNELS.UPDATER_CHECK,
    download: IPC_CHANNELS.UPDATER_DOWNLOAD,
    install: IPC_CHANNELS.UPDATER_INSTALL,
    updateAvailable: IPC_CHANNELS.UPDATER_UPDATE_AVAILABLE,
    updateProgress: IPC_CHANNELS.UPDATER_UPDATE_PROGRESS,
    updateDownloaded: IPC_CHANNELS.UPDATER_UPDATE_DOWNLOADED,
  },
  // 数据同步
  sync: {
    start: IPC_CHANNELS.SYNC_START,
    status: IPC_CHANNELS.SYNC_STATUS,
    cancel: IPC_CHANNELS.SYNC_CANCEL,
    restartTimer: IPC_CHANNELS.SYNC_RESTART_TIMER,
  },
  // 原始数据
  raw: {
    list: IPC_CHANNELS.RAW_LIST,
    get: IPC_CHANNELS.RAW_GET,
    count: IPC_CHANNELS.RAW_COUNT,
  },
  // 叙事数据
  narrative: {
    list: IPC_CHANNELS.NARRATIVE_LIST,
    get: IPC_CHANNELS.NARRATIVE_GET,
    byRawId: IPC_CHANNELS.NARRATIVE_BY_RAW_ID,
    count: IPC_CHANNELS.NARRATIVE_COUNT,
  },
  // 远程 API
  remote: {
    stats: IPC_CHANNELS.REMOTE_STATS,
    health: IPC_CHANNELS.REMOTE_HEALTH,
  },
  // 数据库操作
  db: {
    clearAll: IPC_CHANNELS.DB_CLEAR_ALL,
  },
} as const;
