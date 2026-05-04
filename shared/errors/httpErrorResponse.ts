import { NextResponse } from 'next/server';
import { AppError } from './AppError';

export function httpErrorResponse(err: unknown, logTag?: string): NextResponse {
	if (err instanceof AppError) {
		return NextResponse.json({ error: err.code, ...(err.extra ?? {}) }, { status: err.status });
	}
	if (logTag) {
		// eslint-disable-next-line no-console
		console.error(`[${logTag}] failed:`, err);
	}
	return NextResponse.json({ error: 'internal_error' }, { status: 500 });
}
