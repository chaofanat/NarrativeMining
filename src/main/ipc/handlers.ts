import { ipcMain, app } from 'electron';
import { channels } from './channels';
import { WindowManager } from '../window/WindowManager';
import { checkForUpdates, downloadUpdate, installUpdate } from '../updater';
import { SyncService } from '../services/SyncService';
import { RawMessageService } from '../services/RawMessageService';
import { NarrativeService } from '../services/NarrativeService';
import { ApiClient } from '../services/ApiClient';
import { EmbeddingService } from '../services/EmbeddingService';
import { VectorService } from '../services/VectorService';
import { ClusteringService } from '../services/ClusteringService';
import { clearAllData, getDatabase, ensureVecDimensions } from '../database';
import type { AppStore } from '../store';
import type { Logger } from 'electron-log';
import type {
  CreateWindowOptions,
  RawQueryOptions,
  NarrativeQueryOptions,
  EmbeddingProviderConfig,
  VectorSearchOptions,
  ClusterOptions,
} from '../../shared/types';

export function setupIPC(
  windowManager: WindowManager,
  store: AppStore,
  logger: Logger,
  syncService: SyncService,
  rawService: RawMessageService,
  narrativeService: NarrativeService,
  apiClient: ApiClient,
  embeddingService: EmbeddingService,
  vectorService: VectorService,
  clusteringService: ClusteringService,
): void {
  // 应用信息
  ipcMain.handle(channels.app.getVersion, () => {
    return app.getVersion();
  });

  ipcMain.handle(channels.app.getName, () => {
    return app.getName();
  });

  ipcMain.handle(channels.app.getPath, (_, name: string) => {
    return app.getPath(name as any);
  });

  // 窗口操作
  ipcMain.handle(channels.window.minimize, () => {
    windowManager.getMainWindow()?.minimize();
  });

  ipcMain.handle(channels.window.maximize, () => {
    windowManager.getMainWindow()?.maximize();
  });

  ipcMain.handle(channels.window.close, () => {
    windowManager.getMainWindow()?.close();
  });

  ipcMain.handle(channels.window.isMaximized, () => {
    return windowManager.getMainWindow()?.isMaximized() || false;
  });

  ipcMain.handle(channels.window.create, (_, options: CreateWindowOptions) => {
    windowManager.createChildWindow(options);
  });

  ipcMain.handle(channels.window.destroy, (_, windowId: number) => {
    return windowManager.destroyChildWindow(windowId);
  });

  ipcMain.handle(channels.window.list, () => {
    return windowManager.getWindowList();
  });

  // 数据存储
  ipcMain.handle(channels.store.get, (_, key: string) => {
    return store.get(key);
  });

  ipcMain.handle(channels.store.set, (_, key: string, value: unknown) => {
    store.set(key, value);
  });

  ipcMain.handle(channels.store.delete, (_, key: string) => {
    store.delete(key);
  });

  // 日志
  ipcMain.handle(channels.log.info, (_, message: string) => {
    logger.info(message);
  });

  ipcMain.handle(channels.log.warn, (_, message: string) => {
    logger.warn(message);
  });

  ipcMain.handle(channels.log.error, (_, message: string) => {
    logger.error(message);
  });

  // 自动更新
  ipcMain.handle(channels.updater.check, () => {
    checkForUpdates();
  });

  ipcMain.handle(channels.updater.download, () => {
    downloadUpdate();
  });

  ipcMain.handle(channels.updater.install, () => {
    installUpdate();
  });

  // 数据同步
  ipcMain.handle(channels.sync.start, async () => {
    return syncService.startSync();
  });

  ipcMain.handle(channels.sync.status, () => {
    return syncService.getSyncState();
  });

  ipcMain.handle(channels.sync.cancel, () => {
    syncService.cancelSync();
  });

  ipcMain.handle(channels.sync.restartTimer, () => {
    syncService.restartAutoSync();
  });

  // 原始数据
  ipcMain.handle(channels.raw.list, (_, options?: RawQueryOptions) => {
    return rawService.list(options || {});
  });

  ipcMain.handle(channels.raw.get, (_, id: number) => {
    return rawService.getById(id);
  });

  ipcMain.handle(channels.raw.count, () => {
    return rawService.count();
  });

  // 叙事数据
  ipcMain.handle(channels.narrative.list, (_, options?: NarrativeQueryOptions) => {
    return narrativeService.list(options || {});
  });

  ipcMain.handle(channels.narrative.get, (_, narrativeId: string) => {
    return narrativeService.getByNarrativeId(narrativeId);
  });

  ipcMain.handle(channels.narrative.byRawId, (_, rawId: number) => {
    return narrativeService.getByRawId(rawId);
  });

  ipcMain.handle(channels.narrative.count, () => {
    return narrativeService.count();
  });

  // 远程 API
  ipcMain.handle(channels.remote.stats, async () => {
    return apiClient.getStats();
  });

  ipcMain.handle(channels.remote.health, async () => {
    return apiClient.healthCheck();
  });

  // 数据库操作
  ipcMain.handle(channels.db.clearAll, () => {
    clearAllData(getDatabase());
    logger.info('数据库已清空');
  });

  // 向量嵌入
  ipcMain.handle(channels.embedding.status, () => {
    return embeddingService.getStatus();
  });

  ipcMain.handle(channels.embedding.start, async () => {
    await embeddingService.startEmbedding();
  });

  ipcMain.handle(channels.embedding.cancel, () => {
    embeddingService.cancelEmbedding();
  });

  ipcMain.handle(channels.embedding.getConfig, () => {
    return embeddingService.getConfigValue();
  });

  ipcMain.handle(channels.embedding.saveConfig, (_, config: EmbeddingProviderConfig) => {
    store.set('app.settings.embeddingProvider', config.provider);
    store.set('app.settings.embeddingApiEndpoint', config.apiEndpoint);
    store.set('app.settings.embeddingApiKey', config.apiKey);
    store.set('app.settings.embeddingModel', config.model);
    store.set('app.settings.embeddingDimensions', config.dimensions);
    store.set('app.settings.embeddingBatchSize', config.batchSize);
    if (ensureVecDimensions(getDatabase(), config.dimensions)) {
      logger.info(`向量维度变更为 ${config.dimensions}，vec 表已重建`);
    }
  });

  // 向量搜索
  ipcMain.handle(channels.vector.search, async (_, options: VectorSearchOptions) => {
    return vectorService.search(options);
  });

  // 聚类分析
  ipcMain.handle(channels.clustering.run, async (_, options: ClusterOptions) => {
    return clusteringService.runClustering(options);
  });

  ipcMain.handle(channels.clustering.details, (_, _clusterId: number, narrativeIds: number[]) => {
    return clusteringService.getClusterDetails(narrativeIds);
  });

  logger.info('IPC 处理器已注册');
}
