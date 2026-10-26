'use client';

import { useState, useEffect, useRef } from 'react';

export default function CameraSelector({ onSelect, selectedDeviceId }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streams, setStreams] = useState({});

  useEffect(() => {
    detectCameras();
    return () => {
      // Cleanup all streams on unmount
      Object.values(streams).forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
    };
  }, []);

  async function detectCameras() {
    setLoading(true);
    setError('');
    
    try {
      // Request permission first to get device labels
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(track => track.stop());
      
      // Get all video devices
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices.filter(d => d.kind === 'videoinput');
      
      console.log('检测到摄像头数量:', videoDevices.length);
      console.log('设备列表:', videoDevices.map(d => ({ label: d.label, deviceId: d.deviceId, groupId: d.groupId })));
      
      setDevices(videoDevices);
      
      if (videoDevices.length === 0) {
        setError('未检测到摄像头设备');
      }
    } catch (e) {
      console.error('摄像头检测失败:', e);
      setError('检测失败: ' + e.message);
    }
    
    setLoading(false);
  }

  // Test start a specific camera to verify it works
  async function testCamera(device) {
    try {
      console.log('测试启动摄像头:', device.label, device.deviceId);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: device.deviceId } },
        audio: false
      });
      
      console.log('摄像头启动成功, track count:', stream.getTracks().length);
      
      // Store stream for preview
      setStreams(prev => ({ ...prev, [device.deviceId]: stream }));
      
      // Stop after 2 seconds for testing
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        setStreams(prev => {
          const newStreams = { ...prev };
          delete newStreams[device.deviceId];
          return newStreams;
        });
      }, 2000);
      
    } catch (e) {
      console.error('测试启动失败:', e);
      alert(`摄像头 ${device.label} 启动失败: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>选择摄像头 ({devices.length}个)</h3>
        <button 
          onClick={detectCameras}
          style={{
            padding: '6px 12px',
            fontSize: 12,
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}
        >
          🔄 刷新
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
          🔍 检测中...
        </div>
      )}

      {error && (
        <div style={{ textAlign: 'center', padding: 24, color: '#ef4444' }}>
          ❌ {error}
        </div>
      )}

      {!loading && !error && devices.length === 0 && (
        <div style={{ textAlign: 'center', padding: 24, color: '#64748b' }}>
          未检测到摄像头
        </div>
      )}

      {!loading && devices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map((device, idx) => {
            const isSelected = selectedDeviceId === device.deviceId;
            const isBuiltIn = !device.label?.toLowerCase().includes('usb');
            const hasTestStream = !!streams[device.deviceId];
            
            return (
              <div
                key={device.deviceId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 12,
                  background: isSelected ? 'rgba(34,197,94,0.1)' : 'var(--surface-dark)',
                  border: isSelected ? '2px solid #22c55e' : '1px solid var(--border)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {/* Preview video for this camera */}
                <div style={{ width: 80, height: 60, background: '#000', borderRadius: 4, overflow: 'hidden' }}>
                  {hasTestStream ? (
                    <video 
                      autoPlay 
                      muted 
                      ref={el => {
                        if (el && streams[device.deviceId]) {
                          el.srcObject = streams[device.deviceId];
                        }
                      }}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 20 }}>
                      📷
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {device.label || `摄像头 ${idx + 1}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    {isBuiltIn ? '💻 内置' : '📷 外接'} · {device.deviceId.slice(0, 16)}...
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); testCamera(device); }}
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    测试
                  </button>
                  <button
                    onClick={() => onSelect(device)}
                    style={{
                      padding: '6px 10px',
                      fontSize: 11,
                      background: isSelected ? '#22c55e' : '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer'
                    }}
                  >
                    {isSelected ? '✓ 已添加' : '添加'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}