'use client';

import { useState, useEffect } from 'react';

const API_BASE = '';

export default function Model() {
  const [modelFile, setModelFile] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [confThreshold, setConfThreshold] = useState(0.5);
  const [iouThreshold, setIouThreshold] = useState(0.45);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadModelInfo();
  }, []);

  async function loadModelInfo() {
    try {
      const res = await fetch(`${API_BASE}/api/model/info`);
      if (res.ok) {
        const data = await res.json();
        setModelInfo(data.data || null);
      }
    } catch (e) {
      console.error('加载模型信息失败:', e);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.onnx') && !file.name.endsWith('.pt')) {
      setMessage({ type: 'error', text: '只支持 .onnx 或 .pt 格式的模型文件' });
      return;
    }

    setModelFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      const formData = new FormData();
      formData.append('model', file);

      const res = await fetch(`${API_BASE}/api/model/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);
      setUploadProgress(100);

      if (res.ok) {
        setMessage({ type: 'success', text: '模型上传成功' });
        loadModelInfo();
      } else {
        setMessage({ type: 'error', text: '上传失败，请重试' });
      }
    } catch (e) {
      clearInterval(interval);
      setMessage({ type: 'error', text: '上传失败: ' + e.message });
    }

    setIsUploading(false);
    setTimeout(() => setMessage(null), 3000);
  }

  async function handleSaveConfig() {
    try {
      await fetch(`${API_BASE}/api/model/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conf_threshold: confThreshold,
          iou_threshold: iouThreshold,
        }),
      });
      setMessage({ type: 'success', text: '配置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败' });
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>模型管理</h1>
          <div className="breadcrumb">系统 / 模型管理</div>
        </div>
      </div>

      <div style={{ padding: 20 }}>
        {message && (
          <div className={`toast toast-${message.type}`} style={{ marginBottom: 16 }}>
            {message.type === 'success' ? '✓' : '✗'} {message.text}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Model Upload */}
          <div className="section">
            <div className="section-header">
              <h3>模型文件</h3>
            </div>

            <div style={{
              padding: 20,
              background: modelInfo?.loaded ? 'var(--success-bg)' : 'var(--bg)',
              borderRadius: 'var(--radius)',
              marginBottom: 20,
              border: `1px solid ${modelInfo?.loaded ? 'var(--success)' : 'var(--border)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 48, height: 48,
                  background: modelInfo?.loaded ? 'var(--success)' : 'var(--text-muted)',
                  borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>
                  🤖
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>
                    {modelInfo?.model_name || 'YOLOv8 检测模型'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {modelInfo?.loaded ? '已加载' : '未加载'}
                  </div>
                </div>
              </div>

              {modelInfo && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>检测类别</div>
                    <div style={{ fontWeight: 600 }}>4 类</div>
                  </div>
                  <div style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ color: 'var(--text-muted)' }}>运行设备</div>
                    <div style={{ fontWeight: 600 }}>{modelInfo?.device || 'CPU'}</div>
                  </div>
                </div>
              )}
            </div>

            <div style={{
              border: '2px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: 40,
              textAlign: 'center',
              background: isUploading ? 'var(--primary-bg)' : 'var(--bg)',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
              onClick={() => !isUploading && document.getElementById('model-upload').click()}
            >
              <input
                type="file"
                id="model-upload"
                accept=".onnx,.pt"
                onChange={handleUpload}
                style={{ display: 'none' }}
              />

              {isUploading ? (
                <>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>正在上传模型...</div>
                  <div className="progress" style={{ maxWidth: 200, margin: '0 auto' }}>
                    <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{uploadProgress}%</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>点击上传模型文件</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    支持 .onnx 或 .pt 格式文件
                  </div>
                </>
              )}
            </div>

            {modelFile && !isUploading && (
              <div style={{ marginTop: 12, padding: 12, background: 'var(--surface)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                <div style={{ fontWeight: 600 }}>已选择: {modelFile.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{(modelFile.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            )}
          </div>

          {/* Detection Config */}
          <div className="section">
            <div className="section-header">
              <h3>检测参数配置</h3>
            </div>

            <div className="form-group">
              <label>置信度阈值 (Confidence)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={confThreshold}
                  onChange={e => setConfThreshold(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{(confThreshold * 100).toFixed(0)}%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                用于过滤低置信度的检测结果
              </div>
            </div>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label>IOU 阈值 (Intersection over Union)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={iouThreshold}
                  onChange={e => setIouThreshold(parseFloat(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span style={{ fontWeight: 600, minWidth: 50, textAlign: 'right' }}>{(iouThreshold * 100).toFixed(0)}%</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                用于去除重复检测框
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleSaveConfig}
              style={{ width: '100%', marginTop: 24 }}
            >
              保存配置
            </button>

            <div style={{ marginTop: 32 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                检测类别
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { name: '人员', icon: '👤', color: '#3b82f6' },
                  { name: '指定蓝色工作服', icon: '服', color: '#8b5cf6' },
                  { name: '抽烟', icon: '烟', color: '#dc2626' },
                  { name: '睡岗', icon: '睡', color: '#2563eb' },
                ].map((cls, idx) => (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)'
                  }}>
                    <div style={{
                      width: 36, height: 36,
                      background: cls.color + '20',
                      borderRadius: 'var(--radius)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18
                    }}>
                      {cls.icon}
                    </div>
                    <div style={{ fontWeight: 600 }}>{cls.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
