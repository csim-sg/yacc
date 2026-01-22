export interface BulkActionResponse {
  succeeded: string[];
  failed: Array<{ id: string; error: string }>;
}
