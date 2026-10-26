import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const res = await fetch(`${API_BASE}/api/stream/${id}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    // Determine action from body or URL
    const action = body.action || 'start';
    const res = await fetch(`${API_BASE}/api/stream/${id}/${action}`, {
      method: 'POST',
      headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
