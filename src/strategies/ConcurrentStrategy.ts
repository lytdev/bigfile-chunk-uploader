import { UploadStrategy } from '../types';
import ChunkManager from '../core/ChunkManager';
import NetworkClient from '../core/NetworkClient';

interface ConcurrentStrategyOptions {
  file: File;
  url: string;
  chunkSize: number;
  concurrent: number;
  headers: Record<string, string>;
  withCredentials: boolean;
  maxRetries: number;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
  onSuccess: (response: any) => void;
  onChunkSuccess: (chunkIndex: number, response: any) => void;
}

export default class ConcurrentStrategy implements UploadStrategy {
  private chunkManager: ChunkManager;
  private networkClient: NetworkClient;
  private options: ConcurrentStrategyOptions;
  private activeConnections = 0;
  private paused = false;
  private aborted = false;
  private abortController: AbortController | null = null;

  constructor(options: ConcurrentStrategyOptions) {
    this.options = options;
    this.chunkManager = new ChunkManager(options.file, options.chunkSize);
    this.networkClient = new NetworkClient({
      url: options.url,
      headers: options.headers,
    });
  }

  async execute(): Promise<void> {
    this.abortController = new AbortController();

    try {
      // 1. 计算文件哈希
      await this.chunkManager.calculateFileHash(this.options.onProgress);

      // 2. 初始化上传
      const initResponse = await this.networkClient.initUpload(this.options.url, {
        fileName: this.options.file.name,
        fileSize: this.options.file.size,
        chunkSize: this.options.chunkSize,
        fileHash: this.chunkManager.fileHash
      });

      // 3. 上传分片
      await this.uploadChunks();

      // 4. 合并文件
      const mergeResponse = await this.networkClient.mergeChunks(this.options.url, {
        fileHash: this.chunkManager.fileHash,
        fileName: this.options.file.name
      });

      this.options.onSuccess(mergeResponse);
    } catch (error) {
      if (!this.aborted) {
        this.options.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  pause(): void {
    this.paused = true;
    this.abortController?.abort();
  }

  resume(): void {
    this.paused = false;
    this.abortController = new AbortController();
    this.uploadChunks().catch(this.options.onError);
  }

  abort(): void {
    this.aborted = true;
    this.abortController?.abort();
  }

  private async uploadChunks(): Promise<void> {
    const chunksToUpload = this.chunkManager.getPendingChunks();

    while (chunksToUpload.length > 0 && !this.paused && !this.aborted) {
      if (this.activeConnections >= this.options.concurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      const chunk = chunksToUpload.shift()!;
      this.activeConnections++;
      this.chunkManager.updateChunkStatus(chunk.index, 'uploading');

      try {
        const formData = new FormData();
        formData.append('file', chunk.blob);
        formData.append('chunkIndex', String(chunk.index));
        formData.append('fileHash', this.chunkManager.fileHash!);

        const response = await this.networkClient.uploadChunk(this.options.url, formData, {
          signal: this.abortController?.signal,
          onProgress: (progress: number) => {
            // 计算整体进度
            const overallProgress = this.chunkManager.getProgress();
            this.options.onProgress(overallProgress);
          }
        });

        this.chunkManager.updateChunkStatus(chunk.index, 'completed');
        this.options.onChunkSuccess(chunk.index, response);
      } catch (error) {
        if (this.aborted) return;

        this.chunkManager.updateChunkStatus(chunk.index, 'failed');
        if (chunk.retries < this.options.maxRetries) {
          chunksToUpload.push(chunk); // 重试
        } else {
          throw error;
        }
      } finally {
        this.activeConnections--;
        this.options.onProgress(this.chunkManager.getProgress());
      }
    }
  }
}