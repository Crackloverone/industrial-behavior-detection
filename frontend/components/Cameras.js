'use client';

import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api';

export default function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [usbCameras, setUsbCameras] = useState([]);
  const [showUsbModal, setShowUsbModal] = useState(false);
  const [isLoadingUsb, setIsLoadingUsb] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    rtsp_url: '',
  });

  useEffect(() => {
    loadCameras();
  }, []);

  async function loadCameras() {
    try {
      const res = await apiGet('/api/cameras');
      if (res.code === 200) {
        setCameras(res.data || []);
      }
    } catch (e) {
      console.error('加载失败:', e);
      setCameras([{ id: 1, name: 'Demo Camera', location: 'Demo', status: 'offline', is_usb: false }]);
    }
  }

  async function detectUsbCameras() {
    setIsLoadingUsb(true);
    try {
      const res = await apiGet('/api/usb-cameras');
      setUsbCameras(res.data || []);
    } catch (e) {
      console.error('检测失败:', e);
      setUsbCameras([]);
    }
    setIsLoadingUsb(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await apiPost('/api/cameras', { ...formData, status: 'offline' });
      setShowModal(false);
      setFormData({ name: '', location: '', rtsp_url: '' });
      loadCameras();
    } catch (e) {
      alert('保存失败');
    }
  }

  async function addUsbCamera(cam) {
    setIsAdding(true);
    try {
      await apiPost(`/api/usb-cameras/${cam.id}/use`, {});
      await loadCameras();
      setShowUsbModal(false);
    } catch (e) {
      alert('添加失败');
    }
    setIsAdding(false);
  }

  async function toggleCamera(id, currentStatus) {
    const action = currentStatus === 'online' ? 'stop' : 'start';
    setTogglingId(id);
    try {
      await apiPost(`/api/stream/${id}/${action}`, {});
      loadCameras();
    } catch (e) {
      console.error('操作失败:', e);
    } finally {
      setTogglingId(null);
    }
  }

  async function deleteCamera(id) {
    if (!confirm('确定要删除吗？')) return;
    try {
      await apiDelete(`/api/cameras/${id}`);
      loadCameras();
    } catch (e) {
      console.error('删除失败:', e);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="breadcrumb">设备管理 / 摄像头</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            className="btn btn-outline"
            onClick={() => { detectUsbCameras(); setShowUsbModal(true); }}
          >
            🔍 检测 USB 摄像头
          </button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + 添加摄像头
          </button>
        </div>
      </div>

      <div className="camera-grid">
        {cameras.length === 0 ? (
          <div className="section" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
            <div className="empty-state">
              尚未添加摄像头<br/>
              <small style={{ color: 'var(--text-muted)' }}>
                点击右上角按钮添加 RTSP 摄像头或检测 USB 摄像头
              </small>
            </div>
          </div>
        ) : (
          cameras.map(cam => (
            <div key={cam.id} className={`camera-card ${cam.status === 'online' ? 'online' : ''}`}>
              <div className="camera-preview">
                {cam.status === 'online' ? (
                  <div style={{ 
                    width: '100%', 
                    height: '100%', 
                    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b'
                  }}>
                    📹 实时画面
                  </div>
                ) : (
                  <div className="camera-offline">
                    {cam.is_usb ? '📷' : '📹'} {cam.name}
                  </div>
                )}
                <div className="camera-status">
                  {cam.status === 'online' ? '在线' : '离线'}
                </div>
                {cam.is_usb && (
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="badge badge-info">USB</span>
                  </div>
                )}
              </div>
              <div className="camera-info">
                <h4>{cam.name}</h4>
                <p>{cam.location || (cam.is_usb ? '本地 USB' : 'RTSP 流')}</p>
                <div className="camera-actions">
                  <button
                    className={`btn btn-sm ${cam.status === 'online' ? 'btn-danger' : 'btn-success'}`}
                    onClick={() => toggleCamera(cam.id, cam.status)}
                    disabled={togglingId === cam.id}
                  >
                    {togglingId === cam.id ? '处理中...' : (cam.status === 'online' ? '停止' : '启动')}
                  </button>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => deleteCamera(cam.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add RTSP Camera Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>添加 RTSP 摄像头</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>摄像头名称 *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如: 车间A入口"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>位置描述</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="如: 1号车间入口处"
                  />
                </div>
                <div className="form-group">
                  <label>视频流地址 (RTSP) *</label>
                  <input
                    type="text"
                    value={formData.rtsp_url}
                    onChange={e => setFormData({ ...formData, rtsp_url: e.target.value })}
                    placeholder="rtsp://192.168.1.100:554/stream"
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  取消
                </button>
                <button type="submit" className="btn btn-primary">
                  保存
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USB Camera Detection Modal */}
      {showUsbModal && (
        <div className="modal-overlay" onClick={() => setShowUsbModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>USB 摄像头</h3>
              <button className="modal-close" onClick={() => setShowUsbModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {isLoadingUsb ? (
                <div className="empty-state">
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  正在检测，请稍候...
                </div>
              ) : usbCameras.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
                  未检测到 USB 摄像头<br/>
                  <small style={{ color: 'var(--text-muted)' }}>
                    请确保摄像头已正确连接
                  </small>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {usbCameras.map(cam => (
                    <div key={cam.id} className="camera-card online" style={{ cursor: 'default' }}>
                      <div className="camera-info" style={{ padding: 12 }}>
                        <h4 style={{ fontSize: 13 }}>{cam.name}</h4>
                        <p style={{ fontSize: 12, marginBottom: 8 }}>
                          分辨率: {cam.width}x{cam.height} · 帧率: {cam.fps}FPS
                        </p>
                        <button
                          className="btn btn-success btn-sm btn-block"
                          onClick={() => addUsbCamera(cam)}
                          disabled={isAdding}
                        >
                          {isAdding ? '添加中...' : '添加到系统'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}