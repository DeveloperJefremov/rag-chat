import { NextResponse } from 'next/server';
import { authContext, documentRepo } from '@/server/infrastructure/http/container';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const doc = await documentRepo.findById(id, user.id);
		if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

		await documentRepo.deleteById(id, user.id);
		return new NextResponse(null, { status: 204 });
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[documents.delete] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
