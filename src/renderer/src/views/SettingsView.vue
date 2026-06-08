<template>
  <div class="settings">
    <div class="settings-header">
      <button @click="goBack" class="back-button">← 返回</button>
      <h1>设置</h1>
    </div>

    <div class="settings-content">
      <div class="settings-section">
        <h2>外观</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">主题</span>
            <span class="setting-desc">选择应用主题</span>
          </div>
          <select v-model="settings.theme" @change="saveSettings">
            <option value="light">浅色</option>
            <option value="dark">深色</option>
            <option value="system">跟随系统</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h2>数据同步</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">自动同步</span>
            <span class="setting-desc">启动后自动定时拉取远程数据到本地数据库</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="settings.autoSync" @change="saveSyncSettings" />
            <span class="slider"></span>
          </label>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">同步间隔</span>
            <span class="setting-desc">每隔多少分钟自动同步一次</span>
          </div>
          <select v-model="settings.syncInterval" @change="saveSyncSettings" :disabled="!settings.autoSync">
            <option :value="1">1 分钟</option>
            <option :value="3">3 分钟</option>
            <option :value="5">5 分钟</option>
            <option :value="10">10 分钟</option>
            <option :value="15">15 分钟</option>
            <option :value="30">30 分钟</option>
            <option :value="60">60 分钟</option>
          </select>
        </div>
      </div>

      <div class="settings-section">
        <h2>向量嵌入</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">嵌入服务</span>
            <span class="setting-desc">选择嵌入向量生成服务提供商</span>
          </div>
          <select v-model="embeddingConfig.provider" @change="saveEmbeddingConfig">
            <option value="ollama">Ollama (本地)</option>
            <option value="openai">OpenAI</option>
            <option value="custom">自定义 API</option>
          </select>
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">API 端点</span>
            <span class="setting-desc">{{ embeddingConfig.provider === 'ollama' ? 'Ollama 嵌入接口地址' : embeddingConfig.provider === 'openai' ? '留空使用 OpenAI 默认地址，或填兼容 API 地址' : '自定义 Embedding API 地址' }}</span>
          </div>
          <input type="text" v-model="embeddingConfig.apiEndpoint" @change="saveEmbeddingConfig" class="text-input" :placeholder="embeddingConfig.provider === 'ollama' ? 'http://localhost:11434/api/embed' : 'https://api.openai.com/v1/embeddings'" />
        </div>
        <div class="setting-item" v-if="embeddingConfig.provider !== 'ollama'">
          <div class="setting-info">
            <span class="setting-label">API Key</span>
            <span class="setting-desc">嵌入服务密钥</span>
          </div>
          <input type="password" v-model="embeddingConfig.apiKey" @change="saveEmbeddingConfig" class="text-input" placeholder="sk-..." />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">模型</span>
            <span class="setting-desc">嵌入模型名称</span>
          </div>
          <input type="text" v-model="embeddingConfig.model" @change="saveEmbeddingConfig" class="text-input" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">向量维度</span>
            <span class="setting-desc">模型输出维度，变更后需重启应用并重新生成</span>
          </div>
          <input type="number" v-model.number="embeddingConfig.dimensions" @change="saveEmbeddingConfig" class="text-input" style="width:80px;min-width:80px" min="1" max="8192" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">手动触发嵌入</span>
            <span class="setting-desc">为所有未生成向量的叙事生成嵌入</span>
          </div>
          <button class="btn-primary" @click="handleStartEmbedding" :disabled="embeddingProcessing">
            {{ embeddingProcessing ? '生成中...' : '开始生成' }}
          </button>
        </div>
        <div class="setting-item" v-if="embeddingStatus">
          <div class="setting-info">
            <span class="setting-label">嵌入进度</span>
            <span class="setting-desc">{{ embeddingStatus.embeddedCount }} / {{ embeddingStatus.totalNarratives }} 已嵌入</span>
          </div>
          <div class="progress-bar-mini">
            <div class="progress-fill" :style="{ width: embeddingStatus.totalNarratives > 0 ? (embeddingStatus.embeddedCount / embeddingStatus.totalNarratives * 100) + '%' : '0%' }"></div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <h2>聚类参数</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">最小簇大小</span>
            <span class="setting-desc">HDBSCAN 聚类的最小簇包含点数</span>
          </div>
          <input type="number" v-model.number="clusterDefaults.minClusterSize" @change="saveClusterDefaults" class="text-input" style="width:80px;min-width:80px" min="2" max="100" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">核心邻域 (minSamples)</span>
            <span class="setting-desc">核心点的最小邻域数，越大噪声越多</span>
          </div>
          <input type="number" v-model.number="clusterDefaults.minSamples" @change="saveClusterDefaults" class="text-input" style="width:80px;min-width:80px" min="1" max="100" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">降维维数</span>
            <span class="setting-desc">UMAP 降维后的目标维数，0 表示不降维</span>
          </div>
          <input type="number" v-model.number="clusterDefaults.reducedDimensions" @change="saveClusterDefaults" class="text-input" style="width:80px;min-width:80px" min="0" max="500" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">nNeighbors</span>
            <span class="setting-desc">UMAP 邻域大小，越大越保留全局结构</span>
          </div>
          <input type="number" v-model.number="clusterDefaults.umapNNeighbors" @change="saveClusterDefaults" class="text-input" style="width:80px;min-width:80px" min="2" max="200" />
        </div>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">minDist</span>
            <span class="setting-desc">UMAP 嵌入紧密度，越低点越密集</span>
          </div>
          <input type="number" v-model.number="clusterDefaults.umapMinDist" @change="saveClusterDefaults" class="text-input" style="width:80px;min-width:80px" min="0" max="1" step="0.05" />
        </div>
      </div>

      <div class="settings-section">
        <h2>行为</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">启动行为</span>
            <span class="setting-desc">应用启动时的窗口状态</span>
          </div>
          <select v-model="settings.startupBehavior" @change="saveSettings">
            <option value="restore">恢复上次状态</option>
            <option value="default">默认大小</option>
          </select>
        </div>

        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">关闭时最小化到托盘</span>
            <span class="setting-desc">点击关闭按钮时隐藏到系统托盘而非退出</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="settings.closeToTray" @change="saveSettings" />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2>更新</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">自动更新</span>
            <span class="setting-desc">有新版本时自动下载更新</span>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="settings.autoUpdate" @change="saveSettings" />
            <span class="slider"></span>
          </label>
        </div>
      </div>

      <div class="settings-section">
        <h2>数据管理</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">清除本地数据</span>
            <span class="setting-desc">删除本地数据库中所有原始消息、叙事分析和索引数据</span>
          </div>
          <button class="danger-button" @click="handleClearData" :disabled="clearing">
            {{ clearing ? '清除中...' : '清除数据' }}
          </button>
        </div>
      </div>

      <div class="settings-section">
        <h2>关于</h2>
        <div class="setting-item">
          <div class="setting-info">
            <span class="setting-label">应用版本</span>
            <span class="setting-desc">{{ appVersion }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '../composables/useTheme';
import type { EmbeddingProviderConfig, EmbeddingStatus, EmbeddingProgress } from '../../../shared/types';

const router = useRouter();
const appVersion = ref('');
const { theme, setTheme } = useTheme();

const settings = ref({
  theme: 'system' as 'light' | 'dark' | 'system',
  startupBehavior: 'restore',
  closeToTray: true,
  autoUpdate: true,
  autoSync: true,
  syncInterval: 5,
});

watch(() => settings.value.theme, (newTheme) => {
  setTheme(newTheme);
});

onMounted(async () => {
  if (window.electronAPI) {
    appVersion.value = await window.electronAPI.app.getVersion();

    const savedTheme = await window.electronAPI.store.get<string>('user.preferences.theme');
    if (savedTheme) {
      settings.value.theme = savedTheme as any;
    }

    const appSettings = await window.electronAPI.store.get<any>('app.settings');
    if (appSettings) {
      settings.value.closeToTray = appSettings.closeToTray ?? true;
      settings.value.autoUpdate = appSettings.autoUpdate ?? true;
      settings.value.autoSync = appSettings.autoSync ?? true;
      settings.value.syncInterval = appSettings.syncIntervalMinutes ?? 5;
      clusterDefaults.minClusterSize = appSettings.clusterMinClusterSize ?? 3;
      clusterDefaults.minSamples = appSettings.clusterMinSamples ?? 2;
      clusterDefaults.reducedDimensions = appSettings.clusterReducedDimensions ?? 20;
      clusterDefaults.umapNNeighbors = appSettings.clusterUmapNNeighbors ?? 15;
      clusterDefaults.umapMinDist = appSettings.clusterUmapMinDist ?? 0.1;
    }

    const startupBehavior = await window.electronAPI.store.get<string>('user.preferences.startupBehavior');
    if (startupBehavior) {
      settings.value.startupBehavior = startupBehavior;
    }

    try {
      const savedEmbeddingConfig = await window.electronAPI.data.getEmbeddingConfig();
      if (savedEmbeddingConfig) Object.assign(embeddingConfig, savedEmbeddingConfig);
    } catch {}
    try { await refreshEmbeddingStatus(); } catch {}
    try {
      offEmbeddingProgress = window.electronAPI.data.onEmbeddingProgress((_progress: EmbeddingProgress) => {
        refreshEmbeddingStatus();
      });
    } catch {}
  }
});

const saveSettings = async () => {
  if (window.electronAPI) {
    await window.electronAPI.store.set('user.preferences.theme', settings.value.theme);
    await window.electronAPI.store.set('user.preferences.startupBehavior', settings.value.startupBehavior);
    await window.electronAPI.store.set('app.settings.closeToTray', settings.value.closeToTray);
    await window.electronAPI.store.set('app.settings.autoUpdate', settings.value.autoUpdate);
    await window.electronAPI.log.info('设置已保存');
  }
};

const saveSyncSettings = async () => {
  if (window.electronAPI) {
    await window.electronAPI.store.set('app.settings.autoSync', settings.value.autoSync);
    await window.electronAPI.store.set('app.settings.syncIntervalMinutes', settings.value.syncInterval);
    await window.electronAPI.data.restartAutoSync();
    await window.electronAPI.log.info(`同步设置已更新: 自动=${settings.value.autoSync}, 间隔=${settings.value.syncInterval}分钟`);
  }
};

const clearing = ref(false);

const embeddingConfig = reactive<EmbeddingProviderConfig>({
  provider: 'ollama' as 'openai' | 'ollama' | 'custom',
  apiEndpoint: '',
  apiKey: '',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  batchSize: 20,
});
const embeddingStatus = ref<EmbeddingStatus | null>(null);
const embeddingProcessing = ref(false);
let offEmbeddingProgress: (() => void) | null = null;

const clusterDefaults = reactive({
  minClusterSize: 3,
  minSamples: 2,
  reducedDimensions: 20,
  umapNNeighbors: 15,
  umapMinDist: 0.1,
});

const saveClusterDefaults = async () => {
  if (!window.electronAPI) return;
  await window.electronAPI.store.set('app.settings.clusterMinClusterSize', clusterDefaults.minClusterSize);
  await window.electronAPI.store.set('app.settings.clusterMinSamples', clusterDefaults.minSamples);
  await window.electronAPI.store.set('app.settings.clusterReducedDimensions', clusterDefaults.reducedDimensions);
  await window.electronAPI.store.set('app.settings.clusterUmapNNeighbors', clusterDefaults.umapNNeighbors);
  await window.electronAPI.store.set('app.settings.clusterUmapMinDist', clusterDefaults.umapMinDist);
};

const saveEmbeddingConfig = async () => {
  if (window.electronAPI) {
    await window.electronAPI.data.saveEmbeddingConfig({ ...embeddingConfig });
  }
};

const handleStartEmbedding = async () => {
  if (!window.electronAPI) return;
  if (!embeddingConfig.apiKey) {
    alert('请先配置 API Key');
    return;
  }
  embeddingProcessing.value = true;
  try {
    await window.electronAPI.data.startEmbedding();
  } catch (err) {
    alert('嵌入生成失败: ' + err);
  }
};

const refreshEmbeddingStatus = async () => {
  if (window.electronAPI) {
    embeddingStatus.value = await window.electronAPI.data.getEmbeddingStatus();
  }
};

const handleClearData = async () => {
  if (!window.electronAPI) return;
  const confirmed = confirm('确定要清除所有本地数据吗？此操作不可撤销。');
  if (!confirmed) return;
  const secondConfirm = confirm('再次确认：清除后所有本地数据将丢失，需要重新同步。是否继续？');
  if (!secondConfirm) return;

  clearing.value = true;
  try {
    await window.electronAPI.data.clearAllData();
    await window.electronAPI.log.info('用户已清除本地数据库');
    alert('本地数据已清除');
  } catch (err) {
    await window.electronAPI.log.error(`清除数据失败: ${err}`);
    alert('清除数据失败，请查看日志');
  } finally {
    clearing.value = false;
  }
};

const goBack = () => {
  router.push('/');
};

onUnmounted(() => {
  if (offEmbeddingProgress) offEmbeddingProgress();
});
</script>

<style scoped>
.settings {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--bg-color);
  min-height: 100vh;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}

.back-button {
  background: none;
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--text-color);
}

.back-button:hover {
  background: var(--bg-color-secondary);
}

.settings-header h1 {
  margin: 0;
  font-size: 24px;
  color: var(--text-color);
}

.settings-section {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.settings-section h2 {
  margin: 0 0 16px 0;
  font-size: 18px;
  color: var(--text-color);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
}

.setting-item:not(:last-child) {
  border-bottom: 1px solid var(--border-color);
}

.setting-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-weight: 500;
  color: var(--text-color);
}

.setting-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
}

select {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  min-width: 150px;
}

select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.3s;
  border-radius: 26px;
}

.slider:before {
  position: absolute;
  content: '';
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #409eff;
}

input:checked + .slider:before {
  transform: translateX(22px);
}

.danger-button {
  padding: 8px 16px;
  border: 1px solid #e74c3c;
  background: transparent;
  color: #e74c3c;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.danger-button:hover:not(:disabled) {
  background: #e74c3c;
  color: white;
}

.danger-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-color);
  color: var(--text-color);
  min-width: 200px;
  font-size: 14px;
}

.btn-primary {
  padding: 8px 16px;
  border: 1px solid #409eff;
  background: #409eff;
  color: white;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-primary:hover:not(:disabled) {
  background: #66b1ff;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.progress-bar-mini {
  width: 120px;
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #409eff;
  transition: width 0.3s;
}
</style>
