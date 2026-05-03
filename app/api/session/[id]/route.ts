import { NextResponse } from 'next/server';
import { authContext, sessionService } from '@/server/infrastructure/http/container';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;
		await sessionService.delete(user.id, id);
		return new NextResponse(null, { status: 204 });
	} catch (err) {
		return httpErrorResponse(err, 'session.delete');
	}
}
