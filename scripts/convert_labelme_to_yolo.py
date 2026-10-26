from __future__ import annotations

import argparse
import itertools
import json
import re
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

from PIL import Image


IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

DATASETS = {
    "sleeping": {
        "source": Path("已打标/sleeping/images/all"),
        "classes": ["sleep"],
    },
    "workwear": {
        "source": Path("已打标/workwear/images/all"),
        "classes": ["workwear", "no_workwear"],
    },
}


@dataclass(frozen=True)
class Sample:
    image: Path
    json_path: Path
    group: str
    labels: Counter[str]


def video_group(path: Path) -> str:
    match = re.search(r"_v(\d+)_", path.name)
    return match.group(1) if match else "unknown"


def read_labelme_labels(json_path: Path) -> Counter[str]:
    if not json_path.exists():
        return Counter()
    data = json.loads(json_path.read_text(encoding="utf-8"))
    return Counter(shape.get("label", "") for shape in data.get("shapes", []))


def collect_samples(source: Path) -> list[Sample]:
    images = sorted(p for p in source.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    return [
        Sample(
            image=image,
            json_path=image.with_suffix(".json"),
            group=video_group(image),
            labels=read_labelme_labels(image.with_suffix(".json")),
        )
        for image in images
    ]


def choose_val_groups(samples: list[Sample], class_names: list[str], val_ratio: float) -> set[str]:
    groups: dict[str, list[Sample]] = defaultdict(list)
    for sample in samples:
        groups[sample.group].append(sample)

    total = len(samples)
    target = max(1, round(total * val_ratio))
    all_labels = Counter()
    has_empty = False
    for sample in samples:
        all_labels.update(sample.labels)
        has_empty = has_empty or not sample.labels

    best_score: tuple[float, int] | None = None
    best_groups: set[str] = set()
    group_names = sorted(groups)
    for size in range(1, len(group_names)):
        for combo in itertools.combinations(group_names, size):
            val_samples = [sample for group in combo for sample in groups[group]]
            val_labels = Counter()
            val_has_empty = False
            for sample in val_samples:
                val_labels.update(sample.labels)
                val_has_empty = val_has_empty or not sample.labels

            missing_label_penalty = 0
            for class_name in class_names:
                if all_labels[class_name] > 0 and val_labels[class_name] == 0:
                    missing_label_penalty += 1000

            empty_penalty = 100 if has_empty and not val_has_empty else 0
            count_penalty = abs(len(val_samples) - target) / max(total, 1)
            oversize_penalty = max(0, len(val_samples) - total * 0.3) / max(total, 1)
            score = (
                missing_label_penalty + empty_penalty + count_penalty + oversize_penalty,
                len(combo),
            )
            if best_score is None or score < best_score:
                best_score = score
                best_groups = set(combo)
    return best_groups


def labelme_to_yolo_lines(json_path: Path, class_to_id: dict[str, int], image_path: Path) -> list[str]:
    if not json_path.exists():
        return []

    data = json.loads(json_path.read_text(encoding="utf-8"))
    width = data.get("imageWidth")
    height = data.get("imageHeight")
    if not width or not height:
        with Image.open(image_path) as image:
            width, height = image.size

    lines: list[str] = []
    for shape in data.get("shapes", []):
        label = shape.get("label")
        if label not in class_to_id:
            raise ValueError(f"{json_path}: 未知类别 {label!r}")
        if shape.get("shape_type") != "rectangle":
            raise ValueError(f"{json_path}: 只支持 rectangle，实际是 {shape.get('shape_type')!r}")

        points = shape.get("points", [])
        if len(points) != 2:
            raise ValueError(f"{json_path}: rectangle 点数量异常")

        x1, y1 = points[0]
        x2, y2 = points[1]
        x_min, x_max = sorted((float(x1), float(x2)))
        y_min, y_max = sorted((float(y1), float(y2)))

        x_min = max(0.0, min(float(width), x_min))
        x_max = max(0.0, min(float(width), x_max))
        y_min = max(0.0, min(float(height), y_min))
        y_max = max(0.0, min(float(height), y_max))
        if x_max <= x_min or y_max <= y_min:
            raise ValueError(f"{json_path}: 无效框 {(x_min, y_min, x_max, y_max)}")

        x_center = ((x_min + x_max) / 2) / width
        y_center = ((y_min + y_max) / 2) / height
        box_width = (x_max - x_min) / width
        box_height = (y_max - y_min) / height
        lines.append(
            f"{class_to_id[label]} {x_center:.6f} {y_center:.6f} {box_width:.6f} {box_height:.6f}"
        )
    return lines


def write_data_yaml(out_dir: Path, class_names: list[str]) -> None:
    names = "\n".join(f"  {idx}: {name}" for idx, name in enumerate(class_names))
    content = (
        f"path: {out_dir.resolve()}\n"
        "train: images/train\n"
        "val: images/val\n"
        f"nc: {len(class_names)}\n"
        "names:\n"
        f"{names}\n"
    )
    (out_dir / "data.yaml").write_text(content, encoding="utf-8")


def convert_dataset(name: str, source: Path, class_names: list[str], output_root: Path, val_ratio: float) -> dict:
    samples = collect_samples(source)
    if not samples:
        raise ValueError(f"{source} 中没有图片")

    out_dir = output_root / name
    if out_dir.exists():
        shutil.rmtree(out_dir)
    for split in ("train", "val"):
        (out_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (out_dir / "labels" / split).mkdir(parents=True, exist_ok=True)

    val_groups = choose_val_groups(samples, class_names, val_ratio)
    class_to_id = {class_name: idx for idx, class_name in enumerate(class_names)}
    stats = {
        "dataset": name,
        "classes": class_names,
        "val_groups": sorted(val_groups),
        "splits": {
            "train": {"images": 0, "empty_labels": 0, "boxes": Counter()},
            "val": {"images": 0, "empty_labels": 0, "boxes": Counter()},
        },
    }

    for sample in samples:
        split = "val" if sample.group in val_groups else "train"
        image_out = out_dir / "images" / split / sample.image.name
        label_out = out_dir / "labels" / split / f"{sample.image.stem}.txt"
        shutil.copy2(sample.image, image_out)
        lines = labelme_to_yolo_lines(sample.json_path, class_to_id, sample.image)
        label_out.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

        stats["splits"][split]["images"] += 1
        if not lines:
            stats["splits"][split]["empty_labels"] += 1
        for line in lines:
            class_id = int(line.split()[0])
            stats["splits"][split]["boxes"][class_names[class_id]] += 1

    write_data_yaml(out_dir, class_names)
    summary = {
        "dataset": stats["dataset"],
        "classes": stats["classes"],
        "val_groups": stats["val_groups"],
        "splits": {
            split: {
                "images": values["images"],
                "empty_labels": values["empty_labels"],
                "boxes": dict(values["boxes"]),
            }
            for split, values in stats["splits"].items()
        },
    }
    (out_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert LabelMe datasets to YOLO format.")
    parser.add_argument("--output", type=Path, default=Path("datasets/yolo"))
    parser.add_argument("--val-ratio", type=float, default=0.2)
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    summaries = []
    for name, config in DATASETS.items():
        summaries.append(
            convert_dataset(
                name=name,
                source=config["source"],
                class_names=config["classes"],
                output_root=args.output,
                val_ratio=args.val_ratio,
            )
        )

    print(json.dumps(summaries, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
