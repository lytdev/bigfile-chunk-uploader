//TODO: 计算哈希用 Web Worker
import { ChunkInfo } from 'src/types';

/**
 * 分片管理器
 * 负责文件分片、哈希计算、分片状态管理等核心功能
 */
export default class ChunkManager {
  private file: File;                    // 待上传的文件
  private chunkSize: number;             // 分片大小（字节）
  public chunks: ChunkInfo[];            // 分片信息数组
  public fileHash: string | null;        // 文件哈希值
  private hashProgress: number;          // 哈希计算进度

  /**
   * 构造函数
   * @param file 待上传的文件
   * @param chunkSize 分片大小，默认5MB
   */
  constructor(file: File, chunkSize: number = 5 * 1024 * 1024) {
    this.file = file;
    this.chunkSize = chunkSize;
    this.chunks = [];
    this.fileHash = null;
    this.hashProgress = 0;

    this._prepareChunks();
  }

  /**
   * 准备文件分片
   * 将文件按照指定大小切分成多个分片
   * @private
   */
  private _prepareChunks(): void {
    let start = 0;
    let index = 0;

    while (start < this.file.size) {
      const end = Math.min(start + this.chunkSize, this.file.size);
      this.chunks.push({
        index,
        start,
        end,
        blob: this.file.slice(start, end),
        status: 'pending',
        retries: 0
      });
      start = end;
      index++;
    }
  }

  /**
   * 计算文件哈希值（SHA-256）
   * TODO: 迁移到 Web Worker 中执行
   * @param onProgress 进度回调函数
   * @returns Promise<string> 文件的哈希值
   */
  async calculateFileHash(onProgress?: (progress: number) => void): Promise<string> {
    if (this.fileHash) return this.fileHash;

    return new Promise((resolve) => {
      let currentChunk = 0;
      const fileReader = new FileReader();
      // 计算分片数量
      const chunks = Math.ceil(this.file.size / this.chunkSize);
      const buffers: ArrayBuffer[] = [];
      fileReader.onload = async (e: ProgressEvent<FileReader>) => {
        if (e.target?.result instanceof ArrayBuffer) {
          buffers.push(e.target.result);
          // 更新进度
          currentChunk++;
          this.hashProgress = Math.round((currentChunk / chunks) * 100);

          if (onProgress) {
            onProgress(this.hashProgress);
          }

          if (currentChunk < chunks) {
            loadNextChunk();
          } else {
            // 合并所有缓冲区
            // 计算合并后的缓冲区大小
            const concatenated = new Uint8Array(buffers.reduce((acc, buf) => acc + buf.byteLength, 0));
            let offset = 0;
            // 将每个缓冲区复制到合并的缓冲区中
            buffers.forEach(buffer => {
              concatenated.set(new Uint8Array(buffer), offset);
              offset += buffer.byteLength;
            });

            // 使用 SHA-256 计算哈希
            const hashBuffer = await crypto.subtle.digest('SHA-256', concatenated);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            this.fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            resolve(this.fileHash);
          }
        }
      };

      const loadNextChunk = () => {
        const start = currentChunk * this.chunkSize;
        const end = Math.min(start + this.chunkSize, this.file.size);
        // 分片读取文件
        fileReader.readAsArrayBuffer(this.file.slice(start, end));
      };
      // 手动调用第一次读取
      loadNextChunk();
    });
  }

  /**
   * 获取待上传的分片
   * @param excludeIndices 需要排除的分片索引数组
   * @returns 待上传的分片数组
   */
  getPendingChunks(excludeIndices: number[] = []): ChunkInfo[] {
    return this.chunks.filter(chunk =>
      chunk.status === 'pending' && !excludeIndices.includes(chunk.index)
    );
  }

  /**
   * 获取已完成分片的索引数组
   * @returns 已完成分片的索引数组
   */
  getCompletedIndices(): number[] {
    return this.chunks
      .filter(chunk => chunk.status === 'completed')
      .map(chunk => chunk.index);
  }

  /**
   * 更新分片状态
   * @param index 分片索引
   * @param status 新状态
   */
  updateChunkStatus(index: number, status: ChunkInfo['status']): void {
    const chunk = this.chunks.find(c => c.index === index);
    if (chunk) {
      chunk.status = status;
      if (status === 'failed') {
        chunk.retries += 1;
      }
    }
  }

  /**
   * 重置指定分片的状态
   * @param indices 需要重置的分片索引数组
   * @param status 重置后的状态，默认为 'pending'
   */
  resetChunks(indices: number[], status: ChunkInfo['status'] = 'pending'): void {
    this.chunks
      .filter(chunk => indices.includes(chunk.index))
      .forEach(chunk => {
        chunk.status = status;
        chunk.retries = 0;
      });
  }

  /**
   * 获取需要重试的分片
   * @param maxRetries 最大重试次数，默认3次
   * @returns 需要重试的分片数组
   */
  getChunksToRetry(maxRetries: number = 3): ChunkInfo[] {
    return this.chunks.filter(
      chunk => chunk.status === 'failed' && chunk.retries < maxRetries
    );
  }

  /**
   * 获取总体上传进度
   * @returns 上传进度百分比（0-100）
   */
  getProgress(): number {
    const completed = this.chunks.filter(c => c.status === 'completed').length;
    return Math.round((completed / this.chunks.length) * 100);
  }

  /**
   * 检查指定分片是否已完成上传
   * @param chunkIndex 分片索引
   * @returns 分片是否已完成上传
   */
  isChunkCompleted(chunkIndex: number): boolean {
    // 边界检查
    if (chunkIndex < 0 || chunkIndex >= this.chunks.length) {
      return false;
    }

    return this.chunks[chunkIndex].status === 'completed';
  }
}