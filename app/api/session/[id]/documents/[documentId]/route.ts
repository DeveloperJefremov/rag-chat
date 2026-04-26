import { NextResponse } from 'next/server';
import { authContext, chatSessionRepo, documentRepo } from '@/server/infrastructure/http/container';

export async function DELETE(
	_req: Request,
	{ params }: { params: Promise<{ id: string; documentId: string }> },
) {
	try {
		const user = await authContext.requireUser();
		const { id, documentId } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		await documentRepo.detachFromSession(id, documentId);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.docs.detach] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
