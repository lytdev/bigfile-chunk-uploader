//TODO: 创建一个用于计算哈希的 Web Worker
import SparkMD5 from 'spark-md5';
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
      const spark = new SparkMD5.ArrayBuffer();
      const fileReader = new FileReader();
      const chunkSize = 2 * 1024 * 1024;
      let currentChunk = 0;
      const chunks = Math.ceil(this.file.size / chunkSize);

      fileReader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result instanceof ArrayBuffer) {
          spark.append(e.target.result);
          currentChunk++;
          this.hashProgress = Math.round((currentChunk / chunks) * 100);

          if (onProgress) {
            onProgress(this.hashProgress);
          }

          if (currentChunk < chunks) {
            loadNextChunk();
          } else {
            this.fileHash = spark.end();
            resolve(this.fileHash);
          }
        }
      };

      const loadNextChunk = () => {
        const start = currentChunk * chunkSize;
        const end = Math.min(start + chunkSize, this.file.size);
        fileReader.readAsArrayBuffer(this.file.slice(start, end));
      };

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
}