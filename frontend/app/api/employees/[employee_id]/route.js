import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request, { params }) {
  const { employee_id } = params;
  try {
    const res = await fetch(`${API_BASE}/api/employees/${employee_id}`, { headers: backendHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const { employee_id } = params;
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/employees/${employee_id}`, {
      method: 'PUT',
      headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { employee_id } = params;
  try {
    const res = await fetch(`${API_BASE}/api/employees/${employee_id}`, {
      method: 'DELETE',
      headers: backendHeaders(request)
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
