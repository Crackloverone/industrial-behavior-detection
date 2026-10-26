'use client';

import { useState, useEffect } from 'react';
import { getViolationText } from '@/lib/constants';

// All HTTP calls go through local /api/* routes

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const pageSize = 15;

  useEffect(() => {
    loadAlarms();
  }, [page, statusFilter, typeFilter]);

  async function loadAlarms() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      if (statusFilter === 'handled') params.append('handled', 1);
      if (statusFilter === 'pending') params.append('handled', 0);
      if (typeFilter) params.append('violation_type', typeFilter);

      const res = await fetch(`/api/alarms?${params}`);
      if (!res.ok) throw new Error('Network response was not ok');
      
      const data = await res.json();
      if (data.code === 200) {
        setAlarms(data.data || []);
        setTotal(data.total || 0);
      } else {
        throw new Error(data.message || 'API error');
      }
    } catch (e) {
      console.error('Failed to load alarms:', e);
      setAlarms([]);
      setTotal(0);
    }
    setIsLoading(false);
  }

  async function handleAlarm(alarmId) {
    try {
      await fetch(`/api/alarms/${alarmId}/handle`, { method: 'PUT', headers: { 'Content-Type': 'application/json' } });
      setAlarms(prev => prev.map(a => a.id === alarmId ? { ...a, handled: 1 } : a));
    } catch (e) {
      console.error('Failed to handle alarm:', e);
    }
  }

  async function handleAllPending() {
    const pending = alarms.filter(a => !a.handled);
    for (const alarm of pending) {
      await handleAlarm(alarm.id);
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1;

  function getViolationIcon(type) {
    const map = {
      no_workwear: '服',
      smoking: '烟',
      sleeping: '睡'
    };
    return map[type] || '?';
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Alarm Records</h1>
          <div className="breadcrumb">Management / Alarms</div>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-outline btn-sm" onClick={loadAlarms}>
            Refresh
          </button>
          {alarms.some(a => !a.handled) && (
            <button className="btn btn-success btn-sm" onClick={handleAllPending}>
              Handle All Pending
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: 20 }}>
        <div className="section" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Status:</span>
              <select className="select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} style={{ width: 120 }}>
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="handled">Handled</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Type:</span>
              <select className="select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} style={{ width: 140 }}>
                <option value="">All</option>
                <option value="no_workwear">未穿指定蓝色工作服</option>
                <option value="smoking">抽烟</option>
                <option value="sleeping">睡岗</option>
              </select>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
              Total: {total} records
            </div>
          </div>
        </div>

        <div className="section">
          {isLoading ? (
            <div className="loading">
              <div className="spinner"></div>
            </div>
          ) : alarms.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 48, marginBottom: 12 }}>OK</div>
              <div>No alarm records</div>
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>Icon</th>
                    <th>Type</th>
                    <th>Camera</th>
                    <th>Location</th>
                    <th>Time</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th style={{ width: 100 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {alarms.map((alarm, idx) => (
                    <tr key={alarm.id || idx} style={{ opacity: alarm.handled ? 0.7 : 1 }}>
                      <td style={{ fontSize: 20 }}>{getViolationIcon(alarm.violation_type)}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{getViolationText(alarm.violation_type)}</span>
                      </td>
                      <td>{alarm.camera_name || '-'}</td>
                      <td>{alarm.location || '-'}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        {alarm.timestamp ? new Date(alarm.timestamp * 1000).toLocaleString() : '-'}
                      </td>
                      <td>
                        {alarm.handled ? (
                          <span className="badge badge-success">Handled</span>
                        ) : (
                          <span className="badge badge-danger">Pending</span>
                        )}
                      </td>
                      <td>
                        {!alarm.handled && (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => handleAlarm(alarm.id)}
                          >
                            Handle
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Prev
                  </button>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        className={`pagination-btn ${page === pageNum ? 'active' : ''}`}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  {totalPages > 5 && <span style={{ color: 'var(--text-muted)' }}>...</span>}
                  <button
                    className="pagination-btn"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
