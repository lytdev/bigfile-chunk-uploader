import ChunkManager from './ChunkManager';
import NetworkClient from './NetworkClient';
import ConcurrentStrategy from '../strategies/ConcurrentStrategy';

interface UploaderOptions {
  url: string;
  chunkSize?: number;
  maxConcurrent?: number;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

class BigFileUploader {
  private chunkManager?: ChunkManager;
  private networkClient: NetworkClient;
  private concurrentStrategy: ConcurrentStrategy;
  private onProgress?: (progress: number) => void;

  constructor(options: UploaderOptions) {
    console.log('BigFileUploader initialized with options:');
    this.networkClient = new NetworkClient({
      url: options.url,
      headers: options.headers
    });

    this.concurrentStrategy = new ConcurrentStrategy({
      maxConcurrent: options.maxConcurrent || 3
    });

    this.onProgress = options.onProgress;
  }

  async upload(file: File): Promise<void> {
    if (!this.chunkManager) {
      this.chunkManager = new ChunkManager({
        file,
        chunkSize: 1024 * 1024 // 1MB chunks
      });
    }

    const chunks = await this.chunkManager.splitFileIntoChunks();
    const total = chunks.length;
    let completed = 0;

    const tasks = chunks.map((chunk, index) => async () => {
      await this.networkClient.uploadChunk(chunk, index);
      completed++;
      this.onProgress?.(completed / total * 100);
    });

    await Promise.all(tasks.map(task => this.concurrentStrategy.addTask(task)));
  }
}

export default BigFileUploader;