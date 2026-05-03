import { NextResponse } from 'next/server';
import { authContext, llmOpsService } from '@/server/infrastructure/http/container';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET() {
	try {
		await authContext.requireAdmin();
		const stats = await llmOpsService.getStats(100);
		return NextResponse.json(stats);
	} catch (err) {
		return httpErrorResponse(err, 'llmops.stats');
	}
}
