import { Worker } from 'worker_threads';
import type BetterSqlite3 from 'better-sqlite3';
import type { Logger } from 'electron-log';
import type { ClusterOptions, ClusterResult, ClusteringResult, NarrativeRow } from '../../shared/types';

export class ClusteringService {
  constructor(
    private db: BetterSqlite3.Database,
    private logger: Logger,
  ) {}

  async runClustering(options: ClusterOptions): Promise<ClusteringResult> {
    const rows = this.db.prepare(`
      SELECT nv.rowid as id, nv.embedding
      FROM narrative_vec nv
      JOIN narratives n ON n.id = nv.rowid
      WHERE n.publish_time >= ? AND n.publish_time <= ?
    `).all(options.timeStart, options.timeEnd) as { id: number; embedding: Buffer }[];

    if (rows.length === 0) {
      return { clusters: [], noiseCount: 0, totalItems: 0, parameters: options };
    }

    const vectors: number[][] = rows.map((r) => {
      const buf = r.embedding;
      return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
    });
    const ids = rows.map((r) => r.id);

    const minClusterSize = options.minClusterSize || 3;
    const reducedDims = options.reducedDimensions || 0;
    const result = await this.runHdbscanWorker(vectors, {
      minClusterSize,
      minSamples: options.minSamples ?? 2,
    }, reducedDims, options.umapNNeighbors, options.umapMinDist);
    this.logger.info(`聚类参数: 原始${vectors[0].length}d → UMAP${result.reducedDims}d, minCluster=${minClusterSize}, minSamples=${options.minSamples ?? 2}`);

    const labels = result.labels;
    const clusterMap = new Map<number, number[]>();
    let noiseCount = 0;
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      if (label === -1 || label === undefined) {
        noiseCount++;
        continue;
      }
      if (!clusterMap.has(label)) clusterMap.set(label, []);
      clusterMap.get(label)!.push(ids[i]);
    }

    const clusters: ClusterResult[] = [];
    for (const [label, narrativeIds] of clusterMap) {
      const placeholders = narrativeIds.map(() => '?').join(',');
      const narrRows = this.db.prepare(`
        SELECT main_subject, sentiment_score, narrative_intensity, narrative_trend, publish_time
        FROM narratives WHERE id IN (${placeholders})
      `).all(...narrativeIds) as any[];

      const subjects = narrRows.map((r) => r.main_subject).filter(Boolean);
      const sentiments = narrRows.map((r) => r.sentiment_score).filter((s): s is number => s != null);
      const intensities = narrRows.map((r) => r.narrative_intensity).filter((v): v is number => v != null);
      const trends = narrRows.map((r) => r.narrative_trend).filter(Boolean);

      const trendCounts = new Map<string, number>();
      for (const t of trends) trendCounts.set(t, (trendCounts.get(t) || 0) + 1);
      const dominantTrend = [...trendCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

      const times = narrRows.map((r) => r.publish_time).filter(Boolean).sort();

      clusters.push({
        clusterId: label,
        size: narrativeIds.length,
        centroidSubject: subjects[0] || '(无主题)',
        narrativeIds,
        avgSentiment: sentiments.length > 0 ? sentiments.reduce((a, b) => a + b, 0) / sentiments.length : null,
        avgIntensity: intensities.length > 0 ? intensities.reduce((a, b) => a + b, 0) / intensities.length : null,
        dominantTrend,
        timeRange: {
          start: times[0] || options.timeStart,
          end: times[times.length - 1] || options.timeEnd,
        },
      });
    }

    clusters.sort((a, b) => b.size - a.size);
    return { clusters, noiseCount, totalItems: rows.length, parameters: options, pcaReducedDims: result.reducedDims };
  }

  getClusterDetails(narrativeIds: number[]): NarrativeRow[] {
    if (!narrativeIds || narrativeIds.length === 0) return [];
    const placeholders = narrativeIds.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT * FROM narratives WHERE id IN (${placeholders})`).all(...narrativeIds) as any[];
    return rows.map((row) => ({
      id: row.id,
      narrative_id: row.narrative_id,
      raw_id: row.raw_id,
      publish_time: row.publish_time,
      source: row.source,
      text_type: row.text_type,
      main_subject: row.main_subject,
      core_story: row.core_story,
      actor_list: typeof row.actor_list === 'string' ? JSON.parse(row.actor_list) : row.actor_list || [],
      action_behavior: row.action_behavior,
      scene_context: row.scene_context,
      narrative_mode: row.narrative_mode,
      narrative_trend: row.narrative_trend,
      narrative_firmness: row.narrative_firmness,
      keyword_core: typeof row.keyword_core === 'string' ? JSON.parse(row.keyword_core) : row.keyword_core || [],
      direct_causal_chain: typeof row.direct_causal_chain === 'string' ? JSON.parse(row.direct_causal_chain) : row.direct_causal_chain || [],
      potential_risk_benefit: typeof row.potential_risk_benefit === 'string' ? JSON.parse(row.potential_risk_benefit) : row.potential_risk_benefit || [],
      sentiment_score: row.sentiment_score,
      narrative_intensity: row.narrative_intensity,
      affected_targets: typeof row.affected_targets === 'string' ? JSON.parse(row.affected_targets) : row.affected_targets || [],
      narrative_link: typeof row.narrative_link === 'string' ? JSON.parse(row.narrative_link) : row.narrative_link || [],
      extracted_at: row.extracted_at,
      model_version: row.model_version,
      retry_count: row.retry_count ?? 0,
      synced_at: row.synced_at,
    }));
  }

  private runHdbscanWorker(vectors: number[][], params: { minClusterSize: number; minSamples?: number }, reducedDims: number, umapNNeighbors?: number, umapMinDist?: number): Promise<{ labels: number[]; reducedDims: number }> {
    return new Promise((resolve, reject) => {
      const workerCode = `
        const { HDBSCAN } = require('hdbscan-ts');
        const { UMAP } = require('umap-js');
        const { parentPort, workerData } = require('worker_threads');
        try {
          const { vectors, params, reducedDims, umapNNeighbors, umapMinDist } = workerData;
          let data = vectors;
          let actualDims = vectors[0].length;
          if (reducedDims && reducedDims < vectors[0].length && vectors.length > reducedDims) {
            const umap = new UMAP({
              nComponents: Math.min(reducedDims, vectors.length - 1),
              nNeighbors: Math.min(umapNNeighbors || 15, vectors.length - 1),
              minDist: umapMinDist ?? 0.1,
            });
            data = umap.fit(vectors);
            actualDims = data[0].length;
          }
          const hdbscan = new HDBSCAN(params);
          const labels = hdbscan.fit(data);
          parentPort.postMessage({ labels, reducedDims: actualDims });
        } catch (err) {
          parentPort.postMessage({ __error: err.message });
        }
      `;
      const worker = new Worker(workerCode, {
        eval: true,
        workerData: { vectors, params, reducedDims, umapNNeighbors, umapMinDist },
      });
      worker.on('message', (result) => {
        if (result && result.__error) {
          reject(new Error(result.__error));
        } else {
          resolve({ labels: result.labels, reducedDims: result.reducedDims });
        }
        worker.terminate();
      });
      worker.on('error', (err) => {
        reject(err);
        worker.terminate();
      });
    });
  }
}
