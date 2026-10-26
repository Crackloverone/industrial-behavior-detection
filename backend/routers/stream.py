"""视频流与 WebSocket 路由"""

import asyncio

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse

router = APIRouter(tags=["stream"])


def _get_state():
    from backend.main import state
    return state


@router.get("/api/stream/{camera_id}")
async def get_stream_info(camera_id: int):
    """获取流信息"""
    stream_info = _get_state().stream_manager.get_stream_info(camera_id) if _get_state().stream_manager else None
    if not stream_info:
        return {"code": 404, "message": "流不存在"}
    return {"code": 200, "data": stream_info}


@router.post("/api/stream/{camera_id}/start")
async def start_stream(camera_id: int, request: Request):
    """启动流"""
    from backend.main import _require_user
    _require_user(request)
    sm = _get_state().stream_manager
    if not sm.has_stream(camera_id):
        camera = _get_state().database.get_camera(camera_id) if _get_state().database else None
        if not camera:
            return {"code": 404, "message": "摄像头不存在"}
        sm.add_stream(camera_id, camera["rtsp_url"], camera.get("location", ""))

    ppe_detector = _get_state().detector if _get_state().detector and _get_state().detector.is_loaded() else None
    success = await asyncio.to_thread(sm.start_stream, camera_id, ppe_detector, _get_state().tracker, _get_state().behavior_service)
    
    if not success:
        return {"code": 500, "message": "启动失败"}
    if _get_state().database:
        _get_state().database.update_camera(camera_id, {"status": "online"})
    return {"code": 200}


@router.post("/api/stream/{camera_id}/stop")
async def stop_stream(camera_id: int, request: Request):
    """停止流"""
    from backend.main import _require_user
    _require_user(request)
    _get_state().stream_manager.stop_stream(camera_id)
    if _get_state().database:
        _get_state().database.update_camera(camera_id, {"status": "offline"})
    return {"code": 200}


@router.get("/api/stream/{camera_id}/mjpeg")
async def stream_mjpeg(camera_id: int, request: Request):
    """以 MJPEG 输出后端管理的视频流"""
    from backend.main import _require_user
    _require_user(request)
    sm = _get_state().stream_manager
    if not sm.has_stream(camera_id):
        raise HTTPException(status_code=404, detail="流不存在")

    ppe_detector = _get_state().detector if _get_state().detector and _get_state().detector.is_loaded() else None
    if not sm.start_stream(camera_id, ppe_detector, _get_state().tracker, _get_state().behavior_service):
        raise HTTPException(status_code=503, detail="视频流启动失败")

    async def generate():
        while True:
            frame = sm.get_result_frame(camera_id)
            if frame:
                yield (b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + frame + b"\r\n")
            await asyncio.sleep(0.05)

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.websocket("/ws/video/{camera_id}")
async def websocket_video(websocket: WebSocket, camera_id: int):
    """实时视频 WebSocket"""
    await websocket.accept()
    sm = _get_state().stream_manager

    if not sm.has_stream(camera_id):
        await websocket.send_json({"error": "流不存在"})
        await websocket.close()
        return

    sm.add_client(camera_id, websocket)
    detecting = [False]

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
            elif data == "start":
                await websocket.send_json({"status": "streaming"})
            elif data == "start_detect":
                detecting[0] = True
                await websocket.send_json({"status": "detecting", "detecting": True})
            elif data == "stop_detect":
                detecting[0] = False
                await websocket.send_json({"status": "stopped", "detecting": False})
    except WebSocketDisconnect:
        pass
    finally:
        sm.remove_client(camera_id, websocket)


@router.websocket("/ws/alarms")
async def websocket_alarms(websocket: WebSocket):
    """报警推送 WebSocket"""
    await websocket.accept()
    am = _get_state().alarm_manager
    if am:
        am.subscribe(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        if am:
            am.unsubscribe(websocket)
