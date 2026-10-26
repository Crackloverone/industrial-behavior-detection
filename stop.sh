#!/usr/bin/env bash
set -euo pipefail

for port in 3000 8000; do
  pids="$(lsof -ti "tcp:$port" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null || true
    echo "已停止端口 $port: $pids"
  fi
done
