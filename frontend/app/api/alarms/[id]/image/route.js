import { backendHeaders } from '@/lib/serverAuth';

const API_BASE = process.env.API_BASE || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const response = await fetch(`${API_BASE}/api/alarms/${params.id}/image`, {
      cache: 'no-store',
      headers: backendHeaders(request),
    });

    if (!response.ok) {
      return new Response('报警截图不可用', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const body = await response.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    return new Response(error.message || '报警截图加载失败', { status: 502 });
  }
}
