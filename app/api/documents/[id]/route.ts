import { NextResponse } from 'next/server';
import { authContext, documentRepo } from '@/server/infrastructure/http/container';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const doc = await documentRepo.findById(id, user.id);
		if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 });

		await documentRepo.deleteById(id, user.id);
		return new NextResponse(null, { status: 204 });
	} catch (err) {
		return httpErrorResponse(err, 'documents.delete');
	}
}
