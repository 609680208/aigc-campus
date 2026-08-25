/* OpenAI 兼容中转站全局配置
   说明：优先读环境变量（backend/.env），无则回退到默认中转站配置。
   该中转站为 New API 形态，端点：/v1/chat/completions、/v1/images/*、/v1/video/generations */
export const AI_BASE_URL = (
  process.env.AI_BASE_URL || 'http://118.195.196.120:8083/v1'
).replace(/\/+$/, '');

export const AI_API_KEY =
  process.env.AI_API_KEY || 'sk-LZ3KSl8diDIqEZ7ZpZjeLPq6YW3yY7pZQWUOgDrgxlPcBwKh';