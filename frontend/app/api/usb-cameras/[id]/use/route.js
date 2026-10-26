import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function POST(request, { params }) {
  const res = await fetch(`${API_BASE}/api/usb-cameras/${params.id}/use`, {
    method: 'POST', headers: backendHeaders(request),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
