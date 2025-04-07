import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

interface AxiosAdapterOptions {
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

export default class AxiosAdapter {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string, options: AxiosAdapterOptions = {}) {
    this.baseURL = baseURL;
    this.instance = axios.create({
      baseURL,
      timeout: options.timeout || 30000,
      headers: {
        'Accept': 'application/json',
        ...options.headers
      },
      withCredentials: true
    });

    // 添加请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => this._handleRequest(config),
      (error: any) => this._handleRequestError(error)
    );

    // 添加响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => this._handleResponse(response),
      (error: any) => this._handleResponseError(error)
    );
  }

  async uploadChunk(url: string, formData: FormData, options: UploadOptions = {}): Promise<ApiResponse> {
    try {
      const response = await this.instance.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        signal: options.signal,
        onUploadProgress: (progressEvent: any) => {
          if (options.onProgress && progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            options.onProgress(progress);
          }
        }
      });

      return {
        data: response.data,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error: any) {
      if (axios.isCancel(error)) {
        throw new Error('Request aborted');
      }
      throw error;
    }
  }

  async get<T>(url: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const response = await this.instance.get(url, { params });
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText
    };
  }

  async post<T>(url: string, data: Record<string, any>): Promise<ApiResponse<T>> {
    const response = await this.instance.post(url, data);
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText
    };
  }

  private _handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // 可以在这里添加通用的请求处理逻辑
    return config;
  }

  private _handleRequestError(error: any): Promise<never> {
    return Promise.reject(error);
  }

  private _handleResponse(response: AxiosResponse): AxiosResponse {
    // 可以在这里添加通用的响应处理逻辑
    return response;
  }

  private _handleResponseError(error: any): Promise<never> {
    if (axios.isCancel(error)) {
      return Promise.reject(new Error('Request canceled'));
    }

    const errorMessage = this._formatErrorMessage(error);
    return Promise.reject(new Error(errorMessage));
  }

  private _formatErrorMessage(error: any): string {
    if (!error.response) {
      return error.message || '网络错误';
    }

    const { status, data } = error.response;
    switch (status) {
      case 401:
        return '未授权：请先登录';
      case 403:
        return `禁止访问：${data.message || '没有权限'}`;
      case 404:
        return `未找到：${error.config.url}`;
      case 500:
        return `服务器错误：${data.message || '内部服务器错误'}`;
      default:
        return data.message || `HTTP错误 ${status}`;
    }
  }
}