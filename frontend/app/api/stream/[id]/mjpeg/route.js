import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const response = await fetch(`${API_BASE}/api/stream/${params.id}/mjpeg`, {
      cache: 'no-store',
      headers: backendHeaders(request),
    });
    if (!response.ok || !response.body) {
      return new Response('视频流不可用', { status: response.status || 502 });
    }
    return new Response(response.body, {
      headers: {
        'Content-Type': response.headers.get('content-type')
          || 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return new Response(error.message, { status: 502 });
  }
}
