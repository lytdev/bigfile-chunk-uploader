import { UploadStrategy, ConcurrentStrategyOptions, ChunkInfo, UploadResponse } from '../types';
import ChunkManager from '../core/ChunkManager';
import NetworkClient from '../core/NetworkClient';

class ConcurrentStrategy implements UploadStrategy {
  private chunkManager: ChunkManager;
  private networkClient: NetworkClient;
  private options: ConcurrentStrategyOptions;
  private activeConnections = 0;
  private paused = false;
  private aborted = false;
  private abortController: AbortController | null = null;
  private pendingChunks: ChunkInfo[] = [];
  private retryQueue: ChunkInfo[] = [];

  constructor(options: ConcurrentStrategyOptions) {
    this.options = options;
    this.chunkManager = new ChunkManager(options.file, options.chunkSize);
    this.networkClient = new NetworkClient({
      baseURL: options.baseURL,
      endpoints: options.endpoints,
      headers: options.headers,
      timeout: options.timeout,
      withCredentials: options.withCredentials
    });
  }

  /**
   * 执行上传流程
   */
  async execute(): Promise<void> {
    if (this.aborted) {
      throw new Error('Upload has been aborted');
    }

    this.abortController = new AbortController();

    try {
      // 1. 计算文件哈希
      await this.calculateFileHashWithProgress();

      // 2. 初始化上传会话
      const initResult = await this.initUploadSession();

      // 如果文件已存在，直接返回成功
      if ('exists' in initResult && initResult.exists) {
        this.options.onProgress(100);
        this.options.onSuccess(initResult);
        return;
      }

      // 检查 uploadId 是否存在
      if (!initResult.uploadId) {
        throw new Error('Missing uploadId in server response');
      }

      const uploadId = initResult.uploadId;

      // 3. 准备上传队列
      this.prepareUploadQueue();

      // 4. 开始并发上传
      await this.processUploadQueue(uploadId);

      // 5. 合并分片
      const result = await this.completeUpload(uploadId);
      this.options.onSuccess(result);

    } catch (error) {
      this.handleUploadError(error);
    } finally {
      this.cleanup();
    }
  }

  pause(): void {
    this.paused = true;
    this.abortController?.abort();
    this.abortController = null;
  }

  resume(): void {
    if (!this.paused) return;

    this.paused = false;
    this.abortController = new AbortController();
    this.execute().catch(this.options.onError);
  }

  abort(): void {
    this.aborted = true;
    this.abortController?.abort();
    this.abortController = null;
  }


  /**
   * 带进度回调的文件哈希计算
   */
  private async calculateFileHashWithProgress(): Promise<void> {
    try {
      await this.chunkManager.calculateFileHash((progress) => {
        // 哈希计算占总体进度的20%
        const overallProgress = Math.floor(progress * 0.2);
        this.options.onProgress(overallProgress);
      });
    } catch (error) {
      // 发生错误时重置进度为0
      this.options.onProgress(0);
      throw new Error(`File hash calculation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 初始化上传会话
   */
  private async initUploadSession(): Promise<UploadResponse> {
    try {
      return await this.networkClient.initUpload({
        fileName: this.options.file.name,
        fileSize: this.options.file.size,
        chunkSize: this.options.chunkSize,
        fileHash: this.chunkManager.fileHash!
      });

    } catch (error) {
      throw new Error(`Upload initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 准备上传队列
   */
  private prepareUploadQueue(): void {
    // 获取未完成的分片（排除已完成的）
    const completedIndices = this.chunkManager.getCompletedIndices();
    this.pendingChunks = this.chunkManager.getPendingChunks(completedIndices);

    // 添加需要重试的分片
    const chunksToRetry = this.chunkManager.getChunksToRetry(this.options.maxRetries);
    this.pendingChunks.push(...chunksToRetry);

    // 更新进度（初始化后可能有已完成的分片）
    this.updateProgress();
  }

  /**
   * 处理上传队列
   */
  private async processUploadQueue(uploadId: string): Promise<void> {
    while (this.shouldContinueProcessing()) {
      if (this.canStartNewConnection()) {
        const chunk = this.getNextChunk();
        if (chunk) {
          this.startChunkUpload(chunk, uploadId);
        }
      }

      // 避免阻塞事件循环
      await this.delay(50);
    }

    // 等待所有活跃连接完成
    await this.waitForActiveConnections();
  }

  /**
   * 启动分片上传
   */
  private async startChunkUpload(chunk: ChunkInfo, uploadId: string): Promise<void> {
    this.activeConnections++;
    this.chunkManager.updateChunkStatus(chunk.index, 'uploading');

    try {
      const formData = this.createFormData(chunk, uploadId);

      const response = await this.networkClient.uploadChunk(formData, {
        signal: this.abortController?.signal,
        onProgress: (chunkProgress) => {
          this.updateChunkProgress(chunk.index, chunkProgress);
        }
      });

      this.handleChunkSuccess(chunk.index, response);
    } catch (error) {
      this.handleChunkError(chunk, error);
    } finally {
      this.activeConnections--;
      this.updateProgress();
    }
  }

  /**
   * 创建分片FormData
   */
  private createFormData(chunk: ChunkInfo, uploadId: string): FormData {
    const formData = new FormData();
    formData.append('file', chunk.blob);
    formData.append('chunkIndex', String(chunk.index));
    formData.append('fileHash', this.chunkManager.fileHash!);
    formData.append('uploadId', uploadId);
    return formData;
  }

  /**
   * 完成上传（合并分片）
   */
  private async completeUpload(uploadId: string): Promise<any> {
    try {
      return await this.networkClient.mergeChunks({
        uploadId,
        fileHash: this.chunkManager.fileHash!,
        fileName: this.options.file.name,
        totalChunks: this.chunkManager.chunks.length
      });
    } catch (error) {
      throw new Error(`File merge failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 处理上传错误
   */
  private handleUploadError(error: unknown): void {
    if (this.aborted) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    this.options.onError(new Error(errorMessage));
  }

  /**
   * 处理分片上传成功
   */
  private handleChunkSuccess(chunkIndex: number, response: any): void {
    this.chunkManager.updateChunkStatus(chunkIndex, 'completed');
    this.options.onChunkSuccess(chunkIndex, response);
  }

  /**
   * 处理分片上传失败
   */
  private handleChunkError(chunk: ChunkInfo, error: unknown): void {
    if (this.aborted) return;

    this.chunkManager.updateChunkStatus(chunk.index, 'failed');

    if (chunk.retries < this.options.maxRetries) {
      this.retryQueue.push(chunk); // 加入重试队列
    } else {
      console.error(`Chunk ${chunk.index} failed after ${this.options.maxRetries} retries`);
    }
  }

  /**
   * 更新分片上传进度
   */
  private updateChunkProgress(chunkIndex: number, chunkProgress: number): void {
    // 计算单个分片对整体进度的影响
    const chunkWeight = 80 / this.chunkManager.chunks.length; // 上传占总体进度的80%
    const progressFromChunks = this.chunkManager.getProgress() * chunkWeight;
    const progressFromThisChunk = chunkProgress * chunkWeight / 100;
    const overallProgress = 20 + progressFromChunks + progressFromThisChunk; // 哈希计算占20%

    this.options.onProgress(Math.min(100, Math.floor(overallProgress)));
  }

  /**
   * 更新整体进度
   */
  private updateProgress(): void {
    if (!this.chunkManager.fileHash) {
      // 如果没有哈希值，说明哈希计算失败或未完成，进度应该为0
      this.options.onProgress(0);
      return;
    }

    const progressFromChunks = this.chunkManager.getProgress() * 0.8;
    const overallProgress = 20 + progressFromChunks; // 哈希计算占20%
    this.options.onProgress(Math.floor(overallProgress));
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    this.abortController = null;
    this.pendingChunks = [];
    this.retryQueue = [];
  }

  /**
   * 辅助方法：获取下一个分片
   */
  private getNextChunk(): ChunkInfo | undefined {
    return this.retryQueue.shift() || this.pendingChunks.shift();
  }

  /**
   * 辅助方法：检查是否可以启动新连接
   */
  private canStartNewConnection(): boolean {
    return this.activeConnections < this.options.concurrent &&
      (this.pendingChunks.length > 0 || this.retryQueue.length > 0);
  }

  /**
   * 辅助方法：是否应该继续处理
   */
  private shouldContinueProcessing(): boolean {
    return !this.paused &&
      !this.aborted &&
      (this.pendingChunks.length > 0 ||
        this.retryQueue.length > 0 ||
        this.activeConnections > 0);
  }

  /**
   * 辅助方法：等待活跃连接完成
   */
  private async waitForActiveConnections(): Promise<void> {
    while (this.activeConnections > 0 && !this.aborted) {
      await this.delay(100);
    }
  }

  /**
   * 辅助方法：延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default ConcurrentStrategy;