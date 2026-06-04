import type BetterSqlite3 from 'better-sqlite3';
import type { RawQueryOptions, RawMessageRow, PaginatedResult } from '../../shared/types';

export class RawMessageService {
  constructor(private db: BetterSqlite3.Database) {}

  list(options: RawQueryOptions = {}): PaginatedResult<RawMessageRow> {
    const { limit = 20, offset = 0, level, search } = options;

    if (search && search.trim()) {
      return this.searchWithFts(search, limit, offset, level);
    }

    const conditions: string[] = [];
    const params: any[] = [];

    if (level) {
      conditions.push('level = ?');
      params.push(level);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM raw_messages ${where}`).get(...params) as { c: number }).c;

    const rows = this.db.prepare(
      `SELECT * FROM raw_messages ${where} ORDER BY time DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    return { total, items: rows.map((row) => this.parseRow(row)) };
  }

  private searchWithFts(search: string, limit: number, offset: number, level?: string): PaginatedResult<RawMessageRow> {
    const conditions: string[] = ['r.id = f.row_id', 'raw_messages_fts MATCH ?'];
    const params: any[] = [toFtsQuery(search)];

    if (level) {
      conditions.push('r.level = ?');
      params.push(level);
    }

    const where = conditions.join(' AND ');

    const total = (this.db.prepare(
      `SELECT COUNT(*) as c FROM raw_messages r, raw_messages_fts f WHERE ${where}`,
    ).get(...params) as { c: number }).c;

    const rows = this.db.prepare(
      `SELECT r.* FROM raw_messages r, raw_messages_fts f WHERE ${where} ORDER BY r.time DESC LIMIT ? OFFSET ?`,
    ).all(...params, limit, offset) as any[];

    return { total, items: rows.map((row) => this.parseRow(row)) };
  }

  getById(id: number): RawMessageRow | null {
    const row = this.db.prepare('SELECT * FROM raw_messages WHERE id = ?').get(id) as any;
    return row ? this.parseRow(row) : null;
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM raw_messages').get() as { c: number }).c;
  }

  private parseRow(row: any): RawMessageRow {
    return {
      ...row,
      stocks: typeof row.stocks === 'string' ? JSON.parse(row.stocks) : row.stocks || [],
      subjects: typeof row.subjects === 'string' ? JSON.parse(row.subjects) : row.subjects || [],
    };
  }
}

function toFtsQuery(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => {
      // 含特殊字符时用引号包裹（短语匹配），否则用裸词前缀
      if (/[\s"()*\-:.]/.test(t)) {
        return `"${t.replace(/"/g, '""')}"`;
      }
      return `${t}*`;
    })
    .join(' ');
}
