import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type BetterSqlite3 from 'better-sqlite3';
import type { Logger } from 'electron-log';
import type { EmbeddingProviderConfig, EmbeddingStatus, EmbeddingProgress } from '../../shared/types';

const MAX_CONSECUTIVE_FAILURES = 3;

export class EmbeddingService {
  private processing = false;
  private cancelled = false;
  private _responseFormatDetected = false;

  constructor(
    private db: BetterSqlite3.Database,
    private logger: Logger,
    private getConfig: () => EmbeddingProviderConfig | null,
  ) {}

  getStatus(): EmbeddingStatus {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM narratives').get() as { c: number }).c;
    const embedded = (this.db.prepare('SELECT COUNT(*) as c FROM narrative_vec').get() as { c: number }).c;
    return {
      totalNarratives: total,
      embeddedCount: embedded,
      pendingCount: total - embedded,
      isProcessing: this.processing,
    };
  }

  async startEmbedding(): Promise<void> {
    const config = this.getConfig();
    if (!config) return;
    if (config.provider !== 'ollama' && !config.apiKey) return;
    if (this.processing) return;

    this.processing = true;
    this.cancelled = false;

    const status = this.getStatus();
    if (status.pendingCount === 0) {
      this.processing = false;
      return;
    }

    this.logger.info(`开始向量嵌入，待处理 ${status.pendingCount} 条`);

    const batchSize = config.batchSize || 20;
    let processed = 0;
    let failedCount = 0;
    let batchNum = 0;
    let consecutiveFailures = 0;
    const failedIds = new Set<number>();

    try {
      while (!this.cancelled) {
        const pending = this.getPendingNarratives(batchSize, failedIds);
        if (pending.length === 0) break;

        batchNum++;
        const texts = pending.map((p) => p.text);

        let vectors: Float32Array[];
        try {
          vectors = await this.embedBatch(texts, config);
          consecutiveFailures = 0;
        } catch (err) {
          consecutiveFailures++;
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`嵌入批次 ${batchNum} 失败 (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${msg}`);

          for (const p of pending) failedIds.add(p.id);
          failedCount += pending.length;
          processed += pending.length;
          this.emitProgress({ processed, total: status.pendingCount, currentBatch: batchNum, failedCount, message: `批次 ${batchNum} 失败: ${msg.slice(0, 80)}` });

          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            this.logger.error(`连续 ${MAX_CONSECUTIVE_FAILURES} 次失败，终止嵌入`);
            this.emitProgress({ processed, total: status.pendingCount, currentBatch: batchNum, failedCount, message: `API 连续失败，已终止。请检查配置后重试。` });
            break;
          }
          continue;
        }

        this.storeVectors(pending.map((p, i) => ({ id: p.id, vector: vectors[i] })));
        processed += pending.length;
        this.emitProgress({ processed, total: status.pendingCount, currentBatch: batchNum, failedCount, message: `已嵌入 ${processed - failedCount}/${status.pendingCount}` });
      }

      this.logger.info(`向量嵌入完成，成功 ${processed - failedCount} 条，失败 ${failedCount} 条`);
    } finally {
      this.processing = false;
    }
  }

  cancelEmbedding(): void {
    this.cancelled = true;
    this.logger.info('已请求取消向量嵌入');
  }

  async embedBatch(texts: string[], config?: EmbeddingProviderConfig): Promise<Float32Array[]> {
    const cfg = config || this.getConfig();
    if (!cfg) throw new Error('Embedding provider not configured');

    const { endpoint, headers, body } = this.buildRequest(cfg, texts);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Embedding API error ${response.status}: ${text}`);
    }

    const json = await response.json() as any;

    if (json.data?.[0]?.embedding) {
      return json.data.map((d: any) => new Float32Array(d.embedding));
    }
    if (json.embeddings) {
      return json.embeddings.map((e: number[]) => new Float32Array(e));
    }

    this.logger.error(`未知的 embedding 响应格式: ${JSON.stringify(json).slice(0, 500)}`);
    throw new Error(`Unknown embedding response format, keys: ${Object.keys(json).join(',')}`);
  }

  private buildRequest(cfg: EmbeddingProviderConfig, texts: string[]): { endpoint: string; headers: Record<string, string>; body: string } {
    switch (cfg.provider) {
      case 'ollama': {
        const endpoint = cfg.apiEndpoint || 'http://localhost:11434/api/embed';
        return {
          endpoint,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: cfg.model, input: texts }),
        };
      }
      case 'openai': {
        const endpoint = cfg.apiEndpoint || 'https://api.openai.com/v1/embeddings';
        return {
          endpoint,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({ input: texts, model: cfg.model }),
        };
      }
      default: {
        const endpoint = cfg.apiEndpoint;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
        return { endpoint, headers, body: JSON.stringify({ input: texts, model: cfg.model }) };
      }
    }
  }

  getConfigValue(): EmbeddingProviderConfig | null {
    return this.getConfig();
  }

  private getPendingNarratives(limit: number, excludeIds?: Set<number>): { id: number; text: string }[] {
    const rows = this.db.prepare(`
      SELECT n.id, COALESCE(n.main_subject, '') || ' ' || COALESCE(n.core_story, '') || ' ' || COALESCE(n.scene_context, '') || ' ' || COALESCE(n.action_behavior, '') as text
      FROM narratives n
      WHERE n.id NOT IN (SELECT rowid FROM narrative_vec)
      ORDER BY n.id ASC
      LIMIT ?
    `).all(limit * 2) as { id: number; text: string }[];

    if (!excludeIds || excludeIds.size === 0) return rows.slice(0, limit);
    return rows.filter((r) => !excludeIds.has(r.id)).slice(0, limit);
  }

  private storeVectors(items: { id: number; vector: Float32Array }[]): void {
    const getPublishTime = this.db.prepare('SELECT publish_time FROM narratives WHERE id = ?');
    this.db.transaction(() => {
      for (const item of items) {
        const id = Number(item.id);
        if (!Number.isInteger(id)) {
          this.logger.error(`跳过非法 id: ${item.id} (type=${typeof item.id})`);
          continue;
        }
        const row = getPublishTime.get(id) as { publish_time: string | null } | undefined;
        const publishTime = row?.publish_time ?? '';
        this.db.prepare(`INSERT INTO narrative_vec (rowid, embedding, publish_time) VALUES (${id}, vec_f32(?), ?)`).run(JSON.stringify(Array.from(item.vector)), publishTime);
      }
    })();
  }

  private emitProgress(progress: EmbeddingProgress): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.EMBEDDING_PROGRESS, progress);
    }
  }
}
