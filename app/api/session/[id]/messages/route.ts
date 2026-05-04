import { NextResponse } from 'next/server';
import { chatSessionRepo, messageRepo } from '@/server/infrastructure/http/container';
import { toMessageDto } from '@/shared/dtos/MessageDto';
import { withAuth } from '@/shared/http/withAuth';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export const GET = withAuth<{ id: string }>(async (req, { user, params }) => {
	const session = await chatSessionRepo.findById(params.id, user.id);
	if (!session) {
		return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
	}

	const url = new URL(req.url);
	const rawLimit = Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE);
	const limit = Number.isFinite(rawLimit)
		? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(rawLimit)))
		: DEFAULT_PAGE_SIZE;
	const beforeRaw = url.searchParams.get('before');
	const before = beforeRaw ? new Date(beforeRaw) : undefined;
	if (before && Number.isNaN(before.getTime())) {
		return NextResponse.json({ error: 'invalid_before' }, { status: 400 });
	}

	const messages = await messageRepo.findBySessionId(params.id, { limit, before });
	return messages.map(toMessageDto);
}, 'session.messages');
