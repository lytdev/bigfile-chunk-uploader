interface XHRAdapterOptions {
  headers?: Record<string, string>;
  timeout?: number;
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

export default class XHRAdapter {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(baseURL: string, options: XHRAdapterOptions = {}) {
    this.baseURL = baseURL;
    this.defaultHeaders = {
      'Accept': 'application/json',
      ...options.headers
    };
    this.timeout = options.timeout || 30000;
  }

  async uploadChunk(url: string, formData: FormData, options: UploadOptions = {}): Promise<ApiResponse> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // 设置上传进度监听
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (options.onProgress && event.lengthComputable) {
          const progress = (event.loaded / event.total) * 100;
          options.onProgress(progress);
        }
      };

      // 处理请求完成
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            data: JSON.parse(xhr.responseText),
            status: xhr.status,
            statusText: xhr.statusText
          });
        } else {
          reject(new Error(`HTTP Error: ${xhr.status} ${xhr.statusText}`));
        }
      };

      // 处理请求错误
      xhr.onerror = () => {
        reject(new Error('Network Error'));
      };

      // 处理请求超时
      xhr.ontimeout = () => {
        reject(new Error('Request timeout'));
      };

      // 打开请求
      xhr.open('POST', `${this.baseURL}${url}`, true);
      xhr.timeout = this.timeout;

      // 设置请求头
      Object.entries(this.defaultHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // 处理请求取消
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Request aborted'));
        });
      }

      // 发送请求
      xhr.send(formData);
    });
  }

  async get<T>(url: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const queryString = params ? `?${new URLSearchParams(params)}` : '';

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            data: JSON.parse(xhr.responseText),
            status: xhr.status,
            statusText: xhr.statusText
          });
        } else {
          reject(new Error(`HTTP Error: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network Error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));

      xhr.open('GET', `${this.baseURL}${url}${queryString}`, true);
      xhr.timeout = this.timeout;

      Object.entries(this.defaultHeaders).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send();
    });
  }

  async post<T>(url: string, data: Record<string, any>): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({
            data: JSON.parse(xhr.responseText),
            status: xhr.status,
            statusText: xhr.statusText
          });
        } else {
          reject(new Error(`HTTP Error: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error('Network Error'));
      xhr.ontimeout = () => reject(new Error('Request timeout'));

      xhr.open('POST', `${this.baseURL}${url}`, true);
      xhr.timeout = this.timeout;

      Object.entries({
        ...this.defaultHeaders,
        'Content-Type': 'application/json'
      }).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.send(JSON.stringify(data));
    });
  }
}