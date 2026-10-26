import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const camera_id = searchParams.get('camera_id');
  const limit = searchParams.get('limit') || 100;
  const offset = searchParams.get('offset') || 0;
  const handled = searchParams.get('handled');
  const violation_type = searchParams.get('violation_type');
  
  try {
    const url = new URL(`${API_BASE}/api/alarms`);
    if (camera_id) url.searchParams.set('camera_id', camera_id);
    url.searchParams.set('limit', limit);
    url.searchParams.set('offset', offset);
    if (handled !== null) url.searchParams.set('handled', handled);
    if (violation_type) url.searchParams.set('violation_type', violation_type);
    
    const res = await fetch(url.toString(), { headers: backendHeaders(request) });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}

// PUT /api/alarms/:id/handle - mark alarm as handled
export async function PUT(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ code: 400, message: 'Alarm ID required' }, { status: 400 });
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/alarms/${id}/handle`, {
      method: 'PUT',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
