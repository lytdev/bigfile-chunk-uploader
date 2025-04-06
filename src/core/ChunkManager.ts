interface ChunkOptions {
  chunkSize: number;
  file: File;
}

class ChunkManager {
  private file: File;
  private chunkSize: number;
  private chunks: Blob[];

  constructor(options: ChunkOptions) {
    this.file = options.file;
    this.chunkSize = options.chunkSize || 1024 * 1024; // 默认1MB
    this.chunks = [];
  }

  async splitFileIntoChunks(): Promise<Blob[]> {
    const totalChunks = Math.ceil(this.file.size / this.chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, this.file.size);
      const chunk = this.file.slice(start, end);
      this.chunks.push(chunk);
    }

    return this.chunks;
  }

  getChunks(): Blob[] {
    return this.chunks;
  }
}

export default ChunkManager;