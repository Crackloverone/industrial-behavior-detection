FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 先复制依赖清单，利用 Docker 缓存安装依赖
COPY pyproject.toml uv.lock ./
COPY behavior-detection-lite/pyproject.toml behavior-detection-lite/README.md ./behavior-detection-lite/
COPY behavior-detection-lite/src/ ./behavior-detection-lite/src/
COPY behavior-detection-lite/models/ ./behavior-detection-lite/models/
RUN uv sync --frozen --no-dev

# 复制后端代码
COPY backend/ ./backend/
COPY models/ ./models/
COPY data/ ./data/

# 创建数据目录
RUN mkdir -p data/alarms

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["uv", "run", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
