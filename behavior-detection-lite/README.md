# 企业行为检测轻量版

该目录从 EasyAIoT 中提取轻量行为检测能力，不依赖 PostgreSQL、MinIO、Nacos、Kafka、Java 服务或 WEB 管理端。当前主项目默认使用指定蓝色工作服、抽烟、睡岗三个模型。

## 模型

| 功能 | 模型类别 | 违规判定 |
| --- | --- | --- |
| 指定蓝色工作服 | `workwear`、`no_workwear` | `no_workwear` 判定为未穿指定蓝色工作服 |
| 抽烟 | `smoking` | 检出即为违规候选 |
| 睡觉 | `sleep` | 检出即为违规候选 |

说明：`uniform.pt` 是从 EasyAIoT 保留的历史可选模型，目标偏向反光服；当前主项目默认不启用它。

## 安装

```bash
cd behavior-detection-lite
uv sync
```

## 使用

图片：

```bash
uv run behavior-detect demo.jpg -o outputs/demo_result.jpg
```

视频：

```bash
uv run behavior-detect demo.mp4 -o outputs/demo_result.mp4
```

摄像头或 RTSP：

```bash
uv run behavior-detect 0
uv run behavior-detect 'rtsp://user:password@camera/stream'
```

只启用部分模型：

```bash
uv run behavior-detect demo.jpg --models smoking sleeping
```

启动 HTTP 接口：

```bash
uv run behavior-api
curl -F image=@demo.jpg http://127.0.0.1:8000/detect
```

接口返回统一 JSON，其中 `violation=true` 表示违规候选。视频检测默认连续 3 帧命中才生成事件，同类事件 10 秒内不重复告警。

## 可选扩展能力

后续可继续加入打电话、跌倒、区域规则和连续帧确认等行为管理能力。当前版本保持轻量，只默认启用蓝色工作服、抽烟和睡岗。

## 来源与许可

代码提取自本仓库的 EasyAIoT 推理链路，仓库采用 MIT License。模型权重来自仓库本地 MinIO 数据目录；用于作业前仍应确认模型数据集的授权范围。
