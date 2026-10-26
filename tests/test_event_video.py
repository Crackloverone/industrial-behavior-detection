import cv2
import numpy as np

from backend.stream_manager import VideoStream


def test_event_video_contains_four_seconds_and_invokes_alarm(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr("backend.stream_manager.time.sleep", lambda _seconds: None)
    callback_data = {}

    def alarm_callback(**kwargs):
        callback_data.update(kwargs)

    stream = VideoStream(3, "usb://0", "车间", alarm_callback=alarm_callback)
    event_at = 100.0
    frame = np.zeros((120, 160, 3), dtype=np.uint8)
    for index in range(40):
        sample = frame.copy()
        sample[:, :, 1] = index * 5
        ok, encoded = cv2.imencode(".jpg", sample)
        assert ok
        stream._event_buffer.append((event_at - 2.0 + index * 0.1, encoded.tobytes()))

    stream._complete_event_recording(
        [{"violation_type": "sleeping"}], frame, event_at
    )

    video_path = tmp_path / callback_data["video_path"]
    assert video_path.exists()
    capture = cv2.VideoCapture(str(video_path))
    assert int(capture.get(cv2.CAP_PROP_FRAME_COUNT)) >= 39
    assert round(capture.get(cv2.CAP_PROP_FPS)) == 10
    capture.release()
    assert callback_data["location"] == "车间"
