import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function PUT(request, { params }) {
  const res = await fetch(`${API_BASE}/api/cameras/${params.id}`, {
    method: 'PUT', headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(await request.json()),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function DELETE(request, { params }) {
  const res = await fetch(`${API_BASE}/api/cameras/${params.id}`, {
    method: 'DELETE', headers: backendHeaders(request),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
