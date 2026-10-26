'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { VIOLATION_TYPES, DETECTION_LABELS, getDetectionLabel } from '@/lib/constants';

export default function CameraWorkspace({ compact = false }) {
  const [localDevices, setLocalDevices] = useState([]);
  const [remoteCameras, setRemoteCameras] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stream, setStream] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detections, setDetections] = useState([]);
  const [violations, setViolations] = useState([]);
  const [modelInfo, setModelInfo] = useState(null);

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const captureRef = useRef(null);
  const streamRef = useRef(null);
  const selectedRef = useRef(null);
  const detectingRef = useRef(false);
  const detectionTimerRef = useRef(null);
  const detectionBusyRef = useRef(false);

  const stopLocalStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setStream(null);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearDetection = useCallback(() => {
    setDetections([]);
    setViolations([]);
    const canvas = overlayRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const stopDetection = useCallback(() => {
    detectingRef.current = false;
    setDetecting(false);
    if (detectionTimerRef.current) clearTimeout(detectionTimerRef.current);
    detectionTimerRef.current = null;
    clearDetection();
  }, [clearDetection]);

  const loadSources = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('当前浏览器不支持摄像头访问');
      }
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      permissionStream.getTracks().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setLocalDevices(devices.filter(device => device.kind === 'videoinput'));
      setStatus('ready');
    } catch (err) {
      setLocalDevices([]);
      setStatus('permission-error');
      setError(
        err?.name === 'NotAllowedError'
          ? '摄像头权限被拒绝，请在浏览器地址栏中允许摄像头权限'
          : `本机摄像头检测失败：${err?.message || '未知错误'}`
      );
    }

    try {
      const response = await fetch('/api/cameras', { cache: 'no-store' });
      const result = await response.json();
      if (result.code === 200) {
        setRemoteCameras(
          (result.data || []).filter(camera => String(camera.rtsp_url || '').startsWith('rtsp'))
        );
      }
    } catch {
      setRemoteCameras([]);
    }
  }, []);

  useEffect(() => {
    loadSources();
    fetch('/api/model/info')
      .then(response => response.json())
      .then(result => setModelInfo(result.data || null))
      .catch(() => setModelInfo(null));
    const handleDeviceChange = () => loadSources();
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      stopDetection();
      stopLocalStream();
    };
  }, [loadSources, stopDetection, stopLocalStream]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream, selected]);

  async function selectLocal(device, index) {
    stopDetection();
    stopLocalStream();
    setError('');
    setStatus('opening');
    const source = {
      type: 'local',
      id: device.deviceId,
      deviceId: device.deviceId,
      name: device.label || `本机摄像头 ${index + 1}`,
    };
    setSelected(source);
    selectedRef.current = source;
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: device.deviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = nextStream;
      setStream(nextStream);
      setStatus('playing');
    } catch (err) {
      setStatus('error');
      setError(`无法打开 ${source.name}：${err?.message || '设备不可用'}`);
    }
  }

  async function selectRemote(camera) {
    stopDetection();
    stopLocalStream();
    setError('');
    setStatus('opening');
    const source = { type: 'remote', id: camera.id, name: camera.name, location: camera.location };
    setSelected(source);
    selectedRef.current = source;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(`/api/stream/${camera.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      const result = await response.json();
      if (result.code !== 200) throw new Error(result.message || '视频流启动失败');
      setStatus('playing');
    } catch (err) {
      setStatus('error');
      setError(
        err?.name === 'AbortError'
          ? `无法打开 ${camera.name}：连接超时，请检查 RTSP 地址和网络`
          : `无法打开 ${camera.name}：${err?.message || '视频流不可用'}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function drawDetections(items, violationItems, width, height) {
    const canvas = overlayRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, width, height);
    context.font = '600 14px Inter, sans-serif';
    for (const item of items) {
      const box = item.bbox;
      if (!box || box.length !== 4) continue;
      const relatedViolation = violationItems.some(v =>
        v.bbox && v.bbox[0] < box[2] && v.bbox[2] > box[0]
        && v.bbox[1] < box[3] && v.bbox[3] > box[1]
      );
      const danger = Boolean(item.violation) || relatedViolation;
      const color = danger ? '#ef4444' : '#22c55e';
      const label = `${item.display_name || getDetectionLabel(item.class_name) || item.class_name} ${Math.round((item.confidence || 0) * 100)}%`;
      context.strokeStyle = color;
      context.lineWidth = 3;
      context.strokeRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
      const labelWidth = context.measureText(label).width + 16;
      context.fillStyle = color;
      context.fillRect(box[0], Math.max(0, box[1] - 28), labelWidth, 28);
      context.fillStyle = '#fff';
      context.fillText(label, box[0] + 8, Math.max(19, box[1] - 8));
    }
  }

  const runDetection = useCallback(async () => {
    if (!detectingRef.current || detectionBusyRef.current) return;
    const source = selectedRef.current;
    const video = videoRef.current;
    const capture = captureRef.current;
    if (!source || source.type !== 'local' || !video || !capture || video.readyState < 2) {
      detectionTimerRef.current = setTimeout(runDetection, 1000);
      return;
    }
    detectionBusyRef.current = true;
    try {
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      capture.width = width;
      capture.height = height;
      capture.getContext('2d').drawImage(video, 0, 0, width, height);
      const image = capture.toDataURL('image/jpeg', 0.72).split(',')[1];
      const response = await fetch('/api/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, camera_id: source.id, camera_name: source.name }),
      });
      const result = await response.json();
      if (result.code !== 200) throw new Error(result.message || '检测失败');
      const nextDetections = result.data?.detections || [];
      const nextViolations = result.data?.violations || [];
      setDetections(nextDetections);
      setViolations(nextViolations);
      drawDetections(nextDetections, nextViolations, width, height);
    } catch (err) {
      setError(`AI 检测失败：${err?.message || '服务不可用'}`);
    } finally {
      detectionBusyRef.current = false;
      if (detectingRef.current) detectionTimerRef.current = setTimeout(runDetection, 2500);
    }
  }, []);

  function startDetection() {
    if (!selected || selected.type !== 'local' || !streamRef.current) {
      setError('请先打开一个本机摄像头，再启动 AI 检测');
      return;
    }
    detectingRef.current = true;
    setDetecting(true);
    setError('');
    runDetection();
  }

  function closeCurrent() {
    stopDetection();
    stopLocalStream();
    setSelected(null);
    selectedRef.current = null;
    setStatus('ready');
    setError('');
  }

  const sourceCount = localDevices.length + remoteCameras.length;
  const isLocalPlaying = selected?.type === 'local' && Boolean(stream);
  const isRemotePlaying = selected?.type === 'remote' && status === 'playing';

  return (
    <div className={`camera-workspace ${compact ? 'compact' : ''}`}>
      <section className="camera-stage-card">
        <div className="camera-stage-toolbar">
          <div>
            <div className="camera-stage-title">{selected?.name || '选择摄像头开始监控'}</div>
            <div className="camera-stage-subtitle">
              {selected?.location || (selected?.type === 'local' ? '浏览器本机设备' : '单路预览与 AI 行为分析')}
            </div>
          </div>
          <div className="camera-stage-actions">
            <span className={`engine-chip ${modelInfo?.loaded ? 'online' : 'offline'}`}>
              AI {modelInfo?.loaded ? '可用' : '不可用'}
            </span>
            {selected && <button className="btn btn-outline btn-sm" onClick={closeCurrent}>关闭画面</button>}
            {isLocalPlaying && (
              <button className={`btn btn-sm ${detecting ? 'btn-danger' : 'btn-primary'}`} onClick={detecting ? stopDetection : startDetection}>
                {detecting ? '停止 AI 检测' : '启动 AI 检测'}
              </button>
            )}
          </div>
        </div>

        <div className={`camera-stage ${violations.length ? 'has-violation' : ''}`}>
          {!selected && (
            <div className="camera-stage-placeholder">
              <div className="camera-stage-placeholder-icon">▣</div>
              <strong>尚未选择视频源</strong>
              <span>从右侧设备列表选择一台摄像头</span>
            </div>
          )}
          {selected && status === 'opening' && (
            <div className="camera-stage-placeholder"><div className="spinner" /><strong>正在连接 {selected.name}</strong></div>
          )}
          {isLocalPlaying && (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="camera-stage-video" />
              <canvas ref={overlayRef} className="camera-stage-overlay" />
              <canvas ref={captureRef} style={{ display: 'none' }} />
            </>
          )}
          {isRemotePlaying && (
            <img
              className="camera-stage-video"
              src={`/api/stream/${selected.id}/mjpeg`}
              alt={`${selected.name} 实时画面`}
              onError={() => { setStatus('error'); setError('远程视频流已断开或无法解码'); }}
            />
          )}
          {selected && status === 'error' && (
            <div className="camera-stage-placeholder error"><strong>画面连接失败</strong><span>{error}</span></div>
          )}
          {(isLocalPlaying || isRemotePlaying) && (
            <div className="camera-live-badge">{detecting ? 'AI 分析中' : '实时画面'}</div>
          )}
        </div>

        {error && status !== 'error' && <div className="camera-inline-error">{error}</div>}

        <div className="camera-result-strip">
          <div><span>检测目标</span><strong>{detections.length}</strong></div>
          <div><span>违规候选</span><strong className={violations.length ? 'danger' : ''}>{violations.length}</strong></div>
          <div><span>运行模式</span><strong>{detecting ? 'AI 检测' : selected ? '仅预览' : '待机'}</strong></div>
          <div><span>模型状态</span><strong>{modelInfo?.behavior_loaded ? '行为模型 3/3' : '未加载'}</strong></div>
        </div>

        {violations.length > 0 && (
          <div className="camera-violations">
            {violations.map((item, index) => (
              <span key={`${item.violation_type}-${index}`}>{VIOLATION_TYPES[item.violation_type] || item.violation_type}</span>
            ))}
          </div>
        )}
      </section>

      <aside className="camera-source-panel">
        <div className="camera-source-header">
          <div><strong>视频源</strong><span>{sourceCount} 个可用设备</span></div>
          <button className="btn btn-outline btn-sm" onClick={loadSources} disabled={status === 'loading'}>
            {status === 'loading' ? '扫描中' : '重新扫描'}
          </button>
        </div>

        {error && status === 'permission-error' && (
          <div className="camera-permission-card">
            <strong>需要摄像头权限</strong><span>{error}</span>
            <button className="btn btn-primary btn-sm" onClick={loadSources}>重新授权</button>
          </div>
        )}

        <div className="camera-source-group">
          <div className="camera-source-group-title">本机摄像头</div>
          {localDevices.length === 0 && status !== 'loading' ? (
            <div className="camera-source-empty">未发现浏览器可访问的摄像头</div>
          ) : localDevices.map((device, index) => (
            <button
              key={device.deviceId}
              className={`camera-source-item ${selected?.type === 'local' && selected.id === device.deviceId ? 'active' : ''}`}
              onClick={() => selectLocal(device, index)}
            >
              <span className="camera-source-icon">USB</span>
              <span><strong>{device.label || `本机摄像头 ${index + 1}`}</strong><small>浏览器直连</small></span>
              <i />
            </button>
          ))}
        </div>

        <div className="camera-source-group">
          <div className="camera-source-group-title">RTSP 摄像头</div>
          {remoteCameras.length === 0 ? (
            <div className="camera-source-empty">尚未配置 RTSP 摄像头</div>
          ) : remoteCameras.map(camera => (
            <button
              key={camera.id}
              className={`camera-source-item ${selected?.type === 'remote' && selected.id === camera.id ? 'active' : ''}`}
              onClick={() => selectRemote(camera)}
            >
              <span className="camera-source-icon">IP</span>
              <span><strong>{camera.name}</strong><small>{camera.location || 'RTSP 视频流'}</small></span>
              <i />
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
