//TODO: 创建一个用于计算哈希的 Web Worker
import { ChunkInfo } from 'src/types';

export default class ChunkManager {
  private file: File;
  private chunkSize: number;
  public chunks: ChunkInfo[];
  public fileHash: string | null;
  private hashProgress: number;

  constructor(file: File, chunkSize: number = 5 * 1024 * 1024) {
    this.file = file;
    this.chunkSize = chunkSize;
    this.chunks = [];
    this.fileHash = null;
    this.hashProgress = 0;

    this._prepareChunks();
  }

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

  getPendingChunks(excludeIndices: number[] = []): ChunkInfo[] {
    return this.chunks.filter(chunk =>
      chunk.status === 'pending' && !excludeIndices.includes(chunk.index)
    );
  }

  getCompletedIndices(): number[] {
    return this.chunks
      .filter(chunk => chunk.status === 'completed')
      .map(chunk => chunk.index);
  }

  updateChunkStatus(index: number, status: ChunkInfo['status']): void {
    const chunk = this.chunks.find(c => c.index === index);
    if (chunk) {
      chunk.status = status;
      if (status === 'failed') {
        chunk.retries += 1;
      }
    }
  }

  resetChunks(indices: number[], status: ChunkInfo['status'] = 'pending'): void {
    this.chunks
      .filter(chunk => indices.includes(chunk.index))
      .forEach(chunk => {
        chunk.status = status;
        chunk.retries = 0;
      });
  }

  getChunksToRetry(maxRetries: number = 3): ChunkInfo[] {
    return this.chunks.filter(
      chunk => chunk.status === 'failed' && chunk.retries < maxRetries
    );
  }

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