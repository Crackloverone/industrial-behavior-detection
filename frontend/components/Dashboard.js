'use client';

import { useState, useEffect, useRef } from 'react';
import { getMockAlarms, getMockStats } from '@/lib/mockData';
import { getViolationText, getDetectionLabel } from '@/lib/constants';

// All HTTP calls go through local /api/* routes
// Only WebSocket connects directly to backend (can't proxy WS through Next.js API)
const WS_BASE = process.env.NEXT_PUBLIC_API_BASE?.replace('http', 'ws') || 'ws://localhost:8000';

// Toast notification helper
function showToast(message, type = 'danger') {
  // Will be handled by component state
  return { message, type };
}

export default function Dashboard() {
  const [stats, setStats] = useState({
    cameras: 0,
    todayAlarms: 0,
    handled: 0,
    accuracy: 95,
  });
  const [browserDevices, setBrowserDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [currentStream, setCurrentStream] = useState(null);
  const [alarms, setAlarms] = useState([]);
  const [detections, setDetections] = useState([]);
  const [violations, setViolations] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [activeTab, setActiveTab] = useState('detection');
  const [showNotification, setShowNotification] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const detectIntervalRef = useRef(null);

  useEffect(() => {
    detectCameras();
    loadAlarms();
    loadStats();
    connectAlarmWebSocket();
    
    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (detectIntervalRef.current) {
        clearInterval(detectIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    // Show notification for new alarms
    if (showNotification) {
      const timer = setTimeout(() => setShowNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const wsReconnectDelay = useRef(1000);

  async function connectAlarmWebSocket() {
    try {
      const ws = new WebSocket(`${WS_BASE}/ws/alarms`);
      ws.onopen = () => {
        console.log('报警 WebSocket 已连接');
        wsReconnectDelay.current = 1000;
      };
      ws.onmessage = (event) => {
        if (event.data === 'ping') return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'alarm') {
            setAlarms(prev => [data.alarm, ...prev.slice(0, 19)]);
            setStats(prev => ({ ...prev, todayAlarms: prev.todayAlarms + 1 }));
            setShowNotification({
              type: 'danger',
              message: `新报警: ${getViolationText(data.alarm.violation_type)}`
            });
          }
        } catch (e) {
          console.error('解析报警消息失败:', e);
        }
      };
      ws.onclose = () => {
        const delay = wsReconnectDelay.current;
        wsReconnectDelay.current = Math.min(delay * 2, 30000);
        setTimeout(connectAlarmWebSocket, delay);
      };
      wsRef.current = ws;
    } catch (e) {
      console.error('连接报警 WebSocket 失败:', e);
    }
  }

  async function detectCameras() {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      setBrowserDevices(videoDevices);
      setStats(prev => ({ ...prev, cameras: videoDevices.length }));
      
      if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (e) {
      console.error('检测失败:', e);
    }
  }

  async function loadAlarms() {
    try {
      const res = await fetch(`/api/alarms?limit=10`);
      const data = await res.json();
      if (data.code === 200) {
        setAlarms(data.data || []);
        
        const now = Date.now() / 1000;
        const todayStart = now - 86400;
        const todayAlarms = (data.data || []).filter(a => a.timestamp >= todayStart);
        const handled = (data.data || []).filter(a => a.handled).length;
        
        setStats(prev => ({
          ...prev,
          todayAlarms: todayAlarms.length,
          handled
        }));
      }
    } catch (e) {
      console.error('加载报警失败，使用本地数据:', e);
      // 使用本地mock数据
      const mockAlarms = getMockAlarms(10);
      setAlarms(mockAlarms);
      const mockStats = getMockStats();
      setStats(prev => ({
        ...prev,
        todayAlarms: mockStats.total,
        handled: mockStats.handled
      }));
      setShowNotification({ type: 'warning', message: '使用本地数据 (API连接失败)' });
    }
  }

  async function loadStats() {
    try {
      const res = await fetch(`/api/stats`);
      const data = await res.json();
      if (data.code === 200) {
        setStats(prev => ({
          ...prev,
          todayAlarms: data.data.total || 0,
          handled: data.data.handled || 0
        }));
      }
    } catch (e) {
      console.error('加载统计失败，使用本地数据:', e);
      // 使用本地mock数据
      const mockStats = getMockStats();
      setStats(prev => ({
        ...prev,
        todayAlarms: mockStats.total,
        handled: mockStats.handled
      }));
      setShowNotification({ type: 'warning', message: '使用本地数据 (API连接失败)' });
    }
  }

  useEffect(() => {
    if (selectedDeviceId) {
      startCamera(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  async function startCamera(deviceId) {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
    }
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      
      setCurrentStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      setTimeout(() => {
        if (isDetecting) startDetection();
      }, 500);
    } catch (e) {
      console.error('启动失败:', e);
    }
  }

  function startDetection() {
    if (detectIntervalRef.current) return;
    setIsDetecting(true);
    detectIntervalRef.current = setInterval(performDetection, 1000);
  }

  function stopDetection() {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    setIsDetecting(false);
    setDetections([]);
    setViolations([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  async function performDetection() {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState < 2) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
      const res = await fetch(`/api/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          camera_id: 1,
          camera_name: getSelectedCameraLabel()
        })
      });
      
      const data = await res.json();
      
      if (data.code === 200 && data.data) {
        setDetections(data.data.detections || []);
        setViolations(data.data.violations || []);
        drawDetections(ctx, canvas.width, canvas.height, data.data.detections, data.data.violations);
      }
    } catch (e) {
      console.error('检测失败:', e);
    }
  }

  function drawDetections(ctx, width, height, detections, violations) {
    if (!ctx) return;
    
    const violationTypes = new Set(violations?.map(v => v.violation_type) || []);
    
    for (const det of detections || []) {
      const bbox = det.bbox;
      if (!bbox || bbox.length !== 4) continue;
      
      let color = '#10b981';
      let label = getClassName(det.class_name);
      
      if (det.class_name === 'person') {
        const personViolations = violations?.filter(v => _bboxOverlap(bbox, v.person_bbox)) || [];
        if (personViolations.length > 0) {
          color = '#ef4444';
          const types = personViolations.map(v => getViolationText(v.violation_type));
          label += ' ' + types.join(', ');
        }
      }
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bbox[0], bbox[1], bbox[2] - bbox[0], bbox[3] - bbox[1]);
      
      ctx.fillStyle = color;
      ctx.fillRect(bbox[0], bbox[1] - 20, ctx.measureText(label).width + 10, 20);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(label, bbox[0] + 5, bbox[1] - 7);
    }
  }

  function getClassName(className) {
    return getDetectionLabel(className);
  }

  function _bboxOverlap(bbox1, bbox2) {
    if (!bbox1 || !bbox2) return false;
    return bbox1[0] < bbox2[2] && bbox1[2] > bbox2[0] && bbox1[1] < bbox2[3] && bbox1[3] > bbox2[1];
  }

  function getSelectedCameraLabel() {
    const device = browserDevices.find(d => d.deviceId === selectedDeviceId);
    return device?.label || '未知摄像头';
  }

  async function handleAlarm(alarmId) {
    try {
      await fetch(`/api/alarms/${alarmId}/handle`, { method: 'PUT' });
      setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, handled: 1 } : a));
      setStats(prev => ({ ...prev, handled: prev.handled + 1 }));
    } catch (e) {
      console.error('处理报警失败:', e);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>控制台</h1>
          <div className="breadcrumb">实时监测 / AI 智能检测</div>
        </div>
        <div className="page-header-actions">
          <select 
            className="select"
            value={selectedDeviceId}
            onChange={e => setSelectedDeviceId(e.target.value)}
            style={{ minWidth: 180 }}
          >
            {browserDevices.map((device, idx) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `摄像头 ${idx + 1}`}
              </option>
            ))}
          </select>
          <button className="btn btn-outline btn-sm" onClick={detectCameras}>🔄 刷新</button>
          {isDetecting ? (
            <button className="btn btn-danger" onClick={stopDetection}>
              ⏹ 停止检测
            </button>
          ) : (
            <button className="btn btn-primary" onClick={startDetection} disabled={!currentStream}>
              🤖 开始检测
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ padding: '16px 24px' }}>
        <div className="stat-card">
          <div className="stat-icon">📹</div>
          <div>
            <div className="stat-value">{browserDevices.length}</div>
            <div className="stat-label">已检测摄像头</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div>
            <div className="stat-value">{stats.todayAlarms}</div>
            <div className="stat-label">今日报警总数</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div>
            <div className="stat-value">{stats.handled}</div>
            <div className="stat-label">已处理报警</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div>
            <div className="stat-value">{isDetecting ? '运行中' : '已停止'}</div>
            <div className="stat-label">检测引擎状态</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 24px' }}>
        <div className="tabs">
          <div className={`tab ${activeTab === 'detection' ? 'active' : ''}`} onClick={() => setActiveTab('detection')}>
            📹 实时检测
          </div>
          <div className={`tab ${activeTab === 'alarms' ? 'active' : ''}`} onClick={() => setActiveTab('alarms')}>
            ⚠️ 报警记录 ({alarms.length})
          </div>
          <div className={`tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
            📊 统计报表
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div style={{ padding: '0 24px 24px' }}>
        {activeTab === 'detection' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
            {/* Video */}
            <div className="section" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="section-header">
                <h3>实时画面 - {getSelectedCameraLabel()}</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isDetecting && <span className="badge badge-warning">🤖 AI 检测中</span>}
                  {currentStream && <span className="badge badge-success">● 直播</span>}
                </div>
              </div>
              <div className="video-container" style={{ height: 750 }}>
                {browserDevices.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>📷</div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>未检测到摄像头</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>请确保摄像头已连接</div>
                    <button className="btn btn-primary" onClick={detectCameras}>
                      重新检测
                    </button>
                  </div>
                ) : !currentStream ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>📹</div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>点击启动摄像头</div>
                    <button className="btn btn-primary" onClick={() => startCamera(selectedDeviceId)}>
                      启动摄像头
                    </button>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <canvas
                      ref={canvasRef}
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* Stats overlay */}
                    <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 8 }}>
                      <span className="badge badge-success">检测: {detections.length}</span>
                      {violations.length > 0 && (
                        <span className="badge badge-danger">违规: {violations.length}</span>
                      )}
                    </div>
                    {/* Legend */}
                    <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 12, fontSize: 11 }}>
                      <span style={{ color: '#10b981' }}>● 正常</span>
                      <span style={{ color: '#ef4444' }}>● 违规</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Detection Panel */}
            <div className="section" style={{ display: 'flex', flexDirection: 'column', height: 790, overflow: 'hidden' }}>
              <div className="section-header">
                <h3>检测结果</h3>
              </div>
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Camera Selection */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    选择摄像头
                  </div>
                  <select
                    className="select"
                    value={selectedDeviceId}
                    onChange={e => setSelectedDeviceId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {browserDevices.length === 0 ? (
                      <option value="">未检测到摄像头</option>
                    ) : (
                      browserDevices.map((device, idx) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `摄像头 ${idx + 1}`}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={detectCameras}
                    style={{ width: '100%', marginTop: 8 }}
                  >
                    🔄 重新检测摄像头
                  </button>
                </div>

                {/* Detection Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 16, background: 'var(--success-bg)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--success)' }}>{detections.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>检测目标</div>
                  </div>
                  <div style={{ padding: 16, background: 'var(--danger-bg)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--danger)' }}>{violations.length}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>违规事件</div>
                  </div>
                </div>

                {/* Recent Alarms */}
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>最新报警</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alarms.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                      <div>暂无报警记录</div>
                    </div>
                  ) : alarms.slice(0, 6).map((alarm, idx) => (
                    <div key={alarm.id || idx} className={`alarm-card ${alarm.handled ? 'handled' : 'unhandled'}`}>
                      <div className="alarm-icon">{alarm.handled ? '✅' : '⚠️'}</div>
                      <div className="alarm-content">
                        <div className="alarm-title">{getViolationText(alarm.violation_type)}</div>
                        <div className="alarm-meta">{alarm.camera_name || '未知摄像头'}</div>
                        <div className="alarm-time">
                          {alarm.timestamp ? new Date(alarm.timestamp * 1000).toLocaleString('zh-CN') : ''}
                        </div>
                      </div>
                      {!alarm.handled && (
                        <button className="btn btn-success btn-sm" onClick={() => handleAlarm(alarm.id)}>
                          处理
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alarms' && (
          <div className="section">
            <div className="section-header">
              <h3>报警记录</h3>
              <span className="badge badge-danger">{alarms.filter(a => !a.handled).length} 未处理</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alarms.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                  <div>暂无报警记录</div>
                </div>
              ) : alarms.map((alarm, idx) => (
                <div key={alarm.id || idx} className={`alarm-card ${alarm.handled ? 'handled' : 'unhandled'}`}>
                  <div className="alarm-icon">{alarm.handled ? '✅' : '⚠️'}</div>
                  <div className="alarm-content">
                    <div className="alarm-title">{getViolationText(alarm.violation_type)}</div>
                    <div className="alarm-meta">
                      <span>{alarm.camera_name || '未知摄像头'}</span>
                      <span style={{ margin: '0 8px' }}>•</span>
                      <span>{alarm.location || ''}</span>
                    </div>
                    <div className="alarm-time">
                      {alarm.timestamp ? new Date(alarm.timestamp * 1000).toLocaleString('zh-CN') : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {alarm.handled ? (
                      <span className="badge badge-success">已处理</span>
                    ) : (
                      <button className="btn btn-success btn-sm" onClick={() => handleAlarm(alarm.id)}>
                        标记处理
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {alarms.length > 0 && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <a href="#/alarms" style={{ color: 'var(--primary)', fontSize: 13 }}>查看全部报警 →</a>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="section">
              <div className="section-header">
                <h3>报警类型分布</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { type: 'no_workwear', label: '未穿指定蓝色工作服', count: alarms.filter(a => a.violation_type === 'no_workwear').length },
                  { type: 'smoking', label: '抽烟', count: alarms.filter(a => a.violation_type === 'smoking').length },
                  { type: 'sleeping', label: '睡岗', count: alarms.filter(a => a.violation_type === 'sleeping').length },
                ].map(item => (
                  <div key={item.type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13 }}>{item.label}</span>
                      <span style={{ fontWeight: 600 }}>{item.count}</span>
                    </div>
                    <div className="progress">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${Math.min(100, (item.count / Math.max(1, alarms.length)) * 100)}%`, background: 'var(--danger)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="section">
              <div className="section-header">
                <h3>处理情况</h3>
              </div>
              <div style={{ textAlign: 'center', padding: 20 }}>
                <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 16px' }}>
                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="var(--bg-dark)" strokeWidth="12" />
                    <circle 
                      cx="50" cy="50" r="40" fill="none" 
                      stroke="var(--success)" strokeWidth="12"
                      strokeDasharray={`${(stats.handled / Math.max(1, stats.todayAlarms)) * 251.2} 251.2`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 700 }}>
                      {stats.todayAlarms > 0 ? Math.round((stats.handled / stats.todayAlarms) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 24, fontSize: 13 }}>
                  <span style={{ color: 'var(--success)' }}>● 已处理: {stats.handled}</span>
                  <span style={{ color: 'var(--danger)' }}>● 未处理: {stats.todayAlarms - stats.handled}</span>
                </div>
              </div>
            </div>
            
            <div className="section">
              <div className="section-header">
                <h3>系统状态</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>检测引擎</span>
                  <span className="badge badge-success">{isDetecting ? '运行中' : '已停止'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>摄像头</span>
                  <span className="badge badge-primary">{browserDevices.length} 个</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>模型状态</span>
                  <span className="badge badge-success">已加载</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>WebSocket</span>
                  <span className="badge badge-success">已连接</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Toast */}
      {showNotification && (
        <div className={`toast toast-${showNotification.type}`}>
          {showNotification.message}
        </div>
      )}
    </>
  );
}
