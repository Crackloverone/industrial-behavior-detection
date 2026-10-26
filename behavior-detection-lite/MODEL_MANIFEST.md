# 模型清单

| 文件 | 原始路径 | 类别 | SHA-256 |
| --- | --- | --- | --- |
| `models/uniform.pt` | `.scripts/minio/models/yolo/yolov8/c7b364e123a84f70a954403399c61dac.pt` | `reflection`, `clothes` | `5d38f11569a5102b58a11cd05136c5651e5dfba1a675ff41e8a42147731f660e` |
| `models/smoking.pt` | `.scripts/minio/models/yolo/yolov8/baaab3e73fd74064ae42d57b0e170663.pt` | `smoking` | `745cae43c4a6fec1c6fa1a9eecc2652edeb5cc4ad464f721911977020fb6348e` |
| `models/sleeping.pt` | `.scripts/minio/models/yolo/yolov8/21f8ba84e4e64d9a9de924d3eb246033.pt` | `sleep` | `e03390467d432186049d2ecd23362de0a450dc814176041bd005a0895d1a9906` |

数据库备份 `.scripts/postgresql/iot-ai10.sql` 中的模型记录确认了原始模型来源。当前主项目默认使用 `workwear.pt`、`smoking.pt`、`sleeping.pt`。

## 可选扩展

| 能力 | 原始模型 |
| --- | --- |
| 打电话 | `.scripts/minio/models/yolo/yolov8/onnx/6e25627aa8434831b4ddcee194b8be59.onnx` |
| 跌倒 | `.scripts/minio/models/yolo/yolov8/onnx/f7bd3b98d1ea476c98761b57d42f73c4.onnx` |

这些扩展模型尚未复制到轻量版，避免扩大首版范围和安装体积。
