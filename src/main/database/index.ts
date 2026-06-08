import { app } from 'electron';
import path from 'path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import type { Logger } from 'electron-log';

let db: Database.Database | null = null;

export function setupDatabase(logger: Logger, vecDimensions = 1536): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'narrative-mining.db');
  logger.info(`数据库路径: ${dbPath}`);

  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  sqliteVec.load(db);
  logger.info('sqlite-vec 扩展已加载');

  db.exec(`
    CREATE TABLE IF NOT EXISTS raw_messages (
      id              INTEGER PRIMARY KEY,
      level           TEXT,
      time            TEXT,
      title           TEXT NOT NULL DEFAULT '',
      brief           TEXT,
      content         TEXT,
      stocks          TEXT DEFAULT '[]',
      subjects        TEXT DEFAULT '[]',
      received_at     TEXT,
      synced_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS narratives (
      id                    INTEGER PRIMARY KEY,
      narrative_id          TEXT NOT NULL UNIQUE,
      raw_id                INTEGER,
      publish_time          TEXT,
      source                TEXT,
      text_type             TEXT,
      main_subject          TEXT,
      core_story            TEXT,
      actor_list            TEXT DEFAULT '[]',
      action_behavior       TEXT,
      scene_context         TEXT,
      narrative_mode        TEXT,
      narrative_trend       TEXT,
      narrative_firmness    TEXT,
      keyword_core          TEXT DEFAULT '[]',
      direct_causal_chain   TEXT DEFAULT '[]',
      potential_risk_benefit TEXT DEFAULT '[]',
      sentiment_score       REAL,
      narrative_intensity   REAL,
      affected_targets      TEXT DEFAULT '[]',
      narrative_link        TEXT DEFAULT '[]',
      extracted_at          TEXT,
      model_version         TEXT,
      retry_count           INTEGER DEFAULT 0,
      synced_at             TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (raw_id) REFERENCES raw_messages(id)
    );

    CREATE TABLE IF NOT EXISTS sync_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_raw_time ON raw_messages(time);
    CREATE INDEX IF NOT EXISTS idx_raw_level ON raw_messages(level);
    CREATE INDEX IF NOT EXISTS idx_narrative_raw_id ON narratives(raw_id);
    CREATE INDEX IF NOT EXISTS idx_narrative_narrative_id ON narratives(narrative_id);
    CREATE INDEX IF NOT EXISTS idx_narrative_publish_time ON narratives(publish_time);
    CREATE INDEX IF NOT EXISTS idx_narrative_sentiment ON narratives(sentiment_score);
  `);

  // sqlite-vec: 按配置维度创建/重建 vec 表
  if (ensureVecDimensions(db, vecDimensions)) {
    logger.info(`向量维度已设置为 ${vecDimensions}`);
  }

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS raw_messages_fts USING fts5(
      row_id UNINDEXED,
      text,
      tokenize='unicode61'
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS narratives_fts USING fts5(
      row_id UNINDEXED,
      text,
      tokenize='unicode61'
    );
  `);

  logger.info('数据库初始化完成');
  return db;
}

/** 从原始消息中提取 FTS 全文索引文本 — 覆盖 raw_messages 全部字段 */
export function extractRawFtsText(item: {
  id?: number | null;
  level?: string | null;
  time?: string | null;
  title?: string | null;
  brief?: string | null;
  content?: string | null;
  stocks?: { name: string; code?: string; change?: string }[];
  subjects?: string[];
  received_at?: string | null;
  synced_at?: string | null;
}): string {
  const parts = [
    item.id != null ? String(item.id) : '',
    item.level || '',
    item.time || '',
    item.title || '',
    item.brief || '',
    item.content || '',
    item.received_at || '',
    item.synced_at || '',
    ...(item.subjects || []),
    ...(item.stocks || []).flatMap((s) => [s.name, s.code || '', s.change || '']),
  ];
  return parts.filter(Boolean).join(' ');
}

/** 从叙事分析中提取 FTS 全文索引文本 — 覆盖 narratives 全部字段 */
export function extractNarrativeFtsText(item: {
  id?: number | null;
  narrative_id?: string | null;
  raw_id?: number | null;
  publish_time?: string | null;
  source?: string | null;
  text_type?: string | null;
  main_subject?: string | null;
  core_story?: string | null;
  action_behavior?: string | null;
  scene_context?: string | null;
  narrative_mode?: string | null;
  narrative_trend?: string | null;
  narrative_firmness?: string | null;
  keyword_core?: string[];
  actor_list?: { name: string; role: string }[];
  affected_targets?: { name: string; target_type?: string; impact?: string }[];
  potential_risk_benefit?: { direction?: string; description: string; targets?: string[] }[];
  direct_causal_chain?: { cause: string; effect: string; confidence?: string }[];
  narrative_link?: { related_event: string; link_type?: string }[];
  sentiment_score?: number | null;
  narrative_intensity?: number | null;
  extracted_at?: string | null;
  model_version?: string | null;
  retry_count?: number | null;
  synced_at?: string | null;
}): string {
  const parts = [
    item.id != null ? String(item.id) : '',
    item.narrative_id || '',
    item.raw_id != null ? String(item.raw_id) : '',
    item.publish_time || '',
    item.source || '',
    item.text_type || '',
    item.main_subject || '',
    item.core_story || '',
    item.action_behavior || '',
    item.scene_context || '',
    item.narrative_mode || '',
    item.narrative_trend || '',
    item.narrative_firmness || '',
    item.sentiment_score != null ? String(item.sentiment_score) : '',
    item.narrative_intensity != null ? String(item.narrative_intensity) : '',
    item.extracted_at || '',
    item.model_version || '',
    item.retry_count != null ? String(item.retry_count) : '',
    item.synced_at || '',
    ...(item.keyword_core || []),
    ...(item.actor_list || []).map((a) => `${a.name} ${a.role}`),
    ...(item.affected_targets || []).flatMap((t) => [t.name, t.target_type || '', t.impact || '']),
    ...(item.potential_risk_benefit || []).flatMap((r) => [r.description, r.direction || '', ...(r.targets || [])]),
    ...(item.direct_causal_chain || []).flatMap((c) => [c.cause, c.effect, c.confidence || '']),
    ...(item.narrative_link || []).flatMap((l) => [l.related_event, l.link_type || '']),
  ];
  return parts.filter(Boolean).join(' ');
}

/** 全量重建 FTS 索引 — 仅用于首次初始化或数据恢复 */
export function rebuildFtsIndex(db: Database.Database): void {
  db.transaction(() => {
    db.exec('DELETE FROM raw_messages_fts');
    const insert = db.prepare('INSERT INTO raw_messages_fts (rowid, row_id, text) VALUES (?, ?, ?)');
    const rows = db.prepare('SELECT * FROM raw_messages').all() as any[];
    for (const row of rows) {
      insert.run(row.id, row.id, extractRawFtsText({
        id: row.id,
        level: row.level,
        time: row.time,
        title: row.title,
        brief: row.brief,
        content: row.content,
        stocks: typeof row.stocks === 'string' ? JSON.parse(row.stocks) : row.stocks || [],
        subjects: typeof row.subjects === 'string' ? JSON.parse(row.subjects) : row.subjects || [],
        received_at: row.received_at,
        synced_at: row.synced_at,
      }));
    }
  })();

  db.transaction(() => {
    db.exec('DELETE FROM narratives_fts');
    const insert = db.prepare('INSERT INTO narratives_fts (rowid, row_id, text) VALUES (?, ?, ?)');
    const rows = db.prepare('SELECT * FROM narratives').all() as any[];
    for (const row of rows) {
      insert.run(row.id, row.id, extractNarrativeFtsText({
        id: row.id,
        narrative_id: row.narrative_id,
        raw_id: row.raw_id,
        publish_time: row.publish_time,
        source: row.source,
        text_type: row.text_type,
        main_subject: row.main_subject,
        core_story: row.core_story,
        action_behavior: row.action_behavior,
        scene_context: row.scene_context,
        narrative_mode: row.narrative_mode,
        narrative_trend: row.narrative_trend,
        narrative_firmness: row.narrative_firmness,
        sentiment_score: row.sentiment_score,
        narrative_intensity: row.narrative_intensity,
        extracted_at: row.extracted_at,
        model_version: row.model_version,
        retry_count: row.retry_count,
        synced_at: row.synced_at,
        keyword_core: typeof row.keyword_core === 'string' ? JSON.parse(row.keyword_core) : row.keyword_core || [],
        actor_list: typeof row.actor_list === 'string' ? JSON.parse(row.actor_list) : row.actor_list || [],
        affected_targets: typeof row.affected_targets === 'string' ? JSON.parse(row.affected_targets) : row.affected_targets || [],
        potential_risk_benefit: typeof row.potential_risk_benefit === 'string' ? JSON.parse(row.potential_risk_benefit) : row.potential_risk_benefit || [],
        direct_causal_chain: typeof row.direct_causal_chain === 'string' ? JSON.parse(row.direct_causal_chain) : row.direct_causal_chain || [],
        narrative_link: typeof row.narrative_link === 'string' ? JSON.parse(row.narrative_link) : row.narrative_link || [],
      }));
    }
  })();
}

const FTS_VERSION = 5;

/** 检测 FTS 表膨胀或版本过期，按需重建 */
export function cleanupFtsIfBloated(db: Database.Database): void {
  const rawCount = (db.prepare('SELECT COUNT(*) as c FROM raw_messages').get() as { c: number }).c;
  const ftsRawCount = (db.prepare('SELECT COUNT(*) as c FROM raw_messages_fts').get() as { c: number }).c;

  const versionRow = db.prepare('SELECT value FROM sync_state WHERE key = ?').get('fts_version') as { value: string } | undefined;
  const currentVersion = versionRow ? Number(versionRow.value) : 0;

  if (ftsRawCount > rawCount * 1.2 || currentVersion < FTS_VERSION) {
    rebuildFtsIndex(db);
    db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run('fts_version', String(FTS_VERSION));
  }
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 setupDatabase()');
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function clearAllData(db: Database.Database): void {
  db.transaction(() => {
    db.exec('DELETE FROM raw_messages_fts');
    db.exec('DELETE FROM narratives_fts');
    db.exec('DELETE FROM narrative_vec');
    db.exec('DELETE FROM narratives');
    db.exec('DELETE FROM raw_messages');
    db.exec('DELETE FROM sync_state');
  })();
}

const VEC_SCHEMA_VERSION = 2;

export function ensureVecDimensions(db: Database.Database, dims: number): boolean {
  const dimRow = db.prepare("SELECT value FROM sync_state WHERE key = 'vec_dimensions'").get() as { value: string } | undefined;
  const storedDims = dimRow ? Number(dimRow.value) : 0;
  const verRow = db.prepare("SELECT value FROM sync_state WHERE key = 'vec_schema_version'").get() as { value: string } | undefined;
  const storedVer = verRow ? Number(verRow.value) : 0;

  if (storedDims === dims && storedVer >= VEC_SCHEMA_VERSION) return false;

  db.exec('DROP TABLE IF EXISTS narrative_vec');
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS narrative_vec USING vec0(embedding float[${dims}], publish_time text)`);
  db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('vec_dimensions', ?)").run(String(dims));
  db.prepare("INSERT OR REPLACE INTO sync_state (key, value) VALUES ('vec_schema_version', ?)").run(String(VEC_SCHEMA_VERSION));
  return true;
}
