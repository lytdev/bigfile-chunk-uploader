// 上传配置类型
export interface UploadOptions {
  file: File;
  url: string;
  chunkSize?: number;
  concurrent?: number;
  headers?: Record<string, string>;
  withCredentials?: boolean;
  maxRetries?: number;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  onSuccess?: (response: any) => void;
  onChunkSuccess?: (chunkIndex: number, response: any) => void;
}

// 分片状态类型
export type ChunkStatus = 'pending' | 'uploading' | 'completed' | 'failed';

// 分片信息类型
export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  blob: Blob;
  status: ChunkStatus;
  retries: number;
}

// 上传策略接口
export interface UploadStrategy {
  execute(): Promise<void>;
  pause(): void;
  resume(): void;
  abort(): void;
}