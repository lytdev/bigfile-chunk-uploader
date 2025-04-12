import ConcurrentStrategy from '../strategies/ConcurrentStrategy';
import { EndpointConfig, UploadOptions, UploadStrategy } from 'src/types';
import { DEFAULT_CHUNK_SIZE, DEFAULT_CONCURRENT, DEFAULT_MAX_RETRIES } from 'src/constants';

class BigFileUploader {
  private file: File;
  private baseURL: string;
  private endpoints: EndpointConfig
  private chunkSize: number;
  private concurrent: number;
  private headers: Record<string, string>;
  private withCredentials: boolean;
  private maxRetries: number;
  private onProgress: (progress: number) => void;
  private onError: (error: Error) => void;
  private onSuccess: (response: any) => void;
  private onChunkSuccess: (chunkIndex: number, response: any) => void;

  private strategy: UploadStrategy | null = null;

  constructor(options: UploadOptions) {
    this.file = options.file;
    this.baseURL = options.baseURL;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE; // 默认5MB
    this.concurrent = options.concurrent || DEFAULT_CONCURRENT;
    this.headers = options.headers || {};
    this.withCredentials = options.withCredentials || false;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.endpoints = options.endpoints || {};
    this.onProgress = options.onProgress || (() => { });
    this.onError = options.onError || (() => { });
    this.onSuccess = options.onSuccess || (() => { });
    this.onChunkSuccess = options.onChunkSuccess || (() => { });
  }

  /**
   * 开始上传
   */
  async start(): Promise<void> {
    try {
      this.strategy = this.createStrategy();
      await this.strategy.execute();
    } catch (error) {
      if (error instanceof Error) {
        this.onError(error);
      } else {
        this.onError(new Error('Unknown error occurred'));
      }
    }
  }

  /**
   * 暂停上传
   */
  pause(): void {
    if (this.strategy) {
      this.strategy.pause();
    }
  }

  /**
   * 继续上传
   */
  resume(): void {
    if (this.strategy) {
      this.strategy.resume();
    }
  }

  /**
   * 中止上传
   */
  abort(): void {
    if (this.strategy) {
      this.strategy.abort();
    }
  }

  /**
   * 创建上传策略
   */
  private createStrategy(): UploadStrategy {
    return new ConcurrentStrategy({
      file: this.file,
      baseURL: this.baseURL,
      endpoints: this.endpoints,
      chunkSize: this.chunkSize,
      concurrent: this.concurrent,
      headers: this.headers,
      withCredentials: this.withCredentials,
      maxRetries: this.maxRetries,
      onProgress: this.onProgress,
      onError: this.onError,
      onSuccess: this.onSuccess,
      onChunkSuccess: this.onChunkSuccess
    });
  }
}

export default BigFileUploader;