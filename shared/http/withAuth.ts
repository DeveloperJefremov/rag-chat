import { NextResponse } from 'next/server';
import { authContext } from '@/server/infrastructure/http/container';
import { AuthenticatedUser } from '@/server/application/ports/IAuthContext';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

type RouteCtx<P> = { params: Promise<P> };

type AuthedHandler<P, R> = (
	req: Request,
	args: { user: AuthenticatedUser; params: P },
) => Promise<R>;

export function withAuth<P = Record<string, never>, R = unknown>(
	handler: AuthedHandler<P, R>,
	logTag?: string,
) {
	return async (req: Request, ctx: RouteCtx<P>): Promise<NextResponse | Response> => {
		try {
			const user = await authContext.requireUser();
			const params = (await ctx?.params) ?? ({} as P);
			const result = await handler(req, { user, params });
			return result instanceof Response ? result : NextResponse.json(result);
		} catch (err) {
			return httpErrorResponse(err, logTag);
		}
	};
}

export function withAdmin<P = Record<string, never>, R = unknown>(
	handler: AuthedHandler<P, R>,
	logTag?: string,
) {
	return async (req: Request, ctx: RouteCtx<P>): Promise<NextResponse | Response> => {
		try {
			const user = await authContext.requireAdmin();
			const params = (await ctx?.params) ?? ({} as P);
			const result = await handler(req, { user, params });
			return result instanceof Response ? result : NextResponse.json(result);
		} catch (err) {
			return httpErrorResponse(err, logTag);
		}
	};
}
