import argparse
import json
from pathlib import Path

import cv2

from .detector import BehaviorDetector
from .events import EventTracker


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _parse_source(value: str):
    return int(value) if value.isdigit() else value


def _run_image(detector: BehaviorDetector, source: str, output: Path) -> None:
    detections, annotated = detector.detect_file(source)
    output.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output), annotated)
    print(json.dumps({"source": source, "detections": detections}, ensure_ascii=False))


def _run_stream(
    detector: BehaviorDetector,
    source: str,
    output: Path | None,
    min_frames: int,
    cooldown: float,
) -> None:
    capture = cv2.VideoCapture(_parse_source(source))
    if not capture.isOpened():
        raise RuntimeError(f"无法打开视频源: {source}")

    writer = None
    tracker = EventTracker(min_frames=min_frames, cooldown_seconds=cooldown)
    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if output:
        output.parent.mkdir(parents=True, exist_ok=True)
        writer = cv2.VideoWriter(
            str(output),
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height),
        )

    frame_index = 0
    try:
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            detections = detector.detect(frame)
            events = tracker.update(detections)
            if detections or events:
                print(
                    json.dumps(
                        {
                            "frame": frame_index,
                            "detections": detections,
                            "events": events,
                        },
                        ensure_ascii=False,
                    )
                )
            if writer:
                writer.write(detector.draw(frame, detections))
            frame_index += 1
    finally:
        capture.release()
        if writer:
            writer.release()


def main() -> None:
    parser = argparse.ArgumentParser(description="工作服、抽烟、睡觉轻量检测")
    parser.add_argument("source", help="图片、视频、RTSP 地址或摄像头编号")
    parser.add_argument("-o", "--output", help="标注后的图片或视频路径")
    parser.add_argument(
        "--models",
        nargs="+",
        choices=("uniform", "workwear", "smoking", "sleeping"),
        default=("workwear", "smoking", "sleeping"),
    )
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--device", help="如 cpu、mps、0")
    parser.add_argument("--min-frames", type=int, default=3)
    parser.add_argument("--cooldown", type=float, default=10.0)
    args = parser.parse_args()

    detector = BehaviorDetector(
        enabled=args.models,
        confidence=args.confidence,
        device=args.device,
    )
    source_path = Path(args.source)
    if source_path.suffix.lower() in IMAGE_SUFFIXES:
        output = Path(args.output or f"outputs/{source_path.stem}_result.jpg")
        _run_image(detector, args.source, output)
    else:
        output = Path(args.output) if args.output else None
        _run_stream(detector, args.source, output, args.min_frames, args.cooldown)


if __name__ == "__main__":
    main()
