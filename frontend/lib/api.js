const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

function getToken() {
  try {
    const raw = localStorage.getItem('industrial_vision_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user.token || '';
    }
  } catch {}
  return '';
}

function authHeaders(extra = {}) {
  const token = getToken();
  const headers = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
  });
  return res.json();
}

export async function apiPost(path, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiPut(path, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function apiDelete(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.json();
}

export async function uploadModel(file) {
  const formData = new FormData();
  formData.append('model', file);
  const res = await fetch(`${API_BASE}/api/model/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });
  return res.json();
}

export function formatTime(timestamp) {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN');
}

export { getViolationText, VIOLATION_TYPES, DETECTION_LABELS, getDetectionLabel } from './constants';

export function getViolationIcon(type) {
  const map = {
    'no_workwear': '👕',
    'smoking': '🚬',
    'sleeping': '😴',
  };
  return map[type] || '⚠️';
}
