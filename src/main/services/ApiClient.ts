import type {
  RemoteStats,
  RemoteRawListResponse,
  RemoteNarrativeListResponse,
  RemoteRawItem,
  RemoteNarrativeItem,
} from '../../shared/types';

const DEFAULT_BASE_URL = 'http://124.222.117.105:8900';
const TIMEOUT_MS = 30_000;

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
      }
      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async getStats(): Promise<RemoteStats> {
    return this.request<RemoteStats>('/api/stats');
  }

  async getRawList(limit: number, offset: number, level?: string): Promise<RemoteRawListResponse> {
    return this.request<RemoteRawListResponse>('/api/raw', { limit, offset, level });
  }

  async getRaw(id: number): Promise<RemoteRawItem> {
    return this.request<RemoteRawItem>(`/api/raw/${id}`);
  }

  async getNarrativeList(params: {
    limit: number;
    offset: number;
    text_type?: string;
    narrative_mode?: string;
    narrative_trend?: string;
    narrative_firmness?: string;
    sentiment_min?: number;
    sentiment_max?: number;
    intensity_min?: number;
    intensity_max?: number;
  }): Promise<RemoteNarrativeListResponse> {
    return this.request<RemoteNarrativeListResponse>('/api/narrative', params);
  }

  async getNarrative(narrativeId: string): Promise<RemoteNarrativeItem> {
    return this.request<RemoteNarrativeItem>(`/api/narrative/${encodeURIComponent(narrativeId)}`);
  }

  async getNarrativeByRawId(rawId: number): Promise<RemoteNarrativeItem> {
    return this.request<RemoteNarrativeItem>(`/api/raw/${rawId}/narrative`);
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request<{ status: string }>('/health');
  }
}
