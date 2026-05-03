import { NextResponse } from 'next/server';
import { authContext, chatSessionRepo, messageRepo } from '@/server/infrastructure/http/container';
import { toMessageDto } from '@/shared/dtos/MessageDto';
import { httpErrorResponse } from '@/shared/errors/httpErrorResponse';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const user = await authContext.requireUser();
		const { id } = await params;

		const session = await chatSessionRepo.findById(id, user.id);
		if (!session) {
			return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
		}

		const messages = await messageRepo.findBySessionId(id);
		return NextResponse.json(messages.map(toMessageDto));
	} catch (err) {
		return httpErrorResponse(err, 'session.messages');
	}
}
