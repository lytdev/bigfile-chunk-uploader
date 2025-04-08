import ChunkManager from './ChunkManager';
import NetworkClient from './NetworkClient';
import ConcurrentStrategy from '../strategies/ConcurrentStrategy';
import { UploadOptions, UploadStrategy } from 'src/types';

class BigFileUploader {
  private file: File;
  private url: string;
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
    this.url = options.url;
    this.chunkSize = options.chunkSize || 5 * 1024 * 1024; // 默认5MB
    this.concurrent = options.concurrent || 3;
    this.headers = options.headers || {};
    this.withCredentials = options.withCredentials || false;
    this.maxRetries = options.maxRetries || 3;
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
      url: this.url,
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