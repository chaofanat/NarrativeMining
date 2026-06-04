import type BetterSqlite3 from 'better-sqlite3';
import type { NarrativeQueryOptions, NarrativeRow, PaginatedResult } from '../../shared/types';

export class NarrativeService {
  constructor(private db: BetterSqlite3.Database) {}

  list(options: NarrativeQueryOptions = {}): PaginatedResult<NarrativeRow> {
    const {
      limit = 20,
      offset = 0,
      text_type,
      narrative_mode,
      narrative_trend,
      narrative_firmness,
      sentiment_min,
      sentiment_max,
      intensity_min,
      intensity_max,
      search,
    } = options;

    if (search && search.trim()) {
      return this.searchWithFts(search, limit, offset, {
        text_type, narrative_mode, narrative_trend, narrative_firmness,
        sentiment_min, sentiment_max, intensity_min, intensity_max,
      });
    }

    const conditions: string[] = [];
    const params: any[] = [];

    this.appendFilters(conditions, params, options);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM narratives ${where}`).get(...params) as { c: number }).c;

    const rows = this.db.prepare(
      `SELECT * FROM narratives ${where} ORDER BY publish_time DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    return { total, items: rows.map((row) => this.parseRow(row)) };
  }

  private searchWithFts(
    search: string,
    limit: number,
    offset: number,
    filters: Omit<NarrativeQueryOptions, 'search' | 'limit' | 'offset'>,
  ): PaginatedResult<NarrativeRow> {
    const conditions: string[] = ['n.id = f.row_id', 'narratives_fts MATCH ?'];
    const params: any[] = [toFtsQuery(search)];

    this.appendFilters(conditions, params, filters);

    const where = conditions.join(' AND ');

    const total = (this.db.prepare(
      `SELECT COUNT(*) as c FROM narratives n, narratives_fts f WHERE ${where}`,
    ).get(...params) as { c: number }).c;

    const rows = this.db.prepare(
      `SELECT n.* FROM narratives n, narratives_fts f WHERE ${where} ORDER BY n.publish_time DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    return { total, items: rows.map((row) => this.parseRow(row)) };
  }

  private appendFilters(
    conditions: string[],
    params: any[],
    filters: Omit<NarrativeQueryOptions, 'search' | 'limit' | 'offset'>,
  ): void {
    const prefixed = conditions.some((c) => c.startsWith('n.'));
    const p = prefixed ? 'n.' : '';

    if (filters.text_type) {
      conditions.push(`${p}text_type = ?`);
      params.push(filters.text_type);
    }
    if (filters.narrative_mode) {
      conditions.push(`${p}narrative_mode = ?`);
      params.push(filters.narrative_mode);
    }
    if (filters.narrative_trend) {
      conditions.push(`${p}narrative_trend = ?`);
      params.push(filters.narrative_trend);
    }
    if (filters.narrative_firmness) {
      conditions.push(`${p}narrative_firmness = ?`);
      params.push(filters.narrative_firmness);
    }
    if (filters.sentiment_min !== undefined) {
      conditions.push(`${p}sentiment_score >= ?`);
      params.push(filters.sentiment_min);
    }
    if (filters.sentiment_max !== undefined) {
      conditions.push(`${p}sentiment_score <= ?`);
      params.push(filters.sentiment_max);
    }
    if (filters.intensity_min !== undefined) {
      conditions.push(`${p}narrative_intensity >= ?`);
      params.push(filters.intensity_min);
    }
    if (filters.intensity_max !== undefined) {
      conditions.push(`${p}narrative_intensity <= ?`);
      params.push(filters.intensity_max);
    }
  }

  getByNarrativeId(narrativeId: string): NarrativeRow | null {
    const row = this.db.prepare('SELECT * FROM narratives WHERE narrative_id = ?').get(narrativeId) as any;
    return row ? this.parseRow(row) : null;
  }

  getByRawId(rawId: number): NarrativeRow | null {
    const row = this.db.prepare('SELECT * FROM narratives WHERE raw_id = ?').get(rawId) as any;
    return row ? this.parseRow(row) : null;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM narratives').get() as { c: number }).c;
  }

  private parseRow(row: any): NarrativeRow {
    const jsonFields = [
      'actor_list',
      'keyword_core',
      'direct_causal_chain',
      'potential_risk_benefit',
      'affected_targets',
      'narrative_link',
    ] as const;

    const parsed = { ...row };
    for (const field of jsonFields) {
      parsed[field] = typeof row[field] === 'string' ? JSON.parse(row[field]) : row[field] || [];
    }
    return parsed;
  }
}

function toFtsQuery(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      if (/[\s"()*\-:.]/.test(t)) {
        return `"${t.replace(/"/g, '""')}"`;
      }
      return `${t}*`;
    })
    .join(' ');
}
