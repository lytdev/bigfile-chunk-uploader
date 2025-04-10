/** API 端点配置
 * @description 定义上传相关的 API 端点
 */
export interface EndpointConfig {
  /** 初始化上传端点
   * @description 用于创建上传会话和验证文件
   * @default '/upload/init'
   */
  init?: string;

  /** 分片上传端点
   * @description 用于上传单个文件分片
   * @default '/upload/chunk'
   */
  chunk?: string;

  /** 合并分片端点
   * @description 用于请求服务器合并已上传的分片
   * @default '/upload/merge'
   */
  merge?: string;

  /** 文件验证端点
   * @description 用于验证文件是否已存在
   * @default '/upload/verify'
   */
  verify?: string;
}
/** 上传配置选项 */
export interface UploadOptions {
  /** 要上传的文件对象 */
  file: File;

  /** 基础 URL */
  baseURL: string;

  /** API 端点配置 */
  endpoints?: EndpointConfig;

  /** 分片大小(字节)，默认 5MB */
  chunkSize?: number;

  /** 最大并发上传数，默认 3 */
  concurrent?: number;

  /** 自定义请求头 */
  headers?: Record<string, string>;

  /** 是否携带 cookie，默认 false */
  withCredentials?: boolean;

  /** 单个分片最大重试次数，默认 3 次 */
  maxRetries?: number;

  /** 上传进度回调 
   * @param progress 上传进度(0-100)
   */
  onProgress?: (progress: number) => void;

  /** 上传失败回调
   * @param error 错误对象
   */
  onError?: (error: Error) => void;

  /** 上传成功回调
   * @param response 服务器响应数据
   */
  onSuccess?: (response: any) => void;

  /** 分片上传成功回调
   * @param chunkIndex 分片索引
   * @param response 服务器响应数据
   */
  onChunkSuccess?: (chunkIndex: number, response: any) => void;
}

interface UploadResponse {
  uploadId?: string;
  message?: string;
  [key: string]: any;
}

// 分片状态类型
export type ChunkStatus = 'pending' | 'uploading' | 'completed' | 'failed';

// 分片信息类型
export interface ChunkInfo {
  index: number;
  start: number;
  end: number;
  blob: Blob;
  status: ChunkStatus;
  retries: number;
}

/** 上传策略接口
 * @description 定义了文件上传的核心行为
 */
export interface UploadStrategy {
  /** 执行上传操作
   * @returns 返回一个 Promise，上传完成时解析
   */
  execute(): Promise<void>;

  /** 暂停上传
   * @description 暂停当前上传操作，可以通过 resume 恢复
   */
  pause(): void;

  /** 恢复上传
   * @description 恢复之前暂停的上传操作
   */
  resume(): void;

  /** 中止上传
   * @description 完全中止上传操作，不可恢复
   */
  abort(): void;
}

/** 并发上传策略配置选项
 * @description 控制文件分片的并发上传行为
 */
export interface ConcurrentStrategyOptions {
  /** 要上传的文件对象 */
  file: File;

  /** 基础 URL */
  baseURL: string;

  /** API 端点配置 */
  endpoints?: EndpointConfig;

  /** 分片大小(字节) */
  chunkSize: number;

  /** 最大并发上传数 */
  concurrent: number;

  /** 自定义请求头 */
  headers: Record<string, string>;

  /** 是否携带 cookie */
  withCredentials: boolean;

  /** 单个分片最大重试次数 */
  maxRetries: number;

  /** 上传进度回调 
   * @param progress 上传进度(0-100)
   */
  onProgress: (progress: number) => void;

  /** 上传失败回调
   * @param error 错误对象
   */
  onError: (error: Error) => void;

  /** 上传成功回调
   * @param response 服务器响应数据
   */
  onSuccess: (response: any) => void;

  /** 分片上传成功回调
   * @param chunkIndex 分片索引
   * @param response 服务器响应数据
   */
  onChunkSuccess: (chunkIndex: number, response: any) => void;
}

interface NetworkClientOptions {
  baseURL: string;
  endpoints?: EndpointConfig;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}