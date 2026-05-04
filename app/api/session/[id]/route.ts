import { NextResponse } from 'next/server';
import { sessionService } from '@/server/infrastructure/http/container';
import { withAuth } from '@/shared/http/withAuth';

export const DELETE = withAuth<{ id: string }>(async (_req, { user, params }) => {
	await sessionService.delete(user.id, params.id);
	return new NextResponse(null, { status: 204 });
}, 'session.delete');
