import { NextResponse } from 'next/server';
import { accountService } from '@/server/infrastructure/http/container';
import { withAuth } from '@/shared/http/withAuth';

export const DELETE = withAuth(async (_req, { user }) => {
	await accountService.deleteUser(user.id);
	return new NextResponse(null, { status: 204 });
}, 'account.delete');
