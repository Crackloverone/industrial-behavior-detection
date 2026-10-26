"""AI 检测路由"""

import asyncio
import base64

import cv2
import numpy as np
from fastapi import APIRouter, Request

router = APIRouter(tags=["detect"])


def _get_state():
    from backend.main import state
    return state


def _bbox_iou(bbox1, bbox2):
    """计算两个 bbox 的 IOU"""
    if not bbox1 or not bbox2 or len(bbox1) != 4 or len(bbox2) != 4:
        return 0.0
    x1_min, y1_min, x1_max, y1_max = bbox1
    x2_min, y2_min, x2_max, y2_max = bbox2
    inter_xmin = max(x1_min, x2_min)
    inter_ymin = max(y1_min, y2_min)
    inter_xmax = min(x1_max, x2_max)
    inter_ymax = min(y1_max, y2_max)
    inter_area = max(0, inter_xmax - inter_xmin) * max(0, inter_ymax - inter_ymin)
    bbox1_area = (x1_max - x1_min) * (y1_max - y1_min)
    bbox2_area = (x2_max - x2_min) * (y2_max - y2_min)
    union_area = bbox1_area + bbox2_area - inter_area
    return inter_area / union_area if union_area > 0 else 0.0


@router.post("/api/detect")
async def detect_objects(data: dict, request: Request):
    """目标检测 API"""
    from backend.main import _require_user, _recognize_employee_from_image
    _require_user(request)
    
    s = _get_state()
    try:
        image_data = data.get('image', '')
        if not image_data:
            return {"code": 400, "message": "缺少图像数据"}
        
        try:
            if image_data.startswith("data:image"):
                image_data = image_data.split(",", 1)[-1]
            img_bytes = base64.b64decode(image_data)
            nparr = np.frombuffer(img_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if image is None:
                return {"code": 400, "message": "图像解码失败"}
        except Exception as e:
            return {"code": 400, "message": f"图像解析失败: {str(e)}"}
        
        camera_id = data.get('camera_id')
        camera_name = data.get('camera_name', '未知摄像头')
        location = data.get('location', '')

        def _run_detect():
            detections = []
            violations = []
            alarm_triggered = False
            alarm_id = None

            if s.detector and s.detector.is_loaded():
                results = s.detector.detect(image)

                for det in results:
                    class_name = det.get('class_name', '')
                    detections.append({
                        'class_id': det.get('class_id'),
                        'class_name': class_name,
                        'confidence': float(det.get('confidence', 0)),
                        'bbox': det.get('bbox', []),
                        'track_id': det.get('track_id')
                    })

                    if class_name == 'person':
                        person_bbox = det.get('bbox', [])
                        has_helmet = any(d.get('class_name') == 'helmet' and _bbox_iou(person_bbox, d.get('bbox', [])) > 0.3 for d in results)
                        has_vest = any(d.get('class_name') == 'safety_vest' and _bbox_iou(person_bbox, d.get('bbox', [])) > 0.3 for d in results)
                        has_workwear = any(d.get('class_name') == 'workwear' and _bbox_iou(person_bbox, d.get('bbox', [])) > 0.3 for d in results)

                        if not has_helmet or not has_vest or not has_workwear:
                            person_track_id = det.get('track_id')
                            if not has_helmet:
                                violations.append({'person_bbox': person_bbox, 'person_track_id': person_track_id, 'violation_type': 'no_helmet'})
                            if not has_vest:
                                violations.append({'person_bbox': person_bbox, 'person_track_id': person_track_id, 'violation_type': 'no_vest'})
                            if not has_workwear:
                                violations.append({'person_bbox': person_bbox, 'person_track_id': person_track_id, 'violation_type': 'no_workwear'})

                if violations and s.alarm_manager and s.database:
                    alarm_type = violations[0]['violation_type']
                    person_track_id = violations[0].get('person_track_id')

                    employee_id = None
                    employee_name = None
                    similarity = None

                    if s.face_recognizer and len(violations) > 0:
                        emp_id, emp_number, emp_name, sim = _recognize_employee_from_image(image, violations[0])
                        if emp_id:
                            employee_id = emp_id
                            employee_name = emp_name
                            similarity = sim
                            print(f"[检测] 人脸识别成功: 员工 {employee_name} (工号 {emp_number}), 置信度 {similarity}%")
                        else:
                            print("[检测] 人脸识别未匹配到在职员工")

                    is_suppressed = not s.alarm_manager.record_violation(alarm_type, camera_id, employee_id, person_track_id)
                    if is_suppressed:
                        emp_info = f"员工 {employee_name}" if employee_name else (f"追踪ID {person_track_id}" if person_track_id else f"摄像头 {camera_id}")
                        print(f"[检测] {emp_info} 违规类型 {alarm_type} 已连续触发3次以上，临时屏蔽")

                    if s.alarm_manager.should_alarm(alarm_type, camera_id, employee_id, person_track_id):
                        from pathlib import Path
                        import time as _time
                        image_path = ""
                        ok, enc = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
                        if ok:
                            alarm_img_dir = Path("data/alarm_images")
                            alarm_img_dir.mkdir(parents=True, exist_ok=True)
                            img_file = alarm_img_dir / f"alarm_{camera_id or 0}_{int(_time.time() * 1000)}.jpg"
                            img_file.write_bytes(enc.tobytes())
                            image_path = str(img_file)

                        alarm_id = s.database.add_alarm({
                            'camera_id': camera_id, 'camera_name': camera_name, 'location': location,
                            'alarm_type': alarm_type, 'violation_type': alarm_type, 'image_path': image_path,
                            'employee_id': employee_id, 'employee_name': employee_name,
                            'person_track_id': person_track_id, 'face_similarity': similarity,
                        })
                        from backend.routers.alarms import _clear_alarm_related_cache
                        _clear_alarm_related_cache()

                        s.alarm_manager.trigger_alarm(
                            alarm_type=alarm_type, camera_id=camera_id, camera_name=camera_name,
                            image=image, violations=violations
                        )
                        alarm_triggered = True
                        emp_msg = f",员工: {employee_name}" if employee_name else ""
                        print(f"触发报警: {alarm_type} at {camera_name}{emp_msg}")

            return detections, violations, alarm_triggered, alarm_id

        detections, violations, alarm_triggered, alarm_id = await asyncio.to_thread(_run_detect)

        behavior_events = []
        if s.behavior_service and s.behavior_service.loaded:
            behavior_result = await asyncio.to_thread(s.behavior_service.detect, image, camera_id)
            detections.extend(behavior_result["detections"])
            violations.extend(behavior_result["violations"])
            behavior_events = behavior_result["events"]

            if behavior_events and s.database:
                event = behavior_events[0]
                event_violation = event["violation_type"]
                recognition_source = next(
                    (item for item in behavior_result["violations"] if item.get("violation_type") == event_violation),
                    event,
                )
                emp_id, emp_number, emp_name, similarity = _recognize_employee_from_image(image, recognition_source)
                
                # 保存图片到文件
                beh_image_path = ""
                ok, enc = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
                if ok:
                    alarm_img_dir = Path("data/alarm_images")
                    alarm_img_dir.mkdir(parents=True, exist_ok=True)
                    img_file = alarm_img_dir / f"alarm_{camera_id or 0}_{int(_time.time() * 1000)}.jpg"
                    img_file.write_bytes(enc.tobytes())
                    beh_image_path = str(img_file)
                
                alarm_id = s.database.add_alarm({
                    "camera_id": camera_id or 0, "camera_name": camera_name, "location": location,
                    "alarm_type": "behavior", "violation_type": event_violation, "image_path": beh_image_path,
                    "employee_id": emp_id, "employee_name": emp_name or "", "face_similarity": similarity,
                })
                from backend.routers.alarms import _clear_alarm_related_cache
                _clear_alarm_related_cache()
                alarm_triggered = True
        
        return {
            "code": 200,
            "data": {
                "detections": detections, "violations": violations,
                "alarm_triggered": alarm_triggered, "alarm_id": alarm_id,
                "behavior_events": behavior_events,
                "image_width": image.shape[1], "image_height": image.shape[0]
            }
        }
    except Exception as e:
        print(f"检测失败: {e}")
        return {"code": 500, "message": str(e)}


@router.get("/api/behavior/info")
async def get_behavior_info():
    if not _get_state().behavior_service:
        return {"code": 503, "message": "行为检测服务未初始化"}
    return {"code": 200, "data": _get_state().behavior_service.status()}
