'use client';

import { useEffect, useState, useRef } from 'react';
import { VIOLATION_TYPES } from '@/lib/constants';

const DETECT_ITEMS = [
  { key: 'workwear', label: '工作服检测' },
  { key: 'smoking', label: '抽烟检测' },
  { key: 'sleeping', label: '睡岗检测' },
];

function ViolationCard({ label, count, color }) {
  return (
    <div style={{padding:'12px',background:count > 0 ? `${color}08` : 'var(--bg)',border:`1px solid ${count > 0 ? color + '30' : 'var(--border)'}`,borderRadius:8,textAlign:'center',transition:'all 0.2s'}}>
      <div style={{fontSize:24,fontWeight:800,color:count > 0 ? color : 'var(--text)',lineHeight:1}}>{count}</div>
      <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>{label}</div>
    </div>
  );
}

function AlarmMiniCard({ alarm, onClick }) {
  const vLabel = VIOLATION_TYPES[alarm.violation_type] || alarm.violation_type;
  return (
    <div onClick={onClick} style={{padding:'10px 12px',background:alarm.handled ? 'var(--bg)' : '#fef2f2',border:`1px solid ${alarm.handled ? 'var(--border)' : 'rgba(239,68,68,0.2)'}`,borderRadius:8,cursor:'pointer',transition:'all 0.15s',marginBottom:6}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <strong style={{fontSize:13}}>{vLabel}</strong>
        <span className={'badge ' + (alarm.handled ? 'badge-success' : 'badge-danger')} style={{fontSize:10}}>{alarm.handled ? '已处理' : '待处理'}</span>
      </div>
      <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>
        {alarm.camera_name || '未知'} · {alarm.timestamp ? new Date(alarm.timestamp * 1000).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
      </div>
    </div>
  );
}

export default function SingleCameraConsole() {
  const [cameras, setCameras] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [streamKey, setStreamKey] = useState(0);
  const [detecting, setDetecting] = useState(false);
  const [violations, setViolations] = useState([]);
  const [recentAlarms, setRecentAlarms] = useState([]);
  const [selectedAlarm, setSelectedAlarm] = useState(null);
  const [detectItems, setDetectItems] = useState({ workwear: true, smoking: true, sleeping: true });
  const [zoom, setZoom] = useState(100);
  const [flashViolation, setFlashViolation] = useState(false);
  const flashTimerRef = useRef(null);
  const detectTimerRef = useRef(null);
  const detectBusyRef = useRef(false);
  const captureCanvasRef = useRef(null);

  async function loadCameras() {
    const r = await fetch('/api/cameras', { cache: 'no-store' });
    const d = await r.json();
    const items = d.data || [];
    setCameras(items);
    if (!selectedId && items.length) setSelectedId(String(items[0].id));
  }
  useEffect(() => { loadCameras().catch(() => setError('摄像头列表加载失败')); }, []);
  useEffect(() => {
    if (!selectedId) return;
    loadRecentAlarms();
    const t = setInterval(loadRecentAlarms, 10000);
    return () => clearInterval(t);
  }, [selectedId]);

  const selected = cameras.find(c => String(c.id) === selectedId);

  async function setStream(action) {
    if (!selected) return;
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/stream/${selected.id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      if (!r.ok || d.code !== 200) throw new Error(d.message || '操作失败');
      setPlaying(action === 'start');
      setStreamKey(k => k + 1);
      if (action === 'stop') { setDetecting(false); setViolations([]); }
      await loadCameras();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function loadRecentAlarms() {
    if (!selectedId) return;
    try {
      const r = await fetch('/api/alarms?limit=4', { cache: 'no-store' });
      const d = await r.json();
      if (d.code === 200) setRecentAlarms((d.data || []).filter(a => String(a.camera_id) === selectedId).slice(0, 4));
    } catch {}
  }

  const vCount = {
    no_workwear: violations.filter(v => v.violation_type === 'no_workwear').length,
    smoking: violations.filter(v => v.violation_type === 'smoking').length,
    sleeping: violations.filter(v => v.violation_type === 'sleeping').length,
  };
  const hasViolation = violations.length > 0;

  useEffect(() => {
    if (hasViolation) {
      setFlashViolation(true);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      flashTimerRef.current = setTimeout(() => setFlashViolation(false), 3000);
    }
  }, [hasViolation]);

  useEffect(() => {
    return () => {
      if (detectTimerRef.current) { clearInterval(detectTimerRef.current); detectTimerRef.current = null; }
      if (flashTimerRef.current) { clearTimeout(flashTimerRef.current); flashTimerRef.current = null; }
    };
  }, []);

  async function doDetect() {
    if (detectBusyRef.current || !selected) return;
    detectBusyRef.current = true;
    try {
      const img = document.querySelector(`img[alt="${selected.name}"]`);
      if (!img || !img.complete || img.naturalWidth === 0) { detectBusyRef.current = false; return; }
      const canvas = captureCanvasRef.current;
      if (!canvas) { detectBusyRef.current = false; return; }
      canvas.width = img.naturalWidth || 640;
      canvas.height = img.naturalHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
      const r = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData, camera_id: selected.id, camera_name: selected.name }),
      });
      const d = await r.json();
      if (d.code === 200 && d.data) {
        const viols = (d.data.violations || []).filter(v => {
          if (v.violation_type === 'no_workwear' && !detectItems.workwear) return false;
          if (v.violation_type === 'smoking' && !detectItems.smoking) return false;
          if (v.violation_type === 'sleeping' && !detectItems.sleeping) return false;
          return true;
        });
        setViolations(viols);
      }
    } catch (e) {
      console.error('检测失败:', e);
    } finally {
      detectBusyRef.current = false;
    }
  }

  useEffect(() => {
    if (detecting && playing && selected) {
      doDetect();
      detectTimerRef.current = setInterval(doDetect, 3000);
    } else {
      if (detectTimerRef.current) { clearInterval(detectTimerRef.current); detectTimerRef.current = null; }
      if (!detecting) setViolations([]);
    }
    return () => { if (detectTimerRef.current) { clearInterval(detectTimerRef.current); detectTimerRef.current = null; } };
  }, [detecting, playing, selected]);

  return <>
    <canvas ref={captureCanvasRef} style={{display:'none'}} />
    <div className="page-header">
      <div><h1>控制台</h1><div className="breadcrumb">单路摄像头 · 实时预览 · AI 违规检测</div></div>
      <div className="page-header-actions">
        <select className="select" value={selectedId} onChange={e => { setSelectedId(e.target.value); setPlaying(false); setDetecting(false); setViolations([]); }}>
          {cameras.map(c => <option value={c.id} key={c.id}>{c.name} · {c.location || '地点未设置'}</option>)}
        </select>
        <button className={`btn ${playing ? 'btn-danger' : 'btn-primary'}`} disabled={!selected || busy} onClick={() => setStream(playing ? 'stop' : 'start')}>
          {busy ? '处理中...' : playing ? '关闭' : '启动'}
        </button>
      </div>
    </div>

    <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:16,padding:'16px 24px',alignItems:'start'}}>
      {/* 左侧：视频画面 */}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        <div className="single-console-stage" style={{position:'relative',borderRadius:10,overflow:'hidden'}}>
          {playing && selected ? (
            <img key={streamKey} src={`/api/stream/${selected.id}/mjpeg`} alt={selected.name} style={{width:'100%',height:'100%',objectFit:'contain'}} onError={() => setError('视频流断开')}/>
          ) : (
            <div className="camera-stage-placeholder">
              <strong>{selected ? '点击启动' : '请先配置摄像头'}</strong>
              <span>启动后可手动开启AI检测</span>
            </div>
          )}
          {playing && <span className="camera-live-badge">{detecting ? 'AI 检测中' : '监控中'}</span>}
          {flashViolation && <div style={{position:'absolute',inset:0,border:'3px solid #ef4444',borderRadius:10,pointerEvents:'none',animation:'blink 0.6s infinite',zIndex:5}}/>}
          {flashViolation && <div style={{position:'absolute',top:14,right:14,background:'rgba(239,68,68,0.9)',color:'white',padding:'4px 10px',borderRadius:6,fontSize:11,fontWeight:700,zIndex:6}}>{violations.map(v => VIOLATION_TYPES[v.violation_type] || v.violation_type).join('、')}</div>}
          {playing && (
            <div style={{position:'absolute',bottom:10,right:10,display:'flex',gap:4,zIndex:6}}>
              <button className="btn btn-sm" style={{background:'rgba(0,0,0,0.6)',color:'white',border:'none',padding:'4px 8px',borderRadius:4}} onClick={() => setZoom(z => Math.max(50, z - 10))}>-</button>
              <button className="btn btn-sm" style={{background:'rgba(0,0,0,0.6)',color:'white',border:'none',padding:'4px 8px',borderRadius:4}} onClick={() => setZoom(100)}>{zoom}%</button>
              <button className="btn btn-sm" style={{background:'rgba(0,0,0,0.6)',color:'white',border:'none',padding:'4px 8px',borderRadius:4}} onClick={() => setZoom(z => Math.min(200, z + 10))}>+</button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：信息面板 */}
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {/* 摄像头信息 */}
        <div className="section" style={{padding:14}}>
          <div style={{fontWeight:700,fontSize:15,marginBottom:8}}>{selected?.name || '未选择摄像头'}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {[
              ['场景地点', selected?.location || '未设置'],
              ['岗位信息', selected?.position || '未设置'],
              ['视频源', selected?.is_usb ? 'USB' : 'RTSP'],
              ['证据策略', '当前帧 + 前后4秒'],
            ].map(([k, v]) => (
              <div key={k} style={{padding:'8px 10px',background:'var(--bg)',borderRadius:6}}>
                <div style={{fontSize:11,color:'var(--text-muted)'}}>{k}</div>
                <div style={{fontSize:13,fontWeight:600,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI 检测控制 */}
        {playing && (
          <div className="section" style={{padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{fontWeight:700,fontSize:14}}>AI 检测</span>
              <button className={`btn btn-sm ${detecting ? 'btn-danger' : 'btn-primary'}`} onClick={() => setDetecting(d => !d)}>
                {detecting ? '关闭检测' : '开启检测'}
              </button>
            </div>
            {DETECT_ITEMS.map(item => (
              <label key={item.key} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',cursor:'pointer',fontSize:13}}>
                <input type="checkbox" checked={detectItems[item.key]} onChange={() => setDetectItems(p => ({...p, [item.key]: !p[item.key]}))} style={{width:16,height:16,accentColor:'var(--primary)'}}/>
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        )}

        {/* 检测结果 */}
        {detecting && (
          <div className="section" style={{padding:14}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>检测结果</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
              <ViolationCard label="工作服" count={vCount.no_workwear} color="#7c3aed"/>
              <ViolationCard label="抽烟" count={vCount.smoking} color="#dc2626"/>
              <ViolationCard label="睡岗" count={vCount.sleeping} color="#2563eb"/>
            </div>
          </div>
        )}

        {/* 最近报警 */}
        {recentAlarms.length > 0 && (
          <div className="section" style={{padding:14}}>
            <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>最近报警</div>
            {recentAlarms.map(alarm => (
              <AlarmMiniCard key={alarm.id} alarm={alarm} onClick={() => setSelectedAlarm(alarm)}/>
            ))}
          </div>
        )}

        {error && <div className="inline-alert">{error}</div>}
      </div>

      {/* 报警详情弹窗 */}
      {selectedAlarm && (
        <div className="modal-overlay" onClick={() => setSelectedAlarm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth:560}}>
            <div className="modal-header"><h3>报警详情</h3><button className="modal-close" onClick={() => setSelectedAlarm(null)}>×</button></div>
            <div style={{padding:20}}>
              <div style={{background:'#0a0e16',borderRadius:8,height:180,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',marginBottom:16}}>
                {selectedAlarm.image_path ? <img src={`/api/alarms/${selectedAlarm.id}/image`} alt="报警截图" style={{width:'100%',height:'100%',objectFit:'contain'}}/> :
                  <div style={{color:'#475569',fontWeight:700}}>{VIOLATION_TYPES[selectedAlarm.violation_type] || selectedAlarm.violation_type}</div>}
                <div style={{position:'absolute',top:8,left:8,background:'rgba(239,68,68,0.9)',color:'white',fontSize:10,padding:'2px 8px',borderRadius:4,fontWeight:700}}>
                  {VIOLATION_TYPES[selectedAlarm.violation_type] || selectedAlarm.violation_type}
                </div>
              </div>
              {selectedAlarm.video_path && <div style={{marginBottom:12}}><div style={{fontSize:12,fontWeight:600,marginBottom:6}}>事件视频</div><video controls preload="metadata" src={`/api/alarms/${selectedAlarm.id}/video`} style={{width:'100%',borderRadius:8,background:'#05080d'}}/></div>}
              <div style={{fontSize:13}}>
                <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid var(--border)'}}><span style={{color:'var(--text-muted)'}}>时间</span><span>{selectedAlarm.timestamp ? new Date(selectedAlarm.timestamp * 1000).toLocaleString('zh-CN') : '-'}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',padding:'6px 0'}}><span style={{color:'var(--text-muted)'}}>状态</span><span className={'badge ' + (selectedAlarm.handled ? 'badge-success' : 'badge-danger')}>{selectedAlarm.handled ? '已处理' : '待处理'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </>;
}
