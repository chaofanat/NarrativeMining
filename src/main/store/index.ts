import Store from 'electron-store';
import { app } from 'electron';

const defaults = {
  window: {
    maximized: false,
  },
  user: {
    preferences: {
      theme: 'system' as const,
      language: 'zh-CN',
      startupBehavior: 'restore' as const,
    },
  },
  app: {
    settings: {
      autoUpdate: true,
      minimizeToTray: true,
      closeToTray: true,
      autoSync: true,
      syncIntervalMinutes: 5,
      embeddingProvider: 'ollama' as const,
      embeddingApiEndpoint: '',
      embeddingApiKey: '',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1024,
      embeddingBatchSize: 20,
      clusterMinClusterSize: 3,
      clusterMinSamples: 2,
      clusterReducedDimensions: 20,
      clusterUmapNNeighbors: 15,
      clusterUmapMinDist: 0.1,
    },
  },
};

export function setupStore(): Store<Record<string, any>> {
  const store = new Store<Record<string, any>>({
    name: 'config',
    cwd: app.getPath('userData'),
    defaults,
  });

  console.log('数据存储已初始化');

  return store;
}

export type AppStore = Store<Record<string, any>>;
