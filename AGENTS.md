# AGENTS.md — 智汇校园 AIGC 创作平台

> 本文件是项目的「智能体开发手册」，供 AI 助手与开发者快速理解项目全貌。
> **维护约定：每次代码迭代（新增功能 / 修改接口 / 变更数据模型 / 调整角色权限）后，必须同步更新本文件对应章节，并在文末「变更日志」追加一条记录。**

---

## 1. 项目概述

面向全校师生（学生 / 老师 / 校领导 / 超级管理员）的 AIGC 内容创作平台：

- **创作能力**：文生图、图生图、文生视频、图生视频、AI 配音（画布配音节点）、创作画布（文本/生图/视频/配音四类节点链式工作流）、AI 对话助手
- **管理能力**：用户管理、审计日志、模型接入配置、平台用量看板（不含算力配额：计费在中转站算力平台侧，本平台模型消耗仅作展示）
- **接入形态**：作为 OPC 平台的下游创作平台，用户统一从 OPC 门户经 SSO 中间页（`/sso/login`）自动登录，本系统不提供独立的登录/注册入口；模型调用使用各用户 SSO 带入的 genzhi API Key
- **技术形态**：前后端分离 + PostgreSQL 数据库，全部业务数据真实落库（**已无任何前端假数据**，`frontend/src/data/prototype.ts` 仅保留工具目录 / 角色导航等静态产品配置）

## 2. 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + TypeScript + Pinia + Vue Router + Element Plus + @element-plus/icons-vue + @vue-flow/core（画布无限画布），学院风设计系统 `styles/prototype.css` |
| 后端 | NestJS (TypeScript) + Prisma ORM |
| 数据库 | PostgreSQL |
| 认证 | JWT（`@nestjs/jwt` + `passport-jwt`），密码 bcrypt 哈希 |
| 部署 | Docker Compose（backend / frontend / db），前端 Nginx 托管并反代 `/api` |

## 3. 目录结构

```
aigc-campus/
├── agents.md                  # 本文件（随代码迭代更新）
├── docker-compose.yml
├── backend/                   # NestJS 后端
│   ├── prisma/
│   │   ├── schema.prisma      # 数据模型（唯一事实来源）
│   │   └── seed.js            # 种子数据（演示账号、模型）
│   └── src/
│       ├── auth/              # OPC SSO 注册/登录 + 个人资料 / 修改密码
│       ├── users/             # 用户 CRUD、批量导入、权限变更
│       ├── models/            # AI 模型注册（多服务商）+ 启停（超管）
│       ├── works/             # 创作提交、作品列表、平台统计（不做算力扣减）
│       ├── admin/             # 后台统计 / 审计 / 用量分析
│       ├── ai/                # AI Provider 适配层（openai/deepseek/dashscope/claude/comfyui 多格式）
│       ├── common/            # 守卫（RolesGuard）与装饰器（@Public @Roles @CurrentUser）
│       ├── prisma.service.ts  # Prisma 单例
│       └── main.ts            # 端口 3000，全局路由前缀 /api
└── frontend/
    ├── vite.config.ts         # dev 端口 5173，/api 代理到 localhost:3000
    └── src/
        ├── api/               # axios 封装与全部接口函数（唯一 API 出口）
        ├── stores/auth.ts     # 登录态、角色 getter（isAdmin/isSuper/backendRole）
        ├── router/index.ts    # 路由 + 登录/角色守卫
        ├── data/prototype.ts  # 静态产品配置（TOOLS/CATS/ROLE_NAV 等，禁止放业务数据）
        ├── layouts/MainLayout.vue  # 顶栏 + 右上角用户下拉（个人资料；非 SSO 本地账号另见退出登录）
        └── views/
            ├── SsoLogin.vue                   # SSO 中间页（/sso/login，解析 OPC 带入参数自动登录，无参数时展示引导）
            ├── Login.vue                    # 管理员隐藏登录页（/login，界面无入口，仅超管等本地账号手动访问）
            ├── portal/Portal.vue          # 门户首页（真实统计数据）
            ├── workbench/                 # ToolDetail（画面比例/分辨率/时长参数）/ ChatTool / CanvasTool（文本/生图/视频/配音四类节点链式真实生成画布）
            ├── admin/Admin.vue            # 后台管理（管理员/超管两套导航，全部真实数据）
            └── settings/Settings.vue      # 系统设置（超管）
```

## 4. 角色权限体系

数据库角色枚举（`UserRole`）：`USER`（普通用户）/ `ADMIN`（管理员）/ `SUPER_ADMIN`（超级管理员）。
已取消老师/领导/学生概念与原 `AdminSubRole` 子角色，管理员权限 = 原老师 + 领导权限合集（去除算力/审批/班级后）。

| 端表现 | 数据库映射 | 可见后台导航 |
|---|---|---|
| 用户 | `USER` | 无后台入口 |
| 管理员 | `ADMIN` | 创作历史 / 全局看板 / 审计日志 / 运营趋势 / 用户管理 |
| 超级管理员 | `SUPER_ADMIN` | 权限管理 / 用户管理 + 系统设置 |

- 权限判定：后端 `@Roles('ADMIN','SUPER_ADMIN')` 装饰器 + 全局 `RolesGuard`；前端路由 `meta.roles` + 守卫，页面内用 `auth.isAdmin / auth.isSuper` 控制显隐。
- 用户账号统一由 OPC 平台注册时同步创建（角色 USER）；管理员账号由超管在「权限管理」中分配。
- 模型消耗（`Model.cost`）仅在前端展示「单次消耗 X 积分」，不做余额校验与扣减；实际算力计费在中转站算力平台侧查看。

## 5. 数据模型（schema.prisma 摘要）

- **User**：username（唯一）/ password（bcrypt）/ name / role（USER/ADMIN/SUPER_ADMIN）/ opcUserId?（唯一，OPC 用户 ID）/ ssoToken?（唯一，我方签发的永久 SSO token）/ apiKey?（genzhi API Key，SSO 带入）/ teamId?（OPC 团队）/ teamTaskId?（OPC 任务）
- **Model**：name + type（TEXT/TXT2IMG/IMG2IMG/TXT2VIDEO/IMG2VIDEO/AUDIO）唯一 / loc（CLOUD/LOCAL）/ cost（仅展示）/ enabled / provider（String：OPENAI/DEEPSEEK/DASHSCOPE/CLAUDE/COMFYUI）/ apiKey? / baseUrl? / externalId?
- **Work**：userId / modelId? / type（WorkType，含 CANVAS 与 AUDIO）/ prompt / status（PENDING→PROCESSING→SUCCEEDED/FAILED）/ resultText? / resultUrl? / cost（记录单次消耗，仅展示）/ error?
- **AuditLog**：userId / action / detail?（注册、改资料、改密码、权限变更等均落审计）
- 已删除：`Class`（班级）、`QuotaLog`（配额流水）、`Approval`（审批）与 User 上的 `quotaBalance / adminSubRole / classId` 字段。

## 6. API 接口清单（前缀 /api）

### 认证 auth
| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | /auth/login | 公开 | 账号密码登录（隐藏页 /login，仅超管等本地账号使用，界面不提供入口） |
| POST | /auth/sso/register | 公开 | OPC 平台注册时同步调用：传入 opcUserId/username/name/teamId/apiKey/secret 创建本系统账号，幂等，返回永久 ssoToken |
| POST | /auth/sso/login | 公开 | SSO 中间页自动登录：凭永久 token 匹配用户，同步更新 apikey/teamId/teamTaskId，签发长期（365d）会话 JWT |
| GET | /auth/me | 登录 | 当前用户信息（含 OPC 绑定字段，不透出 ssoToken） |
| POST | /auth/refresh | 登录 | 刷新 token |
| PATCH | /auth/profile | 登录 | 修改姓名（个人资料） |
| PATCH | /auth/profile/password | 登录 | 修改密码（需原密码校验） |

### 用户 users（管理）
`GET /users`（角色/关键字筛选）、`POST /users`（超管）、`POST /users/import`（批量，超管）、`PATCH /users/:id`（改角色/资料/重置密码，超管）
已删除：`GET /users/classes`、`PATCH /users/:id/quota`。

### 模型 models
`GET /models`（启用列表）、`GET /models/all`、`POST /models`、`PATCH /models/:id`、`DELETE /models/:id` —— 仅超管可写；模型含服务商 / API Key / Base URL / 模型 ID 等字段

### 作品 works
`POST /works`（提交创作并生成 Work 记录，不做余额校验与扣减，cost 仅作展示；支持透传 `aspectRatio`（画面比例，如 16:9）/ `resolution`（分辨率 480p/720p/1080p）/ `duration`（视频秒数）参数；参考图支持 `images` 多图数组（图生图逐张以 image[] 字段发送），兼容旧单图 `image` 字段）、`GET /works`（本人作品列表）、`GET /works/stats`（门户首页统计：总次数 + 按类型分布）

### 后台 admin（管理员与超管均可访问）
`GET /admin/stats`（用户/管理员/超管计数 + 创作/模型总量）、`GET /admin/usage`（本地/云端、按功能分布）、`GET /admin/user-stats?role=`、`GET /admin/audit`
已删除：审批（/admin/approvals、/admin/my-approvals）、班级（/admin/classes）、配额（/admin/quota-users）全部接口。

## 7. 关键业务规则

1. **OPC SSO 对接**：OPC 注册时调用 `POST /auth/sso/register` 同步建号并领取永久 `ssoToken`（同一 opcUserId 幂等）；用户从 OPC 门户携带 `token/apikey/opcUserId/teamId/teamTaskId` 进入 `/sso/login` 中间页自动登录（会话 JWT 365 天）。可选配 `SSO_SECRET` 环境变量对注册接口加共享密钥校验。普通用户无注册/登录入口，未登录一律重定向到 `/sso/login`；仅保留隐藏页 `/login` 供超管等本地账号（无 opcUserId）账号密码登录，顶栏退出按钮也仅对本地账号展示。
2. **算力与积分**：本平台不做算力计费 —— 模型调用走中转站，实际算力消耗在中转站算力平台侧查看；`Model.cost` 仅用于前端展示「单次消耗 X 积分」，创作提交不校验余额、不扣点，`Work.cost` 记录单次消耗仅作展示。
3. **审计**：注册 / 改资料 / 改密码 / 权限变更 / SSO 登录等敏感操作写 AuditLog。
4. **AI Provider 与用户 API Key**：`backend/src/ai/providers.ts` 适配层按模型 `provider` 分派 —— OPENAI（文/图/视频，图生图走 multipart `/images/edits`，参考图字段名 `image[]`，豆包系附 `watermark=false`）、DEEPSEEK（文本）、CLAUDE（messages）、DASHSCOPE（文本+文生图）、COMFYUI（文生图工作流 + MiniMax H3 文生视频/图生视频 + Qwen3-TTS 配音）。平台实际只接 genzhi 平台模型，调用密钥优先级：**当前登录用户 SSO 带入的 apikey** > 模型单独配置的 apiKey > `backend/.env` 的 `AI_API_KEY` 全局回退；ComfyUI 模型无需密钥。
5. **画面比例 / 分辨率**：生图类按 `aspectRatio` 计算 size（256 圆整 + 火山系最小 3686400 像素保护）；视频类经 ComfyUI `ResolutionSelector` 映射（比例→枚举标签，分辨率→megapixels：480p=0.3 / 720p=1.0 / 1080p=2.0）。
6. **创作画布**：基于 @vue-flow/core 的无限画布（白色背景 + 点阵网格），右键画布弹出「添加节点 / 工作流模板」菜单（参考 huobao-drama 交互），右键节点弹出「立即生成 / 创建副本 / 删除」菜单；文本 / 生图（文生图↔图生图模式切换）/ 视频生成 / 配音四类节点，按连线链式串联（上游文本自动作下游提示词、上游图片自动作图生图/图生视频输入），每节点独立选模型生成并真实落库，「运行工作流」按序执行全链。
7. **前端静态配置**：业务数据一律走 `src/api`，禁止在 `data/prototype.ts` 添加 mock 业务数据。

## 8. 本地开发与构建

```bash
# 后端（需 .env 中 DATABASE_URL 指向 PostgreSQL）
cd backend
npm install
npm run prisma:generate && npm run prisma:push   # 建表
npm run seed                                      # 演示账号/模型
npm run start:dev                                 # http://localhost:3000/api

# 前端
cd frontend
npm install
npm run dev                                       # http://localhost:5173（/api 已代理）

# 构建
npm run build   # 前后端同命令；后端产物 dist/，前端产物 dist/ 交给 Nginx
```

演示账号（种子数据）：普通用户 `user / user2 / user3 / 123456`、管理员 `manager / manager2 / 123456`、超管 `admin / admin`。

## 9. 迭代维护约定（给 AI 助手 / 开发者）

每次改动代码时请同步执行：

1. **接口变更** → 更新第 6 节表格（方法 / 路径 / 权限 / 说明）。
2. **数据模型变更** → 更新第 5 节摘要，并执行 `prisma db push` + 调整 `seed.js`。
3. **角色权限变更** → 更新第 4 节映射表，检查前端 `stores/auth.ts` getter 与路由守卫。
4. **新增页面 / 目录调整** → 更新第 3 节目录树。
5. **业务规则变化** → 更新第 7 节。
6. 在文末「变更日志」追加一行：`日期 | 迭代内容摘要 | 影响范围`。

---

## 变更日志

| 日期 | 迭代内容 | 影响范围 |
|---|---|---|
| 2026-08-19 | 初始版本生成（前后端全栈脚手架、六大创作工具、三角色后台、JWT 认证、Docker 部署） | 全部 |
| 2026-08-19 | 校园化 UI 改造：登录页品牌区、学生自助注册页（/register，注册即登录）、顶栏右上角用户下拉（个人资料 / 修改密码 / 退出登录）、算力余额徽标 | frontend: Register.vue / Login.vue / MainLayout.vue / router |
| 2026-08-19 | 移除全部前端假数据：门户统计、后台管理（创作历史/班级概览/配额/学生管理/审批/审计/用量分析）改为后端真实数据；`data/prototype.ts` 仅保留静态产品配置 | frontend: Portal.vue / Admin.vue / prototype.ts；backend: works/stats、admin/* |
| 2026-08-19 | 后端新增 auth 接口：POST /auth/register（自助注册+审计）、PATCH /auth/profile（改姓名）、PATCH /auth/profile/password（改密码）、GET /auth/classes（公开班级） | backend: auth.controller.ts / auth.service.ts；frontend: api/index.ts / stores/auth.ts |
| 2026-08-19 | 前后端构建验证通过（frontend vite build ✓ / backend nest build ✓）；创建 agents.md 并建立迭代维护约定 | 文档 |
| 2026-08-19 | 全面接入 Element Plus + @element-plus/icons-vue，重写全部页面为「简洁学院风」设计系统：登录/注册（el-form/el-input/el-select）、主布局（el-dropdown/el-dialog）、门户 Portal、创作操作台 ToolDetail（el-select/el-upload/el-progress）、AI 对话 ChatTool（el-avatar/el-select/el-input）、创作画布 CanvasTool（el-button）、后台管理 Admin（el-menu/el-table/el-tag/el-select/el-progress）、系统设置 Settings（el-table/el-switch/el-input-number）；全局样式重构为学院风 token（主色 #2b5aed） | frontend: main.ts / prototype.css / Login.vue / Register.vue / MainLayout.vue / Portal.vue / ToolDetail.vue / ChatTool.vue / CanvasTool.vue / Admin.vue / Settings.vue |
| 2026-08-19 | 移除全部 mock 模型与 MOCK 兜底，接入 OpenAI 兼容中转站（.env 配 AI_BASE_URL / AI_API_KEY）：新增 ai/config.ts 与 OpenAICompatibleProvider（文/图/视频+任务轮询）；works 提交透传真实图片；models 新增 POST /models/sync 从 /v1/models 同步并自动归类；上调 body 上限（20mb）与前端请求超时（10min）；Settings 新增「从中转站同步模型」按钮；seed 移除模型种子 | backend: ai/config.ts / providers.ts / ai.service.ts / models.* / works.service.ts / main.ts / seed.js / .env；frontend: api/http.ts / api/index.ts / ToolDetail.vue / Settings.vue |
| 2026-08-19 | 模型配置重构为多服务商：provider 由枚举改为 String（OPENAI/DEEPSEEK/DASHSCOPE/CLAUDE/COMFYUI）；ai/providers.ts 按服务商分派真实调用（OpenAI 文/图/视频、DeepSeek 文本、Claude messages、DashScope 文本+文生图、ComfyUI 文生图工作流）；去掉自动同步（删除 /models/sync 及同步按钮），视频模型改为手动配置；Settings 新增服务商/API Key/Base URL/模型 ID 字段与「编辑」弹窗 | backend: prisma/schema.prisma / ai/providers.ts / ai.service.ts / models.controller.ts / models.service.ts；frontend: api/index.ts / Settings.vue |
| 2026-08-20 | 按 huobao-drama 实际配置写入 11 个模型（中转站 8083：glm-5.2 / deepseek-v4-flash / gpt-image-2 与 seedream 文生图×图生图；ComfyUI 8189：minimax-h3 文生视频 + minimax-h3-i2v 图生视频；ComfyUI 8199：qwen3-tts 配音），不含 seedance/可灵；ModelType/WorkType 新增 AUDIO；providers.ts 移植 MiniMax H3 视频与 Qwen3-TTS 工作流（含首帧缩放链/i2v 硬锚定）；图生图改 multipart image[] 字段（豆包系 watermark=false）；image 参数兼容 http URL（toDataUrl 转换）；works 透传 aspectRatio/resolution/duration | backend: schema.prisma / seed.js / providers.ts / works.service.ts |
| 2026-08-20 | 前端：图生图去掉相似度；六大生成模块新增画面比例下拉（自适应/21:9/16:9/4:3/1:1/3:4/9:16），视频类新增分辨率（480p/720p/1080p）与时长下拉；修复操作台/画布表单控件「框套框」样式（单层细边框）；创作画布按 huobao 重构为文本/生图/视频/配音四类节点链式真实生成画布（SVG 连接线、上游产物自动流向下游、单节点生成+运行工作流+保存画布）；全部功能真实调用实测通过 | frontend: prototype.ts / ToolDetail.vue / CanvasTool.vue |
| 2026-08-20 | 创作画布升级为 @vue-flow/core 无限画布：顶部导航下方全部为可缩放平移的白色点阵画布（不采用 huobao 黑色背景）；左侧节点/模板列表改为右键画布菜单（添加节点 + 工作流模板，huobao 风格白色主题），另新增节点右键菜单（立即生成/创建副本/删除）、左下缩放控制、空画布引导；上游遍历改为基于连线的 BFS | frontend: CanvasTool.vue / package.json（+@vue-flow/core +@vue-flow/background） |
| 2026-08-20 | 修复创作失败报错展示：works 生成失败时由 throw 原始错误（Nest 掩盖为 "Internal server error"）改为抛 BadRequestException 透传真实原因，并将 do_request_failed 类错误转为友好提示「模型上游服务暂时不可用」；确认失败不扣算力（仅成功事务内扣点） | backend: works.service.ts |
| 2026-08-20 | 排查「选 glm 模型回复自称 DeepSeek」：实测中转站 8083 的 glm-5.2 渠道被映射到 deepseek-v4-flash（响应 model 字段为证），属中转站渠道配置问题；seed 中该文本模型替换为实测身份一致的 Qwen3.6-27B（中转站Qwen3.6），并清理库内旧 glm 记录 | backend: seed.js |
| 2026-08-21 | 系统设置模型配置交互改造：移除各模型类型面板底部的内联添加表单（一排输入框），改为面板右上角「+ 添加」按钮，点击弹出带标签说明的表单弹框（模型名称/服务商/模型名称(ID)/API Key/Base URL/调度/消耗，与编辑弹框同构）；清理废弃的 .set-add 样式 | frontend: Settings.vue / prototype.css |
| 2026-08-21 | 创作操作台结果体验优化：生成图片改为 el-image 点击放大预览（全屏缩放），视频改为原生 video 播放器（支持全屏）；新增「下载图片/视频」按钮（远程资源取回 blob 触发下载）；移除假数字进度条（随机秒到 100%），因上游接口不返回真实进度，改为旋转加载 + 真实已耗时展示（视频提示需数分钟） | frontend: ToolDetail.vue |
| 2026-08-21 | 图生图上传升级：上传后展示可移除的缩略图预览（不再只显示文件名），支持多图选择/拖拽追加；POST /works 新增 images 多图数组参数（兼容旧 image 单图），图生图多张参考图逐个以 image[] 字段发送中转站，图生视频取第一张作起始帧；未上传参考图时前端拦截提示 | backend: providers.ts / works.service.ts；frontend: ToolDetail.vue |
| 2026-08-24 | OPC 平台对接改造：User 新增 opcUserId/ssoToken/apiKey/teamId/teamTaskId 字段；新增 POST /auth/sso/register（OPC 注册同步建号，幂等返回永久 ssoToken，可选 SSO_SECRET 密钥校验）与 POST /auth/sso/login（凭永久 token 自动登录，签发 365d JWT，同步 apikey/teamId/teamTaskId）；移除自助注册与公开班级接口（删 /auth/register、/auth/classes）；AI 调用密钥改为优先使用当前用户 SSO 带入的 genzhi apikey；前端新增 /sso/login 中间页 SsoLogin.vue，删除 Login/Register 页与右上角登录/退出/改密入口，未登录一律重定向 SSO 中间页 | backend: schema.prisma / auth.controller.ts / auth.service.ts / providers.ts / works.service.ts；frontend: SsoLogin.vue / router / stores/auth.ts / api / MainLayout.vue / http.ts / Settings.vue |
| 2026-08-24 | 保留超管登录能力：重建隐藏登录页 /login（界面无入口，仅本地账号手动访问，无注册/演示账号）；stores 恢复 login 动作并新增 isSsoUser getter（按 opcUserId 判定）；顶栏退出登录按钮仅对非 SSO 本地账号展示 | frontend: Login.vue / router / stores/auth.ts / types / MainLayout.vue |
| 2026-08-24 | 管理员登录入口可达性修复：SSO 中间页在缺参/失败状态下新增「前往管理员登录」链接（跳转 /login）；路由新增 /SSO/login 大写别名重定向（携带 query 转 /sso/login） | frontend: SsoLogin.vue / router |
| 2026-08-25 | 去算力化与角色简化：移除算力配额体系（quotaBalance/QuotaLog/Approval/班级 Class 及相关接口与页面），创作不再校验余额与扣点，模型 cost 仅作「单次消耗积分」展示（计费在中转站侧）；角色枚举改为 USER/ADMIN/SUPER_ADMIN（删除 AdminSubRole），老师/领导合并为「管理员」（后台导航：创作历史/全局看板/审计日志/运营趋势/用户管理），超管导航改为权限管理+用户管理；数据库枚举值迁移（STUDENT→USER）+ 旧演示账号改名（student→user、teacher→manager 等） | backend: schema.prisma / seed.js / auth / works / users / admin / common；frontend: types / stores / api / prototype.ts / Admin.vue / MainLayout.vue / Portal.vue / ChatTool.vue / ToolDetail.vue / CanvasTool.vue |
| 2026-09-02 | 精选案例素材真实化：文生图/文生视频/图生视频案例封面由外部占位图服务改为平台模型真实生成产物（图片 seedream-5.0、视频 minimax-h3 / minimax-h3-i2v），素材自托管于 frontend/public/cases/（8 个文件，规避签名 URL 过期）；ToolCase 新增可选 video 字段，案例缩略图支持 video 播放（悬停播放/移出复位，cover 作海报帧） | frontend: data/prototype.ts / views/workbench/ToolDetail.vue / public/cases/*（新增静态素材目录） |
