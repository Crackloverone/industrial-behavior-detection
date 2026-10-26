'use client';

import { useState, useEffect, useRef } from 'react';
import CameraWorkspace from '@/components/CameraWorkspace';
import SingleCameraConsole from '@/components/SingleCameraConsole';
import MultiCameraWall from '@/components/MultiCameraWall';
import { VIOLATION_TYPES, getViolationText, getDetectionLabel } from '@/lib/constants';

// SVG Icons
const Icon = ({ name, size = 20 }) => {
  const icons = {
    dashboard: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    monitor: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
    site: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    alarms: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
    settings: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 0102.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 00919.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
    camera: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 0122z"/><circle cx="12" cy="13" r="4"/></svg>,
    warning: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    check: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    trend: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    refresh: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>,
    play: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
    stop: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
    shield: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    upload: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    delete: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 0122v2"/></svg>,
    folder: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 0122z"/></svg>,
    users: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 0107.75"/></svg>,
    user: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    close: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  };
  return icons[name] || null;
};

const NAV_ITEMS = [
  { id: 'dashboard', label: '控制台', icon: 'dashboard' },
  { id: 'monitor', label: '视频监控', icon: 'monitor' },
  { id: 'cameras', label: '摄像头管理', icon: 'camera' },
  { id: 'site', label: '数据看板', icon: 'site' },
  { id: 'alarms', label: '报警记录', icon: 'alarms' },
  { id: 'employees', label: '员工管理', icon: 'users' },
  { id: 'attendance', label: '考勤管理', icon: 'calendar' },
  { id: 'zones', label: '区域管理', icon: 'shield' },
  { id: 'handover', label: '交接班', icon: 'folder' },
  { id: 'settings', label: '系统设置', icon: 'settings' },
];

export default function Home() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [alarmCount, setAlarmCount] = useState(0);
  const [systemStatus, setSystemStatus] = useState('online');
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [authChecking, setAuthChecking] = useState(true);
  const [alarmSearchTerm, setAlarmSearchTerm] = useState('');

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(result => {
        if (result?.code === 200) {
          setCurrentUser(result.data);
          localStorage.setItem('industrial_vision_user', JSON.stringify(result.data));
        } else {
          localStorage.removeItem('industrial_vision_user');
        }
      })
      .catch(() => localStorage.removeItem('industrial_vision_user'))
      .finally(() => setAuthChecking(false));
    fetchAlarmCount();
    const interval = setInterval(fetchAlarmCount, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogin(username, password) {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.code === 200) {
        const user = data.data.user;
        const token = data.data.token;
        const fullUser = { ...user, token };
        setCurrentUser(fullUser);
        localStorage.setItem('industrial_vision_user', JSON.stringify(fullUser));
        if (token) localStorage.setItem('industrial_vision_token', token);
        setShowLogin(false);
        setLoginError('');
        return true;
      } else {
        setLoginError(data.message || '登录失败');
        return false;
      }
    } catch (e) {
      setLoginError('网络错误');
      return false;
    }
  }

  async function handleRegister(username, password) {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (data.code === 200) {
        return true;
      } else {
        setLoginError(data.message || '注册失败');
        return false;
      }
    } catch (e) {
      setLoginError('网络错误');
      return false;
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setCurrentUser(null);
    localStorage.removeItem('industrial_vision_user');
    localStorage.removeItem('industrial_vision_token');
    setCurrentView('dashboard');
  }

  async function fetchAlarmCount() {
    try {
      const res = await fetch('/api/alarms?limit=100');
      const data = await res.json();
      const unhandled = (data.data || []).filter(a => !a.handled).length;
      setAlarmCount(unhandled);
      setSystemStatus(unhandled > 10 ? 'warning' : 'online');
    } catch {
      setSystemStatus('offline');
    }
  }

  function renderContent() {
    switch (currentView) {
      case 'dashboard': return <SingleCameraConsole />;
      case 'monitor': return <MultiCameraWall />;
      case 'site': return <SiteDashboardView />;
      case 'alarms': return <AlarmsView onNavigate={setCurrentView} currentUser={currentUser} initialEmployeeSearch={alarmSearchTerm} />;
      case 'employees': return <EmployeesView onNavigate={setCurrentView} setAlarmSearchTerm={setAlarmSearchTerm} />;
      case 'attendance': return <AttendanceView onNavigate={setCurrentView} />;
      case 'zones': return <ZonesView onNavigate={setCurrentView} />;
      case 'handover': return <HandoverView onNavigate={setCurrentView} />;
      case 'settings': return <SettingsView />;
      case 'cameras': return <CamerasView />;
      default: return <UnifiedDashboardView onNavigate={setCurrentView} />;
    }
  }

  if (authChecking) {
    return <div className="auth-screen"><div className="empty-state"><div className="spinner"/><p style={{marginTop:12}}>正在验证登录状态...</p></div></div>;
  }

  if (showLogin || !currentUser) {
    return <LoginView
      onLogin={handleLogin}
      onRegister={handleRegister}
      error={loginError}
      onClose={() => setShowLogin(false)}
    />;
  }

  return (
    <div className="main-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon" style={{background:'#1a1a1a',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28}}>
              <span style={{color:'white',fontWeight:700,fontSize:16,fontFamily:'Arial,sans-serif'}}>G</span>
            </div>
            <div>
              <h1>Grok工业视觉行为检测系统</h1>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">监控中心</div>
            {NAV_ITEMS.slice(0, 2).map(item => (
              <a key={item.id} href="#" className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setCurrentView(item.id); }}>
                <span className="nav-item-icon"><Icon name={item.icon} size={18}/></span>
                <span>{item.label}</span>
                {item.id === 'alarms' && alarmCount > 0 && <span className="nav-item-badge">{alarmCount}</span>}
              </a>
            ))}
          </div>
          <div className="nav-section">
            <div className="nav-section-title">系统管理</div>
            {NAV_ITEMS.slice(2).map(item => (
              <a key={item.id} href="#" className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setCurrentView(item.id); }}>
                <span className="nav-item-icon"><Icon name={item.icon} size={18}/></span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </nav>

        <div className="sidebar-footer">
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <div style={{width:28,height:28,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <Icon name="user" size={14}/>
            </div>
            <div style={{flex:1,overflow:'hidden'}}>
              <div style={{fontSize:12,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{currentUser?.username || '未登录'}</div>
              <div style={{fontSize:10,color:'var(--text-muted)'}}>用户</div>
            </div>
            <button className="btn btn-sm btn-outline" onClick={handleLogout} title="退出登录" style={{padding:'2px 6px'}}>
              <Icon name="close" size={12}/>
            </button>
          </div>
          <div className="footer-label">系统状态</div>
          <div className="footer-status-row">
            <span className={`status-dot status-${systemStatus}`}></span>
            <span className="status-text">
              {systemStatus === 'online' ? '运行正常' : systemStatus === 'warning' ? '有告警' : '离线'}
            </span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {renderContent()}
      </main>
    </div>
  );
}

function UnifiedDashboardView({ onNavigate }) {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    handled: 0,
    by_type: {},
    recent_alarms: [],
  });
  const [cameras, setCameras] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
    const interval = setInterval(loadOverview, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadOverview() {
    try {
      const [statsResponse, camerasResponse, healthResponse] = await Promise.all([
        fetch('/api/stats', { cache: 'no-store' }),
        fetch('/api/cameras', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }),
      ]);
      const [statsResult, camerasResult, healthResult] = await Promise.all([
        statsResponse.json(), camerasResponse.json(), healthResponse.json(),
      ]);
      setStats(statsResult.data || {});
      setCameras(camerasResult.data || []);
      setHealth(healthResult || null);
    } catch {
      setHealth({ status: 'offline' });
    } finally {
      setLoading(false);
    }
  }

  const onlineCameras = cameras.filter(camera => camera.status === 'online').length;
  const handlingRate = stats.total ? Math.round((stats.handled || 0) / stats.total * 100) : 0;
  const violationTypes = [
    ['no_workwear', VIOLATION_TYPES.no_workwear],
    ['smoking', VIOLATION_TYPES.smoking],
    ['sleeping', VIOLATION_TYPES.sleeping],
  ];
  const maxViolationCount = Math.max(1, ...violationTypes.map(([type]) => stats.by_type?.[type] || 0));

  function formatAlarmTime(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
  }

  function violationLabel(type) {
    return getViolationText(type);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>控制台</h1>
          <div className="breadcrumb">系统运行概况 · 安全态势总览</div>
        </div>
        <div className="page-header-actions">
          <span className={`badge ${health?.status === 'ok' ? 'badge-success' : 'badge-danger'}`}>
            {health?.status === 'ok' ? '系统运行正常' : '服务连接异常'}
          </span>
          <button className="btn btn-outline btn-sm" onClick={loadOverview} disabled={loading}>
            <Icon name="refresh" size={13}/> {loading ? '刷新中' : '刷新数据'}
          </button>
        </div>
      </div>
      <div className="overview-page">
      <div className="stats-grid overview-stats">
        <div className="stat-card">
          <div className="stat-icon stat-icon-blue"><Icon name="camera" size={22}/></div>
          <div><div className="stat-value">{onlineCameras}/{cameras.length}</div><div className="stat-label">在线摄像头</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-red"><Icon name="warning" size={22}/></div>
          <div><div className="stat-value">{stats.pending || 0}</div><div className="stat-label">近 7 天待处理告警</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-green"><Icon name="check" size={22}/></div>
          <div><div className="stat-value">{handlingRate}%</div><div className="stat-label">告警处理率</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon stat-icon-orange"><Icon name="shield" size={22}/></div>
          <div><div className="stat-value">{health?.behavior_detector ? '3/3' : '0/3'}</div><div className="stat-label">行为模型在线</div></div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="overview-card overview-alerts">
          <div className="overview-card-header">
            <div><h2>近期告警</h2><span>最近产生的安全事件</span></div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('alarms')}>查看全部</button>
          </div>
          <div className="overview-alert-list">
            {(stats.recent_alarms || []).slice(0, 6).map(alarm => (
              <div className="overview-alert-item" key={alarm.id}>
                <span className={`overview-alert-dot ${alarm.handled ? 'handled' : ''}`}></span>
                <div className="overview-alert-main">
                  <strong>{violationLabel(alarm.violation_type)}</strong>
                  <span>{alarm.camera_name || '未知摄像头'}{alarm.employee_name ? ` · ${alarm.employee_name}` : ''}</span>
                </div>
                <div className="overview-alert-meta">
                  <span>{formatAlarmTime(alarm.timestamp)}</span>
                  <em className={alarm.handled ? 'handled' : ''}>{alarm.handled ? '已处理' : '待处理'}</em>
                </div>
              </div>
            ))}
            {!loading && !(stats.recent_alarms || []).length && <div className="overview-empty">暂无告警记录</div>}
          </div>
        </section>

        <div className="overview-side">
          <section className="overview-card">
            <div className="overview-card-header">
              <div><h2>运行状态</h2><span>核心服务与设备状态</span></div>
            </div>
            <div className="overview-status-list">
              <div><span>后端服务</span><strong className={health?.status === 'ok' ? 'online' : 'offline'}>{health?.status === 'ok' ? '正常' : '异常'}</strong></div>
              <div><span>行为检测模型</span><strong className={health?.behavior_detector ? 'online' : 'offline'}>{health?.behavior_detector ? '已加载' : '未加载'}</strong></div>
              <div><span>活动视频流</span><strong>{health?.streams ?? 0} 路</strong></div>
            </div>
            <button className="overview-monitor-button" onClick={() => onNavigate('monitor')}>
              <span><Icon name="monitor" size={17}/>进入视频监控</span><span>→</span>
            </button>
          </section>

          <section className="overview-card">
            <div className="overview-card-header">
              <div><h2>违规类型分布</h2><span>近 7 天告警构成</span></div>
              <strong className="overview-total">{stats.total || 0}</strong>
            </div>
            <div className="overview-bars">
              {violationTypes.map(([type, label]) => {
                const count = stats.by_type?.[type] || 0;
                return <div className="overview-bar-row" key={type}>
                  <div><span>{label}</span><strong>{count}</strong></div>
                  <div className="overview-bar-track"><i style={{width: `${count / maxViolationCount * 100}%`}}></i></div>
                </div>;
              })}
            </div>
          </section>
        </div>
      </div>
      </div>
    </>
  );
}

function CCTVUnit({ cam, onOpen }) {
  const [streamActive, setStreamActive] = useState(false);
  const [streamKey, setStreamKey] = useState(0);
  const [violations, setViolations] = useState([]);
  const [detecting, setDetecting] = useState(false);
  const [detections, setDetections] = useState([]);
  const [camError, setCamError] = useState('');
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const isViolating = violations.length > 0;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function stopCam() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setStreamActive(false);
    setDetecting(false);
    setViolations([]);
    setDetections([]);
  }

  async function startCam() {
    try {
      const r = await fetch(`/api/stream/${cam.id}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (!r.ok || d.code !== 200) throw new Error(d.message || '启动失败');
      setStreamActive(true);
      setStreamKey(k => k + 1);
      setCamError('');
    } catch (err) {
      setCamError(err.message);
    }
  }

  async function stopCamStream() {
    try {
      await fetch(`/api/stream/${cam.id}/stop`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    } catch {}
    stopCam();
  }

  function toggleDetection(e) {
    e.stopPropagation();
    if (detecting) {
      stopDetection();
    } else {
      startDetect();
    }
  }

  function stopDetection() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setDetecting(false);
    setViolations([]);
    setDetections([]);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  function startDetect() {
    if (timerRef.current) return;
    setDetecting(true);
    timerRef.current = setInterval(doDetect, 3000);
  }

  async function doDetect() {
    if (!canvasRef.current) return;
    const img = document.querySelector(`img[alt="${cam.name}"]`);
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const c = canvasRef.current;
    c.width = img.naturalWidth || 640;
    c.height = img.naturalHeight || 480;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', 0.8).split(',')[1];
    try {
      const r = await fetch('/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: data, camera_id: cam.id, camera_name: cam.name }) });
      const d = await r.json();
      if (d.code === 200 && d.data) {
        setDetections(d.data.detections || []);
        setViolations(d.data.violations || []);
        draw(ctx, c.width, c.height, d.data.detections, d.data.violations);
      }
    } catch (err) {
      console.error('[CCTVUnit] detect error:', err);
    }
  }

  function draw(ctx, w, h, detections, violations) {
    ctx.clearRect(0, 0, w, h);
    for (const det of (detections || [])) {
      const bb = det.bbox;
      if (!bb || bb.length !== 4) continue;
      const isPerson = det.class_name === 'person';
      const personViols = isPerson ? (violations || []).filter(v => bboxOvlp(bb, v.person_bbox)) : [];
      const hasViol = Boolean(det.violation) || personViols.length > 0;
      const color = hasViol ? '#ef4444' : '#10b981';
      const label = (det.display_name || getLbl(det.class_name)) + (hasViol ? ' !' : '');
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
      if (label) {
        ctx.fillStyle = color;
        ctx.fillRect(bb[0], bb[1] - 22, ctx.measureText(label).width + 12, 22);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(label, bb[0] + 6, bb[1] - 7);
      }
    }
  }

  function bboxOvlp(a, b) { return a && b && a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
  function getLbl(cn) { return getDetectionLabel(cn); }

  function handleToggle(e) {
    e.stopPropagation();
    if (streamActive) {
      stopCamStream();
    } else {
      startCam();
    }
  }

  return (
    <div className={"cctv-panel " + (isViolating ? 'cctv-violation' : '')} onClick={onOpen}>
      <div className="cctv-panel-header">
        <div className="cctv-cam-name">{cam.name}</div>
        <div className={"cctv-status " + (streamActive ? (isViolating ? 'alarm' : 'live') : 'offline')}>
          {streamActive ? (isViolating ? '! 违规' : '● 正常') : (camError ? '! ' + camError : '○离线')}
        </div>
      </div>
      <div className="cctv-video-area">
        {camError ? (
          <div className="cctv-no-signal">
            <div style={{fontSize:28, marginBottom:8}}>⚠️</div>
            <span>{camError}</span>
          </div>
        ) : streamActive ? (
          <>
            <img key={streamKey} src={`/api/stream/${cam.id}/mjpeg`} alt={cam.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={() => setCamError('视频流断开')}/>
            <canvas ref={canvasRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'cover'}}/>
            {detecting && <div className="cctv-detecting-badge">AI检测中</div>}
            {isViolating && <div className="cctv-alarm-overlay"><div className="cctv-alarm-text">! 检测到违规</div></div>}
          </>
        ) : (
          <div className="cctv-no-signal">
            <div style={{fontSize:32, marginBottom:8}}>📷</div>
            <span>点击打开摄像头</span>
          </div>
        )}
      </div>
      <div className="cctv-panel-footer">
        <div className="cctv-cam-label">{cam.name}</div>
        <div style={{display:'flex',gap:6}} onClick={e => e.stopPropagation()}>
          <button
            className={"btn btn-sm " + (streamActive ? 'btn-danger' : 'btn-success')}
            onClick={handleToggle}
          >
            <Icon name={streamActive ? 'stop' : 'play'} size={12}/>
            {streamActive ? '关闭' : '打开'}
          </button>
          {streamActive && (
            <button
              className={"btn btn-sm " + (detecting ? 'btn-warning' : 'btn-primary')}
              onClick={toggleDetection}
            >
              <Icon name={detecting ? 'stop' : 'play'} size={12}/>
              {detecting ? '停止' : '检测'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function StreamModal({ cam, onClose }) {
  const [detecting, setDetecting] = useState(false);
  const [violations, setViolations] = useState([]);
  const [modelWarning, setModelWarning] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const mounted = useRef(true);

  useEffect(() => {
    startMyCam(cam.deviceId);
    return () => { mounted.current = false; if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    fetch('/api/model/info').then(r => r.json()).then(d => {
      if (d.code === 200 && !d.data.loaded) setModelWarning(true);
    }).catch(() => {});
  }, []);

  async function startMyCam(deviceId) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } }, audio: false });
      if (!mounted.current) { s.getTracks().forEach(t => t.stop()); return; }
      if (videoRef.current) videoRef.current.srcObject = s;
      setDetecting(true);
      timerRef.current = setInterval(doDetect, 3000);
    } catch {}
  }

  async function doDetect() {
    if (!videoRef.current || !canvasRef.current || !mounted.current) return;
    if (videoRef.current.readyState < 2) return;
    const v = videoRef.current, c = canvasRef.current;
    const w = v.videoWidth || 640, h = v.videoHeight || 480;
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(v, 0, 0, w, h);
    const img = c.toDataURL('image/jpeg', 0.4).split(',')[1];
    try {
      const r = await fetch('/api/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: img, camera_id: cam.id }) });
      const d = await r.json();
      if (d.code === 200 && d.data && mounted.current) {
        const viols = d.data.violations || [];
        setViolations(viols);
        drawOverlay(ctx, w, h, d.data.detections || [], viols);
      }
    } catch {}
  }

  function drawOverlay(ctx, w, h, detections, violations) {
    ctx.clearRect(0, 0, w, h);
    for (const det of (detections || [])) {
      const bb = det.bbox; if (!bb || bb.length !== 4) continue;
      const isPerson = det.class_name === 'person';
      const pv = isPerson ? (violations || []).filter(v => bboxOvlp(bb, v.person_bbox)) : [];
      const hv = Boolean(det.violation) || pv.length > 0;
      const color = hv ? '#ef4444' : '#10b981';
      const label = (det.display_name || clsLabel(det.class_name)) + (hv ? ' !' : '');
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(bb[0], bb[1], bb[2]-bb[0], bb[3]-bb[1]);
      if (label) {
        ctx.fillStyle = color;
        ctx.fillRect(bb[0], bb[1]-22, ctx.measureText(label).width+12, 22);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Inter, sans-serif';
        ctx.fillText(label, bb[0]+6, bb[1]-7);
      }
    }
  }

  function bboxOvlp(a, b) { return a && b && a[0]<b[2] && a[2]>b[0] && a[1]<b[3] && a[3]>b[1]; }
  function clsLabel(cn) { return getDetectionLabel(cn); }

  const isViolating = violations.length > 0;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal stream-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>{cam.name}</h3>
            <div style={{marginTop:2}}>{cam.location || (cam.is_usb ? '本地 USB' : 'RTSP 流')}</div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {modelWarning && <span style={{fontSize:12,color:'#f59e0b'}}>⚠ 模型未加载</span>}
            <span style={{fontSize:12,padding:'2px 8px',borderRadius:4,background: detecting ? (isViolating ? '#ef4444' : '#10b981') : '#6b7280', color:'white'}}>
              {detecting ? (isViolating ? '! 检测到违规' : '● AI检测中') : '○ 待机'}
            </span>
            <button className="modal-close" onClick={onClose}><Icon name="close" size={16}/></button>
          </div>
        </div>
        <div style={{display:'flex',gap:16,padding:16}}>
          <div style={{flex:1,position:'relative',background:'#000',borderRadius:8,overflow:'hidden',aspectRatio:'16/9'}}>
            <video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'contain'}}/>
            <canvas ref={canvasRef} style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',objectFit:'contain'}}/>
          </div>
          <div style={{width:180,display:'flex',flexDirection:'column',gap:12}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>检测结果</div>
            <div style={{fontSize:12,display:'flex',flexDirection:'column',gap:8}}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>违规事件</span><span style={{fontWeight:600,color:violations.length>0?'#ef4444':'inherit'}}>{violations.length}</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>无工作服</span><span style={{fontWeight:600}}>{violations.filter(v=>v.violation_type==='no_workwear').length}</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>抽烟</span><span style={{fontWeight:600}}>{violations.filter(v=>v.violation_type==='smoking').length}</span></div>
              <div style={{display:'flex',justifyContent:'space-between'}}><span>睡岗</span><span style={{fontWeight:600}}>{violations.filter(v=>v.violation_type==='sleeping').length}</span></div>
            </div>
            <button className={'btn btn-sm ' + (detecting ? 'btn-danger' : 'btn-primary')} onClick={() => setDetecting(d => !d)} style={{marginTop:'auto'}}>
              <Icon name={detecting ? 'stop' : 'play'} size={13}/> {detecting ? '停止检测' : '开始检测'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Training constants and chart component
// ============================================================
const STATUS_TEXT = { running: '训练中', completed: '已完成', failed: '失败', stopped: '已停止', stopping: '停止中' };
const STATUS_BADGE = { running: 'badge-info', completed: 'badge-success', failed: 'badge-danger', stopped: 'badge-warning', stopping: 'badge-warning' };
const METRIC_LINES = [
  { key: 'train/box_loss', label: 'train box loss', color: '#ef4444', group: 'loss' },
  { key: 'train/cls_loss', label: 'train cls loss', color: '#f59e0b', group: 'loss' },
  { key: 'val/box_loss', label: 'val box loss', color: '#3b82f6', group: 'loss' },
  { key: 'val/cls_loss', label: 'val cls loss', color: '#10b981', group: 'loss' },
  { key: 'metrics/mAP50(B)', label: 'mAP50', color: '#2563eb', group: 'score' },
  { key: 'metrics/mAP50-95(B)', label: 'mAP50-95', color: '#7c3aed', group: 'score' },
  { key: 'metrics/precision(B)', label: 'Precision', color: '#0891b2', group: 'score' },
  { key: 'metrics/recall(B)', label: 'Recall', color: '#16a34a', group: 'score' },
];

function MetricChart({ title, metrics, group }) {
  const width = 680, height = 260, pad = 36;
  const lines = METRIC_LINES.filter(item => item.group === group);
  const pointsByLine = lines.map(line => ({
    ...line,
    points: metrics.filter(row => row[line.key] != null).map(row => ({ epoch: Number(row.epoch), value: Number(row[line.key]) })),
  })).filter(line => line.points.length > 0);
  const values = pointsByLine.flatMap(line => line.points.map(p => p.value));
  const epochs = metrics.map(row => Number(row.epoch)).filter(Boolean);
  const minE = epochs.length ? Math.min(...epochs) : 1, maxE = epochs.length ? Math.max(...epochs) : 1;
  const minV = values.length ? Math.min(...values) : 0, maxV = values.length ? Math.max(...values) : 1;
  const yMin = group === 'score' ? 0 : Math.max(0, minV * 0.9);
  const yMax = group === 'score' ? 1 : maxV * 1.1 || 1;
  const xOf = e => maxE === minE ? pad : pad + ((e - minE) / (maxE - minE)) * (width - pad * 2);
  const yOf = v => yMax === yMin ? height - pad : height - pad - ((v - yMin) / (yMax - yMin)) * (height - pad * 2);
  return (
    <div className="section" style={{ minWidth: 0 }}>
      <div className="section-header"><h3>{title}</h3><span style={{fontSize:12,color:'var(--text-muted)'}}>{metrics.length} epochs</span></div>
      {metrics.length === 0 ? (
        <div style={{height:220,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)'}}>等待训练指标写入</div>
      ) : (<>
        <svg viewBox={`0 0 ${width} ${height}`} style={{width:'100%',height:260,display:'block'}}>
          <line x1={pad} y1={height-pad} x2={width-pad} y2={height-pad} stroke="#cbd5e1"/>
          <line x1={pad} y1={pad} x2={pad} y2={height-pad} stroke="#cbd5e1"/>
          {[0,0.25,0.5,0.75,1].map(t => { const yy=pad+t*(height-pad*2), val=yMax-t*(yMax-yMin); return <g key={t}><line x1={pad} y1={yy} x2={width-pad} y2={yy} stroke="#e2e8f0" strokeDasharray="4 4"/><text x={4} y={yy+4} fontSize="11" fill="#64748b">{val.toFixed(2)}</text></g>; })}
          {pointsByLine.map(l => <polyline key={l.key} points={l.points.map(p=>`${xOf(p.epoch)},${yOf(p.value)}`).join(' ')} fill="none" stroke={l.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>)}
        </svg>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {pointsByLine.map(l => <div key={l.key} style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}><span style={{width:10,height:10,borderRadius:'50%',background:l.color}}/><span>{l.label}</span></div>)}
        </div>
      </>)}
    </div>
  );
}

// ============================================================
// SettingsView - System Settings + Model Management + Training
// ============================================================


function AlarmsView({ onNavigate, currentUser, initialEmployeeSearch }) {
  const [alarms, setAlarms] = useState([]);
  const [filter, setFilter] = useState('all');
  const [employeeSearch, setEmployeeSearch] = useState(initialEmployeeSearch || '');
  const [timePeriod, setTimePeriod] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState('');
  const [imageError, setImageError] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [handleResult, setHandleResult] = useState('confirmed');
  const [handleNote, setHandleNote] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  useEffect(() => { loadAlarms(); }, []);
  useEffect(() => { if (initialEmployeeSearch) { setEmployeeSearch(initialEmployeeSearch); } }, [initialEmployeeSearch]);

  async function loadAlarms() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/alarms?limit=100', { cache: 'no-store' });
      const d = await r.json();
      if (d.code === 200) setAlarms(d.data || []);
      else setError(d.message || '报警记录加载失败');
    } catch (err) {
      setError(err?.message || '报警记录加载失败');
    }
    setLoading(false);
  }

  async function handleAlarm(id) {
    setActionId(id);
    setError('');
    try {
      const response = await fetch('/api/alarms/' + id + '/handle', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: handleResult, note: handleNote }),
      });
      const result = await response.json();
      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || '处理失败');
      }
      setAlarms(prev => prev.map(item => item.id === id ? { ...item, handled: 1 } : item));
      setSelectedAlarm(prev => prev && prev.id === id ? { ...prev, handled: 1, handle_result: handleResult, handle_note: handleNote, handled_by_name: currentUser?.username, handled_at: Date.now()/1000 } : prev);
    } catch (err) {
      setError(err?.message || '处理失败，请检查后端服务');
    } finally {
      setActionId(null);
    }
  }

  async function deleteAlarm(id) {
    if (!confirm('确定删除该记录？')) return;
    setActionId(id);
    setError('');
    try {
      const response = await fetch('/api/alarms/' + id, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || result.code !== 200) {
        throw new Error(result.message || '删除失败');
      }
      setAlarms(prev => prev.filter(item => item.id !== id));
      setSelectedAlarm(prev => prev && prev.id === id ? null : prev);
    } catch (err) {
      setError(err?.message || '删除失败，请检查后端服务');
    } finally {
      setActionId(null);
    }
  }

  const statusFiltered = filter === 'all' ? alarms : filter === 'pending' ? alarms.filter(a => !a.handled) : alarms.filter(a => a.handled);
  const now = Date.now() / 1000;
  const dateFiltered = statusFiltered.filter(a => {
    if (!a.timestamp || timePeriod === 'all') return true;
    const d = a.timestamp;
    if (timePeriod === 'today') return d >= now - 86400;
    if (timePeriod === 'week') return d >= now - 7 * 86400;
    if (timePeriod === 'month') return d >= now - 30 * 86400;
    return true;
  });
  const normalizedEmployeeSearch = employeeSearch.trim().toLocaleLowerCase('zh-CN');
  const searched = normalizedEmployeeSearch
    ? dateFiltered.filter(a => String(a.employee_name || '').toLocaleLowerCase('zh-CN').includes(normalizedEmployeeSearch))
    : dateFiltered;
  const totalPages = Math.ceil(searched.length / PAGE_SIZE);
  const filtered = searched.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const unhandled = alarms.filter(a => !a.handled).length;
  const handled = alarms.filter(a => a.handled).length;
  const byType = alarms.reduce((acc, item) => {
    acc[item.violation_type] = (acc[item.violation_type] || 0) + 1;
    return acc;
  }, {});

  function getLabel(t) {
    return getViolationText(t);
  }

  function getCode(t) {
    const m = { no_workwear:'服', smoking:'烟', sleeping:'睡' };
    return m[t] || '!';
  }

  function getColor(t) {
    const m = {
      no_workwear: '#7c3aed',
      smoking: '#dc2626',
      sleeping: '#2563eb',
    };
    return m[t] || '#64748b';
  }

  function getViolationIcon(t) {
    const m = { no_workwear:'shield', smoking:'warning', sleeping:'user' };
    return m[t] || 'warning';
  }

  function openDetail(alarm) {
    setImageError(false);
    setVideoError(false);
    setHandleResult('confirmed');
    setHandleNote('');
    setSelectedAlarm(alarm);
  }

  function hasEventVideo(alarm) {
    return Boolean(String(alarm?.video_path || '').trim());
  }

  function isRecognized(alarm) {
    return Boolean(alarm.employee_id && alarm.employee_name);
  }

  function getEmployeeSummary(alarm) {
    if (!isRecognized(alarm)) return '未识别员工';
    return [alarm.employee_name, alarm.employee_number].filter(Boolean).join(' · ');
  }

  function formatFaceSimilarity(value) {
    if (value === null || value === undefined || value === '') return '未记录';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric.toFixed(1)}%` : '未记录';
  }

  function EmployeeAvatar({ alarm, size = 52 }) {
    const showPhoto = isRecognized(alarm) && alarm.employee_photo_available;
    return (
      <div className="employee-avatar" style={{width:size,height:size}}>
        {showPhoto && (
          <img
            src={`/api/employees/${alarm.employee_id}/photo`}
            alt={`${alarm.employee_name}档案照`}
            onError={event => {
              event.currentTarget.style.display = 'none';
              if (event.currentTarget.nextElementSibling) event.currentTarget.nextElementSibling.style.display = 'flex';
            }}
          />
        )}
        <span style={{display:showPhoto?'none':'flex'}}><Icon name="user" size={Math.round(size * 0.42)}/></span>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <div><h1>报警记录</h1><div className="breadcrumb">实时监测 · 历史查询</div></div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={loadAlarms}><Icon name="refresh" size={13}/> 刷新</button>
        </div>
      </div>
      <div className="insight-page alarms-page">
        <div className="insight-metrics">
          <div className="insight-metric">
            <div className="insight-metric-top"><span className="insight-metric-label">报警总数</span><span className="metric-chip blue">ALL</span></div>
            <div className="insight-metric-value">{alarms.length}</div>
            <div className="insight-metric-hint">当前列表最近 100 条记录</div>
          </div>
          <div className="insight-metric">
            <div className="insight-metric-top"><span className="insight-metric-label">待处理</span><span className="metric-chip red">待</span></div>
            <div className="insight-metric-value">{unhandled}</div>
            <div className="insight-metric-hint">建议优先处理最新告警</div>
          </div>
          <div className="insight-metric">
            <div className="insight-metric-top"><span className="insight-metric-label">已处理</span><span className="metric-chip green">完</span></div>
            <div className="insight-metric-value">{handled}</div>
            <div className="insight-metric-hint">处理率 {alarms.length ? Math.round(handled / alarms.length * 100) : 0}%</div>
          </div>
          <div className="insight-metric">
            <div className="insight-metric-top"><span className="insight-metric-label">主要类型</span><span className="metric-chip amber">TOP</span></div>
            <div className="insight-metric-value" style={{fontSize:22}}>
              {Object.keys(byType).length ? getLabel(Object.entries(byType).sort((a,b)=>b[1]-a[1])[0][0]) : '--'}
            </div>
            <div className="insight-metric-hint">{Object.keys(byType).length ? `${Object.entries(byType).sort((a,b)=>b[1]-a[1])[0][1]} 条记录` : '暂无类型分布'}</div>
          </div>
        </div>

        <div className="alarm-toolbar">
          <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
            <span style={{fontSize:13,color:'var(--text-muted)',fontWeight:700}}>状态</span>
            {[['all','全部'],['pending','待处理'],['handled','已处理']].map(([k,v]) => (
              <button key={k} className={'filter-btn ' + (filter===k?'active':'')} onClick={()=>{setFilter(k);setCurrentPage(1);}}>{v}</button>
            ))}
            <span style={{fontSize:13,color:'var(--text-muted)',fontWeight:700,marginLeft:8}}>时间</span>
            {[['all','全部'],['today','今日'],['week','本周'],['month','本月']].map(([k,v]) => (
              <button key={k} className={'filter-btn ' + (timePeriod===k?'active':'')} onClick={()=>{setTimePeriod(k);setCurrentPage(1);}}>{v}</button>
            ))}
            <label className="alarm-employee-search">
              <Icon name="user" size={14}/>
              <input
                value={employeeSearch}
                onChange={event => {setEmployeeSearch(event.target.value);setCurrentPage(1);}}
                placeholder="按员工姓名筛选"
                aria-label="按员工姓名筛选报警"
              />
            </label>
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadAlarms} disabled={loading}><Icon name="refresh" size={13}/> {loading ? '刷新中' : '刷新列表'}</button>
        </div>

        {error && <div className="inline-alert">{error}</div>}

        {loading ? <div className="empty-state"><div className="spinner"/><p style={{marginTop:12}}>加载中...</p></div>
         : searched.length === 0 ? <div className="empty-state"><Icon name="check" size={40}/><p style={{marginTop:8}}>暂无报警记录</p></div>
         : (
          <>
          <div className="alarm-list">
            {filtered.map((a, i) => (
              <div key={a.id || i} className={'alarm-row ' + (a.handled ? 'handled' : '')} onClick={() => openDetail(a)}>
                <div className="alarm-type-mark" style={{background:getColor(a.violation_type)}}>
                  <Icon name={getViolationIcon(a.violation_type)} size={15}/>
                  <span>{getCode(a.violation_type)}</span>
                </div>
                <div style={{minWidth:0}}>
                  <div className="alarm-title">{getLabel(a.violation_type)}</div>
                  <div className="alarm-meta">{a.camera_name || '未知摄像头'} · {a.camera_position || a.location || '位置未设置'}</div>
                  <div className={'alarm-employee ' + (isRecognized(a) ? 'recognized' : 'unknown')}>
                    {isRecognized(a) ? `已识别：${getEmployeeSummary(a)}` : '未识别员工'}
                  </div>
                </div>
                <div className="alarm-time">{a.timestamp ? new Date(a.timestamp * 1000).toLocaleString('zh-CN') : '-'}</div>
                <div className="alarm-status-cell">
                  <span className={'badge ' + (a.handled ? 'badge-success' : 'badge-danger')}>{a.handled ? '已处理' : '待处理'}</span>
                  <span className={'badge ' + (hasEventVideo(a) ? 'badge-success' : 'badge-muted')} style={{marginTop:6}}>
                    {hasEventVideo(a) ? '有视频' : '仅截图'}
                  </span>
                </div>
                <div className="alarm-actions" onClick={e => e.stopPropagation()}>
                  {!a.handled && <button className="btn btn-success btn-sm" onClick={() => openDetail(a)} disabled={actionId === a.id}>处理</button>}
                  <button className="btn btn-sm btn-outline" onClick={() => deleteAlarm(a.id)} disabled={actionId === a.id}><Icon name="delete" size={13}/></button>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:6,marginTop:16}}>
              <button className="btn btn-outline btn-sm" disabled={currentPage===1} onClick={()=>setCurrentPage(1)}>首页</button>
              <button className="btn btn-outline btn-sm" disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)}>上一页</button>
              {Array.from({length:totalPages},(_,i)=>i+1).map(p=>(
                <button key={p} className={`btn btn-sm ${p===currentPage?'btn-primary':'btn-outline'}`} onClick={()=>setCurrentPage(p)}>{p}</button>
              ))}
              <button className="btn btn-outline btn-sm" disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)}>下一页</button>
              <button className="btn btn-outline btn-sm" disabled={currentPage===totalPages} onClick={()=>setCurrentPage(totalPages)}>末页</button>
            </div>
          )}
          </>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedAlarm && (
        <div className="modal-overlay" onClick={() => setSelectedAlarm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:620}}>
            <div className="modal-header">
              <h3>报警详情</h3>
              <button className="modal-close" onClick={() => setSelectedAlarm(null)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>

              {/* 报警画面 */}
              <div style={{background:'#0a0e16',borderRadius:8,height:200,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'}}>
                {selectedAlarm.image_path && !imageError ? (
                  <img
                    src={`/api/alarms/${selectedAlarm.id}/image`}
                    alt="报警截图"
                    style={{width:'100%',height:'100%',objectFit:'contain'}}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div style={{textAlign:'center',color:'#475569'}}>
                    <div style={{fontSize:34,marginBottom:8,fontWeight:800,color:getColor(selectedAlarm.violation_type)}}>{getCode(selectedAlarm.violation_type)}</div>
                    <div style={{fontSize:12}}>{imageError ? '报警截图加载失败' : '暂无报警抓拍画面'}</div>
                  </div>
                )}
                <div style={{position:'absolute',top:8,left:8,background:'rgba(239,68,68,0.9)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:4,fontWeight:700}}>
                  {getLabel(selectedAlarm.violation_type)}
                </div>
                <div style={{position:'absolute',top:8,right:8,background: selectedAlarm.handled ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:4,fontWeight:700}}>
                  {selectedAlarm.handled ? '已处理' : '待处理'}
                </div>
              </div>

              {hasEventVideo(selectedAlarm) ? (
                <div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:8}}>违规前2秒 + 后2秒事件视频</div>
                  <video
                    controls
                    preload="metadata"
                    src={`/api/alarms/${selectedAlarm.id}/video`}
                    style={{width:'100%',borderRadius:8,background:'#05080d'}}
                    onError={() => setVideoError(true)}
                  />
                  {videoError && (
                    <div className="inline-alert" style={{marginTop:8}}>
                      事件视频加载失败，请确认后端服务正常，或刷新后重试。
                    </div>
                  )}
                </div>
              ) : (
                <div className="inline-alert">
                  该记录没有事件视频。历史记录或单帧检测报警仅保存截图，后台摄像头流触发的新报警才会保存违规前后视频。
                </div>
              )}

              {/* 摄像头信息 */}
              <div style={{background:'var(--bg)',borderRadius:8,padding:12,display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:40,height:40,borderRadius:8,background:'var(--primary-bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Icon name="camera" size={20}/>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:2}}>{selectedAlarm.camera_name || '未知摄像头'}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>{selectedAlarm.location || '位置未设置'}</div>
                </div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)'}}>摄像头 ID</div>
                  <div style={{fontWeight:600,fontSize:13}}>#{selectedAlarm.camera_id}</div>
                </div>
              </div>

              {/* 违规员工 */}
              <div className={'alarm-employee-card ' + (isRecognized(selectedAlarm) ? 'recognized' : 'unknown')}>
                <EmployeeAvatar alarm={selectedAlarm} size={58}/>
                {isRecognized(selectedAlarm) ? (
                  <>
                    <div className="alarm-employee-card-main">
                      <div className="alarm-employee-card-heading">
                        <strong>{selectedAlarm.employee_name}</strong>
                        <span className="badge badge-success">已识别</span>
                      </div>
                      <div className="alarm-employee-number">{selectedAlarm.employee_number || '工号未记录'}</div>
                      <div className="alarm-employee-profile-meta">
                        {selectedAlarm.employee_department || '部门未设置'} · {selectedAlarm.employee_position || '岗位未设置'}
                      </div>
                      <div className="alarm-face-score">人脸匹配相似度：{formatFaceSimilarity(selectedAlarm.face_similarity)}</div>
                    </div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => { setSelectedAlarm(null); onNavigate?.('employees'); }}
                    >
                      查看员工档案
                    </button>
                  </>
                ) : (
                  <div className="alarm-employee-card-main">
                    <div className="alarm-employee-card-heading"><strong>未识别到已录入员工</strong></div>
                    <div className="alarm-employee-profile-meta">当前报警未关联员工档案，请结合完整报警画面人工确认。</div>
                  </div>
                )}
                <div className="alarm-recognition-notice">识别结果仅供辅助确认</div>
              </div>

              {/* 详细信息 */}
              <div style={{display:'flex',flexDirection:'column',gap:10,fontSize:14}}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:6}}>
                  <span style={{color:'var(--text-muted)'}}>发生时间</span>
                  <span style={{fontWeight:500}}>{selectedAlarm.timestamp ? new Date(selectedAlarm.timestamp * 1000).toLocaleString('zh-CN') : '-'}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:6}}>
                  <span style={{color:'var(--text-muted)'}}>违规类型</span>
                  <span style={{fontWeight:500}}>{getLabel(selectedAlarm.violation_type)}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'8px 12px',background:'var(--bg)',borderRadius:6}}>
                  <span style={{color:'var(--text-muted)'}}>报警类型</span>
                  <span style={{fontWeight:500}}>{selectedAlarm.alarm_type || 'violation'}</span>
                </div>
              </div>

              {/* 操作按钮 */}
              {!selectedAlarm.handled && (
                <div className="alarm-handle-form">
                  <div style={{display:'grid',gridTemplateColumns:'160px 1fr',gap:10}}>
                    <select className="select" value={handleResult} onChange={event => setHandleResult(event.target.value)}>
                      <option value="confirmed">确认违规</option><option value="false_positive">系统误报</option><option value="corrected">已现场纠正</option><option value="other">其他处置</option>
                    </select>
                    <input className="input" value={handleNote} onChange={event => setHandleNote(event.target.value)} placeholder="填写处理意见（可选）" maxLength={500}/>
                  </div>
                  <div style={{display:'flex',gap:8,marginTop:10}}>
                    <button className="btn btn-success" style={{flex:1}} onClick={() => handleAlarm(selectedAlarm.id)} disabled={actionId === selectedAlarm.id}>{actionId === selectedAlarm.id ? '处理中' : '提交处理结果'}</button>
                    <button className="btn btn-outline" onClick={() => { deleteAlarm(selectedAlarm.id); setSelectedAlarm(null); }}><Icon name="delete" size={14}/></button>
                  </div>
                </div>
              )}
              {selectedAlarm.handled && <div className="alarm-handle-summary"><strong>处理结果：{{confirmed:'确认违规',false_positive:'系统误报',corrected:'已现场纠正',other:'其他处置'}[selectedAlarm.handle_result] || '已处理'}</strong><span>处理人：{selectedAlarm.handled_by_name || '未记录'}{selectedAlarm.handled_at ? ` · ${new Date(selectedAlarm.handled_at*1000).toLocaleString('zh-CN')}` : ''}</span>{selectedAlarm.handle_note && <p>{selectedAlarm.handle_note}</p>}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// EmployeesView - 员工管理
// ============================================================
function EmployeesView({ onNavigate, setAlarmSearchTerm }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '', employee_number: '', department: '', position: '', phone: '', email: '', status: 'active'
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [faceFiles, setFaceFiles] = useState([]);
  const [facePreviews, setFacePreviews] = useState([]);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empAlarms, setEmpAlarms] = useState([]);
  const [loadingEmpAlarms, setLoadingEmpAlarms] = useState(false);
  const employeePhotoUrl = (id) => `/api/employees/${id}/photo`;

  useEffect(() => { loadEmployees(); }, []);

  async function loadEmployees() {
    setLoading(true);
    try {
      const r = await fetch('/api/employees');
      const d = await r.json();
      if (d.code === 200) setEmployees(d.data || []);
    } catch {}
    setLoading(false);
  }

  function openAddModal() {
    setEditingEmployee(null);
    setFormData({ name: '', employee_number: '', department: '', position: '', phone: '', email: '', status: 'active' });
    setPhotoPreview(null);
    setPhotoFile(null);
    setFaceFiles([]);
    setFacePreviews([]);
    setShowModal(true);
  }

  function openEditModal(emp) {
    setEditingEmployee(emp);
    setFormData({
      name: emp.name || '',
      employee_number: emp.employee_number || '',
      department: emp.department || '',
      position: emp.position || '',
      phone: emp.phone || '',
      email: emp.email || '',
      status: emp.status || 'active'
    });
    setPhotoPreview(emp.photo_path ? employeePhotoUrl(emp.id) : null);
    setPhotoFile(null);
    setFaceFiles([]);
    setFacePreviews([]);
    setShowModal(true);
    loadFacePhotos(emp.id);
  }

  async function loadFacePhotos(empId) {
    try {
      const r = await fetch(`/api/employees/${empId}/face-photos`);
      const d = await r.json();
      if (d.code === 200 && d.data) {
        setFacePreviews(d.data.map(p => ({ url: p.url, index: p.index, existing: true })));
      }
    } catch {}
  }

  async function openEmpDetail(emp) {
    setSelectedEmp(emp);
    setLoadingEmpAlarms(true);
    setEmpAlarms([]);
    try {
      const r = await fetch(`/api/employees/${emp.id}/alarms`);
      const d = await r.json();
      if (d.code === 200) setEmpAlarms(d.data || []);
    } catch {}
    setLoadingEmpAlarms(false);
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  function setCapturedFace(file) {
    setFaceFiles(prev => [...prev, file]);
    setFacePreviews(prev => [...prev, { url: URL.createObjectURL(file), file, existing: false }]);
    setShowFaceCapture(false);
  }

  function removeFacePhoto(idx) {
    const item = facePreviews[idx];
    if (item.existing && editingEmployee) {
      fetch(`/api/employees/${editingEmployee.id}/face-photos/${item.index}`, { method: 'DELETE' });
    }
    setFacePreviews(prev => prev.filter((_, i) => i !== idx));
    if (!item.existing) {
      setFaceFiles(prev => prev.filter((_, i) => {
        let count = 0;
        for (let j = 0; j <= idx; j++) {
          if (!facePreviews[j].existing) count++;
        }
        return i !== count - 1;
      }));
    }
  }

  async function uploadEmployeePhoto(employeeId, file, type) {
    if (!file) return;
    const form = new FormData();
    form.append('photo', file);
    const stored = JSON.parse(localStorage.getItem('industrial_vision_user') || '{}');
    const token = stored.token || localStorage.getItem('industrial_vision_token') || localStorage.getItem('token') || '';
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const response = await fetch(`/api/employees/${employeeId}/photo?photo_type=${type}`, { method: 'POST', headers, body: form });
    const result = await response.json();
    if (result.code !== 200) throw new Error(result.message || `${type === 'face' ? '人脸照' : '证件照'}录入失败`);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name || !formData.employee_number) {
      alert('请填写姓名和工号');
      return;
    }
    try {
      if (editingEmployee) {
        const updateRes = await fetch(`/api/employees/${editingEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const updateData = await updateRes.json();
        if (updateData.code !== 200) throw new Error(updateData.message || '更新员工失败');
        await uploadEmployeePhoto(editingEmployee.id, photoFile, 'id');
        // 上传新的未上传的人脸照片
        for (const file of faceFiles) {
          await uploadEmployeePhoto(editingEmployee.id, file, 'face');
        }
      } else {
        const r = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const d = await r.json();
        if (d.code !== 200) throw new Error(d.message || '创建员工失败');
        await uploadEmployeePhoto(d.data.id, photoFile, 'id');
        for (const file of faceFiles) {
          await uploadEmployeePhoto(d.data.id, file, 'face');
        }
      }
      setShowModal(false);
    } catch (err) { alert('保存失败: ' + err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('确定删除该员工？')) return;
    try { await fetch(`/api/employees/${id}`, { method: 'DELETE' }); await loadEmployees(); } catch {}
  }

  const activeCount = employees.filter(e => e.status === 'active').length;
  const inactiveCount = employees.filter(e => e.status !== 'active').length;

  return (
    <>
      <div className="page-header">
        <div><h1>员工管理</h1><div className="breadcrumb">员工信息 · 人脸录入</div></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}><Icon name="user" size={14}/> 添加员工</button>
        </div>
      </div>

      <div style={{padding:'16px 24px'}}>
        {/* 统计卡片 */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:16,marginBottom:24}}>
          <div className="stat-card" style={{cursor:'default'}}>
            <div className="stat-icon stat-icon-blue"><Icon name="users" size={22}/></div>
            <div><div className="stat-value">{employees.length}</div><div className="stat-label">员工总数</div></div>
          </div>
          <div className="stat-card" style={{cursor:'default'}}>
            <div className="stat-icon stat-icon-green"><Icon name="check" size={22}/></div>
            <div><div className="stat-value">{activeCount}</div><div className="stat-label">在职员工</div></div>
          </div>
          <div className="stat-card" style={{cursor:'default'}}>
            <div className="stat-icon stat-icon-red"><Icon name="warning" size={22}/></div>
            <div><div className="stat-value">{inactiveCount}</div><div className="stat-label">离职员工</div></div>
          </div>
        </div>

        {/* 员工列表 */}
        {loading ? (
          <div style={{textAlign:'center',padding:60}}><div className="spinner"/><p style={{marginTop:12,color:'var(--text-muted)'}}>加载中...</p></div>
        ) : employees.length === 0 ? (
          <div className="empty-state" style={{padding:60}}>
            <div style={{fontSize:64,marginBottom:16,opacity:0.3}}><Icon name="users" size={64}/></div>
            <p style={{fontSize:16,marginBottom:8,color:'var(--text)'}}>暂无员工信息</p>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>点击右上角「添加员工」开始录入员工信息</p>
            <button className="btn btn-primary" onClick={openAddModal}><Icon name="user" size={14}/> 添加员工</button>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))',gap:20}}>
            {employees.map(emp => (
              <div key={emp.id} className="section" style={{padding:0,overflow:'hidden',borderRadius:12,border:'1px solid var(--border)',transition:'all 0.2s'}} 
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.boxShadow='0 4px 20px rgba(59,130,246,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.boxShadow='none'; }}
              >
                {/* 照片区域 */}
                <div style={{height:120,background:'linear-gradient(135deg, #1e3a5f 0%, #0f1f35100%)',display:'flex',alignItems:'center',justifyContent:'center',position:'relative'}}>
                  <div style={{width:80,height:80,borderRadius:'50%',overflow:'hidden',border:'3px solid rgba(255,255,255,0.2)',background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {emp.photo_path ? (
                      <img src={employeePhotoUrl(emp.id)} alt={emp.name} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e => { e.target.style.display='none'; e.target.nextSibling && (e.target.nextSibling.style.display='flex'); }}/>
                    ) : (
                      <Icon name="user" size={36} style={{opacity:0.5}}/>
                    )}
                  </div>
                  {emp.alarm_count > 0 && (
                    <div style={{position:'absolute',top:8,right:8,minWidth:22,height:22,borderRadius:11,background:'var(--danger)',color:'white',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 6px',boxShadow:'0 2px 6px rgba(239,68,68,0.4)',border:'2px solid white'}}>
                      {emp.alarm_count > 99 ? '99+' : emp.alarm_count}
                    </div>
                  )}
                  <div style={{position:'absolute',top:12,left:12}}>
                    <span className={'badge ' + (emp.status === 'active' ? 'badge-success' : 'badge-danger')} style={{fontSize:11,padding:'3px 10px'}}>
                      {emp.status === 'active' ? '在职' : '离职'}
                    </span>
                  </div>
                </div>

                {/* 信息区域 */}
                <div style={{padding:16}}>
                  <div style={{fontWeight:700,fontSize:17,marginBottom:4,textAlign:'center'}}>{emp.name}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)',textAlign:'center',marginBottom:12}}>工号 {emp.employee_number}</div>
                
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
                      <span style={{color:'var(--text-muted)'}}>部门</span>
                      <span style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.department || '-'}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12}}>
                      <span style={{color:'var(--text-muted)'}}>岗位</span>
                      <span style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.position || '-'}</span>
                    </div>
                  </div>

                  <div style={{display:'flex',gap:6,borderTop:'1px solid var(--border)',paddingTop:12}}>
                    <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={() => openEmpDetail(emp)}><Icon name="site" size={12}/> 详情</button>
                    <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={() => openEditModal(emp)}><Icon name="refresh" size={12}/> 编辑</button>
                    <button className="btn btn-sm btn-outline" onClick={() => handleDelete(emp.id)}><Icon name="delete" size={12}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 弹窗 */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:860,borderRadius:16}}>
            <div className="modal-header" style={{borderBottom:'1px solid var(--border)',padding:'16px 20px'}}>
              <h3 style={{margin:0,fontSize:16}}>{editingEmployee ? '编辑员工信息' : '添加新员工'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="close" size={16}/></button>
            </div>

            <div style={{display:'flex',gap:24,padding:'24px 20px'}}>
              {/* 左侧照片区域 */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,flexShrink:0,width:300}}>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <div style={{width:140,height:160,borderRadius:12,overflow:'hidden',border:'2px dashed var(--border)',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'all 0.2s'}}
                  onClick={() => document.getElementById('photo-input').click()}
                  onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="预览" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  ) : (
                    <div style={{textAlign:'center',color:'var(--text-muted)'}}>
                      <Icon name="upload" size={32}/>
                      <div style={{fontSize:12,marginTop:8}}>点击上传</div>
                      <div style={{fontSize:11,marginTop:4}}>员工证件照</div>
                    </div>
                  )}
                </div>
                <input type="file" id="photo-input" accept="image/*" style={{display:'none'}} onChange={handlePhotoChange}/>
                <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center'}}>仅用于员工档案展示</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <div style={{width:140,height:160,borderRadius:12,overflow:'hidden',border:'2px dashed var(--success)',background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}} onClick={() => document.getElementById('face-photo-input').click()}>
                    {facePreviews.length > 0 ? <img src={facePreviews[facePreviews.length - 1].url} alt="人脸采集照" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{textAlign:'center',color:'var(--text-muted)'}}><Icon name="user" size={32}/><div style={{fontSize:12,marginTop:8}}>人脸采集照</div></div>}
                  </div>
                  <input type="file" id="face-photo-input" accept="image/*" style={{display:'none'}} onChange={event => { const file=event.target.files[0]; if(file) setCapturedFace(file); }}/>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowFaceCapture(true)}><Icon name="camera" size={13}/> 摄像头拍照</button>
                  <div style={{fontSize:11,color:'var(--text-muted)',textAlign:'center'}}>已采集 {facePreviews.length} 张人脸照</div>
                </div>
                {/* 人脸照片列表 */}
                {facePreviews.length > 0 && (
                  <div style={{gridColumn:'1/-1',marginTop:8}}>
                    <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:6}}>人脸照片记录（点击删除）</div>
                    <div style={{display:'flex',gap:8,overflowX: facePreviews.length > 4 ? 'auto' : 'visible',flexWrap: facePreviews.length > 4 ? 'nowrap' : 'wrap',paddingBottom: facePreviews.length > 4 ? 4 : 0}}>
                      {facePreviews.map((item, idx) => (
                        <div key={idx} style={{position:'relative',width:64,height:64,borderRadius:8,overflow:'hidden',border:'1px solid var(--border)',cursor:'pointer',transition:'all 0.15s',flexShrink:0}}
                          onClick={() => { if(confirm('确定删除这张人脸照片？')) removeFacePhoto(idx); }}
                          onMouseEnter={e => e.currentTarget.style.borderColor='var(--danger)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}
                        >
                          <img src={item.url} alt={`face_${idx+1}`} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                          <div style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            <Icon name="close" size={10} style={{color:'white'}}/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧表单 */}
              <form onSubmit={handleSubmit} style={{flex:1,display:'flex',flexDirection:'column',gap:14}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>姓名 <span style={{color:'var(--danger)'}}>*</span></label>
                    <input className="input" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="输入姓名" required style={{fontSize:14}}/>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>工号 <span style={{color:'var(--danger)'}}>*</span></label>
                    <input className="input" value={formData.employee_number} onChange={e => setFormData(p => ({...p, employee_number: e.target.value}))} placeholder="输入工号" required style={{fontSize:14}}/>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>部门</label>
                    <input className="input" value={formData.department} onChange={e => setFormData(p => ({...p, department: e.target.value}))} placeholder="输入部门" style={{fontSize:14}}/>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>岗位</label>
                    <input className="input" value={formData.position} onChange={e => setFormData(p => ({...p, position: e.target.value}))} placeholder="输入岗位" style={{fontSize:14}}/>
                  </div>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>联系电话</label>
                    <input className="input" value={formData.phone} onChange={e => setFormData(p => ({...p, phone: e.target.value}))} placeholder="输入电话" style={{fontSize:14}}/>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>邮箱</label>
                    <input className="input" type="email" value={formData.email} onChange={e => setFormData(p => ({...p, email: e.target.value}))} placeholder="输入邮箱" style={{fontSize:14}}/>
                  </div>
                </div>

                <div className="form-group" style={{margin:0}}>
                  <label style={{fontSize:12,marginBottom:6,display:'block',color:'var(--text-muted)'}}>状态</label>
                  <div style={{display:'flex',gap:12}}>
                    {[['active','在职'],['inactive','离职']].map(([v,label]) => (
                      <label key={v} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 16px',borderRadius:8,border:'1px solid var(--border)',flex:1,justifyContent:'center',background: formData.status === v ? 'var(--primary-bg)' : 'transparent',borderColor: formData.status === v ? 'var(--primary)' : 'var(--border)',transition:'all 0.15s'}}>
                        <input type="radio" checked={formData.status === v} onChange={() => setFormData(p => ({...p, status: v}))} style={{display:'none'}}/>
                        <span style={{fontSize:13,fontWeight: formData.status === v ? 600 : 400}}>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{display:'flex',gap:10,marginTop:8}}>
                  <button type="submit" className="btn btn-primary" style={{flex:1,height:40,fontSize:14}}>
                    <Icon name="check" size={14}/> 保存
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)} style={{height:40,fontSize:14}}>
                    取消
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {showFaceCapture && <FaceCaptureDialog onCapture={setCapturedFace} onClose={() => setShowFaceCapture(false)}/>}

      {/* 员工详情弹窗 */}
      {selectedEmp && (
        <div className="modal-overlay" onClick={() => setSelectedEmp(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:680,maxHeight:'85vh',overflow:'auto'}}>
            <div className="modal-header">
              <h3>员工详情</h3>
              <button className="modal-close" onClick={() => setSelectedEmp(null)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20}}>
              {/* 员工基本信息 */}
              <div style={{display:'flex',gap:16,marginBottom:20,padding:16,background:'var(--bg)',borderRadius:10}}>
                <div style={{width:72,height:72,borderRadius:'50%',overflow:'hidden',border:'2px solid var(--border)',flexShrink:0,background:'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {selectedEmp.photo_path ? (
                    <img src={employeePhotoUrl(selectedEmp.id)} alt={selectedEmp.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  ) : <Icon name="user" size={30} style={{color:'var(--text-muted)'}}/>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{selectedEmp.name}</div>
                  <div style={{fontSize:13,color:'var(--text-muted)',marginBottom:8}}>工号：{selectedEmp.employee_number}</div>
                  <div style={{display:'flex',gap:12,fontSize:13}}>
                    <span>部门：<strong>{selectedEmp.department || '-'}</strong></span>
                    <span>岗位：<strong>{selectedEmp.position || '-'}</strong></span>
                    <span className={'badge ' + (selectedEmp.status === 'active' ? 'badge-success' : 'badge-danger')}>{selectedEmp.status === 'active' ? '在职' : '离职'}</span>
                  </div>
                </div>
                <div style={{textAlign:'right',flexShrink:0}}>
                  <div style={{fontSize:32,fontWeight:800,color: selectedEmp.alarm_count > 0 ? 'var(--danger)' : 'var(--text)'}}>{selectedEmp.alarm_count || 0}</div>
                  <div style={{fontSize:12,color:'var(--text-muted)'}}>违规记录</div>
                </div>
              </div>

              {/* 违规记录 */}
              <div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>违规历史记录</div>
                {loadingEmpAlarms ? (
                  <div style={{textAlign:'center',padding:30}}><div className="spinner"/></div>
                ) : empAlarms.length === 0 ? (
                  <div style={{textAlign:'center',padding:30,color:'var(--text-muted)',fontSize:13}}>暂无违规记录</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {empAlarms.map(alarm => (
                      <div key={alarm.id} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background: alarm.handled ? 'var(--bg)' : '#fef2f2',border:`1px solid ${alarm.handled ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,borderRadius:8,cursor:'pointer',transition:'all 0.15s'}}
                        onMouseEnter={e => e.currentTarget.style.borderColor='var(--primary)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor=alarm.handled ? 'var(--border)' : 'rgba(239,68,68,0.2)'}
                        onClick={() => { setAlarmSearchTerm(selectedEmp.name || ''); setSelectedEmp(null); onNavigate?.('alarms'); }}>
                        <div style={{width:32,height:32,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background: alarm.handled ? 'var(--success-bg)' : 'rgba(239,68,68,0.1)',color: alarm.handled ? 'var(--success)' : 'var(--danger)'}}>
                          <Icon name={alarm.handled ? 'check' : 'warning'} size={14}/>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:600}}>{vl(alarm.violation_type)}</div>
                          <div style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>{alarm.camera_name || '未知摄像头'} · {alarm.timestamp ? new Date(alarm.timestamp * 1000).toLocaleString('zh-CN') : '-'}</div>
                        </div>
                        <div style={{textAlign:'right',flexShrink:0}}>
                          <span className={'badge ' + (alarm.handled ? 'badge-success' : 'badge-danger')} style={{fontSize:11}}>
                            {alarm.handled ? '已处理' : '待处理'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FaceCaptureDialog({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState('');
  const [count, setCount] = useState(0);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => setError(`无法打开摄像头：${err.message}`));
    return () => streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) {
        onCapture(new File([blob], `face_${Date.now()}.jpg`, { type: 'image/jpeg' }));
        setCount(c => c + 1);
      }
    }, 'image/jpeg', 0.9);
  }

  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={event => event.stopPropagation()} style={{maxWidth:720}}>
      <div className="modal-header"><h3>采集员工人脸</h3><button className="modal-close" onClick={onClose}><Icon name="close" size={16}/></button></div>
      <div className="modal-body">
        <div style={{aspectRatio:'16/9',background:'#05080d',borderRadius:10,overflow:'hidden'}}><video ref={videoRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></div>
        <p style={{fontSize:12,color:'var(--text-muted)',marginTop:10}}>请正对镜头，保持光线充足，画面中只保留一人。可多次拍照采集不同角度。</p>
        {error && <div className="inline-alert">{error}</div>}
      </div>
      <div className="modal-footer">
        <span style={{fontSize:12,color:'var(--text-muted)',marginRight:'auto'}}>已拍 {count} 张</span>
        <button className="btn btn-outline" onClick={onClose}>完成</button>
        <button className="btn btn-primary" onClick={capture} disabled={Boolean(error)}><Icon name="camera" size={14}/> 拍照</button>
      </div>
    </div>
  </div>;
}

function SettingsView() {
  const [settings, setSettings] = useState({
    alarmCooldown: 3, detectInterval: 3000, streamQuality: 40,
    confThreshold: 0.5, iouThreshold: 0.45, minFaceSize: 30,
    faceRecThreshold: 0.3, maxTracks: 30,
    dataRetentionDays: 90, auditLogEnabled: true,
    alarmImagePath: 'data/alarm_images/', alarmVideoPath: 'data/alarm_videos/', faceDbPath: 'data/face_database/',
    reportSchedule: 'daily', dashboardLayout: 'grid', emailNotify: false,
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [modelInfo, setModelInfo] = useState({
    name: '--', classes: '--', size: '--', loaded: false,
    behaviorLoaded: false, behaviorModels: []
  });
  const [loading, setLoading] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ faceCount: 0, streamCount: 0, cameraCount: 0 });

  // Training state
  const [trainTargets, setTrainTargets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [trainMessage, setTrainMessage] = useState('');
  const [trainForm, setTrainForm] = useState({
    target: 'sleeping', epochs: 30, batch: 4, imgsz: 640, device: 'cpu', model: ''
  });

  // User management state
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'operator' });

  // Camera management state
  const [cameras, setCameras] = useState([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [newCamera, setNewCamera] = useState({ name: '', rtsp_url: '', location: '' });

  // Active tab state
  const [activeTab, setActiveTab] = useState('params');

  function getAuthHeaders() {
    const stored = JSON.parse(localStorage.getItem('industrial_vision_user') || '{}');
    const token = stored.token || localStorage.getItem('industrial_vision_token') || localStorage.getItem('token') || '';
    return { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) };
  }

  async function handleSave() {
    setSaveError('');
    try {
      const r = await fetch('/api/config', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          alarm_cooldown: settings.alarmCooldown,
          detect_interval: settings.detectInterval,
          stream_quality: settings.streamQuality,
          conf_threshold: settings.confThreshold,
          iou_threshold: settings.iouThreshold,
          min_face_size: settings.minFaceSize,
          face_rec_threshold: settings.faceRecThreshold,
          max_tracks: settings.maxTracks,
          data_retention_days: settings.dataRetentionDays,
          audit_log_enabled: settings.auditLogEnabled,
          alarm_image_path: settings.alarmImagePath,
          alarm_video_path: settings.alarmVideoPath,
          face_db_path: settings.faceDbPath,
          report_schedule: settings.reportSchedule,
          dashboard_layout: settings.dashboardLayout,
          email_notify: settings.emailNotify,
        })
      });
      const d = await r.json();
      if (d.code === 200) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setSaveError(d.message || '保存失败');
      }
    } catch (e) {
      console.error('保存配置失败:', e);
      setSaveError('网络错误，请检查后端服务是否运行');
    }
  }

  function update(key, val) { setSettings(prev => ({...prev, [key]: val })); setSaved(false); }

  useEffect(() => { loadModelInfo(); loadTrainTargets(); loadJobs(); loadUsers(); loadCameras(); loadConfig(); loadSystemStatus(); }, []);
  useEffect(() => {
    const timer = setInterval(() => { loadJobs(); if (selectedJobId) loadJob(selectedJobId); }, 2000);
    return () => clearInterval(timer);
  }, [selectedJobId]);
  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) { setSelectedJobId(jobs[0].id); loadJob(jobs[0].id); }
  }, [jobs, selectedJobId]);

  async function loadConfig() {
    try {
      const r = await fetch('/api/config', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.code === 200 && d.data) {
        setSettings(prev => ({
          ...prev,
          alarmCooldown: d.data.alarm_cooldown ?? prev.alarmCooldown,
          detectInterval: d.data.detect_interval ?? prev.detectInterval,
          streamQuality: d.data.stream_quality ?? prev.streamQuality,
          confThreshold: d.data.conf_threshold ?? prev.confThreshold,
          iouThreshold: d.data.iou_threshold ?? prev.iouThreshold,
          minFaceSize: d.data.min_face_size ?? prev.minFaceSize,
          faceRecThreshold: d.data.face_rec_threshold ?? prev.faceRecThreshold,
          maxTracks: d.data.max_tracks ?? prev.maxTracks,
          dataRetentionDays: d.data.data_retention_days ?? prev.dataRetentionDays,
          auditLogEnabled: d.data.audit_log_enabled ?? prev.auditLogEnabled,
          alarmImagePath: d.data.alarm_image_path ?? prev.alarmImagePath,
          alarmVideoPath: d.data.alarm_video_path ?? prev.alarmVideoPath,
          faceDbPath: d.data.face_db_path ?? prev.faceDbPath,
          reportSchedule: d.data.report_schedule ?? prev.reportSchedule,
          dashboardLayout: d.data.dashboard_layout ?? prev.dashboardLayout,
          emailNotify: d.data.email_notify ?? prev.emailNotify,
        }));
      }
    } catch (e) { console.error('加载配置失败:', e); }
  }

  async function loadSystemStatus() {
    try {
      const [healthR, employeesR] = await Promise.all([
        fetch('/health'),
        fetch('/api/employees', { headers: getAuthHeaders() })
      ]);
      const healthD = await healthR.json();
      const empD = await employeesR.json();
      setSystemStatus({
        faceCount: (empD.data || []).length,
        streamCount: healthD.streams || 0,
        cameraCount: healthD.cameras || 0,
      });
    } catch (e) { console.error('加载系统状态失败:', e); }
  }

  async function loadModelInfo() {
    setLoading(true);
    try {
      const r = await fetch('/api/model/info');
      const d = await r.json();
      if (d.code === 200 && d.data) {
        setModelInfo({
          name: d.data.name || '视觉行为检测',
          classes: (d.data.classes || []).join(', '),
          size: d.data.size || '--',
          loaded: Boolean(d.data.loaded),
          behaviorLoaded: Boolean(d.data.behavior_loaded),
          behaviorModels: d.data.behavior_models || []
        });
      } else {
        setModelInfo(prev => ({...prev, name: '状态获取失败', loaded: false}));
      }
    } catch { setModelInfo(prev => ({...prev, name: '状态获取失败', loaded: false})); }
    setLoading(false);
  }

  async function loadTrainTargets() {
    try { const r = await fetch('/api/training/targets', { headers: getAuthHeaders() }); const d = await r.json(); if (d.code === 200) setTrainTargets(d.data || []); } catch {}
  }
  async function loadJobs() {
    try { const r = await fetch('/api/training/jobs', { headers: getAuthHeaders() }); const d = await r.json(); if (d.code === 200) setJobs(d.data || []); } catch {}
  }
  async function loadJob(id) {
    try { const r = await fetch(`/api/training/jobs/${id}`, { headers: getAuthHeaders() }); const d = await r.json(); if (d.code === 200) setSelectedJob(d.data); } catch {}
  }
  function updateTrainForm(k, v) { setTrainForm(prev => ({...prev, [k]: v})); }

  async function startTraining() {
    setTrainMessage('');
    const payload = { target: trainForm.target, epochs: Number(trainForm.epochs), batch: Number(trainForm.batch), imgsz: Number(trainForm.imgsz), device: trainForm.device || null };
    if (trainForm.model.trim()) payload.model = trainForm.model.trim();
    if (trainForm.target === 'workwear' && !payload.model) payload.model = 'yolov8n.pt';
    try {
      const r = await fetch('/api/training/jobs', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(payload) });
      const d = await r.json();
      if (d.code === 200) { setTrainMessage('训练任务已启动'); setSelectedJobId(d.data); await loadJobs(); await loadJob(d.data); }
      else { setTrainMessage(d.message || '启动训练失败'); }
    } catch { setTrainMessage('启动训练失败'); }
  }

  async function stopTraining(jobId) {
    try {
      const r = await fetch(`/api/training/jobs/${jobId}/stop`, { method: 'POST', headers: getAuthHeaders(), body: '{}' });
      const d = await r.json();
      setTrainMessage(d.message || (d.code === 200 ? '已请求停止' : '停止失败'));
      await loadJobs();
    } catch { setTrainMessage('停止失败'); }
  }

  async function loadUsers() {
    try {
      const r = await fetch('/api/users', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.code === 200) setUsers(d.data || []);
    } catch (e) { console.error('加载用户失败:', e); }
  }

  async function loadCameras() {
    try {
      const r = await fetch('/api/cameras', { headers: getAuthHeaders() });
      const d = await r.json();
      if (d.code === 200) setCameras(d.data || []);
    } catch (e) { console.error('加载摄像头失败:', e); }
  }

  async function createUser() {
    if (!newUser.username || !newUser.password) return;
    try {
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newUser)
      });
      const d = await r.json();
      if (d.code === 200) {
        await loadUsers();
        setShowUserModal(false);
        setNewUser({ username: '', password: '', role: 'operator' });
      }
    } catch (e) { console.error('创建用户失败:', e); }
  }

  async function deleteUser(userId) {
    if (!confirm('确定要删除该用户吗？')) return;
    try {
      await fetch(`/api/users/${userId}`, { method: 'DELETE', headers: getAuthHeaders() });
      await loadUsers();
    } catch (e) { console.error('删除用户失败:', e); }
  }

  async function createCamera() {
    if (!newCamera.name || !newCamera.rtsp_url) return;
    try {
      const r = await fetch('/api/cameras', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...newCamera, status: 'online' })
      });
      const d = await r.json();
      if (d.code === 200) {
        await loadCameras();
        setShowCameraModal(false);
        setNewCamera({ name: '', rtsp_url: '', location: '' });
      }
    } catch (e) { console.error('添加摄像头失败:', e); }
  }

  async function deleteCamera(cameraId) {
    if (!confirm('确定要删除该摄像头吗？')) return;
    try {
      await fetch(`/api/cameras/${cameraId}`, { method: 'DELETE', headers: getAuthHeaders() });
      await loadCameras();
    } catch (e) { console.error('删除摄像头失败:', e); }
  }

  const activeJob = jobs.find(j => ['running', 'stopping'].includes(j.status));
  const currentMetrics = selectedJob?.metrics || [];
  const latestMetric = currentMetrics[currentMetrics.length - 1] || {};
  const progressPct = Math.round((selectedJob?.progress || 0) * 100);

  const tabs = [
    { id: 'params', label: '检测参数', icon: 'settings' },
    { id: 'storage', label: '数据存储与审计', icon: 'folder' },
    { id: 'report', label: '报表与个性化', icon: 'site' },
    { id: 'model', label: '模型管理', icon: 'upload' },
    { id: 'system', label: '系统信息', icon: 'check' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>系统设置</h1><div className="breadcrumb">检测参数 · 数据存储 · 报表个性化 · 模型管理 · 系统信息</div></div>
        <div className="page-header-actions">
          {saveError && <span style={{fontSize:12,color:'#ef4444',marginRight:8}}>{saveError}</span>}
          {saved && <span style={{fontSize:12,color:'#10b981',marginRight:8}}>已保存</span>}
          <button className="btn btn-primary" onClick={handleSave}><Icon name="check" size={14}/> 保存设置</button>
        </div>
      </div>

      <div className="tabs" style={{padding:'0 24px',marginBottom:0}}>
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={14}/> {tab.label}
          </div>
        ))}
      </div>

      <div style={{padding:'20px 24px'}}>
        {/* ===== 检测参数 ===== */}
        {activeTab === 'params' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="section">
              <div className="section-header"><h3>基础检测参数</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
                <div className="form-group">
                  <label>告警冷却时间（秒）</label>
                  <input type="number" min="1" max="60" value={settings.alarmCooldown} onChange={e => update('alarmCooldown', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>同一人触发相同告警的最小间隔</div>
                </div>
                <div className="form-group">
                  <label>检测间隔（毫秒）</label>
                  <input type="number" min="500" max="10000" step="100" value={settings.detectInterval} onChange={e => update('detectInterval', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>每帧检测的间隔，推荐 2000-3000ms</div>
                </div>
                <div className="form-group">
                  <label>视频压缩质量（%）</label>
                  <input type="number" min="10" max="100" value={settings.streamQuality} onChange={e => update('streamQuality', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>推荐 30-50%</div>
                </div>
              </div>
            </div>
            <div className="section">
              <div className="section-header"><h3>PPE 检测参数</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>
                <div className="form-group">
                  <label>置信度阈值</label>
                  <input type="number" min="0.1" max="1.0" step="0.05" value={settings.confThreshold} onChange={e => update('confThreshold', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>检测框置信度，越高越严格</div>
                </div>
                <div className="form-group">
                  <label>IoU 阈值</label>
                  <input type="number" min="0.1" max="1.0" step="0.05" value={settings.iouThreshold} onChange={e => update('iouThreshold', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>非极大值抑制阈值，越低过滤越强</div>
                </div>
                <div className="form-group">
                  <label>最大追踪数</label>
                  <input type="number" min="5" max="100" value={settings.maxTracks} onChange={e => update('maxTracks', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>ByteTrack 同时追踪的目标上限</div>
                </div>
              </div>
            </div>
            <div className="section">
              <div className="section-header"><h3>人脸识别参数</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
                <div className="form-group">
                  <label>人脸检测最小尺寸（px）</label>
                  <input type="number" min="10" max="200" value={settings.minFaceSize} onChange={e => update('minFaceSize', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>过滤过小的误检人脸区域</div>
                </div>
                <div className="form-group">
                  <label>人脸识别匹配阈值</label>
                  <input type="number" min="0.1" max="0.8" step="0.05" value={settings.faceRecThreshold} onChange={e => update('faceRecThreshold', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>余弦相似度阈值，越低越宽容</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 数据存储、合规与审计 ===== */}
        {activeTab === 'storage' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="section">
              <div className="section-header"><h3>数据存储路径</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
                <div className="form-group">
                  <label>报警截图存储路径</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="text" value={settings.alarmImagePath} onChange={e => update('alarmImagePath', e.target.value)} className="input" style={{flex:1}}/>
                    <button className="btn btn-outline btn-sm" style={{flexShrink:0,padding:'8px 12px'}} onClick={async () => {
                      try {
                        if (window.showDirectoryPicker) {
                          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                          update('alarmImagePath', dirHandle.name);
                        } else {
                          const path = prompt('请输入报警截图存储路径', settings.alarmImagePath);
                          if (path !== null) update('alarmImagePath', path);
                        }
                      } catch (e) { if (e.name !== 'AbortError') console.error(e); }
                    }}>选择路径</button>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>报警截图存储目录，相对于项目根目录</div>
                </div>
                <div className="form-group">
                  <label>报警视频存储路径</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="text" value={settings.alarmVideoPath} onChange={e => update('alarmVideoPath', e.target.value)} className="input" style={{flex:1}}/>
                    <button className="btn btn-outline btn-sm" style={{flexShrink:0,padding:'8px 12px'}} onClick={async () => {
                      try {
                        if (window.showDirectoryPicker) {
                          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                          update('alarmVideoPath', dirHandle.name);
                        } else {
                          const path = prompt('请输入报警视频存储路径', settings.alarmVideoPath);
                          if (path !== null) update('alarmVideoPath', path);
                        }
                      } catch (e) { if (e.name !== 'AbortError') console.error(e); }
                    }}>选择路径</button>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>违规前后各2秒事件视频存储目录</div>
                </div>
                <div className="form-group">
                  <label>人脸照片库路径</label>
                  <div style={{display:'flex',gap:8}}>
                    <input type="text" value={settings.faceDbPath} onChange={e => update('faceDbPath', e.target.value)} className="input" style={{flex:1}}/>
                    <button className="btn btn-outline btn-sm" style={{flexShrink:0,padding:'8px 12px'}} onClick={async () => {
                      try {
                        if (window.showDirectoryPicker) {
                          const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                          update('faceDbPath', dirHandle.name);
                        } else {
                          const path = prompt('请输入人脸照片库路径', settings.faceDbPath);
                          if (path !== null) update('faceDbPath', path);
                        }
                      } catch (e) { if (e.name !== 'AbortError') console.error(e); }
                    }}>选择路径</button>
                  </div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>员工人脸注册照片存储目录</div>
                </div>
                <div className="form-group">
                  <label>数据保留天数</label>
                  <input type="number" min="7" max="365" value={settings.dataRetentionDays} onChange={e => update('dataRetentionDays', Number(e.target.value))} className="input"/>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>超过天数的报警记录将自动清理</div>
                </div>
              </div>
            </div>
            <div className="section">
              <div className="section-header"><h3>合规与审计</h3></div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>操作审计日志</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>记录用户登录、配置变更等操作</div></div>
                  <label className="switch"><input type="checkbox" checked={settings.auditLogEnabled} onChange={e => update('auditLogEnabled', e.target.checked)}/><span className="slider"></span></label>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>报警记录自动归档</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>定期将历史报警数据压缩归档</div></div>
                  <label className="switch"><input type="checkbox" checked={true} disabled/><span className="slider"></span></label>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>人脸数据加密存储</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>对注册人脸特征向量加密保护</div></div>
                  <label className="switch"><input type="checkbox" checked={true} disabled/><span className="slider"></span></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 报表与个性化 ===== */}
        {activeTab === 'report' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="section">
              <div className="section-header"><h3>报表设置</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
                <div className="form-group">
                  <label>报表生成周期</label>
                  <select className="select" value={settings.reportSchedule} onChange={e => update('reportSchedule', e.target.value)} style={{width:'100%'}}>
                    <option value="daily">每日</option>
                    <option value="weekly">每周</option>
                    <option value="monthly">每月</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>统计报表自动汇总的周期</div>
                </div>
                <div className="form-group">
                  <label>数据看板默认时间范围</label>
                  <select className="select" value={settings.dashboardLayout} onChange={e => update('dashboardLayout', e.target.value)} style={{width:'100%'}}>
                    <option value="today">今日</option>
                    <option value="week">本周</option>
                    <option value="month">本月</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>进入数据看板时默认展示的时间范围</div>
                </div>
              </div>
            </div>
            <div className="section">
              <div className="section-header"><h3>通知设置</h3></div>
              <div style={{display:'flex',flexDirection:'column',gap:4}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>浏览器通知</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>报警时弹出浏览器桌面通知</div></div>
                  <label className="switch"><input type="checkbox" checked={settings.emailNotify} onChange={e => update('emailNotify', e.target.checked)}/><span className="slider"></span></label>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>声光报警联动</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>违规时触发外接声光报警器</div></div>
                  <label className="switch"><input type="checkbox" checked={true} disabled/><span className="slider"></span></label>
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0'}}>
                  <div><div style={{fontWeight:500,fontSize:14}}>WebSocket 实时推送</div><div style={{fontSize:12,color:'var(--text-muted)',marginTop:2}}>通过 WebSocket 实时推送报警事件</div></div>
                  <label className="switch"><input type="checkbox" checked={true} disabled/><span className="slider"></span></label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== 模型管理 ===== */}
        {activeTab === 'model' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="section">
              <div className="section-header">
                <h3>当前模型信息</h3>
                <button className="btn btn-outline btn-sm" onClick={loadModelInfo} disabled={loading}>
                  <Icon name="refresh" size={13}/> {loading ? '加载中...' : '刷新'}
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16}}>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>模型文件</div>
                  <div style={{fontSize:16,fontWeight:600}}>{modelInfo.name}</div>
                </div>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>检测类别</div>
                  <div style={{fontSize:16,fontWeight:600}}>{modelInfo.classes}</div>
                </div>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>PPE 检测模型</div>
                  <span className={modelInfo.loaded ? 'badge badge-success' : 'badge badge-danger'}>{modelInfo.loaded ? '已加载' : '未加载'}</span>
                </div>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>行为检测模型</div>
                  <span className={modelInfo.behaviorLoaded ? 'badge badge-success' : 'badge badge-danger'}>
                    {modelInfo.behaviorLoaded ? `${modelInfo.behaviorModels.filter(m => m.loaded).length}/${modelInfo.behaviorModels.length} 已加载` : '未加载'}
                  </span>
                </div>
              </div>
              {modelInfo.behaviorModels.length > 0 && (
                <div style={{marginTop:16,padding:16,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>行为模型详情</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {modelInfo.behaviorModels.map(model => (
                      <span key={model.key} className={model.loaded ? 'badge badge-success' : 'badge badge-danger'}>{model.name}: {model.loaded ? '可用' : '不可用'}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="section">
              <div className="section-header"><h3>模型选择与切换</h3></div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:20}}>
                <div className="form-group">
                  <label>PPE 检测模型</label>
                  <select className="select" value={settings.ppeModel || 'yolov8n'} onChange={e => update('ppeModel', e.target.value)} style={{width:'100%'}}>
                    <option value="yolov8n">YOLOv8n（轻量级，速度快）</option>
                    <option value="yolov8s">YOLOv8s（平衡型）</option>
                    <option value="yolov8m">YOLOv8m（高精度）</option>
                    <option value="custom">自定义模型</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>选择 PPE 目标检测模型，切换后需重启生效</div>
                </div>
                <div className="form-group">
                  <label>人脸识别模型</label>
                  <select className="select" value={settings.faceModel || 'sface'} onChange={e => update('faceModel', e.target.value)} style={{width:'100%'}}>
                    <option value="sface">SFace（默认，轻量级）</option>
                    <option value="custom">自定义模型</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>选择人脸特征提取模型</div>
                </div>
                <div className="form-group">
                  <label>行为检测 - 睡岗模型</label>
                  <select className="select" value={settings.sleepModel || 'sleeping'} onChange={e => update('sleepModel', e.target.value)} style={{width:'100%'}}>
                    <option value="sleeping">sleeping.pt（默认）</option>
                    <option value="custom">自定义模型</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>睡岗检测行为模型</div>
                </div>
                <div className="form-group">
                  <label>行为检测 - 工作服模型</label>
                  <select className="select" value={settings.workwearModel || 'workwear'} onChange={e => update('workwearModel', e.target.value)} style={{width:'100%'}}>
                    <option value="workwear">workwear.pt（默认）</option>
                    <option value="custom">自定义模型</option>
                  </select>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>蓝色工作服检测行为模型</div>
                </div>
              </div>
              <div style={{marginTop:16,padding:16,background:'var(--warning-bg)',borderRadius:'var(--radius)',border:'1px solid rgba(245,158,11,0.2)',fontSize:13,color:'#92400e'}}>
                <strong>注意：</strong>模型切换后需重启后端服务才能生效。自定义模型请将 .onnx 或 .pt 文件放入对应 models 目录。
              </div>
            </div>
          </div>
        )}

        {/* ===== 系统信息 ===== */}
        {activeTab === 'system' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="section">
              <div className="section-header">
                <h3>系统概况</h3>
                <button className="btn btn-outline btn-sm" onClick={() => { loadSystemStatus(); loadModelInfo(); loadCameras(); }}>
                  <Icon name="refresh" size={13}/> 刷新
                </button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:16}}>
                <div style={{padding:20,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>系统版本</div>
                  <div style={{fontSize:20,fontWeight:700}}>v1.1.0</div>
                </div>
                <div style={{padding:20,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>检测模型</div>
                  <div style={{fontSize:20,fontWeight:700}}>YOLOv8</div>
                </div>
                <div style={{padding:20,background:'var(--bg)',borderRadius:'var(--radius)'}}>
                  <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:8}}>跟踪算法</div>
                  <div style={{fontSize:20,fontWeight:700}}>ByteTrack</div>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
                <div style={{padding:16,background: modelInfo.loaded ? 'var(--success-bg)' : 'var(--danger-bg)',borderRadius:'var(--radius)',border:`1px solid ${modelInfo.loaded ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>PPE检测</div>
                  <div style={{fontSize:14,fontWeight:700,color: modelInfo.loaded ? 'var(--success)' : 'var(--danger)'}}>{modelInfo.loaded ? '已加载' : '未加载'}</div>
                </div>
                <div style={{padding:16,background: modelInfo.behaviorLoaded ? 'var(--success-bg)' : 'var(--danger-bg)',borderRadius:'var(--radius)',border:`1px solid ${modelInfo.behaviorLoaded ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>行为检测</div>
                  <div style={{fontSize:14,fontWeight:700,color: modelInfo.behaviorLoaded ? 'var(--success)' : 'var(--danger)'}}>{modelInfo.behaviorLoaded ? '已加载' : '未加载'}</div>
                </div>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>注册员工</div>
                  <div style={{fontSize:14,fontWeight:700}}>{systemStatus.faceCount} 人</div>
                </div>
                <div style={{padding:16,background:'var(--bg)',borderRadius:'var(--radius)',border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>在线摄像头</div>
                  <div style={{fontSize:14,fontWeight:700}}>{cameras.filter(c => c.status === 'online').length} / {cameras.length}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加用户</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>用户名</label>
                <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="请输入用户名" />
              </div>
              <div className="form-group">
                <label>密码</label>
                <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="请输入密码" />
              </div>
              <div className="form-group">
                <label>角色</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="select" style={{ width: '100%' }}>
                  <option value="operator">操作员</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowUserModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={createUser}>添加</button>
            </div>
          </div>
        </div>
      )}

      {showCameraModal && (
        <div className="modal-overlay" onClick={() => setShowCameraModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加摄像头</h3>
              <button className="modal-close" onClick={() => setShowCameraModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>摄像头名称</label>
                <input type="text" value={newCamera.name} onChange={e => setNewCamera({ ...newCamera, name: e.target.value })} placeholder="例如：车间A入口" />
              </div>
              <div className="form-group">
                <label>RTSP 地址</label>
                <input type="text" value={newCamera.rtsp_url} onChange={e => setNewCamera({ ...newCamera, rtsp_url: e.target.value })} placeholder="rtsp://192.168.1.100:554/stream" />
              </div>
              <div className="form-group">
                <label>位置描述</label>
                <input type="text" value={newCamera.location} onChange={e => setNewCamera({ ...newCamera, location: e.target.value })} placeholder="例如：1号车间" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCameraModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={createCamera}>添加</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// SiteDashboardView - Site-level Data Dashboard (NEW)
// ============================================================
function SiteDashboardView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  useEffect(() => { loadStats(); }, [period]);

  async function loadStats() {
    setLoading(true);
    const daysMap = { today: 1, week: 7, month: 30 };
    try {
      const r = await fetch('/api/stats?days=' + (daysMap[period] || 7));
      const d = await r.json();
      if (d.code === 200) setStats(d.data);
      else setStats(null);
    } catch { setStats(null); }
    setLoading(false);
  }

  const byType = stats?.by_type || {};
  const totalAlarms = stats?.total || 0;
  const handled = stats?.handled || 0;
  const pending = stats?.pending || 0;
  const noWorkwear = byType.no_workwear || 0;
  const smoking = byType.smoking || 0;
  const sleeping = byType.sleeping || 0;
  const totalCameras = Object.keys(stats?.by_camera || {}).length;
  const handleRate = totalAlarms > 0 ? Math.round(handled / totalAlarms * 100) : 0;
  const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];

  const pieData = [
    { label: '已处理', value: handled, color: '#10b981' },
    { label: '待处理', value: pending, color: '#ef4444' },
  ];
  const pieTotal = handled + pending;
  const pieRadius = 60;
  const pieCircumference = 2 * Math.PI * pieRadius;

  function getPieOffset(index) {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const ratio = pieTotal > 0 ? pieData[i].value / pieTotal : 0;
      offset += ratio * pieCircumference;
    }
    return offset;
  }

  const violationBars = [
    { key: 'no_workwear', label: '未穿指定蓝色工作服', value: noWorkwear, color: '#7c3aed', code: '服' },
    { key: 'smoking', label: '抽烟', value: smoking, color: '#dc2626', code: '烟' },
    { key: 'sleeping', label: '睡岗', value: sleeping, color: '#2563eb', code: '睡' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>数据看板</h1><div className="breadcrumb">站点监测 · 统计分析</div></div>
        <div className="page-header-actions">
          <div className="filter-bar" style={{gap:4}}>
            {[['today','今日'],['week','本周'],['month','本月']].map(([k,v]) => (
              <button key={k} className={'filter-btn ' + (period===k?'active':'')} onClick={()=>setPeriod(k)}>{v}</button>
            ))}
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadStats}><Icon name="refresh" size={13}/> 刷新</button>
        </div>
      </div>
      {loading ? (
        <div style={{padding:40,textAlign:'center'}}><div className="spinner"/><p style={{marginTop:12,color:'var(--text-muted)'}}>加载中...</p></div>
      ) : (
        <div className="insight-page">
          <div className="insight-metrics">
            <div className="insight-metric">
              <div className="insight-metric-top"><span className="insight-metric-label">告警总数</span><span className="metric-chip red">告</span></div>
              <div className="insight-metric-value">{totalAlarms}</div>
              <div className="insight-metric-hint">当前筛选周期内全部告警</div>
            </div>
            <div className="insight-metric">
              <div className="insight-metric-top"><span className="insight-metric-label">待处理</span><span className="metric-chip amber">待</span></div>
              <div className="insight-metric-value">{pending}</div>
              <div className="insight-metric-hint">需要值班人员确认</div>
            </div>
            <div className="insight-metric">
              <div className="insight-metric-top"><span className="insight-metric-label">处理率</span><span className="metric-chip green">率</span></div>
              <div className="insight-metric-value">{handleRate}%</div>
              <div className="insight-metric-hint">{handled} 条已处理</div>
            </div>
            <div className="insight-metric">
              <div className="insight-metric-top"><span className="insight-metric-label">主要类型</span><span className="metric-chip blue">TOP</span></div>
              <div className="insight-metric-value" style={{fontSize:22}}>{topType ? vl(topType[0]) : '--'}</div>
              <div className="insight-metric-hint">{topType ? `${topType[1]} 条记录` : '暂无告警数据'}</div>
            </div>
          </div>

          <div className="insight-grid">
            <div className="insight-panel">
              <div className="insight-panel-header">
                <div>
                  <div className="insight-panel-title">最近告警</div>
                  <div className="insight-panel-subtitle">最新 5 条报警记录</div>
                </div>
              </div>
              {(!stats?.recent_alarms || stats.recent_alarms.length === 0) ? (
                <div className="empty-state"><Icon name="check" size={36}/><p style={{marginTop:8}}>暂无告警记录</p></div>
              ) : (
                <div className="recent-list">
                  {stats.recent_alarms.slice(0,5).map((a,i) => (
                    <div key={a.id||i} className="recent-row">
                      <span className="alarm-type-mark" style={{background:viColor(a.violation_type),width:30,height:30,fontSize:11}}>{vi(a.violation_type)}</span>
                      <span className="recent-title">{vl(a.violation_type)}</span>
                      <span style={{color:'var(--text-muted)',fontSize:12}}>{a.camera_name || '未知摄像头'}</span>
                      <span className={'badge ' + (a.handled ? 'badge-success' : 'badge-danger')}>{a.handled ? '已处理' : '待处理'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="insight-panel">
              <div className="insight-panel-header">
                <div>
                  <div className="insight-panel-title">处理状态</div>
                  <div className="insight-panel-subtitle">待处理与已处理占比</div>
                </div>
              </div>
              <div className="status-donut-wrap">
                <div style={{position:'relative',width:148,height:148,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="148" height="148" style={{transform:'rotate(-90deg)'}}>
                    <circle cx="74" cy="74" r={pieRadius} fill="none" stroke="var(--bg)" strokeWidth="17" />
                    {pieData.map((item, idx) => {
                      const ratio = pieTotal > 0 ? item.value / pieTotal : 0;
                      const dash = ratio * pieCircumference;
                      return (
                        <circle
                          key={item.label}
                          cx="74" cy="74" r={pieRadius}
                          fill="none"
                          stroke={item.color}
                          strokeWidth="17"
                          strokeLinecap="round"
                          strokeDasharray={`${dash} ${pieCircumference - dash}`}
                          strokeDashoffset={-getPieOffset(idx)}
                        />
                      );
                    })}
                  </svg>
                  <div style={{position:'absolute',textAlign:'center'}}>
                    <div style={{fontSize:26,fontWeight:900,color:'var(--text)'}}>{pieTotal}</div>
                    <div style={{fontSize:12,color:'var(--text-muted)'}}>总记录</div>
                  </div>
                </div>
                <div className="status-legend">
                  <div className="legend-card"><div className="legend-label">已处理</div><div className="legend-value">{handled}</div></div>
                  <div className="legend-card"><div className="legend-label">待处理</div><div className="legend-value">{pending}</div></div>
                </div>
              </div>
            </div>
          </div>

          <div className="insight-grid" style={{marginTop:16}}>
            <div className="insight-panel">
              <div className="insight-panel-header">
                <div>
                  <div className="insight-panel-title">违规类型分布</div>
                  <div className="insight-panel-subtitle">按当前周期统计各类违规次数</div>
                </div>
              </div>
              <div className="bar-list">
                {violationBars.map(bar => (
                  <div className="bar-row" key={bar.key}>
                    <div className="bar-label"><span className="bar-code" style={{background:bar.color}}>{bar.code}</span><span>{bar.label}</span></div>
                    <div className="bar-track"><div className="bar-fill" style={{background:bar.color,width:(totalAlarms > 0 ? bar.value / totalAlarms * 100 : 0) + '%'}} /></div>
                    <div className="bar-value">{bar.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="insight-panel">
              <div className="insight-panel-header">
                <div>
                  <div className="insight-panel-title">摄像头告警排行</div>
                  <div className="insight-panel-subtitle">按告警次数排序</div>
                </div>
                <span className="metric-chip blue">{totalCameras}</span>
              </div>
              <div className="rank-list">
                {Object.entries(stats?.by_camera || {}).length === 0 ? (
                  <div style={{textAlign:'center',color:'var(--text-muted)',fontSize:13,padding:20}}>暂无数据</div>
                ) : (
                  Object.entries(stats.by_camera)
                    .map(([cam, info]) => ({ cam, count: typeof info === 'object' ? (info.count || 0) : (info || 0), name: typeof info === 'object' ? (info.name || cam) : cam, position: typeof info === 'object' ? (info.position || '') : '' }))
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 5)
                    .map((item, idx) => (
                      <div key={item.cam} className="rank-row">
                        <span className="rank-index">{idx+1}</span>
                        <span className="rank-name">{item.name}{item.position ? ` · ${item.position}` : ''}</span>
                        <span className="rank-count">{item.count}</span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// LoginView - 登录/注册
// ============================================================
function LoginView({ onLogin, onRegister, error, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password) {
      setLocalError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    setLocalError('');
    
    let success;
    if (isLogin) {
      success = await onLogin(username, password);
    } else {
      success = await onRegister(username, password);
      if (success) {
        success = await onLogin(username, password);
      }
    }
    
    setLoading(false);
    if (!success && !localError) {
      setLocalError(error || '操作失败');
    }
  }

  return (
    <div style={{
      minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#fafafa',padding:20
    }}>
      <div style={{width:'100%',maxWidth:400}}>
        {/* Logo区域 */}
        <div style={{textAlign:'center',marginBottom:32}}>
          <div style={{
            width:64,height:64,borderRadius:12,
            background:'#1a1a1a',
            display:'flex',alignItems:'center',justifyContent:'center',
            margin:'0 auto 16px'
          }}>
            <span style={{color:'white',fontWeight:700,fontSize:32,fontFamily:'Arial,sans-serif'}}>G</span>
          </div>
          <h1 style={{fontSize:22,fontWeight:700,marginBottom:6,color:'#1a1a1a',letterSpacing:0}}>Grok工业视觉行为检测系统</h1>
          <p style={{fontSize:13,color:'#666',margin:0}}>{isLogin ? '欢迎回来，请登录您的账户' : '创建账户开始使用'}</p>
        </div>

        {/* 表单卡片 */}
        <div style={{
          background:'#fff',borderRadius:12,border:'1px solid #e5e5e5',
          padding:28,boxShadow:'0 4px 20px rgba(0,0,0,0.08)'
        }}>
          {/* Tab切换 */}
          <div style={{
            display:'flex',gap:4,padding:4,marginBottom:24,background:'#f5f5f5',borderRadius:8
          }}>
            <button
              onClick={() => { setIsLogin(true); setLocalError(''); }}
              style={{
                flex:1,padding:'10px 16px',borderRadius:6,
                border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
                transition:'all 0.2s',
                background: isLogin ? '#fff' : 'transparent',
                color: isLogin ? '#1a1a1a' : '#999',
                boxShadow: isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              登录
            </button>
            <button
              onClick={() => { setIsLogin(false); setLocalError(''); }}
              style={{
                flex:1,padding:'10px 16px',borderRadius:6,
                border:'none',cursor:'pointer',fontSize:13,fontWeight:600,
                transition:'all 0.2s',
                background: !isLogin ? '#fff' : 'transparent',
                color: !isLogin ? '#1a1a1a' : '#999',
                boxShadow: !isLogin ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:16}}>
            {/* 防止浏览器自动填充的隐藏字段 */}
            <input type="text" name="fake_username" autoComplete="username" style={{position:'absolute',left:'-9999px',opacity:0}} tabIndex={-1}/>
            <input type="password" name="fake_password" autoComplete="current-password" style={{position:'absolute',left:'-9999px',opacity:0}} tabIndex={-1}/>
            {/* 用户名 */}
            <div>
              <label style={{fontSize:13,fontWeight:500,color:'#333',marginBottom:6,display:'block'}}>用户名</label>
              <input
                className="input"
                autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="请输入用户名"
                style={{fontSize:14,height:44,width:'100%',boxSizing:'border-box',borderRadius:8,border:'1px solid #ddd',padding:'0 12px'}}
              />
            </div>

            {/* 密码 */}
            <div>
              <label style={{fontSize:13,fontWeight:500,color:'#333',marginBottom:6,display:'block'}}>密码</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码"
                style={{fontSize:14,height:44,width:'100%',boxSizing:'border-box',borderRadius:8,border:'1px solid #ddd',padding:'0 12px'}}
              />
            </div>

            {/* 错误提示 */}
            {(localError || error) && (
              <div style={{
                padding:'10px 12px',borderRadius:8,fontSize:13,
                background:'#fef2f2',border:'1px solid #fecaca',
                color:'#dc2626'
              }}>
                {localError || error}
              </div>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                width:'100%',height:44,fontSize:14,borderRadius:8,marginTop:4,
                cursor:'pointer',fontWeight:600,
                border:'1.5px solid #1a1a1a',
                background:'#1a1a1a',color:'#fff',
                transition:'all 0.2s'
              }}
            >
              {loading ? '处理中...' : isLogin ? '登录' : '注册'}
            </button>
          </form>
        </div>

        <div style={{marginTop:20,textAlign:'center',fontSize:13,color:'#999'}}>
          {isLogin ? '还没有账户？' : '已有账户？'}
          <button onClick={() => { setIsLogin(!isLogin); setLocalError(''); }} style={{color:'#1a1a1a',marginLeft:4,background:'none',border:'none',cursor:'pointer',fontSize:13,fontWeight:600}}>
            {isLogin ? '立即注册' : '去登录'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CamerasView - 摄像头管理
// ============================================================
function CamerasView() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCam, setEditingCam] = useState(null);
  const [formData, setFormData] = useState({ name: '', rtsp_url: '', location: '', position: '', status: 'offline', is_usb: false });

  useEffect(() => { loadCameras(); }, []);

  async function loadCameras() {
    setLoading(true);
    try {
      const r = await fetch('/api/cameras');
      const d = await r.json();
      if (d.code === 200) setCameras(d.data || []);
    } catch {}
    setLoading(false);
  }

  function openAddModal() {
    setEditingCam(null);
    setFormData({ name: '', rtsp_url: '', location: '', position: '', status: 'offline', is_usb: false });
    setShowModal(true);
  }

  function openEditModal(cam) {
    setEditingCam(cam);
    setFormData({
      name: cam.name || '',
      rtsp_url: cam.rtsp_url || '',
      location: cam.location || '',
      position: cam.position || '',
      status: cam.status || 'offline',
      is_usb: !!cam.is_usb
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name) { alert('请输入摄像头名称'); return; }
    try {
      if (editingCam) {
        await fetch(`/api/cameras/${editingCam.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else {
        await fetch('/api/cameras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }
      setShowModal(false);
      await loadCameras();
    } catch (err) { alert('保存失败: ' + err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('确定删除该摄像头？')) return;
    try { await fetch(`/api/cameras/${id}`, { method: 'DELETE' }); await loadCameras(); } catch {}
  }

  return (
    <>
      <div className="page-header">
        <div><h1>摄像头管理</h1><div className="breadcrumb">设备管理 · 摄像头配置</div></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAddModal}><Icon name="camera" size={14}/> 添加摄像头</button>
        </div>
      </div>
      <div style={{padding:'16px 24px'}}>
        {loading ? (
          <div style={{textAlign:'center',padding:60}}><div className="spinner"/><p style={{marginTop:12,color:'var(--text-muted)'}}>加载中...</p></div>
        ) : cameras.length === 0 ? (
          <div className="empty-state" style={{padding:60}}>
            <div style={{fontSize:64,marginBottom:16,opacity:0.3}}><Icon name="camera" size={64}/></div>
            <p style={{fontSize:16,marginBottom:8}}>暂无摄像头</p>
            <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>点击右上角「添加摄像头」开始配置</p>
            <button className="btn btn-primary" onClick={openAddModal}><Icon name="camera" size={14}/> 添加摄像头</button>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',gap:16}}>
            {cameras.map(cam => (
              <div key={cam.id} className="section" style={{padding:16}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div style={{fontWeight:700,fontSize:15}}>{cam.name}</div>
                  <span className={'badge ' + (cam.status === 'online' ? 'badge-success' : 'badge-danger')}>
                    {cam.status === 'online' ? '在线' : '离线'}
                  </span>
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                  <Icon name="folder" size={12}/> {cam.location || '未设置位置'}
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                  <Icon name="users" size={12}/> 岗位：{cam.position || '未知'}
                </div>
                <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>
                  类型: {cam.is_usb ? 'USB摄像头' : 'RTSP流'}
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-outline btn-sm" style={{flex:1}} onClick={() => openEditModal(cam)}>编辑</button>
                  <button className="btn btn-sm btn-outline" onClick={() => handleDelete(cam.id)}><Icon name="delete" size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div className="modal-header">
              <h3>{editingCam ? '编辑摄像头' : '添加摄像头'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <form onSubmit={handleSubmit} style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div className="form-group">
                <label>摄像头名称 *</label>
                <input className="input" value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="例如：车间A入口" required/>
              </div>
              <div className="form-group">
                <label>类型</label>
                <div style={{display:'flex',gap:12}}>
                  <label style={{flex:1,display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background: formData.is_usb ? 'var(--primary-bg)' : 'transparent',borderColor: formData.is_usb ? 'var(--primary)' : 'var(--border)'}}>
                    <input type="radio" checked={formData.is_usb} onChange={() => setFormData(p => ({...p, is_usb: true}))} style={{display:'none'}}/>
                    <span style={{fontSize:13}}>USB摄像头</span>
                  </label>
                  <label style={{flex:1,display:'flex',alignItems:'center',gap:8,cursor:'pointer',padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background: !formData.is_usb ? 'var(--primary-bg)' : 'transparent',borderColor: !formData.is_usb ? 'var(--primary)' : 'var(--border)'}}>
                    <input type="radio" checked={!formData.is_usb} onChange={() => setFormData(p => ({...p, is_usb: false}))} style={{display:'none'}}/>
                    <span style={{fontSize:13}}>RTSP流</span>
                  </label>
                </div>
              </div>
              {!formData.is_usb && (
                <div className="form-group">
                  <label>RTSP 地址</label>
                  <input className="input" value={formData.rtsp_url} onChange={e => setFormData(p => ({...p, rtsp_url: e.target.value}))} placeholder="rtsp://192.168.1.100/stream"/>
                </div>
              )}
              <div className="form-group">
                <label>位置</label>
                <input className="input" value={formData.location} onChange={e => setFormData(p => ({...p, location: e.target.value}))} placeholder="例如：1号车间"/>
              </div>
              <div className="form-group">
                <label>岗位</label>
                <input className="input" value={formData.position} onChange={e => setFormData(p => ({...p, position: e.target.value}))} placeholder="例如：生产线A"/>
              </div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button type="submit" className="btn btn-primary" style={{flex:1}}>保存</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>取消</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function vl(t) { return getViolationText(t); }
function vi(t) { const m = { no_workwear:'服', smoking:'烟', sleeping:'睡' }; return m[t] || '!'; }
function viColor(t) {
  const m = { no_workwear:'#7c3aed', smoking:'#dc2626', sleeping:'#2563eb' };
  return m[t] || '#64748b';
}

// ============================================================
// ZonesView - 区域管理
// ============================================================
function ZonesView({ onNavigate }) {
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('zones');
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    description: '',
    zone_type: 'danger',
    points: '[]',
    camera_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [zonesRes, alertsRes, employeesRes, camerasRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/zones/alerts?limit=100'),
        fetch('/api/employees'),
        fetch('/api/cameras')
      ]);
      
      const [zonesData, alertsData, employeesData, camerasData] = await Promise.all([
        zonesRes.json(),
        alertsRes.json(),
        employeesRes.json(),
        camerasRes.json()
      ]);
      
      if (zonesData.code === 200) setZones(zonesData.data || []);
      if (alertsData.code === 200) setAlerts(alertsData.data || []);
      if (employeesData.code === 200) setEmployees(employeesData.data || []);
      if (camerasData.code === 200) setCameras(camerasData.data || []);
    } catch (err) {
      setError(err?.message || '加载数据失败');
    }
    setLoading(false);
  }

  async function handleCreateZone() {
    if (!zoneForm.name) {
      setError('区域名称不能为空');
      return;
    }
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowZoneModal(false);
        setZoneForm({ name: '', description: '', zone_type: 'danger', points: '[]', camera_id: '' });
        loadData();
      } else {
        setError(data.message || '创建区域失败');
      }
    } catch (err) {
      setError(err?.message || '创建区域失败');
    }
  }

  async function handleUpdateZone() {
    if (!editingZone) return;
    try {
      const res = await fetch(`/api/zones/${editingZone.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zoneForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowZoneModal(false);
        setEditingZone(null);
        setZoneForm({ name: '', description: '', zone_type: 'danger', points: '[]', camera_id: '' });
        loadData();
      } else {
        setError(data.message || '更新区域失败');
      }
    } catch (err) {
      setError(err?.message || '更新区域失败');
    }
  }

  async function handleDeleteZone(zoneId) {
    if (!confirm('确定要删除该区域吗？')) return;
    try {
      await fetch(`/api/zones/${zoneId}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      setError(err?.message || '删除区域失败');
    }
  }

  async function handleToggleZone(zoneId) {
    try {
      await fetch(`/api/zones/${zoneId}/toggle`, { method: 'POST' });
      loadData();
    } catch (err) {
      setError(err?.message || '切换区域状态失败');
    }
  }

  async function handleDeleteAlert(alertId) {
    if (!confirm('确定要删除该告警记录吗？')) return;
    try {
      await fetch(`/api/zones/alerts/${alertId}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      setError(err?.message || '删除告警记录失败');
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  function getZoneTypeLabel(type) {
    const types = {
      danger: '危险区域',
      restricted: '限制区域',
      warning: '警告区域',
      safe: '安全区域'
    };
    return types[type] || type;
  }

  function getZoneTypeColor(type) {
    const colors = {
      danger: '#ef4444',
      restricted: '#f59e0b',
      warning: '#3b82f6',
      safe: '#10b981'
    };
    return colors[type] || '#64748b';
  }

  function openEditZone(zone) {
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      description: zone.description || '',
      zone_type: zone.zone_type || 'danger',
      points: zone.points || '[]',
      camera_id: zone.camera_id || ''
    });
    setShowZoneModal(true);
  }

  const tabs = [
    { id: 'zones', label: '区域列表', icon: 'shield' },
    { id: 'alerts', label: '告警记录', icon: 'alarms' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>区域管理</h1><div className="breadcrumb">区域配置 · 入侵检测 · 告警记录</div></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setEditingZone(null); setZoneForm({ name: '', description: '', zone_type: 'danger', points: '[]', camera_id: '' }); setShowZoneModal(true); }}><Icon name="shield" size={14}/> 新建区域</button>
        </div>
      </div>

      <div className="tabs" style={{padding:'0 24px',marginBottom:0}}>
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={14}/> {tab.label}
          </div>
        ))}
      </div>

      <div style={{padding:'20px 24px'}}>
        {error && <div className="inline-alert" style={{marginBottom:16}}>{error}<button onClick={() => setError('')} style={{marginLeft:8}}>&times;</button></div>}

        {loading ? (
          <div className="empty-state"><div className="spinner"/><p style={{marginTop:12}}>加载中...</p></div>
        ) : (
          <>
            {/* 区域列表 */}
            {activeTab === 'zones' && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',gap:16}}>
                {zones.map(zone => (
                  <div key={zone.id} className="section" style={{padding:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                      <div>
                        <div style={{fontWeight:700,fontSize:15}}>{zone.name}</div>
                        <div style={{fontSize:12,color:'var(--text-muted)',marginTop:4}}>{zone.description || '无描述'}</div>
                      </div>
                      <span className={`badge ${zone.is_active ? 'badge-success' : 'badge-muted'}`}>
                        {zone.is_active ? '启用中' : '已禁用'}
                      </span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:getZoneTypeColor(zone.zone_type)}}/>
                      <span style={{fontSize:12,color:'var(--text-muted)'}}>{getZoneTypeLabel(zone.zone_type)}</span>
                    </div>
                    <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>
                      关联摄像头：{cameras.find(c => c.id === zone.camera_id)?.name || '未关联'}
                    </div>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-sm btn-outline" onClick={() => handleToggleZone(zone.id)}>
                        {zone.is_active ? '禁用' : '启用'}
                      </button>
                      <button className="btn btn-sm btn-outline" onClick={() => openEditZone(zone)}>编辑</button>
                      <button className="btn btn-sm btn-outline" onClick={() => handleDeleteZone(zone.id)}>删除</button>
                    </div>
                  </div>
                ))}
                {zones.length === 0 && (
                  <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'var(--text-muted)'}}>暂无区域配置</div>
                )}
              </div>
            )}

            {/* 告警记录 */}
            {activeTab === 'alerts' && (
              <div className="section">
                <div className="section-header">
                  <h3>区域告警记录</h3>
                  <button className="btn btn-outline btn-sm" onClick={loadData}><Icon name="refresh" size={13}/> 刷新</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid var(--border)'}}>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>区域</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>员工</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>告警类型</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>时间</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alerts.map(alert => (
                        <tr key={alert.id} style={{borderBottom:'1px solid var(--border)'}}>
                          <td style={{padding:'10px 12px'}}>{alert.zone_name || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{alert.employee_name || '未识别'} {alert.employee_number ? `(${alert.employee_number})` : ''}</td>
                          <td style={{padding:'10px 12px'}}>
                            <span style={{color:getZoneTypeColor(alert.zone_type)}}>{alert.alert_type === 'invasion' ? '入侵' : alert.alert_type}</span>
                          </td>
                          <td style={{padding:'10px 12px'}}>{formatDate(alert.timestamp)}</td>
                          <td style={{padding:'10px 12px'}}>
                            <button className="btn btn-sm btn-outline" onClick={() => handleDeleteAlert(alert.id)}>删除</button>
                          </td>
                        </tr>
                      ))}
                      {alerts.length === 0 && (
                        <tr><td colSpan={5} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>暂无告警记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 区域编辑弹窗 */}
      {showZoneModal && (
        <div className="modal-overlay" onClick={() => setShowZoneModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header">
              <h3>{editingZone ? '编辑区域' : '新建区域'}</h3>
              <button className="modal-close" onClick={() => setShowZoneModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div className="form-group">
                <label>区域名称</label>
                <input className="input" value={zoneForm.name} onChange={e => setZoneForm(p => ({...p, name: e.target.value}))} placeholder="例如：危险区域A"/>
              </div>
              <div className="form-group">
                <label>区域描述</label>
                <textarea className="input" rows={2} value={zoneForm.description} onChange={e => setZoneForm(p => ({...p, description: e.target.value}))} placeholder="请输入区域描述"/>
              </div>
              <div className="form-group">
                <label>区域类型</label>
                <select className="input" value={zoneForm.zone_type} onChange={e => setZoneForm(p => ({...p, zone_type: e.target.value}))}>
                  <option value="danger">危险区域</option>
                  <option value="restricted">限制区域</option>
                  <option value="warning">警告区域</option>
                  <option value="safe">安全区域</option>
                </select>
              </div>
              <div className="form-group">
                <label>关联摄像头</label>
                <select className="input" value={zoneForm.camera_id} onChange={e => setZoneForm(p => ({...p, camera_id: e.target.value}))}>
                  <option value="">请选择摄像头</option>
                  {cameras.map(cam => (
                    <option key={cam.id} value={cam.id}>{cam.name}</option>
                  ))}
                </select>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={editingZone ? handleUpdateZone : handleCreateZone}>
                  {editingZone ? '保存修改' : '创建区域'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowZoneModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// HandoverView - 交接班管理
// ============================================================
function HandoverView({ onNavigate }) {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('records');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [recordForm, setRecordForm] = useState({
    outgoing_employee_id: '',
    incoming_employee_id: '',
    shift: 'day',
    equipment_status: '',
    safety_notes: '',
    production_notes: '',
    other_notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [recordsRes, employeesRes] = await Promise.all([
        fetch('/api/handover/records?limit=100'),
        fetch('/api/employees')
      ]);
      
      const [recordsData, employeesData] = await Promise.all([
        recordsRes.json(),
        employeesRes.json()
      ]);
      
      if (recordsData.code === 200) setRecords(recordsData.data || []);
      if (employeesData.code === 200) setEmployees(employeesData.data || []);
    } catch (err) {
      setError(err?.message || '加载数据失败');
    }
    setLoading(false);
  }

  async function handleCreateRecord() {
    if (!recordForm.outgoing_employee_id || !recordForm.incoming_employee_id) {
      setError('请选择交班人和接班人');
      return;
    }
    try {
      const res = await fetch('/api/handover/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowRecordModal(false);
        setRecordForm({
          outgoing_employee_id: '',
          incoming_employee_id: '',
          shift: 'day',
          equipment_status: '',
          safety_notes: '',
          production_notes: '',
          other_notes: ''
        });
        loadData();
      } else {
        setError(data.message || '创建交接班记录失败');
      }
    } catch (err) {
      setError(err?.message || '创建交接班记录失败');
    }
  }

  async function handleUpdateRecord() {
    if (!editingRecord) return;
    try {
      const res = await fetch(`/api/handover/records/${editingRecord.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowRecordModal(false);
        setEditingRecord(null);
        setRecordForm({
          outgoing_employee_id: '',
          incoming_employee_id: '',
          shift: 'day',
          equipment_status: '',
          safety_notes: '',
          production_notes: '',
          other_notes: ''
        });
        loadData();
      } else {
        setError(data.message || '更新交接班记录失败');
      }
    } catch (err) {
      setError(err?.message || '更新交接班记录失败');
    }
  }

  async function handleDeleteRecord(recordId) {
    if (!confirm('确定要删除该交接班记录吗？')) return;
    try {
      await fetch(`/api/handover/records/${recordId}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      setError(err?.message || '删除交接班记录失败');
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  function getShiftLabel(shift) {
    const shifts = {
      day: '白班',
      night: '夜班',
      morning: '早班',
      afternoon: '中班',
      evening: '晚班'
    };
    return shifts[shift] || shift;
  }

  function openEditRecord(record) {
    setEditingRecord(record);
    setRecordForm({
      outgoing_employee_id: record.outgoing_employee_id || '',
      incoming_employee_id: record.incoming_employee_id || '',
      shift: record.shift || 'day',
      equipment_status: record.equipment_status || '',
      safety_notes: record.safety_notes || '',
      production_notes: record.production_notes || '',
      other_notes: record.other_notes || ''
    });
    setShowRecordModal(true);
  }

  const tabs = [
    { id: 'records', label: '交接记录', icon: 'folder' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>交接班管理</h1><div className="breadcrumb">交接记录 · 设备状态 · 安全事项</div></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => { setEditingRecord(null); setRecordForm({ outgoing_employee_id: '', incoming_employee_id: '', shift: 'day', equipment_status: '', safety_notes: '', production_notes: '', other_notes: '' }); setShowRecordModal(true); }}><Icon name="folder" size={14}/> 新建交接</button>
        </div>
      </div>

      <div className="tabs" style={{padding:'0 24px',marginBottom:0}}>
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={14}/> {tab.label}
          </div>
        ))}
      </div>

      <div style={{padding:'20px 24px'}}>
        {error && <div className="inline-alert" style={{marginBottom:16}}>{error}<button onClick={() => setError('')} style={{marginLeft:8}}>&times;</button></div>}

        {loading ? (
          <div className="empty-state"><div className="spinner"/><p style={{marginTop:12}}>加载中...</p></div>
        ) : (
          <>
            {/* 交接记录 */}
            {activeTab === 'records' && (
              <div className="section">
                <div className="section-header">
                  <h3>交接班记录</h3>
                  <button className="btn btn-outline btn-sm" onClick={loadData}><Icon name="refresh" size={13}/> 刷新</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid var(--border)'}}>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>交班人</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>接班人</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>班次</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>交接时间</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>设备状态</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>安全事项</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(record => (
                        <tr key={record.id} style={{borderBottom:'1px solid var(--border)'}}>
                          <td style={{padding:'10px 12px'}}>{record.outgoing_employee_name || '--'} {record.outgoing_employee_number ? `(${record.outgoing_employee_number})` : ''}</td>
                          <td style={{padding:'10px 12px'}}>{record.incoming_employee_name || '--'} {record.incoming_employee_number ? `(${record.incoming_employee_number})` : ''}</td>
                          <td style={{padding:'10px 12px'}}>{getShiftLabel(record.shift)}</td>
                          <td style={{padding:'10px 12px'}}>{formatDate(record.handover_time)}</td>
                          <td style={{padding:'10px 12px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{record.equipment_status || '--'}</td>
                          <td style={{padding:'10px 12px',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{record.safety_notes || '--'}</td>
                          <td style={{padding:'10px 12px'}}>
                            <div style={{display:'flex',gap:4}}>
                              <button className="btn btn-sm btn-outline" onClick={() => openEditRecord(record)}>编辑</button>
                              <button className="btn btn-sm btn-outline" onClick={() => handleDeleteRecord(record.id)}>删除</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>暂无交接班记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 交接班记录编辑弹窗 */}
      {showRecordModal && (
        <div className="modal-overlay" onClick={() => setShowRecordModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:640}}>
            <div className="modal-header">
              <h3>{editingRecord ? '编辑交接记录' : '新建交接记录'}</h3>
              <button className="modal-close" onClick={() => setShowRecordModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group">
                  <label>交班人</label>
                  <select className="input" value={recordForm.outgoing_employee_id} onChange={e => setRecordForm(p => ({...p, outgoing_employee_id: e.target.value}))} disabled={editingRecord}>
                    <option value="">请选择交班人</option>
                    {employees.filter(e => e.status === 'active').map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_number})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>接班人</label>
                  <select className="input" value={recordForm.incoming_employee_id} onChange={e => setRecordForm(p => ({...p, incoming_employee_id: e.target.value}))} disabled={editingRecord}>
                    <option value="">请选择接班人</option>
                    {employees.filter(e => e.status === 'active' && String(e.id) !== String(recordForm.outgoing_employee_id)).map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_number})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>班次</label>
                <select className="input" value={recordForm.shift} onChange={e => setRecordForm(p => ({...p, shift: e.target.value}))}>
                  <option value="day">白班</option>
                  <option value="night">夜班</option>
                  <option value="morning">早班</option>
                  <option value="afternoon">中班</option>
                  <option value="evening">晚班</option>
                </select>
              </div>
              <div className="form-group">
                <label>设备状态</label>
                <textarea className="input" rows={2} value={recordForm.equipment_status} onChange={e => setRecordForm(p => ({...p, equipment_status: e.target.value}))} placeholder="请描述设备运行状态"/>
              </div>
              <div className="form-group">
                <label>安全事项</label>
                <textarea className="input" rows={2} value={recordForm.safety_notes} onChange={e => setRecordForm(p => ({...p, safety_notes: e.target.value}))} placeholder="请描述需要注意的安全事项"/>
              </div>
              <div className="form-group">
                <label>生产事项</label>
                <textarea className="input" rows={2} value={recordForm.production_notes} onChange={e => setRecordForm(p => ({...p, production_notes: e.target.value}))} placeholder="请描述生产相关事项"/>
              </div>
              <div className="form-group">
                <label>其他事项</label>
                <textarea className="input" rows={2} value={recordForm.other_notes} onChange={e => setRecordForm(p => ({...p, other_notes: e.target.value}))} placeholder="其他需要交接的事项"/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={editingRecord ? handleUpdateRecord : handleCreateRecord}>
                  {editingRecord ? '保存修改' : '创建记录'}
                </button>
                <button className="btn btn-outline" onClick={() => setShowRecordModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// FaceCheckInView - 人脸识别签到
// ============================================================
function FaceCheckInView({ onRefresh }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [autoMode, setAutoMode] = useState(true);
  const [cooldown, setCooldown] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    loadCameras();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function loadCameras() {
    try {
      const res = await fetch('/api/cameras');
      const data = await res.json();
      if (data.code === 200) setCameras(data.data || []);
    } catch {}
  }

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setStream(mediaStream);
      setCameraActive(true);
      setError('');
    } catch (err) {
      setError('无法访问摄像头: ' + err.message);
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCameraActive(false);
  }

  async function captureAndRecognize() {
    if (!videoRef.current || !canvasRef.current || recognizing || cooldown) return;
    
    const video = videoRef.current;
    if (video.readyState < 2) return;
    
    const canvas = canvasRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    
    setRecognizing(true);
    setError('');
    
    try {
      const res = await fetch('/api/attendance/face-recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          camera_id: selectedCameraId || null,
          location: '人脸识别签到台',
          action: autoMode ? 'auto' : 'check-in'
        })
      });
      const data = await res.json();
      
      if (data.code === 200) {
        setResult(data.data);
        if (data.data.recognized) {
          setCooldown(true);
          setTimeout(() => setCooldown(false), 3000);
          if (onRefresh) onRefresh();
        }
      } else {
        setError(data.message || '识别失败');
      }
    } catch (err) {
      setError(err?.message || '网络错误');
    }
    setRecognizing(false);
  }

  function toggleAutoMode() {
    setAutoMode(prev => !prev);
  }

  function getResultColor() {
    if (!result || !result.recognized) return '#64748b';
    if (result.action === 'check-in' || result.action === 'check-out') return '#10b981';
    if (result.action === 'late' || result.status === 'late') return '#ef4444';
    if (result.action === 'early') return '#f59e0b';
    return '#3b82f6';
  }

  return (
    <div style={{display:'flex',gap:24,height:'calc(100vh - 200px)',minHeight:500}}>
      {/* 左侧：摄像头画面 */}
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:16}}>
        <div className="section" style={{flex:1,display:'flex',flexDirection:'column',padding:0,overflow:'hidden'}}>
          <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontWeight:700,fontSize:16}}>摄像头画面</div>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <select 
                className="input" 
                style={{width:200,fontSize:12,padding:'6px 10px'}} 
                value={selectedCameraId} 
                onChange={e => setSelectedCameraId(e.target.value)}
              >
                <option value="">使用浏览器摄像头</option>
                {cameras.map(cam => (
                  <option key={cam.id} value={cam.id}>{cam.name}</option>
                ))}
              </select>
              <button 
                className={`btn btn-sm ${cameraActive ? 'btn-danger' : 'btn-primary'}`}
                onClick={cameraActive ? stopCamera : startCamera}
              >
                <Icon name={cameraActive ? 'stop' : 'play'} size={13}/> 
                {cameraActive ? '关闭' : '打开'}
              </button>
            </div>
          </div>
          <div style={{flex:1,background:'#000',position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{width:'100%',height:'100%',objectFit:'contain',display: cameraActive ? 'block' : 'none'}}
            />
            <canvas ref={canvasRef} style={{display:'none'}}/>
            {!cameraActive && (
              <div style={{textAlign:'center',color:'#666'}}>
                <Icon name="camera" size={48}/>
                <p style={{marginTop:12,fontSize:14}}>点击"打开"启动摄像头</p>
              </div>
            )}
            {recognizing && (
              <div style={{position:'absolute',top:16,right:16,background:'rgba(0,0,0,0.7)',color:'#fff',padding:'8px 16px',borderRadius:8,fontSize:13,display:'flex',alignItems:'center',gap:8}}>
                <div className="spinner" style={{width:16,height:16}}/>
                识别中...
              </div>
            )}
            {cooldown && (
              <div style={{position:'absolute',top:16,left:16,background:'rgba(16,185,129,0.9)',color:'#fff',padding:'8px 16px',borderRadius:8,fontSize:13}}>
                请勿重复操作
              </div>
            )}
          </div>
        </div>
        
        {/* 识别按钮 */}
        <div style={{display:'flex',gap:12}}>
          <button 
            className="btn btn-primary" 
            style={{flex:1,height:56,fontSize:16,fontWeight:700}} 
            onClick={captureAndRecognize}
            disabled={!cameraActive || recognizing || cooldown}
          >
            <Icon name="user" size={20}/> 
            {recognizing ? '识别中...' : '拍照识别'}
          </button>
          <button 
            className={`btn ${autoMode ? 'btn-success' : 'btn-outline'}`}
            style={{width:120,height:56}} 
            onClick={toggleAutoMode}
          >
            <Icon name={autoMode ? 'check' : 'play'} size={16}/>
            {autoMode ? '自动模式' : '手动模式'}
          </button>
        </div>
      </div>

      {/* 右侧：识别结果 */}
      <div style={{width:380,display:'flex',flexDirection:'column',gap:16}}>
        {/* 识别结果卡片 */}
        <div className="section" style={{padding:20}}>
          <div style={{fontWeight:700,fontSize:16,marginBottom:16}}>识别结果</div>
          
          {error && (
            <div className="inline-alert" style={{marginBottom:12}}>{error}</div>
          )}
          
          {!result && !error && (
            <div style={{textAlign:'center',padding:'40px 0',color:'var(--text-muted)'}}>
              <Icon name="user" size={48}/>
              <p style={{marginTop:12}}>请对准摄像头拍照</p>
            </div>
          )}
          
          {result && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {result.recognized ? (
                <>
                  {/* 员工信息 */}
                  <div style={{display:'flex',alignItems:'center',gap:12,padding:12,background:'var(--bg)',borderRadius:8}}>
                    <div style={{width:56,height:56,borderRadius:'50%',background:getResultColor(),display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <Icon name="user" size={28}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:18}}>{result.employee_name}</div>
                      <div style={{fontSize:13,color:'var(--text-muted)'}}>
                        工号: {result.employee_number} | 部门: {result.department || '未设置'}
                      </div>
                    </div>
                  </div>
                  
                  {/* 识别详情 */}
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{padding:10,background:'var(--bg)',borderRadius:6,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>相似度</div>
                      <div style={{fontWeight:700,fontSize:16,color:getResultColor()}}>{result.similarity}%</div>
                    </div>
                    <div style={{padding:10,background:'var(--bg)',borderRadius:6,textAlign:'center'}}>
                      <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>时间</div>
                      <div style={{fontWeight:700,fontSize:16}}>{result.time || '--'}</div>
                    </div>
                  </div>
                  
                  {/* 操作结果 */}
                  <div style={{padding:12,background:getResultColor()+'15',borderRadius:8,borderLeft:`4px solid ${getResultColor()}`}}>
                    <div style={{fontWeight:600,fontSize:14,color:getResultColor()}}>
                      {result.action === 'check-in' && '✓ 签到成功'}
                      {result.action === 'check-out' && '✓ 签退成功'}
                      {result.action === 'already-checked-in' && '⚠ 今日已签到'}
                      {result.action === 'already-checked-out' && '⚠ 今日已签退'}
                      {result.action === 'no-check-in' && '⚠ 今日未签到'}
                      {result.action === 'none' && '✓ 今日已完成'}
                    </div>
                    <div style={{fontSize:13,marginTop:4,color:'var(--text)'}}>{result.message}</div>
                  </div>
                  
                  {/* 考勤详情 */}
                  {result.action === 'check-in' && result.late_minutes > 0 && (
                    <div style={{padding:10,background:'#fef2f2',borderRadius:6,fontSize:13,color:'#dc2626'}}>
                      迟到 {result.late_minutes} 分钟
                    </div>
                  )}
                  {result.action === 'check-out' && (
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                      <div style={{padding:8,background:'var(--bg)',borderRadius:6,textAlign:'center'}}>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>工时</div>
                        <div style={{fontWeight:600,fontSize:14}}>{result.work_hours}h</div>
                      </div>
                      {result.early_minutes > 0 && (
                        <div style={{padding:8,background:'#fef2f2',borderRadius:6,textAlign:'center'}}>
                          <div style={{fontSize:10,color:'#dc2626'}}>早退</div>
                          <div style={{fontWeight:600,fontSize:14,color:'#dc2626'}}>{result.early_minutes}分</div>
                        </div>
                      )}
                      {result.overtime_minutes > 0 && (
                        <div style={{padding:8,background:'#eff6ff',borderRadius:6,textAlign:'center'}}>
                          <div style={{fontSize:10,color:'#2563eb'}}>加班</div>
                          <div style={{fontWeight:600,fontSize:14,color:'#2563eb'}}>{result.overtime_minutes}分</div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{textAlign:'center',padding:'30px 0',color:'var(--text-muted)'}}>
                  <Icon name="warning" size={48}/>
                  <p style={{marginTop:12,fontSize:14,fontWeight:600}}>{result.message || '未识别到已注册员工'}</p>
                  <p style={{fontSize:12,marginTop:4}}>请确保已注册人脸且面部清晰可见</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 使用说明 */}
        <div className="section" style={{padding:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>使用说明</div>
          <div style={{fontSize:12,color:'var(--text-muted)',display:'flex',flexDirection:'column',gap:8}}>
            <div style={{display:'flex',gap:8}}><span style={{color:'var(--primary)'}}>1.</span> 点击"打开"启动摄像头</div>
            <div style={{display:'flex',gap:8}}><span style={{color:'var(--primary)'}}>2.</span> 对准摄像头，确保面部清晰</div>
            <div style={{display:'flex',gap:8}}><span style={{color:'var(--primary)'}}>3.</span> 点击"拍照识别"完成签到/签退</div>
            <div style={{display:'flex',gap:8}}><span style={{color:'var(--primary)'}}>4.</span> 自动模式下系统智能判断签到或签退</div>
          </div>
        </div>

        {/* 今日签到统计 */}
        <div className="section" style={{padding:16,flex:1}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>今日签到记录</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>
            识别成功后自动记录，可在"今日考勤"中查看详情
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AttendanceView - 考勤管理
// ============================================================
function AttendanceView({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('today');
  const [records, setRecords] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [rules, setRules] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [todayStats, setTodayStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [leaveForm, setLeaveForm] = useState({
    employee_id: '',
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    duration: 1,
    reason: ''
  });
  const [ruleForm, setRuleForm] = useState({
    name: '',
    work_start_time: '09:00',
    work_end_time: '18:00',
    late_threshold: 10,
    early_threshold: 10,
    overtime_threshold: 60,
    rest_days: '6,7'
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [recordsRes, leavesRes, rulesRes, employeesRes, todayRes] = await Promise.all([
        fetch('/api/attendance/records?limit=100'),
        fetch('/api/attendance/leaves?limit=100'),
        fetch('/api/attendance/rules'),
        fetch('/api/employees'),
        fetch('/api/attendance/today')
      ]);
      
      const [recordsData, leavesData, rulesData, employeesData, todayData] = await Promise.all([
        recordsRes.json(),
        leavesRes.json(),
        rulesRes.json(),
        employeesRes.json(),
        todayRes.json()
      ]);
      
      if (recordsData.code === 200) setRecords(recordsData.data || []);
      if (leavesData.code === 200) setLeaves(leavesData.data || []);
      if (rulesData.code === 200) setRules(rulesData.data || []);
      if (employeesData.code === 200) setEmployees(employeesData.data || []);
      if (todayData.code === 200) setTodayStats(todayData.data);
    } catch (err) {
      setError(err?.message || '加载数据失败');
    }
    setLoading(false);
  }

  async function handleCheckIn(employeeId) {
    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowCheckInModal(false);
        loadData();
      } else {
        setError(data.message || '签到失败');
      }
    } catch (err) {
      setError(err?.message || '签到失败');
    }
  }

  async function handleCheckOut(employeeId) {
    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_id: employeeId })
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowCheckOutModal(false);
        loadData();
      } else {
        setError(data.message || '签退失败');
      }
    } catch (err) {
      setError(err?.message || '签退失败');
    }
  }

  async function handleCreateLeave() {
    if (!leaveForm.employee_id || !leaveForm.start_date || !leaveForm.end_date) {
      setError('请填写完整信息');
      return;
    }
    try {
      const res = await fetch('/api/attendance/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leaveForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowLeaveModal(false);
        setLeaveForm({ employee_id: '', leave_type: 'annual', start_date: '', end_date: '', duration: 1, reason: '' });
        loadData();
      } else {
        setError(data.message || '创建请假记录失败');
      }
    } catch (err) {
      setError(err?.message || '创建请假记录失败');
    }
  }

  async function handleApproveLeave(recordId, status) {
    try {
      const res = await fetch(`/api/attendance/leaves/${recordId}/approve`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.code === 200) {
        loadData();
      } else {
        setError(data.message || '审批失败');
      }
    } catch (err) {
      setError(err?.message || '审批失败');
    }
  }

  async function handleCreateRule() {
    if (!ruleForm.name) {
      setError('规则名称不能为空');
      return;
    }
    try {
      const res = await fetch('/api/attendance/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleForm)
      });
      const data = await res.json();
      if (data.code === 200) {
        setShowRuleModal(false);
        setRuleForm({ name: '', work_start_time: '09:00', work_end_time: '18:00', late_threshold: 10, early_threshold: 10, overtime_threshold: 60, rest_days: '6,7' });
        loadData();
      } else {
        setError(data.message || '创建规则失败');
      }
    } catch (err) {
      setError(err?.message || '创建规则失败');
    }
  }

  async function handleDeleteRule(ruleId) {
    if (!confirm('确定要删除该考勤规则吗？')) return;
    try {
      await fetch(`/api/attendance/rules/${ruleId}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      setError(err?.message || '删除规则失败');
    }
  }

  function formatDate(timestamp) {
    if (!timestamp) return '--';
    return new Date(timestamp * 1000).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  function getStatusBadge(status) {
    const badges = {
      normal: <span className="badge badge-success">正常</span>,
      late: <span className="badge badge-danger">迟到</span>,
      early: <span className="badge badge-warning">早退</span>,
      overtime: <span className="badge badge-info">加班</span>,
      absent: <span className="badge badge-danger">缺勤</span>
    };
    return badges[status] || <span className="badge">{status}</span>;
  }

  function getLeaveTypeLabel(type) {
    const types = {
      annual: '年假',
      sick: '病假',
      personal: '事假',
      maternity: '产假',
      paternity: '陪产假',
      marriage: '婚假',
      bereavement: '丧假',
      other: '其他'
    };
    return types[type] || type;
  }

  function getLeaveStatusBadge(status) {
    const badges = {
      pending: <span className="badge badge-warning">待审批</span>,
      approved: <span className="badge badge-success">已批准</span>,
      rejected: <span className="badge badge-danger">已拒绝</span>
    };
    return badges[status] || <span className="badge">{status}</span>;
  }

  const tabs = [
    { id: 'face', label: '人脸识别签到', icon: 'user' },
    { id: 'today', label: '今日考勤', icon: 'calendar' },
    { id: 'records', label: '考勤记录', icon: 'users' },
    { id: 'leaves', label: '请假管理', icon: 'folder' },
    { id: 'rules', label: '考勤规则', icon: 'settings' },
    { id: 'statistics', label: '考勤统计', icon: 'site' },
  ];

  return (
    <>
      <div className="page-header">
        <div><h1>考勤管理</h1><div className="breadcrumb">员工考勤 · 请假管理 · 考勤规则 · 考勤统计</div></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCheckInModal(true)}><Icon name="check" size={14}/> 签到</button>
          <button className="btn btn-outline" onClick={() => setShowCheckOutModal(true)}><Icon name="stop" size={14}/> 签退</button>
          <button className="btn btn-outline" onClick={() => setShowLeaveModal(true)}><Icon name="folder" size={14}/> 请假</button>
        </div>
      </div>

      <div className="tabs" style={{padding:'0 24px',marginBottom:0}}>
        {tabs.map(tab => (
          <div key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <Icon name={tab.icon} size={14}/> {tab.label}
          </div>
        ))}
      </div>

      <div style={{padding:'20px 24px'}}>
        {error && <div className="inline-alert" style={{marginBottom:16}}>{error}<button onClick={() => setError('')} style={{marginLeft:8}}>&times;</button></div>}

        {loading ? (
          <div className="empty-state"><div className="spinner"/><p style={{marginTop:12}}>加载中...</p></div>
        ) : (
          <>
            {/* 人脸识别签到 */}
            {activeTab === 'face' && (
              <FaceCheckInView onRefresh={loadData} />
            )}

            {/* 今日考勤 */}
            {activeTab === 'today' && (
              <div style={{display:'flex',flexDirection:'column',gap:16}}>
                <div className="stats-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-blue"><Icon name="users" size={22}/></div>
                    <div><div className="stat-value">{todayStats?.total_employees || 0}</div><div className="stat-label">应出勤人数</div></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-green"><Icon name="check" size={22}/></div>
                    <div><div className="stat-value">{todayStats?.checked_in || 0}</div><div className="stat-label">已签到</div></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-red"><Icon name="warning" size={22}/></div>
                    <div><div className="stat-value">{todayStats?.late_count || 0}</div><div className="stat-label">迟到</div></div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-icon stat-icon-orange"><Icon name="close" size={22}/></div>
                    <div><div className="stat-value">{todayStats?.absent_count || 0}</div><div className="stat-label">未签到</div></div>
                  </div>
                </div>

                <div className="section">
                  <div className="section-header">
                    <h3>今日考勤记录</h3>
                    <button className="btn btn-outline btn-sm" onClick={loadData}><Icon name="refresh" size={13}/> 刷新</button>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                      <thead>
                        <tr style={{borderBottom:'1px solid var(--border)'}}>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>员工</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>部门</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>签到时间</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>签退时间</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>状态</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>工时</th>
                          <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(todayStats?.records || []).map(record => (
                          <tr key={record.id} style={{borderBottom:'1px solid var(--border)'}}>
                            <td style={{padding:'10px 12px'}}>{record.employee_name || '--'}</td>
                            <td style={{padding:'10px 12px'}}>{record.department || '--'}</td>
                            <td style={{padding:'10px 12px'}}>{formatDate(record.check_in_time)}</td>
                            <td style={{padding:'10px 12px'}}>{record.check_out_time ? formatDate(record.check_out_time) : '--'}</td>
                            <td style={{padding:'10px 12px'}}>{getStatusBadge(record.status)}</td>
                            <td style={{padding:'10px 12px'}}>{record.work_hours ? `${record.work_hours.toFixed(1)}h` : '--'}</td>
                            <td style={{padding:'10px 12px'}}>
                              {!record.check_out_time && (
                                <button className="btn btn-sm btn-primary" onClick={() => handleCheckOut(record.employee_id)}>签退</button>
                              )}
                            </td>
                          </tr>
                        ))}
                        {(!todayStats?.records || todayStats.records.length === 0) && (
                          <tr><td colSpan={7} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>今日暂无考勤记录</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 考勤记录 */}
            {activeTab === 'records' && (
              <div className="section">
                <div className="section-header">
                  <h3>考勤记录</h3>
                  <button className="btn btn-outline btn-sm" onClick={loadData}><Icon name="refresh" size={13}/> 刷新</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid var(--border)'}}>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>员工</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>工号</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>部门</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>签到时间</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>签退时间</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>状态</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>迟到(分)</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>早退(分)</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>工时</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map(record => (
                        <tr key={record.id} style={{borderBottom:'1px solid var(--border)'}}>
                          <td style={{padding:'10px 12px'}}>{record.employee_name || record.emp_name || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{record.employee_number || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{record.department || record.emp_department || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{formatDate(record.check_in_time)}</td>
                          <td style={{padding:'10px 12px'}}>{record.check_out_time ? formatDate(record.check_out_time) : '--'}</td>
                          <td style={{padding:'10px 12px'}}>{getStatusBadge(record.status)}</td>
                          <td style={{padding:'10px 12px'}}>{record.late_minutes || 0}</td>
                          <td style={{padding:'10px 12px'}}>{record.early_minutes || 0}</td>
                          <td style={{padding:'10px 12px'}}>{record.work_hours ? `${record.work_hours.toFixed(1)}h` : '--'}</td>
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr><td colSpan={9} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>暂无考勤记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 请假管理 */}
            {activeTab === 'leaves' && (
              <div className="section">
                <div className="section-header">
                  <h3>请假记录</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowLeaveModal(true)}><Icon name="folder" size={13}/> 新建请假</button>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                    <thead>
                      <tr style={{borderBottom:'1px solid var(--border)'}}>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>员工</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>工号</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>请假类型</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>开始日期</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>结束日期</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>时长(天)</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>状态</th>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600}}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaves.map(record => (
                        <tr key={record.id} style={{borderBottom:'1px solid var(--border)'}}>
                          <td style={{padding:'10px 12px'}}>{record.employee_name || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{record.employee_number || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{getLeaveTypeLabel(record.leave_type)}</td>
                          <td style={{padding:'10px 12px'}}>{record.start_date || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{record.end_date || '--'}</td>
                          <td style={{padding:'10px 12px'}}>{record.duration || 0}</td>
                          <td style={{padding:'10px 12px'}}>{getLeaveStatusBadge(record.status)}</td>
                          <td style={{padding:'10px 12px'}}>
                            {record.status === 'pending' && (
                              <div style={{display:'flex',gap:4}}>
                                <button className="btn btn-sm btn-success" onClick={() => handleApproveLeave(record.id, 'approved')}>批准</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleApproveLeave(record.id, 'rejected')}>拒绝</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                      {leaves.length === 0 && (
                        <tr><td colSpan={8} style={{textAlign:'center',padding:20,color:'var(--text-muted)'}}>暂无请假记录</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 考勤规则 */}
            {activeTab === 'rules' && (
              <div className="section">
                <div className="section-header">
                  <h3>考勤规则</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowRuleModal(true)}><Icon name="settings" size={13}/> 新建规则</button>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))',gap:16}}>
                  {rules.map(rule => (
                    <div key={rule.id} className="section" style={{padding:16}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                        <div style={{fontWeight:700,fontSize:15}}>{rule.name}</div>
                        <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-muted'}`}>
                          {rule.is_active ? '激活中' : '未激活'}
                        </span>
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                        工作时间：{rule.work_start_time} - {rule.work_end_time}
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:6}}>
                        迟到阈值：{rule.late_threshold}分钟 | 早退阈值：{rule.early_threshold}分钟
                      </div>
                      <div style={{fontSize:12,color:'var(--text-muted)',marginBottom:12}}>
                        加班阈值：{rule.overtime_threshold}分钟 | 休息日：{rule.rest_days}
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        {!rule.is_active && (
                          <button className="btn btn-sm btn-success" onClick={() => handleDeleteRule(rule.id)}>激活</button>
                        )}
                        <button className="btn btn-sm btn-outline" onClick={() => handleDeleteRule(rule.id)}>删除</button>
                      </div>
                    </div>
                  ))}
                  {rules.length === 0 && (
                    <div style={{gridColumn:'1/-1',textAlign:'center',padding:40,color:'var(--text-muted)'}}>暂无考勤规则</div>
                  )}
                </div>
              </div>
            )}

            {/* 考勤统计 */}
            {activeTab === 'statistics' && (
              <div className="section">
                <div className="section-header">
                  <h3>考勤统计</h3>
                </div>
                <div style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>
                  考勤统计功能开发中...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 签到弹窗 */}
      {showCheckInModal && (
        <div className="modal-overlay" onClick={() => setShowCheckInModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div className="modal-header">
              <h3>员工签到</h3>
              <button className="modal-close" onClick={() => setShowCheckInModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20}}>
              <div className="form-group" style={{marginBottom:16}}>
                <label>选择员工</label>
                <select className="input" value={selectedEmployee || ''} onChange={e => setSelectedEmployee(e.target.value)}>
                  <option value="">请选择员工</option>
                  {employees.filter(e => e.status === 'active').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_number})</option>
                  ))}
                </select>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => handleCheckIn(selectedEmployee)} disabled={!selectedEmployee}>
                  确认签到
                </button>
                <button className="btn btn-outline" onClick={() => setShowCheckInModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 签退弹窗 */}
      {showCheckOutModal && (
        <div className="modal-overlay" onClick={() => setShowCheckOutModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:480}}>
            <div className="modal-header">
              <h3>员工签退</h3>
              <button className="modal-close" onClick={() => setShowCheckOutModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20}}>
              <div className="form-group" style={{marginBottom:16}}>
                <label>选择员工</label>
                <select className="input" value={selectedEmployee || ''} onChange={e => setSelectedEmployee(e.target.value)}>
                  <option value="">请选择员工</option>
                  {employees.filter(e => e.status === 'active').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_number})</option>
                  ))}
                </select>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={() => handleCheckOut(selectedEmployee)} disabled={!selectedEmployee}>
                  确认签退
                </button>
                <button className="btn btn-outline" onClick={() => setShowCheckOutModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 请假弹窗 */}
      {showLeaveModal && (
        <div className="modal-overlay" onClick={() => setShowLeaveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header">
              <h3>新建请假</h3>
              <button className="modal-close" onClick={() => setShowLeaveModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div className="form-group">
                <label>选择员工</label>
                <select className="input" value={leaveForm.employee_id} onChange={e => setLeaveForm(p => ({...p, employee_id: e.target.value}))}>
                  <option value="">请选择员工</option>
                  {employees.filter(e => e.status === 'active').map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.employee_number})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>请假类型</label>
                <select className="input" value={leaveForm.leave_type} onChange={e => setLeaveForm(p => ({...p, leave_type: e.target.value}))}>
                  <option value="annual">年假</option>
                  <option value="sick">病假</option>
                  <option value="personal">事假</option>
                  <option value="maternity">产假</option>
                  <option value="paternity">陪产假</option>
                  <option value="marriage">婚假</option>
                  <option value="bereavement">丧假</option>
                  <option value="other">其他</option>
                </select>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group">
                  <label>开始日期</label>
                  <input type="date" className="input" value={leaveForm.start_date} onChange={e => setLeaveForm(p => ({...p, start_date: e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>结束日期</label>
                  <input type="date" className="input" value={leaveForm.end_date} onChange={e => setLeaveForm(p => ({...p, end_date: e.target.value}))}/>
                </div>
              </div>
              <div className="form-group">
                <label>请假时长(天)</label>
                <input type="number" className="input" min="0.5" step="0.5" value={leaveForm.duration} onChange={e => setLeaveForm(p => ({...p, duration: Number(e.target.value)}))}/>
              </div>
              <div className="form-group">
                <label>请假原因</label>
                <textarea className="input" rows={3} value={leaveForm.reason} onChange={e => setLeaveForm(p => ({...p, reason: e.target.value}))} placeholder="请输入请假原因"/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleCreateLeave}>提交申请</button>
                <button className="btn btn-outline" onClick={() => setShowLeaveModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 考勤规则弹窗 */}
      {showRuleModal && (
        <div className="modal-overlay" onClick={() => setShowRuleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header">
              <h3>新建考勤规则</h3>
              <button className="modal-close" onClick={() => setShowRuleModal(false)}><Icon name="close" size={16}/></button>
            </div>
            <div style={{padding:20,display:'flex',flexDirection:'column',gap:16}}>
              <div className="form-group">
                <label>规则名称</label>
                <input className="input" value={ruleForm.name} onChange={e => setRuleForm(p => ({...p, name: e.target.value}))} placeholder="例如：标准工作制"/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div className="form-group">
                  <label>上班时间</label>
                  <input type="time" className="input" value={ruleForm.work_start_time} onChange={e => setRuleForm(p => ({...p, work_start_time: e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label>下班时间</label>
                  <input type="time" className="input" value={ruleForm.work_end_time} onChange={e => setRuleForm(p => ({...p, work_end_time: e.target.value}))}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
                <div className="form-group">
                  <label>迟到阈值(分钟)</label>
                  <input type="number" className="input" min="0" value={ruleForm.late_threshold} onChange={e => setRuleForm(p => ({...p, late_threshold: Number(e.target.value)}))}/>
                </div>
                <div className="form-group">
                  <label>早退阈值(分钟)</label>
                  <input type="number" className="input" min="0" value={ruleForm.early_threshold} onChange={e => setRuleForm(p => ({...p, early_threshold: Number(e.target.value)}))}/>
                </div>
                <div className="form-group">
                  <label>加班阈值(分钟)</label>
                  <input type="number" className="input" min="0" value={ruleForm.overtime_threshold} onChange={e => setRuleForm(p => ({...p, overtime_threshold: Number(e.target.value)}))}/>
                </div>
              </div>
              <div className="form-group">
                <label>休息日</label>
                <input className="input" value={ruleForm.rest_days} onChange={e => setRuleForm(p => ({...p, rest_days: e.target.value}))} placeholder="例如：6,7（周六周日）"/>
                <div style={{fontSize:11,color:'var(--text-muted)',marginTop:4}}>数字代表星期几，逗号分隔（1=周一，7=周日）</div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={handleCreateRule}>创建规则</button>
                <button className="btn btn-outline" onClick={() => setShowRuleModal(false)}>取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
