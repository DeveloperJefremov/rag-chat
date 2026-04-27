import { NextResponse } from 'next/server';
import { authContext, accountService } from '@/server/infrastructure/http/container';

export async function DELETE() {
	try {
		const user = await authContext.requireUser();
		await accountService.deleteUser(user.id);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		if (err instanceof Error && err.message === 'user_not_found') {
			return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
		}
		console.error('account_delete_failed', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
