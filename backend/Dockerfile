# AgentCenter Backend Dockerfile
FROM python:3.13-slim

WORKDIR /app

# Install system dependencies with Tencent Cloud mirror
RUN sed -i 's/deb.debian.org/mirrors.tencent.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y \
    gcc \
    curl \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for Claude Code CLI)
RUN curl -fsSL https://mirrors.cloud.tencent.com/nodejs/setup.deb | bash - && \
    apt-get update && apt-get install -y nodejs npm && \
    rm -rf /var/lib/apt/lists/*

# Configure npm to use Tencent Cloud mirror
RUN npm config set registry https://mirrors.cloud.tencent.com/npm/

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Install uv package manager with Tencent Cloud mirror
RUN pip install --no-cache-dir -i https://mirrors.cloud.tencent.com/pypi/simple uv

# Configure uv to use Tencent Cloud mirror
ENV UV_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple

# Copy pyproject.toml for dependency installation
COPY backend/pyproject.toml .

# Install dependencies using uv (without installing the project itself)
RUN uv sync --no-dev --no-install-project

# Copy application code
COPY backend/ .

# Install the project itself (now that code is available)
RUN uv sync --no-dev

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 8010

# Run the application
CMD ["uv", "run", "uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
