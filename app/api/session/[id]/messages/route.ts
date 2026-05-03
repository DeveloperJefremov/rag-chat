import { NextResponse } from 'next/server';
import { chatSessionRepo, messageRepo } from '@/server/infrastructure/http/container';
import { toMessageDto } from '@/shared/dtos/MessageDto';
import { withAuth } from '@/shared/http/withAuth';

export const GET = withAuth<{ id: string }>(async (_req, { user, params }) => {
	const session = await chatSessionRepo.findById(params.id, user.id);
	if (!session) {
		return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
	}
	const messages = await messageRepo.findBySessionId(params.id);
	return messages.map(toMessageDto);
}, 'session.messages');
