import { NextResponse } from 'next/server';
import { authContext, sessionService } from '@/server/infrastructure/http/container';
import { UsageDto } from '@/shared/dtos/UsageDto';

export async function GET() {
	try {
		const user = await authContext.requireUser();
		const remaining = await sessionService.getRemaining(user.id, user.role);
		const dto: UsageDto = { remaining };
		return NextResponse.json(dto);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
