import { NextResponse } from 'next/server';
import { authContext, chatSessionRepo, documentRepo } from '@/server/infrastructure/http/container';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

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
	} catch (err) {
		return httpErrorResponse(err, 'session.docs.detach');
	}
}
