<template>
  <div class="data-view">
    <!-- 顶部导航栏 -->
    <header class="top-bar">
      <h1 class="app-title">NarrativeMining</h1>
      <div class="top-bar-actions">
        <span class="sync-time" v-if="syncState?.lastSyncTime">
          上次同步: {{ syncState.lastSyncTime }}
        </span>
        <button class="btn btn-primary" @click="handleSync" :disabled="syncState?.isSyncing">
          {{ syncState?.isSyncing ? '同步中...' : '同步数据' }}
        </button>
        <button class="btn btn-ghost" @click="goToSettings">设置</button>
      </div>
      <Transition name="progress">
        <div class="progress-bar" v-if="syncProgress && syncProgress.phase !== 'done' && syncProgress.phase !== 'error'">
          <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
        </div>
      </Transition>
    </header>

    <!-- 统计卡片 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ syncState?.rawCount ?? 0 }}</div>
        <div class="stat-label">原始消息</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ syncState?.narrativeCount ?? 0 }}</div>
        <div class="stat-label">叙事分析</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ remoteStats?.avg_sentiment?.toFixed(2) ?? '-' }}</div>
        <div class="stat-label">平均情绪</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ remoteStats?.avg_intensity?.toFixed(2) ?? '-' }}</div>
        <div class="stat-label">平均强度</div>
      </div>
      <div class="stat-card" v-if="embeddingStatus">
        <div class="stat-value">{{ embeddingStatus.embeddedCount }}/{{ embeddingStatus.totalNarratives }}</div>
        <div class="stat-label">向量嵌入</div>
      </div>
    </div>

    <!-- 选项卡 -->
    <div class="tabs">
      <button class="tab" :class="{ active: activeTab === 'raw' }" @click="activeTab = 'raw'">
        原始消息
      </button>
      <button class="tab" :class="{ active: activeTab === 'narrative' }" @click="activeTab = 'narrative'">
        叙事分析
      </button>
      <button class="tab" :class="{ active: activeTab === 'cluster' }" @click="activeTab = 'cluster'">
        聚类分析
      </button>
      <button class="tab" :class="{ active: activeTab === 'search' }" @click="activeTab = 'search'">
        语义搜索
      </button>
    </div>

    <!-- 原始消息列表 -->
    <div v-if="activeTab === 'raw'" class="tab-content">
      <div class="filter-bar">
        <select v-model="rawFilter.level" @change="fetchRaw">
          <option value="">全部级别</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
        </select>
        <input
          v-model="rawFilter.search"
          @keyup.enter="fetchRaw"
          placeholder="搜索标题/内容..."
          class="search-input"
        />
        <button class="btn btn-small" @click="fetchRaw">搜索</button>
      </div>

      <div class="data-list">
        <div v-if="rawLoading" class="loading">加载中...</div>
        <div v-else-if="rawData.items.length === 0" class="empty">
          暂无数据，请先点击「同步数据」
        </div>
        <div
          v-else
          v-for="item in rawData.items"
          :key="item.id"
          class="data-card"
          @click="showRawDetail(item)"
        >
          <div class="card-header">
            <span class="card-id">#{{ item.id }}</span>
            <span class="card-level" :class="'level-' + item.level">{{ item.level }}</span>
            <span class="card-time">{{ formatTime(item.time) }}</span>
          </div>
          <div class="card-body">
            <p class="card-brief">{{ item.brief || item.title || item.content?.slice(0, 120) }}</p>
          </div>
          <div class="card-footer">
            <span v-for="s in item.subjects?.slice(0, 3)" :key="s" class="tag">{{ s }}</span>
            <span v-for="s in item.stocks?.slice(0, 3)" :key="s.code" class="tag tag-stock">
              {{ s.name }}
            </span>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="rawData.total > rawFilter.limit">
        <button class="btn btn-small" :disabled="rawFilter.offset === 0" @click="rawFilter.offset -= rawFilter.limit; fetchRaw()">
          上一页
        </button>
        <span class="page-info">
          {{ rawFilter.offset + 1 }}-{{ Math.min(rawFilter.offset + rawFilter.limit, rawData.total) }} / {{ rawData.total }}
        </span>
        <button class="btn btn-small" :disabled="rawFilter.offset + rawFilter.limit >= rawData.total" @click="rawFilter.offset += rawFilter.limit; fetchRaw()">
          下一页
        </button>
      </div>
    </div>

    <!-- 叙事分析列表 -->
    <div v-if="activeTab === 'narrative'" class="tab-content">
      <div class="filter-bar">
        <select v-model="narrativeFilter.text_type" @change="fetchNarratives">
          <option value="">全部类型</option>
          <option value="事实报道">事实报道</option>
          <option value="市场传闻">市场传闻</option>
          <option value="政策发布">政策发布</option>
          <option value="数据发布">数据发布</option>
          <option value="观点研判">观点研判</option>
        </select>
        <select v-model="narrativeFilter.narrative_trend" @change="fetchNarratives">
          <option value="">全部趋势</option>
          <option value="利好">利好</option>
          <option value="利空">利空</option>
          <option value="中性">中性</option>
          <option value="待观察">待观察</option>
        </select>
        <select v-model="narrativeFilter.narrative_mode" @change="fetchNarratives">
          <option value="">全部模式</option>
          <option value="延续型">延续型</option>
          <option value="突破型">突破型</option>
          <option value="升级型">升级型</option>
          <option value="反转型">反转型</option>
          <option value="否认型">否认型</option>
          <option value="确认型">确认型</option>
          <option value="缓和型">缓和型</option>
        </select>
        <input
          v-model="narrativeFilter.search"
          @keyup.enter="fetchNarratives"
          placeholder="搜索主题/故事..."
          class="search-input"
        />
        <button class="btn btn-small" @click="fetchNarratives">搜索</button>
      </div>

      <div class="data-list">
        <div v-if="narrativeLoading" class="loading">加载中...</div>
        <div v-else-if="narrativeData.items.length === 0" class="empty">
          暂无数据，请先点击「同步数据」
        </div>
        <div
          v-else
          v-for="item in narrativeData.items"
          :key="item.id"
          class="data-card"
          @click="showNarrativeDetail(item)"
        >
          <div class="card-header">
            <span class="card-id">{{ item.narrative_id }}</span>
            <span class="card-level" :class="trendClass(item.narrative_trend)">{{ item.narrative_trend }}</span>
            <span class="card-mode">{{ item.narrative_mode }}</span>
            <span class="card-time">{{ formatTime(item.publish_time) }}</span>
          </div>
          <div class="card-body">
            <p class="card-subject">{{ item.main_subject }}</p>
            <p class="card-story">{{ item.core_story?.slice(0, 150) }}</p>
          </div>
          <div class="card-footer">
            <span class="tag" v-if="item.source">{{ item.source }}</span>
            <span class="tag" v-if="item.text_type">{{ item.text_type }}</span>
            <span class="tag tag-sentiment">
              情绪: {{ item.sentiment_score?.toFixed(1) }}
            </span>
            <span class="tag tag-intensity">
              强度: {{ item.narrative_intensity?.toFixed(1) }}
            </span>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="narrativeData.total > narrativeFilter.limit">
        <button class="btn btn-small" :disabled="narrativeFilter.offset === 0" @click="narrativeFilter.offset -= narrativeFilter.limit; fetchNarratives()">
          上一页
        </button>
        <span class="page-info">
          {{ narrativeFilter.offset + 1 }}-{{ Math.min(narrativeFilter.offset + narrativeFilter.limit, narrativeData.total) }} / {{ narrativeData.total }}
        </span>
        <button class="btn btn-small" :disabled="narrativeFilter.offset + narrativeFilter.limit >= narrativeData.total" @click="narrativeFilter.offset += narrativeFilter.limit; fetchNarratives()">
          下一页
        </button>
      </div>
    </div>

    <!-- 聚类分析 -->
    <div v-if="activeTab === 'cluster'" class="tab-content">
      <div class="filter-bar">
        <label class="filter-label">时间范围</label>
        <div class="time-shortcuts">
          <button class="btn btn-small" :class="{ 'btn-primary': activeShortcut === 1 }" @click="setTimeRange(1)">近1天</button>
          <button class="btn btn-small" :class="{ 'btn-primary': activeShortcut === 3 }" @click="setTimeRange(3)">近3天</button>
          <button class="btn btn-small" :class="{ 'btn-primary': activeShortcut === 7 }" @click="setTimeRange(7)">近1周</button>
          <button class="btn btn-small" :class="{ 'btn-primary': activeShortcut === 30 }" @click="setTimeRange(30)">近1月</button>
        </div>
        <input type="datetime-local" v-model="clusterOptions.timeStart" class="search-input" style="flex:0;min-width:180px" @change="activeShortcut = 0" />
        <span>~</span>
        <input type="datetime-local" v-model="clusterOptions.timeEnd" class="search-input" style="flex:0;min-width:180px" @change="activeShortcut = 0" />
        <label class="filter-label">最小簇</label>
        <input type="number" v-model.number="clusterOptions.minClusterSize" min="2" max="50" class="search-input" style="flex:0;min-width:60px;width:60px" />
        <label class="filter-label">核心邻域</label>
        <input type="number" v-model.number="clusterOptions.minSamples" min="1" max="50" placeholder="2" class="search-input" style="flex:0;min-width:60px;width:60px" />
        <label class="filter-label">降维维数</label>
        <input type="number" v-model.number="clusterOptions.reducedDimensions" min="0" max="500" placeholder="20" class="search-input" style="flex:0;min-width:60px;width:60px" />
        <button class="btn btn-primary btn-small" @click="handleRunClustering" :disabled="clusterLoading">
          {{ clusterLoading ? '聚类中...' : '执行聚类' }}
        </button>
      </div>

      <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span class="advanced-arrow" :class="{ expanded: showAdvanced }">&#9654;</span>
        <span>高级参数</span>
      </div>
      <div class="filter-bar advanced-params" v-if="showAdvanced">
        <label class="filter-label">nNeighbors</label>
        <input type="number" v-model.number="clusterOptions.umapNNeighbors" min="2" max="200" placeholder="15" class="search-input" style="flex:0;min-width:60px;width:60px" />
        <span class="param-hint">邻域大小，越大越保留全局结构</span>
        <label class="filter-label">minDist</label>
        <input type="number" v-model.number="clusterOptions.umapMinDist" min="0" max="1" step="0.05" placeholder="0.1" class="search-input" style="flex:0;min-width:60px;width:60px" />
        <span class="param-hint">嵌入紧密度，越低簇越密</span>
      </div>

      <div class="cluster-info" v-if="clusteringResult">
        <span>共 {{ clusteringResult.totalItems }} 条数据，发现 {{ clusteringResult.clusters.length }} 个簇，{{ clusteringResult.noiseCount }} 条噪声</span>
        <span v-if="pcaReducedDims" class="cluster-pca-info">UMAP: {{ pcaReducedDims }}d</span>
      </div>

      <div class="data-list">
        <div v-if="clusterLoading" class="loading">正在执行 HDBSCAN 聚类...</div>
        <div v-else-if="!clusteringResult" class="empty">选择时间范围后点击「执行聚类」</div>
        <div v-else-if="clusteringResult.clusters.length === 0" class="empty">未发现有效聚类，请调整参数或时间范围</div>
        <div
          v-else
          v-for="cluster in clusteringResult.clusters"
          :key="cluster.clusterId"
          class="cluster-card"
        >
          <div class="cluster-header" @click="toggleCluster(cluster.clusterId)">
            <div class="cluster-title">
              <span class="cluster-id">簇 #{{ cluster.clusterId }}</span>
              <span class="cluster-size">{{ cluster.size }} 条</span>
              <span class="card-level" :class="trendClass(cluster.dominantTrend)">{{ cluster.dominantTrend || '未知' }}</span>
            </div>
            <div class="cluster-meta">
              <span>主题: {{ cluster.centroidSubject }}</span>
              <span v-if="cluster.avgSentiment != null">情绪: {{ cluster.avgSentiment.toFixed(2) }}</span>
              <span v-if="cluster.avgIntensity != null">强度: {{ cluster.avgIntensity.toFixed(2) }}</span>
              <span>{{ cluster.timeRange.start?.slice(0, 10) }} ~ {{ cluster.timeRange.end?.slice(0, 10) }}</span>
            </div>
          </div>
          <div class="cluster-detail" v-if="expandedCluster === cluster.clusterId">
            <div v-if="clusterDetailsLoading" class="loading">加载中...</div>
            <div v-else-if="clusterDetails.length === 0" class="empty">暂无数据</div>
            <div
              v-else
              v-for="item in clusterDetails"
              :key="item.id"
              class="data-card"
              @click="showNarrativeDetail(item)"
            >
              <div class="card-header">
                <span class="card-id">{{ item.narrative_id }}</span>
                <span class="card-level" :class="trendClass(item.narrative_trend)">{{ item.narrative_trend }}</span>
                <span class="card-time">{{ formatTime(item.publish_time) }}</span>
              </div>
              <div class="card-body">
                <p class="card-subject">{{ item.main_subject }}</p>
                <p class="card-story">{{ item.core_story?.slice(0, 150) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 语义搜索 -->
    <div v-if="activeTab === 'search'" class="tab-content">
      <div class="filter-bar">
        <input
          v-model="vectorQuery"
          @keyup.enter="handleVectorSearch"
          placeholder="输入查询文本..."
          class="search-input"
        />
        <div class="time-shortcuts">
          <button class="btn btn-small" :class="{ 'btn-primary': searchShortcut === 1 }" @click="setSearchTimeRange(1)">近1天</button>
          <button class="btn btn-small" :class="{ 'btn-primary': searchShortcut === 3 }" @click="setSearchTimeRange(3)">近3天</button>
          <button class="btn btn-small" :class="{ 'btn-primary': searchShortcut === 7 }" @click="setSearchTimeRange(7)">近1周</button>
          <button class="btn btn-small" :class="{ 'btn-primary': searchShortcut === 30 }" @click="setSearchTimeRange(30)">近1月</button>
        </div>
        <input type="datetime-local" v-model="searchTimeStart" class="search-input" style="flex:0;min-width:180px" @change="searchShortcut = 0" />
        <span>~</span>
        <input type="datetime-local" v-model="searchTimeEnd" class="search-input" style="flex:0;min-width:180px" @change="searchShortcut = 0" />
        <button class="btn btn-primary btn-small" @click="handleVectorSearch" :disabled="vectorLoading">
          {{ vectorLoading ? '搜索中...' : '搜索' }}
        </button>
      </div>

      <div class="data-list">
        <div v-if="vectorLoading" class="loading">正在搜索...</div>
        <div v-else-if="vectorResults.length === 0 && vectorSearched" class="empty">未找到相关结果</div>
        <div v-else-if="vectorResults.length === 0" class="empty">输入查询文本进行语义搜索</div>
        <div
          v-else
          v-for="item in vectorResults"
          :key="item.id"
          class="data-card"
          @click="showVectorResultDetail(item)"
        >
          <div class="card-header">
            <span class="card-id">{{ item.narrative_id }}</span>
            <span class="card-level" :class="trendClass(item.narrative_trend)">{{ item.narrative_trend }}</span>
            <span class="card-dist">距离: {{ item.distance.toFixed(4) }}</span>
            <span class="card-time">{{ formatTime(item.publish_time) }}</span>
          </div>
          <div class="card-body">
            <p class="card-subject">{{ item.main_subject }}</p>
            <p class="card-story">{{ item.core_story?.slice(0, 150) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 详情弹窗 -->
    <div class="modal-overlay" v-if="detailItem" @click.self="detailItem = null">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ detailType === 'raw' ? '原始消息详情' : '叙事分析详情' }}</h2>
          <button class="btn-close" @click="detailItem = null">&times;</button>
        </div>
        <div class="modal-body">
          <!-- 原始消息详情 -->
          <template v-if="detailType === 'raw'">
            <div class="detail-row"><span class="detail-label">ID</span><span>{{ (detailItem as any).id }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).level"><span class="detail-label">级别</span><span>{{ (detailItem as any).level }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).time"><span class="detail-label">时间</span><span>{{ formatTime((detailItem as any).time) }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).title"><span class="detail-label">标题</span><span>{{ (detailItem as any).title }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).brief"><span class="detail-label">摘要</span><span>{{ (detailItem as any).brief }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).content"><span class="detail-label">内容</span><span>{{ (detailItem as any).content }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).subjects?.length">
              <span class="detail-label">主题</span>
              <div><span v-for="s in (detailItem as any).subjects" :key="s" class="tag">{{ s }}</span></div>
            </div>
            <div class="detail-row" v-if="(detailItem as any).stocks?.length">
              <span class="detail-label">关联股票</span>
              <div>
                <span v-for="s in (detailItem as any).stocks" :key="s.code" class="tag tag-stock">
                  {{ s.name }}({{ s.code }}) {{ s.change }}
                </span>
              </div>
            </div>
          </template>
          <!-- 叙事详情 -->
          <template v-else>
            <div class="detail-row"><span class="detail-label">叙事 ID</span><span>{{ (detailItem as any).narrative_id }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).publish_time"><span class="detail-label">时间</span><span>{{ formatTime((detailItem as any).publish_time) }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).source"><span class="detail-label">来源</span><span>{{ (detailItem as any).source }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).text_type"><span class="detail-label">类型</span><span>{{ (detailItem as any).text_type }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).main_subject"><span class="detail-label">主要主题</span><span class="detail-long">{{ (detailItem as any).main_subject }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).core_story"><span class="detail-label">核心叙事</span><span class="detail-long">{{ (detailItem as any).core_story }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).action_behavior"><span class="detail-label">行为</span><span>{{ (detailItem as any).action_behavior }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).scene_context"><span class="detail-label">场景</span><span>{{ (detailItem as any).scene_context }}</span></div>
            <div class="detail-row" v-if="(detailItem as any).narrative_mode || (detailItem as any).narrative_trend || (detailItem as any).narrative_firmness">
              <span class="detail-label">模式/趋势/确信</span>
              <span>{{ (detailItem as any).narrative_mode || '-' }} / {{ (detailItem as any).narrative_trend || '-' }} / {{ (detailItem as any).narrative_firmness || '-' }}</span>
            </div>
            <div class="detail-row" v-if="(detailItem as any).sentiment_score != null || (detailItem as any).narrative_intensity != null">
              <span class="detail-label">情绪/强度</span>
              <span>{{ (detailItem as any).sentiment_score ?? '-' }} / {{ (detailItem as any).narrative_intensity ?? '-' }}</span>
            </div>
            <div class="detail-row" v-if="(detailItem as any).keyword_core?.length">
              <span class="detail-label">核心关键词</span>
              <div><span v-for="k in (detailItem as any).keyword_core" :key="k" class="tag">{{ k }}</span></div>
            </div>
            <div class="detail-row" v-if="(detailItem as any).actor_list?.length">
              <span class="detail-label">参与者</span>
              <div class="detail-sub-list">
                <div v-for="a in (detailItem as any).actor_list" :key="a.name" class="detail-sub-item">
                  <strong>{{ a.name }}</strong> - {{ a.role }}
                </div>
              </div>
            </div>
            <div class="detail-row" v-if="(detailItem as any).affected_targets?.length">
              <span class="detail-label">受影响目标</span>
              <div class="detail-sub-list">
                <div v-for="t in (detailItem as any).affected_targets" :key="t.name" class="detail-sub-item">
                  <strong>{{ t.name }}</strong> ({{ t.target_type }}) - {{ t.impact }}
                </div>
              </div>
            </div>
            <div class="detail-row" v-if="(detailItem as any).potential_risk_benefit?.length">
              <span class="detail-label">潜在风险/收益</span>
              <div class="detail-sub-list">
                <div v-for="r in (detailItem as any).potential_risk_benefit" :key="r.description" class="detail-sub-item">
                  <span :class="'direction-' + r.direction">[{{ r.direction }}]</span>
                  {{ r.description }}
                  <span v-if="r.targets?.length" class="tag-list">
                    <span v-for="t in r.targets" :key="t" class="tag">{{ t }}</span>
                  </span>
                </div>
              </div>
            </div>
            <div class="detail-row" v-if="(detailItem as any).direct_causal_chain?.length">
              <span class="detail-label">因果链</span>
              <div class="detail-sub-list">
                <div v-for="c in (detailItem as any).direct_causal_chain" :key="c.cause" class="detail-sub-item">
                  {{ c.cause }} → {{ c.effect }} (置信度: {{ c.confidence }})
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useTheme } from '../composables/useTheme';
import type {
  SyncState,
  SyncProgress,
  RemoteStats,
  RawMessageRow,
  NarrativeRow,
  PaginatedResult,
  EmbeddingStatus,
  EmbeddingProgress,
  VectorSearchResult,
  ClusterOptions,
  ClusteringResult,
} from '../../../shared/types';

const router = useRouter();
const { loadTheme } = useTheme();

// 同步状态
const syncState = ref<SyncState | null>(null);
const syncProgress = ref<SyncProgress | null>(null);
const remoteStats = ref<RemoteStats | null>(null);

// Tab
const activeTab = ref<'raw' | 'narrative' | 'cluster' | 'search'>('raw');

// 向量嵌入状态
const embeddingStatus = ref<EmbeddingStatus | null>(null);
let offEmbeddingProgress: (() => void) | null = null;

// 聚类
const clusterOptions = reactive<ClusterOptions>({ timeStart: '', timeEnd: '', minClusterSize: 3, minSamples: 2, reducedDimensions: 20 } as ClusterOptions);

async function loadClusterDefaults() {
  if (!window.electronAPI) return;
  try {
    const keys = [
      ['clusterMinClusterSize', 'minClusterSize'],
      ['clusterMinSamples', 'minSamples'],
      ['clusterReducedDimensions', 'reducedDimensions'],
      ['clusterUmapNNeighbors', 'umapNNeighbors'],
      ['clusterUmapMinDist', 'umapMinDist'],
    ] as const;
    for (const [storeKey, field] of keys) {
      const val = await window.electronAPI.store.get(`app.settings.${storeKey}`);
      if (val != null) (clusterOptions as any)[field] = val;
    }
  } catch {}
}
const clusteringResult = ref<ClusteringResult | null>(null);
const clusterLoading = ref(false);
const expandedCluster = ref<number | null>(null);
const clusterDetails = ref<NarrativeRow[]>([]);
const clusterDetailsLoading = ref(false);
const activeShortcut = ref(0);
const pcaReducedDims = ref<number | null>(null);
const showAdvanced = ref(false);

// 语义搜索
const vectorQuery = ref('');
const vectorResults = ref<VectorSearchResult[]>([]);
const vectorLoading = ref(false);
const vectorSearched = ref(false);
const searchTimeStart = ref('');
const searchTimeEnd = ref('');
const searchShortcut = ref(0);

// 原始消息
const rawLoading = ref(false);
const rawData = ref<PaginatedResult<RawMessageRow>>({ total: 0, items: [] });
const rawFilter = reactive({ limit: 15, offset: 0, level: '', search: '' });

// 叙事数据
const narrativeLoading = ref(false);
const narrativeData = ref<PaginatedResult<NarrativeRow>>({ total: 0, items: [] });
const narrativeFilter = reactive({
  limit: 15, offset: 0, text_type: '', narrative_trend: '', narrative_mode: '', search: '',
});

// 详情弹窗
const detailItem = ref<any>(null);
const detailType = ref<'raw' | 'narrative'>('raw');

let offSyncProgress: (() => void) | null = null;

const progressPercent = computed(() => {
  if (!syncProgress.value || syncProgress.value.total === 0) return 0;
  return Math.round((syncProgress.value.fetched / syncProgress.value.total) * 100);
});

onMounted(async () => {
  loadTheme();
  await refreshState();
  await loadClusterDefaults();
  fetchRaw();
  fetchNarratives();

  if (window.electronAPI) {
    offSyncProgress = window.electronAPI.data.onSyncProgress((p) => {
      syncProgress.value = p;
      if (p.phase === 'done') {
        syncProgress.value = null;
        refreshAll().catch(() => {});
      } else if (p.phase === 'error') {
        setTimeout(() => (syncProgress.value = null), 3000);
        refreshState().catch(() => {});
      }
    });

    try { embeddingStatus.value = await window.electronAPI.data.getEmbeddingStatus(); } catch {}
    offEmbeddingProgress = window.electronAPI.data.onEmbeddingProgress(() => {
      if (window.electronAPI) window.electronAPI.data.getEmbeddingStatus().then(s => { embeddingStatus.value = s; }).catch(() => {});
    });
  }
});

onUnmounted(() => {
  offSyncProgress?.();
  offEmbeddingProgress?.();
});

async function refreshState() {
  if (!window.electronAPI) return;
  syncState.value = await window.electronAPI.data.getSyncStatus();
  try {
    remoteStats.value = await window.electronAPI.data.getRemoteStats();
  } catch {}
}

async function refreshAll() {
  await refreshState();
  fetchRaw();
  fetchNarratives();
}

async function handleSync() {
  if (!window.electronAPI) return;
  try {
    await window.electronAPI.data.startSync();
  } catch (e) {
    console.error('同步失败:', e);
  }
}

async function fetchRaw() {
  if (!window.electronAPI) return;
  rawLoading.value = true;
  try {
    const opts: any = { limit: rawFilter.limit, offset: rawFilter.offset };
    if (rawFilter.level) opts.level = rawFilter.level;
    if (rawFilter.search) opts.search = rawFilter.search;
    rawData.value = await window.electronAPI.data.listRaw(opts);
  } finally {
    rawLoading.value = false;
  }
}

async function fetchNarratives() {
  if (!window.electronAPI) return;
  narrativeLoading.value = true;
  try {
    const opts: any = { limit: narrativeFilter.limit, offset: narrativeFilter.offset };
    if (narrativeFilter.text_type) opts.text_type = narrativeFilter.text_type;
    if (narrativeFilter.narrative_trend) opts.narrative_trend = narrativeFilter.narrative_trend;
    if (narrativeFilter.narrative_mode) opts.narrative_mode = narrativeFilter.narrative_mode;
    if (narrativeFilter.search) opts.search = narrativeFilter.search;
    narrativeData.value = await window.electronAPI.data.listNarratives(opts);
  } finally {
    narrativeLoading.value = false;
  }
}

function showRawDetail(item: RawMessageRow) {
  detailType.value = 'raw';
  detailItem.value = item;
}

function showNarrativeDetail(item: NarrativeRow) {
  detailType.value = 'narrative';
  detailItem.value = item;
}

async function showVectorResultDetail(item: VectorSearchResult) {
  if (!window.electronAPI) return;
  try {
    const full = await window.electronAPI.data.getNarrative(item.narrative_id);
    if (full) showNarrativeDetail(full);
  } catch {}
}

function formatTime(t: string | null | undefined): string {
  if (!t) return '-';
  try {
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    return d.toLocaleString('zh-CN');
  } catch {
    return t;
  }
}

function trendClass(trend: string | null): string {
  if (!trend) return '';
  if (trend === '利好') return 'trend-positive';
  if (trend === '利空') return 'trend-negative';
  return 'trend-neutral';
}

function setTimeRange(days: number) {
  activeShortcut.value = days;
  const { start, end } = computeTimeRange(days);
  clusterOptions.timeEnd = end;
  clusterOptions.timeStart = start;
}

function setSearchTimeRange(days: number) {
  searchShortcut.value = days;
  const { start, end } = computeTimeRange(days);
  searchTimeEnd.value = end;
  searchTimeStart.value = start;
}

function computeTimeRange(days: number) {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const end = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const startStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
  return { start: startStr, end };
}

async function handleRunClustering() {
  if (!window.electronAPI) return;
  if (!clusterOptions.timeStart || !clusterOptions.timeEnd) {
    alert('请选择时间范围');
    return;
  }
  clusterLoading.value = true;
  clusteringResult.value = null;
  expandedCluster.value = null;
  pcaReducedDims.value = null;
  try {
    clusteringResult.value = await window.electronAPI.data.runClustering({ ...clusterOptions });
    pcaReducedDims.value = clusteringResult.value.pcaReducedDims ?? null;
  } catch (err) {
    alert('聚类失败: ' + err);
  } finally {
    clusterLoading.value = false;
  }
}

async function toggleCluster(clusterId: number) {
  if (expandedCluster.value === clusterId) {
    expandedCluster.value = null;
    return;
  }
  expandedCluster.value = clusterId;
  const cluster = clusteringResult.value?.clusters.find(c => c.clusterId === clusterId);
  if (!cluster || !window.electronAPI) return;
  if (!cluster.narrativeIds || cluster.narrativeIds.length === 0) return;
  clusterDetailsLoading.value = true;
  try {
    const ids = cluster.narrativeIds.map(Number);
    clusterDetails.value = await window.electronAPI.data.getClusterDetails(clusterId, ids);
  } catch (err) {
    console.error('getClusterDetails error:', err);
  } finally {
    clusterDetailsLoading.value = false;
  }
}

async function handleVectorSearch() {
  if (!window.electronAPI || !vectorQuery.value.trim()) return;
  vectorLoading.value = true;
  vectorSearched.value = false;
  try {
    vectorResults.value = await window.electronAPI.data.vectorSearch({
      queryText: vectorQuery.value.trim(),
      timeStart: searchTimeStart.value || undefined,
      timeEnd: searchTimeEnd.value || undefined,
      limit: 20,
    });
    vectorSearched.value = true;
  } catch (err) {
    alert('语义搜索失败: ' + err);
  } finally {
    vectorLoading.value = false;
  }
}

function goToSettings() {
  router.push('/settings');
}
</script>

<style scoped>
.data-view {
  min-height: 100vh;
  background: var(--bg-color);
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--card-bg);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 100;
}

.app-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.top-bar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.sync-time {
  font-size: 12px;
  color: var(--text-color-secondary);
}

/* 按钮 */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 13px;
  transition: all 0.15s;
}

.btn:hover { border-color: var(--primary-color); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
  background: var(--primary-color);
  color: #fff;
  border-color: var(--primary-color);
}

.btn-primary:hover { background: var(--primary-hover); }
.btn-ghost { border: none; background: transparent; }
.btn-small { padding: 4px 10px; font-size: 12px; }

/* 进度条 */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s;
}

.progress-enter-active,
.progress-leave-active {
  transition: opacity 0.3s;
}

.progress-enter-from,
.progress-leave-to {
  opacity: 0;
}

.progress-fill {
  height: 100%;
  background: var(--primary-color);
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  color: var(--text-color);
  white-space: nowrap;
}

/* 统计卡片 */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 16px 24px;
}

.stat-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--primary-color);
}

.stat-label {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-top: 4px;
}

/* 选项卡 */
.tabs {
  display: flex;
  padding: 0 24px;
  gap: 4px;
  border-bottom: 1px solid var(--border-color);
}

.tab {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-color-secondary);
  font-size: 14px;
  cursor: pointer;
}

.tab.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

/* 筛选栏 */
.filter-bar {
  display: flex;
  gap: 8px;
  padding: 12px 24px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-bar select,
.search-input {
  padding: 6px 10px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--card-bg);
  color: var(--text-color);
  font-size: 13px;
}

.search-input { flex: 1; min-width: 180px; }

/* 数据列表 */
.data-list {
  flex: 1;
  padding: 0 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.loading, .empty {
  text-align: center;
  padding: 40px;
  color: var(--text-color-secondary);
}

.data-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 12px 16px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.data-card:hover { border-color: var(--primary-color); }

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.card-id {
  font-size: 12px;
  color: var(--text-color-secondary);
  font-family: monospace;
}

.card-level, .card-mode {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  background: var(--bg-color-secondary);
  color: var(--text-color);
}

.level-A { color: #e74c3c; background: #fde8e8; }
.level-B { color: #f39c12; background: #fef3e2; }
.level-C { color: #27ae60; background: #e8f8f0; }

.trend-positive { color: #27ae60; background: #e8f8f0; }
.trend-negative { color: #e74c3c; background: #fde8e8; }
.trend-neutral { color: #f39c12; background: #fef3e2; }

.card-time {
  font-size: 12px;
  color: var(--text-color-secondary);
  margin-left: auto;
}

.card-body { margin-bottom: 6px; }

.card-subject {
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 4px;
}

.card-brief, .card-story {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.4;
}

.card-footer {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
}

.tag-stock { background: #e8f4fd; color: #2980b9; }
.tag-sentiment { font-family: monospace; }
.tag-intensity { font-family: monospace; }

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 24px;
}

.page-info {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal {
  background: var(--card-bg);
  border-radius: 10px;
  width: 90%;
  max-width: 720px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  font-size: 16px;
  color: var(--text-color);
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--text-color-secondary);
  cursor: pointer;
}

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
}

.detail-row {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.detail-label {
  flex-shrink: 0;
  width: 100px;
  color: var(--text-color-secondary);
  font-weight: 500;
}

.detail-long {
  line-height: 1.6;
}

.detail-sub-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-sub-item {
  padding: 4px 0;
  line-height: 1.5;
}

.tag-list {
  margin-left: 4px;
}

.direction-正面 { color: #27ae60; font-weight: 600; }
.direction-负面 { color: #e74c3c; font-weight: 600; }
.direction-中性 { color: #f39c12; font-weight: 600; }

/* 聚类分析 */
.filter-label {
  font-size: 13px;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.time-shortcuts {
  display: flex;
  gap: 4px;
}

.cluster-info {
  padding: 8px 24px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.advanced-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 24px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-color-secondary);
  user-select: none;
}

.advanced-toggle:hover { color: var(--primary-color); }

.advanced-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.advanced-arrow.expanded { transform: rotate(90deg); }

.advanced-params {
  padding-top: 4px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-color);
}

.param-hint {
  font-size: 11px;
  color: var(--text-color-secondary);
  white-space: nowrap;
}

.cluster-card {
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.cluster-header {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.cluster-header:hover { background: var(--bg-color-secondary); }

.cluster-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.cluster-id {
  font-weight: 600;
  color: var(--primary-color);
}

.cluster-size {
  font-size: 12px;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--bg-color-secondary);
  color: var(--text-color-secondary);
}

.cluster-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.cluster-detail {
  border-top: 1px solid var(--border-color);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-dist {
  font-size: 12px;
  font-family: monospace;
  color: #8e44ad;
}
</style>
