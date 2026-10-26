'use client';

import { useEffect, useMemo, useState } from 'react';

const STATUS_TEXT = {
  running: '训练中',
  completed: '已完成',
  failed: '失败',
  stopped: '已停止',
  stopping: '停止中',
};

const STATUS_BADGE = {
  running: 'badge-info',
  completed: 'badge-success',
  failed: 'badge-danger',
  stopped: 'badge-warning',
  stopping: 'badge-warning',
};

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

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(digits);
}

function statusBadge(status) {
  return STATUS_BADGE[status] || 'badge-default';
}

function MetricChart({ title, metrics, group }) {
  const width = 680;
  const height = 260;
  const pad = 36;
  const lines = METRIC_LINES.filter(item => item.group === group);
  const pointsByLine = lines.map(line => ({
    ...line,
    points: metrics
      .filter(row => row[line.key] !== null && row[line.key] !== undefined)
      .map(row => ({ epoch: Number(row.epoch), value: Number(row[line.key]) })),
  })).filter(line => line.points.length > 0);

  const values = pointsByLine.flatMap(line => line.points.map(point => point.value));
  const epochs = metrics.map(row => Number(row.epoch)).filter(Boolean);
  const minEpoch = epochs.length ? Math.min(...epochs) : 1;
  const maxEpoch = epochs.length ? Math.max(...epochs) : 1;
  const minValue = values.length ? Math.min(...values) : 0;
  const maxValue = values.length ? Math.max(...values) : 1;
  const yMin = group === 'score' ? 0 : Math.max(0, minValue * 0.9);
  const yMax = group === 'score' ? 1 : maxValue * 1.1 || 1;

  function x(epoch) {
    if (maxEpoch === minEpoch) return pad;
    return pad + ((epoch - minEpoch) / (maxEpoch - minEpoch)) * (width - pad * 2);
  }

  function y(value) {
    if (yMax === yMin) return height - pad;
    return height - pad - ((value - yMin) / (yMax - yMin)) * (height - pad * 2);
  }

  return (
    <div className="section" style={{ minWidth: 0 }}>
      <div className="section-header">
        <h3>{title}</h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{metrics.length} epochs</span>
      </div>
      {metrics.length === 0 ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          等待训练指标写入 results.csv
        </div>
      ) : (
        <>
          <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 260, display: 'block' }}>
            <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5e1" />
            <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5e1" />
            {[0, 0.25, 0.5, 0.75, 1].map(tick => {
              const yy = pad + tick * (height - pad * 2);
              const value = yMax - tick * (yMax - yMin);
              return (
                <g key={tick}>
                  <line x1={pad} y1={yy} x2={width - pad} y2={yy} stroke="#e2e8f0" strokeDasharray="4 4" />
                  <text x={4} y={yy + 4} fontSize="11" fill="#64748b">{formatNumber(value, 2)}</text>
                </g>
              );
            })}
            {pointsByLine.map(line => (
              <polyline
                key={line.key}
                points={line.points.map(point => `${x(point.epoch)},${y(point.value)}`).join(' ')}
                fill="none"
                stroke={line.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {pointsByLine.map(line => (
              <div key={line.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: line.color }} />
                <span>{line.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Training() {
  const [targets, setTargets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    target: 'sleeping',
    epochs: 30,
    batch: 4,
    imgsz: 640,
    device: 'cpu',
    model: '',
  });

  useEffect(() => {
    loadTargets();
    loadJobs();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      loadJobs();
      if (selectedJobId) loadJob(selectedJobId);
    }, 2000);
    return () => clearInterval(timer);
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId && jobs.length > 0) {
      setSelectedJobId(jobs[0].id);
      loadJob(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  const activeJob = useMemo(
    () => jobs.find(job => ['running', 'stopping'].includes(job.status)),
    [jobs]
  );

  async function loadTargets() {
    const res = await fetch('/api/training/targets');
    const data = await res.json();
    if (data.code === 200) setTargets(data.data || []);
  }

  async function loadJobs() {
    const res = await fetch('/api/training/jobs');
    const data = await res.json();
    if (data.code === 200) setJobs(data.data || []);
  }

  async function loadJob(jobId) {
    const res = await fetch(`/api/training/jobs/${jobId}`);
    const data = await res.json();
    if (data.code === 200) setSelectedJob(data.data);
  }

  function updateForm(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function startTraining() {
    setMessage('');
    const payload = {
      target: form.target,
      epochs: Number(form.epochs),
      batch: Number(form.batch),
      imgsz: Number(form.imgsz),
      device: form.device || null,
    };
    if (form.model.trim()) payload.model = form.model.trim();
    if (form.target === 'workwear' && !payload.model) payload.model = 'yolov8n.pt';

    const res = await fetch('/api/training/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.code === 200) {
      setMessage('训练任务已启动');
      setSelectedJobId(data.data);
      await loadJobs();
      await loadJob(data.data);
    } else {
      setMessage(data.message || '启动训练失败');
    }
  }

  async function stopTraining(jobId) {
    const res = await fetch(`/api/training/jobs/${jobId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const data = await res.json();
    setMessage(data.message || (data.code === 200 ? '已请求停止训练' : '停止失败'));
    await loadJobs();
    if (selectedJobId) await loadJob(selectedJobId);
  }

  const currentMetrics = selectedJob?.metrics || [];
  const latest = currentMetrics[currentMetrics.length - 1] || {};
  const progressPct = Math.round((selectedJob?.progress || 0) * 100);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>模型训练</h1>
          <div className="breadcrumb">数据集微调 · 实时指标 · 训练日志</div>
        </div>
        <div className="page-header-actions">
          {activeJob ? (
            <span className="badge badge-info">训练中：{activeJob.target}</span>
          ) : (
            <span className="badge badge-success">空闲</span>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 24px', display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section">
            <div className="section-header"><h3>启动训练</h3></div>
            <div className="form-group">
              <label>训练目标</label>
              <select className="select" value={form.target} onChange={e => updateForm('target', e.target.value)} style={{ width: '100%' }}>
                <option value="sleeping">睡岗检测 sleeping</option>
                <option value="workwear">蓝色工作服 workwear</option>
              </select>
            </div>
            <div className="form-group">
              <label>初始权重</label>
              <input
                type="text"
                value={form.model}
                placeholder={form.target === 'workwear' ? '默认 yolov8n.pt' : '默认 EasyAlot sleeping.pt'}
                onChange={e => updateForm('model', e.target.value)}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                workwear 建议使用 yolov8n.pt；sleeping 留空会使用原睡岗模型。
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Epochs</label>
                <input type="number" min="1" max="300" value={form.epochs} onChange={e => updateForm('epochs', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Batch</label>
                <input type="number" min="1" max="32" value={form.batch} onChange={e => updateForm('batch', e.target.value)} />
              </div>
              <div className="form-group">
                <label>图片尺寸</label>
                <input type="number" min="320" max="1280" step="32" value={form.imgsz} onChange={e => updateForm('imgsz', e.target.value)} />
              </div>
              <div className="form-group">
                <label>设备</label>
                <input type="text" value={form.device} placeholder="cpu / 0" onChange={e => updateForm('device', e.target.value)} />
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={startTraining} disabled={Boolean(activeJob)}>
              开始训练
            </button>
            {message && <div style={{ marginTop: 12, fontSize: 12, color: message.includes('失败') ? 'var(--danger)' : 'var(--text-secondary)' }}>{message}</div>}
          </div>

          <div className="section">
            <div className="section-header"><h3>训练任务</h3><button className="btn btn-outline btn-sm" onClick={loadJobs}>刷新</button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflow: 'auto' }}>
              {jobs.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>暂无训练任务</div>}
              {jobs.map(job => (
                <button
                  key={job.id}
                  className="btn btn-outline"
                  onClick={() => { setSelectedJobId(job.id); loadJob(job.id); }}
                  style={{
                    justifyContent: 'space-between',
                    borderColor: selectedJobId === job.id ? 'var(--primary)' : 'var(--border)',
                    background: selectedJobId === job.id ? 'var(--primary-bg)' : 'transparent',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.id}</span>
                  <span className={`badge ${statusBadge(job.status)}`}>{STATUS_TEXT[job.status] || job.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section">
            <div className="section-header">
              <h3>当前任务</h3>
              {selectedJob?.status === 'running' && (
                <button className="btn btn-danger btn-sm" onClick={() => stopTraining(selectedJob.id)}>停止</button>
              )}
            </div>
            {!selectedJob ? (
              <div style={{ color: 'var(--text-muted)' }}>请选择或启动一个训练任务</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
                  <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>目标</div><div style={{ fontWeight: 700 }}>{selectedJob.target}</div></div>
                  <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>状态</div><span className={`badge ${statusBadge(selectedJob.status)}`}>{STATUS_TEXT[selectedJob.status] || selectedJob.status}</span></div>
                  <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Epoch</div><div style={{ fontWeight: 700 }}>{latest.epoch ? `${latest.epoch}/${selectedJob.epochs}` : `0/${selectedJob.epochs}`}</div></div>
                  <div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>mAP50</div><div style={{ fontWeight: 700 }}>{formatNumber(latest['metrics/mAP50(B)'])}</div></div>
                </div>
                <div className="progress" style={{ marginBottom: 8 }}>
                  <div className="progress-bar" style={{ width: `${progressPct}%` }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{progressPct}%</span>
                  <span>{selectedJob.best_model}</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <MetricChart title="Loss 曲线" metrics={currentMetrics} group="loss" />
            <MetricChart title="指标曲线" metrics={currentMetrics} group="score" />
          </div>

          <div className="section">
            <div className="section-header"><h3>训练日志</h3><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>最近 120 行</span></div>
            <pre style={{
              margin: 0,
              padding: 12,
              minHeight: 240,
              maxHeight: 360,
              overflow: 'auto',
              background: '#0f172a',
              color: '#e2e8f0',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>{(selectedJob?.log_tail || []).join('\n') || '暂无日志'}</pre>
          </div>
        </div>
      </div>
    </>
  );
}
