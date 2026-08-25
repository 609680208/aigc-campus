# 生产环境部署脚本（PowerShell）
# 步骤：本地构建镜像 → 导出 tar → scp 上传 → ssh 远程部署

$ErrorActionPreference = "Stop"

$SERVER = "118.195.222.159"
$USER = "hejinchao"
$REMOTE_DIR = "/home/hejinchao/aigc-campus"
$PROJECT_DIR = "d:\新建文件夹\aigc-campus"

Write-Host "=== [1/5] 构建后端生产镜像 ===" -ForegroundColor Cyan
docker build -t aigc-campus-backend:prod -f "$PROJECT_DIR\backend\Dockerfile.prod" "$PROJECT_DIR\backend"
if ($LASTEXITCODE -ne 0) { Write-Host "后端构建失败" -ForegroundColor Red; exit 1 }

Write-Host "=== [2/5] 构建前端生产镜像 ===" -ForegroundColor Cyan
docker build -t aigc-campus-frontend:prod -f "$PROJECT_DIR\frontend\Dockerfile.prod" "$PROJECT_DIR\frontend"
if ($LASTEXITCODE -ne 0) { Write-Host "前端构建失败" -ForegroundColor Red; exit 1 }

Write-Host "=== [3/5] 导出镜像为 tar 包 ===" -ForegroundColor Cyan
docker save -o "$PROJECT_DIR\aigc-campus-images.tar" aigc-campus-backend:prod aigc-campus-frontend:prod
if ($LASTEXITCODE -ne 0) { Write-Host "镜像导出失败" -ForegroundColor Red; exit 1 }
Write-Host "镜像包大小：" -NoNewline
(Get-Item "$PROJECT_DIR\aigc-campus-images.tar").Length / 1MB
Write-Host " MB"

Write-Host "=== [4/5] 上传文件到服务器 ===" -ForegroundColor Cyan
# 创建远程目录
ssh "$USER@$SERVER" "mkdir -p $REMOTE_DIR"
# 上传镜像包
scp "$PROJECT_DIR\aigc-campus-images.tar" "$USER@$SERVER:$REMOTE_DIR/"
# 上传 docker-compose.prod.yml
scp "$PROJECT_DIR\docker-compose.prod.yml" "$USER@$SERVER:$REMOTE_DIR/docker-compose.yml"

Write-Host "=== [5/5] 远程部署启动 ===" -ForegroundColor Cyan
ssh "$USER@$SERVER" @"
cd $REMOTE_DIR
# 如果 .env 不存在则创建默认配置
if [ ! -f .env ]; then
  cat > .env << 'EOF'
POSTGRES_USER=postgres
POSTGRES_PASSWORD=aigc_campus_2026
POSTGRES_DB=aigc_campus
JWT_SECRET=aigc-campus-jwt-secret-prod-2026
JWT_EXPIRES_IN=7d
AI_BASE_URL=http://118.195.196.120:8083/v1
AI_API_KEY=sk-LZ3KSl8diDIqEZ7ZpZjeLPq6YW3yY7pZQWUOgDrgxlPcBwKh
EOF
  chmod 600 .env
  echo "已创建 .env 配置文件"
fi
# 加载镜像
docker load -i aigc-campus-images.tar
# 停止旧容器（如有）
docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true
# 启动服务
docker compose up -d 2>/dev/null || docker-compose up -d
# 清理镜像包释放空间
rm -f aigc-campus-images.tar
# 显示运行状态
docker compose ps 2>/dev/null || docker-compose ps
echo ""
echo "=== 部署完成 ==="
echo "访问地址: http://$SERVER"
"@

Write-Host "`n=== 部署完成！===" -ForegroundColor Green
Write-Host "访问地址: http://$SERVER" -ForegroundColor Green
