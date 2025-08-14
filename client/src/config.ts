// 根据环境自动选择服务器URL
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 
  (import.meta.env.DEV ? 'http://localhost:4000' : window.location.origin);

// 其他配置
export const CONFIG = {
  SERVER_URL,
  SOCKET_OPTIONS: {
    transports: ['websocket', 'polling'],
    timeout: 10000,
  }
}; 