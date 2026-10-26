import sqlite3

from backend.database import Database


def test_alarm_queries_return_employee_fields(tmp_path):
    db = Database(db_path=str(tmp_path / "ppe_monitor.db"))

    alarm_id = db.add_alarm(
        {
            "camera_id": 1,
            "camera_name": "入口摄像头",
            "violation_type": "no_workwear",
            "alarm_type": "stream",
            "location": "车间入口",
            "employee_id": 7,
            "employee_name": "张三",
            "person_track_id": 42,
            "face_similarity": 73.4,
            "video_path": "data/alarm_videos/test.mp4",
        }
    )

    alarm = db.get_alarm(alarm_id)
    alarms = db.get_alarms()
    stats = db.get_stats(days=1)

    assert alarm["employee_id"] == 7
    assert alarm["employee_name"] == "张三"
    assert alarm["person_track_id"] == 42
    assert alarm["face_similarity"] == 73.4
    assert alarm["video_path"] == "data/alarm_videos/test.mp4"
    assert alarm["employee_number"] == ""
    assert alarm["employee_photo_available"] == 0
    assert alarms[0]["employee_id"] == 7
    assert stats["recent_alarms"][0]["employee_name"] == "张三"

    db.close()


def test_alarm_queries_join_employee_profile(tmp_path):
    db = Database(db_path=str(tmp_path / "ppe_monitor.db"))
    employee_id = db.add_employee(
        {
            "name": "员工30",
            "employee_number": "EMP030",
            "department": "生产部",
            "position": "操作员",
            "photo_path": "data/face_database/EMP030.jpg",
        }
    )
    alarm_id = db.add_alarm(
        {
            "camera_id": 1,
            "violation_type": "sleeping",
            "employee_id": employee_id,
            "employee_name": "员工30",
            "face_similarity": 68.25,
        }
    )

    alarm = db.get_alarm(alarm_id)

    assert alarm["employee_name"] == "员工30"
    assert alarm["employee_number"] == "EMP030"
    assert alarm["employee_department"] == "生产部"
    assert alarm["employee_position"] == "操作员"
    assert alarm["employee_photo_available"] == 1
    assert alarm["face_similarity"] == 68.25
    db.close()


def test_existing_alarm_database_is_migrated_with_face_similarity(tmp_path):
    db_path = tmp_path / "legacy.db"
    connection = sqlite3.connect(db_path)
    connection.execute(
        """
        CREATE TABLE alarms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            camera_id INTEGER NOT NULL,
            violation_type TEXT NOT NULL
        )
        """
    )
    connection.commit()
    connection.close()

    db = Database(db_path=str(db_path))
    columns = {
        row[1] for row in db._connection.execute("PRAGMA table_info(alarms)").fetchall()
    }

    assert "face_similarity" in columns
    assert "video_path" in columns
    assert "handled_by" in columns
    db.close()


def test_alarm_handling_records_audit_fields(tmp_path):
    db = Database(db_path=str(tmp_path / "ppe_monitor.db"))
    alarm_id = db.add_alarm({"camera_id": 1, "violation_type": "smoking"})

    db.handle_alarm(alarm_id, 9, "admin", "confirmed", "已现场处理")
    alarm = db.get_alarm(alarm_id)

    assert alarm["handled"] == 1
    assert alarm["handled_by"] == 9
    assert alarm["handled_by_name"] == "admin"
    assert alarm["handle_result"] == "confirmed"
    assert alarm["handle_note"] == "已现场处理"
    assert alarm["handled_at"] is not None
    db.close()


def test_legacy_operator_admin_is_promoted(tmp_path):
    db = Database(db_path=str(tmp_path / "ppe_monitor.db"))
    db.create_user("admin", "secret", "operator")

    db.ensure_admin_user("admin", "unused")

    assert db.get_user_by_username("admin")["role"] == "admin"
    db.close()
