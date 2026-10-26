import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';
import fs from 'fs';
import path from 'path';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request, { params }) {
  const { employee_id } = params;
  
  try {
    const photoType = new URL(request.url).searchParams.get('photo_type') || 'id';
    const res = await fetch(`${API_BASE}/api/employees/${employee_id}/photo?photo_type=${photoType}`, { headers: backendHeaders(request) });
    if (!res.ok) {
      return new NextResponse('Photo not found', { status: 404 });
    }
    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/jpeg' }
    });
  } catch (e) {
    return new NextResponse('Photo not found', { status: 404 });
  }
}

export async function POST(request, { params }) {
  const { employee_id } = params;
  const photoType = new URL(request.url).searchParams.get('photo_type') || 'id';
  
  try {
    const formData = await request.formData();
    const photo = formData.get('photo');
    
    if (!photo) {
      return NextResponse.json({ code: 400, message: 'No photo provided' }, { status: 400 });
    }
    
    const buffer = await photo.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    const res = await fetch(`${API_BASE}/api/employees/${employee_id}/photo?photo_type=${photoType}`, {
      method: 'POST',
      headers: backendHeaders(request, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ photo: base64 })
    });
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ code: 500, message: e.message }, { status: 500 });
  }
}
