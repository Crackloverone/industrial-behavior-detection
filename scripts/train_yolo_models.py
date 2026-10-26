from __future__ import annotations

import argparse
import json
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


PROJECT_ROOT = Path(__file__).resolve().parents[1]
YOLO_DATA_ROOT = PROJECT_ROOT / "datasets" / "yolo"
BEHAVIOR_MODEL_DIR = PROJECT_ROOT / "behavior-detection-lite" / "models"
DEFAULT_RUNS_DIR = PROJECT_ROOT / "runs" / "train"
DEFAULT_EXPORT_DIR = PROJECT_ROOT / "models" / "trained"


@dataclass(frozen=True)
class TrainingTarget:
    key: str
    data_yaml: Path
    base_weights: Path
    deploy_filename: str | None

    @property
    def export_dir(self) -> Path:
        return DEFAULT_EXPORT_DIR / self.key


TARGETS = {
    "sleeping": TrainingTarget(
        key="sleeping",
        data_yaml=YOLO_DATA_ROOT / "sleeping" / "data.yaml",
        base_weights=BEHAVIOR_MODEL_DIR / "sleeping.pt",
        deploy_filename="sleeping.pt",
    ),
    "workwear": TrainingTarget(
        key="workwear",
        data_yaml=YOLO_DATA_ROOT / "workwear" / "data.yaml",
        base_weights=BEHAVIOR_MODEL_DIR / "uniform.pt",
        deploy_filename=None,
    ),
}


def import_yolo():
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit(
            "缺少训练依赖 ultralytics，请先执行：uv add 'ultralytics>=8.4,<9'"
        ) from exc
    return YOLO


def load_yaml(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        data = yaml.safe_load(file)
    if not isinstance(data, dict):
        raise ValueError(f"{path} 不是合法 YAML 配置")
    return data


def validate_target(target: TrainingTarget) -> None:
    if not target.data_yaml.is_file():
        raise FileNotFoundError(f"数据集配置不存在: {target.data_yaml}")
    if not target.base_weights.is_file():
        raise FileNotFoundError(f"初始权重不存在: {target.base_weights}")

    data = load_yaml(target.data_yaml)
    dataset_root = Path(data.get("path", target.data_yaml.parent))
    if not dataset_root.is_absolute():
        dataset_root = (target.data_yaml.parent / dataset_root).resolve()

    for split in ("train", "val"):
        image_dir = dataset_root / str(data.get(split, ""))
        if not image_dir.is_dir():
            raise FileNotFoundError(f"{target.key} 的 {split} 图片目录不存在: {image_dir}")
        label_dir = dataset_root / "labels" / split
        if not label_dir.is_dir():
            raise FileNotFoundError(f"{target.key} 的 {split} 标签目录不存在: {label_dir}")


def check_target(target: TrainingTarget) -> dict[str, Any]:
    validate_target(target)
    data = load_yaml(target.data_yaml)
    dataset_root = Path(data.get("path", target.data_yaml.parent))
    if not dataset_root.is_absolute():
        dataset_root = (target.data_yaml.parent / dataset_root).resolve()

    result: dict[str, Any] = {
        "target": target.key,
        "data_yaml": str(target.data_yaml),
        "base_weights": str(target.base_weights),
        "classes": data.get("names", {}),
        "splits": {},
    }
    for split in ("train", "val"):
        image_dir = dataset_root / str(data[split])
        label_dir = dataset_root / "labels" / split
        images = sorted(
            path for path in image_dir.iterdir() if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
        )
        labels = sorted(label_dir.glob("*.txt"))
        image_stems = {path.stem for path in images}
        label_stems = {path.stem for path in labels}
        boxes = 0
        empty_labels = 0
        for label in labels:
            lines = [line for line in label.read_text(encoding="utf-8").splitlines() if line.strip()]
            boxes += len(lines)
            if not lines:
                empty_labels += 1
        result["splits"][split] = {
            "images": len(images),
            "labels": len(labels),
            "missing_labels": sorted(image_stems - label_stems)[:10],
            "orphan_labels": sorted(label_stems - image_stems)[:10],
            "boxes": boxes,
            "empty_labels": empty_labels,
        }
    return result


def train_one(
    target: TrainingTarget,
    *,
    model_override: Path | None,
    epochs: int,
    imgsz: int,
    batch: int,
    device: str | None,
    workers: int,
    patience: int,
    project: Path,
    resume: bool,
    run_name: str | None,
) -> dict[str, Any]:
    validate_target(target)
    YOLO = import_yolo()

    weights = model_override or target.base_weights
    resolved_run_name = run_name or f"{target.key}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    model = YOLO(str(weights))
    train_kwargs: dict[str, Any] = {
        "data": str(target.data_yaml),
        "epochs": epochs,
        "imgsz": imgsz,
        "batch": batch,
        "workers": workers,
        "patience": patience,
        "project": str(project),
        "name": resolved_run_name,
        "exist_ok": False,
        "pretrained": True,
        "verbose": True,
    }
    if device:
        train_kwargs["device"] = device
    if resume:
        train_kwargs["resume"] = True

    print(f"\n========== 开始训练 {target.key} ==========")
    print(f"数据集: {target.data_yaml}")
    print(f"初始权重: {weights}")
    print(f"训练输出: {project / resolved_run_name}")
    result = model.train(**train_kwargs)

    save_dir = Path(getattr(result, "save_dir", project / resolved_run_name))
    best = save_dir / "weights" / "best.pt"
    last = save_dir / "weights" / "last.pt"
    if not best.is_file():
        raise FileNotFoundError(f"训练完成但未找到 best.pt: {best}")

    target.export_dir.mkdir(parents=True, exist_ok=True)
    exported_best = target.export_dir / "best.pt"
    exported_last = target.export_dir / "last.pt"
    shutil.copy2(best, exported_best)
    if last.is_file():
        shutil.copy2(last, exported_last)

    summary = {
        "target": target.key,
        "data_yaml": str(target.data_yaml),
        "base_weights": str(weights),
        "run_dir": str(save_dir),
        "best": str(exported_best),
        "last": str(exported_last) if exported_last.is_file() else None,
        "deploy_filename": target.deploy_filename,
    }
    (target.export_dir / "train_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"✅ {target.key} 训练完成，best.pt 已复制到: {exported_best}")
    return summary


def backup_and_deploy(summary: dict[str, Any], target: TrainingTarget) -> Path:
    if target.deploy_filename is None:
        raise ValueError(
            f"{target.key} 不支持自动部署。训练完成后需要先更新检测配置中的类别名和违规类别。"
        )
    source = Path(summary["best"])
    destination = BEHAVIOR_MODEL_DIR / target.deploy_filename
    if not source.is_file():
        raise FileNotFoundError(f"待部署模型不存在: {source}")
    if destination.exists():
        backup = destination.with_name(
            f"{destination.stem}.backup-{datetime.now().strftime('%Y%m%d_%H%M%S')}{destination.suffix}"
        )
        shutil.copy2(destination, backup)
        print(f"已备份旧模型: {backup}")
    shutil.copy2(source, destination)
    print(f"已部署新模型: {destination}")
    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="微调睡觉检测和指定蓝色工作服检测 YOLO 模型。"
    )
    parser.add_argument(
        "targets",
        nargs="*",
        choices=sorted(TARGETS),
        default=None,
        help="要训练的目标，默认训练 sleeping 和 workwear。",
    )
    parser.add_argument("--epochs", type=int, default=40, help="训练轮数。")
    parser.add_argument("--imgsz", type=int, default=640, help="训练图片尺寸。")
    parser.add_argument("--batch", type=int, default=8, help="batch size，显存/内存不足时调小。")
    parser.add_argument("--device", default=None, help="训练设备，例如 cpu、mps、0。默认由 Ultralytics 自动选择。")
    parser.add_argument("--workers", type=int, default=0, help="数据加载线程数。macOS 上默认 0 更稳定。")
    parser.add_argument("--patience", type=int, default=15, help="早停 patience。")
    parser.add_argument("--project", type=Path, default=DEFAULT_RUNS_DIR, help="训练运行目录。")
    parser.add_argument("--name", default=None, help="指定 Ultralytics run 名称。")
    parser.add_argument("--model", type=Path, default=None, help="覆盖默认初始权重。")
    parser.add_argument("--resume", action="store_true", help="恢复 Ultralytics 训练。")
    parser.add_argument("--check", action="store_true", help="只检查数据集和权重，不启动训练。")
    parser.add_argument(
        "--deploy",
        action="store_true",
        help="训练后自动部署支持安全覆盖的模型。目前仅 sleeping 支持自动部署。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.targets:
        args.targets = sorted(TARGETS)
    args.project.mkdir(parents=True, exist_ok=True)
    if args.check:
        checks = [check_target(TARGETS[key]) for key in args.targets]
        print(json.dumps(checks, ensure_ascii=False, indent=2))
        return 0

    summaries = []
    for key in args.targets:
        target = TARGETS[key]
        summary = train_one(
            target,
            model_override=args.model,
            epochs=args.epochs,
            imgsz=args.imgsz,
            batch=args.batch,
            device=args.device,
            workers=args.workers,
            patience=args.patience,
            project=args.project,
            resume=args.resume,
            run_name=args.name,
        )
        summaries.append(summary)
        if args.deploy:
            if target.deploy_filename is None:
                print(
                    f"跳过自动部署 {target.key}: 训练模型类别与当前运行配置不同，"
                    "需要先更新检测配置后再接入。"
                )
            else:
                backup_and_deploy(summary, target)

    print("\n========== 训练结果汇总 ==========")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))
    if "workwear" in args.targets and not args.deploy:
        print(
            "\n提示：workwear 训练结果不会自动替换当前 uniform.pt。"
            "因为新类别是 workwear/no_workwear，需要先更新检测配置后再接入。"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
