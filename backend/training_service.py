from __future__ import annotations

import csv
import json
import os
import platform
import re
import subprocess
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRAIN_SCRIPT = PROJECT_ROOT / "scripts" / "train_yolo_models.py"
JOBS_DIR = PROJECT_ROOT / "runs" / "train_jobs"
TRAIN_RUNS_DIR = PROJECT_ROOT / "runs" / "train"
TRAINED_MODELS_DIR = PROJECT_ROOT / "models" / "trained"
ANSI_RE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


@dataclass
class TrainingJob:
    id: str
    target: str
    status: str
    created_at: str
    updated_at: str
    command: list[str]
    epochs: int
    batch: int
    imgsz: int
    device: str | None = None
    model: str | None = None
    run_dir: str | None = None
    log_path: str | None = None
    pid: int | None = None
    returncode: int | None = None
    error: str | None = None
    metrics: list[dict[str, Any]] = field(default_factory=list)


class TrainingManager:
    def __init__(self) -> None:
        JOBS_DIR.mkdir(parents=True, exist_ok=True)
        TRAIN_RUNS_DIR.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._processes: dict[str, subprocess.Popen] = {}

    def list_targets(self) -> list[dict[str, Any]]:
        return [
            {
                "key": "sleeping",
                "name": "睡岗检测",
                "data_yaml": str(PROJECT_ROOT / "datasets/yolo/sleeping/data.yaml"),
                "default_model": str(PROJECT_ROOT / "behavior-detection-lite/models/sleeping.pt"),
                "auto_deploy": True,
            },
            {
                "key": "workwear",
                "name": "指定蓝色工作服检测",
                "data_yaml": str(PROJECT_ROOT / "datasets/yolo/workwear/data.yaml"),
                "default_model": "yolov8n.pt",
                "auto_deploy": False,
            },
        ]

    def start_job(self, payload: dict[str, Any]) -> TrainingJob:
        target = str(payload.get("target", "")).strip()
        if target not in {"sleeping", "workwear"}:
            raise ValueError("target 只能是 sleeping 或 workwear")
        self._ensure_no_active_job()

        epochs = int(payload.get("epochs", 30))
        batch = int(payload.get("batch", 4))
        imgsz = int(payload.get("imgsz", 640))
        device = str(payload.get("device") or "").strip() or None
        model = str(payload.get("model") or "").strip() or None
        if target == "workwear" and not model:
            model = "yolov8n.pt"

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        job_id = f"{target}_{timestamp}"
        job_dir = JOBS_DIR / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        log_path = job_dir / "train.log"

        command = [
            "uv",
            "run",
            "python",
            str(TRAIN_SCRIPT),
            target,
            "--epochs",
            str(epochs),
            "--batch",
            str(batch),
            "--imgsz",
            str(imgsz),
            "--project",
            str(TRAIN_RUNS_DIR),
            "--name",
            job_id,
        ]
        if device:
            command.extend(["--device", device])
        if model:
            command.extend(["--model", model])

        now = datetime.now().isoformat(timespec="seconds")
        job = TrainingJob(
            id=job_id,
            target=target,
            status="running",
            created_at=now,
            updated_at=now,
            command=command,
            epochs=epochs,
            batch=batch,
            imgsz=imgsz,
            device=device,
            model=model,
            run_dir=str(TRAIN_RUNS_DIR / job_id),
            log_path=str(log_path),
        )
        self._save_job(job)

        log_file = log_path.open("w", encoding="utf-8")
        process = subprocess.Popen(
            command,
            cwd=PROJECT_ROOT,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            text=True,
            start_new_session=True,
        )
        job.pid = process.pid
        self._save_job(job)
        with self._lock:
            self._processes[job.id] = process

        thread = threading.Thread(
            target=self._watch_process,
            args=(job.id, process, log_file),
            daemon=True,
        )
        thread.start()
        return job

    def list_jobs(self) -> list[dict[str, Any]]:
        jobs = [self.get_job(path.stem) for path in JOBS_DIR.glob("*.json")]
        return sorted(
            (self._job_summary(job) for job in jobs if job),
            key=lambda item: item["created_at"],
            reverse=True,
        )

    def get_job(self, job_id: str) -> TrainingJob | None:
        path = self._job_path(job_id)
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        job = TrainingJob(**data)
        job.metrics = self.read_metrics(job)
        self._refresh_runtime_status(job)
        return job

    def stop_job(self, job_id: str) -> TrainingJob:
        job = self.get_job(job_id)
        if not job:
            raise ValueError("训练任务不存在")
        process = self._processes.get(job_id)
        if process and process.poll() is None:
            if platform.system() == "Windows":
                process.terminate()
            else:
                import signal
                os.killpg(process.pid, signal.SIGTERM)
            job.status = "stopping"
            job.updated_at = datetime.now().isoformat(timespec="seconds")
            self._save_job(job)
        return job

    def read_metrics(self, job: TrainingJob) -> list[dict[str, Any]]:
        results_csv = self._results_csv_for(job)
        if not results_csv or not results_csv.is_file():
            return []

        rows: list[dict[str, Any]] = []
        with results_csv.open("r", encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                parsed: dict[str, Any] = {}
                for key, value in row.items():
                    clean_key = key.strip()
                    if value is None or value == "":
                        parsed[clean_key] = None
                        continue
                    try:
                        parsed[clean_key] = float(value)
                    except ValueError:
                        parsed[clean_key] = value
                rows.append(parsed)
        return rows

    def tail_log(self, job: TrainingJob, lines: int = 120) -> list[str]:
        if not job.log_path:
            return []
        path = Path(job.log_path)
        if not path.is_file():
            return []
        text = path.read_text(encoding="utf-8", errors="replace").replace("\r", "\n")
        content = []
        for line in text.splitlines():
            cleaned = ANSI_RE.sub("", line)
            if len(cleaned) > 320:
                cleaned = cleaned[:320] + " ..."
            content.append(cleaned)
        return content[-lines:]

    def _watch_process(self, job_id: str, process: subprocess.Popen, log_file) -> None:
        try:
            returncode = process.wait()
        finally:
            log_file.close()
        job = self.get_job(job_id)
        if not job:
            return
        job.returncode = returncode
        job.updated_at = datetime.now().isoformat(timespec="seconds")
        if not job.run_dir:
            job.run_dir = self._latest_run_dir(job.target, job.created_at)
        job.metrics = self.read_metrics(job)
        if job.status == "stopping":
            job.status = "stopped"
        else:
            job.status = "completed" if returncode == 0 else "failed"
            if returncode != 0:
                job.error = f"训练进程退出码: {returncode}"
        self._save_job(job)
        with self._lock:
            self._processes.pop(job_id, None)

    def _refresh_runtime_status(self, job: TrainingJob) -> None:
        process = self._processes.get(job.id)
        if not process:
            return
        returncode = process.poll()
        if returncode is None:
            job.status = "running"
            job.updated_at = datetime.now().isoformat(timespec="seconds")
        else:
            job.returncode = returncode

    def _ensure_no_active_job(self) -> None:
        active = [
            job
            for job in (self.get_job(path.stem) for path in JOBS_DIR.glob("*.json"))
            if job and job.status in {"running", "stopping"}
        ]
        if active:
            raise ValueError(f"已有训练任务正在运行: {active[0].id}")

    def _job_response(self, job: TrainingJob) -> dict[str, Any]:
        metrics = job.metrics or self.read_metrics(job)
        progress = self._progress(job, metrics)
        return {
            **asdict(job),
            "metrics": metrics,
            "progress": progress,
            "log_tail": self.tail_log(job),
            "best_model": str(TRAINED_MODELS_DIR / job.target / "best.pt"),
        }

    def _job_summary(self, job: TrainingJob) -> dict[str, Any]:
        metrics = job.metrics or self.read_metrics(job)
        latest = metrics[-1] if metrics else {}
        return {
            "id": job.id,
            "target": job.target,
            "status": job.status,
            "created_at": job.created_at,
            "updated_at": job.updated_at,
            "epochs": job.epochs,
            "batch": job.batch,
            "imgsz": job.imgsz,
            "device": job.device,
            "model": job.model,
            "pid": job.pid,
            "returncode": job.returncode,
            "error": job.error,
            "progress": self._progress(job, metrics),
            "latest_epoch": latest.get("epoch"),
            "latest_map50": latest.get("metrics/mAP50(B)"),
            "best_model": str(TRAINED_MODELS_DIR / job.target / "best.pt"),
        }

    @staticmethod
    def _progress(job: TrainingJob, metrics: list[dict[str, Any]]) -> float:
        if job.status == "completed":
            return 1.0
        if metrics and job.epochs:
            return min(1.0, float(metrics[-1].get("epoch", 0)) / job.epochs)
        return 0.0

    def _save_job(self, job: TrainingJob) -> None:
        data = asdict(job)
        data["metrics"] = []
        self._job_path(job.id).write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    @staticmethod
    def _job_path(job_id: str) -> Path:
        return JOBS_DIR / f"{job_id}.json"

    @staticmethod
    def _results_csv_for(job: TrainingJob) -> Path | None:
        if job.run_dir:
            path = Path(job.run_dir) / "results.csv"
            return path if path.is_file() else None
        candidates = sorted(
            TRAIN_RUNS_DIR.glob(f"{job.target}_*/results.csv"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        if not candidates:
            return None
        return candidates[0]

    @staticmethod
    def _latest_run_dir(target: str, created_at: str) -> str | None:
        candidates = sorted(
            (path.parent for path in TRAIN_RUNS_DIR.glob(f"{target}_*/results.csv")),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        return str(candidates[0]) if candidates else None


training_manager = TrainingManager()
