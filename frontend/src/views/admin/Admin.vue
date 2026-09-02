<template>
  <section class="view active">
    <div class="container">
      <div class="mgmt-wrap">
        <aside class="mgmt-sidebar">
          <div class="role-banner">
            <div class="role-name">{{ role.icon }} {{ role.name }}</div>
            <div class="role-sub">{{ role.desc }}</div>
          </div>
          <el-menu
            class="mgmt-menu"
            :default-active="curSection"
            @select="(id) => (curSection = id)"
          >
            <el-menu-item v-for="n in nav" :key="n.id" :index="n.id">
              <span class="mgmt-menu-label">{{ n.icon }} {{ n.name }}</span>
            </el-menu-item>
          </el-menu>
        </aside>

        <main class="mgmt-main">
          <div v-if="loading" class="empty-tip">数据加载中…</div>

          <!-- ========== 管理员 · 创作历史（真实数据） ========== -->
          <template v-else-if="curSection === 'a-history'">
            <div class="mgmt-head"><h2>创作历史</h2><p>查看个人全部 AIGC 创作记录与消耗展示</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ myWorks.length }}</div><div class="label">累计创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ historyCost }}<small> 点</small></div><div class="label">累计消耗</div></div>
              <div class="kpi-card"><div class="num">{{ monthWorks.length }}</div><div class="label">本月创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ monthCost }}<small> 点</small></div><div class="label">本月消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>最近创作记录</h3>
              <el-table :data="myWorks" stripe empty-text="暂无创作记录，去「AIGC创作平台」试试吧">
                <el-table-column label="时间" width="160">
                  <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="功能" min-width="120">
                  <template #default="{ row }">{{ WORK_TYPE_LABEL[row.type] || row.type }}</template>
                </el-table-column>
                <el-table-column label="模型" min-width="140">
                  <template #default="{ row }">{{ row.model?.name || '—' }}</template>
                </el-table-column>
                <el-table-column label="消耗" width="90">
                  <template #default="{ row }">{{ row.cost }} 点</template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="workTagType(row.status)" effect="light">{{ workStatusLabel(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="90">
                  <template #default="{ row }">
                    <el-button size="small" text type="primary" @click="viewWork(row)">查看</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 管理员 · 全局看板（真实数据） ========== -->
          <template v-else-if="curSection === 'a-overview'">
            <div class="mgmt-head"><h2>全局看板</h2><p>平台整体运营数据概览（实时数据库统计）</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ stats?.userTotal ?? '—' }}</div><div class="label">注册用户</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.workTotal ?? '—' }}</div><div class="label">累计创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.monthCost ?? '—' }}<small> 点</small></div><div class="label">本月消耗</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.successRate ?? '—' }}<small>%</small></div><div class="label">任务成功率</div></div>
            </div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ stats?.userCount ?? '—' }}</div><div class="label">用户数</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.adminCount ?? '—' }}</div><div class="label">管理员数</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.modelCount ?? '—' }}</div><div class="label">已配置模型</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.totalCost ?? '—' }}<small> 点</small></div><div class="label">历史总消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>模型资源（已启用模型）</h3>
              <div class="usage-legend"><i style="background:var(--primary)"></i>本地推理<i style="background:var(--accent)"></i>云端渲染</div>
              <div v-for="m in models" :key="m.id" class="model-row">
                <div>
                  <div class="model-name">{{ m.name }}</div>
                  <div class="model-type">{{ MODEL_TYPES.find((x) => x.type === m.type)?.label || m.type }} · {{ m.cost }} 点/次</div>
                </div>
                <el-tag :type="m.loc === 'CLOUD' ? 'warning' : 'primary'" effect="light" size="small">{{ m.loc === 'CLOUD' ? '云端' : '本地' }}</el-tag>
              </div>
              <div v-if="!models.length" class="empty-tip">暂无已启用模型</div>
            </div>
          </template>

          <!-- ========== 管理员 · 审计日志（真实数据） ========== -->
          <template v-else-if="curSection === 'a-audit'">
            <div class="mgmt-head"><h2>审计日志</h2><p>系统关键操作日志（最近 100 条）</p></div>
            <div class="mgmt-panel">
              <h3>操作日志</h3>
              <template v-if="logs.length">
                <div v-for="l in logs" :key="l.id" class="log-item">
                  <div class="log-time">{{ fmtTime(l.createdAt) }}</div>
                  <div class="log-dot" :class="logLevelClass(l.action)"></div>
                  <div class="log-body"><b>{{ l.user?.name || '系统' }}</b>（{{ l.user?.username || '—' }}）{{ l.action }} —— {{ l.detail || '—' }}</div>
                </div>
              </template>
              <div v-else class="empty-tip">暂无日志</div>
            </div>
          </template>

          <!-- ========== 管理员 · 运营趋势（真实数据） ========== -->
          <template v-else-if="curSection === 'a-trend'">
            <div class="mgmt-head"><h2>运营趋势</h2><p>平台各功能使用分布与模型清单</p></div>
            <div class="mgmt-panel">
              <h3>功能使用分布（本地 / 云端）</h3>
              <div class="usage-legend"><i style="background:var(--primary)"></i>本地推理<i style="background:var(--accent)"></i>云端渲染</div>
              <template v-if="usage?.byType?.length">
                <div v-for="u in usage.byType" :key="u.type" class="usage-row">
                  <div class="usage-name">{{ WORK_TYPE_LABEL[u.type] || u.type }}</div>
                  <div class="usage-bar">
                    <div class="u-local" :style="{ width: Math.round(u.local / Math.max(1, u.local + u.cloud) * 100) + '%' }"></div>
                    <div class="u-cloud" :style="{ width: 100 - Math.round(u.local / Math.max(1, u.local + u.cloud) * 100) + '%' }"></div>
                  </div>
                  <div class="usage-val"><b>{{ u.count }}</b> 次</div>
                </div>
              </template>
              <div v-else class="empty-tip">暂无创作数据</div>
            </div>
            <div class="mgmt-panel">
              <h3>可用模型清单</h3>
              <div v-for="m in models" :key="m.id" class="model-row">
                <div>
                  <div class="model-name">{{ m.name }}</div>
                  <div class="model-type">{{ MODEL_TYPES.find((x) => x.type === m.type)?.label || m.type }} · {{ m.cost }} 点/次</div>
                </div>
                <el-tag :type="m.loc === 'CLOUD' ? 'warning' : 'primary'" effect="light" size="small">{{ m.loc === 'CLOUD' ? '云端' : '本地' }}</el-tag>
              </div>
              <div v-if="!models.length" class="empty-tip">暂无已启用模型</div>
            </div>
          </template>

          <!-- ========== 管理员 · 用户管理（真实数据） ========== -->
          <template v-else-if="curSection === 'a-users'">
            <div class="mgmt-head"><h2>用户管理</h2><p>查看平台用户账号的创作与使用情况</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ userStats.length }}</div><div class="label">用户总数</div></div>
              <div class="kpi-card"><div class="num">{{ activeUsers }}</div><div class="label">已使用平台用户</div></div>
              <div class="kpi-card"><div class="num">{{ userTotalCost }}<small> 点</small></div><div class="label">用户累计消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>用户列表</h3>
              <el-table :data="userStats" stripe empty-text="暂无用户账号">
                <el-table-column label="账号" width="130">
                  <template #default="{ row }">{{ row.username }}</template>
                </el-table-column>
                <el-table-column label="姓名" width="110">
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column label="创作次数" width="100">
                  <template #default="{ row }">{{ row.workCount }}</template>
                </el-table-column>
                <el-table-column label="累计消耗" width="110">
                  <template #default="{ row }">{{ row.totalCost }} 点</template>
                </el-table-column>
                <el-table-column label="最近活跃" width="120">
                  <template #default="{ row }">{{ fmtDate(row.lastActiveAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 超管 · 权限管理（真实数据） ========== -->
          <template v-else-if="curSection === 's-perms'">
            <div class="mgmt-head"><h2>权限管理</h2><p>分配各账号的权限等级：用户 / 管理员 / 超级管理员</p></div>
            <div class="mgmt-panel">
              <h3>账号权限分配</h3>
              <el-table :data="users" stripe>
                <el-table-column label="账号" width="150">
                  <template #default="{ row }"><b>{{ row.username }}</b></template>
                </el-table-column>
                <el-table-column label="姓名" width="140">
                  <template #default="{ row }">{{ row.name }}</template>
                </el-table-column>
                <el-table-column label="当前权限" width="180">
                  <template #default="{ row }">
                    <el-tag :type="permTagType(userPermKey(row))" effect="light">{{ PERM_LABELS[userPermKey(row)] }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="修改权限" min-width="200">
                  <template #default="{ row }">
                    <el-select :model-value="userPermKey(row)" style="width: 180px" @change="(v) => assignPerm(row, v)">
                      <el-option v-for="(label, k) in PERM_LABELS" :key="k" :label="label" :value="k" />
                    </el-select>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 超管 · 用户管理（真实数据） ========== -->
          <template v-else-if="curSection === 's-users'">
            <div class="mgmt-head"><h2>用户管理</h2><p>管理全部账号的使用情况，可重置密码</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ allStats.length }}</div><div class="label">账号总数</div></div>
              <div class="kpi-card"><div class="num">{{ allWorkTotal }}</div><div class="label">累计创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ allCostTotal }}<small> 点</small></div><div class="label">累计消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>账号列表</h3>
              <el-table :data="allStats" stripe empty-text="暂无账号">
                <el-table-column label="账号" width="130">
                  <template #default="{ row }">{{ row.username }}</template>
                </el-table-column>
                <el-table-column label="姓名" width="120">
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column label="角色" width="130">
                  <template #default="{ row }">
                    <el-tag :type="permTagType(userPermKey(row))" effect="light">{{ PERM_LABELS[userPermKey(row)] }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创作次数" width="100">
                  <template #default="{ row }">{{ row.workCount }}</template>
                </el-table-column>
                <el-table-column label="累计消耗" width="110">
                  <template #default="{ row }">{{ row.totalCost }} 点</template>
                </el-table-column>
                <el-table-column label="最近活跃" min-width="110">
                  <template #default="{ row }">{{ fmtDate(row.lastActiveAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="110">
                  <template #default="{ row }">
                    <el-button size="small" @click="resetPassword(row)">重置密码</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <div v-else class="empty-tip">建设中</div>
        </main>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  ROLES, ROLE_NAV, PERM_LABELS, MODEL_TYPES, WORK_TYPE_LABEL, fmtTime,
} from '../../data/prototype';
import {
  listUsersApi, updateUserApi, listWorksApi, listModelsApi,
  adminStatsApi, auditListApi, adminUsageApi, adminUserStatsApi,
} from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const curSection = ref('a-history');
const loading = ref(false);

const role = computed(() => ROLES[auth.backendRole] || ROLES.admin);
const nav = computed(() => ROLE_NAV[auth.backendRole] || ROLE_NAV.admin);

/* ---------- 各分区真实数据 ---------- */
const myWorks = ref<any[]>([]);
const userStats = ref<any[]>([]);
const allStats = ref<any[]>([]);
const stats = ref<any>(null);
const usage = ref<any>(null);
const models = ref<any[]>([]);
const logs = ref<any[]>([]);
const users = ref<any[]>([]);

/* ---------- 创作历史统计 ---------- */
const historyCost = computed(() => myWorks.value.reduce((s, w) => s + (w.cost || 0), 0));
const monthWorks = computed(() => {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return myWorks.value.filter((w) => String(w.createdAt || '').startsWith(prefix));
});
const monthCost = computed(() => monthWorks.value.reduce((s, w) => s + (w.cost || 0), 0));

/* ---------- 用户统计 ---------- */
const activeUsers = computed(() => userStats.value.filter((s) => s.workCount > 0).length);
const userTotalCost = computed(() => userStats.value.reduce((s, x) => s + x.totalCost, 0));
const allWorkTotal = computed(() => allStats.value.reduce((s, t) => s + t.workCount, 0));
const allCostTotal = computed(() => allStats.value.reduce((s, t) => s + t.totalCost, 0));

function workTagType(s: string): 'warning' | 'success' | 'danger' | 'info' {
  if (s === 'SUCCEEDED') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'PROCESSING') return 'warning';
  return 'info';
}

/* ---------- 状态样式 ---------- */
function workStatusLabel(s: string): string {
  return ({ PENDING: '排队中', PROCESSING: '生成中', SUCCEEDED: '已完成', FAILED: '失败' } as Record<string, string>)[s] || s;
}
function logLevelClass(action: string): string {
  if (action.includes('通过')) return 'success';
  if (action.includes('驳回') || action.includes('删除')) return 'error';
  if (action.includes('变更') || action.includes('权限')) return 'warn';
  return 'info';
}
function fmtDate(s: string | null): string {
  return s ? fmtTime(s).slice(0, 10) : '—';
}

function viewWork(w: any) {
  if (w.resultUrl) {
    window.open(w.resultUrl, '_blank');
  } else if (w.resultText) {
    alert(w.resultText);
  } else if (w.status === 'FAILED') {
    alert('生成失败：' + (w.error || '未知原因'));
  } else {
    alert('该记录暂无可查看的结果');
  }
}

/* ---------- 权限管理 ---------- */
function userPermKey(u: any): string {
  if (u.role === 'SUPER_ADMIN') return 'super';
  if (u.role === 'ADMIN') return 'admin';
  return 'user';
}
function permTagType(key: string): 'info' | 'success' | 'warning' | 'danger' {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
    user: 'info', admin: 'success', super: 'danger',
  };
  return map[key] || 'info';
}
async function assignPerm(u: any, key: string) {
  const payload: any =
    key === 'super' ? { role: 'SUPER_ADMIN' }
    : key === 'admin' ? { role: 'ADMIN' }
    : { role: 'USER' };
  try {
    await updateUserApi(u.id, payload);
    await loadSection('s-perms', true);
    if (auth.user?.id === u.id) await auth.fetchMe().catch(() => {});
  } catch (e: any) {
    alert(e?.response?.data?.message || '权限修改失败');
    await loadSection('s-perms', true);
  }
}

/* ---------- 密码操作 ---------- */
async function resetPassword(u: any) {
  const pwd = prompt(`为「${u.name}（${u.username}）」设置新密码（至少 6 位）：`, '');
  if (pwd === null) return;
  if (pwd.length < 6) {
    alert('密码至少 6 位');
    return;
  }
  try {
    await updateUserApi(u.id, { password: pwd });
    alert('✅ 密码已重置');
  } catch (e: any) {
    alert(e?.response?.data?.message || '重置失败');
  }
}

/* ---------- 分区数据加载（真实接口，按需加载） ---------- */
const loaded = ref<Record<string, boolean>>({});

async function loadSection(id: string, force = false) {
  if (!force && loaded.value[id]) return;
  loading.value = true;
  try {
    switch (id) {
      case 'a-history':
        myWorks.value = await listWorksApi({ size: 100 }).catch(() => []);
        break;
      case 'a-overview':
        [stats.value, usage.value, models.value] = await Promise.all([
          adminStatsApi().catch(() => null),
          adminUsageApi().catch(() => null),
          listModelsApi().catch(() => []),
        ]);
        break;
      case 'a-audit':
        logs.value = await auditListApi().catch(() => []);
        break;
      case 'a-trend':
        [usage.value, models.value] = await Promise.all([
          adminUsageApi().catch(() => null),
          listModelsApi().catch(() => []),
        ]);
        break;
      case 'a-users':
        userStats.value = await adminUserStatsApi('USER').catch(() => []);
        break;
      case 's-perms':
        users.value = await listUsersApi({}).catch(() => []);
        break;
      case 's-users':
        allStats.value = await adminUserStatsApi().catch(() => []);
        break;
    }
    loaded.value[id] = true;
  } finally {
    loading.value = false;
  }
}

watch(curSection, (id) => loadSection(id));

onMounted(() => {
  curSection.value = nav.value[0]?.id || 'a-history';
  loadSection(curSection.value);
});
</script>

<style scoped>
.mgmt-menu {
  border-right: none;
}
.mgmt-menu :deep(.el-menu-item) {
  height: 44px;
  border-radius: 10px;
  margin-bottom: 2px;
}
.mgmt-menu :deep(.el-menu-item.is-active) {
  background: #e9eefd;
  color: var(--primary);
  font-weight: 600;
}
.mgmt-menu-label {
  font-size: 13.5px;
}
.mgmt-panel :deep(.el-table) {
  --el-table-border-color: var(--light);
}
</style>
