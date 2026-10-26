'use client';

import { useEffect, useState, useCallback } from 'react';

export default function MultiCameraWall() {
  const [cameras, setCameras] = useState([]);
  const [active, setActive] = useState({});
  const [detecting, setDetecting] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [splitMode, setSplitMode] = useState('auto');

  const splitOptions = [
    { value: 'auto', label: '自适应', columns: null },
    { value: '1', label: '1 分屏', columns: 1 },
    { value: '4', label: '4 分屏', columns: 2 },
    { value: '6', label: '6 分屏', columns: 3 },
    { value: '9', label: '9 分屏', columns: 3 },
  ];
  const selectedSplit = splitOptions.find(o => o.value === splitMode) || splitOptions[0];

  async function loadCameras() {
    setLoading(true);
    try {
      const r = await fetch('/api/cameras', { cache: 'no-store' }).then(r => r.json());
      setCameras(r.data || []);
    } catch { setCameras([]); }
    setLoading(false);
  }
  useEffect(() => { loadCameras(); }, []);

  const toggleStream = useCallback(async (cameraId) => {
    const isOn = !!active[cameraId];
    try {
      const r = await fetch(`/api/stream/${cameraId}/${isOn ? 'stop' : 'start'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (!r.ok || d.code !== 200) throw new Error(d.message || '操作失败');
      if (isOn) {
        setActive(p => { const n = { ...p }; delete n[cameraId]; return n; });
        setDetecting(p => { const n = { ...p }; delete n[cameraId]; return n; });
        setErrors(p => { const n = { ...p }; delete n[cameraId]; return n; });
      } else {
        setActive(p => ({ ...p, [cameraId]: Date.now() }));
        setErrors(p => { const n = { ...p }; delete n[cameraId]; return n; });
      }
    } catch (e) { setErrors(p => ({ ...p, [cameraId]: e.message })); }
  }, [active]);

  async function startAll() {
    for (const cam of cameras) {
      if (!active[cam.id]) await toggleStream(cam.id);
    }
  }

  async function stopAll() {
    for (const cam of cameras) {
      if (active[cam.id]) await toggleStream(cam.id);
    }
  }

  const onlineCount = Object.keys(active).length;
  const offlineCount = cameras.length - onlineCount;

  return <>
    <div className="page-header">
      <div><h1>视频监控</h1><div className="breadcrumb">全部场景 · 多画面实时检测</div></div>
      <div className="page-header-actions">
        <label className="split-control">
          <span>分屏</span>
          <select className="select" value={splitMode} onChange={e => setSplitMode(e.target.value)}>
            {splitOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:'var(--text-muted)'}}>
          <span style={{color:'var(--success)',fontWeight:600}}>{onlineCount} 在线</span>
          <span>/</span>
          <span>{cameras.length} 总数</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={startAll} disabled={loading || cameras.length === 0}>全部启动</button>
        <button className="btn btn-danger btn-sm" onClick={stopAll} disabled={loading || onlineCount === 0}>全部关闭</button>
        <button className="btn btn-outline btn-sm" onClick={loadCameras}>刷新</button>
      </div>
    </div>
    <div className={`multi-camera-wall split-${splitMode}`} style={selectedSplit.columns ? { '--wall-columns': selectedSplit.columns } : undefined}>
      {loading && !cameras.length ? <div className="empty-state"><div className="spinner"/><p>加载中...</p></div> : cameras.map(camera => (
        <article className="multi-camera-card" key={camera.id}>
          <div className="multi-camera-frame">
            {active[camera.id] ? (
              <>
                <img src={`/api/stream/${camera.id}/mjpeg?v=${active[camera.id]}`} alt={camera.name} onError={() => setErrors(p => ({ ...p, [camera.id]: '视频流已断开' }))}/>
                <span className="camera-live-badge">{detecting[camera.id] ? 'AI 检测中' : '监控中'}</span>
              </>
            ) : (
              <div className="camera-stage-placeholder">
                <strong>{errors[camera.id] || camera.name}</strong>
                <span>{errors[camera.id] || '点击启动'}</span>
              </div>
            )}
          </div>
          <footer style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px'}}>
            <div style={{minWidth:0,flex:1}}>
              <strong style={{fontSize:14,display:'block'}}>{camera.name}</strong>
              <span style={{fontSize:12,color:'var(--text-muted)',display:'block',marginTop:2}}>{camera.location || '地点未设置'}{camera.position ? ` · ${camera.position}` : ''}</span>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button className={`btn btn-sm ${active[camera.id] ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleStream(camera.id)}>
                {active[camera.id] ? '关闭' : '启动'}
              </button>
              {active[camera.id] && (
                <button className={`btn btn-sm ${detecting[camera.id] ? 'btn-outline' : 'btn-primary'}`} onClick={() => setDetecting(p => ({ ...p, [camera.id]: !p[camera.id] }))}>
                  {detecting[camera.id] ? '停止检测' : '检测'}
                </button>
              )}
            </div>
          </footer>
        </article>
      ))}
      {!loading && !cameras.length && <div className="empty-state"><p>尚未配置摄像头</p></div>}
    </div>
  </>;
}
