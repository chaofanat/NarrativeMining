import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type BetterSqlite3 from 'better-sqlite3';
import type { Logger } from 'electron-log';
import type { SyncState, SyncProgress } from '../../shared/types';
import { extractRawFtsText, extractNarrativeFtsText } from '../database';
import { ApiClient } from './ApiClient';

const BATCH_SIZE = 50;

export class SyncService {
  private syncing = false;
  private cancelled = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private db: BetterSqlite3.Database,
    private apiClient: ApiClient,
    private logger: Logger,
    private getAutoSync: () => boolean,
    private getSyncInterval: () => number,
    private onSyncComplete?: () => void,
  ) {}

  startAutoSync(): void {
    this.stopAutoSync();

    const autoSync = this.getAutoSync();
    const intervalMin = this.getSyncInterval();

    if (!autoSync) {
      this.logger.info('自动同步已关闭');
      return;
    }

    const intervalMs = intervalMin * 60 * 1000;
    this.logger.info(`自动同步已启动，间隔 ${intervalMin} 分钟`);

    // 启动时立即同步一次
    this.startSync().catch((err) => {
      this.logger.error(`启动同步失败: ${err instanceof Error ? err.message : err}`);
    });

    this.timer = setInterval(() => {
      if (!this.syncing) {
        this.startSync().catch((err) => {
          this.logger.error(`定时同步失败: ${err instanceof Error ? err.message : err}`);
        });
      }
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.logger.info('自动同步已停止');
    }
  }

  restartAutoSync(): void {
    this.startAutoSync();
  }

  private emitProgress(progress: SyncProgress): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.SYNC_PROGRESS, progress);
    }
  }

  getSyncState(): SyncState {
    const get = this.db.prepare('SELECT value FROM sync_state WHERE key = ?');

    const lastSyncTime = get.get('lastSyncTime') as { value: string } | undefined;
    const rawCount = this.db.prepare('SELECT COUNT(*) as c FROM raw_messages').get() as { c: number };
    const narrativeCount = this.db.prepare('SELECT COUNT(*) as c FROM narratives').get() as { c: number };

    return {
      lastSyncTime: lastSyncTime?.value ?? null,
      rawCount: rawCount.c,
      narrativeCount: narrativeCount.c,
      isSyncing: this.syncing,
    };
  }

  private setSyncState(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run(key, value);
  }

  async startSync(): Promise<SyncState> {
    if (this.syncing) {
      this.logger.warn('同步已在进行中');
      return this.getSyncState();
    }

    this.syncing = true;
    this.cancelled = false;

    try {
      this.logger.info('开始数据同步...');

      // 同步原始数据
      await this.syncRawMessages();

      if (this.cancelled) {
        this.logger.info('同步已取消');
        return this.getSyncState();
      }

      // 同步叙事数据
      await this.syncNarratives();

      if (this.cancelled) {
        this.logger.info('同步已取消');
        return this.getSyncState();
      }

      // 对账：补全叙事引用但本地缺失的原始消息
      await this.reconcileMissingRawMessages();

      if (this.cancelled) {
        this.logger.info('同步已取消');
        return this.getSyncState();
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      this.setSyncState('lastSyncTime', localTime);
      this.emitProgress({ phase: 'done', fetched: 0, total: 0, message: '同步完成' });
      this.logger.info('数据同步完成');

      if (this.onSyncComplete) {
        this.onSyncComplete();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`同步失败: ${message}`);
      this.emitProgress({ phase: 'error', fetched: 0, total: 0, message });
      throw error;
    } finally {
      this.syncing = false;
    }

    return this.getSyncState();
  }

  private async syncRawMessages(): Promise<void> {
    const stats = await this.apiClient.getStats();
    const totalRemote = stats.raw_count;

    if (totalRemote === 0) return;

    // 读取上次同步后的最大 id，用于增量判断
    const lastMaxRow = this.db.prepare('SELECT value FROM sync_state WHERE key = ?').get('max_raw_id') as { value: string } | undefined;
    const lastMaxId = lastMaxRow ? Number(lastMaxRow.value) : 0;

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO raw_messages (id, level, time, title, brief, content, stocks, subjects, received_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO raw_messages_fts (rowid, row_id, text) VALUES (?, ?, ?)
    `);

    const insertBatch = this.db.transaction((items: any[]) => {
      for (const item of items) {
        insertStmt.run(
          item.id,
          item.level || null,
          item.time || null,
          item.title || '',
          item.brief || null,
          item.content || null,
          JSON.stringify(item.stocks || []),
          JSON.stringify(item.subjects || []),
          item.received_at != null ? String(item.received_at) : null,
        );
        insertFts.run(item.id, item.id, extractRawFtsText(item));
      }
    });

    let fetched = 0;
    let batchNew = 0; // 本批次中有多少条新记录
    let offset = 0;

    while (offset < totalRemote) {
      if (this.cancelled) return;

      const limit = Math.min(BATCH_SIZE, totalRemote - offset);
      const response = await this.apiClient.getRawList(limit, offset);
      const items = response.items;

      if (items.length === 0) break;

      // 检查本批次是否包含已同步的记录（id <= lastMaxId）
      batchNew = 0;
      for (const item of items) {
        if (item.id > lastMaxId) {
          batchNew++;
        }
      }

      if (batchNew > 0) {
        insertBatch(items);
        fetched += batchNew;
      }

      this.emitProgress({
        phase: 'raw',
        fetched: offset + items.length,
        total: totalRemote,
        message: lastMaxId === 0
          ? `全量同步原始数据 ${offset + items.length}/${totalRemote}`
          : `增量同步原始数据 +${fetched} 条`,
      });

      this.logger.info(`原始数据: offset=${offset}, 本批${items.length}条, 新增${batchNew}条`);

      // 如果本批次全部是旧记录（id 都 <= lastMaxId），说明增量同步完成
      if (batchNew === 0) break;

      offset += items.length;
    }

    // 更新 max_raw_id
    const maxRow = this.db.prepare('SELECT MAX(id) as m FROM raw_messages').get() as { m: number | null };
    if (maxRow.m != null) {
      this.setSyncState('max_raw_id', String(maxRow.m));
    }

    this.logger.info(`原始数据同步完成, 新增 ${fetched} 条`);
  }

  private async syncNarratives(): Promise<void> {
    const stats = await this.apiClient.getStats();
    const totalRemote = stats.narrative_count;

    if (totalRemote === 0) return;

    const lastMaxRow = this.db.prepare('SELECT value FROM sync_state WHERE key = ?').get('max_narrative_id') as { value: string } | undefined;
    const lastMaxId = lastMaxRow ? Number(lastMaxRow.value) : 0;

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO narratives (
        id, narrative_id, raw_id, publish_time, source, text_type, main_subject, core_story,
        actor_list, action_behavior, scene_context, narrative_mode, narrative_trend,
        narrative_firmness, keyword_core, direct_causal_chain, potential_risk_benefit,
        sentiment_score, narrative_intensity, affected_targets, narrative_link,
        extracted_at, model_version, retry_count, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO narratives_fts (rowid, row_id, text) VALUES (?, ?, ?)
    `);

    const prevFk = this.db.pragma('foreign_keys', { simple: true });
    this.db.pragma('foreign_keys = OFF');
    try {
    const insertBatch = this.db.transaction((items: any[]) => {
      for (const item of items) {
        insertStmt.run(
          item.id,
          item.narrative_id,
          item.raw_id || null,
          item.publish_time || null,
          item.source || null,
          item.text_type || null,
          item.main_subject || null,
          item.core_story || null,
          JSON.stringify(item.actor_list || []),
          item.action_behavior || null,
          item.scene_context || null,
          item.narrative_mode || null,
          item.narrative_trend || null,
          item.narrative_firmness || null,
          JSON.stringify(item.keyword_core || []),
          JSON.stringify(item.direct_causal_chain || []),
          JSON.stringify(item.potential_risk_benefit || []),
          item.sentiment_score ?? null,
          item.narrative_intensity ?? null,
          JSON.stringify(item.affected_targets || []),
          JSON.stringify(item.narrative_link || []),
          item.extracted_at != null ? String(item.extracted_at) : null,
          item.model_version || null,
          item.retry_count ?? 0,
        );
        insertFts.run(item.id, item.id, extractNarrativeFtsText(item));
      }
    });

    let fetched = 0;
    let offset = 0;

    while (offset < totalRemote) {
      if (this.cancelled) return;

      const limit = Math.min(BATCH_SIZE, totalRemote - offset);
      const response = await this.apiClient.getNarrativeList({ limit, offset });
      const items = response.items;

      if (items.length === 0) break;

      const batchNew = items.filter((item: any) => item.id > lastMaxId).length;

      if (batchNew > 0) {
        insertBatch(items);
        fetched += batchNew;
      }

      this.emitProgress({
        phase: 'narrative',
        fetched: offset + items.length,
        total: totalRemote,
        message: lastMaxId === 0
          ? `全量同步叙事数据 ${offset + items.length}/${totalRemote}`
          : `增量同步叙事数据 +${fetched} 条`,
      });

      this.logger.info(`叙事数据: offset=${offset}, 本批${items.length}条, 新增${batchNew}条`);

      if (batchNew === 0) break;

      offset += items.length;
    }

    const maxRow = this.db.prepare('SELECT MAX(id) as m FROM narratives').get() as { m: number | null };
    if (maxRow.m != null) {
      this.setSyncState('max_narrative_id', String(maxRow.m));
    }

    this.logger.info(`叙事数据同步完成, 新增 ${fetched} 条`);
    } finally {
      this.db.pragma(`foreign_keys = ${prevFk}`);
    }
  }

  /** 对账：查找叙事引用了但本地缺失的原始消息，逐条从远程补全 */
  private async reconcileMissingRawMessages(): Promise<void> {
    const orphans = this.db.prepare(
      `SELECT DISTINCT raw_id FROM narratives
       WHERE raw_id IS NOT NULL AND raw_id NOT IN (SELECT id FROM raw_messages)`,
    ).all() as { raw_id: number }[];

    if (orphans.length === 0) return;

    this.logger.info(`对账发现 ${orphans.length} 条缺失的原始消息，开始补全...`);
    this.emitProgress({ phase: 'raw', fetched: 0, total: orphans.length, message: `对账补全原始消息 0/${orphans.length}` });

    const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO raw_messages (id, level, time, title, brief, content, stocks, subjects, received_at, synced_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    const insertFts = this.db.prepare(`
      INSERT OR REPLACE INTO raw_messages_fts (rowid, row_id, text) VALUES (?, ?, ?)
    `);

    let patched = 0;
    for (const { raw_id } of orphans) {
      if (this.cancelled) return;

      try {
        const item = await this.apiClient.getRaw(raw_id);
        const receivedAt = item.received_at != null ? String(item.received_at) : null;
        insertStmt.run(
          item.id,
          item.level || null,
          item.time || null,
          item.title || '',
          item.brief || null,
          item.content || null,
          JSON.stringify(item.stocks || []),
          JSON.stringify(item.subjects || []),
          receivedAt,
        );
        insertFts.run(item.id, item.id, extractRawFtsText({ ...item, received_at: receivedAt }));
        patched++;
      } catch (err) {
        this.logger.error(`对账补全 raw_id=${raw_id} 失败: ${err instanceof Error ? err.message : err}`);
      }

      this.emitProgress({
        phase: 'raw',
        fetched: patched,
        total: orphans.length,
        message: `对账补全原始消息 ${patched}/${orphans.length}`,
      });
    }

    this.logger.info(`对账补全完成，成功 ${patched}/${orphans.length} 条`);
  }

  cancelSync(): void {
    this.cancelled = true;
    this.logger.info('已请求取消同步');
  }
}
