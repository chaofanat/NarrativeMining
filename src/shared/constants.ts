// 应用常量定义

export const APP_NAME = 'Electron Vue App';
export const APP_VERSION = '1.0.0';

// 窗口默认配置
export const WINDOW_DEFAULTS = {
  MAIN: {
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
  },
  CHILD: {
    width: 600,
    height: 400,
    minWidth: 400,
    minHeight: 300,
  },
};

// IPC 频道名称
export const IPC_CHANNELS = {
  // 应用
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_NAME: 'app:getName',
  APP_GET_PATH: 'app:getPath',

  // 窗口
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
  WINDOW_CREATE: 'window:create',
  WINDOW_DESTROY: 'window:destroy',
  WINDOW_LIST: 'window:list',

  // 存储
  STORE_GET: 'store:get',
  STORE_SET: 'store:set',
  STORE_DELETE: 'store:delete',

  // 日志
  LOG_INFO: 'log:info',
  LOG_WARN: 'log:warn',
  LOG_ERROR: 'log:error',

  // 更新
  UPDATER_CHECK: 'updater:check',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',
  UPDATER_UPDATE_AVAILABLE: 'updater:update-available',
  UPDATER_UPDATE_PROGRESS: 'updater:update-progress',
  UPDATER_UPDATE_DOWNLOADED: 'updater:update-downloaded',

  // 数据同步
  SYNC_START: 'sync:start',
  SYNC_STATUS: 'sync:status',
  SYNC_CANCEL: 'sync:cancel',
  SYNC_PROGRESS: 'sync:progress',
  SYNC_RESTART_TIMER: 'sync:restartTimer',

  // 原始数据
  RAW_LIST: 'raw:list',
  RAW_GET: 'raw:get',
  RAW_COUNT: 'raw:count',

  // 叙事数据
  NARRATIVE_LIST: 'narrative:list',
  NARRATIVE_GET: 'narrative:get',
  NARRATIVE_BY_RAW_ID: 'narrative:byRawId',
  NARRATIVE_COUNT: 'narrative:count',

  // 远程 API
  REMOTE_STATS: 'remote:stats',
  REMOTE_HEALTH: 'remote:health',

  // 数据库操作
  DB_CLEAR_ALL: 'db:clearAll',

  // 向量嵌入
  EMBEDDING_STATUS: 'embedding:status',
  EMBEDDING_START: 'embedding:start',
  EMBEDDING_CANCEL: 'embedding:cancel',
  EMBEDDING_PROGRESS: 'embedding:progress',
  EMBEDDING_GET_CONFIG: 'embedding:getConfig',
  EMBEDDING_SAVE_CONFIG: 'embedding:saveConfig',

  // 向量搜索
  VECTOR_SEARCH: 'vector:search',

  // 聚类分析
  CLUSTERING_RUN: 'clustering:run',
  CLUSTERING_DETAILS: 'clustering:details',
} as const;

// 存储键名
export const STORE_KEYS = {
  WINDOW_BOUNDS: 'window.bounds',
  WINDOW_MAXIMIZED: 'window.maximized',
  USER_PREFERENCES: 'user.preferences',
  APP_SETTINGS: 'app.settings',
} as const;
