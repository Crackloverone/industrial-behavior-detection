"""系统配置路由"""

from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/config", tags=["config"])


def _get_state():
    from backend.main import state
    return state


@router.get("")
async def get_config():
    """获取系统配置"""
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    config_keys = [
        'alarm_cooldown', 'detect_interval', 'stream_quality',
        'conf_threshold', 'iou_threshold', 'min_face_size',
        'face_rec_threshold', 'max_tracks',
        'data_retention_days', 'audit_log_enabled',
        'alarm_image_path', 'alarm_video_path', 'face_db_path',
        'report_schedule', 'dashboard_layout', 'email_notify',
        'ppe_model', 'face_model', 'sleep_model', 'workwear_model',
        'sound_enabled', 'light_enabled',
    ]
    config_data = {}
    
    defaults = {
        'alarm_cooldown': 3, 'detect_interval': 3000, 'stream_quality': 40,
        'conf_threshold': 0.5, 'iou_threshold': 0.45, 'min_face_size': 30,
        'face_rec_threshold': 0.3, 'max_tracks': 30,
        'data_retention_days': 90, 'audit_log_enabled': True,
        'alarm_image_path': 'data/alarm_images/', 'alarm_video_path': 'data/alarm_videos/',
        'face_db_path': 'data/face_database/',
        'report_schedule': 'daily', 'dashboard_layout': 'grid', 'email_notify': False,
        'ppe_model': 'yolov8n', 'face_model': 'sface',
        'sleep_model': 'sleeping', 'workwear_model': 'workwear',
        'sound_enabled': True, 'light_enabled': True,
    }
    
    for key in config_keys:
        value = db.get_config(key)
        if value is not None:
            if key in ['alarm_cooldown', 'detect_interval', 'stream_quality', 'data_retention_days', 'min_face_size', 'max_tracks']:
                config_data[key] = int(value)
            elif key in ['conf_threshold', 'iou_threshold', 'face_rec_threshold']:
                config_data[key] = float(value)
            elif key in ['audit_log_enabled', 'email_notify', 'sound_enabled', 'light_enabled']:
                config_data[key] = value.lower() == 'true'
            else:
                config_data[key] = value
        else:
            config_data[key] = defaults.get(key)
    
    return {"code": 200, "data": config_data}


@router.post("")
async def save_config(request: Request):
    """保存系统配置"""
    from backend.main import _require_user
    _require_user(request)
    db = _get_state().database
    if not db:
        return {"code": 500, "message": "数据库未连接"}
    
    try:
        data = await request.json()
    except Exception:
        return {"code": 400, "message": "无效的请求数据"}
    
    for key, value in data.items():
        if isinstance(value, bool):
            str_value = 'true' if value else 'false'
        else:
            str_value = str(value)
        db.set_config(key, str_value)
    
    db.log_audit(
        action="config_change",
        detail=f"更新配置: {', '.join(data.keys())}",
        ip=request.client.host if request.client else "",
    )
    
    from backend.main import apply_config
    apply_config()
    
    return {"code": 200, "message": "配置已保存"}
