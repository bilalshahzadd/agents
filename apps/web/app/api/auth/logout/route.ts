import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const jar = await cookies();
  const refreshToken = jar.get('spheric_refresh')?.value;
  if (refreshToken) {
    try {
      await fetch(`${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/v1/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Session invalidation is best effort here; cookies are always removed below.
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('spheric_access');
  response.cookies.delete('spheric_refresh');
  return response;
}
