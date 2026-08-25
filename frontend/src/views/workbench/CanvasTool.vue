<template>
  <div class="canvas-page">
    <!-- 顶部悬浮栏 -->
    <div class="canvas-topbar">
      <button class="ct-back" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回功能门户
      </button>
      <span class="ct-sep" />
      <span class="ct-title">🧩 {{ t.name }}</span>
      <span class="ct-sub">右键画布添加节点 / 工作流模板</span>
      <div class="ct-actions">
        <el-button size="small" :icon="Delete" @click="clearCanvas">清空画布</el-button>
        <el-button size="small" :icon="DocumentAdd" :loading="saving" @click="saveWorkflow">保存画布</el-button>
        <el-button size="small" type="warning" :icon="VideoPlay" :loading="running" @click="runWorkflow">运行工作流</el-button>
      </div>
    </div>

    <!-- 无限画布 -->
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      class="canvas-flow"
      :min-zoom="0.2"
      :max-zoom="2"
      :connection-radius="30"
      :delete-key-code="['Backspace', 'Delete']"
      :default-viewport="{ x: 60, y: 80, zoom: 0.9 }"
      @connect="onConnect"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @pane-click="closeMenus"
    >
      <Background pattern-color="#dfe4ee" :gap="22" />

      <!-- 文本节点 -->
      <template #node-text="np">
        <div class="cn-card" :class="cardCls(np.data)">
          <div class="cn-head">{{ META.text.icon }} 文本节点<span class="cn-tag">提示词来源</span></div>
          <div class="cn-body nodrag">
            <el-input
              v-model="np.data.text" type="textarea" :rows="5"
              placeholder="输入文本内容，将自动作为下游生图 / 视频 / 配音节点的提示词…"
            />
          </div>
        </div>
        <Handle id="out" type="source" :position="Position.Right" class="cn-handle" />
      </template>

      <!-- 生图节点 -->
      <template #node-image="np">
        <div class="cn-card" :class="cardCls(np.data)">
          <div class="cn-head">
            {{ META.image.icon }} 生图节点
            <span v-if="np.data.status === 'running'" class="cn-badge cn-badge-run">生成中…</span>
            <span v-else-if="np.data.status === 'done'" class="cn-badge cn-badge-ok">已完成</span>
            <span v-else-if="np.data.status === 'error'" class="cn-badge cn-badge-err">失败</span>
          </div>
          <div class="cn-body nodrag">
            <div class="cn-row">
              <el-select v-model="np.data.mode" size="small" style="width:104px;" @change="onImageModeChange(np.data)">
                <el-option value="t2i" label="文生图" />
                <el-option value="i2i" label="图生图" />
              </el-select>
              <el-select v-model="np.data.aspectRatio" size="small" style="flex:1;">
                <el-option v-for="o in ASPECT_RATIO_OPTIONS" :key="o" :value="o" :label="'比例 ' + o" />
              </el-select>
            </div>
            <div class="cn-row">
              <el-select v-model="np.data.modelId" size="small" style="width:100%;">
                <el-option v-for="m in modelsOf(imageWorkType(np.data))" :key="m.id" :value="m.id" :label="modelLabel(m)" />
              </el-select>
            </div>
            <template v-if="np.data.mode === 'i2i'">
              <div class="cn-row">
                <el-upload
                  :auto-upload="false" :show-file-list="false" accept="image/jpeg,image/png"
                  :on-change="(f: any) => onNodeFile(f, np.data)"
                >
                  <el-button size="small" :icon="UploadFilled">{{ np.data.image ? '重新上传参考图' : '上传参考图' }}</el-button>
                </el-upload>
                <span v-if="!np.data.image && upstreamImage(np.data)" class="cn-hint">✓ 已接入上游图片</span>
              </div>
            </template>
            <el-input
              v-model="np.data.text" type="textarea" :rows="3"
              :placeholder="np.data.mode === 'i2i' ? '修改/创意描述（留空则使用上游文本）…' : '图片描述（留空则使用上游文本）…'"
            />
            <div class="cn-preview">
              <img v-if="np.data.result" :src="np.data.result" alt="生成图片">
              <div v-else-if="np.data.status === 'running'" class="cn-empty-run">🖼️ 图片生成中，请耐心等待…</div>
              <div v-else class="cn-empty">生成结果预览</div>
            </div>
            <div v-if="np.data.error" class="cn-err">{{ np.data.error }}</div>
            <el-button type="primary" size="small" class="cn-gen" :loading="np.data.status === 'running'" @click="generate(np.data)">
              ✨ 生成图片
            </el-button>
          </div>
        </div>
        <Handle id="in" type="target" :position="Position.Left" class="cn-handle" />
        <Handle id="out" type="source" :position="Position.Right" class="cn-handle" />
      </template>

      <!-- 视频生成节点 -->
      <template #node-video="np">
        <div class="cn-card" :class="cardCls(np.data)">
          <div class="cn-head">
            {{ META.video.icon }} 视频生成节点
            <span v-if="np.data.status === 'running'" class="cn-badge cn-badge-run">生成中…</span>
            <span v-else-if="np.data.status === 'done'" class="cn-badge cn-badge-ok">已完成</span>
            <span v-else-if="np.data.status === 'error'" class="cn-badge cn-badge-err">失败</span>
          </div>
          <div class="cn-body nodrag">
            <div class="cn-row">
              <el-select v-model="np.data.mode" size="small" style="width:104px;" @change="onVideoModeChange(np.data)">
                <el-option value="t2v" label="文生视频" />
                <el-option value="i2v" label="图生视频" />
              </el-select>
              <el-select v-model="np.data.aspectRatio" size="small" style="flex:1;">
                <el-option v-for="o in ASPECT_RATIO_OPTIONS" :key="o" :value="o" :label="'比例 ' + o" />
              </el-select>
            </div>
            <div class="cn-row">
              <el-select v-model="np.data.resolution" size="small" style="flex:1;">
                <el-option v-for="o in RESOLUTION_OPTIONS" :key="o" :value="o" :label="o" />
              </el-select>
              <el-select v-model="np.data.duration" size="small" style="width:82px;">
                <el-option value="5" label="5 秒" />
                <el-option value="10" label="10 秒" />
              </el-select>
            </div>
            <div class="cn-row">
              <el-select v-model="np.data.modelId" size="small" style="width:100%;">
                <el-option v-for="m in modelsOf(videoWorkType(np.data))" :key="m.id" :value="m.id" :label="modelLabel(m)" />
              </el-select>
            </div>
            <template v-if="np.data.mode === 'i2v'">
              <div class="cn-row">
                <el-upload
                  :auto-upload="false" :show-file-list="false" accept="image/jpeg,image/png"
                  :on-change="(f: any) => onNodeFile(f, np.data)"
                >
                  <el-button size="small" :icon="UploadFilled">{{ np.data.image ? '重新上传首帧' : '上传首帧' }}</el-button>
                </el-upload>
                <span v-if="!np.data.image && upstreamImage(np.data)" class="cn-hint">✓ 已接入上游图片作为首帧</span>
              </div>
            </template>
            <el-input
              v-model="np.data.text" type="textarea" :rows="3"
              placeholder="视频运动描述（留空则使用上游文本）…"
            />
            <div class="cn-preview">
              <video v-if="np.data.result" :src="np.data.result" controls />
              <div v-else-if="np.data.status === 'running'" class="cn-empty-run">🎬 视频生成耗时较长（约数分钟），请耐心等待…</div>
              <div v-else class="cn-empty">生成结果预览</div>
            </div>
            <div v-if="np.data.error" class="cn-err">{{ np.data.error }}</div>
            <el-button type="primary" size="small" class="cn-gen" :loading="np.data.status === 'running'" @click="generate(np.data)">
              🎬 生成视频
            </el-button>
          </div>
        </div>
        <Handle id="in" type="target" :position="Position.Left" class="cn-handle" />
        <Handle id="out" type="source" :position="Position.Right" class="cn-handle" />
      </template>

      <!-- 配音节点 -->
      <template #node-audio="np">
        <div class="cn-card" :class="cardCls(np.data)">
          <div class="cn-head">
            {{ META.audio.icon }} 配音节点
            <span v-if="np.data.status === 'running'" class="cn-badge cn-badge-run">生成中…</span>
            <span v-else-if="np.data.status === 'done'" class="cn-badge cn-badge-ok">已完成</span>
            <span v-else-if="np.data.status === 'error'" class="cn-badge cn-badge-err">失败</span>
          </div>
          <div class="cn-body nodrag">
            <div class="cn-row">
              <el-select v-model="np.data.modelId" size="small" style="width:100%;">
                <el-option v-for="m in modelsOf('AUDIO')" :key="m.id" :value="m.id" :label="modelLabel(m)" />
              </el-select>
            </div>
            <el-input
              v-model="np.data.text" type="textarea" :rows="4"
              placeholder="配音文本（留空则使用上游文本节点的文案）…"
            />
            <div class="cn-preview cn-preview-audio">
              <audio v-if="np.data.result" :src="np.data.result" controls />
              <div v-else-if="np.data.status === 'running'" class="cn-empty-run">🎙️ 配音生成中…</div>
              <div v-else class="cn-empty">音频结果预览</div>
            </div>
            <div v-if="np.data.error" class="cn-err">{{ np.data.error }}</div>
            <el-button type="primary" size="small" class="cn-gen" :loading="np.data.status === 'running'" @click="generate(np.data)">
              🎙️ 生成配音
            </el-button>
          </div>
        </div>
        <Handle id="in" type="target" :position="Position.Left" class="cn-handle" />
      </template>

      <!-- 图片上传节点 -->
      <template #node-upload="np">
        <div class="cn-card" :class="cardCls(np.data)">
          <div class="cn-head">{{ META.upload.icon }} 图片上传节点<span class="cn-tag">参考图 / 首帧来源</span></div>
          <div class="cn-body nodrag">
            <div class="cn-row">
              <el-upload
                :auto-upload="false" :show-file-list="false" accept="image/jpeg,image/png"
                :on-change="(f: any) => onNodeFile(f, np.data)"
              >
                <el-button size="small" :icon="UploadFilled">{{ np.data.image ? '重新上传图片' : '上传图片' }}</el-button>
              </el-upload>
            </div>
            <div v-if="np.data.image" class="cn-preview">
              <img :src="np.data.image" alt="上传图片">
            </div>
            <div class="cn-tip">连线到下游「生图（图生图）/ 视频生成（图生视频）」节点，此图片将作为参考图 / 首帧。</div>
          </div>
        </div>
        <Handle id="out" type="source" :position="Position.Right" class="cn-handle" />
      </template>
    </VueFlow>

    <!-- 空画布引导 -->
    <div v-if="!nodes.length" class="canvas-empty">
      <div class="empty-card">
        <span style="font-size:26px;">✨</span>
        <p><b>右键画布</b> 添加节点或选择工作流模板</p>
        <p class="empty-sub">文本 → 生图 → 视频 → 配音，节点按连线自动串联，上游输出流向下游</p>
      </div>
    </div>

    <!-- 左下角缩放控制 -->
    <div class="canvas-controls">
      <button class="ctl-btn" title="缩小" @click="zoomOut({ duration: 150 })">−</button>
      <button class="ctl-btn ctl-zoom" title="适应画布" @click="doFitView">{{ zoomPercent }}%</button>
      <button class="ctl-btn" title="放大" @click="zoomIn({ duration: 150 })">+</button>
      <span class="ctl-divider" />
      <button class="ctl-btn" title="适应画布" @click="doFitView">⛶</button>
    </div>

    <!-- 右键菜单：添加节点 / 工作流模板 -->
    <Teleport to="body">
      <div v-if="addMenu.show" class="ctx-overlay" @click="closeMenus" @contextmenu.prevent="closeMenus">
        <div class="ctx-menu" :style="{ left: addMenu.x + 'px', top: addMenu.y + 'px' }" @click.stop>
          <div class="ctx-title">添加节点</div>
          <button v-for="item in PALETTE" :key="item.type" type="button" class="ctx-item" @click="addNodeFromMenu(item.type)">
            <span class="ctx-icon">{{ item.icon }}</span>
            <span>{{ item.name }}</span>
            <span class="ctx-desc">{{ item.desc }}</span>
          </button>
          <div class="ctx-sep" />
          <div class="ctx-title">工作流模板</div>
          <button type="button" class="ctx-item" @click="loadTemplateFromMenu('video')">
            <span class="ctx-icon">🎬</span>
            <span>创意短片</span>
            <span class="ctx-desc">文案→生图→视频→配音</span>
          </button>
          <button type="button" class="ctx-item" @click="loadTemplateFromMenu('image')">
            <span class="ctx-icon">🖼️</span>
            <span>图文海报</span>
            <span class="ctx-desc">文案→生图</span>
          </button>
        </div>
      </div>
    </Teleport>

    <!-- 右键菜单：节点操作 -->
    <Teleport to="body">
      <div v-if="nodeMenu.show" class="ctx-overlay" @click="closeMenus" @contextmenu.prevent="closeMenus">
        <div class="ctx-menu" :style="{ left: nodeMenu.x + 'px', top: nodeMenu.y + 'px' }" @click.stop>
          <div class="ctx-title">节点操作</div>
          <button v-if="ctxNodeData && ctxNodeData.type !== 'text' && ctxNodeData.type !== 'upload'" type="button" class="ctx-item" @click="ctxGenerate">
            <span class="ctx-icon">✨</span><span>立即生成</span>
          </button>
          <button type="button" class="ctx-item" @click="ctxDuplicate">
            <span class="ctx-icon">⧉</span><span>创建副本</span>
          </button>
          <div class="ctx-sep" />
          <button type="button" class="ctx-item is-danger" @click="ctxDelete">
            <span class="ctx-icon">🗑</span><span>删除节点</span>
            <kbd class="ctx-kbd">Del</kbd>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { VueFlow, useVueFlow, Position, Handle } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import { ArrowLeft, Delete, DocumentAdd, UploadFilled, VideoPlay } from '@element-plus/icons-vue';
import { ASPECT_RATIO_OPTIONS, RESOLUTION_OPTIONS, TOOLS } from '../../data/prototype';
import { createWorkApi, listModelsApi } from '../../api';
import { useAuthStore } from '../../stores/auth';

const t = TOOLS.find((x) => x.out === 'canvas')!;
const auth = useAuthStore();

type NodeType = 'text' | 'image' | 'video' | 'audio' | 'upload';

interface CNode {
  id: string;
  type: NodeType;
  text: string;
  mode: 't2i' | 'i2i' | 't2v' | 'i2v';
  modelId: string;
  aspectRatio: string;
  resolution: string;
  duration: string;
  image: string;
  status: 'idle' | 'running' | 'done' | 'error';
  result: string;
  error: string;
}

const PALETTE: { type: NodeType; icon: string; name: string; desc: string }[] = [
  { type: 'text', icon: '📝', name: '文本节点', desc: '输入文案/提示词' },
  { type: 'image', icon: '🖼️', name: '生图节点', desc: '文生图/图生图' },
  { type: 'video', icon: '🎬', name: '视频生成节点', desc: '文生视频/图生视频' },
  { type: 'audio', icon: '🎙️', name: '配音节点', desc: '文本转配音' },
  { type: 'upload', icon: '📤', name: '图片上传节点', desc: '提供参考图/首帧' },
];

const META: Record<NodeType, { icon: string; name: string }> = {
  text: { icon: '📝', name: '文本' },
  image: { icon: '🖼️', name: '生图' },
  video: { icon: '🎬', name: '视频生成' },
  audio: { icon: '🎙️', name: '配音' },
  upload: { icon: '📤', name: '图片上传' },
};

const { screenToFlowCoordinate, zoomIn, zoomOut, fitView, viewport } = useVueFlow();
const nodes = ref<any[]>([]);
const edges = ref<any[]>([]);
const allModels = ref<any[]>([]);
const saving = ref(false);
const running = ref(false);
let seq = 1;

const zoomPercent = computed(() => Math.round((viewport.value?.zoom || 1) * 100));
function doFitView() {
  if (nodes.value.length) fitView({ padding: 0.25, duration: 300 });
}

const modelsOf = (type: string) => allModels.value.filter((m) => m.type === type);
const modelLabel = (m: any) => `${m.name} · ${m.cost}点/次`;
const imageWorkType = (n: CNode) => (n.mode === 'i2i' ? 'IMG2IMG' : 'TXT2IMG');
const videoWorkType = (n: CNode) => (n.mode === 'i2v' ? 'IMG2VIDEO' : 'TXT2VIDEO');

function cardCls(n: CNode) {
  return { 'cn-running': n.status === 'running', 'cn-error': n.status === 'error' };
}

/* ---------- 基于连线的上游遍历 ---------- */
function ancestorsOf(id: string): any[] {
  const seen = new Set<string>();
  const queue = [id];
  const result: any[] = [];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges.value) {
      if (e.target === cur && !seen.has(e.source)) {
        seen.add(e.source);
        const n = nodes.value.find((x: any) => x.id === e.source);
        if (n) {
          result.push(n);
          queue.push(e.source);
        }
      }
    }
  }
  return result;
}

function upstreamText(n: CNode): string {
  const anc = ancestorsOf(n.id);
  for (const p of anc) if (p.data.type === 'text' && p.data.text.trim()) return p.data.text;
  for (const p of anc) if ((p.data.type === 'image' || p.data.type === 'video') && p.data.text.trim()) return p.data.text;
  return '';
}

function upstreamImage(n: CNode): string {
  for (const p of ancestorsOf(n.id)) {
    const img = p.data.type === 'upload' ? p.data.image : p.data.type === 'image' ? p.data.result : '';
    if (img) return img;
  }
  return '';
}

/* ---------- 节点增删 ---------- */
function defaults(type: NodeType): CNode {
  const firstOf = (tp: string) => modelsOf(tp)[0]?.id || '';
  return {
    id: 'N' + seq++,
    type,
    text: '',
    mode: type === 'video' ? 't2v' : 't2i',
    modelId: type === 'image' ? firstOf('TXT2IMG') : type === 'video' ? firstOf('TXT2VIDEO') : type === 'audio' ? firstOf('AUDIO') : '',
    aspectRatio: '自适应',
    resolution: '720p',
    duration: '5',
    image: '',
    status: 'idle',
    result: '',
    error: '',
  };
}

function addNode(type: NodeType, position: { x: number; y: number }, linkFrom?: string) {
  const data = defaults(type);
  nodes.value.push({ id: data.id, type, position, data });
  const sourceId = linkFrom ?? (nodes.value.length > 1 ? nodes.value[nodes.value.length - 2]?.id : undefined);
  if (sourceId && type !== 'text' && type !== 'upload') {
    edges.value.push({ id: `e-${sourceId}-${data.id}`, source: sourceId, target: data.id, animated: true });
  }
  return data;
}

function onConnect(params: any) {
  if (!params.source || !params.target) return;
  edges.value.push({ id: `e-${params.source}-${params.target}-${seq++}`, source: params.source, target: params.target, animated: true });
}

function clearCanvas() {
  nodes.value = [];
  edges.value = [];
}

function chainAdd(list: { type: NodeType; x: number; y: number }[]) {
  nodes.value = [];
  edges.value = [];
  let prevId = '';
  for (const it of list) {
    const d = addNode(it.type, { x: it.x, y: it.y }, prevId || undefined);
    prevId = d.id;
  }
  setTimeout(doFitView, 60);
}

function loadTemplate(tpl: string) {
  if (tpl === 'video') {
    chainAdd([
      { type: 'text', x: 0, y: 40 },
      { type: 'image', x: 390, y: 0 },
      { type: 'video', x: 780, y: 0 },
      { type: 'audio', x: 390, y: 560 },
    ]);
    // 音频节点从文本节点取文案：补一条 text→audio 连线
    const textId = nodes.value[0]?.id;
    const audioId = nodes.value[3]?.id;
    if (textId && audioId) edges.value.push({ id: `e-${textId}-${audioId}`, source: textId, target: audioId, animated: true });
    // 创意短片：生图出图后作为首帧，图生视频
    const videoNode = nodes.value.find((n: any) => n.data.type === 'video');
    if (videoNode) {
      videoNode.data.mode = 'i2v';
      onVideoModeChange(videoNode.data);
    }
  } else {
    chainAdd([
      { type: 'text', x: 0, y: 40 },
      { type: 'image', x: 390, y: 0 },
    ]);
  }
}

/* ---------- 右键菜单 ---------- */
const addMenu = ref({ show: false, x: 0, y: 0, fx: 0, fy: 0 });
const nodeMenu = ref({ show: false, x: 0, y: 0, nodeId: '' });
const ctxNodeData = computed<CNode | null>(() => nodes.value.find((n: any) => n.id === nodeMenu.value.nodeId)?.data || null);

function onPaneContextMenu(e: MouseEvent) {
  e.preventDefault();
  nodeMenu.value.show = false;
  const p = screenToFlowCoordinate({ x: e.clientX, y: e.clientY });
  const menuW = 240;
  const menuH = 6 * 36 + 92;
  const x = Math.min(e.clientX, window.innerWidth - menuW - 12);
  const y = e.clientY + menuH > window.innerHeight ? Math.max(12, window.innerHeight - menuH - 12) : e.clientY;
  addMenu.value = { show: true, x, y, fx: p.x, fy: p.y };
}

function onNodeContextMenu({ node, event }: any) {
  event?.preventDefault();
  if (!node) return;
  addMenu.value.show = false;
  nodeMenu.value = { show: true, x: event.clientX, y: event.clientY, nodeId: node.id };
}

function closeMenus() {
  addMenu.value.show = false;
  nodeMenu.value.show = false;
}

function addNodeFromMenu(type: NodeType) {
  addNode(type, { x: addMenu.value.fx, y: addMenu.value.fy });
  closeMenus();
}

function loadTemplateFromMenu(tpl: string) {
  loadTemplate(tpl);
  closeMenus();
}

function ctxGenerate() {
  const n = ctxNodeData.value;
  closeMenus();
  if (n) generate(n);
}

function ctxDuplicate() {
  const src = nodes.value.find((n: any) => n.id === nodeMenu.value.nodeId);
  closeMenus();
  if (!src) return;
  const copy: CNode = JSON.parse(JSON.stringify(src.data));
  copy.id = 'N' + seq++;
  copy.status = 'idle';
  copy.result = '';
  copy.error = '';
  nodes.value.push({
    id: copy.id,
    type: src.type,
    position: { x: src.position.x + 40, y: src.position.y + 40 },
    data: copy,
  });
}

function ctxDelete() {
  const id = nodeMenu.value.nodeId;
  closeMenus();
  nodes.value = nodes.value.filter((n: any) => n.id !== id);
  edges.value = edges.value.filter((e: any) => e.source !== id && e.target !== id);
}

/* ---------- 上传参考图 ---------- */
function onNodeFile(file: any, n: CNode) {
  const raw = file?.raw;
  if (!raw) return;
  const reader = new FileReader();
  reader.onload = () => {
    n.image = String(reader.result || '');
  };
  reader.readAsDataURL(raw);
}

function onImageModeChange(n: CNode) {
  const list = modelsOf(imageWorkType(n));
  n.modelId = list[0]?.id || '';
}

function onVideoModeChange(n: CNode) {
  const list = modelsOf(videoWorkType(n));
  n.modelId = list[0]?.id || '';
}

function pickModel(n: CNode, type: string): any {
  const list = modelsOf(type);
  const found = list.find((m) => m.id === n.modelId);
  if (found) return found;
  if (list.length) {
    n.modelId = list[0].id;
    return list[0];
  }
  return null;
}

/* ---------- 单节点生成（真实调用后端模型） ---------- */
async function generate(n: CNode) {
  if (n.type === 'text' || n.type === 'upload' || n.status === 'running') return;
  n.error = '';
  const type = n.type === 'image' ? imageWorkType(n) : n.type === 'video' ? videoWorkType(n) : 'AUDIO';
  const model = pickModel(n, type);
  if (!model) {
    n.error = '该类型暂未配置可用模型，请超级管理员在「系统设置」中配置';
    return;
  }
  const prompt = (n.text || upstreamText(n)).trim();
  if (!prompt) {
    n.error = '请输入提示词，或连接上游文本节点';
    return;
  }
  let image = '';
  if (type === 'IMG2IMG') image = n.image || upstreamImage(n);
  if (type === 'IMG2VIDEO') image = n.image || upstreamImage(n);
  if (type === 'IMG2IMG' && !image) {
    n.error = '请上传参考图，或连接上游生图节点并先出图';
    return;
  }
  if (type === 'IMG2VIDEO' && !image) {
    n.error = '请上传首帧，或连接上游生图 / 图片上传节点';
    return;
  }

  n.status = 'running';
  n.result = '';
  try {
    const work = await createWorkApi({
      type,
      modelId: model.id,
      prompt,
      image: image || undefined,
      aspectRatio: n.aspectRatio && n.aspectRatio !== '自适应' ? n.aspectRatio : undefined,
      resolution: n.type === 'video' ? n.resolution : undefined,
      duration: n.type === 'video' ? Number(n.duration) || undefined : undefined,
    });
    n.result = work?.resultUrl || '';
    if (n.result) {
      n.status = 'done';
    } else {
      n.status = 'error';
      n.error = work?.error || '生成结果为空，请稍后重试';
    }
    auth.fetchMe().catch(() => {});
  } catch (e: any) {
    n.status = 'error';
    const msg = e?.response?.data?.message;
    n.error = typeof msg === 'string' ? msg : msg?.[0] || '生成失败，请稍后重试';
  }
}

/* ---------- 全链运行 / 保存 ---------- */
async function runWorkflow() {
  if (running.value || saving.value) return;
  if (!nodes.value.length) {
    alert('画布为空，请右键画布添加节点或选择工作流模板');
    return;
  }
  running.value = true;
  try {
    for (const n of nodes.value) {
      if (n.data.type === 'text' || n.data.type === 'upload') continue;
      await generate(n.data);
      if (n.data.status === 'error') break;
    }
  } finally {
    running.value = false;
  }
}

async function saveWorkflow() {
  if (saving.value) return;
  if (!nodes.value.length) {
    alert('画布为空，请先添加节点');
    return;
  }
  saving.value = true;
  try {
    await createWorkApi({
      type: 'CANVAS',
      prompt: JSON.stringify({
        action: '保存画布',
        nodes: nodes.value.map((n: any) => ({
          节点: META[n.data.type as NodeType].name,
          模型: n.data.modelId || '-',
          提示词: n.data.text || '(继承上游)',
        })),
        edges: edges.value.map((e: any) => `${e.source} → ${e.target}`),
      }),
    });
    alert('✅ 画布已保存，可在「后台管理 → 创作历史」中查看');
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    alert(typeof msg === 'string' ? msg : '保存失败，请稍后重试');
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  allModels.value = await listModelsApi().catch(() => []);
});
</script>

<style scoped>
/* ============ 画布页整体（顶部导航下方全部为无限画布） ============ */
.canvas-page {
  position: relative;
  height: calc(100vh - 98px);
  background: #fff;
  overflow: hidden;
}
.canvas-flow { width: 100%; height: 100%; background: #fff; }

/* 顶部悬浮栏 */
.canvas-topbar {
  position: absolute; top: 12px; left: 16px; right: 16px; z-index: 20;
  display: flex; align-items: center; gap: 12px; pointer-events: none;
}
.canvas-topbar > * { pointer-events: auto; }
.ct-back {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 7px 14px; border: 1px solid var(--line, #e5e8ef); border-radius: 999px;
  background: #fff; box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  font-size: 12.5px; font-weight: 600; color: #3b4254; cursor: pointer; font-family: inherit;
}
.ct-back:hover { color: #2b5aed; border-color: #2b5aed; }
.ct-sep { width: 1px; height: 20px; background: #e5e8ef; }
.ct-title { font-weight: 800; font-size: 14.5px; background: #fff; padding: 7px 12px; border-radius: 999px; border: 1px solid var(--line, #e5e8ef); box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08); }
.ct-sub { font-size: 11.5px; color: #8a91a3; }
.ct-actions { margin-left: auto; display: flex; gap: 8px; background: #fff; padding: 6px 10px; border-radius: 12px; border: 1px solid var(--line, #e5e8ef); box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08); }

/* 空画布引导 */
.canvas-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; z-index: 5; }
.empty-card {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 26px 40px; border-radius: 16px; text-align: center;
  background: rgba(255, 255, 255, 0.9); border: 1px dashed #c9d2e3; color: #3b4254; font-size: 13px;
}
.empty-card p { margin: 0; }
.empty-sub { font-size: 11.5px; color: #9aa1af; }

/* 左下缩放控制 */
.canvas-controls {
  position: absolute; bottom: 18px; left: 16px; z-index: 20;
  display: flex; align-items: center; gap: 2px; padding: 5px;
  background: #fff; border: 1px solid var(--line, #e5e8ef); border-radius: 12px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
}
.ctl-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 32px; height: 32px; padding: 0 6px; border: none; border-radius: 8px;
  background: transparent; color: #3b4254; font-size: 15px; cursor: pointer; font-family: inherit;
}
.ctl-btn:hover { background: #eef4ff; color: #2b5aed; }
.ctl-zoom { font-size: 11px; font-weight: 700; min-width: 46px; }
.ctl-divider { width: 1px; height: 18px; background: #eef0f4; margin: 0 4px; }

/* ============ 右键菜单（huobao 风格 · 白色主题） ============ */
.ctx-overlay { position: fixed; inset: 0; z-index: 1100; }
.ctx-menu {
  position: fixed; min-width: 230px; padding: 6px;
  border-radius: 13px; border: 1px solid #e5e8ef;
  background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(16px);
  box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
}
.ctx-title { padding: 7px 10px 5px; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #9aa1af; text-transform: uppercase; }
.ctx-item {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 7px 10px; border: none; border-radius: 8px; background: transparent;
  cursor: pointer; font-size: 12.5px; color: #333a4a; font-family: inherit; text-align: left;
}
.ctx-item:hover { background: #eef4ff; color: #2b5aed; }
.ctx-item.is-danger:hover { background: #fef2f2; color: #ef4444; }
.ctx-item.is-danger:hover .ctx-icon { background: rgba(239, 68, 68, 0.1); }
.ctx-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 7px; background: #eef4ff; font-size: 13px; flex-shrink: 0;
}
.ctx-desc { margin-left: auto; font-size: 10.5px; color: #9aa1af; white-space: nowrap; }
.ctx-item:hover .ctx-desc { color: #7d97ec; }
.ctx-sep { height: 1px; margin: 5px 8px; background: #eef0f4; }
.ctx-kbd {
  margin-left: 8px; padding: 1px 5px; border-radius: 5px;
  border: 1px solid #e5e8ef; background: #f7f8fa; color: #9aa1af; font-size: 9.5px;
}

/* ============ 节点卡片 ============ */
.cn-card {
  width: 320px; background: #fff; border: 2px solid #2b5aed; border-radius: 14px;
  box-shadow: 0 6px 18px rgba(43, 90, 237, 0.13); font-size: 12.5px; overflow: hidden;
}
.cn-card.cn-running { border-color: #e6a23c; box-shadow: 0 6px 18px rgba(230, 162, 60, 0.2); }
.cn-card.cn-error { border-color: #f56c6c; box-shadow: 0 6px 18px rgba(245, 108, 108, 0.18); }
.cn-head {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border-bottom: 1px solid #eef0f4; cursor: move; user-select: none;
  font-weight: 700; font-size: 13px; color: #22293a;
}
.cn-tag { margin-left: auto; font-size: 10.5px; font-weight: 600; color: #2b5aed; background: #eef4ff; padding: 2px 8px; border-radius: 999px; }
.cn-badge { margin-left: auto; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; }
.cn-badge-run { background: #fdf6ec; color: #e6a23c; }
.cn-badge-ok { background: #f0f9eb; color: #67c23a; }
.cn-badge-err { background: #fef0f0; color: #f56c6c; }
.cn-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; cursor: default; }
.cn-row { display: flex; gap: 6px; align-items: center; }
.cn-hint { font-size: 11.5px; color: #67c23a; }
.cn-hint:last-child { color: #6b7280; }
.cn-preview {
  border: 1px dashed #dcdfe6; border-radius: 10px; min-height: 96px;
  display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafbfc;
}
.cn-preview img, .cn-preview video { max-width: 100%; max-height: 180px; display: block; border-radius: 8px; }
.cn-preview audio { width: 92%; }
.cn-preview-audio { min-height: 64px; }
.cn-empty { color: #b3b9c6; font-size: 12px; }
.cn-empty-run { color: #e6a23c; font-size: 12px; padding: 10px; text-align: center; }
.cn-err { color: #f56c6c; font-size: 11.5px; line-height: 1.5; }
.cn-tip { color: #9aa1af; font-size: 11.5px; line-height: 1.5; }
.cn-gen { width: 100%; }

/* 表单控件统一单层细边框（避免框套框） */
.cn-body :deep(.el-textarea__inner),
.cn-body :deep(.el-input__wrapper) {
  box-shadow: none; border: 1px solid #dcdfe6; background: #fff;
}
.cn-body :deep(.el-textarea__inner:hover),
.cn-body :deep(.el-textarea__inner:focus),
.cn-body :deep(.el-input__wrapper:hover),
.cn-body :deep(.el-input__wrapper.is-focus) {
  border-color: #2b5aed;
}
</style>

<style>
/* vue-flow 主题覆盖（非 scoped）：白色学院风 */
.canvas-page .vue-flow__node { padding: 0; border: none; background: transparent; border-radius: 14px; }
.canvas-page .vue-flow__node.selected { box-shadow: none; outline: none; }
.canvas-page .vue-flow__handle {
  width: 13px; height: 13px; border: 2.5px solid #fff; background: #2b5aed;
  transition: transform 0.12s ease;
}
.canvas-page .vue-flow__handle:hover { transform: scale(1.25); }
.canvas-page .vue-flow__handle.connecting { background: #67c23a; }
.canvas-page .vue-flow__edge-path { stroke: #2b5aed; stroke-width: 2; opacity: 0.65; }
.canvas-page .vue-flow__edge.selected .vue-flow__edge-path { stroke: #f97316; opacity: 1; }
.canvas-page .vue-flow__connection-path { stroke: #2b5aed; stroke-width: 2; stroke-dasharray: 6 4; }
.canvas-page .vue-flow__attribution { display: none; }
</style>
