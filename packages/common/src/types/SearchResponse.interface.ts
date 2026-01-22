import type { SearchResult } from './SearchResult.interface';

export interface SearchResponse {
  data: SearchResult[];
  page: number;
  pageSize: number;
  total: number;
}
