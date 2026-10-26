"""
数据库模块
使用 SQLite (可替换为 MySQL)
"""

import sqlite3
import time
import threading
from typing import List, Dict, Optional
from pathlib import Path
import json

from passlib.hash import pbkdf2_sha256


class Database:
    """数据库"""
    
    def __init__(
        self,
        db_path: str = "data/ppe_monitor.db",
        host: str = "localhost",
        port: int = 3306,
        username: str = "root",
        password: str = "",
        database: str = "ppe_monitor"
    ):
        """
        初始化数据库
        
        Args:
            db_path: SQLite 数据库路径
            host: MySQL 主机
            port: MySQL 端口
            username: 用户名
            password: 密码
            database: 数据库名
        """
        self.db_path = db_path
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.database = database
        
        self._connection = None
        self._lock = threading.Lock()
        
        # 初始化
        self._init_database()
    
    def _init_database(self):
        """初始化数据库"""
        db_file = Path(self.db_path)
        if not db_file.parent.exists():
            db_file.parent.mkdir(parents=True)
        
        try:
            self._connection = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
            )
            self._connection.execute("PRAGMA encoding = 'UTF-8'")
            self._connection.execute("PRAGMA journal_mode = WAL")
            self._connection.execute("PRAGMA synchronous = NORMAL")
            self._connection.execute("PRAGMA cache_size = -64000")
            self._connection.execute("PRAGMA temp_store = MEMORY")
            self._connection.row_factory = sqlite3.Row
            
            self._create_tables()
            
            print(f"SQLite 数据库初始化成功: {self.db_path}")
            
        except Exception as e:
            print(f"数据库初始化失败: {e}")
            self._connection = None
    
    def _create_tables(self):
        """创建表"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        # 摄像头表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS cameras (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                rtsp_url TEXT NOT NULL,
                location TEXT DEFAULT '',
                status TEXT DEFAULT 'offline',
                is_usb INTEGER DEFAULT 1,
                camera_index INTEGER DEFAULT 0,
                device_id TEXT DEFAULT '',
                group_id TEXT DEFAULT '',
                created_at REAL DEFAULT (strftime('%s', 'now')),
                updated_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 报警记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                camera_id INTEGER NOT NULL,
                violation_type TEXT NOT NULL,
                image_path TEXT DEFAULT '',
                location TEXT DEFAULT '',
                handled INTEGER DEFAULT 0,
                timestamp REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (camera_id) REFERENCES cameras(id)
            )
        """)
        
        # 报警设备表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarm_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT UNIQUE NOT NULL,
                device_type TEXT NOT NULL,
                camera_id INTEGER,
                config TEXT DEFAULT '{}',
                created_at REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (camera_id) REFERENCES cameras(id)
            )
        """)
        
        # 用户表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT DEFAULT 'operator',
                token TEXT DEFAULT '',
                created_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 尝试添加新列（如果不存在）
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN camera_name TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN alarm_type TEXT DEFAULT 'violation'")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN token TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN token_expires_at REAL DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        
        # 系统配置表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 员工表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS employees (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                employee_number TEXT UNIQUE NOT NULL,
                department TEXT DEFAULT '',
                position TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                email TEXT DEFAULT '',
                photo_path TEXT DEFAULT '',
                id_photo_path TEXT DEFAULT '',
                face_photo_path TEXT DEFAULT '',
                face_encoding TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                created_at REAL DEFAULT (strftime('%s', 'now')),
                updated_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        #尝试添加新列（如果不存在）
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN employee_id INTEGER DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN employee_name TEXT DEFAULT ''")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN person_track_id INTEGER DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        try:
            cursor.execute("ALTER TABLE alarms ADD COLUMN face_similarity REAL DEFAULT NULL")
        except sqlite3.OperationalError:
            pass
        for column, definition in [
            ("video_path", "TEXT DEFAULT ''"),
            ("handled_by", "INTEGER DEFAULT NULL"),
            ("handled_by_name", "TEXT DEFAULT ''"),
            ("handled_at", "REAL DEFAULT NULL"),
            ("handle_result", "TEXT DEFAULT ''"),
            ("handle_note", "TEXT DEFAULT ''"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE alarms ADD COLUMN {column} {definition}")
            except sqlite3.OperationalError:
                pass
        for column in ("id_photo_path", "face_photo_path"):
            try:
                cursor.execute(f"ALTER TABLE employees ADD COLUMN {column} TEXT DEFAULT ''")
            except sqlite3.OperationalError:
                pass
        for column, definition in [
            ("position", "TEXT DEFAULT ''"),
        ]:
            try:
                cursor.execute(f"ALTER TABLE cameras ADD COLUMN {column} {definition}")
            except sqlite3.OperationalError:
                pass
        
        # 创建索引（加速高频查询）
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alarms_timestamp ON alarms(timestamp)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alarms_camera_id ON alarms(camera_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_alarms_employee_id ON alarms(employee_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_employees_number ON employees(employee_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_token ON users(token)")
        
        # 审计日志表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                username TEXT DEFAULT '',
                action TEXT NOT NULL,
                detail TEXT DEFAULT '',
                ip TEXT DEFAULT '',
                timestamp REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp)")
        
        # 考勤规则表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                work_start_time TEXT NOT NULL DEFAULT '09:00',
                work_end_time TEXT NOT NULL DEFAULT '18:00',
                late_threshold INTEGER DEFAULT 10,
                early_threshold INTEGER DEFAULT 10,
                overtime_threshold INTEGER DEFAULT 60,
                rest_days TEXT DEFAULT '6,7',
                is_active INTEGER DEFAULT 1,
                created_at REAL DEFAULT (strftime('%s', 'now')),
                updated_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 考勤记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                employee_name TEXT DEFAULT '',
                employee_number TEXT DEFAULT '',
                department TEXT DEFAULT '',
                check_in_time REAL,
                check_out_time REAL,
                check_in_location TEXT DEFAULT '',
                check_out_location TEXT DEFAULT '',
                check_in_camera_id INTEGER,
                check_out_camera_id INTEGER,
                check_in_image_path TEXT DEFAULT '',
                check_out_image_path TEXT DEFAULT '',
                status TEXT DEFAULT 'normal',
                late_minutes INTEGER DEFAULT 0,
                early_minutes INTEGER DEFAULT 0,
                overtime_minutes INTEGER DEFAULT 0,
                work_hours REAL DEFAULT 0,
                remark TEXT DEFAULT '',
                created_at REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # 请假记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS leave_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                employee_name TEXT DEFAULT '',
                employee_number TEXT DEFAULT '',
                leave_type TEXT NOT NULL DEFAULT 'annual',
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                duration REAL DEFAULT 0,
                reason TEXT DEFAULT '',
                status TEXT DEFAULT 'pending',
                approved_by INTEGER,
                approved_at REAL,
                created_at REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # 考勤统计表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_statistics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                employee_name TEXT DEFAULT '',
                employee_number TEXT DEFAULT '',
                department TEXT DEFAULT '',
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                work_days INTEGER DEFAULT 0,
                actual_work_days REAL DEFAULT 0,
                late_days INTEGER DEFAULT 0,
                early_days INTEGER DEFAULT 0,
                absent_days INTEGER DEFAULT 0,
                overtime_hours REAL DEFAULT 0,
                leave_days REAL DEFAULT 0,
                attendance_rate REAL DEFAULT 0,
                created_at REAL DEFAULT (strftime('%s', 'now')),
                updated_at REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (employee_id) REFERENCES employees(id)
            )
        """)
        
        # 考勤索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance_records(employee_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_time ON attendance_records(check_in_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_records(employee_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_statistics_period ON attendance_statistics(year, month)")
        
        # 区域表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS zones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                zone_type TEXT DEFAULT 'danger',
                points TEXT DEFAULT '[]',
                camera_id INTEGER,
                is_active INTEGER DEFAULT 1,
                created_at REAL DEFAULT (strftime('%s', 'now')),
                updated_at REAL DEFAULT (strftime('%s', 'now'))
            )
        """)
        
        # 区域告警表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS zone_alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                zone_id INTEGER NOT NULL,
                employee_id INTEGER,
                employee_name TEXT DEFAULT '',
                employee_number TEXT DEFAULT '',
                image_path TEXT DEFAULT '',
                alert_type TEXT DEFAULT 'invasion',
                timestamp REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (zone_id) REFERENCES zones(id)
            )
        """)
        
        # 区域索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_zone_alerts_zone ON zone_alerts(zone_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_zone_alerts_time ON zone_alerts(timestamp)")
        
        # 交接班记录表
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS handover_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                outgoing_employee_id INTEGER NOT NULL,
                incoming_employee_id INTEGER NOT NULL,
                shift TEXT DEFAULT 'day',
                handover_time REAL DEFAULT (strftime('%s', 'now')),
                equipment_status TEXT DEFAULT '',
                safety_notes TEXT DEFAULT '',
                production_notes TEXT DEFAULT '',
                other_notes TEXT DEFAULT '',
                created_at REAL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY (outgoing_employee_id) REFERENCES employees(id),
                FOREIGN KEY (incoming_employee_id) REFERENCES employees(id)
            )
        """)
        
        # 交接班索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_handover_time ON handover_records(handover_time)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_handover_outgoing ON handover_records(outgoing_employee_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_handover_incoming ON handover_records(incoming_employee_id)")
        
        self._connection.commit()
    
    # ============================================
    # 摄像头操作
    # ============================================
    def add_camera(self, camera: Dict) -> int:
        """添加摄像头"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            INSERT INTO cameras (name, rtsp_url, location, status, is_usb, camera_index, device_id, group_id, position)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            camera.get('name', ''),
            camera.get('rtsp_url', ''),
            camera.get('location', ''),
            camera.get('status', 'offline'),
            1 if camera.get('is_usb', True) else 0,
            camera.get('camera_index', 0),
            camera.get('device_id', ''),
            camera.get('group_id', ''),
            camera.get('position', '')
        ))
        
        self._connection.commit()
        
        return cursor.lastrowid
    
    def update_camera(self, camera_id: int, camera: Dict):
        """更新摄像头"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        updates = []
        params = []
        
        for key in ['name', 'rtsp_url', 'location', 'status', 'position']:
            if key in camera:
                updates.append(f"{key} = ?")
                params.append(camera[key])
        
        if updates:
            params.append(camera_id)
            
            cursor.execute(f"""
                UPDATE cameras 
                SET {', '.join(updates)}, updated_at = strftime('%s', 'now')
                WHERE id = ?
            """, params)
            
            self._connection.commit()
    
    def delete_camera(self, camera_id: int):
        """删除摄像头"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        cursor.execute("DELETE FROM cameras WHERE id = ?", (camera_id,))
        
        self._connection.commit()
    
    def get_cameras(self) -> List[Dict]:
        """获取摄像头列表"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            SELECT id, name, rtsp_url, location, status, is_usb,
                   camera_index, device_id, group_id, position, created_at, updated_at
            FROM cameras
            ORDER BY id
        """)
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_camera(self, camera_id: int) -> Optional[Dict]:
        """获取摄像头"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        
        cursor.execute("SELECT * FROM cameras WHERE id = ?", (camera_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None

    def get_camera_by_index(self, camera_index: int) -> Optional[Dict]:
        """根据 camera_index 获取摄像头（不限 is_usb）"""
        if not self._connection:
            return None
        cursor = self._connection.cursor()
        cursor.execute(
            "SELECT * FROM cameras WHERE camera_index = ?",
            (camera_index,),
        )
        row = cursor.fetchone()
        return dict(row) if row else None
    
    # ============================================
    # 报警操作
    # ============================================
    def add_alarm(self, alarm: Dict) -> int:
        """添加报警记录"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            INSERT INTO alarms (
                camera_id, camera_name, violation_type, alarm_type, image_path,
                location, employee_id, employee_name, person_track_id, face_similarity,
                video_path
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            alarm.get('camera_id'),
            alarm.get('camera_name', ''),
            alarm.get('violation_type', ''),
            alarm.get('alarm_type', 'violation'),
            alarm.get('image_path', ''),
            alarm.get('location', ''),
            alarm.get('employee_id'),
            alarm.get('employee_name', ''),
            alarm.get('person_track_id'),
            alarm.get('face_similarity'),
            alarm.get('video_path', '')
        ))
        
        self._connection.commit()
        
        return cursor.lastrowid
    
    def get_alarms(
        self,
        camera_id: Optional[int] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """获取报警记录"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        
        if camera_id:
            cursor.execute("""
                SELECT a.id, a.camera_id, a.camera_name, a.violation_type, a.alarm_type,
                       a.image_path, a.location, a.handled, a.timestamp,
                       a.employee_id,
                       COALESCE(NULLIF(a.employee_name, ''), e.name, '') AS employee_name,
                       a.person_track_id, a.face_similarity,
                       a.video_path, a.handled_by, a.handled_by_name, a.handled_at,
                       a.handle_result, a.handle_note,
                       COALESCE(e.employee_number, '') AS employee_number,
                       COALESCE(e.department, '') AS employee_department,
                       COALESCE(e.position, '') AS employee_position,
                       CASE WHEN COALESCE(e.photo_path, '') <> '' THEN 1 ELSE 0 END
                           AS employee_photo_available,
                       COALESCE(c.position, '') AS camera_position
                FROM alarms a
                LEFT JOIN employees e ON e.id = a.employee_id
                LEFT JOIN cameras c ON c.id = a.camera_id
                WHERE a.camera_id = ?
                ORDER BY a.timestamp DESC
                LIMIT ? OFFSET ?
            """, (camera_id, limit, offset))
        else:
            cursor.execute("""
                SELECT a.id, a.camera_id, a.camera_name, a.violation_type, a.alarm_type,
                       a.image_path, a.location, a.handled, a.timestamp,
                       a.employee_id,
                       COALESCE(NULLIF(a.employee_name, ''), e.name, '') AS employee_name,
                       a.person_track_id, a.face_similarity,
                       a.video_path, a.handled_by, a.handled_by_name, a.handled_at,
                       a.handle_result, a.handle_note,
                       COALESCE(e.employee_number, '') AS employee_number,
                       COALESCE(e.department, '') AS employee_department,
                       COALESCE(e.position, '') AS employee_position,
                       CASE WHEN COALESCE(e.photo_path, '') <> '' THEN 1 ELSE 0 END
                           AS employee_photo_available,
                       COALESCE(c.position, '') AS camera_position
                FROM alarms a
                LEFT JOIN employees e ON e.id = a.employee_id
                LEFT JOIN cameras c ON c.id = a.camera_id
                ORDER BY a.timestamp DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_alarm(self, alarm_id: int) -> Optional[Dict]:
        """获取单条报警"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            SELECT a.id, a.camera_id, a.camera_name, a.violation_type, a.alarm_type,
                   a.image_path, a.location, a.handled, a.timestamp,
                   a.employee_id,
                   COALESCE(NULLIF(a.employee_name, ''), e.name, '') AS employee_name,
                   a.person_track_id, a.face_similarity,
                   a.video_path, a.handled_by, a.handled_by_name, a.handled_at,
                   a.handle_result, a.handle_note,
                   COALESCE(e.employee_number, '') AS employee_number,
                   COALESCE(e.department, '') AS employee_department,
                   COALESCE(e.position, '') AS employee_position,
                   CASE WHEN COALESCE(e.photo_path, '') <> '' THEN 1 ELSE 0 END
                       AS employee_photo_available
            FROM alarms a
            LEFT JOIN employees e ON e.id = a.employee_id
            WHERE a.id = ?
        """, (alarm_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def handle_alarm(
        self,
        alarm_id: int,
        user_id: int,
        username: str,
        result: str,
        note: str = "",
    ):
        """处理报警"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            UPDATE alarms 
            SET handled = 1, handled_by = ?, handled_by_name = ?,
                handled_at = strftime('%s', 'now'), handle_result = ?, handle_note = ?
            WHERE id = ?
        """, (user_id, username, result, note, alarm_id))
        
        self._connection.commit()

    def update_alarm_video(self, alarm_id: int, video_path: str):
        if not self._connection:
            return
        self._connection.execute(
            "UPDATE alarms SET video_path = ? WHERE id = ?",
            (video_path, alarm_id),
        )
        self._connection.commit()

    def delete_alarm(self, alarm_id: int):
        """删除报警记录"""
        if not self._connection:
            return

        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM alarms WHERE id = ?", (alarm_id,))
        self._connection.commit()
    
    def get_alarm_count(
        self,
        camera_id: Optional[int] = None
    ) -> int:
        """获取报警数量"""
        if not self._connection:
            return 0
        
        cursor = self._connection.cursor()
        
        if camera_id:
            cursor.execute("""
                SELECT COUNT(*) FROM alarms WHERE camera_id = ?
            """, (camera_id,))
        else:
            cursor.execute("SELECT COUNT(*) FROM alarms")
        
        return cursor.fetchone()[0]

    def get_alarms_by_employee(self, employee_id: int) -> List[Dict]:
        """获取指定员工的报警记录"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        cursor.execute("""
            SELECT a.id, a.camera_id, a.camera_name, a.violation_type, a.alarm_type,
                   a.image_path, a.location, a.handled, a.timestamp,
                   a.employee_id, a.employee_name, a.person_track_id, a.face_similarity,
                   a.video_path, a.handled_by, a.handled_by_name, a.handled_at,
                   a.handle_result, a.handle_note
            FROM alarms a
            WHERE a.employee_id = ?
            ORDER BY a.timestamp DESC
        """, (employee_id,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    # ============================================
    # 统计
    # ============================================
    def get_stats(self, days: int = 7) -> Dict:
        """获取统计数据"""
        if not self._connection:
            return {}
        
        cursor = self._connection.cursor()
        
        # 计算起始时间
        start_time = time.time() - (days * 86400)
        
        # 总报警数
        cursor.execute("""
            SELECT COUNT(*) FROM alarms WHERE timestamp >= ?
        """, (start_time,))
        total_alarms = cursor.fetchone()[0]
        
        # 按类型统计
        cursor.execute("""
            SELECT violation_type, COUNT(*) as count
            FROM alarms
            WHERE timestamp >= ?
            GROUP BY violation_type
        """, (start_time,))
        
        type_counts = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 按天统计
        cursor.execute("""
            SELECT DATE(timestamp, 'unixepoch') as date, COUNT(*) as count
            FROM alarms
            WHERE timestamp >= ?
            GROUP BY date
            ORDER BY date
        """, (start_time,))
        
        daily_counts = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 已处理/未处理
        cursor.execute("""
            SELECT handled, COUNT(*) as count
            FROM alarms
            WHERE timestamp >= ?
            GROUP BY handled
        """, (start_time,))
        
        handled_counts = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 摄像头统计
        cursor.execute("""
            SELECT a.camera_id, c.name, c.position, COUNT(*) as count
            FROM alarms a
            LEFT JOIN cameras c ON c.id = a.camera_id
            WHERE a.timestamp >= ?
            GROUP BY a.camera_id
        """, (start_time,))
        
        camera_counts = {}
        for row in cursor.fetchall():
            cam_id = row[0]
            cam_name = row[1] or str(cam_id)
            cam_position = row[2] or ''
            camera_counts[cam_id] = {
                'name': cam_name,
                'position': cam_position,
                'count': row[3]
            }

        cursor.execute("""
            SELECT id, camera_id, camera_name, violation_type, alarm_type,
                   location, handled, timestamp,
                   employee_id, employee_name, person_track_id
            FROM alarms
            WHERE timestamp >= ?
            ORDER BY timestamp DESC
            LIMIT 10
        """, (start_time,))
        recent_alarms = [dict(row) for row in cursor.fetchall()]
        
        return {
            'total': total_alarms,
            'by_type': type_counts,
            'daily': daily_counts,
            'handled': handled_counts.get(1, 0),
            'pending': handled_counts.get(0, 0),
            'by_camera': camera_counts,
            'recent_alarms': recent_alarms,
        }
    
    def get_daily_stats(self, days: int = 30) -> List[Dict]:
        """获取每日统计数据"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        start_time = time.time() - (days * 86400)
        
        cursor.execute("""
            SELECT 
                DATE(timestamp, 'unixepoch') as date,
                COUNT(*) as total,
                SUM(CASE WHEN handled = 1 THEN 1 ELSE 0 END) as handled,
                SUM(CASE WHEN handled = 0 THEN 1 ELSE 0 END) as pending
            FROM alarms
            WHERE timestamp >= ?
            GROUP BY date
            ORDER BY date
        """, (start_time,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_camera_stats(self, camera_id: int, days: int = 7) -> Dict:
        """获取指定摄像头的统计数据"""
        if not self._connection:
            return {}
        
        cursor = self._connection.cursor()
        start_time = time.time() - (days * 86400)
        
        # 总报警数
        cursor.execute("""
            SELECT COUNT(*) FROM alarms 
            WHERE camera_id = ? AND timestamp >= ?
        """, (camera_id, start_time))
        total = cursor.fetchone()[0]
        
        # 按类型统计
        cursor.execute("""
            SELECT violation_type, COUNT(*) as count
            FROM alarms
            WHERE camera_id = ? AND timestamp >= ?
            GROUP BY violation_type
        """, (camera_id, start_time))
        
        by_type = {row[0]: row[1] for row in cursor.fetchall()}
        
        # 已处理
        cursor.execute("""
            SELECT COUNT(*) FROM alarms 
            WHERE camera_id = ? AND timestamp >= ? AND handled = 1
        """, (camera_id, start_time))
        handled = cursor.fetchone()[0]
        
        return {
            'total': total,
            'by_type': by_type,
            'handled': handled,
            'pending': total - handled
        }
    
    # ============================================
    # 配置
    # ============================================
    def set_config(self, key: str, value: str):
        """设置配置"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO config (key, value, updated_at)
            VALUES (?, ?, strftime('%s', 'now'))
        """, (key, value))
        
        self._connection.commit()
    
    def get_config(self, key: str) -> Optional[str]:
        """获取配置"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        
        cursor.execute("SELECT value FROM config WHERE key = ?", (key,))
        
        row = cursor.fetchone()
        return row[0] if row else None
    
    # ============================================
    # 用户管理
    # ============================================
    def create_user(self, username: str, password: str, role: str = 'operator') -> int:
        """创建用户"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        
        # 检查是否存在
        cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            return -1  # 用户已存在
        
        password_hash = pbkdf2_sha256.hash(password)

        cursor.execute("""
            INSERT INTO users (username, password, role)
            VALUES (?, ?, ?)
        """, (username, password_hash, role))
        
        self._connection.commit()
        return cursor.lastrowid
    
    def get_users(self) -> List[Dict]:
        """获取所有用户"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT id, username, role, created_at FROM users")
        return [dict(row) for row in cursor.fetchall()]
    
    def get_user_by_username(self, username: str) -> Optional[Dict]:
        """根据用户名获取用户"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def delete_user(self, user_id: int):
        """删除用户"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        self._connection.commit()
    
    def update_user_token(self, user_id: int, token: str, expires_in: int = 604800):
        """更新用户 token（默认 7 天过期）"""
        if not self._connection:
            return
        
        import time
        expires_at = time.time() + expires_in
        cursor = self._connection.cursor()
        cursor.execute(
            "UPDATE users SET token = ?, token_expires_at = ? WHERE id = ?",
            (token, expires_at, user_id),
        )
        self._connection.commit()
    
    def clear_user_token(self, token: str):
        """清除用户 token"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        cursor.execute("UPDATE users SET token = '' WHERE token = ?", (token,))
        self._connection.commit()
    
    def get_user_by_token(self, token: str) -> Optional[Dict]:
        """通过 token 获取用户（检查过期）"""
        if not self._connection or not token:
            return None
        
        import time
        cursor = self._connection.cursor()
        cursor.execute(
            "SELECT id, username, role FROM users WHERE token = ? AND (token_expires_at IS NULL OR token_expires_at > ?)",
            (token, time.time()),
        )
        row = cursor.fetchone()
        if not row:
            if token:
                self.clear_user_token(token)
            return None
        return dict(row)

    def ensure_admin_user(self, username: str = "admin", password: str = ""):
        """保证至少有一个管理员，兼容旧数据库的 operator 账号。"""
        if not self._connection:
            return
        cursor = self._connection.cursor()
        if cursor.execute("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").fetchone():
            return
        existing = cursor.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            cursor.execute("UPDATE users SET role = 'admin' WHERE id = ?", (existing[0],))
        else:
            cursor.execute(
                "INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')",
                (username, pbkdf2_sha256.hash(password)),
            )
        self._connection.commit()
    
    def verify_user(self, username: str, password: str) -> Optional[Dict]:
        """验证用户"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            SELECT id, username, password, role FROM users
            WHERE username = ?
        """, (username,))

        row = cursor.fetchone()
        if not row:
            return None

        user = dict(row)
        stored_password = user.get('password', '')
        verified = False
        if stored_password.startswith('$pbkdf2-sha256$'):
            verified = pbkdf2_sha256.verify(password, stored_password)
        else:
            verified = stored_password == password

        if not verified:
            return None

        return {
            'id': user['id'],
            'username': user['username'],
            'role': user.get('role', 'operator'),
        }
    
    # ============================================
    # 员工操作
    # ============================================
    def add_employee(self, employee: Dict) -> int:
        """添加员工"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            INSERT INTO employees (name, employee_number, department, position, phone, email, photo_path, id_photo_path, face_photo_path, face_encoding, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            employee.get('name', ''),
            employee.get('employee_number', ''),
            employee.get('department', ''),
            employee.get('position', ''),
            employee.get('phone', ''),
            employee.get('email', ''),
            employee.get('photo_path', ''),
            employee.get('id_photo_path', employee.get('photo_path', '')),
            employee.get('face_photo_path', ''),
            employee.get('face_encoding', ''),
            employee.get('status', 'active')
        ))
        
        self._connection.commit()
        
        return cursor.lastrowid
    
    def update_employee(self, employee_id: int, employee: Dict):
        """更新员工"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        updates = []
        params = []
        
        for key in ['name', 'employee_number', 'department', 'position', 'phone', 'email', 'photo_path', 'id_photo_path', 'face_photo_path', 'face_encoding', 'status']:
            if key in employee:
                updates.append(f"{key} = ?")
                params.append(employee[key])
        
        if updates:
            params.append(employee_id)
            cursor.execute(f"""
                UPDATE employees 
                SET {', '.join(updates)}, updated_at = strftime('%s', 'now')
                WHERE id = ?
            """, params)
            
            self._connection.commit()
    
    def delete_employee(self, employee_id: int):
        """删除员工"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM employees WHERE id = ?", (employee_id,))
        self._connection.commit()
    
    def get_employees(self) -> List[Dict]:
        """获取员工列表"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        
        cursor.execute("""
            SELECT e.id, e.name, e.employee_number, e.department, e.position, e.phone, e.email,
                   COALESCE(NULLIF(e.id_photo_path, ''), e.photo_path, '') AS photo_path,
                   e.id_photo_path, e.face_photo_path, e.status, e.created_at,
                   COALESCE(a.alarm_count, 0) AS alarm_count
            FROM employees e
            LEFT JOIN (
                SELECT employee_id, COUNT(*) AS alarm_count
                FROM alarms
                WHERE employee_id IS NOT NULL
                GROUP BY employee_id
            ) a ON e.id = a.employee_id
            ORDER BY e.id
        """)
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_employee(self, employee_id: int) -> Optional[Dict]:
        """获取员工"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM employees WHERE id = ?", (employee_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_employee_by_number(self, employee_number: str) -> Optional[Dict]:
        """通过工号获取员工"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM employees WHERE employee_number = ?", (employee_number,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def close(self):
        """关闭连接"""
        if self._connection:
            self._connection.close()
            self._connection = None

    # ============================================
    # 考勤规则操作
    # ============================================
    def add_attendance_rule(self, rule: Dict) -> int:
        """添加考勤规则"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        cursor.execute("""
            INSERT INTO attendance_rules (name, work_start_time, work_end_time, 
                late_threshold, early_threshold, overtime_threshold, rest_days, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            rule.get('name', ''),
            rule.get('work_start_time', '09:00'),
            rule.get('work_end_time', '18:00'),
            rule.get('late_threshold', 10),
            rule.get('early_threshold', 10),
            rule.get('overtime_threshold', 60),
            rule.get('rest_days', '6,7'),
            rule.get('is_active', 1)
        ))
        
        self._connection.commit()
        return cursor.lastrowid
    
    def update_attendance_rule(self, rule_id: int, rule: Dict):
        """更新考勤规则"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        updates = []
        params = []
        
        for key in ['name', 'work_start_time', 'work_end_time', 'late_threshold', 
                     'early_threshold', 'overtime_threshold', 'rest_days', 'is_active']:
            if key in rule:
                updates.append(f"{key} = ?")
                params.append(rule[key])
        
        if updates:
            params.append(rule_id)
            cursor.execute(f"""
                UPDATE attendance_rules 
                SET {', '.join(updates)}, updated_at = strftime('%s', 'now')
                WHERE id = ?
            """, params)
            self._connection.commit()
    
    def delete_attendance_rule(self, rule_id: int):
        """删除考勤规则"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM attendance_rules WHERE id = ?", (rule_id,))
        self._connection.commit()
    
    def get_attendance_rules(self) -> List[Dict]:
        """获取考勤规则列表"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM attendance_rules ORDER BY id")
        return [dict(row) for row in cursor.fetchall()]
    
    def get_active_attendance_rule(self) -> Optional[Dict]:
        """获取当前激活的考勤规则"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM attendance_rules WHERE is_active = 1 LIMIT 1")
        row = cursor.fetchone()
        return dict(row) if row else None

    # ============================================
    # 考勤记录操作
    # ============================================
    def add_attendance_record(self, record: Dict) -> int:
        """添加考勤记录"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        cursor.execute("""
            INSERT INTO attendance_records (employee_id, employee_name, employee_number,
                department, check_in_time, check_out_time, check_in_location, check_out_location,
                check_in_camera_id, check_out_camera_id, check_in_image_path, check_out_image_path,
                status, late_minutes, early_minutes, overtime_minutes, work_hours, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.get('employee_id'),
            record.get('employee_name', ''),
            record.get('employee_number', ''),
            record.get('department', ''),
            record.get('check_in_time'),
            record.get('check_out_time'),
            record.get('check_in_location', ''),
            record.get('check_out_location', ''),
            record.get('check_in_camera_id'),
            record.get('check_out_camera_id'),
            record.get('check_in_image_path', ''),
            record.get('check_out_image_path', ''),
            record.get('status', 'normal'),
            record.get('late_minutes', 0),
            record.get('early_minutes', 0),
            record.get('overtime_minutes', 0),
            record.get('work_hours', 0),
            record.get('remark', '')
        ))
        
        self._connection.commit()
        return cursor.lastrowid
    
    def update_attendance_record(self, record_id: int, record: Dict):
        """更新考勤记录"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        updates = []
        params = []
        
        for key in ['check_out_time', 'check_out_location', 'check_out_camera_id', 
                     'check_out_image_path', 'status', 'late_minutes', 'early_minutes',
                     'overtime_minutes', 'work_hours', 'remark']:
            if key in record:
                updates.append(f"{key} = ?")
                params.append(record[key])
        
        if updates:
            params.append(record_id)
            cursor.execute(f"""
                UPDATE attendance_records 
                SET {', '.join(updates)}
                WHERE id = ?
            """, params)
            self._connection.commit()
    
    def get_attendance_records(
        self,
        employee_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """获取考勤记录"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        query = """
            SELECT ar.*, e.name as emp_name, e.department as emp_department
            FROM attendance_records ar
            LEFT JOIN employees e ON e.id = ar.employee_id
            WHERE 1=1
        """
        params = []
        
        if employee_id:
            query += " AND ar.employee_id = ?"
            params.append(employee_id)
        
        if start_date:
            query += " AND DATE(ar.check_in_time, 'unixepoch') >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(ar.check_in_time, 'unixepoch') <= ?"
            params.append(end_date)
        
        if status:
            query += " AND ar.status = ?"
            params.append(status)
        
        query += " ORDER BY ar.check_in_time DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    
    def get_attendance_record(self, record_id: int) -> Optional[Dict]:
        """获取单条考勤记录"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("""
            SELECT ar.*, e.name as emp_name, e.department as emp_department
            FROM attendance_records ar
            LEFT JOIN employees e ON e.id = ar.employee_id
            WHERE ar.id = ?
        """, (record_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_today_check_in(self, employee_id: int) -> Optional[Dict]:
        """获取员工今日签到记录"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("""
            SELECT * FROM attendance_records 
            WHERE employee_id = ? AND DATE(check_in_time, 'unixepoch') = DATE('now', 'localtime')
            ORDER BY check_in_time DESC LIMIT 1
        """, (employee_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_attendance_count(
        self,
        employee_id: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> int:
        """获取考勤记录数量"""
        if not self._connection:
            return 0
        
        cursor = self._connection.cursor()
        query = "SELECT COUNT(*) FROM attendance_records WHERE 1=1"
        params = []
        
        if employee_id:
            query += " AND employee_id = ?"
            params.append(employee_id)
        
        if start_date:
            query += " AND DATE(check_in_time, 'unixepoch') >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND DATE(check_in_time, 'unixepoch') <= ?"
            params.append(end_date)
        
        cursor.execute(query, params)
        return cursor.fetchone()[0]

    # ============================================
    # 请假记录操作
    # ============================================
    def add_leave_record(self, record: Dict) -> int:
        """添加请假记录"""
        if not self._connection:
            return -1
        
        cursor = self._connection.cursor()
        cursor.execute("""
            INSERT INTO leave_records (employee_id, employee_name, employee_number,
                leave_type, start_date, end_date, duration, reason, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.get('employee_id'),
            record.get('employee_name', ''),
            record.get('employee_number', ''),
            record.get('leave_type', 'annual'),
            record.get('start_date', ''),
            record.get('end_date', ''),
            record.get('duration', 0),
            record.get('reason', ''),
            record.get('status', 'pending')
        ))
        
        self._connection.commit()
        return cursor.lastrowid
    
    def update_leave_record(self, record_id: int, record: Dict):
        """更新请假记录"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        updates = []
        params = []
        
        for key in ['status', 'approved_by', 'approved_at']:
            if key in record:
                updates.append(f"{key} = ?")
                params.append(record[key])
        
        if updates:
            params.append(record_id)
            cursor.execute(f"""
                UPDATE leave_records 
                SET {', '.join(updates)}
                WHERE id = ?
            """, params)
            self._connection.commit()
    
    def delete_leave_record(self, record_id: int):
        """删除请假记录"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM leave_records WHERE id = ?", (record_id,))
        self._connection.commit()
    
    def get_leave_records(
        self,
        employee_id: Optional[int] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """获取请假记录"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        query = "SELECT * FROM leave_records WHERE 1=1"
        params = []
        
        if employee_id:
            query += " AND employee_id = ?"
            params.append(employee_id)
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        if start_date:
            query += " AND start_date >= ?"
            params.append(start_date)
        
        if end_date:
            query += " AND end_date <= ?"
            params.append(end_date)
        
        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]
    
    def get_leave_record(self, record_id: int) -> Optional[Dict]:
        """获取单条请假记录"""
        if not self._connection:
            return None
        
        cursor = self._connection.cursor()
        cursor.execute("SELECT * FROM leave_records WHERE id = ?", (record_id,))
        row = cursor.fetchone()
        return dict(row) if row else None

    # ============================================
    # 考勤统计操作
    # ============================================
    def update_attendance_statistics(self, employee_id: int, year: int, month: int, stats: Dict):
        """更新考勤统计"""
        if not self._connection:
            return
        
        cursor = self._connection.cursor()
        
        # 检查是否存在统计记录
        cursor.execute("""
            SELECT id FROM attendance_statistics 
            WHERE employee_id = ? AND year = ? AND month = ?
        """, (employee_id, year, month))
        existing = cursor.fetchone()
        
        if existing:
            updates = []
            params = []
            for key in ['work_days', 'actual_work_days', 'late_days', 'early_days', 
                       'absent_days', 'overtime_hours', 'leave_days', 'attendance_rate']:
                if key in stats:
                    updates.append(f"{key} = ?")
                    params.append(stats[key])
            
            if updates:
                params.append(existing[0])
                cursor.execute(f"""
                    UPDATE attendance_statistics 
                    SET {', '.join(updates)}, updated_at = strftime('%s', 'now')
                    WHERE id = ?
                """, params)
        else:
            cursor.execute("""
                INSERT INTO attendance_statistics (employee_id, employee_name, employee_number,
                    department, year, month, work_days, actual_work_days, late_days, early_days,
                    absent_days, overtime_hours, leave_days, attendance_rate)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                employee_id,
                stats.get('employee_name', ''),
                stats.get('employee_number', ''),
                stats.get('department', ''),
                year, month,
                stats.get('work_days', 0),
                stats.get('actual_work_days', 0),
                stats.get('late_days', 0),
                stats.get('early_days', 0),
                stats.get('absent_days', 0),
                stats.get('overtime_hours', 0),
                stats.get('leave_days', 0),
                stats.get('attendance_rate', 0)
            ))
        
        self._connection.commit()
    
    def get_attendance_statistics(
        self,
        employee_id: Optional[int] = None,
        department: Optional[str] = None,
        year: Optional[int] = None,
        month: Optional[int] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """获取考勤统计"""
        if not self._connection:
            return []
        
        cursor = self._connection.cursor()
        query = """
            SELECT as2.*, e.name as emp_name, e.department as emp_department
            FROM attendance_statistics as2
            LEFT JOIN employees e ON e.id = as2.employee_id
            WHERE 1=1
        """
        params = []
        
        if employee_id:
            query += " AND as2.employee_id = ?"
            params.append(employee_id)
        
        if department:
            query += " AND as2.department = ?"
            params.append(department)
        
        if year:
            query += " AND as2.year = ?"
            params.append(year)
        
        if month:
            query += " AND as2.month = ?"
            params.append(month)
        
        query += " ORDER BY as2.year DESC, as2.month DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        
        cursor.execute(query, params)
        return [dict(row) for row in cursor.fetchall()]

    def log_audit(self, user_id: int = None, username: str = "", action: str = "", detail: str = "", ip: str = ""):
        """记录审计日志"""
        if not self._connection:
            return
        try:
            cursor = self._connection.cursor()
            cursor.execute(
                "INSERT INTO audit_log (user_id, username, action, detail, ip) VALUES (?, ?, ?, ?, ?)",
                (user_id, username, action, detail, ip),
            )
            self._connection.commit()
        except Exception:
            pass

    def get_audit_logs(self, limit: int = 100) -> List[Dict]:
        """获取审计日志"""
        if not self._connection:
            return []
        cursor = self._connection.cursor()
        cursor.execute(
            "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?", (limit,)
        )
        return [dict(row) for row in cursor.fetchall()]

    def cleanup_old_records(self, retention_days: int = 90) -> int:
        """清理超过保留天数的报警记录，返回删除数量"""
        if not self._connection:
            return 0
        cutoff = time.time() - (retention_days * 86400)
        cursor = self._connection.cursor()
        cursor.execute("DELETE FROM alarms WHERE timestamp < ?", (cutoff,))
        deleted = cursor.rowcount
        self._connection.commit()
        if deleted > 0:
            print(f"[清理] 已删除 {deleted} 条过期报警记录（>{retention_days}天）")
        return deleted

    def execute(self, sql: str, params=()) -> list:
        """执行 SQL 查询并返回结果列表（封装原始 cursor 访问）"""
        if not self._connection:
            return []
        with self._lock:
            cursor = self._connection.cursor()
            cursor.execute(sql, params)
            if cursor.description:
                return [dict(row) for row in cursor.fetchall()]
            self._connection.commit()
            return []


def create_database(**kwargs) -> Optional[Database]:
    """创建数据库"""
    db = Database(**kwargs)
    if db._connection:
        return db
    return None
