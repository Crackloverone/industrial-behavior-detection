'use client';

import { useState, useEffect, useRef } from 'react';

// Monitor.js uses browser media APIs only for local camera access
// No API calls to backend needed here

export default function Monitor() {
  const [browserDevices, setBrowserDevices] = useState([]);
  const [activeStreams, setActiveStreams] = useState({});
  const [gridSize, setGridSize] = useState(4);
  const [isLoading, setIsLoading] = useState(true);
  const videoRefs = useRef({});

  useEffect(() => {
    detectAndStartCameras();
    return () => {
      Object.values(activeStreams).forEach(info => {
        if (info?.stream) {
          info.stream.getTracks().forEach(track => track.stop());
        }
      });
    };
  }, []);

  async function detectAndStartCameras() {
    setIsLoading(true);
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      tempStream.getTracks().forEach(track => track.stop());
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      
      console.log('检测到摄像头:', videoDevices.length);
      setBrowserDevices(videoDevices);
      
      // 自动启动所有摄像头
      const newStreams = {};
      for (const device of videoDevices) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: device.deviceId } },
            audio: false
          });
          newStreams[device.deviceId] = {
            stream,
            label: device.label || `摄像头 ${videoDevices.indexOf(device) + 1}`,
            deviceId: device.deviceId
          };
        } catch (e) {
          console.error('启动失败:', device.label, e);
        }
      }
      
      setActiveStreams(newStreams);
    } catch (e) {
      console.error('检测失败:', e);
    }
    setIsLoading(false);
  }

  async function startCamera(device) {
    if (activeStreams[device.deviceId]?.stream) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false
      });
      setActiveStreams(prev => ({
        ...prev,
        [device.deviceId]: { stream, label: device.label || `Camera ${browserDevices.indexOf(device) + 1}`, deviceId: device.deviceId }
      }));
    } catch (e) {
      console.error('启动失败:', e);
    }
  }

  function stopCamera(deviceId) {
    const info = activeStreams[deviceId];
    if (info?.stream) {
      info.stream.getTracks().forEach(track => track.stop());
    }
    setActiveStreams(prev => {
      const newStreams = { ...prev };
      delete newStreams[deviceId];
      return newStreams;
    });
  }

  function stopAll() {
    Object.values(activeStreams).forEach(info => {
      if (info?.stream) {
        info.stream.getTracks().forEach(track => track.stop());
      }
    });
    setActiveStreams({});
  }

  async function restartCamera(deviceId) {
    const info = activeStreams[deviceId];
    if (info?.stream) {
      info.stream.getTracks().forEach(track => track.stop());
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      setActiveStreams(prev => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], stream }
      }));
    } catch (e) {
      console.error('重启失败:', e);
    }
  }

  useEffect(() => {
    Object.entries(activeStreams).forEach(([deviceId, info]) => {
      if (info?.stream && videoRefs.current[deviceId]) {
        videoRefs.current[deviceId].srcObject = info.stream;
      }
    });
  }, [activeStreams]);

  function getGridCols() {
    const count = Object.keys(activeStreams).length || 1;
    if (count <= 1) return 1;
    if (count <= 4) return 2;
    if (count <= 9) return 3;
    return 4;
  }

  return (
    <>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>视频监控中心</h1>
          <div className="breadcrumb">实时监测 / 多画面监控</div>
        </div>
        <div className="page-header-actions">
          <div className="usb-indicator">
            <span className="dot"></span>
            {Object.keys(activeStreams).length} 路正在监控
          </div>
          <select 
            className="select" 
            value={gridSize} 
            onChange={e => setGridSize(parseInt(e.target.value))}
            style={{ width: 110 }}
          >
            <option value="4">4 画面</option>
            <option value="9">9 画面</option>
            <option value="16">16 画面</option>
          </select>
          <button className="btn btn-outline btn-sm" onClick={detectAndStartCameras}>
            🔄 刷新
          </button>
          {Object.keys(activeStreams).length > 0 && (
            <button className="btn btn-danger btn-sm" onClick={stopAll}>
              ⏹ 全部停止
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: 20 }}>
        {isLoading ? (
          <div className="section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div className="loading">
              <div className="spinner"></div>
            </div>
            <div style={{ marginTop: 16, color: 'var(--text-muted)' }}>正在检测摄像头...</div>
          </div>
        ) : browserDevices.length === 0 ? (
          <div className="section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📹</div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>未检测到摄像头</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>请检查摄像头连接</div>
            <button className="btn btn-primary" onClick={detectAndStartCameras}>
              重新检测
            </button>
          </div>
        ) : Object.keys(activeStreams).length === 0 ? (
          <div className="section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>📹</div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>检测到 {browserDevices.length} 个摄像头</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>点击下方按钮启动监控</div>
            <button className="btn btn-primary" onClick={detectAndStartCameras}>
              启动全部摄像头
            </button>
          </div>
        ) : (
          <div className="section" style={{ padding: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${getGridCols()}, 1fr)`, gap: 16 }}>
              {browserDevices.map((device, idx) => {
                const info = activeStreams[device.deviceId];
                const hasStream = info?.stream ? true : false;
                
                return (
                  <div key={device.deviceId} style={{
                    position: 'relative',
                    background: '#0f172a',
                    borderRadius: 'var(--radius-lg)',
                    overflow: 'hidden',
                    aspectRatio: '16/9',
                    border: hasStream ? '2px solid var(--success)' : '2px solid var(--border)',
                    boxShadow: hasStream ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none',
                  }}>
                    {hasStream ? (
                      <>
                        <video
                          ref={el => {
                            if (el) {
                              videoRefs.current[device.deviceId] = el;
                              el.srcObject = info.stream;
                            }
                          }}
                          autoPlay
                          playsInline
                          muted
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {/* Header overlay */}
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '12px 16px', background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="badge badge-success" style={{ fontSize: 10 }}>● 直播</span>
                            <span style={{ fontSize: 13, color: 'white', fontWeight: 600 }}>{info.label}</span>
                          </div>
                        </div>
                        {/* Index badge */}
                        <div style={{ position: 'absolute', bottom: 12, right: 12, width: 28, height: 28, background: 'rgba(16, 185, 129, 0.9)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                          {idx + 1}
                        </div>
                        {/* Controls overlay */}
                        <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8, opacity: 0, transition: 'opacity 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                          onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                        >
                          <button 
                            onClick={() => restartCamera(device.deviceId)}
                            style={{ background: 'rgba(59, 130, 246, 0.9)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ↻
                          </button>
                          <button 
                            onClick={() => stopCamera(device.deviceId)}
                            style={{ background: 'rgba(239, 68, 68, 0.9)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            ×
                          </button>
                        </div>
                      </>
                    ) : (
                      <div 
                        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#475569', cursor: 'pointer' }}
                        onClick={() => startCamera(device)}
                      >
                        <span style={{ fontSize: 40, marginBottom: 8 }}>📷</span>
                        <span style={{ fontSize: 13 }}>{device.label || `Camera ${idx + 1}`}</span>
                        <span style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>点击启动</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}