#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_LOG="$ROOT_DIR/.backend.log"
FRONTEND_LOG="$ROOT_DIR/.frontend.log"
BACKEND_PID=""
FRONTEND_PID=""

stop_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[启动] 关闭占用端口 $port 的旧进程: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
  fi
}

cleanup() {
  trap - EXIT INT TERM
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ] && kill "$BACKEND_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

command -v uv >/dev/null || { echo "[错误] 未安装 uv"; exit 1; }
command -v pnpm >/dev/null || { echo "[错误] 未安装 pnpm"; exit 1; }

stop_port 8000
stop_port 3000

echo "[1/2] 启动后端..."
cd "$ROOT_DIR"
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "[错误] 后端启动失败"
    tail -50 "$BACKEND_LOG"
    exit 1
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo "[错误] 后端启动超时"
  tail -50 "$BACKEND_LOG"
  exit 1
fi

echo "[2/2] 启动前端..."
cd "$ROOT_DIR/frontend"
rm -rf .next-dev
pnpm dev >"$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo
    echo "系统已启动: http://localhost:3000"
    echo "按 Ctrl+C 停止前后端服务"
    wait "$FRONTEND_PID"
    exit $?
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "[错误] 前端启动失败"
    tail -50 "$FRONTEND_LOG"
    exit 1
  fi
  sleep 1
done

echo "[错误] 前端启动超时"
tail -50 "$FRONTEND_LOG"
exit 1
