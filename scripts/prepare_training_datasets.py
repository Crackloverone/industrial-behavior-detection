#!/usr/bin/env python3
"""从采集视频生成待标注的睡岗与工作服图片数据集。"""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import zipfile
from dataclasses import asdict, dataclass
from pathlib import Path

import cv2
import numpy as np


@dataclass(frozen=True)
class DatasetSpec:
    name: str
    video_numbers: tuple[int, ...]
    interval_seconds: float
    classes: tuple[str, ...]
    description: str


@dataclass
class FrameRecord:
    dataset: str
    image_name: str
    source_video: str
    source_video_number: int
    frame_index: int
    timestamp_seconds: float
    source_fps: float
    source_width: int
    source_height: int
    output_width: int
    output_height: int
    blur_score: float
    difference_score: float | None
    status: str
    reason: str


SPECS = (
    DatasetSpec(
        name="sleeping",
        video_numbers=tuple(range(5448, 5455)) + tuple(range(5461, 5464)),
        interval_seconds=1.0,
        classes=("sleep",),
        description="睡岗检测：仅给真实睡觉人员画矩形框；清醒、低头、扶额等图片作为无框负样本。",
    ),
    DatasetSpec(
        name="workwear",
        video_numbers=tuple(range(5455, 5461)) + tuple(range(5464, 5466)),
        interval_seconds=1.5,
        classes=("workwear", "no_workwear"),
        description="指定蓝色工作服检测：穿指定蓝色工作服标 workwear，否则标 no_workwear。",
    ),
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-dir", type=Path, default=Path("数据视频"))
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("datasets/prepared"),
    )
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=720)
    parser.add_argument("--jpeg-quality", type=int, default=92)
    parser.add_argument(
        "--min-blur-score",
        type=float,
        default=45.0,
        help="Laplacian 方差低于该值的帧视为严重模糊。",
    )
    parser.add_argument(
        "--min-difference",
        type=float,
        default=2.2,
        help="与同视频上一保留帧的缩略灰度平均差低于该值时视为近似重复。",
    )
    parser.add_argument("--force", action="store_true", help="覆盖已有输出目录。")
    return parser.parse_args()


def validate_inputs(video_dir: Path) -> None:
    missing = []
    for spec in SPECS:
        for number in spec.video_numbers:
            path = video_dir / f"IMG_{number}.MOV"
            if not path.is_file():
                missing.append(str(path))
    if missing:
        raise FileNotFoundError("缺少视频文件：\n" + "\n".join(missing))


def prepare_output_dir(output_dir: Path, force: bool) -> None:
    if output_dir.exists():
        if not force:
            raise FileExistsError(
                f"输出目录已存在：{output_dir}。确认需要重建时使用 --force。"
            )
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)


def make_signature(frame: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    return cv2.resize(gray, (64, 36), interpolation=cv2.INTER_AREA)


def calculate_blur(frame: np.ndarray) -> float:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    reduced = cv2.resize(gray, (640, 360), interpolation=cv2.INTER_AREA)
    return float(cv2.Laplacian(reduced, cv2.CV_64F).var())


def resize_frame(frame: np.ndarray, width: int, height: int) -> np.ndarray:
    source_height, source_width = frame.shape[:2]
    target_ratio = width / height
    source_ratio = source_width / source_height

    if source_ratio > target_ratio:
        crop_width = round(source_height * target_ratio)
        left = (source_width - crop_width) // 2
        frame = frame[:, left : left + crop_width]
    elif source_ratio < target_ratio:
        crop_height = round(source_width / target_ratio)
        top = (source_height - crop_height) // 2
        frame = frame[top : top + crop_height, :]

    return cv2.resize(frame, (width, height), interpolation=cv2.INTER_AREA)


def extract_dataset(
    spec: DatasetSpec,
    video_dir: Path,
    output_dir: Path,
    width: int,
    height: int,
    jpeg_quality: int,
    min_blur_score: float,
    min_difference: float,
) -> list[FrameRecord]:
    dataset_dir = output_dir / spec.name
    images_dir = dataset_dir / "images" / "all"
    images_dir.mkdir(parents=True)
    records: list[FrameRecord] = []

    for video_number in spec.video_numbers:
        video_path = video_dir / f"IMG_{video_number}.MOV"
        capture = cv2.VideoCapture(str(video_path))
        if not capture.isOpened():
            raise RuntimeError(f"无法打开视频：{video_path}")

        fps = float(capture.get(cv2.CAP_PROP_FPS))
        frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
        source_width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        source_height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if fps <= 0 or frame_count <= 0:
            capture.release()
            raise RuntimeError(f"视频元数据异常：{video_path}")

        sample_step = max(1, round(fps * spec.interval_seconds))
        sample_indexes = list(range(sample_step // 2, frame_count, sample_step))
        previous_signature: np.ndarray | None = None

        for frame_index in sample_indexes:
            capture.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
            ok, frame = capture.read()
            if not ok or frame is None:
                records.append(
                    FrameRecord(
                        dataset=spec.name,
                        image_name="",
                        source_video=video_path.name,
                        source_video_number=video_number,
                        frame_index=frame_index,
                        timestamp_seconds=round(frame_index / fps, 3),
                        source_fps=round(fps, 3),
                        source_width=source_width,
                        source_height=source_height,
                        output_width=width,
                        output_height=height,
                        blur_score=0.0,
                        difference_score=None,
                        status="rejected",
                        reason="decode_failed",
                    )
                )
                continue

            output_frame = resize_frame(frame, width, height)
            blur_score = calculate_blur(output_frame)
            signature = make_signature(output_frame)
            difference_score = (
                float(
                    np.mean(
                        cv2.absdiff(signature, previous_signature).astype(np.float32)
                    )
                )
                if previous_signature is not None
                else None
            )

            reason = ""
            status = "accepted"
            if blur_score < min_blur_score:
                status = "rejected"
                reason = "blur"
            elif difference_score is not None and difference_score < min_difference:
                status = "rejected"
                reason = "near_duplicate"

            image_name = ""
            if status == "accepted":
                timestamp_ms = round(frame_index / fps * 1000)
                image_name = (
                    f"{spec.name}_v{video_number}_f{frame_index:06d}"
                    f"_t{timestamp_ms:06d}ms.jpg"
                )
                image_path = images_dir / image_name
                saved = cv2.imwrite(
                    str(image_path),
                    output_frame,
                    [cv2.IMWRITE_JPEG_QUALITY, jpeg_quality],
                )
                if not saved:
                    capture.release()
                    raise RuntimeError(f"图片保存失败：{image_path}")
                previous_signature = signature

            records.append(
                FrameRecord(
                    dataset=spec.name,
                    image_name=image_name,
                    source_video=video_path.name,
                    source_video_number=video_number,
                    frame_index=frame_index,
                    timestamp_seconds=round(frame_index / fps, 3),
                    source_fps=round(fps, 3),
                    source_width=source_width,
                    source_height=source_height,
                    output_width=width,
                    output_height=height,
                    blur_score=round(blur_score, 3),
                    difference_score=(
                        round(difference_score, 3)
                        if difference_score is not None
                        else None
                    ),
                    status=status,
                    reason=reason,
                )
            )

        capture.release()

    write_dataset_files(dataset_dir, spec, records)
    return records


def write_dataset_files(
    dataset_dir: Path,
    spec: DatasetSpec,
    records: list[FrameRecord],
) -> None:
    accepted = [record for record in records if record.status == "accepted"]

    with (dataset_dir / "manifest.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=asdict(records[0]).keys())
        writer.writeheader()
        writer.writerows(asdict(record) for record in records)

    class_config = {
        "dataset": spec.name,
        "task": "detect",
        "classes": {index: name for index, name in enumerate(spec.classes)},
        "description": spec.description,
    }
    (dataset_dir / "classes.json").write_text(
        json.dumps(class_config, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    lines = [
        f"# {spec.name} 待标注数据集",
        "",
        spec.description,
        "",
        "## 标注规则",
        "",
        "- 使用矩形框，不使用多边形。",
        "- 框选完整可见人员；被桌面遮挡时框选可见人体区域。",
        "- 严重遮挡且无法判断类别的人员不标注。",
        "- 不要改变类别名称和编号。",
        "",
        "## 类别",
        "",
    ]
    lines.extend(f"- `{index}`: `{name}`" for index, name in enumerate(spec.classes))
    if spec.name == "sleeping":
        lines.extend(
            [
                "",
                "正常坐姿、低头、扶额、清醒脸部特写等图片保留为负样本，",
                "但不要画 `sleep` 框。",
            ]
        )
    else:
        lines.extend(
            [
                "",
                "穿指定蓝色工作服标记为 `workwear`；未穿指定蓝色工作服标记为",
                "`no_workwear`。蓝色普通衣服不应自动视为指定工作服。",
            ]
        )
    (dataset_dir / "ANNOTATION_GUIDE.md").write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )

    counts_by_video: dict[str, int] = {}
    for record in accepted:
        counts_by_video[record.source_video] = (
            counts_by_video.get(record.source_video, 0) + 1
        )
    summary = {
        "dataset": spec.name,
        "sample_interval_seconds": spec.interval_seconds,
        "accepted_images": len(accepted),
        "rejected_samples": len(records) - len(accepted),
        "counts_by_video": counts_by_video,
    }
    (dataset_dir / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def create_zip(dataset_dir: Path) -> Path:
    zip_path = dataset_dir.parent / f"{dataset_dir.name}_images_for_annotation.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for image_path in sorted((dataset_dir / "images" / "all").glob("*.jpg")):
            archive.write(image_path, arcname=image_path.name)
    return zip_path


def create_contact_sheet(dataset_dir: Path, columns: int = 5) -> Path:
    image_paths = sorted((dataset_dir / "images" / "all").glob("*.jpg"))
    if not image_paths:
        raise RuntimeError(f"没有可生成预览的图片：{dataset_dir}")

    preview_count = min(30, len(image_paths))
    indexes = np.linspace(0, len(image_paths) - 1, preview_count, dtype=int)
    thumb_width, thumb_height = 320, 180
    rows = math.ceil(preview_count / columns)
    sheet = np.full(
        (rows * thumb_height, columns * thumb_width, 3),
        245,
        dtype=np.uint8,
    )
    for position, index in enumerate(indexes):
        image = cv2.imread(str(image_paths[index]))
        thumbnail = cv2.resize(
            image,
            (thumb_width, thumb_height),
            interpolation=cv2.INTER_AREA,
        )
        row, column = divmod(position, columns)
        sheet[
            row * thumb_height : (row + 1) * thumb_height,
            column * thumb_width : (column + 1) * thumb_width,
        ] = thumbnail

    preview_path = dataset_dir / "contact_sheet.jpg"
    cv2.imwrite(str(preview_path), sheet, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return preview_path


def write_root_report(
    output_dir: Path,
    all_records: dict[str, list[FrameRecord]],
    zip_paths: dict[str, Path],
) -> None:
    lines = [
        "# 数据集准备报告",
        "",
        "本目录是待人工标注数据，不包含自动生成的最终标签，也尚未划分",
        "`train/val/test`。完成标注后应按来源视频分组划分，避免相邻帧泄漏。",
        "",
        "| 数据集 | 保留图片 | 剔除采样 | 标注 ZIP |",
        "|---|---:|---:|---|",
    ]
    for spec in SPECS:
        records = all_records[spec.name]
        accepted = sum(record.status == "accepted" for record in records)
        rejected = len(records) - accepted
        lines.append(
            f"| {spec.name} | {accepted} | {rejected} | "
            f"`{zip_paths[spec.name].name}` |"
        )

    lines.extend(
        [
            "",
            "## 下一步",
            "",
            "1. 将对应 ZIP 导入 EasyAlot 数据集。",
            "2. 使用旧模型进行 AI 预标注。",
            "3. 人工逐张删除误报、补充漏报并修正类别。",
            "4. 导出 YOLO Detection 数据集。",
            "5. 按来源视频检查 train/val/test，之后再开始训练。",
        ]
    )
    (output_dir / "REPORT.md").write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    args = parse_args()
    validate_inputs(args.video_dir)
    prepare_output_dir(args.output_dir, args.force)

    all_records: dict[str, list[FrameRecord]] = {}
    zip_paths: dict[str, Path] = {}
    for spec in SPECS:
        records = extract_dataset(
            spec=spec,
            video_dir=args.video_dir,
            output_dir=args.output_dir,
            width=args.width,
            height=args.height,
            jpeg_quality=args.jpeg_quality,
            min_blur_score=args.min_blur_score,
            min_difference=args.min_difference,
        )
        all_records[spec.name] = records
        dataset_dir = args.output_dir / spec.name
        create_contact_sheet(dataset_dir)
        zip_paths[spec.name] = create_zip(dataset_dir)

    write_root_report(args.output_dir, all_records, zip_paths)
    print(f"数据集已生成：{args.output_dir.resolve()}")
    for spec in SPECS:
        accepted = sum(
            record.status == "accepted" for record in all_records[spec.name]
        )
        print(f"- {spec.name}: {accepted} 张")


if __name__ == "__main__":
    main()
