import { NextResponse } from 'next/server';
import { chatSessionRepo, documentRepo } from '@/server/infrastructure/http/container';
import { withAuth } from '@/shared/http/withAuth';

export const DELETE = withAuth<{ id: string; documentId: string }>(
	async (_req, { user, params }) => {
		const session = await chatSessionRepo.findById(params.id, user.id);
		if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });

		await documentRepo.detachFromSession(params.id, params.documentId);
		return new NextResponse(null, { status: 204 });
	},
	'session.docs.detach',
);
