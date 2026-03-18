# AgentCenter - Docker 部署指南

## 快速开始

### 构建并启动后端服务

```bash
# 构建后端镜像
docker build -f backend/Dockerfile -t agent-center-backend:latest .

# 运行容器
docker run -d -p 8010:8010 -v agent-center-data:/app/data --name agent-center-backend agent-center-backend:latest
```

### 使用 docker-compose（推荐）

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 服务说明

### 后端服务（agent-center-backend）
- **端口**: 8010
- **健康检查**: http://localhost:8010/health
- **数据卷**: agent-center-data（持久化 SQLite 数据库）
- **预装软件**:
  - Python 3.13
  - Node.js (LTS)
  - Claude Code CLI (最新稳定版)
  - uv (Python 包管理器)

### 前端服务（agent-center-frontend）
- **端口**: 3010
- **健康检查**: http://localhost:3010
- **依赖**: 后端服务

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| DATABASE_URL | sqlite+aiosqlite:///./agent-center.db | 数据库连接 |
| CORS_ORIGINS | http://localhost:3010 | 允许的跨域源 |
| DEBUG | true | 调试模式 |
| MAX_CONCURRENT | 3 | 最大并发任务数 |

## 构建验证

后端和前端镜像已在本地验证：
- ✅ 后端 Docker build 成功 (1.31GB，含 Claude Code CLI)
- ✅ 前端 Docker build 成功 (1.26GB)
- ✅ 后端容器正常启动，健康检查通过
- ✅ 前端容器正常启动，页面渲染正常
- ✅ Claude Code CLI 已安装并可用 (v2.1.74)
- ✅ 数据库初始化成功

## GitHub Actions 自动构建

本项目配置了 GitHub Actions CI/CD 流程：

### docker-build.yml
- **触发条件**: 推送 `v*` 格式的 tag（如 `v1.0.0`）
- **功能**: 自动构建并推送 Docker 镜像到 GitHub Container Registry
- **镜像名称**:
  - `ghcr.io/agent-center/backend:latest` 和 `:v1.0.0`
  - `ghcr.io/agent-center/frontend:latest` 和 `:v1.0.0`

### ci.yml
- **触发条件**: PR 到 main/master 分支 或 push 到 main/master 分支
- **任务**:
  - Lint Backend - 代码风格检查
  - Lint Frontend - 前端代码检查
  - Test Backend - 单元测试
  - Build Check - Docker 构建验证

### 使用流程

```bash
# 1. 打 tag
git tag v1.0.0

# 2. 推送 tag（触发自动构建）
git push origin v1.0.0

# 3. 在 GitHub Actions 中查看构建进度
# 构建完成后，镜像可在 GitHub Packages 中使用
```

### 配置变量

在 GitHub 仓库 Settings -> Actions -> Variables 中配置：
- `API_DOMAIN`: API 域名（用于前端构建）

## 注意事项

1. 前端构建需要完整的 `frontend/lib/` 目录代码（已存在）
2. 在 GitHub Actions 中构建时，需要在 Settings -> Actions -> Variables 配置 `API_DOMAIN` 变量
3. 本地构建时，可以修改 Dockerfile 中的 `NEXT_PUBLIC_API_DOMAIN` 参数
