import { AI_API_KEY, AI_BASE_URL } from './config';

export type GenInput = {
  prompt: string;
  type: string;
  image?: string;
  /** 多参考图（图生图支持多图），优先于 image */
  images?: string[];
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  /** 当前登录用户的 genzhi API Key（SSO 带入），优先于模型/全局配置 */
  userApiKey?: string;
};
export type GenResult = { resultText?: string; resultUrl?: string };

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    TEXT: '文本对话',
    TXT2IMG: '文生图',
    IMG2IMG: '图生图',
    TXT2VIDEO: '文生视频',
    IMG2VIDEO: '图生视频',
    AUDIO: 'AI 配音',
    CANVAS: '创作画布',
  };
  return map[type] || type;
}

const VIDEO_SIZE = '1280x720';

function pickBase(model: any, fallback: string): string {
  return (model?.baseUrl || fallback || '').replace(/\/+$/, '');
}

function pickKey(model: any, userApiKey?: string): string {
  // 优先级：当前用户 SSO 带入的 apikey > 模型单独配置 > 平台默认中转站 Key
  const key = userApiKey || model?.apiKey || AI_API_KEY;
  if (!key) throw new Error('该模型未配置 API Key');
  return key;
}

function bearer(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function request(url: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || `请求失败(${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function imageUrlFromData(data: any): string | null {
  const item = data?.data?.[0];
  if (!item) return null;
  return item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : null);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/s);
  if (!m) throw new Error('图片数据格式不正确');
  return new Blob([Buffer.from(m[2], 'base64')], { type: m[1] || 'image/png' });
}

/** 支持 data URL 或 http(s) 链接（画布上游产物），统一转为 data URL */
async function toDataUrl(image: string): Promise<string> {
  if (image.startsWith('data:')) return image;
  const res = await fetch(image);
  if (!res.ok) throw new Error(`图片下载失败(${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get('content-type')?.split(';')[0] || 'image/png';
  return `data:${type};base64,${buf.toString('base64')}`;
}

function videoSeconds(prompt: string, duration?: number): string {
  if (duration && Number.isFinite(duration)) return String(Math.max(3, Math.min(15, Math.round(duration))));
  return /10\s*秒/.test(prompt) ? '10' : '5';
}

/** 画面比例 → 图片 size 参数（尺寸圆整为 256 倍数，满足 seedream 上游最小像素要求） */
function imageSizeFor(aspectRatio?: string): string {
  const map: Record<string, [number, number]> = {
    '21:9': [21, 9],
    '16:9': [16, 9],
    '4:3': [4, 3],
    '1:1': [1, 1],
    '3:4': [3, 4],
    '9:16': [9, 16],
  };
  const ratio = map[String(aspectRatio || '').replace(/\s+/g, '')];
  if (!ratio) return '1920x1920'; // 自适应：沿用默认尺寸
  const [rw, rh] = ratio;
  const round256 = (n: number) => Math.max(256, Math.round(n / 256) * 256);
  let w: number;
  let h: number;
  if (rw >= rh) {
    w = 1920;
    h = round256((1920 * rh) / rw);
  } else {
    h = 1920;
    w = round256((1920 * rw) / rh);
  }
  // 火山系上游（seedream）有最小像素保护，不足时按比例放大
  while (w * h < 3686400) {
    w = round256(w * 1.15);
    h = round256(h * 1.15);
  }
  return `${w}x${h}`;
}

/** 分辨率档位 → ResolutionSelector 的 megapixels（与 huobao-drama 工作流管理器一致） */
function resolutionToMegapixels(resolution?: string): number {
  const res = String(resolution || '').toLowerCase().trim();
  if (res.includes('480')) return 0.3;
  if (res.includes('720')) return 1.0;
  if (res.includes('1080')) return 2.0;
  if (res.includes('1440') || res.includes('2k')) return 4.0;
  if (res.includes('2160') || res.includes('4k')) return 8.0;
  return 1.0; // 默认 720p
}

/** 画面比例 → ComfyUI ResolutionSelector 的 aspect_ratio 枚举值（必须与节点枚举完全一致） */
function comfyAspectRatioLabel(aspectRatio?: string): string {
  const map: Record<string, string> = {
    '16:9': '16:9 (Widescreen)',
    '9:16': '9:16 (Portrait Widescreen)',
    '1:1': '1:1 (Square)',
    '4:3': '4:3 (Standard)',
    '3:4': '3:4 (Portrait Standard)',
    '3:2': '3:2 (Photo)',
    '2:3': '2:3 (Portrait Photo)',
    '21:9': '21:9 (Ultrawide)',
  };
  const key = String(aspectRatio || '').replace(/\s+/g, '').toLowerCase();
  return map[key] || '16:9 (Widescreen)';
}

/* ---------------- OpenAI 兼容 ---------------- */
async function openaiChat(base: string, key: string, externalId: string, prompt: string) {
  const data = await request(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(key) },
    body: JSON.stringify({ model: externalId, messages: [{ role: 'user', content: prompt }] }),
  });
  return { resultText: data?.choices?.[0]?.message?.content || '无返回内容' };
}

async function openaiTxt2Img(base: string, key: string, externalId: string, prompt: string, aspectRatio?: string) {
  const data = await request(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(key) },
    body: JSON.stringify({ model: externalId, prompt, size: imageSizeFor(aspectRatio), n: 1 }),
  });
  const url = imageUrlFromData(data);
  return { resultUrl: url || undefined, resultText: url ? '图片已生成' : '未返回图片地址' };
}

async function openaiImg2Img(base: string, key: string, externalId: string, prompt: string, images: string[], aspectRatio?: string) {
  if (!images.length) throw new Error('缺少参考图片');
  const isDoubao = /seedream|doubao/i.test(externalId);
  const fd = new FormData();
  fd.append('model', externalId);
  fd.append('prompt', prompt);
  fd.append('n', '1');
  fd.append('size', imageSizeFor(aspectRatio));
  if (isDoubao) {
    // 豆包 seedream 系：关闭水印，不支持 output_format
    fd.append('watermark', 'false');
  } else {
    fd.append('quality', 'high');
    fd.append('output_format', 'png');
  }
  // 中转站要求参考图字段名为 image[]（与 huobao-drama 适配器一致），多张参考图逐个追加
  for (let i = 0; i < images.length; i++) {
    fd.append('image[]', dataUrlToBlob(await toDataUrl(images[i])), `reference-${i}.png`);
  }
  const data = await request(`${base}/images/edits`, {
    method: 'POST',
    headers: bearer(key),
    body: fd,
  });
  const url = imageUrlFromData(data);
  return { resultUrl: url || undefined, resultText: url ? '图片已生成' : '未返回图片地址' };
}

async function openaiVideo(base: string, key: string, externalId: string, prompt: string, image?: string, duration?: number) {
  const payload: any = {
    model: externalId,
    prompt,
    size: VIDEO_SIZE,
    seconds: videoSeconds(prompt, duration),
  };
  if (image) payload.image_url = image;

  const submit = await request(`${base}/video/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(key) },
    body: JSON.stringify(payload),
  });
  const taskId = submit?.task_id || submit?.id;
  if (!taskId) throw new Error('视频任务提交失败');

  const deadline = Date.now() + 6 * 60 * 1000;
  while (Date.now() < deadline) {
    const poll = await request(`${base}/video/generations/${taskId}`, {
      headers: bearer(key),
    });
    const data = poll?.data || poll;
    const status = data?.status;
    if (status === 'SUCCESS') {
      const url = data?.result_url || data?.content?.video_url || data?.url;
      if (!url) throw new Error('视频生成完成但未返回地址');
      return { resultUrl: url, resultText: '视频已生成' };
    }
    if (status === 'FAILED' || status === 'ERROR') {
      throw new Error(data?.fail_reason || '视频生成失败');
    }
    await sleep(5000);
  }
  throw new Error('视频生成超时，请稍后在创作记录中查看');
}

/* ---------------- Anthropic Claude ---------------- */
async function claudeChat(base: string, key: string, externalId: string, prompt: string) {
  const data = await request(`${base}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: externalId,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const text: string = data?.content?.[0]?.text || '';
  return { resultText: text || '无返回内容' };
}

/* ---------------- 阿里云 DashScope ---------------- */
async function dashscopeChat(base: string, key: string, externalId: string, prompt: string) {
  const data = await request(`${base}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...bearer(key) },
    body: JSON.stringify({ model: externalId, messages: [{ role: 'user', content: prompt }] }),
  });
  return { resultText: data?.choices?.[0]?.message?.content || '无返回内容' };
}

async function dashscopeTxt2Img(base: string, key: string, externalId: string, prompt: string) {
  const submit = await request(`${base}/api/v1/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
      ...bearer(key),
    },
    body: JSON.stringify({
      model: externalId,
      input: { prompt },
      parameters: { size: '1024*1024', n: 1 },
    }),
  });
  const taskId = submit?.output?.task_id;
  if (!taskId) throw new Error('DashScope 任务提交失败');

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const poll = await request(`${base}/api/v1/tasks/${taskId}`, {
      headers: bearer(key),
    });
    const status = poll?.output?.task_status;
    if (status === 'SUCCEEDED') {
      const url = poll?.output?.results?.[0]?.url;
      if (!url) throw new Error('DashScope 生成完成但未返回图片地址');
      return { resultUrl: url, resultText: '图片已生成' };
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(poll?.output?.message || 'DashScope 生成失败');
    }
    await sleep(3000);
  }
  throw new Error('DashScope 生成超时');
}

/* ---------------- ComfyUI ---------------- */
function comfyWorkflow(ckpt: string, prompt: string) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: '', clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: 512, height: 512, batch_size: 1 } },
    '5': {
      class_type: 'KSampler',
      inputs: {
        seed: Math.floor(Math.random() * 1e9),
        steps: 20,
        cfg: 7.0,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['2', 0],
        negative: ['3', 0],
        latent_image: ['4', 0],
      },
    },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'aigc_campus' } },
  };
}

function comfyImage(outputs: any): { filename: string; subfolder: string; type: string } | null {
  for (const k of Object.keys(outputs || {})) {
    const images = outputs?.[k]?.images;
    if (Array.isArray(images) && images.length) {
      const img = images[0];
      return { filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' };
    }
  }
  return null;
}

async function comfyTxt2Img(base: string, externalId: string, prompt: string) {
  const submit = await request(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: comfyWorkflow(externalId, prompt) }),
  });
  const promptId = submit?.prompt_id;
  if (!promptId) throw new Error('ComfyUI 任务提交失败');

  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const poll = await request(`${base}/history/${promptId}`);
    const entry = poll?.[promptId];
    if (entry) {
      if (entry.status?.status_str === 'error') throw new Error('ComfyUI 生成失败');
      const img = comfyImage(entry.outputs);
      if (img) {
        const url =
          `${base}/view?filename=${encodeURIComponent(img.filename)}` +
          `&subfolder=${encodeURIComponent(img.subfolder)}&type=${encodeURIComponent(img.type)}`;
        return { resultUrl: url, resultText: '图片已生成' };
      }
    }
    await sleep(3000);
  }
  throw new Error('ComfyUI 生成超时');
}

/* ---------------- ComfyUI · MiniMax H3 视频（移植自 huobao-drama） ---------------- */

/** 上传 data URL 图片到 ComfyUI，返回服务器端文件名 */
async function comfyUploadImage(base: string, dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(await toDataUrl(dataUrl));
  const fd = new FormData();
  fd.append('image', blob, `upload_${Date.now()}.png`);
  fd.append('overwrite', 'true');
  const data = await request(`${base}/upload/image`, { method: 'POST', body: fd });
  if (!data?.name) throw new Error('ComfyUI 图片上传失败');
  return data.name;
}

/** MiniMax H3 文生视频（全参考模式，无参考图）工作流，节点结构与 huobao-drama minimax_h3.json 一致 */
function comfyMinimaxH3Workflow(prompt: string, duration: number, aspectRatio?: string, resolution?: string) {
  return {
    '92': {
      inputs: { filename_prefix: 'video/MiniMax_H3', format: 'auto', codec: 'auto', 'video-preview': '', video: ['130', 0] },
      class_type: 'SaveVideo',
      _meta: { title: '保存视频' },
    },
    '115': {
      inputs: { aspect_ratio: comfyAspectRatioLabel(aspectRatio), megapixels: resolutionToMegapixels(resolution), multiple: 32 },
      class_type: 'ResolutionSelector',
      _meta: { title: 'Resolution Selector (Size)' },
    },
    '119': {
      inputs: { vae_name: 'minimax_h3_video_vae_fp16.safetensors' },
      class_type: 'VAELoader',
      _meta: { title: '加载VAE' },
    },
    '120': {
      inputs: { vae_name: 'minimax_h3_audio_vae_fp32.safetensors' },
      class_type: 'VAELoader',
      _meta: { title: '加载VAE' },
    },
    '121': {
      inputs: { samples: ['125', 0], vae: ['120', 0] },
      class_type: 'VAEDecodeAudio',
      _meta: { title: 'VAE解码（音频）' },
    },
    '122': {
      inputs: { samples: ['125', 0], vae: ['119', 0] },
      class_type: 'VAEDecode',
      _meta: { title: 'VAE解码' },
    },
    '123': {
      inputs: { sampler_name: 'res_multistep' },
      class_type: 'KSamplerSelect',
      _meta: { title: 'K采样器选择' },
    },
    '124': {
      inputs: { scheduler: 'simple', steps: 20, denoise: 1, model: ['127', 0] },
      class_type: 'BasicScheduler',
      _meta: { title: '基本调度器' },
    },
    '125': {
      inputs: {
        noise: ['129', 0],
        guider: ['126', 0],
        sampler: ['123', 0],
        sigmas: ['124', 0],
        latent_image: ['136', 1],
      },
      class_type: 'SamplerCustomAdvanced',
      _meta: { title: '自定义采样器（高级）' },
    },
    '126': {
      inputs: { model: ['127', 0], conditioning: ['136', 0] },
      class_type: 'BasicGuider',
      _meta: { title: '基本引导器' },
    },
    '127': {
      inputs: { unet_name: 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', weight_dtype: 'default' },
      class_type: 'UNETLoader',
      _meta: { title: 'UNet加载器' },
    },
    '128': {
      inputs: { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' },
      class_type: 'CLIPLoader',
      _meta: { title: '加载CLIP' },
    },
    '129': {
      inputs: { noise_seed: Math.floor(Math.random() * 2147483647) },
      class_type: 'RandomNoise',
      _meta: { title: '随机噪波' },
    },
    '130': {
      inputs: { fps: 24, bit_depth: 8, images: ['122', 0], audio: ['121', 0] },
      class_type: 'CreateVideo',
      _meta: { title: '创建视频' },
    },
    '131': {
      inputs: {
        expression: 'max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17',
        'values.a': ['132', 0],
      },
      class_type: 'ComfyMathExpression',
      _meta: { title: '数学表达式' },
    },
    '132': {
      inputs: { value: duration },
      class_type: 'PrimitiveFloat',
      _meta: { title: 'Float (Duration)' },
    },
    '136': {
      inputs: {
        prompt: ['138', 0],
        width: ['115', 0],
        height: ['115', 1],
        length: ['131', 1],
        ref_image_size: 'match',
        clip: ['128', 0],
        vae: ['119', 0],
        audio_vae: ['120', 0],
      },
      class_type: 'MiniMaxH3ReferenceToVideo',
      _meta: { title: 'MiniMax H3 Reference to Video' },
    },
    '138': {
      inputs: { value: prompt },
      class_type: 'PrimitiveStringMultiline',
      _meta: { title: 'Input Text (Prompt)' },
    },
  };
}

/** MiniMax H3 图生视频（首帧硬锚定）工作流，节点结构与 huobao-drama minimax_h3_i2v.json 一致 */
function comfyMinimaxH3I2vWorkflow(prompt: string, duration: number, firstFrameName: string, aspectRatio?: string, resolution?: string) {
  const megapixels = resolutionToMegapixels(resolution);
  return {
    '92': {
      inputs: { filename_prefix: 'video/MiniMax_H3', format: 'auto', codec: 'auto', 'video-preview': '', video: ['105:91', 0] },
      class_type: 'SaveVideo',
      _meta: { title: '保存视频' },
    },
    '114': {
      inputs: { image: firstFrameName },
      class_type: 'LoadImage',
      _meta: { title: '加载图像' },
    },
    '115': {
      inputs: { aspect_ratio: comfyAspectRatioLabel(aspectRatio), megapixels, multiple: 32 },
      class_type: 'ResolutionSelector',
      _meta: { title: '分辨率选择器' },
    },
    // 首帧缩放链：模板中该节点未接图片输入会校验失败，这里接入首帧并重接 first_frame
    '119': {
      inputs: { upscale_method: 'nearest-exact', megapixels, resolution_steps: 32, image: ['114', 0] },
      class_type: 'ImageScaleToTotalPixels',
      _meta: { title: '缩放图像（像素）' },
    },
    '120': {
      inputs: { image: ['119', 0] },
      class_type: 'GetImageSize',
      _meta: { title: '获取图像尺寸' },
    },
    '105:11': {
      inputs: { vae_name: 'minimax_h3_video_vae_fp16.safetensors' },
      class_type: 'VAELoader',
      _meta: { title: '加载VAE' },
    },
    '105:24': {
      inputs: { vae_name: 'minimax_h3_audio_vae_fp32.safetensors' },
      class_type: 'VAELoader',
      _meta: { title: '加载VAE' },
    },
    '105:23': {
      inputs: { samples: ['105:14', 0], vae: ['105:24', 0] },
      class_type: 'VAEDecodeAudio',
      _meta: { title: 'VAE解码（音频）' },
    },
    '105:10': {
      inputs: { samples: ['105:14', 0], vae: ['105:11', 0] },
      class_type: 'VAEDecode',
      _meta: { title: 'VAE解码' },
    },
    '105:17': {
      inputs: { sampler_name: 'res_multistep' },
      class_type: 'KSamplerSelect',
      _meta: { title: 'K采样器选择' },
    },
    '105:9': {
      inputs: { scheduler: 'simple', steps: 20, denoise: 1, model: ['105:6', 0] },
      class_type: 'BasicScheduler',
      _meta: { title: '基本调度器' },
    },
    '105:14': {
      inputs: {
        noise: ['105:15', 0],
        guider: ['105:16', 0],
        sampler: ['105:17', 0],
        sigmas: ['105:9', 0],
        latent_image: ['105:104', 1],
      },
      class_type: 'SamplerCustomAdvanced',
      _meta: { title: '自定义采样器（高级）' },
    },
    '105:16': {
      inputs: { model: ['105:6', 0], conditioning: ['105:104', 0] },
      class_type: 'BasicGuider',
      _meta: { title: '基本引导器' },
    },
    '105:6': {
      inputs: { unet_name: 'minimax_h3_fl2va_pruned_int8_convrot.safetensors', weight_dtype: 'default' },
      class_type: 'UNETLoader',
      _meta: { title: 'UNet加载器' },
    },
    '105:13': {
      inputs: { clip_name: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors', type: 'minimax', device: 'default' },
      class_type: 'CLIPLoader',
      _meta: { title: '加载CLIP' },
    },
    '105:15': {
      inputs: { noise_seed: Math.floor(Math.random() * 2147483647) },
      class_type: 'RandomNoise',
      _meta: { title: '随机噪波' },
    },
    '105:91': {
      inputs: { fps: 24, bit_depth: 8, images: ['105:10', 0], audio: ['105:23', 0] },
      class_type: 'CreateVideo',
      _meta: { title: '创建视频' },
    },
    '105:104': {
      inputs: {
        prompt,
        width: ['115', 0],
        height: ['115', 1],
        length: ['105:107', 1],
        clip: ['105:13', 0],
        vae: ['105:11', 0],
        first_frame: ['119', 0],
      },
      class_type: 'MiniMaxH3ImageToVideo',
      _meta: { title: 'MiniMax H3 Image to Video' },
    },
    '105:107': {
      inputs: {
        expression: 'max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17',
        'values.a': ['105:111', 0],
      },
      class_type: 'ComfyMathExpression',
      _meta: { title: '数学表达式' },
    },
    '105:111': {
      inputs: { value: duration },
      class_type: 'PrimitiveFloat',
      _meta: { title: 'Float (duration)' },
    },
  };
}

/** Qwen3-TTS 配音工作流，节点结构与 huobao-drama Qwen3-TTS-Default.json 一致 */
function comfyTtsWorkflow(text: string) {
  return {
    '7': {
      inputs: { filename_prefix: 'audio', audio: ['21', 0] },
      class_type: 'SaveAudio',
      _meta: { title: '保存音频' },
    },
    '17': {
      inputs: { purge_cache: true, purge_models: true, anything: ['21', 0] },
      class_type: 'LayerUtility: PurgeVRAM V2',
      _meta: { title: '图层工具：清除VRAM V2' },
    },
    '20': {
      inputs: {
        model_path: 'Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice',
        precision: 'bf16',
        device: 'cuda',
        attn_implementation: 'sdpa',
        auto_download: false,
        download_source: 'ModelScope',
      },
      class_type: 'TDQwen3TTSModelLoader',
      _meta: { title: 'TD Qwen3 TTS Model Loader' },
    },
    '21': {
      inputs: { text, speaker: 'Aiden', language: 'Auto', instruct: '', model: ['20', 0] },
      class_type: 'TDQwen3TTSCustomVoice',
      _meta: { title: 'TD Qwen3 TTS Custom Voice' },
    },
  };
}

function comfyMediaFromOutputs(outputs: any): { filename: string; subfolder: string; type: string } | null {
  for (const k of Object.keys(outputs || {})) {
    const list = outputs?.[k]?.videos || outputs?.[k]?.gif || outputs?.[k]?.audio || outputs?.[k]?.images;
    if (Array.isArray(list) && list.length) {
      const item = list[0];
      return { filename: item.filename, subfolder: item.subfolder || '', type: item.type || 'output' };
    }
  }
  return null;
}

function comfyViewUrl(base: string, media: { filename: string; subfolder: string; type: string }): string {
  return (
    `${base}/view?filename=${encodeURIComponent(media.filename)}` +
    `&subfolder=${encodeURIComponent(media.subfolder)}&type=${encodeURIComponent(media.type)}`
  );
}

/** 提交 ComfyUI 工作流并轮询结果，视频生成耗时较长，超时上限 20 分钟 */
async function comfyRunWorkflow(base: string, workflow: any, timeoutMs: number): Promise<any> {
  const submit = await request(`${base}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
  });
  const promptId = submit?.prompt_id;
  if (!promptId) {
    const errMsg = submit?.error?.message || JSON.stringify(submit?.error || submit).slice(0, 200);
    throw new Error(`ComfyUI 任务提交失败：${errMsg}`);
  }

  const deadline = Date.now() + timeoutMs;
  let pollErrors = 0;
  while (Date.now() < deadline) {
    let entry: any;
    try {
      const poll = await request(`${base}/history/${promptId}`);
      entry = poll?.[promptId];
      pollErrors = 0;
    } catch {
      // 网络抖动不中断任务，连续多次失败才认定服务异常
      pollErrors += 1;
      if (pollErrors >= 10) throw new Error('ComfyUI 服务连接异常，请稍后重试');
      await sleep(5000);
      continue;
    }
    if (entry) {
      if (entry.status?.status_str === 'error') {
        const msgs = Array.isArray(entry.status?.messages)
          ? entry.status.messages.map((m: any) => (Array.isArray(m) ? m[0] : m)).join(', ')
          : '';
        throw new Error(msgs ? `ComfyUI 执行失败：${msgs}` : 'ComfyUI 执行失败');
      }
      const media = comfyMediaFromOutputs(entry.outputs);
      if (media) return media;
    }
    await sleep(5000);
  }
  throw new Error('ComfyUI 生成超时，请稍后在创作记录中查看');
}

async function comfyTxt2Video(base: string, input: GenInput): Promise<GenResult> {
  const duration = Number(videoSeconds(input.prompt, input.duration));
  const workflow = comfyMinimaxH3Workflow(input.prompt, duration, input.aspectRatio, input.resolution);
  const media = await comfyRunWorkflow(base, workflow, 20 * 60 * 1000);
  return { resultUrl: comfyViewUrl(base, media), resultText: '视频已生成' };
}

async function comfyImg2Video(base: string, input: GenInput, images: string[]): Promise<GenResult> {
  if (!images.length) throw new Error('缺少起始图片');
  const firstFrameName = await comfyUploadImage(base, images[0]);
  const duration = Number(videoSeconds(input.prompt, input.duration));
  const workflow = comfyMinimaxH3I2vWorkflow(input.prompt, duration, firstFrameName, input.aspectRatio, input.resolution);
  const media = await comfyRunWorkflow(base, workflow, 20 * 60 * 1000);
  return { resultUrl: comfyViewUrl(base, media), resultText: '视频已生成' };
}

async function comfyTts(base: string, text: string): Promise<GenResult> {
  const workflow = comfyTtsWorkflow(text);
  const media = await comfyRunWorkflow(base, workflow, 5 * 60 * 1000);
  return { resultUrl: comfyViewUrl(base, media), resultText: '配音已生成' };
}

/* ---------------- 统一入口 ---------------- */
export class AiProvider {
  async generate(model: any, input: GenInput): Promise<GenResult> {
    const provider = String(model?.provider || 'OPENAI').toUpperCase();
    const externalId = model?.externalId || model?.name || 'gpt-4o-mini';
    // 兼容单图 image 与多图 images 两种传参
    const images = input.images?.length ? input.images : input.image ? [input.image] : [];
    // ComfyUI 无需密钥，其余服务商优先使用当前用户 SSO 带入的 apikey（避免误拦本地部署模型）
    const key = provider === 'COMFYUI' ? model?.apiKey || '' : pickKey(model, input.userApiKey);

    switch (provider) {
      case 'DEEPSEEK':
        if (input.type !== 'TEXT') throw new Error('DeepSeek 服务商仅支持文本对话');
        return openaiChat(pickBase(model, 'https://api.deepseek.com'), key, externalId, input.prompt);

      case 'CLAUDE':
        if (input.type !== 'TEXT') throw new Error('Claude 服务商仅支持文本对话');
        return claudeChat(pickBase(model, 'https://api.anthropic.com/v1'), key, externalId, input.prompt);

      case 'DASHSCOPE': {
        const base = pickBase(model, 'https://dashscope.aliyuncs.com');
        if (input.type === 'TEXT') return dashscopeChat(base, key, externalId, input.prompt);
        if (input.type === 'TXT2IMG') return dashscopeTxt2Img(base, key, externalId, input.prompt);
        throw new Error('DashScope 服务商暂不支持该创作类型');
      }

      case 'COMFYUI': {
        const base = pickBase(model, '');
        if (!base) throw new Error('ComfyUI 服务商需配置 Base URL');
        if (input.type === 'TXT2IMG') return comfyTxt2Img(base, externalId, input.prompt);
        if (input.type === 'TXT2VIDEO') return comfyTxt2Video(base, input);
        if (input.type === 'IMG2VIDEO') return comfyImg2Video(base, input, images);
        if (input.type === 'AUDIO') return comfyTts(base, input.prompt);
        throw new Error('ComfyUI 服务商暂不支持该创作类型');
      }

      case 'OPENAI':
      default: {
        const base = pickBase(model, AI_BASE_URL);
        if (input.type === 'TEXT') return openaiChat(base, key, externalId, input.prompt);
        if (input.type === 'TXT2IMG') return openaiTxt2Img(base, key, externalId, input.prompt, input.aspectRatio);
        if (input.type === 'IMG2IMG') return openaiImg2Img(base, key, externalId, input.prompt, images, input.aspectRatio);
        if (input.type === 'TXT2VIDEO' || input.type === 'IMG2VIDEO') {
          return openaiVideo(base, key, externalId, input.prompt, images[0], input.duration);
        }
        throw new Error('不支持的创作类型：' + input.type);
      }
    }
  }
}