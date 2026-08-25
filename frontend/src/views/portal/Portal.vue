<template>
  <section class="view active">
    <div class="container">
      <div class="hero">
        <h1>AIGC 创作平台</h1>
        <p>文生图 · 图生图 · 文生视频 · 图生视频 · 创作画布 · AI对话 —— 一站式 AIGC 内容创作工作台</p>
        <div class="hero-stats">
          <span><b>{{ TOOLS.length }}</b>款功能</span>
          <span><b>4</b>大类别</span>
          <span><b>{{ statsTotal }}</b>次累计创作</span>
          <span v-if="auth.user"><b>{{ auth.user.quotaBalance }}</b>点可用算力</span>
        </div>
        <div class="search-row">
          <el-input
            v-model="curKw"
            placeholder="搜索功能，如：文生图 / 图生视频"
            size="large"
            clearable
            @keyup.enter="doSearch"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-button type="primary" size="large" class="search-btn" @click="doSearch">搜索</el-button>
        </div>
      </div>

      <div class="cat-row">
        <button
          v-for="c in CATS"
          :key="c.id"
          class="cat-chip"
          :class="{ active: curCat === c.id }"
          @click="setCat(c.id)"
        >{{ c.icon }} {{ c.name }}</button>
      </div>

      <div class="tool-grid">
        <template v-if="list.length">
          <div v-for="t in list" :key="t.id" class="tool-card" @click="showTool(t)">
            <div class="tool-head">
              <div class="tool-icon">{{ t.icon }}</div>
              <div>
                <div class="tool-name">
                  {{ t.name }}
                  <span v-if="t.featured" class="star">★</span>
                  <span v-if="t.status === 'maintaining'" class="badge badge-maintain">维护中</span>
                </div>
                <div class="tool-slogan">{{ t.slogan }}</div>
              </div>
            </div>
            <div class="tool-tags">
              <span class="tag tag-cat">{{ t.catName }}</span>
              <span v-for="x in t.tags" :key="x" class="tag">{{ x }}</span>
            </div>
            <div class="tool-foot">
              <div class="tool-metrics">
                <span><el-icon><View /></el-icon> {{ fmt(useCount(t)) }}</span>
                <span v-if="t.sched === 'cloud'" class="loc-badge loc-cloud">云端渲染</span>
                <template v-else-if="t.sched === 'hybrid'">
                  <span class="loc-badge loc-local">本地</span>
                  <span class="loc-badge loc-cloud">云端</span>
                </template>
                <span v-else class="loc-badge loc-local">本地推理</span>
              </div>
              <el-button type="primary" size="small" @click.stop="showTool(t)">立即创作 →</el-button>
            </div>
          </div>
        </template>
        <div v-else class="empty-tip" style="grid-column:1/-1;">
          没有找到匹配的功能，换个关键词试试
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  CATS, TOOLS, fmt, toolWorkType, type Tool,
} from '../../data/prototype';
import { workStatsApi } from '../../api';
import { useAuthStore } from '../../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const curCat = ref('all');
const curKw = ref('');
const kw = ref('');

/** 平台真实统计（数据库聚合） */
const stats = ref<{ total: number; byType: Record<string, number> }>({
  total: 0,
  byType: {},
});

onMounted(async () => {
  stats.value = await workStatsApi().catch(() => ({ total: 0, byType: {} }));
});

const statsTotal = computed(() => fmt(stats.value.total));

function useCount(t: Tool): number {
  return stats.value.byType[toolWorkType(t)] || 0;
}

const list = computed(() =>
  TOOLS.filter(
    (t) =>
      (curCat.value === 'all' || t.cat === curCat.value) &&
      (!kw.value || t.name.includes(kw.value) || t.slogan.includes(kw.value) || t.tags.some((x) => x.includes(kw.value))),
  ),
);

function setCat(id: string) {
  curCat.value = id;
}

function doSearch() {
  kw.value = curKw.value.trim();
}

function showTool(t: Tool) {
  if (t.out === 'canvas') {
    router.push('/tool/canvas');
  } else if (t.out === 'chat') {
    router.push('/tool/chat');
  } else {
    router.push(`/tool/${t.id}`);
  }
}
</script>