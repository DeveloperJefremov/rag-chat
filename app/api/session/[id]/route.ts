import { NextResponse } from 'next/server';
import { authContext, sessionService } from '@/server/infrastructure/http/container';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;
		await sessionService.delete(user.id, id);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'session_not_found') {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.delete] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
