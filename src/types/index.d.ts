export interface UploaderOptions {
  url: string;
  chunkSize?: number;
  maxConcurrent?: number;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
}