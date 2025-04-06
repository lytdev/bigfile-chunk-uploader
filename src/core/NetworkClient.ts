interface UploadOptions {
  url: string;
  headers?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

class NetworkClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(options: UploadOptions) {
    this.baseUrl = options.url;
    this.headers = options.headers || {};
  }

  async uploadChunk(chunk: Blob, chunkIndex: number): Promise<Response> {
    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('chunkIndex', chunkIndex.toString());

    return fetch(this.baseUrl, {
      method: 'POST',
      headers: this.headers,
      body: formData
    });
  }
}

export default NetworkClient;