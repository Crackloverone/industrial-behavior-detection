import { NextResponse } from 'next/server';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function POST(request) {
  try {
    const body = await request.json();
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    const response = NextResponse.json(data, { status: res.status });
    if (res.ok && data.code === 200 && data.data?.token) {
      response.cookies.set('industrial_vision_token', data.data.token, {
        httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 12,
      });
    }
    return response;
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
