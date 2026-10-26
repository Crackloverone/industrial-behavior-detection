# 工业视觉行为检测系统 - 开发者使用说明

> **版本**: 1.1.0  
> **技术栈**: Python 3.11+ / FastAPI / Next.js 14 / YOLOv8 / OpenCV  
> **目标读者**: 接手或二次开发本系统的程序员

---

## 一、系统概述

本系统是一套面向工业企业的视觉AI检测平台，核心功能包括：

| 模块 | 功能 | 路由前缀 |
|---|---|---|
| 视频监控 | RTSP/USB摄像头接入、MJPEG推流、WebSocket实时画面 | `/api/stream` |
| 行为检测 | 工作服/抽烟/睡岗违规检测，ByteTrack多目标追踪 | `/api/detect` |
| 人脸识别 | YuNet+SFace，多照片注册，多帧融合投票 | `/api/employees` |
| 报警管理 | 自动告警、冷却屏蔽、WebSocket推送、事件录像 | `/api/alarms` |
| 员工管理 | CRUD + 人脸录入 + 违规关联 | `/api/employees` |
| 考勤管理 | 签到/签退、人脸识别签到、请假、考勤规则 | `/api/attendance` |
| 区域管理 | 危险区域配置、入侵检测 | `/api/zones` |
| 交接班 | 交接记录、设备状态、安全事项 | `/api/handover` |
| 摄像头资源 | 多功能摄像头协调、优先级抢占 | `/api/camera-manager` |
| 模型训练 | Web端YOLO微调、实时指标图表 | `/api/training` |

---

## 二、环境要求

```
Python:     3.11 ~ 3.12
Node.js:    18+
pnpm:       8+ (通过 corepack enable)
OS:         Windows 10/11 (主推) 或 Linux
GPU:        可选，CUDA 11.8+ 用于加速推理
```

### Python 核心依赖

| 包 | 版本 | 用途 |
|---|---|---|
| fastapi | >=0.104 | Web API 框架 |
| uvicorn | >=0.24 | ASGI 服务器 |
| ultralytics | >=8.4,<9 | YOLOv8 推理+训练 |
| opencv-python | >=4.8 | 图像处理 + 人脸检测/识别 |
| onnxruntime | >=1.16 | ONNX 模型推理 |
| passlib | >=1.7.4 | 密码哈希 (PBKDF2-SHA256) |
| websockets | >=12.0 | WebSocket 实时推送 |
| aiofiles | >=23.0 | 异步文件操作 |

### 前端依赖

| 包 | 版本 |
|---|---|
| next | ^14 |
| react | ^18 |
| react-dom | ^18 |

---

## 三、快速开始

### 方式一：Windows 一键部署

```bash
# 1. 安装依赖
install.bat

# 2. 启动系统
start.bat

# 3. 访问
# 前端: http://localhost:3000
# 后端: http://localhost:8000
# 默认账号: admin / (空密码)
```

### 方式二：手动启动

```bash
# 后端
cd industrial_vision_behavior_windows
uv sync
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000

# 前端 (另一个终端)
cd frontend
pnpm install
pnpm dev
```

### 方式三：Docker 部署

```bash
docker-compose up -d
# 前端: http://localhost:3000
# 后端: http://localhost:8000
```

---

## 四、项目结构

```
industrial_vision_behavior_windows/
├── backend/                    # Python 后端
│   ├── main.py                 # FastAPI 入口，应用生命周期
│   ├── detector.py             # YOLOv8 ONNX 检测器
│   ├── tracker.py              # ByteTrack 多目标追踪
│   ├── stream_manager.py       # 视频流管理（捕获+处理双线程）
│   ├── behavior_service.py     # 行为检测服务（工作服/抽烟/睡岗）
│   ├── face_recognizer.py      # 人脸识别（YuNet+SFace）
│   ├── alarm.py                # 报警管理（冷却+屏蔽+硬件）
│   ├── database.py             # SQLite 数据库（7+7张表）
│   ├── camera.py               # USB 摄像头检测
│   ├── camera_resource_manager.py  # 摄像头资源协调器
│   ├── cache.py                # TTL 内存缓存
│   ├── training_service.py     # 模型训练管理
│   └── routers/                # API 路由
│       ├── auth.py             # /api/auth - 登录注册
│       ├── cameras.py          # /api/cameras - 摄像头CRUD
│       ├── stream.py           # /api/stream, /ws/video - 视频流
│       ├── detect.py           # /api/detect - AI检测
│       ├── alarms.py           # /api/alarms - 报警记录
│       ├── employees.py        # /api/employees - 员工管理
│       ├── attendance.py       # /api/attendance - 考勤管理
│       ├── zones.py            # /api/zones - 区域管理
│       ├── handover.py         # /api/handover - 交接班
│       ├── camera_manager.py   # /api/camera-manager - 资源协调
│       ├── stats.py            # /api/stats - 统计
│       ├── model.py            # /api/model - 模型管理
│       ├── training.py         # /api/training - 训练
│       ├── config.py           # /api/config - 系统配置
│       ├── usb_cameras.py      # /api/usb-cameras - USB检测
│       └── users.py            # /api/users - 用户管理
│
├── frontend/                   # Next.js 前端
│   ├── app/
│   │   ├── page.js             # 主页面（SPA，含所有视图组件）
│   │   └── layout.js           # 布局
│   ├── components/             # 可复用组件
│   ├── lib/api.js              # API 封装
│   └── public/                 # 静态资源
│
├── behavior-detection-lite/    # 行为检测子模块
│   ├── src/behavior_detection/
│   │   ├── detector.py         # YOLO 多模型推理
│   │   ├── events.py           # 事件追踪（连续帧验证）
│   │   └── config.py           # 模型规格定义
│   └── models/                 # 预训练模型
│       ├── workwear.pt         # 工作服检测
│       ├── smoking.pt          # 抽烟检测
│       ├── sleeping.pt         # 睡岗检测
│       └── uniform.pt          # 制服检测
│
├── models/face/                # 人脸模型
│   ├── face_detection_yunet_2023mar.onnx
│   └── face_recognition_sface_2021dec.onnx
│
├── data/                       # 运行时数据
│   ├── ppe_monitor.db          # SQLite 数据库
│   ├── face_database/          # 员工人脸照片
│   ├── alarm_images/           # 报警截图
│   ├── alarm_videos/           # 违规事件视频
│   └── attendance_images/      # 签到拍照
│
├── docker-compose.yaml         # Docker 编排
├── Dockerfile                  # 后端镜像
├── pyproject.toml              # Python 项目配置
├── install.bat                 # Windows 一键安装
├── start.bat                   # Windows 一键启动
└── stop.bat                    # Windows 一键停止
```

---

## 五、核心架构

### 5.1 数据流

```
USB/RTSP 摄像头
       │
       ▼
┌──────────────┐    帧队列    ┌──────────────┐
│  捕获线程     │ ──────────▶ │  处理线程     │
│  (Producer)  │             │  (Consumer)  │
└──────────────┘             └──────┬───────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ PPE检测   │  │ 行为检测  │  │ ByteTrack│
              │ (YOLOv8) │  │ (3模型)  │  │ 追踪     │
              └────┬─────┘  └────┬─────┘  └────┬─────┘
                   │             │              │
                   └─────────────┼──────────────┘
                                 ▼
                          ┌────────────┐
                          │ 违规判定    │
                          │ + 冷却检查  │
                          └─────┬──────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
              ┌──────────┐ ┌────────┐ ┌──────────┐
              │ 数据库写入 │ │ 截图保存│ │ WebSocket│
              └──────────┘ └────────┘ │ 实时推送  │
                                      └──────────┘
```

### 5.2 全局状态 (`AppState`)

```python
# backend/main.py
class AppState:
    detector          # YOLOv8 检测器 (ONNX)
    tracker           # ByteTrack 追踪器
    stream_manager    # 视频流管理器
    alarm_manager     # 报警管理器
    database          # SQLite 数据库
    face_recognizer   # 人脸识别器
    behavior_service  # 行为检测服务
    camera_resource_manager  # 摄像头资源协调器
```

所有路由通过 `_get_state()` 访问全局状态。

### 5.3 数据库表结构

| 表名 | 用途 | 关键字段 |
|---|---|---|
| `cameras` | 摄像头配置 | id, name, rtsp_url, is_usb, camera_index |
| `employees` | 员工信息 | id, name, employee_number, face_encoding |
| `alarms` | 报警记录 | id, camera_id, violation_type, employee_id |
| `users` | 系统用户 | id, username, password, role, token |
| `config` | 系统配置 (KV) | key, value |
| `attendance_rules` | 考勤规则 | work_start_time, late_threshold |
| `attendance_records` | 考勤记录 | employee_id, check_in_time, status |
| `leave_records` | 请假记录 | employee_id, leave_type, status |
| `attendance_statistics` | 月度统计 | year, month, attendance_rate |
| `zones` | 区域配置 | name, zone_type, points, camera_id |
| `zone_alerts` | 区域告警 | zone_id, employee_id, timestamp |
| `handover_records` | 交接班 | outgoing/incoming_employee_id, shift |
| `audit_log` | 审计日志 | user_id, action, detail |

---

## 六、API 接口速查

### 认证

```bash
POST /api/auth/register    # 注册 { username, password }
POST /api/auth/login       # 登录 { username, password } → { token, user }
POST /api/auth/logout      # 退出
GET  /api/auth/me          # 当前用户
```

### 摄像头

```bash
GET    /api/cameras              # 摄像头列表
POST   /api/cameras              # 添加摄像头 { name, rtsp_url, location, is_usb }
PUT    /api/cameras/{id}         # 更新
DELETE /api/cameras/{id}         # 删除
GET    /api/usb-cameras          # 检测USB摄像头
GET    /api/usb-cameras/test/{i} # 测试指定摄像头
POST   /api/usb-cameras/use      # 添加USB摄像头
```

### 视频流

```bash
POST /api/stream/{id}/start      # 启动流
POST /api/stream/{id}/stop       # 停止流
GET  /api/stream/{id}/mjpeg      # MJPEG推流
WS   /ws/video/{id}              # WebSocket视频
WS   /ws/alarms                  # WebSocket报警推送
```

### AI检测

```bash
POST /api/detect                  # 图片检测 { image: base64 }
GET  /api/detect/behavior/info    # 行为检测模型信息
```

### 报警

```bash
GET    /api/alarms                # 报警列表 ?limit=100
GET    /api/alarms/{id}           # 单条详情
PUT    /api/alarms/{id}/handle    # 处理报警 { result, note }
DELETE /api/alarms/{id}           # 删除
GET    /api/alarms/{id}/image     # 报警截图
GET    /api/alarms/{id}/video     # 事件视频
```

### 员工

```bash
GET    /api/employees             # 员工列表
POST   /api/employees             # 创建 { name, employee_number, department }
PUT    /api/employees/{id}        # 更新
DELETE /api/employees/{id}        # 删除
POST   /api/employees/{id}/photo  # 上传照片 (face类型自动注册人脸)
GET    /api/employees/{id}/photo  # 获取照片
POST   /api/employees/recognize   # 人脸识别 { image: base64 }
```

### 考勤

```bash
# 规则
GET    /api/attendance/rules              # 规则列表
POST   /api/attendance/rules              # 创建规则
PUT    /api/attendance/rules/{id}         # 更新
DELETE /api/attendance/rules/{id}         # 删除
POST   /api/attendance/rules/{id}/activate # 激活规则

# 签到签退（手动）
POST /api/attendance/check-in     # { employee_id, camera_id?, location? }
POST /api/attendance/check-out    # { employee_id, camera_id?, location? }

# 人脸识别签到
POST /api/attendance/face-recognize   # 智能签到/签退
POST /api/attendance/face-check-in    # 强制签到
POST /api/attendance/face-check-out   # 强制签退

# 请求体（三选一）:
# 方式1: { image: "base64...", action: "auto" }           浏览器摄像头
# 方式2: { camera_index: 0, action: "auto" }              后端摄像头
# 方式3: { image: "base64...", camera_id: 1, location: "门口" } 指定位置

# 记录查询
GET  /api/attendance/records       # 考勤记录列表
GET  /api/attendance/today         # 今日考勤概览
GET  /api/attendance/statistics    # 月度统计

# 请假
GET    /api/attendance/leaves             # 请假列表
POST   /api/attendance/leaves             # 创建请假
PUT    /api/attendance/leaves/{id}/approve # 审批 { status: "approved" }
```

### 区域管理

```bash
GET    /api/zones                # 区域列表
POST   /api/zones                # 创建区域 { name, zone_type, camera_id }
PUT    /api/zones/{id}           # 更新
DELETE /api/zones/{id}           # 删除
POST   /api/zones/{id}/toggle    # 启用/禁用
GET    /api/zones/alerts         # 入侵告警记录
```

### 交接班

```bash
GET  /api/handover/records       # 交接记录列表
POST /api/handover/records       # 创建交接 { outgoing_employee_id, incoming_employee_id, shift }
PUT  /api/handover/records/{id}  # 更新
GET  /api/handover/statistics    # 交接统计
```

### 摄像头资源协调

```bash
GET  /api/camera-manager/status                    # 所有摄像头分配状态
POST /api/camera-manager/request                   # 请求摄像头
POST /api/camera-manager/release                   # 释放摄像头
GET  /api/camera-manager/frame/{camera_index}      # 获取当前帧
```

**请求摄像头示例**:
```json
{
  "task_id": "face_checkin_001",
  "function": "attendance",
  "camera_index": 0,
  "priority": 2,
  "duration": 0
}
```

优先级: `1=安全检测(不可抢占)` `2=签到` `3=巡检` `4=监控(可被抢占)`

### 统计

```bash
GET /api/stats              # 总览统计
GET /api/stats/daily        # 每日趋势
GET /api/stats/camera/{id}  # 摄像头维度统计
```

---

## 七、模型文件说明

### 人脸识别模型 (`models/face/`)

| 文件 | 用途 | 输入尺寸 |
|---|---|---|
| `face_detection_yunet_2023mar.onnx` | 人脸检测 (YuNet) | 640x640 |
| `face_recognition_sface_2021dec.onnx` | 人脸识别 (SFace) | 112x112 |

### 行为检测模型 (`behavior-detection-lite/models/`)

| 文件 | 用途 | 类别 |
|---|---|---|
| `workwear.pt` | 蓝色工作服检测 | workwear / no_workwear |
| `smoking.pt` | 抽烟行为检测 | smoking |
| `sleeping.pt` | 睡岗行为检测 | sleeping |
| `uniform.pt` | 制服检测 | uniform |

### YOLO 模型 (`models/trained/`)

自定义训练的模型输出到这里，可通过 Web 界面上传替换。

---

## 八、关键配置

通过 `/api/config` 或数据库 `config` 表管理：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `conf_threshold` | 0.5 | 检测置信度阈值 |
| `iou_threshold` | 0.45 | NMS IOU 阈值 |
| `face_rec_threshold` | 0.3 | 人脸识别阈值 |
| `alarm_cooldown` | 3 | 同类报警冷却时间(秒) |
| `data_retention_days` | 90 | 数据保留天数 |
| `max_tracks` | 30 | ByteTrack 最大追踪数 |

---

## 九、扩展开发指南

### 9.1 添加新路由

1. 在 `backend/routers/` 创建新文件：

```python
# backend/routers/my_module.py
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/my-module", tags=["my-module"])

def _get_state():
    from backend.main import state
    return state

@router.get("")
async def get_data(request: Request):
    from backend.main import _require_user
    _require_user(request)
    return {"code": 200, "data": []}
```

2. 在 `backend/main.py` 注册：

```python
from backend.routers import my_module
app.include_router(my_module.router)
```

### 9.2 添加新数据库表

在 `backend/database.py` 的 `_create_tables()` 方法中添加：

```python
cursor.execute("""
    CREATE TABLE IF NOT EXISTS my_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at REAL DEFAULT (strftime('%s', 'now'))
    )
""")
```

然后添加对应的 CRUD 方法到 `Database` 类。

### 9.3 前端添加新页面

1. 在 `page.js` 的 `NAV_ITEMS` 添加导航项
2. 在 `renderContent()` 添加路由
3. 创建对应的 View 组件

### 9.4 摄像头资源协调使用

```python
from backend.main import state

# 请求摄像头（签到功能）
result = state.camera_resource_manager.request_camera(
    task_id="my_task_001",
    function="attendance",       # 功能名称
    camera_index=0,              # 摄像头索引
    priority=2,                  # 优先级 (1最高)
    duration=0,                  # 0=持续占用
)

if result['success']:
    # 获取帧进行处理
    frame = state.camera_resource_manager.get_frame(0)
    # ... 处理帧
    
    # 用完释放
    state.camera_resource_manager.release_camera("my_task_001")
```

---

## 十、工厂部署注意事项

### 10.1 摄像头分配建议

| 位置 | 摄像头用途 | 优先级 |
|---|---|---|
| 工厂入口 | 安全检测 + 人脸签到 | 1(安全) / 2(签到) |
| 车间产线 | 安全检测 | 1 |
| 签到台 | 人脸识别签到 | 2 |
| 仓库 | 视频监控 | 4 |

### 10.2 USB摄像头兼容性

- Windows 使用 DirectShow 后端，自动降级 MSMF → Default
- 检测范围 0-19，优先检测 0-5
- 支持通过 WMI 获取设备真实名称

### 10.3 性能建议

- **CPU模式**: 足够处理4-6路720p视频流
- **GPU模式**: 安装 CUDA 版 onnxruntime，可处理10+路
- **数据库**: SQLite WAL 模式，适合中小规模；大规模部署替换为 MySQL
- **人脸注册**: 建议每人3-5张照片，覆盖不同光照角度

---

## 十一、常见问题

**Q: USB摄像头检测不到？**  
A: 运行 `GET /api/usb-cameras` 查看，确保摄像头未被其他程序占用。系统会自动尝试 DirectShow/MSMF/Default 三个后端。

**Q: 人脸识别率低？**  
A: 在员工管理中为每人录入3-5张不同角度的照片，确保光照充足。可调整 `face_rec_threshold`（越低越宽松）。

**Q: 行为检测误报多？**  
A: 调高 `conf_threshold`（如0.6），EventTracker 已内置连续帧验证（默认3帧确认+10秒冷却）。

**Q: 同一摄像头被多个功能占用？**  
A: 使用 `/api/camera-manager` 资源协调器，通过优先级抢占机制自动调度。
