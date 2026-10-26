"""模型管理路由"""

from pathlib import Path

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/model", tags=["model"])


def _get_state():
    from backend.main import state
    return state


@router.post("/upload")
async def upload_model(request: Request):
    """上传检测模型"""
    try:
        form = await request.form()
        model_file = form.get('model') or form.get('file')
        
        if not model_file:
            return {"code": 400, "message": "未选择模型文件"}
        
        model_dir = Path("models")
        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_dir / "ppe_detector.onnx"
        
        with open(model_path, 'wb') as f:
            f.write(model_file.read())
        
        try:
            from backend.detector import create_detector
            _get_state().detector = create_detector()
            if _get_state().detector and _get_state().detector.is_loaded():
                print(f"[API] 模型加载成功: {model_path}")
                return {"code": 200, "message": "模型上传成功"}
            else:
                return {"code": 200, "message": "模型上传成功但加载失败，请重启服务"}
        except Exception as e:
            return {"code": 200, "message": f"模型上传成功，重载失败: {str(e)}"}
    except Exception as e:
        print(f"[API] 模型上传失败: {e}")
        return {"code": 500, "message": f"上传失败: {str(e)}"}


@router.post("/config")
async def save_model_config(request: Request):
    """保存模型配置"""
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    conf_threshold = data.get('conf_threshold', 0.5)
    iou_threshold = data.get('iou_threshold', 0.45)
    
    if _get_state().detector:
        _get_state().detector.conf_threshold = conf_threshold
        _get_state().detector.iou_threshold = iou_threshold
    
    if _get_state().database:
        _get_state().database.set_config('conf_threshold', str(conf_threshold))
        _get_state().database.set_config('iou_threshold', str(iou_threshold))
    
    print(f"[API] 模型配置已保存: conf={conf_threshold}, iou={iou_threshold}")
    return {"code": 200, "message": "配置已保存"}


@router.get("/info")
async def get_model_info():
    """返回行为检测模型状态"""
    bs = _get_state().behavior_service
    behavior_status = bs.status() if bs else {"loaded": False, "models": [], "error": "服务未初始化"}
    behavior_loaded = bool(behavior_status["loaded"])

    return {"code": 200, "data": {
        "name": "工业视觉行为检测",
        "classes": ["person", "workwear", "no_workwear", "smoking", "sleep"],
        "size": "--",
        "loaded": behavior_loaded,
        "behavior_loaded": behavior_loaded,
        "behavior_models": behavior_status["models"],
        "message": "行为检测模型已加载" if behavior_loaded else "没有可用的检测模型",
    }}
