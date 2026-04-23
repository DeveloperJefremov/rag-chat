import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from './auth';
import { checkIpRateLimit } from './shared/lib/rateLimit';

export default auth((request: NextRequest) => {
	const { pathname } = request.nextUrl;
	const session = (request as NextRequest & { auth: unknown }).auth;

	// IP rate limit on all API routes
	if (pathname.startsWith('/api/')) {
		const ip =
			request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
			request.headers.get('x-real-ip') ??
			'127.0.0.1';

		const { allowed, remaining } = checkIpRateLimit(ip);

		if (!allowed) {
			return NextResponse.json(
				{ error: 'rate_limit_exceeded', message: 'Too many requests. Try again in a minute.' },
				{ status: 429, headers: { 'X-RateLimit-Remaining': '0' } },
			);
		}

		const response = NextResponse.next();
		response.headers.set('X-RateLimit-Remaining', String(remaining));
		return response;
	}

	// Auth gate for UI routes (except signin page)
	const publicPaths = ['/signin', '/api/auth'];
	const isPublic = publicPaths.some(p => pathname.startsWith(p));

	if (!isPublic && !session) {
		return NextResponse.redirect(new URL('/signin', request.url));
	}

	return NextResponse.next();
});

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
};
