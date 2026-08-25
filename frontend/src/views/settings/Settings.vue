<template>
  <section class="view active">
    <div class="container">
      <div class="settings-head">
        <h2>系统设置</h2>
        <p>超级管理员可在此为各创作类型配置模型及 API 服务商，配置后将在对应创作功能中生效。</p>
      </div>

      <el-alert
        class="settings-note"
        type="warning"
        :closable="false"
        show-icon
        title="「模型名称（model ID）」请填写调用服务商 API 时实际使用的模型标识；API Key 与 Base URL 留空时，OpenAI 格式默认使用平台中转站配置。"
      />

      <div v-for="mt in MODEL_TYPES" :key="mt.key" class="settings-panel">
        <div class="settings-panel-head">
          <div class="settings-panel-title">
            <h3>{{ mt.icon }} {{ mt.label }}</h3>
            <span class="settings-desc">{{ mt.desc }}</span>
          </div>
          <el-button type="primary" :icon="Plus" @click="openAdd(mt)">添加</el-button>
        </div>

        <el-table :data="modelsOf(mt.type)" empty-text="暂未配置模型">
          <el-table-column label="启用" width="70">
            <template #default="{ row }">
              <el-switch :model-value="row.enabled" @change="toggleModel(row)" />
            </template>
          </el-table-column>
          <el-table-column label="模型名称" min-width="150">
            <template #default="{ row }"><b>{{ row.name }}</b></template>
          </el-table-column>
          <el-table-column label="服务商" width="130">
            <template #default="{ row }">
              <el-tag effect="plain" size="small">{{ providerLabel(row.provider) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="调度" width="90">
            <template #default="{ row }">
              <el-tag :type="row.loc === 'CLOUD' ? 'warning' : 'primary'" effect="light" size="small">
                {{ row.loc === 'CLOUD' ? '云端' : '本地' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="消耗" width="90">
            <template #default="{ row }">{{ row.cost }} 点/次</template>
          </el-table-column>
          <el-table-column label="操作" width="130">
            <template #default="{ row }">
              <el-button size="small" type="primary" text @click="openEdit(row)">编辑</el-button>
              <el-button size="small" type="danger" text @click="removeModel(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-dialog v-model="addVisible" :title="addTitle" width="540px" @closed="resetAddForm">
      <el-form label-width="110px">
        <el-form-item label="模型名称">
          <el-input v-model="addForm.name" placeholder="显示名称（如：中转站Qwen3.6）" />
        </el-form-item>
        <el-form-item label="服务商">
          <el-select v-model="addForm.provider" style="width: 100%">
            <el-option v-for="p in PROVIDERS" :key="p.value" :value="p.value" :label="p.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名称(ID)">
          <el-input v-model="addForm.externalId" placeholder="调用 API 时的实际模型标识（如：Qwen3.6-27B）" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="addForm.apiKey" show-password placeholder="留空则使用当前登录用户 SSO 带入的 API Key" />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="addForm.baseUrl" placeholder="服务商接口地址，留空则使用平台默认中转站" />
        </el-form-item>
        <el-form-item label="调度">
          <el-select v-model="addForm.loc" style="width: 100%">
            <el-option label="云端" value="CLOUD" />
            <el-option label="本地" value="LOCAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="消耗">
          <el-input-number v-model="addForm.cost" :min="1" :max="100000" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="addModel">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑模型" width="540px">
      <el-form label-width="110px">
        <el-form-item label="模型名称">
          <el-input v-model="editForm.name" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="服务商">
          <el-select v-model="editForm.provider" style="width: 100%">
            <el-option v-for="p in PROVIDERS" :key="p.value" :value="p.value" :label="p.label" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名称(ID)">
          <el-input v-model="editForm.externalId" placeholder="调用 API 时的实际模型标识" />
        </el-form-item>
        <el-form-item label="API Key">
          <el-input v-model="editForm.apiKey" show-password placeholder="留空则使用当前登录用户 SSO 带入的 API Key" />
        </el-form-item>
        <el-form-item label="Base URL">
          <el-input v-model="editForm.baseUrl" placeholder="服务商接口地址" />
        </el-form-item>
        <el-form-item label="调度">
          <el-select v-model="editForm.loc" style="width: 100%">
            <el-option label="云端" value="CLOUD" />
            <el-option label="本地" value="LOCAL" />
          </el-select>
        </el-form-item>
        <el-form-item label="消耗">
          <el-input-number v-model="editForm.cost" :min="1" :max="100000" controls-position="right" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveEdit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { Plus } from '@element-plus/icons-vue';
import { MODEL_TYPES } from '../../data/prototype';
import { listAllModelsApi, createModelApi, updateModelApi, deleteModelApi } from '../../api';

const PROVIDERS = [
  { value: 'OPENAI', label: 'OpenAI 格式' },
  { value: 'DEEPSEEK', label: 'DeepSeek 格式' },
  { value: 'DASHSCOPE', label: 'DashScope 格式' },
  { value: 'CLAUDE', label: 'Claude 格式' },
  { value: 'COMFYUI', label: 'ComfyUI 格式' },
];

const models = ref<any[]>([]);

const emptyAdd = () => ({
  name: '',
  loc: 'CLOUD',
  cost: 1,
  provider: 'OPENAI',
  apiKey: '',
  baseUrl: '',
  externalId: '',
});

const addVisible = ref(false);
const addType = reactive({ type: '', label: '' });
const addForm = reactive(emptyAdd());
const addTitle = computed(() => (addType.label ? `添加模型 · ${addType.label}` : '添加模型'));

const editVisible = ref(false);
const editId = ref('');
const editForm = reactive(emptyAdd());

function providerLabel(v?: string) {
  return PROVIDERS.find((p) => p.value === String(v || '').toUpperCase())?.label || v || '未知';
}

function modelsOf(type: string) {
  return models.value.filter((m) => m.type === type);
}

async function loadModels() {
  models.value = await listAllModelsApi().catch(() => []);
}

async function toggleModel(m: any) {
  try {
    await updateModelApi(m.id, { enabled: !m.enabled });
    m.enabled = !m.enabled;
  } catch (e: any) {
    alert(e?.response?.data?.message || '操作失败');
  }
}

function openEdit(row: any) {
  editId.value = row.id;
  editForm.name = row.name;
  editForm.provider = String(row.provider || 'OPENAI').toUpperCase();
  editForm.externalId = row.externalId || '';
  editForm.apiKey = row.apiKey || '';
  editForm.baseUrl = row.baseUrl || '';
  editForm.loc = row.loc || 'CLOUD';
  editForm.cost = row.cost ?? 1;
  editVisible.value = true;
}

async function saveEdit() {
  if (!editForm.name.trim()) {
    alert('请输入模型名称');
    return;
  }
  try {
    await updateModelApi(editId.value, {
      name: editForm.name.trim(),
      provider: editForm.provider,
      externalId: editForm.externalId.trim(),
      apiKey: editForm.apiKey,
      baseUrl: editForm.baseUrl,
      loc: editForm.loc,
      cost: editForm.cost,
    });
    editVisible.value = false;
    await loadModels();
  } catch (e: any) {
    alert(e?.response?.data?.message || '保存失败');
  }
}

async function removeModel(m: any) {
  try {
    await deleteModelApi(m.id);
    await loadModels();
  } catch (e: any) {
    alert(e?.response?.data?.message || '删除失败');
  }
}

function openAdd(mt: { key: string; type: string; label: string }) {
  addType.type = mt.type;
  addType.label = mt.label;
  Object.assign(addForm, emptyAdd());
  addVisible.value = true;
}

function resetAddForm() {
  Object.assign(addForm, emptyAdd());
}

async function addModel() {
  const name = addForm.name.trim();
  if (!name) {
    alert('请输入模型名称');
    return;
  }
  if (!addForm.externalId.trim()) {
    alert('请输入模型名称（model ID）');
    return;
  }
  try {
    await createModelApi({
      name,
      type: addType.type,
      provider: addForm.provider,
      externalId: addForm.externalId.trim(),
      apiKey: addForm.apiKey,
      baseUrl: addForm.baseUrl,
      loc: addForm.loc,
      cost: addForm.cost || 1,
    });
    addVisible.value = false;
    await loadModels();
  } catch (e: any) {
    alert(e?.response?.data?.message || '添加失败');
  }
}

onMounted(loadModels);
</script>

<style scoped>
.settings-note {
  margin-bottom: 18px;
}
</style>