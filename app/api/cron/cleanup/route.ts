import { NextRequest, NextResponse } from 'next/server';
import { cleanupService } from '@/server/infrastructure/http/container';

// Runs nightly via Vercel Cron (see vercel.json). Deletes expired ChatSessions
// and purges LLMLog rows older than the retention window. Authorized by a
// shared secret in `Authorization: Bearer <CRON_SECRET>` — Vercel Cron sets
// this header automatically using the CRON_SECRET project env var.
export const dynamic = 'force-dynamic';

function unauthorized(): NextResponse {
	return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(req: NextRequest) {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		// eslint-disable-next-line no-console
		console.error('[cron/cleanup] CRON_SECRET is not configured');
		return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
	}

	const auth = req.headers.get('authorization');
	if (auth !== `Bearer ${secret}`) return unauthorized();

	try {
		const result = await cleanupService.runAll();
		return NextResponse.json(result);
	} catch (err: unknown) {
		// eslint-disable-next-line no-console
		console.error('[cron/cleanup] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
