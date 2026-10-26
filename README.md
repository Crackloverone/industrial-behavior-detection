# 工业视觉行为检测系统

基于 YOLOv8 + ByteTrack 的工业安全检测原型系统，融合 EasyAIoT
`behavior-detection-lite`，实时检测指定蓝色工作服、抽烟和睡岗等行为，并完成告警、统计和人员管理闭环。

## 功能特性

- 📹 RTSP/RTMP 视频流接入
- 🎯 YOLOv8 行为检测模型接入
- 🚭 抽烟、睡岗、指定蓝色工作服检测
- 🔍 ByteTrack 多目标追踪
- ⚠️ 违规自动报警
- 📊 Web 管理界面
- 📈 数据统计分析

## 环境要求

- uv
- Python 3.11-3.12
- Node.js 18+ 与 pnpm
- Ubuntu 20.04+ / Windows 10+
- NVIDIA GPU (推荐 RTX 3060+)

## 快速开始

### 1. 安装依赖

```bash
uv sync
cd frontend
pnpm install
```

### 2. 下载模型

行为检测模型位于 `behavior-detection-lite/models/`，当前包含工作服、抽烟、睡岗模型。
可选：如需启用额外基础视觉 ONNX 检测器，可将模型放到 `models/ppe_detector.onnx`。

### 3. 运行服务

```bash
uv run uvicorn backend.main:app --port 8000

# 另一个终端
cd frontend
pnpm dev
```

访问前端: http://localhost:3000
后端 API: http://localhost:8000

## 检测类别

| 类别 | 说明 |
|-----|------|
| person | 人员 |
| workwear | 工作服 |
| no_workwear | 未穿指定蓝色工作服 |
| smoking | 抽烟 |
| sleep | 睡岗 |

违规: no_workwear, smoking, sleeping

## 当前展示口径

- 已完成工作服、抽烟、睡岗三个行为模型接入。
- 已完成本机摄像头检测、RTSP/MJPEG 预览、告警记录、告警截图、统计看板和员工照片录入。
- 基础 ONNX 检测器为可选模块；未提供 `models/ppe_detector.onnx` 时，系统仍可使用行为模型。
- 数据集规模较小，展示时以功能闭环和原型验证为主，不宣称生产级准确率。

## 项目结构

```
industrial-vision-behavior-system/
├── backend/
│   ├── main.py           # FastAPI 主程序
│   ├── detector.py       # YOLOv8 检测模块
│   ├── behavior_service.py # EasyAIoT 行为检测集成
│   ├── tracker.py        # ByteTrack 追踪
│   ├── stream_manager.py # 视频流管理
│   ├── alarm.py         # 报警管理
│   └── database.py      # 数据库
├── models/             # 训练结果和可选 ONNX 模型
├── behavior-detection-lite/ # 工作服、抽烟、睡岗模型
├── data/               # 数据存储
├── frontend/           # Web 前端
├── tests/              # 测试
├── pyproject.toml     # uv 依赖定义
└── uv.lock            # uv 锁文件
```

## API 接口

| 接口 | 方法 | 说明 |
|-----|------|------|
| /api/cameras | GET | 摄像头列表 |
| /api/cameras | POST | 添加摄像头 |
| /api/alarms | GET | 报警记录 |
| /api/stats | GET | 统计数据 |
| /api/behavior/info | GET | 行为模型状态 |

## 硬件配置

| 规模 | CPU | GPU | 内存 |
|-----|-----|-----|-----|
| 小型 (≤10路) | i7-12700F | RTX 3060 12GB | 16GB |
| 中型 (10-50路) | Xeon E5-2678 v3 ×2 | RTX 3090 24GB | 32GB |
| 大型 (≥50路) | 服务器集群 | Tesla T4 ×N | 64GB+ |

## 许可证

MIT License
