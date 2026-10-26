"""模型训练路由"""

from fastapi import APIRouter, HTTPException, Request

from backend.training_service import training_manager

router = APIRouter(prefix="/api/training", tags=["training"])


def _get_state():
    from backend.main import state
    return state


@router.get("/targets")
async def get_training_targets(request: Request):
    from backend.main import _require_user
    _require_user(request)
    return {"code": 200, "data": training_manager.list_targets()}


@router.get("/jobs")
async def get_training_jobs(request: Request):
    from backend.main import _require_user
    _require_user(request)
    return {"code": 200, "data": training_manager.list_jobs()}


@router.post("/jobs")
async def start_training_job(request: Request):
    from backend.main import _require_user
    _require_user(request)
    try:
        payload = await request.json()
        job = training_manager.start_job(payload)
        return {"code": 200, "message": "训练任务已启动", "data": job.id}
    except ValueError as exc:
        return {"code": 400, "message": str(exc)}
    except Exception as exc:
        return {"code": 500, "message": f"启动训练失败: {exc}"}


@router.get("/jobs/{job_id}")
async def get_training_job(job_id: str, request: Request):
    from backend.main import _require_user
    _require_user(request)
    job = training_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="训练任务不存在")
    return {"code": 200, "data": training_manager._job_response(job)}


@router.post("/jobs/{job_id}/stop")
async def stop_training_job(job_id: str, request: Request):
    from backend.main import _require_user
    _require_user(request)
    try:
        job = training_manager.stop_job(job_id)
        return {"code": 200, "message": "已请求停止训练", "data": training_manager._job_response(job)}
    except ValueError as exc:
        return {"code": 404, "message": str(exc)}
