import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { EndpointConfig, ExtendedRequestConfig, NetworkClientOptions, ChunkUploadOptions } from 'src/types';
import { DEFAULT_ENDPOINTS, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT } from 'src/constants';

/**
 * 网络请求客户端
 * 封装了文件上传相关的网络请求，支持请求重试、进度回调等功能
 */
class NetworkClient {
  private instance: AxiosInstance;
  private endpoints: Required<EndpointConfig>;
  private maxRetries: number;

  constructor(options: NetworkClientOptions) {
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.endpoints = { ...DEFAULT_ENDPOINTS, ...options.endpoints };
    this.instance = axios.create({
      baseURL: options.baseURL,
      headers: {
        'Content-Type': 'multipart/form-data',
        ...options.headers
      },
      withCredentials: options.withCredentials || false,
      timeout: options.timeout || DEFAULT_TIMEOUT,
    });

    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => this._handleRequest(config),
      (error: any) => this._handleRequestError(error)
    );

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => this._handleResponse(response),
      async (error: any) => {
        const config = error.config as ExtendedRequestConfig;

        // 初始化重试配置
        config.retries = config.retries ?? this.maxRetries;
        config.retryCount = config.retryCount ?? 0;
        config.retryDelay = config.retryDelay ?? 1000;

        // 检查是否可以重试
        if (this._shouldRetry(error) && config.retryCount < config.retries) {
          config.retryCount++;

          // 计算延迟时间（指数退避）
          const delay = Math.min(config.retryDelay * Math.pow(2, config.retryCount - 1), 10000);

          // 等待后重试
          await this._wait(delay);
          return this.instance(config);
        }

        return this._handleResponseError(error);
      }
    );
  }

  /**
  * 获取完整的API端点URL
  * @param endpoint 端点名称
  * @returns 完整的API URL
  * @private
  */
  private getFullUrl(endpoint: keyof EndpointConfig): string {
    return this.endpoints[endpoint];
  }

  /**
   * 判断是否应该重试请求
   * @param error 错误信息
   * @returns 是否应该重试
   * @private
   */
  private _shouldRetry(error: any): boolean {
    // 请求被取消时不重试
    if (axios.isCancel(error)) {
      return false;
    }

    // 没有响应时重试（网络错误）
    if (!error.response) {
      return true;
    }

    // 根据状态码判断是否重试
    const { status } = error.response;
    return [408, 500, 502, 503, 504].includes(status);
  }

  /**
   * 延迟执行
   * @param delay 延迟时间（毫秒）
   * @returns Promise
   * @private
   */
  private _wait(delay: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 上传分片
   * @param formData 分片数据
   * @param options 上传选项
   * @param options.signal 取消信号
   * @param options.onChunkProgress 进度回调
   * @returns 上传响应
   */
  public async uploadChunk(formData: FormData, options: ChunkUploadOptions = {}): Promise<any> {
    const config: ExtendedRequestConfig = {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          options.onChunkProgress?.(progress);
        }
      },
      signal: options.signal,
      retries: this.maxRetries,
      retryDelay: 1000
    };

    return this.instance.post(this.getFullUrl('chunk'), formData, config);
  }

  /**
   * 初始化上传会话
   * @param data 初始化数据
   * @returns 初始化响应
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
   * @param data 合并请求数据
   * @returns 合并响应
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
   * @param uploadId 上传会话ID
   * @returns 进度信息
   */
  public async checkProgress(uploadId: string): Promise<any> {
    return this.instance.get(this.getFullUrl('progress'), {
      params: { uploadId }
    });
  }

  /**
   * 处理请求拦截
   * @param config 请求配置
   * @returns 修改后的请求配置
   * @private
   */
  private _handleRequest(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
    // 可以在这里添加全局请求逻辑，如添加token等
    return config;
  }

  /**
   * 处理请求错误
   * @param error 错误信息
   * @returns Promise.reject
   * @private
   */
  private _handleRequestError(error: any): Promise<never> {
    return Promise.reject(error);
  }

  /**
   * 处理响应数据
   * @param response Axios响应对象
   * @returns 处理后的响应数据
   * @private
   */
  private _handleResponse(response: AxiosResponse): any {
    const { data } = response
    if (data.code !== 0) {
      return Promise.reject(new Error(data.message))
    }
    return data.result
  }

  /**
   * 处理响应错误
   * @param error 错误信息
   * @returns Promise.reject 带格式化的错误信息
   * @private
   */
  private _handleResponseError(error: any): Promise<never> {
    if (axios.isCancel(error)) {
      // 请求被取消的特殊处理
      return Promise.reject(new Error('Request canceled'));
    }

    const errorMessage = this._formatErrorMessage(error);
    return Promise.reject(new Error(errorMessage));
  }

  /**
   * 格式化错误消息
   * @param error 错误对象
   * @returns 格式化后的错误消息
   * @private
   */
  private _formatErrorMessage(error: any): string {
    if (!error.response) {
      const retryCount = error.config?.retryCount || 0;
      if (retryCount > 0) {
        return `Network Error (tried ${retryCount} times)`;
      }
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