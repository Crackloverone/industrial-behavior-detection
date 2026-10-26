import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

async function markHandled(request, id) {
  let body = {};
  try { body = await request.json(); } catch {}
  const res = await fetch(`${API_BASE}/api/alarms/${id}/handle`, {
    method: 'PUT',
    headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}

export async function PUT(request, { params }) {
  try {
    return await markHandled(request, params.id);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    return await markHandled(request, params.id);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
