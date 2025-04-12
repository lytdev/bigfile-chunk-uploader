import { EndpointConfig } from "src/types";

/** 默认分片大小 (5MB) */
export const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

/** 默认并发数 */
export const DEFAULT_CONCURRENT = 3;

/** 默认最大重试次数 */
export const DEFAULT_MAX_RETRIES = 3;

/** 默认请求超时时间 */
export const DEFAULT_TIMEOUT = 30000;

/** 默认 API 端点配置 */
export const DEFAULT_ENDPOINTS: Required<EndpointConfig> = {
  init: '/api/upload/init',
  chunk: '/api/upload/chunk',
  merge: '/api/upload/merge',
  verify: '/api/upload/verify',
  progress: '/api/upload/progress',
} as const;