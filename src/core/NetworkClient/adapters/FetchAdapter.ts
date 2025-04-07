interface FetchAdapterOptions {
  headers?: Record<string, string>;
}

interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
}

export default class FetchAdapter {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseURL: string, options: FetchAdapterOptions = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Accept': 'application/json',
      ...options.headers
    };
  }

  async uploadChunk(url: string, formData: FormData, options: UploadOptions = {}): Promise<ApiResponse> {
    const controller = new AbortController();
    const signal = controller.signal;

    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(`${this.baseURL}${url}`, {
        method: 'POST',
        body: formData,
        headers: this.defaultHeaders,
        signal,
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        data,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request aborted');
      }
      throw error;
    }
  }

  async get<T>(url: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    const queryString = params ? `?${new URLSearchParams(params)}` : '';
    const response = await fetch(`${this.baseURL}${url}${queryString}`, {
      method: 'GET',
      headers: this.defaultHeaders,
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      data,
      status: response.status,
      statusText: response.statusText
    };
  }

  async post<T>(url: string, data: Record<string, any>): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data),
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText
    };
  }
}