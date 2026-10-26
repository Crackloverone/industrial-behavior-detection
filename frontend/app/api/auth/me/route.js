import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: backendHeaders(request) });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch (error) {
    return NextResponse.json({ code: 500, message: error.message }, { status: 500 });
  }
}
