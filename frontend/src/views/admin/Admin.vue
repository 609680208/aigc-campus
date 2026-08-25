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

          <!-- ========== 老师 · 创作历史（真实数据） ========== -->
          <template v-else-if="curSection === 't-history'">
            <div class="mgmt-head"><h2>创作历史</h2><p>查看个人全部 AIGC 创作记录与算力消耗</p></div>
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

          <!-- ========== 老师 · 班级概览（真实数据） ========== -->
          <template v-else-if="curSection === 't-classes'">
            <div class="mgmt-head"><h2>班级概览</h2><p>全校已登记班级与学生人数一览</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ classes.length }}</div><div class="label">班级总数</div></div>
              <div class="kpi-card"><div class="num">{{ classStudentTotal }}</div><div class="label">已分班学生数</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>班级列表</h3>
              <el-table :data="classes" stripe empty-text="暂无班级数据">
                <el-table-column label="班级名称" min-width="160">
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column label="年级" min-width="120">
                  <template #default="{ row }">{{ row.grade || '—' }}</template>
                </el-table-column>
                <el-table-column label="学生数" width="120">
                  <template #default="{ row }">{{ row._count?.students ?? 0 }} 人</template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 老师 · 算力配额（真实数据） ========== -->
          <template v-else-if="curSection === 't-quota'">
            <div class="mgmt-head"><h2>算力配额</h2><p>查看个人配额使用情况，可向学校申请额外算力</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ quotaUsed }}<small> / {{ quotaTotal }} 点</small></div><div class="label">已用 / 累计获得</div></div>
              <div class="kpi-card"><div class="num">{{ quotaPct }}%</div><div class="label">使用率</div></div>
              <div class="kpi-card"><div class="num">{{ auth.user?.quotaBalance ?? 0 }}</div><div class="label">当前剩余配额</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>配额使用情况</h3>
              <el-progress :percentage="quotaPct" :stroke-width="14" :status="quotaPct > 85 ? 'warning' : undefined" />
              <div style="font-size:11.5px;color:var(--gray);margin-top:8px">累计创作 {{ myWorks.length }} 次 · 剩余配额可在页眉右侧「⚡」处实时查看</div>
            </div>
            <div class="mgmt-panel">
              <h3>申请额外算力</h3>
              <el-form label-position="top" style="max-width: 520px">
                <el-form-item label="申请额度（算力点）">
                  <el-input v-model="quotaReqAmount" placeholder="如：300" />
                </el-form-item>
                <el-form-item label="申请理由">
                  <el-input v-model="quotaReqReason" type="textarea" :rows="3" placeholder="如：毕业设计视频渲染，需额外 300 点" />
                </el-form-item>
                <el-button type="primary" @click="submitQuotaReq">提交申请</el-button>
              </el-form>
              <div style="font-size:11.5px;color:var(--gray);margin-top:10px">提示：单次申请超过 500 点需校领导审批，通过后自动到账。</div>
            </div>
            <div class="mgmt-panel">
              <h3>我的申请记录</h3>
              <el-table :data="myApprovals" stripe empty-text="暂无申请记录">
                <el-table-column label="提交时间" width="160">
                  <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="类型" width="120">
                  <template #default="{ row }">{{ row.type }}</template>
                </el-table-column>
                <el-table-column label="额度" width="100">
                  <template #default="{ row }">{{ row.amount }} 点</template>
                </el-table-column>
                <el-table-column label="理由" min-width="180">
                  <template #default="{ row }">{{ row.reason || '—' }}</template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                  <template #default="{ row }">
                    <el-tag :type="approvalTagType(row.status)" effect="light">{{ approvalStatusLabel(row.status) }}</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 老师/超管 · 学生管理（真实数据） ========== -->
          <template v-else-if="curSection === 't-students' || curSection === 's-students'">
            <div class="mgmt-head">
              <h2>学生管理</h2>
              <p>查看全校学生账号使用情况{{ auth.isSuper ? '，可调整配额' : '' }}</p>
            </div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ studentStats.length }}</div><div class="label">学生总数</div></div>
              <div class="kpi-card"><div class="num">{{ activeStudents }}</div><div class="label">已使用平台学生</div></div>
              <div class="kpi-card"><div class="num">{{ studentTotalCost }}<small> 点</small></div><div class="label">学生累计消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>学生列表</h3>
              <el-table :data="studentStats" stripe empty-text="暂无学生账号">
                <el-table-column label="学号/账号" width="130">
                  <template #default="{ row }">{{ row.username }}</template>
                </el-table-column>
                <el-table-column label="姓名" width="110">
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column label="班级" width="120">
                  <template #default="{ row }">{{ row.className || '—' }}</template>
                </el-table-column>
                <el-table-column label="创作次数" width="100">
                  <template #default="{ row }">{{ row.workCount }}</template>
                </el-table-column>
                <el-table-column label="累计消耗" width="110">
                  <template #default="{ row }">{{ row.totalCost }} 点</template>
                </el-table-column>
                <el-table-column label="剩余配额" width="110">
                  <template #default="{ row }">{{ row.quotaBalance }} 点</template>
                </el-table-column>
                <el-table-column label="最近活跃" width="120">
                  <template #default="{ row }">{{ fmtDate(row.lastActiveAt) }}</template>
                </el-table-column>
                <el-table-column v-if="auth.isSuper" label="操作" width="120">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" @click="adjustQuota(row)">调整配额</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 校领导 · 全局看板（真实数据） ========== -->
          <template v-else-if="curSection === 'l-overview'">
            <div class="mgmt-head"><h2>全局看板</h2><p>平台整体运营数据概览（实时数据库统计）</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ stats?.userTotal ?? '—' }}</div><div class="label">注册用户</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.workTotal ?? '—' }}</div><div class="label">累计创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.monthCost ?? '—' }}<small> 点</small></div><div class="label">本月消耗</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.successRate ?? '—' }}<small>%</small></div><div class="label">任务成功率</div></div>
            </div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ stats?.studentCount ?? '—' }}</div><div class="label">学生数</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.adminCount ?? '—' }}</div><div class="label">教师/领导数</div></div>
              <div class="kpi-card"><div class="num">{{ stats?.modelCount ?? '—' }}</div><div class="label">已配置模型</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.totalCost ?? '—' }}<small> 点</small></div><div class="label">历史总消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>算力资源（已启用模型）</h3>
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

          <!-- ========== 校领导 · 大额审批（真实数据） ========== -->
          <template v-else-if="curSection === 'l-approve'">
            <div class="mgmt-head"><h2>大额审批</h2><p>审批配额申请（超过 500 算力点标记为大额）</p></div>
            <div class="mgmt-panel">
              <h3>待审批申请</h3>
              <el-table :data="pendingApprovals" stripe empty-text="暂无待审批申请">
                <el-table-column label="申请人" width="130">
                  <template #default="{ row }">
                    <b>{{ row.requester?.name || '—' }}</b>
                    <el-tag v-if="row.amount > 500" type="warning" size="small" effect="light">大额</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="类型" width="120">
                  <template #default="{ row }">{{ row.type }}</template>
                </el-table-column>
                <el-table-column label="额度" width="110">
                  <template #default="{ row }"><b style="color:var(--accent)">{{ row.amount }} 点</b></template>
                </el-table-column>
                <el-table-column label="理由" min-width="180">
                  <template #default="{ row }">{{ row.reason || '—' }}</template>
                </el-table-column>
                <el-table-column label="提交时间" width="160">
                  <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
                </el-table-column>
                <el-table-column label="操作" width="160">
                  <template #default="{ row }">
                    <el-button size="small" type="success" @click="decide(row.id, 'APPROVED')">通过</el-button>
                    <el-button size="small" type="danger" plain @click="decide(row.id, 'REJECTED')">驳回</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
            <div class="mgmt-panel">
              <h3>近期审批记录</h3>
              <el-table :data="decidedApprovals" stripe empty-text="暂无审批记录">
                <el-table-column label="申请人" width="130">
                  <template #default="{ row }"><b>{{ row.requester?.name || '—' }}</b></template>
                </el-table-column>
                <el-table-column label="类型" width="120">
                  <template #default="{ row }">{{ row.type }}</template>
                </el-table-column>
                <el-table-column label="额度" width="100">
                  <template #default="{ row }">{{ row.amount }} 点</template>
                </el-table-column>
                <el-table-column label="理由" min-width="180">
                  <template #default="{ row }">{{ row.reason || '—' }}</template>
                </el-table-column>
                <el-table-column label="结果" width="100">
                  <template #default="{ row }">
                    <el-tag :type="approvalTagType(row.status)" effect="light">{{ approvalStatusLabel(row.status) }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="时间" width="160">
                  <template #default="{ row }">{{ fmtTime(row.createdAt) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 校领导 · 审计日志（真实数据） ========== -->
          <template v-else-if="curSection === 'l-audit'">
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

          <!-- ========== 校领导 · 运营趋势（真实数据） ========== -->
          <template v-else-if="curSection === 'l-trend'">
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

          <!-- ========== 超管 · 权限管理（真实数据） ========== -->
          <template v-else-if="curSection === 's-perms'">
            <div class="mgmt-head"><h2>权限管理</h2><p>分配各账号的权限等级：普通 / 管理员·老师 / 管理员·领导 / 超级管理员</p></div>
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

          <!-- ========== 超管 · 教师管理（真实数据） ========== -->
          <template v-else-if="curSection === 's-teachers'">
            <div class="mgmt-head"><h2>教师管理</h2><p>管理全校教师与领导账号、配额与使用情况</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ teacherStats.length }}</div><div class="label">教师/领导总数</div></div>
              <div class="kpi-card"><div class="num">{{ teacherWorkTotal }}</div><div class="label">累计创作次数</div></div>
              <div class="kpi-card"><div class="num">{{ teacherCostTotal }}<small> 点</small></div><div class="label">累计消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>教师列表</h3>
              <el-table :data="teacherStats" stripe empty-text="暂无教师账号">
                <el-table-column label="工号/账号" width="130">
                  <template #default="{ row }">{{ row.username }}</template>
                </el-table-column>
                <el-table-column label="姓名" width="120">
                  <template #default="{ row }"><b>{{ row.name }}</b></template>
                </el-table-column>
                <el-table-column label="角色" width="150">
                  <template #default="{ row }">
                    <el-tag :type="row.adminSubRole === 'LEADER' ? 'warning' : 'success'" effect="light">
                      {{ row.adminSubRole === 'LEADER' ? '领导 · 管理员' : '老师 · 管理员' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="创作次数" width="100">
                  <template #default="{ row }">{{ row.workCount }}</template>
                </el-table-column>
                <el-table-column label="累计消耗" width="110">
                  <template #default="{ row }">{{ row.totalCost }} 点</template>
                </el-table-column>
                <el-table-column label="剩余配额" width="110">
                  <template #default="{ row }">{{ row.quotaBalance }} 点</template>
                </el-table-column>
                <el-table-column label="操作" width="200">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" @click="adjustQuota(row)">调整配额</el-button>
                    <el-button size="small" @click="resetPassword(row)">重置密码</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>

          <!-- ========== 超管 · 配额分配（真实数据） ========== -->
          <template v-else-if="curSection === 's-quota'">
            <div class="mgmt-head"><h2>配额分配</h2><p>为各账号分配算力配额，监控使用水位</p></div>
            <div class="mgmt-panel">
              <h3>账号配额一览</h3>
              <el-table :data="allStats" stripe>
                <el-table-column label="账号" width="130">
                  <template #default="{ row }"><b>{{ row.username }}</b></template>
                </el-table-column>
                <el-table-column label="姓名" width="120">
                  <template #default="{ row }">{{ row.name }}</template>
                </el-table-column>
                <el-table-column label="角色" width="150">
                  <template #default="{ row }">
                    <el-tag :type="permTagType(statPermKey(row))" effect="light">{{ statPermKey(row) === 'super' ? '超级管理员' : statPermKey(row) === 'leader' ? '领导 · 管理员' : statPermKey(row) === 'teacher' ? '老师 · 管理员' : '学生 · 普通' }}</el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="班级" width="120">
                  <template #default="{ row }">{{ row.className || '—' }}</template>
                </el-table-column>
                <el-table-column label="剩余配额" width="110">
                  <template #default="{ row }">{{ row.quotaBalance }} 点</template>
                </el-table-column>
                <el-table-column label="累计消耗" width="110">
                  <template #default="{ row }">{{ row.totalCost }} 点</template>
                </el-table-column>
                <el-table-column label="操作" width="120">
                  <template #default="{ row }">
                    <el-button size="small" type="primary" @click="adjustQuota(row)">调整配额</el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div class="foot-note">调整配额将以新值覆盖剩余配额，差额会记录到配额流水；使用率超过 85% 建议关注，超过 100% 将无法继续生成。</div>
            </div>
          </template>

          <!-- ========== 超管 · 算力账单（真实数据） ========== -->
          <template v-else-if="curSection === 's-bills'">
            <div class="mgmt-head"><h2>算力账单</h2><p>平台算力消耗统计（按功能分类，来自创作记录）</p></div>
            <div class="kpi-row">
              <div class="kpi-card"><div class="num">{{ usage?.monthCost ?? 0 }}<small> 点</small></div><div class="label">本月消耗</div></div>
              <div class="kpi-card"><div class="num" style="color:var(--accent)">{{ usage?.cloudCost ?? 0 }}<small> 点</small></div><div class="label">云端消耗</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.localCost ?? 0 }}<small> 点</small></div><div class="label">本地消耗</div></div>
              <div class="kpi-card"><div class="num">{{ usage?.totalCost ?? 0 }}<small> 点</small></div><div class="label">历史总消耗</div></div>
            </div>
            <div class="mgmt-panel">
              <h3>功能消耗分布</h3>
              <div class="usage-legend"><i style="background:var(--primary)"></i>本地推理<i style="background:var(--accent)"></i>云端渲染</div>
              <el-table :data="usage?.byType || []" stripe empty-text="暂无消耗数据">
                <el-table-column label="功能" min-width="140">
                  <template #default="{ row }"><b>{{ WORK_TYPE_LABEL[row.type] || row.type }}</b></template>
                </el-table-column>
                <el-table-column label="本地次数" width="110">
                  <template #default="{ row }">{{ row.local }} 次</template>
                </el-table-column>
                <el-table-column label="云端次数" width="110">
                  <template #default="{ row }">{{ row.cloud }} 次</template>
                </el-table-column>
                <el-table-column label="总次数" width="100">
                  <template #default="{ row }">{{ row.count }} 次</template>
                </el-table-column>
                <el-table-column label="消耗" width="100">
                  <template #default="{ row }"><b>{{ row.cost }}</b> 点</template>
                </el-table-column>
                <el-table-column label="消耗占比" width="110">
                  <template #default="{ row }">{{ Math.round(row.cost / Math.max(1, usage?.totalCost) * 100) }}%</template>
                </el-table-column>
              </el-table>
              <div class="bill-total"><span>总计</span><span>{{ usage?.totalCost ?? 0 }} 算力点</span></div>
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
  adminStatsApi, auditListApi, approvalListApi, myApprovalsApi,
  adminUsageApi, adminUserStatsApi, createApprovalApi, decideApprovalApi,
  adminClassesApi, setQuotaApi,
} from '../../api';
import { useAuthStore } from '../../stores/auth';

const auth = useAuthStore();
const curSection = ref('t-history');
const loading = ref(false);

const role = computed(() => ROLES[auth.backendRole] || ROLES.teacher);
const nav = computed(() => ROLE_NAV[auth.backendRole] || ROLE_NAV.teacher);

/* ---------- 各分区真实数据 ---------- */
const myWorks = ref<any[]>([]);
const classes = ref<any[]>([]);
const myApprovals = ref<any[]>([]);
const studentStats = ref<any[]>([]);
const teacherStats = ref<any[]>([]);
const allStats = ref<any[]>([]);
const stats = ref<any>(null);
const usage = ref<any>(null);
const models = ref<any[]>([]);
const approvals = ref<any[]>([]);
const logs = ref<any[]>([]);
const users = ref<any[]>([]);

const quotaReqAmount = ref('');
const quotaReqReason = ref('');

/* ---------- 创作历史统计 ---------- */
const historyCost = computed(() => myWorks.value.reduce((s, w) => s + (w.cost || 0), 0));
const monthWorks = computed(() => {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return myWorks.value.filter((w) => String(w.createdAt || '').startsWith(prefix));
});
const monthCost = computed(() => monthWorks.value.reduce((s, w) => s + (w.cost || 0), 0));

/* ---------- 算力配额（真实余额 + 历史消耗） ---------- */
const quotaTotal = computed(() => (auth.user ? auth.user.quotaBalance + historyCost.value : 0));
const quotaUsed = computed(() => historyCost.value);
const quotaPct = computed(() => Math.min(100, Math.round((quotaUsed.value / Math.max(1, quotaTotal.value)) * 100)));

/* ---------- 班级统计 ---------- */
const classStudentTotal = computed(() =>
  classes.value.reduce((s, c) => s + (c._count?.students ?? 0), 0));

/* ---------- 学生统计 ---------- */
const activeStudents = computed(() => studentStats.value.filter((s) => s.workCount > 0).length);
const studentTotalCost = computed(() => studentStats.value.reduce((s, x) => s + x.totalCost, 0));

/* ---------- 教师统计 ---------- */
const teacherWorkTotal = computed(() => teacherStats.value.reduce((s, t) => s + t.workCount, 0));
const teacherCostTotal = computed(() => teacherStats.value.reduce((s, t) => s + t.totalCost, 0));

/* ---------- 审批 ---------- */
const pendingApprovals = computed(() => approvals.value.filter((a) => a.status === 'PENDING'));
const decidedApprovals = computed(() => approvals.value.filter((a) => a.status !== 'PENDING').slice(0, 20));

function approvalStatusLabel(s: string): string {
  return ({ PENDING: '待审批', APPROVED: '已通过', REJECTED: '已驳回' } as Record<string, string>)[s] || s;
}
function approvalTagType(s: string): 'warning' | 'success' | 'danger' {
  if (s === 'PENDING') return 'warning';
  if (s === 'APPROVED') return 'success';
  return 'danger';
}
function workTagType(s: string): 'warning' | 'success' | 'danger' | 'info' {
  if (s === 'SUCCEEDED') return 'success';
  if (s === 'FAILED') return 'danger';
  if (s === 'PROCESSING') return 'warning';
  return 'info';
}

async function decide(id: string, status: 'APPROVED' | 'REJECTED') {
  const action = status === 'APPROVED' ? '通过' : '驳回';
  if (!confirm(`确认${action}该申请？${status === 'APPROVED' ? '通过后配额将自动到账。' : ''}`)) return;
  try {
    await decideApprovalApi(id, status);
    await loadSection('l-approve', true);
  } catch (e: any) {
    alert(e?.response?.data?.message || '操作失败');
  }
}

async function submitQuotaReq() {
  const amount = parseInt(quotaReqAmount.value, 10);
  if (!amount || amount <= 0) {
    alert('请填写正确的申请额度');
    return;
  }
  if (!quotaReqReason.value.trim()) {
    alert('请填写申请理由');
    return;
  }
  try {
    await createApprovalApi({
      type: '配额申请',
      amount,
      reason: quotaReqReason.value.trim(),
    });
    alert('申请已提交，等待管理员审批');
    quotaReqAmount.value = '';
    quotaReqReason.value = '';
    await loadSection('t-quota', true);
  } catch (e: any) {
    alert(e?.response?.data?.message || '提交失败');
  }
}

/* ---------- 状态样式 ---------- */
function workStatusLabel(s: string): string {
  return ({ PENDING: '排队中', PROCESSING: '生成中', SUCCEEDED: '已完成', FAILED: '失败' } as Record<string, string>)[s] || s;
}
function logLevelClass(action: string): string {
  if (action.includes('通过')) return 'success';
  if (action.includes('驳回') || action.includes('删除')) return 'error';
  if (action.includes('调整') || action.includes('配额')) return 'warn';
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
  if (u.role === 'ADMIN') return u.adminSubRole === 'LEADER' ? 'leader' : 'teacher';
  return 'student';
}
function statPermKey(u: any): string {
  if (u.role === 'SUPER_ADMIN') return 'super';
  if (u.role === 'ADMIN') return u.adminSubRole === 'LEADER' ? 'leader' : 'teacher';
  return 'student';
}
function permTagType(key: string): 'info' | 'success' | 'warning' | 'danger' {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
    student: 'info', teacher: 'success', leader: 'warning', super: 'danger',
  };
  return map[key] || 'info';
}
async function assignPerm(u: any, key: string) {
  const payload: any =
    key === 'super' ? { role: 'SUPER_ADMIN' }
    : key === 'leader' ? { role: 'ADMIN', adminSubRole: 'LEADER' }
    : key === 'teacher' ? { role: 'ADMIN', adminSubRole: 'TEACHER' }
    : { role: 'STUDENT' };
  try {
    await updateUserApi(u.id, payload);
    await loadSection('s-perms', true);
    if (auth.user?.id === u.id) await auth.fetchMe().catch(() => {});
  } catch (e: any) {
    alert(e?.response?.data?.message || '权限修改失败');
    await loadSection('s-perms', true);
  }
}

/* ---------- 配额 / 密码操作 ---------- */
async function adjustQuota(u: any) {
  const input = prompt(`调整「${u.name}（${u.username}）」的剩余配额（当前 ${u.quotaBalance} 点）：`, String(u.quotaBalance));
  if (input === null) return;
  const amount = parseInt(input, 10);
  if (isNaN(amount) || amount < 0) {
    alert('请输入不小于 0 的数字');
    return;
  }
  const reason = prompt('调整原因（可选）：', '管理员手动调整') || '管理员手动调整';
  try {
    await setQuotaApi(u.id, amount, reason);
    alert('✅ 配额已更新');
    await loadSection(curSection.value, true);
  } catch (e: any) {
    alert(e?.response?.data?.message || '调整失败');
  }
}

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
      case 't-history':
        myWorks.value = await listWorksApi({ size: 100 }).catch(() => []);
        break;
      case 't-classes':
        classes.value = await adminClassesApi().catch(() => []);
        break;
      case 't-quota':
        myWorks.value = await listWorksApi({ size: 100 }).catch(() => []);
        myApprovals.value = await myApprovalsApi().catch(() => []);
        break;
      case 't-students':
      case 's-students':
        studentStats.value = await adminUserStatsApi('STUDENT').catch(() => []);
        break;
      case 'l-overview':
        [stats.value, usage.value, models.value] = await Promise.all([
          adminStatsApi().catch(() => null),
          adminUsageApi().catch(() => null),
          listModelsApi().catch(() => []),
        ]);
        break;
      case 'l-approve':
        approvals.value = await approvalListApi().catch(() => []);
        break;
      case 'l-audit':
        logs.value = await auditListApi().catch(() => []);
        break;
      case 'l-trend':
        [usage.value, models.value] = await Promise.all([
          adminUsageApi().catch(() => null),
          listModelsApi().catch(() => []),
        ]);
        break;
      case 's-perms':
        users.value = await listUsersApi({}).catch(() => []);
        break;
      case 's-teachers':
        teacherStats.value = await adminUserStatsApi('ADMIN').catch(() => []);
        break;
      case 's-quota':
        allStats.value = await adminUserStatsApi().catch(() => []);
        break;
      case 's-bills':
        usage.value = await adminUsageApi().catch(() => null);
        break;
    }
    loaded.value[id] = true;
  } finally {
    loading.value = false;
  }
}

watch(curSection, (id) => loadSection(id));

onMounted(() => {
  curSection.value = nav.value[0]?.id || 't-history';
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