import { NextResponse } from 'next/server';
import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function GET(request, { params }) {
  try {
    const range = request.headers.get('range');
    const headers = backendHeaders(request, range ? { Range: range } : {});
    const res = await fetch(`${API_BASE}/api/alarms/${params.id}/video`, { headers });
    if (!res.ok) return new NextResponse('Video not found', { status: res.status });

    const responseHeaders = new Headers();
    [
      'content-type',
      'content-length',
      'content-range',
      'accept-ranges',
      'last-modified',
      'etag',
      'content-disposition',
    ].forEach((name) => {
      const value = res.headers.get(name);
      if (value) responseHeaders.set(name, value);
    });
    if (!responseHeaders.has('content-type')) responseHeaders.set('content-type', 'video/mp4');
    if (!responseHeaders.has('accept-ranges')) responseHeaders.set('accept-ranges', 'bytes');

    return new NextResponse(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse('Video not found', { status: 404 });
  }
}
