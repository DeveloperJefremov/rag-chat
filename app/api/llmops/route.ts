import { NextResponse } from 'next/server';
import { authContext, llmOpsService } from '@/server/infrastructure/http/container';

export async function GET() {
	try {
		await authContext.requireAdmin();
		const stats = await llmOpsService.getStats(100);
		return NextResponse.json(stats);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'forbidden') {
			return NextResponse.json({ error: 'forbidden' }, { status: 403 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
