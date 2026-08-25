# 智汇校园 AIGC 创作平台 — 服务器部署说明文档

> 适用场景：将本项目以 **Docker 镜像方式**部署到远程服务器，**服务器上不留任何源码**（只有编译产物）。
>
> 目标服务器：`118.195.222.159`（账号 `hejinchao`），部署目录：`/home/hejinchao/aigc-campus`
>
> **访问地址：`http://aigc.xfsk.org.cn`**

---

## 1. 部署架构总览

```
浏览器 → http://aigc.xfsk.org.cn
  │
  ▼ 端口 80（DNS: aigc.xfsk.org.cn → 118.195.222.159）
宿主机 Nginx（/usr/local/nginx，server_name aigc.xfsk.org.cn）
  │  proxy_pass
  ▼ 127.0.0.1:8088
Docker 前端容器 aigc-frontend（Nginx，端口映射 127.0.0.1:8088:80）
  │  静态页面直接返回（Vue SPA，history 模式）
  │  /api/ 请求 → proxy_pass http://backend:3000（Docker 内部网络）
  ▼
Docker 后端容器 aigc-backend（NestJS，仅容器内网监听 3000）
  ▼
Docker 数据库容器 aigc-postgres（PostgreSQL 16，仅容器内网监听 5432）
```

**关键安全设计：**

| 措施 | 说明 |
|---|---|
| 源码不出本地 | 镜像在本地构建，仅上传编译产物镜像；服务器只有 `docker-compose.yml` + `.env` |
| 无 source map | 生产 Dockerfile 关闭 sourceMap 并删除 `.map` / `.d.ts` / `.ts` 文件 |
| 端口内网化 | 后端 3000、数据库 5432、前端 8088 均仅本机/容器内网可访问 |
| 域名接入 | 外部仅通过域名访问（80 端口），无需开放额外端口 |
| .env 权限 600 | 数据库密码、JWT 密钥、AI Key 仅属主可读 |

---

## 2. 文件清单

| 文件 | 作用 |
|---|---|
| `backend/Dockerfile.prod` | 后端生产构建（多阶段：编译→只保留 dist + 生产依赖） |
| `frontend/Dockerfile.prod` | 前端生产构建（多阶段：Vite 编译→只保留 dist 交给 Nginx） |
| `frontend/.dockerignore` | 排除 node_modules / dist / .env / .git |
| `docker-compose.prod.yml` | 生产编排（预构建镜像、端口内网化、.env 引用） |
| `deploy.ps1` | 一键部署脚本（构建→导出→上传→部署） |

---

## 3. 一键部署（推荐）

本地项目根目录执行：

```powershell
.\deploy.ps1
```

脚本会依次执行：

1. 构建后端生产镜像 `aigc-campus-backend:prod`
2. 构建前端生产镜像 `aigc-campus-frontend:prod`
3. `docker save` 导出为 `aigc-campus-images.tar`（约 150MB）
4. `scp` 上传镜像包与 `docker-compose.yml` 到服务器
5. SSH 远程：创建 `.env`（首次）→ `docker load` → `docker compose up -d` → 清理镜像包

> 注意：`deploy.ps1` 默认使用 `ssh`/`scp`。若本机 SSH 无法免密登录，可改用 PuTTY 工具（见第 5 节手动部署）。

---

## 4. 手动部署步骤

### 4.1 本地构建镜像

```powershell
cd d:\新建文件夹\aigc-campus

# 后端生产镜像
docker build -t aigc-campus-backend:prod -f backend\Dockerfile.prod backend

# 前端生产镜像
docker build -t aigc-campus-frontend:prod -f frontend\Dockerfile.prod frontend
```

**首次构建注意事项：**
- Alpine 镜像中 Prisma 需要 OpenSSL，`Dockerfile.prod` 已包含 `apk add --no-cache openssl`
- `npm ci` 下载 Prisma 引擎较慢属正常现象，请耐心等待

### 4.2 导出镜像包

```powershell
docker save -o aigc-campus-images.tar aigc-campus-backend:prod aigc-campus-frontend:prod
```

### 4.3 上传到服务器

使用 PuTTY 工具（密码方式，无需配置免密）：

```powershell
$HOSTKEY = "SHA256:SZCIA+MNNj6+gzvUI55HCVnEi3XiYBPIHWyt0E2Bnxo"
$PW = "服务器密码"

# 创建远程目录
& "C:\Program Files\PuTTY\plink.exe" -ssh hejinchao@118.195.222.159 -pw $PW -hostkey $HOSTKEY `
  "mkdir -p /home/hejinchao/aigc-campus"

# 上传镜像包
& "C:\Program Files\PuTTY\pscp.exe" -pw $PW -hostkey $HOSTKEY `
  aigc-campus-images.tar hejinchao@118.195.222.159:/home/hejinchao/aigc-campus/

# 上传编排文件
& "C:\Program Files\PuTTY\pscp.exe" -pw $PW -hostkey $HOSTKEY `
  docker-compose.prod.yml hejinchao@118.195.222.159:/home/hejinchao/aigc-campus/docker-compose.yml
```

> `-hostkey` 用于首次连接时锁定服务器指纹，避免交互式确认；若服务器重装系统导致指纹变化，去掉 `-hostkey` 手动确认一次即可。

### 4.4 服务器端创建 .env（仅首次）

```bash
cd /home/hejinchao/aigc-campus
cat > .env << 'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=aigc_campus_2026
POSTGRES_DB=aigc_campus
JWT_SECRET=aigc-campus-jwt-secret-prod-2026
JWT_EXPIRES_IN=7d
AI_BASE_URL=http://118.195.196.120:8083/v1
AI_API_KEY=你的-genzhi-API-Key
EOF
chmod 600 .env
```

> `.env` 包含敏感信息，务必保持 600 权限；**不要把 .env 上传或提交到任何仓库**。

### 4.5 加载镜像并启动

```bash
cd /home/hejinchao/aigc-campus
sudo docker load -i aigc-campus-images.tar
sudo docker compose up -d

# 查看状态（三个容器均应为 Up，postgres 为 healthy）
sudo docker compose ps

# 删除镜像包释放空间
rm -f aigc-campus-images.tar
```

后端启动时会自动执行 `prisma db push`（建表）+ `prisma db seed`（种子数据：演示账号 `student/teacher/leader` + 11 个模型）。

---

## 5. 域名与 Nginx 反代配置（必需）

### 5.1 DNS 解析配置（联系管理员）

在域名 DNS 管理中添加 A 记录：

| 主机记录 | 记录类型 | 记录值 | TTL |
|---|---|---|---|
| aigc | A | 118.195.222.159 | 600 |

生效后可通过 `http://aigc.xfsk.org.cn` 直接访问，无需开放额外端口（使用已放行的 80 端口）。

### 5.2 宿主机 Nginx 配置（已配置）

配置文件：`/usr/local/nginx/conf.d/aigc-campus.conf`

```nginx
server {
    listen 80;
    server_name aigc.xfsk.org.cn;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:8088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }
}
```

如需修改后重载：

```bash
sudo /usr/local/nginx/sbin/nginx -t
sudo /usr/local/nginx/sbin/nginx -s reload
```

> Docker 容器端口映射为 `127.0.0.1:8088:80`，仅宿主机本地可访问，外部无法直连 8088。
> `proxy_read_timeout 600s` 保证视频生成等长耗时请求不被掐断。

---

## 6. 端口分配表

| 端口 | 监听者 | 对外可见 | 说明 |
|---|---|---|---|
| 80 | 宿主机 Nginx | ✓（安全组已放行） | 域名入口，反代到 127.0.0.1:8088 |
| 8088 | Docker aigc-frontend | ✗ | 绑定 127.0.0.1，仅宿主机本地 |
| 3000 | Docker aigc-backend | ✗ | 仅 Docker 内部网络 |
| 5432 | Docker aigc-postgres | ✗ | 仅 Docker 内部网络 |
| 3013 | azyshorts 服务 | ✓ | 服务器已有服务，勿占用 |
| 7000 | zentao 服务 | ✓ | 服务器已有服务，勿占用 |

---

## 7. 日常运维命令

```bash
cd /home/hejinchao/aigc-campus

# 查看容器状态
sudo docker compose ps

# 查看日志（后端 / 前端 / 数据库）
sudo docker logs -f aigc-backend --tail 100
sudo docker logs -f aigc-frontend --tail 100

# 重启全部服务
sudo docker compose restart

# 停止服务（数据卷保留）
sudo docker compose down

# 停止并清空数据库（谨慎！数据全删）
sudo docker compose down -v

# 进入容器排查（容器内无源码，只有编译产物）
sudo docker exec -it aigc-backend sh
ls /app        # dist/ node_modules/ prisma/ package*.json
```

---

## 8. 更新部署（迭代发版）

代码改动后重新发布，只需重跑一键脚本：

```powershell
.\deploy.ps1
```

或手动执行核心三步：

```powershell
# 本地：构建 + 导出
docker build -t aigc-campus-backend:prod -f backend\Dockerfile.prod backend
docker build -t aigc-campus-frontend:prod -f frontend\Dockerfile.prod frontend
docker save -o aigc-campus-images.tar aigc-campus-backend:prod aigc-campus-frontend:prod
```

```bash
# 服务器：加载 + 重启（数据卷不动，数据保留）
cd /home/hejinchao/aigc-campus
sudo docker load -i aigc-campus-images.tar
sudo docker compose up -d
rm -f aigc-campus-images.tar
```

> 后端镜像启动命令含 `prisma db push`，数据模型变更会自动同步到数据库。

---

## 9. 故障排查

### 9.1 域名无法访问 / 返回 502

| 现象 | 原因 | 解决 |
|---|---|---|
| 域名解析失败（DNS 未生效） | A 记录未添加或未生效 | 联系管理员确认 `aigc.xfsk.org.cn` → `118.195.222.159` |
| 502 Bad Gateway | 容器未运行或端口映射错误 | `sudo docker compose ps` 确认容器状态 |
| 502 且容器正常 | 后端启动失败 | `sudo docker logs aigc-backend --tail 50` 查看 |
| 访问 IP:80 正常但域名不通 | DNS/hosts 问题 | 本地 `ping aigc.xfsk.org.cn` 确认解析到 118.195.222.159 |
| 404 页面不存在 | 路由问题（Vue SPA） | 前端容器 Nginx 已配 `try_files $uri /index.html`，检查 `nginx.conf` |
| 服务器内可访问但外部不行 | Nginx 配置或防火墙 | 服务器内 `curl -H 'Host: aigc.xfsk.org.cn' http://127.0.0.1:80/` 验证 |

### 9.2 端口被占用（address already in use）

```bash
# 查看端口占用进程
sudo ss -tlnp | grep 8088
sudo ss -tlnp | grep 80
```

本服务器已知占用：80/443（宿主机 Nginx）、3013、7000。若 8088 被占用，修改 `docker-compose.yml` 映射端口并同步修改 Nginx `proxy_pass`。

### 9.3 数据库连接失败 / Prisma 报错

```bash
# 确认 postgres 健康
sudo docker compose ps postgres
# 确认后端容器能解析到 postgres
sudo docker exec aigc-backend sh -c "wget -qO- http://localhost:3000/api/models || true"
```

常见原因：`.env` 中 `POSTGRES_PASSWORD` 与数据卷初始化时的密码不一致（数据卷已存在时改密码无效）。解决：`docker compose down -v` 后重建（会清空数据），或进入 postgres 容器用 `ALTER USER` 改密。

### 9.4 容器启动卡在等待数据库

`depends_on: condition: service_healthy` 要求 postgres 健康检查通过，通常 5-10 秒。超过 1 分钟仍未启动则查 `sudo docker logs aigc-postgres`。

---

## 10. 部署记录

| 日期 | 内容 |
|---|---|
| 2026-08-25 | 首次部署：端口 8080 上线 |
| 2026-08-25 | 排查外部 502：确认云安全组仅放行 22/80/3013 |
| 2026-08-25 | 最终方案：域名 `aigc.xfsk.org.cn` + 宿主机 Nginx 80 端口反代 → Docker `127.0.0.1:8088`，无需开放额外端口 |
| 2026-08-25 | Nginx 配置 `/usr/local/nginx/conf.d/aigc-campus.conf`，Docker 端口绑定 `127.0.0.1:8088:80` |
| 2026-08-25 | 待办：管理员配置 DNS `aigc.xfsk.org.cn` → `118.195.222.159` |

**当前访问地址：`http://aigc.xfsk.org.cn`**（DNS 生效后即可访问）
