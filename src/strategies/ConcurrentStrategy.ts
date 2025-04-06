interface ConcurrentOptions {
  maxConcurrent: number;
}

class ConcurrentStrategy {
  private maxConcurrent: number;
  private running: number;
  private queue: Array<() => Promise<void>>;

  constructor(options: ConcurrentOptions) {
    this.maxConcurrent = options.maxConcurrent || 3;
    this.running = 0;
    this.queue = [];
  }

  async addTask(task: () => Promise<void>): Promise<void> {
    if (this.running >= this.maxConcurrent) {
      await new Promise<void>(resolve => this.queue.push(() => new Promise<void>(innerResolve => {
        task().then(() => {
          resolve();
          innerResolve();
        });
      })));
    } else {
      this.running++;
      await task();
      this.running--;
      this.runNext();
    }
  }

  private runNext(): void {
    if (this.queue.length > 0 && this.running < this.maxConcurrent) {
      const task = this.queue.shift();
      if (task) {
        this.running++;
        task().finally(() => {
          this.running--;
          this.runNext();
        });
      }
    }
  }
}

export default ConcurrentStrategy;