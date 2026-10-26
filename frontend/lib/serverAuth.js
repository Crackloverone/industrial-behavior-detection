export function backendHeaders(request, extra = {}) {
  const cookieToken = request.cookies?.get('industrial_vision_token')?.value;
  const authorization = request.headers?.get('authorization');
  const tokenHeader = authorization || (cookieToken ? `Bearer ${cookieToken}` : '');
  return { ...extra, ...(tokenHeader ? { Authorization: tokenHeader } : {}) };
}
