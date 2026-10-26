import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request, { params }) {
  try {
    const { id } = params;
    const res = await fetch(`${API_BASE}/api/alarms/${id}`, { headers: backendHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const res = await fetch(`${API_BASE}/api/alarms/${id}/handle`, {
      method: 'PUT',
      headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(await request.json().catch(() => ({}))),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const res = await fetch(`${API_BASE}/api/alarms/${id}`, {
      method: 'DELETE',
      headers: backendHeaders(request),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
