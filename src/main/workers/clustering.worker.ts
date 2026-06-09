import { parentPort, workerData } from 'worker_threads';
import { HDBSCAN } from 'hdbscan-ts';
import { UMAP } from 'umap-js';

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
  parentPort!.postMessage({ labels, reducedDims: actualDims });
} catch (err: any) {
  parentPort!.postMessage({ __error: err.message });
}
