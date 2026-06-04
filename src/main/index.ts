import { app, BrowserWindow } from 'electron';
import { WindowManager } from './window/WindowManager';
import { setupIPC } from './ipc/handlers';
import { setupTray } from './tray';
import { setupMenu } from './menu';
import { setupLogger } from './logger';
import { setupStore } from './store';
import { setupCrashReporter } from './crash';
import { setupUpdater } from './updater';
import { handleSquirrelEvent } from './squirrel';
import { setupDatabase, closeDatabase, cleanupFtsIfBloated } from './database';
import { ApiClient } from './services/ApiClient';
import { SyncService } from './services/SyncService';
import { RawMessageService } from './services/RawMessageService';
import { NarrativeService } from './services/NarrativeService';

// 处理 Squirrel 安装事件
if (handleSquirrelEvent()) {
  process.exit(0);
}

// 单实例锁
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  // 初始化日志
  const logger = setupLogger();

  // 初始化数据存储
  const store = setupStore();

  // 初始化数据库
  const db = setupDatabase(logger);
  cleanupFtsIfBloated(db);

  // 初始化服务
  const apiClient = new ApiClient();
  const syncService = new SyncService(
    db,
    apiClient,
    logger,
    () => (store.get('app.settings.autoSync') as boolean) ?? true,
    () => (store.get('app.settings.syncIntervalMinutes') as number) ?? 5,
  );
  const rawService = new RawMessageService(db);
  const narrativeService = new NarrativeService(db);

  // 初始化崩溃报告
  setupCrashReporter();

  // 窗口管理器
  let windowManager: WindowManager;

  app.whenReady().then(() => {
    logger.info('应用启动');

    // 创建窗口管理器
    windowManager = new WindowManager(store, logger);

    // 创建主窗口
    const mainWindow = windowManager.createMainWindow();

    // 关闭到托盘设置
    mainWindow.getWindow().on('close', (event) => {
      const closeToTray = store.get('app.settings.closeToTray') as boolean;
      if (closeToTray && !(app as any).isQuitting) {
        event.preventDefault();
        mainWindow.hide();
      }
    });

    // 设置 IPC 通信
    setupIPC(windowManager, store, logger, syncService, rawService, narrativeService, apiClient);

    // 设置应用菜单
    setupMenu(windowManager, logger);

    // 设置系统托盘
    setupTray(windowManager, logger);

    // 设置自动更新
    setupUpdater(windowManager, store, logger);

    // 启动自动同步
    syncService.startAutoSync();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        windowManager.createMainWindow();
      }
    });
  });

  app.on('second-instance', () => {
    // 用户尝试运行第二个实例，聚焦到主窗口
    const mainWindow = windowManager?.getMainWindow();
    if (mainWindow) {
      const win = mainWindow.getWindow();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('before-quit', () => {
    (app as any).isQuitting = true;
    syncService.stopAutoSync();
    closeDatabase();
    logger.info('应用退出');
  });
}
