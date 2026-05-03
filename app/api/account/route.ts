import { NextResponse } from 'next/server';
import { authContext, accountService } from '@/server/infrastructure/http/container';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function DELETE() {
	try {
		const user = await authContext.requireUser();
		await accountService.deleteUser(user.id);
		return new NextResponse(null, { status: 204 });
	} catch (err) {
		return httpErrorResponse(err, 'account.delete');
	}
}
