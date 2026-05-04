import { NextResponse } from 'next/server';
import { documentRepo } from '@/server/infrastructure/http/container';
import { withAuth } from '@/shared/http/withAuth';

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
	const doc = await documentRepo.findById(params.id, user.id);
	if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

	await documentRepo.deleteById(params.id, user.id);
	return new NextResponse(null, { status: 204 });
}, 'documents.delete');
