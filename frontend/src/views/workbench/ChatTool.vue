<template>
  <section class="view active">
    <div class="container">
      <button class="back-link" @click="$router.push('/')">
        <el-icon><ArrowLeft /></el-icon> 返回功能门户
      </button>

      <div class="detail-head">
        <div class="detail-icon">{{ t.icon }}</div>
        <div class="detail-title">
          <h2>{{ t.name }}</h2>
          <div class="tool-slogan">{{ t.slogan }}</div>
          <div class="detail-metrics">
            <span><el-icon><ChatDotRound /></el-icon> {{ fmt(t.uses) }} 次使用</span>
            <span><el-icon><Folder /></el-icon> {{ t.catName }}</span>
            <span><el-icon><Cpu /></el-icon> {{ models.length }} 款模型可选</span>
            <span class="loc-badge loc-local">本地</span>
            <span class="loc-badge loc-cloud">云端</span>
          </div>
        </div>
      </div>

      <div class="chat-container">
        <div class="chat-top-bar">
          <div class="chat-top-left">
            <el-button type="primary" :icon="Plus" @click="newChatThread">创建新对话</el-button>
            <div class="chat-model-row">
              <span class="chat-model-label">模型</span>
              <el-select
                v-model="curModel"
                placeholder="选择模型"
                style="width: 260px"
                :disabled="!models.length"
              >
                <el-option
                  v-for="(m, i) in models"
                  :key="m.id"
                  :value="i"
                  :label="`${m.name} · ${m.loc === 'CLOUD' ? '云端' : '本地'} · ${m.cost}点/次`"
                />
              </el-select>
            </div>
          </div>
          <div class="chat-stats">
            <span>当前点数: <b>{{ auth.user?.quotaBalance ?? 0 }}</b></span>
            <span>总tokens数: <b>{{ chatTokens }}</b></span>
            <span>消耗点数: <b>{{ chatCost }}</b></span>
            <span>对话轮数: <b>{{ chatTurns }}</b></span>
          </div>
        </div>

        <div ref="chatBody" class="chat-body">
          <div v-if="chatMessages.length === 0" class="chat-welcome">
            <h2>AI 对话助手</h2>
            <p>智能对话助手，支持创意问答、提示词优化、脚本整理与日常灵感辅助。</p>
            <div class="chat-prompts">
              <div
                v-for="(p, i) in CHAT_PROMPTS"
                :key="i"
                class="chat-prompt-card"
                @click="useQuickPrompt(p.desc)"
              >
                <div class="prompt-title">{{ p.title }}</div>
                <div class="prompt-desc">{{ p.desc }}</div>
              </div>
            </div>
          </div>

          <div v-for="(m, i) in chatMessages" :key="i" class="chat-msg" :class="m.role">
            <el-avatar :size="38" class="chat-avatar" :class="m.role">
              {{ m.role === 'assistant' ? 'AI' : auth.user?.name?.[0] || '我' }}
            </el-avatar>
            <div class="chat-bubble">
              <template v-if="m.loading">
                <span class="typing"><i></i><i></i><i></i></span>
              </template>
              <template v-else>{{ m.content }}</template>
            </div>
          </div>
        </div>

        <div class="chat-input-area">
          <div class="chat-input-wrap">
            <el-input
              ref="chatInput"
              v-model="input"
              type="textarea"
              :rows="1"
              resize="none"
              placeholder="输入你的问题...（Shift+Enter 换行，Enter 发送）"
              @keydown="chatInputKey"
              @input="autoResize"
            />
            <el-button
              class="chat-send"
              type="primary"
              :loading="sending"
              @click="sendChatMsg"
            >发送</el-button>
          </div>
          <div class="chat-input-hint">
            Shift+Enter 换行 ｜ Enter 发送 ｜ 当前模型：{{ curModelObj ? `${curModelObj.name}（${curModelObj.loc === 'CLOUD' ? '云端' : '本地'} · ${curModelObj.cost}点/次）` : '未配置可用模型' }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { TOOLS, CHAT_PROMPTS, fmt } from '../../data/prototype';
import { listModelsApi, createWorkApi } from '../../api';
import { useAuthStore } from '../../stores/auth';

const t = TOOLS.find((x) => x.out === 'chat')!;
const auth = useAuthStore();

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  loading?: boolean;
}

const models = ref<any[]>([]);
const curModel = ref(0);
const chatMessages = ref<Msg[]>([]);
const input = ref('');
const chatTokens = ref(0);
const chatCost = ref(0);
const chatTurns = ref(0);
const chatBody = ref<HTMLElement | null>(null);
const chatInput = ref<any>(null);
const sending = ref(false);

const curModelObj = computed(() => models.value[curModel.value]);

async function loadModels() {
  const all = await listModelsApi().catch(() => []);
  models.value = all.filter((m: any) => m.type === 'TEXT');
  curModel.value = 0;
}

function newChatThread() {
  chatMessages.value = [];
  chatTokens.value = 0;
  chatCost.value = 0;
  chatTurns.value = 0;
  curModel.value = 0;
}

function useQuickPrompt(text: string) {
  input.value = text;
  chatInput.value?.focus();
}

function chatInputKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMsg();
  }
}

function autoResize() {
  const ta = chatInput.value?.$el?.querySelector('textarea');
  if (ta) {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }
}

function scrollChatBottom() {
  nextTick(() => {
    if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight;
  });
}

async function sendChatMsg() {
  const text = input.value.trim();
  if (!text || sending.value) return;
  const model = curModelObj.value;
  if (!model) {
    alert('当前未配置可用的文本模型');
    return;
  }
  sending.value = true;
  chatMessages.value.push({ role: 'user', content: text });
  chatTurns.value++;
  chatTokens.value += Math.round(text.length / 2);
  chatCost.value += model.cost;
  input.value = '';
  if (chatInput.value) {
    const ta = chatInput.value.$el?.querySelector('textarea');
    if (ta) ta.style.height = 'auto';
  }
  scrollChatBottom();

  chatMessages.value.push({ role: 'assistant', content: '', loading: true });
  scrollChatBottom();

  try {
    const work = await createWorkApi({ type: 'TEXT', modelId: model.id, prompt: text });
    const reply =
      work?.resultText ||
      '抱歉，暂时没有生成内容，请稍后重试。';
    chatMessages.value[chatMessages.value.length - 1] = { role: 'assistant', content: reply };
    chatTokens.value += Math.round(reply.length / 2);
    chatCost.value += model.cost;
    auth.fetchMe().catch(() => {});
  } catch (e: any) {
    const msg = e?.response?.data?.message;
    chatMessages.value[chatMessages.value.length - 1] = {
      role: 'assistant',
      content: '生成失败：' + (typeof msg === 'string' ? msg : '请稍后重试'),
    };
  } finally {
    sending.value = false;
    scrollChatBottom();
  }
}

onMounted(() => {
  loadModels();
  chatInput.value?.focus();
});
</script>

<style scoped>
.chat-avatar {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
}
.chat-avatar.assistant {
  background: #e9eefd;
  color: var(--primary);
}
.chat-avatar.user {
  background: var(--primary);
  color: #fff;
}
.chat-input-wrap .el-textarea__inner {
  box-shadow: none;
  padding: 14px 80px 14px 16px;
  font-size: 13.5px;
  line-height: 1.6;
  min-height: 52px;
}

.typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
}
.typing i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--gray);
  animation: blink 1.2s infinite both;
}
.typing i:nth-child(2) { animation-delay: 0.2s; }
.typing i:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
}
</style>