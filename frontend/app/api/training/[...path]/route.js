import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

function buildUrl(params) {
  const path = (params.path || []).join('/');
  return `${API_BASE}/api/training/${path}`;
}

export async function GET(request, { params }) {
  try {
    const sourceUrl = new URL(request.url);
    const targetUrl = new URL(buildUrl(params));
    sourceUrl.searchParams.forEach((value, key) => targetUrl.searchParams.set(key, value));
    const res = await fetch(targetUrl, { headers: backendHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const body = await request.json().catch(() => ({}));
    const res = await fetch(buildUrl(params), {
      method: 'POST',
      headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
