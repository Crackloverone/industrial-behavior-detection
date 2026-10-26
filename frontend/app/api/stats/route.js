import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || 7;
  
  try {
    const res = await fetch(`${API_BASE}/api/stats?days=${days}`, { headers: backendHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
