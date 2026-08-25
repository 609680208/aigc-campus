<template>
  <section class="view active">
    <div class="container">
      <button class="back-link" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回功能门户
      </button>

      <div class="detail-head">
        <div class="detail-icon">{{ t.icon }}</div>
        <div class="detail-title">
          <h2>
            {{ t.name }}
            <span v-if="t.status === 'maintaining'" class="badge badge-maintain">维护中</span>
          </h2>
          <div class="tool-slogan">{{ t.slogan }}</div>
          <div class="detail-metrics">
            <span><el-icon><Folder /></el-icon> {{ t.catName }}</span>
            <span><el-icon><Cpu /></el-icon> {{ models.length }} 款模型可选</span>
            <span>输出：{{ outTypeName(t.out) }}</span>
            <span v-if="t.sched === 'cloud'" class="loc-badge loc-cloud">云端渲染</span>
            <template v-else-if="t.sched === 'hybrid'">
              <span class="loc-badge loc-local">本地</span>
              <span class="loc-badge loc-cloud">云端</span>
            </template>
            <span v-else class="loc-badge loc-local">本地推理</span>
          </div>
        </div>
      </div>

      <div class="wb-grid">
        <div class="panel">
          <h3>创作操作台</h3>

          <el-form label-position="top">
            <el-form-item label="生成模型">
              <el-select
                v-model="modelIdx"
                placeholder="选择模型"
                style="width: 100%"
                :disabled="!models.length"
                @change="wbModelHint"
              >
                <el-option
                  v-for="(m, i) in models"
                  :key="m.id"
                  :value="i"
                  :label="`${m.name} · ${m.loc === 'CLOUD' ? '云端' : '本地'} · ${m.cost}点/次`"
                />
                <template v-if="!models.length">
                  <el-option value="0" label="暂无可用模型，请到「设置」配置" />
                </template>
              </el-select>
            </el-form-item>

            <template v-for="(inp, i) in t.inputs" :key="i">
              <el-form-item v-if="inp.type === 'upload'" :label="inp.label">
                <div v-if="images.length" class="upload-previews">
                  <div v-for="(img, k) in images" :key="k" class="upload-thumb">
                    <img :src="img.dataUrl" :alt="img.name" :title="img.name">
                    <span class="upload-thumb-del" title="移除这张图" @click.stop="removeImage(k)">×</span>
                  </div>
                </div>
                <el-upload
                  class="upload-full"
                  multiple
                  :auto-upload="false"
                  :show-file-list="false"
                  accept="image/jpeg,image/png,image/webp"
                  drag
                  :on-change="(file) => onFilePicked(file, i)"
                >
                  <div class="upload-inner">
                    <el-icon class="up-icon"><UploadFilled /></el-icon>
                    <div class="up-txt">
                      {{
                        images.length
                          ? `已选 ${images.length} 张，点击或拖拽继续添加`
                          : `点击或拖拽上传${t.out === 'video' ? '（以第一张作为视频起始帧）' : '（支持多张）'} · ${inp.hint || ''}`
                      }}
                    </div>
                  </div>
                </el-upload>
              </el-form-item>

              <el-form-item v-else-if="inp.type === 'textarea'" :label="inp.req ? inp.label : inp.label">
                <el-input
                  v-model="values[i]"
                  type="textarea"
                  :rows="inp.rows || 3"
                  :placeholder="inp.ph || ''"
                />
              </el-form-item>

              <el-form-item v-else-if="inp.type === 'select'" :label="inp.label">
                <el-select v-model="values[i]" style="width: 100%">
                  <el-option v-for="o in inp.options" :key="o" :value="o" :label="o" />
                </el-select>
              </el-form-item>

              <el-form-item v-else :label="inp.req ? inp.label : inp.label">
                <el-input v-model="values[i]" :placeholder="inp.ph || ''" />
              </el-form-item>
            </template>
          </el-form>

          <el-button type="primary" size="large" style="width:100%" @click="startGenerate">
            <el-icon><MagicStick /></el-icon>&nbsp;立即生成
          </el-button>
          <div class="cost-hint" v-html="costHint"></div>
        </div>

        <div class="panel">
          <h3>生成结果</h3>
          <div>
            <div v-if="!gen && !result" class="result-empty">
              <span class="big">{{ t.icon }}</span>填写左侧参数，点击「立即生成」<br>生成结果将在这里展示
            </div>
            <template v-if="gen">
              <div class="gen-loading">
                <el-icon class="is-loading"><Loading /></el-icon>
                <div class="gen-status">{{ genStatus }}（已用时 {{ elapsedText }}）</div>
              </div>
              <div class="gen-meta">
                模型：{{ curModel?.name }} ｜ 调度节点：{{ node }}（{{ curModel?.loc === 'CLOUD' ? '云端' : '本地' }}）<br>预计消耗：{{ curModel?.cost }} 算力点
              </div>
            </template>
            <div v-if="genError" class="gen-error">{{ genError }}</div>
            <template v-if="result">
              <div v-if="t.out === 'video'" class="result-media">
                <video :src="result" controls playsinline preload="metadata"></video>
              </div>
              <div v-else class="result-media">
                <el-image
                  class="result-img"
                  :src="result"
                  fit="contain"
                  :preview-src-list="[result]"
                  :preview-teleported="true"
                  :zoom-rate="1.2"
                  title="点击放大查看"
                />
              </div>
              <div class="result-actions">
                <el-button :icon="Download" :loading="downloading" @click="downloadResult">下载{{ t.out === 'video' ? '视频' : '图片' }}</el-button>
                <span v-if="t.out !== 'video'" class="result-tip">点击图片可放大预览</span>
              </div>
              <div class="result-meta">
                <span>类型：{{ t.out === 'video' ? '视频' : '图片' }}</span>
                <span v-if="taskId">任务编号：{{ taskId }}</span>
                <span>调度：{{ curModel?.loc === 'CLOUD' ? '云端弹性算力' : '本地算力池' }}</span>
                <span>消耗：{{ curModel?.cost }} 算力点</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top:20px;" v-if="t.cases.length">
        <h3>精选案例</h3>
        <div class="case-grid">
          <div v-for="c in t.cases" :key="c.t" class="case-card">
            <div class="case-thumb">
              <img loading="lazy" :src="IMG_API(c.cover)" :alt="c.t">
              <div v-if="t.out === 'video'" class="case-play">▶</div>
            </div>
            <div class="case-body">
              <div class="case-title">{{ c.t }}</div>
              <div class="case-prompt">{{ c.p }}</div>
              <button class="use-case-btn" @click="useCase(c.p)">使用该提示词</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Download } from '@element-plus/icons-vue';
import { IMG_API, TOOLS, outTypeName } from '../../data/prototype';
import { listModelsApi, createWorkApi } from '../../api';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const auth = useAuthStore();

const t = computed(() => TOOLS.find((x) => x.id === Number(route.params.id)) || TOOLS[0]);

const models = ref<any[]>([]);
const modelIdx = ref(0);
const values = ref<string[]>([]);
const images = ref<{ name: string; dataUrl: string }[]>([]);
const costHint = ref('');
const gen = ref(false);
const genStatus = ref('');
const genError = ref('');
const elapsed = ref(0);
const result = ref('');
const taskId = ref('');
const node = ref('');
const downloading = ref(false);
let timer: any = null;

const elapsedText = computed(() => {
  const s = elapsed.value;
  return s >= 60 ? `${Math.floor(s / 60)} 分 ${s % 60} 秒` : `${s} 秒`;
});

const curModel = computed(() => models.value[modelIdx.value]);

const TYPE_MAP: Record<string, string> = {
  txt2img: 'TXT2IMG',
  img2img: 'IMG2IMG',
  txt2video: 'TXT2VIDEO',
  img2video: 'IMG2VIDEO',
  text: 'TEXT',
};

async function loadModels() {
  const all = await listModelsApi().catch(() => []);
  models.value = all.filter((m: any) => m.type === TYPE_MAP[t.value.modelKey || '']);
  modelIdx.value = 0;
  wbModelHint();
}

function wbModelHint() {
  const m = curModel.value;
  if (!models.value.length) {
    costHint.value = '⚠️ 该功能暂未配置可用模型，请超级管理员在「系统设置」中配置。';
    return;
  }
  if (!m) return;
  costHint.value =
    `⚡ 当前模型：<b>${m.name}</b> ｜ 单次约 <b>${m.cost} 算力点</b> ｜ 调度至 <b>${m.loc === 'CLOUD' ? '云端弹性算力' : '本地算力池'}</b>，可在「后台管理」查看创作记录。`;
}

function onFilePicked(file: any, idx: number) {
  const raw = file?.raw;
  if (!raw) return;
  const reader = new FileReader();
  reader.onload = () => {
    images.value.push({ name: file?.name || 'image.png', dataUrl: String(reader.result || '') });
    values.value[idx] = `已选择 ${images.value.length} 张图片`;
  };
  reader.readAsDataURL(raw);
}

function removeImage(k: number) {
  images.value.splice(k, 1);
  const idx = t.value.inputs.findIndex((i) => i.type === 'upload');
  if (idx >= 0) values.value[idx] = images.value.length ? `已选择 ${images.value.length} 张图片` : '';
}

function useCase(p: string) {
  const idx = t.value.inputs.findIndex((i) => i.type === 'textarea');
  if (idx >= 0) values.value[idx] = p;
  window.scrollTo(0, 0);
}

function resetState() {
  gen.value = false;
  result.value = '';
  genError.value = '';
  elapsed.value = 0;
  taskId.value = '';
  images.value = [];
  values.value = t.value.inputs.map((i) => (i.type === 'select' && i.options?.length ? i.options[0] : ''));
  loadModels();
}

async function startGenerate() {
  if (gen.value) return;
  for (let i = 0; i < t.value.inputs.length; i++) {
    const inp = t.value.inputs[i];
    if (inp.req && inp.type !== 'upload' && !String(values.value[i] || '').trim()) {
      genError.value = '';
      alert('请先填写：' + inp.label);
      return;
    }
    if (inp.type === 'upload' && !images.value.length) {
      genError.value = '';
      alert('请先' + inp.label);
      return;
    }
  }
  const m = curModel.value;
  if (!m) {
    alert('当前功能暂未配置可用模型，请超级管理员在「系统设置」中配置。');
    return;
  }
  // 仅将描述类输入拼入提示词；画面比例/分辨率/时长等结构化参数单独透传
  const promptText = t.value.inputs
    .filter((inp) => !inp.key)
    .map((inp, _) => String(values.value[t.value.inputs.indexOf(inp)] || ''))
    .filter((s) => s.trim())
    .join('；');

  const paramOf = (key: string) => {
    const idx = t.value.inputs.findIndex((inp) => inp.key === key);
    return idx >= 0 ? String(values.value[idx] || '') : '';
  };
  const aspectRatio = paramOf('aspectRatio');
  const resolution = paramOf('resolution');
  const durationText = paramOf('duration');
  const duration = durationText ? parseInt(durationText, 10) || undefined : undefined;

  gen.value = true;
  genError.value = '';
  result.value = '';
  genStatus.value = '⏳ 任务已提交，算力调度中…';
  node.value = m.loc === 'CLOUD' ? 'CLOUD 弹性算力' : 'GPU 本地算力池';
  elapsed.value = 0;

  const isVideo = t.value.out === 'video';
  const workPromise = createWorkApi({
    type: TYPE_MAP[t.value.modelKey || ''],
    modelId: m.id,
    prompt: promptText,
    images: images.value.map((i) => i.dataUrl),
    aspectRatio: aspectRatio && aspectRatio !== '自适应' ? aspectRatio : undefined,
    resolution: resolution || undefined,
    duration,
  });

  // 上游接口不返回真实进度百分比，不做数字进度条，用旋转加载 + 已耗时展示
  timer = setInterval(() => {
    elapsed.value += 1;
    if (elapsed.value < 3) genStatus.value = '⏳ 任务已提交，算力调度中…';
    else if (isVideo) genStatus.value = '🎬 视频渲染生成中，通常需要数分钟，请耐心等待…';
    else genStatus.value = '🎨 渲染生成中…';
  }, 1000);

  try {
    const work = await workPromise;
    taskId.value = work?.id || '';
    result.value = work?.resultUrl || '';
    if (!result.value && work?.resultText) {
      genError.value = '';
      alert(work.resultText);
    }
    if (!result.value && !work?.resultText) {
      genError.value = '生成结果为空，请稍后重试';
    }
    auth.fetchMe().catch(() => {});
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    genError.value = typeof msg === 'string' ? msg : msg?.[0] || '生成失败，请稍后重试';
  } finally {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    gen.value = false;
  }
}

/** 下载生成结果：data URL 直接下载，远程链接先取回 blob 再触发下载（规避跨域直接另开窗） */
async function downloadResult() {
  const url = result.value;
  if (!url || downloading.value) return;
  downloading.value = true;
  const ext = t.value.out === 'video' ? 'mp4' : 'png';
  const filename = `aigc-campus-${taskId.value || Date.now()}.${ext}`;
  try {
    let href = url;
    let revoke = false;
    if (!url.startsWith('data:')) {
      const blob = await (await fetch(url)).blob();
      href = URL.createObjectURL(blob);
      revoke = true;
    }
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (revoke) setTimeout(() => URL.revokeObjectURL(href), 5000);
  } catch {
    window.open(url, '_blank');
  } finally {
    downloading.value = false;
  }
}

watch(() => route.params.id, resetState, { immediate: true });

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
/* 修复「框套框」：表单控件统一为单层细边框的普通文本框样式，无嵌套阴影 */
.panel :deep(.el-textarea__inner) {
  box-shadow: none;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #fff;
}
.panel :deep(.el-textarea__inner:hover),
.panel :deep(.el-textarea__inner:focus) {
  border-color: #2b5aed;
}
.panel :deep(.el-input__wrapper) {
  box-shadow: none;
  border: 1px solid #dcdfe6;
  background: #fff;
}
.panel :deep(.el-input__wrapper:hover),
.panel :deep(.el-input__wrapper.is-focus) {
  border-color: #2b5aed;
}

.upload-full :deep(.el-upload-dragger) {
  padding: 24px;
  border-radius: 12px;
}
.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #6b7280;
}
.up-icon {
  font-size: 32px;
  color: #2b5aed;
}
.up-txt {
  font-size: 12.5px;
}

/* 已上传图片缩略图预览（支持多图，悬停可移除） */
.upload-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  margin-bottom: 10px;
}
.upload-thumb {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}
.upload-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.upload-thumb-del {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 13px;
  line-height: 18px;
  text-align: center;
  cursor: pointer;
}
.upload-thumb-del:hover {
  background: #f56c6c;
}

/* 生成中：旋转加载 + 状态文案 */
.gen-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 0 10px;
}
.gen-loading .el-icon {
  font-size: 26px;
  color: var(--primary);
}

/* 结果区媒体展示 */
.result-media video {
  width: 100%;
  max-height: 480px;
  border-radius: 12px;
  background: #000;
  display: block;
}
.result-media .result-img {
  width: 100%;
  height: 420px;
  border-radius: 12px;
  cursor: zoom-in;
  display: block;
}
.result-media .result-img :deep(img) {
  height: 100%;
}
.result-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.result-tip {
  font-size: 12px;
  color: var(--gray);
}
</style>