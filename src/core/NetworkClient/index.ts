import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { EndpointConfig, NetworkClientOptions } from 'src/types';

interface UploadOptions {
  onProgress?: (progressEvent: any) => void;
  signal?: AbortSignal;
}

class NetworkClient {
  private instance: AxiosInstance;
  private endpoints: Required<EndpointConfig>;

  constructor(options: NetworkClientOptions) {
    const defaultEndpoints: Required<EndpointConfig> = {
      init: '/upload/init',
      chunk: '/upload/chunk',
      merge: '/upload/merge',
      verify: '/upload/verify'
    };

    this.endpoints = { ...defaultEndpoints, ...options.endpoints };
    this.instance = axios.create({
      baseURL: options.baseURL,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...options.headers
      },
      withCredentials: options.withCredentials || false,
      timeout: options.timeout || 30000,
    });

    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => this._handleRequest(config),
      (error: any) => this._handleRequestError(error)
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => this._handleResponse(response),
      (error: any) => this._handleResponseError(error)
    );
  }

  private getFullUrl(endpoint: keyof EndpointConfig): string {
    return this.endpoints[endpoint];
  }

  /**
   * 上传分片
   */
  public async uploadChunk(formData: FormData, options: UploadOptions = {}): Promise<any> {
    return this.instance.post(this.getFullUrl('chunk'), formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: options.onProgress,
      signal: options.signal
    });
  }

  /**
   * 初始化上传
   */
  public async initUpload(data: Record<string, any>): Promise<any> {
    return this.instance.post(this.getFullUrl('init'), data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 合并分片
   */
  public async mergeChunks(data: Record<string, any>): Promise<any> {
    return this.instance.post(this.getFullUrl('merge'), data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * 检查上传进度
   */
  public async checkProgress(url: string, params: Record<string, any>): Promise<any> {
    return this.instance.get(url, { params });
  }

  private _handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // 可以在这里添加全局请求逻辑，如添加token等
    // console.log('请求发出:', config.url);
    return config;
  }

  private _handleRequestError(error: any): Promise<never> {
    return Promise.reject(error);
  }

  private _handleResponse(response: AxiosResponse): any {
    return response.data;
  }

  private _handleResponseError(error: any): Promise<never> {
    if (axios.isCancel(error)) {
      // 请求被取消的特殊处理

      return Promise.reject(new Error('Request canceled'));
    }

    const errorMessage = this._formatErrorMessage(error);
    return Promise.reject(new Error(errorMessage));
  }

  private _formatErrorMessage(error: any): string {
    if (!error.response) {
      return error.message || 'Network Error';
    }

    const { status, data } = error.response;
    switch (status) {
      case 401:
        return 'Unauthorized: Please authenticate';
      case 403:
        return `Forbidden: ${data.message || 'No permission'}`;
      case 404:
        return `Not Found: ${error.config.url}`;
      case 500:
        return `Server Error: ${data.message || 'Internal server error'}`;
      default:
        return data.message || `HTTP Error ${status}`;
    }
  }
}

export default NetworkClient;