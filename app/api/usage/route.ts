import { NextResponse } from 'next/server';
import { authContext, sessionService } from '@/server/infrastructure/http/container';
import { UsageDto } from '@/shared/dtos/UsageDto';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET() {
	try {
		const user = await authContext.requireUser();
		const remaining = await sessionService.getRemaining(user.id, user.role);
		const dto: UsageDto = { remaining };
		return NextResponse.json(dto);
	} catch (err) {
		return httpErrorResponse(err, 'usage');
	}
}
