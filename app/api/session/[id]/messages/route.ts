import { NextResponse } from 'next/server';
import { authContext, chatSessionRepo, messageRepo } from '@/server/infrastructure/http/container';
import { MessageDto } from '@/shared/dtos/MessageDto';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}

		const messages = await messageRepo.findBySessionId(id);
		const dtos: MessageDto[] = messages.map(m => ({
			id: m.id,
			role: m.role,
			content: m.content,
			citations: m.citations ?? undefined,
			createdAt: m.createdAt.toISOString(),
		}));
		return NextResponse.json(dtos);
	} catch (err: unknown) {
		if (err instanceof Error && err.message === 'unauthenticated') {
			return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
		}
		// eslint-disable-next-line no-console
		console.error('[session.messages] failed:', err);
		return NextResponse.json({ error: 'internal_error' }, { status: 500 });
	}
}
