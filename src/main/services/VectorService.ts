import type BetterSqlite3 from 'better-sqlite3';
import type { Logger } from 'electron-log';
import type { EmbeddingProviderConfig, VectorSearchOptions, VectorSearchResult } from '../../shared/types';

export class VectorService {
  constructor(
    private db: BetterSqlite3.Database,
    private logger: Logger,
    private getConfig: () => EmbeddingProviderConfig | null,
    private embedTexts: (texts: string[]) => Promise<Float32Array[]>,
  ) {}

  async search(options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const config = this.getConfig();
    if (!config || (config.provider !== 'ollama' && !config.apiKey)) throw new Error('Embedding provider not configured');

    const [queryVector] = await this.embedTexts([options.queryText]);

    const limit = options.limit ?? 20;

    const conditions: string[] = ['nv.embedding MATCH ?', 'k = ?'];
    const params: any[] = [Buffer.from(queryVector.buffer), limit];

    if (options.timeStart) {
      conditions.push('nv.publish_time >= ?');
      params.push(options.timeStart);
    }
    if (options.timeEnd) {
      conditions.push('nv.publish_time <= ?');
      params.push(options.timeEnd);
    }

    const where = conditions.join(' AND ');

    const rows = this.db.prepare(`
      SELECT
        nv.rowid as id,
        nv.distance,
        n.narrative_id,
        n.main_subject,
        n.core_story,
        n.publish_time,
        n.narrative_trend,
        n.sentiment_score
      FROM narrative_vec nv
      JOIN narratives n ON n.id = nv.rowid
      WHERE ${where}
      ORDER BY nv.distance
    `).all(...params) as any[];

    return rows.map((row: any) => ({
      id: row.id,
      narrative_id: row.narrative_id,
      distance: row.distance,
      main_subject: row.main_subject,
      core_story: row.core_story,
      publish_time: row.publish_time,
      narrative_trend: row.narrative_trend,
      sentiment_score: row.sentiment_score,
    }));
  }
}
